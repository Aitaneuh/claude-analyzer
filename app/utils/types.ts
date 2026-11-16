export interface Column {
  key: string
  label: string
  num?: boolean
  fmt?: (v: any, row: any) => string
  sortable?: boolean
}

export interface TokenTotals {
  messages: number
  input: number
  output: number
  cache_write: number
  cache_read: number
  thinking: number
  total: number
  cost: number
  cost_nocache: number
}

export interface Pivot {
  days: string[]
  keys: string[]
  series: Record<string, number[]>
}

/** Share of prompt tokens served from cache. */
export function cacheHitRate(t: Pick<TokenTotals, 'input' | 'cache_write' | 'cache_read'>) {
  const prompt = t.input + t.cache_write + t.cache_read
  return prompt ? t.cache_read / prompt : 0
}
