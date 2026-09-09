// ---------------------------------------------------------------------------
// Core project model. A Project is everything needed to render a clip and is
// fully serialisable (except uploaded media, which live as object URLs).
// ---------------------------------------------------------------------------

export type FormatId = '9:16' | '1:1' | '4:5' | '16:9'

export interface Format {
  id: FormatId
  label: string
  width: number
  height: number
  hint: string
}

export const FORMATS: Format[] = [
  { id: '9:16', label: 'Story / Reel', width: 1080, height: 1920, hint: 'TikTok, Reels, Shorts, Stories' },
  { id: '1:1', label: 'Square', width: 1080, height: 1080, hint: 'Instagram & Facebook feed' },
  { id: '4:5', label: 'Portrait', width: 1080, height: 1350, hint: 'Instagram feed (max height)' },
  { id: '16:9', label: 'Landscape', width: 1920, height: 1080, hint: 'YouTube, LinkedIn, X' },
]

export type BackgroundKind = 'gradient' | 'solid' | 'image' | 'video'

export interface Background {
  kind: BackgroundKind
  /** Gradient preset id (kind = gradient) */
  gradient: string
  /** Hex colour (kind = solid) */
  color: string
  /** Object URL of uploaded media (kind = image | video) */
  mediaUrl?: string
  /** 0..1 dark overlay on top of the background so text stays legible */
  dim: number
  /** Slow Ken-Burns zoom for image backgrounds */
  kenBurns: boolean
  /** Blur in px at 1080p scale */
  blur: number
}

export type TextAnim = 'none' | 'fade' | 'rise' | 'pop' | 'typewriter' | 'slide'
export type FontId = 'sans' | 'impact' | 'serif' | 'rounded' | 'mono'

export interface TextLayer {
  id: string
  text: string
  /** Centre position, normalised 0..1 of frame width / height */
  x: number
  y: number
  /** Font size as a fraction of frame height */
  size: number
  /** Max line width as a fraction of frame width */
  maxWidth: number
  color: string
  font: FontId
  align: 'left' | 'center' | 'right'
  /** Optional pill / box behind the text */
  boxColor?: string
  outline: boolean
  shadow: boolean
  uppercase: boolean
  anim: TextAnim
  /** Seconds before the entrance animation starts */
  delay: number
}

export type MotionId =
  | 'bounce'
  | 'drop'
  | 'spinIn'
  | 'pop'
  | 'slideLeft'
  | 'slideRight'
  | 'float'
  | 'swing'
  | 'orbit'

export interface AnimationLayer {
  /** Id from the animation registry (see engine/animations) */
  kind: string
  /** Text used by text-based animations (3D headline, coin, bubble …) */
  text: string
  motion: MotionId
  /** Anchor position, normalised 0..1 */
  x: number
  y: number
  /** Size as a fraction of frame height (1 = the object is as tall as the frame) */
  scale: number
  /** Primary / secondary colours */
  color: string
  color2: string
  /** Seconds before the object enters */
  delay: number
  /** Shiny (metal) vs matte look */
  metallic: boolean
}

export interface Logo {
  url?: string
  corner: 'tl' | 'tr' | 'bl' | 'br'
  /** Height as fraction of frame height */
  size: number
}

export interface Project {
  name: string
  format: FormatId
  duration: number
  fps: number
  background: Background
  texts: TextLayer[]
  animation: AnimationLayer
  logo: Logo
}

export interface Template {
  id: string
  name: string
  category: string
  emoji: string
  project: Project
}

export function formatOf(id: FormatId): Format {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0]
}

let counter = 0
export function uid(prefix = 'id'): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}
