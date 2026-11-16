import fs from 'node:fs'
import defaultPricing from '../../pricing.json'

interface ModelPrice {
  input: number
  output: number
  cacheRead?: number
  fast?: number
  longContext?: { threshold: number, input: number, output: number }
}
interface PricingFile {
  defaults: { cacheReadMultiplier: number, cacheWrite5mMultiplier: number, cacheWrite1hMultiplier: number }
  models: Record<string, ModelPrice>
  families: Record<string, string>
}

export interface UsageLike {
  model: string
  input_tokens: number
  output_tokens: number
  cache_write_5m: number
  cache_write_1h: number
  cache_read: number
  speed?: string | null
}

let pricing: PricingFile = defaultPricing as PricingFile
const resolved = new Map<string, ModelPrice | null>()

export function loadPricing() {
  const file = process.env.PRICING_FILE
  if (file) {
    try {
      pricing = JSON.parse(fs.readFileSync(file, 'utf8'))
      console.log(`[pricing] loaded ${file}`)
    } catch (e) {
      console.warn(`[pricing] could not read PRICING_FILE=${file}, using built-in prices:`, (e as Error).message)
    }
  }
  resolved.clear()
}

export function priceFor(model: string): ModelPrice | null {
  if (resolved.has(model)) return resolved.get(model)!
  let p: ModelPrice | null = pricing.models[model] ?? null
  if (!p) {
    // longest prefix match, e.g. "claude-sonnet-4-5-20250929" -> "claude-sonnet-4-5"
    const key = Object.keys(pricing.models).filter(k => model.startsWith(k)).sort((a, b) => b.length - a.length)[0]
    if (key) p = pricing.models[key]!
  }
  if (!p) {
    const fam = Object.keys(pricing.families).find(f => model.toLowerCase().includes(f))
    if (fam) p = pricing.models[pricing.families[fam]!] ?? null
  }
  resolved.set(model, p)
  return p
}

/** Estimated USD cost of one API call at list (pay-as-you-go) prices. */
export function costOf(u: UsageLike): number {
  const p = priceFor(u.model)
  if (!p) return 0
  const d = pricing.defaults
  const prompt = u.input_tokens + u.cache_read + u.cache_write_5m + u.cache_write_1h
  let input = p.input
  let output = p.output
  let cacheRead = p.cacheRead ?? p.input * d.cacheReadMultiplier
  if (p.longContext && prompt > p.longContext.threshold) {
    const r = p.longContext.input / p.input
    input = p.longContext.input
    output = p.longContext.output
    cacheRead *= r
  }
  const mult = u.speed === 'fast' && p.fast ? p.fast : 1
  const usd
    = u.input_tokens * input
    + u.output_tokens * output
    + u.cache_read * cacheRead
    + u.cache_write_5m * input * d.cacheWrite5mMultiplier
    + u.cache_write_1h * input * d.cacheWrite1hMultiplier
  return (usd * mult) / 1e6
}

/** What the same call would cost if every prompt token were billed as uncached input. */
export function costWithoutCache(u: UsageLike): number {
  const p = priceFor(u.model)
  if (!p) return 0
  const mult = u.speed === 'fast' && p.fast ? p.fast : 1
  const prompt = u.input_tokens + u.cache_read + u.cache_write_5m + u.cache_write_1h
  return ((prompt * p.input + u.output_tokens * p.output) * mult) / 1e6
}
