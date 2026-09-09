import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { loadFont } from './engine/animations'
import { FrameRenderer, type CutoutStatus } from './engine/renderer'
import { warmFonts } from './engine/text'
import { instantiate, TEMPLATES } from './templates'
import type { Project, Template } from './types'
import { ExportDialog } from './ui/ExportDialog'
import { Gallery } from './ui/Gallery'
import { Inspector, type Selection, type Tab } from './ui/Inspector'
import { Preview } from './ui/Preview'

const DRAFT_KEY = 'clip-forge:draft'

function loadDraft(): Project | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Project
    // Uploaded media are blob: URLs that don't survive a reload.
    if (p.background.mediaUrl?.startsWith('blob:')) {
      p.background.mediaUrl = undefined
      if (p.background.kind === 'image' || p.background.kind === 'video') p.background.kind = 'gradient'
    }
    if (p.logo.url?.startsWith('blob:')) p.logo.url = undefined
    // Drafts saved by older versions
    if (!p.picture) p.picture = instantiate(TEMPLATES[0]).picture
    if (p.picture.url?.startsWith('blob:')) p.picture.url = undefined
    if (p.picture.cutoutUrl?.startsWith('blob:')) p.picture.cutoutUrl = undefined
    if (typeof p.animation.enabled !== 'boolean') p.animation.enabled = false
    if (typeof p.picture.autoCutout !== 'boolean') p.picture.autoCutout = true
    if (typeof p.picture.cutoutTolerance !== 'number') p.picture.cutoutTolerance = 0.28
    if (typeof p.picture.depth !== 'number') p.picture.depth = 0.5
    if (p.picture.popDistance > 1.6) p.picture.popDistance = 0.55
    return p
  } catch {
    return null
  }
}

export default function App() {
  const [font, setFont] = useState<Font | null>(null)
  const [fontError, setFontError] = useState<string | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [draft] = useState<Project | null>(() => loadDraft())
  const [tab, setTab] = useState<Tab>('picture')
  const [selection, setSelection] = useState<Selection>({ kind: null })
  const [cutout, setCutout] = useState<CutoutStatus>({ state: 'none' })
  const [exporting, setExporting] = useState(false)
  const [busy, setBusy] = useState(false)
  const renderer = useMemo(() => new FrameRenderer(), [])
  const history = useRef<Project[]>([])
  const future = useRef<Project[]>([])

  useEffect(() => {
    Promise.all([loadFont(), warmFonts()])
      .then(([f]) => setFont(f))
      .catch((e) => setFontError(String(e)))
    return () => renderer.dispose()
  }, [renderer])

  // Autosave
  useEffect(() => {
    if (!project) return
    const id = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(project))
      } catch {
        /* quota — ignore */
      }
    }, 300)
    return () => clearTimeout(id)
  }, [project])

  const update = useCallback((fn: (p: Project) => Project) => {
    setProject((prev) => {
      if (!prev) return prev
      const next = fn(prev)
      if (next !== prev) {
        history.current.push(prev)
        if (history.current.length > 60) history.current.shift()
        future.current = []
      }
      return next
    })
  }, [])

  const undo = useCallback(() => {
    setProject((prev) => {
      const last = history.current.pop()
      if (!last || !prev) return prev
      future.current.push(prev)
      return last
    })
  }, [])
  const redo = useCallback(() => {
    setProject((prev) => {
      const next = future.current.pop()
      if (!next || !prev) return prev
      history.current.push(prev)
      return next
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection.kind === 'text') {
          update((p) => ({ ...p, texts: p.texts.filter((t) => t.id !== selection.id) }))
          setSelection({ kind: null })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, update, selection])

  // Follow the selection with the inspector tab.
  useEffect(() => {
    if (selection.kind === 'text') setTab('text')
    if (selection.kind === 'animation') setTab('animation')
    if (selection.kind === 'picture') setTab('picture')
  }, [selection])

  const pick = (t: Template) => {
    history.current = []
    future.current = []
    setProject(instantiate(t))
    setSelection({ kind: null })
    setTab('picture')
  }

  if (fontError) return <div className="boot error">Could not load the 3D font: {fontError}</div>
  if (!font) return <div className="boot">Loading Clip Forge…</div>

  if (!project) {
    return <Gallery onPick={pick} hasDraft={!!draft} onResume={() => draft && setProject(draft)} />
  }

  return (
    <div className="editor">
      <header className="topbar">
        <button type="button" className="btn ghost" onClick={() => setProject(null)}>
          ← Templates
        </button>
        <input className="title-input" value={project.name} onChange={(e) => update((p) => ({ ...p, name: e.target.value }))} aria-label="Clip name" />
        <div className="spacer" />
        <button type="button" className="btn ghost" onClick={undo} title="Undo (Ctrl+Z)" disabled={history.current.length === 0}>
          ↶
        </button>
        <button type="button" className="btn ghost" onClick={redo} title="Redo (Ctrl+Shift+Z)" disabled={future.current.length === 0}>
          ↷
        </button>
        <button type="button" className="btn ghost" onClick={() => pick(TEMPLATES.find((t) => t.id === 'blank')!)} title="Start a blank clip">
          New
        </button>
        <button type="button" className="btn primary" onClick={() => setExporting(true)} disabled={busy}>
          ⬇ Export video
        </button>
      </header>
      <div className="workspace">
        <Preview
          project={project}
          renderer={renderer}
          font={font}
          selection={selection}
          setSelection={setSelection}
          update={update}
          frozen={busy}
          onCutoutStatus={setCutout}
        />
        <Inspector project={project} tab={tab} setTab={setTab} selection={selection} setSelection={setSelection} update={update} cutout={cutout} />
      </div>
      {exporting && <ExportDialog project={project} renderer={renderer} font={font} onClose={() => setExporting(false)} onBusy={setBusy} />}
    </div>
  )
}
