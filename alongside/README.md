# Alongside

A simple daily helper for an older person, with family support behind the scenes.

The parent sees one calm home screen with three big choices: **My day**, **Get a lift** and **Call [family contact]**.
Family members do the setup in a separate, signed-in family area.

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
| Parent home (greeting, date, 3 buttons, quiet Family setup link) | Working |
| My day: one plain question at a time, only for what is due now, with read aloud and a read-only plan of the day | Working |
| Routines: **Yes / Not yet / No, not today** and **I need help**. Appointments and outings: **Okay** and **I need help** | Working |
| Medication: **Yes / Not yet / I'm not sure**; recorded as *reported taken*; unanswered = *not confirmed*; "Not sure" offers calls to family or pharmacist and gives no dose advice | Working |
| Medication setup requires confirming the reminder matches the existing verified schedule (enforced by the server; who and when is stored) | Working |
| "Later" = 20 minutes, explained after tapping | Working |
| Daily repeats in the household time zone, including daylight saving; each day's answer is separate | Working (tested) |
| Private routines: answers hidden from family unless the parent agreed; sharing is snapshotted per answer | Working (tested) |
| Help and lift requests saved in the app, shown and resolved in the family area | Working |
| Duplicate protection (request ids, disabled buttons, open-request reuse) | Working (tested) |
| Failed saves shown as "That didn't save" / "Not saved" with **Try again** | Working (tested) |
| Get a lift: saved places, "Somewhere else", destination shown before any action | Working |
| Uber hand-off (Uber's documented universal link). The person books and pays in Uber; recorded as "Opened Uber · booking not confirmed" | Working |
| Ask family for a lift | Working |
| Family-entered lifts (labelled as such) appear in the parent's My day | Working |
| Call family / pharmacist via the phone's dialler (`tel:`). The demonstration never dials | Working |
| Family area: settings, places, reminders (add/edit/remove), responses, help requests, lifts, sharing, devices, invitations | Working |
| In-app reminders: a reminder that becomes due while the app is open comes to the front with a chime | Working while the app is open |
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
| **"That's everything for today"** end-of-day screen with "Tomorrow starts with …". An unanswered medication reminder keeps the day open | Working (tested) |
| **Week view** for family: a 7-day grid with symbols as well as colours, "Reported taken X of Y days", private routines shown as private | Working (tested) |
| **Quick start templates** for common reminders | Working |
| **Side by side**: the parent's phone and the family area live on one page (demonstration only) | Working (tested) |

### Third round: easier and brighter for the parent

- **"Next: Lunch with Jean"**: after each answer, the button names what comes next.
- **Back to Home when idle**: after 5 minutes without a touch, the app returns to the Home screen.
- **A colour for each type of reminder**: medication pink, appointments blue, routines teal, outings orange,
  lifts purple, each with a matching badge.
- **Time-of-day cues**: a sunrise, sun or moon beside the date, and a soft morning/afternoon/evening tint.
- Brighter buttons with white icon tiles, softly coloured place buttons, and bigger Previous/Next buttons.
- A small burst of colour on "Done" and "I've taken it". It is hidden when the device asks for reduced motion.

All colours still pass the 4.5:1 text-contrast check in the browser tests.

### Fourth round: designed for someone living with dementia

"My day" was redesigned around one plain question at a time:

- **Only what is due now.** My day opens on the thing that needs an answer now. There are no counters ("4 of 7"),
  no Previous/Next and no answering ahead of time, so evening tablets cannot be marked as taken in the afternoon.
- **Questions in everyday words**, answered in everyday words:
  - Medication: "Have you taken your morning tablets?" with **Yes**, **Not yet** and **I'm not sure**.
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

## Project layout

```
shared/            time zones, occurrence logic, validation, types (used by server and browser)
server/            Express API, SQLite, sessions, demo seeding, calendar export
server/integrations/  messaging (Twilio), transport (provider + Uber hand-off), notifications
src/parent/        parent screens (Home, My day, Get a lift, Call)
src/family/        family area
tests/             unit and API tests (vitest)
scripts/e2e.mjs    browser checks and screenshots
```

## What was tested

- **Unit and API tests (`npm test`, 44 tests).**
  - Time zones and daylight saving: Sydney and London gaps and overlaps, and Brisbane, which has no daylight saving.
  - Daily reset, and "Later" lasting 20 minutes.
  - Medication: "Not sure" is never treated as taken; an unanswered reminder means not confirmed; actions are
    restricted to medication answers.
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
  - The family view shows "Not sure — not confirmed" and keeps routines private.
  - The medication confirmation is enforced.
  - Changing the contact updates the green button.
  - An in-app reminder comes forward when it becomes due (using a fake clock).
  - Read aloud works, and is hidden without speech support.
  - A real account can pair a device with a code, and that device cannot read family data.

Selected screenshots are in `docs/screenshots/`.

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
