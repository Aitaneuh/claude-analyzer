export default defineEventHandler((event) => {
  const f = getFilters(event)
  const w = where(f)
  const models = all(`SELECT model, ${TOKENS},
      count(DISTINCT session_id) AS sessions,
      coalesce(sum(CASE WHEN speed = 'fast' THEN 1 ELSE 0 END), 0) AS fast_messages,
      coalesce(sum(is_sidechain), 0) AS sidechain_messages,
      min(ts) AS first_used, max(ts) AS last_used
    FROM messages ${w.sql} GROUP BY model ORDER BY cost DESC`, w.params)

  const days = dayRange(f)
  const costRows = all<{ day: string, key: string, value: number }>(`SELECT ${DAY} AS day, model AS key, sum(cost) AS value FROM messages ${w.sql} GROUP BY day, model`, w.params)
  const tokenRows = all<{ day: string, key: string, value: number }>(`SELECT ${DAY} AS day, model AS key, sum(input_tokens + output_tokens + cache_write_5m + cache_write_1h + cache_read) AS value FROM messages ${w.sql} GROUP BY day, model`, w.params)

  const effort = all(`SELECT coalesce(effort, 'unknown') AS effort, model, count(*) AS messages, sum(output_tokens) AS output, sum(cost) AS cost FROM messages ${w.sql} GROUP BY effort, model ORDER BY messages DESC`, w.params)
  const speed = all(`SELECT coalesce(speed, 'standard') AS speed, count(*) AS messages, sum(cost) AS cost FROM messages ${w.sql} GROUP BY speed`, w.params)
  const stop = all(`SELECT coalesce(stop_reason, 'unknown') AS stop_reason, count(*) AS messages FROM messages ${w.sql} GROUP BY stop_reason ORDER BY messages DESC`, w.params)
  const versions = all(`SELECT coalesce(version, 'unknown') AS version, count(*) AS messages, min(ts) AS first_seen FROM messages ${w.sql} GROUP BY version ORDER BY first_seen DESC LIMIT 15`, w.params)

  return {
    models,
    dailyCost: pivotTop(days, costRows),
    dailyTokens: pivotTop(days, tokenRows),
    effort,
    speed,
    stop,
    versions,
  }
})
