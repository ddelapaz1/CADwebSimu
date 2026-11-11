// SimuLAB — circuit simulation (same rules as the Mac app, from the original):
// every connection point carries potentials L1 L2 L3 N PE + -; two different
// ones meeting = short circuit, PE meeting anything = earth leakage
// (sub_854790 / sub_8541c0 / sub_8543b0); a fed motor PE terminal = "conexion
// de masa" (sub_8545a0). Loads only listen.
"use strict";
(function (SL) {
  var P = SL.POT;
  var MAX_SETTLE = 40;

  SL.FAULTS = {
    Short: "Se ha producido un cortocircuito",
    Earth: "Se ha producido una derivación a tierra",
    GroundFed: "Se esta alimentado una conexion de masa",
  };

  function bits(m) { var n = 0; while (m) { n += m & 1; m >>= 1; } return n; }
  function single(m) { return bits(m) === 1 ? m : 0; }
  function phaseIndex(p) { return p === P.L1 ? 0 : p === P.L2 ? 1 : p === P.L3 ? 2 : -1; }
  function isPhase(p) { return phaseIndex(p) >= 0; }

  function validPair(a, b) {
    if (!a || !b || a === b) return false;
    return (isPhase(a) && (isPhase(b) || b === P.N)) || (isPhase(b) && a === P.N) ||
      (a === P.POS && b === P.NEG) || (a === P.NEG && b === P.POS);
  }

  /** L1-L2-L3 and rotations forward (1), other orders reverse (-1) (sub_4ac380). */
  function orderDir(a, b, c) {
    var t = [phaseIndex(a), phaseIndex(b), phaseIndex(c)].join("");
    if (t === "012" || t === "120" || t === "201") return 1;
    if (t === "021" || t === "102" || t === "210") return -1;
    return 0;
  }

  /** Star-delta motor (sub_4ac380): returns [dir, conn 1 star / 2 delta]. */
  SL.ydMotor = function (pots, roots) {
    if (pots.length < 6) return [0, 0];
    var u1 = pots[0], v1 = pots[1], w1 = pots[2], w2 = pots[3], u2 = pots[4], v2 = pots[5];
    var top = orderDir(u1, v1, w1), bottom = orderDir(w2, u2, v2);
    if (top && w2 === u1 && u2 === v1 && v2 === w1) return [top, 2];
    var joined = function (a, b, c) { return roots[a] === roots[b] && roots[b] === roots[c]; };
    if (top && !w2 && !u2 && !v2 && joined(3, 4, 5)) return [top, 1];
    if (bottom && !u1 && !v1 && !w1 && joined(0, 1, 2)) return [bottom, 1];
    return [0, 0];
  };

  function peTerminal(kind) { return kind === "Motor3" ? 3 : kind === "Motor3YD" ? 6 : -1; }

  function Dsu(n) { this.p = []; for (var i = 0; i < n; i++) this.p.push(i); }
  Dsu.prototype.find = function (x) { while (this.p[x] !== x) { this.p[x] = this.p[this.p[x]]; x = this.p[x]; } return x; };
  Dsu.prototype.union = function (a, b) { a = this.find(a); b = this.find(b); if (a !== b) this.p[a] = b; };

  function key(p) { return p[0] + "," + p[1]; }

  /** Fixed connectivity: wires, T-junctions and terminal positions. */
  function buildTopo(doc) {
    var idx = {}, pts = [];
    function get(p) { var k = key(p); if (!(k in idx)) { idx[k] = pts.length; pts.push(p); } return idx[k]; }
    var terms = {};
    doc.comps.forEach(function (c) { terms[c.id] = SL.terminals(c).map(get); });
    doc.wires.forEach(function (w) { get(w.a); get(w.b); });
    var d = new Dsu(pts.length);
    doc.wires.forEach(function (w) { d.union(idx[key(w.a)], idx[key(w.b)]); });
    var wireEnd = {};
    doc.wires.forEach(function (w) { wireEnd[key(w.a)] = true; wireEnd[key(w.b)] = true; });
    pts.forEach(function (p) {
      if (!wireEnd[key(p)]) return;
      doc.wires.forEach(function (w) { if (SL.wireInterior(w, p)) d.union(idx[key(p)], idx[key(w.a)]); });
    });
    var base = pts.map(function (_, i) { return d.find(i); });
    return { idx: idx, pts: pts, base: base, terms: terms };
  }

  function Sim(doc) {
    this.st = {};
    this.pot = {};
    this.fault = null;
    this.time = 0;
    var self = this;
    doc.comps.forEach(function (c) {
      // breakers and switches start closed (estimated)
      self.st[c.id] = { energized: false, on: false, t: 0, act: SL.KINDS[c.kind].role === "Manual" && !!c.closed, // new breakers start open (sub_43ee20 / sub_40d2b0)
        motor: 0, conn: 0, angle: 0, prev: false };
    });
  }

  Sim.prototype.s = function (id) {
    return this.st[id] || (this.st[id] = { energized: false, on: false, t: 0, act: false, motor: 0, conn: 0, angle: 0, prev: false });
  };

  Sim.prototype.drivers = function (doc) {
    var m = {}, self = this;
    doc.comps.forEach(function (c) {
      if (!c.name) return;
      var st = self.s(c.id), on = null;
      if (["Coil", "TimerOn", "TimerOff", "TimerOnOff", "Flasher", "StepRelay"].indexOf(c.kind) >= 0) on = st.on;
      else if (c.kind === "ThermalRelay3") on = st.act;
      if (on !== null) m[c.name] = !!(m[c.name] || on);
    });
    return m;
  };

  Sim.prototype.closed = function (c, drivers) {
    var st = this.s(c.id), K = SL.KINDS[c.kind];
    switch (K.role) {
      case "Passive": return true;
      case "Manual": return st.act;
      case "Poles": return !!drivers[c.name];
      case "Contact": return !!drivers[c.name] !== K.nc;
      case "Actuator": return st.act !== K.nc;
    }
    return false;
  };

  Sim.prototype.closedNow = function (doc, c) { return this.closed(c, this.drivers(doc)); };

  Sim.prototype.solve = function (doc, topo) {
    var n = topo.pts.length, d = new Dsu(0), self = this;
    d.p = topo.base.slice();
    var drivers = this.drivers(doc);
    doc.comps.forEach(function (c) {
      var K = SL.KINDS[c.kind];
      if (["Passive", "Manual", "Poles", "Contact", "Actuator"].indexOf(K.role) < 0) return;
      if (!self.closed(c, drivers)) return;
      var t = topo.terms[c.id], np = K.poles > 0 ? K.poles : 1;
      for (var i = 0; i < np; i++) if (2 * i + 1 < t.length) d.union(t[2 * i], t[2 * i + 1]);
    });
    var mask = new Array(n).fill(0);
    doc.comps.forEach(function (c) {
      var K = SL.KINDS[c.kind];
      if (K.role !== "Feed") return;
      var t = topo.terms[c.id];
      K.feed.forEach(function (f, i) { if (i < t.length) mask[d.find(t[i])] |= f[0]; });
    });
    var out = [], roots = [], fault = null, i;
    for (i = 0; i < n; i++) { roots.push(d.find(i)); out.push(mask[roots[i]]); }
    out.forEach(function (m) {
      if (bits(m) > 1) {
        if (m & P.PE) { if (!fault) fault = "Earth"; } else fault = "Short";
      }
    });
    doc.comps.forEach(function (c) {
      if (SL.KINDS[c.kind].role !== "Load") return;
      var t = topo.terms[c.id], pe = peTerminal(c.kind);
      if (pe >= 0 && pe < t.length) {
        var m = out[t[pe]];
        if (m && m !== P.PE && !fault) fault = "GroundFed";
      }
      var pots = t.filter(function (_, k) { return k !== pe; }).map(function (j) { return single(out[j]); });
      var hasPE = pots.some(function (p) { return p === P.PE; });
      var hasLive = pots.some(function (p) { return p && p !== P.PE; });
      if (hasPE && hasLive && !fault) fault = "Earth";
    });
    this.pot = {};
    for (i = 0; i < n; i++) this.pot[key(topo.pts[i])] = out[i];
    return { out: out, roots: roots, fault: fault };
  };

  /** Advance dt seconds; returns a fault name or null. */
  Sim.prototype.tick = function (doc, dt) {
    if (this.fault) return this.fault;
    this.time += dt;
    var topo = buildTopo(doc), self = this;
    doc.comps.forEach(function (c) {
      var st = self.s(c.id), preset = SL.presetSecs(c);
      if (c.kind === "TimerOn") {
        if (st.energized) { st.t += dt; if (st.t >= preset) st.on = true; } else { st.t = 0; st.on = false; }
      } else if (c.kind === "TimerOnOff") {
        // sub_630f90: one preset after the supply appears and again after it goes
        if (st.energized !== st.on) { st.t += dt; if (st.t >= preset) { st.on = st.energized; st.t = 0; } } else st.t = 0;
      } else if (c.kind === "TimerOff") {
        if (st.energized) { st.t = 0; st.on = true; }
        else if (st.on) { st.t += dt; if (st.t >= preset) { st.on = false; st.t = 0; } }
      } else if (c.kind === "Flasher") {
        if (st.energized) { st.t += dt; if (st.t >= Math.max(preset, 0.05)) { st.t = 0; st.on = !st.on; } }
        else { st.t = 0; st.on = false; }
      }
      if (st.motor) {
        var speed = c.kind === "Motor3YD" ? (st.conn === 1 ? 3 : 8) : 6;
        st.angle += dt * speed * st.motor;
      }
    });
    var toggled = {};
    for (var it = 0; it < MAX_SETTLE; it++) {
      var r = this.solve(doc, topo);
      if (r.fault) { this.fault = r.fault; return r.fault; }
      var changed = false;
      doc.comps.forEach(function (c) {
        if (SL.KINDS[c.kind].role !== "Load") return;
        var t = topo.terms[c.id];
        var pots = t.map(function (j) { return single(r.out[j]); });
        var st = self.s(c.id);
        if (c.kind === "Motor3") {
          var dir = orderDir(pots[0], pots[1], pots[2]);
          st.energized = dir !== 0; st.motor = dir;
        } else if (c.kind === "Motor3YD") {
          var res = SL.ydMotor(pots, t.map(function (j) { return r.roots[j]; }));
          st.energized = res[0] !== 0; st.motor = res[0]; st.conn = res[1];
        } else if (c.kind === "Motor1") {
          var e1 = pots.length === 2 && validPair(pots[0], pots[1]);
          st.energized = e1; st.motor = e1 ? 1 : 0;
        } else {
          var e = pots.length === 2 && validPair(pots[0], pots[1]);
          st.energized = e;
          var on = st.on;
          switch (c.kind) {
            case "Coil": on = e; break;
            case "TimerOn": on = e && st.on; break;
            case "TimerOff": on = e || st.on; break;
            case "TimerOnOff": on = st.on; break;
            case "Flasher": on = e && st.on; break;
            case "StepRelay":
              if (e && !st.prev && !toggled[c.id]) { toggled[c.id] = true; on = !st.on; }
              break;
            default: on = e;
          }
          if (on !== st.on) { st.on = on; changed = true; }
        }
      });
      if (!changed) break;
    }
    doc.comps.forEach(function (c) { var st = self.s(c.id); st.prev = st.energized; });
    return null;
  };

  /** Press/release an actuator; every one with the same name moves too. */
  Sim.prototype.setActuator = function (doc, id, value) {
    var c = doc.comps.find(function (x) { return x.id === id; });
    if (!c) return;
    var role = SL.KINDS[c.kind].role, self = this;
    doc.comps.forEach(function (o) {
      if (o.id === id || (c.name && o.name === c.name && SL.KINDS[o.kind].role === role)) self.s(o.id).act = value;
    });
  };

  SL.Sim = Sim;

  SL.clickKind = function (kind) {
    // momentary: push buttons, mushroom buttons, limit switches (sub_43ee20 / sub_45fe10)
    if (["PushNO", "PushNC", "MushroomNO", "MushroomNC", "LimitNO", "LimitNC"].indexOf(kind) >= 0) return "momentary";
    if (["SwitchNO", "SwitchNC", "Breaker1", "Breaker2",
      "Breaker3", "Switch2", "Switch3", "ThermalRelay3"].indexOf(kind) >= 0) return "toggle";
    return null;
  };
})((typeof globalThis !== "undefined" ? globalThis : window).SL);
