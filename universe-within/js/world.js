/* The Universe Within — 3D venue model (Three.js r158, global THREE).
   Builds an illustrative brick warehouse with connected, darkened rooms,
   their installations, projection surfaces, AV equipment and scale figures,
   plus orbit and eye-level navigation. Everything is procedural: no
   external model files. */
(function () {
  'use strict';
  const W = {};
  const M = () => window.UW_MODEL;
  let renderer, scene, camera, canvas;
  let config = null, L = null;
  let venue = null;           // group holding everything rebuilt from config
  let rooms = {};             // id -> room runtime object
  let hotspots = [];
  let typeView = false, showBeams = true, cutaway = false;
  const hooks = { projTime: () => 0, projOpts: () => ({}), onPick: () => {}, onRoomChange: () => {} };
  W.hooks = hooks;

  // ---------- small utilities ----------
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hash3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const f = t => t * t * (3 - 2 * t);
    const u = f(xf), v = f(yf), w = f(zf);
    let r = 0;
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) {
      r += hash3(xi + dx, yi + dy, zi + dz) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
    }
    return r;
  }
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---------- procedural textures ----------
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.anisotropy = 4;
    return t;
  }
  function brickDraw(ctx, w, h) {
    const R = rng(7);
    ctx.fillStyle = '#6d625a'; ctx.fillRect(0, 0, w, h);
    const rows = 8, cols = 4, bh = h / rows, bw = w / cols, m = 3;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * bw / 2;
      for (let c = -1; c <= cols; c++) {
        const x = c * bw + off;
        const tone = R();
        const base = tone < 0.15 ? [92, 48, 36] : tone < 0.5 ? [124, 62, 44] : tone < 0.85 ? [140, 74, 52] : [110, 70, 58];
        const soot = R() * 0.35;
        ctx.fillStyle = `rgb(${base.map(v => Math.round(v * (1 - soot) + R() * 10)).join(',')})`;
        ctx.fillRect(x + m, r * bh + m, bw - m * 2, bh - m * 2);
        for (let k = 0; k < 40; k++) { // speckle
          ctx.fillStyle = `rgba(${R() < 0.5 ? '30,20,15' : '190,150,120'},${R() * 0.18})`;
          ctx.fillRect(x + m + R() * (bw - m * 2), r * bh + m + R() * (bh - m * 2), 2 + R() * 3, 1 + R() * 2);
        }
      }
    }
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(20,14,10,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  function brickBump(ctx, w, h) {
    ctx.fillStyle = '#222'; ctx.fillRect(0, 0, w, h);
    const rows = 8, cols = 4, bh = h / rows, bw = w / cols, m = 3; const R = rng(9);
    for (let r = 0; r < rows; r++) { const off = (r % 2) * bw / 2; for (let c = -1; c <= cols; c++) { const v = 170 + R() * 60; ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(c * bw + off + m, r * bh + m, bw - m * 2, bh - m * 2); } }
  }
  function concreteDraw(ctx, w, h) {
    const R = rng(3);
    ctx.fillStyle = '#34302c'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = R() * w, y = R() * h, r = 4 + R() * 40;
      ctx.fillStyle = `rgba(${R() < 0.5 ? '20,18,16' : '80,74,66'},${0.03 + R() * 0.05})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(15,12,10,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, w - 2, h - 2);
  }
  function timberDraw(ctx, w, h) {
    const R = rng(11); ctx.fillStyle = '#4b3526'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { ctx.strokeStyle = `rgba(${R() < 0.5 ? '30,20,12' : '100,74,52'},${0.15 + R() * 0.2})`; ctx.lineWidth = 1 + R() * 2; ctx.beginPath(); const y = R() * h; ctx.moveTo(0, y); ctx.bezierCurveTo(w * 0.3, y + R() * 6 - 3, w * 0.6, y + R() * 6 - 3, w, y + R() * 4 - 2); ctx.stroke(); }
  }
  function noiseDraw(scale, base, var_) {
    return (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const n = vnoise(x / scale, y / scale, 0.5) * 0.6 + vnoise(x / (scale / 3), y / (scale / 3), 3.1) * 0.4;
        const i = (y * w + x) * 4; const v = base + (n - 0.5) * var_;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    };
  }

  let MAT = null;
  function materials() {
    if (MAT) return MAT;
    const brick = canvasTex(512, 512, brickDraw, true), brickB = canvasTex(256, 256, brickBump, true);
    brickB.colorSpace = THREE.NoColorSpace;
    const conc = canvasTex(512, 512, concreteDraw, true);
    const timber = canvasTex(256, 64, timberDraw, true);
    const papillae = canvasTex(256, 256, noiseDraw(4, 128, 180), true); papillae.colorSpace = THREE.NoColorSpace;
    const fabricN = canvasTex(128, 128, noiseDraw(8, 128, 90), true); fabricN.colorSpace = THREE.NoColorSpace;
    MAT = {
      brickTex: brick, brickBump: brickB, concTex: conc, timberTex: timber,
      brick: new THREE.MeshStandardMaterial({ map: brick, bumpMap: brickB, bumpScale: 0.6, roughness: 0.92, color: 0xb0a499, emissive: 0xffe2c4, emissiveMap: brick, emissiveIntensity: 0.12 }),
      floor: new THREE.MeshStandardMaterial({ map: conc, roughness: 0.62, metalness: 0.0, color: 0x9a948e, emissive: 0xffe2c4, emissiveMap: conc, emissiveIntensity: 0.08 }),
      timber: new THREE.MeshStandardMaterial({ map: timber, roughness: 0.85, color: 0x9a8272 }),
      roof: new THREE.MeshStandardMaterial({ color: 0x1b1714, roughness: 1 }),
      black: new THREE.MeshStandardMaterial({ color: 0x141312, roughness: 0.8 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x3b3a39, roughness: 0.45, metalness: 0.7 }),
      fabricOut: new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: 0.95, bumpMap: fabricN, bumpScale: 0.3, side: THREE.DoubleSide }),
      plinth: new THREE.MeshStandardMaterial({ color: 0x24211f, roughness: 0.7 }),
      panel: new THREE.MeshStandardMaterial({ color: 0x2e2a27, roughness: 0.6 }),
      tooth: new THREE.MeshPhysicalMaterial({ color: 0xe8dfca, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: new THREE.Color(0xfff4e0) }),
      gum: new THREE.MeshPhysicalMaterial({ color: 0xa65a58, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
      tongue: new THREE.MeshPhysicalMaterial({ color: 0xb06e69, roughness: 0.55, bumpMap: papillae, bumpScale: 1.2, clearcoat: 0.35, clearcoatRoughness: 0.5 }),
      muscle: new THREE.MeshPhysicalMaterial({ color: 0x7a2621, roughness: 0.4, clearcoat: 0.45, clearcoatRoughness: 0.35, vertexColors: true }),
      artery: new THREE.MeshPhysicalMaterial({ color: 0x9a3a30, roughness: 0.4, clearcoat: 0.4 }),
      vein: new THREE.MeshPhysicalMaterial({ color: 0x51404f, roughness: 0.45, clearcoat: 0.35 }),
      resin: new THREE.MeshStandardMaterial({ color: 0xe4ddd0, roughness: 0.78 }),
      neuron: new THREE.MeshPhysicalMaterial({ color: 0xcfc3ae, roughness: 0.5, clearcoat: 0.3 }),
      myelin: new THREE.MeshPhysicalMaterial({ color: 0xe6dccb, roughness: 0.35, clearcoat: 0.5, transparent: true, opacity: 0.92 }),
      node: new THREE.MeshStandardMaterial({ color: 0x8c7b66, roughness: 0.5, emissive: 0xffc98a, emissiveIntensity: 0 }),
      tape: new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: 0.7 }),
      mat: new THREE.MeshStandardMaterial({ color: 0x2c2b2d, roughness: 0.95 }),
      chair: new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.7 }),
      screenOff: new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.2, metalness: 0.3 }),
      soft: new THREE.MeshStandardMaterial({ color: 0x6b5d50, roughness: 0.95 }),
      curtain: new THREE.MeshStandardMaterial({ color: 0x3d302b, roughness: 1, side: THREE.DoubleSide }),
      lamp: new THREE.MeshStandardMaterial({ color: 0xf2dcb4, emissive: 0xf2c98a, emissiveIntensity: 0.9 }),
      exitSign: new THREE.MeshStandardMaterial({ color: 0x1f7a3a, emissive: 0x1f9a45, emissiveIntensity: 1.2 }),
      beam: new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      projector: new THREE.MeshStandardMaterial({ color: 0x2b2b2c, roughness: 0.5, metalness: 0.2 }),
      lens: new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.1, emissive: 0xfff0d0, emissiveIntensity: 0.6 }),
      speaker: new THREE.MeshStandardMaterial({ color: 0x19191a, roughness: 0.6 }),
      rail: new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.35, metalness: 0.6 }),
      guide: new THREE.MeshStandardMaterial({ color: 0x4d4640, roughness: 0.8 }),
      guideLight: new THREE.MeshStandardMaterial({ color: 0xe8d2a8, emissive: 0xe8c890, emissiveIntensity: 0.8 }),
      headset: new THREE.MeshStandardMaterial({ color: 0xe9e9e6, roughness: 0.45 }),
      cable: new THREE.LineBasicMaterial({ color: 0x5a5550 })
    };
    return MAT;
  }

  function boxUV(geo, sx, sy, sz, tile) {
    // scale BoxGeometry face UVs to world size so brick courses stay consistent
    const uv = geo.attributes.uv; const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / tile[0], uv.getY(k) * dims[f][1] / tile[1]); }
    uv.needsUpdate = true; return geo;
  }
  function box(w, h, d, mat, x, y, z, tile) {
    const g = new THREE.BoxGeometry(w, h, d); if (tile) boxUV(g, w, h, d, tile);
    const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); return m;
  }

  // ---------- walls ----------
  // A straight wall along `dir` ('x' or 'z') with rectangular openings.
  function wall(group, dir, fixed, a0, a1, h, t, openings, mat) {
    const ops = openings.filter(o => o.c + o.w / 2 > a0 && o.c - o.w / 2 < a1).sort((p, q) => p.c - q.c);
    let cur = a0;
    const seg = (s0, s1, y0, y1) => {
      if (s1 - s0 < 0.01 || y1 - y0 < 0.01) return;
      const len = s1 - s0, mid = (s0 + s1) / 2, hh = y1 - y0;
      const m = dir === 'x' ? box(len, hh, t, mat, mid, y0 + hh / 2, fixed, [0.92, 0.6]) : box(t, hh, len, mat, fixed, y0 + hh / 2, mid, [0.92, 0.6]);
      group.add(m);
    };
    ops.forEach(o => {
      const s = Math.max(a0, o.c - o.w / 2), e = Math.min(a1, o.c + o.w / 2);
      seg(cur, s, 0, h); seg(s, e, Math.min(o.h, h), h); cur = e;
    });
    seg(cur, a1, 0, h);
  }

  // ---------- geometry builders ----------
  function archGeo(len, r, cy, segU, segA, halfWidthScale) {
    // arch-shaped tunnel surface lying along +x, floor at y=0; open underneath
    const a0 = cy < r ? Math.asin(Math.max(-1, Math.min(1, -cy / r))) : -Math.PI / 2 + 0.2;
    const aStart = a0, aEnd = Math.PI - a0;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= segU; i++) for (let j = 0; j <= segA; j++) {
      const a = aStart + (aEnd - aStart) * j / segA;
      pos.push(len * i / segU, cy + r * Math.sin(a), r * Math.cos(a) * (halfWidthScale || 1));
      uv.push(i / segU, j / segA);
    }
    for (let i = 0; i < segU; i++) for (let j = 0; j < segA; j++) {
      const a = i * (segA + 1) + j, b = a + segA + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  function displace(geo, amp, freq, seed) {
    const p = geo.attributes.position, n = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const d = (vnoise(x * freq + seed, y * freq, z * freq) - 0.5) * 2 * amp;
      p.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d);
    }
    p.needsUpdate = true; geo.computeVertexNormals(); return geo;
  }
  function toothGeo(seed) {
    const pts = [];
    const prof = [[0.0, 0.0], [0.12, 0.02], [0.2, 0.2], [0.24, 0.4], [0.3, 0.52], [0.36, 0.62], [0.38, 0.74], [0.37, 0.84], [0.33, 0.92], [0.22, 0.97], [0.0, 0.95]];
    prof.forEach(([r, y]) => pts.push(new THREE.Vector2(r, y)));
    const g = new THREE.LatheGeometry(pts, 40);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(z, x);
      if (y > 0.6) { const k = (y - 0.6) / 0.4; x *= 1 + 0.12 * Math.cos(2 * a) * k; z *= 1 - 0.06 * k; }
      if (y > 0.82) { const cusp = Math.pow(0.5 + 0.5 * Math.cos(4 * a + seed), 2); const rr = Math.hypot(x, z); y += 0.07 * cusp * Math.min(1, rr / 0.25) - 0.03; }
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return displace(g, 0.006, 9, seed);
  }
  function tube(points, r, mat, seg) {
    const c = new THREE.CatmullRomCurve3(points.map(p => V3(p[0], p[1], p[2])));
    return new THREE.Mesh(new THREE.TubeGeometry(c, seg || 40, r, 12, false), mat);
  }

  // Provisional anatomical heart built from primitives (height ≈ 1 unit).
  function heartGroup(mode) {
    const Mt = materials(); const g = new THREE.Group();
    const single = mode === 'printed' ? Mt.resin : null;
    const blob = (r, s, taper, pos, rotZ, seed) => {
      const geo = new THREE.SphereGeometry(r, 48, 36); const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i) * s[0], y = p.getY(i) * s[1], z = p.getZ(i) * s[2];
        if (taper && y < 0) { const k = 1 + (y / (r * s[1])) * taper; x *= k; z *= k; }
        p.setXYZ(i, x, y, z);
      }
      geo.computeVertexNormals(); displace(geo, 0.008, 7, seed);
      // subtle epicardial fat tone in grooves (vertex colours)
      const col = []; for (let i = 0; i < p.count; i++) { const n = vnoise(p.getX(i) * 6 + seed, p.getY(i) * 6, p.getZ(i) * 6); const fat = Math.max(0, n - 0.62) * 2.2; col.push(1 + fat * 0.9, 1 + fat * 1.6, 1 + fat * 0.9); }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col.map(v => Math.min(v, 2.2) / 2.2 * 1.6), 3));
      const m = new THREE.Mesh(geo, single || Mt.muscle); m.position.set(...pos); m.rotation.z = rotZ || 0; g.add(m); return m;
    };
    blob(0.3, [1, 1.38, 0.95], 0.55, [0.0, 0.36, 0], 0.35, 1);          // left ventricle
    blob(0.27, [1.05, 1.1, 0.82], 0.35, [0.14, 0.42, 0.12], 0.2, 2);   // right ventricle
    blob(0.18, [1, 0.95, 1], 0, [0.27, 0.69, 0.0], 0, 3);             // right atrium
    blob(0.16, [1.1, 0.85, 1], 0, [-0.13, 0.7, -0.14], 0, 4);          // left atrium
    const art = single || Mt.artery, vein = single || Mt.vein;
    g.add(tube([[-0.02, 0.6, 0.02], [0.0, 0.88, 0.03], [-0.08, 1.02, -0.05], [-0.22, 0.99, -0.12], [-0.27, 0.82, -0.17], [-0.28, 0.62, -0.2]], 0.075, art));
    [[-0.03, 0.99, -0.01], [-0.1, 1.03, -0.06], [-0.17, 1.02, -0.1]].forEach(p => g.add(tube([p, [p[0], p[1] + 0.14, p[2]]], 0.026, art, 6)));
    g.add(tube([[0.1, 0.6, 0.18], [0.06, 0.82, 0.15], [-0.02, 0.9, 0.05]], 0.07, vein));
    g.add(tube([[-0.02, 0.9, 0.05], [-0.16, 0.9, 0.02], [-0.26, 0.86, -0.02]], 0.045, vein));
    g.add(tube([[-0.02, 0.9, 0.05], [0.1, 0.93, -0.04], [0.2, 0.9, -0.12]], 0.045, vein));
    g.add(tube([[0.3, 0.76, 0.0], [0.31, 0.92, -0.02], [0.3, 1.04, -0.03]], 0.055, vein));
    g.add(tube([[0.3, 0.58, -0.05], [0.33, 0.44, -0.08], [0.33, 0.32, -0.1]], 0.06, vein));
    g.add(tube([[0.06, 0.64, 0.22], [0.04, 0.46, 0.29], [-0.03, 0.26, 0.25], [-0.1, 0.1, 0.14]], 0.013, art, 30));
    g.add(tube([[0.2, 0.62, 0.16], [0.28, 0.48, 0.14], [0.3, 0.3, 0.08]], 0.012, art, 30));
    g.add(tube([[-0.06, 0.66, 0.2], [-0.2, 0.52, 0.12], [-0.28, 0.34, 0.0]], 0.012, art, 30));
    g.add(tube([[0.1, 0.5, 0.27], [0.12, 0.34, 0.25], [0.06, 0.16, 0.2]], 0.01, vein, 30));
    return g;
  }

  function figure(R, opts) {
    // scale figure: simplified mannequin (not a character) for reading size
    const g = new THREE.Group();
    const skin = [0x8d5a3b, 0xc69c7b, 0xe0b89a, 0x5a3a28, 0xa7785a][Math.floor(R() * 5)];
    const cloth = [0x4f4a45, 0x3f4a52, 0x6b5a48, 0x4a3f3a, 0x5d6660, 0x6e6259, 0x2f3337][Math.floor(R() * 7)];
    const cm = new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.9 });
    const sm = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
    const hgt = opts.child ? 1.2 : (1.58 + R() * 0.28);
    if (opts.wheelchair) {
      const wheelM = materials().steel;
      [-0.3, 0.3].forEach(s => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 24), wheelM); w.position.set(0, 0.3, s); g.add(w); });
      g.add(box(0.46, 0.06, 0.46, wheelM, 0, 0.5, 0));
      g.add(box(0.06, 0.45, 0.46, wheelM, -0.22, 0.75, 0));
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 4, 10), cm); torso.position.set(-0.05, 0.92, 0); g.add(torso);
      const legs = box(0.42, 0.14, 0.34, cm, 0.16, 0.6, 0); g.add(legs);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), sm); head.position.set(-0.04, 1.33, 0); g.add(head);
      g.userData.eye = 1.25;
      return g;
    }
    if (opts.seated) {
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 4, 10), cm); torso.position.set(0, 0.85, 0); g.add(torso);
      g.add(box(0.44, 0.14, 0.34, cm, 0.2, 0.52, 0));
      g.add(box(0.12, 0.46, 0.3, cm, 0.4, 0.25, 0));
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), sm); head.position.set(0, 1.26, 0); g.add(head);
      if (opts.headset) g.add(box(0.1, 0.1, 0.19, materials().headset, 0.1, 1.27, 0));
      return g;
    }
    const s = hgt / 1.72;
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.1 * s, 0.82 * s, 10), cm); legs.position.y = 0.41 * s; g.add(legs);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18 * s, 0.36 * s, 4, 10), cm); torso.position.y = 1.12 * s; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11 * s, 16, 12), sm); head.position.y = 1.6 * s; g.add(head);
    if (opts.headset) g.add(box(0.1, 0.1, 0.19, materials().headset, 0.1, 1.61 * s, 0));
    return g;
  }

  // ---------- per-room projection canvases ----------
  function projCanvas(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#120d0b'; ctx.fillRect(0, 0, w, h);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping;
    return { c, ctx, tex, w, h };
  }
  function projMat(pc, dim) {
    return new THREE.MeshBasicMaterial({ map: pc.tex, color: new THREE.Color(dim, dim, dim), toneMapped: false, side: THREE.DoubleSide });
  }

  // ---------- room construction ----------
  function buildRoom(Rl) {
    const Mt = materials(), cfg = Rl.cfg, id = Rl.id;
    const obj = { id, R: Rl, group: new THREE.Group(), local: new THREE.Group(), roof: new THREE.Group(), els: {}, proj: [], anims: [], hot: [], lights: [] };
    const G = obj.group; G.userData.room = id;
    const w = Rl.w, d = Rl.d, h = Rl.h, s = cfg.modelScale;
    const on = k => !!cfg.elements[k];
    // local frame: u along the visitor route, v across; row 1 rooms are rotated 180°
    const Lg = obj.local; G.add(Lg);
    if (Rl.row === 0) Lg.position.set(Rl.x0, 0, Rl.z0);
    else { Lg.position.set(Rl.x1, 0, Rl.z1); Lg.rotation.y = Math.PI; }
    const toLocal = (x, z) => Rl.row === 0 ? [x - Rl.x0, z - Rl.z0] : [Rl.x1 - x, Rl.z1 - z];
    obj.toLocal = toLocal;
    const doorsL = [Rl.entry, Rl.exit].filter(Boolean).map(dr => { const [u, v] = toLocal(dr.x, dr.z); return { u, v, w: dr.w }; });
    obj.doorsL = doorsL;
    const nearDoor = (u, v, r) => doorsL.some(dr => Math.hypot(dr.u - u, dr.v - v) < dr.w / 2 + r);
    const elG = (k) => { const g = new THREE.Group(); g.userData.el = k; g.visible = on(k); Lg.add(g); obj.els[k] = g; return g; };
    const tag = (mesh, k) => { mesh.traverse(o => { if (o.isMesh) o.userData.el = k; }); return mesh; };
    const hot = (k, u, y, v) => obj.hot.push({ room: id, el: k, local: V3(u, y, v) });

    // floor
    const fg = new THREE.PlaneGeometry(w, d); fg.rotateX(-Math.PI / 2);
    const uvA = fg.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * w / 4, uvA.getY(i) * d / 4);
    const floor = new THREE.Mesh(fg, Mt.floor); floor.position.set(Rl.cx, 0, Rl.cz); G.add(floor);

    // walls, outside the room rectangle (0.2 m) so neighbours meet in the partition gap
    const t = 0.2;
    const ops = { N: [], S: [], E: [], Wd: [] };
    [Rl.entry, Rl.exit].filter(Boolean).forEach(dr => {
      if (dr.axis === 'x') { if (Math.abs(dr.x - Rl.x0) < 0.6) ops.Wd.push({ c: dr.z, w: dr.w, h: dr.h }); else ops.E.push({ c: dr.z, w: dr.w, h: dr.h }); }
      else { if (Math.abs(dr.z - Rl.z0) < 0.6) ops.N.push({ c: dr.x, w: dr.w, h: dr.h }); else ops.S.push({ c: dr.x, w: dr.w, h: dr.h }); }
    });
    const WG = new THREE.Group(); G.add(WG); obj.walls = WG;
    wall(WG, 'x', Rl.z0 - t / 2, Rl.x0 - t, Rl.x1 + t, h, t, ops.N, Mt.brick);
    wall(WG, 'x', Rl.z1 + t / 2, Rl.x0 - t, Rl.x1 + t, h, t, ops.S, Mt.brick);
    wall(WG, 'z', Rl.x0 - t / 2, Rl.z0, Rl.z1, h, t, ops.Wd, Mt.brick);
    wall(WG, 'z', Rl.x1 + t / 2, Rl.z0, Rl.z1, h, t, ops.E, Mt.brick);
    // exit signage over outward doors
    [Rl.entry, Rl.exit].filter(dr => dr && dr.kind === 'exit').forEach(dr => { const sgn = box(0.12, 0.2, 0.4, Mt.exitSign, dr.x + (dr.x > Rl.cx ? -0.2 : 0.2), dr.h + 0.3, dr.z); G.add(sgn); });

    // roof: timber trusses with pitched boards (the stables character)
    const R = obj.roof; G.add(R);
    const rise = Math.min(1.8, d * 0.16);
    for (let x = Rl.x0 + 1.5; x < Rl.x1 - 0.5; x += 3.2) {
      R.add(box(0.16, 0.24, d, Mt.timber, x, h - 0.12, Rl.cz));
      const kp = box(0.14, rise, 0.14, Mt.timber, x, h + rise / 2, Rl.cz); R.add(kp);
      [-1, 1].forEach(sd => {
        const len = Math.hypot(d / 2, rise);
        const raft = box(0.14, 0.2, len, Mt.timber, x, h + rise / 2, Rl.cz + sd * d / 4);
        raft.rotation.x = sd * Math.atan2(rise, d / 2); R.add(raft);
      });
    }
    [-1, 1].forEach(sd => {
      const len = Math.hypot(d / 2, rise) + 0.3;
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.4, len), Mt.roof);
      pl.position.set(Rl.cx, h + rise / 2 + 0.12, Rl.cz + sd * d / 4);
      pl.rotation.x = -Math.PI / 2 - sd * Math.atan2(rise, d / 2);
      Mt.roof.side = THREE.DoubleSide; R.add(pl);
    });
    [Rl.x0 - t / 2, Rl.x1 + t / 2].forEach(x => { // brick gables
      const sh = new THREE.Shape(); sh.moveTo(-d / 2 - t, 0); sh.lineTo(d / 2 + t, 0); sh.lineTo(0, rise + 0.1); sh.closePath();
      const gg = new THREE.ShapeGeometry(sh); const m = new THREE.Mesh(gg, Mt.brick); m.material = Mt.brick;
      const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 0.92, uv.getY(i) / 0.6);
      m.position.set(x, h, Rl.cz); m.rotation.y = Math.PI / 2; R.add(m);
    });

    // lighting: a warm key light on the hero installation and a low wash
    const lf = cfg.light / 100;
    const key = new THREE.SpotLight(0xffe2bd, 60 + 520 * lf, 0, Math.PI / 5, 0.6, 1.6);
    obj.lights.push(key);
    Lg.add(key); Lg.add(key.target);

    // ---- projection walls ----
    const wallProjOn = { entrance: on('ent_proj_main'), mouth: on('mouth_proj_walls'), digestive: on('dig_proj_peristalsis') || on('dig_proj_stomach'), heart: on('heart_proj_flow'), cellular: on('cell_proj_surround'), signals: on('sig_proj_membrane'), vr: false }[id];
    const wallKey = { entrance: 'ent_proj_main', mouth: 'mouth_proj_walls', digestive: 'dig_proj_peristalsis', heart: 'heart_proj_flow', cellular: 'cell_proj_surround', signals: 'sig_proj_membrane' }[id];
    const surround = id === 'cellular' || id === 'entrance';
    const pc = projCanvas(surround ? 1024 : 768, 256); obj.pc = pc; obj.proj.push({ pc, surface: 'wall' });
    const projTargets = [];
    if (wallKey) {
      const g = elG(wallKey); g.visible = wallProjOn;
      const cov = id === 'entrance' ? Math.max(cfg.coverage, 0) : cfg.coverage;
      const y0 = 0.35, y1 = Math.min(h - 0.5, 4.8);
      // walls in local frame: v=0 (far side), u=w, v=d, u=0 ; list available spans minus doors
      const sides = [
        { a: [0, 0], b: [w, 0], n: [0, 1] }, { a: [w, 0], b: [w, d], n: [-1, 0] },
        { a: [w, d], b: [0, d], n: [0, -1] }, { a: [0, d], b: [0, 0], n: [1, 0] }
      ];
      const per = 2 * (w + d); let acc = 0;
      sides.forEach((sd, si) => {
        const len = Math.hypot(sd.b[0] - sd.a[0], sd.b[1] - sd.a[1]);
        const dir = [(sd.b[0] - sd.a[0]) / len, (sd.b[1] - sd.a[1]) / len];
        // blocked intervals along this side
        const blocked = doorsL.filter(dr => Math.abs((dr.u - sd.a[0]) * sd.n[0] + (dr.v - sd.a[1]) * sd.n[1]) < 0.7)
          .map(dr => { const s0 = (dr.u - sd.a[0]) * dir[0] + (dr.v - sd.a[1]) * dir[1]; return [s0 - dr.w / 2 - 0.5, s0 + dr.w / 2 + 0.5]; });
        let spans = [[0.4, len - 0.4]];
        blocked.forEach(([b0, b1]) => { spans = spans.flatMap(([s0, s1]) => (b1 <= s0 || b0 >= s1) ? [[s0, s1]] : [[s0, b0], [b1, s1]].filter(q => q[1] - q[0] > 0.8)); });
        let frac = cov / 100;
        if (id === 'entrance') frac = si === 0 ? Math.max(0.9, frac) : frac * 0.8;
        if (id === 'digestive' && si === 2 && on('dig_microbiome')) frac = 0; // microbiome wall has its own surface
        if (id === 'vr') frac = 0;
        spans.forEach(([s0, s1]) => {
          const L0 = s1 - s0, use = L0 * frac; if (use < 0.6) return;
          const m0 = s0 + (L0 - use) / 2;
          const pg = new THREE.PlaneGeometry(use, y1 - y0);
          const u0 = (acc + m0) / per * (surround ? 1 : 2.4), u1 = (acc + m0 + use) / per * (surround ? 1 : 2.4);
          const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * (u1 - u0));
          const mesh = new THREE.Mesh(pg, projMat(pc, 0.92));
          const cu = sd.a[0] + dir[0] * (m0 + use / 2) + sd.n[0] * 0.03, cv = sd.a[1] + dir[1] * (m0 + use / 2) + sd.n[1] * 0.03;
          mesh.position.set(cu, (y0 + y1) / 2, cv);
          mesh.rotation.y = Math.atan2(sd.n[0], sd.n[1]);
          g.add(tag(mesh, wallKey));
          projTargets.push({ g, c: V3(cu, (y0 + y1) / 2, cv), n: sd.n, w: use, h: y1 - y0, el: wallKey });
        });
        acc += len;
      });
      if (projTargets.length) { const p0 = projTargets[0]; hot(wallKey, p0.c.x, p0.c.y + 0.6, p0.c.z); }
    }

    // ---- room-specific installations ----
    const keep = []; // keep-out rects for visitors [u0,v0,u1,v1]
    let hero = V3(w / 2, 1.4, d / 2), eye = { p: [w * 0.5, d * 0.75], look: V3(w / 2, 1.6, d / 2), y: 1.6 };

    if (id === 'entrance') {
      hero = V3(w / 2, 2.6, 0.5);
      eye = { p: [w * 0.5, d * 0.72], look: V3(w * 0.5, 2.3, 0), y: 1.6 };
      const gp = elG('ent_intro_panel');
      const panelTex = canvasTex(512, 640, (c, W_, H_) => {
        c.fillStyle = '#231d19'; c.fillRect(0, 0, W_, H_);
        c.fillStyle = '#efe6d6'; c.font = '600 48px Fraunces, Georgia, serif'; c.fillText('The Universe', 40, 110); c.fillText('Within', 40, 170);
        c.font = '26px "IBM Plex Sans", sans-serif'; c.fillStyle = '#cdbfae';
        ['A journey inside the human body,', 'from organs to molecules.', '', 'Large print · Audio · Captions', 'Auslan video via QR code', 'Tactile map below'].forEach((l, i) => c.fillText(l, 40, 240 + i * 38));
        c.strokeStyle = '#8f7f6d'; c.lineWidth = 3; c.strokeRect(40, 480, 432, 120);
        c.fillStyle = '#8f7f6d'; for (let i = 0; i < 7; i++) c.fillRect(60 + i * 58, 520 + (i % 2) * 30, 40, 26);
      });
      const pnl = box(1.3, 1.9, 0.08, new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.8 }), 0, 1.35, 0);
      const pgp = new THREE.Group(); pgp.add(pnl); pgp.add(box(0.1, 0.4, 0.1, Mt.steel, 0, 0.2, 0));
      pgp.position.set(2.2, 0, d - 1.6); pgp.rotation.y = Math.PI * 0.85; gp.add(tag(pgp, 'ent_intro_panel'));
      hot('ent_intro_panel', 2.2, 2.5, d - 1.6); keep.push([1.4, d - 2.4, 3, d - 0.8]);
      const gc = elG('ent_route_choice');
      [[-0.8, 'Guided'], [0.8, 'Free']].forEach(([o, lab], i) => {
        const tx = canvasTex(256, 160, (c) => { c.fillStyle = '#1b1715'; c.fillRect(0, 0, 256, 160); c.fillStyle = i ? '#9db48a' : '#d9a45b'; c.fillRect(0, 150, 256, 10); c.fillStyle = '#efe6d6'; c.font = '600 44px "IBM Plex Sans", sans-serif'; c.fillText(lab, 30, 90); });
        const post = new THREE.Group();
        post.add(box(0.12, 1.1, 0.12, Mt.steel, 0, 0.55, 0));
        post.add(box(0.6, 0.38, 0.05, new THREE.MeshStandardMaterial({ map: tx, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.5 }), 0, 1.25, 0));
        post.position.set(w - 3, 0, d / 2 + o); post.rotation.y = -Math.PI / 2; gc.add(tag(post, 'ent_route_choice'));
      });
      hot('ent_route_choice', w - 3, 1.9, d / 2); keep.push([w - 3.5, d / 2 - 1.3, w - 2.5, d / 2 + 1.3]);
      const gf = elG('ent_proj_floor');
      const fpc = projCanvas(512, 128); obj.proj.push({ pc: fpc, surface: 'floor' });
      const route = new THREE.Mesh(new THREE.PlaneGeometry(w - 1, 1.6), projMat(fpc, 0.55)); route.rotation.x = -Math.PI / 2;
      route.position.set(w / 2, 0.012, d * 0.62); gf.add(tag(route, 'ent_proj_floor')); hot('ent_proj_floor', w * 0.35, 0.3, d * 0.62);
      const gs = elG('ent_sound');
      [[0.5, 0.5], [w - 0.5, 0.5]].forEach(([u, v]) => gs.add(tag(box(0.35, 0.5, 0.3, Mt.speaker, u, h - 1.2, v + 0.2), 'ent_sound')));
      hot('ent_sound', w - 0.6, h - 0.8, 0.7);
      key.position.set(w / 2, h - 0.3, d * 0.7); key.target.position.set(2.2, 1, d - 1.6);
    }

    if (id === 'mouth') {
      hero = V3(w * 0.55, 1.2, d / 2);
      eye = { p: [1.6, d / 2], look: V3(w, 1.4, d / 2), y: 1.6 };
      const gt = elG('mouth_teeth');
      const n = cfg.opts.teeth || 8, perSide = Math.ceil(n / 2);
      const th = 1.45 * s;
      for (let side = 0; side < 2; side++) {
        const v = side ? d - 1.3 * s - 0.3 : 1.3 * s + 0.3;
        const gumPts = [];
        const cnt = side ? n - perSide : perSide;
        for (let i = 0; i < cnt; i++) {
          const u = 2.2 + (w - 4.6) * (cnt === 1 ? 0.5 : i / (cnt - 1));
          if (nearDoor(u, v, 1.4)) continue;
          const vv = v + (side ? -1 : 1) * Math.sin(Math.PI * i / Math.max(1, cnt - 1)) * 0.5;
          const tm = new THREE.Mesh(toothGeo(i + side * 7), Mt.tooth);
          tm.scale.set(th * 1.1, th, th); tm.position.set(u, -0.35 * s, vv); tm.rotation.y = i * 0.7;
          gt.add(tag(tm, 'mouth_teeth')); gumPts.push([u, 0.12, vv]);
          keep.push([u - 0.6 * s, vv - 0.6 * s, u + 0.6 * s, vv + 0.6 * s]);
        }
        if (gumPts.length > 1) { const gm = tube(gumPts, 0.38 * s, Mt.gum, 60); gm.scale.y = 0.6; gt.add(tag(gm, 'mouth_teeth')); }
        else if (gumPts.length === 1) gt.add(tag(box(1.4 * s, 0.3, 1.2 * s, Mt.gum, gumPts[0][0], 0.1, gumPts[0][2]), 'mouth_teeth'));
      }
      hot('mouth_teeth', w * 0.35, th * 0.95, 1.3 * s + 0.3);
      const gtg = elG('mouth_tongue');
      const tw = Math.min(w * 0.55, 8) * s, td = Math.min(d * 0.36, 4) * s;
      const tg = new THREE.PlaneGeometry(tw, td, 60, 36); tg.rotateX(-Math.PI / 2);
      const p = tg.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) / (tw / 2), z = p.getZ(i) / (td / 2);
        const dome = Math.max(0, 1 - x * x) * Math.max(0, 1 - z * z);
        const groove = Math.exp(-z * z * 30) * 0.25;
        p.setY(i, 0.42 * s * Math.pow(dome, 0.6) * (1 - groove));
      }
      tg.computeVertexNormals();
      const uvT = tg.attributes.uv; for (let i = 0; i < uvT.count; i++) uvT.setXY(i, uvT.getX(i) * 6, uvT.getY(i) * 4);
      const tm = new THREE.Mesh(tg, Mt.tongue); tm.position.set(w * 0.52, 0.01, d / 2); gtg.add(tag(tm, 'mouth_tongue'));
      hot('mouth_tongue', w * 0.52, 0.8, d / 2); keep.push([w * 0.52 - tw / 2, d / 2 - td / 2, w * 0.52 + tw / 2, d / 2 + td / 2]);
      const gpal = elG('mouth_palate');
      const pr = d * 0.46, pcy = h - 0.7 - pr * 0.55;
      const ceilPc = projCanvas(512, 256); obj.proj.push({ pc: ceilPc, surface: 'ceiling', el: 'mouth_proj_walls' });
      const aIn = new THREE.Mesh(archGeo(w - 3, pr, 0, 24, 24), on('mouth_proj_walls') ? projMat(ceilPc, 0.7) : Mt.fabricOut);
      aIn.scale.set(1, 0.55, 1); aIn.position.set(1.5, pcy, d / 2);
      const aOut = new THREE.Mesh(archGeo(w - 3, pr + 0.08, 0, 24, 24), Mt.fabricOut); aOut.scale.set(1, 0.55, 1); aOut.position.copy(aIn.position);
      // clip arch to the upper part only (keep canopy above 3.4 m)
      [aIn, aOut].forEach(m => { const pp = m.geometry.attributes.position; for (let i = 0; i < pp.count; i++) { const yy = pp.getY(i); if (yy < pr * 0.35) pp.setY(i, pr * 0.35); } pp.needsUpdate = true; m.geometry.computeVertexNormals(); });
      gpal.add(tag(aIn, 'mouth_palate')); gpal.add(tag(aOut, 'mouth_palate'));
      for (let u = 1.5; u <= w - 1.5; u += 2.5) { const rib = new THREE.Mesh(new THREE.TorusGeometry(pr + 0.1, 0.035, 6, 40, Math.PI * 0.78), Mt.steel); rib.rotation.y = Math.PI / 2; rib.rotation.z = Math.PI * 0.11; rib.scale.set(1, 0.55, 1); rib.position.set(u, pcy, d / 2); gpal.add(tag(rib, 'mouth_palate')); }
      hot('mouth_palate', w / 2, Math.min(h - 1, pcy + pr * 0.5), d / 2);
      const gch = elG('mouth_choice');
      const pl = new THREE.Group(); pl.add(box(0.9, 1.0, 0.55, Mt.plinth, 0, 0.5, 0));
      const bw = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 24), new THREE.MeshStandardMaterial({ color: 0x9fb0b8, emissive: 0x6f8a96, emissiveIntensity: cfg.opts.mouthVariant === 'water' ? 0.8 : 0.1 }));
      bw.position.set(-0.2, 1.03, 0); bw.userData.action = 'mouth:water'; pl.add(bw);
      const bs = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 24), new THREE.MeshStandardMaterial({ color: 0xb98a45, emissive: 0x9a6a2a, emissiveIntensity: cfg.opts.mouthVariant === 'sugar' ? 0.8 : 0.1 }));
      bs.position.set(0.2, 1.03, 0); bs.userData.action = 'mouth:sugar'; pl.add(bs);
      pl.position.set(w - 2.2, 0, d / 2 + 2.2 * Math.min(1, d / 10)); pl.rotation.y = -Math.PI / 2; gch.add(tag(pl, 'mouth_choice'));
      hot('mouth_choice', w - 2.2, 1.6, d / 2 + 2.2 * Math.min(1, d / 10)); keep.push([w - 2.8, d / 2 + 1.4, w - 1.6, d / 2 + 3]);
      key.position.set(w * 0.5, h - 0.4, d / 2); key.target.position.set(w * 0.5, 0, d / 2);
    }

    if (id === 'digestive') {
      const ent = doorsL[0] || { u: 0, v: d / 2 };
      const vt = ent.u < 0.8 ? Math.min(d - 4, Math.max(2.2, ent.v)) : Math.min(d * 0.34, 3.4), tr = 1.55, tcy = 1.05, tLen = w * 0.55 - 2.2;
      const R0 = Math.min(3, d * 0.3) * s;
      hero = V3(2.4, 1.5, vt);
      eye = { p: [2.2 + tLen * 0.3, vt], look: V3(w, 1.5, vt), y: 1.6 };
      const go = elG('dig_oesophagus'), gpp = elG('dig_proj_peristalsis');
      const tpc = projCanvas(512, 256); obj.proj.push({ pc: tpc, surface: 'wall', el: 'dig_proj_peristalsis' });
      if (on('dig_oesophagus')) {
        const inner = new THREE.Mesh(archGeo(tLen, tr, tcy, 30, 20), on('dig_proj_peristalsis') ? projMat(tpc, 0.9) : Mt.fabricOut);
        inner.position.set(2.2, 0, vt); go.add(tag(inner, on('dig_proj_peristalsis') ? 'dig_proj_peristalsis' : 'dig_oesophagus'));
        const outer = new THREE.Mesh(archGeo(tLen, tr + 0.07, tcy, 30, 20), Mt.fabricOut); outer.position.set(2.2, 0, vt); go.add(tag(outer, 'dig_oesophagus'));
        const a0 = Math.asin(-tcy / tr);
        for (let u = 2.2; u <= 2.2 + tLen + 0.01; u += 1.1) { const rib = new THREE.Mesh(new THREE.TorusGeometry(tr + 0.1, 0.045, 6, 32, Math.PI - 2 * a0), Mt.steel); rib.rotation.y = Math.PI / 2; rib.rotation.z = a0; rib.position.set(u, tcy, vt); go.add(tag(rib, 'dig_oesophagus')); }
        keep.push([2.2, vt - tr - 0.2, 2.2 + tLen, vt + tr + 0.2]);
      }
      hot('dig_oesophagus', 2.6, 3.0, vt); if (on('dig_oesophagus')) hot('dig_proj_peristalsis', 2.2 + tLen * 0.6, 1.7, vt);
      const gst = elG('dig_stomach');
      const spc = projCanvas(512, 256); obj.proj.push({ pc: spc, surface: 'wall', el: 'dig_proj_stomach' });
      const sc = [2.2 + tLen + R0 * 0.75, vt];
      if (on('dig_stomach')) {
        const sin = new THREE.Mesh(new THREE.SphereGeometry(R0, 48, 32, Math.PI * 0.3, Math.PI * 1.4, 0, Math.PI * 0.62), on('dig_proj_stomach') ? projMat(spc, 0.9) : Mt.fabricOut);
        sin.scale.set(1, 0.85, 1); sin.position.set(sc[0], R0 * 0.25, sc[1]); sin.rotation.y = Math.PI / 2 + Math.PI;
        const sout = new THREE.Mesh(new THREE.SphereGeometry(R0 + 0.08, 48, 32, Math.PI * 0.3, Math.PI * 1.4, 0, Math.PI * 0.62), Mt.fabricOut);
        sout.scale.copy(sin.scale); sout.position.copy(sin.position); sout.rotation.copy(sin.rotation);
        gst.add(tag(sin, on('dig_proj_stomach') ? 'dig_proj_stomach' : 'dig_stomach')); gst.add(tag(sout, 'dig_stomach'));
        keep.push([sc[0] - R0, sc[1] - R0, sc[0] + R0, sc[1] + R0]);
        hot('dig_stomach', sc[0], R0 * 1.15, sc[1] - R0 * 0.6); if (on('dig_proj_stomach')) hot('dig_proj_stomach', sc[0] + R0 * 0.3, 1.8, sc[1]);
      }
      obj.els.dig_proj_stomach = gst; // stomach projection lives on the shell
      const gsf = elG('dig_stepfree');
      const sv = d - 1.5;
      const lane = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.6, 1.8), Mt.guide); lane.rotation.x = -Math.PI / 2; lane.position.set(w / 2, 0.01, sv); gsf.add(tag(lane, 'dig_stepfree'));
      for (let u = 0.8; u < w - 0.5; u += 1.4) { gsf.add(tag(box(0.3, 0.02, 0.06, Mt.guideLight, u, 0.02, sv - 0.95), 'dig_stepfree')); }
      const rail = tube([[0.5, 0.95, d - 0.45], [w - 0.5, 0.95, d - 0.45]], 0.025, Mt.rail, 4); gsf.add(tag(rail, 'dig_stepfree'));
      hot('dig_stepfree', w * 0.3, 1.1, sv);
      const gmb = elG('dig_microbiome');
      const mpc = projCanvas(512, 256); obj.proj.push({ pc: mpc, surface: 'wall', el: 'dig_microbiome', microbiome: true });
      const mw = w * 0.4, mplane = new THREE.Mesh(new THREE.PlaneGeometry(mw, Math.min(3.2, h - 1)), projMat(mpc, 0.9));
      mplane.position.set(w * 0.7, 0.4 + Math.min(3.2, h - 1) / 2, d - 0.03); mplane.rotation.y = Math.PI; gmb.add(tag(mplane, 'dig_microbiome'));
      hot('dig_microbiome', w * 0.7, 2.6, d - 0.4);
      const gsd = elG('dig_sound');
      for (let u = 1.2; u < w; u += Math.max(3, w / 5)) [0.25, d - 0.25].forEach(v => gsd.add(tag(box(0.3, 0.42, 0.26, Mt.speaker, u, Math.min(h - 0.8, 3.8), v), 'dig_sound')));
      hot('dig_sound', w * 0.5, Math.min(h - 0.5, 4.1), 0.4);
      key.position.set(w * 0.6, h - 0.3, d * 0.7); key.target.position.set(sc[0], 0.5, sc[1]);
    }

    if (id === 'heart') {
      const mode = cfg.opts.heartMode;
      const printed = mode === 'printed';
      const H = (printed ? 1.25 : 2.6) * s, baseY = printed ? 0.95 : 0.4;
      hero = V3(w / 2, baseY + H * 0.5, d / 2);
      eye = { p: [w * 0.5 - 1.2, Math.min(d - 1, d / 2 + Math.max(4.2, H * 1.9))], look: V3(w / 2, baseY + H * 0.55, d / 2), y: 1.6 };
      const gm = elG('heart_model');
      const pr_ = printed ? 0.7 : 1.7 * s;
      gm.add(tag(new THREE.Mesh(new THREE.CylinderGeometry(pr_, pr_ + 0.06, printed ? 0.9 : 0.4, 48), Mt.plinth).translateX(w / 2).translateY(printed ? 0.45 : 0.2).translateZ(d / 2), 'heart_model'));
      const hg = heartGroup(mode);
      if (mode === 'projection') {
        const hpc = projCanvas(512, 256); obj.proj.push({ pc: hpc, surface: 'wall', el: 'heart_model', heartSkin: true });
        const skin = new THREE.MeshStandardMaterial({ color: 0xd9d2c7, roughness: 0.7, emissive: 0xffffff, emissiveMap: hpc.tex, emissiveIntensity: 0.85 });
        hg.traverse(o => { if (o.isMesh) o.material = skin; });
      }
      hg.rotation.y = -0.5; hg.updateMatrixWorld(true);
      const bb0 = new THREE.Box3().setFromObject(hg); hg.scale.setScalar(H / (bb0.max.y - bb0.min.y)); hg.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(hg); const lift = printed ? 0.08 : 0.35;
      hg.position.set(w / 2 - (bb.min.x + bb.max.x) / 2, baseY + lift - bb.min.y, d / 2 - (bb.min.z + bb.max.z) / 2);
      gm.add(tag(hg, 'heart_model')); obj.heart = hg;
      gm.add(tag(new THREE.Mesh(new THREE.CylinderGeometry(0.05 * H / 2.6 + 0.02, 0.07, lift + 0.2, 12), Mt.steel).translateX(w / 2).translateY(baseY + (lift + 0.2) / 2).translateZ(d / 2), 'heart_model'));
      keep.push([w / 2 - pr_ - 0.5, d / 2 - pr_ - 0.5, w / 2 + pr_ + 0.5, d / 2 + pr_ + 0.5]);
      hot('heart_model', w / 2, baseY + H * 1.02, d / 2);
      // construction cutaway: armature revealed inside a ghosted shell
      const gc = elG('heart_construction');
      const arm = new THREE.Group(); arm.visible = cutaway;
      arm.add(box(0.12, H * 0.85, 0.12, Mt.steel, 0, H * 0.42, 0));
      [0.25, 0.5, 0.75].forEach(k => { const ring = new THREE.Mesh(new THREE.TorusGeometry(H * (0.22 - Math.abs(k - 0.5) * 0.18), 0.02, 6, 32), Mt.steel); ring.rotation.x = Math.PI / 2; ring.position.y = H * k; arm.add(ring); });
      arm.add(box(1.0, 0.04, 1.0, Mt.steel, 0, 0.02, 0));
      arm.position.set(w / 2, baseY, d / 2); gc.add(tag(arm, 'heart_construction')); obj.armature = arm;
      hot('heart_construction', w / 2 + (printed ? 0.8 : 1.9 * s), baseY + H * 0.3, d / 2 + 0.3);
      const gp = elG('heart_pulse');
      const pp = new THREE.Group(); pp.add(box(0.7, 0.95, 0.5, Mt.plinth, 0, 0.475, 0));
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.03, 32), new THREE.MeshStandardMaterial({ color: 0x8a5a50, roughness: 0.5, emissive: 0x7a2a22, emissiveIntensity: 0.15 }));
      pad.position.y = 0.97; pad.userData.action = 'heart:pulse'; pp.add(pad); obj.pad = pad;
      pp.position.set(w * 0.2, 0, d * 0.8); pp.rotation.y = 0.6; gp.add(tag(pp, 'heart_pulse'));
      hot('heart_pulse', w * 0.2, 1.5, d * 0.8); keep.push([w * 0.2 - 0.6, d * 0.8 - 0.6, w * 0.2 + 0.6, d * 0.8 + 0.6]);
      const ga = elG('heart_audio');
      [[0.4, 0.4], [w - 0.4, 0.4], [w - 0.4, d - 0.4], [0.4, d - 0.4]].forEach(([u, v]) => ga.add(tag(box(0.34, 0.5, 0.3, Mt.speaker, u, h - 1.5, v), 'heart_audio')));
      ga.add(tag(box(0.6, 0.6, 0.6, Mt.speaker, w - 0.6, 0.3, 0.6), 'heart_audio'));
      hot('heart_audio', w - 0.6, 0.9, 0.6);
      key.position.set(w / 2 + 2.2, h - 0.2, d / 2 + 3.2); key.target.position.set(w / 2, baseY + H * 0.6, d / 2); key.angle = Math.PI / 5.5;
    }

    if (id === 'cellular') {
      hero = V3(w / 2, 1.5, d / 2);
      eye = { p: [w * 0.45, d * 0.55], look: V3(w, 1.7, d * 0.5), y: 1.2 };
      const gb = elG('cell_bench');
      const bench = new THREE.Group(); bench.add(box(3.2, 0.1, 0.55, Mt.timber, 0, 0.45, 0)); [-1.4, 1.4].forEach(x => bench.add(box(0.1, 0.4, 0.45, Mt.steel, x, 0.2, 0)));
      bench.position.set(w * 0.45, 0, d * 0.5); gb.add(tag(bench, 'cell_bench')); hot('cell_bench', w * 0.45, 0.9, d * 0.5);
      keep.push([w * 0.45 - 1.8, d * 0.5 - 0.5, w * 0.45 + 1.8, d * 0.5 + 0.5]);
      const gf = elG('cell_proj_floor');
      const fpc = projCanvas(384, 256); obj.proj.push({ pc: fpc, surface: 'floor', el: 'cell_proj_floor' });
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, d * 0.7), projMat(fpc, 0.45)); fl.rotation.x = -Math.PI / 2; fl.position.set(w / 2, 0.012, d / 2); gf.add(tag(fl, 'cell_proj_floor'));
      hot('cell_proj_floor', w * 0.7, 0.3, d * 0.3);
      const gs = elG('cell_scalebar');
      const ladder = window.UW_CONTENT ? window.UW_CONTENT.scaleLadder : [];
      const stx = canvasTex(2048, 128, (c, W_, H_) => {
        c.fillStyle = '#1c1816'; c.fillRect(0, 0, W_, H_); c.strokeStyle = '#cdbfae'; c.lineWidth = 3; c.beginPath(); c.moveTo(20, 64); c.lineTo(W_ - 20, 64); c.stroke();
        const items = ladder.length ? ladder.slice(0, 9) : [{ label: 'Body', size: '1.7 m' }];
        c.font = '500 26px "IBM Plex Sans", sans-serif'; c.fillStyle = '#efe6d6';
        items.forEach((it, i) => { const x = 40 + i * (W_ - 80) / Math.max(1, items.length - 1); c.fillRect(x - 2, 44, 4, 40); c.fillText(it.size, x + 8, 40); c.fillStyle = '#b5a794'; c.fillText(it.label, x + 8, 110); c.fillStyle = '#efe6d6'; });
      });
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(w - 2, (w - 2) / 16), new THREE.MeshStandardMaterial({ map: stx, roughness: 0.8, emissive: 0xffffff, emissiveMap: stx, emissiveIntensity: 0.25 }));
      strip.position.set(w / 2, 1.2, d - 0.06); strip.rotation.y = Math.PI; gs.add(tag(strip, 'cell_scalebar')); hot('cell_scalebar', w * 0.3, 1.6, d - 0.3);
      key.position.set(w * 0.45, h - 0.3, d * 0.5); key.target.position.set(w * 0.45, 0, d * 0.5); key.angle = Math.PI / 9;
    }

    if (id === 'signals') {
      const ay = Math.min(3.7, h - 1.3);
      hero = V3(w / 2, ay, d / 2);
      eye = { p: [w * 0.35, Math.min(d - 0.8, d / 2 + 3.2)], look: V3(w * 0.6, ay - 0.6, d / 2), y: 1.6 };
      const gn = elG('sig_neuron');
      const soma = new THREE.Mesh(displace(new THREE.IcosahedronGeometry(0.62 * s, 4), 0.08 * s, 2.2, 3), Mt.neuron);
      soma.position.set(2.2, ay, d / 2); gn.add(tag(soma, 'sig_neuron'));
      const Rr = rng(21);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.3, len = 1.2 + Rr() * 1.3;
        const p0 = [2.2, ay, d / 2], p1 = [2.2 - Math.abs(Math.cos(a)) * len * 0.8 - 0.2, ay + Math.sin(a) * len * 0.6, d / 2 + Math.cos(a * 1.7) * len * 0.8];
        gn.add(tag(tube([p0, [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + 0.2, (p0[2] + p1[2]) / 2], p1], 0.07 * s, Mt.neuron, 12), 'sig_neuron'));
        gn.add(tag(tube([p1, [p1[0] - 0.4, p1[1] + (Rr() - 0.5), p1[2] + (Rr() - 0.5)]], 0.035 * s, Mt.neuron, 6), 'sig_neuron'));
      }
      const pts = []; for (let i = 0; i <= 10; i++) { const u = 2.8 + (w - 4.6) * i / 10; pts.push(V3(u, ay + Math.sin(i * 0.9) * 0.25, d / 2 + Math.sin(i * 0.6) * 0.6)); }
      const curve = new THREE.CatmullRomCurve3(pts); obj.axon = curve;
      gn.add(tag(new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.07 * s, 10, false), Mt.neuron), 'sig_neuron'));
      const segLen = curve.getLength(), nodes = [];
      const segs = Math.max(3, Math.floor(segLen / 1.6));
      for (let k = 0; k < segs; k++) {
        const t0 = (k + 0.1) / segs, t1 = (k + 0.9) / segs;
        const sub = []; for (let q = 0; q <= 8; q++) sub.push(curve.getPoint(t0 + (t1 - t0) * q / 8));
        gn.add(tag(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sub), 24, 0.17 * s, 14, false), Mt.myelin), 'sig_neuron'));
        const nm = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 16, 12), Mt.node.clone()); nm.position.copy(curve.getPoint((k + 1) / segs > 0.999 ? 0.999 : (k + 1) / segs)); gn.add(tag(nm, 'sig_neuron'));
        nodes.push({ mesh: nm, p: (k + 1) / segs });
      }
      const end = curve.getPoint(1);
      for (let i = 0; i < 4; i++) { const tip = [end.x + 0.5 + Rr() * 0.5, end.y + (Rr() - 0.5) * 1.2, end.z + (Rr() - 0.5) * 1.2]; gn.add(tag(tube([[end.x, end.y, end.z], tip], 0.04 * s, Mt.neuron, 6), 'sig_neuron')); const kn = new THREE.Mesh(new THREE.SphereGeometry(0.09 * s, 12, 10), Mt.neuron); kn.position.set(...tip); gn.add(tag(kn, 'sig_neuron')); }
      const cables = []; for (let k = 0; k <= 4; k++) { const p = curve.getPoint(k / 4); cables.push(p.x, p.y, p.z, p.x, h, p.z); }
      const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cables, 3)); gn.add(new THREE.LineSegments(cg, Mt.cable));
      obj.nodes = nodes;
      const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.22 * s, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe0b0, transparent: true, opacity: 0 })); gn.add(pulse); obj.pulse = pulse;
      hot('sig_neuron', 2.2, ay + 0.9, d / 2);
      const gc = elG('sig_control');
      const pl = new THREE.Group(); pl.add(box(0.7, 1.0, 0.5, Mt.plinth, 0, 0.5, 0));
      if (cfg.opts.controlType === 'touchfree') {
        const zone = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 32), new THREE.MeshStandardMaterial({ color: 0x9db48a, transparent: true, opacity: 0.5, emissive: 0x5d7a4a, emissiveIntensity: 0.4 }));
        zone.position.y = 1.02; zone.userData.action = 'signals:trigger'; pl.add(zone);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.012, 6, 32), Mt.rail); ring.rotation.x = Math.PI / 2; ring.position.y = 1.25; pl.add(ring);
      } else {
        const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.08, 32), new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.4, emissive: 0x7a5a2a, emissiveIntensity: 0.2 }));
        btn.position.y = 1.04; btn.userData.action = 'signals:trigger'; pl.add(btn);
      }
      pl.position.set(1.3, 0, d / 2 + 1.8); pl.rotation.y = -0.4; gc.add(tag(pl, 'sig_control'));
      hot('sig_control', 1.3, 1.5, d / 2 + 1.8); keep.push([0.8, d / 2 + 1.3, 1.8, d / 2 + 2.3]);
      const gl = elG('sig_label');
      const lt = canvasTex(400, 500, (c) => { c.fillStyle = '#231d19'; c.fillRect(0, 0, 400, 500); c.fillStyle = '#efe6d6'; c.font = '600 30px "IBM Plex Sans", sans-serif'; c.fillText('What is simplified', 24, 56); c.font = '22px "IBM Plex Sans", sans-serif'; c.fillStyle = '#cdbfae'; ['Axon magnified', 'Signal slowed down', 'Ion channels schematic', 'Colour is arbitrary', 'Saltatory conduction', 'shown simply'].forEach((l, i) => c.fillText('· ' + l, 24, 110 + i * 40)); });
      const lp = new THREE.Group(); lp.add(box(0.8, 1.0, 0.06, new THREE.MeshStandardMaterial({ map: lt, roughness: 0.8 }), 0, 1.3, 0)); lp.add(box(0.08, 0.8, 0.08, Mt.steel, 0, 0.4, 0));
      lp.position.set(w - 1.4, 0, d - 1.0); lp.rotation.y = Math.PI * 1.15; gl.add(tag(lp, 'sig_label')); hot('sig_label', w - 1.4, 2.0, d - 1.0);
      const gs = elG('sig_sound');
      for (let u = 1; u < w; u += Math.max(2.5, w / 6)) gs.add(tag(box(0.28, 0.4, 0.24, Mt.speaker, u, h - 1.2, 0.25), 'sig_sound'));
      hot('sig_sound', w * 0.5, h - 0.8, 0.4);
      key.position.set(w / 2, h - 0.2, d * 0.8); key.target.position.set(w / 2, ay, d / 2); key.angle = Math.PI / 4;
    }

    if (id === 'vr') {
      hero = V3(w * 0.35, 1.2, d * 0.45);
      eye = { p: [w * 0.3, d * 0.85], look: V3(w * 0.4, 1.2, 0), y: 1.6 };
      const Rv = rng(31);
      const gsd = elG('vr_standing');
      const nS = on('vr_standing') ? cfg.opts.vrStanding : 0;
      let u = 1.6;
      for (let i = 0; i < nS; i++) {
        const zc = [u, 1.7];
        gsd.add(tag(box(2.2, 0.02, 2.2, Mt.mat, zc[0], 0.01, zc[1]), 'vr_standing'));
        [[0, -1.1, 2.2, 0.06], [0, 1.1, 2.2, 0.06], [-1.1, 0, 0.06, 2.2], [1.1, 0, 0.06, 2.2]].forEach(([dx, dz, sx, sz]) => gsd.add(tag(box(sx, 0.022, sz, Mt.tape, zc[0] + dx, 0.012, zc[1] + dz), 'vr_standing')));
        const f = figure(Rv, { headset: true }); f.position.set(zc[0], 0, zc[1]); f.rotation.y = Rv() * 6; gsd.add(tag(f, 'vr_standing'));
        keep.push([zc[0] - 1.2, zc[1] - 1.2, zc[0] + 1.2, zc[1] + 1.2]);
        u += 2.9;
      }
      if (nS) hot('vr_standing', 1.6, 2.4, 1.7);
      const gse = elG('vr_seated');
      const nC = on('vr_seated') ? cfg.opts.vrSeated : 0;
      for (let i = 0; i < nC; i++) {
        const cx = 1.8 + i * 2.2, cz = d * 0.52;
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 0.9, 40), Mt.tape); ring.rotation.x = -Math.PI / 2; ring.position.set(cx, 0.012, cz); gse.add(tag(ring, 'vr_seated'));
        const ch = new THREE.Group(); ch.add(box(0.5, 0.08, 0.5, Mt.chair, 0, 0.46, 0)); ch.add(box(0.08, 0.5, 0.46, Mt.chair, -0.23, 0.75, 0)); ch.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.42, 8), Mt.steel).translateY(0.21)); ch.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 16), Mt.steel).translateY(0.02));
        ch.position.set(cx, 0, cz); ch.rotation.y = Rv() * 6; gse.add(tag(ch, 'vr_seated'));
        const f = figure(Rv, { seated: true, headset: true }); f.position.set(cx - 0.05, 0.02, cz); f.rotation.y = ch.rotation.y; gse.add(tag(f, 'vr_seated'));
        keep.push([cx - 0.95, cz - 0.95, cx + 0.95, cz + 0.95]);
      }
      if (nC) hot('vr_seated', 1.8, 1.9, d * 0.52);
      const gst = elG('vr_storage');
      const cab = new THREE.Group(); cab.add(box(1.3, 1.8, 0.5, Mt.panel, 0, 0.9, 0));
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cab.add(box(0.26, 0.12, 0.2, Mt.headset, -0.4 + c * 0.4, 0.5 + r * 0.45, 0.2));
      cab.position.set(0.9, 0, d - 0.35); cab.rotation.y = Math.PI; gst.add(tag(cab, 'vr_storage')); hot('vr_storage', 0.9, 2.1, d - 0.4); keep.push([0.2, d - 0.8, 1.6, d]);
      const gsf = elG('vr_staff');
      const desk = new THREE.Group(); desk.add(box(1.6, 0.06, 0.7, Mt.timber, 0, 0.74, 0)); desk.add(box(1.5, 0.7, 0.05, Mt.panel, 0, 0.37, 0.3)); desk.add(box(0.36, 0.02, 0.26, Mt.steel, 0.2, 0.78, 0)); desk.add(box(0.36, 0.24, 0.02, Mt.screenOff, 0.2, 0.9, 0.12));
      desk.position.set(2.8, 0, d - 1.1); desk.rotation.y = Math.PI; gsf.add(tag(desk, 'vr_staff')); hot('vr_staff', 2.8, 1.4, d - 1.1); keep.push([1.9, d - 1.6, 3.7, d - 0.5]);
      const staffer = figure(Rv, {}); staffer.position.set(2.8, 0, d - 0.55); gsf.add(tag(staffer, 'vr_staff'));
      const gbs = elG('vr_bigscreen');
      const vpc = projCanvas(512, 288); obj.proj.push({ pc: vpc, surface: 'preview', el: 'vr_bigscreen', vr: true });
      const scr = new THREE.Group(); scr.add(box(2.0, 1.16, 0.08, Mt.screenOff, 0, 0, -0.05));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.07), projMat(vpc, 0.95)); face.position.z = 0.0; scr.add(face);
      scr.position.set(w * 0.62, 1.7, d - 0.12); scr.rotation.y = Math.PI; gbs.add(tag(scr, 'vr_bigscreen'));
      gbs.add(tag(box(2.2, 0.45, 0.5, Mt.timber, w * 0.62, 0.225, d - 2.6), 'vr_bigscreen'));
      hot('vr_bigscreen', w * 0.62, 2.5, d - 0.3); keep.push([w * 0.62 - 1.2, d - 2.9, w * 0.62 + 1.2, d - 2.3]);
      const gto = elG('vr_touch');
      const ttx = canvasTex(320, 200, (c) => { c.fillStyle = '#16120f'; c.fillRect(0, 0, 320, 200); c.strokeStyle = '#cdbfae'; c.lineWidth = 2; c.beginPath(); c.ellipse(80, 40, 16, 20, 0, 0, 7); c.moveTo(80, 60); c.lineTo(80, 150); c.moveTo(50, 80); c.lineTo(110, 80); c.moveTo(80, 150); c.lineTo(60, 190); c.moveTo(80, 150); c.lineTo(100, 190); c.stroke(); c.fillStyle = '#9a3a30'; c.beginPath(); c.arc(86, 92, 8, 0, 7); c.fill(); c.fillStyle = '#efe6d6'; c.font = '16px "IBM Plex Sans", sans-serif'; ['Heart', 'Lungs', 'Digestive tract', 'Nervous system'].forEach((l, i) => c.fillText(l, 150, 50 + i * 34)); });
      [d * 0.42, d * 0.66].forEach((v, i) => {
        const k = new THREE.Group(); k.add(box(0.5, 0.9, 0.4, Mt.plinth, 0, 0.45, 0));
        const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.4), new THREE.MeshStandardMaterial({ map: ttx, emissive: 0xffffff, emissiveMap: ttx, emissiveIntensity: 0.6 }));
        sc.position.set(0, 1.0, 0.05); sc.rotation.x = -Math.PI / 3.2; k.add(sc);
        k.position.set(w - 1.6, 0, v); k.rotation.y = -Math.PI / 2; gto.add(tag(k, 'vr_touch')); keep.push([w - 2.1, v - 0.5, w - 1.1, v + 0.5]);
      });
      hot('vr_touch', w - 1.6, 1.5, d * 0.42);
      const gq = elG('vr_quiet');
      const qx = w - 2.2, qv = 1.7;
      const cg = new THREE.PlaneGeometry(3.8, 2.4, 40, 1); const cp = cg.attributes.position; for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 6) * 0.06); cg.computeVertexNormals();
      const cur = new THREE.Mesh(cg, Mt.curtain); cur.position.set(w - 1.9, 1.2, 3.6); gq.add(tag(cur, 'vr_quiet'));
      [[-0.7, 0], [0.7, 0]].forEach(([dx]) => { const a = new THREE.Group(); a.add(box(0.8, 0.45, 0.8, Mt.soft, 0, 0.225, 0)); a.add(box(0.8, 0.5, 0.18, Mt.soft, 0, 0.6, -0.31)); a.position.set(qx + dx, 0, qv); a.rotation.y = Math.PI; gq.add(tag(a, 'vr_quiet')); });
      const lampS = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.28, 16, 1, true), Mt.lamp); lampS.position.set(w - 0.5, 1.35, 0.6); gq.add(tag(lampS, 'vr_quiet')); gq.add(tag(box(0.03, 1.2, 0.03, Mt.steel, w - 0.5, 0.6, 0.6), 'vr_quiet'));
      hot('vr_quiet', qx, 1.4, qv); keep.push([w - 3.9, 0, w, 3.7]);
      key.position.set(w / 2, h - 0.3, d / 2); key.target.position.set(w * 0.35, 0, d * 0.5); key.angle = Math.PI / 3;
    }

    // ---- AV equipment implied by the projection surfaces ----
    const av = new THREE.Group(); av.userData.el = null; Lg.add(av); obj.av = av;
    projTargets.forEach(pt => {
      const area = pt.w * pt.h, n = Math.max(1, Math.ceil(area / 22));
      for (let i = 0; i < n; i++) {
        const along = [pt.n[1], -pt.n[0]]; // tangent
        const off = (i - (n - 1) / 2) * (pt.w / n);
        const tgt = V3(pt.c.x + along[0] * off, pt.c.y, pt.c.z + along[1] * off);
        const dist = Math.min(4.2, Math.max(2.5, pt.w / n * 0.8));
        const pos = V3(tgt.x + pt.n[0] * dist, Math.min(h - 0.5, pt.c.y + pt.h / 2 + 0.6), tgt.z + pt.n[1] * dist);
        const pj = new THREE.Group(); pj.add(box(0.5, 0.2, 0.45, Mt.projector, 0, 0, 0)); pj.add(box(0.05, Math.max(0.1, h - pos.y), 0.05, Mt.steel, 0, (h - pos.y) / 2, 0));
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 12), Mt.lens); lens.rotation.x = Math.PI / 2; lens.position.set(0, 0, 0.25); pj.add(lens);
        pj.position.copy(pos); pj.lookAt(tgt.x + Lg.position.x, pos.y, tgt.z); // yaw only (approximation in local frame)
        pj.rotation.set(0, Math.atan2(tgt.x - pos.x, tgt.z - pos.z), 0);
        pt.g.add(pj);
        // beam frustum from lens to the covered portion of the surface
        const hw = pt.w / n / 2, hh = pt.h / 2;
        const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([a, b]) => V3(tgt.x + along[0] * a, tgt.y + b, tgt.z + along[1] * a));
        const bp = [pos.x, pos.y, pos.z]; corners.forEach(c => bp.push(c.x, c.y, c.z));
        const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); bg.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1]);
        const beam = new THREE.Mesh(bg, Mt.beam); beam.userData.beam = true; beam.visible = showBeams; pt.g.add(beam);
      }
    });

    // ---- visitors for scale ----
    const vg = new THREE.Group(); Lg.add(vg); obj.visitors = vg;
    const Rn = rng(1000 + Rl.idx * 17 + id.length);
    let placed = 0, tries = 0;
    const want = cfg.visitors - (id === 'vr' ? (on('vr_seated') ? cfg.opts.vrSeated : 0) + (on('vr_standing') ? cfg.opts.vrStanding : 0) : 0);
    const spots = [];
    while (placed < want && tries < want * 40) {
      tries++;
      const u = 0.8 + Rn() * (w - 1.6), v = 0.8 + Rn() * (d - 1.6);
      if (keep.some(k => u > k[0] - 0.3 && u < k[2] + 0.3 && v > k[1] - 0.3 && v < k[3] + 0.3)) continue;
      if (spots.some(p => Math.hypot(p[0] - u, p[1] - v) < 0.9)) continue;
      const kind = placed % 9 === 4 ? { wheelchair: true } : (Rn() < 0.15 ? { child: true } : {});
      const f = figure(Rn, kind); f.position.set(u, 0, v);
      f.rotation.y = Math.atan2(hero.x - u, hero.z - v) - Math.PI / 2 + (Rn() - 0.5) * 0.8;
      vg.add(f); spots.push([u, v]); placed++;
    }

    obj.hero = hero; obj.eye = eye; obj.keep = keep;
    key.target.updateMatrixWorld();
    return obj;
  }

  function buildCorridor(c) {
    const Mt = materials(), g = new THREE.Group();
    const w = c.x1 - c.x0, len = c.z1 - c.z0;
    const fg = new THREE.PlaneGeometry(w, len + 0.4); fg.rotateX(-Math.PI / 2);
    const f = new THREE.Mesh(fg, Mt.floor); f.position.set((c.x0 + c.x1) / 2, 0.005, (c.z0 + c.z1) / 2); g.add(f);
    [c.x0 - 0.1, c.x1 + 0.1].forEach(x => g.add(box(0.2, c.h + 0.6, len, Mt.brick, x, (c.h + 0.6) / 2, (c.z0 + c.z1) / 2, [0.92, 0.6])));
    const roof = box(w + 0.4, 0.15, len, Mt.timber, (c.x0 + c.x1) / 2, c.h + 0.6, (c.z0 + c.z1) / 2); roof.userData.roof = true; g.add(roof);
    g.add(box(0.5, 0.06, 0.5, Mt.lamp, (c.x0 + c.x1) / 2, c.h - 0.05, (c.z0 + c.z1) / 2));
    g.userData.roofMesh = roof;
    return g;
  }

  // ---------- public: init, build, render ----------
  W.init = function (cv) {
    canvas = cv;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    W.maxPR = Math.min(window.devicePixelRatio || 1, 1.5); W.pr = W.maxPR; renderer.setPixelRatio(W.pr);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0908);
    scene.fog = new THREE.Fog(0x0b0908, 30, 140);
    camera = new THREE.PerspectiveCamera(62, 1, 0.05, 400);
    const hemi = new THREE.HemisphereLight(0xcdb8a0, 0x1a1410, 0.35); scene.add(hemi); W.hemi = hemi;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0x151210, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; scene.add(ground);
    setupControls();
    W.resize();
  };
  // adaptive resolution: keep the walkthrough responsive on modest GPUs
  let perfAcc = 0, perfN = 0;
  W.perf = function (dt) {
    perfAcc += dt; perfN++;
    if (perfAcc < 1.5) return;
    const avg = perfAcc / perfN; perfAcc = 0; perfN = 0;
    let pr = W.pr;
    if (avg > 0.045 && pr > 0.6) pr = Math.max(0.6, pr - 0.2);
    else if (avg < 0.022 && pr < W.maxPR) pr = Math.min(W.maxPR, pr + 0.1);
    if (pr !== W.pr) { W.pr = pr; renderer.setPixelRatio(pr); W.resize(); }
  };
  W.resize = function () {
    if (!renderer) return;
    const r = canvas.parentElement.getBoundingClientRect();
    renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
    camera.aspect = Math.max(1, r.width) / Math.max(1, r.height); camera.updateProjectionMatrix();
  };

  function disposeGroup(g) {
    g.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (!Object.values(MAT || {}).includes(m)) { if (m.map && m.map.isCanvasTexture) m.map.dispose(); if (m.emissiveMap && m.emissiveMap.isCanvasTexture) m.emissiveMap.dispose(); m.dispose(); } }); }
    });
  }

  W.build = function (cfg) {
    config = cfg; L = window.UW_LAYOUT.computeLayout(cfg);
    if (venue) { scene.remove(venue); disposeGroup(venue); }
    venue = new THREE.Group(); scene.add(venue);
    rooms = {}; hotspots = [];
    L.rooms.forEach(Rl => {
      const o = buildRoom(Rl); rooms[Rl.id] = o; venue.add(o.group);
      o.group.updateMatrixWorld(true);
      o.hot.forEach(hs => { const p = hs.local.clone(); o.local.localToWorld(p); hotspots.push({ room: hs.room, el: hs.el, pos: p }); });
    });
    L.corridors.forEach(c => venue.add(buildCorridor(c)));
    // global light level follows the average room setting
    const avg = cfg.rooms.filter(r => r.enabled).reduce((s, r) => s + r.light, 0) / Math.max(1, cfg.rooms.filter(r => r.enabled).length);
    W.hemiBase = W.hemi.intensity = 0.12 + avg / 100 * 0.6;
    materials().brick.emissiveIntensity = 0.04 + avg / 100 * 0.3; materials().floor.emissiveIntensity = 0.03 + avg / 100 * 0.2;
    if (typeView) applyTypeView(true);
    return L;
  };
  W.layout = () => L;
  W.hotspots = () => hotspots;
  W.rooms = () => rooms;

  // ---------- projection texture updates ----------
  let lastSlow = 0, rr = 0;
  function drawProj(o, p, t, full) {
    if (!p.pc) return;
    const P = window.UW_PROJ;
    const ctx = p.pc.ctx;
    if (!P) { ctx.fillStyle = '#1a1210'; ctx.fillRect(0, 0, p.pc.w, p.pc.h); p.pc.tex.needsUpdate = true; return; }
    const opts = Object.assign({}, hooks.projOpts(o.id), { surface: p.surface === 'preview' ? 'preview' : p.surface });
    let room = o.id, tt = t;
    if (p.microbiome) {
      opts.microbiome = true;
      const ch = (P.chapters.digestive || []).find(c => /microbiome/i.test(c.label));
      const d = P.duration.digestive || 30, t0 = ch ? ch.t : d * 0.66;
      tt = t0 + (t % Math.max(1, d - t0 - 0.05));
    }
    if (p.el === 'dig_proj_stomach') { const ch = (P.chapters.digestive || []).find(c => /stomach/i.test(c.label)); if (ch) { const next = (P.chapters.digestive.find(c => c.t > ch.t) || { t: P.duration.digestive }).t; tt = ch.t + (t % Math.max(1, next - ch.t)); } opts.microbiome = false; }
    if (p.el === 'dig_proj_peristalsis') { const ch = (P.chapters.digestive || []).find(c => /stomach/i.test(c.label)); const end = ch ? ch.t : 10; tt = t % Math.max(1, end); opts.microbiome = false; }
    if (p.vr) room = 'vr';
    if (p.heartSkin) room = 'heart';
    try { P.draw(room, ctx, p.pc.w, p.pc.h, tt, opts); } catch (e) { /* keep last frame */ }
    p.pc.tex.needsUpdate = true;
  }

  let signalPulses = [];
  W.triggerSignal = function (now) { signalPulses.push(now); signalPulses = signalPulses.slice(-6); };
  W.setCutaway = function (v) {
    cutaway = v; const o = rooms.heart; if (!o) return;
    if (o.armature) o.armature.visible = v;
    if (o.heart) o.heart.traverse(m => { if (m.isMesh) { if (v) { if (!m.userData.solidMat) m.userData.solidMat = m.material; const gm = m.userData.solidMat.clone(); gm.transparent = true; gm.opacity = 0.22; gm.depthWrite = false; m.material = gm; } else if (m.userData.solidMat) { m.material = m.userData.solidMat; } } });
  };
  W.getCutaway = () => cutaway;

  W.update = function (dt, now, current, reduced) {
    if (!venue) return;
    const slow = now - lastSlow > 0.12; if (slow) lastSlow = now;
    const list = Object.values(rooms); rr = (rr + 1) % Math.max(1, list.length);
    list.forEach((o, i) => {
      const near = o.id === current;
      const t = hooks.projTime(o.id);
      o.proj.forEach(p => { if (near || (slow && i === rr) || !p.drawn) { drawProj(o, p, t, near); p.drawn = true; } });
      if (o.id === 'heart' && o.pad && window.UW_PROJ && window.UW_PROJ.beatPulse) {
        const po = hooks.projOpts('heart');
        const bp = window.UW_PROJ.beatPulse(t, po.bpm || 64);
        o.pad.material.emissiveIntensity = po.pulseActive ? 0.15 + bp * (reduced ? 0.25 : 0.9) : 0.12;
      }
      if (o.id === 'signals' && o.nodes) {
        const dur = reduced ? 8 : 3;
        let active = null;
        o.nodes.forEach(n => { n.mesh.material.emissiveIntensity = 0; });
        signalPulses.forEach(t0 => {
          const k = (now - t0) / dur; if (k < 0 || k > 1.15) return;
          active = k;
          o.nodes.forEach(n => { const dd = k - n.p; if (dd > -0.03 && dd < 0.12) n.mesh.material.emissiveIntensity = Math.max(n.mesh.material.emissiveIntensity, (1 - Math.abs(dd - 0.02) / 0.1) * 1.4); });
        });
        if (active != null && active <= 1) { o.pulse.material.opacity = 0.75; o.pulse.position.copy(o.axon.getPoint(Math.min(1, active))); }
        else o.pulse.material.opacity = 0;
      }
    });
    // hide roofs when looking from above so the rooms read as a cutaway
    const above = camera.position.y > 8.5;
    W.hemi.intensity = W.hemiBase + (above ? 0.9 : 0);
    Object.values(rooms).forEach(o => { o.roof.visible = !above || o.R.h + 1 > camera.position.y; });
    venue.children.forEach(g => { if (g.userData.roofMesh) g.userData.roofMesh.visible = !above; });
    renderer.render(scene, camera);
  };

  // ---------- type view (colour by element kind) ----------
  function applyTypeView(onv) {
    const K = M().KINDS; const cache = {};
    Object.values(rooms).forEach(o => o.local.traverse(m => {
      if (!m.isMesh || !m.userData.el || m.userData.beam) return;
      if (onv) {
        if (!m.userData.origMat) m.userData.origMat = m.material;
        const kind = M().EL[m.userData.el] ? M().EL[m.userData.el].kind : 'physical';
        cache[kind] = cache[kind] || new THREE.MeshStandardMaterial({ color: K[kind].colour, roughness: 0.8, emissive: K[kind].colour, emissiveIntensity: kind === 'projection' ? 0.55 : 0.12, side: THREE.DoubleSide });
        m.material = cache[kind];
      } else if (m.userData.origMat) { m.material = m.userData.origMat; delete m.userData.origMat; }
    }));
  }
  W.setTypeView = v => { typeView = v; applyTypeView(v); };
  W.setBeams = v => { showBeams = v; if (venue) venue.traverse(o => { if (o.userData.beam) o.visible = v; }); };

  // ---------- camera and navigation ----------
  const cam = { mode: 'orbit', target: V3(20, 0, 10), theta: 0.8, phi: 1.0, radius: 50, yaw: 0, pitch: 0, tween: null };
  const keys = {};
  function applyCam() {
    if (cam.mode === 'orbit') {
      const sp = Math.sin(cam.phi);
      camera.position.set(cam.target.x + cam.radius * sp * Math.sin(cam.theta), cam.target.y + cam.radius * Math.cos(cam.phi), cam.target.z + cam.radius * sp * Math.cos(cam.theta));
      camera.lookAt(cam.target);
    } else {
      const dir = V3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
      camera.lookAt(camera.position.clone().add(dir));
    }
  }
  function setPose(pos, look, mode) {
    if (mode === 'orbit') {
      const off = pos.clone().sub(look); cam.target.copy(look); cam.radius = off.length();
      cam.phi = Math.acos(Math.max(-1, Math.min(1, off.y / cam.radius))); cam.theta = Math.atan2(off.x, off.z); cam.mode = 'orbit';
    } else {
      camera.position.copy(pos); const dir = look.clone().sub(pos).normalize();
      cam.yaw = Math.atan2(dir.x, dir.z); cam.pitch = Math.asin(Math.max(-1, Math.min(1, dir.y))); cam.mode = 'walk';
    }
    applyCam();
  }
  W.flyTo = function (pos, look, mode, instant) {
    const fromPos = camera.position.clone();
    const fromLook = camera.position.clone().add(camera.getWorldDirection(V3(0, 0, 0)).multiplyScalar(pos.distanceTo(look)));
    if (instant) { setPose(pos, look, mode); return; }
    cam.tween = { t: 0, dur: 1.4, fromPos, fromLook, pos, look, mode };
  };
  W.viewPose = function (roomId, view) {
    if (view === 'venue' || !rooms[roomId]) {
      const b = L.bounds, c = V3((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2), span = Math.max(b.x1 - b.x0, b.z1 - b.z0);
      return { pos: V3(c.x - span * 0.1, span * 0.95, c.z + span * 0.75), look: c, mode: 'orbit' };
    }
    const o = rooms[roomId], Rl = o.R, lw = (u, y, v) => { const p = V3(u, y, v); o.local.localToWorld(p); return p; };
    const w = Rl.w, d = Rl.d;
    if (view === 'entrance') {
      const en = o.doorsL[0] || { u: 0, v: d / 2 };
      const u = Math.min(w - 1, Math.max(1, en.u + (en.u < 0.6 ? 1.2 : en.u > w - 0.6 ? -1.2 : 0)));
      const v = Math.min(d - 1, Math.max(1, en.v + (en.v < 0.6 ? 1.2 : en.v > d - 0.6 ? -1.2 : 0)));
      const heroW = o.hero.clone(); o.local.localToWorld(heroW);
      return { pos: lw(u, 1.6, v), look: heroW, mode: 'walk' };
    }
    if (view === 'eye') {
      const p = lw(o.eye.p[0], o.eye.y, o.eye.p[1]); const lk = o.eye.look.clone(); o.local.localToWorld(lk);
      return { pos: p, look: lk, mode: 'walk' };
    }
    if (view === 'detail') {
      const hw = o.hero.clone(); o.local.localToWorld(hw);
      const dist = roomId === 'heart' ? 5.5 : roomId === 'entrance' ? 7 : 5;
      const ang = roomId === 'digestive' ? -2.4 : 0.6;
      const pos = hw.clone().add(V3(Math.sin(ang) * dist, 1.2, Math.cos(ang) * dist));
      pos.x = Math.min(Rl.x1 - 0.6, Math.max(Rl.x0 + 0.6, pos.x)); pos.z = Math.min(Rl.z1 - 0.6, Math.max(Rl.z0 + 0.6, pos.z)); pos.y = Math.min(Rl.h - 0.4, pos.y);
      return { pos, look: hw, mode: 'orbit' };
    }
    // overview (cutaway from above)
    const c = V3(Rl.cx, 0.5, Rl.cz), span = Math.max(w, d);
    return { pos: V3(c.x + span * 0.35, span * 1.25 + Rl.h, c.z + span * 0.85), look: c, mode: 'orbit' };
  };
  W.goView = function (roomId, view, instant) {
    const p = W.viewPose(roomId, view); W.flyTo(p.pos, p.look, p.mode, instant); return p;
  };
  W.camState = function () {
    const dir = camera.getWorldDirection(V3(0, 0, 0));
    return { x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw: Math.atan2(dir.x, dir.z), mode: cam.mode, fov: camera.fov };
  };
  W.currentRoom = function () { if (!L) return null; const r = window.UW_LAYOUT.roomAt(L, camera.position.x, camera.position.z); return r && camera.position.y < r.h + 2 ? r.id : null; };
  W.setWalk = function () { if (cam.mode === 'walk') return; const p = camera.position.clone(); const r = window.UW_LAYOUT.roomAt(L, cam.target.x, cam.target.z) || L.rooms[0]; if (!r) return; W.flyTo(V3(cam.target.x, 1.6, cam.target.z + 0.01), V3(cam.target.x + 1, 1.6, cam.target.z), 'walk'); };

  function stepTween(dt, reduced) {
    const tw = cam.tween; if (!tw) return false;
    tw.t += dt / (reduced ? 0.01 : tw.dur);
    const k = Math.min(1, tw.t), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const pos = tw.fromPos.clone().lerp(tw.pos, e), look = tw.fromLook.clone().lerp(tw.look, e);
    // arc over walls when travelling between distant points at eye level
    const lift = Math.sin(Math.PI * e) * Math.min(14, tw.fromPos.distanceTo(tw.pos) * 0.35);
    if (tw.fromPos.distanceTo(tw.pos) > 6) pos.y += lift;
    camera.position.copy(pos); camera.lookAt(look);
    if (k >= 1) { cam.tween = null; setPose(tw.pos, tw.look, tw.mode); }
    return true;
  }
  W.tick = function (dt, reduced) {
    if (stepTween(dt, reduced)) return;
    if (cam.mode === 'walk') {
      const sp = (keys.ShiftLeft || keys.ShiftRight ? 3.2 : 1.6) * dt;
      let f = 0, s = 0;
      if (keys.KeyW || keys.ArrowUp) f += 1; if (keys.KeyS || keys.ArrowDown) f -= 1;
      if (keys.KeyA) s -= 1; if (keys.KeyD) s += 1;
      if (keys.ArrowLeft || keys.KeyQ) cam.yaw += dt * 1.4; if (keys.ArrowRight || keys.KeyE) cam.yaw -= dt * 1.4;
      if (f || s) {
        const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
        const dx = (fx * f - fz * s) * sp, dz = (fz * f + fx * s) * sp;
        const p = camera.position;
        if (window.UW_LAYOUT.walkable(L, p.x + dx, p.z)) p.x += dx;
        if (window.UW_LAYOUT.walkable(L, p.x, p.z + dz)) p.z += dz;
      }
    } else {
      if (keys.ArrowLeft) cam.theta -= dt; if (keys.ArrowRight) cam.theta += dt;
      if (keys.ArrowUp) cam.phi = Math.max(0.15, cam.phi - dt * 0.8); if (keys.ArrowDown) cam.phi = Math.min(1.5, cam.phi + dt * 0.8);
      if (keys.Equal || keys.NumpadAdd || keys.KeyW) cam.radius = Math.max(1.5, cam.radius * (1 - dt)); if (keys.Minus || keys.NumpadSubtract || keys.KeyS) cam.radius = Math.min(160, cam.radius * (1 + dt));
    }
    applyCam();
  };

  function setupControls() {
    const ptrs = new Map(); let dragDist = 0, pinch0 = 0, down = null;
    canvas.addEventListener('pointerdown', e => { canvas.focus({ preventScroll: true }); canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); dragDist = 0; down = { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey }; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); } cam.tween = null; });
    canvas.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return;
      const p = ptrs.get(e.pointerId); const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; dragDist += Math.abs(dx) + Math.abs(dy);
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const dd = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0) { const k = pinch0 / dd; if (cam.mode === 'orbit') cam.radius = Math.min(160, Math.max(1.5, cam.radius * k)); else moveForward((dd - pinch0) * 0.02); } pinch0 = dd; return; }
      if (cam.mode === 'orbit') {
        if (down && (down.b === 2 || down.shift)) { // pan
          const right = V3(Math.cos(cam.theta), 0, -Math.sin(cam.theta)), fwd = V3(-Math.sin(cam.theta), 0, -Math.cos(cam.theta));
          const k = cam.radius * 0.0016; cam.target.add(right.multiplyScalar(-dx * k)).add(fwd.multiplyScalar(dy * k));
        } else { cam.theta -= dx * 0.005; cam.phi = Math.min(1.52, Math.max(0.12, cam.phi - dy * 0.005)); }
      } else { cam.yaw -= dx * 0.004; cam.pitch = Math.max(-1.2, Math.min(1.2, cam.pitch - dy * 0.004)); }
    });
    const up = e => {
      if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId); pinch0 = 0;
      if (dragDist < 6 && e.type === 'pointerup' && ptrs.size === 0) pick(e);
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { e.preventDefault(); cam.tween = null; if (cam.mode === 'orbit') cam.radius = Math.min(160, Math.max(1.5, cam.radius * (1 + Math.sign(e.deltaY) * 0.1))); else moveForward(-Math.sign(e.deltaY) * 0.6); }, { passive: false });
    canvas.addEventListener('keydown', e => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); keys[e.code] = true; });
    canvas.addEventListener('keyup', e => { keys[e.code] = false; });
    canvas.addEventListener('blur', () => { Object.keys(keys).forEach(k => { keys[k] = false; }); });
  }
  function moveForward(d) {
    const p = camera.position, nx = p.x + Math.sin(cam.yaw) * d, nz = p.z + Math.cos(cam.yaw) * d;
    if (window.UW_LAYOUT.walkable(L, nx, nz)) { p.x = nx; p.z = nz; }
  }
  const ray = new THREE.Raycaster();
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v, camera);
    const hits = ray.intersectObjects(venue ? venue.children : [], true).filter(h => h.object.visible && !h.object.userData.beam);
    for (const h of hits) {
      let o = h.object, act = null, el = null;
      while (o) { if (!act && o.userData.action) act = o.userData.action; if (!el && o.userData.el) el = o.userData.el; o = o.parent; }
      if (act || el) { hooks.onPick(el, act); return; }
      if (h.object.parent && h.object.parent.parent === venue) { /* wall or floor */ }
      break;
    }
    // click on a floor in walk mode: step towards that point
    if (cam.mode === 'walk' && hits[0] && hits[0].point.y < 0.05) {
      const p = hits[0].point; if (window.UW_LAYOUT.walkable(L, p.x, p.z)) W.flyTo(V3(p.x, camera.position.y, p.z), V3(p.x + Math.sin(cam.yaw), camera.position.y, p.z + Math.cos(cam.yaw)), 'walk');
    }
  }

  W.project = function (p) { const v = p.clone().project(camera); return { x: v.x, y: v.y, z: v.z, behind: v.z > 1 }; };
  W.camera = () => camera;
  W.dist = p => camera.position.distanceTo(p);

  // Render a still of any configuration from a named viewpoint (for comparisons).
  W.snapshot = function (cfg, roomId, view, w, h) {
    const keepCfg = config, keepPos = camera.position.clone(), keepQuat = camera.quaternion.clone();
    const keepCam = { mode: cam.mode, target: cam.target.clone(), theta: cam.theta, phi: cam.phi, radius: cam.radius, yaw: cam.yaw, pitch: cam.pitch };
    const keepTV = typeView; typeView = false;
    const size = renderer.getSize(new THREE.Vector2());
    W.build(cfg);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const p = W.viewPose(roomId, view); setPose(p.pos, p.look, p.mode);
    Object.values(rooms).forEach(o => o.proj.forEach(pp => drawProj(o, pp, 6, true)));
    const above = camera.position.y > 8.5; Object.values(rooms).forEach(o => { o.roof.visible = !above; });
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/jpeg', 0.82);
    typeView = keepTV;
    W.build(keepCfg);
    renderer.setSize(size.x, size.y, false); camera.aspect = size.x / size.y; camera.updateProjectionMatrix();
    Object.assign(cam, keepCam); camera.position.copy(keepPos); camera.quaternion.copy(keepQuat); applyCam();
    return url;
  };

  window.UW_WORLD = W;
})();
