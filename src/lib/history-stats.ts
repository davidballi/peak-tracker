export interface E1rmDataPoint {
  label: string
  e1rm: number
  rollingAvg?: number
  blockNum: number
  weekIndex: number
  startedAt?: string
}

export interface AllLiftsData {
  liftId: string
  liftName: string
  color: string
  data: E1rmDataPoint[]
}

// ~180 days at 1 data point per block/week (~7 days each)
const ROLLING_WINDOW = 26

/**
 * Label suffix that disambiguates a re-run of a block (cycle > 0) from its
 * original run, e.g. cycle 1 -> ' (run 2)'. Cycle-0 data (the common case,
 * and all pre-rollback history) gets no suffix so existing labels/charts
 * are unchanged.
 */
export function runSuffix(cycle: number): string {
  return cycle > 0 ? ` (run ${cycle + 1})` : ''
}

export function addRollingAverage(points: E1rmDataPoint[]): E1rmDataPoint[] {
  return points.map((point, i) => {
    const start = Math.max(0, i - ROLLING_WINDOW + 1)
    const window = points.slice(start, i + 1)
    const avg = window.reduce((sum, p) => sum + p.e1rm, 0) / window.length
    return { ...point, rollingAvg: Math.round(avg) }
  })
}

/**
 * Change from the previous block, given chronologically ordered points.
 * Imported PWA data carries synthetic high block_nums, so "previous block"
 * means everything before the trailing run of the latest block — determined
 * by position, never by comparing block_num values.
 */
export function e1rmChangeFromPreviousBlock(points: E1rmDataPoint[]): number {
  if (points.length < 2) return 0
  const current = points[points.length - 1]
  let boundary = points.length - 1
  while (boundary > 0 && points[boundary - 1].blockNum === current.blockNum) {
    boundary--
  }
  if (boundary === 0) return 0
  const prevBest = points
    .slice(0, boundary)
    .reduce((max, p) => Math.max(max, p.e1rm), 0)
  return current.e1rm - prevBest
}

export type MergedLiftPoint = { label: string; startedAt: string } & Record<string, number | string>

/**
 * Merge per-lift series into one Recharts dataset keyed by label, ordered by
 * each label's earliest startedAt. Label-text ordering would put imported
 * high-block labels (B18 W1) after newer real ones (B2 W1).
 */
export function mergeLiftSeries(data: AllLiftsData[]): MergedLiftPoint[] {
  const merged = new Map<string, { startedAt: string; values: Record<string, number> }>()
  for (const lift of data) {
    for (const point of lift.data) {
      const startedAt = point.startedAt ?? ''
      const existing = merged.get(point.label)
      if (existing) {
        existing.values[lift.liftId] = point.e1rm
        if (startedAt && (!existing.startedAt || startedAt < existing.startedAt)) {
          existing.startedAt = startedAt
        }
      } else {
        merged.set(point.label, { startedAt, values: { [lift.liftId]: point.e1rm } })
      }
    }
  }
  return Array.from(merged.entries())
    .map(([label, m]) => ({ label, startedAt: m.startedAt, ...m.values }))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
}
