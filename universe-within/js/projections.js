/*
 * The Universe Within — procedural projection imagery (Canvas 2D).
 *
 * Every room's projected sequence is drawn from cached, seeded layout data and
 * pre-rendered texture tiles, so a frame is a handful of blits plus a few
 * hundred vector primitives. Everything is expressed relative to (w, h).
 *
 *   UW_PROJ.draw(roomId, ctx, w, h, t, opts)
 *   UW_PROJ.thumb(roomId, ctx, w, h, opts)
 *   UW_PROJ.heartPhase(t, bpm)  -> 0..1 phase within the beat
 *   UW_PROJ.beatPulse(t, bpm)   -> 0..1 pulse (lub at phase 0, dub ~0.35)
 *   UW_PROJ.duration / UW_PROJ.chapters
 *
 * Art direction: wet tissue, bone, ochre and grey; soft directional shading;
 * no emissive glow, neon or HUD graphics. Science simplified but not wrong.
 */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Maths, colour and PRNG helpers                                      */
  /* ------------------------------------------------------------------ */
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, k) => a + (b - a) * k;
  const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  const fract = (x) => x - Math.floor(x);
  const mix = (c1, c2, k) => [lerp(c1[0], c2[0], k), lerp(c1[1], c2[1], k), lerp(c1[2], c2[2], k)];
  const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a == null ? 1 : +a.toFixed(3)) + ')';

  /** mulberry32 seeded PRNG */
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(x, y, s) {
    let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, s, oct) {
    let v = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { v += a * vnoise(x * f, y * f, s + i * 31); n += a; f *= 2.03; a *= 0.5; }
    return v / n;
  }

  /* ------------------------------------------------------------------ */
  /* Caches: offscreen canvases, sprites and layouts                    */
  /* ------------------------------------------------------------------ */
  // Sprites/layouts are size-independent and bounded; size-keyed textures are evicted oldest-first
  // so a host that resizes often cannot grow memory without limit.
  const CACHE = new Map(), SIZED = /\d+x\d+/;
  let nSized = 0;
  function memo(key, fn) {
    let v = CACHE.get(key);
    if (v === undefined) {
      if (SIZED.test(key) && ++nSized > 48) {
        for (const k of CACHE.keys()) if (SIZED.test(k)) { CACHE.delete(k); nSized--; break; }
      }
      v = fn(); CACHE.set(key, v);
    }
    return v;
  }
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }
  const cx2d = (c) => c._x || (c._x = c.getContext('2d'));
  /** Bucketed texture dimensions for a canvas of w×h at oversampling k. */
  function dims(w, h, k) {
    const target = w * (k || 1) * 0.92;
    const B = [192, 256, 384, 512, 768, 1024, 1440, 2048];
    let tw = B[B.length - 1];
    for (let i = 0; i < B.length; i++) if (B[i] >= target) { tw = B[i]; break; }
    return [tw, Math.max(8, Math.round(tw * h / w))];
  }

  /** Shaded sphere (directional light from upper left). */
  function ball(c) {
    return memo('ball' + c, () => {
      const s = 64, cv = canvas(s, s), x = cx2d(cv);
      const g = x.createRadialGradient(s * 0.36, s * 0.32, s * 0.03, s * 0.5, s * 0.5, s * 0.5);
      g.addColorStop(0, rgba(mix(c, [240, 232, 216], 0.45)));
      g.addColorStop(0.3, rgba(mix(c, [240, 232, 216], 0.12)));
      g.addColorStop(0.75, rgba(shade(c, 0.72)));
      g.addColorStop(1, rgba(shade(c, 0.38)));
      x.fillStyle = g; x.beginPath(); x.arc(s / 2, s / 2, s / 2 - 0.5, 0, TAU); x.fill();
      return cv;
    });
  }
  /** Lumpy protein-like blob built from several shaded spheres; blurred variant for far layers. */
  function blob(c, v, blur) {
    return memo('blob' + c + '/' + v + '/' + (blur ? 1 : 0), () => {
      const s = 64, cv = canvas(s, s), x = cx2d(cv), R = rng(991 + v * 37);
      if (blur) { x.filter = 'blur(3px)'; x.globalAlpha = 0.85; }
      const n = 3 + Math.floor(R() * 4);
      for (let i = 0; i < n; i++) {
        const r = s * (0.13 + R() * 0.12), a = R() * TAU, d = R() * s * 0.16;
        x.drawImage(ball(c), s / 2 + Math.cos(a) * d - r, s / 2 + Math.sin(a) * d - r, r * 2, r * 2);
      }
      return cv;
    });
  }
  /** Soft white highlight (used for wet specular streaks — low alpha, not glow). */
  function hilite() {
    return memo('hilite', () => {
      const s = 64, cv = canvas(s, s), x = cx2d(cv);
      const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,248,236,1)'); g.addColorStop(0.35, 'rgba(255,248,236,0.45)'); g.addColorStop(1, 'rgba(255,248,236,0)');
      x.fillStyle = g; x.fillRect(0, 0, s, s); return cv;
    });
  }
  /** Soft dark shadow blob. */
  function shadowSpr() {
    return memo('shadow', () => {
      const s = 64, cv = canvas(s, s), x = cx2d(cv);
      const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, s, s); return cv;
    });
  }
  /** Red blood cell, face-on biconcave disc: raised rim, shallow central dimple. */
  function rbcSprite(blur) {
    return memo('rbc' + (blur ? 'b' : ''), () => {
      const s = 64, cv = canvas(s, s), x = cx2d(cv);
      if (blur) x.filter = 'blur(2.5px)';
      const g = x.createRadialGradient(s * 0.5, s * 0.5, 0, s * 0.5, s * 0.5, s * 0.47);
      g.addColorStop(0, 'rgb(112,20,22)'); g.addColorStop(0.36, 'rgb(122,24,25)');
      g.addColorStop(0.64, 'rgb(172,50,46)'); g.addColorStop(0.86, 'rgb(136,30,30)'); g.addColorStop(1, 'rgb(72,10,12)');
      x.fillStyle = g; x.beginPath(); x.arc(s / 2, s / 2, s * 0.47, 0, TAU); x.fill();
      x.globalCompositeOperation = 'source-atop';
      const l = x.createLinearGradient(0, 0, s, s);
      l.addColorStop(0, 'rgba(255,220,200,0.22)'); l.addColorStop(0.5, 'rgba(0,0,0,0)'); l.addColorStop(1, 'rgba(0,0,0,0.3)');
      x.fillStyle = l; x.fillRect(0, 0, s, s);
      return cv;
    });
  }
  /** Rod-shaped bacterium sprite (capsule with cylindrical shading). */
  function rodSprite(c, blur) {
    return memo('rod' + c + (blur ? 'b' : ''), () => {
      const W = 96, H = 32, cv = canvas(W, H), x = cx2d(cv);
      if (blur) x.filter = 'blur(2px)';
      const r = H * 0.42;
      x.beginPath(); x.moveTo(W / 2 - (W / 2 - r - 3), H / 2 - r);
      x.arc(W - r - 3, H / 2, r, -Math.PI / 2, Math.PI / 2); x.arc(r + 3, H / 2, r, Math.PI / 2, Math.PI * 1.5); x.closePath();
      const g = x.createLinearGradient(0, H / 2 - r, 0, H / 2 + r);
      g.addColorStop(0, rgba(mix(c, [236, 228, 212], 0.35))); g.addColorStop(0.35, rgba(c));
      g.addColorStop(1, rgba(shade(c, 0.42)));
      x.fillStyle = g; x.fill();
      x.strokeStyle = rgba(shade(c, 0.45), 0.5); x.lineWidth = 1; x.stroke();
      return cv;
    });
  }
  /** Fine film-grain tile, drawn with soft-light at low alpha to break up gradients. */
  function grainTex(w, h) {
    const [W, H] = dims(w, h, 1);
    return memo('grain' + W + 'x' + H, () => {
      const cv = canvas(W, H), x = cx2d(cv), id = x.createImageData(W, H), d = id.data;
      for (let j = 0, p = 0; j < H; j++) for (let i = 0; i < W; i++, p += 4) {
        const v = 128 + (hash2(i, j, 7) - 0.5) * 70 + (fbm(i / 40, j / 40, 3, 3) - 0.5) * 70;
        d[p] = d[p + 1] = d[p + 2] = v; d[p + 3] = 255;
      }
      x.putImageData(id, 0, 0); return cv;
    });
  }
  /** Pre-rendered vignette + fine grain overlay (one blit per frame instead of two full-frame passes). */
  function finish(ctx, S, v) {
    const [W, H] = dims(S.w, S.h, 1), vq = Math.round(v * 20) / 20;
    const cv = memo('fin' + vq + ':' + W + 'x' + H, () => {
      const c = canvas(W, H), x = cx2d(c), id = x.createImageData(W, H), d = id.data, D = Math.hypot(W, H) * 0.58, r0 = Math.min(W, H) * 0.25 / D;
      for (let j = 0, p = 0; j < H; j++) for (let i = 0; i < W; i++, p += 4) {
        const k = sstep(r0, 1, Math.hypot(i - W / 2, j - H / 2) / D);
        d[p] = 6; d[p + 1] = 3; d[p + 2] = 2;
        d[p + 3] = 255 * clamp(vq * k * k * 1.1 + 0.035 + (hash2(i, j, 7) - 0.5) * 0.07 + (fbm(i / 40, j / 40, 3, 2) - 0.5) * 0.08, 0, 1);
      }
      x.putImageData(id, 0, 0); return c;
    });
    ctx.drawImage(cv, 0, 0, S.w, S.h);
  }
  function vignette(ctx, S, a, cx, cy) {
    const { w, h } = S;
    const g = ctx.createRadialGradient(cx == null ? w / 2 : cx, cy == null ? h / 2 : cy, Math.min(w, h) * 0.25, w / 2, h / 2, Math.hypot(w, h) * 0.58);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(6,3,2,' + a + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  function fillBG(ctx, S, inner, outer, cx, cy) {
    const { w, h } = S;
    const g = ctx.createRadialGradient(cx * w, cy * h, 0, cx * w, cy * h, Math.hypot(w, h) * 0.62);
    g.addColorStop(0, rgba(inner)); g.addColorStop(1, rgba(outer));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  /** Smooth closed/open Path2D through points (quadratic through midpoints). */
  function smoothPath(pts, closed, p) {
    p = p || new Path2D();
    const n = pts.length;
    if (closed) {
      const a = pts[n - 1], b = pts[0];
      p.moveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      for (let i = 0; i < n; i++) { const q = pts[i], r = pts[(i + 1) % n]; p.quadraticCurveTo(q[0], q[1], (q[0] + r[0]) / 2, (q[1] + r[1]) / 2); }
      p.closePath();
    } else {
      p.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n - 1; i++) { const q = pts[i], r = pts[i + 1]; p.quadraticCurveTo(q[0], q[1], (q[0] + r[0]) / 2, (q[1] + r[1]) / 2); }
      p.lineTo(pts[n - 1][0], pts[n - 1][1]);
    }
    return p;
  }
  function capsule(ctx, L, W) { // centred at origin, long axis x
    const r = W / 2, a = Math.max(0, L / 2 - r);
    ctx.beginPath(); ctx.moveTo(-a, -r); ctx.lineTo(a, -r); ctx.arc(a, 0, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(-a, r); ctx.arc(-a, 0, r, Math.PI / 2, Math.PI * 1.5); ctx.closePath();
  }

  /* ------------------------------------------------------------------ */
  /* Text: scale indicators, chapter tags and simplification labels     */
  /* ------------------------------------------------------------------ */
  const fontFor = (h) => '500 ' + Math.round(h * 0.035) + 'px "IBM Plex Sans", system-ui, sans-serif';
  function label(ctx, S, str, x, y, align, a) {
    if (!S.labels || !str) return;
    a = a == null ? 1 : a; if (a <= 0.01) return;
    ctx.save(); ctx.font = fontFor(S.h); ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(0,0,0,' + (0.35 * a).toFixed(3) + ')'; ctx.fillText(str, x + 1, y + 1);
    ctx.fillStyle = 'rgba(236,228,212,' + (0.8 * a).toFixed(3) + ')'; ctx.fillText(str, x, y);
    ctx.restore();
  }
  /** Bottom-left approximate scale tag (a small bracket and text). */
  function scaleTag(ctx, S, str, a) {
    if (!S.labels) return;
    const { w, h } = S, x = w * 0.035, y = h * 0.93, bl = h * 0.06;
    ctx.save(); ctx.globalAlpha = a == null ? 1 : a;
    ctx.strokeStyle = 'rgba(236,228,212,0.7)'; ctx.lineWidth = Math.max(1, h * 0.004);
    ctx.beginPath(); ctx.moveTo(x, y - h * 0.018); ctx.lineTo(x, y); ctx.lineTo(x + bl, y); ctx.lineTo(x + bl, y - h * 0.018); ctx.stroke();
    ctx.restore();
    label(ctx, S, str, x + bl + h * 0.02, y, 'left', a);
  }
  function fmtLen(um) {
    if (um >= 1000) return (um / 1000) + ' mm';
    if (um >= 1) return (Math.round(um * 10) / 10) + ' µm';
    return Math.round(um * 1000) + ' nm';
  }
  /** Animated scale bar: nice 1/2/5 length no wider than ~26% of the frame. */
  function scaleBar(ctx, S, fieldUm, a) {
    if (!S.labels) return;
    const { w, h } = S, maxL = fieldUm * 0.26, p = Math.pow(10, Math.floor(Math.log10(maxL)));
    const L = maxL >= 5 * p ? 5 * p : maxL >= 2 * p ? 2 * p : p;
    const px = L / fieldUm * w, x = w * 0.035, y = h * 0.93;
    ctx.save(); ctx.globalAlpha = a == null ? 1 : a;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + 1, y - h * 0.006 + 1, px, h * 0.012);
    ctx.fillStyle = 'rgba(236,228,212,0.8)'; ctx.fillRect(x, y - h * 0.006, px, h * 0.012);
    ctx.restore();
    label(ctx, S, fmtLen(L), x, y - h * 0.03, 'left', a);
  }

  /* ------------------------------------------------------------------ */
  /* Layer compositing: cross-fade whole scenes via a scratch canvas    */
  /* ------------------------------------------------------------------ */
  let depth = 0;
  function layer(ctx, S, a, fn) {
    if (a <= 0.004) return;
    if (a >= 0.996) { ctx.save(); fn(ctx); ctx.restore(); return; }
    const W = Math.max(1, Math.round(S.w)), H = Math.max(1, Math.round(S.h));
    const c = memo('scr' + depth + ':' + W + 'x' + H, () => canvas(W, H)), x = cx2d(c);
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, W, H);
    x.save(); depth++;
    try { fn(x); } finally { depth--; x.restore(); }
    ctx.save(); ctx.globalAlpha = a; ctx.drawImage(c, 0, 0, S.w, S.h); ctx.restore();
  }
  /** Zoom about screen point (fx, fy). */
  function zoomAt(ctx, fx, fy, s) { ctx.translate(fx, fy); ctx.scale(s, s); ctx.translate(-fx, -fy); }

  /* ------------------------------------------------------------------ */
  /* Shared textures                                                    */
  /* ------------------------------------------------------------------ */
  /** Worley (cellular) tissue: packed polygonal cells, nuclei, optional ECM channels. */
  function tissueTex(w, h, pal, seed, cellFrac) {
    const [W, H] = dims(w, h, 1.35);
    return memo('tissue' + seed + ':' + W + 'x' + H, () => {
      const cv = canvas(W, H), x = cx2d(cv), id = x.createImageData(W, H), d = id.data;
      const cell = W * cellFrac, gx = Math.ceil(W / cell) + 2, gy = Math.ceil(H / cell) + 2, R = rng(seed);
      const px = new Float32Array(gx * gy), py = new Float32Array(gx * gy), nr = new Float32Array(gx * gy);
      for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
        const k = j * gx + i; px[k] = (i - 1 + 0.12 + 0.76 * R()) * cell; py[k] = (j - 1 + 0.12 + 0.76 * R()) * cell; nr[k] = 0.16 + 0.1 * R();
      }
      const ci = Math.floor(W / 2 / cell) + 1, cj = Math.floor(H / 2 / cell) + 1; // exact centre cell for zoom continuity
      px[cj * gx + ci] = W / 2; py[cj * gx + ci] = H / 2;
      const memW = cell * 0.05, nf = 1 / cell;
      for (let y = 0, p = 0; y < H; y++) {
        const cy = Math.floor(y / cell) + 1;
        for (let xx = 0; xx < W; xx++, p += 4) {
          const cxi = Math.floor(xx / cell) + 1;
          let f1 = 1e9, f2 = 1e9, k1 = 0;
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
            const k = (cy + dj) * gx + cxi + di; if (k < 0 || k >= px.length) continue;
            const dx = xx - px[k], dy = y - py[k], dd = dx * dx + dy * dy;
            if (dd < f1) { f2 = f1; f1 = dd; k1 = k; } else if (dd < f2) f2 = dd;
          }
          f1 = Math.sqrt(f1); f2 = Math.sqrt(f2);
          const edge = f2 - f1, dx = (xx - px[k1]) * nf, dy = (y - py[k1]) * nf, hv = hash2(k1, 3, seed);
          const ecm = (1 - sstep(0.018, 0.045, Math.abs(fbm(xx * nf * 0.16, y * nf * 0.16, seed + 5, 3) - 0.5))) * sstep(cell * 1.3, cell * 2.6, Math.hypot(xx - W / 2, y - H / 2));
          let c = mix(pal.cyto, pal.cyto2, hv);
          const sh = 1 + 0.32 * (-(dx * 0.6 + dy * 0.8)) - 0.25 * sstep(0.1, 0.5, Math.hypot(dx, dy));
          c = shade(c, sh * (0.93 + 0.14 * vnoise(xx * 0.35, y * 0.35, seed)));
          const nd = Math.hypot(dx * 1.1 + 0.03, dy * 1.35 + 0.02) / nr[k1];
          if (nd < 1) {
            const chrom = fbm(xx * nf * 6, y * nf * 6, seed + 9, 2);
            let nc = shade(mix(pal.nuc, pal.nuc2, chrom), 1 + 0.25 * (-(dx * 0.6 + dy * 0.8)) / nr[k1] * 0.2);
            if (nd < 0.28 && hv > 0.3) nc = shade(pal.nuc, 0.7); // nucleolus
            c = mix(c, nc, sstep(1, 0.86, nd));
          }
          c = mix(c, pal.mem, 1 - sstep(0, memW, edge));
          if (ecm > 0) {
            const fib = vnoise(xx * nf * 1.5 + y * nf * 0.6, y * nf * 9 - xx * nf * 2, seed + 2);
            c = mix(c, shade(pal.ecm, 0.7 + 0.5 * fib), ecm);
          }
          d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
        }
      }
      x.putImageData(id, 0, 0); return cv;
    });
  }
  /** Wet oral mucosa with papillae (tongue dorsum). */
  function mucosaTex(w, h, pal, seed, pap) {
    const [W, H] = dims(w, h, 1);
    return memo('muc' + seed + ':' + W + 'x' + H, () => {
      const hw = W >> 1, hh = H >> 1, lo = canvas(hw, hh), lx = cx2d(lo), id = lx.createImageData(hw, hh), d = id.data;
      for (let y = 0, p = 0; y < hh; y++) for (let x = 0; x < hw; x++, p += 4) {
        const n = fbm(x / 26, y / 26, seed, 4), r = Math.abs(fbm(x / 9, y / 9, seed + 3, 3) - 0.5) * 2;
        let c = mix(pal.dark, pal.light, n);
        c = shade(c, 0.86 + 0.24 * sstep(0.05, 0.4, r)); // fine crevice network
        d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
      }
      lx.putImageData(id, 0, 0);
      const cv = canvas(W, H), x = cx2d(cv); x.drawImage(lo, 0, 0, W, H);
      if (pap) {
        const R = rng(seed + 1), n = Math.round(W * H / 90), sp = ball(pal.pap), sh = shadowSpr();
        for (let i = 0; i < n; i++) {
          const px = R() * W, py = R() * H, r = (0.6 + R() * 1.3) * W / 512 * pap;
          x.globalAlpha = 0.35; x.drawImage(sh, px - r * 0.6, py - r * 0.2, r * 2.6, r * 2.6);
          x.globalAlpha = 0.55 + R() * 0.3; x.drawImage(sp, px - r, py - r, r * 2, r * 2);
        }
        x.globalAlpha = 1;
      }
      return cv;
    });
  }

  /* ================================================================== */
  /* 1. ENTRANCE — silhouette → organs → cells → molecules → silhouette */
  /* ================================================================== */
  // Right half of a standing figure, height 1 (x from midline, y from crown).
  const FIG = [[0, 0], [0.032, 0.006], [0.045, 0.028], [0.048, 0.06], [0.045, 0.09], [0.038, 0.112], [0.027, 0.13], [0.028, 0.143],
    [0.031, 0.157], [0.052, 0.172], [0.092, 0.182], [0.124, 0.192], [0.14, 0.212], [0.148, 0.25], [0.153, 0.31], [0.156, 0.37],
    [0.161, 0.43], [0.165, 0.48], [0.17, 0.51], [0.174, 0.545], [0.166, 0.574], [0.152, 0.577], [0.142, 0.547], [0.14, 0.512],
    [0.136, 0.48], [0.13, 0.43], [0.124, 0.37], [0.118, 0.31], [0.111, 0.262], [0.104, 0.24], [0.1, 0.29], [0.091, 0.36],
    [0.098, 0.42], [0.108, 0.47], [0.107, 0.54], [0.098, 0.62], [0.086, 0.7], [0.083, 0.745], [0.082, 0.8], [0.069, 0.88],
    [0.057, 0.94], [0.064, 0.975], [0.068, 0.996], [0.03, 1.0], [0.029, 0.965], [0.033, 0.94], [0.031, 0.88], [0.028, 0.8],
    [0.025, 0.745], [0.023, 0.7], [0.017, 0.6], [0.008, 0.53], [0, 0.522]];
  const figPath = () => memo('figpath', () => {
    const pts = FIG.slice(); for (let i = FIG.length - 2; i > 0; i--) pts.push([-FIG[i][0], FIG[i][1]]);
    return smoothPath(pts, true);
  });
  const mirror = (pts) => pts.map((p) => [-p[0], p[1]]);
  const ORG = {
    lungR: [[-0.034, 0.196], [-0.062, 0.21], [-0.082, 0.245], [-0.09, 0.3], [-0.088, 0.345], [-0.06, 0.338], [-0.036, 0.33], [-0.022, 0.3], [-0.018, 0.24]],
    lungL: [[0.034, 0.196], [0.062, 0.21], [0.082, 0.245], [0.09, 0.3], [0.088, 0.345], [0.064, 0.342], [0.05, 0.325], [0.04, 0.3], [0.03, 0.27], [0.024, 0.23]],
    heart: [[-0.024, 0.262], [0.004, 0.25], [0.034, 0.254], [0.056, 0.282], [0.058, 0.31], [0.046, 0.33], [0.02, 0.326], [-0.012, 0.314], [-0.03, 0.29]],
    liver: [[-0.092, 0.345], [-0.05, 0.336], [0.0, 0.338], [0.04, 0.344], [0.055, 0.352], [0.02, 0.366], [-0.03, 0.382], [-0.07, 0.39], [-0.09, 0.378]],
    stomach: [[0.024, 0.346], [0.058, 0.338], [0.082, 0.35], [0.088, 0.378], [0.074, 0.402], [0.04, 0.41], [0.012, 0.404], [0.006, 0.39], [0.03, 0.386], [0.052, 0.376], [0.048, 0.36]],
    colon: [[-0.046, 0.488], [-0.07, 0.468], [-0.074, 0.43], [-0.066, 0.405], [-0.03, 0.398], [0.02, 0.397], [0.062, 0.402], [0.074, 0.42], [0.074, 0.46], [0.062, 0.482], [0.03, 0.492]]
  };
  function organ(ctx, pts, base, lx, ly, r) {
    const p = memo('org' + pts[0][0] + pts[0][1], () => smoothPath(pts, true));
    const g = ctx.createRadialGradient(lx, ly, r * 0.05, lx + r * 0.25, ly + r * 0.3, r);
    g.addColorStop(0, rgba(mix(base, [236, 222, 204], 0.32))); g.addColorStop(0.45, rgba(base)); g.addColorStop(1, rgba(shade(base, 0.42)));
    ctx.fillStyle = g; ctx.fill(p);
    ctx.strokeStyle = rgba(shade(base, 0.4), 0.55); ctx.lineWidth = 0.0016; ctx.stroke(p);
    return p;
  }
  function entranceLayout() {
    return memo('entL', () => {
      const R = rng(11), bron = [];
      const grow = (x, y, a, l, d) => {
        const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l; bron.push([x, y, x2, y2, d]);
        if (d < 4) { grow(x2, y2, a - 0.45 - R() * 0.3, l * 0.72, d + 1); grow(x2, y2, a + 0.35 + R() * 0.3, l * 0.68, d + 1); }
      };
      grow(-0.004, 0.228, Math.PI * 0.72, 0.028, 1); grow(0.004, 0.228, Math.PI * 0.26, 0.028, 1);
      const si = []; // small intestine meander
      for (let r = 0; r < 5; r++) {
        const y = 0.418 + r * 0.013, dir = r % 2 ? -1 : 1;
        for (let k = 0; k <= 8; k++) { const u = k / 8, x = (dir > 0 ? -0.05 + u * 0.1 : 0.05 - u * 0.1); si.push([x, y + Math.sin(u * TAU * 2 + r) * 0.004]); }
      }
      const mol = []; for (let i = 0; i < 40; i++) mol.push([R(), R(), R(), 0.4 + R()]);
      return { bron, si, mol };
    });
  }
  function drawFigure(ctx, a) {
    const p = figPath();
    ctx.save(); ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(-0.18, 0, 0.18, 0);
    g.addColorStop(0, 'rgb(104,68,52)'); g.addColorStop(0.42, 'rgb(72,46,36)'); g.addColorStop(1, 'rgb(34,22,18)');
    ctx.fillStyle = g; ctx.fill(p);
    const g2 = ctx.createLinearGradient(0, 0, 0, 1);
    g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(0.55, 'rgba(12,7,5,0.12)'); g2.addColorStop(1, 'rgba(12,7,5,0.5)');
    ctx.fillStyle = g2; ctx.fill(p);
    ctx.clip(p); // restrained rim light from the left, kept inside the form
    const g3 = ctx.createLinearGradient(-0.18, 0, 0.02, 0);
    g3.addColorStop(0, 'rgba(210,170,136,0.2)'); g3.addColorStop(1, 'rgba(210,170,136,0)');
    ctx.strokeStyle = g3; ctx.lineWidth = 0.012; ctx.stroke(p);
    ctx.restore();
  }
  function drawOrgans(ctx, S, pulse) {
    const L = entranceLayout(), br = 1 + 0.015 * Math.sin(S.tm * 0.8);
    ctx.save(); ctx.translate(0, 0.27); ctx.scale(br, br); ctx.translate(0, -0.27);
    // trachea
    ctx.strokeStyle = 'rgba(190,164,146,0.7)'; ctx.lineWidth = 0.011; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0.165); ctx.lineTo(0, 0.228); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,90,76,0.5)'; ctx.lineWidth = 0.0022; ctx.setLineDash([0.002, 0.004]);
    ctx.beginPath(); ctx.moveTo(0, 0.168); ctx.lineTo(0, 0.226); ctx.stroke(); ctx.setLineDash([]);
    for (const k of ['lungR', 'lungL']) {
      const p = organ(ctx, ORG[k], [172, 124, 120], k === 'lungR' ? -0.07 : 0.05, 0.22, 0.14);
      ctx.save(); ctx.clip(p); ctx.strokeStyle = 'rgba(96,56,52,0.32)';
      for (const b of L.bron) { ctx.lineWidth = 0.004 / b[4]; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(b[2], b[3]); ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
    organ(ctx, ORG.stomach, [178, 116, 102], 0.05, 0.35, 0.07);
    organ(ctx, ORG.liver, [120, 52, 40], -0.06, 0.345, 0.12);
    // heart with great vessels, gently beating
    ctx.save(); const hs = 1 + 0.025 * pulse; ctx.translate(0.016, 0.29); ctx.scale(hs, hs); ctx.translate(-0.016, -0.29);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgb(92,52,64)'; ctx.lineWidth = 0.011; ctx.beginPath(); ctx.moveTo(-0.016, 0.268); ctx.lineTo(-0.018, 0.21); ctx.stroke();
    ctx.strokeStyle = 'rgb(168,108,96)'; ctx.lineWidth = 0.013;
    ctx.beginPath(); ctx.moveTo(0.002, 0.262); ctx.quadraticCurveTo(-0.004, 0.214, 0.018, 0.212); ctx.quadraticCurveTo(0.034, 0.214, 0.03, 0.24); ctx.stroke();
    ctx.strokeStyle = 'rgb(140,92,96)'; ctx.lineWidth = 0.011; ctx.beginPath(); ctx.moveTo(0.02, 0.262); ctx.quadraticCurveTo(0.018, 0.236, 0.04, 0.238); ctx.stroke();
    const hp = organ(ctx, ORG.heart, [112, 36, 38], 0.004, 0.268, 0.07);
    ctx.save(); ctx.clip(hp); ctx.strokeStyle = 'rgba(190,150,120,0.35)'; ctx.lineWidth = 0.003;
    ctx.beginPath(); ctx.moveTo(0.03, 0.258); ctx.quadraticCurveTo(0.018, 0.29, 0.034, 0.33); ctx.stroke(); ctx.restore();
    ctx.restore();
    // intestines: colon frame and small-intestine meander (tube shading = shadow, body, highlight)
    const colon = memo('colonP', () => smoothPath(ORG.colon, false)), si = memo('siP', () => smoothPath(L.si, false));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgb(84,50,40)'; ctx.lineWidth = 0.022; ctx.stroke(colon);
    ctx.strokeStyle = 'rgb(166,120,96)'; ctx.lineWidth = 0.018; ctx.stroke(colon);
    ctx.strokeStyle = 'rgba(96,60,46,0.55)'; ctx.lineWidth = 0.018; ctx.setLineDash([0.0015, 0.007]); ctx.stroke(colon); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgb(90,52,46)'; ctx.lineWidth = 0.0135; ctx.stroke(si);
    ctx.strokeStyle = 'rgb(186,128,112)'; ctx.lineWidth = 0.0105; ctx.stroke(si);
    ctx.save(); ctx.translate(-0.0012, -0.0022); ctx.strokeStyle = 'rgba(232,196,176,0.42)'; ctx.lineWidth = 0.0028; ctx.stroke(si); ctx.restore();
  }
  function drawDNA(ctx, S) {
    const { w, h } = S, cx = w / 2, cy = h / 2, u = w / 13; // px per nm; field ~13 nm
    const L = entranceLayout(), hl = hilite();
    // far layer: soft out-of-focus water/ions
    for (const m of L.mol) {
      const x = fract(m[0] + S.tm * 0.004 * m[3]) * w * 1.2 - w * 0.1, y = m[1] * h, r = h * (0.02 + m[2] * 0.05);
      ctx.globalAlpha = 0.07 + m[2] * 0.06; ctx.drawImage(blob([150, 158, 154], (m[3] * 7) | 0, true), x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    const prims = [], rot = S.tm * 0.22, tilt = -0.16, ca = Math.cos(tilt), sa = Math.sin(tilt), Rr = 1.0 * u;
    const BASES = [[108, 124, 122], [172, 136, 80], [206, 194, 172], [118, 88, 66]];
    const proj = (x, y, z) => [cx + x * ca - y * sa, cy + x * sa + y * ca, z];
    for (let i = -22; i <= 22; i++) {
      const x = i * 0.34 * u, a = rot + i * 0.598, b = a + 2.3;
      const sA = proj(x, Math.cos(a) * Rr, Math.sin(a)), sB = proj(x, Math.cos(b) * Rr, Math.sin(b));
      const pA = proj(x - 0.12 * u, Math.cos(a - 0.2) * Rr * 1.08, Math.sin(a - 0.2)), pB = proj(x + 0.12 * u, Math.cos(b + 0.2) * Rr * 1.08, Math.sin(b + 0.2));
      const mid = proj(x, (Math.cos(a) + Math.cos(b)) * 0.5 * Rr * 0.9, (Math.sin(a) + Math.sin(b)) * 0.5);
      const bi = (hash2(i, 1, 4) * 4) | 0;
      prims.push({ z: (sA[2] + mid[2]) / 2 - 0.02, k: 'stick', a: sA, b: mid, c: BASES[bi], wd: 0.26 * u });
      prims.push({ z: (sB[2] + mid[2]) / 2 - 0.02, k: 'stick', a: sB, b: mid, c: BASES[3 - bi], wd: 0.26 * u });
      prims.push({ z: sA[2], k: 'ball', p: sA, c: [200, 190, 168], r: 0.22 * u });
      prims.push({ z: sB[2], k: 'ball', p: sB, c: [200, 190, 168], r: 0.22 * u });
      prims.push({ z: pA[2] + 0.01, k: 'ball', p: pA, c: [176, 140, 86], r: 0.28 * u });
      prims.push({ z: pB[2] + 0.01, k: 'ball', p: pB, c: [176, 140, 86], r: 0.28 * u });
    }
    prims.sort((p, q) => p.z - q.z);
    ctx.lineCap = 'round';
    for (const p of prims) {
      const dz = 0.55 + 0.45 * (p.z + 1) / 2, sc = 1 + 0.12 * p.z;
      ctx.globalAlpha = dz;
      if (p.k === 'ball') { const r = p.r * sc; ctx.drawImage(ball(p.c), p.p[0] - r, p.p[1] - r, r * 2, r * 2); }
      else {
        ctx.strokeStyle = rgba(shade(p.c, 0.55)); ctx.lineWidth = p.wd * sc;
        ctx.beginPath(); ctx.moveTo(p.a[0], p.a[1]); ctx.lineTo(p.b[0], p.b[1]); ctx.stroke();
        ctx.strokeStyle = rgba(p.c); ctx.lineWidth = p.wd * sc * 0.55;
        ctx.beginPath(); ctx.moveTo(p.a[0] - 0.5, p.a[1] - p.wd * 0.12); ctx.lineTo(p.b[0] - 0.5, p.b[1] - p.wd * 0.12); ctx.stroke();
      }
    }
    ctx.globalAlpha = 0.06; ctx.drawImage(hl, cx - w * 0.3, cy - h * 0.5, w * 0.6, h * 0.5); ctx.globalAlpha = 1;
  }
  const ENT_PAL = { cyto: [196, 150, 140], cyto2: [214, 176, 160], mem: [112, 62, 60], nuc: [86, 52, 64], nuc2: [124, 82, 92], ecm: [172, 128, 112] };
  function roomEntrance(ctx, S) {
    const { w, h, t } = S;
    fillBG(ctx, S, [46, 30, 24], [11, 7, 6], 0.5, 0.45);
    // camera over figure space: k = px per figure unit, (fx, fy) = figure point at screen centre
    let k = h * 0.86 * (1 + 0.03 * sstep(0, 6, t)), fx = 0, fy = 0.5;
    const e1 = sstep(5, 10.5, t);
    k = lerp(k, h * 0.86 * 2.55 * (1 + 0.07 * sstep(10.5, 17, t)), e1); fy = lerp(fy, 0.335, e1);
    const e2 = sstep(16, 20, t); k *= Math.exp(Math.log(14) * e2); fx = lerp(fx, 0.02, e2); fy = lerp(fy, 0.3, e2);
    let figA = t < 5 ? 1 : lerp(1, 0.3, sstep(5, 10, t)); figA *= 1 - sstep(17, 19.5, t);
    if (t > 36) { figA = sstep(36.5, 40, t); k = h * 0.86; fx = 0; fy = 0.5; }
    const orgA = sstep(6, 10, t) * (1 - sstep(17.5, 19.5, t));
    const setCam = (c) => { c.translate(w / 2, h / 2); c.scale(k, k); c.translate(-fx, -fy); };
    if (figA > 0.004) {
      ctx.save(); setCam(ctx);
      const sg = ctx.createRadialGradient(0, 1.0, 0, 0, 1.0, 0.16);
      sg.addColorStop(0, 'rgba(0,0,0,0.45)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = figA; ctx.fillStyle = sg; ctx.save(); ctx.scale(1, 0.12); ctx.translate(0, 1 / 0.12 - 1); ctx.fillRect(-0.2, 0.84, 0.4, 0.32); ctx.restore();
      drawFigure(ctx, figA); ctx.restore();
    }
    layer(ctx, S, orgA, (c) => { setCam(c); drawOrgans(c, S, Math.pow(Math.max(0, Math.sin(S.tm * 2.2)), 6)); });
    // cells: grow from small into view, then zoom through
    const cellA = sstep(17.5, 20, t) * (1 - sstep(27.5, 29.8, t));
    layer(ctx, S, cellA, (c) => {
      const s = lerp(0.3, 1, sstep(16, 20, t)) * (1 + 0.12 * sstep(20, 26, t)) * Math.exp(Math.log(6) * sstep(26, 30, t));
      zoomAt(c, w / 2, h / 2, s); c.translate(Math.sin(S.tm * 0.05) * w * 0.02, 0);
      const tx = tissueTex(w, h, ENT_PAL, 17, 0.055);
      c.drawImage(tx, -w * 0.175, -h * 0.175, w * 1.35, h * 1.35);
      c.setTransform(1, 0, 0, 1, 0, 0); vignette(c, S, 0.75);
    });
    const molA = sstep(27.5, 30, t) * (1 - sstep(35, 38.5, t));
    layer(ctx, S, molA, (c) => {
      fillBG(c, S, [44, 40, 36], [14, 12, 11], 0.5, 0.5);
      zoomAt(c, w / 2, h / 2, lerp(0.45, 1, sstep(26, 30, t)) * (1 + 0.05 * sstep(30, 36, t)));
      drawDNA(c, S);
    });
    finish(ctx, S, 0.55);
    const tag = t < 8 || t >= 38 ? '~1.7 m' : t < 18 ? '~10 cm' : t < 28 ? '~20 µm' : '~2 nm';
    scaleTag(ctx, S, tag);
  }

  /* ================================================================== */
  /* 2. MOUTH — saliva, sip, swallow, aftermath (water | sugar)         */
  /* ================================================================== */
  // View along the tongue toward the oropharynx (vanishing point right of centre).
  const VPX = 0.8, VPY = 0.48;
  /** Wet mucosa baked with perspective: features shrink toward the throat. kind 0 = tongue, 1 = palate/cheek. */
  function mouthTex(w, h, kind) {
    const [W, H] = dims(w, h, 1);
    return memo('mtx' + kind + ':' + W + 'x' + H, () => {
      const cv = canvas(W, H), x = cx2d(cv), id = x.createImageData(W, H), d = id.data, A = H / W;
      for (let y = 0, p = 0; y < H; y++) for (let xx = 0; xx < W; xx++, p += 4) {
        const dx = xx / W - VPX, dy = (y / H - VPY) * A, f = 1 / (0.14 + Math.hypot(dx, dy)), u = dx * f, v = dy * f;
        const base = fbm(u * 2.2, v * 2.2, 3 + kind, 3), cr = Math.abs(fbm(u * 7, v * 7, 8 + kind, 2) - 0.5);
        let c;
        if (kind === 0) {
          c = mix([150, 64, 66], [204, 124, 116], base);
          c = shade(c, 0.9 + 0.14 * sstep(0.02, 0.2, cr) + 0.16 * sstep(0.6, 0.85, vnoise(u * 46, v * 46, 5)) - 0.08 * vnoise(u * 90, v * 90, 6));
        } else {
          c = mix([150, 62, 64], [206, 118, 110], base);
          c = shade(c, 0.93 + 0.08 * sstep(0.015, 0.12, cr));
        }
        d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
      }
      x.putImageData(id, 0, 0); return cv;
    });
  }
  function mouthLayout() {
    return memo('mouthL', () => {
      const R = rng(23), sp = [], bub = [], bact = [], sug = [], acid = [];
      for (let i = 0; i < 80; i++) sp.push([R(), R(), 0.5 + R(), R()]);
      for (let i = 0; i < 26; i++) bub.push([R(), R(), 0.3 + R(), R()]);
      for (let i = 0; i < 16; i++) {
        const n = R() < 0.7 ? 3 + ((R() * 4) | 0) : 1;
        bact.push({ x: -0.75 + R() * 1.5, y: -0.35 + R() * 0.8, a: R() * TAU, n, rod: n === 1, c: [[200, 188, 164], [118, 130, 126], [168, 136, 88]][(R() * 3) | 0] });
      }
      for (let i = 0; i < 16; i++) sug.push([R(), R(), R()]);
      for (let i = 0; i < 20; i++) acid.push([R(), R(), R()]);
      return { sp, bub, bact, sug, acid };
    });
  }
  // world → screen for the oral cavity (x lateral, y down, z depth toward throat)
  const mproj = (S, X, Y, z) => { const f = S.h * 0.62; return [S.w * VPX + X * f / z, S.h * VPY + Y * f / z]; };
  function tonguePath(S, lift) {
    const { w, h } = S, pts = [[0.16, 1.08], [0.2, 0.96], [0.42, 0.75], [0.6, 0.64], [0.72, 0.6], [0.8, 0.62], [0.9, 0.6], [1.06, 0.54], [1.06, 1.08]];
    return smoothPath(pts.map((p) => [p[0] * w, p[1] * h - (p[1] < 1 ? lift : 0)]), true);
  }
  /** One row of teeth (lingual aspect) receding toward the throat, with gum margin. */
  function teethRow(ctx, S, up, mask) {
    const X = -2.1, sg = up ? -1 : 1, gumY = 0.95 * sg, tipY = (up ? 0.36 : 0.42) * sg, gp = gumPaths(S, up), cl = new Path2D();
    cl.rect(-S.w, -S.h, S.w * 3, S.h * 3); cl.addPath(gp.band);
    ctx.save(); ctx.clip(cl, 'evenodd'); // crowns emerge from beneath the gum margin
    for (let i = 8; i >= 1; i--) {
      const z0 = 0.8 + i * 0.72, zc = z0 + 0.36, G = mproj(S, X, gumY, zc), T = mproj(S, X, tipY, zc);
      const hg = Math.abs(T[1] - G[1]), wd = Math.max(Math.abs(mproj(S, X, 0, z0 + 0.72)[0] - mproj(S, X, 0, z0)[0]) * 1.12, hg * 0.6);
      ctx.save(); ctx.translate(G[0], G[1]); ctx.scale(1, -sg); ctx.translate(0, -hg * 0.1);
      // crown: slightly tapered, cusped occlusal edge (single edge for anterior teeth)
      ctx.beginPath(); ctx.moveTo(-wd * 0.42, 0); ctx.bezierCurveTo(-wd * 0.52, hg * 0.4, -wd * 0.5, hg * 0.8, -wd * 0.36, hg * 0.98);
      if (i > 2) { ctx.quadraticCurveTo(-wd * 0.2, hg * 1.1, -wd * 0.02, hg * 0.95); ctx.quadraticCurveTo(wd * 0.18, hg * 1.1, wd * 0.36, hg * 0.98); }
      else ctx.quadraticCurveTo(0, hg * 1.06, wd * 0.36, hg * 0.98);
      ctx.bezierCurveTo(wd * 0.5, hg * 0.8, wd * 0.52, hg * 0.4, wd * 0.42, 0); ctx.closePath();
      if (mask) { ctx.fillStyle = 'rgb(176,112,40)'; ctx.fill(); ctx.restore(); continue; }
      const g = ctx.createRadialGradient(-wd * 0.18, hg * (up ? 0.35 : 0.65), wd * 0.05, 0, hg * 0.5, wd * 0.75);
      g.addColorStop(0, 'rgb(240,232,214)'); g.addColorStop(0.55, 'rgb(212,198,172)'); g.addColorStop(1, 'rgb(120,100,82)');
      ctx.fillStyle = g; ctx.fill();
      const g2 = ctx.createLinearGradient(0, 0, 0, hg);
      g2.addColorStop(0, 'rgba(150,104,80,0.4)'); g2.addColorStop(0.5, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(160,166,164,0.3)');
      ctx.fillStyle = g2; ctx.fill();
      ctx.strokeStyle = 'rgba(70,40,34,0.4)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.globalAlpha = 0.6; ctx.drawImage(hilite(), -wd * 0.3, hg * 0.25, wd * 0.22, hg * 0.5); ctx.globalAlpha = 1;
      ctx.restore();
    }
    ctx.restore();
    if (mask) return;
    ctx.save(); ctx.clip(gp.band); ctx.strokeStyle = 'rgba(200,104,100,0.45)'; ctx.lineWidth = S.h * 0.05; ctx.stroke(gp.edge); ctx.strokeStyle = 'rgba(40,8,10,0.2)'; ctx.lineWidth = S.h * 0.014; ctx.stroke(gp.edge); ctx.restore();
    ctx.strokeStyle = 'rgba(250,222,210,0.3)'; ctx.lineWidth = Math.max(1, S.h * 0.004); ctx.stroke(gp.edge);
  }
  /** Gum over the cervical third of the crowns: scalloped margin with interdental papillae. */
  function gumPaths(S, up) {
    const X = -2.1, sg = up ? -1 : 1, edge = new Path2D();
    let q = mproj(S, X, 0.84 * sg, 0.9); edge.moveTo(q[0], q[1]);
    for (let i = 1; i <= 8; i++) {
      const z0 = 0.8 + i * 0.72, c = mproj(S, X, 0.9 * sg, z0 + 0.36), e = mproj(S, X, 0.8 * sg, z0 + 0.72);
      edge.quadraticCurveTo(c[0], c[1], e[0], e[1]);
    }
    const band = new Path2D(edge);
    for (let z = 7.3; z >= 0.8; z /= 1.25) { q = mproj(S, X - 0.05, 1.2 * sg, z); band.lineTo(q[0], q[1]); }
    q = mproj(S, X - 0.05, 1.2 * sg, 0.6); band.lineTo(q[0], q[1]); band.closePath();
    return { edge, band };
  }
  function mouthBase(ctx, S) {
    const { w, h } = S, g = ctx.createRadialGradient(w * VPX, h * VPY, 0, w * VPX, h * VPY, w * 0.45);
    ctx.drawImage(mouthTex(w, h, 1), 0, 0, w, h);
    g.addColorStop(0, 'rgba(40,8,10,0.75)'); g.addColorStop(0.35, 'rgba(40,8,10,0.25)'); g.addColorStop(1, 'rgba(40,8,10,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  /** Cache a static layer drawn in (w,h) units into a bucketed offscreen canvas. */
  function staticLayer(key, S, fn) {
    const [W, H] = dims(S.w, S.h, 1);
    return memo(key + ':' + W + 'x' + H, () => { const c = canvas(W, H), x = cx2d(c); x.scale(W / S.w, H / S.h); fn(x); return c; });
  }
  function roomMouth(ctx, S) {
    const { w, h, t, tm } = S, sugar = S.o.variant === 'sugar', L = mouthLayout(), hl = hilite(), vx = w * VPX, vy = h * VPY;
    const lift = h * 0.04 * sstep(14.5, 16.5, t) * (1 - sstep(19, 22.5, t)), br = 1 + 0.006 * Math.sin(tm * 0.35);
    const rx = w * 0.058, ry = h * 0.14, oy = vy + h * 0.03;
    // static layers: palate/throat/upper teeth, tongue, lower teeth, and amber tooth masks for the sugar coat
    const back = staticLayer('mBack', S, (c) => {
      mouthBase(c, S);
      c.lineCap = 'round'; c.strokeStyle = 'rgba(236,170,158,0.12)'; c.lineWidth = h * 0.025; // palatal raphe
      c.beginPath(); c.moveTo(w * 0.42, -2); c.quadraticCurveTo(w * 0.66, h * 0.12, vx, vy - h * 0.2); c.stroke();
      c.beginPath(); c.ellipse(vx, oy + ry * 0.4, rx * 1.8, ry * 1.35, 0, Math.PI * 1.02, -0.02); // faucial pillars
      c.strokeStyle = 'rgba(56,12,16,0.3)'; c.lineWidth = h * 0.05; c.stroke();
      c.save(); c.translate(-h * 0.008, -h * 0.01); c.strokeStyle = 'rgba(226,146,136,0.16)'; c.lineWidth = h * 0.018; c.stroke(); c.restore();
      let g = c.createRadialGradient(vx, oy + ry * 0.4, 0, vx, oy + ry * 0.4, ry * 1.3);
      g.addColorStop(0, 'rgb(12,3,4)'); g.addColorStop(0.7, 'rgb(40,10,12)'); g.addColorStop(1, 'rgb(80,24,28)');
      c.fillStyle = g; c.beginPath(); c.ellipse(vx, oy + ry * 0.25, rx, ry, 0, 0, TAU); c.fill();
      const ut = oy - ry * 0.72, ul = h * 0.13; // uvula
      c.beginPath(); c.moveTo(vx - w * 0.014, ut); c.quadraticCurveTo(vx - w * 0.012, ut + ul * 0.6, vx - w * 0.009, ut + ul * 0.85);
      c.arc(vx, ut + ul * 0.85, w * 0.009, Math.PI, 0, true); c.quadraticCurveTo(vx + w * 0.012, ut + ul * 0.6, vx + w * 0.014, ut); c.closePath();
      g = c.createLinearGradient(vx - w * 0.014, 0, vx + w * 0.014, 0);
      g.addColorStop(0, 'rgb(206,118,110)'); g.addColorStop(1, 'rgb(130,50,52)'); c.fillStyle = g; c.fill();
      c.globalAlpha = 0.5; c.drawImage(hl, vx - w * 0.008, ut + ul * 0.72, w * 0.008, h * 0.02); c.globalAlpha = 1;
      teethRow(c, S, true, false);
    });
    const tongue = staticLayer('mTongue', S, (c) => {
      const tp = tonguePath(S, 0);
      c.save(); c.clip(tp); c.drawImage(mouthTex(w, h, 0), 0, 0, w, h);
      const g = c.createRadialGradient(w * 0.42, h * 0.8, h * 0.05, w * 0.5, h * 0.75, w * 0.55);
      g.addColorStop(0, 'rgba(255,220,210,0.1)'); g.addColorStop(0.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(30,6,8,0.55)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(70,18,22,0.45)'; c.lineWidth = h * 0.014; // median sulcus
      c.beginPath(); c.moveTo(w * 0.62, h + 2); c.quadraticCurveTo(w * 0.66, h * 0.74, w * 0.77, h * 0.64); c.stroke();
      c.strokeStyle = 'rgba(250,226,214,0.2)'; c.lineWidth = h * 0.006; c.translate(0, h * 0.01); c.stroke(tp); c.restore();
    });
    const front = staticLayer('mFront', S, (c) => teethRow(c, S, false, false));
    const coat = sugar ? sstep(9.5, 12.5, t) * (1 - 0.55 * sstep(16, 28, t)) * (1 - sstep(27.5, 29.8, t)) : 0;
    ctx.save(); zoomAt(ctx, vx, vy, br);
    ctx.drawImage(back, 0, 0, w, h);
    if (coat > 0.01) { ctx.globalAlpha = 0.42 * coat; ctx.drawImage(staticLayer('mCoatU', S, (c) => teethRow(c, S, true, true)), 0, 0, w, h); ctx.globalAlpha = 1; }
    ctx.drawImage(tongue, 0, -lift, w, h);
    const tp = tonguePath(S, lift);
    // the sip: a rounded liquid body spreading over the tongue toward the throat
    const dur = sugar ? 6.2 : 4.4, sf = 0.97 * sstep(8, 8 + dur, t), sb = 1.05 * sstep(14.5, 20.5, t);
    const cpt = (s) => { const k = 1 - Math.pow(1 - s, 1.5); return [lerp(w * 0.58, vx, k), lerp(h * 1.02, oy + ry * 0.7, k), lerp(w * 0.28, w * 0.035, k)]; };
    if (t > 8 && t < 21.5 && sf > sb + 0.01) {
      const lp = new Path2D();
      for (let i = 0; i <= 14; i++) {
        const s = lerp(sb, sf, i / 14), c = cpt(s), wob = 1 + 0.08 * Math.sin(i * 1.7 + tm * (sugar ? 0.8 : 1.6));
        lp.moveTo(c[0] + c[2] * wob, c[1] - lift); lp.ellipse(c[0], c[1] - lift, c[2] * wob, c[2] * 0.42 * wob, 0, 0, TAU);
      }
      ctx.save(); ctx.clip(tp); ctx.clip(lp);
      ctx.drawImage(tongue, w * 0.012, -lift - h * 0.014, w * 1.02, h * 1.02); // cheap refraction
      const g = ctx.createLinearGradient(0, vy, 0, h);
      if (sugar) { g.addColorStop(0, 'rgba(150,90,30,0.5)'); g.addColorStop(1, 'rgba(200,138,60,0.36)'); }
      else { g.addColorStop(0, 'rgba(60,30,30,0.22)'); g.addColorStop(1, 'rgba(232,236,234,0.2)'); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 5; i++) {
        const c = cpt(lerp(sb, sf, fract(i * 0.37 + tm * 0.04)));
        ctx.globalAlpha = sugar ? 0.22 : 0.32; ctx.drawImage(hl, c[0] - c[2] * 0.5 + (i % 3 - 1) * c[2] * 0.4, c[1] - lift - c[2] * 0.16, c[2], c[2] * 0.08);
      }
      ctx.restore(); ctx.globalAlpha = 1;
      const fc = cpt(sf); // meniscus highlight along the advancing front only
      ctx.save(); ctx.clip(tp); ctx.strokeStyle = sugar ? 'rgba(240,200,140,0.45)' : 'rgba(250,248,242,0.5)'; ctx.lineWidth = Math.max(1, h * 0.005);
      ctx.beginPath(); ctx.ellipse(fc[0], fc[1] - lift, fc[2], fc[2] * 0.42, 0, Math.PI * 1.15, Math.PI * 1.9); ctx.stroke(); ctx.restore();
    }
    if (t > 18) { // residual film after the swallow
      const ra = sstep(18, 21, t) * (1 - sstep(26, 29.8, t));
      ctx.save(); ctx.clip(tp); ctx.fillStyle = sugar ? 'rgba(176,112,40,' + (0.12 * ra).toFixed(3) + ')' : 'rgba(236,236,230,' + (0.04 * ra).toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); ctx.restore();
    }
    ctx.drawImage(front, 0, 0, w, h);
    if (coat > 0.01) { ctx.globalAlpha = 0.42 * coat; ctx.drawImage(staticLayer('mCoatL', S, (c) => teethRow(c, S, false, true)), 0, 0, w, h); ctx.globalAlpha = 1; }
    // saliva: slow-drifting specular glints (toward the throat) and bubbles pooling on the tongue
    for (const s of L.sp) {
      const k = fract(s[3] + tm * 0.006), x = lerp(s[0] * w, vx, k * 0.25), y = lerp(s[1] * h, vy, k * 0.25), d = Math.hypot(x - vx, (y - vy) * 1.6) / w;
      if (d < 0.08) continue;
      const sz = w * 0.012 * s[2] * clamp(d * 2.2, 0.3, 1);
      ctx.globalAlpha = 0.35 * Math.sin(k * Math.PI); ctx.drawImage(hl, x - sz, y - sz * 0.35, sz * 2, sz * 0.7);
    }
    ctx.globalAlpha = 1; ctx.lineWidth = Math.max(0.7, h * 0.0025);
    ctx.fillStyle = 'rgba(240,228,216,0.07)'; ctx.strokeStyle = 'rgba(248,238,228,0.42)';
    const bf = new Path2D(), bs = new Path2D();
    for (const b of L.bub) {
      const x = w * (0.45 + b[0] * 0.45) + Math.sin(tm * 0.2 + b[3] * 9) * w * 0.004, y = h * (0.7 + b[1] * 0.28) - lift, r = h * 0.008 * b[2];
      bf.moveTo(x + r, y); bf.arc(x, y, r, 0, TAU); bs.moveTo(x + Math.cos(Math.PI * 1.05) * r, y + Math.sin(Math.PI * 1.05) * r); bs.arc(x, y, r, Math.PI * 1.05, Math.PI * 1.75);
    }
    ctx.fill(bf); ctx.stroke(bs);
    ctx.restore();
    finish(ctx, S, 0.55);
    if (sugar) mouthPlaque(ctx, S, L);
  }
  // Stephan-curve style plaque pH after a sugar exposure (illustrative, conservative)
  const stephan = (m) => 7 - 1.5 * (m / 8) * Math.exp(1 - m / 8);
  function mouthPlaque(ctx, S, L) {
    const { w, h, t, tm } = S, a = sstep(20.5, 22.5, t) * (1 - sstep(28.8, 29.9, t));
    if (a < 0.01) return;
    const m = clamp((t - 21.5) / 7.3, 0, 1) * 60, flux = Math.max(0, (m / 8) * Math.exp(1 - m / 8));
    const cx = w * 0.46, cy = h * 0.34, r = h * 0.21, tp = mproj(S, -2.1, 0.8, 3.2);
    ctx.save(); ctx.globalAlpha = a;
    // leader to the tooth surface near the gum
    ctx.strokeStyle = 'rgba(236,228,212,0.4)'; ctx.lineWidth = Math.max(1, h * 0.003);
    ctx.beginPath(); ctx.moveTo(tp[0], tp[1]); ctx.lineTo(cx - r * 0.5, cy + r * 0.87); ctx.stroke();
    ctx.beginPath(); ctx.arc(tp[0], tp[1], h * 0.012, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgb(84,74,58)'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = 'rgba(150,130,92,0.45)'; ctx.fillRect(cx - r, cy - r * 0.45, r * 2, r * 1.5);
    const eg = ctx.createLinearGradient(0, cy + r * 0.55, 0, cy + r); // enamel below the biofilm
    eg.addColorStop(0, 'rgb(206,198,180)'); eg.addColorStop(1, 'rgb(170,162,146)'); ctx.fillStyle = eg;
    ctx.fillRect(cx - r, cy + r * 0.58, r * 2, r);
    const rb = r * 0.055;
    for (const b of L.bact) {
      const bx = cx + b.x * r, by = cy + b.y * r * 0.9, ca = Math.cos(b.a), sa = Math.sin(b.a);
      if (b.rod) { ctx.save(); ctx.translate(bx, by); ctx.rotate(b.a); ctx.drawImage(rodSprite(b.c), -rb * 3, -rb, rb * 6, rb * 2); ctx.restore(); }
      else for (let i = 0; i < b.n; i++) ctx.drawImage(ball(b.c), bx + ca * i * rb * 1.8 - rb, by + sa * i * rb * 1.8 - rb, rb * 2, rb * 2);
    }
    ctx.globalAlpha = a * 0.9;
    for (const s of L.sug) { // sugars diffusing in from saliva and taken up
      const k = fract(s[2] + tm * 0.12), b = L.bact[(s[0] * L.bact.length) | 0];
      const x = lerp(cx + (s[1] - 0.5) * r * 1.6, cx + b.x * r, k), y = lerp(cy - r, cy + b.y * r * 0.9, k), sz = r * 0.03;
      ctx.globalAlpha = a * (1 - k) * clamp(1.2 - m / 25, 0, 1);
      ctx.drawImage(ball([236, 230, 214]), x - sz, y - sz, sz * 2, sz * 2);
    }
    for (const s of L.acid) { // acid released toward the enamel
      const k = fract(s[2] + tm * 0.1), b = L.bact[(s[0] * L.bact.length) | 0];
      const x = cx + b.x * r + (s[1] - 0.5) * r * 0.3 * k, y = lerp(cy + b.y * r * 0.9, cy + r * 0.62, k), sz = r * 0.024;
      ctx.globalAlpha = a * Math.sin(k * Math.PI) * clamp(flux * 1.2, 0, 1);
      ctx.drawImage(ball([150, 70, 52]), x - sz, y - sz, sz * 2, sz * 2);
    }
    ctx.globalAlpha = a;
    const vg = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,6,4,0.55)'); ctx.fillStyle = vg; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    ctx.strokeStyle = 'rgba(236,228,212,0.5)'; ctx.lineWidth = Math.max(1, h * 0.004); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    ctx.restore();
    if (!S.labels) return;
    // small pH inset graph (bottom-right)
    const gx = w * 0.69, gy = h * 0.6, gw = w * 0.28, gh = h * 0.27, py = (p) => gy + gh * 0.12 + (7.2 - p) / 2.2 * gh * 0.72, px = (mm) => gx + gw * 0.14 + mm / 60 * gw * 0.8;
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(14,9,8,0.6)'; ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = 'rgba(236,228,212,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(gx + 0.5, gy + 0.5, gw - 1, gh - 1);
    ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(px(0), py(5.5)); ctx.lineTo(px(60), py(5.5)); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(214,176,112,0.9)'; ctx.lineWidth = Math.max(1.2, h * 0.005); ctx.beginPath();
    for (let i = 0; i <= 40; i++) { const mm = i / 40 * m; i ? ctx.lineTo(px(mm), py(stephan(mm))) : ctx.moveTo(px(mm), py(stephan(mm))); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(236,228,212,0.9)'; ctx.beginPath(); ctx.arc(px(m), py(stephan(m)), Math.max(1.5, h * 0.007), 0, TAU); ctx.fill();
    ctx.restore();
    label(ctx, S, 'pH', gx + gw * 0.03, gy + gh * 0.13, 'left', a);
    label(ctx, S, '7', gx + gw * 0.11, py(7) + h * 0.012, 'right', a * 0.8);
    label(ctx, S, '5.5', gx + gw * 0.11, py(5.5) + h * 0.012, 'right', a * 0.8);
    label(ctx, S, '0', px(0), gy + gh * 0.97, 'left', a * 0.8);
    label(ctx, S, '60 min', px(60), gy + gh * 0.97, 'right', a * 0.8);
    label(ctx, S, 'Illustrative — plaque pH falls after sugar, then recovers over ~30–60 min', w * 0.035, h * 0.955, 'left', a);
  }

  /* ================================================================== */
  /* 3. DIGESTIVE — oesophagus peristalsis, stomach, microbiome         */
  /* ================================================================== */
  /** Oesophagus in longitudinal section: collapsed lumen distended by the bolus, closed behind it by the contraction. */
  function drawOesophagus(ctx, S, tt) {
    const { w, h } = S, cy = h * 0.5, N = 48;
    const ph = fract(tt / 6), xb = lerp(-0.12 * w, 1.14 * w, ph), xc = xb - w * 0.22;
    const bulge = (x) => Math.exp(-Math.pow((x - xb) / (w * 0.12), 2)), sq = (x) => Math.exp(-Math.pow((x - xc) / (w * 0.08), 2));
    const r = (x) => Math.max(h * 0.012, h * 0.03 + h * 0.19 * bulge(x) - h * 0.03 * sq(x));
    // wall texture (mucosa + longitudinal folds, lumen edge at the bottom) is cached, then laid down in
    // vertical strips displaced by the lumen radius and compressed/stretched by the contraction/bolus
    const TH = h * 0.8, [W, H] = dims(w, TH, 0.8);
    const wall = memo('oesW' + W + 'x' + H, () => {
      const c = canvas(W, H), x = cx2d(c); x.scale(W / w, H / TH);
      x.drawImage(mucosaTex(w, h, { dark: [92, 30, 34], light: [176, 88, 84], pap: [0, 0, 0] }, 45, 0), 0, 0, w, TH);
      const g0 = x.createLinearGradient(0, 0, 0, TH); g0.addColorStop(0, 'rgba(34,8,10,0.85)'); g0.addColorStop(0.5, 'rgba(34,8,10,0)');
      x.fillStyle = g0; x.fillRect(0, 0, w, TH); x.lineCap = 'round';
      for (let k = 7; k >= 0; k--) {
        const path = new Path2D(), lw = h * 0.05 * (1 - k * 0.07);
        for (let i = 0; i <= 48; i++) { const xx = i / 48 * w, y = TH - (k + 0.5) * h * 0.056 - h * 0.012 * Math.sin(xx / w * 5 + k * 2.1); i ? path.lineTo(xx, y) : path.moveTo(xx, y); }
        x.save(); x.translate(0, lw * 0.35); x.strokeStyle = 'rgba(40,8,10,0.3)'; x.lineWidth = lw * 1.5; x.stroke(path); x.restore();
        x.strokeStyle = 'rgb(' + (172 - k * 13) + ',' + (82 - k * 7) + ',' + (76 - k * 6) + ')'; x.lineWidth = lw; x.stroke(path);
        x.save(); x.translate(0, -lw * 0.2); x.strokeStyle = 'rgba(236,184,170,0.25)'; x.lineWidth = lw * 0.25; x.stroke(path); x.restore();
      }
      return c;
    });
    const wallF = memo('oesF' + W + 'x' + H, () => { const c = canvas(W, H), x = cx2d(c); x.translate(0, H); x.scale(1, -1); x.drawImage(wall, 0, 0); return c; });
    ctx.fillStyle = 'rgb(34,8,10)'; ctx.fillRect(0, 0, w, h);
    const NS = 96, sw = w / NS, tw = W / NS, m = ctx.getTransform();
    for (let i = 0; i < NS; i++) { // each strip is sheared so the lumen edge stays continuous
      const x0 = i * sw, sc = 1 - 0.15 * sq(x0 + sw / 2) + 0.12 * bulge(x0 + sw / 2), hh = TH * sc, r0 = r(x0), sh = (r(x0 + sw) - r0) / sw;
      for (const sg of [-1, 1]) {
        const f = sg < 0 ? cy - r0 - hh : cy + r0, k = sg < 0 ? -sh : sh;
        ctx.setTransform(m.a + m.c * k, m.b + m.d * k, m.c, m.d, m.a * x0 + m.c * f + m.e, m.b * x0 + m.d * f + m.f);
        ctx.drawImage(sg < 0 ? wall : wallF, i * tw, 0, tw, H, 0, 0, sw + 0.7, hh);
      }
    }
    ctx.setTransform(m);
    // lumen and bolus
    const lum = new Path2D();
    for (let i = 0; i <= N; i++) { const x = i / N * w; i ? lum.lineTo(x, cy - r(x)) : lum.moveTo(x, cy - r(x)); }
    for (let i = N; i >= 0; i--) { const x = i / N * w; lum.lineTo(x, cy + r(x)); }
    lum.closePath(); ctx.fillStyle = 'rgb(26,7,9)'; ctx.fill(lum);
    ctx.save(); ctx.clip(lum);
    const rb = r(xb), bg = ctx.createRadialGradient(xb - w * 0.03, cy - rb * 0.4, rb * 0.1, xb, cy, rb * 1.4);
    bg.addColorStop(0, 'rgb(208,170,134)'); bg.addColorStop(0.5, 'rgb(160,110,84)'); bg.addColorStop(1, 'rgb(70,38,30)');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(xb + w * 0.01, cy, w * 0.12, rb * 0.97, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.25; ctx.drawImage(grainTex(w, h), xb - w * 0.12, cy - rb, w * 0.24, rb * 2);
    ctx.globalAlpha = 0.3; ctx.drawImage(hilite(), xb - w * 0.07, cy - rb * 0.75, w * 0.08, rb * 0.35); ctx.globalAlpha = 1;
    ctx.restore();
    ctx.strokeStyle = 'rgba(246,220,206,0.3)'; ctx.lineWidth = h * 0.004; ctx.stroke(lum);
    // circular-muscle contraction band behind the bolus
    const g = ctx.createLinearGradient(xc - w * 0.12, 0, xc + w * 0.12, 0);
    g.addColorStop(0, 'rgba(30,6,8,0)'); g.addColorStop(0.5, 'rgba(30,6,8,0.4)'); g.addColorStop(1, 'rgba(30,6,8,0)');
    ctx.fillStyle = g; ctx.fillRect(xc - w * 0.12, 0, w * 0.24, h);
    ctx.strokeStyle = 'rgba(40,8,10,0.14)'; ctx.lineWidth = 1;
    for (let i = -6; i <= 6; i++) { const x = xc + i * w * 0.012; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  }
  function stomachLayout(w, h) {
    return memo('stomL', () => {
      const R = rng(61), ridges = [];
      for (let i = 0; i < 8; i++) {
        const y0 = -0.08 + i * 0.1 + R() * 0.04, pts = [], sl = 0.15 + R() * 0.2;
        for (let k = 0; k <= 30; k++) { const u = k / 30; pts.push([u * 1.2 - 0.1, y0 + u * sl + (fbm(u * 3, i, 62, 2) - 0.5) * 0.12]); }
        ridges.push({ pts, wd: 0.05 + R() * 0.03, d: i / 7 });
      }
      return ridges;
    });
  }
  function drawStomach(ctx, S, tt) {
    const { w, h } = S, M = h * 0.04, [W, H] = dims(w, h + M * 2, 1);
    const layerS = memo('stomS' + W + 'x' + H, () => { // mucosa + rugae, cached; churning applied as strip displacement
      const c = canvas(W, H), x = cx2d(c); x.scale(W / w, H / (h + M * 2)); x.translate(0, M);
      x.drawImage(mucosaTex(w, h, { dark: [100, 30, 32], light: [172, 82, 78], pap: [190, 110, 100] }, 71, 0), 0, -M, w, h + M * 2);
      x.lineCap = 'round'; x.lineJoin = 'round';
      for (const r of stomachLayout()) {
        const path = new Path2D(), lw = r.wd * h * (0.6 + 0.6 * r.d); // upper ridges farther and thinner
        r.pts.forEach((p, k) => (k ? path.lineTo(p[0] * w, p[1] * h) : path.moveTo(p[0] * w, p[1] * h)));
        x.save(); x.translate(0, lw * 0.4); x.strokeStyle = 'rgba(40,8,10,0.3)'; x.lineWidth = lw * 1.7; x.stroke(path); x.lineWidth = lw * 1.3; x.stroke(path); x.restore();
        x.strokeStyle = 'rgb(' + (138 + 24 * r.d | 0) + ',' + (58 + 10 * r.d | 0) + ',56)'; x.lineWidth = lw; x.stroke(path);
        x.save(); x.translate(0, -lw * 0.15); x.strokeStyle = 'rgba(190,104,94,0.6)'; x.lineWidth = lw * 0.6; x.stroke(path);
        x.translate(0, -lw * 0.12); x.strokeStyle = 'rgba(236,184,170,0.22)'; x.lineWidth = lw * 0.2; x.stroke(path); x.restore();
      }
      return c;
    });
    const NS = 48, sw = w / NS, tw = W / NS;
    for (let i = 0; i < NS; i++) {
      const x0 = i * sw, off = h * 0.014 * Math.sin((x0 + sw / 2) / w * 7 - tt * 0.5);
      ctx.drawImage(layerS, i * tw, 0, tw, H, x0, off - M, sw + 0.7, h + M * 2);
    }
    // slow peristaltic shading band (churning)
    const bx = fract(tt / 20) * w * 1.6 - w * 0.3, g = ctx.createLinearGradient(bx - w * 0.2, 0, bx + w * 0.2, 0);
    g.addColorStop(0, 'rgba(20,4,6,0)'); g.addColorStop(0.5, 'rgba(20,4,6,0.3)'); g.addColorStop(1, 'rgba(20,4,6,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // gastric fluid pool
    const p = new Path2D(); p.moveTo(-2, h + 2);
    for (let i = 0; i <= 30; i++) { const x = i / 30 * (w + 4) - 2; p.lineTo(x, h * 0.74 + h * 0.018 * Math.sin(x / w * 6 - tt * 0.7) + h * 0.01 * Math.sin(x / w * 13 + tt * 0.4)); }
    p.lineTo(w + 2, h + 2); p.closePath();
    const fg = ctx.createLinearGradient(0, h * 0.72, 0, h);
    fg.addColorStop(0, 'rgba(186,160,96,0.4)'); fg.addColorStop(1, 'rgba(90,66,30,0.6)');
    ctx.fillStyle = fg; ctx.fill(p);
    ctx.save(); ctx.clip(p);
    for (let i = 0; i < 6; i++) { const x = fract(i * 0.29 + tt * 0.01) * w; ctx.globalAlpha = 0.22; ctx.drawImage(hilite(), x - w * 0.08, h * 0.75, w * 0.16, h * 0.02); }
    ctx.restore(); ctx.globalAlpha = 1;
    for (let i = 0; i < 9; i++) { // mucus sheen
      const x = fract(i * 0.43 + tt * 0.004) * w, y = h * (0.1 + 0.6 * fract(i * 0.71));
      ctx.globalAlpha = 0.12; ctx.drawImage(hilite(), x - w * 0.04, y - h * 0.01, w * 0.08, h * 0.02);
    }
    ctx.globalAlpha = 1;
  }
  function microLayout() {
    return memo('microL', () => {
      const R = rng(77), bs = [];
      const cols = [[176, 146, 96], [204, 192, 168], [110, 126, 122], [122, 94, 72], [150, 144, 132]];
      for (let i = 0; i < 110; i++) {
        const d = R(), kind = R() < 0.55 ? 'rod' : R() < 0.6 ? 'coc' : 'chain';
        bs.push({ x: R(), y: 0.03 + Math.pow(R(), 1.2) * 0.48, d, kind, len: 1 + R() * 1.4, a: R() * TAU, c: cols[(R() * 5) | 0], vx: 0.004 + R() * 0.006, va: (R() - 0.5) * 0.08 });
      }
      bs.sort((p, q) => p.d - q.d); return bs;
    });
  }
  function drawMicrobiome(ctx, S, tt) {
    const { w, h } = S;
    ctx.drawImage(staticLayer('microBG', S, (c) => {
      fillBG(c, S, [58, 50, 40], [18, 14, 12], 0.5, 0.3);
      // villus tips (far row fainter/softer, near row larger), epithelium texture, brush-border fringe
      const villi = [[0.08, 0.52, 0.16, 0.5], [0.44, 0.5, 0.17, 0.5], [0.78, 0.54, 0.16, 0.5], [0.26, 0.62, 0.22, 1], [0.62, 0.66, 0.23, 1], [0.98, 0.62, 0.22, 1]];
      const epi = tissueTex(w, h, { cyto: [170, 124, 112], cyto2: [190, 146, 130], mem: [110, 70, 64], nuc: [96, 70, 72], nuc2: [120, 90, 90], ecm: [150, 110, 100] }, 88, 0.04);
      for (const v of villi) {
        const x = v[0] * w, y = v[1] * h, rw = v[2] * w / 2, far = v[3], p = new Path2D();
        p.moveTo(x - rw * 1.15, h + 2); p.bezierCurveTo(x - rw * 1.05, y + rw * 0.8, x - rw, y + rw * 0.1, x - rw * 0.9, y - rw * 0.2);
        p.bezierCurveTo(x - rw * 0.75, y - rw * 1.35, x + rw * 0.75, y - rw * 1.35, x + rw * 0.9, y - rw * 0.2);
        p.bezierCurveTo(x + rw, y + rw * 0.1, x + rw * 1.05, y + rw * 0.8, x + rw * 1.15, h + 2); p.closePath();
        c.save(); c.clip(p); c.globalAlpha = 0.25 + 0.55 * far; c.drawImage(epi, x - rw * 1.3, y - rw, rw * 2.6, h - y + rw); c.globalAlpha = 1;
        const g = c.createRadialGradient(x - rw * 0.35, y - rw * 0.5, rw * 0.1, x, y + rw * 0.6, rw * 2.2);
        g.addColorStop(0, 'rgba(230,200,180,0.18)'); g.addColorStop(0.5, 'rgba(60,30,26,0.25)'); g.addColorStop(1, 'rgba(24,14,12,0.85)');
        c.fillStyle = g; c.fillRect(x - rw * 1.3, y - rw, rw * 2.6, h);
        if (far < 1) { c.fillStyle = 'rgba(40,34,28,0.5)'; c.fillRect(x - rw * 1.3, y - rw, rw * 2.6, h); }
        c.restore();
        c.strokeStyle = 'rgba(226,210,190,' + (0.25 * far).toFixed(3) + ')'; c.lineWidth = Math.max(1, rw * 0.035); c.setLineDash([1, 1.5]); c.stroke(p); c.setLineDash([]);
      }
      // mucus layer: translucent, streaky
      const mg = c.createLinearGradient(0, h * 0.15, 0, h * 0.75);
      mg.addColorStop(0, 'rgba(210,200,176,0)'); mg.addColorStop(0.6, 'rgba(210,200,176,0.1)'); mg.addColorStop(1, 'rgba(210,200,176,0.16)');
      c.fillStyle = mg; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 10; i++) { c.globalAlpha = 0.06; c.drawImage(hilite(), fract(i * 0.37) * w * 1.2 - w * 0.2, h * (0.2 + 0.4 * fract(i * 0.53)), w * 0.35, h * 0.03); }
      c.globalAlpha = 1;
    }), 0, 0, w, h);
    // bacteria in the outer mucus/lumen, parallax by depth
    const u = h * 0.045, m = ctx.getTransform();
    for (const b of microLayout()) {
      const sc = 0.45 + 0.8 * b.d, x = (fract(b.x + tt * b.vx * (0.4 + b.d)) * 1.2 - 0.1) * w, y = b.y * h + Math.sin(tt * 0.2 + b.x * 20) * h * 0.006, a = b.a + tt * b.va;
      const blur = b.d < 0.3 || b.d > 0.93, ca = Math.cos(a), sa = Math.sin(a);
      ctx.globalAlpha = 0.4 + 0.6 * b.d;
      ctx.setTransform(m.a * ca + m.c * sa, m.b * ca + m.d * sa, m.c * ca - m.a * sa, m.d * ca - m.b * sa, m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f);
      if (b.kind === 'rod') { const L = u * sc * (1.6 + b.len); ctx.drawImage(rodSprite(b.c, blur), -L / 2, -L / 6, L, L / 3); }
      else if (b.kind === 'coc') { const r = u * sc * 0.42; ctx.drawImage(blur ? blob(b.c, 0, true) : ball(b.c), -r, -r, r * 2, r * 2); }
      else for (let k = 0; k < 4; k++) { const r = u * sc * 0.34; ctx.drawImage(ball(b.c), k * r * 1.8 - r * 3, -r, r * 2, r * 2); }
    }
    ctx.setTransform(m); ctx.globalAlpha = 1;
  }
  function roomDigestive(ctx, S) {
    const { w, h, t, tm } = S, micro = !!S.o.microbiome;
    const stA = sstep(11, 13, t), miA = micro ? sstep(19.5, 21.5, t) : 0, loopA = sstep(28.6, 30, t);
    if (stA < 0.999) drawOesophagus(ctx, S, tm);
    if (miA < 0.999 && loopA < 0.999) layer(ctx, S, stA, (c) => drawStomach(c, S, tm));
    if (miA > 0) layer(ctx, S, miA * (1 - loopA), (c) => drawMicrobiome(c, S, tm));
    if (loopA > 0 && stA > 0) layer(ctx, S, loopA, (c) => drawOesophagus(c, S, tm));
    finish(ctx, S, 0.55);
    const seg = t < 12 ? 0 : (micro && t >= 20) ? 2 : 1;
    if (seg === 2) label(ctx, S, 'Magnified ~×5,000 · colours illustrative', w * 0.965, h * 0.93, 'right', miA * (1 - loopA));
    scaleTag(ctx, S, ['~2 cm wide', '~25 cm', '~2 µm bacteria'][t >= 29.3 ? 0 : seg]);
  }

  /* ================================================================== */
  /* 4. HEART — vessel network pulsing with the beat                    */
  /* ================================================================== */
  function heartPhase(t, bpm) { bpm = bpm > 0 ? bpm : 64; return fract(t * bpm / 60); }
  function beatPulse(t, bpm) {
    const p = heartPhase(t, bpm);
    const lub = Math.exp(-Math.pow(p / 0.07, 2)) + Math.exp(-Math.pow((1 - p) / 0.025, 2));
    const dub = 0.6 * Math.exp(-Math.pow((p - 0.35) / 0.06, 2));
    return clamp(lub + dub, 0, 1);
  }
  /** Monotonic flow position (in beats): most advance in early systole. */
  function flowPos(t, bpm) { const b = t * bpm / 60, n = Math.floor(b), f = b - n; return n + 0.35 * f + 0.65 * (1 - Math.pow(1 - f, 4)); }
  function heartLayout(w, h) {
    const A = +(w / h).toFixed(2);
    return memo('heartL' + A, () => {
      const R = rng(31), segs = [];
      const grow = (x, y, a, wd, d) => {
        const len = (0.3 + 0.2 * R()) * Math.pow(wd / 0.1, 0.3), x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
        const bend = (R() - 0.5) * len * 0.4, cxp = (x + x1) / 2 - Math.sin(a) * bend, cyp = (y + y1) / 2 + Math.cos(a) * bend;
        segs.push({ x0: x, y0: y, cx: cxp, cy: cyp, x1, y1, wd, len, d });
        if (wd < 0.024 || d > 4 || x1 > A + 0.1 || y1 < -0.15 || y1 > 1.15) return;
        const s = R() < 0.5 ? 1 : -1;
        grow(x1, y1, a + s * (0.25 + 0.3 * R()), wd * (0.74 + 0.08 * R()), d + 1);
        if (R() < 0.75 || d < 2) grow(x1, y1, a - s * (0.45 + 0.35 * R()), wd * (0.52 + 0.1 * R()), d + 1);
      };
      grow(-0.05, 0.3, 0.1, 0.12, 0); grow(-0.05, 0.78, -0.12, 0.1, 0); grow(A * 0.45, 1.08, -1.0, 0.06, 1); grow(A * 0.3, -0.08, 0.9, 0.05, 1);
      const far = []; for (let i = 0; i < 60; i++) { const x = R() * A, y = R(); far.push([x, y, x + (R() - 0.3) * 0.4, y + (R() - 0.5) * 0.3, 0.01 + R() * 0.03]); }
      const cells = [];
      segs.forEach((s, i) => { const n = Math.min(18, Math.round(s.len * s.wd * 1200) + 1); for (let k = 0; k < n; k++) cells.push({ i, u0: R(), v: R() - 0.5, sz: 0.8 + R() * 0.4, ph: R() * TAU }); });
      return { segs, far, cells, A };
    });
  }
  function heartStatic(w, h, sys) {
    const [W, H] = dims(w, h, 1);
    return memo('heartS' + (sys ? 1 : 0) + W + 'x' + H, () => {
      const cv = canvas(W, H), x = cx2d(cv), L = heartLayout(w, h), k = H; // units of h
      if (!sys) {
        x.drawImage(mucosaTex(w, h, { dark: [24, 7, 8], light: [66, 20, 20], pap: [0, 0, 0] }, 33, 0), 0, 0, W, H);
        x.lineCap = 'round'; x.strokeStyle = 'rgba(96,26,26,0.12)';
        for (const f of L.far) for (let q = 0; q < 3; q++) { x.lineWidth = f[4] * k * (1 + q * 0.6); x.beginPath(); x.moveTo(f[0] * k, f[1] * k); x.lineTo(f[2] * k, f[3] * k); x.stroke(); }
      }
      x.lineCap = 'round';
      const pass = (col, mult, a, dy) => {
        x.strokeStyle = rgba(col, a);
        for (const s of L.segs) { x.lineWidth = s.wd * mult * k; x.beginPath(); x.moveTo(s.x0 * k, (s.y0 + dy * s.wd) * k); x.quadraticCurveTo(s.cx * k, (s.cy + dy * s.wd) * k, s.x1 * k, (s.y1 + dy * s.wd) * k); x.stroke(); }
      };
      if (sys) { pass([142, 36, 34], 0.86, 0.85, 0); pass([196, 112, 98], 0.16, 0.3, -0.24); }
      else { pass([30, 6, 8], 1.4, 0.8, 0.08); pass([86, 30, 30], 1.18, 1, 0); pass([88, 18, 20], 0.9, 1, 0); pass([110, 34, 32], 0.5, 0.8, -0.12); pass([186, 120, 106], 0.1, 0.26, -0.3); pass([150, 84, 78], 0.06, 0.16, 0.4); }
      return cv;
    });
  }
  function roomHeart(ctx, S) {
    const { w, h, t } = S, bpm = S.o.bpm > 0 ? S.o.bpm : (S.o.heartMode === 'exercise' ? 120 : 64), L = heartLayout(w, h), k = h;
    const pulseAt = (tt) => S.reduced ? 0.3 * (0.5 - 0.5 * Math.cos(TAU * heartPhase(tt, bpm))) : beatPulse(tt, bpm);
    ctx.drawImage(heartStatic(w, h, false), 0, 0, w, h);
    // systolic brightening travels along the network left→right (pressure wave)
    const sys = heartStatic(w, h, true), N = 16, sw = sys.width / N;
    for (let i = 0; i < N; i++) {
      const a = pulseAt(t - (i / N) * 0.18) * (S.floor ? 0.35 : 0.85);
      if (a < 0.01) continue;
      ctx.globalAlpha = a; ctx.drawImage(sys, i * sw, 0, sw, sys.height, i * w / N, 0, w / N + 0.5, h);
    }
    ctx.globalAlpha = 1;
    // red cells streaming with pulsatile flow
    const fp = flowPos(S.reduced ? t * 0.25 : t, bpm), spr = rbcSprite(false);
    for (const c of L.cells) {
      const s = L.segs[c.i], speed = 0.05 + s.wd * 0.9, u = fract(c.u0 + fp * speed / s.len), iu = 1 - u;
      const x = iu * iu * s.x0 + 2 * iu * u * s.cx + u * u * s.x1, y = iu * iu * s.y0 + 2 * iu * u * s.cy + u * u * s.y1;
      const tx = 2 * iu * (s.cx - s.x0) + 2 * u * (s.x1 - s.cx), ty = 2 * iu * (s.cy - s.y0) + 2 * u * (s.y1 - s.cy), tl = Math.hypot(tx, ty) || 1;
      const px = (x - ty / tl * c.v * s.wd * 0.7) * k, py = (y + tx / tl * c.v * s.wd * 0.7) * k;
      const sz = Math.max(2, s.wd * k * 0.42 * c.sz), tilt = 0.35 + 0.65 * Math.abs(Math.cos(c.ph + u * 5));
      ctx.globalAlpha = 0.85 * Math.min(1, u * 8, iu * 8);
      ctx.drawImage(spr, px - sz / 2, py - sz * tilt / 2, sz, sz * tilt);
    }
    ctx.globalAlpha = 1;
    finish(ctx, S, 0.6);
  }

  /* ================================================================== */
  /* 5. CELLULAR — tissue → cell → mitochondrion → membrane → ATP synthase */
  /* ================================================================== */
  const CELL_PAL = { cyto: [164, 158, 142], cyto2: [184, 176, 156], mem: [70, 66, 60], nuc: [88, 96, 96], nuc2: [120, 124, 118], ecm: [132, 112, 82] };
  // log-field keyframes [t, field µm]; holds drift slowly, transitions zoom ×10–×40
  const CELL_KF = [[0, 500], [6.5, 400], [10.5, 25], [16.5, 20], [20.5, 2.5], [26, 2.0], [30, 0.09], [35.5, 0.08], [39.5, 0.042], [48, 0.037]];
  const CELL_NATIVE = [500, 25, 2.5, 0.09];
  function cellField(t) {
    for (let i = 1; i < CELL_KF.length; i++) if (t <= CELL_KF[i][0]) {
      const a = CELL_KF[i - 1], b = CELL_KF[i], k = (t - a[0]) / (b[0] - a[0]), e = i % 2 === 0 ? k * k * (3 - 2 * k) : k;
      return Math.exp(lerp(Math.log(a[1]), Math.log(b[1]), e));
    }
    return CELL_KF[CELL_KF.length - 1][1];
  }
  /** Mitochondrion: outer membrane, IMS, inner boundary membrane, transverse cristae, matrix granules. */
  function drawMito(ctx, x, y, L, W, ang, seed, lod, out) {
    const R = rng(seed), mw = Math.max(0.5, W * 0.03);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    capsule(ctx, L, W); ctx.fillStyle = 'rgb(92,88,80)'; ctx.fill(); ctx.strokeStyle = 'rgb(206,196,176)'; ctx.lineWidth = mw; ctx.stroke();
    const iw = W * 0.9, il = L - W * 0.1;
    capsule(ctx, il, iw);
    const g = ctx.createLinearGradient(-L * 0.3, -W / 2, L * 0.2, W / 2);
    g.addColorStop(0, 'rgb(170,158,132)'); g.addColorStop(1, 'rgb(118,108,90)');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(206,196,176,0.9)'; ctx.lineWidth = mw; ctx.stroke();
    ctx.save(); ctx.clip();
    const n = Math.max(3, Math.round(L / W * 3.4)), cw = W * 0.075;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const px = -il / 2 + W * 0.35 + (il - W * 0.7) * (i + 0.5) / n + (R() - 0.5) * W * 0.12, top = i % 2 === 0, dep = W * (0.5 + R() * 0.32);
      const y0 = top ? -iw / 2 - cw : iw / 2 + cw, y1 = top ? -iw / 2 + dep : iw / 2 - dep, bend = (R() - 0.5) * W * 0.25;
      if (out) out.push([px + bend * 0.6 + cw / 2 + mw * 1.1, (y0 + y1) / 2]);
      ctx.beginPath(); ctx.moveTo(px, y0); ctx.quadraticCurveTo(px + bend, (y0 + y1) / 2, px + bend * 0.4, y1);
      ctx.strokeStyle = 'rgb(200,190,170)'; ctx.lineWidth = cw + mw * 2.2; ctx.stroke();
      ctx.strokeStyle = 'rgb(90,86,78)'; ctx.lineWidth = cw; ctx.stroke();
    }
    if (lod) {
      ctx.fillStyle = 'rgba(64,56,46,0.8)'; ctx.beginPath();
      for (let i = 0; i < 18 * lod; i++) { const gx = (R() - 0.5) * il * 0.9, gy = (R() - 0.5) * iw * 0.8, r = W * (0.008 + R() * 0.012); ctx.moveTo(gx + r, gy); ctx.arc(gx, gy, r, 0, TAU); }
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 0.12; ctx.drawImage(hilite(), -L * 0.35, -W * 0.45, L * 0.5, W * 0.35); ctx.globalAlpha = 1;
    ctx.restore();
  }
  function crowdTex(w, h, key, bgc, cols, dens) {
    const [W, H] = dims(w, h, 1.3);
    return memo('crowd' + key + W + 'x' + H, () => {
      const cv = canvas(W, H), x = cx2d(cv), R = rng(key.length * 97 + 5), n = Math.round(W * H / 260 * dens), s = W / 512;
      x.fillStyle = rgba(bgc); x.fillRect(0, 0, W, H);
      for (let i = 0; i < n; i++) {
        const far = i < n * 0.55, r = s * (far ? 3 + R() * 4 : 2.5 + R() * 3.5), c = cols[(R() * cols.length) | 0];
        x.globalAlpha = far ? 0.35 : 0.8; x.drawImage(blob(c, (R() * 6) | 0, far), R() * W - r, R() * H - r, r * 2, r * 2);
      }
      x.globalAlpha = 1; return cv;
    });
  }
  const CYT_COLS = [[150, 144, 128], [120, 130, 128], [168, 140, 98], [110, 100, 88], [184, 176, 158]];
  function cellStatic(w, h) {
    const [W, H] = dims(w, h, 1.5);
    return memo('cellS' + W + 'x' + H, () => {
      const cv = canvas(W, H), x = cx2d(cv), k = W / w, R = rng(404);
      x.scale(k, k);
      x.fillStyle = 'rgb(56,54,50)'; x.fillRect(0, 0, w, h);
      x.globalAlpha = 0.5; x.drawImage(tissueTex(w, h, CELL_PAL, 9, 0.5), 0, 0, w, h); x.globalAlpha = 1;
      const cellP = new Path2D(); // the cell we entered: irregular boundary, right edge visible
      for (let i = 0; i <= 48; i++) {
        const a = i / 48 * TAU, rr = 1 + 0.04 * Math.sin(a * 3 + 1) + 0.03 * Math.sin(a * 7);
        const px = w * 0.42 + Math.cos(a) * w * 0.52 * rr, py = h * 0.5 + Math.sin(a) * w * 0.5 * rr;
        i ? cellP.lineTo(px, py) : cellP.moveTo(px, py);
      }
      x.save(); x.clip(cellP);
      x.drawImage(crowdTex(w, h, 'cyto', [120, 118, 108], CYT_COLS, 0.6), 0, 0, w, h);
      // cytoskeleton filaments
      x.lineCap = 'round';
      for (let i = 0; i < 34; i++) {
        const a = R() * TAU, x0 = w * 0.3 + Math.cos(a) * w * 0.16, y0 = h * 0.5 + Math.sin(a) * w * 0.13;
        x.strokeStyle = 'rgba(96,112,110,0.42)'; x.lineWidth = w * 0.0022; x.beginPath(); x.moveTo(x0, y0);
        x.quadraticCurveTo(x0 + Math.cos(a) * w * 0.2 + (R() - 0.5) * w * 0.1, y0 + Math.sin(a) * w * 0.2, x0 + Math.cos(a + (R() - 0.5) * 0.4) * w * 0.45, y0 + Math.sin(a) * w * 0.42); x.stroke();
      }
      // rough ER sheets around the nucleus, with ribosome dots
      for (let i = 0; i < 7; i++) {
        const rr = w * (0.165 + i * 0.016), a0 = -1.1 + R() * 0.3, a1 = 1.1 - R() * 0.3;
        x.strokeStyle = 'rgb(176,164,140)'; x.lineWidth = w * 0.006; x.beginPath(); x.ellipse(w * 0.27, h * 0.5, rr, rr * 0.9, 0, a0, a1); x.stroke();
        x.strokeStyle = 'rgb(96,92,84)'; x.lineWidth = w * 0.0028; x.stroke();
        x.fillStyle = 'rgba(70,62,54,0.8)';
        for (let a = a0; a < a1; a += 0.05) { x.beginPath(); x.arc(w * 0.27 + Math.cos(a) * (rr + w * 0.004), h * 0.5 + Math.sin(a) * (rr + w * 0.004) * 0.9, w * 0.0018, 0, TAU); x.fill(); }
      }
      // Golgi stack
      for (let i = 0; i < 5; i++) { x.strokeStyle = 'rgb(186,170,140)'; x.lineWidth = w * 0.006; x.beginPath(); x.arc(w * 0.36, h * 0.2, w * (0.05 + i * 0.012), 0.5, 1.9); x.stroke(); x.strokeStyle = 'rgb(110,98,82)'; x.lineWidth = w * 0.003; x.stroke(); }
      // nucleus: double envelope with pores, chromatin, nucleolus
      x.save(); x.beginPath(); x.ellipse(w * 0.27, h * 0.5, w * 0.15, w * 0.135, 0.1, 0, TAU);
      x.fillStyle = 'rgb(96,100,98)'; x.fill(); x.clip();
      x.globalAlpha = 0.55; x.drawImage(crowdTex(w, h, 'chrom', [100, 104, 102], [[70, 76, 78], [128, 132, 126]], 0.9), 0, 0, w, h); x.globalAlpha = 1;
      x.fillStyle = 'rgb(60,64,66)'; x.beginPath(); x.ellipse(w * 0.3, h * 0.46, w * 0.04, w * 0.034, 0.4, 0, TAU); x.fill();
      x.restore();
      x.strokeStyle = 'rgb(196,188,168)'; x.lineWidth = w * 0.005; x.setLineDash([w * 0.03, w * 0.006]);
      x.beginPath(); x.ellipse(w * 0.27, h * 0.5, w * 0.15, w * 0.135, 0.1, 0, TAU); x.stroke(); x.setLineDash([]);
      // mitochondria scattered (the central one is drawn live)
      for (let i = 0; i < 11; i++) {
        let mx = w * (0.48 + R() * 0.45), my = h * (0.08 + R() * 0.84); if (Math.hypot(mx - w / 2, my - h / 2) < w * 0.09) my += h * 0.3;
        drawMito(x, mx, my, w * (0.06 + R() * 0.05), w * 0.03, R() * TAU, 50 + i, 0);
      }
      // vesicles
      for (let i = 0; i < 36; i++) { const r = w * (0.005 + R() * 0.008); x.fillStyle = 'rgb(128,124,112)'; x.strokeStyle = 'rgba(190,182,162,0.7)'; x.lineWidth = w * 0.002; x.beginPath(); x.arc(w * (0.4 + R() * 0.55), h * R(), r, 0, TAU); x.fill(); x.stroke(); }
      x.restore();
      x.strokeStyle = 'rgb(208,198,176)'; x.lineWidth = w * 0.006; x.stroke(cellP);
      x.strokeStyle = 'rgba(40,38,34,0.6)'; x.lineWidth = w * 0.003; x.stroke(cellP);
      return cv;
    });
  }
  function membraneLayout() {
    return memo('memL', () => {
      const R = rng(808), prot = [], lip = [], mat = [], ims = [];
      // proteins along the membrane (x in nm from centre, width nm); centre reserved for ATP synthase
      const slots = [[-104, 10], [-88, 8], [-66, 12], [-50, 9], [-36, 11], [-20, 8], [15, 9], [30, 12], [46, 9], [62, 11], [80, 9], [98, 12]];
      for (const s of slots) prot.push({ x: s[0], wd: s[1], c: [[104, 118, 116], [128, 100, 78], [150, 138, 116]][(R() * 3) | 0], v: (R() * 6) | 0, up: 1 + R() * 3 });
      const occ = (x) => Math.abs(x) < 4.6 || slots.some((s) => Math.abs(x - s[0]) < s[1] / 2);
      for (let x = -125; x <= 125; x += 0.92) if (!occ(x)) lip.push([x, R(), R()]);
      for (let i = 0; i < 300; i++) mat.push([(R() - 0.5) * 260, R(), R(), (R() * 6) | 0, (R() * 5) | 0]);
      for (let i = 0; i < 160; i++) ims.push([(R() - 0.5) * 260, R(), R(), (R() * 6) | 0]);
      return { prot, lip, mat, ims };
    });
  }
  /** ATP synthase in side view. Rotor (c-ring, γ, ε) turns; α3β3 head is held static by the peripheral stalk. */
  function drawATPase(ctx, cx, ym, u, rot, atp, tm) {
    const ring = 3.0 * u, memH = 4.2 * u;
    // subunit a (stator, beside the ring)
    ctx.drawImage(blob([128, 100, 78], 2), cx + ring * 0.7, ym - memH * 0.55, 3.4 * u, memH * 1.1);
    // c-ring: 8 staves, back ones first
    const st = [];
    for (let i = 0; i < 8; i++) { const a = rot + i * TAU / 8; st.push([Math.sin(a), Math.cos(a)]); }
    st.sort((p, q) => p[1] - q[1]);
    for (const s of st) {
      const x = cx + s[0] * ring, wd = u * 1.3 * (0.55 + 0.45 * Math.abs(s[1]));
      ctx.fillStyle = rgba(shade([110, 128, 126], 0.62 + 0.38 * (s[1] * 0.5 + 0.5)));
      ctx.beginPath(); ctx.ellipse(x, ym, wd / 2, memH * 0.56, 0, 0, TAU); ctx.fill();
    }
    // peripheral stalk (b) up to OSCP cap
    const hy = ym - 11.5 * u;
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgb(122,110,92)'; ctx.lineWidth = 1.1 * u;
    ctx.beginPath(); ctx.moveTo(cx + ring * 1.2, ym - memH * 0.3); ctx.quadraticCurveTo(cx + 6.8 * u, hy + 2 * u, cx + 3 * u, hy - 4.6 * u); ctx.stroke();
    ctx.strokeStyle = 'rgb(168,152,124)'; ctx.lineWidth = 0.5 * u; ctx.stroke();
    // central stalk γ (rotates: asymmetric offset swings), ε at its foot
    const off = Math.sin(rot) * 0.7 * u;
    ctx.strokeStyle = 'rgb(90,92,88)'; ctx.lineWidth = 1.9 * u; ctx.beginPath(); ctx.moveTo(cx, ym - memH * 0.5); ctx.lineTo(cx + off, hy + 1.5 * u); ctx.stroke();
    ctx.strokeStyle = 'rgb(150,152,144)'; ctx.lineWidth = 0.8 * u; ctx.beginPath(); ctx.moveTo(cx - 0.3 * u, ym - memH * 0.5); ctx.lineTo(cx + off - 0.3 * u, hy + 1.5 * u); ctx.stroke();
    ctx.drawImage(ball([112, 118, 110]), cx - off - 1.2 * u, ym - memH * 0.5 - 2.4 * u, 2.4 * u, 2.2 * u);
    // F1 head: alternating α (bone) / β (dusty ochre) around a static axis
    const sub = [];
    for (let i = 0; i < 6; i++) { const a = 0.35 + i * TAU / 6; sub.push([Math.sin(a), Math.cos(a), i % 2]); }
    sub.sort((p, q) => p[1] - q[1]);
    for (const s of sub) {
      const x = cx + s[0] * 3.2 * u, sc = 0.86 + 0.14 * s[1], rw = 2.6 * u * sc, rh = 4.4 * u * sc;
      ctx.globalAlpha = 0.75 + 0.25 * (s[1] * 0.5 + 0.5);
      ctx.drawImage(ball(s[2] ? [176, 142, 92] : [206, 196, 174]), x - rw, hy - rh - s[1] * 0.4 * u, rw * 2, rh * 2);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(blob([150, 140, 118], 4), cx + 1.2 * u, hy - 7.4 * u, 3.6 * u, 3 * u); // OSCP
    if (atp > 0.01) { // ATP released from the head into the matrix (3 per rotor turn)
      for (let k = 0; k < 6; k++) {
        const f = fract(rot / TAU * 3 / 2 + k / 6 * 1), ang = -Math.PI / 2 + (k % 3 - 1) * 0.9 + (k > 2 ? 0.35 : -0.35);
        const d = 5 * u + f * 9 * u, x = cx + Math.cos(ang) * d, y = hy + Math.sin(ang) * d * 0.8, a = atp * Math.sin(f * Math.PI) * 0.9;
        ctx.globalAlpha = a;
        const r = 0.45 * u;
        ctx.drawImage(ball([104, 118, 116]), x - r * 2.2, y - r, r * 2, r * 2);
        ctx.drawImage(ball([196, 186, 164]), x - r * 0.4, y - r * 0.8, r * 1.6, r * 1.6);
        for (let p = 0; p < 3; p++) ctx.drawImage(ball([172, 136, 80]), x + r * (1 + p * 1.3), y - r * 0.6 + p * 0.25 * r, r * 1.3, r * 1.3);
      }
      ctx.globalAlpha = 1;
    }
  }
  function drawMembrane(ctx, S, u, focusX, ym, rotSpeed, atp) {
    const { w, h, tm } = S, L = membraneLayout(), cx = focusX;
    // matrix (top, crowded) and intracristal space (bottom, sparser)
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, 'rgb(84,80,70)'); bg.addColorStop(0.6, 'rgb(96,92,82)'); bg.addColorStop(0.62, 'rgb(78,76,70)'); bg.addColorStop(1, 'rgb(58,56,52)');
    ctx.fillStyle = bg; ctx.fillRect(-w, -h, w * 3, h * 3);
    const drift = Math.sin(tm * 0.05) * 1.5;
    for (const m of L.mat) { // soluble matrix proteins, far ones soft
      const far = m[2] < 0.5, x = cx + (m[0] + drift * (far ? 0.5 : 1)) * u, y = ym - (3 + m[1] * 30) * u, r = (1.4 + m[2] * 2.2) * u;
      if (x < -r * 2 || x > w + r * 2 || y < -r * 2) continue;
      ctx.globalAlpha = far ? 0.4 : 0.85; ctx.drawImage(blob(CYT_COLS[m[4]], m[3], far), x - r, y - r, r * 2, r * 2);
    }
    for (const m of L.ims) {
      const x = cx + (m[0] - drift) * u, y = ym + (3.5 + m[1] * 24) * u, r = (0.9 + m[2] * 1.6) * u;
      ctx.globalAlpha = 0.55; ctx.drawImage(blob([150, 120, 96], m[3], m[2] < 0.5), x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    // lipid bilayer: heads (outer rows) and paired tails pointing to the middle
    const hr = 0.45 * u, off = 1.95 * u, tails = new Path2D();
    for (const l of L.lip) {
      const x = cx + l[0] * u; if (x < -u * 2 || x > w + u * 2) continue;
      for (const sg of [-1, 1]) {
        const y0 = ym + sg * (off - hr), y1 = ym + sg * 0.25 * u, wob = (l[1] - 0.5) * 0.35 * u;
        tails.moveTo(x - 0.16 * u, y0); tails.quadraticCurveTo(x - 0.2 * u + wob, (y0 + y1) / 2, x - 0.16 * u + wob, y1);
        tails.moveTo(x + 0.16 * u, y0); tails.quadraticCurveTo(x + 0.12 * u - wob, (y0 + y1) / 2, x + 0.16 * u - wob, y1);
      }
    }
    ctx.fillStyle = 'rgb(112,100,80)'; ctx.fillRect(-w, ym - off, w * 3, off * 2);
    ctx.strokeStyle = 'rgba(170,150,110,0.8)'; ctx.lineWidth = Math.max(0.5, 0.16 * u); ctx.stroke(tails);
    const hb = ball([206, 196, 172]);
    for (const l of L.lip) {
      const x = cx + l[0] * u; if (x < -u * 2 || x > w + u * 2) continue;
      ctx.drawImage(hb, x - hr, ym - off - hr, hr * 2, hr * 2);
      ctx.drawImage(hb, x - hr, ym + off - hr, hr * 2, hr * 2);
    }
    // integral membrane proteins (respiratory-chain-like lumps spanning the bilayer)
    for (const p of L.prot) {
      const x = cx + p.x * u, wd = p.wd * u;
      if (x < -wd || x > w + wd) continue;
      ctx.drawImage(blob(p.c, p.v), x - wd * 0.72, ym - off * 1.6 - p.up * u, wd * 1.44, off * 3.2 + p.up * u * 1.3);
      ctx.drawImage(blob(shade(p.c, 1.1), (p.v + 2) % 6), x - wd * 0.45, ym - off * 1.2 - p.up * u * 1.9, wd * 0.9, wd * 0.8);
    }
    drawATPase(ctx, cx, ym, u, tm * rotSpeed, atp, tm);
  }
  function roomCellular(ctx, S) {
    const { w, h, t, tm } = S, F = cellField(t);
    ctx.fillStyle = 'rgb(20,19,18)'; ctx.fillRect(0, 0, w, h);
    // layer weights from zoom depth (cross-fade across each transition)
    const lf = Math.log(F), prog = (a, b) => clamp((Math.log(a) - lf) / (Math.log(a) - Math.log(b)), 0, 1);
    const inCell = sstep(0.4, 0.8, prog(400, 25)), inMito = sstep(0.45, 0.85, prog(20, 2.5)), inMem = sstep(0.72, 0.95, prog(2, 0.09));
    const drift = (k) => [Math.sin(tm * 0.04 + k) * w * 0.008, Math.cos(tm * 0.035 + k) * h * 0.008];
    if (inCell < 1) {
      const s = CELL_NATIVE[0] / F, d = drift(0);
      ctx.save(); zoomAt(ctx, w / 2, h / 2, s); ctx.translate(d[0] / s, d[1] / s);
      ctx.drawImage(tissueTex(w, h, CELL_PAL, 21, 0.03), -w * 0.175, -h * 0.175, w * 1.35, h * 1.35); ctx.restore();
    }
    if (inCell > 0 && inMito < 1) layer(ctx, S, inCell, (c) => {
      const s = CELL_NATIVE[1] / F; zoomAt(c, w / 2, h / 2, s);
      c.drawImage(cellStatic(w, h), 0, 0, w, h);
      drawMito(c, w / 2, h / 2, w * 0.08, w * 0.032, 0, 7, s > 2 ? 1 : 0);
    });
    if (inMito > 0 && inMem < 1) layer(ctx, S, inMito, (c) => {
      const s = CELL_NATIVE[2] / F, u = prog(2, 0.09), fk = sstep(0, 0.45, u);
      const foc = memo('mitoFoc' + w + 'x' + h, () => { const o = []; drawMito(cx2d(canvas(4, 4)), 0, 0, w * 0.8, w * 0.32, 0, 7, 0, o); o.sort((a, b) => Math.abs(a[0]) - Math.abs(b[0])); return o[0]; });
      c.translate(w / 2, h / 2); c.rotate(-Math.PI / 2 * sstep(0.05, 0.6, u)); c.scale(s, s); c.translate(-(w / 2 + foc[0] * fk), -(h / 2 + foc[1] * fk));
      c.drawImage(crowdTex(w, h, 'cytm', [104, 104, 96], CYT_COLS, 1.2), -w * 0.1, -h * 0.1, w * 1.2, h * 1.2);
      drawMito(c, w / 2, h / 2, w * 0.8, w * 0.32, 0, 7, s < 5 ? 3 : 0);
    });
    if (inMem > 0) layer(ctx, S, inMem, (c) => {
      const s = CELL_NATIVE[3] / F, u0 = w / 90, ym = h * 0.6, fy = lerp(ym, h * 0.44, sstep(1.05, 2.3, s));
      c.translate(w / 2, h / 2); c.scale(s, s); c.translate(-w / 2, -fy);
      drawMembrane(c, S, u0, w / 2, ym, S.reduced ? 0.4 : 1.5, sstep(36, 39.5, t) * (1 - sstep(46.5, 47.8, t)));
    });
    finish(ctx, S, 0.5);
    // loop: fade through near-black at the seam
    const fade = Math.max(1 - sstep(0, 1.2, t), sstep(46.6, 48, t));
    if (fade > 0.001) { ctx.fillStyle = 'rgba(20,19,18,' + fade.toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); }
    const la = 1 - fade;
    const ch = CHAPTERS.cellular; let ci = 0; for (let i = 0; i < ch.length; i++) if (t >= ch[i].t) ci = i;
    const cfade = Math.min(1, (t - ch[ci].t) / 0.8, ci < ch.length - 1 ? (ch[ci + 1].t - t) / 0.5 : 9);
    label(ctx, S, ch[ci].label, w * 0.035, h * 0.075, 'left', la * clamp(cfade, 0, 1));
    if (t > 38) label(ctx, S, 'ATP synthase (simplified)', w * 0.965, h * 0.93, 'right', la * sstep(38, 40, t));
    scaleBar(ctx, S, F, la);
  }

  /* ================================================================== */
  /* 6. SIGNALS — myelinated axon, saltatory action potentials          */
  /* ================================================================== */
  const NODES = 3;
  function apShape(dt, D) { // membrane potential (mV) at time dt after local activation
    if (dt < 0 || dt > D) return -70;
    const k = dt / D;
    if (k < 0.12) return -70 + 100 * sstep(0, 0.12, k);
    if (k < 0.38) return 30 - 115 * sstep(0.12, 0.38, k);
    return -85 + 15 * sstep(0.38, 1, k);
  }
  function signalsStatic(w, h) {
    const [W, H] = dims(w, h, 1);
    return memo('sigS' + W + 'x' + H, () => {
      const cv = canvas(W, H), x = cx2d(cv), R = rng(515), k = W / w, cy = h * 0.5;
      x.scale(k, k);
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgb(30,24,22)'); g.addColorStop(0.5, 'rgb(40,32,28)'); g.addColorStop(1, 'rgb(18,14,13)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.lineCap = 'round';
      for (let i = 0; i < 6; i++) { // out-of-focus neighbouring fibres
        const y = h * (0.1 + R() * 0.8), a = (R() - 0.5) * 0.3, wd = h * (0.05 + R() * 0.1);
        for (let p = 0; p < 4; p++) { x.strokeStyle = 'rgba(150,130,108,' + (0.025 + p * 0.01) + ')'; x.lineWidth = wd * (1.6 - p * 0.3); x.beginPath(); x.moveTo(-10, y); x.lineTo(w + 10, y + Math.tan(a) * w); x.stroke(); }
      }
      const gap = w * 0.014, mh = h * 0.1, ah = h * 0.05;
      // bare axon (seen at the nodes)
      const ag = x.createLinearGradient(0, cy - ah, 0, cy + ah);
      ag.addColorStop(0, 'rgb(184,146,134)'); ag.addColorStop(0.45, 'rgb(150,108,100)'); ag.addColorStop(1, 'rgb(70,46,44)');
      x.fillStyle = ag; x.fillRect(0, cy - ah, w, ah * 2);
      // ion channels clustered at nodes
      for (let n = 0; n < NODES; n++) {
        const nx = (n + 0.5) * w / NODES;
        for (let i = 0; i < 16; i++) {
          const px = nx + (R() - 0.5) * gap * 1.6, top = R() < 0.5, py = top ? cy - ah + R() * ah * 0.25 : cy + ah - R() * ah * 0.25, r = h * (0.008 + R() * 0.006);
          x.drawImage(blob([110, 126, 124], (R() * 6) | 0), px - r, py - r, r * 2, r * 2);
        }
      }
      // myelin sheaths between nodes (compact lamellae, cylindrical shading), Schwann-cell nuclei
      for (let n = -1; n < NODES; n++) {
        const xa = (n + 0.5) * w / NODES + gap, xb = (n + 1.5) * w / NODES - gap, r = w * 0.06;
        x.save(); x.beginPath(); x.moveTo(xa, cy - ah * 1.05); x.bezierCurveTo(xa + r * 0.35, cy - ah * 1.1, xa + r * 0.45, cy - mh, xa + r, cy - mh);
        x.lineTo(xb - r, cy - mh); x.bezierCurveTo(xb - r * 0.45, cy - mh, xb - r * 0.35, cy - ah * 1.1, xb, cy - ah * 1.05);
        x.lineTo(xb, cy + ah * 1.05); x.bezierCurveTo(xb - r * 0.35, cy + ah * 1.1, xb - r * 0.45, cy + mh, xb - r, cy + mh);
        x.lineTo(xa + r, cy + mh); x.bezierCurveTo(xa + r * 0.45, cy + mh, xa + r * 0.35, cy + ah * 1.1, xa, cy + ah * 1.05); x.closePath();
        const mg = x.createLinearGradient(0, cy - mh, 0, cy + mh);
        mg.addColorStop(0, 'rgb(170,160,142)'); mg.addColorStop(0.22, 'rgb(222,212,192)'); mg.addColorStop(0.5, 'rgb(186,174,152)'); mg.addColorStop(0.85, 'rgb(104,94,80)'); mg.addColorStop(1, 'rgb(66,58,50)');
        x.fillStyle = mg; x.fill(); x.clip();
        for (let l = 0; l < 26; l++) { const yy = cy - mh + (l + 0.5) / 26 * mh * 2; x.strokeStyle = l % 2 ? 'rgba(80,66,52,0.1)' : 'rgba(255,248,232,0.06)'; x.lineWidth = 1; x.beginPath(); x.moveTo(xa, yy); x.lineTo(xb, yy + (R() - 0.5) * 3); x.stroke(); }
        for (let l = 0; l < 40; l++) { const xx = lerp(xa, xb, l / 40); x.strokeStyle = 'rgba(70,60,48,0.05)'; x.beginPath(); x.moveTo(xx, cy - mh); x.lineTo(xx + mh * 0.6, cy + mh); x.stroke(); }
        x.restore();
        x.strokeStyle = 'rgba(40,30,24,0.5)'; x.lineWidth = 1; x.stroke();
      }
      return cv;
    });
  }
  function roomSignals(ctx, S) {
    const { w, h, t, tm } = S, cy = h * 0.5, C = S.reduced ? 8 : 3, D = S.reduced ? 3 : 1.2;
    ctx.drawImage(signalsStatic(w, h), 0, 0, w, h);
    // idle: slow specular drift along the sheaths (resting state)
    ctx.globalAlpha = 0.07; ctx.drawImage(hilite(), fract(tm * 0.01) * w * 1.4 - w * 0.3, cy - h * 0.14, w * 0.3, h * 0.05); ctx.globalAlpha = 1;
    const sigs = (Array.isArray(S.o.signalTimes) ? S.o.signalTimes : []).filter((s) => isFinite(s) && t - s >= 0 && t - s < C + D + 1);
    const nodeX = (n) => (n + 0.5) * w / NODES, actAt = (n) => nodeX(n) / w * C;
    const vm = (n, tt) => { let v = 0; for (const s of sigs) v += apShape(tt - s - actAt(n), D) + 70; return clamp(-70 + v, -90, 35); };
    // depolarisation: brief warm ivory/amber shading at each node as it fires (envelope, not a flash)
    const tau = S.reduced ? 1.4 : 0.55, env = (dt) => dt < 0 ? 0 : dt < 0.1 ? dt / 0.1 : Math.exp(-(dt - 0.1) / tau);
    for (let n = -1; n <= NODES; n++) {
      let dep = 0; for (const s of sigs) dep += env(t - s - actAt(n));
      dep = clamp(dep, 0, 1) * (S.reduced ? 0.7 : 1);
      if (dep < 0.01) continue;
      const x = nodeX(n), g = ctx.createRadialGradient(x, cy - h * 0.012, 0, x, cy, h * 0.11);
      g.addColorStop(0, 'rgba(236,200,140,' + (0.75 * dep).toFixed(3) + ')'); g.addColorStop(1, 'rgba(236,200,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, cy, h * 0.11, h * 0.11, 0, 0, TAU); ctx.fill();
      const cg = ctx.createRadialGradient(x + w * 0.1, cy, 0, x + w * 0.1, cy, w * 0.14); // local current spreading ahead
      cg.addColorStop(0, 'rgba(214,170,108,' + (0.14 * dep).toFixed(3) + ')'); cg.addColorStop(1, 'rgba(214,170,108,0)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(x + w * 0.1, cy, w * 0.14, h * 0.085, 0, 0, TAU); ctx.fill();
    }
    finish(ctx, S, 0.55);
    if (!S.labels) return;
    // recording point marker + inset trace of membrane potential
    const rn = 1, rx = nodeX(rn);
    ctx.strokeStyle = 'rgba(236,228,212,0.55)'; ctx.lineWidth = Math.max(1, h * 0.004);
    ctx.beginPath(); ctx.moveTo(rx, cy + h * 0.1); ctx.lineTo(rx, cy + h * 0.16); ctx.stroke();
    const gx = w * 0.66, gy = h * 0.7, gw = w * 0.31, gh = h * 0.21, Wn = S.reduced ? 10 : 4;
    const py = (v) => gy + gh * 0.15 + (35 - v) / 125 * gh * 0.75;
    ctx.fillStyle = 'rgba(14,10,9,0.6)'; ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = 'rgba(236,228,212,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(gx + 0.5, gy + 0.5, gw - 1, gh - 1);
    ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(gx + gw * 0.2, py(-70)); ctx.lineTo(gx + gw * 0.97, py(-70)); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(222,190,132,0.95)'; ctx.lineWidth = Math.max(1.2, h * 0.005); ctx.beginPath();
    for (let i = 0; i <= 80; i++) { const tt = t - Wn + i / 80 * Wn, X = gx + gw * 0.2 + i / 80 * gw * 0.77, Y = py(vm(rn, tt)); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.stroke();
    label(ctx, S, '+30', gx + gw * 0.17, py(30) + h * 0.012, 'right', 0.85);
    label(ctx, S, '−70 mV', gx + gw * 0.17, py(-70) + h * 0.012, 'right', 0.85);
    label(ctx, S, 'Simplified: slowed and magnified for visibility', w * 0.035, h * 0.93, 'left');
  }

  /* ================================================================== */
  /* 7. VR previews — flat renders of the headset view                  */
  /* ================================================================== */
  function vrLayout() {
    return memo('vrL', () => {
      const R = rng(99), rbc = [], parts = [], fil = [];
      for (let i = 0; i < 90; i++) { const a = R() * TAU, r = Math.sqrt(R()) * 0.75; rbc.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, z: R(), ph: R() * TAU, sp: 0.8 + R() * 0.4 }); }
      for (let i = 0; i < 330; i++) parts.push({ x: (R() - 0.5) * 6, y: (R() - 0.5) * 3.6, z: R() * 14, s: 0.06 + R() * 0.16, c: (R() * 5) | 0, v: (R() * 6) | 0 });
      for (let i = 0; i < 16; i++) fil.push([(R() - 0.5) * 7, (R() - 0.5) * 4, R() * 14, (R() - 0.5) * 7, (R() - 0.5) * 4, R() * 14]);
      return { rbc, parts, fil };
    });
  }
  /** Perspective tunnel: disks painted near→far so each ring band shows between radii. */
  function tunnel(ctx, S, o) {
    const { w, h } = S, f = h * 0.9, cx = w / 2, cy = h / 2, cam = o.bend(o.travel);
    ctx.fillStyle = rgba(o.fog); ctx.fillRect(0, 0, w, h);
    const k0 = Math.floor((o.travel + o.zNear) / o.dz), n = Math.ceil((o.zFar - o.zNear) / o.dz), rings = [];
    for (let i = 0; i <= n; i++) {
      const kw = k0 + i, zw = kw * o.dz, z = zw - o.travel; if (z < o.zNear * 0.6) continue;
      const b = o.bend(zw), R = o.rad(zw) * f / z;
      rings.push({ x: cx + (b[0] - cam[0]) * f / z, y: cy + (b[1] - cam[1]) * f / z, R, z, zw, kw });
    }
    for (const r of rings) {
      const fogk = sstep(o.zNear, o.zFar, r.z);
      ctx.fillStyle = rgba(mix(shade(o.col(r.kw, r.zw), 1.15 - 0.3 * fogk), o.fog, fogk));
      ctx.beginPath(); ctx.ellipse(r.x, r.y, r.R, r.R * (o.squash || 1), 0, 0, TAU); ctx.fill();
    }
    if (o.folds) { // longitudinal folds as polylines through the ring sequence
      ctx.lineCap = 'round';
      for (let i = 0; i < o.folds; i++) {
        const a0 = i / o.folds * TAU + 0.2;
        ctx.strokeStyle = rgba(o.foldCol, 0.22); ctx.lineWidth = Math.max(1, h * 0.016);
        ctx.beginPath(); let started = false;
        for (const r of rings) { if (r.z > o.zFar * 0.8) break; const a = a0 + 0.3 * Math.sin(r.zw * 0.35 + i * 1.7); const x = r.x + Math.cos(a) * r.R * 0.97, y = r.y + Math.sin(a) * r.R * 0.97 * (o.squash || 1); started ? ctx.lineTo(x, y) : ctx.moveTo(x, y); started = true; }
        ctx.stroke();
      }
    }
    return { f, cx, cy, cam, rings };
  }
  function vrBlood(ctx, S) {
    const { w, h, t, tm } = S, L = vrLayout(), pul = S.reduced ? 0 : beatPulse(t, 64);
    const travel = tm * 1.6 + (S.reduced ? 0 : flowPos(t, 64) * 0.5);
    const bend = (z) => [Math.sin(z * 0.11) * 2.2 + Math.sin(z * 0.037) * 2.4, Math.cos(z * 0.08) * 1.2];
    const T = tunnel(ctx, S, {
      travel, zNear: 0.35, zFar: 13, dz: 0.22, fog: [22, 5, 6], bend,
      rad: (z) => 1 + 0.03 * pul + (t > 24 ? 0.15 * sstep(24, 34, t) : 0),
      col: (k) => mix([98, 20, 22], [140, 42, 40], vnoise(k * 0.35, 0, 3)), folds: 0
    });
    // endothelial sheen streaks along the wall
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 6; i++) { const a = i * 1.1 + tm * 0.05; ctx.drawImage(hilite(), w / 2 + Math.cos(a) * w * 0.38 - w * 0.12, h / 2 + Math.sin(a) * h * 0.38 - h * 0.02, w * 0.24, h * 0.04); }
    ctx.globalAlpha = 1;
    const cells = L.rbc.map((c) => ({ c, z: 0.3 + fract(c.z - tm * 0.05 * c.sp) * 10 })).sort((a, b) => b.z - a.z);
    for (const q of cells) {
      const c = q.c, zw = travel + q.z, b = bend(zw), s = T.f / q.z;
      const x = T.cx + (b[0] - T.cam[0] + c.x) * s, y = T.cy + (b[1] - T.cam[1] + c.y) * s, sz = 0.2 * s, tilt = 0.3 + 0.7 * Math.abs(Math.cos(c.ph + tm * 0.3));
      ctx.globalAlpha = (1 - sstep(3, 10, q.z)) * sstep(0.3, 0.8, q.z);
      ctx.drawImage(rbcSprite(q.z < 1.2), x - sz / 2, y - sz * tilt / 2, sz, sz * tilt);
    }
    ctx.globalAlpha = 1;
  }
  function vrSip(ctx, S) {
    const { w, h, t, tm } = S, sp = S.reduced ? 0.6 : 1.6, travel = t * sp; // journey position follows the timeline
    const bend = (z) => [Math.sin(z * 0.05) * 0.8, -0.3 + 0.9 * sstep(14, 26, z) + Math.sin(z * 0.08) * 0.3];
    const rad = (z) => lerp(lerp(2.1, 0.8, sstep(16, 24, z / (sp / 1.6))), 3.2, sstep(44, 52, z / (sp / 1.6)));
    const T = tunnel(ctx, S, {
      travel, zNear: 0.4, zFar: 18, dz: 0.3, fog: [34, 10, 12], bend, rad, squash: 0.9,
      col: (k, zw) => { const zz = zw / (sp / 1.6); const base = zz < 20 ? [190, 96, 92] : zz < 46 ? [196, 118, 110] : [150, 58, 56]; return shade(base, 0.85 + 0.25 * vnoise(k * 0.5, 1, 5) + (zz > 46 ? 0.25 * (vnoise(k * 0.9, 2, 6) - 0.5) : 0)); },
      folds: 12, foldCol: [96, 34, 38]
    });
    // the sip: liquid on the floor of the tunnel, flowing ahead of the viewer
    const front = travel + 6 + 1.5 * Math.sin(tm * 0.3), liq = S.o.variant === 'water' ? [206, 214, 214] : [184, 124, 52];
    const lp = [], rp = [];
    for (const r of T.rings) {
      if (r.zw > front) break;
      const R = r.R, lvl = R * 0.55 * 0.9, half = Math.sqrt(Math.max(0, R * R - (R * 0.55) * (R * 0.55))) * sstep(front, front - 2.5, r.zw);
      lp.push([r.x - half, r.y + lvl]); rp.push([r.x + half, r.y + lvl]);
    }
    if (lp.length > 1) {
      ctx.beginPath(); ctx.moveTo(lp[0][0], h + 2);
      for (const p of lp) ctx.lineTo(p[0], p[1]);
      for (let i = rp.length - 1; i >= 0; i--) ctx.lineTo(rp[i][0], rp[i][1]);
      ctx.lineTo(rp[0][0], h + 2); ctx.closePath();
      ctx.fillStyle = rgba(liq, S.o.variant === 'water' ? 0.25 : 0.55); ctx.fill();
      ctx.save(); ctx.clip();
      for (let i = 0; i < 8; i++) { const k = fract(i * 0.13 + tm * 0.3), y = lerp(h, h * 0.55, Math.sqrt(k)); ctx.globalAlpha = 0.18 * (1 - k); ctx.drawImage(hilite(), w / 2 - w * 0.3 * (1 - k) + (i % 3 - 1) * w * 0.1, y, w * 0.6 * (1 - k) + 4, h * 0.02); }
      ctx.restore(); ctx.globalAlpha = 1;
    }
    // teeth arch framing the start of the journey
    const zt = 10 - travel;
    if (zt > 0.3) {
      const s = T.f / zt, a = sstep(0.3, 1.5, zt);
      for (let j = -5; j <= 5; j++) for (const sg of [-1, 1]) {
        const X = j * 0.37, Y = sg * (1.55 - 0.02 * j * j), b = bend(10);
        const x = T.cx + (X + b[0] - T.cam[0]) * s, y = T.cy + (Y + b[1] - T.cam[1]) * s, tw = (0.38 + 0.04 * Math.abs(j)) * s, th = 0.36 * s;
        ctx.globalAlpha = a;
        const g = ctx.createRadialGradient(x - tw * 0.15, y - th * 0.2, tw * 0.05, x, y, tw * 0.6);
        g.addColorStop(0, 'rgb(236,228,210)'); g.addColorStop(0.6, 'rgb(206,192,166)'); g.addColorStop(1, 'rgb(120,100,82)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y + sg * th * 0.1, tw / 2, th / 2, 0, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
  function vrCell(ctx, S) {
    const { w, h, t, tm } = S, L = vrLayout(), f = h * 0.9, cx = w / 2, cy = h / 2, travel = t * 0.33 + Math.sin(tm * 0.1) * 0.1;
    const fog = [58, 58, 54];
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.7); g.addColorStop(0, 'rgb(96,94,86)'); g.addColorStop(1, rgba(fog));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const items = [];
    for (const p of L.parts) { let z = p.z - fract(travel / 14) * 14; if (z < 0.2) z += 14; items.push({ p, z }); }
    const mz = 13 - travel; // target mitochondrion
    items.push({ mito: true, z: mz });
    for (const q of L.fil) { let z = (q[2] + q[5]) / 2 - fract(travel / 14) * 14; if (z < 0.5) z += 14; items.push({ fil: q, z }); }
    items.sort((a, b) => b.z - a.z);
    const mspr = memo('vrMito', () => { const c = canvas(640, 300); drawMito(cx2d(c), 320, 150, 600, 250, 0, 7, 2); return c; });
    for (const it of items) {
      const z = it.z, s = f / z, fogk = sstep(2, 13, z);
      if (it.mito) {
        if (z < 0.4) continue;
        const L2 = 4 * s, W2 = L2 * 300 / 640;
        ctx.globalAlpha = 1 - fogk * 0.7; ctx.drawImage(mspr, cx - L2 / 2 + w * 0.03, cy - W2 / 2 + h * 0.02, L2, W2);
      } else if (it.fil) {
        const q = it.fil, off = fract(travel / 14) * 14;
        let z1 = q[2] - off, z2 = q[5] - off; if (z1 < 0.5) z1 += 14; if (z2 < 0.5) z2 += 14;
        ctx.globalAlpha = 0.35 * (1 - fogk); ctx.strokeStyle = 'rgb(118,130,126)'; ctx.lineWidth = Math.max(0.6, 0.025 * s);
        ctx.beginPath(); ctx.moveTo(cx + q[0] * f / z1, cy + q[1] * f / z1); ctx.lineTo(cx + q[3] * f / z2, cy + q[4] * f / z2); ctx.stroke();
      } else {
        const p = it.p, r = p.s * s, x = cx + p.x * s, y = cy + p.y * s;
        if (x < -r || x > w + r || y < -r || y > h + r) continue;
        ctx.globalAlpha = (1 - fogk * 0.85) * (z < 1 ? 0.55 : 1);
        ctx.drawImage(blob(CYT_COLS[p.c], p.v, z < 1 || z > 8), x - r, y - r, r * 2, r * 2);
      }
    }
    ctx.globalAlpha = 1;
  }
  function roomVR(ctx, S) {
    const { t } = S, kind = S.o.vrPreview || 'bloodstream';
    if (kind === 'sip') vrSip(ctx, S); else if (kind === 'cell') vrCell(ctx, S); else vrBlood(ctx, S);
    finish(ctx, S, 0.7);
    const fade = Math.max(1 - sstep(0, 1.5, t), sstep(34.8, 36, t));
    if (fade > 0.001) { ctx.fillStyle = 'rgba(8,5,4,' + fade.toFixed(3) + ')'; ctx.fillRect(0, 0, S.w, S.h); }
    label(ctx, S, 'VR preview (flat render)', S.w * 0.035, S.h * 0.93, 'left', 1);
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                         */
  /* ------------------------------------------------------------------ */
  const DURATION = { entrance: 40, mouth: 30, digestive: 30, heart: 0, cellular: 48, signals: 0, vr: 36 };
  const CHAPTERS = {
    entrance: [{ t: 0, label: 'Human silhouette' }, { t: 8, label: 'Organs' }, { t: 18, label: 'Cells' }, { t: 28, label: 'Molecules' }],
    mouth: [{ t: 0, label: 'Saliva' }, { t: 8, label: 'Sip' }, { t: 15, label: 'Swallow' }, { t: 21, label: 'Aftermath' }],
    digestive: [{ t: 0, label: 'Oesophagus' }, { t: 12, label: 'Stomach' }, { t: 20, label: 'Microbiome (optional)' }],
    heart: [{ t: 0, label: 'Continuous — synced to heartbeat' }],
    cellular: [{ t: 0, label: 'Tissue' }, { t: 9, label: 'Cell' }, { t: 19, label: 'Mitochondrion' }, { t: 28, label: 'Inner membrane' }, { t: 38, label: 'ATP synthase' }],
    signals: [{ t: 0, label: 'Continuous — visitor-triggered signals' }],
    vr: [{ t: 0, label: 'Enter' }, { t: 12, label: 'Travel' }, { t: 24, label: 'Arrive' }]
  };
  const ROOMS = { entrance: roomEntrance, mouth: roomMouth, digestive: roomDigestive, heart: roomHeart, cellular: roomCellular, signals: roomSignals, vr: roomVR };
  const warned = {};

  function draw(roomId, ctx, w, h, t, opts) {
    if (!ctx || !(w > 0) || !(h > 0)) return;
    const o = opts || {}, surf = o.surface || 'preview', dur = DURATION[roomId] || 0;
    t = +t || 0;
    const tw = dur > 0 ? ((t % dur) + dur) % dur : t;
    let m = o.reduced ? 0.25 : 1; if (surf === 'floor') m *= 0.6;
    // for looping rooms motion time restarts per loop; continuous rooms keep elapsed time
    const S = { w, h, t: tw, tm: tw * m, m, o, reduced: !!o.reduced, surf, floor: surf === 'floor', labels: surf === 'preview' || surf === 'wall' };
    ctx.save();
    try {
      const fn = ROOMS[roomId];
      if (!fn) throw new Error('unknown room ' + roomId);
      fn(ctx, S);
      if (S.floor) { ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(12,8,7,0.5)'; ctx.fillRect(0, 0, w, h); }
    } catch (e) {
      ctx.restore(); ctx.save();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#120c0a'; ctx.fillRect(0, 0, w, h);
      if (!warned[roomId] && root.console) { warned[roomId] = 1; console.warn('UW_PROJ.draw(' + roomId + ') failed:', e); }
    }
    ctx.restore();
  }
  const THUMB_T = { entrance: 13, mouth: 11, digestive: 5, heart: 0.05, cellular: 43, signals: 5, vr: 18 };
  function thumb(roomId, ctx, w, h, opts) {
    const o = Object.assign({ surface: 'preview' }, opts || {});
    if (roomId === 'signals' && !o.signalTimes) o.signalTimes = [3.6];
    if (roomId === 'digestive' && o.microbiome) return draw(roomId, ctx, w, h, 25, o);
    if (roomId === 'mouth' && o.variant === 'sugar') return draw(roomId, ctx, w, h, 24, o);
    draw(roomId, ctx, w, h, THUMB_T[roomId] || 0, o);
  }

  root.UW_PROJ = { duration: DURATION, chapters: CHAPTERS, draw, thumb, heartPhase, beatPulse };
})(typeof window !== 'undefined' ? window : this);
