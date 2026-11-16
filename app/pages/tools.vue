<script setup lang="ts">
import type { Column } from '~/utils/types'

const { data } = useStats<any>('/api/stats/tools')
const { colors } = useTheme()
const ent = useEntityColors()

watch(data, (d) => { if (d?.daily?.keys) ent.prime('tool', d.daily.keys) }, { immediate: true })

const daily = computed(() => {
  const p = data.value?.daily
  if (!p?.keys.length) return null
  return stackedBars(colors.value, { categories: p.days, series: p.keys.map((k: string) => ({ name: k, data: p.series[k], color: ent.color('tool', k) })), fmt: fmtInt })
})

const total = computed(() => (data.value?.tools ?? []).reduce((s: number, t: any) => s + t.count, 0))
const errors = computed(() => (data.value?.tools ?? []).reduce((s: number, t: any) => s + t.errors, 0))

const rows = computed(() => (data.value?.tools ?? []).map((t: any) => ({ ...t, rate: t.count ? t.errors / t.count : 0, share: total.value ? t.count / total.value : 0 })))
const columns: Column[] = [
  { key: 'name', label: 'Tool' },
  { key: 'count', label: 'Calls', num: true, fmt: fmtInt },
  { key: 'share', label: 'Share', num: true, fmt: v => fmtPct(v) },
  { key: 'sessions', label: 'Sessions', num: true, fmt: fmtInt },
  { key: 'sidechain', label: 'By subagents', num: true, fmt: fmtInt },
  { key: 'errors', label: 'Errors', num: true, fmt: fmtInt },
  { key: 'rate', label: 'Error rate', num: true, fmt: v => fmtPct(v) },
]

const mcp = computed(() => {
  const r = data.value?.mcp
  if (!r?.length) return null
  return rankBars(colors.value, { labels: r.map((x: any) => x.server), values: r.map((x: any) => x.count), colors: colors.value.series[6]!, fmt: fmtInt })
})
const commands = computed(() => {
  const r = data.value?.commands
  if (!r?.length) return null
  return rankBars(colors.value, { labels: r.map((x: any) => '/' + x.command), values: r.map((x: any) => x.count), colors: colors.value.series[2]!, fmt: fmtInt })
})
</script>

<template>
  <div class="grid">
    <h1>Tools</h1>
    <div class="grid kpis">
      <KpiTile label="Tool calls" :value="fmtInt(total)" />
      <KpiTile label="Distinct tools" :value="fmtInt(data?.tools?.length)" />
      <KpiTile label="Failed tool calls" :value="fmtInt(errors)" :sub="total ? fmtPct(errors / total) + ' error rate' : undefined" />
      <KpiTile label="MCP servers used" :value="fmtInt(data?.mcp?.length)" />
      <KpiTile label="Web searches" :value="fmtInt(data?.server?.web_search)" sub="server-side" />
      <KpiTile label="Web fetches" :value="fmtInt(data?.server?.web_fetch)" sub="server-side" />
    </div>
    <ChartCard title="Daily tool calls" subtitle="Top 6 tools" :option="daily" :empty="data && !daily" :height="300" />
    <div class="grid cols-2">
      <section class="card span-2">
        <h2 style="margin-bottom: 12px">All tools</h2>
        <DataTable :columns="columns" :rows="rows" sort-key="count" search :search-keys="['name']">
          <template #cell-name="{ row }"><span class="mono">{{ row.name }}</span></template>
        </DataTable>
      </section>
      <ChartCard title="MCP servers" subtitle="Calls per server" :option="mcp" :empty="data && !mcp" :height="barsHeight(data?.mcp?.length)" />
      <ChartCard title="Slash commands" subtitle="Commands you typed" :option="commands" :empty="data && !commands" :height="barsHeight(data?.commands?.length)" />
    </div>
  </div>
</template>
