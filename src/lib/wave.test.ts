import { describe, it, expect } from 'vitest'
import { getWaveSets } from './wave'
import { roundToNearest5 } from './calc'
import type { WaveWarmup, WaveWeek, WaveWeekSet } from '../types/program'

// Fixture data matching wave-defaults.ts patterns
const warmups: WaveWarmup[] = [
  { id: 'w1', waveConfigId: 'wc1', setIndex: 0, reps: 5, percentage: 0.5 },
  { id: 'w2', waveConfigId: 'wc1', setIndex: 1, reps: 3, percentage: 0.65 },
]

const weeks: WaveWeek[] = [
  { id: 'wk1', waveConfigId: 'wc1', weekIndex: 0, label: 'Wk1 (5s)' },
  { id: 'wk2', waveConfigId: 'wc1', weekIndex: 1, label: 'Wk2 (4s)' },
  { id: 'wk3', waveConfigId: 'wc1', weekIndex: 2, label: 'Wk3 (3s)' },
  { id: 'wk4', waveConfigId: 'wc1', weekIndex: 3, label: 'Wk4 (deload)' },
]

const weekSets: Record<string, WaveWeekSet[]> = {
  wk1: [
    { id: 's1', waveWeekId: 'wk1', setIndex: 0, reps: 5, percentage: 0.75, isBackoff: false },
    { id: 's2', waveWeekId: 'wk1', setIndex: 1, reps: 5, percentage: 0.82, isBackoff: false },
    { id: 's3', waveWeekId: 'wk1', setIndex: 2, reps: 5, percentage: 0.88, isBackoff: false },
    { id: 's4', waveWeekId: 'wk1', setIndex: 3, reps: 8, percentage: 0.75, isBackoff: true },
  ],
  wk4: [
    { id: 'd1', waveWeekId: 'wk4', setIndex: 0, reps: 5, percentage: 0.69, isBackoff: false },
    { id: 'd2', waveWeekId: 'wk4', setIndex: 1, reps: 5, percentage: 0.75, isBackoff: false },
    { id: 'd3', waveWeekId: 'wk4', setIndex: 2, reps: 3, percentage: 0.82, isBackoff: false },
  ],
}

const MAX = 300

describe('getWaveSets', () => {
  it('returns empty result for invalid weekIndex', () => {
    const result = getWaveSets(warmups, weeks, weekSets, 99, MAX)
    expect(result.label).toBe('')
    expect(result.warmup).toEqual([])
    expect(result.working).toEqual([])
    expect(result.all).toEqual([])
  })

  it('returns correct week label', () => {
    expect(getWaveSets(warmups, weeks, weekSets, 0, MAX).label).toBe('Wk1 (5s)')
    expect(getWaveSets(warmups, weeks, weekSets, 3, MAX).label).toBe('Wk4 (deload)')
  })

  it('produces correct warmup count', () => {
    const result = getWaveSets(warmups, weeks, weekSets, 0, MAX)
    expect(result.warmup.length).toBe(2)
  })

  it('computes warmup weights via roundToNearest5', () => {
    const result = getWaveSets(warmups, weeks, weekSets, 0, MAX)
    expect(result.warmup[0].weight).toBe(roundToNearest5(MAX * 0.5))
    expect(result.warmup[1].weight).toBe(roundToNearest5(MAX * 0.65))
  })

  it('computes working set weights correctly', () => {
    const result = getWaveSets(warmups, weeks, weekSets, 0, MAX)
    expect(result.working[0].weight).toBe(roundToNearest5(MAX * 0.75))
    expect(result.working[1].weight).toBe(roundToNearest5(MAX * 0.82))
    expect(result.working[2].weight).toBe(roundToNearest5(MAX * 0.88))
  })

  it('labels backoff set as BO', () => {
    const result = getWaveSets(warmups, weeks, weekSets, 0, MAX)
    const backoff = result.working.find((s) => s.isBackoff)
    expect(backoff).toBeDefined()
    expect(backoff!.label).toBe('BO')
  })

  it('labels non-backoff working sets as S1, S2, ...', () => {
    const result = getWaveSets(warmups, weeks, weekSets, 0, MAX)
    expect(result.working[0].label).toBe('S1')
    expect(result.working[1].label).toBe('S2')
  })

  it('all[] is concat of warmup + working', () => {
    const result = getWaveSets(warmups, weeks, weekSets, 0, MAX)
    expect(result.all.length).toBe(result.warmup.length + result.working.length)
    expect(result.all).toEqual([...result.warmup, ...result.working])
  })

  it('deload week has no backoff sets', () => {
    const result = getWaveSets(warmups, weeks, weekSets, 3, MAX)
    expect(result.working.every((s) => !s.isBackoff)).toBe(true)
  })

  it('working set indices offset by warmup count', () => {
    const result = getWaveSets(warmups, weeks, weekSets, 0, MAX)
    const warmupCount = result.warmup.length
    for (let i = 0; i < result.working.length; i++) {
      expect(result.working[i].index).toBe(warmupCount + i)
    }
  })
})
