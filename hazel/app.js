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
// `name` is the short name used on the "Calling" card; `label` is the full line on the Get Help screen.
const REGIONS = {
  au: { name: 'Australia', locale: 'en-AU', emergency: '000', lines: [
    { name: 'Lifeline', label: 'Lifeline. Someone to talk to, any time', number: '13 11 14' },
    { name: '1800MEDICARE', label: '1800MEDICARE. Health advice from a nurse, any time', number: '1800 633 422' }] },
  nz: { name: 'New Zealand', locale: 'en-NZ', emergency: '111', lines: [
    { name: '1737 Need to talk?', label: 'Need to talk? Free call or text, any time', number: '1737' },
    { name: 'Healthline', label: 'Healthline. Health advice from a nurse', number: '0800 611 116' }] },
  uk: { name: 'United Kingdom', locale: 'en-GB', emergency: '999', lines: [
    { name: 'Samaritans', label: 'Samaritans. Someone to talk to, any time', number: '116 123' },
    { name: 'NHS 111', label: 'NHS 111. Health advice (England, Scotland and Wales)', number: '111' }] },
  ie: { name: 'Ireland', locale: 'en-IE', emergency: '112', lines: [
    { name: 'Samaritans', label: 'Samaritans. Someone to talk to, any time', number: '116 123' }] },
  us: { name: 'United States', locale: 'en-US', emergency: '911', lines: [
    { name: '988 Lifeline', label: '988 Lifeline. Someone to talk to, any time', number: '988' }] },
  ca: { name: 'Canada', locale: 'en-CA', emergency: '911', lines: [
    { name: '988 helpline', label: '988 helpline. Someone to talk to, any time', number: '988' }] },
  // The family types the local emergency number; 112 works on mobile phones in most countries.
  other: { name: 'Another country', locale: 'en-GB', emergency: '112', lines: [] },
};

// Common parts of a day, offered during setup so a routine takes seconds to build. The tablets carry no
// instruction of their own: what Hazel says about tablets is only ever what the family has typed and seen.
const ROUTINES = [
  { key: 'am-tablets', time: '08:00', title: 'Morning tablets', emoji: '💊', note: '', on: false },
  { key: 'breakfast', time: '08:30', title: 'Breakfast', emoji: '🍽️', note: 'Time for some breakfast.', on: true },
  { key: 'drink', time: '10:30', title: 'Have a drink', emoji: '☕', note: 'Make yourself a cup of tea or a glass of water.', on: true },
  { key: 'lunch', time: '12:30', title: 'Lunch', emoji: '🍲', note: 'It is time to enjoy your lunch.', on: true },
  { key: 'walk', time: '15:00', title: 'A short walk', emoji: '🌳', note: 'Enjoy some fresh air, if you feel like it.', on: true },
  { key: 'dinner', time: '18:00', title: 'Dinner', emoji: '🍽️', note: 'Time for dinner.', on: true },
  { key: 'pm-tablets', time: '20:00', title: 'Evening tablets', emoji: '💊', note: '', on: false },
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
// How often something happens. 'fortnight' and 'monthly' count from the item's date.
const REPEATS = [['daily', 'Every day'], ['weekly', 'Some days'], ['once', 'One day only'], ['fortnight', 'Every 2 weeks'], ['monthly', 'Every month']];
const DATED_REPEATS = ['once', 'fortnight', 'monthly'];

// What a fresh install shows: an example day, clearly marked, until family sets Hazel up.
// No tablets here: nobody should be shown invented medicine times.
const SEED = {
  setup: false,
  activities: [
    { id: 2, time: '08:30', title: 'Breakfast', emoji: '🍽️', note: 'Time for some breakfast.' },
    { id: 3, time: '10:30', title: 'Have a drink', emoji: '☕', note: 'Make yourself a cup of tea or a glass of water.' },
    { id: 4, time: '12:30', title: 'Lunch', emoji: '🍲', note: 'It is time to enjoy your lunch.' },
    { id: 5, time: '15:00', title: 'A short walk', emoji: '🌳', note: 'Enjoy some fresh air, if you feel like it.' },
    { id: 6, time: '18:00', title: 'Dinner', emoji: '🍽️', note: 'Time for dinner.' },
  ],
  contacts: [
    { id: 1, name: 'Sarah', relation: 'Daughter', phone: '', emoji: '👩' },
    { id: 2, name: 'John', relation: 'Son', phone: '', emoji: '👨' },
    { id: 3, name: 'Dr Patel', relation: 'Doctor', phone: '', emoji: '🧑‍⚕️' },
  ],
};

// A browser without its own time or date picker hands back whatever was typed, so check before keeping it.
const validTime = v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const validDay = v => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v);

const ABOUT_FIELDS = ['fullName', 'dob', 'address', 'conditions', 'medicines', 'allergies', 'doctor', 'doctorPhone', 'notes'];

// Turns anything (old saved data, a pasted backup, nothing at all) into well-formed data.
function normalize(raw, fromStorage) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const str = (v, max = 600) => (typeof v === 'string' ? v.slice(0, max) : '');
  const photo = v => (typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < 400000 ? v : '');
  const timeOr = (v, fallback) => (validTime(v) ? v : fallback);
  const time = v => timeOr(v, '09:00');
  const day = v => (validDay(v) ? v : '');
  const list = v => (Array.isArray(v) ? v : []).filter(x => x && typeof x === 'object');
  const days = v => (v && typeof v === 'object' && !Array.isArray(v) ? Object.entries(v).filter(([key, x]) => day(key) && x && typeof x === 'object') : []);
  // Two things must never share an id, or ticking one would tick the other.
  const ids = () => {
    const seen = new Set();
    return v => {
      let n = Number.isFinite(Number(v)) ? Number(v) : newId();
      while (seen.has(n)) n = newId();
      seen.add(n);
      return n;
    };
  };
  const activityId = ids();
  const contactId = ids();
  const schedule = a => ({
    time: time(a.time),
    repeat: REPEATS.some(r => r[0] === a.repeat) ? a.repeat : 'daily',
    days: Array.isArray(a.days) ? [...new Set(a.days.map(Number).filter(n => n >= 0 && n <= 6))] : [],
    date: day(a.date),
    from: day(a.from), // the day it was added, so earlier days are not reported as missed
  });

  const activities = list(d.activities).map(a => ({
    id: activityId(a.id),
    title: str(a.title, 70) || 'Activity',
    emoji: str(a.emoji, 16) || '🌷',
    note: str(a.note, 220),
    ifLate: str(a.ifLate, 220), // the family's own instruction for when it is well past its time
    photo: photo(a.photo),
    ...schedule(a),
    // Important things (tablets) keep coming back until they are ticked.
    must: typeof a.must === 'boolean' ? a.must : a.emoji === '💊',
    lead: [30, 60, 120].includes(Number(a.lead)) ? Number(a.lead) : 0, // minutes of warning before an appointment
    contactId: a.contactId != null && a.contactId !== '' && Number.isFinite(Number(a.contactId)) ? Number(a.contactId) : null,
  }));
  // Things removed from the routine, kept so the family record of earlier days stays true.
  const retired = list(d.retired).map(r => ({
    id: Number(r.id), title: str(r.title, 70) || 'Activity', emoji: str(r.emoji, 16) || '🌷', must: r.must === true,
    ...schedule(r), removed: day(r.removed), removedAt: validTime(r.removedAt) ? r.removedAt : '',
  })).filter(r => Number.isFinite(r.id) && r.removed);
  const contacts = list(d.contacts).map(c => ({
    id: contactId(c.id),
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
    for (const [key, v] of Object.entries(d.completed)) {
      if (!day(key) || !v || typeof v !== 'object') continue;
      const entries = Array.isArray(v) ? v.map(x => [x, '']) : Object.entries(v);
      completed[key] = Object.fromEntries(entries.map(([k, t]) => [k, validTime(t) ? t : '']));
    }
  }

  // Ticks that were later taken back: { day: { activityId: { was: 'HH:MM', at: 'HH:MM' } } }
  const undone = {};
  if (d.undone && typeof d.undone === 'object') {
    for (const [key, v] of Object.entries(d.undone)) {
      if (!day(key) || !v || typeof v !== 'object') continue;
      undone[key] = Object.fromEntries(Object.entries(v).filter(([, u]) => validTime(u?.at))
        .map(([k, u]) => [k, { was: validTime(u.was) ? u.was : '', at: u.at }]));
    }
  }

  // When Hazel was showing on the screen: { day: [['06:02', '21:40'], ...] }
  const seen = {};
  for (const [key, v] of days(d.seen)) {
    if (Array.isArray(v)) seen[key] = v.filter(x => Array.isArray(x) && validTime(x[0]) && validTime(x[1])).slice(0, 40).map(x => [x[0], x[1]]);
  }
  // When each reminder card was first shown, and whether the chime could sound: { day: { id: { at, sound } } }
  const raised = {};
  for (const [key, v] of days(d.raised)) {
    raised[key] = Object.fromEntries(Object.entries(v).filter(([, r]) => validTime(r?.at)).map(([k, r]) => [k, { at: r.at, sound: r.sound === true }]));
  }

  const about = {};
  for (const f of ABOUT_FIELDS) about[f] = str(d.about?.[f]);

  // Data saved by an older version counts as "set up" once it has been made someone's own.
  const setup = typeof d.setup === 'boolean' ? d.setup : !!fromStorage && (!!str(d.person) || contacts.some(c => c.phone));
  const firstRecord = [...Object.keys(completed), ...Object.keys(undone)].sort()[0];
  const pin = String(d.pin ?? '');
  const emergency = String(d.emergency ?? '');

  return {
    v: 3,
    setup,
    // The day Hazel was set up here. Days before it are never reported as missed.
    since: day(d.since) || (setup ? firstRecord || dayKey() : ''),
    person: str(d.person, 35),
    region: REGIONS[d.region] ? d.region : guessRegion() || 'other',
    emergency: /^\d{2,6}$/.test(emergency) ? emergency : '', // the local number, when the country is not in the list
    // Has the family confirmed the country? Earlier versions could choose one by themselves, so data
    // saved without this answer is asked about once, unless the device's own time zone agrees.
    regionOk: typeof d.regionOk === 'boolean' ? d.regionOk : !(setup && guessRegion() !== d.region),
    calls: ['yes', 'no'].includes(d.calls) ? d.calls : '', // can this device make an ordinary phone call? '' = not tried yet
    tell: d.tell === true, // offer a ready-written text message to the first person
    size: ['normal', 'large', 'largest'].includes(d.size) ? d.size : 'normal',
    pin: /^\d{4,8}$/.test(pin) ? pin : '',
    sound: d.sound !== false,
    awake: d.awake !== false,
    nightFrom: timeOr(d.nightFrom, '21:00'),
    nightTo: timeOr(d.nightTo, '06:00'),
    note: { text: str(d.note?.text, 200), from: str(d.note?.from, 45), until: day(d.note?.until) },
    backedUp: day(d.backedUp),
    about,
    activities,
    contacts,
    retired,
    completed,
    undone,
    seen,
    raised,
  };
}

// A first guess at the country from the device's time zone, or '' when it can't tell. The family
// confirms it during set-up, because the emergency number depends on it.
function guessRegion() {
  let zone = '';
  try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* no guess */ }
  if (zone.startsWith('Australia/') || zone === 'Antarctica/Macquarie') return 'au';
  if (['Pacific/Auckland', 'Pacific/Chatham'].includes(zone)) return 'nz';
  if (['Europe/London', 'Europe/Belfast', 'Europe/Jersey', 'Europe/Guernsey', 'Europe/Isle_of_Man'].includes(zone)) return 'uk';
  if (zone === 'Europe/Dublin') return 'ie';
  if (/^(America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Montreal|Moncton|Whitehorse|Yellowknife|Iqaluit|Dawson|Dawson_Creek|Goose_Bay|Swift_Current|Rankin_Inlet|Glace_Bay|Fort_Nelson|Inuvik|Cambridge_Bay|Resolute|Thunder_Bay|Nipigon|Rainy_River|Atikokan|Pangnirtung|Creston|Blanc-Sablon)|Canada\/.*)$/.test(zone)) return 'ca';
  if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana|Indianapolis|Fort_Wayne|Knox_IN|Kentucky|Louisville|North_Dakota|Juneau|Adak|Nome|Sitka|Metlakatla|Yakutat|Menominee|Puerto_Rico|St_Thomas|Shiprock)|^Pacific\/(Honolulu|Guam|Pago_Pago|Saipan)$|^US\//.test(zone)) return 'us';
  return '';
}

function load() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY) || 'null');
  } catch { /* storage blocked or corrupt: start fresh */ }
  return stored ? normalize(stored, true) : normalize({ ...SEED, region: guessRegion() || 'other' }, false);
}

// Returns false when the browser refuses to store anything (private mode, blocked site data, full).
function save() {
  // Drop old history and long-past appointments so storage doesn't grow forever.
  const cutoff = dayKey(daysAgo(KEEP_DAYS));
  for (const record of [data.completed, data.undone, data.seen, data.raised]) {
    for (const k of Object.keys(record)) if (k < cutoff) delete record[k];
  }
  data.retired = data.retired.filter(r => r.removed >= cutoff);
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
const EARLY_WINDOW = 60; // an important thing can't be ticked more than this many minutes before its time
const LATE_WINDOW = 15; // minutes a promised reminder is still kept after its window has closed
const SNOOZE_MINUTES = 10;
const MUST_WINDOW = 60; // minutes an important reminder keeps coming back before it rests on the home screen
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n); // calendar arithmetic, so daylight-saving changes don't skip a day
  return d;
}
// Unique by construction: several are made in the same millisecond during set-up.
let idSeq = 0;
function newId() { return Date.now() * 1000 + (idSeq++ % 1000); }

const data = load();
const canStore = storageWorks();

function region() {
  const r = REGIONS[data.region] || REGIONS.other;
  return data.region === 'other' && data.emergency ? { ...r, emergency: data.emergency } : r;
}
const fmt = (opts, date = new Date()) => new Intl.DateTimeFormat(region().locale, opts).format(date);
// Always am/pm: "8:00 pm" is what the wording everywhere else uses, whatever the country's habit.
const clockText = (date = new Date()) => fmt({ hour: 'numeric', minute: '2-digit', hour12: true }, date);
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
// What the first screen says at night. It never says "everything is fine" while something important
// is not ticked, and says nothing at all while something important is due now: the card says that.
function restMessage() {
  const top = attention();
  if (top?.a.must && top.late < NOW_WINDOW) return '';
  const owed = todays().some(a => a.must && !isDone(a.id) && minutesLate(a) >= 0) || lastNight().some(x => x.at === undefined);
  const fine = owed ? '' : ' Everything is fine.';
  return beforeDawn() ? `It is still night time.${fine} You can go back to bed.` : `It is bed time.${fine}`;
}
function greeting() {
  const name = data.person ? `, ${data.person}` : '';
  return dayPart() === 'night' ? `It's night time${name}` : `Good ${dayPart()}${name}`;
}

const findActivity = id => data.activities.find(a => a.id === id);
const findContact = id => data.contacts.find(c => c.id === id);
const telHref = phone => 'tel:' + String(phone).replace(/[^+\d]/g, '');
// FaceTime also accepts an email address, so only strip a phone number down to its digits.
const callHref = c => CALL_METHODS[c.method].scheme + (c.phone.includes('@') ? encodeURIComponent(c.phone.trim()) : c.phone.replace(/[^+\d]/g, ''));
// A tablet without a SIM cannot make an ordinary phone call. Once the family has said so, Hazel
// shows the number to dial on a real phone instead of pretending to ring.
const cannotRing = method => data.calls === 'no' && method === 'phone';
// Anything that calls someone. Tapping it also puts the number on screen in large print.
function callTag(method, href, number, name, cls, inner, extra = '') {
  const attrs = `class="${cls}" data-number="${esc(number)}" data-name="${esc(name)}" ${extra}`;
  return cannotRing(method) ? `<button type="button" ${attrs}>${inner}</button>` : `<a href="${esc(href)}" ${attrs}>${inner}</a>`;
}
const callLink = (c, cls, label) => callTag(c.method, callHref(c), c.phone, c.name, cls, label);
const callVerb = c => (cannotRing(c.method) ? 'Ring' : CALL_METHODS[c.method].verb);
// Someone can be reached only with a real number (or a FaceTime address), not just any text.
const hasNumber = c => !!c && (/\d/.test(c.phone) || c.phone.includes('@'));
// People the person can actually reach. Before set-up the examples are shown even without numbers.
const reachable = () => data.contacts.filter(c => hasNumber(c) || !data.setup);
const helper = () => data.contacts.find(hasNumber);

function occursOn(a, d = new Date()) {
  const key = dayKey(d);
  if (a.from && key < a.from) return false; // it had not been added yet
  if (a.repeat === 'once') return a.date === key;
  if (a.repeat === 'weekly') return a.days.includes(d.getDay());
  if (a.repeat === 'fortnight') return !!a.date && key >= a.date && Math.round((parseDay(key) - parseDay(a.date)) / 864e5) % 14 === 0;
  if (a.repeat === 'monthly') {
    if (!a.date || key < a.date) return false;
    const lastOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return d.getDate() === Math.min(parseDay(a.date).getDate(), lastOfMonth); // the 31st falls on the last day of a shorter month
  }
  return true;
}
const byTime = (a, b) => a.time.localeCompare(b.time);
const todays = (d = new Date()) => data.activities.filter(a => occursOn(a, d)).sort(byTime);
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
function scheduleText(a) {
  const date = a.date ? parseDay(a.date) : null;
  if (a.repeat === 'once') return date ? fmt({ weekday: 'short', day: 'numeric', month: 'short' }, date) : 'One day';
  if (a.repeat === 'fortnight') return date ? `Every 2 weeks from ${fmt({ weekday: 'short', day: 'numeric', month: 'short' }, date)}` : 'Every 2 weeks';
  if (a.repeat === 'monthly') return date ? `Every month on the ${ordinal(date.getDate())}` : 'Every month';
  if (a.repeat === 'weekly' && a.days.length < 7) return DAY_ORDER.filter(d => a.days.includes(d)).map(d => DAY_NAMES[d]).join(', ');
  return 'Every day';
}

// The time something was ticked off: 'HH:MM', '' if the time wasn't recorded, undefined if not done.
const doneAt = (id, day = dayKey()) => data.completed[day]?.[id];
const isDone = (id, day) => doneAt(id, day) !== undefined;
// How a tick is described. One made an hour or more after the time says when the button was pressed,
// because that is all Hazel knows: "done at 2:45 pm" would read as the time the tablets were taken.
function tickWords(a, at) {
  if (!at) return 'done';
  let late = a ? toMinutes(at) - toMinutes(a.time) : 0;
  if (a?.must && late < -EARLY_WINDOW) late += 1440; // an important thing cannot be ticked that early: it was ticked after midnight
  return `${late >= NOW_WINDOW ? 'ticked off' : 'done'} at ${timeText(at)}`;
}
function doneText(id, day) {
  const words = tickWords(findActivity(id), doneAt(id, day));
  return words === 'done' ? 'Done today' : words[0].toUpperCase() + words.slice(1);
}
function markDone(id, day = dayKey()) {
  (data.completed[day] ??= {})[id] = nowHHMM();
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
const tooEarly = a => a.must && minutesLate(a) < -EARLY_WINDOW;

// Tablets get extra care: Hazel only knows about the tap, so it never tells anyone to take a dose
// that is well past its time. The family's own instruction (from the pharmacist) comes first.
const isTablets = a => a.emoji === '💊';
const TABLET_CAUTION = "Not sure if you've had them? Check your pill box. Don't take extra.";
const lateAdvice = a => a.ifLate || (isTablets(a) ? TABLET_CAUTION : 'Not ticked off yet. Have you done it?');
// The same for a reminder card, which can be for last night: the family's advice was written for
// the day itself, so after midnight the card says what the first screen says.
const lateWords = (a, day) => (day === dayKey() ? lateAdvice(a)
  : isTablets(a) ? `Ask ${helper()?.name || 'family'} or your pharmacist before taking them.` : 'Not ticked off yet. Have you done it?');
// Past its hour: the instruction makes way for the careful wording.
const needsCare = (a, late = minutesLate(a)) => late >= NOW_WINDOW && (isTablets(a) || !!a.ifLate);

// An important thing due late in the evening keeps its hour past midnight. Every one of last
// night's that is still inside its hour and not ticked, earliest first: [{ a, day, late }].
function carriedAll() {
  const now = toMinutes(nowHHMM());
  if (now >= MUST_WINDOW) return [];
  const y = daysAgo(1);
  const day = dayKey(y);
  return data.activities.filter(x => x.must && occursOn(x, y) && !isDone(x.id, day) && now + 1440 - toMinutes(x.time) < MUST_WINDOW).sort(byTime)
    .map(a => ({ a, day, late: now + 1440 - toMinutes(a.time) }));
}
// The latest of them: the one the first screen and My Day show as "Now".
const carried = () => carriedAll().pop() || null;

// Last night's important things: ticked (with the time) or not. Shown until today's first activity,
// so that after midnight the question "did I take my tablets?" still has an answer either way.
function lastNight() {
  const first = todays()[0];
  if (first && minutesLate(first) >= 0) return [];
  const y = daysAgo(1);
  const day = dayKey(y);
  const held = carriedAll().map(x => x.a); // still inside their hour: their card says what to do
  // "Not ticked" is only said about a night Hazel was already set up for.
  const known = !!data.since && data.since <= day;
  return data.activities.filter(a => a.must && a.time >= '17:00' && !held.includes(a) && occursOn(a, y)).sort(byTime)
    .map(a => ({ a, at: doneAt(a.id, day) })).filter(x => x.at !== undefined || known);
}
// The family's "if it is late" advice was written for the same day ("if it is before 10 pm, take
// them now"), so it is never repeated the next morning, when it would read as "take them now".
const lastNightText = ({ a, at }) => (at === undefined
  ? `Last night: ${a.title} not ticked.${isTablets(a) ? ` Ask ${helper()?.name || 'family'} or your pharmacist before taking them.` : ''}`
  : `Last night: ${a.title}, ${tickWords(a, at)}`);

// What belongs at the top of the home screen: the latest important thing that is due, until it is
// ticked or the next important thing falls due (an earlier one that was missed is then only named
// beside the clock, never offered again at bed time). Otherwise whatever is on now. Returns { a, late, day }.
function attention() {
  const list = todays();
  const due = list.filter(a => a.must && minutesLate(a) >= 0);
  // An important thing still inside its hour and not ticked comes first (the latest, if there are
  // two close together), so ticking the later one does not hide the earlier one.
  const must = due.filter(a => !isDone(a.id) && minutesLate(a) < MUST_WINDOW).pop() || due.pop();
  if (must && !isDone(must.id)) return { a: must, late: minutesLate(must), day: dayKey() };
  const held = carried();
  if (held) return held;
  const now = list.find(a => statusOf(a) === 'now');
  return now ? { a: now, late: minutesLate(now), day: dayKey() } : null;
}

// The answer to "have I taken my tablets?", kept beside the clock on the first screen: last night's,
// today's ticked ones with their times, and any that are past their time and not ticked.
function tabletLines() {
  const lines = lastNight().map(x => ({ cls: x.at === undefined ? 'warn' : 'ok', text: (x.at === undefined ? '' : '✓ ') + lastNightText(x) }));
  const top = attention()?.a;
  for (const a of todays().filter(x => x.must)) {
    if (isDone(a.id)) lines.push({ cls: 'ok', text: `✓ ${a.title}, ${doneText(a.id).toLowerCase()}` });
    // Past its hour, or due and not the one in the card below: either way it is named here.
    else if (minutesLate(a) >= NOW_WINDOW || (minutesLate(a) >= 0 && a !== top)) lines.push({ cls: 'warn', text: `${a.title}: not ticked` });
  }
  // Room for three. What is not ticked is never the line that is dropped.
  const warn = lines.filter(l => l.cls === 'warn').slice(-3);
  const ok = warn.length < 3 ? lines.filter(l => l.cls !== 'warn').slice(warn.length - 3) : [];
  return lines.filter(l => warn.includes(l) || ok.includes(l));
}
const sentence = s => (/[.!?]$/.test(s) ? s : s + '.');

// Appointments and anything special coming up, soonest first: [{ a, date }]. Dated things are looked
// for a month ahead; a weekly thing (bin night) is only mentioned the day before.
function comingUp() {
  const out = [];
  for (const a of data.activities) {
    if (a.repeat === 'daily' || (a.repeat === 'weekly' && a.days.length === 7)) continue;
    const reach = a.repeat === 'weekly' ? 1 : 30;
    for (let i = 1; i <= reach; i++) {
      const d = daysAgo(-i);
      if (occursOn(a, d)) { out.push({ a, date: dayKey(d) }); break; }
    }
  }
  return out.sort((x, y) => x.date.localeCompare(y.date) || byTime(x.a, y.a));
}
const whenText = date => (date === dayKey(daysAgo(-1)) ? 'Tomorrow' : fmt({ weekday: 'long', day: 'numeric', month: 'long' }, parseDay(date)));
function tomorrowLine() {
  const first = comingUp().find(x => x.date === dayKey(daysAgo(-1)));
  return first ? `Tomorrow: ${first.a.title}, ${timeText(first.a.time)}` : '';
}
const noteShown = () => !!data.note.text && (!data.note.until || data.note.until >= dayKey());

// What was planned and what was ticked off on a given day, for Family View. Days before Hazel was
// set up have nothing planned, and something removed since still counts on the days it was there.
function dayRecord(d) {
  const key = dayKey(d);
  if (!data.since || key < data.since) return { planned: [], done: [], missed: [] };
  const done = data.completed[key] || {};
  const gone = data.retired.filter(r => (key < r.removed || (key === r.removed && (r.id in done || r.time <= r.removedAt))) && occursOn(r, d));
  const active = data.activities.filter(a => occursOn(a, d));
  const planned = [...active, ...gone.filter(r => !active.some(a => a.id === r.id))].sort(byTime);
  const isToday = key === dayKey();
  const missed = planned.filter(a => !(a.id in done) && (!isToday || statusOf(a) === 'earlier'));
  return { planned, done: planned.filter(a => a.id in done), missed };
}

// --- When Hazel was showing -------------------------------------------------
// Reminders only happen while Hazel is open on the screen. Keeping a note of when it was lets the
// family tell "reminded and not answered" from "Hazel was not open".

let beat = null; // { day, at, saved }: the last time the heartbeat ran
function heartbeat(final = false) {
  if (!data.setup || (!final && document.visibilityState !== 'visible')) return;
  const day = dayKey();
  const now = nowHHMM();
  const spans = (data.seen[day] ??= []);
  const last = spans[spans.length - 1];
  const running = beat && beat.day === day && last && Date.now() - beat.at < 150_000;
  if (running) last[1] = now;
  else if (final) return;
  else {
    // A device that keeps dozing: keep the list short by joining the two stretches closest together,
    // never by stretching one over hours in which Hazel was closed.
    if (spans.length >= 40) {
      let at = 1;
      for (let i = 2; i < spans.length; i++) {
        if (toMinutes(spans[i][0]) - toMinutes(spans[i - 1][1]) < toMinutes(spans[at][0]) - toMinutes(spans[at - 1][1])) at = i;
      }
      spans.splice(at - 1, 2, [spans[at - 1][0], spans[at][1]]);
    }
    spans.push([now, now]);
  }
  const saved = beat?.saved ?? 0;
  beat = { day, at: Date.now(), saved };
  if (final || !running || Date.now() - saved > 5 * 60_000) {
    beat.saved = Date.now();
    save();
  }
}
// Was Hazel showing at some point in the `minutes` after `hhmm` on that day? null = no record kept.
function wasOpen(day, hhmm, minutes = NOW_WINDOW) {
  const spans = data.seen[day];
  const first = Object.keys(data.seen).sort()[0];
  if (!spans?.length) return first && first < day ? false : null;
  const end = toMinutes(hhmm) + minutes;
  if (day === first && end < toMinutes(spans[0][0])) return null; // before this record began: no claim either way
  return spans.some(([from, to]) => toMinutes(from) <= end && toMinutes(to) >= toMinutes(hhmm));
}
// For reading: stretches a few minutes apart are given as one, and a long list keeps its first and last.
function openText(day) {
  const spans = data.seen[day];
  if (!spans?.length) return wasOpen(day, '00:00') === false ? 'Hazel was not open on this day.' : '';
  const joined = [];
  for (const [from, to] of spans) {
    const last = joined[joined.length - 1];
    if (last && toMinutes(from) - toMinutes(last[1]) <= 15) last[1] = to;
    else joined.push([from, to]);
  }
  const text = ([from, to]) => (from === to ? timeText(from) : `${timeText(from)} to ${timeText(to)}`);
  const shown = joined.length > 4 ? [...joined.slice(0, 2).map(text), 'and at other times', text(joined[joined.length - 1])] : joined.map(text);
  return `Hazel was showing: ${shown.join(', ')}.`;
}

// --- Sound, voice and keeping the screen on -------------------------------

// Browsers only allow sound after the person has touched the page once, and can switch it off again
// (after a phone call, or when the page has been behind another app). Every tap switches it back on.
let armed = false;
let audio = null;
const soundOn = () => data.sound && armed && audio?.state === 'running';
const soundHintNeeded = () => data.setup && data.sound && todays().length > 0 && (!armed || (!!audio && audio.state !== 'running'));
function resumeAudio() {
  try {
    if (audio && audio.state !== 'running') audio.resume?.()?.catch?.(() => {});
  } catch { /* ignore */ }
}
function arm() {
  resumeAudio();
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
  // The strip goes, and what was below it moves up: a second tap must not land on that.
  setTimeout(() => {
    const hint = app.querySelector('.sound-hint');
    if (hint) { hint.remove(); guard(); }
  }, 0);
}

// A soft two-note chime. For important things it is louder, plays three times and the device buzzes.
function chime(strong = false) {
  if (!data.sound) return;
  try {
    if (strong && armed) navigator.vibrate?.([400, 200, 400, 200, 400]); // browsers refuse it before the first tap
  } catch { /* ignore */ }
  if (!audio) return;
  resumeAudio();
  try {
    const t = audio.currentTime;
    const notes = strong
      ? [[659.25, 0], [523.25, 0.45], [659.25, 1.6], [523.25, 2.05], [783.99, 3.2], [523.25, 3.65]]
      : [[659.25, 0], [523.25, 0.45]];
    notes.forEach(([freq, at]) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + at);
      gain.gain.exponentialRampToValueAtTime(strong ? 0.5 : 0.3, t + at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + at + 1.4);
      osc.connect(gain).connect(audio.destination);
      osc.start(t + at);
      osc.stop(t + at + 1.5);
    });
  } catch { /* ignore */ }
}

// If Hazel is open but behind another app (during a call, say), a reminder also shows as a
// notification, when the family has allowed that. It cannot wake a device that has closed Hazel.
function notify(title, body) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
    const options = { body, tag: 'hazel-reminder', requireInteraction: true, vibrate: [400, 200, 400] };
    const plain = () => { try { new Notification(title, options); } catch { /* not allowed here */ } };
    const sw = navigator.serviceWorker;
    if (!sw?.getRegistration) return plain();
    sw.getRegistration().then(reg => (reg ? reg.showNotification(title, options) : plain())).catch(plain);
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
      el.textContent = el.dataset.stop || '⏹ Stop reading';
      speakingEl = el;
      guard(); // the button has just changed under the finger
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
let byKeyboard = false; // the last button was pressed with a key, not a finger
function toast(message, { action = null } = {}) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button data-action="toast-action">${esc(action.label)}</button>` : ''}`;
  toastRun = action ? action.run : null;
  el.hidden = false;
  clearTimeout(toastTimer);
  // Someone using a keyboard gets the button under their fingers, and longer to reach it.
  const keys = action && byKeyboard;
  if (keys) el.querySelector('button').focus();
  toastTimer = setTimeout(() => {
    const hadFocus = el.contains(document.activeElement);
    el.hidden = true;
    toastRun = null;
    if (hadFocus) focusHeading();
  }, keys ? 30000 : action ? 12000 : 6000);
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
const ui = { screen: 'home', id: null, tab: 'progress', unlocked: false, confirming: null, photo: undefined, backup: '', restore: null, keepHistory: false, summary: '', forgot: false, leave: null, regionAsked: false, skipLoses: false };

const FORM_SCREENS = ['activityForm', 'contactForm', 'setup'];

// A shaky hand often taps twice. After the screen changes, taps are ignored for a moment so the
// second one can't land on a button that has just appeared under the finger.
// (Measured on a clock that never jumps, so correcting the device's time cannot freeze the screen.)
let guardUntil = 0;
function guard(ms = 700) {
  guardUntil = Math.max(guardUntil, performance.now() + ms);
}
let tickGuardUntil = 0; // after "Well done" closes by itself, a slow tap on OK must not tick what is underneath
const needsPin = screen => FORM_SCREENS.includes(screen);
const FAMILY_SCREENS = ['family', ...FORM_SCREENS];

// history can be unavailable in some embedded frames; navigation still works without it.
function remember(state, replace) {
  try {
    replace ? history.replaceState(state, '') : history.pushState(state, '');
  } catch { /* ignore */ }
}

function enter(screen, id) {
  hush();
  if (screen === 'home') ui.unlocked = false;
  if (screen === 'setup' && data.setup) screen = 'family'; // set-up runs once; after that it would wipe what is there
  // Until Hazel is set up, Family settings is the set-up form: both ways through it confirm the
  // country, so the emergency number is never left as a guess.
  if (screen === 'family' && !data.setup) screen = 'setup';
  Object.assign(ui, { screen, id, confirming: null, photo: undefined, backup: '', restore: null, keepHistory: false, summary: '', forgot: false, regionAsked: false, skipLoses: false });
  if (draft && draft.screen === screen && draft.id === id) ui.photo = draft.photo; // a form left half-filled comes back as it was
  if (leftOut?.seen && screen !== 'family') leftOut = null;
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

// Hazel itself steps back after a tick or a save. That is not the person pressing Back.
let ownBack = false;
function stepBack() {
  ownBack = true;
  setTimeout(() => { ownBack = false; }, 1000);
  history.back();
}

window.addEventListener('popstate', e => {
  const own = ownBack;
  ownBack = false;
  // Back while a card is showing closes the card and leaves the page behind it where it was.
  // An important reminder stays: it has to be answered.
  if (sheet && !own) {
    remember({ screen: ui.screen, id: ui.id }, false);
    if (!(reminder && findActivity(reminder.id)?.must)) closeSheet();
    return;
  }
  let s = e.state || { screen: 'home', id: null };
  // The device's own Back button keeps what was typed too: a family panel is saved first, and a
  // half-filled form asks before it is left.
  if (!own && dirty) {
    if (ui.screen === 'family' ? !saveTyped() : FORM_SCREENS.includes(ui.screen)) {
      remember({ screen: ui.screen, id: ui.id }, false);
      if (ui.screen !== 'family') askLeave({ back: true });
      return;
    }
  }
  // Without a PIN, Family settings opens only with the press and hold, never with the Back button.
  if (!data.pin && FAMILY_SCREENS.includes(s.screen) && !ui.unlocked && !(s.screen === 'setup' && !data.setup)) {
    s = { screen: 'home', id: null };
    remember(s, true);
  }
  enter(s.screen, s.id);
  render();
  guard();
  if (!sheet) focusHeading();
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
    <li><b>Try a call from the Call screen</b>, then say in Settings whether it rang. A tablet with no SIM cannot ring an ordinary number, and Hazel then shows the number to dial on the phone instead.</li>
    <li><b>Ask the pharmacist what to do about a late dose</b>, and type it into each tablets item (“If it is late”). Hazel then gives that advice instead of a general caution.</li>
    <li><b>Hazel is not an alarm.</b> Someone at risk of falls still needs a pendant or watch alarm. Hazel cannot tell anyone that something is wrong.</li>
    <li><b>It is a memory aid, not a medical record.</b> Keep using the pill box or pharmacy pack. A tick only means the button was tapped.</li>
    <li><b>Make a backup copy</b> in Settings when you are done, and keep it somewhere safe.</li>
  </ul>
</details>`;

// Said before the family types anything, at set-up as well as in Family settings.
const NOT_KEPT = canStore ? '' : '<div class="notice" role="note"><strong>Changes won’t be kept.</strong> This browser isn’t letting Hazel save, so anything you set up here will be lost when Hazel is closed. Open Hazel in a normal (not private) browser window to keep changes.</div>';

const CALM_NIGHT = 'You are safe at home. It is night time. Take a slow breath. You can rest, or you can talk to someone.';
const CALM_MESSAGE = "You are safe. Take your time. You don't have to do everything at once. You can call someone you know.";
const SIZE_NEXT = { normal: 'Make the writing bigger', large: 'Make the writing bigger still', largest: 'Make the writing normal size again' }; // what the next tap does

const screens = {
  home() {
    const part = dayPart();
    const rest = restMessage();
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
    // Help sits in the same corner here as on every other screen, whatever else is showing, with
    // "read this to me" and bigger writing beside it, so none of them needs scrolling to find. With
    // something to do now, the picture makes way so the buttons below stay on screen.
    return `
      <section class="hero ${part} ${top ? 'compact' : ''}">
        <div class="hero-top">
          <button class="help-btn" data-go="help">🛟 Help</button>
          <div class="hero-tools">
            <button class="tool" data-action="read-home" data-stop="⏹ Stop">🔊 Read</button>
            <button class="tool" data-action="bigger" aria-label="${SIZE_NEXT[data.size]}">🔍 ${data.size === 'largest' ? 'Smaller' : 'Bigger'}</button>
          </div>
        </div>
        <div class="hero-main">
          <h1 class="greeting" tabindex="-1">${esc(greeting())}</h1>
          <button class="clock" data-action="read-home" aria-label="${clockText()}. Tap to hear the time and what is next.">${clockText()}</button>
          <div class="daypart">${esc(partLine())}</div>
          <div class="date">${fmt({ day: 'numeric', month: 'long', year: 'numeric' })}</div>
          ${tabletLines().map(l => `<p class="taken ${l.cls}"><span>${esc(l.text)}</span></p>`).join('')}
          ${part === 'night' && rest ? `<p class="rest">${rest}</p>` : ''}
        </div>
        <div class="landscape" aria-hidden="true"><div class="sun"></div><div class="hill one"></div><div class="hill two"></div><div class="hill three"></div></div>
        ${soundHintNeeded() ? '<div class="sound-hint">🔔 Tap to turn on the chime</div>' : ''}
      </section>
      <section class="content home-content">
        ${data.setup ? '' : `<button class="example-banner" data-go="setup"><strong>Hazel is not set up yet.</strong> This is only an example day. Family: tap here to set it up ›</button>`}
        ${top || ''}${duo}${dayTile}${note}
        <div class="home-tools">
          ${data.pin ? '<button data-go="family">⚙ Family settings</button>' : '<button data-hold="family" class="hold">⚙ Family settings</button>'}
        </div>
      </section>`;
  },

  day() {
    const list = todays();
    const held = carried(); // last night's important thing, still within its hour after midnight
    const next = held?.a || focusActivity();
    const doneCount = list.filter(a => isDone(a.id)).length;
    const earlier = earlierNotDone();
    const soon = comingUp();
    let nextCard = '';
    if (next) {
      const now = !!held || statusOf(next) === 'now';
      nextCard = `<div class="next-card">
           <span class="pill ${now ? 'now' : ''}">${now ? 'Now' : 'Next'}</span>
           <div class="next-head">${thumb(next)}<div><h2>${esc(next.title)}</h2><p>${timeText(next.time)}</p></div></div>
           ${now ? `<button class="primary" data-action="finish" data-id="${next.id}" ${held ? `data-day="${held.day}"` : ''}>✓ &nbsp;I've done this</button>` : ''}
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
        ${lastNight().map(x => `<p class="last-night ${x.at === undefined ? 'warn' : ''}">${x.at === undefined ? '' : '✓ '}${esc(lastNightText(x))}</p>`).join('')}
        ${earlier.length ? `<h2 class="section-heading earlier-heading">Not ticked off yet</h2>
        <p class="earlier-note">Tap one if you have done it.</p>
        ${earlier.map(activityItem).join('')}` : ''}
        ${nextCard}
        <h2 class="section-heading">Today</h2>
        ${list.filter(a => !earlier.includes(a)).map(activityItem).join('') || (list.length ? '' : '<p class="muted">Nothing planned today. A family member can add things in Family settings.</p>')}
        ${soon.length ? `<h2 class="section-heading">Coming up</h2>${soon.map(({ a, date }) => `
          <button class="item soon" data-go="activity" data-id="${a.id}">
            ${thumb(a)}
            <span class="name">${esc(a.title)}<span class="when">${whenText(date)}, ${timeText(a.time)}</span></span>
            <span class="chevron" aria-hidden="true">›</span>
          </button>`).join('')}` : ''}
        ${list.length ? tellLink(todayText(), n => `📱 Send today to ${n}`) : ''}
      </section>`;
  },

  activity() {
    const a = findActivity(ui.id);
    if (!a) return screens.day();
    const mine = carriedAll().find(x => x.a === a) || null; // last night's, still within its hour after midnight: it is due now
    const today = occursOn(a) || !!mine;
    const done = !mine && today && isDone(a.id);
    const tablets = isTablets(a);
    const early = !mine && today && !done && tooEarly(a);
    const care = !mine && today && !done && !early && needsCare(a); // well past its time: no instruction to take it now
    const before = lastNight().find(x => x.a === a);
    let buttons;
    if (done) {
      buttons = `<div class="done-panel"><span aria-hidden="true">✓</span> ${doneText(a.id)}${tablets ? '<small>You ticked these off today. No need to take them again.</small>' : ''}</div>
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
      buttons = `<div class="notyet"><b>Not yet.</b> This is for ${timeText(a.time)}. It is <span data-now>${clockText()}</span> now.${before ? `<small class="${before.at === undefined ? 'warn' : ''}">${before.at === undefined ? '' : '✓ '}${esc(lastNightText(before))}</small>` : ''}</div>`;
    } else if (today) {
      buttons = `${care ? `<p class="caution">This was for ${timeText(a.time)}. ${esc(lateAdvice(a))}${a.ifLate ? '' : ' Ask family or your pharmacist first.'}</p>` : ''}
        <button class="primary" data-action="finish" data-id="${a.id}" ${mine ? `data-day="${mine.day}"` : ''}>✓ &nbsp;${care ? "Yes, I've done this" : "I've done this"}</button>`;
    } else {
      const next = comingUp().find(x => x.a === a);
      buttons = `<p class="celebrate">${next ? `This is ${next.date === dayKey(daysAgo(-1)) ? 'tomorrow' : 'on ' + whenText(next.date)}.` : 'This is not on today.'}</p>`;
    }
    const who = findContact(a.contactId);
    return `
      <section class="content">
        ${backButton('day', 'Back to My Day', true)}
        ${exampleNote()}
        <div class="photo" aria-hidden="true">${a.photo ? `<img src="${esc(a.photo)}" alt="">` : esc(a.emoji)}</div>
        <div class="activity-card">
          <div class="counter">${timeText(a.time)}</div>
          <h1 class="activity-title" tabindex="-1">${esc(a.title)}</h1>
          ${a.note && !done && !early && !care && (today || !(isTablets(a) || a.must)) ? `<p class="activity-note">${esc(a.note)}</p>` : ''}
        </div>
        ${buttons}
        ${hasNumber(who) ? callLink(who, 'secondary call-now', `📞 ${callVerb(who)} ${esc(who.name)}`) : ''}
        <button class="secondary" data-action="speak-activity" data-id="${a.id}">🔊 Read this out loud</button>
      </section>`;
  },

  contacts() {
    const lead = !helper() ? 'There is nobody to call yet. A family member can add phone numbers in Family settings.'
      : data.calls === 'no' ? 'This device cannot make phone calls. Tap a person to see their number, then ring them on the phone.'
      : 'Tap a person to call them.';
    return `
      <section class="content">
        ${backButton('home', 'Back to home', true)}
        ${exampleNote()}
        <h1 class="page-title" tabindex="-1">📞 Call Someone</h1>
        <p class="lead">${lead}</p>
        ${reachable().map(contactCard).join('')}
      </section>`;
  },

  help() {
    const r = region();
    const main = helper();
    const dial = cannotRing('phone');
    return `
      <section class="content">
        ${backButton()}
        ${exampleNote()}
        <h1 class="page-title" tabindex="-1">🛟 Get Help</h1>
        ${callTag('phone', 'tel:' + r.emergency, r.emergency, r.emergency, 'big red', `
          <span class="emoji" aria-hidden="true">🚑</span>
          <span><strong>${dial ? `Dial ${r.emergency} on the phone` : `Call ${r.emergency}`}</strong><small>${dial ? 'This device cannot ring. Use the house phone or a mobile.' : 'Emergency: ambulance, fire or police'}</small></span>`, 'data-emergency')}
        ${main
          ? callLink(main, 'big blue', `<span class="emoji" aria-hidden="true">📞</span>
               <span><strong>${cannotRing(main.method) ? 'Ring' : 'Call'} ${esc(main.name)}</strong><small>${esc(main.relation || 'Family')}</small></span>`)
          : data.setup ? '' : bigTile('blue', 'contacts', '📞', 'Call someone', ['Family and friends'])}
        ${bigTile('green', 'calm', '💬', "I'm feeling worried", ['Hear a calming message'])}
        ${bigTile('yellow', 'about', '🪪', 'My details', ['For a doctor, nurse or ambulance'])}
        ${r.lines.length ? `<div class="notice lines"><strong>Someone to talk to</strong>${r.lines.map(l =>
          callTag('phone', telHref(l.number), l.number, l.name, 'link', `${l.label}: <span class="number">${l.number}</span>`)).join('')}</div>` : ''}
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
        <p class="lead">It is <span data-now>${clockText()}</span>, ${esc(partLine())}. Breathe in slowly, and out slowly.</p>
        <button class="primary" data-action="speak-calm">🔊 Read this to me</button>
        ${line ? callTag('phone', telHref(line.number), line.number, line.name, 'big blue', `
          <span class="emoji" aria-hidden="true">💬</span>
          <span><strong>Talk to someone now</strong><small>${esc(line.name)}, open day and night: ${line.number}</small></span>`) : ''}
        ${helper() ? bigTile('green', 'contacts', '📞', 'Call someone', ['Someone you know']) : ''}
      </section>`;
  },

  about() {
    const a = data.about;
    const born = validDay(a.dob) ? parseDay(a.dob) : null;
    const now = new Date();
    // Counted on the calendar, so it is right on the day before and the morning of a birthday.
    const age = born ? now.getFullYear() - born.getFullYear() - (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate()) ? 1 : 0) : null;
    const row = (label, value) => (value ? `<div class="detail"><span>${label}</span><b>${esc(value)}</b></div>` : '');
    const any = ABOUT_FIELDS.some(f => a[f]);
    return `
      <section class="content">
        ${backButton('help', 'Back to Get Help')}
        ${exampleNote()}
        <h1 class="page-title" tabindex="-1">🪪 My details</h1>
        <p class="lead">Show this to a doctor, nurse or ambulance officer.</p>
        ${any ? `<div class="details">
          ${row('Name', a.fullName)}
          ${row('Known as', data.person)}
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
            <label class="field">PIN<input name="pin" inputmode="numeric" autocomplete="off" maxlength="8" required ${ui.forgot ? '' : 'data-autofocus'}></label>
            <button class="primary">Open Family settings</button>
          </form>
          ${ui.forgot ? `<div class="family">
            <h3 tabindex="-1">Forgot the PIN?</h3>
            <form novalidate data-form="restore">
              <label class="field">Use a backup copy
                <span class="hint">Paste a copy made earlier with “Make a backup copy”. If the copy was made with this PIN, Hazel simply unlocks and nothing else changes. Otherwise the people, routine and details are replaced by the copy, and the ticks already recorded on this device are kept. Either way the PIN is cleared.</span>
                <textarea name="backup" rows="3" placeholder="Paste a backup copy here"></textarea></label>
              ${ui.confirming === 'restore'
                ? confirmBox(`${copyLine()}Replace the people, routine and details on this device with this copy? Ticks already recorded here are kept.`, 'restore-apply', null, 'Yes, replace', 'No, keep what is here')
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
        ${NOT_KEPT}
        ${data.regionOk ? '' : `<div class="confirm" role="group" aria-label="Check the emergency number">
          <p>The emergency number on this device is ${esc(region().emergency)} (${esc(region().name)}). Is that right?</p>
          <div class="confirm-actions">
            <button type="button" class="edit" data-action="region-ok">Yes, that is right</button>
            <button type="button" class="delete" data-action="region-change">No, change the country</button>
          </div>
        </div>`}
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
              ${REPEATS.map(([v, l]) =>
                `<label><input type="radio" name="repeat" value="${v}" ${repeat === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
            </div>
            <div class="choices text-choices when-weekly" ${repeat === 'weekly' ? '' : 'hidden'}>
              ${DAY_ORDER.map(d => `<label><input type="checkbox" name="days" value="${d}" ${a?.days?.includes(d) ? 'checked' : ''}><span>${DAY_NAMES[d]}</span></label>`).join('')}
            </div>
            <label class="field when-once" ${DATED_REPEATS.includes(repeat) ? '' : 'hidden'}><span class="date-label">${repeat === 'once' ? 'Date' : 'Starting on'}</span><input type="date" name="date" value="${esc(a?.date)}"></label>
          </fieldset>
          <label class="field">Give a warning beforehand
            <span class="hint">For appointments: Hazel also says it is coming up, so there is time to get ready. For tablets the warning only says they are coming up, never the instructions.</span>
            <select name="lead">${[[0, 'No, just at the time'], [30, '30 minutes before'], [60, '1 hour before'], [120, '2 hours before']].map(([v, l]) =>
              `<option value="${v}" ${(a?.lead || 0) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field">Friendly instructions
            <span class="hint">Short and kind works best. Hazel reads this aloud. For tablets, say which ones and where they are kept.</span>
            <textarea name="note" rows="3" maxlength="220" placeholder="e.g. Take the tablets in today's box with a glass of water">${esc(a?.note)}</textarea>
          </label>
          <label class="toggle"><input type="checkbox" name="must" ${a?.must ? 'checked' : ''}><span><b>Important: keep reminding</b><small>For tablets and anything that must not be missed. Hazel chimes louder and repeats the reminder for an hour. After that it stays at the top of the home screen, asked about carefully, until it is ticked or the next important thing is due.</small></span></label>
          <label class="field">If it is late
            <span class="hint">For tablets: ask the pharmacist what to do about a late or missed dose and type it here, for example “If it is before 12 noon, take them now. After that, leave them and wait for tonight.” Once the item is more than an hour late, Hazel shows and says this instead of the instructions above, on that day only. It is never repeated the next morning. Left blank, Hazel says to check the pill box and not to take extra.</span>
            <textarea name="ifLate" rows="2" maxlength="220">${esc(a?.ifLate)}</textarea>
          </label>
          ${pictureChoices('emoji', ACTIVITY_PICTURES, a?.emoji || ACTIVITY_PICTURES[0])}
          ${photoPicker(photo, 'A photo of the real thing (the tablet box, the front door) is easier to recognise.')}
          ${data.contacts.some(hasNumber) ? `<label class="field">Add a call button for
            <span class="hint">For things like “Ring Sarah” or a doctor's phone appointment. The button is on the reminder too.</span>
            <select name="contactId"><option value="">Nobody</option>${data.contacts.filter(hasNumber).map(c =>
              `<option value="${c.id}" ${a?.contactId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>` : ''}
          <button class="primary">Save</button>
        </form>
      </section>`;
  },

  contactForm() {
    const c = findContact(ui.id);
    const photo = ui.photo ?? c?.photo ?? '';
    const byPhone = (c?.method || 'phone') === 'phone';
    return `
      <section class="content">
        ${backButton('family', 'Back to Family settings')}
        <h1 class="page-title" tabindex="-1">${c ? 'Edit person' : 'Add a person'}</h1>
        <form novalidate data-form="contact">
          <label class="field">Name<input name="name" maxlength="45" value="${esc(c?.name)}" placeholder="e.g. Sarah" required></label>
          <label class="field">Who they are<input name="relation" maxlength="45" value="${esc(c?.relation)}" placeholder="e.g. Daughter, Neighbour, Doctor"></label>
          <label class="field"><span class="phone-label">${byPhone ? 'Phone number' : 'Phone number or email address'}</span>
            <span class="hint">People without a number are not shown on the Call screen.</span>
            <input name="phone" value="${esc(c?.phone)}" inputmode="${byPhone ? 'tel' : 'email'}" autocomplete="off" placeholder="${byPhone ? 'e.g. 0412 345 678' : 'e.g. 0412 345 678 or sarah@example.com'}"></label>
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
        ${NOT_KEPT}
        <form novalidate data-form="setup">
          <h3 class="step">1. Who is Hazel for?</h3>
          <label class="field">What they like to be called<input name="person" maxlength="35" value="${esc(data.person)}" placeholder="e.g. Mum, Margaret, Pop" required></label>
          <label class="field">Country
            <span class="hint">Sets the emergency number and help lines. Please check it is right.</span>
            <select name="region">${regionOptions(!guessRegion())}</select>
          </label>
          ${emergencyField(!guessRegion())}

          <h3 class="step">2. People they can call</h3>
          <p class="hint">The first person is the one Hazel suggests when they need help. Add more, and photos, later.</p>
          ${[0, 1, 2].map(i => `<div class="person-row">
            <input name="cname${i}" maxlength="45" placeholder="Name" aria-label="Person ${i + 1} name">
            <input name="crel${i}" maxlength="45" placeholder="${['Daughter', 'Son', 'Neighbour'][i]}" aria-label="Person ${i + 1}, who they are">
            <input name="cphone${i}" type="tel" placeholder="Phone number" aria-label="Person ${i + 1} phone number" autocomplete="off">
          </div>`).join('')}

          <h3 class="step">3. Their day</h3>
          <p class="hint">Tick what fits and set the times. Hazel chimes and speaks at each one. Something whose time has already passed today starts tomorrow. For tablets, say afterwards which ones and where they are kept (Routine, then Edit): until then Hazel only says their name.</p>
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
        ${ui.confirming === 'skip'
          ? confirmBox(`${ui.skipLoses ? 'Keep the example? The name, people and PIN typed above will not be used. ' : ''}The emergency number on this device will be ${region().emergency} (${region().name}). Is that right?`, 'skip-confirm', null, 'Yes, that is right', 'No, let me change it')
          : '<button class="skip" data-action="skip-setup">Keep the example and edit it myself</button>'}
        <div class="family">
          <h3>Already set up before?</h3>
          <form novalidate data-form="restore">
            <label class="field">Restore from a backup copy
              <span class="hint">If this device was replaced or cleared, paste the copy you kept and everything comes back.</span>
              <textarea name="backup" rows="3" placeholder="Paste a backup copy here"></textarea></label>
            ${ui.confirming === 'restore'
              ? confirmBox(`${copyLine()}Replace the example with this copy?`, 'restore-apply', null, 'Yes, restore it', 'No')
              : '<button class="secondary">Restore</button>'}
          </form>
        </div>
      </section>`;
  },
};

// Says whose copy is about to be restored, and when it was made, so the wrong one is caught first.
function copyLine() {
  const c = ui.restore;
  if (!c) return '';
  const made = c.backedUp ? `, made ${fmt({ day: 'numeric', month: 'long', year: 'numeric' }, parseDay(c.backedUp))}` : '';
  const here = data.setup && data.person && data.person !== c.person ? ` This device is set up for ${data.person}.` : '';
  return `This copy is for ${c.person || 'someone whose name is not set'}${made}, with ${c.activities.length} ${c.activities.length === 1 ? 'thing' : 'things'} in the routine.${here} `;
}

// What is still missing before the family can rely on Hazel. Shown above the tabs until all done.
function readyCard() {
  const tablets = data.activities.filter(a => a.must && isTablets(a));
  const checks = [
    [!!helper(), 'Someone to call, with a phone number entered', 'People'],
    [!!data.calls, data.calls === 'no' ? 'Calls: this device cannot ring, so Hazel shows the number to dial' : 'A call tried from this device, and the answer given in Settings', 'Settings'],
    [!!(data.about.fullName && data.about.address), 'Full name and address, for an emergency', 'Details'],
    [data.activities.length > 0, 'At least one thing in the routine', 'Routine'],
    // Worth doing, but the card does not wait for it.
    ...(tablets.length ? [
      [tablets.every(a => a.note), 'Which tablets, and where they are kept, written on each tablets item', 'Routine', true],
      [tablets.every(a => a.ifLate), 'What to do about a late dose, from the pharmacist, on each tablets item', 'Routine', true],
    ] : []),
    [!!data.backedUp, data.backedUp ? `A backup copy made on ${fmt({ day: 'numeric', month: 'long' }, parseDay(data.backedUp))}. Keep it somewhere safe` : 'A backup copy made and kept somewhere safe', 'Settings'],
  ];
  if (!data.setup || checks.every(c => c[0] || c[3])) return '';
  return `<div class="family ready">
    <h3>Is Hazel ready?</h3>
    ${checks.map(([ok, label, tab]) => `<div class="check ${ok ? 'yes' : ''}"><span aria-hidden="true">${ok ? '✓' : '○'}</span><span>${label}${ok ? '' : ` <b>(${tab} tab)</b>`}</span></div>`).join('')}
    <p class="tiny">Emergency number on this device: <b>${region().emergency}</b> (${region().name}). Change the country in Settings if that is wrong.</p>
  </div>`;
}

const familyPanels = {
  progress() {
    const mark = (a, d, isToday) => {
      const key = dayKey(d);
      const at = data.completed[key]?.[a.id];
      if (at !== undefined) return `<span class="ok">✓ ${at ? timeText(at) : 'ticked'}</span>`;
      const st = isToday && !data.undone[key]?.[a.id] ? statusOf(a) : 'earlier';
      if (st === 'now') return '<span class="now-tag">Due now</span>';
      if (st === 'upcoming') return timeText(a.time);
      const why = whyNotTicked(a, key);
      return `<span class="missed-tag">Not ticked</span>${why ? `<small class="taken-back">${esc(why)}</small>` : ''}`;
    };
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = daysAgo(i);
      const rec = dayRecord(d);
      if (!rec.planned.length) continue;
      const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : fmt({ weekday: 'long', day: 'numeric', month: 'short' }, d);
      // Important things first and in bold: they are what the family is looking for.
      const missed = [...rec.missed.filter(a => a.must).map(a => `<b>${esc(a.title)}</b>`), ...rec.missed.filter(a => !a.must).map(a => esc(a.title))];
      const open = openText(dayKey(d));
      days.push(`<details class="day-record" ${i === 0 ? 'open' : ''}>
        <summary><b>${label}</b><span class="progress-time">${rec.done.length} of ${rec.planned.length}</span>
          ${missed.length ? `<span class="missed">Not ticked: ${missed.join(', ')}</span>` : ''}</summary>
        ${rec.planned.map(a => `<div class="progress"><span>${esc(a.emoji)} ${esc(a.title)}${a.must ? ' <span class="must-tag">important</span>' : ''}</span><span class="progress-time">${mark(a, d, i === 0)}</span></div>`).join('')}
        ${open ? `<p class="tiny seen-line">${esc(open)}</p>` : ''}
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
        ${navigator.share ? '<button class="secondary" data-action="share-summary">Send the last 7 days…</button>' : ''}
        ${ui.summary ? `<textarea class="copy-box" rows="6" readonly aria-label="Summary of the last 7 days">${esc(ui.summary)}</textarea>` : ''}
        <p class="tiny">A tick is recorded when someone taps “I’ve done this”. Hazel can’t check that it really happened. Days before Hazel was set up, and things before they were added, are left out. Reminders only happen while Hazel is showing on the screen, so each day also says when it was.</p>
      </div>`;
  },

  activities() {
    // The row says what the family needs to know and cannot see elsewhere: that it has not started
    // yet, and that an important tablets item has no instruction written.
    const detail = a => esc(scheduleText(a))
      + (a.from > dayKey() && firstDay(a) ? ` · <strong>starts ${esc(startsText(firstDay(a)))}</strong>` : '')
      + (a.must && isTablets(a) && !a.note ? ' · <strong>no instructions yet</strong>' : '');
    const row = a => manageRow(a.photo ? photoThumb(a.photo) : esc(a.emoji), `${timeText(a.time)} · ${a.title}`, 'activity', a.id, detail(a), a.title);
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
          `${esc(c.relation)}${hasNumber(c) ? ' · ' + esc(c.phone) + (c.method === 'phone' ? '' : ' · ' + CALL_METHODS[c.method].label) : ' · <strong>no phone number yet</strong>'}`, c.name,
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
        <p class="tiny" style="margin-top:0">Anyone holding this device can read these under Get Help, My details. That is the point: a paramedic or nurse can see them. Only add what you are happy for a helper to see. Their name and address are also shown when the emergency number is called, so they know what to tell the operator.</p>
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
        ${leftOut && (leftOut.seen = true) ? `<p class="notice" role="note"><strong>Not saved:</strong> the ${listText(leftOut.items)} chosen earlier. Hazel went back to the clock before Save was pressed, so ${leftOut.items.length > 1 ? 'they were' : 'it was'} left as before. The rest of this panel was kept.</p>` : ''}
        <form novalidate data-form="settings">
          <label class="field">What they like to be called<input name="person" value="${esc(data.person)}" maxlength="35" placeholder="e.g. Mum"></label>
          <label class="field">Country
            <span class="hint">Sets the emergency number (${region().emergency}) and help lines.</span>
            <select name="region">${regionOptions()}</select>
          </label>
          ${emergencyField()}
          <fieldset class="field">
            <legend>Can this device make phone calls?</legend>
            <span class="hint">Try a call from the Call screen first. A tablet with no SIM usually cannot ring an ordinary number. If you choose No, Hazel stops offering to call and shows the number to dial on the house phone or a mobile, including the emergency number. FaceTime people are still called from here.</span>
            <div class="choices text-choices">
              ${[['', 'Not tried yet'], ['yes', 'Yes, it rang'], ['no', 'No, it cannot']].map(([v, l]) =>
                `<label><input type="radio" name="calls" value="${v}" ${data.calls === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
            </div>
          </fieldset>
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
          ${'Notification' in window ? `<button type="button" class="secondary small" data-action="notify-allow">🔔 ${Notification.permission === 'granted' ? 'Notifications are allowed on this device' : 'Also show a notification'}</button>
            <p class="hint">Helps only when Hazel is open but behind another app, for example during a call. It cannot wake a device that has closed Hazel.</p>` : ''}
          ${check('awake', 'Keep the screen on', 'So Hazel can sit on a stand as a clock. Keep the device plugged in.')}
          ${check('tell', `Offer “Tell ${esc(helper()?.name || 'the family')}” buttons`, 'After an important thing is ticked, and on My Day, Hazel offers a button that opens a text message to the first person, already written. They still have to press Send, and the device must be able to send messages. Nothing is sent by Hazel itself.')}
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
            ? confirmBox(`${copyLine()}Replace everything in Hazel on this device with this copy?`, 'restore-apply', null, 'Yes, replace', 'No, keep what is here')
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
// it is a single tap. An important thing that is past its hour is asked about carefully instead.
function attentionCard() {
  const top = attention();
  if (!top) return '';
  const { a, late, day } = top;
  const overdue = late >= NOW_WINDOW;
  const friend = helper();
  const who = findContact(a.contactId);
  return `<div class="attention ${overdue ? 'overdue' : ''}">
    <span class="pill now">${!data.setup ? 'Example' : overdue ? 'From earlier today' : 'Now'}</span>
    <div class="next-head">${thumb(a)}<div><h2>${esc(a.title)}</h2><p>${timeText(a.time)}</p></div></div>
    ${overdue ? `<p class="caution">${esc(lateAdvice(a))}</p>` : a.note ? `<p class="attention-note">${esc(a.note)}</p>` : ''}
    <div class="${overdue && friend ? 'pair' : ''}">
      <button class="primary" data-action="finish" data-id="${a.id}" data-day="${day}">✓ &nbsp;${overdue ? "Yes, I've done this" : "I've done this"}</button>
      ${overdue && friend ? callLink(friend, 'secondary', `📞 Ask ${esc(friend.name)}`) : ''}
    </div>
    ${!overdue && hasNumber(who) ? callLink(who, 'secondary call-now', `📞 ${callVerb(who)} ${esc(who.name)}`) : ''}
  </div>`;
}

function dayTileLines() {
  const list = todays();
  if (!list.length) return [tomorrowLine() || 'Nothing planned today'];
  const night = dayPart() === 'night';
  const top = attention();
  const shown = top?.a;
  const next = list.find(a => statusOf(a) === 'upcoming');
  // Nothing is nagged about at bed time. Important things are named beside the clock instead.
  const earlier = night ? 0 : earlierNotDone().filter(a => a !== shown && !a.must).length;
  // An important thing that is due now is named here too, so no line says there is nothing to do.
  const main = night && top?.a.must && top.late < NOW_WINDOW ? `Now: ${top.a.title}`
    : beforeDawn() ? 'Nothing to do until morning'
    : next ? `Next: ${next.title}, ${timeText(next.time)}`
    : list.every(a => isDone(a.id)) ? 'All done for today 🌷'
    : night ? 'Nothing to do until morning' : 'Nothing else planned today';
  // Anything special later today, and tomorrow.
  const special = list.find(a => a.repeat !== 'daily' && a !== next && statusOf(a) === 'upcoming');
  return [main,
    earlier ? { cls: 'warn', text: `${earlier} from earlier not ticked off yet` } : '',
    special ? `Today: ${special.title}, ${timeText(special.time)}` : '',
    tomorrowLine()];
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
  const can = hasNumber(c);
  const inner = `
    <span class="face" aria-hidden="true">${c.photo ? `<img src="${esc(c.photo)}" alt="">` : esc(c.emoji)}</span>
    <span class="who">${esc(c.name)}${c.relation ? `<span class="muted">${esc(c.relation)}</span>` : ''}${can ? `<span class="muted phone ${c.phone.includes('@') ? 'address' : ''}">${esc(c.phone)}</span>` : '<span class="muted">No number yet</span>'}</span>
    <span class="call ${can ? '' : 'missing'}" aria-hidden="true">${!can ? '—' : cannotRing(c.method) ? 'Number' : CALL_METHODS[c.method].verb}</span>`;
  return can
    ? callTag(c.method, callHref(c), c.phone, c.name, 'contact', inner, `aria-label="${callVerb(c)} ${esc(c.name)}${c.relation ? ', ' + esc(c.relation) : ''}"`)
    : `<button class="contact" data-action="no-phone" data-id="${c.id}" aria-label="${esc(c.name)}, no phone number yet">${inner}</button>`;
}

function manageRow(iconHtml, label, kind, id, detailHtml = '', name = label, extraHtml = '') {
  if (ui.confirming === `${kind}:${id}`) {
    // Removing a person takes their call button off anything that used them: say so first.
    const used = kind === 'contact' ? data.activities.filter(a => a.contactId === id).map(a => a.title) : [];
    const loses = used.length ? ` ${used.join(', ')} will lose ${used.length > 1 ? 'their' : 'its'} call button.` : '';
    return confirmBox(`Remove ${name}?${loses}`, `remove-${kind}`, id, 'Yes, remove');
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

// `ask`: the country could not be guessed, so the family has to choose it rather than accept a default.
const regionOptions = (ask = false) => (ask ? '<option value="" selected disabled>Choose the country</option>' : '')
  + Object.entries(REGIONS).map(([k, r]) =>
    `<option value="${k}" ${!ask && data.region === k ? 'selected' : ''}>${r.name}${k === 'other' ? '' : ` (${r.emergency})`}</option>`).join('');
// For a country that is not in the list, the family types the local emergency number.
const emergencyField = (ask = false) => `<label class="field when-other" ${!ask && data.region === 'other' ? '' : 'hidden'}>Emergency number in this country
    <span class="hint">The number for an ambulance, for example 112, 119 or 192. Hazel shows it on the Get Help screen.</span>
    <input name="emergency" inputmode="numeric" maxlength="6" value="${esc(data.emergency || '112')}" autocomplete="off"></label>`;
const validEmergency = v => /^\d{2,6}$/.test(v);

// What Hazel knows about something that was not ticked: a tick that was taken back, whether its
// reminder was shown, or that Hazel was not open at the time.
function whyNotTicked(a, day) {
  const back = data.undone[day]?.[a.id];
  if (back) return `ticked${back.was ? ' ' + timeText(back.was) : ''}, taken back ${timeText(back.at)}`;
  const shown = data.raised[day]?.[a.id];
  if (shown) return `reminder shown ${timeText(shown.at)}${shown.sound ? '' : ', without sound'}`;
  // Its reminder could only come up in its own stretch: an hour for an important thing, otherwise
  // until the next thing started. Hazel open later that day does not count.
  const later = dayRecord(parseDay(day)).planned.map(x => toMinutes(x.time)).filter(t => t > toMinutes(a.time))[0];
  const stretch = a.must ? MUST_WINDOW : Math.min(NOW_WINDOW, (later ?? Infinity) - toMinutes(a.time));
  const open = wasOpen(day, a.time, stretch);
  return open === false ? 'Hazel was not open then' : open === null ? 'no record of whether Hazel was open' : 'no reminder was shown';
}

function weekSummaryText() {
  const lines = [`Hazel summary${data.person ? ' for ' + data.person : ''}, week to ${fmt({ weekday: 'short', day: 'numeric', month: 'short' })}`];
  for (let i = 0; i < 7; i++) {
    const d = daysAgo(i);
    const rec = dayRecord(d);
    if (!rec.planned.length) continue;
    const key = dayKey(d);
    const done = data.completed[key] || {};
    // Important things first, each by name, because they are what the family is looking for.
    const must = rec.planned.filter(a => a.must).map(a => {
      if (a.id in done) return `${a.title} ${done[a.id] ? timeText(done[a.id]) : 'ticked'}`;
      if (!rec.missed.includes(a)) return i === 0 && minutesLate(a) >= 0 ? `${a.title} due since ${timeText(a.time)}, not ticked yet` : `${a.title} not due yet`;
      const why = whyNotTicked(a, key);
      return `${a.title} NOT TICKED${why ? ` (${why})` : ''}`;
    });
    const other = rec.planned.filter(a => !a.must);
    const otherMissed = rec.missed.filter(a => !a.must).map(a => a.title);
    const parts = [];
    if (must.length) parts.push(must.join('; ') + '.');
    if (other.length) parts.push(`${must.length ? 'Other things: ' : ''}${other.filter(a => a.id in done).length} of ${other.length} ticked${otherMissed.length ? ` (not ticked: ${otherMissed.join(', ')})` : ''}.`);
    const open = openText(key);
    lines.push(`${fmt({ weekday: 'short', day: 'numeric', month: 'short' }, d)}: ${parts.join(' ')}${open ? ' ' + open : ''}`);
  }
  lines.push('(A tick means someone tapped "I\'ve done this" on Hazel. Days before Hazel was set up are left out.)');
  return lines.join('\n');
}

// A short account of today, for a text message to the family.
function todayText() {
  const list = todays();
  const must = list.filter(a => a.must).map(a => (isDone(a.id) ? `${a.title} ticked${doneAt(a.id) ? ' ' + timeText(doneAt(a.id)) : ''}`
    : minutesLate(a) >= 0 ? `${a.title} NOT ticked` : `${a.title} due ${timeText(a.time)}`));
  return `Hazel${data.person ? ' for ' + data.person : ''}, ${fmt({ weekday: 'short', day: 'numeric', month: 'short' })} at ${clockText()}. `
    + `${must.length ? must.join('. ') + '. ' : ''}${list.filter(a => isDone(a.id)).length} of ${list.length} ticked off today.`;
}
// A text message (or an email, for a FaceTime address), already written, to the first person. The
// person still has to press Send: Hazel itself sends nothing. Only offered when the family turns it on.
function tellLink(text, label) {
  const c = helper();
  if (!data.tell || !data.setup || !c) return '';
  const body = encodeURIComponent(text);
  const href = c.phone.includes('@') ? `mailto:${encodeURIComponent(c.phone.trim())}?subject=Hazel&body=${body}` : `sms:${c.phone.replace(/[^+\d]/g, '')}?&body=${body}`;
  return `<a class="secondary tell" href="${esc(href)}">${esc(label(c.name))}</a>`;
}

// What "Read this to me" says on the first screen: everything the screen shows, in the same order.
function homeSpeech() {
  const top = attention();
  const next = focusActivity();
  const night = dayPart() === 'night';
  const earlier = earlierNotDone().filter(a => a !== top?.a && !a.must);
  const overdue = !!top && top.late >= NOW_WINDOW;
  // The thing at the top that is past its hour is said once, with its advice, before anything else.
  const lines = tabletLines().filter(l => !(overdue && l.text === `${top.a.title}: not ticked`));
  return [
    `${greeting()}.`,
    `It is ${clockText()}, ${partLine()}, ${fmt({ day: 'numeric', month: 'long' })}.`,
    ...lines.map(l => sentence(l.text.replace('✓ ', ''))),
    overdue ? `Not ticked off yet: ${top.a.title}, from ${timeText(top.a.time)}. ${sentence(lateAdvice(top.a))}` : '',
    night ? restMessage() : '',
    noteShown() ? sentence(`A note${data.note.from ? ' from ' + data.note.from : ''}: ${data.note.text}`) : '',
    top && !overdue ? `It is time for: ${top.a.title}.` : '',
    beforeDawn() || !next || next === top?.a ? '' : statusOf(next) === 'now' ? `It is time for: ${next.title}.` : `Next is ${next.title}, at ${timeText(next.time)}.`,
    earlier.length && !night ? `Not ticked off from earlier: ${earlier.map(a => a.title).join(', ')}.` : '',
    tomorrowLine(),
  ].filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

// `focus` is a list of selectors, tried in order, for the element that should have focus afterwards,
// so keyboard and screen-reader users don't get dropped back to the top of the page.
let shownDay = ''; // the day the screen was last drawn for
function render(...focus) {
  let screen = screens[ui.screen] ? ui.screen : 'home';
  // Edit forms sit behind the family PIN, even when reached with the Back button.
  if (data.pin && !ui.unlocked && needsPin(screen)) screen = 'family';
  app.dataset.screen = screen;
  app.toggleAttribute('data-person', !FAMILY_SCREENS.includes(screen)); // the screens the person uses: see SLIDE_BUTTONS
  // At night every screen the person uses is dark, so the device is not a lamp at 2 am.
  app.toggleAttribute('data-night', dayPart() === 'night' && screen !== 'family' && !FORM_SCREENS.includes(screen));
  app.innerHTML = screens[screen]() + '<div class="foot">Hazel 🌿 A brighter day, one step at a time.</div>';
  lastLive = liveText();
  shownDay = dayKey();
  restoreDraft();
  const target = ['[data-autofocus]', ...focus].filter(Boolean).map(sel => app.querySelector(sel)).find(Boolean);
  target?.focus({ preventScroll: true });
}

// --- Keeping what is typed ---------------------------------------------------

const readFields = form => [...form.elements].filter(el => el.name && el.type !== 'file').map(el => [el.name, el.type, el.value, el.checked]);
function writeFields(form, fields) {
  for (const [name, type, value, checked] of fields) {
    for (const el of form.elements) {
      if (el.name !== name) continue;
      if (type === 'checkbox' || type === 'radio') { if (el.value === value) el.checked = checked; }
      else el.value = value;
    }
  }
  syncForm(form);
}
// The parts of a form that show, hide or change their wording with a choice.
function syncForm(form) {
  const repeat = form.querySelector('input[name="repeat"]:checked')?.value;
  if (repeat) {
    form.querySelector('.when-weekly').hidden = repeat !== 'weekly';
    form.querySelector('.when-once').hidden = !DATED_REPEATS.includes(repeat);
    form.querySelector('.date-label').textContent = repeat === 'once' ? 'Date' : 'Starting on';
  }
  const other = form.querySelector('.when-other');
  if (other && form.elements.region) other.hidden = form.elements.region.value !== 'other';
  const method = form.querySelector('input[name="method"]:checked')?.value;
  if (method) { // FaceTime also takes an email address
    const phone = form.elements.phone;
    const byPhone = method === 'phone';
    phone.inputMode = byPhone ? 'tel' : 'email';
    phone.placeholder = byPhone ? 'e.g. 0412 345 678' : 'e.g. 0412 345 678 or sarah@example.com';
    form.querySelector('.phone-label').textContent = byPhone ? 'Phone number' : 'Phone number or email address';
  }
}
// Redraws the screen without emptying its forms: for a question asked on a screen with a form on it.
function renderKeeping(...focus) {
  const kept = [...app.querySelectorAll('form')].map(f => [f.dataset.form, readFields(f)]);
  render(...focus);
  for (const [name, fields] of kept) {
    const form = app.querySelector(`form[data-form="${name}"]`);
    if (form) writeFields(form, fields);
  }
}
// A half-filled form, or a panel that could not be saved as it stood, that was on screen when Hazel
// went back to the clock by itself. It is put back the next time that form is opened.
let draft = null;
function keepDraft() {
  const name = { activityForm: 'activity', contactForm: 'contact', setup: 'setup' }[ui.screen] || dirtyForm;
  const form = app.querySelector(`form[data-form="${name}"]`);
  if (form) draft = { screen: ui.screen, id: ui.id, tab: ui.tab, form: name, photo: ui.photo, fields: readFields(form) };
}
function restoreDraft() {
  if (!draft || draft.screen !== ui.screen || draft.id !== ui.id || (ui.screen === 'family' && draft.tab !== ui.tab)) return;
  const form = app.querySelector(`form[data-form="${draft.form}"]`);
  if (!form) return; // behind the PIN for now
  writeFields(form, draft.fields);
  form.insertAdjacentHTML('beforebegin', '<p class="notice draft-note" role="note"><strong>Still here.</strong> What you typed earlier was kept when Hazel went back to the clock. It has not been saved yet.</p>');
  dirty = true;
  dirtyForm = draft.form;
  draft = null;
}
// What an unattended save of Settings left as it was: { items: ['PIN', ...], seen }.
let leftOut = null;
const listText = items => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0] || '');
const FAMILY_HEADING = '.family h3[tabindex]';

// Everything on Home and My Day that changes with the time of day.
let lastLive = '';
function liveText() {
  const top = attention();
  return [dayKey(), greeting(), partLine(), top?.a.id, top?.day, top ? top.late >= NOW_WINDOW : '', noteShown(), tomorrowLine(),
    soundHintNeeded(), tabletLines().map(l => l.text).join(), restMessage(), carried()?.a.id,
    todays().map(a => a.id + statusOf(a) + tooEarly(a) + needsCare(a)).join()].join('|');
}

// ---------------------------------------------------------------------------
// Sheets: a card that fills the screen for a reminder, a "well done", or a number to dial
// ---------------------------------------------------------------------------

const promptEl = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'prompt', hidden: true }));
let sheet = null; // what is showing: { kind: 'reminder' | 'ahead' | 'done' | 'call' | 'test', returnFocus, timer }

// `words` is the part that may scroll; `buttons` are always on the screen, whatever the writing size.
function openSheet(kind, words, buttons, focusSelector = '.primary') {
  const returnFocus = sheet ? sheet.returnFocus : document.activeElement;
  if (sheet) clearTimeout(sheet.timer);
  sheet = { kind, returnFocus };
  if (kind !== 'reminder') reminder = null;
  promptEl.innerHTML = `<div class="prompt-card sheet-${kind}" role="${kind === 'reminder' ? 'alertdialog' : 'dialog'}" aria-modal="true" aria-labelledby="sheet-title">
    <div class="prompt-body">${words}</div>
    <div class="prompt-actions">${buttons}</div>
  </div>`;
  promptEl.hidden = false;
  app.inert = true; // keep taps and the Tab key inside the sheet
  guard(1000); // a tap already on its way must not answer a card that has only just appeared
  promptEl.querySelector(focusSelector)?.focus({ preventScroll: true });
  fitSheet();
}

// The words scroll inside the card when they do not fit, with "More below" under them, and a drag
// that starts on a button then scrolls the words instead of pressing it (see SLIDE_BUTTONS). Only if
// even the buttons do not fit does the whole card scroll.
function fitSheet(measure = true) {
  const card = promptEl.firstElementChild;
  const words = card?.querySelector('.prompt-body');
  if (!words) return;
  const buttons = card.querySelector('.prompt-actions');
  if (measure) {
    // When the words do not all fit, the picture makes way first. (Measured without the "More
    // below" label, which would otherwise count as words.)
    card.classList.remove('tight', 'more');
    card.classList.toggle('tight', words.scrollHeight > words.clientHeight + 1);
    card.classList.toggle('scrolls', card.scrollHeight > card.clientHeight + 1 || buttons.scrollHeight > buttons.clientHeight + 1);
  }
  // "More below" means words are hidden, not only the space under the last line.
  const last = [...words.querySelectorAll('p, h2')].pop();
  const hidden = last ? last.getBoundingClientRect().bottom - parseFloat(getComputedStyle(last).paddingBottom) - words.getBoundingClientRect().bottom : 0;
  const more = hidden > 2;
  card.classList.toggle('more', more);
  card.classList.toggle('scrolled', words.scrollTop > 0);
  if (more || words.scrollTop) words.tabIndex = 0; // reachable with the arrow keys
  else words.removeAttribute('tabindex');
}
promptEl.addEventListener('scroll', () => fitSheet(false), { capture: true, passive: true });
window.addEventListener('resize', () => fitSheet());
// Help is on every card that comes up by itself or stays a while, so it is never more than two taps away.
const SHEET_HELP = '<button class="help-btn sheet-help" data-action="sheet-help">🛟 I need help</button>';

function homeToTop() {
  window.scrollTo(0, 0);
  const hero = app.querySelector('.hero');
  if (hero) hero.scrollTop = 0;
}

function closeSheet() {
  if (!sheet) return;
  clearTimeout(sheet.timer);
  const { returnFocus: back, kind } = sheet;
  sheet = null;
  reminder = null;
  app.inert = false;
  promptEl.hidden = true;
  promptEl.innerHTML = '';
  hush();
  guard(1000); // what is under the finger changes as much as when a card appears
  // Back to the clock: the first screen is never left scrolled part of the way down.
  if (ui.screen === 'home' && kind !== 'call') homeToTop();
  if (back?.isConnected) back.focus({ preventScroll: true });
  else focusHeading();
}

// After a tick: say plainly what was recorded and when, with a way to take it back.
function showDone(a, day = dayKey()) {
  const left = todays().filter(x => !isDone(x.id)).length;
  openSheet('done', `
    <div class="done-tick" aria-hidden="true">✓</div>
    <h2 id="sheet-title">Well done</h2>
    <p class="prompt-note"><b>${esc(a.title)}</b><br>${doneText(a.id, day)}${left ? '' : '<br>That is everything for today 🌷'}${data.setup ? '' : '<br>This is only an example.'}</p>`, `
    <button class="primary" data-action="sheet-close">OK</button>
    ${a.must ? tellLink(`${data.person ? data.person + ': ' : ''}${a.title} ticked off at ${clockText()}. (Sent from Hazel)`, n => `📱 Tell ${n}`) : ''}
    <button class="secondary oops" data-action="sheet-undo" data-id="${a.id}" data-day="${day}">Oops, I haven't done it yet</button>
    ${SHEET_HELP}`);
  // Left alone it goes away by itself. A slow tap aimed at OK must then not tick whatever is underneath.
  sheet.timer = setTimeout(() => {
    closeSheet();
    tickGuardUntil = performance.now() + 3000;
  }, 15000);
}

// Some devices can't start a call from a web page. The link still tries, and the number stays on
// screen in large print until it is dismissed, so it can be dialled by hand.
function showCalling(link) {
  const number = link.dataset.number;
  const emergency = 'emergency' in link.dataset;
  const dial = link.tagName === 'BUTTON'; // the family has said this device cannot ring
  const who = link.dataset.name || number;
  const address = number.includes('@');
  const heading = emergency ? `${dial ? 'Dial' : 'Call'} ${number}` : dial ? `Ring ${who}` : `Calling ${who}`;
  const how = dial ? 'This device cannot make the call. Use the house phone or a mobile, and dial:'
    : emergency ? `If you cannot hear it ringing, dial ${esc(number)} on a phone now.`
    : address ? 'If the call does not start, open FaceTime and call:'
    : 'If the call does not start, dial this on your phone:';
  openSheet('call', `
    ${emergency ? '' : '<div class="prompt-pic" aria-hidden="true">📞</div>'}
    <h2 id="sheet-title">${esc(heading)}</h2>
    <p class="prompt-note">${how}</p>
    <p class="big-number ${address ? 'address' : ''} ${emergency && !dial ? 'again' : ''}">${esc(number)}</p>
    ${emergency ? `<div class="say-card">
      <strong>Tell them</strong>
      ${data.about.fullName ? `<p>My name is <b>${esc(data.about.fullName)}</b>.</p>` : ''}
      ${data.about.address ? `<p>I am at <b>${esc(data.about.address)}</b>.</p>` : '<p>Where you are, and what has happened.</p>'}
      <p>Stay on the phone. They will tell you what to do.</p>
    </div>` : ''}`, `
    <button class="primary" data-action="sheet-close">OK</button>
    ${emergency ? '' : SHEET_HELP}`);
  // Left alone, it goes away by itself so the clock and reminders come back.
  sheet.timer = setTimeout(closeSheet, (emergency ? 30 : 5) * 60_000);
}

// ---------------------------------------------------------------------------
// Reminders: when something is due, Hazel chimes, says it aloud and shows it
// ---------------------------------------------------------------------------

// Screens a reminder never interrupts: the family's own, and the ones someone in trouble is using.
// Every one of them goes back to the clock by itself (see tick), so none can silence Hazel for long.
const QUIET_SCREENS = ['family', 'about', 'calm', 'help', ...FORM_SCREENS];
const prompted = {}; // activity id -> day its reminder card was last opened
const snoozed = {}; // activity id -> { at: time in ms to raise it again, day }
let reminder = null; // the reminder on screen: { id, day, repeat, announced, nextAnnounce, until, html }
// A promise to come back in ten minutes. It belongs to the day the thing was for, so one made just
// before midnight, or after it for last night's tablets, is still kept.
function snooze(id, day = reminder?.id === id ? reminder.day : dayKey()) {
  snoozed[id] = { at: Date.now() + SNOOZE_MINUTES * 60_000, day };
}

// Everything a reminder could be raised for at this moment: today's things, and last night's that
// are still owed after midnight (an important one inside its hour, or one that was promised).
function reminderCandidates() {
  const today = dayKey();
  const now = toMinutes(nowHHMM());
  const out = todays().map(a => ({ a, day: today, late: now - toMinutes(a.time) }));
  const y = daysAgo(1);
  const yesterday = dayKey(y);
  for (const a of data.activities) {
    const late = now + 1440 - toMinutes(a.time);
    if (occursOn(a, y) && ((a.must && late < MUST_WINDOW) || snoozed[a.id]?.day === yesterday)) out.push({ a, day: yesterday, late });
  }
  return out;
}

// The reminder to raise now, if any: { a, day, late }. Important things go first. An ordinary thing
// is raised while it is "now"; an important one at any point in its hour, so opening Hazel late
// still brings it up.
function dueReminder(onlyImportant = false) {
  const today = dayKey();
  const due = reminderCandidates().filter(({ a, day, late }) => {
    if (isDone(a.id, day) || (onlyImportant && !a.must) || late < 0) return false;
    const inWindow = a.must ? late < MUST_WINDOW : day === today && statusOf(a) === 'now';
    const wait = snoozed[a.id];
    // A promised reminder is kept, even if its hour runs out in the meantime.
    if (wait?.day === day) return Date.now() >= wait.at && (inWindow || Date.now() < wait.at + LATE_WINDOW * 60_000);
    return inWindow && prompted[a.id] !== day;
  });
  return due.find(x => x.a.must) || due[0];
}

// Minutes since the reminder's time, counting across midnight.
const reminderLate = a => minutesLate(a) + (reminder.day === dayKey() ? 0 : 1440);

// The words on the card. They follow the clock, and change once the reminder is being repeated:
// Hazel only knows about the tap, so every repeat allows for "already taken".
function reminderText(a, late, repeat, day = dayKey()) {
  const care = needsCare(a, late);
  // On a repeat the question takes the place of the instruction, as it does in the voice.
  const ask = repeat && !care && isTablets(a);
  return `<p class="prompt-when">It's <span data-now>${clockText()}</span>. ${late >= 5 ? `From ${timeText(a.time)}:` : 'Time for:'}</p>
      <h2 id="sheet-title">${esc(a.title)}</h2>
      ${care ? `<p class="prompt-note caution">${esc(lateWords(a, day))}</p>`
        : ask ? `<p class="prompt-ask">Already taken them? Press “I've done this”. Not sure? Check your pill box. Don't take extra.</p>`
        : a.note ? `<p class="prompt-note">${esc(a.note)}</p>` : ''}`;
}
function reminderSpeech(a, late, repeat, day = dayKey()) {
  const now = `It is ${clockText()}.`;
  if (needsCare(a, late)) return `${now} ${a.title}, from ${timeText(a.time)}, is not ticked off. ${sentence(lateWords(a, day))}`;
  if (!repeat) return `${now} Time for: ${a.title}. ${a.note}`;
  return isTablets(a)
    ? `${now} Have you taken your ${a.title}? If you have, press: I've done this. If you are not sure, check your pill box. Don't take extra.`
    : `${now} ${a.title}. Have you done this? If you have, press: I've done this.`;
}

// Chime, then say it. Important things are repeated: after 3 minutes, at 10, then every 10.
function announce(a) {
  const repeat = reminder.repeat || reminder.announced > 0;
  const words = reminderSpeech(a, reminderLate(a), repeat, reminder.day);
  chime(a.must);
  if (data.sound && armed) {
    setTimeout(() => {
      if (reminder?.id === a.id) speak(words, { quiet: true });
    }, a.must ? 3600 : 1200);
  }
  notify(`Hazel: ${a.title}`, a.must ? 'This is waiting on Hazel.' : a.note);
  const gaps = a.must ? [3, 7, 10, 10, 10, 10] : [3];
  const gap = gaps[reminder.announced++];
  reminder.nextAnnounce = gap ? Date.now() + gap * 60_000 : Infinity;
}

// Kept for the family: that the reminder really was on a screen someone could see, when, and
// whether the chime could sound. A card raised while Hazel is behind another app is not counted
// until Hazel is showing again.
function recordRaised(a, day) {
  if (document.visibilityState !== 'visible' || (data.raised[day] ??= {})[a.id]) return;
  data.raised[day][a.id] = { at: nowHHMM(), sound: soundOn() };
  save();
}

function openReminder({ a, day, late }) {
  const repeat = prompted[a.id] === day; // it has been on screen before
  prompted[a.id] = day;
  delete snoozed[a.id];
  const who = findContact(a.contactId);
  const html = reminderText(a, late, repeat, day);
  openSheet('reminder', `
      <div class="prompt-pic" aria-hidden="true">${a.photo ? `<img src="${esc(a.photo)}" alt="">` : esc(a.emoji)}</div>
      <div class="prompt-text">${html}</div>`, `
      <button class="primary" data-action="prompt-done" data-id="${a.id}">✓ &nbsp;I've done this</button>
      <button class="secondary" data-action="prompt-snooze" data-id="${a.id}">Remind me in ${SNOOZE_MINUTES} minutes</button>
      ${hasNumber(who) ? callLink(who, 'secondary call-now', `📞 ${callVerb(who)} ${esc(who.name)}`) : ''}
      ${a.must ? '' : '<button class="skip" data-action="sheet-close">Not now</button>'}
      <button class="help-btn sheet-help" data-action="prompt-help" data-id="${a.id}">🛟 I need help</button>`);
  promptEl.firstElementChild.classList.toggle('urgent', a.must);
  // Every card stays up for at least ten minutes, so one that was promised or opened late is not whisked away.
  reminder = { id: a.id, day, repeat, announced: 0, nextAnnounce: 0, until: Date.now() + SNOOZE_MINUTES * 60_000, html };
  recordRaised(a, day);
  announce(a);
}

// A promise that falls due while something else has the screen (an important card, a call, Family
// settings) waits for it: its quarter of an hour starts when the screen is free again.
function holdPromises() {
  for (const wait of Object.values(snoozed)) if (Date.now() >= wait.at) wait.at = Date.now();
}

function checkReminders() {
  // A warning about something later must not hold up the real thing.
  if (sheet?.kind === 'ahead') {
    const due = dueReminder();
    if (due) openReminder(due);
    return;
  }
  if (sheet && sheet.kind !== 'reminder') return holdPromises();
  if (reminder) {
    const a = findActivity(reminder.id);
    const sameDay = reminder.day === dayKey();
    const late = a ? reminderLate(a) : -1;
    // Take it down once it has been done elsewhere or its time has passed. It then shows as not
    // ticked off; an important one stays at the top of the home screen. One raised late in the
    // evening keeps its hour past midnight.
    const expired = a && Date.now() >= reminder.until && (a.must ? late >= MUST_WINDOW : !sameDay || statusOf(a) !== 'now');
    if (!a || !occursOn(a, parseDay(reminder.day)) || isDone(a.id, reminder.day) || late < 0 || expired) return closeSheet();
    // An important reminder, or a warning about an appointment, takes the place of an ordinary
    // reminder that is still waiting for an answer.
    if (a.must) holdPromises();
    const urgent = a.must ? null : dueReminder(true);
    if (urgent) return openReminder(urgent);
    // So does a reminder that was promised ("Remind me in 10 minutes"). The card it replaces comes
    // round again afterwards, if it is still its time.
    const promised = a.must ? null : dueReminder();
    if (promised && promised.a.id !== a.id && snoozed[promised.a.id]) {
      delete prompted[a.id];
      return openReminder(promised);
    }
    const warning = a.must ? null : dueHeadsUp();
    if (warning) return openHeadsUp(warning);
    recordRaised(a, reminder.day);
    if (Date.now() >= reminder.nextAnnounce) announce(a);
    const html = reminderText(a, late, reminder.repeat || reminder.announced > 1, reminder.day);
    if (html !== reminder.html) {
      // When more than the time changes, the words may move the buttons: a tap already on its way is dropped.
      const still = t => t.replace(/<span data-now>[^<]*<\/span>/, '');
      if (still(html) !== still(reminder.html)) guard(1000);
      reminder.html = html;
      promptEl.querySelector('.prompt-text').innerHTML = html;
      fitSheet();
    }
    return;
  }
  // An example routine must never chime as if it were real.
  if (!data.setup || QUIET_SCREENS.includes(ui.screen)) return holdPromises();
  const due = dueReminder();
  if (due) return openReminder(due);
  const ahead = dueHeadsUp();
  if (ahead) openHeadsUp(ahead);
}

// "Coming up at 2:00 pm: Podiatrist". An earlier warning for appointments, so there is time to get
// ready. It is given at the first free moment from then until the appointment.
function dueHeadsUp() {
  const today = dayKey();
  return todays().find(a => {
    const until = -minutesLate(a);
    return a.lead && !isDone(a.id) && until > 0 && until <= a.lead && prompted['ahead' + a.id] !== today;
  });
}
function openHeadsUp(a) {
  prompted['ahead' + a.id] = dayKey();
  // The instruction for tablets is never shown or said before their time.
  const note = isTablets(a) ? `Not yet. This is for ${timeText(a.time)}.` : a.note;
  openSheet('ahead', `
      <div class="prompt-pic" aria-hidden="true">${a.photo ? `<img src="${esc(a.photo)}" alt="">` : esc(a.emoji)}</div>
      <p class="prompt-when">It's <span data-now>${clockText()}</span>. Coming up at ${timeText(a.time)}:</p>
      <h2 id="sheet-title">${esc(a.title)}</h2>
      ${note ? `<p class="prompt-note">${esc(note)}</p>` : ''}`, `
      <button class="primary" data-action="sheet-close">OK</button>
      ${SHEET_HELP}`);
  chime();
  if (data.sound && armed) setTimeout(() => speak(`It is ${clockText()}. Coming up at ${timeText(a.time)}: ${a.title}. ${note}`, { quiet: true }), 1200);
  notify(`Hazel: ${a.title} at ${timeText(a.time)}`, note);
  sheet.timer = setTimeout(closeSheet, 10 * 60_000);
}

// Lets the family hear and see a reminder while they are there, to check the volume.
function testReminder() {
  openSheet('test', `
      <div class="prompt-pic" aria-hidden="true">🔔</div>
      <p class="prompt-when">It's <span data-now>${clockText()}</span>. Time for:</p>
      <h2 id="sheet-title">A test reminder</h2>
      <p class="prompt-note">${data.sound
        ? 'This is how Hazel looks and sounds when something important is due. If you could not hear it, turn the volume up.'
        : 'This is how Hazel looks when something is due. The chime and voice are switched off (“Chime and speak reminders”), so this test is silent.'}</p>`, `
      <button class="primary" data-action="sheet-close">OK, that works</button>`);
  promptEl.firstElementChild.classList.add('urgent');
  chime(true);
  if (data.sound) setTimeout(() => speak(`It is ${clockText()}. This is a test reminder from Hazel.`, { quiet: true }), 3600);
  sheet.timer = setTimeout(closeSheet, 60_000);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function copyText(text, okMessage) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMessage);
    return true;
  } catch {
    const box = app.querySelector('.copy-box');
    box?.focus();
    box?.select();
    toast('Press and hold the text in the box, then choose Copy.');
    return false;
  }
}

// The first day something new counts. A repeating thing whose time has already passed today starts
// tomorrow, so it is not shown, or recorded, as missed at a time when it did not exist yet.
const startDay = (time, repeat) => dayKey(repeat !== 'once' && time <= nowHHMM() ? daysAgo(-1) : new Date());

// The first day, from tomorrow on, that something happens ('' if not in the next two months).
function firstDay(a) {
  for (let i = 1; i <= 62; i++) if (occursOn(a, daysAgo(-i))) return dayKey(daysAgo(-i));
  return '';
}
const startsText = day => (day === dayKey(daysAgo(-1)) ? 'tomorrow' : 'on ' + whenText(day));

// Hazel counts as set up from the first real change, and the family record starts that day.
function markSetup() {
  // Keeping the example: what has already passed today starts tomorrow, like anything else that is new.
  if (!data.setup) for (const a of data.activities) if (!a.from) a.from = startDay(a.time, a.repeat);
  data.setup = true;
  data.since ||= dayKey();
}

// Takes a tick back, keeps a note of it for the family, and brings the reminder round again if the
// thing is still within its time. Returns null if there was no tick, else whether it will remind.
function takeBack(id, day = dayKey()) {
  const was = doneAt(id, day);
  if (was === undefined) return null;
  (data.undone[day] ??= {})[id] = { was, at: nowHHMM() };
  delete data.completed[day][id];
  delete prompted[id];
  delete snoozed[id];
  const a = findActivity(id);
  if (!a) return false;
  const late = minutesLate(a) + (day === dayKey() ? 0 : 1440); // counted across midnight for last night's
  if (late < 0) return false; // ticked early by mistake: its reminder comes at its time, as if untouched
  const again = a.must ? late < MUST_WINDOW : day === dayKey() && statusOf(a) === 'now';
  if (again) snooze(id, day);
  else prompted[id] = day; // well past its time: it waits on the home screen instead
  return again;
}
const takenBackText = again => `Okay, not ticked.${again ? ` Hazel will remind you again in ${SNOOZE_MINUTES} minutes.` : ''}`;

// Family settings has one Save button per panel. Anything typed is saved before another button
// redraws the page, so it is never thrown away without a word. False means there was a problem
// with what was typed, and it is showing.
let dirtyForm = '';
function saveTyped(unattended = false) {
  if (!dirty || ui.screen !== 'family' || !['note', 'about', 'settings'].includes(dirtyForm)) return true;
  const form = app.querySelector(`form[data-form="${dirtyForm}"]`);
  if (!form) return true;
  forms[dirtyForm](form, unattended);
  return !dirty;
}

// A half-filled form is never left without a word: Back asks first. `leave` is { to: screen } from a
// button on the page, or { back: true } from the device's own Back button.
function askLeave(leave) {
  ui.leave = leave;
  app.querySelector('.leave')?.remove();
  app.querySelector('.topbar')?.insertAdjacentHTML('afterend', `<div class="confirm leave" role="group" aria-label="Leave without saving?">
    <p>What you typed here has not been saved.</p>
    <div class="confirm-actions">
      <button type="button" class="delete" data-action="leave-go">Leave without saving</button>
      <button type="button" class="edit" data-action="leave-stay">Stay here</button>
    </div>
  </div>`);
  const box = app.querySelector('.leave');
  box?.scrollIntoView({ block: 'nearest' });
  box?.querySelector('[data-action="leave-stay"]').focus({ preventScroll: true });
  guard();
}

// What is kept of something taken out of the routine, for the family record.
const retire = a => ({ id: a.id, title: a.title, emoji: a.emoji, must: a.must, time: a.time, repeat: a.repeat, days: a.days, date: a.date, from: a.from, removed: dayKey(), removedAt: nowHHMM() });

const actions = {
  tab(el) {
    if (!saveTyped()) return;
    Object.assign(ui, { tab: el.dataset.tab, confirming: null, backup: '', restore: null, summary: '' });
    dirty = false;
    render('[role="tab"][aria-selected="true"]');
  },
  ask(el) {
    if (!saveTyped()) return;
    ui.confirming = el.dataset.confirm;
    render();
    guard();
    app.querySelector('.confirm [data-action="cancel"]')?.closest('.confirm').scrollIntoView({ block: 'nearest' }); // both answers on screen
  },
  cancel() {
    if (!saveTyped()) return;
    const was = ui.confirming;
    ui.confirming = null;
    ui.restore = null;
    // On the set-up screen the form (and a pasted copy) stays as it was typed.
    (ui.screen === 'setup' ? renderKeeping : render)(`[data-confirm="${was}"]`, '[data-action="skip-setup"]');
  },
  finish(el, id) {
    const a = findActivity(id);
    if (!a || performance.now() < tickGuardUntil) return;
    const day = el?.dataset.day || dayKey();
    if (day !== dayKey()) {
      // Last night's important thing, still within its hour after midnight.
      if (!carriedAll().some(x => x.a === a && x.day === day)) return render();
    } else if (!occursOn(a) || tooEarly(a)) {
      return render();
    }
    if (isDone(id, day)) return render();
    markDone(id, day);
    if (!save()) toast(NOT_SAVED);
    if (ui.screen === 'activity') {
      // Activities are opened from My Day, so step back to that entry rather than adding another.
      let fromDay = false;
      try { fromDay = history.state?.screen === 'activity'; } catch { /* ignore */ }
      if (fromDay) stepBack();
      else go('day', null, { replace: true });
    } else {
      render('h1, .page-title');
    }
    showDone(a, day);
  },
  undo(_, id) {
    const again = takeBack(id);
    if (again === null) return;
    ui.confirming = null;
    toast(save() ? takenBackText(again) : NOT_SAVED);
    render('[data-action="finish"]');
    guard();
  },
  'prompt-done'(_, id) {
    const a = findActivity(id);
    if (!a) return closeSheet();
    // A card answered just after midnight is recorded for the day it was raised.
    const day = reminder?.id === id ? reminder.day : dayKey();
    if (day === dayKey() && (!occursOn(a) || tooEarly(a))) {
      closeSheet();
      return render();
    }
    if (!isDone(id, day)) markDone(id, day);
    if (!save()) toast(NOT_SAVED);
    render();
    showDone(a, day);
  },
  'prompt-snooze'(_, id) {
    snooze(id);
    closeSheet();
    tickGuardUntil = performance.now() + 2500; // "did that work?": a second press must not tick what is underneath
    toast(`Okay. Hazel will remind you again in ${SNOOZE_MINUTES} minutes.`);
  },
  // Help is one tap away even while a reminder is waiting. The reminder comes back afterwards.
  'prompt-help'(_, id) {
    snooze(id);
    closeSheet();
    go('help');
  },
  'sheet-close'() {
    const kind = sheet?.kind;
    closeSheet();
    if (kind === 'reminder' || kind === 'call') tickGuardUntil = performance.now() + 2500; // as above
  },
  'sheet-help'() {
    closeSheet();
    go('help');
  },
  'leave-stay'() {
    app.querySelector('.leave')?.remove();
    focusHeading();
  },
  'leave-go'() {
    const leave = ui.leave;
    dirty = false;
    if (leave?.back) stepBack();
    else go(leave?.to || 'family');
  },
  // The country an earlier version chose by itself is confirmed once by the family.
  'region-ok'() {
    if (!saveTyped()) return;
    data.regionOk = true;
    saved(`The emergency number stays ${region().emergency}.`);
    render(FAMILY_HEADING);
  },
  'region-change'() {
    if (!saveTyped()) return;
    Object.assign(ui, { tab: 'settings', confirming: null, regionAsked: true }); // the next Save answers the question
    render();
    const pick = app.querySelector('select[name="region"]');
    pick?.scrollIntoView({ block: 'center' });
    pick?.focus({ preventScroll: true });
  },
  'sheet-undo'(el, id) {
    const again = takeBack(id, el.dataset.day || dayKey());
    closeSheet();
    render();
    if (again !== null) toast(save() ? takenBackText(again) : NOT_SAVED);
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
  // Says what the screen says, so the voice can never tell someone to take tablets that the
  // screen says are done, not yet due, or hours late.
  'speak-activity'(el, id) {
    const a = findActivity(id);
    if (!a) return;
    const today = occursOn(a);
    let words;
    if (carriedAll().some(x => x.a === a)) {
      words = `${timeText(a.time)}. ${a.note}`; // last night's, still within its hour: it is due now
    } else if (today && isDone(a.id)) {
      words = `${doneText(a.id)}.${isTablets(a) ? ' You ticked these off today. No need to take them again.' : ''}`;
    } else if (today && tooEarly(a)) {
      const before = lastNight().find(x => x.a === a);
      words = `Not yet. This is for ${timeText(a.time)}. It is ${clockText()} now.${before ? ' ' + sentence(lastNightText(before)) : ''}`;
    } else if (today && needsCare(a)) {
      words = `This was for ${timeText(a.time)}. ${sentence(lateAdvice(a))}${a.ifLate ? '' : ' Ask family or your pharmacist first.'}`;
    } else if (today) {
      words = `${timeText(a.time)}. ${a.note}`;
    } else {
      const next = comingUp().find(x => x.a === a);
      // The instruction for tablets, or anything important, is only read on its own day.
      words = `${next ? `This is ${next.date === dayKey(daysAgo(-1)) ? 'tomorrow' : 'on ' + whenText(next.date)}, at ${timeText(a.time)}.` : 'This is not on today.'} ${isTablets(a) || a.must ? '' : a.note}`;
    }
    speak(`${a.title}. ${words}`, { el });
  },
  'read-day'(el) {
    const list = todays();
    const soon = comingUp()[0];
    const held = carried();
    const say = (label, items, f) => (items.length ? `${label}: ${items.map(f).join(', ')}.` : '');
    speak([
      `It is ${clockText()}, ${partLine()}.`,
      ...lastNight().map(x => sentence(lastNightText(x))),
      say('Done', list.filter(a => isDone(a.id)), a => `${a.title}${doneAt(a.id) ? ', ' + tickWords(a, doneAt(a.id)) : ''}`),
      say('Now', [...(held ? [held.a] : []), ...list.filter(a => statusOf(a) === 'now')], a => a.title),
      say('Not ticked off from earlier', list.filter(a => statusOf(a) === 'earlier'), a => a.title),
      say('Still to come', list.filter(a => statusOf(a) === 'upcoming'), a => `${a.title} at ${timeText(a.time)}`),
      list.length ? '' : 'Nothing is planned today.',
      soon ? `Coming up: ${soon.a.title}, ${whenText(soon.date)} at ${timeText(soon.a.time)}.` : '',
    ].filter(Boolean).join(' '), { el });
  },
  // Tapping the clock reads too. Either way the Read button in the corner turns into "Stop".
  'read-home'(el) {
    speak(homeSpeech(), { el: app.querySelector('.hero-top [data-action="read-home"]') || el });
  },
  'read-note'() {
    speak(`${data.note.from ? 'A note from ' + data.note.from : 'A note for you'}. ${data.note.text}`);
  },
  'speak-calm'(el) {
    speak(`${dayPart() === 'night' ? CALM_NIGHT : CALM_MESSAGE} It is ${clockText()}, ${partLine()}.`, { el });
  },
  bigger(el) {
    hush(); // the Stop button is about to be redrawn
    const sizes = ['normal', 'large', 'largest'];
    data.size = sizes[(sizes.indexOf(data.size) + 1) % sizes.length];
    applySettings();
    if (!save()) toast(NOT_SAVED);
    render('[data-action="bigger"]');
    guard();
  },
  'no-phone'(_, id) {
    const c = findContact(id);
    if (c) toast(`${c.name} has no phone number yet. A family member can add it in Family settings.`);
  },
  'contact-up'(_, id) {
    if (!saveTyped()) return;
    const i = data.contacts.findIndex(c => c.id === id);
    if (i > 0) [data.contacts[i - 1], data.contacts[i]] = [data.contacts[i], data.contacts[i - 1]];
    if (!save()) toast(NOT_SAVED);
    // Focus stays on the row that moved: its arrow, or its Edit button once it is at the top.
    render(`[data-action="contact-up"][data-id="${id}"]`, `[data-go="contactForm"][data-id="${id}"]`, FAMILY_HEADING);
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
    f.querySelector('.date-label').textContent = 'Date';
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
    const input = pick.querySelector('input');
    input.value = '';
    input.focus(); // the button that was pressed has just hidden itself
  },
  'remove-activity'(_, id) {
    if (!saveTyped()) return;
    const i = data.activities.findIndex(x => x.id === id);
    ui.confirming = null;
    if (i < 0) return render(FAMILY_HEADING);
    const [a] = data.activities.splice(i, 1);
    // Kept for the family record, so earlier days (and today, if it was ticked or already past)
    // still show what was planned and what was ticked.
    data.retired.push(retire(a));
    markSetup();
    render(FAMILY_HEADING);
    saved(`Removed “${a.title}”.`, { action: { label: 'Put it back', run() {
      data.activities.splice(i, 0, a);
      data.retired = data.retired.filter(r => r.id !== a.id);
      saved(`“${a.title}” is back.`);
      render(FAMILY_HEADING);
    } } });
  },
  'remove-contact'(_, id) {
    if (!saveTyped()) return;
    const i = data.contacts.findIndex(x => x.id === id);
    ui.confirming = null;
    if (i < 0) return render(FAMILY_HEADING);
    const [c] = data.contacts.splice(i, 1);
    const used = data.activities.filter(a => a.contactId === id);
    for (const a of used) a.contactId = null;
    markSetup();
    render(FAMILY_HEADING);
    saved(`Removed ${c.name}.`, { action: { label: 'Put them back', run() {
      data.contacts.splice(i, 0, c);
      for (const a of used) a.contactId = c.id;
      saved(`${c.name} is back.`);
      render(FAMILY_HEADING);
    } } });
  },
  'reset-done'() {
    if (!saveTyped()) return;
    ui.confirming = null;
    delete data.completed[dayKey()];
    // The reminders start afresh too, so anything still within its time comes up again.
    for (const k of Object.keys(prompted)) if (!k.startsWith('ahead')) delete prompted[k];
    for (const k of Object.keys(snoozed)) delete snoozed[k];
    saved("Today's ticks have been cleared.");
    render(FAMILY_HEADING);
  },
  summary() {
    if (!saveTyped()) return;
    ui.summary = weekSummaryText();
    render('[data-action="summary"]');
    copyText(ui.summary, 'Copied. Paste it into a message to the family.');
  },
  // Hands the summary to the device's own Messages, Mail or other sharing.
  'share-summary'() {
    if (!saveTyped()) return;
    try {
      navigator.share({ text: weekSummaryText() }).catch(() => {});
    } catch { toast('This device cannot share from here. Use “Copy the last 7 days as text”.'); }
  },
  backup() {
    if (!saveTyped()) return;
    // Written without a single space, so an email program that wraps long lines at spaces cannot
    // run words together: stripping the line breaks it added gives back exactly this text.
    ui.backup = BACKUP_PREFIX + JSON.stringify({ ...data, backedUp: dayKey() }).replace(/ /g, '\\u0020');
    render('[data-action="backup"]');
    // The checklist is only ticked once the copy has really been made.
    copyText(ui.backup, 'Copied. Paste it into an email or message to yourself.').then(ok => { if (ok) markBackedUp(); });
  },
  'restore-apply'() {
    if (!ui.restore) return;
    // After a forgotten PIN the ticks recorded on this device since the copy was made are kept, and
    // so is the record of anything that is in the routine here but not in the copy.
    const copy = ui.restore;
    const fresh = ui.screen === 'setup'; // a new or cleared device
    const calls = data.calls;
    Object.assign(data, ui.keepHistory ? {
      ...copy,
      // Anything the copy brings that is not in the routine here starts afresh, so it is not blamed
      // for days it was not there and is never listed twice beside its own removed entry.
      activities: copy.activities.map(a => (data.activities.some(x => x.id === a.id) ? a : { ...a, from: startDay(a.time, a.repeat) })),
      since: data.since || copy.since || dayKey(),
      retired: [...copy.retired, ...data.retired.filter(r => !copy.retired.some(c => c.id === r.id)),
        ...data.activities.filter(a => !copy.activities.some(c => c.id === a.id)).map(retire)],
      completed: { ...copy.completed, ...data.completed },
      undone: { ...copy.undone, ...data.undone },
      seen: { ...copy.seen, ...data.seen },
      raised: { ...copy.raised, ...data.raised },
    } : copy);
    // Whether calls work is a fact about the device, not the copy: a new device is asked to try one,
    // and a device that has already answered keeps its answer.
    data.calls = fresh ? '' : calls;
    Object.assign(ui, { restore: null, keepHistory: false, confirming: null, unlocked: true, forgot: false });
    applySettings();
    try { navigator.storage?.persist?.(); } catch { /* optional */ }
    saved('Restored from the copy.');
    if (ui.screen === 'setup') return go('family', null, { replace: true });
    render(FAMILY_HEADING);
  },
  forgot() {
    ui.forgot = true;
    render(FAMILY_HEADING);
  },
  // Keeping the example still needs the country confirmed: the emergency number depends on it.
  'skip-setup'() {
    const f = app.querySelector('form[data-form="setup"]');
    const pick = f.elements.region.value;
    if (!REGIONS[pick]) return showError(f, 'Please choose the country first, so the emergency number is right.', 'region');
    const emergency = f.elements.emergency.value.trim();
    if (pick === 'other' && !validEmergency(emergency)) return showError(f, 'Please type the emergency number for this country, digits only.', 'emergency');
    data.region = pick;
    data.emergency = pick === 'other' ? emergency : '';
    ui.confirming = 'skip';
    // Keeping the example means what was typed above is not used: the question says so.
    ui.skipLoses = ['person', 'pin', 'cname0', 'cphone0', 'cname1', 'cphone1', 'cname2', 'cphone2'].some(n => f.elements[n].value.trim());
    renderKeeping();
    guard();
    app.querySelector('.confirm')?.scrollIntoView({ block: 'nearest' });
  },
  'skip-confirm'() {
    markSetup();
    data.regionOk = true;
    Object.assign(ui, { unlocked: true, confirming: null });
    applySettings();
    if (!save()) toast(NOT_SAVED);
    go('family', null, { replace: true });
  },
  'notify-allow'() {
    try {
      Notification.requestPermission().then(answer => {
        toast(answer === 'granted' ? 'Notifications are allowed on this device.' : 'Notifications are not allowed here. Check the browser or device settings.');
        if (ui.screen === 'family' && !dirty) render('[data-action="notify-allow"]');
      });
    } catch { toast('This device cannot show notifications.'); }
  },
};

// Reads a pasted backup copy. Email and messaging apps wrap long lines, add a signature, or turn
// straight quotes curly, so the copy is found inside whatever surrounds it.
function readBackup(text) {
  const not = { ok: false, message: 'That does not look like a Hazel backup copy. Paste the whole thing, starting with HAZEL-BACKUP.' };
  const cut = { ok: false, message: 'This copy looks cut short or changed. Copy it again from where you kept it, all the way to the last }.' };
  const start = text.search(/hazel-backup:/i);
  let body = start >= 0 ? text.slice(start + BACKUP_PREFIX.length) : text;
  const open = body.indexOf('{');
  const close = body.lastIndexOf('}');
  if (open < 0 || close < open) return start >= 0 ? cut : not;
  body = body.slice(open, close + 1).replace(/[\r\n]+/g, ''); // a real copy has no line breaks of its own
  for (const attempt of [body, body.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")]) {
    try {
      const parsed = JSON.parse(attempt);
      return parsed && Array.isArray(parsed.activities) && Array.isArray(parsed.contacts) ? { ok: true, data: parsed } : not;
    } catch { /* try the next reading */ }
  }
  return cut;
}

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
    const repeat = REPEATS.some(r => r[0] === f.elements.repeat.value) ? f.elements.repeat.value : 'daily';
    const dated = DATED_REPEATS.includes(repeat);
    const days = [...f.querySelectorAll('input[name="days"]:checked')].map(i => Number(i.value));
    const date = f.elements.date.value;
    const existing = findActivity(ui.id);
    if (!validTime(f.elements.time.value)) return showError(f, 'Please give the time, like 08:00 or 14:30.', 'time');
    if (repeat === 'weekly' && !days.length) return showError(f, 'Please choose at least one day of the week.', 'days');
    if (dated && !validDay(date)) return showError(f, repeat === 'once' ? 'Please choose the date.' : 'Please choose the first date.', 'date');
    if (repeat === 'once' && date < dayKey() && date !== existing?.date) return showError(f, 'That date has already passed. Please check the date.', 'date');
    const fields = {
      time: f.elements.time.value,
      title,
      note: f.elements.note.value.trim(),
      ifLate: f.elements.ifLate.value.trim(),
      emoji: f.elements.emoji.value || existing?.emoji || ACTIVITY_PICTURES[0],
      photo: ui.photo ?? existing?.photo ?? '',
      repeat,
      days: repeat === 'weekly' ? days : [],
      date: dated ? date : '',
      must: f.elements.must.checked,
      lead: Number(f.elements.lead.value) || 0,
      contactId: f.elements.contactId?.value ? Number(f.elements.contactId.value) : null,
    };
    if (existing) {
      // A new time or day is a new appointment as far as reminders go.
      if (existing.time !== fields.time || existing.repeat !== fields.repeat || existing.date !== fields.date || existing.days.join() !== fields.days.join()) {
        delete prompted[existing.id];
        delete prompted['ahead' + existing.id];
        delete snoozed[existing.id];
        // Something that has not really begun (added today or starting tomorrow, with nothing recorded
        // for it today) begins according to its new time: later today means today after all.
        const today = dayKey();
        const untouched = ![data.completed, data.undone, data.raised].some(record => existing.id in (record[today] || {}));
        if (existing.from >= today && untouched) existing.from = startDay(fields.time, repeat);
      }
      Object.assign(existing, fields);
    } else {
      data.activities.push({ id: newId(), from: startDay(fields.time, repeat), ...fields });
    }
    markSetup();
    ui.tab = 'activities';
    // Say so only when today would have been one of its days, and name the day it really first happens.
    const made = existing || data.activities[data.activities.length - 1];
    const first = made.from > dayKey() && occursOn({ ...made, from: '' }) ? firstDay(made) : '';
    saved(first ? `Saved. “${title}” starts ${startsText(first)}, because ${timeText(fields.time)} has already passed today.` : 'Saved.');
    stepBack();
  },
  contact(f) {
    const name = f.elements.name.value.trim();
    if (!name) return showError(f, 'Please enter a name.', 'name');
    const phone = f.elements.phone.value.trim();
    const method = CALL_METHODS[f.elements.method.value] ? f.elements.method.value : 'phone';
    if (method === 'phone' && phone.includes('@')) return showError(f, 'That is an email address. Choose FaceTime below, or enter a phone number.', 'phone');
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
    markSetup();
    ui.tab = 'contacts';
    saved('Saved.');
    stepBack();
  },
  note(f) {
    const until = f.elements.until.value;
    if (until && !validDay(until)) return showError(f, 'Please give the date as year-month-day, like 2026-03-04.', 'until');
    if (until && until < dayKey() && f.elements.text.value.trim()) return showError(f, 'That date has already passed, so the note would not be shown.', 'until');
    data.note = { text: f.elements.text.value.trim(), from: f.elements.from.value.trim(), until };
    dirty = false;
    saved(data.note.text ? 'Note saved. It is on the home screen now.' : 'Note removed.');
    render('form[data-form="note"] .primary');
  },
  about(f) {
    if (f.elements.dob.value && !validDay(f.elements.dob.value)) return showError(f, 'Please give the date of birth as year-month-day, like 1946-03-04.', 'dob');
    for (const name of ABOUT_FIELDS) data.about[name] = f.elements[name].value.trim();
    dirty = false;
    saved('Details saved.');
    render('form[data-form="about"] .primary');
  },
  // `unattended`: nobody pressed Save. Hazel is keeping what was typed before going back to the clock,
  // so the things that could lock the family out or change the emergency number are left as they were.
  settings(f, unattended = false) {
    const pin = f.elements.pin.value.trim();
    const place = REGIONS[f.elements.region.value] ? f.elements.region.value : data.region;
    const emergency = f.elements.emergency.value.trim();
    const calls = ['yes', 'no'].includes(f.elements.calls.value) ? f.elements.calls.value : '';
    const differs = {
      pin: pin !== data.pin,
      country: place !== data.region || (place === 'other' && emergency !== (data.emergency || REGIONS.other.emergency)),
      calls: calls !== data.calls,
    };
    if (!unattended) {
      if (pin && !/^\d{4,8}$/.test(pin)) return showError(f, 'The PIN must be 4 to 8 digits, or left blank.', 'pin');
      if (place === 'other' && !validEmergency(emergency)) return showError(f, 'Please type the emergency number for this country, digits only.', 'emergency');
      // The one-off country question is answered by changing the country, or by saving after
      // "No, change the country". Saving something else on this panel does not answer it.
      if (differs.country || ui.regionAsked) data.regionOk = true;
      data.region = place;
      data.emergency = place === 'other' ? emergency : '';
      data.calls = calls;
      data.pin = pin;
      if (pin) ui.unlocked = true;
      leftOut = null;
    } else {
      const left = [differs.pin && 'PIN', differs.country && 'country', differs.calls && 'answer about phone calls'].filter(Boolean);
      leftOut = left.length ? { items: left, seen: false } : null;
    }
    data.person = f.elements.person.value.trim();
    data.tell = f.elements.tell.checked;
    data.size = f.elements.size.value || 'normal';
    data.sound = f.elements.sound.checked;
    data.awake = f.elements.awake.checked;
    if (validTime(f.elements.nightFrom.value)) data.nightFrom = f.elements.nightFrom.value;
    if (validTime(f.elements.nightTo.value)) data.nightTo = f.elements.nightTo.value;
    applySettings();
    data.awake ? requestWakeLock() : releaseWakeLock();
    dirty = false;
    if (unattended) return void save(); // nobody is there to read a message: the panel says later what was left out
    saved('Settings saved.');
    render('form[data-form="settings"] .primary');
  },
  restore(f) {
    const pasted = f.elements.backup.value;
    if (!saveTyped()) return;
    if (!f.isConnected) { // saving what was typed redrew the page: carry on with the form now on screen
      f = app.querySelector('form[data-form="restore"]');
      if (!f) return;
      f.elements.backup.value = pasted;
    }
    const read = readBackup(pasted);
    if (!read.ok) return showError(f, read.message, 'backup');
    const locked = !!data.pin && !ui.unlocked; // reached from "Forgot the PIN?"
    // A copy made with this very PIN proves who is asking: just unlock, and leave everything else alone.
    if (locked && String(read.data.pin ?? '') === data.pin) {
      data.pin = '';
      Object.assign(ui, { unlocked: true, forgot: false });
      saved('That copy was made with this PIN, so Hazel is unlocked and the PIN is cleared. Nothing else was changed.');
      render();
      return focusHeading();
    }
    ui.restore = normalize({ ...read.data, setup: true, ...(locked ? { pin: '' } : {}) }, true);
    ui.keepHistory = locked;
    ui.confirming = 'restore';
    renderKeeping(); // the pasted copy, and a half-filled set-up form above it, stay as they are
    guard();
    app.querySelector('.confirm [data-action="cancel"]')?.closest('.confirm').scrollIntoView({ block: 'nearest' });
  },
  erase(f) {
    if (f.elements.word.value.trim().toUpperCase() !== 'ERASE') return showError(f, 'Type the word ERASE to confirm.', 'word');
    // The country stays: the emergency number must not quietly change back to a default.
    Object.assign(data, normalize({ ...SEED, region: data.region, emergency: data.emergency, calls: data.calls }, false));
    applySettings();
    saved('Hazel has been erased on this device and is showing the example again.');
    go('home', null, { replace: true });
  },
  setup(f) {
    const person = f.elements.person.value.trim();
    if (!person) return showError(f, 'Please say what they like to be called.', 'person');
    const place = f.elements.region.value;
    if (!REGIONS[place]) return showError(f, 'Please choose the country, so the emergency number is right.', 'region');
    const emergency = f.elements.emergency.value.trim();
    if (place === 'other' && !validEmergency(emergency)) return showError(f, 'Please type the emergency number for this country, digits only.', 'emergency');
    const pin = f.elements.pin.value.trim();
    if (pin && !/^\d{4,8}$/.test(pin)) return showError(f, 'The PIN must be 4 to 8 digits, or left blank.', 'pin');
    const contacts = [];
    for (const i of [0, 1, 2]) {
      const name = f.elements['cname' + i].value.trim();
      const phone = f.elements['cphone' + i].value.trim();
      if (!name && !phone) continue;
      if (!name) return showError(f, 'Please give a name for that phone number.', 'cname' + i);
      if (phone.includes('@')) return showError(f, 'That is an email address. Put a phone number here, or leave it blank and add FaceTime for them afterwards, under People.', 'cphone' + i);
      if (phone && phone.replace(/[^\d]/g, '').length < 3) return showError(f, 'That phone number looks too short.', 'cphone' + i);
      contacts.push({ id: newId(), name, relation: f.elements['crel' + i].value.trim(), phone, method: 'phone', emoji: CONTACT_PICTURES[i], photo: '' });
    }
    const activities = ROUTINES.filter(r => f.elements['r-' + r.key].checked).map(r => {
      const time = validTime(f.elements['t-' + r.key].value) ? f.elements['t-' + r.key].value : r.time;
      return { id: newId(), time, title: r.title, emoji: r.emoji, note: r.note,
        ifLate: '', photo: '', repeat: 'daily', days: [], date: '', from: startDay(time, 'daily'), must: r.emoji === '💊', lead: 0, contactId: null };
    });
    Object.assign(data, {
      setup: true, since: dayKey(), person, pin, region: place, emergency: place === 'other' ? emergency : '', regionOk: true,
      contacts, activities, retired: [], completed: {}, undone: {}, seen: {}, raised: {},
    });
    applySettings();
    try { navigator.storage?.persist?.(); } catch { /* optional */ }
    ui.unlocked = true;
    ui.tab = 'contacts';
    const later = activities.filter(a => a.from > dayKey()).map(a => a.title);
    saved(`Hazel is ready.${later.length ? ` ${listText(later)} ${later.length > 1 ? 'start' : 'starts'} tomorrow, because ${later.length > 1 ? 'their times have' : 'its time has'} passed today.` : ''} Add photos, appointments and emergency details here whenever you like.`);
    go('family', null, { replace: true });
  },
};

// Show a form problem right under the field it is about, without re-rendering, so nothing typed is
// lost and the message is on screen where the cursor lands.
function showError(form, message, field) {
  form.querySelector('.error')?.remove();
  const html = `<p class="error" role="alert">${esc(message)}</p>`;
  const target = form.elements[field];
  const input = target instanceof RadioNodeList ? target[0] : target;
  const holder = input?.closest('label.field, .person-row, .choices');
  if (holder) holder.insertAdjacentHTML('afterend', html);
  else form.querySelector('button:not([type="button"])').insertAdjacentHTML('beforebegin', html);
  input?.focus();
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

let lastTouch = performance.now(); // on a clock that never jumps, like the tap guard
let dirty = false; // something has been typed into a family form and not saved

document.addEventListener('click', e => {
  arm();
  lastTouch = performance.now();
  byKeyboard = e.detail === 0;
  const wasHeld = held; // this tap is the finger lifting after a press and hold
  held = false;
  // A screen left showing over midnight is redrawn before anything on it can be ticked, so a tap
  // can never record tonight's tablets on a button drawn yesterday.
  if (!sheet && LIVE_SCREENS.includes(ui.screen) && dayKey() !== shownDay) {
    e.preventDefault();
    render('h1, .page-title');
    guard(800);
    return;
  }
  // A press that slid has already been counted (see SLIDE_BUTTONS). If the browser also sends its
  // own click for the same press, that one is dropped, so nothing is pressed twice.
  if (e.isTrusted && e.detail !== 0 && performance.now() - slidAt < 400) {
    e.preventDefault();
    return;
  }
  // Taps straight after the screen changes are dropped (see guard). Keyboard presses are not taps.
  if (e.detail !== 0 && performance.now() < guardUntil) {
    e.preventDefault();
    // On the emergency button, silence could read as "it doesn't work".
    if (e.target.closest('[data-emergency]')) toast('Press the red button once more.');
    return;
  }
  // Something that calls: let a link try to start the call, and put the number on screen in case it can't.
  const call = e.target.closest('[data-number]');
  if (call) {
    if (reminder) snooze(reminder.id); // the reminder that was showing comes back after the call
    return showCalling(call);
  }

  // Family settings opens with a press and hold, so it isn't wandered into. A plain tap explains.
  const hold = e.target.closest('[data-hold]');
  if (hold) {
    if (e.detail === 0) {
      ui.unlocked = true;
      go(hold.dataset.hold);
    } else if (!wasHeld) {
      toast('For family: press and hold this button for two seconds.');
    }
    return;
  }
  const el = e.target.closest('[data-go], [data-action]');
  if (!el) return;
  const id = el.dataset.id ? Number(el.dataset.id) : null;
  if (el.dataset.go) {
    if (!saveTyped()) return; // leaving Family settings: keep what was typed
    if (dirty && FORM_SCREENS.includes(ui.screen)) return askLeave({ to: el.dataset.go }); // a half-filled form asks first
    return go(el.dataset.go, id);
  }
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
    ui.unlocked = true; // opened on purpose: it stays reachable until the clock is showing again
    go(el.dataset.hold);
  }, HOLD_MS);
});
for (const type of ['pointerup', 'pointercancel']) {
  document.addEventListener(type, () => {
    clearTimeout(holdTimer);
    setTimeout(() => { held = false; }, 0); // after the click that follows, if there is one
  });
}
document.addEventListener('contextmenu', e => {
  if (e.target.closest('[data-hold]')) e.preventDefault(); // a long press must not open the browser's menu
});

// A trembling finger often slides a little while pressing, and the browser then does not count it
// as a tap. On every card that fills the screen, and on every button of the person's own screens, a
// press that starts and ends on the same button counts, even if it slid. Where the page (or a tall
// card) has to scroll, an up-and-down drag still scrolls and presses nothing (touch-action: pan-y in
// styles.css makes the browser take it over and cancel the press), so only a sideways slide counts
// there. Trying to scroll can therefore never start a call or tick tablets.
const SLIDE_BUTTONS = '.prompt-card button, .prompt-card a, .app[data-person] button:not(.hold), .app[data-person] a';
let press = null;
let slidAt = -1e9; // when a slid press was last counted
document.addEventListener('pointerdown', e => {
  const el = e.pointerType === 'mouse' ? null : e.target.closest(SLIDE_BUTTONS);
  // On a card whose words do not all fit, an up-and-down drag that starts on a button scrolls the
  // words, and presses nothing: trying to read the rest of an instruction must never tick the tablets.
  const words = el?.closest('.prompt-card.more, .prompt-card.scrolled')?.querySelector('.prompt-body') || null;
  press = el ? { el, x: e.clientX, y: e.clientY, last: e.clientY, words, scrolling: false } : null;
});
document.addEventListener('pointermove', e => {
  if (!press?.words) return;
  const dy = e.clientY - press.y;
  if (!press.scrolling && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(e.clientX - press.x)) press.scrolling = true;
  if (press.scrolling) press.words.scrollTop -= e.clientY - press.last;
  press.last = e.clientY;
});
document.addEventListener('pointercancel', () => { press = null; });
document.addEventListener('pointerup', e => {
  if (!press) return;
  const { el, x, y, scrolling } = press;
  press = null;
  if (scrolling) { // it was a scroll of the words, not a press: the browser's own click, if any, is dropped too
    slidAt = performance.now();
    return;
  }
  const travel = Math.hypot(e.clientX - x, e.clientY - y);
  // A very small slide is an ordinary tap, which the browser sends itself. Where it also sends one
  // for a longer slide, that second click is dropped by the click handler.
  if (travel < 10 || travel > 60 || !el.isConnected || !el.contains(document.elementFromPoint(e.clientX, e.clientY))) return;
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  slidAt = performance.now();
});

document.addEventListener('keydown', e => {
  arm();
  lastTouch = performance.now();
  if (e.key === 'Escape') {
    // Escape closes a sheet, except an important reminder, which has to be answered. Otherwise it
    // answers "No" to a question that is showing.
    if (sheet) {
      if (!(reminder && findActivity(reminder.id)?.must)) closeSheet();
    } else if (ui.confirming) {
      actions.cancel();
    }
    return;
  }
  // In the longer forms the Enter (or Go) key never saves from inside a box: in a text box it moves
  // to the next one, and on a choice it does nothing. Saving half a form by accident would leave
  // Hazel set up with no people and no tablets. Only the Save button itself saves.
  if (e.key === 'Enter' && e.target.matches?.('input, select')
    && e.target.closest('form[data-form="setup"], form[data-form="activity"], form[data-form="contact"]')) {
    e.preventDefault();
    if (e.target.matches('select, [type="checkbox"], [type="radio"], [type="file"]')) return;
    const fields = [...e.target.form.querySelectorAll('input, select, textarea, button')].filter(x => !x.disabled && x.type !== 'file' && x.offsetParent);
    fields[fields.indexOf(e.target) + 1]?.focus();
  }
});

// Reading and scrolling count as using the screen, so a slow reader is not sent back to the clock.
for (const type of ['scroll', 'wheel', 'pointerdown', 'touchstart']) {
  window.addEventListener(type, () => { lastTouch = performance.now(); }, { passive: true, capture: true });
}

app.addEventListener('submit', e => {
  e.preventDefault();
  forms[e.target.dataset.form]?.(e.target);
});

app.addEventListener('input', e => {
  lastTouch = performance.now();
  const name = e.target.form?.dataset.form || '';
  // Typing a PIN, or pasting a copy to restore, is not an unsaved change.
  if (['unlock', 'restore', 'erase'].includes(name)) return;
  dirty = true;
  dirtyForm = name;
});

// The backup counts as made once it has really been copied, by the button or by hand.
function markBackedUp() {
  data.backedUp = dayKey();
  save();
  // The checklist and the "last copy made" line on the same screen say so straight away, also when
  // the copy was made by hand from the box (after the copy itself has happened).
  const inBox = !!app.querySelector('.copy-box:focus');
  setTimeout(() => {
    if (ui.screen === 'family' && ui.tab === 'settings' && ui.backup && !dirty) render(inBox ? '.copy-box' : '[data-action="backup"]');
  }, 0);
}
document.addEventListener('copy', e => {
  if (ui.backup && e.target?.closest?.('.copy-box')) markBackedUp();
});

app.addEventListener('change', async e => {
  const t = e.target;
  if (['repeat', 'region', 'method'].includes(t.name) && t.form) syncForm(t.form);
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
// Every screen goes back by itself, because reminders only happen from the clock: the person's own
// screens after 3 minutes, and the quiet ones (which a reminder never interrupts) after 10, or 30
// when a family member is in the middle of typing.
const RESTING_SCREENS = ['day', 'activity', 'contacts', 'help'];
const LIVE_SCREENS = ['home', 'day', 'activity', 'calm'];
function tick() {
  const now = clockText();
  const clock = app.querySelector('.clock');
  if (clock) {
    clock.textContent = now;
    clock.setAttribute('aria-label', `${now}. Tap to hear the time and what is next.`);
  }
  // Anywhere the time is written (a card left on screen, the calming screen) follows the clock.
  for (const el of document.querySelectorAll('[data-now]')) if (el.textContent !== now) el.textContent = now;
  heartbeat();
  checkReminders();

  const idle = performance.now() - lastTouch;
  // Before set-up nothing can chime, so a half-filled set-up form is left alone however long it takes.
  const limit = ui.screen === 'setup' && !data.setup ? 0
    : RESTING_SCREENS.includes(ui.screen) ? 3 : QUIET_SCREENS.includes(ui.screen) ? (dirty ? 30 : 10) : 0;
  if (!sheet && limit && idle > limit * 60_000) {
    // A half-finished family panel is saved, except the PIN, the country and the calls answer. A
    // half-filled form, or a panel that cannot be saved as it stands, is kept as typed and is there
    // again the next time that form is opened.
    if (dirty && !(ui.screen === 'family' && saveTyped(true))) keepDraft();
    return go('home');
  }
  // The first screen left scrolled part of the way down goes back to showing the clock. What is
  // under a finger has then moved, so a tap already on its way is dropped.
  if (ui.screen === 'home' && !sheet && idle > 90_000 && (window.scrollY > 0 || app.querySelector('.hero')?.scrollTop)) {
    homeToTop();
    guard(1000);
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
  if (document.visibilityState !== 'visible') return heartbeat(true);
  resumeAudio();
  requestWakeLock();
  tick();
});
window.addEventListener('pagehide', () => heartbeat(true));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

applySettings();
remember({ screen: 'home', id: null }, true);
render();
requestWakeLock();
heartbeat();
checkReminders();

// Offline support is optional: it is unavailable from file:// and in some embedded frames.
try {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
} catch { /* ignore */ }
