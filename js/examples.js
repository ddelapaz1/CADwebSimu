// SimuLAB — example circuits (same as the Mac app's Ayuda menu).
"use strict";
(function (SL) {
  function add(d, kind, x, y, rot, name, base) {
    return SL.makeComp(d, kind, x, y, rot, name, { time_base: base || 5 });
  }

  /** Direct-on-line start of a three-phase motor. */
  SL.exampleDoc = function () {
    var d = SL.newDoc();
    add(d, "FeedL123", 150, 120, 0, "");
    add(d, "Breaker3", 150, 180, 0, "-Q1").closed = true; // example starts with Q1 on
    add(d, "Contactor3", 150, 300, 0, "-KM1");
    add(d, "ThermalRelay3", 150, 420, 0, "-F1");
    add(d, "Motor3", 150, 540, 0, "-M1");
    [150, 180, 210].forEach(function (x) {
      SL.addWire(d, [x, 150], [x, 180]);
      SL.addWire(d, [x, 240], [x, 300]);
      SL.addWire(d, [x, 360], [x, 420]);
      SL.addWire(d, [x, 480], [x, 540]);
    });
    add(d, "FeedL", 480, 120, 0, "");
    add(d, "Fuse1", 480, 180, 0, "-F2");
    add(d, "ThermalNC", 480, 270, 0, "-F1");
    add(d, "PushNC", 480, 360, 0, "-S0");
    add(d, "PushNO", 480, 450, 0, "-S1");
    add(d, "AuxNO", 570, 450, 0, "-KM1");
    add(d, "Coil", 480, 555, 0, "-KM1");
    add(d, "Lamp", 660, 555, 0, "-H1");
    add(d, "FeedN", 480, 720, 2, "");
    [[[480, 150], [480, 180]], [[480, 240], [480, 270]], [[480, 330], [480, 360]], [[480, 420], [480, 450]],
      [[480, 435], [570, 435]], [[570, 435], [570, 450]], [[480, 510], [480, 555]], [[570, 510], [570, 525]],
      [[570, 525], [480, 525]], [[570, 525], [660, 525]], [[660, 525], [660, 555]], [[480, 615], [480, 690]],
      [[660, 615], [660, 645]], [[660, 645], [480, 645]]].forEach(function (w) { SL.addWire(d, w[0], w[1]); });
    d.texts.push({ id: SL.newId(d), x: 120, y: 66, text: "Arrencada directa d'un motor trifàsic", size: 18, color: [0, 0, 0] });
    d.title.title = "Arrencada directa";
    d.title.number = "1";
    return d;
  };

  /** Star-delta start: KM1 line, KM2 star, KM3 delta, KT1 on-delay timer. */
  SL.exampleYdDoc = function () {
    var d = SL.newDoc();
    add(d, "FeedL123", 150, 120, 0, "");
    add(d, "Breaker3", 150, 180, 0, "-Q1").closed = true;
    add(d, "ThermalRelay3", 150, 270, 0, "-F1");
    add(d, "Contactor3", 150, 360, 0, "-KM1");
    add(d, "Motor3YD", 150, 480, 0, "-M1");
    add(d, "Contactor3", 150, 660, 0, "-KM2");
    add(d, "Contactor3", 300, 660, 0, "-KM3");
    [150, 180, 210].forEach(function (x) {
      SL.addWire(d, [x, 150], [x, 180]);
      SL.addWire(d, [x, 240], [x, 270]);
      SL.addWire(d, [x, 330], [x, 360]);
      SL.addWire(d, [x, 420], [x, 480]);
      SL.addWire(d, [x, 600], [x, 660]);
    });
    SL.addWire(d, [150, 720], [180, 720]);
    SL.addWire(d, [180, 720], [210, 720]);
    [[150, 630, 300], [180, 645, 330], [210, 615, 360]].forEach(function (r) {
      SL.addWire(d, [r[0], r[1]], [r[2], r[1]]);
      SL.addWire(d, [r[2], r[1]], [r[2], 660]);
    });
    [[300, 735, 420, 435, 150], [330, 750, 450, 450, 180], [360, 765, 480, 465, 210]].forEach(function (r) {
      SL.addWire(d, [r[0], 720], [r[0], r[1]]);
      SL.addWire(d, [r[0], r[1]], [r[2], r[1]]);
      SL.addWire(d, [r[2], r[1]], [r[2], r[3]]);
      SL.addWire(d, [r[2], r[3]], [r[4], r[3]]);
    });
    add(d, "FeedL", 600, 120, 0, "");
    add(d, "Fuse1", 600, 180, 0, "-F2");
    add(d, "ThermalNC", 600, 270, 0, "-F1");
    add(d, "PushNC", 600, 360, 0, "-S0");
    add(d, "PushNO", 600, 450, 0, "-S1");
    add(d, "AuxNO", 690, 450, 0, "-KM1");
    add(d, "Coil", 600, 600, 0, "-KM1");
    add(d, "TimerOn", 780, 600, 0, "-KT1", 3);
    add(d, "TimedOnNC", 900, 555, 0, "-KT1", 3);
    add(d, "AuxNC", 900, 630, 0, "-KM3");
    add(d, "Coil", 900, 705, 0, "-KM2");
    add(d, "TimedOnNO", 1050, 555, 0, "-KT1", 3);
    add(d, "AuxNC", 1050, 630, 0, "-KM2");
    add(d, "Coil", 1050, 705, 0, "-KM3");
    add(d, "FeedN", 600, 855, 2, "");
    [[[600, 150], [600, 180]], [[600, 240], [600, 270]], [[600, 330], [600, 360]], [[600, 420], [600, 450]],
      [[600, 435], [690, 435]], [[690, 435], [690, 450]], [[600, 510], [600, 540]], [[690, 510], [690, 525]],
      [[690, 525], [600, 525]], [[600, 540], [780, 540]], [[780, 540], [900, 540]], [[900, 540], [1050, 540]],
      [[600, 540], [600, 600]], [[780, 540], [780, 600]]].forEach(function (w) { SL.addWire(d, w[0], w[1]); });
    [900, 1050].forEach(function (x) {
      SL.addWire(d, [x, 540], [x, 555]);
      SL.addWire(d, [x, 615], [x, 630]);
      SL.addWire(d, [x, 690], [x, 705]);
      SL.addWire(d, [x, 765], [x, 795]);
    });
    [[[600, 660], [600, 795]], [[780, 660], [780, 795]], [[600, 795], [780, 795]], [[780, 795], [900, 795]],
      [[900, 795], [1050, 795]], [[600, 795], [600, 825]]].forEach(function (w) { SL.addWire(d, w[0], w[1]); });
    d.texts.push({ id: SL.newId(d), x: 120, y: 66, text: "Arrencada estrella-triangle", size: 18, color: [0, 0, 0] });
    d.title.title = "Arrencada estrella-triangle";
    d.title.number = "2";
    return d;
  };

  /** Reversing starter of a three-phase motor: KM1 forward, KM2 reverse (L1-L3 swapped). */
  SL.exampleRevDoc = function () {
    var d = SL.newDoc();
    // Power circuit
    add(d, "FeedL123", 150, 120, 0, "");
    add(d, "Breaker3", 150, 180, 0, "-Q1").closed = true;
    add(d, "Contactor3", 150, 315, 0, "-KM1");
    add(d, "Contactor3", 300, 315, 0, "-KM2");
    add(d, "ThermalRelay3", 150, 465, 0, "-F1");
    add(d, "Motor3", 150, 585, 0, "-M1");
    [150, 180, 210].forEach(function (x) {
      SL.addWire(d, [x, 150], [x, 180]);
      SL.addWire(d, [x, 240], [x, 315]);
      SL.addWire(d, [x, 375], [x, 465]);
      SL.addWire(d, [x, 525], [x, 585]);
    });
    // Top tap to KM2 (L1->1, L2->3, L3->5)
    [[150, 255, 300], [180, 270, 330], [210, 285, 360]].forEach(function (r) {
      SL.addWire(d, [r[0], r[1]], [r[2], r[1]]);
      SL.addWire(d, [r[2], r[1]], [r[2], 315]);
    });
    // Bottom return from KM2 with L1<->L3 swapped (KM2.2->L3(210), KM2.4->L2(180), KM2.6->L1(150))
    [[300, 435, 210], [330, 420, 180], [360, 405, 150]].forEach(function (r) {
      SL.addWire(d, [r[0], 375], [r[0], r[1]]);
      SL.addWire(d, [r[0], r[1]], [r[2], r[1]]);
    });

    // Control circuit
    add(d, "FeedL", 540, 120, 0, "");
    add(d, "Fuse1", 540, 180, 0, "-F2");
    add(d, "ThermalNC", 540, 270, 0, "-F1");
    add(d, "PushNC", 540, 360, 0, "-S0");

    // Forward branch (KM1)
    add(d, "PushNO", 540, 450, 0, "-S1");
    add(d, "AuxNO", 630, 450, 0, "-KM1");
    add(d, "AuxNC", 540, 540, 0, "-KM2");
    add(d, "Coil", 540, 630, 0, "-KM1");
    add(d, "Lamp", 630, 630, 0, "-H1");

    // Reverse branch (KM2)
    add(d, "PushNO", 750, 450, 0, "-S2");
    add(d, "AuxNO", 840, 450, 0, "-KM2");
    add(d, "AuxNC", 750, 540, 0, "-KM1");
    add(d, "Coil", 750, 630, 0, "-KM2");
    var h2 = add(d, "Lamp", 840, 630, 0, "-H2");
    h2.color = "Amarillo";

    add(d, "FeedN", 540, 765, 2, "");

    // Control wires
    [[[540, 150], [540, 180]], [[540, 240], [540, 270]], [[540, 330], [540, 360]],
      [[540, 420], [540, 450]], [[540, 435], [630, 435]], [[630, 435], [750, 435]], [[750, 435], [840, 435]],
      [[630, 435], [630, 450]], [[750, 435], [750, 450]], [[840, 435], [840, 450]],
      // Forward branch connections
      [[540, 510], [540, 540]], [[630, 510], [630, 525]], [[630, 525], [540, 525]],
      [[540, 600], [540, 630]], [[540, 615], [630, 615]], [[630, 615], [630, 630]],
      // Reverse branch connections
      [[750, 510], [750, 540]], [[840, 510], [840, 525]], [[840, 525], [750, 525]],
      [[750, 600], [750, 630]], [[750, 615], [840, 615]], [[840, 615], [840, 630]],
      // Neutral rail
      [[540, 690], [540, 720]], [[630, 690], [630, 720]], [[750, 690], [750, 720]], [[840, 690], [840, 720]],
      [[540, 720], [630, 720]], [[630, 720], [750, 720]], [[750, 720], [840, 720]],
      [[540, 720], [540, 735]]].forEach(function (w) { SL.addWire(d, w[0], w[1]); });

    d.texts.push({ id: SL.newId(d), x: 120, y: 66, text: "Inversió de gir d'un motor trifàsic", size: 18, color: [0, 0, 0] });
    d.title.title = "Inversió de gir";
    d.title.number = "3";
    return d;
  };

  /** Start/stop with latching programmed on a LOGO! (SR flip-flop): S1 -> I1, S0 (NC) -> I2, Q1 -> KM1. */
  SL.exampleLogoDoc = function () {
    var d = SL.newDoc(), W = function (a, b) { SL.addWire(d, a, b); };
    SL.makeComp(d, "FeedLN", 90, 60, 0, "");                 // L (90,90)  N (120,90)
    SL.makeComp(d, "Logo230", 300, 300, 0, "-A1");           // L1 300, N 330, I1 360, I2 390 (y 300); Q1 300/330 (y 450)
    add(d, "PushNO", 360, 180, 0, "-S1");                    // (360,180)-(360,240)
    add(d, "PushNC", 390, 180, 0, "-S0");                    // (390,180)-(390,240)
    add(d, "Coil", 330, 480, 0, "-KM1");                     // (330,480)-(330,540)
    // L: bus at y 150 to L1, S1, S0; down the left side to Q1 terminal 1
    W([90, 90], [90, 150]); W([90, 150], [390, 150]);
    W([300, 150], [300, 300]); W([360, 150], [360, 180]); W([390, 150], [390, 180]);
    W([360, 240], [360, 300]); W([390, 240], [390, 300]);
    W([90, 150], [90, 510]); W([90, 510], [300, 510]); W([300, 510], [300, 450]);
    W([330, 450], [330, 480]);
    // N: to the module and to the coil
    W([120, 90], [120, 120]); W([120, 120], [330, 120]); W([330, 120], [330, 300]);
    W([120, 120], [120, 570]); W([120, 570], [330, 570]); W([330, 570], [330, 540]);
    // program (function block diagram): I1 -> S, NOT I2 -> R, SR -> Q1
    SL.makeComp(d, "LogoI", 630, 300, 0, "I1");              // out (675,300)
    SL.makeComp(d, "LogoI", 630, 375, 0, "I2");              // out (675,375)
    SL.makeComp(d, "LogicNot", 705, 375, 0, "");             // in (705,375) out (765,375)
    SL.makeComp(d, "LogicSR", 810, 300, 0, "");              // S (810,300) R (810,330) Q (870,300)
    SL.makeComp(d, "LogoQ", 900, 300, 0, "Q1");              // in (900,300)
    W([675, 300], [810, 300]); W([675, 375], [705, 375]);
    W([765, 375], [780, 375]); W([780, 375], [780, 330]); W([780, 330], [810, 330]);
    W([870, 300], [900, 300]);
    d.texts.push({ id: SL.newId(d), x: 165, y: 66, text: "LOGO!: marxa i aturada amb autoretenció", size: 18, color: [0, 0, 0] });
    d.texts.push({ id: SL.newId(d), x: 630, y: 250, text: "Programa (diagrama de blocs)", size: 13, color: [0, 0, 160] });
    d.title.title = "Marxa-aturada amb LOGO!";
    d.title.number = "4";
    return d;
  };

  // ------------------------------------------------------------ traffic light
  /**
   * Traffic light on a LOGO! 230RCE: S1 start -> I1, S0 stop (NC) -> I2,
   * Q1 green H1, Q2 amber H2, Q3 red H3. Same wiring for both programs.
   */
  function trafficHardware(d) {
    var W = function (a, b) { SL.addWire(d, a, b); };
    SL.makeComp(d, "FeedLN", 90, 60, 0, "");                 // L (90,90)  N (120,90)
    SL.makeComp(d, "Logo230", 240, 300, 0, "-A1");           // L1 240, N 270, I1 300, I2 330; Q1 240/270, Q2 300/330, Q3 360/390
    add(d, "PushNO", 300, 180, 0, "-S1");
    add(d, "PushNC", 330, 180, 0, "-S0");
    [["-H1", "Verde", 270], ["-H2", "Amarillo", 330], ["-H3", "Rojo", 390]].forEach(function (h) {
      add(d, "Lamp", h[2], 510, 0, h[0]).color = h[1];
      W([h[2], 450], [h[2], 510]);                           // Qn.2 -> lamp
      W([h[2], 570], [h[2], 600]);                           // lamp -> N
    });
    // L: inputs, module supply and the bridged commons of Q1..Q3
    W([90, 90], [90, 150]); W([90, 150], [330, 150]);
    W([240, 150], [240, 300]); W([300, 150], [300, 180]); W([330, 150], [330, 180]);
    W([300, 240], [300, 300]); W([330, 240], [330, 300]);
    [240, 300, 360].forEach(function (x) { W([x, 450], [x, 480]); });
    W([90, 150], [90, 480]); W([90, 480], [360, 480]);
    // N
    W([120, 90], [120, 120]); W([120, 120], [270, 120]); W([270, 120], [270, 300]);
    W([120, 120], [120, 600]); W([120, 600], [390, 600]);
  }

  /** Program helpers: blocks joined by wires or by named markers (like LOGO! flags). */
  function prog(d) {
    var P;
    P = {
      W: function () { for (var i = 1; i < arguments.length; i++) SL.addWire(d, arguments[i - 1], arguments[i]); },
      blk: function (kind, x, y, name, extra) { return SL.makeComp(d, kind, x, y, 0, name || "", extra); },
      /** Marker `name` at p: it points left (an input that reads it) or right (an output that sets it). */
      tag: function (name, p, side) { SL.makeComp(d, "Continuation", p[0], p[1], side === "out" ? 3 : side === "down" ? 0 : 1, name); },
      /** Marker for the lower input of a block: further left, so its labels do not cover the upper one. */
      tag2: function (name, p) { SL.addWire(d, [p[0] - 75, p[1]], p); P.tag(name, [p[0] - 75, p[1]]); },
      text: function (x, y, t, size, color) { d.texts.push({ id: SL.newId(d), x: x, y: y, text: t, size: size || 12, color: color || [0, 0, 0] }); },
      box: function (a, b, w) { d.drawings.push({ id: SL.newId(d), kind: "Rect", a: a, b: b, color: [0, 0, 0], width: w || 1 }); },
      line: function (a, b, w) { d.drawings.push({ id: SL.newId(d), kind: "Line", a: a, b: b, color: [0, 0, 0], width: w || 1 }); },
    };
    return P;
  }
  var secs = function (s) { return { time_base: s, time_mult: 1 }; };
  var FLASH = { time_base: 5, time_mult: 0.1 }; // 0.5 s

  /** Inputs common to both programs: I1 -> "I1", NOT I2 -> "Aturada". */
  function trafficInputs(P) {
    P.blk("LogoI", 600, 165, "I1"); P.tag("I1", [645, 165], "out");
    P.blk("LogoI", 600, 225, "I2"); P.W([645, 225], [675, 225]);
    P.blk("LogicNot", 675, 225); P.tag("Aturada", [735, 225], "out");
  }

  /** GRAFCET drawn beside the wiring: steps, transitions and actions. */
  function drawGrafcet(P, x, y) {
    var steps = [["0", "H2 ambre intermitent"], ["1", "H1 verd · T1 = 5 s"], ["2", "H2 ambre · T2 = 2 s"], ["3", "H3 vermell · T3 = 5 s"]];
    var conds = ["I1 · I2 (marxa)", "T1", "T2", "T3"], S = 36, gap = 66;
    P.text(x - 30, y - 45, "GRAFCET", 15, [0, 0, 160]);
    steps.forEach(function (st, i) {
      var top = y + i * gap;
      P.box([x, top], [x + S, top + S], 1);
      if (i === 0) P.box([x + 4, top + 4], [x + S - 4, top + S - 4], 1); // initial step
      P.text(x + 13, top + 10, st[0], 14);
      P.line([x + S, top + S / 2], [x + S + 24, top + S / 2]);
      P.box([x + S + 24, top + 6], [x + S + 200, top + S - 6]);
      P.text(x + S + 30, top + 11, st[1], 11);
      if (i < steps.length - 1) {
        P.line([x + S / 2, top + S], [x + S / 2, top + gap]);
        P.line([x + S / 2 - 10, top + S + 15], [x + S / 2 + 10, top + S + 15], 3);
        P.text(x + S / 2 + 16, top + S + 8, conds[i], 11);
      }
    });
    // loop back from step 3 to step 1, transition T3
    var bot = y + 3 * gap + S, back = x - 30;
    P.line([x + S / 2, bot], [x + S / 2, bot + 30]);
    P.line([x + S / 2 - 10, bot + 15], [x + S / 2 + 10, bot + 15], 3);
    P.text(x + S / 2 + 16, bot + 8, conds[3], 11);
    P.line([x + S / 2, bot + 30], [back, bot + 30]);
    P.line([back, bot + 30], [back, y + gap - 15]);
    P.line([back, y + gap - 15], [x + S / 2, y + gap - 15]);
    P.line([back - 5, y + 2 * gap], [back, y + 2 * gap - 10]); P.line([back, y + 2 * gap - 10], [back + 5, y + 2 * gap]); // arrow up
    P.text(x - 30, bot + 45, "I2 obert (aturada): totes les etapes a 0 -> etapa 0", 11, [160, 0, 0]);
  }

  /** Traffic light on a LOGO!: one SR flip-flop per GRAFCET step. */
  SL.exampleTrafficGrafcetDoc = function () {
    var d = SL.newDoc(), P = prog(d), W = P.W;
    trafficHardware(d);
    trafficInputs(P);
    // step 1: set by (E0 · I1) or (E3 · T3); reset by E2 or stop
    P.blk("LogicAnd", 690, 315); P.tag("E0", [690, 315]); P.tag2("I1", [690, 345]);
    P.blk("LogicAnd", 690, 375); P.tag("E3", [690, 375]); P.tag2("T3", [690, 405]);
    P.blk("LogicOr", 780, 345); W([750, 330], [765, 330], [765, 345], [780, 345]); W([750, 390], [765, 390], [765, 375], [780, 375]);
    P.blk("LogicOr", 780, 420); P.tag("E2", [780, 420]); P.tag2("Aturada", [780, 450]);
    // steps 2 and 3: set by (previous step · its time); reset by the next step or stop
    [[510, "E1", "T1", "E3"], [675, "E2", "T2", "E1"]].forEach(function (r) {
      var y = r[0];
      P.blk("LogicAnd", 780, y - 15); P.tag(r[1], [780, y - 15]); P.tag2(r[2], [780, y + 15]); W([840, y], [870, y]);
      P.blk("LogicOr", 780, y + 45); P.tag(r[3], [780, y + 45]); P.tag2("Aturada", [780, y + 75]);
      W([840, y + 60], [855, y + 60], [855, y + 30], [870, y + 30]);
    });
    W([840, 360], [870, 360]); W([840, 435], [855, 435], [855, 390], [870, 390]);
    // flip-flops (steps) and the timers of the active step
    [[360, "E1", "T1", 5], [510, "E2", "T2", 2], [675, "E3", "T3", 5]].forEach(function (r) {
      var y = r[0];
      P.blk("LogicSR", 870, y, r[1]);
      W([930, y], [1005, y]); P.tag(r[1], [975, y + 30], "down"); W([975, y], [975, y + 30]);
      P.blk("LogicTon", 1005, y, r[2], secs(r[3])); P.tag(r[2], [1065, y], "out");
    });
    // step 0: active while no other step is
    P.blk("LogicOr", 1170, 360); P.tag("E1", [1170, 360]); P.tag2("E2", [1170, 390]);
    P.blk("LogicNor", 1260, 375); W([1230, 375], [1260, 375]); P.tag2("E3", [1260, 405]);
    P.tag("E0", [1320, 390], "out");
    // outputs
    P.blk("LogoQ", 1350, 480, "Q1"); P.tag("E1", [1350, 480]);
    P.blk("LogicFlash", 1170, 555, "", FLASH); P.tag("E0", [1170, 555]);
    P.blk("LogicOr", 1260, 555); W([1230, 555], [1260, 555]); P.tag2("E2", [1260, 585]);
    P.blk("LogoQ", 1350, 570, "Q2"); W([1320, 570], [1350, 570]);
    P.blk("LogoQ", 1350, 660, "Q3"); P.tag("E3", [1350, 660]);
    drawGrafcet(P, 150, 720);
    P.text(165, 66, "Semàfor amb LOGO! — programa per GRAFCET", 18);
    P.text(600, 110, "Programa: cada etapa és un biestable SR (posada a 1 per la transició, a 0 per l'etapa següent)", 13, [0, 0, 160]);
    P.text(1170, 300, "Etapa inicial i sortides", 13, [0, 0, 160]);
    d.title.title = "Semàfor amb LOGO! (GRAFCET)";
    d.title.number = "5";
    return d;
  };

  /** Traffic light on a LOGO!: program translated from a relay circuit (three chained timers). */
  SL.exampleTrafficWiredDoc = function () {
    var d = SL.newDoc(), P = prog(d), W = P.W;
    trafficHardware(d);
    trafficInputs(P);
    // run memory (start/stop with latching): M and its complement
    P.blk("LogicSR", 780, 300, "M"); P.tag("I1", [780, 300]); P.tag2("Aturada", [780, 330]);
    P.tag("M", [840, 300], "out"); P.tag("/M", [840, 330], "out");
    // ring of on-delay timers: T1 = M · /T3, T2 = T1, T3 = T2
    P.blk("LogicNot", 600, 465); P.tag("T3", [600, 465]);
    P.blk("LogicAnd", 690, 435); P.tag("M", [690, 435]); W([660, 465], [690, 465]);
    P.blk("LogicTon", 780, 450, "T1", secs(5)); W([750, 450], [780, 450]); P.tag("T1", [840, 450], "out");
    P.blk("LogicTon", 780, 540, "T2", secs(2)); P.tag("T1", [780, 540]); P.tag("T2", [840, 540], "out");
    P.blk("LogicTon", 780, 630, "T3", secs(5)); P.tag("T2", [780, 630]); P.tag("T3", [840, 630], "out");
    // lights: green = M · /T1, amber = T1 · /T2 or (/M flashing), red = T2
    P.blk("LogicNot", 1020, 330); P.tag("T1", [1020, 330]);
    P.blk("LogicAnd", 1110, 300); P.tag("M", [1110, 300]); W([1080, 330], [1110, 330]);
    P.blk("LogoQ", 1200, 315, "Q1"); W([1170, 315], [1200, 315]);
    P.blk("LogicNot", 1020, 450); P.tag("T2", [1020, 450]);
    P.blk("LogicAnd", 1110, 420); P.tag("T1", [1110, 420]); W([1080, 450], [1110, 450]);
    P.blk("LogicFlash", 1020, 525, "", FLASH); P.tag("/M", [1020, 525]);
    P.blk("LogicOr", 1200, 435); W([1170, 435], [1200, 435]); W([1080, 525], [1185, 525], [1185, 465], [1200, 465]);
    P.blk("LogoQ", 1290, 450, "Q2"); W([1260, 450], [1290, 450]);
    P.blk("LogoQ", 1200, 630, "Q3"); P.tag("T2", [1200, 630]);
    P.text(165, 66, "Semàfor amb LOGO! — programa per lògica cablada", 18);
    P.text(600, 110, "Programa: traducció del circuit de relés (memòria de marxa i tres temporitzadors encadenats)", 13, [0, 0, 160]);
    [["Equacions", [0, 0, 160]], ["T1 = M · /T3    T2 = T1    T3 = T2", 0], ["Q1 verd = M · /T1", 0], ["Q2 ambre = T1 · /T2 + /M · intermitent", 0],
      ["Q3 vermell = T2", 0], ["En acabar T3 es reinicien T1, T2 i T3 i torna el verd", [90, 90, 90]]].forEach(function (l, i) {
      P.text(150, 720 + i * 24, l[0], i ? 12 : 15, l[1] || [0, 0, 0]);
    });
    d.title.title = "Semàfor amb LOGO! (lògica cablada)";
    d.title.number = "6";
    return d;
  };

  /**
   * Traffic light with relays (wired logic): KA1 run relay with latching,
   * ring of on-delay timers KT1 (green 5 s) -> KT2 (amber 2 s) -> KT3 (red 5 s),
   * KF1 flasher for the amber light at rest.
   */
  SL.exampleTrafficRelayDoc = function () {
    var d = SL.newDoc(), W = function () { for (var i = 1; i < arguments.length; i++) SL.addWire(d, arguments[i - 1], arguments[i]); };
    var T = 270, B = 660; // L and N rails
    add(d, "FeedL", 150, 120, 0, "");
    add(d, "Fuse1", 150, 180, 0, "-F1");
    W([150, 150], [150, 180]); W([150, 240], [150, T]);
    add(d, "FeedN", 150, 720, 2, "");
    W([150, B], [150, 690]);
    /** One rung at x: devices from the top rail down, `[kind, name, base]`; the last one is the load. */
    function rung(x, parts) {
      W([x, T], [x, 300]);
      var y = 300;
      parts.forEach(function (p, i) {
        var last = i === parts.length - 1;
        if (last && y < 540) { W([x, y], [x, 540]); y = 540; }
        var c = add(d, p[0], x, y, 0, p[1], p[2]);
        if (p[3]) c.color = p[3];
        y += 60;
        if (!last) { W([x, y], [x, y + 30]); y += 30; }
      });
      W([x, 600], [x, B]);
    }
    // KA1: S0 stop, S1 start with KA1 latching
    rung(150, [["PushNC", "-S0"], ["PushNO", "-S1"], ["Coil", "-KA1"]]);
    add(d, "AuxNO", 240, 390, 0, "-KA1");
    W([150, 375], [240, 375], [240, 390]); W([240, 450], [240, 465], [150, 465]);
    // ring of timers: KT1 runs while KA1 is on and KT3 has not finished
    rung(360, [["AuxNO", "-KA1"], ["TimedOnNC", "-KT3", 5], ["TimerOn", "-KT1", 5]]);
    rung(480, [["TimedOnNO", "-KT1", 5], ["TimerOn", "-KT2", 2]]);
    rung(600, [["TimedOnNO", "-KT2", 2], ["TimerOn", "-KT3", 5]]);
    // flasher for the amber light while the traffic light is stopped
    rung(720, [["AuxNC", "-KA1"], ["Flasher", "-KF1", 5]]);
    d.comps[d.comps.length - 1].time_mult = 0.1; // 0.5 s
    // lights
    rung(840, [["AuxNO", "-KA1"], ["TimedOnNC", "-KT1", 5], ["Lamp", "-H1", 0, "Verde"]]);
    rung(960, [["TimedOnNO", "-KT1", 5], ["TimedOnNC", "-KT2", 2], ["Lamp", "-H2", 0, "Amarillo"]]);
    add(d, "AuxNO", 1050, 330, 0, "-KF1");
    W([1050, T], [1050, 330]); W([1050, 390], [1050, 480], [960, 480]);
    rung(1140, [["TimedOnNO", "-KT2", 2], ["Lamp", "-H3", 0, "Rojo"]]);
    W([150, T], [1140, T]); W([150, B], [1140, B]);
    d.texts.push({ id: SL.newId(d), x: 240, y: 66, text: "Semàfor amb relés (lògica cablada)", size: 18, color: [0, 0, 0] });
    [["KA1 marxa (S1) i aturada (S0) amb autoretenció", [0, 0, 160]],
      ["KT1 (5 s) -> KT2 (2 s) -> KT3 (5 s): en acabar KT3 s'obre el seu contacte i es reinicien tots tres", 0],
      ["H1 verd = KA1 · /KT1    H2 ambre = KT1 · /KT2 + KF1 (intermitent en repòs)    H3 vermell = KT2", 0]].forEach(function (l, i) {
      d.texts.push({ id: SL.newId(d), x: 240, y: 760 + i * 24, text: l[0], size: i ? 12 : 13, color: l[1] || [0, 0, 0] });
    });
    d.title.title = "Semàfor amb relés";
    d.title.number = "7";
    return d;
  };
})((typeof globalThis !== "undefined" ? globalThis : window).SL);
