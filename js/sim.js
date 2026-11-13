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
    if (kind === "Motor3Dahl") return 6;
    if (kind === "Motor1Cap") return 4;
    if (kind === "Motor3WR") return 3;
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

  /** Wires removed by a hidden "cut wire" fault (fault mode). */
  function cutWires(doc) {
    var cut = {};
    (doc.faults || []).forEach(function (f) { if (f.type === "cut") cut[f.id] = true; });
    return cut;
  }

  /**
   * Connectivity of the document, rebuilt only when its geometry changes
   * (during a simulation the schematic is fixed, so this is built once).
   */
  var topoCache = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  function topoSignature(doc) {
    var p = [];
    doc.comps.forEach(function (c) { p.push(c.kind, c.x, c.y, c.rot | 0, c.mirror ? 1 : 0, c.name); });
    p.push("|");
    doc.wires.forEach(function (w) { p.push(w.id, w.a[0], w.a[1], w.b[0], w.b[1]); });
    p.push("|", JSON.stringify(doc.junctions || []), JSON.stringify(doc.no_junctions || []), JSON.stringify(doc.faults || []));
    return p.join(",");
  }
  SL.topoFor = function (doc) {
    var sig = topoSignature(doc), hit = topoCache && topoCache.get(doc);
    if (hit && hit.sig === sig) return hit.topo;
    var topo = buildTopo(doc);
    if (topoCache) topoCache.set(doc, { sig: sig, topo: topo });
    return topo;
  };

  /** Fixed connectivity: wires, T-junctions, explicit crossing junctions, and terminal positions. */
  function buildTopo(doc) {
    var cut = cutWires(doc);
    doc = Object.assign({}, doc, { wires: doc.wires.filter(function (w) { return !cut[w.id]; }) });
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

    // continuation markers with the same name are the same conductor
    var byName = {};
    doc.comps.forEach(function (c) {
      if (c.kind === "Continuation" && c.name && terms[c.id].length) (byName[c.name] = byName[c.name] || []).push(terms[c.id][0]);
    });
    Object.keys(byName).forEach(function (nm) { byName[nm].forEach(function (i) { d.union(byName[nm][0], i); }); });
    var base = pts.map(function (_, i) { return d.find(i); });
    return { idx: idx, coordList: coordList, pts: pts, base: base, terms: terms, wireNode: wireNode };
  }

  SL.MOTOR_ACCEL = 0.6; // s to full speed, direct-on-line start
  SL.MOTOR_DECEL = 1.0; // s to stop when the supply goes
  /** Running speed of a motor as a fraction (drawing speed and the % shown). */
  function motorLevel(c, st) {
    if (c.kind === "Motor3YD") return st.conn === 1 ? 0.4 : 1;
    if (c.kind === "Motor3Dahl") return st.conn === 1 ? 0.45 : 0.9;
    if (c.kind === "Motor3WR") return 0.8 / (1 + (st.steps || 0) * 0.8);
    return 0.75;
  }
  SL.motorLevel = motorLevel;

  function Sim(doc) {
    this.st = {};
    this.pot = {};
    this.wirePot = {};
    this.fault = null;
    this.time = 0;
    this.events = [];    // messages for the status bar (trips, blown fuses)
    this.log = [];       // event log: { t, text }
    this.sig = {};       // timing chart: id -> { label, changes: [[t, value]] }
    this.forceOpen = {}; // ids treated as open while looking for the device that clears a fault
    var self = this;
    doc.comps.forEach(function (c) {
      // breakers and switches start closed (estimated)
      self.st[c.id] = { energized: false, on: false, t: 0, act: SL.KINDS[c.kind].role === "Manual" && !!c.closed, // new breakers start open (sub_43ee20 / sub_40d2b0)
        motor: 0, conn: 0, angle: 0, prev: false };
      if (c.kind === "LogicPreset") self.st[c.id].val = c.value || 0;
    });
  }

  /** Hidden fault on element/wire `id` (fault mode): "open", "stuck", "cut" or undefined. */
  Sim.prototype.flt = function (doc, id) {
    if (!this.fltMap || this.fltDoc !== doc.faults) {
      this.fltDoc = doc.faults;
      this.fltMap = {};
      var m = this.fltMap;
      (doc.faults || []).forEach(function (f) { m[f.id] = f.type; });
    }
    return this.fltMap[id];
  };

  Sim.prototype.s = function (id) {
    return this.st[id] || (this.st[id] = { energized: false, on: false, t: 0, act: false, motor: 0, conn: 0, angle: 0, prev: false });
  };

  Sim.prototype.drivers = function (doc) {
    this.doc = doc;
    var m = {}, self = this;
    doc.comps.forEach(function (c) {
      if (!c.name) return;
      var st = self.s(c.id), on = null;
      if (SL.KINDS[c.kind].coil) on = st.on;
      else if (c.kind === "ThermalRelay3") on = st.act;
      if (on !== null) m[c.name] = !!(m[c.name] || on);
    });
    return m;
  };

  Sim.prototype.closed = function (c, drivers) {
    var st = this.s(c.id), K = SL.KINDS[c.kind];
    if (this.forceOpen[c.id]) return false;
    var f = this.doc ? this.flt(this.doc, c.id) : null;
    if (f === "open") return false;
    if (f === "stuck") return true;
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
      if (self.flt(doc, c.id) === "open") return; // fault: the element does not conduct at all
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
    var topo = SL.topoFor(doc), self = this;
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
      if (SL.KINDS[c.kind].motor) {
        // mechanical speed (0..1 of the element's level) follows a ramp; a braked motor stays still
        var target = st.motor && !st.blocked ? motorLevel(c, st) : 0, spd = st.spd || 0;
        var up = st.rampT || SL.MOTOR_ACCEL, down = st.rampT || SL.MOTOR_DECEL;
        spd = spd < target ? Math.min(target, spd + dt / up) : Math.max(target, spd - dt / down);
        st.spd = spd;
        if (st.motor) st.dir = st.motor;
        st.angle += dt * 8 * (st.dir || 1) * spd;
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
        if (self.flt(doc, c.id) === "open") pots = pots.map(function () { return 0; }); // burnt coil / open winding
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
        } else if (c.kind === "Motor3Dahl") {
          // low speed: 1U 1V 1W fed (delta), 2U 2V 2W free; high speed: 2U 2V 2W fed and 1U 1V 1W joined (YY)
          var lowD = orderDir(pots[0], pots[1], pots[2]), hiD = orderDir(pots[3], pots[4], pots[5]);
          var anyLow = pots.slice(0, 3).some(Boolean), anyHi = pots.slice(3, 6).some(Boolean);
          var joined = r.roots[t[0]] === r.roots[t[1]] && r.roots[t[1]] === r.roots[t[2]];
          st.motor = 0; st.conn = 0;
          if (lowD && !anyHi) { st.motor = lowD; st.conn = 1; }
          else if (hiD && joined && !anyLow) { st.motor = hiD; st.conn = 2; }
          st.energized = st.motor !== 0;
          st.twoPhase = !st.motor && (anyLow || anyHi); // wrong or incomplete connection: it hums
        } else if (c.kind === "Motor1Cap") {
          // main winding U1-U2 and auxiliary Z1-Z2: swapping Z1/Z2 reverses it; without Z it hums
          var mainW = validPair(pots[0], pots[1]), auxW = validPair(pots[2], pots[3]);
          st.motor = mainW && auxW ? (pots[2] === pots[1] ? -1 : 1) : 0;
          st.energized = st.motor !== 0;
          st.twoPhase = mainW && !auxW;
        } else if (c.kind === "MotorDC") {
          // the polarity of the armature sets the direction; AC does not turn it
          st.motor = pots[0] === P.POS && pots[1] === P.NEG ? 1 : pots[0] === P.NEG && pots[1] === P.POS ? -1 : 0;
          st.energized = st.motor !== 0;
        } else if (c.kind === "Motor3WR") {
          // stator U V W; rotor K L M must be closed (directly or through the starting resistors)
          var dWR = orderDir(pots[0], pots[1], pots[2]);
          var rotorClosed = t.length >= 7 && r.roots[t[4]] === r.roots[t[5]] && r.roots[t[5]] === r.roots[t[6]];
          st.motor = rotorClosed ? dWR : 0;
          st.rotorOpen = dWR !== 0 && !rotorClosed;
          st.energized = st.motor !== 0;
          var phWR = pots.slice(0, 3).filter(isPhase);
          st.twoPhase = dWR === 0 && phWR.length === 2 && phWR[0] !== phWR[1];
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
    this.record(doc);
    return null;
  };

  /** Status-bar message that also goes to the event log. */
  Sim.prototype.note = function (text) {
    this.events.push(text);
    this.log.push({ t: this.time, text: text });
    if (this.log.length > 5000) this.log.splice(0, 1000);
  };

  /**
   * Value of the signal shown for an element in the log and the timing chart,
   * with the words for its two states; null for elements that are not tracked.
   */
  Sim.prototype.signal = function (doc, c) {
    var K = SL.KINDS[c.kind], st = this.s(c.id);
    if (!c.name && K.role !== "Logic") return null;
    if (/^Motor/.test(c.kind)) return { v: st.motor ? 1 : 0, on: st.motor < 0 ? "arrenca (gir antihorari)" : "arrenca", off: "s'atura" };
    if (c.kind === "ThermalRelay3") return { v: st.act ? 1 : 0, on: "ha disparat", off: "rearmat" };
    if (K.role === "Load") {
      if (K.coil || c.kind === "LatchCoil" || c.kind === "StepRelay" || c.kind === "Solenoid")
        return { v: st.on ? 1 : 0, on: "s'excita (actua)", off: "es desexcita" };
      return { v: st.energized || st.on ? 1 : 0, on: "s'encén / sona", off: "s'apaga" };
    }
    if (K.role === "Actuator") return { v: st.act ? 1 : 0, on: K.click === "momentary" ? "premut" : "accionat", off: K.click === "momentary" ? "deixat anar" : "en repòs" };
    if (K.role === "Manual") return { v: st.act ? 1 : 0, on: "tancat", off: "obert" };
    if (K.role === "Logic" && c.name) {
      var lo = st.lo || [], cur = st.cur || [];
      var v = lo.length ? (lo[0] ? 1 : 0) : (cur[0] ? 1 : 0);
      return { v: v, on: "= 1", off: "= 0" };
    }
    return null;
  };

  /** Record state changes for the event log and the timing chart. */
  Sim.prototype.record = function (doc) {
    var self = this, batch = [];
    // within one step, list causes before effects: controls, protections, coils, signals, motors
    var rank = function (c) {
      var K = SL.KINDS[c.kind];
      return K.role === "Actuator" || K.role === "Manual" ? 0 : c.kind === "ThermalRelay3" ? 1 : K.motor ? 4 : K.coil ? 2 : 3;
    };
    doc.comps.forEach(function (c) {
      var sg = self.signal(doc, c);
      if (!sg) return;
      var rec = self.sig[c.id];
      if (!rec) {
        self.sig[c.id] = { label: c.name || SL.KINDS[c.kind].label, kind: c.kind, changes: [[self.time, sg.v]] };
        return;
      }
      var last = rec.changes[rec.changes.length - 1][1];
      if (last === sg.v) return;
      rec.changes.push([self.time, sg.v]);
      if (rec.changes.length > 4000) rec.changes.splice(0, 1000);
      batch.push({ r: rank(c), e: { t: self.time, text: rec.label + " " + (sg.v ? sg.on : sg.off) } });
    });
    batch.sort(function (a, b) { return a.r - b.r; }).forEach(function (x) { self.log.push(x.e); });
    if (self.log.length > 5000) self.log.splice(0, 1000);
  };

  /** Overload relays carrying a single-phasing motor trip after TRIP_TIME_THERMAL. */
  SL.TRIP_TIME_BLOCKED = 5;  // s for a stalled (braked) motor
  SL.THERMAL_COOL = 20;      // s to cool down completely

  /**
   * Overload relays: they heat up while they carry a motor that runs on two
   * phases (trip in TRIP_TIME_THERMAL) or is braked (TRIP_TIME_BLOCKED), and
   * cool down otherwise; with automatic reset they close again once cool.
   * Also: speed ramps of motors fed through starters/drives, and the
   * resistor steps of wound-rotor motors.
   */
  Sim.prototype.thermalOverload = function (doc, topo, r, dt) {
    if (!r) return;
    var self = this, heat = {}, why = {};
    var rootsOf = function (c) { return topo.terms[c.id].map(function (j) { return r.roots[j]; }); };
    doc.comps.forEach(function (c) {
      if (!SL.KINDS[c.kind].motor) return;
      var st = self.s(c.id), rate = 0, reason = "";
      if (st.twoPhase) { rate = 1 / SL.TRIP_TIME_THERMAL; reason = "motor funcionant amb dues fases o mal connectat"; }
      else if (st.blocked && st.motor) { rate = 1 / SL.TRIP_TIME_BLOCKED; reason = "sobrecàrrega: motor frenat"; }
      if (rate) rootsOf(c).forEach(function (k) { if (!heat[k] || heat[k] < rate) { heat[k] = rate; why[k] = reason; } });
      // ramp: a starter or drive with a terminal on the motor's circuit sets the ramp time
      var mr = rootsOf(c), ramp = null;
      doc.comps.forEach(function (o) {
        if (SL.KINDS[o.kind].ramp && rootsOf(o).some(function (k) { return mr.indexOf(k) >= 0; })) ramp = Math.max(0.1, SL.presetSecs(o));
      });
      st.rampT = ramp;
      if (c.kind === "Motor3WR") st.steps = st.motor ? self.rotorSteps(doc, topo, c) : 0;
    });
    doc.comps.forEach(function (c) {
      if (c.kind !== "ThermalRelay3") return;
      var st = self.s(c.id), ks = rootsOf(c), rate = 0, reason = "";
      ks.forEach(function (k) { if (heat[k] > rate) { rate = heat[k]; reason = why[k]; } });
      if (st.act) {
        st.heat = Math.max(0, (st.heat || 0) - dt / SL.THERMAL_COOL);
        if (c.auto_reset && st.heat <= 0.3) {
          self.setActuator(doc, c.id, false);
          self.note((c.name || "Relé tèrmic") + ": rearmament automàtic");
        }
        return;
      }
      st.heat = rate ? (st.heat || 0) + dt * rate : Math.max(0, (st.heat || 0) - dt / SL.THERMAL_COOL);
      if (st.heat >= 1) {
        self.setActuator(doc, c.id, true);
        self.note((c.name || "Relé tèrmic") + ": ha disparat el relé tèrmic (" + reason + ")");
      }
    });
  };

  /** Starting-resistor steps still in a wound rotor's circuit (each one not bridged by a contact). */
  Sim.prototype.rotorSteps = function (doc, topo, m) {
    var self = this, t = topo.terms[m.id], steps = 0, keep = [this.pot, this.wirePot];
    var rotorClosed = function (rr) { return rr.roots[t[4]] === rr.roots[t[5]] && rr.roots[t[5]] === rr.roots[t[6]]; };
    var base = this.solve(doc, topo), rotor = [base.roots[t[4]], base.roots[t[5]], base.roots[t[6]]];
    doc.comps.forEach(function (o) {
      if (o.kind !== "Resistor3" && o.kind !== "Resistor1") return;
      if (!topo.terms[o.id].some(function (j) { return rotor.indexOf(base.roots[j]) >= 0; })) return;
      self.forceOpen[o.id] = true;
      var rr = self.solve(doc, topo);
      delete self.forceOpen[o.id];
      if (!rotorClosed(rr)) steps++;
    });
    this.pot = keep[0]; this.wirePot = keep[1]; // trial solves must not change what is drawn
    return steps;
  };

  /** Click on a motor during simulation: brake it (stall) or release it. */
  Sim.prototype.toggleBrake = function (doc, id) {
    var st = this.s(id), c = doc.comps.find(function (x) { return x.id === id; });
    st.blocked = !st.blocked;
    this.note((c && c.name || "Motor") + (st.blocked ? ": frenat (sobrecàrrega)" : ": fre alliberat"));
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
      this.note((c.name || "Fusible") + ": s'ha fos el fusible (" + why + "). Feu-hi clic per canviar-lo.");
    } else {
      this.setActuator(doc, c.id, false);
      doc.comps.forEach(function (o) { if (o.id === c.id || (c.name && o.name === c.name && o.kind === c.kind)) self.s(o.id).tripped = true; });
      this.note((c.name || SL.KINDS[c.kind].label) + ": ha disparat " +
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
    this.note((c && c.name || "Fusible") + ": fusible canviat");
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

  // ---------------------------------------------------------------- probe (polímetre)
  var POT_NAMES = [[P.L1, "L1"], [P.L2, "L2"], [P.L3, "L3"], [P.N, "N"], [P.PE, "PE"], [P.POS, "+"], [P.NEG, "−"]];
  /** "L1", "N", "+"... or "sense tensió" for a potential mask. */
  SL.potName = function (m) {
    if (!m) return "sense tensió";
    return POT_NAMES.filter(function (x) { return m & x[0]; }).map(function (x) { return x[1]; }).join("+");
  };
  /** Reading of a voltmeter between two points (masks), as text. Nominal 230/400 V AC, 24 V DC. */
  SL.voltage = function (ma, mb) {
    var a = single(ma), b = single(mb), dc = function (p) { return p === P.POS || p === P.NEG; };
    if (!a || !b) return "0 V (" + (!a && !b ? "cap punt amb tensió" : "un punt sense tensió") + ")";
    if (a === b) return "0 V";
    if (dc(a) && dc(b)) return "24 V CC";
    if (dc(a) || dc(b)) return "— (CC i CA no comparables)";
    if (isPhase(a) && isPhase(b)) return "400 V CA";
    if ((a === P.N && b === P.PE) || (a === P.PE && b === P.N)) return "0 V";
    return "230 V CA";
  };
  /** Potential mask at a world point during simulation: on a wire or at a terminal/junction. */
  Sim.prototype.potAt = function (doc, w, tol) {
    var best = null, bd = tol;
    var self = this;
    Object.keys(this.pot).forEach(function (k) {
      var p = k.split(","), dd = Math.hypot(+p[0] - w[0], +p[1] - w[1]);
      if (dd <= bd) { bd = dd; best = { m: self.pot[k] || 0, where: "punt" }; }
    });
    if (best) return best;
    for (var i = doc.wires.length - 1; i >= 0; i--) {
      var x = doc.wires[i], a = x.a, b = x.b;
      var abx = b[0] - a[0], aby = b[1] - a[1], l2 = abx * abx + aby * aby;
      var t = l2 ? Math.max(0, Math.min(1, ((w[0] - a[0]) * abx + (w[1] - a[1]) * aby) / l2)) : 0;
      if (Math.hypot(a[0] + abx * t - w[0], a[1] + aby * t - w[1]) <= tol) return { m: this.wirePot[x.id] || 0, where: "conductor" };
    }
    return null;
  };

  SL.Sim = Sim;

  /** What a click on this element does during simulation (see SL.KINDS[k].click). */
  SL.clickKind = function (kind) { return SL.KINDS[kind].click; };
})((typeof globalThis !== "undefined" ? globalThis : window).SL);
