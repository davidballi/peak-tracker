import { v4 as uuid } from 'uuid'
import { getDb, withWriteLock } from './db'
import { estimatedOneRepMax, roundToNearest5 } from './calc'

const MAX_TM_INCREASE_RATIO = 1.2

export interface WaveExerciseRef {
  id: string
}

/**
 * Advance to the next block: auto-calculate new TMs from this cycle's
 * Week 3 logs (capped at +20%), then bump the program pointer.
 */
export async function advanceBlock(
  programId: string,
  blockNum: number,
  cycle: number,
  waveExercises: WaveExerciseRef[],
  getEffectiveMax: (exerciseId: string) => number,
): Promise<void> {
  const db = await getDb()
  await withWriteLock(async () => {
    for (const ex of waveExercises) {
      const currentMax = getEffectiveMax(ex.id)
      let bestE1rm = currentMax

      const rows = await db.select<Array<{ weight: number; reps: number }>>(
        `SELECT sl.weight, sl.reps FROM set_logs sl
         JOIN workout_logs wl ON sl.workout_log_id = wl.id
         WHERE wl.program_id = ? AND sl.exercise_id = ? AND wl.block_num = ? AND wl.cycle = ?
           AND wl.week_index = 2
           AND sl.weight IS NOT NULL AND sl.reps IS NOT NULL AND sl.weight > 0 AND sl.reps > 0
           AND sl.is_completed = 1`,
        [programId, ex.id, blockNum, cycle],
      )

      for (const r of rows) {
        const e1rm = estimatedOneRepMax(r.weight, r.reps)
        if (e1rm > bestE1rm) bestE1rm = e1rm
      }

      const newTm = bestE1rm > currentMax
        ? roundToNearest5(Math.min(bestE1rm, currentMax * MAX_TM_INCREASE_RATIO))
        : roundToNearest5(currentMax + 5)

      await db.execute(
        `INSERT INTO training_maxes (id, exercise_id, value, block_num, source) VALUES (?, ?, ?, ?, 'auto')`,
        [uuid(), ex.id, newTm, blockNum + 1],
      )
    }

    await db.execute(
      `UPDATE programs SET block_num = block_num + 1, current_week = 0, current_day = 0 WHERE id = ?`,
      [programId],
    )
  })
}

/**
 * Step back one block. Restores the target block's TMs by appending new
 * rows (training_maxes is append-only) and increments the program's cycle
 * so the re-run gets fresh workout logs instead of resuming old ones.
 */
export async function rollbackBlock(
  programId: string,
  blockNum: number,
  waveExercises: WaveExerciseRef[],
  getEffectiveMax: (exerciseId: string) => number,
): Promise<void> {
  if (blockNum <= 1) return
  const target = blockNum - 1
  const db = await getDb()
  await withWriteLock(async () => {
    for (const ex of waveExercises) {
      const rows = await db.select<Array<{ value: number }>>(
        `SELECT value FROM training_maxes
         WHERE exercise_id = ? AND block_num <= ?
         ORDER BY block_num DESC, created_at DESC LIMIT 1`,
        [ex.id, target],
      )
      if (rows.length === 0) continue
      if (rows[0].value === getEffectiveMax(ex.id)) continue

      await db.execute(
        `INSERT INTO training_maxes (id, exercise_id, value, block_num, source) VALUES (?, ?, ?, ?, 'rollback')`,
        [uuid(), ex.id, rows[0].value, target],
      )
    }

    await db.execute(
      `UPDATE programs SET block_num = block_num - 1, current_week = 0, current_day = 0, cycle = cycle + 1 WHERE id = ?`,
      [programId],
    )
  })
}
