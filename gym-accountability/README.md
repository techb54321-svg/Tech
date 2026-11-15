# Ironclad — fail-safe gym accountability

A single-file, installable web app that holds you to **3 gym sessions a week** (configurable) and makes it hard to cheat yourself.

## How it keeps you honest

| Fail-safe | What it does |
| --- | --- |
| **Location-verified check-in and check-out** | A session only counts if your phone is inside the gym's geofence at both ends and you stayed the minimum time (30 min by default). Refused attempts are logged with the distance. |
| **Photo proof** | Optional photo at check-in, stored with the session and shown in the ledger. |
| **One session per day** | Two visits on one day count once. "3× a week" means three separate days. |
| **Live slack meter** | On track / Tight / Critical / Week lost, computed from sessions remaining vs days remaining. |
| **A referee and money on the line** | Every closed week produces a report for a real person. Failed weeks add to an "owed" balance that stays on screen until you mark it paid. |
| **Automatic delivery to the referee** | Choose Manual (you tap send) or Automatic. In Automatic mode the app itself tells your referee about every check-in, check-out, refused attempt, weekly result, freeze, contract change, payment, "no slack left" escalation and any tampering, through a free ntfy.sh push topic the referee subscribes to. Messages queue offline and retry. The referee needs only the ntfy app, not this one. |
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

- Automatic messages are sent from your phone when the app runs, so a week's final result goes out the next time you open the app after the week ends. The referee's intro message tells them that silence by week's end means failure, which closes that gap.
- The automatic channel is a secret topic name; anyone who knows it can read the messages. It is stored on your phone and included in backups, so treat backup files as private.
- A web app cannot wake your phone by itself. Notifications only fire while the app is open; the `.ics` calendar file is the reliable reminder path.
- Nothing is charged automatically. The money stake works through the referee and the owed balance, not a payment processor.
- Data lives in the browser's local storage on that one device. Export regularly.
