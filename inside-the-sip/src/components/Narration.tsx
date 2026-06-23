import { Caption } from './Caption'
import { useJourney } from '../journey/JourneyContext'

// The current scene's narration caption. Parented to the camera rig (see
// CameraRig children) so it stays in front of the user as they travel.
export function Narration() {
  const { step, status } = useJourney()
  // Hide while traveling so each caption appears cleanly on arrival (avoids the
  // text briefly showing the previous scene's line mid-transition).
  if (status === 'traveling') return null
  return (
    <Caption position={[0, 1.55, -1.4]} fontSize={0.08} maxWidth={1.6}>
      {step.caption}
    </Caption>
  )
}
