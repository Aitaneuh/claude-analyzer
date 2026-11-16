export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400 })
  const p = { id }
  const summary = one(`SELECT m.session_id, s.title, m.project, max(m.cwd) AS cwd, max(m.git_branch) AS git_branch, max(m.version) AS version,
      min(m.ts) AS started, max(m.ts) AS ended, (julianday(max(m.ts)) - julianday(min(m.ts))) * 86400 AS duration_s, ${TOKENS}
    FROM messages m LEFT JOIN sessions s ON s.session_id = m.session_id WHERE m.session_id = :id`, p)
  if (!summary.messages) throw createError({ statusCode: 404, statusMessage: 'Session not found' })

  const messages = all(`SELECT m.id, m.ts, m.model, m.input_tokens, m.output_tokens, m.cache_write_5m + m.cache_write_1h AS cache_write,
      m.cache_read, m.thinking_tokens, m.cost, m.is_sidechain, m.effort, m.speed, m.stop_reason,
      (SELECT group_concat(t.name, ', ') FROM tools t WHERE t.message_id = m.id) AS tools
    FROM messages m WHERE m.session_id = :id ORDER BY m.ts`, p)
  const byModel = all(`SELECT model, ${TOKENS} FROM messages WHERE session_id = :id GROUP BY model ORDER BY cost DESC`, p)
  const tools = all(`SELECT t.name, count(*) AS count, coalesce(sum(r.is_error), 0) AS errors
    FROM tools t LEFT JOIN tool_results r ON r.tool_use_id = t.id WHERE t.session_id = :id GROUP BY t.name ORDER BY count DESC`, p)
  const prompts = all(`SELECT ts, chars, command FROM prompts WHERE session_id = :id ORDER BY ts`, p)

  return { summary, messages, byModel, tools, prompts }
})
