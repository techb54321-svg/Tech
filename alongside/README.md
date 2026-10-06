# Alongside

A simple daily helper for an older person, with family support behind the scenes.

The parent sees **one screen** and never moves to another: a board of flat colour tiles with the day and time in
big letters. Questions that are due now, today's outings, calls, a taxi, a word search, today's photo and music
all work inside their tiles. Family members do the setup in a separate, signed-in family area.

> Alongside supports everyday routines. It is **not** an emergency or monitoring service.

## Quick start

Requires **Node.js 22.13 or newer**. Node's built-in SQLite is used, so there is no native build step.

```bash
cd alongside
npm install
npm run build
npm start              # http://127.0.0.1:8787
```

Open the address and choose **Try the demonstration**. This creates an isolated demo household with fictional people
and places, and opens the parent's home screen. Use the small **Family setup** link at the bottom to reach the
family area. In the demonstration no calls, texts or bookings are made, and the demo household is deleted after 3 days.

Browser-only preview (no server, for sharing a quick look):

```bash
npm run build:preview   # writes dist-static/alongside-preview.html
```

The preview runs the same screens against an in-browser stand-in for the API (`src/demo/localApi.ts`), with
demonstration data kept in that browser only. Accounts, device pairing, text messages and calendar export need the
full app.

Development (hot reload, API on 8787, web on 5173):

```bash
npm run dev            # open http://127.0.0.1:5173
```

To try it on a phone on the same network, set `HOST=0.0.0.0` (see `.env.example`). Installing the app to the home
screen and using the service worker need HTTPS or `localhost`.

Configuration is optional: copy `.env.example` to `.env`. No secrets are needed for the demonstration.

### Tests

```bash
npm test               # unit + API tests (time zones, DST, permissions, privacy, idempotency, statuses)
npm run build && npm run test:e2e   # browser checks + screenshots (Playwright/Chromium)
npm run typecheck
```

`test:e2e` writes screenshots to `screenshots/<width>/` (320, 390 and 430 px, a 768 px tablet, and a 200 % text-size
pass).

## Real (non-demonstration) use

1. A family member opens **Family sign in → Create a family account** and sets up the parent: name, time zone and
   contact.
2. In **Family setup → Access**, they choose **Create device code**. The code works once and expires after 1 hour.
3. On the parent's phone or tablet, open Alongside and choose **Set up this device for my parent**, then enter the
   code. That device now stays signed in as the parent's device.
4. Other family members join with an **invitation code** from the same page.

Access is enforced on the server:

- **Parent devices** hold an httpOnly session cookie. It allows only the parent endpoints for that one household, and
  can be revoked under Access.
- **Family members** have password accounts (scrypt-hashed). Each family request is checked against membership of the
  household.
- **Signing in on the parent's device:** tapping **Family setup** there asks for a family sign-in. Switching screens
  never grants access.
- **Request protection:** state-changing requests require a same-origin header (CSRF protection), and inputs are
  validated with zod.
- **Rate limits:** sign-in and code entry are rate-limited.

## What works

| Area | Status |
| --- | --- |
| Parent board: one screen of flat colour tiles, day and time in big letters, quiet Family setup link | Working |
| Due-now questions answered on their tile: **Yes / Not yet / No / Help**, with read aloud or the family's voice message | Working |
| Today's outings appear as tiles on their day (detail, time, notes, car colour, pick-up and home times), with nothing to answer | Working |
| "Later" = 20 minutes, explained after tapping | Working |
| Daily repeats in the household time zone, including daylight saving; each day's answer is separate | Working (tested) |
| Private routines: answers hidden from family unless the parent agreed; sharing is snapshotted per answer | Working (tested) |
| Help and lift requests saved in the app, shown and resolved in the family area | Working |
| Duplicate protection (request ids, disabled buttons, open-request reuse) | Working (tested) |
| Failed saves shown as "That didn't save" / "Not saved" with **Try again** | Working (tested) |
| Taxi tile opens in place: saved places, "Somewhere else", destination shown before any action | Working |
| Uber hand-off (Uber's documented universal link). The person books and pays in Uber; recorded as "Opened Uber · booking not confirmed" | Working |
| Ask family for a lift | Working |
| Family-entered lifts (labelled as such) appear as a tile on the parent's board | Working |
| Call family via the phone's dialler (`tel:`). The demonstration never dials | Working |
| Family area: settings, places, reminders (add/edit/remove), responses, help requests, lifts, sharing, devices, invitations | Working |
| In-app reminders: a reminder that becomes due while the app is open appears at the top of the board with a chime | Working while the app is open |
| Calendar export (.ics, with time zone and alarms) so the device calendar can alert when the app is closed | Working |
| Installable PWA (manifest, icons, app-shell service worker; never caches private API data) | Working |
| Read aloud with the device's own speech, hidden where unsupported; text is always on screen | Working |

### Added in the second round

| Feature | Status |
| --- | --- |
| **Photos** on reminders and places (blister pack, the doctor, the building's entrance), shown large on the parent's screen and as thumbnails under "Get a lift". Photos are shrunk in the browser, checked on the server by size and by their real file signature, and served only to that household | Working (tested) |
| **Voice messages** recorded by family (or chosen as a sound file), played with **Hear Anna** on the reminder | Working (tested in Chromium with a simulated microphone) |
| **Play reminders aloud when they come up** (family setting): plays the voice message, otherwise reads the reminder. Some browsers block sound until the screen has been touched once | Working while the app is open |
| **Keep the screen on** (family setting) for a tablet on the bench, using the Screen Wake Lock API | Works where the browser supports it; ignored elsewhere |
| **"That's everything for today"** end-of-day screen with "Tomorrow starts with …". | Working (tested) |
| **Week view** for family: a 7-day grid with symbols as well as colours, "Done X of Y days", private routines shown as private | Working (tested) |
| **Quick start templates** for common reminders | Working |
| **Side by side**: the parent's phone and the family area live on one page (demonstration only) | Working (tested) |

### Third round: easier and brighter for the parent

- **"Next: Lunch with Jean"**: after each answer, the button names what comes next.
- **Back to Home when idle**: after 5 minutes without a touch, the app returns to the Home screen.
- **A colour for each type of reminder**: appointments blue, routines teal, outings orange,
  lifts purple, each with a matching badge.
- **Time-of-day cues**: a sunrise, sun or moon beside the date, and a soft morning/afternoon/evening tint.
- Brighter buttons with white icon tiles, softly coloured place buttons, and bigger Previous/Next buttons.
- A small burst of colour on "Done". It is hidden when the device asks for reduced motion.

All colours still pass the 4.5:1 text-contrast check in the browser tests.

### Fourth round: designed for someone living with dementia

"My day" was redesigned around one plain question at a time:

- **Only what is due now.** My day opens on the thing that needs an answer now. There are no counters ("4 of 7"),
  no Previous/Next and no answering ahead of time.
- **Questions in everyday words**, answered in everyday words:
  - Routines: "Have you had your shower?" with **Yes**, **Not yet**, **No, not today** and a separate
    **I need help**.
  - Appointments and outings are information only, with a single **Okay** and **I need help**.
  - Family can word each question themselves (new "Question to ask" field). Sensible defaults are used otherwise,
    and the templates fill them in.
- **Gentle replies**: "Okay. I'll ask you again soon.", "That's okay. Let's ask Anna." with Call Anna, and
  "Thank you, Margaret."
- **Nothing due**: "Nothing to do right now", with the one thing coming up later today. For something postponed,
  that is the time it will be asked again.
- **Today's plan** is a calm, read-only list of the day. Items due now have a **Now** button.
- Status banners ("It's time", "You said you've taken it") and "Change answer" were removed.

This replaces the original brief's Previous/Next browsing, which asks too much of someone with memory loss.

### Fifth round: picture tiles, puzzles, and the day and time everywhere

- **Home is a set of picture tiles**: My day, today's appointment or outing (for example "Gym class, Today 6:45 pm"),
  **Call …** for each person (with their photo), **Taxi** and **Puzzles**. Phones show two across, or one per row with
  the picture beside the words on narrow screens and with large text. Tablets show three across.
- **People to call** (Family setup → Setup): the family contact plus up to five more, each with a photo.
- **Word search** (Puzzles), made for someone living with dementia:
  - a 6 × 6 grid with big letters and four everyday words on one theme
  - words run across or down only, and the letters can be tapped in any order
  - no timer or score, and "Another puzzle" when finished
- **The day and time in big letters at the top of every parent screen**: "Tuesday evening", "5:16 pm" and the date,
  with a sun or moon. On reminders, the reminder's own time is smaller and reads "at 5:13 pm", so there is only one
  "now" on screen.
- Tapping today's appointment tile before it is due shows what and when, with nothing to answer yet.

### Sixth round: outings, YES / NO, photos and music

- **Today's outings appear on Home automatically**, as big cards, from what the carer enters as an appointment or
  social activity. Each card shows:
  - the title and a detail in capitals (e.g. **Gym class / PILATES**), the time and short notes ("No mat needed.")
  - **pick-up and home times** beside a **car drawn in the car's colour**, with the colour written too
    ("Blue car"), so colour is never the only cue (the driver is no longer shown: see the eighth round)
  - with "Ask if they would like to go" ticked: "**Coffee at the Feathers today?**" with big **YES** / **NO**
    buttons. The answer stays highlighted, can be changed, and shows in the family area as "Said yes" / "Said no".
- **Photos tile**: the carer adds a photo of the day with a caption (Family setup → Photos & music). The tile
  shows it, and "Another photo" goes back through earlier ones.
- **Music tile**: one big **Play** / **Stop** button for a song the carer uploaded (MP3/M4A/WAV, up to 12 MB).
  Audio is served with byte ranges so it plays on iPhone and iPad.
- **Fix for "Can't connect" in the online preview**: demonstration data saved by an older version is now upgraded
  when it loads. Unexpected errors say what happened and offer "Start the demonstration again".
- The demo song is "Twinkle, Twinkle, Little Star" (a traditional tune), synthesised by `scripts/make-demo-media.mjs`.

### Seventh round: no medication, and songs from the 1960s and 1970s

- **Medication has been taken out.** There are no medication reminders, no "reported taken", no pharmacist
  contact and no medication templates or demo items. The server refuses medication reminders. Any saved by an
  earlier version are hidden, not deleted, so nothing is lost silently.
- **Songs from the 1960s and 1970s.** The carer searches or filters a built-in list of well-known songs
  (Elvis Presley, The Beatles, The Seekers, ABBA, Daddy Cool, Sherbet and others, in `shared/songCatalogue.ts`)
  and chooses one. The title and singer fill in, and the carer attaches a recording they own (MP3/M4A, up to
  12 MB).
- **Why there are no recordings:** songs from this era are under copyright, so Alongside cannot include or
  distribute them. A licensed streaming integration (for example Apple MusicKit or Spotify) would need the
  family's own subscription and developer approval. It is not built yet.
- **Music screen for the parent**: a big button per song showing title and singer. Tap to play, tap again to stop.

## Integrations and their limits

The integrations live in `server/integrations/`.

- **Text messages: `messaging.ts`.** Uses Twilio's Messages API and needs `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
  and `TWILIO_FROM`.
  - Texts are sent only if the family turns on text alerts. They are never sent in the demonstration.
  - The family area shows the exact state of each text: *saved in the app · no text sent*, *accepted by provider*,
    *sent*, *delivered*, *undelivered* or *failed*.
  - Delivery updates arrive at `/api/webhooks/twilio-status`, which checks the signature. This needs
    `PUBLIC_BASE_URL`.
  - The parent is told "a text was sent" only when the provider accepted it.
  - **Not tested against live Twilio** (no credentials here); covered with mocked responses.
- **Ride booking: `transport.ts`.** No authorised ride-booking API is connected. Uber's ride-request API needs
  approved partner access.
  - The quote → explicit "Yes, book it" → "Booked only on provider confirmation" flow is implemented behind a
    `TransportProvider` interface.
  - It is exercised with `TRANSPORT_PROVIDER=test`, a clearly labelled *test* provider that books nothing.
  - To connect a real provider, implement `quote()` and `book()` against its documented API.
- **Uber hand-off: working.** It opens Uber with the drop-off filled in. Alongside cannot see whether a ride was
  booked, so it never says "Booked" for a hand-off.
- **Background notifications: `notifications.ts`, not implemented.**
  - Reminders appear only while Alongside is open on screen. This is stated in the family area.
  - Background delivery would need Web Push: VAPID keys, push subscriptions, a server scheduler and a service-worker
    push handler, verified on real devices with the app closed.
  - Until then, use the calendar export.

## Data and privacy

- All account data is stored in SQLite (`DATABASE_FILE`, default `data/alongside.db`) and survives restarts. Back up
  this file.
- Browser storage holds only device conveniences: which household is selected, which reminders were already shown
  this session, and the destination currently being chosen.
- Answers are stored per reminder per day, with a snapshot of whether the parent had agreed to share at that moment.
- Removing a reminder hides it but keeps past answers.
- The demonstration's numbers (0491 570 156/157) come from the Australian Communications and Media Authority (ACMA)
  range reserved for fiction, and the demonstration never dials them.

## Deploying

Run `npm run build`, then `NODE_ENV=production npm start` behind an HTTPS reverse proxy. Set `TRUST_PROXY=true`, and
consider `DEMO_MODE=off`. One Node process serves both the API and the built app. The server must be able to write the
database file and keep it.

### Eighth round: one screen of flat colour tiles

- **One screen only. "My day" has gone.** The parent's whole app is a single board, and the address never changes:
  - **Due now**: a routine due now appears as a wide orange tile at the top with its question ("Have you had a glass
    of water?"), the family's photo or voice message if any, and **Yes / Not yet / No / Help**. After an answer the
    tile turns green with a short thank-you for a few seconds, then goes.
  - **Today's outings**: full-width tiles with an icon (gym, coffee, shopping, doctor), the detail in capitals
    (PILATES), the time, notes and the car strip. (The "… today?" YES / NO question was removed in the ninth round.)
  - **Call** tiles with the person's photo, **Taxi** and **Puzzles**, the **photo of the day** (tap for another) and
    **Music** (tap to play or stop, "Another song").
  - **Taxi** and **Puzzles** open in place as a full-width tile with a **Close** button, and close themselves after
    five minutes untouched.
  - Old links (`#/day`, `#/lift`, `#/puzzles` and so on) show the same board.
- **Flat tiles like a weather widget**: solid colour squares, a big white line icon, bold capital labels and a dark
  bar along the bottom. The grid has two columns on a phone and three on a tablet. With very large text it drops to
  one column. Tiles stay square but grow taller rather than spill their words. Buttons stack their icon above the
  word on narrow tiles so no word is ever split. All colours pass WCAG 4.5:1 contrast.
- **No driver shown.** "Who is driving" has been removed from the family form, the demo data and the parent's tiles.
  Only the car's colour and the pick-up and home times are shown. A driver name sent by an older app is ignored.
- **Harder word search**: an **8 × 8** grid with **six** words that run across, down or **diagonally**, and may
  cross where they share a letter. A word counts wherever it is spelled in a straight line, tapped in any order.

### Ninth round: one person to call, no questions about outings, a grown-up look

- **Only "Call Sarah".** A new family setting, "Show a 'Call Anna' tile" (Family setup), hides the family
  contact's own Call tile. The demonstration has it off, so Margaret sees **Call Sarah** only. Help requests
  still go to Anna. A real household keeps the tile unless the family turns it off.
- **Outings just show up on their day.** "Coffee at the Feathers" is a plain tile with the time, notes and car;
  there is no "today?" and no YES / NO. The family form no longer offers "Ask if they would like to go", and the
  server ignores that option from an older app and no longer takes YES / NO answers. Earlier "Said yes / no"
  answers still show in the family's history.
- **Not childish.**
  - Call tiles use a plain phone icon instead of cartoon faces. A real photo the family adds is still shown, as a
    simple square.
  - The cartoon car drawing is now a plain colour square next to "BLUE CAR".
  - The demo photos are quiet scenes (a beach, a rose garden) with no cartoon people or writing.
  - The demo song is a short original piano piece instead of "Twinkle, Twinkle, Little Star".
  - The word search says "Found: GALAH." and "All six words found, Margaret." (no sparkles or exclamation
    marks).
  - The outing pictures and cartoon portraits are no longer part of the demonstration.
- **Fix:** with enlarged text, the grid could grow a thin extra column. Columns are now worked out from the
  board's width and text size.

## Project layout

```
shared/            time zones, occurrence logic, validation, types (used by server and browser)
server/            Express API, SQLite, sessions, demo seeding, calendar export
server/integrations/  messaging (Twilio), transport (provider + Uber hand-off), notifications
src/parent/        the parent's one-screen board (Board.tsx), word search, clock
src/family/        family area
tests/             unit and API tests (vitest)
scripts/e2e.mjs    browser checks and screenshots
```

## What was tested

- **Unit and API tests (`npm test`, 44 tests).**
  - Time zones and daylight saving: Sydney and London gaps and overlaps, and Brisbane, which has no daylight saving.
  - Daily reset, and "Later" lasting 20 minutes.
  - Only the answers that fit each reminder are accepted; medication reminders are refused, and old ones hidden.
  - Server-side permissions: no session; parent device versus family endpoints; another household; single-use
    pairing codes; revoked devices; CSRF header.
  - Privacy snapshot for answers, and validation.
  - Idempotent double taps, and honest messaging statuses (not configured / accepted / failed).
  - Twilio signature validation.
  - Uber hand-off is never a booking, and provider booking needs explicit confirmation.
  - Persistence across a server restart, demo isolation, and calendar export.
- **Browser checks (`npm run test:e2e`, Chromium).**
  - Every parent screen and the family area at 320, 390 and 430 px and at 768 px, plus key parent screens at 200 %
    text size.
  - Automatic checks for horizontal scrolling, text outside its box, overlapping controls, minimum font sizes and
    button heights, and button text contrast (WCAG 4.5:1).
  - Home contains only the greeting, date, three buttons and the link.
  - Keyboard-only use with a visible focus ring.
  - Answers survive a refresh; failed saves show "That didn't save" and retry correctly; a double tap creates one
    request.
  - The family view keeps private routines private, and no medication can be added.
  - Changing the contact updates the green button.
  - An in-app reminder comes forward when it becomes due (using a fake clock).
  - Read aloud works, and is hidden without speech support.
  - A real account can pair a device with a code, and that device cannot read family data.

Selected screenshots are in `docs/screenshots/`.

Eighth round: 59 unit/API tests. The word-search test checks the 8 × 8 grid, six words, all three directions, no
wrapping round an edge, and straight-line detection. The browser checks were rewritten for the one-screen board:
- every answer, the taxi, a call, the photo, music and a solved 8 × 8 puzzle, with the address never leaving Home
- no "My day" and no driver text anywhere
- a failed save on a tile, then retry
- a newly due reminder appearing on the board (fake clock), and an opened tile closing after five idle minutes
- 200 % text, and no tile word split across two lines, including in the side-by-side phone pane

Second round: 48 unit/API tests (adds media permissions, file-signature checks, week grid, tomorrow and hands-free
settings). The browser checks add photos, a real recording through Chromium's simulated microphone, templates,
the week grid at 320 px, the end-of-day screen and the side-by-side sync.

**Not verified here:**
- Real phones and tablets: iOS/Android text-size settings, `tel:` dialling, the Uber app opening, and PWA
  installation.
- Real speech voices: speech was simulated in the browser tests.
- Live Twilio: SMS was tested with mocked responses only.
- Background notifications: these are not implemented.
- Voice recording and playback on real phones (iOS Safari records audio/mp4; the server accepts it, but this was not
  tried on a device). Wake Lock on real tablets.
