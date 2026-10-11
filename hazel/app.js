'use strict';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'hazel';
const LEGACY_KEY = 'hazel-v3'; // the original prototype's key
const KEEP_DAYS = 30; // completed-activity history kept for Family View

const ACTIVITY_PICTURES = ['☕', '🍽️', '🍲', '🌳', '💊', '📞', '📱', '🎵', '🛁', '📺', '🧩', '🐕', '🌷', '❤️', '🛏️'];
const CONTACT_PICTURES = ['👩', '👨', '👩‍🦰', '👨‍🦳', '👵', '👴', '👧', '👦', '🧑‍⚕️', '💚'];

const SEED = {
  person: '',
  size: 'normal',
  pin: '',
  activities: [
    { id: 1, time: '10:00', title: 'Time for a cuppa', emoji: '☕', note: 'Make yourself a nice drink. Take your time.' },
    { id: 2, time: '11:00', title: 'Short walk outside', emoji: '🌳', note: 'Enjoy some fresh air, if you feel like it.' },
    { id: 3, time: '13:00', title: 'Lunch time', emoji: '🍲', note: 'It is time to enjoy your lunch.' },
    { id: 4, time: '15:00', title: 'Video call with Sarah', emoji: '📱', note: 'Sarah would love to hear from you.' },
  ],
  contacts: [
    { id: 1, name: 'Sarah', relation: 'Daughter', phone: '', emoji: '👩' },
    { id: 2, name: 'John', relation: 'Son', phone: '', emoji: '👨' },
    { id: 3, name: 'Emma', relation: 'Daughter', phone: '', emoji: '👩‍🦰' },
  ],
  completed: {},
};

function load() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY) || 'null');
  } catch { /* storage blocked or corrupt: start fresh */ }
  const d = { ...structuredClone(SEED), ...(stored || {}) };
  if (!Array.isArray(d.activities)) d.activities = [];
  if (!Array.isArray(d.contacts)) d.contacts = [];
  if (!d.completed || typeof d.completed !== 'object') d.completed = {};
  return d;
}

// Returns false when the browser refuses to store anything (private mode, blocked site data).
function save() {
  // Drop old history so storage doesn't grow forever.
  const cutoff = dayKey(daysAgo(KEEP_DAYS));
  for (const k of Object.keys(data.completed)) if (k < cutoff) delete data.completed[k];
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
const saved = message => toast(save() ? message : NOT_SAVED);

const data = load();
const canStore = storageWorks();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dayKey = (d = new Date()) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
const nowHHMM = () => new Date().toTimeString().slice(0, 5);
const toMinutes = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const NOW_WINDOW = 60; // minutes an activity stays "Now" after its start time
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n); // calendar arithmetic, so daylight-saving changes don't skip a day
  return d;
}
const newId = () => Date.now() + Math.floor(Math.random() * 1000);
const isDone = id => !!data.completed[dayKey()]?.includes(id);
const sortedActivities = () => [...data.activities].sort((a, b) => a.time.localeCompare(b.time));

// 'done', 'now', 'upcoming', or 'earlier' (missed). An activity is "now" from its start time for up to
// an hour, or until the next activity starts if that is sooner.
function statusOf(a) {
  if (isDone(a.id)) return 'done';
  const now = toMinutes(nowHHMM());
  const start = toMinutes(a.time);
  if (now < start) return 'upcoming';
  const nextStart = data.activities.map(x => toMinutes(x.time)).filter(t => t > start).sort((x, y) => x - y)[0];
  return now < Math.min(start + NOW_WINDOW, nextStart ?? Infinity) ? 'now' : 'earlier';
}
// The activity to point someone at: what's on now, else what's next. Missed ones aren't pushed.
const focusActivity = () => sortedActivities().find(a => ['now', 'upcoming'].includes(statusOf(a)));
const findActivity = id => data.activities.find(a => a.id === id);
const findContact = id => data.contacts.find(c => c.id === id);
const telHref = phone => 'tel:' + String(phone).replace(/[^+\d]/g, '');

function todayLong() {
  return new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
}
function clockText() {
  return new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit' }).format(new Date());
}
function timeText(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit' }).format(d);
}
function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Hello' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function speak(text) {
  if (!('speechSynthesis' in window)) {
    toast('Reading aloud is not available on this device.');
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-AU';
  u.rate = 0.82;
  speechSynthesis.speak(u);
}

let toastTimer;
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4500);
}

function applySize() {
  document.documentElement.dataset.size = data.size || 'normal';
}

// ---------------------------------------------------------------------------
// Navigation (uses browser history so the phone's back button works)
// ---------------------------------------------------------------------------

// `confirming` holds the item awaiting an on-screen "are you sure?" ('activity:12', 'contact:3', 'reset').
const ui = { screen: 'home', id: null, tab: 'progress', unlocked: false, confirming: null };

// history can be unavailable in some embedded frames; navigation still works without it.
function remember(state, replace) {
  try {
    replace ? history.replaceState(state, '') : history.pushState(state, '');
  } catch { /* ignore */ }
}

function go(screen, id = null, { replace = false } = {}) {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (screen === 'home') ui.unlocked = false;
  Object.assign(ui, { screen, id, confirming: null });
  remember({ screen, id }, replace);
  render();
  window.scrollTo(0, 0);
  focusHeading();
}

function focusHeading() {
  if (document.activeElement?.hasAttribute('data-autofocus')) return; // e.g. the PIN box
  app.querySelector('h1, .page-title')?.focus({ preventScroll: true });
}

window.addEventListener('popstate', e => {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  const s = e.state || { screen: 'home', id: null };
  if (s.screen === 'home') ui.unlocked = false;
  Object.assign(ui, { screen: s.screen, id: s.id, confirming: null });
  render();
  focusHeading();
});

const backButton = (to = 'home', label = 'Back to home') =>
  `<button class="back" data-go="${to}">${to === 'home' ? '⌂' : '‹'} &nbsp;${label}</button>`;

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

const screens = {
  home() {
    return `
      <section class="hero">
        <div class="logo-mark" aria-hidden="true">🌿</div>
        <h1 class="logo" tabindex="-1">Hazel</h1>
        <div class="greeting">${greeting()}${data.person ? ', ' + esc(data.person) : ''}</div>
        <div class="date">It's ${todayLong()}</div>
        <div class="clock">${clockText()}</div>
        <div class="landscape" aria-hidden="true"><div class="sun"></div><div class="hill one"></div><div class="hill two"></div><div class="hill three"></div></div>
      </section>
      <section class="content home-content">
        ${bigTile('green', 'day', '🗓️', 'My Day', nextUpSubtitle())}
        ${bigTile('blue', 'contacts', '📞', 'Call Family', 'Talk to someone')}
        ${bigTile('pink', 'help', '🛟', 'Get Help', 'Find support')}
        <div class="family-link"><button data-go="family">⚙ Family View</button></div>
      </section>`;
  },

  day() {
    const list = sortedActivities();
    const next = focusActivity();
    const doneCount = list.filter(a => isDone(a.id)).length;
    let nextCard = '';
    if (next) {
      const now = statusOf(next) === 'now';
      nextCard = `<div class="family" style="background:#eaf7e7">
           <span class="pill ${now ? 'now' : ''}">${now ? 'Now' : 'Coming up'}</span>
           <h2 style="font-size:1.7rem">${esc(next.emoji)} ${esc(next.title)}</h2>
           <p class="muted">${timeText(next.time)}</p>
           <button class="primary" data-go="activity" data-id="${next.id}">See this activity ›</button>
         </div>`;
    } else if (list.length && doneCount === list.length) {
      nextCard = '<div class="empty">🌷 All done for today!<p>Enjoy your day.</p></div>';
    } else if (list.length) {
      nextCard = '<div class="empty">🌷 Nothing else planned for today.<p>You can still tick off anything from earlier.</p></div>';
    }
    return `
      <section class="content">
        ${backButton()}
        <h1 class="page-title" tabindex="-1">🗓️ My Day</h1>
        <p class="muted">${todayLong()}${list.length ? ` · ${doneCount} of ${list.length} done` : ''}</p>
        ${nextCard}
        <h2 class="section-heading">Today's activities</h2>
        ${list.map(activityItem).join('') || '<p class="muted">No activities added yet. A family member can add some in Family View.</p>'}
        ${list.length ? '<button class="secondary" data-action="read-day">🔊 Read my day aloud</button>' : ''}
      </section>`;
  },

  activity() {
    const a = findActivity(ui.id);
    if (!a) return screens.day();
    const done = isDone(a.id);
    return `
      <section class="content">
        ${backButton('day', 'Back to My Day')}
        <div class="photo" aria-hidden="true">${esc(a.emoji)}</div>
        <div class="activity-card">
          <div class="counter">${timeText(a.time)}</div>
          <h1 class="activity-title" tabindex="-1">${esc(a.title)}</h1>
          <p class="activity-note">${esc(a.note)}</p>
        </div>
        ${done
          ? `<p class="celebrate">✓ Well done — this one is finished.</p>
             <button class="secondary" data-action="undo" data-id="${a.id}">I haven't done this yet</button>`
          : `<button class="primary" data-action="finish" data-id="${a.id}">✓ &nbsp;I've done this</button>`}
        <button class="secondary" data-action="speak-activity" data-id="${a.id}">🔊 Read this out loud</button>
        <button class="secondary" data-go="day">See My Day</button>
      </section>`;
  },

  contacts() {
    return `
      <section class="content">
        ${backButton()}
        <h1 class="page-title" tabindex="-1">📞 Call Family</h1>
        <p class="muted">${data.contacts.some(c => c.phone)
          ? 'Tap the green phone to call.'
          : 'A family member can add phone numbers in Family View.'}</p>
        ${data.contacts.map(contactCard).join('') || '<p class="muted">No contacts added yet. A family member can add some in Family View.</p>'}
      </section>`;
  },

  help() {
    return `
      <section class="content">
        ${backButton()}
        <h1 class="page-title" tabindex="-1">🛟 Get Help</h1>
        <p class="muted">Choose what you need.</p>
        ${bigTile('pink', 'contacts', '📞', 'Call for help', 'Talk to family')}
        ${bigTile('blue', 'calm', '💬', "I'm feeling worried", 'Hear a calming message')}
        ${bigTile('yellow', 'info', '💡', 'Useful information', 'Find help and advice')}
      </section>`;
  },

  calm() {
    return `
      <section class="content">
        ${backButton('help', 'Back to Get Help')}
        <div class="safe-space" aria-hidden="true"><span class="breathe">🌷</span></div>
        <h1 class="page-title" style="margin-top:23px" tabindex="-1">You're not alone</h1>
        <p class="activity-note">${esc(CALM_MESSAGE)}</p>
        <p class="muted">Breathe in slowly as the flower grows, and out as it gets smaller.</p>
        <button class="primary" data-action="speak-calm">🔊 Read this to me</button>
        ${bigTile('blue', 'contacts', '📞', 'Call Family', 'Talk to someone you know')}
      </section>`;
  },

  info() {
    return `
      <section class="content">
        ${backButton('help', 'Back to Get Help')}
        <h1 class="page-title" tabindex="-1">Useful information</h1>
        <p class="muted">If you need someone, call a trusted family member.</p>
        ${bigTile('blue', 'contacts', '📞', 'Call Family', 'Talk to someone')}
        <div class="notice">
          <strong>Emergency in Australia?</strong>
          <p>If you are hurt, very unwell or in danger, call Triple Zero (000).</p>
          <a class="primary" style="background:#b3261e" href="tel:000" data-number="000">📞 Call 000</a>
        </div>
        <div class="divider"></div>
        <div class="notice" style="background:#eef4ff">
          <strong>Need to talk to someone?</strong>
          <p>Lifeline is available any time, day or night.</p>
          <a class="link" href="tel:131114" data-number="13 11 14">Call Lifeline on 13 11 14</a>
          <p>Health advice from a registered nurse:</p>
          <a class="link" href="tel:1800022222" data-number="1800 022 222">Call healthdirect on 1800 022 222</a>
        </div>
      </section>`;
  },

  family() {
    if (data.pin && !ui.unlocked) {
      return `
        <section class="content">
          ${backButton()}
          <div class="family-banner"><h2 tabindex="-1" class="page-title" style="font-size:1.8rem;margin:0 0 7px">👪 Family View</h2><p>Enter the family PIN to continue.</p></div>
          <form data-form="unlock">
            <label class="field">PIN<input name="pin" inputmode="numeric" autocomplete="off" maxlength="8" required data-autofocus></label>
            <button class="primary">Open Family View</button>
          </form>
        </section>`;
    }
    const tabs = [['progress', 'Progress'], ['activities', 'My Day'], ['contacts', 'Contacts'], ['settings', 'Settings']];
    return `
      <section class="content">
        ${backButton()}
        <div class="family-banner"><h2 tabindex="-1" class="page-title" style="font-size:1.8rem;margin:0 0 7px">👪 Family View</h2><p>Set up Hazel for someone you care about.</p></div>
        ${canStore ? '' : '<div class="notice" role="note"><strong>Changes won’t be kept.</strong> This browser isn’t letting Hazel save, so anything you set up here will be lost when Hazel is closed. Open Hazel in a normal (not private) browser window to keep changes.</div>'}
        <div class="tabs" role="tablist">
          ${tabs.map(([key, label]) => `<button role="tab" aria-selected="${ui.tab === key}" data-action="tab" data-tab="${key}">${label}</button>`).join('')}
        </div>
        ${familyPanels[ui.tab]()}
      </section>`;
  },

  activityForm() {
    const a = findActivity(ui.id);
    return `
      <section class="content">
        ${backButton('family', 'Back to Family View')}
        <h1 class="page-title" tabindex="-1">${a ? 'Edit activity' : 'Add an activity'}</h1>
        <form data-form="activity">
          <label class="field">Time<input type="time" name="time" value="${esc(a?.time || '10:00')}" required></label>
          <label class="field">Activity name<input name="title" maxlength="70" value="${esc(a?.title)}" placeholder="e.g. Have a cuppa" required></label>
          <label class="field">Friendly instructions
            <span class="hint">Short and kind works best. This can be read aloud.</span>
            <textarea name="note" rows="3" maxlength="220" placeholder="e.g. Make yourself a nice drink">${esc(a?.note)}</textarea>
          </label>
          ${pictureChoices('emoji', ACTIVITY_PICTURES, a?.emoji || ACTIVITY_PICTURES[0])}
          <button class="primary">Save activity</button>
        </form>
      </section>`;
  },

  contactForm() {
    const c = findContact(ui.id);
    return `
      <section class="content">
        ${backButton('family', 'Back to Family View')}
        <h1 class="page-title" tabindex="-1">${c ? 'Edit contact' : 'Add a contact'}</h1>
        <form data-form="contact">
          <label class="field">Name<input name="name" maxlength="45" value="${esc(c?.name)}" placeholder="e.g. Sarah" required></label>
          <label class="field">Relationship<input name="relation" maxlength="45" value="${esc(c?.relation)}" placeholder="e.g. Daughter"></label>
          <label class="field">Phone number<input name="phone" type="tel" value="${esc(c?.phone)}" placeholder="e.g. 0412 345 678"></label>
          ${pictureChoices('emoji', CONTACT_PICTURES, c?.emoji || CONTACT_PICTURES[CONTACT_PICTURES.length - 1])}
          <button class="primary">Save contact</button>
        </form>
      </section>`;
  },
};

const CALM_MESSAGE = "Take your time. You don't have to do everything at once. You can call someone you know.";

const familyPanels = {
  progress() {
    const list = sortedActivities();
    const done = list.filter(a => isDone(a.id)).length;
    return `
      <div class="family">
        <h3 tabindex="-1">Today's progress</h3>
        <p class="muted" style="margin-top:0">${done} of ${list.length} activities done</p>
        ${list.map(a => `
          <div class="progress"><span aria-hidden="true">${isDone(a.id) ? '✅' : '◯'}</span>
            <span>${esc(a.title)}<span class="visually-hidden">${isDone(a.id) ? ', done' : ', not done yet'}</span></span>
            <span class="progress-time">${timeText(a.time)}</span></div>`).join('') || '<p class="muted">No activities yet.</p>'}
        ${weekSummary()}
        <p class="tiny">Completed activities are recorded when someone taps “I’ve done this”. This does not independently verify that the activity happened.</p>
      </div>`;
  },

  activities() {
    return `
      <div class="family">
        <h3 tabindex="-1">Manage My Day</h3>
        ${sortedActivities().map(a => manageRow(a.emoji, `${timeText(a.time)} · ${a.title}`, 'activity', a.id, '', a.title)).join('')}
        <button class="primary" data-go="activityForm">+ Add an activity</button>
      </div>`;
  },

  contacts() {
    return `
      <div class="family">
        <h3 tabindex="-1">Manage contacts</h3>
        ${data.contacts.map(c => manageRow(c.emoji, `${c.name}`, 'contact', c.id,
          `${esc(c.relation)}${c.phone ? ' · ' + esc(c.phone) : ' · <strong>no phone number yet</strong>'}`)).join('')}
        <button class="primary" data-go="contactForm">+ Add a contact</button>
      </div>`;
  },

  settings() {
    return `
      <div class="family">
        <h3 tabindex="-1">Personalise Hazel</h3>
        <form data-form="settings">
          <label class="field">Name shown on Hazel<input name="person" value="${esc(data.person)}" maxlength="35" placeholder="e.g. Mum"></label>
          <fieldset class="field" style="border:0;padding:0">
            <legend>Text size</legend>
            <div class="choices size-choices">
              ${[['normal', 'Normal'], ['large', 'Large'], ['largest', 'Largest']].map(([v, l]) =>
                `<label><input type="radio" name="size" value="${v}" ${data.size === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
            </div>
          </fieldset>
          <label class="field">Family View PIN
            <span class="hint">Optional. Stops Family View being opened by accident. Leave blank for no PIN.</span>
            <input name="pin" inputmode="numeric" pattern="\\d{4,8}" maxlength="8" value="${esc(data.pin)}" placeholder="4 to 8 digits" autocomplete="off">
          </label>
          <button class="primary">Save settings</button>
        </form>
        <div class="divider"></div>
        ${ui.confirming === 'reset'
          ? confirmBox("Reset today's completed activities?", 'reset-done', null, 'Yes, reset')
          : `<button class="secondary" data-action="ask" data-confirm="reset">Reset today's completed activities</button>`}
        <div class="notice" style="margin-top:14px">Hazel saves information only on this device. It does not synchronise across devices, and the PIN is a light lock, not strong security.</div>
      </div>`;
  },
};

// ---------------------------------------------------------------------------
// Fragments
// ---------------------------------------------------------------------------

function bigTile(color, to, emoji, title, subtitle) {
  return `<button class="big ${color}" data-go="${to}">
    <span class="emoji" aria-hidden="true">${emoji}</span>
    <span><strong>${title}</strong>${subtitle ? `<small>${esc(subtitle)}</small>` : ''}</span>
  </button>`;
}

function nextUpSubtitle() {
  const next = focusActivity();
  if (next) return statusOf(next) === 'now' ? `Now: ${next.title}` : `Next: ${next.title}, ${timeText(next.time)}`;
  if (!data.activities.length) return "See what's next";
  return data.activities.every(a => isDone(a.id)) ? 'All done for today 🌷' : 'Nothing else planned today';
}

function activityItem(a) {
  const done = isDone(a.id);
  const earlier = statusOf(a) === 'earlier';
  return `<button class="item ${done ? 'is-done' : ''}" data-go="activity" data-id="${a.id}">
    <span class="time">${timeText(a.time)}</span>
    <span class="thumb" aria-hidden="true">${esc(a.emoji)}</span>
    <span class="name">${esc(a.title)} ${done ? '<span class="done">✓<span class="visually-hidden"> done</span></span>' : ''}${earlier ? '<span class="earlier">Earlier today</span>' : ''}</span>
    <span class="chevron" aria-hidden="true">›</span>
  </button>`;
}

function contactCard(c) {
  const call = c.phone
    ? `<a class="call" href="${esc(telHref(c.phone))}" data-number="${esc(c.phone)}" aria-label="Call ${esc(c.name)}">☎</a>`
    : `<button class="call missing" data-action="no-phone" data-id="${c.id}" aria-label="Call ${esc(c.name)} (no number yet)">☎</button>`;
  return `<div class="contact">
    <span class="face" aria-hidden="true">${esc(c.emoji)}</span>
    <div class="who">${esc(c.name)}<div class="muted">${esc(c.relation)}</div>${c.phone ? `<div class="muted phone">${esc(c.phone)}</div>` : ''}</div>
    ${call}
  </div>`;
}

function manageRow(emoji, label, kind, id, detailHtml = '', name = label) {
  if (ui.confirming === `${kind}:${id}`) {
    return confirmBox(`Remove ${name}?`, `remove-${kind}`, id, 'Yes, remove');
  }
  return `<div class="row">
    <span class="row-emoji" aria-hidden="true">${esc(emoji)}</span>
    <span class="row-text">${esc(label)}${detailHtml ? `<div class="tiny">${detailHtml}</div>` : ''}</span>
    <span class="row-actions">
      <button class="edit" data-go="${kind}Form" data-id="${id}" aria-label="Edit ${esc(label)}">Edit</button>
      <button class="delete" data-action="ask" data-confirm="${kind}:${id}" aria-label="Remove ${esc(label)}">Remove</button>
    </span>
  </div>`;
}

function confirmBox(question, action, id, yesLabel) {
  return `<div class="confirm" role="group" aria-label="${esc(question)}">
    <p>${esc(question)}</p>
    <div class="confirm-actions">
      <button class="delete" data-action="${action}" ${id != null ? `data-id="${id}"` : ''} data-autofocus>${yesLabel}</button>
      <button class="edit" data-action="cancel">No, keep it</button>
    </div>
  </div>`;
}

function pictureChoices(name, options, selected) {
  if (selected && !options.includes(selected)) options = [selected, ...options];
  return `<fieldset class="field" style="border:0;padding:0">
    <legend>Picture</legend>
    <div class="choices">
      ${options.map(e => `<label><input type="radio" name="${name}" value="${esc(e)}" ${e === selected ? 'checked' : ''}><span>${esc(e)}</span></label>`).join('')}
    </div>
  </fieldset>`;
}

function weekSummary() {
  if (!data.activities.length) return '';
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = daysAgo(i);
    const count = data.completed[dayKey(d)]?.length || 0;
    const label = i === 0 ? 'Today' : new Intl.DateTimeFormat('en-AU', { weekday: 'short' }).format(d);
    days.push(`<div class="progress"><span>${label}</span><span class="progress-time">${count} done</span></div>`);
  }
  return `<h3 style="margin-top:20px">Last 7 days</h3>${days.join('')}`;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

// `focus` is a selector for the element that should have focus afterwards, so
// keyboard and screen-reader users don't get dropped back to the top of the page.
function render(focus) {
  let screen = screens[ui.screen] ? ui.screen : 'home';
  // Edit forms sit behind the Family View PIN, even when reached with the Back button.
  if (data.pin && !ui.unlocked && /Form$/.test(screen)) screen = 'family';
  app.innerHTML = screens[screen]() + '<div class="foot">Hazel 🌿 A brighter day, one step at a time.</div>';
  lastLive = liveText();
  const target = app.querySelector('[data-autofocus]') || (focus && app.querySelector(focus));
  target?.focus({ preventScroll: true });
}

// Everything on Home and My Day that changes with the time of day.
let lastLive = '';
function liveText() {
  return [dayKey(), greeting(), sortedActivities().map(statusOf).join()].join('|');
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

const actions = {
  tab(el) {
    ui.tab = el.dataset.tab;
    ui.confirming = null;
    render('[role="tab"][aria-selected="true"]');
  },
  ask(el) {
    ui.confirming = el.dataset.confirm;
    render();
  },
  cancel() {
    const was = ui.confirming;
    ui.confirming = null;
    render(`[data-confirm="${was}"]`);
  },
  finish(_, id) {
    const key = dayKey();
    data.completed[key] ??= [];
    if (!data.completed[key].includes(id)) data.completed[key].push(id);
    const left = data.activities.filter(a => !isDone(a.id)).length;
    saved(left ? 'Well done! ✓' : 'Well done! That’s everything for today 🌷');
    // Activities are only opened from My Day, so step back to that entry rather than adding another.
    let fromDay = false;
    try { fromDay = history.state?.screen === 'activity'; } catch { /* ignore */ }
    if (fromDay) history.back();
    else go('day', null, { replace: true });
  },
  undo(_, id) {
    const key = dayKey();
    data.completed[key] = (data.completed[key] || []).filter(x => x !== id);
    if (!save()) toast(NOT_SAVED);
    render('[data-action="finish"]');
  },
  'speak-activity'(_, id) {
    const a = findActivity(id);
    if (a) speak(`${a.title}. ${a.note}`);
  },
  'read-day'() {
    const list = sortedActivities();
    speak('Here is your day. ' + list.map(a => `${timeText(a.time)}, ${a.title}${isDone(a.id) ? ', done' : ''}`).join('. '));
  },
  'speak-calm'() {
    speak(CALM_MESSAGE);
  },
  'no-phone'(_, id) {
    const c = findContact(id);
    if (c) toast(`A family member needs to add ${c.name}’s phone number in Family View first.`);
  },
  'remove-activity'(_, id) {
    const a = findActivity(id);
    ui.confirming = null;
    if (a) {
      data.activities = data.activities.filter(x => x.id !== id);
      const key = dayKey();
      if (data.completed[key]) data.completed[key] = data.completed[key].filter(x => x !== id);
      saved(`Removed “${a.title}”.`);
    }
    render('.family h3');
  },
  'remove-contact'(_, id) {
    const c = findContact(id);
    ui.confirming = null;
    if (c) {
      data.contacts = data.contacts.filter(x => x.id !== id);
      saved(`Removed ${c.name}.`);
    }
    render('.family h3');
  },
  'reset-done'() {
    ui.confirming = null;
    data.completed[dayKey()] = [];
    saved("Today's progress has been reset.");
    render('.family h3');
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
    if (!title) return showError(f, 'Please enter an activity name.', 'title');
    const fields = {
      time: f.elements.time.value || '10:00',
      title,
      note: f.elements.note.value.trim() || 'Take your time.',
      emoji: f.elements.emoji.value || findActivity(ui.id)?.emoji || ACTIVITY_PICTURES[0],
    };
    const existing = findActivity(ui.id);
    existing ? Object.assign(existing, fields) : data.activities.push({ id: newId(), ...fields });
    ui.tab = 'activities';
    saved('Activity saved.');
    history.back();
  },
  contact(f) {
    const name = f.elements.name.value.trim();
    if (!name) return showError(f, 'Please enter a name.', 'name');
    const phone = f.elements.phone.value.trim();
    if (phone && phone.replace(/[^\d]/g, '').length < 3) return showError(f, 'That phone number looks too short.', 'phone');
    const fields = {
      name,
      relation: f.elements.relation.value.trim() || 'Family',
      phone,
      emoji: f.elements.emoji.value || findContact(ui.id)?.emoji || '💚',
    };
    const existing = findContact(ui.id);
    existing ? Object.assign(existing, fields) : data.contacts.push({ id: newId(), ...fields });
    ui.tab = 'contacts';
    saved('Contact saved.');
    history.back();
  },
  settings(f) {
    const pin = f.elements.pin.value.trim();
    if (pin && !/^\d{4,8}$/.test(pin)) return showError(f, 'The PIN must be 4 to 8 digits, or left blank.', 'pin');
    data.person = f.elements.person.value.trim();
    data.size = f.elements.size.value || 'normal';
    data.pin = pin;
    if (pin) ui.unlocked = true;
    applySize();
    saved('Settings saved.');
    render('form[data-form="settings"] .primary');
  },
};

// Show a form problem next to the Save button without re-rendering, so nothing typed is lost.
function showError(form, message, field) {
  form.querySelector('.error')?.remove();
  form.querySelector('.primary').insertAdjacentHTML('beforebegin', `<p class="error" role="alert">${esc(message)}</p>`);
  form.elements[field]?.focus();
}

app.addEventListener('click', e => {
  // Some browsers and embedded views can't start a phone call. Let the link try, and always
  // show the number so the person can dial it themselves.
  const tel = e.target.closest('a[href^="tel:"]');
  if (tel) {
    toast(`Calling ${tel.dataset.number}. If your phone doesn't start the call, dial ${tel.dataset.number} yourself.`);
    return;
  }
  const el = e.target.closest('[data-go], [data-action]');
  if (!el) return;
  const id = el.dataset.id ? Number(el.dataset.id) : null;
  if (el.dataset.go) return go(el.dataset.go, id);
  actions[el.dataset.action]?.(el, id);
});

app.addEventListener('submit', e => {
  e.preventDefault();
  forms[e.target.dataset.form]?.(e.target);
});

// Keep the clock, greeting, "Now" badge and the date fresh. The clock is updated in place; the
// screen is only redrawn when something else has changed, and focus is put back where it was.
setInterval(() => {
  const clock = app.querySelector('.clock');
  if (clock) clock.textContent = clockText();
  if (ui.screen !== 'home' && ui.screen !== 'day') return;
  if (liveText() === lastLive) return;
  const ae = document.activeElement;
  const focusKey = ae?.dataset?.go ? `[data-go="${ae.dataset.go}"]${ae.dataset.id ? `[data-id="${ae.dataset.id}"]` : ''}`
    : ae?.dataset?.action ? `[data-action="${ae.dataset.action}"]`
    : ae && ae !== document.body ? 'h1, .page-title' : null;
  render(focusKey);
}, 20_000);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

applySize();
remember({ screen: 'home', id: null }, true);
render();

// Offline support is optional: it is unavailable from file:// and in some embedded frames.
try {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
} catch { /* ignore */ }
