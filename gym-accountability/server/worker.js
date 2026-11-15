// Ironclad server — one free Cloudflare Worker.
//
// What it does
//  • Receives events from your Ironclad app (check-ins, check-outs, verdicts…).
//  • Hosts your referee's own Ironclad app at /r/<invite-token>/, which they add
//    to their home screen to get real notifications and a live view of your week.
//  • Sends those notifications with standard Web Push (no third-party service).
//  • Once an hour (cron), sends the weekly verdict on schedule, even if your
//    phone never opened the app that week.
//
// Setup (see the guide in this folder): paste this file into a Worker, bind a
// KV namespace as STATE, add the cron trigger "0 * * * *", open the Worker's
// address once and copy the connection code into the app. Keys are generated
// automatically on first use and stored in KV.
//
// Optional: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM also send the
// weekly verdict as a text message. APP_SECRET overrides the generated key.

const APP_URL = 'https://techb54321-svg.github.io/Tech/gym-accountability/'; // where the Ironclad app lives
const DAY = 86400000;
const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
const page = (s, status = 200) => new Response(s, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
const PUSH_EVENTS = new Set(['checkin', 'checkout', 'attempt', 'week', 'freeze', 'config', 'paid', 'deposit', 'status', 'tamper']);

export default {
  async fetch(request, env) {
    try { return await route(request, env); }
    catch (e) { return json({ error: e.message || String(e) }, 500); }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      if (env.STATE) await env.STATE.put('lastCron', String(Date.now()));
      await runWeekly(env, new Date(event.scheduledTime || Date.now()));
    })());
  },
};

async function route(request, env) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const m = url.pathname.match(/^\/r\/([a-z0-9]{10,40})(\/.*)?$/);
  if (m) return refereeRoute(request, env, url, m[1], m[2] || '');
  if (request.method === 'GET' && url.pathname === '/') return statusPage(env, url);
  if (request.method !== 'POST') return json({ error: 'not found' }, 404);
  if (!env.STATE) return json({ error: 'The server has no storage yet. Add a KV binding called STATE (see the guide).' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }

  if (url.pathname === '/agree') return agree(env, body.token, body.name); // legacy referee page

  const secret = await getSecret(env);
  if (!secret) return json({ error: 'Open the server page once to create your connection code.' }, 500);
  if (body.secret !== secret) return json({ error: 'That connection code is wrong. Copy it again from your server page.' }, 401);
  await markClaimed(env);

  const st = await getState(env);
  st.origin = url.origin;

  if (url.pathname === '/event') {
    const photoId = body.photo ? await savePhoto(env, body.photo) : null;
    recordEvent(st, body, photoId);
    let delivered = 0, sent = null;
    const via = body.via || 'sms';
    if (body.event === 'referee' && body.data?.agreed && !st.agreedAt) {
      st.agreedAt = Number(body.ts) || Date.now(); st.agreedBy = st.cfg?.refereeName || ''; st.agreedHow = String(body.data.how || 'confirmed by the user').slice(0, 80);
      if (via !== 'ironclad' && hasTwilio(env)) { try { sent = await sendSMS(env, st.cfg?.refereePhone, welcomeText(st.cfg)); } catch (e) { st.welcomeError = e.message; } }
    }
    if (via === 'ironclad') {
      if (body.event === 'test') delivered = await pushAll(env, st, testPayload(st));
      else if (st.agreedAt && PUSH_EVENTS.has(body.event)) {
        delivered = await pushAll(env, st, eventPayload(st, body, photoId), body.urgent ? 'high' : 'normal');
        if (body.event === 'week' && body.data?.week) (st.pushedWeeks ||= {})[body.data.week] = true;
      }
    } else {
      if (body.event === 'test') sent = await sendSMS(env, st.cfg?.refereePhone, testText(st.cfg));
      if (body.event === 'tamper' && st.agreedAt && hasTwilio(env)) sent = await sendSMS(env, st.cfg.refereePhone, `Ironclad alert: ${st.cfg.name}'s gym log has been edited outside the app. Treat the record as untrustworthy and ask ${st.cfg.name} about it.`);
    }
    await putState(env, st);
    return json({ ok: true, delivered, subscribers: st.subs.length, sent, agreedAt: st.agreedAt || null });
  }
  if (url.pathname === '/invite') {
    if (body.state && typeof body.state === 'object') st.cfg = { ...(st.cfg || {}), ...body.state };
    if (!st.inviteToken) st.inviteToken = randomToken();
    await putState(env, st);
    return json({ ok: true, token: st.inviteToken, link: `${url.origin}/r/${st.inviteToken}/`, agreedAt: st.agreedAt || null, subscribers: st.subs.length });
  }
  if (url.pathname === '/state') {
    await putState(env, st);
    return json({ ok: true, agreedAt: st.agreedAt || null, agreedBy: st.agreedBy || null, agreedHow: st.agreedHow || null, subscribers: st.subs.length, lastSentWeek: st.lastSentWeek || null, lastReport: st.lastReport || null });
  }
  if (url.pathname === '/summary') {
    if (!st.cfg) return json({ error: 'no data from the app yet' }, 400);
    const now = new Date(), wk = prevWeek(weekKeyOf(localParts(now, st.cfg.tz), st.cfg.weekStart ?? 1));
    return json({ ok: true, week: wk, text: summaryText(st, wk, now) });
  }
  return json({ error: 'not found' }, 404);
}

/* ---------------- secret (connection code) ---------------- */
async function getSecret(env) { return env.APP_SECRET || await env.STATE.get('secret'); }
async function ensureSecret(env) {
  let s = await getSecret(env);
  if (!s) { s = randomToken(32); await env.STATE.put('secret', s); }
  return s;
}
async function markClaimed(env) { if (!env.APP_SECRET && !(await env.STATE.get('claimed'))) await env.STATE.put('claimed', String(Date.now())); }

/* ---------------- state ---------------- */
async function getState(env) {
  const raw = await env.STATE.get('state');
  const st = raw ? JSON.parse(raw) : {};
  st.cfg = st.cfg || null; st.sessions = st.sessions || []; st.weeks = st.weeks || {}; st.freezes = st.freezes || {};
  st.events = st.events || []; st.sent = st.sent || []; st.subs = st.subs || [];
  return st;
}
async function putState(env, st) {
  st.sessions = st.sessions.slice(-400); st.events = st.events.slice(-200); st.sent = st.sent.slice(-60); st.subs = st.subs.slice(-10);
  await env.STATE.put('state', JSON.stringify(st));
}
function recordEvent(st, body, photoId) {
  const ts = Number(body.ts) || Date.now();
  if (body.state && typeof body.state === 'object') st.cfg = { ...(st.cfg || {}), ...body.state };
  st.lastReport = ts;
  if (!['test', 'signed', 'referee'].includes(body.event)) st.events.push({ ts, event: body.event, text: cleanText(body.text).slice(0, 300), photo: photoId || undefined, ok: body.data?.valid });
  const d = body.data || {};
  if (body.event === 'checkout' && d.day && d.week) st.sessions.push({ ts, day: d.day, week: d.week, valid: !!d.valid, verified: !!d.verified, minutes: Number(d.minutes) || 0 });
  if (body.event === 'week' && d.week) st.weeks[d.week] = { done: Number(d.done) || 0, target: Number(d.target) || 0, result: d.result, owed: Number(d.owed) || 0 };
  if (body.event === 'freeze' && d.week) st.freezes[d.week] = String(d.reason || '').slice(0, 120);
}
const cleanText = t => String(t || '').replace(/^\p{Extended_Pictographic}️?\s*/u, '');

async function savePhoto(env, dataUrl) {
  const mm = String(dataUrl).match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!mm || mm[2].length > 400000) return null;
  const bin = atob(mm[2]), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const id = randomToken(14);
  await env.STATE.put('photo:' + id, bytes, { expirationTtl: 60 * 86400, metadata: { type: mm[1] } });
  return id;
}

/* ---------------- referee agreement ---------------- */
async function agree(env, token, name) {
  const st = await getState(env);
  if (!token || !st.inviteToken || token !== st.inviteToken) return json({ error: 'This invitation link is not valid any more. Ask for a new one.' }, 400);
  if (!st.agreedAt) {
    st.agreedAt = Date.now(); st.agreedBy = String(name || st.cfg?.refereeName || '').slice(0, 60); st.agreedHow = 'tapped Agree on the referee page';
    if (hasTwilio(env) && st.cfg?.refereePhone && !st.subs.length) { try { await sendSMS(env, st.cfg.refereePhone, welcomeText(st.cfg)); } catch (e) { st.welcomeError = e.message; } }
    await putState(env, st);
  }
  return json({ ok: true, agreedAt: st.agreedAt, name: st.cfg?.name || '' });
}

/* ---------------- notifications ---------------- */
function appUrl(st) { return st.cfg?.appUrl || APP_URL; }
function basePayload(st) {
  return { icon: appUrl(st) + 'icon-192.png', badge: appUrl(st) + 'icon-192.png', url: st.inviteToken ? `/r/${st.inviteToken}/` : '/' };
}
export function eventPayload(st, body, photoId) {
  const name = st.cfg?.name || 'Your friend', d = body.data || {}, text = cleanText(body.text);
  const titles = {
    checkin: `${name} is at the gym`, checkout: d.valid === false ? "Session didn't count" : 'Session counted',
    attempt: 'Check-in refused', week: `${name}'s week: ${String(d.result || '').toUpperCase() || 'VERDICT'}`,
    freeze: 'Freeze declared', config: 'Contract changed', paid: 'Money update', deposit: 'Deposit update',
    status: /no longer/.test(text) ? 'Week lost' : 'No slack left', tamper: 'Log tampered',
  };
  const p = { ...basePayload(st), title: titles[body.event] || 'Ironclad', body: text.slice(0, 500), tag: body.event + ':' + (Number(body.ts) || Date.now()) };
  if (photoId && st.origin && st.inviteToken) p.image = `${st.origin}/r/${st.inviteToken}/photo/${photoId}`;
  return p;
}
function testPayload(st) { return { ...basePayload(st), title: 'Test alert', body: `If you can read this, ${st.cfg?.name || 'your friend'}'s Ironclad alerts reach you.`, tag: 'test' }; }

async function pushAll(env, st, payload, urgency = 'normal', only = null) {
  if (!st.subs.length) return 0;
  const targets = only ? st.subs.filter(s => s.endpoint === only) : st.subs;
  const results = await Promise.allSettled(targets.map(s => sendPush(env, st, s, JSON.stringify(payload), urgency)));
  let ok = 0; const gone = new Set();
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value.ok) ok++;
    else if (r.status === 'fulfilled' && (r.value.status === 404 || r.value.status === 410)) gone.add(targets[i].endpoint);
  });
  if (gone.size) st.subs = st.subs.filter(s => !gone.has(s.endpoint));
  return ok;
}

/* ---------------- Web Push (RFC 8291 + RFC 8292) ---------------- */
const enc = s => new TextEncoder().encode(s);
const concat = (...a) => { const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let o = 0; for (const x of a) { out.set(x, o); o += x.length; } return out; };
export const b64u = buf => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export const unb64u = s => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = atob(s), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };

export async function getVapid(env) {
  const raw = await env.STATE.get('vapid');
  if (raw) return JSON.parse(raw);
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const v = { publicKey: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)), privateJwk: await crypto.subtle.exportKey('jwk', kp.privateKey) };
  await env.STATE.put('vapid', JSON.stringify(v));
  return v;
}
async function vapidJwt(v, aud, sub) {
  const head = b64u(enc(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub })));
  const key = await crypto.subtle.importKey('jwk', v.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc(`${head}.${claims}`));
  return `${head}.${claims}.${b64u(sig)}`;
}
async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}
export async function encryptPayload(p256dh, auth, plaintext) {
  const uaPub = unb64u(p256dh), authSecret = unb64u(auth);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(plaintext, new Uint8Array([2]))));
  const header = new Uint8Array(86); header.set(salt, 0); new DataView(header.buffer).setUint32(16, 4096); header[20] = 65; header.set(asPub, 21);
  return concat(header, ct);
}
export async function sendPush(env, st, sub, payload, urgency = 'normal') {
  const v = await getVapid(env);
  const aud = new URL(sub.endpoint).origin;
  const jwt = await vapidJwt(v, aud, st.origin || 'https://ironclad.invalid');
  const body = await encryptPayload(sub.keys.p256dh, sub.keys.auth, enc(payload.slice(0, 3000)));
  return fetch(sub.endpoint, { method: 'POST', body, headers: { TTL: '86400', Urgency: urgency, 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Authorization: `vapid t=${jwt}, k=${v.publicKey}` } });
}

/* ---------------- weekly verdict ---------------- */
export async function runWeekly(env, now, force = false) {
  if (!env.STATE) return 'no storage';
  const st = await getState(env);
  if (!st.cfg) return 'no data from the app yet';
  if (!st.agreedAt) return 'referee has not agreed yet';
  const weekStart = Number.isInteger(st.cfg.weekStart) ? st.cfg.weekStart : 1;
  const sendHour = Number.isInteger(st.cfg.sendHour) ? st.cfg.sendHour : 9;
  const loc = localParts(now, st.cfg.tz);
  if (!force && (loc.weekday !== weekStart || loc.hour !== sendHour)) return 'not time';
  const target = prevWeek(weekKeyOf(loc, weekStart));
  if (!force && st.lastSentWeek === target) return 'already sent';
  st.lastSentWeek = target;
  if (st.cfg.startWeek && target < st.cfg.startWeek) { await putState(env, st); return 'warm-up week, nothing to report'; }
  const text = summaryText(st, target, now);
  let delivered = 0;
  if (!st.pushedWeeks?.[target]) {
    const verdict = (text.match(/VERDICT: (\w+)/) || [])[1] || (/FROZEN/.test(text) ? 'FROZEN' : 'VERDICT');
    delivered = await pushAll(env, st, { ...basePayload(st), title: `${st.cfg.name || 'Your friend'}'s week: ${verdict}`, body: text.replace(/^Ironclad weekly: /, ''), tag: 'week:' + target }, verdict === 'FAIL' ? 'high' : 'normal');
    (st.pushedWeeks ||= {})[target] = true;
  }
  if (hasTwilio(env) && st.cfg.refereePhone) { try { await sendSMS(env, st.cfg.refereePhone, text); } catch (e) { st.smsError = e.message; } }
  st.sent.push({ week: target, ts: now.getTime(), delivered });
  await putState(env, st);
  return 'sent';
}

export function summaryText(st, wk, now) {
  const c = st.cfg, name = c.name || 'Your friend', target = c.target || 3;
  const range = `${fmtDay(wk)}–${fmtDay(addDays(wk, 6))}`;
  const sess = st.sessions.filter(s => s.week === wk && s.valid);
  const days = [...new Set(sess.map(s => s.day))].sort();
  const dayNames = days.map(d => DN[new Date(d + 'T00:00:00Z').getUTCDay()]).join(', ');
  const w = st.weeks[wk];
  let done, result;
  if (w) { done = w.done; result = w.result; }
  else if (st.freezes[wk] !== undefined) { done = days.length; result = 'frozen'; }
  else { done = days.length; result = done >= target ? 'pass' : 'fail'; }
  const pledge = Number(c.pledge) || 0, hasDeposit = (Number(c.deposited) || 0) > 0;
  const leftBefore = Number(c.depositLeft) || 0, owedBefore = Number(c.owed) || 0;
  const left = w ? leftBefore : (result === 'fail' ? Math.max(0, leftBefore - pledge) : leftBefore);
  const short = w ? owedBefore : owedBefore + (result === 'fail' ? Math.max(0, pledge - leftBefore) : 0);
  const stale = !st.lastReport || (now.getTime() - st.lastReport) > 8 * DAY;
  const noData = !w && sess.length === 0;
  let s = `Ironclad weekly: ${name} went to the gym ${done}/${target} days${days.length ? ` (${dayNames})` : ''} in the week of ${range}. `;
  if (result === 'pass') {
    s += `VERDICT: PASS. Streak: ${(Number(c.streak) || 0) + (w ? 0 : 1)} week(s).`;
    if (short > 0) s += ` Still outstanding from earlier: $${short}; collect it.`;
    else if (hasDeposit) s += ` Deposit intact: $${left}.`;
  } else if (result === 'frozen') {
    s += `FROZEN in advance (${st.freezes[wk] || 'illness/travel'}). Doesn't count either way.`;
  } else {
    s += `VERDICT: FAIL.`;
    if (hasDeposit) s += ` $${pledge} is forfeited from the deposit${c.consequence ? `: send it to ${c.consequence} and keep the receipt` : ''}.`;
    else s += ` ${name} owes you $${pledge}${c.consequence ? `, to be sent to ${c.consequence}` : ''}. Collect it.`;
    if (short > 0) s += ` ${name} also owes you $${short} on top; collect that too.`;
    if (hasDeposit) s += ` Deposit left: $${left}.`;
  }
  if (noData) s += ` The app reported no sessions at all this week.`;
  if (stale) s += ` Last report from the app: ${st.lastReport ? fmtDay(new Date(st.lastReport).toISOString().slice(0, 10)) : 'never'}. Treat silence as failure.`;
  return s;
}
function welcomeText(c) {
  const dep = (Number(c?.deposited) || 0) > 0;
  return `You're in as ${c?.name}'s gym referee. One text every ${DN[c?.weekStart ?? 1]} around ${hour12(c?.sendHour ?? 9)} with the week's verdict. ${dep ? `You hold a $${c.depositLeft} deposit; a failed week forfeits $${c.pledge} of it${c.consequence ? ` to ${c.consequence}` : ''}.` : `A failed week means ${c?.name} owes you $${c?.pledge}. Collect it.`} If a text says the app reported nothing, treat it as a fail. Reply STOP to end the texts.`;
}
function testText(c) { return `Test from Ironclad: ${c?.name}'s gym app can now text you. Weekly verdicts will land every ${DN[c?.weekStart ?? 1]} around ${hour12(c?.sendHour ?? 9)}.`; }
export function randomToken(n = 20) { const a = 'abcdefghijkmnopqrstuvwxyz23456789'; const arr = new Uint32Array(n); crypto.getRandomValues(arr); return [...arr].map(x => a[x % a.length]).join(''); }

/* ---------------- optional Twilio ---------------- */
const hasTwilio = env => !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);
async function sendSMS(env, to, body) {
  if (!hasTwilio(env)) throw new Error('Text messages are not set up on this server');
  if (!to) throw new Error('The referee has no phone number in the app');
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST', headers: { Authorization: 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: env.TWILIO_FROM, Body: body }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Twilio: ${j.message || r.status}`);
  return j.sid || true;
}

/* ---------------- dates ---------------- */
export function localParts(date, tz) {
  const opts = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false, weekday: 'short' };
  let parts;
  try { parts = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC', ...opts }).formatToParts(date); }
  catch { parts = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts }).formatToParts(date); }
  const g = t => parts.find(p => p.type === t)?.value;
  return { y: +g('year'), m: +g('month'), d: +g('day'), hour: (+g('hour')) % 24, weekday: DN.indexOf(g('weekday')) };
}
export function weekKeyOf(loc, weekStart) { const base = Date.UTC(loc.y, loc.m - 1, loc.d); return new Date(base - ((loc.weekday - weekStart + 7) % 7) * DAY).toISOString().slice(0, 10); }
export function prevWeek(wk) { return addDays(wk, -7); }
function addDays(wk, n) { return new Date(Date.parse(wk + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10); }
function fmtDay(wk) { const d = new Date(wk + 'T00:00:00Z'); return `${DN[d.getUTCDay()]} ${MN[d.getUTCMonth()]} ${d.getUTCDate()}`; }
function hour12(h) { return `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`; }
const escH = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- referee app (served from this Worker) ---------------- */
async function refereeRoute(request, env, url, token, rest) {
  if (!env.STATE) return page(shell('Not ready', '<p>This Ironclad server is not set up yet.</p>'), 500);
  const st = await getState(env);
  if (!st.inviteToken || token !== st.inviteToken) return page(shell('Link expired', '<h1>This link has expired.</h1><p class="muted">Ask your friend to send you a fresh invitation from their Ironclad app.</p>'), 404);
  const base = `/r/${token}/`;
  if (rest === '') return Response.redirect(url.origin + base, 302);
  if (request.method === 'GET') {
    if (rest === '/') return page(refereePage(st, token, (await getVapid(env)).publicKey));
    if (rest === '/manifest.webmanifest') return new Response(JSON.stringify({
      name: `Ironclad · ${st.cfg?.name || 'Referee'}`, short_name: 'Ironclad', start_url: base, scope: base, display: 'standalone',
      background_color: '#07080c', theme_color: '#07080c',
      icons: [{ src: appUrl(st) + 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: appUrl(st) + 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
    }), { headers: { 'Content-Type': 'application/manifest+json' } });
    if (rest === '/sw.js') return new Response(SW_JS, { headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-cache' } });
    if (rest === '/data') return json(refereeData(st, token, url.origin));
    const pm = rest.match(/^\/photo\/([a-z0-9]{8,32})$/);
    if (pm) {
      const { value, metadata } = await env.STATE.getWithMetadata('photo:' + pm[1], { type: 'arrayBuffer' });
      if (!value) return new Response('gone', { status: 404 });
      return new Response(value, { headers: { 'Content-Type': metadata?.type || 'image/jpeg', 'Cache-Control': 'private, max-age=86400' } });
    }
    return new Response('not found', { status: 404 });
  }
  if (request.method === 'POST') {
    let body = {}; try { body = await request.json(); } catch {}
    if (rest === '/agree') return agree(env, token, body.name);
    if (rest === '/subscribe') {
      const s = body.subscription;
      if (!s || !/^https:\/\//.test(s.endpoint || '') || !s.keys?.p256dh || !s.keys?.auth) return json({ error: 'bad subscription' }, 400);
      st.subs = st.subs.filter(x => x.endpoint !== s.endpoint);
      st.subs.push({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, added: Date.now(), ua: String(request.headers.get('user-agent') || '').slice(0, 120) });
      st.origin = url.origin;
      await putState(env, st);
      return json({ ok: true, subscribers: st.subs.length });
    }
    if (rest === '/unsubscribe') { st.subs = st.subs.filter(x => x.endpoint !== body.endpoint); await putState(env, st); return json({ ok: true }); }
    if (rest === '/test') {
      st.origin = url.origin;
      const n = await pushAll(env, st, testPayload(st), 'high', body.endpoint || null);
      await putState(env, st);
      return json({ ok: true, delivered: n });
    }
  }
  return json({ error: 'not found' }, 404);
}

export function refereeData(st, token, origin) {
  const c = st.cfg || {};
  return {
    name: c.name || 'Your friend', refereeName: c.refereeName || '', gym: c.gym || '', target: c.target || 3, weekStart: c.weekStart ?? 1,
    minMinutes: c.minMinutes || 30, pledge: c.pledge || 0, consequence: c.consequence || '', deposited: c.deposited || 0, depositLeft: c.depositLeft || 0,
    owed: c.owed || 0, streak: c.streak || 0, startWeek: c.startWeek || '', week: c.week || '', done: c.done || 0, days: c.days || [], warmup: !!c.warmup, frozen: !!c.frozen,
    agreedAt: st.agreedAt || null, lastReport: st.lastReport || null, subscribers: st.subs.length,
    events: st.events.slice(-30).reverse().map(e => ({ ts: e.ts, event: e.event, text: e.text, ok: e.ok, photo: e.photo ? `${origin}/r/${token}/photo/${e.photo}` : null })),
    icon: appUrl(st) + 'icon-192.png',
  };
}

const SW_JS = `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: 'Ironclad', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Ironclad', { body: d.body || '', icon: d.icon, badge: d.badge, image: d.image, tag: d.tag, renotify: true, data: { url: d.url || self.registration.scope } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || self.registration.scope, self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => { for (const w of ws) if (w.url.startsWith(self.registration.scope)) return w.focus(); return self.clients.openWindow(url); }));
});`;

const BASE_CSS = `:root{color-scheme:dark;--bg:#07080c;--line:rgba(255,255,255,.08);--line2:rgba(255,255,255,.14);--text:#f3f5fa;--muted:#8a93a6;--dim:#5c6578;--accent:#ffb020;--accent2:#ff5e1a;--ok:#3ddc97;--bad:#ff4d5e;--display:"Bricolage Grotesque",ui-sans-serif,system-ui,sans-serif;--sans:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;--ease:cubic-bezier(.2,.8,.2,1)}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}html,body{margin:0;background:var(--bg);color:var(--text);font-family:var(--sans);-webkit-font-smoothing:antialiased}
body{min-height:100dvh;padding:calc(14px + env(safe-area-inset-top)) 16px calc(40px + env(safe-area-inset-bottom))}
body::before{content:"";position:fixed;inset:-40vmax -40vmax auto auto;width:110vmax;height:110vmax;border-radius:50%;background:radial-gradient(closest-side,rgba(255,140,40,.28),transparent 70%);z-index:-1;filter:blur(40px)}
main{max-width:520px;margin:0 auto}
.brand{display:flex;align-items:center;gap:10px;font-family:var(--display);font-weight:800;letter-spacing:.14em;text-transform:uppercase;font-size:17px;margin:4px 0 18px}.brand i{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:linear-gradient(135deg,var(--accent),var(--accent2))}.brand i svg{width:16px;height:16px;stroke:#1a0d00;stroke-width:2.6;fill:none;stroke-linecap:round}.brand em{font-style:normal;color:var(--accent)}
h1{font-family:var(--display);font-size:clamp(32px,9vw,44px);line-height:1.02;letter-spacing:-.035em;margin:4px 0 10px}h1 em{font-style:normal;background:linear-gradient(90deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent}
.muted{color:var(--muted)}.small{font-size:13.5px}p{line-height:1.5;margin:8px 0}
.card{background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.018));border:1px solid var(--line);border-radius:24px;padding:18px;margin:14px 0;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
.card h2{margin:0 0 12px;font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.kv{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);font-size:14.5px}.kv:last-child{border-bottom:0}.kv b{text-align:right;max-width:62%}
ul{padding-left:20px;margin:6px 0}li{margin:8px 0;line-height:1.45}
button{font:inherit;font-weight:700;cursor:pointer;border-radius:16px;padding:15px 16px;width:100%;background:rgba(255,255,255,.05);color:var(--text);border:1px solid var(--line2);transition:transform .15s var(--ease)}button:active{transform:scale(.97)}button:disabled{opacity:.5}
.primary{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#1d0e00;border:0;font-family:var(--display);font-size:18px;box-shadow:0 12px 30px -12px rgba(255,110,30,.8)}
.row{display:flex;gap:8px}.row>*{flex:1}`;
function shell(title, inner) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${escH(title)}</title><meta name="robots" content="noindex"><style>${BASE_CSS}</style></head><body><main><div class="brand"><i><svg viewBox="0 0 24 24"><path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/></svg></i><span>Iron<em>clad</em></span></div>${inner}</main></body></html>`;
}

function refereePage(st, token, vapidKey) {
  const data = refereeData(st, token, st.origin || '');
  const icon = appUrl(st);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Ironclad · ${escH(data.name)}</title><meta name="robots" content="noindex"><meta name="theme-color" content="#07080c">
<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="${escH(icon)}apple-touch-icon.png"><link rel="icon" href="${escH(icon)}icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Ironclad">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${BASE_CSS}
.ring{position:relative;width:150px;height:150px;flex:none}.ring svg{width:100%;height:100%;transform:rotate(-90deg)}.ring circle{fill:none;stroke-width:13}.ring .t{stroke:rgba(255,255,255,.07)}.ring .f{stroke:url(#g);stroke-linecap:round;transition:stroke-dashoffset 1.2s var(--ease);filter:drop-shadow(0 0 10px rgba(61,220,151,.5))}
.ring .n{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--display);font-weight:800;font-size:48px;letter-spacing:-.04em;line-height:1}#rn{color:var(--text)}#rn span{font-size:22px;color:var(--dim)}.ring .n small{font-family:var(--sans);font-size:10px;letter-spacing:.16em;color:var(--muted);margin-top:6px;font-weight:700}
.week{display:flex;gap:16px;align-items:center}.verdict{font-family:var(--display);font-size:24px;line-height:1.1;font-weight:800;letter-spacing:-.02em;margin:0 0 4px}
.days{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:14px}.d{text-align:center;border-radius:12px;padding:8px 0;background:rgba(255,255,255,.035);border:1px solid var(--line);font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--muted)}.d b{display:block;font-family:var(--display);font-size:15px;color:var(--text);margin-top:2px}.d.on{background:linear-gradient(160deg,#3ddc97,#22c3ee);border:0;color:rgba(0,0,0,.55)}.d.on b{color:#04140d}
.feed .e{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);align-items:flex-start}.feed .e:last-child{border-bottom:0}.feed .dot{width:9px;height:9px;border-radius:50%;margin-top:7px;flex:none;background:var(--accent)}.feed .dot.ok{background:var(--ok)}.feed .dot.bad{background:var(--bad)}.feed .t{font-size:12px;color:var(--dim);margin-bottom:2px}.feed img{width:56px;height:56px;border-radius:14px;object-fit:cover;margin-left:auto;flex:none}
.alerts{border-color:rgba(255,176,32,.3);background:linear-gradient(135deg,rgba(255,176,32,.12),rgba(255,94,26,.04))}.alerts.on{border-color:rgba(61,220,151,.35);background:linear-gradient(135deg,rgba(61,220,151,.1),rgba(34,195,238,.04))}
.step{display:flex;gap:12px;align-items:flex-start;margin:12px 0}.step .k{flex:none;width:26px;height:26px;border-radius:50%;background:var(--accent);color:#1a0d00;font-weight:800;display:grid;place-items:center;font-size:13px}
.share{display:inline-block;vertical-align:-4px;width:18px;height:18px;stroke:var(--accent);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.toast{position:fixed;left:50%;top:calc(env(safe-area-inset-top) + 14px);transform:translate(-50%,-10px);opacity:0;transition:all .3s var(--ease);background:rgba(30,35,48,.95);border:1px solid var(--line2);padding:12px 16px;border-radius:16px;font-weight:600;font-size:14.5px;z-index:9;max-width:calc(100vw - 32px)}.toast.show{opacity:1;transform:translate(-50%,0)}
.hide{display:none!important}.pulse{animation:p 2s infinite}@keyframes p{0%{box-shadow:0 0 0 0 rgba(255,140,40,.5)}70%{box-shadow:0 0 0 16px rgba(255,140,40,0)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style></head><body>
<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3ddc97"/><stop offset="1" stop-color="#22c3ee"/></linearGradient></defs></svg>
<main>
  <div class="brand"><i><svg viewBox="0 0 24 24"><path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/></svg></i><span>Iron<em>clad</em></span></div>

  <section id="invite" class="hide">
    <h1 id="inv-title"></h1>
    <p class="muted">Two minutes a week. Read this, then decide.</p>
    <div class="card"><h2>What this is</h2><p><b class="nm"></b> made a deal: <span id="inv-short"></span>, or it costs them. Their app checks GPS on arrival and departure, insists on a minimum stay, and keeps a log nobody can edit. What it can't do is make a missed week actually hurt.</p><p style="border-left:3px solid var(--accent);padding:4px 12px;color:var(--muted)">That part is you.</p></div>
    <div class="card"><h2>The deal</h2><div id="deal"></div></div>
    <div class="card"><h2>Your job</h2><ul><li><b>Read the weekly verdict.</b> That's most of it.</li><li id="duty-money"></li><li><b>Treat silence as failure.</b> No verdict, or a note that the app reported nothing? Assume the week was missed and ask.</li></ul><p class="small muted">Not your job: nagging, tracking, policing. Illness or travel can be declared in advance as a freeze, and you'll be told. Excuses after the fact don't count. That's the rule they chose.</p></div>
    <div class="card"><h2>What you'll see</h2><p class="small">A notification when <b class="nm"></b> checks in (with a photo, on Android), when a session counts or doesn't, and the weekly verdict. Never live location. You can turn alerts off any time.</p></div>
    <button id="agree" class="primary">I'm in. Hold them to it.</button>
    <p class="small muted" style="text-align:center">Not for you? Just tell <b class="nm"></b>. No hard feelings.</p>
  </section>

  <section id="home" class="hide">
    <p class="muted small" id="hello" style="letter-spacing:.14em;text-transform:uppercase;font-weight:700;font-size:11.5px"></p>
    <div class="card alerts" id="alerts"></div>
    <div class="card">
      <h2 id="wk-h">This week</h2>
      <div class="week"><div class="ring"><svg viewBox="0 0 150 150"><circle class="t" cx="75" cy="75" r="62"/><circle class="f" id="rf" cx="75" cy="75" r="62" stroke-dasharray="389.56" stroke-dashoffset="389.56"/></svg><div class="n"><div><span id="rn"></span></div><small>this week</small></div></div>
        <div><p class="verdict" id="vd"></p><p class="small muted" id="vm"></p></div></div>
      <div class="days" id="days"></div>
    </div>
    <div class="card"><h2>The money</h2><div id="money"></div></div>
    <div class="card feed"><h2>Activity</h2><div id="feed"></div></div>
    <p class="small muted" style="text-align:center" id="updated"></p>
  </section>
</main>
<div class="toast" id="toast"></div>
<script>
(() => {
const TOKEN = ${JSON.stringify(token)}, VAPID = ${JSON.stringify(vapidKey)};
let D = ${JSON.stringify(data).replace(/</g, '\\u003c')};
const $ = id => document.getElementById(id);
const DN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], DS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => (n||0).toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0});
const toast = (m, ms=3000) => { const t=$('toast'); t.textContent=m; t.classList.add('show'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('show'), ms); };
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const pushOK = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
let reg = null, deferredInstall = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; renderAlerts(); });

function render(){
  document.querySelectorAll('.nm').forEach(e => e.textContent = D.name);
  if (!D.agreedAt) { renderInvite(); $('invite').classList.remove('hide'); $('home').classList.add('hide'); return; }
  $('invite').classList.add('hide'); $('home').classList.remove('hide'); renderHome(); renderAlerts();
}
function renderInvite(){
  $('inv-title').innerHTML = (D.refereeName ? esc(D.refereeName) + ', ' : '') + esc(D.name) + ' wants you to <em>hold them to it.</em>';
  $('inv-short').textContent = D.target + ' gym sessions a week';
  const rows = [['Goal', D.target + ' sessions a week on separate days' + (D.gym ? ', at ' + D.gym : '') + ', GPS-verified'], ['Price of a failed week', D.pledge ? money(D.pledge) : 'your opinion of them']];
  if (D.depositLeft > 0) rows.push(['Deposit you hold', money(D.depositLeft) + ', handed to you up front']);
  if (D.consequence) rows.push(['Forfeits go to', D.consequence]);
  rows.push(['Week runs', DN[D.weekStart] + ' to ' + DN[(D.weekStart+6)%7]]);
  $('deal').innerHTML = rows.map(([k,v]) => '<div class="kv"><span class="muted">'+esc(k)+'</span><b>'+esc(v)+'</b></div>').join('');
  const where = D.consequence ? 'send ' + money(D.pledge) + ' to ' + esc(D.consequence) : 'take ' + money(D.pledge);
  $('duty-money').innerHTML = D.depositLeft > 0 ? '<b>Hold the deposit.</b> When a week fails, ' + where + ', keep the receipt, and tell ' + esc(D.name) + " it's done. Don't let a failed week slide." : '<b>Collect when it says FAIL.</b> ' + esc(D.name) + ' owes ' + money(D.pledge) + ' per failed week' + (D.consequence ? ', to be sent to ' + esc(D.consequence) : '') + ". Don't let it slide.";
}
function renderHome(){
  const hr = new Date().getHours();
  $('hello').textContent = (hr<12?'Morning':hr<18?'Afternoon':'Evening') + ', referee · keeping ' + D.name + ' honest';
  const done = Math.min(D.done, D.target), frac = Math.min(1, D.done / D.target);
  $('rn').innerHTML = done + '<span>/' + D.target + '</span>';
  requestAnimationFrame(() => $('rf').style.strokeDashoffset = 389.56 * (1 - frac));
  const stale = D.lastReport && (Date.now() - D.lastReport) > 8*86400000;
  $('vd').textContent = D.frozen ? 'Frozen week' : D.warmup ? 'Warm-up week' : D.done >= D.target ? 'Week done.' : (D.target - D.done) + ' to go';
  $('vm').textContent = stale ? "No word from the app in over a week. Silence means failure: ask." : D.warmup ? "Doesn't count yet. Their clock starts next week." : D.done >= D.target ? 'Nothing for you to do. Nice.' : 'You get the verdict when the week closes.';
  if (D.week) {
    const ws = new Date(D.week + 'T00:00:00'), today = new Date(); today.setHours(0,0,0,0);
    $('days').innerHTML = [...Array(7)].map((_,i) => { const d = new Date(ws); d.setDate(d.getDate()+i); const k = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); const on = D.days.includes(k); return '<div class="d'+(on?' on':'')+'">'+DS[d.getDay()]+'<b>'+(on?'✓':d.getDate())+'</b></div>'; }).join('');
  }
  const m = [['Price of a failed week', money(D.pledge)]];
  if (D.deposited > 0) m.push(['Deposit you hold', money(D.depositLeft)]);
  if (D.owed > 0) m.push(['Owed to you beyond that', money(D.owed)]);
  if (D.consequence) m.push(['Forfeits go to', D.consequence]);
  m.push(['Passing streak', D.streak + ' week' + (D.streak===1?'':'s')]);
  $('money').innerHTML = m.map(([k,v]) => '<div class="kv"><span class="muted">'+esc(k)+'</span><b>'+esc(v)+'</b></div>').join('');
  $('feed').innerHTML = D.events.length ? D.events.map(e => { const bad = e.event==='attempt' || e.ok===false || /FAIL|lost|tamper/i.test(e.text); const good = e.event==='checkout' && e.ok!==false || /PASS/.test(e.text);
    return '<div class="e"><span class="dot '+(bad?'bad':good?'ok':'')+'"></span><div style="flex:1;min-width:0"><div class="t">'+new Date(e.ts).toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'})+'</div><div class="small">'+esc(e.text)+'</div></div>'+(e.photo?'<img src="'+esc(e.photo)+'" alt="Check-in photo" loading="lazy">':'')+'</div>'; }).join('') : '<p class="small muted">Nothing yet. The first check-in will show up here.</p>';
  $('updated').textContent = D.lastReport ? 'Last heard from ' + D.name + "'s app " + new Date(D.lastReport).toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'}) : '';
}
async function getSub(){ if (!pushOK) return null; reg = reg || await navigator.serviceWorker.register('sw.js'); return reg.pushManager.getSubscription(); }
async function renderAlerts(){
  const el = $('alerts'); const sub = await getSub().catch(() => null);
  const on = !!sub && Notification.permission === 'granted';
  el.classList.toggle('on', on);
  if (on) { el.innerHTML = '<h2>Alerts</h2><p style="margin-top:0"><b>Alerts are on.</b> You\\'ll hear about every check-in and the weekly verdict.</p><div class="row"><button id="t">Send me a test</button><button id="off">Turn off</button></div>'; $('t').onclick = test; $('off').onclick = off; return; }
  if (ios && !standalone) { el.innerHTML = '<h2>One more step</h2><p style="margin-top:0">iPhone only allows alerts from apps on your Home Screen.</p><div class="step"><span class="k">1</span><div>Tap <svg class="share" viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5M5 12v8h14v-8"/></svg> <b>Share</b> at the bottom of Safari.</div></div><div class="step"><span class="k">2</span><div>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</div></div><div class="step"><span class="k">3</span><div>Open <b>Ironclad</b> from your Home Screen and tap <b>Turn on alerts</b>.</div></div>'; return; }
  if (!pushOK) { el.innerHTML = "<h2>Alerts</h2><p style=\\"margin-top:0\\">This browser can't receive alerts. On Android open this link in Chrome; on iPhone, in Safari, then add it to your Home Screen.</p>"; return; }
  if (Notification.permission === 'denied') { el.innerHTML = '<h2>Alerts are blocked</h2><p style="margin-top:0">You blocked notifications for this page. Allow them in your browser or phone settings, then come back.</p>'; return; }
  el.innerHTML = '<h2>Alerts</h2><p style="margin-top:0"><b>Turn on alerts</b> so you hear the moment ' + esc(D.name) + ' checks in, and get the verdict every week.</p><button id="on" class="primary pulse">Turn on alerts</button>' + (deferredInstall ? '<button id="inst" style="margin-top:8px">Add Ironclad to your home screen</button>' : '');
  $('on').onclick = turnOn; if ($('inst')) $('inst').onclick = async () => { deferredInstall.prompt(); deferredInstall = null; renderAlerts(); };
}
async function turnOn(){
  const b = $('on'); b.disabled = true; b.textContent = 'Asking your phone…';
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Alerts stay off. You can turn them on later.'); return renderAlerts(); }
    reg = reg || await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready;
    const key = Uint8Array.from(atob(VAPID.replace(/-/g,'+').replace(/_/g,'/') + '==='.slice((VAPID.length+3)%4)), c => c.charCodeAt(0));
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const r = await fetch('subscribe', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ subscription: sub.toJSON() }) });
    if (!r.ok) throw new Error((await r.json().catch(()=>({}))).error || 'server error');
    toast('Alerts on. Sending a test…'); await renderAlerts(); test();
  } catch (e) { toast("Couldn't turn on alerts: " + e.message, 5000); renderAlerts(); }
}
async function test(){
  const sub = await getSub(); const r = await fetch('test', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ endpoint: sub && sub.endpoint }) });
  const j = await r.json().catch(()=>({}));
  toast(j.delivered ? 'Test sent. It should pop up in a few seconds.' : "Test didn't go through. Turn alerts off and on again.", 4500);
}
async function off(){ const sub = await getSub(); if (sub) { await fetch('unsubscribe', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); } toast('Alerts off.'); renderAlerts(); }
$('agree').onclick = async () => {
  const b = $('agree'); b.disabled = true;
  try { const r = await fetch('agree', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: D.refereeName }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'server error'); D.agreedAt = j.agreedAt; toast("You're in. Now turn on alerts."); render(); scrollTo(0,0); }
  catch (e) { toast(e.message, 5000); b.disabled = false; }
};
async function refresh(){ try { const r = await fetch('data', { cache:'no-store' }); if (r.ok) { D = await r.json(); render(); } } catch {} }
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
setInterval(refresh, 60000);
render();
})();
</script></body></html>`;
}

/* ---------------- status page (your setup checklist) ---------------- */
async function statusPage(env, url) {
  if (!env.STATE) return page(shell('Ironclad server', `<h1>Almost there.</h1><div class="card"><p><b>Add storage:</b> in this Worker's <b>Settings → Bindings</b>, add a <b>KV namespace</b> with the variable name <code>STATE</code>, then reload this page.</p></div>`));
  const secret = await ensureSecret(env);
  const claimed = env.APP_SECRET ? true : !!(await env.STATE.get('claimed'));
  const st = await getState(env), lastCron = +(await env.STATE.get('lastCron') || 0);
  const code = `${url.origin}#${secret}`;
  const appLink = `${(st.cfg?.appUrl || APP_URL)}#connect=${encodeURIComponent(code)}`;
  const tick = (ok, label, note = '') => `<div class="kv"><span>${ok ? '✅' : '⏳'} ${label}</span><b class="muted small" style="font-weight:500">${note}</b></div>`;
  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
  const connect = claimed ? `<div class="card"><h2>Connection</h2><p style="margin:0">Your app is connected. The connection code is hidden now so nobody else can use it.</p><p class="small muted">Lost it? In this Worker's KV namespace, delete the keys <code>secret</code> and <code>claimed</code>, reload this page, and connect again.</p></div>`
    : `<div class="card" style="border-color:rgba(255,176,32,.35)"><h2>Your connection code</h2><p style="margin-top:0">Copy this into Ironclad: <b>Settings → Edit contract → Ironclad alerts</b>. It's shown until your app uses it, then hidden.</p>
       <p style="word-break:break-all;font-family:ui-monospace,monospace;font-size:13px;background:rgba(0,0,0,.35);padding:12px;border-radius:12px;border:1px solid var(--line)" id="code">${escH(code)}</p>
       <div class="row"><button class="primary" id="copy">Copy code</button><button onclick="location.href='${escH(appLink)}'">Open Ironclad</button></div></div>
       <script>document.getElementById('copy').onclick=async()=>{try{await navigator.clipboard.writeText(document.getElementById('code').textContent);document.getElementById('copy').textContent='Copied ✓'}catch(e){document.getElementById('copy').textContent='Select and copy it'}}</script>`;
  const body = `<h1>Your Ironclad <em>server.</em></h1><p class="muted">Keep this tab handy during setup. Everything below should end up ticked.</p>
    ${connect}
    <div class="card"><h2>Checklist</h2>
      ${tick(true, 'Storage connected')}
      ${tick(!!lastCron, 'Hourly check (cron)', lastCron ? `ran ${ago(lastCron)}` : 'add trigger <code>0 * * * *</code>')}
      ${tick(claimed, 'App connected', st.lastReport ? `last heard ${ago(st.lastReport)}` : 'paste the code')}
      ${tick(!!st.inviteToken, 'Referee invited', st.inviteToken ? '' : 'from the app')}
      ${tick(!!st.agreedAt, 'Referee agreed', st.agreedAt ? new Date(st.agreedAt).toLocaleDateString('en-US') : '')}
      ${tick(st.subs.length > 0, 'Referee alerts on', st.subs.length ? `${st.subs.length} device${st.subs.length === 1 ? '' : 's'}` : '')}
      ${hasTwilio(env) ? tick(true, 'Text messages (Twilio)', 'optional extra') : ''}
    </div>
    ${st.sent.length ? `<p class="small muted">Last weekly verdict: week of ${escH(st.sent[st.sent.length - 1].week)}, sent ${ago(st.sent[st.sent.length - 1].ts)}.</p>` : ''}`;
  return page(shell('Ironclad server', body));
}
