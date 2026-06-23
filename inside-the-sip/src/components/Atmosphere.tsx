import { useThree, useFrame } from '@react-three/fiber'
import { Color, FogExp2 } from 'three'
import { useJourney } from '../journey/JourneyContext'

// Per-scene atmospheric fog. This is the single biggest "real environment"
// upgrade — it gives depth, mood and a sense of scale (distant geometry fades
// into the scene's colour) the way Richie's Plank sells presence. FogExp2 is
// per-fragment, so it's completely VR-safe and free of render passes.
// The colour/density lerp smoothly as you travel between scenes.
const tmp = new Color()

const FOG: Record<string, { color: string; density: number }> = {
  choice: { color: '#241019', density: 0.05 },
  spin: { color: '#2a1640', density: 0.045 },
  mouth: { color: '#6e1f2c', density: 0.085 },
  esophagus: { color: '#8a3744', density: 0.11 },
  stomach: { color: '#a0501c', density: 0.075 },
  bloodstream: { color: '#5e1019', density: 0.04 },
  pancreas: { color: '#7c561c', density: 0.06 },
  liver: { color: '#4f2e14', density: 0.07 },
  brain: { color: '#141d4a', density: 0.032 },
  spinback: { color: '#2a1640', density: 0.045 },
  return: { color: '#241019', density: 0.05 },
}

export function Atmosphere() {
  const { step } = useJourney()
  const scene = useThree((s) => s.scene)

  if (!(scene.fog instanceof FogExp2)) {
    scene.fog = new FogExp2('#241019', 0.05)
  }

  useFrame((_, delta) => {
    const f = scene.fog as FogExp2
    const target = FOG[step.id] ?? FOG.choice
    const k = 1 - Math.pow(0.02, delta)
    f.color.lerp(tmp.set(target.color), k)
    f.density += (target.density - f.density) * k
  })

  return null
}
