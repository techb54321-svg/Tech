(() => {
  if (window.top !== window) return;

  // Tuning. His steps keep pace with the speed automatically, so his feet never slide.
  const WALK_SPEED = 40;        // pixels per second
  const WALK_DISTANCE = 260;    // how far from the close button he drops in
  const SIZE = 96;              // his height in pixels
  const LINE = 'Nope not now';  // what he says before closing the tab

  // The close button he boops, placed so his nose lands on it when he leans in.
  const TOP = 8;
  const BTN = { size: 40, right: 16, top: Math.round(TOP + 0.594 * SIZE - 20) };
  const REACH = Math.round(0.995 * SIZE);

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
.shadow { position: absolute; left: 14%; right: 22%; top: 92.5%; height: 7%; border-radius: 50%; background: rgba(0,0,0,.2); }
.squash { position: absolute; inset: 0; transform-origin: 46% 96%; filter: drop-shadow(0 3px 4px rgba(0,0,0,.28)); }
.squash svg { width: 100%; height: 100%; overflow: visible; display: block; }
.bubble { position: absolute; top: 26px; box-sizing: border-box; padding: 9px 13px; border-radius: 14px 14px 4px 14px;
  background: #fff; color: #1c1917; opacity: 0; white-space: nowrap; box-shadow: 0 6px 20px rgba(0,0,0,.3); }
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

  // A smooth round orange guy, facing right: body, a stubby nose, two short legs.
  // Drawn on a 100 x 100 grid. Hips are at y = 66, ankles at y = 92.
  const HIP_A = 42, HIP_B = 52, HIP_Y = 66, ANKLE_Y = 92;
  const BELLY = { x: 46, y: 81 };  // bottom of his body, which he rocks and stretches around

  function buildGuy() {
    const leg = (name, x, shade, shoe) =>
      s('g', { class: name },
        s('rect', { x: x - 4.5, y: 62, width: 9, height: 30, rx: 4.5, fill: shade }),
        s('rect', { class: 'foot', x: x - 6, y: 87.2, width: 19, height: 9.2, rx: 4.6, fill: shoe }));

    return s('svg', { viewBox: '0 0 100 100' },
      s('defs', null,
        s('radialGradient', { id: 'sb-body', cx: 0.34, cy: 0.26, r: 0.85 },
          s('stop', { offset: 0, 'stop-color': '#ffcb45' }),
          s('stop', { offset: 0.42, 'stop-color': '#ffa51f' }),
          s('stop', { offset: 1, 'stop-color': '#f27a08' }))),
      s('g', { class: 'rig' },
        leg('leg-b', HIP_B, '#d95a0c', '#c2440f'),
        leg('leg-a', HIP_A, '#ee6c12', '#e2521a'),
        s('g', { class: 'torso' },
          // His nose: the bit that sticks out furthest, and what he closes tabs with.
          s('path', { d: 'M70 43.5C78 44.5 86 47.5 88.6 50.6Q90.4 52.6 88.2 54.4C85 57.2 78 60 70 61Z', fill: '#f26a0c' }),
          s('ellipse', { cx: 46, cy: 50, rx: 33, ry: 31.5, fill: 'url(#sb-body) #ffa01c' }),
          s('ellipse', { cx: 33, cy: 35, rx: 11, ry: 6.5, transform: 'rotate(-32 33 35)', fill: '#fff', opacity: 0.2 }))));
  }

  // ---- Moving him ----------------------------------------------------------

  const TAU = Math.PI * 2;
  const rad = (deg) => (deg * Math.PI) / 180;
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const ease = (t) => t * t * (3 - 2 * t);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const SWING = 26;  // how far each leg swings, in degrees
  const LIFT = 5;    // how high a foot lifts mid-step
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
  // pose.lean: degrees he tips forward. pose.boop: 0 standing, 1 nose pushed out.
  function draw(part, pose, now, still) {
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

    // Walking: he squishes as each foot lands and rocks from side to side.
    // Standing: he breathes. Booping: he stretches forward, nose first.
    const beat = k * Math.cos(2 * TAU * pose.phase);   // +1 as a foot lands, -1 mid-step
    const sway = 5 * k * Math.sin(TAU * pose.phase);
    const breath = still ? 0 : (1 - k) * (1 - pose.boop) * Math.sin(now / 420);
    const wide = (1 + 0.035 * beat - 0.008 * breath) * (1 + 0.12 * pose.boop);
    const tall = (1 - 0.04 * beat + 0.012 * breath) * (1 - 0.06 * pose.boop);
    set(part.torso, `translate(${r3(BELLY.x + 5 * pose.boop)} ${BELLY.y}) rotate(${r3(pose.lean + sway)}) ` +
      `scale(${r3(wide)} ${r3(tall)}) translate(${-BELLY.x} ${-BELLY.y})`);
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
    const veil = h('veil'), ring = h('ring'), bubble = h('bubble', LINE);
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
    const part = { rig: find('rig'), torso: find('torso'), legA: find('leg-a'), legB: find('leg-b') };

    const width = document.documentElement.clientWidth || window.innerWidth;
    const stopX = Math.max(8, width - BTN.right - BTN.size - REACH);
    const startX = calm ? stopX : Math.max(8, stopX - WALK_DISTANCE);
    let px = startX;
    const place = () => { guy.style.transform = `translate(${r3(px)}px, 0)`; };
    bubble.style.right = `${width - stopX + 2}px`;

    // One loop redraws him every frame; the steps below just change his pose.
    const pose = { phase: 0.25, amp: 0, lean: 0, boop: 0 };
    let alive = true;
    requestAnimationFrame(function loop(now) {
      if (!alive) return;
      if (!host.isConnected) document.documentElement.append(host);
      draw(part, pose, now, calm);
      requestAnimationFrame(loop);
    });
    draw(part, pose, 0, true);
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

    // Wind up, then boop the button with his nose.
    if (calm) {
      pose.boop = 1;
    } else {
      await tween(190, (t) => { pose.lean = -9 * ease(t); });
      await tween(100, (t) => { pose.lean = -9 + 15 * t; pose.boop = t; });
      x.animate(
        [{ transform: 'translateX(0) scale(1)' }, { transform: 'translateX(5px) scale(.72)' },
          { transform: 'translateX(0) scale(1.08)' }, { transform: 'translateX(0) scale(1)' }],
        { duration: 320 });
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
