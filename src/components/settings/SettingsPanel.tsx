import { useState, useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import { getDb } from '../../lib/db'
import { estimatedOneRepMax, roundToNearest5 } from '../../lib/calc'
import type { ExerciseWithWave } from '../../types/program'

interface SettingsPanelProps {
  programId: string
  blockNum: number
  currentWeek: number
  waveExercises: ExerciseWithWave[]
  getEffectiveMax: (exerciseId: string) => number
  onWeekChange: (week: number) => void
  onAdvance: () => void
}

export function SettingsPanel({
  programId,
  blockNum,
  currentWeek,
  waveExercises,
  getEffectiveMax,
  onWeekChange,
  onAdvance,
}: SettingsPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [advancing, setAdvancing] = useState(false)

  const handleSaveMax = useCallback(
    async (exerciseId: string) => {
      const val = parseInt(editValue)
      if (!val || val <= 0) {
        setEditingId(null)
        return
      }
      const db = await getDb()
      await db.execute(
        `INSERT INTO training_maxes (id, exercise_id, value, block_num, source) VALUES (?, ?, ?, ?, 'manual')`,
        [uuid(), exerciseId, val, blockNum],
      )
      setEditingId(null)
      // Trigger reload by calling onAdvance handler (which reloads program data)
      onAdvance()
    },
    [editValue, blockNum, onAdvance],
  )

  const handleAdvanceWeek = useCallback(async () => {
    if (advancing) return
    setAdvancing(true)

    const db = await getDb()

    if (currentWeek < 3) {
      // Simple advance
      const nextWeek = currentWeek + 1
      await db.execute(`UPDATE programs SET current_week = ? WHERE id = ?`, [nextWeek, programId])
      onWeekChange(nextWeek)
    } else {
      // Advance to new block — auto-calculate TMs
      for (const ex of waveExercises) {
        const currentMax = getEffectiveMax(ex.id)
        let bestE1rm = currentMax

        // Scan week 3 (index 2) set logs for this exercise
        const rows = await db.select<Array<{ weight: number; reps: number }>>(
          `SELECT sl.weight, sl.reps FROM set_logs sl
           JOIN workout_logs wl ON sl.workout_log_id = wl.id
           WHERE wl.program_id = ? AND sl.exercise_id = ? AND wl.block_num = ? AND wl.week_index = 2
             AND sl.weight IS NOT NULL AND sl.reps IS NOT NULL AND sl.weight > 0 AND sl.reps > 0`,
          [programId, ex.id, blockNum],
        )

        for (const r of rows) {
          const e1rm = estimatedOneRepMax(r.weight, r.reps)
          if (e1rm > bestE1rm) bestE1rm = e1rm
        }

        // New TM: best e1RM if improved, or +5 lb
        const newTm = bestE1rm > currentMax ? roundToNearest5(bestE1rm) : roundToNearest5(currentMax + 5)
        await db.execute(
          `INSERT INTO training_maxes (id, exercise_id, value, block_num, source) VALUES (?, ?, ?, ?, 'auto')`,
          [uuid(), ex.id, newTm, blockNum + 1],
        )
      }

      // Increment block, reset week
      await db.execute(
        `UPDATE programs SET block_num = block_num + 1, current_week = 0 WHERE id = ?`,
        [programId],
      )
      onAdvance()
    }

    setAdvancing(false)
  }, [currentWeek, programId, blockNum, waveExercises, getEffectiveMax, onAdvance, onWeekChange, advancing])

  return (
    <div className="px-4 py-4 border-b border-border bg-card">
      <div className="text-xs font-semibold text-accent mb-3">SETTINGS</div>

      {/* Week selector */}
      <div className="mb-3">
        <div className="text-[11px] text-muted mb-1.5">Week</div>
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((w) => (
            <button
              key={w}
              onClick={() => onWeekChange(w)}
              className={`flex-1 py-2.5 min-h-[44px] border-none rounded text-[11px] font-mono cursor-pointer ${
                w === currentWeek
                  ? 'bg-accent text-bg'
                  : 'bg-[#21262d] text-muted'
              }`}
            >
              {w === 3 ? 'DL' : `W${w + 1}`}
            </button>
          ))}
        </div>
      </div>

      {/* Training maxes */}
      <div className="mb-3">
        <div className="text-[11px] text-muted mb-1.5">Training Maxes</div>
        {waveExercises.map((ex) => {
          const mx = getEffectiveMax(ex.id)
          return (
            <div
              key={ex.id}
              className="flex justify-between items-center py-1.5 border-b border-border"
            >
              <span className="text-text text-xs">{ex.name}</span>
              {editingId === ex.id ? (
                <div className="flex gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-[70px] bg-bg border border-[#30363d] rounded text-accent px-1.5 py-1.5 text-[16px] font-mono"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveMax(ex.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                  />
                  <button
                    onClick={() => handleSaveMax(ex.id)}
                    className="bg-success border-none rounded text-white px-3 py-1.5 min-h-[44px] text-[11px] cursor-pointer"
                  >
                    ✓
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingId(ex.id); setEditValue(String(mx)) }}
                  className="bg-transparent border border-[#30363d] rounded text-accent px-2.5 py-1.5 min-h-[44px] text-xs cursor-pointer font-mono"
                >
                  {mx} lb
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Advance button */}
      <button
        onClick={handleAdvanceWeek}
        disabled={advancing}
        className="w-full py-2.5 border-none rounded-md cursor-pointer bg-[#238636] text-white text-xs font-semibold font-mono disabled:opacity-50"
      >
        {currentWeek < 3 ? `Advance to Week ${currentWeek + 2}` : 'Start New Block →'}
      </button>
      {currentWeek === 3 && (
        <div className="text-[10px] text-muted mt-1.5 text-center">
          New block auto-calculates updated maxes from your logs.
        </div>
      )}
    </div>
  )
}
