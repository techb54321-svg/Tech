import { Caption } from './Caption'
import { useJourney } from '../journey/JourneyContext'

// The current scene's narration caption. Parented to the camera rig (see
// CameraRig children) so it stays in front of the user as they travel.
export function Narration() {
  const { step } = useJourney()
  return (
    <Caption position={[0, 1.55, -1.4]} fontSize={0.08} maxWidth={1.6}>
      {step.caption}
    </Caption>
  )
}
