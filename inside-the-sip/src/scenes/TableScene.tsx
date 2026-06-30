import { useCallback, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BackSide, type Group, type Mesh, Raycaster, Vector3 } from 'three'
import { ColaBottle, DrinkHit, WaterGlass } from '../components/Drinks'
import { Glow } from '../components/Glow'
import { chooseDrink } from '../sequence/beatMachine'
import { store } from '../store'
import type { DrinkChoice } from '../types'

// Beat 0 — The Choice (the only interaction in the whole sequence).
//
// A quiet, dim room with a single warm key light over a table holding a glass
// of iced water and an open glass bottle of cola. Selection works two ways:
//   • controller ray  — point at a drink and pull the trigger (pointer events)
//   • gaze-and-dwell   — for headsets with no controllers: look at a drink for
//                        ~1.5 s and a reticle fills to confirm.
// The cola never auto-picks; after 20 s it merely catches the light (handled in
// ColaBottle). Picking water runs a short calm beat then returns here; picking
// cola launches the ride.

const DWELL = 1.5 // seconds of gaze to confirm a selection
const WATER_POS: [number, number, number] = [-0.16, 0.78, -0.7]
const COLA_POS: [number, number, number] = [0.16, 0.78, -0.7]

export function TableScene() {
  const [focus, setFocus] = useState<DrinkChoice | null>(null)
  const hits = useRef<Record<DrinkChoice, Mesh | null>>({ coke: null, water: null })

  const register = useCallback((kind: DrinkChoice, mesh: Mesh | null) => {
    hits.current[kind] = mesh
  }, [])

  return (
    <group>
      <Room />

      <WaterGlass position={WATER_POS} focused={focus === 'water'} dimmed={store.getState().drink === 'coke'} />
      <ColaBottle position={COLA_POS} focused={focus === 'coke'} dimmed={store.getState().drink === 'water'} />

      <DrinkHit
        kind="water"
        position={WATER_POS}
        register={register}
        onOver={() => setFocus('water')}
        onOut={() => setFocus((f) => (f === 'water' ? null : f))}
        onSelect={() => chooseDrink('water')}
      />
      <DrinkHit
        kind="coke"
        position={COLA_POS}
        register={register}
        onOver={() => setFocus('coke')}
        onOut={() => setFocus((f) => (f === 'coke' ? null : f))}
        onSelect={() => chooseDrink('coke')}
      />

      <GazeSelector hits={hits} setFocus={setFocus} />
    </group>
  )
}

// Head-gaze raycaster + dwell reticle. Each frame it shoots a ray straight out
// of the headset, and if it lands on a drink it accumulates dwell; a reticle in
// the centre of view fills, and at DWELL seconds it selects. The reticle is
// head-locked (re-pinned to the camera every frame) so it sits in front of the
// viewer like a cursor.
function GazeSelector({
  hits,
  setFocus,
}: {
  hits: React.MutableRefObject<Record<DrinkChoice, Mesh | null>>
  setFocus: (f: DrinkChoice | null) => void
}) {
  const { camera } = useThree()
  const ray = useRef(new Raycaster())
  const dir = useRef(new Vector3())
  const dwell = useRef(0)
  const gazed = useRef<DrinkChoice | null>(null)
  const reticle = useRef<Group>(null)
  const fill = useRef<Mesh>(null)

  useFrame((_, delta) => {
    // Gaze only matters while we're still at the choice.
    const choosing = store.getState().beat === 'CHOICE' && !store.getState().drink

    // Pin the reticle in front of the head.
    if (reticle.current) {
      reticle.current.position.copy(camera.position)
      reticle.current.quaternion.copy(camera.quaternion)
      reticle.current.translateZ(-0.6)
      reticle.current.visible = choosing && dwell.current > 0.05
    }

    if (!choosing) {
      dwell.current = 0
      gazed.current = null
      return
    }

    camera.getWorldDirection(dir.current)
    ray.current.set(camera.position, dir.current)
    const meshes = [hits.current.coke, hits.current.water].filter(Boolean) as Mesh[]
    const hit = ray.current.intersectObjects(meshes, false)[0]
    // Resolve which drink was gazed at by mesh identity.
    const looking: DrinkChoice | null = !hit
      ? null
      : hit.object === hits.current.coke
        ? 'coke'
        : hit.object === hits.current.water
          ? 'water'
          : null

    if (looking) {
      if (gazed.current !== looking) {
        gazed.current = looking
        dwell.current = 0
        setFocus(looking)
      }
      dwell.current += delta
      if (fill.current) fill.current.scale.setScalar(Math.min(1, dwell.current / DWELL))
      if (dwell.current >= DWELL) {
        chooseDrink(looking)
        dwell.current = 0
        gazed.current = null
      }
    } else {
      if (gazed.current) setFocus(null)
      gazed.current = null
      dwell.current = 0
    }
  })

  return (
    <group ref={reticle} visible={false} raycast={() => null}>
      {/* Outer ring. */}
      <mesh raycast={() => null}>
        <ringGeometry args={[0.012, 0.015, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.6} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* Dwell fill (scales 0→1). */}
      <mesh ref={fill} raycast={() => null}>
        <circleGeometry args={[0.011, 32]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={0.85} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

// The quiet, dim room: soft curved walls, a warm timber floor, and a single
// hanging key light that pools warm light over the table.
function Room() {
  const lamp = useRef<Group>(null)
  useFrame((s) => {
    // Water branch gives a soft brightening; otherwise a faint warm flicker.
    if (!lamp.current) return
    const water = store.getState().beat === 'WATER'
    lamp.current.scale.setScalar(water ? 1.15 : 1 + Math.sin(s.clock.elapsedTime * 8) * 0.02)
  })
  return (
    <group>
      {/* Walls + ceiling seen from inside. */}
      <mesh position={[0, 1.6, -0.6]} raycast={() => null}>
        <cylinderGeometry args={[3.3, 3.3, 3.6, 48, 1, true]} />
        <meshStandardMaterial color="#2b1c19" side={BackSide} roughness={0.97} />
      </mesh>
      <mesh position={[0, 3.4, -0.6]} raycast={() => null}>
        <coneGeometry args={[3.3, 1.2, 48, 1, true]} />
        <meshStandardMaterial color="#221512" side={BackSide} roughness={1} />
      </mesh>
      {/* Warm timber floor + rug. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -0.6]} raycast={() => null}>
        <circleGeometry args={[3.3, 48]} />
        <meshStandardMaterial color="#4f3220" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -0.7]} raycast={() => null}>
        <circleGeometry args={[1.0, 48]} />
        <meshStandardMaterial color="#6e2f2f" roughness={0.95} />
      </mesh>

      {/* Hanging warm key light over the table. */}
      <group ref={lamp} position={[0, 2.4, -0.7]}>
        <mesh position={[0, 0.5, 0]} raycast={() => null}>
          <cylinderGeometry args={[0.01, 0.01, 1.0, 8]} />
          <meshStandardMaterial color="#241712" />
        </mesh>
        <mesh raycast={() => null}>
          <sphereGeometry args={[0.07, 20, 16]} />
          <meshStandardMaterial color="#fff2cf" emissive="#ffcf7a" emissiveIntensity={2} />
        </mesh>
        <Glow color="#ffcf8a" size={1.1} opacity={0.7} />
        <pointLight color="#ffd6a0" intensity={6} distance={5.5} decay={2} />
      </group>

      {/* The table. */}
      <group position={[0, 0, -0.7]}>
        <mesh position={[0, 0.76, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.42, 0.42, 0.04, 48]} />
          <meshStandardMaterial color="#7a4e26" roughness={0.5} metalness={0.05} envMapIntensity={1.2} />
        </mesh>
        <mesh position={[0, 0.38, 0]}>
          <cylinderGeometry args={[0.05, 0.09, 0.74, 24]} />
          <meshStandardMaterial color="#5e3a1c" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.2, 0.22, 0.04, 32]} />
          <meshStandardMaterial color="#5e3a1c" roughness={0.7} />
        </mesh>
      </group>
    </group>
  )
}
