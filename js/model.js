// SimuLAB — document model. Same JSON format as the Mac app (.ecs files).
// Coordinates in "units": 5 units per mm, grid of 15 units (MECHANICS.md).
"use strict";
var SL = (typeof globalThis !== "undefined" ? globalThis : window).SL || {};
(typeof globalThis !== "undefined" ? globalThis : window).SL = SL;

SL.GRID = 15;

SL.POT = { L1: 1, L2: 2, L3: 4, N: 8, PE: 16, POS: 32, NEG: 64 };

SL.CATS = [
  { id: "Feeds", label: "Alimentacions", bar: "Barra d'alimentacions", icon: "FeedL" },
  { id: "Fuses", label: "Fusibles, Seccionadors", bar: "Barra de fusibles...", icon: "Fuse1" },
  { id: "Breakers", label: "Automàtics, Disjuntors", bar: "Barra d'automàtics...", icon: "Auto1" },
  { id: "Contactors", label: "Contactors, Interruptors", bar: "Barra de contactors", icon: "Contactor3" },
  { id: "Motors", label: "Motors", bar: "Barra de motors", icon: "Motor3" },
  { id: "Power", label: "Potència", bar: "Barra de potència", icon: "Resistor1" },
  { id: "AuxContacts", label: "Contactes auxiliars, Contactes temporitzats", bar: "Barra de contactes", icon: "AuxNO" },
  { id: "Actuators", label: "Accionaments", bar: "Barra d'accionaments", icon: "PushNO" },
  { id: "Detectors", label: "Detectors", bar: "Barra de detectors", icon: "DetIndNO" },
  { id: "Coils", label: "Bobines, Senyalitzacions", bar: "Barra de bobines", icon: "Coil" },
  { id: "ElecRelays", label: "Relés electrònics", bar: "Barra de relés electrònics", icon: "SsrDC" },
  { id: "Logic", label: "Lògica", bar: "Barra de lògica", icon: "LogicAnd" },
  { id: "Connections", label: "Cables i Connexions", bar: "Barra de connexions", icon: "Terminal" },
];

(function () {
  var P = SL.POT;
  // id, category, label, role, poles, normally closed, name prefix
  var rows = [
    ["FeedL", "Feeds", "Fase", "Feed"],
    ["FeedN", "Feeds", "Neutre", "Feed"],
    ["FeedPE", "Feeds", "Protecció", "Feed"],
    ["FeedLN", "Feeds", "F + N", "Feed"],
    ["FeedLNPE", "Feeds", "F + N + PE", "Feed"],
    ["FeedL123", "Feeds", "L1 + L2 + L3", "Feed"],
    ["FeedL123PE", "Feeds", "L1 + L2 + L3 + PE", "Feed"],
    ["FeedL123N", "Feeds", "L1 + L2 + L3 + N", "Feed"],
    ["FeedL123NPE", "Feeds", "L1 + L2 + L3 + N + PE", "Feed"],
    ["FeedPos", "Feeds", "Alimentació +", "Feed"],
    ["FeedNeg", "Feeds", "Alimentació -", "Feed"],
    ["FeedPosNeg", "Feeds", "Alimentació + -", "Feed"],
    ["Ground", "Feeds", "Protecció (terra)", "Feed"],
    ["Transformer1", "Feeds", "Transformador", "Converter", 0, false, "-T"],
    ["Transformer3", "Feeds", "Transformador III", "Converter", 0, false, "-T"],
    ["Diode", "Feeds", "Díode", "Converter", 0, false, "-V"],
    ["Rectifier", "Feeds", "Rectificador", "Converter", 0, false, "-G"],
    ["PowerSupply1", "Feeds", "Font d'alimentació", "Converter", 0, false, "-G"],
    ["PowerSupply3", "Feeds", "Font d'alimentació III", "Converter", 0, false, "-G"],
    ["Battery", "Feeds", "Bateria", "Feed", 0, false, "-G"],
    ["Socket", "Feeds", "Presa de corrent", "Load", 0, false, "-X"],
    ["Fuse1", "Fuses", "Fusible I", "Passive", 1, false, "-F"],
    ["Fuse1N", "Fuses", "Fusible IN", "Passive", 2, false, "-F"],
    ["Fuse2", "Fuses", "Fusible II", "Passive", 2, false, "-F"],
    ["Fuse3", "Fuses", "Fusible III", "Passive", 3, false, "-F"],
    ["Fuse3N", "Fuses", "Fusible IIIN", "Passive", 4, false, "-F"],
    ["FuseSw1", "Fuses", "Fusible seccionable I", "Manual", 1, false, "-F"],
    ["FuseSw1N", "Fuses", "Fusible seccionable IN", "Manual", 2, false, "-F"],
    ["FuseSw2", "Fuses", "Fusible seccionable II", "Manual", 2, false, "-F"],
    ["FuseSw3", "Fuses", "Fusible seccionable III", "Manual", 3, false, "-F"],
    ["FuseSw3N", "Fuses", "Fusible seccionable IIIN", "Manual", 4, false, "-F"],
    ["Auto1", "Breakers", "Automàtic I", "Manual", 1, false, "-Q"],
    ["Auto1N", "Breakers", "Automàtic IN", "Manual", 2, false, "-Q"],
    ["Auto2", "Breakers", "Automàtic II", "Manual", 2, false, "-Q"],
    ["Auto3", "Breakers", "Automàtic III", "Manual", 3, false, "-Q"],
    ["Auto3N", "Breakers", "Automàtic IIIN", "Manual", 4, false, "-Q"],
    ["Rcd1N", "Breakers", "Diferencial IN", "Manual", 2, false, "-Q"],
    ["Rcd3N", "Breakers", "Diferencial IIIN", "Manual", 4, false, "-Q"],
    ["ThermalRelay3", "Breakers", "Relé tèrmic", "Passive", 3, false, "-F"],
    ["Breaker1", "Breakers", "Disjuntor I", "Manual", 1, false, "-Q"],
    ["Breaker1N", "Breakers", "Disjuntor IN", "Manual", 2, false, "-Q"],
    ["Breaker2", "Breakers", "Disjuntor II", "Manual", 2, false, "-Q"],
    ["Breaker3", "Breakers", "Disjuntor III", "Manual", 3, false, "-Q"],
    ["Breaker3N", "Breakers", "Disjuntor IIIN", "Manual", 4, false, "-Q"],
    ["Surge1N", "Breakers", "Limitador sobretensions IN", "Load", 0, false, "-F"],
    ["Surge3N", "Breakers", "Limitador sobretensions IIIN", "Load", 0, false, "-F"],
    ["Contactor1", "Contactors", "Contactor I", "Poles", 1, false, "-KM"],
    ["Contactor2", "Contactors", "Contactor II", "Poles", 2, false, "-KM"],
    ["Contactor3", "Contactors", "Contactor III", "Poles", 3, false, "-KM"],
    ["Contactor4", "Contactors", "Contactor IIII", "Poles", 4, false, "-KM"],
    ["Contactor3Arc", "Contactors", "Contactor III", "Poles", 3, false, "-KM"],
    ["Switch1", "Contactors", "Interruptor I", "Manual", 1, false, "-Q"],
    ["Switch2", "Contactors", "Interruptor II", "Manual", 2, false, "-Q"],
    ["Switch3", "Contactors", "Interruptor III", "Manual", 3, false, "-Q"],
    ["Switch4", "Contactors", "Interruptor IIII", "Manual", 4, false, "-Q"],
    ["Interlock", "Contactors", "Enclavament", "Passive", 0, false, ""],
    ["Motor3", "Motors", "Motor trifàsic", "Load", 0, false, "-M"],
    ["Motor3YD", "Motors", "Motor trifàsic YD (estrella-triangle, 6 borns)", "Load", 0, false, "-M"],
    ["Motor1", "Motors", "Motor monofàsic", "Load", 0, false, "-M"],
    ["Resistor1", "Power", "Resistència I", "Passive", 1, false, "-R"],
    ["Resistor3", "Power", "Resistència III", "Passive", 3, false, "-R"],
    ["AutoTrans3", "Power", "Autotransformador III", "Passive", 3, false, "-T"],
    ["SoftStarter3", "Power", "Arrencador electrònic CA", "Poles", 3, false, "-G"],
    ["SoftCtrl", "Power", "Control arrencador electrònic CA", "Load", 0, false, "-G"],
    ["SoftRevCtrl", "Power", "Control inversor electrònic CA", "Load", 0, false, "-G"],
    ["VfdAC2", "Power", "Variador velocitat CA II", "Poles", 2, false, "-G"],
    ["VfdAC3", "Power", "Variador velocitat CA III", "Poles", 3, false, "-G"],
    ["VfdACCtrl", "Power", "Control variador velocitat CA", "Load", 0, false, "-G"],
    ["DriveDC2", "Power", "Variador velocitat CC II", "Poles", 2, false, "-G"],
    ["DriveDC2Shunt", "Power", "Variador velocitat CC II", "Poles", 2, false, "-G"],
    ["DriveDC3", "Power", "Variador velocitat CC III", "Poles", 3, false, "-G"],
    ["DriveDC3Shunt", "Power", "Variador velocitat CC III", "Poles", 3, false, "-G"],
    ["DriveDCCtrl", "Power", "Control variador velocitat CC", "Load", 0, false, "-G"],
    ["StepperCtrl4", "Power", "Controlador motor pas a pas", "Load", 0, false, "-G"],
    ["StepperCtrl2Clk", "Power", "Controlador motor pas a pas 2CLK", "Load", 0, false, "-G"],
    ["StepperCtrlClkDir", "Power", "Controlador motor pas a pas CLK/DIR", "Load", 0, false, "-G"],
    ["AuxNO", "AuxContacts", "Contacte NA", "Contact", 0, false, "-KM"],
    ["AuxNC", "AuxContacts", "Contacte NC", "Contact", 0, true, "-KM"],
    ["AuxNONC", "AuxContacts", "Contacte NA + NC", "Contact", 2, false, "-KM"],
    ["AuxCO", "AuxContacts", "Contacte CON", "Contact", 0, false, "-KM"],
    ["TimedOnNO", "AuxContacts", "Contacte connexió NA", "Contact", 0, false, "-KT"],
    ["TimedOnNC", "AuxContacts", "Contacte connexió NC", "Contact", 0, true, "-KT"],
    ["TimedOnNONC", "AuxContacts", "Contacte connexió NA + NC", "Contact", 2, false, "-KT"],
    ["TimedOnCO", "AuxContacts", "Contacte connexió CON", "Contact", 0, false, "-KT"],
    ["TimedOffNO", "AuxContacts", "Contacte desconnexió NA", "Contact", 0, false, "-KT"],
    ["TimedOffNC", "AuxContacts", "Contacte desconnexió NC", "Contact", 0, true, "-KT"],
    ["TimedOffNONC", "AuxContacts", "Contacte desconnexió NA + NC", "Contact", 2, false, "-KT"],
    ["TimedOffCO", "AuxContacts", "Contacte desconnexió CON", "Contact", 0, false, "-KT"],
    ["TimedOnOffNO", "AuxContacts", "Contacte connexió desconnexió NA", "Contact", 0, false, "-KT"],
    ["TimedOnOffNC", "AuxContacts", "Contacte connexió desconnexió NC", "Contact", 0, true, "-KT"],
    ["TimedOnOffNONC", "AuxContacts", "Contacte connexió desconnexió NA + NC", "Contact", 2, false, "-KT"],
    ["TimedOnOffCO", "AuxContacts", "Contacte connexió desconnexió CON", "Contact", 0, false, "-KT"],
    ["PushBtn", "Actuators", "Botó polsador", "Actuator", 0, false, "-S"],
    ["PushNO", "Actuators", "Polsador NA", "Actuator", 0, false, "-S"],
    ["PushNC", "Actuators", "Polsador NC", "Actuator", 0, true, "-S"],
    ["PushNONC", "Actuators", "Polsador NA + NC", "Actuator", 2, false, "-S"],
    ["PushCO", "Actuators", "Polsador COM", "Actuator", 0, false, "-S"],
    ["MushroomNO", "Actuators", "Polsador bolet NA", "Actuator", 0, false, "-S"],
    ["MushroomNC", "Actuators", "Polsador bolet NC", "Actuator", 0, true, "-S"],
    ["MushroomNONC", "Actuators", "Polsador bolet NA + NC", "Actuator", 2, false, "-S"],
    ["MushroomCO", "Actuators", "Polsador bolet COM", "Actuator", 0, false, "-S"],
    ["SwitchNO", "Actuators", "Interruptor NA", "Actuator", 0, false, "-S"],
    ["SwitchNC", "Actuators", "Interruptor NC", "Actuator", 0, true, "-S"],
    ["SwitchNONC", "Actuators", "Interruptor NA + NC", "Actuator", 2, false, "-S"],
    ["SwitchCO", "Actuators", "Interruptor COM", "Actuator", 0, false, "-S"],
    ["Sel102", "Actuators", "Commutador I-0-II", "Actuator", 0, false, "-S"],
    ["Sel123", "Actuators", "Commutador I-II-III", "Actuator", 0, false, "-S"],
    ["CrossSw", "Actuators", "Commutador creuament", "Actuator", 0, false, "-S"],
    ["LimitNO", "Actuators", "Final de carrera NA", "Actuator", 0, false, "-B"],
    ["LimitNC", "Actuators", "Final de carrera NC", "Actuator", 0, true, "-B"],
    ["LimitNONC", "Actuators", "Final de carrera NA + NC", "Actuator", 2, false, "-B"],
    ["LimitCO", "Actuators", "Final de carrera COM", "Actuator", 0, false, "-B"],
    ["ThermalNO", "Actuators", "Tèrmic NA", "Contact", 0, false, "-F"],
    ["ThermalNC", "Actuators", "Tèrmic NC", "Contact", 0, true, "-F"],
    ["ThermalNONC", "Actuators", "Tèrmic NA + NC", "Contact", 2, false, "-F"],
    ["ThermalCO", "Actuators", "Tèrmic COM", "Contact", 0, false, "-F"],
    ["DetIndNO", "Detectors", "Detector inductiu NA", "Actuator", 0, false, "-B"],
    ["DetIndNC", "Detectors", "Detector inductiu NC", "Actuator", 0, true, "-B"],
    ["DetCapNO", "Detectors", "Detector capacitiu NA", "Actuator", 0, false, "-B"],
    ["DetCapNC", "Detectors", "Detector capacitiu NC", "Actuator", 0, true, "-B"],
    ["DetMagNO", "Detectors", "Detector magnètic NA", "Actuator", 0, false, "-B"],
    ["DetMagNC", "Detectors", "Detector magnètic NC", "Actuator", 0, true, "-B"],
    ["PhotoBarrier", "Detectors", "Barrera fotoelèctrica", "Actuator", 0, false, "-B"],
    ["PhotoEmit", "Detectors", "Barrera emissor", "Load", 0, false, "-B"],
    ["PhotoRecNO", "Detectors", "Barrera receptor NA", "Actuator", 0, false, "-B"],
    ["PhotoRecNC", "Detectors", "Barrera receptor NC", "Actuator", 0, true, "-B"],
    ["PressNO", "Detectors", "Presostat NA", "Actuator", 0, false, "-B"],
    ["PressNC", "Detectors", "Presostat NC", "Actuator", 0, true, "-B"],
    ["VacNO", "Detectors", "Vacuostat NA", "Actuator", 0, false, "-B"],
    ["VacNC", "Detectors", "Vacuostat NC", "Actuator", 0, true, "-B"],
    ["ThermoNO", "Detectors", "Termostat NA", "Actuator", 0, false, "-B"],
    ["ThermoNC", "Detectors", "Termostat NC", "Actuator", 0, true, "-B"],
    ["Coil", "Coils", "Bobina", "Load", 0, false, "-KM"],
    ["LatchCoil", "Coils", "Bobina biestable", "Load", 0, false, "-KA"],
    ["StepRelay", "Coils", "Telerruptor", "Load", 0, false, "-KA"],
    ["Solenoid", "Coils", "Bobina electrovàlvula", "Load", 0, false, "-YV"],
    ["TimerOn", "Coils", "Temporització connexió", "Load", 0, false, "-KT"],
    ["TimerOff", "Coils", "Temporització desconnexió", "Load", 0, false, "-KT"],
    ["TimerOnOff", "Coils", "Temporització connexió desconnexió", "Load", 0, false, "-KT"],
    ["Flasher", "Coils", "Relè intermitent", "Load", 0, false, "-KT"],
    ["PulseGen", "Coils", "Generador de polsos", "Load", 0, false, "-KT"],
    ["TimeSwitch", "Coils", "Interruptor horari", "Load", 0, false, "-KT"],
    ["Counter", "Coils", "Comptador de polsos", "Load", 0, false, "-KC"],
    ["Lamp", "Coils", "Pilot senyalització", "Load", 0, false, "-H"],
    ["LampFlash", "Coils", "Pilot intermitent", "Load", 0, false, "-H"],
    ["Bell", "Coils", "Timbre", "Load", 0, false, "-H"],
    ["Buzzer", "Coils", "Brunzidor", "Load", 0, false, "-H"],
    ["Siren", "Coils", "Sirena", "Load", 0, false, "-H"],
    ["Horn", "Coils", "Botzina", "Load", 0, false, "-H"],
    ["SsrDC", "ElecRelays", "Relè estat sòlid SSR DC", "Load", 0, false, "-K"],
    ["SsrAC", "ElecRelays", "Relè estat sòlid SSR AC", "Load", 0, false, "-K"],
    ["SsrCont3", "ElecRelays", "Contactor d'estat sòlid", "Poles", 3, false, "-KM"],
    ["SsrContRev3", "ElecRelays", "Contactor inversor d'estat sòlid", "Poles", 3, false, "-KM"],
    ["PhaseLossN", "ElecRelays", "Relè de falta de fase + N", "Load", 0, false, "-KF"],
    ["PhaseLoss", "ElecRelays", "Relè de falta de fase", "Load", 0, false, "-KF"],
    ["PhaseSeqN", "ElecRelays", "Relè de seqüència de fase + N", "Load", 0, false, "-KF"],
    ["PhaseSeq", "ElecRelays", "Relè de seqüència de fase", "Load", 0, false, "-KF"],
    ["PermOvervolt1N", "ElecRelays", "Protecció contra sobretensions permanents IN", "Manual", 2, false, "-Q"],
    ["PermOvervolt3N", "ElecRelays", "Protecció contra sobretensions permanents III", "Manual", 4, false, "-Q"],
    ["CoilContactNO", "ElecRelays", "Bobina contacte NA", "Load", 0, false, "-KA"],
    ["CoilContactCO", "ElecRelays", "Bobina contacte NC COM", "Load", 0, false, "-KA"],
    ["LogicAnd", "Logic", "AND", "Logic", 0, false, ""],
    ["LogicOr", "Logic", "OR", "Logic", 0, false, ""],
    ["LogicNot", "Logic", "NOT", "Logic", 0, false, ""],
    ["LogicXor", "Logic", "XOR", "Logic", 0, false, ""],
    ["LogicNand", "Logic", "NAND", "Logic", 0, false, ""],
    ["LogicNor", "Logic", "NOR", "Logic", 0, false, ""],
    ["LogicSR", "Logic", "Biestable SR", "Logic", 0, false, "-KA"],
    ["LogicDiv2", "Logic", "Divisor binari", "Logic", 0, false, "-KA"],
    ["LogicTon", "Logic", "Temporitzador connexió", "Logic", 0, false, "-KT"],
    ["LogicTp", "Logic", "Temporitzador pols connexió", "Logic", 0, false, "-KT"],
    ["LogicTof", "Logic", "Temporitzador desconnexió", "Logic", 0, false, "-KT"],
    ["LogicFlash", "Logic", "Temporitzador intermitent", "Logic", 0, false, "-KT"],
    ["LogicPulse", "Logic", "Temporitzador generador de polsos", "Logic", 0, false, "-KT"],
    ["LogicCnt", "Logic", "Comptador", "Logic", 0, false, "-KC"],
    ["LogicCntUD", "Logic", "Comptador ascendent - descendent", "Logic", 0, false, "-KC"],
    ["LogicCnt4", "Logic", "Comptador 4 bits", "Logic", 0, false, "-KC"],
    ["LogicCnt4UD", "Logic", "Comptador 4 bits asc - desc", "Logic", 0, false, "-KC"],
    ["LogicCnt10", "Logic", "Comptador 4 bits dècades", "Logic", 0, false, "-KC"],
    ["LogicProbe", "Logic", "Prova", "Logic", 0, false, "-S"],
    ["LogicView", "Logic", "Visualitza", "Logic", 0, false, "-P"],
    ["Logic7Dec", "Logic", "Decodificador 7 segments", "Logic", 0, false, "-U"],
    ["Logic7Seg", "Logic", "Display de 7 segments", "Logic", 0, false, "-P"],
    ["Logic7SegDp", "Logic", "Display de 7 segments amb punt decimal", "Logic", 0, false, "-P"],
    ["LogicPreset", "Logic", "Preselector", "Logic", 0, false, "-S"],
    ["LogicWire", "Logic", "Cable positiu", "Tool", 0, false, "", "wire"],
    ["LogicJunction", "Logic", "Connexió", "Tool", 0, false, "", "junction"],
    ["Wire", "Connections", "Cable", "Tool", 0, false, "", "wire"],
    ["Junction", "Connections", "Punt de connexió", "Tool", 0, false, "", "junction"],
    ["Terminal", "Connections", "Born", "Passive", 0, false, "-X"],
  ];
  var feeds = {
    FeedL: [[P.L1, "L"]],
    FeedN: [[P.N, "N"]],
    FeedPE: [[P.PE, "PE"]],
    FeedLN: [[P.L1, "L"], [P.N, "N"]],
    FeedLNPE: [[P.L1, "L"], [P.N, "N"], [P.PE, "PE"]],
    FeedL123: [[P.L1, "L1"], [P.L2, "L2"], [P.L3, "L3"]],
    FeedL123PE: [[P.L1, "L1"], [P.L2, "L2"], [P.L3, "L3"], [P.PE, "PE"]],
    FeedL123N: [[P.L1, "L1"], [P.L2, "L2"], [P.L3, "L3"], [P.N, "N"]],
    FeedL123NPE: [[P.L1, "L1"], [P.L2, "L2"], [P.L3, "L3"], [P.N, "N"], [P.PE, "PE"]],
    FeedPos: [[P.POS, "+"]],
    FeedNeg: [[P.NEG, "-"]],
    FeedPosNeg: [[P.POS, "+"], [P.NEG, "-"]],
    Ground: [[P.PE, "PE"]],
    Battery: [[P.POS, "+"], [P.NEG, "-"]],
  };
  SL.KINDS = {};
  SL.KIND_LIST = [];
  rows.forEach(function (r) {
    var k = {
      id: r[0], cat: r[1], label: r[2], role: r[3],
      poles: r[4] || 0, nc: !!r[5], prefix: r[6] || "",
      tool: r[7] || null,
      feed: feeds[r[0]] || [],
    };
    k.timer = ["TimerOn", "TimerOff", "TimerOnOff", "Flasher", "PulseGen", "TimeSwitch",
      "LogicTon", "LogicTp", "LogicTof", "LogicFlash", "LogicPulse"].indexOf(k.id) >= 0;
    k.counter = ["Counter", "LogicCnt", "LogicCntUD"].indexOf(k.id) >= 0; // has a count preset
    k.driver = ["Coil", "LatchCoil", "StepRelay", "Solenoid", "TimerOn", "TimerOff", "TimerOnOff", "Flasher",
      "PulseGen", "TimeSwitch", "Counter", "ThermalRelay3",
      "SoftCtrl", "SoftRevCtrl", "VfdACCtrl", "DriveDCCtrl",
      "SsrDC", "SsrAC", "PhaseLossN", "PhaseLoss", "PhaseSeqN", "PhaseSeq",
      "CoilContactNO", "CoilContactCO"].indexOf(k.id) >= 0 || k.role === "Actuator";
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
    comps: [], wires: [], junctions: [], no_junctions: [], drawings: [], texts: [],
    page: { size: "A4Horizontal", border: true, references: true, title_block: true, show_terminals: true },
    title: { drawn: "", checked: "", date: "", entity: "", title: "", number: "" },
    next_id: 1,
  };
};

SL.normalizeDoc = function (d) {
  var n = SL.newDoc();
  d = d || {};
  n.comps = (d.comps || []).filter(function (c) { return SL.KINDS[c.kind] && !SL.KINDS[c.kind].tool; }).map(function (c) {
    return {
      id: c.id, kind: c.kind, x: c.x | 0, y: c.y | 0, rot: c.rot | 0, mirror: !!c.mirror,
      name: c.name || "", func: c.func || "",
      time_base: c.time_base == null ? 5 : +c.time_base,
      time_mult: c.time_mult == null ? 1 : +c.time_mult,
      color: c.color || "Verde",
      closed: !!c.closed, // breaker position, kept with the schematic
      count_preset: c.count_preset == null ? 3 : Math.max(1, +c.count_preset | 0), // pulse counter
      off_base: c.off_base == null ? 5 : +c.off_base, // time switch: OFF time (same multiplier)
      value: Math.max(0, Math.min(9, +c.value | 0)), // logic preselector digit
    };
  });
  n.wires = (d.wires || []).map(function (w) { return { id: w.id, a: [w.a[0], w.a[1]], b: [w.b[0], w.b[1]] }; });
  n.junctions = (d.junctions || []).map(function (p) { return [p[0] | 0, p[1] | 0]; });
  n.no_junctions = (d.no_junctions || []).map(function (p) { return [p[0] | 0, p[1] | 0]; });
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
/** Time switch OFF time: off_base with the same multiplier as the ON time. */
SL.offSecs = function (c) {
  var b = c.off_base == null ? 5 : c.off_base;
  return Math.trunc(Math.max(0, b)) * SL.ticksPerUnit(c.time_mult) * SL.TICK_SECS;
};

SL.snap = function (v) { return Math.round(v / SL.GRID) * SL.GRID; };

SL.wireInterior = function (w, p) {
  var a = w.a, b = w.b;
  if ((p[0] === a[0] && p[1] === a[1]) || (p[0] === b[0] && p[1] === b[1])) return false;
  if (a[0] === b[0] && p[0] === a[0]) return p[1] > Math.min(a[1], b[1]) && p[1] < Math.max(a[1], b[1]);
  if (a[1] === b[1] && p[1] === a[1]) return p[0] > Math.min(a[0], b[0]) && p[0] < Math.max(a[0], b[0]);
  return false;
};

SL.hasJunction = function (doc, p) {
  return (doc.junctions || []).some(function (j) { return j[0] === p[0] && j[1] === p[1]; });
};

SL.hasNoJunction = function (doc, p) {
  return (doc.no_junctions || []).some(function (j) { return j[0] === p[0] && j[1] === p[1]; });
};

SL.wireDirsAt = function (doc, p) {
  var x = p[0], y = p[1], l = false, r = false, u = false, d = false;
  (doc.wires || []).forEach(function (w) {
    var x0 = Math.min(w.a[0], w.b[0]), x1 = Math.max(w.a[0], w.b[0]);
    var y0 = Math.min(w.a[1], w.b[1]), y1 = Math.max(w.a[1], w.b[1]);
    if (w.a[1] === w.b[1] && w.a[1] === y && x >= x0 && x <= x1) {
      if (x > x0) l = true;
      if (x < x1) r = true;
    } else if (w.a[0] === w.b[0] && w.a[0] === x && y >= y0 && y <= y1) {
      if (y > y0) u = true;
      if (y < y1) d = true;
    }
  });
  var count = (l ? 1 : 0) + (r ? 1 : 0) + (u ? 1 : 0) + (d ? 1 : 0);
  return {
    l: l, r: r, u: u, d: d,
    count: count,
    h: l || r,
    v: u || d,
    cross: l && r && u && d,
    tee: count === 3,
  };
};

SL.isConnectedJunction = function (doc, p) {
  var dirs = SL.wireDirsAt(doc, p);
  if (dirs.cross) return SL.hasJunction(doc, p);
  if (dirs.tee) return !SL.hasNoJunction(doc, p);
  return false;
};

SL.junctionPoints = function (doc) {
  var seen = {}, pts = [];
  function consider(p) {
    var k = p[0] + "," + p[1];
    if (seen[k]) return;
    seen[k] = true;
    if (SL.isConnectedJunction(doc, p)) pts.push([p[0], p[1]]);
  }
  (doc.wires || []).forEach(function (w) { consider(w.a); consider(w.b); });
  (doc.junctions || []).forEach(consider);
  var hs = [], vs = [];
  (doc.wires || []).forEach(function (w) {
    if (w.a[1] === w.b[1]) hs.push(w);
    else if (w.a[0] === w.b[0]) vs.push(w);
  });
  hs.forEach(function (h) {
    var hx0 = Math.min(h.a[0], h.b[0]), hx1 = Math.max(h.a[0], h.b[0]), hy = h.a[1];
    vs.forEach(function (v) {
      var vy0 = Math.min(v.a[1], v.b[1]), vy1 = Math.max(v.a[1], v.b[1]), vx = v.a[0];
      if (vx >= hx0 && vx <= hx1 && hy >= vy0 && hy <= vy1) consider([vx, hy]);
    });
  });
  return pts;
};

SL.toggleJunction = function (doc, p) {
  if (!doc.junctions) doc.junctions = [];
  if (!doc.no_junctions) doc.no_junctions = [];
  var sw = [SL.snap(p[0]), SL.snap(p[1])];
  var dirs = SL.wireDirsAt(doc, sw);
  if (!(dirs.h && dirs.v)) {
    // Search nearest crossing/T-junction within 1 grid unit
    var best = null, bestD = SL.GRID + 1;
    var hs = [], vs = [];
    (doc.wires || []).forEach(function (w) {
      if (w.a[1] === w.b[1]) hs.push(w);
      else if (w.a[0] === w.b[0]) vs.push(w);
    });
    hs.forEach(function (h) {
      var hx0 = Math.min(h.a[0], h.b[0]), hx1 = Math.max(h.a[0], h.b[0]), hy = h.a[1];
      vs.forEach(function (v) {
        var vy0 = Math.min(v.a[1], v.b[1]), vy1 = Math.max(v.a[1], v.b[1]), vx = v.a[0];
        if (vx >= hx0 && vx <= hx1 && hy >= vy0 && hy <= vy1) {
          var dist = Math.hypot(vx - p[0], hy - p[1]);
          if (dist < bestD) { bestD = dist; best = [vx, hy]; }
        }
      });
    });
    if (!best) return { changed: false };
    sw = best;
    dirs = SL.wireDirsAt(doc, sw);
  }
  if (!dirs.cross && !dirs.tee) return { changed: false };
  var connected = SL.isConnectedJunction(doc, sw);
  doc.junctions = doc.junctions.filter(function (j) { return j[0] !== sw[0] || j[1] !== sw[1]; });
  doc.no_junctions = doc.no_junctions.filter(function (j) { return j[0] !== sw[0] || j[1] !== sw[1]; });
  if (connected) {
    if (dirs.tee) doc.no_junctions.push([sw[0], sw[1]]);
    return { changed: true, connected: false, pt: sw };
  } else {
    if (dirs.cross) doc.junctions.push([sw[0], sw[1]]);
    return { changed: true, connected: true, pt: sw };
  }
};

SL.cleanJunctions = function (doc) {
  if (doc.junctions) {
    doc.junctions = doc.junctions.filter(function (p) {
      var dirs = SL.wireDirsAt(doc, p);
      return dirs.cross || dirs.tee;
    });
  }
  if (doc.no_junctions) {
    doc.no_junctions = doc.no_junctions.filter(function (p) {
      var dirs = SL.wireDirsAt(doc, p);
      return dirs.tee;
    });
  }
};

function pushWireRaw(doc, a, b) {
  if (a[0] === b[0] && a[1] === b[1]) return;
  for (var i = 0; i < doc.wires.length; i++) {
    var w = doc.wires[i];
    if ((w.a[0] === a[0] && w.a[1] === a[1] && w.b[0] === b[0] && w.b[1] === b[1]) ||
        (w.a[0] === b[0] && w.a[1] === b[1] && w.b[0] === a[0] && w.b[1] === a[1])) return;
  }
  doc.wires.push({ id: SL.newId(doc), a: [a[0], a[1]], b: [b[0], b[1]] });
}

function preserveJunctions(doc, prevConnected) {
  if (!doc.junctions) doc.junctions = [];
  prevConnected.forEach(function (p) {
    if (!SL.isConnectedJunction(doc, p) && !SL.hasJunction(doc, p)) {
      doc.junctions.push([p[0], p[1]]);
    }
  });
}

SL.addWire = function (doc, a, b) {
  if (a[0] === b[0] && a[1] === b[1]) return;
  var prevConnected = SL.junctionPoints(doc);
  pushWireRaw(doc, a, b);
  preserveJunctions(doc, prevConnected);
};

SL.chooseRouteMid = function (doc, a, b) {
  if (a[0] === b[0] || a[1] === b[1]) return a;
  var m1 = [b[0], a[1]], m2 = [a[0], b[1]];
  function pointHitsWireOrTerm(p) {
    var onW = (doc.wires || []).some(function (w) {
      return (w.a[0] === p[0] && w.a[1] === p[1]) || (w.b[0] === p[0] && w.b[1] === p[1]) || SL.wireInterior(w, p);
    });
    if (onW) return true;
    return (doc.comps || []).some(function (c) {
      return SL.terminals(c).some(function (t) { return t[0] === p[0] && t[1] === p[1]; });
    });
  }
  if (pointHitsWireOrTerm(m1) && !pointHitsWireOrTerm(m2)) return m2;
  return m1;
};

/** Orthogonal route: straight, or an L (horizontal first unless blocked). */
SL.addRoute = function (doc, a, b) {
  var prevConnected = SL.junctionPoints(doc);
  if (a[0] === b[0] || a[1] === b[1]) pushWireRaw(doc, a, b);
  else {
    var m = SL.chooseRouteMid(doc, a, b);
    pushWireRaw(doc, a, m);
    pushWireRaw(doc, m, b);
  }
  preserveJunctions(doc, prevConnected);
};

/**
 * Find a valid orthogonal (90° turns only) route between pA and pB on the 15-unit grid.
 * opts: { dirA, dirB, wires, comps }
 * Returns array of points [p0, p1, ..., pk] or null if impossible.
 */
SL.routeOrthogonal = function (doc, pA, pB, opts) {
  opts = opts || {};
  if (pA[0] === pB[0] && pA[1] === pB[1]) return null;
  var ps = (SL.PAGE_SIZES && doc.page && SL.PAGE_SIZES[doc.page.size]) || { w: 1485, h: 1050 };
  var minX = 0, minY = 0, maxX = ps.w, maxY = ps.h;
  if (pA[0] < minX || pA[0] > maxX || pA[1] < minY || pA[1] > maxY) return null;
  if (pB[0] < minX || pB[0] > maxX || pB[1] < minY || pB[1] > maxY) return null;

  var comps = opts.comps || doc.comps || [];
  var wires = opts.wires || doc.wires || [];
  var dirA = opts.dirA || null;
  var dirB = opts.dirB || null;
  var allowTouchA = !!opts.allowTouchA;
  var allowTouchB = !!opts.allowTouchB;

  var obstacles = comps.map(function (c) { return SL.compObstacleRect(c); });
  var otherTerms = {};
  comps.forEach(function (c) {
    SL.terminals(c).forEach(function (t) {
      if ((t[0] === pA[0] && t[1] === pA[1]) || (t[0] === pB[0] && t[1] === pB[1])) return;
      otherTerms[t[0] + "," + t[1]] = t;
    });
  });
  var otherTermList = Object.keys(otherTerms).map(function (k) { return otherTerms[k]; });

  // Neither endpoint may lie inside a component body obstacle or on another terminal
  for (var oi = 0; oi < obstacles.length; oi++) {
    var ob = obstacles[oi];
    if (pA[0] >= ob.x0 && pA[0] <= ob.x1 && pA[1] >= ob.y0 && pA[1] <= ob.y1) return null;
    if (pB[0] >= ob.x0 && pB[0] <= ob.x1 && pB[1] >= ob.y0 && pB[1] <= ob.y1) return null;
  }

  function isEndA(p) { return p[0] === pA[0] && p[1] === pA[1]; }
  function isEndB(p) { return p[0] === pB[0] && p[1] === pB[1]; }
  function isAllowedWireTouch(p) {
    return (allowTouchA && isEndA(p)) || (allowTouchB && isEndB(p));
  }

  function segValid(a, b) {
    if (a[0] !== b[0] && a[1] !== b[1]) return null; // must be orthogonal
    if (a[0] === b[0] && a[1] === b[1]) return null;
    var horiz = a[1] === b[1];
    var x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]);
    var y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    if (x0 < minX || x1 > maxX || y0 < minY || y1 > maxY) return null;

    var i, r, t, w, wx0, wx1, wy0, wy1, crossings = 0;
    for (i = 0; i < obstacles.length; i++) {
      r = obstacles[i];
      if (horiz) {
        if (a[1] >= r.y0 && a[1] <= r.y1 && x1 >= r.x0 && x0 <= r.x1) return null;
      } else {
        if (a[0] >= r.x0 && a[0] <= r.x1 && y1 >= r.y0 && y0 <= r.y1) return null;
      }
    }
    for (i = 0; i < otherTermList.length; i++) {
      t = otherTermList[i];
      if (horiz) {
        if (t[1] === a[1] && t[0] >= x0 && t[0] <= x1) return null;
      } else {
        if (t[0] === a[0] && t[1] >= y0 && t[1] <= y1) return null;
      }
    }
    for (i = 0; i < wires.length; i++) {
      w = wires[i];
      wx0 = Math.min(w.a[0], w.b[0]); wx1 = Math.max(w.a[0], w.b[0]);
      wy0 = Math.min(w.a[1], w.b[1]); wy1 = Math.max(w.a[1], w.b[1]);
      var wHoriz = w.a[1] === w.b[1];
      if (horiz && wHoriz) {
        if (a[1] === w.a[1]) {
          var ox0 = Math.max(x0, wx0), ox1 = Math.min(x1, wx1);
          if (ox0 < ox1) return null; // collinear overlap
          if (ox0 === ox1 && !isAllowedWireTouch([ox0, a[1]])) return null;
        }
      } else if (!horiz && !wHoriz) {
        if (a[0] === w.a[0]) {
          var oy0 = Math.max(y0, wy0), oy1 = Math.min(y1, wy1);
          if (oy0 < oy1) return null; // collinear overlap
          if (oy0 === oy1 && !isAllowedWireTouch([a[0], oy0])) return null;
        }
      } else {
        var ix = horiz ? w.a[0] : a[0];
        var iy = horiz ? a[1] : w.a[1];
        var onSeg = horiz ? (ix >= x0 && ix <= x1) : (iy >= y0 && iy <= y1);
        var onW = wHoriz ? (ix >= wx0 && ix <= wx1) : (iy >= wy0 && iy <= wy1);
        if (onSeg && onW) {
          var ip = [ix, iy];
          if (isAllowedWireTouch(ip)) continue;
          var segInterior = horiz ? (ix > x0 && ix < x1) : (iy > y0 && iy < y1);
          var wInterior = wHoriz ? (ix > wx0 && ix < wx1) : (iy > wy0 && iy < wy1);
          if (!segInterior || !wInterior) return null; // corner or T-touch on existing wire
          if (SL.hasJunction(doc, ip)) return null;
          crossings++;
        }
      }
    }
    return { len: (x1 - x0) + (y1 - y0), crossings: crossings };
  }

  function simplify(pts) {
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (out.length && out[out.length - 1][0] === p[0] && out[out.length - 1][1] === p[1]) continue;
      if (out.length >= 2) {
        var p1 = out[out.length - 2], p2 = out[out.length - 1];
        if ((p1[0] === p2[0] && p2[0] === p[0]) || (p1[1] === p2[1] && p2[1] === p[1])) {
          // Ensure no 180-degree foldback
          out[out.length - 1] = p;
          continue;
        }
      }
      out.push(p);
    }
    return out;
  }

  var MAX_TURNS = 4;

  function evalRoute(rawPts, symPenalty) {
    var pts = simplify(rawPts);
    var nSegs = pts.length - 1;
    if (nSegs < 1 || nSegs - 1 > MAX_TURNS) return null;
    var uA = [Math.sign(pts[1][0] - pts[0][0]), Math.sign(pts[1][1] - pts[0][1])];
    var uB = [Math.sign(pts[nSegs - 1][0] - pts[nSegs][0]), Math.sign(pts[nSegs - 1][1] - pts[nSegs][1])];
    if (dirA && uA[0] === -dirA[0] && uA[1] === -dirA[1]) return null;
    if (dirB && uB[0] === -dirB[0] && uB[1] === -dirB[1]) return null;

    var totalLen = 0, totalCross = 0, i, j;
    for (i = 0; i < nSegs; i++) {
      // Reject 180-degree reversals after simplify
      if (i > 0) {
        var dPrev = [Math.sign(pts[i][0] - pts[i - 1][0]), Math.sign(pts[i][1] - pts[i - 1][1])];
        var dCur = [Math.sign(pts[i + 1][0] - pts[i][0]), Math.sign(pts[i + 1][1] - pts[i][1])];
        if (dPrev[0] === -dCur[0] && dPrev[1] === -dCur[1]) return null;
      }
      var sv = segValid(pts[i], pts[i + 1]);
      if (!sv) return null;
      totalLen += sv.len;
      totalCross += sv.crossings;
    }
    // Check non-adjacent segments don't touch/intersect each other
    for (i = 0; i < nSegs; i++) {
      for (j = i + 2; j < nSegs; j++) {
        var a1 = pts[i], a2 = pts[i + 1], b1 = pts[j], b2 = pts[j + 1];
        var ax0 = Math.min(a1[0], a2[0]), ax1 = Math.max(a1[0], a2[0]);
        var ay0 = Math.min(a1[1], a2[1]), ay1 = Math.max(a1[1], a2[1]);
        var bx0 = Math.min(b1[0], b2[0]), bx1 = Math.max(b1[0], b2[0]);
        var by0 = Math.min(b1[1], b2[1]), by1 = Math.max(b1[1], b2[1]);
        if (Math.max(ax0, bx0) <= Math.min(ax1, bx1) && Math.max(ay0, by0) <= Math.min(ay1, by1)) return null;
      }
    }
    var turns = nSegs - 1;
    var score = turns * 1000 + totalLen + totalCross * 300 + (symPenalty || 0);
    if (dirA && (uA[0] !== dirA[0] || uA[1] !== dirA[1])) score += 1200;
    if (dirB && (uB[0] !== dirB[0] || uB[1] !== dirB[1])) score += 1200;
    return { pts: pts, score: score };
  }

  var best = null;
  function tryCandidate(pts, symPenalty) {
    var r = evalRoute(pts, symPenalty);
    if (r && (!best || r.score < best.score)) best = r;
  }

  // 0 turns (straight)
  if (pA[0] === pB[0] || pA[1] === pB[1]) {
    tryCandidate([pA, pB], 0);
    if (best && best.score < 1000) return best.pts;
  }

  // 1 turn (L-shape)
  tryCandidate([pA, [pB[0], pA[1]], pB], 0);
  tryCandidate([pA, [pA[0], pB[1]], pB], 0);

  // Build sorted grid coordinates for Z / U routes
  var midY = SL.snap((pA[1] + pB[1]) / 2);
  var midX = SL.snap((pA[0] + pB[0]) / 2);
  var ys = [], xs = [], y, x;
  for (y = SL.snap(minY + SL.GRID); y <= maxY - SL.GRID; y += SL.GRID) ys.push(y);
  for (x = SL.snap(minX + SL.GRID); x <= maxX - SL.GRID; x += SL.GRID) xs.push(x);
  ys.sort(function (a, b) { return Math.abs(a - midY) - Math.abs(b - midY); });
  xs.sort(function (a, b) { return Math.abs(a - midX) - Math.abs(b - midX); });

  // 2 turns (V-H-V and H-V-H)
  for (var yi = 0; yi < ys.length; yi++) {
    y = ys[yi];
    tryCandidate([pA, [pA[0], y], [pB[0], y], pB], Math.abs(y - midY) * 0.1);
  }
  for (var xi = 0; xi < xs.length; xi++) {
    x = xs[xi];
    tryCandidate([pA, [x, pA[1]], [x, pB[1]], pB], Math.abs(x - midX) * 0.1);
  }
  if (best && best.score < 3200) return best.pts;

  // 3 and 4 turns: axial stubs from pA and/or pB connected via L or Z/U routes
  var stubs = [SL.GRID, SL.GRID * 2, SL.GRID * 3];
  var aStarts = [pA];
  var bEnds = [pB];
  if (dirA) stubs.forEach(function (s) { aStarts.push([pA[0] + dirA[0] * s, pA[1] + dirA[1] * s]); });
  if (dirB) stubs.forEach(function (s) { bEnds.push([pB[0] + dirB[0] * s, pB[1] + dirB[1] * s]); });

  for (var ai = 0; ai < aStarts.length; ai++) {
    for (var bi = 0; bi < bEnds.length; bi++) {
      if (ai === 0 && bi === 0) continue;
      var qA = aStarts[ai], qB = bEnds[bi];
      var pre = ai === 0 ? [pA] : [pA, qA];
      var post = bi === 0 ? [pB] : [qB, pB];
      tryCandidate(pre.concat([[qB[0], qA[1]]], post), 0);
      tryCandidate(pre.concat([[qA[0], qB[1]]], post), 0);
      for (yi = 0; yi < Math.min(ys.length, 30); yi++) {
        y = ys[yi];
        tryCandidate(pre.concat([[qA[0], y], [qB[0], y]], post), Math.abs(y - midY) * 0.1);
      }
      for (xi = 0; xi < Math.min(xs.length, 30); xi++) {
        x = xs[xi];
        tryCandidate(pre.concat([[x, qA[1]], [x, qB[1]]], post), Math.abs(x - midX) * 0.1);
      }
    }
  }

  return best ? best.pts : null;
};

/**
 * Move selected items in doc by (dx, dy), redrawing orthogonal connections (90° turns only)
 * for any connected element that moves. If a connection cannot be remade, its wire is removed
 * and { disconnected: true, names: [...] } is returned.
 */
SL.moveItems = function (doc, selSet, dx, dy) {
  if (!dx && !dy) return { disconnected: false, names: [] };
  var movedComps = doc.comps.filter(function (c) { return selSet.has(c.id); });

  if (!movedComps.length) {
    // Only wires, texts, or drawings selected
    doc.wires.forEach(function (w) {
      if (selSet.has(w.id)) {
        w.a = [w.a[0] + dx, w.a[1] + dy];
        w.b = [w.b[0] + dx, w.b[1] + dy];
      }
    });
    doc.texts.forEach(function (x) { if (selSet.has(x.id)) { x.x += dx; x.y += dy; } });
    doc.drawings.forEach(function (x) {
      if (selSet.has(x.id)) {
        x.a = [x.a[0] + dx, x.a[1] + dy];
        x.b = [x.b[0] + dx, x.b[1] + dy];
      }
    });
    doc.wires = doc.wires.filter(function (w) { return w.a[0] !== w.b[0] || w.a[1] !== w.b[1]; });
    SL.cleanJunctions(doc);
    return { disconnected: false, names: [] };
  }

  return transformItems(doc, selSet, movedComps, {
    shiftPt: function (p) { return [p[0] + dx, p[1] + dy]; },
    applyTransform: function () {
      doc.comps.forEach(function (c) { if (selSet.has(c.id)) { c.x += dx; c.y += dy; } });
      doc.texts.forEach(function (x) { if (selSet.has(x.id)) { x.x += dx; x.y += dy; } });
      doc.drawings.forEach(function (x) {
        if (selSet.has(x.id)) {
          x.a = [x.a[0] + dx, x.a[1] + dy];
          x.b = [x.b[0] + dx, x.b[1] + dy];
        }
      });
    },
  });
};

/**
 * Rotate or mirror selected components in doc, redrawing orthogonal connections (90° turns only)
 * for any connected element that transforms. If a connection cannot be remade, its wire is removed
 * and { disconnected: true, names: [...] } is returned.
 */
SL.rotateItems = function (doc, selSet, delta, mirror) {
  var normDelta = (((delta || 0) % 4) + 4) % 4;
  if (!mirror && normDelta === 0) return { disconnected: false, names: [] };
  var movedComps = doc.comps.filter(function (c) { return selSet.has(c.id); });
  if (!movedComps.length) return { disconnected: false, names: [] };

  return transformItems(doc, selSet, movedComps, {
    shiftPt: null,
    applyTransform: function () {
      movedComps.forEach(function (c) {
        if (mirror) c.mirror = !c.mirror;
        else c.rot = (((c.rot || 0) + normDelta) % 4 + 4) % 4;
      });
    },
  });
};

function transformItems(doc, selSet, movedComps, opts) {
  var key = function (p) { return p[0] + "," + p[1]; };
  var shiftPt = opts.shiftPt;

  // Record old terminal positions before transforming components
  var oldMovedTerms = [];
  var movedTermMap = {}, statTermMap = {};
  doc.comps.forEach(function (c) {
    var tds = SL.terminalsWithDir(c);
    if (selSet.has(c.id)) {
      oldMovedTerms.push({ comp: c, tds: tds });
      tds.forEach(function (td) {
        movedTermMap[key(td.pos)] = {
          oldPos: td.pos,
          newPos: shiftPt ? shiftPt(td.pos) : td.pos,
          dir: td.dir,
          comp: c,
        };
      });
    } else {
      tds.forEach(function (td) {
        statTermMap[key(td.pos)] = {
          pos: td.pos,
          dir: td.dir,
          comp: c,
        };
      });
    }
  });

  // Split wires at T-junctions, active junctions, and component terminals so chains are explicit
  var splitPts = [];
  var splitSeen = {};
  function addSplitPt(p) {
    var k = key(p);
    if (!splitSeen[k]) { splitSeen[k] = true; splitPts.push([p[0], p[1]]); }
  }
  Object.keys(movedTermMap).forEach(function (k) { addSplitPt(movedTermMap[k].oldPos); });
  Object.keys(statTermMap).forEach(function (k) { addSplitPt(statTermMap[k].pos); });
  var preMoveConnected = SL.junctionPoints(doc);
  preMoveConnected.forEach(addSplitPt);

  var segments = [];
  (doc.wires || []).forEach(function (w) {
    var a = w.a, b = w.b;
    if (a[0] === b[0] && a[1] === b[1]) return;
    if (a[0] !== b[0] && a[1] !== b[1]) {
      segments.push({ a: [a[0], a[1]], b: [b[0], b[1]] });
      return;
    }
    var horiz = a[1] === b[1];
    var cuts = [a, b];
    splitPts.forEach(function (p) {
      if (SL.wireInterior(w, p)) cuts.push([p[0], p[1]]);
    });
    cuts.sort(function (p1, p2) { return horiz ? p1[0] - p2[0] : p1[1] - p2[1]; });
    for (var i = 0; i < cuts.length - 1; i++) {
      if (cuts[i][0] !== cuts[i + 1][0] || cuts[i][1] !== cuts[i + 1][1]) {
        segments.push({ a: cuts[i], b: cuts[i + 1] });
      }
    }
  });

  // Merge collinear contiguous segments when their shared vertex is just a pass-through
  var merged = true;
  while (merged) {
    merged = false;
    var degCount = {};
    segments.forEach(function (s) {
      var ka = key(s.a), kb = key(s.b);
      degCount[ka] = (degCount[ka] || 0) + 1;
      degCount[kb] = (degCount[kb] || 0) + 1;
    });
    for (var i = 0; i < segments.length && !merged; i++) {
      for (var j = i + 1; j < segments.length && !merged; j++) {
        var s1 = segments[i], s2 = segments[j];
        var h1 = s1.a[1] === s1.b[1], h2 = s2.a[1] === s2.b[1];
        if (h1 !== h2) continue;
        var shared = null, o1 = null, o2 = null;
        if (key(s1.a) === key(s2.a)) { shared = s1.a; o1 = s1.b; o2 = s2.b; }
        else if (key(s1.a) === key(s2.b)) { shared = s1.a; o1 = s1.b; o2 = s2.a; }
        else if (key(s1.b) === key(s2.a)) { shared = s1.b; o1 = s1.a; o2 = s2.b; }
        else if (key(s1.b) === key(s2.b)) { shared = s1.b; o1 = s1.a; o2 = s2.a; }
        if (!shared) continue;
        var ks = key(shared);
        if (movedTermMap[ks] || statTermMap[ks] || SL.hasJunction(doc, shared)) continue;
        // Do not merge if a perpendicular segment ends at shared (T-junction)
        var perpEndsAtShared = segments.some(function (s3, idx) {
          if (idx === i || idx === j) return false;
          return key(s3.a) === ks || key(s3.b) === ks;
        });
        if (perpEndsAtShared) continue;
        segments[i] = { a: o1, b: o2 };
        segments.splice(j, 1);
        merged = true;
      }
    }
  }

  // Build adjacency graph of segments
  var adj = {}, ptByKey = {};
  function addNode(p) {
    var k = key(p);
    if (!adj[k]) { adj[k] = []; ptByKey[k] = [p[0], p[1]]; }
    return k;
  }
  segments.forEach(function (s, idx) {
    var ka = addNode(s.a), kb = addNode(s.b);
    adj[ka].push({ to: kb, edge: idx });
    adj[kb].push({ to: ka, edge: idx });
  });

  function isAnchor(k) {
    if (movedTermMap[k] || statTermMap[k]) return true;
    var deg = adj[k] ? adj[k].length : 0;
    return deg !== 2 || SL.hasJunction(doc, ptByKey[k]);
  }

  // Decompose into maximal chains between anchor vertices
  var visitedEdge = {}, chains = [];
  Object.keys(adj).forEach(function (k) {
    if (!isAnchor(k)) return;
    adj[k].forEach(function (step) {
      if (visitedEdge[step.edge]) return;
      var pts = [ptByKey[k]], cur = k, nxt = step;
      while (nxt) {
        visitedEdge[nxt.edge] = true;
        cur = nxt.to;
        pts.push(ptByKey[cur]);
        if (isAnchor(cur)) break;
        var nextSteps = adj[cur].filter(function (x) { return !visitedEdge[x.edge]; });
        nxt = nextSteps.length ? nextSteps[0] : null;
      }
      chains.push({ u: k, v: cur, pts: pts });
    });
  });

  // Determine which non-terminal anchors move (connected components of chains that only touch moved terminals)
  var compAdj = {};
  chains.forEach(function (ch) {
    if (!compAdj[ch.u]) compAdj[ch.u] = [];
    if (!compAdj[ch.v]) compAdj[ch.v] = [];
    compAdj[ch.u].push(ch.v);
    compAdj[ch.v].push(ch.u);
  });
  var anchorMoves = {};
  var seenAnchor = {};
  Object.keys(adj).forEach(function (startK) {
    if (!isAnchor(startK) || seenAnchor[startK]) return;
    var q = [startK], group = [], hasMoved = false, hasStat = false;
    seenAnchor[startK] = true;
    while (q.length) {
      var cur = q.shift();
      group.push(cur);
      if (movedTermMap[cur] && !statTermMap[cur]) hasMoved = true;
      if (statTermMap[cur]) hasStat = true;
      (compAdj[cur] || []).forEach(function (nb) {
        if (!seenAnchor[nb]) { seenAnchor[nb] = true; q.push(nb); }
      });
    }
    group.forEach(function (ak) {
      if (statTermMap[ak]) anchorMoves[ak] = false;
      else if (movedTermMap[ak]) anchorMoves[ak] = true;
      else anchorMoves[ak] = shiftPt ? (hasMoved && !hasStat) : false;
    });
  });

  // Transform selected components (and texts/drawings if moving)
  opts.applyTransform();
  if (!shiftPt) {
    oldMovedTerms.forEach(function (entry) {
      var newTds = SL.terminalsWithDir(entry.comp);
      entry.tds.forEach(function (oldTd, idx) {
        var mt = movedTermMap[key(oldTd.pos)];
        if (mt && newTds[idx]) {
          mt.newPos = newTds[idx].pos;
          mt.dir = newTds[idx].dir;
        }
      });
    });
  }

  // Check if any moved component collides with another component or is out of page bounds
  var ps = (SL.PAGE_SIZES && doc.page && SL.PAGE_SIZES[doc.page.size]) || { w: 1485, h: 1050 };
  var margin = (doc.page && doc.page.border) ? 25 : 0;
  var invalidMovedComp = {};
  movedComps.forEach(function (mc) {
    var mr = SL.compRect(mc);
    if (mr.x0 < margin || mr.y0 < margin || mr.x1 > ps.w - margin || mr.y1 > ps.h - margin) {
      invalidMovedComp[mc.id] = true;
    }
    var mob = SL.compObstacleRect(mc);
    var mTerms = SL.terminals(mc);
    doc.comps.forEach(function (oc) {
      if (oc.id === mc.id) return;
      // a translated group keeps its internal layout: only check against what stays still
      if (shiftPt && selSet.has(oc.id)) return;
      var oob = SL.compObstacleRect(oc);
      if (mob.x0 <= oob.x1 && mob.x1 >= oob.x0 && mob.y0 <= oob.y1 && mob.y1 >= oob.y0) {
        invalidMovedComp[mc.id] = true;
      }
      var oTerms = SL.terminals(oc);
      mTerms.forEach(function (mt) {
        if (mt[0] >= oob.x0 && mt[0] <= oob.x1 && mt[1] >= oob.y0 && mt[1] <= oob.y1) invalidMovedComp[mc.id] = true;
        oTerms.forEach(function (ot) {
          if (mt[0] === ot[0] && mt[1] === ot[1]) invalidMovedComp[mc.id] = true;
        });
      });
    });
  });

  var staticWires = [];
  var bothMovedChains = [];
  var rerouteChains = [];

  chains.forEach(function (ch) {
    var uMoves = !!anchorMoves[ch.u];
    var vMoves = !!anchorMoves[ch.v];
    if (!uMoves && !vMoves) {
      for (var i = 0; i < ch.pts.length - 1; i++) {
        staticWires.push({ a: ch.pts[i], b: ch.pts[i + 1] });
      }
    } else if (uMoves && vMoves) {
      bothMovedChains.push(ch);
    } else {
      rerouteChains.push(ch);
    }
  });

  var disconnected = false;
  var disconnectedNames = [];
  function recordDisconnect(comp) {
    disconnected = true;
    if (comp && comp.name && disconnectedNames.indexOf(comp.name) < 0) {
      disconnectedNames.push(comp.name);
    }
  }

  // Handle chains where both endpoints move together
  bothMovedChains.forEach(function (ch) {
    if (shiftPt) {
      // both ends travel with the selection: the conductor is translated as it is
      var moved = ch.pts.map(shiftPt);
      for (var m = 0; m < moved.length - 1; m++) staticWires.push({ a: moved[m], b: moved[m + 1] });
      return;
    }
    var uTerm = movedTermMap[ch.u], vTerm = movedTermMap[ch.v];
    var uComp = uTerm && uTerm.comp, vComp = vTerm && vTerm.comp;
    if ((uComp && invalidMovedComp[uComp.id]) || (vComp && invalidMovedComp[vComp.id])) {
      recordDisconnect(uComp || vComp);
      return;
    }
    var shiftedPts = shiftPt ? ch.pts.map(shiftPt) : null;
    var pA = uTerm ? uTerm.newPos : shiftedPts[0];
    var pB = vTerm ? vTerm.newPos : shiftedPts[shiftedPts.length - 1];
    var routed = SL.routeOrthogonal(doc, pA, pB, {
      dirA: uTerm ? uTerm.dir : null,
      dirB: vTerm ? vTerm.dir : null,
      wires: staticWires,
      comps: doc.comps,
    });
    if (!routed) {
      recordDisconnect(uComp || vComp);
      return;
    }
    var usePts = routed;
    if (shiftedPts) {
      // Keep shiftedPts if all segments are orthogonal and valid, else use routed
      var okShift = true;
      for (var i = 0; i < shiftedPts.length - 1; i++) {
        var a = shiftedPts[i], b = shiftedPts[i + 1];
        if (a[0] !== b[0] && a[1] !== b[1]) { okShift = false; break; }
        var segCheck = SL.routeOrthogonal(doc, a, b, { wires: staticWires, comps: doc.comps });
        if (!segCheck || segCheck.length !== 2) { okShift = false; break; }
      }
      if (okShift) usePts = shiftedPts;
    }
    for (var k = 0; k < usePts.length - 1; k++) {
      staticWires.push({ a: usePts[k], b: usePts[k + 1] });
    }
  });

  // Handle chains with one stationary endpoint and one moved endpoint
  function tryOrder(order) {
    var tempWires = staticWires.slice();
    var disc = 0, discComps = [], totalLen = 0;
    order.forEach(function (ch) {
      var uMoved = !!anchorMoves[ch.u];
      var mKey = uMoved ? ch.u : ch.v;
      var sKey = uMoved ? ch.v : ch.u;
      var mTerm = movedTermMap[mKey];
      var sTerm = statTermMap[sKey];
      var mComp = mTerm ? mTerm.comp : null;
      var pStat = ptByKey[sKey];
      var pMoved = mTerm ? mTerm.newPos : (shiftPt ? shiftPt(ptByKey[mKey]) : ptByKey[mKey]);
      if (mComp && invalidMovedComp[mComp.id]) {
        disc++;
        discComps.push(mComp);
        return;
      }
      var sIsWireAnchor = !sTerm && adj[sKey] && adj[sKey].length >= 2;
      var pts = SL.routeOrthogonal(doc, pStat, pMoved, {
        dirA: sTerm ? sTerm.dir : null,
        dirB: mTerm ? mTerm.dir : null,
        allowTouchA: sIsWireAnchor,
        allowTouchB: false,
        wires: tempWires,
        comps: doc.comps,
      });
      if (!pts) {
        disc++;
        discComps.push(mComp);
      } else {
        for (var i = 0; i < pts.length - 1; i++) {
          tempWires.push({ a: pts[i], b: pts[i + 1] });
          totalLen += Math.abs(pts[i + 1][0] - pts[i][0]) + Math.abs(pts[i + 1][1] - pts[i][1]);
        }
      }
    });
    return { wires: tempWires, disc: disc, discComps: discComps, totalLen: totalLen };
  }

  if (rerouteChains.length) {
    var forwardRes = tryOrder(rerouteChains);
    var bestRes = forwardRes;
    if (rerouteChains.length > 1) {
      var revRes = tryOrder(rerouteChains.slice().reverse());
      if (revRes.disc < bestRes.disc || (revRes.disc === bestRes.disc && revRes.totalLen < bestRes.totalLen)) {
        bestRes = revRes;
      }
    }
    staticWires = bestRes.wires;
    bestRes.discComps.forEach(recordDisconnect);
  }

  // Rebuild doc.wires from staticWires
  doc.wires = [];
  staticWires.forEach(function (w) { pushWireRaw(doc, w.a, w.b); });
  var postMoveConnected = preMoveConnected.map(function (p) {
    return (shiftPt && anchorMoves[key(p)]) ? shiftPt(p) : [p[0], p[1]];
  });
  preserveJunctions(doc, postMoveConnected);
  SL.cleanJunctions(doc);

  return { disconnected: disconnected, names: disconnectedNames };
}

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

/**
 * Two elements of the same type cannot share a name: contacts are compared by
 * their exact kind (an NO and an NC of -KM1 can coexist), everything else by
 * role and name prefix (any contactor, any pilot light...).
 */
SL.sameNameType = function (kindA, kindB) {
  var a = SL.KINDS[kindA], b = SL.KINDS[kindB];
  if (a.role === "Contact" || b.role === "Contact") return kindA === kindB;
  return a.role === b.role && a.prefix === b.prefix;
};

/** `name`, or the next free number (-KM2 -> -KM3) if an element of the same type already uses it. */
SL.uniqueName = function (doc, kind, name) {
  if (!name) return name;
  var m = /^(.*?)(\d+)$/.exec(name), base = m ? m[1] : name, n = m ? +m[2] : 1, cand = name;
  var used = function (nm) {
    return doc.comps.some(function (c) { return c.name === nm && SL.sameNameType(kind, c.kind); });
  };
  while (used(cand)) cand = base + (++n);
  return cand;
};

SL.makeComp = function (doc, kind, x, y, rot, name, extra) {
  var c = {
    id: SL.newId(doc), kind: kind, x: x, y: y, rot: rot || 0, mirror: false,
    name: name || "", func: "", time_base: 5, time_mult: 1, color: "Verde", closed: false,
    count_preset: 3, off_base: 5, value: 0,
  };
  if (extra) Object.assign(c, extra);
  doc.comps.push(c);
  return c;
};
