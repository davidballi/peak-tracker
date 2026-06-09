import { estimatedOneRepMax } from './calc'
import type { GoalType } from '../types/goal'

export interface GoalSetRow {
  weight: number | null
  reps: number | null
}

export function computeGoalCurrentValue(goalType: GoalType, sets: GoalSetRow[]): number {
  let best = 0
  for (const s of sets) {
    if (goalType === 'e1rm') {
      if (s.weight !== null && s.weight > 0 && s.reps !== null && s.reps > 0) {
        best = Math.max(best, estimatedOneRepMax(s.weight, s.reps))
      }
    } else if (goalType === 'weight') {
      if (s.weight !== null && s.weight > 0) best = Math.max(best, s.weight)
    } else if (goalType === 'reps') {
      if (s.reps !== null && s.reps > 0) best = Math.max(best, s.reps)
    }
  }
  return best
}
