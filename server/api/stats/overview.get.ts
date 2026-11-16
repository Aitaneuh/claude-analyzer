function totals(f: Filters) {
  const w = where(f)
  const t = one(`SELECT ${TOKENS},
      count(DISTINCT session_id) AS sessions,
      count(DISTINCT ${DAY}) AS active_days,
      count(DISTINCT project) AS projects,
      coalesce(sum(web_search), 0) AS web_search,
      coalesce(sum(web_fetch), 0) AS web_fetch,
      coalesce(sum(is_sidechain), 0) AS sidechain_messages
    FROM messages ${w.sql}`, w.params)
  const pw = where(f)
  const prompts = one<{ n: number }>(`SELECT count(*) AS n FROM prompts ${pw.sql}`, pw.params).n
  const tw = where(f)
  const tools = one<{ n: number }>(`SELECT count(*) AS n FROM tools ${tw.sql}`, tw.params).n
  return { ...t, prompts, tools }
}

export default defineEventHandler((event) => {
  const f = getFilters(event)
  const cur = totals(f)

  // Same-length previous period, for deltas on the KPI tiles.
  let prev = null
  if (f.from) {
    const to = f.to ?? fmtDay(new Date())
    const len = Math.round((localDayStart(to).getTime() - localDayStart(f.from).getTime()) / 86400000) + 1
    prev = totals({ project: f.project, from: addDays(f.from, -len), to: addDays(f.from, -1) })
  }

  const days = dayRange(f)
  const w = where(f)
  const daily = fillDays(days, all<{ day: string } & Record<string, number>>(
    `SELECT ${DAY} AS day, ${TOKENS} FROM messages ${w.sql} GROUP BY day ORDER BY day`, w.params),
  { messages: 0, input: 0, output: 0, cache_write: 0, cache_read: 0, thinking: 0, total: 0, cost: 0, cost_nocache: 0 })

  const byModel = all(`SELECT model, ${TOKENS} FROM messages ${w.sql} GROUP BY model ORDER BY cost DESC`, w.params)
  const byProject = all(`SELECT project, ${TOKENS}, count(DISTINCT session_id) AS sessions FROM messages ${w.sql} GROUP BY project ORDER BY cost DESC LIMIT 8`, w.params)
  const tw = where(f)
  const topTools = all(`SELECT name, count(*) AS count FROM tools ${tw.sql} GROUP BY name ORDER BY count DESC LIMIT 10`, tw.params)

  return { totals: cur, prev, daily, byModel, byProject, topTools }
})
