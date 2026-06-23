import { useMemo } from 'react'
import { AdditiveBlending, CanvasTexture } from 'three'

// A soft radial glow texture, generated once and shared.
let cached: CanvasTexture | null = null
function glowTexture() {
  if (cached) return cached
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.2, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  cached = new CanvasTexture(c)
  return cached
}

interface GlowProps {
  position?: [number, number, number]
  color?: string
  size?: number
  opacity?: number
}

// VR-safe "bloom": an additive, camera-facing sprite halo placed around a
// glowing object. Additive blending fakes the soft Pixar glow without any
// off-screen postprocessing pass (which breaks/slows WebXR on Quest). Sprites
// auto-billboard, write no depth, and are excluded from raycasts.
export function Glow({ position = [0, 0, 0], color = '#ffffff', size = 0.5, opacity = 0.8 }: GlowProps) {
  const map = useMemo(glowTexture, [])
  return (
    <sprite position={position} scale={[size, size, size]} raycast={() => null}>
      <spriteMaterial
        map={map}
        color={color}
        blending={AdditiveBlending}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  )
}
