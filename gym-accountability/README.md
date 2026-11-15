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
| **Automatic delivery to the referee** | Choose Manual (you tap send) or Automatic. Automatic has two flavours. **Weekly text message**: a tiny free Cloudflare Worker of your own (see `sms-server/`) receives the app's events and texts the referee via Twilio once a week at an hour you choose, summarising the week that just closed, and it still sends when the phone went silent. **Push app**: instant notifications for every event through a free ntfy.sh topic the referee subscribes to. Messages queue offline and retry. The referee never needs this app. |
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

- In Push mode, messages are sent from your phone when the app runs, so a week's final result goes out the next time you open the app after the week ends; the referee's intro message tells them that silence means failure. In Weekly text mode the server sends on schedule regardless, and says explicitly when the app reported nothing.
- Channel secrets (the ntfy topic name, the text server's secret) are stored on your phone and included in backups, so treat backup files as private. Twilio credentials live only on your Cloudflare Worker, never in the app.
- A web app cannot wake your phone by itself. Notifications only fire while the app is open; the `.ics` calendar file is the reliable reminder path.
- Nothing is charged automatically. The money stake works through the referee and the owed balance, not a payment processor.
- Data lives in the browser's local storage on that one device. Export regularly.
