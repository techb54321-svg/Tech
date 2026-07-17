/* ============================================================
   Inside My Future Body — 3D engine & app glue
   Sets up Three.js, builds the three body zones, moves the
   camera rig between them with a fade, and runs the render loop.
   WebXR is optional: desktop is the default, "Enter VR" appears
   only when a headset is actually available.
   ============================================================ */
window.FB = window.FB || {};

(function () {
  if (typeof THREE === 'undefined') return;   // CDN failed — error panel is shown

  /* ---------- renderer / scene / camera rig ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.getElementById('canvas-holder').append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b1220');
  scene.fog = new THREE.Fog('#0b1220', 30, 110);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 400);
  const rig = new THREE.Group();              // moved between zones; camera rides inside
  rig.add(camera);
  scene.add(rig);

  // gentle lighting that travels with the viewer
  scene.add(new THREE.AmbientLight('#8fa8c8', 0.55));
  const lamp = new THREE.PointLight('#ffffff', 0.9, 140);
  rig.add(lamp);

  /* ---------- build zones ---------- */
  const zones = { vessel: FB.scenes.vessel, liver: FB.scenes.liver, pancreas: FB.scenes.pancreas };
  for (const z of Object.values(zones)) z.build(scene);

  /* ---------- camera rig placement & transitions ---------- */
  const fadeEl = document.getElementById('fade');
  const _m = new THREE.Matrix4();
  const UP = new THREE.Vector3(0, 1, 0);
  let currentZone = 'vessel';
  let transitioning = false;

  function placeRig(zone) {
    const a = zones[zone].anchor;
    rig.position.copy(a.pos);
    _m.lookAt(a.pos, a.look, UP);             // camera convention: -z faces target
    rig.quaternion.setFromRotationMatrix(_m);
  }

  function goToZone(zone, instant = false) {
    if (!zones[zone]) return;
    currentZone = zone;
    if (instant) { placeRig(zone); return; }
    if (transitioning) { placeRig(zone); return; }
    transitioning = true;
    fadeEl.classList.add('on');
    setTimeout(() => {
      placeRig(zone);
      fadeEl.classList.remove('on');
      transitioning = false;
    }, 620);
  }

  /* ---------- optional WebXR ---------- */
  let xrSession = null;
  function enterVR(button) {
    if (xrSession) { xrSession.end(); return; }
    navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] })
      .then((session) => {
        xrSession = session;
        button.textContent = 'Exit VR';
        session.addEventListener('end', () => {
          xrSession = null;
          button.textContent = 'Enter VR';
        });
        renderer.xr.setSession(session);
      })
      .catch((err) => console.warn('Could not start VR session:', err));
  }

  /* ---------- subtle desktop look-around (pointer parallax) ---------- */
  const pointer = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  /* ---------- resize ---------- */
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ---------- render loop ---------- */
  const clock = new THREE.Clock();
  let sevSmooth = FB.risk.now();              // eased severity so scenes morph smoothly

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;

    sevSmooth += (FB.risk.displayed() - sevSmooth) * Math.min(1, dt * 2.5);
    for (const z of Object.values(zones)) z.tick(t, dt, sevSmooth);

    // parallax only outside VR (headset controls the camera in VR)
    if (!renderer.xr.isPresenting) {
      camera.rotation.y += (-pointer.x * 0.08 - camera.rotation.y) * Math.min(1, dt * 4);
      camera.rotation.x += (-pointer.y * 0.05 - camera.rotation.x) * Math.min(1, dt * 4);
      // slow drift forward/back so zones feel alive even between clicks
      camera.position.z = Math.sin(t * 0.25) * 2.0;
    }

    renderer.render(scene, camera);
  });

  /* ---------- public app API used by ui.js ---------- */
  FB.app = { goToZone, enterVR, get currentZone() { return currentZone; } };

  placeRig('vessel');                          // pre-position behind the landing screen
  FB.ui.init();
})();
