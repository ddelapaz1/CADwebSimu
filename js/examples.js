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
})((typeof globalThis !== "undefined" ? globalThis : window).SL);
