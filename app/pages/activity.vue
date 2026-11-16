<script setup lang="ts">
const { data } = useStats<any>('/api/stats/activity')
const { colors } = useTheme()
const metric = ref<'messages' | 'cost' | 'prompts'>('messages')

const heat = computed(() => {
  const d = data.value
  if (!d) return null
  if (metric.value === 'prompts') return weekHeatmap(colors.value, { cells: d.promptHeat.map((c: any) => ({ ...c, value: c.prompts })), fmt: fmtInt, label: 'Prompts' })
  if (metric.value === 'cost') return weekHeatmap(colors.value, { cells: d.heat.map((c: any) => ({ ...c, value: c.cost })), fmt: v => fmtUsd(v), label: 'Cost' })
  return weekHeatmap(colors.value, { cells: d.heat.map((c: any) => ({ ...c, value: c.messages })), fmt: fmtInt, label: 'API calls' })
})

const hours = computed(() => {
  const d = data.value
  if (!d) return null
  const arr = Array.from({ length: 24 }, () => 0)
  for (const c of d.heat) arr[c.hour] += c.messages
  return stackedBars(colors.value, { categories: arr.map((_, h) => String(h).padStart(2, '0') + 'h'), series: [{ name: 'API calls', data: arr, color: colors.value.series[0]! }], fmt: fmtInt, dayAxis: false })
})

const calendar = computed(() => {
  const d = data.value
  if (!d) return null
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 364)
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  return calendarHeatmap(colors.value, { days: d.calendar.map((r: any) => [r.day, r.messages]), from: iso(from), to: iso(to), fmt: fmtInt, label: 'API calls' })
})

const kpis = computed(() => {
  const d = data.value
  if (!d) return []
  return [
    { label: 'Current streak', value: `${d.streak.current} d`, sub: 'consecutive active days' },
    { label: 'Longest streak', value: `${d.streak.longest} d`, sub: `${d.streak.activeDays} active days total` },
    { label: 'Avg session length', value: fmtDuration(d.sessions.avg_duration_s), sub: `longest ${fmtDuration(d.sessions.max_duration_s)}` },
    { label: 'Avg calls / session', value: (d.sessions.avg_messages ?? 0).toFixed(1), sub: `max ${fmtInt(d.sessions.max_messages)}` },
    { label: 'Busiest day', value: d.busiest?.day ? fmtDate(d.busiest.day) : '-', sub: d.busiest?.messages ? `${fmtInt(d.busiest.messages)} calls` : undefined },
    { label: 'Most expensive day', value: d.priciest?.day ? fmtUsd(d.priciest.cost) : '-', sub: d.priciest?.day ? fmtDate(d.priciest.day) : undefined },
    { label: 'Avg prompt length', value: `${fmtInt(d.promptStats.avg_chars)} chars`, sub: `longest ${fmtInt(d.promptStats.max_chars)}` },
  ]
})
</script>

<template>
  <div class="grid">
    <h1>Activity</h1>
    <div class="grid kpis">
      <KpiTile v-for="k in kpis" :key="k.label" v-bind="k" />
    </div>
    <ChartCard title="Last 365 days" subtitle="API calls per day (ignores the date filter)" :option="calendar" :height="150" />
    <div class="grid cols-2">
      <ChartCard title="When you work" subtitle="Day of week × hour" :option="heat" :height="300">
        <template #actions>
          <div class="seg">
            <button :class="{ on: metric === 'messages' }" @click="metric = 'messages'">Calls</button>
            <button :class="{ on: metric === 'prompts' }" @click="metric = 'prompts'">Prompts</button>
            <button :class="{ on: metric === 'cost' }" @click="metric = 'cost'">Cost</button>
          </div>
        </template>
      </ChartCard>
      <ChartCard title="Hour of day" subtitle="API calls by hour" :option="hours" :height="300" />
    </div>
  </div>
</template>
