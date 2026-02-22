import type { ExerciseCategory } from '../types/program'
import { EXERCISE_LIBRARY, type LibraryExercise } from './exercise-library'

// ── Public types ──────────────────────────────────────────────────────────────

export type Goal = 'strength' | 'hypertrophy' | 'general'

export interface GeneratedExercise {
  name: string
  key: string
  category: ExerciseCategory
  sets: number
  reps: number
  defaultWeight: number
  note: string
  isWave: boolean
  baseMax: number // only meaningful when isWave is true
}

export interface GeneratedDay {
  name: string
  subtitle: string
  focus: string
  exercises: GeneratedExercise[]
}

export interface GeneratedProgram {
  name: string
  days: GeneratedDay[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findExercise(key: string): LibraryExercise {
  const ex = EXERCISE_LIBRARY.find(e => e.key === key)
  if (!ex) throw new Error(`Exercise not found: ${key}`)
  return ex
}

function buildExercise(
  key: string,
  goal: Goal,
  overrides?: Partial<Pick<GeneratedExercise, 'sets' | 'reps' | 'defaultWeight' | 'isWave' | 'category' | 'note'>>,
): GeneratedExercise {
  const lib = findExercise(key)
  const category = overrides?.category ?? lib.category
  const isWave = overrides?.isWave ?? false
  const sets = overrides?.sets ?? lib.defaultSets
  const reps = overrides?.reps ?? lib.defaultReps
  const weight = overrides?.defaultWeight ?? lib.defaultWeight

  return {
    name: lib.name,
    key: lib.key,
    category,
    sets,
    reps,
    defaultWeight: weight,
    note: overrides?.note ?? '',
    isWave,
    baseMax: isWave ? weight * 2 : 0,
  }
}

/** Build a main compound for the given goal. */
function mainCompound(key: string, goal: Goal): GeneratedExercise {
  const lib = findExercise(key)
  switch (goal) {
    case 'strength':
      return buildExercise(key, goal, {
        sets: 4,
        reps: 5,
        isWave: true,
        defaultWeight: lib.defaultWeight,
      })
    case 'hypertrophy':
      return buildExercise(key, goal, {
        sets: 4,
        reps: 10,
        isWave: false,
        defaultWeight: lib.defaultWeight,
      })
    case 'general':
      return buildExercise(key, goal, {
        sets: 3,
        reps: 8,
        isWave: false,
        defaultWeight: lib.defaultWeight,
      })
  }
}

/** Build a tech primer (strength-only). */
function techExercise(key: string, goal: Goal): GeneratedExercise {
  const lib = findExercise(key)
  return buildExercise(key, goal, {
    category: 'tech',
    sets: 3,
    reps: goal === 'strength' ? 3 : lib.defaultReps,
    defaultWeight: lib.defaultWeight,
  })
}

/** Build a core superset exercise. */
function coreExercise(key: string, goal: Goal): GeneratedExercise {
  const lib = findExercise(key)
  return buildExercise(key, goal, {
    category: 'ss',
    sets: 3,
    reps: lib.defaultReps,
    defaultWeight: lib.defaultWeight,
  })
}

/** Build an accessory exercise adapted to the goal. */
function accessory(key: string, goal: Goal, overrides?: Partial<Pick<GeneratedExercise, 'sets' | 'reps' | 'defaultWeight'>>): GeneratedExercise {
  const lib = findExercise(key)
  let sets: number
  let reps: number
  switch (goal) {
    case 'strength':
      sets = overrides?.sets ?? 3
      reps = overrides?.reps ?? 8
      break
    case 'hypertrophy':
      sets = overrides?.sets ?? 3
      reps = overrides?.reps ?? 12
      break
    case 'general':
      sets = overrides?.sets ?? 3
      reps = overrides?.reps ?? 10
      break
  }
  return buildExercise(key, goal, {
    category: 'acc',
    sets,
    reps,
    defaultWeight: overrides?.defaultWeight ?? lib.defaultWeight,
  })
}

// ── Day builders ──────────────────────────────────────────────────────────────

interface DaySpec {
  name: string
  subtitle: string
  focus: string
  tech?: string        // key for tech primer (strength only)
  compounds: string[]  // keys for main lifts
  core: string         // key for core superset
  accessories: string[] // keys for accessory exercises
}

function buildDay(spec: DaySpec, goal: Goal): GeneratedDay {
  const exercises: GeneratedExercise[] = []

  // 1. Optional tech primer (strength only)
  if (goal === 'strength' && spec.tech) {
    exercises.push(techExercise(spec.tech, goal))
  }

  // 2. Main compounds
  for (const key of spec.compounds) {
    exercises.push(mainCompound(key, goal))
  }

  // 3. Core superset
  exercises.push(coreExercise(spec.core, goal))

  // 4. Accessories
  for (const key of spec.accessories) {
    exercises.push(accessory(key, goal))
  }

  return {
    name: spec.name,
    subtitle: spec.subtitle,
    focus: spec.focus,
    exercises,
  }
}

// ── Split definitions ─────────────────────────────────────────────────────────

function upper(label: string, variant: 'A' | 'B' = 'A'): DaySpec {
  if (variant === 'A') {
    return {
      name: `Upper Body ${label}`,
      subtitle: 'Bench + Back',
      focus: 'Chest & Back',
      tech: 'push_press',
      compounds: ['bench', 'barbell_row'],
      core: 'ab_wheel',
      accessories: ['incline_db', 'lat_pulldown', 'tricep_pushdown'],
    }
  }
  return {
    name: `Upper Body ${label}`,
    subtitle: 'OHP + Pull',
    focus: 'Shoulders & Back',
    tech: 'hang_clean',
    compounds: ['ohp', 'barbell_row'],
    core: 'hang_leg_raise',
    accessories: ['face_pull', 'db_row', 'bb_curl'],
  }
}

function lower(label: string, variant: 'A' | 'B' = 'A'): DaySpec {
  if (variant === 'A') {
    return {
      name: `Lower Body ${label}`,
      subtitle: 'Squat + Accessories',
      focus: 'Squat & Quads',
      tech: 'db_snatch',
      compounds: ['squat'],
      core: 'hang_leg_raise',
      accessories: ['rdl', 'leg_ext', 'calf_raise'],
    }
  }
  return {
    name: `Lower Body ${label}`,
    subtitle: 'Deadlift + Accessories',
    focus: 'Deadlift & Posterior Chain',
    tech: 'kettlebell_swing',
    compounds: ['deadlift'],
    core: 'cable_crunch',
    accessories: ['leg_press', 'leg_curl', 'hip_thrust'],
  }
}

function push(label: string, variant: 'A' | 'B' = 'A'): DaySpec {
  if (variant === 'A') {
    return {
      name: `Push ${label}`,
      subtitle: 'Bench + Shoulders',
      focus: 'Chest & Triceps',
      tech: 'push_press',
      compounds: ['bench'],
      core: 'ab_wheel',
      accessories: ['incline_db', 'lat_raise', 'tricep_pushdown'],
    }
  }
  return {
    name: `Push ${label}`,
    subtitle: 'OHP + Chest',
    focus: 'Shoulders & Chest',
    tech: 'push_press',
    compounds: ['ohp'],
    core: 'plank',
    accessories: ['chest_fly', 'dips', 'overhead_tricep_extension'],
  }
}

function pull(label: string, variant: 'A' | 'B' = 'A'): DaySpec {
  if (variant === 'A') {
    return {
      name: `Pull ${label}`,
      subtitle: 'Row + Biceps',
      focus: 'Back & Biceps',
      tech: 'hang_clean',
      compounds: ['barbell_row'],
      core: 'hang_leg_raise',
      accessories: ['lat_pulldown', 'face_pull', 'bb_curl'],
    }
  }
  return {
    name: `Pull ${label}`,
    subtitle: 'Pulldown + Rear Delts',
    focus: 'Back & Rear Delts',
    tech: 'kettlebell_swing',
    compounds: ['barbell_row'],
    core: 'cable_crunch',
    accessories: ['chin_up', 'rear_delt_fly', 'hammer_curl'],
  }
}

function legs(label: string, variant: 'A' | 'B' = 'A'): DaySpec {
  if (variant === 'A') {
    return {
      name: `Legs ${label}`,
      subtitle: 'Squat + Posterior',
      focus: 'Squat & Quads',
      tech: 'db_snatch',
      compounds: ['squat'],
      core: 'hang_leg_raise',
      accessories: ['rdl', 'leg_ext', 'calf_raise'],
    }
  }
  return {
    name: `Legs ${label}`,
    subtitle: 'Deadlift + Quads',
    focus: 'Deadlift & Hamstrings',
    tech: 'box_jump',
    compounds: ['deadlift'],
    core: 'cable_crunch',
    accessories: ['bulgarian_split_squat', 'leg_curl', 'walking_lunge'],
  }
}

// ── Strength 4-day (unique split) ─────────────────────────────────────────────

function strength4Day(): DaySpec[] {
  return [
    {
      name: 'Lower Body Strength',
      subtitle: 'Squat Day',
      focus: 'Squat + Posterior Chain',
      tech: 'db_snatch',
      compounds: ['squat'],
      core: 'hang_leg_raise',
      accessories: ['rdl', 'leg_ext', 'calf_raise'],
    },
    {
      name: 'Upper Body Strength',
      subtitle: 'Bench Day',
      focus: 'Bench + Push',
      tech: 'push_press',
      compounds: ['bench'],
      core: 'ab_wheel',
      accessories: ['incline_db', 'lat_pulldown', 'tricep_pushdown'],
    },
    {
      name: 'Posterior Chain',
      subtitle: 'Deadlift Day',
      focus: 'Deadlift + Back',
      tech: 'kettlebell_swing',
      compounds: ['deadlift'],
      core: 'cable_crunch',
      accessories: ['barbell_row', 'seated_row', 'hammer_curl'],
    },
    {
      name: 'Shoulders & Athletic',
      subtitle: 'OHP Day',
      focus: 'OHP + Shoulders',
      tech: 'hang_clean',
      compounds: ['ohp'],
      core: 'hang_leg_raise',
      accessories: ['lat_raise', 'face_pull', 'bb_curl'],
    },
  ]
}

// ── Split selector ────────────────────────────────────────────────────────────

function getDaySpecs(goal: Goal, dayCount: number): DaySpec[] {
  switch (dayCount) {
    case 2:
      return [
        upper('A'),
        lower('A'),
      ]

    case 3:
      return [
        push('A'),
        pull('A'),
        legs('A'),
      ]

    case 4:
      if (goal === 'strength') {
        return strength4Day()
      }
      return [
        upper('A', 'A'),
        lower('A', 'A'),
        upper('B', 'B'),
        lower('B', 'B'),
      ]

    case 5:
      return [
        push('A'),
        pull('A'),
        legs('A'),
        upper('B', 'B'),
        lower('B', 'B'),
      ]

    case 6:
      return [
        push('A', 'A'),
        pull('A', 'A'),
        legs('A', 'A'),
        push('B', 'B'),
        pull('B', 'B'),
        legs('B', 'B'),
      ]

    default:
      throw new Error(`Unsupported day count: ${dayCount}. Must be 2-6.`)
  }
}

// ── Program name ──────────────────────────────────────────────────────────────

function getProgramName(goal: Goal): string {
  switch (goal) {
    case 'strength':
      return 'Strength Program'
    case 'hypertrophy':
      return 'Hypertrophy Program'
    case 'general':
      return 'Fitness Program'
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate an in-memory program structure from a goal and day count.
 * Pure function — no side effects or DB access.
 * Deterministic: same inputs always produce the same output.
 */
export function generateProgram(goal: Goal, dayCount: number): GeneratedProgram {
  const specs = getDaySpecs(goal, dayCount)
  return {
    name: getProgramName(goal),
    days: specs.map(spec => buildDay(spec, goal)),
  }
}
