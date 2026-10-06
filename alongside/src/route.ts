// Tiny router. The app normally routes on the URL hash. The side-by-side
// demonstration runs two copies of the app on one page, each with its own
// in-memory route, so everything reads the route through this context.
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

interface Router {
  path: string
  navigate: (path: string, replace?: boolean) => void
  /** The element that scrolls for this router (null = the whole page). */
  root: React.RefObject<HTMLElement | null> | null
}

const currentHash = () => decodeURIComponent(window.location.hash.replace(/^#/, '')) || '/'

const RouterContext = createContext<Router | null>(null)

export function HashRouter({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(currentHash)
  useEffect(() => {
    const on = () => setPath(currentHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const navigate = useCallback((to: string, replace = false) => {
    if (replace) {
      history.replaceState(null, '', `#${to}`)
      setPath(to)
    } else {
      window.location.hash = to
    }
  }, [])
  const value = useMemo(() => ({ path, navigate, root: null }), [path, navigate])
  return createElement(RouterContext.Provider, { value }, children)
}

/** A self-contained router inside a scrolling panel; in-page "#/…" links stay inside it. */
export function MemoryRouter({ initial, className, label, children }: { initial: string; className?: string; label: string; children: ReactNode }) {
  const [path, setPath] = useState(initial)
  const root = useRef<HTMLElement | null>(null)
  const navigate = useCallback((to: string) => setPath(to), [])
  const value = useMemo(() => ({ path, navigate, root }), [path, navigate])
  return createElement(
    RouterContext.Provider,
    { value },
    createElement(
      'section',
      {
        ref: root,
        className,
        'aria-label': label,
        onClickCapture: (e: React.MouseEvent) => {
          const a = (e.target as HTMLElement).closest('a')
          const href = a?.getAttribute('href')
          if (href && href.startsWith('#')) {
            e.preventDefault()
            navigate(decodeURIComponent(href.slice(1)) || '/')
          }
        },
      },
      children,
    ),
  )
}

function useRouter(): Router {
  const r = useContext(RouterContext)
  if (!r) throw new Error('Router missing')
  return r
}

export const useRoute = () => useRouter().path
export const useNavigate = () => useRouter().navigate
/** True inside a panel of the side-by-side demonstration. */
export const useEmbedded = () => useRouter().root !== null

/** After each screen change, start at the top and put keyboard focus on the heading. */
export function useScreenFocus(dep: unknown) {
  const { root } = useRouter()
  useEffect(() => {
    const el = root?.current
    if (el) {
      // Side-by-side demo: never pull focus out of the other panel.
      el.scrollTop = 0
      if (document.activeElement && document.activeElement !== document.body && !el.contains(document.activeElement)) return
      el.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true })
      return
    }
    window.scrollTo(0, 0)
    document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true })
  }, [dep, root])
}
