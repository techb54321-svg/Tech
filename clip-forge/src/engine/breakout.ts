import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { BreakoutMotionId, DeviceId, PictureLayer } from '../types'
import { easeInOutCubic, easeOutBack, easeOutCubic, easeOutQuint, window01 } from './easing'

// ---------------------------------------------------------------------------
// The "breakout" effect: a flat picture on a screen inside a 3D scene that
// comes out of the screen towards the viewer.
//
// Everything is built in "screen units": the screen is centred on the origin
// in the XY plane, faces +Z and is exactly 1 unit tall. The renderer scales
// the whole group to the user's chosen size.
// ---------------------------------------------------------------------------

export interface PictureTextures {
  /** Full picture (image or video) */
  picture: THREE.Texture
  /** Picture aspect ratio (w / h) */
  aspect: number
  /** Optional background-removed version of the same picture */
  cutout?: THREE.Texture
}

export interface BreakoutBuilt {
  object: THREE.Object3D
  /** World-space half height of the whole device, for floor placement */
  bottomY: number
  update: (t: number) => void
  dispose: () => void
}

/** Screen aspect (w / h) per device; `null` = use the picture's own aspect. */
const SCREEN_ASPECT: Record<DeviceId, number | null> = {
  phone: 0.46,
  tablet: 0.75,
  laptop: 1.6,
  monitor: 1.78,
  tv: 1.78,
  frame: null,
  polaroid: 1,
  billboard: 2,
  portal: null,
}

const ENTER = 0.7
const POP = 1.1

interface PicPose {
  x: number
  y: number
  z: number
  rx: number
  ry: number
  rz: number
  scale: number
  /** 0..1 — how far along the breakout is (drives screen dimming) */
  out: number
}

/** How much the picture grows once it is fully out (1 = no growth). */
const GROW = 0.28

function pose(id: BreakoutMotionId, t: number, start: number, D: number, grow = GROW): PicPose {
  const p = window01(t, start, POP)
  const idle = Math.max(0, t - start - POP)
  const s: PicPose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1, out: p }
  // Shared idle motion once the picture is out: gentle hover + tilt.
  const hover = () => {
    s.y += Math.sin(idle * 1.4) * 0.025
    s.rx += Math.sin(idle * 1.1) * 0.035
    s.ry += Math.sin(idle * 0.8) * 0.06
  }
  switch (id) {
    case 'none':
      s.out = 0
      return s
    case 'pop': {
      const e = easeOutBack(p)
      s.z = D * e
      s.scale = 1 + grow * e
      s.rx = -0.1 * e
      s.ry = 0.14 * e
      s.y = 0.04 * e
      if (p >= 1) hover()
      break
    }
    case 'slideUp': {
      const a = easeInOutCubic(Math.min(1, p / 0.5)) // 0..0.5: rise out of the top
      const b = easeOutBack(Math.max(0, (p - 0.5) / 0.5)) // 0.5..1: come forward and down
      s.y = 1.15 * a - 1.12 * b
      s.z = D * b + 0.02 * a
      s.scale = 1 + grow * b
      s.rx = -0.1 * b
      s.ry = 0.12 * b
      if (p >= 1) hover()
      break
    }
    case 'flip': {
      const e = easeInOutCubic(p)
      s.z = D * easeOutCubic(p)
      s.ry = Math.PI * 2 * e
      s.scale = 1 + grow * easeOutCubic(p)
      s.rx = -0.08 * p
      if (p >= 1) hover()
      break
    }
    case 'peel': {
      // First lifts the top edge away from the screen, then floats forward.
      const lift = Math.sin(Math.min(1, p) * Math.PI)
      const e = easeOutCubic(p)
      s.rx = -0.75 * lift
      s.y = 0.45 * lift * 0.5 + 0.06 * e
      s.z = D * e + 0.3 * lift
      s.scale = 1 + grow * e
      s.ry = 0.12 * e
      if (p >= 1) hover()
      break
    }
    case 'zoom': {
      const e = easeOutQuint(p)
      const over = Math.sin(Math.min(1, p) * Math.PI) * 0.6 // fly past, then settle
      s.z = D * e + over
      s.scale = 1 + grow * e + over * 0.2
      s.rz = -0.06 * over
      if (p >= 1) hover()
      break
    }
  }
  return s
}

function material(color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), metalness: 0.5, roughness: 0.35, envMapIntensity: 1.2, ...extra })
}

function rounded(w: number, h: number, d: number, r: number, m: THREE.Material) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), m)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function box(w: number, h: number, d: number, m: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/** Crop a texture to cover the target aspect (like CSS object-fit: cover). */
function coverCrop(tex: THREE.Texture, imgAspect: number, targetAspect: number): THREE.Texture {
  const t = tex.clone()
  t.repeat.set(1, 1)
  t.offset.set(0, 0)
  if (imgAspect > targetAspect) {
    t.repeat.x = targetAspect / imgAspect
    t.offset.x = (1 - t.repeat.x) / 2
  } else if (imgAspect < targetAspect) {
    t.repeat.y = imgAspect / targetAspect
    t.offset.y = (1 - t.repeat.y) / 2
  }
  t.needsUpdate = true
  return t
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((n) => {
    const m = n as THREE.Mesh
    m.geometry?.dispose()
    const mm = m.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mm)) mm.forEach((x) => x.dispose())
    else mm?.dispose()
  })
}

/**
 * Build the device + picture rig for a layer. `textures` must already be
 * loaded. Returns an object 1 screen-height tall centred on the screen.
 */
export function buildBreakout(layer: PictureLayer, textures: PictureTextures): BreakoutBuilt {
  const root = new THREE.Group()
  const device = new THREE.Group()
  root.add(device)
  const aspect = SCREEN_ASPECT[layer.device] ?? textures.aspect
  const W = aspect // screen width (height = 1)
  const body = material(layer.frameColor)
  const dark = material('#0b0b0f', { metalness: 0.2, roughness: 0.6 })
  let bottomY = -0.5

  // --- device body ---------------------------------------------------------
  switch (layer.device) {
    case 'phone':
    case 'tablet': {
      const bezel = layer.device === 'phone' ? 0.035 : 0.06
      const depth = 0.06
      const b = rounded(W + bezel * 2, 1 + bezel * 2, depth, 0.05, body)
      b.position.z = -depth / 2
      device.add(b)
      const cam = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 12), dark)
      cam.position.set(0, 0.5 + bezel / 2, 0.002)
      device.add(cam)
      bottomY = -0.5 - bezel
      break
    }
    case 'laptop': {
      const bezel = 0.05
      const lid = rounded(W + bezel * 2, 1 + bezel * 2, 0.035, 0.02, body)
      lid.position.z = -0.0175
      device.add(lid)
      const base = rounded(W + bezel * 2 + 0.1, 0.035, 0.95, 0.015, body)
      base.position.set(0, -0.5 - bezel - 0.0175, 0.45)
      device.add(base)
      const keys = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.9, 0.5), dark)
      keys.rotation.x = -Math.PI / 2
      keys.position.set(0, -0.5 - bezel + 0.001, 0.32)
      device.add(keys)
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.22), material('#2a2a33', { metalness: 0.1, roughness: 0.5 }))
      pad.rotation.x = -Math.PI / 2
      pad.position.set(0, -0.5 - bezel + 0.001, 0.72)
      device.add(pad)
      bottomY = -0.5 - bezel - 0.035
      break
    }
    case 'monitor': {
      const bezel = 0.04
      const b = rounded(W + bezel * 2, 1 + bezel * 2, 0.05, 0.02, body)
      b.position.z = -0.025
      device.add(b)
      const neck = box(0.14, 0.32, 0.05, body)
      neck.position.set(0, -0.5 - bezel - 0.16, -0.05)
      device.add(neck)
      const foot = rounded(0.75, 0.03, 0.4, 0.012, body)
      foot.position.set(0, -0.5 - bezel - 0.33, 0.02)
      device.add(foot)
      bottomY = -0.5 - bezel - 0.345
      break
    }
    case 'tv': {
      const bezel = 0.022
      const b = rounded(W + bezel * 2, 1 + bezel * 2, 0.04, 0.012, body)
      b.position.z = -0.02
      device.add(b)
      for (const x of [-W * 0.38, W * 0.38]) {
        const leg = box(0.16, 0.05, 0.32, body)
        leg.position.set(x, -0.5 - bezel - 0.025, 0.05)
        device.add(leg)
      }
      bottomY = -0.5 - bezel - 0.05
      break
    }
    case 'frame': {
      const fw = 0.08
      const matte = 0.05
      const m = new THREE.Mesh(new THREE.PlaneGeometry(W + matte * 2, 1 + matte * 2), material('#f4f1ea', { metalness: 0, roughness: 0.9 }))
      m.position.z = -0.002
      m.receiveShadow = true
      device.add(m)
      const wood = material(layer.frameColor, { metalness: 0.15, roughness: 0.55 })
      const ow = W + matte * 2 + fw * 2
      const oh = 1 + matte * 2 + fw * 2
      const top = box(ow, fw, 0.06, wood)
      top.position.set(0, oh / 2 - fw / 2, 0.02)
      const bot = top.clone()
      bot.position.y = -oh / 2 + fw / 2
      const left = box(fw, oh, 0.06, wood)
      left.position.set(-ow / 2 + fw / 2, 0, 0.02)
      const right = left.clone()
      right.position.x = ow / 2 - fw / 2
      device.add(top, bot, left, right)
      bottomY = -oh / 2
      break
    }
    case 'polaroid': {
      const card = rounded(W + 0.1, 1.38, 0.012, 0.01, material('#fbfbf8', { metalness: 0, roughness: 0.8 }))
      card.position.set(0, -0.14, -0.007)
      device.add(card)
      bottomY = -0.14 - 0.69
      break
    }
    case 'billboard': {
      const b = rounded(W + 0.08, 1.08, 0.06, 0.01, body)
      b.position.z = -0.03
      device.add(b)
      for (const x of [-W * 0.35, W * 0.35]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.85, 16), material('#3a3a44'))
        post.position.set(x, -0.54 - 0.425, -0.03)
        post.castShadow = true
        device.add(post)
      }
      bottomY = -0.54 - 0.85
      break
    }
    case 'portal': {
      const glow = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.6, roughness: 0.4 })
      const th = 0.022
      const h = box(W + th * 2, th, th, glow)
      h.position.y = 0.5 + th / 2
      const h2 = h.clone()
      h2.position.y = -0.5 - th / 2
      const v = box(th, 1 + th * 2, th, glow)
      v.position.x = -W / 2 - th / 2
      const v2 = v.clone()
      v2.position.x = W / 2 + th / 2
      device.add(h, h2, v, v2)
      bottomY = -0.5 - th
      break
    }
  }

  // --- screen: the picture at rest -----------------------------------------
  const screenTex = SCREEN_ASPECT[layer.device] === null ? textures.picture : coverCrop(textures.picture, textures.aspect, aspect)
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false })
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(W, 1), screenMat)
  screen.position.z = 0.001
  device.add(screen)
  // Shadow catcher on top of the screen so the popped-out picture casts onto it.
  const screenShadow = new THREE.Mesh(new THREE.PlaneGeometry(W, 1), new THREE.ShadowMaterial({ opacity: 0.4, transparent: true }))
  screenShadow.position.z = 0.002
  screenShadow.receiveShadow = true
  device.add(screenShadow)
  // Glossy overlay for environment reflections on glass.
  if (!['frame', 'polaroid', 'portal', 'billboard'].includes(layer.device)) {
    const gloss = new THREE.Mesh(
      new THREE.PlaneGeometry(W, 1),
      new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.08, roughness: 0.05, metalness: 0.9, clearcoat: 1, envMapIntensity: 1.5 }),
    )
    gloss.position.z = 0.003
    device.add(gloss)
  }

  // --- the picture that comes out ------------------------------------------
  const pic = new THREE.Group()
  root.add(pic)
  const picMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, 1), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, side: THREE.DoubleSide }))
  picMesh.castShadow = true
  pic.add(picMesh)
  // Thin white edge so the flat picture reads as a physical card once it is out.
  const edge = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.03, 1 + 0.03), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, side: THREE.DoubleSide, transparent: true, opacity: 0 }))
  edge.position.z = -0.001
  pic.add(edge)
  const picShadow = new THREE.Mesh(new THREE.PlaneGeometry(W, 1), new THREE.ShadowMaterial({ opacity: 0.35, transparent: true }))
  picShadow.position.z = 0.001
  picShadow.receiveShadow = true
  pic.add(picShadow)

  let cut: THREE.Mesh | null = null
  if (textures.cutout) {
    const cutTex = SCREEN_ASPECT[layer.device] === null ? textures.cutout : coverCrop(textures.cutout, textures.aspect, aspect)
    cut = new THREE.Mesh(
      new THREE.PlaneGeometry(W, 1),
      new THREE.MeshBasicMaterial({ map: cutTex, toneMapped: false, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }),
    )
    cut.castShadow = true
    ;(cut as THREE.Mesh).customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: cutTex, alphaTest: 0.35 })
    root.add(cut)
  }

  const D = layer.popDistance

  const update = (t: number) => {
    // Device entrance
    const e = easeOutBack(window01(t, 0, ENTER))
    device.scale.setScalar(Math.max(0.0001, e))
    device.position.y = (1 - easeOutCubic(window01(t, 0, ENTER))) * -0.25
    device.visible = e > 0.001
    // Picture breakout
    const start = ENTER + layer.delay
    // With a cut-out subject, the full picture only nudges off the screen and
    // the subject does the real breakout — the classic "bursts out of the
    // frame" look.
    const s = cut ? pose(layer.motion, t, start, D * 0.18, 0.05) : pose(layer.motion, t, start, D)
    pic.visible = t >= 0 && device.visible && layer.motion !== 'none'
    if (layer.motion === 'none') {
      screenMat.color.setScalar(1)
    } else {
      pic.position.set(s.x, s.y, 0.004 + s.z)
      pic.rotation.set(s.rx, s.ry, s.rz)
      pic.scale.setScalar(s.scale * e)
      ;(edge.material as THREE.MeshBasicMaterial).opacity = Math.min(1, s.out * 1.5)
      // Dim the screen copy as the picture leaves it so the pop reads clearly.
      screenMat.color.setScalar(1 - 0.5 * s.out)
      if (cut) {
        const c = pose(layer.motion, t, start + 0.1, D, GROW + 0.12)
        cut.visible = pic.visible
        cut.position.set(c.x, c.y, 0.008 + c.z)
        cut.rotation.set(c.rx, c.ry, c.rz)
        cut.scale.setScalar(c.scale * e)
      }
    }
  }
  update(0)
  return {
    object: root,
    bottomY,
    update,
    dispose: () => {
      disposeTree(root)
      if (screenTex !== textures.picture) screenTex.dispose()
    },
  }
}
