import { v4 as uuid } from 'uuid'
import { getDb } from './db'

/**
 * Import data from the original Peak Tracker PWA's localStorage format.
 * The PWA stores data under the key 'peak-tracker-v2' as a JSON object with:
 * - logs: Record<string, { w: number, r: number, done: boolean }> keyed by "exerciseId_setIndex_blockNum_weekIndex"
 * - notes: Record<string, string> keyed by "exerciseId_workoutLogId" or "__workout___workoutLogId"
 * - maxes: Record<string, number> keyed by exerciseId
 * - currentWeek: number
 * - blockNum: number
 */

interface PwaData {
  logs?: Record<string, { w: number; r: number; done: boolean }>
  notes?: Record<string, string>
  maxes?: Record<string, number>
  currentWeek?: number
  blockNum?: number
}

interface ImportResult {
  setsImported: number
  notesImported: number
  maxesImported: number
  errors: string[]
}

export async function importFromPwa(jsonString: string, programId: string): Promise<ImportResult> {
  const result: ImportResult = { setsImported: 0, notesImported: 0, maxesImported: 0, errors: [] }
  const db = await getDb()

  let data: PwaData
  try {
    data = JSON.parse(jsonString) as PwaData
  } catch {
    result.errors.push('Invalid JSON format')
    return result
  }

  // Build exercise key → exercise ID mapping for the current program
  const exerciseRows = await db.select<Array<{ id: string; exercise_key: string }>>(
    `SELECT e.id, e.exercise_key FROM exercises e
     JOIN days d ON e.day_id = d.id
     WHERE d.program_id = ?`,
    [programId],
  )
  const exerciseKeyMap = new Map<string, string>()
  for (const row of exerciseRows) {
    exerciseKeyMap.set(row.exercise_key, row.id)
  }

  // Build day key mapping
  const dayRows = await db.select<Array<{ id: string; day_index: number }>>(
    `SELECT id, day_index FROM days WHERE program_id = ?`,
    [programId],
  )
  const dayIdByIndex = new Map<number, string>()
  for (const row of dayRows) {
    dayIdByIndex.set(row.day_index, row.id)
  }

  // Import set logs
  if (data.logs) {
    // Parse log keys: "exerciseKey_setIndex_blockNum_weekIndex"
    for (const [key, log] of Object.entries(data.logs)) {
      const parts = key.split('_')
      if (parts.length < 4) continue

      const exerciseKey = parts.slice(0, parts.length - 3).join('_')
      const setIndex = parseInt(parts[parts.length - 3])
      const blockNum = parseInt(parts[parts.length - 2])
      const weekIndex = parseInt(parts[parts.length - 1])

      const exerciseId = exerciseKeyMap.get(exerciseKey)
      if (!exerciseId) {
        result.errors.push(`Unknown exercise key: ${exerciseKey}`)
        continue
      }

      // Find exercise's day
      const exDay = await db.select<Array<{ day_id: string }>>(
        `SELECT day_id FROM exercises WHERE id = ?`,
        [exerciseId],
      )
      if (exDay.length === 0) continue

      // Find or create workout log
      const existing = await db.select<Array<{ id: string }>>(
        `SELECT id FROM workout_logs WHERE program_id = ? AND day_id = ? AND block_num = ? AND week_index = ?`,
        [programId, exDay[0].day_id, blockNum, weekIndex],
      )

      let workoutLogId: string
      if (existing.length > 0) {
        workoutLogId = existing[0].id
      } else {
        workoutLogId = uuid()
        await db.execute(
          `INSERT INTO workout_logs (id, program_id, day_id, block_num, week_index) VALUES (?, ?, ?, ?, ?)`,
          [workoutLogId, programId, exDay[0].day_id, blockNum, weekIndex],
        )
      }

      // Check for existing set log
      const existingSet = await db.select<Array<{ id: string }>>(
        `SELECT id FROM set_logs WHERE workout_log_id = ? AND exercise_id = ? AND set_index = ?`,
        [workoutLogId, exerciseId, setIndex],
      )

      if (existingSet.length === 0) {
        await db.execute(
          `INSERT INTO set_logs (id, workout_log_id, exercise_id, set_index, weight, reps, is_completed) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuid(), workoutLogId, exerciseId, setIndex, log.w || null, log.r || null, log.done ? 1 : 0],
        )
        result.setsImported++
      }
    }
  }

  // Import training maxes
  if (data.maxes) {
    const blockNum = data.blockNum ?? 1
    for (const [exerciseKey, value] of Object.entries(data.maxes)) {
      const exerciseId = exerciseKeyMap.get(exerciseKey)
      if (!exerciseId) continue

      await db.execute(
        `INSERT INTO training_maxes (id, exercise_id, value, block_num, source) VALUES (?, ?, ?, ?, 'import')`,
        [uuid(), exerciseId, value, blockNum],
      )
      result.maxesImported++
    }
  }

  // Import notes
  if (data.notes) {
    for (const [key, note] of Object.entries(data.notes)) {
      if (!note) continue
      const parts = key.split('_')
      if (parts.length < 2) continue

      const exerciseKey = parts[0]
      const exerciseId = exerciseKey === '__workout__' ? '__workout__' : exerciseKeyMap.get(exerciseKey)
      if (!exerciseId && exerciseKey !== '__workout__') continue

      // We don't have the exact workout log ID from the PWA, so create without reference
      await db.execute(
        `INSERT INTO exercise_notes (id, exercise_id, workout_log_id, note) VALUES (?, ?, NULL, ?)`,
        [uuid(), exerciseId ?? '__workout__', note],
      )
      result.notesImported++
    }
  }

  // Update program state
  if (data.currentWeek !== undefined) {
    await db.execute(`UPDATE programs SET current_week = ? WHERE id = ?`, [data.currentWeek, programId])
  }
  if (data.blockNum !== undefined) {
    await db.execute(`UPDATE programs SET block_num = ? WHERE id = ?`, [data.blockNum, programId])
  }

  return result
}
