#!/usr/bin/env node
// Push Claude Code usage from this machine to a Claude Analyzer server.
//
//   node scripts/sync.mjs --url https://claude.example.com --token <INGEST_TOKEN>
//   node scripts/sync.mjs --watch 300          # keep running, sync every 5 minutes
//
// Options (or env vars):
//   --url    CLAUDE_ANALYZER_URL     server base URL
//   --token  CLAUDE_ANALYZER_TOKEN   the server's INGEST_TOKEN
//   --dir    CLAUDE_PROJECTS_DIR     default ~/.claude/projects
//   --state  CLAUDE_ANALYZER_STATE   default ~/.claude-analyzer-sync.json (remembers file offsets)
//   --watch  <seconds>               loop forever
//   --reset                          forget offsets and resend everything (safe: the server dedupes)
//
// Only token counts, model names, timestamps, project folder names, tool names and prompt
// lengths are sent. Prompt and response text never leave your machine.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { batchSize, emptyBatch, listLogFiles, parseLine, readNewLines } from '../lib/claude-log.mjs'

function arg(name) {
  const i = process.argv.indexOf('--' + name)
  if (i === -1) return undefined
  const v = process.argv[i + 1]
  return v && !v.startsWith('--') ? v : true
}

const url = String(arg('url') ?? process.env.CLAUDE_ANALYZER_URL ?? '').replace(/\/+$/, '')
const token = arg('token') ?? process.env.CLAUDE_ANALYZER_TOKEN
const dir = arg('dir') ?? process.env.CLAUDE_PROJECTS_DIR ?? path.join(os.homedir(), '.claude', 'projects')
const stateFile = arg('state') ?? process.env.CLAUDE_ANALYZER_STATE ?? path.join(os.homedir(), '.claude-analyzer-sync.json')
const watch = Number(arg('watch')) || 0
const MAX_RECORDS = 3000

if (!url || !token || token === true) {
  console.error('Usage: node scripts/sync.mjs --url <server url> --token <INGEST_TOKEN> [--watch 300]')
  process.exit(2)
}

function loadState() {
  if (arg('reset')) return {}
  try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')) } catch { return {} }
}

function saveState(s) {
  fs.writeFileSync(stateFile + '.tmp', JSON.stringify(s))
  fs.renameSync(stateFile + '.tmp', stateFile)
}

async function post(batch) {
  const res = await fetch(url + '/api/ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify({ ...batch, host: os.hostname() }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text().catch(() => '')}`.trim())
  return res.json()
}

async function syncOnce() {
  const state = loadState()
  const files = listLogFiles(dir)
  let sent = 0
  let changed = 0
  let batch = emptyBatch()
  let pending = {} // offsets to commit once the current batch is accepted

  const flush = async () => {
    if (batchSize(batch)) {
      const r = await post(batch)
      sent += r.records ?? 0
    }
    Object.assign(state, pending)
    saveState(state)
    batch = emptyBatch()
    pending = {}
  }

  for (const f of files) {
    const prev = state[f] ?? 0
    let res
    try { res = readNewLines(f, prev) } catch { continue }
    if (res.offset === prev) continue
    changed++
    for (const line of res.lines) parseLine(line, batch)
    pending[f] = res.offset
    if (batchSize(batch) >= MAX_RECORDS) await flush()
  }
  await flush()
  console.log(`[${new Date().toLocaleTimeString()}] ${changed}/${files.length} files changed, ${sent} records sent to ${url}`)
}

if (!fs.existsSync(dir)) {
  console.error(`Claude projects folder not found: ${dir} (use --dir)`)
  process.exit(1)
}

if (watch > 0) {
  for (;;) {
    try { await syncOnce() } catch (e) { console.error('sync failed:', e.message) }
    await new Promise(r => setTimeout(r, watch * 1000))
  }
} else {
  try { await syncOnce() } catch (e) { console.error('sync failed:', e.message); process.exit(1) }
}
