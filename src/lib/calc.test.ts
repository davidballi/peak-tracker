import { describe, it, expect } from 'vitest'
import { roundToNearest5, estimatedOneRepMax, validateWeight, validateReps, MAX_WEIGHT, MAX_REPS } from './calc'

describe('roundToNearest5', () => {
  it('returns exact multiples unchanged', () => {
    expect(roundToNearest5(100)).toBe(100)
    expect(roundToNearest5(225)).toBe(225)
  })

  it('rounds up from midpoint', () => {
    expect(roundToNearest5(132.5)).toBe(135)
  })

  it('rounds down below midpoint', () => {
    expect(roundToNearest5(132)).toBe(130)
  })

  it('returns 0 for 0', () => {
    expect(roundToNearest5(0)).toBe(0)
  })

  it('returns 0 for negative numbers', () => {
    expect(roundToNearest5(-10)).toBe(0)
  })

  it('returns 0 for NaN', () => {
    expect(roundToNearest5(NaN)).toBe(0)
  })

  it('returns 0 for Infinity', () => {
    expect(roundToNearest5(Infinity)).toBe(0)
  })
})

describe('estimatedOneRepMax', () => {
  it('returns weight directly when reps = 1', () => {
    expect(estimatedOneRepMax(225, 1)).toBe(225)
  })

  it('calculates Epley formula correctly', () => {
    // 185 * (1 + 5/30) = 185 * 1.1667 = 215.83 → 216
    expect(estimatedOneRepMax(185, 5)).toBe(216)
  })

  it('returns 0 for zero weight', () => {
    expect(estimatedOneRepMax(0, 5)).toBe(0)
  })

  it('returns 0 for zero reps', () => {
    expect(estimatedOneRepMax(225, 0)).toBe(0)
  })

  it('returns 0 for negative inputs', () => {
    expect(estimatedOneRepMax(-100, 5)).toBe(0)
    expect(estimatedOneRepMax(100, -5)).toBe(0)
  })

  it('returns 0 for NaN inputs', () => {
    expect(estimatedOneRepMax(NaN, 5)).toBe(0)
    expect(estimatedOneRepMax(225, NaN)).toBe(0)
  })
})

describe('validateWeight', () => {
  it('passes null through', () => {
    expect(validateWeight(null)).toBe(null)
  })

  it('returns valid weight unchanged', () => {
    expect(validateWeight(185)).toBe(185)
  })

  it('clamps at MAX_WEIGHT', () => {
    expect(validateWeight(MAX_WEIGHT + 100)).toBe(MAX_WEIGHT)
  })

  it('returns null for negative', () => {
    expect(validateWeight(-10)).toBe(null)
  })

  it('returns null for NaN', () => {
    expect(validateWeight(NaN)).toBe(null)
  })

  it('returns null for Infinity', () => {
    expect(validateWeight(Infinity)).toBe(null)
  })
})

describe('validateReps', () => {
  it('passes null through', () => {
    expect(validateReps(null)).toBe(null)
  })

  it('rounds fractional reps', () => {
    expect(validateReps(5.7)).toBe(6)
  })

  it('clamps at MAX_REPS', () => {
    expect(validateReps(MAX_REPS + 50)).toBe(MAX_REPS)
  })

  it('returns null for negative', () => {
    expect(validateReps(-1)).toBe(null)
  })
})
