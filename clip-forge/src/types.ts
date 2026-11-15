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
  /** Stickers are optional extras on top of the breakout picture */
  enabled: boolean
}

export type DeviceId = 'phone' | 'tablet' | 'laptop' | 'monitor' | 'tv' | 'frame' | 'polaroid' | 'billboard' | 'portal'
export type BreakoutMotionId = 'pop' | 'slideUp' | 'flip' | 'peel' | 'zoom' | 'none'
export type CameraMoveId = 'orbit' | 'dolly' | 'handheld' | 'still'

/**
 * The signature "breakout" layer: a flat picture shown on a screen / in a
 * frame inside a 3D scene, which then comes out of the screen towards the
 * viewer.
 */
export interface PictureLayer {
  /** Object URL of the uploaded photo or video. Undefined = placeholder art */
  url?: string
  /** True when `url` is a video */
  isVideo: boolean
  /** Optional PNG of the same picture with the background removed. It pops
   *  out further than the picture so the subject bursts past the frame. */
  cutoutUrl?: string
  /** Cut the subject out of the photo automatically on upload */
  autoCutout: boolean
  /** 0..1 — how aggressively the background is removed */
  cutoutTolerance: number
  /** 0..1 — how much the cut-out subject is inflated into a solid body */
  depth: number
  device: DeviceId
  motion: BreakoutMotionId
  camera: CameraMoveId
  /** Anchor, normalised 0..1 */
  x: number
  y: number
  /** Screen height as a fraction of frame height */
  scale: number
  /** How far the picture comes out, in screen heights */
  popDistance: number
  /** Seconds before the picture starts to come out */
  delay: number
  /** Device body / frame colour */
  frameColor: string
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
  picture: PictureLayer
  /** Optional 3D sticker (star, coin, confetti …) layered over the scene */
  animation: AnimationLayer
  logo: Logo
}

export const DEVICES: { id: DeviceId; label: string; emoji: string; hint: string }[] = [
  { id: 'phone', label: 'Phone', emoji: '📱', hint: 'Pops out of a smartphone screen' },
  { id: 'tablet', label: 'Tablet', emoji: '📟', hint: 'Pops out of a tablet' },
  { id: 'laptop', label: 'Laptop', emoji: '💻', hint: 'Pops out of a laptop screen' },
  { id: 'monitor', label: 'Monitor', emoji: '🖥️', hint: 'Pops out of a desktop monitor' },
  { id: 'tv', label: 'TV', emoji: '📺', hint: 'Pops out of a big flat-screen TV' },
  { id: 'frame', label: 'Picture frame', emoji: '🖼️', hint: 'Steps out of a framed print' },
  { id: 'polaroid', label: 'Polaroid', emoji: '📸', hint: 'Lifts off an instant photo' },
  { id: 'billboard', label: 'Billboard', emoji: '🪧', hint: 'Bursts off a billboard' },
  { id: 'portal', label: 'Portal', emoji: '🔲', hint: 'Breaks through a glowing window' },
]

export const BREAKOUT_MOTIONS: { id: BreakoutMotionId; label: string; hint: string }[] = [
  { id: 'pop', label: 'Pop out', hint: 'Springs straight out of the screen towards you' },
  { id: 'slideUp', label: 'Slide up & out', hint: 'Rises out of the top of the screen, then comes forward' },
  { id: 'flip', label: 'Flip out', hint: 'Spins once as it leaves the screen' },
  { id: 'peel', label: 'Peel off', hint: 'Peels away from the screen like a sticker' },
  { id: 'zoom', label: 'Zoom at you', hint: 'Flies right at the camera and settles' },
  { id: 'none', label: 'Stay on screen', hint: 'Just the 3D device with your picture on it' },
]

export const CAMERA_MOVES: { id: CameraMoveId; label: string }[] = [
  { id: 'orbit', label: 'Slow orbit' },
  { id: 'dolly', label: 'Push in' },
  { id: 'handheld', label: 'Handheld' },
  { id: 'still', label: 'Locked off' },
]

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
