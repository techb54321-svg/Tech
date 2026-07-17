/* ============================================================
   Inside My Future Body — journey script & content
   All narration text, voiceover placeholder lines, behaviour
   options and trajectory descriptions live here so clinicians /
   designers can edit wording without touching engine code.
   ============================================================ */
window.FB = window.FB || {};

FB.config = {

  /* ---- the three behaviour inputs ------------------------------------
     Each has 3 levels. level index 0..2, where HIGHER index = healthier.
     (Kept uniform so the risk model in state.js stays trivial.)       */
  behaviors: {
    drinks: {
      name: 'Sugary drinks',
      options: [
        { label: 'Most days',    sub: 'Soda or energy drinks daily' },
        { label: 'Sometimes',    sub: 'A few times a week' },
        { label: 'Rarely',       sub: 'Mostly water instead' },
      ],
    },
    activity: {
      name: 'Moving your body',
      options: [
        { label: 'Not much',     sub: 'Mostly sitting most days' },
        { label: 'Some',         sub: 'Active a couple of days a week' },
        { label: 'Often',        sub: 'Moving most days — any way you like' },
      ],
    },
    sleep: {
      name: 'Sleep',
      options: [
        { label: 'Short / irregular', sub: 'Under 7 hours, changing times' },
        { label: 'In between',        sub: 'Okay some nights, short others' },
        { label: 'Regular',           sub: 'Around 8–10 hours, steady times' },
      ],
    },
  },

  /* ---- future trajectories ------------------------------------------ */
  trajectories: {
    current:  { title: 'Current path',        sub: 'If habits stay as they are' },
    moderate: { title: 'Moderate improvement', sub: 'A couple of small changes' },
    strong:   { title: 'Strong improvement',   sub: 'Steady changes over time' },
  },

  /* ---- guided journey steps -----------------------------------------
     type: 'narration' | 'choice' | 'futures'
     zone: which 3D zone the camera sits in for this step
     vo:   voiceover placeholder script (shown on screen for now)      */
  steps: [
    {
      id: 'vessel-arrive', type: 'narration', zone: 'vessel',
      title: 'Your bloodstream',
      body: 'This is a blood vessel — one of thousands of living highways inside you. '
          + 'Blood cells carry oxygen and energy to every part of your body, every second.',
      vo: 'Welcome inside. This is one of your blood vessels. Everything your body needs travels through here.',
    },
    {
      id: 'vessel-explain', type: 'narration', zone: 'vessel',
      title: 'Keeping the road clear',
      body: 'Over years, extra sugar and fat in the blood can slowly leave soft deposits on the vessel wall, '
          + 'making the road narrower. You can’t feel it happening — but it responds to what you do.',
      vo: 'You can’t feel this from the outside. But day by day, your choices shape how clear this road stays.',
    },
    {
      id: 'choice-drinks', type: 'choice', zone: 'vessel', behavior: 'drinks',
      title: 'A choice: what you drink',
      body: 'Sugary drinks are one of the fastest ways extra sugar enters your blood. '
          + 'Pick what’s closest to your week — and watch the vessel respond.',
      vo: 'Try changing the answer. Notice how the vessel walls react. Nothing here is permanent — that’s the point.',
    },
    {
      id: 'liver-arrive', type: 'narration', zone: 'liver',
      title: 'Your liver',
      body: 'This is your liver — your body’s energy factory. It stores fuel, filters your blood, '
          + 'and quietly does hundreds of jobs a day.',
      vo: 'Now we’re next to your liver. Think of it as your body’s power plant and recycling centre in one.',
    },
    {
      id: 'choice-activity', type: 'choice', zone: 'liver', behavior: 'activity',
      title: 'A choice: moving your body',
      body: 'When you move, your body burns stored fuel — which helps keep extra fat from building up in the liver. '
          + 'Movement counts in any form: sport, walking, dancing, anything.',
      vo: 'Watch the liver’s surface as you change this. Movement helps it stay clear and strong.',
    },
    {
      id: 'pancreas-arrive', type: 'narration', zone: 'pancreas',
      title: 'Your pancreas & blood sugar',
      body: 'These drifting particles are glucose — sugar energy in your blood. Your pancreas releases insulin, '
          + 'a helper that guides glucose into your cells where it’s used as fuel.',
      vo: 'This is the sugar in your blood, and the helpers that keep it calm and organised.',
    },
    {
      id: 'choice-sleep', type: 'choice', zone: 'pancreas', behavior: 'sleep',
      title: 'A choice: sleep',
      body: 'Sleep is when your body recalibrates. Short or irregular sleep makes it harder for insulin to do its job, '
          + 'so blood sugar gets more chaotic. Pick what’s closest to your nights.',
      vo: 'Sleep is invisible training for your body. Watch how the glucose settles when rest is steady.',
    },
    {
      id: 'futures', type: 'futures', zone: 'vessel',
      title: 'Your possible futures',
      body: 'Based on the habits you picked, here’s a simple look ahead. Compare the paths — '
          + 'and switch zones to see each part of your body. Small changes add up. Your future isn’t fixed.',
      vo: 'None of these futures is decided yet. Every week is a new chance to steer.',
    },
  ],

  /* ---- zone display names ------------------------------------------- */
  zoneNames: {
    vessel:   'Zone 1 · Blood vessel',
    liver:    'Zone 2 · Liver',
    pancreas: 'Zone 3 · Pancreas & blood sugar',
  },

  /* ---- reflection questions ----------------------------------------- */
  reflection: [
    'Did this help you understand what is happening inside your body?',
    'Did this make you think differently about your future health?',
    'What is one change you feel you could try this week?',
  ],
};
