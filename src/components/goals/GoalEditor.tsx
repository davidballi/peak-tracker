import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getDb } from '../../lib/db'
import { MAX_WEIGHT, MAX_REPS } from '../../lib/calc'
import type { GoalType } from '../../types/goal'
import type { GoalWithProgress } from '../../hooks/useGoals'

interface GoalEditorProps {
  programId: string
  editingGoal: GoalWithProgress | null
  onSave: (exerciseId: string, goalType: GoalType, targetValue: number, deadline: string | null) => void
  onUpdate: (goalId: string, updates: { targetValue?: number; deadline?: string | null }) => void
  onClose: () => void
}

interface ExRow {
  id: string
  name: string
}

export function GoalEditor({ programId, editingGoal, onSave, onUpdate, onClose }: GoalEditorProps) {
  const [exercises, setExercises] = useState<ExRow[]>([])
  const [exerciseId, setExerciseId] = useState(editingGoal?.exerciseId ?? '')
  const [goalType, setGoalType] = useState<GoalType>(editingGoal?.goalType ?? 'e1rm')
  const [targetValue, setTargetValue] = useState(String(editingGoal?.targetValue ?? ''))
  const [deadline, setDeadline] = useState(editingGoal?.deadline ?? '')

  useEffect(() => {
    async function loadExercises() {
      const db = await getDb()
      const rows = await db.select<ExRow[]>(
        `SELECT e.id, e.name FROM exercises e
         JOIN days d ON e.day_id = d.id
         WHERE d.program_id = ?
         ORDER BY d.day_index, e.exercise_index`,
        [programId],
      )
      setExercises(rows)
      if (!editingGoal && rows.length > 0) {
        setExerciseId(rows[0].id)
      }
    }
    loadExercises()
  }, [programId, editingGoal])

  function handleSubmit() {
    const val = parseFloat(targetValue)
    if (!Number.isFinite(val) || val <= 0 || !exerciseId) return
    const maxVal = goalType === 'reps' ? MAX_REPS : MAX_WEIGHT
    const clamped = Math.min(val, maxVal)

    if (editingGoal) {
      onUpdate(editingGoal.id, {
        targetValue: clamped,
        deadline: deadline || null,
      })
    } else {
      onSave(exerciseId, goalType, clamped, deadline || null)
    }
    onClose()
  }

  return (
    <motion.div
      className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className="w-full max-w-[400px] bg-card border border-border-elevated rounded-xl p-5 shadow-modal"
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="text-[14px] font-bold text-accent">
            {editingGoal ? 'Edit Goal' : 'New Goal'}
          </div>
          <button onClick={onClose} className="bg-transparent border-none text-dim text-xl cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center">
            x
          </button>
        </div>

        {/* Exercise selector */}
        {!editingGoal && (
          <div className="mb-3">
            <label className="text-[11px] text-muted block mb-1">Exercise</label>
            <select
              value={exerciseId}
              onChange={(e) => setExerciseId(e.target.value)}
              className="w-full bg-bg border border-[#30363d] rounded-lg text-bright p-2 text-[12px]"
            >
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Goal type */}
        {!editingGoal && (
          <div className="mb-3">
            <label className="text-[11px] text-muted block mb-1">Goal Type</label>
            <div className="flex gap-1">
              {(['e1rm', 'weight', 'reps'] as GoalType[]).map((gt) => (
                <button
                  key={gt}
                  onClick={() => setGoalType(gt)}
                  className={`flex-1 py-2.5 min-h-[44px] rounded text-[11px] border-none cursor-pointer ${
                    gt === goalType ? 'bg-accent text-bg' : 'bg-[#21262d] text-muted'
                  }`}
                >
                  {gt === 'e1rm' ? 'Est 1RM' : gt === 'weight' ? 'Weight' : 'Reps'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Target value */}
        <div className="mb-3">
          <label className="text-[11px] text-muted block mb-1">
            Target {goalType === 'reps' ? '(reps)' : '(lb)'}
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            className="w-full bg-bg border border-[#30363d] rounded-lg text-accent p-2 text-[16px] font-mono focus:border-accent outline-none"
            placeholder={goalType === 'reps' ? 'e.g. 10' : 'e.g. 350'}
            autoFocus
          />
        </div>

        {/* Deadline */}
        <div className="mb-4">
          <label className="text-[11px] text-muted block mb-1">Deadline (optional)</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full bg-bg border border-[#30363d] rounded-lg text-bright p-2 text-[12px] focus:border-accent outline-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            className="flex-1 py-2.5 border-none rounded-lg cursor-pointer bg-[#238636] text-white text-[13px] font-semibold"
          >
            {editingGoal ? 'Update' : 'Create Goal'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-[#30363d] rounded-lg cursor-pointer bg-transparent text-muted text-[13px]"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
