import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import { BackSide } from 'three'
import { xrStore } from './xrStore'
import { JourneyProvider } from './journey/JourneyContext'
import { CameraRig } from './journey/CameraRig'
import { ActiveScene } from './scenes/ActiveScene'
import { Narration } from './components/Narration'
import { ContinueButton } from './components/ContinueButton'
import { ComfortVignette } from './components/ComfortVignette'
import { TravelParticles } from './components/TravelParticles'
import { Atmosphere } from './components/Atmosphere'
import { AudioCues } from './audio/AudioCues'

// Phase 2 — Journey framework.
// A scene state machine (JourneyProvider) drives progression through the 10
// scenes; the CameraRig flies the player along a spline; narration captions,
// a Continue affordance, and a comfort vignette are shared systems. Scenes are
// stubbed (SceneStub) so the whole journey is travel-able end-to-end. Phase 3
// fills in each scene's real geometry and interactions.
export function App() {
  return (
    <>
      <Overlay />
      <Canvas
        camera={{ position: [0, 1.5, 0.6], fov: 60 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
        onCreated={({ gl }) => {
          // Slightly punchier exposure for a cinematic, glowing look (R3F
          // already uses ACES filmic tone mapping + sRGB output).
          gl.toneMappingExposure = 1.15
        }}
      >
        <color attach="background" args={['#1c1018']} />

        {/* Soft GI-style lighting that reaches the whole journey volume. */}
        <hemisphereLight intensity={0.7} color="#ffe9d6" groundColor="#2a1a22" />
        <ambientLight intensity={0.45} color="#ffe9d6" />
        {/* Warm key, cool fill, and a cool rim light from behind for a soft
            Pixar-style three-point feel. */}
        <directionalLight position={[2.5, 4, 2]} intensity={1.4} color="#fff1d8" />
        <directionalLight position={[-3, 2, -1]} intensity={0.4} color="#8fb6ff" />
        <directionalLight position={[0, 3, -5]} intensity={0.5} color="#bfe0ff" />

        {/* Large enclosing backdrop so the user is never in a black void. */}
        <mesh raycast={() => null}>
          <sphereGeometry args={[40, 32, 16]} />
          <meshBasicMaterial color="#1c1018" side={BackSide} />
        </mesh>

        <XR store={xrStore}>
          <JourneyProvider>
            {/* HUD-like world UI is parented to the rig (stays in front). */}
            <CameraRig>
              <Narration />
              <ContinueButton />
            </CameraRig>

            <Atmosphere />
            <ActiveScene />
            <TravelParticles />
            <ComfortVignette />
            <AudioCues />
          </JourneyProvider>
        </XR>
      </Canvas>
    </>
  )
}

// 2D overlay shown before entering VR: title + Enter VR button.
function Overlay() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '28px 16px',
      }}
    >
      <div style={{ textAlign: 'center', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: 0.5 }}>Inside the Sip</h1>
        <p style={{ margin: '6px 0 0', opacity: 0.8, fontSize: 14 }}>
          A WebXR journey for Meta Quest 3
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => xrStore.enterVR()}
          style={{
            pointerEvents: 'auto',
            border: 'none',
            borderRadius: 999,
            padding: '16px 40px',
            fontSize: 18,
            fontWeight: 700,
            color: '#3a1f12',
            background: 'linear-gradient(135deg, #ffd166, #ff9f43)',
            boxShadow: '0 6px 20px rgba(255,159,67,0.45)',
            cursor: 'pointer',
          }}
        >
          Enter VR
        </button>
        <p style={{ margin: 0, fontSize: 12, opacity: 0.6, maxWidth: 340, textAlign: 'center' }}>
          Put on the Quest 3 and tap Enter VR. Choose a drink to begin the journey;
          point + trigger the Continue button to travel between scenes.
        </p>
      </div>
    </div>
  )
}
