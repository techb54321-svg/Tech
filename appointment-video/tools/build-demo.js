// ============================================================
// tools/build-demo.js — builds "demo.html", a single shareable file.
//
// Why this exists: the real app needs a server (to keep the API key
// safe). A demo page needs no server at all, so you can put it online
// or open it on a phone and show people how it works.
//
// It embeds the SAME drawings, stylesheet and player code as the real
// app, so what people see is genuinely the app — the only difference is
// that it replays one prepared appointment instead of reading a new one.
//
// Build it with:   npm run demo
// ============================================================

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

const illustrations = read("public", "illustrations.js");
const playerJs = read("public", "player.js");
const appStyles = read("public", "styles.css");
const content = JSON.parse(read("public", "content.json"));

// The full prepared "video": the scenes plus the fixed closing
// reminder, with captions in every language (picked at play time).
const scenes = content.demoResult.scenes.map((s) => ({
  illustration: s.illustration,
  excerpt: s.excerpt,
  caption: s.caption,
  narration: s.narration,
}));
scenes.push({
  illustration: "phone_call",
  excerpt: "This closing reminder is added by the app itself, not taken from your recording.",
  caption: content.disclaimer,
  narration: content.disclaimer,
  app_note: true,
});

const DEMO_DATA = JSON.stringify({
  transcript: content.demoTranscript,
  summary: content.demoResult.summary,
  scenes,
});


// The charset declaration matters: without it, a plain static host can
// serve the file without an encoding and the Vietnamese/Arabic/Chinese
// text turns to mojibake.
const html = `<meta charset="utf-8">
<title>Visit Recap Demo</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Nunito:wght@400;600;700;800&display=swap">

<style>
/* ---------- Design tokens: the page around the phone ---------- */
:root {
  --page-bg: #f4ede1;
  --page-bg-deep: #ece0cd;
  --page-ink: #362e27;
  --page-muted: #7d7064;
  --page-card: #fffdfa;
  --page-line: #ddd0be;
  --page-accent: #c0362c;
  --page-accent-soft: #e2574c;
  --page-accent-tint: rgba(226, 87, 76, 0.1);
  --page-shadow: 40, 28, 16;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --page-bg: #1f1a16;
    --page-bg-deep: #171310;
    --page-ink: #f2e8dc;
    --page-muted: #ab9c8c;
    --page-card: #2a2420;
    --page-line: #453a30;
    --page-accent: #f0897d;
    --page-accent-soft: #f0897d;
    --page-accent-tint: rgba(240, 137, 125, 0.14);
    --page-shadow: 0, 0, 0;
  }
}
:root[data-theme="dark"] {
  --page-bg: #1f1a16;
  --page-bg-deep: #171310;
  --page-ink: #f2e8dc;
  --page-muted: #ab9c8c;
  --page-card: #2a2420;
  --page-line: #453a30;
  --page-accent: #f0897d;
  --page-accent-soft: #f0897d;
  --page-accent-tint: rgba(240, 137, 125, 0.14);
  --page-shadow: 0, 0, 0;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background:
    radial-gradient(1100px 620px at 12% -12%, var(--page-accent-tint), transparent 60%),
    radial-gradient(900px 560px at 108% 4%, var(--page-accent-tint), transparent 55%),
    var(--page-bg);
  color: var(--page-ink);
  font-family: Nunito, ui-rounded, "Segoe UI", system-ui, sans-serif;
  line-height: 1.6;
}
.display { font-family: "Fraunces", Georgia, "Times New Roman", serif; font-optical-sizing: auto; }

.wrap {
  max-width: 1080px; margin: 0 auto;
  padding: 44px 20px 64px;
  display: flex; flex-direction: column; gap: 34px;
}

/* ---------- Hero ---------- */
.hero { display: flex; flex-direction: column; gap: 14px; max-width: 66ch; }
.eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 0.78rem; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase;
  color: var(--page-accent); width: fit-content;
}
.eyebrow::before {
  content: ""; width: 7px; height: 7px; border-radius: 50%;
  background: var(--page-accent); display: inline-block;
}
@media (prefers-reduced-motion: no-preference) {
  .eyebrow::before { animation: dot-breathe 1.8s ease-in-out infinite; }
}
@keyframes dot-breathe { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.75); } }

.hero h1 {
  font-size: clamp(2.3rem, 6vw, 3.6rem);
  font-weight: 600; letter-spacing: -0.5px;
  margin: 0; text-wrap: balance; line-height: 1.05;
}
.hero h1 .accent-word { color: var(--page-accent); }
.hero .lede { font-size: 1.15rem; margin: 0; max-width: 58ch; color: var(--page-ink); }
.hero .sub { color: var(--page-muted); margin: 0; font-size: 1rem; }

@media (prefers-reduced-motion: no-preference) {
  .hero > * { animation: rise-in 640ms cubic-bezier(.16,.9,.28,1) both; }
  .hero .eyebrow { animation-delay: 0ms; }
  .hero h1 { animation-delay: 70ms; }
  .hero .lede { animation-delay: 150ms; }
  .hero .sub { animation-delay: 210ms; }
}
@keyframes rise-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

/* ---------- The feature presentation ----------
   The film itself, top of page, playing on its own the moment you
   arrive. This is the product — everything else is footnotes. */
.feature {
  width: 100%; max-width: 760px;
  background: radial-gradient(120% 90% at 50% 0%, #332b24, #241e19 65%);
  border-radius: 26px;
  padding: 14px 14px 16px;
  box-shadow: 0 4px 10px rgba(var(--page-shadow), 0.25), 0 30px 70px rgba(var(--page-shadow), 0.4);
}
.sc-stage {
  position: relative;
  aspect-ratio: 360 / 202;
  border-radius: 16px;
  overflow: hidden;
  background: #fbf5ea;
}
.sc-stage::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  border-radius: 16px;
  box-shadow: inset 0 0 50px rgba(58, 51, 48, 0.16);
}
.sc-title-card {
  position: absolute; inset: 0; z-index: 2;
  background: #fbf5ea;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 4px;
  transition: opacity 450ms ease;
}
.sc-title-card.fade { opacity: 0; pointer-events: none; }
.sc-title-card .tc-kicker {
  margin: 0; font-size: 0.78rem; font-weight: 700;
  letter-spacing: 2.4px; text-transform: uppercase; color: #a08d7c;
}
.sc-title-card .tc-title {
  margin: 0; font-family: "Fraunces", Georgia, serif;
  font-size: clamp(1.5rem, 4vw, 2.3rem); font-weight: 600; color: #3a3330;
}
.sc-title-card .tc-rule {
  width: 52px; height: 4px; border-radius: 2px;
  background: #e2574c; margin-top: 12px;
}
.sc-sound {
  position: absolute; right: 12px; bottom: 12px; z-index: 3;
  border: none; border-radius: 999px; cursor: pointer;
  padding: 9px 16px; font-family: inherit; font-weight: 800; font-size: 0.85rem;
  background: rgba(36, 30, 25, 0.82); color: #f6ead8;
  backdrop-filter: blur(3px);
}
.sc-sound:hover { background: rgba(36, 30, 25, 0.95); }
.sc-captions { min-height: 6em; display: flex; flex-direction: column; justify-content: center; gap: 3px; padding: 12px 10px 2px; text-align: center; }
.sc-caption {
  margin: 0; color: #f6ead8; font-weight: 700;
  font-size: clamp(1.1rem, 2.6vw, 1.45rem); line-height: 1.35; text-wrap: balance;
}
.sc-narr { margin: 0; color: #b3a291; font-size: clamp(0.9rem, 1.8vw, 1.02rem); line-height: 1.5; }
.sc-narr .k-word.said, .sc-narr.all-said { color: #f6ead8; }
.sc-caption-en { margin: 0; color: #b3a291; font-size: 0.88rem; }
.sc-stage::before {
  content: ""; position: absolute; inset: 0; z-index: 1; pointer-events: none;
  opacity: 0.05;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='140' height='140' filter='url(%23n)'/></svg>");
}
.sc-bar { display: flex; gap: 5px; margin: 10px 6px 4px; }
.sc-bar button { flex: 1; height: 24px; background: none; border: none; padding: 10px 0; cursor: pointer; }
.sc-bar .seg { display: block; height: 4px; border-radius: 2px; background: rgba(246, 234, 216, 0.22); overflow: hidden; }
.sc-bar .fill { display: block; height: 100%; width: 0; background: #e2574c; border-radius: 2px; }
.sc-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 4px 6px 0; flex-wrap: wrap; }
.sc-langs { display: flex; gap: 6px; flex-wrap: wrap; }
.sc-langs button {
  border: 1.5px solid rgba(246, 234, 216, 0.35); background: none; cursor: pointer;
  color: #f6ead8; font-family: inherit; font-weight: 700; font-size: 0.82rem;
  padding: 6px 12px; border-radius: 999px;
}
.sc-langs button.on { background: #e2574c; border-color: #e2574c; color: #fff; }
.sc-pp {
  border: 2px solid rgba(246, 234, 216, 0.4); background: none; cursor: pointer;
  color: #f6ead8; width: 42px; height: 42px; border-radius: 50%; font-size: 0.95rem;
}

/* ---------- Notice ---------- */
.notice {
  background: var(--page-card);
  border: 1px solid var(--page-line);
  border-left: 5px solid var(--page-accent);
  border-radius: 14px;
  padding: 16px 18px;
  max-width: 62ch;
}
.notice p { margin: 0 0 8px; }
.notice p:last-child { margin: 0; }
.notice strong { font-weight: 800; }
.notice code {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.88em; background: var(--page-bg-deep);
  padding: 1px 6px; border-radius: 5px;
}
.notice a { color: var(--page-accent); font-weight: 700; }

/* ---------- Phone + sidebar ---------- */
.stage-row { display: flex; flex-direction: column; gap: 30px; }
.phone { width: 100%; display: flex; justify-content: center; }
.phone-frame {
  --tilt-x: 0deg; --tilt-y: 0deg;
  width: 100%; max-width: 390px;
  padding: 14px 12px 22px;
  border-radius: 44px;
  background: linear-gradient(155deg, #34302b, #17130f 70%);
  box-shadow:
    0 30px 60px -18px rgba(var(--page-shadow), 0.55),
    0 8px 20px -6px rgba(var(--page-shadow), 0.35),
    inset 0 0 0 1px rgba(255,255,255,0.05);
  position: relative;
  transform: perspective(1200px) rotateX(var(--tilt-y)) rotateY(var(--tilt-x));
  transition: transform 300ms ease-out;
}
.phone-frame::before {
  content: ""; position: absolute; top: 14px; left: 50%; translate: -50% 0;
  width: 92px; height: 22px; border-radius: 12px; background: #17130f; z-index: 2;
}
.phone-inner {
  background: #faf6f0;      /* the app's own paper colour, both themes */
  color: #3a3330;
  border-radius: 30px;
  overflow: hidden;
  max-height: 76vh; overflow-y: auto;
  scrollbar-width: thin;
}
.side { display: flex; flex-direction: column; gap: 22px; }
.side-block {
  background: var(--page-card);
  border: 1px solid var(--page-line);
  border-radius: 16px;
  padding: 18px 20px;
}
.side h2 { font-size: 1.08rem; margin: 0 0 6px; font-weight: 700; }
.side p { margin: 0; color: var(--page-muted); font-size: 0.95rem; }
.side ul { margin: 8px 0 0; padding-left: 20px; color: var(--page-muted); font-size: 0.95rem; }
.side li { margin-bottom: 6px; }
.side li strong { color: var(--page-ink); }

@media (min-width: 900px) {
  .stage-row { flex-direction: row; align-items: flex-start; gap: 44px; }
  .phone { width: 410px; flex: none; position: sticky; top: 28px; }
  .side { flex: 1; padding-top: 4px; }
}

footer.page-footer {
  border-top: 1px solid var(--page-line);
  padding-top: 18px; color: var(--page-muted); font-size: 0.88rem;
}
footer.page-footer a { color: var(--page-accent); }

/* ---------- The app's own stylesheet, unchanged ---------- */
/* Scoped under .phone-inner so it can't affect the page around it. */
${appStyles
  .replace(/^body \{/m, ".phone-inner {")
  .replace(/^header \{/m, ".phone-inner header {")
  .replace(/^footer \{/m, ".phone-inner footer {")
  .replace(/^\.screen \{/m, ".phone-inner .screen {")}
</style>

<div class="wrap">
  <div class="hero">
    <span class="eyebrow">A live prototype</span>
    <h1 class="display">Visit <span class="accent-word">Recap</span></h1>
    <p class="lede">A recording of a doctor's appointment, turned into a short animated
      film the patient and their family can actually understand — in their own language.</p>
    <p class="sub">This is that film, playing now. Tap for sound — it narrates. Switch the language while it plays.</p>
  </div>

  <!-- The film, playing by itself the moment the page opens. -->
  <div class="feature" id="sc-cinema">
    <div class="sc-stage" id="sc-stage">
      <div class="scene-layer" id="sc-a"></div>
      <div class="scene-layer" id="sc-b"></div>
      <div class="sc-title-card" id="sc-title">
        <p class="tc-kicker">Your appointment</p>
        <p class="tc-title">The story of your visit</p>
        <div class="tc-rule"></div>
      </div>
      <button class="sc-sound" id="sc-sound">&#128263; Tap for sound</button>
    </div>
    <div class="sc-captions">
      <p class="sc-caption" id="sc-caption"></p>
      <p class="sc-narr" id="sc-narr"></p>
      <p class="sc-caption-en" id="sc-caption-en" hidden></p>
    </div>
    <div class="sc-bar" id="sc-bar" aria-label="Scenes"></div>
    <div class="sc-row">
      <div class="sc-langs" id="sc-langs"></div>
      <button class="sc-pp" id="sc-pp" aria-label="Pause">&#9208;</button>
    </div>
  </div>

  <div class="notice">
    <p><strong>This demo replays one prepared appointment.</strong> Everything you can
      touch is real — the animated scenes, the narration, the four languages, the
      "Why this?" quotes. The one thing it can't do is read a <em>new</em>
      recording, because that needs a private key that must stay on a server.</p>
    <p>To use it on your own appointments, run the app on your computer:
      <code>npm install</code>, then <code>npm start</code>.</p>
  </div>

  <div class="stage-row">
    <div class="phone">
      <div class="phone-frame" id="phone-frame">
        <div class="phone-inner">
          <header>
            <h1>Visit Recap</h1>
            <p class="tagline">Turn a doctor's appointment into a short, simple video.</p>
          </header>

          <!-- 1. Consent -->
          <section id="screen-consent" class="screen active">
            <div class="card">
              <div class="big-emoji">&#129658;</div>
              <h2>Before you start</h2>
              <p>Please <strong>ask your doctor or nurse first</strong> before recording an
                appointment. Most are happy to help — and rules about recording differ
                from place to place.</p>
              <label class="tick-row">
                <input type="checkbox" id="consent-tick">
                <span>I have permission to use this recording or transcript.</span>
              </label>
              <button id="consent-continue" class="btn btn-primary" disabled>Continue</button>
            </div>
          </section>

          <!-- 2. The appointment -->
          <section id="screen-input" class="screen">
            <div class="card">
              <h2>Add the appointment</h2>
              <label class="field-label" for="language-select">Show the video in&hellip;</label>
              <select id="language-select">
                <option value="en">English</option>
                <option value="vi">Ti&#7871;ng Vi&#7879;t (Vietnamese)</option>
                <option value="ar">&#1575;&#1604;&#1593;&#1585;&#1576;&#1610;&#1577; (Arabic)</option>
                <option value="zh">&#31616;&#20307;&#20013;&#25991; (Chinese)</option>
              </select>
              <label class="field-label" for="transcript-input">The appointment</label>
              <textarea id="transcript-input" rows="7" readonly></textarea>
              <p class="small-note">In the full app you record this in the browser or paste
                your own. Here it's a prepared example.</p>
              <button id="generate-btn" class="btn btn-primary">Make my video &#9654;</button>
            </div>
          </section>

          <!-- 3. Processing -->
          <section id="screen-processing" class="screen">
            <div class="card center">
              <div class="spinner"></div>
              <h2>Making your video&hellip;</h2>
              <p class="small-note">Reading the appointment and drawing the scenes.</p>
            </div>
          </section>

          <!-- 4. Player: the little cinema -->
          <section id="screen-player" class="screen player-screen">
            <div class="theater">
              <h2 class="visually-hidden">Your video</h2>
              <div id="stage">
                <div class="scene-layer" id="scene-a"></div>
                <div class="scene-layer" id="scene-b"></div>
                <div id="title-card" hidden>
                  <p class="tc-kicker">Your appointment</p>
                  <p class="tc-title">The story of your visit</p>
                  <div class="tc-rule"></div>
                </div>
              </div>
              <div class="caption-zone">
                <p id="caption-main" aria-live="polite"></p>
                <p id="narr-line" hidden></p>
                <p id="caption-en" hidden></p>
              </div>
              <div id="dots" role="group" aria-label="Scenes"></div>
              <div id="controls">
                <button id="prev-btn" class="btn btn-round" aria-label="Previous scene">&#9198;</button>
                <button id="play-btn" class="btn btn-round btn-play" aria-label="Play">&#9654;</button>
                <button id="next-btn" class="btn btn-round" aria-label="Next scene">&#9197;</button>
                <button id="mute-btn" class="btn btn-round btn-small" aria-label="Turn sound off">&#128266;</button>
              </div>
              <button id="why-btn" class="link-btn" aria-expanded="false" aria-controls="why-panel">Why this? Show the doctor's words</button>
              <div id="why-panel" hidden>
                <p id="why-label" class="small-note">From the appointment:</p>
                <blockquote id="why-quote"></blockquote>
              </div>
            </div>
            <div class="card">
              <h3>Plain summary</h3>
              <p id="summary-main"></p>
              <p id="summary-en" class="small-note" hidden></p>
            </div>
            <p class="center"><a href="#" id="restart-link">&larr; Start again</a></p>
          </section>

          <footer>
            <p>This is a summary tool, not medical advice. Always ask your clinic if
              anything is unclear.</p>
          </footer>
        </div>
      </div>
    </div>

    <div class="side">
      <div class="side-block">
        <h2 class="display">What it does</h2>
        <p>An appointment is a lot to take in, and most summaries are written at a
          reading level that leaves people behind. This turns one into six animated
          scenes with short captions, read aloud, in the language the family speaks at home.</p>
      </div>
      <div class="side-block">
        <h2 class="display">How to read it</h2>
        <ul>
          <li>Scenes play by themselves, like a little film — crossfades, a slow
            camera drift, and a timeline that fills as each scene plays.</li>
          <li>Pick a language at the start — the caption switches, with English kept underneath.</li>
          <li><strong>"Why this?"</strong> shows the doctor's actual words behind each scene, so
            nothing is taken on trust.</li>
          <li>The last scene is always the same reminder, added by the app rather than
            written by the AI.</li>
        </ul>
      </div>
      <div class="side-block">
        <h2 class="display">The rules it follows</h2>
        <ul>
          <li>It can never state a dose or how often to take something unless those exact
            words were said in the room.</li>
          <li>Anything unclear becomes <strong>"Check this with your doctor."</strong></li>
          <li>Pictures come from a fixed set of 15 hand-drawn scenes — the AI chooses from
            them and never draws its own.</li>
        </ul>
      </div>
      <div class="side-block">
        <h2 class="display">If narration is silent</h2>
        <p>The voice comes from your own device. Most phones have English and Chinese
          voices built in; Vietnamese and Arabic depend on what's installed. When a voice
          is missing the scenes still play, just without sound.</p>
      </div>
    </div>
  </div>

  <footer class="page-footer">
    <p>A prototype. Not a medical device, and not medical advice.
      Transcripts in the full app are sent to Anthropic's API to build the summary and are not stored.</p>
  </footer>
</div>

<script>
${illustrations}
</script>

<script>
// ---- The app's own player, embedded unchanged ----
${playerJs}
</script>

<script>
// ---- The feature presentation: the film auto-plays on page load ----
// Its own tiny player (separate from the phone's, which is the real
// app code). Silent until tapped — browsers require a tap before any
// page may speak — then the narration takes over the pacing.
(function () {
  // DEMO and LANG_META are defined by later script tags, so all the work
  // happens in boot(), which runs after every script has loaded.
  function boot() {
    const pick = (m) => (m && (m[lang] || m.en)) || "";
    const layerA = document.getElementById("sc-a");
    const layerB = document.getElementById("sc-b");
    const titleEl = document.getElementById("sc-title");
    const capEl = document.getElementById("sc-caption");
    const capEnEl = document.getElementById("sc-caption-en");
    const barEl = document.getElementById("sc-bar");
    const langsEl = document.getElementById("sc-langs");
    const soundBtn = document.getElementById("sc-sound");
    const ppBtn = document.getElementById("sc-pp");

    const LANG_LABELS = { en: "English", vi: "Ti\\u1EBFng Vi\\u1EC7t", ar: "\\u0627\\u0644\\u0639\\u0631\\u0628\\u064A\\u0629", zh: "\\u4E2D\\u6587" };
    let lang = "en";
    let i = -1;               // -1 = title card
    let running = true;
    let sound = false;
    let timer = null;
    let front = "b";
    let token = 0;

    // Language pills.
    for (const code of ["en", "vi", "ar", "zh"]) {
      const b = document.createElement("button");
      b.textContent = LANG_LABELS[code];
      b.className = code === "en" ? "on" : "";
      b.addEventListener("click", () => {
        lang = code;
        [...langsEl.children].forEach((x) => x.classList.toggle("on", x === b));
        if (i >= 0) showScene(i);      // re-say the current scene in the new language
      });
      langsEl.appendChild(b);
    }

    // Timeline segments (tap to jump).
    DEMO.scenes.forEach((_, n) => {
      const seg = document.createElement("button");
      seg.setAttribute("aria-label", "Scene " + (n + 1));
      seg.innerHTML = '<span class="seg"><span class="fill"></span></span>';
      seg.addEventListener("click", () => { showScene(n); });
      barEl.appendChild(seg);
    });

    function segFill(n, ms) {
      [...barEl.children].forEach((b, k) => {
        const f = b.querySelector(".fill");
        f.style.transition = "none";
        f.style.width = k < n ? "100%" : "0%";
      });
      const f = barEl.children[n] && barEl.children[n].querySelector(".fill");
      if (!f || !running) return;
      void f.offsetWidth;
      f.style.transition = "width " + ms + "ms linear";
      f.style.width = "100%";
    }

    function stopTalk() {
      if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {}
    }

    function schedule(ms, fn) {
      clearTimeout(timer);
      const my = ++token;
      timer = setTimeout(() => { if (my === token && running) fn(); }, ms);
    }

    function showTitle() {
      i = -1;
      stopTalk();
      titleEl.hidden = false;
      titleEl.classList.remove("fade");
      capEl.textContent = "";
      document.getElementById("sc-narr").hidden = true;
      capEnEl.hidden = true;
      [...barEl.children].forEach((b) => {
        const f = b.querySelector(".fill");
        f.style.transition = "none"; f.style.width = "0%";
      });
      schedule(1800, () => showScene(0));
    }

    function showScene(n) {
      i = n;
      stopTalk();
      titleEl.classList.add("fade");
      const scene = DEMO.scenes[n];

      // Crossfade to the fresh drawing (choreography restarts with it).
      const back = front === "a" ? layerB : layerA;
      const fore = front === "a" ? layerA : layerB;
      back.innerHTML = illustrationSVG(scene.illustration);
      back.querySelector("svg").classList.add(n % 2 ? "kb-drift" : "kb-zoom");
      back.classList.add("front");
      fore.classList.remove("front");
      front = front === "a" ? "b" : "a";
      // Clear the faded-out layer so its animations stop costing frames.
      setTimeout(() => { if (!fore.classList.contains("front")) fore.innerHTML = ""; }, 600);

      // Captions: chosen language big, the narration line under it
      // (karaoke-lit when the voice is on), English small underneath.
      const cap = pick(scene.caption);
      capEl.textContent = cap;
      capEl.dir = lang === "ar" ? "rtl" : "ltr";
      capEnEl.textContent = scene.caption.en;
      capEnEl.hidden = lang === "en";

      const narr = pick(scene.narration || scene.caption);
      const narrEl = document.getElementById("sc-narr");
      narrEl.dir = lang === "ar" ? "rtl" : "ltr";
      let spans = null;
      if (narr !== cap) {
        narrEl.hidden = false;
        spans = karaokePrepare(narrEl, narr);   // shared with the app player
        if (!sound) narrEl.classList.add("all-said");
      } else {
        narrEl.hidden = true;
      }

      // Timing: narration when sound is on, reading time when silent.
      const readMs = Math.min(9000, 3400 + (narr !== cap ? narr : cap).length * 42);
      segFill(n, sound ? Math.min(11000, 3000 + narr.length * 65) : readMs);

      const next = () => (n < DEMO.scenes.length - 1 ? showScene(n + 1) : schedule(1600, showTitle));

      if (sound && window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(narr);
        const vLang = (LANG_META[lang] || {}).tts || "en-US";
        u.lang = lang === "en" ? "en-US" : vLang;
        u.rate = 0.95;
        const my = ++token;
        const watchdog = setTimeout(() => { if (my === token && running) next(); }, Math.min(11000, 3000 + narr.length * 65) + 1500);
        u.onstart = () => { if (my === token) duckScore(true); };
        u.onboundary = (e) => { if (my === token) karaokeMark(spans, e.charIndex || 0); };
        u.onend = () => { clearTimeout(watchdog); karaokeMark(spans, Infinity); duckScore(false); if (my === token && running) setTimeout(next, 800); };
        u.onerror = () => { clearTimeout(watchdog); narrEl.classList.add("all-said"); duckScore(false); if (my === token && running) setTimeout(next, readMs); };
        try { speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { schedule(readMs, next); }
      } else {
        schedule(readMs, next);
      }
    }

    soundBtn.addEventListener("click", () => {
      sound = !sound;
      soundBtn.innerHTML = sound ? "&#128266; Sound on" : "&#128263; Tap for sound";
      if (sound) startScore();               // the music-box score (from player.js)
      else { stopTalk(); stopScore(); }
      if (running && i >= 0) showScene(i);   // restart the beat under the new setting
      else if (running && i < 0) { /* title card: sound starts from scene 1 */ }
    });

    ppBtn.addEventListener("click", () => {
      running = !running;
      ppBtn.innerHTML = running ? "&#9208;" : "&#9654;";
      ppBtn.setAttribute("aria-label", running ? "Pause" : "Play");
      if (!running) { clearTimeout(timer); token++; stopTalk(); stopScore(); }
      else { if (sound) startScore(); if (i < 0) showTitle(); else showScene(i); }
    });

    // Don't talk to an empty room: pause narration when the tab hides.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopTalk();
    });

    // If someone starts the interactive phone below, bow out quietly —
    // two films talking over each other helps nobody.
    const phoneGen = document.getElementById("generate-btn");
    if (phoneGen) phoneGen.addEventListener("click", () => {
      if (running) {
        running = false;
        ppBtn.innerHTML = "&#9654;";
        ppBtn.setAttribute("aria-label", "Play");
        clearTimeout(timer); token++; stopTalk(); stopScore();
      }
    });

    showTitle();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

// ---- A very light tilt on the phone mockup, following the pointer ----
(function () {
  const frame = document.getElementById("phone-frame");
  if (!frame || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.matchMedia("(hover: hover)").matches) return; // skip on touch devices
  const wrap = frame.closest(".phone");
  wrap.addEventListener("mousemove", function (e) {
    const r = wrap.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    frame.style.setProperty("--tilt-x", (px * 6).toFixed(2) + "deg");
    frame.style.setProperty("--tilt-y", (-py * 6).toFixed(2) + "deg");
  });
  wrap.addEventListener("mouseleave", function () {
    frame.style.setProperty("--tilt-x", "0deg");
    frame.style.setProperty("--tilt-y", "0deg");
  });
})();
</script>

<script>
// ---- Demo glue: the screens around the shared player ----
const DEMO = ${DEMO_DATA};

const screens = {
  consent: $("screen-consent"), input: $("screen-input"),
  processing: $("screen-processing"), player: $("screen-player"),
};

function showScreen(name) {
  for (const el of Object.values(screens)) el.classList.remove("active");
  screens[name].classList.add("active");
  const heading = screens[name].querySelector("h2");
  if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: true }); }
  screens[name].scrollIntoView({ block: "nearest" });
}

// Shape the prepared appointment exactly like the real server's answer,
// for whichever language is picked.
function demoDataFor(langCode) {
  const pick = (m) => m[langCode] || m.en;
  return {
    summary: DEMO.summary.en,
    summary_translated: pick(DEMO.summary),
    scenes: DEMO.scenes.map((s) => ({
      caption: s.caption.en,
      caption_translated: pick(s.caption),
      narration: s.narration ? s.narration.en : s.caption.en,
      narration_translated: s.narration ? pick(s.narration) : pick(s.caption),
      excerpt: s.excerpt,
      illustration: s.illustration,
      app_note: s.app_note,
    })),
  };
}

$("transcript-input").value = DEMO.transcript;

$("consent-tick").addEventListener("change", (e) => {
  $("consent-continue").disabled = !e.target.checked;
});
$("consent-continue").addEventListener("click", () => showScreen("input"));

$("generate-btn").addEventListener("click", () => {
  const chosenLang = $("language-select").value;
  // Phones only allow speech that starts from a tap — unlock it here.
  if (window.speechSynthesis) {
    try { speechSynthesis.speak(new SpeechSynthesisUtterance("")); } catch (e) {}
  }
  showScreen("processing");
  setTimeout(() => {
    loadPlayer(demoDataFor(chosenLang), chosenLang);
    showScreen("player");
    play();
  }, 1400);
});

$("restart-link").addEventListener("click", (e) => { e.preventDefault(); pause(); showScreen("input"); });
</script>
`;

fs.writeFileSync(path.join(ROOT, "demo.html"), html);
console.log("Built demo.html (" + Math.round(html.length / 1024) + " KB) — open it in any browser.");
