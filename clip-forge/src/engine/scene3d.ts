import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import type { AnimationLayer } from '../types'
import { animById, type Built } from './animations'
import { motionAt } from './motions'

/**
 * Owns the WebGL canvas that renders the 3D animation layer with a transparent
 * background. The compositor draws this canvas over the 2D background.
 */
export class Scene3D {
  readonly canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private built: Built | null = null
  private builtKey = ''
  private holder = new THREE.Group()
  private width = 1080
  private height = 1920
  private shadowPlane: THREE.Mesh

  constructor() {
    this.canvas = document.createElement('canvas')
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
    this.camera.position.set(0, 0, 10)
    this.camera.lookAt(0, 0, 0)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()

    const hemi = new THREE.HemisphereLight(0xffffff, 0x334466, 0.6)
    this.scene.add(hemi)
    const key = new THREE.DirectionalLight(0xffffff, 2.2)
    key.position.set(2.5, 9, 6)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -6
    key.shadow.camera.right = 6
    key.shadow.camera.top = 6
    key.shadow.camera.bottom = -6
    key.shadow.bias = -0.0005
    this.scene.add(key)
    const rim = new THREE.DirectionalLight(0x9ec5ff, 1.4)
    rim.position.set(-5, 2, -4)
    this.scene.add(rim)

    // Catches a soft contact shadow under the object without drawing itself.
    this.shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.16 }))
    this.shadowPlane.receiveShadow = true
    this.shadowPlane.rotation.x = -Math.PI / 2
    this.scene.add(this.shadowPlane)

    this.scene.add(this.holder)
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

  /** Visible world height at z = 0 for the current camera. */
  private worldHeight(): number {
    return 2 * Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.position.z
  }

  private ensureBuilt(layer: AnimationLayer, font: Font) {
    const key = JSON.stringify([layer.kind, layer.text, layer.color, layer.color2, layer.metallic])
    if (key === this.builtKey && this.built) return
    if (this.built) {
      this.holder.remove(this.built.object)
      this.built.dispose()
    }
    this.built = animById(layer.kind).build(layer, font)
    this.holder.add(this.built.object)
    this.builtKey = key
  }

  render(layer: AnimationLayer, font: Font, t: number) {
    this.ensureBuilt(layer, font)
    const wh = this.worldHeight()
    const ww = wh * this.camera.aspect
    const size = layer.scale * wh
    const m = motionAt(layer.motion, t, layer.delay)
    const ax = (layer.x - 0.5) * ww
    const ay = (0.5 - layer.y) * wh
    this.holder.position.set(ax + m.x * size, ay + m.y * size, m.z * size)
    this.holder.rotation.set(m.rx, m.ry, m.rz)
    this.holder.scale.setScalar(Math.max(0.0001, m.scale * size))
    this.holder.visible = m.scale > 0.001
    this.shadowPlane.position.y = ay - size * 0.62
    this.shadowPlane.position.x = ax
    this.built?.update?.(Math.max(0, t - layer.delay))
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.built?.dispose()
    this.renderer.dispose()
  }
}
