/* The Universe Within — venue layout.
   Turns the editable room list into a floor plan: rooms snake through two
   rows of a notional warehouse, with doors, a link corridor between rows and
   the visitor route. Shared by the 3D model, the floor plan and the budget. */
(function () {
  'use strict';
  const GAP = 0.4;        // partition thickness between rooms (m)
  const ROW_GAP = 3.2;    // link corridor length between the two rows (m)
  const DOOR_W = 2.4;     // standard step-free opening (m) — concept only
  const DOOR_H = 3.0;

  function computeLayout(config) {
    const list = config.rooms.filter(r => r.enabled);
    const n = list.length;
    const out = { rooms: [], corridors: [], doors: [], route: [], bounds: { x0: 0, z0: 0, x1: 10, z1: 10 }, gap: GAP };
    if (!n) return out;
    const n0 = Math.ceil(n / 2);
    const row0 = list.slice(0, n0), row1 = list.slice(n0);
    const maxD0 = Math.max(...row0.map(r => r.d));
    // row 0 runs west → east
    let cx = 0;
    row0.forEach((r, i) => {
      out.rooms.push(mk(r, cx, 0, 0, i));
      cx += r.w + GAP;
    });
    const endX = out.rooms[out.rooms.length - 1].x1;
    const z1row = maxD0 + ROW_GAP;
    let rx = endX;
    row1.forEach((r, i) => {
      out.rooms.push(mk(r, rx - r.w, z1row, 1, i));
      rx = rx - r.w - GAP;
    });
    // doors
    for (let i = 0; i < out.rooms.length - 1; i++) {
      const A = out.rooms[i], B = out.rooms[i + 1];
      const combined = !!A.cfg.openToNext;
      if (A.row === B.row) {
        const top = A.z0;
        const span = Math.min(A.d, B.d);
        const w = combined ? Math.max(DOOR_W, span - 1.2) : DOOR_W;
        const c = top + span / 2;
        const x = A.row === 0 ? A.x1 + GAP / 2 : A.x0 - GAP / 2;
        const d = { axis: 'x', x, z: c, w, h: combined ? Math.min(A.h, B.h) - 0.6 : DOOR_H, from: A.id, to: B.id, combined, t: GAP };
        out.doors.push(d);
        A.exit = d; B.entry = d;
      } else {
        // row change: south wall of A → corridor → north wall of B
        const maxW = Math.min(A.w, B.w);
        const cw = combined ? Math.max(3.2, Math.min(8, maxW - 1)) : 3.2;
        const xc = A.x1 - Math.min(Math.max(cw / 2 + 0.8, 2.6), maxW / 2);
        const corr = { x0: xc - cw / 2, x1: xc + cw / 2, z0: A.z1, z1: B.z0, h: Math.min(A.h, B.h, 4.2), combined };
        out.corridors.push(corr);
        const dA = { axis: 'z', x: xc, z: A.z1, w: cw - 0.8, h: combined ? corr.h - 0.2 : DOOR_H, from: A.id, to: B.id, combined, t: 0.4, outer: true };
        const dB = { axis: 'z', x: xc, z: B.z0, w: cw - 0.8, h: combined ? corr.h - 0.2 : DOOR_H, from: A.id, to: B.id, combined, t: 0.4, outer: true };
        out.doors.push(dA, dB);
        A.exit = dA; B.entry = dB; A.corridor = corr;
      }
    }
    // exhibition entry and exit
    const F = out.rooms[0], L = out.rooms[out.rooms.length - 1];
    const cEntry = F.z0 + Math.min(F.d / 2, 3);
    F.entry = { axis: 'x', x: F.x0 - 0.2, z: cEntry, w: DOOR_W, h: DOOR_H, outer: true, t: 0.4, kind: 'entry' };
    out.doors.push(F.entry);
    if (L.row === 0) {
      L.exit = { axis: 'x', x: L.x1 + 0.2, z: L.z0 + L.d / 2, w: DOOR_W, h: DOOR_H, outer: true, t: 0.4, kind: 'exit' };
    } else {
      L.exit = { axis: 'x', x: L.x0 - 0.2, z: L.z0 + Math.min(L.d / 2, 3), w: DOOR_W, h: DOOR_H, outer: true, t: 0.4, kind: 'exit' };
    }
    out.doors.push(L.exit);
    // visitor route polyline
    out.rooms.forEach((R) => {
      const e = R.entry, x = R.exit;
      out.route.push([e.x, e.z]);
      const mid = [R.cx, R.cz];
      out.route.push(mid);
      out.route.push([x.x, x.z]);
    });
    // bounds
    const xs = [], zs = [];
    out.rooms.forEach(R => { xs.push(R.x0, R.x1); zs.push(R.z0, R.z1); });
    out.bounds = { x0: Math.min(...xs) - 4.5, x1: Math.max(...xs) + 2, z0: Math.min(...zs) - 2, z1: Math.max(...zs) + 2 };
    out.floorArea = out.rooms.reduce((s, R) => s + R.w * R.d, 0) + out.corridors.reduce((s, c) => s + (c.x1 - c.x0) * (c.z1 - c.z0), 0);
    return out;
  }

  function mk(cfg, x0, z0, row, idx) {
    return {
      id: cfg.id, cfg, row, idx, x0, z0, x1: x0 + cfg.w, z1: z0 + cfg.d, w: cfg.w, d: cfg.d, h: cfg.h,
      cx: x0 + cfg.w / 2, cz: z0 + cfg.d / 2,
      // "forward" = direction visitors travel through the room
      fwd: row === 0 ? 1 : -1
    };
  }

  // Is (x,z) somewhere a visitor can stand? Used for eye-level walking.
  function walkable(L, x, z, m) {
    m = m == null ? 0.35 : m;
    for (const R of L.rooms) if (x > R.x0 + m && x < R.x1 - m && z > R.z0 + m && z < R.z1 - m) return true;
    for (const c of L.corridors) if (x > c.x0 + m && x < c.x1 - m && z > c.z0 - 0.5 && z < c.z1 + 0.5) return true;
    for (const d of L.doors) {
      if (d.outer && d.kind) continue;
      if (d.axis === 'x') { if (Math.abs(x - d.x) < d.t / 2 + m + 0.3 && Math.abs(z - d.z) < d.w / 2 - m) return true; }
      else { if (Math.abs(z - d.z) < d.t / 2 + m + 0.3 && Math.abs(x - d.x) < d.w / 2 - m) return true; }
    }
    return false;
  }

  function roomAt(L, x, z) {
    for (const R of L.rooms) if (x >= R.x0 && x <= R.x1 && z >= R.z0 && z <= R.z1) return R;
    return null;
  }

  window.UW_LAYOUT = { computeLayout, walkable, roomAt, GAP, DOOR_W, DOOR_H };
})();
