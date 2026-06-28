import { useEffect, useState } from 'react'
import { BackSide, SRGBColorSpace, VideoTexture } from 'three'

interface VideoDomeProps {
  src: string
  radius?: number
  /** called if the video can't be loaded (e.g. file not present yet) */
  onError?: () => void
}

// Wraps a 360° equirectangular video on the inside of a sphere around the user
// (a "video dome"). VR-safe: a VideoTexture just uploads each frame to the GPU —
// no off-screen render passes. The clip is muted + looped so it plays without a
// gesture and keeps running until the user continues.
export function VideoDome({ src, radius = 8, onError }: VideoDomeProps) {
  const [texture, setTexture] = useState<VideoTexture | null>(null)

  useEffect(() => {
    const video = document.createElement('video')
    video.src = src
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.setAttribute('webkit-playsinline', 'true')
    video.crossOrigin = 'anonymous'

    const handleReady = () => {
      const t = new VideoTexture(video)
      t.colorSpace = SRGBColorSpace
      setTexture(t)
      video.play().catch(() => {})
    }
    const handleError = () => onError?.()

    video.addEventListener('canplay', handleReady)
    video.addEventListener('error', handleError)
    video.load()

    return () => {
      video.pause()
      video.removeEventListener('canplay', handleReady)
      video.removeEventListener('error', handleError)
      video.removeAttribute('src')
      video.load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  if (!texture) return null

  // Inverted on X so the equirectangular map isn't mirrored from the inside.
  return (
    <mesh scale={[-1, 1, 1]} raycast={() => null}>
      <sphereGeometry args={[radius, 60, 40]} />
      <meshBasicMaterial map={texture} side={BackSide} toneMapped={false} />
    </mesh>
  )
}
