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
    if ((dx || dy) && sel && sel.size) {
      doc = JSON.parse(JSON.stringify(t.doc));
      SL.moveItems(doc, sel, dx, dy);
      dx = 0; dy = 0;
    }
    r.page(doc, opts.grid);
    function shifted(o, f) { return sel.has(o.id) && (dx || dy) ? f(JSON.parse(JSON.stringify(o))) : o; }
    doc.drawings.forEach(function (d) {
      r.drawing(shifted(d, function (o) { o.a = [o.a[0] + dx, o.a[1] + dy]; o.b = [o.b[0] + dx, o.b[1] + dy]; return o; }), sel.has(d.id));
    });
    function ptColor(p) { return (sim && !hideV && SL.potColor(sim.pot[key(p)])) || "#000"; }
    var net = !sim && opts.net;
    // fault mode: conductors stay black so the faults are found by measuring
    var hideV = sim && (doc.faults || []).length && doc.fault_hide !== false;
    function wireColor(w) {
      if (hideV) return "#000";
      if (net && net.wires.has(w.id)) return "rgb(255,120,0)";
      if (!sim) return "#000";
      var m = sim.wirePot && sim.wirePot[w.id] != null ? sim.wirePot[w.id] : sim.pot[key(w.a)];
      return SL.potColor(m) || "#000";
    }
    var winfo = SL.wireInfo(doc);
    // after a short circuit or an earth fault, the conductors where the potentials met blink in red
    var fw = !sim && t.faultWires && opts.time != null && opts.time < t.faultUntil ? t.faultWires : null;
    if (fw) A.needsDraw = true;
    doc.wires.forEach(function (w) {
      var col = sel.has(w.id) ? C.SEL : wireColor(w);
      // power wiring thicker than control wiring, as on real schematics
      r.wire(shifted(w, function (o) { o.a = [o.a[0] + dx, o.a[1] + dy]; o.b = [o.b[0] + dx, o.b[1] + dy]; return o; }), col, winfo.power[w.id] ? 2.2 : 1.3);
    });
    if (fw && Math.sin(opts.time * 10) > -0.3) {
      var rgf = r.g;
      rgf.strokeStyle = "rgba(220,38,38,0.6)"; rgf.lineWidth = Math.max(6, 4 * r.v.zoom); rgf.setLineDash([]); rgf.lineCap = "round";
      doc.wires.forEach(function (w) {
        if (!fw.has(w.id)) return;
        var p0 = r.s(w.a), p1 = r.s(w.b);
        rgf.beginPath(); rgf.moveTo(p0[0], p0[1]); rgf.lineTo(p1[0], p1[1]); rgf.stroke();
      });
    }
    // current animation: dashes that run along the conductors carrying current
    if (sim && !hideV && !opts.mini && opts.time != null && A.prefOn && A.prefOn("flow")) {
      var fg = r.g, off = -(opts.time * 26) % 18;
      fg.save && fg.save();
      fg.lineCap = "round";
      sim.currentFlow(doc).forEach(function (f) {
        var p0 = r.s(f.from), p1 = r.s(f.to);
        fg.strokeStyle = "rgba(255,255,255,0.9)";
        fg.lineWidth = Math.max(1.2, (winfo.power[f.w] ? 1.2 : 0.8) * r.v.zoom);
        fg.setLineDash([Math.max(2, 3 * r.v.zoom), Math.max(4, 6 * r.v.zoom)]);
        fg.lineDashOffset = off * r.v.zoom;
        fg.beginPath(); fg.moveTo(p0[0], p0[1]); fg.lineTo(p1[0], p1[1]); fg.stroke();
      });
      fg.setLineDash([]); fg.lineDashOffset = 0;
      fg.restore && fg.restore();
    }
    if (doc.page.wire_numbers && !opts.mini) {
      var fsn = Math.max(4, 7.5 * r.v.zoom);
      if (fsn >= 4.5) doc.wires.forEach(function (w) {
        var nn = winfo.label[w.id];
        if (!nn) return;
        var hzw = w.a[1] === w.b[1], m = r.s([(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2]);
        r.text(hzw ? [m[0], m[1] - 2] : [m[0] - 3, m[1]], String(nn), fsn, "rgb(120,60,0)", hzw ? "center" : "right", hzw ? "bottom" : "middle");
      });
    }
    SL.junctionPoints(doc).forEach(function (p) {
      r.dot(p, ptColor(p));
    });
    if (sim && A.probeRef) {
      // reference point of the probe
      var rp = r.s(A.probeRef.p), rg = r.g;
      rg.strokeStyle = "rgb(0,150,0)"; rg.lineWidth = 2; rg.setLineDash([]);
      rg.beginPath(); rg.arc(rp[0], rp[1], 6, 0, 2 * Math.PI); rg.stroke();
      r.text([rp[0] + 8, rp[1] - 8], "REF", 10, "rgb(0,150,0)", "left");
    }
    var drivers = sim ? sim.drivers(doc) : null;
    doc.comps.forEach(function (c) {
      var K = SL.KINDS[c.kind], vis = {}, color = "#000", extra = null;
      if (c.kind === "PushBtn") vis.btnColor = SL.rgb(SL.LAMP_COLORS[c.color] || SL.LAMP_COLORS.Verde);
      if (sim) {
        var st = sim.s(c.id);
        vis.closed = sim.closed(c, drivers);
        vis.pos = st.pos || 0;
        if (st.blown) { vis.blown = true; extra = "fos"; }
        else if (st.tripped && !st.act) extra = "disparat";
        if (K.role === "Logic") {
          vis.ins = st.cur || []; vis.outs = st.lo || []; vis.val = st.val || 0;
          color = vis.outs.some(Boolean) && !/^Logic7/.test(c.kind) ? C.RED : C.GRAY;
          if (c.kind === "LogicCnt" || c.kind === "LogicCntUD") extra = (st.cnt || 0) + " / " + Math.max(1, c.count_preset | 0 || 3);
          else if (/^LogicCnt/.test(c.kind)) extra = String(st.cnt || 0);
          else if (K.timer) {
            var T = SL.presetSecs(c), on = !!(st.cur && st.cur[0]);
            if (c.kind === "LogicTon" && on && !vis.outs[0]) extra = Math.max(0, T - st.t).toFixed(1) + " s";
            else if (c.kind === "LogicTp" && st.pulse) extra = Math.max(0, T - st.t).toFixed(1) + " s";
            else if (c.kind === "LogicTof" && !on && st.hold) extra = Math.max(0, T - st.t).toFixed(1) + " s";
          }
        } else if (K.role === "Load") {
          vis.active = st.energized || st.on;
          if ((c.kind === "Lamp" || c.kind === "LampFlash") && (c.kind === "Lamp" ? st.energized : st.on)) {
            vis.lamp = SL.rgb(SL.LAMP_COLORS[c.color] || SL.LAMP_COLORS.Verde);
          }
          if (["Bell", "Buzzer", "Siren", "Horn"].indexOf(c.kind) >= 0) vis.active = st.energized;
          vis.motor = st.motor || ((st.spd || 0) > 0.01 ? st.dir : 0); vis.conn = st.conn; vis.angle = st.angle;
          if (K.motor) {
            if (st.blocked && st.motor) extra = "frenat";
            else if (st.rotorOpen) extra = "rotor obert";
            else if (st.twoPhase) extra = c.kind === "Motor3" ? "2 fases!" : "no arrenca!";
            else if (st.motor || st.spd > 0.01) {
              var pct = Math.round((st.spd || 0) / SL.motorLevel(c, st) * 100);
              var parts = [];
              parts.push(Math.min(100, pct) + " %");
              if (c.kind === "Motor3WR" && st.steps) parts.push("R: " + st.steps + (st.steps === 1 ? " graó" : " graons"));
              if (c.kind === "Motor3Dahl") parts.push(st.conn === 2 ? "alta" : "baixa");
              extra = parts.join(" · ") || null;
            }
          }
          if (c.kind === "Counter") {
            extra = (st.count || 0) + " / " + Math.max(1, c.count_preset | 0 || 3);
          } else if (c.kind === "TimeSwitch") {
            if (st.energized) {
              var tOn = SL.presetSecs(c), per = tOn + SL.offSecs(c), ph = per > 0 ? st.t % per : 0;
              extra = st.phaseOn !== false ? "ON " + Math.max(0, tOn - ph).toFixed(1) + " s" : "OFF " + Math.max(0, per - ph).toFixed(1) + " s";
            }
          } else if (K.timer && (st.energized || st.on) && !(c.kind === "TimerOnOff" && st.energized === st.on)) {
            var rem = c.kind === "TimerOn" && st.on ? 0 : Math.max(0, SL.presetSecs(c) - st.t);
            extra = rem.toFixed(1) + " s";
          }
          color = vis.active || st.motor ? C.RED : C.GRAY;
        } else if (K.role === "Converter") {
          color = st.on ? C.RED : C.GRAY;
        } else if (K.role === "Feed") {
          color = SL.potColor(K.feed[0][0]) || "#000";
        } else if (K.role === "Passive") {
          if (c.kind === "ThermalRelay3") { vis.active = st.act; color = st.act ? C.RED : C.GRAY; } else color = C.GRAY;
        } else color = vis.closed ? C.RED : C.GRAY;
      } else {
        vis.closed = K.role === "Manual" ? !!c.closed : K.nc; // contacts at rest, breakers as stored
        if (c.kind === "LogicPreset") vis.val = c.value || 0;
      }
      if (c.kind === "Continuation" && c.name) {
        // where the other markers with this name are: sheet.column
        var to = doc.comps.filter(function (o) { return o !== c && o.kind === "Continuation" && o.name === c.name; })
          .map(function (o) { var rr = SL.compRect(o); return SL.colRef(doc, [(rr.x0 + rr.x1) / 2, (rr.y0 + rr.y1) / 2]); });
        extra = to.length ? "→ " + to.join(", ") : "(sense parella)";
        if (sim) color = SL.potColor(sim.pot[key(SL.terminals(c)[0])]) || C.GRAY;
      }
      if (sim && !opts.mini) {
        var stv = sim.s(c.id);
        if ((c.kind === "Lamp" || c.kind === "LampFlash") && vis.lamp) {
          var lc = SL.LAMP_COLORS[c.color] || SL.LAMP_COLORS.Verde;
          vis.halo = { c: [0, 30], r: 30, color: "rgba(" + lc[0] + "," + lc[1] + "," + lc[2] + ",0.55)" };
        } else if (K.coil && stv.on && SL.baseSymbol(c.kind).terms.length === 2) {
          vis.halo = { c: [0, 30], r: 24, color: "rgba(255,70,70,0.35)" };
        }
        // contacts move over about 0.12 s instead of jumping
        if (opts.time != null && (K.role === "Contact" || K.role === "Poles" || K.role === "Manual" || K.role === "Actuator")) {
          var an = A.anim || (A.anim = {}), target = vis.closed ? 1 : 0, cur = an[c.id];
          if (!cur) cur = an[c.id] = { v: target, t: opts.time };
          var step = Math.min(1, (opts.time - cur.t) / 0.12);
          cur.v = cur.v + (target - cur.v) * step; cur.t = opts.time;
          if (Math.abs(cur.v - target) < 0.02) cur.v = target;
          vis.closedT = cur.v;
          if (cur.v !== target) A.needsDraw = true;
        }
      }
      var isSel = sel.has(c.id), cc = c;
      if (isSel && (dx || dy)) { cc = Object.assign({}, c); cc.x += dx; cc.y += dy; }
      var hov = !sim && opts.hover === c.id && !isSel;
      if (hov) {
        // soft highlight under the element the pointer is on
        r.g.fillStyle = "rgba(37,99,235,0.07)";
        var hb = SL.compRect(cc), h0 = r.s([hb.x0, hb.y0]), h1 = r.s([hb.x1, hb.y1]);
        SL.roundRect(r.g, h0[0] - 5, h0[1] - 5, h1[0] - h0[0] + 10, h1[1] - h0[1] + 10, 6); r.g.fill();
      }
      var box = r.comp(cc, vis, isSel ? C.SEL : color, doc.page.show_terminals, extra);
      // a protection that has just tripped flashes for 3 s
      if (sim && sim.flash && sim.flash[c.id] != null && sim.time - sim.flash[c.id] < 3 && opts.time != null) {
        var on = Math.sin(opts.time * 12) > 0;
        if (on) {
          r.g.strokeStyle = "rgb(220,38,38)"; r.g.lineWidth = 3; r.g.setLineDash([]);
          SL.roundRect(r.g, box.x0 - 6, box.y0 - 6, box.x1 - box.x0 + 12, box.y1 - box.y0 + 12, 7); r.g.stroke();
        }
      }
      if (isSel) {
        var rg2 = r.g;
        rg2.save && rg2.save();
        rg2.strokeStyle = "rgba(37,99,235,0.9)"; rg2.lineWidth = 1.5; rg2.setLineDash([]);
        if ("shadowBlur" in rg2) { rg2.shadowColor = "rgba(37,99,235,0.45)"; rg2.shadowBlur = 8; }
        SL.roundRect(rg2, box.x0 - 5, box.y0 - 5, box.x1 - box.x0 + 10, box.y1 - box.y0 + 10, 6); rg2.stroke();
        rg2.restore && rg2.restore();
      }
    });
    // cross references under each coil: its contacts and the column where they are
    if (doc.page.references && doc.page.xref !== false) {
      var fsx = Math.max(4, 8 * r.v.zoom);
      if (fsx >= 4.5) doc.comps.forEach(function (c) {
        var K = SL.KINDS[c.kind];
        if (!c.name || !(K.coil || c.kind === "ThermalRelay3")) return;
        var lines = SL.crossRefs(doc, c);
        if (!lines.length) return;
        var b = SL.compRect(c), hz = SL.isHorizontal(c), cx = (b.x0 + b.x1) / 2;
        // beside the conductor that leaves the coil downwards (or under a horizontal coil)
        var p = hz ? [cx, b.y1 + 14] : [cx + 6, b.y1 + 4];
        r.text(r.s(p), lines.join("\n"), fsx, "rgb(0,0,128)", hz ? "center" : "left", "top");
      });
    }
    doc.texts.forEach(function (x) {
      r.textItem(shifted(x, function (o) { o.x += dx; o.y += dy; return o; }), sel.has(x.id));
    });
  };

  var cv, g, dpr = 1, rcTimer = null, rcHold = null;

  function clearRcHold() {
    if (rcTimer) { clearTimeout(rcTimer); rcTimer = null; }
    rcHold = null;
  }

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

  /** Component whose name label is under w (only when the click is not on a symbol body). */
  function labelHit(w) {
    var d = A.tab().doc, i;
    for (i = d.comps.length - 1; i >= 0; i--) if (inRect(SL.compRect(d.comps[i]), w, 3)) return null;
    for (i = d.comps.length - 1; i >= 0; i--) {
      var r = SL.labelRect(d.comps[i]);
      if (r && inRect(r, w, 1)) return d.comps[i];
    }
    return null;
  }

  function clickable(w) {
    var d = A.tab().doc;
    for (var i = d.comps.length - 1; i >= 0; i--) {
      var c = d.comps[i];
      var ck = SL.clickKind(c.kind);
      if (ck === "fuse" && !(A.tab().sim && A.tab().sim.s(c.id).blown)) continue;
      if (ck && inRect(SL.compRect(c), w, 3)) return c;
    }
    return null;
  }

  function moveSelection(dx, dy) {
    var t = A.tab(), d = t.doc;
    A.checkpoint();
    var res = SL.moveItems(d, A.sel, dx, dy);
    A.changed();
    if (res && res.disconnected) {
      var suffix = res.names && res.names.length ? " (" + res.names.join(", ") + ")" : "";
      A.message("No s'ha pogut refer la connexió i s'ha desconnectat l'element" + suffix + ".");
    }
  }

  function onDown(e) {
    cv.focus();
    if (A.dialogOpen) return;
    var m = world(e), t = A.tab(), w = m.w, sw = [SL.snap(w[0]), SL.snap(w[1])];
    if (e.button === 2 || (e.button === 0 && e.ctrlKey)) {
      var wasOpen = !!(A.openCat || A.radialMenu);
      if (wasOpen && A.closeSymDeploy) A.closeSymDeploy();
      clearRcHold();
      if (t.mode === "edit") {
        rcHold = { x: e.clientX, y: e.clientY, wasOpen: wasOpen };
        rcTimer = setTimeout(function () {
          var hx = rcHold ? rcHold.x : e.clientX;
          var hy = rcHold ? rcHold.y : e.clientY;
          clearRcHold();
          if (A.openRadialMenu) A.openRadialMenu(hx, hy, null);
        }, 500);
      }
      return;
    }
    clearRcHold();
    if ((A.openCat || A.radialMenu) && A.closeSymDeploy) A.closeSymDeploy();
    if (e.button === 1 || (e.button === 0 && e.altKey)) { A.drag = { t: "pan", x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); return; }
    if (A.diagPick && e.button === 0) { A.faultCheck(hit(w)); A.redraw(); return; } // fault mode: student points at the fault
    if (t.mode !== "edit") {
      if (e.button !== 0) return;
      if (e.shiftKey && t.sim) {
        var pr = t.sim.potAt(t.doc, w, Math.max(4, 6 / t.view.zoom));
        A.probeRef = pr ? { m: pr.m, p: w } : null;
        A.setStatus(pr ? "Referència de la sonda fixada (" + SL.potName(pr.m) + "). Passeu per sobre d'un altre punt per mesurar." : "Referència de la sonda esborrada");
        updateProbe(e, w);
        A.redraw();
        return;
      }
      var c = clickable(w);
      if (!c) return;
      if (SL.clickKind(c.kind) === "fuse") t.sim.replaceFuse(t.doc, c.id);
      else if (SL.clickKind(c.kind) === "brake") t.sim.toggleBrake(t.doc, c.id);
      else if (SL.clickKind(c.kind) === "preset") {
        c.value = t.sim.stepPreset(t.doc, c.id); // remembered for the next run
        t.dirty = true; A.changed();
      }
      else if (SL.clickKind(c.kind) === "momentary") { t.sim.setActuator(t.doc, c.id, true); A.pressed = c.id; cv.setPointerCapture(e.pointerId); }
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
      if (t.mode === "sim") { var f = t.sim.tick(t.doc, 0); if (f) A.fault(t, f); A.simEvents(t); }
      A.redraw();
      return;
    }
    if (e.button !== 0) return;
    cv.setPointerCapture(e.pointerId);
    var T = A.tool;
    if (T.t === "place") { A.place(T.kind, sw[0], sw[1]); return; }
    if (T.t === "junction") {
      A.checkpoint();
      var jr = SL.toggleJunction(t.doc, w);
      if (!jr.changed) {
        t.undo.pop();
        A.setStatus("Punt de connexió: feu clic sobre l'encreuament de dos conductors");
      } else {
        A.setStatus(jr.connected ? "S'ha creat la connexió entre els conductors" : "S'ha desfet la connexió entre els conductors");
        A.changed();
      }
      A.redraw();
      return;
    }
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
    var lc = !e.shiftKey && labelHit(w);
    if (lc) {
      // drag the name label on its own
      A.sel = new Set([lc.id]);
      A.drag = { t: "label", c: lc, a: w, b: w, lx: lc.lx || 0, ly: lc.ly || 0, saved: false };
      A.redraw();
      return;
    }
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

  // ---- probe (simulation): hover shows the potential; Shift+click fixes the reference point
  var probeEl = null;
  function updateProbe(e, w) {
    var t = A.tab();
    if (!probeEl) return;
    if (t.mode === "edit" || !t.sim || A.drag) { probeEl.hidden = true; return; }
    var tol = Math.max(4, 6 / t.view.zoom), r = t.sim.potAt(t.doc, w, tol);
    if (!r) { probeEl.hidden = true; return; }
    var txt = "Sonda: " + SL.potName(r.m);
    if (A.probeRef) txt += "\nRespecte de la referència (" + SL.potName(A.probeRef.m) + "): " + SL.voltage(A.probeRef.m, r.m);
    else txt += "\nMaj+clic: fixa aquest punt com a referència";
    probeEl.textContent = txt;
    probeEl.style.left = (e.clientX + 14) + "px";
    probeEl.style.top = (e.clientY + 14) + "px";
    probeEl.hidden = false;
  }

  // ---- edit mode: hovering a conductor or terminal highlights its whole net
  function netAt(w) {
    var t = A.tab(), d = t.doc, topo = SL.topoFor(d), tol = Math.max(3, 5 / t.view.zoom), root = null, i;
    var terms = [];
    d.comps.forEach(function (c) { SL.terminals(c).forEach(function (p) { terms.push(p); }); });
    for (i = 0; i < terms.length && root == null; i++) {
      if (Math.hypot(terms[i][0] - w[0], terms[i][1] - w[1]) <= tol) root = topo.base[topo.idx[key(terms[i])]];
    }
    for (i = d.wires.length - 1; i >= 0 && root == null; i--) {
      if (segDist(w, d.wires[i].a, d.wires[i].b) < tol && topo.wireNode[d.wires[i].id] != null) root = topo.base[topo.wireNode[d.wires[i].id]];
    }
    if (root == null) return null;
    var net = { wires: new Set(), pts: [] };
    d.wires.forEach(function (x) { var n = topo.wireNode[x.id]; if (n != null && topo.base[n] === root) net.wires.add(x.id); });
    topo.coordList.forEach(function (p) { if (topo.base[topo.idx[key(p)]] === root) net.pts.push(p); });
    if (!net.wires.size) return null;
    return net;
  }

  /** "born" / "conductor" when a point lands on a terminal or a conductor (for the snap marker). */
  function snapTarget(p) {
    var d = A.tab().doc;
    if (d.comps.some(function (c) { return SL.terminals(c).some(function (q) { return q[0] === p[0] && q[1] === p[1]; }); })) return "born";
    if (d.wires.some(function (w) { return (w.a[0] === p[0] && w.a[1] === p[1]) || (w.b[0] === p[0] && w.b[1] === p[1]) || SL.wireInterior(w, p); })) return "conductor";
    return null;
  }

  function onMove(e) {
    if (rcHold && Math.hypot(e.clientX - rcHold.x, e.clientY - rcHold.y) > 8) {
      clearRcHold();
    }
    var m = world(e);
    A.hover = m.w;
    var dr = A.drag;
    if (dr && dr.t === "pan") {
      var v = A.tab().view;
      v.panX += e.clientX - dr.x; v.panY += e.clientY - dr.y; dr.x = e.clientX; dr.y = e.clientY;
    } else if (dr && dr.t === "label") {
      dr.b = m.w;
      if (!dr.saved) { A.checkpoint(); dr.saved = true; }
      dr.c.lx = Math.round(dr.lx + dr.b[0] - dr.a[0]);
      dr.c.ly = Math.round(dr.ly + dr.b[1] - dr.a[1]);
    } else if (dr) dr.b = m.w;
    if (A.tab().mode !== "edit") cv.style.cursor = clickable(m.w) ? "pointer" : "default";
    else cv.style.cursor = A.tool.t === "select" ? "default" : "crosshair";
    updateProbe(e, m.w);
    A.hoverNet = A.tab().mode === "edit" && !dr && (A.tool.t === "select" || A.tool.t === "wire") ? netAt(m.w) : null;
    var hc = null;
    if (A.tab().mode === "edit" && !dr && A.tool.t === "select") {
      var dd = A.tab().doc;
      for (var hi = dd.comps.length - 1; hi >= 0; hi--) if (inRect(SL.compRect(dd.comps[hi]), m.w, 3)) { hc = dd.comps[hi].id; break; }
    }
    A.hoverComp = hc;
    A.updateStatus();
    A.redraw();
  }

  function onUp(e) {
    var t = A.tab();
    if (rcHold) {
      var wasOpen = rcHold.wasOpen;
      clearRcHold();
      if (!wasOpen && t.mode === "edit") {
        if (A.tool.t === "wire" && A.wireFrom) A.wireFrom = null;
        else if (A.tool.t !== "select") A.setTool({ t: "select" });
        A.redraw();
      }
      return;
    }
    if (A.pressed != null) {
      t.sim && t.sim.setActuator(t.doc, A.pressed, false);
      A.pressed = null;
      if (t.mode === "sim") { var f = t.sim.tick(t.doc, 0); if (f) A.fault(t, f); A.simEvents(t); }
    }
    var dr = A.drag;
    A.drag = null;
    if (!dr) { A.redraw(); return; }
    if (dr.t === "label") {
      if (dr.saved) A.changed();
    } else if (dr.t === "move") {
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
    A.updateStatus();
  }

  function onDbl(e) {
    if (A.tab().mode !== "edit" || A.tool.t !== "select" || A.dialogOpen) return;
    var w = world(e).w, lc = labelHit(w), id = lc ? lc.id : hit(w);
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
    g.fillStyle = A.deskColor || "rgb(128,128,128)"; g.fillRect(0, 0, w, h);
    var r = new SL.Renderer(g, t.view), dr = A.drag, dx = 0, dy = 0;
    if (dr && dr.t === "move") { dx = SL.snap(dr.b[0] - dr.a[0]); dy = SL.snap(dr.b[1] - dr.a[1]); }
    SL.drawDoc(r, t, { grid: A.grid, sel: A.sel, dx: dx, dy: dy, net: A.hoverNet, hover: A.hoverComp, time: performance.now() / 1000 });
    // overlays
    if (t.mode === "edit" && A.hover) {
      var sw = [SL.snap(A.hover[0]), SL.snap(A.hover[1])];
      if (A.tool.t === "place") {
        g.globalAlpha = 0.6;
        r.comp({ id: 0, kind: A.tool.kind, x: sw[0], y: sw[1], rot: A.placeRot, mirror: A.placeMirror, name: "" }, {}, "rgb(0,0,200)", false, null);
        g.globalAlpha = 1;
      } else if (A.tool.t === "wire") {
        var s = r.s(sw), snapOn = snapTarget(sw);
        if (A.wireFrom) {
          // preview of the route the conductor will take (90° turns)
          var a = A.wireFrom, mid = SL.chooseRouteMid(t.doc, a, sw);
          var p0 = r.s(a), p1 = r.s(mid), p2 = r.s(sw);
          g.strokeStyle = "rgba(37,99,235,0.75)"; g.lineWidth = Math.max(1.5, 1.3 * t.view.zoom); g.setLineDash([]);
          g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.stroke();
          g.fillStyle = "rgb(37,99,235)"; g.beginPath(); g.arc(p0[0], p0[1], 3, 0, 2 * Math.PI); g.fill();
        }
        // snap point: green when it lands on a terminal or a conductor
        g.setLineDash([]);
        if (snapOn) {
          g.fillStyle = "rgba(22,163,74,0.25)"; g.strokeStyle = "rgb(22,163,74)"; g.lineWidth = 2;
          g.beginPath(); g.arc(s[0], s[1], 7, 0, 2 * Math.PI); g.fill(); g.stroke();
          r.text([s[0] + 10, s[1] - 10], snapOn, 11, "rgb(22,120,60)", "left");
        } else {
          g.strokeStyle = "rgb(37,99,235)"; g.lineWidth = 1.2;
          g.beginPath(); g.arc(s[0], s[1], 4, 0, 2 * Math.PI); g.stroke();
        }
      } else if (A.tool.t === "junction") {
        var sj = r.s(sw);
        g.fillStyle = "rgba(0,90,255,0.65)";
        g.strokeStyle = "rgb(0,0,200)"; g.lineWidth = 1; g.setLineDash([]);
        g.beginPath(); g.arc(sj[0], sj[1], Math.max(3, 3.2 * t.view.zoom), 0, 2 * Math.PI); g.fill(); g.stroke();
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
      probeEl = document.createElement("div");
      probeEl.id = "probe"; probeEl.hidden = true;
      document.body.appendChild(probeEl);
      cv.addEventListener("pointerleave", function () { probeEl.hidden = true; A.hoverNet = null; A.redraw(); });
      cv.addEventListener("pointermove", onMove);
      cv.addEventListener("pointerup", onUp);
      cv.addEventListener("pointercancel", onUp);
      cv.addEventListener("pointerleave", function () { clearRcHold(); A.hover = null; A.updateStatus(); A.redraw(); });
      cv.addEventListener("dblclick", onDbl);
      cv.addEventListener("wheel", onWheel, { passive: false });
      cv.addEventListener("contextmenu", function (e) { e.preventDefault(); });
      window.addEventListener("resize", resize);
      resize();
      requestAnimationFrame(frame);
    },
  };
})(window.SL);
