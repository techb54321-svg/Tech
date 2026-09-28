/* The Universe Within — application: state, floor plan, walkthrough, inspector,
   projection player, budget, scenario comparison, saving and export. */
(function () {
  'use strict';
  const M = window.UW_MODEL, C = window.UW_CONTENT || { rooms: {} }, W = window.UW_WORLD, A = window.UW_AUDIO;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const aud = n => (n < 0 ? '−' : '') + '$' + Math.round(Math.abs(n)).toLocaleString('en-AU');
  const audK = n => Math.abs(n) >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'm' : Math.abs(n) >= 1e4 ? '$' + Math.round(n / 1000) + 'k' : aud(n);
  const clone = o => JSON.parse(JSON.stringify(o));
  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  const VIEW_LABEL = { entrance: 'Entrance view', eye: 'Visitor eye level', detail: 'Close-up', overview: 'Room from above', venue: 'Overview', free: 'Free look' };
  const roomName = id => (C.rooms[id] && C.rooms[id].name) || M.ROOM_NAMES[id];
  const elInfo = id => { const e = M.EL[id]; const r = e && C.rooms[e.room]; return Object.assign({ name: e ? e.name : id, kind: e ? e.kind : 'physical' }, r && r.elements ? r.elements[id] : {}, { kind: e ? e.kind : 'physical' }); };

  // ---------- state ----------
  function normalise(cfg) {
    const base = M.baseConfig();
    const out = { name: cfg.name || 'Untitled', scenario: cfg.scenario || 'custom', rooms: [], budget: Object.assign(base.budget, cfg.budget || {}) };
    out.budget.rates = Object.assign(M.baseConfig().budget.rates, (cfg.budget && cfg.budget.rates) || {});
    out.budget.overrides = (cfg.budget && cfg.budget.overrides) || {};
    const seen = new Set();
    (cfg.rooms || []).forEach(r => {
      if (!M.ROOM_NAMES[r.id] || seen.has(r.id)) return; seen.add(r.id);
      const d = M.defaultRoom(r.id);
      const n = Object.assign(d, r); n.elements = Object.assign(M.defaultRoom(r.id).elements, r.elements || {}); n.opts = Object.assign(M.defaultRoom(r.id).opts, r.opts || {});
      ['w', 'd', 'h', 'coverage', 'modelScale', 'light', 'visitors', 'diy'].forEach(k => { n[k] = Number(n[k]); if (!isFinite(n[k])) n[k] = d[k]; });
      out.rooms.push(n);
    });
    M.ROOM_ORDER.forEach(id => { if (!seen.has(id)) { const d = M.defaultRoom(id); d.enabled = false; out.rooms.push(d); } });
    return out;
  }
  let config = normalise(store.get('uw.current') || M.scenario('polished'));
  const ui = {
    tab: 'walk', room: null, sub: 'settings', selEl: null, guided: false, step: 0, auto: false, autoT: 0,
    reduced: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    typeView: false, beams: true, hot: true, view: 'venue', cur: null,
    clocks: {}, signalTimes: [], pulseUntil: 0, playerOpen: false, pvRoom: null, confirmScenario: null, snapshots: {}
  };
  M.ROOM_ORDER.forEach(id => { ui.clocks[id] = { t: 0, playing: true }; });
  const enabledRooms = () => config.rooms.filter(r => r.enabled);
  const roomCfg = id => config.rooms.find(r => r.id === id);
  let budget = M.computeBudget(config);

  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 3200); }

  // ---------- world hooks ----------
  W.hooks.projTime = id => ui.clocks[id] ? ui.clocks[id].t : 0;
  W.hooks.projOpts = id => projOpts(id);
  W.hooks.onPick = (el, act) => { if (act) doAction(act); else if (el) selectElement(el, true); };
  function projOpts(id) {
    const r = roomCfg(id) || M.defaultRoom(id);
    return {
      variant: r.opts.mouthVariant, microbiome: !!r.elements.dig_microbiome, bpm: r.opts.bpm, signalTimes: ui.signalTimes,
      reduced: ui.reduced, vrPreview: r.opts.vrPreview, heartMode: r.opts.heartMode, pulseActive: performance.now() / 1000 < ui.pulseUntil,
      audioOn: id !== 'heart' || !!r.elements.heart_audio
    };
  }

  // ---------- change handling ----------
  let rebuildTimer = null, saveTimer = null;
  function changed(kind) {
    budget = M.computeBudget(config);
    $('#cfgName').textContent = config.name;
    if (kind !== 'budget') { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(rebuild, kind === 'slider' ? 180 : 0); }
    renderRoute(); renderInspectorCost();
    clearTimeout(changed.r); changed.r = setTimeout(() => {
      if (ui.tab === 'budget') renderBudget();
      if (ui.tab === 'plan') renderPlanDoc();
      if (ui.tab === 'compare') renderCompare();
    }, 0);
    clearTimeout(saveTimer); saveTimer = setTimeout(() => store.set('uw.current', config), 400);
  }
  function rebuild() {
    W.build(config);
    W.setCutaway(W.getCutaway());
    renderPlan(); buildHotspots();
    if (ui.room && !roomCfg(ui.room).enabled) ui.room = null;
  }

  // ---------- floor plan ----------
  function planSVG(L, opts) {
    opts = opts || {};
    if (!L.rooms.length) return '<svg viewBox="0 0 10 4"><text x="1" y="2" fill="#b1a390" font-size="0.8">No rooms on the route</text></svg>';
    const b = L.bounds, vb = `${b.x0} ${b.z0} ${b.x1 - b.x0} ${b.z1 - b.z0}`, fs = Math.max(1.1, (b.x1 - b.x0) / 34);
    let s = `<svg viewBox="${vb}" role="img" aria-label="${opts.aria || 'Floor plan'}"><defs><marker id="${opts.id || 'ar'}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#cf9154"/></marker></defs>`;
    s += `<rect x="${b.x0 + 1}" y="${b.z0 + 1}" width="${b.x1 - b.x0 - 2}" height="${b.z1 - b.z0 - 2}" fill="none" stroke="#2c2520" stroke-width="0.15" stroke-dasharray="0.6 0.4"/>`;
    L.corridors.forEach(c => { s += `<rect x="${c.x0}" y="${c.z0}" width="${c.x1 - c.x0}" height="${c.z1 - c.z0}" fill="#1b1714" stroke="#5a4d42" stroke-width="0.1"/>`; });
    L.rooms.forEach((R, i) => {
      const cur = opts.current === R.id ? ' current' : '';
      s += `<g class="plan-room${cur}" data-room="${R.id}" tabindex="${opts.interactive ? 0 : -1}" role="${opts.interactive ? 'button' : 'presentation'}" aria-label="${esc(roomName(R.id))}, room ${i + 1}">`;
      s += `<rect class="floor" x="${R.x0}" y="${R.z0}" width="${R.w}" height="${R.d}" rx="0.15"/>`;
      s += `<text class="num" x="${R.x0 + 0.5}" y="${R.z0 + fs * 1.3}" style="font-size:${fs * 1.15}px">${i + 1}</text><text x="${R.x0 + 0.5}" y="${R.z0 + fs * 2.5}" style="font-size:${fs}px">${esc(M.ROOM_SHORT[R.id])}</text>`;
      if (R.cfg.openToNext) s += `<text x="${R.x0 + 0.5}" y="${R.z0 + fs * 3.6}" style="font-size:${fs * 0.8}px;fill:#9db48a">combined with next</text>`;
      s += `</g>`;
    });
    L.doors.forEach(d => {
      const col = d.kind ? '#cf9154' : '#110e0c';
      if (d.axis === 'x') s += `<line x1="${d.x}" y1="${d.z - d.w / 2}" x2="${d.x}" y2="${d.z + d.w / 2}" stroke="${col}" stroke-width="${d.kind ? 0.25 : 0.5}"/>`;
      else s += `<line x1="${d.x - d.w / 2}" y1="${d.z}" x2="${d.x + d.w / 2}" y2="${d.z}" stroke="${col}" stroke-width="0.5"/>`;
      if (d.kind) s += `<text x="${d.x + (d.kind === 'entry' ? -0.4 : 0.4)}" y="${d.z - d.w / 2 - 0.4}" text-anchor="${d.kind === 'entry' ? 'end' : 'start'}" style="font:600 ${fs * 0.85}px IBM Plex Sans,sans-serif;fill:#cf9154">${d.kind === 'entry' ? 'Enter' : 'Exit'}</text>`;
    });
    if (opts.hotspots) opts.hotspots.forEach(h => { const k = M.EL[h.el]; if (!k) return; s += `<circle cx="${h.pos.x.toFixed(2)}" cy="${h.pos.z.toFixed(2)}" r="0.32" fill="${M.KINDS[k.kind].colour}" opacity="0.9"><title>${esc(k.name)}</title></circle>`; });
    const pts = L.route.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ');
    s += `<polyline points="${pts}" fill="none" stroke="#cf9154" stroke-width="0.18" stroke-linejoin="round" stroke-dasharray="0.7 0.35" marker-mid="url(#${opts.id || 'ar'})" marker-end="url(#${opts.id || 'ar'})" opacity="0.9"/>`;
    const dg = L.rooms.find(R => R.id === 'digestive');
    if (dg && dg.cfg.elements.dig_stepfree) {
      const v = dg.d - 1.5, z = dg.row === 0 ? dg.z0 + v : dg.z1 - v;
      s += `<line x1="${dg.x0 + 0.3}" y1="${z}" x2="${dg.x1 - 0.3}" y2="${z}" stroke="#9db48a" stroke-width="0.2" stroke-dasharray="0.5 0.3"/>`;
    }
    if (opts.marker) s += `<g id="vpMarker"><path d="M0,0 L4,-1.6 A4.3,4.3 0 0 1 4,1.6 Z" fill="#ece3d4" opacity="0.25"/><circle r="0.45" fill="#ece3d4" stroke="#110e0c" stroke-width="0.12"/></g>`;
    return s + '</svg>';
  }
  function renderPlan() {
    const L = W.layout(); if (!L) return;
    $('#planWrap').innerHTML = planSVG(L, { interactive: true, hotspots: W.hotspots().filter(h => roomCfg(h.room).elements[h.el]), marker: true, current: ui.room, aria: 'Floor plan: select a room to go to it', id: 'arMain' });
    $$('#planWrap .plan-room').forEach(g => {
      const go = () => goRoom(g.dataset.room, 'entrance');
      g.addEventListener('click', go);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }
  function renderPlanLegend() {
    $('#planLegend').innerHTML = `<span><span class="ln"></span>Visitor route</span><span><span class="ln dash"></span>Step-free alternative</span>` +
      Object.entries(M.KINDS).map(([k, v]) => `<span><i style="background:${v.colour}"></i>${v.label}</span>`).join('') + `<span><i style="background:#ece3d4"></i>Your viewpoint</span>`;
    $('#typeLegend').innerHTML = Object.entries(M.KINDS).map(([k, v]) => `<span><i style="background:${v.colour}"></i>${v.label}</span>`).join('');
  }
  function updateMarker() {
    const m = document.getElementById('vpMarker'); if (!m) return;
    const c = W.camState(); const ang = Math.atan2(Math.cos(c.yaw), Math.sin(c.yaw)) * 180 / Math.PI;
    m.setAttribute('transform', `translate(${c.x.toFixed(2)},${c.z.toFixed(2)}) rotate(${ang.toFixed(1)})`);
    $$('#planWrap .plan-room').forEach(g => g.classList.toggle('current', g.dataset.room === (ui.cur || ui.room)));
  }

  // ---------- route list (reorder / combine / remove) ----------
  function renderRoute() {
    const en = enabledRooms();
    $('#routeList').innerHTML = en.map((r, i) => {
      const last = i === en.length - 1;
      return `<li class="${(ui.cur || ui.room) === r.id ? 'current' : ''}"><span class="n">${i + 1}</span>
        <button class="nm" data-go="${r.id}">${esc(roomName(r.id))}</button>
        <span class="acts">
          <button class="icon-btn" data-up="${r.id}" ${i === 0 ? 'disabled' : ''} aria-label="Move ${esc(M.ROOM_SHORT[r.id])} earlier">↑</button>
          <button class="icon-btn" data-down="${r.id}" ${last ? 'disabled' : ''} aria-label="Move ${esc(M.ROOM_SHORT[r.id])} later">↓</button>
          <button class="icon-btn" data-comb="${r.id}" ${last ? 'disabled' : ''} aria-pressed="${!!r.openToNext && !last}" aria-label="Combine ${esc(M.ROOM_SHORT[r.id])} with the next room" title="Combine with next room (removes the dividing wall)">⇔</button>
          <button class="icon-btn" data-rm="${r.id}" ${en.length === 1 ? 'disabled' : ''} aria-label="Remove ${esc(M.ROOM_SHORT[r.id])} from the route" title="Remove from route">×</button>
        </span>${r.openToNext && !last ? `<span class="combine-note">Shares one open space with ${esc(M.ROOM_SHORT[en[i + 1].id])}</span>` : ''}</li>`;
    }).join('');
    const off = config.rooms.filter(r => !r.enabled);
    $('#removedWrap').innerHTML = off.length ? `<div class="removed">Removed: ${off.map(r => `<button class="btn" data-restore="${r.id}">Restore ${esc(M.ROOM_SHORT[r.id])}</button>`).join('')}</div>` : '';
  }
  function moveRoom(id, dir) {
    const en = enabledRooms(); const i = en.findIndex(r => r.id === id), j = i + dir; if (j < 0 || j >= en.length) return;
    const a = config.rooms.indexOf(en[i]), b = config.rooms.indexOf(en[j]);
    [config.rooms[a], config.rooms[b]] = [config.rooms[b], config.rooms[a]];
    config.scenario = 'custom'; changed('layout'); toast(`${M.ROOM_SHORT[id]} moved ${dir < 0 ? 'earlier' : 'later'} in the route`);
  }
  $('#routeList').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.go) goRoom(b.dataset.go, 'entrance');
    if (b.dataset.up) moveRoom(b.dataset.up, -1);
    if (b.dataset.down) moveRoom(b.dataset.down, 1);
    if (b.dataset.comb) { const r = roomCfg(b.dataset.comb); r.openToNext = !r.openToNext; config.scenario = 'custom'; changed('layout'); toast(r.openToNext ? 'Rooms combined: the dividing wall is removed' : 'Rooms separated again'); }
    if (b.dataset.rm) { const r = roomCfg(b.dataset.rm); r.enabled = false; if (ui.room === r.id) ui.room = null; config.scenario = 'custom'; changed('layout'); toast(`${M.ROOM_SHORT[r.id]} removed from the route. Restore it below the list.`); }
  });
  $('#removedWrap').addEventListener('click', e => { const b = e.target.closest('[data-restore]'); if (!b) return; roomCfg(b.dataset.restore).enabled = true; changed('layout'); toast(`${M.ROOM_SHORT[b.dataset.restore]} restored`); });

  // ---------- navigation ----------
  function goRoom(id, view, instant) {
    if (id && !roomCfg(id).enabled) return;
    ui.view = view; ui.room = id || ui.room;
    W.goView(id, view, instant || ui.reduced);
    setWhere(id, view);
    if (id) { renderInspector(); }
    $$('#freeBar [data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  }
  function setWhere(id, view) { $('#whereRoom').textContent = id && view !== 'venue' ? roomName(id) : 'Whole venue'; $('#whereView').textContent = VIEW_LABEL[view] || ''; }
  $('#freeBar').addEventListener('click', e => {
    const b = e.target.closest('[data-view]'); if (!b) return;
    const id = ui.cur || ui.room || (enabledRooms()[0] || {}).id;
    goRoom(b.dataset.view === 'venue' ? null : id, b.dataset.view);
  });
  $('#walkBtn').addEventListener('click', () => { W.setWalk(); ui.view = 'free'; setWhere(ui.cur || ui.room, 'eye'); toast('Eye level: drag to look, W A S D or arrow keys to walk'); $('#gl').focus(); });
  $('#gl').addEventListener('pointerdown', () => { if (ui.view !== 'free') { ui.view = 'free'; $('#whereView').textContent = VIEW_LABEL.free; $$('#freeBar [data-view]').forEach(b => b.setAttribute('aria-pressed', 'false')); } });

  // ---------- hotspots overlay ----------
  let hotEls = [];
  function buildHotspots() {
    const layer = $('#hotLayer'); layer.innerHTML = ''; hotEls = [];
    W.hotspots().forEach(h => {
      const info = M.EL[h.el]; if (!info) return;
      const b = document.createElement('button'); b.className = 'hot'; b.type = 'button';
      b.style.setProperty('--kc', M.KINDS[info.kind].colour);
      b.innerHTML = `<span class="dot"></span><span class="lab">${esc(info.name)} · ${esc(M.KINDS[info.kind].label)}</span>`;
      b.setAttribute('aria-label', `${info.name} (${M.KINDS[info.kind].label}) — show details`);
      b.addEventListener('click', () => selectElement(h.el, true));
      layer.appendChild(b); hotEls.push({ b, h, room: h.room });
    });
    const L = W.layout();
    (L ? L.rooms : []).forEach((R, i) => {
      const b = document.createElement('button'); b.className = 'hot room-tag'; b.type = 'button';
      b.style.setProperty('--kc', '#cf9154');
      b.innerHTML = `<span class="dot"></span><span class="lab">${i + 1} · ${esc(M.ROOM_SHORT[R.id])}</span>`;
      b.setAttribute('aria-label', `Go to ${roomName(R.id)}`);
      b.addEventListener('click', () => goRoom(R.id, 'entrance'));
      layer.appendChild(b); hotEls.push({ b, tag: true, pos: new THREE.Vector3(R.cx, R.h + 0.5, R.cz), room: R.id });
    });
  }
  function updateHotspots() {
    const vp = $('#viewport').getBoundingClientRect();
    const c = W.camState(); const high = c.y > 9;
    const focusRoom = ui.cur || (ui.view === 'overview' ? ui.room : null);
    hotEls.forEach(o => {
      let show = ui.hot;
      const pos = o.tag ? o.pos : o.h.pos;
      if (o.tag) show = show && high && ui.view !== 'overview';
      else show = show && !!roomCfg(o.room).elements[o.h.el] && (o.room === focusRoom) && W.dist(pos) < 26;
      if (show) { const p = W.project(pos); if (p.behind || Math.abs(p.x) > 1.05 || Math.abs(p.y) > 1.05) show = false; else { o.b.style.left = ((p.x + 1) / 2 * vp.width) + 'px'; o.b.style.top = ((1 - p.y) / 2 * vp.height) + 'px'; } }
      o.b.hidden = !show;
      if (!o.tag) o.b.classList.toggle('sel', ui.selEl === o.h.el);
    });
  }

  // ---------- actions ----------
  function doAction(act) {
    if (act === 'mouth:water' || act === 'mouth:sugar') { const r = roomCfg('mouth'); r.opts.mouthVariant = act.split(':')[1]; ui.clocks.mouth.t = 0; changed('room'); renderInspector(); toast(r.opts.mouthVariant === 'water' ? 'Projection sequence switched to water' : 'Projection sequence switched to a sugary drink'); }
    if (act === 'heart:pulse') pulseDemo();
    if (act === 'signals:trigger') triggerSignal();
  }
  function triggerSignal() {
    const t = ui.clocks.signals.t; ui.signalTimes.push(t); ui.signalTimes = ui.signalTimes.slice(-6);
    W.triggerSignal(performance.now() / 1000); A.signal(ui.reduced ? 8 : 3);
    toast('Signal triggered. Slowed and magnified: a simplified representation.');
  }
  function pulseDemo() {
    ui.pulseUntil = performance.now() / 1000 + 6; A.pulseDemo(roomCfg('heart').opts.bpm);
    toast('Pulse demonstration: a pre-set rhythm. It does not measure your pulse.');
  }

  // ---------- inspector ----------
  function inspRoom() { return ui.room || ui.cur || (enabledRooms()[0] || config.rooms[0]).id; }
  function renderInspector() {
    const id = inspRoom(), r = roomCfg(id), c = C.rooms[id] || {};
    const idx = enabledRooms().findIndex(x => x.id === id);
    $('#insIndex').textContent = r.enabled ? `Room ${idx + 1} of ${enabledRooms().length}` : 'Removed from route';
    $('#insName').textContent = roomName(id);
    $('#insStrap').textContent = c.strapline || '';
    $('#insRoomSel').innerHTML = enabledRooms().map(x => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${esc(roomName(x.id))}</option>`).join('');
    renderSettings(id); renderElements(id); renderPlanning(id);
  }
  $('#insRoomSel').addEventListener('change', e => { ui.room = e.target.value; ui.selEl = null; renderInspector(); });
  $$('.subtabs button').forEach(b => b.addEventListener('click', () => setSub(b.dataset.sub)));
  function setSub(s) { ui.sub = s; $$('.subtabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.sub === s))); ['settings', 'elements', 'planning'].forEach(k => { $('#sub-' + k).hidden = k !== s; }); }

  const SLIDERS = [
    ['w', 'Width', 5, 30, 0.5, v => v.toFixed(1) + ' m'], ['d', 'Depth', 5, 20, 0.5, v => v.toFixed(1) + ' m'], ['h', 'Ceiling height', 3.5, 10, 0.5, v => v.toFixed(1) + ' m'],
    ['coverage', 'Projection coverage of walls', 0, 100, 5, v => v + '%'], ['modelScale', 'Model scale', 0.5, 1.5, 0.05, v => '×' + v.toFixed(2)],
    ['light', 'Lighting level', 0, 100, 5, v => v + '%'], ['visitors', 'Visitors shown (for scale)', 0, 40, 1, v => String(v)], ['diy', 'Content you make yourself', 0, 100, 5, v => v + '%']
  ];
  function slider(key, label, min, max, step, val, fmt, extra) {
    return `<div class="field"><label for="s_${key}">${label}</label><output id="o_${key}">${fmt(val)}</output><input id="s_${key}" type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-k="${key}" ${extra || ''}></div>`;
  }
  function renderSettings(id) {
    const r = roomCfg(id), o = r.opts;
    let h = `<div class="group-title">Room dimensions and atmosphere</div>`;
    SLIDERS.forEach(([k, lab, mn, mx, st, f]) => { if (k === 'coverage' && id === 'vr') return; h += slider(k, lab, mn, mx, st, r[k], f); });
    h += `<p class="hint">Visitor figures show scale only. This is not a capacity: occupancy must be set by a building surveyor for the actual venue.</p>`;
    h += `<div class="group-title">Room options</div>`;
    if (id === 'mouth') {
      h += `<div class="field"><label for="o_variant">Drink shown in the projection</label><select id="o_variant" data-o="mouthVariant"><option value="water" ${o.mouthVariant === 'water' ? 'selected' : ''}>Water</option><option value="sugar" ${o.mouthVariant === 'sugar' ? 'selected' : ''}>Sugary drink</option></select></div>`;
      h += slider('teeth', 'Number of oversized teeth', 2, 16, 1, o.teeth, v => String(v), 'data-ok="teeth"');
    }
    if (id === 'heart') {
      h += `<div class="field"><label for="o_hm">Heart build option</label><select id="o_hm" data-o="heartMode"><option value="printed" ${o.heartMode === 'printed' ? 'selected' : ''}>3D-printed model (~1.2 m)</option><option value="fabricated" ${o.heartMode === 'fabricated' ? 'selected' : ''}>Fabricated sculpture (~2.6 m)</option><option value="projection" ${o.heartMode === 'projection' ? 'selected' : ''}>Projection-enhanced model (~2.6 m)</option></select></div>`;
      h += slider('bpm', 'Heart rate for projections and audio', 50, 110, 1, o.bpm, v => v + ' bpm', 'data-ok="bpm"');
      h += `<div class="row wrap"><button class="btn" id="cutBtn" aria-pressed="${W.getCutaway()}">${W.getCutaway() ? 'Hide' : 'Show'} construction cutaway</button><button class="btn" id="pulseBtn" ${r.elements.heart_pulse ? '' : 'disabled'}>Try the pulse demonstration</button></div>`;
    }
    if (id === 'digestive') h += `<p class="hint">Turn the microbiome scene and step-free route on or off under Installations.</p>`;
    if (id === 'signals') {
      h += `<div class="field"><label for="o_ct">Visitor control</label><select id="o_ct" data-o="controlType"><option value="tactile" ${o.controlType === 'tactile' ? 'selected' : ''}>Tactile push button</option><option value="touchfree" ${o.controlType === 'touchfree' ? 'selected' : ''}>Touch-free hover sensor</option></select></div>`;
      h += `<button class="btn primary" id="sigBtn" ${r.elements.sig_control ? '' : 'disabled'}>Trigger a signal</button>`;
    }
    if (id === 'vr') {
      h += slider('vrSeated', 'Seated headset stations', 0, 6, 1, o.vrSeated, v => String(v), 'data-ok="vrSeated"');
      h += slider('vrStanding', 'Standing headset zones', 0, 6, 1, o.vrStanding, v => String(v), 'data-ok="vrStanding"');
      h += `<div class="field"><label for="o_vp">VR experience previewed on the large screen</label><select id="o_vp" data-o="vrPreview"><option value="bloodstream" ${o.vrPreview === 'bloodstream' ? 'selected' : ''}>Ride the bloodstream</option><option value="sip" ${o.vrPreview === 'sip' ? 'selected' : ''}>Inside the sip</option><option value="cell" ${o.vrPreview === 'cell' ? 'selected' : ''}>Into the cell</option></select></div>`;
    }
    if (id === 'entrance' || id === 'cellular') h += `<p class="hint">${id === 'entrance' ? 'The main wall is always at least 90% covered; other walls follow the coverage setting.' : 'Coverage of 100% gives a full surround; the floor projection is under Installations.'}</p>`;
    h += `<div class="group-title">Equipment this room implies</div><div class="eq-grid" id="eqGrid"></div>`;
    h += `<div class="room-cost" id="roomCost"></div><p class="hint">Room-specific one-off costs, excluding GST. Shared costs (equipment, venue, staff) are in the Budget tab.</p>`;
    h += `<button class="btn" id="resetRoom">Reset this room to the polished defaults</button>`;
    const el = $('#sub-settings'); el.innerHTML = h;
    renderInspectorCost();
    el.querySelectorAll('input[type=range]').forEach(inp => inp.addEventListener('input', () => {
      const v = Number(inp.value);
      if (inp.dataset.k) { r[inp.dataset.k] = v; const s = SLIDERS.find(x => x[0] === inp.dataset.k); $('#o_' + inp.dataset.k).textContent = s[5](v); }
      if (inp.dataset.ok) { r.opts[inp.dataset.ok] = v; $('#o_' + inp.dataset.ok).textContent = inp.dataset.ok === 'bpm' ? v + ' bpm' : String(v); }
      config.scenario = 'custom';
      changed(inp.dataset.ok === 'bpm' ? 'budget' : 'slider');
    }));
    el.querySelectorAll('select[data-o]').forEach(s => s.addEventListener('change', () => { r.opts[s.dataset.o] = s.value; if (s.dataset.o === 'mouthVariant') ui.clocks.mouth.t = 0; config.scenario = 'custom'; changed('room'); renderElements(id); }));
    const cb = $('#cutBtn'); if (cb) cb.addEventListener('click', () => { W.setCutaway(!W.getCutaway()); renderSettings(id); toast(W.getCutaway() ? 'Cutaway: the shell is ghosted to show the armature' : 'Cutaway hidden'); });
    const pb = $('#pulseBtn'); if (pb) pb.addEventListener('click', pulseDemo);
    const sb = $('#sigBtn'); if (sb) sb.addEventListener('click', triggerSignal);
    $('#resetRoom').addEventListener('click', () => { const d = M.defaultRoom(id); const i = config.rooms.indexOf(r); d.enabled = r.enabled; d.openToNext = r.openToNext; config.rooms[i] = d; changed('layout'); renderInspector(); toast('Room reset'); });
  }
  function renderInspectorCost() {
    const id = inspRoom(), r = roomCfg(id); if (!r || !$('#eqGrid')) return;
    const e = M.roomEquipment(r);
    const items = [['projectors', 'Projectors'], ['speakers', 'Speakers'], ['media', 'Media players'], ['sensors', 'Sensors'], ['headsets', 'Headsets incl. spares'], ['touch', 'Touchscreens']];
    $('#eqGrid').innerHTML = items.map(([k, l]) => `<div class="eq"><b>${e[k]}</b><span>${l}</span></div>`).join('') + `<div class="eq"><b>${Math.round(e.projArea + e.floorProjArea)}</b><span>m² projected</span></div><div class="eq"><b>${(r.w * r.d).toFixed(0)}</b><span>m² floor</span></div><div class="eq"><b>${e.displays}</b><span>Large displays</span></div>`;
    const sum = budget.lines.filter(l => l.room === id).reduce((s, l) => s + l.amount, 0);
    $('#roomCost').innerHTML = `<span>Room one-off costs</span><b>${aud(sum)}</b>`;
  }

  function kindChip(kind) { return `<span class="kind-chip" style="--kc:${M.KINDS[kind].colour}">${esc(M.KINDS[kind].label)}</span>`; }
  function renderElements(id) {
    const r = roomCfg(id);
    const els = M.ELEMENTS.filter(e => e.room === id);
    let h = '';
    if (ui.selEl && M.EL[ui.selEl] && M.EL[ui.selEl].room === id) h += elementCard(ui.selEl);
    h += `<div class="group-title">Switch installations on or off</div>`;
    h += els.map(e => {
      const inf = elInfo(e.id);
      return `<div class="el-row ${ui.selEl === e.id ? 'sel' : ''}"><label class="switch"><input type="checkbox" data-el="${e.id}" ${r.elements[e.id] ? 'checked' : ''} aria-label="${esc(e.name)} on or off"><span></span></label>
        <button class="el-name" data-show="${e.id}">${esc(inf.name || e.name)}<small>${esc(M.KINDS[e.kind].label)}${r.elements[e.id] ? '' : ' · off'}</small></button>${kindChip(e.kind)}</div>`;
    }).join('');
    const el = $('#sub-elements'); el.innerHTML = h;
    el.querySelectorAll('input[data-el]').forEach(c => c.addEventListener('change', () => {
      r.elements[c.dataset.el] = c.checked; config.scenario = 'custom'; changed('room');
      toast(`${M.EL[c.dataset.el].name} ${c.checked ? 'switched on' : 'switched off'}`);
      renderElements(id); if (id === 'heart' || id === 'signals') renderSettings(id);
    }));
    el.querySelectorAll('[data-show]').forEach(b => b.addEventListener('click', () => selectElement(b.dataset.show, false)));
    el.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => doAction(b.dataset.act)));
    const cl = el.querySelector('[data-close]'); if (cl) cl.addEventListener('click', () => { ui.selEl = null; renderElements(id); });
    const fly = el.querySelector('[data-fly]'); if (fly) fly.addEventListener('click', () => { const hs = W.hotspots().find(x => x.el === fly.dataset.fly); if (hs) { const p = hs.pos.clone(); W.flyTo(p.clone().add(new THREE.Vector3(2.2, 0.6, 2.2)), p, 'orbit', ui.reduced); ui.view = 'free'; } });
  }
  const MODEL_AS = {
    projection: 'Shown as imagery on a surface. Beams trace the projector throw; projectors hang from the trusses.',
    physical: 'Shown as a physical object. Proportions are indicative; detailed geometry is provisional.',
    headset: 'Shown as stations and marked zones; the experience itself runs inside the headset.',
    interactive: 'Shown as a control plinth or screen. Click its button in the 3D view to try it.',
    av: 'Shown as speakers or equipment. Sound sketches play when sound is on.'
  };
  function elementCard(k) {
    const inf = elInfo(k), kind = inf.kind, r = roomCfg(M.EL[k].room);
    let extra = '';
    if (k === 'heart_model' || k === 'heart_construction') extra += heartCompare(r);
    if (k === 'heart_construction') extra += constructionSVG();
    if (k === 'mouth_choice') extra += `<div class="row"><button class="btn ${r.opts.mouthVariant === 'water' ? 'primary' : ''}" data-act="mouth:water">Water</button><button class="btn ${r.opts.mouthVariant === 'sugar' ? 'primary' : ''}" data-act="mouth:sugar">Sugary drink</button></div>`;
    if (k === 'sig_control') extra += `<button class="btn primary" data-act="signals:trigger">Trigger a signal</button>`;
    if (k === 'heart_pulse') extra += `<div class="review-flag">Demonstration only. The pad plays a pre-set rhythm; it does not detect, measure or record anything.</div><button class="btn" data-act="heart:pulse">Try the demonstration</button>`;
    return `<div class="card-el" style="--kc:${M.KINDS[kind].colour}">
      <div class="row" style="justify-content:space-between;align-items:start"><h3>${esc(inf.name)}</h3><button class="btn" data-close>Close</button></div>
      <div class="row wrap">${kindChip(kind)}<span class="status-chip">${esc(inf.status || 'Concept')}</span>${inf.maker ? `<span class="status-chip">Made by: ${esc(inf.maker)}</span>` : ''}</div>
      <dl><dt>Purpose</dt><dd>${esc(inf.purpose || '')}</dd><dt>Visitor interaction</dt><dd>${esc(inf.interaction || '')}</dd><dt>Approx. footprint</dt><dd>${esc(inf.footprint || '')}</dd><dt>Production</dt><dd>${esc(inf.production || '')}</dd><dt>In this model</dt><dd>${MODEL_AS[kind]}</dd></dl>
      ${extra}
      <div class="row wrap"><button class="btn" data-fly="${k}">Look at it</button></div>
    </div>`;
  }
  function heartCompare(r) {
    const rows = [
      ['printed', '3D-printed model', '~1.2 m on a pedestal', 'Segmented large-format print, filled, primed, painted', 'Fastest; can be derived from imaging data you prepare; smaller presence'],
      ['fabricated', 'Fabricated sculpture', '~2.6 m on a low plinth', 'Steel armature, CNC-milled foam segments, hard coat, hand-painted', 'Strongest physical presence; longest lead time; needs structural review'],
      ['projection', 'Projection-enhanced', '~2.6 m, neutral finish', 'As fabricated but matte white, with projection mapping', 'Can show flow and the cardiac cycle on the surface; adds projectors and alignment work']
    ];
    const cost = { printed: 18000, fabricated: 68000, projection: 46000 };
    return `<div class="table-wrap"><table><thead><tr><th>Option</th><th>Size</th><th>How it is made</th><th>Trade-off</th><th class="num">Sculpture (prov.)</th></tr></thead><tbody>${rows.map(x => `<tr${r.opts.heartMode === x[0] ? ' style="background:#2a2119"' : ''}><td>${x[1]}${r.opts.heartMode === x[0] ? ' <span class="status-chip">selected</span>' : ''}</td><td>${x[2]}</td><td>${x[3]}</td><td>${x[4]}</td><td class="num">${aud(cost[x[0]] * r.modelScale * r.modelScale)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function constructionSVG() {
    return `<figure style="margin:0"><svg viewBox="0 0 320 230" role="img" aria-label="Section diagram of how the heart sculpture could be built" style="width:100%;background:#15110e;border-radius:4px">
      <rect x="40" y="195" width="240" height="18" fill="#2b2622" stroke="#6b5d50"/><text x="160" y="208" fill="#cdbfae" font-size="9" text-anchor="middle">Plinth: ply/steel frame, levelling feet, fixed to floor</text>
      <path d="M160 40 C 230 40 250 90 235 130 C 220 170 185 185 160 190 C 120 180 90 160 85 120 C 80 80 110 45 160 40 Z" fill="none" stroke="#9a3a30" stroke-width="6" opacity="0.8"/>
      <path d="M160 40 C 230 40 250 90 235 130 C 220 170 185 185 160 190 C 120 180 90 160 85 120 C 80 80 110 45 160 40 Z" fill="none" stroke="#d8cdb9" stroke-width="1.2" stroke-dasharray="4 3"/>
      <line x1="160" y1="60" x2="160" y2="195" stroke="#8a8580" stroke-width="5"/>
      <ellipse cx="160" cy="95" rx="55" ry="6" fill="none" stroke="#8a8580" stroke-width="2"/><ellipse cx="160" cy="140" rx="62" ry="6" fill="none" stroke="#8a8580" stroke-width="2"/>
      <path d="M160 190 C 150 200 120 205 60 206" stroke="#d6a64f" stroke-width="1.5" fill="none" stroke-dasharray="3 2"/>
      <g fill="#cdbfae" font-size="9"><text x="252" y="70">Shell: CNC foam</text><text x="252" y="81">segments + hard coat</text><text x="252" y="100">Seams follow</text><text x="252" y="111">anatomical grooves</text>
      <text x="8" y="92">Steel post and</text><text x="8" y="103">ring frames</text><text x="8" y="150">Hand-painted,</text><text x="8" y="161">sealed finish</text><text x="8" y="182" fill="#d6a64f">Cable route to pads</text></g>
      <line x1="215" y1="75" x2="250" y2="70" stroke="#6b5d50"/><line x1="105" y1="95" x2="70" y2="95" stroke="#6b5d50"/></svg>
      <figcaption class="hint">Concept section, not an engineered design. Armature, fixings, plinth and floor loading need a structural engineer's review.</figcaption></figure>
      <button class="btn" id="cutToggle2" aria-pressed="${W.getCutaway()}">${W.getCutaway() ? 'Hide' : 'Show'} the cutaway in 3D</button>`;
  }
  $('#sub-elements').addEventListener('click', e => { if (e.target.id === 'cutToggle2') { W.setCutaway(!W.getCutaway()); renderElements(inspRoom()); renderSettings(inspRoom()); } });

  function selectElement(k, fromView) {
    const e = M.EL[k]; if (!e) return;
    ui.selEl = k; ui.room = e.room; renderInspector(); setSub('elements');
    if (window.innerWidth < 1180 && fromView) $('#sub-elements').scrollIntoView({ behavior: ui.reduced ? 'auto' : 'smooth', block: 'start' });
  }

  function list(arr) { return arr && arr.length ? `<ul class="bul">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="hint">—</p>'; }
  function planningHTML(id, open) {
    const c = C.rooms[id] || {};
    const sec = (title, body, o) => `<details class="pl" ${o ? 'open' : ''}><summary>${title}</summary><div class="body">${body}</div></details>`;
    let h = '';
    if (id === 'mouth') h += `<div class="gallery"><figure><img src="assets/mouth-concept-a.jpg" alt="AI-generated concept image of the inside of a mouth, looking towards the throat" loading="lazy"><figcaption>Your concept render A (AI-generated)</figcaption></figure><figure><img src="assets/mouth-concept-b.jpg" alt="Second AI-generated concept image of the oral cavity" loading="lazy"><figcaption>Your concept render B (AI-generated)</figcaption></figure></div><div class="review-flag">Mood and texture reference only. These images place upper molars on the palate and are not anatomically accurate; they need correction before use as projection content.</div>`;
    h += sec('What visitors see, hear and do', `${c.intro ? `<p>${esc(c.intro)}</p>` : ''}<h4>See</h4>${list(c.see)}<h4>Hear</h4>${list(c.hear)}<h4>Do</h4>${list(c.do)}`, open);
    h += sec('Structures, content and equipment', `<h4>Physical structures</h4>${list(c.physical)}<h4>Digital content</h4>${list(c.digital)}<h4>Equipment</h4>${list(c.equipment)}`, open);
    h += sec('What you could create yourself', list(c.diy), open);
    h += sec('Likely specialist input', list(c.specialist), open);
    h += sec('Time, dependencies and cost drivers', `<p><strong>Indicative time:</strong> ${esc(c.time || '')}</p><h4>Dependencies</h4>${list(c.dependencies)}<h4>Cost drivers</h4>${list(c.costDrivers)}`, open);
    h += sec('Access, sound spill, shadows and operations', `<h4>Accessibility</h4>${list(c.accessibility)}<h4>Sound spill</h4><p>${esc(c.soundSpill || '')}</p><h4>Projection shadows</h4><p>${esc(c.shadows || '')}</p><h4>Operations</h4>${list(c.operations)}`, open);
    h += sec('Science review and scale', `<h4>Needs expert review</h4>${list(c.scienceReview)}<h4>Making scale clear</h4><p>${esc(c.scaleNote || '')}</p>`, open);
    return h;
  }
  function renderPlanning(id) { $('#sub-planning').innerHTML = planningHTML(id, false); }

  // ---------- guided tour ----------
  function tourSteps() {
    const steps = [{ room: null, view: 'venue', text: 'This is the whole route, seen from above with the roof lifted away. Seven connected rooms in a brick warehouse take visitors from the scale of the body down to single molecules. The amber line is the visitor route.' }];
    enabledRooms().forEach(r => { const t = (C.rooms[r.id] && C.rooms[r.id].tour) || [{ view: 'entrance', text: roomName(r.id) }]; t.forEach(s => steps.push({ room: r.id, view: s.view, text: s.text })); });
    return steps;
  }
  function showStep(i) {
    const steps = tourSteps(); ui.step = Math.max(0, Math.min(steps.length - 1, i)); const s = steps[ui.step];
    goRoom(s.room, s.view); ui.autoT = 0;
    const cap = $('#caption'); cap.hidden = false;
    cap.innerHTML = `<span class="cap-room">${esc(s.room ? roomName(s.room) : 'The Universe Within')}</span>${esc(s.text)}`;
    $('#gCount').textContent = `Stop ${ui.step + 1} of ${steps.length}`;
    $('#gPrev').disabled = ui.step === 0; $('#gNext').disabled = ui.step === steps.length - 1;
    if (s.room) { ui.clocks[s.room].playing = true; }
  }
  function setGuided(on) {
    ui.guided = on; $('#modeGuided').setAttribute('aria-pressed', String(on)); $('#modeFree').setAttribute('aria-pressed', String(!on));
    $('#guidedBar').hidden = !on; $('#freeBar').hidden = on; $('#caption').hidden = !on;
    if (on) showStep(ui.step); else { ui.auto = false; $('#gPlay').setAttribute('aria-pressed', 'false'); $('#gPlay').textContent = 'Auto-play'; }
  }
  $('#modeGuided').addEventListener('click', () => setGuided(true));
  $('#modeFree').addEventListener('click', () => setGuided(false));
  $('#gPrev').addEventListener('click', () => showStep(ui.step - 1));
  $('#gNext').addEventListener('click', () => showStep(ui.step + 1));
  $('#gPlay').addEventListener('click', () => { ui.auto = !ui.auto; $('#gPlay').setAttribute('aria-pressed', String(ui.auto)); $('#gPlay').textContent = ui.auto ? 'Pause auto-play' : 'Auto-play'; ui.autoT = 0; });

  // ---------- projection preview player ----------
  const pv = $('#pv'), pctx = pv.getContext('2d');
  function openPlayer(id) {
    id = id || ui.cur || ui.room || 'entrance';
    ui.pvRoom = id; ui.playerOpen = true; $('#player').hidden = false;
    $('#playerTitle').textContent = roomName(id);
    const P = window.UW_PROJ, dur = P ? P.duration[id] : 0;
    $('#pvScrub').disabled = !dur;
    $('#pvChapters').innerHTML = (P && P.chapters[id] || []).map((c, i) => `<button data-t="${c.t}">${esc(c.label)}</button>`).join('');
    const r = roomCfg(id); let o = `<label>Room <select id="pvRoom">${M.ROOM_ORDER.map(x => `<option value="${x}" ${x === id ? 'selected' : ''}>${esc(M.ROOM_SHORT[x])}</option>`).join('')}</select></label>`;
    if (id === 'mouth') o += `<label>Drink <select id="pvVar"><option value="water" ${r.opts.mouthVariant === 'water' ? 'selected' : ''}>Water</option><option value="sugar" ${r.opts.mouthVariant === 'sugar' ? 'selected' : ''}>Sugary drink</option></select></label>`;
    if (id === 'digestive') o += `<label><input type="checkbox" id="pvMicro" ${r.elements.dig_microbiome ? 'checked' : ''}> Include microbiome scene</label>`;
    if (id === 'heart') o += `<label>Heart rate <input type="range" id="pvBpm" min="50" max="110" value="${r.opts.bpm}"> <span id="pvBpmV" class="mono">${r.opts.bpm} bpm</span></label><button class="btn" id="pvPulse">Pulse demonstration</button>`;
    if (id === 'signals') o += `<button class="btn primary" id="pvSig">Trigger a signal</button>`;
    if (id === 'vr') o += `<label>Experience <select id="pvVr"><option value="bloodstream" ${r.opts.vrPreview === 'bloodstream' ? 'selected' : ''}>Ride the bloodstream</option><option value="sip" ${r.opts.vrPreview === 'sip' ? 'selected' : ''}>Inside the sip</option><option value="cell" ${r.opts.vrPreview === 'cell' ? 'selected' : ''}>Into the cell</option></select></label>`;
    $('#pvOpts').innerHTML = o;
    $('#pvNote').textContent = id === 'vr' ? 'Flat preview of what a headset wearer would see; the same view can run on the large screen for visitors who do not use a headset.' : 'Procedural placeholder that sketches the intended projection content, pacing and scale changes. Final imagery would be produced from reviewed scientific references.';
    syncPlayerButtons();
    $('#playerClose').focus();
  }
  function syncPlayerButtons() {
    const c = ui.clocks[ui.pvRoom]; if (!c) return;
    $('#pvPlay').textContent = c.playing ? 'Pause' : 'Play'; $('#pvPlay').setAttribute('aria-pressed', String(c.playing));
    $('#pvSound').textContent = A.on ? 'Sound on' : 'Sound off'; $('#pvSound').setAttribute('aria-pressed', String(A.on));
  }
  function closePlayer() { ui.playerOpen = false; $('#player').hidden = true; $('#previewBtn').focus(); }
  $('#previewBtn').addEventListener('click', () => openPlayer());
  $('#playerClose').addEventListener('click', closePlayer);
  $('#player').addEventListener('click', e => { if (e.target.id === 'player') closePlayer(); });
  $('#pvPlay').addEventListener('click', () => { const c = ui.clocks[ui.pvRoom]; c.playing = !c.playing; syncPlayerButtons(); });
  $('#pvSound').addEventListener('click', () => { toggleSound(); syncPlayerButtons(); });
  $('#pvScrub').addEventListener('input', e => { const P = window.UW_PROJ, d = P ? P.duration[ui.pvRoom] : 0; if (d) ui.clocks[ui.pvRoom].t = Number(e.target.value) / 1000 * d; });
  $('#pvChapters').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) ui.clocks[ui.pvRoom].t = Number(b.dataset.t) + 0.01; });
  $('#pvOpts').addEventListener('change', e => {
    const r = roomCfg(ui.pvRoom);
    if (e.target.id === 'pvRoom') { openPlayer(e.target.value); return; }
    if (e.target.id === 'pvVar') { r.opts.mouthVariant = e.target.value; ui.clocks.mouth.t = 0; changed('room'); }
    if (e.target.id === 'pvMicro') { r.elements.dig_microbiome = e.target.checked; changed('room'); }
    if (e.target.id === 'pvVr') { r.opts.vrPreview = e.target.value; changed('budget'); }
    if (ui.room === ui.pvRoom) renderInspector();
  });
  $('#pvOpts').addEventListener('input', e => { if (e.target.id === 'pvBpm') { roomCfg('heart').opts.bpm = Number(e.target.value); $('#pvBpmV').textContent = e.target.value + ' bpm'; } });
  $('#pvOpts').addEventListener('click', e => { if (e.target.id === 'pvSig') triggerSignal(); if (e.target.id === 'pvPulse') pulseDemo(); });
  function drawPlayer() {
    const id = ui.pvRoom, P = window.UW_PROJ, c = ui.clocks[id];
    if (!P) { pctx.fillStyle = '#111'; pctx.fillRect(0, 0, 960, 540); return; }
    const opts = Object.assign(projOpts(id), { surface: 'preview' });
    try { P.draw(id, pctx, 960, 540, c.t, opts); } catch (e) { /* ignore */ }
    const d = P.duration[id];
    const tt = d ? c.t % d : c.t;
    $('#pvTime').textContent = `${Math.floor(tt / 60)}:${String(Math.floor(tt % 60)).padStart(2, '0')}${d ? ' / ' + Math.floor(d / 60) + ':' + String(Math.round(d % 60)).padStart(2, '0') : ' · continuous'}`;
    if (d && document.activeElement !== $('#pvScrub')) $('#pvScrub').value = String(Math.round(tt / d * 1000));
    const ch = P.chapters[id] || []; let cur = 0; ch.forEach((x, i) => { if (tt >= x.t) cur = i; });
    $$('#pvChapters button').forEach((b, i) => b.classList.toggle('on', i === cur));
  }

  // ---------- sound & motion ----------
  function toggleSound() {
    if (A.on) { A.disable(); } else if (!A.enable()) { toast('Sound is not available in this browser'); return; }
    $('#soundBtn').textContent = A.on ? 'Sound on' : 'Sound off'; $('#soundBtn').setAttribute('aria-pressed', String(A.on));
    toast(A.on ? 'Sound on: synthesised sketches of each room\'s sound design' : 'Sound off');
  }
  $('#soundBtn').addEventListener('click', toggleSound);
  $('#volume').addEventListener('input', e => A.setVolume(Number(e.target.value)));
  function setReduced(v) { ui.reduced = v; $('#motionBtn').setAttribute('aria-pressed', String(v)); }
  $('#motionBtn').addEventListener('click', () => { setReduced(!ui.reduced); toast(ui.reduced ? 'Reduced motion: jump cuts between views and slower imagery' : 'Full motion'); });

  // ---------- display toggles ----------
  $('#typeBtn').addEventListener('click', () => { ui.typeView = !ui.typeView; W.setTypeView(ui.typeView); $('#typeBtn').setAttribute('aria-pressed', String(ui.typeView)); $('#typeLegend').hidden = !ui.typeView; });
  $('#beamBtn').addEventListener('click', () => { ui.beams = !ui.beams; W.setBeams(ui.beams); $('#beamBtn').setAttribute('aria-pressed', String(ui.beams)); });
  $('#hotBtn').addEventListener('click', () => { ui.hot = !ui.hot; $('#hotBtn').setAttribute('aria-pressed', String(ui.hot)); });

  // ---------- tabs ----------
  function setTab(t) {
    ui.tab = t;
    $$('.tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    ['walk', 'plan', 'budget', 'compare', 'save', 'about'].forEach(k => { $('#pane-' + k).hidden = k !== t; });
    if (t === 'walk') setTimeout(W.resize, 0);
    if (t === 'budget') renderBudget();
    if (t === 'plan') renderPlanDoc();
    if (t === 'compare') renderCompare();
    if (t === 'save') renderSaves();
    if (t === 'about') renderAbout();
  }
  $$('.tabs [role=tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('.tabs').addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const tabs = $$('.tabs [role=tab]'); const i = tabs.indexOf(document.activeElement); if (i < 0) return;
    const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]; n.focus(); setTab(n.dataset.tab);
  });

  // ---------- budget ----------
  const CAT_COL = { content: '#cf9154', fabrication: '#d8cdb9', equipment: '#8fa6bb', installation: '#9db48a', venue: '#a47c62', staffing: '#b69bb0', insurance: '#7f9c9a', contingency: '#6e6259' };
  const rateMeta = id => M.RATES.find(r => r.id === id);
  const srcById = id => (window.UW_SOURCES || []).find(s => s.id === id);
  function badgeFor(line) {
    if (!line.rateId) return '<span class="badge provisional">Provisional</span>';
    const m = rateMeta(line.rateId); const st = m ? m.status : 'provisional';
    return `<span class="badge ${st}" title="${esc(m ? m.note : '')}">${st === 'sourced' ? 'Sourced' : st === 'derived' ? 'Derived' : 'Provisional'}</span>`;
  }
  function renderBudget() {
    const b = config.budget, B = budget;
    $('#budgetTiles').innerHTML = [
      ['One-off costs', B.oneoff, 'ex GST · build and set-up'],
      ['Recurring costs', B.recurring, `ex GST · ${b.runWeeks}-week run (${aud(B.perWeek)}/week)`],
      ['GST', B.gst, `${b.gstRate}% on taxable items (not wages)`],
      ['Total including GST', B.totalInc, 'one-off + recurring + GST', true],
      ['Your in-kind content', B.inKindValue, b.excludeInKind ? 'excluded from cash totals' : 'included in cash totals']
    ].map(([k, v, s, main]) => `<div class="tile ${main ? 'main' : ''}"><div class="k">${k}</div><div class="v">${aud(v)}</div><div class="s">${s}</div></div>`).join('');
    $('#budgetControls').innerHTML = `
      <label>Run length (weeks)<input type="number" id="b_run" min="1" max="104" value="${b.runWeeks}"></label>
      <label>Installation weeks<input type="number" id="b_inst" min="0" max="20" value="${b.installWeeks}"></label>
      <label>Opening hours per week<input type="number" id="b_hours" min="1" max="100" value="${b.hoursPerWeek}"></label>
      <label>Equipment<select id="b_eq"><option value="hire" ${b.equipMode === 'hire' ? 'selected' : ''}>Hire for the run</option><option value="buy" ${b.equipMode === 'buy' ? 'selected' : ''}>Purchase</option></select></label>
      <label>Contingency (%)<input type="number" id="b_cont" min="0" max="50" value="${b.contingencyPct}"></label>
      <label>GST rate (%)<input type="number" id="b_gst" min="0" max="20" step="0.5" value="${b.gstRate}"></label>
      <label class="chk"><input type="checkbox" id="b_ink" ${b.excludeInKind ? 'checked' : ''}> Leave my own content time out of cash costs</label>
      <div class="hint">Hire vs purchase for this run: ${altEquip()}</div>`;
    const bind = (id, key, num) => $(id).addEventListener('change', e => { b[key] = num ? Math.max(0, Number(e.target.value) || 0) : e.target.value; if (key === 'runWeeks' && b[key] < 1) b[key] = 1; config.scenario = 'custom'; changed('budget'); });
    bind('#b_run', 'runWeeks', 1); bind('#b_inst', 'installWeeks', 1); bind('#b_hours', 'hoursPerWeek', 1); bind('#b_eq', 'equipMode'); bind('#b_cont', 'contingencyPct', 1); bind('#b_gst', 'gstRate', 1);
    $('#b_ink').addEventListener('change', e => { b.excludeInKind = e.target.checked; changed('budget'); });
    const maxCat = Math.max(1, ...M.CATS.map(([k]) => B.byCat[k].oneoff + B.byCat[k].recurring));
    $('#budgetBars').innerHTML = M.CATS.map(([k, l]) => { const c = B.byCat[k]; const tot = c.oneoff + c.recurring; return `<div class="bar-row"><span>${l}</span><div class="bar-track" title="One-off ${aud(c.oneoff)} · recurring ${aud(c.recurring)}"><span style="width:${c.oneoff / maxCat * 100}%;background:${CAT_COL[k]}"></span><span style="width:${c.recurring / maxCat * 100}%;background:${CAT_COL[k]};opacity:.45"></span></div><span class="amt">${aud(tot)}</span></div>`; }).join('') + `<p class="hint">Solid: one-off. Faded: recurring over the run.</p>`;
    let t = `<table><thead><tr><th>Item</th><th class="num">Qty</th><th>Unit</th><th class="num">Rate (AUD)</th><th class="num">Amount</th><th>Type</th><th>Basis</th><th></th></tr></thead><tbody>`;
    M.CATS.forEach(([k, l]) => {
      const ls = B.lines.filter(x => x.cat === k); if (!ls.length) return;
      t += `<tr class="cat"><td colspan="4">${l}</td><td class="num">${aud(ls.reduce((s, x) => s + x.amount, 0))}</td><td colspan="3"></td></tr>`;
      ls.forEach(x => {
        const ov = b.overrides[x.id] || {};
        t += `<tr><td>${esc(x.label)}${x.basis ? `<span class="basis">${esc(x.basis)}</span>` : ''}</td>
          <td class="num"><input type="number" step="any" min="0" data-q="${x.id}" value="${+x.qty.toFixed(2)}" class="${ov.qty != null ? 'ov' : ''}" aria-label="Quantity for ${esc(x.label)}"></td><td>${esc(x.unit)}</td>
          <td class="num"><input type="number" step="any" min="0" data-r="${x.id}" value="${+x.rate.toFixed(2)}" class="${ov.rate != null ? 'ov' : ''}" aria-label="Rate for ${esc(x.label)}"></td>
          <td class="num">${aud(x.amount)}</td><td><span class="type-tag">${x.type === 'oneoff' ? 'One-off' : 'Recurring'}${x.gst ? '' : ' · no GST'}</span></td><td>${badgeFor(x)}</td>
          <td>${x.overridden ? `<button class="btn" data-reset="${x.id}">Reset</button>` : ''}</td></tr>`;
      });
    });
    t += `</tbody><tfoot><tr class="tfoot"><td colspan="4">Total excluding GST</td><td class="num">${aud(B.total)}</td><td colspan="3"></td></tr><tr class="tfoot"><td colspan="4">GST</td><td class="num">${aud(B.gst)}</td><td colspan="3"></td></tr><tr class="tfoot"><td colspan="4">Total including GST</td><td class="num">${aud(B.totalInc)}</td><td colspan="3"></td></tr></tfoot></table>`;
    $('#budgetTable').innerHTML = t;
    $('#budgetTable').querySelectorAll('input[data-q],input[data-r]').forEach(inp => inp.addEventListener('change', () => {
      const id = inp.dataset.q || inp.dataset.r; const o = b.overrides[id] = b.overrides[id] || {};
      const v = Math.max(0, Number(inp.value) || 0); if (inp.dataset.q) o.qty = v; else o.rate = v; changed('budget');
    }));
    $('#budgetTable').querySelectorAll('[data-reset]').forEach(x => x.addEventListener('click', () => { delete b.overrides[x.dataset.reset]; changed('budget'); }));
    $('#ratesTable').innerHTML = `<table><thead><tr><th>Rate</th><th class="num">Value (AUD ex GST)</th><th>Unit</th><th>Status</th><th>Basis and source</th></tr></thead><tbody>${M.RATES.map(r => {
      const s = r.src && srcById(r.src);
      return `<tr><td>${esc(r.label)}</td><td class="num"><input type="number" step="any" min="0" data-rate="${r.id}" value="${b.rates[r.id]}" class="${b.rates[r.id] !== r.value ? 'ov' : ''}" aria-label="${esc(r.label)}"></td><td>${esc(r.unit)}</td><td><span class="badge ${r.status}">${r.status}</span></td><td>${esc(r.note || '')}${s ? ` <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.source)}</a>` : ''}</td></tr>`;
    }).join('')}</tbody></table><div class="row" style="padding:8px"><button class="btn" id="resetRates">Reset all rates and overrides</button></div>`;
    $('#ratesTable').querySelectorAll('input[data-rate]').forEach(inp => inp.addEventListener('change', () => { b.rates[inp.dataset.rate] = Math.max(0, Number(inp.value) || 0); changed('budget'); }));
    $('#resetRates').addEventListener('click', () => { b.rates = M.baseConfig().budget.rates; b.overrides = {}; changed('budget'); toast('Rates and overrides reset'); });
    const g = srcById('gst_rate'), ic = srcById('gst_input_credits'), pope = srcById('reg_pope_city_of_melbourne');
    $('#gstNote').innerHTML = `<strong>GST assumptions.</strong> All rates are entered excluding GST, and GST is added at ${b.gstRate}% on taxable items. Wages carry no GST. If your organisation is registered for GST, you can generally claim input tax credits for GST included in business purchases${ic ? ` (<a href="${esc(ic.url)}" target="_blank" rel="noopener">ATO</a>)` : ''}. <strong>Not included:</strong> marketing, ticketing fees, freight, permits${pope ? ` (e.g. a <a href="${esc(pope.url)}" target="_blank" rel="noopener">place of public entertainment permit</a>)` : ''}, building surveyor and access consultant fees, and any revenue. No figure here is a supplier quote, and nothing implies the layout has been certified for capacity, access or safety.`;
  }
  function altEquip() {
    const c = clone(config); c.budget.equipMode = config.budget.equipMode === 'hire' ? 'buy' : 'hire';
    const alt = M.computeBudget(c); const eqNow = budget.byCat.equipment.oneoff + budget.byCat.equipment.recurring, eqAlt = alt.byCat.equipment.oneoff + alt.byCat.equipment.recurring;
    return config.budget.equipMode === 'hire' ? `hire ${aud(eqNow)} vs purchase ${aud(eqAlt)}` : `purchase ${aud(eqNow)} vs hire ${aud(eqAlt)}`;
  }

  // ---------- room plans document ----------
  function renderPlanDoc() {
    $('#planDoc').innerHTML = enabledRooms().map((r, i) => {
      const c = C.rooms[r.id] || {}; const sum = budget.lines.filter(l => l.room === r.id).reduce((s, l) => s + l.amount, 0);
      const e = M.roomEquipment(r);
      const els = M.ELEMENTS.filter(x => x.room === r.id);
      return `<details class="room-doc" data-room="${r.id}"><summary><span class="n">${i + 1}</span><div><h3>${esc(roomName(r.id))}</h3><p>${esc(c.strapline || '')}</p></div><span class="cost">${aud(sum)}<br><span class="hint">room one-off, ex GST</span></span></summary>
      <div class="grid">
        <div><h4>Configuration</h4><p>${r.w} × ${r.d} m, ${r.h} m high · ${r.coverage}% wall projection · model scale ×${r.modelScale} · lighting ${r.light}%${r.openToNext ? ' · combined with next room' : ''}</p>
        <h4>Installations</h4><ul class="bul">${els.map(x => `<li>${r.elements[x.id] ? '' : '<s>'}${esc(x.name)}${r.elements[x.id] ? '' : '</s> (off)'} — <span class="hint">${M.KINDS[x.kind].label}</span></li>`).join('')}</ul>
        <h4>Equipment implied</h4><p>${e.projectors} projectors · ${e.speakers} speakers · ${e.media} media players · ${e.sensors} sensors${e.headsets ? ' · ' + e.headsets + ' headsets' : ''}${e.touch ? ' · ' + e.touch + ' touchscreens' : ''}</p></div>
        <div>${planningHTML(r.id, true)}</div>
      </div></details>`;
    }).join('');
    $('#reviewList').innerHTML = `<table><thead><tr><th>Room</th><th>What needs review</th><th>Suggested reviewer</th></tr></thead><tbody>${(C.reviewList || []).map(x => `<tr><td>${esc(M.ROOM_SHORT[x.room] || x.room)}</td><td>${esc(x.item)}</td><td>${esc(x.reviewer)}</td></tr>`).join('')}</tbody></table>`;
    $('#genAccess').innerHTML = (C.generalAccessibility || []).map(x => `<li>${esc(x)}</li>`).join('');
    $('#genOps').innerHTML = (C.generalOperations || []).map(x => `<li>${esc(x)}</li>`).join('');
  }
  $('#expandAll').addEventListener('click', () => $$('#planDoc details').forEach(d => { d.open = true; }));
  $('#collapseAll').addEventListener('click', () => $$('#planDoc details').forEach(d => { d.open = false; }));
  $('#gotoExport').addEventListener('click', () => setTab('save'));

  // ---------- scenarios & comparison ----------
  function cmpConfigs() {
    return [{ key: 'current', name: 'Your current configuration', blurb: config.name + (config.scenario === 'custom' ? ' (edited)' : ''), cfg: config }]
      .concat(M.SCENARIOS.map(s => ({ key: s.key, name: s.name, blurb: s.blurb, cfg: M.scenario(s.key) })));
  }
  function renderCompare() {
    const sel = $('#cmpRoom'); const prev = sel.value;
    sel.innerHTML = M.ROOM_ORDER.map(id => `<option value="${id}">${esc(roomName(id))}</option>`).join(''); sel.value = prev || 'heart';
    const cols = cmpConfigs().map(c => ({ c, b: M.computeBudget(c.cfg) }));
    const maxT = Math.max(...cols.map(x => x.b.totalInc));
    $('#cmpGrid').innerHTML = cols.map(({ c, b }) => {
      const L = window.UW_LAYOUT.computeLayout(c.cfg); const e = b.eq;
      const vis = c.cfg.rooms.filter(r => r.enabled).reduce((s, r) => s + r.visitors, 0);
      const shot = ui.snapshots[c.key];
      const hr = c.cfg.rooms.find(r => r.id === 'heart');
      return `<div class="cmp-col ${c.key === 'current' ? 'current' : ''}">
        <div class="shot">${shot ? `<img src="${shot}" alt="Rendered view of ${esc(c.name)}">` : 'Select “Render comparison views”'}</div>
        <div class="body"><h3>${esc(c.name)}</h3><p>${esc(c.blurb)}</p>
        <div class="mini">${planSVG(L, { id: 'ar_' + c.key, aria: 'Floor plan of ' + c.name })}</div>
        <table><tbody>
          <tr><td>Rooms on route</td><td class="num">${L.rooms.length}${c.cfg.rooms.some(r => r.enabled && r.openToNext) ? ' (some combined)' : ''}</td></tr>
          <tr><td>Exhibition floor area</td><td class="num">${Math.round(b.floorArea)} m²</td></tr>
          <tr><td>Heart</td><td class="num">${hr && hr.enabled ? { printed: '3D-printed', fabricated: 'Fabricated', projection: 'Projection-enhanced' }[hr.opts.heartMode] : '—'}</td></tr>
          <tr><td>Projectors</td><td class="num">${e.projectors}</td></tr><tr><td>Speakers</td><td class="num">${e.speakers}</td></tr>
          <tr><td>Media players</td><td class="num">${e.media}</td></tr><tr><td>Headsets (incl. spares)</td><td class="num">${e.headsets}</td></tr>
          <tr><td>Touchscreens / sensors</td><td class="num">${e.touch} / ${e.sensors}</td></tr>
          <tr><td>Visitors shown at once</td><td class="num">${vis}</td></tr>
          <tr><td>Hosts on shift</td><td class="num">${b.hosts}</td></tr>
          <tr><td>Run</td><td class="num">${c.cfg.budget.runWeeks} weeks</td></tr>
          <tr><td>One-off (ex GST)</td><td class="num">${aud(b.oneoff)}</td></tr>
          <tr><td>Recurring (ex GST)</td><td class="num">${aud(b.recurring)}</td></tr>
          <tr><td><strong>Total inc GST</strong></td><td class="num"><strong>${aud(b.totalInc)}</strong></td></tr>
        </tbody></table></div>
        <div class="apply">${c.key === 'current' ? '<span class="hint">Edits in the walkthrough and budget update this column.</span>' : (ui.confirmScenario === c.key ? `<span class="confirm">Replace your current settings?</span><button class="btn primary" data-apply-yes="${c.key}">Yes, apply</button><button class="btn" data-apply-no>Cancel</button>` : `<button class="btn" data-apply="${c.key}">Apply this scenario</button>`)}</div>
      </div>`;
    }).join('');
    $('#cmpBars').innerHTML = cols.map(({ c, b }) => `<div class="bar-row"><span>${esc(c.name)}</span><div class="bar-track">${M.CATS.map(([k, l]) => { const v = b.byCat[k].oneoff + b.byCat[k].recurring; return `<span title="${l}: ${aud(v)}" style="width:${v / maxT * 100}%;background:${CAT_COL[k]}"></span>`; }).join('')}</div><span class="amt">${audK(b.totalInc - b.gst)} ex GST</span></div>`).join('') +
      `<div class="legend-row">${M.CATS.map(([k, l]) => `<span><i style="background:${CAT_COL[k]}"></i>${l}</span>`).join('')}</div>`;
  }
  $('#cmpGrid').addEventListener('click', e => {
    const a = e.target.closest('[data-apply]'), y = e.target.closest('[data-apply-yes]'), n = e.target.closest('[data-apply-no]');
    if (a) { ui.confirmScenario = a.dataset.apply; renderCompare(); }
    if (n) { ui.confirmScenario = null; renderCompare(); }
    if (y) { applyScenario(y.dataset.applyYes); }
  });
  function applyScenario(k) {
    config = normalise(M.scenario(k)); ui.confirmScenario = null; ui.room = null; ui.selEl = null; ui.snapshots.current = null;
    changed('layout'); renderInspector(); toast(`${config.name} applied`);
  }
  $('#cmpRender').addEventListener('click', () => {
    const room = $('#cmpRoom').value, view = $('#cmpView').value;
    $('#cmpStatus').textContent = 'Rendering…';
    setTimeout(() => {
      const vp = $('#viewport').getBoundingClientRect();
      cmpConfigs().forEach(c => {
        const cfg = clone(c.cfg); const r = cfg.rooms.find(x => x.id === room);
        const useRoom = r && r.enabled ? room : null;
        ui.snapshots[c.key] = W.snapshot(normalise(cfg), useRoom, useRoom ? view : 'venue', 640, 360);
      });
      W.resize(); buildHotspots(); renderPlan();
      $('#cmpStatus').textContent = `Rendered ${roomName(room)} · ${VIEW_LABEL[view]}. Rooms missing from a scenario show the whole venue.`;
      renderCompare();
    }, 30);
  });

  // ---------- saving ----------
  function saves() { return store.get('uw.saves') || []; }
  function renderSaves() {
    const s = saves();
    $('#saveList').innerHTML = s.length ? s.map((x, i) => `<li><div class="meta"><strong>${esc(x.name)}</strong><small>${new Date(x.at).toLocaleString('en-AU')} · ${x.config.rooms.filter(r => r.enabled).length} rooms</small></div>
      ${ui.confirmDel === i ? `<span class="confirm">Delete?</span><button class="btn danger" data-del-yes="${i}">Delete</button><button class="btn" data-del-no>Keep</button>` : `<button class="btn primary" data-load="${i}">Load</button><button class="btn" data-del="${i}">Delete</button>`}</li>`).join('') : '<li class="hint">No saved configurations in this browser yet.</li>';
    $('#planOut').value = planMarkdown();
  }
  $('#saveBtn').addEventListener('click', () => {
    const name = $('#saveName').value.trim() || `${config.name} — ${new Date().toLocaleDateString('en-AU')}`;
    const s = saves(); s.unshift({ name, at: Date.now(), config: clone(config) });
    if (store.set('uw.saves', s.slice(0, 30))) { $('#saveMsg').textContent = `Saved “${name}” in this browser.`; config.name = name; $('#cfgName').textContent = name; }
    else $('#saveMsg').textContent = 'This browser is blocking local storage, so nothing was saved. Download the configuration file instead.';
    $('#saveName').value = ''; renderSaves();
  });
  $('#saveList').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const s = saves();
    if (b.dataset.load) { const x = s[Number(b.dataset.load)]; config = normalise(x.config); config.name = x.name; changed('layout'); renderInspector(); toast(`Loaded “${x.name}”`); renderSaves(); }
    if (b.dataset.del) { ui.confirmDel = Number(b.dataset.del); renderSaves(); }
    if (b.dataset.delNo !== undefined) { ui.confirmDel = null; renderSaves(); }
    if (b.dataset.delYes) { s.splice(Number(b.dataset.delYes), 1); store.set('uw.saves', s); ui.confirmDel = null; renderSaves(); }
  });
  let downloads = null;
  if (window.claude && window.claude.use) window.claude.use('downloads').then(d => { downloads = d; }).catch(() => { downloads = null; });
  async function offerFile(filename, data, msgEl, copyFallback) {
    if (!downloads) { if (copyFallback) await copyText(data, msgEl, 'File downloads are not available in this view, so the text was copied instead.'); else $(msgEl).textContent = 'File downloads are not available in this view. Use Copy instead.'; return; }
    try { await downloads.save({ filename, data }); $(msgEl).textContent = `Offered ${filename} for download.`; }
    catch (e) { $(msgEl).textContent = e && e.code === 'declined' ? 'Download cancelled.' : `Download not available (${(e && e.code) || 'error'}). Use Copy instead.`; }
  }
  async function copyText(text, msgEl, okMsg) {
    try { await navigator.clipboard.writeText(text); $(msgEl).textContent = okMsg || 'Copied to the clipboard.'; }
    catch (e) { const ta = $('#planOut'); ta.value = text; ta.focus(); ta.select(); $(msgEl).textContent = 'Copying was blocked; the text is selected in the box below. Press Ctrl+C or ⌘C.'; }
  }
  const cfgJSON = () => JSON.stringify({ app: 'the-universe-within', version: 1, savedAt: new Date().toISOString(), config }, null, 2);
  $('#dlJson').addEventListener('click', () => offerFile('universe-within-configuration.json', cfgJSON(), '#fileMsg', true));
  $('#copyJson').addEventListener('click', () => copyText(cfgJSON(), '#fileMsg', 'Configuration copied as text.'));
  function loadJSONText(txt) {
    try {
      const o = JSON.parse(txt); const c = o.config || o;
      if (!c || !Array.isArray(c.rooms)) throw new Error('no rooms');
      config = normalise(c); changed('layout'); renderInspector(); renderSaves();
      $('#fileMsg').textContent = `Loaded “${config.name}”.`;
    } catch (e) { $('#fileMsg').textContent = 'That is not a configuration from this site. Check the file or text and try again.'; }
  }
  $('#loadFile').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => loadJSONText(String(rd.result)); rd.readAsText(f); e.target.value = ''; });
  $('#loadPaste').addEventListener('click', () => loadJSONText($('#pasteJson').value));
  $('#dlPlan').addEventListener('click', () => offerFile('universe-within-room-plan.md', planMarkdown(), '#exportMsg', true));
  $('#copyPlan').addEventListener('click', () => copyText(planMarkdown(), '#exportMsg', 'Plan copied as Markdown.'));
  $('#dlCsv').addEventListener('click', () => offerFile('universe-within-budget.csv', budgetCSV(), '#exportMsg', true));

  function budgetCSV() {
    const q = v => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [['Category', 'Item', 'Room', 'Quantity', 'Unit', 'Rate AUD ex GST', 'Amount AUD ex GST', 'Type', 'GST applies', 'Status', 'Basis']];
    budget.lines.forEach(l => { const m = l.rateId && rateMeta(l.rateId); rows.push([M.CATS.find(c => c[0] === l.cat)[1], l.label, l.room ? M.ROOM_SHORT[l.room] : 'Shared', +l.qty.toFixed(2), l.unit, +l.rate.toFixed(2), Math.round(l.amount), l.type === 'oneoff' ? 'One-off' : 'Recurring', l.gst ? 'Yes' : 'No', m ? m.status : 'provisional', l.basis]); });
    rows.push([], ['', 'Total ex GST', '', '', '', '', Math.round(budget.total)], ['', 'GST', '', '', '', '', Math.round(budget.gst)], ['', 'Total inc GST', '', '', '', '', Math.round(budget.totalInc)]);
    return rows.map(r => r.map(q).join(',')).join('\n');
  }
  function planMarkdown() {
    const b = config.budget, B = budget; const out = [];
    const li = arr => (arr || []).map(x => `- ${x}`).join('\n');
    out.push(`# The Universe Within — room-by-room plan`, '', `Configuration: **${config.name}** · exported ${new Date().toLocaleDateString('en-AU')}`, '',
      `Concept plan for discussion. The venue is illustrative, dimensions are editable assumptions, and nothing here has been certified for capacity, access or safety. Budget figures are AUD excluding GST unless stated; provisional figures are planning assumptions, not quotes.`, '',
      `## Summary`, '', `- Rooms on the route: ${enabledRooms().length}`, `- Exhibition floor area: ${Math.round(B.floorArea)} m² (gross allowance ${B.gross} m²)`,
      `- Equipment: ${B.eq.projectors} projectors, ${B.eq.speakers} speakers, ${B.eq.media} media players, ${B.eq.headsets} headsets, ${B.eq.touch} touchscreens, ${B.eq.sensors} sensors`,
      `- Run: ${b.runWeeks} weeks open, ${b.installWeeks} weeks install, ${b.hoursPerWeek} opening hours a week`,
      `- One-off: ${aud(B.oneoff)} · Recurring: ${aud(B.recurring)} · GST: ${aud(B.gst)} · **Total inc GST: ${aud(B.totalInc)}**`, `- Your in-kind content time: ${aud(B.inKindValue)} (${b.excludeInKind ? 'excluded from' : 'included in'} cash totals)`, '');
    enabledRooms().forEach((r, i) => {
      const c = C.rooms[r.id] || {}; const e = M.roomEquipment(r); const sum = B.lines.filter(l => l.room === r.id).reduce((s, l) => s + l.amount, 0);
      out.push(`## ${i + 1}. ${roomName(r.id)}`, '', c.strapline ? `_${c.strapline}_` : '', '', c.intro || '', '',
        `**Configuration:** ${r.w} × ${r.d} m, ${r.h} m high; ${r.coverage}% wall projection; model scale ×${r.modelScale}; lighting ${r.light}%${r.openToNext ? '; combined with the next room' : ''}.`, '',
        `**Installations**`, '', M.ELEMENTS.filter(x => x.room === r.id).map(x => `- ${x.name} (${M.KINDS[x.kind].label})${r.elements[x.id] ? '' : ' — switched off'}`).join('\n'), '',
        `**Visitors see**`, '', li(c.see), '', `**Visitors hear**`, '', li(c.hear), '', `**Visitors do**`, '', li(c.do), '',
        `**Physical structures**`, '', li(c.physical), '', `**Digital content**`, '', li(c.digital), '', `**Equipment**`, '', li(c.equipment), '',
        `Implied by this configuration: ${e.projectors} projectors, ${e.speakers} speakers, ${e.media} media players, ${e.sensors} sensors${e.headsets ? ', ' + e.headsets + ' headsets' : ''}${e.touch ? ', ' + e.touch + ' touchscreens' : ''}.`, '',
        `**What you could create yourself**`, '', li(c.diy), '', `**Likely specialist input**`, '', li(c.specialist), '',
        `**Indicative time:** ${c.time || ''}`, '', `**Dependencies**`, '', li(c.dependencies), '', `**Cost drivers**`, '', li(c.costDrivers), '',
        `**Accessibility**`, '', li(c.accessibility), '', `**Sound spill:** ${c.soundSpill || ''}`, '', `**Projection shadows:** ${c.shadows || ''}`, '', `**Operations**`, '', li(c.operations), '',
        `**Needs expert review**`, '', li(c.scienceReview), '', `**Scale:** ${c.scaleNote || ''}`, '', `**Room one-off costs (ex GST):** ${aud(sum)}`, '');
    });
    out.push(`## Budget by category (AUD ex GST)`, '', '| Category | One-off | Recurring |', '|---|---:|---:|', ...M.CATS.map(([k, l]) => `| ${l} | ${aud(B.byCat[k].oneoff)} | ${aud(B.byCat[k].recurring)} |`), `| **Total** | **${aud(B.oneoff)}** | **${aud(B.recurring)}** |`, '',
      `GST at ${b.gstRate}% on taxable items: ${aud(B.gst)}. Wages carry no GST. Total including GST: ${aud(B.totalInc)}.`, '',
      `## Expert and technical review list`, '', ...(C.reviewList || []).map(x => `- **${M.ROOM_SHORT[x.room] || x.room}:** ${x.item} — ${x.reviewer}`), '',
      `## Sources for sourced and derived figures`, '', ...M.RATES.filter(r => r.src).map(r => { const s = srcById(r.src); return `- ${r.label}: ${r.note}${s ? ` (${s.source}, ${s.url})` : ''}`; }), '');
    return out.filter(x => x !== null).join('\n');
  }

  // ---------- about ----------
  function renderAbout() {
    const hon = (C.honesty || []).map(x => `<li>${esc(x)}</li>`).join('');
    const srcs = (window.UW_SOURCES || []).filter(s => s.url).map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.source)}</a> — ${esc(s.item)}${s.value != null ? `: ${esc(s.value)} ${esc(s.unit)}` : ''} <span class="hint">(${esc(s.effective || '')})</span></li>`).join('');
    $('#aboutDoc').innerHTML = `<div class="doc-head"><h1>About this model</h1><p class="lede">What has been built, how to read it, and what it is not.</p></div>
      <div class="card"><h2>What is implemented</h2><ul class="bul">
        <li><strong>A navigable 3D model</strong> of an illustrative brick warehouse with timber trusses, built in the browser with Three.js. You can orbit, zoom, pan and walk at eye level through connected rooms. Every room, installation, projection surface, projector, speaker and visitor figure is generated from your current settings, so changes to dimensions, coverage, scale, lighting, visitor numbers and installations appear in the model.</li>
        <li><strong>Projected imagery</strong> in the model is animated from the same procedural sequences as the projection preview player. They are placeholders that sketch pacing, content and scale changes; they are not finished artwork.</li>
        <li><strong>Physical installations</strong> (teeth, tongue surface, palate canopy, oesophagus passage, stomach shell, heart, neuron, seating, VR furniture) are simplified procedural models. The heart is a <strong>provisional representation</strong> assembled from basic shapes to show size, placement and build options. It is not an anatomical model; a licensed, anatomist-reviewed model (for example one derived from BodyParts3D, CC BY-SA) should replace it before design sign-off.</li>
        <li><strong>Headset experiences</strong> are shown as the stations, zones and equipment in the room; the flat previews show what a wearer would see.</li>
        <li><strong>Sound</strong> is synthesised live as a sketch of each room's intended sound design and stays muted until you turn it on.</li>
        <li>The two mouth images are your own AI-generated concept renders from the repository, shown as mood references with a note on their anatomical errors.</li>
      </ul></div>
      <div class="card"><h2>How to read the model</h2><ul class="bul">
        <li>Use <em>Colour by type</em> to separate projected imagery (amber), physical installations (bone), headset experiences (blue-grey), interactive controls (sage) and sound or AV equipment (grey). Projector beams show where light is thrown and where visitors could cast shadows.</li>
        <li>Visitor figures, including a wheelchair user and children, are there for scale only. Visitor numbers are not a capacity.</li>
        <li>The venue layout places rooms in two rows joined by a short corridor. It is a planning diagram, not a survey of a real building.</li>
      </ul></div>
      <div class="card"><h2>Limits and honesty notes</h2><ul class="bul">${hon}</ul></div>
      <div class="card"><h2>Keyboard</h2><ul class="bul"><li>Tab moves through every control; arrow keys move between the main tabs.</li><li>In the 3D view (click it first): arrow keys or W A S D to walk in eye-level views, Q and E to turn, Shift to walk faster; in overviews, arrow keys orbit and W/S or +/− zoom.</li><li>N and P step through the guided tour; 1–7 jump to a room; T colours by type; M toggles sound; Esc closes the preview.</li></ul></div>
      <div class="card"><h2>Australian reference figures</h2><p class="hint">Found by desk research on 28 September 2026 from search-result text naming each page. Confirm each figure on the live page before relying on it.</p><ul class="bul">${srcs}</ul></div>
      <div class="card"><h2>Credits</h2><p class="hint">3D rendering: Three.js (MIT licence). Typefaces: Cormorant and IBM Plex via Google Fonts (SIL Open Font Licence). All geometry, textures, imagery and sound are generated in the browser for this concept.</p></div>`;
  }

  // ---------- keyboard ----------
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && ui.playerOpen) { closePlayer(); return; }
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'select', 'textarea'].includes(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (ui.tab !== 'walk') return;
    const k = e.key.toLowerCase();
    if (k === 'n') { if (!ui.guided) setGuided(true); else showStep(ui.step + 1); }
    else if (k === 'p' && ui.guided) showStep(ui.step - 1);
    else if (k === 't') $('#typeBtn').click();
    else if (k === 'm') toggleSound();
    else if (/^[1-7]$/.test(k)) { const r = enabledRooms()[Number(k) - 1]; if (r) goRoom(r.id, 'entrance'); }
  });
  if (ui.playerOpen === false) document.addEventListener('keydown', e => { if (e.key === 'Tab' && ui.playerOpen) { const f = $$('#player button, #player input, #player select').filter(x => !x.disabled); if (!f.length) return; const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } } });

  // ---------- main loop ----------
  let last = performance.now(), markT = 0;
  function frame(nowMs) {
    const dt = Math.min(0.1, (nowMs - last) / 1000); last = nowMs; const now = nowMs / 1000;
    Object.keys(ui.clocks).forEach(id => { const c = ui.clocks[id]; if (c.playing) c.t += dt; });
    if (ui.tab === 'walk') {
      W.tick(dt, ui.reduced);
      const cur = W.currentRoom();
      if (cur !== ui.cur) {
        ui.cur = cur;
        if (cur && !ui.guided) { ui.room = cur; renderInspector(); }
        renderRoute();
        if (ui.view === 'free' || ui.view === 'eye' || ui.view === 'entrance') setWhere(cur, ui.view);
      }
      W.update(dt, now, cur, ui.reduced); W.perf(dt);
      updateHotspots();
      markT += dt; if (markT > 0.1) { markT = 0; updateMarker(); }
      if (ui.guided && ui.auto) { ui.autoT += dt; if (ui.autoT > (ui.reduced ? 16 : 11)) { if (ui.step < tourSteps().length - 1) showStep(ui.step + 1); else { ui.auto = false; $('#gPlay').setAttribute('aria-pressed', 'false'); $('#gPlay').textContent = 'Auto-play'; } } }
    }
    const soundRoom = ui.playerOpen ? ui.pvRoom : ui.cur;
    if (soundRoom) A.tick(soundRoom, ui.clocks[soundRoom].t, Object.assign(projOpts(soundRoom), { audioOn: soundRoom !== 'heart' || roomCfg('heart').elements.heart_audio }), ui.clocks[soundRoom].playing);
    else A.tick(null, 0, {}, false);
    if (ui.playerOpen) drawPlayer();
    requestAnimationFrame(frame);
  }

  // ---------- start ----------
  function start() {
    renderPlanLegend();
    try { W.init($('#gl')); } catch (e) { $('#loading').textContent = 'This browser could not start the 3D view (WebGL is unavailable). The planning, budget and export tools still work.'; renderInspector(); renderRoute(); return; }
    W.build(config); renderPlan(); buildHotspots(); renderRoute(); renderInspector(); setReduced(ui.reduced);
    goRoom(null, 'venue', true);
    $('#cfgName').textContent = config.name;
    $('#loading').hidden = true;
    window.addEventListener('resize', () => { W.resize(); });
    if (window.ResizeObserver) new ResizeObserver(() => W.resize()).observe($('#viewport'));
    requestAnimationFrame(frame);
  }
  if (!window.THREE) { $('#loading').textContent = 'The 3D library did not load. Check your connection and reload; the other tabs still work.'; renderInspector(); renderRoute(); renderPlanLegend(); }
  else start();
  window.UW_APP = { get config() { return config; }, ui, goRoom, setTab, budget: () => budget, applyScenario, planMarkdown };
})();
