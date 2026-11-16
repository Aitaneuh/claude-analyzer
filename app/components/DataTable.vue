<script setup lang="ts" generic="T extends Record<string, any>">
import type { Column } from '~/utils/types'

const props = withDefaults(defineProps<{
  columns: Column[]
  rows: T[]
  sortKey?: string
  clickable?: boolean
  search?: boolean
  searchKeys?: string[]
}>(), { clickable: false, search: false })

const emit = defineEmits<{ select: [row: T] }>()

const key = ref(props.sortKey ?? '')
const desc = ref(true)
const q = ref('')

function sortBy(k: string) {
  if (key.value === k) desc.value = !desc.value
  else { key.value = k; desc.value = true }
}

const shown = computed(() => {
  let r = props.rows ?? []
  if (q.value) {
    const s = q.value.toLowerCase()
    const keys = props.searchKeys ?? props.columns.map(c => c.key)
    r = r.filter(row => keys.some(k => String(row[k] ?? '').toLowerCase().includes(s)))
  }
  if (key.value) {
    const k = key.value
    r = [...r].sort((a, b) => {
      const x = a[k]; const y = b[k]
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''))
      return desc.value ? -c : c
    })
  }
  return r
})
</script>

<template>
  <div>
    <div v-if="search" class="toolbar">
      <input v-model="q" type="search" placeholder="Filter..." aria-label="Filter rows">
      <span class="faint">{{ shown.length }} rows</span>
    </div>
    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th v-for="c in columns" :key="c.key" :class="{ num: c.num }" @click="c.sortable !== false && sortBy(c.key)">
              {{ c.label }}<span v-if="key === c.key">{{ desc ? ' ↓' : ' ↑' }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in shown" :key="i" :class="{ click: clickable }" @click="clickable && emit('select', row)">
            <td v-for="c in columns" :key="c.key" :class="{ num: c.num }">
              <slot :name="'cell-' + c.key" :row="row" :value="row[c.key]">{{ c.fmt ? c.fmt(row[c.key], row) : row[c.key] }}</slot>
            </td>
          </tr>
          <tr v-if="!shown.length"><td :colspan="columns.length" class="empty">No rows</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 8px; }
.toolbar input { width: 260px; max-width: 100%; }
</style>
