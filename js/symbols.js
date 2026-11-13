// SimuLAB — vector symbols in local units (x right, y down), poles 30 apart,
// terminals on the 15-unit grid. Motor geometry follows the original's
// scripts (sub_4a8d80 / sub_4ac380, see MECHANICS.md).
"use strict";
(function (SL) {
  var PI = Math.PI;
  var MOTOR_RUN_FILL = "rgb(192,192,192)"; // 0xb8080c
  var HOT_FILL = "rgb(255,175,175)";

  function Sym() { this.prims = []; this.terms = []; this.tlabels = []; this.tdirs = []; }
  Sym.prototype.l = function (a, b) { this.prims.push({ t: "line", a: a, b: b }); };
  Sym.prototype.d = function (a, b) { this.prims.push({ t: "dash", a: a, b: b }); };
  Sym.prototype.c = function (c, r, fill) { this.prims.push({ t: "circle", c: c, r: r, fill: fill }); };
  Sym.prototype.r = function (a, b, fill) { this.prims.push({ t: "rect", a: a, b: b, fill: fill }); };
  Sym.prototype.a = function (c, r, a0, a1) { this.prims.push({ t: "arc", c: c, r: r, a0: a0, a1: a1 }); };
  Sym.prototype.poly = function (pts, closed, fill) { this.prims.push({ t: "poly", pts: pts, closed: closed, fill: fill }); };
  Sym.prototype.text = function (p, s, size) { this.prims.push({ t: "text", p: p, s: s, size: size }); };
  Sym.prototype.term = function (x, y, label, dir) { this.terms.push([x, y]); this.tlabels.push(label || ""); this.tdirs.push(dir || null); };
  /** Push a primitive with its own colour (overrides the component colour). */
  Sym.prototype.col = function (color) { this.prims[this.prims.length - 1].color = color; };

  // ---- logic elements: inputs on the left (x = 0), outputs on the right (x = 60)
  var LOGIC_ON = "rgb(220,0,0)", LOGIC_OFF = "rgb(150,150,150)", WHITE = "rgb(255,255,255)";
  // segments a..g for 0..F
  var SEG7 = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x77, 0x7c, 0x39, 0x5e, 0x79, 0x71];
  SL.SEG7 = SEG7;
  function lbox(s, y0, y1, x0, x1) { s.r([x0 == null ? 15 : x0, y0], [x1 == null ? 45 : x1, y1], WHITE); }
  function lin(s, y, txt, v, i) {
    s.l([0, y], [15, y]);
    if (v && v.ins) s.col(v.ins[i] ? LOGIC_ON : LOGIC_OFF);
    if (txt) s.text([20, y], txt, 7);
    s.term(0, y, "", [-1, 0]);
  }
  function lout(s, y, txt, v, i, neg) {
    if (neg) { s.c([48, y], 3, WHITE); s.l([51, y], [60, y]); } else s.l([45, y], [60, y]);
    if (v && v.outs) s.col(v.outs[i] ? LOGIC_ON : LOGIC_OFF);
    if (txt) s.text([39, y], txt, 7);
    s.term(60, y, "", [1, 0]);
  }
  function wave(s, pts) { s.poly(pts.map(function (p) { return [p[0], p[1]]; }), false); }

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
      case "limit": s.c([hx - 5, hy], 5, "rgb(255,255,255)"); s.c([hx - 5, hy], 1.2, "stroke"); break;
      case "timedon": s.a([hx - 6, hy], 6, -PI / 2, PI / 2); s.l([hx - 6, hy - 6], [hx - 6, hy + 6]); break;
      case "timedoff": s.a([hx, hy], 6, PI / 2, 1.5 * PI); s.l([hx, hy - 6], [hx, hy + 6]); break;
      case "timedonoff":
        s.a([hx - 3, hy], 6, -PI / 2, PI / 2); s.l([hx - 3, hy - 6], [hx - 3, hy + 6]);
        s.a([hx - 6, hy], 6, PI / 2, 1.5 * PI); s.l([hx - 6, hy - 6], [hx - 6, hy + 6]);
        break;
      case "thermal": s.poly([[hx, hy - 7], [hx - 5, hy - 7], [hx - 5, hy + 7], [hx - 10, hy + 7]], false); break;
    }
  }

  function contactCO(s, x, y0, actuated) {
    s.l([x, y0], [x, y0 + 18]);
    s.l([x - 15, y0 + 42], [x - 15, y0 + 60]);
    s.l([x - 15, y0 + 42], [x - 5, y0 + 42]);
    s.l([x + 15, y0 + 42], [x + 15, y0 + 60]);
    var pivot = [x, y0 + 18];
    var tip = actuated ? [x + 13, y0 + 42] : [x - 6, y0 + 45];
    s.l(pivot, tip);
    return [(pivot[0] + tip[0]) / 2, (pivot[1] + tip[1]) / 2];
  }

  /** Direction arrow of a running three-phase motor (sub_4ac380, 0x4ae4cc..0x4ae548). */
  function directionArrow(s, dir) {
    var a0 = Math.atan2(-12, 18), a1 = Math.atan2(-12, -19);
    s.a([30, 60], 30, a0, a1);
    s.poly(dir > 0 ? [[55, 44], [45, 39], [51, 34]] : [[4, 44], [14, 39], [8, 34]], true, "stroke");
  }

  function rotorMarks(s, c, r, angle, dir) {
    var a = angle;
    for (var k = 0; k < 3; k++) {
      var ang = a + k * (2 * PI / 3);
      var px = c[0] + r * Math.cos(ang), py = c[1] + r * Math.sin(ang);
      s.prims.push({ t: "circle", c: [px, py], r: 3, fill: "rgb(0,150,0)", color: "rgb(0,110,0)" });
      if (dir) {
        var tang = ang - dir * 0.35;
        var tx = c[0] + r * Math.cos(tang), ty = c[1] + r * Math.sin(tang);
        s.prims.push({ t: "line", a: [tx, ty], b: [px, py], color: "rgb(0,150,0)" });
      }
    }
  }

  /** Build the drawing of a kind. v = {closed, active, lamp, motor, angle} */
  SL.buildSymbol = function (kind, v) {
    v = v || {};
    var K = SL.KINDS[kind], s = new Sym(), i, x;
    switch (kind) {
      case "FeedL": case "FeedN": case "FeedPE": case "FeedLN": case "FeedLNPE": case "FeedL123":
      case "FeedL123PE": case "FeedL123N": case "FeedL123NPE": case "FeedPos": case "FeedNeg": case "FeedPosNeg":
        K.feed.forEach(function (f, i) {
          var x = 30 * i;
          s.l([x, 30], [x, 18]);
          s.c([x, 14], 4);
          s.text([x, 3], f[1], 11);
          s.term(x, 30, "");
        });
        break;
      case "Ground":
        s.l([0, 0], [0, 15]);
        s.l([-12, 15], [12, 15]);
        s.l([-8, 20], [8, 20]);
        s.l([-4, 25], [4, 25]);
        s.term(0, 0, "PE");
        break;
      case "Transformer1":
        s.l([0, 0], [0, 16]); s.l([30, 0], [30, 16]);
        s.r([0, 16], [30, 22], "stroke");
        s.l([0, 26], [30, 26]); s.l([0, 30], [30, 30]); s.l([0, 34], [30, 34]);
        s.r([0, 38], [30, 44], "stroke");
        s.l([0, 44], [0, 60]); s.l([30, 44], [30, 60]);
        s.term(0, 0, "1"); s.term(30, 0, "2");
        s.term(0, 60, "3"); s.term(30, 60, "4");
        break;
      case "Transformer3":
        s.l([0, 0], [0, 16]); s.l([30, 0], [30, 16]); s.l([60, 0], [60, 16]);
        s.r([0, 16], [60, 22], "stroke");
        s.l([0, 26], [60, 26]); s.l([0, 30], [60, 30]); s.l([0, 34], [60, 34]);
        s.r([0, 38], [60, 44], "stroke");
        s.l([0, 44], [0, 60]); s.l([30, 44], [30, 60]); s.l([60, 44], [60, 60]);
        s.term(0, 0, "1"); s.term(30, 0, "2"); s.term(60, 0, "3");
        s.term(0, 60, "4"); s.term(30, 60, "5"); s.term(60, 60, "6");
        break;
      case "Diode":
        s.l([0, 0], [0, 60]);
        s.poly([[-9, 22], [9, 22], [0, 38]], true, "stroke");
        s.l([-9, 38], [9, 38]);
        s.term(0, 0, "1"); s.term(0, 60, "2");
        break;
      case "Rectifier":
        s.l([0, 0], [0, 9]); s.l([0, 51], [0, 60]);
        s.l([-30, 30], [-21, 30]); s.l([21, 30], [30, 30]);
        s.poly([[0, 9], [21, 30], [0, 51], [-21, 30]], true);
        s.l([-11, 30], [11, 30]);
        s.poly([[-5, 24], [-5, 36], [5, 30]], true, "stroke");
        s.l([5, 24], [5, 36]);
        s.term(0, 0, "1"); s.term(0, 60, "2");
        s.term(30, 30, "+"); s.term(-30, 30, "-");
        break;
      case "PowerSupply1":
        s.l([0, 0], [0, 12]); s.l([30, 0], [30, 12]);
        s.l([0, 48], [0, 60]); s.l([30, 48], [30, 60]);
        s.r([-6, 12], [36, 48], v.active ? HOT_FILL : "rgb(255,255,255)");
        s.l([-6, 48], [36, 12]);
        s.text([5, 23], "~", 13);
        s.text([25, 39], "=", 13);
        s.term(0, 0, "L"); s.term(30, 0, "N");
        s.term(0, 60, "+"); s.term(30, 60, "-");
        break;
      case "PowerSupply3":
        s.l([0, 0], [0, 12]); s.l([30, 0], [30, 12]); s.l([60, 0], [60, 12]);
        s.l([15, 48], [15, 60]); s.l([45, 48], [45, 60]);
        s.r([-6, 12], [66, 48], v.active ? HOT_FILL : "rgb(255,255,255)");
        s.l([-6, 48], [66, 12]);
        s.text([14, 23], "3~", 11);
        s.text([46, 39], "=", 13);
        s.term(0, 0, "L1"); s.term(30, 0, "L2"); s.term(60, 0, "L3");
        s.term(15, 60, "+"); s.term(45, 60, "-");
        break;
      case "Battery":
        s.l([0, 0], [0, 25]);
        s.l([-14, 25], [14, 25]);
        s.r([-7, 33], [7, 36], "stroke");
        s.l([0, 36], [0, 60]);
        s.term(0, 0, "+"); s.term(0, 60, "-");
        break;
      case "Socket":
        s.l([0, 0], [0, 14]); s.l([0, 46], [0, 60]);
        s.c([0, 30], 16, v.active ? HOT_FILL : "rgb(255,255,255)");
        s.l([0, 14], [0, 20]); s.l([-3, 20], [3, 20]);
        s.l([0, 40], [0, 46]); s.l([-3, 40], [3, 40]);
        s.c([-7, 30], 2, "stroke");
        s.c([7, 30], 2, "stroke");
        s.term(0, 0, "1"); s.term(0, 60, "2");
        break;
      case "Fuse1": case "Fuse1N": case "Fuse2": case "Fuse3": case "Fuse3N": {
        var hasN = kind === "Fuse1N" || kind === "Fuse3N";
        for (i = 0; i < K.poles; i++) {
          x = 30 * i;
          s.l([x, 0], [x, 60]);
          var isNeutral = hasN && i === K.poles - 1;
          if (isNeutral) {
            s.l([x - 4, 15], [x + 4, 15]);
            s.l([x - 4, 45], [x + 4, 45]);
          } else {
            s.r([x - 5, 15], [x + 5, 45]);
            if (v.blown) { s.l([x - 9, 22], [x + 9, 38]); s.l([x - 9, 38], [x + 9, 22]); }
          }
          s.term(x, 0, isNeutral ? "N" : String(2 * i + 1));
          s.term(x, 60, isNeutral ? "N" : String(2 * i + 2));
        }
        if (K.poles > 1) s.d([0, 30], [30 * (K.poles - 1), 30]);
        break;
      }
      case "FuseSw1": case "FuseSw1N": case "FuseSw2": case "FuseSw3": case "FuseSw3N": {
        var swHasN = kind === "FuseSw1N" || kind === "FuseSw3N";
        var swMids = [];
        for (i = 0; i < K.poles; i++) {
          x = 30 * i;
          var swNeutral = swHasN && i === K.poles - 1;
          s.l([x, 0], [x, 18]);
          s.l([x - 3.5, 18], [x + 3.5, 18]);
          s.l([x, 42], [x, 60]);
          var p0 = [x, 42];
          var p1 = v.closed ? [x - 1.5, 17] : [x - 14, 18];
          s.l(p0, p1);
          if (!swNeutral) {
            var dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy) || 1;
            var ux = dx / len, uy = dy / len, nx = -uy * 4.5, ny = ux * 4.5;
            var a0 = [p0[0] + ux * len * 0.2, p0[1] + uy * len * 0.2];
            var a1 = [p0[0] + ux * len * 0.8, p0[1] + uy * len * 0.8];
            s.poly([
              [a0[0] - nx, a0[1] - ny],
              [a1[0] - nx, a1[1] - ny],
              [a1[0] + nx, a1[1] + ny],
              [a0[0] + nx, a0[1] + ny],
            ], true);
          }
          swMids.push([(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]);
          s.term(x, 0, swNeutral ? "N" : String(2 * i + 1));
          s.term(x, 60, swNeutral ? "N" : String(2 * i + 2));
        }
        var sy = swMids[0][1];
        if (K.poles > 1) s.d([swMids[0][0], sy], [swMids[K.poles - 1][0], sy]);
        actuator(s, [swMids[0][0], sy], -24, "switch");
        break;
      }
      case "Auto1": case "Auto1N": case "Auto2": case "Auto3": case "Auto3N": {
        var autoHasN = kind === "Auto1N" || kind === "Auto3N";
        var autoMids = [];
        for (i = 0; i < K.poles; i++) {
          x = 30 * i;
          var autoNeutral = autoHasN && i === K.poles - 1;
          var bm = contact(s, x, 0, false, !!v.closed, false, !autoNeutral);
          if (!autoNeutral) {
            var ap0 = [x, 42], ap1 = v.closed ? [x - 1.5, 17] : [x - 14, 18];
            var adx = ap1[0] - ap0[0], ady = ap1[1] - ap0[1], alen = Math.hypot(adx, ady) || 1;
            var aux = adx / alen, auy = ady / alen, anx = auy * 4.5, any = -aux * 4.5;
            var am0 = [ap0[0] + aux * alen * 0.42, ap0[1] + auy * alen * 0.42];
            var am1 = [ap0[0] + aux * alen * 0.65, ap0[1] + auy * alen * 0.65];
            s.poly([am0, [am0[0] + anx, am0[1] + any], [am1[0] + anx, am1[1] + any], am1], true, "stroke");
          }
          autoMids.push(bm);
          s.term(x, 0, autoNeutral ? "N" : String(2 * i + 1));
          s.term(x, 60, autoNeutral ? "N" : String(2 * i + 2));
        }
        var ay = autoMids[0][1];
        if (K.poles > 1) s.d([autoMids[0][0], ay], [autoMids[K.poles - 1][0], ay]);
        actuator(s, [autoMids[0][0], ay], -24, "switch");
        break;
      }
      case "Rcd1N": case "Rcd3N": {
        var rcdMids = [];
        for (i = 0; i < K.poles; i++) {
          x = 30 * i;
          var rcdNeutral = i === K.poles - 1;
          rcdMids.push(contact(s, x, 0, false, !!v.closed, false, false));
          s.term(x, 0, rcdNeutral ? "N" : String(2 * i + 1));
          s.term(x, 60, rcdNeutral ? "N" : String(2 * i + 2));
        }
        var ry = rcdMids[0][1], rxMax = 30 * (K.poles - 1);
        s.d([rcdMids[0][0], ry], [rcdMids[K.poles - 1][0], ry]);
        s.r([-8, 43], [rxMax + 8, 51]);
        s.a([-8, 47], 4, PI / 2, 1.5 * PI);
        s.a([rxMax + 8, 47], 4, -PI / 2, PI / 2);
        s.d([-12, 47], [-22, 47]); s.d([-22, 47], [-22, ry]);
        s.d([rcdMids[0][0], ry], [-28, ry]);
        s.c([-28, ry], 5);
        s.l([-33, ry], [-23, ry]); s.l([-28, ry - 5], [-28, ry + 5]);
        break;
      }
      case "Breaker1": case "Breaker1N": case "Breaker2": case "Breaker3": case "Breaker3N": {
        var brkHasN = kind === "Breaker1N" || kind === "Breaker3N";
        var brkMids = [];
        for (i = 0; i < K.poles; i++) {
          x = 30 * i;
          var brkNeutral = brkHasN && i === K.poles - 1;
          s.l([x, 0], [x, 10]);
          s.l([x - 3, 7], [x + 3, 13]); s.l([x - 3, 13], [x + 3, 7]);
          var bp0 = [x, 26], bp1 = v.closed ? [x - 1, 9] : [x - 11, 10];
          s.l(bp0, bp1);
          brkMids.push([(bp0[0] + bp1[0]) / 2, (bp0[1] + bp1[1]) / 2]);
          if (brkNeutral) {
            s.l([x, 26], [x, 60]);
          } else {
            s.l([x, 26], [x, 28]);
            s.r([x - 10, 28], [x + 10, 40]);
            s.poly([[x, 28], [x, 32], [x - 4, 32], [x - 4, 36], [x, 36], [x, 40]], false);
            s.r([x - 10, 40], [x + 10, 52]);
            s.text([x, 46], "I>", 7);
            s.l([x, 52], [x, 60]);
          }
          s.term(x, 0, brkNeutral ? "N" : String(2 * i + 1));
          s.term(x, 60, brkNeutral ? "N" : String(2 * i + 2));
        }
        var by = brkMids[0][1];
        if (K.poles > 1) s.d([brkMids[0][0], by], [brkMids[K.poles - 1][0], by]);
        s.d([brkMids[0][0], by], [-24, by]);
        s.c([-28, by], 5);
        s.l([-33, by], [-23, by]); s.l([-28, by - 5], [-28, by + 5]);
        s.d([-10, 34], [-22, 34]); s.d([-10, 46], [-22, 46]);
        s.d([-22, 46], [-22, by]);
        break;
      }
      case "Surge1N": case "Surge3N": {
        var spoles = kind === "Surge3N" ? 4 : 2;
        var spxMax = 30 * (spoles - 1), peX = spoles === 4 ? 45 : 15;
        s.d([-10, 10], [spxMax + 10, 10]);
        s.d([spxMax + 10, 10], [spxMax + 10, 50]);
        s.d([spxMax + 10, 50], [-10, 50]);
        s.d([-10, 50], [-10, 10]);
        for (i = 0; i < spoles; i++) {
          x = 30 * i;
          s.l([x, 0], [x, 18]);
          s.poly([[x - 5, 18], [x + 5, 18], [x, 27]], true, "stroke");
          s.poly([[x - 5, 42], [x + 5, 42], [x, 33]], true, "stroke");
          s.l([x, 42], [x, 46]);
          s.term(x, 0, i === spoles - 1 ? "N" : "L" + (spoles > 2 ? (i + 1) : ""));
        }
        s.l([0, 46], [spxMax, 46]);
        s.l([peX, 46], [peX, 60]);
        s.term(peX, 60, "PE");
        break;
      }
      case "Switch1": case "Switch2": case "Switch3": case "Switch4":
      case "Contactor1": case "Contactor2": case "Contactor3": case "Contactor4": case "Contactor3Arc": {
        var contactor = kind.indexOf("Contactor") === 0, hasArcTri = kind === "Contactor3Arc";
        var mids = [];
        for (i = 0; i < K.poles; i++) {
          x = 30 * i;
          mids.push(contact(s, x, 0, false, !!v.closed, contactor && !hasArcTri, false));
          if (hasArcTri) {
            s.poly([[x, 10], [x - 5, 14], [x, 18]], true, "stroke");
          }
          s.term(x, 0, String(2 * i + 1));
          s.term(x, 60, String(2 * i + 2));
        }
        var y = mids[0][1];
        if (K.poles > 1) s.d([mids[0][0], y], [mids[K.poles - 1][0], y]);
        if (!contactor) {
          actuator(s, [mids[0][0], y], -24, "switch");
        }
        break;
      }
      case "Interlock":
        s.d([-24, 30], [-7, 30]);
        s.d([7, 30], [24, 30]);
        s.poly([[-8, 22], [8, 22], [0, 38]], true, "rgb(255,255,255)");
        break;
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
        if (v.motor) {
          directionArrow(s, v.motor);
          rotorMarks(s, [30, 60], 38, v.angle || 0, v.motor);
          if (kind === "Motor3YD" && v.conn) {
            s.text([30, 86], v.conn === 1 ? "Y" : "Δ", 12);
          }
        }
        break;
      case "Motor3Dahl": {
        // six terminals on top: 1U 1V 1W (low speed, delta) and 2U 2V 2W (high speed, YY)
        var dc = [75, 100], dr = 48;
        ["1U", "1V", "1W", "2U", "2V", "2W"].forEach(function (lab, k) {
          var x6 = 30 * k, ang = PI + (k + 0.5) * PI / 6;
          var q = [dc[0] + dr * Math.cos(ang), dc[1] + dr * Math.sin(ang)];
          s.l([x6, 0], [x6, 25]); s.l([x6, 25], q);
          s.term(x6, 0, lab);
        });
        s.c(dc, dr, v.motor ? MOTOR_RUN_FILL : "rgb(255,255,255)");
        s.text([75, 90], "M", 20); s.text([75, 112], "3~", 11);
        s.text([75, 128], v.conn === 2 ? "▶▶" : v.conn === 1 ? "▶" : "", 9);
        s.l([180, 0], [180, 100]); s.l([180, 100], [123, 100]);
        s.term(180, 0, "PE");
        if (v.motor) rotorMarks(s, dc, 40, v.angle || 0, v.motor);
        break;
      }
      case "Motor1Cap": {
        // main winding U1-U2, auxiliary winding Z1-Z2 with its start capacitor
        var mc = [45, 75];
        [["U1", 0], ["U2", 30], ["Z1", 60], ["Z2", 90]].forEach(function (tp, k) {
          var ang = PI + (k + 0.5) * PI / 4, q = [mc[0] + 32 * Math.cos(ang), mc[1] + 32 * Math.sin(ang)];
          s.l([tp[1], 0], [tp[1], 20]); s.l([tp[1], 20], q);
          s.term(tp[1], 0, tp[0]);
        });
        s.c(mc, 32, v.motor ? "rgb(150,255,150)" : "rgb(255,255,255)");
        s.text([45, 68], "M", 16); s.text([45, 84], "1~", 10);
        s.l([94, 22], [106, 22]); s.l([94, 27], [106, 27]); // capacitor
        s.l([120, 0], [120, 75]); s.l([120, 75], [77, 75]);
        s.term(120, 0, "PE");
        if (v.motor) rotorMarks(s, mc, 37, v.angle || 0, v.motor);
        break;
      }
      case "MotorDC":
        s.l([0, 0], [0, 35]); s.l([30, 0], [30, 35]);
        s.c([15, 55], 24, v.motor ? "rgb(170,200,255)" : "rgb(255,255,255)");
        s.text([15, 50], "M", 16); s.text([15, 66], "═", 10);
        s.term(0, 0, "A1"); s.term(30, 0, "A2");
        if (v.motor) rotorMarks(s, [15, 55], 29, v.angle || 0, v.motor);
        break;
      case "Motor3WR":
        s.l([0, 0], [0, 27]); s.l([30, 0], [30, 15]); s.l([60, 0], [60, 27]);
        s.l([90, 0], [90, 60]); s.l([90, 60], [75, 60]);
        s.c([30, 60], 45, v.motor ? MOTOR_RUN_FILL : "rgb(255,255,255)");
        s.c([30, 60], 33);
        s.text([30, 50], "M", 18); s.text([30, 70], "3~", 11);
        s.l([0, 93], [0, 120]); s.l([30, 105], [30, 120]); s.l([60, 93], [60, 120]);
        s.term(0, 0, "U"); s.term(30, 0, "V"); s.term(60, 0, "W"); s.term(90, 0, "PE");
        s.term(0, 120, "K"); s.term(30, 120, "L"); s.term(60, 120, "M");
        if (v.motor) { directionArrow(s, v.motor); rotorMarks(s, [30, 60], 38, v.angle || 0, v.motor); }
        break;
      case "Motor1":
        s.l([0, 0], [0, 41]); s.l([30, 0], [30, 41]);
        s.c([15, 60], 24, v.motor ? "rgb(150,255,150)" : null);
        s.text([15, 55], "M", 16); s.text([15, 70], "1~", 10);
        s.term(0, 0, "U"); s.term(30, 0, "N");
        if (v.motor) rotorMarks(s, [15, 60], 29, v.angle || 0, v.motor);
        break;
      case "Resistor1": case "Resistor3":
        for (i = 0; i < K.poles; i++) {
          x = 30 * i;
          s.l([x, 0], [x, 12]); s.l([x, 48], [x, 60]);
          s.r([x - 5, 12], [x + 5, 48], "rgb(255,255,255)");
          s.term(x, 0, String(2 * i + 1));
          s.term(x, 60, String(2 * i + 2));
        }
        break;
      case "AutoTrans3":
        for (i = 0; i < 3; i++) {
          x = 30 * i;
          s.l([x, 0], [x, 12]); s.l([x, 48], [x, 60]);
          s.r([x - 4, 12], [x + 4, 48], "stroke");
          s.l([x + 4, 30], [x + 15, 30]);
          s.term(x, 0, String(3 * i + 1));
          s.term(x, 60, String(3 * i + 2));
          s.term(x + 15, 30, String(3 * i + 3));
        }
        break;
      case "SoftStarter3":
        for (i = 0; i < 3; i++) {
          x = 30 * i;
          s.l([x, 0], [x, 10]); s.l([x, 50], [x, 60]);
          s.term(x, 0, String(2 * i + 1));
          s.term(x, 60, String(2 * i + 2));
        }
        s.r([-10, 10], [70, 50], v.closed ? HOT_FILL : "rgb(255,255,255)");
        s.l([30, 15], [30, 45]);
        s.poly([[20, 22], [40, 22], [30, 36]], true, "stroke");
        s.l([20, 36], [40, 36]);
        s.l([20, 31], [25, 36]);
        break;
      case "SoftCtrl": case "SoftRevCtrl":
        s.l([0, 0], [0, 8]); s.l([30, 0], [30, 8]);
        if (kind === "SoftRevCtrl") s.l([15, 0], [15, 8]);
        s.r([-10, 8], [40, 48], v.active ? HOT_FILL : "rgb(255,255,255)");
        s.text([15, 16], "CONT", 9);
        s.l([15, 22], [15, 44]);
        s.poly([[7, 26], [23, 26], [15, 38]], true, "stroke");
        s.l([7, 38], [23, 38]);
        s.l([7, 34], [11, 38]);
        s.prims.push({ t: "line", a: [-6, 54], b: [36, 54], color: "rgb(220,0,0)" });
        s.prims.push({ t: "poly", pts: [[36, 54], [30, 51], [30, 57]], closed: true, fill: "rgb(220,0,0)", color: "rgb(220,0,0)" });
        if (kind === "SoftRevCtrl") {
          s.prims.push({ t: "poly", pts: [[-6, 54], [0, 51], [0, 57]], closed: true, fill: "rgb(220,0,0)", color: "rgb(220,0,0)" });
        }
        s.term(0, 0, "A1");
        if (kind === "SoftRevCtrl") s.term(15, 0, "A3");
        s.term(30, 0, "A2");
        break;
      case "VfdAC2": case "VfdAC3": {
        var vfdTop = kind === "VfdAC3" ? [0, 30, 60] : [15, 45];
        vfdTop.forEach(function (tx, ti) {
          s.l([tx, 0], [tx, 10]);
          s.term(tx, 0, kind === "VfdAC3" ? "L" + (ti + 1) : (ti === 0 ? "L" : "N"));
        });
        [0, 30, 60].forEach(function (bx, bi) {
          s.l([bx, 50], [bx, 60]);
          s.term(bx, 60, ["U", "V", "W"][bi]);
        });
        s.r([-10, 10], [70, 50], v.closed ? HOT_FILL : "rgb(255,255,255)");
        s.l([18, 30], [27, 30]); s.l([27, 20], [27, 40]);
        s.l([27, 25], [40, 17]); s.l([27, 35], [40, 43]);
        s.c([38, 42], 2, "stroke");
        break;
      }
      case "VfdACCtrl":
        [0, 15, 30, 45].forEach(function (tx, ti) {
          s.l([tx, 0], [tx, 10]);
          s.term(tx, 0, "I" + (ti + 1));
        });
        s.r([-8, 10], [53, 50], v.active ? HOT_FILL : "rgb(255,255,255)");
        s.text([22.5, 21], "CONT", 9);
        s.prims.push({ t: "poly", pts: [[10, 38], [16, 31], [22, 38], [28, 45], [35, 38]], closed: false, color: "rgb(220,0,0)" });
        break;
      case "DriveDC2": case "DriveDC2Shunt": case "DriveDC3": case "DriveDC3Shunt": {
        var dc3 = kind.indexOf("DriveDC3") === 0;
        var shunt = kind.indexOf("Shunt") >= 0;
        var dcTop = dc3 ? [0, 30, 60] : [0, 30];
        var boxMaxX = dc3 ? 70 : 40;
        dcTop.forEach(function (tx, ti) {
          s.l([tx, 0], [tx, 10]);
          s.term(tx, 0, dc3 ? "L" + (ti + 1) : (ti === 0 ? "L" : "N"));
        });
        var dcBot = shunt ? (dc3 ? [0, 15, 45, 60] : [-15, 0, 30, 45]) : (dc3 ? [15, 45] : [0, 30]);
        dcBot.forEach(function (bx, bi) {
          s.l([bx, 50], [bx, 60]);
          s.term(bx, 60, ["+", "-", "E+", "E-"][bi]);
        });
        var cx = dc3 ? 30 : 15;
        s.r([shunt && !dc3 ? -20 : -10, 10], [shunt && !dc3 ? 50 : boxMaxX, 50], v.closed ? HOT_FILL : "rgb(255,255,255)");
        s.l([cx - 14, 30], [cx + 14, 30]);
        s.poly([[cx - 6, 21], [cx - 6, 39], [cx + 7, 30]], true, "stroke");
        s.l([cx + 7, 21], [cx + 7, 39]);
        break;
      }
      case "DriveDCCtrl":
        [0, 15, 30, 45].forEach(function (tx, ti) {
          s.l([tx, 0], [tx, 10]);
          s.term(tx, 0, "I" + (ti + 1));
        });
        s.r([-8, 10], [53, 50], v.active ? HOT_FILL : "rgb(255,255,255)");
        s.text([22.5, 21], "CONT", 9);
        s.prims.push({ t: "line", a: [11, 35], b: [34, 35], color: "rgb(220,0,0)" });
        s.prims.push({ t: "dash", a: [11, 41], b: [34, 41], color: "rgb(220,0,0)" });
        break;
      case "StepperCtrl4": case "StepperCtrl2Clk": case "StepperCtrlClkDir": {
        var stTop = kind === "StepperCtrl4" ? [0, 15, 30, 45] : [0, 15, 30];
        stTop.forEach(function (tx, ti) {
          s.l([tx, 0], [tx, 10]);
          s.term(tx, 0, "I" + (ti + 1));
        });
        [0, 15, 30, 45].forEach(function (bx, bi) {
          s.l([bx, 50], [bx, 60]);
          s.term(bx, 60, ["A", "B", "C", "D"][bi]);
        });
        s.r([-8, 10], [53, 50], v.active ? HOT_FILL : "rgb(255,255,255)");
        s.text([22.5, 21], "CONT", 9);
        s.prims.push({
          t: "poly",
          pts: [[6, 42], [11, 42], [11, 35], [18, 35], [18, 42], [25, 42], [25, 35], [32, 35], [32, 42], [38, 42]],
          closed: false,
          color: "rgb(220,0,0)",
        });
        break;
      }
      case "DetIndNO": case "DetIndNC":
      case "DetCapNO": case "DetCapNC":
      case "DetMagNO": case "DetMagNC":
      case "PhotoRecNO": case "PhotoRecNC":
      case "PressNO": case "PressNC":
      case "VacNO": case "VacNC":
      case "ThermoNO": case "ThermoNC": {
        contact(s, 0, 0, K.nc, !!v.closed, false, false);
        s.r([-34, 15], [-10, 45], "rgb(255,255,255)");
        if (kind.indexOf("Det") === 0) {
          s.poly([[-20, 22], [-13, 30], [-20, 38], [-27, 30]], true);
          s.l([-21, 24], [-21, 36]); s.l([-19, 24], [-19, 36]);
          if (kind.indexOf("DetInd") === 0) {
            s.r([-32, 24], [-29, 36], "stroke");
          } else if (kind.indexOf("DetCap") === 0) {
            s.l([-31, 22], [-31, 28]); s.l([-33, 28], [-29, 28]);
            s.l([-33, 32], [-29, 32]); s.l([-31, 32], [-31, 38]);
          } else {
            s.poly([[-32, 24], [-29, 24], [-29, 36], [-32, 36]], false);
          }
        } else if (kind.indexOf("PhotoRec") === 0) {
          s.text([-17, 30], "R", 10);
          s.l([-31, 25], [-25, 29]); s.l([-31, 33], [-25, 37]);
        } else {
          var dLet = kind.indexOf("Press") === 0 ? "P" : kind.indexOf("Vac") === 0 ? "V" : "T";
          s.text([-22, 30], dLet, 12);
        }
        s.term(0, 0, K.nc ? "1" : "3");
        s.term(0, 60, K.nc ? "2" : "4");
        break;
      }
      case "PhotoBarrier":
        s.l([0, 0], [0, 12]); s.l([0, 48], [0, 60]);
        s.r([-15, 12], [15, 48], v.closed ? HOT_FILL : "rgb(255,255,255)");
        s.l([-10, 36], [-4, 22]); s.l([-4, 22], [2, 36]);
        s.text([6, 36], "R", 9);
        s.l([15, 24], [24, 24]); s.poly([[24, 24], [20, 21], [20, 27]], true, "stroke");
        s.l([15, 36], [24, 36]); s.poly([[15, 36], [19, 33], [19, 39]], true, "stroke");
        s.term(0, 0, "1"); s.term(0, 60, "2");
        break;
      case "PhotoEmit":
        s.l([0, 0], [0, 15]); s.l([0, 45], [0, 60]);
        s.r([-18, 15], [12, 45], v.active ? HOT_FILL : "rgb(255,255,255)");
        s.text([-9, 30], "E", 11);
        s.l([3, 21], [3, 39]);
        s.poly([[-1, 26], [7, 26], [3, 34]], true, "stroke");
        s.l([-1, 34], [7, 34]);
        s.term(0, 0, "1"); s.term(0, 60, "2");
        break;
      case "PushBtn":
        s.c([0, 30], 13, "rgb(230,230,230)");
        s.c([0, 30], 9.5, v.btnColor || "rgb(0,180,0)");
        if (v.closed) s.c([0, 30], 5, "rgb(255,255,255)");
        break;
      case "Sel102":
        s.l([0, 0], [0, 18]);
        s.l([-15, 42], [-15, 60]); s.l([-15, 42], [-8, 42]);
        s.l([15, 42], [15, 60]); s.l([15, 42], [8, 42]);
        s.l([0, 46], [0, 52]);
        var s102Tip = v.pos === 1 ? [-12, 42] : v.pos === 2 ? [12, 42] : [0, 43];
        s.l([0, 18], s102Tip);
        actuator(s, [s102Tip[0] / 2, (18 + s102Tip[1]) / 2], -22, "switch");
        s.term(0, 0, "1"); s.term(-15, 60, "2"); s.term(15, 60, "4");
        break;
      case "Sel123":
        s.l([0, 0], [0, 18]);
        s.l([-15, 42], [-15, 60]); s.l([-15, 42], [-8, 42]);
        s.l([0, 44], [0, 60]);
        s.l([15, 42], [15, 60]); s.l([15, 42], [8, 42]);
        var s123Tip = v.pos === 1 ? [0, 44] : v.pos === 2 ? [12, 42] : [-12, 42];
        s.l([0, 18], s123Tip);
        actuator(s, [s123Tip[0] / 2, (18 + s123Tip[1]) / 2], -22, "switch");
        s.term(0, 0, "1"); s.term(-15, 60, "2"); s.term(0, 60, "4"); s.term(15, 60, "6");
        break;
      case "CrossSw":
        s.l([-15, 0], [-15, 18]); s.l([15, 0], [15, 18]);
        s.l([-15, 42], [-15, 60]); s.l([15, 42], [15, 60]);
        if (v.closed) {
          s.l([-15, 18], [-15, 42]);
          s.l([15, 18], [15, 42]);
        } else {
          s.l([-15, 18], [15, 42]);
          s.l([15, 18], [-15, 42]);
        }
        actuator(s, [-6, 30], -25, "switch");
        s.term(-15, 0, "1"); s.term(15, 0, "3");
        s.term(-15, 60, "2"); s.term(15, 60, "4");
        break;
      case "AuxNO": case "AuxNC": case "AuxNONC": case "AuxCO":
      case "TimedOnNO": case "TimedOnNC": case "TimedOnNONC": case "TimedOnCO":
      case "TimedOffNO": case "TimedOffNC": case "TimedOffNONC": case "TimedOffCO":
      case "TimedOnOffNO": case "TimedOnOffNC": case "TimedOnOffNONC": case "TimedOnOffCO":
      case "PushNO": case "PushNC": case "PushNONC": case "PushCO":
      case "MushroomNO": case "MushroomNC": case "MushroomNONC": case "MushroomCO":
      case "SwitchNO": case "SwitchNC": case "SwitchNONC": case "SwitchCO":
      case "LimitNO": case "LimitNC": case "LimitNONC": case "LimitCO":
      case "ThermalNO": case "ThermalNC": case "ThermalNONC": case "ThermalCO": {
        var act = kind.indexOf("TimedOnOff") === 0 ? "timedonoff" :
          kind.indexOf("TimedOn") === 0 ? "timedon" :
          kind.indexOf("TimedOff") === 0 ? "timedoff" :
          kind.indexOf("Push") === 0 ? "push" :
          kind.indexOf("Mushroom") === 0 ? "mushroom" :
          kind.indexOf("Switch") === 0 ? "switch" :
          kind.indexOf("Limit") === 0 ? "limit" :
          kind.indexOf("Thermal") === 0 ? "thermal" : null;
        var isTimed = kind.indexOf("Timed") === 0;
        var isTherm = kind.indexOf("Thermal") === 0;
        if (kind.slice(-4) === "NONC") {
          var m0 = contact(s, 0, 0, true, !v.closed, false, false);
          var m1 = contact(s, 30, 0, false, !!v.closed, false, false);
          s.d(m0, m1);
          actuator(s, m0, -22, act);
          var ncLabs = isTherm ? ["95", "96"] : isTimed ? ["55", "56"] : ["21", "22"];
          var noLabs = isTherm ? ["97", "98"] : isTimed ? ["67", "68"] : ["13", "14"];
          s.term(0, 0, ncLabs[0]); s.term(0, 60, ncLabs[1]);
          s.term(30, 0, noLabs[0]); s.term(30, 60, noLabs[1]);
        } else if (kind.slice(-2) === "CO") {
          var mco = contactCO(s, 0, 0, !!v.closed);
          actuator(s, mco, -22, act);
          var coLabs = isTherm ? ["95", "96", "98"] : isTimed ? ["15", "16", "18"] : ["11", "12", "14"];
          s.term(0, 0, coLabs[0]);
          s.term(-15, 60, coLabs[1]);
          s.term(15, 60, coLabs[2]);
        } else {
          var mid = contact(s, 0, 0, K.nc, !!v.closed, false, false);
          actuator(s, mid, -22, act);
          var lab = { AuxNO: ["13", "14"], AuxNC: ["21", "22"], ThermalNO: ["97", "98"], ThermalNC: ["95", "96"] }[kind]
            || (isTimed ? (K.nc ? ["55", "56"] : ["67", "68"]) : (K.nc ? ["1", "2"] : ["3", "4"]));
          s.term(0, 0, lab[0]); s.term(0, 60, lab[1]);
        }
        break;
      }
      case "LatchCoil":
        s.l([-15, 0], [-15, 20]); s.l([15, 0], [15, 20]);
        s.l([0, 40], [0, 60]);
        s.r([-20, 20], [20, 40], v.active ? HOT_FILL : "rgb(255,255,255)");
        s.poly([[-14, 34], [-10, 26], [-6, 34], [-2, 26], [2, 34], [6, 26], [10, 34], [14, 26]], false);
        s.term(-15, 0, "A1"); s.term(15, 0, "A3"); s.term(0, 60, "A2");
        break;
      case "Coil": case "StepRelay": case "Solenoid":
      case "TimerOn": case "TimerOff": case "TimerOnOff":
      case "Flasher": case "PulseGen": case "TimeSwitch": case "Counter":
        s.l([0, 0], [0, 20]); s.l([0, 40], [0, 60]);
        s.r([-12, 20], [12, 40], v.active ? HOT_FILL : "rgb(255,255,255)");
        if (kind === "StepRelay") {
          s.r([-24, 20], [-12, 40], "rgb(255,255,255)");
          s.poly([[-22, 34], [-18, 34], [-18, 26], [-14, 26]], false);
        }
        if (kind === "Solenoid") {
          s.l([12, 30], [20, 30]);
          s.l([20, 18], [20, 42]);
          s.c([20, 18], 2.5, "rgb(255,255,255)");
          s.c([20, 42], 2.5, "rgb(255,255,255)");
        }
        if (kind === "TimerOn") { s.r([-24, 20], [-12, 40], "rgb(255,255,255)"); s.l([-24, 20], [-12, 40]); s.l([-24, 40], [-12, 20]); }
        if (kind === "TimerOff") s.r([-24, 20], [-12, 40], "stroke");
        if (kind === "TimerOnOff") { s.r([-24, 20], [-12, 30], "stroke"); s.r([-24, 30], [-12, 40], "rgb(255,255,255)"); s.l([-24, 30], [-12, 40]); s.l([-24, 40], [-12, 30]); }
        if (kind === "Flasher") {
          s.poly([[-7, 32], [-2, 28], [3, 32], [7, 28]], false);
          s.poly([[4, 15], [7, 15], [7, 9], [12, 9], [12, 15], [15, 15]], false);
        }
        if (kind === "PulseGen") {
          s.poly([[-8, 34], [-5, 34], [-5, 27], [-1, 27], [-1, 34], [3, 34], [3, 27], [7, 27], [7, 34], [9, 34]], false);
          s.poly([[4, 15], [7, 15], [7, 9], [12, 9], [12, 15], [15, 15]], false);
        }
        if (kind === "TimeSwitch") {
          s.c([0, 30], 7);
          s.l([0, 30], [0, 25]); s.l([0, 30], [4, 30]);
        }
        if (kind === "Counter") {
          s.r([-24, 20], [-12, 40], "rgb(255,255,255)");
          s.r([-20, 26], [-16, 34]);
          // reset input R (energised between R and A2 the count goes back to 0)
          s.l([-30, 0], [-30, 30]); s.l([-30, 30], [-24, 30]);
        }
        s.term(0, 0, "A1"); s.term(0, 60, "A2");
        if (kind === "Counter") s.term(-30, 0, "R");
        break;
      case "Lamp": case "LampFlash":
        s.l([0, 0], [0, 18]); s.l([0, 42], [0, 60]);
        s.c([0, 30], 12, v.lamp || "rgb(255,255,255)");
        s.l([-8.5, 21.5], [8.5, 38.5]); s.l([-8.5, 38.5], [8.5, 21.5]);
        if (kind === "LampFlash") {
          s.poly([[6, 15], [9, 15], [9, 9], [14, 9], [14, 15], [17, 15]], false);
        }
        s.term(0, 0, "X1"); s.term(0, 60, "X2");
        break;
      case "Bell":
        s.l([0, 0], [0, 20]); s.l([0, 20], [5, 20]);
        s.l([0, 40], [0, 60]); s.l([0, 40], [5, 40]);
        s.l([5, 16], [5, 44]);
        s.a([5, 30], 14, -PI / 2, PI / 2);
        if (v.active) s.c([10, 30], 3, HOT_FILL);
        s.term(0, 0, "X1"); s.term(0, 60, "X2");
        break;
      case "Buzzer":
        s.l([0, 0], [0, 20]); s.l([0, 20], [5, 20]);
        s.l([0, 40], [0, 60]); s.l([0, 40], [5, 40]);
        s.poly([[5, 22], [15, 15], [15, 45], [5, 38]], true, v.active ? HOT_FILL : "rgb(255,255,255)");
        s.term(0, 0, "X1"); s.term(0, 60, "X2");
        break;
      case "Siren":
        s.l([0, 0], [0, 20]); s.l([0, 20], [5, 20]);
        s.l([0, 40], [0, 60]); s.l([0, 40], [5, 40]);
        s.poly([[5, 16], [19, 30], [5, 44]], true, v.active ? HOT_FILL : "rgb(255,255,255)");
        s.term(0, 0, "X1"); s.term(0, 60, "X2");
        break;
      case "Horn":
        s.l([0, 0], [0, 22]); s.l([0, 38], [0, 60]);
        s.r([-6, 22], [6, 38], v.active ? HOT_FILL : "rgb(255,255,255)");
        s.poly([[6, 25], [16, 18], [18, 38], [6, 35]], true, v.active ? HOT_FILL : "rgb(255,255,255)");
        s.term(0, 0, "X1"); s.term(0, 60, "X2");
        break;
      case "SsrDC": case "SsrAC":
        s.l([0, 0], [0, 12]); s.l([30, 0], [30, 12]);
        s.l([0, 48], [0, 60]); s.l([30, 48], [30, 60]);
        s.r([-8, 12], [38, 48], v.active ? HOT_FILL : "rgb(255,255,255)");
        s.text([15, 30], "SSR", 11);
        if (kind === "SsrDC") {
          s.prims.push({ t: "line", a: [9, 54], b: [21, 54], color: "rgb(220,0,0)" });
        } else {
          s.prims.push({ t: "poly", pts: [[8, 54], [12, 51], [18, 57], [22, 54]], closed: false, color: "rgb(220,0,0)" });
        }
        s.term(0, 0, "1"); s.term(30, 0, "2");
        s.term(0, 60, kind === "SsrDC" ? "+" : "A1");
        s.term(30, 60, kind === "SsrDC" ? "-" : "A2");
        break;
      case "SsrCont3": case "SsrContRev3": {
        s.r([-10, 12], [70, 48], v.closed ? HOT_FILL : "rgb(255,255,255)");
        for (i = 0; i < 3; i++) {
          x = 30 * i;
          s.l([x, 0], [x, 12]); s.l([x, 48], [x, 60]);
          s.l([x, 12], [x, 20]); s.l([x, 40], [x, 48]);
          s.l([x, 40], v.closed ? [x - 1, 20] : [x - 8, 21]);
          s.term(x, 0, String(2 * i + 1));
          s.term(x, 60, String(2 * i + 2));
        }
        if (kind === "SsrContRev3") {
          s.prims.push({ t: "line", a: [40, 51], b: [50, 58], color: "rgb(220,0,0)" });
          s.prims.push({ t: "line", a: [40, 58], b: [50, 51], color: "rgb(220,0,0)" });
        }
        break;
      }
      case "PhaseLossN": case "PhaseLoss": case "PhaseSeqN": case "PhaseSeq": {
        var phHasN = kind === "PhaseLossN" || kind === "PhaseSeqN";
        var phTxt = kind.indexOf("PhaseLoss") === 0 ? "F" : "S";
        [0, 15, 30].forEach(function (tx, ti) {
          s.l([tx, 0], [tx, 18]);
          s.term(tx, 0, "L" + (ti + 1));
        });
        if (phHasN) {
          s.l([0, 42], [0, 60]);
          s.term(0, 60, "N");
        }
        s.r([-8, 18], [38, 42], v.active ? HOT_FILL : "rgb(255,255,255)");
        s.text([15, 30], phTxt, 12);
        break;
      }
      case "PermOvervolt1N": case "PermOvervolt3N": {
        var ovPoles = K.poles;
        var ovMids = [];
        for (i = 0; i < ovPoles; i++) {
          x = 30 * i;
          var ovNeutral = i === ovPoles - 1;
          var obm = contact(s, x, 0, false, !!v.closed, false, !ovNeutral);
          ovMids.push(obm);
          s.term(x, 0, ovNeutral ? "N" : String(2 * i + 1));
          s.term(x, 60, ovNeutral ? "N" : String(2 * i + 2));
        }
        var ovy = ovMids[0][1], bx0 = 30 * ovPoles;
        s.d([ovMids[0][0], ovy], [bx0 - 12, ovy]);
        s.l([bx0, 0], [bx0, 18]); s.l([bx0, 42], [bx0, 60]);
        s.r([bx0 - 12, 18], [bx0 + 12, 42], "rgb(255,255,255)");
        s.text([bx0, 30], "U", 11);
        break;
      }
      case "CoilContactNO": case "CoilContactCO":
        s.l([0, 0], [0, 20]); s.l([0, 40], [0, 60]);
        s.r([-12, 20], [12, 40], v.active ? HOT_FILL : "rgb(255,255,255)");
        s.term(0, 0, "A1"); s.term(0, 60, "A2");
        if (kind === "CoilContactNO") {
          var cmid = contact(s, 30, 0, false, !!v.active, false, false);
          s.d([12, 30], cmid);
          s.term(30, 0, "13"); s.term(30, 60, "14");
        } else {
          var ccomid = contactCO(s, 45, 0, !!v.active);
          s.d([12, 30], ccomid);
          s.term(45, 0, "11"); s.term(30, 60, "12"); s.term(60, 60, "14");
        }
        break;
      case "LogicAnd": case "LogicOr": case "LogicXor": case "LogicNand": case "LogicNor": {
        lbox(s, -12, 42);
        s.text([30, 15], { LogicAnd: "&", LogicNand: "&", LogicOr: "≥1", LogicNor: "≥1", LogicXor: "=1" }[kind], 12);
        lin(s, 0, "", v, 0); lin(s, 30, "", v, 1);
        lout(s, 15, "", v, 0, kind === "LogicNand" || kind === "LogicNor");
        break;
      }
      case "LogicNot":
        lbox(s, -12, 12);
        s.text([30, 0], "1", 12);
        lin(s, 0, "", v, 0); lout(s, 0, "", v, 0, true);
        break;
      case "LogicSR":
        lbox(s, -12, 42);
        lin(s, 0, "S", v, 0); lin(s, 30, "R", v, 1);
        lout(s, 0, "Q", v, 0); lout(s, 30, "", v, 1, true);
        break;
      case "LogicDiv2":
        lbox(s, -12, 42);
        s.text([30, 15], "÷2", 9);
        lin(s, 0, "C", v, 0); lin(s, 30, "R", v, 1);
        lout(s, 0, "Q", v, 0);
        break;
      case "LogicTon": case "LogicTp": case "LogicTof": case "LogicFlash": case "LogicPulse":
        lbox(s, -15, 15);
        wave(s, {
          LogicTon: [[19, 8], [29, 8], [29, -7], [41, -7]],
          LogicTp: [[19, 8], [23, 8], [23, -7], [33, -7], [33, 8], [41, 8]],
          LogicTof: [[19, -7], [33, -7], [33, 8], [41, 8]],
          LogicFlash: [[19, 8], [19, -7], [25, -7], [25, 8], [31, 8], [31, -7], [37, -7], [37, 8], [41, 8]],
          LogicPulse: [[19, 8], [22, 8], [22, -7], [24, -7], [24, 8], [32, 8], [32, -7], [34, -7], [34, 8], [41, 8]],
        }[kind]);
        lin(s, 0, "", v, 0); lout(s, 0, "", v, 0);
        break;
      case "LogicCnt":
        lbox(s, -12, 42);
        s.text([30, 15], "CTU", 7);
        lin(s, 0, "C", v, 0); lin(s, 30, "R", v, 1);
        lout(s, 0, "Q", v, 0);
        break;
      case "LogicCntUD":
        lbox(s, -12, 72);
        s.text([31, 45], "CTUD", 7);
        lin(s, 0, "+", v, 0); lin(s, 30, "−", v, 1); lin(s, 60, "R", v, 2);
        lout(s, 0, "Q", v, 0);
        break;
      case "LogicCnt4": case "LogicCnt4UD": case "LogicCnt10":
        lbox(s, -12, 102);
        s.text([30, kind === "LogicCnt4UD" ? 112 : 112], kind === "LogicCnt10" ? "BCD" : kind === "LogicCnt4UD" ? "±BIN" : "BIN", 8);
        if (kind === "LogicCnt4UD") { lin(s, 0, "+", v, 0); lin(s, 30, "−", v, 1); lin(s, 60, "R", v, 2); }
        else { lin(s, 0, "C", v, 0); lin(s, 30, "R", v, 1); }
        ["1", "2", "4", "8"].forEach(function (t, i) { lout(s, 30 * i, t, v, i); });
        break;
      case "LogicProbe":
        s.r([0, -12], [30, 12], v.outs && v.outs[0] ? "rgb(255,210,210)" : WHITE);
        s.text([15, 0], v.outs && v.outs[0] ? "1" : "0", 12);
        s.poly([[30, -6], [36, 0], [30, 6]], false);
        s.l([36, 0], [45, 0]);
        if (v.outs) s.col(v.outs[0] ? LOGIC_ON : LOGIC_OFF);
        s.term(45, 0, "", [1, 0]);
        break;
      case "LogicView":
        s.l([0, 0], [9, 0]);
        if (v.ins) s.col(v.ins[0] ? LOGIC_ON : LOGIC_OFF);
        s.poly([[15, -6], [9, 0], [15, 6]], false);
        s.r([15, -12], [45, 12], v.ins && v.ins[0] ? "rgb(255,210,210)" : WHITE);
        s.text([30, 0], v.ins && v.ins[0] ? "1" : "0", 12);
        s.term(0, 0, "", [-1, 0]);
        break;
      case "Logic7Dec":
        lbox(s, -12, 102);
        s.text([30, 112], "BCD/7", 7);
        ["1", "2", "4", "8"].forEach(function (t, i) { lin(s, 30 * i, t, v, i); });
        "abcdefg".split("").forEach(function (t, i) { lout(s, 15 * i, t, v, i); });
        break;
      case "Logic7Seg": case "Logic7SegDp": {
        var nseg = kind === "Logic7SegDp" ? 8 : 7, ON7 = "rgb(255,40,40)", OFF7 = "rgb(75,75,75)";
        s.r([15, -12], [75, 15 * nseg + 3], "rgb(35,35,35)");
        "abcdefgp".slice(0, nseg).split("").forEach(function (t, i) {
          s.l([0, 15 * i], [15, 15 * i]);
          if (v.ins) s.col(v.ins[i] ? LOGIC_ON : LOGIC_OFF);
          s.text([20, 15 * i], t === "p" ? "dp" : t, 6); s.col("rgb(200,200,200)");
          s.term(0, 15 * i, "", [-1, 0]);
        });
        var X0 = 38, X1 = 60, Y0 = 8, Ym = 43, Y1 = 78;
        var segs = [
          [[X0 + 2, Y0 - 2], [X1 - 2, Y0 + 2]], [[X1 - 2, Y0 + 2], [X1 + 2, Ym - 2]], [[X1 - 2, Ym + 2], [X1 + 2, Y1 - 2]],
          [[X0 + 2, Y1 - 2], [X1 - 2, Y1 + 2]], [[X0 - 2, Ym + 2], [X0 + 2, Y1 - 2]], [[X0 - 2, Y0 + 2], [X0 + 2, Ym - 2]],
          [[X0 + 2, Ym - 2], [X1 - 2, Ym + 2]],
        ];
        segs.forEach(function (sg, i) { var c = v.ins && v.ins[i] ? ON7 : OFF7; s.r(sg[0], sg[1], c); s.col(c); });
        if (nseg === 8) { var cdp = v.ins && v.ins[7] ? ON7 : OFF7; s.c([X1 + 7, Y1], 2.5, cdp); s.col(cdp); }
        break;
      }
      case "LogicPreset":
        lbox(s, -12, 102);
        s.r([19, 25], [36, 65], "rgb(255,255,220)");
        s.text([27.5, 45], String(v.val || 0), 18);
        s.text([27.5, 15], "▲", 7); s.text([27.5, 75], "BCD", 6);
        ["1", "2", "4", "8"].forEach(function (t, i) { lout(s, 30 * i, t, v, i); });
        break;
      case "LogicWire":
        s.l([0, 15], [30, 15]); s.col(LOGIC_ON);
        s.text([15, 4], "+", 9); s.col(LOGIC_ON);
        break;
      case "LogicJunction":
        s.l([-15, 0], [15, 0]); s.col(LOGIC_ON);
        s.l([0, -15], [0, 15]); s.col(LOGIC_ON);
        s.c([0, 0], 4.5, "#1a1a1a");
        break;
      case "Continuation":
        // continuation arrow: joins every marker with the same name (also across sheets)
        s.l([0, 0], [0, 12]);
        s.poly([[-10, 12], [10, 12], [10, 30], [0, 40], [-10, 30]], true, "rgb(255,255,255)");
        s.l([-5, 22], [0, 28]); s.l([0, 28], [5, 22]);
        s.term(0, 0, "");
        break;
      case "Wire":
        s.l([0, 3], [0, 27]); s.l([0, 27], [24, 27]);
        s.c([0, 3], 3, "rgb(220,53,69)");
        s.c([24, 27], 3, "rgb(220,53,69)");
        break;
      case "Junction":
        s.l([-15, 0], [15, 0]);
        s.l([0, -15], [0, 15]);
        s.c([0, 0], 4.5, "#1a1a1a");
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

  /** Indices of a logic element's input and output terminals (by pin direction). */
  var ioCache = {};
  SL.logicIO = function (kind) {
    if (ioCache[kind]) return ioCache[kind];
    var sym = baseSym(kind), io = { ins: [], outs: [] };
    sym.tdirs.forEach(function (d, i) { if (d) (d[0] < 0 ? io.ins : io.outs).push(i); });
    return (ioCache[kind] = io);
  };

  // The rest geometry of a symbol (terminals, bounding box) depends only on its kind:
  // build it once instead of on every mouse move and simulation step.
  var baseCache = {}, bboxCache = {};
  function baseSym(kind) { return baseCache[kind] || (baseCache[kind] = SL.buildSymbol(kind, {})); }
  SL.baseSymbol = baseSym;

  /** World-space terminals of a component. */
  SL.terminals = function (c) {
    var sym = baseSym(c.kind);
    return sym.terms.map(function (t) {
      var p = SL.xform(t, c.rot, c.mirror);
      return [Math.round(p[0]) + c.x, Math.round(p[1]) + c.y];
    });
  };

  /** World-space terminals with outward unit vector: [{pos:[x,y], dir:[dx,dy]}]. */
  SL.terminalsWithDir = function (c) {
    var sym = baseSym(c.kind);
    return sym.terms.map(function (t, i) {
      var p = SL.xform(t, c.rot, c.mirror);
      var localDir = sym.tdirs[i] ? sym.tdirs[i] : t[1] === 0 ? [0, -1] : (t[1] === 30 && t[0] < 0) ? [-1, 0] : (t[1] === 30 && t[0] > 0 && c.kind === "Rectifier") ? [1, 0] : [0, 1];
      var d = SL.xform(localDir, c.rot, c.mirror);
      return {
        pos: [Math.round(p[0]) + c.x, Math.round(p[1]) + c.y],
        dir: [Math.round(d[0]), Math.round(d[1])],
      };
    });
  };

  /** World-space bounding box {x0,y0,x1,y1}. */
  SL.compRect = function (c) {
    var bb = bboxCache[c.kind] || (bboxCache[c.kind] = SL.symBBox(baseSym(c.kind)));
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

  /** Interior body obstacle box (shrunk slightly from terminals so terminal leads can exit). */
  SL.compObstacleRect = function (c) {
    var r = SL.compRect(c);
    return { x0: r.x0 + 2, y0: r.y0 + 2, x1: r.x1 - 2, y1: r.y1 - 2 };
  };
})((typeof globalThis !== "undefined" ? globalThis : window).SL);
