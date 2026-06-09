import { useState, useEffect, useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import { getDb } from '../lib/db'
import { computeGoalCurrentValue, type GoalSetRow } from '../lib/goal-progress'
import { hapticMedium } from '../lib/haptics'
import type { GoalType } from '../types/goal'

export interface GoalWithProgress {
  id: string
  exerciseId: string
  exerciseName: string
  goalType: GoalType
  targetValue: number
  currentValue: number
  progress: number // 0-100
  deadline: string | null
  achievedAt: string | null
  createdAt: string
}

interface GoalRow {
  id: string
  exercise_id: string
  exercise_name: string
  goal_type: string
  target_value: number
  deadline: string | null
  achieved_at: string | null
  created_at: string
}

export function useGoals(programId: string) {
  const [goals, setGoals] = useState<GoalWithProgress[]>([])
  const [loading, setLoading] = useState(true)

  const loadGoals = useCallback(async () => {
    const db = await getDb()

    const rows = await db.select<GoalRow[]>(
      `SELECT sg.id, sg.exercise_id, e.name AS exercise_name, sg.goal_type, sg.target_value, sg.deadline, sg.achieved_at, sg.created_at
       FROM strength_goals sg
       JOIN exercises e ON sg.exercise_id = e.id
       JOIN days d ON e.day_id = d.id
       WHERE d.program_id = ?
       ORDER BY sg.created_at DESC`,
      [programId],
    )

    // One set_logs fetch for all goal exercises instead of 3 queries per goal
    // (each db call is a Tauri IPC round-trip)
    const setsByExercise = new Map<string, GoalSetRow[]>()
    const exerciseIds = [...new Set(rows.map((r) => r.exercise_id))]
    if (exerciseIds.length > 0) {
      // placeholders are generated, values stay parameterized
      const placeholders = exerciseIds.map(() => '?').join(',')
      const setRows = await db.select<Array<{ exercise_id: string; weight: number | null; reps: number | null }>>(
        `SELECT sl.exercise_id, sl.weight, sl.reps
         FROM set_logs sl
         JOIN workout_logs wl ON sl.workout_log_id = wl.id
         WHERE wl.program_id = ? AND sl.exercise_id IN (${placeholders})`,
        [programId, ...exerciseIds],
      )
      for (const r of setRows) {
        const list = setsByExercise.get(r.exercise_id) ?? []
        list.push({ weight: r.weight, reps: r.reps })
        setsByExercise.set(r.exercise_id, list)
      }
    }

    const enriched: GoalWithProgress[] = rows.map((row) => {
      const goalType = row.goal_type as GoalType
      const currentValue = computeGoalCurrentValue(goalType, setsByExercise.get(row.exercise_id) ?? [])
      const progress = row.target_value > 0 ? Math.min(100, Math.round((currentValue / row.target_value) * 100)) : 0

      return {
        id: row.id,
        exerciseId: row.exercise_id,
        exerciseName: row.exercise_name,
        goalType,
        targetValue: row.target_value,
        currentValue,
        progress,
        deadline: row.deadline,
        achievedAt: row.achieved_at,
        createdAt: row.created_at,
      }
    })

    setGoals(enriched)
    setLoading(false)
  }, [programId])

  useEffect(() => {
    loadGoals()
  }, [loadGoals])

  const createGoal = useCallback(
    async (exerciseId: string, goalType: GoalType, targetValue: number, deadline: string | null) => {
      const db = await getDb()
      const id = uuid()
      await db.execute(
        `INSERT INTO strength_goals (id, exercise_id, goal_type, target_value, deadline) VALUES (?, ?, ?, ?, ?)`,
        [id, exerciseId, goalType, targetValue, deadline],
      )
      await loadGoals()
      return id
    },
    [loadGoals],
  )

  const updateGoal = useCallback(
    async (goalId: string, updates: { targetValue?: number; deadline?: string | null }) => {
      const db = await getDb()
      if (updates.targetValue !== undefined) {
        await db.execute(`UPDATE strength_goals SET target_value = ? WHERE id = ?`, [updates.targetValue, goalId])
      }
      if (updates.deadline !== undefined) {
        await db.execute(`UPDATE strength_goals SET deadline = ? WHERE id = ?`, [updates.deadline, goalId])
      }
      await loadGoals()
    },
    [loadGoals],
  )

  const deleteGoal = useCallback(
    async (goalId: string) => {
      const db = await getDb()
      await db.execute(`DELETE FROM strength_goals WHERE id = ?`, [goalId])
      setGoals((prev) => prev.filter((g) => g.id !== goalId))
    },
    [],
  )

  const checkAchievements = useCallback(async () => {
    const db = await getDb()
    const achieved: GoalWithProgress[] = []

    for (const goal of goals) {
      if (!goal.achievedAt && goal.currentValue >= goal.targetValue) {
        await db.execute(`UPDATE strength_goals SET achieved_at = datetime('now') WHERE id = ?`, [goal.id])
        achieved.push(goal)
      }
    }

    if (achieved.length > 0) {
      hapticMedium()
      await loadGoals()
    }

    return achieved
  }, [goals, loadGoals])

  return {
    goals,
    loading,
    createGoal,
    updateGoal,
    deleteGoal,
    checkAchievements,
    reload: loadGoals,
  }
}
