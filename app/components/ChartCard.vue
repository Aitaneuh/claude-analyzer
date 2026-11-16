<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  option?: Record<string, unknown> | null
  height?: number
  loading?: boolean
  empty?: boolean
}>(), { height: 280 })
</script>

<template>
  <section class="card chart-card">
    <header>
      <div>
        <h2>{{ title }}</h2>
        <p v-if="subtitle" class="faint sub">{{ subtitle }}</p>
      </div>
      <div class="actions"><slot name="actions" /></div>
    </header>
    <slot>
      <div v-if="empty" class="empty" :style="{ height: props.height + 'px' }">No data for this range</div>
      <VChart v-else-if="option" class="chart" :style="{ height: props.height + 'px' }" :option="option" autoresize />
      <div v-else class="empty" :style="{ height: props.height + 'px' }">Loading...</div>
    </slot>
    <slot name="footer" />
  </section>
</template>

<style scoped>
.chart-card header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.sub { margin: 2px 0 0; font-size: 12px; }
.chart { width: 100%; }
.empty { display: flex; align-items: center; justify-content: center; }
</style>
