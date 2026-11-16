// Parser for Claude Code session logs (~/.claude/projects/**/*.jsonl).
// Plain ESM with no dependencies so it can run in the Nuxt server AND in the
// standalone scripts/sync.mjs on your workstation.

import fs from 'node:fs'
import path from 'node:path'

const INTERESTING = /"type"\s*:\s*"(assistant|user|ai-title)"/

export function emptyBatch() {
  return { messages: [], tools: [], toolResults: [], prompts: [], sessions: [] }
}

export function batchSize(b) {
  return b.messages.length + b.tools.length + b.toolResults.length + b.prompts.length + b.sessions.length
}

export function projectName(cwd) {
  if (!cwd) return 'unknown'
  const parts = String(cwd).split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || String(cwd)
}

function textOf(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.filter(c => c && c.type === 'text' && typeof c.text === 'string').map(c => c.text).join('\n')
  }
  return ''
}

function parseAssistant(d, batch, sessionId) {
  const m = d.message
  if (!m || !m.usage || !m.model || m.model === '<synthetic>') return
  const u = m.usage
  const cc = u.cache_creation || {}
  const cacheWrite = u.cache_creation_input_tokens || 0
  let cw1h = cc.ephemeral_1h_input_tokens || 0
  let cw5m = cc.ephemeral_5m_input_tokens ?? Math.max(0, cacheWrite - cw1h)
  if (cw1h + cw5m === 0 && cacheWrite > 0) cw5m = cacheWrite
  const id = m.id || d.uuid
  const project = projectName(d.cwd)
  const isSidechain = d.isSidechain ? 1 : 0

  batch.messages.push({
    id,
    request_id: d.requestId || null,
    ts: d.timestamp,
    session_id: sessionId || null,
    project,
    cwd: d.cwd || null,
    model: m.model,
    input_tokens: u.input_tokens || 0,
    output_tokens: u.output_tokens || 0,
    cache_write_5m: cw5m,
    cache_write_1h: cw1h,
    cache_read: u.cache_read_input_tokens || 0,
    thinking_tokens: u.output_tokens_details?.thinking_tokens || 0,
    web_search: u.server_tool_use?.web_search_requests || 0,
    web_fetch: u.server_tool_use?.web_fetch_requests || 0,
    speed: u.speed || 'standard',
    service_tier: u.service_tier || null,
    effort: d.effort || null,
    is_sidechain: isSidechain,
    agent_id: d.agentId || null,
    version: d.version || null,
    git_branch: d.gitBranch || null,
    entrypoint: d.entrypoint || null,
    stop_reason: m.stop_reason || null,
  })

  for (const c of m.content || []) {
    if (c && (c.type === 'tool_use' || c.type === 'server_tool_use') && c.id && c.name) {
      batch.tools.push({
        id: c.id,
        message_id: id,
        ts: d.timestamp,
        session_id: sessionId || null,
        project,
        name: c.name,
        is_sidechain: isSidechain,
      })
    }
  }
}

function parseUser(d, batch, sessionId) {
  const m = d.message
  if (!m) return
  const content = m.content

  if (Array.isArray(content)) {
    for (const c of content) {
      if (c && c.type === 'tool_result' && c.tool_use_id) {
        batch.toolResults.push({ tool_use_id: c.tool_use_id, is_error: c.is_error ? 1 : 0 })
      }
    }
  }

  if (d.isSidechain || d.isMeta || d.toolUseResult) return
  const text = textOf(content)
  if (!text) return
  let human
  if (d.origin && d.origin.kind) human = d.origin.kind === 'human'
  else human = !text.startsWith('<local-command') && !text.startsWith('Caveat:')
  if (!human) return

  const cmd = text.match(/<command-name>\s*\/?([^<\s]+)\s*<\/command-name>/) || text.match(/^\/([a-zA-Z0-9:_-]+)/)
  batch.prompts.push({
    id: d.uuid,
    ts: d.timestamp,
    session_id: sessionId || null,
    project: projectName(d.cwd),
    chars: text.length,
    command: cmd ? cmd[1] : null,
  })
}

/** Parse one JSONL line and append normalized records to `batch`. */
export function parseLine(line, batch) {
  if (!line || !INTERESTING.test(line)) return
  let d
  try { d = JSON.parse(line) } catch { return }
  if (!d || typeof d !== 'object' || !d.timestamp && d.type !== 'ai-title') return
  const sessionId = d.sessionId || d.session_id
  if (d.type === 'assistant') parseAssistant(d, batch, sessionId)
  else if (d.type === 'user') parseUser(d, batch, sessionId)
  else if (d.type === 'ai-title' && d.aiTitle && sessionId) batch.sessions.push({ session_id: sessionId, title: d.aiTitle })
}

/** Recursively list every .jsonl file under `dir`. */
export function listLogFiles(dir) {
  const out = []
  const walk = (p) => {
    let entries
    try { entries = fs.readdirSync(p, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const full = path.join(p, e.name)
      if (e.isDirectory()) walk(full)
      else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(full)
    }
  }
  walk(dir)
  return out
}

/**
 * Read complete lines appended to `file` since byte `offset`.
 * Returns { lines, offset } where offset points after the last complete line.
 * If the file shrank (rotated/rewritten) it restarts from 0.
 */
export function readNewLines(file, offset = 0) {
  const size = fs.statSync(file).size
  if (size < offset) offset = 0
  if (size === offset) return { lines: [], offset, size }
  const fd = fs.openSync(file, 'r')
  try {
    const len = size - offset
    const buf = Buffer.allocUnsafe(len)
    let read = 0
    while (read < len) {
      const n = fs.readSync(fd, buf, read, len - read, offset + read)
      if (n === 0) break
      read += n
    }
    const lastNl = buf.lastIndexOf(0x0a, read - 1)
    if (lastNl === -1) return { lines: [], offset, size }
    const text = buf.subarray(0, lastNl).toString('utf8')
    return { lines: text.split('\n'), offset: offset + lastNl + 1, size }
  } finally {
    fs.closeSync(fd)
  }
}
