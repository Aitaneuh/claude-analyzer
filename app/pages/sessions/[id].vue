<script setup lang="ts">
import type { Column } from '~/utils/types'

const route = useRoute()
const id = computed(() => String(route.params.id))
const refreshKey = useState('refresh-key', () => 0)
const { data, error } = useFetch<any>(() => `/api/stats/sessions/${id.value}`, { server: false, query: computed(() => ({ _r: refreshKey.value })) })
const { colors } = useTheme()
const ent = useEntityColors()

const s = computed(() => data.value?.summary)

const kpis = computed(() => {
  const x = s.value
  if (!x) return []
  return [
    { label: 'Est. cost', value: fmtUsd(x.cost) },
    { label: 'Duration', value: fmtDuration(x.duration_s), sub: fmtDateTime(x.started) },
    { label: 'API calls', value: fmtInt(x.messages) },
    { label: 'Prompts', value: fmtInt(data.value.prompts.length) },
    { label: 'Total tokens', value: fmtTokens(x.total), sub: `${fmtTokens(x.output)} output` },
    { label: 'Cache hit rate', value: fmtPct(cacheHitRate(x)) },
  ]
})

const timeline = computed(() => {
  const msgs = data.value?.messages
  if (!msgs?.length) return null
  let cum = 0
  let cost = 0
  const cats: string[] = []
  const ctx: number[] = []
  const costs: number[] = []
  for (const m of msgs) {
    cum += m.output_tokens
    cost += m.cost
    cats.push(m.ts)
    ctx.push(m.input_tokens + m.cache_write + m.cache_read)
    costs.push(cost)
  }
  const tf = (v: string) => new Date(v).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return {
    ctx: lineChart(colors.value, { categories: cats, series: [{ name: 'Context size', data: ctx, color: colors.value.series[0]! }], fmt: fmtTokens, xFmt: tf, area: true }),
    cost: lineChart(colors.value, { categories: cats, series: [{ name: 'Cumulative cost', data: costs, color: colors.value.series[1]! }], fmt: v => fmtUsd(v), xFmt: tf }),
  }
})

const tools = computed(() => {
  const rows = data.value?.tools
  if (!rows?.length) return null
  return rankBars(colors.value, { labels: rows.map((r: any) => r.name), values: rows.map((r: any) => r.count), colors: colors.value.series[0]!, fmt: fmtInt })
})

const columns: Column[] = [
  { key: 'ts', label: 'Time', fmt: v => new Date(v).toLocaleTimeString() },
  { key: 'model', label: 'Model', fmt: modelLabel },
  { key: 'input_tokens', label: 'Input', num: true, fmt: fmtTokens },
  { key: 'cache_write', label: 'Cache write', num: true, fmt: fmtTokens },
  { key: 'cache_read', label: 'Cache read', num: true, fmt: fmtTokens },
  { key: 'output_tokens', label: 'Output', num: true, fmt: fmtTokens },
  { key: 'thinking_tokens', label: 'Thinking', num: true, fmt: fmtTokens },
  { key: 'tools', label: 'Tools', fmt: v => v ?? '' },
  { key: 'stop_reason', label: 'Stop' },
  { key: 'cost', label: 'Cost', num: true, fmt: v => fmtUsd(v, 4) },
]
</script>

<template>
  <div class="grid">
    <div>
      <NuxtLink :to="{ path: '/sessions', query: route.query }" class="faint back">← Sessions</NuxtLink>
      <h1>{{ s?.title || id }}</h1>
      <p v-if="s" class="muted meta">
        <span class="pill">{{ s.project }}</span>
        <span v-if="s.git_branch" class="pill">⎇ {{ s.git_branch }}</span>
        <span v-if="s.version" class="pill">v{{ s.version }}</span>
        <code>{{ id }}</code>
      </p>
    </div>
    <div v-if="error" class="notice">Session not found.</div>

    <div class="grid kpis">
      <KpiTile v-for="k in kpis" :key="k.label" v-bind="k" />
    </div>

    <div class="grid cols-2">
      <ChartCard title="Context size per call" subtitle="Prompt tokens sent on each API call" :option="timeline?.ctx" :height="240" />
      <ChartCard title="Cumulative cost" :option="timeline?.cost" :height="240" />
    </div>

    <div class="grid cols-2">
      <section class="card">
        <h2 style="margin-bottom: 12px">Models</h2>
        <table class="data">
          <thead><tr><th>Model</th><th class="num">Calls</th><th class="num">Output</th><th class="num">Cost</th></tr></thead>
          <tbody>
            <tr v-for="m in data?.byModel ?? []" :key="m.model">
              <td><span class="swatch" :style="{ background: ent.color('model', m.model) }" />{{ modelLabel(m.model) }}</td>
              <td class="num">{{ fmtInt(m.messages) }}</td>
              <td class="num">{{ fmtTokens(m.output) }}</td>
              <td class="num">{{ fmtUsd(m.cost) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <ChartCard title="Tools used" :option="tools" :empty="data && !tools" :height="barsHeight(data?.tools?.length)" />
    </div>

    <section class="card">
      <h2 style="margin-bottom: 12px">API calls</h2>
      <DataTable :columns="columns" :rows="data?.messages ?? []" />
    </section>
  </div>
</template>

<style scoped>
.back { text-decoration: none; font-size: 13px; }
h1 { margin-top: 6px; }
.meta { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin: 8px 0 0; }
</style>
