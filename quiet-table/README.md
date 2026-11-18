# 🍽️ Lindy’s Table

An easy-to-use app for finding restaurants **where you can have a conversation
without shouting**. It's designed for baby boomers: big text, big buttons,
plain words, and no account or sign-up needed. It's for anyone who wants a
good conversation over a meal, not only people with hearing loss.

## What it does

1. **Where are you?** Use your phone's location, or type a town, street or postcode.
2. **How far?** 1 / 2 / 5 / 10 / 20 km, or 1 / 3 / 5 / 10 / 15 miles.
3. **What kind of food?** Italian, Chinese, Indian, British, seafood, café/tea room, vegetarian and more.
4. **Price.** $ to $$$$ (you can use £ or € instead in Settings).
5. **How quiet?** Show everything with the quietest first, hide noisy places, or show only places rated quiet.

Each restaurant shows a clear noise label (**Quiet**, **Fairly quiet**,
**Noisy**, **Very noisy** or **Not rated yet**), along with the distance,
food type, price, address, opening hours and wheelchair access. There are
**Directions** and **Call** buttons, and warnings for live music or sport on TV.

### Look and feel

Lindy’s Table is designed to feel like a polished phone app:

- **Bottom tab bar** with Find, Saved and Help, plus a Back button at the top.
- **List or map:** results show as cards or as colour-coded pins on a map
  (Leaflet + OpenStreetMap).
- **Restaurant details page** with the noise verdict and its reasons,
  Directions / Call / Website / Save buttons, opening hours, accessibility
  and a small map.
- **Saved places:** tap the heart to keep a restaurant for next time.
- **A "quiet meter"** of four bars shows noise at a glance, always with
  words as well as colour. A dashed outline means "likely, from photos and
  reviews".
- **Easy to read:** large type (Figtree for text, Fraunces for headings),
  high contrast, three text sizes, and light, dark or automatic appearance.
  Every button is at least 48px tall.
- **Installable** with a proper app icon (Add to Home Screen).

### Quiet ratings

No public database records how loud restaurants are, so diners rate them.
After a meal you tap **Rate the noise** and answer a few questions:

- Could you hold a conversation? (easily, with a little effort, had to raise our voices, could hardly hear)
- How loud was the background music? (none, soft, too loud)
- Optional: what helped or hurt (booths, carpets, tablecloths, echoey room, open kitchen, TVs…)
- Optional: the price per person
- Optional: **a 10-second sound reading** from the phone's microphone. Only the
  number is kept and nothing is recorded. Phones aren't calibrated, so the reading is approximate.

As a rough guide: under about 65 dB is quiet, 66–70 is fairly quiet, 71–76 is noisy and above 76 is very noisy.

### "Likely quiet" labels from photos and reviews

Before anyone has rated a restaurant, the app can still give it a label. The
companion server (`../quiet-table-server`) looks at the restaurant's Google
photos and reviews and judges the room. Carpets, tablecloths, booths, curtains
and acoustic panels point to quiet; hard floors, high bare ceilings, a big bar
and TVs point to noise. These labels appear as **"Likely quiet"** with a
dashed outline, with the reasons listed underneath. They also fill in prices
and warn about live music or sport on TV.

To switch this on, set up the server (see its README) and put its address in
`config.js`. The demo (`?demo`) shows two examples.

## Try it

- **Demo with sample ratings:** open `index.html?demo`. The restaurants and ratings in it are made up.
- **Real restaurants:** open `index.html`. Restaurant listings come from
  [OpenStreetMap](https://www.openstreetmap.org/copyright) (free, no API key).

To use the app on a phone, it needs to be served over HTTPS (for example with
GitHub Pages). Phones only allow location and microphone access on secure
pages. Once it's open, use **Add to Home Screen** and it works like an installed app.

For local testing you can run `python3 -m http.server` in this folder and open
http://localhost:8000/?demo

## Before launching to the public

- **Shared ratings backend (most important).** For now, ratings are saved on
  each phone, so you only see your own. To let everyone see everyone's
  ratings, replace the small `Store` object in `app.js` with calls to a
  database such as Supabase or Firebase. Add basic spam protection while you're at it.
- **Seed the first ratings.** A new app starts with no ratings. You could visit
  local restaurants yourself, partner with seniors' groups or hearing-loss
  charities, or import any existing noise data you're licensed to use.
- **Prices.** OpenStreetMap rarely includes prices, so prices also come from
  diners. A places API (Google Places, Foursquare, Yelp) could supply prices,
  ratings and photos, but these APIs are paid and have usage terms.
- **Fair use of free services.** The public OpenStreetMap search servers are
  meant for light use. Before a big launch, host your own or use a paid provider.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The screens: search, results, rating, settings, help |
| `styles.css` | Large, high-contrast styling with three text sizes |
| `app.js` | Location, restaurant search, filters, ratings and sound meter |
| `data.js` | Food types, rating checklist and demo data |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | Let the app install to the home screen |
