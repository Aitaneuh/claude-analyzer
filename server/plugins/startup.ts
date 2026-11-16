import fs from 'node:fs'

export default defineNitroPlugin(() => {
  loadPricing()
  useDb()
  const n = repriceAll()
  if (n) console.log(`[pricing] re-priced ${n} messages`)
  reprojectAll()

  const dir = process.env.CLAUDE_PROJECTS_DIR
  if (!dir) {
    console.log('[scan] CLAUDE_PROJECTS_DIR not set - only /api/ingest will receive data')
    return
  }
  if (!fs.existsSync(dir)) {
    console.log(`[scan] ${dir} is not mounted - folder scanning off, waiting for pushes on /api/ingest`)
    return
  }
  const run = () => {
    try {
      const r = scanDirectory(dir)
      if (!('skipped' in r) && r.changed) console.log(`[scan] ${r.changed}/${r.files} files changed, ${r.records} records in ${r.ms}ms`)
    } catch (e) {
      console.error('[scan] failed:', e)
    }
  }
  setTimeout(run, 500)
  const every = Number(process.env.SCAN_INTERVAL_SECONDS ?? 300)
  if (every > 0) setInterval(run, every * 1000)
})
