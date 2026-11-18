/* Quiet Table — find restaurants where you can hear each other.
 *
 * Restaurant listings: OpenStreetMap via the Overpass API (free, no key).
 * Town search: OpenStreetMap Nominatim.
 * Quiet ratings: entered by diners. In this version they are stored on the
 * device (see `Store` below). Swap Store for a shared backend so everyone
 * sees everyone's ratings.
 */
(function () {
  "use strict";

  const D = window.QT_DATA;
  const DEMO = new URLSearchParams(location.search).has("demo");
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  const NOMINATIM = "https://nominatim.openstreetmap.org/search";
  const MAX_RESULTS = 600; // cap on what we ask Overpass for
  const CFG = window.QT_CONFIG || {};
  const PAGE = 20;

  // ------------------------------------------------------------------ storage
  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
  }

  /** Ratings store. Replace these two functions with API calls for a shared database. */
  const Store = {
    key: DEMO ? "qt.demoRatings" : "qt.ratings",
    all() { return load(this.key, {}); },
    get(placeId) { return this.all()[placeId] || []; },
    add(placeId, rating) {
      const all = this.all();
      (all[placeId] = all[placeId] || []).push(rating);
      save(this.key, all);
    },
  };

  // ------------------------------------------------------------------ state
  const settings = Object.assign({ text: "l", unit: "km", currency: guessCurrency() }, load("qt.settings", {}));
  const saved = load("qt.search", {});
  const state = {
    loc: null, // { lat, lon, label }
    radius: saved.radius || 5000,
    cuisine: saved.cuisine || "any",
    prices: new Set(saved.prices || []),
    quiet: saved.quiet || "all",
    sort: "quiet",
    places: [],
    shown: PAGE,
    ratingFor: null,
    measuredDb: null,
    predictions: loadPredictionCache(), // id -> verdict from photos & reviews (or null)
    pending: new Set(),
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

  // Verdicts worked out from photos & reviews, remembered on this phone for a week.
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
    const entries = Object.entries(c).sort((a, b) => b[1].t - a[1].t).slice(0, 500);
    save("qt.predictions", Object.fromEntries(entries));
  }

  // ------------------------------------------------------------------ helpers
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
      return mi < 0.1 ? "less than 0.1 miles" : `${+mi.toFixed(mi < 10 ? 1 : 0)} mile${mi === 1 ? "" : "s"}`;
    }
    return m < 1000 ? `${Math.round(m / 10) * 10} metres` : `${+(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
  }
  function radiusOptions() {
    return settings.unit === "mi"
      ? [1, 3, 5, 10, 15].map((n) => ({ m: Math.round(n * MI), label: `${n} mile${n > 1 ? "s" : ""}` }))
      : [1, 2, 5, 10, 20].map((n) => ({ m: n * 1000, label: `${n} km` }));
  }
  function priceLabel(n) { return settings.currency.repeat(n); }
  function priceWords(n) { return ["", "Inexpensive", "Moderate", "Pricey", "Very expensive"][n]; }
  function titleCase(s) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
  function cuisineText(tag, amenity) {
    const parts = (tag || "").split(/[;,]/).map((s) => s.trim()).filter(Boolean).slice(0, 3).map(titleCase);
    if (!parts.length) return amenity === "cafe" ? "Café" : "Restaurant";
    return parts.join(", ") + (amenity === "cafe" ? " café" : "");
  }
  function prettyHours(h) {
    if (!h) return "";
    const days = { Mo: "Mon", Tu: "Tue", We: "Wed", Th: "Thu", Fr: "Fri", Sa: "Sat", Su: "Sun", PH: "Holidays" };
    return h.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (d) => days[d]).replace(/-/g, " – ").replace(/;\s*/g, "; ").replace(/\boff\b/g, "closed");
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
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 4000);
  }

  async function fetchWithTimeout(url, opts = {}, ms = 30000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
    finally { clearTimeout(t); }
  }

  // ------------------------------------------------------------------ quiet score
  /** dB (A-weighted, approx.) -> conversation score on the same 1–4 scale. */
  function dbToScore(db) { return db <= 65 ? 4 : db <= 70 ? 3 : db <= 76 ? 2 : 1; }

  function summarise(ratings) {
    if (!ratings.length) return { level: 0, count: 0 };
    let sum = 0, n = 0, music = { none: 0, soft: 0, loud: 0 }, dbs = [], prices = [], feats = {};
    for (const r of ratings) {
      sum += r.talk; n++;
      if (r.db) { sum += dbToScore(r.db); n++; dbs.push(r.db); }
      if (r.music) music[r.music]++;
      if (r.price) prices.push(r.price);
      for (const f of r.features || []) feats[f] = (feats[f] || 0) + 1;
    }
    const score = sum / n;
    const level = score >= 3.25 ? 4 : score >= 2.5 ? 3 : score >= 1.75 ? 2 : 1;
    prices.sort((a, b) => a - b);
    const price = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
    const db = dbs.length ? Math.round(dbs.reduce((a, b) => a + b, 0) / dbs.length) : null;
    const loudMusic = music.loud > (music.none + music.soft) / 2 && music.loud > 0;
    const topFeatures = Object.entries(feats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => D.features.find((f) => f.id === id)).filter(Boolean);
    const latest = Math.max(...ratings.map((r) => r.t || 0));
    return { level, score, count: ratings.length, price, db, loudMusic, topFeatures, latest };
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
    4: { cls: "q4", text: "Quiet", sub: "Easy to talk" },
    3: { cls: "q3", text: "Fairly quiet", sub: "Talking takes a little effort" },
    2: { cls: "q2", text: "Noisy", sub: "You may need to raise your voice" },
    1: { cls: "q1", text: "Very noisy", sub: "Hard to hear each other" },
    0: { cls: "q0", text: "Not rated yet", sub: "" },
  };

  // ------------------------------------------------------------------ screens
  function show(name) {
    for (const s of $$(".screen")) s.hidden = s.id !== `screen-${name}`;
    window.scrollTo(0, 0);
    const h = $(`#screen-${name} h2`);
    if (h) h.focus({ preventScroll: true });
    if (history.state?.screen !== name) history.pushState({ screen: name }, "", location.search || location.pathname);
  }
  window.addEventListener("popstate", (e) => {
    const name = e.state?.screen || "search";
    for (const s of $$(".screen")) s.hidden = s.id !== `screen-${name}`;
  });

  // ------------------------------------------------------------------ settings UI
  function applySettings() {
    document.documentElement.dataset.text = settings.text;
    save("qt.settings", settings);
  }
  function pillRadio(container, options, current, onPick) {
    container.innerHTML = "";
    for (const o of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pill";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(o.value === current));
      b.textContent = o.label;
      b.addEventListener("click", () => {
        $$(".pill", container).forEach((x) => x.setAttribute("aria-checked", "false"));
        b.setAttribute("aria-checked", "true");
        onPick(o.value);
      });
      container.appendChild(b);
    }
  }
  function renderSettings() {
    pillRadio($("#textsize-buttons"), [
      { value: "l", label: "Large" }, { value: "xl", label: "Larger" }, { value: "xxl", label: "Largest" },
    ], settings.text, (v) => { settings.text = v; applySettings(); });
    pillRadio($("#unit-buttons"), [
      { value: "km", label: "Kilometres" }, { value: "mi", label: "Miles" },
    ], settings.unit, (v) => {
      settings.unit = v; applySettings();
      // snap radius to the nearest option in the new unit
      const opts = radiusOptions();
      state.radius = opts.reduce((best, o) => Math.abs(o.m - state.radius) < Math.abs(best.m - state.radius) ? o : best).m;
      persistSearch(); renderSearchControls();
      if (state.places.length) renderResults();
    });
    pillRadio($("#currency-buttons"), ["$", "£", "€"].map((c) => ({ value: c, label: c })), settings.currency, (v) => {
      settings.currency = v; applySettings(); renderSearchControls();
      if (state.places.length) renderResults();
    });
  }

  // ------------------------------------------------------------------ search UI
  function renderSearchControls() {
    pillRadio($("#radius-buttons"), radiusOptions().map((o) => ({ value: o.m, label: o.label })), state.radius, (v) => { state.radius = v; persistSearch(); });

    const sel = $("#cuisine");
    sel.innerHTML = D.cuisines.map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join("");
    sel.value = state.cuisine;

    const pc = $("#price-buttons");
    pc.innerHTML = "";
    for (let n = 1; n <= 4; n++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pill";
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

    pillRadio($("#quiet-buttons"), [
      { value: "all", label: "Show everything, quietest at the top" },
      { value: "notnoisy", label: "Hide noisy places" },
      { value: "quiet", label: "Only quiet places" },
    ], state.quiet, (v) => { state.quiet = v; persistSearch(); });
  }

  function setLocation(loc) {
    state.loc = loc;
    const st = $("#location-status");
    st.className = "status ok";
    st.textContent = `✓ Searching near: ${loc.label}`;
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
    if (DEMO) { setLocation({ lat: 51.5, lon: -0.12, label: "Demo town centre" }); return; }
    if (!navigator.geolocation) { locationError("Your device can't share its location. Please type a town instead."); return; }
    const st = $("#location-status");
    st.className = "status";
    st.textContent = "Finding where you are…";
    navigator.geolocation.getCurrentPosition(
      (p) => setLocation({ lat: p.coords.latitude, lon: p.coords.longitude, label: "your current location" }),
      (err) => locationError(err.code === 1
        ? "Location permission was turned off. You can type a town instead, or allow location in your phone's settings."
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
      st.textContent = "Which one did you mean?";
      const ul = $("#place-choices");
      ul.innerHTML = "";
      for (const h of hits) {
        const li = document.createElement("li");
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = h.display_name;
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

  // ------------------------------------------------------------------ fetching places
  function buildQuery({ lat, lon }, radius, cuisineId) {
    const c = D.cuisines.find((x) => x.id === cuisineId) || D.cuisines[0];
    const around = `(around:${Math.round(radius)},${lat.toFixed(6)},${lon.toFixed(6)})`;
    const amenities = c.amenity ? [c.amenity] : ["restaurant", "cafe"];
    const clauses = [];
    for (const a of amenities) {
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
        return json.elements.map((el) => fromOsm(el, loc)).filter(Boolean);
      } catch (e) { lastErr = e; }
    }
    throw lastErr;
  }

  function fromOsm(el, origin) {
    const t = el.tags || {};
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
    if (lat == null || !t.name) return null;
    const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
    const addr = [street, t["addr:city"] || t["addr:suburb"] || t["addr:place"]].filter(Boolean).join(", ");
    return {
      id: `${el.type}/${el.id}`,
      name: t.name,
      amenity: t.amenity,
      cuisine: t.cuisine || "",
      lat, lon,
      dist: distanceM(origin, { lat, lon }),
      addr,
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
    // Seed demo ratings once.
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
          dist: distanceM(loc, { lat, lon }), addr: d.addr, phone: d.phone || "", website: "", hours: d.hours || "",
          wheelchair: d.wheelchair || "", liveMusic: !!d.liveMusic, demoPredict: d.predict || null };
      }).filter((p) => p.dist <= radius
        && (c.id === "any" || (c.amenity ? p.amenity === c.amenity : re.test(p.cuisine))))
    ), 500));
  }

  // ------------------------------------------------------------------ results
  async function runSearch() {
    if (!state.loc) return;
    state.cuisine = $("#cuisine").value;
    persistSearch();
    show("results");
    $("#results-list").innerHTML = "";
    $("#btn-more").hidden = true;
    $("#results-summary").textContent = "";
    $("#results-loading").hidden = false;
    try {
      const places = await fetchPlaces(state.loc, state.radius, state.cuisine);
      state.places = places.filter((p) => p.dist <= state.radius && !p.takeawayOnly);
      state.shown = PAGE;
      renderResults();
    } catch {
      $("#results-list").innerHTML = `<li class="empty"><h3>We couldn't load restaurants just now</h3>
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
    else list.sort((a, b) => {
      // Rated quiet first (best score first), then unrated, then noisy; ties by distance.
      const rank = (p) => (p.q.level === 0 ? 2.4 : p.q.score);
      return rank(b) - rank(a) || a.dist - b.dist;
    });
    return list;
  }

  function renderResults() {
    const list = filteredSorted();
    const ul = $("#results-list");
    const rated = list.filter((p) => p.q.count).length;
    const likely = list.filter((p) => p.q.predicted).length;
    const checking = list.slice(0, state.shown).some((p) => p.q.pending);
    const area = `within ${fmtDistance(state.radius).replace(/^less than /, "")}`;
    const cuisine = D.cuisines.find((c) => c.id === state.cuisine);
    $("#results-title").textContent = state.cuisine === "any" ? "Restaurants near you" : `${cuisine.label} near you`;
    $("#results-summary").textContent = list.length
      ? `${list.length} place${list.length > 1 ? "s" : ""} ${area}. `
        + (rated ? `${rated} rated by diners. ` : "")
        + (likely ? `${likely} judged from photos and reviews. ` : "")
        + (checking ? "Checking photos and reviews for the rest…" : (!rated && !likely ? "None have been rated for noise yet – you could be the first!" : ""))
      : "";

    if (!list.length) {
      const why = state.places.length
        ? "Some places were hidden by your quiet or price choices."
        : "There may be no listed restaurants of this kind nearby.";
      ul.innerHTML = `<li class="empty"><h3>No places found ${esc(area)}</h3><p>${why} Try a bigger distance or “Any kind of food”.</p>
        <button type="button" class="btn btn-primary" data-go="search">Change my search</button></li>`;
      $("#btn-more").hidden = true;
      return;
    }
    ul.innerHTML = list.slice(0, state.shown).map(cardHtml).join("");
    $("#btn-more").hidden = list.length <= state.shown;
    $("#btn-more").textContent = `Show more (${list.length - state.shown} left)`;
    loadPredictions(list.slice(0, state.shown));
  }

  // Ask the analysis server about places that have no diner ratings yet.
  async function loadPredictions(shown) {
    const todo = shown.filter((p) => !p.q.count && !(p.id in state.predictions) && !state.pending.has(p.id));
    if (!todo.length) return;
    if (DEMO) {
      todo.forEach((p) => state.pending.add(p.id));
      renderResults();
      await new Promise((r) => setTimeout(r, 1200));
      todo.forEach((p) => { state.pending.delete(p.id); state.predictions[p.id] = p.demoPredict; });
      renderResults();
      return;
    }
    if (!CFG.analysisUrl) return;
    todo.forEach((p) => state.pending.add(p.id));
    renderResults();
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
    if (!$("#screen-results").hidden) renderResults();
  }

  function cardHtml(p) {
    const L = LEVELS[p.q.level];
    const facts = [];
    if (p.addr) facts.push(`<li>📍 ${esc(p.addr)}</li>`);
    if (p.hours) facts.push(`<li>🕑 ${esc(prettyHours(p.hours))}</li>`);
    if (p.wheelchair === "yes") facts.push("<li>♿ Wheelchair accessible</li>");
    else if (p.wheelchair === "limited") facts.push("<li>♿ Limited wheelchair access</li>");
    if (p.q.db) facts.push(`<li>🎤 Measured about ${p.q.db} dB on average</li>`);
    if (p.q.loudMusic) facts.push(`<li class="warn">🔊 Diners say the music is loud</li>`);
    if (p.liveMusic || p.q.liveMusic) facts.push(`<li class="warn">🎸 Has live music at times</li>`);
    if (p.sportsTv || p.q.sportsTv) facts.push(`<li class="warn">📺 May show sport on TV</li>`);
    if (p.q.quieterTimes) facts.push(`<li>🕰️ Quieter times: ${esc(p.q.quieterTimes)}</li>`);
    if (p.q.topFeatures?.length) facts.push(`<li>💬 Diners mention: ${p.q.topFeatures.map((f) => esc(f.label.toLowerCase())).join("; ")}</li>`);

    const price = p.q.price ? `<strong>${priceLabel(p.q.price)}</strong> ${priceWords(p.q.price).toLowerCase()}` : "price not known yet";
    const dir = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
    let badge, note = "", why = "";
    if (p.q.count) {
      badge = `<span class="badge ${L.cls}">${L.text}</span><span class="count">${p.q.count} diner rating${p.q.count > 1 ? "s" : ""} · last rated ${timeAgo(p.q.latest)}</span>`;
      note = L.sub;
    } else if (p.q.predicted) {
      badge = `<span class="badge predicted ${L.cls}">Likely ${L.text.toLowerCase()}</span><span class="count">from photos & reviews${p.q.confidence === "low" ? " · rough guess" : ""}</span>`;
      note = L.sub;
      if (p.q.reasons?.length) why = `<ul class="why">${p.q.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>`;
    } else if (p.q.pending) {
      badge = `<span class="badge checking">Checking…</span><span class="count">looking at photos & reviews</span>`;
    } else {
      badge = `<span class="badge ${L.cls}">${L.text}</span>`;
    }
    return `<li class="place">
      <div class="badge-row">${badge}</div>
      <h3>${esc(p.name)}</h3>
      <p class="meta"><strong>${esc(fmtDistance(p.dist))} away</strong> · ${esc(cuisineText(p.cuisine, p.amenity))} · ${price}</p>
      ${note ? `<p class="meta">${note}</p>` : ""}
      ${why}
      ${facts.length ? `<ul class="facts">${facts.join("")}</ul>` : ""}
      <div class="actions">
        <a class="btn btn-secondary" href="${dir}" target="_blank" rel="noopener">🧭 Directions</a>
        ${p.phone ? `<a class="btn btn-secondary" href="tel:${esc(p.phone.split(";")[0].replace(/[^\d+]/g, ""))}">📞 Call</a>` : ""}
        ${p.website ? `<a class="btn btn-secondary" href="${esc(/^https?:/i.test(p.website) ? p.website : "https://" + p.website)}" target="_blank" rel="noopener">🌐 Website</a>` : ""}
        <button type="button" class="btn btn-primary" data-rate="${esc(p.id)}">✍️ Rate the noise</button>
      </div>
    </li>`;
  }

  // ------------------------------------------------------------------ rating
  function openRating(id) {
    const p = state.places.find((x) => x.id === id);
    if (!p) return;
    state.ratingFor = p;
    state.measuredDb = null;
    $("#rate-form").reset();
    $("#rate-place").textContent = `${p.name} · ${fmtDistance(p.dist)} away`;
    $("#meter-db").textContent = "--";
    $("#meter-fill").style.width = "0";
    $("#meter-status").textContent = "";
    $("#feature-checks").innerHTML = D.features.map((f) =>
      `<label class="choice"><input type="checkbox" name="feat" value="${f.id}" /> <span>${f.good ? "👍" : "👎"} ${esc(f.label)}</span></label>`).join("");
    $("#rate-price").innerHTML = [1, 2, 3, 4].map((n) =>
      `<label class="choice"><input type="radio" name="price" value="${n}" /> <span aria-label="${priceWords(n)}">${priceLabel(n)}</span></label>`).join("");
    show("rate");
  }

  function submitRating(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const talk = Number(f.get("talk"));
    if (!talk) { toast("Please answer the first question."); return; }
    Store.add(state.ratingFor.id, {
      talk,
      music: f.get("music") || null,
      features: f.getAll("feat"),
      price: Number(f.get("price")) || null,
      db: state.measuredDb,
      t: Date.now(),
    });
    toast("Thank you! Your rating has been saved.");
    show("results");
    renderResults();
  }

  // Sound level meter. Phones aren't calibrated, so this is an estimate.
  const DB_OFFSET = 94; // dBFS -> rough dB SPL for a typical phone microphone
  async function measure() {
    const btn = $("#btn-measure"), st = $("#meter-status");
    if (!navigator.mediaDevices?.getUserMedia) { st.textContent = "Your device or browser can't measure sound."; return; }
    btn.disabled = true;
    st.textContent = "Please allow the microphone when asked…";
    let stream, ctx;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      let energy = 0, frames = 0;
      const end = performance.now() + 10000;
      st.textContent = "Listening… hold your phone at the table.";
      await new Promise((resolve) => {
        (function tick() {
          an.getFloatTimeDomainData(buf);
          let s = 0;
          for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
          const ms = s / buf.length;
          energy += ms; frames++;
          const db = Math.max(30, Math.round(10 * Math.log10(ms || 1e-12) + DB_OFFSET));
          showDb(db);
          const left = Math.ceil((end - performance.now()) / 1000);
          if (left > 0) { st.textContent = `Listening… ${left} second${left > 1 ? "s" : ""} left`; requestAnimationFrame(tick); }
          else resolve();
        })();
      });
      const avg = Math.max(30, Math.round(10 * Math.log10(energy / frames || 1e-12) + DB_OFFSET));
      state.measuredDb = avg;
      showDb(avg);
      const L = LEVELS[dbToScore(avg)];
      st.textContent = `About ${avg} dB – that's “${L.text.toLowerCase()}”. This will be saved with your rating.`;
    } catch {
      st.textContent = "We couldn't use the microphone. That's fine – your answers above are enough.";
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close();
      btn.disabled = false;
      btn.textContent = "🎤 Measure again";
    }
  }
  function showDb(db) {
    $("#meter-db").textContent = db;
    const fill = $("#meter-fill");
    fill.style.width = `${Math.min(100, Math.max(0, (db - 40) / 50 * 100))}%`;
    fill.style.background = `var(--${LEVELS[dbToScore(db)].cls})`;
  }

  // ------------------------------------------------------------------ wiring
  function init() {
    if (DEMO) $("#demo-banner").hidden = false;
    applySettings();
    renderSettings();
    renderSearchControls();
    history.replaceState({ screen: "search" }, "", location.search || location.pathname);

    $("#btn-locate").addEventListener("click", useMyLocation);
    $("#place-form").addEventListener("submit", (e) => { e.preventDefault(); searchPlace($("#place-input").value); });
    $("#cuisine").addEventListener("change", (e) => { state.cuisine = e.target.value; persistSearch(); });
    $("#btn-find").addEventListener("click", runSearch);
    $("#btn-more").addEventListener("click", () => { state.shown += PAGE; renderResults(); });
    $("#rate-form").addEventListener("submit", submitRating);
    $("#btn-measure").addEventListener("click", measure);

    $$("[data-sort]").forEach((b) => b.addEventListener("click", () => {
      state.sort = b.dataset.sort;
      $$("[data-sort]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      renderResults();
    }));

    document.addEventListener("click", (e) => {
      const go = e.target.closest("[data-go]");
      if (go) { show(go.dataset.go); return; }
      const rate = e.target.closest("[data-rate]");
      if (rate) { openRating(rate.dataset.rate); return; }
      const open = e.target.closest("[data-open]");
      if (open) $(`#dlg-${open.dataset.open}`).showModal();
    });

    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  init();
})();
