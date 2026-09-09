import type { MotionId } from '../types'
import { easeOutBack, easeOutBounce, easeOutCubic, easeOutElastic, easeOutQuint, window01 } from './easing'

export interface MotionState {
  /** Offset from the anchor, in multiples of the object size */
  x: number
  y: number
  z: number
  /** Euler rotation, radians */
  rx: number
  ry: number
  rz: number
  scale: number
}

export const MOTIONS: { id: MotionId; label: string; hint: string }[] = [
  { id: 'bounce', label: 'Bounce in', hint: 'Springs in, then bobs gently' },
  { id: 'drop', label: 'Drop', hint: 'Falls from above and lands with a bounce' },
  { id: 'spinIn', label: 'Spin in', hint: 'Whirls in while growing, then keeps turning' },
  { id: 'pop', label: 'Pop', hint: 'Elastic pop, then a steady pulse' },
  { id: 'slideLeft', label: 'Slide from left', hint: 'Glides in from the left edge' },
  { id: 'slideRight', label: 'Slide from right', hint: 'Glides in from the right edge' },
  { id: 'float', label: 'Float', hint: 'Fades in and hovers with a slow tilt' },
  { id: 'swing', label: 'Swing', hint: 'Drops in and swings like a sign' },
  { id: 'orbit', label: 'Turntable', hint: 'Continuous showcase rotation' },
]

const ENTER = 0.9

export function motionAt(id: MotionId, t: number, delay: number): MotionState {
  const s: MotionState = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 }
  const p = window01(t, delay, ENTER)
  const idle = Math.max(0, t - delay - ENTER)
  if (t < delay) {
    s.scale = 0
    return s
  }
  switch (id) {
    case 'bounce': {
      s.scale = easeOutElastic(p)
      s.y = Math.sin(idle * 2.2) * 0.04
      s.ry = Math.sin(idle * 1.1) * 0.25
      s.rz = Math.sin(idle * 1.6) * 0.04
      break
    }
    case 'drop': {
      const e = easeOutBounce(p)
      s.y = (1 - e) * 1.8
      s.scale = 1
      // squash on impact
      const sq = 1 + Math.sin(Math.min(1, p) * Math.PI * 4) * 0.05 * (1 - p)
      s.scale = sq
      s.ry = Math.sin(idle * 0.9) * 0.3
      break
    }
    case 'spinIn': {
      s.scale = easeOutBack(p)
      s.ry = (1 - easeOutQuint(p)) * Math.PI * 4 + idle * 0.8
      s.y = Math.sin(idle * 1.8) * 0.03
      break
    }
    case 'pop': {
      s.scale = easeOutElastic(p) * (1 + Math.sin(idle * 3.2) * 0.04)
      s.rz = Math.sin(idle * 3.2) * 0.03
      break
    }
    case 'slideLeft':
    case 'slideRight': {
      const dir = id === 'slideLeft' ? -1 : 1
      s.x = (1 - easeOutQuint(p)) * 2.5 * dir
      s.rz = (1 - easeOutCubic(p)) * -0.5 * dir
      s.ry = Math.sin(idle * 1.2) * 0.3
      s.y = Math.sin(idle * 2) * 0.03
      break
    }
    case 'float': {
      s.scale = easeOutCubic(p)
      s.y = (1 - easeOutCubic(p)) * -0.4 + Math.sin(idle * 1.4) * 0.08
      s.rx = Math.sin(idle * 0.9) * 0.15
      s.ry = Math.sin(idle * 0.7) * 0.35
      s.rz = Math.cos(idle * 1.1) * 0.08
      break
    }
    case 'swing': {
      s.y = (1 - easeOutCubic(p)) * 1.6
      const decay = Math.exp(-idle * 0.35)
      s.rz = Math.sin((p + idle) * 4.5) * 0.35 * decay + Math.sin(idle * 1.2) * 0.04
      s.scale = 1
      break
    }
    case 'orbit': {
      s.scale = easeOutBack(p)
      s.ry = t * 1.3
      s.y = Math.sin(idle * 1.6) * 0.04
      s.rx = 0.15
      break
    }
  }
  return s
}
