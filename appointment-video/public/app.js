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

// A realistic example appointment, for trying the app quickly.
const EXAMPLE_TRANSCRIPT = `Doctor: Good morning. So I've looked at the readings you brought in, and your blood pressure is still running a bit high — around 150 over 95 most mornings.
Patient: Is that dangerous?
Doctor: It's not an emergency, but we should treat it. I'd like to start you on amlodipine 5 milligrams, one tablet once a day, in the morning. Some people get a little ankle swelling with it — if that happens, give the clinic a call.
Patient: Okay.
Doctor: I also want you to get a blood test next week before we go any further — just kidney function and cholesterol, the form is at reception.
Patient: Do I need to change anything else?
Doctor: The two big ones are a 30 minute walk most days, and cutting down on salty food — takeaway and packet soups are the main culprits. And keep drinking plenty of water.
Patient: What about the dizziness I mentioned?
Doctor: That could be a few different things, we'll see what the blood test says first. If it gets worse, don't wait — ring us straight away.
Doctor: Let's book you in to see you again in four weeks to check the pressure. Reception can set that up on your way out.`;

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
}

// ---- App state ------------------------------------------------------
let data = null;        // the summary + scenes from the server
let lang = "en";        // chosen language code
let idx = 0;            // which scene is showing
let playing = false;    // is the "video" running?
let speakToken = 0;     // rises every time speech starts, so old callbacks can be ignored
let advanceTimer = null; // timer that moves to the next scene

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
$("example-link").addEventListener("click", (e) => {
  e.preventDefault();
  $("transcript-input").value = EXAMPLE_TRANSCRIPT;
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
  note.textContent = "Recording needs a secure page (https or localhost) — on this address, paste the transcript below instead.";
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
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      stopRecording();
      showInputError("Microphone was blocked. Allow the microphone in your browser, or paste the transcript instead.");
    }
    // other errors (like "no-speech") are harmless; onend will restart
  };

  recognition.start();
  $("record-btn").textContent = "⏹ Stop recording";
  $("record-btn").classList.add("recording");
  $("record-status").hidden = false;
}

function stopRecording() {
  recording = false;
  if (recognition) recognition.stop();
  $("record-btn").textContent = "🎙️ Record the appointment";
  $("record-btn").classList.remove("recording");
  $("record-status").hidden = true;
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

  // Show the "working on it" screen.
  $("processing-error").hidden = true;
  $("processing-back").hidden = true;
  $("processing-spinner").hidden = false;
  $("processing-title").textContent = "Making your video…";
  $("processing-text").hidden = false;
  showScreen("processing");

  try {
    const res = await fetch("/api/scenes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, language: lang }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Something went wrong.");

    data = body;
    buildPlayer();
    showScreen("player");
    play(); // start the show automatically
  } catch (err) {
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

$("processing-back").addEventListener("click", () => showScreen("input"));

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
  const isEnglish = lang === "en";
  const sumMain = $("summary-main");
  sumMain.textContent = isEnglish ? data.summary : data.summary_translated;
  setTextLanguage(sumMain);
  $("summary-en").textContent = data.summary;
  $("summary-en").hidden = isEnglish;

  renderScene();
}

// Give an element the right language + writing direction,
// so Arabic reads right-to-left and screen readers say it properly.
function setTextLanguage(el) {
  el.lang = lang === "zh" ? "zh-CN" : lang;
  el.dir = LANG_META[lang].rtl ? "rtl" : "ltr";
}

function renderScene() {
  const scene = data.scenes[idx];

  // Big picture (from the fixed library — see illustrations.js).
  $("stage").innerHTML = illustrationSVG(scene.illustration);

  // Caption in the chosen language, English in small print underneath.
  const main = $("caption-main");
  main.textContent = lang === "en" ? scene.caption : scene.caption_translated;
  setTextLanguage(main);
  $("caption-en").textContent = scene.caption;
  $("caption-en").hidden = lang === "en";

  // The "why this?" quote for this scene.
  $("why-quote").textContent = "“" + scene.excerpt + "”";
  $("why-panel").hidden = true;

  // Update dots and button states.
  [...$("dots").children].forEach((d, i) => d.classList.toggle("on", i === idx));
  $("prev-btn").disabled = idx === 0;
  $("next-btn").disabled = idx === data.scenes.length - 1;
  updatePlayButton();
}

function updatePlayButton() {
  const atEnd = idx === data.scenes.length - 1;
  $("play-btn").textContent = playing ? "⏸" : (atEnd && !playing ? "↻" : "▶");
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
  const text = lang === "en" ? scene.caption : scene.caption_translated;

  // If this scene finishes and we're still playing, move on.
  const advance = (delayMs) => {
    if (token !== speakToken || !playing) return; // stale — ignore
    advanceTimer = setTimeout(() => {
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
  utter.lang = LANG_META[lang].tts;
  utter.rate = 0.95; // a touch slower than normal — easier to follow

  // Use a matching installed voice if there is one (e.g. a Vietnamese voice).
  const wanted = LANG_META[lang].tts.split("-")[0];
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
  if (!panel.hidden) pause(); // pause so there's time to read
});

$("restart-link").addEventListener("click", (e) => {
  e.preventDefault();
  pause();
  showScreen("input");
});
