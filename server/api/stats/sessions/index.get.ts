export default defineEventHandler((event) => {
  const f = getFilters(event)
  const w = where(f, 'm', ['m.session_id IS NOT NULL'])
  const sessions = all(`SELECT m.session_id, s.title, m.project,
      min(m.ts) AS started, max(m.ts) AS ended,
      (julianday(max(m.ts)) - julianday(min(m.ts))) * 86400 AS duration_s,
      ${TOKENS /* columns are unambiguous: the sessions table only has session_id, title */},
      sum(m.is_sidechain) AS sidechain_messages,
      group_concat(DISTINCT m.model) AS models,
      max(m.git_branch) AS git_branch,
      (SELECT count(*) FROM prompts p WHERE p.session_id = m.session_id) AS prompts,
      (SELECT count(*) FROM tools t WHERE t.session_id = m.session_id) AS tools
    FROM messages m LEFT JOIN sessions s ON s.session_id = m.session_id
    ${w.sql}
    GROUP BY m.session_id ORDER BY started DESC LIMIT 1000`, w.params)
  return { sessions }
})
