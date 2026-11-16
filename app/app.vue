<script setup lang="ts">
import type { Preset } from '~/composables/useFilters'

const route = useRoute()
const router = useRouter()
const { state } = useFilters()
const theme = useTheme()
const refreshKey = useState('refresh-key', () => 0)
const navOpen = ref(false)

const { data: meta, refresh: refreshMeta } = useFetch<any>('/api/meta', { server: false, query: computed(() => ({ _r: refreshKey.value })) })

// Filters <-> URL query, so views are linkable.
onMounted(() => {
  theme.init()
  const q = route.query
  if (typeof q.range === 'string') state.value.preset = q.range as Preset
  if (typeof q.from === 'string') state.value.from = q.from
  if (typeof q.to === 'string') state.value.to = q.to
  if (typeof q.project === 'string') state.value.project = q.project
})
watch(state, (s) => {
  const query: Record<string, string> = { ...route.query as Record<string, string> }
  query.range = s.preset
  if (s.preset === 'custom') { query.from = s.from; query.to = s.to } else { delete query.from; delete query.to }
  if (s.project) query.project = s.project; else delete query.project
  router.replace({ query })
}, { deep: true })

const presets: Array<{ id: Preset, label: string }> = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: 'ytd', label: 'YTD' },
  { id: 'all', label: 'All' },
  { id: 'custom', label: 'Custom' },
]

const nav = [
  { to: '/', label: 'Overview' },
  { to: '/models', label: 'Models' },
  { to: '/projects', label: 'Projects' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/tools', label: 'Tools' },
  { to: '/activity', label: 'Activity' },
  { to: '/org', label: 'API organization' },
  { to: '/settings', label: 'Data & sync' },
]

const scanning = ref(false)
async function rescan() {
  scanning.value = true
  try {
    if (meta.value?.sources?.localDir) await $fetch('/api/scan', { method: 'POST' })
  } catch (e) {
    console.error(e)
  } finally {
    scanning.value = false
    refreshKey.value++
    refreshMeta()
  }
}

const lastUpdate = computed(() => {
  const a = meta.value?.lastScan?.at
  const b = meta.value?.lastIngest?.at
  return [a, b].filter(Boolean).sort().pop() ?? null
})

watch(() => route.path, () => (navOpen.value = false))
</script>

<template>
  <div class="shell">
    <aside :class="{ open: navOpen }">
      <div class="brand">
        <img src="/favicon.svg" alt="" width="22" height="22">
        <span>Claude Analyzer</span>
      </div>
      <nav>
        <NuxtLink v-for="n in nav" :key="n.to" :to="{ path: n.to, query: route.query }" :class="{ active: n.to === '/' ? route.path === '/' : route.path.startsWith(n.to) }">{{ n.label }}</NuxtLink>
      </nav>
      <div class="side-foot faint">
        <div>{{ fmtInt(meta?.messages) }} API calls stored</div>
        <div>Updated {{ fmtAgo(lastUpdate) }}</div>
        <div v-if="meta?.timezone">TZ {{ meta.timezone }}</div>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <button class="btn menu" aria-label="Menu" @click="navOpen = !navOpen">☰</button>
        <div class="seg" role="group" aria-label="Date range">
          <button v-for="p in presets" :key="p.id" :class="{ on: state.preset === p.id }" @click="state.preset = p.id">{{ p.label }}</button>
        </div>
        <template v-if="state.preset === 'custom'">
          <input v-model="state.from" type="date" aria-label="From">
          <input v-model="state.to" type="date" aria-label="To">
        </template>
        <select v-model="state.project" aria-label="Project">
          <option value="">All projects</option>
          <option v-for="p in meta?.projects ?? []" :key="p" :value="p">{{ p }}</option>
        </select>
        <div class="spacer" />
        <button class="btn" :disabled="scanning" title="Rescan logs and refresh" @click="rescan">{{ scanning ? 'Refreshing...' : '↻ Refresh' }}</button>
        <button class="btn" :aria-label="theme.isDark.value ? 'Switch to light theme' : 'Switch to dark theme'" @click="theme.toggle()">{{ theme.isDark.value ? '☀' : '☾' }}</button>
      </header>
      <main>
        <NuxtPage />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell { display: grid; grid-template-columns: 220px minmax(0, 1fr); min-height: 100vh; }
aside { background: var(--surface); border-right: 1px solid var(--border); padding: 16px 12px; display: flex; flex-direction: column; gap: 16px; position: sticky; top: 0; height: 100vh; }
.brand { display: flex; align-items: center; gap: 10px; font-weight: 600; padding: 4px 8px; }
nav { display: flex; flex-direction: column; gap: 2px; }
nav a { text-decoration: none; color: var(--text-2); padding: 7px 10px; border-radius: 7px; }
nav a:hover { background: var(--surface-2); color: var(--text); }
nav a.active { background: var(--surface-2); color: var(--text); font-weight: 600; }
.side-foot { margin-top: auto; font-size: 12px; padding: 0 8px; display: grid; gap: 2px; }
.main { min-width: 0; }
.topbar { display: flex; gap: 8px; align-items: center; padding: 12px 24px; border-bottom: 1px solid var(--border); background: var(--bg); position: sticky; top: 0; z-index: 5; flex-wrap: wrap; }
.spacer { flex: 1; }
main { padding: 24px; max-width: 1500px; }
.menu { display: none; }
@media (max-width: 860px) {
  .shell { grid-template-columns: minmax(0, 1fr); }
  aside { position: fixed; z-index: 10; width: 240px; transform: translateX(-100%); transition: transform .2s; box-shadow: 0 0 30px rgb(0 0 0 / .2); }
  aside.open { transform: none; }
  .menu { display: inline-flex; }
  .topbar { padding: 10px 16px; }
  main { padding: 16px; }
}
</style>
