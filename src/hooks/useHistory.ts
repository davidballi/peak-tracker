import { useState, useCallback } from 'react'
import { getDb } from '../lib/db'
import { estimatedOneRepMax } from '../lib/calc'
import { MAIN_LIFTS } from '../lib/constants'

export interface E1rmDataPoint {
  label: string
  e1rm: number
  blockNum: number
  weekIndex: number
}

export interface VolumeDataPoint {
  label: string
  volume: number
  blockNum: number
  weekIndex: number
}

export interface SetLogEntry {
  id: string
  setIndex: number
  weight: number
  reps: number
  isCompleted: boolean
  loggedAt: string
  blockNum: number
  weekIndex: number
}

export interface LiftStats {
  currentE1rm: number
  bestE1rm: number
  change: number
  trainingMax: number
}

export interface AllLiftsData {
  liftId: string
  liftName: string
  color: string
  data: E1rmDataPoint[]
}

interface SetLogRow {
  id: string
  set_index: number
  weight: number
  reps: number
  is_completed: number
  logged_at: string
  block_num: number
  week_index: number
}

interface E1rmRow {
  block_num: number
  week_index: number
  weight: number
  reps: number
}

interface VolumeRow {
  block_num: number
  week_index: number
  volume: number
}

interface TmRow {
  value: number
}

export function useHistory(programId: string) {
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null)
  const [e1rmData, setE1rmData] = useState<E1rmDataPoint[]>([])
  const [volumeData, setVolumeData] = useState<VolumeDataPoint[]>([])
  const [setLogHistory, setSetLogHistory] = useState<SetLogEntry[]>([])
  const [stats, setStats] = useState<LiftStats | null>(null)
  const [allLiftsData, setAllLiftsData] = useState<AllLiftsData[]>([])
  const [loading, setLoading] = useState(false)

  const loadExerciseHistory = useCallback(
    async (exerciseId: string) => {
      setLoading(true)
      setSelectedExerciseId(exerciseId)
      const db = await getDb()

      // Get e1RM data per block/week
      const e1rmRows = await db.select<E1rmRow[]>(
        `SELECT wl.block_num, wl.week_index, sl.weight, sl.reps
         FROM set_logs sl
         JOIN workout_logs wl ON sl.workout_log_id = wl.id
         WHERE sl.exercise_id = ? AND wl.program_id = ?
           AND sl.weight IS NOT NULL AND sl.weight > 0
           AND sl.reps IS NOT NULL AND sl.reps > 0
         ORDER BY wl.block_num, wl.week_index, sl.set_index`,
        [exerciseId, programId],
      )

      // Group by block/week, compute best e1RM per period
      const grouped = new Map<string, { blockNum: number; weekIndex: number; bestE1rm: number }>()
      for (const r of e1rmRows) {
        const key = `${r.block_num}_${r.week_index}`
        const e1rm = estimatedOneRepMax(r.weight, r.reps)
        const existing = grouped.get(key)
        if (!existing || e1rm > existing.bestE1rm) {
          grouped.set(key, { blockNum: r.block_num, weekIndex: r.week_index, bestE1rm: e1rm })
        }
      }
      const e1rmPoints: E1rmDataPoint[] = Array.from(grouped.values()).map((g) => ({
        label: `B${g.blockNum} W${g.weekIndex + 1}`,
        e1rm: g.bestE1rm,
        blockNum: g.blockNum,
        weekIndex: g.weekIndex,
      }))
      setE1rmData(e1rmPoints)

      // Get volume per block/week
      const volumeRows = await db.select<VolumeRow[]>(
        `SELECT wl.block_num, wl.week_index, SUM(sl.weight * sl.reps) as volume
         FROM set_logs sl
         JOIN workout_logs wl ON sl.workout_log_id = wl.id
         WHERE sl.exercise_id = ? AND wl.program_id = ?
           AND sl.weight IS NOT NULL AND sl.weight > 0
           AND sl.reps IS NOT NULL AND sl.reps > 0
         GROUP BY wl.block_num, wl.week_index
         ORDER BY wl.block_num, wl.week_index`,
        [exerciseId, programId],
      )
      setVolumeData(
        volumeRows.map((r) => ({
          label: `B${r.block_num} W${r.week_index + 1}`,
          volume: Math.round(r.volume),
          blockNum: r.block_num,
          weekIndex: r.week_index,
        })),
      )

      // Get set log history
      const logRows = await db.select<SetLogRow[]>(
        `SELECT sl.id, sl.set_index, sl.weight, sl.reps, sl.is_completed, sl.logged_at,
                wl.block_num, wl.week_index
         FROM set_logs sl
         JOIN workout_logs wl ON sl.workout_log_id = wl.id
         WHERE sl.exercise_id = ? AND wl.program_id = ?
           AND sl.weight IS NOT NULL AND sl.weight > 0
         ORDER BY wl.block_num DESC, wl.week_index DESC, sl.set_index`,
        [exerciseId, programId],
      )
      setSetLogHistory(
        logRows.map((r) => ({
          id: r.id,
          setIndex: r.set_index,
          weight: r.weight,
          reps: r.reps,
          isCompleted: !!r.is_completed,
          loggedAt: r.logged_at,
          blockNum: r.block_num,
          weekIndex: r.week_index,
        })),
      )

      // Compute stats
      const bestE1rm = e1rmPoints.reduce((max, p) => Math.max(max, p.e1rm), 0)
      const currentE1rm = e1rmPoints.length > 0 ? e1rmPoints[e1rmPoints.length - 1].e1rm : 0

      // Change from previous block
      let change = 0
      if (e1rmPoints.length >= 2) {
        const currentBlockNum = e1rmPoints[e1rmPoints.length - 1].blockNum
        const prevBlockPoints = e1rmPoints.filter((p) => p.blockNum < currentBlockNum)
        if (prevBlockPoints.length > 0) {
          const prevBest = prevBlockPoints.reduce((max, p) => Math.max(max, p.e1rm), 0)
          change = currentE1rm - prevBest
        }
      }

      // Training max
      const tmRows = await db.select<TmRow[]>(
        `SELECT value FROM training_maxes WHERE exercise_id = ? ORDER BY created_at DESC LIMIT 1`,
        [exerciseId],
      )
      const trainingMax = tmRows.length > 0 ? tmRows[0].value : 0

      setStats({ currentE1rm, bestE1rm, change, trainingMax })
      setLoading(false)
    },
    [programId],
  )

  const loadAllLiftsOverlay = useCallback(async () => {
    const db = await getDb()
    const results: AllLiftsData[] = []

    for (const lift of MAIN_LIFTS) {
      // Find the exercise by name match
      const exercises = await db.select<Array<{ id: string }>>(
        `SELECT e.id FROM exercises e
         JOIN days d ON e.day_id = d.id
         WHERE d.program_id = ? AND e.name = ?
         LIMIT 1`,
        [programId, lift.name],
      )
      if (exercises.length === 0) continue

      const exerciseId = exercises[0].id
      const rows = await db.select<E1rmRow[]>(
        `SELECT wl.block_num, wl.week_index, sl.weight, sl.reps
         FROM set_logs sl
         JOIN workout_logs wl ON sl.workout_log_id = wl.id
         WHERE sl.exercise_id = ? AND wl.program_id = ?
           AND sl.weight IS NOT NULL AND sl.weight > 0
           AND sl.reps IS NOT NULL AND sl.reps > 0
         ORDER BY wl.block_num, wl.week_index`,
        [exerciseId, programId],
      )

      const grouped = new Map<string, { blockNum: number; weekIndex: number; bestE1rm: number }>()
      for (const r of rows) {
        const key = `${r.block_num}_${r.week_index}`
        const e1rm = estimatedOneRepMax(r.weight, r.reps)
        const existing = grouped.get(key)
        if (!existing || e1rm > existing.bestE1rm) {
          grouped.set(key, { blockNum: r.block_num, weekIndex: r.week_index, bestE1rm: e1rm })
        }
      }

      results.push({
        liftId: lift.id,
        liftName: lift.name,
        color: lift.color,
        data: Array.from(grouped.values()).map((g) => ({
          label: `B${g.blockNum} W${g.weekIndex + 1}`,
          e1rm: g.bestE1rm,
          blockNum: g.blockNum,
          weekIndex: g.weekIndex,
        })),
      })
    }

    setAllLiftsData(results)
  }, [programId])

  const deleteSetLog = useCallback(
    async (setLogId: string) => {
      const db = await getDb()
      await db.execute(`DELETE FROM set_logs WHERE id = ?`, [setLogId])
      setSetLogHistory((prev) => prev.filter((s) => s.id !== setLogId))
      // Reload e1rm data if we have a selected exercise
      if (selectedExerciseId) {
        await loadExerciseHistory(selectedExerciseId)
      }
    },
    [selectedExerciseId, loadExerciseHistory],
  )

  return {
    selectedExerciseId,
    e1rmData,
    volumeData,
    setLogHistory,
    stats,
    allLiftsData,
    loading,
    loadExerciseHistory,
    loadAllLiftsOverlay,
    deleteSetLog,
  }
}
