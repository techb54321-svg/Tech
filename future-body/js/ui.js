/* ============================================================
   Inside My Future Body — 2D interface layer
   Builds the landing screen, journey HUD (narration, choices,
   futures, habits panel) and the reflection screen.
   Talks to the 3D engine only through FB.app.goToZone().
   ============================================================ */
window.FB = window.FB || {};

FB.ui = (function () {
  const $root = () => document.getElementById('ui-root');
  let hud, story, progress, zoneLabel, habitsPanel, landing, reflect;

  /* ---------- small helpers ---------- */
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ============================================================
     Landing screen
     ============================================================ */
  function buildLanding() {
    landing = el('div', 'landing');
    landing.append(
      el('div', 'kicker', 'Health experience prototype'),
      el('h1', '', 'Inside My Future Body'),
      el('p', 'tagline',
        'A short guided journey inside your own body. See what everyday habits ' +
        'quietly change — and how much of your future is still yours to shape.'),
      (() => {
        const m = el('div', 'meta');
        m.append(
          el('span', '', '⏱ 3–4 minutes'),
          el('span', '', '🧭 Guided — no controls to learn'),
          el('span', '', '🔒 Nothing is saved or shared'),
        );
        return m;
      })(),
      (() => {
        const b = el('button', 'btn', 'Begin the journey');
        b.addEventListener('click', startJourney);
        return b;
      })(),
    );
    $root().append(landing);

    const d = el('div', 'disclaimer',
      'Educational prototype — simplified, symbolic visuals. Not medical advice or diagnosis.');
    $root().append(d);
  }

  function startJourney() {
    FB.state.view = 'journey';
    FB.state.stepIndex = 0;
    landing.classList.add('hidden');
    hud.classList.remove('hidden');
    FB.app.goToZone(FB.config.steps[0].zone, true);
    renderStep(false);
  }

  /* ============================================================
     Journey HUD
     ============================================================ */
  function buildHud() {
    hud = el('div', 'hud hidden');

    progress = el('div', 'progress panel');
    FB.config.steps.forEach(() => progress.append(el('span', 'dot')));

    zoneLabel = el('div', 'zone-label panel');
    story = el('div', 'story panel');

    hud.append(progress, zoneLabel, story, buildHabitsPanel());

    // optional VR entry (graceful: only appears if WebXR reports support)
    if (navigator.xr && navigator.xr.isSessionSupported) {
      navigator.xr.isSessionSupported('immersive-vr').then((ok) => {
        if (!ok) return;
        const b = el('button', 'btn ghost small vr-btn', 'Enter VR');
        b.addEventListener('click', () => FB.app.enterVR(b));
        hud.append(b);
      }).catch(() => {});
    }

    $root().append(hud);
  }

  /* habits side panel — always available on desktop */
  function buildHabitsPanel() {
    habitsPanel = el('div', 'habits panel');
    habitsPanel.append(el('h3', '', 'Your habits'));
    for (const key of Object.keys(FB.config.behaviors)) {
      const def = FB.config.behaviors[key];
      const group = el('div', 'h-group');
      group.append(el('div', 'h-name', esc(def.name)));
      const seg = el('div', 'seg');
      seg.dataset.behavior = key;
      def.options.forEach((opt, i) => {
        const b = el('button', '', esc(opt.label));
        b.setAttribute('aria-label', def.name + ': ' + opt.label);
        b.addEventListener('click', () => setBehavior(key, i));
        seg.append(b);
      });
      group.append(seg);
      habitsPanel.append(group);
    }
    habitsPanel.append(el('div', 'risk-line'));
    return habitsPanel;
  }

  function setBehavior(key, level) {
    FB.state.behaviors[key] = level;
    syncBehaviorControls();
  }

  /* keep the side panel + any on-card choices in sync with state */
  function syncBehaviorControls() {
    document.querySelectorAll('.seg').forEach((seg) => {
      const key = seg.dataset.behavior;
      [...seg.children].forEach((b, i) =>
        b.classList.toggle('selected', FB.state.behaviors[key] === i));
    });
    document.querySelectorAll('.choices').forEach((row) => {
      const key = row.dataset.behavior;
      [...row.children].forEach((b, i) =>
        b.classList.toggle('selected', FB.state.behaviors[key] === i));
    });
    const w = FB.risk.word();
    const line = habitsPanel.querySelector('.risk-line');
    line.innerHTML = 'Right now your body systems are <span class="risk-word" style="color:' +
      w.color + '">' + w.text + '</span>.';
  }

  /* ---------- step rendering ---------- */
  function renderStep(animate = true) {
    const idx = FB.state.stepIndex;
    const step = FB.config.steps[idx];

    [...progress.children].forEach((d, i) => {
      d.classList.toggle('active', i === idx);
      d.classList.toggle('done', i < idx);
    });
    zoneLabel.textContent = FB.config.zoneNames[step.zone];

    const fill = () => {
      story.innerHTML = '';
      story.append(
        el('h2', '', esc(step.title)),
        el('p', 'body', esc(step.body)),
        el('div', 'vo', '<b>🎙 VOICEOVER (placeholder)</b><br>' + esc(step.vo)),
      );

      if (step.type === 'choice') story.append(buildChoices(step.behavior));
      if (step.type === 'futures') story.append(buildFutures());

      const nav = el('div', 'nav');
      const back = el('button', 'btn ghost small', '← Back');
      back.disabled = idx === 0;
      back.addEventListener('click', () => go(idx - 1));
      const count = el('span', 'step-count', 'Step ' + (idx + 1) + ' of ' + FB.config.steps.length);
      const next = el('button', 'btn small',
        idx === FB.config.steps.length - 1 ? 'Finish →' : 'Continue →');
      next.addEventListener('click', () => go(idx + 1));
      nav.append(back, count, next);
      story.append(nav);
      syncBehaviorControls();
      story.classList.remove('swap');
    };

    if (animate) {
      story.classList.add('swap');
      setTimeout(fill, 320);
    } else fill();
  }

  function buildChoices(key) {
    const def = FB.config.behaviors[key];
    const row = el('div', 'choices');
    row.dataset.behavior = key;
    def.options.forEach((opt, i) => {
      const b = el('button', 'choice');
      b.append(el('span', 'c-title', esc(opt.label)), el('span', 'c-sub', esc(opt.sub)));
      b.addEventListener('click', () => setBehavior(key, i));
      row.append(b);
    });
    return row;
  }

  function buildFutures() {
    const wrap = el('div');

    const row = el('div', 'traj-row');
    for (const key of Object.keys(FB.config.trajectories)) {
      const def = FB.config.trajectories[key];
      const b = el('button', 'traj' + (FB.state.trajectory === key ? ' selected' : ''));
      b.append(el('span', 't-title', esc(def.title)), el('span', 't-sub', esc(def.sub)));
      b.addEventListener('click', () => {
        FB.state.trajectory = key;
        [...row.children].forEach((c) => c.classList.remove('selected'));
        b.classList.add('selected');
      });
      row.append(b);
    }

    const tabs = el('div', 'zone-tabs');
    for (const z of ['vessel', 'liver', 'pancreas']) {
      const b = el('button', 'zone-tab' + (FB.state.futuresZone === z ? ' selected' : ''),
        esc(FB.config.zoneNames[z].split('·')[1].trim()));
      b.addEventListener('click', () => {
        FB.state.futuresZone = z;
        [...tabs.children].forEach((c) => c.classList.remove('selected'));
        b.classList.add('selected');
        zoneLabel.textContent = FB.config.zoneNames[z];
        FB.app.goToZone(z);
      });
      tabs.append(b);
    }

    wrap.append(row, tabs);
    return wrap;
  }

  function go(idx) {
    if (idx >= FB.config.steps.length) return showReflection();
    const from = FB.config.steps[FB.state.stepIndex];
    FB.state.stepIndex = idx;
    const to = FB.config.steps[idx];
    const zone = to.type === 'futures' ? FB.state.futuresZone : to.zone;
    if (zone !== (from.type === 'futures' ? FB.state.futuresZone : from.zone)) {
      FB.app.goToZone(zone);
    }
    renderStep(true);
  }

  /* ============================================================
     Reflection screen
     ============================================================ */
  function buildReflection() {
    reflect = el('div', 'reflect hidden');
    const card = el('div', 'card panel');
    card.append(
      el('h2', '', 'Before you go…'),
      el('p', 'sub', 'Three quick questions. Your answers stay on this device, in this session only — nothing is saved or sent anywhere.'),
    );
    const areas = [];
    FB.config.reflection.forEach((q, i) => {
      const lab = el('label', '', (i + 1) + '. ' + esc(q));
      lab.setAttribute('for', 'refl-' + i);
      const ta = el('textarea');
      ta.id = 'refl-' + i;
      areas.push(ta);
      card.append(lab, ta);
    });

    const actions = el('div', 'actions');
    const submit = el('button', 'btn', 'Share my reflections');
    const restart = el('button', 'btn ghost', 'Start over');
    restart.addEventListener('click', () => location.reload());
    submit.addEventListener('click', () => {
      FB.state.reflection = areas.map((a, i) => ({
        question: FB.config.reflection[i],
        answer: a.value.trim() || '(no answer)',
      }));
      // in-memory only, per prototype scope — echoed to console for demos
      console.log('Inside My Future Body — reflection answers (session only):',
        FB.state.reflection);
      showSummary(card);
    });
    actions.append(submit, restart);
    card.append(actions);
    reflect.append(card);
    $root().append(reflect);
  }

  function showSummary(card) {
    let s = card.querySelector('.summary');
    if (s) s.remove();
    s = el('div', 'summary');
    s.append(el('h3', '', 'Thank you — here’s what you said'));
    FB.state.reflection.forEach((r) => {
      const qa = el('div', 'qa');
      qa.append(el('div', 'q', esc(r.question)), el('div', 'a', esc(r.answer)));
      s.append(qa);
    });
    s.append(el('p', 'sub', 'Answers live in memory only and disappear when this page closes.'));
    card.append(s);
    s.scrollIntoView({ behavior: 'smooth' });
  }

  function showReflection() {
    FB.state.view = 'reflect';
    hud.classList.add('hidden');
    reflect.classList.remove('hidden');
  }

  /* ============================================================ */
  function init() {
    buildHud();
    buildLanding();
    buildReflection();
  }

  return { init };
})();
