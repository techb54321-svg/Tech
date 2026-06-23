import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { STEPS, type JourneyStep } from './steps'
import type { DrinkChoice } from '../types'

type Status = 'paused' | 'traveling'

interface JourneyValue {
  index: number
  status: Status
  step: JourneyStep
  drink: DrinkChoice | null
  /** advance to the next step (starts the spline travel) */
  advance: () => void
  /** called by the rig when it reaches the target step */
  arrived: () => void
  /** pick a drink (used by the two Choice scenes) */
  selectDrink: (d: DrinkChoice) => void
}

const JourneyCtx = createContext<JourneyValue | null>(null)

// The top-level journey state machine: which scene we're on (`index`) and
// whether we're paused at it or `traveling` to it along the spline.
export function JourneyProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState(0)
  const [status, setStatus] = useState<Status>('paused')
  const [drink, setDrink] = useState<DrinkChoice | null>(null)
  const indexRef = useRef(0)

  const advance = useCallback(() => {
    if (indexRef.current >= STEPS.length - 1) return // already at the end
    indexRef.current += 1
    setIndex(indexRef.current)
    setStatus('traveling')
  }, [])

  const arrived = useCallback(() => setStatus('paused'), [])

  const selectDrink = useCallback(
    (d: DrinkChoice) => {
      setDrink(d)
      // Phase 1 deliverable, still logged for reference.
      console.log(`[Inside the Sip] Drink selected: ${d}`)
      advance()
    },
    [advance],
  )

  // Guided beats ('auto') advance themselves after a short dwell.
  useEffect(() => {
    if (status !== 'paused') return
    const step = STEPS[index]
    if (step.advance !== 'auto') return
    const t = setTimeout(advance, (step.dwell ?? 2.5) * 1000)
    return () => clearTimeout(t)
  }, [status, index, advance])

  const value = useMemo<JourneyValue>(
    () => ({ index, status, step: STEPS[index], drink, advance, arrived, selectDrink }),
    [index, status, drink, advance, arrived, selectDrink],
  )

  return <JourneyCtx.Provider value={value}>{children}</JourneyCtx.Provider>
}

export function useJourney() {
  const v = useContext(JourneyCtx)
  if (!v) throw new Error('useJourney must be used within <JourneyProvider>')
  return v
}
