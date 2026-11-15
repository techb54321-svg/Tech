# Ironclad SMS server

A Cloudflare Worker that texts the referee a weekly summary via Twilio. The human-readable setup guide is `index.html` (published alongside the app at `gym-accountability/sms-server/`).

- `worker.js` — the worker. Endpoints: `POST /event` (from the app), `POST /summary` (preview or force the weekly text), `GET /` (status page). A cron trigger runs hourly; the worker sends at the hour and week-start day the app configured, in the app's time zone, once per week.
- `wrangler.toml` — for `npx wrangler deploy`. Create the KV namespace, paste its id, then `wrangler secret put` the four secrets.

Secrets: `APP_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`. KV binding: `STATE`.
