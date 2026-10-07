// Claude for Hazel's AI features: Ask Hazel answers, "Describe it" reminder
// drafts and the family's daily note. Configured by ANTHROPIC_API_KEY (or
// ANTHROPIC_AUTH_TOKEN); the key stays on the server. Without it, or if a call
// fails, the app falls back to Hazel's built-in answers and says so.
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod/v4'

export interface AiProvider {
  name: string
  ask(system: string, user: string): Promise<{ answer: string; offerHelp: boolean }>
  draft(system: string, user: string): Promise<unknown>
  summarise(system: string, user: string): Promise<string>
}

/** The AI could not give a usable answer (declined, cut short, timed out, or unreachable). */
export class AiUnavailable extends Error {}

const AskOutput = z.object({ answer: z.string(), offerHelp: z.boolean() })
const DraftOutput = z.object({
  kind: z.enum(['routine', 'appointment', 'social']),
  title: z.string(),
  question: z.string(),
  subtitle: z.string(),
  time: z.string(),
  startDate: z.string(),
  repeat: z.enum(['none', 'daily']),
  location: z.string(),
  notes: z.string(),
  pickupTime: z.string().nullable(),
  returnTime: z.string().nullable(),
  carColour: z.string(),
  checks: z.array(z.string()),
  unsupported: z.string(),
})

// Server-side fallback: if a request is declined by a safety classifier, the API
// retries it on Anthropic's recommended model for that category within the same call.
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }

export function claudeProviderFromEnv(env = process.env): AiProvider | null {
  if (!env.ANTHROPIC_API_KEY && !env.ANTHROPIC_AUTH_TOKEN) return null
  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY ?? null,
    authToken: env.ANTHROPIC_AUTH_TOKEN ?? null,
    ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}),
    maxRetries: 1,
  })
  const model = env.HAZEL_AI_MODEL || 'claude-opus-5-5'

  async function guarded<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work()
    } catch (e) {
      if (e instanceof AiUnavailable) throw e
      if (e instanceof Anthropic.APIError) throw new AiUnavailable(`Claude API error ${e.status ?? ''}`.trim())
      throw new AiUnavailable('Could not reach Claude')
    }
  }

  return {
    name: `Claude (${model})`,
    ask: (system, user) =>
      guarded(async () => {
        const res = await client.beta.messages.parse(
          {
            model,
            max_tokens: 4000,
            ...FALLBACK,
            system,
            messages: [{ role: 'user', content: user }],
            // A short, everyday answer: low effort keeps it quick for someone waiting.
            output_config: { effort: 'low', format: betaZodOutputFormat(AskOutput) },
          },
          { timeout: 20_000 },
        )
        if (res.stop_reason === 'refusal') throw new AiUnavailable('Declined')
        if (!res.parsed_output) throw new AiUnavailable('No answer')
        return res.parsed_output
      }),
    draft: (system, user) =>
      guarded(async () => {
        const res = await client.beta.messages.parse(
          {
            model,
            max_tokens: 8000,
            ...FALLBACK,
            system,
            messages: [{ role: 'user', content: user }],
            output_config: { effort: 'medium', format: betaZodOutputFormat(DraftOutput) },
          },
          { timeout: 45_000 },
        )
        if (res.stop_reason === 'refusal') throw new AiUnavailable('Declined')
        if (!res.parsed_output) throw new AiUnavailable('No draft')
        return res.parsed_output
      }),
    summarise: (system, user) =>
      guarded(async () => {
        const res = await client.beta.messages.create(
          {
            model,
            max_tokens: 4000,
            ...FALLBACK,
            system,
            messages: [{ role: 'user', content: user }],
            output_config: { effort: 'low' },
          },
          { timeout: 30_000 },
        )
        if (res.stop_reason === 'refusal') throw new AiUnavailable('Declined')
        const text = res.content
          .map((b) => (b.type === 'text' ? b.text : ''))
          .join('')
          .trim()
        if (!text) throw new AiUnavailable('No note')
        return text
      }),
  }
}
