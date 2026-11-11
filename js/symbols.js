// SimuLAB — vector symbols in local units (x right, y down), poles 30 apart,
// terminals on the 15-unit grid. Motor geometry follows the original's
// scripts (sub_4a8d80 / sub_4ac380, see MECHANICS.md).
"use strict";
(function (SL) {
  var PI = Math.PI;
  var MOTOR_RUN_FILL = "rgb(192,192,192)"; // 0xb8080c
  var HOT_FILL = "rgb(255,175,175)";

  function Sym() { this.prims = []; this.terms = []; this.tlabels = []; }
  Sym.prototype.l = function (a, b) { this.prims.push({ t: "line", a: a, b: b }); };
  Sym.prototype.d = function (a, b) { this.prims.push({ t: "dash", a: a, b: b }); };
  Sym.prototype.c = function (c, r, fill) { this.prims.push({ t: "circle", c: c, r: r, fill: fill }); };
  Sym.prototype.r = function (a, b, fill) { this.prims.push({ t: "rect", a: a, b: b, fill: fill }); };
  Sym.prototype.a = function (c, r, a0, a1) { this.prims.push({ t: "arc", c: c, r: r, a0: a0, a1: a1 }); };
  Sym.prototype.poly = function (pts, closed, fill) { this.prims.push({ t: "poly", pts: pts, closed: closed, fill: fill }); };
  Sym.prototype.text = function (p, s, size) { this.prims.push({ t: "text", p: p, s: s, size: size }); };
  Sym.prototype.term = function (x, y, label) { this.terms.push([x, y]); this.tlabels.push(label || ""); };

  /** Two-terminal contact between (x,y0) and (x,y0+60); returns the blade midpoint. */
  function contact(s, x, y0, nc, closed, contactor, breaker) {
    s.l([x, y0], [x, y0 + 18]);
    s.l([x, y0 + 42], [x, y0 + 60]);
    if (nc) s.l([x, y0 + 18], [x + 10, y0 + 18]);
    var pivot = [x, y0 + 42];
    var tip = closed ? (nc ? [x + 11, y0 + 15] : [x - 1.5, y0 + 17]) : [x - 14, y0 + 18];
    s.l(pivot, tip);
    if (contactor) s.a([x, y0 + 13], 5, 0, PI);
    if (breaker) {
      s.l([x - 4, y0 + 14], [x + 4, y0 + 22]);
      s.l([x - 4, y0 + 22], [x + 4, y0 + 14]);
    }
    return [(pivot[0] + tip[0]) / 2, (pivot[1] + tip[1]) / 2];
  }

  function actuator(s, from, hx, act) {
    var hy = from[1];
    if (!act) return;
    s.d(from, [hx, hy]);
    switch (act) {
      case "push": s.poly([[hx - 5, hy - 8], [hx, hy - 8], [hx, hy + 8], [hx - 5, hy + 8]], false); break;
      case "mushroom": s.l([hx, hy - 8], [hx, hy + 8]); s.a([hx, hy], 8, PI / 2, 1.5 * PI); break;
      case "switch": s.poly([[hx - 5, hy - 8], [hx, hy - 8], [hx, hy + 8], [hx + 4, hy + 8]], false); break;
      case "limit": s.poly([[hx, hy], [hx - 8, hy - 7], [hx - 8, hy + 7]], true); break;
      case "timedon": s.a([hx - 6, hy], 6, -PI / 2, PI / 2); s.l([hx - 6, hy - 6], [hx - 6, hy + 6]); break;
      case "timedoff": s.a([hx, hy], 6, PI / 2, 1.5 * PI); s.l([hx, hy - 6], [hx, hy + 6]); break;
      case "thermal": s.poly([[hx, hy - 7], [hx - 5, hy - 7], [hx - 5, hy + 7], [hx - 10, hy + 7]], false); break;
    }
  }

  /** Direction arrow of a running three-phase motor (sub_4ac380, 0x4ae4cc..0x4ae548). */
  function directionArrow(s, dir) {
    var a0 = Math.atan2(-12, 18), a1 = Math.atan2(-12, -19);
    s.a([30, 60], 30, a0, a1);
    s.poly(dir > 0 ? [[55, 44], [45, 39], [51, 34]] : [[4, 44], [14, 39], [8, 34]], true, "stroke");
  }

  function rotorMarks(s, c, r, angle, dir) {
    var a = angle * dir;
    for (var k = 0; k < 3; k++) {
      var ang = a + k * 2.094;
      s.prims.push({ t: "circle", c: [c[0] + r * Math.cos(ang), c[1] + r * Math.sin(ang)], r: 2.5, fill: "rgb(0,128,0)", color: "rgb(0,128,0)" });
    }
  }

  /** Build the drawing of a kind. v = {closed, active, lamp, motor, angle} */
  SL.buildSymbol = function (kind, v) {
    v = v || {};
    var K = SL.KINDS[kind], s = new Sym(), i, x;
    switch (kind) {
      case "FeedL": case "FeedN": case "FeedPE": case "FeedLN": case "FeedLNPE": case "FeedL123":
      case "FeedL123N": case "FeedL123NPE": case "FeedPos": case "FeedNeg": case "FeedPosNeg":
        K.feed.forEach(function (f, i) {
          var x = 30 * i;
          s.l([x, 30], [x, 18]);
          s.c([x, 14], 4);
          s.text([x, 3], f[1], 11);
          s.term(x, 30, "");
        });
        break;
      case "Fuse1": case "Fuse2": case "Fuse3":
        for (i = 0; i < K.poles; i++) {
          x = 30 * i;
          s.l([x, 0], [x, 60]);
          s.r([x - 5, 15], [x + 5, 45]);
          s.term(x, 0, String(2 * i + 1));
          s.term(x, 60, String(2 * i + 2));
        }
        break;
      case "Breaker1": case "Breaker2": case "Breaker3": case "Switch2": case "Switch3":
      case "Contactor1": case "Contactor2": case "Contactor3": case "Contactor4": {
        var breaker = kind.indexOf("Breaker") === 0, contactor = kind.indexOf("Contactor") === 0;
        var mids = [];
        for (i = 0; i < K.poles; i++) {
          x = 30 * i;
          mids.push(contact(s, x, 0, false, !!v.closed, contactor, breaker));
          s.term(x, 0, String(2 * i + 1));
          s.term(x, 60, String(2 * i + 2));
        }
        var y = mids[0][1];
        if (K.poles > 1) s.d([mids[0][0], y], [mids[K.poles - 1][0], y]);
        if (breaker) {
          s.d([mids[0][0], y], [-24, y]);
          s.r([-34, y - 7], [-24, y + 7]);
          s.l([-31, y + 3], [-31, y - 3]); s.l([-31, y - 3], [-27, y - 3]); s.l([-27, y - 3], [-27, y + 3]);
        } else if (!contactor) {
          actuator(s, [mids[0][0], y], -24, "switch");
        }
        break;
      }
      case "ThermalRelay3":
        for (i = 0; i < 3; i++) {
          x = 30 * i;
          s.l([x, 0], [x, 20]);
          s.r([x - 7, 20], [x + 7, 40], v.active ? HOT_FILL : null);
          s.poly([[x, 20], [x, 27], [x - 4, 27], [x - 4, 33], [x, 33], [x, 40]], false);
          s.l([x, 40], [x, 60]);
          s.term(x, 0, String(2 * i + 1));
          s.term(x, 60, String(2 * i + 2));
        }
        s.d([-7, 30], [-22, 30]);
        s.poly([[-22, 23], [-27, 23], [-27, 37], [-32, 37]], false);
        break;
      case "Motor3": case "Motor3YD":
        s.l([0, 0], [0, 27]); s.l([30, 0], [30, 15]); s.l([60, 0], [60, 27]);
        s.l([90, 0], [90, 60]); s.l([90, 60], [75, 60]);
        s.c([30, 60], 45, v.motor ? MOTOR_RUN_FILL : "rgb(255,255,255)");
        s.text([30, 48], "M", 20);
        s.text([30, 70], "3~", 12);
        if (kind === "Motor3YD") {
          s.l([0, 93], [0, 120]); s.l([30, 105], [30, 120]); s.l([60, 93], [60, 120]);
          s.term(0, 0, "U1"); s.term(30, 0, "V1"); s.term(60, 0, "W1");
          s.term(0, 120, "W2"); s.term(30, 120, "U2"); s.term(60, 120, "V2");
        } else {
          s.term(0, 0, "U"); s.term(30, 0, "V"); s.term(60, 0, "W");
        }
        s.term(90, 0, "PE");
        if (v.motor) directionArrow(s, v.motor);
        break;
      case "Motor1":
        s.l([0, 0], [0, 41]); s.l([30, 0], [30, 41]);
        s.c([15, 60], 24, v.motor ? "rgb(150,255,150)" : null);
        s.text([15, 55], "M", 16); s.text([15, 70], "1~", 10);
        s.term(0, 0, "U"); s.term(30, 0, "N");
        if (v.motor) rotorMarks(s, [15, 60], 29, v.angle || 0, v.motor);
        break;
      case "AuxNO": case "AuxNC": case "TimedOnNO": case "TimedOnNC": case "TimedOffNO": case "TimedOffNC":
      case "PushNO": case "PushNC": case "MushroomNO": case "MushroomNC": case "SwitchNO": case "SwitchNC":
      case "LimitNO": case "LimitNC": case "ThermalNO": case "ThermalNC": {
        var mid = contact(s, 0, 0, K.nc, !!v.closed, false, false);
        var act = { TimedOnNO: "timedon", TimedOnNC: "timedon", TimedOffNO: "timedoff", TimedOffNC: "timedoff",
          PushNO: "push", PushNC: "push", MushroomNO: "mushroom", MushroomNC: "mushroom", SwitchNO: "switch",
          SwitchNC: "switch", LimitNO: "limit", LimitNC: "limit", ThermalNO: "thermal", ThermalNC: "thermal" }[kind];
        actuator(s, mid, -22, act);
        var lab = { AuxNO: ["13", "14"], AuxNC: ["21", "22"], TimedOnNO: ["67", "68"], TimedOffNO: ["67", "68"],
          TimedOnNC: ["55", "56"], TimedOffNC: ["55", "56"], ThermalNO: ["97", "98"], ThermalNC: ["95", "96"] }[kind]
          || (K.nc ? ["1", "2"] : ["3", "4"]);
        s.term(0, 0, lab[0]); s.term(0, 60, lab[1]);
        break;
      }
      case "Coil": case "TimerOn": case "TimerOff": case "TimerOnOff": case "Flasher": case "StepRelay":
        s.l([0, 0], [0, 20]); s.l([0, 40], [0, 60]);
        s.r([-12, 20], [12, 40], v.active ? HOT_FILL : null);
        if (kind === "TimerOn") { s.r([-26, 20], [-12, 40]); s.l([-26, 20], [-12, 40]); s.l([-26, 40], [-12, 20]); }
        if (kind === "TimerOff") s.r([-26, 20], [-12, 40], "stroke");
        if (kind === "TimerOnOff") { s.r([-26, 20], [-12, 30], "stroke"); s.r([-26, 30], [-12, 40]); s.l([-26, 30], [-12, 40]); s.l([-26, 40], [-12, 30]); }
        if (kind === "Flasher") {
          s.r([-26, 20], [-12, 40]);
          s.poly([[-24, 34], [-22, 34], [-22, 26], [-19, 26], [-19, 34], [-16, 34], [-16, 26], [-14, 26]], false);
        }
        if (kind === "StepRelay") s.poly([[-8, 35], [-4, 35], [-4, 25], [4, 25], [4, 35], [8, 35]], false);
        s.term(0, 0, "A1"); s.term(0, 60, "A2");
        break;
      case "Lamp":
        s.l([0, 0], [0, 18]); s.l([0, 42], [0, 60]);
        s.c([0, 30], 12, v.lamp || null);
        s.l([-8.5, 21.5], [8.5, 38.5]); s.l([-8.5, 38.5], [8.5, 21.5]);
        s.term(0, 0, "X1"); s.term(0, 60, "X2");
        break;
      case "Buzzer":
        s.l([0, 0], [0, 22]); s.l([0, 34], [0, 60]);
        s.a([0, 34], 12, PI, 2 * PI); s.l([-12, 34], [12, 34]);
        if (v.active) s.c([0, 30], 3, HOT_FILL);
        s.term(0, 0, "X1"); s.term(0, 60, "X2");
        break;
      case "Horn":
        s.l([0, 0], [0, 22]); s.l([0, 38], [0, 60]);
        s.r([-6, 22], [6, 38], v.active ? HOT_FILL : null);
        s.poly([[6, 22], [16, 14], [16, 46], [6, 38]], true);
        s.term(0, 0, "X1"); s.term(0, 60, "X2");
        break;
      case "Terminal":
        s.l([0, 0], [0, 10]); s.l([0, 20], [0, 30]);
        s.c([0, 15], 5, "rgb(255,255,255)");
        s.term(0, 0, ""); s.term(0, 30, "");
        break;
    }
    return s;
  };

  /** Rotate (90° steps, clockwise on screen) then mirror. */
  SL.xform = function (p, rot, mirror) {
    var x = p[0], y = p[1];
    for (var i = 0; i < ((rot % 4) + 4) % 4; i++) { var nx = -y, ny = x; x = nx; y = ny; }
    if (mirror) x = -x;
    return [x, y];
  };

  SL.symBBox = function (sym) {
    var mn = [Infinity, Infinity], mx = [-Infinity, -Infinity];
    function add(p, r) {
      mn[0] = Math.min(mn[0], p[0] - r); mn[1] = Math.min(mn[1], p[1] - r);
      mx[0] = Math.max(mx[0], p[0] + r); mx[1] = Math.max(mx[1], p[1] + r);
    }
    sym.prims.forEach(function (p) {
      if (p.t === "line" || p.t === "dash" || p.t === "rect") { add(p.a, 0); add(p.b, 0); }
      else if (p.t === "circle" || p.t === "arc") add(p.c, p.r);
      else if (p.t === "poly") p.pts.forEach(function (q) { add(q, 0); });
      else if (p.t === "text") add(p.p, p.size * 0.5);
    });
    if (mn[0] === Infinity) return [[-5, -5], [5, 5]];
    return [mn, mx];
  };

  /** World-space terminals of a component. */
  SL.terminals = function (c) {
    var sym = SL.buildSymbol(c.kind, {});
    return sym.terms.map(function (t) {
      var p = SL.xform(t, c.rot, c.mirror);
      return [Math.round(p[0]) + c.x, Math.round(p[1]) + c.y];
    });
  };

  /** World-space bounding box {x0,y0,x1,y1}. */
  SL.compRect = function (c) {
    var bb = SL.symBBox(SL.buildSymbol(c.kind, {}));
    var pts = [bb[0], bb[1], [bb[0][0], bb[1][1]], [bb[1][0], bb[0][1]]].map(function (p) {
      var q = SL.xform(p, c.rot, c.mirror); return [q[0] + c.x, q[1] + c.y];
    });
    return {
      x0: Math.min.apply(null, pts.map(function (p) { return p[0]; })),
      y0: Math.min.apply(null, pts.map(function (p) { return p[1]; })),
      x1: Math.max.apply(null, pts.map(function (p) { return p[0]; })),
      y1: Math.max.apply(null, pts.map(function (p) { return p[1]; })),
    };
  };
})((typeof globalThis !== "undefined" ? globalThis : window).SL);
