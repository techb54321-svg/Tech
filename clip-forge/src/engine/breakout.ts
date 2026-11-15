import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { BreakoutMotionId, DeviceId, PictureLayer } from '../types'
import { easeInOutCubic, easeOutBack, easeOutCubic, easeOutQuint, window01 } from './easing'

// ---------------------------------------------------------------------------
// The breakout rig: a device with the picture on its screen, and the subject
// that leaves that screen and comes at the camera.
//
// Built in "screen units": the screen is centred on the origin in the XY
// plane, faces +Z and is exactly 1 unit tall. The renderer scales the whole
// group to the size the user picked.
//
// The subject is not a plane. Its alpha silhouette is inflated along a
// spherical-cap height map into a front and back shell, so it has real volume,
// takes real light through a derived normal map, and casts a real shadow back
// onto the screen it came out of. At rest the inflation is zero and the
// subject sits exactly on top of the on-screen picture, so the moment it
// starts to lift is seamless.
// ---------------------------------------------------------------------------

export interface CutoutCanvases {
  color: HTMLCanvasElement
  height: HTMLCanvasElement
  normal: HTMLCanvasElement
}

export interface PictureTextures {
  /** Full picture (image or video) shown on the screen */
  picture: THREE.Texture
  /** Picture aspect ratio (w / h) */
  aspect: number
  /** Subject cut-out + relief maps, when one could be produced */
  cutout?: CutoutCanvases
}

export interface BreakoutBuilt {
  object: THREE.Object3D
  /** Lowest point of the device, in screen units, for floor placement */
  bottomY: number
  /** Outer half-width / half-height of the device front face */
  outerW: number
  outerH: number
  /** 0..1 — how far the subject has left the screen, for the screen light */
  progress: number
  /**
   * The subject is the *whole* picture, so it hangs past the screen edges.
   * These planes hide the overhang until it starts to emerge; the scene
   * pushes them outwards as `clipRelease` grows.
   */
  clipPlanes: THREE.Plane[]
  clipRelease: number
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
const POP = 1.15
/** Subject mesh resolution. Higher = smoother inflation silhouette. */
const SEG = 144

interface PicPose {
  x: number
  y: number
  z: number
  rx: number
  ry: number
  rz: number
  scale: number
  /** 0..1 — how far along the breakout is */
  out: number
}

function pose(id: BreakoutMotionId, t: number, start: number, D: number, grow: number): PicPose {
  const p = window01(t, start, POP)
  const idle = Math.max(0, t - start - POP)
  const s: PicPose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1, out: p }
  // Once it is out, keep it alive: a slow hover and turn so the viewer reads
  // the volume from changing highlights rather than a frozen cut-out.
  const hover = () => {
    s.y += Math.sin(idle * 1.25) * 0.022
    s.z += Math.sin(idle * 0.9) * 0.02
    s.rx += Math.sin(idle * 1.0) * 0.035
    s.ry += Math.sin(idle * 0.72) * 0.07
    s.rz += Math.cos(idle * 0.85) * 0.015
  }
  switch (id) {
    case 'none':
      s.out = 0
      return s
    case 'pop': {
      const e = easeOutBack(p)
      s.z = D * e
      s.scale = 1 + grow * e
      s.y = 0.12 * e
      s.rx = -0.2 * e
      s.ry = 0.22 * e
      if (p >= 1) hover()
      break
    }
    case 'slideUp': {
      const a = easeInOutCubic(Math.min(1, p / 0.45)) // rise out of the top
      const b = easeOutBack(Math.max(0, (p - 0.45) / 0.55)) // then come forward
      s.y = 0.85 * a - 0.72 * b
      s.z = D * b + 0.06 * a
      s.scale = 1 + grow * b
      s.rx = -0.18 * b
      s.ry = 0.16 * b
      if (p >= 1) hover()
      break
    }
    case 'flip': {
      const e = easeOutCubic(p)
      s.z = D * e
      s.ry = Math.PI * 2 * easeInOutCubic(p)
      s.scale = 1 + grow * e
      s.y = 0.1 * e
      s.rx = -0.16 * e
      if (p >= 1) hover()
      break
    }
    case 'peel': {
      // The top edge lifts off the glass first, then the whole body floats out.
      const lift = Math.sin(Math.min(1, p) * Math.PI)
      const e = easeOutCubic(p)
      s.rx = -0.85 * lift - 0.12 * e
      s.y = 0.3 * lift + 0.08 * e
      s.z = D * e + 0.25 * lift
      s.scale = 1 + grow * e
      s.ry = 0.14 * e
      if (p >= 1) hover()
      break
    }
    case 'zoom': {
      const e = easeOutQuint(p)
      const over = Math.sin(Math.min(1, p) * Math.PI) * 0.75 // fly past, settle back
      s.z = D * e + over
      s.scale = 1 + grow * e + over * 0.12
      s.y = 0.08 * e
      s.rx = -0.1 * e
      s.rz = -0.05 * over
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

/**
 * When a subject will pop out, the screen must show the whole picture — a
 * centre crop would hide half the subject at rest and then reveal it out of
 * nowhere. Fit the picture inside the screen and fill the leftover with a
 * blurred, darkened copy of itself, the way social apps pillar-box a photo.
 */
function containScreenCanvas(img: CanvasImageSource, imgW: number, imgH: number, aspect: number, fit: { w: number; h: number }) {
  const H = 1200
  const c = document.createElement('canvas')
  c.height = H
  c.width = Math.max(1, Math.round(H * aspect))
  const ctx = c.getContext('2d')!
  // blurred cover fill
  const cover = Math.max(c.width / imgW, c.height / imgH) * 1.15
  ctx.filter = `blur(${Math.round(H * 0.05)}px)`
  ctx.drawImage(img, (c.width - imgW * cover) / 2, (c.height - imgH * cover) / 2, imgW * cover, imgH * cover)
  ctx.filter = 'none'
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.fillRect(0, 0, c.width, c.height)
  // the picture itself, contained
  const dw = (fit.w / aspect) * c.width
  const dh = fit.h * c.height
  ctx.drawImage(img, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh)
  return c
}

/** Size of the picture when fitted inside a W x 1 screen. */
function containFit(pa: number, W: number) {
  return pa > W ? { w: W, h: W / pa } : { w: pa, h: 1 }
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
 * Build the device + subject rig. `textures` must already be loaded. Returns
 * an object 1 screen-height tall, centred on the screen.
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
  let outerW = W
  let outerH = 1

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
      outerW = W + bezel * 2
      outerH = 1 + bezel * 2
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
      outerW = W + bezel * 2
      outerH = 1 + bezel * 2
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
      outerW = W + bezel * 2
      outerH = 1 + bezel * 2
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
      outerW = W + bezel * 2
      outerH = 1 + bezel * 2
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
      outerW = ow
      outerH = oh
      break
    }
    case 'polaroid': {
      const card = rounded(W + 0.1, 1.38, 0.012, 0.01, material('#fbfbf8', { metalness: 0, roughness: 0.8 }))
      card.position.set(0, -0.14, -0.007)
      device.add(card)
      bottomY = -0.14 - 0.69
      outerW = W + 0.1
      outerH = 1.38
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
      outerW = W + 0.08
      outerH = 1.08
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
      outerW = W + th * 2
      outerH = 1 + th * 2
      break
    }
  }

  // --- the screen: the picture at rest -------------------------------------
  const cutSrc = textures.cutout?.color
  const stillImage = textures.picture.image as HTMLImageElement | HTMLCanvasElement | undefined
  const imgW = stillImage ? (stillImage as HTMLImageElement).naturalWidth || stillImage.width : 0
  const imgH = stillImage ? (stillImage as HTMLImageElement).naturalHeight || stillImage.height : 0
  const fit = containFit(textures.aspect, W)
  const containable = !!cutSrc && !!stillImage && imgW > 0 && imgH > 0 && Math.abs(textures.aspect - aspect) > 0.01
  let ownedScreen: THREE.Texture | null = null
  let screenTex: THREE.Texture
  if (containable) {
    const c = containScreenCanvas(stillImage!, imgW, imgH, aspect, fit)
    ownedScreen = new THREE.CanvasTexture(c)
    ownedScreen.colorSpace = THREE.SRGBColorSpace
    screenTex = ownedScreen
  } else {
    screenTex = SCREEN_ASPECT[layer.device] === null ? textures.picture : coverCrop(textures.picture, textures.aspect, aspect)
  }
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false })
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(W, 1), screenMat)
  screen.position.z = 0.001
  device.add(screen)
  // Catches the subject's shadow across the whole device front, screen and
  // bezel alike — this is the single strongest cue that the subject is really
  // hovering in front of the device.
  const frontShadow = new THREE.Mesh(new THREE.PlaneGeometry(outerW * 1.02, outerH * 1.02), new THREE.ShadowMaterial({ opacity: 0.38, transparent: true }))
  frontShadow.position.z = 0.0025
  frontShadow.receiveShadow = true
  device.add(frontShadow)
  // Glossy overlay for environment reflections on glass.
  if (!['frame', 'polaroid', 'portal', 'billboard'].includes(layer.device)) {
    const gloss = new THREE.Mesh(
      new THREE.PlaneGeometry(W, 1),
      new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.07, roughness: 0.05, metalness: 0.9, clearcoat: 1, envMapIntensity: 1.5 }),
    )
    gloss.position.z = 0.004
    device.add(gloss)
  }

  // --- what comes out ------------------------------------------------------
  const emerging = new THREE.Group()
  root.add(emerging)
  const ownedTextures: THREE.Texture[] = []
  // Right, left, top, bottom. Constants are filled in per frame by the scene,
  // which knows where the screen ends up in world space.
  const clipPlanes = [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1),
    new THREE.Plane(new THREE.Vector3(1, 0, 0), 1),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 1),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), 1),
  ]

  let setInflate: (p: number) => void = () => undefined
  const hasSubject = !!textures.cutout

  if (textures.cutout) {
    // The subject is the whole picture, not the part the screen crops to: a
    // wide product on a tall phone has to be able to hang past the bezel once
    // it is out. Size the plane so the region the screen shows lines up
    // exactly with the screen, and let the rest overhang.
    // Contained on screen: the subject is exactly the picture the viewer can
    // already see. Cover-cropped: the subject is the full picture, which hangs
    // past the bezel once the clip releases.
    const pa = textures.aspect
    const subW = containable ? fit.w : pa >= aspect ? pa : aspect
    const subH = containable ? fit.h : pa >= aspect ? 1 : aspect / pa

    const colorTex = new THREE.CanvasTexture(textures.cutout.color)
    colorTex.colorSpace = THREE.SRGBColorSpace
    const heightTex = new THREE.CanvasTexture(textures.cutout.height)
    const normalTex = new THREE.CanvasTexture(textures.cutout.normal)
    ownedTextures.push(colorTex, heightTex, normalTex)

    const geo = new THREE.PlaneGeometry(subW, subH, SEG, SEG)
    const frontMat = new THREE.MeshStandardMaterial({
      map: colorTex,
      alphaTest: 0.5,
      roughness: 0.72,
      metalness: 0,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0, 0),
      displacementMap: heightTex,
      displacementScale: 0,
      // At rest the subject is pure emissive, i.e. an exact unlit copy of the
      // screen pixels. As it inflates, lighting fades in and emissive fades
      // down, so the same pixels gain real form without changing brightness.
      emissiveMap: colorTex,
      emissive: new THREE.Color(1, 1, 1),
      emissiveIntensity: 1,
      color: new THREE.Color(0, 0, 0),
      envMapIntensity: 0.45,
      clippingPlanes: clipPlanes,
    })
    const front = new THREE.Mesh(geo, frontMat)
    front.castShadow = true
    front.receiveShadow = true
    front.frustumCulled = false // displacement pushes verts past the bounds
    const depthMat = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: colorTex,
      alphaTest: 0.5,
      displacementMap: heightTex,
      displacementScale: 0,
    })
    depthMat.clippingPlanes = clipPlanes
    front.customDepthMaterial = depthMat
    emerging.add(front)

    const backMat = frontMat.clone()
    backMat.side = THREE.BackSide
    backMat.displacementScale = 0
    backMat.envMapIntensity = 0.25
    const back = new THREE.Mesh(geo, backMat)
    back.castShadow = false
    back.frustumCulled = false
    back.visible = false
    emerging.add(back)

    const thickness = 0.12 + layer.depth * 0.5
    setInflate = (p: number) => {
      const e = Math.min(1, Math.max(0, p))
      frontMat.displacementScale = thickness * e
      frontMat.normalScale.set(e, e)
      frontMat.color.setScalar(0.6 * e)
      frontMat.emissiveIntensity = 1 - 0.52 * e
      depthMat.displacementScale = thickness * e
      backMat.displacementScale = -thickness * 0.55 * e
      backMat.normalScale.set(e, e)
      backMat.color.setScalar(0.3 * e)
      backMat.emissiveIntensity = (1 - 0.52 * e) * 0.45
      back.visible = e > 0.03
    }
    setInflate(0)
  } else {
    // No subject mask (a video, or segmentation declined): the whole picture
    // leaves the screen as a physical print with real thickness.
    const t = 0.016
    const paper = new THREE.MeshStandardMaterial({ color: '#f7f7f4', roughness: 0.85, metalness: 0 })
    const face = new THREE.MeshStandardMaterial({
      map: screenTex,
      roughness: 0.62,
      metalness: 0,
      emissiveMap: screenTex,
      emissive: new THREE.Color(1, 1, 1),
      emissiveIntensity: 1,
      color: new THREE.Color(0, 0, 0),
    })
    const cardGeo = new THREE.BoxGeometry(W, 1, t)
    const card = new THREE.Mesh(cardGeo, [paper, paper, paper, paper, face, paper])
    card.castShadow = true
    card.receiveShadow = true
    card.position.z = t / 2
    emerging.add(card)
    setInflate = (p: number) => {
      const e = Math.min(1, Math.max(0, p))
      face.color.setScalar(0.62 * e)
      face.emissiveIntensity = 1 - 0.5 * e
    }
    setInflate(0)
  }

  const D = layer.popDistance
  // A cut-out subject already reads as 3D, so it needs less scaling; a flat
  // card leans on growth to sell the approach.
  const GROW = hasSubject ? 0.16 : 0.3
  const built: BreakoutBuilt = {
    object: root,
    bottomY,
    outerW,
    outerH,
    progress: 0,
    clipPlanes,
    clipRelease: 0,
    update: () => undefined,
    dispose: () => {
      disposeTree(root)
      ownedTextures.forEach((t) => t.dispose())
      if (screenTex !== textures.picture) screenTex.dispose()
      ownedScreen?.dispose()
    },
  }

  built.update = (t: number) => {
    const enter = window01(t, 0, ENTER)
    const e = easeOutBack(enter)
    device.scale.setScalar(Math.max(0.0001, e))
    device.position.y = (1 - easeOutCubic(enter)) * -0.25
    device.visible = e > 0.001

    const start = ENTER + layer.delay
    const s = pose(layer.motion, t, start, D, GROW)
    built.progress = s.out
    built.clipRelease = Math.min(1, s.out / 0.16)
    emerging.visible = device.visible && layer.motion !== 'none'
    if (!emerging.visible) {
      screenMat.color.setScalar(1)
      return
    }
    emerging.position.set(s.x, s.y, 0.005 + s.z)
    emerging.rotation.set(s.rx, s.ry, s.rz)
    emerging.scale.setScalar(s.scale * e)
    setInflate(s.out)
    // Fade the copy left behind on the screen so the eye follows the one that
    // left. A cut-out only removes the subject, so the fade is gentler.
    screenMat.color.setScalar(1 - (hasSubject ? 0.28 : 0.55) * s.out)
  }
  built.update(0)
  return built
}
