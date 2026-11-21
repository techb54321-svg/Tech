// Runs on every page: if it is one of the listed sites, send the little guy in
// and close the tab when he has finished. Now and then he offers a deal instead:
// dance with him for a minute and he lets them in for five.
(() => {
  if (window.top !== window) return;

  // Firefox and Safari call the extension API `browser`; Chrome calls it `chrome`.
  const api = globalThis.browser ?? globalThis.chrome;

  const DEAL_CHANCE = 0.25;                // how often he offers the dance deal...
  const DEAL_GAP = 2 * 60 * 60 * 1000;     // ...and never twice within this long
  const PASS = 5 * 60 * 1000;              // how long dancing lets them in for

  let running = false;
  let lastUrl = '';
  let timesUp = null;

  async function shouldBounce() {
    let cfg, local;
    try {
      cfg = await api.storage.sync.get(SB_DEFAULTS);
      local = await api.storage.local.get({ passUntil: 0 });
    } catch { return false; }
    const now = Date.now();
    if (!cfg.enabled || now < cfg.snoozeUntil || now < local.passUntil) return false;
    return sbMatches(location.href, cfg.sites);
  }

  // Whether he offers the deal this time. It is noted straight away, so another tab
  // opening at the same moment does not offer one too.
  async function dealThisTime() {
    try {
      const { danceDeals } = await api.storage.sync.get(SB_DEFAULTS);
      const { danceNext = false, dealAt = 0 } = await api.storage.local.get(['danceNext', 'dealAt']);
      const deal = danceNext || (danceDeals && Date.now() - dealAt > DEAL_GAP && Math.random() < DEAL_CHANCE);
      if (deal) await api.storage.local.set({ danceNext: false, dealAt: Date.now() });
      return deal;
    } catch { return false; }
  }

  // The page is about to go dark: stop anything on it playing, so it does not talk over him.
  function hush() {
    for (const media of document.querySelectorAll('video, audio')) {
      try { media.pause(); } catch { /* not ours to stop */ }
    }
  }

  async function bounce(line) {
    running = true;
    const deal = await dealThisTime();
    const show = await ScrollBouncerGuy.perform({ line, onDark: hush });

    if (deal) {
      const answer = await show.offerDance({ music: api.runtime.getURL('dance.ogg') });
      if (answer === 'danced') {
        try { await api.storage.local.set({ passUntil: Date.now() + PASS }); } catch { /* still let them in */ }
        await show.fadeOut();
        lastUrl = location.href;
        running = false;
        return;
      }
    }

    let closed = false;
    try {
      const res = await api.runtime.sendMessage({ type: 'sb-close' });
      closed = !!(res && res.ok);
    } catch { /* extension reloaded or tab already going away */ }

    if (!closed) {
      // Could not close the tab: keep the page covered instead.
      show.cover('Tab closed by Mr Blocky.', 'You can close this page.');
      try { window.stop(); } catch {}
    }
  }

  async function check() {
    if (running || location.href === lastUrl) return;
    lastUrl = location.href;
    if (await shouldBounce()) bounce();
  }

  // When a pass from dancing runs out, he comes back for any tab still on one of his sites.
  async function watchPass() {
    clearTimeout(timesUp);
    let passUntil = 0;
    try { ({ passUntil = 0 } = await api.storage.local.get('passUntil')); } catch { return; }
    const left = passUntil - Date.now();
    if (left <= 0) return;
    timesUp = setTimeout(async () => {
      if (running) return;
      lastUrl = location.href;
      if (await shouldBounce()) bounce("Time's up!");
    }, left + 250);
  }

  check();
  watchPass();
  // Single-page apps change the URL without reloading (e.g. YouTube -> Shorts).
  setInterval(check, 1000);
  // Pages restored from the back/forward cache skip the initial run.
  window.addEventListener('pageshow', (e) => { if (e.persisted) { lastUrl = ''; running = false; check(); } });
  api.storage.onChanged.addListener((changes) => {
    if (changes.passUntil) watchPass();
    lastUrl = '';
    check();
  });
})();
