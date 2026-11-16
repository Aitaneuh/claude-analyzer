import type { H3Event } from 'h3'
import type { SQLInputValue } from 'node:sqlite'

export interface Filters {
  from?: string // local date YYYY-MM-DD (inclusive)
  to?: string // local date YYYY-MM-DD (inclusive)
  project?: string
}

type Params = Record<string, SQLInputValue>

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function getFilters(event: H3Event): Filters {
  const q = getQuery(event)
  const f: Filters = {}
  if (typeof q.from === 'string' && DATE_RE.test(q.from)) f.from = q.from
  if (typeof q.to === 'string' && DATE_RE.test(q.to)) f.to = q.to
  if (typeof q.project === 'string' && q.project) f.project = q.project
  return f
}

export function localDayStart(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

export function addDays(day: string, n: number): string {
  const d = localDayStart(day)
  d.setDate(d.getDate() + n)
  return fmtDay(d)
}

export function fmtDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Build a WHERE clause on a table that has `ts` and `project` columns. */
export function where(f: Filters, alias = '', extra: string[] = []): { sql: string, params: Params } {
  const a = alias ? alias + '.' : ''
  const c: string[] = [...extra]
  const params: Params = {}
  if (f.from) { c.push(`${a}ts >= :from`); params.from = localDayStart(f.from).toISOString() }
  if (f.to) { c.push(`${a}ts < :to`); params.to = localDayStart(addDays(f.to, 1)).toISOString() }
  if (f.project) { c.push(`${a}project = :project`); params.project = f.project }
  return { sql: c.length ? 'WHERE ' + c.join(' AND ') : '', params }
}

export function all<T = Record<string, number | string | null>>(sql: string, params: Params = {}): T[] {
  return useDb().prepare(sql).all(params) as T[]
}

export function one<T = Record<string, number | string | null>>(sql: string, params: Params = {}): T {
  return (useDb().prepare(sql).get(params) ?? {}) as T
}

export const DAY = `date(ts, 'localtime')`

export const TOKENS = `
  count(*) AS messages,
  coalesce(sum(input_tokens), 0) AS input,
  coalesce(sum(output_tokens), 0) AS output,
  coalesce(sum(cache_write_5m + cache_write_1h), 0) AS cache_write,
  coalesce(sum(cache_read), 0) AS cache_read,
  coalesce(sum(thinking_tokens), 0) AS thinking,
  coalesce(sum(input_tokens + output_tokens + cache_write_5m + cache_write_1h + cache_read), 0) AS total,
  coalesce(sum(cost), 0) AS cost,
  coalesce(sum(cost_nocache), 0) AS cost_nocache`

/** List every local day in the filter range (or the data's range when open-ended). */
export function dayRange(f: Filters): string[] {
  let from = f.from
  let to = f.to
  if (!from || !to) {
    const r = one<{ min: string | null, max: string | null }>(`SELECT min(${DAY}) AS min, max(${DAY}) AS max FROM messages ${where({ project: f.project }).sql}`, where({ project: f.project }).params)
    from ??= r.min ?? fmtDay(new Date())
    to ??= fmtDay(new Date())
  }
  const out: string[] = []
  for (let d = from; d <= to && out.length < 3700; d = addDays(d, 1)) out.push(d)
  return out
}

/** Fill a per-day series so days without activity show as zero. */
export function fillDays<T extends { day: string }>(days: string[], rows: T[], zero: Omit<T, 'day'>): T[] {
  const map = new Map(rows.map(r => [r.day, r]))
  return days.map(day => map.get(day) ?? ({ day, ...zero } as T))
}

/** Pivot (day, key, value) rows into top-N series + "Other". */
export function pivotTop(days: string[], rows: Array<{ day: string, key: string, value: number }>, topN = 7) {
  const totals = new Map<string, number>()
  for (const r of rows) totals.set(r.key, (totals.get(r.key) ?? 0) + r.value)
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map(e => e[0])
  const keys = totals.size > topN ? [...top, 'Other'] : top
  const idx = new Map(days.map((d, i) => [d, i]))
  const series: Record<string, number[]> = Object.fromEntries(keys.map(k => [k, days.map(() => 0)]))
  for (const r of rows) {
    const i = idx.get(r.day)
    if (i === undefined) continue
    const k = top.includes(r.key) ? r.key : 'Other'
    series[k]![i]! += r.value
  }
  return { days, keys, series }
}
