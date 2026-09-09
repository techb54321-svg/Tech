import { ANIMATIONS } from '../engine/animations'
import { GRADIENTS, gradientCss } from '../engine/background'
import { MOTIONS } from '../engine/motions'
import { FONT_STACKS } from '../engine/text'
import type { AnimationLayer, Background, FontId, Logo, PictureLayer, Project, TextAnim, TextLayer } from '../types'
import { BREAKOUT_MOTIONS, CAMERA_MOVES, DEVICES, FORMATS, uid } from '../types'
import { ColorInput, Field, FilePick, Segmented, Select, Slider, Toggle } from './controls'

export type Tab = 'picture' | 'background' | 'text' | 'animation' | 'brand'

export interface Selection {
  kind: 'picture' | 'text' | 'animation' | null
  id?: string
}

interface Props {
  project: Project
  tab: Tab
  setTab: (t: Tab) => void
  selection: Selection
  setSelection: (s: Selection) => void
  update: (fn: (p: Project) => Project) => void
}

export function Inspector({ project, tab, setTab, selection, setSelection, update }: Props) {
  return (
    <aside className="inspector">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'picture', label: '📸 Picture' },
          { value: 'background', label: '🖼 Backdrop' },
          { value: 'text', label: '✍️ Text' },
          { value: 'animation', label: '✨ Sticker' },
          { value: 'brand', label: '🏷 Brand' },
        ]}
      />
      <div className="inspector-body">
        {tab === 'picture' && <PictureTab pic={project.picture} duration={project.duration} set={(b) => update((p) => ({ ...p, picture: { ...p.picture, ...b } }))} />}
        {tab === 'background' && <BackgroundTab bg={project.background} set={(b) => update((p) => ({ ...p, background: { ...p.background, ...b } }))} />}
        {tab === 'text' && <TextTab project={project} selection={selection} setSelection={setSelection} update={update} />}
        {tab === 'animation' && <AnimationTab anim={project.animation} set={(a) => update((p) => ({ ...p, animation: { ...p.animation, ...a } }))} />}
        {tab === 'brand' && <BrandTab project={project} update={update} />}
      </div>
    </aside>
  )
}

// --- Picture (the breakout) ----------------------------------------------------

function PictureTab({ pic, duration, set }: { pic: PictureLayer; duration: number; set: (b: Partial<PictureLayer>) => void }) {
  return (
    <>
      <FilePick
        label={pic.url ? 'Replace your picture…' : '1 · Upload your photo or video'}
        accept="image/*,video/*"
        onFile={(f) => set({ url: URL.createObjectURL(f), isVideo: f.type.startsWith('video') })}
      />
      <p className="hint">
        This is the flat picture that comes out of the screen. Product shots, listings, food, portraits — anything works. It never leaves your browser.
      </p>
      <Field label="2 · Screen it comes out of">
        <div className="device-grid">
          {DEVICES.map((d) => (
            <button key={d.id} type="button" className={`anim-tile ${d.id === pic.device ? 'active' : ''}`} title={d.hint} onClick={() => set({ device: d.id })}>
              <span className="anim-emoji">{d.emoji}</span>
              <span>{d.label}</span>
            </button>
          ))}
        </div>
      </Field>
      <Select label="3 · Breakout motion" value={pic.motion} options={BREAKOUT_MOTIONS.map((m) => ({ value: m.id, label: `${m.label} — ${m.hint}` }))} onChange={(motion) => set({ motion })} />
      <Select label="Camera" value={pic.camera} options={CAMERA_MOVES.map((c) => ({ value: c.id, label: c.label }))} onChange={(camera) => set({ camera })} />
      <Slider label="How far it comes out" value={pic.popDistance} min={0.3} max={2} step={0.05} onChange={(v) => set({ popDistance: v })} format={(v) => `${v.toFixed(2)}×`} />
      <Slider label="Size" value={pic.scale} min={0.12} max={0.7} onChange={(v) => set({ scale: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Delay before breakout" value={pic.delay} min={0} max={Math.max(0.5, duration - 2)} step={0.05} onChange={(v) => set({ delay: v })} format={(v) => `${v.toFixed(2)}s`} />
      <ColorInput label="Device / frame colour" value={pic.frameColor} onChange={(c) => set({ frameColor: c })} />
      <Field label="Optional: cut-out subject" hint="Same photo, background removed">
        <FilePick label={pic.cutoutUrl ? 'Replace cut-out PNG…' : 'Upload a transparent PNG…'} accept="image/png,image/webp" onFile={(f) => set({ cutoutUrl: URL.createObjectURL(f) })} />
      </Field>
      <p className="hint">
        For the classic “bursts out of the frame” look, upload the same photo with its background removed (e.g. from remove.bg). The subject then pops out past the edges while the rest stays on screen.
      </p>
      {pic.cutoutUrl && (
        <button type="button" className="btn ghost" onClick={() => set({ cutoutUrl: undefined })}>
          Remove cut-out
        </button>
      )}
      <p className="hint">Drag the device on the preview to move it.</p>
    </>
  )
}

// --- Background --------------------------------------------------------------

function BackgroundTab({ bg, set }: { bg: Background; set: (b: Partial<Background>) => void }) {
  const pick = (f: File) => {
    const url = URL.createObjectURL(f)
    set({ kind: f.type.startsWith('video') ? 'video' : 'image', mediaUrl: url })
  }
  return (
    <>
      <Segmented
        value={bg.kind}
        onChange={(k) => set({ kind: k })}
        options={[
          { value: 'gradient', label: 'Gradient' },
          { value: 'solid', label: 'Solid' },
          { value: 'image', label: 'Photo' },
          { value: 'video', label: 'Video' },
        ]}
      />
      {bg.kind === 'gradient' && (
        <div className="swatches">
          {GRADIENTS.map((g) => (
            <button
              key={g.id}
              type="button"
              title={g.name}
              className={`swatch ${g.id === bg.gradient ? 'active' : ''}`}
              style={{ background: gradientCss(g.id) }}
              onClick={() => set({ gradient: g.id })}
            />
          ))}
        </div>
      )}
      {bg.kind === 'solid' && <ColorInput label="Colour" value={bg.color} onChange={(c) => set({ color: c })} />}
      {(bg.kind === 'image' || bg.kind === 'video') && (
        <>
          <FilePick label={bg.mediaUrl ? 'Replace file…' : bg.kind === 'image' ? 'Upload a photo…' : 'Upload a video…'} accept={bg.kind === 'image' ? 'image/*' : 'video/*'} onFile={pick} />
          <p className="hint">Your file never leaves this browser. It is fitted to cover the frame.</p>
          {bg.kind === 'image' && <Toggle label="Slow zoom (Ken Burns)" value={bg.kenBurns} onChange={(v) => set({ kenBurns: v })} />}
          <Slider label="Blur" value={bg.blur} min={0} max={30} step={1} onChange={(v) => set({ blur: v })} format={(v) => `${v}px`} />
        </>
      )}
      <Slider label="Darken" value={bg.dim} min={0} max={0.8} onChange={(v) => set({ dim: v })} format={(v) => `${Math.round(v * 100)}%`} />
    </>
  )
}

// --- Text --------------------------------------------------------------------

function TextTab({ project, selection, setSelection, update }: Omit<Props, 'tab' | 'setTab'>) {
  const selected = project.texts.find((t) => t.id === selection.id) ?? project.texts[0]
  const setLayer = (id: string, patch: Partial<TextLayer>) =>
    update((p) => ({ ...p, texts: p.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
  const add = () => {
    const layer: TextLayer = {
      id: uid('t'),
      text: 'New text',
      x: 0.5,
      y: 0.7,
      size: 0.045,
      maxWidth: 0.86,
      color: '#ffffff',
      font: 'sans',
      align: 'center',
      outline: false,
      shadow: true,
      uppercase: false,
      anim: 'rise',
      delay: 0.3,
    }
    update((p) => ({ ...p, texts: [...p.texts, layer] }))
    setSelection({ kind: 'text', id: layer.id })
  }
  const remove = (id: string) => {
    update((p) => ({ ...p, texts: p.texts.filter((t) => t.id !== id) }))
    setSelection({ kind: null })
  }
  return (
    <>
      <div className="layer-list">
        {project.texts.map((t) => (
          <button key={t.id} type="button" className={`layer ${selected?.id === t.id ? 'active' : ''}`} onClick={() => setSelection({ kind: 'text', id: t.id })}>
            <span className="layer-text">{t.text || '(empty)'}</span>
            <span className="layer-del" title="Delete" onClick={(e) => (e.stopPropagation(), remove(t.id))}>
              ✕
            </span>
          </button>
        ))}
        <button type="button" className="btn ghost" onClick={add}>
          + Add text
        </button>
      </div>
      {selected && (
        <>
          <Field label="Text">
            <textarea rows={2} value={selected.text} onChange={(e) => setLayer(selected.id, { text: e.target.value })} />
          </Field>
          <Select
            label="Font"
            value={selected.font}
            options={(Object.keys(FONT_STACKS) as FontId[]).map((f) => ({ value: f, label: FONT_STACKS[f].label }))}
            onChange={(font) => setLayer(selected.id, { font })}
          />
          <Slider label="Size" value={selected.size} min={0.015} max={0.16} step={0.001} onChange={(v) => setLayer(selected.id, { size: v })} format={(v) => `${Math.round(v * 1000) / 10}%`} />
          <Slider label="Max width" value={selected.maxWidth} min={0.3} max={1} onChange={(v) => setLayer(selected.id, { maxWidth: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <ColorInput label="Colour" value={selected.color} onChange={(c) => setLayer(selected.id, { color: c })} />
          <div className="row">
            <Toggle label="Pill background" value={!!selected.boxColor} onChange={(v) => setLayer(selected.id, { boxColor: v ? '#111111' : undefined })} />
            {selected.boxColor && <input type="color" value={selected.boxColor} onChange={(e) => setLayer(selected.id, { boxColor: e.target.value })} />}
          </div>
          <div className="row wrap">
            <Toggle label="Uppercase" value={selected.uppercase} onChange={(v) => setLayer(selected.id, { uppercase: v })} />
            <Toggle label="Outline" value={selected.outline} onChange={(v) => setLayer(selected.id, { outline: v })} />
            <Toggle label="Shadow" value={selected.shadow} onChange={(v) => setLayer(selected.id, { shadow: v })} />
          </div>
          <Segmented
            value={selected.align}
            onChange={(align) => setLayer(selected.id, { align })}
            options={[
              { value: 'left', label: '⬅' },
              { value: 'center', label: '↔' },
              { value: 'right', label: '➡' },
            ]}
          />
          <Select
            label="Entrance"
            value={selected.anim}
            options={(['pop', 'rise', 'fade', 'slide', 'typewriter', 'none'] as TextAnim[]).map((a) => ({ value: a, label: a[0].toUpperCase() + a.slice(1) }))}
            onChange={(anim) => setLayer(selected.id, { anim })}
          />
          <Slider label="Delay" value={selected.delay} min={0} max={Math.max(0.5, project.duration - 1)} step={0.05} onChange={(v) => setLayer(selected.id, { delay: v })} format={(v) => `${v.toFixed(2)}s`} />
          <p className="hint">Tip: drag any text directly on the preview to move it.</p>
        </>
      )}
    </>
  )
}

// --- Animation ---------------------------------------------------------------

function AnimationTab({ anim, set }: { anim: AnimationLayer; set: (a: Partial<AnimationLayer>) => void }) {
  const def = ANIMATIONS.find((a) => a.id === anim.kind)
  return (
    <>
      <Toggle label="Add a 3D sticker on top of the scene" value={anim.enabled} onChange={(v) => set({ enabled: v })} />
      {!anim.enabled && <p className="hint">Stickers are optional extras: a spinning coin, confetti burst, a 3D headline, a waving mascot…</p>}
      {anim.enabled && (
      <>
      <div className="anim-grid">
        {ANIMATIONS.map((a) => (
          <button key={a.id} type="button" className={`anim-tile ${a.id === anim.kind ? 'active' : ''}`} onClick={() => set({ kind: a.id })}>
            <span className="anim-emoji">{a.emoji}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>
      {def?.usesText && (
        <Field label="3D text" hint="Use a new line for stacked words">
          <textarea rows={2} value={anim.text} onChange={(e) => set({ text: e.target.value })} />
        </Field>
      )}
      <Select label="Motion" value={anim.motion} options={MOTIONS.map((m) => ({ value: m.id, label: `${m.label} — ${m.hint}` }))} onChange={(motion) => set({ motion })} />
      <Slider label="Size" value={anim.scale} min={0.1} max={0.9} onChange={(v) => set({ scale: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Delay" value={anim.delay} min={0} max={3} step={0.05} onChange={(v) => set({ delay: v })} format={(v) => `${v.toFixed(2)}s`} />
      <div className="row">
        <ColorInput label="Colour" value={anim.color} onChange={(c) => set({ color: c })} />
        <ColorInput label="Accent" value={anim.color2} onChange={(c) => set({ color2: c })} />
      </div>
      <Toggle label="Shiny metallic finish" value={anim.metallic} onChange={(v) => set({ metallic: v })} />
      <p className="hint">Drag the sticker on the preview to place it.</p>
      </>
      )}
    </>
  )
}

// --- Brand / format ----------------------------------------------------------

function BrandTab({ project, update }: { project: Project; update: Props['update'] }) {
  const setLogo = (l: Partial<Logo>) => update((p) => ({ ...p, logo: { ...p.logo, ...l } }))
  return (
    <>
      <Field label="Clip name">
        <input type="text" value={project.name} onChange={(e) => update((p) => ({ ...p, name: e.target.value }))} />
      </Field>
      <Field label="Format">
        <div className="format-grid">
          {FORMATS.map((f) => (
            <button key={f.id} type="button" className={`format-tile ${f.id === project.format ? 'active' : ''}`} onClick={() => update((p) => ({ ...p, format: f.id }))} title={f.hint}>
              <span className="format-box" style={{ aspectRatio: `${f.width} / ${f.height}` }} />
              <span>{f.label}</span>
              <small>{f.id}</small>
            </button>
          ))}
        </div>
      </Field>
      <Slider label="Duration" value={project.duration} min={3} max={20} step={0.5} onChange={(v) => update((p) => ({ ...p, duration: v }))} format={(v) => `${v}s`} />
      <Select
        label="Frame rate"
        value={String(project.fps)}
        options={[
          { value: '24', label: '24 fps' },
          { value: '30', label: '30 fps' },
          { value: '60', label: '60 fps' },
        ]}
        onChange={(v) => update((p) => ({ ...p, fps: Number(v) }))}
      />
      <Field label="Logo / watermark">
        <FilePick label={project.logo.url ? 'Replace logo…' : 'Upload a logo (PNG with transparency works best)'} accept="image/*" onFile={(f) => setLogo({ url: URL.createObjectURL(f) })} />
      </Field>
      {project.logo.url && (
        <>
          <Segmented
            value={project.logo.corner}
            onChange={(corner) => setLogo({ corner })}
            options={[
              { value: 'tl', label: '↖' },
              { value: 'tr', label: '↗' },
              { value: 'bl', label: '↙' },
              { value: 'br', label: '↘' },
            ]}
          />
          <Slider label="Logo size" value={project.logo.size} min={0.03} max={0.2} onChange={(v) => setLogo({ size: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <button type="button" className="btn ghost" onClick={() => setLogo({ url: undefined })}>
            Remove logo
          </button>
        </>
      )}
    </>
  )
}
