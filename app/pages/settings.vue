<script setup lang="ts">
const refreshKey = useState('refresh-key', () => 0)
const { data: meta } = useFetch<any>('/api/meta', { server: false, query: computed(() => ({ _r: refreshKey.value })) })
const origin = computed(() => (import.meta.client ? window.location.origin : ''))
</script>

<template>
  <div class="grid">
    <h1>Data &amp; sync</h1>

    <div class="grid cols-3">
      <section class="card">
        <h2>Local log folder</h2>
        <p v-if="meta?.sources.localDir" class="muted">Scanning <code>{{ meta.sources.localDir }}</code></p>
        <p v-else class="muted">Not configured (<code>CLAUDE_PROJECTS_DIR</code> unset).</p>
        <p v-if="meta?.lastScan" class="faint">
          Last scan {{ fmtAgo(meta.lastScan.at) }}: {{ meta.lastScan.files }} files, {{ meta.lastScan.changed }} changed, {{ fmtInt(meta.lastScan.records) }} records, {{ meta.lastScan.ms }} ms
        </p>
      </section>
      <section class="card">
        <h2>Push sync</h2>
        <p class="muted">{{ meta?.sources.ingestEnabled ? 'Enabled: /api/ingest accepts data.' : 'Disabled (INGEST_TOKEN unset).' }}</p>
        <p v-if="meta?.lastIngest" class="faint">Last push {{ fmtAgo(meta.lastIngest.at) }} from {{ meta.lastIngest.host || 'unknown host' }} ({{ fmtInt(meta.lastIngest.records) }} records)</p>
      </section>
      <section class="card">
        <h2>Admin API</h2>
        <p class="muted">{{ meta?.sources.adminApi ? 'Configured: see API organization.' : 'Not configured (optional).' }}</p>
      </section>
    </div>

    <section class="card">
      <h2>Stored data</h2>
      <p class="muted">{{ fmtInt(meta?.messages) }} API calls from {{ fmtDate(meta?.firstDay) }} to {{ fmtDate(meta?.lastDay) }} across {{ meta?.projects?.length ?? 0 }} projects. Days and hours use the server timezone <code>{{ meta?.timezone }}</code> (set <code>TZ</code>).</p>
    </section>

    <section class="card">
      <h2>Sending logs from another computer</h2>
      <p class="muted">When the dashboard runs on a server, run the sync script on the machine where you use Claude Code. It reads only new lines of <code>~/.claude/projects/**/*.jsonl</code>, keeps token counts and tool names, and never uploads prompt or response text.</p>
      <pre class="mono">node scripts/sync.mjs --url {{ origin }} --token &lt;INGEST_TOKEN&gt;            # one-shot
node scripts/sync.mjs --url {{ origin }} --token &lt;INGEST_TOKEN&gt; --watch 300  # every 5 min</pre>
      <p class="faint">See DEPLOYMENT.md for running it at login with Windows Task Scheduler, launchd or systemd.</p>
    </section>
  </div>
</template>

<style scoped>
pre { background: var(--surface-2); padding: 12px; border-radius: 8px; overflow: auto; }
section p { margin: 6px 0 0; }
</style>
