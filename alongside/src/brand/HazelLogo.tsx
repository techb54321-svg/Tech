// The Hazel logo: a flat hazelnut with a hazel leaf, and the "Hazel" wordmark
// (Fraunces SemiBold as outlines, so no web font is needed). Geometry lives in
// hazel.json, shared with scripts/make-brand.mjs, which draws the app icons.
import { useId } from 'react'
import g from './hazel.json'

function MarkShapes({ id }: { id: string }) {
  const c = g.colours
  return (
    <>
      <defs>
        <clipPath id={id}>
          <path d={g.nut} />
        </clipPath>
      </defs>
      <path d={g.stem} stroke={c.stem} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d={g.leaf} fill={c.leaf} />
      <path d={g.leafShade} fill={c.leafShade} />
      <path d={g.nut} fill={c.nut} />
      <g clipPath={`url(#${id})`}>
        <path d={g.nutShade} fill={c.nutShade} />
        <path d={g.base} fill={c.base} />
      </g>
    </>
  )
}

/** The hazelnut on its own (square). Decorative unless a title is given. */
export function HazelMark({ className, title }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg className={className} viewBox="3 0 114 114" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <MarkShapes id={`hz${id}`} />
    </svg>
  )
}

/** Hazelnut and wordmark side by side. `tone` is the colour of the background it sits on. */
export function HazelLogo({ tone = 'dark', className }: { tone?: 'dark' | 'light'; className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg className={className} viewBox="0 0 344 120" role="img" aria-label="Hazel">
      <g transform="translate(-20 6)">
        <MarkShapes id={`hz${id}`} />
      </g>
      <path transform={`translate(118 103) scale(${g.wordScale})`} fill={tone === 'dark' ? g.colours.ivory : g.colours.ink} d={g.word} />
    </svg>
  )
}
