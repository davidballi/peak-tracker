import { v4 as uuid } from 'uuid'
import { getDb } from './db'
import { MAX_WEIGHT, MAX_REPS } from './calc'

/**
 * Import data from the original Peak Tracker PWA's localStorage format.
 * The PWA stores data under the key 'peak-tracker-v2' as a JSON object with:
 * - logs: Record<string, { w: number, r: number, done: boolean }> keyed by "exerciseId_setIndex_blockNum_weekIndex"
 * - notes: Record<string, string> keyed by "exerciseId_workoutLogId" or "__workout___workoutLogId"
 * - maxes: Record<string, number> keyed by exerciseId
 * - currentWeek: number
 * - blockNum: number
 */

const MAX_JSON_SIZE = 5 * 1024 * 1024 // 5 MB
const MAX_LOG_RECORDS = 10_000
const MAX_NOTE_RECORDS = 5_000
const MAX_NOTE_LENGTH = 2000

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

function isValidNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

export async function importFromPwa(jsonString: string, programId: string): Promise<ImportResult> {
  const result: ImportResult = { setsImported: 0, notesImported: 0, maxesImported: 0, errors: [] }

  // Size check
  if (jsonString.length > MAX_JSON_SIZE) {
    result.errors.push(`Import data too large (${(jsonString.length / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`)
    return result
  }

  const db = await getDb()

  let data: PwaData
  try {
    data = JSON.parse(jsonString) as PwaData
  } catch {
    result.errors.push('Invalid JSON format')
    return result
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    result.errors.push('Invalid data format: expected an object')
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

  try {
    // Import set logs
    if (data.logs && typeof data.logs === 'object') {
      const entries = Object.entries(data.logs)
      if (entries.length > MAX_LOG_RECORDS) {
        result.errors.push(`Too many log records (${entries.length}). Maximum is ${MAX_LOG_RECORDS}.`)
      } else {
        for (const [key, log] of entries) {
          // Validate log shape
          if (!log || typeof log !== 'object') {
            result.errors.push(`Invalid log entry: ${key}`)
            continue
          }
          if (!isValidNumber(log.w) && log.w !== undefined && log.w !== null) {
            result.errors.push(`Invalid weight in log: ${key}`)
            continue
          }
          if (!isValidNumber(log.r) && log.r !== undefined && log.r !== null) {
            result.errors.push(`Invalid reps in log: ${key}`)
            continue
          }

          // Clamp values
          const weight = isValidNumber(log.w) && log.w > 0 ? Math.min(log.w, MAX_WEIGHT) : null
          const reps = isValidNumber(log.r) && log.r > 0 ? Math.min(Math.round(log.r), MAX_REPS) : null

          const parts = key.split('_')
          if (parts.length < 4) continue

          const exerciseKey = parts.slice(0, parts.length - 3).join('_')
          const setIndex = parseInt(parts[parts.length - 3])
          const blockNum = parseInt(parts[parts.length - 2])
          const weekIndex = parseInt(parts[parts.length - 1])

          if (!Number.isFinite(setIndex) || !Number.isFinite(blockNum) || !Number.isFinite(weekIndex)) continue

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
              [uuid(), workoutLogId, exerciseId, setIndex, weight, reps, log.done ? 1 : 0],
            )
            result.setsImported++
          }
        }
      }
    }

    // Import training maxes
    if (data.maxes && typeof data.maxes === 'object') {
      const blockNum = isValidNumber(data.blockNum) && data.blockNum > 0 ? data.blockNum : 1
      for (const [exerciseKey, value] of Object.entries(data.maxes)) {
        if (!isValidNumber(value) || value <= 0 || value > MAX_WEIGHT) {
          result.errors.push(`Invalid max value for ${exerciseKey}: ${value}`)
          continue
        }

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
    if (data.notes && typeof data.notes === 'object') {
      const entries = Object.entries(data.notes)
      if (entries.length > MAX_NOTE_RECORDS) {
        result.errors.push(`Too many note records (${entries.length}). Maximum is ${MAX_NOTE_RECORDS}.`)
      } else {
        for (const [key, note] of entries) {
          if (!note || typeof note !== 'string') continue
          const trimmed = note.slice(0, MAX_NOTE_LENGTH)
          const parts = key.split('_')
          if (parts.length < 2) continue

          const exerciseKey = parts[0]
          const exerciseId = exerciseKey === '__workout__' ? '__workout__' : exerciseKeyMap.get(exerciseKey)
          if (!exerciseId && exerciseKey !== '__workout__') continue

          await db.execute(
            `INSERT INTO exercise_notes (id, exercise_id, workout_log_id, note) VALUES (?, ?, NULL, ?)`,
            [uuid(), exerciseId ?? '__workout__', trimmed],
          )
          result.notesImported++
        }
      }
    }

  } catch (err) {
    result.errors.push(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  return result
}
