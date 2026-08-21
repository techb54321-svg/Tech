// ============================================================
// app.js — the app around the player.
//
// The app is four "screens" (sections in index.html); we show
// one at a time. The flow is:
//   consent  →  input  →  processing  →  player
//
// This file handles the first three screens and talking to the
// server. Watching the finished video is player.js's job — this
// file hands it data with loadPlayer(...) and play().
//
// The browser's own speech recognition is used for the optional
// live transcription while recording; pasting always works.
// ============================================================

// ---- The screens ----------------------------------------------------
// ($ comes from player.js, loaded just before this file.)
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

let requestCount = 0; // rises with each "make my video", so old answers can be ignored

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
  const chosenLang = $("language-select").value;

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
      body: JSON.stringify({ transcript, language: chosenLang }),
    });
    const body = await res.json();
    if (myRequest !== requestCount) return; // the user moved on — drop it
    if (!res.ok) throw new Error(body.error || "Something went wrong.");

    loadPlayer(body, chosenLang);  // hand the video to the player
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

// ---- Leaving the player --------------------------------------------
$("restart-link").addEventListener("click", (e) => {
  e.preventDefault();
  pause();
  showScreen("input");
});
