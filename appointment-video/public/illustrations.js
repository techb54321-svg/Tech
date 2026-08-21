// ============================================================
// illustrations.js — the built-in picture library.
//
// 15 scenes in a warm flat-animation style (think modern animated
// shorts): filled-shape characters with skin, hair and clothing,
// layered environments with real depth, and soft light. The AI can
// only pick picture IDs from this list — it never draws or invents
// images of its own.
//
// How a scene is built, back to front:
//   .layer-bg   the far world (sky shapes, hills, walls, light)
//   .layer-mid  the story: furniture, props, people
//   .layer-fg   things close to camera (foliage, table edges)
// The camera (styles.css) pushes into each scene's focal point and
// moves the three layers at slightly different rates — parallax —
// so the world has depth. Inside each layer, the in-1..in-4 groups
// still enter in choreographed order when the scene starts.
//
// The cast is consistent across scenes: OUR PATIENT (coral jumper,
// warm brown swoop of hair) is the hero of every scene they're in;
// the doctor wears the white coat; the nurse wears sage scrubs.
// ============================================================

// ---- Palette --------------------------------------------------------
const INK = "#3a3330";      // line details: smiles, small strokes
const COAL = "#4a4038";     // trousers, dark props
const CORAL = "#e2574c";    // the hero's jumper + each scene's highlight
const CORAL_D = "#c4483d";
const SAGE = "#a5c3b0";     // soft green world
const SAGE_M = "#86ab94";
const SAGE_D = "#5f8a72";
const GOLD = "#eec06c";     // sunlight, lamps
const GOLD_D = "#d9a03f";
const SKYB = "#cfe0e2";     // soft sky blue
const SKYB_D = "#a9c6cb";
const WHITE = "#fdfbf6";    // the doctor's coat, clouds
const PAPER = "#fbf5ea";    // the cream paper base
const PAPER_D = "#f1e6d2";  // floor bands, gentle shading
const NIGHT = "#333a63";
const NIGHT_D = "#272c4d";
const CREAM = "#f6ead6";    // light marks on dark scenes

// "Line boil": three near-identical wobble filters. styles.css flips
// between them a few times a second so every shape shivers slightly —
// the hand-made feel. With reduced motion the first filter holds.
const BOIL_DEFS = [7, 31, 53]
  .map((seed, i) =>
    `<filter id="boil${i + 1}"><feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="1" seed="${seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.9"/></filter>`
  )
  .join("");

// Wrap a scene in an <svg> tag. "cam" is the scene's camera note:
// "x y scale" — the focal point the slow push-in moves toward,
// written out as percentages so it aims true at any rendered size.
function svgWrap(inner, cam = "180 101 1.22") {
  const [cx, cy, cs] = cam.split(" ");
  const px = ((cx / 360) * 100).toFixed(2);
  const py = ((cy / 202) * 100).toFixed(2);
  return (
    `<svg viewBox="0 0 360 202" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid slice"` +
    ` style="--camx:${px}%;--camy:${py}%;--cams:${cs}">` +
    `<defs>${BOIL_DEFS}</defs>` +
    `<g class="ink" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    inner +
    `</g></svg>`
  );
}

// ---- World-building helpers ----------------------------------------

// A vertical light gradient across the whole frame.
const skyWash = (id, top, bottom) =>
  `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">` +
  `<stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>` +
  `</linearGradient></defs>` +
  `<rect x="-2" y="-2" width="364" height="206" fill="url(#${id})"/>`;

const wash = (color) => `<rect x="-2" y="-2" width="364" height="206" fill="${color}"/>`;

// A band of floor rising from the bottom of the frame.
const floor = (y = 168, color = PAPER_D) =>
  `<path d="M-2 ${y + 4} Q120 ${y} 200 ${y + 3} T362 ${y}" fill="none"/>` +
  `<rect x="-2" y="${y}" width="364" height="${206 - y}" fill="${color}"/>`;

// A soft shadow anchoring a character or prop to the ground.
const shadow = (x, y, rx = 24) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="4.5" fill="${INK}" opacity="0.1"/>`;

// The sun, gently swelling, with a halo.
const sun = (x, y, r = 18) =>
  `<g class="a-pulse-soft" style="transform-origin:${x}px ${y}px">` +
  `<circle cx="${x}" cy="${y}" r="${r * 1.8}" fill="${GOLD}" opacity="0.25"/>` +
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${GOLD}"/>` +
  `</g>`;

// A drifting soft cloud.
const cloud = (x, y, s = 1, delay = 0) =>
  `<g class="a-drift" style="animation-delay:${delay}ms" opacity="0.9">` +
  `<ellipse cx="${x}" cy="${y}" rx="${22 * s}" ry="${8 * s}" fill="${WHITE}"/>` +
  `<ellipse cx="${x + 14 * s}" cy="${y - 5 * s}" rx="${14 * s}" ry="${7 * s}" fill="${WHITE}"/>` +
  `</g>`;

// A rounded hill.
const hill = (cx, cy, rx, ry, color = SAGE) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${color}"/>`;

// A tree with a trunk and layered foliage.
const tree = (x, y, s = 1) =>
  `<g>` +
  `<path d="M${x} ${y} L${x} ${y - 42 * s}" stroke="#8a6a4e" stroke-width="${7 * s}"/>` +
  `<g class="a-sway" style="transform-origin:${x}px ${y - 40 * s}px">` +
  `<circle cx="${x - 12 * s}" cy="${y - 46 * s}" r="${15 * s}" fill="${SAGE_M}"/>` +
  `<circle cx="${x + 11 * s}" cy="${y - 50 * s}" r="${16 * s}" fill="${SAGE}"/>` +
  `<circle cx="${x - 1 * s}" cy="${y - 60 * s}" r="${15 * s}" fill="${SAGE_M}"/>` +
  `</g></g>`;

// Far-away birds.
const birds = (x, y, delay = 0) =>
  `<g class="a-drift" style="animation-delay:${delay}ms">` +
  `<path d="M${x} ${y} q5 -6 10 0 q5 -6 10 0" stroke="${INK}" stroke-width="3" opacity="0.5" fill="none"/>` +
  `</g>`;

// A pot plant with leaves that sway.
const plant = (x, y, s = 1) =>
  `<g>` +
  `<path d="M${x - 10 * s} ${y} L${x + 10 * s} ${y} L${x + 7 * s} ${y + 16 * s} L${x - 7 * s} ${y + 16 * s} Z" fill="${CORAL_D}"/>` +
  `<g class="a-sway" style="transform-origin:${x}px ${y}px">` +
  `<path d="M${x} ${y} Q${x - 16 * s} ${y - 20 * s} ${x - 7 * s} ${y - 34 * s} Q${x - 2 * s} ${y - 20 * s} ${x} ${y}" fill="${SAGE_M}"/>` +
  `<path d="M${x} ${y} Q${x + 14 * s} ${y - 24 * s} ${x + 12 * s} ${y - 32 * s} Q${x + 2 * s} ${y - 22 * s} ${x} ${y}" fill="${SAGE}"/>` +
  `<path d="M${x} ${y} Q${x - 3 * s} ${y - 26 * s} ${x + 2 * s} ${y - 38 * s} Q${x + 5 * s} ${y - 24 * s} ${x} ${y}" fill="${SAGE_D}"/>` +
  `</g></g>`;

// A window with sky, frame, and a shaft of light falling to the floor.
const windowLight = (x, y, w, h, floorY) =>
  `<rect x="${x - 4}" y="${y - 4}" width="${w + 8}" height="${h + 8}" rx="7" fill="${WHITE}"/>` +
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${SKYB}"/>` +
  `<circle cx="${x + w * 0.72}" cy="${y + h * 0.3}" r="${w * 0.16}" fill="${GOLD}"/>` +
  `<path d="M${x + w / 2} ${y} L${x + w / 2} ${y + h} M${x} ${y + h / 2} L${x + w} ${y + h / 2}" stroke="${WHITE}" stroke-width="4"/>` +
  `<path d="M${x - 2} ${y + h} L${x + w + 2} ${y + h} L${x + w + 26} ${floorY} L${x - 26} ${floorY} Z" fill="${GOLD}" opacity="0.13"/>`;

// Big soft leaves poking in from a corner — the foreground layer.
const fgLeaves = (corner = "left") => {
  const flip = corner === "left" ? "" : ` transform="translate(360 0) scale(-1 1)"`;
  return (
    `<g${flip} opacity="0.95">` +
    `<path d="M-6 210 Q10 150 44 138 Q28 186 10 210 Z" fill="${SAGE_D}"/>` +
    `<path d="M-8 212 Q-4 168 22 152 Q16 192 2 212 Z" fill="${SAGE_M}"/>` +
    `</g>`
  );
};

// ---- The cast -------------------------------------------------------
// Filled-shape characters: capsule body, fat-stroke limbs, skin, hair.
// Same rig groups as ever (p-armL, p-legR, p-head...), so all the
// walk/talk/nod animations in styles.css keep working.
//
//   outfit  "hero" | "doctor" | "nurse" | "partner" | "child" | "plain"
//   pose    x, feetY, h, look (-1/0/1), armL/armR/legL/legR (degrees
//           from straight down, + toward the right), lean (px)
//   face    "smile" | "open" | "sleep"
//   cls     animation class, e.g. "anim-walk"
const OUTFITS = {
  hero:    { top: CORAL,  pants: COAL,      skin: "#eab992", hair: "#4a3b30", style: "swoop" },
  doctor:  { top: WHITE,  pants: "#5b6470", skin: "#b97f52", hair: "#2e2620", style: "short" },
  nurse:   { top: SAGE_M, pants: SAGE_D,    skin: "#f0c9a2", hair: "#6b4a2f", style: "bun" },
  partner: { top: GOLD,   pants: COAL,      skin: "#d9a06b", hair: "#2e2620", style: "curl" },
  child:   { top: SKYB_D, pants: COAL,      skin: "#e3ac80", hair: "#4a3b30", style: "puffs" },
  plain:   { top: SKYB_D, pants: COAL,      skin: "#eab992", hair: "#4a3b30", style: "short" },
};

function figure(o) {
  const {
    x, feetY, h = 96, lean = 0, look = 0,
    armL = 18, armR = -18, legL = 9, legR = -9,
    face = "smile", cls = "", outfit = "plain",
  } = o;
  const c = OUTFITS[outfit] || OUTFITS.plain;
  const hipY = feetY - h * 0.42;
  const shoY = feetY - h * 0.68;
  const headR = h * 0.155;
  const shoX = x + lean;
  const headX = shoX + lean * 0.4 + look * headR * 0.16;
  const headY = shoY - headR - h * 0.055;
  const armLen = h * 0.3;
  const legLen = h * 0.42;
  const bodyW = h * 0.23;
  const limbW = h * 0.085;
  const legW = h * 0.095;
  const pt = (px, py, ang, len) => {
    const r = (ang * Math.PI) / 180;
    return [(px + Math.sin(r) * len).toFixed(1), (py + Math.cos(r) * len).toFixed(1)];
  };
  const armY = shoY + h * 0.03; // arms hang from just below the shoulder line
  const [alx, aly] = pt(shoX, armY, armL, armLen);
  const [arx, ary] = pt(shoX, armY, armR, armLen);
  const [llx, lly] = pt(x, hipY, legL, legLen);
  const [lrx, lry] = pt(x, hipY, legR, legLen);
  const f1 = (v) => (+v).toFixed(1);

  // Face: eyes, smile/mouth, blush — nudged toward where they look.
  const fx = headX + look * headR * 0.42;
  const fy = headY + headR * 0.12;
  const eyeDX = Math.min(4.6, headR * 0.4);
  let faceMarks =
    `<ellipse cx="${f1(fx - eyeDX - 1)}" cy="${f1(fy + 3.4)}" rx="2.6" ry="1.6" fill="${CORAL}" opacity="0.3"/>` +
    `<ellipse cx="${f1(fx + eyeDX + 1)}" cy="${f1(fy + 3.4)}" rx="2.6" ry="1.6" fill="${CORAL}" opacity="0.3"/>`;
  if (face === "sleep") {
    faceMarks +=
      `<path d="M${f1(fx - eyeDX - 2)} ${f1(fy - 1)} q2.5 2 5 0 M${f1(fx + eyeDX - 3)} ${f1(fy - 1)} q2.5 2 5 0" stroke="${INK}" stroke-width="2.2" fill="none"/>`;
  } else {
    faceMarks +=
      `<circle cx="${f1(fx - eyeDX)}" cy="${f1(fy - 1.5)}" r="1.9" fill="${INK}"/>` +
      `<circle cx="${f1(fx + eyeDX)}" cy="${f1(fy - 1.5)}" r="1.9" fill="${INK}"/>` +
      (face === "open"
        ? `<ellipse cx="${f1(fx)}" cy="${f1(fy + 4.6)}" rx="2.4" ry="3" fill="${INK}"/>`
        : `<path d="M${f1(fx - 4.5)} ${f1(fy + 3.5)} Q${f1(fx)} ${f1(fy + 7.2)} ${f1(fx + 4.5)} ${f1(fy + 3.5)}" stroke="${INK}" stroke-width="2.6" fill="none"/>`);
  }

  // Hair: a hair-coloured circle behind, the skin circle shifted down —
  // whatever peeks out on top reads as hair. Styles add extras.
  const hx = f1(headX - look * headR * 0.18);
  let hairExtra = "";
  if (c.style === "bun") hairExtra = `<circle cx="${f1(headX - look * headR * 0.9)}" cy="${f1(headY - headR * 0.75)}" r="${f1(headR * 0.38)}" fill="${c.hair}"/>`;
  if (c.style === "puffs") hairExtra =
    `<circle cx="${f1(headX - headR * 0.95)}" cy="${f1(headY - headR * 0.55)}" r="${f1(headR * 0.42)}" fill="${c.hair}"/>` +
    `<circle cx="${f1(headX + headR * 0.95)}" cy="${f1(headY - headR * 0.55)}" r="${f1(headR * 0.42)}" fill="${c.hair}"/>`;
  if (c.style === "curl") hairExtra = `<circle cx="${f1(headX + look * headR * 0.55)}" cy="${f1(headY - headR * 1.02)}" r="${f1(headR * 0.34)}" fill="${c.hair}"/>`;
  const hairDrop = c.style === "swoop" ? headR * 0.24 : headR * 0.18;

  // The doctor's stethoscope comes with the coat.
  const steth = outfit === "doctor"
    ? `<path d="M${f1(shoX - 5)} ${f1(shoY + 2)} Q${f1(shoX - 9)} ${f1(shoY + 14)} ${f1(shoX - 3)} ${f1(shoY + 20)}" stroke="${CORAL_D}" stroke-width="3.5" fill="none"/>` +
      `<circle cx="${f1(shoX - 1)} " cy="${f1(shoY + 23)}" r="3.6" fill="${CORAL_D}"/>`
    : "";

  return (
    `<g class="p-all ${cls}" style="transform-origin:${x}px ${feetY}px">` +
    // far arm behind the body
    `<g class="p-armL" style="transform-origin:${f1(shoX)}px ${f1(armY)}px">` +
    `<path d="M${f1(shoX)} ${f1(armY)} L${alx} ${aly}" stroke="${c.top}" stroke-width="${f1(limbW)}"/>` +
    `<circle cx="${alx}" cy="${aly}" r="${f1(h * 0.048)}" fill="${c.skin}"/>` +
    `</g>` +
    // legs with shoes
    `<g class="p-legL" style="transform-origin:${x}px ${f1(hipY)}px">` +
    `<path d="M${x} ${f1(hipY)} L${llx} ${lly}" stroke="${c.pants}" stroke-width="${f1(legW)}"/>` +
    `<ellipse cx="${llx}" cy="${f1(+lly + 1.5)}" rx="${f1(h * 0.055)}" ry="${f1(h * 0.035)}" fill="${INK}"/>` +
    `</g>` +
    `<g class="p-legR" style="transform-origin:${x}px ${f1(hipY)}px">` +
    `<path d="M${x} ${f1(hipY)} L${lrx} ${lry}" stroke="${c.pants}" stroke-width="${f1(legW)}"/>` +
    `<ellipse cx="${lrx}" cy="${f1(+lry + 1.5)}" rx="${f1(h * 0.055)}" ry="${f1(h * 0.035)}" fill="${INK}"/>` +
    `</g>` +
    // capsule body (one fat stroke in the outfit colour)
    `<path d="M${x} ${f1(hipY)} L${f1(shoX)} ${f1(shoY)}" stroke="${c.top}" stroke-width="${f1(bodyW)}"/>` +
    steth +
    // near arm in front
    `<g class="p-armR" style="transform-origin:${f1(shoX)}px ${f1(armY)}px">` +
    `<path d="M${f1(shoX)} ${f1(armY)} L${arx} ${ary}" stroke="${c.top}" stroke-width="${f1(limbW)}"/>` +
    `<circle cx="${arx}" cy="${ary}" r="${f1(h * 0.048)}" fill="${c.skin}"/>` +
    `</g>` +
    // head: hair circle behind, skin in front shifted down, extras, face
    `<g class="p-head" style="transform-origin:${f1(shoX)}px ${f1(shoY)}px">` +
    `<circle cx="${hx}" cy="${f1(headY - headR * 0.12)}" r="${f1(headR * 1.02)}" fill="${c.hair}"/>` +
    hairExtra +
    `<circle cx="${f1(headX)}" cy="${f1(headY + hairDrop * 0.4)}" r="${f1(headR * 0.94)}" fill="${c.skin}"/>` +
    faceMarks +
    `</g>` +
    `</g>`
  );
}

// ============================================================
// The 15 scenes.
// ============================================================
const ILLUSTRATIONS = {

  // 1. Doctor and patient talking — a warm clinic room.
  doctor_patient: svgWrap(`
    ${skyWash("g_dp", "#f6efe2", PAPER)}
    <g class="layer-bg"><g class="in-1">
      ${windowLight(268, 26, 66, 76, 170)}
      <rect x="34" y="36" width="46" height="58" rx="5" fill="${WHITE}"/>
      <path d="M46 52 L68 52 M50 66 L64 66 M53 80 L61 80" stroke="${SKYB_D}" stroke-width="3.5" fill="none"/>
      ${floor(168)}
    </g></g>
    <g class="layer-mid">
      <g class="in-1">${plant(122, 148)}</g>
      <g class="in-3">
        ${shadow(176, 176, 27)}
        ${shadow(258, 176, 27)}
        ${figure({ x: 176, feetY: 172, h: 98, look: 1, armL: 12, armR: -58, face: "open", outfit: "doctor", cls: "anim-talk" })}
        ${figure({ x: 258, feetY: 172, h: 94, look: -1, armL: 46, armR: -14, outfit: "hero", cls: "anim-nod" })}
      </g>
      <g class="in-4">
        <g class="a-bob" style="transform-origin:217px 58px">
          <path d="M194 48 Q217 36 240 48 Q249 58 238 67 Q223 74 205 69 L195 78 L199 67 Q186 58 194 48" fill="${WHITE}"/>
          <circle class="a-flicker" style="animation-delay:0ms" cx="208" cy="57" r="2.8" fill="${CORAL}"/>
          <circle class="a-flicker" style="animation-delay:180ms" cx="217" cy="57" r="2.8" fill="${CORAL}"/>
          <circle class="a-flicker" style="animation-delay:360ms" cx="226" cy="57" r="2.8" fill="${CORAL}"/>
        </g>
      </g>
    </g>
    <g class="layer-fg"><g class="in-1">${fgLeaves("left")}</g></g>
  `, "216 78 1.3"),

  // 2. Taking a tablet — morning kitchen.
  taking_tablet: svgWrap(`
    ${skyWash("g_tt", "#f8ecd6", PAPER)}
    <g class="layer-bg"><g class="in-1">
      ${windowLight(36, 26, 60, 70, 168)}
      ${floor(168)}
      <rect x="228" y="126" width="126" height="10" rx="4" fill="#c9a37a"/>
      <rect x="238" y="136" width="10" height="38" fill="#b08a60"/>
      <rect x="330" y="136" width="10" height="38" fill="#b08a60"/>
    </g></g>
    <g class="layer-mid">
      <g class="in-2">
        <path d="M282 96 L286 126 L306 126 L310 96 Z" fill="${SKYB}"/>
        <path d="M285 106 Q296 101 307 106 L306 126 L286 126 Z" fill="${SKYB_D}"/>
        <circle class="a-rise" cx="296" cy="118" r="2.6" fill="${WHITE}"/>
      </g>
      <g class="in-3">
        ${shadow(150, 176, 27)}
        ${figure({ x: 150, feetY: 172, h: 100, look: -1, armL: 24, armR: -118, legL: 7, legR: -7, face: "open", outfit: "hero", cls: "anim-sip" })}
      </g>
      <g class="in-4">
        <g class="a-bob" style="transform-origin:104px 74px">
          <rect x="80" y="65" width="48" height="19" rx="9.5" fill="${WHITE}" transform="rotate(-18 104 74)"/>
          <path d="M104 65 L104 84 L128 84 Q133 74.5 128 65 Z" fill="${CORAL}" transform="rotate(-18 104 74)"/>
        </g>
      </g>
    </g>
    <g class="layer-fg"><g class="in-1">${fgLeaves("right")}</g></g>
  `, "124 84 1.34"),

  // 3. Calendar / next appointment.
  calendar: svgWrap(`
    ${skyWash("g_cal", "#f6efe2", PAPER)}
    <g class="layer-bg"><g class="in-1">
      ${floor(168)}
    </g></g>
    <g class="layer-mid">
      <g class="in-1">${plant(48, 148, 1.1)}</g>
      <g class="in-2">
        <rect x="94" y="24" width="154" height="130" rx="12" fill="${WHITE}"/>
        <rect x="94" y="24" width="154" height="36" rx="12" fill="${CORAL}"/>
        <rect x="94" y="48" width="154" height="12" fill="${CORAL}"/>
        <rect x="126" y="14" width="8" height="18" rx="4" fill="${COAL}"/>
        <rect x="208" y="14" width="8" height="18" rx="4" fill="${COAL}"/>
        ${[0, 1, 2, 3].map((c) => [0, 1, 2].map((r) =>
          `<circle cx="${126 + c * 30}" cy="${82 + r * 26}" r="3.2" fill="${SKYB_D}"/>`
        ).join("")).join("")}
      </g>
      <g class="in-3">
        ${shadow(294, 176, 25)}
        ${figure({ x: 294, feetY: 172, h: 92, look: -1, armL: 16, armR: -92, outfit: "hero", cls: "anim-talk" })}
        <path d="M262 96 L252 104" stroke="${CORAL_D}" stroke-width="4.5"/>
      </g>
      <g class="in-4">
        <circle class="a-pulse" style="transform-origin:186px 108px" cx="186" cy="108" r="13" fill="none" stroke="${CORAL}" stroke-width="5"/>
      </g>
    </g>
    <g class="layer-fg"><g class="in-1">${fgLeaves("left")}</g></g>
  `, "186 104 1.34"),

  // 4. Blood test — calm clinic corner.
  blood_test: svgWrap(`
    ${skyWash("g_bt", "#eef4ef", PAPER)}
    <g class="layer-bg"><g class="in-1">
      <rect x="290" y="30" width="44" height="44" rx="10" fill="${WHITE}"/>
      <path d="M312 41 L312 63 M301 52 L323 52" stroke="${CORAL}" stroke-width="5.5" fill="none"/>
      ${floor(168)}
    </g></g>
    <g class="layer-mid">
      <g class="in-1">
        <rect x="38" y="136" width="170" height="9" rx="4" fill="#c9a37a"/>
        <rect x="50" y="145" width="9" height="32" fill="#b08a60"/>
        <rect x="188" y="145" width="9" height="32" fill="#b08a60"/>
      </g>
      <g class="in-2">
        <rect x="66" y="106" width="110" height="30" rx="6" fill="${PAPER_D}"/>
        <path d="M112 58 L112 120 Q112 134 124 134 Q136 134 136 120 L136 58" fill="${WHITE}"/>
        <g class="a-grow-y" style="transform-origin:124px 132px">
          <path d="M113 96 L135 96 L135 120 Q135 133 124 133 Q113 133 113 120 Z" fill="${CORAL}"/>
        </g>
        <rect x="105" y="52" width="38" height="8" rx="4" fill="${SKYB_D}"/>
      </g>
      <g class="in-3">
        ${shadow(268, 176, 26)}
        ${figure({ x: 268, feetY: 172, h: 98, look: -1, armL: 52, armR: -20, outfit: "nurse", cls: "anim-nod" })}
      </g>
      <g class="in-4">
        <path class="a-drip" d="M176 64 Q171.5 73 171 77 A5 5 0 1 0 181 77 Q180.5 73 176 64 Z" fill="${CORAL}"/>
        <circle class="a-flicker" cx="222" cy="66" r="2.8" fill="${CORAL}"/>
        <circle class="a-flicker" style="animation-delay:200ms" cx="233" cy="58" r="2.8" fill="${CORAL}"/>
      </g>
    </g>
    <g class="layer-fg"><g class="in-1">${fgLeaves("left")}</g></g>
  `, "126 100 1.34"),

  // 5. Drinking water.
  drinking_water: svgWrap(`
    ${skyWash("g_dw", "#e9f1f3", PAPER)}
    <g class="layer-bg"><g class="in-1">
      ${sun(316, 40, 15)}
      ${floor(168)}
    </g></g>
    <g class="layer-mid">
      <g class="in-2">
        ${shadow(112, 164, 34)}
        <path d="M74 44 L86 158 L138 158 L150 44 Z" fill="${WHITE}"/>
        <path d="M80 86 Q100 79 122 86 Q134 90 143 85 L138 158 L86 158 Z" fill="${SKYB}"/>
        <path d="M118 96 L146 20" stroke="${CORAL}" stroke-width="6"/>
      </g>
      <g class="in-3">
        ${shadow(252, 176, 26)}
        ${figure({ x: 252, feetY: 172, h: 98, look: -1, armL: 20, armR: -116, face: "open", outfit: "hero", cls: "anim-sip" })}
        <path d="M212 96 L216 116 L230 116 L234 96 Z" fill="${SKYB_D}" transform="rotate(14 223 106)"/>
      </g>
      <g class="in-4">
        <circle class="a-rise" style="animation-delay:0ms" cx="104" cy="130" r="4" fill="${WHITE}"/>
        <circle class="a-rise" style="animation-delay:700ms" cx="120" cy="142" r="4" fill="${WHITE}"/>
        <circle class="a-rise" style="animation-delay:1200ms" cx="112" cy="148" r="3" fill="${WHITE}"/>
      </g>
    </g>
    <g class="layer-fg"><g class="in-1">${fgLeaves("right")}</g></g>
  `, "114 84 1.3"),

  // 6. Walking — a stroll through the park.
  walking: svgWrap(`
    ${skyWash("g_walk", "#f7e9cd", "#fdf6e8")}
    <g class="layer-bg"><g class="in-1">
      ${sun(300, 40, 19)}
      ${cloud(70, 38, 1, 0)}
      ${cloud(180, 26, 0.8, 1200)}
      ${hill(50, 176, 150, 44, SAGE)}
      ${hill(310, 182, 160, 48, SAGE_M)}
      ${birds(84, 58, 0)}
      ${birds(128, 44, 900)}
    </g></g>
    <g class="layer-mid">
      <g class="in-1">
        ${tree(66, 168, 1.15)}
        <path d="M-2 178 Q120 170 200 176 T362 172 L362 206 L-2 206 Z" fill="#e9d9b8"/>
      </g>
      <g class="in-3">
        ${shadow(208, 176, 30)}
        ${figure({ x: 208, feetY: 172, h: 102, lean: 4, look: 1, armL: 30, armR: -30, legL: 20, legR: -20, outfit: "hero", cls: "anim-walk" })}
      </g>
      <g class="in-4">
        <path class="a-swoop" style="animation-delay:0ms" d="M148 88 L176 88" stroke="${GOLD_D}" stroke-width="4.5"/>
        <path class="a-swoop" style="animation-delay:150ms" d="M140 108 L168 108" stroke="${GOLD_D}" stroke-width="4.5"/>
        <path class="a-swoop" style="animation-delay:300ms" d="M148 128 L176 128" stroke="${GOLD_D}" stroke-width="4.5"/>
        <g class="a-scroll">
          <path d="M262 184 L286 184 M310 184 L334 184 M214 184 L238 184" stroke="${WHITE}" stroke-width="5" opacity="0.8"/>
        </g>
      </g>
    </g>
    <g class="layer-fg"><g class="in-1">${fgLeaves("left")}</g></g>
  `, "206 106 1.3"),

  // 7. Healthy plate of food.
  healthy_food: svgWrap(`
    ${skyWash("g_hf", "#f6efdf", PAPER)}
    <g class="layer-bg"><g class="in-1">
      <rect x="-2" y="140" width="364" height="66" fill="#c9a37a"/>
      <rect x="-2" y="140" width="364" height="8" fill="#dbb98f"/>
    </g></g>
    <g class="layer-mid">
      <g class="in-2">
        <ellipse cx="180" cy="122" rx="94" ry="30" fill="${WHITE}"/>
        <ellipse cx="180" cy="120" rx="72" ry="21" fill="${PAPER}"/>
      </g>
      <g class="in-3">
        <circle cx="142" cy="110" r="14" fill="${CORAL}"/>
        <circle cx="137" cy="105" r="4" fill="${WHITE}" opacity="0.5"/>
        <path d="M142 96 Q144 88 151 86" stroke="#6b4a2f" stroke-width="4" fill="none"/>
        <path d="M151 92 Q160 86 162 94 Q155 98 151 92" fill="${SAGE_M}"/>
        <g class="a-sway" style="transform-origin:214px 120px">
          <path d="M211 124 L217 124 L216 110 L212 110 Z" fill="#b5d1a8"/>
          <circle cx="206" cy="104" r="8" fill="${SAGE_D}"/>
          <circle cx="218" cy="100" r="9" fill="${SAGE_M}"/>
          <circle cx="226" cy="108" r="7" fill="${SAGE_D}"/>
        </g>
        <ellipse cx="180" cy="128" rx="20" ry="8" fill="${GOLD}"/>
      </g>
      <g class="in-4">
        <path d="M270 148 Q270 128 290 128 Q310 128 310 148 Z" fill="${SKYB_D}"/>
        <path class="a-steam" style="animation-delay:0ms" d="M282 118 Q278 108 284 100" stroke="${WHITE}" stroke-width="4" fill="none"/>
        <path class="a-steam" style="animation-delay:600ms" d="M298 118 Q302 108 296 100" stroke="${WHITE}" stroke-width="4" fill="none"/>
        <path d="M62 96 L62 138 M55 96 L55 112 M62 96 L62 112 M69 96 L69 112" stroke="${COAL}" stroke-width="4" fill="none"/>
        <path d="M322 104 Q328 120 322 140" stroke="${COAL}" stroke-width="4" fill="none"/>
      </g>
    </g>
  `, "182 116 1.3"),

  // 8. Heart / blood pressure — the beating centrepiece.
  heart: svgWrap(`
    ${skyWash("g_h", "#fae9e2", "#fbf2ea")}
    <g class="layer-bg"><g class="in-1">
      <circle class="a-ring" style="transform-origin:180px 100px" cx="180" cy="100" r="74" fill="none" stroke="${CORAL}" stroke-width="3" opacity="0.3"/>
      <circle class="a-ring" style="transform-origin:180px 100px;animation-delay:400ms" cx="180" cy="100" r="88" fill="none" stroke="${CORAL}" stroke-width="2.5" opacity="0.18"/>
    </g></g>
    <g class="layer-mid">
      <g class="in-2">
        <g class="a-heartbeat" style="transform-origin:180px 100px">
          <path d="M180 152 Q132 118 134 82 Q136 56 160 58 Q174 60 180 76 Q186 60 200 58 Q224 56 226 82 Q228 118 180 152 Z" fill="${CORAL}"/>
          <path d="M156 74 Q150 82 152 92" stroke="${WHITE}" stroke-width="5" opacity="0.5" fill="none"/>
        </g>
      </g>
      <g class="in-4">
        <path class="a-dash" d="M22 100 L120 100 L136 100 L150 70 L168 132 L184 100 L338 100" stroke="${INK}" stroke-width="5" fill="none" pathLength="100"/>
      </g>
    </g>
  `, "180 100 1.26"),

  // 9. Lungs / breathing.
  lungs: svgWrap(`
    ${skyWash("g_l", "#eaf2ee", "#f7f3e9")}
    <g class="layer-bg"><g class="in-1">
      ${cloud(60, 36, 0.9, 200)}
      ${cloud(300, 48, 0.8, 1100)}
    </g></g>
    <g class="layer-mid">
      <g class="in-2">
        <path d="M180 30 L180 74 M180 70 Q172 74 168 86 M180 70 Q188 74 192 86" stroke="#c98c86" stroke-width="7" fill="none"/>
        <g class="a-breathe" style="transform-origin:180px 130px">
          <path d="M166 80 C142 80 120 108 116 136 C112 162 126 178 146 174 C162 170 172 162 174 146 C176 130 173 110 172 94 C171 84 170 80 166 80 Z" fill="${CORAL}"/>
          <path d="M194 80 C218 80 240 108 244 136 C248 162 234 178 214 174 C198 170 188 162 186 146 C184 130 187 110 188 94 C189 84 190 80 194 80 Z" fill="${CORAL_D}"/>
          <path d="M136 106 Q128 120 128 138" stroke="${WHITE}" stroke-width="4" opacity="0.5" fill="none"/>
        </g>
      </g>
      <g class="in-4">
        <path class="a-shimmer" d="M138 52 Q130 42 138 32" stroke="${SKYB_D}" stroke-width="4.5" fill="none"/>
        <path class="a-shimmer" style="animation-delay:250ms" d="M222 52 Q230 42 222 32" stroke="${SKYB_D}" stroke-width="4.5" fill="none"/>
        <circle class="a-rise" style="animation-delay:200ms" cx="120" cy="60" r="2.5" fill="${SKYB_D}"/>
        <circle class="a-rise" style="animation-delay:900ms" cx="244" cy="64" r="2.5" fill="${SKYB_D}"/>
      </g>
    </g>
  `, "180 118 1.28"),

  // 10. Sleeping — the moonlit night scene.
  sleeping: svgWrap(`
    ${skyWash("g_sl", NIGHT_D, NIGHT)}
    <g class="layer-bg"><g class="in-1">
      <circle cx="308" cy="48" r="26" fill="${GOLD}" opacity="0.18"/>
      <path d="M300 32 A20 20 0 1 0 320 62 A15 15 0 0 1 300 32 Z" fill="${GOLD}"/>
      ${[[52, 30, 0], [96, 56, 400], [150, 26, 800], [230, 44, 200], [268, 22, 600]].map(([x, y, d]) =>
        `<path class="a-twinkle" style="animation-delay:${d}ms" d="M${x} ${y - 5} L${x} ${y + 5} M${x - 5} ${y} L${x + 5} ${y}" stroke="${CREAM}" stroke-width="3" opacity="0.8" fill="none"/>`
      ).join("")}
    </g></g>
    <g class="layer-mid">
      <g class="in-2">
        <rect x="56" y="148" width="248" height="10" rx="5" fill="#4d5480"/>
        <rect x="66" y="158" width="10" height="22" fill="#4d5480"/>
        <rect x="284" y="158" width="10" height="22" fill="#4d5480"/>
        <rect x="70" y="114" width="56" height="26" rx="12" fill="${CREAM}"/>
        <circle class="a-pulse-soft" style="transform-origin:322px 128px" cx="322" cy="128" r="16" fill="${GOLD}" opacity="0.3"/>
        <path d="M314 140 L330 140 L326 122 L318 122 Z M322 140 L322 150 M312 150 L332 150" stroke="${GOLD}" stroke-width="4" fill="none"/>
      </g>
      <g class="in-3">
        <circle cx="102" cy="120" r="15" fill="#4a3b30"/>
        <circle cx="103" cy="124" r="13.5" fill="#eab992"/>
        <path d="M96 124 q3 2.5 6 0 M105 124 q3 2.5 6 0" stroke="${INK}" stroke-width="2.2" fill="none"/>
        <g class="a-breathe" style="transform-origin:190px 148px">
          <path d="M122 148 Q134 116 172 122 L268 122 Q290 126 290 148 L122 148 Z" fill="${CORAL_D}"/>
          <path d="M122 148 Q134 116 172 122 L200 122 Q170 128 160 148 Z" fill="${CORAL}"/>
        </g>
      </g>
      <g class="in-4">
        <path class="a-float" style="animation-delay:0ms" d="M148 84 L170 84 L148 106 L170 106" stroke="${GOLD}" stroke-width="6" fill="none"/>
        <path class="a-float" style="animation-delay:600ms" d="M182 62 L196 62 L182 76 L196 76" stroke="${GOLD}" stroke-width="5" fill="none"/>
      </g>
    </g>
  `, "112 128 1.3"),

  // 11. Warning sign — watch for this, kindly.
  warning: svgWrap(`
    ${skyWash("g_w", "#faeede", PAPER)}
    <g class="layer-bg"><g class="in-1">
      <circle class="a-ring" style="transform-origin:150px 104px" cx="150" cy="104" r="86" fill="none" stroke="${CORAL}" stroke-width="3" opacity="0.25"/>
      ${floor(168)}
    </g></g>
    <g class="layer-mid">
      <g class="in-2">
        <g class="a-alert" style="transform-origin:150px 104px">
          <path d="M150 38 Q155 38 158 45 L214 146 Q219 158 205 160 L95 160 Q81 158 86 146 L142 45 Q145 38 150 38 Z" fill="${GOLD}"/>
          <path d="M150 74 L150 116" stroke="${INK}" stroke-width="9"/>
          <circle cx="150" cy="136" r="6" fill="${INK}"/>
        </g>
      </g>
      <g class="in-3">
        ${shadow(286, 176, 25)}
        ${figure({ x: 286, feetY: 172, h: 96, look: -1, armL: 14, armR: -76, outfit: "hero", cls: "anim-talk" })}
      </g>
    </g>
    <g class="layer-fg"><g class="in-1">${fgLeaves("left")}</g></g>
  `, "150 102 1.28"),

  // 12. Phone call — ringing the clinic.
  phone_call: svgWrap(`
    ${skyWash("g_pc", "#f6efe2", PAPER)}
    <g class="layer-bg"><g class="in-1">
      ${floor(168)}
      <rect x="240" y="52" width="90" height="104" rx="10" fill="${WHITE}"/>
      <rect x="240" y="52" width="90" height="26" rx="10" fill="${SKYB_D}"/>
      <rect x="240" y="68" width="90" height="10" fill="${SKYB_D}"/>
      <circle cx="285" cy="112" r="20" fill="${PAPER}"/>
      <path d="M285 100 L285 124 M273 112 L297 112" stroke="${CORAL}" stroke-width="6.5" fill="none"/>
    </g></g>
    <g class="layer-mid">
      <g class="in-3">
        ${shadow(96, 176, 26)}
        ${figure({ x: 96, feetY: 172, h: 100, look: 1, armL: 89, armR: -18, face: "open", outfit: "hero", cls: "anim-nod" })}
        <rect x="120" y="84" width="14" height="25" rx="5" fill="${COAL}" transform="rotate(-14 127 96)"/>
      </g>
      <g class="in-4">
        <path class="a-ring" style="transform-origin:170px 92px" d="M162 78 Q176 92 162 106" stroke="${CORAL}" stroke-width="4.5" fill="none"/>
        <path class="a-ring" style="transform-origin:186px 92px;animation-delay:200ms" d="M176 66 Q196 92 176 118" stroke="${CORAL}" stroke-width="4.5" fill="none"/>
        <path class="a-ring" style="transform-origin:202px 92px;animation-delay:400ms" d="M190 54 Q216 92 190 130" stroke="${CORAL}" stroke-width="4" fill="none"/>
      </g>
    </g>
    <g class="layer-fg"><g class="in-1">${fgLeaves("right")}</g></g>
  `, "116 92 1.32"),

  // 13. Question — something unclear.
  question: svgWrap(`
    ${skyWash("g_q", "#f6efe6", PAPER)}
    <g class="layer-bg"><g class="in-1">
      ${floor(168)}
    </g></g>
    <g class="layer-mid">
      <g class="in-3">
        ${shadow(122, 176, 27)}
        ${figure({ x: 122, feetY: 172, h: 102, look: 1, armL: 26, armR: -106, outfit: "hero", cls: "anim-nod" })}
      </g>
      <g class="in-4">
        <circle class="a-flicker" cx="160" cy="92" r="3.5" fill="${COAL}"/>
        <circle class="a-flicker" style="animation-delay:250ms" cx="176" cy="74" r="4.5" fill="${COAL}"/>
        <g class="a-bob" style="transform-origin:232px 78px">
          <path d="M206 62 Q205 32 234 31 Q262 32 261 60 Q260 78 242 85 Q233 88 233 100" stroke="${CORAL}" stroke-width="9" fill="none"/>
          <circle cx="233" cy="122" r="6.5" fill="${CORAL}"/>
        </g>
        <g class="a-bob" style="transform-origin:300px 56px;animation-delay:400ms">
          <path d="M288 48 Q288 34 302 34 Q315 34 314 47 Q314 56 304 60 Q300 62 300 68" stroke="${COAL}" stroke-width="5" opacity="0.5" fill="none"/>
          <circle cx="300" cy="80" r="3.5" fill="${COAL}" opacity="0.5"/>
        </g>
      </g>
    </g>
    <g class="layer-fg"><g class="in-1">${fgLeaves("left")}</g></g>
  `, "226 82 1.3"),

  // 14. Family — hand in hand in the park.
  family: svgWrap(`
    ${skyWash("g_f", "#f7e9cd", "#fdf6e8")}
    <g class="layer-bg"><g class="in-1">
      ${sun(48, 40, 17)}
      ${cloud(150, 30, 0.9, 600)}
      ${hill(80, 180, 150, 42, SAGE)}
      ${hill(300, 176, 140, 38, SAGE_M)}
      ${birds(288, 48, 300)}
    </g></g>
    <g class="layer-mid">
      <g class="in-1">${tree(330, 170, 0.95)}</g>
      <g class="in-3">
        ${shadow(122, 176, 26)}
        ${shadow(180, 176, 18)}
        ${shadow(240, 176, 26)}
        ${figure({ x: 122, feetY: 172, h: 100, look: 1, armL: 48, armR: -16, outfit: "hero", cls: "anim-nod" })}
        ${figure({ x: 180, feetY: 172, h: 64, look: 1, armL: 55, armR: -55, outfit: "child", cls: "anim-nod" })}
        ${figure({ x: 240, feetY: 172, h: 98, look: -1, armL: 16, armR: -48, outfit: "partner", cls: "anim-nod" })}
        <path d="M144.3 127.1 L164.3 141.4" stroke="#d9a06b" stroke-width="5"/>
        <path d="M218.2 128.0 L195.7 141.4" stroke="#d9a06b" stroke-width="5"/>
      </g>
      <g class="in-4">
        <g class="a-pulse" style="transform-origin:181px 52px">
          <path d="M181 68 Q160 54 166 38 Q170 26 181 34 Q192 26 196 38 Q202 54 181 68 Z" fill="${CORAL}"/>
        </g>
      </g>
    </g>
    <g class="layer-fg"><g class="in-1">${fgLeaves("left")}</g></g>
  `, "180 96 1.26"),

  // 15. Thumbs up — good news.
  thumbs_up: svgWrap(`
    ${skyWash("g_tu", "#f8efdc", PAPER)}
    <g class="layer-bg"><g class="in-1">
      ${sun(52, 42, 15)}
      ${floor(168)}
    </g></g>
    <g class="layer-mid">
      <g class="in-2">
        ${shadow(246, 176, 32)}
        <g class="a-bob" style="transform-origin:246px 110px">
          <rect x="206" y="102" width="22" height="46" rx="7" fill="${GOLD_D}"/>
          <rect x="234" y="102" width="54" height="46" rx="13" fill="${GOLD}"/>
          <path d="M234 108 Q227 84 240 68 Q249 58 256 68 Q260 76 252 88 Q246 96 248 102 L234 108 Z" fill="${GOLD}"/>
          <path d="M241 114 L281 114 M241 126 L281 126 M241 138 L281 138" stroke="${GOLD_D}" stroke-width="3.5" fill="none"/>
        </g>
      </g>
      <g class="in-3">
        ${shadow(118, 176, 27)}
        ${figure({ x: 118, feetY: 172, h: 100, look: 1, armL: 112, armR: -112, face: "open", outfit: "hero", cls: "anim-cheer" })}
      </g>
      <g class="in-4">
        <path class="a-flicker" style="animation-delay:0ms" d="M292 62 L300 52" stroke="${CORAL}" stroke-width="4.5"/>
        <path class="a-flicker" style="animation-delay:220ms" d="M268 44 L271 32" stroke="${CORAL}" stroke-width="4.5"/>
        <path class="a-flicker" style="animation-delay:440ms" d="M310 92 L322 86" stroke="${CORAL}" stroke-width="4.5"/>
        <path class="a-flicker" style="animation-delay:330ms" d="M170 52 L162 42" stroke="${GOLD_D}" stroke-width="4.5"/>
        <path class="a-flicker" style="animation-delay:110ms" d="M196 36 L200 24" stroke="${GOLD_D}" stroke-width="4.5"/>
      </g>
    </g>
    <g class="layer-fg"><g class="in-1">${fgLeaves("right")}</g></g>
  `, "234 108 1.3"),
};

// Look a picture up by ID. Unknown IDs get the question mark,
// so the player never shows a blank space.
function illustrationSVG(id) {
  return ILLUSTRATIONS[id] || ILLUSTRATIONS.question;
}
