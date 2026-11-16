<script setup lang="ts">
const days = ref(30)
const refreshKey = useState('refresh-key', () => 0)
const { data, pending } = useFetch<any>('/api/org/usage', { server: false, query: computed(() => ({ days: days.value, _r: refreshKey.value })) })
const { colors } = useTheme()
const ent = useEntityColors()

function pivot(rows: any[], value: string) {
  const dayset = [...new Set(rows.map(r => r.day))].sort()
  const totals = new Map<string, number>()
  for (const r of rows) totals.set(r.model, (totals.get(r.model) ?? 0) + r[value])
  const keys = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0])
  ent.prime('model', keys)
  const idx = new Map(dayset.map((d, i) => [d, i]))
  const series = keys.map(k => ({ name: modelLabel(k), data: dayset.map(() => 0), color: ent.color('model', k) }))
  for (const r of rows) series[keys.indexOf(r.model)]!.data[idx.get(r.day)!]! += r[value]
  return { days: dayset, series }
}

const costChart = computed(() => {
  const rows = data.value?.cost
  if (!rows?.length) return null
  const p = pivot(rows, 'usd')
  return stackedBars(colors.value, { categories: p.days, series: p.series, fmt: v => fmtUsd(v) })
})
const tokenChart = computed(() => {
  const rows = data.value?.usage
  if (!rows?.length) return null
  const p = pivot(rows, 'total')
  return stackedBars(colors.value, { categories: p.days, series: p.series, fmt: fmtTokens })
})

const totals = computed(() => {
  const u = data.value?.usage ?? []
  const c = data.value?.cost ?? []
  const sum = (a: any[], k: string) => a.reduce((s, r) => s + (r[k] || 0), 0)
  return { usd: sum(c, 'usd'), list: sum(c, 'list_usd'), tokens: sum(u, 'total'), requests: sum(u, 'requests'), output: sum(u, 'output'), cacheRead: sum(u, 'cache_read'), web: sum(u, 'web_search') }
})
</script>

<template>
  <div class="grid">
    <div class="head">
      <h1>API organization</h1>
      <p class="muted">Real billed usage of your Claude Console organization from Anthropic's Usage &amp; Cost Analytics API. It covers every API key in the org, not only Claude Code. Data lands within about 4 hours.</p>
    </div>

    <div v-if="data && !data.enabled" class="notice">
      Not configured. Set <code>ANTHROPIC_ADMIN_KEY</code> to an Admin API key (<code>sk-ant-admin...</code>, created under Console → Settings → Admin keys) and restart the container.
      This needs a Claude Console organization; personal Pro/Max subscriptions don't have one.
    </div>
    <div v-else-if="data?.error" class="notice">The Anthropic API returned an error: <code>{{ data.error }}</code></div>

    <template v-else-if="data?.enabled">
      <div class="seg" style="width: max-content">
        <button v-for="d in [7, 30, 90, 180]" :key="d" :class="{ on: days === d }" @click="days = d">{{ d }} days</button>
      </div>
      <div class="grid kpis">
        <KpiTile label="Cost (after discounts)" :value="fmtUsd(totals.usd)" :sub="`list ${fmtUsd(totals.list)}`" />
        <KpiTile label="Requests" :value="fmtInt(totals.requests)" />
        <KpiTile label="Total tokens" :value="fmtTokens(totals.tokens)" />
        <KpiTile label="Output tokens" :value="fmtTokens(totals.output)" />
        <KpiTile label="Cache reads" :value="fmtTokens(totals.cacheRead)" />
        <KpiTile label="Web searches" :value="fmtInt(totals.web)" />
      </div>
      <ChartCard title="Daily cost by model (UTC)" :option="costChart" :empty="!pending && !costChart" :height="300" />
      <ChartCard title="Daily tokens by model (UTC)" :option="tokenChart" :empty="!pending && !tokenChart" :height="300" />
    </template>
  </div>
</template>

<style scoped>
.head p { margin: 4px 0 0; max-width: 820px; }
</style>
