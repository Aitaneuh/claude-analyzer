export default defineEventHandler((event) => {
  const f = getFilters(event)
  const w = where(f, 't')
  const tools = all<{ name: string, count: number, errors: number, sessions: number, sidechain: number }>(`SELECT t.name, count(*) AS count,
      coalesce(sum(r.is_error), 0) AS errors,
      count(DISTINCT t.session_id) AS sessions,
      coalesce(sum(t.is_sidechain), 0) AS sidechain
    FROM tools t LEFT JOIN tool_results r ON r.tool_use_id = t.id ${w.sql}
    GROUP BY t.name ORDER BY count DESC`, w.params)

  // MCP tools are named mcp__<server>__<tool>
  const mcp = new Map<string, { server: string, count: number, tools: number }>()
  for (const t of tools) {
    const m = t.name.match(/^mcp__(.+?)__/)
    if (!m) continue
    const e = mcp.get(m[1]!) ?? { server: m[1]!, count: 0, tools: 0 }
    e.count += t.count
    e.tools += 1
    mcp.set(m[1]!, e)
  }

  const days = dayRange(f)
  const dw = where(f)
  const rows = all<{ day: string, key: string, value: number }>(`SELECT ${DAY} AS day, name AS key, count(*) AS value FROM tools ${dw.sql} GROUP BY day, name`, dw.params)

  const pw = where(f, '', ['command IS NOT NULL'])
  const commands = all(`SELECT command, count(*) AS count FROM prompts ${pw.sql} GROUP BY command ORDER BY count DESC LIMIT 20`, pw.params)

  const mw = where(f)
  const perMessage = one(`SELECT
      coalesce(sum(web_search), 0) AS web_search, coalesce(sum(web_fetch), 0) AS web_fetch FROM messages ${mw.sql}`, mw.params)

  return { tools, mcp: [...mcp.values()].sort((a, b) => b.count - a.count), daily: pivotTop(days, rows, 6), commands, server: perMessage }
})
