// The online preview has no server. When it is opened in a Claude viewer (a
// published Artifact that declares the `sample` capability), Hazel can ask
// Claude on the viewer's own Claude account; the viewer is asked to allow it
// the first time. Anywhere else this is unavailable and Hazel's built-in
// answers are used instead.

interface SampleOptions {
  modelTier?: 'quick' | 'default' | 'complex'
  cache?: boolean
}
interface SampleFn {
  (input: string, options?: SampleOptions): Promise<{ text: string; truncated: boolean }>
  json<T = unknown>(input: string, options?: SampleOptions): Promise<T>
}
interface SampleError {
  code: string
  message: string
}

// Codes after which this view should stop asking (the viewer said no, or Claude is off here).
const FINAL = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'])

let pending: Promise<SampleFn | null> | null = null
/** Set once the viewer said no, or Claude turned out to be off here: stop asking in this view. */
let closed: 'declined' | 'unavailable' | null = null

function sampleFn(): Promise<SampleFn | null> {
  if (closed) return Promise.resolve(null)
  if (pending) return pending
  const claude = (globalThis as { claude?: { use?: (name: string) => Promise<unknown> } }).claude
  pending = claude?.use
    ? claude
        .use('sample')
        .then((s) => (typeof s === 'function' ? (s as SampleFn) : null))
        .catch(() => null)
    : Promise.resolve(null)
  return pending
}

/** Whether this view can reach Claude at all (before the viewer is asked). */
export async function claudeAvailable(): Promise<boolean> {
  return (await sampleFn()) !== null
}

/** Why Claude cannot be used in this view, in words for the family. */
export function claudeUnavailableReason(): string {
  return closed === 'declined'
    ? 'Claude was not allowed for this preview, so Ask Hazel uses its simple built-in answers.'
    : 'Claude is not available in this view of the preview. Open the preview from its claude.ai link to try it. Ask Hazel still works with simple built-in answers.'
}

export type ClaudeResult<T> = { ok: true; value: T } | { ok: false; reason: 'unavailable' | 'declined' | 'failed' }

async function call<T>(run: (s: SampleFn) => Promise<T>): Promise<ClaudeResult<T>> {
  const s = await sampleFn()
  if (!s) return { ok: false, reason: closed ?? 'unavailable' }
  try {
    return { ok: true, value: await run(s) }
  } catch (e) {
    const code = (e as SampleError)?.code
    if (FINAL.has(code)) {
      closed = code === 'not_granted' ? 'declined' : 'unavailable'
      return { ok: false, reason: closed }
    }
    return { ok: false, reason: 'failed' }
  }
}

export const claudeJson = <T>(prompt: string, modelTier: SampleOptions['modelTier']) =>
  call((s) => s.json<T>(prompt, { modelTier }))

export const claudeText = (prompt: string, modelTier: SampleOptions['modelTier']) =>
  call(async (s) => (await s(prompt, { modelTier })).text.trim())
