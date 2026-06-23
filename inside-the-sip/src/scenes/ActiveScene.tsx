import { ChoiceScene } from './ChoiceScene'
import { SceneStub } from './SceneStub'
import { useJourney } from '../journey/JourneyContext'

// Renders the world-space content for the current step. The two Choice steps
// show the real table; everything else is a Phase 2 placeholder (SceneStub).
export function ActiveScene() {
  const { step } = useJourney()
  if (step.id === 'choice' || step.id === 'return') return <ChoiceScene />
  return <SceneStub step={step} />
}
