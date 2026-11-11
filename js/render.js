// SimuLAB — drawing the page, wires and symbols on a 2D canvas.
"use strict";
(function (SL) {
  var P = SL.POT;
  SL.COLORS = {
    RED: "rgb(255,0,0)",      // active element (0xb80824)
    GRAY: "rgb(128,128,128)", // inactive element in simulation (0xb80808)
    MAROON: "rgb(128,0,0)",   // L / L1 (0xb80810)
    BLUE: "rgb(0,0,255)",     // N (0xb80814)
    GREEN: "rgb(0,128,0)",    // PE (0xb8081c)
    SEL: "rgb(0,90,255)",
  };
  var C = SL.COLORS;

  SL.potColor = function (m) {
    switch (m) {
      case P.L1: return C.MAROON;
      case P.L2: return "rgb(140,70,0)";   // estimated
      case P.L3: return "rgb(255,128,0)";  // estimated
      case P.N: return C.BLUE;
      case P.PE: return C.GREEN;
      case P.POS: return C.RED;            // estimated
      case P.NEG: return "rgb(0,0,160)";   // estimated
    }
    return null;
  };

  function R(g, view) { this.g = g; this.v = view; }
  R.prototype.s = function (p) { return [this.v.panX + p[0] * this.v.zoom, this.v.panY + p[1] * this.v.zoom]; };
  R.prototype.w = function (w) { return Math.min(4, Math.max(1, w * this.v.zoom * 1.2)); };
  SL.Renderer = R;

  function rgb(a) { return "rgb(" + a[0] + "," + a[1] + "," + a[2] + ")"; }
  SL.rgb = rgb;

  R.prototype.text = function (p, s, size, color, align, base) {
    var g = this.g;
    g.fillStyle = color;
    g.font = Math.max(4, size) + "px 'Segoe UI', Helvetica, Arial, sans-serif";
    g.textAlign = align || "center";
    g.textBaseline = base || "middle";
    String(s).split("\n").forEach(function (line, i) { g.fillText(line, p[0], p[1] + i * size * 1.1); });
  };

  R.prototype.page = function (doc, grid) {
    var g = this.g, ps = SL.PAGE_SIZES[doc.page.size] || SL.PAGE_SIZES.A4Horizontal, W = ps.w, H = ps.h, self = this;
    var a = this.s([0, 0]), b = this.s([W, H]);
    g.fillStyle = "rgb(70,70,70)"; g.fillRect(a[0] + 4, a[1] + 4, b[0] - a[0], b[1] - a[1]);
    g.fillStyle = "#fff"; g.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
    if (grid && SL.GRID * this.v.zoom >= 5) {
      g.fillStyle = "rgb(185,185,185)";
      var cw = g.canvas.width, ch = g.canvas.height;
      for (var y = 0; y <= H; y += SL.GRID) {
        var sy = this.s([0, y])[1];
        if (sy < -2 || sy > ch + 2) continue;
        for (var x = 0; x <= W; x += SL.GRID) {
          var sx = this.s([x, 0])[0];
          if (sx >= 0 && sx <= cw) g.fillRect(sx - 0.5, sy - 0.5, 1, 1);
        }
      }
    }
    g.strokeStyle = "#000"; g.lineWidth = this.w(1);
    var inset = 25, fs = Math.max(5, 12 * this.v.zoom);
    function line(p, q) { var s1 = self.s(p), s2 = self.s(q); g.beginPath(); g.moveTo(s1[0], s1[1]); g.lineTo(s2[0], s2[1]); g.stroke(); }
    function rect(p, q) { var s1 = self.s(p), s2 = self.s(q); g.strokeRect(s1[0], s1[1], s2[0] - s1[0], s2[1] - s1[1]); }
    if (doc.page.border) {
      rect([inset, inset], [W - inset, H - inset]);
      if (doc.page.references) {
        var band = 25, top = inset + band;
        line([inset, top], [W - inset, top]);
        var ncol = Math.max(1, Math.round((W - 2 * inset) / 180)), cwid = (W - 2 * inset) / ncol;
        for (var i = 0; i < ncol; i++) {
          var x0 = inset + cwid * i;
          if (i > 0) line([x0, inset], [x0, top]);
          this.text(this.s([x0 + cwid / 2, inset + band / 2]), String(i + 1), fs, "#000");
        }
      }
    }
    if (doc.page.title_block) {
      var bw = 600, bh = 150, X0 = W - inset - bw, Y0 = H - inset - bh, rh = bh / 3, col1 = X0 + 110, col2 = X0 + 260;
      var tf = Math.max(5, 11 * this.v.zoom), t = doc.title;
      rect([X0, Y0], [W - inset, H - inset]);
      line([col1, Y0], [col1, Y0 + bh]); line([col2, Y0], [col2, Y0 + bh]);
      [["Dibuixat", t.drawn], ["Comprovat", t.checked], ["Data", t.date]].forEach(function (r, i) {
        var y = Y0 + rh * i;
        if (i > 0) line([X0, y], [col2, y]);
        self.text(self.s([X0 + 6, y + rh / 2]), r[0], tf, "#000", "left");
        self.text(self.s([col1 + 6, y + rh / 2]), r[1] || "", tf, "#000", "left");
      });
      var ym = Y0 + bh / 2;
      line([col2, ym], [W - inset, ym]);
      this.text(this.s([col2 + 6, Y0 + 14]), "Entitat", tf * 0.8, "#555", "left");
      this.text(this.s([col2 + 6, Y0 + 45]), t.entity || "", tf * 1.2, "#000", "left");
      this.text(this.s([col2 + 6, ym + 14]), "Títol", tf * 0.8, "#555", "left");
      this.text(this.s([col2 + 6, ym + 45]), t.title || "", tf * 1.4, "#000", "left");
      this.text(this.s([W - inset - 8, ym + 14]), "Núm. " + (t.number || ""), tf, "#000", "right");
    }
  };

  R.prototype.drawing = function (d, sel) {
    var g = this.g, a = this.s(d.a), b = this.s(d.b);
    g.strokeStyle = sel ? C.SEL : rgb(d.color); g.lineWidth = this.w(d.width || 1);
    g.fillStyle = rgb(d.fill || [255, 255, 200]);
    var x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]), w = Math.abs(a[0] - b[0]), h = Math.abs(a[1] - b[1]);
    g.beginPath();
    if (d.kind === "Line") { g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); return; }
    if (d.kind === "Rect" || d.kind === "FilledRect") g.rect(x, y, w, h);
    else g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI);
    if (d.kind === "FilledRect" || d.kind === "FilledEllipse") g.fill();
    g.stroke();
  };

  R.prototype.textItem = function (t, sel) {
    this.text(this.s([t.x, t.y]), t.text, Math.max(4, t.size * this.v.zoom), sel ? C.SEL : rgb(t.color || [0, 0, 0]), "left", "top");
  };

  SL.textRect = function (g, t, view) {
    var size = Math.max(4, t.size * view.zoom);
    g.font = size + "px 'Segoe UI', Helvetica, Arial, sans-serif";
    var w = g.measureText(t.text).width / view.zoom;
    return { x0: t.x, y0: t.y, x1: t.x + w, y1: t.y + t.size * 1.2 };
  };

  R.prototype.wire = function (w, color) {
    var g = this.g, a = this.s(w.a), b = this.s(w.b);
    g.strokeStyle = color; g.lineWidth = this.w(1.3);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  };

  R.prototype.dot = function (p, color) {
    var g = this.g, s = this.s(p);
    g.fillStyle = color; g.beginPath(); g.arc(s[0], s[1], Math.max(2, 2.6 * this.v.zoom), 0, 2 * Math.PI); g.fill();
  };

  /** Draw a component; returns its screen box {x0,y0,x1,y1}. */
  R.prototype.comp = function (c, vis, color, showTerms, extra) {
    var g = this.g, self = this, sym = SL.buildSymbol(c.kind, vis);
    function tr(p) { var q = SL.xform(p, c.rot, c.mirror); return self.s([q[0] + c.x, q[1] + c.y]); }
    var lw = this.w(1.2);
    g.lineJoin = "round"; g.lineCap = "round";
    sym.prims.forEach(function (pr) {
      var col = pr.color || color, a, b, pts;
      g.strokeStyle = col; g.lineWidth = lw; g.setLineDash([]);
      switch (pr.t) {
        case "line": a = tr(pr.a); b = tr(pr.b); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); break;
        case "dash":
          a = tr(pr.a); b = tr(pr.b);
          var dl = Math.max(2, 4 * self.v.zoom);
          g.setLineDash([dl, dl]); g.lineWidth = Math.max(1, lw * 0.8);
          g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]);
          break;
        case "circle":
          a = tr(pr.c); g.beginPath(); g.arc(a[0], a[1], pr.r * self.v.zoom, 0, 2 * Math.PI);
          if (pr.fill) { g.fillStyle = pr.fill; g.fill(); }
          g.stroke(); break;
        case "rect":
          pts = [tr(pr.a), tr([pr.b[0], pr.a[1]]), tr(pr.b), tr([pr.a[0], pr.b[1]])];
          g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(function (p) { g.lineTo(p[0], p[1]); }); g.closePath();
          if (pr.fill) { g.fillStyle = pr.fill === "stroke" ? col : pr.fill; g.fill(); }
          g.stroke(); break;
        case "arc":
          g.beginPath();
          for (var i = 0; i <= 16; i++) {
            var t = pr.a0 + (pr.a1 - pr.a0) * i / 16, p = tr([pr.c[0] + pr.r * Math.cos(t), pr.c[1] + pr.r * Math.sin(t)]);
            if (i === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]);
          }
          g.stroke(); break;
        case "poly":
          pts = pr.pts.map(tr);
          g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(function (p) { g.lineTo(p[0], p[1]); });
          if (pr.closed) g.closePath();
          if (pr.fill) { g.fillStyle = pr.fill === "stroke" ? col : pr.fill; g.fill(); }
          g.stroke(); break;
        case "text": self.text(tr(pr.p), pr.s, Math.max(4, pr.size * self.v.zoom), col); break;
      }
    });
    var bb = SL.symBBox(sym);
    var corners = [bb[0], bb[1], [bb[0][0], bb[1][1]], [bb[1][0], bb[0][1]]].map(tr);
    var box = {
      x0: Math.min.apply(null, corners.map(function (p) { return p[0]; })),
      y0: Math.min.apply(null, corners.map(function (p) { return p[1]; })),
      x1: Math.max.apply(null, corners.map(function (p) { return p[0]; })),
      y1: Math.max.apply(null, corners.map(function (p) { return p[1]; })),
    };
    if (showTerms) {
      var fs = Math.max(4, 8 * this.v.zoom), midY = (bb[0][1] + bb[1][1]) / 2;
      if (fs >= 5) sym.terms.forEach(function (t, i) {
        var lab = sym.tlabels[i];
        if (!lab) return;
        self.text(tr([t[0] + 4, t[1] + (t[1] < midY ? 6 : -6)]), lab, fs, "rgb(0,0,128)", "left");
      });
    }
    if (c.name) {
      var label = c.func ? c.name + "\n" + c.func : c.name;
      this.text([box.x0 - 4, (box.y0 + box.y1) / 2], label, Math.max(5, 11 * this.v.zoom), "#000", "right");
    }
    if (extra) this.text([box.x1 + 3, (box.y0 + box.y1) / 2], extra, Math.max(5, 9 * this.v.zoom), "rgb(0,0,160)", "left");
    return box;
  };

  /** Draw a symbol fitted into a small canvas (toolbar icons). */
  SL.drawIcon = function (canvas, kind, color) {
    var g = canvas.getContext("2d"), dpr = Math.max(2, window.devicePixelRatio || 1);
    var w = canvas.clientWidth || canvas.width || 32, h = canvas.clientHeight || canvas.height || 32;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    var sym = SL.buildSymbol(kind, {}), bb = SL.symBBox(sym);
    var sw = Math.max(1, bb[1][0] - bb[0][0]), sh = Math.max(1, bb[1][1] - bb[0][1]);
    var zoom = Math.min((w - 6) / sw, (h - 6) / sh);
    var cx = (bb[0][0] + bb[1][0]) / 2, cy = (bb[0][1] + bb[1][1]) / 2;
    var r = new R(g, { zoom: zoom, panX: w / 2 - cx * zoom, panY: h / 2 - cy * zoom });
    r.w = function (lw) { return Math.min(2.2, Math.max(1.35, lw * this.v.zoom * 1.5)); };
    r.comp({ id: 0, kind: kind, x: 0, y: 0, rot: 0, mirror: false, name: "" }, {}, color || "#1a1a1a", false, null);
  };
})((typeof globalThis !== "undefined" ? globalThis : window).SL);
