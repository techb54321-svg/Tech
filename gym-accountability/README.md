# Ironclad — fail-safe gym accountability

A single-file, installable web app that holds you to **3 gym sessions a week** (configurable) and makes it hard to cheat yourself.

## How it keeps you honest

| Fail-safe | What it does |
| --- | --- |
| **Location-verified check-in and check-out** | A session only counts if your phone is inside the gym's geofence at both ends and you stayed the minimum time (30 min by default). Refused attempts are logged with the distance. |
| **Photo proof** | Optional photo at check-in, stored with the session and shown in the ledger. |
| **One session per day** | Two visits on one day count once. "3× a week" means three separate days. |
| **Live slack meter** | On track / Tight / Critical / Week lost, computed from sessions remaining vs days remaining. |
| **Referee must agree** | After signing you send the referee an invitation link to a page (`referee/`) that explains the role, the stakes and what they receive. They tap Agree. In weekly-text mode the server records the agreement and sends nothing weekly until it exists; in other modes you confirm in the app that they said yes. The home screen shows whether the referee has agreed. |
| **A referee and money on the line** | Every closed week produces a report for a real person. You hand the referee a deposit up front (default four weeks' worth); each failed week forfeits the stake from it to a destination you chose in advance, ideally a cause you dislike, and the referee only administers it. The app tracks deposit remaining, nags you to top up, and shows anything owed beyond the deposit until you mark it paid. |
| **Ironclad alerts** | Choose **Ironclad alerts** or **Manual**. Alerts run on one shared Cloudflare Worker that the developer sets up once (see `server/`). Each user's app registers itself automatically and gets its own private space, so users never touch Cloudflare. Referees get real notifications from Ironclad: every check-in with a photo, session results, refused attempts, freezes, contract and money changes, tampering, and the weekly verdict on schedule even if the user goes quiet. Each referee gets their own installable Ironclad page with a live view and a test button. Until the server address is built into the app, alerts show as "soon" and Manual is used. |
| **Append-only, hash-chained ledger** | Every event is SHA-256 chained to the previous one. Edit or delete anything in storage and the header badge turns red permanently and the next referee report says so. Contract changes are logged too. |
| **Freeze weeks** | Illness or travel can be declared in advance, with a quarterly cap, and the referee is told. You cannot freeze a week that is already lost. |
| **Forgotten check-out** | Auto-closed as an unverified session; only one unverified session counts per week. |
| **Calendar reminders** | Export an `.ics` with recurring alerts on your gym days and a week-deadline alert, so reminders do not depend on the app being open. |
| **Warm-up week** | If you sign up too late in the week to realistically hit the target, that week is logged but cannot be failed. |
| **Backups** | Export and import the full ledger as JSON; imports are hash-verified. |

## Running it

Geolocation, camera capture and installation all require HTTPS (or `localhost`), so host the folder on any static host. GitHub Pages works:
`https://<user>.github.io/Tech/gym-accountability/`

During setup, search for your gym by name or address (OpenStreetMap search), paste a Google Maps link, or use your current location while standing inside it; the pin shows on a small map so you can confirm it.

Then on your phone open the URL and choose **Add to Home Screen**. The service worker caches the app so it opens inside the gym without signal.

For local testing: `python3 -m http.server` in this folder, then open `http://localhost:8000`.

## Limits worth knowing

- With Ironclad alerts, the weekly verdict comes from your server on schedule, so going quiet does not hide a missed week. In Manual mode, nothing is sent unless you send it.
- iPhone referees need iOS 16.4 or later and must add their Ironclad page to the Home Screen before alerts work; the page walks them through it. Check-in photos show inside Android notifications and in the referee's activity feed on every phone.
- Channel secrets (the ntfy topic name, the text server's secret) are stored on your phone and included in backups, so treat backup files as private. Twilio credentials live only on your Cloudflare Worker, never in the app.
- A web app cannot wake your phone by itself. Notifications only fire while the app is open; the `.ics` calendar file is the reliable reminder path.
- Nothing is charged automatically. The money stake works through the referee and the owed balance, not a payment processor.
- Data lives in the browser's local storage on that one device. Export regularly.

## Privacy and security

The full plain-language explanation is `privacy.html`, linked from Settings and the landing page. In short:

- **No account, no analytics.** Fonts and assets are self-hosted, and nothing loads from Google.
- **Location never leaves the phone.** Only the distance from the gym pin is stored. Gym search shares only a rough area of about 10 km with OpenStreetMap.
- **Phone numbers are never sent to a server** in Ironclad alerts mode.
- **Each user's alerts data is isolated** under their own account, locked with a secret stored only as a hash. Wiping the app deletes the account on the server.
- **Contract-change notices carry no coordinates or contact details.**
- **Check-in photos on the alerts server expire after 14 days.**
- **The referee link can be replaced from Settings.** The old link and every device registered through it stop working immediately.
- **Referee actions on the server are rate-limited.**
- **Backups are encrypted with a passphrase:** PBKDF2-SHA-256, 600,000 rounds, then AES-256-GCM. An unprotected export needs an explicit second confirmation.
- **The ledger is tamper-evident, not tamper-proof.** Neither is GPS on a modified phone. The privacy page says so plainly.
