<script setup lang="ts">
import type { Column, Pivot } from '~/utils/types'

const { data } = useStats<any>('/api/stats/models')
const { colors } = useTheme()
const ent = useEntityColors()
const metric = ref<'cost' | 'tokens'>('cost')

watch(data, (d) => { if (d?.models) ent.prime('model', d.models.map((m: any) => m.model)) }, { immediate: true })

function pivotChart(p: Pivot | undefined, fmt: (v: number) => string) {
  if (!p?.keys.length) return null
  return stackedBars(colors.value, {
    categories: p.days,
    series: p.keys.map(k => ({ name: modelLabel(k) === k ? k : modelLabel(k), data: p.series[k]!, color: ent.color('model', k) })),
    fmt,
  })
}

const daily = computed(() => metric.value === 'cost' ? pivotChart(data.value?.dailyCost, v => fmtUsd(v)) : pivotChart(data.value?.dailyTokens, fmtTokens))

const total = computed(() => (data.value?.models ?? []).reduce((s: number, m: any) => s + m.cost, 0))

const rows = computed(() => (data.value?.models ?? []).map((m: any) => ({
  ...m,
  share: total.value ? m.cost / total.value : 0,
  avg_out: m.messages ? m.output / m.messages : 0,
  cost_per_call: m.messages ? m.cost / m.messages : 0,
  hit: cacheHitRate(m),
})))

const columns: Column[] = [
  { key: 'model', label: 'Model' },
  { key: 'messages', label: 'Calls', num: true, fmt: fmtInt },
  { key: 'sessions', label: 'Sessions', num: true, fmt: fmtInt },
  { key: 'input', label: 'Input', num: true, fmt: fmtTokens },
  { key: 'output', label: 'Output', num: true, fmt: fmtTokens },
  { key: 'thinking', label: 'Thinking', num: true, fmt: fmtTokens },
  { key: 'cache_write', label: 'Cache write', num: true, fmt: fmtTokens },
  { key: 'cache_read', label: 'Cache read', num: true, fmt: fmtTokens },
  { key: 'hit', label: 'Cache hit', num: true, fmt: v => fmtPct(v) },
  { key: 'avg_out', label: 'Avg out/call', num: true, fmt: fmtTokens },
  { key: 'cost_per_call', label: '$/call', num: true, fmt: v => fmtUsd(v, 4) },
  { key: 'cost', label: 'Est. cost', num: true, fmt: v => fmtUsd(v) },
  { key: 'share', label: 'Share', num: true, fmt: v => fmtPct(v, 0) },
]

function simpleBars(rows: any[] | undefined, label: string, value: string, fmt: (v: number) => string) {
  if (!rows?.length) return null
  return rankBars(colors.value, { labels: rows.map(r => String(r[label])), values: rows.map(r => r[value]), colors: colors.value.series[0]!, fmt })
}

const effortAgg = computed(() => {
  const m = new Map<string, number>()
  for (const r of data.value?.effort ?? []) m.set(r.effort, (m.get(r.effort) ?? 0) + r.messages)
  return [...m.entries()].map(([effort, messages]) => ({ effort, messages })).sort((a, b) => b.messages - a.messages)
})
const effort = computed(() => simpleBars(effortAgg.value, 'effort', 'messages', fmtInt))
const stop = computed(() => simpleBars(data.value?.stop, 'stop_reason', 'messages', fmtInt))
const versions = computed(() => simpleBars(data.value?.versions, 'version', 'messages', fmtInt))
const speed = computed(() => simpleBars(data.value?.speed, 'speed', 'cost', v => fmtUsd(v)))
</script>

<template>
  <div class="grid">
    <h1>Models</h1>
    <ChartCard :title="metric === 'cost' ? 'Daily cost by model' : 'Daily tokens by model'" :option="daily" :empty="data && !daily" :height="320">
      <template #actions>
        <div class="seg">
          <button :class="{ on: metric === 'cost' }" @click="metric = 'cost'">Cost</button>
          <button :class="{ on: metric === 'tokens' }" @click="metric = 'tokens'">Tokens</button>
        </div>
      </template>
    </ChartCard>

    <section class="card">
      <h2 style="margin-bottom: 12px">Per-model breakdown</h2>
      <DataTable :columns="columns" :rows="rows" sort-key="cost">
        <template #cell-model="{ row }">
          <span class="swatch" :style="{ background: ent.color('model', row.model) }" />{{ modelLabel(row.model) }}
          <span class="faint mono"> {{ row.model }}</span>
          <span v-if="row.fast_messages" class="pill" style="margin-left: 6px">{{ row.fast_messages }} fast</span>
        </template>
      </DataTable>
    </section>

    <div class="grid cols-2">
      <ChartCard title="Effort level" subtitle="API calls per effort setting" :option="effort" :empty="data && !effort" :height="barsHeight(effortAgg.length)" />
      <ChartCard title="Stop reasons" :option="stop" :empty="data && !stop" :height="barsHeight(data?.stop?.length)" />
      <ChartCard title="Speed" subtitle="Cost by speed mode" :option="speed" :empty="data && !speed" :height="barsHeight(data?.speed?.length)" />
      <ChartCard title="Claude Code versions" subtitle="API calls per client version (newest first)" :option="versions" :empty="data && !versions" :height="barsHeight(data?.versions?.length)" />
    </div>
  </div>
</template>
