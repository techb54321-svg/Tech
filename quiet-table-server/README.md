# Quiet Table analysis server

This small server gives restaurants a **"Likely quiet"** label before any
diner has rated them. For each restaurant it:

1. finds the restaurant on Google Maps and reads its details, its reviews,
   Google's review summary and a few of its photos;
2. asks Claude to judge, from the photos (carpets, tablecloths, booths,
   curtains, acoustic panels vs. hard floors, high bare ceilings, a big bar,
   TVs) and the reviews ("couldn't hear each other", "lovely and quiet"), how
   easy it is to hold a conversation there;
3. sends back a verdict (quiet / fairly quiet / noisy / very noisy / unknown),
   how sure it is, 1–3 plain-English reasons, quieter times if the reviews
   mention any, and Google's price level. The result is cached for 30 days.

Diners' own ratings always take priority in the app.

The API keys stay on the server, so they never reach people's phones.

## One-time setup (about 20 minutes)

1. **Google Maps key**: in [Google Cloud Console](https://console.cloud.google.com/),
   create a project, turn on billing, enable **Places API (New)**, then create
   an API key under *APIs & Services → Credentials*. Restrict the key to
   *Places API (New)*. Under *Quotas*, set a daily limit so costs can't run away.
2. **Claude key**: at [console.anthropic.com](https://console.anthropic.com/),
   create an API key and set a monthly spend limit under *Limits*.
3. **Cloudflare (free)**: sign up at [cloudflare.com](https://dash.cloudflare.com/sign-up).
   Open **Workers & Pages** once so Cloudflare gives you a `workers.dev`
   address. Then:
   - create an API token with the **Edit Cloudflare Workers** template (*My Profile → API Tokens*);
   - copy your **Account ID**, shown on the Workers & Pages page.
4. **GitHub**: in this repository go to *Settings → Secrets and variables →
   Actions → New repository secret* and add these four secrets:
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GOOGLE_MAPS_KEY`, `ANTHROPIC_API_KEY`.
5. Under the **Actions** tab, run **Deploy Quiet Table server**. It prints the
   server's address (e.g. `https://quiet-table.yourname.workers.dev`). Put that
   address in `quiet-table/config.js` as `analysisUrl` and push.

You can check it's working by opening `<address>/health`. It should say
`"configured": true`.

## Cost

You pay for each **new** restaurant analysed. A cached answer is reused for
30 days and costs nothing.

- **Claude:** roughly 3–5 US cents per restaurant. It uses Claude Opus 5.5 at
  low effort with up to 4 photos.
- **Google:** Places charges per search and per photo, and gives a free
  monthly allowance. The search uses Google's "Atmosphere" fields (live music,
  sports, reviews), which are in a higher price tier. Check the current prices
  on Google's pricing page.

The server analyses at most 10 restaurants per request, and only accepts
requests from the Quiet Table website. Set the spending limits in steps 1 and 2
as a safety net.

## Before a wide launch

- Read the Google Maps Platform terms. They limit how long Google content can
  be stored and how it can be shown; this server keeps only its own verdict
  for 30 days.
- The verdict is an educated guess. The app labels it "Likely …" with a dashed
  outline, and real diner ratings replace it.

## Settings (`wrangler.toml`)

| Setting | Meaning |
| --- | --- |
| `ALLOWED_ORIGINS` | Websites allowed to use the server (localhost is always allowed for testing) |
| `MAX_PLACES_PER_REQUEST` | Most restaurants analysed per request (default 10) |
| `CACHE_DAYS` | How long a verdict is reused (default 30) |
