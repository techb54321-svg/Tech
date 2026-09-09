import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import type { AnimationLayer, CameraMoveId, PictureLayer } from '../types'
import { animById, type Built } from './animations'
import { buildBreakout, type BreakoutBuilt, type PictureTextures } from './breakout'
import { motionAt } from './motions'

/** Camera distance. Farther + narrower FOV = the pop-out grows less wildly. */
const CAM_Z = 12

export interface PictureMedia {
  el?: HTMLImageElement | HTMLVideoElement
  cutout?: HTMLImageElement
}

/**
 * Owns the WebGL canvas that renders the 3D layers (breakout picture + optional
 * sticker) with a transparent background. The compositor draws it over the 2D
 * background.
 */
export class Scene3D {
  readonly canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private width = 1080
  private height = 1920

  // sticker
  private sticker: Built | null = null
  private stickerKey = ''
  private stickerHolder = new THREE.Group()

  // breakout picture
  private breakout: BreakoutBuilt | null = null
  private breakoutKey = ''
  private pictureHolder = new THREE.Group()
  private textures: PictureTextures | null = null
  private texturesKey = ''
  private placeholder: THREE.CanvasTexture | null = null

  private floor: THREE.Mesh

  constructor() {
    this.canvas = document.createElement('canvas')
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100)
    this.camera.position.set(0, 0, CAM_Z)
    this.camera.lookAt(0, 0, 0)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 0.7))
    const key = new THREE.DirectionalLight(0xffffff, 2.0)
    key.position.set(2.5, 6, 8)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -7
    key.shadow.camera.right = 7
    key.shadow.camera.top = 7
    key.shadow.camera.bottom = -7
    key.shadow.camera.near = 0.5
    key.shadow.camera.far = 30
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.02
    this.scene.add(key)
    const rim = new THREE.DirectionalLight(0x9ec5ff, 1.2)
    rim.position.set(-5, 2, -4)
    this.scene.add(rim)

    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.22 }))
    this.floor.receiveShadow = true
    this.floor.rotation.x = -Math.PI / 2
    this.scene.add(this.floor)

    this.scene.add(this.pictureHolder, this.stickerHolder)
  }

  setSize(w: number, h: number) {
    if (w === this.width && h === this.height && this.canvas.width === w) return
    this.width = w
    this.height = h
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  /** Visible world height at z = 0 for the default camera. */
  private worldHeight(): number {
    return 2 * Math.tan((this.camera.fov * Math.PI) / 360) * CAM_Z
  }

  // --- textures ------------------------------------------------------------

  private placeholderTexture(): THREE.CanvasTexture {
    if (this.placeholder) return this.placeholder
    const c = document.createElement('canvas')
    c.width = 900
    c.height = 1200
    const g = c.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, 900, 1200)
    grad.addColorStop(0, '#5b3df5')
    grad.addColorStop(1, '#ff4d6d')
    g.fillStyle = grad
    g.fillRect(0, 0, 900, 1200)
    // decorative rings
    g.strokeStyle = 'rgba(255,255,255,0.18)'
    g.lineWidth = 40
    for (let r = 120; r < 900; r += 160) {
      g.beginPath()
      g.arc(450, 560, r, 0, Math.PI * 2)
      g.stroke()
    }
    g.fillStyle = 'rgba(255,255,255,0.95)'
    g.textAlign = 'center'
    g.font = '900 150px "Inter", "Segoe UI", Arial, sans-serif'
    g.fillText('📸', 450, 520)
    g.font = '800 64px "Inter", "Segoe UI", Arial, sans-serif'
    g.fillText('YOUR PHOTO', 450, 660)
    g.font = '500 34px "Inter", "Segoe UI", Arial, sans-serif'
    g.fillText('Upload one in the Picture tab', 450, 720)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    this.placeholder = tex
    return tex
  }

  private ensureTextures(media: PictureMedia) {
    const key = `${media.el?.currentSrc ?? media.el?.src ?? 'placeholder'}|${media.cutout?.src ?? ''}`
    if (key === this.texturesKey && this.textures) return
    if (this.textures) {
      if (this.textures.picture !== this.placeholder) this.textures.picture.dispose()
      this.textures.cutout?.dispose()
    }
    let picture: THREE.Texture
    let aspect = 0.75
    const el = media.el
    if (el instanceof HTMLVideoElement && el.videoWidth > 0) {
      picture = new THREE.VideoTexture(el)
      aspect = el.videoWidth / el.videoHeight
    } else if (el instanceof HTMLImageElement && el.naturalWidth > 0) {
      picture = new THREE.Texture(el)
      picture.needsUpdate = true
      aspect = el.naturalWidth / el.naturalHeight
    } else {
      picture = this.placeholderTexture()
    }
    picture.colorSpace = THREE.SRGBColorSpace
    picture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
    let cutout: THREE.Texture | undefined
    if (media.cutout && media.cutout.naturalWidth > 0) {
      cutout = new THREE.Texture(media.cutout)
      cutout.colorSpace = THREE.SRGBColorSpace
      cutout.needsUpdate = true
    }
    this.textures = { picture, aspect, cutout }
    this.texturesKey = key
    this.breakoutKey = '' // force rebuild
  }

  private ensureBreakout(layer: PictureLayer) {
    const key = JSON.stringify([layer.device, layer.motion, layer.popDistance, layer.delay, layer.frameColor, this.texturesKey])
    if (key === this.breakoutKey && this.breakout) return
    if (this.breakout) {
      this.pictureHolder.remove(this.breakout.object)
      this.breakout.dispose()
    }
    this.breakout = buildBreakout(layer, this.textures!)
    this.pictureHolder.add(this.breakout.object)
    this.breakoutKey = key
  }

  private ensureSticker(layer: AnimationLayer, font: Font) {
    const key = JSON.stringify([layer.kind, layer.text, layer.color, layer.color2, layer.metallic])
    if (key === this.stickerKey && this.sticker) return
    if (this.sticker) {
      this.stickerHolder.remove(this.sticker.object)
      this.sticker.dispose()
    }
    this.sticker = animById(layer.kind).build(layer, font)
    this.stickerHolder.add(this.sticker.object)
    this.stickerKey = key
  }

  private moveCamera(move: CameraMoveId, t: number, lookX: number, lookY: number) {
    let x = 0
    let y = 0
    let z = CAM_Z
    switch (move) {
      case 'orbit':
        x = Math.sin(t * 0.35) * 1.6
        y = 0.4 + Math.sin(t * 0.5) * 0.3
        break
      case 'dolly':
        z = CAM_Z + 1 - Math.min(1, t / 8) * 1.8
        y = 0.2
        break
      case 'handheld':
        x = Math.sin(t * 1.7) * 0.15 + Math.sin(t * 0.9) * 0.25
        y = Math.cos(t * 1.3) * 0.12 + Math.sin(t * 0.6) * 0.18
        z = CAM_Z + Math.sin(t * 0.4) * 0.25
        break
      case 'still':
        break
    }
    this.camera.position.set(lookX + x, lookY + y, z)
    this.camera.lookAt(lookX, lookY, 0)
  }

  render(picture: PictureLayer, media: PictureMedia, sticker: AnimationLayer, font: Font, t: number) {
    const wh = this.worldHeight()
    const ww = wh * this.camera.aspect

    // --- breakout picture ---
    this.ensureTextures(media)
    this.ensureBreakout(picture)
    const size = picture.scale * wh
    const ax = (picture.x - 0.5) * ww
    const ay = (0.5 - picture.y) * wh
    this.pictureHolder.position.set(ax, ay, 0)
    this.pictureHolder.scale.setScalar(size)
    this.breakout!.update(t)
    this.floor.position.set(ax, ay + this.breakout!.bottomY * size - 0.01, 0)
    this.moveCamera(picture.camera, t, ax, ay)

    // --- sticker ---
    this.stickerHolder.visible = sticker.enabled
    if (sticker.enabled) {
      this.ensureSticker(sticker, font)
      const ssize = sticker.scale * wh
      const m = motionAt(sticker.motion, t, sticker.delay)
      const sx = (sticker.x - 0.5) * ww
      const sy = (0.5 - sticker.y) * wh
      this.stickerHolder.position.set(sx + m.x * ssize, sy + m.y * ssize, 1.5 + m.z * ssize)
      this.stickerHolder.rotation.set(m.rx, m.ry, m.rz)
      this.stickerHolder.scale.setScalar(Math.max(0.0001, m.scale * ssize))
      this.stickerHolder.visible = m.scale > 0.001
      this.sticker?.update?.(Math.max(0, t - sticker.delay))
    }

    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.breakout?.dispose()
    this.sticker?.dispose()
    this.placeholder?.dispose()
    this.renderer.dispose()
  }
}
