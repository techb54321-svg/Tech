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
| My day: one item at a time, large time, title, place, instructions, read aloud, Previous/Next | Working |
| Routines and appointments: **Done / Later / Need help** (+ **Not today** for routines and outings) | Working |
| Medication: **I've taken it / Later / Not sure**; recorded as *reported taken*; unanswered = *not confirmed*; "Not sure" offers calls to family or pharmacist and gives no dose advice | Working |
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

**Not verified here:**
- Real phones and tablets: iOS/Android text-size settings, `tel:` dialling, the Uber app opening, and PWA
  installation.
- Real speech voices: speech was simulated in the browser tests.
- Live Twilio: SMS was tested with mocked responses only.
- Background notifications: these are not implemented.
