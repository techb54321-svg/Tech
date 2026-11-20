// The music for the Mr Blocky demo video: an original, happy ukulele song with a
// whistled tune, played by a small synthesizer written here and timed to what
// happens on screen.
//
//   node make-music.js timeline.json music.wav
//
// make-demo.js runs this for you, with the timeline it records while making the
// video, so the music follows him even if his speed or routine changes. Its beat
// is set by his footsteps, two to a beat, so he walks in time with the song.
// Every sound is made from scratch here, so there is nothing borrowed to license.
const fs = require('fs');

const SR = 48000;   // samples per second
const TAU = 2 * Math.PI;

// ---- Small helpers --------------------------------------------------------------

// Random numbers from a fixed starting point, so the music comes out the same every time.
function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = rng(2026);
const hiss = () => random() * 2 - 1;

// A note's pitch in hertz from its name, such as 'C4' or 'F#3', moved up `shift` semitones.
function hz(name, shift = 0) {
  const found = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  const step = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[found[1]] + (found[2] === '#' ? 1 : found[2] === 'b' ? -1 : 0);
  return 440 * 2 ** ((12 * (Number(found[3]) + 1) + step + shift - 69) / 12);
}

// Where everything is mixed: two channels, left and right.
class Mix {
  constructor(seconds) {
    this.length = Math.ceil(seconds * SR);
    this.left = new Float32Array(this.length);
    this.right = new Float32Array(this.length);
  }

  // Adds `seconds` of a sound starting `at` seconds in. sound(t) gives the sample t
  // seconds into the sound. pan runs from -1 (left) to 1 (right).
  add(at, seconds, pan, sound) {
    const start = Math.round(at * SR), count = Math.round(seconds * SR);
    const left = Math.cos((pan + 1) * Math.PI / 4), right = Math.sin((pan + 1) * Math.PI / 4);
    for (let i = 0; i < count; i++) {
      const v = sound(i / SR);
      const j = start + i;
      if (j < 0) continue;
      if (j >= this.length) break;
      this.left[j] += v * left;
      this.right[j] += v * right;
    }
  }
}

// Sums sine waves, each [ratio to the note, level, seconds to die away], struck at once.
function struck(mix, at, freq, partials, { gain, pan }) {
  const parts = partials.filter(([ratio]) => freq * ratio < 16000);
  const longest = Math.max(...parts.map(([, , decay]) => decay));
  mix.add(at, longest * 5, pan, (t) => {
    let v = 0;
    for (const [ratio, level, decay] of parts) v += level * Math.exp(-t / decay) * Math.sin(TAU * freq * ratio * t);
    return gain * v * Math.min(1, t / .0015);
  });
}

// Hiss through a filter: the makings of swishes, shakers and snaps. cutoff(t) is in hertz.
function hissed(mix, at, seconds, cutoff, shape, { gain = .1, pan = 0, kind = 'band', resonance = 1 } = {}) {
  let low = 0, band = 0;
  mix.add(at, seconds, pan, (t) => {
    const f = 2 * Math.sin(Math.PI * Math.min(cutoff(t), SR / 7) / SR);
    low += f * band;
    const high = hiss() - low - resonance * band;
    band += f * high;
    return gain * shape(t) * (kind === 'band' ? band : high);
  });
}

// ---- The instruments ------------------------------------------------------------

// A plucked string: a ukulele string, or, low and dull, a double bass.
function pluck(mix, at, freq, { gain = .25, pan = 0, ring = .4, bright = .55 } = {}) {
  const partials = [];
  for (let k = 1; k <= 14; k++) partials.push([k * (1 + .0003 * k * k), bright ** (k - 1) / k ** .6, ring / (1 + .9 * (k - 1))]);
  struck(mix, at, freq, partials, { gain, pan });
}

// Strings plucked one after another in the order given, like a strum.
function strum(mix, at, notes, { gain = .07, pan = 0, ring = .55, gap = .013, bright = .6 } = {}) {
  notes.forEach((note, i) => pluck(mix, at + i * gap, hz(note), { gain, ring, bright, pan: pan + (i - notes.length / 2) * .08 }));
}

const bass = (mix, at, note, { gain = .2, ring = .45 } = {}) => pluck(mix, at, hz(note), { gain, ring, bright: .35, pan: -.1 });

// A marimba: a warm wooden bar struck with a soft mallet.
function marimba(mix, at, freq, { gain = .12, pan = 0 } = {}) {
  const ring = Math.min(.9, .5 * Math.sqrt(440 / freq));
  struck(mix, at, freq, [[1, 1, ring], [3.93, .26, ring * .16], [9.24, .07, ring * .05]], { gain, pan });
}

// A glockenspiel: small metal bars, bright and ringing.
function bell(mix, at, freq, { gain = .04, pan = 0, ring = 1.1 } = {}) {
  struck(mix, at, freq, [[1, 1, ring], [2.76, .4, ring * .3], [5.4, .22, ring * .12], [8.93, .1, ring * .05]], { gain, pan });
}

// Someone whistling: nearly a pure tone with a little breath in it, scooping up into
// each note and warming into a vibrato if it is held. `fall` lets the end of a note droop.
function whistle(mix, at, seconds, freq, { gain = .1, pan = .1, fall = 0 } = {}) {
  let phase = 0, low = 0, band = 0;
  mix.add(at, seconds + .06, pan, (t) => {
    const scoop = 1 - .03 * Math.exp(-t / .035);
    const droop = 1 - fall * Math.max(0, Math.min(1, (t - seconds / 2) / (seconds / 2)));
    const vibrato = 1 + .007 * Math.max(0, Math.min(1, (t - .12) / .15)) * Math.sin(TAU * 5.4 * t);
    const f = freq * scoop * droop * vibrato;
    phase += TAU * f / SR;
    const c = 2 * Math.sin(Math.PI * Math.min(f, SR / 7) / SR);
    low += c * band;
    const high = hiss() - low - .25 * band;
    band += c * high;
    const shape = Math.min(1, t / .03) * (t < seconds ? 1 : Math.max(0, 1 - (t - seconds) / .06));
    return gain * shape * (Math.sin(phase) + .04 * Math.sin(2 * phase) + .02 * band);
  });
}

// A soft organ, holding chords underneath everything else.
function pad(mix, at, seconds, notes, { gain = .012 } = {}) {
  for (const note of notes) {
    const f = hz(note);
    mix.add(at, seconds + .25, 0, (t) => {
      const shape = Math.min(1, t / .08) * (t < seconds ? 1 : Math.max(0, 1 - (t - seconds) / .25));
      return gain * shape * (Math.sin(TAU * f * t) + .3 * Math.sin(TAU * 2 * f * t) + .1 * Math.sin(TAU * 3 * f * t));
    });
  }
}

// A slide whistle, swooping from one pitch to another. A higher `curve` saves the swoop for the end.
function slideWhistle(mix, at, seconds, from, to, { gain = .08, pan = 0, curve = 1 } = {}) {
  let phase = 0;
  mix.add(at, seconds, pan, (t) => {
    const f = from * (to / from) ** ((t / seconds) ** curve) * (1 + .006 * Math.sin(TAU * 5.5 * t));
    phase += TAU * f / SR;
    const shape = Math.min(1, t / .03) * Math.min(1, (seconds - t) / .04);
    return gain * shape * (Math.sin(phase) + .1 * Math.sin(2 * phase) + .03 * hiss());
  });
}

// A spring: boyoyoyoing.
function boing(mix, at, { gain = .12, pan = 0, freq = 220, seconds = .7 } = {}) {
  let phase = 0;
  mix.add(at, seconds, pan, (t) => {
    const settle = Math.exp(-t / .2);
    const f = freq * (1 + .4 * settle * Math.sin(TAU * 13 * t)) * (1 + .2 * (1 - settle));
    phase += TAU * f / SR;
    const shape = Math.min(1, t / .004) * Math.exp(-t / .25);
    return gain * shape * (Math.sin(phase) + .5 * Math.sin(2 * phase) + .25 * Math.sin(3 * phase));
  });
}

// A low, soft thump, like a muffled bass drum.
function thump(mix, at, { gain = .1, from = 120, to = 50 } = {}) {
  let phase = 0;
  mix.add(at, .3, 0, (t) => {
    phase += TAU * (to + (from - to) * Math.exp(-t / .03)) / SR;
    return gain * Math.min(1, t / .002) * Math.exp(-t / .08) * Math.sin(phase);
  });
}

// A nose pressing a button: a round "boop" with a little thump under it.
function boop(mix, at, { gain = .3 } = {}) {
  let phase = 0;
  mix.add(at, .25, 0, (t) => {
    phase += TAU * (540 + 300 * Math.exp(-t / .02)) / SR;
    return gain * Math.min(1, t / .003) * Math.exp(-t / .055) * (Math.sin(phase) + .15 * Math.sin(2 * phase));
  });
  thump(mix, at, { gain: gain * .6, from: 160, to: 70 });
}

// A drop of water: plip. Rising for something appearing, falling for something leaving.
function plip(mix, at, from, to, { gain = .1, pan = 0, seconds = .09 } = {}) {
  let phase = 0;
  mix.add(at, seconds + .06, pan, (t) => {
    phase += TAU * from * (to / from) ** Math.min(1, t / seconds) / SR;
    return gain * Math.min(1, t / .002) * Math.exp(-t / (seconds * .6)) * Math.sin(phase);
  });
}

// A dry knock on a small block of wood.
function woodblock(mix, at, { gain = .05, pan = 0, freq = 1180 } = {}) {
  mix.add(at, .12, pan, (t) => gain * Math.min(1, t / .0008) *
    (Math.exp(-t / .022) * Math.sin(TAU * freq * t) + .4 * Math.exp(-t / .012) * Math.sin(TAU * freq * 2.37 * t)));
}

const swish = (mix, at, { gain = .04, up = false, seconds = .24, pan = 0 } = {}) => hissed(mix, at, seconds,
  (t) => (up ? 500 * 10 ** (t / seconds) : 4500 * .2 ** (t / seconds)), (t) => Math.sin(Math.PI * t / seconds) ** 2,
  { gain, pan, resonance: 1.2 });
const shaker = (mix, at, { gain = .02, pan = .25 } = {}) =>
  hissed(mix, at, .06, () => 7000, (t) => Math.exp(-t / .018), { gain, pan, kind: 'high' });
const snap = (mix, at, { gain = .05, pan = -.15 } = {}) =>
  hissed(mix, at, .08, () => 2200, (t) => Math.min(1, t / .0006) * Math.exp(-t / .02), { gain, pan, resonance: .8 });
const crash = (mix, at, { gain = .035 } = {}) =>
  hissed(mix, at, 2.6, () => 6500, (t) => Math.min(1, t / .002) * Math.exp(-t / .7), { gain, kind: 'high' });

// ---- The band ---------------------------------------------------------------------

// Each chord as a ukulele plays it (top string first, as it is strummed down), the
// notes the organ holds, and the bass note.
const CHORDS = {
  C: { uke: ['G4', 'C4', 'E4', 'C5'], pad: ['C4', 'E4', 'G4'], bass: 'C3' },
  Am: { uke: ['A4', 'C4', 'E4', 'A4'], pad: ['A3', 'C4', 'E4'], bass: 'A2' },
  F: { uke: ['A4', 'C4', 'F4', 'A4'], pad: ['F3', 'A3', 'C4'], bass: 'F2' },
  G: { uke: ['G4', 'D4', 'B4', 'D5'], pad: ['G3', 'B3', 'D4'], bass: 'G2' },
  G7: { uke: ['G4', 'D4', 'F4', 'B4'], pad: ['G3', 'B3', 'F4'], bass: 'G2' },
  E: { uke: ['B4', 'E4', 'G#4', 'B4'], pad: ['E3', 'G#3', 'B3'], bass: 'E2' },
};

// A bar of strummed ukulele: down, down-up, up-down-up. chordAt(b) names the chord at
// beat b. Strums outside `from` and `until` are left out.
function ukeBar(mix, t0, beat, chordAt, { gain = .065, from = -Infinity, until = Infinity } = {}) {
  for (const [b, down] of [[0, true], [1, true], [1.5, false], [2.5, false], [3, true], [3.5, false]]) {
    const t = t0 + b * beat;
    if (t < from || t >= until) continue;
    const shape = CHORDS[chordAt(b)].uke;
    strum(mix, t, down ? shape : shape.slice(1).reverse(), { gain: down ? gain : gain * .65, gap: down ? .013 : .009 });
  }
}

// A bar of soft drums: a thump on 1 and 3, a finger snap on 2 and 4, and a shaker.
function drumBar(mix, t0, beat, { from = -Infinity, until = Infinity } = {}) {
  const at = (b, play) => { const t = t0 + b * beat; if (t >= from && t < until) play(t); };
  at(0, (t) => thump(mix, t));
  at(2, (t) => thump(mix, t, { gain: .08 }));
  at(1, (t) => snap(mix, t));
  at(3, (t) => snap(mix, t));
  for (let e = 0; e < 8; e++) at(e / 2, (t) => shaker(mix, t, { gain: e % 2 ? .024 : .014 }));
}

// Plays a line of [beat, note, length in beats] with play(time, note, seconds).
function line(t0, beat, notes, play) {
  for (const [b, note, length] of notes) play(t0 + b * beat, note, length * beat);
}

// ---- Finishing ----------------------------------------------------------------------

// A little room around everything, so it sounds played rather than computed.
function room(mix, wet = .2) {
  const scale = SR / 44100;
  const tank = (input, spread) => {
    let out = new Float32Array(input.length);
    for (const size of [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]) {
      const echo = new Float32Array(Math.round((size + spread) * scale));
      let i = 0, damped = 0;
      for (let n = 0; n < input.length; n++) {
        const y = echo[i];
        damped = y * .6 + damped * .4;
        echo[i] = input[n] * .015 + damped * .84;
        out[n] += y;
        if (++i === echo.length) i = 0;
      }
    }
    for (const size of [556, 441, 341, 225]) {
      const echo = new Float32Array(Math.round((size + spread) * scale));
      const next = new Float32Array(out.length);
      let i = 0;
      for (let n = 0; n < out.length; n++) {
        const b = echo[i];
        next[n] = b - out[n];
        echo[i] = out[n] + b * .5;
        if (++i === echo.length) i = 0;
      }
      out = next;
    }
    return out;
  };
  const left = tank(mix.left, 0), right = tank(mix.right, 23);
  const level = (a) => Math.sqrt(a.reduce((sum, v) => sum + v * v, 0) / a.length);
  const k = wet * level(mix.left) / (level(left) || 1);
  for (let n = 0; n < mix.length; n++) {
    mix.left[n] += k * left[n];
    mix.right[n] += k * right[n];
  }
}

// Takes the hard edge off the very top of the sound, which small speakers make shrill.
function soften(mix, cutoff = 9000) {
  const a = 1 - Math.exp(-TAU * cutoff / SR);
  for (const channel of [mix.left, mix.right]) {
    let y = 0;
    for (let i = 0; i < channel.length; i++) channel[i] = y += a * (channel[i] - y);
  }
}

// Fades out the last moments, sets the level, and rounds off any peak that would distort.
function finish(mix, fadeSeconds = .6) {
  const fade = Math.round(fadeSeconds * SR);
  for (let i = 0; i < fade; i++) {
    const g = (i / fade) ** 2;
    mix.left[mix.length - 1 - i] *= g;
    mix.right[mix.length - 1 - i] *= g;
  }
  // Set the level by the loud parts, not the single loudest moment.
  const sizes = [];
  for (let i = 0; i < mix.length; i += 7) sizes.push(Math.abs(mix.left[i]), Math.abs(mix.right[i]));
  sizes.sort((a, b) => a - b);
  const loud = sizes[Math.floor(sizes.length * .995)] || 1;
  const gain = .5 / loud, knee = .58, ceiling = .85;
  const limit = (v) => {
    const a = Math.abs(v * gain);
    return Math.sign(v) * (a <= knee ? a : knee + (ceiling - knee) * Math.tanh((a - knee) / (ceiling - knee)));
  };
  for (let i = 0; i < mix.length; i++) {
    mix.left[i] = limit(mix.left[i]);
    mix.right[i] = limit(mix.right[i]);
  }
}

function writeWav(path, mix) {
  const bytes = mix.length * 4, out = Buffer.alloc(44 + bytes);
  out.write('RIFF', 0);
  out.writeUInt32LE(36 + bytes, 4);
  out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);        // plain samples
  out.writeUInt16LE(2, 22);        // two channels
  out.writeUInt32LE(SR, 24);
  out.writeUInt32LE(SR * 4, 28);
  out.writeUInt16LE(4, 32);
  out.writeUInt16LE(16, 34);       // 16 bits each
  out.write('data', 36);
  out.writeUInt32LE(bytes, 40);
  const sample = (v) => Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  for (let i = 0; i < mix.length; i++) {
    out.writeInt16LE(sample(mix.left[i]), 44 + i * 4);
    out.writeInt16LE(sample(mix.right[i]), 46 + i * 4);
  }
  fs.writeFileSync(path, out);
}

// ---- The song -----------------------------------------------------------------------
// `at` is the timeline from make-demo.js: when each moment happens, in seconds.
function score(at) {
  const mix = new Mix(at.length);
  // Two of his footsteps to a beat, with the beats lined up on his footsteps, and the
  // song's first full bar starting as the phone comes in.
  const pace = (at.steps[at.steps.length - 1] - at.steps[0]) / (at.steps.length - 1);
  const beat = 2 * pace;
  const first = at.steps[0] + Math.round((at.title - at.steps[0]) / pace) * pace;
  const bar = (n) => first + n * 4 * beat;
  const sing = (t, note, seconds) => whistle(mix, t, seconds * .88, hz(note));
  const quiet = at.steps[0] - .02;   // the band drops back from his first step

  // 1. The opening card: a little spring as his badge pops up, and a sparkle. Then the
  //    ukulele starts, and a whistled pickup leads into the song.
  boing(mix, .03, { gain: .08, freq: 330, seconds: .5 });
  ['C6', 'E6', 'G6', 'C7'].forEach((note, i) => bell(mix, .26 + i * .065, hz(note), { gain: .03, pan: -.3 + .2 * i }));
  const intro = bar(-1), start = Math.max(.25, intro);
  ukeBar(mix, intro, beat, (b) => (b < 2 ? 'C' : 'G'), { gain: .05, from: start });
  bass(mix, start, 'C3');
  bass(mix, intro + 2 * beat, 'G2');
  pad(mix, start, intro + 2 * beat - start, CHORDS.C.pad, { gain: .009 });
  pad(mix, intro + 2 * beat, 2 * beat, CHORDS.G.pad, { gain: .009 });
  for (let e = 4; e < 8; e++) shaker(mix, intro + e * beat / 2, { gain: e % 2 ? .018 : .01 });
  line(intro, beat, [[3, 'C5', .5], [3.5, 'D5', .5]], sing);

  // 2. Scrolling: a sunny ukulele song, with a whistled tune that starts "nope, not now".
  const verse = [
    { chords: ['C', 'Am'], tune: [[0, 'E5', .5], [.5, 'D5', .5], [1, 'C5', 1], [2, 'E5', .5], [2.5, 'G5', .5], [3, 'A5', 1]] },
    { chords: ['F', 'G7'], tune: [[0, 'A5', .5], [.5, 'G5', .5], [1, 'F5', 1], [2, 'B4', .5], [2.5, 'C5', .5], [3, 'D5', .5], [3.5, 'F5', .5]] },
  ];
  let n = 0;
  for (; bar(n) < quiet; n++) {
    const { chords, tune } = verse[n % 2], t0 = bar(n);
    ukeBar(mix, t0, beat, (b) => chords[b < 2 ? 0 : 1], { until: quiet });
    drumBar(mix, t0, beat, { until: quiet });
    chords.forEach((chord, half) => {
      const t = t0 + half * 2 * beat;
      bass(mix, t, CHORDS[chord].bass);
      if (t < quiet) pad(mix, t, Math.min(2 * beat, quiet - t), CHORDS[chord].pad);
    });
    line(t0, beat, tune, sing);
  }
  plip(mix, at.tap, hz('G5'), hz('D6'), { gain: .07 });   // a finger taps Instagram
  swish(mix, at.open, { gain: .035, up: true, seconds: .3 });     // and it opens

  // 3. Mr Blocky appears: the band drops out under a held chord, then a soft, sneaky
  //    little tune in a minor key while he tiptoes across, his feet on its beats.
  strum(mix, at.steps[0], CHORDS.G7.uke, { gain: .045, ring: 1 });
  pad(mix, at.steps[0], bar(n) - at.steps[0], CHORDS.G7.pad, { gain: .01 });
  for (; bar(n) < at.arrive - beat / 2; n++) {
    const t0 = bar(n);
    [['A2', 0], ['C3', 1], ['E2', 2], ['G#2', 3]].forEach(([note, b]) => bass(mix, t0 + b * beat, note, { gain: .15, ring: .22 }));
    [[0, 'A4'], [1, 'C5'], [2, 'B4'], [3, 'G#4'], [3.5, 'B4']].forEach(([b, note]) => marimba(mix, t0 + b * beat, hz(note), { gain: .1, pan: .15 }));
    strum(mix, t0 + beat, CHORDS.Am.uke, { gain: .03, ring: .07, bright: .3 });
    strum(mix, t0 + 3 * beat, CHORDS.E.uke, { gain: .03, ring: .07, bright: .3 });
    pad(mix, t0, 2 * beat, CHORDS.Am.pad, { gain: .008 });
    pad(mix, t0 + 2 * beat, 2 * beat, CHORDS.E.pad, { gain: .008 });
    for (let e = 0; e < 8; e++) shaker(mix, t0 + e * beat / 2, { gain: e % 2 ? .014 : .008 });
  }

  // 4. He stops on one last chord. A slide whistle rises as he winds up... boop. Boing.
  const stop = bar(n) <= at.arrive + beat ? bar(n) : at.arrive;
  strum(mix, stop, CHORDS.Am.uke, { gain: .05, ring: .5 });
  bass(mix, stop, 'A2', { gain: .17, ring: .4 });
  marimba(mix, stop, hz('A4'), { gain: .1 });
  slideWhistle(mix, at.arrive + .08, at.boop - at.arrive - .08, 300, 1000, { gain: .07, curve: 1.8 });
  boop(mix, at.boop);
  boing(mix, at.boop + .03, { gain: .1, freq: 196 });

  // 5. The screen goes dark as the slide whistle sinks back down.
  slideWhistle(mix, at.lightsOut, .42, 1000, 230, { gain: .07, curve: .6 });

  // 6. He turns round and says "Nope not now": the whistle sings it to the song's first
  //    three notes, and a soft tick-tock follows his head from side to side.
  swish(mix, at.turn - .06, { gain: .025, seconds: .14, up: true });
  plip(mix, at.speak, hz('E5'), hz('B5'), { gain: .06 });
  [['E5', .13, 0], ['D5', .13, 0], ['C5', .36, .05]].forEach(([note, seconds, fall], i) => {
    if (at.shakes[i] !== undefined) whistle(mix, at.shakes[i] - .03, seconds, hz(note), { gain: .1, fall });
  });
  pad(mix, at.speak, at.shakes[at.shakes.length - 1] + .3 - at.speak, CHORDS.C.pad, { gain: .007 });
  at.shakes.forEach((t, i) => woodblock(mix, t, { gain: .022, freq: i % 2 ? 940 : 1250, pan: i % 2 ? -.3 : .3 }));

  // 7. He fades away and the phone is back on its home screen: the song comes back in,
  //    climbing up to...
  plip(mix, at.fade, hz('A5'), hz('A4'), { gain: .05 });
  const last = at.card - 4 * beat, back = Math.max(last + beat, at.done - .1);
  ukeBar(mix, last, beat, (b) => (b < 2 ? 'C' : 'G'), { gain: .06 });
  drumBar(mix, last, beat, { from: back });
  [['C3', 0], ['E3', 1], ['G2', 2], ['B2', 3]].forEach(([note, b]) => bass(mix, last + b * beat, note));
  pad(mix, last, 2 * beat, CHORDS.C.pad);
  pad(mix, last + 2 * beat, 2 * beat, CHORDS.G.pad);
  line(last, beat, [[1, 'C5', .5], [1.5, 'E5', .5], [2, 'G5', .5], [2.5, 'F5', .5], [3, 'D5', .5], [3.5, 'B4', .5]], sing);

  // 8. ...the closing card: ta-da! The whistle sings "nope, not now" once more as the
  //    words appear, and the song ends on a big happy chord.
  const card = at.card, end = card + 4 * beat;
  strum(mix, card, CHORDS.C.uke, { gain: .08, ring: 1.4 });
  ['C6', 'E6', 'G6'].forEach((note, i) => bell(mix, card + i * .02, hz(note), { gain: .03 }));
  crash(mix, card);
  ukeBar(mix, card, beat, (b) => (b < 2 ? 'C' : b < 3 ? 'F' : 'G'), { gain: .06, from: card + beat / 2 });
  drumBar(mix, card, beat);
  [['C3', 0], ['C3', 1], ['F2', 2], ['G2', 3]].forEach(([note, b]) => bass(mix, card + b * beat, note));
  pad(mix, card, 2 * beat, CHORDS.C.pad);
  pad(mix, card + 2 * beat, beat, CHORDS.F.pad);
  pad(mix, card + 3 * beat, beat, CHORDS.G.pad);
  const hook = [[0, 'C5', 1], [1, 'E5', .5], [1.5, 'D5', .5], [2, 'C5', 1], [3, 'B4', 1]];
  line(card, beat, hook, sing);
  line(card, beat, hook, (t, note) => bell(mix, t, hz(note, 12), { gain: .012, pan: .3 }));
  if (end < at.length - .3) {
    strum(mix, end, CHORDS.C.uke, { gain: .075, ring: 1.6 });
    bass(mix, end, 'C3', { ring: .9 });
    thump(mix, end, { gain: .08 });
    pad(mix, end, at.length - end, CHORDS.C.pad, { gain: .012 });
    bell(mix, end, hz('C6'), { gain: .025 });
    bell(mix, end + .02, hz('G6'), { gain: .018 });
    sing(end, 'C5', 1.5 * beat / .88);
  }

  room(mix);
  soften(mix);
  finish(mix);
  return mix;
}

function makeMusic(timeline, wavPath) {
  writeWav(wavPath, score(timeline));
}

module.exports = { makeMusic };

if (require.main === module) {
  const [timelinePath, wavPath] = process.argv.slice(2);
  if (!timelinePath || !wavPath) {
    console.error('Usage: node make-music.js timeline.json music.wav');
    process.exit(1);
  }
  makeMusic(JSON.parse(fs.readFileSync(timelinePath, 'utf8')), wavPath);
  console.log('Wrote ' + wavPath);
}
