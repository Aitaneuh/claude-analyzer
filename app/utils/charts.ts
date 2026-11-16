// ECharts option builders. Every chart: one y-axis, recessive grid, thin marks,
// surface-colored gaps between stacked segments, hover tooltip by default.
import type { ChartTheme } from '~/composables/useTheme'

export interface Series {
  name: string
  data: number[]
  color: string
}

type Fmt = (v: number) => string

function tooltipBase(t: ChartTheme) {
  return {
    backgroundColor: t.surface,
    borderColor: t.axis,
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: t.text, fontSize: 12 },
    extraCssText: 'box-shadow: 0 4px 14px rgba(0,0,0,.12); border-radius: 8px;',
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

function dot(color: string) {
  return `<span style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${color};margin-right:6px"></span>`
}

export function shortDay(day: string) {
  const d = new Date(day + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Vertical stacked bars over a category axis (usually days). */
export function stackedBars(t: ChartTheme, opts: { categories: string[], series: Series[], fmt: Fmt, dayAxis?: boolean, stacked?: boolean }) {
  const { categories, series, fmt, dayAxis = true, stacked = true } = opts
  const lastIdx = series.length - 1
  return {
    animationDuration: 300,
    grid: { left: 8, right: 12, top: series.length > 1 ? 36 : 12, bottom: 4, containLabel: true },
    legend: series.length > 1
      ? { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, itemGap: 14, textStyle: { color: t.text2, fontSize: 12 } }
      : undefined,
    tooltip: {
      ...tooltipBase(t),
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.5 } },
      formatter: (items: Array<{ axisValue: string, seriesName: string, value: number, color: string }>) => {
        if (!items.length) return ''
        const head = dayAxis ? fmtDate(items[0]!.axisValue) : esc(items[0]!.axisValue)
        const rows = items.filter(i => i.value).sort((a, b) => b.value - a.value)
          .map(i => `<div style="display:flex;justify-content:space-between;gap:16px"><span>${dot(i.color)}${esc(i.seriesName)}</span><b>${fmt(i.value)}</b></div>`)
        const total = items.reduce((s, i) => s + (Number(i.value) || 0), 0)
        const foot = items.length > 1 ? `<div style="border-top:1px solid ${t.grid};margin-top:4px;padding-top:4px;display:flex;justify-content:space-between"><span>Total</span><b>${fmt(total)}</b></div>` : ''
        return `<div style="min-width:160px"><div style="color:${t.text2};margin-bottom:4px">${head}</div>${rows.join('') || '<i>none</i>'}${foot}</div>`
      },
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { lineStyle: { color: t.axis } },
      axisTick: { show: false },
      axisLabel: { color: t.text3, fontSize: 11, hideOverlap: true, formatter: dayAxis ? shortDay : undefined },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: t.grid } },
      axisLabel: { color: t.text3, fontSize: 11, formatter: fmt },
    },
    series: series.map((s, i) => ({
      name: s.name,
      type: 'bar',
      stack: stacked ? 'total' : undefined,
      data: s.data,
      barMaxWidth: 26,
      itemStyle: {
        color: s.color,
        borderColor: t.surface,
        borderWidth: stacked && series.length > 1 ? 1 : 0,
        borderRadius: !stacked || i === lastIdx ? [4, 4, 0, 0] : 0,
      },
      emphasis: { focus: 'series' },
    })),
  }
}

/** Card height for a rankBars chart so bars keep the same thickness whatever the row count. */
export function barsHeight(n: number | null | undefined) {
  return Math.max(70, (Number(n) || 1) * 30 + 12)
}

/** Ranked horizontal bars with direct value labels. */
export function rankBars(t: ChartTheme, opts: { labels: string[], values: number[], colors: string[] | string, fmt: Fmt }) {
  const { labels, values, colors, fmt } = opts
  return {
    animationDuration: 300,
    grid: { left: 8, right: 64, top: 4, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltipBase(t),
      trigger: 'item',
      formatter: (p: { name: string, value: number, color: string }) => `${dot(p.color)}${esc(p.name)}: <b>${fmt(p.value)}</b>`,
    },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      inverse: true,
      data: labels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: t.text2, fontSize: 12, width: 150, overflow: 'truncate' },
    },
    series: [{
      type: 'bar',
      data: values.map((v, i) => ({ value: v, itemStyle: { color: Array.isArray(colors) ? colors[i] : colors } })),
      barMaxWidth: 16,
      barCategoryGap: '35%',
      itemStyle: { borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right', color: t.text2, fontSize: 11, formatter: (p: { value: number }) => fmt(p.value) },
    }],
  }
}

/** Single-series line (e.g. cumulative tokens). */
export function lineChart(t: ChartTheme, opts: { categories: string[], series: Series[], fmt: Fmt, xFmt?: (v: string) => string, area?: boolean }) {
  const { categories, series, fmt, xFmt, area } = opts
  return {
    animationDuration: 300,
    grid: { left: 8, right: 12, top: series.length > 1 ? 36 : 12, bottom: 4, containLabel: true },
    legend: series.length > 1 ? { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.text2, fontSize: 12 } } : undefined,
    tooltip: {
      ...tooltipBase(t),
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: t.axis } },
      formatter: (items: Array<{ axisValue: string, seriesName: string, value: number, color: string }>) => {
        const head = xFmt ? xFmt(items[0]!.axisValue) : esc(items[0]!.axisValue)
        return `<div style="color:${t.text2};margin-bottom:4px">${head}</div>` + items.map(i => `<div>${dot(i.color)}${esc(i.seriesName)}: <b>${fmt(i.value)}</b></div>`).join('')
      },
    },
    xAxis: {
      type: 'category',
      data: categories,
      boundaryGap: false,
      axisLine: { lineStyle: { color: t.axis } },
      axisTick: { show: false },
      axisLabel: { color: t.text3, fontSize: 11, hideOverlap: true, formatter: xFmt },
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: t.grid } }, axisLabel: { color: t.text3, fontSize: 11, formatter: fmt } },
    series: series.map(s => ({
      name: s.name,
      type: 'line',
      data: s.data,
      showSymbol: false,
      symbolSize: 8,
      lineStyle: { width: 2, color: s.color },
      itemStyle: { color: s.color, borderColor: t.surface, borderWidth: 2 },
      areaStyle: area ? { color: s.color, opacity: 0.12 } : undefined,
    })),
  }
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Day-of-week x hour heatmap, one sequential hue. */
export function weekHeatmap(t: ChartTheme, opts: { cells: Array<{ dow: number, hour: number, value: number }>, fmt: Fmt, label: string }) {
  const order = [1, 2, 3, 4, 5, 6, 0] // Monday first
  const data = opts.cells.map(c => [c.hour, order.indexOf(c.dow), c.value])
  const max = Math.max(1, ...opts.cells.map(c => c.value))
  return {
    animationDuration: 300,
    grid: { left: 8, right: 8, top: 8, bottom: 44, containLabel: true },
    tooltip: {
      ...tooltipBase(t),
      formatter: (p: { value: [number, number, number] }) => `${DOW[order[p.value[1]]!]} ${String(p.value[0]).padStart(2, '0')}:00 - ${String(p.value[0]).padStart(2, '0')}:59<br>${opts.label}: <b>${opts.fmt(p.value[2])}</b>`,
    },
    xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')), splitArea: { show: false }, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.text3, fontSize: 11 } },
    yAxis: { type: 'category', data: order.map(d => DOW[d]), inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.text2, fontSize: 11 } },
    visualMap: {
      min: 0, max, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 10, itemHeight: 140,
      inRange: { color: t.seq }, textStyle: { color: t.text3, fontSize: 11 }, formatter: (v: number) => opts.fmt(v),
    },
    series: [{ type: 'heatmap', data, itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 3 }, emphasis: { itemStyle: { borderColor: t.text, borderWidth: 1 } } }],
  }
}

/** GitHub-style 365-day calendar. */
export function calendarHeatmap(t: ChartTheme, opts: { days: Array<[string, number]>, from: string, to: string, fmt: Fmt, label: string }) {
  const max = Math.max(1, ...opts.days.map(d => d[1]))
  return {
    animationDuration: 300,
    tooltip: { ...tooltipBase(t), formatter: (p: { value: [string, number] }) => `${fmtDate(p.value[0])}<br>${opts.label}: <b>${opts.fmt(p.value[1])}</b>` },
    visualMap: { show: false, min: 0, max, inRange: { color: t.seq.slice(1) } },
    calendar: {
      range: [opts.from, opts.to],
      top: 24, left: 36, right: 8, bottom: 4,
      cellSize: ['auto', 13],
      splitLine: { show: false },
      itemStyle: { color: t.seq[0], borderColor: t.surface, borderWidth: 3 },
      dayLabel: { firstDay: 1, nameMap: ['S', 'M', 'T', 'W', 'T', 'F', 'S'], color: t.text3, fontSize: 10 },
      monthLabel: { color: t.text3, fontSize: 11 },
      yearLabel: { show: false },
    },
    series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: opts.days }],
  }
}
