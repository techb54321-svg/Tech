// ============================================================
// app.js — everything the browser does.
//
// The app is four "screens" (sections in index.html); we show
// one at a time. The flow is:
//   consent  →  input  →  processing  →  player
//
// The browser's own speech features are used for the extras:
//   - SpeechRecognition: live transcription while recording
//   - speechSynthesis:   reading captions aloud
// Both are optional — pasting a transcript always works.
// ============================================================

// ---- Languages ------------------------------------------------------
// "tts" is the voice language for reading aloud.
// "rtl" marks right-to-left writing (Arabic).
const LANG_META = {
  en: { tts: "en-US" },
  vi: { tts: "vi-VN" },
  ar: { tts: "ar-SA", rtl: true },
  zh: { tts: "zh-CN" },
};

// ---- Grab the page elements we need --------------------------------
const $ = (id) => document.getElementById(id);
const screens = {
  consent: $("screen-consent"),
  input: $("screen-input"),
  processing: $("screen-processing"),
  player: $("screen-player"),
};

function showScreen(name) {
  for (const el of Object.values(screens)) el.classList.remove("active");
  screens[name].classList.add("active");
  window.scrollTo(0, 0);
  // Move the reading position to the new screen's heading, so people using
  // a screen reader or keyboard land in the right place instead of the top.
  const heading = screens[name].querySelector("h2");
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
}

// ---- App state ------------------------------------------------------
let data = null;        // the summary + scenes from the server
let lang = "en";        // chosen language code
let idx = 0;            // which scene is showing
let playing = false;    // is the "video" running?
let speakToken = 0;     // rises every time speech starts, so old callbacks can be ignored
let advanceTimer = null; // timer that moves to the next scene
let requestCount = 0;   // rises with each "make my video", so old answers can be ignored

// ============================================================
// SCREEN 1: consent
// ============================================================
$("consent-tick").addEventListener("change", (e) => {
  $("consent-continue").disabled = !e.target.checked;
});
$("consent-continue").addEventListener("click", () => showScreen("input"));

// ============================================================
// SCREEN 2: input (record or paste)
// ============================================================
$("example-link").addEventListener("click", async (e) => {
  e.preventDefault();
  // The example lives in content.json so the app and the demo page agree.
  try {
    const res = await fetch("/content.json");
    $("transcript-input").value = (await res.json()).demoTranscript;
  } catch {
    showInputError("Could not load the example. Please paste a transcript instead.");
  }
});

// ---- Live recording (optional extra; Chrome and Edge support it) ----
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let recording = false;
let recordedText = ""; // finished sentences so far

if (!SpeechRec) {
  // This browser can't transcribe — hide the button, pasting still works.
  $("record-box").hidden = true;
  const note = $("record-note");
  note.hidden = false;
  note.textContent = "Live recording isn't supported in this browser — paste the transcript below instead. (Chrome or Edge can record.)";
} else if (!window.isSecureContext) {
  // Microphones only work on https:// or on localhost.
  $("record-box").hidden = true;
  const note = $("record-note");
  note.hidden = false;
  note.textContent = "Recording doesn't work at this web address — please paste the transcript below instead. (It works on the computer running the app, or when the address starts with https.)";
}

$("record-btn").addEventListener("click", () => {
  if (recording) stopRecording();
  else startRecording();
});

function startRecording() {
  recording = true;
  // Keep anything already typed, then add what we hear.
  recordedText = $("transcript-input").value.trim();
  if (recordedText) recordedText += "\n";

  recognition = new SpeechRec();
  recognition.lang = "en-US";        // language *spoken in the room*
  recognition.continuous = true;      // keep going, don't stop after one sentence
  recognition.interimResults = true;  // show words while they're still being worked out

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) recordedText += piece.trim() + " ";
      else interim += piece;
    }
    $("transcript-input").value = recordedText + interim;
  };

  // Browsers stop listening after a silence — restart until the user taps stop.
  recognition.onend = () => { if (recording) recognition.start(); };

  recognition.onerror = (event) => {
    // A short silence ("no-speech") is normal — onend just starts listening
    // again. Everything else is a real problem: stop, and say what happened,
    // otherwise we would restart forever and the user would wait for nothing.
    if (event.error === "no-speech") return;
    stopRecording();
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      showInputError("The microphone was blocked. Allow the microphone in your browser, or paste the transcript below instead.");
    } else if (event.error === "network") {
      showInputError("Live transcribing needs an internet connection and it can't reach the service. Please paste the transcript below instead.");
    } else if (event.error === "audio-capture") {
      showInputError("No microphone was found. Plug one in, or paste the transcript below instead.");
    } else {
      showInputError("Recording stopped unexpectedly. Please try again, or paste the transcript below instead.");
    }
  };

  recognition.start();
  $("record-btn").textContent = "⏹ Stop recording";
  $("record-btn").classList.add("recording");
  $("record-status").hidden = false;
  // While we're writing into the box, typing in it would be overwritten
  // on the next word heard — so lock it until recording stops.
  $("transcript-input").readOnly = true;
}

function stopRecording() {
  recording = false;
  if (recognition) {
    // Forget this listener completely before stopping it. Otherwise its
    // final "end" event could restart a recogniser we've finished with.
    recognition.onresult = null;
    recognition.onend = null;
    recognition.onerror = null;
    recognition.stop();
    recognition = null;
  }
  $("record-btn").textContent = "🎙️ Record the appointment";
  $("record-btn").classList.remove("recording");
  $("record-status").hidden = true;
  $("transcript-input").readOnly = false;
}

function showInputError(message) {
  const el = $("input-error");
  el.textContent = message;
  el.hidden = false;
}

// ---- "Make my video" → send transcript to our little server ---------
$("generate-btn").addEventListener("click", async () => {
  $("input-error").hidden = true;
  if (recording) stopRecording();

  const transcript = $("transcript-input").value.trim();
  if (transcript.length < 40) {
    showInputError("Please add the appointment first — record it, paste it, or tap the example link.");
    return;
  }
  lang = $("language-select").value;

  // Phones (especially iPhones) only allow speech to start as a direct
  // result of a tap. Say an empty phrase now, while we still count as
  // "being tapped", so the narration is allowed to speak later.
  if (window.speechSynthesis) {
    try { speechSynthesis.speak(new SpeechSynthesisUtterance("")); } catch { /* ignore */ }
  }

  // Show the "working on it" screen.
  $("processing-error").hidden = true;
  $("processing-back").hidden = true;
  $("processing-spinner").hidden = false;
  $("processing-title").textContent = "Making your video…";
  $("processing-text").hidden = false;
  showScreen("processing");

  // Remember which request this is. If the user presses Back and starts
  // again, the older answer must not jump them into the player.
  const myRequest = ++requestCount;

  try {
    const res = await fetch("/api/scenes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, language: lang }),
    });
    const body = await res.json();
    if (myRequest !== requestCount) return; // the user moved on — drop it
    if (!res.ok) throw new Error(body.error || "Something went wrong.");

    data = body;
    buildPlayer();
    showScreen("player");
    play(); // start the show automatically
  } catch (err) {
    if (myRequest !== requestCount) return; // the user moved on — stay quiet
    $("processing-spinner").hidden = true;
    $("processing-title").textContent = "That didn't work";
    $("processing-text").hidden = true;
    const el = $("processing-error");
    el.textContent = err.message === "Failed to fetch"
      ? "Could not reach the server. Is it still running?"
      : err.message;
    el.hidden = false;
    $("processing-back").hidden = false;
  }
});

$("processing-back").addEventListener("click", () => {
  requestCount++; // any answer still on its way is now out of date
  showScreen("input");
});

// ============================================================
// SCREEN 4: the player
// ============================================================
function buildPlayer() {
  idx = 0;
  playing = false;

  // One progress dot per scene.
  const dots = $("dots");
  dots.innerHTML = "";
  data.scenes.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.setAttribute("aria-label", "Scene " + (i + 1));
    dot.addEventListener("click", () => { goTo(i); });
    dots.appendChild(dot);
  });

  // The plain-language summary below the player.
  const sumMain = $("summary-main");
  sumMain.textContent = translationOf(data.summary_translated, data.summary);
  setTextLanguage(sumMain, isTranslated(data.summary_translated, data.summary));
  $("summary-en").textContent = data.summary;
  $("summary-en").hidden = !isTranslated(data.summary_translated, data.summary);

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
// but which is itself the same DOM node (a fresh <svg> replays on its
// own; a <p> whose text we just updated needs this nudge instead).
function replayAnimation(el) {
  el.style.animation = "none";
  void el.offsetWidth; // force the browser to notice, before re-enabling
  el.style.animation = "";
}

function renderScene() {
  const scene = data.scenes[idx];
  const translated = isTranslated(scene.caption_translated, scene.caption);

  // Big picture (from the fixed library — see illustrations.js).
  $("stage").innerHTML = illustrationSVG(scene.illustration);

  // Caption in the chosen language, English in small print underneath.
  const main = $("caption-main");
  main.textContent = translationOf(scene.caption_translated, scene.caption);
  setTextLanguage(main, translated);
  replayAnimation(main);
  $("caption-en").textContent = scene.caption;
  $("caption-en").hidden = !translated;

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

  // Update dots and button states.
  [...$("dots").children].forEach((d, i) => {
    d.classList.toggle("on", i === idx);
    // Tells a screen reader which scene we're on.
    if (i === idx) d.setAttribute("aria-current", "true");
    else d.removeAttribute("aria-current");
  });
  $("prev-btn").disabled = idx === 0;
  $("next-btn").disabled = idx === data.scenes.length - 1;
  updatePlayButton();
}

function updatePlayButton() {
  const atEnd = idx === data.scenes.length - 1;
  const btn = $("play-btn");
  btn.textContent = playing ? "⏸" : (atEnd && !playing ? "↻" : "▶");
  // Keep the spoken label in step with the symbol.
  btn.setAttribute("aria-label", playing ? "Pause" : atEnd ? "Play again from the start" : "Play");
}

// ---- Reading aloud + moving to the next scene ----------------------
function play() {
  playing = true;
  updatePlayButton();
  speakCurrentScene();
}

function pause() {
  playing = false;
  speakToken++; // makes any in-flight speech callbacks stale
  clearTimeout(advanceTimer);
  if (window.speechSynthesis) speechSynthesis.cancel();
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

  const scene = data.scenes[idx];
  const translated = isTranslated(scene.caption_translated, scene.caption);
  const text = translationOf(scene.caption_translated, scene.caption);
  // Read English words with an English voice, even in another language mode.
  const voiceLang = translated ? LANG_META[lang].tts : "en-US";

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
      if (idx < data.scenes.length - 1) goTo(idx + 1);
      else { playing = false; updatePlayButton(); } // the end
    }, delayMs);
  };

  // How long to show the scene if speech isn't available: reading time.
  const fallbackMs = 3000 + text.length * 70;

  if (!window.speechSynthesis) {
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
  // this language), fall back to a simple timer.
  const watchdog = setTimeout(() => advance(fallbackMs), 1500);
  utter.onstart = () => clearTimeout(watchdog);
  utter.onend = () => { clearTimeout(watchdog); advance(900); };
  utter.onerror = () => { clearTimeout(watchdog); advance(fallbackMs); };

  speechSynthesis.speak(utter);
}

// Some browsers load their voice list late — this nudges them early.
if (window.speechSynthesis) speechSynthesis.getVoices();

// ---- Player buttons -------------------------------------------------
$("play-btn").addEventListener("click", () => {
  if (playing) { pause(); return; }
  // Pressing play at the very end starts the video over.
  if (idx === data.scenes.length - 1) { idx = 0; renderScene(); }
  play();
});

$("prev-btn").addEventListener("click", () => { if (idx > 0) goTo(idx - 1); });
$("next-btn").addEventListener("click", () => { if (idx < data.scenes.length - 1) goTo(idx + 1); });

$("why-btn").addEventListener("click", () => {
  const panel = $("why-panel");
  panel.hidden = !panel.hidden;
  $("why-btn").setAttribute("aria-expanded", String(!panel.hidden));
  if (!panel.hidden) pause(); // pause so there's time to read
});

$("restart-link").addEventListener("click", (e) => {
  e.preventDefault();
  pause();
  showScreen("input");
});
