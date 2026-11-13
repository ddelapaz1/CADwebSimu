// Run with: node web/test/sim.test.js  (from app/)
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ["model.js", "symbols.js", "sim.js", "render.js", "examples.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8"), ctx, { filename: f });
}
const SL = ctx.SL;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log("ok   " + name); } catch (e) { failed++; console.log("FAIL " + name + ": " + e.message); }
}
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || "") + " expected " + JSON.stringify(b) + " got " + JSON.stringify(a)); }
const find = (d, k, n) => d.comps.find((c) => c.kind === k && c.name === n).id;

test("direct start, thermal trip and stop", () => {
  const d = SL.exampleDoc();
  const s = new SL.Sim(d);
  const s1 = find(d, "PushNO", "-S1"), s0 = find(d, "PushNC", "-S0"), m = find(d, "Motor3", "-M1"), f1 = find(d, "ThermalRelay3", "-F1");
  eq(s.tick(d, 0.1), null);
  eq(s.st[m].motor, 0);
  s.setActuator(d, s1, true); s.tick(d, 0.1); s.setActuator(d, s1, false); s.tick(d, 0.1);
  eq(s.st[m].motor, 1, "runs after start");
  s.setActuator(d, f1, true); s.tick(d, 0.1);
  eq(s.st[m].motor, 0, "thermal trip stops");
  s.setActuator(d, f1, false);
  s.setActuator(d, s1, true); s.tick(d, 0.1); s.setActuator(d, s1, false);
  s.setActuator(d, s0, true); s.tick(d, 0.1);
  eq(s.st[m].motor, 0, "stop button");
});

test("star-delta sequence", () => {
  const d = SL.exampleYdDoc();
  const s = new SL.Sim(d);
  const s1 = find(d, "PushNO", "-S1"), m = find(d, "Motor3YD", "-M1");
  eq(s.tick(d, 0.1), null);
  s.setActuator(d, s1, true); eq(s.tick(d, 0.1), null); s.setActuator(d, s1, false); eq(s.tick(d, 0.1), null);
  eq([s.st[m].motor, s.st[m].conn], [1, 1], "star");
  for (let i = 0; i < 40; i++) eq(s.tick(d, 0.1), null, "no fault");
  eq([s.st[m].motor, s.st[m].conn], [1, 2], "delta");
});

test("reversing starter sequence and interlock", () => {
  const d = SL.exampleRevDoc();
  const s = new SL.Sim(d);
  const s0 = find(d, "PushNC", "-S0"), s1 = find(d, "PushNO", "-S1"), s2 = find(d, "PushNO", "-S2"), m = find(d, "Motor3", "-M1");
  eq(s.tick(d, 0.1), null);
  eq(s.st[m].motor, 0);
  // Start forward (-S1)
  s.setActuator(d, s1, true); eq(s.tick(d, 0.1), null); s.setActuator(d, s1, false); eq(s.tick(d, 0.1), null);
  eq(s.st[m].motor, 1, "runs forward");
  // Pressing reverse (-S2) while forward is running should be blocked by electrical interlock
  s.setActuator(d, s2, true); eq(s.tick(d, 0.1), null); s.setActuator(d, s2, false); eq(s.tick(d, 0.1), null);
  eq(s.st[m].motor, 1, "interlock prevents reverse while forward");
  // Stop (-S0)
  s.setActuator(d, s0, true); eq(s.tick(d, 0.1), null); s.setActuator(d, s0, false); eq(s.tick(d, 0.1), null);
  eq(s.st[m].motor, 0, "stopped");
  // Start reverse (-S2)
  s.setActuator(d, s2, true); eq(s.tick(d, 0.1), null); s.setActuator(d, s2, false); eq(s.tick(d, 0.1), null);
  eq(s.st[m].motor, -1, "runs reverse");
});

test("short circuit", () => {
  const d = SL.newDoc();
  SL.makeComp(d, "FeedLN", 0, 0, 0, "");
  SL.addWire(d, [0, 30], [0, 60]); SL.addWire(d, [0, 60], [30, 60]); SL.addWire(d, [30, 60], [30, 30]);
  eq(new SL.Sim(d).tick(d, 0.1), "Short");
});

test("earth leakage", () => {
  const d = SL.newDoc();
  SL.makeComp(d, "FeedLNPE", 0, 0, 0, "");
  SL.addWire(d, [0, 30], [0, 45]); SL.addWire(d, [0, 45], [60, 45]); SL.addWire(d, [60, 45], [60, 30]);
  eq(new SL.Sim(d).tick(d, 0.1), "Earth");
});

test("motor PE terminal fed", () => {
  const d = SL.newDoc();
  SL.makeComp(d, "FeedL123", 0, 0, 0, "");
  SL.makeComp(d, "Motor3", 0, 60, 0, "-M1");
  SL.addWire(d, [0, 30], [0, 60]); SL.addWire(d, [0, 45], [90, 45]); SL.addWire(d, [90, 45], [90, 60]);
  eq(new SL.Sim(d).tick(d, 0.1), "GroundFed");
});

test("on-delay timer", () => {
  const d = SL.newDoc();
  SL.makeComp(d, "FeedL", 0, 0, 0, "");
  const t = SL.makeComp(d, "TimerOn", 0, 60, 0, "-KT1", { time_base: 1 }).id;
  SL.makeComp(d, "FeedN", 0, 120, 0, "");
  SL.addWire(d, [0, 30], [0, 60]); SL.addWire(d, [0, 120], [0, 150]);
  const s = new SL.Sim(d);
  s.tick(d, 0.1);
  eq([s.st[t].energized, s.st[t].on], [true, false]);
  for (let i = 0; i < 12; i++) s.tick(d, 0.1);
  eq(s.st[t].on, true);
});

test("timer preset follows the original tick table", () => {
  const c = { time_base: 5.7, time_mult: 1 };
  eq(SL.presetTicks(c), 50);
  c.time_mult = 0.1; eq(SL.presetTicks(c), 5);
  c.time_mult = 10; eq(SL.presetTicks(c), 500);
  c.time_mult = 60; eq(SL.presetTicks(c), 5000);
});

test("on/off-delay timer", () => {
  const d = SL.newDoc();
  SL.makeComp(d, "FeedL", 0, 0, 0, "");
  const sw = SL.makeComp(d, "SwitchNO", 0, 60, 0, "-S1").id;
  const t = SL.makeComp(d, "TimerOnOff", 0, 150, 0, "-KT1", { time_base: 1 }).id;
  SL.makeComp(d, "FeedN", 0, 210, 0, "");
  SL.addWire(d, [0, 30], [0, 60]); SL.addWire(d, [0, 120], [0, 150]); SL.addWire(d, [0, 210], [0, 240]);
  const s = new SL.Sim(d);
  s.setActuator(d, sw, true); s.tick(d, 0.1);
  for (let i = 0; i < 5; i++) s.tick(d, 0.1);
  eq(s.st[t].on, false);
  for (let i = 0; i < 8; i++) s.tick(d, 0.1);
  eq(s.st[t].on, true);
  s.setActuator(d, sw, false);
  for (let i = 0; i < 5; i++) s.tick(d, 0.1);
  eq(s.st[t].on, true);
  for (let i = 0; i < 8; i++) s.tick(d, 0.1);
  eq(s.st[t].on, false);
});

test("click behaviour matches the original", () => {
  ["PushNO", "PushNC", "MushroomNO", "MushroomNC", "LimitNO", "LimitNC"].forEach((k) => eq(SL.clickKind(k), "momentary", k));
  ["SwitchNO", "SwitchNC", "Breaker3", "ThermalRelay3"].forEach((k) => eq(SL.clickKind(k), "toggle", k));
});

test("new breaker starts open, stored position is used", () => {
  const d = SL.newDoc();
  SL.makeComp(d, "FeedL", 0, 0, 0, "");
  const q = SL.makeComp(d, "Breaker1", 0, 60, 0, "-Q1");
  const h = SL.makeComp(d, "Lamp", 0, 150, 0, "-H1").id;
  SL.makeComp(d, "FeedN", 0, 210, 0, "");
  SL.addWire(d, [0, 30], [0, 60]); SL.addWire(d, [0, 120], [0, 150]); SL.addWire(d, [0, 210], [0, 240]);
  let s = new SL.Sim(d); s.tick(d, 0.1); eq(s.st[h].energized, false);
  q.closed = true;
  s = new SL.Sim(d); s.tick(d, 0.1); eq(s.st[h].energized, true);
});

test("file format matches the Mac app", () => {
  const d = SL.normalizeDoc(JSON.parse(JSON.stringify(SL.exampleDoc())));
  eq(d.format, "ElectroCADSim-1");
  eq(d.comps[0].kind, "FeedL123");
});

test("Connections submenu contains Cable, Punt de connexió, and Born", () => {
  const connItems = SL.KIND_LIST.filter((k) => k.cat === "Connections").map((k) => k.id);
  eq(connItems, ["Wire", "Junction", "Terminal", "Continuation"]);
  eq(SL.KINDS.Wire.label, "Cable");
  eq(SL.KINDS.Junction.label, "Punt de connexió");
  eq(SL.buildSymbol("Wire", {}).prims.length > 0, true);
  eq(SL.buildSymbol("Junction", {}).prims.length > 0, true);
});

test("crossing conductors do not connect by default; Punt de connexió toggles connection", () => {
  const d = SL.newDoc();
  SL.makeComp(d, "FeedL", 150, 60, 0, "");   // terminal at (150, 90)
  SL.makeComp(d, "FeedN", 60, 150, 3, "");   // rot 3 -> terminal at (90, 150)
  // Vertical wire L from (150, 90) to (150, 240)
  SL.addWire(d, [150, 90], [150, 240]);
  // Horizontal wire N from (90, 150) to (240, 150) crossing at (150, 150)
  SL.addWire(d, [90, 150], [240, 150]);

  eq(SL.isConnectedJunction(d, [150, 150]), false, "not connected by default");
  eq(SL.junctionPoints(d), [], "no dot by default");
  eq(new SL.Sim(d).tick(d, 0.1), null, "no short circuit when crossing without junction");

  // If a conductor ends on an existing connection point (T-junction), adding another conductor at that point keeps the connection
  const d2 = SL.newDoc();
  SL.makeComp(d2, "FeedL", 150, 60, 0, "");
  SL.makeComp(d2, "FeedN", 60, 150, 3, "");
  SL.addWire(d2, [150, 90], [150, 240]);
  SL.addWire(d2, [90, 150], [150, 150]);
  eq(SL.isConnectedJunction(d2, [150, 150]), true, "T-junction is connected");
  SL.addWire(d2, [150, 150], [240, 150]);
  eq(SL.isConnectedJunction(d2, [150, 150]), true, "existing connection point is preserved when another conductor ends/starts there");
  eq(new SL.Sim(d2).tick(d2, 0.1), "Short", "connected junction causes L-N short");

  // Click Punt de connexió at (150, 150) -> connects them (L + N = Short)
  const r1 = SL.toggleJunction(d, [150, 150]);
  eq([r1.changed, r1.connected], [true, true], "connected after first click");
  eq(SL.isConnectedJunction(d, [150, 150]), true);
  eq(SL.junctionPoints(d), [[150, 150]]);
  eq(new SL.Sim(d).tick(d, 0.1), "Short", "connected crossing causes L-N short");

  // Click again at (150, 150) -> undoes connection
  const r2 = SL.toggleJunction(d, [150, 150]);
  eq([r2.changed, r2.connected], [true, false], "disconnected after second click");
  eq(SL.isConnectedJunction(d, [150, 150]), false);
  eq(SL.junctionPoints(d), []);
  eq(new SL.Sim(d).tick(d, 0.1), null, "no short after undoing connection");
});

test("moving connected element redraws wire with 90° turns only", () => {
  const d = SL.newDoc();
  SL.makeComp(d, "FeedL", 300, 120, 0, ""); // terminal at (300, 150)
  const lamp = SL.makeComp(d, "Lamp", 300, 210, 0, "-H1"); // terminals at (300, 210) and (300, 270)
  SL.makeComp(d, "FeedN", 300, 360, 2, ""); // terminal at (300, 330)
  SL.addWire(d, [300, 150], [300, 210]);
  SL.addWire(d, [300, 270], [300, 330]);

  // Move lamp horizontally by +90 and vertically by +15
  const res = SL.moveItems(d, new Set([lamp.id]), 90, 15);
  eq(res.disconnected, false, "connection remade");
  eq(d.wires.length > 0, true, "wires exist");
  // Every wire segment must be strictly horizontal or vertical (90° turns only)
  d.wires.forEach((w) => {
    const orthogonal = w.a[0] === w.b[0] || w.a[1] === w.b[1];
    eq(orthogonal, true, "segment is orthogonal: " + JSON.stringify(w));
  });
  // Lamp should still be electrically connected and energized in simulation
  const s = new SL.Sim(d);
  eq(s.tick(d, 0.1), null);
  eq(s.st[lamp.id].energized, true, "lamp remains energized after orthogonal reroute");
});

test("moving connected element to impossible position deletes wire and reports disconnection", () => {
  const d = SL.newDoc();
  SL.makeComp(d, "FeedL", 300, 120, 0, ""); // terminal at (300, 150)
  const fuse = SL.makeComp(d, "Fuse1", 300, 210, 0, "-F1"); // terminals at (300, 210), (300, 270)
  SL.addWire(d, [300, 150], [300, 210]);

  // Move fuse directly on top of FeedL so connection is impossible
  const res = SL.moveItems(d, new Set([fuse.id]), 0, -90);
  eq(res.disconnected, true, "reports disconnection");
  eq(d.wires.length, 0, "conductor was removed");
});

test("rotating connected element redraws wire with 90° turns only", () => {
  const d = SL.newDoc();
  SL.makeComp(d, "FeedL", 300, 120, 0, ""); // terminal at (300, 150)
  const lamp = SL.makeComp(d, "Lamp", 300, 210, 0, "-H1"); // terminals at (300, 210) and (300, 270)
  SL.makeComp(d, "FeedN", 300, 360, 2, ""); // terminal at (300, 330)
  SL.addWire(d, [300, 150], [300, 210]);
  SL.addWire(d, [300, 270], [300, 330]);

  // Rotate lamp 90° clockwise: terminals become (300, 210) and (240, 210)
  const res = SL.rotateItems(d, new Set([lamp.id]), 1, false);
  eq(res.disconnected, false, "connection remade on rotate");
  eq(lamp.rot, 1, "lamp rotated");
  eq(d.wires.length > 0, true, "wires exist");
  d.wires.forEach((w) => {
    const orthogonal = w.a[0] === w.b[0] || w.a[1] === w.b[1];
    eq(orthogonal, true, "segment is orthogonal: " + JSON.stringify(w));
  });
  const s = new SL.Sim(d);
  eq(s.tick(d, 0.1), null);
  eq(s.st[lamp.id].energized, true, "lamp remains energized after rotate reroute");
});

test("rotating connected element to impossible orientation deletes wire and reports disconnection", () => {
  const d = SL.newDoc();
  SL.makeComp(d, "FeedL", 300, 120, 0, ""); // terminal at (300, 150)
  const fuse = SL.makeComp(d, "Fuse1", 300, 210, 0, "-F1"); // terminals at (300, 210), (300, 270)
  SL.addWire(d, [300, 150], [300, 210]);

  // Rotate fuse 180°: second terminal moves to (300, 150), colliding with FeedL terminal
  const res = SL.rotateItems(d, new Set([fuse.id]), 2, false);
  eq(res.disconnected, true, "reports disconnection on impossible rotate");
  eq(res.names, ["-F1"], "reports component name");
  eq(fuse.rot, 2, "fuse remains rotated");
  eq(d.wires.length, 0, "conductor was removed");
});

test("all registered symbols in SL.KIND_LIST build valid geometry", () => {
  SL.KIND_LIST.forEach((k) => {
    const sym = SL.buildSymbol(k.id, {});
    eq(sym.prims.length > 0, true, "symbol has prims: " + k.id);
    const symOn = SL.buildSymbol(k.id, { closed: true, active: true, motor: 1 });
    eq(symOn.prims.length > 0, true, "active symbol has prims: " + k.id);
  });
});

// ---------------------------------------------------------------- protections and new elements
const W = (d, a, b) => SL.addWire(d, a, b);
const tickN = (s, d, n, dt) => { let f = null; for (let i = 0; i < n && !f; i++) f = s.tick(d, dt); return f; };

test("short circuit blows the nearest fuse; the rest stays energised; fuse can be replaced", () => {
  const d = SL.newDoc();
  SL.makeComp(d, "FeedLN", 300, 120, 0, "");               // L (300,150)  N (330,150)
  const f1 = SL.makeComp(d, "Fuse1", 300, 150, 0, "-F1");  // (300,150)-(300,210)
  const f2 = SL.makeComp(d, "Fuse1", 300, 210, 0, "-F2");  // (300,210)-(300,270)
  const sw = SL.makeComp(d, "Switch1", 300, 270, 0, "-Q1"); // (300,270)-(300,330)
  const h = SL.makeComp(d, "Lamp", 420, 210, 0, "-H1");    // (420,210)-(420,270)
  W(d, [300, 210], [420, 210]);
  W(d, [330, 150], [330, 400]);
  W(d, [420, 270], [420, 400]);
  W(d, [330, 400], [420, 400]);
  W(d, [300, 330], [330, 330]);
  const s = new SL.Sim(d);
  eq(s.tick(d, 0.1), null);
  eq(s.st[h.id].energized, true, "lamp on");
  s.setActuator(d, sw.id, true);
  eq(s.tick(d, 0.1), null, "no fault: a fuse blows instead");
  eq([!!s.st[f1.id].blown, !!s.st[f2.id].blown], [false, true], "only -F2 (closest) blows");
  eq(s.st[h.id].energized, true, "lamp branch still fed");
  eq(s.events.length, 1, "event reported");
  s.replaceFuse(d, f2.id); eq(s.tick(d, 0.1), null);
  eq(!!s.st[f2.id].blown, true, "blows again while the short remains");
  s.setActuator(d, sw.id, false); s.replaceFuse(d, f2.id); eq(s.tick(d, 0.1), null);
  eq(!!s.st[f2.id].blown, false, "replaced fuse holds");
});

test("earth fault trips the RCD (preferred to the MCB); L-N short is not an RCD trip", () => {
  const d = SL.newDoc();
  SL.makeComp(d, "FeedLNPE", 300, 120, 0, "");                                   // L 300, N 330, PE 360 (y 150)
  const rcd = SL.makeComp(d, "Rcd1N", 300, 150, 0, "-Q1", { closed: true });     // L 300,150-210  N 330,150-210
  const h = SL.makeComp(d, "Lamp", 300, 210, 0, "-H1");                          // (300,210)-(300,270)
  W(d, [330, 210], [330, 270]); W(d, [300, 270], [330, 270]);
  const flt = SL.makeComp(d, "Switch1", 270, 210, 0, "-S9");                      // (270,210)-(270,270)
  const q2 = SL.makeComp(d, "Auto1", 270, 270, 0, "-Q2", { closed: true });       // (270,270)-(270,330)
  W(d, [300, 210], [270, 210]); W(d, [270, 330], [360, 330]); W(d, [360, 150], [360, 330]);
  const s = new SL.Sim(d);
  eq(s.tick(d, 0.1), null); eq(s.st[h.id].energized, true);
  s.setActuator(d, flt.id, true);
  eq(s.tick(d, 0.1), null, "RCD trips instead of a fault");
  eq([s.st[rcd.id].act, s.st[q2.id].act, !!s.st[rcd.id].tripped], [false, true, true]);
  eq(s.st[h.id].energized, false, "everything after the RCD is off");

  const d2 = SL.newDoc();
  SL.makeComp(d2, "FeedLN", 300, 120, 0, "");
  SL.makeComp(d2, "Rcd1N", 300, 150, 0, "-Q1", { closed: true });
  W(d2, [300, 210], [330, 210]);
  eq(new SL.Sim(d2).tick(d2, 0.1), "Short", "L-N short behind an RCD only: fault");
});

test("diode conducts anode to cathode only", () => {
  const build = (rot) => {
    const d = SL.newDoc();
    SL.makeComp(d, "FeedPosNeg", 300, 120, 0, "");      // + (300,150)  - (330,150)
    if (rot) SL.makeComp(d, "Diode", 300, 210, 2, "-V1"); // reversed: cathode at (300,150)
    else SL.makeComp(d, "Diode", 300, 150, 0, "-V1");
    const h = SL.makeComp(d, "Lamp", 300, 210, 0, "-H1");
    W(d, [300, 270], [330, 270]); W(d, [330, 150], [330, 270]);
    const s = new SL.Sim(d); eq(s.tick(d, 0.1), null);
    return s.st[h.id].energized;
  };
  eq(build(false), true, "forward");
  eq(build(true), false, "reverse blocks");
});

test("pulse counter counts to its preset and resets through R", () => {
  const d = SL.newDoc();
  SL.makeComp(d, "FeedLN", 300, 120, 0, "");
  const s1 = SL.makeComp(d, "Switch1", 300, 150, 0, "-S1");
  const kc = SL.makeComp(d, "Counter", 300, 210, 0, "-KC1", { count_preset: 3 }); // R at (270,210)
  const s2 = SL.makeComp(d, "Switch1", 270, 150, 0, "-S2");
  W(d, [270, 150], [300, 150]); W(d, [300, 270], [330, 270]); W(d, [330, 150], [330, 270]);
  const s = new SL.Sim(d); eq(s.tick(d, 0.1), null);
  const pulse = () => { s.setActuator(d, s1.id, true); s.tick(d, 0.1); s.setActuator(d, s1.id, false); s.tick(d, 0.1); };
  pulse(); pulse(); eq([s.st[kc.id].count, s.st[kc.id].on], [2, false]);
  pulse(); eq([s.st[kc.id].count, s.st[kc.id].on], [3, true], "reaches preset");
  s.setActuator(d, s2.id, true); s.tick(d, 0.1);
  eq([s.st[kc.id].count, s.st[kc.id].on], [0, false], "reset");
});

test("time switch repeats its ON/OFF program", () => {
  const d = SL.newDoc();
  SL.makeComp(d, "FeedLN", 300, 120, 0, "");
  const ts = SL.makeComp(d, "TimeSwitch", 300, 150, 0, "-KT1", { time_base: 2, off_base: 1, time_mult: 1 });
  W(d, [300, 210], [330, 210]); W(d, [330, 150], [330, 210]);
  const s = new SL.Sim(d); eq(s.tick(d, 0), null);
  eq(s.st[ts.id].on, true, "starts ON");
  tickN(s, d, 25, 0.1); eq(s.st[ts.id].on, false, "OFF after 2 s");
  tickN(s, d, 10, 0.1); eq(s.st[ts.id].on, true, "ON again after 3 s");
});

test("mechanical interlock keeps two contactors from closing together", () => {
  const build = (withInterlock) => {
    const d = SL.newDoc();
    SL.makeComp(d, "Contactor3", 150, 300, 0, "-KM1");
    SL.makeComp(d, "Contactor3", 300, 300, 0, "-KM2");
    if (withInterlock) SL.makeComp(d, "Interlock", 240, 300, 0, "");
    const coils = [600, 750].map((x, i) => {
      SL.makeComp(d, "FeedLN", x, 120, 0, "");
      const c = SL.makeComp(d, "Coil", x, 150, 0, "-KM" + (i + 1));
      W(d, [x, 210], [x + 30, 210]); W(d, [x + 30, 150], [x + 30, 210]);
      return c;
    });
    const s = new SL.Sim(d); eq(s.tick(d, 0.1), null);
    return coils.map((c) => s.st[c.id].on);
  };
  eq(build(false), [true, true]);
  eq(build(true), [true, false], "second contactor blocked");
});

test("overload relay trips when the motor runs on two phases", () => {
  const d = SL.newDoc();
  SL.makeComp(d, "FeedL123", 150, 120, 0, "");                          // (150|180|210, 150)
  W(d, [150, 150], [150, 210]); W(d, [180, 150], [180, 210]);
  const q = SL.makeComp(d, "Switch1", 210, 150, 0, "-Q1", { closed: true });
  const f = SL.makeComp(d, "ThermalRelay3", 150, 210, 0, "-F1");
  const m = SL.makeComp(d, "Motor3", 150, 270, 0, "-M1");
  const s = new SL.Sim(d); eq(s.tick(d, 0.1), null);
  eq(s.st[m.id].motor, 1, "runs on three phases");
  s.setActuator(d, q.id, false); eq(s.tick(d, 0.1), null);
  eq([s.st[m.id].motor, s.st[m.id].twoPhase], [0, true], "two phases: hums");
  tickN(s, d, 15, 0.1); eq(s.st[f.id].act, false, "not yet");
  tickN(s, d, 20, 0.1); eq(s.st[f.id].act, true, "thermal tripped");
  eq(s.events.some((e) => /tèrmic/.test(e)), true);
});

test("moving a whole block with its conductors keeps every conductor", () => {
  const d = SL.exampleRevDoc();
  const len = (ws) => ws.reduce((a, w) => a + Math.abs(w.a[0] - w.b[0]) + Math.abs(w.a[1] - w.b[1]), 0);
  const x0 = Math.min(...d.comps.filter((c) => c.kind === "Coil").map((c) => c.x)) - 40;
  const sel = new Set();
  d.comps.forEach((c) => { if (SL.compRect(c).x0 >= x0) sel.add(c.id); });
  d.wires.forEach((w) => { if (Math.min(w.a[0], w.b[0]) >= x0) sel.add(w.id); });
  const before = len(d.wires);
  const res = SL.moveItems(d, sel, -150, -60);
  eq(res.disconnected, false, "nothing disconnected");
  eq(len(d.wires), before, "same total conductor length");
  const s = new SL.Sim(d), id = (k, n) => d.comps.find((c) => c.kind === k && c.name === n).id;
  eq(s.tick(d, 0.1), null);
  s.setActuator(d, id("PushNO", "-S1"), true); s.tick(d, 0.1); s.setActuator(d, id("PushNO", "-S1"), false); s.tick(d, 0.1);
  eq(s.st[id("Motor3", "-M1")].motor, 1, "moved control circuit still works");
});

// ---------------------------------------------------------------- logic
// Pins: inputs at (x, y + 30*i), outputs at (x + 60, ...). Probes drive inputs; we read st.lo.
function logicRig(kind, nIn, extra) {
  const d = SL.newDoc();
  const g = SL.makeComp(d, kind, 300, 300, 0, "-U1", extra || {});
  const io = SL.logicIO(kind), tp = SL.terminals(g);
  const probes = io.ins.slice(0, nIn).map((ti, i) => {
    const p = tp[ti];
    const pr = SL.makeComp(d, "LogicProbe", p[0] - 105, p[1], 0, "-S" + (i + 1)); // output at (p.x - 60, p.y)
    SL.addWire(d, [p[0] - 60, p[1]], p);
    return pr;
  });
  const s = new SL.Sim(d);
  const set = (vals, dt) => { vals.forEach((v, i) => s.setActuator(d, probes[i].id, !!v)); return s.tick(d, dt || 0); };
  return { d, s, g, set, out: () => s.st[g.id].lo.map(Number) };
}

test("logic gates truth tables", () => {
  const tt = { LogicAnd: [0, 0, 0, 1], LogicOr: [0, 1, 1, 1], LogicXor: [0, 1, 1, 0], LogicNand: [1, 1, 1, 0], LogicNor: [1, 0, 0, 0] };
  Object.keys(tt).forEach((k) => {
    const r = logicRig(k, 2);
    const got = [[0, 0], [1, 0], [0, 1], [1, 1]].map((v) => { eq(r.set(v), null); return r.out()[0]; });
    eq(got, tt[k], k);
  });
  const n = logicRig("LogicNot", 1);
  n.set([0]); eq(n.out(), [1]); n.set([1]); eq(n.out(), [0]);
});

test("SR flip-flop and binary divider", () => {
  const sr = logicRig("LogicSR", 2);
  sr.set([1, 0]); sr.set([0, 0]); eq(sr.out(), [1, 0], "set and hold");
  sr.set([1, 1]); eq(sr.out(), [0, 1], "reset dominant");
  const dv = logicRig("LogicDiv2", 2);
  const seq = [];
  for (let i = 0; i < 4; i++) { dv.set([1, 0]); seq.push(dv.out()[0]); dv.set([0, 0]); }
  eq(seq, [1, 0, 1, 0], "toggles on each rising edge");
});

test("logic timers", () => {
  const T = { time_base: 1, time_mult: 1 };
  const ton = logicRig("LogicTon", 1, T);
  ton.set([1], 0); for (let i = 0; i < 5; i++) ton.set([1], 0.1); eq(ton.out(), [0], "TON waiting");
  for (let i = 0; i < 7; i++) ton.set([1], 0.1); eq(ton.out(), [1], "TON on after 1 s");
  ton.set([0], 0.1); eq(ton.out(), [0]);

  const tp = logicRig("LogicTp", 1, T);
  tp.set([1], 0); eq(tp.out(), [1], "pulse starts on rising edge"); tp.set([0], 0.1);
  for (let i = 0; i < 12; i++) tp.set([0], 0.1); eq(tp.out(), [0], "pulse ends after 1 s");

  const tof = logicRig("LogicTof", 1, T);
  tof.set([1], 0.1); tof.set([0], 0.1); eq(tof.out(), [1], "TOF holds");
  for (let i = 0; i < 12; i++) tof.set([0], 0.1); eq(tof.out(), [0], "TOF off after 1 s");

  const fl = logicRig("LogicFlash", 1, T);
  const v = [];
  fl.set([1], 0); for (let i = 0; i < 30; i++) { fl.set([1], 0.1); v.push(fl.out()[0]); }
  eq(v.includes(0) && v.includes(1), true, "flashes");

  const pg = logicRig("LogicPulse", 1, T);
  let pulses = 0, prev = 0;
  pg.set([1], 0); for (let i = 0; i < 35; i++) { pg.set([1], 0.1); const o = pg.out()[0]; if (o && !prev) pulses++; prev = o; }
  eq(pulses, 3, "one short pulse per second");
});

test("logic counters", () => {
  const c = logicRig("LogicCnt", 2, { count_preset: 3 });
  const pulse = (r, vals) => { r.set(vals); r.set(vals.map(() => 0)); };
  pulse(c, [1, 0]); pulse(c, [1, 0]); eq(c.out(), [0]); pulse(c, [1, 0]); eq(c.out(), [1], "reaches preset");
  c.set([0, 1]); eq([c.out()[0], c.s.st[c.g.id].cnt], [0, 0], "reset");

  const ud = logicRig("LogicCntUD", 3, { count_preset: 2 });
  pulse(ud, [1, 0, 0]); pulse(ud, [1, 0, 0]); eq(ud.out(), [1]); pulse(ud, [0, 1, 0]); eq(ud.out(), [0], "counts down");

  const b4 = logicRig("LogicCnt4", 2);
  for (let i = 0; i < 5; i++) pulse(b4, [1, 0]);
  eq(b4.out(), [1, 0, 1, 0], "binary 5");
  for (let i = 0; i < 11; i++) pulse(b4, [1, 0]);
  eq(b4.out(), [0, 0, 0, 0], "wraps at 16");

  const ud4 = logicRig("LogicCnt4UD", 3);
  pulse(ud4, [0, 1, 0]); eq(ud4.out(), [1, 1, 1, 1], "0 - 1 = 15");

  const bcd = logicRig("LogicCnt10", 2);
  for (let i = 0; i < 9; i++) pulse(bcd, [1, 0]);
  eq(bcd.out(), [1, 0, 0, 1], "9");
  pulse(bcd, [1, 0]); eq(bcd.out(), [0, 0, 0, 0], "decade wraps to 0");
});

test("preselector -> 7-segment decoder -> display", () => {
  const d = SL.newDoc();
  const ps = SL.makeComp(d, "LogicPreset", 150, 150, 0, "-S1", { value: 7 }); // outs (210, 150..240 step 30)
  const dec = SL.makeComp(d, "Logic7Dec", 300, 150, 0, "-U1");               // ins (300, 150..240), outs (360, 150..240 step 15)
  const dsp = SL.makeComp(d, "Logic7Seg", 450, 150, 0, "-P1");               // ins (450, 150..240 step 15)
  for (let i = 0; i < 4; i++) SL.addWire(d, [210, 150 + 30 * i], [300, 150 + 30 * i]);
  for (let i = 0; i < 7; i++) SL.addWire(d, [360, 150 + 15 * i], [450, 150 + 15 * i]);
  const s = new SL.Sim(d);
  eq(s.tick(d, 0.1), null);
  const segs = () => s.st[dsp.id].cur.map(Number).join("");
  eq(segs(), "1110000", "7 = a b c");
  s.stepPreset(d, ps.id); s.tick(d, 0);
  eq(segs(), "1111111", "8 = all segments");
  s.stepPreset(d, ps.id); s.stepPreset(d, ps.id); s.tick(d, 0);
  eq(segs(), "1111110", "0");
});

test("Prova drives Visualitza", () => {
  const d = SL.newDoc();
  const pr = SL.makeComp(d, "LogicProbe", 150, 150, 0, "-S1");   // out (195,150)
  const v = SL.makeComp(d, "LogicView", 300, 150, 0, "-P1");     // in (300,150)
  SL.addWire(d, [195, 150], [300, 150]);
  const s = new SL.Sim(d);
  eq(s.tick(d, 0), null); eq(s.st[v.id].cur, [false]);
  s.setActuator(d, pr.id, true); s.tick(d, 0); eq(s.st[v.id].cur, [true], "Visualitza shows 1");
});

test("a new element never repeats the name of another of the same type", () => {
  const d = SL.newDoc();
  SL.makeComp(d, "Coil", 600, 150, 0, "-KM2");
  SL.makeComp(d, "Contactor3", 150, 150, 0, "-KM2");
  SL.makeComp(d, "Contactor3", 300, 150, 0, "-KM3");
  eq(SL.uniqueName(d, "Contactor3", "-KM2"), "-KM4", "skips every used number");
  eq(SL.uniqueName(d, "Contactor1", "-KM2"), "-KM4", "any contactor counts");
  eq(SL.uniqueName(d, "Coil", "-KM1"), "-KM1", "free name kept");
  eq(SL.uniqueName(d, "Coil", "-KM2"), "-KM3", "a coil only clashes with coils");
  SL.makeComp(d, "AuxNO", 600, 300, 0, "-KM2");
  eq(SL.uniqueName(d, "AuxNO", "-KM2"), "-KM3", "second NO contact moves on");
  eq(SL.uniqueName(d, "AuxNC", "-KM2"), "-KM2", "an NC of the same contactor is allowed");
  SL.makeComp(d, "Lamp", 750, 150, 0, "-H1");
  eq(SL.uniqueName(d, "Bell", "-H1"), "-H2", "signalling devices share -H");
  eq(SL.uniqueName(d, "LogicAnd", ""), "", "unnamed elements stay unnamed");
});

test("rotating several elements turns the whole block, not each element", () => {
  const build = () => {
    const d = SL.newDoc();
    const n = [0, 1, 2, 3].map((i) => SL.makeComp(d, "LogicNand", 300, 150 + 90 * i, 0, "")); // out (360, 165 + 90i)
    const a = [0, 1].map((i) => SL.makeComp(d, "LogicAnd", 420, 180 + 180 * i, 0, ""));       // ins (420, 180|210 + 180i)
    [0, 1].forEach((i) => {
      SL.addWire(d, [360, 165 + 180 * i], [390, 165 + 180 * i]); SL.addWire(d, [390, 165 + 180 * i], [390, 180 + 180 * i]); SL.addWire(d, [390, 180 + 180 * i], [420, 180 + 180 * i]);
      SL.addWire(d, [360, 255 + 180 * i], [390, 255 + 180 * i]); SL.addWire(d, [390, 255 + 180 * i], [390, 210 + 180 * i]); SL.addWire(d, [390, 210 + 180 * i], [420, 210 + 180 * i]);
    });
    return { d, n, a };
  };
  const len = (ws) => ws.reduce((t, w) => t + Math.abs(w.a[0] - w.b[0]) + Math.abs(w.a[1] - w.b[1]), 0);
  const andOut = (d, a) => { const s = new SL.Sim(d); eq(s.tick(d, 0), null); return a.map((g) => s.st[g.id].lo[0]); };

  const { d, n, a } = build();
  const sel = new Set(d.comps.map((c) => c.id).concat(d.wires.map((w) => w.id)));
  const before = len(d.wires), rel = (c) => [c.x - n[0].x, c.y - n[0].y];
  eq(andOut(d, a), [true, true], "NAND(0,0)=1 feeds AND");
  const res = SL.rotateItems(d, sel, 1, false);
  eq(res.disconnected, false, "nothing disconnected");
  eq(len(d.wires), before, "inner conductors keep their length");
  eq(d.comps.map((c) => c.rot), [1, 1, 1, 1, 1, 1], "every element turned");
  eq(rel(n[1]), [-90, 0], "gates stacked downwards now sit side by side (right to left)");
  eq(andOut(d, a), [true, true], "still connected after rotating");

  for (let i = 0; i < 3; i++) SL.rotateItems(d, sel, 1, false);
  const orig = build();
  eq(d.comps.map((c) => [c.x - d.comps[0].x, c.y - d.comps[0].y, c.rot]), orig.d.comps.map((c) => [c.x - orig.d.comps[0].x, c.y - orig.d.comps[0].y, c.rot]), "4 turns = original layout");

  const m = build();
  const msel = new Set(m.d.comps.map((c) => c.id).concat(m.d.wires.map((w) => w.id)));
  eq(SL.rotateItems(m.d, msel, 0, true).disconnected, false, "mirror the block");
  eq(m.d.comps.every((c) => c.mirror), true);
  eq(m.a[0].x < m.n[0].x, true, "ANDs now on the left of the NANDs");
  eq(andOut(m.d, m.a), [true, true], "mirrored block still works");
  eq(SL.rotateItems(m.d, msel, 1, false).disconnected, false, "rotate the mirrored block");
  eq(andOut(m.d, m.a), [true, true], "mirrored + rotated block still works");
  eq(len(m.d.wires), before, "inner conductors intact");

  const one = build();
  SL.rotateItems(one.d, new Set([one.n[0].id]), 1, false);
  eq([one.n[0].x, one.n[0].y, one.n[0].rot], [300, 150, 1], "a single element still turns in place");
});

test("fault mode: cut wire, open coil, stuck contact", () => {
  const run = (fault) => {
    const d = SL.exampleDoc();
    const id = (k, n) => d.comps.find((c) => c.kind === k && c.name === n).id;
    if (fault) d.faults = [fault(d, id)];
    const s = new SL.Sim(d), m = id("Motor3", "-M1"), s1 = id("PushNO", "-S1");
    s.tick(d, 0.1); s.setActuator(d, s1, true); s.tick(d, 0.1); s.setActuator(d, s1, false); s.tick(d, 0.1);
    return s.st[m].motor;
  };
  eq(run(null), 1, "healthy circuit runs");
  eq(run((d, id) => ({ id: id("Coil", "-KM1"), type: "open" })), 0, "burnt coil: no start");
  eq(run((d, id) => ({ id: id("PushNO", "-S1"), type: "open" })), 0, "start button never closes");
  eq(run((d, id) => ({ id: id("AuxNO", "-KM1"), type: "open" })), 0, "self-holding contact open: stops on release");
  const stuck = SL.exampleDoc(), sid = (k, n) => stuck.comps.find((c) => c.kind === k && c.name === n).id;
  stuck.faults = [{ id: sid("PushNO", "-S1"), type: "stuck" }];
  const ss = new SL.Sim(stuck); ss.tick(stuck, 0.1);
  eq(ss.st[sid("Motor3", "-M1")].motor, 1, "stuck start button starts the motor by itself");
  // a cut wire: find the conductor that feeds the coil terminal A1 and cut it
  const cutDoc = SL.exampleDoc(), coil = cutDoc.comps.find((c) => c.kind === "Coil");
  const a1 = SL.terminals(coil)[0];
  const w = cutDoc.wires.find((x) => (x.a[0] === a1[0] && x.a[1] === a1[1]) || (x.b[0] === a1[0] && x.b[1] === a1[1]));
  cutDoc.faults = [{ id: w.id, type: "cut" }];
  const cs = new SL.Sim(cutDoc), cid = (k, n) => cutDoc.comps.find((c) => c.kind === k && c.name === n).id;
  cs.tick(cutDoc, 0.1); cs.setActuator(cutDoc, cid("PushNO", "-S1"), true); cs.tick(cutDoc, 0.1);
  eq(cs.st[cid("Motor3", "-M1")].motor, 0, "cut wire: coil not fed");
  eq(cs.wirePot[w.id] == null, true, "the cut wire carries nothing");
  // the probe reads 0 V across an open coil that has voltage on both sides
  eq(SL.voltage(SL.POT.L1, SL.POT.N), "230 V CA");
  eq(SL.voltage(SL.POT.L1, SL.POT.L2), "400 V CA");
  eq(SL.voltage(SL.POT.POS, SL.POT.NEG), "24 V CC");
  eq(SL.voltage(SL.POT.L1, 0).indexOf("0 V"), 0);
  eq(SL.potName(SL.POT.L1 | SL.POT.N), "L1+N");
});

test("new motors: DC polarity, capacitor motor, Dahlander, wound rotor", () => {
  const W = (d, a, b) => SL.addWire(d, a, b);
  // DC motor
  let d = SL.newDoc();
  SL.makeComp(d, "FeedPosNeg", 300, 170, 0, "");
  let m = SL.makeComp(d, "MotorDC", 300, 200, 0, "-M1");
  let s = new SL.Sim(d); s.tick(d, 0.1); eq(s.st[m.id].motor, 1, "DC forward");
  d = SL.newDoc();
  SL.makeComp(d, "FeedPosNeg", 300, 90, 0, "");                 // + (300,120)  - (330,120)
  m = SL.makeComp(d, "MotorDC", 300, 200, 0, "-M1");            // A1 (300,200) A2 (330,200)
  W(d, [330, 120], [330, 165]); W(d, [330, 165], [300, 165]); W(d, [300, 165], [300, 200]);
  W(d, [300, 120], [270, 120]); W(d, [270, 120], [270, 180]); W(d, [270, 180], [330, 180]); W(d, [330, 180], [330, 200]);
  s = new SL.Sim(d); eq(s.tick(d, 0.1), null); eq(s.st[m.id].motor, -1, "DC reversed polarity");

  // capacitor motor
  const cap = (aux) => {
    const dd = SL.newDoc();
    SL.makeComp(dd, "FeedLN", 300, 270, 0, "");
    const mm = SL.makeComp(dd, "Motor1Cap", 300, 300, 0, "-M1");
    if (aux === 1) SL.makeComp(dd, "FeedLN", 360, 270, 0, "");
    if (aux === -1) { const f = SL.makeComp(dd, "FeedLN", 390, 270, 0, ""); f.mirror = true; }
    const ss = new SL.Sim(dd); eq(ss.tick(dd, 0.1), null);
    return [ss.st[mm.id].motor, !!ss.st[mm.id].twoPhase];
  };
  eq(cap(1), [1, false]); eq(cap(-1), [-1, false], "Z1/Z2 swapped reverses"); eq(cap(0), [0, true], "no auxiliary winding: hums");

  // Dahlander
  const dahl = (high) => {
    const dd = SL.newDoc();
    const mm = SL.makeComp(dd, "Motor3Dahl", 150, 300, 0, "-M1"); // 1U..1W 150..210, 2U..2W 240..300
    if (!high) { SL.makeComp(dd, "FeedL123", 150, 120, 0, ""); [150, 180, 210].forEach((x) => W(dd, [x, 150], [x, 300])); }
    else { SL.makeComp(dd, "FeedL123", 240, 120, 0, ""); [240, 270, 300].forEach((x) => W(dd, [x, 150], [x, 300])); if (high === 2) W(dd, [150, 300], [210, 300]); }
    const ss = new SL.Sim(dd); eq(ss.tick(dd, 0.1), null);
    return [ss.st[mm.id].motor, ss.st[mm.id].conn || 0];
  };
  eq(dahl(0), [1, 1], "low speed"); eq(dahl(2), [1, 2], "high speed (YY)"); eq(dahl(1), [0, 0], "high without joining 1U-1V-1W");

  // wound rotor with a resistor step bridged by a contactor
  const wr = (bridge, star) => {
    const dd = SL.newDoc();
    SL.makeComp(dd, "FeedL123", 150, 120, 0, "");
    const mm = SL.makeComp(dd, "Motor3WR", 150, 150, 0, "-M1");   // K L M at (150|180|210, 270)
    SL.makeComp(dd, "Resistor3", 150, 270, 0, "-R1");               // to (x, 330)
    if (star) W(dd, [150, 330], [210, 330]);
    SL.makeComp(dd, "Contactor3", 150, 270, 0, "-KM9");
    if (bridge) { SL.makeComp(dd, "FeedLN", 600, 120, 0, ""); SL.makeComp(dd, "Coil", 600, 150, 0, "-KM9"); W(dd, [600, 210], [630, 210]); W(dd, [630, 150], [630, 210]); }
    const ss = new SL.Sim(dd); eq(ss.tick(dd, 0.1), null);
    return [ss.st[mm.id].motor, ss.st[mm.id].steps || 0, !!ss.st[mm.id].rotorOpen];
  };
  eq(wr(false, true), [1, 1, false], "starts with one resistor step");
  eq(wr(true, true), [1, 0, false], "step bridged: full speed");
  eq(wr(false, false), [0, 0, true], "open rotor: does not start");
});

test("braked motor trips the overload relay; ramps", () => {
  const d = SL.exampleDoc(), id = (k, n) => d.comps.find((c) => c.kind === k && c.name === n).id;
  const s = new SL.Sim(d), m = id("Motor3", "-M1"), f1 = id("ThermalRelay3", "-F1"), s1 = id("PushNO", "-S1");
  s.tick(d, 0.1); s.setActuator(d, s1, true); s.tick(d, 0.1); s.setActuator(d, s1, false);
  for (let i = 0; i < 3; i++) s.tick(d, 0.1);
  eq(s.st[m].spd > 0.4 && s.st[m].spd < 0.76, true, "accelerating direct-on-line");
  for (let i = 0; i < 10; i++) s.tick(d, 0.1);
  eq(Math.abs(s.st[m].spd - 0.75) < 1e-9, true, "full speed");
  s.toggleBrake(d, m);
  for (let i = 0; i < 40; i++) s.tick(d, 0.1);
  eq(s.st[f1].act, false, "not yet after 4 s");
  for (let i = 0; i < 15; i++) s.tick(d, 0.1);
  eq([s.st[f1].act, s.st[m].motor], [true, 0], "tripped after ~5 s and the motor stops");
  eq(s.log.some((e) => /frenat/.test(e.text)), true, "logged");

  // soft starter: 2 s ramp
  const d2 = SL.newDoc();
  SL.makeComp(d2, "FeedL123", 150, 120, 0, "");
  SL.makeComp(d2, "SoftStarter3", 150, 150, 0, "-G1", { time_base: 2, time_mult: 1 });
  const m2 = SL.makeComp(d2, "Motor3", 150, 210, 0, "-M1");
  SL.makeComp(d2, "FeedLN", 600, 120, 0, "");
  const ctl = SL.makeComp(d2, "SoftCtrl", 600, 150, 0, "-G1");
  eq(SL.terminals(ctl), [[600, 150], [630, 150]], "control A1/A2 sit on the feed");
  const s2 = new SL.Sim(d2); eq(s2.tick(d2, 0.1), null);
  eq(s2.st[m2.id].motor, 1, "motor fed through the soft starter");
  for (let i = 0; i < 9; i++) s2.tick(d2, 0.1);
  eq(s2.st[m2.id].rampT, 2, "ramp time from the starter");
  eq(s2.st[m2.id].spd > 0.4 && s2.st[m2.id].spd < 0.6, true, "half speed after 1 s of a 2 s ramp: " + s2.st[m2.id].spd);
});

test("sheets and continuation markers", () => {
  const d = SL.newDoc();
  d.page.count = 2;
  const y2 = SL.sheetY(d, 1);                       // top of sheet 2
  eq(SL.sheetOf(d, [100, 100]), 1); eq(SL.sheetOf(d, [100, y2 + 100]), 2);
  SL.makeComp(d, "FeedLN", 300, 120, 0, "");       // L (300,150) N (330,150)
  SL.makeComp(d, "Continuation", 300, 210, 0, "C1"); SL.makeComp(d, "Continuation", 330, 210, 0, "C2");
  SL.addWire(d, [300, 150], [300, 210]); SL.addWire(d, [330, 150], [330, 210]);
  const h = SL.makeComp(d, "Lamp", 300, y2 + 210, 0, "-H1");          // on sheet 2
  SL.makeComp(d, "Continuation", 300, y2 + 150, 0, "C1"); SL.makeComp(d, "Continuation", 360, y2 + 150, 0, "C2");
  SL.addWire(d, [300, y2 + 150], [300, y2 + 210]);
  SL.addWire(d, [300, y2 + 270], [360, y2 + 270]); SL.addWire(d, [360, y2 + 270], [360, y2 + 150]);
  const s = new SL.Sim(d); eq(s.tick(d, 0.1), null);
  eq(s.st[h.id].energized, true, "lamp on sheet 2 fed from sheet 1 through C1/C2");
  eq(SL.colRef(d, [300, y2 + 200]), "2.2", "sheet.column reference");
  // an element can be moved onto the second sheet
  const r = SL.moveItems(d, new Set([h.id]), 0, 60);
  eq(r.disconnected, false, "moves within sheet 2");
});

test("labels never sit on the conductor of a horizontal element", () => {
  const d = SL.newDoc();
  const v = SL.makeComp(d, "AuxNO", 300, 300, 0, "-KM1");
  const hz = SL.makeComp(d, "AuxNO", 300, 600, 1, "-KM1");
  eq(SL.isHorizontal(v), false); eq(SL.isHorizontal(hz), true);
  // the name of a horizontal element goes above it, clear of the conductor that runs through its middle
  const r = SL.compRect(hz), lr = SL.labelRect(hz), ts = SL.terminals(hz);
  eq(lr.y1 <= r.y0, true, "label above the symbol");
  eq(ts.every((p) => p[1] > lr.y1), true, "conductor row below the label");
  const lv = SL.labelRect(v), rv = SL.compRect(v);
  eq(lv.x1 <= rv.x0, true, "vertical element: label on the left");
  hz.lx = 30; hz.ly = -15;
  const moved = SL.labelRect(hz);
  eq([moved.x0 - lr.x0, moved.y0 - lr.y0], [30, -15], "label can be dragged");
});

test("event log and timing signals", () => {
  const d = SL.exampleDoc(), id = (k, n) => d.comps.find((c) => c.kind === k && c.name === n).id;
  const s = new SL.Sim(d), s1 = id("PushNO", "-S1");
  s.tick(d, 0.1); s.setActuator(d, s1, true); s.tick(d, 0.1); s.setActuator(d, s1, false); s.tick(d, 0.1);
  const txt = s.log.map((e) => e.text);
  eq(txt.includes("-S1 premut") && txt.includes("-S1 deixat anar"), true, "button logged");
  eq(txt.some((t) => /^-KM1 s'excita/.test(t)), true, "coil logged");
  eq(txt.some((t) => /^-M1 arrenca/.test(t)), true, "motor logged");
  eq(s.sig[id("Coil", "-KM1")].changes.map((c) => c[1]), [0, 1], "timing chart transitions");
});

if (failed) { console.log(failed + " failed"); process.exit(1); }
console.log("all passed");
