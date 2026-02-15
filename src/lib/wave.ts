import type { WaveWarmup, WaveWeek, WaveWeekSet } from '../types/program'
import { roundToNearest5 } from './calc'

export interface ComputedSet {
  index: number
  label: string
  weight: number
  reps: number
  isWarmup: boolean
  isBackoff: boolean
}

export interface WaveSetsResult {
  label: string
  warmup: ComputedSet[]
  working: ComputedSet[]
  all: ComputedSet[]
}

/**
 * Generate the full set list for a wave exercise given the current week.
 * Mirrors the original getWS() function.
 */
export function getWaveSets(
  warmups: WaveWarmup[],
  weeks: WaveWeek[],
  weekSets: Record<string, WaveWeekSet[]>,
  weekIndex: number,
  currentMax: number,
): WaveSetsResult {
  const week = weeks.find(w => w.weekIndex === weekIndex)
  if (!week) {
    return { label: '', warmup: [], working: [], all: [] }
  }

  const sets = weekSets[week.id] ?? []
  const sortedWarmups = [...warmups].sort((a, b) => a.setIndex - b.setIndex)
  const sortedSets = [...sets].sort((a, b) => a.setIndex - b.setIndex)

  const warmupSets: ComputedSet[] = sortedWarmups.map((s, i) => ({
    index: i,
    label: `W${i + 1}`,
    weight: roundToNearest5(currentMax * s.percentage),
    reps: s.reps,
    isWarmup: true,
    isBackoff: false,
  }))

  const workingSets: ComputedSet[] = sortedSets.map((s, i) => ({
    index: warmupSets.length + i,
    label: s.isBackoff ? 'BO' : `S${i + 1}`,
    weight: roundToNearest5(currentMax * s.percentage),
    reps: s.reps,
    isWarmup: false,
    isBackoff: s.isBackoff,
  }))

  return {
    label: week.label,
    warmup: warmupSets,
    working: workingSets,
    all: [...warmupSets, ...workingSets],
  }
}
