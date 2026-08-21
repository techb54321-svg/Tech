// ============================================================
// illustrations.js — the built-in picture library.
//
// 15 hand-drawn stick-figure scenes, drawn as SVG (vector) code.
// The AI can only pick picture IDs from this list — it never
// draws or invents images of its own.
//
// All pictures share one style: thick dark "marker" lines with
// one warm accent colour, on a 200 x 200 canvas. Small parts of
// each drawing carry a class like "a-pulse" or "a-float" — those
// are idle animations defined once in styles.css (heartbeat,
// breathing, drifting sleep, and so on), so the pictures feel
// alive instead of frozen. People who ask for less motion never
// see them move — see the prefers-reduced-motion rule in styles.css.
// ============================================================

const INK = "#3a3330";     // main line colour (dark warm grey)
const ACCENT = "#e2574c";  // the single accent colour (warm red)

// Wrap the drawing in an <svg> tag with our shared "marker pen" style.
function svgWrap(inner) {
  return (
    `<svg viewBox="0 0 200 200" role="img" aria-hidden="true">` +
    `<g fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">` +
    inner +
    `</g></svg>`
  );
}

// A gentle curved ground line used in several scenes.
const GROUND = `<path d="M30 172 Q100 179 170 172" stroke-width="5" opacity="0.5"/>`;

const ILLUSTRATIONS = {
  // 1. Doctor and patient talking ------------------------------------
  doctor_patient: svgWrap(`
    <!-- doctor (left) -->
    <circle cx="55" cy="66" r="14"/>
    <path d="M49 70 Q55 75 61 70" stroke-width="3.5"/>
    <path d="M55 80 L55 130"/>
    <path d="M55 92 L38 116"/>
    <path d="M55 92 L82 104"/>
    <path d="M55 130 L42 166"/>
    <path d="M55 130 L68 166"/>
    <!-- stethoscope -->
    <path d="M47 84 Q40 100 50 106" stroke="${ACCENT}" stroke-width="5"/>
    <circle cx="53" cy="109" r="5" stroke="${ACCENT}" stroke-width="5"/>
    <!-- patient (right) -->
    <circle cx="145" cy="66" r="14"/>
    <path d="M139 70 Q145 75 151 70" stroke-width="3.5"/>
    <path d="M145 80 L145 130"/>
    <path d="M145 92 L118 104"/>
    <path d="M145 92 L162 116"/>
    <path d="M145 130 L132 166"/>
    <path d="M145 130 L158 166"/>
    <!-- speech bubble, dots taking turns talking -->
    <path d="M82 30 Q100 21 118 30 Q127 39 117 47 Q103 53 89 49 L80 57 L85 47 Q75 39 82 30"/>
    <circle class="a-flicker" style="animation-delay:0ms" cx="93" cy="38" r="2.5" fill="${ACCENT}" stroke="none"/>
    <circle class="a-flicker" style="animation-delay:180ms" cx="102" cy="38" r="2.5" fill="${ACCENT}" stroke="none"/>
    <circle class="a-flicker" style="animation-delay:360ms" cx="111" cy="38" r="2.5" fill="${ACCENT}" stroke="none"/>
    ${GROUND}
  `),

  // 2. Taking a tablet ------------------------------------------------
  taking_tablet: svgWrap(`
    <circle cx="100" cy="58" r="15"/>
    <path d="M94 63 Q100 68 106 63" stroke-width="3.5"/>
    <path d="M100 73 L100 132"/>
    <!-- arm lifting tablet to mouth, gently bobbing -->
    <g class="a-bob" style="transform-origin:100px 92px">
      <path d="M100 92 Q78 84 90 66"/>
      <rect x="28" y="86" width="46" height="21" rx="10.5" transform="rotate(-22 51 96)"/>
      <path d="M51 88 L51 105" transform="rotate(-22 51 96)" stroke="${ACCENT}" stroke-width="5"/>
    </g>
    <!-- other arm holding a glass -->
    <path d="M100 92 L124 108"/>
    <path d="M120 100 L138 100 L135 124 L124 124 Z" stroke-width="5"/>
    <path class="a-shimmer" d="M122 108 L136 108" stroke="${ACCENT}" stroke-width="4"/>
    <path d="M100 132 L86 168"/>
    <path d="M100 132 L114 168"/>
    ${GROUND}
  `),

  // 3. Calendar / next appointment ------------------------------------
  calendar: svgWrap(`
    <rect x="40" y="52" width="120" height="108" rx="10"/>
    <path d="M40 82 L160 82"/>
    <path d="M70 52 L70 36"/>
    <path d="M130 52 L130 36"/>
    <circle cx="64" cy="102" r="3.5" fill="${INK}" stroke="none"/>
    <circle cx="88" cy="102" r="3.5" fill="${INK}" stroke="none"/>
    <circle cx="112" cy="102" r="3.5" fill="${INK}" stroke="none"/>
    <circle cx="136" cy="102" r="3.5" fill="${INK}" stroke="none"/>
    <circle cx="64" cy="124" r="3.5" fill="${INK}" stroke="none"/>
    <circle cx="88" cy="124" r="3.5" fill="${INK}" stroke="none"/>
    <circle cx="112" cy="124" r="3.5" fill="${INK}" stroke="none"/>
    <circle cx="136" cy="124" r="3.5" fill="${INK}" stroke="none"/>
    <circle cx="64" cy="146" r="3.5" fill="${INK}" stroke="none"/>
    <circle cx="88" cy="146" r="3.5" fill="${INK}" stroke="none"/>
    <!-- the important day, circled and gently pulsing -->
    <circle class="a-pulse" style="transform-origin:112px 124px" cx="112" cy="124" r="13" stroke="${ACCENT}" stroke-width="5"/>
  `),

  // 4. Blood test ------------------------------------------------------
  blood_test: svgWrap(`
    <!-- test tube -->
    <path d="M85 52 L85 140 Q85 162 100 162 Q115 162 115 140 L115 52"/>
    <path d="M77 52 L123 52"/>
    <!-- sample level, gently shimmering -->
    <path class="a-shimmer" d="M86 112 Q93 106 100 112 Q107 118 114 112" stroke="${ACCENT}" stroke-width="5"/>
    <path class="a-shimmer" style="animation-delay:250ms" d="M88 132 Q100 138 112 132" stroke="${ACCENT}" stroke-width="5" opacity="0.6"/>
    <!-- a drop, falling toward the tube on a loop -->
    <path class="a-drip" d="M152 54 Q143 72 142 82 A10 10 0 1 0 162 82 Q161 72 152 54 Z" stroke="${ACCENT}" stroke-width="6"/>
  `),

  // 5. Drinking water --------------------------------------------------
  drinking_water: svgWrap(`
    <path d="M70 50 L82 162 L118 162 L130 50 Z"/>
    <!-- water line -->
    <path class="a-shimmer" d="M77 94 Q88 88 100 94 Q112 100 123 94" stroke="${ACCENT}" stroke-width="5"/>
    <!-- bubbles, rising and fading on a loop -->
    <circle class="a-rise" style="animation-delay:0ms" cx="95" cy="140" r="4" stroke="${ACCENT}" stroke-width="4"/>
    <circle class="a-rise" style="animation-delay:700ms" cx="107" cy="148" r="4" stroke="${ACCENT}" stroke-width="4"/>
    <!-- straw -->
    <path d="M114 56 L134 24"/>
  `),

  // 6. Walking / exercise ----------------------------------------------
  walking: svgWrap(`
    <circle cx="106" cy="48" r="14"/>
    <path d="M100 52 Q106 57 112 52" stroke-width="3.5"/>
    <path d="M106 62 L99 118"/>
    <path d="M104 82 L130 100"/>
    <path d="M104 82 L75 98"/>
    <path d="M99 118 L127 148 L131 168"/>
    <path d="M99 118 L75 146 L61 166"/>
    <!-- little motion lines, sweeping past on a loop -->
    <path class="a-swoop" style="animation-delay:0ms" d="M36 58 L56 58" stroke="${ACCENT}" stroke-width="5"/>
    <path class="a-swoop" style="animation-delay:150ms" d="M28 78 L48 78" stroke="${ACCENT}" stroke-width="5"/>
    <path class="a-swoop" style="animation-delay:300ms" d="M36 98 L56 98" stroke="${ACCENT}" stroke-width="5"/>
    ${GROUND}
  `),

  // 7. Healthy plate of food -------------------------------------------
  healthy_food: svgWrap(`
    <circle cx="104" cy="118" r="56"/>
    <circle cx="104" cy="118" r="40" stroke-width="4" opacity="0.5"/>
    <!-- apple -->
    <circle cx="86" cy="110" r="13" stroke="${ACCENT}"/>
    <path d="M86 97 Q88 89 95 87" stroke-width="4"/>
    <!-- broccoli, gently swaying -->
    <g class="a-sway" style="transform-origin:124px 128px">
      <path d="M124 128 L124 112" stroke-width="5"/>
      <path d="M112 112 Q108 100 118 100 Q120 90 130 94 Q140 92 138 102 Q146 108 134 112 Z" stroke-width="5"/>
    </g>
    <!-- fork -->
    <path d="M24 150 L24 98" stroke-width="5"/>
    <path d="M17 98 L17 76" stroke-width="5"/>
    <path d="M24 98 L24 76" stroke-width="5"/>
    <path d="M31 98 L31 76" stroke-width="5"/>
  `),

  // 8. Heart / blood pressure ------------------------------------------
  heart: svgWrap(`
    <path class="a-heartbeat" style="transform-origin:100px 104px" d="M100 162 Q42 120 45 76 Q47 44 76 46 Q94 48 100 68 Q106 48 124 46 Q153 44 155 76 Q158 120 100 162 Z" stroke="${ACCENT}" stroke-width="8"/>
    <!-- heartbeat line, drawing itself on a loop -->
    <path class="a-dash" d="M58 102 L82 102 L92 82 L106 122 L116 102 L142 102" stroke-width="6" pathLength="100"/>
  `),

  // 9. Lungs / breathing -----------------------------------------------
  lungs: svgWrap(`
    <!-- short windpipe, branching down into the top of each lung -->
    <path d="M100 24 L100 62"/>
    <path d="M100 60 Q94 64 90 74"/>
    <path d="M100 60 Q106 64 110 74"/>
    <!-- Both lungs breathe together, expanding and settling on a loop. -->
    <g class="a-breathe" style="transform-origin:100px 130px">
      <!-- left lung: widest at the bottom, almost meeting its pair in the middle -->
      <path d="M86 68 C62 68 40 96 36 124 C32 150 46 166 66 162 C82 158 92 150 94 134 C96 118 93 98 92 82 C91 72 90 68 86 68 Z" stroke-width="6" fill="${ACCENT}" fill-opacity="0.18"/>
      <!-- right lung (the same shape, mirrored) -->
      <path d="M114 68 C138 68 160 96 164 124 C168 150 154 166 134 162 C118 158 108 150 106 134 C104 118 107 98 108 82 C109 72 110 68 114 68 Z" stroke-width="6" fill="${ACCENT}" fill-opacity="0.18"/>
    </g>
    <!-- gentle breaths in and out -->
    <path class="a-shimmer" d="M78 46 Q70 36 78 26" stroke="${ACCENT}" stroke-width="5"/>
    <path class="a-shimmer" style="animation-delay:250ms" d="M122 46 Q130 36 122 26" stroke="${ACCENT}" stroke-width="5"/>
  `),

  // 10. Sleeping --------------------------------------------------------
  sleeping: svgWrap(`
    <!-- bed -->
    <path d="M28 150 L172 150"/>
    <path d="M36 150 L36 168"/>
    <path d="M164 150 L164 168"/>
    <rect x="36" y="118" width="36" height="20" rx="9" stroke-width="5"/>
    <!-- person under a blanket -->
    <circle cx="56" cy="126" r="12"/>
    <path d="M50 127 Q53 130 56 127" stroke-width="3"/>
    <path d="M74 150 Q84 126 110 130 L150 130 Q164 132 164 150" stroke-width="6"/>
    <!-- Zzz, drifting up and fading on a loop -->
    <path class="a-float" style="animation-delay:0ms" d="M116 58 L138 58 L116 80 L138 80" stroke="${ACCENT}" stroke-width="6"/>
    <path class="a-float" style="animation-delay:600ms" d="M148 40 L162 40 L148 54 L162 54" stroke="${ACCENT}" stroke-width="5"/>
  `),

  // 11. Warning sign -----------------------------------------------------
  warning: svgWrap(`
    <path class="a-alert" style="transform-origin:100px 100px" d="M100 34 Q104 34 107 40 L172 152 Q176 162 164 164 L36 164 Q24 162 28 152 L93 40 Q96 34 100 34 Z" stroke="${ACCENT}" stroke-width="8"/>
    <path d="M100 74 L100 118" stroke-width="9"/>
    <circle cx="100" cy="140" r="6" fill="${INK}" stroke="none"/>
  `),

  // 12. Phone call / call the clinic ------------------------------------
  phone_call: svgWrap(`
    <rect x="70" y="42" width="58" height="114" rx="12"/>
    <path d="M90 54 L108 54" stroke-width="4"/>
    <circle cx="99" cy="144" r="4" stroke-width="4"/>
    <!-- words on the screen -->
    <path d="M84 82 L114 82" stroke-width="4"/>
    <path d="M84 96 L114 96" stroke-width="4"/>
    <path d="M84 110 L104 110" stroke-width="4"/>
    <!-- ringing, pulsing outward on a loop -->
    <path class="a-ring" style="transform-origin:140px 100px" d="M142 82 Q154 100 142 118" stroke="${ACCENT}" stroke-width="5"/>
    <path class="a-ring" style="transform-origin:150px 100px;animation-delay:200ms" d="M154 70 Q174 100 154 130" stroke="${ACCENT}" stroke-width="5"/>
  `),

  // 13. Question mark / something unclear -------------------------------
  question: svgWrap(`
    <g class="a-bob" style="transform-origin:100px 90px">
      <path d="M64 74 Q62 34 100 33 Q138 34 137 70 Q136 95 112 104 Q101 108 101 126" stroke="${ACCENT}" stroke-width="9"/>
      <circle cx="101" cy="153" r="7" fill="${ACCENT}" stroke="none"/>
    </g>
    <path d="M46 118 L38 127" stroke-width="5"/>
    <path d="M154 112 L163 120" stroke-width="5"/>
  `),

  // 14. Family -----------------------------------------------------------
  family: svgWrap(`
    <!-- adult 1 -->
    <circle cx="50" cy="66" r="14"/>
    <path d="M44 70 Q50 75 56 70" stroke-width="3.5"/>
    <path d="M50 80 L50 130"/>
    <path d="M50 92 L32 114"/>
    <path d="M50 92 L72 118"/>
    <path d="M50 130 L38 166"/>
    <path d="M50 130 L62 166"/>
    <!-- child (middle) -->
    <circle cx="90" cy="100" r="10"/>
    <path d="M86 103 Q90 107 94 103" stroke-width="3"/>
    <path d="M90 110 L90 140"/>
    <path d="M90 116 L72 118"/>
    <path d="M90 116 L108 120"/>
    <path d="M90 140 L82 166"/>
    <path d="M90 140 L98 166"/>
    <!-- adult 2 -->
    <circle cx="132" cy="64" r="14"/>
    <path d="M126 68 Q132 73 138 68" stroke-width="3.5"/>
    <path d="M132 78 L132 130"/>
    <path d="M132 90 L108 120"/>
    <path d="M132 90 L150 112"/>
    <path d="M132 130 L120 166"/>
    <path d="M132 130 L144 166"/>
    <!-- a little heart above, softly pulsing -->
    <path class="a-pulse" style="transform-origin:166px 43px" d="M166 52 Q154 44 158 34 Q161 27 166 32 Q171 27 174 34 Q178 44 166 52 Z" stroke="${ACCENT}" stroke-width="5"/>
    ${GROUND}
  `),

  // 15. Thumbs up --------------------------------------------------------
  thumbs_up: svgWrap(`
    <!-- cuff -->
    <rect x="58" y="112" width="26" height="56" rx="7"/>
    <!-- fist -->
    <rect x="92" y="112" width="64" height="56" rx="14"/>
    <path d="M100 126 L148 126" stroke-width="4"/>
    <path d="M100 140 L148 140" stroke-width="4"/>
    <path d="M100 154 L148 154" stroke-width="4"/>
    <!-- thumb -->
    <path d="M92 120 Q84 92 100 72 Q110 61 118 72 Q123 82 113 96 Q106 105 108 112"/>
    <!-- little sparks, twinkling in turn -->
    <path class="a-flicker" style="animation-delay:0ms" d="M138 62 L148 50" stroke="${ACCENT}" stroke-width="5"/>
    <path class="a-flicker" style="animation-delay:220ms" d="M118 48 L121 34" stroke="${ACCENT}" stroke-width="5"/>
    <path class="a-flicker" style="animation-delay:440ms" d="M156 82 L170 76" stroke="${ACCENT}" stroke-width="5"/>
  `),
};

// Look a picture up by ID. Unknown IDs get the question mark,
// so the player never shows a blank space.
function illustrationSVG(id) {
  return ILLUSTRATIONS[id] || ILLUSTRATIONS.question;
}
