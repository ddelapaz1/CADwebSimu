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
    Short: "S'ha produït un curtcircuit",
    Earth: "S'ha produït una derivació a terra",
    GroundFed: "S'està alimentant una connexió de massa",
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

  function peTerminal(kind) {
    if (kind === "Motor3") return 3;
    if (kind === "Motor3YD") return 6;
    if (kind === "Surge1N") return 2;
    if (kind === "Surge3N") return 4;
    return -1;
  }

  function Dsu(n) { this.p = []; for (var i = 0; i < n; i++) this.p.push(i); }
  Dsu.prototype.find = function (x) { while (this.p[x] !== x) { this.p[x] = this.p[this.p[x]]; x = this.p[x]; } return x; };
  Dsu.prototype.union = function (a, b) { a = this.find(a); b = this.find(b); if (a !== b) this.p[a] = b; };

  function key(p) { return p[0] + "," + p[1]; }

  // Protective devices. Fuses are "Passive" (always closed until they blow);
  // fuse switches, MCBs, breakers and RCDs are "Manual" (they open on a trip).
  function isFuse(kind) { return /^Fuse\d/.test(kind); }
  function isOvercurrent(kind) { return isFuse(kind) || /^(FuseSw|Auto|Breaker)\d/.test(kind); }
  function isRcd(kind) { return /^Rcd/.test(kind); }
  SL.isFuse = isFuse;
  SL.TRIP_TIME_THERMAL = 3; // s a motor may run on two phases before the overload relay trips

  /**
   * Mechanical interlocks: each "Interlock" symbol links the two contactors
   * (Poles) placed closest to it on either side along its dashed line.
   * Returns { name: [partner names] }.
   */
  function interlockPairs(doc) {
    var pairs = {};
    doc.comps.forEach(function (il) {
      if (il.kind !== "Interlock") return;
      var o = SL.xform([0, 30], il.rot, il.mirror), o1 = SL.xform([1, 30], il.rot, il.mirror);
      var cx = o[0] + il.x, cy = o[1] + il.y, ax = o1[0] - o[0], ay = o1[1] - o[1];
      var best = [null, null];
      doc.comps.forEach(function (c) {
        if (!c.name || SL.KINDS[c.kind].role !== "Poles") return;
        var r = SL.compRect(c), vx = (r.x0 + r.x1) / 2 - cx, vy = (r.y0 + r.y1) / 2 - cy;
        var along = vx * ax + vy * ay, perp = Math.abs(vx * ay - vy * ax);
        if (perp > 60 || Math.abs(along) > 180 || along === 0) return;
        var side = along < 0 ? 0 : 1;
        if (!best[side] || Math.abs(along) < best[side].d) best[side] = { d: Math.abs(along), name: c.name };
      });
      if (best[0] && best[1] && best[0].name !== best[1].name) {
        var a = best[0].name, b = best[1].name;
        (pairs[a] = pairs[a] || []).push(b);
        (pairs[b] = pairs[b] || []).push(a);
      }
    });
    return pairs;
  }
  SL.interlockPairs = interlockPairs;

  // ---------------------------------------------------------------- logic elements
  // A logic "1" is a node carrying "+"; outputs at 1 feed "+" into their node.
  SL.LOGIC_PULSE = 0.2; // s, width of the pulses of the pulse generator

  /** Advance a logic element's time-based state by dt (inputs from the previous tick). */
  function logicTime(c, st, dt) {
    var inp = !!(st.li && st.li[0]), T = SL.presetSecs(c);
    switch (c.kind) {
      case "LogicTon": st.t = inp ? st.t + dt : 0; break;
      case "LogicTp": if (st.pulse) { st.t += dt; if (st.t >= T) { st.pulse = false; st.t = 0; } } break;
      case "LogicTof":
        if (!inp && st.hold) { st.t += dt; if (st.t >= T) { st.hold = false; st.t = 0; } }
        break;
      case "LogicFlash":
        if (inp) { st.t += dt; if (st.t >= Math.max(T, 0.05)) { st.t = 0; st.ph = st.ph === false; } }
        else { st.t = 0; st.ph = true; }
        break;
      case "LogicPulse":
        if (inp) {
          st.t += dt;
          if (st.pt > 0) st.pt -= dt;
          if (st.t >= Math.max(T, 0.05)) { st.t = 0; st.pt = SL.LOGIC_PULSE; }
        } else { st.t = 0; st.pt = 0; }
        break;
    }
  }

  /**
   * Outputs of a logic element from its inputs. `edge(i)` is true once per tick
   * when input i rises (counters, dividers, pulse timer).
   */
  function logicEval(c, ins, st, edge) {
    var a = !!ins[0], b = !!ins[1], i, n, bits = function (v, k) { var o = []; for (i = 0; i < k; i++) o.push(!!(v >> i & 1)); return o; };
    var T = SL.presetSecs(c), pre = Math.max(1, c.count_preset | 0 || 3);
    switch (c.kind) {
      case "LogicAnd": return [a && b];
      case "LogicOr": return [a || b];
      case "LogicXor": return [a !== b];
      case "LogicNand": return [!(a && b)];
      case "LogicNor": return [!(a || b)];
      case "LogicNot": return [!a];
      case "LogicSR":
        if (b) st.q = false; else if (a) st.q = true; // reset dominant
        return [!!st.q, !st.q];
      case "LogicDiv2":
        if (edge(0)) st.q = !st.q;
        if (b) st.q = false;
        return [!!st.q];
      case "LogicTon": return [a && st.t >= T];
      case "LogicTp":
        if (edge(0) && !st.pulse) { st.pulse = true; st.t = 0; }
        return [!!st.pulse];
      case "LogicTof":
        if (a) { st.hold = true; st.t = 0; }
        return [a || !!st.hold];
      case "LogicFlash": return [a && st.ph !== false];
      case "LogicPulse": return [a && st.pt > 0];
      case "LogicCnt":
        if (edge(0)) st.cnt = (st.cnt || 0) + 1;
        if (b) st.cnt = 0;
        return [(st.cnt || 0) >= pre];
      case "LogicCntUD":
        if (edge(0)) st.cnt = (st.cnt || 0) + 1;
        if (edge(1)) st.cnt = Math.max(0, (st.cnt || 0) - 1);
        if (ins[2]) st.cnt = 0;
        return [(st.cnt || 0) >= pre];
      case "LogicCnt4": case "LogicCnt10":
        n = c.kind === "LogicCnt10" ? 10 : 16;
        if (edge(0)) st.cnt = ((st.cnt || 0) + 1) % n;
        if (b) st.cnt = 0;
        return bits(st.cnt || 0, 4);
      case "LogicCnt4UD":
        if (edge(0)) st.cnt = ((st.cnt || 0) + 1) % 16;
        if (edge(1)) st.cnt = ((st.cnt || 0) + 15) % 16;
        if (ins[2]) st.cnt = 0;
        return bits(st.cnt || 0, 4);
      case "LogicProbe": return [!!st.act];
      case "Logic7Dec": return bits(SL.SEG7[(a ? 1 : 0) | (b ? 2 : 0) | (ins[2] ? 4 : 0) | (ins[3] ? 8 : 0)], 7);
      case "LogicPreset": return bits(st.val || 0, 4);
    }
    return [];
  }

  /** Fixed connectivity: wires, T-junctions, explicit crossing junctions, and terminal positions. */
  function buildTopo(doc) {
    var idx = {}, hIdx = {}, vIdx = {}, pts = [], coordList = [], coordSeen = {};
    function alloc(p) { var id = pts.length; pts.push(p); return id; }
    function addCoord(p) {
      var k = key(p);
      if (coordSeen[k]) return;
      coordSeen[k] = true;
      coordList.push([p[0], p[1]]);
      idx[k] = alloc(p);
      hIdx[k] = alloc(p);
      vIdx[k] = alloc(p);
    }
    var terms = {};
    doc.comps.forEach(function (c) {
      var ts = SL.terminals(c);
      ts.forEach(addCoord);
      terms[c.id] = ts.map(function (p) { return idx[key(p)]; });
    });
    var hs = [], vs = [];
    doc.wires.forEach(function (w) {
      addCoord(w.a);
      addCoord(w.b);
      if (w.a[1] === w.b[1]) hs.push(w);
      else if (w.a[0] === w.b[0]) vs.push(w);
    });
    (doc.junctions || []).forEach(addCoord);
    hs.forEach(function (h) {
      var hx0 = Math.min(h.a[0], h.b[0]), hx1 = Math.max(h.a[0], h.b[0]), hy = h.a[1];
      vs.forEach(function (v) {
        var vy0 = Math.min(v.a[1], v.b[1]), vy1 = Math.max(v.a[1], v.b[1]), vx = v.a[0];
        if (vx >= hx0 && vx <= hx1 && hy >= vy0 && hy <= vy1) addCoord([vx, hy]);
      });
    });

    var d = new Dsu(pts.length);
    var wireNode = {};
    doc.wires.forEach(function (w) {
      var ka = key(w.a), kb = key(w.b);
      if (w.a[1] === w.b[1]) {
        var y = w.a[1], x0 = Math.min(w.a[0], w.b[0]), x1 = Math.max(w.a[0], w.b[0]);
        d.union(hIdx[ka], hIdx[kb]);
        coordList.forEach(function (p) {
          if (p[1] === y && p[0] >= x0 && p[0] <= x1) d.union(hIdx[key(p)], hIdx[ka]);
        });
        wireNode[w.id] = hIdx[ka];
      } else if (w.a[0] === w.b[0]) {
        var x = w.a[0], y0 = Math.min(w.a[1], w.b[1]), y1 = Math.max(w.a[1], w.b[1]);
        d.union(vIdx[ka], vIdx[kb]);
        coordList.forEach(function (p) {
          if (p[0] === x && p[1] >= y0 && p[1] <= y1) d.union(vIdx[key(p)], vIdx[ka]);
        });
        wireNode[w.id] = vIdx[ka];
      } else {
        d.union(idx[ka], idx[kb]);
        wireNode[w.id] = idx[ka];
      }
    });

    coordList.forEach(function (p) {
      var k = key(p), dirs = SL.wireDirsAt(doc, p);
      if (dirs.h && !dirs.v) {
        d.union(idx[k], hIdx[k]);
      } else if (dirs.v && !dirs.h) {
        d.union(idx[k], vIdx[k]);
      } else if (dirs.h && dirs.v) {
        var joinHV = false;
        if (dirs.cross) joinHV = SL.hasJunction(doc, p);
        else if (dirs.tee) joinHV = !SL.hasNoJunction(doc, p);
        else joinHV = !SL.hasNoJunction(doc, p); // 2-way L-corner
        if (joinHV) {
          d.union(hIdx[k], vIdx[k]);
          d.union(idx[k], hIdx[k]);
        } else {
          // Unjoined crossing: attach idx[k] only if a wire actually terminates here
          var hEnd = hs.some(function (w) { return key(w.a) === k || key(w.b) === k; });
          var vEnd = vs.some(function (w) { return key(w.a) === k || key(w.b) === k; });
          if (hEnd && !vEnd) d.union(idx[k], hIdx[k]);
          else if (vEnd && !hEnd) d.union(idx[k], vIdx[k]);
        }
      }
    });

    var base = pts.map(function (_, i) { return d.find(i); });
    return { idx: idx, coordList: coordList, pts: pts, base: base, terms: terms, wireNode: wireNode };
  }

  function Sim(doc) {
    this.st = {};
    this.pot = {};
    this.wirePot = {};
    this.fault = null;
    this.time = 0;
    this.events = [];    // messages for the status bar (trips, blown fuses)
    this.forceOpen = {}; // ids treated as open while looking for the device that clears a fault
    var self = this;
    doc.comps.forEach(function (c) {
      // breakers and switches start closed (estimated)
      self.st[c.id] = { energized: false, on: false, t: 0, act: SL.KINDS[c.kind].role === "Manual" && !!c.closed, // new breakers start open (sub_43ee20 / sub_40d2b0)
        motor: 0, conn: 0, angle: 0, prev: false };
      if (c.kind === "LogicPreset") self.st[c.id].val = c.value || 0;
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
      if (["Coil", "LatchCoil", "StepRelay", "Solenoid", "TimerOn", "TimerOff", "TimerOnOff", "Flasher",
        "PulseGen", "TimeSwitch", "Counter", "SoftCtrl", "SoftRevCtrl", "VfdACCtrl", "DriveDCCtrl",
        "SsrDC", "SsrAC", "PhaseLossN", "PhaseLoss", "PhaseSeqN", "PhaseSeq",
        "CoilContactNO", "CoilContactCO"].indexOf(c.kind) >= 0) on = st.on;
      else if (c.kind === "ThermalRelay3") on = st.act;
      if (on !== null) m[c.name] = !!(m[c.name] || on);
    });
    return m;
  };

  Sim.prototype.closed = function (c, drivers) {
    var st = this.s(c.id), K = SL.KINDS[c.kind];
    if (this.forceOpen[c.id]) return false;
    switch (K.role) {
      case "Passive": return !st.blown;
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
      var t = topo.terms[c.id];
      if (c.kind === "SsrDC" || c.kind === "SsrAC") {
        if (self.s(c.id).on && t.length >= 2) d.union(t[0], t[1]);
        return;
      }
      if (c.kind === "CoilContactNO") {
        if (self.s(c.id).on && t.length >= 4) d.union(t[2], t[3]);
        return;
      }
      if (c.kind === "CoilContactCO") {
        var ccOn = self.s(c.id).on;
        if (!ccOn && t.length >= 4) d.union(t[2], t[3]);
        if (ccOn && t.length >= 5) d.union(t[2], t[4]);
        return;
      }
      if (["Passive", "Manual", "Poles", "Contact", "Actuator"].indexOf(K.role) < 0) return;
      var isClosed = self.closed(c, drivers);
      if (c.kind === "CrossSw") {
        if (t.length >= 4) {
          if (isClosed) { d.union(t[0], t[2]); d.union(t[1], t[3]); }
          else { d.union(t[0], t[3]); d.union(t[1], t[2]); }
        }
        return;
      }
      if (c.kind === "Sel102") {
        var pos102 = self.s(c.id).pos || (isClosed ? 1 : 0);
        if (pos102 === 1 && t.length >= 2) d.union(t[0], t[1]);
        else if (pos102 === 2 && t.length >= 3) d.union(t[0], t[2]);
        return;
      }
      if (c.kind === "Sel123") {
        var pos123 = self.s(c.id).pos || (isClosed ? 1 : 0);
        if (pos123 === 0 && t.length >= 2) d.union(t[0], t[1]);
        else if (pos123 === 1 && t.length >= 3) d.union(t[0], t[2]);
        else if (pos123 === 2 && t.length >= 4) d.union(t[0], t[3]);
        return;
      }
      if (c.kind.slice(-4) === "NONC") {
        if (!isClosed && t.length >= 2) d.union(t[0], t[1]);
        if (isClosed && t.length >= 4) d.union(t[2], t[3]);
        return;
      }
      if (c.kind.slice(-2) === "CO") {
        if (!isClosed && t.length >= 2) d.union(t[0], t[1]);
        if (isClosed && t.length >= 3) d.union(t[0], t[2]);
        return;
      }
      if (!isClosed) return;
      var np = K.poles > 0 ? K.poles : 1;
      for (var i = 0; i < np; i++) if (2 * i + 1 < t.length) d.union(t[2 * i], t[2 * i + 1]);
    });
    var mask = new Array(n).fill(0);
    doc.comps.forEach(function (c) {
      var K = SL.KINDS[c.kind], t = topo.terms[c.id];
      if (K.role === "Feed") K.feed.forEach(function (f, i) { if (i < t.length) mask[d.find(t[i])] |= f[0]; });
      else if (K.role === "Logic") {
        var lo = self.s(c.id).lo;
        if (lo) SL.logicIO(c.kind).outs.forEach(function (ti, k) { if (lo[k] && ti < t.length) mask[d.find(t[ti])] |= P.POS; });
      }
    });
    for (var pass = 0; pass < 8; pass++) {
      var convAdded = false;
      doc.comps.forEach(function (c) {
        if (SL.KINDS[c.kind].role !== "Converter") return;
        var t = topo.terms[c.id], st = self.s(c.id);
        var p0 = t[0] != null ? single(mask[d.find(t[0])]) : 0;
        var p1 = t[1] != null ? single(mask[d.find(t[1])]) : 0;
        var p2 = t[2] != null ? single(mask[d.find(t[2])]) : 0;
        var addPot = function (termIdx, potBit) {
          if (termIdx >= t.length) return;
          var r = d.find(t[termIdx]);
          if ((mask[r] & potBit) === 0) { mask[r] |= potBit; convAdded = true; }
        };
        if (c.kind === "Transformer1") {
          var ok1 = validPair(p0, p1);
          st.energized = st.on = ok1;
          if (ok1) { addPot(2, P.L1); addPot(3, P.N); }
        } else if (c.kind === "Transformer3") {
          var ok3 = orderDir(p0, p1, p2) !== 0;
          st.energized = st.on = ok3;
          if (ok3) { addPot(3, p0); addPot(4, p1); addPot(5, p2); }
        } else if (c.kind === "PowerSupply1" || c.kind === "Rectifier") {
          var okPs1 = validPair(p0, p1);
          st.energized = st.on = okPs1;
          if (okPs1) { addPot(2, P.POS); addPot(3, P.NEG); }
        } else if (c.kind === "Diode") {
          // Conducts from anode (1) to cathode (2): "+" passes forwards, "-" passes
          // backwards; an AC potential passes (half wave) in its conducting sense.
          var ma = t[0] != null ? single(mask[d.find(t[0])]) : 0, mk = t[1] != null ? single(mask[d.find(t[1])]) : 0;
          var ac = function (p) { return p && p !== P.POS && p !== P.NEG && p !== P.PE; };
          var cond = false;
          if (ma === P.POS) { addPot(1, P.POS); cond = true; }
          if (mk === P.NEG) { addPot(0, P.NEG); cond = true; }
          if (ac(ma)) { addPot(1, ma); cond = true; }
          if (ac(mk) && !ma) { addPot(0, mk); cond = true; }
          st.energized = st.on = cond;
        } else if (c.kind === "PowerSupply3") {
          var okPs3 = orderDir(p0, p1, p2) !== 0;
          st.energized = st.on = okPs3;
          if (okPs3) { addPot(3, P.POS); addPot(4, P.NEG); }
        }
      });
      if (!convAdded) break;
    }
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
    this.wirePot = {};
    topo.coordList.forEach(function (p) {
      var k = key(p);
      self.pot[k] = out[topo.idx[k]];
    });
    doc.wires.forEach(function (w) {
      var wn = topo.wireNode[w.id];
      if (wn != null) self.wirePot[w.id] = out[wn];
    });
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
      } else if (c.kind === "Flasher" || c.kind === "PulseGen") {
        if (st.energized) { st.t += dt; if (st.t >= Math.max(preset, 0.05)) { st.t = 0; st.on = !st.on; } }
        else { st.t = 0; st.on = false; }
      } else if (c.kind === "TimeSwitch") {
        // Cyclic program: ON for the preset time, then OFF for off_base, repeating
        if (st.energized) {
          st.t += dt;
          var tOn = preset, per = tOn + SL.offSecs(c);
          st.phaseOn = per <= 0 || (st.t % per) < tOn;
        } else { st.t = 0; st.phaseOn = true; }
      } else if (c.kind === "LampFlash") {
        if (st.energized) { st.t += dt; if (st.t >= 0.4) { st.t = 0; st.on = !st.on; } }
        else { st.t = 0; st.on = false; }
      }
      if (SL.KINDS[c.kind].role === "Logic") logicTime(c, st, dt);
      if (st.motor) {
        var speed = c.kind === "Motor3YD" ? (st.conn === 1 ? 3 : 8) : 6;
        st.angle += dt * speed * st.motor;
      }
    });
    var toggled = {}, counted = {}, edged = {}, ilk = interlockPairs(doc), r = null;
    var coilOn = function (name) {
      return doc.comps.some(function (o) { return o.kind === "Coil" && o.name === name && self.s(o.id).on; });
    };
    for (var it = 0; it < MAX_SETTLE; it++) {
      r = this.solve(doc, topo);
      // A protective device in the faulty path trips instead of stopping the simulation
      for (var trips = 0; r.fault && trips < 8 && this.trip(doc, topo, r.fault); trips++) r = this.solve(doc, topo);
      if (r.fault) { this.fault = r.fault; return r.fault; }
      var changed = false;
      doc.comps.forEach(function (c) {
        if (SL.KINDS[c.kind].role !== "Logic") return;
        var t = topo.terms[c.id], st = self.s(c.id), io = SL.logicIO(c.kind);
        var ins = io.ins.map(function (ti) { return ti < t.length && !!(r.out[t[ti]] & P.POS); });
        st.cur = ins;
        var edge = function (i) {
          var k = c.id + ":" + i;
          if (!ins[i] || (st.li && st.li[i]) || edged[k]) return false;
          return (edged[k] = true);
        };
        var outs = logicEval(c, ins, st, edge);
        if (!st.lo || outs.some(function (o, k) { return o !== st.lo[k]; })) { st.lo = outs; changed = true; }
      });
      doc.comps.forEach(function (c) {
        if (SL.KINDS[c.kind].role !== "Load") return;
        var t = topo.terms[c.id];
        var pots = t.map(function (j) { return single(r.out[j]); });
        var st = self.s(c.id);
        if (c.kind === "Motor3") {
          var dir = orderDir(pots[0], pots[1], pots[2]);
          st.energized = dir !== 0; st.motor = dir;
          // Two phases and the third dead: the motor hums without starting (single-phasing)
          var ph = pots.slice(0, 3).filter(isPhase);
          st.twoPhase = dir === 0 && ph.length === 2 && ph[0] !== ph[1] && pots.slice(0, 3).filter(function (p) { return !p; }).length === 1;
        } else if (c.kind === "Motor3YD") {
          var res = SL.ydMotor(pots, t.map(function (j) { return r.roots[j]; }));
          st.energized = res[0] !== 0; st.motor = res[0]; st.conn = res[1];
        } else if (c.kind === "Motor1") {
          var e1 = pots.length === 2 && validPair(pots[0], pots[1]);
          st.energized = e1; st.motor = e1 ? 1 : 0;
        } else if (c.kind === "SsrDC" || c.kind === "SsrAC") {
          var eSsr = pots.length >= 4 && validPair(pots[2], pots[3]);
          st.energized = eSsr;
          if (eSsr !== st.on) { st.on = eSsr; changed = true; }
        } else if (c.kind === "PhaseLoss" || c.kind === "PhaseLossN" || c.kind === "PhaseSeq" || c.kind === "PhaseSeqN") {
          var pDir = pots.length >= 3 ? orderDir(pots[0], pots[1], pots[2]) : 0;
          var nOk = (c.kind === "PhaseLossN" || c.kind === "PhaseSeqN") ? (pots[3] === P.N) : true;
          var phOk = (c.kind === "PhaseSeq" || c.kind === "PhaseSeqN") ? (pDir === 1 && nOk) : (pDir !== 0 && nOk);
          st.energized = phOk;
          if (phOk !== st.on) { st.on = phOk; changed = true; }
        } else if (c.kind === "LatchCoil") {
          var eSet = pots.length >= 3 && validPair(pots[0], pots[2]);
          var eRst = pots.length >= 3 && validPair(pots[1], pots[2]);
          st.energized = eSet || eRst;
          var lOn = st.on;
          if (eRst) lOn = false;
          else if (eSet) lOn = true;
          if (lOn !== st.on) { st.on = lOn; changed = true; }
        } else {
          var e = pots.length >= 2 && validPair(pots[0], pots[1]);
          st.energized = e;
          var on = st.on;
          switch (c.kind) {
            case "Coil":
              // a mechanical interlock stops it pulling in while its partner is closed
              on = e && (st.on || !(ilk[c.name] || []).some(coilOn));
              break;
            case "Solenoid": on = e; break;
            case "TimeSwitch": on = e && st.phaseOn !== false; break;
            case "Counter": {
              var pre = Math.max(1, c.count_preset | 0 || 3);
              var reset = pots.length >= 3 && validPair(pots[2], pots[1]);
              if (e && !st.prev && !counted[c.id]) { counted[c.id] = true; st.count = (st.count || 0) + 1; }
              if (reset) st.count = 0;
              on = (st.count || 0) >= pre;
              break;
            }
            case "TimerOn": on = e && st.on; break;
            case "TimerOff": on = e || st.on; break;
            case "TimerOnOff": on = st.on; break;
            case "Flasher": case "PulseGen": case "LampFlash": on = e && st.on; break;
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
    doc.comps.forEach(function (c) { var st = self.s(c.id); st.prev = st.energized; if (st.cur) st.li = st.cur.slice(); });
    this.thermalOverload(doc, topo, r, dt);
    return null;
  };

  /** Overload relays carrying a single-phasing motor trip after TRIP_TIME_THERMAL. */
  Sim.prototype.thermalOverload = function (doc, topo, r, dt) {
    if (!r) return;
    var self = this, hum = {};
    doc.comps.forEach(function (c) {
      if (c.kind === "Motor3" && self.s(c.id).twoPhase) topo.terms[c.id].forEach(function (j) { hum[r.roots[j]] = true; });
    });
    doc.comps.forEach(function (c) {
      if (c.kind !== "ThermalRelay3") return;
      var st = self.s(c.id);
      if (st.act) { st.ot = 0; return; }
      var loaded = topo.terms[c.id].some(function (j) { return hum[r.roots[j]]; });
      if (!loaded) { st.ot = 0; return; }
      st.ot = (st.ot || 0) + dt;
      if (st.ot >= SL.TRIP_TIME_THERMAL) {
        self.setActuator(doc, c.id, true);
        st.ot = 0;
        self.events.push((c.name || "Relé tèrmic") + ": ha disparat el relé tèrmic (motor funcionant amb dues fases)");
      }
    });
  };

  /**
   * Find the protective device whose opening clears `fault` and trip it.
   * Short circuits trip fuses and breakers; earth faults trip an RCD first.
   * Among several, the most selective one trips (the one that leaves the most
   * of the circuit energized, i.e. the one closest to the fault).
   */
  Sim.prototype.trip = function (doc, topo, fault) {
    var self = this, drivers = this.drivers(doc), best = null;
    doc.comps.forEach(function (c) {
      var rcd = isRcd(c.kind);
      if (!isOvercurrent(c.kind) && !(rcd && fault !== "Short")) return;
      if (!self.closed(c, drivers)) return;
      self.forceOpen[c.id] = true;
      var r = self.solve(doc, topo);
      delete self.forceOpen[c.id];
      if (r.fault) return;
      // selectivity: keep the most loads fed, then the most nodes with a phase or "+"
      var live = 0, fed = 0, LIVE = P.L1 | P.L2 | P.L3 | P.POS;
      r.out.forEach(function (m) { if (m & LIVE) live++; });
      doc.comps.forEach(function (o) {
        var t = topo.terms[o.id];
        if (SL.KINDS[o.kind].role === "Load" && t.length >= 2 && validPair(single(r.out[t[0]]), single(r.out[t[1]]))) fed++;
      });
      var score = (rcd ? 1e9 : 0) + fed * 1e5 + live;
      if (!best || score > best.score) best = { c: c, score: score };
    });
    if (!best) return false;
    var c = best.c, st = this.s(c.id), why = fault === "Short" ? "curtcircuit" : "derivació a terra";
    if (isFuse(c.kind)) {
      st.blown = true;
      this.events.push((c.name || "Fusible") + ": s'ha fos el fusible (" + why + "). Feu-hi clic per canviar-lo.");
    } else {
      this.setActuator(doc, c.id, false);
      doc.comps.forEach(function (o) { if (o.id === c.id || (c.name && o.name === c.name && o.kind === c.kind)) self.s(o.id).tripped = true; });
      this.events.push((c.name || SL.KINDS[c.kind].label) + ": ha disparat " +
        (isRcd(c.kind) ? "el diferencial" : "la protecció") + " (" + why + ")");
    }
    return true;
  };

  /** Replace a blown fuse (click during simulation). */
  Sim.prototype.replaceFuse = function (doc, id) {
    var st = this.s(id);
    if (!st.blown) return false;
    st.blown = false;
    var c = doc.comps.find(function (x) { return x.id === id; });
    this.events.push((c && c.name || "Fusible") + ": fusible canviat");
    return true;
  };

  /** Press/release an actuator; every one with the same name moves too. */
  Sim.prototype.setActuator = function (doc, id, value) {
    var c = doc.comps.find(function (x) { return x.id === id; });
    if (!c) return;
    var role = SL.KINDS[c.kind].role, self = this;
    var nextPos = ((self.s(id).pos || 0) + 1) % 3;
    doc.comps.forEach(function (o) {
      if (o.id === id || (c.name && o.name === c.name && SL.KINDS[o.kind].role === role)) {
        var st = self.s(o.id);
        st.act = value;
        if (value) st.tripped = false;
        if (o.kind === "Sel102" || o.kind === "Sel123") st.pos = nextPos;
      }
    });
  };

  /** Preselector: each click moves to the next digit (0..9). */
  Sim.prototype.stepPreset = function (doc, id) {
    var st = this.s(id);
    st.val = ((st.val || 0) + 1) % 10;
    return st.val;
  };

  SL.Sim = Sim;

  SL.clickKind = function (kind) {
    // momentary: push buttons, mushroom buttons, limit switches (sub_43ee20 / sub_45fe10)
    if (["PushBtn", "PushNO", "PushNC", "PushNONC", "PushCO",
      "MushroomNO", "MushroomNC", "MushroomNONC", "MushroomCO",
      "LimitNO", "LimitNC", "LimitNONC", "LimitCO",
      "DetIndNO", "DetIndNC", "DetCapNO", "DetCapNC", "DetMagNO", "DetMagNC",
      "PhotoBarrier", "PhotoRecNO", "PhotoRecNC",
      "PressNO", "PressNC", "VacNO", "VacNC", "ThermoNO", "ThermoNC"].indexOf(kind) >= 0) return "momentary";
    if (["SwitchNO", "SwitchNC", "SwitchNONC", "SwitchCO", "Sel102", "Sel123", "CrossSw",
      "Auto1", "Auto1N", "Auto2", "Auto3", "Auto3N",
      "Rcd1N", "Rcd3N", "Breaker1", "Breaker1N", "Breaker2",
      "Breaker3", "Breaker3N", "PermOvervolt1N", "PermOvervolt3N",
      "Switch1", "Switch2", "Switch3", "Switch4", "ThermalRelay3",
      "FuseSw1", "FuseSw1N", "FuseSw2", "FuseSw3", "FuseSw3N"].indexOf(kind) >= 0) return "toggle";
    if (isFuse(kind)) return "fuse"; // only when blown: click replaces it
    if (kind === "LogicProbe") return "toggle";
    if (kind === "LogicPreset") return "preset";
    return null;
  };
})((typeof globalThis !== "undefined" ? globalThis : window).SL);
