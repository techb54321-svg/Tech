# 🥗 Real Food Rewards

A self-contained, mobile-first web app that rewards people for eating real,
minimally-processed food. Tap a food to log it, earn points, keep a daily
streak, complete challenges, unlock badges, and redeem rewards. It's designed
to be **hosted on GitHub Pages and embedded inside a [Cogniss](https://www.cogniss.com/)
app** via a WebView / embed block.

Everything lives in a single `index.html` — no build step, no server, no
dependencies. Progress is saved on the device with `localStorage`.

## Features

- **Log real food** — a grid of whole foods, each worth points (veg and fish
  score highest; ultra-processed snacks aren't on the menu).
- **Points, levels & a daily-goal ring** — Sprout → Seedling → … → Real Food Hero.
- **Streaks** — first log each day extends your streak; best streak is tracked.
- **Daily challenges** — hit them all for a bonus.
- **Badges** — 8 unlockables tied to your habits.
- **Rewards shop** — spend points on perks (swap these for real rewards).
- **Barcode scanner** — scan any packaged product; it's looked up in
  [Open Food Facts](https://world.openfoodfacts.org/) first and, if not found (or
  missing sugar data), falls back to
  [USDA FoodData Central](https://fdc.nal.usda.gov/), then rated by sugar with a
  traffic light: 🟢 low (≤5g/100g), 🟠 medium (≤22.5g/100g), 🔴 high (>22.5g/100g).
  The result card shows which database it came from. USDA uses the public
  `DEMO_KEY` (rate-limited) — for real use, drop a free key from
  <https://fdc.nal.usda.gov/api-key-signup.html> into `USDA_KEY` in `index.html`.
  Green scans earn points, orange earn fewer, red earn none — so rewards steer
  people toward low-sugar food. A manual "type the barcode" box is the fallback
  if the camera is blocked.

> **Camera note:** scanning needs camera access over HTTPS (GitHub Pages provides
> this). Inside a Cogniss WebView, the host app must allow camera permission for
> the embedded page — if the camera won't open, use the manual barcode entry, or
> check your Cogniss WebView's camera settings.

## Run it locally

Just open the file — no server needed:

```
real-food-rewards/index.html
```

---

## Host it on GitHub Pages (free HTTPS URL)

Cogniss needs a public **HTTPS** URL to embed. GitHub Pages gives you one for free.

1. Push this repo to GitHub (see the repo root — this project already uses Pages).
2. On GitHub: **Settings → Pages**.
3. Under **Build and deployment**, set **Source = Deploy from a branch**, pick your
   branch (e.g. `main`) and folder **`/ (root)`**, then **Save**.
4. Wait ~1 minute. Your app will be live at:

   ```
   https://<your-username>.github.io/<repo-name>/real-food-rewards/
   ```

   (For this repo that's `https://<user>.github.io/Tech/real-food-rewards/`.)

5. Open that URL on your phone to confirm it loads and is touch-friendly.

> Tip: HTTPS is required both for GitHub Pages and for embedding inside Cogniss.

---

## Link it to your Cogniss app

Cogniss is a no-code builder — it embeds external web apps rather than running
your code directly. So you point Cogniss at the GitHub Pages URL above.

1. In **Cogniss Studio**, open the screen where you want the app to appear.
2. Add a **WebView / Embed / Web content** component (Cogniss's block for showing
   an external web page). If you don't see one, an **external link / button**
   that opens the URL also works.
3. Paste your GitHub Pages URL:
   `https://<your-username>.github.io/<repo-name>/real-food-rewards/`
4. Save and preview on a device. Because the app is mobile-first, it fills the
   WebView cleanly.

If your exact Cogniss plan doesn't expose a WebView block, the fallbacks are:
- a **button/link** that opens the hosted app in the in-app browser, or
- ask Cogniss support which component embeds external HTML on your plan.

### Passing points back into Cogniss (optional)

The app already broadcasts progress so a Cogniss (or any) host can read it —
you don't have to use this, but it's ready:

- **postMessage** — on every change the app posts to the parent window:

  ```js
  { type:"rfr_progress", points, streak, bestStreak, badges, ts }
  ```

  A Cogniss WebView bridge (or a plain iframe host) can listen with
  `window.addEventListener("message", …)` and store the points against the user.

- **Callback URL** — add `?cogniss_cb=<your-endpoint>` to the embed URL and the
  app will `sendBeacon` the same JSON payload to that endpoint on each update:

  ```
  https://<user>.github.io/Tech/real-food-rewards/?cogniss_cb=https://your-api/points
  ```

- The host can also send messages **into** the app:
  `{type:"rfr_request"}` re-sends the current progress, `{type:"rfr_reset"}`
  clears it.

Wire whichever your Cogniss setup supports; if you just want the visual app
embedded, ignore this section entirely.

---

## Customising

Open `index.html` and edit the arrays near the top of the `<script>`:

- `FOODS` — the foods and their point values.
- `REWARDS` — the rewards shop items and costs.
- `CHALLENGES` — daily challenges.
- `BADGES` / `LEVELS` — unlock rules and level thresholds.
- `DAILY_GOAL` — points that fill the daily ring.

Colours live in the `:root` block at the top of `<style>`.
