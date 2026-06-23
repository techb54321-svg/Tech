import { ChoiceScene } from './ChoiceScene'
import { SceneStub } from './SceneStub'
import { MouthScene } from './MouthScene'
import { EsophagusScene } from './EsophagusScene'
import { StomachScene } from './StomachScene'
import { BloodstreamScene } from './BloodstreamScene'
import { PancreasScene } from './PancreasScene'
import { LiverScene } from './LiverScene'
import { BrainScene } from './BrainScene'
import { useJourney } from '../journey/JourneyContext'

// Renders the current step's world-space content, positioned at the arrival
// point on the spline (the rig travels here, so content sits around the user).
export function ActiveScene() {
  const { step } = useJourney()
  return <group position={step.position}>{sceneFor(step.id)}</group>
}

function sceneFor(id: string) {
  switch (id) {
    case 'choice':
    case 'return':
      return <ChoiceScene />
    case 'mouth':
      return <MouthScene />
    case 'esophagus':
      return <EsophagusScene />
    case 'stomach':
      return <StomachScene />
    case 'bloodstream':
      return <BloodstreamScene />
    case 'pancreas':
      return <PancreasScene />
    case 'liver':
      return <LiverScene />
    case 'brain':
      return <BrainScene />
    // 'spin' (and any fallback) still uses the placeholder; the real spin
    // transition is Phase 4.
    default:
      return <SceneStub />
  }
}
