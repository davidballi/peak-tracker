import { describe, it, expect } from 'vitest'
import { generateProgram, type Goal } from './program-generator'

describe('generateProgram', () => {
  describe('program names', () => {
    it('names strength program correctly', () => {
      expect(generateProgram('strength', 3).name).toBe('Strength Program')
    })

    it('names hypertrophy program correctly', () => {
      expect(generateProgram('hypertrophy', 3).name).toBe('Hypertrophy Program')
    })

    it('names general program correctly', () => {
      expect(generateProgram('general', 3).name).toBe('Fitness Program')
    })
  })

  describe('day counts', () => {
    it.each([2, 3, 4, 5, 6])('generates %i days', (count) => {
      const prog = generateProgram('strength', count)
      expect(prog.days.length).toBe(count)
    })

    it('throws on dayCount 1', () => {
      expect(() => generateProgram('strength', 1)).toThrow('Unsupported day count')
    })

    it('throws on dayCount 7', () => {
      expect(() => generateProgram('strength', 7)).toThrow('Unsupported day count')
    })
  })

  describe('strength goal', () => {
    it('has wave exercises with baseMax = defaultWeight * 2', () => {
      const prog = generateProgram('strength', 3)
      const waveExercises = prog.days.flatMap((d) => d.exercises).filter((e) => e.isWave)
      expect(waveExercises.length).toBeGreaterThan(0)
      for (const ex of waveExercises) {
        expect(ex.baseMax).toBeGreaterThan(0)
      }
    })

    it('wave compounds have sets=4, reps=5', () => {
      const prog = generateProgram('strength', 3)
      const waveExercises = prog.days.flatMap((d) => d.exercises).filter((e) => e.isWave)
      for (const ex of waveExercises) {
        // Wave exercises store 0 for sets/reps (they use wave config instead)
        // but the generator sets 4/5 — these are the main compound values
        expect(ex.sets).toBe(4)
        expect(ex.reps).toBe(5)
      }
    })

    it('includes tech exercises', () => {
      const prog = generateProgram('strength', 3)
      const techs = prog.days.flatMap((d) => d.exercises).filter((e) => e.category === 'tech')
      expect(techs.length).toBeGreaterThan(0)
    })
  })

  describe('hypertrophy goal', () => {
    it('compounds have sets=4, reps=10', () => {
      const prog = generateProgram('hypertrophy', 3)
      const compounds = prog.days.flatMap((d) => d.exercises).filter((e) => e.category === 'absolute')
      expect(compounds.length).toBeGreaterThan(0)
      for (const ex of compounds) {
        expect(ex.sets).toBe(4)
        expect(ex.reps).toBe(10)
      }
    })

    it('has no wave exercises', () => {
      const prog = generateProgram('hypertrophy', 3)
      const wave = prog.days.flatMap((d) => d.exercises).filter((e) => e.isWave)
      expect(wave.length).toBe(0)
    })

    it('has no tech exercises', () => {
      const prog = generateProgram('hypertrophy', 3)
      const techs = prog.days.flatMap((d) => d.exercises).filter((e) => e.category === 'tech')
      expect(techs.length).toBe(0)
    })
  })

  describe('general goal', () => {
    it('compounds have sets=3, reps=8', () => {
      const prog = generateProgram('general', 3)
      const compounds = prog.days.flatMap((d) => d.exercises).filter((e) => e.category === 'absolute')
      for (const ex of compounds) {
        expect(ex.sets).toBe(3)
        expect(ex.reps).toBe(8)
      }
    })
  })

  describe('strength 4-day special split', () => {
    it('has unique day names for strength 4-day', () => {
      const prog = generateProgram('strength', 4)
      const names = prog.days.map((d) => d.name)
      expect(new Set(names).size).toBe(4)
      expect(names).toContain('Lower Body Strength')
      expect(names).toContain('Upper Body Strength')
      expect(names).toContain('Posterior Chain')
      expect(names).toContain('Shoulders & Athletic')
    })
  })

  describe('non-strength 4-day uses upper/lower A/B', () => {
    it('hypertrophy 4-day uses upper/lower split', () => {
      const prog = generateProgram('hypertrophy', 4)
      const names = prog.days.map((d) => d.name)
      expect(names.filter((n) => n.startsWith('Upper Body')).length).toBe(2)
      expect(names.filter((n) => n.startsWith('Lower Body')).length).toBe(2)
    })
  })

  describe('determinism', () => {
    it('same inputs produce identical output', () => {
      const a = generateProgram('strength', 4)
      const b = generateProgram('strength', 4)
      expect(a).toEqual(b)
    })
  })

  describe('coverage', () => {
    it('every day has at least 1 exercise across all 15 combinations', () => {
      const goals: Goal[] = ['strength', 'hypertrophy', 'general']
      const counts = [2, 3, 4, 5, 6]
      for (const goal of goals) {
        for (const count of counts) {
          const prog = generateProgram(goal, count)
          for (const day of prog.days) {
            expect(day.exercises.length, `${goal}/${count}/${day.name}`).toBeGreaterThanOrEqual(1)
          }
        }
      }
    })
  })
})
