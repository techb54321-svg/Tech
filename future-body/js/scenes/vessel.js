/* ============================================================
   Zone 1 — Blood vessel / circulation
   Symbolic visuals: severity narrows the vessel with soft wall
   deposits, dulls the wall colour and slows the blood flow.
   ============================================================ */
window.FB = window.FB || {};
FB.scenes = FB.scenes || {};

FB.scenes.vessel = (function () {
  const ORIGIN = new THREE.Vector3(0, 0, 0);
  let wall, plaques = [], cells = [];

  // colour helpers (re-used, no per-frame allocation)
  const cHealthy = new THREE.Color('#a83a52');
  const cRisk    = new THREE.Color('#5e2433');
  const tmp      = new THREE.Color();

  function build(scene) {
    const group = new THREE.Group();
    group.position.copy(ORIGIN);

    // vessel wall — an open tube we sit inside (BackSide = seen from within)
    const wallGeo = new THREE.CylinderGeometry(9, 9, 160, 40, 24, true);
    wallGeo.rotateX(Math.PI / 2);
    wall = new THREE.Mesh(
      wallGeo,
      new THREE.MeshLambertMaterial({ color: cHealthy.clone(), side: THREE.BackSide })
    );
    group.add(wall);

    // soft plaque deposits on the inner wall — grow with severity
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const z = -70 + Math.random() * 140;
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(2.6 + Math.random() * 1.6, 12, 10),
        new THREE.MeshLambertMaterial({ color: '#d9b36a' })
      );
      p.position.set(Math.cos(a) * 8.6, Math.sin(a) * 8.6, z);
      p.scale.setScalar(0.001);
      p.userData.max = 0.7 + Math.random() * 0.7;
      group.add(p);
      plaques.push(p);
    }

    // red blood cells — flattened spheres drifting along the vessel
    const cellGeo = new THREE.SphereGeometry(0.85, 12, 10);
    const cellMat = new THREE.MeshLambertMaterial({ color: '#c0392b' });
    for (let i = 0; i < 60; i++) {
      const c = new THREE.Mesh(cellGeo, cellMat);
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 6;
      c.position.set(Math.cos(a) * r, Math.sin(a) * r, -80 + Math.random() * 160);
      c.scale.set(1, 1, 0.45);
      c.userData = { speed: 0.7 + Math.random() * 0.6, spin: Math.random() * 2 - 1 };
      group.add(c);
      cells.push(c);
    }

    scene.add(group);
  }

  function tick(t, dt, sev) {
    // wall colour dulls with risk
    tmp.copy(cHealthy).lerp(cRisk, sev);
    wall.material.color.copy(tmp);

    // plaque grows/shrinks smoothly with severity
    for (const p of plaques) {
      const target = Math.max(0.001, sev * p.userData.max);
      p.scale.setScalar(p.scale.x + (target - p.scale.x) * Math.min(1, dt * 3));
    }

    // blood flow slows as the road narrows
    const speed = 16 - sev * 11;
    for (const c of cells) {
      c.position.z += speed * c.userData.speed * dt;
      c.rotation.x += c.userData.spin * dt;
      if (c.position.z > 80) c.position.z = -80;
    }
  }

  return {
    build,
    tick,
    anchor: {
      pos:  new THREE.Vector3(0, 0, 30),
      look: new THREE.Vector3(0, 0, -60),
    },
  };
})();
