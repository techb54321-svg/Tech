import type { NextFunction, Request, Response } from 'express'
import { ZodError, type ZodTypeAny, type z } from 'zod'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/** Parse and validate a request body, turning problems into a 400 with field messages. */
export function parse<S extends ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const r = schema.safeParse(body)
  if (!r.success) throw r.error
  return r.data
}

type Handler = (req: Request, res: Response) => unknown | Promise<unknown>
export const h =
  (fn: Handler) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve()
      .then(() => fn(req, res))
      .catch(next)
  }

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {}
    for (const i of err.issues) fields[i.path.join('.') || '_'] ??= i.message
    return res.status(400).json({ error: 'Please check the highlighted details.', fields })
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
  if (err && typeof err === 'object' && 'type' in err && (err as { type: string }).type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid request.' })
  }
  console.error(err)
  res.status(500).json({ error: 'The server had a problem, so this may not have saved. Please try again.' })
}
