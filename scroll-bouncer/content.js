(() => {
  if (window.top !== window) return;

  // Tuning. His steps keep pace with the speed automatically, so his feet never slide.
  const WALK_SPEED = 40;      // pixels per second
  const WALK_DISTANCE = 260;  // how far from the close button he drops in
  const SIZE = 108;           // his height in pixels

  const LINES = [
    'Nope. Not today.',
    'Go do the thing you were avoiding.',
    'You already checked. Nothing changed.',
    'Closing this for you. You are welcome.',
    'Future you says thanks.',
    'Back to real life!'
  ];

  // The close button he pokes, placed so his outstretched arm lands on it.
  const TOP = 8;
  const BTN = { size: 40, right: 16, top: Math.round(TOP + 0.56 * SIZE - 20) };
  const REACH = Math.round(0.915 * SIZE);

  const CSS = `
.stage { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; overflow: hidden;
  font: 600 14px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif; }
.veil { position: absolute; inset: 0; background: #0c0a09; opacity: 0; }
.x, .ring { position: absolute; top: ${BTN.top}px; right: ${BTN.right}px; width: ${BTN.size}px; height: ${BTN.size}px;
  border-radius: 50%; box-sizing: border-box; }
.x { background: #ef4444; border: 2.5px solid #fff; box-shadow: 0 3px 12px rgba(0,0,0,.35);
  display: grid; place-items: center; }
.x svg { width: 22px; height: 22px; display: block; }
.ring { border: 3px solid #fca5a5; opacity: 0; }
.guy { position: absolute; top: ${TOP}px; left: 0; width: ${SIZE}px; height: ${SIZE}px; opacity: 0; will-change: transform; }
.shadow { position: absolute; left: 20%; right: 20%; top: 92.5%; height: 7%; border-radius: 50%; background: rgba(0,0,0,.2); }
.squash { position: absolute; inset: 0; transform-origin: 50% 96%;
  filter: drop-shadow(1.5px 0 0 #fff) drop-shadow(-1.5px 0 0 #fff) drop-shadow(0 1.5px 0 #fff)
    drop-shadow(0 -1.5px 0 #fff) drop-shadow(0 3px 4px rgba(0,0,0,.3)); }
.squash svg { width: 100%; height: 100%; overflow: visible; display: block; }
.bubble { position: absolute; top: 26px; box-sizing: border-box; padding: 9px 13px; border-radius: 14px 14px 4px 14px;
  background: #fff; color: #1c1917; opacity: 0; box-shadow: 0 6px 20px rgba(0,0,0,.3); }
.card { position: absolute; inset: 0; display: none; place-items: center; text-align: center;
  background: #0c0a09; color: #fafaf9; font-size: 20px; padding: 24px; pointer-events: auto; }
.card small { display: block; margin-top: 8px; font-weight: 400; font-size: 14px; opacity: .7; }
`;

  // ---- Building him --------------------------------------------------------
  // Everything is built node by node (no innerHTML) so strict site security
  // policies cannot stop him from appearing.

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function node(ns, tag, attrs, kids) {
    const n = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    n.append(...kids);
    return n;
  }
  const s = (tag, attrs, ...kids) => node(SVG_NS, tag, attrs, kids);
  const h = (cls, ...kids) => node(null, 'div', { class: cls }, kids);

  // Drawn on a 100 x 100 grid, facing right. Hips are at y = 62, ankles at y = 92.
  const HIP_A = 45, HIP_B = 54.5, HIP_Y = 62, ANKLE_Y = 92;

  function buildGuy() {
    const leg = (name, x, shade, shoe) =>
      s('g', { class: name },
        s('rect', { x: x - 5, y: 58, width: 10, height: 34, rx: 5, fill: shade }),
        s('rect', { class: 'foot', x: x - 6.5, y: 87.2, width: 20.5, height: 9.2, rx: 4.6, fill: shoe }));

    return s('svg', { viewBox: '0 0 100 100' },
      s('g', { class: 'rig' },
        leg('leg-b', HIP_B, '#b4420d', '#8a2f0b'),
        leg('leg-a', HIP_A, '#cf5210', '#a63a0c'),
        s('g', { class: 'torso' },
          s('g', { class: 'arm-b' },
            s('rect', { x: 70, y: 50, width: 17, height: 7.5, rx: 3.75, fill: '#d9560f' })),
          s('g', { class: 'leaf' },
            s('path', { d: 'M50 22.5V15', stroke: '#4d7c0f', 'stroke-width': 2.8, 'stroke-linecap': 'round' }),
            s('path', { d: 'M50.5 16C50 7.5 60 3 68.5 6 67 14 58.5 18.5 50.5 16Z', fill: '#84cc16' }),
            s('path', { d: 'M52 15.1C56.5 12 61 9.5 66 7.7', stroke: '#4d7c0f', 'stroke-width': 1.2,
              'stroke-linecap': 'round', fill: 'none' })),
          s('ellipse', { cx: 50, cy: 48, rx: 31, ry: 28.5, fill: '#f06d1a' }),
          s('ellipse', { cx: 48.9, cy: 46.2, rx: 28.5, ry: 26, fill: '#ff8f30' }),
          s('ellipse', { cx: 36, cy: 32.5, rx: 10.5, ry: 5.4, transform: 'rotate(-30 36 32.5)', fill: '#ffbd7d', opacity: 0.85 }),
          s('ellipse', { cx: 44, cy: 60, rx: 4.8, ry: 2.9, fill: '#ff4d6d', opacity: 0.45 }),
          s('ellipse', { cx: 74.2, cy: 59.4, rx: 3.4, ry: 2.4, fill: '#ff4d6d', opacity: 0.45 }),
          s('g', { class: 'eyes' },
            s('ellipse', { cx: 52.5, cy: 51, rx: 5.3, ry: 6.8, fill: '#2a1505' }),
            s('ellipse', { cx: 70, cy: 51, rx: 4.4, ry: 6.1, fill: '#2a1505' }),
            s('g', { class: 'shine' },
              s('circle', { cx: 50.7, cy: 48.2, r: 2.2, fill: '#fff' }),
              s('circle', { cx: 68.5, cy: 48.4, r: 1.9, fill: '#fff' }),
              s('circle', { cx: 54.8, cy: 54.2, r: 1.05, fill: '#fff', opacity: 0.85 }),
              s('circle', { cx: 71.7, cy: 54, r: 0.95, fill: '#fff', opacity: 0.85 }))),
          s('path', { class: 'smile', d: 'M58.6 57.2q2.8 3.2 5.6 0', stroke: '#2a1505', 'stroke-width': 1.9,
            'stroke-linecap': 'round', fill: 'none' }),
          s('path', { class: 'open', d: 'M57.9 56.4q3.5 7.4 7 0z', fill: '#7f1d1d', stroke: '#2a1505',
            'stroke-width': 1.4, 'stroke-linejoin': 'round' }),
          s('g', { class: 'arm-a' },
            s('rect', { x: 30.5, y: 53, width: 7.5, height: 14.5, rx: 3.75, fill: '#e2600f' })))));
  }

  // ---- Moving him ----------------------------------------------------------

  const TAU = Math.PI * 2;
  const rad = (deg) => (deg * Math.PI) / 180;
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const ease = (t) => t * t * (3 - 2 * t);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const SWING = 22;  // how far each leg swings, in degrees
  const LIFT = 6;    // how high a foot lifts mid-step
  const LEG = ANKLE_Y - HIP_Y;
  // Ground covered by one full stride (two steps), in pixels.
  const STRIDE = 4 * LEG * Math.sin(rad(SWING)) * (SIZE / 100);

  // One leg through a stride. First half: foot planted, sweeping back as he
  // moves forward. Second half: foot lifted and swung forward again.
  function legAt(phase) {
    const t = phase - Math.floor(phase);
    if (t < 0.5) return { angle: SWING * (4 * t - 1), lift: 0, toe: 0, planted: true };
    const u = (t - 0.5) * 2;
    return {
      angle: SWING * Math.cos(Math.PI * u),
      lift: LIFT * Math.sin(Math.PI * u),
      toe: 16 * Math.sin(TAU * u),
      planted: false
    };
  }

  // pose.phase: where he is in the stride. pose.amp: 0 standing still, 1 walking.
  // pose.lean: degrees he tips forward. pose.reach: 0 arm down, 1 arm poking.
  function draw(part, pose, now, blinks) {
    const set = (el, value) => el.setAttribute('transform', value);
    const k = pose.amp;
    const a = legAt(pose.phase), b = legAt(pose.phase + 0.5);
    const planted = a.planted ? a : b;

    // Sink a little as the legs spread so the planted foot stays on the ground.
    set(part.rig, `translate(0 ${r3(LEG * (1 - Math.cos(rad(planted.angle * k))))})`);
    for (const [name, p, hip] of [['legA', a, HIP_A], ['legB', b, HIP_B]]) {
      set(part[name], `rotate(${r3(p.angle * k)} ${hip} ${HIP_Y}) translate(0 ${r3(-p.lift * k)})`);
      set(part[name].lastChild, `rotate(${r3((p.toe - p.angle) * k)} ${hip} ${ANKLE_Y})`);
    }

    const beat = k * Math.cos(2 * TAU * pose.phase);   // +1 as a foot lands, -1 mid-step
    const sway = 3 * k * Math.sin(TAU * pose.phase);
    set(part.torso, `translate(50 76) rotate(${r3(pose.lean + sway)}) ` +
      `scale(${r3(1 + 0.03 * beat)} ${r3(1 - 0.035 * beat)}) translate(-50 -76)`);

    const swing = k * Math.cos(TAU * pose.phase);
    set(part.armA, `rotate(${r3(8 + 20 * swing)} 34.25 55)`);
    const armB = (55 - 14 * swing) * (1 - pose.reach) - 14 * pose.reach;
    set(part.armB, `translate(73 53.75) rotate(${r3(armB)}) scale(${r3(1 + 0.3 * pose.reach)} 1) translate(-73 -53.75)`);
    set(part.leaf, `rotate(${r3(9 * k * Math.sin(2 * TAU * pose.phase - 0.9) - 0.7 * pose.lean)} 50 17.5)`);

    const lid = blinks && now % 2900 < 130 ? 0.12 : 1;
    set(part.eyes, `translate(0 51) scale(1 ${lid}) translate(0 -51)`);
    part.shine.style.display = lid < 1 ? 'none' : '';
    part.smile.style.display = pose.reach > 0.5 ? 'none' : '';
    part.open.style.display = pose.reach > 0.5 ? '' : 'none';
  }

  function tween(ms, step) {
    return new Promise((done) => {
      let t0;
      requestAnimationFrame(function frame(now) {
        t0 ??= now;
        const t = Math.min(1, (now - t0) / ms);
        step(t);
        if (t < 1) requestAnimationFrame(frame); else done();
      });
    });
  }

  function tabVisible() {
    return new Promise((ready) => {
      if (!document.hidden) return ready();
      document.addEventListener('visibilitychange', function seen() {
        if (document.hidden) return;
        document.removeEventListener('visibilitychange', seen);
        ready();
      });
    });
  }

  // ---- The whole routine ---------------------------------------------------

  let running = false;
  let lastUrl = '';

  async function shouldBounce() {
    let cfg;
    try { cfg = await chrome.storage.sync.get(SB_DEFAULTS); } catch { return false; }
    if (!cfg.enabled || Date.now() < cfg.snoozeUntil) return false;
    return sbMatches(location.href, cfg.sites);
  }

  async function bounce() {
    running = true;
    // If the site was opened in a background tab, wait until someone is looking.
    await tabVisible();

    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const svg = buildGuy();
    const squash = h('squash', svg);
    const guy = h('guy', h('shadow'), squash);
    const veil = h('veil'), ring = h('ring'), bubble = h('bubble');
    const x = h('x', s('svg', { viewBox: '0 0 24 24' },
      s('path', { d: 'M7.5 7.5l9 9m0-9l-9 9', stroke: '#fff', 'stroke-width': 3.2, 'stroke-linecap': 'round' })));
    const card = h('card', h('', 'Tab closed by the Scroll Bouncer.', node(null, 'small', null, ['You can close this page.'])));
    const style = document.createElement('style');
    style.textContent = CSS;

    const host = document.createElement('div');
    host.style.setProperty('all', 'initial', 'important');
    const root = host.attachShadow({ mode: 'closed' });
    root.append(style, h('stage', veil, ring, x, guy, bubble, card));
    document.documentElement.append(host);

    const find = (cls) => svg.querySelector('.' + cls);
    const part = {
      rig: find('rig'), torso: find('torso'), legA: find('leg-a'), legB: find('leg-b'),
      armA: find('arm-a'), armB: find('arm-b'), leaf: find('leaf'), eyes: find('eyes'),
      shine: find('shine'), smile: find('smile'), open: find('open')
    };

    const width = document.documentElement.clientWidth || window.innerWidth;
    const stopX = Math.max(8, width - BTN.right - BTN.size - REACH);
    const startX = calm ? stopX : Math.max(8, stopX - WALK_DISTANCE);
    let px = startX;
    const place = () => { guy.style.transform = `translate(${r3(px)}px, 0)`; };

    bubble.textContent = LINES[Math.floor(Math.random() * LINES.length)];
    bubble.style.right = `${width - stopX + 4}px`;
    bubble.style.maxWidth = `${Math.max(110, Math.min(230, stopX - 16))}px`;

    // One loop redraws him every frame; the steps below just change his pose.
    const pose = { phase: 0.25, amp: 0, lean: 0, reach: 0 };
    let alive = true;
    requestAnimationFrame(function loop(now) {
      if (!alive) return;
      if (!host.isConnected) document.documentElement.append(host);
      draw(part, pose, now, !calm);
      requestAnimationFrame(loop);
    });
    draw(part, pose, 1000, false);
    place();
    guy.style.opacity = 1;

    if (calm) {
      await guy.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 }).finished;
    } else {
      // Drop in from above and land with a squish.
      await guy.animate(
        [{ transform: `translate(${r3(px)}px, -${TOP + SIZE + 24}px)` }, { transform: `translate(${r3(px)}px, 0)` }],
        { duration: 420, easing: 'cubic-bezier(.5,0,.9,.5)' }
      ).finished;
      await squash.animate(
        [{ transform: 'scale(1.18,.78)' }, { transform: 'scale(.95,1.07)', offset: 0.5 },
          { transform: 'scale(1.02,.98)', offset: 0.8 }, { transform: 'scale(1,1)' }],
        { duration: 420, easing: 'ease-out' }
      ).finished;
      await sleep(250);

      // Toddle over to the button.
      await new Promise((arrived) => {
        let last;
        requestAnimationFrame(function step(now) {
          const dt = Math.min(50, now - (last ?? now));
          last = now;
          px = Math.min(stopX, px + (WALK_SPEED * dt) / 1000);
          pose.phase = 0.25 + (px - startX) / STRIDE;
          pose.amp = Math.min(1, (px - startX) / 12);
          place();
          if (px < stopX) requestAnimationFrame(step); else arrived();
        });
      });
      const amp = pose.amp;
      await tween(260, (t) => { pose.amp = amp * (1 - ease(t)); });
    }

    bubble.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: 180, fill: 'forwards' });
    await sleep(calm ? 1100 : 750);

    // Wind up, then poke.
    if (calm) {
      pose.reach = 1;
    } else {
      await tween(170, (t) => { pose.lean = -7 * ease(t); });
      await tween(110, (t) => { pose.lean = -7 + 16 * t; pose.reach = t; });
      x.animate([{ transform: 'scale(1)' }, { transform: 'scale(.7)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }],
        { duration: 300 });
      ring.animate([{ opacity: 0.9, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.9)' }],
        { duration: 420, easing: 'ease-out' });
    }
    await sleep(420);
    await veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: calm ? 1 : 280, fill: 'forwards' }).finished;

    let closed = false;
    try {
      const res = await chrome.runtime.sendMessage({ type: 'sb-close' });
      closed = !!(res && res.ok);
    } catch { /* extension reloaded or tab already going away */ }

    if (!closed) {
      // Could not close the tab: keep the page covered instead.
      alive = false;
      card.style.display = 'grid';
      try { window.stop(); } catch {}
    }
  }

  async function check() {
    if (running || location.href === lastUrl) return;
    lastUrl = location.href;
    if (await shouldBounce()) bounce();
  }

  check();
  // Single-page apps change the URL without reloading (e.g. YouTube -> Shorts).
  setInterval(check, 1000);
  // Pages restored from the back/forward cache skip the initial run.
  window.addEventListener('pageshow', (e) => { if (e.persisted) { lastUrl = ''; running = false; check(); } });
  chrome.storage.onChanged.addListener(() => { lastUrl = ''; check(); });
})();
