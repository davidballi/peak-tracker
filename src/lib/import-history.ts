import { v4 as uuid } from 'uuid'
import { getDb, withWriteLock } from './db'

interface HistorySet {
  weight: number
  reps: number
}

interface HistoryExercise {
  name: string
  sets: HistorySet[]
}

interface HistoryWorkout {
  block: number
  week: number
  day: number
  exercises: HistoryExercise[]
}

export interface ImportHistoryResult {
  workoutsCreated: number
  setsImported: number
  exercisesMatched: string[]
  exercisesUnmatched: string[]
  maxBlock: number
  errors: string[]
}

export async function importHistoryFromJson(
  jsonString: string,
  programId: string,
): Promise<ImportHistoryResult> {
  const result: ImportHistoryResult = {
    workoutsCreated: 0,
    setsImported: 0,
    exercisesMatched: [],
    exercisesUnmatched: [],
    maxBlock: 0,
    errors: [],
  }

  let workouts: HistoryWorkout[]
  try {
    workouts = JSON.parse(jsonString) as HistoryWorkout[]
  } catch {
    result.errors.push('Invalid JSON')
    return result
  }

  if (!Array.isArray(workouts)) {
    result.errors.push('Expected an array of workouts')
    return result
  }

  return withWriteLock(async () => {
    const db = await getDb()

    // Build exercise name → { id, dayId } map from the program
    const exerciseRows = await db.select<Array<{
      id: string
      name: string
      day_id: string
    }>>(
      `SELECT e.id, e.name, e.day_id FROM exercises e
       JOIN days d ON e.day_id = d.id
       WHERE d.program_id = ?`,
      [programId],
    )

    const exerciseMap = new Map<string, { id: string; dayId: string; name: string }>()
    for (const row of exerciseRows) {
      exerciseMap.set(row.name.toLowerCase(), {
        id: row.id,
        dayId: row.day_id,
        name: row.name,
      })
    }

    function findExercise(name: string) {
      return exerciseMap.get(name.toLowerCase()) || null
    }

    const matchedNames = new Set<string>()
    const unmatchedNames = new Set<string>()

    for (const workout of workouts) {
      if (!workout.exercises || workout.exercises.length === 0) continue

      if (workout.block > result.maxBlock) result.maxBlock = workout.block

      // Group imported exercises by which program day they belong to
      const dayGroups = new Map<string, Array<{ exerciseId: string; sets: HistorySet[] }>>()

      for (const ex of workout.exercises) {
        const match = findExercise(ex.name)
        if (!match) {
          unmatchedNames.add(ex.name)
          continue
        }
        matchedNames.add(match.name)

        const validSets = ex.sets.filter(s => s.weight > 0 && s.reps > 0)
        if (validSets.length === 0) continue

        if (!dayGroups.has(match.dayId)) {
          dayGroups.set(match.dayId, [])
        }
        dayGroups.get(match.dayId)!.push({
          exerciseId: match.id,
          sets: validSets,
        })
      }

      for (const [dayId, exercises] of dayGroups) {
        // Find or create workout_log
        const existing = await db.select<Array<{ id: string }>>(
          `SELECT id FROM workout_logs WHERE program_id = ? AND day_id = ? AND block_num = ? AND week_index = ?`,
          [programId, dayId, workout.block, workout.week],
        )

        let workoutLogId: string
        if (existing.length > 0) {
          workoutLogId = existing[0].id
        } else {
          workoutLogId = uuid()
          await db.execute(
            `INSERT INTO workout_logs (id, program_id, day_id, block_num, week_index) VALUES (?, ?, ?, ?, ?)`,
            [workoutLogId, programId, dayId, workout.block, workout.week],
          )
          result.workoutsCreated++
        }

        for (const ex of exercises) {
          // Skip if sets already exist for this exercise in this workout (idempotent)
          const existingSets = await db.select<Array<{ id: string }>>(
            `SELECT id FROM set_logs WHERE workout_log_id = ? AND exercise_id = ? LIMIT 1`,
            [workoutLogId, ex.exerciseId],
          )
          if (existingSets.length > 0) continue

          for (let i = 0; i < ex.sets.length; i++) {
            const s = ex.sets[i]
            await db.execute(
              `INSERT INTO set_logs (id, workout_log_id, exercise_id, set_index, weight, reps, is_completed) VALUES (?, ?, ?, ?, ?, ?, 1)`,
              [uuid(), workoutLogId, ex.exerciseId, i, s.weight, s.reps],
            )
            result.setsImported++
          }
        }
      }
    }

    // Update program block_num if imported data goes beyond current
    if (result.maxBlock > 0) {
      await db.execute(
        `UPDATE programs SET block_num = MAX(block_num, ?) WHERE id = ?`,
        [result.maxBlock + 1, programId],
      )
    }

    result.exercisesMatched = Array.from(matchedNames).sort()
    result.exercisesUnmatched = Array.from(unmatchedNames).sort()
    return result
  })
}
