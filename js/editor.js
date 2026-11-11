// SimuLAB — drawing area: painting the document with its simulation state,
// and mouse input for editing (place, wire, select, move, draw) and for
// operating push buttons and switches during simulation.
"use strict";
(function (SL) {
  var A = SL.app, C = SL.COLORS;
  function key(p) { return p[0] + "," + p[1]; }

  /** Paint a tab's document. opts: {grid, sel:Set, dx, dy} */
  SL.drawDoc = function (r, t, opts) {
    var doc = t.doc, sim = t.mode !== "edit" && t.sim, sel = opts.sel, dx = opts.dx || 0, dy = opts.dy || 0;
    r.page(doc, opts.grid);
    function shifted(o, f) { return sel.has(o.id) && (dx || dy) ? f(JSON.parse(JSON.stringify(o))) : o; }
    doc.drawings.forEach(function (d) {
      r.drawing(shifted(d, function (o) { o.a = [o.a[0] + dx, o.a[1] + dy]; o.b = [o.b[0] + dx, o.b[1] + dy]; return o; }), sel.has(d.id));
    });
    function wireColor(p) { return (sim && SL.potColor(sim.pot[key(p)])) || "#000"; }
    var ends = {};
    doc.wires.forEach(function (w) {
      var col = sel.has(w.id) ? C.SEL : wireColor(w.a);
      r.wire(shifted(w, function (o) { o.a = [o.a[0] + dx, o.a[1] + dy]; o.b = [o.b[0] + dx, o.b[1] + dy]; return o; }), col);
      ends[key(w.a)] = (ends[key(w.a)] || 0) + 1;
      ends[key(w.b)] = (ends[key(w.b)] || 0) + 1;
    });
    Object.keys(ends).forEach(function (k) {
      var p = k.split(",").map(Number);
      var tee = doc.wires.some(function (w) { return SL.wireInterior(w, p); });
      if (ends[k] >= 3 || tee) r.dot(p, wireColor(p));
    });
    var drivers = sim ? sim.drivers(doc) : null;
    doc.comps.forEach(function (c) {
      var K = SL.KINDS[c.kind], vis = {}, color = "#000", extra = null;
      if (sim) {
        var st = sim.s(c.id);
        vis.closed = sim.closed(c, drivers);
        if (K.role === "Load") {
          vis.active = st.energized || st.on;
          if (c.kind === "Lamp" && st.energized) vis.lamp = SL.rgb(SL.LAMP_COLORS[c.color] || SL.LAMP_COLORS.Verde);
          if (c.kind === "Buzzer" || c.kind === "Horn") vis.active = st.energized;
          vis.motor = st.motor; vis.conn = st.conn; vis.angle = st.angle;
          if (K.timer && (st.energized || st.on) && !(c.kind === "TimerOnOff" && st.energized === st.on)) {
            var rem = c.kind === "TimerOn" && st.on ? 0 : Math.max(0, SL.presetSecs(c) - st.t);
            extra = rem.toFixed(1) + " s";
          }
          color = vis.active || st.motor ? C.RED : C.GRAY;
        } else if (K.role === "Feed") {
          color = SL.potColor(K.feed[0][0]) || "#000";
        } else if (K.role === "Passive") {
          if (c.kind === "ThermalRelay3") { vis.active = st.act; color = st.act ? C.RED : C.GRAY; } else color = C.GRAY;
        } else color = vis.closed ? C.RED : C.GRAY;
      } else {
        vis.closed = K.role === "Manual" ? !!c.closed : K.nc; // contacts at rest, breakers as stored
      }
      var isSel = sel.has(c.id), cc = c;
      if (isSel && (dx || dy)) { cc = Object.assign({}, c); cc.x += dx; cc.y += dy; }
      var box = r.comp(cc, vis, isSel ? C.SEL : color, doc.page.show_terminals, extra);
      if (isSel) { r.g.strokeStyle = C.SEL; r.g.lineWidth = 1; r.g.setLineDash([]); r.g.strokeRect(box.x0 - 3, box.y0 - 3, box.x1 - box.x0 + 6, box.y1 - box.y0 + 6); }
    });
    doc.texts.forEach(function (x) {
      r.textItem(shifted(x, function (o) { o.x += dx; o.y += dy; return o; }), sel.has(x.id));
    });
  };

  var cv, g, dpr = 1;

  function world(e) {
    var rc = cv.getBoundingClientRect(), v = A.tab().view;
    var sx = e.clientX - rc.left, sy = e.clientY - rc.top;
    return { sx: sx, sy: sy, w: [(sx - v.panX) / v.zoom, (sy - v.panY) / v.zoom] };
  }
  function inRect(r, p, m) { m = m || 0; return p[0] >= r.x0 - m && p[0] <= r.x1 + m && p[1] >= r.y0 - m && p[1] <= r.y1 + m; }
  function segDist(p, a, b) {
    var abx = b[0] - a[0], aby = b[1] - a[1], l2 = abx * abx + aby * aby;
    var t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / l2)) : 0;
    var x = a[0] + abx * t - p[0], y = a[1] + aby * t - p[1];
    return Math.sqrt(x * x + y * y);
  }

  function hit(w) {
    var t = A.tab(), d = t.doc, i;
    for (i = d.comps.length - 1; i >= 0; i--) if (inRect(SL.compRect(d.comps[i]), w, 3)) return d.comps[i].id;
    for (i = d.texts.length - 1; i >= 0; i--) if (inRect(SL.textRect(g, d.texts[i], t.view), w, 2)) return d.texts[i].id;
    for (i = d.drawings.length - 1; i >= 0; i--) {
      var dr = d.drawings[i];
      var near = dr.kind === "Line" ? segDist(w, dr.a, dr.b) < 5 :
        inRect({ x0: Math.min(dr.a[0], dr.b[0]), y0: Math.min(dr.a[1], dr.b[1]), x1: Math.max(dr.a[0], dr.b[0]), y1: Math.max(dr.a[1], dr.b[1]) }, w, 3);
      if (near) return dr.id;
    }
    var tol = Math.max(3, 5 / t.view.zoom);
    for (i = d.wires.length - 1; i >= 0; i--) if (segDist(w, d.wires[i].a, d.wires[i].b) < tol) return d.wires[i].id;
    return null;
  }

  function clickable(w) {
    var d = A.tab().doc;
    for (var i = d.comps.length - 1; i >= 0; i--) {
      var c = d.comps[i];
      if (SL.clickKind(c.kind) && inRect(SL.compRect(c), w, 3)) return c;
    }
    return null;
  }

  function moveSelection(dx, dy) {
    var t = A.tab(), d = t.doc;
    A.checkpoint();
    var moved = {};
    d.comps.forEach(function (c) { if (A.sel.has(c.id)) SL.terminals(c).forEach(function (p) { moved[key(p)] = true; }); });
    d.comps.forEach(function (c) { if (A.sel.has(c.id)) { c.x += dx; c.y += dy; } });
    d.wires.forEach(function (w) {
      if (A.sel.has(w.id)) { w.a = [w.a[0] + dx, w.a[1] + dy]; w.b = [w.b[0] + dx, w.b[1] + dy]; return; }
      // wires attached to moved parts follow them
      if (moved[key(w.a)]) w.a = [w.a[0] + dx, w.a[1] + dy];
      if (moved[key(w.b)]) w.b = [w.b[0] + dx, w.b[1] + dy];
    });
    d.texts.forEach(function (x) { if (A.sel.has(x.id)) { x.x += dx; x.y += dy; } });
    d.drawings.forEach(function (x) { if (A.sel.has(x.id)) { x.a = [x.a[0] + dx, x.a[1] + dy]; x.b = [x.b[0] + dx, x.b[1] + dy]; } });
    d.wires = d.wires.filter(function (w) { return w.a[0] !== w.b[0] || w.a[1] !== w.b[1]; });
    A.changed();
  }

  function onDown(e) {
    cv.focus();
    if (A.dialogOpen) return;
    var m = world(e), t = A.tab(), w = m.w, sw = [SL.snap(w[0]), SL.snap(w[1])];
    if (e.button === 1 || (e.button === 0 && e.altKey)) { A.drag = { t: "pan", x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); return; }
    if (t.mode !== "edit") {
      if (e.button !== 0) return;
      var c = clickable(w);
      if (!c) return;
      if (SL.clickKind(c.kind) === "momentary") { t.sim.setActuator(t.doc, c.id, true); A.pressed = c.id; cv.setPointerCapture(e.pointerId); }
      else {
        var nv = !t.sim.s(c.id).act;
        t.sim.setActuator(t.doc, c.id, nv);
        if (SL.KINDS[c.kind].role === "Manual") {
          // breakers remember their position for the next run
          t.doc.comps.forEach(function (o) {
            if (o.id === c.id || (c.name && o.name === c.name && SL.KINDS[o.kind].role === "Manual")) o.closed = nv;
          });
          t.dirty = true; A.changed();
        }
      }
      if (t.mode === "sim") { var f = t.sim.tick(t.doc, 0); if (f) A.fault(t, f); }
      A.redraw();
      return;
    }
    if (e.button === 2) {
      if (A.tool.t === "wire" && A.wireFrom) A.wireFrom = null;
      else if (A.tool.t !== "select") A.setTool({ t: "select" });
      A.redraw();
      return;
    }
    if (e.button !== 0) return;
    cv.setPointerCapture(e.pointerId);
    var T = A.tool;
    if (T.t === "place") { A.place(T.kind, sw[0], sw[1]); return; }
    if (T.t === "wire") {
      if (!A.wireFrom) A.wireFrom = sw;
      else if (A.wireFrom[0] === sw[0] && A.wireFrom[1] === sw[1]) A.wireFrom = null;
      else {
        var onTerm = t.doc.comps.some(function (c) { return SL.terminals(c).some(function (p) { return p[0] === sw[0] && p[1] === sw[1]; }); });
        var onWire = t.doc.wires.some(function (x) { return (x.a[0] === sw[0] && x.a[1] === sw[1]) || (x.b[0] === sw[0] && x.b[1] === sw[1]) || SL.wireInterior(x, sw); });
        A.checkpoint();
        SL.addRoute(t.doc, A.wireFrom, sw);
        A.wireFrom = onTerm || onWire ? null : sw;
        A.changed();
      }
      A.redraw();
      return;
    }
    if (T.t === "text") { A.textDialog(null, w); return; }
    if (T.t === "shape") { A.drag = { t: "shape", a: w, b: w }; return; }
    if (T.t === "zoomwin") { A.drag = { t: "rubber", a: w, b: w, zoom: true }; return; }
    var id = hit(w);
    if (id != null) {
      if (e.shiftKey) { if (A.sel.has(id)) A.sel.delete(id); else A.sel.add(id); }
      else if (!A.sel.has(id)) A.sel = new Set([id]);
      A.drag = { t: "move", a: w, b: w };
    } else {
      if (!e.shiftKey) A.sel.clear();
      A.drag = { t: "rubber", a: w, b: w };
    }
    A.redraw();
  }

  function onMove(e) {
    var m = world(e);
    A.hover = m.w;
    var dr = A.drag;
    if (dr && dr.t === "pan") {
      var v = A.tab().view;
      v.panX += e.clientX - dr.x; v.panY += e.clientY - dr.y; dr.x = e.clientX; dr.y = e.clientY;
    } else if (dr) dr.b = m.w;
    if (A.tab().mode !== "edit") cv.style.cursor = clickable(m.w) ? "pointer" : "default";
    else cv.style.cursor = A.tool.t === "select" ? "default" : "crosshair";
    A.updateStatus();
    A.redraw();
  }

  function onUp(e) {
    var t = A.tab();
    if (A.pressed != null) {
      t.sim && t.sim.setActuator(t.doc, A.pressed, false);
      A.pressed = null;
      if (t.mode === "sim") { var f = t.sim.tick(t.doc, 0); if (f) A.fault(t, f); }
    }
    var dr = A.drag;
    A.drag = null;
    if (!dr) { A.redraw(); return; }
    if (dr.t === "move") {
      var dx = SL.snap(dr.b[0] - dr.a[0]), dy = SL.snap(dr.b[1] - dr.a[1]);
      if (dx || dy) moveSelection(dx, dy);
    } else if (dr.t === "rubber") {
      var x0 = Math.min(dr.a[0], dr.b[0]), y0 = Math.min(dr.a[1], dr.b[1]), x1 = Math.max(dr.a[0], dr.b[0]), y1 = Math.max(dr.a[1], dr.b[1]);
      if (dr.zoom) { if (x1 - x0 > 10) { A.pushView(); A.zoomRect([x0, y0], [x1, y1]); } A.setTool({ t: "select" }); }
      else if (x1 - x0 > 2 || y1 - y0 > 2) {
        var R = { x0: x0, y0: y0, x1: x1, y1: y1 }, d = t.doc;
        d.comps.forEach(function (c) { var b = SL.compRect(c); if (inRect(R, [b.x0, b.y0]) && inRect(R, [b.x1, b.y1])) A.sel.add(c.id); });
        d.wires.forEach(function (w) { if (inRect(R, w.a) && inRect(R, w.b)) A.sel.add(w.id); });
        d.texts.forEach(function (x) { if (inRect(R, [x.x, x.y])) A.sel.add(x.id); });
        d.drawings.forEach(function (x) { if (inRect(R, x.a) && inRect(R, x.b)) A.sel.add(x.id); });
      }
    } else if (dr.t === "shape") {
      if (Math.abs(dr.a[0] - dr.b[0]) + Math.abs(dr.a[1] - dr.b[1]) > 3) {
        A.checkpoint();
        t.doc.drawings.push({ id: SL.newId(t.doc), kind: A.tool.kind, a: dr.a, b: dr.b, color: A.drawColor.slice(), fill: A.fillColor.slice(), width: A.drawWidth });
        A.changed();
      }
    }
    A.redraw();
  }

  function onDbl(e) {
    if (A.tab().mode !== "edit" || A.tool.t !== "select" || A.dialogOpen) return;
    var id = hit(world(e).w);
    if (id != null) A.openProps(id);
  }

  function onWheel(e) {
    e.preventDefault();
    var m = world(e);
    if (e.ctrlKey || e.metaKey) A.zoomAt(Math.exp(-e.deltaY / 200), m.sx, m.sy);
    else { var v = A.tab().view; v.panX -= e.deltaX; v.panY -= e.deltaY; A.redraw(); }
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(cv.clientWidth * dpr);
    cv.height = Math.round(cv.clientHeight * dpr);
    A.redraw();
  }

  function paint() {
    var t = A.tab(), w = cv.clientWidth, h = cv.clientHeight;
    if (!t.fitted && w > 100) {
      t.fitted = true;
      var ps = SL.PAGE_SIZES[t.doc.page.size];
      t.view.zoom = Math.max(0.3, Math.min(1.2, (w - 40) / ps.w)); t.view.panX = 20; t.view.panY = 16;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "rgb(128,128,128)"; g.fillRect(0, 0, w, h);
    var r = new SL.Renderer(g, t.view), dr = A.drag, dx = 0, dy = 0;
    if (dr && dr.t === "move") { dx = SL.snap(dr.b[0] - dr.a[0]); dy = SL.snap(dr.b[1] - dr.a[1]); }
    SL.drawDoc(r, t, { grid: A.grid, sel: A.sel, dx: dx, dy: dy });
    // overlays
    if (t.mode === "edit" && A.hover) {
      var sw = [SL.snap(A.hover[0]), SL.snap(A.hover[1])];
      if (A.tool.t === "place") {
        g.globalAlpha = 0.6;
        r.comp({ id: 0, kind: A.tool.kind, x: sw[0], y: sw[1], rot: A.placeRot, mirror: A.placeMirror, name: "" }, {}, "rgb(0,0,200)", false, null);
        g.globalAlpha = 1;
      } else if (A.tool.t === "wire") {
        var s = r.s(sw);
        g.strokeStyle = "rgb(0,0,200)"; g.lineWidth = 1; g.setLineDash([]);
        g.beginPath(); g.arc(s[0], s[1], 4, 0, 2 * Math.PI); g.stroke();
        if (A.wireFrom) {
          var a = A.wireFrom, mid = a[0] === sw[0] || a[1] === sw[1] ? a : [sw[0], a[1]];
          var p0 = r.s(a), p1 = r.s(mid), p2 = r.s(sw);
          g.setLineDash([5, 3]); g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.stroke(); g.setLineDash([]);
        }
      }
    }
    if (dr && dr.t === "rubber") {
      var q0 = r.s(dr.a), q1 = r.s(dr.b);
      g.strokeStyle = "rgb(0,0,200)"; g.lineWidth = 1; g.setLineDash([]);
      g.strokeRect(Math.min(q0[0], q1[0]), Math.min(q0[1], q1[1]), Math.abs(q1[0] - q0[0]), Math.abs(q1[1] - q0[1]));
    } else if (dr && dr.t === "shape") {
      r.drawing({ kind: A.tool.kind, a: dr.a, b: dr.b, color: A.drawColor, fill: A.fillColor, width: A.drawWidth }, false);
    }
    if (t.mode === "pause") r.text([w - 12, 18], "PAUSA", 16, C.RED, "right");
  }

  function frame(now) {
    if (A.runSim(now)) { A.needsDraw = true; A.updateStatus(); }
    if (A.needsDraw) { A.needsDraw = false; paint(); }
    requestAnimationFrame(frame);
  }

  SL.editor = {
    init: function () {
      cv = document.getElementById("canvas");
      g = cv.getContext("2d");
      cv.addEventListener("pointerdown", onDown);
      cv.addEventListener("pointermove", onMove);
      cv.addEventListener("pointerup", onUp);
      cv.addEventListener("pointercancel", onUp);
      cv.addEventListener("pointerleave", function () { A.hover = null; A.updateStatus(); A.redraw(); });
      cv.addEventListener("dblclick", onDbl);
      cv.addEventListener("wheel", onWheel, { passive: false });
      cv.addEventListener("contextmenu", function (e) { e.preventDefault(); });
      window.addEventListener("resize", resize);
      resize();
      requestAnimationFrame(frame);
    },
  };
})(window.SL);
