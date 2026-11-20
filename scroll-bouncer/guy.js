// The little guy himself: how he is drawn, how he moves, and his whole routine.
// Shared by the browser extension and the Android app.
const ScrollBouncerGuy = (() => {
  // ---- Settings ------------------------------------------------------------
  // His steps keep pace with the speed automatically, so his feet never slide.
  const WALK_SPEED = 88;        // pixels per second
  const SIZE = 96;              // his height in pixels
  const LINE = 'Nope not now';  // what he says, shaking his head
  const GLASSES = true;         // whether he wears round glasses
  const ARMS = true;            // whether he has arms

  // His colours. The body runs from `light` (where the light hits) to `shade`.
  // His nose and feet are a paler tint of the same colour, and `ink` draws his
  // eyes and mouth.
  const COLOR = {
    light: '#b9f8e6', body: '#3fd9b8', shade: '#14a88e',
    nose: '#bff6e7', foot: '#9aeed9', farFoot: '#77d6c0',
    leg: '#22b99b', farLeg: '#149a80',
    ink: '#123a33', frames: '#123a33'
  };

  // The close button he boops, placed so his nose lands on it when he leans in.
  // `top` is how far down the screen he walks: just under the top edge of a web
  // page, or just under the status bar on a phone.
  const REACH = Math.round(0.987 * SIZE);
  const buttonAt = (top) => ({ size: 40, right: 16, top: Math.round(top + 0.641 * SIZE - 20) });

  // How each piece is laid out. Styles are set on the elements one by one, not
  // through a stylesheet, so no site's security policy can strip them.
  const FILL = { position: 'absolute', top: '0', right: '0', bottom: '0', left: '0' };
  const DRAWING = { width: '100%', height: '100%', overflow: 'visible', display: 'block' };
  const stylesFor = (top, BTN) => {
    const ON_BUTTON = { position: 'absolute', top: `${BTN.top}px`, right: `${BTN.right}px`,
      width: `${BTN.size}px`, height: `${BTN.size}px`, borderRadius: '50%', boxSizing: 'border-box' };
    return {
      stage: { ...FILL, position: 'fixed', zIndex: '2147483647', pointerEvents: 'none', overflow: 'hidden',
        font: '600 14px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif' },
      veil: { ...FILL, background: '#0c0a09', opacity: '0' },
      x: { ...ON_BUTTON, background: '#ef4444', border: '2.5px solid #fff', boxShadow: '0 3px 12px rgba(0,0,0,.35)',
        display: 'grid', placeItems: 'center' },
      cross: { width: '22px', height: '22px', display: 'block' },
      ring: { ...ON_BUTTON, border: '3px solid #fca5a5', opacity: '0' },
      guy: { position: 'absolute', top: `${top}px`, left: '0', width: `${SIZE}px`, height: `${SIZE}px`,
        opacity: '0', willChange: 'transform' },
      shadow: { position: 'absolute', left: '14%', right: '22%', top: '92.5%', height: '7%', borderRadius: '50%',
        background: 'rgba(0,0,0,.2)' },
      squash: { ...FILL, transformOrigin: '46% 96%', filter: 'drop-shadow(0 3px 4px rgba(0,0,0,.28))' },
      bubble: { position: 'absolute', top: `${top + 18}px`, right: `${BTN.right + BTN.size + REACH + 2}px`, boxSizing: 'border-box',
        padding: '9px 13px', borderRadius: '14px 14px 4px 14px', background: '#fff', color: '#1c1917', opacity: '0',
        whiteSpace: 'nowrap', boxShadow: '0 6px 20px rgba(0,0,0,.3)' },
      card: { ...FILL, display: 'none', placeItems: 'center', textAlign: 'center', background: '#0c0a09',
        color: '#fafaf9', fontSize: '20px', padding: '24px', boxSizing: 'border-box', pointerEvents: 'auto' },
      small: { display: 'block', marginTop: '8px', fontWeight: '400', fontSize: '14px', opacity: '.7' }
    };
  };

  // ---- Building him --------------------------------------------------------
  // Everything is built node by node (no innerHTML, no stylesheet) so strict site
  // security policies cannot stop him from appearing.

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function node(ns, tag, attrs, kids) {
    const n = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    n.append(...kids);
    return n;
  }
  const css = (el, styles) => { Object.assign(el.style, styles); return el; };
  const s = (tag, attrs, ...kids) => node(SVG_NS, tag, attrs, kids);

  // A smooth round guy with a button nose, a smile, stubby legs and little arms, drawn twice on
  // the same 100 x 100 grid: side on (facing right) for walking and booping,
  // and front on for looking at you and shaking his head.
  const HIP_A = 41.5, HIP_B = 51.5, HIP_Y = 66, ANKLE_Y = 92;
  const BELLY = { x: 46, y: 81 };   // bottom of his body, which he rocks and stretches around
  const SIDE_EYE = { x: 69.5, y: 52 };              // level with his nose
  const FRONT_EYES = { left: 35.5, right: 56.5, y: 49 };

  const body = () => [
    s('ellipse', { cx: 46, cy: 50, rx: 33, ry: 31.5, fill: `url(#sb-body) ${COLOR.body}` }),
    s('ellipse', { cx: 33, cy: 35, rx: 11, ry: 6.5, transform: 'rotate(-32 33 35)', fill: '#fff', opacity: 0.2 })
  ];
  // An eye: a white with a dark pupil. `look` nudges the pupil sideways.
  const eye = (cx, cy, look) => [
    s('ellipse', { class: 'white', cx, cy, rx: 4.7, ry: 6.7, fill: '#fff' }),
    s('ellipse', { cx: cx + look, cy, rx: 2.7, ry: 4.6, fill: COLOR.ink })
  ];
  const stroke = (cls, d, color, width) =>
    s('path', { class: cls, d, stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', fill: 'none' });
  // An arm hanging straight down from its shoulder: a short sleeve with a paler hand.
  const SHOULDER = { side: { x: 41, y: 57 }, left: { x: 16.5, y: 55 }, right: { x: 75.5, y: 55 } };
  const arm = (cls, at) =>
    s('g', { class: cls },
      s('rect', { x: at.x - 3.75, y: at.y - 3.75, width: 7.5, height: 19, rx: 3.75, fill: COLOR.leg }),
      s('circle', { cx: at.x, cy: at.y + 15.5, r: 4.4, fill: COLOR.foot }));
  const lens = (cx, cy) =>
    s('circle', { cx, cy, r: 8.2, fill: '#fff', 'fill-opacity': 0.14, stroke: COLOR.frames, 'stroke-width': 1.7 });

  function sideView() {
    const { x, y } = SIDE_EYE;
    const leg = (name, hip, shade, shoe) =>
      s('g', { class: name },
        s('rect', { x: hip - 5.5, y: 62, width: 11, height: 30, rx: 5.5, fill: shade }),
        s('rect', { class: 'foot', x: hip - 6.5, y: 87, width: 17.5, height: 9.4, rx: 4.7, fill: shoe }));

    return s('g', { class: 'rig' },
      leg('leg-b', HIP_B, COLOR.farLeg, COLOR.farFoot),
      leg('leg-a', HIP_A, COLOR.leg, COLOR.foot),
      s('g', { class: 'torso' },
        ...body(),
        ...(ARMS ? [arm('arm', SHOULDER.side)] : []),
        ...(GLASSES ? [stroke('', `M${x - 8} ${y - 1.2}L45 ${y - 3.6}`, COLOR.frames, 1.7)] : []),
        s('g', { class: 'eye' }, ...eye(x, y, 0.5)),
        // The same eye squeezed shut in delight, shown while he boops the button.
        stroke('happy', `M${x - 3.1} ${y + 1.6}q3.1 -5.6 6.2 0`, COLOR.ink, 2.2),
        ...(GLASSES ? [lens(x + 0.2, y)] : []),
        // A little smile, tucked under his nose.
        stroke('', 'M74 65.6Q69.6 70.2 64.4 66.4', COLOR.ink, 2),
        // His nose: a round button on the front of his face, and what he closes tabs with.
        s('ellipse', { cx: 81.5, cy: 57.5, rx: 7.5, ry: 6.3, fill: COLOR.nose }),
        s('ellipse', { cx: 79.6, cy: 55.2, rx: 2.4, ry: 1.7, fill: '#fff', opacity: 0.45 })));
  }

  function frontView() {
    const { left, right, y } = FRONT_EYES;
    const gap = right - left - 16.4;
    const leg = (hip) => [
      s('rect', { x: hip - 5.5, y: 62, width: 11, height: 30, rx: 5.5, fill: COLOR.leg }),
      s('rect', { x: hip - 7.5, y: 87, width: 15, height: 9.4, rx: 4.7, fill: COLOR.foot })
    ];

    return s('g', { class: 'front' },
      ...leg(BELLY.x - 8.5), ...leg(BELLY.x + 8.5),
      s('g', { class: 'front-torso' },
        ...(ARMS ? [arm('arm-l', SHOULDER.left), arm('arm-r', SHOULDER.right)] : []),
        ...body(),
        s('g', { class: 'face' },
          s('g', { class: 'front-eyes' }, ...eye(left, y, 0), ...eye(right, y, 0)),
          // Both eyes shut, for shaking his head.
          stroke('shut', `M${left - 4.2} ${y + 0.4}q4.2 3.6 8.4 0M${right - 4.2} ${y + 0.4}q4.2 3.6 8.4 0`, COLOR.ink, 2.2),
          ...(GLASSES ? [
            lens(left, y), lens(right, y),
            stroke('', `M${left + 8.2} ${y - 0.6}q${gap / 2} -1.8 ${gap} 0`, COLOR.frames, 1.7),
            stroke('', `M${left - 8.2} ${y - 0.6}L14.5 ${y - 3}M${right + 8.2} ${y - 0.6}L77.5 ${y - 3}`, COLOR.frames, 1.7)
          ] : []),
          // His mouth: a little smile, or a firm flat line while he shakes his head.
          stroke('smile', 'M40.6 66.2Q46 71.2 51.4 66.2', COLOR.ink, 2),
          stroke('flat', 'M42 67.8H50', COLOR.ink, 2),
          // His nose, seen end on.
          s('circle', { cx: BELLY.x, cy: 58, r: 6.5, fill: COLOR.nose }),
          s('ellipse', { cx: BELLY.x - 2, cy: 55.8, rx: 2.4, ry: 1.7, fill: '#fff', opacity: 0.45 }))));
  }

  function buildGuy() {
    return css(s('svg', { viewBox: '0 0 100 100' },
      s('defs', null,
        s('radialGradient', { id: 'sb-body', cx: 0.34, cy: 0.26, r: 0.85 },
          s('stop', { offset: 0, 'stop-color': COLOR.light }),
          s('stop', { offset: 0.42, 'stop-color': COLOR.body }),
          s('stop', { offset: 1, 'stop-color': COLOR.shade }))),
      sideView(), frontView()), DRAWING);
  }

  // The pieces of him that move.
  function partsOf(svg) {
    const find = (cls) => svg.querySelector('.' + cls);
    return {
      rig: find('rig'), torso: find('torso'), legA: find('leg-a'), legB: find('leg-b'),
      eye: find('eye'), happy: find('happy'), arm: find('arm'), armL: find('arm-l'), armR: find('arm-r'),
      front: find('front'), frontTorso: find('front-torso'), face: find('face'),
      frontEyes: find('front-eyes'), shut: find('shut'), smile: find('smile'), flat: find('flat'),
      whites: svg.querySelectorAll('.white')
    };
  }

  // ---- Moving him ----------------------------------------------------------

  const TAU = Math.PI * 2;
  const rad = (deg) => (deg * Math.PI) / 180;
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const ease = (t) => t * t * (3 - 2 * t);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const SWING = 32;  // how far each leg swings, in degrees
  const LIFT = 6;    // how high a foot lifts mid-step
  const SHAKE = 7;   // how far his face turns each way when he shakes his head
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

  // Side on: pose.phase is where he is in the stride, pose.amp is 0 standing
  // still and 1 walking, pose.lean is degrees tipped forward, pose.boop is 0
  // standing and 1 nose pushed out.
  // Front on (pose.front): pose.shake is how far his face has turned, pose.shut
  // closes his eyes, and pose.raise is 0 arm down and 1 arm up to wag "no".
  function draw(part, pose, now, still) {
    const set = (el, value) => el.setAttribute('transform', value);
    const about = (p, inner) => `translate(${p.x} ${p.y}) ${inner} translate(${-p.x} ${-p.y})`;

    part.rig.style.display = pose.front ? 'none' : '';
    part.front.style.display = pose.front ? '' : 'none';

    // He blinks now and then, and breathes while standing.
    const blink = !still && now % 2900 < 130;
    const lid = blink ? 0.12 : 1;
    for (const white of part.whites) white.style.display = blink ? 'none' : '';
    const breath = still ? 0 : (1 - pose.amp) * (1 - pose.boop) * Math.sin(now / 420);

    if (pose.front) {
      // Shaking his head: his face slides from side to side and his body rocks with it.
      set(part.frontTorso, about(BELLY, `rotate(${r3(0.35 * pose.shake)}) ` +
        `scale(${r3(1 - 0.008 * breath)} ${r3(1 + 0.012 * breath)})`));
      set(part.face, `translate(${r3(pose.shake)} 0)`);
      set(part.frontEyes, about({ x: 0, y: FRONT_EYES.y }, `scale(1 ${lid})`));
      part.frontEyes.style.display = pose.shut ? 'none' : '';
      part.shut.style.display = pose.shut ? '' : 'none';
      part.smile.style.display = pose.shut ? 'none' : '';
      part.flat.style.display = pose.shut ? '' : 'none';
      if (ARMS) {
        // One arm hangs at his side; the other goes up and wags along with his head.
        set(part.armL, `rotate(14 ${SHOULDER.left.x} ${SHOULDER.left.y})`);
        set(part.armR, `rotate(${r3(-14 - pose.raise * (140 + 2.6 * pose.shake))} ${SHOULDER.right.x} ${SHOULDER.right.y})`);
      }
      return;
    }

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
    // Booping: he stretches forward, nose first.
    const beat = k * Math.cos(2 * TAU * pose.phase);   // +1 as a foot lands, -1 mid-step
    const sway = 5 * k * Math.sin(TAU * pose.phase);
    const wide = (1 + 0.035 * beat - 0.008 * breath) * (1 + 0.12 * pose.boop);
    const tall = (1 - 0.04 * beat + 0.012 * breath) * (1 - 0.06 * pose.boop);
    set(part.torso, `translate(${r3(BELLY.x + 5 * pose.boop)} ${BELLY.y}) rotate(${r3(pose.lean + sway)}) ` +
      `scale(${r3(wide)} ${r3(tall)}) translate(${-BELLY.x} ${-BELLY.y})`);

    // His arm swings against his near leg, and trails behind him when he boops.
    if (ARMS) {
      const swing = k * Math.cos(TAU * pose.phase);
      set(part.arm, `rotate(${r3(8 + 22 * swing + 50 * pose.boop)} ${SHOULDER.side.x} ${SHOULDER.side.y})`);
    }

    // He squeezes his eye shut in delight while booping.
    const delighted = pose.boop > 0.5;
    set(part.eye, about({ x: 0, y: SIDE_EYE.y }, `scale(1 ${lid})`));
    part.eye.style.display = delighted ? 'none' : '';
    part.happy.style.display = delighted ? '' : 'none';
  }

  // The value at time t (0 to 1) along a list of [time, value] stops.
  function along(stops, t) {
    for (let i = 1; i < stops.length; i++) {
      const [t0, v0] = stops[i - 1], [t1, v1] = stops[i];
      if (t <= t1) return v0 + (v1 - v0) * ((t - t0) / (t1 - t0));
    }
    return stops[stops.length - 1][1];
  }

  // Calls step(t) every frame with t running from 0 to 1 over `ms` milliseconds.
  // Every movement goes through this and plain element styles, which behave the
  // same in Chrome, Firefox and Safari.
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
  // He walks in, boops the button, the screen goes dark, he turns to face you and
  // shakes his head. `top` is how far down the screen he walks. `onDark` is called
  // once the screen is fully dark. The promise resolves when he has finished,
  // with the ways to end the show.
  async function perform({ top = 8, onDark } = {}) {
    // If the page was opened in a background tab, wait until someone is looking.
    await tabVisible();

    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const BTN = buttonAt(top);
    const STYLE = stylesFor(top, BTN);
    // A div named `name`, laid out by STYLE[name].
    const h = (name, ...kids) => css(node(null, 'div', { class: name }, kids), STYLE[name] || {});

    const svg = buildGuy();
    const squash = h('squash', svg);
    const guy = h('guy', h('shadow'), squash);
    const veil = h('veil'), ring = h('ring'), bubble = h('bubble', LINE);
    const x = h('x', css(s('svg', { viewBox: '0 0 24 24' },
      s('path', { d: 'M7.5 7.5l9 9m0-9l-9 9', stroke: '#fff', 'stroke-width': 3.2, 'stroke-linecap': 'round' })), STYLE.cross));
    const stage = h('stage', veil, ring, x, guy, bubble);

    const host = document.createElement('div');
    host.style.setProperty('all', 'initial', 'important');
    const root = host.attachShadow({ mode: 'closed' });
    root.append(stage);
    document.documentElement.append(host);

    const part = partsOf(svg);
    // He walks in from off the left edge and stops with his nose by the button,
    // wherever that is if the window changes size on the way.
    const pageWidth = () => document.documentElement.clientWidth || window.innerWidth;
    let stopX = Math.max(8, pageWidth() - BTN.right - BTN.size - REACH);
    window.addEventListener('resize', () => { stopX = Math.max(8, pageWidth() - BTN.right - BTN.size - REACH); });
    const startX = calm ? stopX : -SIZE - 4;
    let px = startX;
    const place = () => { guy.style.transform = `translate(${r3(px)}px, 0)`; };

    // One loop redraws him every frame; the steps below just change his pose.
    const pose = { phase: 0.25, amp: 0, lean: 0, boop: 0, front: false, shake: 0, shut: false, raise: 0 };
    let alive = true;
    requestAnimationFrame(function loop(now) {
      if (!alive) return;
      if (!host.isConnected) document.documentElement.append(host);
      draw(part, pose, now, calm);
      requestAnimationFrame(loop);
    });
    draw(part, pose, 0, true);
    place();

    if (calm) {
      await tween(200, (t) => { guy.style.opacity = t; });
    } else {
      guy.style.opacity = 1;
      // Toddle in from the left and all the way across the top to the button.
      await new Promise((arrived) => {
        let last;
        requestAnimationFrame(function step(now) {
          // Capped so he does not leap forward after the page has been out of sight.
          const dt = Math.min(250, now - (last ?? now));
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
    await sleep(calm ? 600 : 250);

    // Wind up, then boop the button with his nose. It squishes under him and a
    // ring pops out of it.
    if (calm) {
      pose.boop = 1;
      await sleep(400);
    } else {
      await tween(190, (t) => { pose.lean = -9 * ease(t); });
      await tween(100, (t) => { pose.lean = -9 + 15 * t; pose.boop = t; });
      tween(420, (t) => {
        const out = 1 - (1 - t) * (1 - t);
        ring.style.opacity = 0.9 * (1 - out);
        ring.style.transform = `scale(${r3(1 + 0.9 * out)})`;
      });
      await tween(300, (t) => {
        const push = along([[0, 0], [0.33, 5], [0.66, 0], [1, 0]], t);
        const size = along([[0, 1], [0.33, 0.72], [0.66, 1.08], [1, 1]], t);
        x.style.transform = `translateX(${r3(push)}px) scale(${r3(size)})`;
      });
    }

    // The screen goes dark, as if what was on it had shut, and the button pops away.
    const dark = tween(calm ? 1 : 280, (t) => { veil.style.opacity = t; });
    tween(calm ? 1 : 180, (t) => {
      x.style.transform = `scale(${r3(1 - t * t)})`;
      x.style.opacity = 1 - t;
    });
    if (calm) {
      pose.boop = 0;
    } else {
      await tween(220, (t) => { pose.boop = 1 - ease(t); pose.lean = 6 * (1 - ease(t)); });
    }
    await dark;
    if (onDark) await onDark();

    // He turns to face you, flipping round like a card.
    if (!calm) await tween(110, (t) => { squash.style.transform = `scaleX(${r3(1 - 0.9 * t * t)})`; });
    pose.front = true;
    draw(part, pose, performance.now(), calm);
    if (!calm) {
      await tween(170, (t) => {
        squash.style.transform = `scaleX(${r3(along([[0, 0.1], [0.7, 1.06], [1, 1]], 1 - (1 - t) * (1 - t)))})`;
      });
    }
    squash.style.transform = '';
    await sleep(calm ? 200 : 320);

    // And says it, shaking his head with his eyes shut and wagging a hand.
    tween(180, (t) => {
      bubble.style.opacity = t;
      bubble.style.transform = `translateY(${r3(6 * (1 - t))}px)`;
    });
    if (calm) {
      await sleep(1600);
    } else {
      pose.shut = true;
      await tween(1400, (t) => {
        pose.shake = SHAKE * Math.sin(TAU * 3 * t) * Math.sqrt(Math.sin(Math.PI * t));
        pose.raise = ease(Math.min(1, 7 * t, 7 * (1 - t)));
      });
      pose.shake = 0;
      pose.raise = 0;
      pose.shut = false;
      await sleep(450);
    }

    return {
      // Leave the screen covered with a message, for when whatever was meant to
      // close did not.
      cover(title, note) {
        alive = false;
        const card = h('card', h('', title, css(node(null, 'small', null, [note]), STYLE.small)));
        card.style.display = 'grid';
        stage.append(card);
      },
      // Fade him and the dark screen away, then clear up.
      async fadeOut() {
        await tween(calm ? 1 : 260, (t) => { stage.style.opacity = 1 - t; });
        alive = false;
        host.remove();
      }
    };
  }

  return { perform };
})();
