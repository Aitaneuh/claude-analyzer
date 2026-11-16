<script setup lang="ts">
const props = defineProps<{
  label: string
  value: string
  sub?: string
  change?: number | null
  /** true when a decrease is the good direction (e.g. cost) */
  invert?: boolean
}>()

const trend = computed(() => {
  if (props.change == null || !Number.isFinite(props.change)) return null
  const up = props.change >= 0
  const good = props.invert ? !up : up
  return { text: `${up ? '▲' : '▼'} ${Math.abs(props.change * 100).toFixed(0)}%`, good }
})
</script>

<template>
  <div class="card kpi">
    <div class="label">{{ label }}</div>
    <div class="value">{{ value }}</div>
    <div class="foot">
      <span v-if="trend" :class="['trend', trend.good ? 'good' : 'bad']" :title="'vs previous period'">{{ trend.text }}</span>
      <span v-if="sub" class="faint">{{ sub }}</span>
    </div>
  </div>
</template>

<style scoped>
.kpi { padding: 14px 16px; }
.label { color: var(--text-2); font-size: 12px; }
.value { font-size: 24px; font-weight: 600; letter-spacing: -0.02em; margin: 4px 0 2px; }
.foot { display: flex; gap: 8px; font-size: 12px; flex-wrap: wrap; min-height: 18px; }
.trend { font-weight: 600; }
.trend.good { color: var(--good); }
.trend.bad { color: var(--bad); }
</style>
