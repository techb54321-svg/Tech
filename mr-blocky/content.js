// Runs on every page: if it is one of the listed sites, send the little guy in
// and close the tab when he has finished.
(() => {
  if (window.top !== window) return;

  // Firefox and Safari call the extension API `browser`; Chrome calls it `chrome`.
  const api = globalThis.browser ?? globalThis.chrome;

  let running = false;
  let lastUrl = '';

  async function shouldBounce() {
    let cfg;
    try { cfg = await api.storage.sync.get(SB_DEFAULTS); } catch { return false; }
    if (!cfg.enabled || Date.now() < cfg.snoozeUntil) return false;
    return sbMatches(location.href, cfg.sites);
  }

  async function bounce() {
    running = true;
    const show = await ScrollBouncerGuy.perform();

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

  check();
  // Single-page apps change the URL without reloading (e.g. YouTube -> Shorts).
  setInterval(check, 1000);
  // Pages restored from the back/forward cache skip the initial run.
  window.addEventListener('pageshow', (e) => { if (e.persisted) { lastUrl = ''; running = false; check(); } });
  api.storage.onChanged.addListener(() => { lastUrl = ''; check(); });
})();
