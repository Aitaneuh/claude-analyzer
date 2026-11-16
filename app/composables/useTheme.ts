// Theme: follows the OS by default; the toggle stamps data-theme on <html>.
// Chart colors are picked per mode (validated steps, not an automatic flip).

const LIGHT = {
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  other: '#a3a29d',
  surface: '#fcfcfb',
  text: '#0b0b0b',
  text2: '#52514e',
  text3: '#7a7974',
  grid: '#e9e8e4',
  axis: '#d6d5d0',
  seq: ['#f0efec', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'],
}
const DARK = {
  series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'],
  other: '#6f6e68',
  surface: '#1a1a19',
  text: '#f0efec',
  text2: '#c3c2b7',
  text3: '#8e8d85',
  grid: '#2a2a27',
  axis: '#3a3a36',
  seq: ['#232321', '#0d366b', '#104281', '#184f95', '#1c5cab', '#2a78d6', '#5598e7', '#86b6ef'],
}

export type ChartTheme = typeof LIGHT

export function useTheme() {
  const mode = useState<'system' | 'light' | 'dark'>('theme-mode', () => {
    try { return (localStorage.getItem('theme') as 'light' | 'dark' | null) ?? 'system' } catch { return 'system' }
  })
  const systemDark = useState('theme-system-dark', () => false)

  const isDark = computed(() => mode.value === 'dark' || (mode.value === 'system' && systemDark.value))
  const colors = computed<ChartTheme>(() => (isDark.value ? DARK : LIGHT))

  function apply() {
    const el = document.documentElement
    if (mode.value === 'system') el.removeAttribute('data-theme')
    else el.setAttribute('data-theme', mode.value)
  }

  function init() {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    systemDark.value = mq.matches
    mq.addEventListener('change', e => (systemDark.value = e.matches))
    apply()
  }

  function toggle() {
    mode.value = isDark.value ? 'light' : 'dark'
    try { localStorage.setItem('theme', mode.value) } catch { /* private mode */ }
    apply()
  }

  return { mode, isDark, colors, init, toggle }
}

/**
 * Stable color per entity (model, project, tool): the first 8 distinct keys seen get
 * the categorical slots in fixed order and keep them; anything later, and "Other", is gray.
 */
export function useEntityColors() {
  const assigned = useState<Record<string, number>>('entity-colors', () => {
    try { return JSON.parse(localStorage.getItem('entity-colors') || '{}') } catch { return {} }
  })
  const { colors } = useTheme()

  function slot(ns: string, key: string): number {
    if (key === 'Other') return -1
    const k = ns + ':' + key
    if (k in assigned.value) return assigned.value[k]!
    const used = new Set(Object.entries(assigned.value).filter(([kk]) => kk.startsWith(ns + ':')).map(([, v]) => v))
    let s = -1
    for (let i = 0; i < 8; i++) if (!used.has(i)) { s = i; break }
    assigned.value = { ...assigned.value, [k]: s }
    try { localStorage.setItem('entity-colors', JSON.stringify(assigned.value)) } catch { /* ignore */ }
    return s
  }

  function color(ns: string, key: string): string {
    const s = slot(ns, key)
    return s < 0 ? colors.value.other : colors.value.series[s]!
  }

  /** Assign slots for a list of keys in order (e.g. ranked largest first). */
  function prime(ns: string, keys: string[]) {
    for (const k of keys) slot(ns, k)
  }

  return { color, prime }
}
