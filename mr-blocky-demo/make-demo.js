// Makes mr-blocky-demo.mp4: a short video of Mr Blocky closing a made-up social app.
//
//   node make-demo.js
//
// It opens demo.html in a browser with no window, steps through the story one
// frame at a time, photographs each frame, and hands the pictures to ffmpeg.
// Because he is drawn by the real guy.js, the video follows any change to how
// he looks or moves: run this again after changing him.
//
// Needs Node with Playwright, and ffmpeg.
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const FPS = 30;
const OUT = path.join(__dirname, 'mr-blocky-demo.mp4');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const problems = [];
  page.on('pageerror', (error) => problems.push(String(error)));
  await page.goto('file://' + path.join(__dirname, 'demo.html'));
  const phone = page.frames().find((frame) => frame.url().endsWith('phone.html'));
  await phone.waitForFunction(() => typeof window.tick === 'function');
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));

  const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const encoded = new Promise((resolve, reject) => ffmpeg.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg failed')))));

  let frames = 0;
  for (;; frames++) {
    const t = (frames * 1000) / FPS;
    const story = await phone.evaluate((ms) => window.tick(ms), t);
    const finished = await page.evaluate(([ms, s]) => window.render(ms, s), [t, story]);
    const picture = await page.screenshot({ type: 'png' });
    if (!ffmpeg.stdin.write(picture)) await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
    if (frames % 60 === 0) console.log(`${(t / 1000).toFixed(0)} s: ${story.phase}`);
    if (finished) break;
    if (t > 60000) throw new Error('The story did not finish within a minute: ' + JSON.stringify(story));
  }
  ffmpeg.stdin.end();
  await encoded;
  await browser.close();
  if (problems.length) throw new Error('The page reported: ' + problems.join('; '));
  console.log(`Wrote ${OUT}: ${frames + 1} frames, ${((frames + 1) / FPS).toFixed(1)} seconds`);
})().catch((error) => { console.error(error); process.exit(1); });
