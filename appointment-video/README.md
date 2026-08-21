# Visit Recap

Turn a recording (or transcript) of a doctor's appointment into a short,
simple "video" — an auto-playing slideshow of hand-drawn stick-figure
scenes with captions and spoken narration — so patients and their
families can understand what happened, in their own language.

Languages: **English, Tiếng Việt, العربية, 简体中文.**

## What you need

- [Node.js](https://nodejs.org) 18 or newer (this is the only thing to install)
- An Anthropic API key from <https://console.anthropic.com/>
  (or skip it and use demo mode — see below)

## Set up (once)

```bash
cd appointment-video
npm install                 # downloads the one package the server needs
cp .env.example .env        # then open .env and paste in your API key
```

Your API key lives only in `.env` on your computer. The browser never
sees it — the little server in `server.js` makes the AI calls for it.

## Run it

```bash
npm start
```

Then open **http://localhost:3000** on your computer.

**On your phone:** connect the phone to the same Wi-Fi, and open the
"On your phone" address the server prints when it starts
(something like `http://192.168.1.23:3000`).

### No API key yet? Demo mode

```bash
MOCK=1 npm start
```

Everything works, but the "AI" answer is a canned example — good for a
quick look at the flow and the player.

### A shareable demo page

```bash
npm run demo
```

This builds `demo.html` — one self-contained file with no server and no
API key needed. It uses the same drawings, styles and example
appointment as the real app, and replays one prepared appointment so you
can show someone how it works, or open it on a phone. Email it, or put
it on any web host.

It cannot read a *new* recording — that needs the API key, which has to
stay on a server.

### On Windows

The commands above are written for macOS and Linux. In Windows Command
Prompt, use `copy .env.example .env` instead of `cp`, and instead of
putting `MOCK=1` or `PORT=` in front of `npm start`, open `.env` and
remove the `#` in front of the `MOCK=1` (or `PORT=`) line, then just run
`npm start`.

If you see "Port 3000 is already busy", Visit Recap is probably still
running in another window — close it with `Ctrl+C` first.

## How to use it

1. **Consent** — tick the box after asking your doctor about recording.
2. **Add the appointment** — either tap **Record** and let the browser
   transcribe live, or **paste a transcript** (this always works —
   there's also an example link to try it out). Pick a language.
3. **Make my video** — the transcript goes to Claude, which writes a
   grade-5 reading level summary and picks 4–6 scenes. Each scene gets a
   short caption, a translation, and a picture chosen **only** from the
   app's built-in library of 15 stick-figure drawings.
4. **Watch** — scenes auto-play with spoken narration (the browser's own
   text-to-speech). Use ⏮ ▶ ⏭ to move around. Tap **"Why this?"** on any
   scene to see the exact words from the appointment it came from.

Every video ends with a fixed reminder: *"This is a summary, not medical
advice. Ask your clinic if anything is unclear."* That scene is added by
the app itself, never by the AI.

## Good to know

- **Pasting always works.** Live recording needs Chrome or Edge, a
  microphone, and a "secure" page — which means `http://localhost` on
  the computer running the server. On a phone opening `http://192.168…`,
  browsers block the microphone, so use paste there (or put the server
  behind HTTPS, e.g. with a tunnel like ngrok).
- **Narration voices** come from your device. Most phones include
  English and Chinese voices; Vietnamese and Arabic depend on the device
  (iPhones and Androids usually have them, some laptops don't). If a
  voice is missing, the video still plays — scenes just advance on a
  timer.
- **Safety rules built into the AI prompt:** it may never state a
  medicine dose or schedule unless those exact words are in the
  transcript; anything unclear becomes "Check this with your doctor.";
  and it can only pick pictures from the fixed list — it never draws
  its own.
- **Privacy:** the transcript is sent to Anthropic's API to create the
  summary. Nothing is stored by this app.

## The files

| File | What it is |
|---|---|
| `server.js` | Tiny web server + the only code that talks to the Anthropic API |
| `public/index.html` | The four screens of the app |
| `public/app.js` | The browser logic (recording, player, narration) |
| `public/illustrations.js` | The 15 built-in stick-figure SVG drawings |
| `public/styles.css` | The look — warm, big-text, phone-first |
| `public/content.json` | Fixed wording: the disclaimer in 4 languages, and the example appointment |
| `tools/build-demo.js` | Builds `demo.html`, the shareable no-server demo |
| `.env` | Your API key (you create this; never committed to git) |
