import { useCallback, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import { xrStore } from './xrStore'
import { ChoiceScene } from './scenes/ChoiceScene'
import type { DrinkChoice } from './types'

// Phase 1 — Walking skeleton.
// Enters VR on Quest 3 over HTTPS, renders the warm table with a grabbable
// water + Coke, and logs which drink the user selected. The full guided
// journey (spin, mouth, bloodstream, …) is wired up in later phases.
export function App() {
  const [selected, setSelected] = useState<DrinkChoice | null>(null)

  const handleSelect = useCallback((kind: DrinkChoice) => {
    setSelected(kind)
    // Phase 1 deliverable: log the choice. Later this kicks off "The Spin".
    console.log(`[Inside the Sip] Drink selected: ${kind}`)
  }, [])

  return (
    <>
      <Overlay selected={selected} />
      <Canvas
        camera={{ position: [0, 1.45, 0.55], fov: 60 }}
        gl={{ antialias: true }}
        // Aim the desktop preview camera at the table so the drinks are clearly
        // framed on a 2D screen. In VR this is ignored — the headset pose drives
        // the camera and the user simply looks down at the table.
        onCreated={({ camera }) => camera.lookAt(0, 0.78, -0.7)}
      >
        <color attach="background" args={['#3a2a33']} />

        {/* Soft GI-style lighting: warm key, cool fill, gentle rim + ambient.
            The hemisphere light guarantees everything is softly lit from every
            angle so nothing reads as pure black in the headset. */}
        <hemisphereLight intensity={0.7} color="#ffe9d6" groundColor="#3a241a" />
        <ambientLight intensity={0.5} color="#ffe9d6" />
        <directionalLight position={[2.5, 4, 2]} intensity={1.6} color="#fff1d8" />
        <directionalLight position={[-3, 2, -1]} intensity={0.5} color="#8fb6ff" />
        <pointLight position={[0, 2, -2]} intensity={0.4} color="#ffd1a8" />

        <XR store={xrStore}>
          <ChoiceScene onSelect={handleSelect} selected={selected} />
        </XR>
      </Canvas>
    </>
  )
}

// HTML overlay shown on the 2D page (before entering VR): the Enter VR button
// and a small readout of the current choice for desktop testing.
function Overlay({ selected }: { selected: DrinkChoice | null }) {
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
        {selected && (
          <div style={{ fontSize: 14, opacity: 0.85 }}>
            You chose: <strong>{selected === 'coke' ? 'Coke 🥤' : 'Water 💧'}</strong>
          </div>
        )}
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
        <p style={{ margin: 0, fontSize: 12, opacity: 0.6, maxWidth: 320, textAlign: 'center' }}>
          On desktop you can still click the drinks to test selection. Put on the
          Quest 3 and tap Enter VR for the full scene.
        </p>
      </div>
    </div>
  )
}
