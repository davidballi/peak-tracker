import { useEffect, useState, useCallback, useRef } from 'react'
import { v4 as uuid } from 'uuid'
import { getDb } from '../lib/db'
import { validateWeight, validateReps } from '../lib/calc'

interface SetLogRow {
  id: string
  exercise_id: string
  set_index: number
  weight: number | null
  reps: number | null
  is_completed: number
}

export interface SetLogState {
  id: string
  exerciseId: string
  setIndex: number
  weight: number | null
  reps: number | null
  isCompleted: boolean
}

export function useWorkoutLog(
  programId: string,
  dayId: string,
  blockNum: number,
  weekIndex: number,
) {
  const [workoutLogId, setWorkoutLogId] = useState<string | null>(null)
  const [setLogs, setSetLogs] = useState<Record<string, SetLogState>>({})
  const setLogsRef = useRef(setLogs)
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Create or find the workout log for this day/block/week combo
  useEffect(() => {
    async function initLog() {
      const db = await getDb()

      // Check for existing workout log
      const existing = await db.select<Array<{ id: string }>>(
        `SELECT id FROM workout_logs WHERE program_id = ? AND day_id = ? AND block_num = ? AND week_index = ?`,
        [programId, dayId, blockNum, weekIndex],
      )

      let logId: string
      if (existing.length > 0) {
        logId = existing[0].id
      } else {
        logId = uuid()
        await db.execute(
          `INSERT INTO workout_logs (id, program_id, day_id, block_num, week_index) VALUES (?, ?, ?, ?, ?)`,
          [logId, programId, dayId, blockNum, weekIndex],
        )
      }
      setWorkoutLogId(logId)

      // Load existing set logs
      const rows = await db.select<SetLogRow[]>(
        `SELECT id, exercise_id, set_index, weight, reps, is_completed FROM set_logs WHERE workout_log_id = ?`,
        [logId],
      )

      const logs: Record<string, SetLogState> = {}
      for (const r of rows) {
        const key = `${r.exercise_id}_${r.set_index}`
        logs[key] = {
          id: r.id,
          exerciseId: r.exercise_id,
          setIndex: r.set_index,
          weight: r.weight,
          reps: r.reps,
          isCompleted: !!r.is_completed,
        }
      }
      setSetLogs(logs)
      setLogsRef.current = logs
    }
    initLog()

    return () => {
      // Clear all debounce timers on unmount
      Object.values(debounceTimers.current).forEach(clearTimeout)
    }
  }, [programId, dayId, blockNum, weekIndex])

  const getSetLog = useCallback(
    (exerciseId: string, setIndex: number): SetLogState | undefined => {
      return setLogs[`${exerciseId}_${setIndex}`]
    },
    [setLogs],
  )

  const upsertSetLog = useCallback(
    async (exerciseId: string, setIndex: number, field: 'weight' | 'reps', value: string) => {
      if (!workoutLogId) return

      const ALLOWED_FIELDS = new Set(['weight', 'reps'])
      if (!ALLOWED_FIELDS.has(field)) {
        throw new Error(`Invalid field: ${field}`)
      }

      const key = `${exerciseId}_${setIndex}`
      const raw = value === '' ? null : parseFloat(value)
      const numVal = field === 'weight' ? validateWeight(raw) : validateReps(raw)

      // Optimistic update
      setSetLogs((prev) => {
        const existing = prev[key]
        const updated = existing
          ? { ...prev, [key]: { ...existing, [field]: numVal } }
          : {
              ...prev,
              [key]: {
                id: uuid(),
                exerciseId,
                setIndex,
                weight: field === 'weight' ? numVal : null,
                reps: field === 'reps' ? (numVal !== null ? Math.round(numVal) : null) : null,
                isCompleted: false,
              },
            }
        setLogsRef.current = updated
        return updated
      })

      // Debounced DB write
      const timerKey = `${key}_${field}`
      if (debounceTimers.current[timerKey]) {
        clearTimeout(debounceTimers.current[timerKey])
      }

      debounceTimers.current[timerKey] = setTimeout(async () => {
        const db = await getDb()
        const current = setLogsRef.current[key]

        if (current) {
          // Update existing
          const sql = field === 'weight'
            ? `UPDATE set_logs SET weight = ? WHERE id = ?`
            : `UPDATE set_logs SET reps = ? WHERE id = ?`
          await db.execute(sql, [numVal, current.id])
        } else {
          // Insert new
          const newId = uuid()
          const w = field === 'weight' ? numVal : null
          const r = field === 'reps' ? (numVal !== null ? Math.round(numVal) : null) : null
          await db.execute(
            `INSERT INTO set_logs (id, workout_log_id, exercise_id, set_index, weight, reps, is_completed) VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [newId, workoutLogId, exerciseId, setIndex, w, r],
          )
          // Update the ID in state
          setSetLogs((prev) => {
            const entry = prev[key]
            if (entry && entry.id !== newId) {
              const updated = { ...prev, [key]: { ...entry, id: newId } }
              setLogsRef.current = updated
              return updated
            }
            return prev
          })
        }
      }, 300)
    },
    [workoutLogId],
  )

  const toggleComplete = useCallback(
    async (exerciseId: string, setIndex: number) => {
      if (!workoutLogId) return
      const key = `${exerciseId}_${setIndex}`
      const existing = setLogs[key]

      if (existing) {
        const newVal = !existing.isCompleted
        setSetLogs((prev) => ({
          ...prev,
          [key]: { ...existing, isCompleted: newVal },
        }))
        const db = await getDb()
        await db.execute(`UPDATE set_logs SET is_completed = ? WHERE id = ?`, [newVal ? 1 : 0, existing.id])
      } else {
        // Create a new set log marked as complete
        const newId = uuid()
        const newLog: SetLogState = {
          id: newId,
          exerciseId,
          setIndex,
          weight: null,
          reps: null,
          isCompleted: true,
        }
        setSetLogs((prev) => ({ ...prev, [key]: newLog }))
        const db = await getDb()
        await db.execute(
          `INSERT INTO set_logs (id, workout_log_id, exercise_id, set_index, weight, reps, is_completed) VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [newId, workoutLogId, exerciseId, setIndex, null, null],
        )
      }
    },
    [workoutLogId, setLogs],
  )

  const clearSet = useCallback(
    async (exerciseId: string, setIndex: number) => {
      const key = `${exerciseId}_${setIndex}`
      const existing = setLogs[key]
      if (!existing) return

      setSetLogs((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })

      const db = await getDb()
      await db.execute(`DELETE FROM set_logs WHERE id = ?`, [existing.id])
    },
    [setLogs],
  )

  const getCompletionPercentage = useCallback(
    (exercises: Array<{ id: string; totalSets: number }>) => {
      let total = 0
      let done = 0
      for (const ex of exercises) {
        total += ex.totalSets
        for (let i = 0; i < ex.totalSets; i++) {
          const log = setLogs[`${ex.id}_${i}`]
          if (log?.isCompleted) done++
        }
      }
      return total > 0 ? Math.round((done / total) * 100) : 0
    },
    [setLogs],
  )

  return {
    workoutLogId,
    setLogs,
    getSetLog,
    upsertSetLog,
    toggleComplete,
    clearSet,
    getCompletionPercentage,
  }
}
