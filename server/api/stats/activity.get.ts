export default defineEventHandler((event) => {
  const f = getFilters(event)
  const w = where(f)

  // Day of week (0 = Sunday) x hour, in the server's timezone (TZ).
  const heat = all<{ dow: number, hour: number, messages: number, cost: number }>(`SELECT
      cast(strftime('%w', ts, 'localtime') AS integer) AS dow,
      cast(strftime('%H', ts, 'localtime') AS integer) AS hour,
      count(*) AS messages, sum(cost) AS cost
    FROM messages ${w.sql} GROUP BY dow, hour`, w.params)

  const pw = where(f)
  const promptHeat = all<{ dow: number, hour: number, prompts: number }>(`SELECT
      cast(strftime('%w', ts, 'localtime') AS integer) AS dow,
      cast(strftime('%H', ts, 'localtime') AS integer) AS hour,
      count(*) AS prompts
    FROM prompts ${pw.sql} GROUP BY dow, hour`, pw.params)

  // Calendar: always the last 365 days (ignores the date filter, honours project).
  const today = fmtDay(new Date())
  const calF: Filters = { project: f.project, from: addDays(today, -364), to: today }
  const cw = where(calF)
  const calendar = all<{ day: string, messages: number, cost: number, total: number }>(`SELECT ${DAY} AS day, count(*) AS messages, sum(cost) AS cost,
      sum(input_tokens + output_tokens + cache_write_5m + cache_write_1h + cache_read) AS total
    FROM messages ${cw.sql} GROUP BY day ORDER BY day`, cw.params)

  // Streaks, over all recorded days for this project filter.
  const sw = where({ project: f.project })
  const activeDays = all<{ day: string }>(`SELECT DISTINCT ${DAY} AS day FROM messages ${sw.sql} ORDER BY day`, sw.params).map(r => r.day)
  let longest = 0
  let run = 0
  let prev: string | null = null
  for (const d of activeDays) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1
    longest = Math.max(longest, run)
    prev = d
  }
  const set = new Set(activeDays)
  let current = 0
  let cursor = set.has(today) ? today : addDays(today, -1)
  while (set.has(cursor)) { current++; cursor = addDays(cursor, -1) }

  const sessW = where(f, '', ['session_id IS NOT NULL'])
  const sess = one(`SELECT count(*) AS sessions, avg(dur) AS avg_duration_s, max(dur) AS max_duration_s, avg(n) AS avg_messages, max(n) AS max_messages
    FROM (SELECT session_id, (julianday(max(ts)) - julianday(min(ts))) * 86400 AS dur, count(*) AS n FROM messages ${sessW.sql} GROUP BY session_id)`, sessW.params)

  const busiest = one(`SELECT ${DAY} AS day, count(*) AS messages, sum(cost) AS cost FROM messages ${w.sql} GROUP BY day ORDER BY messages DESC LIMIT 1`, w.params)
  const priciest = one(`SELECT ${DAY} AS day, sum(cost) AS cost FROM messages ${w.sql} GROUP BY day ORDER BY cost DESC LIMIT 1`, w.params)

  const lw = where(f)
  const promptStats = one(`SELECT count(*) AS prompts, avg(chars) AS avg_chars, max(chars) AS max_chars FROM prompts ${lw.sql}`, lw.params)

  return { heat, promptHeat, calendar, streak: { current, longest, activeDays: activeDays.length }, sessions: sess, busiest, priciest, promptStats }
})
