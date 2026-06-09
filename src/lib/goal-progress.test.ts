import { describe, it, expect } from 'vitest'
import { computeGoalCurrentValue } from './goal-progress'
import { estimatedOneRepMax } from './calc'

describe('computeGoalCurrentValue', () => {
  it('returns 0 for no sets', () => {
    expect(computeGoalCurrentValue('e1rm', [])).toBe(0)
    expect(computeGoalCurrentValue('weight', [])).toBe(0)
    expect(computeGoalCurrentValue('reps', [])).toBe(0)
  })

  it('computes best e1rm across sets', () => {
    const sets = [
      { weight: 100, reps: 5 },
      { weight: 120, reps: 1 },
    ]
    const expected = Math.max(estimatedOneRepMax(100, 5), estimatedOneRepMax(120, 1))
    expect(computeGoalCurrentValue('e1rm', sets)).toBe(expected)
  })

  it('requires both weight and reps for e1rm', () => {
    const sets = [
      { weight: 100, reps: null },
      { weight: null, reps: 5 },
      { weight: 0, reps: 5 },
    ]
    expect(computeGoalCurrentValue('e1rm', sets)).toBe(0)
  })

  it('computes max weight ignoring null and zero', () => {
    const sets = [
      { weight: 225, reps: 5 },
      { weight: null, reps: 3 },
      { weight: 245, reps: null },
      { weight: 0, reps: 1 },
    ]
    expect(computeGoalCurrentValue('weight', sets)).toBe(245)
  })

  it('computes max reps ignoring null and zero', () => {
    const sets = [
      { weight: 100, reps: 8 },
      { weight: null, reps: 12 },
      { weight: 100, reps: null },
      { weight: 100, reps: 0 },
    ]
    expect(computeGoalCurrentValue('reps', sets)).toBe(12)
  })
})
