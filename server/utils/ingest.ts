import { emptyBatch, listLogFiles, parseLine, readNewLines } from '../../lib/claude-log.mjs'
import { costOf, costWithoutCache } from './pricing'
import { kvSet, tx, useDb } from './db'

export type Batch = ReturnType<typeof emptyBatch>

const MSG_COLS = [
  'id', 'request_id', 'ts', 'session_id', 'project', 'cwd', 'model',
  'input_tokens', 'output_tokens', 'cache_write_5m', 'cache_write_1h', 'cache_read',
  'thinking_tokens', 'web_search', 'web_fetch', 'speed', 'service_tier', 'effort',
  'is_sidechain', 'agent_id', 'version', 'git_branch', 'entrypoint', 'stop_reason',
  'cost', 'cost_nocache',
] as const

// Claude Code writes one log line per content block of a message, each repeating the
// usage block, so the same message id appears several times. Keep the largest values.
const MAX_COLS = ['input_tokens', 'output_tokens', 'cache_write_5m', 'cache_write_1h', 'cache_read', 'thinking_tokens', 'web_search', 'web_fetch', 'cost', 'cost_nocache']

let stmts: ReturnType<typeof prepare> | null = null
function prepare() {
  const db = useDb()
  return {
    msg: db.prepare(`
      INSERT INTO messages (${MSG_COLS.join(',')}) VALUES (${MSG_COLS.map(c => ':' + c).join(',')})
      ON CONFLICT(id) DO UPDATE SET
        ${MAX_COLS.map(c => `${c} = max(${c}, excluded.${c})`).join(',\n')},
        stop_reason = coalesce(excluded.stop_reason, stop_reason)`),
    tool: db.prepare(`INSERT OR IGNORE INTO tools (id, message_id, ts, session_id, project, name, is_sidechain)
      VALUES (:id, :message_id, :ts, :session_id, :project, :name, :is_sidechain)`),
    toolResult: db.prepare(`INSERT INTO tool_results (tool_use_id, is_error) VALUES (:tool_use_id, :is_error)
      ON CONFLICT(tool_use_id) DO UPDATE SET is_error = max(is_error, excluded.is_error)`),
    prompt: db.prepare(`INSERT OR IGNORE INTO prompts (id, ts, session_id, project, chars, command)
      VALUES (:id, :ts, :session_id, :project, :chars, :command)`),
    session: db.prepare(`INSERT INTO sessions (session_id, title) VALUES (:session_id, :title)
      ON CONFLICT(session_id) DO UPDATE SET title = excluded.title`),
    sessionProject: db.prepare(`INSERT INTO session_projects (session_id, project, first_ts) VALUES (?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET project = excluded.project, first_ts = excluded.first_ts
      WHERE excluded.first_ts < session_projects.first_ts`),
    getSessionProject: db.prepare('SELECT project FROM session_projects WHERE session_id = ?'),
  }
}

/** Register the earliest project seen per session, then return a resolver session -> project. */
function resolveSessionProjects(b: Partial<Batch>, s: NonNullable<typeof stmts>) {
  const earliest = new Map<string, { ts: string, project: string }>()
  for (const r of [...(b.messages ?? []), ...(b.prompts ?? [])]) {
    if (!r?.session_id || !r.ts || !r.project) continue
    const sid = String(r.session_id)
    const cur = earliest.get(sid)
    if (!cur || String(r.ts) < cur.ts) earliest.set(sid, { ts: String(r.ts), project: String(r.project) })
  }
  for (const [sid, e] of earliest) s.sessionProject.run(str(sid, 200), str(e.project, 200), str(e.ts, 40))
  const cache = new Map<string, string | null>()
  return (sid: unknown, fallback: unknown) => {
    if (!sid) return str(fallback, 200)
    const k = String(sid)
    if (!cache.has(k)) cache.set(k, (s.getSessionProject.get(k) as { project: string } | undefined)?.project ?? null)
    return cache.get(k) ?? str(fallback, 200)
  }
}

/** Re-apply session -> project mapping to every stored row (cheap; run at startup). */
export function reprojectAll() {
  const db = useDb()
  for (const t of ['messages', 'tools', 'prompts']) {
    db.exec(`UPDATE ${t} SET project = (SELECT sp.project FROM session_projects sp WHERE sp.session_id = ${t}.session_id)
      WHERE session_id IN (SELECT session_id FROM session_projects)
        AND project IS NOT (SELECT sp.project FROM session_projects sp WHERE sp.session_id = ${t}.session_id)`)
  }
}

const str = (v: unknown, max = 500) => (v == null ? null : String(v).slice(0, max))
const int = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Math.trunc(Number(v))) : 0)

/** Insert a parsed batch. Values are sanitized because batches can arrive over HTTP. */
export function insertBatch(b: Partial<Batch>) {
  stmts ??= prepare()
  const s = stmts
  let n = 0
  tx(() => {
    const projectOf = resolveSessionProjects(b, s)
    for (const m of b.messages ?? []) {
      if (!m?.id || !m.ts || !m.model) continue
      const row: Record<string, string | number | null> = {
        id: str(m.id, 200), request_id: str(m.request_id, 200), ts: str(m.ts, 40), session_id: str(m.session_id, 200),
        project: projectOf(m.session_id, m.project), cwd: str(m.cwd), model: str(m.model, 100),
        input_tokens: int(m.input_tokens), output_tokens: int(m.output_tokens), cache_write_5m: int(m.cache_write_5m),
        cache_write_1h: int(m.cache_write_1h), cache_read: int(m.cache_read), thinking_tokens: int(m.thinking_tokens),
        web_search: int(m.web_search), web_fetch: int(m.web_fetch), speed: str(m.speed, 20), service_tier: str(m.service_tier, 40),
        effort: str(m.effort, 20), is_sidechain: m.is_sidechain ? 1 : 0, agent_id: str(m.agent_id, 200), version: str(m.version, 40),
        git_branch: str(m.git_branch, 200), entrypoint: str(m.entrypoint, 40), stop_reason: str(m.stop_reason, 40),
      }
      row.cost = costOf(row as never)
      row.cost_nocache = costWithoutCache(row as never)
      s.msg.run(row)
      n++
    }
    for (const t of b.tools ?? []) {
      if (!t?.id || !t.name) continue
      s.tool.run({ id: str(t.id, 200), message_id: str(t.message_id, 200), ts: str(t.ts, 40), session_id: str(t.session_id, 200), project: projectOf(t.session_id, t.project), name: str(t.name, 200), is_sidechain: t.is_sidechain ? 1 : 0 })
      n++
    }
    for (const r of b.toolResults ?? []) {
      if (!r?.tool_use_id) continue
      s.toolResult.run({ tool_use_id: str(r.tool_use_id, 200), is_error: r.is_error ? 1 : 0 })
      n++
    }
    for (const p of b.prompts ?? []) {
      if (!p?.id || !p.ts) continue
      s.prompt.run({ id: str(p.id, 200), ts: str(p.ts, 40), session_id: str(p.session_id, 200), project: projectOf(p.session_id, p.project), chars: int(p.chars), command: str(p.command, 100) })
      n++
    }
    for (const x of b.sessions ?? []) {
      if (!x?.session_id || !x.title) continue
      s.session.run({ session_id: str(x.session_id, 200), title: str(x.title, 300) })
      n++
    }
  })
  return n
}

/** Re-price every stored message (run at startup so pricing.json edits apply to history). */
export function repriceAll() {
  const db = useDb()
  const rows = db.prepare('SELECT id, model, input_tokens, output_tokens, cache_write_5m, cache_write_1h, cache_read, speed FROM messages').all() as never[]
  const upd = db.prepare('UPDATE messages SET cost = ?, cost_nocache = ? WHERE id = ?')
  tx(() => {
    for (const r of rows as Array<Record<string, never>>) upd.run(costOf(r as never), costWithoutCache(r as never), r.id)
  })
  return rows.length
}

let scanning = false

/** Incrementally scan a local Claude projects directory (only new bytes of each file are read). */
export function scanDirectory(dir: string) {
  if (scanning) return { skipped: true }
  scanning = true
  const started = Date.now()
  try {
    const db = useDb()
    const getFile = db.prepare('SELECT offset FROM files WHERE path = ?')
    const setFile = db.prepare('INSERT INTO files(path, offset, size) VALUES(?, ?, ?) ON CONFLICT(path) DO UPDATE SET offset = excluded.offset, size = excluded.size')
    const files = listLogFiles(dir)
    let records = 0
    let changed = 0
    for (const f of files) {
      const prev = (getFile.get(f) as { offset: number } | undefined)?.offset ?? 0
      let res
      try { res = readNewLines(f, prev) } catch { continue }
      if (res.offset === prev) continue
      const batch = emptyBatch()
      for (const line of res.lines) parseLine(line, batch)
      records += insertBatch(batch)
      setFile.run(f, res.offset, res.size)
      changed++
    }
    const result = { files: files.length, changed, records, ms: Date.now() - started }
    kvSet('last_scan', JSON.stringify({ at: new Date().toISOString(), ...result }))
    return result
  } finally {
    scanning = false
  }
}
