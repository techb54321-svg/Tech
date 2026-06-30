import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import { BackSide, FogExp2 } from 'three'
import { xrStore } from './xrStore'
import { EnvironmentMap } from './components/EnvironmentMap'
import { Sequencer } from './sequence/Sequencer'
import { TableScene } from './scenes/TableScene'
import { MouthFilm } from './scenes/MouthFilm'
import { SequenceVignette } from './components/SequenceVignette'
import { SequenceFX } from './components/SequenceFX'
import { SequenceAudio } from './audio/SequenceAudio'
import { useSequence } from './store'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

// Harmless QA bridge: exposes the three.js scene/camera/gl on window for
// headless smoke tests and console debugging.
function DebugBridge() {
  const state = useThree()
  useEffect(() => {
    ;(window as unknown as { sip3?: unknown }).sip3 = state
  }, [state])
  return null
}

// ---------------------------------------------------------------------------
// "Inside the Sip" — OPENING SEQUENCE.
//
// A guided, photoreal, ~80 s cinematic ride with exactly one interaction (the
// drink choice). Choosing cola auto-plays: arrival on the tongue → the cola
// flood → acid forming → enamel eroding to dentin → a held reference shot →
// fade to black. That black is the single clean HAND-OFF where later scenes
// attach (see the marked slot in MouthScene).
//
// Architecture:
//   store.ts                 shared state (beat, drink, erosion, flood, drown)
//   sequence/beatMachine.ts  the explicit state machine
//   sequence/timeline.ts     beat durations + dolly + erosion/flood curves
//   sequence/Sequencer.tsx   the one timeline controller (no setTimeouts)
//   scenes/                  TableScene (Beat 0), MouthScene (Beats 1–5)
//   components/, shaders/    teeth/tongue/cola + the enamel erosion shader
// ---------------------------------------------------------------------------

export function App() {
  return (
    <>
      <Overlay />
      <Canvas
        camera={{ position: [0, 1.6, 0], fov: 68 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
        onCreated={({ gl, scene }) => {
          gl.toneMappingExposure = 1.1
          // Light haze for depth + the "Powers of Ten" sense of scale.
          scene.fog = new FogExp2('#1a0c0a', 0.04)
        }}
      >
        <color attach="background" args={['#140a09']} />

        {/* Gentle fill so nothing is ever a pure-black void; the scenes carry
            their own warm key + rim lights, and the baked environment map
            (EnvironmentMap) supplies image-based ambient + reflections. */}
        <ambientLight intensity={0.22} color="#ffe2c8" />
        <hemisphereLight intensity={0.3} color="#ffe9d6" groundColor="#2a1118" />

        {/* Far backdrop sphere — a safety net behind every scene. */}
        <mesh raycast={() => null}>
          <sphereGeometry args={[40, 32, 16]} />
          <meshBasicMaterial color="#140a09" side={BackSide} fog={false} />
        </mesh>

        <EnvironmentMap />
        <DebugBridge />

        <XR store={xrStore}>
          <Sequencer>
            <Scenes />
            <SequenceFX />
            <SequenceVignette />
            <SequenceAudio />
          </Sequencer>
        </XR>
      </Canvas>
    </>
  )
}

// Mounts the right scene for the current beat. The table (Beat 0) is real-time;
// the mouth (Beats 1–5) is the pre-rendered film (MouthFilm), which falls back
// to the real-time procedural mouth if the render file isn't present. The
// caramel "drown" cut (DROWN) stays on the table side so the hard cut lands as
// the film takes over at ARRIVAL.
function Scenes() {
  const beat = useSequence((s) => s.beat)
  const atTable = beat === 'CHOICE' || beat === 'WATER' || beat === 'DROWN'
  const inMouth = !atTable
  return (
    <>
      {atTable && <TableScene />}
      {inMouth && <MouthFilm />}
    </>
  )
}

// 2D pre-VR overlay: title + Enter VR button.
function Overlay() {
  return (
    <div
      id="sip-overlay"
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
          What one sip does to your teeth — in 80 seconds
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
          Put on the Quest 3 and tap Enter VR. Choose a drink to begin — point and
          pull the trigger, or simply look at it for a moment.
        </p>
      </div>
    </div>
  )
}
