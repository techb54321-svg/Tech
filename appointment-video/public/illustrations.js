// ============================================================
// illustrations.js — the built-in picture library.
//
// 15 hand-drawn scenes, drawn as SVG (vector) code. The AI can
// only pick picture IDs from this list — it never draws or
// invents images of its own.
//
// Each scene is a little widescreen "film still" (360 x 202):
// a background wash, a horizon, props, and stick-figure people
// with poseable, animated limbs. Small parts carry classes like
// "anim-walk" or "a-twinkle" — the movements live in styles.css
// and are switched off for people who ask their device for less
// motion.
//
// The shared palette (keep to these — it's what makes the scenes
// feel like one storybook):
//   INK    dark warm grey — every outline
//   ACCENT warm coral     — the emotional highlight of each scene
//   SAGE   soft green     — nature, food, calm things
//   GOLD   warm yellow    — sunlight, lamps, warmth
//   NIGHT  deep blue      — the sleeping scene's darkness
//   CREAM  warm paper     — light lines on dark scenes
// ============================================================

const INK = "#3a3330";
const ACCENT = "#e2574c";
const SAGE = "#93b8a2";
const GOLD = "#e9b95f";
const NIGHT = "#333a63";
const CREAM = "#f6ead6";

// Wrap a scene in an <svg> tag with our shared "marker pen" style.
function svgWrap(inner) {
  return (
    `<svg viewBox="0 0 360 202" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid slice">` +
    `<g fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">` +
    inner +
    `</g></svg>`
  );
}

// ---- Scene-building helpers ----------------------------------------

// A soft colour wash across the whole frame.
const wash = (color, opacity = 1) =>
  `<rect x="-2" y="-2" width="364" height="206" fill="${color}" opacity="${opacity}" stroke="none"/>`;

// A warm sun (or any glowing disc), gently swelling.
const sun = (x, y, r = 20, color = GOLD) =>
  `<circle class="a-pulse-soft" style="transform-origin:${x}px ${y}px" cx="${x}" cy="${y}" r="${r}" fill="${color}" fill-opacity="0.8" stroke="none"/>`;

// A distant soft hill.
const hill = (cx, cy, rx, ry, opacity = 0.35) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${SAGE}" fill-opacity="${opacity}" stroke="none"/>`;

// The wobbly ground line every outdoor scene stands on.
const ground = (y = 172) =>
  `<path d="M14 ${y} Q120 ${y + 5} 200 ${y} T346 ${y}" stroke-width="5" opacity="0.55"/>`;

// A pair of far-away birds.
const birds = (x, y, delay = 0) =>
  `<g class="a-drift" style="animation-delay:${delay}ms">` +
  `<path d="M${x} ${y} q5 -6 10 0 q5 -6 10 0" stroke-width="3.5" opacity="0.6"/>` +
  `</g>`;

// A leafy pot plant (clinics and kitchens both approve).
const plant = (x, y) =>
  `<g>` +
  `<path d="M${x - 11} ${y} L${x + 11} ${y} L${x + 8} ${y + 18} L${x - 8} ${y + 18} Z" stroke-width="5"/>` +
  `<g class="a-sway" style="transform-origin:${x}px ${y}px">` +
  `<path d="M${x} ${y} Q${x - 14} ${y - 18} ${x - 6} ${y - 30}" stroke="${SAGE}" stroke-width="5"/>` +
  `<path d="M${x} ${y} Q${x + 4} ${y - 22} ${x + 12} ${y - 28}" stroke="${SAGE}" stroke-width="5"/>` +
  `<path d="M${x} ${y} Q${x - 2} ${y - 16} ${x - 14} ${y - 14}" stroke="${SAGE}" stroke-width="5"/>` +
  `</g></g>`;

// ---- The stick-person rig ------------------------------------------
// Draws a friendly stick person from a handful of numbers, with each
// limb in its own group so styles.css can swing it around its joint.
//
//   x, feetY  where they stand      h     height (~92)
//   lean      body tilt in px       look  -1 left, 0 ahead, 1 right
//   armL/armR angle from straight-down, in degrees (+ is to the right)
//   legL/legR same for legs
//   face      "smile" | "open" (talking) | "sleep" | "none"
//   cls       animation class, e.g. "anim-walk", "anim-talk"
//   color/sw  stroke colour and width (dark scenes pass CREAM)
function person(o) {
  const {
    x, feetY, h = 92, lean = 0, look = 0,
    armL = 18, armR = -18, legL = 9, legR = -9,
    face = "smile", cls = "", color = INK, sw = 6,
  } = o;
  const hipY = feetY - h * 0.44;
  const shoY = feetY - h * 0.72;
  const headR = h * 0.15;
  const shoX = x + lean;
  const headX = shoX + lean * 0.5 + look * headR * 0.2;
  const headY = shoY - headR - h * 0.05;
  const armLen = h * 0.34;
  const legLen = h * 0.45;
  const pt = (px, py, ang, len) => {
    const r = (ang * Math.PI) / 180;
    return [(px + Math.sin(r) * len).toFixed(1), (py + Math.cos(r) * len).toFixed(1)];
  };
  const [alx, aly] = pt(shoX, shoY, armL, armLen);
  const [arx, ary] = pt(shoX, shoY, armR, armLen);
  const [llx, lly] = pt(x, hipY, legL, legLen);
  const [lrx, lry] = pt(x, hipY, legR, legLen);

  // Face marks, nudged toward wherever they're looking. Eye spacing
  // shrinks with the head, so small heads (children) keep their eyes
  // inside the outline.
  const fx = headX + look * headR * 0.4;
  const fy = headY + headR * 0.1;
  const eyeDX = Math.min(4.5, headR * 0.42);
  let faceMarks = "";
  if (face === "smile") {
    faceMarks =
      `<circle cx="${(fx - eyeDX).toFixed(1)}" cy="${(fy - 2).toFixed(1)}" r="1.8" fill="${color}" stroke="none"/>` +
      `<circle cx="${(fx + eyeDX).toFixed(1)}" cy="${(fy - 2).toFixed(1)}" r="1.8" fill="${color}" stroke="none"/>` +
      `<path d="M${(fx - 5).toFixed(1)} ${(fy + 3).toFixed(1)} Q${fx.toFixed(1)} ${(fy + 7.5).toFixed(1)} ${(fx + 5).toFixed(1)} ${(fy + 3).toFixed(1)}" stroke-width="3"/>`;
  } else if (face === "open") {
    faceMarks =
      `<circle cx="${(fx - eyeDX).toFixed(1)}" cy="${(fy - 2).toFixed(1)}" r="1.8" fill="${color}" stroke="none"/>` +
      `<circle cx="${(fx + eyeDX).toFixed(1)}" cy="${(fy - 2).toFixed(1)}" r="1.8" fill="${color}" stroke="none"/>` +
      `<ellipse cx="${fx.toFixed(1)}" cy="${(fy + 4.5).toFixed(1)}" rx="2.6" ry="3.4" stroke-width="3"/>`;
  } else if (face === "sleep") {
    faceMarks =
      `<path d="M${(fx - 7).toFixed(1)} ${fy.toFixed(1)} q3 2.5 6 0" stroke-width="2.5"/>` +
      `<path d="M${(fx + 1).toFixed(1)} ${fy.toFixed(1)} q3 2.5 6 0" stroke-width="2.5"/>`;
  }

  return (
    `<g class="p-all ${cls}" style="transform-origin:${x}px ${feetY}px" stroke="${color}" stroke-width="${sw}">` +
    `<g class="p-legL" style="transform-origin:${x}px ${hipY.toFixed(1)}px"><path d="M${x} ${hipY.toFixed(1)} L${llx} ${lly}"/></g>` +
    `<g class="p-legR" style="transform-origin:${x}px ${hipY.toFixed(1)}px"><path d="M${x} ${hipY.toFixed(1)} L${lrx} ${lry}"/></g>` +
    `<path d="M${x} ${hipY.toFixed(1)} L${shoX.toFixed(1)} ${shoY.toFixed(1)}"/>` +
    `<g class="p-armL" style="transform-origin:${shoX.toFixed(1)}px ${shoY.toFixed(1)}px"><path d="M${shoX.toFixed(1)} ${shoY.toFixed(1)} L${alx} ${aly}"/></g>` +
    `<g class="p-armR" style="transform-origin:${shoX.toFixed(1)}px ${shoY.toFixed(1)}px"><path d="M${shoX.toFixed(1)} ${shoY.toFixed(1)} L${arx} ${ary}"/></g>` +
    `<g class="p-head" style="transform-origin:${shoX.toFixed(1)}px ${shoY.toFixed(1)}px">` +
    `<circle cx="${headX.toFixed(1)}" cy="${headY.toFixed(1)}" r="${headR.toFixed(1)}"/>` +
    faceMarks +
    `</g>` +
    `</g>`
  );
}

// ============================================================
// The 15 scenes
// ============================================================
const ILLUSTRATIONS = {

  // 1. Doctor and patient talking — a warm little clinic room.
  doctor_patient: svgWrap(`
    ${wash("#fbf5ea")}
    <!-- window with sunshine -->
    <rect x="276" y="28" width="64" height="80" rx="6" stroke-width="5"/>
    <path d="M308 28 L308 108 M276 68 L340 68" stroke-width="4" opacity="0.7"/>
    ${sun(324, 46, 12)}
    <!-- eye chart on the wall -->
    <rect x="36" y="34" width="44" height="58" rx="4" stroke-width="4.5"/>
    <path d="M48 50 L68 50 M52 64 L64 64 M55 78 L61 78" stroke-width="3.5" opacity="0.7"/>
    ${plant(122, 150)}
    <!-- floor -->
    <path d="M14 172 Q180 178 346 172" stroke-width="5" opacity="0.55"/>
    <!-- the doctor, explaining -->
    ${person({ x: 176, feetY: 170, h: 96, look: 1, armL: 12, armR: -62, face: "open", cls: "anim-talk" })}
    <!-- stethoscope, hanging from the neck onto the chest -->
    <path d="M171 103 Q165 113 171 121" stroke="${ACCENT}" stroke-width="4.5"/>
    <circle cx="173" cy="125" r="4" stroke="${ACCENT}" stroke-width="4.5"/>
    <!-- the patient, listening and nodding -->
    ${person({ x: 258, feetY: 170, h: 92, look: -1, armL: 50, armR: -14, cls: "anim-nod" })}
    <!-- the conversation between them -->
    <g class="a-bob" style="transform-origin:217px 62px">
      <path d="M196 52 Q217 40 238 52 Q246 62 236 70 Q222 76 206 72 L196 80 L200 70 Q188 62 196 52"/>
      <circle class="a-flicker" style="animation-delay:0ms" cx="209" cy="60" r="2.6" fill="${ACCENT}" stroke="none"/>
      <circle class="a-flicker" style="animation-delay:180ms" cx="218" cy="60" r="2.6" fill="${ACCENT}" stroke="none"/>
      <circle class="a-flicker" style="animation-delay:360ms" cx="227" cy="60" r="2.6" fill="${ACCENT}" stroke="none"/>
    </g>
  `),

  // 2. Taking a tablet — morning kitchen, one tablet, a big glass of water.
  taking_tablet: svgWrap(`
    ${wash("#fbf5ea")}
    <rect x="34" y="28" width="64" height="74" rx="6" stroke-width="5"/>
    <path d="M66 28 L66 102 M34 65 L98 65" stroke-width="4" opacity="0.7"/>
    ${sun(66, 47, 11)}
    <!-- kitchen counter -->
    <path d="M232 132 L346 132" stroke-width="5"/>
    <path d="M244 132 L244 172 M334 132 L334 172" stroke-width="5" opacity="0.8"/>
    <!-- big friendly glass of water on the counter -->
    <path d="M282 96 L286 130 L306 130 L310 96" stroke-width="5"/>
    <path class="a-shimmer" d="M285 108 Q296 103 307 108" stroke="${ACCENT}" stroke-width="4"/>
    <circle class="a-rise" cx="296" cy="122" r="2.6" stroke="${ACCENT}" stroke-width="3"/>
    <!-- the person, facing the tablet, hand rising to mouth -->
    ${person({ x: 150, feetY: 170, h: 98, look: -1, armL: 24, armR: -120, legL: 7, legR: -7, face: "open", cls: "anim-sip" })}
    <!-- the tablet, big and clear, right where the hand is heading -->
    <g class="a-bob" style="transform-origin:104px 76px">
      <rect x="80" y="67" width="48" height="19" rx="9.5" transform="rotate(-18 104 76)"/>
      <path d="M104 69 L104 85" transform="rotate(-18 104 76)" stroke="${ACCENT}" stroke-width="4.5"/>
    </g>
    ${ground()}
  `),

  // 3. Calendar / next appointment.
  calendar: svgWrap(`
    ${wash("#fbf5ea")}
    <!-- the calendar on the wall -->
    <rect x="96" y="26" width="150" height="126" rx="10"/>
    <path d="M96 60 L246 60"/>
    <path d="M130 26 L130 12 M212 26 L212 12" stroke-width="5"/>
    <rect x="96" y="26" width="150" height="34" rx="10" fill="${ACCENT}" fill-opacity="0.16" stroke="none"/>
    ${[0, 1, 2, 3].map((c) => [0, 1, 2].map((r) =>
      `<circle cx="${126 + c * 30}" cy="${80 + r * 26}" r="3" fill="${INK}" stroke="none" opacity="0.75"/>`
    ).join("")).join("")}
    <circle class="a-pulse" style="transform-origin:186px 106px" cx="186" cy="106" r="12.5" stroke="${ACCENT}" stroke-width="5"/>
    <!-- someone marking the big day -->
    ${person({ x: 292, feetY: 170, h: 90, look: -1, armL: 16, armR: -95, cls: "anim-talk" })}
    <path d="M262 96 L252 104" stroke="${ACCENT}" stroke-width="4.5"/>
    ${plant(46, 150)}
    ${ground()}
  `),

  // 4. Blood test — calm clinic table, tube filling, one drop.
  blood_test: svgWrap(`
    ${wash("#fbf5ea")}
    <!-- first-aid plaque on the wall -->
    <rect x="292" y="34" width="40" height="40" rx="8" stroke-width="4.5"/>
    <path d="M312 44 L312 64 M302 54 L322 54" stroke="${ACCENT}" stroke-width="5"/>
    <!-- clinic table -->
    <path d="M40 140 L206 140" stroke-width="5"/>
    <path d="M54 140 L54 176 M192 140 L192 176" stroke-width="5" opacity="0.8"/>
    <!-- rack -->
    <path d="M70 140 L70 108 L172 108 L172 140" stroke-width="5" opacity="0.85"/>
    <!-- the test tube, big and centre-stage, its label a little heart -->
    <path d="M112 62 L112 122 Q112 138 124 138 Q136 138 136 122 L136 62"/>
    <path d="M105 62 L143 62"/>
    <g class="a-grow-y" style="transform-origin:124px 136px">
      <path d="M113 100 L135 100 L135 122 Q135 137 124 137 Q113 137 113 122 Z" fill="${ACCENT}" fill-opacity="0.5" stroke="none"/>
    </g>
    <!-- a single drop beside it -->
    <path class="a-drip" d="M176 66 Q171.5 75 171 79 A5 5 0 1 0 181 79 Q180.5 75 176 66 Z" stroke="${ACCENT}" stroke-width="4"/>
    <!-- the nurse, reassuring -->
    ${person({ x: 268, feetY: 170, h: 96, look: -1, armL: 55, armR: -20, cls: "anim-nod" })}
    <!-- stethoscope, hanging from the neck onto the chest -->
    <path d="M263 105 Q257 115 263 123" stroke="${ACCENT}" stroke-width="4.5"/>
    <circle cx="265" cy="127" r="4" stroke="${ACCENT}" stroke-width="4.5"/>
    <!-- kind words, floating between nurse and tube -->
    <circle class="a-flicker" cx="222" cy="68" r="2.6" fill="${ACCENT}" stroke="none"/>
    <circle class="a-flicker" style="animation-delay:200ms" cx="233" cy="60" r="2.6" fill="${ACCENT}" stroke="none"/>
    ${ground()}
  `),

  // 5. Drinking water.
  drinking_water: svgWrap(`
    ${wash("#fbf5ea")}
    ${sun(318, 40, 16)}
    <!-- the big glass -->
    <path d="M74 44 L86 156 L138 156 L150 44 Z"/>
    <path class="a-shimmer" d="M84 84 Q100 78 112 84 Q126 90 140 84" stroke="${ACCENT}" stroke-width="5"/>
    <circle class="a-rise" style="animation-delay:0ms" cx="104" cy="130" r="4" stroke="${ACCENT}" stroke-width="4"/>
    <circle class="a-rise" style="animation-delay:700ms" cx="120" cy="140" r="4" stroke="${ACCENT}" stroke-width="4"/>
    <circle class="a-rise" style="animation-delay:1200ms" cx="112" cy="146" r="3" stroke="${ACCENT}" stroke-width="3.5"/>
    <!-- the straw reaches right down into the water -->
    <path d="M118 96 L146 18" stroke-width="5"/>
    <!-- happy drinker raising their own cup -->
    ${person({ x: 252, feetY: 170, h: 96, look: -1, armL: 20, armR: -118, face: "open", cls: "anim-sip" })}
    <path d="M212 96 L216 118 L230 118 L234 96 Z" stroke-width="4.5" transform="rotate(14 223 107)"/>
    ${ground()}
  `),

  // 6. Walking — a real stroll through the park.
  walking: svgWrap(`
    ${wash("#fbf5ea")}
    ${sun(306, 42, 20)}
    ${hill(60, 158, 120, 34, 0.25)}
    ${hill(300, 162, 130, 36, 0.2)}
    ${birds(52, 52, 0)}
    ${birds(96, 38, 900)}
    <!-- a tree, swaying a little -->
    <path d="M68 170 L68 122" stroke-width="6"/>
    <g class="a-sway" style="transform-origin:68px 124px">
      <path d="M46 122 Q40 96 62 94 Q64 74 86 80 Q104 78 100 100 Q112 110 92 120 Q74 128 46 122 Z" fill="${SAGE}" fill-opacity="0.45" stroke-width="5"/>
    </g>
    <!-- the walker, mid-stride -->
    ${person({ x: 208, feetY: 168, h: 100, lean: 4, look: 1, armL: 30, armR: -30, legL: 20, legR: -20, cls: "anim-walk" })}
    <!-- breeze lines sweeping past the walker -->
    <path class="a-swoop" style="animation-delay:0ms" d="M150 88 L178 88" stroke="${ACCENT}" stroke-width="4.5"/>
    <path class="a-swoop" style="animation-delay:150ms" d="M142 108 L170 108" stroke="${ACCENT}" stroke-width="4.5"/>
    <path class="a-swoop" style="animation-delay:300ms" d="M150 128 L178 128" stroke="${ACCENT}" stroke-width="4.5"/>
    ${ground(168)}
    <!-- path dashes sliding underfoot -->
    <g class="a-scroll">
      <path d="M262 180 L286 180 M310 180 L334 180 M214 180 L238 180" stroke-width="4" opacity="0.4"/>
    </g>
  `),

  // 7. Healthy plate of food.
  healthy_food: svgWrap(`
    ${wash("#fbf5ea")}
    <!-- table -->
    <path d="M28 150 L332 150" stroke-width="5"/>
    <path d="M52 150 L44 186 M308 150 L316 186" stroke-width="5" opacity="0.8"/>
    <!-- the plate, generous, sitting on the table -->
    <ellipse cx="180" cy="122" rx="92" ry="27"/>
    <ellipse cx="180" cy="122" rx="66" ry="17" stroke-width="3.5" opacity="0.45"/>
    <!-- apple -->
    <circle cx="142" cy="112" r="13" stroke="${ACCENT}" fill="${ACCENT}" fill-opacity="0.25"/>
    <path d="M142 99 Q144 91 151 89" stroke-width="4"/>
    <!-- broccoli -->
    <g class="a-sway" style="transform-origin:214px 122px">
      <path d="M214 126 L214 110" stroke-width="4.5"/>
      <path d="M202 110 Q198 98 208 98 Q210 88 220 92 Q230 90 228 100 Q236 106 224 110 Z" stroke-width="4.5" fill="${SAGE}" fill-opacity="0.4"/>
    </g>
    <!-- steam rising from the fresh bowl resting on the table -->
    <path d="M270 150 Q270 132 290 132 Q310 132 310 150 Z" stroke-width="4.5"/>
    <path class="a-steam" style="animation-delay:0ms" d="M282 122 Q278 112 284 104" stroke-width="3.5" opacity="0.5"/>
    <path class="a-steam" style="animation-delay:600ms" d="M298 122 Q302 112 296 104" stroke-width="3.5" opacity="0.5"/>
    <!-- fork and knife -->
    <path d="M62 96 L62 140 M55 96 L55 112 M62 96 L62 112 M69 96 L69 112" stroke-width="4"/>
    <path d="M322 108 Q328 124 322 144" stroke-width="4"/>
  `),

  // 8. Heart / blood pressure — the beating centrepiece.
  heart: svgWrap(`
    ${wash("#fbf5ea")}
    <circle class="a-ring" style="transform-origin:180px 100px" cx="180" cy="100" r="74" stroke="${ACCENT}" stroke-width="3" opacity="0.3"/>
    <circle class="a-ring" style="transform-origin:180px 100px;animation-delay:400ms" cx="180" cy="100" r="88" stroke="${ACCENT}" stroke-width="2.5" opacity="0.18"/>
    <g class="a-heartbeat" style="transform-origin:180px 100px">
      <path d="M180 152 Q132 118 134 82 Q136 56 160 58 Q174 60 180 76 Q186 60 200 58 Q224 56 226 82 Q228 118 180 152 Z" stroke="${ACCENT}" stroke-width="7" fill="${ACCENT}" fill-opacity="0.14"/>
    </g>
    <!-- the pulse line travelling right across the frame -->
    <path class="a-dash" d="M22 100 L120 100 L136 100 L150 70 L168 132 L184 100 L338 100" stroke-width="5" pathLength="100"/>
  `),

  // 9. Lungs / breathing.
  lungs: svgWrap(`
    ${wash("#fbf5ea")}
    ${hill(50, 30, 110, 30, 0.14)}
    <path d="M180 30 L180 74"/>
    <path d="M180 72 Q173 76 169 86 M180 72 Q187 76 191 86"/>
    <g class="a-breathe" style="transform-origin:180px 130px">
      <path d="M166 80 C142 80 120 108 116 136 C112 162 126 178 146 174 C162 170 172 162 174 146 C176 130 173 110 172 94 C171 84 170 80 166 80 Z" stroke-width="6" fill="${ACCENT}" fill-opacity="0.18"/>
      <path d="M194 80 C218 80 240 108 244 136 C248 162 234 178 214 174 C198 170 188 162 186 146 C184 130 187 110 188 94 C189 84 190 80 194 80 Z" stroke-width="6" fill="${ACCENT}" fill-opacity="0.18"/>
    </g>
    <!-- air drifting in with each breath -->
    <path class="a-shimmer" d="M138 52 Q130 42 138 32" stroke="${ACCENT}" stroke-width="4.5"/>
    <path class="a-shimmer" style="animation-delay:250ms" d="M222 52 Q230 42 222 32" stroke="${ACCENT}" stroke-width="4.5"/>
    <circle class="a-rise" style="animation-delay:200ms" cx="120" cy="60" r="2.5" stroke="${ACCENT}" stroke-width="3"/>
    <circle class="a-rise" style="animation-delay:900ms" cx="244" cy="64" r="2.5" stroke="${ACCENT}" stroke-width="3"/>
  `),

  // 10. Sleeping — the one night scene, moonlit and quiet.
  sleeping: svgWrap(`
    ${wash(NIGHT)}
    <!-- moon and stars -->
    <path d="M300 34 A22 22 0 1 0 322 66 A17 17 0 0 1 300 34 Z" fill="${GOLD}" fill-opacity="0.85" stroke="none"/>
    ${[[52, 30, 0], [96, 56, 400], [150, 26, 800], [230, 44, 200], [268, 22, 600]].map(([x, y, d]) =>
      `<path class="a-twinkle" style="animation-delay:${d}ms" d="M${x} ${y - 5} L${x} ${y + 5} M${x - 5} ${y} L${x + 5} ${y}" stroke="${CREAM}" stroke-width="3" opacity="0.8"/>`
    ).join("")}
    <g stroke="${CREAM}">
      <!-- the bed -->
      <path d="M56 152 L304 152"/>
      <path d="M70 152 L70 176 M290 152 L290 176"/>
      <rect x="72" y="116" width="52" height="24" rx="11" stroke-width="5"/>
      <!-- our sleeper -->
      <circle cx="102" cy="122" r="14"/>
      <path d="M95 123 q3.5 3 7 0 M104 123 q3.5 3 7 0" stroke-width="2.5"/>
      <!-- the blanket, rising and falling with each breath -->
      <g class="a-breathe" style="transform-origin:190px 150px">
        <path d="M124 152 Q136 120 172 126 L266 126 Q288 130 288 152" stroke-width="6" fill="${CREAM}" fill-opacity="0.1"/>
      </g>
    </g>
    <!-- warm lamp glow -->
    <circle class="a-pulse-soft" style="transform-origin:322px 132px" cx="322" cy="132" r="14" fill="${GOLD}" fill-opacity="0.35" stroke="none"/>
    <path d="M314 142 L330 142 L326 124 L318 124 Z M322 142 L322 152 M312 152 L332 152" stroke="${CREAM}" stroke-width="4"/>
    <!-- Zzz drifting up -->
    <path class="a-float" style="animation-delay:0ms" d="M148 84 L170 84 L148 106 L170 106" stroke="${ACCENT}" stroke-width="6"/>
    <path class="a-float" style="animation-delay:600ms" d="M182 62 L196 62 L182 76 L196 76" stroke="${ACCENT}" stroke-width="5"/>
  `),

  // 11. Warning sign — something to watch for, taken seriously but kindly.
  warning: svgWrap(`
    ${wash("#fbf5ea")}
    <circle class="a-ring" style="transform-origin:150px 104px" cx="150" cy="104" r="86" stroke="${ACCENT}" stroke-width="3" opacity="0.25"/>
    <g class="a-alert" style="transform-origin:150px 104px">
      <path d="M150 40 Q154 40 157 46 L212 146 Q216 156 204 158 L96 158 Q84 156 88 146 L143 46 Q146 40 150 40 Z" stroke="${ACCENT}" stroke-width="7" fill="${ACCENT}" fill-opacity="0.12"/>
      <path d="M150 76 L150 114" stroke-width="8"/>
      <circle cx="150" cy="134" r="5.5" fill="${INK}" stroke="none"/>
    </g>
    <!-- someone pointing it out, calmly -->
    ${person({ x: 286, feetY: 170, h: 94, look: -1, armL: 14, armR: -78, cls: "anim-talk" })}
    ${ground()}
  `),

  // 12. Phone call — ringing the clinic.
  phone_call: svgWrap(`
    ${wash("#fbf5ea")}
    <!-- the caller, phone held up to their ear -->
    ${person({ x: 96, feetY: 170, h: 98, look: 1, armL: 91, armR: -18, face: "open", cls: "anim-nod" })}
    <rect x="119" y="86" width="13" height="24" rx="4" stroke-width="4.5" transform="rotate(-14 125 98)"/>
    <!-- the ringing, travelling across -->
    <path class="a-ring" style="transform-origin:170px 92px" d="M162 78 Q176 92 162 106" stroke="${ACCENT}" stroke-width="4.5"/>
    <path class="a-ring" style="transform-origin:186px 92px;animation-delay:200ms" d="M176 66 Q196 92 176 118" stroke="${ACCENT}" stroke-width="4.5"/>
    <path class="a-ring" style="transform-origin:202px 92px;animation-delay:400ms" d="M190 54 Q216 92 190 130" stroke="${ACCENT}" stroke-width="4"/>
    <!-- the clinic answering -->
    <rect x="242" y="58" width="84" height="98" rx="8" stroke-width="5"/>
    <path d="M242 84 L326 84" stroke-width="4" opacity="0.7"/>
    <path d="M276 66 L292 66" stroke="${ACCENT}" stroke-width="5"/>
    <path d="M284 108 L284 132 M272 120 L296 120" stroke="${ACCENT}" stroke-width="6"/>
    ${ground()}
  `),

  // 13. Question mark / something unclear.
  question: svgWrap(`
    ${wash("#fbf5ea")}
    <!-- the puzzled thinker, hand to chin -->
    ${person({ x: 122, feetY: 170, h: 100, look: 1, armL: 26, armR: -108, cls: "anim-nod" })}
    <!-- thought bubbles up to the big question -->
    <circle class="a-flicker" cx="160" cy="92" r="3.5" stroke-width="4"/>
    <circle class="a-flicker" style="animation-delay:250ms" cx="176" cy="74" r="4.5" stroke-width="4"/>
    <!-- one big gentle question, with smaller echoes -->
    <g class="a-bob" style="transform-origin:232px 78px">
      <path d="M206 62 Q205 32 234 31 Q262 32 261 60 Q260 78 242 85 Q233 88 233 100" stroke="${ACCENT}" stroke-width="8"/>
      <circle cx="233" cy="122" r="6" fill="${ACCENT}" stroke="none"/>
    </g>
    <g class="a-bob" style="transform-origin:300px 56px;animation-delay:400ms">
      <path d="M288 48 Q288 34 302 34 Q315 34 314 47 Q314 56 304 60 Q300 62 300 68" stroke-width="5" opacity="0.55"/>
      <circle cx="300" cy="80" r="3.5" fill="${INK}" stroke="none" opacity="0.55"/>
    </g>
    ${ground()}
  `),

  // 14. Family — walking together, hand in hand.
  family: svgWrap(`
    ${wash("#fbf5ea")}
    ${sun(48, 42, 18)}
    ${hill(80, 162, 130, 34, 0.22)}
    ${hill(300, 158, 120, 30, 0.25)}
    ${birds(292, 44, 300)}
    <!-- adult, child, adult — inner arms angled down toward the child -->
    ${person({ x: 122, feetY: 170, h: 98, look: 1, armL: 48, armR: -16, cls: "anim-nod" })}
    ${person({ x: 180, feetY: 170, h: 62, look: 1, armL: 55, armR: -55, cls: "anim-nod" })}
    ${person({ x: 240, feetY: 170, h: 96, look: -1, armL: 16, armR: -48, cls: "anim-nod" })}
    <!-- the held hands: short strokes joining each pair of arm ends -->
    <path d="M146.8 121.7 L162.7 137.5" stroke-width="5"/>
    <path d="M215.8 122.7 L197.3 137.5" stroke-width="5"/>
    <!-- a shared heart above -->
    <g class="a-pulse" style="transform-origin:181px 52px">
      <path d="M181 68 Q160 54 166 38 Q170 26 181 34 Q192 26 196 38 Q202 54 181 68 Z" stroke="${ACCENT}" stroke-width="5.5" fill="${ACCENT}" fill-opacity="0.15"/>
    </g>
    ${ground()}
  `),

  // 15. Thumbs up — good news, small celebration.
  thumbs_up: svgWrap(`
    ${wash("#fbf5ea")}
    ${sun(52, 44, 16)}
    <!-- the celebrator, arms up and wide of the head -->
    ${person({ x: 118, feetY: 170, h: 98, look: 1, armL: 112, armR: -112, face: "open", cls: "anim-cheer" })}
    <!-- the big thumb -->
    <g class="a-bob" style="transform-origin:246px 110px">
      <rect x="206" y="102" width="22" height="46" rx="6" stroke-width="5.5"/>
      <rect x="234" y="102" width="54" height="46" rx="12" stroke-width="5.5"/>
      <path d="M241 114 L281 114 M241 126 L281 126 M241 138 L281 138" stroke-width="3.5" opacity="0.6"/>
      <path d="M234 108 Q227 84 240 68 Q249 58 256 68 Q260 76 252 88 Q246 96 248 102" stroke-width="5.5"/>
    </g>
    <!-- confetti sparks -->
    <path class="a-flicker" style="animation-delay:0ms" d="M292 62 L300 52" stroke="${ACCENT}" stroke-width="4.5"/>
    <path class="a-flicker" style="animation-delay:220ms" d="M268 44 L271 32" stroke="${ACCENT}" stroke-width="4.5"/>
    <path class="a-flicker" style="animation-delay:440ms" d="M310 92 L322 86" stroke="${ACCENT}" stroke-width="4.5"/>
    <path class="a-flicker" style="animation-delay:330ms" d="M170 52 L162 42" stroke="${GOLD}" stroke-width="4.5"/>
    <path class="a-flicker" style="animation-delay:110ms" d="M196 36 L200 24" stroke="${GOLD}" stroke-width="4.5"/>
    ${ground()}
  `),
};

// Look a picture up by ID. Unknown IDs get the question mark,
// so the player never shows a blank space.
function illustrationSVG(id) {
  return ILLUSTRATIONS[id] || ILLUSTRATIONS.question;
}
