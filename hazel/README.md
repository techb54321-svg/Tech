# 🌿 Hazel

A day clock that reminds, a simple way to call family, and help close at hand.
Set up by the family for an older person, and left open on a stand where they sit.

No accounts, no server, no build step. Everything stays on the one device.

## What it does for the person

- **Tells them what time of day it is.** The time, "Monday morning" and the date
  are the biggest things on the screen. At night the screen goes dark and says
  it is night time and that everything is fine.
- **Comes to them when something is due.** A soft chime, a spoken reminder and a
  card that fills the screen, with one button: **I've done this**. Important
  things (tablets) keep coming back for an hour, then stay at the top of the
  first screen until they are answered.
- **Answers "have I taken my tablets?"** Every tick is stamped with the time and
  shown on the first screen ("Morning tablets, done at 8:06 am"). After midnight
  it still says last night's were taken. Tablets can't be ticked hours early,
  and something missed hours ago is asked about carefully ("Check your pill box.
  Don't take extra.") instead of being offered as if it were due.
- **Calls people by tapping their face.** The whole card is the button, with a
  real photo. The number then stays on screen in large print in case the device
  can't start the call.
- **Gets help in two taps.** Get Help → Call 000 (or the right number for the
  country), with "Tell them: my name is…, I am at…" on screen while it rings.
  A Help button sits in the same corner of every screen. There is a calming
  screen for 2 am, and a "My details" card for a paramedic or nurse.
- **Forgives a shaky hand.** Taps that land straight after the screen changes
  are ignored, so a double tap can't tick something by accident. Anything
  ticked or removed can be taken back.
- **Reads itself aloud**, and the writing can be made bigger from the first screen.

## What it does for the family

Open **Family settings** from the first screen (press and hold for two seconds,
or enter the PIN if one is set).

- **Set-up in a couple of minutes**: who it is for, country, people to call, and
  a routine picked from common items.
- **A real week**: every day, chosen days ("bin night"), or one date (an
  appointment, with an optional warning beforehand). "Coming up" and "Tomorrow"
  appear by themselves, and old appointments remove themselves.
- **A note on the first screen** ("I'll come over on Saturday") that takes itself
  down after a date.
- **What was ticked, and when**, for two weeks, by name, with a text summary to
  paste into the family chat. A tick that was taken back is noted.
- **People**: photos, order, and how each is called (phone or FaceTime).
- **Details for an emergency**: full name, address, date of birth, conditions,
  medicines, allergies, doctor.
- **"Is Hazel ready?"** checklist, **Try a reminder now**, and a **backup copy**
  to restore after a new or cleared device (also the way back from a forgotten PIN).

## What it cannot do

Hazel is a web page with local storage. Be clear with the family about this:

- **It only reminds while it is open on the screen.** Stand the device where the
  person sits, keep it plugged in, leave Hazel showing, and tap the screen once
  after opening so the sound is switched on.
- **Nothing reaches the family's own phones.** The record lives on the device.
  Seeing it from elsewhere, changing the plan remotely, or an alert when tablets
  are not ticked all need a server and accounts.
- **It is not an alarm and not a medical record.** A tick means the button was
  tapped. Someone at risk of falls still needs a pendant or watch alarm, and
  the pill box or pharmacy pack still does the real work.

## Running it

Serve the folder and open it:

```
npx serve hazel        # or: python3 -m http.server --directory hazel
```

On the person's tablet or phone, open the address and choose **Add to Home
Screen**. Hazel then opens like an app and keeps working without the internet.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page shell |
| `app.js` | Screens, reminders, storage |
| `styles.css` | Look and feel |
| `sw.js` | Offline caching |
| `manifest.webmanifest`, `icon.svg`, `icon-*.png`, `apple-touch-icon.png` | Home-screen app metadata and icons |

## Emergency numbers

The country is chosen at set-up (guessed from the device's time zone, and always
shown for the family to confirm): Australia 000, New Zealand 111, United Kingdom
999, Ireland 112, United States and Canada 911, elsewhere 112. Help lines shown
alongside are listed in `REGIONS` at the top of `app.js`.
