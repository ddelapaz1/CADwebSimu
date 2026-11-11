// SimuLAB — document model. Same JSON format as the Mac app (.ecs files).
// Coordinates in "units": 5 units per mm, grid of 15 units (MECHANICS.md).
"use strict";
var SL = (typeof globalThis !== "undefined" ? globalThis : window).SL || {};
(typeof globalThis !== "undefined" ? globalThis : window).SL = SL;

SL.GRID = 15;

SL.POT = { L1: 1, L2: 2, L3: 4, N: 8, PE: 16, POS: 32, NEG: 64 };

SL.CATS = [
  { id: "Feeds", label: "Alimentacions", bar: "Barra d'alimentacions", icon: "FeedL" },
  { id: "Fuses", label: "Fusibles, Seccionadors", bar: "Barra de fusibles", icon: "Fuse1" },
  { id: "Breakers", label: "Automàtics, Relés tèrmics", bar: "Barra d'automàtics", icon: "Breaker1" },
  { id: "Contactors", label: "Contactors, Interruptors", bar: "Barra de contactors", icon: "Contactor3" },
  { id: "Motors", label: "Motors", bar: "Barra de motors", icon: "Motor3" },
  { id: "AuxContacts", label: "Contactes auxiliars, Contactes temporitzats", bar: "Barra de contactes", icon: "AuxNO" },
  { id: "Actuators", label: "Accionaments", bar: "Barra d'accionaments", icon: "PushNO" },
  { id: "Coils", label: "Bobines, Senyalitzacions", bar: "Barra de bobines", icon: "Coil" },
  { id: "Connections", label: "Cables i Connexions", bar: "Barra de connexions", icon: "Terminal" },
];

(function () {
  var P = SL.POT;
  // id, category, label, role, poles, normally closed, name prefix
  var rows = [
    ["FeedL", "Feeds", "Alimentació Fase", "Feed"],
    ["FeedN", "Feeds", "Alimentació Neutre", "Feed"],
    ["FeedPE", "Feeds", "Alimentació Protecció", "Feed"],
    ["FeedLN", "Feeds", "Alimentació Fase + Neutre", "Feed"],
    ["FeedLNPE", "Feeds", "Alimentació Fase + Neutre + Protecció", "Feed"],
    ["FeedL123", "Feeds", "Alimentació L1 + L2 + L3", "Feed"],
    ["FeedL123N", "Feeds", "Alimentació L1 + L2 + L3 + N", "Feed"],
    ["FeedL123NPE", "Feeds", "Alimentació L1 + L2 + L3 + N + PE", "Feed"],
    ["FeedPos", "Feeds", "Alimentació Positiu", "Feed"],
    ["FeedNeg", "Feeds", "Alimentació Negatiu", "Feed"],
    ["FeedPosNeg", "Feeds", "Alimentació +-", "Feed"],
    ["Fuse1", "Fuses", "Fusible I", "Passive", 1, false, "-F"],
    ["Fuse2", "Fuses", "Fusible II", "Passive", 2, false, "-F"],
    ["Fuse3", "Fuses", "Fusible III", "Passive", 3, false, "-F"],
    ["Breaker1", "Breakers", "Disjuntor I (magnetotèrmic)", "Manual", 1, false, "-Q"],
    ["Breaker2", "Breakers", "Disjuntor II (magnetotèrmic)", "Manual", 2, false, "-Q"],
    ["Breaker3", "Breakers", "Disjuntor III (magnetotèrmic)", "Manual", 3, false, "-Q"],
    ["ThermalRelay3", "Breakers", "Relé tèrmic", "Passive", 3, false, "-F"],
    ["Contactor1", "Contactors", "Contactor I", "Poles", 1, false, "-KM"],
    ["Contactor2", "Contactors", "Contactor II", "Poles", 2, false, "-KM"],
    ["Contactor3", "Contactors", "Contactor III", "Poles", 3, false, "-KM"],
    ["Contactor4", "Contactors", "Contactor IIII", "Poles", 4, false, "-KM"],
    ["Switch2", "Contactors", "Interruptor II", "Manual", 2, false, "-Q"],
    ["Switch3", "Contactors", "Interruptor III", "Manual", 3, false, "-Q"],
    ["Motor3", "Motors", "Motor trifàsic", "Load", 0, false, "-M"],
    ["Motor3YD", "Motors", "Motor trifàsic YD (estrella-triangle, 6 borns)", "Load", 0, false, "-M"],
    ["Motor1", "Motors", "Motor monofàsic", "Load", 0, false, "-M"],
    ["AuxNO", "AuxContacts", "Contacte NO", "Contact", 0, false, "-KM"],
    ["AuxNC", "AuxContacts", "Contacte NC", "Contact", 0, true, "-KM"],
    ["TimedOnNO", "AuxContacts", "Contacte temporitzat a la connexió NO", "Contact", 0, false, "-KT"],
    ["TimedOnNC", "AuxContacts", "Contacte temporitzat a la connexió NC", "Contact", 0, true, "-KT"],
    ["TimedOffNO", "AuxContacts", "Contacte temporitzat a la desconnexió NO", "Contact", 0, false, "-KT"],
    ["TimedOffNC", "AuxContacts", "Contacte temporitzat a la desconnexió NC", "Contact", 0, true, "-KT"],
    ["PushNO", "Actuators", "Polsador NO", "Actuator", 0, false, "-S"],
    ["PushNC", "Actuators", "Polsador NC", "Actuator", 0, true, "-S"],
    ["MushroomNO", "Actuators", "Polsador bolet NO", "Actuator", 0, false, "-S"],
    ["MushroomNC", "Actuators", "Polsador bolet NC", "Actuator", 0, true, "-S"],
    ["SwitchNO", "Actuators", "Interruptor NO", "Actuator", 0, false, "-S"],
    ["SwitchNC", "Actuators", "Interruptor NC", "Actuator", 0, true, "-S"],
    ["LimitNO", "Actuators", "Final de cursa NO", "Actuator", 0, false, "-B"],
    ["LimitNC", "Actuators", "Final de cursa NC", "Actuator", 0, true, "-B"],
    ["ThermalNO", "Actuators", "Contacte auxiliar relé tèrmic NO", "Contact", 0, false, "-F"],
    ["ThermalNC", "Actuators", "Contacte auxiliar relé tèrmic NC", "Contact", 0, true, "-F"],
    ["Coil", "Coils", "Bobina contactor, relé", "Load", 0, false, "-KM"],
    ["TimerOn", "Coils", "Temporitzador a la connexió", "Load", 0, false, "-KT"],
    ["TimerOff", "Coils", "Temporitzador a la desconnexió", "Load", 0, false, "-KT"],
    ["TimerOnOff", "Coils", "Temporitzador a la connexió i desconnexió", "Load", 0, false, "-KT"],
    ["Flasher", "Coils", "Temporitzador intermitent", "Load", 0, false, "-KT"],
    ["StepRelay", "Coils", "Teleruptor", "Load", 0, false, "-KA"],
    ["Lamp", "Coils", "Làmpada (pilot)", "Load", 0, false, "-H"],
    ["Buzzer", "Coils", "Brunzidor", "Load", 0, false, "-H"],
    ["Horn", "Coils", "Botzina", "Load", 0, false, "-H"],
    ["Terminal", "Connections", "Born", "Passive", 0, false, "-X"],
  ];
  var feeds = {
    FeedL: [[P.L1, "L"]],
    FeedN: [[P.N, "N"]],
    FeedPE: [[P.PE, "PE"]],
    FeedLN: [[P.L1, "L"], [P.N, "N"]],
    FeedLNPE: [[P.L1, "L"], [P.N, "N"], [P.PE, "PE"]],
    FeedL123: [[P.L1, "L1"], [P.L2, "L2"], [P.L3, "L3"]],
    FeedL123N: [[P.L1, "L1"], [P.L2, "L2"], [P.L3, "L3"], [P.N, "N"]],
    FeedL123NPE: [[P.L1, "L1"], [P.L2, "L2"], [P.L3, "L3"], [P.N, "N"], [P.PE, "PE"]],
    FeedPos: [[P.POS, "+"]],
    FeedNeg: [[P.NEG, "-"]],
    FeedPosNeg: [[P.POS, "+"], [P.NEG, "-"]],
  };
  SL.KINDS = {};
  SL.KIND_LIST = [];
  rows.forEach(function (r) {
    var k = {
      id: r[0], cat: r[1], label: r[2], role: r[3],
      poles: r[4] || 0, nc: !!r[5], prefix: r[6] || "",
      feed: feeds[r[0]] || [],
    };
    k.timer = ["TimerOn", "TimerOff", "TimerOnOff", "Flasher"].indexOf(k.id) >= 0;
    k.driver = ["Coil", "TimerOn", "TimerOff", "TimerOnOff", "Flasher", "StepRelay", "ThermalRelay3"].indexOf(k.id) >= 0 || k.role === "Actuator";
    SL.KINDS[k.id] = k;
    SL.KIND_LIST.push(k);
  });
})();

SL.LAMP_COLORS = {
  Verde: [0, 200, 0], Rojo: [255, 0, 0], Azul: [60, 120, 255], Amarillo: [255, 230, 0], Gris: [192, 192, 192],
  Verd: [0, 200, 0], Vermell: [255, 0, 0], Blau: [60, 120, 255], Groc: [255, 230, 0],
};

SL.LAMP_COLOR_OPTIONS = [
  ["Verde", "Verd"], ["Rojo", "Vermell"], ["Azul", "Blau"], ["Amarillo", "Groc"], ["Gris", "Gris"],
];

SL.PAGE_SIZES = {
  A4Vertical: { label: "A4 Vertical", w: 1050, h: 1485 },
  A4Horizontal: { label: "A4 Horitzontal", w: 1485, h: 1050 },
  A3Format1: { label: "A3 Format 1", w: 2100, h: 1485 },
  A3Format2: { label: "A3 Format 2", w: 1485, h: 2100 },
};

SL.newDoc = function () {
  return {
    format: "ElectroCADSim-1",
    comps: [], wires: [], drawings: [], texts: [],
    page: { size: "A4Horizontal", border: true, references: true, title_block: true, show_terminals: true },
    title: { drawn: "", checked: "", date: "", entity: "", title: "", number: "" },
    next_id: 1,
  };
};

SL.normalizeDoc = function (d) {
  var n = SL.newDoc();
  d = d || {};
  n.comps = (d.comps || []).filter(function (c) { return SL.KINDS[c.kind]; }).map(function (c) {
    return {
      id: c.id, kind: c.kind, x: c.x | 0, y: c.y | 0, rot: c.rot | 0, mirror: !!c.mirror,
      name: c.name || "", func: c.func || "",
      time_base: c.time_base == null ? 5 : +c.time_base,
      time_mult: c.time_mult == null ? 1 : +c.time_mult,
      color: c.color || "Verde",
      closed: !!c.closed, // breaker position, kept with the schematic
    };
  });
  n.wires = (d.wires || []).map(function (w) { return { id: w.id, a: [w.a[0], w.a[1]], b: [w.b[0], w.b[1]] }; });
  n.drawings = d.drawings || [];
  n.texts = d.texts || [];
  if (d.page) Object.assign(n.page, d.page);
  if (d.title) Object.assign(n.title, d.title);
  var maxId = 0;
  [n.comps, n.wires, n.drawings, n.texts].forEach(function (l) { l.forEach(function (o) { maxId = Math.max(maxId, o.id || 0); }); });
  n.next_id = Math.max(d.next_id || 1, maxId + 1);
  return n;
};

SL.newId = function (doc) { return doc.next_id++; };

// Timer presets as the original computes them (sub_62de30 / sub_62f730 /
// sub_632c70): ticks = atoi(value) x 1 / 10 / 100 / 1000 for "x 0,1 Seg",
// "x 1 Seg", "x 10 Seg", "x 60 Seg"; one tick = 0.1 s.
SL.TICK_SECS = 0.1;
SL.ticksPerUnit = function (mult) { return mult < 0.5 ? 1 : mult < 5 ? 10 : mult < 30 ? 100 : 1000; };
SL.presetTicks = function (c) { return Math.trunc(Math.max(0, c.time_base)) * SL.ticksPerUnit(c.time_mult); };
SL.presetSecs = function (c) { return SL.presetTicks(c) * SL.TICK_SECS; };

SL.snap = function (v) { return Math.round(v / SL.GRID) * SL.GRID; };

SL.wireInterior = function (w, p) {
  var a = w.a, b = w.b;
  if ((p[0] === a[0] && p[1] === a[1]) || (p[0] === b[0] && p[1] === b[1])) return false;
  if (a[0] === b[0] && p[0] === a[0]) return p[1] > Math.min(a[1], b[1]) && p[1] < Math.max(a[1], b[1]);
  if (a[1] === b[1] && p[1] === a[1]) return p[0] > Math.min(a[0], b[0]) && p[0] < Math.max(a[0], b[0]);
  return false;
};

SL.addWire = function (doc, a, b) {
  if (a[0] === b[0] && a[1] === b[1]) return;
  for (var i = 0; i < doc.wires.length; i++) {
    var w = doc.wires[i];
    if ((w.a[0] === a[0] && w.a[1] === a[1] && w.b[0] === b[0] && w.b[1] === b[1]) ||
        (w.a[0] === b[0] && w.a[1] === b[1] && w.b[0] === a[0] && w.b[1] === a[1])) return;
  }
  doc.wires.push({ id: SL.newId(doc), a: [a[0], a[1]], b: [b[0], b[1]] });
};

/** Orthogonal route: straight, or an L (horizontal first). */
SL.addRoute = function (doc, a, b) {
  if (a[0] === b[0] || a[1] === b[1]) SL.addWire(doc, a, b);
  else { var m = [b[0], a[1]]; SL.addWire(doc, a, m); SL.addWire(doc, m, b); }
};

SL.nextName = function (doc, kind) {
  var p = SL.KINDS[kind].prefix;
  if (!p) return "";
  for (var n = 1; ; n++) {
    var cand = p + n;
    var used = doc.comps.some(function (c) {
      var k = SL.KINDS[c.kind];
      return c.name === cand && k.prefix === p && k.driver === SL.KINDS[kind].driver;
    });
    if (!used) return cand;
  }
};

SL.makeComp = function (doc, kind, x, y, rot, name, extra) {
  var c = {
    id: SL.newId(doc), kind: kind, x: x, y: y, rot: rot || 0, mirror: false,
    name: name || "", func: "", time_base: 5, time_mult: 1, color: "Verde", closed: false,
  };
  if (extra) Object.assign(c, extra);
  doc.comps.push(c);
  return c;
};
