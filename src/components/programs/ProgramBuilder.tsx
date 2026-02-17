import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { v4 as uuid } from 'uuid'
import { getDb } from '../../lib/db'
import { CATEGORY_CONFIG } from '../../lib/constants'
import { ExerciseEditor, type ExerciseFormData } from './ExerciseEditor'
import { ConfirmModal } from '../ui/ConfirmModal'

interface ProgramBuilderProps {
  programId: string
  onBrowseTemplates: () => void
}

interface DayRow {
  id: string
  day_index: number
  name: string
  subtitle: string
  focus: string
}

interface ExRow {
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

export function ProgramBuilder({ programId, onBrowseTemplates }: ProgramBuilderProps) {
  const [days, setDays] = useState<DayRow[]>([])
  const [exercises, setExercises] = useState<Map<string, ExRow[]>>(new Map())
  const [selectedDay, setSelectedDay] = useState(0)
  const [editingExercise, setEditingExercise] = useState<{ dayId: string; exercise?: ExRow } | null>(null)
  const [editingDay, setEditingDay] = useState<string | null>(null)
  const [dayEditValue, setDayEditValue] = useState({ subtitle: '', focus: '' })
  const [programName, setProgramName] = useState('')
  const [pendingDeleteDay, setPendingDeleteDay] = useState<{ id: string; name: string; logCount: number } | null>(null)
  const [pendingDeleteExercise, setPendingDeleteExercise] = useState<{ id: string; dayId: string; name: string; logCount: number } | null>(null)

  const loadProgram = useCallback(async () => {
    const db = await getDb()

    const pRows = await db.select<Array<{ name: string }>>(`SELECT name FROM programs WHERE id = ?`, [programId])
    if (pRows.length > 0) setProgramName(pRows[0].name)

    const dayRows = await db.select<DayRow[]>(
      `SELECT id, day_index, name, subtitle, focus FROM days WHERE program_id = ? ORDER BY day_index`,
      [programId],
    )
    setDays(dayRows)

    const exMap = new Map<string, ExRow[]>()
    for (const day of dayRows) {
      const exRows = await db.select<ExRow[]>(
        `SELECT id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave
         FROM exercises WHERE day_id = ? ORDER BY exercise_index`,
        [day.id],
      )
      exMap.set(day.id, exRows)
    }
    setExercises(exMap)
  }, [programId])

  useEffect(() => {
    loadProgram()
  }, [loadProgram])

  const currentDay = days[selectedDay]
  const currentExercises = currentDay ? exercises.get(currentDay.id) ?? [] : []

  async function handleAddDay() {
    const db = await getDb()
    const newIndex = days.length
    const dayId = uuid()
    await db.execute(
      `INSERT INTO days (id, program_id, day_index, name, subtitle, focus) VALUES (?, ?, ?, ?, ?, ?)`,
      [dayId, programId, newIndex, `Day ${newIndex + 1}`, `Day ${newIndex + 1}`, ''],
    )
    await loadProgram()
    setSelectedDay(newIndex)
  }

  async function confirmDeleteDay(dayId: string) {
    const db = await getDb()
    const day = days.find((d) => d.id === dayId)
    const logs = await db.select<Array<{ cnt: number }>>(
      `SELECT COUNT(*) as cnt FROM workout_logs WHERE day_id = ?`,
      [dayId],
    )
    setPendingDeleteDay({ id: dayId, name: day?.subtitle || day?.name || 'this day', logCount: logs[0]?.cnt ?? 0 })
  }

  async function handleDeleteDay(dayId: string) {
    const db = await getDb()
    await db.execute(`DELETE FROM days WHERE id = ?`, [dayId])
    const remaining = days.filter((d) => d.id !== dayId)
    for (let i = 0; i < remaining.length; i++) {
      await db.execute(`UPDATE days SET day_index = ? WHERE id = ?`, [i, remaining[i].id])
    }
    if (selectedDay >= remaining.length) setSelectedDay(Math.max(0, remaining.length - 1))
    await loadProgram()
  }

  async function handleSaveDayEdit(dayId: string) {
    const db = await getDb()
    await db.execute(`UPDATE days SET subtitle = ?, focus = ? WHERE id = ?`, [
      dayEditValue.subtitle,
      dayEditValue.focus,
      dayId,
    ])
    setEditingDay(null)
    await loadProgram()
  }

  async function handleSaveExercise(data: ExerciseFormData) {
    if (!editingExercise) return
    const db = await getDb()

    if (editingExercise.exercise) {
      // Update existing
      const ex = editingExercise.exercise
      await db.execute(
        `UPDATE exercises SET name = ?, category = ?, sets = ?, reps = ?, default_weight = ?, note = ?, is_wave = ? WHERE id = ?`,
        [data.name, data.category, data.sets, data.reps, data.defaultWeight, data.note, data.isWave ? 1 : 0, ex.id],
      )

      if (data.isWave && data.baseMax > 0) {
        // Update or create wave config
        const existing = await db.select<Array<{ id: string }>>(`SELECT id FROM wave_configs WHERE exercise_id = ?`, [ex.id])
        if (existing.length > 0) {
          await db.execute(`UPDATE wave_configs SET base_max = ? WHERE exercise_id = ?`, [data.baseMax, ex.id])
        } else {
          await db.execute(`INSERT INTO wave_configs (id, exercise_id, base_max) VALUES (?, ?, ?)`, [uuid(), ex.id, data.baseMax])
          // Insert default wave weeks and warmups
          await insertDefaultWaveConfig(db, ex.id, data.baseMax)
        }
      }
    } else {
      // Insert new
      const dayExercises = exercises.get(editingExercise.dayId) ?? []
      const newIndex = dayExercises.length
      const exerciseId = uuid()
      const exerciseKey = data.name.toLowerCase().replace(/[^a-z0-9]/g, '_')

      await db.execute(
        `INSERT INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [exerciseId, editingExercise.dayId, newIndex, exerciseKey, data.name, data.category, data.sets, data.reps, data.defaultWeight, data.note, data.isWave ? 1 : 0],
      )

      if (data.isWave && data.baseMax > 0) {
        await db.execute(`INSERT INTO wave_configs (id, exercise_id, base_max) VALUES (?, ?, ?)`, [uuid(), exerciseId, data.baseMax])
        await insertDefaultWaveConfig(db, exerciseId, data.baseMax)
        await db.execute(
          `INSERT INTO training_maxes (id, exercise_id, value, block_num, source) VALUES (?, ?, ?, 1, 'manual')`,
          [uuid(), exerciseId, data.baseMax],
        )
      }
    }

    setEditingExercise(null)
    await loadProgram()
  }

  async function confirmDeleteExercise(exerciseId: string, dayId: string) {
    const db = await getDb()
    const ex = (exercises.get(dayId) ?? []).find((e) => e.id === exerciseId)
    const logs = await db.select<Array<{ cnt: number }>>(
      `SELECT COUNT(*) as cnt FROM set_logs WHERE exercise_id = ?`,
      [exerciseId],
    )
    setPendingDeleteExercise({ id: exerciseId, dayId, name: ex?.name || 'this exercise', logCount: logs[0]?.cnt ?? 0 })
  }

  async function handleDeleteExercise(exerciseId: string, dayId: string) {
    const db = await getDb()
    await db.execute(`DELETE FROM exercises WHERE id = ?`, [exerciseId])
    const remaining = (exercises.get(dayId) ?? []).filter((e) => e.id !== exerciseId)
    for (let i = 0; i < remaining.length; i++) {
      await db.execute(`UPDATE exercises SET exercise_index = ? WHERE id = ?`, [i, remaining[i].id])
    }
    await loadProgram()
  }

  async function handleMoveExercise(exerciseId: string, dayId: string, direction: -1 | 1) {
    const dayExercises = exercises.get(dayId) ?? []
    const idx = dayExercises.findIndex((e) => e.id === exerciseId)
    if (idx < 0) return
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= dayExercises.length) return

    const db = await getDb()
    const other = dayExercises[newIdx]
    await db.execute(`UPDATE exercises SET exercise_index = ? WHERE id = ?`, [newIdx, exerciseId])
    await db.execute(`UPDATE exercises SET exercise_index = ? WHERE id = ?`, [idx, other.id])
    await loadProgram()
  }

  return (
    <div className="px-4 py-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="text-[17px] font-semibold text-accent">PROGRAM EDITOR</div>
          <div className="text-[17px] text-muted mt-0.5">{programName}</div>
        </div>
        <button
          onClick={onBrowseTemplates}
          className="text-[17px] bg-transparent text-muted border border-border rounded-md px-3 py-2 min-h-[44px] cursor-pointer hover:text-bright active:text-bright"
        >
          Browse Templates
        </button>
      </div>

      {/* Day tabs */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {days.map((day, i) => (
          <button
            key={day.id}
            onClick={() => setSelectedDay(i)}
            className={`px-2.5 py-1.5 rounded-md text-[17px] border-none cursor-pointer ${
              i === selectedDay ? 'bg-accent text-bg font-bold' : 'bg-border text-muted'
            }`}
          >
            {day.subtitle || day.name}
          </button>
        ))}
        <button
          onClick={handleAddDay}
          className="px-2.5 py-1.5 rounded-md text-[17px] border border-dashed border-border bg-transparent text-faint cursor-pointer hover:text-muted"
        >
          + Day
        </button>
      </div>

      {/* Day header */}
      {currentDay && (
        <div className="mb-3 p-3 bg-card border border-border-elevated rounded-lg shadow-card">
          {editingDay === currentDay.id ? (
            <div className="space-y-2">
              <input
                value={dayEditValue.subtitle}
                onChange={(e) => setDayEditValue({ ...dayEditValue, subtitle: e.target.value })}
                className="w-full bg-bg border border-border-elevated rounded text-bright p-1.5 text-[18px]"
                placeholder="Day title"
                autoFocus
              />
              <input
                value={dayEditValue.focus}
                onChange={(e) => setDayEditValue({ ...dayEditValue, focus: e.target.value })}
                className="w-full bg-bg border border-border-elevated rounded text-bright p-1.5 text-[18px]"
                placeholder="Focus area"
              />
              <div className="flex gap-1">
                <button onClick={() => handleSaveDayEdit(currentDay.id)} className="text-[16px] bg-success text-white border-none rounded px-3 py-2 min-h-[44px] cursor-pointer">Save</button>
                <button onClick={() => setEditingDay(null)} className="text-[16px] text-muted border border-border bg-transparent rounded px-3 py-2 min-h-[44px] cursor-pointer">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[19px] font-bold text-bright">{currentDay.subtitle || currentDay.name}</div>
                {currentDay.focus && <div className="text-[16px] text-dim mt-0.5">{currentDay.focus}</div>}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => { setEditingDay(currentDay.id); setDayEditValue({ subtitle: currentDay.subtitle, focus: currentDay.focus }) }}
                  className="text-[16px] text-muted bg-transparent border border-border rounded px-3 py-2 min-h-[44px] cursor-pointer active:text-bright"
                >
                  Edit
                </button>
                {days.length > 1 && (
                  <button
                    onClick={() => confirmDeleteDay(currentDay.id)}
                    className="text-[16px] text-faint bg-transparent border border-border rounded px-3 py-2 min-h-[44px] cursor-pointer hover:text-danger active:text-danger"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Exercise list */}
      {currentDay && (
        <div className="space-y-1.5">
          {currentExercises.map((ex, idx) => {
            const cat = CATEGORY_CONFIG[ex.category as keyof typeof CATEGORY_CONFIG] ?? CATEGORY_CONFIG.acc
            return (
              <div key={ex.id} className="flex items-center gap-2 p-2.5 bg-card border border-border-elevated rounded-lg shadow-card">
                {/* Reorder buttons */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => handleMoveExercise(ex.id, currentDay.id, -1)}
                    disabled={idx === 0}
                    className="text-[16px] text-faint bg-transparent border-none cursor-pointer disabled:opacity-20 min-w-[44px] min-h-[44px] flex items-center justify-center leading-none"
                  >
                    &#9650;
                  </button>
                  <button
                    onClick={() => handleMoveExercise(ex.id, currentDay.id, 1)}
                    disabled={idx === currentExercises.length - 1}
                    className="text-[16px] text-faint bg-transparent border-none cursor-pointer disabled:opacity-20 min-w-[44px] min-h-[44px] flex items-center justify-center leading-none"
                  >
                    &#9660;
                  </button>
                </div>

                {/* Exercise info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[18px] font-semibold text-bright truncate">{ex.name}</span>
                    <span
                      className="text-[8px] font-bold tracking-wider rounded-[3px] px-1 py-0.5 shrink-0"
                      style={{ color: cat.badge, background: `${cat.badge}18` }}
                    >
                      {cat.label}
                    </span>
                  </div>
                  <div className="text-[16px] text-faint">
                    {ex.is_wave ? 'Wave-loaded' : `${ex.sets}x${ex.reps}${ex.default_weight ? ` @ ${ex.default_weight}lb` : ''}`}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setEditingExercise({ dayId: currentDay.id, exercise: ex })}
                    className="text-[16px] text-muted bg-transparent border border-border rounded px-2.5 py-1.5 min-h-[44px] cursor-pointer active:text-bright"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => confirmDeleteExercise(ex.id, currentDay.id)}
                    className="text-[16px] text-faint bg-transparent border border-border rounded px-2.5 py-1.5 min-h-[44px] cursor-pointer hover:text-danger active:text-danger"
                  >
                    x
                  </button>
                </div>
              </div>
            )
          })}

          {/* Add exercise button */}
          {currentDay && (
            <button
              onClick={() => setEditingExercise({ dayId: currentDay.id })}
              className="w-full py-2.5 border border-dashed border-border rounded-lg bg-transparent text-faint text-[17px] cursor-pointer hover:text-muted hover:border-muted"
            >
              + Add Exercise
            </button>
          )}
        </div>
      )}

      {/* Confirm delete day */}
      <AnimatePresence>
      {pendingDeleteDay && (
        <ConfirmModal
          title="Delete Day?"
          message={`Delete "${pendingDeleteDay.name}" and all its exercises?`}
          detail={pendingDeleteDay.logCount > 0 ? `This will also delete ${pendingDeleteDay.logCount} workout log(s) and all associated set data.` : undefined}
          confirmLabel="Delete Day"
          danger
          onConfirm={() => { handleDeleteDay(pendingDeleteDay.id); setPendingDeleteDay(null) }}
          onCancel={() => setPendingDeleteDay(null)}
        />
      )}
      </AnimatePresence>

      {/* Confirm delete exercise */}
      <AnimatePresence>
      {pendingDeleteExercise && (
        <ConfirmModal
          title="Delete Exercise?"
          message={`Delete "${pendingDeleteExercise.name}"?`}
          detail={pendingDeleteExercise.logCount > 0 ? `This will also delete ${pendingDeleteExercise.logCount} set log(s) and all associated data.` : undefined}
          confirmLabel="Delete"
          danger
          onConfirm={() => { handleDeleteExercise(pendingDeleteExercise.id, pendingDeleteExercise.dayId); setPendingDeleteExercise(null) }}
          onCancel={() => setPendingDeleteExercise(null)}
        />
      )}
      </AnimatePresence>

      {/* Exercise editor modal */}
      <AnimatePresence>
      {editingExercise && (
        <ExerciseEditor
          initial={
            editingExercise.exercise
              ? {
                  name: editingExercise.exercise.name,
                  category: editingExercise.exercise.category as ExerciseCategory,
                  sets: editingExercise.exercise.sets,
                  reps: editingExercise.exercise.reps,
                  defaultWeight: editingExercise.exercise.default_weight,
                  note: editingExercise.exercise.note,
                  isWave: !!editingExercise.exercise.is_wave,
                  baseMax: 0,
                }
              : undefined
          }
          onSave={handleSaveExercise}
          onClose={() => setEditingExercise(null)}
        />
      )}
      </AnimatePresence>
    </div>
  )
}

type ExerciseCategory = 'tech' | 'absolute' | 'ss' | 'acc'

async function insertDefaultWaveConfig(db: Awaited<ReturnType<typeof import('../../lib/db').getDb>>, exerciseId: string, _baseMax: number) {
  const wcRows = await db.select<Array<{ id: string }>>(`SELECT id FROM wave_configs WHERE exercise_id = ?`, [exerciseId])
  if (wcRows.length === 0) return
  const wcId = wcRows[0].id

  // Default warmups
  const warmups = [{ reps: 5, pct: 0.5 }, { reps: 3, pct: 0.65 }]
  for (let i = 0; i < warmups.length; i++) {
    await db.execute(
      `INSERT INTO wave_warmups (id, wave_config_id, set_index, reps, percentage) VALUES (?, ?, ?, ?, ?)`,
      [uuid(), wcId, i, warmups[i].reps, warmups[i].pct],
    )
  }

  // Default weeks
  const weeks = [
    { label: 'Wk1 (5s)', sets: [{ reps: 5, pct: 0.75 }, { reps: 5, pct: 0.82 }, { reps: 5, pct: 0.88 }, { reps: 8, pct: 0.75, backoff: true }] },
    { label: 'Wk2 (4s)', sets: [{ reps: 4, pct: 0.79 }, { reps: 4, pct: 0.85 }, { reps: 4, pct: 0.91 }, { reps: 6, pct: 0.79, backoff: true }] },
    { label: 'Wk3 (3s)', sets: [{ reps: 3, pct: 0.82 }, { reps: 3, pct: 0.88 }, { reps: 3, pct: 0.94 }, { reps: 5, pct: 0.82, backoff: true }] },
    { label: 'Wk4 (deload)', sets: [{ reps: 5, pct: 0.69 }, { reps: 5, pct: 0.75 }, { reps: 3, pct: 0.82 }] },
  ]

  for (let wi = 0; wi < weeks.length; wi++) {
    const wwId = uuid()
    await db.execute(
      `INSERT INTO wave_weeks (id, wave_config_id, week_index, label) VALUES (?, ?, ?, ?)`,
      [wwId, wcId, wi, weeks[wi].label],
    )
    for (let si = 0; si < weeks[wi].sets.length; si++) {
      const s = weeks[wi].sets[si]
      await db.execute(
        `INSERT INTO wave_week_sets (id, wave_week_id, set_index, reps, percentage, is_backoff) VALUES (?, ?, ?, ?, ?, ?)`,
        [uuid(), wwId, si, s.reps, s.pct, s.backoff ? 1 : 0],
      )
    }
  }
}
