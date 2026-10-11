# 🌿 Hazel — A brighter day

A gentle daily companion for an older family member, set up by the people who
care about them. Big buttons, plain words, and nothing to log in to.

## What it does

**For the person using Hazel**

- **My Day** — today's activities in time order, with what's on *now* or coming
  up next. Tap one to see friendly instructions, tap **I've done this** when
  it's finished (and undo it if tapped by mistake). Everything can be read aloud.
- **Call Family** — one big green phone button per person.
- **Get Help** — call family, hear a calming message (with a slow breathing
  flower), or find useful numbers: Triple Zero (000), Lifeline and healthdirect.

**For family (⚙ Family View)**

- **Progress** — what's been ticked off today and over the last 7 days.
- **My Day** — add, edit and remove activities (time, name, instructions, picture).
- **Contacts** — add, edit and remove people and their phone numbers.
- **Settings** — the name Hazel greets them by, text size (Normal / Large /
  Largest), and an optional PIN so Family View isn't opened by accident.

## Running it

No build step. Serve the folder and open it:

```
npx serve hazel        # or: python3 -m http.server --directory hazel
```

Opening `index.html` directly from disk also works (without offline support).
On a phone or tablet, use **Add to Home Screen** — Hazel installs as an app and
keeps working offline.

## Privacy

Everything is stored only in this browser on this device (`localStorage`).
Nothing is sent anywhere and nothing syncs between devices. The Family View PIN
is a light lock against accidental changes, not real security. Ticked-off
activities record that someone tapped the button; they don't verify that the
activity happened.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page shell |
| `app.js` | Screens, storage, actions |
| `styles.css` | Look and feel |
| `manifest.webmanifest`, `icon.svg` | Installable app metadata and icon |
| `sw.js` | Offline caching |
