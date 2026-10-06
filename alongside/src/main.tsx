import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import './styles.css'
import { App } from './App'
import { HashRouter } from './route'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)

// Installable PWA: the service worker caches only the app shell, never API data.
if ('serviceWorker' in navigator && import.meta.env.PROD && import.meta.env.VITE_STATIC_DEMO !== '1') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* the app works without it */
    })
  })
}
