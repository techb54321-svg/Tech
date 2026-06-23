import { ChoiceScene } from './ChoiceScene'
import { SceneStub } from './SceneStub'
import { SpinScene } from './SpinScene'
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
    case 'spin':
      return <SpinScene />
    case 'spinback':
      return <SpinScene reverse />
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
    // Fallback (should not occur now that every step has a real scene).
    default:
      return <SceneStub />
  }
}
