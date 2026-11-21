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
    const PILL = { border: 'none', borderRadius: '999px', padding: '9px 15px', margin: '0', cursor: 'pointer',
      font: '700 14px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif', pointerEvents: 'auto' };
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
      small: { display: 'block', marginTop: '8px', fontWeight: '400', fontSize: '14px', opacity: '.7' },

      // The dance deal: what he offers, the buttons, what he says while dancing, and how far there is to go.
      deal: { position: 'absolute', top: `${top + 8}px`, right: `${BTN.right + BTN.size + REACH + 2}px`, boxSizing: 'border-box',
        width: 'max-content', maxWidth: `calc(100% - ${BTN.right + BTN.size + REACH + 14}px)`, padding: '11px 14px',
        borderRadius: '14px 14px 4px 14px', background: '#fff', color: '#1c1917', fontSize: '15px', opacity: '0',
        boxShadow: '0 6px 20px rgba(0,0,0,.3)', pointerEvents: 'auto' },
      choices: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' },
      yes: { ...PILL, background: '#2dd4bf', color: '#06302c' },
      no: { ...PILL, background: '#eceeed', color: '#1c1917' },
      say: { position: 'absolute', left: '50%', top: '0', transform: 'translateX(-50%)', boxSizing: 'border-box',
        width: 'max-content', maxWidth: 'calc(100% - 32px)', padding: '10px 15px', borderRadius: '16px', background: '#fff',
        color: '#1c1917', fontSize: '17px', textAlign: 'center', opacity: '0', boxShadow: '0 6px 20px rgba(0,0,0,.3)' },
      title: { position: 'absolute', left: '16px', right: '16px', top: '14%', textAlign: 'center', color: '#fff',
        fontSize: '30px', fontWeight: '800', lineHeight: '1.15', opacity: '0' },
      tally: { position: 'absolute', left: '16px', right: '16px', top: 'calc(14% + 46px)', textAlign: 'center',
        color: '#99f6e4', fontSize: '16px', fontWeight: '700', opacity: '0' },
      meter: { position: 'absolute', left: '12%', right: '12%', bottom: '11%', height: '8px', borderRadius: '4px',
        background: 'rgba(255,255,255,.16)', overflow: 'hidden', opacity: '0' },
      fill: { height: '100%', width: '0%', borderRadius: '4px', background: '#2dd4bf' },
      left: { position: 'absolute', left: '16px', right: '16px', bottom: 'calc(11% - 28px)', textAlign: 'center',
        color: 'rgba(255,255,255,.72)', fontSize: '13px', opacity: '0' },
      stop: { ...PILL, position: 'absolute', top: `${top}px`, left: '16px', padding: '7px 13px', fontSize: '13px',
        background: 'rgba(255,255,255,.14)', color: '#fff', opacity: '0' },
      go: { ...ON_BUTTON, background: '#22c55e', border: '2.5px solid #fff', boxShadow: '0 3px 12px rgba(0,0,0,.35)',
        display: 'grid', placeItems: 'center', opacity: '0' },
      goRing: { ...ON_BUTTON, border: '3px solid #86efac', opacity: '0' }
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
  const FRONT_HIPS = { left: BELLY.x - 8.5, right: BELLY.x + 8.5, y: 64 };

  const body = () => [
    s('ellipse', { cx: 46, cy: 50, rx: 33, ry: 31.5, fill: `url(#sb-body) ${COLOR.body}` }),
    s('ellipse', { cx: 33, cy: 35, rx: 11, ry: 6.5, transform: 'rotate(-32 33 35)', fill: '#fff', opacity: 0.2 })
  ];
  // An eye: a white with a dark pupil. `look` nudges the pupil sideways.
  const eye = (cx, cy, look) => [
    s('ellipse', { class: 'white', cx, cy, rx: 4.7, ry: 6.7, fill: '#fff' }),
    s('ellipse', { class: 'pupil', cx: cx + look, cy, rx: 2.7, ry: 4.6, fill: COLOR.ink })
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
    const leg = (cls, hip) => s('g', { class: cls },
      s('rect', { x: hip - 5.5, y: 62, width: 11, height: 30, rx: 5.5, fill: COLOR.leg }),
      s('rect', { x: hip - 7.5, y: 87, width: 15, height: 9.4, rx: 4.7, fill: COLOR.foot }));

    return s('g', { class: 'front' },
      leg('front-leg-l', FRONT_HIPS.left), leg('front-leg-r', FRONT_HIPS.right),
      s('g', { class: 'front-torso' },
        ...(ARMS ? [arm('arm-l', SHOULDER.left), arm('arm-r', SHOULDER.right)] : []),
        ...body(),
        s('g', { class: 'face' },
          s('g', { class: 'front-eyes' }, ...eye(left, y, 0), ...eye(right, y, 0)),
          // Both eyes shut, for shaking his head.
          stroke('shut', `M${left - 4.2} ${y + 0.4}q4.2 3.6 8.4 0M${right - 4.2} ${y + 0.4}q4.2 3.6 8.4 0`, COLOR.ink, 2.2),
          // Eyes screwed up with joy, for dancing.
          stroke('joy', `M${left - 4.2} ${y + 1.8}q4.2 -5.2 8.4 0M${right - 4.2} ${y + 1.8}q4.2 -5.2 8.4 0`, COLOR.ink, 2.2),
          ...(GLASSES ? [
            lens(left, y), lens(right, y),
            stroke('', `M${left + 8.2} ${y - 0.6}q${gap / 2} -1.8 ${gap} 0`, COLOR.frames, 1.7),
            stroke('', `M${left - 8.2} ${y - 0.6}L14.5 ${y - 3}M${right + 8.2} ${y - 0.6}L77.5 ${y - 3}`, COLOR.frames, 1.7)
          ] : []),
          // His mouth: a little smile, or a firm flat line while he shakes his head.
          stroke('smile', 'M40.6 66.2Q46 71.2 51.4 66.2', COLOR.ink, 2),
          stroke('flat', 'M42 67.8H50', COLOR.ink, 2),
          // A big open grin, for dancing.
          s('g', { class: 'grin' },
            s('path', { d: 'M39.6 64.8Q46 74.6 52.4 64.8Z', fill: COLOR.ink }),
            s('ellipse', { cx: 46, cy: 68.3, rx: 3.2, ry: 1.4, fill: '#f28da0' })),
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
      joy: find('joy'), grin: find('grin'), legL: find('front-leg-l'), legR: find('front-leg-r'),
      whites: svg.querySelectorAll('.white'), pupils: svg.querySelectorAll('.front-eyes .pupil')
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
      // Or, when pose.dance is set, dancing: it says where his arms, legs, eyes and mouth go.
      const d = pose.dance;
      set(part.front, d ? `translate(0 ${r3(-d.hop)})` : '');
      set(part.frontTorso, about(BELLY, `rotate(${r3(d ? d.tilt : 0.35 * pose.shake)}) ` +
        `scale(${r3(1 - 0.008 * breath)} ${r3(1 + 0.012 * breath)})`));
      set(part.face, `translate(${r3(pose.shake)} 0)`);
      set(part.frontEyes, about({ x: 0, y: FRONT_EYES.y }, `scale(1 ${lid})`));
      const eyes = d ? d.eyes : pose.shut ? 'shut' : 'open';
      const mouth = d ? d.mouth : pose.shut ? 'flat' : 'smile';
      part.frontEyes.style.display = eyes === 'open' ? '' : 'none';
      part.shut.style.display = eyes === 'shut' ? '' : 'none';
      part.joy.style.display = eyes === 'joy' ? '' : 'none';
      part.smile.style.display = mouth === 'smile' ? '' : 'none';
      part.flat.style.display = mouth === 'flat' ? '' : 'none';
      part.grin.style.display = mouth === 'grin' ? '' : 'none';
      for (const pupil of part.pupils) set(pupil, `translate(${r3(d ? d.look : 0)} 0)`);
      set(part.legL, d ? `translate(0 ${r3(-d.liftL)}) rotate(${r3(d.legL)} ${FRONT_HIPS.left} ${FRONT_HIPS.y})` : '');
      set(part.legR, d ? `translate(0 ${r3(-d.liftR)}) rotate(${r3(d.legR)} ${FRONT_HIPS.right} ${FRONT_HIPS.y})` : '');
      if (ARMS) {
        // One arm hangs at his side; the other goes up and wags along with his head.
        set(part.armL, `rotate(${d ? r3(d.armL) : 14} ${SHOULDER.left.x} ${SHOULDER.left.y})`);
        set(part.armR, `rotate(${r3(d ? d.armR : -14 - pose.raise * (140 + 2.6 * pose.shake))} ${SHOULDER.right.x} ${SHOULDER.right.y})`);
        // For dancing his arms stretch out longer, cartoon fashion, so the moves show.
        const reach = d ? d.reach : 1;
        if (part.reach !== reach) {
          part.reach = reach;
          for (const [arm, at] of [[part.armL, SHOULDER.left], [part.armR, SHOULDER.right]]) {
            arm.firstChild.setAttribute('height', r3(19 + 15.5 * (reach - 1)));
            arm.lastChild.setAttribute('cy', r3(at.y + 15.5 * reach));
          }
        }
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
  async function perform({ top = 8, onDark, line = LINE } = {}) {
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
    const veil = h('veil'), ring = h('ring'), bubble = h('bubble', line);
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
    const pose = { phase: 0.25, amp: 0, lean: 0, boop: 0, front: false, shake: 0, shut: false, raise: 0, dance: null };
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
      // Offer a deal: dance with him for a minute and he lets them in. See dance() below.
      offerDance(options) {
        return dance({ stage, guy, squash, veil, bubble, pose, part, STYLE, BTN, top, h, calm, home: px }, options);
      },
      // Fade him and the dark screen away, then clear up.
      async fadeOut() {
        await tween(calm ? 1 : 260, (t) => { stage.style.opacity = 1 - t; });
        alive = false;
        host.remove();
      }
    };
  }


  // ---- The dance deal --------------------------------------------------------
  // Now and then, after "Nope not now", he offers a way in: dance with him for a
  // minute. The music (dance.ogg, made by mr-blocky-music/make-dance-music.py) is
  // 120 beats a minute, and its sections line up with these moves, so change them together.
  const DANCE = {
    bpm: 120,
    moves: [
      { until: 4, move: 'ready', say: 'Get ready!' },
      { until: 12, move: 'side', say: 'Side to side!' },
      { until: 20, move: 'disco', say: 'Disco point!' },
      { until: 36, move: 'jumps', say: 'Star jumps!' },
      { until: 48, move: 'march', say: 'March on the spot!' },
      { until: 58, move: 'wiggle', say: 'Arms up and wiggle!' },
      { until: 62, move: 'spin', say: 'Spin around!' },
      { until: 64, move: 'crouch', say: 'Get ready to jump…' },
      { until: 67, move: 'tada', say: 'Ta-da!' }
    ]
  };
  DANCE.length = DANCE.moves[DANCE.moves.length - 1].until;
  // x is a step to the side, sx and sy squash and stretch him, and reach is how long
  // his arms are: they stretch out for dancing, so the moves can be seen.
  const STANDING = { tilt: 0, hop: 0, x: 0, sx: 1, sy: 1, reach: 1, armL: 14, armR: -14, legL: 0, legR: 0,
    liftL: 0, liftR: 0, eyes: 'open', mouth: 'smile', look: 0 };
  const STRETCH = 1.8;
  const clamp01 = (t) => Math.max(0, Math.min(1, t));

  // His pose t seconds into the song, which move that is, and how much to spin or crouch him.
  function danceAt(t, calm) {
    const b = (t * DANCE.bpm) / 60;          // beats since the music started
    const n = Math.floor(b), f = b - n;      // which beat, and how far through it
    const k = calm ? 0.4 : 1;                // smaller moves for people who prefer less motion
    const i = DANCE.moves.findIndex((m) => t < m.until);
    const at = i === -1 ? DANCE.moves.length - 1 : i;
    const step = DANCE.moves[at], since = t - (at === 0 ? 0 : DANCE.moves[at - 1].until);
    const p = { ...STANDING, eyes: 'joy', mouth: 'grin', reach: STRETCH };
    // A bounce on every beat: squashed as he lands on the beat, stretched in the air between.
    const bounce = (height, give = 0.07) => {
      const land = Math.cos(TAU * f);
      p.hop = height * k * Math.sin(Math.PI * f);
      p.sy = 1 - give * k * land;
      p.sx = 1 + 0.75 * give * k * land;
    };
    let spin = 1, crouch = 1;
    switch (step.move) {
      case 'ready': {  // bobbing to the count-in, stretching his arms out ready
        bounce(3, 0.03);
        Object.assign(p, { eyes: 'open', mouth: 'smile', reach: 1 + (STRETCH - 1) * ease(clamp01(t / 2.5)) });
        const swing = 12 * k * Math.sin(Math.PI * b);
        p.armL = 14 + swing;
        p.armR = -14 + swing;
        break;
      }
      case 'side': {   // stepping from side to side, arms swinging after him
        const sway = Math.sin((Math.PI * b) / 2);   // over and back every four beats
        bounce(6);
        p.x = 18 * k * sway;
        p.tilt = 8 * k * Math.cos((Math.PI * b) / 2);
        const swing = -50 * k * Math.sin((Math.PI * b) / 2 - 0.6);
        p.armL = 22 + swing;
        p.armR = -22 + swing;
        p.legL = p.legR = 7 * k * sway;
        p[n % 2 ? 'liftL' : 'liftR'] = 6 * k * Math.sin(Math.PI * f);
        p.look = 2 * sway;
        break;
      }
      case 'disco': {  // one hand points up to the sky and down to the floor, then the other
        const side = Math.floor(b / 4) % 2 === 0 ? 1 : -1;     // +1 his right hand, -1 his left
        const u = Math.cos(Math.PI * b), up = Math.sign(u) * Math.sqrt(Math.abs(u));   // +1 up, -1 down
        const point = 95 + 62 * up;
        bounce(5);
        p.armR = side > 0 ? -point : -30;
        p.armL = side > 0 ? 30 : point;
        p.x = 7 * k * side * up;
        p.tilt = -7 * k * side * up;
        p[side > 0 ? 'legR' : 'legL'] = -side * 12 * k * Math.max(0, up);
        p.look = 2.4 * side * Math.max(0, up);
        break;
      }
      case 'jumps': {  // out on one beat and back in on the next: a star jump a second
        const e = ease(clamp01(f / 0.6)), spread = n % 2 === 0 ? e : 1 - e;
        bounce(22, 0.09);
        p.armL = 14 + 140 * spread;
        p.armR = -14 - 140 * spread;
        p.legL = 26 * spread;
        p.legR = -26 * spread;
        break;
      }
      case 'march': {  // knees up high in turn, the other arm pumping
        const lift = Math.sin(Math.PI * f), left = n % 2 === 0;
        bounce(4, 0.05);
        p.liftL = left ? 18 * k * lift : 0;
        p.liftR = left ? 0 : 18 * k * lift;
        p.armL = 14 + (left ? 8 : 90 * k * lift);
        p.armR = -14 - (left ? 90 * k * lift : 8);
        p.tilt = (left ? 4 : -4) * k * lift;
        break;
      }
      case 'wiggle': { // arms right up, waving together, and a shimmy
        const w = Math.sin(Math.PI * b);
        bounce(3, 0.04);
        p.reach = STRETCH + 0.25;
        p.armL = 162 + 22 * w;
        p.armR = -162 + 22 * w;
        p.x = 4 * k * Math.sin(4 * Math.PI * b);
        p.tilt = 11 * k * w;
        p.look = 2 * w;
        break;
      }
      case 'spin':     // two spins, arms out
        if (!calm) spin = Math.cos(Math.PI * since);
        bounce(5);
        p.armL = 108;
        p.armR = -108;
        break;
      case 'crouch':   // down low, trembling, ready to spring
        crouch = 1 - 0.14 * ease(clamp01(since / 0.4));
        p.armL = 34;
        p.armR = -34;
        p.tilt = 1.2 * k * Math.sin(t * 40);
        p.eyes = 'shut';
        p.mouth = 'smile';
        break;
      default:         // ta-da!
        p.hop = since < 0.5 ? 30 * k * Math.sin((Math.PI * since) / 0.5) : 0;
        if (since < 0.5) { p.sy = 1 + 0.08 * k; p.sx = 1 - 0.05 * k; }
        p.armL = 150;
        p.armR = -150;
        p.legL = 14;
        p.legR = -14;
    }
    return { pose: p, step, spin, crouch };
  }

  // Coloured lights for the dance: beams from the top sweeping across the dark, and a
  // glow on the floor under him, all flashing on the beat. Still, and dimmer, for
  // people who prefer less motion.
  const LIGHTS = ['#f472b6', '#fbbf24', '#a78bfa', '#38bdf8'];
  function partyLights(feet, width) {
    const beams = LIGHTS.map((color, i) => css(node(null, 'div', null, []), {
      position: 'absolute', top: '-8%', left: `${3 + i * 24}%`, width: '22%', height: '120%', transformOrigin: '50% 0%',
      background: `linear-gradient(to bottom, ${color}, transparent 78%)`,
      clipPath: 'polygon(44% 0, 56% 0, 100% 100%, 0 100%)', opacity: '0.2'
    }));
    const glow = css(node(null, 'div', null, []), {
      position: 'absolute', left: '50%', top: `${feet}px`, width: `${Math.min(width * 0.95, 420)}px`, height: '90px',
      transform: 'translate(-50%, -50%)', borderRadius: '50%', opacity: '0.5'
    });
    const el = css(node(null, 'div', null, [...beams, glow]), { ...FILL, pointerEvents: 'none', opacity: '0' });
    let shown = -1;
    return {
      el,
      at(t, calm) {
        const b = (t * DANCE.bpm) / 60, n = Math.floor(b), flash = (1 - (b - n)) ** 2;
        beams.forEach((beam, i) => {
          const angle = calm ? 14 * (i - 1.5) : 26 * Math.sin((Math.PI * t) / 2 + i * 1.7);
          beam.style.transform = `rotate(${r3(angle)}deg)`;
          beam.style.opacity = calm ? '0.16' : `${r3(0.13 + 0.2 * flash)}`;
        });
        if (n !== shown) {
          shown = n;
          const color = LIGHTS[(calm ? Math.floor(n / 8) : n) % LIGHTS.length];
          glow.style.background = `radial-gradient(closest-side, ${color}, transparent)`;
        }
        glow.style.opacity = calm ? '0.4' : `${r3(0.3 + 0.35 * flash)}`;
      }
    };
  }

  // Starts fetching the music. Pages loaded from files cannot fetch, but an <audio>
  // element can still play the file, so that is the fallback.
  function loadMusic(url) {
    if (!url) return Promise.resolve(null);
    return fetch(url)
      .then((res) => { if (!res.ok) throw new Error(res.status); return res.arrayBuffer(); })
      .then((bytes) => ({ bytes }))
      .catch(() => ({ url }));
  }

  // Plays the music, and keeps the time the dance follows. Call it during the tap on
  // "Let's dance!", which is what lets the browser play sound. Without music, or if it
  // cannot play, the dance follows the clock instead.
  function startSong(loading) {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    let context = null, source = null, element = null, began = null, clockStart = null, locked = false, over = false;
    let heard = null;   // the music's own time when it last moved on, and when that was
    let quiet = false, awake = null;
    try {
      context = Context ? new Context() : null;
      if (context) context.resume().catch(() => {});
    } catch { context = null; }
    // They will be dancing, not touching anything: stop the screen going to sleep meanwhile.
    try {
      navigator.wakeLock.request('screen').then((lock) => {
        if (over) lock.release().catch(() => {}); else awake = lock;
      }, () => {});
    } catch { /* no way to keep the screen on here */ }
    const silence = () => {
      if (quiet) return;
      quiet = true;
      try { if (source) source.stop(); } catch { /* never started */ }
      try { if (element) element.pause(); } catch { /* never started */ }
      if (context) context.close().catch(() => {});
    };
    const stop = () => {
      if (over) return;
      over = true;
      silence();
      if (awake) awake.release().catch(() => {});
    };
    const started = loading.then(async (loaded) => {
      if (!loaded || locked) return false;
      if (loaded.bytes && context) {
        const buffer = await context.decodeAudioData(loaded.bytes);
        if (locked) return false;
        source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.start();
        began = context.currentTime;
        return true;
      }
      element = new Audio(loaded.url);
      await element.play();
      if (locked) { element.pause(); return false; }
      began = 0;
      return true;
    }).catch(() => false);
    return {
      // Waits up to `ms` for the music to start, then commits to it or to the clock.
      async begin(ms) {
        const playing = await Promise.race([started, sleep(ms).then(() => false)]);
        locked = true;
        if (!playing) { silence(); began = null; clockStart = performance.now(); }
        return playing;
      },
      // Seconds since the music started.
      now() {
        if (began !== null && (source || element)) {
          const music = source ? context.currentTime - began : element.currentTime;
          const wall = performance.now();
          if (!heard || music !== heard.music) {
            heard = { music, wall };
          } else if (wall - heard.wall > 1500) {
            // The music has stopped moving on: the device has nowhere to play it, or a
            // call has taken the sound. Rather than freeze mid-dance, carry on by the
            // clock from here, in silence.
            silence();
            began = null;
            clockStart = wall - music * 1000;
          }
          return music;
        }
        return (performance.now() - (clockStart ?? performance.now())) / 1000;
      },
      stop
    };
  }

  // The deal, from "Nope not now" onwards. Resolves with 'danced' if they dance to the
  // end and he boops the way back in, or 'declined' or 'stopped' if not.
  //   music:     address of dance.ogg, or nothing to dance in silence
  //   counter:   on a phone, counts star jumps with its motion sensor:
  //              { need, hint, start(onJump), stop() }
  //   onDancing: called when they say yes
  //   onLetIn:   called as he boops the way back in
  async function dance(rig, { music, counter, onDancing, onLetIn } = {}) {
    const { stage, guy, squash, veil, bubble, pose, STYLE, BTN, top, h, calm } = rig;
    const fadeIn = (el, ms = 200) => tween(ms, (t) => { el.style.opacity = t; });
    const fadeOut = (el, ms = 200) => tween(ms, (t) => { el.style.opacity = 1 - t; });
    const button = (name, label) => css(node(null, 'button', { type: 'button' }, [label]), STYLE[name]);
    const keys = (handler) => {
      document.addEventListener('keydown', handler, true);
      return () => document.removeEventListener('keydown', handler, true);
    };
    // From here on the dark screen catches taps, so nothing underneath gets them.
    veil.style.pointerEvents = 'auto';

    // A moment's silence. He glances away... and back, an idea forming.
    await fadeOut(bubble, 250);
    pose.dance = { ...STANDING };
    await sleep(900);
    pose.dance.look = -2.4;
    await sleep(650);
    pose.dance.look = 2.4;
    await sleep(450);
    pose.dance = { ...STANDING };

    const loading = loadMusic(music);
    const words = node(null, 'span', null, ['…unless…']);
    const deal = h('deal', words);
    stage.append(deal);
    await fadeIn(deal, 180);
    await sleep(1300);
    words.textContent = '…you want to dance with me?';
    const yes = button('yes', "Let's dance! 💃"), no = button('no', 'No thanks');
    deal.append(h('choices', yes, no));
    try { yes.focus({ preventScroll: true }); } catch { /* not focusable here */ }

    // He bounces on the spot, hopeful, while they decide.
    let waiting = true;
    requestAnimationFrame(function hope(now) {
      if (!waiting) return;
      pose.dance.hop = 2.2 * Math.abs(Math.sin(now / 190));
      requestAnimationFrame(hope);
    });
    let song = null;
    const answer = await new Promise((decide) => {
      const timer = setTimeout(() => finish('declined'), 20000);
      const unkey = keys((e) => { if (e.key === 'Escape') finish('declined'); });
      function finish(choice) {
        clearTimeout(timer);
        unkey();
        decide(choice);
      }
      yes.addEventListener('click', () => { song = startSong(loading); finish('yes'); });
      no.addEventListener('click', () => finish('declined'));
    });
    waiting = false;
    deal.lastChild.remove();

    // A shrug, a parting word, and back to closing.
    const shrug = async (line) => {
      words.textContent = line;
      if (!deal.isConnected) stage.append(deal);
      deal.style.opacity = '1';
      pose.dance = { ...STANDING, armL: 62, armR: -62, look: -2, mouth: 'flat', tilt: -3 };
      await sleep(1500);
      await fadeOut(deal);
    };
    if (answer !== 'yes') {
      await shrug('Suit yourself!');
      return 'declined';
    }
    if (onDancing) onDancing();
    await fadeOut(deal, 150);
    deal.remove();

    // Into the middle of the screen, and bigger, so they can follow him.
    const width = stage.clientWidth || innerWidth, height = stage.clientHeight || innerHeight;
    const big = Math.max(1, Math.min(3.2, (height * 0.36) / SIZE, (width * 0.62) / SIZE));
    const feet = height * 0.66;
    const spot = { x: rig.home, y: 0, k: 1 };
    const centre = { x: (width - SIZE) / 2, y: feet - top - SIZE, k: big };
    const put = (a, b, t, arc = 0) => {
      const e = ease(t);
      guy.style.transform = `translate(${r3(a.x + (b.x - a.x) * e)}px, ${r3(a.y + (b.y - a.y) * e - arc * Math.sin(Math.PI * t))}px) ` +
        `scale(${r3(a.k + (b.k - a.k) * e)})`;
    };
    guy.style.transformOrigin = '50% 100%';
    pose.dance = { ...STANDING, eyes: 'joy', mouth: 'grin' };
    await tween(calm ? 1 : 650, (t) => put(spot, centre, t, 60));

    const title = h('title'), tally = h('tally'), fill = h('fill'), meter = h('meter', fill), left = h('left');
    const stop = button('stop', '✕  Stop');
    stage.append(title, tally, meter, left, stop);
    title.textContent = DANCE.moves[0].say;
    for (const el of [title, meter, left, stop]) fadeIn(el);
    let stopped = false;
    stop.addEventListener('click', () => { stopped = true; });
    const unkey = keys((e) => { if (e.key === 'Escape') stopped = true; });

    // He steps from side to side by moving the whole of him, shadow and all.
    const unit = (SIZE / 100) * big;
    const stand = (x) => { guy.style.transform = `translate(${r3(centre.x + x * unit)}px, ${r3(centre.y)}px) scale(${r3(big)})`; };
    const shadow = guy.firstChild;
    const lights = partyLights(feet, width);
    stage.insertBefore(lights.el, guy);

    await song.begin(2500);
    fadeIn(lights.el, 400);
    let jumps = 0, counting = false;
    const tick = () => {
      tally.textContent = jumps >= counter.need ? `${jumps} star jumps ✓` : `${counter.hint}  ${jumps} / ${counter.need}`;
    };
    const result = await new Promise((finish) => {
      let shown = null;
      requestAnimationFrame(function frame() {
        if (stopped) return finish('stopped');
        const t = song.now();
        if (t >= DANCE.length) return finish('done');
        const { pose: p, step, spin, crouch } = danceAt(t, calm);
        pose.dance = p;
        stand(p.x);
        squash.style.transform = `scale(${r3(spin * p.sx)}, ${r3(crouch * p.sy)})`;
        shadow.style.transform = `scale(${r3(Math.max(0.55, 1 - p.hop / 60))})`;
        lights.at(t, calm);
        if (step !== shown) {
          shown = step;
          title.textContent = step.say;
          if (counter && step.move === 'jumps') {
            counting = true;
            counter.start(() => { jumps += 1; tick(); });
            tick();
            tally.style.opacity = '1';
          } else if (counting) {
            counting = false;
            counter.stop();
          }
        }
        fill.style.width = `${((100 * t) / DANCE.length).toFixed(1)}%`;
        left.textContent = `${Math.max(0, Math.ceil(DANCE.length - t))} seconds to go`;
        requestAnimationFrame(frame);
      });
    });
    unkey();
    if (counting) counter.stop();
    for (const el of [title, tally, meter, left, stop, lights.el]) fadeOut(el, 300).then(() => el.remove());
    // Back down to earth: feet on the floor in the middle, and his arms their usual length.
    const last = pose.dance;
    squash.style.transform = '';
    shadow.style.transform = '';
    await tween(calm ? 1 : 260, (u) => {
      const e = ease(u);
      pose.dance = { ...last, x: 0, hop: last.hop * (1 - e), reach: last.reach + (1 - last.reach) * e };
      stand(last.x * (1 - e));
    });

    // Something to say, in a bubble just above his head.
    const say = h('say');
    const speak = async (line, ms) => {
      say.textContent = line;
      say.style.top = `${Math.max(top, feet - big * SIZE - 54)}px`;
      if (!say.isConnected) stage.append(say);
      await fadeIn(say, 150);
      await sleep(ms);
    };
    if (result === 'stopped' || (counter && jumps < counter.need)) {
      song.stop();
      pose.dance = { ...STANDING, armL: 62, armR: -62, look: -2, mouth: 'flat', tilt: -3 };
      await speak(result === 'stopped' ? 'Maybe next time!' : `Nice moves, but I needed ${counter.need} star jumps!`, 1800);
      await fadeOut(say);
      return 'stopped';
    }

    // They did it.
    pose.dance = { ...STANDING, eyes: 'joy', mouth: 'grin', armL: 120, armR: -14 };
    await speak('OK, you did good!', 1600);
    await fadeOut(say, 150);
    say.remove();

    // Back to his spot, where a green button has appeared. He turns side on and boops it.
    pose.dance = { ...STANDING, mouth: 'grin' };
    await tween(calm ? 1 : 600, (t) => put(centre, spot, t, 40));
    guy.style.transform = `translate(${r3(rig.home)}px, 0)`;
    const go = h('go', css(s('svg', { viewBox: '0 0 24 24' },
      s('path', { d: 'M5.5 12h12M12.5 6.5l5.5 5.5-5.5 5.5', stroke: '#fff', 'stroke-width': 3.2, 'stroke-linecap': 'round',
        'stroke-linejoin': 'round', fill: 'none' })), STYLE.cross));
    const ring = h('goRing');
    stage.append(ring, go);
    await tween(calm ? 1 : 260, (t) => {
      go.style.opacity = Math.min(1, 3 * t);
      go.style.transform = `scale(${r3(along([[0, 0.4], [0.7, 1.12], [1, 1]], t))})`;
    });
    if (!calm) await tween(110, (t) => { squash.style.transform = `scaleX(${r3(1 - 0.9 * t * t)})`; });
    pose.dance = null;
    pose.front = false;
    pose.amp = 0;
    pose.boop = 0;
    pose.lean = 0;
    if (!calm) {
      await tween(170, (t) => {
        squash.style.transform = `scaleX(${r3(along([[0, 0.1], [0.7, 1.06], [1, 1]], 1 - (1 - t) * (1 - t)))})`;
      });
    }
    squash.style.transform = '';
    await sleep(calm ? 200 : 250);
    if (!calm) {
      await tween(190, (t) => { pose.lean = -9 * ease(t); });
      await tween(100, (t) => { pose.lean = -9 + 15 * t; pose.boop = t; });
    } else {
      pose.boop = 1;
    }
    if (onLetIn) onLetIn();
    tween(420, (t) => {
      const out = 1 - (1 - t) * (1 - t);
      ring.style.opacity = 0.9 * (1 - out);
      ring.style.transform = `scale(${r3(1 + 0.9 * out)})`;
    });
    await tween(calm ? 1 : 300, (t) => {
      go.style.transform = `translateX(${r3(along([[0, 0], [0.33, 5], [0.66, 0], [1, 0]], t))}px) ` +
        `scale(${r3(along([[0, 1], [0.33, 0.72], [0.66, 1.08], [1, 1]], t))})`;
    });
    // The lights come back on.
    tween(calm ? 1 : 220, (t) => { pose.boop = 1 - ease(t); pose.lean = 6 * (1 - ease(t)); });
    await tween(calm ? 1 : 450, (t) => {
      veil.style.opacity = 1 - t;
      go.style.opacity = 1 - t;
    });
    veil.style.pointerEvents = 'none';
    song.stop();
    return 'danced';
  }

  return { perform };
})();
