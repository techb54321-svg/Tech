// The music for the Mr Blocky demo video: an original cartoon score, played by a
// small synthesizer written here and timed to what happens on screen.
//
//   node make-music.js timeline.json music.wav
//
// make-demo.js runs this for you, with the timeline it records while making the
// video, so the music follows him even if his speed or routine changes. Every
// sound is made from scratch here, so there is nothing borrowed to license.
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

// ---- The instruments ------------------------------------------------------------

// A plucked string: short and dull it is a pizzicato, longer and brighter a ukulele.
function pluck(mix, at, freq, { gain = .25, pan = 0, ring = .4, bright = .55 } = {}) {
  const partials = [];
  for (let k = 1; k <= 14; k++) partials.push([k * (1 + .0003 * k * k), bright ** (k - 1) / k ** .6, ring / (1 + .9 * (k - 1))]);
  struck(mix, at, freq, partials, { gain, pan });
}

// Strings plucked one after another, low to high, like a strummed ukulele.
function strum(mix, at, notes, { gain = .12, pan = 0, ring = .8, gap = .014 } = {}) {
  notes.forEach((note, i) => pluck(mix, at + i * gap, hz(note), { gain, ring, bright: .62, pan: pan + (i - notes.length / 2) * .08 }));
}

// A marimba: a warm wooden bar struck with a soft mallet.
function marimba(mix, at, freq, { gain = .2, pan = 0 } = {}) {
  const ring = Math.min(.9, .5 * Math.sqrt(440 / freq));
  struck(mix, at, freq, [[1, 1, ring], [3.93, .26, ring * .16], [9.24, .07, ring * .05]], { gain, pan });
}

// A glockenspiel: small metal bars, bright and ringing.
function bell(mix, at, freq, { gain = .08, pan = 0, ring = 1.1 } = {}) {
  struck(mix, at, freq, [[1, 1, ring], [2.76, .4, ring * .3], [5.4, .22, ring * .12], [8.93, .1, ring * .05]], { gain, pan });
}

// A tuba, for the "oom" of an oom-pah. It slides up into each note a little.
function tuba(mix, at, freq, seconds, { gain = .26, pan = 0 } = {}) {
  const levels = [1, .62, .4, .24, .13, .07, .035];
  const release = .08;
  mix.add(at, seconds + release, pan, (t) => {
    const shape = t < .025 ? t / .025 : t < seconds ? 1 - .3 * (t - .025) / seconds : .7 * Math.max(0, 1 - (t - seconds) / release);
    const phase = TAU * freq * (t - .0012 * (1 - Math.exp(-t / .04)));
    let v = 0;
    for (let k = 0; k < levels.length; k++) v += levels[k] * Math.sin((k + 1) * phase);
    return gain * shape * v * .5;
  });
}

// A kazoo: a buzzy, nasal hum. pitch(t) gives its pitch t seconds in, so it can slide.
function kazoo(mix, at, seconds, pitch, { gain = .15, pan = 0 } = {}) {
  // How strongly the buzz brings out each pitch, which is what makes it sound like a kazoo.
  const buzz = (f) => .1 + 1 / (1 + ((f - 700) / 190) ** 2) + .7 / (1 + ((f - 1750) / 280) ** 2) + .45 / (1 + ((f - 3000) / 420) ** 2);
  let phase = 0;
  mix.add(at, seconds, pan, (t) => {
    const f = pitch(t) * (1 + .014 * Math.sin(TAU * 6.2 * t));
    phase += TAU * f / SR;
    let v = 0;
    for (let k = 1; k * f < 8000; k++) v += buzz(k * f) * Math.sin(k * phase) / k ** .9;
    const shape = Math.min(1, t / .018) * Math.min(1, (seconds - t) / .035);
    return gain * shape * (v + .06 * hiss());
  });
}

// A slide whistle, swooping from one pitch to another. A higher `curve` saves the swoop for the end.
function slideWhistle(mix, at, seconds, from, to, { gain = .14, pan = 0, curve = 1 } = {}) {
  let phase = 0;
  mix.add(at, seconds, pan, (t) => {
    const f = from * (to / from) ** ((t / seconds) ** curve) * (1 + .006 * Math.sin(TAU * 5.5 * t));
    phase += TAU * f / SR;
    const shape = Math.min(1, t / .03) * Math.min(1, (seconds - t) / .04);
    return gain * shape * (Math.sin(phase) + .1 * Math.sin(2 * phase) + .03 * hiss());
  });
}

// A spring: boyoyoyoing.
function boing(mix, at, { gain = .2, pan = 0, freq = 220, seconds = .7 } = {}) {
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
function thump(mix, at, { gain = .2, from = 140, to = 48 } = {}) {
  let phase = 0;
  mix.add(at, .3, 0, (t) => {
    phase += TAU * (to + (from - to) * Math.exp(-t / .03)) / SR;
    return gain * Math.min(1, t / .002) * Math.exp(-t / .08) * Math.sin(phase);
  });
}

// A nose pressing a button: a round "boop" with a little thump under it.
function boop(mix, at, { gain = .38 } = {}) {
  let phase = 0;
  mix.add(at, .25, 0, (t) => {
    phase += TAU * (540 + 300 * Math.exp(-t / .02)) / SR;
    return gain * Math.min(1, t / .003) * Math.exp(-t / .055) * (Math.sin(phase) + .15 * Math.sin(2 * phase));
  });
  thump(mix, at, { gain: gain * .6, from: 160, to: 70 });
}

// A drop of water: plip. Rising for something appearing, falling for something leaving.
function plip(mix, at, from, to, { gain = .2, pan = 0, seconds = .09 } = {}) {
  let phase = 0;
  mix.add(at, seconds + .06, pan, (t) => {
    phase += TAU * from * (to / from) ** Math.min(1, t / seconds) / SR;
    return gain * Math.min(1, t / .002) * Math.exp(-t / (seconds * .6)) * Math.sin(phase);
  });
}

// A dry knock on a hollow block of wood.
function woodblock(mix, at, { gain = .1, pan = -.3, freq = 1180 } = {}) {
  mix.add(at, .12, pan, (t) => gain * Math.min(1, t / .0008) *
    (Math.exp(-t / .022) * Math.sin(TAU * freq * t) + .4 * Math.exp(-t / .012) * Math.sin(TAU * freq * 2.37 * t)));
}

// Hiss through a filter: the makings of swishes, shakers and cymbals. cutoff(t) is in hertz.
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

// Air rushing past, sweeping up or down.
const swish = (mix, at, { gain = .08, up = false, seconds = .24, pan = 0 } = {}) => hissed(mix, at, seconds,
  (t) => (up ? 500 * 10 ** (t / seconds) : 4500 * .2 ** (t / seconds)), (t) => Math.sin(Math.PI * t / seconds) ** 2,
  { gain, pan, resonance: 1.2 });
const shaker = (mix, at, { gain = .03, pan = .25 } = {}) =>
  hissed(mix, at, .06, () => 7000, (t) => Math.exp(-t / .018), { gain, pan, kind: 'high' });
const crash = (mix, at, { gain = .06 } = {}) =>
  hissed(mix, at, 2.6, () => 6500, (t) => Math.min(1, t / .002) * Math.exp(-t / .7), { gain, kind: 'high' });

// ---- Effects ----------------------------------------------------------------------

// Copies `from` into `into` up to `at` seconds, then slows it to a halt over `seconds`,
// pitch and all, like a record stopped by hand.
function grindToAHalt(from, into, at, seconds) {
  const start = Math.round(at * SR), count = Math.round(seconds * SR);
  for (let i = 0; i < start; i++) {
    into.left[i] += from.left[i];
    into.right[i] += from.right[i];
  }
  let p = start;
  for (let i = 0; i < count && start + i < into.length; i++) {
    const u = i / count, k = Math.floor(p), w = p - k, fade = 1 - u * u;
    into.left[start + i] += fade * (from.left[k] * (1 - w) + from.left[k + 1] * w);
    into.right[start + i] += fade * (from.right[k] * (1 - w) + from.right[k + 1] * w);
    p += (1 - u) ** 1.5;
  }
}

// A little room around everything, so it sounds played rather than computed.
function room(mix, wet = .16) {
  const scale = SR / 44100;
  const tank = (input, spread) => {
    let out = new Float32Array(input.length);
    for (const size of [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]) {
      const echo = new Float32Array(Math.round((size + spread) * scale));
      let i = 0, damped = 0;
      for (let n = 0; n < input.length; n++) {
        const y = echo[i];
        damped = y * .75 + damped * .25;
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

// ---- The score --------------------------------------------------------------------
// `at` is the timeline from make-demo.js: when each moment happens, in seconds.
function score(at) {
  const mix = new Mix(at.length);
  const tune = new Mix(at.length);   // the scrolling tune, kept apart so it can be stopped
  const beat = 60 / 124;

  // 1. The opening card: a spring as his badge pops up, a sparkle, and a strum as his name
  //    rises, then a run up into the tune as the phone comes in.
  boing(mix, .03, { gain: .14, freq: 330, seconds: .6 });
  ['C6', 'E6', 'G6', 'C7'].forEach((note, i) => bell(mix, .26 + i * .065, hz(note), { gain: .05, pan: -.3 + .2 * i }));
  const intro = at.title - 4 * beat;
  strum(mix, intro, ['C4', 'G4', 'C5', 'E5'], { gain: .11 });
  tuba(mix, intro, hz('C2'), beat * .9);
  marimba(mix, intro, hz('C5'), { gain: .15 });
  tuba(mix, intro + 2 * beat, hz('G1'), beat * .8);
  [['G4', 2.5], ['A4', 3], ['B4', 3.5]].forEach(([note, b]) => marimba(mix, intro + b * beat, hz(note), { gain: .15, pan: .15 }));

  // 2. Scrolling: a bouncy oom-pah tune that goes round and round, like the feed.
  const bars = [
    { bass: ['C2', 'G1'], chords: [['E4', 'G4', 'C5'], ['E4', 'G4', 'C5']],
      tune: [[0, 'C5'], [1, 'E5'], [1.5, 'G5'], [2, 'A5'], [2.5, 'G5'], [3, 'E5'], [3.5, 'D5']] },
    { bass: ['F2', 'G2'], chords: [['F4', 'A4', 'C5'], ['D4', 'G4', 'B4']],
      tune: [[0, 'C5'], [1, 'A4'], [1.5, 'C5'], [2, 'D5'], [2.5, 'B4'], [3, 'G4'], [3.5, 'B4']] },
  ];
  for (let n = 0, t0 = at.title; t0 < at.steps[0] + 1; n++, t0 += 4 * beat) {
    const bar = bars[n % 2];
    tuba(tune, t0, hz(bar.bass[0]), beat * .8);
    tuba(tune, t0 + 2 * beat, hz(bar.bass[1]), beat * .8);
    strum(tune, t0 + beat, bar.chords[0], { gain: .07, ring: .25, gap: .008 });
    strum(tune, t0 + 3 * beat, bar.chords[1], { gain: .07, ring: .25, gap: .008 });
    for (const [b, note] of bar.tune) marimba(tune, t0 + b * beat, hz(note), { gain: .16, pan: .15 });
    for (let e = 0; e < 8; e++) shaker(tune, t0 + e * beat / 2, { gain: e % 2 ? .03 : .018 });
    thump(tune, t0, { gain: .14 });
    thump(tune, t0 + 2 * beat, { gain: .1 });
    woodblock(tune, t0 + 1.5 * beat, { gain: .045 });
    woodblock(tune, t0 + 3.5 * beat, { gain: .045, freq: 1050 });
  }
  plip(mix, at.tap, 420, 1000, { gain: .18 });                     // a finger taps Instagram
  swish(mix, at.open, { gain: .08, up: true, seconds: .3 });       // the app opens
  for (const t of at.flicks) swish(mix, t, { gain: t < at.walk ? .06 : .035, pan: .2 });   // the feed flicks along

  // 3. Mr Blocky turns up and the tune grinds to a halt just as his first foot lands. He
  //    tiptoes across: a pizzicato for every footstep, and a line that creeps up the scale
  //    as he gets closer to the button, quickening for the last few steps.
  grindToAHalt(tune, mix, at.steps[0] - .32, .32);
  const steps = at.steps.length;
  let creep = 0;
  at.steps.forEach((t, i) => {
    pluck(mix, t, hz(i % 2 ? 'G2' : 'C3'), { gain: i % 2 ? .2 : .28, ring: .2, bright: .4, pan: -.1 });
    if ((i < steps - 4 && i % 2 === 0) || i >= steps - 4) pluck(mix, t, hz('C4', creep++), { gain: .15, ring: .28, bright: .55, pan: .2 });
  });

  // 4. He stops, leans back while a slide whistle rises... and boops the button. Boing.
  slideWhistle(mix, at.arrive + .08, at.boop - at.arrive - .08, 380, 1600, { gain: .15, curve: 1.8 });
  boop(mix, at.boop);
  boing(mix, at.boop + .03, { gain: .18, freq: 190 });

  // 5. The screen goes dark as the slide whistle drops back down.
  slideWhistle(mix, at.lightsOut, .42, 1500, 240, { gain: .17, curve: .6 });

  // 6. He spins round and says "Nope not now", a kazoo going "nuh-uh" with each shake of
  //    his head, the last one sagging.
  swish(mix, at.turn - .06, { gain: .045, seconds: .14, up: true });
  plip(mix, at.speak, 500, 900, { gain: .15 });
  at.shakes.forEach((t, i) => {
    const last = i === at.shakes.length - 1, seconds = last ? .32 : .16, f = hz(i % 2 ? 'C5' : 'E5');
    kazoo(mix, t - .05, seconds, (u) => f * (last ? 1 - .2 * Math.min(1, u / seconds) : 1 - .03 * u / seconds), { gain: .3 });
  });

  // 7. He fades away, the phone is back on its home screen, and the tune comes back, sunny.
  plip(mix, at.fade, 900, 420, { gain: .12 });
  const b = (at.card - at.done) / 4;   // one bar from here to the closing card
  tuba(mix, at.done, hz('C2'), b * .8);
  tuba(mix, at.done + 2 * b, hz('G1'), b * .8);
  strum(mix, at.done + b, ['E4', 'G4', 'C5'], { gain: .08, ring: .3 });
  strum(mix, at.done + 3 * b, ['D4', 'G4', 'B4'], { gain: .08, ring: .3 });
  for (const [w, note] of [[0, 'C5'], [.5, 'E5'], [1, 'G5'], [1.5, 'E5'], [2, 'A5'], [2.5, 'G5'], [3, 'E5'], [3.5, 'D5']]) {
    marimba(mix, at.done + w * b, hz(note), { gain: .16, pan: .15 });
    bell(mix, at.done + w * b, hz(note, 12), { gain: .02, pan: .3 });
  }
  for (let e = 0; e < 8; e++) shaker(mix, at.done + e * b / 2, { gain: e % 2 ? .03 : .018 });

  // 8. The closing card: ta-da! "Nope not now" gets one more nuh-uh, a little run down,
  //    and a last chord to finish.
  strum(mix, at.card, ['C4', 'E4', 'G4', 'C5', 'E5'], { gain: .12, ring: 1.4 });
  tuba(mix, at.card, hz('C2'), 1.1);
  ['C6', 'E6', 'G6'].forEach((note, i) => bell(mix, at.card + i * .02, hz(note), { gain: .045 }));
  bell(mix, at.card, 2700, { gain: .025, ring: 1.6 });
  crash(mix, at.card);
  const said = at.card + .72;   // when "Nope not now" rises onto the card
  kazoo(mix, said, .15, () => hz('E5'), { gain: .22 });
  kazoo(mix, said + .17, .22, (u) => hz('C5') * (1 - .06 * u / .22), { gain: .22 });
  [['G5', 1.35], ['E5', 1.59], ['C5', 1.83]].forEach(([note, w]) => marimba(mix, at.card + w, hz(note), { gain: .15, pan: .15 }));
  strum(mix, at.card + 2.2, ['C4', 'G4', 'C5', 'E5'], { gain: .1, ring: 1.2 });
  tuba(mix, at.card + 2.2, hz('C2'), .5);
  bell(mix, at.card + 2.2, hz('C6'), { gain: .04 });

  room(mix);
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
