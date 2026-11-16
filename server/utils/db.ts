import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

let db: DatabaseSync | null = null

const SCHEMA = `
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  request_id TEXT,
  ts TEXT NOT NULL,
  session_id TEXT,
  project TEXT,
  cwd TEXT,
  model TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_write_5m INTEGER DEFAULT 0,
  cache_write_1h INTEGER DEFAULT 0,
  cache_read INTEGER DEFAULT 0,
  thinking_tokens INTEGER DEFAULT 0,
  web_search INTEGER DEFAULT 0,
  web_fetch INTEGER DEFAULT 0,
  speed TEXT,
  service_tier TEXT,
  effort TEXT,
  is_sidechain INTEGER DEFAULT 0,
  agent_id TEXT,
  version TEXT,
  git_branch TEXT,
  entrypoint TEXT,
  stop_reason TEXT,
  cost REAL DEFAULT 0,
  cost_nocache REAL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_messages_ts ON messages(ts);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project);

CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  message_id TEXT,
  ts TEXT,
  session_id TEXT,
  project TEXT,
  name TEXT,
  is_sidechain INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tools_ts ON tools(ts);
CREATE INDEX IF NOT EXISTS idx_tools_session ON tools(session_id);

CREATE TABLE IF NOT EXISTS tool_results (
  tool_use_id TEXT PRIMARY KEY,
  is_error INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  ts TEXT,
  session_id TEXT,
  project TEXT,
  chars INTEGER,
  command TEXT
);
CREATE INDEX IF NOT EXISTS idx_prompts_ts ON prompts(ts);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  title TEXT
);

-- A session belongs to the folder it was started in, even if Claude later cd's into
-- sub-folders (which would otherwise show up as "src", "build", ... projects).
CREATE TABLE IF NOT EXISTS session_projects (
  session_id TEXT PRIMARY KEY,
  project TEXT,
  first_ts TEXT
);

CREATE TABLE IF NOT EXISTS files (
  path TEXT PRIMARY KEY,
  offset INTEGER DEFAULT 0,
  size INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT
);
`

export function useDb(): DatabaseSync {
  if (db) return db
  const dir = process.env.DATA_DIR || path.resolve('.data')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'claude-analyzer.db')
  db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;')
  db.exec(SCHEMA)
  console.log(`[db] using ${file}`)
  return db
}

export function kvGet(key: string): string | null {
  const row = useDb().prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function kvSet(key: string, value: string) {
  useDb().prepare('INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
}

export function tx<T>(fn: () => T): T {
  const d = useDb()
  d.exec('BEGIN')
  try {
    const r = fn()
    d.exec('COMMIT')
    return r
  } catch (e) {
    d.exec('ROLLBACK')
    throw e
  }
}
