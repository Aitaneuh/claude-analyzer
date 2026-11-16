export function fmtTokens(n: number | null | undefined): string {
  const v = Number(n) || 0
  const a = Math.abs(v)
  if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B'
  if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e8 ? 0 : 1) + 'M'
  if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'k'
  return String(Math.round(v))
}

export function fmtUsd(n: number | null | undefined, digits?: number): string {
  const v = Number(n) || 0
  const d = digits ?? (Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 1 ? 2 : 3)
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

export function fmtInt(n: number | null | undefined): string {
  return Math.round(Number(n) || 0).toLocaleString('en-US')
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  return ((Number(n) || 0) * 100).toFixed(digits) + '%'
}

export function fmtDuration(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(Number(seconds) || 0))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = iso.length === 10 ? new Date(iso + 'T00:00:00') : new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}

/** Short display name for model ids: claude-opus-5-5 -> Opus 5.5 */
export function modelLabel(id: string | null | undefined): string {
  if (!id) return 'unknown'
  const m = id.match(/^claude-([a-z]+)-([\d-]+?)(?:-\d{8})?$/)
  if (!m) return id
  return m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1) + ' ' + m[2]!.replace(/-/g, '.')
}

export function delta(cur: number, prev: number | null | undefined): number | null {
  if (prev == null || !prev) return null
  return (cur - prev) / prev
}
