#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   make-art.mjs — draws the four zoom levels into /images as SVG.

       node tools/make-art.mjs

   The valley is knitted. Hills are chunky wool mounds, trees are french knots
   and bobbles, leaves are embroidered on in gold thread, and the river is the
   one cool thing in a warm world. Everything is seeded, so a rerun gives you
   the same valley back; change the seed at the top of a level to reshuffle it.

   All four levels frame the same place at increasing closeness: the river
   keeps its course, the terrace keeps its slope, and the Keymaker's workshop
   stays on the near bank. Level four walks in through its door.

   Coordinates here are SVG pixels (y down). The map speaks in world
   coordinates (y up from the bottom), so a place at world [y, x] is drawn at
   (x, 1000 - y). Pins are placed on real features: the named houses have
   their windows exactly under their pins, and so does the workshop.
   --------------------------------------------------------------------------- */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const W = 1778;
const H = 1000;
const IMAGES = join(dirname(fileURLToPath(import.meta.url)), '..', 'images');

/* --- randomness you can reproduce ----------------------------------------- */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rnd = mulberry32(1);
const R = (a, b) => a + rnd() * (b - a);
const n = (v, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp;
const pick = (list) => list[Math.floor(rnd() * list.length)];
const chance = (p) => rnd() < p;

/* --- the wool ------------------------------------------------------------- */

const C = {
  skyTop: '#0d1020',
  skyMid: '#1a1f38',
  skyLow: '#3a3050',
  skyWarm: '#7a4a44',
  water: '#33556e',
  waterDeep: '#1d3a52',
  waterLight: '#8fb2c4',
  wall: '#d9bd8f',
  wallWarm: '#e2c795',
  wallCool: '#bda37c',
  slate: '#39405c',
  slateWarm: '#5b4256',
  roofRust: '#8c4526',
  timber: '#573a26',
  timberDark: '#312115',
  lit: '#ffbe55',
  litCore: '#ffeec4',
  dark: '#1f2740',
  gold: '#ffb43f',
  cream: '#f0dcae',
  track: '#a98a5c',
  shadow: '#0c0a12',
};

// Wool the hills are knitted from, roughly back (cold) to front (warm).
const WOOL = {
  far: ['#232a44', '#2a3050', '#2d3a52', '#343a5c'],
  mid: ['#3a3255', '#463451', '#2f4a3e', '#3c4a5e', '#4a3a4e'],
  near: ['#8c4526', '#a1522c', '#b06a34', '#b8863c', '#2f4a38', '#3f5a3f', '#5a3a4a'],
  fore: ['#7a3a20', '#96491f', '#b07338', '#26402f', '#2b3350'],
};

/* --- paths ---------------------------------------------------------------- */

// Catmull-Rom through the points, so every edge comes out soft like felt.
function smooth(pts, closed = false) {
  const p = pts;
  const len = p.length;
  let d = `M${n(p[0][0])} ${n(p[0][1])}`;
  const last = closed ? len : len - 1;
  for (let i = 0; i < last; i++) {
    const p1 = p[i];
    const p2 = p[(i + 1) % len];
    const p0 = closed ? p[(i - 1 + len) % len] : p[Math.max(0, i - 1)];
    const p3 = closed ? p[(i + 2) % len] : p[Math.min(len - 1, i + 2)];
    d += ` C${n(p1[0] + (p2[0] - p0[0]) / 6)} ${n(p1[1] + (p2[1] - p0[1]) / 6)}`;
    d += ` ${n(p2[0] - (p3[0] - p1[0]) / 6)} ${n(p2[1] - (p3[1] - p1[1]) / 6)}`;
    d += ` ${n(p2[0])} ${n(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}

// Straight edges with a hand-cut wobble — for boards, benches and walls,
// which smooth() would otherwise round into lozenges.
function poly(pts, jitter = 2) {
  return pts.map(([x, y], i) =>
    `${i ? 'L' : 'M'}${n(x + R(-jitter, jitter))} ${n(y + R(-jitter, jitter))}`).join('') + 'Z';
}

function ridge(y, x0, x1, amp, steps = 10) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    pts.push([x0 + ((x1 - x0) * i) / steps, y + R(-amp, amp)]);
  }
  return pts;
}

function lump(cx, cy, rx, ry, wobble = 0.1, steps = 11) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const k = 1 + R(-wobble, wobble);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return smooth(pts, true);
}

/* --- the river ------------------------------------------------------------ */

// Mirrors RIVER_PATH in src/world.js (world [y, x] -> svg [x, 1000 - y]),
// run past both edges so the water never stops at the frame.
const RIVER = [
  [2020, 812], [1820, 742], [1620, 706], [1440, 624], [1300, 556],
  [1180, 528], [1040, 546], [900, 500], [770, 452], [640, 486],
  [500, 512], [360, 470], [200, 436], [40, 462], [-160, 430],
];

function riverY(x) {
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [x0, y0] = RIVER[i];
    const [x1, y1] = RIVER[i + 1];
    if (x <= x0 && x >= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return x > RIVER[0][0] ? RIVER[0][1] : RIVER[RIVER.length - 1][1];
}

// The river widens as it comes downstream (right to left, towards you).
let taper = (x) => 0.72 + 0.5 * (1 - Math.min(1, Math.max(0, x / 1800)));
const widthAt = (x, half) => half * taper(x);

function riverEdge(half, side) {
  return RIVER.map(([x, y]) => [x, y + side * widthAt(x, half) + R(-half * 0.06, half * 0.06)]);
}

/* --- fabric --------------------------------------------------------------- */

// Stockinette: rows of V-stitches, offset row to row. Three tilts, so no two
// hills lie in exactly the same direction.
function knitDefs(t) {
  const tw = t * 2;
  const th = t * 1.7;
  const v = (x, y) =>
    `M${n(x)} ${n(y)}Q${n(x + t * 0.5)} ${n(y + t * 0.95)} ${n(x + t)} ${n(y)}`;
  const row = (y, off) => [-1.5, -0.5, 0.5, 1.5]
    .map((k) => v(off + k * t + t * 0.5, y)).join('');
  const strokes = (y, off) => `
    <path d="${row(y, off)}" fill="none" stroke="#ffffff" stroke-opacity=".1"
      stroke-width="${n(t * 0.32)}" stroke-linecap="round"/>
    <path d="${row(y + t * 0.22, off)}" fill="none" stroke="${C.shadow}" stroke-opacity=".22"
      stroke-width="${n(t * 0.3)}" stroke-linecap="round"/>`;
  return [0, 1, 2].map((i) => `
  <pattern id="knit${i}" width="${n(tw)}" height="${n(th)}" patternUnits="userSpaceOnUse"
           patternTransform="rotate(${[-9, 0, 8][i]})">
    ${strokes(t * 0.1, 0)}
    ${strokes(t * 0.95, t)}
  </pattern>`).join('');
}

// Loose fibres lying on the surface. Cheap, and it kills the machine-made feel.
function fibres(count) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = R(0, W);
    const y = R(0, H);
    const len = R(6, 24);
    const a = R(0, Math.PI * 2);
    out += `<path d="${smooth([
      [x, y],
      [x + Math.cos(a) * len * 0.5 + R(-3, 3), y + Math.sin(a) * len * 0.5 + R(-3, 3)],
      [x + Math.cos(a) * len, y + Math.sin(a) * len],
    ])}" stroke="${chance(0.5) ? '#fff3d8' : C.shadow}" stroke-opacity="${n(R(0.05, 0.12))}"
       stroke-width="${n(R(0.7, 1.5))}" fill="none" stroke-linecap="round"/>`;
  }
  return `<g>${out}</g>`;
}

function seam(d, t, opacity = 0.4, color = C.cream) {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-opacity="${opacity}"
    stroke-width="${n(t * 0.3)}" stroke-linecap="round"
    stroke-dasharray="${n(t * 1.2)} ${n(t * 1.1)}"/>`;
}

function glow(cx, cy, r, strength = 0.55, id = 'glow-gold') {
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="url(#${id})"
    opacity="${n(strength)}"/>`;
}

/* --- things that grow ----------------------------------------------------- */

// A french knot: one stitch pulled into a bobble.
function knots(cx, cy, rx, ry, count, tones, r) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const k = Math.sqrt(rnd());
    const x = cx + Math.cos(a) * rx * k;
    const y = cy + Math.sin(a) * ry * k;
    const rr = r * R(0.7, 1.25);
    out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(rr)}" fill="${pick(tones)}"/>`;
    out += `<circle cx="${n(x - rr * 0.28)}" cy="${n(y - rr * 0.34)}" r="${n(rr * 0.38)}"
      fill="#fff3d8" fill-opacity=".16"/>`;
  }
  return out;
}

// A crocheted conifer: stacked skirts, dark against the sky.
function conifer(x, y, h, tones = ['#1e3227', '#25402f', '#1c2a3e']) {
  const w = h * 0.42;
  const tone = pick(tones);
  let out = `<path d="${lump(x, y, w * 0.55, h * 0.05, 0.15)}" fill="${C.shadow}"
    fill-opacity=".3"/>`;
  out += `<path d="M${n(x - w * 0.08)} ${n(y)}v${n(-h * 0.2)}h${n(w * 0.16)}v${n(h * 0.2)}Z"
    fill="${C.timberDark}"/>`;
  for (let i = 0; i < 4; i++) {
    const k = i / 3;
    const cy = y - h * (0.16 + k * 0.66);
    const rx = w * (0.55 - k * 0.34);
    out += `<path d="${smooth([[x - rx, cy], [x - rx * 0.4, cy - h * 0.1],
      [x, cy - h * 0.26], [x + rx * 0.4, cy - h * 0.1], [x + rx, cy],
      [x, cy + h * 0.03]], true)}" fill="${tone}"/>`;
    out += `<path d="${smooth([[x - rx * 0.8, cy - h * 0.02], [x, cy - h * 0.22]])}"
      fill="none" stroke="#ffffff" stroke-opacity=".09" stroke-width="${n(h * 0.03)}"
      stroke-linecap="round"/>`;
  }
  return out;
}

// A bobble tree: autumn wool, a knot of rust or ochre on a stem.
function bobble(x, y, h, tones) {
  const r = h * 0.42;
  let out = `<path d="${lump(x, y, r * 0.8, h * 0.05, 0.15)}" fill="${C.shadow}"
    fill-opacity=".28"/>`;
  out += `<path d="M${n(x - h * 0.03)} ${n(y)}v${n(-h * 0.35)}h${n(h * 0.06)}v${n(h * 0.35)}Z"
    fill="${C.timberDark}"/>`;
  out += knots(x, y - h * 0.6, r, r * 0.82, 7, tones, r * 0.44);
  return out;
}

// Embroidered leaves: a stem of chain stitch with lazy-daisy leaves on it.
function sprig(x, y, len, angle, color = '#c98f3c') {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const tip = [x + dx * len, y + dy * len];
  const mid = [x + dx * len * 0.5 - dy * len * 0.18, y + dy * len * 0.5 + dx * len * 0.18];
  let out = `<path d="${smooth([[x, y], mid, tip])}" fill="none" stroke="${color}"
    stroke-opacity=".65" stroke-width="${n(len * 0.035)}" stroke-linecap="round"/>`;
  for (let i = 1; i <= 5; i++) {
    const k = i / 6;
    const px = x + (tip[0] - x) * k + (mid[0] - (x + (tip[0] - x) * 0.5)) * Math.sin(k * Math.PI);
    const py = y + (tip[1] - y) * k + (mid[1] - (y + (tip[1] - y) * 0.5)) * Math.sin(k * Math.PI);
    const side = i % 2 ? 1 : -1;
    const la = angle + side * 1.05;
    const ll = len * R(0.16, 0.24);
    out += `<path d="${smooth([[px, py],
      [px + Math.cos(la) * ll * 0.5 - Math.sin(la) * ll * 0.28,
        py + Math.sin(la) * ll * 0.5 + Math.cos(la) * ll * 0.28],
      [px + Math.cos(la) * ll, py + Math.sin(la) * ll],
      [px + Math.cos(la) * ll * 0.5 + Math.sin(la) * ll * 0.28,
        py + Math.sin(la) * ll * 0.5 - Math.cos(la) * ll * 0.28]], true)}"
      fill="${color}" fill-opacity="${n(R(0.45, 0.8))}"/>`;
  }
  return out;
}

/* --- hills ---------------------------------------------------------------- */

// One knitted mound. The valley is nothing but these, overlapping.
function mound(cx, cy, rx, ry, { tone, k = null, wobble = 0.09 } = {}) {
  const pts = [];
  const steps = 13;
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI + (i / steps) * Math.PI;
    pts.push([cx + Math.cos(a) * rx * (1 + R(-wobble, wobble)),
      cy + Math.sin(a) * ry * (1 + R(-wobble, wobble))]);
  }
  pts.push([cx + rx * 0.5, cy + ry * 0.16], [cx - rx * 0.5, cy + ry * 0.16]);
  const d = smooth(pts, true);
  const knit = k === null ? Math.floor(rnd() * 3) : k;
  let out = `<path d="${d}" fill="${tone}"/>`;
  out += `<path d="${d}" fill="url(#knit${knit})"/>`;
  // Light along the top edge, shade where it meets the ground.
  out += `<path d="${smooth(pts.slice(1, Math.round(steps * 0.62)))}" fill="none"
    stroke="#fff3d8" stroke-opacity=".1" stroke-width="${n(ry * 0.14)}"
    stroke-linecap="round"/>`;
  out += `<path d="${smooth([[cx - rx * 0.95, cy - ry * 0.06], [cx, cy + ry * 0.1],
    [cx + rx * 0.95, cy - ry * 0.06]])}" fill="none" stroke="${C.shadow}"
    stroke-opacity=".3" stroke-width="${n(ry * 0.2)}" stroke-linecap="round"/>`;
  return out;
}

/* --- buildings ------------------------------------------------------------ */

// One house. `state` is lit, dark or stuck, which is the only health signal in
// the whole piece: a window burning, a window out, a door that will not open.
function house(x, y, w, { state = 'lit', detail = 1, roof = null, lean = 0, tall = 1 } = {}) {
  const hw = w / 2;
  const bodyH = w * 0.72 * tall * R(0.94, 1.06);
  const roofH = w * R(0.36, 0.44);
  const roofColor = roof || pick([C.slate, C.roofRust, C.slateWarm]);
  const wall = detail === 0 ? C.wallCool : pick([C.wall, C.wallWarm, C.wallCool]);
  const base = y;
  const top = base - bodyH;
  const lit = state !== 'dark';
  const dim = state === 'stuck';
  const winY = base - bodyH * (detail >= 2 ? 0.42 : 0.55);
  let out = `<path d="${lump(x, base + w * 0.03, hw * 1.25, w * 0.07, 0.12)}"
    fill="${C.shadow}" fill-opacity=".34"/>`;

  const walls = smooth([
    [x - hw, base], [x - hw * R(0.97, 1.03), base - bodyH * 0.5], [x - hw, top],
    [x, top - bodyH * 0.015], [x + hw, top],
    [x + hw * R(0.97, 1.03), base - bodyH * 0.5], [x + hw, base], [x, base + bodyH * 0.01],
  ], true);
  out += `<path d="${walls}" fill="${wall}"/>`;
  out += `<path d="${walls}" fill="url(#knit1)" opacity=".5"/>`;
  out += `<path d="${smooth([[x + hw * 0.44, base], [x + hw * 0.44, top],
    [x + hw, top], [x + hw * 1.02, base]], true)}" fill="${C.shadow}" fill-opacity=".18"/>`;

  const eave = hw * 1.16;
  const roofPath = smooth([
    [x - eave, top + roofH * 0.08], [x - eave * 0.52, top - roofH * 0.52],
    [x, top - roofH], [x + eave * 0.52, top - roofH * 0.52],
    [x + eave, top + roofH * 0.08], [x, top + roofH * 0.13],
  ], true);
  out += `<path d="${roofPath}" fill="${roofColor}"/>`;
  out += `<path d="${roofPath}" fill="url(#knit1)" opacity=".55"/>`;
  out += `<path d="${smooth([[x - eave * 0.92, top + roofH * 0.02], [x, top - roofH * 0.9],
    [x + eave * 0.92, top + roofH * 0.02]])}" fill="none" stroke="#fff3d8"
    stroke-opacity=".16" stroke-width="${n(w * 0.022)}" stroke-linecap="round"/>`;

  if (detail >= 1) {
    const cx = x - hw * 0.62;
    const cTop = top - roofH * 0.8;
    out += `<path d="${smooth([[cx - w * 0.055, top - roofH * 0.3], [cx - w * 0.055, cTop],
      [cx + w * 0.055, cTop], [cx + w * 0.055, top - roofH * 0.3]], true)}" fill="${C.timber}"/>`;
    if (lit && !dim) {
      out += `<path d="${smooth([[cx, cTop], [cx - w * 0.1, cTop - w * 0.22],
        [cx + w * 0.05, cTop - w * 0.42], [cx - w * 0.06, cTop - w * 0.66]])}" fill="none"
        stroke="${C.cream}" stroke-opacity=".14" stroke-width="${n(w * 0.05)}"
        stroke-linecap="round"/>`;
    }
  }

  const winW = w * (detail >= 2 ? 0.26 : 0.24);
  const winH = winW * 1.15;
  const wx = detail >= 1 ? x - w * 0.2 : x;
  if (lit) out += glow(wx, winY, w * (detail >= 2 ? 1.2 : 0.95), dim ? 0.22 : 0.5);
  out += `<path d="${lump(wx, winY, winW / 2 + w * 0.022, winH / 2 + w * 0.022, 0.05)}"
    fill="${C.timberDark}" fill-opacity=".85"/>`;
  // A door that sticks still lets some light in — just less of it, and later.
  out += `<path d="${lump(wx, winY, winW / 2, winH / 2, 0.05)}"
    fill="${dim ? '#b0793c' : lit ? C.lit : C.dark}"/>`;
  if (lit && !dim) {
    out += `<path d="${lump(wx, winY, winW * 0.3, winH * 0.32, 0.08)}" fill="${C.litCore}"/>`;
  }
  if (detail >= 1) {
    out += `<g stroke="${C.timberDark}" stroke-opacity=".75" stroke-width="${n(w * 0.017)}"
      fill="none" stroke-linecap="round">
      <path d="M${n(wx)} ${n(winY - winH / 2)}V${n(winY + winH / 2)}"/>
      <path d="M${n(wx - winW / 2)} ${n(winY)}H${n(wx + winW / 2)}"/></g>`;
  }

  if (detail >= 1) {
    const dw = w * 0.19;
    const dh = bodyH * 0.52;
    const dx = x + w * 0.2;
    const door = smooth([[dx - dw / 2, base], [dx - dw / 2, base - dh * 0.8],
      [dx, base - dh], [dx + dw / 2, base - dh * 0.8], [dx + dw / 2, base]], true);
    out += `<path d="${door}" fill="${state === 'dark' ? C.timberDark : C.timber}"/>`;
    if (state === 'stuck') {
      // Wedged part open: the key turns, but only just, and not for long.
      out += `<path d="${smooth([[dx - dw * 0.5, base], [dx - dw * 0.5, base - dh * 0.84],
        [dx - dw * 0.04, base - dh * 0.76], [dx - dw * 0.02, base]], true)}"
        fill="${C.dark}" fill-opacity=".92"/>`;
      out += `<path d="${lump(dx + dw * 0.2, base - dh * 0.5, w * 0.028, w * 0.04, 0.1)}"
        fill="${C.shadow}"/>`;
    } else if (detail >= 2) {
      out += `<circle cx="${n(dx + dw * 0.3)}" cy="${n(base - dh * 0.45)}" r="${n(w * 0.018)}"
        fill="${C.gold}" fill-opacity=".9"/>`;
    }
    if (detail >= 2) {
      out += seam(door, w * 0.07, 0.22);
      out += `<path d="${lump(dx, base + w * 0.022, dw * 0.85, w * 0.03, 0.08)}"
        fill="${C.track}" fill-opacity=".8"/>`;
      for (let i = 1; i < 5; i++) {
        out += `<path d="${smooth(ridge(base - (bodyH * i) / 5, x - hw * 0.95, x + hw * 0.95,
          bodyH * 0.005, 4))}" fill="none" stroke="${C.shadow}" stroke-opacity=".1"
          stroke-width="${n(w * 0.012)}"/>`;
      }
    }
  }
  return `<g transform="rotate(${n(lean)} ${n(x)} ${n(base)})">${out}</g>`;
}

// Put a house so its window lands exactly on the map pin at [pinY, x]. The
// window sits left of centre on the facade, so the house shifts right to suit.
function houseAtPin(x, pinY, w, opts = {}) {
  const detail = opts.detail ?? 1;
  const bodyH = w * 0.72 * (opts.tall ?? 1);
  return house(x + (detail >= 1 ? w * 0.2 : 0),
    pinY + bodyH * (detail >= 2 ? 0.42 : 0.55), w, opts);
}

// A knot of rooftops seen from far enough away that they read as a village.
function hamlet(x, y, spread, count, { darkOnes = 0, detail = 0, size = 0.26 } = {}) {
  const places = [];
  for (let i = 0; i < count; i++) {
    places.push([x + R(-spread, spread), y + R(-spread * 0.38, spread * 0.38)]);
  }
  places.sort((a, b) => a[1] - b[1]);
  return places.map((p, i) => house(p[0], p[1], spread * size * R(0.8, 1.2), {
    state: i < darkOnes ? 'dark' : 'lit',
    detail,
  })).join('');
}

/* --- the water ------------------------------------------------------------ */

function water(half, t, { trail = true } = {}) {
  const top = riverEdge(half, -1);
  const bot = riverEdge(half, 1);
  const band = smooth(top.concat(bot.reverse()), true);
  let out = `<path d="${band}" fill="${C.waterDeep}"/>`;
  out += `<path d="${smooth(RIVER.map(([x, y]) => [x, y - widthAt(x, half) * 0.15]))}"
    fill="none" stroke="${C.water}" stroke-opacity=".9"
    stroke-width="${n(half * 1.2)}" stroke-linecap="round"/>`;

  // Current: long ripples following the flow, brightest mid-stream.
  for (let i = 0; i < 34; i++) {
    const x = R(-200, W + 200);
    const w0 = widthAt(x, half);
    const off = R(-w0 * 0.8, w0 * 0.8);
    const len = R(w0 * 2, w0 * 7);
    const pts = [];
    for (let k = 0; k <= 4; k++) {
      const xx = x + (len * k) / 4;
      pts.push([xx, riverY(xx) + off + R(-w0 * 0.05, w0 * 0.05)]);
    }
    out += `<path d="${smooth(pts)}" fill="none" stroke="${C.waterLight}"
      stroke-opacity="${n(R(0.14, 0.4))}" stroke-width="${n(t * R(0.25, 0.7))}"
      stroke-linecap="round"/>`;
  }

  if (trail) {
    // The lantern trail. The drifting lanterns on the map follow this line, so
    // the water is already lit along their route.
    const line = smooth(RIVER.map(([x, y]) => [x, y - widthAt(x, half) * 0.1]));
    out += `<path d="${line}" fill="none" stroke="${C.gold}" stroke-opacity=".13"
      stroke-width="${n(half * 0.7)}" stroke-linecap="round"/>`;
    out += `<path d="${line}" fill="none" stroke="${C.lit}" stroke-opacity=".28"
      stroke-width="${n(t * 0.22)}" stroke-linecap="round"/>`;
    for (let i = 0; i < 7; i++) {
      const x = R(-100, W + 100);
      const y = riverY(x) - widthAt(x, half) * 0.1;
      out += glow(x, y, widthAt(x, half) * R(0.5, 1), R(0.18, 0.36));
      // The reflection under a lantern, stretched downstream.
      out += `<path d="${smooth([[x, y], [x - t * 0.6, y + half * 0.5],
        [x + t * 0.4, y + half * 0.9]])}" fill="none" stroke="${C.lit}"
        stroke-opacity=".2" stroke-width="${n(t * 0.4)}" stroke-linecap="round"/>`;
    }
  }
  return out;
}

// The stitched edge where the land meets the water.
function shore(half, side, t) {
  const line = RIVER.map(([x, y]) => [x, y + side * widthAt(x, half)]);
  const inner = RIVER.map(([x, y]) => [x, y + side * (widthAt(x, half) + t * 0.9)]);
  let out = `<path d="${smooth(line.concat(inner.reverse()), true)}" fill="${C.track}"
    fill-opacity=".3"/>`;
  out += `<path d="${smooth(line)}" fill="none" stroke="${C.shadow}" stroke-opacity=".4"
    stroke-width="${n(t * 0.4)}"/>`;
  return out;
}

// A track: tan wool laid in a curve, stitched down the middle.
function track(pts, t, width = 1) {
  const d = smooth(pts);
  return `<path d="${d}" fill="none" stroke="${C.track}" stroke-opacity=".7"
    stroke-width="${n(t * 1.5 * width)}" stroke-linecap="round"/>
    ${seam(d, t * 0.9, 0.3)}`;
}

function bridge(x, half, t) {
  const y = riverY(x);
  const span = widthAt(x, half) * 2.5;
  const w0 = widthAt(x, half);
  let out = `<path d="${smooth([[x - span / 2, y + w0 * 1.15],
    [x - span * 0.2, y - w0 * 0.5], [x + span * 0.2, y - w0 * 0.5],
    [x + span / 2, y + w0 * 1.15]])}" fill="none" stroke="${C.timber}"
    stroke-width="${n(t * 1.05)}" stroke-linecap="round"/>`;
  out += seam(smooth([[x - span / 2, y + w0 * 0.95], [x, y - w0 * 0.62],
    [x + span / 2, y + w0 * 0.95]]), t, 0.35);
  return out;
}

/* --- people and keys ------------------------------------------------------ */

// Folk-art figures: a head, a bell of cloth, two arms. No faces — a rag doll
// carries a story better than a portrait does.
function figure(x, y, h, { dancing = false, tone = null } = {}) {
  const w = h * 0.46;
  const skirt = tone || pick(['#7d4a63', '#4a5a7a', '#a2652f', '#5f4a72', '#3f6154']);
  const lift = dancing ? R(-h * 0.14, 0) : 0;
  const armA = dancing ? -h * 0.44 : -h * 0.1;
  const armB = dancing ? -h * 0.3 : -h * 0.05;
  let out = `<path d="${lump(x, y + h * 0.02, w * 0.6, h * 0.05, 0.15)}" fill="${C.shadow}"
    fill-opacity=".3"/>`;
  out += `<path d="${smooth([[x - w / 2, y + lift], [x - w * 0.3, y - h * 0.5 + lift],
    [x, y - h * 0.62 + lift], [x + w * 0.3, y - h * 0.5 + lift], [x + w / 2, y + lift],
    [x, y + h * 0.03 + lift]], true)}" fill="${skirt}"/>`;
  out += `<g fill="none" stroke="${skirt}" stroke-width="${n(h * 0.085)}" stroke-linecap="round">
    <path d="${smooth([[x - w * 0.26, y - h * 0.5 + lift],
      [x - w * 0.62, y - h * 0.5 + armA + lift]])}"/>
    <path d="${smooth([[x + w * 0.26, y - h * 0.5 + lift],
      [x + w * 0.64, y - h * 0.5 + armB + lift]])}"/></g>`;
  out += `<path d="${lump(x, y - h * 0.76 + lift, h * 0.15, h * 0.16, 0.08)}" fill="#c9a887"/>`;
  out += `<path d="${lump(x, y - h * 0.85 + lift, h * 0.17, h * 0.1, 0.12)}" fill="#3a2a22"/>`;
  return out;
}

// A key: the thing she makes. One key, one door, one lit window.
function key(x, y, len, a, color = C.gold) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const tip = [x + c * len, y + s * len];
  let out = `<path d="${smooth([[x, y], [x + c * len * 0.5, y + s * len * 0.5], tip])}"
    fill="none" stroke="${color}" stroke-width="${n(len * 0.1)}" stroke-linecap="round"/>`;
  out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(len * 0.17)}" fill="none" stroke="${color}"
    stroke-width="${n(len * 0.09)}"/>`;
  out += `<path d="M${n(tip[0])} ${n(tip[1])} l${n(-s * len * 0.2)} ${n(c * len * 0.2)}"
    stroke="${color}" stroke-width="${n(len * 0.09)}" stroke-linecap="round" fill="none"/>`;
  out += `<path d="M${n(x + c * len * 0.76)} ${n(y + s * len * 0.76)}
    l${n(-s * len * 0.15)} ${n(c * len * 0.15)}" stroke="${color}"
    stroke-width="${n(len * 0.08)}" stroke-linecap="round" fill="none"/>`;
  return out;
}

/* --- the sheet ------------------------------------------------------------ */

function svg({ t, body, defs = '', room = false }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"
  width="${W}" height="${H}">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.skyTop}"/>
    <stop offset=".5" stop-color="${C.skyMid}"/>
    <stop offset=".82" stop-color="${C.skyLow}"/>
    <stop offset="1" stop-color="${C.skyWarm}"/>
  </linearGradient>
  <radialGradient id="glow-gold">
    <stop offset="0" stop-color="#ffdca0" stop-opacity=".95"/>
    <stop offset=".4" stop-color="${C.gold}" stop-opacity=".35"/>
    <stop offset="1" stop-color="${C.gold}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="glow-warm">
    <stop offset="0" stop-color="${C.litCore}" stop-opacity=".9"/>
    <stop offset=".45" stop-color="${C.lit}" stop-opacity=".32"/>
    <stop offset="1" stop-color="${C.lit}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="dome-light">
    <stop offset="0" stop-color="#fff3d8" stop-opacity=".16"/>
    <stop offset="1" stop-color="#fff3d8" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="dome-shade">
    <stop offset="0" stop-color="${C.shadow}" stop-opacity=".3"/>
    <stop offset="1" stop-color="${C.shadow}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="vignette" cx=".5" cy=".48" r=".75">
    <stop offset=".5" stop-color="${C.shadow}" stop-opacity="0"/>
    <stop offset="1" stop-color="${C.shadow}" stop-opacity=".5"/>
  </radialGradient>
  ${knitDefs(t)}
  ${defs}
</defs>
${body}
${room ? '' : fibres(280)}
${room ? '' : `<rect width="${W}" height="${H}" fill="url(#vignette)"/>`}
</svg>
`;
}

/* --- the valley floor ----------------------------------------------------- */

// The valley is built from layered bands of knitted hill. Each band is a ridge
// line — a run of soft bumps — filled all the way down, so the one in front
// hides its skirt. `at(x)` gives the height of the ridge at any point, which
// is how houses and trees end up standing on the hill instead of beside it.
function hillBand({ baseY, tone, knit = null, bumps = 7, amp = 110, forced = [], span = 2378 }) {
  const list = forced.map((f) => ({ x: f.x, h: f.h ?? amp, w: f.w ?? 230 }));
  const step = span / bumps;
  for (let i = 0; i < bumps; i++) {
    list.push({
      x: -300 + step * (i + R(0.2, 0.8)),
      h: amp * R(0.45, 1.25),
      w: step * R(0.34, 0.62),
    });
  }
  // `damp` flattens the bumps, which is how the knit rows inside a hill stay
  // parallel to its top instead of running off the edge of it.
  const rise = (x, damp = 1) => list.reduce((sum, b) =>
    sum + b.h * damp * Math.exp(-(((x - b.x) / b.w) ** 2)), 0);
  const at = (x) => baseY - rise(x);

  const line = (damp, drop) => {
    const pts = [];
    for (let x = -300; x <= 2078; x += 42) pts.push([x, baseY - rise(x, damp) + drop]);
    return smooth(pts);
  };

  const ridge = (() => {
    const pts = [];
    for (let x = -300; x <= 2078; x += 42) pts.push([x, at(x) + R(-3, 3)]);
    return smooth(pts);
  })();
  const d = `${ridge} L2078 1120 L-300 1120 Z`;
  const k = knit === null ? Math.floor(rnd() * 3) : knit;

  let g = `<path d="${d}" fill="${tone}"/>`;
  g += `<path d="${d}" fill="url(#knit${k})"/>`;

  // Rows of knitting following the top of each bump.
  g += `<g fill="none" stroke-linecap="round">`;
  for (let i = 1; i <= 13; i++) {
    const damp = 1 - i * 0.055;
    const drop = amp * 0.07 * i + i * i * 1.1;
    g += `<path d="${line(damp, drop)}" stroke="${i % 2 ? '#fff3d8' : C.shadow}"
      stroke-opacity="${n(i % 2 ? 0.045 : 0.06)}" stroke-width="${n(amp * 0.045)}"/>`;
  }
  g += `</g>`;

  // Each bump gets a lit shoulder and a shaded one, so it reads as round.
  list.forEach((b) => {
    if (b.h < amp * 0.4) return;
    const top = at(b.x);
    g += `<ellipse cx="${n(b.x - b.w * 0.34)}" cy="${n(top + b.h * 0.44)}"
      rx="${n(b.w * 0.62)}" ry="${n(b.h * 0.62)}" fill="url(#dome-light)" opacity=".5"/>`;
    g += `<ellipse cx="${n(b.x + b.w * 0.5)}" cy="${n(top + b.h * 0.7)}"
      rx="${n(b.w * 0.7)}" ry="${n(b.h * 0.8)}" fill="url(#dome-shade)" opacity=".55"/>`;
  });

  g += `<path d="${ridge}" fill="none" stroke="#fff3d8" stroke-opacity=".14"
    stroke-width="${n(Math.max(3, amp * 0.05))}" stroke-linecap="round"/>`;
  return { svg: g, at };
}

// Trees, bobbles and embroidery over a band, following its ridge.
function planting(at, { x0 = -100, x1 = W + 100, count = 14, size = 40, depth = 0.5,
  drop = 90, sprigs = 0.5 } = {}) {
  let g = '';
  for (let i = 0; i < count; i++) {
    const x = x0 + ((x1 - x0) * (i + R(0.1, 0.9))) / count;
    const y = at(x) + R(6, drop);
    const h = size * R(0.6, 1.4);
    g += chance(0.55) ? conifer(x, y, h)
      : bobble(x, y, h * 0.85, pick([
        ['#8c4526', '#a1522c', '#6f3a22'], ['#b8863c', '#caa04a', '#96702f'],
        ['#2f4a38', '#3f5a3f'], ['#7a4a28', '#96602c'],
      ]));
    if (chance(sprigs)) {
      g += sprig(x + R(-90, 90), y + R(10, 70), size * R(0.5, 1.1), R(-2.5, -0.6),
        pick(['#c98f3c', '#b8763a', '#8f9a5a']));
    }
  }
  return g;
}

/* --- level 1: the whole valley -------------------------------------------- */

// Where the map's own pins fall, in SVG space. The art is built around them.
const PIN = {
  workshop: [430, 700],
  litHouse: [830, 290],
  stuckDoor: [620, 232],
  darkHouse: [430, 182],
  dancing: [1420, 280],
  river: [900, 500],
  lanterns: [1180, 528],
};

function valley() {
  rnd = mulberry32(11);
  const t = 10;
  const half = 42;

  let b = `<rect width="${W}" height="${H}" fill="${C.skyTop}"/>`;
  b += `<rect width="${W}" height="${H}" fill="url(#sky)" opacity=".6"/>`;
  b += glow(1500, 96, 320, 0.22);
  b += `<path d="${lump(1500, 92, 30, 29, 0.04)}" fill="#f3e3ba"/>`;

  // Far hills, cold and dark, climbing out of the top of the frame.
  const far1 = hillBand({ baseY: 150, tone: '#1b2138', amp: 130, bumps: 6 });
  b += far1.svg;
  b += planting(far1.at, { count: 16, size: 22, drop: 50, sprigs: 0.2 });
  const far2 = hillBand({ baseY: 250, tone: '#2b2b4a', amp: 120, bumps: 7 });
  b += far2.svg;
  b += planting(far2.at, { count: 15, size: 26, drop: 60, sprigs: 0.3 });
  b += hamlet(1080, far2.at(1080) + 46, 130, 7, { darkOnes: 1 });
  b += hamlet(180, far2.at(180) + 40, 110, 5, { darkOnes: 1 });

  // The hill the village that dances is on.
  const dance = hillBand({
    baseY: 340, tone: '#4a2f42', amp: 120, bumps: 6,
    forced: [{ x: PIN.dancing[0], h: 150, w: 320 }],
  });
  b += dance.svg;
  b += planting(dance.at, { count: 20, size: 32, drop: 80 });
  b += hamlet(PIN.dancing[0], PIN.dancing[1] + 54, 160, 9);
  b += glow(PIN.dancing[0], PIN.dancing[1] + 40, 250, 0.3);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    b += figure(PIN.dancing[0] + Math.cos(a) * 108, PIN.dancing[1] + 88 + Math.sin(a) * 32,
      17, { dancing: true });
  }

  // The terrace: the three houses the map names, standing on their own slope
  // above the water, with the rest of the village around them.
  const terrace = hillBand({
    baseY: 430, tone: '#6e3a24', amp: 130, bumps: 7,
    forced: [{ x: 430, h: 320, w: 240 }, { x: 700, h: 250, w: 260 }],
  });
  b += terrace.svg;
  b += planting(terrace.at, { count: 22, size: 38, drop: 95, sprigs: 0.6 });
  b += hamlet(640, 250, 210, 12, { darkOnes: 2 });
  b += hamlet(920, 400, 130, 6, { darkOnes: 1 });
  b += hamlet(1210, 452, 150, 7, { darkOnes: 1 });
  b += houseAtPin(PIN.darkHouse[0], PIN.darkHouse[1], 38, { state: 'dark', detail: 1 });
  b += houseAtPin(PIN.stuckDoor[0], PIN.stuckDoor[1], 40, {
    state: 'stuck', detail: 1, roof: C.slateWarm });
  b += houseAtPin(PIN.litHouse[0], PIN.litHouse[1], 42, {
    state: 'lit', detail: 1, roof: C.roofRust });
  b += track([[300, 330], [470, 250], [640, 224], [830, 300], [960, 392]], t, 0.7);

  // The water, with the lantern trail already lit along it.
  b += shore(half, -1, t);
  b += water(half, t);
  b += shore(half, 1, t);
  b += bridge(1010, half, t);

  // The near bank: the Keymaker's side, quieter and warmer.
  const nearBank = hillBand({
    baseY: 780, tone: '#57392c', amp: 110, bumps: 6,
    forced: [{ x: 430, h: 46, w: 300 }],
  });
  b += nearBank.svg;
  b += planting(nearBank.at, { count: 20, size: 52, drop: 150, x0: 620, x1: 1900 });
  b += planting(nearBank.at, { count: 6, size: 44, drop: 120, x0: -60, x1: 260 });

  const [wx, wy] = PIN.workshop;
  b += glow(wx, wy, 210, 0.55);
  b += houseAtPin(wx, wy, 82, { state: 'lit', detail: 1, roof: C.roofRust });
  // Her wheel, turning in the water beside the workshop.
  b += `<path d="${lump(wx - 68, wy + 20, 24, 24, 0.06)}" fill="${C.timber}"/>`;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI;
    b += `<path d="M${n(wx - 68 + Math.cos(a) * 24)} ${n(wy + 20 + Math.sin(a) * 24)}
      L${n(wx - 68 - Math.cos(a) * 24)} ${n(wy + 20 - Math.sin(a) * 24)}"
      stroke="${C.timberDark}" stroke-width="3" stroke-linecap="round" fill="none"/>`;
  }
  b += key(wx + 66, wy - 30, 30, -0.4);
  b += conifer(wx - 150, wy + 76, 66);
  b += bobble(wx + 160, wy + 84, 58, ['#8c4526', '#a1522c']);
  b += track([[wx + 46, wy + 62], [640, 760], [840, 748]], t, 0.6);

  // Foreground: the fold of hill the camera is looking over.
  const fore = hillBand({ baseY: 960, tone: '#241f34', amp: 170, bumps: 4, knit: 0 });
  b += fore.svg;
  b += planting(fore.at, { count: 22, size: 96, drop: 190, sprigs: 0.8 });
  b += planting(fore.at, { count: 10, size: 130, drop: 240, sprigs: 0.4, x0: -60, x1: 700 });

  return svg({ t, body: b });
}


/* --- level 2: the village -------------------------------------------------- */

function village() {
  rnd = mulberry32(23);
  const t = 18;
  const half = 100;
  taper = (x) => 0.6 + 0.55 * (x / 1800);

  let b = `<rect width="${W}" height="${H}" fill="${C.skyTop}"/>`;
  b += `<rect width="${W}" height="${H}" fill="url(#sky)" opacity=".6"/>`;

  const far = hillBand({ baseY: 210, tone: '#1b2138', amp: 190, bumps: 5 });
  b += far.svg;
  b += planting(far.at, { count: 16, size: 40, drop: 90, sprigs: 0.3 });
  b += hamlet(1180, far.at(1180) + 70, 150, 6, { darkOnes: 1, detail: 1 });

  const dance = hillBand({
    baseY: 470, tone: '#4a2f42', amp: 190, bumps: 5,
    forced: [{ x: PIN.dancing[0], h: 240, w: 420 }],
  });
  b += dance.svg;
  b += planting(dance.at, { count: 16, size: 52, drop: 130 });
  b += hamlet(PIN.dancing[0], PIN.dancing[1] + 74, 220, 8, { detail: 1 });
  b += glow(PIN.dancing[0], PIN.dancing[1] + 60, 340, 0.32);
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    b += figure(PIN.dancing[0] + Math.cos(a) * 168, PIN.dancing[1] + 150 + Math.sin(a) * 48,
      34, { dancing: true });
  }

  // The terrace, close enough to count the windows.
  const terrace = hillBand({
    baseY: 620, tone: '#6e3a24', amp: 200, bumps: 6,
    forced: [{ x: 430, h: 560, w: 330 }, { x: 760, h: 470, w: 380 }],
  });
  b += terrace.svg;
  b += planting(terrace.at, { count: 20, size: 58, drop: 150, sprigs: 0.6 });
  b += hamlet(300, 200, 190, 7, { darkOnes: 1, detail: 1, size: 0.4 });
  b += hamlet(1060, 330, 200, 6, { darkOnes: 1, detail: 1, size: 0.4 });
  b += track([[180, 300], [430, 210], [640, 250], [830, 330], [1000, 430]], t, 0.8);
  b += houseAtPin(PIN.darkHouse[0], PIN.darkHouse[1], 120, { state: 'dark', detail: 1 });
  b += houseAtPin(PIN.stuckDoor[0], PIN.stuckDoor[1], 130, {
    state: 'stuck', detail: 1, roof: C.slateWarm });
  b += houseAtPin(PIN.litHouse[0], PIN.litHouse[1], 138, {
    state: 'lit', detail: 1, roof: C.roofRust });
  b += conifer(560, 300, 90);
  b += bobble(940, 330, 84, ['#8c4526', '#a1522c']);

  b += shore(half, -1, t);
  b += water(half, t);
  b += shore(half, 1, t);
  b += bridge(1520, half, t);

  const nearBank = hillBand({
    baseY: 900, tone: '#57392c', amp: 130, bumps: 5,
    forced: [{ x: 430, h: 120, w: 420 }],
  });
  b += nearBank.svg;
  b += planting(nearBank.at, { count: 14, size: 80, drop: 190, x0: 900, x1: 1900 });

  const [wx, wy] = PIN.workshop;
  b += glow(wx, wy, 330, 0.55);
  b += houseAtPin(wx, wy, 190, { state: 'lit', detail: 1, roof: C.roofRust });
  b += key(wx + 150, wy - 60, 60, -0.4);
  for (let i = 0; i < 3; i++) b += figure(R(wx + 130, wx + 320), R(880, 930), R(36, 46));
  b += conifer(wx - 260, 880, 150);
  b += bobble(wx + 380, 900, 130, ['#8c4526', '#a1522c']);

  const fore = hillBand({ baseY: 1010, tone: '#241f34', amp: 160, bumps: 3, knit: 0 });
  b += fore.svg;
  b += planting(fore.at, { count: 14, size: 130, drop: 200, sprigs: 0.7 });

  return svg({ t, body: b });
}

/* --- level 3: one house ---------------------------------------------------- */

function houses() {
  rnd = mulberry32(37);
  const t = 40;
  const half = 110;
  taper = (x) => 0.5 + 0.7 * (x / 1800);

  let b = `<rect width="${W}" height="${H}" fill="${C.skyTop}"/>`;
  b += `<rect width="${W}" height="${H}" fill="url(#sky)" opacity=".55"/>`;

  const far = hillBand({ baseY: 300, tone: '#2b2b4a', amp: 300, bumps: 4 });
  b += far.svg;
  b += planting(far.at, { count: 12, size: 74, drop: 150, sprigs: 0.3 });

  // The slope the terrace stands on. Doors, doorsteps, keys on their hooks.
  const terrace = hillBand({
    baseY: 700, tone: '#6e3a24', amp: 260, bumps: 5,
    forced: [{ x: 380, h: 640, w: 420 }, { x: 900, h: 520, w: 460 }],
  });
  b += terrace.svg;
  b += planting(terrace.at, { count: 16, size: 96, drop: 240, sprigs: 0.5 });
  b += track([[60, 300], [430, 200], [700, 250], [980, 380], [1240, 470]], t, 0.9);

  b += houseAtPin(PIN.darkHouse[0], PIN.darkHouse[1], 230, { state: 'dark', detail: 2 });
  b += houseAtPin(PIN.stuckDoor[0], PIN.stuckDoor[1], 250, {
    state: 'stuck', detail: 2, roof: C.slateWarm, lean: 1 });
  b += houseAtPin(PIN.litHouse[0], PIN.litHouse[1], 260, {
    state: 'lit', detail: 2, roof: C.roofRust });
  // A key waiting on its hook by the lit door, and one by the door that sticks.
  b += key(940, 300, 80, 1.5);
  b += key(716, 236, 74, 1.5, '#b98b3f');
  b += conifer(1120, 330, 190);
  b += bobble(300, 300, 150, ['#8c4526', '#a1522c']);
  b += hamlet(1420, 300, 240, 5, { detail: 1, darkOnes: 1, size: 0.34 });

  b += shore(half, -1, t);
  b += water(half, t);
  b += shore(half, 1, t);

  const nearBank = hillBand({
    baseY: 980, tone: '#57392c', amp: 150, bumps: 4,
    forced: [{ x: 430, h: 210, w: 500 }],
  });
  b += nearBank.svg;
  b += planting(nearBank.at, { count: 10, size: 130, drop: 200, x0: 1000, x1: 1900 });

  // The workshop, close enough to see her through the window. Level four is
  // what you find when you walk in.
  const [wx, wy] = PIN.workshop;
  b += glow(wx, wy, 420, 0.5);
  b += houseAtPin(wx, wy, 380, { state: 'lit', detail: 2, roof: C.roofRust, tall: 1.15 });
  b += key(wx + 210, wy - 40, 92, -1.9);
  b += figure(wx + 268, wy + 214, 96, { tone: '#7d4a63' });
  b += conifer(wx - 420, 980, 260);

  return svg({ t, body: b });
}

/* --- level 4: the Keymaker's bench ----------------------------------------- */

// The room is drawn in its own 1778 x 1000 space and then set into the world
// inside the workshop's own footprint. That is what makes the last step of the
// zoom work: by the time you are this close, the visible slice of the map is
// only a few hundred units across, so the bench has to be built at that size
// or you would arrive at a wall the size of a county.
const ROOM_SPAN = 240;              // how much of the world the room fills
const ROOM_KEY = [620, 648];        // the finished key, in room coordinates

function bench() {
  rnd = mulberry32(53);
  const t = 26;
  const [px, py] = ROOM_KEY;
  const wx0 = 1090;
  const wx1 = 1740;
  const wy0 = 210;
  const wy1 = 690;

  let b = `<rect width="${W}" height="${H}" fill="#2a1c16"/>`;

  // The back wall, knitted in dark wool, with a boarded dado below.
  const wallD = poly([[-2600, -3000], [4400, -3000], [4400, 748], [-2600, 764]]);
  b += `<path d="${wallD}" fill="#3d2a1e"/>`;
  b += `<path d="${wallD}" fill="url(#knit1)"/>`;
  b += `<path d="${poly([[-2600, 478], [4400, 456], [4400, 748], [-2600, 764]])}"
    fill="#4a3324"/>`;
  for (let i = 0; i < 40; i++) {
    const x = -2600 + i * 180;
    b += `<path d="${smooth([[x, 470], [x + R(-6, 6), 756]])}" fill="none" stroke="${C.shadow}"
      stroke-opacity=".22" stroke-width="7"/>`;
  }
  b += `<path d="${smooth(ridge(466, -2600, 4400, 3, 16))}" fill="none" stroke="#8a6238"
    stroke-opacity=".55" stroke-width="12"/>`;

  // The window: the river goes on running whether or not she looks up.
  b += `<path d="${poly([[wx0 - 34, wy0 - 34], [wx1 + 34, wy0 - 30], [wx1 + 34, wy1 + 34],
    [wx0 - 34, wy1 + 30]])}" fill="${C.timberDark}"/>`;
  b += `<svg x="${wx0}" y="${wy0}" width="${wx1 - wx0}" height="${wy1 - wy0}"
    viewBox="900 300 650 480">
    <rect x="900" y="300" width="650" height="480" fill="${C.skyTop}"/>
    <rect x="900" y="300" width="650" height="480" fill="url(#sky)" opacity=".7"/>
    ${(() => {
      const hills = hillBand({ baseY: 500, tone: '#1d1e36', amp: 80, bumps: 7, span: 900 });
      let s2 = hills.svg;
      s2 += planting(hills.at, { count: 9, size: 24, drop: 36, x0: 880, x1: 1580, sprigs: 0 });
      for (let i = 0; i < 6; i++) {
        s2 += house(R(920, 1520), R(496, 540), R(42, 64),
          { state: chance(0.22) ? 'dark' : 'lit', detail: 1 });
      }
      const saved = taper;
      taper = () => 1;
      s2 += water(52, 14);
      taper = saved;
      return s2;
    })()}
  </svg>`;
  b += `<g stroke="${C.timberDark}" stroke-width="18" fill="none" stroke-linecap="round">
    <path d="M${(wx0 + wx1) / 2} ${wy0}V${wy1}"/>
    <path d="M${wx0} ${(wy0 + wy1) / 2}H${wx1}"/></g>`;
  b += `<path d="${poly([[wx0 - 60, wy1 + 30], [wx1 + 60, wy1 + 34], [wx1 + 54, wy1 + 76],
    [wx0 - 54, wy1 + 72]])}" fill="#8a6238"/>`;
  b += glow((wx0 + wx1) / 2, (wy0 + wy1) / 2, 520, 0.22);

  // Her stock: one key cut for every lantern that ever came down the river.
  b += `<path d="${poly([[40, 150], [1000, 136], [1006, 206], [46, 222]])}"
    fill="${C.timber}"/>`;
  for (let i = 0; i < 11; i++) {
    const x = 96 + i * 82 + R(-8, 8);
    b += `<circle cx="${n(x)}" cy="${n(200 + R(-6, 6))}" r="9" fill="${C.timberDark}"/>`;
    b += key(x, 214 + R(-6, 6), R(84, 128), Math.PI / 2 + R(-0.12, 0.12));
  }
  b += `<path d="${poly([[40, 400], [660, 390], [664, 438], [44, 450]])}"
    fill="${C.timber}"/>`;
  for (let i = 0; i < 5; i++) {
    b += key(110 + i * 112 + R(-10, 10), 440, R(66, 92), Math.PI / 2 + R(-0.15, 0.15), '#c9a05a');
  }

  // The floor.
  const floorD = poly([[-2600, 748], [4400, 736], [4400, 4000], [-2600, 4000]]);
  b += `<path d="${floorD}" fill="#7a5636"/>`;
  b += `<path d="${floorD}" fill="url(#knit1)" opacity=".8"/>`;
  for (let i = 0; i < 16; i++) {
    b += `<path d="${smooth(ridge(776 + i * 46, -2600, 4400, 4, 14))}" fill="none"
      stroke="${C.shadow}" stroke-opacity=".2" stroke-width="6"/>`;
  }
  b += `<path d="${smooth(ridge(752, -2600, 4400, 2, 14))}" fill="none" stroke="${C.shadow}"
    stroke-opacity=".45" stroke-width="14"/>`;

  // Her lamp, hung over the work.
  b += `<path d="M660 -2600V150" stroke="${C.timberDark}" stroke-width="8"/>`;
  b += glow(660, 250, 620, 0.55);
  b += `<path d="${poly([[598, 212], [722, 212], [700, 148], [620, 148]])}"
    fill="${C.timberDark}"/>`;
  b += `<path d="${lump(660, 250, 56, 62, 0.06)}" fill="${C.lit}"/>`;
  b += `<path d="${lump(660, 248, 28, 32, 0.08)}" fill="${C.litCore}"/>`;
  b += `<path d="${poly([[622, 292], [698, 292], [688, 318], [632, 318]])}"
    fill="${C.timberDark}"/>`;

  // The bench: a plain slab of wool-grained wood, worn pale where she works.
  const benchTop = py + 24;
  b += `<path d="${poly([[30, benchTop + 6], [1120, benchTop - 10], [1136, benchTop + 168],
    [38, benchTop + 190]])}" fill="#6d4a2a"/>`;
  b += `<path d="${poly([[30, benchTop + 6], [1120, benchTop - 10], [1124, benchTop + 34],
    [34, benchTop + 52]])}" fill="#a67c48"/>`;
  b += glow(px, benchTop + 20, 300, 0.3);
  b += seam(smooth(ridge(benchTop + 118, 60, 1100, 4, 9)), 30, 0.2);
  b += `<path d="${smooth(ridge(benchTop + 54, 40, 1120, 2, 8))}" fill="none"
    stroke="${C.shadow}" stroke-opacity=".3" stroke-width="9"/>`;
  [[160, benchTop + 186], [980, benchTop + 172]].forEach(([x, y]) => {
    b += `<path d="${poly([[x - 30, y], [x - 24, 1010], [x + 26, 1010], [x + 32, y]])}"
      fill="#6a4a2b"/>`;
  });
  b += `<path d="${lump(560, 1005, 520, 40, 0.06)}" fill="${C.shadow}" fill-opacity=".35"/>`;

  // The Keymaker, on her stool, both hands busy.
  const hx = 250;
  b += `<path d="${poly([[hx - 84, 1010], [hx - 68, 856], [hx + 74, 856], [hx + 92, 1010]])}"
    fill="#4e3624"/>`;
  const shawl = smooth([[hx - 138, 890], [hx - 118, 690], [hx - 46, 566], [hx + 74, 560],
    [hx + 152, 686], [hx + 172, 900], [hx + 16, 922]], true);
  b += `<path d="${shawl}" fill="#6e3f57"/>`;
  b += `<path d="${shawl}" fill="url(#knit0)"/>`;
  b += `<path d="${smooth([[hx - 78, 906], [hx - 62, 756], [hx + 14, 730], [hx + 92, 754],
    [hx + 112, 912], [hx + 16, 926]], true)}" fill="#c2ab84"/>`;
  b += seam(smooth([[hx - 74, 886], [hx - 58, 762], [hx + 14, 740], [hx + 88, 762],
    [hx + 106, 894]]), 26, 0.25);
  b += `<path d="${smooth([[hx - 68, 748], [hx + 16, 726], [hx + 98, 748]])}" fill="none"
    stroke="#a8916a" stroke-width="9" stroke-linecap="round"/>`;
  // Head, hair, and the shape of a shoulder turned to the work.
  b += `<path d="${lump(hx + 34, 496, 58, 62, 0.06)}" fill="#c9a887"/>`;
  b += `<path d="${lump(hx + 22, 452, 70, 46, 0.1)}" fill="#3a2a22"/>`;
  b += `<path d="${lump(hx - 34, 470, 34, 40, 0.12)}" fill="#3a2a22"/>`;
  b += `<path d="${lump(hx - 8, 512, 16, 20, 0.12)}" fill="#3a2a22"/>`;
  // Arms out to the bench, hands on the key.
  b += `<g fill="none" stroke="#6e3f57" stroke-width="42" stroke-linecap="round">
    <path d="${smooth([[hx + 96, 618], [hx + 200, 630], [px + 34, benchTop - 14]])}"/>
    <path d="${smooth([[hx + 74, 660], [hx + 178, 690], [px - 30, benchTop + 30]])}"/></g>`;
  b += `<path d="${lump(px + 36, benchTop - 12, 30, 24, 0.1)}" fill="#c9a887"/>`;
  b += `<path d="${lump(px - 32, benchTop + 32, 28, 22, 0.1)}" fill="#c9a887"/>`;

  // The key she has just finished, exactly where the map's pin lands.
  b += glow(px, py, 200, 0.6);
  b += key(px - 34, py + 4, 112, -0.14, C.litCore);

  // Blanks, a file, a basket of them under the bench, and the day's shavings.
  b += `<path d="${poly([[640, benchTop + 26], [810, benchTop + 18], [814, benchTop + 48],
    [644, benchTop + 56]])}" fill="#9a8a6a"/>`;
  for (let i = 0; i < 5; i++) {
    b += key(700 + i * 74, benchTop + 14 + R(-8, 8), R(54, 74), R(-0.25, 0.1), '#b9a377');
  }
  b += `<path d="${lump(690, 930, 118, 78, 0.07)}" fill="${C.track}"/>`;
  b += seam(lump(690, 912, 112, 64, 0.07), 30, 0.35);
  for (let i = 0; i < 7; i++) {
    b += key(636 + i * 19, 876 + R(-10, 10), 50, -Math.PI / 2 + R(-0.3, 0.3), '#c9a05a');
  }
  b += `<path d="${lump(1010, benchTop + 30, 40, 34, 0.1)}" fill="${C.cream}"
    fill-opacity=".85"/>`;
  b += knots(430, benchTop + 92, 90, 14, 9, ['#c9a887', '#b9a377'], 5);

  // The stove she heats the blanks in, tucked under the window.
  const sx = 1400;
  b += `<path d="${poly([[sx - 118, 1010], [sx - 104, 830], [sx + 104, 830], [sx + 118, 1010]])}"
    fill="#3f2c22"/>`;
  b += `<path d="${poly([[sx - 126, 836], [sx + 126, 836], [sx + 114, 798], [sx - 114, 798]])}"
    fill="#33221a"/>`;
  b += glow(sx, 918, 300, 0.5);
  b += `<path d="${lump(sx, 918, 64, 46, 0.08)}" fill="${C.lit}"/>`;
  b += `<path d="${lump(sx, 920, 34, 24, 0.1)}" fill="${C.litCore}"/>`;
  b += `<path d="${lump(sx + 190, 990, 90, 46, 0.1)}" fill="${C.timber}"/>`;
  for (let i = 0; i < 5; i++) {
    b += `<path d="${lump(sx + 150 + i * 22, 962 + R(-8, 8), 12, 34, 0.12)}"
      fill="${i % 2 ? '#5a3f28' : '#6a4a2f'}"/>`;
  }

  // Set the room into the world: room-space ROOM_KEY lands on the map's pin,
  // and the layer fades out past the workshop's own walls so that zooming in
  // anywhere else on the map is not tinted brown by a room you are not in.
  const scale = ROOM_SPAN / W;
  const [wxp, wyp] = PIN.workshop;
  const defs = `
  <radialGradient id="room-fade" gradientUnits="userSpaceOnUse"
    cx="${n(wxp)}" cy="${n(wyp)}" r="${n(ROOM_SPAN * 1.6)}"
    gradientTransform="translate(0 ${n(wyp * 0.55)}) scale(1 0.45)">
    <stop offset=".55" stop-color="#fff"/>
    <stop offset="1" stop-color="#000"/>
  </radialGradient>
  <mask id="room-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="url(#room-fade)"/>
  </mask>`;
  const framed = `<g mask="url(#room-mask)">
<g transform="translate(${n(wxp - ROOM_KEY[0] * scale)} ${n(wyp - ROOM_KEY[1] * scale)})
   scale(${n(scale, 4)})">${b}</g></g>`;
  return svg({ t, body: framed, defs, room: true });
}

/* --- write it out ---------------------------------------------------------- */

const LEVELS = [
  ['01-valley.svg', valley],
  ['02-village.svg', village],
  ['03-house.svg', houses],
  ['04-bench.svg', bench],
];

for (const [file, draw] of LEVELS) {
  const out = draw();
  writeFileSync(join(IMAGES, file), out);
  console.log(`${file.padEnd(16)} ${(out.length / 1024).toFixed(0)} kB`);
}
