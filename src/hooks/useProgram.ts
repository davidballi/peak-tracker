import { useEffect, useState, useCallback } from 'react'
import { getDb, withWriteLock } from '../lib/db'
import type { DayWithExercises, ExerciseWithWave, WaveConfig, WaveWarmup, WaveWeek, WaveWeekSet } from '../types/program'

interface ProgramData {
  id: string
  name: string
  blockNum: number
  currentWeek: number
  currentDay: number
  days: DayWithExercises[]
}

interface ProgramRow {
  id: string
  name: string
  block_num: number
  current_week: number
  current_day: number
}

interface DayRow {
  id: string
  program_id: string
  day_index: number
  name: string
  subtitle: string
  focus: string
}

interface ExerciseRow {
  id: string
  day_id: string
  exercise_index: number
  exercise_key: string
  name: string
  category: string
  sets: number
  reps: number
  default_weight: number
  note: string
  is_wave: number
}

interface WaveConfigRow {
  id: string
  exercise_id: string
  base_max: number
}

interface WaveWarmupRow {
  id: string
  wave_config_id: string
  set_index: number
  reps: number
  percentage: number
}

interface WaveWeekRow {
  id: string
  wave_config_id: string
  week_index: number
  label: string
}

interface WaveWeekSetRow {
  id: string
  wave_week_id: string
  set_index: number
  reps: number
  percentage: number
  is_backoff: number
}

export function useProgram(programId: string) {
  const [program, setProgram] = useState<ProgramData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const db = await getDb()

    const programs = await db.select<ProgramRow[]>(
      `SELECT id, name, block_num, current_week, current_day FROM programs WHERE id = ?`,
      [programId],
    )
    if (programs.length === 0) return

    const p = programs[0]

    // Load days
    const dayRows = await db.select<DayRow[]>(
      `SELECT id, program_id, day_index, name, subtitle, focus FROM days WHERE program_id = ? ORDER BY day_index`,
      [programId],
    )

    const days: DayWithExercises[] = []
    for (const d of dayRows) {
      // Load exercises for this day
      const exRows = await db.select<ExerciseRow[]>(
        `SELECT id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave FROM exercises WHERE day_id = ? ORDER BY exercise_index`,
        [d.id],
      )

      const exercises: ExerciseWithWave[] = []
      for (const ex of exRows) {
        const exercise: ExerciseWithWave = {
          id: ex.id,
          dayId: ex.day_id,
          exerciseIndex: ex.exercise_index,
          exerciseKey: ex.exercise_key,
          name: ex.name,
          category: ex.category as ExerciseWithWave['category'],
          sets: ex.sets,
          reps: ex.reps,
          defaultWeight: ex.default_weight,
          note: ex.note,
          isWave: !!ex.is_wave,
        }

        if (exercise.isWave) {
          // Load wave config
          const wcRows = await db.select<WaveConfigRow[]>(
            `SELECT id, exercise_id, base_max FROM wave_configs WHERE exercise_id = ?`,
            [exercise.id],
          )
          if (wcRows.length > 0) {
            const wc = wcRows[0]
            exercise.waveConfig = {
              id: wc.id,
              exerciseId: wc.exercise_id,
              baseMax: wc.base_max,
            } satisfies WaveConfig

            // Load warmups
            const warmupRows = await db.select<WaveWarmupRow[]>(
              `SELECT id, wave_config_id, set_index, reps, percentage FROM wave_warmups WHERE wave_config_id = ? ORDER BY set_index`,
              [exercise.waveConfig.id],
            )
            exercise.warmups = warmupRows.map((w) => ({
              id: w.id,
              waveConfigId: w.wave_config_id,
              setIndex: w.set_index,
              reps: w.reps,
              percentage: w.percentage,
            } satisfies WaveWarmup))

            // Load weeks
            const weekRows = await db.select<WaveWeekRow[]>(
              `SELECT id, wave_config_id, week_index, label FROM wave_weeks WHERE wave_config_id = ? ORDER BY week_index`,
              [exercise.waveConfig.id],
            )
            exercise.weeks = weekRows.map((w) => ({
              id: w.id,
              waveConfigId: w.wave_config_id,
              weekIndex: w.week_index,
              label: w.label,
            } satisfies WaveWeek))

            // Load week sets grouped by week
            exercise.weekSets = {}
            for (const week of exercise.weeks) {
              const setRows = await db.select<WaveWeekSetRow[]>(
                `SELECT id, wave_week_id, set_index, reps, percentage, is_backoff FROM wave_week_sets WHERE wave_week_id = ? ORDER BY set_index`,
                [week.id],
              )
              exercise.weekSets[week.id] = setRows.map((s) => ({
                id: s.id,
                waveWeekId: s.wave_week_id,
                setIndex: s.set_index,
                reps: s.reps,
                percentage: s.percentage,
                isBackoff: !!s.is_backoff,
              } satisfies WaveWeekSet))
            }
          }
        }

        exercises.push(exercise)
      }

      days.push({
        id: d.id,
        programId: d.program_id,
        dayIndex: d.day_index,
        name: d.name,
        subtitle: d.subtitle,
        focus: d.focus,
        exercises,
      })
    }

    setProgram({
      id: p.id,
      name: p.name,
      blockNum: p.block_num,
      currentWeek: p.current_week,
      currentDay: p.current_day,
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

  const deleteExercise = useCallback(async (exerciseId: string, dayId: string) => {
    const db = await getDb()
    await withWriteLock(async () => {
      await db.execute(`DELETE FROM exercises WHERE id = ?`, [exerciseId])
      const remaining = await db.select<Array<{ id: string }>>(
        `SELECT id FROM exercises WHERE day_id = ? ORDER BY exercise_index`,
        [dayId],
      )
      for (let i = 0; i < remaining.length; i++) {
        await db.execute(`UPDATE exercises SET exercise_index = ? WHERE id = ?`, [i, remaining[i].id])
      }
    })
    await load()
  }, [load])

  return { program, loading, reload: load, setCurrentDay, setCurrentWeek, deleteExercise }
}
