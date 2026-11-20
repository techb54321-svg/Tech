// Makes mr-blocky-demo.mp4: a short video of Mr Blocky closing Instagram on a phone,
// with music.
//
//   node make-demo.js                 makes the whole video
//   node make-demo.js --music-only    keeps the picture and redoes just the music
//
// It serves this folder to a browser with no window, steps through the story one
// frame at a time, photographs each frame, and hands the pictures to ffmpeg. While
// it does, it notes when each of his moves happens (every footstep, the boop, each
// shake of his head) in timeline.json, and make-music.js times the music to those.
// Because he is drawn by the real guy.js, the video and its music follow any change
// to how he looks or moves: run this again after changing him.
//
// Needs Node with Playwright, and ffmpeg.
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { chromium } = require('playwright');
const { makeMusic } = require('./make-music');

const FPS = 30;
const OUT = path.join(__dirname, 'mr-blocky-demo.mp4');
const TIMELINE = path.join(__dirname, 'timeline.json');
const PICTURE = path.join(os.tmpdir(), `mr-blocky-picture-${process.pid}.mp4`);
const MUSIC = path.join(os.tmpdir(), `mr-blocky-music-${process.pid}.wav`);
// The pages use files from elsewhere in the project, such as guy.js, so serve the whole project.
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.woff2': 'font/woff2' };

// Browsers will not load a font straight from a file on disk, so the pages are served from here.
function serve() {
  const server = http.createServer((request, response) => {
    const file = path.join(ROOT, path.normalize(decodeURIComponent(new URL(request.url, 'http://localhost').pathname)));
    if (!file.startsWith(ROOT + path.sep)) return response.writeHead(403).end();
    fs.readFile(file, (error, data) => {
      if (error) return response.writeHead(404).end();
      response.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function ffmpeg(args) {
  const run = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (run.status !== 0) throw new Error('ffmpeg failed: ffmpeg ' + args.join(' '));
}

// Times of the highest points in a run of [time, value] readings, each pinned down
// between frames by fitting a curve through it and its neighbours.
function peaksOf(readings, above) {
  const peaks = [];
  for (let i = 1; i < readings.length - 1; i++) {
    const [[t0, a], [t, b], [, c]] = [readings[i - 1], readings[i], readings[i + 1]];
    if (b > above && b > a && b >= c) {
      const bend = a - 2 * b + c;
      peaks.push(t + (bend ? (a - c) / (2 * bend) : 0) * (t - t0));
    }
  }
  return peaks;
}

// When each moment happens, in seconds, worked out from what the phone page saw him
// do at each frame.
function timelineOf(seen, story, cues, timing, frames) {
  const first = (test, what) => {
    const frame = seen.find(test);
    if (!frame) throw new Error(`Could not tell from the video when ${what}`);
    return frame.t;
  };
  const walk = first((f) => f.shown, 'he set off');
  const furthest = Math.max(...seen.map((f) => f.x ?? -Infinity));
  const arrive = first((f) => f.x === furthest, 'he reached the button');

  // A foot lands each time his body squashes widest. They come at a steady pace, so a
  // straight line through them smooths out the unevenness of reading them off frames.
  const landed = peaksOf(seen.filter((f) => f.t >= walk && f.t <= arrive).map((f) => [f.t, f.wide]), 1.02);
  if (landed.length < 4) throw new Error('Could not make out his footsteps in the video');
  const gaps = landed.slice(1).map((t, i) => t - landed[i]).sort((a, b) => a - b);
  const typical = gaps[Math.floor(gaps.length / 2)];
  const counted = landed.map((t) => [Math.round((t - landed[0]) / typical), t]);
  const n = counted.length;
  const meanN = counted.reduce((s, [k]) => s + k, 0) / n, meanT = counted.reduce((s, [, t]) => s + t, 0) / n;
  const pace = counted.reduce((s, [k, t]) => s + (k - meanN) * (t - meanT), 0) / counted.reduce((s, [k]) => s + (k - meanN) ** 2, 0);
  const start = meanT - pace * meanN;
  const steps = [];
  for (let k = 0; start + k * pace <= arrive + 1e-6; k++) steps.push(start + k * pace);

  // His head turns furthest each way as he shakes it.
  const facing = seen.filter((f) => f.front && f.shake !== null);
  const shakes = [...peaksOf(facing.map((f) => [f.t, f.shake]), 1.5), ...peaksOf(facing.map((f) => [f.t, -f.shake]), 1.5)]
    .sort((a, b) => a - b);
  if (shakes.length < 2) throw new Error('Could not make out him shaking his head in the video');

  const ms = {
    title: timing.titleMs, tap: cues.tap, open: cues.open, flicks: cues.flicks,
    walk, steps, arrive,
    boop: first((f) => f.button.includes('translateX'), 'his nose hit the button'),
    lightsOut: first((f) => f.veil > 0, 'the screen started to go dark'),
    dark: story.darkAt,
    turn: first((f) => f.front, 'he turned round'),
    speak: first((f) => f.bubble > 0, 'he said "Nope not now"'),
    shakes,
    fade: first((f) => f.fade < 1, 'he started to fade away'),
    done: story.doneAt,
    card: story.doneAt + timing.afterMs,
  };
  const seconds = (v) => (Array.isArray(v) ? v.map(seconds) : Math.round(v) / 1000);
  const timeline = { length: frames / FPS };
  for (const [name, value] of Object.entries(ms)) timeline[name] = seconds(value);
  return timeline;
}

async function makePicture() {
  const server = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const problems = [];
  page.on('pageerror', (error) => problems.push(String(error)));
  page.on('requestfailed', (request) => problems.push('could not load ' + request.url()));
  await page.goto(`http://127.0.0.1:${server.address().port}/mr-blocky-demo/demo.html`);
  const phone = page.frames().find((frame) => frame.url().endsWith('phone.html'));
  await phone.waitForFunction(() => typeof window.tick === 'function');
  await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
  const fontReady = await phone.evaluate(async () => {
    await document.fonts.load('32px "Grand Hotel"');
    await document.fonts.ready;
    return document.fonts.check('32px "Grand Hotel"');
  });
  if (!fontReady) throw new Error('The Instagram-style lettering font did not load');

  const encoder = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', PICTURE],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const encoded = new Promise((resolve, reject) => encoder.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg failed')))));

  let frames = 0, story;
  for (;; frames++) {
    const t = (frames * 1000) / FPS;
    story = await phone.evaluate((ms) => window.tick(ms), t);
    const finished = await page.evaluate(([ms, s]) => window.render(ms, s), [t, story]);
    const picture = await page.screenshot({ type: 'png' });
    if (!encoder.stdin.write(picture)) await new Promise((resolve) => encoder.stdin.once('drain', resolve));
    if (frames % 60 === 0) console.log(`${(t / 1000).toFixed(0)} s: ${story.phase}`);
    if (finished) break;
    if (t > 60000) throw new Error('The story did not finish within a minute: ' + JSON.stringify(story));
  }
  encoder.stdin.end();
  await encoded;
  const [seen, cues] = await phone.evaluate(() => [window.seen, window.cues]);
  const timing = await page.evaluate(() => window.timing);
  await browser.close();
  server.close();
  if (problems.length) throw new Error('The page reported: ' + problems.join('; '));
  frames += 1;
  console.log(`Recorded ${frames} frames, ${(frames / FPS).toFixed(1)} seconds`);
  return timelineOf(seen, story, cues, timing, frames);
}

(async () => {
  let timeline;
  if (process.argv.includes('--music-only')) {
    timeline = JSON.parse(fs.readFileSync(TIMELINE, 'utf8'));
    ffmpeg(['-i', OUT, '-map', '0:v', '-c', 'copy', PICTURE]);
  } else {
    timeline = await makePicture();
    fs.writeFileSync(TIMELINE, JSON.stringify(timeline, null, 2) + '\n');
  }
  makeMusic(timeline, MUSIC);
  ffmpeg(['-i', PICTURE, '-i', MUSIC, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-shortest', '-movflags', '+faststart', OUT]);
  fs.rmSync(PICTURE, { force: true });
  fs.rmSync(MUSIC, { force: true });
  console.log(`Wrote ${OUT}`);
})().catch((error) => {
  fs.rmSync(PICTURE, { force: true });
  fs.rmSync(MUSIC, { force: true });
  console.error(error);
  process.exit(1);
});
