import { useState } from 'react'
import { StereoVideoDome } from '../components/StereoVideoDome'
import { MouthScene } from './MouthScene'
import { goTo } from '../sequence/beatMachine'

// Beats 1–5, the photoreal route: a pre-rendered, path-traced film of the mouth
// sequence (cola flood → acid → erosion → hold) played back as a 360° —
// ideally stereoscopic over-under — video on a dome around the stationary
// viewer. The film IS the visuals; the app still supplies the procedural
// soundscape and the comfort vignette (the beat clock keeps running in
// parallel, matched to the film's length — see RENDER_SPEC.md).
//
// If the render hasn't been produced yet (the file is missing), we fall back to
// the real-time procedural mouth so the experience always works.
//
// Drop the render at:  public/videos/mouth360.mp4
//   • over-under stereo (1:1 aspect) → real 3D depth in-headset
//   • or mono equirectangular (2:1)   → flat 360 (auto-detected)
const FILM_SRC = `${import.meta.env.BASE_URL}videos/mouth360.mp4`

export function MouthFilm() {
  const [failed, setFailed] = useState(false)

  if (failed) {
    // The render isn't available — keep the experience working with the
    // real-time procedural mouth (shader-driven erosion, etc.).
    return <MouthScene />
  }

  return (
    <StereoVideoDome
      src={FILM_SRC}
      radius={10}
      onError={() => setFailed(true)}
      onEnded={() => goTo('HANDOFF')}
    />
  )
}
