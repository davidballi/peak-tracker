import { describe, it, expect } from 'vitest'
import { roundToNearest5, estimatedOneRepMax, validateWeight, validateReps, MAX_WEIGHT, MAX_REPS, convertWeight, roundToNearest, bwMultiple, calculatePlates } from './calc'

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

describe('convertWeight', () => {
  it('converts lb to kg', () => {
    expect(convertWeight(225, 'lb', 'kg')).toBeCloseTo(102.06, 1)
  })

  it('converts kg to lb', () => {
    expect(convertWeight(100, 'kg', 'lb')).toBeCloseTo(220.46, 1)
  })

  it('returns same value when units match', () => {
    expect(convertWeight(100, 'lb', 'lb')).toBe(100)
  })

  it('returns 0 for non-finite input', () => {
    expect(convertWeight(NaN, 'lb', 'kg')).toBe(0)
  })
})

describe('roundToNearest', () => {
  it('rounds to 5 by default', () => {
    expect(roundToNearest(132, 5)).toBe(130)
  })

  it('rounds to 2.5 for kg', () => {
    expect(roundToNearest(51, 2.5)).toBe(50)
  })

  it('returns 0 for non-finite input', () => {
    expect(roundToNearest(NaN, 5)).toBe(0)
  })
})

describe('bwMultiple', () => {
  it('returns ratio when both values are positive', () => {
    expect(bwMultiple(370, 185)).toBeCloseTo(2.0)
  })

  it('returns null when bodyWeight is 0', () => {
    expect(bwMultiple(370, 0)).toBe(null)
  })

  it('returns null when bodyWeight is not set (NaN)', () => {
    expect(bwMultiple(370, NaN)).toBe(null)
  })

  it('returns null when e1rm is 0', () => {
    expect(bwMultiple(0, 185)).toBe(null)
  })
})

describe('calculatePlates', () => {
  const defaultPlates = [45, 35, 25, 10, 5, 2.5]

  it('returns empty for weight equal to bar', () => {
    expect(calculatePlates(45, 45, defaultPlates)).toEqual([])
  })

  it('returns empty for weight less than bar', () => {
    expect(calculatePlates(30, 45, defaultPlates)).toEqual([])
  })

  it('calculates single plate pair', () => {
    expect(calculatePlates(135, 45, defaultPlates)).toEqual([45])
  })

  it('calculates multiple plates per side', () => {
    // 225 - 45 = 180 / 2 = 90 per side → greedy: 45 + 45
    expect(calculatePlates(225, 45, defaultPlates)).toEqual([45, 45])
  })

  it('handles repeated plates', () => {
    expect(calculatePlates(315, 45, defaultPlates)).toEqual([45, 45, 45])
  })

  it('handles small increments', () => {
    expect(calculatePlates(50, 45, defaultPlates)).toEqual([2.5])
  })

  it('returns empty when remainder cant be loaded', () => {
    expect(calculatePlates(48, 45, defaultPlates)).toEqual([])
  })

  it('works with limited plate selection', () => {
    expect(calculatePlates(155, 45, [45, 10])).toEqual([45, 10])
  })

  it('returns empty for non-finite input', () => {
    expect(calculatePlates(NaN, 45, defaultPlates)).toEqual([])
    expect(calculatePlates(225, NaN, defaultPlates)).toEqual([])
  })

  it('returns empty for negative weight', () => {
    expect(calculatePlates(-100, 45, defaultPlates)).toEqual([])
  })
})
