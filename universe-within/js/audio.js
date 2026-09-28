/* The Universe Within — sound sketches (Web Audio, synthesised in the browser).
   These are placeholders that suggest each room's intended sound design.
   Nothing plays until the visitor turns sound on. */
(function () {
  'use strict';
  const A = { on: false, volume: 0.6 };
  let ctx = null, master = null, noiseBuf = null, beds = {}, current = null;
  let lastPhase = 0, lastBubble = 0;

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); let b = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = w * 0.5 + b * 3; }
    return true;
  }
  function noise() { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(); return s; }
  function osc(type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; }
  function gain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function filt(type, f, q) { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; if (q) x.Q.value = q; return x; }
  function lfo(f, depth, param) { const o = osc('sine', f); const g = gain(depth); o.connect(g); g.connect(param); return o; }

  function makeBed(id) {
    const out = gain(0); out.connect(master);
    const bed = { out, extra: {} };
    if (id === 'entrance') {
      [55, 82.4, 110.2].forEach((f, i) => { const o = osc('sine', f); const g = gain(0.05 / (i + 1)); o.connect(g); g.connect(out); lfo(0.05 + i * 0.03, 0.02, g.gain); });
      const n = noise(), lp = filt('lowpass', 380, 0.7), g = gain(0.05); n.connect(lp); lp.connect(g); g.connect(out); lfo(0.07, 160, lp.frequency);
    } else if (id === 'mouth') {
      const n = noise(), bp = filt('bandpass', 900, 0.9), g = gain(0.1); n.connect(bp); bp.connect(g); g.connect(out); lfo(0.18, 500, bp.frequency); lfo(0.11, 0.06, g.gain);
      const fz = noise(), hp = filt('highpass', 5200, 0.7), fg = gain(0); fz.connect(hp); hp.connect(fg); fg.connect(out); bed.extra.fizz = fg;
    } else if (id === 'digestive') {
      const n = noise(), lp = filt('lowpass', 170, 1.2), g = gain(0.22), pan = ctx.createStereoPanner(); n.connect(lp); lp.connect(g); g.connect(pan); pan.connect(out);
      lfo(0.12, 0.16, g.gain); lfo(0.06, 0.9, pan.pan);
      const o = osc('sine', 38), og = gain(0.06); o.connect(og); og.connect(out); lfo(0.12, 0.05, og.gain);
    } else if (id === 'heart') {
      const n = noise(), lp = filt('lowpass', 220, 0.8), g = gain(0.035); n.connect(lp); lp.connect(g); g.connect(out);
    } else if (id === 'cellular') {
      const n = noise(), bp = filt('bandpass', 1800, 6), g = gain(0.03); n.connect(bp); bp.connect(g); g.connect(out); lfo(0.03, 600, bp.frequency);
      [146.8, 220, 293.7].forEach((f, i) => { const o = osc('triangle', f), lp = filt('lowpass', 700), og = gain(0); o.connect(lp); lp.connect(og); og.connect(out); lfo(0.021 + i * 0.013, 0.012, og.gain); og.gain.value = 0.012; });
    } else if (id === 'signals') {
      const n = noise(), lp = filt('lowpass', 300), g = gain(0.04); n.connect(lp); lp.connect(g); g.connect(out);
    } else {
      const n = noise(), lp = filt('lowpass', 500), g = gain(0.03); n.connect(lp); lp.connect(g); g.connect(out);
    }
    return bed;
  }

  function thump(freq, level, when) {
    const o = ctx.createOscillator(), g = gain(0), t = when || ctx.currentTime;
    o.type = 'sine'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.18);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.26);
    o.connect(g); g.connect(beds.heart ? beds.heart.out : master); o.start(t); o.stop(t + 0.3);
  }
  function bubble() {
    const o = ctx.createOscillator(), g = gain(0), t = ctx.currentTime, f = 400 + Math.random() * 900;
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.06);
    g.gain.setValueAtTime(0.025, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.08);
    o.connect(g); g.connect(beds.mouth.out); o.start(t); o.stop(t + 0.1);
  }

  A.enable = function () {
    if (!ensure()) return false;
    ctx.resume(); A.on = true; master.gain.setTargetAtTime(A.volume, ctx.currentTime, 0.2); return true;
  };
  A.disable = function () { A.on = false; if (ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.1); };
  A.setVolume = function (v) { A.volume = v; if (ctx && A.on) master.gain.setTargetAtTime(v, ctx.currentTime, 0.1); };
  A.setRoom = function (id) {
    if (!ctx || id === current) return;
    if (current && beds[current]) beds[current].out.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
    current = id;
    if (id) { beds[id] = beds[id] || makeBed(id); beds[id].out.gain.setTargetAtTime(1, ctx.currentTime, 0.8); }
  };
  // called every frame with the room's projection clock so sound follows the imagery
  A.tick = function (roomId, t, opts, playing) {
    if (!ctx || !A.on) return;
    A.setRoom(playing ? roomId : null);
    if (!playing) return;
    if (roomId === 'heart' && window.UW_PROJ && window.UW_PROJ.heartPhase && opts.audioOn !== false) {
      const ph = window.UW_PROJ.heartPhase(t, opts.bpm || 64);
      if (ph < lastPhase) thump(58, 0.55);
      if (lastPhase < 0.35 && ph >= 0.35) thump(74, 0.35);
      lastPhase = ph;
    }
    if (roomId === 'mouth' && beds.mouth) {
      const now = ctx.currentTime;
      if (now - lastBubble > 0.25 + Math.random() * 1.2) { lastBubble = now; bubble(); }
      beds.mouth.extra.fizz.gain.setTargetAtTime(opts.variant === 'sugar' ? 0.03 : 0, now, 0.4);
    }
  };
  // travelling signal: a soft click at each node, panned across the room
  A.signal = function (dur) {
    if (!ctx || !A.on) return;
    const t0 = ctx.currentTime, n = 9;
    for (let i = 0; i < n; i++) {
      const t = t0 + dur * i / (n - 1), p = ctx.createStereoPanner(); p.pan.value = -1 + 2 * i / (n - 1);
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; const bp = filt('bandpass', 1400 + i * 60, 4), g = gain(0);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.12);
      s.connect(bp); bp.connect(g); g.connect(p); p.connect(master); s.start(t, Math.random()); s.stop(t + 0.15);
    }
    const o = ctx.createOscillator(), g = gain(0), p = ctx.createStereoPanner();
    o.frequency.value = 90; p.pan.setValueAtTime(-1, t0); p.pan.linearRampToValueAtTime(1, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.06, t0 + 0.3); g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(g); g.connect(p); p.connect(master); o.start(t0); o.stop(t0 + dur + 0.1);
  };
  A.pulseDemo = function (bpm) {
    if (!ctx || !A.on) return; const iv = 60 / (bpm || 64);
    for (let i = 0; i < 6; i++) { thump(58, 0.5, ctx.currentTime + i * iv); thump(74, 0.3, ctx.currentTime + i * iv + iv * 0.35); }
  };
  window.UW_AUDIO = A;
})();
