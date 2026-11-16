<script setup lang="ts">
import type { Column } from '~/utils/types'

const { data } = useStats<any>('/api/stats/projects')
const { colors } = useTheme()
const ent = useEntityColors()
const { state } = useFilters()

watch(data, (d) => { if (d?.projects) ent.prime('project', d.projects.map((p: any) => p.project)) }, { immediate: true })

const daily = computed(() => {
  const p = data.value?.dailyCost
  if (!p?.keys.length) return null
  return stackedBars(colors.value, {
    categories: p.days,
    series: p.keys.map((k: string) => ({ name: k, data: p.series[k], color: ent.color('project', k) })),
    fmt: v => fmtUsd(v),
  })
})

const rows = computed(() => (data.value?.projects ?? []).map((p: any) => ({ ...p, hit: cacheHitRate(p), per_session: p.sessions ? p.cost / p.sessions : 0 })))

const columns: Column[] = [
  { key: 'project', label: 'Project' },
  { key: 'sessions', label: 'Sessions', num: true, fmt: fmtInt },
  { key: 'prompts', label: 'Prompts', num: true, fmt: fmtInt },
  { key: 'messages', label: 'API calls', num: true, fmt: fmtInt },
  { key: 'tools', label: 'Tool calls', num: true, fmt: fmtInt },
  { key: 'output', label: 'Output', num: true, fmt: fmtTokens },
  { key: 'total', label: 'Total tokens', num: true, fmt: fmtTokens },
  { key: 'hit', label: 'Cache hit', num: true, fmt: v => fmtPct(v) },
  { key: 'top_model', label: 'Main model', fmt: modelLabel },
  { key: 'active_days', label: 'Active days', num: true, fmt: fmtInt },
  { key: 'last_active', label: 'Last active', fmt: fmtDateTime },
  { key: 'per_session', label: '$/session', num: true, fmt: v => fmtUsd(v) },
  { key: 'cost', label: 'Est. cost', num: true, fmt: v => fmtUsd(v) },
]
</script>

<template>
  <div class="grid">
    <h1>Projects</h1>
    <ChartCard title="Daily cost by project" :option="daily" :empty="data && !daily" :height="320" />
    <section class="card">
      <h2 style="margin-bottom: 12px">All projects</h2>
      <p class="faint" style="margin: -6px 0 10px">Click a row to filter the whole dashboard to that project.</p>
      <DataTable :columns="columns" :rows="rows" sort-key="cost" clickable search :search-keys="['project', 'top_model']" @select="r => (state.project = r.project)">
        <template #cell-project="{ row }">
          <span class="swatch" :style="{ background: ent.color('project', row.project) }" />{{ row.project }}
        </template>
      </DataTable>
    </section>
  </div>
</template>
