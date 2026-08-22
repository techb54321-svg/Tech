import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  Vector2,
  type Group,
  type Mesh,
  type Object3D,
  type SpriteMaterial,
} from 'three'
import { InstancedSwarm } from '../components/InstancedSwarm'
import { Glow } from '../components/Glow'
import { VideoDome } from '../components/VideoDome'
import { PhotoDome } from '../components/PhotoDome'
import { enamelTextures, mouthTextures } from '../textures/surfaces'

// Scene 3 — The Mouth. Giant friendly teeth in a warm pink mouth. Glowing acid
// droplets wash down; tapping a tooth reveals stylised enamel erosion (a soft
// brown patch + a small cavity), informative rather than gory.
//
// Educational note: sugar feeds mouth bacteria that produce acid, which
// dissolves enamel over time. Simplified here to a single tap-to-erode beat.
//
// The mouth backdrop degrades gracefully through three levels:
//   1. the real mouth photo, displaced into 3D by its depth map — see
//      public/panoramas/ and <PhotoDome>;
//   2. the 360° cola-wash video at public/videos/mouth360.mp4, if the
//      photo isn't bundled;
//   3. the hand-built procedural mouth below, if neither loads.
//
// Everything sits at eye height rather than around the rig's feet, so the
// panorama is centred on the viewer's head instead of 1.5 m below it.
const EYE_HEIGHT: [number, number, number] = [0, 1.5, 0]

export function MouthScene() {
  const [photoFailed, setPhotoFailed] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)

  if (!photoFailed) {
    return (
      <group position={EYE_HEIGHT}>
        <Breathing>
          <PhotoDome
            src={`${import.meta.env.BASE_URL}panoramas/mouth-photo.jpg`}
            depthSrc={`${import.meta.env.BASE_URL}panoramas/mouth-photo-depth.png`}
            onError={() => setPhotoFailed(true)}
          />
        </Breathing>
        <ThroatGlow />
        <Saliva />
      </group>
    )
  }
  if (!videoFailed) {
    return (
      <group position={EYE_HEIGHT}>
        <VideoDome
          src={`${import.meta.env.BASE_URL}videos/mouth360.mp4`}
          onError={() => setVideoFailed(true)}
        />
      </group>
    )
  }
  return <ProceduralMouth />
}

// A still photo reads as a picture no matter how good it is; a surface that
// moves reads as a place. This is the slowest, cheapest motion that says
// "alive": the whole mouth swells and settles on a ~5 s breathing cycle.
// Deliberately tiny — at this scale 1.5% is a visible drift of the walls, and
// anything more would read as a wobble and cost comfort.
function Breathing({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null)
  useFrame((s) => {
    if (!ref.current) return
    const breath = 1 + Math.sin(s.clock.elapsedTime * ((Math.PI * 2) / 5)) * 0.015
    ref.current.scale.setScalar(breath)
  })
  return <group ref={ref}>{children}</group>
}

// Warmth from down the throat, throbbing gently out of phase with the breath.
// Depth cue as much as mood: it sits behind everything else, so it gives the
// eye something far away to focus past the near teeth.
function ThroatGlow() {
  const ref = useRef<SpriteMaterial>(null)
  useFrame((s) => {
    if (!ref.current) return
    ref.current.opacity = 0.26 + Math.sin(s.clock.elapsedTime * 0.9) * 0.07
  })
  return (
    <sprite position={[0, -0.35, -7.2]} scale={[5.5, 4, 1]} raycast={() => null}>
      <spriteMaterial
        ref={ref}
        map={useMemo(softSprite, [])}
        color="#b02231"
        blending={AdditiveBlending}
        transparent
        opacity={0.26}
        depthWrite={false}
        toneMapped={false}
        fog={false}
      />
    </sprite>
  )
}

// Motes of saliva drifting through the air around you. These do the heaviest
// lifting for presence of anything in the scene: they live between 0.6 m and
// 4 m away, so as your head moves they slide across the far walls at visibly
// different rates — real parallax, from geometry the photo can never provide.
function Saliva() {
  return (
    <InstancedSwarm
      count={45}
      update={(d: Object3D, i: number, t: number) => {
        const a = frac(Math.sin(i * 12.9898) * 43758.5)
        const b = frac(Math.sin(i * 78.233) * 43758.5)
        const c = frac(Math.sin(i * 39.425) * 43758.5)

        const dist = 0.6 + a * 3.4
        const angle = b * Math.PI * 2 + t * 0.03 * (1 - a) // nearer motes drift faster
        const rise = ((t * (0.02 + c * 0.03) + c) % 1) - 0.5

        d.position.set(
          Math.sin(angle) * dist,
          rise * 2.4 + Math.sin(t * 0.6 + i) * 0.04,
          Math.cos(angle) * dist - 1.2,
        )
        d.scale.setScalar(0.006 + c * 0.012)
      }}
    >
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#ffe9ee" transparent opacity={0.38} toneMapped={false} fog={false} />
    </InstancedSwarm>
  )
}

// Soft radial sprite, generated once and shared (same idea as <Glow>, but
// sized per-axis here so the throat can be a wide oval rather than a circle).
let softCache: CanvasTexture | null = null
function softSprite() {
  if (softCache) return softCache
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  softCache = new CanvasTexture(c)
  return softCache
}

function ProceduralMouth() {
  const teeth = Array.from({ length: 7 }, (_, i) => i)
  const arc = 1.5 // radians spread
  const radius = 0.95
  const flesh = useMemo(mouthTextures, [])

  return (
    <group>
      {/* Warm enveloping mouth interior — wet flesh PBR + subsurface sheen. */}
      <mesh raycast={() => null}>
        <sphereGeometry args={[4, 48, 32]} />
        <meshPhysicalMaterial
          map={flesh.map}
          normalMap={flesh.normal}
          normalScale={new Vector2(0.8, 0.8)}
          roughnessMap={flesh.roughness}
          side={BackSide}
          roughness={0.7}
          sheen={0.9}
          sheenColor="#ff8a98"
          sheenRoughness={0.5}
          emissive="#7a2a38"
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* Soft pink tongue below, gently breathing. */}
      <Tongue />

      {/* Upper gum arch behind the teeth. */}
      <mesh position={[0, 1.62, -1.3]} raycast={() => null}>
        <torusGeometry args={[radius, 0.12, 16, 48, arc]} />
        <meshStandardMaterial color="#e88a98" roughness={0.6} emissive="#c25a68" emissiveIntensity={0.3} />
      </mesh>

      {/* Row of giant teeth, each tappable. */}
      {teeth.map((i) => {
        const a = -arc / 2 + (arc * i) / (teeth.length - 1)
        const x = Math.sin(a) * radius
        const y = 1.42 + Math.cos(a) * 0.05
        const z = -1.3 - Math.cos(a) * radius * 0.15
        return <Tooth key={i} position={[x, y, z]} rotation={[0, -a * 0.4, 0]} />
      })}

      {/* Acidic glow washing over the teeth. */}
      <Glow position={[0, 1.4, -1.1]} color="#cfff66" size={2.6} opacity={0.4} />

      {/* Glowing sugar-acid droplets drifting down over the teeth. */}
      <InstancedSwarm
        count={40}
        update={(d: Object3D, i: number, t: number) => {
          const seed = i * 12.9898
          const rx = frac(Math.sin(seed) * 43758.5)
          const rz = frac(Math.sin(seed + 1) * 43758.5)
          const speed = 0.25 + rx * 0.25
          const fall = ((t * speed + rx) % 1) // 0..1 loop
          d.position.set(-0.9 + rx * 1.8, 1.75 - fall * 0.9, -1.15 + (rz - 0.5) * 0.5)
          const s = 0.03 + rz * 0.03
          d.scale.setScalar(s * (1 - fall * 0.3))
        }}
      >
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial color="#d8ff7a" emissive="#aaff33" emissiveIntensity={1.1} roughness={0.3} transparent opacity={0.85} />
      </InstancedSwarm>
    </group>
  )
}

function frac(n: number) {
  return n - Math.floor(n)
}

function Tongue() {
  const ref = useRef<Mesh>(null)
  // Squash-and-stretch: as it stretches taller it gets thinner, and vice
  // versa (roughly volume-preserving) — the classic lively, cartoony feel.
  useFrame((s) => {
    if (!ref.current) return
    const stretch = 1 + Math.sin(s.clock.elapsedTime * 1.5) * 0.12
    ref.current.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch))
  })
  return (
    <mesh ref={ref} position={[0, 0.7, -1.2]} rotation={[-0.5, 0, 0]} raycast={() => null}>
      <sphereGeometry args={[0.55, 24, 16]} />
      <meshStandardMaterial color="#e06b80" roughness={0.7} emissive="#b03a52" emissiveIntensity={0.25} />
    </mesh>
  )
}

function Tooth({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  const [eroded, setEroded] = useState(false)
  const [hovered, setHovered] = useState(false)
  const ref = useRef<Mesh>(null)
  const enamel = useMemo(enamelTextures, [])

  useFrame((_, delta) => {
    if (!ref.current) return
    const target = hovered ? 1.08 : 1
    ref.current.scale.x += (target - ref.current.scale.x) * (1 - Math.pow(0.001, delta))
    ref.current.scale.z = ref.current.scale.x
  })

  return (
    <group position={position} rotation={rotation}>
      <mesh
        ref={ref}
        onPointerDown={(e) => {
          e.stopPropagation()
          setEroded(true)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        {/* Rounded, friendly tooth (capsule) with procedural enamel detail. */}
        <capsuleGeometry args={[0.11, 0.16, 8, 16]} />
        <meshStandardMaterial
          map={enamel.map}
          normalMap={enamel.normal}
          normalScale={new Vector2(0.4, 0.4)}
          roughnessMap={enamel.roughness}
          color={eroded ? '#cdb487' : '#ffffff'}
          roughness={eroded ? 0.95 : 0.5}
          metalness={0.02}
          envMapIntensity={1.4}
          emissive={eroded ? '#5a3f1a' : '#fff3da'}
          emissiveIntensity={eroded ? 0.18 : 0.1}
        />
      </mesh>

      {/* Cavity appears when eroded. */}
      {eroded && (
        <mesh position={[0, 0.04, 0.1]} raycast={() => null}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color="#3a2412" roughness={1} />
        </mesh>
      )}
    </group>
  )
}
