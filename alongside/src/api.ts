import { useEffect } from 'react'
// Small fetch wrapper. Every failure becomes an ApiError so screens can show
// "That didn't save" and offer a retry. Nothing is reported as saved unless
// the server answered with success.
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message)
  }
}

/** True in the browser-only preview build, which has no server. */
export const STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === '1'

/** Fired after any successful save, so every open view (including the other panel of the side-by-side demo) refreshes. */
export const DATA_CHANGED = 'alongside:changed'

export function useOnDataChanged(fn: () => void) {
  useEffect(() => {
    window.addEventListener(DATA_CHANGED, fn)
    return () => window.removeEventListener(DATA_CHANGED, fn)
  }, [fn])
}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const out = await request<T>(method, path, body)
  if (method !== 'GET') setTimeout(() => window.dispatchEvent(new Event(DATA_CHANGED)), 0)
  return out
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (STATIC_DEMO) {
    const { localApi } = await import('./demo/localApi')
    try {
      return await localApi<T>(method, path, body)
    } catch (e) {
      if (e instanceof ApiError) throw e
      // A bug or unreadable saved data: say so plainly instead of blaming the connection.
      console.error(e)
      throw new ApiError(500, 'The demonstration hit a problem. Start it again to reset it.')
    }
  }
  let res: Response
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: {
        'X-Alongside': '1',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Could not reach Alongside. Check the internet connection.')
  }
  const data = (await res.json().catch(() => null)) as { error?: string; fields?: Record<string, string> } | null
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || `The server returned an error (${res.status}).`, data?.fields || {})
  }
  return data as T
}

/** UUID v4 that also works outside secure contexts (e.g. testing over a LAN IP). */
export function newRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID()
    } catch {
      /* fall through */
    }
  }
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
