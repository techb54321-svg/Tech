// Usage: node build-photodome.mjs <image-file> <output-name> [yawDeg]
//
// Turns a 2:1 equirectangular 360 image into <output-name>.glb — a "photodome":
// an inside-out textured sphere (you stand at the center and the image surrounds
// you) plus a small soft-edged standing platform. The GLB can be uploaded to
// Metasteps (studio.metasteps.com) or any engine that imports glTF binary.
// Also writes <output-name>-view-*.png preview renders from inside the dome.
//
// Requires: node 18+, `npm i playwright-core`, a Chromium binary (set
// CHROMIUM_PATH if it isn't at /opt/pw-browsers/chromium), python3 (static server).
// yawDeg rotates the panorama so its best content faces the viewer's forward
// direction (-90 put the throat forward for the mouth panoramas).
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { writeFileSync, copyFileSync, rmSync } from 'node:fs';

const [img, name, yaw = '0'] = process.argv.slice(2);
if (!img || !name) { console.error('usage: node build-photodome.mjs <image> <name> [yawDeg]'); process.exit(1); }

const ROOT = new URL('.', import.meta.url).pathname;
// Serve only the tools dir; bring the input image inside it under a temp name.
const ext = (img.match(/\.(png|jpe?g|webp)$/i) || ['', 'jpg'])[1];
const tmpImg = `__input__.${ext}`;
copyFileSync(img, ROOT + tmpImg);

const server = spawn('python3', ['-m', 'http.server', '8743', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1000));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:8743/photodome-builder.html?img=${encodeURIComponent(tmpImg)}&name=${encodeURIComponent(name)}&yaw=${encodeURIComponent(yaw)}`);
  await page.waitForFunction(() => ['done', 'error'].includes(window.__status?.stage), null, { timeout: 90000 });
  const s = await page.evaluate(() => { const { glbB64, ...r } = window.__status; return r; });
  console.log(JSON.stringify(s));
  if (s.stage !== 'done') process.exit(1);

  const b64 = await page.evaluate(() => window.__status.glbB64);
  writeFileSync(ROOT + name + '.glb', Buffer.from(b64, 'base64'));

  const views = [[0, 0, 'front'], [90, 0, 'left'], [180, 0, 'back'], [270, 0, 'right'], [0, -35, 'floor']];
  for (const [y, p, label] of views) {
    await page.evaluate(([yy, pp]) => window.__renderView(yy, pp), [y, p]);
    await page.screenshot({ path: `${ROOT}${name}-view-${label}.png` });
  }
  console.log(`saved ${name}.glb + ${views.length} preview renders`);
} finally {
  await browser.close();
  server.kill();
  rmSync(ROOT + tmpImg, { force: true });
}
