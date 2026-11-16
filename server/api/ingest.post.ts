import { timingSafeEqual } from 'node:crypto'

// Receives batches pushed by scripts/sync.mjs from the machine where you run Claude Code.
export default defineEventHandler(async (event) => {
  const token = process.env.INGEST_TOKEN
  if (!token) throw createError({ statusCode: 503, statusMessage: 'INGEST_TOKEN is not configured on the server' })
  const got = (getHeader(event, 'authorization') || '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(got)
  const b = Buffer.from(token)
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw createError({ statusCode: 401, statusMessage: 'Bad ingest token' })

  const body = await readBody(event)
  if (!body || typeof body !== 'object') throw createError({ statusCode: 400, statusMessage: 'Expected a JSON batch' })
  const records = insertBatch({
    messages: Array.isArray(body.messages) ? body.messages : [],
    tools: Array.isArray(body.tools) ? body.tools : [],
    toolResults: Array.isArray(body.toolResults) ? body.toolResults : [],
    prompts: Array.isArray(body.prompts) ? body.prompts : [],
    sessions: Array.isArray(body.sessions) ? body.sessions : [],
  })
  kvSet('last_ingest', JSON.stringify({ at: new Date().toISOString(), records, host: str(body.host) }))
  return { ok: true, records }
})

function str(v: unknown) {
  return typeof v === 'string' ? v.slice(0, 100) : null
}
