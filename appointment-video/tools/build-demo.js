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

const html = `<title>Visit Recap Demo</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&display=swap">

<style>
/* ---------- The page around the phone ---------- */
:root {
  --page-bg: #efe7dc;
  --page-ink: #40382f;
  --page-muted: #7a6d5f;
  --page-card: #fffdfa;
  --page-line: #ddd0be;
  --page-accent: #c0362c;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --page-bg: #241f1b;
    --page-ink: #f0e7dc;
    --page-muted: #b0a294;
    --page-card: #2f2823;
    --page-line: #463c34;
    --page-accent: #f0897d;
  }
}
:root[data-theme="dark"] {
  --page-bg: #241f1b;
  --page-ink: #f0e7dc;
  --page-muted: #b0a294;
  --page-card: #2f2823;
  --page-line: #463c34;
  --page-accent: #f0897d;
}

body {
  margin: 0;
  background: var(--page-bg);
  color: var(--page-ink);
  font-family: Nunito, ui-rounded, "Segoe UI", system-ui, sans-serif;
  line-height: 1.6;
}
.wrap {
  max-width: 1040px; margin: 0 auto;
  padding: 28px 18px 60px;
  display: flex; flex-direction: column; gap: 26px;
}
.intro h1 {
  font-size: clamp(1.7rem, 5vw, 2.5rem);
  font-weight: 800; letter-spacing: -0.5px;
  margin: 0 0 6px; text-wrap: balance;
}
.intro .lede { font-size: 1.08rem; margin: 0 0 4px; max-width: 62ch; }
.intro .sub { color: var(--page-muted); margin: 0; max-width: 62ch; }

.notice {
  background: var(--page-card);
  border: 1px solid var(--page-line);
  border-left: 5px solid var(--page-accent);
  border-radius: 12px;
  padding: 14px 16px;
  max-width: 62ch;
}
.notice p { margin: 0 0 8px; }
.notice p:last-child { margin: 0; }
.notice strong { font-weight: 800; }
.notice code {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.88em; background: var(--page-bg);
  padding: 1px 5px; border-radius: 5px;
}
.notice a { color: var(--page-accent); }

/* On a wide screen, show the app inside a phone outline, with notes
   beside it. On a real phone, the app simply fills the page. */
.stage-row { display: flex; flex-direction: column; gap: 26px; }
.phone { width: 100%; }
.phone-inner {
  background: #faf6f0;      /* the app's own paper colour, both themes */
  color: #3a3330;
  border-radius: 20px;
  overflow: hidden;
}
.side { display: flex; flex-direction: column; gap: 18px; }
.side h2 { font-size: 1.05rem; margin: 0 0 4px; font-weight: 800; }
.side p { margin: 0; color: var(--page-muted); font-size: 0.95rem; }
.side ul { margin: 6px 0 0; padding-left: 20px; color: var(--page-muted); font-size: 0.95rem; }
.side li { margin-bottom: 5px; }

@media (min-width: 880px) {
  .stage-row { flex-direction: row; align-items: flex-start; gap: 40px; }
  .phone { width: 400px; flex: none; position: sticky; top: 24px; }
  .phone-inner {
    border: 12px solid #2c2621;
    border-radius: 40px;
    box-shadow: 0 18px 44px rgba(40, 30, 20, 0.28);
    max-height: 78vh; overflow-y: auto;
  }
  .side { flex: 1; padding-top: 6px; }
}

footer {
  border-top: 1px solid var(--page-line);
  padding-top: 18px; color: var(--page-muted); font-size: 0.88rem;
}
footer a { color: var(--page-accent); }

/* ---------- The app's own stylesheet, unchanged ---------- */
/* Scoped under .phone-inner so it can't affect the page around it. */
${appStyles
  .replace(/^body \{/m, ".phone-inner {")
  .replace(/^header \{/m, ".phone-inner header {")
  .replace(/^footer \{/m, ".phone-inner footer {")
  .replace(/^\.screen \{/m, ".phone-inner .screen {")}
</style>

<div class="wrap">
  <div class="intro">
    <h1>Visit Recap</h1>
    <p class="lede">A recording of a doctor's appointment, turned into a short picture-video
      the patient and their family can actually understand — in their own language.</p>
    <p class="sub">This page is the real app, running live. Try it below.</p>
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

    <div class="side">
      <div>
        <h2>What it does</h2>
        <p>An appointment is a lot to take in, and most summaries are written at a
          reading level that leaves people behind. This turns one into six pictures
          with short captions, read aloud, in the language the family speaks at home.</p>
      </div>
      <div>
        <h2>How to read it</h2>
        <ul>
          <li>Scenes play by themselves, like a video. Use &#9654; and the arrows to move around.</li>
          <li>Pick a language at the start — the caption switches, with English kept underneath.</li>
          <li><strong>"Why this?"</strong> shows the doctor's actual words behind each scene, so
            nothing is taken on trust.</li>
          <li>The last scene is always the same reminder, added by the app rather than
            written by the AI.</li>
        </ul>
      </div>
      <div>
        <h2>The rules it follows</h2>
        <ul>
          <li>It can never state a dose or how often to take something unless those exact
            words were said in the room.</li>
          <li>Anything unclear becomes "Check this with your doctor."</li>
          <li>Pictures come from a fixed set of 15 drawings — the AI chooses from them and
            never draws its own.</li>
        </ul>
      </div>
      <div>
        <h2>If narration is silent</h2>
        <p>The voice comes from your own device. Most phones have English and Chinese
          voices built in; Vietnamese and Arabic depend on what's installed. When a voice
          is missing the scenes still play, just without sound.</p>
      </div>
    </div>
  </div>

  <footer>
    <p>A prototype. Not a medical device, and not medical advice.
      Transcripts in the full app are sent to Anthropic's API to build the summary and are not stored.</p>
  </footer>
</div>

<script>
${illustrations}
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
