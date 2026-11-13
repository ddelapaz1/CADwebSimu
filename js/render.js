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
      case P.LV: return "rgb(170,0,170)";  // 24 V AC
      case P.LVN: return "rgb(110,90,200)"; // 24 V AC common
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

  /** Draw every sheet of the document (stacked vertically). */
  R.prototype.page = function (doc, grid) {
    var n = SL.sheetCount(doc), v = this.v;
    for (var k = 0; k < n; k++) {
      this.v = Object.assign({}, v, { panY: v.panY + SL.sheetY(doc, k) * v.zoom });
      this.sheet(doc, grid, k, n);
    }
    this.v = v;
  };

  R.prototype.sheet = function (doc, grid, sheetNo, sheets) {
    var g = this.g, ps = SL.PAGE_SIZES[doc.page.size] || SL.PAGE_SIZES.A4Horizontal, W = ps.w, H = ps.h, self = this;
    var a = this.s([0, 0]), b = this.s([W, H]);
    g.fillStyle = "rgb(70,70,70)"; g.fillRect(a[0] + 4, a[1] + 4, b[0] - a[0], b[1] - a[1]);
    g.fillStyle = "#fff"; g.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
    // adaptive grid: fine dots when there is room, a stronger dot every 5 cells
    var cell = SL.GRID * this.v.zoom;
    if (grid && cell * 5 >= 9) {
      var cw = g.canvas.width, ch = g.canvas.height, fine = cell >= 6, step = fine ? SL.GRID : SL.GRID * 5;
      for (var y = 0; y <= H; y += step) {
        var sy = this.s([0, y])[1];
        if (sy < -2 || sy > ch + 2) continue;
        for (var x = 0; x <= W; x += step) {
          var sx = this.s([x, 0])[0];
          if (sx < 0 || sx > cw) continue;
          var major = (x / SL.GRID) % 5 === 0 && (y / SL.GRID) % 5 === 0;
          if (major) { g.fillStyle = "rgb(150,156,166)"; g.fillRect(sx - 0.9, sy - 0.9, 1.8, 1.8); }
          else { g.fillStyle = "rgb(200,204,210)"; g.fillRect(sx - 0.5, sy - 0.5, 1, 1); }
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
      if (sheets > 1) this.text(this.s([W - inset - 8, Y0 + 14]), "Full " + (sheetNo + 1) + " / " + sheets, tf, "#000", "right");
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

  R.prototype.wire = function (w, color, width) {
    var g = this.g, a = this.s(w.a), b = this.s(w.b);
    g.strokeStyle = color; g.lineWidth = this.w(width || 1.3);
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
    if (vis.halo && g.createRadialGradient) {
      // glow of a lit pilot light or an energised coil
      var hc = tr(vis.halo.c), hr = vis.halo.r * this.v.zoom, grd = g.createRadialGradient(hc[0], hc[1], hr * 0.2, hc[0], hc[1], hr);
      grd.addColorStop(0, vis.halo.color); grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd; g.beginPath(); g.arc(hc[0], hc[1], hr, 0, 2 * Math.PI); g.fill();
    }
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
    var tds = SL.terminalsWithDir(c);
    if (showTerms) {
      var fs = Math.max(4, 8 * this.v.zoom), midY = (bb[0][1] + bb[1][1]) / 2;
      if (fs >= 5) sym.terms.forEach(function (t, i) {
        var lab = sym.tlabels[i], td = tds[i];
        if (!lab) return;
        if (td && td.dir[0] && !td.dir[1]) {
          // terminal leaving sideways: number above the conductor, just inside the symbol
          self.text(self.s([td.pos[0] - td.dir[0] * 9, td.pos[1] - 6]), lab, fs, "rgb(0,0,128)", "center");
        } else self.text(tr([t[0] + 4, t[1] + (t[1] < midY ? 6 : -6)]), lab, fs, "rgb(0,0,128)", "left");
      });
    }
    var lp = SL.labelPlace(c);
    if (c.name) {
      var label = c.func ? c.name + "\n" + c.func : c.name, lfs = Math.max(5, 11 * this.v.zoom);
      var lsp = this.s(lp.name.p);
      if (lp.name.base === "bottom" && c.func) lsp[1] -= lfs * 1.1; // keep both lines above the symbol
      this.text(lsp, label, lfs, "#000", lp.name.align, lp.name.base);
    }
    if (extra) this.text(this.s(lp.extra.p), extra, Math.max(5, 9 * this.v.zoom), "rgb(0,0,160)", lp.extra.align, lp.extra.base);
    return box;
  };

  /**
   * Page column (1..n, as numbered in the reference band) of a world point,
   * prefixed by the sheet number when the schematic has several sheets ("2.3").
   */
  SL.colRef = function (doc, p) {
    var ps = SL.PAGE_SIZES[doc.page.size] || SL.PAGE_SIZES.A4Horizontal, inset = 25;
    var ncol = Math.max(1, Math.round((ps.w - 2 * inset) / 180)), cwid = (ps.w - 2 * inset) / ncol;
    var col = Math.min(ncol, Math.max(1, Math.floor((p[0] - inset) / cwid) + 1));
    if (SL.sheetCount(doc) > 1) {
      var sheet = SL.sheetOf(doc, p);
      return sheet + "." + col;
    }
    return String(col);
  };

  /** Cross-reference lines for a coil: its contacts and poles with their terminals and column. */
  SL.crossRefs = function (doc, coil) {
    var out = [];
    doc.comps.forEach(function (c) {
      var K = SL.KINDS[c.kind];
      if (c === coil || c.name !== coil.name || (K.role !== "Contact" && K.role !== "Poles")) return;
      var tl = SL.baseSymbol(c.kind).tlabels, txt;
      if (/CO$/.test(c.kind) && tl.length === 3) txt = tl[0] + "-" + tl[1] + "/" + tl[2];
      else {
        var pairs = [];
        for (var i = 0; i + 1 < tl.length; i += 2) pairs.push(tl[i] + "-" + tl[i + 1]);
        txt = K.role === "Poles" && !/^\d/.test(tl[0] || "") ? "potència" : pairs.join(" ");
      }
      var r = SL.compRect(c);
      out.push({ text: txt + " /" + SL.colRef(doc, [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2]), poles: K.role === "Poles", y: r.y0, x: r.x0 });
    });
    // power poles first, then contacts in reading order
    out.sort(function (a, b) { return (b.poles - a.poles) || (a.x - b.x) || (a.y - b.y); });
    return out.map(function (o) { return o.text; });
  };

  /** Rounded rectangle path in screen coordinates. */
  SL.roundRect = function (g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    g.lineTo(x + w, y + h - r); g.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    g.lineTo(x + r, y + h); g.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    g.lineTo(x, y + r); g.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI); g.closePath();
  };

  // Elements whose conductors are power wiring (drawn thicker): contactor poles, motors,
  // three-phase feeds and multi-pole protections.
  function isPowerKind(kind) {
    var K = SL.KINDS[kind];
    return K.role === "Poles" || K.motor || /^FeedL123/.test(kind) ||
      ((K.role === "Manual" || K.role === "Passive" || K.role === "Converter") && K.poles >= 3) || /3$/.test(kind) && /^(Transformer|PowerSupply|Resistor|AutoTrans)/.test(kind);
  }
  SL.isPowerKind = isPowerKind;

  /**
   * Per conductor: power or control, and its net number (nets numbered in
   * reading order: left to right, then top to bottom). Cached per topology.
   */
  var classCache = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  SL.wireInfo = function (doc) {
    var topo = SL.topoFor(doc), hit = classCache && classCache.get(topo);
    if (hit) return hit;
    var key = function (p) { return p[0] + "," + p[1]; }, powerRoots = {}, nets = {}, order = [];
    doc.comps.forEach(function (c) {
      if (!isPowerKind(c.kind)) return;
      SL.terminals(c).forEach(function (p) { var i = topo.idx[key(p)]; if (i != null) powerRoots[topo.base[i]] = true; });
    });
    doc.wires.forEach(function (w) {
      var n = topo.wireNode[w.id];
      if (n == null) return;
      var root = topo.base[n];
      if (!nets[root]) { nets[root] = { wires: [], x: Infinity, y: Infinity }; order.push(root); }
      var net = nets[root];
      net.wires.push(w);
      net.x = Math.min(net.x, w.a[0], w.b[0]); net.y = Math.min(net.y, w.a[1], w.b[1]);
    });
    order.sort(function (a, b) {
      var A = nets[a], B = nets[b], sa = SL.sheetOf(doc, [A.x, A.y]), sb = SL.sheetOf(doc, [B.x, B.y]);
      return (sa - sb) || (A.x - B.x) || (A.y - B.y);
    });
    var info = { power: {}, num: {}, label: {}, nets: [] };
    order.forEach(function (root, i) {
      var net = nets[root], longest = null, best = -1;
      net.wires.forEach(function (w) {
        info.num[w.id] = i + 1;
        if (powerRoots[root]) info.power[w.id] = true;
        var len = Math.abs(w.a[0] - w.b[0]) + Math.abs(w.a[1] - w.b[1]);
        if (len > best) { best = len; longest = w; }
      });
      info.label[longest.id] = i + 1; // the number is written once, on the longest stretch
      info.nets.push({ num: i + 1, root: root });
    });
    if (classCache) classCache.set(topo, info);
    return info;
  };

  /** True when the element's terminals leave sideways (a horizontal element): labels go above/below. */
  SL.isHorizontal = function (c) {
    return SL.terminalsWithDir(c).some(function (td) { return td.dir[0] !== 0; });
  };

  /**
   * Where the name and the extra text (times, counts) go, in world units, so they
   * never sit on a conductor: left of vertical elements, above horizontal ones.
   * c.lx / c.ly move the name (dragged by the user).
   */
  SL.labelPlace = function (c) {
    var r = SL.compRect(c), lx = c.lx || 0, ly = c.ly || 0;
    if (SL.isHorizontal(c)) {
      return {
        name: { p: [(r.x0 + r.x1) / 2 + lx, r.y0 - 3 + ly], align: "center", base: "bottom" },
        extra: { p: [(r.x0 + r.x1) / 2, r.y1 + 3], align: "center", base: "top" },
      };
    }
    return {
      name: { p: [r.x0 - 4 + lx, (r.y0 + r.y1) / 2 + ly], align: "right", base: "middle" },
      extra: { p: [r.x1 + 3, (r.y0 + r.y1) / 2], align: "left", base: "middle" },
    };
  };

  /** Approximate world rectangle of the name label (for clicking and dragging it). */
  SL.labelRect = function (c) {
    if (!c.name) return null;
    var lp = SL.labelPlace(c).name, lines = c.func ? 2 : 1;
    var w = Math.max(c.name.length, (c.func || "").length) * 6.6, h = 12 * lines;
    var x0 = lp.align === "right" ? lp.p[0] - w : lp.align === "center" ? lp.p[0] - w / 2 : lp.p[0];
    var y0 = lp.base === "bottom" ? lp.p[1] - h : lp.base === "top" ? lp.p[1] : lp.p[1] - h / 2;
    return { x0: x0, y0: y0, x1: x0 + w, y1: y0 + h };
  };

  /** Draw a symbol fitted into a small canvas (toolbar icons). */
  SL.drawIcon = function (canvas, kind, color) {
    var g = canvas.getContext("2d"), dpr = Math.max(2, window.devicePixelRatio || 1);
    var w = canvas.clientWidth || canvas.width || 32, h = canvas.clientHeight || canvas.height || 32;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    var sym = SL.baseSymbol(kind), bb = SL.symBBox(sym);
    var sw = Math.max(1, bb[1][0] - bb[0][0]), sh = Math.max(1, bb[1][1] - bb[0][1]);
    var zoom = Math.min((w - 6) / sw, (h - 6) / sh);
    var cx = (bb[0][0] + bb[1][0]) / 2, cy = (bb[0][1] + bb[1][1]) / 2;
    var r = new R(g, { zoom: zoom, panX: w / 2 - cx * zoom, panY: h / 2 - cy * zoom });
    r.w = function (lw) { return Math.min(2.2, Math.max(1.35, lw * this.v.zoom * 1.5)); };
    r.comp({ id: 0, kind: kind, x: 0, y: 0, rot: 0, mirror: false, name: "" }, {}, color || "#1a1a1a", false, null);
  };
})((typeof globalThis !== "undefined" ? globalThis : window).SL);
