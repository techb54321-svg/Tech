// Captures a 360 equirectangular still from inside blood-vessel-simulation.html.
//
//   node capture-vessel-360.mjs <scenario> <outName> [tOffset] [radialFrac] [angleOffsetDeg]
//
// scenario: healthy | infection | clot | plaque
// The camera is placed on the vessel path at the scenario's feature location
// (offset upstream by tOffset) and pushed radialFrac*R away from the feature so
// it stands in the open lumen looking at it.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('.', import.meta.url).pathname;
const [scenario = 'plaque', outName = 'vessel-360', tOff = '0.045', radial = '0.3', angOff = '0'] = process.argv.slice(2);

// r128 defines render as an instance method, so wrap the constructor.
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

const server = spawn('python3', ['-m', 'http.server', '8747', '--bind', '127.0.0.1'], { cwd: '/home/user/Tech', stdio: 'ignore' });
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
  await page.goto('http://127.0.0.1:8747/blood-vessel-simulation.html');
  await page.waitForFunction(() => !!window.__cap, null, { timeout: 30000 });

  const skip = page.locator('button', { hasText: 'Skip intro' });
  if (await skip.count()) await skip.first().click();
  await new Promise(r => setTimeout(r, 1000));
  await page.click('#scn-' + scenario);
  console.log('scenario set:', scenario, '- letting the scene settle');
  await new Promise(r => setTimeout(r, 12000));
  await page.screenshot({ path: `${ROOT}${outName}-context.png` });

  const result = await page.evaluate(([scn, tOffset, radialFrac, angleOffsetDeg]) => {
    const { renderer, scene, camera } = window.__cap;

    // Feature location for the scenario (globals declared in the sim).
    const featT = scn === 'plaque' ? PLAQUE_T : scn === 'clot' ? WOUND_T
      : scn === 'infection' ? INFECT_T : 0.25;
    const featA = scn === 'plaque' ? PLAQUE_A : scn === 'clot' ? WOUND_A : 0;

    frameAt(featT - tOffset);
    const p = _p.clone(), tan = _t.clone(), nor = _n.clone(), bin = _b.clone();
    // Direction of the wall feature; step the opposite way into the open lumen.
    const ang = featA + THREE.MathUtils.degToRad(angleOffsetDeg);
    const fdir = nor.clone().multiplyScalar(Math.cos(ang)).addScaledVector(bin, Math.sin(ang)).normalize();
    const pos = p.clone().addScaledVector(fdir, -R * radialFrac);

    // Viewer basis: look downstream along the vessel with the wall feature
    // underfoot, so the tube runs horizontally instead of tipping overhead.
    const F = tan.clone().normalize();                      // forward = downstream
    const U = fdir.clone().negate().normalize();            // feature sits below
    const Rt = new THREE.Vector3().crossVectors(F, U).normalize();

    const SIZE = 1536, W = 4096, H = 2048;
    const rt = new THREE.WebGLRenderTarget(SIZE, SIZE, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
    rt.texture.encoding = renderer.outputEncoding;
    const cam = new THREE.PerspectiveCamera(90, 1, 0.05, camera.far);
    cam.position.copy(pos);

    // Face the plaque/feature on capture-forward (-Z of the equirect = lon 0).
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
      const sy = Math.sin(lat), rxz = Math.cos(lat);
      for (let i = 0; i < W; i++) {
        const lon = ((i + 0.5) / W) * 2 * Math.PI - Math.PI;
        // dir = cos(lat)(sin(lon)·right + cos(lon)·forward) + sin(lat)·up
        const cl = rxz * Math.cos(lon), sl = rxz * Math.sin(lon);
        const dx = sl * Rt.x + cl * F.x + sy * U.x;
        const dy = sl * Rt.y + cl * F.y + sy * U.y;
        const dz = sl * Rt.z + cl * F.z + sy * U.z;
        let best = 0, bd = -2;
        for (let k = 0; k < 6; k++) {
          const f = data[k].fwd;
          const d = dx * f[0] + dy * f[1] + dz * f[2];
          if (d > bd) { bd = d; best = k; }
        }
        const { right, upv, px } = data[best];
        const uu = (dx * right[0] + dy * right[1] + dz * right[2]) / bd;
        const vv = (dx * upv[0] + dy * upv[1] + dz * upv[2]) / bd;
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
  }, [scenario, parseFloat(tOff), parseFloat(radial), parseFloat(angOff)]);

  console.log('capture position:', result.pos);
  writeFileSync(ROOT + outName + '.png', Buffer.from(result.url.split(',')[1], 'base64'));
  console.log('saved', outName + '.png');
} finally {
  await browser.close();
  server.kill();
}
