/* Lindy's Table — find restaurants where you can hear each other.
 *
 * Restaurant listings: OpenStreetMap via the Overpass API (free, no key).
 * Town search: OpenStreetMap Nominatim. Map: Leaflet + OpenStreetMap tiles.
 * Quiet ratings: entered by diners (stored on the device for now — see `Store`),
 * plus "likely" verdicts from photos & reviews via the analysis server (config.js).
 */
(function () {
  "use strict";

  const D = window.QT_DATA;
  const CFG = window.QT_CONFIG || {};
  const DEMO = new URLSearchParams(location.search).has("demo");
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
  const NOMINATIM = "https://nominatim.openstreetmap.org/search";
  const LEAFLET = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/";
  const MAX_RESULTS = 600;
  const PAGE = 20;

  // ================================================================ storage
  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
  }

  /** Diner ratings. Replace with API calls to a shared database so everyone sees everyone's ratings. */
  const Store = {
    key: DEMO ? "qt.demoRatings" : "qt.ratings",
    all() { return load(this.key, {}); },
    get(id) { return this.all()[id] || []; },
    add(id, rating) { const all = this.all(); (all[id] = all[id] || []).push(rating); save(this.key, all); },
  };

  /** Places the user has hearted. */
  const Saved = {
    key: DEMO ? "qt.demoSaved" : "qt.saved",
    all() { return load(this.key, {}); },
    has(id) { return !!this.all()[id]; },
    toggle(p) {
      const all = this.all();
      if (all[p.id]) delete all[p.id];
      else {
        const { id, name, amenity, cuisine, lat, lon, addr, phone, website, hours, wheelchair, liveMusic, sportsTv, demoPredict } = p;
        all[p.id] = { id, name, amenity, cuisine, lat, lon, addr, phone, website, hours, wheelchair, liveMusic, sportsTv, demoPredict, savedAt: Date.now() };
      }
      save(this.key, all);
      return !!all[p.id];
    },
  };

  // ================================================================ state
  const settings = Object.assign({ text: "l", unit: "km", currency: guessCurrency(), theme: "auto" }, load("qt.settings", {}));
  const saved = load("qt.search", {});
  const state = {
    loc: null,
    radius: saved.radius || 5000,
    cuisine: saved.cuisine || "any",
    prices: new Set(saved.prices || []),
    quiet: saved.quiet || "all",
    sort: "quiet",
    view: "list",
    places: [],
    shown: PAGE,
    ratingFor: null,
    measuredDb: null,
    predictions: loadPredictionCache(),
    pending: new Set(),
    tab: "search",
    screen: "search",
  };

  function guessCurrency() {
    const lang = (navigator.language || "").toLowerCase();
    if (lang.endsWith("-gb")) return "£";
    if (/-(ie|fr|de|es|it|nl|at|be|pt|fi|gr)$/.test(lang)) return "€";
    return "$";
  }
  function persistSearch() {
    save("qt.search", { radius: state.radius, cuisine: state.cuisine, prices: [...state.prices], quiet: state.quiet });
  }
  function loadPredictionCache() {
    if (DEMO) return {};
    const c = load("qt.predictions", {}), out = {}, now = Date.now();
    for (const [id, v] of Object.entries(c)) if (now - v.t < 7 * 86400000) out[id] = v.r;
    return out;
  }
  function savePredictionCache() {
    if (DEMO) return;
    const c = load("qt.predictions", {}), now = Date.now();
    for (const [id, r] of Object.entries(state.predictions)) if (r && !c[id]) c[id] = { r, t: now };
    save("qt.predictions", Object.fromEntries(Object.entries(c).sort((a, b) => b[1].t - a[1].t).slice(0, 500)));
  }

  // ================================================================ helpers
  const icon = (name) => `<svg class="i" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function distanceM(a, b) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const MI = 1609.344;
  function fmtDistance(m) {
    if (settings.unit === "mi") {
      const mi = m / MI;
      return mi < 0.1 ? "under 0.1 miles" : `${+mi.toFixed(mi < 10 ? 1 : 0)} mile${mi === 1 ? "" : "s"}`;
    }
    return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${+(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
  }
  function radiusOptions() {
    return settings.unit === "mi"
      ? [1, 3, 5, 10, 15].map((n) => ({ value: Math.round(n * MI), label: `${n} mi` }))
      : [1, 2, 5, 10, 20].map((n) => ({ value: n * 1000, label: `${n} km` }));
  }
  const priceLabel = (n) => settings.currency.repeat(n);
  const priceWords = (n) => ["", "Inexpensive", "Moderate", "Pricey", "Very expensive"][n];
  const titleCase = (s) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  function cuisineText(tag, amenity) {
    const parts = (tag || "").split(/[;,]/).map((s) => s.trim()).filter(Boolean).slice(0, 2).map(titleCase);
    if (!parts.length) return amenity === "cafe" ? "Café" : "Restaurant";
    return parts.join(", ") + (amenity === "cafe" ? " café" : "");
  }
  function prettyHours(h) {
    const days = { Mo: "Mon", Tu: "Tue", We: "Wed", Th: "Thu", Fr: "Fri", Sa: "Sat", Su: "Sun", PH: "Holidays" };
    return h.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (d) => days[d]).replace(/-/g, "–").replace(/;\s*/g, " · ").replace(/\boff\b/g, "closed");
  }
  function timeAgo(t) {
    const days = Math.floor((Date.now() - t) / 86400000);
    if (days < 1) return "today";
    if (days < 2) return "yesterday";
    if (days < 31) return `${days} days ago`;
    const months = Math.floor(days / 30);
    return months < 12 ? `${months} month${months > 1 ? "s" : ""} ago` : "over a year ago";
  }
  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.innerHTML = `${icon("check")}<span>${esc(msg)}</span>`;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 3500);
  }
  async function fetchWithTimeout(url, opts = {}, ms = 30000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try { return await fetch(url, { ...opts, signal: ctrl.signal }); } finally { clearTimeout(t); }
  }

  // ================================================================ quiet score
  const dbToScore = (db) => (db <= 65 ? 4 : db <= 70 ? 3 : db <= 76 ? 2 : 1);

  function summarise(ratings) {
    if (!ratings.length) return { level: 0, count: 0 };
    let sum = 0, n = 0;
    const music = { none: 0, soft: 0, loud: 0 }, dbs = [], prices = [], feats = {};
    for (const r of ratings) {
      sum += r.talk; n++;
      if (r.db) { sum += dbToScore(r.db); n++; dbs.push(r.db); }
      if (r.music) music[r.music]++;
      if (r.price) prices.push(r.price);
      for (const f of r.features || []) feats[f] = (feats[f] || 0) + 1;
    }
    const score = sum / n;
    prices.sort((a, b) => a - b);
    return {
      level: score >= 3.25 ? 4 : score >= 2.5 ? 3 : score >= 1.75 ? 2 : 1,
      score,
      count: ratings.length,
      price: prices.length ? prices[Math.floor(prices.length / 2)] : 0,
      db: dbs.length ? Math.round(dbs.reduce((a, b) => a + b, 0) / dbs.length) : null,
      loudMusic: music.loud > 0 && music.loud > (music.none + music.soft) / 2,
      topFeatures: Object.entries(feats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => D.features.find((f) => f.id === id)).filter(Boolean),
      latest: Math.max(...ratings.map((r) => r.t || 0)),
    };
  }

  const PRED_LEVEL = { quiet: 4, fairly_quiet: 3, noisy: 2, very_noisy: 1 };
  const PRED_SCORE = { 4: 3.55, 3: 2.85, 2: 2.0, 1: 1.2 };

  /** Diner ratings win; otherwise fall back to the verdict from photos & reviews. */
  function quietInfo(p) {
    const q = summarise(Store.get(p.id));
    const pr = state.predictions[p.id];
    if (pr) {
      if (!q.price && pr.price) q.price = pr.price;
      if (pr.quieter_times) q.quieterTimes = pr.quieter_times;
      q.liveMusic = !!pr.liveMusic;
      q.sportsTv = !!pr.sportsTv;
    }
    if (!q.count && pr && PRED_LEVEL[pr.level]) {
      q.level = PRED_LEVEL[pr.level];
      q.score = PRED_SCORE[q.level] - (pr.confidence === "low" ? 0.3 : 0);
      q.predicted = true;
      q.confidence = pr.confidence;
      q.reasons = pr.reasons || [];
    }
    q.pending = !q.count && !q.predicted && state.pending.has(p.id);
    return q;
  }

  const LEVELS = {
    4: { cls: "q4", text: "Quiet", sub: "Easy to talk — conversation comes naturally." },
    3: { cls: "q3", text: "Fairly quiet", sub: "Talking takes a little effort at busy times." },
    2: { cls: "q2", text: "Noisy", sub: "You may need to raise your voice." },
    1: { cls: "q1", text: "Very noisy", sub: "Hard to hear each other." },
    0: { cls: "q0", text: "Not rated yet", sub: "No one has rated the noise here yet." },
  };

  const bars = (level) => `<span class="bars" aria-hidden="true">${[1, 2, 3, 4].map((n) => `<i class="${n <= level ? "on" : ""}"></i>`).join("")}</span>`;
  function qBadge(q) {
    if (q.pending) return `<span class="qbadge checking">${bars(0)}Checking…</span>`;
    const L = LEVELS[q.level];
    const text = q.predicted ? `Likely ${L.text.toLowerCase()}` : L.text;
    return `<span class="qbadge ${L.cls}${q.predicted ? " predicted" : ""}">${bars(q.level)}${text}</span>`;
  }

  // ================================================================ navigation
  const TAB_OF = { search: "search", results: "search", details: null, rate: null, saved: "saved", help: "help" };
  function show(name, { push = true } = {}) {
    state.screen = name;
    if (TAB_OF[name]) state.tab = TAB_OF[name];
    for (const s of $$(".screen")) s.hidden = s.id !== `screen-${name}`;
    $$(".tab").forEach((t) => (t.dataset.tab === state.tab ? t.setAttribute("aria-current", "page") : t.removeAttribute("aria-current")));
    $("#btn-back").hidden = ["search", "saved", "help"].includes(name);
    window.scrollTo(0, 0);
    const h = $(`#screen-${name} h1`);
    if (h) h.focus({ preventScroll: true });
    if (push && history.state?.screen !== name) history.pushState({ screen: name, tab: state.tab }, "", location.search || location.pathname);
  }
  window.addEventListener("popstate", (e) => {
    const name = e.state?.screen || "search";
    if (e.state?.tab) state.tab = e.state.tab;
    if (name === "results" && !state.places.length) { show("search", { push: false }); return; }
    if (name === "saved") renderSaved();
    show(name, { push: false });
    if (name === "results") renderResults();
  });
  function goBack() {
    if (history.state && history.length > 1 && state.screen !== "search") history.back();
    else show("search");
  }

  // ================================================================ controls
  function segRadio(container, options, current, onPick, cls = "seg") {
    container.innerHTML = "";
    for (const o of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = cls;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(o.value === current));
      b.innerHTML = o.html || esc(o.label);
      b.addEventListener("click", () => {
        $$(`.${cls}`, container).forEach((x) => x.setAttribute("aria-checked", "false"));
        b.setAttribute("aria-checked", "true");
        onPick(o.value);
      });
      container.appendChild(b);
    }
  }

  function applySettings() {
    const root = document.documentElement;
    root.dataset.text = settings.text;
    if (settings.theme === "auto") delete root.dataset.theme; else root.dataset.theme = settings.theme;
    save("qt.settings", settings);
  }
  function renderSettings() {
    segRadio($("#textsize-buttons"), [
      { value: "l", html: `<span style="font-size:.9rem">Large</span>` },
      { value: "xl", html: `<span style="font-size:1.05rem">Larger</span>` },
      { value: "xxl", html: `<span style="font-size:1.2rem">Largest</span>` },
    ], settings.text, (v) => { settings.text = v; applySettings(); });
    segRadio($("#unit-buttons"), [{ value: "km", label: "Kilometres" }, { value: "mi", label: "Miles" }], settings.unit, (v) => {
      settings.unit = v; applySettings();
      const opts = radiusOptions();
      state.radius = opts.reduce((best, o) => (Math.abs(o.value - state.radius) < Math.abs(best.value - state.radius) ? o : best)).value;
      persistSearch(); renderSearchControls(); refreshCurrent();
    });
    segRadio($("#currency-buttons"), ["$", "£", "€"].map((c) => ({ value: c, label: c })), settings.currency, (v) => {
      settings.currency = v; applySettings(); renderSearchControls(); refreshCurrent();
    });
    segRadio($("#theme-buttons"), [{ value: "auto", label: "Automatic" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }], settings.theme, (v) => {
      settings.theme = v; applySettings();
    });
  }
  function refreshCurrent() {
    if (state.screen === "results") renderResults();
    if (state.screen === "saved") renderSaved();
    if (state.screen === "details" && state.detailId) renderDetails(state.detailId);
  }

  function renderSearchControls() {
    segRadio($("#radius-buttons"), radiusOptions(), state.radius, (v) => { state.radius = v; persistSearch(); });

    segRadio($("#cuisine-chips"), D.cuisines.map((c) => ({ value: c.id, label: c.label })), state.cuisine, (v) => { state.cuisine = v; persistSearch(); }, "chip");

    const pc = $("#price-buttons");
    pc.innerHTML = "";
    for (let n = 1; n <= 4; n++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seg";
      b.setAttribute("aria-pressed", String(state.prices.has(n)));
      b.setAttribute("aria-label", `${priceWords(n)} (${priceLabel(n)})`);
      b.textContent = priceLabel(n);
      b.addEventListener("click", () => {
        state.prices.has(n) ? state.prices.delete(n) : state.prices.add(n);
        b.setAttribute("aria-pressed", String(state.prices.has(n)));
        persistSearch();
      });
      pc.appendChild(b);
    }

    segRadio($("#quiet-buttons"), [
      { value: "all", html: `<span class="radio"></span><span>Show everything, quietest first</span>` },
      { value: "notnoisy", html: `<span class="radio"></span><span>Hide noisy places</span>` },
      { value: "quiet", html: `<span class="radio"></span><span>Only quiet places</span>` },
    ], state.quiet, (v) => { state.quiet = v; persistSearch(); }, "option");
  }

  // ================================================================ location
  function setLocation(loc) {
    state.loc = loc;
    const st = $("#location-status");
    st.className = "status ok";
    st.innerHTML = `${icon("check")}<span>Searching near ${esc(loc.label)}</span>`;
    $("#btn-find").disabled = false;
    $("#find-hint").hidden = true;
    $("#place-choices").hidden = true;
  }
  function locationError(msg) {
    const st = $("#location-status");
    st.className = "status err";
    st.textContent = msg;
  }
  function useMyLocation() {
    if (DEMO) { setLocation({ lat: 51.5, lon: -0.12, label: "the demo town centre" }); return; }
    if (!navigator.geolocation) { locationError("Your device can't share its location. Please type a town instead."); return; }
    const st = $("#location-status");
    st.className = "status";
    st.textContent = "Finding where you are…";
    navigator.geolocation.getCurrentPosition(
      (p) => setLocation({ lat: p.coords.latitude, lon: p.coords.longitude, label: "your current location", here: true }),
      (err) => locationError(err.code === 1
        ? "Location is turned off for this app. Type a town instead, or allow location in your phone's settings."
        : "We couldn't find your location. Please type a town instead."),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
    );
  }
  async function searchPlace(q) {
    q = q.trim();
    if (!q) { locationError("Please type a town, street or postcode."); return; }
    if (DEMO) { setLocation({ lat: 51.5, lon: -0.12, label: `${q} (demo)` }); return; }
    const st = $("#location-status");
    st.className = "status";
    st.textContent = "Looking that up…";
    try {
      const url = `${NOMINATIM}?format=jsonv2&limit=5&q=${encodeURIComponent(q)}&accept-language=${encodeURIComponent(navigator.language || "en")}`;
      const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, 15000);
      if (!res.ok) throw new Error(res.status);
      const hits = await res.json();
      if (!hits.length) { locationError(`We couldn't find “${q}”. Try adding the town or country.`); return; }
      if (hits.length === 1) { setLocation({ lat: +hits[0].lat, lon: +hits[0].lon, label: hits[0].display_name }); return; }
      st.className = "status";
      st.textContent = "Which one did you mean?";
      const ul = $("#place-choices");
      ul.innerHTML = "";
      for (const h of hits) {
        const li = document.createElement("li");
        const b = document.createElement("button");
        b.type = "button";
        b.innerHTML = `${icon("pin")}<span>${esc(h.display_name)}</span>`;
        b.addEventListener("click", () => setLocation({ lat: +h.lat, lon: +h.lon, label: h.display_name }));
        li.appendChild(b);
        ul.appendChild(li);
      }
      ul.hidden = false;
      ul.querySelector("button").focus();
    } catch {
      locationError("We couldn't look that up just now. Please check your internet connection and try again.");
    }
  }

  // ================================================================ fetching places
  function buildQuery({ lat, lon }, radius, cuisineId) {
    const c = D.cuisines.find((x) => x.id === cuisineId) || D.cuisines[0];
    const around = `(around:${Math.round(radius)},${lat.toFixed(6)},${lon.toFixed(6)})`;
    const clauses = [];
    for (const a of c.amenity ? [c.amenity] : ["restaurant", "cafe"]) {
      if (!c.match) clauses.push(`nwr["amenity"="${a}"]["name"]${around};`);
      else {
        clauses.push(`nwr["amenity"="${a}"]["name"]["cuisine"~"${c.match}",i]${around};`);
        if (c.diet) clauses.push(`nwr["amenity"="${a}"]["name"]["diet:vegetarian"~"yes|only"]${around};`, `nwr["amenity"="${a}"]["name"]["diet:vegan"~"yes|only"]${around};`);
      }
    }
    return `[out:json][timeout:25];(${clauses.join("")});out center tags ${MAX_RESULTS};`;
  }
  async function fetchPlaces(loc, radius, cuisineId) {
    if (DEMO) return demoPlaces(loc, radius, cuisineId);
    const body = "data=" + encodeURIComponent(buildQuery(loc, radius, cuisineId));
    let lastErr;
    for (const url of OVERPASS) {
      try {
        const res = await fetchWithTimeout(url, { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } }, 35000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const seen = new Set();
        return json.elements.map((el) => fromOsm(el, loc)).filter((p) => p && !seen.has(p.id) && seen.add(p.id));
      } catch (e) { lastErr = e; }
    }
    throw lastErr;
  }
  function fromOsm(el, origin) {
    const t = el.tags || {};
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
    if (lat == null || !t.name) return null;
    const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
    return {
      id: `${el.type}/${el.id}`,
      name: t.name,
      amenity: t.amenity,
      cuisine: t.cuisine || "",
      lat, lon,
      dist: distanceM(origin, { lat, lon }),
      addr: [street, t["addr:city"] || t["addr:suburb"] || t["addr:place"]].filter(Boolean).join(", "),
      phone: t.phone || t["contact:phone"] || "",
      website: t.website || t["contact:website"] || "",
      hours: t.opening_hours || "",
      wheelchair: t.wheelchair || "",
      liveMusic: t.live_music === "yes",
      sportsTv: !!t.sport,
      takeawayOnly: t.takeaway === "only",
    };
  }
  function demoPlaces(loc, radius, cuisineId) {
    const c = D.cuisines.find((x) => x.id === cuisineId) || D.cuisines[0];
    const re = c.match ? new RegExp(c.match, "i") : null;
    const all = Store.all();
    if (!Object.keys(all).length) {
      const now = Date.now();
      D.demo.forEach((d, i) => {
        all[`demo/${i}`] = (d.ratings || []).map(([talk, music, db, features, price], j) => ({ talk, music, db, features, price, t: now - (j * 9 + i + 2) * 86400000 }));
      });
      save(Store.key, all);
    }
    const kmLat = 1 / 110.574, kmLon = 1 / (111.32 * Math.cos(loc.lat * Math.PI / 180));
    return new Promise((resolve) => setTimeout(() => resolve(
      D.demo.map((d, i) => {
        const lat = loc.lat + d.dy * kmLat, lon = loc.lon + d.dx * kmLon;
        return { id: `demo/${i}`, name: d.name, amenity: d.amenity || "restaurant", cuisine: d.cuisine, lat, lon,
          dist: distanceM(loc, { lat, lon }), addr: d.addr, phone: d.phone || "", website: d.website || "", hours: d.hours || "",
          wheelchair: d.wheelchair || "", liveMusic: !!d.liveMusic, demoPredict: d.predict || null };
      }).filter((p) => p.dist <= radius && (c.id === "any" || (c.amenity ? p.amenity === c.amenity : re.test(p.cuisine))))
    ), 600));
  }

  // ================================================================ results
  async function runSearch() {
    if (!state.loc) return;
    persistSearch();
    show("results");
    const c = D.cuisines.find((x) => x.id === state.cuisine);
    $("#results-title").textContent = state.cuisine === "any" ? "Restaurants near you" : `${c.label} near you`;
    $("#results-list").innerHTML = "";
    $("#btn-more").hidden = true;
    $("#map-wrap").hidden = true;
    $("#results-summary").textContent = "";
    $("#results-loading").hidden = false;
    try {
      const places = await fetchPlaces(state.loc, state.radius, state.cuisine);
      state.places = places.filter((p) => p.dist <= state.radius && !p.takeawayOnly);
      state.shown = PAGE;
      renderResults();
    } catch {
      $("#results-list").innerHTML = `<li class="empty">${icon("globe")}<h2>We couldn't load restaurants</h2>
        <p>This is usually a busy server or a weak internet connection. Please wait a moment and try again.</p>
        <button type="button" class="btn btn-primary" id="btn-retry">Try again</button></li>`;
      $("#btn-retry").addEventListener("click", runSearch);
    } finally {
      $("#results-loading").hidden = true;
    }
  }

  function filteredSorted() {
    const list = state.places.map((p) => ({ ...p, q: quietInfo(p) })).filter((p) => {
      if (state.quiet === "quiet" && (p.q.level !== 4 || p.q.confidence === "low")) return false;
      if (state.quiet === "notnoisy" && (p.q.level === 1 || p.q.level === 2)) return false;
      if (state.prices.size && p.q.price && !state.prices.has(p.q.price)) return false;
      return true;
    });
    if (state.sort === "near") list.sort((a, b) => a.dist - b.dist);
    else list.sort((a, b) => ((b.q.level === 0 ? 2.4 : b.q.score) - (a.q.level === 0 ? 2.4 : a.q.score)) || a.dist - b.dist);
    return list;
  }

  function renderResults() {
    const list = filteredSorted();
    state.list = list;
    const rated = list.filter((p) => p.q.count).length;
    const likely = list.filter((p) => p.q.predicted).length;
    const checking = list.slice(0, state.shown).some((p) => p.q.pending);
    const area = `within ${fmtDistance(state.radius)}`;
    const parts = [];
    if (list.length) {
      parts.push(`${list.length} place${list.length > 1 ? "s" : ""} ${area}.`);
      if (rated) parts.push(`${rated} rated by diners.`);
      if (likely) parts.push(`${likely} judged from photos and reviews.`);
      if (checking) parts.push("Checking photos and reviews…");
      else if (!rated && !likely) parts.push("None rated for noise yet — you could be the first.");
    }
    $("#results-summary").textContent = parts.join(" ");

    const ul = $("#results-list");
    if (!list.length) {
      const why = state.places.length ? "Some places were hidden by your quiet or price choices." : "There may be no listed restaurants of this kind nearby.";
      ul.innerHTML = `<li class="empty">${icon("search")}<h2>No places found ${esc(area)}</h2><p>${why} Try a bigger distance or “Any kind of food”.</p>
        <button type="button" class="btn btn-primary" data-go="search">Change my search</button></li>`;
      $("#btn-more").hidden = true;
      $("#map-wrap").hidden = true;
      return;
    }
    const isMap = state.view === "map";
    $("#map-wrap").hidden = !isMap;
    ul.hidden = isMap;
    ul.innerHTML = list.slice(0, state.shown).map((p, i) => cardHtml(p, i + 1)).join("");
    $("#btn-more").hidden = isMap || list.length <= state.shown;
    $("#btn-more").textContent = `Show ${Math.min(PAGE, list.length - state.shown)} more`;
    if (isMap) drawMap(list.slice(0, Math.max(state.shown, 40)));
    loadPredictions(list.slice(0, state.shown));
  }

  function cardHtml(p, n) {
    const q = p.q;
    let src = "", why = "";
    if (q.count) src = `<span class="card-src">${icon("users")}${q.count} diner rating${q.count > 1 ? "s" : ""}</span>`;
    else if (q.predicted) src = `<span class="card-src">${icon("sparkle")}From photos &amp; reviews${q.confidence === "low" ? " · rough guess" : ""}</span>`;
    else if (q.pending) src = `<span class="card-src">Looking at photos &amp; reviews</span>`;
    if (q.predicted && q.reasons?.length) why = `<p class="card-why">${esc(q.reasons[0])}</p>`;
    else if (q.count && q.topFeatures?.length) why = `<p class="card-why">Diners mention ${esc(q.topFeatures.map((f) => f.label.toLowerCase()).slice(0, 2).join(" and "))}</p>`;
    else if (p.liveMusic || q.liveMusic || p.sportsTv || q.sportsTv) why = `<p class="card-why warn">${(p.liveMusic || q.liveMusic) ? "Live music at times" : "May show sport on TV"}</p>`;
    const price = q.price ? `<span aria-label="${priceWords(q.price)}">${priceLabel(q.price)}</span>` : "";
    const isSaved = Saved.has(p.id);
    const dist = p.dist != null ? `<span>${icon("pin")}${esc(fmtDistance(p.dist))}</span>` : "";
    return `<li class="card">
      <button type="button" class="card-link" data-detail="${esc(p.id)}">
        <span class="card-top">${n ? `<span class="card-num" aria-hidden="true">${n}</span>` : ""}${qBadge(q)}${src}</span>
        <h2>${esc(p.name)}</h2>
        <span class="card-meta">${dist}<span>${icon("utensils")}${esc(cuisineText(p.cuisine, p.amenity))}</span>${price}</span>
        ${why}
        <span class="card-more">See details ${icon("right")}</span>
      </button>
      <button type="button" class="save-btn" data-save="${esc(p.id)}" aria-pressed="${isSaved}" aria-label="${isSaved ? "Remove from saved" : "Save"} ${esc(p.name)}">${icon("heart")}</button>
    </li>`;
  }

  // Ask the analysis server about places that have no diner ratings yet.
  async function loadPredictions(shown) {
    const todo = shown.filter((p) => !p.q.count && !(p.id in state.predictions) && !state.pending.has(p.id));
    if (!todo.length) return;
    if (DEMO) {
      todo.forEach((p) => state.pending.add(p.id));
      rerender();
      await new Promise((r) => setTimeout(r, 1400));
      todo.forEach((p) => { state.pending.delete(p.id); state.predictions[p.id] = p.demoPredict; });
      rerender();
      return;
    }
    if (!CFG.analysisUrl) return;
    todo.forEach((p) => state.pending.add(p.id));
    rerender();
    const batches = [];
    for (let i = 0; i < todo.length; i += 10) batches.push(todo.slice(i, i + 10));
    await Promise.all(batches.map(async (batch) => {
      try {
        const res = await fetchWithTimeout(CFG.analysisUrl.replace(/\/$/, "") + "/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ places: batch.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon })) }),
        }, 90000);
        const data = res.ok ? await res.json() : { results: {} };
        for (const p of batch) state.predictions[p.id] = data.results?.[p.id] ?? null;
      } catch {
        for (const p of batch) state.predictions[p.id] = null;
      } finally {
        batch.forEach((p) => state.pending.delete(p.id));
      }
    }));
    savePredictionCache();
    rerender();
  }
  function rerender() {
    if (state.screen === "results") renderResults();
    else if (state.screen === "details" && state.detailId) renderDetails(state.detailId);
  }

  // ================================================================ map
  let leafletPromise, map, mapLayer, miniMap;
  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (!leafletPromise) {
      leafletPromise = new Promise((resolve, reject) => {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = LEAFLET + "leaflet.min.css";
        document.head.appendChild(css);
        const s = document.createElement("script");
        s.src = LEAFLET + "leaflet.min.js";
        s.onload = () => resolve(window.L);
        s.onerror = () => { leafletPromise = null; reject(new Error("leaflet")); };
        document.head.appendChild(s);
      });
    }
    return leafletPromise;
  }
  function pinIcon(L, q, n) {
    const cls = `${LEVELS[q.level].cls}${q.predicted ? " predicted" : ""}`;
    return L.divIcon({ className: "", html: `<div class="pin ${cls}"><b>${n ?? ""}</b></div>`, iconSize: [38, 38], iconAnchor: [19, 40], popupAnchor: [0, -38] });
  }
  function tiles(L, m) {
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
  }
  async function drawMap(list) {
    let L;
    try { L = await loadLeaflet(); } catch {
      $("#map").innerHTML = `<div class="map-fallback">The map couldn't load. Please check your internet connection, or use the list.</div>`;
      return;
    }
    if (!map) {
      map = L.map("map", { zoomControl: true, scrollWheelZoom: false });
      tiles(L, map);
      mapLayer = L.layerGroup().addTo(map);
    }
    mapLayer.clearLayers();
    const pts = [];
    list.forEach((p, i) => {
      const m = L.marker([p.lat, p.lon], { icon: pinIcon(L, p.q, i + 1), title: p.name, alt: p.name }).addTo(mapLayer);
      const label = p.q.predicted ? `Likely ${LEVELS[p.q.level].text.toLowerCase()}` : LEVELS[p.q.level].text;
      m.bindPopup(`<strong>${esc(p.name)}</strong>${esc(label)} · ${esc(fmtDistance(p.dist))}<button type="button" class="btn btn-primary" data-detail="${esc(p.id)}">See details</button>`);
      pts.push([p.lat, p.lon]);
    });
    if (state.loc) {
      L.marker([state.loc.lat, state.loc.lon], { icon: L.divIcon({ className: "", html: '<div class="me-dot"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }), keyboard: false, title: "You are here" }).addTo(mapLayer);
      pts.push([state.loc.lat, state.loc.lon]);
    }
    setTimeout(() => { map.invalidateSize(); if (pts.length) map.fitBounds(pts, { padding: [36, 36], maxZoom: 16 }); }, 0);
  }

  // ================================================================ details
  function getPlace(id) {
    const live = state.places.find((x) => x.id === id);
    if (live) return live;
    const s = Saved.all()[id];
    if (!s) return null;
    return { ...s, dist: state.loc ? distanceM(state.loc, s) : null };
  }
  function openDetails(id) {
    state.detailId = id;
    renderDetails(id);
    show("details");
    const p = getPlace(id);
    if (p) loadPredictions([{ ...p, q: quietInfo(p) }]);
  }
  function renderDetails(id) {
    const p = getPlace(id);
    if (!p) return;
    const q = quietInfo(p);
    const L = LEVELS[q.level];
    const dir = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
    const isSaved = Saved.has(p.id);

    let verdict;
    if (q.pending) {
      verdict = `<div class="verdict q0"><div class="verdict-head">${bars(0)}<div><div class="verdict-title">Checking…</div><div class="verdict-sub">Looking at photos and reviews of this place.</div></div></div></div>`;
    } else {
      const title = q.predicted ? `Likely ${L.text.toLowerCase()}` : L.text;
      let list = "", src = "";
      if (q.count) {
        const items = [];
        if (q.db) items.push(`Measured about ${q.db} dB on average`);
        if (q.loudMusic) items.push("Diners say the music is too loud");
        (q.topFeatures || []).forEach((f) => items.push(f.label));
        list = items.length ? `<ul>${items.map((t) => `<li>${icon("check")}<span>${esc(t)}</span></li>`).join("")}</ul>` : "";
        src = `<p class="src">${icon("users")}Based on ${q.count} diner rating${q.count > 1 ? "s" : ""} · last rated ${timeAgo(q.latest)}</p>`;
      } else if (q.predicted) {
        list = (q.reasons || []).length ? `<ul>${q.reasons.map((t) => `<li>${icon("check")}<span>${esc(t)}</span></li>`).join("")}</ul>` : "";
        src = `<p class="src">${icon("sparkle")}Judged from photos and reviews${q.confidence === "low" ? " — a rough guess" : ""}. Diner ratings will replace this.</p>`;
      } else {
        src = `<p class="src">${icon("pencil")}Been here? Your rating will help others.</p>`;
      }
      verdict = `<div class="verdict ${L.cls}${q.predicted ? " predicted" : ""}">
        <div class="verdict-head">${bars(q.level)}<div><div class="verdict-title">${title}</div><div class="verdict-sub">${esc(L.sub)}</div></div></div>
        ${list}${src}</div>`;
    }

    const info = [];
    if (p.addr) info.push(`<li>${icon("pin")}<span>${esc(p.addr)}</span></li>`);
    if (p.hours) info.push(`<li>${icon("clock")}<span>${esc(prettyHours(p.hours))}<small>Opening hours — worth checking before you go</small></span></li>`);
    if (q.quieterTimes) info.push(`<li>${icon("sun")}<span>Quieter times: ${esc(q.quieterTimes)}</span></li>`);
    if (p.wheelchair === "yes") info.push(`<li>${icon("access")}<span>Wheelchair accessible</span></li>`);
    else if (p.wheelchair === "limited") info.push(`<li>${icon("access")}<span>Limited wheelchair access</span></li>`);
    if (p.liveMusic || q.liveMusic) info.push(`<li class="warn">${icon("music")}<span>Has live music at times</span></li>`);
    if (p.sportsTv || q.sportsTv) info.push(`<li class="warn">${icon("tv")}<span>May show sport on TV</span></li>`);
    if (p.phone) info.push(`<li>${icon("phone")}<span>${esc(p.phone.split(";")[0])}</span></li>`);

    const price = q.price ? `<span>${priceLabel(q.price)} · ${priceWords(q.price)}</span>` : "";
    const dist = p.dist != null ? `<span>${icon("pin")}${esc(fmtDistance(p.dist))} away</span>` : "";
    const tel = p.phone ? p.phone.split(";")[0].replace(/[^\d+]/g, "") : "";
    const web = p.website ? (/^https?:/i.test(p.website) ? p.website : "https://" + p.website) : "";

    $("#details").innerHTML = `
      <div class="detail-hero">
        <p class="eyebrow">${esc(cuisineText(p.cuisine, p.amenity))}</p>
        <h1 id="details-title" tabindex="-1">${esc(p.name)}</h1>
        <p class="card-meta">${dist}${price}</p>
        ${verdict}
      </div>
      <div class="action-row">
        <a class="action" href="${dir}" target="_blank" rel="noopener">${icon("nav")}Directions</a>
        ${tel ? `<a class="action" href="tel:${esc(tel)}">${icon("phone")}Call</a>` : ""}
        ${web ? `<a class="action" href="${esc(web)}" target="_blank" rel="noopener">${icon("globe")}Website</a>` : ""}
        <button type="button" class="action" data-save="${esc(p.id)}" aria-pressed="${isSaved}">${icon("heart")}${isSaved ? "Saved" : "Save"}</button>
      </div>
      <button type="button" class="btn btn-primary btn-block btn-xl" data-rate="${esc(p.id)}">${icon("pencil")} Rate the noise here</button>
      ${info.length ? `<h2 class="section-title">About this place</h2><div class="info"><ul class="info-list">${info.join("")}</ul></div>` : ""}
      <h2 class="section-title">Location</h2>
      <div id="mini-map" class="map-mini" aria-label="Map showing ${esc(p.name)}"></div>`;
    drawMiniMap(p, q);
  }
  async function drawMiniMap(p, q) {
    let L;
    try { L = await loadLeaflet(); } catch {
      const el = $("#mini-map");
      if (el) el.innerHTML = `<div class="map-fallback">${esc(p.addr || "Map unavailable offline")}</div>`;
      return;
    }
    const el = $("#mini-map");
    if (!el) return;
    if (miniMap) { miniMap.remove(); miniMap = null; }
    miniMap = L.map(el, { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, keyboard: false }).setView([p.lat, p.lon], 16);
    tiles(L, miniMap);
    L.marker([p.lat, p.lon], { icon: pinIcon(L, q, ""), keyboard: false }).addTo(miniMap);
  }

  // ================================================================ saved
  function renderSaved() {
    const all = Object.values(Saved.all()).sort((a, b) => b.savedAt - a.savedAt);
    const ul = $("#saved-list");
    if (!all.length) {
      ul.innerHTML = `<li class="empty">${icon("heart")}<h2>Nothing saved yet</h2><p>Tap the heart on any restaurant to keep it here for next time.</p>
        <button type="button" class="btn btn-primary" data-tab="search">Find a restaurant</button></li>`;
      return;
    }
    ul.innerHTML = all.map((s) => {
      const p = { ...s, dist: state.loc ? distanceM(state.loc, s) : null };
      return cardHtml({ ...p, q: quietInfo(p) }, 0);
    }).join("");
  }
  function toggleSave(id, btn) {
    const p = getPlace(id);
    if (!p) return;
    const on = Saved.toggle(p);
    toast(on ? `Saved ${p.name}` : `Removed ${p.name}`);
    $$(`[data-save="${CSS.escape(id)}"]`).forEach((b) => {
      b.setAttribute("aria-pressed", String(on));
      if (b.classList.contains("action")) b.innerHTML = `${icon("heart")}${on ? "Saved" : "Save"}`;
      else b.setAttribute("aria-label", `${on ? "Remove from saved" : "Save"} ${p.name}`);
    });
    if (state.screen === "saved" && !on) renderSaved();
  }

  // ================================================================ rating
  function openRating(id) {
    const p = getPlace(id);
    if (!p) return;
    state.ratingFor = p;
    state.measuredDb = null;
    $("#rate-form").reset();
    $("#rate-place").textContent = p.name;
    $("#meter-db").textContent = "––";
    $("#gauge-fill").setAttribute("stroke-dasharray", "0 100");
    $("#meter-status").textContent = "At the restaurant? Your phone can take a 10-second reading. Nothing is recorded — only the number is kept.";
    $("#btn-measure").innerHTML = `${icon("mic")} Measure for 10 seconds`;
    $("#feature-checks").innerHTML = D.features.map((f) =>
      `<label class="chip ${f.good ? "good" : "bad"}"><input type="checkbox" name="feat" value="${f.id}" />${icon(f.good ? "check" : "x")}<span>${esc(f.label)}</span></label>`).join("");
    $("#rate-price").innerHTML = [1, 2, 3, 4].map((n) =>
      `<label class="seg"><input type="radio" name="price" value="${n}" aria-label="${priceWords(n)}" /><span>${priceLabel(n)}</span></label>`).join("");
    show("rate");
  }
  function submitRating(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const talk = Number(f.get("talk"));
    if (!talk) { toast("Please answer the first question"); $("#rate-form .option").scrollIntoView({ block: "center" }); return; }
    Store.add(state.ratingFor.id, {
      talk,
      music: f.get("music") || null,
      features: f.getAll("feat"),
      price: Number(f.get("price")) || null,
      db: state.measuredDb,
      t: Date.now(),
    });
    toast("Thank you — rating saved");
    history.back();
    setTimeout(() => { if (state.screen === "details") renderDetails(state.ratingFor.id); }, 50);
  }

  // Sound level meter. Phones aren't calibrated, so this is an estimate.
  const DB_OFFSET = 94; // dBFS -> rough dB SPL for a typical phone microphone
  async function measure() {
    const btn = $("#btn-measure"), st = $("#meter-status");
    if (!navigator.mediaDevices?.getUserMedia) { st.textContent = "This device or browser can't measure sound."; return; }
    btn.disabled = true;
    st.textContent = "Please allow the microphone when asked…";
    let stream, ctx;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Float32Array(an.fftSize);
      let energy = 0, frames = 0;
      const end = performance.now() + 10000;
      await new Promise((resolve) => {
        (function tick() {
          an.getFloatTimeDomainData(buf);
          let s = 0;
          for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
          const ms = s / buf.length;
          energy += ms; frames++;
          showDb(Math.max(30, Math.round(10 * Math.log10(ms || 1e-12) + DB_OFFSET)));
          const left = Math.ceil((end - performance.now()) / 1000);
          if (left > 0) { st.textContent = `Listening… ${left} second${left > 1 ? "s" : ""} left. Hold your phone at the table.`; requestAnimationFrame(tick); }
          else resolve();
        })();
      });
      const avg = Math.max(30, Math.round(10 * Math.log10(energy / frames || 1e-12) + DB_OFFSET));
      state.measuredDb = avg;
      showDb(avg);
      st.textContent = `About ${avg} dB — that's “${LEVELS[dbToScore(avg)].text.toLowerCase()}”. It will be saved with your rating.`;
    } catch {
      st.textContent = "We couldn't use the microphone. That's fine — your answers are enough.";
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close();
      btn.disabled = false;
      btn.innerHTML = `${icon("mic")} Measure again`;
    }
  }
  function showDb(db) {
    $("#meter-db").textContent = db;
    const pct = Math.min(100, Math.max(0, ((db - 40) / 50) * 100));
    const fill = $("#gauge-fill");
    fill.setAttribute("stroke-dasharray", `${pct} 100`);
    fill.style.stroke = `var(--${LEVELS[dbToScore(db)].cls})`;
  }

  // ================================================================ help
  function renderLegend() {
    $("#legend").innerHTML = [4, 3, 2, 1, 0].map((n) =>
      `<li>${qBadge({ level: n })}<p>${esc(LEVELS[n].sub)}</p></li>`).join("")
      + `<li>${qBadge({ level: 4, predicted: true })}<p>Not yet rated by diners — judged from photos and reviews.</p></li>`;
    $$("#rate-form .meter-mini").forEach((el) => { el.outerHTML = `<span class="${LEVELS[el.dataset.level].cls}">${bars(+el.dataset.level)}</span>`; });
  }

  // ================================================================ wiring
  function init() {
    if (DEMO) $("#demo-banner").hidden = false;
    applySettings();
    renderSettings();
    renderSearchControls();
    renderLegend();
    history.replaceState({ screen: "search", tab: "search" }, "", location.search || location.pathname);

    $("#btn-locate").addEventListener("click", useMyLocation);
    $("#place-form").addEventListener("submit", (e) => { e.preventDefault(); searchPlace($("#place-input").value); });
    $("#btn-find").addEventListener("click", runSearch);
    $("#btn-more").addEventListener("click", () => { state.shown += PAGE; renderResults(); });
    $("#rate-form").addEventListener("submit", submitRating);
    $("#btn-measure").addEventListener("click", measure);
    $("#btn-back").addEventListener("click", goBack);

    $$("[data-sort]").forEach((b) => b.addEventListener("click", () => {
      state.sort = b.dataset.sort;
      $$("[data-sort]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      renderResults();
    }));
    $$("[data-view]").forEach((b) => b.addEventListener("click", () => {
      state.view = b.dataset.view;
      $$("[data-view]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      renderResults();
    }));

    document.addEventListener("click", (e) => {
      const t = e.target;
      const saveBtn = t.closest("[data-save]");
      if (saveBtn) { toggleSave(saveBtn.dataset.save, saveBtn); return; }
      const det = t.closest("[data-detail]");
      if (det) { openDetails(det.dataset.detail); return; }
      const rate = t.closest("[data-rate]");
      if (rate) { openRating(rate.dataset.rate); return; }
      const tab = t.closest("[data-tab]");
      if (tab) {
        e.preventDefault();
        const name = tab.dataset.tab;
        if (name === "saved") renderSaved();
        if (name === "search" && state.tab === "search" && state.screen !== "search") { show("search"); return; }
        if (name === "search" && state.places.length && state.screen !== "results" && state.tab !== "search") { show("results"); renderResults(); return; }
        show(name);
        return;
      }
      const go = t.closest("[data-go]");
      if (go) { show(go.dataset.go); return; }
      const open = t.closest("[data-open]");
      if (open) $(`#dlg-${open.dataset.open}`).showModal();
    });
    $("#dlg-settings").addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  init();
})();
