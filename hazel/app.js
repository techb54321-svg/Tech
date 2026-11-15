'use strict';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'hazel';
const LEGACY_KEY = 'hazel-v3'; // the original prototype's key
const KEEP_DAYS = 30; // completed-activity history kept for Family View
const BACKUP_PREFIX = 'HAZEL-BACKUP:';

const ACTIVITY_PICTURES = ['📅', '💊', '☕', '🥤', '🍽️', '🍲', '🌳', '📞', '📱', '🩺', '🦶', '💇', '🗑️', '🔒', '🛁', '🎵', '📺', '🧩', '🐕', '🌷', '⛪', '🚌', '🚗', '🛒', '❤️', '🛏️'];
const CONTACT_PICTURES = ['👩', '👨', '👩‍🦰', '👨‍🦳', '👵', '👴', '👧', '👦', '🧑‍⚕️', '🏡', '💚'];

// Emergency numbers and help lines differ by country. Family picks one in setup.
const REGIONS = {
  au: { name: 'Australia', locale: 'en-AU', emergency: '000', spoken: 'Triple Zero', lines: [
    { label: 'Lifeline. Someone to talk to, any time', number: '13 11 14' },
    { label: 'healthdirect. Health advice from a nurse', number: '1800 022 222' }] },
  nz: { name: 'New Zealand', locale: 'en-NZ', emergency: '111', spoken: '1 1 1', lines: [
    { label: 'Need to talk? Free call, any time', number: '1737' },
    { label: 'Healthline. Health advice from a nurse', number: '0800 611 116' }] },
  uk: { name: 'United Kingdom', locale: 'en-GB', emergency: '999', spoken: '9 9 9', lines: [
    { label: 'Samaritans. Someone to talk to, any time', number: '116 123' },
    { label: 'NHS 111. Health advice', number: '111' }] },
  ie: { name: 'Ireland', locale: 'en-IE', emergency: '112', spoken: '1 1 2', lines: [
    { label: 'Samaritans. Someone to talk to, any time', number: '116 123' }] },
  us: { name: 'United States', locale: 'en-US', emergency: '911', spoken: '9 1 1', lines: [
    { label: '988 Lifeline. Someone to talk to, any time', number: '988' }] },
  ca: { name: 'Canada', locale: 'en-CA', emergency: '911', spoken: '9 1 1', lines: [
    { label: '988. Someone to talk to, any time', number: '988' }] },
  other: { name: 'Another country (112)', locale: 'en-GB', emergency: '112', spoken: '1 1 2', lines: [] },
};

// Common parts of a day, offered during setup so a routine takes seconds to build.
const ROUTINES = [
  { key: 'am-tablets', time: '08:00', title: 'Morning tablets', emoji: '💊', note: 'Take your morning tablets with a glass of water.', on: false },
  { key: 'breakfast', time: '08:30', title: 'Breakfast', emoji: '🍽️', note: 'Time for some breakfast.', on: true },
  { key: 'drink', time: '10:30', title: 'Have a drink', emoji: '☕', note: 'Make yourself a cup of tea or a glass of water.', on: true },
  { key: 'lunch', time: '12:30', title: 'Lunch', emoji: '🍲', note: 'It is time to enjoy your lunch.', on: true },
  { key: 'walk', time: '15:00', title: 'A short walk', emoji: '🌳', note: 'Enjoy some fresh air, if you feel like it.', on: true },
  { key: 'dinner', time: '18:00', title: 'Dinner', emoji: '🍽️', note: 'Time for dinner.', on: true },
  { key: 'pm-tablets', time: '20:00', title: 'Evening tablets', emoji: '💊', note: 'Take your evening tablets with a glass of water.', on: false },
  { key: 'doors', time: '21:00', title: 'Lock the doors', emoji: '🔒', note: 'Check the front and back doors are locked.', on: false },
];

// How each person is reached. A Wi-Fi-only tablet can't make an ordinary phone call.
const CALL_METHODS = {
  phone: { label: 'Phone call', verb: 'Call', scheme: 'tel:' },
  facetime: { label: 'FaceTime video', verb: 'Video call', scheme: 'facetime:' },
  'facetime-audio': { label: 'FaceTime audio', verb: 'Call', scheme: 'facetime-audio:' },
};

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// What a fresh install shows: an example day, clearly marked, until family sets Hazel up.
const SEED = {
  setup: false,
  activities: [
    { id: 1, time: '08:00', title: 'Morning tablets', emoji: '💊', note: 'Take your morning tablets with a glass of water.' },
    { id: 2, time: '08:30', title: 'Breakfast', emoji: '🍽️', note: 'Time for some breakfast.' },
    { id: 3, time: '10:30', title: 'Have a drink', emoji: '☕', note: 'Make yourself a cup of tea or a glass of water.' },
    { id: 4, time: '12:30', title: 'Lunch', emoji: '🍲', note: 'It is time to enjoy your lunch.' },
    { id: 5, time: '15:00', title: 'A short walk', emoji: '🌳', note: 'Enjoy some fresh air, if you feel like it.' },
    { id: 6, time: '18:00', title: 'Dinner', emoji: '🍽️', note: 'Time for dinner.' },
    { id: 7, time: '20:00', title: 'Evening tablets', emoji: '💊', note: 'Take your evening tablets with a glass of water.' },
  ],
  contacts: [
    { id: 1, name: 'Sarah', relation: 'Daughter', phone: '', emoji: '👩' },
    { id: 2, name: 'John', relation: 'Son', phone: '', emoji: '👨' },
    { id: 3, name: 'Dr Patel', relation: 'Doctor', phone: '', emoji: '🧑‍⚕️' },
  ],
};

const ABOUT_FIELDS = ['fullName', 'dob', 'address', 'conditions', 'medicines', 'allergies', 'doctor', 'doctorPhone', 'notes'];

// Turns anything (old saved data, a pasted backup, nothing at all) into well-formed data.
function normalize(raw, fromStorage) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const str = (v, max = 600) => (typeof v === 'string' ? v.slice(0, max) : '');
  const photo = v => (typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < 400000 ? v : '');
  const timeOr = (v, fallback) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback);
  const time = v => timeOr(v, '09:00');
  const day = v => (typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) ? v : '');
  const id = v => (Number.isFinite(Number(v)) ? Number(v) : newId());

  const activities = (Array.isArray(d.activities) ? d.activities : []).filter(a => a && typeof a === 'object').map(a => ({
    id: id(a.id),
    time: time(a.time),
    title: str(a.title, 70) || 'Activity',
    emoji: str(a.emoji, 16) || '🌷',
    note: str(a.note, 220),
    photo: photo(a.photo),
    repeat: ['daily', 'weekly', 'once'].includes(a.repeat) ? a.repeat : 'daily',
    days: Array.isArray(a.days) ? [...new Set(a.days.map(Number).filter(n => n >= 0 && n <= 6))] : [],
    date: day(a.date),
    // Important things (tablets) keep coming back until they are ticked.
    must: typeof a.must === 'boolean' ? a.must : a.emoji === '💊',
    lead: [30, 60, 120].includes(Number(a.lead)) ? Number(a.lead) : 0, // minutes of warning before an appointment
    contactId: a.contactId != null && a.contactId !== '' && Number.isFinite(Number(a.contactId)) ? Number(a.contactId) : null,
  }));
  const contacts = (Array.isArray(d.contacts) ? d.contacts : []).filter(c => c && typeof c === 'object').map(c => ({
    id: id(c.id),
    name: str(c.name, 45) || 'Someone',
    relation: str(c.relation, 45),
    phone: str(c.phone, 60),
    method: CALL_METHODS[c.method] ? c.method : 'phone',
    emoji: str(c.emoji, 16) || '💚',
    photo: photo(c.photo),
  }));

  // completed: { 'YYYY-MM-DD': { activityId: 'HH:MM' } }. Older versions stored a plain list of ids.
  const completed = {};
  if (d.completed && typeof d.completed === 'object') {
    for (const [day, v] of Object.entries(d.completed)) {
      if (!/^\d{4}-\d\d-\d\d$/.test(day) || !v || typeof v !== 'object') continue;
      const entries = Array.isArray(v) ? v.map(x => [x, '']) : Object.entries(v);
      completed[day] = Object.fromEntries(entries.map(([k, t]) => [k, /^\d\d:\d\d$/.test(t) ? t : '']));
    }
  }

  // Ticks that were later taken back: { day: { activityId: { was: 'HH:MM', at: 'HH:MM' } } }
  const undone = {};
  if (d.undone && typeof d.undone === 'object') {
    for (const [key, v] of Object.entries(d.undone)) {
      if (!day(key) || !v || typeof v !== 'object') continue;
      undone[key] = Object.fromEntries(Object.entries(v).map(([k, u]) => [k, { was: str(u?.was, 5), at: str(u?.at, 5) }]));
    }
  }

  const about = {};
  for (const f of ABOUT_FIELDS) about[f] = str(d.about?.[f]);

  return {
    v: 2,
    // Data saved by an older version counts as "set up" once it has been made someone's own.
    setup: typeof d.setup === 'boolean' ? d.setup : !!fromStorage && (!!str(d.person) || contacts.some(c => c.phone)),
    person: str(d.person, 35),
    region: REGIONS[d.region] ? d.region : 'au',
    size: ['normal', 'large', 'largest'].includes(d.size) ? d.size : 'normal',
    pin: /^\d{4,8}$/.test(d.pin) ? d.pin : '',
    sound: d.sound !== false,
    awake: d.awake !== false,
    nightFrom: timeOr(d.nightFrom, '21:00'),
    nightTo: timeOr(d.nightTo, '06:00'),
    note: { text: str(d.note?.text, 200), from: str(d.note?.from, 45), until: day(d.note?.until) },
    backedUp: day(d.backedUp),
    about,
    activities,
    contacts,
    completed,
    undone,
  };
}

// A first guess at the country from the device's time zone. The family confirms it during set-up.
function guessRegion() {
  let zone = '';
  try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* keep the default */ }
  if (zone.startsWith('Australia/')) return 'au';
  if (['Pacific/Auckland', 'Pacific/Chatham'].includes(zone)) return 'nz';
  if (zone === 'Europe/London') return 'uk';
  if (zone === 'Europe/Dublin') return 'ie';
  if (/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Montreal|Moncton|Whitehorse|Yellowknife|Iqaluit)/.test(zone)) return 'ca';
  if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana|Kentucky|North_Dakota|Juneau)|^Pacific\/Honolulu/.test(zone)) return 'us';
  if (/^(Europe|Asia|Africa)\//.test(zone)) return 'other';
  return 'au';
}

function load() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY) || 'null');
  } catch { /* storage blocked or corrupt: start fresh */ }
  return stored ? normalize(stored, true) : normalize({ ...SEED, region: guessRegion() }, false);
}

// Returns false when the browser refuses to store anything (private mode, blocked site data, full).
function save() {
  // Drop old history and long-past appointments so storage doesn't grow forever.
  const cutoff = dayKey(daysAgo(KEEP_DAYS));
  for (const k of Object.keys(data.completed)) if (k < cutoff) delete data.completed[k];
  for (const k of Object.keys(data.undone)) if (k < cutoff) delete data.undone[k];
  data.activities = data.activities.filter(a => a.repeat !== 'once' || !a.date || a.date >= cutoff);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function storageWorks() {
  try {
    localStorage.setItem('hazel-probe', '1');
    localStorage.removeItem('hazel-probe');
    return true;
  } catch {
    return false;
  }
}

const NOT_SAVED = 'This change works for now, but this device could not keep it for next time.';
function saved(message, options) {
  const ok = save();
  toast(ok ? message : NOT_SAVED, ok ? options : undefined);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dayKey = (d = new Date()) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
const parseDay = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
const nowHHMM = () => new Date().toTimeString().slice(0, 5);
const toMinutes = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const NOW_WINDOW = 60; // minutes an activity stays "Now" after its start time
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n); // calendar arithmetic, so daylight-saving changes don't skip a day
  return d;
}
function newId() { return Date.now() + Math.floor(Math.random() * 1000); }

const data = load();
const canStore = storageWorks();

const region = () => REGIONS[data.region] || REGIONS.au;
const fmt = (opts, date = new Date()) => new Intl.DateTimeFormat(region().locale, opts).format(date);
const clockText = (date = new Date()) => fmt({ hour: 'numeric', minute: '2-digit' }, date);
function timeText(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return clockText(d);
}
const todayLong = () => fmt({ weekday: 'long', day: 'numeric', month: 'long' });

// Morning, afternoon, evening or night: the first thing someone who has lost track needs to know.
// Night runs from the bedtime to the morning time the family sets.
function dayPart(d = new Date()) {
  const m = d.getHours() * 60 + d.getMinutes();
  const from = toMinutes(data.nightFrom);
  const to = toMinutes(data.nightTo);
  if (from > to ? m >= from || m < to : m >= from && m < to) return 'night';
  return m < 12 * 60 ? 'morning' : m < 17 * 60 ? 'afternoon' : 'evening';
}
const beforeDawn = () => dayPart() === 'night' && new Date().getHours() < 12;
function partLine() {
  const weekday = fmt({ weekday: 'long' });
  return beforeDawn() ? `${weekday}, very early morning` : `${weekday} ${dayPart()}`;
}
const restMessage = () => (beforeDawn()
  ? 'It is still night time. Everything is fine. You can go back to bed.'
  : 'It is bed time. Everything is fine.');
function greeting() {
  const name = data.person ? `, ${data.person}` : '';
  return dayPart() === 'night' ? `It's night time${name}` : `Good ${dayPart()}${name}`;
}

const findActivity = id => data.activities.find(a => a.id === id);
const findContact = id => data.contacts.find(c => c.id === id);
const telHref = phone => 'tel:' + String(phone).replace(/[^+\d]/g, '');
// FaceTime also accepts an email address, so only strip a phone number down to its digits.
const callHref = c => CALL_METHODS[c.method].scheme + (c.phone.includes('@') ? encodeURIComponent(c.phone.trim()) : c.phone.replace(/[^+\d]/g, ''));
const callLink = (c, cls, label) => `<a class="${cls}" href="${esc(callHref(c))}" data-number="${esc(c.phone)}" data-name="${esc(c.name)}">${label}</a>`;
// People the person can actually reach. Before set-up the examples are shown even without numbers.
const reachable = () => data.contacts.filter(c => c.phone || !data.setup);
const helper = () => data.contacts.find(c => c.phone);

function occursOn(a, d = new Date()) {
  if (a.repeat === 'once') return a.date === dayKey(d);
  if (a.repeat === 'weekly') return a.days.includes(d.getDay());
  return true;
}
const byTime = (a, b) => a.time.localeCompare(b.time);
const todays = (d = new Date()) => data.activities.filter(a => occursOn(a, d)).sort(byTime);
function scheduleText(a) {
  if (a.repeat === 'once') return a.date ? fmt({ weekday: 'short', day: 'numeric', month: 'short' }, parseDay(a.date)) : 'One day';
  if (a.repeat === 'weekly' && a.days.length < 7) return DAY_ORDER.filter(d => a.days.includes(d)).map(d => DAY_NAMES[d]).join(', ');
  return 'Every day';
}

// The time something was ticked off today: 'HH:MM', '' if the time wasn't recorded, undefined if not done.
const doneAt = id => data.completed[dayKey()]?.[id];
const isDone = id => doneAt(id) !== undefined;
const doneText = id => (doneAt(id) ? `Done at ${timeText(doneAt(id))}` : 'Done today');
function markDone(id) {
  (data.completed[dayKey()] ??= {})[id] = nowHHMM();
}

// 'done', 'now', 'upcoming', or 'earlier' (its time has passed and it wasn't ticked off). An activity is
// "now" from its start time for up to an hour, or until the next activity starts if that is sooner.
function statusOf(a) {
  if (isDone(a.id)) return 'done';
  const now = toMinutes(nowHHMM());
  const start = toMinutes(a.time);
  if (now < start) return 'upcoming';
  const nextStart = todays().map(x => toMinutes(x.time)).filter(t => t > start)[0];
  return now < Math.min(start + NOW_WINDOW, nextStart ?? Infinity) ? 'now' : 'earlier';
}
// The activity to point someone at: what's on now, else what's next.
const focusActivity = () => todays().find(a => ['now', 'upcoming'].includes(statusOf(a)));
const earlierNotDone = () => todays().filter(a => statusOf(a) === 'earlier');
const minutesLate = a => toMinutes(nowHHMM()) - toMinutes(a.time);
const EARLY_WINDOW = 60; // an important thing can't be ticked more than this many minutes before its time
const tooEarly = a => a.must && minutesLate(a) < -EARLY_WINDOW;

// Important things ticked off yesterday evening. Shown until today's first activity, so that after
// midnight nobody thinks last night's tablets were missed.
function lastNight() {
  const first = todays()[0];
  if (first && minutesLate(first) >= 0) return [];
  const done = data.completed[dayKey(daysAgo(1))] || {};
  return data.activities.filter(a => a.must && done[a.id] && done[a.id] >= '17:00').map(a => ({ a, at: done[a.id] }));
}
const lastNightText = ({ a, at }) => `Last night: ${a.title}, done at ${timeText(at)}`;
const MUST_HOURS = 6; // how long an important, unticked item stays at the top of the home screen

// What belongs at the top of the home screen: the most recent important thing that is due and not
// ticked, otherwise whatever is on now.
function attentionItem() {
  const list = todays();
  const must = list.filter(a => a.must && !isDone(a.id) && minutesLate(a) >= 0 && minutesLate(a) < MUST_HOURS * 60).pop();
  return must || list.find(a => statusOf(a) === 'now');
}

// Appointments and anything special tomorrow, soonest first: [{ a, date }]
function comingUp() {
  const today = dayKey();
  const tomorrow = daysAgo(-1);
  const limit = dayKey(daysAgo(-30));
  const dated = data.activities.filter(a => a.repeat === 'once' && a.date > today && a.date <= limit).map(a => ({ a, date: a.date }));
  const weekly = data.activities.filter(a => a.repeat === 'weekly' && a.days.length < 7 && occursOn(a, tomorrow)).map(a => ({ a, date: dayKey(tomorrow) }));
  return [...dated, ...weekly].sort((x, y) => x.date.localeCompare(y.date) || byTime(x.a, y.a));
}
const whenText = date => (date === dayKey(daysAgo(-1)) ? 'Tomorrow' : fmt({ weekday: 'long', day: 'numeric', month: 'long' }, parseDay(date)));
function tomorrowLine() {
  const first = comingUp().find(x => x.date === dayKey(daysAgo(-1)));
  return first ? `Tomorrow: ${first.a.title}, ${timeText(first.a.time)}` : '';
}
const noteShown = () => !!data.note.text && (!data.note.until || data.note.until >= dayKey());

// What was planned and what was ticked off on a given day, for Family View.
function dayRecord(d) {
  const done = data.completed[dayKey(d)] || {};
  const planned = data.activities.filter(a => occursOn(a, d)).sort(byTime);
  const isToday = dayKey(d) === dayKey();
  const missed = planned.filter(a => !(a.id in done) && (!isToday || statusOf(a) === 'earlier'));
  return { planned, done: planned.filter(a => a.id in done), missed };
}

// --- Sound, voice and keeping the screen on -------------------------------

// Browsers only allow sound after the person has touched the page once.
let armed = false;
let audio = null;
function arm() {
  if (armed) return;
  armed = true;
  try {
    audio = new (window.AudioContext || window.webkitAudioContext)();
    audio.resume?.();
  } catch { /* no sound on this device: reminders still show on screen */ }
  try {
    if ('speechSynthesis' in window) speechSynthesis.speak(new SpeechSynthesisUtterance(''));
  } catch { /* ignore */ }
  requestWakeLock();
  setTimeout(() => app.querySelector('.sound-hint')?.remove(), 0);
}

// A soft two-note chime.
function chime() {
  if (!data.sound || !audio) return;
  try {
    const t = audio.currentTime;
    [[659.25, 0], [523.25, 0.45]].forEach(([freq, at]) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + at);
      gain.gain.exponentialRampToValueAtTime(0.3, t + at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + at + 1.4);
      osc.connect(gain).connect(audio.destination);
      osc.start(t + at);
      osc.stop(t + at + 1.5);
    });
  } catch { /* ignore */ }
}

// Reads text aloud. `el` is the button that was tapped: it turns into a Stop button while Hazel is
// speaking, so it is clear something is happening and a second tap stops it.
let speakingEl = null;
function speak(text, { quiet = false, el = null } = {}) {
  if (!('speechSynthesis' in window)) {
    if (!quiet) toast('This device cannot read aloud.');
    return;
  }
  try {
    if (el && el === speakingEl && speechSynthesis.speaking) return hush();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const want = region().locale.toLowerCase();
    const voices = speechSynthesis.getVoices();
    u.voice = voices.find(v => v.lang.replace('_', '-').toLowerCase() === want) || null;
    u.lang = region().locale;
    u.rate = 0.82;
    let started = false;
    const restore = () => {
      if (el?.dataset.label) { el.textContent = el.dataset.label; delete el.dataset.label; }
      if (speakingEl === el) speakingEl = null;
    };
    u.onstart = () => {
      started = true;
      if (!el?.isConnected) return;
      el.dataset.label = el.textContent;
      el.textContent = '⏹ Stop reading';
      speakingEl = el;
    };
    u.onend = u.onerror = restore;
    speechSynthesis.speak(u);
    if (!quiet) setTimeout(() => { if (!started && !speechSynthesis.speaking) toast('This device has no voice for reading aloud.'); }, 2500);
  } catch { /* ignore */ }
}
function hush() {
  try {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  } catch { /* ignore */ }
}

// Keep the screen on while Hazel is showing, so it can sit on a stand as a day clock.
let wakeLock = null;
async function requestWakeLock() {
  if (!data.awake || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
  } catch { /* not allowed here: fine */ }
}
function releaseWakeLock() {
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
}

// A short message at the bottom of the screen, optionally with one button (such as "Put it back").
let toastTimer;
let toastRun = null;
function toast(message, { action = null } = {}) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button data-action="toast-action">${esc(action.label)}</button>` : ''}`;
  toastRun = action ? action.run : null;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; toastRun = null; }, action ? 12000 : 6000);
}

function applySettings() {
  document.documentElement.dataset.size = data.size;
  document.documentElement.lang = region().locale;
}

// Shrinks a chosen photo to a small square so a few dozen fit comfortably in storage.
function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = 320;
      const scale = Math.max(side / img.width, side / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = side;
      canvas.getContext('2d').drawImage(img, (side - w) / 2, (side - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not an image')); };
    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// Navigation (uses browser history so the phone's back button works)
// ---------------------------------------------------------------------------

// confirming: the item awaiting an on-screen "are you sure?" ('activity:12', 'contact:3', 'reset', 'restore')
// photo: a photo chosen in an edit form but not saved yet (undefined = unchanged, '' = removed)
const ui = { screen: 'home', id: null, tab: 'progress', unlocked: false, confirming: null, photo: undefined, backup: '', restore: null, summary: '', forgot: false };

const FORM_SCREENS = ['activityForm', 'contactForm', 'setup'];

// A shaky hand often taps twice. After the screen changes, taps are ignored for a moment so the
// second one can't land on a button that has just appeared under the finger.
let guardUntil = 0;
function guard(ms = 700) {
  guardUntil = Math.max(guardUntil, Date.now() + ms);
}
const needsPin = screen => FORM_SCREENS.includes(screen);

// history can be unavailable in some embedded frames; navigation still works without it.
function remember(state, replace) {
  try {
    replace ? history.replaceState(state, '') : history.pushState(state, '');
  } catch { /* ignore */ }
}

function enter(screen, id) {
  hush();
  if (screen === 'home') ui.unlocked = false;
  Object.assign(ui, { screen, id, confirming: null, photo: undefined, backup: '', restore: null, summary: '', forgot: false });
  dirty = false;
}

function go(screen, id = null, { replace = false } = {}) {
  enter(screen, id);
  remember({ screen, id }, replace);
  render();
  guard();
  window.scrollTo(0, 0);
  focusHeading();
}

function focusHeading() {
  if (document.activeElement?.hasAttribute('data-autofocus')) return; // e.g. the PIN box
  app.querySelector('h1, .page-title')?.focus({ preventScroll: true });
}

window.addEventListener('popstate', e => {
  const s = e.state || { screen: 'home', id: null };
  enter(s.screen, s.id);
  render();
  guard();
  focusHeading();
});

// Every screen the person uses has Help in the same corner, so it is never more than a tap away.
const backButton = (to = 'home', label = 'Back to home', help = false) =>
  `<div class="topbar"><button class="back" data-go="${to}">${to === 'home' ? '⌂' : '‹'} &nbsp;${label}</button>${help ? '<button class="help-btn" data-go="help">🛟 Help</button>' : ''}</div>`;
const exampleNote = () => (data.setup ? '' : '<p class="example-note"><strong>This is an example.</strong> Hazel has not been set up on this device yet.</p>');

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

// What a family should know before relying on Hazel. Shown at set-up and in Settings.
const TIPS = `<details class="tips" open>
  <summary>Before you leave them with Hazel</summary>
  <ul>
    <li><b>Leave Hazel open on a stand.</b> It can only chime while it is showing on the screen. Keep the tablet or phone plugged in where they sit, and tap the screen once after opening Hazel so the sound is switched on.</li>
    <li><b>Add it to the home screen.</b> In the browser's menu choose “Add to Home Screen”. Hazel then opens like an app and works without the internet.</li>
    <li><b>Try a call from the Call screen.</b> Make sure it really rings from this device.</li>
    <li><b>Hazel is not an alarm.</b> Someone at risk of falls still needs a pendant or watch alarm. Hazel cannot tell anyone that something is wrong.</li>
    <li><b>It is a memory aid, not a medical record.</b> Keep using the pill box or pharmacy pack. A tick only means the button was tapped.</li>
    <li><b>Make a backup copy</b> in Settings when you are done, and keep it somewhere safe.</li>
  </ul>
</details>`;

const CALM_NIGHT = 'You are safe at home. It is night time, and everything is fine. Take a slow breath. You can rest, or you can talk to someone.';
const CALM_MESSAGE = "You are safe. Take your time. You don't have to do everything at once. You can call someone you know.";
const TABLET_CAUTION = "Not sure if you've already had them? Check your pill box. Don't take extra. Ask family or your pharmacist first.";

const screens = {
  home() {
    const part = dayPart();
    const names = reachable().slice(0, 3).map(c => c.name).join(', ');
    const top = attentionCard();
    const note = noteShown() ? `<button class="note-card" data-action="read-note" aria-label="Note${data.note.from ? ' from ' + esc(data.note.from) : ''}: ${esc(data.note.text)}. Tap to hear it.">
          <span class="note-icon" aria-hidden="true">💌</span>
          <span><strong>${data.note.from ? 'From ' + esc(data.note.from) : 'A note for you'}</strong>${esc(data.note.text)}</span>
        </button>` : '';
    const dayTile = bigTile('green', 'day', '🗓️', 'My Day', dayTileLines());
    const duo = `<div class="duo">
          ${bigTile('blue stack', 'contacts', '📞', 'Call Someone', [names || 'Family and friends'])}
          ${bigTile('pink stack', 'help', '🛟', 'Get Help', ['Emergency and support'])}
        </div>`;
    // With something to do now, the picture makes way so the buttons below stay on screen.
    return `
      <section class="hero ${part} ${top ? 'compact' : ''}">
        <div class="brand"><span aria-hidden="true">🌿</span> Hazel</div>
        <h1 class="greeting" tabindex="-1">${esc(greeting())}</h1>
        <button class="clock" data-action="read-home" aria-label="${clockText()}. Tap to hear the time and what is next.">${clockText()}</button>
        <div class="daypart">${esc(partLine())}</div>
        <div class="date">${fmt({ day: 'numeric', month: 'long', year: 'numeric' })}</div>
        ${part === 'night' ? `<p class="rest">${restMessage()}</p>` : ''}
        <div class="landscape" aria-hidden="true"><div class="sun"></div><div class="hill one"></div><div class="hill two"></div><div class="hill three"></div></div>
        ${data.sound && !armed && todays().length ? '<div class="sound-hint">🔔 Tap once to turn on the chime</div>' : ''}
      </section>
      <section class="content home-content">
        ${data.setup ? '' : `<button class="example-banner" data-go="setup"><strong>Hazel is not set up yet.</strong> This is an example day. Family: tap here to set it up ›</button>`}
        ${top
          ? top + duo + dayTile + note // something to do now: answer it, with Call and Help right beneath
          : note + dayTile + duo}
        <div class="home-tools">
          <button data-action="read-home">🔊 Read this to me</button>
          <button data-action="bigger">🔍 ${data.size === 'largest' ? 'Smaller writing' : 'Bigger writing'}</button>
          ${data.pin ? '<button data-go="family">⚙ Family settings</button>' : '<button data-hold="family" class="hold">⚙ Family settings</button>'}
        </div>
      </section>`;
  },

  day() {
    const list = todays();
    const next = focusActivity();
    const doneCount = list.filter(a => isDone(a.id)).length;
    const earlier = earlierNotDone().length;
    const soon = comingUp();
    let nextCard = '';
    if (next) {
      const now = statusOf(next) === 'now';
      nextCard = `<div class="next-card">
           <span class="pill ${now ? 'now' : ''}">${now ? 'Now' : 'Next'}</span>
           <div class="next-head">${thumb(next)}<div><h2>${esc(next.title)}</h2><p>${timeText(next.time)}</p></div></div>
           ${now ? `<button class="primary" data-action="finish" data-id="${next.id}">✓ &nbsp;I've done this</button>` : ''}
           <button class="${now ? 'secondary' : 'primary'}" data-go="activity" data-id="${next.id}">Show me ›</button>
         </div>`;
    } else if (list.length && doneCount === list.length) {
      nextCard = '<div class="empty">🌷 All done for today!<p>Enjoy your day.</p></div>';
    } else if (list.length) {
      nextCard = '<div class="empty">🌷 Nothing else planned for today.</div>';
    }
    return `
      <section class="content">
        ${backButton('home', 'Back to home', true)}
        ${exampleNote()}
        <h1 class="page-title" tabindex="-1">🗓️ My Day</h1>
        <p class="lead">${todayLong()}${list.length ? ` · ${doneCount} of ${list.length} done` : ''}</p>
        ${list.length ? '<button class="secondary small" data-action="read-day">🔊 Read my day aloud</button>' : ''}
        ${lastNight().map(x => `<p class="last-night">✓ ${esc(lastNightText(x))}</p>`).join('')}
        ${nextCard}
        ${earlier ? `<p class="earlier-note">${earlier === 1 ? "One thing from earlier today isn't ticked off yet. Tap it if you have done it." : earlier + " things from earlier today aren't ticked off yet. Tap each one you have done."}</p>` : ''}
        <h2 class="section-heading">Today</h2>
        ${list.map(activityItem).join('') || '<p class="muted">Nothing planned today. A family member can add things in Family settings.</p>'}
        ${soon.length ? `<h2 class="section-heading">Coming up</h2>${soon.map(({ a, date }) => `
          <button class="item soon" data-go="activity" data-id="${a.id}">
            ${thumb(a)}
            <span class="name">${esc(a.title)}<span class="when">${whenText(date)}, ${timeText(a.time)}</span></span>
            <span class="chevron" aria-hidden="true">›</span>
          </button>`).join('')}` : ''}
      </section>`;
  },

  activity() {
    const a = findActivity(ui.id);
    if (!a) return screens.day();
    const today = occursOn(a);
    const done = today && isDone(a.id);
    const status = today ? statusOf(a) : 'future';
    const tablets = a.emoji === '💊';
    const early = today && !done && tooEarly(a);
    const before = lastNight().find(x => x.a === a);
    let buttons;
    if (done) {
      buttons = `<div class="done-panel"><span aria-hidden="true">✓</span> ${doneText(a.id)}${tablets ? '<small>You have taken these today. No need to take them again.</small>' : ''}</div>
        ${ui.confirming === 'undo'
          ? `<div class="confirm" role="group" aria-label="Is this wrong?">
              <p>Hazel has this as ${doneText(a.id).toLowerCase()}. Is that wrong?</p>
              <div class="confirm-actions">
                <button class="delete" data-action="undo" data-id="${a.id}">Yes, I have not done it</button>
                <button class="edit" data-action="cancel" data-autofocus>No, it is right</button>
              </div>
            </div>`
          : '<button class="secondary small" data-action="ask" data-confirm="undo">This is wrong</button>'}`;
    } else if (early) {
      // Too early to tick: no instructions and no button, so nothing invites taking tablets at the wrong time.
      buttons = `<div class="notyet"><b>Not yet.</b> This is for ${timeText(a.time)}. It is ${clockText()} now.${before ? `<small>✓ ${esc(lastNightText(before))}</small>` : ''}</div>`;
    } else if (today) {
      buttons = `${tablets && status === 'earlier' ? `<p class="caution">${TABLET_CAUTION}</p>` : ''}
        <button class="primary" data-action="finish" data-id="${a.id}">✓ &nbsp;I've done this</button>`;
    } else {
      const next = comingUp().find(x => x.a === a);
      buttons = `<p class="celebrate">${next ? `This is ${next.date === dayKey(daysAgo(-1)) ? 'tomorrow' : 'on ' + whenText(next.date)}.` : 'This is not on today.'}</p>`;
    }
    const who = findContact(a.contactId);
    return `
      <section class="content">
        ${backButton('day', 'Back to My Day', true)}
        <div class="photo" aria-hidden="true">${a.photo ? `<img src="${esc(a.photo)}" alt="">` : esc(a.emoji)}</div>
        <div class="activity-card">
          <div class="counter">${timeText(a.time)}</div>
          <h1 class="activity-title" tabindex="-1">${esc(a.title)}</h1>
          ${a.note && !done && !early ? `<p class="activity-note">${esc(a.note)}</p>` : ''}
        </div>
        ${buttons}
        ${who?.phone ? callLink(who, 'secondary call-now', `📞 ${CALL_METHODS[who.method].verb} ${esc(who.name)}`) : ''}
        <button class="secondary" data-action="speak-activity" data-id="${a.id}">🔊 Read this out loud</button>
      </section>`;
  },

  contacts() {
    return `
      <section class="content">
        ${backButton('home', 'Back to home', true)}
        ${exampleNote()}
        <h1 class="page-title" tabindex="-1">📞 Call Someone</h1>
        <p class="lead">${helper() ? 'Tap a person to call them.' : 'There is nobody to call yet. A family member can add phone numbers in Family settings.'}</p>
        ${reachable().map(contactCard).join('')}
      </section>`;
  },

  help() {
    const r = region();
    const main = helper();
    return `
      <section class="content">
        ${backButton()}
        ${exampleNote()}
        <h1 class="page-title" tabindex="-1">🛟 Get Help</h1>
        <a class="big red" href="tel:${r.emergency}" data-number="${r.emergency}" data-name="${r.emergency}" data-emergency>
          <span class="emoji" aria-hidden="true">🚑</span>
          <span><strong>Call ${r.emergency}</strong><small>Emergency: ambulance, fire or police</small></span>
        </a>
        ${main
          ? callLink(main, 'big blue', `<span class="emoji" aria-hidden="true">📞</span>
               <span><strong>Call ${esc(main.name)}</strong><small>${esc(main.relation || 'Family')}</small></span>`)
          : data.setup ? '' : bigTile('blue', 'contacts', '📞', 'Call someone', ['Family and friends'])}
        ${bigTile('green', 'calm', '💬', "I'm feeling worried", ['Hear a calming message'])}
        ${bigTile('yellow', 'about', '🪪', 'My details', ['For a doctor, nurse or ambulance'])}
        ${r.lines.length ? `<div class="notice lines"><strong>Someone to talk to</strong>${r.lines.map(l =>
          `<a class="link" href="${telHref(l.number)}" data-number="${l.number}" data-name="${esc(l.label.split('.')[0])}">${l.label}: <span class="number">${l.number}</span></a>`).join('')}</div>` : ''}
      </section>`;
  },

  calm() {
    const night = dayPart() === 'night';
    const line = region().lines[0];
    return `
      <section class="content">
        ${backButton('help', 'Back to Get Help')}
        <div class="safe-space" aria-hidden="true"><span class="breathe">🌷</span></div>
        <h1 class="page-title" style="margin-top:23px" tabindex="-1">You're not alone</h1>
        <p class="activity-note">${esc(night ? CALM_NIGHT : CALM_MESSAGE)}</p>
        <p class="lead">It is ${clockText()}, ${esc(partLine())}. Breathe in slowly, and out slowly.</p>
        <button class="primary" data-action="speak-calm">🔊 Read this to me</button>
        ${line ? `<a class="big blue" href="${telHref(line.number)}" data-number="${line.number}" data-name="${esc(line.label.split('.')[0])}">
          <span class="emoji" aria-hidden="true">💬</span>
          <span><strong>Talk to someone now</strong><small>${esc(line.label.split('.')[0])}, open day and night: ${line.number}</small></span></a>` : ''}
        ${helper() ? bigTile('green', 'contacts', '📞', 'Call someone', ['Someone you know']) : ''}
      </section>`;
  },

  about() {
    const a = data.about;
    const born = a.dob && /^\d{4}-\d\d-\d\d$/.test(a.dob) ? parseDay(a.dob) : null;
    const age = born ? Math.floor((new Date() - born) / (365.2425 * 864e5)) : null;
    const row = (label, value) => (value ? `<div class="detail"><span>${label}</span><b>${esc(value)}</b></div>` : '');
    const any = ABOUT_FIELDS.some(f => a[f]);
    return `
      <section class="content">
        ${backButton('help', 'Back to Get Help')}
        ${exampleNote()}
        <h1 class="page-title" tabindex="-1">🪪 My details</h1>
        <p class="lead">Show this to a doctor, nurse or ambulance officer.</p>
        ${any ? `<div class="details">
          ${row('Name', a.fullName || data.person)}
          ${row('Born', born ? `${fmt({ day: 'numeric', month: 'long', year: 'numeric' }, born)} (age ${age})` : '')}
          ${row('Address', a.address)}
          ${row('Health conditions', a.conditions)}
          ${row('Medicines', a.medicines)}
          ${row('Allergies', a.allergies)}
          ${row('Doctor', [a.doctor, a.doctorPhone].filter(Boolean).join(', '))}
          ${row('Good to know', a.notes)}
        </div>` : '<div class="empty">Nothing here yet.<p>A family member can add your details in Family settings.</p></div>'}
        ${reachable().length ? `<h2 class="section-heading">People to ring</h2>${reachable().map(contactCard).join('')}` : ''}
      </section>`;
  },

  family() {
    if (data.pin && !ui.unlocked) {
      return `
        <section class="content">
          ${backButton()}
          <div class="family-banner"><h2 tabindex="-1" class="page-title">👪 Family settings</h2><p>Enter the family PIN to continue.</p></div>
          <form novalidate data-form="unlock">
            <label class="field">PIN<input name="pin" inputmode="numeric" autocomplete="off" maxlength="8" required data-autofocus></label>
            <button class="primary">Open Family settings</button>
          </form>
          ${ui.forgot ? `<div class="family">
            <h3 tabindex="-1">Forgot the PIN?</h3>
            <form novalidate data-form="restore">
              <label class="field">Restore from a backup copy
                <span class="hint">Paste a copy made earlier with “Make a backup copy”. Everything comes back, and the PIN is cleared.</span>
                <textarea name="backup" rows="3" placeholder="Paste a backup copy here"></textarea></label>
              ${ui.confirming === 'restore'
                ? confirmBox('Replace everything in Hazel on this device with this copy?', 'restore-apply', null, 'Yes, replace', 'No, keep what is here')
                : '<button class="secondary">Restore</button>'}
            </form>
            <div class="divider"></div>
            <form novalidate data-form="erase">
              <label class="field">Or start again from nothing
                <span class="hint">This removes the routine, the people, the details and the PIN from this device. Type ERASE to confirm.</span>
                <input name="word" autocomplete="off" autocapitalize="characters" placeholder="ERASE"></label>
              <button class="delete">Erase Hazel on this device</button>
            </form>
          </div>` : '<button class="skip" data-action="forgot">Forgot the PIN?</button>'}
        </section>`;
    }
    const tabs = [['progress', 'Today'], ['activities', 'Routine'], ['contacts', 'People'], ['about', 'Details'], ['settings', 'Settings']];
    return `
      <section class="content">
        ${backButton()}
        <div class="family-banner"><h2 tabindex="-1" class="page-title">👪 Family settings</h2><p>Set up Hazel for ${esc(data.person || 'someone you care about')}.</p></div>
        ${canStore ? '' : '<div class="notice" role="note"><strong>Changes won’t be kept.</strong> This browser isn’t letting Hazel save, so anything you set up here will be lost when Hazel is closed. Open Hazel in a normal (not private) browser window to keep changes.</div>'}
        ${data.setup ? '' : '<button class="example-banner" data-go="setup"><strong>Hazel is showing an example.</strong> Set it up for your person in a couple of minutes ›</button>'}
        ${readyCard()}
        <div class="tabs" role="tablist">
          ${tabs.map(([key, label]) => `<button role="tab" aria-selected="${ui.tab === key}" data-action="tab" data-tab="${key}">${label}</button>`).join('')}
        </div>
        ${(familyPanels[ui.tab] || familyPanels.progress)()}
      </section>`;
  },

  activityForm() {
    const a = findActivity(ui.id);
    const repeat = a?.repeat || 'daily';
    const photo = ui.photo ?? a?.photo ?? '';
    return `
      <section class="content">
        ${backButton('family', 'Back to Family settings')}
        <h1 class="page-title" tabindex="-1">${a ? 'Edit' : 'Add something to the day'}</h1>
        ${a ? '' : `<div class="quick" role="group" aria-label="Quick start">
          <button type="button" class="edit" data-action="template" data-kind="tablets">💊 Tablets</button>
          <button type="button" class="edit" data-action="template" data-kind="appointment">🩺 Appointment</button>
          <button type="button" class="edit" data-action="template" data-kind="weekly">🗑️ A weekly thing</button>
        </div>`}
        <form novalidate data-form="activity">
          <label class="field">What is it?<input name="title" maxlength="70" value="${esc(a?.title)}" placeholder="e.g. Morning tablets, Podiatrist, Bin night" required></label>
          <label class="field">Time<input type="time" name="time" value="${esc(a?.time || '10:00')}" required></label>
          <fieldset class="field">
            <legend>When</legend>
            <div class="choices text-choices">
              ${[['daily', 'Every day'], ['weekly', 'Some days'], ['once', 'One day only']].map(([v, l]) =>
                `<label><input type="radio" name="repeat" value="${v}" ${repeat === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
            </div>
            <div class="choices text-choices when-weekly" ${repeat === 'weekly' ? '' : 'hidden'}>
              ${DAY_ORDER.map(d => `<label><input type="checkbox" name="days" value="${d}" ${a?.days?.includes(d) ? 'checked' : ''}><span>${DAY_NAMES[d]}</span></label>`).join('')}
            </div>
            <label class="field when-once" ${repeat === 'once' ? '' : 'hidden'}>Date<input type="date" name="date" value="${esc(a?.date)}" min="${dayKey()}"></label>
          </fieldset>
          <label class="field">Give a warning beforehand
            <span class="hint">For appointments: Hazel also says it is coming up, so there is time to get ready.</span>
            <select name="lead">${[[0, 'No, just at the time'], [30, '30 minutes before'], [60, '1 hour before'], [120, '2 hours before']].map(([v, l]) =>
              `<option value="${v}" ${(a?.lead || 0) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field">Friendly instructions
            <span class="hint">Short and kind works best. Hazel reads this aloud. For tablets, say which ones and where they are kept.</span>
            <textarea name="note" rows="3" maxlength="220" placeholder="e.g. Take the tablets in today's box with a glass of water">${esc(a?.note)}</textarea>
          </label>
          <label class="toggle"><input type="checkbox" name="must" ${a?.must ? 'checked' : ''}><span><b>Important: keep reminding</b><small>For tablets and anything that must not be missed. Hazel repeats the reminder for an hour, then keeps it at the top of the home screen until it is ticked.</small></span></label>
          ${pictureChoices('emoji', ACTIVITY_PICTURES, a?.emoji || ACTIVITY_PICTURES[0])}
          ${photoPicker(photo, 'A photo of the real thing (the tablet box, the front door) is easier to recognise.')}
          ${data.contacts.some(c => c.phone) ? `<label class="field">Add a call button for
            <span class="hint">For things like “Ring Sarah” or a doctor's phone appointment.</span>
            <select name="contactId"><option value="">Nobody</option>${data.contacts.filter(c => c.phone).map(c =>
              `<option value="${c.id}" ${a?.contactId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>` : ''}
          <button class="primary">Save</button>
        </form>
      </section>`;
  },

  contactForm() {
    const c = findContact(ui.id);
    const photo = ui.photo ?? c?.photo ?? '';
    return `
      <section class="content">
        ${backButton('family', 'Back to Family settings')}
        <h1 class="page-title" tabindex="-1">${c ? 'Edit person' : 'Add a person'}</h1>
        <form novalidate data-form="contact">
          <label class="field">Name<input name="name" maxlength="45" value="${esc(c?.name)}" placeholder="e.g. Sarah" required></label>
          <label class="field">Who they are<input name="relation" maxlength="45" value="${esc(c?.relation)}" placeholder="e.g. Daughter, Neighbour, Doctor"></label>
          <label class="field">Phone number
            <span class="hint">People without a number are not shown on the Call screen.</span>
            <input name="phone" value="${esc(c?.phone)}" inputmode="tel" autocomplete="off" placeholder="e.g. 0412 345 678"></label>
          <fieldset class="field">
            <legend>How Hazel calls them</legend>
            <span class="hint">A tablet without a SIM cannot make ordinary phone calls. On an iPad, FaceTime works over Wi-Fi (a number or an email address). Try it from the Call screen before you leave.</span>
            <div class="choices text-choices">
              ${Object.entries(CALL_METHODS).map(([k, m]) => `<label><input type="radio" name="method" value="${k}" ${(c?.method || 'phone') === k ? 'checked' : ''}><span>${m.label}</span></label>`).join('')}
            </div>
          </fieldset>
          ${photoPicker(photo, 'A real photo of their face is much easier to recognise than a picture.')}
          ${pictureChoices('emoji', CONTACT_PICTURES, c?.emoji || CONTACT_PICTURES[CONTACT_PICTURES.length - 1], 'Or a picture')}
          <button class="primary">Save person</button>
        </form>
      </section>`;
  },

  setup() {
    return `
      <section class="content">
        ${backButton()}
        <div class="family-banner"><h2 tabindex="-1" class="page-title">Set up Hazel</h2><p>A couple of minutes now. You can change or add anything later in Family settings.</p></div>
        <form novalidate data-form="setup">
          <h3 class="step">1. Who is Hazel for?</h3>
          <label class="field">What they like to be called<input name="person" maxlength="35" value="${esc(data.person)}" placeholder="e.g. Mum, Margaret, Pop" required></label>
          <label class="field">Country
            <span class="hint">Sets the emergency number and help lines.</span>
            <select name="region">${regionOptions()}</select>
          </label>

          <h3 class="step">2. People they can call</h3>
          <p class="hint">The first person is the one Hazel suggests when they need help. Add more, and photos, later.</p>
          ${[0, 1, 2].map(i => `<div class="person-row">
            <input name="cname${i}" maxlength="45" placeholder="Name" aria-label="Person ${i + 1} name">
            <input name="crel${i}" maxlength="45" placeholder="${['Daughter', 'Son', 'Neighbour'][i]}" aria-label="Person ${i + 1}, who they are">
            <input name="cphone${i}" type="tel" placeholder="Phone number" aria-label="Person ${i + 1} phone number">
          </div>`).join('')}

          <h3 class="step">3. Their day</h3>
          <p class="hint">Tick what fits and set the times. Hazel chimes and speaks at each one.</p>
          ${ROUTINES.map(r => `<div class="routine-row">
            <label><input type="checkbox" name="r-${r.key}" ${r.on ? 'checked' : ''}><span>${r.emoji} ${r.title}</span></label>
            <input type="time" name="t-${r.key}" value="${r.time}" aria-label="Time for ${r.title}">
          </div>`).join('')}
          <h3 class="step">4. Keep it safe</h3>
          <label class="field">Family PIN
            <span class="hint">Recommended. Stops the settings being changed by accident. 4 to 8 digits, or leave blank.</span>
            <input name="pin" inputmode="numeric" maxlength="8" placeholder="e.g. 2468" autocomplete="off"></label>
          ${TIPS}
          <button class="primary">Start using Hazel</button>
        </form>
        <button class="skip" data-action="skip-setup">Keep the example and edit it myself</button>
        <div class="family">
          <h3>Already set up before?</h3>
          <form novalidate data-form="restore">
            <label class="field">Restore from a backup copy
              <span class="hint">If this device was replaced or cleared, paste the copy you kept and everything comes back.</span>
              <textarea name="backup" rows="3" placeholder="Paste a backup copy here"></textarea></label>
            ${ui.confirming === 'restore'
              ? confirmBox('Replace the example with this copy?', 'restore-apply', null, 'Yes, restore it', 'No')
              : '<button class="secondary">Restore</button>'}
          </form>
        </div>
      </section>`;
  },
};

// What is still missing before the family can rely on Hazel. Shown above the tabs until all done.
function readyCard() {
  const checks = [
    [!!helper(), 'Someone to call, with a number that works from this device', 'People'],
    [!!(data.about.fullName && data.about.address), 'Full name and address, for an emergency', 'Details'],
    [data.activities.length > 0, 'At least one thing in the routine', 'Routine'],
    [!!data.backedUp, 'A backup copy made and kept somewhere safe', 'Settings'],
  ];
  if (!data.setup || checks.every(c => c[0])) return '';
  return `<div class="family ready">
    <h3>Is Hazel ready?</h3>
    ${checks.map(([ok, label, tab]) => `<div class="check ${ok ? 'yes' : ''}"><span aria-hidden="true">${ok ? '✓' : '○'}</span><span>${label}${ok ? '' : ` <b>(${tab} tab)</b>`}</span></div>`).join('')}
    <p class="tiny">Emergency number on this device: <b>${region().emergency}</b> (${region().name}). Change the country in Settings if that is wrong.</p>
  </div>`;
}

const familyPanels = {
  progress() {
    const mark = (a, d, isToday) => {
      const at = data.completed[dayKey(d)]?.[a.id];
      if (at !== undefined) return `<span class="ok">✓ ${at ? timeText(at) : 'ticked'}</span>`;
      const back = data.undone[dayKey(d)]?.[a.id];
      const taken = back ? `<small class="taken-back">ticked${back.was ? ' ' + timeText(back.was) : ''}, taken back ${timeText(back.at)}</small>` : '';
      if (!isToday) return `<span class="missed-tag">Not ticked</span>${taken}`;
      if (back) return `<span class="missed-tag">Not ticked</span>${taken}`;
      const st = statusOf(a);
      return st === 'earlier' ? '<span class="missed-tag">Not ticked</span>' : st === 'now' ? '<span class="now-tag">Due now</span>' : timeText(a.time);
    };
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = daysAgo(i);
      const rec = dayRecord(d);
      if (!rec.planned.length) continue;
      const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : fmt({ weekday: 'long', day: 'numeric', month: 'short' }, d);
      days.push(`<details class="day-record" ${i === 0 ? 'open' : ''}>
        <summary><b>${label}</b><span class="progress-time">${rec.done.length} of ${rec.planned.length}</span>
          ${rec.missed.length ? `<span class="missed">Not ticked: ${rec.missed.map(a => esc(a.title)).join(', ')}</span>` : ''}</summary>
        ${rec.planned.map(a => `<div class="progress"><span>${esc(a.emoji)} ${esc(a.title)}${a.must ? ' <span class="must-tag">important</span>' : ''}</span><span class="progress-time">${mark(a, d, i === 0)}</span></div>`).join('')}
      </details>`);
    }
    return `
      <div class="family">
        <h3 tabindex="-1">A note on the home screen</h3>
        <form novalidate data-form="note">
          <label class="field">Your message
            <span class="hint">Shown on Hazel's first screen and read aloud when tapped. Leave blank for no note.</span>
            <textarea name="text" rows="2" maxlength="200" placeholder="e.g. I'll come over on Saturday afternoon. Love you.">${esc(data.note.text)}</textarea>
          </label>
          <label class="field">From<input name="from" maxlength="45" value="${esc(data.note.from)}" placeholder="e.g. Sarah"></label>
          <label class="field">Show until
            <span class="hint">Optional. The note takes itself down after this day, so the screen is never out of date.</span>
            <input type="date" name="until" value="${esc(data.note.until)}" min="${dayKey()}"></label>
          <button class="primary">Save note</button>
        </form>
      </div>
      <div class="family">
        <h3>What was ticked, and when</h3>
        ${days.join('') || '<p class="muted">Nothing planned yet.</p>'}
        <button class="secondary" data-action="summary">Copy the last 7 days as text</button>
        ${ui.summary ? `<textarea class="copy-box" rows="6" readonly aria-label="Summary of the last 7 days">${esc(ui.summary)}</textarea>` : ''}
        <p class="tiny">A tick is recorded when someone taps “I’ve done this”. Hazel can’t check that it really happened. Past days are shown against the routine as it is today.</p>
      </div>`;
  },

  activities() {
    const row = a => manageRow(a.photo ? photoThumb(a.photo) : esc(a.emoji), `${timeText(a.time)} · ${a.title}`, 'activity', a.id, esc(scheduleText(a)), a.title);
    const regular = data.activities.filter(a => a.repeat !== 'once').sort(byTime);
    const dated = data.activities.filter(a => a.repeat === 'once').sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b));
    return `
      <div class="family">
        <h3 tabindex="-1">The routine</h3>
        ${regular.map(row).join('') || '<p class="muted">Nothing yet.</p>'}
        ${dated.length ? `<h3 style="margin-top:20px">Appointments and one-off days</h3>${dated.map(row).join('')}` : ''}
        <button class="primary" data-go="activityForm">+ Add something</button>
        <p class="tiny">Use “One day only” for appointments, and “Some days” for things like bin night.</p>
      </div>`;
  },

  contacts() {
    return `
      <div class="family">
        <h3 tabindex="-1">People to call</h3>
        <p class="tiny" style="margin-top:0">The first person with a phone number is the one Hazel offers on the Get Help screen.</p>
        ${data.contacts.map((c, i) => manageRow(c.photo ? photoThumb(c.photo) : esc(c.emoji), c.name, 'contact', c.id,
          `${esc(c.relation)}${c.phone ? ' · ' + esc(c.phone) : ' · <strong>no phone number yet</strong>'}`, c.name,
          i > 0 ? `<button class="edit" data-action="contact-up" data-id="${c.id}" aria-label="Move ${esc(c.name)} up">↑</button>` : '')).join('')}
        <button class="primary" data-go="contactForm">+ Add a person</button>
      </div>`;
  },

  about() {
    const a = data.about;
    const field = (name, label, attrs = '', hint = '') => `<label class="field">${label}${hint ? `<span class="hint">${hint}</span>` : ''}<input name="${name}" value="${esc(a[name])}" maxlength="300" ${attrs}></label>`;
    const area = (name, label, placeholder) => `<label class="field">${label}<textarea name="${name}" rows="2" maxlength="600" placeholder="${placeholder}">${esc(a[name])}</textarea></label>`;
    return `
      <div class="family">
        <h3 tabindex="-1">Details for an emergency</h3>
        <p class="tiny" style="margin-top:0">Anyone holding this device can read these under Get Help, My details. That is the point: a paramedic or nurse can see them. Only add what you are happy for a helper to see. Their name and address are also shown on the Emergency screen, so they know what to tell the operator.</p>
        <form novalidate data-form="about">
          ${field('fullName', 'Full name', 'placeholder="e.g. Margaret Anne Wilson"')}
          ${field('dob', 'Date of birth', 'type="date"')}
          ${area('address', 'Home address', 'e.g. 12 Wattle Street, Bendigo VIC 3550')}
          ${area('conditions', 'Health conditions', 'e.g. High blood pressure, type 2 diabetes, hearing aid in left ear')}
          ${area('medicines', 'Medicines', 'e.g. Perindopril 5 mg in the morning. Metformin 500 mg morning and night.')}
          ${area('allergies', 'Allergies', 'e.g. Penicillin')}
          ${field('doctor', "Doctor's name and practice", 'placeholder="e.g. Dr Patel, Lakeside Medical"')}
          ${field('doctorPhone', "Doctor's phone", 'type="tel"')}
          ${area('notes', 'Good to know', 'e.g. Spare key with Val next door. Speaks Greek at home.')}
          <button class="primary">Save details</button>
        </form>
      </div>`;
  },

  settings() {
    const check = (name, label, hint) => `<label class="toggle"><input type="checkbox" name="${name}" ${data[name] ? 'checked' : ''}><span><b>${label}</b><small>${hint}</small></span></label>`;
    return `
      <div class="family">
        <h3 tabindex="-1">Settings</h3>
        <form novalidate data-form="settings">
          <label class="field">What they like to be called<input name="person" value="${esc(data.person)}" maxlength="35" placeholder="e.g. Mum"></label>
          <label class="field">Country
            <span class="hint">Sets the emergency number (${region().emergency}) and help lines.</span>
            <select name="region">${regionOptions()}</select>
          </label>
          <fieldset class="field">
            <legend>Writing size</legend>
            <div class="choices text-choices">
              ${[['normal', 'Normal'], ['large', 'Large'], ['largest', 'Largest']].map(([v, l]) =>
                `<label><input type="radio" name="size" value="${v}" ${data.size === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
            </div>
          </fieldset>
          <div class="pair">
            <label class="field">Bed time<input type="time" name="nightFrom" value="${esc(data.nightFrom)}"></label>
            <label class="field">Morning starts<input type="time" name="nightTo" value="${esc(data.nightTo)}"></label>
          </div>
          <p class="hint">Between these times the home screen goes dark and says it is night time.</p>
          ${check('sound', 'Chime and speak reminders', 'When something is due, Hazel chimes, says it aloud and shows it on screen.')}
          <button type="button" class="secondary small" data-action="test-reminder">🔔 Try a reminder now</button>
          ${check('awake', 'Keep the screen on', 'So Hazel can sit on a stand as a clock. Keep the device plugged in.')}
          <label class="field">Family PIN
            <span class="hint">Optional. Stops these settings being opened by accident. Leave blank for no PIN.</span>
            <input name="pin" inputmode="numeric" pattern="\\d{4,8}" maxlength="8" value="${esc(data.pin)}" placeholder="4 to 8 digits" autocomplete="off">
          </label>
          <button class="primary">Save settings</button>
        </form>
      </div>
      ${TIPS}
      <div class="family">
        <h3>Keep a copy</h3>
        <p class="tiny" style="margin-top:0">Everything lives only on this device. Keep a copy so nothing is lost if the device is replaced or the browser is cleared, or to set up a second device the same way.</p>
        <button class="secondary" data-action="backup">Make a backup copy</button>
        ${data.backedUp ? `<p class="tiny">Last copy made ${fmt({ weekday: 'long', day: 'numeric', month: 'long' }, parseDay(data.backedUp))}. Make a new one after you change things.</p>` : ''}
        ${ui.backup ? `<textarea class="copy-box" rows="4" readonly aria-label="Backup copy">${esc(ui.backup)}</textarea>
          <p class="tiny">Paste this into an email or message to yourself and keep it safe. It contains everything in Hazel, including the PIN and any health details.</p>` : ''}
        <form novalidate data-form="restore">
          <label class="field">Restore from a copy<textarea name="backup" rows="3" placeholder="Paste a backup copy here"></textarea></label>
          ${ui.confirming === 'restore'
            ? confirmBox('Replace everything in Hazel on this device with this copy?', 'restore-apply', null, 'Yes, replace', 'No, keep what is here')
            : '<button class="secondary">Restore</button>'}
        </form>
        <div class="divider"></div>
        ${ui.confirming === 'reset'
          ? confirmBox("Clear today's ticks?", 'reset-done', null, 'Yes, clear')
          : `<button class="secondary" data-action="ask" data-confirm="reset">Clear today's ticks</button>`}
        <div class="notice" style="margin-top:14px">Hazel saves information only on this device. Nothing is sent anywhere, and nothing syncs between devices. The PIN is a light lock, not strong security. Reminders only chime while Hazel is open on the screen.</div>
      </div>`;
  },
};

// ---------------------------------------------------------------------------
// Fragments
// ---------------------------------------------------------------------------

function bigTile(color, to, emoji, title, lines = []) {
  return `<button class="big ${color}" data-go="${to}">
    <span class="emoji" aria-hidden="true">${emoji}</span>
    <span><strong>${title}</strong>${lines.filter(Boolean).map(l => (typeof l === 'string'
      ? `<small>${esc(l)}</small>` : `<small class="${l.cls}">${esc(l.text)}</small>`)).join('')}</span>
  </button>`;
}

// The one thing to do now sits at the top of the home screen with its own tick button, so answering
// it is a single tap. An important thing that was missed hours ago is asked about carefully instead.
function attentionCard() {
  const a = attentionItem();
  if (!a) return '';
  const late = minutesLate(a);
  const overdue = late >= 120;
  const friend = helper();
  return `<div class="attention ${overdue ? 'overdue' : ''}">
    <span class="pill now">${late < NOW_WINDOW ? 'Now' : 'From earlier today'}</span>
    <div class="next-head">${thumb(a)}<div><h2>${esc(a.title)}</h2><p>${timeText(a.time)}</p></div></div>
    ${overdue
      ? `<p class="caution">${a.emoji === '💊' ? "Not sure if you've had them? Check your pill box. Don't take extra." : 'Not ticked off yet. Have you done it?'}</p>`
      : a.note ? `<p class="attention-note">${esc(a.note)}</p>` : ''}
    <div class="${overdue && friend ? 'pair' : ''}">
      <button class="primary" data-action="finish" data-id="${a.id}">✓ &nbsp;${overdue ? "Yes, I've done this" : "I've done this"}</button>
      ${overdue && friend ? callLink(friend, 'secondary', `📞 Ask ${esc(friend.name)}`) : ''}
    </div>
  </div>`;
}

function dayTileLines() {
  const list = todays();
  if (!list.length) return [tomorrowLine() || 'Nothing planned today'];
  const night = dayPart() === 'night';
  const shown = attentionItem();
  const next = list.find(a => statusOf(a) === 'upcoming');
  // Nothing is nagged about at bed time.
  const earlier = night ? 0 : earlierNotDone().filter(a => a !== shown).length;
  const main = beforeDawn() ? 'Nothing to do until morning'
    : next ? `Next: ${next.title}, ${timeText(next.time)}`
    : list.every(a => isDone(a.id)) ? 'All done for today 🌷'
    : night ? 'Nothing to do until morning' : 'Nothing else planned today';
  // Anything special later today, the important things already done (with their times), and tomorrow.
  const special = list.find(a => a.repeat !== 'daily' && a !== next && statusOf(a) === 'upcoming');
  const doneMust = list.filter(a => a.must && isDone(a.id)).slice(-2).map(a => ({ cls: 'ok', text: `✓ ${a.title}, ${doneText(a.id).toLowerCase()}` }));
  return [main,
    earlier ? { cls: 'warn', text: `${earlier} from earlier not ticked off yet` } : '',
    special ? `Today: ${special.title}, ${timeText(special.time)}` : '',
    ...lastNight().slice(0, 2).map(x => ({ cls: 'ok', text: '✓ ' + lastNightText(x) })),
    ...doneMust,
    next ? '' : tomorrowLine()];
}

const photoThumb = src => `<img class="mini" src="${esc(src)}" alt="">`;
const thumb = a => `<span class="thumb" aria-hidden="true">${a.photo ? `<img src="${esc(a.photo)}" alt="">` : esc(a.emoji)}</span>`;

function activityItem(a) {
  const status = statusOf(a);
  const label = status === 'done' ? `<span class="done">✓ ${doneText(a.id)}</span>`
    : status === 'now' ? '<span class="pill now">Now</span>'
    : status === 'earlier' ? '<span class="earlier">Not ticked off yet</span>' : '';
  return `<button class="item ${status === 'done' ? 'is-done' : ''}" data-go="activity" data-id="${a.id}">
    <span class="time">${timeText(a.time)}</span>
    ${thumb(a)}
    <span class="name">${esc(a.title)}${label}</span>
    <span class="chevron" aria-hidden="true">›</span>
  </button>`;
}

// The whole card is the button: a big target for an unsteady hand.
function contactCard(c) {
  const inner = `
    <span class="face" aria-hidden="true">${c.photo ? `<img src="${esc(c.photo)}" alt="">` : esc(c.emoji)}</span>
    <span class="who">${esc(c.name)}${c.relation ? `<span class="muted">${esc(c.relation)}</span>` : ''}${c.phone ? `<span class="muted phone">${esc(c.phone)}</span>` : '<span class="muted">No number yet</span>'}</span>
    <span class="call ${c.phone ? '' : 'missing'}" aria-hidden="true">${c.phone ? CALL_METHODS[c.method].verb : '—'}</span>`;
  return c.phone
    ? `<a class="contact" href="${esc(callHref(c))}" data-number="${esc(c.phone)}" data-name="${esc(c.name)}" aria-label="${CALL_METHODS[c.method].verb} ${esc(c.name)}${c.relation ? ', ' + esc(c.relation) : ''}">${inner}</a>`
    : `<button class="contact" data-action="no-phone" data-id="${c.id}" aria-label="${esc(c.name)}, no phone number yet">${inner}</button>`;
}

function manageRow(iconHtml, label, kind, id, detailHtml = '', name = label, extraHtml = '') {
  if (ui.confirming === `${kind}:${id}`) {
    return confirmBox(`Remove ${name}?`, `remove-${kind}`, id, 'Yes, remove');
  }
  return `<div class="row">
    <span class="row-emoji" aria-hidden="true">${iconHtml}</span>
    <span class="row-text">${esc(label)}${detailHtml ? `<div class="tiny">${detailHtml}</div>` : ''}</span>
    <span class="row-actions">
      ${extraHtml}
      <button class="edit" data-go="${kind}Form" data-id="${id}" aria-label="Edit ${esc(name)}">Edit</button>
      <button class="delete" data-action="ask" data-confirm="${kind}:${id}" aria-label="Remove ${esc(name)}">Remove</button>
    </span>
  </div>`;
}

function confirmBox(question, action, id, yesLabel, noLabel = 'No, keep it') {
  return `<div class="confirm" role="group" aria-label="${esc(question)}">
    <p>${esc(question)}</p>
    <div class="confirm-actions">
      <button type="button" class="delete" data-action="${action}" ${id != null ? `data-id="${id}"` : ''}>${yesLabel}</button>
      <button type="button" class="edit" data-action="cancel" data-autofocus>${noLabel}</button>
    </div>
  </div>`;
}

function pictureChoices(name, options, selected, legend = 'Picture') {
  if (selected && !options.includes(selected)) options = [selected, ...options];
  return `<fieldset class="field">
    <legend>${legend}</legend>
    <div class="choices">
      ${options.map(e => `<label><input type="radio" name="${name}" value="${esc(e)}" ${e === selected ? 'checked' : ''}><span>${esc(e)}</span></label>`).join('')}
    </div>
  </fieldset>`;
}

function photoPicker(photo, hint) {
  return `<fieldset class="field">
    <legend>Photo</legend>
    <span class="hint">${hint}</span>
    <div class="photo-pick">
      <span class="photo-preview">${photo ? `<img src="${esc(photo)}" alt="Chosen photo">` : '<span aria-hidden="true">📷</span>'}</span>
      <label class="edit file-btn">${photo ? 'Change photo' : 'Choose a photo'}<input type="file" accept="image/*" data-photo class="visually-hidden"></label>
      <button type="button" class="delete" data-action="photo-remove" ${photo ? '' : 'hidden'}>Remove photo</button>
    </div>
  </fieldset>`;
}

const regionOptions = () => Object.entries(REGIONS).map(([k, r]) =>
  `<option value="${k}" ${data.region === k ? 'selected' : ''}>${r.name}${k === 'other' ? '' : ` (${r.emergency})`}</option>`).join('');

function weekSummaryText() {
  const lines = [`Hazel summary${data.person ? ' for ' + data.person : ''}, week to ${fmt({ weekday: 'short', day: 'numeric', month: 'short' })}`];
  for (let i = 0; i < 7; i++) {
    const d = daysAgo(i);
    const rec = dayRecord(d);
    if (!rec.planned.length) continue;
    const done = data.completed[dayKey(d)] || {};
    const important = rec.done.filter(a => a.must).map(a => `${a.title}${done[a.id] ? ' ' + timeText(done[a.id]) : ''}`);
    lines.push(`${fmt({ weekday: 'short', day: 'numeric', month: 'short' }, d)}: ${rec.done.length} of ${rec.planned.length} ticked off.`
      + (important.length ? ` Ticked: ${important.join(', ')}.` : '')
      + (rec.missed.length ? ` Not ticked: ${rec.missed.map(a => a.title).join(', ')}.` : ''));
  }
  lines.push('(A tick means someone tapped "I\'ve done this" on Hazel.)');
  return lines.join('\n');
}

function homeSpeech() {
  const next = focusActivity();
  const earlier = earlierNotDone();
  return [
    `${greeting()}.`,
    `It is ${clockText()}, ${partLine()}, ${fmt({ day: 'numeric', month: 'long' })}.`,
    dayPart() === 'night' ? restMessage() : '',
    noteShown() ? `A note${data.note.from ? ' from ' + data.note.from : ''}: ${data.note.text}.` : '',
    beforeDawn() ? '' : next ? (statusOf(next) === 'now' ? `It is time for: ${next.title}.` : `Next is ${next.title}, at ${timeText(next.time)}.`) : '',
    earlier.length && dayPart() !== 'night' ? `Not ticked off from earlier: ${earlier.map(a => a.title).join(', ')}.` : '',
    next ? '' : tomorrowLine(),
  ].filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

// `focus` is a selector for the element that should have focus afterwards, so
// keyboard and screen-reader users don't get dropped back to the top of the page.
function render(focus) {
  let screen = screens[ui.screen] ? ui.screen : 'home';
  // Edit forms sit behind the family PIN, even when reached with the Back button.
  if (data.pin && !ui.unlocked && needsPin(screen)) screen = 'family';
  app.dataset.screen = screen;
  // At night every screen the person uses is dark, so the device is not a lamp at 2 am.
  app.toggleAttribute('data-night', dayPart() === 'night' && screen !== 'family' && !FORM_SCREENS.includes(screen));
  app.innerHTML = screens[screen]() + '<div class="foot">Hazel 🌿 A brighter day, one step at a time.</div>';
  lastLive = liveText();
  const target = app.querySelector('[data-autofocus]') || (focus && app.querySelector(focus));
  target?.focus({ preventScroll: true });
}

// Everything on Home and My Day that changes with the time of day.
let lastLive = '';
function liveText() {
  const top = attentionItem();
  const late = top ? minutesLate(top) : 0;
  return [dayKey(), greeting(), partLine(), top?.id, late >= NOW_WINDOW, late >= 120, noteShown(), tomorrowLine(),
    lastNight().length, todays().map(a => a.id + statusOf(a) + tooEarly(a)).join()].join('|');
}

// ---------------------------------------------------------------------------
// Sheets: a card that fills the screen for a reminder, a "well done", or a number to dial
// ---------------------------------------------------------------------------

const promptEl = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'prompt', hidden: true }));
let sheet = null; // what is showing: { kind: 'reminder' | 'done' | 'call', returnFocus, timer }

function openSheet(kind, html, focusSelector) {
  const returnFocus = sheet ? sheet.returnFocus : document.activeElement;
  if (sheet) clearTimeout(sheet.timer);
  sheet = { kind, returnFocus };
  if (kind !== 'reminder') reminder = null;
  promptEl.innerHTML = `<div class="prompt-card sheet-${kind}" role="${kind === 'reminder' ? 'alertdialog' : 'dialog'}" aria-modal="true" aria-labelledby="sheet-title">${html}</div>`;
  promptEl.hidden = false;
  app.inert = true; // keep taps and the Tab key inside the sheet
  guard(1000); // a tap already on its way must not answer a card that has only just appeared
  promptEl.querySelector(focusSelector)?.focus({ preventScroll: true });
}

function closeSheet() {
  if (!sheet) return;
  clearTimeout(sheet.timer);
  const back = sheet.returnFocus;
  sheet = null;
  reminder = null;
  app.inert = false;
  promptEl.hidden = true;
  promptEl.innerHTML = '';
  hush();
  guard(500);
  if (back?.isConnected) back.focus({ preventScroll: true });
  else focusHeading();
}

// After a tick: say plainly what was recorded and when, with a way to take it back.
function showDone(a) {
  const left = todays().filter(x => !isDone(x.id)).length;
  openSheet('done', `
    <div class="done-tick" aria-hidden="true">✓</div>
    <h2 id="sheet-title">Well done</h2>
    <p class="prompt-note"><b>${esc(a.title)}</b><br>${doneText(a.id)}${left ? '' : '<br>That is everything for today 🌷'}</p>
    <button class="primary" data-action="sheet-close">OK</button>
    <button class="skip" data-action="sheet-undo" data-id="${a.id}">Oops, I haven't done it yet</button>`, '.primary');
  sheet.timer = setTimeout(closeSheet, 6000);
}

// Some devices can't start a call from a web page. The link still tries, and the number stays on
// screen in large print until it is dismissed, so it can be dialled by hand.
function showCalling(link) {
  const number = link.dataset.number;
  const emergency = 'emergency' in link.dataset;
  const name = data.about.fullName || data.person;
  openSheet('call', `
    ${emergency ? '' : '<div class="prompt-pic" aria-hidden="true">📞</div>'}
    <h2 id="sheet-title">Calling ${esc(link.dataset.name || number)}</h2>
    <p class="prompt-note">If the call does not start, dial this on your phone:</p>
    <p class="big-number">${esc(number)}</p>
    ${emergency ? `<div class="say-card">
      <strong>Tell them</strong>
      ${name ? `<p>My name is <b>${esc(name)}</b>.</p>` : ''}
      ${data.about.address ? `<p>I am at <b>${esc(data.about.address)}</b>.</p>` : '<p>Where you are, and what has happened.</p>'}
      <p>Stay on the phone. They will tell you what to do.</p>
    </div>` : ''}
    <button class="primary" data-action="sheet-close">OK</button>`, '.primary');
  // Left alone, it goes away by itself so the clock and reminders come back.
  sheet.timer = setTimeout(closeSheet, (emergency ? 30 : 5) * 60_000);
}

// ---------------------------------------------------------------------------
// Reminders: when something is due, Hazel chimes, says it aloud and shows it
// ---------------------------------------------------------------------------

const LATE_WINDOW = 15; // minutes after its time that opening Hazel still raises the reminder
const SNOOZE_MINUTES = 10;
const MUST_WINDOW = 60; // minutes an important reminder keeps coming back before it rests on the home screen
const QUIET_SCREENS = ['family', 'about', 'calm', ...FORM_SCREENS]; // never interrupted by a reminder
const prompted = {}; // activity id -> day it was last raised
const snoozed = {}; // activity id -> { at: time in ms to raise it again, day }
let reminder = null; // the reminder on screen: { id, announced, nextAnnounce }

// The reminder to raise now, if any. Important things go first.
function dueReminder(onlyImportant = false) {
  const today = dayKey();
  const due = todays().filter(a => {
    if (isDone(a.id) || (onlyImportant && !a.must)) return false;
    const late = minutesLate(a);
    const snooze = snoozed[a.id];
    if (snooze?.day === today) {
      if (Date.now() < snooze.at) return false;
      return a.must ? late >= 0 && late < MUST_WINDOW : statusOf(a) === 'now';
    }
    return late >= 0 && late < LATE_WINDOW && prompted[a.id] !== today;
  });
  return due.find(a => a.must) || due[0];
}

// Chime, then say it. Important things are repeated: after 3 minutes, at 10, then every 10.
function announce(a) {
  chime();
  if (data.sound && armed) {
    setTimeout(() => {
      if (reminder?.id === a.id) speak(`It is ${clockText()}. Time for: ${a.title}. ${a.note}`, { quiet: true });
    }, 1200);
  }
  const gaps = a.must ? [3, 7, 10, 10, 10, 10] : [3];
  const gap = gaps[reminder.announced++];
  reminder.nextAnnounce = gap ? Date.now() + gap * 60_000 : Infinity;
}

function openReminder(a) {
  prompted[a.id] = dayKey();
  delete snoozed[a.id];
  openSheet('reminder', `
      <div class="prompt-pic" aria-hidden="true">${a.photo ? `<img src="${esc(a.photo)}" alt="">` : esc(a.emoji)}</div>
      <p class="prompt-when">It's ${clockText()}. Time for:</p>
      <h2 id="sheet-title">${esc(a.title)}</h2>
      ${a.note ? `<p class="prompt-note">${esc(a.note)}</p>` : ''}
      <button class="primary" data-action="prompt-done" data-id="${a.id}">✓ &nbsp;I've done this</button>
      <button class="secondary" data-action="prompt-snooze" data-id="${a.id}">Remind me in ${SNOOZE_MINUTES} minutes</button>
      ${a.must ? '' : '<button class="skip" data-action="sheet-close">Not now</button>'}`, '.primary');
  reminder = { id: a.id, announced: 0, nextAnnounce: 0 };
  announce(a);
}

function checkReminders() {
  if (sheet && sheet.kind !== 'reminder') return;
  if (reminder) {
    const a = findActivity(reminder.id);
    // Take it down once it has been done elsewhere or its time has passed. It then shows as not
    // ticked off; an important one stays at the top of the home screen.
    const late = a ? minutesLate(a) : -1;
    const over = !a || !occursOn(a) || isDone(a.id) || late < 0 || (a.must ? late >= MUST_WINDOW : statusOf(a) !== 'now');
    if (over) return closeSheet();
    // An important reminder takes the place of an ordinary one that is still waiting for an answer.
    const urgent = a.must ? null : dueReminder(true);
    if (urgent) return openReminder(urgent);
    if (Date.now() >= reminder.nextAnnounce) announce(a);
    return;
  }
  // An example routine must never chime as if it were real.
  if (!data.setup || QUIET_SCREENS.includes(ui.screen)) return;
  const due = dueReminder();
  if (due) return openReminder(due);
  const ahead = dueHeadsUp();
  if (ahead) openHeadsUp(ahead);
}

// "At 2:00 pm today: Podiatrist". An earlier warning for appointments, so there is time to get ready.
function dueHeadsUp() {
  const today = dayKey();
  return todays().find(a => {
    const until = -minutesLate(a);
    return a.lead && !isDone(a.id) && until > 0 && until <= a.lead && a.lead - until < LATE_WINDOW && prompted['ahead' + a.id] !== today;
  });
}
function openHeadsUp(a) {
  prompted['ahead' + a.id] = dayKey();
  openSheet('ahead', `
      <div class="prompt-pic" aria-hidden="true">${a.photo ? `<img src="${esc(a.photo)}" alt="">` : esc(a.emoji)}</div>
      <p class="prompt-when">It's ${clockText()}. Coming up at ${timeText(a.time)}:</p>
      <h2 id="sheet-title">${esc(a.title)}</h2>
      ${a.note ? `<p class="prompt-note">${esc(a.note)}</p>` : ''}
      <button class="primary" data-action="sheet-close">OK</button>`, '.primary');
  chime();
  if (data.sound && armed) setTimeout(() => speak(`It is ${clockText()}. Coming up at ${timeText(a.time)}: ${a.title}. ${a.note}`, { quiet: true }), 1200);
  sheet.timer = setTimeout(closeSheet, 10 * 60_000);
}

// Lets the family hear and see a reminder while they are there, to check the volume.
function testReminder() {
  openSheet('test', `
      <div class="prompt-pic" aria-hidden="true">🔔</div>
      <p class="prompt-when">It's ${clockText()}. Time for:</p>
      <h2 id="sheet-title">A test reminder</h2>
      <p class="prompt-note">This is how Hazel looks and sounds when something is due. If you could not hear it, turn the volume up.</p>
      <button class="primary" data-action="sheet-close">OK, that works</button>`, '.primary');
  chime();
  if (data.sound) setTimeout(() => speak(`It is ${clockText()}. This is a test reminder from Hazel.`, { quiet: true }), 1200);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function copyText(text, okMessage) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMessage);
  } catch {
    const box = app.querySelector('.copy-box');
    box?.focus();
    box?.select();
    toast('Press and hold the text in the box, then choose Copy.');
  }
}

const actions = {
  tab(el) {
    Object.assign(ui, { tab: el.dataset.tab, confirming: null, backup: '', restore: null, summary: '' });
    dirty = false;
    render('[role="tab"][aria-selected="true"]');
  },
  ask(el) {
    ui.confirming = el.dataset.confirm;
    render();
    guard();
  },
  cancel() {
    const was = ui.confirming;
    ui.confirming = null;
    ui.restore = null;
    render(`[data-confirm="${was}"]`);
  },
  finish(_, id) {
    const a = findActivity(id);
    if (!a) return;
    markDone(id);
    if (!save()) toast(NOT_SAVED);
    if (ui.screen === 'activity') {
      // Activities are opened from My Day, so step back to that entry rather than adding another.
      let fromDay = false;
      try { fromDay = history.state?.screen === 'activity'; } catch { /* ignore */ }
      if (fromDay) history.back();
      else go('day', null, { replace: true });
    } else {
      render('h1, .page-title');
    }
    showDone(a);
  },
  undo(_, id) {
    const was = doneAt(id);
    if (was === undefined) return;
    // Keep a note for the family that a tick was taken back, and when.
    (data.undone[dayKey()] ??= {})[id] = { was, at: nowHHMM() };
    delete data.completed[dayKey()][id];
    ui.confirming = null;
    if (!save()) toast(NOT_SAVED);
    render('[data-action="finish"]');
    guard();
  },
  'prompt-done'(_, id) {
    const a = findActivity(id);
    if (!a) return closeSheet();
    markDone(id);
    if (!save()) toast(NOT_SAVED);
    render();
    showDone(a);
  },
  'prompt-snooze'(_, id) {
    snoozed[id] = { at: Date.now() + SNOOZE_MINUTES * 60_000, day: dayKey() };
    closeSheet();
    toast(`Okay. Hazel will remind you again in ${SNOOZE_MINUTES} minutes.`);
  },
  'sheet-close'() {
    closeSheet();
  },
  'sheet-undo'(_, id) {
    delete data.completed[dayKey()]?.[id];
    if (!save()) toast(NOT_SAVED);
    closeSheet();
    render();
  },
  'test-reminder'() {
    testReminder();
  },
  'toast-action'() {
    const run = toastRun;
    toastRun = null;
    document.getElementById('toast').hidden = true;
    run?.();
  },
  'speak-activity'(el, id) {
    const a = findActivity(id);
    if (a) speak(`${a.title}. ${a.note}${occursOn(a) && isDone(a.id) ? '. ' + doneText(a.id) + '.' : ''}`, { el });
  },
  'read-day'(el) {
    const list = todays();
    const soon = comingUp()[0];
    const say = (label, items, f) => (items.length ? `${label}: ${items.map(f).join(', ')}.` : '');
    speak([
      `It is ${clockText()}, ${partLine()}.`,
      ...lastNight().map(x => lastNightText(x) + '.'),
      say('Done', list.filter(a => isDone(a.id)), a => `${a.title}${doneAt(a.id) ? ' at ' + timeText(doneAt(a.id)) : ''}`),
      say('Now', list.filter(a => statusOf(a) === 'now'), a => a.title),
      say('Not ticked off from earlier', list.filter(a => statusOf(a) === 'earlier'), a => a.title),
      say('Still to come', list.filter(a => statusOf(a) === 'upcoming'), a => `${a.title} at ${timeText(a.time)}`),
      list.length ? '' : 'Nothing is planned today.',
      soon ? `Coming up: ${soon.a.title}, ${whenText(soon.date)} at ${timeText(soon.a.time)}.` : '',
    ].filter(Boolean).join(' '), { el });
  },
  'read-home'(el) {
    speak(homeSpeech(), { el: el.classList.contains('clock') ? null : el }); // the clock keeps showing the time
  },
  'read-note'() {
    speak(`${data.note.from ? 'A note from ' + data.note.from : 'A note for you'}. ${data.note.text}`);
  },
  'speak-calm'(el) {
    speak(`${dayPart() === 'night' ? CALM_NIGHT : CALM_MESSAGE} It is ${clockText()}, ${partLine()}.`, { el });
  },
  bigger() {
    const sizes = ['normal', 'large', 'largest'];
    data.size = sizes[(sizes.indexOf(data.size) + 1) % sizes.length];
    applySettings();
    if (!save()) toast(NOT_SAVED);
    render('[data-action="bigger"]');
  },
  'no-phone'(_, id) {
    const c = findContact(id);
    if (c) toast(`${c.name} has no phone number yet. A family member can add it in Family settings.`);
  },
  'contact-up'(_, id) {
    const i = data.contacts.findIndex(c => c.id === id);
    if (i > 0) [data.contacts[i - 1], data.contacts[i]] = [data.contacts[i], data.contacts[i - 1]];
    if (!save()) toast(NOT_SAVED);
    render(`[data-action="contact-up"][data-id="${id}"], .family h3`);
  },
  // Fills in the Add form for the commonest kinds of thing, so each takes a few taps.
  template(el) {
    const f = app.querySelector('form[data-form="activity"]');
    const kind = el.dataset.kind;
    const pick = (name, value) => { const input = f.querySelector(`input[name="${name}"][value="${value}"]`); if (input) input.checked = true; };
    f.elements.must.checked = kind === 'tablets';
    f.elements.lead.value = kind === 'appointment' ? '60' : '0';
    pick('repeat', kind === 'appointment' ? 'once' : kind === 'weekly' ? 'weekly' : 'daily');
    pick('emoji', kind === 'tablets' ? '💊' : kind === 'appointment' ? '🩺' : '🗑️');
    f.querySelector('.when-weekly').hidden = kind !== 'weekly';
    f.querySelector('.when-once').hidden = kind !== 'appointment';
    if (!f.elements.title.value) f.elements.title.value = kind === 'tablets' ? 'Morning tablets' : '';
    if (kind === 'tablets') f.elements.time.value = '08:00';
    if (kind === 'tablets' && !f.elements.note.value) f.elements.note.value = 'Take your tablets with a glass of water.';
    dirty = true;
    f.elements.title.focus();
  },
  'photo-remove'() {
    ui.photo = '';
    dirty = true;
    const pick = app.querySelector('.photo-pick');
    pick.querySelector('.photo-preview').innerHTML = '<span aria-hidden="true">📷</span>';
    pick.querySelector('[data-action="photo-remove"]').hidden = true;
    pick.querySelector('.file-btn').firstChild.textContent = 'Choose a photo';
    pick.querySelector('input').value = '';
  },
  'remove-activity'(_, id) {
    const i = data.activities.findIndex(x => x.id === id);
    ui.confirming = null;
    if (i >= 0) {
      const [a] = data.activities.splice(i, 1);
      const tick = data.completed[dayKey()]?.[id];
      delete data.completed[dayKey()]?.[id];
      data.setup = true;
      saved(`Removed “${a.title}”.`, { action: { label: 'Put it back', run() {
        data.activities.splice(i, 0, a);
        if (tick !== undefined) (data.completed[dayKey()] ??= {})[id] = tick;
        saved(`“${a.title}” is back.`);
        render('.family h3');
      } } });
    }
    render('.family h3');
  },
  'remove-contact'(_, id) {
    const i = data.contacts.findIndex(x => x.id === id);
    ui.confirming = null;
    if (i >= 0) {
      const [c] = data.contacts.splice(i, 1);
      data.setup = true;
      saved(`Removed ${c.name}.`, { action: { label: 'Put them back', run() {
        data.contacts.splice(i, 0, c);
        saved(`${c.name} is back.`);
        render('.family h3');
      } } });
    }
    render('.family h3');
  },
  'reset-done'() {
    ui.confirming = null;
    delete data.completed[dayKey()];
    saved("Today's ticks have been cleared.");
    render('.family h3');
  },
  summary() {
    ui.summary = weekSummaryText();
    render('[data-action="summary"]');
    copyText(ui.summary, 'Copied. Paste it into a message to the family.');
  },
  backup() {
    data.backedUp = dayKey();
    save();
    ui.backup = BACKUP_PREFIX + JSON.stringify(data);
    render('[data-action="backup"]');
    copyText(ui.backup, 'Copied. Paste it into an email or message to yourself.');
  },
  'restore-apply'() {
    if (!ui.restore) return;
    Object.assign(data, ui.restore);
    Object.assign(ui, { restore: null, confirming: null, unlocked: true });
    applySettings();
    saved('Restored from the copy.');
    if (ui.screen === 'setup') return go('family', null, { replace: true });
    render('.family h3');
  },
  forgot() {
    ui.forgot = true;
    render('.family h3');
  },
  'skip-setup'() {
    data.setup = true;
    ui.unlocked = true;
    if (!save()) toast(NOT_SAVED);
    go('family', null, { replace: true });
  },
};

const forms = {
  unlock(f) {
    if (f.elements.pin.value.trim() !== data.pin) {
      f.elements.pin.value = '';
      return showError(f, 'That PIN is not right. Please try again.', 'pin');
    }
    ui.unlocked = true;
    render();
    focusHeading();
  },
  activity(f) {
    const title = f.elements.title.value.trim();
    if (!title) return showError(f, 'Please say what it is.', 'title');
    const repeat = f.elements.repeat.value || 'daily';
    const days = [...f.querySelectorAll('input[name="days"]:checked')].map(i => Number(i.value));
    const date = f.elements.date.value;
    if (repeat === 'weekly' && !days.length) return showError(f, 'Please choose at least one day of the week.', 'days');
    if (repeat === 'once' && !date) return showError(f, 'Please choose the date.', 'date');
    const existing = findActivity(ui.id);
    const fields = {
      time: f.elements.time.value || '10:00',
      title,
      note: f.elements.note.value.trim(),
      emoji: f.elements.emoji.value || existing?.emoji || ACTIVITY_PICTURES[0],
      photo: ui.photo ?? existing?.photo ?? '',
      repeat,
      days: repeat === 'weekly' ? days : [],
      date: repeat === 'once' ? date : '',
      must: f.elements.must.checked,
      lead: Number(f.elements.lead.value) || 0,
      contactId: f.elements.contactId?.value ? Number(f.elements.contactId.value) : null,
    };
    existing ? Object.assign(existing, fields) : data.activities.push({ id: newId(), ...fields });
    data.setup = true;
    ui.tab = 'activities';
    saved('Saved.');
    history.back();
  },
  contact(f) {
    const name = f.elements.name.value.trim();
    if (!name) return showError(f, 'Please enter a name.', 'name');
    const phone = f.elements.phone.value.trim();
    const method = CALL_METHODS[f.elements.method.value] ? f.elements.method.value : 'phone';
    const emailOk = method !== 'phone' && /^\S+@\S+\.\S+$/.test(phone);
    if (phone && !emailOk && phone.replace(/[^\d]/g, '').length < 3) return showError(f, 'That phone number looks too short.', 'phone');
    const existing = findContact(ui.id);
    const fields = {
      name,
      relation: f.elements.relation.value.trim(),
      phone,
      method,
      emoji: f.elements.emoji.value || existing?.emoji || '💚',
      photo: ui.photo ?? existing?.photo ?? '',
    };
    existing ? Object.assign(existing, fields) : data.contacts.push({ id: newId(), ...fields });
    data.setup = true;
    ui.tab = 'contacts';
    saved('Saved.');
    history.back();
  },
  note(f) {
    data.note = { text: f.elements.text.value.trim(), from: f.elements.from.value.trim(), until: f.elements.until.value };
    dirty = false;
    saved(data.note.text ? 'Note saved. It is on the home screen now.' : 'Note removed.');
    render('form[data-form="note"] .primary');
  },
  about(f) {
    for (const name of ABOUT_FIELDS) data.about[name] = f.elements[name].value.trim();
    dirty = false;
    saved('Details saved.');
    render('form[data-form="about"] .primary');
  },
  settings(f) {
    const pin = f.elements.pin.value.trim();
    if (pin && !/^\d{4,8}$/.test(pin)) return showError(f, 'The PIN must be 4 to 8 digits, or left blank.', 'pin');
    data.person = f.elements.person.value.trim();
    data.region = REGIONS[f.elements.region.value] ? f.elements.region.value : 'au';
    data.size = f.elements.size.value || 'normal';
    data.sound = f.elements.sound.checked;
    data.awake = f.elements.awake.checked;
    if (f.elements.nightFrom.value) data.nightFrom = f.elements.nightFrom.value;
    if (f.elements.nightTo.value) data.nightTo = f.elements.nightTo.value;
    data.pin = pin;
    if (pin) ui.unlocked = true;
    applySettings();
    data.awake ? requestWakeLock() : releaseWakeLock();
    dirty = false;
    saved('Settings saved.');
    render('form[data-form="settings"] .primary');
  },
  restore(f) {
    let parsed = null;
    try {
      const text = f.elements.backup.value.trim();
      parsed = JSON.parse(text.startsWith(BACKUP_PREFIX) ? text.slice(BACKUP_PREFIX.length) : text);
    } catch { /* handled below */ }
    if (!parsed || !Array.isArray(parsed.activities) || !Array.isArray(parsed.contacts)) {
      return showError(f, 'That does not look like a Hazel backup copy. Paste the whole thing, starting with HAZEL-BACKUP.', 'backup');
    }
    // From the "Forgot the PIN?" screen the copy comes back without its PIN.
    ui.restore = normalize({ ...parsed, setup: true, ...(ui.unlocked || !data.pin ? {} : { pin: '' }) }, true);
    ui.confirming = 'restore';
    render();
    guard();
  },
  erase(f) {
    if (f.elements.word.value.trim().toUpperCase() !== 'ERASE') return showError(f, 'Type the word ERASE to confirm.', 'word');
    Object.assign(data, normalize(SEED, false));
    applySettings();
    saved('Hazel has been erased on this device and is showing the example again.');
    go('home', null, { replace: true });
  },
  setup(f) {
    const person = f.elements.person.value.trim();
    if (!person) return showError(f, 'Please say what they like to be called.', 'person');
    const pin = f.elements.pin.value.trim();
    if (pin && !/^\d{4,8}$/.test(pin)) return showError(f, 'The PIN must be 4 to 8 digits, or left blank.', 'pin');
    const contacts = [];
    for (const i of [0, 1, 2]) {
      const name = f.elements['cname' + i].value.trim();
      const phone = f.elements['cphone' + i].value.trim();
      if (!name && !phone) continue;
      if (!name) return showError(f, 'Please give a name for that phone number.', 'cname' + i);
      contacts.push({ id: newId() + i, name, relation: f.elements['crel' + i].value.trim(), phone, method: 'phone', emoji: CONTACT_PICTURES[i], photo: '' });
    }
    const activities = ROUTINES.filter(r => f.elements['r-' + r.key].checked).map((r, i) => ({
      id: newId() + 10 + i, time: f.elements['t-' + r.key].value || r.time, title: r.title, emoji: r.emoji, note: r.note,
      photo: '', repeat: 'daily', days: [], date: '', must: r.emoji === '💊', lead: 0, contactId: null,
    }));
    Object.assign(data, {
      setup: true, person, pin, region: REGIONS[f.elements.region.value] ? f.elements.region.value : 'au',
      contacts, activities, completed: {}, undone: {},
    });
    applySettings();
    try { navigator.storage?.persist?.(); } catch { /* optional */ }
    ui.unlocked = true;
    ui.tab = 'contacts';
    saved('Hazel is ready. Add photos, appointments and emergency details here whenever you like.');
    go('family', null, { replace: true });
  },
};

// Show a form problem next to the Save button without re-rendering, so nothing typed is lost.
function showError(form, message, field) {
  form.querySelector('.error')?.remove();
  form.querySelector('.primary, .secondary, button.delete').insertAdjacentHTML('beforebegin', `<p class="error" role="alert">${esc(message)}</p>`);
  const target = form.elements[field];
  (target instanceof RadioNodeList ? target[0] : target)?.focus();
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

let lastTouch = Date.now();
let dirty = false; // something has been typed into a family form and not saved

document.addEventListener('click', e => {
  arm();
  lastTouch = Date.now();
  // Taps straight after the screen changes are dropped (see guard). Keyboard presses are not taps.
  if (e.detail !== 0 && Date.now() < guardUntil) {
    e.preventDefault();
    return;
  }
  // A call link: let it try to start the call, and put the number on screen in case it can't.
  const call = e.target.closest('a[data-number]');
  if (call) return showCalling(call);

  // Family settings opens with a press and hold, so it isn't wandered into. A plain tap explains.
  const hold = e.target.closest('[data-hold]');
  if (hold) {
    if (held) held = false;
    else if (e.detail === 0) go(hold.dataset.hold);
    else toast('For family: press and hold this button for two seconds.');
    return;
  }
  const el = e.target.closest('[data-go], [data-action]');
  if (!el) return;
  const id = el.dataset.id ? Number(el.dataset.id) : null;
  if (el.dataset.go) return go(el.dataset.go, id);
  actions[el.dataset.action]?.(el, id);
});

const HOLD_MS = 1500;
let holdTimer = null;
let held = false; // the hold has just fired, so the tap that ends it should do nothing
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('[data-hold]');
  if (!el) return;
  held = false;
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => {
    held = true;
    go(el.dataset.hold);
  }, HOLD_MS);
});
for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, () => clearTimeout(holdTimer));
document.addEventListener('contextmenu', e => {
  if (e.target.closest('[data-hold]')) e.preventDefault(); // a long press must not open the browser's menu
});

document.addEventListener('keydown', e => {
  arm();
  lastTouch = Date.now();
  // Escape closes a sheet, except an important reminder, which has to be answered.
  if (e.key === 'Escape' && sheet && !(reminder && findActivity(reminder.id)?.must)) closeSheet();
});

app.addEventListener('submit', e => {
  e.preventDefault();
  forms[e.target.dataset.form]?.(e.target);
});

app.addEventListener('input', () => {
  lastTouch = Date.now();
  dirty = true;
});

app.addEventListener('change', async e => {
  const t = e.target;
  if (t.name === 'repeat') {
    const form = t.form;
    form.querySelector('.when-weekly').hidden = t.value !== 'weekly';
    form.querySelector('.when-once').hidden = t.value !== 'once';
  }
  if (t.name === 'size' && t.checked) { // show the new writing size straight away
    data.size = t.value;
    applySettings();
    save();
  }
  if (t.name === 'emoji' && t.value === '💊' && t.form?.elements.must) t.form.elements.must.checked = true;
  if (t.matches('input[data-photo]') && t.files?.[0]) {
    try {
      ui.photo = await readPhoto(t.files[0]);
      const pick = t.closest('.photo-pick');
      if (!pick?.isConnected) return;
      pick.querySelector('.photo-preview').innerHTML = `<img src="${esc(ui.photo)}" alt="Chosen photo">`;
      pick.querySelector('[data-action="photo-remove"]').hidden = false;
      pick.querySelector('.file-btn').firstChild.textContent = 'Change photo';
    } catch {
      toast('Hazel could not use that file. Please choose a photo.');
    }
  }
});

// The heartbeat: keeps the clock right, raises reminders, and returns an abandoned screen to the clock.
const RESTING_SCREENS = ['day', 'activity', 'contacts', 'help'];
const LIVE_SCREENS = ['home', 'day', 'activity', 'calm'];
function tick() {
  const clock = app.querySelector('.clock');
  if (clock && !clock.dataset.label) clock.textContent = clockText();
  checkReminders();

  const idle = Date.now() - lastTouch;
  if (!sheet && ((RESTING_SCREENS.includes(ui.screen) && idle > 3 * 60_000) || (ui.screen === 'family' && !dirty && idle > 10 * 60_000))) {
    return go('home');
  }
  // Redraw whatever the person may have left showing, so it is never yesterday's answer.
  if (!LIVE_SCREENS.includes(ui.screen) || ui.confirming) return;
  if (liveText() === lastLive) return;
  const ae = document.activeElement;
  const focusKey = ae?.dataset?.go ? `[data-go="${ae.dataset.go}"]${ae.dataset.id ? `[data-id="${ae.dataset.id}"]` : ''}`
    : ae?.dataset?.action ? `[data-action="${ae.dataset.action}"]${ae.dataset.id ? `[data-id="${ae.dataset.id}"]` : ''}`
    : ae && ae !== document.body && app.contains(ae) ? 'h1, .page-title' : null;
  render(focusKey);
  guard(800); // what is under the finger may have just changed
}
setInterval(tick, 15_000);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  requestWakeLock();
  tick();
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

applySettings();
remember({ screen: 'home', id: null }, true);
render();
requestWakeLock();
checkReminders();

// Offline support is optional: it is unavailable from file:// and in some embedded frames.
try {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
} catch { /* ignore */ }
