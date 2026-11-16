<script setup lang="ts">
import type { Column } from '~/utils/types'

const { data } = useStats<any>('/api/stats/sessions')
const route = useRoute()

const rows = computed(() => (data.value?.sessions ?? []).map((s: any) => ({
  ...s,
  label: s.title || s.session_id.slice(0, 8),
  model_list: String(s.models ?? '').split(',').filter(Boolean).map(modelLabel).join(', '),
})))

const columns: Column[] = [
  { key: 'started', label: 'Started', fmt: fmtDateTime },
  { key: 'label', label: 'Session' },
  { key: 'project', label: 'Project' },
  { key: 'duration_s', label: 'Duration', num: true, fmt: fmtDuration },
  { key: 'prompts', label: 'Prompts', num: true, fmt: fmtInt },
  { key: 'messages', label: 'API calls', num: true, fmt: fmtInt },
  { key: 'tools', label: 'Tools', num: true, fmt: fmtInt },
  { key: 'output', label: 'Output', num: true, fmt: fmtTokens },
  { key: 'total', label: 'Tokens', num: true, fmt: fmtTokens },
  { key: 'model_list', label: 'Models' },
  { key: 'cost', label: 'Est. cost', num: true, fmt: v => fmtUsd(v) },
]

function open(row: any) {
  navigateTo({ path: `/sessions/${row.session_id}`, query: route.query })
}
</script>

<template>
  <div class="grid">
    <h1>Sessions</h1>
    <section class="card">
      <DataTable :columns="columns" :rows="rows" sort-key="started" clickable search :search-keys="['label', 'project', 'model_list', 'session_id', 'git_branch']" @select="open">
        <template #cell-label="{ row }">
          <span class="title">{{ row.label }}</span>
          <span v-if="row.sidechain_messages" class="pill" style="margin-left: 6px" title="API calls made by subagents">{{ row.sidechain_messages }} subagent</span>
        </template>
      </DataTable>
    </section>
  </div>
</template>

<style scoped>
.title { display: inline-block; max-width: 380px; overflow: hidden; text-overflow: ellipsis; vertical-align: bottom; }
</style>
