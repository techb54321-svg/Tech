# Ironclad alerts server

One free Cloudflare Worker that powers **Ironclad alerts** for every user of the app. The developer sets it up once, following the guide in `index.html`. After that, nobody else touches Cloudflare: each app install registers itself and gets its own private space.

## What it does

- **Accounts.** `POST /register` gives each app install an account id and a secret. Secrets are stored only as SHA-256 hashes. Sign-ups are capped at 5 per hour per network and 200 per day. Networks are recorded only as hashes.
- **Isolation.** Each account lives under its own KV key (`acct:<id>`). Referee links map to accounts through `ref:<token>`, and photos live under `photo:<account>:<id>` with a 14-day expiry.
- **Referee pages.** Each referee gets an installable page at `/r/<token>/`, with its own manifest and service worker, alerts, a test button and a live view of the week.
- **Notifications.** Standard Web Push: RFC 8291 encryption and RFC 8292 VAPID. One VAPID key pair is generated on first use. Dead subscriptions are pruned.
- **Weekly verdicts.** An hourly cron sends verdicts for every account that is due. Each account's schedule is kept as KV metadata, so the cron only reads accounts that are due.
- **Privacy.** Nothing is pushed until the referee agrees. Phone numbers and emails are never stored. The referee's actions are rate-limited. `POST /delete` erases an account, which the app calls when it is wiped. Only the app's own origin may call the API from a browser.

## Setup

1. Paste `worker.js` into a new Worker. The repository also has a `wrangler.toml` for `npx wrangler deploy`.
2. Bind a KV namespace as `STATE`.
3. Add the cron trigger `0 * * * *`.
4. Put the Worker's address in the app as `ALERTS_SERVER_URL` near the top of the script in `index.html`.

`APP_URL` at the top of `worker.js` must point to wherever the app is hosted. It is used for icons, fonts and the CORS allow-list.

## Endpoints

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /` | none | Status page with the setup checklist and the server address |
| `GET /health` | none | Liveness check used by the app |
| `POST /register` | none (rate-limited) | Create an account and return its id and secret |
| `POST /event` | account + secret | Record an event and push it to the referee |
| `POST /invite` | account + secret | Create the referee link |
| `POST /rotate` | account + secret | Replace the referee link; the old link and all its alert registrations stop working |
| `POST /state` | account + secret | Report agreement and alert-device count back to the app |
| `POST /summary` | account + secret | Preview last week's verdict text |
| `GET /r/<token>/` | token | Referee app, plus `manifest.webmanifest`, `sw.js`, `data` and `photo/<id>` |
| `POST /r/<token>/agree`, `/subscribe`, `/unsubscribe`, `/test` | token | Referee actions |
