/* ============================================================
   Zone 2 — Liver / fat metabolism
   Symbolic visuals: severity shifts the liver from a warm healthy
   tone toward a pale fatty tone and grows fat droplets on the
   surface. Energy sparks flow faster when habits are healthier.
   ============================================================ */
window.FB = window.FB || {};
FB.scenes = FB.scenes || {};

FB.scenes.liver = (function () {
  const ORIGIN = new THREE.Vector3(300, 0, 0);
  let liver, droplets = [], sparks = [];

  const cHealthy = new THREE.Color('#8e4a3a');
  const cFatty   = new THREE.Color('#c9a45a');
  const tmp      = new THREE.Color();

  function build(scene) {
    const group = new THREE.Group();
    group.position.copy(ORIGIN);

    // stylised liver — a smooth rounded wedge (placeholder anatomy)
    liver = new THREE.Mesh(
      new THREE.SphereGeometry(12, 32, 24),
      new THREE.MeshLambertMaterial({ color: cHealthy.clone() })
    );
    liver.scale.set(1.5, 0.85, 1.0);
    group.add(liver);

    // fat droplets sitting on the surface — appear one by one with severity
    for (let i = 0; i < 36; i++) {
      const d = new THREE.Mesh(
        new THREE.SphereGeometry(0.9 + Math.random() * 0.9, 10, 8),
        new THREE.MeshLambertMaterial({ color: '#ecd57e' })
      );
      // random point on the (scaled) liver surface
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(2 * Math.random() - 1);
      d.position.set(
        Math.sin(v) * Math.cos(u) * 12 * 1.5,
        Math.cos(v) * 12 * 0.85,
        Math.sin(v) * Math.sin(u) * 12 * 1.0
      );
      d.scale.setScalar(0.001);
      d.userData.order = i / 36;           // droplet i appears once sev passes this
      group.add(d);
      droplets.push(d);
    }

    // energy sparks — nutrients flowing to and from the liver
    const sparkGeo = new THREE.SphereGeometry(0.35, 8, 6);
    const sparkMat = new THREE.MeshBasicMaterial({ color: '#7abfff' });
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Mesh(sparkGeo, sparkMat);
      s.userData = {
        r: 16 + Math.random() * 8,
        a: Math.random() * Math.PI * 2,
        y: -6 + Math.random() * 12,
        w: 0.4 + Math.random() * 0.5,
      };
      group.add(s);
      sparks.push(s);
    }

    scene.add(group);
  }

  function tick(t, dt, sev) {
    // colour shift toward fatty tone
    tmp.copy(cHealthy).lerp(cFatty, sev);
    liver.material.color.copy(tmp);

    // gentle "breathing" so the organ feels alive
    const breathe = 1 + Math.sin(t * 1.4) * 0.015;
    liver.scale.set(1.5 * breathe, 0.85 * breathe, 1.0 * breathe);

    // droplets fade in as severity crosses each one's threshold
    for (const d of droplets) {
      const target = sev > d.userData.order ? 1 : 0.001;
      d.scale.setScalar(d.scale.x + (target - d.scale.x) * Math.min(1, dt * 3));
    }

    // sparks orbit faster when the system is healthier
    const w = 1.2 - sev * 0.85;
    for (const s of sparks) {
      s.userData.a += s.userData.w * w * dt;
      s.position.set(
        Math.cos(s.userData.a) * s.userData.r,
        s.userData.y + Math.sin(t + s.userData.r) * 0.8,
        Math.sin(s.userData.a) * s.userData.r
      );
    }
  }

  return {
    build,
    tick,
    anchor: {
      pos:  new THREE.Vector3(300, 3, 38),
      look: new THREE.Vector3(300, 0, 0),
    },
  };
})();
