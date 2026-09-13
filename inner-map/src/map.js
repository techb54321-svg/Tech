import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  LEVELS,
  PLACES,
  RIVER_PATH,
  LANTERN_COUNT,
  LANTERN_TRIP_SECONDS,
} from './world.js';

const bounds = [[0, 0], [WORLD_HEIGHT, WORLD_WIDTH]];

// ---------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------
const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -20,         // replaced below, once the real fit is known
  maxZoom: 20,
  zoomSnap: 0,          // fractional zoom, so the cross-fade is smooth
  zoomDelta: 0.4,
  wheelPxPerZoomLevel: 140,
  zoomControl: false,
  attributionControl: false,
  maxBounds: bounds,
  maxBoundsViscosity: 0.85,
});

// Zoom is counted in steps in from the whole valley, not in absolute Leaflet
// levels, so a phone and a projector both start with the valley filling the
// frame and both arrive at the same framing when they fly somewhere.
let fitZoom = 0;                 // the real value is set once the map has a view
const IN = (steps) => fitZoom + steps;
const MAX_STEPS = 3;

function setZoomRange() {
  // getBoundsZoom only means anything once the map has a view, so this runs
  // after the first fitBounds — and again whenever the window changes size.
  map.setMinZoom(-20);          // an unclamped reading of the fit
  fitZoom = map.getBoundsZoom(bounds);
  map.setMinZoom(fitZoom - 0.3);
  map.setMaxZoom(IN(MAX_STEPS));
}

map.fitBounds(bounds);
setZoomRange();
map.fitBounds(bounds);

// Handy from the console when you are placing pins:
//   map.on('click', e => console.log(e.latlng))
window.map = map;

window.addEventListener('resize', () => {
  const wasHome = Math.abs(map.getZoom() - fitZoom) < 0.05;
  setZoomRange();
  if (wasHome) map.fitBounds(bounds);
  updateLayerOpacity();
});

// ---------------------------------------------------------------------------
// Zoom levels that cross-fade into each other
// ---------------------------------------------------------------------------
const layers = LEVELS.map((level, i) => {
  const overlay = L.imageOverlay(level.file, bounds, {
    opacity: i === 0 ? 1 : 0,
    className: 'world-layer',
    interactive: false,
  }).addTo(map);

  // If an image is missing, the map still works — you just see the level below.
  overlay.on('error', () => {
    document.body.classList.add('has-missing-art');
    console.warn(`Missing artwork: ${level.file}`);
  });

  return { ...level, overlay };
});

function updateLayerOpacity() {
  const steps = map.getZoom() - fitZoom;
  layers.forEach((layer) => {
    if (layer.fadeInAt === null) return;           // base layer, always on
    const span = layer.fadeInBy - layer.fadeInAt;
    const t = (steps - layer.fadeInAt) / span;
    layer.overlay.setOpacity(Math.min(1, Math.max(0, t)));
  });
  document.body.dataset.zoom = steps.toFixed(2);
  updateScaleLabel(steps);
}

map.on('zoom', updateLayerOpacity);
map.on('zoomend', updateLayerOpacity);

// Tells you where you are in the body as you zoom.
const scaleLabel = document.getElementById('scale-label');
function updateScaleLabel(steps) {
  let current = layers[0];
  layers.forEach((layer) => {
    if (layer.fadeInAt !== null && steps >= layer.fadeInBy - 0.3) current = layer;
  });
  scaleLabel.textContent = current.label;
}

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------
const markerFor = new Map();

PLACES.forEach((place) => {
  const icon = L.divIcon({
    className: `place-pin place-pin--${place.kind}`,
    html: '<span class="place-pin__dot"></span><span class="place-pin__name"></span>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

  const marker = L.marker(place.at, { icon, keyboard: true, title: place.name }).addTo(map);
  marker.getElement()?.querySelector('.place-pin__name')?.replaceChildren(place.name);
  marker.on('click', () => openCard(place));
  markerFor.set(place.id, marker);
});

// ---------------------------------------------------------------------------
// Drifting lanterns
// ---------------------------------------------------------------------------
const riverLine = L.polyline(RIVER_PATH, { opacity: 0 });
const lanterns = [];

for (let i = 0; i < LANTERN_COUNT; i++) {
  const icon = L.divIcon({
    className: 'lantern',
    html: '<span class="lantern__glow"></span>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
  lanterns.push({
    marker: L.marker(RIVER_PATH[0], { icon, interactive: false }).addTo(map),
    offset: i / LANTERN_COUNT,
  });
}

// Walk along the river path and return the point at fraction t (0 to 1).
function pointAlongRiver(t) {
  const pts = RIVER_PATH;
  const total = pts.length - 1;
  const scaled = t * total;
  const i = Math.min(total - 1, Math.floor(scaled));
  const local = scaled - i;
  return [
    pts[i][0] + (pts[i + 1][0] - pts[i][0]) * local,
    pts[i][1] + (pts[i + 1][1] - pts[i][1]) * local,
  ];
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let startTime = null;

function driftLanterns(now) {
  if (startTime === null) startTime = now;
  const elapsed = (now - startTime) / 1000;
  lanterns.forEach((lantern) => {
    const t = ((elapsed / LANTERN_TRIP_SECONDS) + lantern.offset) % 1;
    lantern.marker.setLatLng(pointAlongRiver(t));
  });
  requestAnimationFrame(driftLanterns);
}

if (prefersReducedMotion) {
  lanterns.forEach((lantern) => lantern.marker.setLatLng(pointAlongRiver(lantern.offset)));
} else {
  requestAnimationFrame(driftLanterns);
}

// ---------------------------------------------------------------------------
// The card that opens when you land somewhere
// ---------------------------------------------------------------------------
const card = document.getElementById('card');
const cardName = document.getElementById('card-name');
const cardBlurb = document.getElementById('card-blurb');
const cardBody = document.getElementById('card-body');
const cardThumb = document.getElementById('card-thumb');

// The thumbnail is a crop of the artwork at the place itself, taken from the
// deepest level you would see once you had flown there.
const THUMB = 76;
const THUMB_SPAN = 420;

function showThumb(place) {
  const level = layers.reduce(
    (best, layer) => (layer.fadeInAt !== null && place.zoom >= layer.fadeInAt ? layer : best),
    layers[0]
  );
  const scale = THUMB / THUMB_SPAN;
  const x = place.at[1] * scale;
  const y = (WORLD_HEIGHT - place.at[0]) * scale;
  cardThumb.style.backgroundImage = `url("${level.file}")`;
  cardThumb.style.backgroundSize = `${WORLD_WIDTH * scale}px ${WORLD_HEIGHT * scale}px`;
  cardThumb.style.backgroundPosition = `${THUMB / 2 - x}px ${THUMB / 2 - y}px`;
}

function openCard(place) {
  showThumb(place);
  cardName.textContent = place.name;
  cardBlurb.textContent = place.blurb;
  cardBody.textContent = place.body;
  card.hidden = false;
  card.classList.add('is-open');
}

function closeCard() {
  card.classList.remove('is-open');
  card.hidden = true;
}

document.getElementById('card-close').addEventListener('click', closeCard);

function goTo(place) {
  map.flyTo(place.at, IN(place.zoom), { duration: 2.4, easeLinearity: 0.22 });
  map.once('moveend', () => openCard(place));
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
const searchInput = document.getElementById('search');
const results = document.getElementById('results');
let activeIndex = -1;

function matches(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return PLACES.filter(
    (place) =>
      place.name.toLowerCase().includes(q) ||
      place.search.some((word) => word.includes(q) || q.includes(word))
  );
}

function renderResults(list) {
  results.replaceChildren();
  activeIndex = -1;
  if (!list.length) {
    results.hidden = true;
    return;
  }
  list.forEach((place, i) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'result';
    item.dataset.index = String(i);

    const name = document.createElement('span');
    name.className = 'result__name';
    name.textContent = place.name;

    const body = document.createElement('span');
    body.className = 'result__body';
    body.textContent = place.body;

    item.append(name, body);
    item.addEventListener('click', () => {
      searchInput.value = place.name;
      results.hidden = true;
      goTo(place);
    });
    results.append(item);
  });
  results.hidden = false;
}

searchInput.addEventListener('input', () => renderResults(matches(searchInput.value)));

searchInput.addEventListener('keydown', (event) => {
  const items = [...results.querySelectorAll('.result')];
  if (event.key === 'ArrowDown' && items.length) {
    event.preventDefault();
    activeIndex = (activeIndex + 1) % items.length;
    items[activeIndex].focus();
  } else if (event.key === 'Enter') {
    const list = matches(searchInput.value);
    if (list.length) {
      results.hidden = true;
      goTo(list[0]);
      searchInput.blur();
    }
  } else if (event.key === 'Escape') {
    results.hidden = true;
    searchInput.blur();
  }
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.search')) results.hidden = true;
});

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
document.getElementById('zoom-in').addEventListener('click', () => map.zoomIn(0.8));
document.getElementById('zoom-out').addEventListener('click', () => map.zoomOut(0.8));
document.getElementById('recentre').addEventListener('click', () => {
  closeCard();
  map.flyTo([WORLD_HEIGHT / 2, WORLD_WIDTH / 2], fitZoom, { duration: 1.6 });
});

updateLayerOpacity();
