import { useEffect, useState } from 'react'
import { BackSide, SRGBColorSpace, TextureLoader, type Texture } from 'three'

interface PhotoDomeProps {
  src: string
  radius?: number
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

// Wraps a 360° equirectangular *still* on the inside of a sphere around the
// user — the photo counterpart of <VideoDome>. Cheapest possible immersive
// backdrop for the headset: one texture, one draw call, no per-frame uploads,
// so it holds 72/90fps on a Quest even in the heaviest scenes.
export function PhotoDome({ src, radius = 8, rotationY = -Math.PI / 2, onError }: PhotoDomeProps) {
  const [texture, setTexture] = useState<Texture | null>(null)

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

  if (!texture) return null

  return (
    <mesh scale={[-1, 1, 1]} rotation={[0, rotationY, 0]} raycast={() => null}>
      <sphereGeometry args={[radius, 64, 40]} />
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
