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

test("file format matches the Mac app", () => {
  const d = SL.normalizeDoc(JSON.parse(JSON.stringify(SL.exampleDoc())));
  eq(d.format, "ElectroCADSim-1");
  eq(d.comps[0].kind, "FeedL123");
});

if (failed) { console.log(failed + " failed"); process.exit(1); }
console.log("all passed");
