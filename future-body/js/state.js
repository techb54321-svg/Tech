/* ============================================================
   Inside My Future Body — application state & simple risk model
   All data lives in memory only; nothing is stored or sent.
   ============================================================ */
window.FB = window.FB || {};

FB.state = {
  view: 'landing',            // 'landing' | 'journey' | 'reflect'
  stepIndex: 0,
  behaviors: {                // level index 0..2 — higher = healthier
    drinks: 1,
    activity: 1,
    sleep: 1,
  },
  trajectory: 'current',      // selected future path on the futures step
  futuresZone: 'vessel',      // zone shown on the futures step
  reflection: [],             // answers, in memory only
};

FB.risk = {
  /* Combined risk right now, 0 (healthiest) .. 1 (highest).
     Deliberately simple and symbolic — not a clinical score. */
  now() {
    const b = FB.state.behaviors;
    const healthy = b.drinks + b.activity + b.sleep;   // 0..6
    return 1 - healthy / 6;
  },

  /* Projected risk for a future trajectory, again purely symbolic:
     the current path drifts a little worse; improvement paths ease it. */
  future(traj) {
    const r = this.now();
    if (traj === 'strong')   return Math.max(0, r * 0.25);
    if (traj === 'moderate') return Math.max(0, r * 0.6);
    return Math.min(1, r + 0.25);                      // current path
  },

  /* Severity the 3D scenes should display for the current step. */
  displayed() {
    const step = FB.config.steps[FB.state.stepIndex];
    if (step && step.type === 'futures') return this.future(FB.state.trajectory);
    return this.now();
  },

  /* Plain-language wording for the side panel. */
  word() {
    const r = this.now();
    if (r <= 0.34) return { text: 'on a strong track', color: 'var(--good)' };
    if (r <= 0.67) return { text: 'in the middle',     color: 'var(--accent-2)' };
    return { text: 'worth some changes', color: 'var(--warn)' };
  },
};
