// The real Anthropic SDK, pointed at a local stand-in for the API, to check
// exactly what Hazel sends and that it reads the answers back correctly.
import { afterEach, describe, expect, it } from 'vitest'
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { AiUnavailable, claudeProviderFromEnv } from '../server/integrations/ai'

let server: Server | null = null
afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())))

async function fakeApi(reply: (body: Record<string, unknown>) => { status?: number; json: unknown }) {
  const seen: Array<{ url: string; headers: IncomingHttpHeaders; body: Record<string, unknown> }> = []
  server = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      const body = JSON.parse(raw)
      seen.push({ url: req.url ?? '', headers: req.headers, body })
      const out = reply(body)
      res.writeHead(out.status ?? 200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(out.json))
    })
  })
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', () => r()))
  const base = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`
  return { base, seen }
}
const message = (text: string, stop = 'end_turn') => ({
  id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: stop, stop_sequence: null,
  content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 5 },
})

describe('Claude provider', () => {
  it('is off without credentials', () => {
    expect(claudeProviderFromEnv({})).toBeNull()
  })

  it('asks Claude Opus 5.5 with the safety fallback and a JSON answer format, and reads the answer', async () => {
    const { base, seen } = await fakeApi(() => ({ json: message('{"answer":"It is Tuesday.","offerHelp":false}') }))
    const ai = claudeProviderFromEnv({ ANTHROPIC_API_KEY: 'test-key', ANTHROPIC_BASE_URL: base })!
    expect(ai.name).toBe('Claude (claude-opus-5-5)')
    expect(await ai.ask('RULES', 'FACTS')).toEqual({ answer: 'It is Tuesday.', offerHelp: false })
    const req = seen[0]
    expect(req.url).toMatch(/^\/v1\/messages/)
    expect(req.headers['x-api-key']).toBe('test-key')
    expect(String(req.headers['anthropic-beta'])).toContain('server-side-fallback-2026-07-01')
    expect(req.body).toMatchObject({ model: 'claude-opus-5-5', fallbacks: 'default', system: 'RULES', messages: [{ role: 'user', content: 'FACTS' }] })
    const cfg = req.body.output_config as { effort: string; format: { type: string; schema: { required: string[] } } }
    expect(cfg.effort).toBe('low')
    expect(cfg.format.type).toBe('json_schema')
    expect(cfg.format.schema.required).toEqual(['answer', 'offerHelp'])
  })

  it('treats a refusal or an API error as unavailable, so the app falls back', async () => {
    const refused = await fakeApi(() => ({ json: message('', 'refusal') }))
    const ai = claudeProviderFromEnv({ ANTHROPIC_API_KEY: 'k', ANTHROPIC_BASE_URL: refused.base })!
    await expect(ai.summarise('S', 'U')).rejects.toBeInstanceOf(AiUnavailable)
    await new Promise<void>((r) => server!.close(() => r()))
    const broken = await fakeApi(() => ({ status: 400, json: { type: 'error', error: { type: 'invalid_request_error', message: 'bad' } } }))
    const ai2 = claudeProviderFromEnv({ ANTHROPIC_API_KEY: 'k', ANTHROPIC_BASE_URL: broken.base })!
    await expect(ai2.ask('S', 'U')).rejects.toBeInstanceOf(AiUnavailable)
  })

  it('drafts with medium effort and returns the parsed draft; summaries return the text', async () => {
    const draft = { kind: 'routine', title: 'Lunch', question: 'Have you had your lunch?', subtitle: '', time: '12:30', startDate: '2026-10-07', repeat: 'daily', location: '', notes: '', pickupTime: null, returnTime: null, carColour: '', checks: [], unsupported: '' }
    const { base, seen } = await fakeApi((body) => ({ json: message(body.output_config && (body.output_config as { format?: unknown }).format ? JSON.stringify(draft) : 'A quiet day.') }))
    const ai = claudeProviderFromEnv({ ANTHROPIC_API_KEY: 'k', ANTHROPIC_BASE_URL: base })!
    expect(await ai.draft('S', 'U')).toEqual(draft)
    expect((seen[0].body.output_config as { effort: string }).effort).toBe('medium')
    expect(await ai.summarise('S', 'U')).toBe('A quiet day.')
  })
})
