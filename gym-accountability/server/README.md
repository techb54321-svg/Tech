# Ironclad server

One free Cloudflare Worker that powers **Ironclad alerts**. The person-friendly setup guide is `index.html`, published next to the app at `gym-accountability/server/`.

## What it does

- Receives events from the Ironclad app at `POST /event`. These are check-ins with an optional photo, check-outs, verdicts, freezes, contract changes and money updates. It stores recent state in KV.
- Hosts the referee's own installable app at `/r/<invite-token>/`. The app serves a per-referee manifest and service worker. The referee taps "I'm in", turns on alerts and sees a live view of the week.
- Sends notifications with standard Web Push: RFC 8291 payload encryption and RFC 8292 VAPID. It uses no third-party push service. VAPID keys are generated on first use and stored in KV. Dead subscriptions (404 or 410) are pruned.
- An hourly cron sends the weekly verdict at the configured hour on the first day of the new week. It sends even if the app went silent, and skips the push if the app already delivered that verdict.
- Consent comes first: nothing is pushed until the referee has agreed.
- Privacy: check-in photos expire after 14 days, phone numbers are never stored for Ironclad alerts, and referee actions (agree, subscribe, test) are rate-limited.

## Setup

1. Paste `worker.js` into a new Worker. The repository also has a `wrangler.toml` for `npx wrangler deploy`.
2. Bind a KV namespace as `STATE`.
3. Add the cron trigger `0 * * * *`.
4. Open the Worker's address and copy the connection code (`<worker-origin>#<secret>`) into the app. The code is hidden once the app uses it. To reset it, delete the `secret` and `claimed` keys in KV.

Optional settings:

- `APP_SECRET` replaces the generated secret.
- Twilio settings (`TWILIO_*`) only apply to the older text-message mode. With Ironclad alerts the server never receives phone numbers.
- The `APP_URL` constant at the top of `worker.js` points to wherever the Ironclad app is hosted. It is used for icons and the pairing link.

## Endpoints

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /` | none | Status page with the setup checklist and connection code |
| `POST /event` | secret | Record an event and push it to the referee |
| `POST /invite` | secret | Create the referee link |
| `POST /rotate` | secret | Replace the referee link; the old link and all its alert registrations stop working |
| `POST /state` | secret | Report agreement and alert-device count back to the app |
| `POST /summary` | secret | Preview last week's verdict text |
| `GET /r/<token>/` | token | Referee app, plus `manifest.webmanifest`, `sw.js`, `data` and `photo/<id>` |
| `POST /r/<token>/agree`, `/subscribe`, `/unsubscribe`, `/test` | token | Referee actions |
