// SimuLAB — application state, commands, menus, toolbars, dialogs.
// The drawing area (mouse input and painting) is in editor.js.
"use strict";
(function (SL) {
  var APP = "SimuLAB";
  var STEP_SECS = 0.1; // "Paso a paso" advance (estimated, as in the Mac app)
  var STORE = "simulab.tabs.v1";

  var A = SL.app = {
    tabs: [], active: 0, tool: { t: "select" }, placeRot: 0, placeMirror: false, cat: "Feeds",
    sel: new Set(), drag: null, wireFrom: null, hover: null, clip: null, pasteN: 0,
    grid: true, showToolbar: true, showStatus: true, showSymbars: true,
    drawColor: [0, 0, 0], fillColor: [255, 255, 200], drawWidth: 1, docCounter: 1,
    pressed: null, lastT: null, needsDraw: true, dialogOpen: false,
  };

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "on") Object.keys(attrs.on).forEach(function (ev) { e.addEventListener(ev, attrs.on[ev]); });
      else if (k === "text") e.textContent = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  SL.el = el;

  // ------------------------------------------------------------------ tabs
  function newTab(title, doc) {
    return { doc: doc, title: title, dirty: false, undo: [], redo: [], sim: null, mode: "edit",
      view: { zoom: 0.75, panX: 20, panY: 16 }, prevViews: [], fitted: false };
  }
  A.tab = function () { return A.tabs[A.active]; };
  A.redraw = function () { A.needsDraw = true; };
  A.checkpoint = function () {
    var t = A.tab();
    t.undo.push(JSON.stringify(t.doc));
    if (t.undo.length > 200) t.undo.shift();
    t.redo = [];
    t.dirty = true;
    A.changed();
  };
  var saveTimer = null;
  A.changed = function () {
    A.redraw();
    renderTabs();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400);
  };
  function persist() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        active: A.active, counter: A.docCounter,
        tabs: A.tabs.map(function (t) { return { title: t.title, dirty: t.dirty, doc: t.doc }; }),
      }));
    } catch (e) { /* storage full or blocked */ }
  }
  function restore() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE) || "null");
      if (!s || !s.tabs || !s.tabs.length) return false;
      A.tabs = s.tabs.map(function (x) { var t = newTab(x.title, SL.normalizeDoc(x.doc)); t.dirty = !!x.dirty; return t; });
      A.active = Math.min(s.active || 0, A.tabs.length - 1);
      A.docCounter = s.counter || A.tabs.length;
      return true;
    } catch (e) { return false; }
  }

  A.newDoc = function () {
    A.docCounter++;
    A.tabs.push(newTab("Esquema" + A.docCounter, SL.newDoc()));
    A.active = A.tabs.length - 1;
    A.sel.clear();
    A.changed();
  };
  A.loadExample = function (which) {
    A.docCounter++;
    var doc = which === 3 ? SL.exampleRevDoc() : which === 2 ? SL.exampleYdDoc() : SL.exampleDoc();
    A.tabs.push(newTab("Exemple" + A.docCounter, doc));
    A.active = A.tabs.length - 1;
    A.sel.clear();
    A.changed();
  };
  A.closeTab = function (i) {
    A.tabs.splice(i, 1);
    if (!A.tabs.length) { A.tabs.push(newTab("Esquema" + (++A.docCounter), SL.newDoc())); }
    if (A.active >= i && A.active > 0) A.active--;
    A.active = Math.min(A.active, A.tabs.length - 1);
    A.sel.clear();
    A.changed();
  };
  A.requestClose = function (i) {
    if (A.tabs[i].dirty) {
      dialog("SimuLAB", [el("div", { text: "Voleu desar els canvis a " + A.tabs[i].title + "?" })], [
        ["Sí", function () { A.active = i; A.save(); A.closeTab(i); }],
        ["No", function () { A.closeTab(i); }],
        ["Cancel·la", null],
      ]);
    } else A.closeTab(i);
  };

  // ------------------------------------------------------------------ files
  A.open = function () { $("fileinput").value = ""; $("fileinput").click(); };
  function onFile(e) {
    var f = e.target.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var doc = SL.normalizeDoc(JSON.parse(rd.result));
        var t = newTab(f.name.replace(/\.[^.]+$/, ""), doc);
        var t0 = A.tabs[0];
        if (A.tabs.length === 1 && !t0.dirty && !t0.doc.comps.length) A.tabs[0] = t; else A.tabs.push(t);
        A.active = A.tabs.indexOf(t);
        A.sel.clear();
        A.changed();
      } catch (err) { message("El fitxer no és vàlid"); }
    };
    rd.onerror = function () { message("No es pot obrir el fitxer"); };
    rd.readAsText(f);
  }
  function download(name, blob) {
    var a = el("a", { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  A.save = function () {
    var t = A.tab();
    download(t.title + ".ecs", new Blob([JSON.stringify(t.doc, null, 2)], { type: "application/json" }));
    t.dirty = false;
    A.changed();
    setStatus("Desat com a " + t.title + ".ecs (a Baixades)");
  };
  A.saveAs = function () {
    var t = A.tab();
    promptText("Anomena i desa", "Nom:", t.title, function (v) {
      if (v) { t.title = v; A.save(); }
    });
  };
  function pageCanvas() {
    var t = A.tab(), ps = SL.PAGE_SIZES[t.doc.page.size], scale = 1.5;
    var c = document.createElement("canvas");
    c.width = Math.round(ps.w * scale); c.height = Math.round(ps.h * scale);
    var r = new SL.Renderer(c.getContext("2d"), { zoom: scale, panX: 0, panY: 0 });
    SL.drawDoc(r, t, { grid: false, sel: new Set(), dx: 0, dy: 0, noShadow: true });
    return c;
  }
  A.exportImage = function () {
    pageCanvas().toBlob(function (b) { download(A.tab().title + ".png", b); });
  };
  A.print = function () {
    var url = pageCanvas().toDataURL("image/png");
    var w = window.open("", "_blank");
    if (!w) { message("Permeteu les finestres emergents per imprimir"); return; }
    w.document.write("<title>" + A.tab().title + "</title><style>@page{size:landscape;margin:8mm}body{margin:0}img{width:100%}</style>" +
      "<img src='" + url + "' onload='setTimeout(function(){print()},200)'>");
    w.document.close();
  };

  // ------------------------------------------------------------------ editing
  A.undo = function () {
    var t = A.tab();
    if (t.mode !== "edit" || !t.undo.length) return;
    t.redo.push(JSON.stringify(t.doc));
    t.doc = JSON.parse(t.undo.pop());
    t.dirty = true; A.sel.clear(); A.changed();
  };
  A.redo = function () {
    var t = A.tab();
    if (t.mode !== "edit" || !t.redo.length) return;
    t.undo.push(JSON.stringify(t.doc));
    t.doc = JSON.parse(t.redo.pop());
    t.dirty = true; A.sel.clear(); A.changed();
  };
  A.deleteSel = function () {
    var t = A.tab();
    if (!A.sel.size || t.mode !== "edit") return;
    A.checkpoint();
    ["comps", "wires", "texts", "drawings"].forEach(function (k) {
      t.doc[k] = t.doc[k].filter(function (o) { return !A.sel.has(o.id); });
    });
    A.sel.clear(); A.changed();
  };
  A.copy = function () {
    if (!A.sel.size) return;
    var d = A.tab().doc, pick = function (l) { return JSON.parse(JSON.stringify(l.filter(function (o) { return A.sel.has(o.id); }))); };
    A.clip = { comps: pick(d.comps), wires: pick(d.wires), texts: pick(d.texts), drawings: pick(d.drawings) };
    A.pasteN = 0;
  };
  A.cut = function () { A.copy(); A.deleteSel(); };
  A.paste = function () {
    var t = A.tab();
    if (!A.clip || t.mode !== "edit") return;
    A.checkpoint();
    var off = 30 * (++A.pasteN), c = JSON.parse(JSON.stringify(A.clip)), d = t.doc;
    A.sel.clear();
    c.comps.forEach(function (o) { o.id = SL.newId(d); o.x += off; o.y += off; d.comps.push(o); A.sel.add(o.id); });
    c.wires.forEach(function (o) { o.id = SL.newId(d); o.a = [o.a[0] + off, o.a[1] + off]; o.b = [o.b[0] + off, o.b[1] + off]; d.wires.push(o); A.sel.add(o.id); });
    c.texts.forEach(function (o) { o.id = SL.newId(d); o.x += off; o.y += off; d.texts.push(o); A.sel.add(o.id); });
    c.drawings.forEach(function (o) { o.id = SL.newId(d); o.a = [o.a[0] + off, o.a[1] + off]; o.b = [o.b[0] + off, o.b[1] + off]; d.drawings.push(o); A.sel.add(o.id); });
    A.changed();
  };
  A.selectAll = function () {
    var d = A.tab().doc;
    A.sel = new Set([].concat(d.comps, d.wires, d.texts, d.drawings).map(function (o) { return o.id; }));
    A.redraw();
  };
  A.rotate = function (delta, mirror) {
    if (A.tool.t === "place") {
      if (mirror) A.placeMirror = !A.placeMirror; else A.placeRot = (A.placeRot + delta) % 4;
      A.redraw(); return;
    }
    var t = A.tab(), cs = t.doc.comps.filter(function (c) { return A.sel.has(c.id); });
    if (t.mode !== "edit" || !cs.length) return;
    A.checkpoint();
    cs.forEach(function (c) { if (mirror) c.mirror = !c.mirror; else c.rot = (c.rot + delta) % 4; });
    A.changed();
  };
  A.defaultName = function (kind) {
    var doc = A.tab().doc, K = SL.KINDS[kind];
    if (K.role === "Feed") return "";
    if (K.role === "Contact" || K.role === "Poles") {
      var want = function (k) {
        if (kind === "ThermalNO" || kind === "ThermalNC") return k === "ThermalRelay3";
        if (kind.indexOf("Timed") === 0) return SL.KINDS[k].timer;
        return k === "Coil" || k === "StepRelay" || SL.KINDS[k].timer;
      };
      for (var i = doc.comps.length - 1; i >= 0; i--) {
        var c = doc.comps[i];
        if (want(c.kind) && c.name) return c.name;
      }
      return K.prefix + "1";
    }
    return SL.nextName(doc, kind);
  };
  A.place = function (kind, x, y) {
    var name = A.defaultName(kind);
    A.checkpoint();
    var c = SL.makeComp(A.tab().doc, kind, x, y, A.placeRot, name);
    c.mirror = A.placeMirror;
    A.sel = new Set([c.id]);
    A.changed();
  };
  A.setTool = function (t) {
    if (A.tab().mode !== "edit" && t.t !== "select" && t.t !== "zoomwin") return;
    A.tool = t; A.wireFrom = null; A.drag = null;
    if (t.t !== "place") { A.placeRot = 0; A.placeMirror = false; }
    var msg = {
      wire: "Cable: feu clic a l'inici i a cada cantonada; acaba en arribar a un terminal o a un altre cable (Esc cancel·la)",
      text: "Text: feu clic on vulgueu escriure",
      shape: "Dibuix: arrossegueu per dibuixar",
      zoomwin: "Zoom finestra: arrossegueu un rectangle",
      select: "Preparat",
    }[t.t] || (SL.KINDS[t.kind] ? SL.KINDS[t.kind].label + ": feu clic a l'esquema per col·locar-lo (R gira, M mirall, Esc acaba)" : "");
    setStatus(msg);
    renderToolbars(); renderSymbars(); A.redraw();
  };

  // ------------------------------------------------------------------ simulation
  A.startSim = function (all) {
    A.wireFrom = null; A.drag = null; A.sel.clear(); A.tool = { t: "select" };
    var faults = [];
    (all ? A.tabs : [A.tab()]).forEach(function (t) {
      if (t.mode === "pause") { t.mode = "sim"; return; }
      if (t.mode === "edit") {
        t.sim = new SL.Sim(t.doc); t.mode = "sim";
        var f = t.sim.tick(t.doc, 0);
        if (f) faults.push([t, f]);
      }
    });
    A.lastT = null;
    setStatus("Simulació: feu clic sobre polsadors, interruptors i automàtics per accionar-los");
    faults.forEach(function (x) { A.fault(x[0], x[1]); });
    refreshAll();
  };
  A.stopSim = function () {
    var t = A.tab();
    t.mode = "edit"; t.sim = null; A.pressed = null;
    setStatus("Preparat");
    refreshAll();
  };
  A.pause = function () {
    var t = A.tab();
    if (t.mode === "sim") t.mode = "pause"; else if (t.mode === "pause") t.mode = "sim";
    refreshAll();
  };
  A.step = function () {
    if (A.tab().mode === "edit") A.startSim(false);
    var t = A.tab();
    if (t.mode === "edit") return;
    t.mode = "pause";
    var f = t.sim.tick(t.doc, STEP_SECS);
    if (f) A.fault(t, f);
    refreshAll();
  };
  /** As in the original: message, stop, back to editing. */
  A.fault = function (t, f) {
    t.mode = "edit"; A.pressed = null;
    setStatus("Preparat");
    message(SL.FAULTS[f] || f);
    refreshAll();
  };
  A.runSim = function (now) {
    var dt = A.lastT == null ? 0 : Math.min(0.25, Math.max(0, (now - A.lastT) / 1000));
    A.lastT = now;
    var any = false;
    A.tabs.forEach(function (t) {
      if (t.mode !== "sim") return;
      any = true;
      var f = t.sim.tick(t.doc, dt);
      if (f) A.fault(t, f);
    });
    if (!any) A.lastT = null;
    return any;
  };

  // ------------------------------------------------------------------ view
  A.canvasRect = function () { var c = $("canvas"); return { w: c.clientWidth, h: c.clientHeight }; };
  A.zoomAt = function (f, sx, sy) {
    var v = A.tab().view, wx = (sx - v.panX) / v.zoom, wy = (sy - v.panY) / v.zoom;
    v.zoom = Math.min(6, Math.max(0.1, v.zoom * f));
    v.panX = sx - wx * v.zoom; v.panY = sy - wy * v.zoom;
    A.redraw(); updateStatus();
  };
  A.pushView = function () { var t = A.tab(); t.prevViews.push(Object.assign({}, t.view)); };
  A.zoomPrev = function () { var t = A.tab(); if (t.prevViews.length) { t.view = t.prevViews.pop(); A.redraw(); } };
  A.zoomRect = function (a, b) {
    var cr = A.canvasRect(), w = Math.max(30, Math.abs(b[0] - a[0])), h = Math.max(30, Math.abs(b[1] - a[1]));
    var z = Math.min(6, Math.max(0.1, Math.min((cr.w - 30) / w, (cr.h - 30) / h)));
    var v = A.tab().view;
    v.zoom = z; v.panX = cr.w / 2 - (a[0] + b[0]) / 2 * z; v.panY = cr.h / 2 - (a[1] + b[1]) / 2 * z;
    A.redraw(); updateStatus();
  };
  A.zoomAll = function () { var ps = SL.PAGE_SIZES[A.tab().doc.page.size]; A.zoomRect([0, 0], [ps.w, ps.h]); };
  A.zoomCenter = function (f) { var cr = A.canvasRect(); A.pushView(); A.zoomAt(f, cr.w / 2, cr.h / 2); };

  // ------------------------------------------------------------------ dialogs
  function closeDialog() { $("overlay").hidden = true; $("dialog").innerHTML = ""; A.dialogOpen = false; $("canvas").focus(); }
  function dialog(title, body, buttons) {
    var d = $("dialog");
    d.innerHTML = "";
    d.appendChild(el("h2", { text: title }));
    d.appendChild(el("div", { class: "body" }, body));
    var bs = el("div", { class: "buttons" });
    buttons.forEach(function (b, i) {
      var btn = el("button", { text: b[0], on: { click: function () { var keep = b[1] && b[1]() === false; if (!keep) closeDialog(); } } });
      if (i === 0) btn.setAttribute("data-default", "1");
      bs.appendChild(btn);
    });
    d.appendChild(bs);
    $("overlay").hidden = false;
    A.dialogOpen = true;
    var first = d.querySelector("input[type=text],input[type=number]");
    (first || bs.firstChild).focus();
    if (first && first.select) first.select();
  }
  function message(text) {
    dialog(APP, [el("div", { class: "msg" }, [el("span", { class: "warn", text: "⚠" }), el("span", { text: text })])], [["D'acord", null]]);
  }
  A.message = message;
  function row(label, input) { return el("div", { class: "row" }, [el("label", { text: label }), input]); }
  function textInput(v) { var i = el("input", { type: "text" }); i.value = v || ""; return i; }
  function radios(name, options, value) {
    var box = el("div", { class: "radios" });
    options.forEach(function (o) {
      var r = el("input", { type: "radio", name: name, value: String(o[0]) });
      if (String(o[0]) === String(value)) r.checked = true;
      box.appendChild(el("label", {}, [r, document.createTextNode(" " + o[1])]));
    });
    box.value = function () { var c = box.querySelector("input:checked"); return c ? c.value : null; };
    return box;
  }
  function check(label, v) {
    var c = el("input", { type: "checkbox" }); c.checked = !!v;
    var l = el("label", {}, [c, document.createTextNode(" " + label)]);
    l.input = c; return l;
  }
  function promptText(title, label, value, done) {
    var i = textInput(value);
    dialog(title, [row(label, i)], [["D'acord", function () { done(i.value.trim()); }], ["Cancel·la", null]]);
  }

  A.openProps = function (id) {
    var t = A.tab(), c = t.doc.comps.find(function (x) { return x.id === id; });
    if (!c) {
      var tx = t.doc.texts.find(function (x) { return x.id === id; });
      if (tx) A.textDialog(tx, null);
      return;
    }
    var K = SL.KINDS[c.kind], name = textInput(c.name), func = textInput(c.func), body = [el("b", { text: K.label }), row("Nom:", name), row("Funció:", func)];
    var base, mult, color;
    if (K.timer) {
      base = el("input", { type: "number", step: "1", min: "0", style: "width:80px" }); base.value = c.time_base;
      mult = radios("mult", [[0.1, "x 0,1 Seg"], [1, "x 1 Seg"], [10, "x 10 Seg"], [60, "x 60 Seg"]], c.time_mult);
      body.push(el("div", {}, [el("div", { text: "Temporització" }), el("div", { class: "radios" }, [base, mult])]));
    }
    if (c.kind === "Lamp") {
      color = radios("color", SL.LAMP_COLOR_OPTIONS || Object.keys(SL.LAMP_COLORS).map(function (k) { return [k, k]; }), c.color);
      body.push(el("div", {}, [el("div", { text: "Color" }), color]));
    }
    if (K.role === "Contact" || K.role === "Poles") body.push(el("div", { class: "hint", text: "Els contactes segueixen la bobina, temporitzador o relé tèrmic amb el mateix nom." }));
    if (K.role === "Actuator") body.push(el("div", { class: "hint", text: "Tots els accionaments amb el mateix nom es mouen alhora." }));
    var title = K.timer ? "Temporitzadors" : c.kind === "Lamp" ? "Indicador color" : "Edita";
    dialog(title, body, [["D'acord", function () {
      A.checkpoint();
      c.name = name.value.trim(); c.func = func.value;
      if (base) { var b = parseFloat(String(base.value).replace(",", ".")); c.time_base = isFinite(b) && b >= 0 ? b : 5; c.time_mult = parseFloat(mult.value()) || 1; }
      if (color) c.color = color.value() || "Verde";
      A.changed();
    }], ["Cancel·la", null]]);
  };
  A.textDialog = function (item, pos) {
    var txt = textInput(item ? item.text : ""), size = el("input", { type: "number", min: "6", max: "60", style: "width:70px" });
    size.value = item ? item.size : 14;
    dialog("Text", [row("Text:", txt), row("Mida:", size)], [["D'acord", function () {
      var v = txt.value.trim();
      if (!v) return;
      A.checkpoint();
      if (item) { item.text = v; item.size = +size.value || 14; }
      else A.tab().doc.texts.push({ id: SL.newId(A.tab().doc), x: pos[0], y: pos[1], text: v, size: +size.value || 14, color: A.drawColor.slice() });
      A.changed();
    }], ["Cancel·la", null]]);
  };
  A.titleDialog = function () {
    var tb = A.tab().doc.title, fields = [["Dibuixat", "drawn"], ["Comprovat", "checked"], ["Data", "date"], ["Entitat", "entity"], ["Títol", "title"], ["Número", "number"]];
    var inputs = fields.map(function (f) { return textInput(tb[f[1]]); });
    dialog("Caixetí", fields.map(function (f, i) { return row(f[0], inputs[i]); }), [["D'acord", function () {
      A.checkpoint();
      fields.forEach(function (f, i) { tb[f[1]] = inputs[i].value; });
      A.tab().doc.page.title_block = true;
      A.changed();
    }], ["Cancel·la", null]]);
  };
  A.configDialog = function () {
    var pg = A.tab().doc.page;
    var size = radios("size", Object.keys(SL.PAGE_SIZES).map(function (k) { return [k, SL.PAGE_SIZES[k].label]; }), pg.size);
    var b = check("Contorn", pg.border), r = check("Referències", pg.references), t = check("Caixetí", pg.title_block), s = check("Visualitza connexions símbol", pg.show_terminals);
    dialog("Configuració", [el("div", { text: "Format" }), size, b, r, t, s], [["D'acord", function () {
      A.checkpoint();
      pg.size = size.value() || pg.size; pg.border = b.input.checked; pg.references = r.input.checked;
      pg.title_block = t.input.checked; pg.show_terminals = s.input.checked;
      A.changed();
    }], ["Cancel·la", null]]);
  };
  A.about = function () {
    dialog("Quant a " + APP, [el("div", { html: "<b>SimuLAB</b> — versió web 1.0<br>Editor i simulador d'esquemes elèctrics de comandament i potència.<br>Els esquemes es desen com a fitxers .ecs, compatibles amb la versió per a macOS." })], [["D'acord", null]]);
  };

  // ------------------------------------------------------------------ menus & bars
  var ICONS = {
    "new": "<path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' fill='#fff'/><path d='M14 2v6h6M12 18v-6M9 15h6'/>",
    open: "<path d='M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' fill='#f6d365'/>",
    save: "<path d='M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z' fill='#e8f0fe'/><path d='M17 21v-8H7v8' fill='#fff'/><path d='M7 3v5h8'/>",
    print: "<path d='M6 9V2h12v7' fill='#fff'/><path d='M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2' fill='#dce1e7'/><rect x='6' y='14' width='12' height='8' fill='#fff'/>",
    cut: "<circle cx='6' cy='6' r='3'/><circle cx='6' cy='18' r='3'/><path d='M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12'/>",
    copy: "<rect x='9' y='9' width='13' height='13' rx='2' fill='#fff'/><path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'/>",
    paste: "<path d='M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2' fill='#fff'/><rect x='8' y='2' width='8' height='4' rx='1' fill='#dce1e7'/><path d='M9 12h6M9 16h6'/>",
    zoomin: "<circle cx='11' cy='11' r='7' fill='#e8f4fd'/><path d='M21 21l-4.35-4.35M11 8v6M8 11h6'/>",
    zoomout: "<circle cx='11' cy='11' r='7' fill='#e8f4fd'/><path d='M21 21l-4.35-4.35M8 11h6'/>",
    zoomwin: "<rect x='3' y='3' width='18' height='18' rx='2' stroke-dasharray='3 2'/><circle cx='11' cy='11' r='4' fill='#e8f4fd'/><path d='M16 16l-2.2-2.2'/>",
    zoomall: "<path d='M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7M3 9V3h6M21 15v6h-6'/>",
    zoomprev: "<circle cx='11' cy='11' r='7' fill='#e8f4fd'/><path d='M21 21l-4.35-4.35M9 11h5M11 9l-2 2 2 2'/>",
    grid: "<rect x='3' y='3' width='18' height='18' rx='2' fill='#fff'/><path d='M3 9h18M3 15h18M9 3v18M15 3v18' stroke-width='1.3'/>",
    undo: "<path d='M3 7v6h6'/><path d='M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13'/>",
    redo: "<path d='M21 7v6h-6'/><path d='M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7'/>",
    rotl: "<path d='M2.5 2v6h6'/><path d='M2.66 15.57a10 10 0 1 0 .57-8.38L2.5 8'/>",
    rotr: "<path d='M21.5 2v6h-6'/><path d='M21.34 15.57a10 10 0 1 1-.57-8.38L21.5 8'/>",
    mirror: "<path d='M12 3v18' stroke-dasharray='2 2'/><path d='M9 6L3 18h6z' fill='#cfe2ff'/><path d='M15 6l6 12h-6z' fill='#fff'/>",
    play: "<polygon points='6 3 20 12 6 21 6 3' fill='#28a745' stroke='#1e7e34'/>",
    stop: "<rect x='5' y='5' width='14' height='14' rx='2' fill='#dc3545' stroke='#bd2130'/>",
    pause: "<rect x='6' y='4' width='4.5' height='16' rx='1' fill='#fd7e14' stroke='#d96200'/><rect x='13.5' y='4' width='4.5' height='16' rx='1' fill='#fd7e14' stroke='#d96200'/>",
    step: "<polygon points='4 4 14 12 4 20 4 4' fill='#28a745' stroke='#1e7e34'/><rect x='16.5' y='4' width='3.5' height='16' rx='1' fill='#2b6cb0' stroke='#1e4e8c'/>",
    all: "<polygon points='2 4 11 12 2 20 2 4' fill='#28a745' stroke='#1e7e34'/><polygon points='12 4 21 12 12 20 12 4' fill='#28a745' stroke='#1e7e34'/>",
    info: "<circle cx='12' cy='12' r='10' fill='#e8f4fd' stroke='#1d6fa5'/><path d='M12 16v-5M12 8h.01' stroke='#1d6fa5' stroke-width='2.2'/>",
    select: "<path d='M5 3l13 9.5-6 1.2 3.8 6.8-2.4 1.3-3.8-6.8-4.6 3.8z' fill='#fff'/>",
    wire: "<path d='M4 5v14h16' stroke='#0050c8' stroke-width='2'/><circle cx='4' cy='5' r='2.5' fill='#dc3545' stroke='#900'/><circle cx='20' cy='19' r='2.5' fill='#dc3545' stroke='#900'/>",
    line: "<path d='M4 20L20 4'/><circle cx='4' cy='20' r='2' fill='#fff'/><circle cx='20' cy='4' r='2' fill='#fff'/>",
    rect: "<rect x='3' y='5' width='18' height='14' rx='1.5' fill='#fff'/>",
    ellipse: "<ellipse cx='12' cy='12' rx='9' ry='6.5' fill='#fff'/>",
    frect: "<rect x='3' y='5' width='18' height='14' rx='1.5' fill='#ffe066'/>",
    fellipse: "<ellipse cx='12' cy='12' rx='9' ry='6.5' fill='#ffe066'/>",
    text: "<path d='M4 7V4h16v3M9 20h6M12 4v16'/>",
  };
  var tipEl = null, tipTimer = null;
  function showTip(target, text) {
    if (!text) return;
    if (!tipEl) {
      tipEl = el("div", { id: "custom-tooltip" });
      document.body.appendChild(tipEl);
    }
    tipEl.textContent = text;
    tipEl.classList.add("visible");
    var r = target.getBoundingClientRect();
    var tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    var left = Math.max(6, Math.min(window.innerWidth - tw - 6, r.left + r.width / 2 - tw / 2));
    var top = r.bottom + 7;
    if (top + th > window.innerHeight - 6) top = r.top - th - 7;
    tipEl.style.left = Math.round(left) + "px";
    tipEl.style.top = Math.round(top) + "px";
  }
  function hideTip() {
    clearTimeout(tipTimer);
    tipTimer = null;
    if (tipEl) tipEl.classList.remove("visible");
  }
  function attachTip(b, tip) {
    b.removeAttribute("title");
    b.setAttribute("aria-label", tip);
    b.addEventListener("pointerenter", function () {
      clearTimeout(tipTimer);
      tipTimer = setTimeout(function () { showTip(b, tip); }, 500);
    });
    b.addEventListener("pointerleave", hideTip);
    b.addEventListener("pointerdown", hideTip);
  }
  function tb(icon, tip, fn, on) {
    var b = el("button", { class: "tb" + (on ? " on" : ""), html: "<svg viewBox='0 0 24 24'>" + ICONS[icon] + "</svg>" });
    attachTip(b, tip);
    b.addEventListener("click", function () { fn(); $("canvas").focus(); });
    return b;
  }
  function sep() { return el("span", { class: "sep" }); }

  function renderToolbars() {
    var t = A.tab(), mode = t.mode, T = A.tool;
    var a = $("toolbar1"); a.innerHTML = "";
    [tb("new", "Nou", A.newDoc), tb("open", "Obre", A.open), tb("save", "Desa", A.save), tb("print", "Imprimeix", A.print), sep(),
      tb("cut", "Retalla", A.cut), tb("copy", "Copia", A.copy), tb("paste", "Enganxa", A.paste), sep(),
      tb("zoomin", "Zoom +", function () { A.zoomCenter(1.25); }), tb("zoomout", "Zoom -", function () { A.zoomCenter(0.8); }),
      tb("zoomwin", "Zoom finestra", function () { A.setTool({ t: "zoomwin" }); }, T.t === "zoomwin"),
      tb("zoomall", "Zoom tot", function () { A.pushView(); A.zoomAll(); }), tb("zoomprev", "Zoom anterior", A.zoomPrev),
      tb("grid", "Reixeta", function () { A.grid = !A.grid; renderToolbars(); A.redraw(); }, A.grid), sep(),
      tb("undo", "Desfés", A.undo), tb("redo", "Refés", A.redo), sep(),
      tb("rotl", "Gira a l'esquerra", function () { A.rotate(3, false); }), tb("rotr", "Gira a la dreta (R)", function () { A.rotate(1, false); }),
      tb("mirror", "Mirall (M)", function () { A.rotate(0, true); }), sep(),
      tb("play", "Simulació (F5)", function () { A.startSim(false); }, mode === "sim"), tb("stop", "Stop / Edició", A.stopSim, mode === "edit"),
      tb("pause", "Pausa", A.pause, mode === "pause"), tb("step", "Pas a pas", A.step), tb("all", "Simula tots els documents", function () { A.startSim(true); }), sep(),
      tb("info", "Quant a", A.about)].forEach(function (x) { a.appendChild(x); });
    var b = $("toolbar2"); b.innerHTML = "";
    b.appendChild(tb("select", "Selecciona", function () { A.setTool({ t: "select" }); }, T.t === "select"));
    b.appendChild(tb("wire", "Cable (connecta terminals)", function () { A.setTool({ t: "wire" }); }, T.t === "wire"));
    b.appendChild(sep());
    [["line", "Línia", "Line"], ["rect", "Rectangle", "Rect"], ["ellipse", "El·lipse", "Ellipse"], ["frect", "Rectangle acolorit", "FilledRect"], ["fellipse", "El·lipse acolorida", "FilledEllipse"]].forEach(function (s) {
      b.appendChild(tb(s[0], s[1], function () { A.setTool({ t: "shape", kind: s[2] }); }, T.t === "shape" && T.kind === s[2]));
    });
    b.appendChild(tb("text", "Text", function () { A.setTool({ t: "text" }); }, T.t === "text"));
    b.appendChild(sep());
    function colorInput(label, arr) {
      var i = el("input", { type: "color", title: label });
      i.value = "#" + arr.map(function (v) { return ("0" + v.toString(16)).slice(-2); }).join("");
      i.addEventListener("input", function () { var h = i.value; for (var k = 0; k < 3; k++) arr[k] = parseInt(h.substr(1 + 2 * k, 2), 16); });
      return el("label", {}, [document.createTextNode(label), i]);
    }
    b.appendChild(colorInput("Color", A.drawColor));
    b.appendChild(colorInput("Farciment", A.fillColor));
    var sel = el("select", { title: "Gruix" });
    [1, 2, 3, 4].forEach(function (w) { var o = el("option", { value: String(w), text: "Gruix " + w }); if (w === A.drawWidth) o.selected = true; sel.appendChild(o); });
    sel.addEventListener("change", function () { A.drawWidth = +sel.value; });
    b.appendChild(sel);
    $("toolbar1").hidden = $("toolbar2").hidden = !A.showToolbar;
  }

  function renderCatbar() {
    var c = $("catbar"); c.innerHTML = "";
    SL.CATS.forEach(function (cat) {
      var cv = el("canvas");
      var b = el("button", { class: "catbtn" + (A.cat === cat.id ? " on" : "") }, [cv]);
      attachTip(b, cat.label);
      b.addEventListener("click", function () { A.cat = cat.id; renderCatbar(); renderSymbars(); });
      c.appendChild(b);
      requestAnimationFrame(function () { SL.drawIcon(cv, cat.icon, "#1a1a1a"); });
    });
    c.appendChild(el("span", { id: "catlabel", text: (SL.CATS.find(function (x) { return x.id === A.cat; }) || {}).label }));
    c.hidden = !A.showSymbars;
  }
  function renderSymbars() {
    var s = $("symbar"), edit = A.tab().mode === "edit"; s.innerHTML = "";
    s.classList.toggle("disabled", !edit);
    SL.KIND_LIST.filter(function (k) { return k.cat === A.cat; }).forEach(function (k) {
      var cv = el("canvas");
      var b = el("button", { class: "symbtn" + (A.tool.t === "place" && A.tool.kind === k.id ? " on" : "") }, [cv]);
      attachTip(b, k.label);
      b.addEventListener("click", function () { if (A.tab().mode === "edit") A.setTool({ t: "place", kind: k.id }); $("canvas").focus(); });
      s.appendChild(b);
      requestAnimationFrame(function () { SL.drawIcon(cv, k.id, "#1a1a1a"); });
    });
    s.hidden = !A.showSymbars;
  }
  function renderTabs() {
    var c = $("tabs"); c.innerHTML = "";
    A.tabs.forEach(function (t, i) {
      var x = el("button", { class: "x", title: "Tanca", text: "✖" });
      x.addEventListener("click", function (e) { e.stopPropagation(); A.requestClose(i); });
      var tab = el("div", { class: "tab" + (i === A.active ? " on" : "") }, [
        el("span", { text: t.title + (t.dirty ? "*" : "") + (t.mode !== "edit" ? "  ▶" : "") }), x]);
      tab.addEventListener("click", function () { A.active = i; A.sel.clear(); A.wireFrom = null; refreshAll(); });
      c.appendChild(tab);
    });
    document.title = "SimuLAB - [" + A.tab().title + (A.tab().dirty ? "*" : "") + "]";
  }

  var MENUS = function () {
    var t = A.tab(), edit = t.mode === "edit";
    return [
      ["Fitxer", [
        ["Nou", A.newDoc, "⌘N"], ["Obre...", A.open, "⌘O"], ["Tanca", function () { A.requestClose(A.active); }],
        ["Desa", A.save, "⌘S"], ["Anomena i desa...", A.saveAs], "-",
        ["Exporta imatge...", A.exportImage], "-", ["Imprimeix...", A.print, "⌘P"], "-",
        ["Configuració...", A.configDialog]]],
      ["Edita", [
        ["Desfés", A.undo, "⌘Z", !edit], ["Refés", A.redo, "⌘Y", !edit], "-",
        ["Retalla", A.cut, "⌘X", !edit], ["Copia", A.copy, "⌘C"], ["Enganxa", A.paste, "⌘V", !edit], "-",
        ["Selecciona-ho tot", A.selectAll, "⌘A"], "-", ["Caixetí...", A.titleDialog]]],
      ["Dibuixa", [
        ["Redibuixa", A.redraw], ["Línia", function () { A.setTool({ t: "shape", kind: "Line" }); }],
        ["Rectangle", function () { A.setTool({ t: "shape", kind: "Rect" }); }], ["El·lipse", function () { A.setTool({ t: "shape", kind: "Ellipse" }); }],
        ["Rectangle acolorit", function () { A.setTool({ t: "shape", kind: "FilledRect" }); }],
        ["El·lipse acolorida", function () { A.setTool({ t: "shape", kind: "FilledEllipse" }); }],
        ["Text", function () { A.setTool({ t: "text" }); }], ["Cable", function () { A.setTool({ t: "wire" }); }]]],
      ["Mode", [
        ["Edició", A.stopSim], ["Simulació", function () { A.startSim(false); }, "F5"], ["Pausa", A.pause], ["Pas a pas", A.step],
        ["Simula el document", function () { A.startSim(false); }], ["Simula tots els documents", function () { A.startSim(true); }]]],
      ["Visualitza", [
        ["Zoom anterior", A.zoomPrev], ["Zoom normal", function () { A.pushView(); var cr = A.canvasRect(); A.zoomAt(0.75 / A.tab().view.zoom, cr.w / 2, cr.h / 2); }],
        ["Zoom +", function () { A.zoomCenter(1.25); }], ["Zoom -", function () { A.zoomCenter(0.8); }],
        ["Zoom finestra", function () { A.setTool({ t: "zoomwin" }); }], ["Zoom tot", function () { A.pushView(); A.zoomAll(); }], "-",
        ["Reixeta", function () { A.grid = !A.grid; renderToolbars(); A.redraw(); }, null, false, A.grid]]],
      ["Barres", [
        ["Barra d'eines", function () { A.showToolbar = !A.showToolbar; renderToolbars(); }, null, false, A.showToolbar],
        ["Barra d'estat", function () { A.showStatus = !A.showStatus; $("statusbar").hidden = !A.showStatus; }, null, false, A.showStatus],
        ["Barres de símbols", function () { A.showSymbars = !A.showSymbars; renderCatbar(); renderSymbars(); }, null, false, A.showSymbars], "-"]
        .concat(SL.CATS.map(function (c) { return [c.bar, function () { A.cat = c.id; A.showSymbars = true; renderCatbar(); renderSymbars(); }, null, false, A.cat === c.id]; }))],
      ["Finestra", [["Nova finestra", A.newDoc], "-"].concat(A.tabs.map(function (tt, i) {
        return [(i + 1) + " " + tt.title, function () { A.active = i; A.sel.clear(); refreshAll(); }, null, false, i === A.active];
      }))],
      ["Ajuda", [
        ["Circuits d'exemple", [
          ["Motor - Arrencada directa", function () { A.loadExample(1); }],
          ["Motor - Inversió de gir", function () { A.loadExample(3); }],
          ["Motor - Arrencada estrella-triangle", function () { A.loadExample(2); }],
        ]],
        "-",
        ["Quant a SimuLAB...", A.about]]],
    ];
  };
  function renderMenus() {
    var bar = $("menubar"); bar.innerHTML = "";
    function buildItem(container, it) {
      if (it === "-") { container.appendChild(el("hr")); return; }
      if (Array.isArray(it[1])) {
        var sub = el("div", { class: "subitems" });
        it[1].forEach(function (ch) { buildItem(sub, ch); });
        var sw = el("div", { class: "submenu" }, [el("button", {}, [el("span", { text: it[0] })]), sub]);
        sw.firstChild.addEventListener("click", function (e) { e.stopPropagation(); sw.classList.toggle("open"); });
        container.appendChild(sw);
        return;
      }
      var b = el("button", { class: it[4] ? "checked" : "" }, [el("span", { text: it[0] }), it[2] ? el("span", { class: "key", text: it[2] }) : null]);
      if (it[3]) b.disabled = true;
      b.addEventListener("click", function () { closeMenus(); it[1](); });
      container.appendChild(b);
    }
    MENUS().forEach(function (m) {
      var items = el("div", { class: "items" });
      var wrap = el("div", { class: "menu" }, [el("button", { text: m[0] }), items]);
      m[1].forEach(function (it) { buildItem(items, it); });
      wrap.firstChild.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = wrap.classList.contains("open");
        closeMenus();
        if (!open) openMenu(m[0]);
      });
      wrap.firstChild.addEventListener("mouseenter", function () {
        if (bar.querySelector(".menu.open") && !wrap.classList.contains("open")) { closeMenus(); openMenu(m[0]); }
      });
      wrap.dataset.name = m[0];
      bar.appendChild(wrap);
    });
  }
  function openMenu(name) {
    renderMenus();
    var w = $("menubar").querySelector(".menu[data-name='" + name + "']");
    if (w) w.classList.add("open");
  }
  function closeMenus() { [].forEach.call(document.querySelectorAll(".menu.open"), function (m) { m.classList.remove("open"); }); }
  document.addEventListener("click", closeMenus);

  function setStatus(s) { $("status").textContent = s; }
  A.setStatus = setStatus;
  function updateStatus() {
    var t = A.tab();
    $("mode").textContent = { edit: "Edició", sim: "Simulació", pause: "Pausa" }[t.mode];
    $("simtime").textContent = t.mode !== "edit" && t.sim ? "t = " + t.sim.time.toFixed(1) + " s" : "";
    $("zoom").textContent = "Zoom " + Math.round(t.view.zoom * 100 / 0.75) + "%";
    $("coords").textContent = A.hover ? "X: " + Math.round(A.hover[0] / 5) + " mm  Y: " + Math.round(A.hover[1] / 5) + " mm" : "";
  }
  A.updateStatus = updateStatus;
  function refreshAll() { renderToolbars(); renderSymbars(); renderTabs(); updateStatus(); A.redraw(); }
  A.refreshAll = refreshAll;

  // ------------------------------------------------------------------ keyboard
  function onKey(e) {
    if (A.dialogOpen) {
      if (e.key === "Escape") closeDialog();
      if (e.key === "Enter") { var d = $("dialog").querySelector("[data-default]"); if (d) d.click(); }
      return;
    }
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "select" || tag === "textarea") return;
    var cmd = e.metaKey || e.ctrlKey, k = e.key.toLowerCase(), done = true;
    if (cmd && k === "n") A.newDoc();
    else if (cmd && k === "o") A.open();
    else if (cmd && (k === "s" || k === "g")) A.save();
    else if (cmd && k === "p") A.print();
    else if (cmd && k === "z") { if (e.shiftKey) A.redo(); else A.undo(); }
    else if (cmd && k === "y") A.redo();
    else if (cmd && k === "x") A.cut();
    else if (cmd && k === "c") A.copy();
    else if (cmd && k === "v") A.paste();
    else if (cmd && k === "a") A.selectAll();
    else if (cmd && (k === "+" || k === "=")) A.zoomCenter(1.25);
    else if (cmd && k === "-") A.zoomCenter(0.8);
    else if (!cmd && k === "r") A.rotate(1, false);
    else if (!cmd && k === "m") A.rotate(0, true);
    else if (!cmd && (e.key === "Delete" || e.key === "Backspace")) A.deleteSel();
    else if (e.key === "Escape") { if (A.wireFrom) { A.wireFrom = null; A.redraw(); } else A.setTool({ t: "select" }); }
    else if (e.key === "F5") { if (A.tab().mode === "edit") A.startSim(false); else A.stopSim(); }
    else done = false;
    if (done) e.preventDefault();
  }

  // ------------------------------------------------------------------ start
  function init() {
    if (!restore()) A.tabs = [newTab("Esquema1", SL.newDoc())];
    var q = new URLSearchParams(location.search);
    if (q.get("ejemplo") === "1" || q.get("ejemplo") === "2" || q.get("ejemplo") === "3") A.loadExample(+q.get("ejemplo"));
    $("fileinput").addEventListener("change", onFile);
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", persist);
    renderMenus(); renderCatbar(); refreshAll();
    SL.editor.init();
    if (q.get("simular") === "1") {
      // scripted demo: start the simulation and press the first NO push button
      setTimeout(function () {
        A.startSim(false);
        var t = A.tab(), pb = t.doc.comps.find(function (c) { return c.kind === "PushNO"; });
        if (pb) { t.sim.setActuator(t.doc, pb.id, true); t.sim.tick(t.doc, 0); setTimeout(function () { t.sim.setActuator(t.doc, pb.id, false); A.redraw(); }, 300); }
      }, 300);
    }
  }
  A.persist = persist;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(window.SL);
