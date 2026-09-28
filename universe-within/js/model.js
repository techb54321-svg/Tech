/* The Universe Within — configuration model.
   Rooms, installations, the three design scenarios, derived equipment
   counts and the budget model. All money is AUD, entered excluding GST. */
(function () {
  'use strict';

  const KINDS = {
    projection: { label: 'Projected imagery', colour: '#d9a45b' },
    physical: { label: 'Physical installation', colour: '#d8cdb9' },
    headset: { label: 'Headset experience', colour: '#8fa6bb' },
    interactive: { label: 'Interactive control', colour: '#9db48a' },
    av: { label: 'Sound / AV equipment', colour: '#a79d92' }
  };

  // Every switchable element. `room` groups them; `on` is the default state.
  const ELEMENTS = [
    ['entrance', 'ent_proj_main', 'projection', 'Silhouette-to-molecules projection'],
    ['entrance', 'ent_proj_floor', 'projection', 'Floor route projection'],
    ['entrance', 'ent_intro_panel', 'physical', 'Accessible introduction panel'],
    ['entrance', 'ent_route_choice', 'interactive', 'Guided or free choice point'],
    ['entrance', 'ent_sound', 'av', 'Subtle directional sound'],
    ['mouth', 'mouth_teeth', 'physical', 'Oversized teeth'],
    ['mouth', 'mouth_tongue', 'physical', 'Tongue-inspired floor surface'],
    ['mouth', 'mouth_palate', 'physical', 'Palate canopy (also a projection surface)'],
    ['mouth', 'mouth_proj_walls', 'projection', 'Saliva and swallow projections'],
    ['mouth', 'mouth_choice', 'interactive', 'Water or sugary drink selector'],
    ['digestive', 'dig_oesophagus', 'physical', 'Oesophagus passage'],
    ['digestive', 'dig_proj_peristalsis', 'projection', 'Peristalsis projection'],
    ['digestive', 'dig_stomach', 'physical', 'Stomach chamber'],
    ['digestive', 'dig_proj_stomach', 'projection', 'Stomach projection'],
    ['digestive', 'dig_sound', 'av', 'Spatial sound'],
    ['digestive', 'dig_microbiome', 'projection', 'Microbiome scene (optional)'],
    ['digestive', 'dig_stepfree', 'physical', 'Step-free open route'],
    ['heart', 'heart_model', 'physical', 'Central heart sculpture'],
    ['heart', 'heart_proj_flow', 'projection', 'Blood-flow wall projection'],
    ['heart', 'heart_audio', 'av', 'Heartbeat audio'],
    ['heart', 'heart_pulse', 'interactive', 'Simulated pulse (demonstration)'],
    ['heart', 'heart_construction', 'physical', 'Construction cutaway'],
    ['cellular', 'cell_proj_surround', 'projection', 'Surround wall projection'],
    ['cellular', 'cell_proj_floor', 'projection', 'Floor projection'],
    ['cellular', 'cell_bench', 'physical', 'Central seating'],
    ['cellular', 'cell_scalebar', 'physical', 'Scale ladder strip'],
    ['signals', 'sig_neuron', 'physical', 'Suspended neuron sculpture'],
    ['signals', 'sig_proj_membrane', 'projection', 'Neuronal membrane projection'],
    ['signals', 'sig_control', 'interactive', 'Signal trigger control'],
    ['signals', 'sig_sound', 'av', 'Travelling spatial sound'],
    ['signals', 'sig_label', 'physical', 'Simplifications panel'],
    ['vr', 'vr_seated', 'headset', 'Seated VR stations'],
    ['vr', 'vr_standing', 'headset', 'Standing VR zones'],
    ['vr', 'vr_storage', 'physical', 'Headset charging and hygiene cabinet'],
    ['vr', 'vr_staff', 'physical', 'Staff station'],
    ['vr', 'vr_bigscreen', 'projection', 'Large-screen alternative'],
    ['vr', 'vr_touch', 'interactive', 'Touchscreen anatomy explorer'],
    ['vr', 'vr_quiet', 'physical', 'Quiet reflection area']
  ].map(([room, id, kind, name]) => ({ room, id, kind, name }));
  const EL = {}; ELEMENTS.forEach(e => { EL[e.id] = e; });

  const ROOM_NAMES = {
    entrance: 'The Universe Within', mouth: 'Inside the Mouth', digestive: 'Journey Through the Digestive System',
    heart: 'Between Heartbeats', cellular: 'The Cellular Universe', signals: 'Signals Within', vr: 'VR and Discovery Studio'
  };
  const ROOM_SHORT = { entrance: 'Entrance', mouth: 'Mouth', digestive: 'Digestive', heart: 'Heart', cellular: 'Cellular', signals: 'Signals', vr: 'VR Studio' };
  const ROOM_ORDER = ['entrance', 'mouth', 'digestive', 'heart', 'cellular', 'signals', 'vr'];

  // Base dimensions (m) for the "polished exhibition" scenario.
  const BASE = {
    entrance: { w: 11, d: 9, h: 6 }, mouth: { w: 13, d: 10, h: 6 }, digestive: { w: 17, d: 10, h: 5.5 },
    heart: { w: 13, d: 12, h: 7 }, cellular: { w: 12, d: 10, h: 6 }, signals: { w: 15, d: 9, h: 6 }, vr: { w: 13, d: 11, h: 5 }
  };

  function defaultRoom(id) {
    const b = BASE[id];
    const elements = {};
    ELEMENTS.filter(e => e.room === id).forEach(e => { elements[e.id] = true; });
    elements.dig_microbiome = id === 'digestive' ? true : undefined;
    Object.keys(elements).forEach(k => elements[k] === undefined && delete elements[k]);
    return {
      id, enabled: true, openToNext: false,
      w: b.w, d: b.d, h: b.h,
      coverage: 70, modelScale: 1, light: 35, visitors: 12, diy: 30,
      elements,
      opts: {
        mouthVariant: 'water', heartMode: 'fabricated', bpm: 64, controlType: 'tactile',
        vrSeated: 3, vrStanding: 2, vrPreview: 'bloodstream', teeth: 8
      }
    };
  }

  // Default unit rates. `src` links to an entry in the sources list;
  // anything without one is a provisional planning assumption.
  const RATES = [
    ['anim_day', 'Animator / motion designer', 'per day', 850, null, 'Provisional freelance day rate. Reference only: modelled employee salaries are about $55–61/hour (ERI 2026); freelance rates are usually higher.', 'animator_3d_salary'],
    ['sound_day', 'Sound designer', 'per day', 750, null, 'Provisional assumption.'],
    ['dev_day', 'Interactive / VR developer', 'per day', 900, null, 'Provisional assumption.'],
    ['review_hr', 'Expert scientific review', 'per hour', 180, null, 'Provisional honorarium assumption.'],
    ['proj_hire', 'Laser projector (7,000+ lm) hire', 'per week', 1100, null, 'Provisional long-hire weekly rate. Reference: a 7,000 lm projector lists from $660/day in Melbourne (Gecko.rent); weekly and long-run rates are negotiated.', 'projector_7000lm_hire_day'],
    ['proj_buy', 'Laser projector (7,000+ lm) purchase', 'each', 9500, null, 'Provisional assumption; excludes lenses and mounts.'],
    ['spk_hire', 'Speaker + amplification channel hire', 'per week', 45, null, 'Provisional assumption.'],
    ['spk_buy', 'Speaker + amplification channel purchase', 'each', 950, null, 'Provisional assumption.'],
    ['media_hire', 'Media server / player hire', 'per week', 120, null, 'Provisional assumption.'],
    ['media_buy', 'Media server / player purchase', 'each', 2800, null, 'Provisional assumption.'],
    ['display_hire', 'Large display (75–86") hire', 'per week', 550, null, 'Provisional. Reference: TV and touchscreen hire (up to 65") lists from $320/day incl. delivery (Extreme VR).', 'screen_touch_hire_day'],
    ['display_buy', 'Large display (75–86") purchase', 'each', 3800, null, 'Provisional assumption.'],
    ['headset_buy', 'Meta Quest 3S 128GB headset', 'each', 517, 'sourced', 'Meta AU store lists $569 inc. GST ($517 ex GST), per search index Sept 2026. Confirm on the day; add face covers and straps.', 'meta_quest_3s_128_rrp'],
    ['touch_buy', 'Touchscreen kiosk (screen, enclosure, PC)', 'each', 3900, null, 'Provisional assumption.'],
    ['sensor_buy', 'Sensor / controller kit (interactive)', 'each', 650, null, 'Provisional assumption.'],
    ['partition_lm', 'Blackout partition wall, 5 m', 'per linear m', 380, null, 'Provisional assumption.'],
    ['surface_m2', 'Projection surface preparation', 'per m²', 28, null, 'Provisional assumption (paint or screen fabric).'],
    ['install_day', 'AV installation crew (2 technicians)', 'per crew-day', 1400, null, 'Provisional assumption.'],
    ['electrical_room', 'Electrical and data works', 'per AV room', 2600, null, 'Provisional assumption; depends on existing venue power.'],
    ['venue_m2wk', 'Venue hire (gross area)', 'per m² per week', 8, null, 'Provisional. Published Melbourne examples are not comparable (e.g. a Coburg warehouse at $550/day for shoots); large venues quote on request.', 'venue_bighouse_warehouse'],
    ['power_kwh', 'Electricity', 'per kWh', 0.15, 'derived', 'Derived: 2026–27 Victorian Default Offer small-business bill ≈ $1,481/yr for 10,000 kWh (CitiPower) ≈ 14.8c/kWh average.', 'vdo_small_biz_citipower'],
    ['staff_hr', 'Visitor host (casual, incl. on-costs)', 'per hour', 40, 'derived', 'Derived: National Minimum Wage casual rate $33.05/h (from 1 July 2026) + 12% super + ~1.8% WorkSafe ≈ $37.60, rounded up to allow for award classification. Check the Amusement, Events and Recreation Award pay guide.', 'nmw_casual_hourly_2026'],
    ['pl_insurance', 'Public liability insurance ($20m cover)', 'per run', 3200, null, 'Provisional for a multi-week run. Reference: single small events are insured from $275 (Marsh); $20m is the usual venue requirement.', 'pli_single_event_marsh'],
    ['equip_ins_pct', 'Equipment insurance', '% of purchased value', 1.5, null, 'Provisional assumption.']
  ].map(([id, label, unit, value, status, note, src]) => ({ id, label, unit, value, status: status || 'provisional', note, src: src || null }));

  function defaultBudget() {
    const rates = {}; RATES.forEach(r => { rates[r.id] = r.value; });
    return {
      rates, equipMode: 'hire', runWeeks: 12, installWeeks: 3, hoursPerWeek: 48,
      contingencyPct: 15, gstRate: 10, excludeInKind: true, overrides: {}
    };
  }

  function baseConfig() {
    return {
      name: 'Polished exhibition', scenario: 'polished',
      rooms: ROOM_ORDER.map(defaultRoom),
      budget: defaultBudget()
    };
  }

  // ---------- Scenarios ----------
  function scenario(key) {
    const c = baseConfig();
    const R = id => c.rooms.find(r => r.id === id);
    if (key === 'pilot') {
      c.name = 'Compact pilot'; c.scenario = 'pilot';
      const dims = { entrance: [8, 7, 4.5], mouth: [9, 8, 4.5], digestive: [12, 8, 4.5], heart: [9, 9, 4.5], cellular: [9, 8, 4.5], signals: [10, 7, 4.5], vr: [9, 8, 4.5] };
      c.rooms.forEach(r => {
        const d = dims[r.id]; r.w = d[0]; r.d = d[1]; r.h = d[2];
        r.coverage = 45; r.visitors = 7; r.light = 40; r.diy = 60; r.modelScale = 0.8;
      });
      R('entrance').elements.ent_proj_floor = false;
      R('mouth').opts.teeth = 4; R('mouth').elements.mouth_palate = false;
      R('digestive').elements.dig_stomach = false; R('digestive').elements.dig_proj_stomach = false; R('digestive').elements.dig_microbiome = false; R('digestive').elements.dig_sound = false;
      R('heart').opts.heartMode = 'printed'; R('heart').modelScale = 1; R('heart').elements.heart_pulse = false;
      R('cellular').elements.cell_proj_floor = false; R('cellular').openToNext = true;
      R('signals').opts.controlType = 'tactile'; R('signals').elements.sig_sound = false;
      R('vr').opts.vrSeated = 2; R('vr').opts.vrStanding = 0; R('vr').elements.vr_standing = false; R('vr').elements.vr_touch = false;
      c.budget.runWeeks = 6; c.budget.installWeeks = 2; c.budget.hoursPerWeek = 30; c.budget.equipMode = 'hire'; c.budget.contingencyPct = 15;
    } else if (key === 'flagship') {
      c.name = 'Flagship immersive experience'; c.scenario = 'flagship';
      const dims = { entrance: [14, 11, 7], mouth: [16, 12, 7], digestive: [22, 12, 6.5], heart: [16, 15, 8], cellular: [16, 13, 7], signals: [18, 11, 7], vr: [16, 13, 5.5] };
      c.rooms.forEach(r => {
        const d = dims[r.id]; r.w = d[0]; r.d = d[1]; r.h = d[2];
        r.coverage = 100; r.visitors = 20; r.light = 30; r.diy = 15; r.modelScale = 1.2;
      });
      R('mouth').opts.teeth = 12;
      R('heart').opts.heartMode = 'projection';
      R('signals').opts.controlType = 'touchfree';
      R('vr').opts.vrSeated = 4; R('vr').opts.vrStanding = 4;
      c.budget.runWeeks = 26; c.budget.installWeeks = 5; c.budget.hoursPerWeek = 56; c.budget.equipMode = 'buy'; c.budget.contingencyPct = 12;
    }
    return c;
  }
  const SCENARIOS = [
    { key: 'pilot', name: 'Compact pilot', blurb: 'Smaller rooms, partial projection, 3D-printed heart, two seated headsets. Cellular and Signals share one space. Six-week run.' },
    { key: 'polished', name: 'Polished exhibition', blurb: 'Seven separate rooms, 70% projection coverage, fabricated heart, five headsets. Twelve-week run.' },
    { key: 'flagship', name: 'Flagship immersive experience', blurb: 'Larger, taller rooms, full surround and floor projection, projection-enhanced heart, eight headsets. Six-month run.' }
  ];

  // ---------- Derived equipment ----------
  const on = (r, id) => !!r.elements[id];
  function projArea(r) {
    const ph = Math.min(r.h - 0.6, 4.5);
    return 2 * (r.w + r.d) * ph * (r.coverage / 100) * 0.8; // 0.8: doors, gaps, exits
  }
  function roomEquipment(r) {
    const e = { projectors: 0, speakers: 0, media: 0, sensors: 0, headsets: 0, displays: 0, touch: 0, projArea: 0, floorProjArea: 0 };
    const wallProj = {
      entrance: on(r, 'ent_proj_main'), mouth: on(r, 'mouth_proj_walls'), digestive: on(r, 'dig_proj_peristalsis') || on(r, 'dig_proj_stomach'),
      heart: on(r, 'heart_proj_flow'), cellular: on(r, 'cell_proj_surround'), signals: on(r, 'sig_proj_membrane'), vr: false
    }[r.id];
    if (wallProj) {
      e.projArea = projArea(r);
      if (r.id === 'entrance') e.projArea = Math.max(e.projArea, r.w * Math.min(r.h - 0.6, 4.5) * 0.85);
      e.projectors += Math.max(1, Math.ceil(e.projArea / 22));
    }
    if (r.id === 'entrance' && on(r, 'ent_proj_floor')) { e.floorProjArea = r.w * 1.6; e.projectors += Math.ceil(r.w / 7); }
    if (r.id === 'cellular' && on(r, 'cell_proj_floor')) { e.floorProjArea = r.w * r.d * 0.6; e.projectors += Math.max(2, Math.ceil(e.floorProjArea / 30)); }
    if (r.id === 'mouth' && on(r, 'mouth_palate') && on(r, 'mouth_proj_walls')) e.projectors += 2;
    if (r.id === 'digestive') {
      if (on(r, 'dig_oesophagus') && on(r, 'dig_proj_peristalsis')) e.projectors += 2;
      if (on(r, 'dig_stomach') && on(r, 'dig_proj_stomach')) e.projectors += 2;
      if (on(r, 'dig_microbiome')) e.projectors += 1;
    }
    if (r.id === 'heart' && on(r, 'heart_model') && r.opts.heartMode === 'projection') e.projectors += 3;
    const floor = r.w * r.d;
    const baseSpk = 2 + Math.ceil(floor / 45);
    const spatial = (r.id === 'digestive' && on(r, 'dig_sound')) || (r.id === 'signals' && on(r, 'sig_sound'));
    const hasSound = !(r.id === 'entrance' && !on(r, 'ent_sound')) && !(r.id === 'heart' && !on(r, 'heart_audio'));
    e.speakers = hasSound ? (spatial ? baseSpk * 2 : baseSpk) : 0;
    e.media = e.projectors ? Math.ceil(e.projectors / 4) : 0;
    const inter = ELEMENTS.filter(x => x.room === r.id && x.kind === 'interactive' && on(r, x.id)).length;
    if (inter) e.media += 1;
    e.sensors = inter;
    if (r.id === 'vr') {
      const hs = (on(r, 'vr_seated') ? r.opts.vrSeated : 0) + (on(r, 'vr_standing') ? r.opts.vrStanding : 0);
      e.headsets = hs ? hs + Math.max(1, Math.ceil(hs * 0.25)) : 0; // spares for charging rotation
      e.displays = on(r, 'vr_bigscreen') ? 1 : 0;
      e.touch = on(r, 'vr_touch') ? 2 : 0;
      e.media += e.displays;
    }
    if (r.id === 'entrance' && on(r, 'ent_route_choice')) e.touch += 1;
    return e;
  }

  // ---------- Budget ----------
  const CATS = [
    ['content', 'Content production'], ['fabrication', 'Physical fabrication'], ['equipment', 'Equipment hire or purchase'],
    ['installation', 'Installation'], ['venue', 'Venue'], ['staffing', 'Staffing'], ['insurance', 'Insurance'], ['contingency', 'Contingency']
  ];
  const CONTENT_DAYS = { // [animation, sound, programming]
    entrance: [20, 3, 3], mouth: [24, 4, 6], digestive: [28, 6, 2], heart: [14, 3, 3], cellular: [45, 5, 1], signals: [18, 4, 12], vr: [10, 3, 32]
  };

  function computeBudget(config) {
    const b = config.budget, rt = b.rates, L = window.UW_LAYOUT.computeLayout(config);
    const lines = [];
    const add = (cat, id, label, qty, unit, rate, type, room, opts) => {
      opts = opts || {};
      const ov = b.overrides[id] || {};
      let rateId = null;
      if (typeof rate === 'string') { rateId = rate; rate = rt[rate]; }
      const q = ov.qty != null ? ov.qty : qty;
      const r = ov.rate != null ? ov.rate : rate;
      lines.push({ cat, id, label, qty: q, unit, rate: r, type, room, amount: q * r, gst: opts.gst !== false, rateId, basis: opts.basis || '', overridden: ov.qty != null || ov.rate != null, inKind: !!opts.inKind });
    };
    const weeksHire = b.runWeeks + b.installWeeks;
    const rooms = config.rooms.filter(r => r.enabled);
    const eqTotals = { projectors: 0, speakers: 0, media: 0, sensors: 0, headsets: 0, displays: 0, touch: 0 };
    let inKindValue = 0;
    rooms.forEach(r => {
      const e = roomEquipment(r); Object.keys(eqTotals).forEach(k => { eqTotals[k] += e[k]; });
      const nm = ROOM_SHORT[r.id];
      // content
      const cd = CONTENT_DAYS[r.id];
      const covF = 0.6 + 0.4 * r.coverage / 100;
      let anim = cd[0] * covF;
      if (r.id === 'digestive' && !on(r, 'dig_microbiome')) anim -= 8;
      if (r.id === 'heart' && r.opts.heartMode === 'projection') anim += 10;
      const dev = cd[2] + (r.id === 'vr' ? 4 * ((r.opts.vrSeated || 0) + (r.opts.vrStanding || 0) > 4 ? 1 : 0) : 0);
      const diy = (r.diy || 0) / 100;
      const animCash = Math.round(anim * (b.excludeInKind ? 1 - diy : 1));
      const devCash = Math.round(dev * (r.id === 'vr' && b.excludeInKind ? 1 - diy : 1));
      inKindValue += Math.round(anim * diy) * rt.anim_day + (r.id === 'vr' ? Math.round(dev * diy) * rt.dev_day : 0);
      add('content', r.id + '_anim', nm + ': animation and projection content', animCash, 'days', 'anim_day', 'oneoff', r.id, { basis: `${Math.round(anim)} days scaled by ${r.coverage}% coverage; ${r.diy}% made by you` });
      add('content', r.id + '_sound', nm + ': sound design', cd[1], 'days', 'sound_day', 'oneoff', r.id);
      if (dev) add('content', r.id + '_dev', nm + (r.id === 'vr' ? ': VR and touchscreen development' : ': interaction programming'), devCash, 'days', 'dev_day', 'oneoff', r.id);
      add('content', r.id + '_review', nm + ': expert scientific review', 8, 'hours', 'review_hr', 'oneoff', r.id);
      // fabrication
      const s = r.modelScale;
      const fab = (id, label, amt, basis) => add('fabrication', r.id + '_' + id, nm + ': ' + label, 1, 'item', Math.round(amt), 'oneoff', r.id, { basis });
      if (r.id === 'entrance') {
        if (on(r, 'ent_intro_panel')) fab('panel', 'accessible introduction panel', 4500, 'Large print, tactile map, captions');
        if (on(r, 'ent_route_choice')) fab('choice', 'route choice point', 3000);
      }
      if (r.id === 'mouth') {
        if (on(r, 'mouth_teeth')) add('fabrication', 'mouth_teeth', nm + ': oversized teeth', r.opts.teeth, 'teeth', Math.round(6500 * s * s), 'oneoff', r.id, { basis: 'CNC foam or printed shells, hard-coated and finished' });
        if (on(r, 'mouth_tongue')) add('fabrication', 'mouth_tongue', nm + ': tongue floor surface', Math.round(r.w * 0.5 * r.d * 0.35 * s), 'm²', 950, 'oneoff', r.id);
        if (on(r, 'mouth_palate')) fab('palate', 'palate canopy', 14000 * s, 'Tension fabric on arched frame');
        if (on(r, 'mouth_choice')) fab('choiceplinth', 'drink selector plinth', 2800);
      }
      if (r.id === 'digestive') {
        if (on(r, 'dig_oesophagus')) add('fabrication', 'dig_oesophagus', nm + ': oesophagus passage', Math.round(r.w * 0.55), 'm', 3200, 'oneoff', r.id, { basis: 'Steel ribs, stretch fabric skin' });
        if (on(r, 'dig_stomach')) fab('stomach', 'stomach chamber shell', 26000 * s * s);
        if (on(r, 'dig_stepfree')) fab('stepfree', 'step-free route (rail, lighting, marking)', 3200);
      }
      if (r.id === 'heart') {
        const hm = { printed: [18000, '3D-printed model, ~1.2 m, finished'], fabricated: [68000, 'Fabricated sculpture, ~2.6 m: armature, CNC foam, hard coat, paint'], projection: [46000, 'Neutral-finish sculpture for projection mapping, ~2.6 m'] }[r.opts.heartMode];
        if (on(r, 'heart_model')) fab('model', 'heart sculpture', hm[0] * s * s, hm[1]);
        if (on(r, 'heart_model')) add('content', 'heart_struct', nm + ': structural engineering review', 1, 'item', 3500, 'oneoff', r.id);
        if (on(r, 'heart_pulse')) fab('pulse', 'pulse demonstration plinth', 2500);
      }
      if (r.id === 'cellular') {
        if (on(r, 'cell_bench')) fab('bench', 'central seating', 3200);
        if (on(r, 'cell_scalebar')) fab('scale', 'scale ladder strip', 1500);
      }
      if (r.id === 'signals') {
        if (on(r, 'sig_neuron')) fab('neuron', 'suspended neuron sculpture with addressable LEDs', 38000 * s, 'Rigging and load review required');
        if (on(r, 'sig_control')) fab('control', r.opts.controlType === 'touchfree' ? 'touch-free sensor plinth' : 'tactile button plinth', r.opts.controlType === 'touchfree' ? 3200 : 2400);
        if (on(r, 'sig_label')) fab('label', 'simplifications panel', 700);
      }
      if (r.id === 'vr') {
        if (on(r, 'vr_seated')) add('fabrication', 'vr_chairs', nm + ': swivel chairs', r.opts.vrSeated, 'chairs', 450, 'oneoff', r.id);
        if (on(r, 'vr_standing')) add('fabrication', 'vr_mats', nm + ': standing zone mats and barriers', r.opts.vrStanding, 'zones', 650, 'oneoff', r.id);
        if (on(r, 'vr_storage')) fab('cabinet', 'charging and hygiene cabinet', 2600);
        if (on(r, 'vr_staff')) fab('staff', 'staff station', 1500);
        if (on(r, 'vr_quiet')) fab('quiet', 'quiet reflection area', 4200);
      }
      add('fabrication', r.id + '_signage', nm + ': signage and wayfinding', 1, 'set', 800, 'oneoff', r.id);
      add('fabrication', r.id + '_surface', nm + ': projection surface preparation', Math.round(e.projArea + e.floorProjArea), 'm²', 'surface_m2', 'oneoff', r.id);
    });
    // partitions: perimeter of rooms, shared walls counted once
    const perim = L.rooms.reduce((s, R) => s + 2 * (R.w + R.d), 0) - L.doors.filter(d => !d.outer).reduce((s, d) => s + (L.rooms.find(R => R.id === d.from) || { d: 0 }).d * 0.5, 0);
    add('fabrication', 'partitions', 'Blackout partition walls (whole route)', Math.round(perim * 0.8), 'linear m', 'partition_lm', 'oneoff', null, { basis: 'Assumes the venue shell is used as-is and rooms are formed with temporary partitions' });
    // equipment
    const eq = (id, label, qty, hireRate, buyRate, forceBuy) => {
      if (!qty) return;
      if (b.equipMode === 'buy' || forceBuy) add('equipment', 'eq_' + id, label + ' (purchase)', qty, 'each', buyRate, 'oneoff', null);
      else add('equipment', 'eq_' + id, label + ' (hire)', qty * weeksHire, 'unit-weeks', hireRate, 'recurringFixed', null, { basis: `${qty} × ${weeksHire} weeks (run + install)` });
    };
    eq('projectors', 'Laser projectors', eqTotals.projectors, 'proj_hire', 'proj_buy');
    eq('speakers', 'Speakers and amplification', eqTotals.speakers, 'spk_hire', 'spk_buy');
    eq('media', 'Media servers / players', eqTotals.media, 'media_hire', 'media_buy');
    eq('displays', 'Large displays', eqTotals.displays, 'display_hire', 'display_buy');
    eq('headsets', 'Meta Quest headsets', eqTotals.headsets, 0, 'headset_buy', true);
    eq('touch', 'Touchscreen kiosks', eqTotals.touch, 0, 'touch_buy', true);
    eq('sensors', 'Sensors and controllers', eqTotals.sensors, 0, 'sensor_buy', true);
    // installation
    const avRooms = rooms.filter(r => { const e = roomEquipment(r); return e.projectors || e.speakers; }).length;
    const crewDays = Math.ceil(eqTotals.projectors * 0.8 + eqTotals.speakers * 0.15 + rooms.length * 1.5);
    add('installation', 'inst_av', 'AV installation, alignment and commissioning', crewDays, 'crew-days', 'install_day', 'oneoff', null, { basis: 'Projector rigging, alignment, edge blending, sound tuning' });
    add('installation', 'inst_elec', 'Electrical and data works', avRooms, 'rooms', 'electrical_room', 'oneoff', null);
    add('installation', 'inst_fab', 'Fabrication install and partition build', Math.ceil(rooms.length * 2.5), 'crew-days', 1200, 'oneoff', null);
    add('installation', 'inst_out', 'Bump-out and make good', Math.ceil(crewDays * 0.35 + rooms.length), 'crew-days', 1200, 'oneoff', null);
    // venue
    const gross = Math.round(L.floorArea * 1.35);
    add('venue', 'venue_hire', 'Venue hire (exhibition + circulation + back of house)', gross * weeksHire, 'm²-weeks', 'venue_m2wk', 'recurringFixed', null, { basis: `${gross} m² gross × ${weeksHire} weeks` });
    const kw = eqTotals.projectors * 0.65 + eqTotals.speakers * 0.05 + eqTotals.media * 0.25 + eqTotals.displays * 0.3 + rooms.length * 0.8;
    add('venue', 'venue_power', 'Electricity (AV and lighting)', Math.round(kw * (b.hoursPerWeek + 6) * b.runWeeks), 'kWh', 'power_kwh', 'recurringFixed', null, { basis: `≈${kw.toFixed(1)} kW while open` });
    // staffing
    const vr = rooms.find(r => r.id === 'vr');
    const vrStaff = vr ? Math.max(1, Math.ceil(((on(vr, 'vr_seated') ? vr.opts.vrSeated : 0) + (on(vr, 'vr_standing') ? vr.opts.vrStanding : 0)) / 3)) : 0;
    const hosts = 1 + vrStaff + Math.ceil(Math.max(0, rooms.length - 2) / 2) + 1;
    add('staffing', 'staff_hosts', `Visitor hosts and supervisor (${hosts} on shift)`, hosts * b.hoursPerWeek * b.runWeeks, 'hours', 'staff_hr', 'recurringFixed', null, { gst: false, basis: `${hosts} staff × ${b.hoursPerWeek} h × ${b.runWeeks} weeks; wages carry no GST` });
    add('staffing', 'staff_tech', 'On-call AV technician', Math.max(4, Math.round(b.hoursPerWeek / 8)) * b.runWeeks, 'hours', 75, 'recurringFixed', null, { basis: 'Daily start-up checks and fault response' });
    // insurance
    add('insurance', 'ins_pl', 'Public liability ($20m cover)', 1, 'policy', 'pl_insurance', 'oneoff', null, { gst: true });
    const bought = lines.filter(l => l.cat === 'equipment' && l.type === 'oneoff').reduce((s, l) => s + l.amount, 0);
    if (bought) add('insurance', 'ins_equip', 'Equipment insurance', Math.round(bought * rt.equip_ins_pct / 100), 'AUD', 1, 'oneoff', null);
    // contingency on everything one-off
    const oneoffSub = lines.filter(l => l.type === 'oneoff').reduce((s, l) => s + l.amount, 0);
    add('contingency', 'contingency', `Contingency (${b.contingencyPct}% of one-off costs)`, Math.round(oneoffSub * b.contingencyPct / 100), 'AUD', 1, 'oneoff', null);

    const sum = f => lines.filter(f).reduce((s, l) => s + l.amount, 0);
    const oneoff = sum(l => l.type === 'oneoff');
    const recurring = sum(l => l.type !== 'oneoff');
    const gstBase = sum(l => l.gst);
    const gst = gstBase * b.gstRate / 100;
    const byCat = {}; CATS.forEach(([k]) => { byCat[k] = { oneoff: sum(l => l.cat === k && l.type === 'oneoff'), recurring: sum(l => l.cat === k && l.type !== 'oneoff') }; });
    const perWeek = b.runWeeks ? recurring / b.runWeeks : 0;
    return { lines, oneoff, recurring, perWeek, total: oneoff + recurring, gst, totalInc: oneoff + recurring + gst, byCat, eq: eqTotals, inKindValue, floorArea: L.floorArea, gross, layout: L, hosts };
  }

  window.UW_MODEL = { KINDS, ELEMENTS, EL, ROOM_NAMES, ROOM_SHORT, ROOM_ORDER, RATES, CATS, SCENARIOS, defaultRoom, baseConfig, scenario, roomEquipment, computeBudget, projArea };
})();
