import { useEffect, useState, useCallback } from 'react'
import { getDb } from '../lib/db'
import type { DayWithExercises, ExerciseWithWave, WaveConfig, WaveWarmup, WaveWeek, WaveWeekSet } from '../types/program'

interface ProgramData {
  id: string
  name: string
  blockNum: number
  currentWeek: number
  currentDay: number
  days: DayWithExercises[]
}

interface DbRow {
  [key: string]: unknown
}

export function useProgram(programId: string) {
  const [program, setProgram] = useState<ProgramData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const db = await getDb()

    const programs = await db.select<DbRow[]>(
      `SELECT id, name, block_num, current_week, current_day FROM programs WHERE id = ?`,
      [programId],
    )
    if (programs.length === 0) return

    const p = programs[0]

    // Load days
    const dayRows = await db.select<DbRow[]>(
      `SELECT id, program_id, day_index, name, subtitle, focus FROM days WHERE program_id = ? ORDER BY day_index`,
      [programId],
    )

    const days: DayWithExercises[] = []
    for (const d of dayRows) {
      // Load exercises for this day
      const exRows = await db.select<DbRow[]>(
        `SELECT id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave FROM exercises WHERE day_id = ? ORDER BY exercise_index`,
        [d.id as string],
      )

      const exercises: ExerciseWithWave[] = []
      for (const ex of exRows) {
        const exercise: ExerciseWithWave = {
          id: ex.id as string,
          dayId: ex.day_id as string,
          exerciseIndex: ex.exercise_index as number,
          exerciseKey: ex.exercise_key as string,
          name: ex.name as string,
          category: ex.category as ExerciseWithWave['category'],
          sets: ex.sets as number,
          reps: ex.reps as number,
          defaultWeight: ex.default_weight as number,
          note: ex.note as string,
          isWave: !!(ex.is_wave as number),
        }

        if (exercise.isWave) {
          // Load wave config
          const wcRows = await db.select<DbRow[]>(
            `SELECT id, exercise_id, base_max FROM wave_configs WHERE exercise_id = ?`,
            [exercise.id],
          )
          if (wcRows.length > 0) {
            const wc = wcRows[0]
            exercise.waveConfig = {
              id: wc.id as string,
              exerciseId: wc.exercise_id as string,
              baseMax: wc.base_max as number,
            } satisfies WaveConfig

            // Load warmups
            const warmupRows = await db.select<DbRow[]>(
              `SELECT id, wave_config_id, set_index, reps, percentage FROM wave_warmups WHERE wave_config_id = ? ORDER BY set_index`,
              [exercise.waveConfig.id],
            )
            exercise.warmups = warmupRows.map((w) => ({
              id: w.id as string,
              waveConfigId: w.wave_config_id as string,
              setIndex: w.set_index as number,
              reps: w.reps as number,
              percentage: w.percentage as number,
            } satisfies WaveWarmup))

            // Load weeks
            const weekRows = await db.select<DbRow[]>(
              `SELECT id, wave_config_id, week_index, label FROM wave_weeks WHERE wave_config_id = ? ORDER BY week_index`,
              [exercise.waveConfig.id],
            )
            exercise.weeks = weekRows.map((w) => ({
              id: w.id as string,
              waveConfigId: w.wave_config_id as string,
              weekIndex: w.week_index as number,
              label: w.label as string,
            } satisfies WaveWeek))

            // Load week sets grouped by week
            exercise.weekSets = {}
            for (const week of exercise.weeks) {
              const setRows = await db.select<DbRow[]>(
                `SELECT id, wave_week_id, set_index, reps, percentage, is_backoff FROM wave_week_sets WHERE wave_week_id = ? ORDER BY set_index`,
                [week.id],
              )
              exercise.weekSets[week.id] = setRows.map((s) => ({
                id: s.id as string,
                waveWeekId: s.wave_week_id as string,
                setIndex: s.set_index as number,
                reps: s.reps as number,
                percentage: s.percentage as number,
                isBackoff: !!(s.is_backoff as number),
              } satisfies WaveWeekSet))
            }
          }
        }

        exercises.push(exercise)
      }

      days.push({
        id: d.id as string,
        programId: d.program_id as string,
        dayIndex: d.day_index as number,
        name: d.name as string,
        subtitle: d.subtitle as string,
        focus: d.focus as string,
        exercises,
      })
    }

    setProgram({
      id: p.id as string,
      name: p.name as string,
      blockNum: p.block_num as number,
      currentWeek: p.current_week as number,
      currentDay: p.current_day as number,
      days,
    })
    setLoading(false)
  }, [programId])

  useEffect(() => {
    load()
  }, [load])

  const setCurrentDay = useCallback(async (dayIndex: number) => {
    const db = await getDb()
    await db.execute(`UPDATE programs SET current_day = ? WHERE id = ?`, [dayIndex, programId])
    setProgram((prev) => prev ? { ...prev, currentDay: dayIndex } : prev)
  }, [programId])

  const setCurrentWeek = useCallback(async (weekIndex: number) => {
    const db = await getDb()
    await db.execute(`UPDATE programs SET current_week = ? WHERE id = ?`, [weekIndex, programId])
    setProgram((prev) => prev ? { ...prev, currentWeek: weekIndex } : prev)
  }, [programId])

  return { program, loading, reload: load, setCurrentDay, setCurrentWeek }
}
