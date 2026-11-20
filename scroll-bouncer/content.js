(() => {
  if (window.top !== window) return;

  const GUY = `
<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
  <g class="leg leg-a"><rect x="27" y="58" width="7" height="14" rx="3.5" fill="#c2410c"/><ellipse cx="33" cy="73" rx="8" ry="4" fill="#c2410c"/></g>
  <g class="leg leg-b"><rect x="44" y="58" width="7" height="14" rx="3.5" fill="#c2410c"/><ellipse cx="50" cy="73" rx="8" ry="4" fill="#c2410c"/></g>
  <g class="body">
    <path d="M38 12 q-3 -9 4 -10 q-1 5 3 9z" fill="#65a30d"/>
    <ellipse cx="40" cy="38" rx="27" ry="26" fill="#fb7c2d"/>
    <ellipse cx="31" cy="26" rx="12" ry="8" fill="#fdba74" opacity=".55"/>
    <g class="arm"><rect x="58" y="36" width="18" height="7" rx="3.5" fill="#ea580c"/></g>
    <ellipse cx="44" cy="34" rx="4" ry="5.5" fill="#1c1917"/>
    <ellipse cx="59" cy="34" rx="3.4" ry="5" fill="#1c1917"/>
    <circle cx="45.5" cy="32" r="1.4" fill="#fff"/>
    <circle cx="60.2" cy="32" r="1.2" fill="#fff"/>
    <path d="M46 46 q6 5 12 0" fill="none" stroke="#1c1917" stroke-width="2.4" stroke-linecap="round"/>
    <ellipse cx="36" cy="43" rx="4.5" ry="3" fill="#f43f5e" opacity=".45"/>
  </g>
</svg>`;

  const CSS = `
:host { all: initial; }
.stage { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;
  font: 600 14px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif; }
.veil { position: absolute; inset: 0; background: #0c0a09; opacity: 0; }
.x { position: absolute; top: 10px; right: 14px; width: 40px; height: 40px; border-radius: 50%;
  background: #1c1917; color: #fff; display: grid; place-items: center; font-size: 22px;
  box-shadow: 0 4px 14px rgba(0,0,0,.35); transform-origin: center; }
.guy { position: absolute; top: 4px; left: 0; width: 64px; height: 64px;
  filter: drop-shadow(0 4px 6px rgba(0,0,0,.35)); will-change: transform; }
.guy svg { width: 100%; height: 100%; overflow: visible; display: block; }
.body { animation: bob .5s ease-in-out infinite alternate; transform-origin: 40px 60px; }
.leg { transform-box: fill-box; transform-origin: 50% 0; }
.walking .leg-a { animation: step .5s ease-in-out infinite alternate; }
.walking .leg-b { animation: step .5s ease-in-out infinite alternate-reverse; }
.arm { transform-box: fill-box; transform-origin: 0 50%; transform: rotate(55deg); transition: transform .12s; }
.poke .arm { transform: rotate(-12deg) scaleX(1.25); }
.bubble { position: absolute; top: 62px; right: 14px; max-width: min(240px, 70vw); padding: 9px 13px;
  border-radius: 14px 4px 14px 14px; background: #fff; color: #1c1917; opacity: 0;
  box-shadow: 0 6px 20px rgba(0,0,0,.3); }
.card { position: absolute; inset: 0; display: none; place-items: center; text-align: center;
  background: #0c0a09; color: #fafaf9; font-size: 20px; padding: 24px; pointer-events: auto; }
.card small { display: block; margin-top: 8px; font-weight: 400; font-size: 14px; opacity: .7; }
@keyframes bob { from { transform: translateY(0) rotate(-3deg); } to { transform: translateY(-3px) rotate(3deg); } }
@keyframes step { from { transform: rotate(-28deg); } to { transform: rotate(28deg); } }
@media (prefers-reduced-motion: reduce) { .body, .leg { animation: none !important; } }
`;

  const LINES = [
    'Nope. Not today.',
    'Go do the thing you were avoiding.',
    'You already checked. Nothing changed.',
    'Closing this for you. You are welcome.',
    'Future you says thanks.',
    'Back to real life!'
  ];

  // Walking pace: milliseconds per pixel of screen crossed. Higher is slower.
  const WALK_MS_PER_PX = 6;

  let running = false;
  let lastUrl = '';

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function shouldBounce() {
    let cfg;
    try { cfg = await chrome.storage.sync.get(SB_DEFAULTS); } catch { return false; }
    if (!cfg.enabled || Date.now() < cfg.snoozeUntil) return false;
    return sbMatches(location.href, cfg.sites);
  }

  async function bounce() {
    running = true;
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>${CSS}</style>
      <div class="stage">
        <div class="veil"></div>
        <div class="x">✕</div>
        <div class="guy walking">${GUY}</div>
        <div class="bubble"></div>
        <div class="card"><div>Tab closed by the Scroll Bouncer.<small>You can close this page.</small></div></div>
      </div>`;
    document.documentElement.appendChild(host);

    const $ = (s) => root.querySelector(s);
    const guy = $('.guy'), x = $('.x'), veil = $('.veil'), bubble = $('.bubble');
    bubble.textContent = LINES[Math.floor(Math.random() * LINES.length)];

    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const width = document.documentElement.clientWidth || window.innerWidth;
    const stopX = Math.max(0, width - 14 - 40 - 58); // just left of the close button
    const opts = { fill: 'forwards' };

    if (calm) {
      guy.style.transform = `translateX(${stopX}px)`;
      guy.classList.remove('walking');
    } else {
      const ms = Math.min(9000, Math.max(3000, stopX * WALK_MS_PER_PX));
      await guy.animate(
        [{ transform: 'translateX(-80px)' }, { transform: `translateX(${stopX}px)` }],
        { duration: ms, easing: 'linear', ...opts }
      ).finished;
      guy.classList.remove('walking');
    }

    bubble.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }],
      { duration: 180, ...opts });
    await sleep(calm ? 900 : 650);

    guy.classList.add('poke');
    x.animate([{ transform: 'scale(1)' }, { transform: 'scale(.72)' }, { transform: 'scale(1)' }], { duration: 220 });
    await sleep(240);
    await veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: calm ? 1 : 260, ...opts }).finished;

    let closed = false;
    try {
      const res = await chrome.runtime.sendMessage({ type: 'sb-close' });
      closed = !!(res && res.ok);
    } catch { /* extension reloaded or tab already going away */ }

    if (!closed) {
      // Could not close the tab: keep the page covered instead.
      $('.card').style.display = 'grid';
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
  chrome.storage.onChanged.addListener(() => { lastUrl = ''; check(); });
})();
