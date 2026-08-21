// ============================================================
// player.js — the little cinema.
//
// Everything about *watching* the video lives here: the two
// crossfading scene layers, the slow camera drift, the story
// timeline that fills as each scene plays, the captions, and
// the read-aloud narration with auto-advance.
//
// The rest of the app hands it data with:
//   loadPlayer(data, langCode)   then   play()
// where data is { summary, summary_translated, scenes: [...] }
// exactly as the server returns it.
//
// This file is shared: the real app loads it as a script, and
// the shareable demo page embeds a copy of it, so the two always
// behave the same.
// ============================================================

// "tts" is the voice language for reading aloud.
// "rtl" marks right-to-left writing (Arabic).
const LANG_META = {
  en: { tts: "en-US" },
  vi: { tts: "vi-VN" },
  ar: { tts: "ar-SA", rtl: true },
  zh: { tts: "zh-CN" },
};

const $ = (id) => document.getElementById(id);

// ---- Player state ---------------------------------------------------
let playerData = null;  // the summary + scenes being shown
let lang = "en";        // chosen language code
let idx = 0;            // which scene is showing
let playing = false;    // is the "video" running?
let speakToken = 0;     // rises every time speech starts, so old callbacks can be ignored
let advanceTimer = null; // timer that moves to the next scene
let frontLayer = "b";   // which of the two scene layers is showing
let titlePending = false; // show the little opening title card before scene 1?
let muted = false;      // narration + sound effects off?
let audioCtx = null;    // for the tiny scene-change note

// ---- Loading a new video --------------------------------------------
function loadPlayer(data, langCode) {
  playerData = data;
  lang = langCode;
  idx = 0;
  playing = false;
  titlePending = true;       // every new video opens with the title beat
  $("title-card").hidden = true;
  $("title-card").classList.remove("fade");

  // One timeline segment per scene. Tap a segment to jump to its scene.
  const dots = $("dots");
  dots.innerHTML = "";
  playerData.scenes.forEach((_, i) => {
    const seg = document.createElement("button");
    seg.setAttribute("aria-label", "Scene " + (i + 1));
    seg.innerHTML = '<span class="seg"><span class="fill"></span></span>';
    seg.addEventListener("click", () => { goTo(i); });
    dots.appendChild(seg);
  });

  // The plain-language summary below the player.
  const sumMain = $("summary-main");
  sumMain.textContent = translationOf(playerData.summary_translated, playerData.summary);
  setTextLanguage(sumMain, isTranslated(playerData.summary_translated, playerData.summary));
  $("summary-en").textContent = playerData.summary;
  $("summary-en").hidden = !isTranslated(playerData.summary_translated, playerData.summary);

  renderScene();
}

// Did we really get a translation back, or is it just the English again?
// (Demo mode and English itself both give back the same words.)
function isTranslated(translated, english) {
  return lang !== "en" && !!translated && translated !== english;
}
function translationOf(translated, english) {
  return isTranslated(translated, english) ? translated : english;
}

// Give an element the right language + writing direction, so Arabic reads
// right-to-left and screen readers pronounce it properly. Text that isn't
// really translated stays marked as English, so it isn't flipped around.
function setTextLanguage(el, translated) {
  if (!translated) { el.lang = "en"; el.dir = "ltr"; return; }
  el.lang = lang === "zh" ? "zh-CN" : lang;
  el.dir = LANG_META[lang].rtl ? "rtl" : "ltr";
}

// Restarts a CSS entrance animation on an element whose content changed
// but which is itself the same DOM node.
function replayAnimation(el) {
  el.style.animation = "none";
  void el.offsetWidth; // force the browser to notice, before re-enabling
  el.style.animation = "";
}

// Roughly how long a scene stays up when narration can't tell us:
// comfortable reading time for its caption.
function sceneDurationMs(text) {
  return 3000 + text.length * 70;
}

// ---- Drawing a scene ------------------------------------------------
function renderScene() {
  const scene = playerData.scenes[idx];
  const translated = isTranslated(scene.caption_translated, scene.caption);

  // Draw the new scene on the hidden layer, then crossfade to it —
  // that's what makes changes feel like a film cut, not a page load.
  const back = frontLayer === "a" ? "b" : "a";
  const backEl = $("scene-" + back);
  backEl.innerHTML = illustrationSVG(scene.illustration);
  // Alternate the slow camera move so consecutive scenes feel different.
  backEl.querySelector("svg").classList.add(idx % 2 ? "kb-drift" : "kb-zoom");
  backEl.classList.add("front");
  const outgoing = $("scene-" + frontLayer);
  outgoing.classList.remove("front");
  frontLayer = back;
  // Once the old scene has finished fading, take its drawing out of the
  // page — otherwise its animations keep running invisibly, wasting the
  // phone's battery and starving the next scene of smooth frames.
  setTimeout(() => {
    if (!outgoing.classList.contains("front")) outgoing.innerHTML = "";
  }, 600);

  // Caption in the chosen language, English in small print underneath.
  const main = $("caption-main");
  main.textContent = translationOf(scene.caption_translated, scene.caption);
  setTextLanguage(main, translated);
  replayAnimation(main);
  $("caption-en").textContent = scene.caption;
  $("caption-en").hidden = !translated;

  // Hide the previous scene's narration line; the next speak rebuilds it.
  // (Without this, flipping scenes while paused shows stale narration.)
  $("narr-line").hidden = true;

  // The "why this?" quote. The closing reminder is written by the app,
  // so we must not present it as something the doctor said.
  $("why-label").textContent = scene.app_note
    ? "About this last scene:"
    : "From the appointment:";
  $("why-quote").textContent = scene.app_note ? scene.excerpt : "“" + scene.excerpt + "”";
  $("why-panel").hidden = true;
  $("why-btn").setAttribute("aria-expanded", "false");
  $("why-btn").textContent = scene.app_note
    ? "Why this? Where this note comes from"
    : "Why this? Show the doctor's words";

  // Timeline: scenes before this one stay lit, later ones stay empty.
  [...$("dots").children].forEach((b, i) => {
    const fill = b.querySelector(".fill");
    fill.style.transition = "none";
    fill.style.width = i < idx ? "100%" : "0%";
    if (i === idx) b.setAttribute("aria-current", "true");
    else b.removeAttribute("aria-current");
  });

  $("prev-btn").disabled = idx === 0;
  $("next-btn").disabled = idx === playerData.scenes.length - 1;
  updatePlayButton();
}

// Start the current segment filling over roughly the scene's length.
function startSegmentFill(estMs) {
  const seg = $("dots").children[idx];
  if (!seg) return;
  const fill = seg.querySelector(".fill");
  fill.style.transition = "none";
  fill.style.width = "0%";
  void fill.offsetWidth;
  fill.style.transition = `width ${estMs}ms linear`;
  fill.style.width = "100%";
}

// Freeze the current segment where it is (used when pausing).
function freezeSegmentFill() {
  const seg = $("dots").children[idx];
  if (!seg) return;
  const fill = seg.querySelector(".fill");
  const w = getComputedStyle(fill).width;
  fill.style.transition = "none";
  fill.style.width = w;
}

function updatePlayButton() {
  const atEnd = idx === playerData.scenes.length - 1;
  const btn = $("play-btn");
  btn.textContent = playing ? "⏸" : (atEnd && !playing ? "↻" : "▶");
  // Keep the spoken label in step with the symbol.
  btn.setAttribute("aria-label", playing ? "Pause" : atEnd ? "Play again from the start" : "Play");
}

// ---- The score ------------------------------------------------------
// A quiet, music-box-like backing track, synthesised live with the
// browser's own audio — no sound files. Soft pentatonic plucks through
// a gentle echo, so it never fights the narration; it ducks further
// whenever the voice is speaking.
let scoreOn = false;
let scoreGain = null;   // master volume for the music
let scoreTimer = null;  // schedules the next pluck
const SCORE_NOTES = [261.6, 329.6, 392.0, 440.0, 523.3, 659.3]; // C4 pentatony, gentle

let scoreBus = null; // where the plucks play into, ahead of the echo

function ensureScoreGraph() {
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  if (scoreGain) return;
  // Everything — dry notes AND their echo — flows out through scoreGain,
  // so ducking and stopping govern the echo tail too.
  scoreGain = audioCtx.createGain();
  scoreGain.gain.value = 0.05;
  scoreGain.connect(audioCtx.destination);
  scoreBus = audioCtx.createGain();
  scoreBus.gain.value = 1;
  scoreBus.connect(scoreGain);
  // a soft echo: delay fed back into itself through a lowpass
  const delay = audioCtx.createDelay(1.0);
  delay.delayTime.value = 0.42;
  const feedback = audioCtx.createGain();
  feedback.gain.value = 0.32;
  const soften = audioCtx.createBiquadFilter();
  soften.type = "lowpass";
  soften.frequency.value = 1600;
  scoreBus.connect(delay);
  delay.connect(soften);
  soften.connect(feedback);
  feedback.connect(delay);
  soften.connect(scoreGain);
}

function pluck() {
  if (!scoreOn || muted) return;
  try {
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.type = "triangle";
    // wander gently around the low notes, visiting high ones now and then
    const n = SCORE_NOTES[Math.random() < 0.7 ? Math.floor(Math.random() * 4) : 4 + Math.floor(Math.random() * 2)];
    osc.frequency.value = n;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    osc.connect(env).connect(scoreBus);
    osc.start(t);
    osc.stop(t + 1.5);
  } catch { /* never break playback over music */ }
  scoreTimer = setTimeout(pluck, 750 + Math.random() * 1050);
}

function startScore() {
  if (muted || scoreOn || !(window.AudioContext || window.webkitAudioContext)) return;
  try {
    ensureScoreGraph();
    scoreOn = true;
    scoreGain.gain.cancelScheduledValues(audioCtx.currentTime);
    scoreGain.gain.setTargetAtTime(0.05, audioCtx.currentTime, 0.4);
    pluck();
  } catch { /* no audio available */ }
}

function stopScore() {
  scoreOn = false;
  clearTimeout(scoreTimer);
  if (scoreGain && audioCtx) scoreGain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.25);
}

// Duck the music while the voice is talking, lift it between scenes.
function duckScore(down) {
  if (scoreGain && audioCtx && scoreOn) {
    scoreGain.gain.setTargetAtTime(down ? 0.018 : 0.05, audioCtx.currentTime, 0.3);
  }
}

// ---- Karaoke narration ----------------------------------------------
// Split a narration line into word spans. As the speech engine reports
// each word being spoken (utterance boundary events), earlier words
// light up — the text visibly keeps pace with the voice.
function karaokePrepare(el, text) {
  el.classList.remove("all-said");
  // Text without spaces (Chinese) can't be split into words — show it
  // whole and fully lit.
  if (!text.includes(" ")) {
    el.textContent = text;
    el.classList.add("all-said");
    return null;
  }
  el.innerHTML = "";
  const spans = [];
  let offset = 0;
  for (const w of text.split(" ")) {
    const s = document.createElement("span");
    s.className = "k-word";
    s.textContent = w;
    el.appendChild(s);
    el.appendChild(document.createTextNode(" "));
    spans.push({ start: offset, el: s });
    offset += w.length + 1;
  }
  return spans;
}

function karaokeMark(spans, charIndex) {
  if (!spans) return;
  for (const s of spans) if (s.start <= charIndex) s.el.classList.add("said");
}

// A very small, soft two-note chime on scene changes — made with the
// browser's own audio, no sound files. Skipped when muted.
function chime() {
  if (muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.setValueAtTime(880, t + 0.09);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.03, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  } catch { /* no audio — never break playback over a chime */ }
}

// ---- Reading aloud + moving to the next scene ----------------------
function play() {
  playing = true;
  updatePlayButton();
  startScore(); // the music-box score runs underneath the whole film
  // The first play of a video opens on the title card for a moment,
  // like a film — then the story starts.
  if (titlePending) {
    titlePending = false;
    const tc = $("title-card");
    tc.hidden = false;
    tc.classList.remove("fade");
    const token = ++speakToken;
    clearTimeout(advanceTimer);
    chime();
    advanceTimer = setTimeout(() => {
      if (token !== speakToken || !playing) return;
      tc.classList.add("fade");
      setTimeout(() => { tc.hidden = true; }, 500);
      speakCurrentScene();
    }, 1700);
    return;
  }
  speakCurrentScene();
}

function pause() {
  playing = false;
  speakToken++; // makes any in-flight speech callbacks stale
  clearTimeout(advanceTimer);
  if (window.speechSynthesis) speechSynthesis.cancel();
  stopScore();
  freezeSegmentFill();
  updatePlayButton();
}

function goTo(i) {
  idx = i;
  renderScene();
  if (playing) speakCurrentScene();
}

function speakCurrentScene() {
  const token = ++speakToken; // remember which "speak" this is
  clearTimeout(advanceTimer);
  // If the title card is still up (e.g. someone tapped Next during it),
  // clear it — the story is moving now.
  const tc = $("title-card");
  if (!tc.hidden) { tc.classList.add("fade"); setTimeout(() => { tc.hidden = true; }, 500); }

  const scene = playerData.scenes[idx];
  // What we SPEAK is the narration — the fuller storytelling line —
  // while the short caption stays on screen. Older data without a
  // narration falls back to reading the caption.
  const hasNarration = !!scene.narration;
  const translated = hasNarration
    ? isTranslated(scene.narration_translated, scene.narration)
    : isTranslated(scene.caption_translated, scene.caption);
  const text = hasNarration
    ? translationOf(scene.narration_translated, scene.narration)
    : translationOf(scene.caption_translated, scene.caption);
  // Read English words with an English voice, even in another language mode.
  const voiceLang = translated ? LANG_META[lang].tts : "en-US";

  const fallbackMs = sceneDurationMs(text);
  startSegmentFill(fallbackMs);
  chime();

  // The narration line under the caption, ready to light up word by
  // word as the voice speaks it.
  const narrEl = $("narr-line");
  const captionShown = translationOf(scene.caption_translated, scene.caption);
  let spans = null;
  if (hasNarration && text !== captionShown) {
    setTextLanguage(narrEl, translated);
    spans = karaokePrepare(narrEl, text);
    narrEl.hidden = false;
  } else {
    narrEl.hidden = true;
  }

  // If this scene finishes and we're still playing, move on.
  // Two guards matter here: clear any timer we already set (the watchdog
  // below and the real "finished speaking" event can both call this), and
  // check again when the timer actually fires — by then the user may have
  // pressed pause or skipped to another scene.
  const advance = (delayMs) => {
    if (token !== speakToken || !playing) return; // stale — ignore
    clearTimeout(advanceTimer);
    advanceTimer = setTimeout(() => {
      if (token !== speakToken || !playing) return; // changed while waiting
      if (idx < playerData.scenes.length - 1) goTo(idx + 1);
      else { playing = false; stopScore(); updatePlayButton(); } // the end
    }, delayMs);
  };

  if (!window.speechSynthesis || muted) {
    // No voice — show the whole narration line lit, advance on the clock.
    narrEl.classList.add("all-said");
    advance(fallbackMs);
    return;
  }

  speechSynthesis.cancel(); // stop anything still talking
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = voiceLang;
  utter.rate = 0.95; // a touch slower than normal — easier to follow

  // Use a matching installed voice if there is one (e.g. a Vietnamese voice).
  const wanted = voiceLang.split("-")[0];
  const voice = speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").startsWith(wanted));
  if (voice) utter.voice = voice;

  // Safety net: if the browser never starts speaking (e.g. no voice for
  // this language), fall back to a simple timer — minus the time we
  // already waited, so the scene and its timeline segment end together.
  const watchdog = setTimeout(() => {
    // The voice never started — light the whole narration line so it
    // doesn't sit dimmed for the rest of the scene.
    if (token === speakToken) narrEl.classList.add("all-said");
    advance(Math.max(0, fallbackMs - 1500));
  }, 1500);
  utter.onstart = () => {
    clearTimeout(watchdog);
    // If the voice took so long to start that the watchdog already armed
    // an advance, cancel it — once real speech is running, finishing the
    // sentence is what decides when to move on, not the timer.
    if (token === speakToken) clearTimeout(advanceTimer);
    duckScore(true);
  };
  // As each word is spoken, light it up in the narration line.
  utter.onboundary = (e) => {
    if (token === speakToken) karaokeMark(spans, e.charIndex || 0);
  };
  utter.onend = () => {
    clearTimeout(watchdog);
    karaokeMark(spans, Infinity);
    duckScore(false);
    advance(900);
  };
  utter.onerror = () => {
    clearTimeout(watchdog);
    // Cancelling speech (pause, skipping ahead) fires an error on the OLD
    // utterance — which must not touch the NEW scene's narration line.
    if (token !== speakToken) return;
    narrEl.classList.add("all-said");
    duckScore(false);
    advance(fallbackMs);
  };

  speechSynthesis.speak(utter);
}

// Some browsers load their voice list late — this nudges them early.
if (window.speechSynthesis) speechSynthesis.getVoices();

// ---- Player buttons -------------------------------------------------
$("play-btn").addEventListener("click", () => {
  if (playing) { pause(); return; }
  // Pressing play at the very end starts the video over.
  if (idx === playerData.scenes.length - 1) { idx = 0; renderScene(); }
  play();
});

$("prev-btn").addEventListener("click", () => { if (idx > 0) goTo(idx - 1); });
$("next-btn").addEventListener("click", () => { if (idx < playerData.scenes.length - 1) goTo(idx + 1); });

// Sound on/off: silences the narration and the little chime. Scenes
// keep advancing on the reading-time clock instead.
$("mute-btn").addEventListener("click", () => {
  muted = !muted;
  const btn = $("mute-btn");
  btn.textContent = muted ? "🔇" : "🔊";
  btn.setAttribute("aria-label", muted ? "Turn sound on" : "Turn sound off");
  if (muted) {
    if (window.speechSynthesis) speechSynthesis.cancel();
    stopScore();
  } else if (playing) {
    startScore();
  }
  // If we're mid-scene, restart it under the new sound setting.
  if (playing) speakCurrentScene();
});

$("why-btn").addEventListener("click", () => {
  const panel = $("why-panel");
  panel.hidden = !panel.hidden;
  $("why-btn").setAttribute("aria-expanded", String(!panel.hidden));
  if (!panel.hidden) pause(); // pause so there's time to read
});
