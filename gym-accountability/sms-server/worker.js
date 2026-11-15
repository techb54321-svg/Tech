// Ironclad SMS server — a Cloudflare Worker.
//
// The Ironclad app posts its events here. Once a week, at the hour the app
// configured, this worker texts the referee a summary of the week that just
// closed, using Twilio. Because it runs on its own schedule, the text goes
// out even if the phone never opened the app that week.
//
// Required bindings / variables (Settings → Bindings and Variables):
//   STATE               KV namespace binding
//   APP_SECRET          long random password; the app sends the same value
//   TWILIO_ACCOUNT_SID  from the Twilio console
//   TWILIO_AUTH_TOKEN   from the Twilio console
//   TWILIO_FROM         your Twilio number, e.g. +15551234567
// Cron trigger: 0 * * * *  (hourly; the worker decides when to send)
//
// Consent: the referee must agree before any weekly text is sent. The app
// creates an invitation token (POST /invite); the referee page redeems it
// (POST /agree) which records the agreement and sends a welcome text.

const DAY = 86400000;
const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method === 'GET') return statusPage(env, url);
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
    if (url.pathname === '/agree') {
      // Public: redeemed by the referee page with the invitation token.
      if (!env.STATE) return json({ error: 'KV binding STATE is missing' }, 500);
      const st = await getState(env);
      if (!body.token || !st.inviteToken || body.token !== st.inviteToken) return json({ error: 'This invitation link is not valid any more. Ask for a new one.' }, 400);
      if (!st.agreedAt) {
        st.agreedAt = Date.now(); st.agreedBy = String(body.name || st.cfg?.refereeName || '').slice(0, 60); st.agreedHow = 'tapped Agree on the referee page';
        try { await sendSMS(env, st.cfg?.refereePhone, welcomeText(st.cfg)); } catch (e) { st.welcomeError = e.message; }
        await putState(env, st);
      }
      return json({ ok: true, agreedAt: st.agreedAt, name: st.cfg?.name || '' });
    }
    if (!env.APP_SECRET) return json({ error: 'APP_SECRET is not set on the server' }, 500);
    if (body.secret !== env.APP_SECRET) return json({ error: 'wrong secret' }, 401);
    if (!env.STATE) return json({ error: 'KV binding STATE is missing' }, 500);

    try {
      if (url.pathname === '/event') {
        const st = await getState(env);
        recordEvent(st, body);
        let sent = null;
        if (body.event === 'test') sent = await sendSMS(env, st.cfg.refereePhone, testText(st.cfg));
        if (body.event === 'referee' && body.data?.agreed && !st.agreedAt) { st.agreedAt = Number(body.ts) || Date.now(); st.agreedBy = st.cfg.refereeName; st.agreedHow = String(body.data.how || 'confirmed by the user').slice(0, 80); try { sent = await sendSMS(env, st.cfg.refereePhone, welcomeText(st.cfg)); } catch (e) { st.welcomeError = e.message; } }
        if (body.event === 'tamper' && st.agreedAt) sent = await sendSMS(env, st.cfg.refereePhone, `Ironclad alert: ${st.cfg.name}'s gym log on their phone has been edited outside the app. Treat the record as untrustworthy and ask ${st.cfg.name} about it.`);
        await putState(env, st);
        return json({ ok: true, sent, agreedAt: st.agreedAt || null });
      }
      if (url.pathname === '/invite') {
        const st = await getState(env);
        if (body.state && typeof body.state === 'object') st.cfg = { ...(st.cfg || {}), ...body.state };
        if (!st.inviteToken) st.inviteToken = randomToken();
        await putState(env, st);
        return json({ ok: true, token: st.inviteToken, agreedAt: st.agreedAt || null });
      }
      if (url.pathname === '/state') {
        const st = await getState(env);
        return json({ ok: true, agreedAt: st.agreedAt || null, agreedBy: st.agreedBy || null, agreedHow: st.agreedHow || null, lastSentWeek: st.lastSentWeek || null, lastReport: st.lastReport || null, welcomeError: st.welcomeError || null });
      }
      if (url.pathname === '/summary') {
        // Preview (or force-send with {"send":true}) the summary for the last closed week.
        const st = await getState(env);
        if (!st.cfg) return json({ error: 'no data from the app yet' }, 400);
        const now = new Date();
        const loc = localParts(now, st.cfg.tz);
        const wk = prevWeek(weekKeyOf(loc, st.cfg.weekStart));
        const text = summaryText(st, wk, now);
        let sent = null;
        if (body.send) { sent = await sendSMS(env, st.cfg.refereePhone, text); st.sent.push({ week: wk, ts: now.getTime(), forced: true }); await putState(env, st); }
        return json({ ok: true, week: wk, text, sent });
      }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: e.message }, 502);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runWeekly(env, new Date(event.scheduledTime || Date.now())));
  },
};

/* ---------------- state ---------------- */
async function getState(env) {
  const raw = await env.STATE.get('state');
  const st = raw ? JSON.parse(raw) : {};
  st.cfg = st.cfg || null;
  st.sessions = st.sessions || [];
  st.weeks = st.weeks || {};
  st.freezes = st.freezes || {};
  st.events = st.events || [];
  st.sent = st.sent || [];
  return st;
}
async function putState(env, st) {
  st.sessions = st.sessions.slice(-400);
  st.events = st.events.slice(-200);
  st.sent = st.sent.slice(-60);
  await env.STATE.put('state', JSON.stringify(st));
}
function recordEvent(st, body) {
  const ts = Number(body.ts) || Date.now();
  if (body.state && typeof body.state === 'object') st.cfg = { ...(st.cfg || {}), ...body.state };
  st.lastReport = ts;
  st.events.push({ ts, event: body.event, text: String(body.text || '').slice(0, 300) });
  const d = body.data || {};
  if (body.event === 'checkout' && d.day && d.week) st.sessions.push({ ts, day: d.day, week: d.week, valid: !!d.valid, verified: !!d.verified, minutes: Number(d.minutes) || 0 });
  if (body.event === 'week' && d.week) st.weeks[d.week] = { done: Number(d.done) || 0, target: Number(d.target) || 0, result: d.result, owed: Number(d.owed) || 0 };
  if (body.event === 'freeze' && d.week) st.freezes[d.week] = String(d.reason || '').slice(0, 120);
}

/* ---------------- weekly send ---------------- */
export async function runWeekly(env, now, force = false) {
  const st = await getState(env);
  if (!st.cfg) return 'no data from the app yet';
  if (!st.agreedAt) return 'referee has not agreed yet';
  const loc = localParts(now, st.cfg.tz);
  const weekStart = Number.isInteger(st.cfg.weekStart) ? st.cfg.weekStart : 1;
  const sendHour = Number.isInteger(st.cfg.sendHour) ? st.cfg.sendHour : 9;
  if (!force && (loc.weekday !== weekStart || loc.hour !== sendHour)) return 'not time';
  const target = prevWeek(weekKeyOf(loc, weekStart));
  if (!force && st.lastSentWeek === target) return 'already sent';
  if (st.cfg.startWeek && target < st.cfg.startWeek) { st.lastSentWeek = target; await putState(env, st); return 'warm-up week, nothing to report'; }
  const text = summaryText(st, target, now);
  await sendSMS(env, st.cfg.refereePhone, text);
  st.lastSentWeek = target;
  st.sent.push({ week: target, ts: now.getTime() });
  await putState(env, st);
  return 'sent';
}

export function summaryText(st, wk, now) {
  const c = st.cfg;
  const name = c.name || 'Your friend';
  const target = c.target || 3;
  const range = `${fmtDay(wk)}–${fmtDay(addDays(wk, 6))}`;
  const sess = st.sessions.filter(s => s.week === wk && s.valid);
  const days = [...new Set(sess.map(s => s.day))].sort();
  const dayNames = days.map(d => DN[new Date(d + 'T00:00:00Z').getUTCDay()]).join(', ');
  const w = st.weeks[wk];
  let done, result;
  if (w) { done = w.done; result = w.result; }
  else if (st.freezes[wk] !== undefined) { done = days.length; result = 'frozen'; }
  else { done = days.length; result = done >= target ? 'pass' : 'fail'; }
  const pledge = Number(c.pledge) || 0;
  const hasDeposit = (Number(c.deposited) || 0) > 0;
  const leftBefore = Number(c.depositLeft) || 0;
  const owedBefore = Number(c.owed) || 0;
  // If the app has not yet recorded this week's result, apply the forfeit ourselves.
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
  const dep = (Number(c.deposited) || 0) > 0;
  return `You're in as ${c.name}'s gym referee. One text every ${DN[c.weekStart ?? 1]} around ${hour12(c.sendHour ?? 9)} with the week's verdict. ${dep ? `You hold a $${c.depositLeft} deposit; a failed week forfeits $${c.pledge} of it${c.consequence ? ` to ${c.consequence}` : ''}.` : `A failed week means ${c.name} owes you $${c.pledge}. Collect it.`} If a text says the app reported nothing, treat it as a fail. Reply STOP to end the texts.`;
}
function randomToken() { const a = 'abcdefghijkmnopqrstuvwxyz23456789'; const arr = new Uint32Array(20); crypto.getRandomValues(arr); return [...arr].map(n => a[n % a.length]).join(''); }
function testText(c) {
  return `Test from Ironclad: ${c.name}'s gym app can now text you. Weekly verdicts will land every ${DN[c.weekStart ?? 1]} around ${hour12(c.sendHour ?? 9)}.`;
}

/* ---------------- Twilio ---------------- */
async function sendSMS(env, to, body) {
  for (const k of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM']) if (!env[k]) throw new Error(`${k} is not set on the server`);
  if (!to) throw new Error('The referee has no phone number in the app');
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: env.TWILIO_FROM, Body: body }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Twilio: ${j.message || r.status}`);
  return j.sid || true;
}

/* ---------------- dates ---------------- */
export function localParts(date, tz) {
  let parts;
  try { parts = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false, weekday: 'short' }).formatToParts(date); }
  catch { parts = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false, weekday: 'short' }).formatToParts(date); }
  const g = t => parts.find(p => p.type === t)?.value;
  return { y: +g('year'), m: +g('month'), d: +g('day'), hour: (+g('hour')) % 24, weekday: DN.indexOf(g('weekday')) };
}
export function weekKeyOf(loc, weekStart) {
  const base = Date.UTC(loc.y, loc.m - 1, loc.d);
  const diff = (loc.weekday - weekStart + 7) % 7;
  return new Date(base - diff * DAY).toISOString().slice(0, 10);
}
export function prevWeek(wk) { return addDays(wk, -7); }
function addDays(wk, n) { return new Date(Date.parse(wk + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10); }
function fmtDay(wk) { const d = new Date(wk + 'T00:00:00Z'); return `${DN[d.getUTCDay()]} ${MN[d.getUTCMonth()]} ${d.getUTCDate()}`; }
function hour12(h) { return `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`; }

/* ---------------- status page ---------------- */
async function statusPage(env, url) {
  const checks = [
    ['KV namespace bound as STATE', !!env.STATE],
    ['APP_SECRET set', !!env.APP_SECRET],
    ['TWILIO_ACCOUNT_SID set', !!env.TWILIO_ACCOUNT_SID],
    ['TWILIO_AUTH_TOKEN set', !!env.TWILIO_AUTH_TOKEN],
    ['TWILIO_FROM set', !!env.TWILIO_FROM],
  ];
  let extra = '';
  if (env.STATE) {
    try {
      const st = await getState(env);
      extra += `<li>${st.cfg ? '✅' : '⏳'} ${st.cfg ? `Connected to the app (last report ${new Date(st.lastReport).toLocaleString('en-US', { timeZone: st.cfg.tz || 'UTC' })} ${st.cfg.tz || 'UTC'})` : 'Waiting for the first message from the app (use "Send a test message" in the app)'}</li>`;
      if (st.cfg) extra += `<li>${st.agreedAt ? '✅' : '⏳'} Referee ${st.agreedAt ? `agreed on ${new Date(st.agreedAt).toLocaleDateString('en-US', { timeZone: st.cfg.tz || 'UTC' })} (${st.agreedHow || ''})` : 'has not agreed yet: send the invitation from the app. No weekly texts go out until they do.'}</li>`;
      if (st.cfg) extra += `<li>📅 Weekly text: every ${DN[st.cfg.weekStart ?? 1]} at ${hour12(st.cfg.sendHour ?? 9)} (${st.cfg.tz || 'UTC'}), to ${st.cfg.refereePhone ? st.cfg.refereePhone.replace(/\d(?=\d{4})/g, '•') : 'no number yet'}</li>`;
      if (st.sent.length) extra += `<li>📨 Last weekly text: week of ${st.sent[st.sent.length - 1].week}, sent ${new Date(st.sent[st.sent.length - 1].ts).toLocaleString('en-US', { timeZone: st.cfg?.tz || 'UTC' })}</li>`;
    } catch (e) { extra += `<li>❌ KV read failed: ${e.message}</li>`; }
  }
  const allOk = checks.every(c => c[1]);
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ironclad SMS server</title>
<style>body{font-family:system-ui,sans-serif;background:#0b0d12;color:#eef1f7;max-width:560px;margin:0 auto;padding:24px 16px;line-height:1.5}li{margin:6px 0}code{background:#171b25;padding:2px 6px;border-radius:6px}.ok{color:#2ecc71}.bad{color:#ff4d4f}</style>
<h2>Ironclad SMS server ${allOk ? '<span class="ok">✅ ready</span>' : '<span class="bad">⚠️ not configured yet</span>'}</h2>
<ul>${checks.map(([n, ok]) => `<li>${ok ? '✅' : '❌'} ${n}</li>`).join('')}${extra}</ul>
<p>Add a cron trigger <code>0 * * * *</code> under Settings → Triggers so the weekly text can go out. Paste this page's address and your APP_SECRET into the app under Automatic → Weekly text message.</p>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
