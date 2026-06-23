import { useRef, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { XROrigin } from '@react-three/xr'
import { Group, Vector3 } from 'three'
import { PATH, STEPS } from './steps'
import { useJourney } from './JourneyContext'

const EYE = new Vector3(0, 1.5, 0)
const tmp = new Vector3()
const look = new Vector3()

// The on-rails camera. A group is moved along the journey spline; the
// <XROrigin> inside it carries the VR player along (the user still freely looks
// around with their head). On a desktop browser there's no headset, so we also
// drive the flat camera to follow — handy for testing.
//
// Children passed here are parented to the rig, so HUD-like world UI (the
// narration caption, the Continue button) always sits in front of the user.
export function CameraRig({ children }: { children?: ReactNode }) {
  const rig = useRef<Group>(null)
  const uRef = useRef(0)
  const { index, status, arrived } = useJourney()
  const { camera, gl } = useThree()

  useFrame((_, delta) => {
    if (!rig.current) return
    const target = index / (STEPS.length - 1)
    const k = 1 - Math.pow(0.001, delta) // frame-rate independent easing

    if (status === 'traveling') {
      // Gentle, comfort-safe constant speed along the path.
      const speed = 0.16
      const dir = Math.sign(target - uRef.current)
      uRef.current += dir * speed * delta
      if ((dir >= 0 && uRef.current >= target) || (dir <= 0 && uRef.current <= target)) {
        uRef.current = target
        arrived()
      }
    } else {
      uRef.current += (target - uRef.current) * k
    }

    const u = Math.min(Math.max(uRef.current, 0), 1)
    PATH.getPoint(u, tmp)
    rig.current.position.copy(tmp)

    // Desktop preview only: in VR the headset owns the camera.
    if (!gl.xr.isPresenting) {
      camera.position.copy(tmp).add(EYE)
      look.copy(tmp).add(new Vector3(0, 1.4, -1.4))
      camera.lookAt(look)
    }
  })

  return (
    <group ref={rig}>
      <XROrigin />
      {children}
    </group>
  )
}
