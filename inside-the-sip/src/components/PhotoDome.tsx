import { useEffect, useMemo, useState } from 'react'
import {
  BackSide,
  BufferAttribute,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from 'three'

interface PhotoDomeProps {
  src: string
  /**
   * Greyscale depth map in the same projection as `src` (0 = near, 255 = far),
   * as produced by tools/make-photo-dome.py. Without it the dome is a plain
   * sphere — correct, but flat: both eyes see the same picture and leaning
   * your head moves nothing, which is what makes a photo sphere read as
   * wallpaper rather than a place.
   */
  depthSrc?: string
  radius?: number
  /** radius multipliers the depth map's 0..1 range maps onto */
  near?: number
  far?: number
  /**
   * Yaw applied to the dome. The default puts the middle of the panorama
   * dead ahead: with the standard sphere UVs (viewed inside-out via scale
   * -1 on X) u=0.5 lands on world -X, so we rotate -90° to bring it to -Z,
   * which is where the camera looks.
   */
  rotationY?: number
  /** called if the image can't be loaded (e.g. the file isn't bundled) */
  onError?: () => void
}

// Wraps a 360° equirectangular still around the user — the photo counterpart
// of <VideoDome>, but displaced into real geometry by a depth map so it has
// actual shape. That costs nothing at runtime (the displacement is baked into
// the vertices once, on load) and buys the two cues a flat sphere can't give:
// stereo, because each eye sees the shape from its own position, and parallax,
// because leaning moves the near surfaces against the far ones.
export function PhotoDome({
  src,
  depthSrc,
  radius = 8,
  near = 0.55,
  far = 1.35,
  rotationY = -Math.PI / 2,
  onError,
}: PhotoDomeProps) {
  const [texture, setTexture] = useState<Texture | null>(null)
  const [depth, setDepth] = useState<DepthMap | null>(null)

  useEffect(() => {
    let cancelled = false
    let loaded: Texture | null = null

    new TextureLoader().load(
      src,
      (t) => {
        if (cancelled) {
          t.dispose()
          return
        }
        t.colorSpace = SRGBColorSpace
        loaded = t
        setTexture(t)
      },
      undefined,
      () => {
        if (!cancelled) onError?.()
      },
    )

    return () => {
      cancelled = true
      setTexture(null)
      loaded?.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  // The depth map is optional in both directions: if it is missing or can't be
  // read we simply render the undisplaced sphere rather than failing the scene.
  useEffect(() => {
    if (!depthSrc) return
    let cancelled = false
    readDepthMap(depthSrc)
      .then((d) => !cancelled && setDepth(d))
      .catch(() => {})
    return () => {
      cancelled = true
      setDepth(null)
    }
  }, [depthSrc])

  const geometry = useMemo(() => {
    // Dense enough that the displacement reads as a smooth surface rather than
    // faceted panels, but still one small static mesh — ~19k vertices, built
    // once, no per-frame work.
    const geo = new SphereGeometry(radius, depth ? 192 : 64, depth ? 96 : 40)
    if (depth) displace(geo, depth, near, far)
    return geo
  }, [radius, depth, near, far])

  useEffect(() => () => geometry.dispose(), [geometry])

  if (!texture) return null

  return (
    <mesh scale={[-1, 1, 1]} rotation={[0, rotationY, 0]} geometry={geometry} raycast={() => null}>
      {/* Both halves of the inside-out trick are needed, and they are not
          redundant: scale -1 mirrors the sphere so the panorama reads the
          right way round, and BackSide draws the faces we're now inside of.
          three compensates for a negative-determinant matrix by flipping the
          winding order itself, so scale -1 alone leaves the dome culled and
          invisible. fog is off — a 360 backdrop must not be dimmed by it. */}
      <meshBasicMaterial map={texture} side={BackSide} toneMapped={false} fog={false} />
    </mesh>
  )
}

interface DepthMap {
  width: number
  height: number
  data: Uint8ClampedArray
}

// Pull the depth map's pixels out via a canvas — we need to read them on the
// CPU to move vertices, which a GPU texture alone wouldn't let us do.
function readDepthMap(url: string): Promise<DepthMap> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        reject(new Error('no 2d context'))
        return
      }
      ctx.drawImage(img, 0, 0)
      const { data } = ctx.getImageData(0, 0, img.width, img.height)
      resolve({ width: img.width, height: img.height, data })
    }
    img.onerror = () => reject(new Error(`could not load ${url}`))
    img.src = url
  })
}

// Push every vertex along its own radius by the depth under its UV, so the
// sphere takes on the shape of what the photo shows.
function displace(geo: SphereGeometry, depth: DepthMap, near: number, far: number) {
  const pos = geo.attributes.position as BufferAttribute
  const uv = geo.attributes.uv as BufferAttribute

  for (let i = 0; i < pos.count; i++) {
    const d = sample(depth, uv.getX(i), uv.getY(i))
    const k = near + (far - near) * d
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k)
  }

  pos.needsUpdate = true
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
}

// Bilinear sample, 0..1. u wraps around the seam; v is flipped because texture
// space counts up from the bottom and image rows count down from the top.
function sample(depth: DepthMap, u: number, v: number): number {
  const { width, height, data } = depth
  const x = (((u % 1) + 1) % 1) * (width - 1)
  const y = (1 - Math.min(Math.max(v, 0), 1)) * (height - 1)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = (x0 + 1) % width
  const y1 = Math.min(y0 + 1, height - 1)
  const fx = x - x0
  const fy = y - y0

  const at = (px: number, py: number) => data[(py * width + px) * 4] / 255
  const top = at(x0, y0) * (1 - fx) + at(x1, y0) * fx
  const bottom = at(x0, y1) * (1 - fx) + at(x1, y1) * fx
  return top * (1 - fy) + bottom * fy
}
