import { Suspense } from 'react'
import { Text } from '@react-three/drei'
import { SceneErrorBoundary } from './SceneErrorBoundary'

interface CaptionProps {
  children: string
  position?: [number, number, number]
  fontSize?: number
  color?: string
  maxWidth?: number
}

// Reusable world-space caption, readable in VR. Uses the locally bundled font
// (never a CDN) and is wrapped in Suspense + an error boundary so a font hiccup
// can never blank the scene.
//
// The text always draws ON TOP of scene geometry (depthTest off + high
// renderOrder) so captions stay readable even when teeth, organs, etc. sit in
// front of them.
export function Caption({
  children,
  position = [0, 0, 0],
  fontSize = 0.075,
  color = '#fff4e6',
  maxWidth = 1.5,
}: CaptionProps) {
  return (
    <SceneErrorBoundary>
      <Suspense fallback={null}>
        <Text
          font={`${import.meta.env.BASE_URL}fonts/Caption-Bold.ttf`}
          position={position}
          fontSize={fontSize}
          anchorX="center"
          anchorY="middle"
          maxWidth={maxWidth}
          textAlign="center"
          outlineWidth={fontSize * 0.08}
          outlineColor="#2a160e"
          renderOrder={999}
        >
          {children}
          <meshBasicMaterial color={color} depthTest={false} depthWrite={false} transparent toneMapped={false} />
        </Text>
      </Suspense>
    </SceneErrorBoundary>
  )
}
