// Captures a 360 equirectangular panorama from inside the running
// blood-vessel simulation. Usage: node vessel-360.mjs [rideWaitMs]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('.', import.meta.url).pathname;
const rideWait = parseInt(process.argv[2] || '6000', 10);

// r128 WebGLRenderer defines render as an instance method, so wrap the ctor.
const HOOK = `
;(function(){
  const Orig = THREE.WebGLRenderer;
  function Wrapped(...args) {
    const r = new Orig(...args);
    const orig = r.render.bind(r);
    r.render = function (s, c) {
      if (s && s.isScene && c && c.isPerspectiveCamera) window.__cap = { renderer: r, scene: s, camera: c };
      return orig(s, c);
    };
    return r;
  }
  Wrapped.prototype = Orig.prototype;
  Object.assign(Wrapped, Orig);
  THREE.WebGLRenderer = Wrapped;
})();`;
const threeSrc = readFileSync(ROOT + 'r128/package/build/three.min.js', 'utf8') + HOOK;
const VRBUTTON_STUB = `var VRButton = { createButton: function () {
  var b = document.createElement('button'); b.style.display = 'none'; return b; } };`;

const server = spawn('python3', ['-m', 'http.server', '8746', '--bind', '127.0.0.1'], { cwd: '/home/user/Tech', stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1000));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 160)));
  await page.route('**cdnjs.cloudflare.com/**', r =>
    r.request().url().includes('three.min.js')
      ? r.fulfill({ contentType: 'application/javascript', body: threeSrc })
      : r.abort());
  await page.route('**cdn.jsdelivr.net/**', r => {
    const u = r.request().url();
    if (u.includes('webxr/VRButton.js'))
      return r.fulfill({ contentType: 'application/javascript', body: VRBUTTON_STUB });
    const m = u.match(/examples\/js\/(.+\.js)/);
    if (m) {
      try {
        return r.fulfill({ contentType: 'application/javascript',
          body: readFileSync(ROOT + 'r128/package/examples/js/' + m[1], 'utf8') });
      } catch { /* fall through */ }
    }
    r.abort();
  });
  await page.goto('http://127.0.0.1:8746/blood-vessel-simulation.html');
  await page.waitForFunction(() => !!window.__cap, null, { timeout: 30000 });
  console.log('render hook captured scene');

  // End the intro, then get onto the bloodstream ride (camera on vessel axis).
  const skip = page.locator('button', { hasText: 'Skip intro' });
  if (await skip.count()) await skip.first().click();
  await new Promise(r => setTimeout(r, 1200));
  const ride = page.locator('button', { hasText: 'Ride the bloodstream' });
  if (await ride.count()) await ride.first().click();
  await new Promise(r => setTimeout(r, rideWait));
  await page.screenshot({ path: ROOT + 'vessel-ride-view.png' });

  const result = await page.evaluate(() => {
    const { renderer, scene, camera } = window.__cap;
    const SIZE = 1536, W = 4096, H = 2048;
    const pos = camera.getWorldPosition(new THREE.Vector3());
    const rt = new THREE.WebGLRenderTarget(SIZE, SIZE, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
    rt.texture.encoding = renderer.outputEncoding;
    const cam = new THREE.PerspectiveCamera(90, 1, camera.near, camera.far);
    cam.position.copy(pos);

    const faces = [
      { f: [1, 0, 0], u: [0, 1, 0] }, { f: [-1, 0, 0], u: [0, 1, 0] },
      { f: [0, 1, 0], u: [0, 0, 1] }, { f: [0, -1, 0], u: [0, 0, -1] },
      { f: [0, 0, 1], u: [0, 1, 0] }, { f: [0, 0, -1], u: [0, 1, 0] },
    ];
    const V = a => new THREE.Vector3(...a);
    const data = faces.map(({ f, u }) => {
      const fwd = V(f), upHint = V(u);
      const right = new THREE.Vector3().crossVectors(fwd, upHint).normalize();
      const upv = new THREE.Vector3().crossVectors(right, fwd).normalize();
      cam.up.copy(upv);
      cam.lookAt(pos.clone().add(fwd));
      cam.updateMatrixWorld(true);
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      const px = new Uint8Array(SIZE * SIZE * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, SIZE, SIZE, px);
      return { fwd: fwd.toArray(), right: right.toArray(), upv: upv.toArray(), px };
    });
    renderer.setRenderTarget(null);

    const out = new Uint8ClampedArray(W * H * 4);
    for (let j = 0; j < H; j++) {
      const lat = Math.PI / 2 - ((j + 0.5) / H) * Math.PI;
      const y = Math.sin(lat), rxz = Math.cos(lat);
      for (let i = 0; i < W; i++) {
        const lon = ((i + 0.5) / W) * 2 * Math.PI - Math.PI;
        const dx = rxz * Math.sin(lon), dy = y, dz = -rxz * Math.cos(lon);
        let best = 0, bd = -2;
        for (let k = 0; k < 6; k++) {
          const f = data[k].fwd;
          const d = dx * f[0] + dy * f[1] + dz * f[2];
          if (d > bd) { bd = d; best = k; }
        }
        const { fwd, right, upv, px } = data[best];
        const d = bd;
        const uu = (dx * right[0] + dy * right[1] + dz * right[2]) / d;
        const vv = (dx * upv[0] + dy * upv[1] + dz * upv[2]) / d;
        const fx = Math.min(SIZE - 1, Math.max(0, Math.round((uu + 1) / 2 * (SIZE - 1))));
        const fy = Math.min(SIZE - 1, Math.max(0, Math.round((vv + 1) / 2 * (SIZE - 1))));
        const si = (fy * SIZE + fx) * 4, oi = (j * W + i) * 4;
        out[oi] = px[si]; out[oi + 1] = px[si + 1]; out[oi + 2] = px[si + 2]; out[oi + 3] = 255;
      }
    }
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    c.getContext('2d').putImageData(new ImageData(out, W, H), 0, 0);
    return { url: c.toDataURL('image/png'), pos: pos.toArray().map(v => +v.toFixed(1)) };
  });
  console.log('capture position:', result.pos);
  writeFileSync(ROOT + 'vessel-360.png', Buffer.from(result.url.split(',')[1], 'base64'));
  console.log('saved vessel-360.png');
} finally {
  await browser.close();
  server.kill();
}
