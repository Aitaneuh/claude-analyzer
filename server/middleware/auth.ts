import { timingSafeEqual } from 'node:crypto'

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

// Optional HTTP basic auth for the whole dashboard. /api/ingest has its own token and
// /api/health stays open for Docker health checks.
export default defineEventHandler((event) => {
  const password = process.env.DASHBOARD_PASSWORD
  if (!password) return
  const p = event.path || ''
  if (p.startsWith('/api/health') || p.startsWith('/api/ingest')) return

  const user = process.env.DASHBOARD_USER || 'admin'
  const header = getHeader(event, 'authorization') || ''
  if (header.startsWith('Basic ')) {
    const [u, ...rest] = Buffer.from(header.slice(6), 'base64').toString('utf8').split(':')
    if (safeEqual(u ?? '', user) && safeEqual(rest.join(':'), password)) return
  }
  setHeader(event, 'WWW-Authenticate', 'Basic realm="Claude Analyzer", charset="UTF-8"')
  throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
})
