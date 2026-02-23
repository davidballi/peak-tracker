import { describe, it, expect } from 'vitest'
import { dedupeExercises, mergeWorkouts, type ImportExercise, type ImportWorkout } from './import-history'

describe('dedupeExercises', () => {
  it('returns unchanged when no duplicates', () => {
    const input: ImportExercise[] = [
      { name: 'Squat', sets: [{ weight: 225, reps: 5 }] },
      { name: 'Bench', sets: [{ weight: 185, reps: 5 }] },
    ]
    expect(dedupeExercises(input)).toEqual(input)
  })

  it('merges sets for same-name exercises', () => {
    const input: ImportExercise[] = [
      { name: 'Squat', sets: [{ weight: 225, reps: 5 }] },
      { name: 'Squat', sets: [{ weight: 245, reps: 3 }] },
    ]
    const result = dedupeExercises(input)
    expect(result.length).toBe(1)
    expect(result[0].sets.length).toBe(2)
    expect(result[0].sets[0]).toEqual({ weight: 225, reps: 5 })
    expect(result[0].sets[1]).toEqual({ weight: 245, reps: 3 })
  })

  it('returns empty for empty input', () => {
    expect(dedupeExercises([])).toEqual([])
  })

  it('preserves first-occurrence order', () => {
    const input: ImportExercise[] = [
      { name: 'Bench', sets: [{ weight: 185, reps: 5 }] },
      { name: 'Squat', sets: [{ weight: 225, reps: 5 }] },
      { name: 'Bench', sets: [{ weight: 195, reps: 3 }] },
    ]
    const result = dedupeExercises(input)
    expect(result.map((e) => e.name)).toEqual(['Bench', 'Squat'])
  })
})

describe('mergeWorkouts', () => {
  it('returns unchanged when all sessions unique', () => {
    const input: ImportWorkout[] = [
      { block: 1, week: 1, day: 0, exercises: [{ name: 'Squat', sets: [{ weight: 225, reps: 5 }] }] },
      { block: 1, week: 1, day: 1, exercises: [{ name: 'Bench', sets: [{ weight: 185, reps: 5 }] }] },
    ]
    const result = mergeWorkouts(input)
    expect(result.length).toBe(2)
  })

  it('merges workouts with same (block, week, day)', () => {
    const input: ImportWorkout[] = [
      { block: 1, week: 1, day: 0, exercises: [{ name: 'Squat', sets: [{ weight: 225, reps: 5 }] }] },
      { block: 1, week: 1, day: 0, exercises: [{ name: 'Bench', sets: [{ weight: 185, reps: 5 }] }] },
    ]
    const result = mergeWorkouts(input)
    expect(result.length).toBe(1)
    expect(result[0].exercises.length).toBe(2)
  })

  it('concatenates sets for same exercise in merged workouts', () => {
    const input: ImportWorkout[] = [
      { block: 1, week: 1, day: 0, exercises: [{ name: 'Squat', sets: [{ weight: 225, reps: 5 }] }] },
      { block: 1, week: 1, day: 0, exercises: [{ name: 'Squat', sets: [{ weight: 245, reps: 3 }] }] },
    ]
    const result = mergeWorkouts(input)
    expect(result.length).toBe(1)
    expect(result[0].exercises.length).toBe(1)
    expect(result[0].exercises[0].sets.length).toBe(2)
  })

  it('returns empty for empty input', () => {
    expect(mergeWorkouts([])).toEqual([])
  })
})
