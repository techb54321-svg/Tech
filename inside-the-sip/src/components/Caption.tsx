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
// (never a CDN — that crashed the scene on restricted networks) and is wrapped
// in Suspense + an error boundary so a font hiccup can never blank the scene.
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
          font="/fonts/Caption-Bold.ttf"
          position={position}
          fontSize={fontSize}
          color={color}
          anchorX="center"
          anchorY="middle"
          maxWidth={maxWidth}
          textAlign="center"
          outlineWidth={0.004}
          outlineColor="#2a160e"
        >
          {children}
        </Text>
      </Suspense>
    </SceneErrorBoundary>
  )
}
