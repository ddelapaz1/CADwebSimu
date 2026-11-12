// Run with: node web/test/sim.test.js  (from app/)
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ["model.js", "symbols.js", "sim.js", "examples.js"]) {
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
  eq(connItems, ["Wire", "Junction", "Terminal"]);
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

test("all registered symbols in SL.KIND_LIST build valid geometry", () => {
  SL.KIND_LIST.forEach((k) => {
    const sym = SL.buildSymbol(k.id, {});
    eq(sym.prims.length > 0, true, "symbol has prims: " + k.id);
    const symOn = SL.buildSymbol(k.id, { closed: true, active: true, motor: 1 });
    eq(symOn.prims.length > 0, true, "active symbol has prims: " + k.id);
  });
});

if (failed) { console.log(failed + " failed"); process.exit(1); }
console.log("all passed");
