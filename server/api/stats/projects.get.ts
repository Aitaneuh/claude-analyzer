export default defineEventHandler((event) => {
  const f = getFilters(event)
  const w = where(f)
  const projects = all<Record<string, number | string>>(`SELECT project, ${TOKENS},
      count(DISTINCT session_id) AS sessions,
      count(DISTINCT ${DAY}) AS active_days,
      min(ts) AS first_active, max(ts) AS last_active,
      group_concat(DISTINCT git_branch) AS branches
    FROM messages ${w.sql} GROUP BY project ORDER BY cost DESC`, w.params)

  const pw = where(f)
  const prompts = new Map(all<{ project: string, n: number }>(`SELECT project, count(*) AS n FROM prompts ${pw.sql} GROUP BY project`, pw.params).map(r => [r.project, r.n]))
  const tw = where(f)
  const tools = new Map(all<{ project: string, n: number }>(`SELECT project, count(*) AS n FROM tools ${tw.sql} GROUP BY project`, tw.params).map(r => [r.project, r.n]))
  const topModel = new Map(all<{ project: string, model: string }>(`SELECT project, model FROM (
      SELECT project, model, row_number() OVER (PARTITION BY project ORDER BY sum(cost) DESC) AS rn
      FROM messages ${w.sql} GROUP BY project, model) WHERE rn = 1`, w.params).map(r => [r.project, r.model]))

  const days = dayRange(f)
  const rows = all<{ day: string, key: string, value: number }>(`SELECT ${DAY} AS day, project AS key, sum(cost) AS value FROM messages ${w.sql} GROUP BY day, project`, w.params)

  return {
    projects: projects.map(p => ({
      ...p,
      prompts: prompts.get(p.project as string) ?? 0,
      tools: tools.get(p.project as string) ?? 0,
      top_model: topModel.get(p.project as string) ?? null,
      branches: p.branches ? String(p.branches).split(',').filter(Boolean).slice(0, 10) : [],
    })),
    dailyCost: pivotTop(days, rows),
  }
})
