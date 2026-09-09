import * as THREE from 'three'
import { FontLoader, type Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import type { AnimationLayer } from '../types'

// ---------------------------------------------------------------------------
// The animation library. Every entry builds a THREE.Object3D from simple
// procedural geometry so the app needs no downloaded models. Objects are
// normalised to fit a 1×1×1 box centred on the origin; the renderer scales
// them to the user's chosen size.
// ---------------------------------------------------------------------------

export interface Built {
  object: THREE.Object3D
  /** Optional per-frame hook for internal animation (waving, particles …) */
  update?: (t: number) => void
  dispose: () => void
}

export interface AnimDef {
  id: string
  label: string
  emoji: string
  /** Uses the `text` field of the animation layer */
  usesText?: boolean
  build: (o: AnimationLayer, font: Font) => Built
}

type Mat = THREE.MeshStandardMaterial

function mat(color: string, metallic: boolean, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): Mat {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness: metallic ? 0.55 : 0.05,
    roughness: metallic ? 0.28 : 0.55,
    envMapIntensity: metallic ? 1.4 : 0.8,
    ...extra,
  })
}

const BEVEL = { bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 4, curveSegments: 16 }

/** Scale + centre an object so its bounding box fits in a unit cube. */
function normalise(obj: THREE.Object3D, fill = 1): THREE.Object3D {
  const box = new THREE.Box3().setFromObject(obj)
  const size = new THREE.Vector3()
  const centre = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(centre)
  const s = fill / Math.max(size.x, size.y, 1e-6)
  const wrapper = new THREE.Group()
  obj.position.sub(centre).multiplyScalar(s)
  obj.scale.multiplyScalar(s)
  wrapper.add(obj)
  return wrapper
}

function disposer(root: THREE.Object3D) {
  return () => {
    root.traverse((n) => {
      const m = n as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
      const mm = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mm)) mm.forEach((x) => x.dispose())
      else mm?.dispose()
    })
  }
}

function extrude(shape: THREE.Shape | THREE.Shape[], depth: number, m: THREE.Material): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, ...BEVEL })
  geo.center()
  const mesh = new THREE.Mesh(geo, m)
  mesh.castShadow = true
  return mesh
}

function shadowed(mesh: THREE.Mesh) {
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function starShape(points = 5, outer = 1, inner = 0.48): THREE.Shape {
  const s = new THREE.Shape()
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) s.moveTo(x, y)
    else s.lineTo(x, y)
  }
  s.closePath()
  return s
}

function heartShape(): THREE.Shape {
  const s = new THREE.Shape()
  const x = 0
  const y = 0
  s.moveTo(x, y + 0.5)
  s.bezierCurveTo(x, y + 0.5, x - 0.1, y + 1, x - 0.6, y + 1)
  s.bezierCurveTo(x - 1.3, y + 1, x - 1.3, y + 0.2, x - 1.3, y + 0.2)
  s.bezierCurveTo(x - 1.3, y - 0.3, x - 0.8, y - 0.85, x, y - 1.3)
  s.bezierCurveTo(x + 0.8, y - 0.85, x + 1.3, y - 0.3, x + 1.3, y + 0.2)
  s.bezierCurveTo(x + 1.3, y + 0.2, x + 1.3, y + 1, x + 0.6, y + 1)
  s.bezierCurveTo(x + 0.1, y + 1, x, y + 0.5, x, y + 0.5)
  return s
}

function boltShape(): THREE.Shape {
  const s = new THREE.Shape()
  const pts: [number, number][] = [
    [0.15, 1],
    [-0.55, -0.05],
    [-0.05, -0.05],
    [-0.35, -1],
    [0.55, 0.15],
    [0.05, 0.15],
    [0.3, 1],
  ]
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)))
  s.closePath()
  return s
}

function checkShape(): THREE.Shape {
  const s = new THREE.Shape()
  const pts: [number, number][] = [
    [-1, 0.05],
    [-0.65, 0.4],
    [-0.28, 0.02],
    [0.62, 0.95],
    [1, 0.6],
    [-0.28, -0.7],
  ]
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)))
  s.closePath()
  return s
}

function arrowShape(): THREE.Shape {
  const s = new THREE.Shape()
  const pts: [number, number][] = [
    [-1, 0.3],
    [0.2, 0.3],
    [0.2, 0.75],
    [1, 0],
    [0.2, -0.75],
    [0.2, -0.3],
    [-1, -0.3],
  ]
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)))
  s.closePath()
  return s
}

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

function text3d(text: string, font: Font, m: THREE.Material, size = 1, depth = 0.35): THREE.Group {
  const g = new THREE.Group()
  const lines = text.split('\n')
  const lineH = size * 1.25
  lines.forEach((line, i) => {
    if (!line.trim()) return
    const geo = new TextGeometry(line, {
      font,
      size,
      depth,
      bevelEnabled: true,
      bevelThickness: size * 0.04,
      bevelSize: size * 0.025,
      bevelSegments: 3,
      curveSegments: 10,
    })
    geo.computeBoundingBox()
    const bb = geo.boundingBox!
    geo.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, -(bb.max.z + bb.min.z) / 2)
    const mesh = shadowed(new THREE.Mesh(geo, m))
    mesh.position.y = ((lines.length - 1) / 2 - i) * lineH
    g.add(mesh)
  })
  return g
}

// --- library -----------------------------------------------------------------

export const ANIMATIONS: AnimDef[] = [
  {
    id: 'text3d',
    label: '3D headline',
    emoji: '🔤',
    usesText: true,
    build: (o, font) => {
      const g = new THREE.Group()
      const front = mat(o.color, o.metallic)
      const side = mat(o.color2, o.metallic, { roughness: 0.4 })
      g.add(text3d(o.text || 'WOW', font, [front, side] as unknown as THREE.Material))
      const obj = normalise(g)
      return { object: obj, dispose: disposer(obj) }
    },
  },
  {
    id: 'star',
    label: 'Star',
    emoji: '⭐',
    build: (o) => {
      const g = new THREE.Group()
      g.add(extrude(starShape(), 0.35, mat(o.color, o.metallic)))
      const obj = normalise(g)
      return { object: obj, dispose: disposer(obj) }
    },
  },
  {
    id: 'heart',
    label: 'Heart',
    emoji: '❤️',
    build: (o) => {
      const g = new THREE.Group()
      g.add(extrude(heartShape(), 0.6, mat(o.color, o.metallic, { roughness: 0.25 })))
      const obj = normalise(g)
      return { object: obj, dispose: disposer(obj) }
    },
  },
  {
    id: 'bolt',
    label: 'Lightning',
    emoji: '⚡',
    build: (o) => {
      const g = new THREE.Group()
      g.add(extrude(boltShape(), 0.3, mat(o.color, o.metallic, { emissive: new THREE.Color(o.color), emissiveIntensity: 0.25 })))
      const obj = normalise(g)
      return { object: obj, dispose: disposer(obj) }
    },
  },
  {
    id: 'check',
    label: 'Checkmark',
    emoji: '✅',
    build: (o) => {
      const g = new THREE.Group()
      const disc = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.25, 48), mat(o.color2, o.metallic)))
      disc.rotation.x = Math.PI / 2
      g.add(disc)
      const c = extrude(checkShape(), 0.25, mat(o.color, o.metallic))
      c.position.z = 0.22
      g.add(c)
      const obj = normalise(g)
      return { object: obj, dispose: disposer(obj) }
    },
  },
  {
    id: 'arrow',
    label: 'Arrow',
    emoji: '➡️',
    build: (o) => {
      const g = new THREE.Group()
      g.add(extrude(arrowShape(), 0.35, mat(o.color, o.metallic)))
      const obj = normalise(g)
      return { object: obj, dispose: disposer(obj) }
    },
  },
  {
    id: 'rocket',
    label: 'Rocket',
    emoji: '🚀',
    build: (o) => {
      const g = new THREE.Group()
      const body = mat(o.color, o.metallic, { roughness: 0.3 })
      const accent = mat(o.color2, o.metallic)
      g.add(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 1.6, 32), body)))
      const nose = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.8, 32), accent))
      nose.position.y = 1.2
      g.add(nose)
      const win = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), mat('#7ef9ff', true, { roughness: 0.1 })))
      win.position.set(0, 0.35, 0.42)
      g.add(win)
      const ring = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 12, 32), accent))
      ring.position.set(0, 0.35, 0.36)
      g.add(ring)
      for (let i = 0; i < 3; i++) {
        const fin = extrude(arrowShape(), 0.08, accent)
        fin.scale.set(0.35, 0.45, 1)
        fin.rotation.y = (i / 3) * Math.PI * 2
        fin.rotation.z = -Math.PI / 2 - 0.4
        fin.position.set(Math.sin((i / 3) * Math.PI * 2) * 0.55, -0.75, Math.cos((i / 3) * Math.PI * 2) * 0.55)
        g.add(fin)
      }
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.32, 0.9, 24),
        new THREE.MeshStandardMaterial({ color: '#ffb400', emissive: '#ff5a00', emissiveIntensity: 1.6, roughness: 1 }),
      )
      flame.rotation.x = Math.PI
      flame.position.y = -1.2
      g.add(flame)
      const obj = normalise(g)
      return {
        object: obj,
        update: (t) => {
          flame.scale.set(1 + Math.sin(t * 40) * 0.15, 1 + Math.sin(t * 27) * 0.25, 1 + Math.cos(t * 33) * 0.15)
        },
        dispose: disposer(obj),
      }
    },
  },
  {
    id: 'gift',
    label: 'Gift box',
    emoji: '🎁',
    build: (o) => {
      const g = new THREE.Group()
      const box = mat(o.color, o.metallic, { roughness: 0.45 })
      const ribbon = mat(o.color2, o.metallic)
      g.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.4), box)))
      const lid = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.3, 1.55), box))
      lid.position.y = 0.7
      g.add(lid)
      const r1 = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.45, 0.3), ribbon))
      r1.position.y = 0.05
      const r2 = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.45, 1.6), ribbon))
      r2.position.y = 0.05
      g.add(r1, r2)
      for (const rz of [-0.9, 0.9]) {
        const loop = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.09, 12, 24), ribbon))
        loop.position.set(Math.sin(rz) * 0.3, 1.05, 0)
        loop.rotation.z = rz
        g.add(loop)
      }
      const obj = normalise(g)
      return { object: obj, dispose: disposer(obj) }
    },
  },
  {
    id: 'megaphone',
    label: 'Megaphone',
    emoji: '📣',
    build: (o) => {
      const g = new THREE.Group()
      const horn = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1, 0.35, 1.6, 40, 1, true), mat(o.color, o.metallic, { side: THREE.DoubleSide })))
      horn.rotation.z = -Math.PI / 2
      g.add(horn)
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.34, 1.6, 40, 1, true), mat('#3a1a06', false, { side: THREE.BackSide }))
      inner.rotation.z = -Math.PI / 2
      g.add(inner)
      const back = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 32), mat(o.color2, o.metallic)))
      back.rotation.z = -Math.PI / 2
      back.position.x = -1.1
      g.add(back)
      const handle = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), mat(o.color2, o.metallic)))
      handle.position.set(-1, -0.7, 0)
      g.add(handle)
      // sound waves
      const waves = new THREE.Group()
      for (let i = 0; i < 3; i++) {
        const w = new THREE.Mesh(
          new THREE.TorusGeometry(0.35 + i * 0.35, 0.05, 8, 40, Math.PI * 0.6),
          new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.5 }),
        )
        w.rotation.z = -Math.PI * 0.3
        w.position.x = 1.0
        waves.add(w)
      }
      g.add(waves)
      const obj = normalise(g)
      return {
        object: obj,
        update: (t) => waves.children.forEach((c, i) => ((c as THREE.Mesh).material as Mat).opacity = 0.5 + Math.sin(t * 6 - i) * 0.5),
        dispose: disposer(obj),
      }
    },
  },
  {
    id: 'coin',
    label: 'Coin',
    emoji: '🪙',
    usesText: true,
    build: (o, font) => {
      const g = new THREE.Group()
      const gold = mat(o.color, true, { roughness: 0.22, metalness: 0.85 })
      const rim = mat(o.color2, true, { roughness: 0.3, metalness: 0.85 })
      const c = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.22, 64), rim))
      c.rotation.x = Math.PI / 2
      g.add(c)
      const face = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.26, 64), gold))
      face.rotation.x = Math.PI / 2
      g.add(face)
      const label = (o.text || '$').slice(0, 3)
      for (const dir of [1, -1]) {
        const tx = text3d(label, font, rim, 0.75, 0.1)
        tx.position.z = dir * 0.16
        if (dir < 0) tx.rotation.y = Math.PI
        g.add(tx)
      }
      const obj = normalise(g)
      return { object: obj, dispose: disposer(obj) }
    },
  },
  {
    id: 'trophy',
    label: 'Trophy',
    emoji: '🏆',
    build: (o) => {
      const g = new THREE.Group()
      const gold = mat(o.color, true, { roughness: 0.25, metalness: 0.8 })
      const base = mat(o.color2, o.metallic)
      const pts: THREE.Vector2[] = []
      for (let i = 0; i <= 12; i++) {
        const y = i / 12
        pts.push(new THREE.Vector2(0.35 + Math.pow(y, 0.6) * 0.65, y * 1.4))
      }
      const cup = shadowed(new THREE.Mesh(new THREE.LatheGeometry(pts, 48), gold))
      cup.material = mat(o.color, true, { roughness: 0.25, metalness: 0.8, side: THREE.DoubleSide })
      cup.position.y = -0.2
      g.add(cup)
      const stem = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 0.6, 24), gold))
      stem.position.y = -0.5
      g.add(stem)
      const foot = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.25, 32), base))
      foot.position.y = -0.9
      g.add(foot)
      for (const s of [-1, 1]) {
        const h = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 12, 32, Math.PI), gold))
        h.position.set(s * 0.95, 0.55, 0)
        h.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2
        g.add(h)
      }
      const obj = normalise(g)
      return { object: obj, dispose: disposer(obj) }
    },
  },
  {
    id: 'pin',
    label: 'Location pin',
    emoji: '📍',
    build: (o) => {
      const g = new THREE.Group()
      const body = mat(o.color, o.metallic)
      const head = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.8, 40, 40), body))
      head.position.y = 0.5
      g.add(head)
      const tip = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.78, 1.5, 40), body))
      tip.rotation.x = Math.PI
      tip.position.y = -0.45
      g.add(tip)
      const dot = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 24), mat(o.color2, o.metallic)))
      dot.position.set(0, 0.5, 0.6)
      g.add(dot)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 8, 48), mat(o.color2, false, { transparent: true, opacity: 0.7 }))
      ring.rotation.x = Math.PI / 2
      ring.position.y = -1.25
      g.add(ring)
      const obj = normalise(g)
      return {
        object: obj,
        update: (t) => {
          const p = (t * 0.8) % 1
          ring.scale.setScalar(0.4 + p * 1.2)
          ;(ring.material as Mat).opacity = (1 - p) * 0.8
        },
        dispose: disposer(obj),
      }
    },
  },
  {
    id: 'house',
    label: 'House',
    emoji: '🏠',
    build: (o) => {
      const g = new THREE.Group()
      const wall = mat(o.color, false, { roughness: 0.7 })
      const roof = mat(o.color2, o.metallic, { roughness: 0.5 })
      g.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.3), wall)))
      const rf = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0, 1.15, 0.75, 4), roof))
      rf.rotation.y = Math.PI / 4
      rf.scale.set(1.15, 1, 0.95)
      rf.position.y = 0.92
      g.add(rf)
      const door = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.6, 0.06), mat('#5a3a1e', false)))
      door.position.set(0, -0.25, 0.66)
      g.add(door)
      const glass = mat('#9be7ff', true, { roughness: 0.1, emissive: '#5ac8ff', emissiveIntensity: 0.3 })
      for (const x of [-0.5, 0.5]) {
        const w = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.06), glass))
        w.position.set(x, 0.12, 0.66)
        g.add(w)
      }
      const chimney = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.22), roof))
      chimney.position.set(0.5, 1.05, -0.3)
      g.add(chimney)
      const obj = normalise(g)
      return { object: obj, dispose: disposer(obj) }
    },
  },
  {
    id: 'burger',
    label: 'Burger',
    emoji: '🍔',
    build: (o) => {
      const g = new THREE.Group()
      const bun = mat(o.color, false, { roughness: 0.65 })
      const lettuce = mat(o.color2, false, { roughness: 0.8 })
      const top = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2), bun))
      top.scale.set(1, 0.7, 1)
      top.position.y = 0.32
      g.add(top)
      const layer = (geo: THREE.BufferGeometry, m: Mat, y: number, sx = 1) => {
        const mesh = shadowed(new THREE.Mesh(geo, m))
        mesh.position.y = y
        mesh.scale.set(sx, 1, sx)
        g.add(mesh)
      }
      layer(new THREE.CylinderGeometry(1.08, 1.02, 0.12, 40), lettuce, 0.22, 1)
      layer(new THREE.CylinderGeometry(0.98, 0.98, 0.16, 40), mat('#ffb300', false, { roughness: 0.45 }), 0.08, 1.02)
      layer(new THREE.CylinderGeometry(0.95, 0.95, 0.28, 40), mat('#5a2d15', false, { roughness: 0.9 }), -0.14, 1)
      layer(new THREE.CylinderGeometry(1.05, 1, 0.13, 40), mat('#e53935', false, { roughness: 0.5 }), -0.35, 1)
      layer(new THREE.CylinderGeometry(1, 0.92, 0.3, 40), bun, -0.58, 1)
      // sesame seeds
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + (i % 3) * 0.4
        const r = 0.25 + (i % 4) * 0.17
        const seed = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), mat('#fff3d6', false))
        const y = 0.32 + Math.sqrt(Math.max(0, 1 - r * r)) * 0.7
        seed.position.set(Math.cos(a) * r, y, Math.sin(a) * r)
        seed.scale.set(1, 0.5, 1.4)
        g.add(seed)
      }
      const obj = normalise(g)
      return { object: obj, dispose: disposer(obj) }
    },
  },
  {
    id: 'bag',
    label: 'Shopping bag',
    emoji: '🛍️',
    build: (o) => {
      const g = new THREE.Group()
      const paper = mat(o.color, false, { roughness: 0.6 })
      const handle = mat(o.color2, o.metallic)
      g.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.7, 0.7), paper)))
      for (const z of [-0.2, 0.2]) {
        const h = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 12, 32, Math.PI), handle))
        h.position.set(0, 0.85, z)
        g.add(h)
      }
      const tag = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.05), handle))
      tag.position.set(0, 0.1, 0.38)
      g.add(tag)
      const obj = normalise(g)
      return { object: obj, dispose: disposer(obj) }
    },
  },
  {
    id: 'diamond',
    label: 'Diamond',
    emoji: '💎',
    build: (o) => {
      const g = new THREE.Group()
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(1, 0),
        new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(o.color),
          metalness: 0.35,
          roughness: 0.08,
          clearcoat: 1,
          clearcoatRoughness: 0.05,
          emissive: new THREE.Color(o.color),
          emissiveIntensity: 0.18,
          envMapIntensity: 2.5,
          flatShading: true,
        }),
      )
      gem.scale.set(1, 1.4, 1)
      g.add(shadowed(gem))
      const halo = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.03, 8, 64), mat(o.color2, true, { emissive: o.color2, emissiveIntensity: 0.6 }))
      halo.rotation.x = Math.PI / 2
      g.add(halo)
      const obj = normalise(g)
      return {
        object: obj,
        update: (t) => {
          halo.rotation.z = t * 1.5
          halo.rotation.x = Math.PI / 2 + Math.sin(t) * 0.4
        },
        dispose: disposer(obj),
      }
    },
  },
  {
    id: 'confetti',
    label: 'Confetti burst',
    emoji: '🎉',
    build: (o) => {
      const COUNT = 160
      const g = new THREE.Group()
      const geo = new THREE.BoxGeometry(0.34, 0.18, 0.04)
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.2 }), COUNT)
      const palette = [new THREE.Color(o.color), new THREE.Color(o.color2), new THREE.Color('#ffffff'), new THREE.Color('#ff4d6d'), new THREE.Color('#4cc9f0')]
      // Deterministic pseudo-random so every export is identical.
      let seed = 7
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
      const parts = Array.from({ length: COUNT }, (_, i) => {
        const a = rnd() * Math.PI * 2
        const up = 2.5 + rnd() * 3
        const sp = 0.8 + rnd() * 2.2
        mesh.setColorAt(i, palette[i % palette.length])
        return { vx: Math.cos(a) * sp, vy: up, vz: Math.sin(a) * sp * 0.6, rx: rnd() * 6, ry: rnd() * 6, spin: 2 + rnd() * 6 }
      })
      g.add(mesh)
      const m = new THREE.Matrix4()
      const q = new THREE.Quaternion()
      const e = new THREE.Euler()
      const pos = new THREE.Vector3()
      const scl = new THREE.Vector3(1, 1, 1)
      const update = (t: number) => {
        const lt = t % 3.2 // re-burst every 3.2s
        parts.forEach((p, i) => {
          pos.set(p.vx * lt, p.vy * lt - 3.2 * lt * lt, p.vz * lt)
          e.set(p.rx + lt * p.spin, p.ry + lt * p.spin * 0.7, lt * p.spin)
          q.setFromEuler(e)
          m.compose(pos, q, scl)
          mesh.setMatrixAt(i, m)
        })
        mesh.instanceMatrix.needsUpdate = true
      }
      update(0.4)
      // Give the wrapper a sensible fixed size instead of fitting the burst.
      const wrapper = new THREE.Group()
      g.scale.setScalar(0.16)
      g.position.y = -0.45
      wrapper.add(g)
      return { object: wrapper, update, dispose: disposer(wrapper) }
    },
  },
  {
    id: 'mascot',
    label: 'Mascot',
    emoji: '👋',
    build: (o) => {
      const g = new THREE.Group()
      const skin = mat(o.color, false, { roughness: 0.5 })
      const accent = mat(o.color2, false, { roughness: 0.4 })
      const body = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1, 40, 40), skin))
      body.scale.set(0.9, 1.05, 0.85)
      g.add(body)
      const eyeW = mat('#ffffff', false, { roughness: 0.2 })
      const eyeB = mat('#111111', false, { roughness: 0.2 })
      for (const x of [-0.33, 0.33]) {
        const w = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 24), eyeW)
        w.position.set(x, 0.25, 0.78)
        g.add(w)
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), eyeB)
        p.position.set(x + 0.02, 0.26, 0.95)
        g.add(p)
      }
      const smile = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 10, 32, Math.PI), eyeB)
      smile.rotation.z = Math.PI
      smile.position.set(0, -0.05, 0.82)
      g.add(smile)
      // antenna / hat accent
      const hat = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 24), accent))
      hat.position.set(0, 1.25, 0)
      g.add(hat)
      const arms: THREE.Mesh[] = []
      for (const s of [-1, 1]) {
        const arm = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.55, 8, 16), skin))
        arm.position.set(s * 0.98, -0.1, 0.1)
        arm.rotation.z = s * 0.5
        g.add(arm)
        arms.push(arm)
      }
      for (const x of [-0.4, 0.4]) {
        const foot = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 20), accent))
        foot.position.set(x, -1.05, 0.15)
        foot.scale.set(1, 0.6, 1.3)
        g.add(foot)
      }
      const obj = normalise(g)
      return {
        object: obj,
        update: (t) => {
          arms[1].rotation.z = 0.5 + Math.sin(t * 6) * 0.45 - 1.4 // waving right arm
          arms[0].rotation.z = -0.5 + Math.sin(t * 2) * 0.1
          body.scale.y = 1.05 + Math.sin(t * 4) * 0.02
        },
        dispose: disposer(obj),
      }
    },
  },
  {
    id: 'bubble',
    label: 'Speech bubble',
    emoji: '💬',
    usesText: true,
    build: (o, font) => {
      const g = new THREE.Group()
      const label = (o.text || 'HEY!').slice(0, 24)
      const tx = text3d(label, font, mat(o.color2, o.metallic), 0.6, 0.15)
      const bb = new THREE.Box3().setFromObject(tx)
      const size = new THREE.Vector3()
      bb.getSize(size)
      const shape = roundedRectShape(size.x + 0.9, size.y + 0.8, 0.4)
      const tail = new THREE.Shape()
      tail.moveTo(-0.5, -size.y / 2 - 0.3)
      tail.lineTo(-0.9, -size.y / 2 - 1.0)
      tail.lineTo(0.2, -size.y / 2 - 0.3)
      const body = extrude([shape, tail], 0.3, mat(o.color, o.metallic))
      const bodyBox = new THREE.Box3().setFromObject(body)
      const c = new THREE.Vector3()
      bodyBox.getCenter(c)
      body.position.sub(c)
      const shapeCentreY = (size.y + 0.8) / 2 - (size.y + 0.8 + 0.7) / 2 // shift because the tail extends the bbox downward
      body.position.y -= shapeCentreY
      g.add(body)
      tx.position.z = 0.22
      g.add(tx)
      const obj = normalise(g)
      return { object: obj, dispose: disposer(obj) }
    },
  },
]

export const animById = (id: string): AnimDef => ANIMATIONS.find((a) => a.id === id) ?? ANIMATIONS[0]

let fontPromise: Promise<Font> | null = null
export function loadFont(): Promise<Font> {
  if (!fontPromise) {
    const url = `${import.meta.env.BASE_URL}fonts/helvetiker_bold.typeface.json`
    fontPromise = new FontLoader().loadAsync(url)
  }
  return fontPromise
}
