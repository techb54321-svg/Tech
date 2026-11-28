// Wish Map server for Dog Friendly Victoria.
//
// Keeps one thing: which anonymous device has wished for which venue. Venues are
// OpenStreetMap ids; names and locations stay in the app, so nobody can attach
// made-up details to a business here. No names, emails or raw IP addresses are stored.
//
//   GET  /counts          -> { counts: { "osm/node/123": 4, ... }, wishes, venues }
//   POST /wish            -> body { venue, device, on }  ->  { venue, count, on }
//   GET  /                -> health check

import { DurableObject } from 'cloudflare:workers';

const VENUE = /^osm\/(node|way|relation)\/\d{1,12}$/;
const DEVICE = /^[a-z0-9-]{16,40}$/;
const MAX_WRITES_PER_ADDRESS_PER_DAY = 120;
const MAX_WISHES_PER_DEVICE = 300;

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const headers = { Vary: 'Origin' };
  if (allowed.includes(origin) || local) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (url.pathname === '/') return json({ ok: true, service: 'dfv-wishes' }, 200, cors);
    if (!(url.pathname === '/counts' && request.method === 'GET') && !(url.pathname === '/wish' && request.method === 'POST')) {
      return json({ error: 'not_found' }, 404, cors);
    }
    let body = '';
    if (request.method === 'POST') {
      body = await request.text();
      if (body.length > 2000) return json({ error: 'too_large' }, 413, cors);
    }
    const book = env.BOOK.get(env.BOOK.idFromName('victoria'));
    const inner = await book.fetch('https://book' + url.pathname, {
      method: request.method,
      body: body || undefined,
      headers: { 'x-address': request.headers.get('CF-Connecting-IP') || 'unknown' },
    });
    return new Response(inner.body, { status: inner.status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors } });
  },
};

export class WishBook extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS wish (venue TEXT NOT NULL, device TEXT NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY (venue, device));
      CREATE INDEX IF NOT EXISTS wish_device ON wish (device);
      CREATE TABLE IF NOT EXISTS hits (address TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (address, day));
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    `);
    const row = this.sql.exec("SELECT v FROM meta WHERE k = 'salt'").toArray()[0];
    this.salt = row ? row.v : crypto.randomUUID();
    if (!row) this.sql.exec("INSERT INTO meta (k, v) VALUES ('salt', ?)", this.salt);
    this.cache = null;
  }

  counts() {
    if (this.cache) return this.cache;
    const counts = {};
    let wishes = 0;
    for (const r of this.sql.exec('SELECT venue, COUNT(*) AS n FROM wish GROUP BY venue ORDER BY n DESC LIMIT 20000')) {
      counts[r.venue] = r.n;
      wishes += r.n;
    }
    this.cache = { counts, wishes, venues: Object.keys(counts).length };
    return this.cache;
  }

  // Addresses are only ever kept as a salted hash that changes each day.
  async addressKey(address, day) {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(this.salt + '|' + day + '|' + address)));
    return Array.from(bytes.slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/counts') return json(this.counts());

    let data;
    try { data = JSON.parse(await request.text()); } catch (e) { return json({ error: 'bad_json' }, 400); }
    const venue = data && data.venue, device = data && data.device, on = !!(data && data.on);
    if (typeof venue !== 'string' || !VENUE.test(venue) || typeof device !== 'string' || !DEVICE.test(device)) return json({ error: 'bad_request' }, 400);

    const day = new Date().toISOString().slice(0, 10);
    const address = await this.addressKey(request.headers.get('x-address') || 'unknown', day);
    const used = this.sql.exec('SELECT n FROM hits WHERE address = ? AND day = ?', address, day).toArray()[0];
    if (used && used.n >= MAX_WRITES_PER_ADDRESS_PER_DAY) return json({ error: 'slow_down' }, 429);
    this.sql.exec('INSERT INTO hits (address, day, n) VALUES (?, ?, 1) ON CONFLICT (address, day) DO UPDATE SET n = n + 1', address, day);
    if (Math.random() < 0.02) this.sql.exec('DELETE FROM hits WHERE day <> ?', day);

    if (on) {
      const mine = this.sql.exec('SELECT COUNT(*) AS n FROM wish WHERE device = ?', device).toArray()[0].n;
      if (mine >= MAX_WISHES_PER_DEVICE) return json({ error: 'too_many' }, 429);
      this.sql.exec('INSERT OR IGNORE INTO wish (venue, device, ts) VALUES (?, ?, ?)', venue, device, Date.now());
    } else {
      this.sql.exec('DELETE FROM wish WHERE venue = ? AND device = ?', venue, device);
    }
    this.cache = null;
    const count = this.sql.exec('SELECT COUNT(*) AS n FROM wish WHERE venue = ?', venue).toArray()[0].n;
    return json({ venue, count, on });
  }
}
