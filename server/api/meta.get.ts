export default defineEventHandler(() => {
  const projects = all<{ project: string, last: string }>(`SELECT project, max(ts) AS last FROM messages GROUP BY project ORDER BY last DESC`)
  const range = one<{ min: string | null, max: string | null, n: number }>(`SELECT min(${DAY}) AS min, max(${DAY}) AS max, count(*) AS n FROM messages`)
  const parse = (k: string) => { const v = kvGet(k); return v ? JSON.parse(v) : null }
  return {
    projects: projects.map(p => p.project),
    firstDay: range.min,
    lastDay: range.max,
    messages: range.n,
    lastScan: parse('last_scan'),
    lastIngest: parse('last_ingest'),
    sources: {
      localDir: process.env.CLAUDE_PROJECTS_DIR || null,
      ingestEnabled: !!process.env.INGEST_TOKEN,
      adminApi: !!process.env.ANTHROPIC_ADMIN_KEY,
    },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
})
