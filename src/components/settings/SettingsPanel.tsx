import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { v4 as uuid } from 'uuid'
import { getDb, withWriteLock } from '../../lib/db'
import { estimatedOneRepMax, roundToNearest5, validateWeight } from '../../lib/calc'
import { ConfirmModal } from '../ui/ConfirmModal'
import type { ExerciseWithWave } from '../../types/program'

const MAX_TM_INCREASE_RATIO = 1.2 // 20% cap per block

interface SettingsPanelProps {
  programId: string
  blockNum: number
  currentWeek: number
  waveExercises: ExerciseWithWave[]
  getEffectiveMax: (exerciseId: string) => number
  onWeekChange: (week: number) => void
  onAdvance: () => void
  onClose: () => void
}

export function SettingsPanel({
  programId,
  blockNum,
  currentWeek,
  waveExercises,
  getEffectiveMax,
  onWeekChange,
  onAdvance,
  onClose,
}: SettingsPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [advancing, setAdvancing] = useState(false)
  const advancingRef = useRef(false)
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)

  const handleSaveMax = useCallback(
    async (exerciseId: string) => {
      const raw = parseFloat(editValue)
      const val = validateWeight(raw)
      if (val === null || val <= 0) {
        setEditingId(null)
        return
      }
      const db = await getDb()
      await db.execute(
        `INSERT INTO training_maxes (id, exercise_id, value, block_num, source) VALUES (?, ?, ?, ?, 'manual')`,
        [uuid(), exerciseId, val, blockNum],
      )
      setEditingId(null)
      onAdvance()
    },
    [editValue, blockNum, onAdvance],
  )

  const handleAdvanceWeek = useCallback(async () => {
    if (advancingRef.current) return
    advancingRef.current = true
    setAdvancing(true)

    try {
      const db = await getDb()

      if (currentWeek < 3) {
        const nextWeek = currentWeek + 1
        await db.execute(`UPDATE programs SET current_week = ? WHERE id = ?`, [nextWeek, programId])
        onWeekChange(nextWeek)
      } else {
        // Advance to new block — auto-calculate TMs with safety cap
        await withWriteLock(async () => {
          for (const ex of waveExercises) {
            const currentMax = getEffectiveMax(ex.id)
            let bestE1rm = currentMax

            const rows = await db.select<Array<{ weight: number; reps: number }>>(
              `SELECT sl.weight, sl.reps FROM set_logs sl
               JOIN workout_logs wl ON sl.workout_log_id = wl.id
               WHERE wl.program_id = ? AND sl.exercise_id = ? AND wl.block_num = ? AND wl.week_index = 2
                 AND sl.weight IS NOT NULL AND sl.reps IS NOT NULL AND sl.weight > 0 AND sl.reps > 0
                 AND sl.is_completed = 1`,
              [programId, ex.id, blockNum],
            )

            for (const r of rows) {
              const e1rm = estimatedOneRepMax(r.weight, r.reps)
              if (e1rm > bestE1rm) bestE1rm = e1rm
            }

            let newTm: number
            if (bestE1rm > currentMax) {
              const capped = Math.min(bestE1rm, currentMax * MAX_TM_INCREASE_RATIO)
              newTm = roundToNearest5(capped)
            } else {
              newTm = roundToNearest5(currentMax + 5)
            }

            await db.execute(
              `INSERT INTO training_maxes (id, exercise_id, value, block_num, source) VALUES (?, ?, ?, ?, 'auto')`,
              [uuid(), ex.id, newTm, blockNum + 1],
            )
          }

          await db.execute(
            `UPDATE programs SET block_num = block_num + 1, current_week = 0 WHERE id = ?`,
            [programId],
          )
        })
        onAdvance()
      }
    } finally {
      advancingRef.current = false
      setAdvancing(false)
    }
  }, [currentWeek, programId, blockNum, waveExercises, getEffectiveMax, onAdvance, onWeekChange])

  const handleAdvanceClick = useCallback(() => {
    if (currentWeek >= 3) {
      setShowBlockConfirm(true)
    } else {
      handleAdvanceWeek()
    }
  }, [currentWeek, handleAdvanceWeek])

  return (
    <motion.div
      className="fixed inset-0 bg-bg z-[200] flex flex-col pt-[env(safe-area-inset-top)]"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
    >
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-border-elevated">
        <div className="text-[19px] font-bold text-accent">Settings</div>
        <button
          onClick={onClose}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-transparent border border-border-elevated rounded-lg text-muted cursor-pointer hover:border-accent active:border-accent"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(32px+env(safe-area-inset-bottom))]">

      {/* Week selector */}
      <div className="mb-3">
        <div className="text-[17px] text-muted mb-1.5">Week</div>
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((w) => (
            <button
              key={w}
              onClick={() => onWeekChange(w)}
              className={`flex-1 py-2.5 min-h-[44px] border-none rounded text-[17px] cursor-pointer ${
                w === currentWeek
                  ? 'bg-accent text-bg'
                  : 'bg-border text-muted'
              }`}
            >
              {w === 3 ? 'DL' : `W${w + 1}`}
            </button>
          ))}
        </div>
      </div>

      {/* Training maxes */}
      <div className="mb-3">
        <div className="text-[17px] text-muted mb-1.5">Training Maxes</div>
        {waveExercises.map((ex) => {
          const mx = getEffectiveMax(ex.id)
          return (
            <div
              key={ex.id}
              className="flex justify-between items-center py-1.5 border-b border-border"
            >
              <span className="text-text text-[17px]">{ex.name}</span>
              {editingId === ex.id ? (
                <div className="flex gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-[70px] bg-bg border border-border-elevated rounded text-accent px-1.5 py-1.5 text-[18px] font-mono"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveMax(ex.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                  />
                  <button
                    onClick={() => handleSaveMax(ex.id)}
                    className="bg-success border-none rounded text-white px-3 py-1.5 min-h-[44px] text-[17px] cursor-pointer"
                  >
                    ✓
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingId(ex.id); setEditValue(String(mx)) }}
                  className="bg-transparent border border-border-elevated rounded text-accent px-2.5 py-1.5 min-h-[44px] text-[17px] cursor-pointer font-mono"
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
        onClick={handleAdvanceClick}
        disabled={advancing}
        className="w-full py-2.5 border-none rounded-md cursor-pointer bg-success text-white text-[17px] font-semibold disabled:opacity-50"
      >
        {currentWeek < 3 ? `Advance to Week ${currentWeek + 2}` : 'Start New Block →'}
      </button>
      {currentWeek === 3 && (
        <div className="text-[16px] text-muted mt-1.5 text-center">
          New block auto-calculates updated maxes from your logs.
        </div>
      )}

      <AnimatePresence>
      {showBlockConfirm && (
        <ConfirmModal
          title="Start New Block?"
          message="This will advance to the next training block and auto-calculate new training maxes from your Week 3 logs."
          detail="TM increases are capped at 20% per block for safety."
          confirmLabel="Start New Block"
          onConfirm={() => { setShowBlockConfirm(false); handleAdvanceWeek() }}
          onCancel={() => setShowBlockConfirm(false)}
        />
      )}
      </AnimatePresence>
      </div>
    </motion.div>
  )
}
