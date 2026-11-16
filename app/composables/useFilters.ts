export type Preset = '7d' | '30d' | '90d' | 'ytd' | 'all' | 'custom'

export interface FilterState {
  preset: Preset
  from: string
  to: string
  project: string
}

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function minusDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useFilters() {
  const state = useState<FilterState>('filters', () => ({ preset: '30d', from: '', to: '', project: '' }))

  const range = computed(() => {
    const s = state.value
    switch (s.preset) {
      case '7d': return { from: minusDays(6), to: today() }
      case '30d': return { from: minusDays(29), to: today() }
      case '90d': return { from: minusDays(89), to: today() }
      case 'ytd': return { from: `${new Date().getFullYear()}-01-01`, to: today() }
      case 'all': return { from: '', to: '' }
      default: return { from: s.from, to: s.to }
    }
  })

  /** Query object sent to every /api/stats endpoint. */
  const query = computed(() => {
    const q: Record<string, string> = {}
    if (range.value.from) q.from = range.value.from
    if (range.value.to) q.to = range.value.to
    if (state.value.project) q.project = state.value.project
    return q
  })

  return { state, range, query }
}

/** Fetch a stats endpoint that re-runs whenever the global filters change. */
export function useStats<T = any>(path: string | (() => string), extra?: Record<string, unknown>) {
  const { query } = useFilters()
  const refreshKey = useState('refresh-key', () => 0)
  return useFetch<T>(path, {
    query: computed(() => ({ ...query.value, ...extra, _r: refreshKey.value })),
    server: false,
    lazy: true,
  })
}
