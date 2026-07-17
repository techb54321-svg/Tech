/* ============================================================
   Zone 3 — Pancreas / blood sugar
   Symbolic visuals: glucose particles drift in calm, orderly
   lanes when severity is low; with higher severity there are
   more of them and they jitter chaotically. Teal insulin helpers
   circulate when the system is balanced.
   ============================================================ */
window.FB = window.FB || {};
FB.scenes = FB.scenes || {};

FB.scenes.pancreas = (function () {
  const ORIGIN = new THREE.Vector3(600, 0, 0);
  let pancreas, glucose = [], insulin = [];

  function build(scene) {
    const group = new THREE.Group();
    group.position.copy(ORIGIN);

    // stylised pancreas — an elongated soft form below the particle field
    pancreas = new THREE.Mesh(
      new THREE.SphereGeometry(8, 28, 20),
      new THREE.MeshLambertMaterial({ color: '#b0708a' })
    );
    pancreas.scale.set(2.0, 0.65, 0.8);
    // sit left of centre so the narration card doesn't cover the organ
    pancreas.position.set(-11, -5, 0);
    group.add(pancreas);

    // glucose particles — small amber octahedra
    const gGeo = new THREE.OctahedronGeometry(0.55);
    const gMat = new THREE.MeshLambertMaterial({ color: '#f0a35e' });
    for (let i = 0; i < 64; i++) {
      const g = new THREE.Mesh(gGeo, gMat);
      g.userData = {
        lane: -6 + (i % 8) * 1.7,                 // orderly "lanes" when calm
        z: -4 + Math.random() * 8,
        x: -30 + Math.random() * 60,
        speed: 4 + Math.random() * 3,
        seed: Math.random() * 100,
        order: i / 64,                            // particle appears once sev passes this * 0.8
      };
      g.scale.setScalar(0.001);
      group.add(g);
      glucose.push(g);
    }

    // insulin helpers — calm teal spheres, present when the system is balanced
    const iGeo = new THREE.SphereGeometry(0.5, 10, 8);
    const iMat = new THREE.MeshBasicMaterial({ color: '#4fd1c5' });
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Mesh(iGeo, iMat);
      s.userData = {
        r: 6 + Math.random() * 5,
        a: (i / 12) * Math.PI * 2,
        w: 0.6 + Math.random() * 0.4,
        order: i / 12,                            // helper disappears as sev rises past this
      };
      s.scale.setScalar(0.001);
      group.add(s);
      insulin.push(s);
    }

    scene.add(group);
  }

  function tick(t, dt, sev) {
    // pancreas gently pulses
    const pulse = 1 + Math.sin(t * 1.6) * 0.02;
    pancreas.scale.set(2.0 * pulse, 0.65 * pulse, 0.8 * pulse);

    // glucose: baseline third always visible; the rest appear with severity
    for (const g of glucose) {
      const u = g.userData;
      const visible = u.order < 0.35 || sev > (u.order - 0.35) / 0.65;
      const target = visible ? 1 : 0.001;
      g.scale.setScalar(g.scale.x + (target - g.scale.x) * Math.min(1, dt * 3));

      // drift along x; chaos (jitter) scales with severity
      u.x += u.speed * (1 - sev * 0.4) * dt;
      if (u.x > 32) u.x = -32;
      const chaos = sev * 2.6;
      g.position.set(
        u.x + Math.sin(t * 6 + u.seed) * chaos,
        u.lane + 4 + Math.sin(t * 5 + u.seed * 2) * chaos,
        u.z + Math.cos(t * 4 + u.seed) * chaos * 0.6
      );
      g.rotation.y += dt * (0.5 + sev * 3);
    }

    // insulin helpers orbit above the pancreas; fewer remain as severity rises
    for (const s of insulin) {
      const u = s.userData;
      const target = (1 - sev) > u.order ? 1 : 0.001;
      s.scale.setScalar(s.scale.x + (target - s.scale.x) * Math.min(1, dt * 3));
      u.a += u.w * dt;
      s.position.set(-11 + Math.cos(u.a) * u.r, -1 + Math.sin(u.a * 1.3) * 2, Math.sin(u.a) * u.r);
    }
  }

  return {
    build,
    tick,
    anchor: {
      pos:  new THREE.Vector3(600, 3, 32),
      look: new THREE.Vector3(600, 0, 0),
    },
  };
})();
