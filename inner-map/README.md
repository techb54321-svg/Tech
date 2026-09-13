# Inside — a map of the body

A working prototype of a map you can pan, zoom and search, where the ground is
the inside of a human body rendered as a handmade knitted valley. Zoom out and
you see the whole valley. Zoom in and you end up standing at the Keymaker's
bench. Search "sugar" and it flies you to the lanterns.

Built on Leaflet, which is the library real maps run on — so panning, pinch
zoom, pins, popups and fly-to camera moves all come for free. No 3D engine, no
build step, no server framework, and nothing loaded from a CDN, so it runs on a
laptop with no wifi in a meeting room.

---

## Run it

You need a tiny local web server (the browser blocks JavaScript modules opened
straight from disk).

```bash
cd inner-map
python3 -m http.server 8000
```

Then open http://localhost:8000

It runs straight away: the artwork is generated and checked in.

## What's in it

| | |
|---|---|
| Six places | The Keymaker's workshop, the river, the lanterns, a lit house, a door that sticks, a house gone dark, and the village that dances |
| Search | Type "sugar", "walking", "insulin" — it flies you there and opens the card |
| Four levels of artwork | The valley, the village, one house, and the bench, cross-fading into each other as you zoom |
| Drifting lanterns | Seven of them, going down the river on a loop, on the same line the artwork lights |
| Pins that mean something | Gold for a lit house, dark for one gone out, hollow for the door that sticks, a diamond for a character, swaying for the village that dances |

## The artwork

The four levels are SVG, drawn by a script rather than by hand:

```bash
node tools/make-art.mjs      # redraws images/01..04
```

Everything is seeded, so a rerun gives you the same valley back. Change a seed
at the top of `valley()`, `village()`, `houses()` or `bench()` to reshuffle the
trees and rooftops, or edit the palette at the top of the file to change the
wool. The generator is the only place in the project that uses Node — the map
itself is plain files.

Each level is drawn at the size it will actually be read at, which is the part
that makes the zoom work:

| File | What it shows | Drawn so that |
|---|---|---|
| `01-valley.svg` | The whole valley, river running through it | The whole sheet is one view |
| `02-village.svg` | Houses you can count | A house is about 130 units across |
| `03-house.svg` | Doors, windows, keys on their hooks | One house nearly fills the frame |
| `04-bench.svg` | The Keymaker at her bench | The room is drawn *inside the workshop's own footprint*, 240 units across, and fades out past its walls |

That last row is the trick worth knowing: every level covers the same map, so a
deeper level cannot show a different place — it can only show the same place
bigger. The bench is drawn small and in the right spot, so that by the time the
camera is close enough for it to fade in, it fills the screen.

**To use your own artwork instead**, drop four images of the same aspect ratio
into `images/` and point `file` in `src/world.js` at them. Draw them at the four
sizes in the table above and the cross-fade will read as one move inward.

## Change the world

Everything editable lives in `src/world.js`:

- **LEVELS** — the images and the zoom range where each fades in
- **PLACES** — every pin: where it sits, what it says, and the words that find it
- **RIVER_PATH** — the line the lanterns drift along
- **LANTERN_COUNT / LANTERN_TRIP_SECONDS** — how many lanterns and how slow

Coordinates are `[y, x]` on a 1000 × 1778 grid, counting up from the bottom
left. To place a pin: open the browser console, run
`map.on('click', e => console.log(e.latlng))`, then click the map.

Zoom is counted in **steps in from the whole valley**: `0` is the valley filling
the frame, `1` is twice as close, `2` is four times as close. It is deliberately
not an absolute Leaflet zoom level, so a phone and a projector start with the
same view and arrive at the same framing.

You shouldn't need to open `src/map.js` for ordinary changes.

---

## Brief

This is a pitch asset for a short animated film and a larger concept: a
searchable map of the human body. The audience is a funder, producer or
festival — so the demo has to feel like a real product, not a slideshow.

The design rule underneath it: **the world is warm, woven and handmade; the
interface is cool, quiet and precise.** That contrast is the concept. Don't
warm up the chrome, and don't let the interface compete with the map.

Pin shape carries meaning and should stay that way — gold filled for a lit
house, dark filled for a house gone out, hollow outline for a door that sticks,
diamond for a character, swaying for the village that dances. Someone should be
able to read the valley's health without opening a single card.

### Good next steps, roughly in order of value

1. **Day and night.** A slow cycle over the valley: a dark overlay whose opacity
   follows the clock, lantern glow brightening as it darkens. Makes the map feel
   alive and running whether or not anyone is watching.
2. **Lanterns that respond to meals.** A simple "the kitchen upstairs just fed
   us" trigger that sends a surge of lanterns down the river, then thins out
   again. Currently they drift at a constant rate.
3. **The Keymaker animated at her pin.** A short looping sprite at the workshop
   so a character is actually working when you arrive.
4. **Deep-linking.** `?place=dancing-village` opens the map already flown there,
   so a pitch email can link straight to one spot.
5. **A guided tour.** A "Take the tour" button that flies through the six places
   in story order with the cards opening as it lands. This is what you'd show on
   a projector.

### Please don't

- Don't swap Leaflet for a 3D engine. The whole point is that this runs
  anywhere, including a phone in a meeting.
- Don't add a build step, a framework or a backend. It should stay openable with
  a static server.
- Don't put real map data, Google branding or Google's pin shape anywhere near
  it.
- Don't add fade-and-slide-up entrance animations to everything. Motion here
  belongs to the world (lanterns, light), not the chrome.

### Content rules that aren't negotiable

- Light is the only health signal. Never red, never alarms, never hospital
  imagery.
- No numbers, no test results, no diagnosis, no personal data. This explains a
  body in general; it never assesses anyone's body in particular.
- Every metaphor has to be biologically true. The current four are lanterns
  (sugar), keys (insulin), lit windows (cells being fed), and the dancing
  village (muscles taking in sugar without insulin).

---

Leaflet 1.9.4 is vendored in `vendor/leaflet/` (BSD-2-Clause, licence included)
so the demo has no network dependency.
