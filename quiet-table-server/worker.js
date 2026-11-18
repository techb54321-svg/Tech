/* Quiet Table analysis server (Cloudflare Worker).
 *
 * The app sends a few restaurants (name + location). For each one we:
 *   1. find it on Google Places and read its details, reviews and interior photos;
 *   2. ask Claude to judge from the photos (floors, ceilings, soft furnishings,
 *      acoustic panels, how packed the tables are) and the reviews how easy it is
 *      to hold a conversation there;
 *   3. send back a short verdict with reasons, and cache it.
 *
 * Secrets (set with `wrangler secret put` or the GitHub Action):
 *   GOOGLE_MAPS_KEY, ANTHROPIC_API_KEY
 * Plain variables (wrangler.toml): ALLOWED_ORIGINS, MAX_PLACES_PER_REQUEST, CACHE_DAYS
 */
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";
const PLACES = "https://places.googleapis.com/v1";
const PHOTOS_PER_PLACE = 4;
const MATCH_RADIUS_M = 150;
const CACHE_VERSION = "v1";

const FIELDS = [
  "places.id", "places.displayName", "places.location", "places.priceLevel",
  "places.liveMusic", "places.goodForWatchingSports", "places.reservable",
  "places.servesCocktails", "places.goodForGroups", "places.goodForChildren",
  "places.reviews", "places.reviewSummary", "places.photos",
].join(",");

const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    level: { type: "string", enum: ["quiet", "fairly_quiet", "noisy", "very_noisy", "unknown"] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    reasons: { type: "array", items: { type: "string" } },
    quieter_times: { type: "string" },
  },
  required: ["level", "confidence", "reasons", "quieter_times"],
  additionalProperties: false,
};

const SYSTEM = `You assess how easy it is to hold a conversation in a restaurant, for older diners who want to talk without raising their voices. Background music is fine if it is soft.

Judge mainly from the interior photos and the reviews:
- Quieter: carpet or rugs, tablecloths, upholstered seating or booths, curtains, acoustic panels or baffles on ceilings or walls, low or treated ceilings, small rooms, tables spaced apart, a calm formal or cosy style.
- Louder: hard floors (tile, concrete, wood) with bare walls, high exposed ceilings, lots of glass, bare tables, tightly packed tables, a large bar, an open kitchen, TVs, a party or nightlife feel.
- Reviews that mention noise ("couldn't hear", "deafening", "quiet", "could talk", "intimate") outweigh what the photos suggest.
- Google attributes: live music or sports viewing point to noise; taking reservations leans calmer.

Photos may show only food or the outside; ignore those. If there is too little evidence, use level "unknown". Use "high" confidence only when reviews mention noise directly or the photos clearly show the dining room.
Write 1-3 reasons in plain, friendly English, each under 15 words, naming what you saw or read (e.g. "Carpeted dining room with upholstered booths"). Do not quote reviews word for word.
quieter_times: a short tip such as "Weekday lunchtimes" if reviews suggest it, otherwise an empty string.`;

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true, configured: !!(env.GOOGLE_MAPS_KEY && env.ANTHROPIC_API_KEY) }, 200, cors);
    if (url.pathname !== "/analyze" || request.method !== "POST") return json({ error: "not_found" }, 404, cors);
    if (!cors["Access-Control-Allow-Origin"]) return json({ error: "origin_not_allowed" }, 403, cors);
    if (!env.GOOGLE_MAPS_KEY || !env.ANTHROPIC_API_KEY) return json({ error: "not_configured" }, 503, cors);

    let body;
    try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400, cors); }
    const max = Number(env.MAX_PLACES_PER_REQUEST || 10);
    const places = (Array.isArray(body?.places) ? body.places : []).slice(0, max).filter(validPlace);

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const results = {};
    await Promise.all(places.map(async (p) => {
      try { results[p.id] = await analyse(p, env, ctx, client); }
      catch (e) { console.error("analyse failed", p.id, e?.message || e); results[p.id] = null; }
    }));
    return json({ results }, 200, cors);
  },
};

function validPlace(p) {
  return p && typeof p.id === "string" && p.id.length < 64 && typeof p.name === "string" && p.name.length < 200
    && Number.isFinite(p.lat) && Number.isFinite(p.lon);
}

async function analyse(place, env, ctx, client) {
  const cache = caches.default;
  const key = new Request(`https://cache.quiet-table/${CACHE_VERSION}/${encodeURIComponent(place.id)}`);
  const hit = await cache.match(key);
  if (hit) return hit.json();

  const g = await findOnGoogle(place, env);
  let result;
  if (!g) {
    result = { level: "unknown", confidence: "low", reasons: [], quieter_times: "", price: 0, source: "none" };
  } else {
    const photoUrls = await photoUris(g.photos || [], env);
    const verdict = await askClaude(place, g, photoUrls, client);
    result = {
      ...verdict,
      price: priceNumber(g.priceLevel),
      liveMusic: g.liveMusic === true,
      sportsTv: g.goodForWatchingSports === true,
      source: "google",
    };
  }
  const days = Number(env.CACHE_DAYS || 30);
  ctx.waitUntil(cache.put(key, new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${days * 86400}` },
  })));
  return result;
}

async function findOnGoogle(place, env) {
  const res = await fetch(`${PLACES}/places:searchText`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": env.GOOGLE_MAPS_KEY, "X-Goog-FieldMask": FIELDS },
    body: JSON.stringify({
      textQuery: place.name,
      maxResultCount: 3,
      locationBias: { circle: { center: { latitude: place.lat, longitude: place.lon }, radius: MATCH_RADIUS_M } },
    }),
  });
  if (!res.ok) throw new Error(`places search ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const near = (data.places || [])
    .map((g) => ({ g, d: distanceM(place, { lat: g.location?.latitude, lon: g.location?.longitude }) }))
    .filter((x) => x.d <= MATCH_RADIUS_M)
    .sort((a, b) => a.d - b.d);
  return near[0]?.g || null;
}

async function photoUris(photos, env) {
  const picks = photos.slice(0, PHOTOS_PER_PLACE);
  const uris = await Promise.all(picks.map(async (ph) => {
    try {
      const r = await fetch(`${PLACES}/${ph.name}/media?maxWidthPx=800&skipHttpRedirect=true`, {
        headers: { "X-Goog-Api-Key": env.GOOGLE_MAPS_KEY },
      });
      if (!r.ok) return null;
      return (await r.json()).photoUri || null;
    } catch { return null; }
  }));
  return uris.filter(Boolean);
}

async function askClaude(place, g, photoUrls, client) {
  const reviews = (g.reviews || [])
    .map((r) => r.text?.text || r.originalText?.text || "")
    .filter(Boolean)
    .map((t) => `- ${t.slice(0, 1200)}`)
    .join("\n");
  const attrs = {
    live_music: g.liveMusic, good_for_watching_sports: g.goodForWatchingSports, takes_reservations: g.reservable,
    serves_cocktails: g.servesCocktails, good_for_groups: g.goodForGroups, good_for_children: g.goodForChildren,
    price_level: g.priceLevel,
  };
  const text = `Restaurant: ${place.name}
Google attributes: ${JSON.stringify(attrs)}
Google review summary: ${g.reviewSummary?.text?.text || "(none)"}
Recent reviews:
${reviews || "(none)"}

${photoUrls.length ? `The ${photoUrls.length} images above are photos of this place from Google.` : "No photos are available."}
How easy is it to hold a conversation here?`;

  const content = [
    ...photoUrls.map((url) => ({ type: "image", source: { type: "url", url } })),
    { type: "text", text },
  ];

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "low", format: { type: "json_schema", schema: VERDICT_SCHEMA } },
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
    return { level: "unknown", confidence: "low", reasons: [], quieter_times: "" };
  }
  const out = response.content.find((b) => b.type === "text");
  const v = JSON.parse(out.text);
  v.reasons = (v.reasons || []).slice(0, 3);
  return v;
}

function priceNumber(level) {
  return { PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 }[level] || 0;
}

function distanceM(a, b) {
  if (!Number.isFinite(b.lat) || !Number.isFinite(b.lon)) return Infinity;
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  return ok ? {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  } : { "Vary": "Origin" };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });
}
