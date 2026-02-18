import { v4 as uuid } from 'uuid'
import { getDb, withWriteLock } from './db'
import workoutData from '../../public/workout-history.json'

interface ImportSet {
  weight: number
  reps: number
}

interface ImportExercise {
  name: string
  sets: ImportSet[]
}

interface ImportWorkout {
  block: number
  week: number
  day: number
  exercises: ImportExercise[]
}

const rawWorkouts = workoutData as ImportWorkout[]

/**
 * Deduplicate exercises within a single workout (merge sets for same-name exercises).
 */
function dedupeExercises(exercises: ImportExercise[]): ImportExercise[] {
  const map = new Map<string, ImportExercise>()
  for (const ex of exercises) {
    const existing = map.get(ex.name)
    if (existing) {
      existing.sets.push(...ex.sets)
    } else {
      map.set(ex.name, { name: ex.name, sets: [...ex.sets] })
    }
  }
  return Array.from(map.values())
}

/**
 * Merge duplicate (block, week, day) sessions and deduplicate exercises within each.
 */
function mergeWorkouts(data: ImportWorkout[]): ImportWorkout[] {
  const map = new Map<string, ImportWorkout>()
  for (const w of data) {
    const key = `${w.block}_${w.week}_${w.day}`
    const existing = map.get(key)
    if (existing) {
      for (const ex of w.exercises) {
        const match = existing.exercises.find((e) => e.name === ex.name)
        if (match) {
          match.sets.push(...ex.sets)
        } else {
          existing.exercises.push({ name: ex.name, sets: [...ex.sets] })
        }
      }
    } else {
      map.set(key, {
        block: w.block,
        week: w.week,
        day: w.day,
        exercises: dedupeExercises(w.exercises),
      })
    }
  }
  return Array.from(map.values())
}

const workouts = mergeWorkouts(rawWorkouts)

export async function importWorkoutHistory(programId: string): Promise<number> {
  if (!workouts || workouts.length === 0) return 0

  const db = await getDb()
  return withWriteLock(() => _importWorkouts(db, programId, workouts))
}

async function _importWorkouts(
  db: Awaited<ReturnType<typeof getDb>>,
  programId: string,
  data: ImportWorkout[],
): Promise<number> {
  // Get existing days for the program
  const dayRows = await db.select<Array<{ id: string; day_index: number }>>(
    `SELECT id, day_index FROM days WHERE program_id = ? ORDER BY day_index`,
    [programId],
  )
  const dayByIndex = new Map(dayRows.map((d) => [d.day_index, d.id]))

  // Ensure we have days 0-3
  for (let i = 0; i <= 3; i++) {
    if (!dayByIndex.has(i)) {
      const dayId = uuid()
      await db.execute(
        `INSERT INTO days (id, program_id, day_index, name, subtitle, focus) VALUES (?, ?, ?, ?, '', '')`,
        [dayId, programId, i, `Day ${i + 1}`],
      )
      dayByIndex.set(i, dayId)
    }
  }

  // Get existing exercises by name
  const exerciseRows = await db.select<Array<{ id: string; name: string }>>(
    `SELECT e.id, e.name FROM exercises e
     JOIN days d ON e.day_id = d.id
     WHERE d.program_id = ?`,
    [programId],
  )
  const exerciseByName = new Map(exerciseRows.map((e) => [e.name, e.id]))

  // Collect all unique exercise names
  const allNames = new Set<string>()
  for (const w of data) {
    for (const ex of w.exercises) {
      allNames.add(ex.name)
    }
  }

  // Create exercises that don't exist yet
  const defaultDayId = dayByIndex.get(0)!
  let nextIndex = exerciseRows.length
  for (const name of allNames) {
    if (!exerciseByName.has(name)) {
      const exId = uuid()
      await db.execute(
        `INSERT OR IGNORE INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave) VALUES (?, ?, ?, ?, ?, 'acc', 0, 0, 0, '', 0)`,
        [exId, defaultDayId, nextIndex, name.toLowerCase().replace(/\s+/g, '_'), name],
      )
      exerciseByName.set(name, exId)
      nextIndex++
    }
  }

  // Upsert each workout: find or create workout_log, replace its set_logs
  let imported = 0
  for (const w of data) {
    const dayId = dayByIndex.get(w.day) ?? dayByIndex.get(0)!

    // Find existing workout_log or create one
    let workoutLogId: string
    const existing = await db.select<Array<{ id: string }>>(
      `SELECT id FROM workout_logs WHERE program_id = ? AND day_id = ? AND block_num = ? AND week_index = ?`,
      [programId, dayId, w.block, w.week],
    )

    if (existing.length > 0) {
      workoutLogId = existing[0].id
      // Clear old set_logs for this workout
      await db.execute(`DELETE FROM set_logs WHERE workout_log_id = ?`, [workoutLogId])
    } else {
      workoutLogId = uuid()
      await db.execute(
        `INSERT INTO workout_logs (id, program_id, day_id, block_num, week_index) VALUES (?, ?, ?, ?, ?)`,
        [workoutLogId, programId, dayId, w.block, w.week],
      )
    }

    for (const ex of w.exercises) {
      const exerciseId = exerciseByName.get(ex.name)
      if (!exerciseId) continue

      for (let si = 0; si < ex.sets.length; si++) {
        const s = ex.sets[si]
        if (s.weight > 0 && s.reps > 0) {
          await db.execute(
            `INSERT INTO set_logs (id, workout_log_id, exercise_id, set_index, weight, reps, is_completed) VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [uuid(), workoutLogId, exerciseId, si, s.weight, s.reps],
          )
        }
      }
    }
    imported++
  }

  return imported
}
