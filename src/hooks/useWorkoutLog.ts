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
  const pendingWrites = useRef<Record<string, () => Promise<void>>>({})

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
          `INSERT OR IGNORE INTO workout_logs (id, program_id, day_id, block_num, week_index) VALUES (?, ?, ?, ?, ?)`,
          [logId, programId, dayId, blockNum, weekIndex],
        )
        // Re-fetch in case INSERT OR IGNORE hit a duplicate (StrictMode double-effect race)
        const refetch = await db.select<Array<{ id: string }>>(
          `SELECT id FROM workout_logs WHERE program_id = ? AND day_id = ? AND block_num = ? AND week_index = ?`,
          [programId, dayId, blockNum, weekIndex],
        )
        if (refetch.length > 0) logId = refetch[0].id
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

    // Flush all pending debounced writes immediately (iOS app backgrounding)
    function flushPendingWrites() {
      for (const [key, timer] of Object.entries(debounceTimers.current)) {
        clearTimeout(timer)
        delete debounceTimers.current[key]
      }
      for (const [key, writeFn] of Object.entries(pendingWrites.current)) {
        writeFn()
        delete pendingWrites.current[key]
      }
    }
    window.addEventListener('pagehide', flushPendingWrites)

    return () => {
      window.removeEventListener('pagehide', flushPendingWrites)
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

      const doWrite = async () => {
        delete pendingWrites.current[timerKey]
        const db = await getDb()
        const current = setLogsRef.current[key]
        if (!current) return

        await db.execute(
          `INSERT OR REPLACE INTO set_logs (id, workout_log_id, exercise_id, set_index, weight, reps, is_completed) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [current.id, workoutLogId, exerciseId, setIndex, current.weight, current.reps !== null ? Math.round(current.reps) : null, current.isCompleted ? 1 : 0],
        )
      }

      pendingWrites.current[timerKey] = doWrite
      debounceTimers.current[timerKey] = setTimeout(doWrite, 300)
    },
    [workoutLogId],
  )

  const toggleComplete = useCallback(
    async (exerciseId: string, setIndex: number, defaultWeight?: number, defaultReps?: number) => {
      if (!workoutLogId) return
      const key = `${exerciseId}_${setIndex}`
      const existing = setLogsRef.current[key]

      if (existing) {
        const newVal = !existing.isCompleted
        setSetLogs((prev) => {
          const updated = { ...prev, [key]: { ...prev[key], isCompleted: newVal } }
          setLogsRef.current = updated
          return updated
        })
        const db = await getDb()
        const current = setLogsRef.current[key]
        await db.execute(
          `INSERT OR REPLACE INTO set_logs (id, workout_log_id, exercise_id, set_index, weight, reps, is_completed) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [current.id, workoutLogId, exerciseId, setIndex, current.weight, current.reps !== null ? Math.round(current.reps) : null, newVal ? 1 : 0],
        )
      } else {
        // Create a new set log marked as complete, preserving default values
        const w = defaultWeight ?? null
        const r = defaultReps ?? null
        const newId = uuid()
        const newLog: SetLogState = {
          id: newId,
          exerciseId,
          setIndex,
          weight: w,
          reps: r,
          isCompleted: true,
        }
        setSetLogs((prev) => {
          const updated = { ...prev, [key]: newLog }
          setLogsRef.current = updated
          return updated
        })
        const db = await getDb()
        await db.execute(
          `INSERT OR REPLACE INTO set_logs (id, workout_log_id, exercise_id, set_index, weight, reps, is_completed) VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [newId, workoutLogId, exerciseId, setIndex, w, r],
        )
      }
    },
    [workoutLogId],
  )

  const clearSet = useCallback(
    async (exerciseId: string, setIndex: number) => {
      const key = `${exerciseId}_${setIndex}`
      const existing = setLogsRef.current[key]
      if (!existing) return

      setSetLogs((prev) => {
        const next = { ...prev }
        delete next[key]
        setLogsRef.current = next
        return next
      })

      const db = await getDb()
      await db.execute(`DELETE FROM set_logs WHERE id = ?`, [existing.id])
    },
    [],
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
