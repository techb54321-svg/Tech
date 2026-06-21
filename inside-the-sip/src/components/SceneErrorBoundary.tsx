import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

// Defence-in-depth for the 3D scene. If anything inside the Canvas throws —
// e.g. an async asset load rejects — React would otherwise unmount the whole
// tree and leave a black headset. This boundary catches it so the rest of the
// experience keeps rendering instead of going dark.
export class SceneErrorBoundary extends Component<Props, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[Inside the Sip] Scene error caught by boundary:', error)
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null
    return this.props.children
  }
}
