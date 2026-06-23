import { CatmullRomCurve3, Vector3 } from 'three'

// How a step advances to the next:
//  - 'select'   : the user picks a drink (the two Choice scenes)
//  - 'continue' : the user points at the Continue button + trigger/pinch
//  - 'auto'     : a guided beat that auto-advances after `dwell` seconds
export type AdvanceMode = 'select' | 'continue' | 'auto'

export interface JourneyStep {
  id: string
  title: string
  /** short, friendly narration caption (see brief — accurate, non-judgemental) */
  caption: string
  /** placeholder accent colour for the Phase 2 stub */
  color: string
  /** world-space position the camera rig travels to for this step */
  position: [number, number, number]
  advance: AdvanceMode
  /** seconds to dwell before auto-advancing (only for advance: 'auto') */
  dwell?: number
}

// The 10-scene sequence from the brief. Positions trace a gentle path that
// descends and curves "through the body", returning to the table at the end.
// Captions are intentionally short and metaphor-clear (refined in Phase 3).
export const STEPS: JourneyStep[] = [
  { id: 'choice', title: 'The Choice', caption: 'Reach out and choose a drink.', color: '#caa15a', position: [0, 0, 0], advance: 'select' },
  { id: 'spin', title: 'The Spin', caption: 'Here we go — inside the sip...', color: '#7d5bd0', position: [0, 0, -3], advance: 'auto', dwell: 2.5 },
  { id: 'mouth', title: 'The Mouth', caption: 'The mouth. Sugar and acid wash over your teeth.', color: '#e58a9a', position: [0, -1.5, -6], advance: 'continue' },
  { id: 'esophagus', title: 'The Esophagus', caption: 'Whoosh — sliding down...', color: '#cf6b78', position: [0, -5, -8], advance: 'auto', dwell: 2.5 },
  { id: 'stomach', title: 'The Stomach', caption: 'Splash! The churning stomach.', color: '#df8a4a', position: [2.5, -8, -8], advance: 'continue' },
  { id: 'bloodstream', title: 'The Bloodstream', caption: 'Into the blood — glucose races through.', color: '#c0394a', position: [6.5, -9, -5.5], advance: 'continue' },
  { id: 'pancreas', title: 'The Pancreas', caption: 'The pancreas sends out insulin "keys".', color: '#e3b44a', position: [9.5, -9, -1.5], advance: 'continue' },
  { id: 'liver', title: 'The Liver', caption: 'The liver stores the extra sugar as fat.', color: '#a06a38', position: [11.5, -8, 2.5], advance: 'continue' },
  { id: 'brain', title: 'The Brain', caption: 'A buzzy sugar "high" lights up the brain.', color: '#4aa0e6', position: [9, -5, 6.5], advance: 'continue' },
  { id: 'return', title: 'The Choice, Again', caption: 'Back at the table. The same choice — now you know.', color: '#caa15a', position: [0, 0, 0], advance: 'select' },
]

// Smooth spline through the step positions. getPoint(i/(N-1)) passes exactly
// through step i, so the rig arrives precisely at each scene.
export const PATH = new CatmullRomCurve3(
  STEPS.map((s) => new Vector3(...s.position)),
)
