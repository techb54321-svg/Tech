import { useEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { SphereGeometry, SRGBColorSpace, VideoTexture, type Mesh } from 'three'

// A 360° video dome that supports **stereoscopic over-under (3D)** as well as
// plain mono equirectangular — the playback half of the "pre-rendered film"
// route to photorealism. The offline render is path-traced in Blender/Unreal
// and dropped in as a video; here we just wrap it on the inside of a sphere
// (VR-safe: a VideoTexture only uploads each frame — no off-screen passes).
//
// Layout is auto-detected from the video's aspect ratio:
//   • 2:1  → mono equirectangular (one sphere, seen by both eyes)
//   • 1:1  → over-under stereo: top half = LEFT eye, bottom half = RIGHT eye.
//            Two spheres on render layers 1 (left) and 2 (right); three.js
//            assigns those layers to the two WebXR eye cameras automatically,
//            so each eye samples its own half → real stereo depth in-headset.

type Layout = 'mono' | 'over-under'

interface Props {
  src: string
  radius?: number
  /** fired when the clip finishes (drive the hand-off) */
  onEnded?: () => void
  /** fired if the file can't load (e.g. not produced yet) → fall back */
  onError?: () => void
  /** expose the underlying <video> so the sequence can read currentTime, etc. */
  onVideo?: (video: HTMLVideoElement | null) => void
}

function makeDomeGeometry(radius: number, half: 'top' | 'bottom' | 'full') {
  const geo = new SphereGeometry(radius, 64, 40)
  geo.scale(-1, 1, 1) // view from the inside, un-mirrored
  if (half !== 'full') {
    const uv = geo.attributes.uv
    for (let i = 0; i < uv.count; i++) {
      // top half = v in [0.5,1] (left eye), bottom half = v in [0,0.5] (right)
      const v = uv.getY(i)
      uv.setY(i, half === 'top' ? v * 0.5 + 0.5 : v * 0.5)
    }
    uv.needsUpdate = true
  }
  return geo
}

export function StereoVideoDome({ src, radius = 8, onEnded, onError, onVideo }: Props) {
  const camera = useThree((s) => s.camera)
  const [texture, setTexture] = useState<VideoTexture | null>(null)
  const [layout, setLayout] = useState<Layout>('mono')
  const leftRef = useRef<Mesh>(null)
  const rightRef = useRef<Mesh>(null)

  useEffect(() => {
    const video = document.createElement('video')
    video.src = src
    video.loop = false
    video.muted = true // the app supplies the soundscape; render is silent
    video.playsInline = true
    video.setAttribute('webkit-playsinline', 'true')
    video.crossOrigin = 'anonymous'
    video.preload = 'auto'

    const onMeta = () => {
      // Aspect ratio decides the layout: ~2:1 mono, ~1:1 over-under stereo.
      const ar = video.videoWidth / Math.max(1, video.videoHeight)
      setLayout(ar < 1.5 ? 'over-under' : 'mono')
    }
    const onReady = () => {
      const t = new VideoTexture(video)
      t.colorSpace = SRGBColorSpace
      setTexture(t)
      onVideo?.(video)
      video.play().catch(() => {})
    }
    const onEnd = () => onEnded?.()
    const onErr = () => onError?.()

    video.addEventListener('loadedmetadata', onMeta)
    video.addEventListener('canplay', onReady)
    video.addEventListener('ended', onEnd)
    video.addEventListener('error', onErr)
    video.load()

    return () => {
      video.pause()
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('canplay', onReady)
      video.removeEventListener('ended', onEnd)
      video.removeEventListener('error', onErr)
      video.removeAttribute('src')
      video.load()
      onVideo?.(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  // For stereo, assign each dome to an eye layer and let the desktop camera see
  // the left eye (layer 1). three.js enables layer 1 on the left XR camera and
  // layer 2 on the right XR camera, so each eye samples its own half.
  useEffect(() => {
    if (layout !== 'over-under') return
    leftRef.current?.layers.set(1)
    rightRef.current?.layers.set(2)
    camera.layers.enable(1)
    return () => {
      camera.layers.disable(1)
    }
  }, [layout, texture, camera])

  const fullGeo = useMemo(() => makeDomeGeometry(radius, 'full'), [radius])
  const topGeo = useMemo(() => makeDomeGeometry(radius, 'top'), [radius])
  const bottomGeo = useMemo(() => makeDomeGeometry(radius, 'bottom'), [radius])

  if (!texture) return null

  if (layout === 'mono') {
    return (
      <mesh geometry={fullGeo} raycast={() => null}>
        <meshBasicMaterial map={texture} toneMapped={false} fog={false} />
      </mesh>
    )
  }

  return (
    <group>
      <mesh ref={leftRef} geometry={topGeo} raycast={() => null}>
        <meshBasicMaterial map={texture} toneMapped={false} fog={false} />
      </mesh>
      <mesh ref={rightRef} geometry={bottomGeo} raycast={() => null}>
        <meshBasicMaterial map={texture} toneMapped={false} fog={false} />
      </mesh>
    </group>
  )
}
