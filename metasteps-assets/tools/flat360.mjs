import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const [img, outName, mode = 'dome', fov = '104'] = process.argv.slice(2);
const ROOT = new URL('.', import.meta.url).pathname;
const server = spawn('python3', ['-m', 'http.server', '8755', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1000));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('[err]', e.message.slice(0, 150)));
  await page.goto(`http://127.0.0.1:8755/flat360.html?img=${encodeURIComponent(img)}&mode=${mode}&fov=${fov}`);
  await page.waitForFunction(() => ['done', 'error'].includes(window.__status?.stage), null, { timeout: 120000 });
  const s = await page.evaluate(() => { const { url, ...r } = window.__status; return r; });
  console.log(JSON.stringify(s));
  if (s.stage !== 'done') process.exit(1);
  const url = await page.evaluate(() => window.__status.url);
  writeFileSync(ROOT + outName, Buffer.from(url.split(',')[1], 'base64'));
  console.log('saved', outName);
} finally { await browser.close(); server.kill(); }
