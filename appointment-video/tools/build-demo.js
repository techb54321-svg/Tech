// ============================================================
// tools/build-demo.js — builds "demo.html", a single shareable file.
//
// Why this exists: the real app needs a server (to keep the API key
// safe). A demo page needs no server at all, so you can put it online
// or open it on a phone and show people how it works.
//
// It uses the SAME drawings, styles and example appointment as the real
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
const appStyles = read("public", "styles.css");
const content = JSON.parse(read("public", "content.json"));

// Build the finished scene list once, exactly as the server would:
// the prepared scenes, then the fixed closing reminder.
const scenes = content.demoResult.scenes.map((s) => ({
  illustration: s.illustration,
  excerpt: s.excerpt,
  caption: s.caption,
}));
scenes.push({
  illustration: "phone_call",
  excerpt: "This closing reminder is added by the app itself, not taken from your recording.",
  caption: content.disclaimer,
  app_note: true,
});

const DEMO_DATA = JSON.stringify({
  transcript: content.demoTranscript,
  summary: content.demoResult.summary,
  scenes,
});

// The hero "preview reel" cycles through a handful of scenes, each
// shown in a different language in turn — so a visitor sees the whole
// idea (pictures, captions, translation) before touching anything.
const HERO_SCENES = JSON.stringify(
  content.demoResult.scenes.slice(0, 5).map((s, i) => ({
    illustration: s.illustration,
    caption: s.caption,
    lang: ["en", "vi", "ar", "zh", "en"][i % 5],
  }))
);

const html = `<title>Visit Recap Demo</title>
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

/* Staggered entrance for the hero column. */
@media (prefers-reduced-motion: no-preference) {
  .hero > * { animation: rise-in 640ms cubic-bezier(.16,.9,.28,1) both; }
  .hero .eyebrow { animation-delay: 0ms; }
  .hero h1 { animation-delay: 70ms; }
  .hero .lede { animation-delay: 150ms; }
  .hero .sub { animation-delay: 210ms; }
}
@keyframes rise-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

/* ---------- Ambient preview reel ---------- */
/* A small "trailer" that cycles through real scenes and real languages,
   so the idea reads instantly — before anyone taps a single button. */
.reel {
  display: flex; align-items: center; gap: 18px;
  background: var(--page-card);
  border: 1px solid var(--page-line);
  border-radius: 22px;
  padding: 18px 22px;
  box-shadow: 0 1px 2px rgba(var(--page-shadow), 0.06), 0 18px 40px rgba(var(--page-shadow), 0.12);
  max-width: 640px;
}
.reel-stage {
  width: 64px; height: 64px; flex: none;
  border-radius: 16px;
  background: var(--page-accent-tint);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.reel-stage svg { width: 78%; height: 78%; }
.reel-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.reel-caption {
  font-weight: 700; font-size: 1.08rem;
  min-height: 1.4em;
}
.reel-caption[dir="rtl"] { text-align: right; }
.reel-lang {
  font-size: 0.74rem; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase;
  color: var(--page-muted);
}
@media (max-width: 560px) {
  .reel { padding: 14px 16px; gap: 14px; }
  .reel-stage { width: 52px; height: 52px; border-radius: 13px; }
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
  width: 100%; max-width: 380px;
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
  /* the notch */
  content: ""; position: absolute; top: 14px; left: 50%; translate: -50% 0;
  width: 92px; height: 22px; border-radius: 12px; background: #17130f; z-index: 2;
}
.phone-inner {
  background: #faf6f0;      /* the app's own paper colour, both themes */
  color: #3a3330;
  border-radius: 30px;
  overflow: hidden;
  max-height: 74vh; overflow-y: auto;
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
  .phone { width: 400px; flex: none; position: sticky; top: 28px; }
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
    <p class="lede">A recording of a doctor's appointment, turned into a short picture-video
      the patient and their family can actually understand — in their own language.</p>
    <p class="sub">This page is the real app, running live. Watch it work below, then try it yourself.</p>
  </div>

  <div class="reel" id="reel" aria-hidden="true">
    <div class="reel-stage" id="reel-stage"></div>
    <div class="reel-text">
      <span class="reel-lang" id="reel-lang">English</span>
      <span class="reel-caption" id="reel-caption"></span>
    </div>
  </div>

  <div class="notice">
    <p><strong>This demo replays one prepared appointment.</strong> Everything you can
      touch is real — the pictures, the narration, the four languages, the
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

          <!-- 4. Player -->
          <section id="screen-player" class="screen">
            <div class="card player-card">
              <h2 class="visually-hidden">Your video</h2>
              <div id="stage"></div>
              <p id="caption-main" aria-live="polite"></p>
              <p id="caption-en" hidden></p>
              <div id="dots" role="group" aria-label="Scenes"></div>
              <div id="controls">
                <button id="prev-btn" class="btn btn-round" aria-label="Previous scene">&#9198;</button>
                <button id="play-btn" class="btn btn-round btn-play" aria-label="Play">&#9654;</button>
                <button id="next-btn" class="btn btn-round" aria-label="Next scene">&#9197;</button>
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
          reading level that leaves people behind. This turns one into six pictures
          with short captions, read aloud, in the language the family speaks at home.</p>
      </div>
      <div class="side-block">
        <h2 class="display">How to read it</h2>
        <ul>
          <li>Scenes play by themselves, like a video. Use &#9654; and the arrows to move around.</li>
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
          <li>Pictures come from a fixed set of 15 drawings — the AI chooses from them and
            never draws its own.</li>
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
// ---- Ambient hero preview reel: real scenes, real languages, on a loop ----
(function () {
  const HERO = ${HERO_SCENES};
  const LANG_NAMES = { en: "English", vi: "Ti\\u1EBFng Vi\\u1EC7t", ar: "\\u0627\\u0644\\u0639\\u0631\\u0628\\u064A\\u0629", zh: "\\u7B80\\u4F53\\u4E2D\\u6587" };
  const LANG_DIR = { ar: "rtl" };
  const stage = document.getElementById("reel-stage");
  const captionEl = document.getElementById("reel-caption");
  const langEl = document.getElementById("reel-lang");
  let i = 0;

  function show(index) {
    const scene = HERO[index];
    stage.innerHTML = illustrationSVG(scene.illustration);
    captionEl.textContent = scene.caption[scene.lang] || scene.caption.en;
    captionEl.dir = LANG_DIR[scene.lang] || "ltr";
    langEl.textContent = LANG_NAMES[scene.lang] || "English";
  }
  show(0);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduceMotion) {
    setInterval(function () {
      i = (i + 1) % HERO.length;
      captionEl.style.opacity = "0";
      stage.style.opacity = "0";
      setTimeout(function () {
        show(i);
        captionEl.style.transition = "opacity 260ms ease";
        stage.style.transition = "opacity 260ms ease";
        captionEl.style.opacity = "1";
        stage.style.opacity = "1";
      }, 220);
    }, 2800);
  }
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
// ---- The demo's own small player (the same behaviour as the real app) ----
const DEMO = ${DEMO_DATA};

const LANG_META = {
  en: { tts: "en-US" },
  vi: { tts: "vi-VN" },
  ar: { tts: "ar-SA", rtl: true },
  zh: { tts: "zh-CN" },
};

const $ = (id) => document.getElementById(id);
const screens = {
  consent: $("screen-consent"), input: $("screen-input"),
  processing: $("screen-processing"), player: $("screen-player"),
};

let lang = "en", idx = 0, playing = false;
let speakToken = 0, advanceTimer = null;

function showScreen(name) {
  for (const el of Object.values(screens)) el.classList.remove("active");
  screens[name].classList.add("active");
  const heading = screens[name].querySelector("h2");
  if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: true }); }
  screens[name].scrollIntoView({ block: "nearest" });
}

$("transcript-input").value = DEMO.transcript;

$("consent-tick").addEventListener("change", (e) => {
  $("consent-continue").disabled = !e.target.checked;
});
$("consent-continue").addEventListener("click", () => showScreen("input"));

$("generate-btn").addEventListener("click", () => {
  lang = $("language-select").value;
  // Phones only allow speech that starts from a tap — unlock it here.
  if (window.speechSynthesis) {
    try { speechSynthesis.speak(new SpeechSynthesisUtterance("")); } catch (e) {}
  }
  showScreen("processing");
  setTimeout(() => { buildPlayer(); showScreen("player"); play(); }, 1400);
});

function textFor(map) { return map[lang] || map.en; }
function isTranslated(map) { return lang !== "en" && !!map[lang] && map[lang] !== map.en; }

function setTextLanguage(el, translated) {
  if (!translated) { el.lang = "en"; el.dir = "ltr"; return; }
  el.lang = lang === "zh" ? "zh-CN" : lang;
  el.dir = LANG_META[lang].rtl ? "rtl" : "ltr";
}

function replayAnimation(el) {
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "";
}

function buildPlayer() {
  idx = 0; playing = false;
  const dots = $("dots");
  dots.innerHTML = "";
  DEMO.scenes.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.setAttribute("aria-label", "Scene " + (i + 1));
    dot.addEventListener("click", () => goTo(i));
    dots.appendChild(dot);
  });
  const sum = $("summary-main");
  sum.textContent = textFor(DEMO.summary);
  setTextLanguage(sum, isTranslated(DEMO.summary));
  $("summary-en").textContent = DEMO.summary.en;
  $("summary-en").hidden = !isTranslated(DEMO.summary);
  renderScene();
}

function renderScene() {
  const scene = DEMO.scenes[idx];
  const translated = isTranslated(scene.caption);
  $("stage").innerHTML = illustrationSVG(scene.illustration);
  const main = $("caption-main");
  main.textContent = textFor(scene.caption);
  setTextLanguage(main, translated);
  replayAnimation(main);
  $("caption-en").textContent = scene.caption.en;
  $("caption-en").hidden = !translated;
  $("why-label").textContent = scene.app_note ? "About this last scene:" : "From the appointment:";
  $("why-quote").textContent = scene.app_note ? scene.excerpt : "\\u201C" + scene.excerpt + "\\u201D";
  $("why-panel").hidden = true;
  $("why-btn").setAttribute("aria-expanded", "false");
  $("why-btn").textContent = scene.app_note
    ? "Why this? Where this note comes from"
    : "Why this? Show the doctor's words";
  [...$("dots").children].forEach((d, i) => {
    d.classList.toggle("on", i === idx);
    if (i === idx) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current");
  });
  $("prev-btn").disabled = idx === 0;
  $("next-btn").disabled = idx === DEMO.scenes.length - 1;
  updatePlayButton();
}

function updatePlayButton() {
  const atEnd = idx === DEMO.scenes.length - 1;
  const btn = $("play-btn");
  btn.textContent = playing ? "\\u23F8" : (atEnd ? "\\u21BB" : "\\u25B6");
  btn.setAttribute("aria-label", playing ? "Pause" : atEnd ? "Play again from the start" : "Play");
}

function play() { playing = true; updatePlayButton(); speakCurrentScene(); }

function pause() {
  playing = false; speakToken++;
  clearTimeout(advanceTimer);
  if (window.speechSynthesis) speechSynthesis.cancel();
  updatePlayButton();
}

function goTo(i) { idx = i; renderScene(); if (playing) speakCurrentScene(); }

function speakCurrentScene() {
  const token = ++speakToken;
  clearTimeout(advanceTimer);
  const scene = DEMO.scenes[idx];
  const translated = isTranslated(scene.caption);
  const text = textFor(scene.caption);
  const voiceLang = translated ? LANG_META[lang].tts : "en-US";

  const advance = (delayMs) => {
    if (token !== speakToken || !playing) return;
    clearTimeout(advanceTimer);
    advanceTimer = setTimeout(() => {
      if (token !== speakToken || !playing) return;
      if (idx < DEMO.scenes.length - 1) goTo(idx + 1);
      else { playing = false; updatePlayButton(); }
    }, delayMs);
  };

  const fallbackMs = 3000 + text.length * 70;
  if (!window.speechSynthesis) { advance(fallbackMs); return; }

  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = voiceLang;
  utter.rate = 0.95;
  const wanted = voiceLang.split("-")[0];
  const voice = speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").startsWith(wanted));
  if (voice) utter.voice = voice;

  const watchdog = setTimeout(() => advance(fallbackMs), 1500);
  utter.onstart = () => clearTimeout(watchdog);
  utter.onend = () => { clearTimeout(watchdog); advance(900); };
  utter.onerror = () => { clearTimeout(watchdog); advance(fallbackMs); };
  speechSynthesis.speak(utter);
}

if (window.speechSynthesis) speechSynthesis.getVoices();

$("play-btn").addEventListener("click", () => {
  if (playing) { pause(); return; }
  if (idx === DEMO.scenes.length - 1) { idx = 0; renderScene(); }
  play();
});
$("prev-btn").addEventListener("click", () => { if (idx > 0) goTo(idx - 1); });
$("next-btn").addEventListener("click", () => { if (idx < DEMO.scenes.length - 1) goTo(idx + 1); });
$("why-btn").addEventListener("click", () => {
  const panel = $("why-panel");
  panel.hidden = !panel.hidden;
  $("why-btn").setAttribute("aria-expanded", String(!panel.hidden));
  if (!panel.hidden) pause();
});
$("restart-link").addEventListener("click", (e) => { e.preventDefault(); pause(); showScreen("input"); });
</script>
`;

fs.writeFileSync(path.join(ROOT, "demo.html"), html);
console.log("Built demo.html (" + Math.round(html.length / 1024) + " KB) — open it in any browser.");
