import { useState } from 'react'
import { gradientCss } from '../engine/background'
import { CATEGORIES, TEMPLATES } from '../templates'
import type { Template } from '../types'
import { formatOf } from '../types'

export function Gallery({ onPick, hasDraft, onResume }: { onPick: (t: Template) => void; hasDraft: boolean; onResume: () => void }) {
  const [cat, setCat] = useState('All')
  const list = TEMPLATES.filter((t) => cat === 'All' || t.category === cat)
  return (
    <main className="gallery">
      <header className="hero">
        <h1>
          Make viral 3D video ads <span>in 3 clicks</span>
        </h1>
        <p>Pick a template → add your text &amp; media → choose a 3D animation. Export an MP4 straight from your browser.</p>
        {hasDraft && (
          <button type="button" className="btn primary" onClick={onResume}>
            ▶ Resume your last clip
          </button>
        )}
      </header>
      <nav className="cats">
        {CATEGORIES.map((c) => (
          <button key={c} type="button" className={c === cat ? 'active' : ''} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </nav>
      <div className="template-grid">
        {list.map((t) => (
          <TemplateCard key={t.id} t={t} onPick={() => onPick(t)} />
        ))}
      </div>
    </main>
  )
}

function TemplateCard({ t, onPick }: { t: Template; onPick: () => void }) {
  const p = t.project
  const f = formatOf(p.format)
  const bg = p.background.kind === 'gradient' ? gradientCss(p.background.gradient) : p.background.color
  const head = p.texts[0]
  return (
    <button type="button" className="template-card" onClick={onPick}>
      <div className="thumb" style={{ background: bg, aspectRatio: `${f.width} / ${f.height}` }}>
        <span className="thumb-head" style={{ color: head?.color ?? '#fff' }}>
          {head ? (head.uppercase ? head.text.toUpperCase() : head.text) : ''}
        </span>
        <span className="thumb-emoji">{t.emoji}</span>
        {p.texts[p.texts.length - 1]?.boxColor && (
          <span className="thumb-cta" style={{ background: p.texts[p.texts.length - 1].boxColor, color: p.texts[p.texts.length - 1].color }}>
            {p.texts[p.texts.length - 1].text}
          </span>
        )}
      </div>
      <div className="card-meta">
        <strong>{t.name}</strong>
        <small>{t.category}</small>
      </div>
    </button>
  )
}
