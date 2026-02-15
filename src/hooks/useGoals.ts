import { useState, useEffect, useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import { getDb } from '../lib/db'
import { estimatedOneRepMax } from '../lib/calc'
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
  goal_type: string
  target_value: number
  deadline: string | null
  achieved_at: string | null
  created_at: string
}

interface ExNameRow {
  name: string
}

interface E1rmRow {
  weight: number
  reps: number
}

interface MaxRow {
  max_weight: number
}

export function useGoals(programId: string) {
  const [goals, setGoals] = useState<GoalWithProgress[]>([])
  const [loading, setLoading] = useState(true)

  const loadGoals = useCallback(async () => {
    const db = await getDb()

    const rows = await db.select<GoalRow[]>(
      `SELECT sg.id, sg.exercise_id, sg.goal_type, sg.target_value, sg.deadline, sg.achieved_at, sg.created_at
       FROM strength_goals sg
       JOIN exercises e ON sg.exercise_id = e.id
       JOIN days d ON e.day_id = d.id
       WHERE d.program_id = ?
       ORDER BY sg.created_at DESC`,
      [programId],
    )

    const enriched: GoalWithProgress[] = []
    for (const row of rows) {
      // Get exercise name
      const nameRows = await db.select<ExNameRow[]>(
        `SELECT name FROM exercises WHERE id = ?`,
        [row.exercise_id],
      )
      const exerciseName = nameRows.length > 0 ? nameRows[0].name : 'Unknown'

      // Compute current value based on goal type
      let currentValue = 0
      if (row.goal_type === 'e1rm') {
        const e1rmRows = await db.select<E1rmRow[]>(
          `SELECT sl.weight, sl.reps FROM set_logs sl
           JOIN workout_logs wl ON sl.workout_log_id = wl.id
           WHERE sl.exercise_id = ? AND wl.program_id = ?
             AND sl.weight IS NOT NULL AND sl.weight > 0
             AND sl.reps IS NOT NULL AND sl.reps > 0`,
          [row.exercise_id, programId],
        )
        for (const r of e1rmRows) {
          const e1rm = estimatedOneRepMax(r.weight, r.reps)
          if (e1rm > currentValue) currentValue = e1rm
        }
      } else if (row.goal_type === 'weight') {
        const maxRows = await db.select<MaxRow[]>(
          `SELECT MAX(sl.weight) as max_weight FROM set_logs sl
           JOIN workout_logs wl ON sl.workout_log_id = wl.id
           WHERE sl.exercise_id = ? AND wl.program_id = ?
             AND sl.weight IS NOT NULL AND sl.weight > 0`,
          [row.exercise_id, programId],
        )
        if (maxRows.length > 0 && maxRows[0].max_weight) currentValue = maxRows[0].max_weight
      } else if (row.goal_type === 'reps') {
        const maxRows = await db.select<Array<{ max_reps: number }>>(
          `SELECT MAX(sl.reps) as max_reps FROM set_logs sl
           JOIN workout_logs wl ON sl.workout_log_id = wl.id
           WHERE sl.exercise_id = ? AND wl.program_id = ?
             AND sl.reps IS NOT NULL AND sl.reps > 0`,
          [row.exercise_id, programId],
        )
        if (maxRows.length > 0 && maxRows[0].max_reps) currentValue = maxRows[0].max_reps
      }

      const progress = row.target_value > 0 ? Math.min(100, Math.round((currentValue / row.target_value) * 100)) : 0

      enriched.push({
        id: row.id,
        exerciseId: row.exercise_id,
        exerciseName,
        goalType: row.goal_type as GoalType,
        targetValue: row.target_value,
        currentValue,
        progress,
        deadline: row.deadline,
        achievedAt: row.achieved_at,
        createdAt: row.created_at,
      })
    }

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
