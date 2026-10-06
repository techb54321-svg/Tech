import { useEffect, useState } from 'react'

const current = () => decodeURIComponent(window.location.hash.replace(/^#/, '')) || '/'

export function useRoute(): string {
  const [path, setPath] = useState(current)
  useEffect(() => {
    const on = () => setPath(current())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return path
}

export function navigate(path: string, replace = false) {
  const url = `#${path}`
  if (replace) {
    history.replaceState(null, '', url)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = path
  }
}

/** After each screen change, start at the top and put keyboard focus on the heading. */
export function useScreenFocus(dep: unknown) {
  useEffect(() => {
    window.scrollTo(0, 0)
    const h = document.querySelector<HTMLElement>('main h1')
    h?.focus({ preventScroll: true })
  }, [dep])
}
