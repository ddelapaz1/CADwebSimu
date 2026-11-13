// SimuLAB — teaching and document tools: fault mode, event log and timing
// chart, schematic check, sound, vector export and bill of materials.
"use strict";
(function (SL) {
  var A = SL.app, el = SL.el;
  function ui() { return A.ui; }

  // ================================================================ fault mode
  var FAULT_LABELS = {
    cut: "Conductor tallat",
    open: "Element obert (no condueix / bobina cremada)",
    stuck: "Contacte enganxat (sempre tancat)",
  };
  SL.FAULT_LABELS = FAULT_LABELS;

  /** Fault types that make sense for an element or a wire. */
  function faultTypes(doc, id) {
    if (doc.wires.some(function (w) { return w.id === id; })) return ["cut"];
    var c = doc.comps.find(function (x) { return x.id === id; });
    if (!c) return [];
    var role = SL.KINDS[c.kind].role;
    if (["Contact", "Actuator", "Poles", "Manual"].indexOf(role) >= 0) return ["open", "stuck"];
    if (role === "Passive" || role === "Load") return ["open"];
    return [];
  }

  function describe(doc, id) {
    var c = doc.comps.find(function (x) { return x.id === id; });
    if (c) return (c.name ? c.name + " " : "") + "(" + SL.KINDS[c.kind].label + ")";
    var w = doc.wires.find(function (x) { return x.id === id; });
    if (w) return "Conductor (" + Math.round(w.a[0] / 5) + "," + Math.round(w.a[1] / 5) + ")–(" + Math.round(w.b[0] / 5) + "," + Math.round(w.b[1] / 5) + ") mm";
    return "Element eliminat";
  }

  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16); }

  A.faultAdd = function () {
    var t = A.tab(), doc = t.doc, ids = Array.from(A.sel);
    if (t.mode !== "edit") return;
    if (ids.length !== 1 || !faultTypes(doc, ids[0]).length) {
      A.message("Seleccioneu un sol element (contacte, polsador, bobina, fusible, pilot...) o un sol conductor per afegir-hi una avaria.");
      return;
    }
    var id = ids[0], types = faultTypes(doc, id), cur = (doc.faults || []).find(function (f) { return f.id === id; });
    var r = ui().radios("fault", types.map(function (k) { return [k, FAULT_LABELS[k]]; }), cur ? cur.type : types[0]);
    ui().dialog("Afegeix una avaria", [
      el("b", { text: describe(doc, id) }), r,
      el("div", { class: "hint", text: "L'avaria no es veu a l'esquema. Afegiu-la quan l'esquema estigui acabat: si es mou un conductor, la seva avaria es perd." }),
    ], [["D'acord", function () {
      A.checkpoint();
      doc.faults = (doc.faults || []).filter(function (f) { return f.id !== id; }).concat([{ id: id, type: r.value() || types[0] }]);
      A.changed();
      A.setStatus("Avaria afegida. Aquest esquema té " + doc.faults.length + " avaria(es) amagada(es).");
    }], ["Cancel·la", null]]);
  };

  function withPassword(doc, then) {
    if (!doc.fault_lock) { then(); return; }
    var pw = el("input", { type: "password" });
    ui().dialog("Avaries protegides", [ui().row("Contrasenya:", pw)], [["D'acord", function () {
      if (hash(pw.value) !== doc.fault_lock) { setTimeout(function () { A.message("Contrasenya incorrecta."); }, 0); return; }
      setTimeout(then, 0);
    }], ["Cancel·la", null]]);
  }

  A.faultManage = function () {
    var t = A.tab(), doc = t.doc;
    if (t.mode !== "edit") return;
    withPassword(doc, function show() {
      var list = el("div", { class: "faultlist" });
      (doc.faults || []).forEach(function (f) {
        var del = el("button", { text: "Elimina", on: { click: function () {
          A.checkpoint();
          doc.faults = doc.faults.filter(function (x) { return x !== f; });
          A.changed(); ui().close(); show();
        } } });
        list.appendChild(el("div", { class: "row" }, [el("span", { text: describe(doc, f.id) + " — " + (FAULT_LABELS[f.type] || f.type) }), del]));
      });
      if (!(doc.faults || []).length) list.appendChild(el("div", { class: "hint", text: "No hi ha cap avaria. Seleccioneu un element o conductor i feu «Avaries › Afegeix una avaria»." }));
      var hide = ui().check("Amaga els colors de tensió dels conductors durant la simulació", doc.fault_hide !== false);
      var pw = el("input", { type: "password", placeholder: doc.fault_lock ? "(sense canvis)" : "(cap)" });
      ui().dialog("Avaries amagades", [list, hide, ui().row("Contrasenya per veure-les:", pw),
        el("div", { class: "hint", text: "La contrasenya només evita que l'alumne vegi la llista des del programa; no xifra el fitxer." })],
      [["D'acord", function () {
        A.checkpoint();
        doc.fault_hide = hide.input.checked;
        if (pw.value) doc.fault_lock = hash(pw.value);
        A.changed();
      }], ["Elimina-les totes", function () { A.checkpoint(); doc.faults = []; A.changed(); }], ["Cancel·la", null]]);
    });
  };

  /** Student: the next click on an element or conductor says whether the fault is there. */
  A.faultDiagnose = function () {
    var doc = A.tab().doc;
    if (!(doc.faults || []).length) { A.message("Aquest esquema no té avaries amagades."); return; }
    A.diagPick = true;
    A.setStatus("Diagnòstic: feu clic sobre l'element o el conductor on creieu que hi ha l'avaria (Esc per cancel·lar).");
  };
  A.faultCheck = function (id) {
    var t = A.tab(), doc = t.doc;
    A.diagPick = false;
    t.found = t.found || {};
    t.tries = (t.tries || 0) + 1;
    var f = (doc.faults || []).find(function (x) { return x.id === id; });
    if (id == null) { A.setStatus("Diagnòstic cancel·lat: no hi havia cap element en aquell punt."); return; }
    if (f) {
      t.found[id] = true;
      var nf = Object.keys(t.found).length, tot = doc.faults.length;
      A.message("Correcte! " + describe(doc, id) + ": " + FAULT_LABELS[f.type] + ".\nAvaries trobades: " + nf + " de " + tot + " (intents: " + t.tries + ").");
    } else {
      A.message("En " + describe(doc, id) + " no hi ha cap avaria. Continueu mesurant amb la sonda.");
    }
  };

  // ================================================================ event log and timing chart
  var panel = null, panelTab = "chrono", lastPanelDraw = 0, lastLogLen = -1;
  function buildPanel() {
    if (panel) return panel;
    var tabs = el("div", { class: "ptabs" });
    var bChrono = el("button", { text: "Cronograma", on: { click: function () { A.showPanel("chrono"); } } });
    var bLog = el("button", { text: "Registre d'esdeveniments", on: { click: function () { A.showPanel("log"); } } });
    var bExp = el("button", { text: "Exporta (CSV)", title: "Desa el registre d'esdeveniments", on: { click: function () { A.exportLog(); } } });
    var bClose = el("button", { class: "pclose", text: "✖", title: "Tanca", on: { click: function () { A.showPanel(null); } } });
    tabs.appendChild(bChrono); tabs.appendChild(bLog); tabs.appendChild(el("span", { class: "grow" })); tabs.appendChild(bExp); tabs.appendChild(bClose);
    var cv = el("canvas", { id: "chrono" });
    var list = el("div", { id: "loglist" });
    panel = el("div", { id: "bpanel" }, [tabs, el("div", { class: "pbody" }, [cv, list])]);
    panel.hidden = true;
    panel.tabs = { chrono: bChrono, log: bLog };
    document.getElementById("app").insertBefore(panel, document.getElementById("statusbar"));
    return panel;
  }
  /** Open the bottom panel on "chrono" or "log"; null closes it. */
  A.showPanel = function (which) {
    var p = buildPanel();
    p.hidden = !which;
    if (which) panelTab = which;
    p.tabs.chrono.classList.toggle("on", panelTab === "chrono");
    p.tabs.log.classList.toggle("on", panelTab === "log");
    document.getElementById("chrono").hidden = panelTab !== "chrono";
    document.getElementById("loglist").hidden = panelTab !== "log";
    lastLogLen = -1;
    window.dispatchEvent(new Event("resize")); // the drawing area changed size
    A.panelUpdate(true);
  };
  A.panelOpen = function (which) { return panel && !panel.hidden && panelTab === which; };

  function fmt(t) { return t.toFixed(1).replace(".", ","); }

  A.panelUpdate = function (force) {
    if (!panel || panel.hidden) return;
    var now = Date.now();
    if (!force && now - lastPanelDraw < 100) return;
    lastPanelDraw = now;
    var t = A.tab(), sim = t.sim;
    if (panelTab === "log") {
      var list = document.getElementById("loglist"), log = sim ? sim.log : [];
      if (log.length === lastLogLen) return;
      lastLogLen = log.length;
      list.innerHTML = "";
      if (!log.length) list.appendChild(el("div", { class: "hint", text: "Engegueu la simulació: aquí apareixen els canvis d'estat de bobines, pilots, motors, accionaments i proteccions." }));
      log.slice(-400).forEach(function (e) { list.appendChild(el("div", {}, [el("b", { text: "t = " + fmt(e.t) + " s  " }), document.createTextNode(e.text)])); });
      list.scrollTop = list.scrollHeight;
      return;
    }
    drawChrono(document.getElementById("chrono"), sim);
  };

  function drawChrono(cv, sim) {
    var dpr = window.devicePixelRatio || 1, W = cv.clientWidth, ids = sim ? Object.keys(sim.sig) : [];
    var ROW = 22, TOP = 18, LAB = 120, H = Math.max(cv.parentNode.clientHeight - 4, TOP + ROW * ids.length + 6);
    cv.style.height = H + "px";
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    g.font = "11px 'Segoe UI', Helvetica, Arial, sans-serif"; g.textBaseline = "middle";
    if (!ids.length) { g.fillStyle = "#666"; g.fillText("Engegueu la simulació per veure l'evolució de bobines, pilots, motors i accionaments.", 10, 20); return; }
    var tEnd = Math.max(sim.time, 0.1), span = Math.max(10, Math.min(tEnd, 60)), t0 = Math.max(0, tEnd - span);
    var X = function (tt) { return LAB + (tt - t0) / span * (W - LAB - 10); };
    // time grid
    var stepS = span <= 12 ? 1 : span <= 30 ? 2 : 5;
    g.strokeStyle = "#e4e4e4"; g.fillStyle = "#555"; g.lineWidth = 1; g.textAlign = "center";
    for (var s = Math.ceil(t0 / stepS) * stepS; s <= tEnd; s += stepS) {
      var x = X(s); g.beginPath(); g.moveTo(x, TOP - 4); g.lineTo(x, H); g.stroke(); g.fillText(s + " s", x, 8);
    }
    ids.forEach(function (id, i) {
      var rec = sim.sig[id], y = TOP + i * ROW, hi = y + 5, lo = y + ROW - 5;
      g.fillStyle = "#000"; g.textAlign = "left"; g.fillText(rec.label, 6, y + ROW / 2);
      g.strokeStyle = "#ddd"; g.beginPath(); g.moveTo(LAB, y + ROW); g.lineTo(W, y + ROW); g.stroke();
      // segments [from, to, value]: active = shaded band with a red top edge, inactive = thin grey line
      var ch = rec.changes, v = ch[0][1], k, segs = [], from = t0;
      for (k = 0; k < ch.length && ch[k][0] <= t0; k++) v = ch[k][1];
      for (; k < ch.length; k++) { segs.push([from, ch[k][0], v]); from = ch[k][0]; v = ch[k][1]; }
      segs.push([from, tEnd, v]);
      segs.forEach(function (sg) {
        var xa = X(sg[0]), xb = Math.max(xa + 1, X(sg[1]));
        if (sg[2]) {
          g.fillStyle = "rgba(220,0,0,0.18)"; g.fillRect(xa, hi, xb - xa, lo - hi);
          g.strokeStyle = "rgb(220,0,0)"; g.lineWidth = 2;
          g.beginPath(); g.moveTo(xa, lo); g.lineTo(xa, hi); g.lineTo(xb, hi); g.lineTo(xb, lo); g.stroke();
        } else {
          g.strokeStyle = "#999"; g.lineWidth = 1;
          g.beginPath(); g.moveTo(xa, lo); g.lineTo(xb, lo); g.stroke();
        }
      });
      g.lineWidth = 1;
    });
  }

  A.exportLog = function () {
    var sim = A.tab().sim;
    if (!sim || !sim.log.length) { A.message("El registre és buit: engegueu la simulació primer."); return; }
    var csv = "temps (s);esdeveniment\n" + sim.log.map(function (e) { return fmt(e.t) + ";" + e.text.replace(/;/g, ","); }).join("\n");
    A.download(A.tab().title + "-registre.csv", new Blob(["﻿" + csv], { type: "text/csv" }));
  };

  // ================================================================ sound of the acoustic signals
  var ac = null, voices = {};
  function loadMute() { try { return localStorage.getItem("simulab.mute") === "1"; } catch (e) { return false; } }
  A.soundMuted = loadMute();
  A.toggleSound = function () {
    A.soundMuted = !A.soundMuted;
    try { localStorage.setItem("simulab.mute", A.soundMuted ? "1" : "0"); } catch (e) { /* private mode */ }
    A.setStatus(A.soundMuted ? "So dels avisadors desactivat" : "So dels avisadors activat");
    A.soundUpdate();
  };
  function audio() {
    if (ac) return ac;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    document.addEventListener("pointerdown", function () { if (ac.state === "suspended") ac.resume(); });
    return ac;
  }
  // one synthesised voice per kind: bell (fast ringing), buzzer, siren (sweep), horn
  function startVoice(kind) {
    var a = audio();
    if (!a) return null;
    var out = a.createGain(), osc = a.createOscillator(), lfo = a.createOscillator(), depth = a.createGain();
    out.gain.value = 0.05; out.connect(a.destination); osc.connect(out);
    if (kind === "Bell") { osc.type = "sine"; osc.frequency.value = 1100; lfo.type = "square"; lfo.frequency.value = 18; depth.gain.value = 0.05; lfo.connect(depth); depth.connect(out.gain); }
    else if (kind === "Buzzer") { osc.type = "square"; osc.frequency.value = 400; out.gain.value = 0.025; lfo.frequency.value = 0; }
    else if (kind === "Siren") { osc.type = "sine"; osc.frequency.value = 900; lfo.type = "triangle"; lfo.frequency.value = 0.6; depth.gain.value = 350; lfo.connect(depth); depth.connect(osc.frequency); }
    else { osc.type = "sawtooth"; osc.frequency.value = 220; out.gain.value = 0.03; lfo.frequency.value = 0; }
    osc.start(); lfo.start();
    return { stop: function () { try { osc.stop(); lfo.stop(); out.disconnect(); } catch (e) { /* already stopped */ } } };
  }
  /** Start/stop voices to match the signals sounding in the active tab's simulation. */
  A.soundUpdate = function () {
    var t = A.tab(), want = {};
    if (!A.soundMuted && t && t.mode === "sim" && t.sim) {
      t.doc.comps.forEach(function (c) {
        if (["Bell", "Buzzer", "Siren", "Horn"].indexOf(c.kind) >= 0 && t.sim.s(c.id).energized) want[c.kind] = true;
      });
    }
    Object.keys(voices).forEach(function (k) { if (!want[k]) { voices[k].stop(); delete voices[k]; } });
    Object.keys(want).forEach(function (k) { if (!voices[k]) { var v = startVoice(k); if (v) voices[k] = v; } });
  };

  // ================================================================ schematic check
  function key(p) { return p[0] + "," + p[1]; }
  A.checkDoc = function () {
    var doc = A.tab().doc, issues = [], flagged = new Set();
    function add(text, ids) { issues.push(text); (ids || []).forEach(function (i) { flagged.add(i); }); }
    var label = function (c) { return c.name || SL.KINDS[c.kind].label; };
    // connection points: terminals and conductor ends / interiors
    var termAt = {};
    doc.comps.forEach(function (c) { SL.terminals(c).forEach(function (p) { termAt[key(p)] = (termAt[key(p)] || 0) + 1; }); });
    var endAt = {};
    doc.wires.forEach(function (w) { [w.a, w.b].forEach(function (p) { endAt[key(p)] = (endAt[key(p)] || 0) + 1; }); });
    var onWire = function (p) { return endAt[key(p)] || doc.wires.some(function (w) { return SL.wireInterior(w, p); }); };
    if (!doc.comps.some(function (c) { return SL.KINDS[c.kind].role === "Feed"; })) add("No hi ha cap alimentació.");
    doc.comps.forEach(function (c) {
      var K = SL.KINDS[c.kind];
      if (K.role === "Feed" || c.kind === "Interlock") return;
      var free = SL.terminalsWithDir(c).filter(function (td, i) {
        var lab = SL.baseSymbol(c.kind).tlabels[i];
        if (lab === "PE" && K.motor) return false; // motor earth: optional in a control exercise
        return termAt[key(td.pos)] < 2 && !onWire(td.pos);
      });
      if (free.length) add(label(c) + ": " + free.length + (free.length === 1 ? " born sense connectar" : " borns sense connectar") + ".", [c.id]);
    });
    doc.wires.forEach(function (w) {
      [w.a, w.b].forEach(function (p) {
        var k = key(p), touches = endAt[k] > 1 || termAt[k] || doc.wires.some(function (o) { return o !== w && SL.wireInterior(o, p); });
        if (!touches) add("Conductor amb un extrem lliure a (" + Math.round(p[0] / 5) + ", " + Math.round(p[1] / 5) + ") mm.", [w.id]);
      });
    });
    var coilNames = {}, thermalNames = {};
    doc.comps.forEach(function (c) {
      if (!c.name) return;
      if (SL.KINDS[c.kind].coil) coilNames[c.name] = true;
      if (c.kind === "ThermalRelay3") thermalNames[c.name] = true;
    });
    doc.comps.forEach(function (c) {
      var K = SL.KINDS[c.kind];
      if (K.role !== "Contact" && K.role !== "Poles") return;
      var ok = /^Thermal/.test(c.kind) ? thermalNames[c.name] : coilNames[c.name];
      if (!c.name) add(SL.KINDS[c.kind].label + " sense nom: no el mourà cap bobina.", [c.id]);
      else if (!ok) add(c.name + " (" + K.label + "): no hi ha cap " + (/^Thermal/.test(c.kind) ? "relé tèrmic" : "bobina") + " amb aquest nom.", [c.id]);
    });
    doc.comps.forEach(function (c) {
      var K = SL.KINDS[c.kind];
      if (!K.coil || !c.name || /^(Ssr|CoilContact|Phase|Soft|Vfd|Drive)/.test(c.kind)) return;
      var used = doc.comps.some(function (o) { var R = SL.KINDS[o.kind].role; return o !== c && o.name === c.name && (R === "Contact" || R === "Poles"); });
      if (!used) add(c.name + " (" + K.label + "): cap contacte la utilitza.", [c.id]);
    });
    var seen = {};
    doc.comps.forEach(function (c) {
      var K = SL.KINDS[c.kind];
      if (!c.name || !(K.role === "Poles" || (K.role === "Load" && K.coil))) return;
      var k = K.role + "|" + c.name;
      if (seen[k]) add("Nom repetit: hi ha més d'un element " + K.label + " anomenat " + c.name + ".", [c.id, seen[k]]);
      else seen[k] = c.id;
    });
    var body = issues.length
      ? [el("div", { text: issues.length + (issues.length === 1 ? " avís:" : " avisos:") }), el("ul", { class: "checklist" }, issues.slice(0, 80).map(function (t) { return el("li", { text: t }); }))]
      : [el("div", { text: "No s'ha trobat cap problema. L'esquema està llest per simular." })];
    ui().dialog("Comprova l'esquema", body, issues.length ? [["Selecciona els elements", function () {
      if (A.tab().mode !== "edit") return;
      A.sel = flagged; A.redraw();
    }], ["Tanca", null]] : [["D'acord", null]]);
    return issues;
  };

  // ================================================================ vector export (SVG / PDF) and bill of materials
  /** A canvas-2D-like context that records the drawing as SVG. */
  function SvgCtx(w, h) {
    this.out = []; this.d = ""; this.canvas = { width: w, height: h };
    this.strokeStyle = "#000"; this.fillStyle = "#000"; this.lineWidth = 1; this.font = "10px sans-serif";
    this.textAlign = "left"; this.textBaseline = "alphabetic"; this.globalAlpha = 1; this.dash = [];
  }
  function n(v) { return Math.round(v * 100) / 100; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  SvgCtx.prototype = {
    setTransform: function () {}, clearRect: function () {}, lineJoin: "round", lineCap: "round",
    setLineDash: function (a) { this.dash = a || []; },
    beginPath: function () { this.d = ""; },
    moveTo: function (x, y) { this.d += "M" + n(x) + " " + n(y); },
    lineTo: function (x, y) { this.d += "L" + n(x) + " " + n(y); },
    closePath: function () { this.d += "Z"; },
    rect: function (x, y, w, h) { this.d += "M" + n(x) + " " + n(y) + "h" + n(w) + "v" + n(h) + "h" + n(-w) + "Z"; },
    arc: function (x, y, r, a0, a1) { this.ellipse(x, y, r, r, 0, a0, a1); },
    ellipse: function (x, y, rx, ry, rot, a0, a1) {
      var full = Math.abs(a1 - a0) >= 2 * Math.PI - 1e-6;
      if (full) {
        this.d += "M" + n(x + rx) + " " + n(y) + "A" + n(rx) + " " + n(ry) + " 0 1 1 " + n(x - rx) + " " + n(y) +
          "A" + n(rx) + " " + n(ry) + " 0 1 1 " + n(x + rx) + " " + n(y);
      } else {
        var sx = x + rx * Math.cos(a0), sy = y + ry * Math.sin(a0), ex = x + rx * Math.cos(a1), ey = y + ry * Math.sin(a1);
        this.d += (this.d ? "L" : "M") + n(sx) + " " + n(sy) + "A" + n(rx) + " " + n(ry) + " 0 " + ((a1 - a0) > Math.PI ? 1 : 0) + " 1 " + n(ex) + " " + n(ey);
      }
    },
    stroke: function () {
      if (!this.d) return;
      this.out.push('<path d="' + this.d + '" fill="none" stroke="' + this.strokeStyle + '" stroke-width="' + n(this.lineWidth) + '"' +
        (this.dash.length ? ' stroke-dasharray="' + this.dash.map(n).join(" ") + '"' : "") + ' stroke-linecap="round" stroke-linejoin="round"/>');
    },
    fill: function () { if (this.d) this.out.push('<path d="' + this.d + '" fill="' + this.fillStyle + '"' + (this.globalAlpha < 1 ? ' fill-opacity="' + this.globalAlpha + '"' : "") + "/>"); },
    strokeRect: function (x, y, w, h) { this.out.push('<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(w) + '" height="' + n(h) + '" fill="none" stroke="' + this.strokeStyle + '" stroke-width="' + n(this.lineWidth) + '"/>'); },
    fillRect: function (x, y, w, h) { this.out.push('<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(w) + '" height="' + n(h) + '" fill="' + this.fillStyle + '"/>'); },
    measureText: function (s) { var m = /([\d.]+)px/.exec(this.font); return { width: String(s).length * (m ? +m[1] : 10) * 0.55 }; },
    fillText: function (s, x, y) {
      var m = /([\d.]+)px/.exec(this.font), size = m ? +m[1] : 10;
      var anchor = { left: "start", start: "start", center: "middle", right: "end", end: "end" }[this.textAlign] || "start";
      var dy = { middle: 0.35, top: 0.8, hanging: 0.8, bottom: -0.2, alphabetic: 0 }[this.textBaseline] || 0;
      this.out.push('<text x="' + n(x) + '" y="' + n(y + dy * size) + '" font-size="' + n(size) + '" font-family="Helvetica, Arial, sans-serif" text-anchor="' + anchor + '" fill="' + this.fillStyle + '">' + esc(s) + "</text>");
    },
  };

  /** SVG of each sheet of the active document (1 world unit = 0.2 mm). */
  function sheetSvgs() {
    var t = A.tab(), doc = t.doc, ps = SL.PAGE_SIZES[doc.page.size], count = doc.page.count || 1, out = [];
    for (var k = 0; k < count; k++) {
      var g = new SvgCtx(ps.w, ps.h), oy = SL.sheetY ? SL.sheetY(doc, k) : 0;
      var r = new SL.Renderer(g, { zoom: 1, panX: 0, panY: -oy });
      SL.drawDoc(r, t, { grid: false, sel: new Set(), dx: 0, dy: 0, noShadow: true, sheet: k });
      out.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + ps.w / 5 + 'mm" height="' + ps.h / 5 + 'mm" viewBox="0 0 ' + ps.w + " " + ps.h + '">' +
        '<rect width="100%" height="100%" fill="#fff"/>' + g.out.join("") + "</svg>");
    }
    return out;
  }
  A.exportSVG = function () {
    var svgs = sheetSvgs(), title = A.tab().title;
    svgs.forEach(function (svg, k) {
      A.download(title + (svgs.length > 1 ? "-full" + (k + 1) : "") + ".svg", new Blob([svg], { type: "image/svg+xml" }));
    });
  };
  /** Print (or save as PDF from the print dialog) in vector form, one sheet per page. */
  A.printVector = function () {
    var doc = A.tab().doc, ps = SL.PAGE_SIZES[doc.page.size], land = ps.w > ps.h;
    var a3 = Math.max(ps.w, ps.h) > 1600, size = (a3 ? "A3" : "A4") + (land ? " landscape" : " portrait");
    var w = window.open("", "_blank");
    if (!w) { A.message("Permeteu les finestres emergents per imprimir"); return; }
    w.document.write("<!doctype html><title>" + esc(A.tab().title) + "</title><style>@page{size:" + size + ";margin:0}body{margin:0}" +
      "svg{display:block;width:100vw;height:100vh;page-break-after:always}</style>" + sheetSvgs().join("") +
      "<script>setTimeout(function(){print()},300)<\/script>");
    w.document.close();
  };

  A.exportBOM = function () {
    var doc = A.tab().doc, groups = {}, order = [];
    var rank = { Poles: 6, Load: 5, Manual: 4, Converter: 4, Passive: 3, Actuator: 2, Logic: 2, Contact: 1, Feed: 0 };
    doc.comps.forEach(function (c) {
      var K = SL.KINDS[c.kind];
      if (K.role === "Feed" && !c.name) return;
      var k = c.name ? "n:" + c.name : "k:" + c.kind;
      var g = groups[k];
      if (!g) { g = groups[k] = { ref: c.name || "", kind: c.kind, func: c.func || "", n: 0, sym: 0 }; order.push(k); }
      g.sym++;
      if (!c.name) g.n++; else g.n = 1;
      if ((rank[K.role] || 0) > (rank[SL.KINDS[g.kind].role] || 0)) g.kind = c.kind;
      if (!g.func && c.func) g.func = c.func;
    });
    var rows = order.map(function (k) { return groups[k]; }).sort(function (a, b) {
      return (a.ref || "~").localeCompare(b.ref || "~", "ca", { numeric: true });
    });
    var q = function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; };
    var csv = "Referència;Descripció;Funció;Quantitat;Símbols a l'esquema\n" + rows.map(function (g) {
      return [g.ref || "—", SL.KINDS[g.kind].label, g.func, g.n, g.sym].map(q).join(";");
    }).join("\n");
    A.download(A.tab().title + "-materials.csv", new Blob(["﻿" + csv], { type: "text/csv" }));
  };
})((typeof globalThis !== "undefined" ? globalThis : window).SL);
