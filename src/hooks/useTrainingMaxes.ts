import { useEffect, useState, useCallback } from 'react'
import { getDb } from '../lib/db'
import type { ExerciseWithWave } from '../types/program'

/** Map of exerciseId → current effective training max */
type TrainingMaxMap = Record<string, number>

export function useTrainingMaxes(exercises: ExerciseWithWave[]) {
  const [maxes, setMaxes] = useState<TrainingMaxMap>({})

  const load = useCallback(async () => {
    const db = await getDb()
    const waveExercises = exercises.filter((e) => e.isWave)
    if (waveExercises.length === 0) return

    const result: TrainingMaxMap = {}
    for (const ex of waveExercises) {
      // Get the latest training max entry
      const rows = await db.select<Array<{ value: number }>>(
        `SELECT value FROM training_maxes WHERE exercise_id = ? ORDER BY created_at DESC LIMIT 1`,
        [ex.id],
      )
      if (rows.length > 0) {
        result[ex.id] = rows[0].value
      } else if (ex.waveConfig) {
        result[ex.id] = ex.waveConfig.baseMax
      }
    }
    setMaxes(result)
  }, [exercises])

  useEffect(() => {
    load()
  }, [load])

  const getEffectiveMax = useCallback(
    (exerciseId: string): number => {
      return maxes[exerciseId] ?? 0
    },
    [maxes],
  )

  return { maxes, getEffectiveMax, reload: load }
}
