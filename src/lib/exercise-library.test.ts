import { describe, it, expect } from 'vitest'
import { EXERCISE_LIBRARY, getExercisesByMuscle, getCompounds } from './exercise-library'

describe('EXERCISE_LIBRARY', () => {
  it('has more than 30 entries', () => {
    expect(EXERCISE_LIBRARY.length).toBeGreaterThan(30)
  })

  it('has unique keys', () => {
    const keys = EXERCISE_LIBRARY.map((e) => e.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('every exercise has at least one muscle', () => {
    for (const ex of EXERCISE_LIBRARY) {
      expect(ex.muscles.length, `${ex.name} has no muscles`).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('getExercisesByMuscle', () => {
  it('returns only exercises targeting the given muscle', () => {
    const chest = getExercisesByMuscle('chest')
    expect(chest.length).toBeGreaterThan(0)
    for (const ex of chest) {
      expect(ex.muscles).toContain('chest')
    }
  })

  it('returns empty array for nonexistent muscle', () => {
    expect(getExercisesByMuscle('nonexistent')).toEqual([])
  })
})

describe('getCompounds', () => {
  it('returns exactly 6 wave-eligible exercises', () => {
    const compounds = getCompounds()
    expect(compounds.length).toBe(6)
    for (const ex of compounds) {
      expect(ex.waveEligible).toBe(true)
    }
  })

  it('includes the four main lifts', () => {
    const keys = getCompounds().map((e) => e.key)
    expect(keys).toContain('squat')
    expect(keys).toContain('bench')
    expect(keys).toContain('deadlift')
    expect(keys).toContain('ohp')
  })
})
