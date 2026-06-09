import { describe, it, expect } from 'vitest'
import {
  addRollingAverage,
  e1rmChangeFromPreviousBlock,
  mergeLiftSeries,
  type E1rmDataPoint,
  type AllLiftsData,
} from './history-stats'

function point(blockNum: number, weekIndex: number, e1rm: number, startedAt?: string): E1rmDataPoint {
  return { label: `B${blockNum} W${weekIndex + 1}`, e1rm, blockNum, weekIndex, startedAt }
}

describe('addRollingAverage', () => {
  it('returns empty for empty input', () => {
    expect(addRollingAverage([])).toEqual([])
  })

  it('averages each point with the points before it', () => {
    const result = addRollingAverage([point(1, 0, 100), point(1, 1, 200), point(1, 2, 300)])
    expect(result.map((p) => p.rollingAvg)).toEqual([100, 150, 200])
  })

  it('preserves the original point fields', () => {
    const result = addRollingAverage([point(2, 1, 150)])
    expect(result[0]).toMatchObject({ label: 'B2 W2', e1rm: 150, blockNum: 2, weekIndex: 1 })
  })
})

describe('e1rmChangeFromPreviousBlock', () => {
  it('returns 0 with fewer than 2 points', () => {
    expect(e1rmChangeFromPreviousBlock([])).toBe(0)
    expect(e1rmChangeFromPreviousBlock([point(1, 0, 100)])).toBe(0)
  })

  it('returns 0 when all points are in the current block', () => {
    expect(e1rmChangeFromPreviousBlock([point(1, 0, 100), point(1, 1, 110)])).toBe(0)
  })

  it('computes change vs best of earlier blocks', () => {
    const points = [point(1, 0, 100), point(1, 1, 110), point(2, 0, 120)]
    expect(e1rmChangeFromPreviousBlock(points)).toBe(10)
  })

  it('uses chronological position, not block number (imported PWA data)', () => {
    // Imported sessions carry synthetic high block_nums but are chronologically older
    const points = [point(18, 0, 150), point(18, 1, 155), point(1, 0, 160)]
    expect(e1rmChangeFromPreviousBlock(points)).toBe(5)
  })

  it('only treats the trailing run of the current block as current', () => {
    const points = [point(2, 0, 100), point(1, 0, 140), point(1, 1, 150)]
    expect(e1rmChangeFromPreviousBlock(points)).toBe(50)
  })
})

describe('mergeLiftSeries', () => {
  const lift = (liftId: string, data: E1rmDataPoint[]): AllLiftsData => ({
    liftId,
    liftName: liftId,
    color: '#fff',
    data,
  })

  it('returns empty for no data', () => {
    expect(mergeLiftSeries([])).toEqual([])
  })

  it('merges points from multiple lifts by label', () => {
    const merged = mergeLiftSeries([
      lift('bench', [point(1, 0, 100, '2026-01-01')]),
      lift('squat', [point(1, 0, 200, '2026-01-01')]),
    ])
    expect(merged.length).toBe(1)
    expect(merged[0]).toMatchObject({ label: 'B1 W1', bench: 100, squat: 200 })
  })

  it('sorts chronologically by startedAt, not by label text', () => {
    // 'B1 W1' sorts before 'B18 W1' alphabetically, but B18 is older imported data
    const merged = mergeLiftSeries([
      lift('bench', [
        point(1, 0, 160, '2026-06-01 10:00:00'),
        point(18, 0, 150, '2024-03-01 10:00:00'),
      ]),
    ])
    expect(merged.map((m) => m.label)).toEqual(['B18 W1', 'B1 W1'])
  })

  it('keeps the earliest startedAt when lifts disagree on a label', () => {
    const merged = mergeLiftSeries([
      lift('bench', [point(1, 0, 100, '2026-02-01')]),
      lift('squat', [point(1, 0, 200, '2026-01-01'), point(1, 1, 210, '2026-01-08')]),
    ])
    expect(merged.map((m) => m.label)).toEqual(['B1 W1', 'B1 W2'])
  })
})
