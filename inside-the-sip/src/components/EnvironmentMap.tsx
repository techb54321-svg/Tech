import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import {
  CanvasTexture,
  EquirectangularReflectionMapping,
  PMREMGenerator,
  SRGBColorSpace,
} from 'three'

// Builds a soft "studio" environment map procedurally and installs it as
// scene.environment, giving every standard material real image-based lighting
// and reflections/sheen — the look that makes glossy surfaces (the drinks,
// teeth, wet organs) feel premium.
//
// Why procedural: a CDN-loaded HDRI is the exact fetch that black-screened the
// headset earlier. This draws a warm gradient sky with a bright warm key light
// and a cool fill into a canvas, then PMREM-prefilters it ONCE at startup (on
// the 2D page, before entering VR). At render time it's just a texture sample —
// fully VR-safe, no per-frame render passes.
function makeEnvCanvas() {
  const w = 512
  const h = 256
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!

  // Vertical gradient: soft warm "ceiling" down to a dark "floor".
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#6a5878')
  g.addColorStop(0.5, '#3c2c34')
  g.addColorStop(1, '#140d12')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // Warm key light (upper-left) — the main highlight source.
  blob(ctx, w * 0.3, h * 0.28, w * 0.2, 'rgba(255,226,180,1)')
  // Cool fill (right).
  blob(ctx, w * 0.74, h * 0.42, w * 0.17, 'rgba(150,190,255,0.65)')
  // Subtle rim (lower-left).
  blob(ctx, w * 0.12, h * 0.7, w * 0.13, 'rgba(180,200,255,0.4)')

  return c
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color)
  g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
}

export function EnvironmentMap() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    const tex = new CanvasTexture(makeEnvCanvas())
    tex.mapping = EquirectangularReflectionMapping
    tex.colorSpace = SRGBColorSpace

    const pmrem = new PMREMGenerator(gl)
    pmrem.compileEquirectangularShader()
    const env = pmrem.fromEquirectangular(tex).texture

    scene.environment = env

    tex.dispose()
    pmrem.dispose()
    return () => {
      scene.environment = null
      env.dispose()
    }
  }, [gl, scene])

  return null
}
