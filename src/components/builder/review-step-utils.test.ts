import { describe, it, expect } from 'vitest'
import { exerciseToFormData, formDataToExercise, exerciseSummary } from './review-step-utils'
import type { GeneratedExercise } from '../../lib/program-generator'

const waveExercise: GeneratedExercise = {
  name: 'Back Squat',
  key: 'squat',
  category: 'absolute',
  sets: 4,
  reps: 5,
  defaultWeight: 225,
  note: '',
  isWave: true,
  baseMax: 370,
}

const nonWaveExercise: GeneratedExercise = {
  name: 'Incline DB Press',
  key: 'incline_db',
  category: 'acc',
  sets: 3,
  reps: 10,
  defaultWeight: 65,
  note: 'slow eccentric',
  isWave: false,
  baseMax: 0,
}

const bodyweightExercise: GeneratedExercise = {
  name: 'Dips',
  key: 'dips',
  category: 'acc',
  sets: 3,
  reps: 10,
  defaultWeight: 0,
  note: '',
  isWave: false,
  baseMax: 0,
}

describe('exerciseToFormData', () => {
  it('overrides sets to 3 and reps to 5 for wave exercises', () => {
    const fd = exerciseToFormData(waveExercise)
    expect(fd.sets).toBe(3)
    expect(fd.reps).toBe(5)
    expect(fd.isWave).toBe(true)
    expect(fd.baseMax).toBe(370)
  })

  it('preserves original sets/reps for non-wave exercises', () => {
    const fd = exerciseToFormData(nonWaveExercise)
    expect(fd.sets).toBe(3)
    expect(fd.reps).toBe(10)
    expect(fd.isWave).toBe(false)
  })
})

describe('formDataToExercise', () => {
  it('generates key from name: lowercase + underscores', () => {
    const fd = exerciseToFormData(nonWaveExercise)
    const ex = formDataToExercise(fd)
    expect(ex.key).toBe('incline_db_press')
  })

  it('zeros out sets/reps/defaultWeight for wave exercises', () => {
    const fd = exerciseToFormData(waveExercise)
    const ex = formDataToExercise(fd)
    expect(ex.sets).toBe(0)
    expect(ex.reps).toBe(0)
    expect(ex.defaultWeight).toBe(0)
    expect(ex.isWave).toBe(true)
    expect(ex.baseMax).toBe(370)
  })

  it('preserves sets/reps/defaultWeight for non-wave exercises', () => {
    const fd = exerciseToFormData(nonWaveExercise)
    const ex = formDataToExercise(fd)
    expect(ex.sets).toBe(3)
    expect(ex.reps).toBe(10)
    expect(ex.defaultWeight).toBe(65)
  })
})

describe('exerciseSummary', () => {
  it('formats wave exercise as "Wave · TM: {baseMax}"', () => {
    expect(exerciseSummary(waveExercise)).toBe('Wave \u00b7 TM: 370')
  })

  it('formats non-wave with weight as "{sets}×{reps} @ {weight} lb"', () => {
    expect(exerciseSummary(nonWaveExercise)).toBe('3\u00d710 @ 65 lb')
  })

  it('formats bodyweight as "{sets}×{reps}" (no weight)', () => {
    expect(exerciseSummary(bodyweightExercise)).toBe('3\u00d710')
  })
})

describe('round-trip', () => {
  it('preserves wave exercise through round-trip', () => {
    const fd = exerciseToFormData(waveExercise)
    const ex = formDataToExercise(fd)
    expect(ex.name).toBe(waveExercise.name)
    expect(ex.isWave).toBe(true)
    expect(ex.baseMax).toBe(waveExercise.baseMax)
  })

  it('preserves non-wave exercise through round-trip', () => {
    const fd = exerciseToFormData(nonWaveExercise)
    const ex = formDataToExercise(fd)
    expect(ex.name).toBe(nonWaveExercise.name)
    expect(ex.sets).toBe(nonWaveExercise.sets)
    expect(ex.reps).toBe(nonWaveExercise.reps)
    expect(ex.defaultWeight).toBe(nonWaveExercise.defaultWeight)
    expect(ex.note).toBe(nonWaveExercise.note)
  })
})
