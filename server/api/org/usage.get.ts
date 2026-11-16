import Anthropic from '@anthropic-ai/sdk'

// Organization-wide API usage & cost from the Anthropic Usage and Cost Analytics API (beta).
// Needs an Admin API key (sk-ant-admin...) for a Claude Console organization.
// Requests span at most 31 days, so longer ranges are split into chunks.

let client: Anthropic | null = null
const cache = new Map<string, { at: number, data: unknown }>()
const TTL = 10 * 60 * 1000 // the data refreshes every few hours; don't hammer the API

function chunks(start: Date, end: Date) {
  const out: Array<[string, string]> = []
  let s = new Date(start)
  while (s < end) {
    const e = new Date(Math.min(end.getTime(), s.getTime() + 31 * 86400000))
    out.push([s.toISOString(), e.toISOString()])
    s = e
  }
  return out
}

export default defineEventHandler(async (event) => {
  const key = process.env.ANTHROPIC_ADMIN_KEY
  if (!key) return { enabled: false }

  const days = Math.min(365, Math.max(1, Number(getQuery(event).days) || 30))
  const hit = cache.get(String(days))
  if (hit && Date.now() - hit.at < TTL) return hit.data

  client ??= new Anthropic({ apiKey: key })

  // UTC-midnight boundaries so buckets line up; the API's floor is 2026-01-01.
  const end = new Date()
  end.setUTCHours(0, 0, 0, 0)
  end.setUTCDate(end.getUTCDate() + 1)
  let start = new Date(end.getTime() - days * 86400000)
  const floor = new Date('2026-01-01T00:00:00Z')
  if (start < floor) start = floor

  const usage: Array<Record<string, unknown>> = []
  const cost: Array<Record<string, unknown>> = []

  try {
    for (const [s, e] of chunks(start, end)) {
      const u = await client.beta.organization.analytics.usage.list({
        starting_at: s,
        ending_at: e,
        time_bucket_width: '1d',
        group_by: ['model'],
        order_by: 'time',
        limit: 1000,
      })
      for await (const row of u) {
        usage.push({
          day: row.starting_at.slice(0, 10),
          model: row.group.model ?? 'other',
          uncached_input: row.usage.uncached_input_tokens ?? 0,
          cache_write: (row.usage.cache_creation?.ephemeral_1h_input_tokens ?? 0) + (row.usage.cache_creation?.ephemeral_5m_input_tokens ?? 0),
          cache_read: row.usage.cache_read_input_tokens ?? 0,
          output: row.usage.output_tokens ?? 0,
          total: row.usage.total_tokens ?? 0,
          requests: row.usage.requests ?? 0,
          web_search: row.usage.server_tool_use?.web_search_requests ?? 0,
        })
      }
      const c = await client.beta.organization.analytics.cost.list({
        starting_at: s,
        ending_at: e,
        time_bucket_width: '1d',
        group_by: ['model'],
        order_by: 'time',
        limit: 1000,
      })
      for await (const row of c) {
        cost.push({
          day: row.starting_at.slice(0, 10),
          model: row.group.model ?? 'other',
          // decimal strings in cents
          usd: Number(row.cost.amount) / 100,
          list_usd: Number(row.cost.list_amount) / 100,
        })
      }
    }
  } catch (e) {
    const err = e as { status?: number, message?: string }
    console.error('[org] analytics request failed:', err.status, err.message)
    return { enabled: true, error: `${err.status ?? ''} ${err.message ?? 'request failed'}`.trim() }
  }

  const data = { enabled: true, start: start.toISOString(), end: end.toISOString(), usage, cost }
  cache.set(String(days), { at: Date.now(), data })
  return data
})
