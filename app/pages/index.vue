<script setup lang="ts">
const { data } = useStats<any>('/api/stats/overview')
const { colors } = useTheme()
const ent = useEntityColors()

const metric = ref<'cost' | 'tokens' | 'messages'>('tokens')
const withCacheReads = ref(false)

const t = computed(() => data.value?.totals)
const p = computed(() => data.value?.prev)

const kpis = computed(() => {
  if (!t.value) return []
  const x = t.value
  const prev = p.value
  return [
    { label: 'Est. cost (API prices)', value: fmtUsd(x.cost), change: delta(x.cost, prev?.cost), invert: true, sub: 'list price equivalent' },
    { label: 'Total tokens', value: fmtTokens(x.total), change: delta(x.total, prev?.total), sub: `${fmtTokens(x.input + x.cache_write)} fresh input` },
    { label: 'Output tokens', value: fmtTokens(x.output), change: delta(x.output, prev?.output), sub: `${fmtTokens(x.thinking)} thinking` },
    { label: 'API calls', value: fmtInt(x.messages), change: delta(x.messages, prev?.messages), sub: `${fmtInt(x.sidechain_messages)} by subagents` },
    { label: 'Sessions', value: fmtInt(x.sessions), change: delta(x.sessions, prev?.sessions), sub: `${fmtInt(x.projects)} projects` },
    { label: 'Prompts typed', value: fmtInt(x.prompts), change: delta(x.prompts, prev?.prompts) },
    { label: 'Tool calls', value: fmtInt(x.tools), change: delta(x.tools, prev?.tools), sub: x.prompts ? `${(x.tools / x.prompts).toFixed(1)} per prompt` : undefined },
    { label: 'Cache hit rate', value: fmtPct(cacheHitRate(x)), sub: `${fmtTokens(x.cache_read)} read from cache` },
    { label: 'Saved by caching', value: fmtUsd(Math.max(0, x.cost_nocache - x.cost)), sub: x.cost_nocache ? `${fmtPct(1 - x.cost / x.cost_nocache, 0)} cheaper` : undefined },
    { label: 'Active days', value: fmtInt(x.active_days), sub: x.active_days ? `${fmtUsd(x.cost / x.active_days)} / active day` : undefined },
  ]
})

const daily = computed(() => {
  const d = data.value?.daily
  if (!d) return null
  const c = colors.value
  const cats = d.map((r: any) => r.day)
  if (metric.value === 'cost') return stackedBars(c, { categories: cats, series: [{ name: 'Cost', data: d.map((r: any) => r.cost), color: c.series[0]! }], fmt: v => fmtUsd(v) })
  if (metric.value === 'messages') return stackedBars(c, { categories: cats, series: [{ name: 'API calls', data: d.map((r: any) => r.messages), color: c.series[0]! }], fmt: fmtInt })
  const series = [
    { name: 'Input', data: d.map((r: any) => r.input), color: c.series[0]! },
    { name: 'Output', data: d.map((r: any) => r.output), color: c.series[1]! },
    { name: 'Cache write', data: d.map((r: any) => r.cache_write), color: c.series[2]! },
  ]
  if (withCacheReads.value) series.push({ name: 'Cache read', data: d.map((r: any) => r.cache_read), color: c.series[3]! })
  return stackedBars(c, { categories: cats, series, fmt: fmtTokens })
})

const byModel = computed(() => {
  const rows = data.value?.byModel
  if (!rows?.length) return null
  ent.prime('model', rows.map((r: any) => r.model))
  return rankBars(colors.value, { labels: rows.map((r: any) => modelLabel(r.model)), values: rows.map((r: any) => r.cost), colors: rows.map((r: any) => ent.color('model', r.model)), fmt: v => fmtUsd(v) })
})

const byProject = computed(() => {
  const rows = data.value?.byProject
  if (!rows?.length) return null
  ent.prime('project', rows.map((r: any) => r.project))
  return rankBars(colors.value, { labels: rows.map((r: any) => r.project), values: rows.map((r: any) => r.cost), colors: rows.map((r: any) => ent.color('project', r.project)), fmt: v => fmtUsd(v) })
})

const tokenMix = computed(() => {
  const x = t.value
  if (!x) return null
  const c = colors.value
  return rankBars(c, {
    labels: ['Cache read', 'Cache write', 'Output', 'Input (uncached)'],
    values: [x.cache_read, x.cache_write, x.output, x.input],
    colors: [c.series[3]!, c.series[2]!, c.series[1]!, c.series[0]!],
    fmt: fmtTokens,
  })
})

const tools = computed(() => {
  const rows = data.value?.topTools
  if (!rows?.length) return null
  return rankBars(colors.value, { labels: rows.map((r: any) => r.name), values: rows.map((r: any) => r.count), colors: colors.value.series[0]!, fmt: fmtInt })
})
</script>

<template>
  <div class="grid">
    <div class="head">
      <h1>Overview</h1>
      <p class="muted">Usage recorded by Claude Code. Costs are estimates at pay-as-you-go API list prices. On a Pro/Max plan they show what the same usage would cost on the API, not what you're billed.</p>
    </div>

    <div v-if="data && !t?.messages" class="notice">
      No usage in this range yet. Check <NuxtLink to="/settings">Data &amp; sync</NuxtLink> to connect your Claude Code logs.
    </div>

    <div class="grid kpis">
      <KpiTile v-for="k in kpis" :key="k.label" v-bind="k" />
    </div>

    <ChartCard title="Daily usage" :subtitle="metric === 'tokens' && !withCacheReads ? 'Cache reads hidden: they usually dwarf everything else' : undefined" :option="daily" :height="300">
      <template #actions>
        <label v-if="metric === 'tokens'" class="muted chk"><input v-model="withCacheReads" type="checkbox"> Include cache reads</label>
        <div class="seg">
          <button :class="{ on: metric === 'tokens' }" @click="metric = 'tokens'">Tokens</button>
          <button :class="{ on: metric === 'cost' }" @click="metric = 'cost'">Cost</button>
          <button :class="{ on: metric === 'messages' }" @click="metric = 'messages'">API calls</button>
        </div>
      </template>
    </ChartCard>

    <div class="grid cols-2">
      <ChartCard title="Cost by model" :option="byModel" :empty="data && !byModel" :height="barsHeight(data?.byModel?.length)" />
      <ChartCard title="Cost by project" subtitle="Top 8" :option="byProject" :empty="data && !byProject" :height="barsHeight(data?.byProject?.length)" />
      <ChartCard title="Token mix" subtitle="Where your tokens go" :option="tokenMix" :height="barsHeight(4)" />
      <ChartCard title="Most used tools" :option="tools" :empty="data && !tools" :height="barsHeight(data?.topTools?.length)" />
    </div>
  </div>
</template>

<style scoped>
.head p { margin: 4px 0 0; max-width: 820px; }
.chk { display: inline-flex; gap: 6px; align-items: center; font-size: 12px; margin-right: 8px; }
</style>
