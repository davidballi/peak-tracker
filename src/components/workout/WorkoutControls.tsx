import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { v4 as uuid } from 'uuid'
import { getDb } from '../../lib/db'
import { validateWeight } from '../../lib/calc'
import { advanceBlock, rollbackBlock } from '../../lib/blocks'
import { ConfirmModal } from '../ui/ConfirmModal'
import type { ExerciseWithWave } from '../../types/program'

const WEEK_LABELS = ['Wk1 (5s)', 'Wk2 (4s)', 'Wk3 (3s)', 'Wk4 (deload)']

interface WorkoutControlsProps {
  programId: string
  blockNum: number
  currentWeek: number
  cycle: number
  waveExercises: ExerciseWithWave[]
  getEffectiveMax: (exerciseId: string) => number
  onWeekChange: (week: number) => void
  onAdvance: () => void
}

export function WorkoutControls({
  programId,
  blockNum,
  currentWeek,
  cycle,
  waveExercises,
  getEffectiveMax,
  onWeekChange,
  onAdvance,
}: WorkoutControlsProps) {
  const [expanded, setExpanded] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [advancing, setAdvancing] = useState(false)
  const advancingRef = useRef(false)
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)
  const rollingBackRef = useRef(false)

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
        await advanceBlock(programId, blockNum, cycle, waveExercises, getEffectiveMax)
        onAdvance()
      }
    } finally {
      advancingRef.current = false
      setAdvancing(false)
    }
  }, [currentWeek, programId, blockNum, cycle, waveExercises, getEffectiveMax, onAdvance, onWeekChange])

  const handleAdvanceClick = useCallback(() => {
    if (currentWeek >= 3) {
      setShowBlockConfirm(true)
    } else {
      handleAdvanceWeek()
    }
  }, [currentWeek, handleAdvanceWeek])

  const handleRollback = useCallback(async () => {
    if (rollingBackRef.current) return
    rollingBackRef.current = true
    setRollingBack(true)
    try {
      await rollbackBlock(programId, blockNum, waveExercises, getEffectiveMax)
      onAdvance()
    } finally {
      rollingBackRef.current = false
      setRollingBack(false)
    }
  }, [programId, blockNum, waveExercises, getEffectiveMax, onAdvance])

  return (
    <div className="border-b border-border">
      {/* Collapsed bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center gap-2 bg-transparent border-none cursor-pointer min-h-[40px]"
      >
        <svg
          className={`w-3 h-3 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        <span className="text-[15px] text-muted">
          {WEEK_LABELS[currentWeek]} · Block {blockNum}
        </span>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              {/* Week pills */}
              <div className="flex gap-1 mb-3">
                {[0, 1, 2, 3].map((w) => (
                  <button
                    key={w}
                    onClick={() => onWeekChange(w)}
                    className={`flex-1 py-2 min-h-[40px] border-none rounded text-[15px] cursor-pointer ${
                      w === currentWeek
                        ? 'bg-accent text-bg'
                        : 'bg-border text-muted'
                    }`}
                  >
                    {w === 3 ? 'DL' : `W${w + 1}`}
                  </button>
                ))}
              </div>

              {/* Training maxes */}
              {waveExercises.length > 0 && (
                <div className="mb-3">
                  <div className="text-[13px] text-dim font-semibold tracking-wider mb-1">TRAINING MAXES</div>
                  {waveExercises.map((ex) => {
                    const mx = getEffectiveMax(ex.id)
                    return (
                      <div key={ex.id} className="flex justify-between items-center py-1.5 border-b border-border">
                        <span className="text-text text-[15px]">{ex.name}</span>
                        {editingId === ex.id ? (
                          <div className="flex gap-1">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onFocus={(e) => e.currentTarget.select()}
                              className="w-[65px] bg-bg border border-border-elevated rounded text-accent px-1.5 py-1 text-[16px] font-mono"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveMax(ex.id)
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                            />
                            <button
                              onClick={() => handleSaveMax(ex.id)}
                              className="bg-success border-none rounded text-white px-2.5 py-1 min-h-[40px] text-[15px] cursor-pointer"
                            >
                              Done
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingId(ex.id); setEditValue(String(mx)) }}
                            className="bg-transparent border border-border-elevated rounded text-accent px-2 py-1 min-h-[40px] text-[15px] cursor-pointer font-mono"
                          >
                            {mx} lb
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Advance button */}
              <button
                onClick={handleAdvanceClick}
                disabled={advancing || rollingBack}
                className="w-full py-2 border-none rounded-md cursor-pointer bg-success text-white text-[15px] font-semibold disabled:opacity-50"
              >
                {currentWeek < 3 ? `Advance to Week ${currentWeek + 2}` : 'Start New Block →'}
              </button>

              {blockNum > 1 && (
                <button
                  onClick={() => setShowRollbackConfirm(true)}
                  disabled={advancing || rollingBack}
                  className="w-full mt-2 py-2 min-h-[44px] rounded-md cursor-pointer bg-transparent border border-border-elevated text-muted text-[15px] hover:border-accent active:border-accent disabled:opacity-50"
                >
                  ← Back to Block {blockNum - 1}
                </button>
              )}
            </div>

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
              {showRollbackConfirm && (
                <ConfirmModal
                  title="Go Back One Block?"
                  message={`This will return to Block ${blockNum - 1} and restore its training maxes.`}
                  detail="Your logged workouts stay in History; you'll get fresh sessions for the re-run. Any training maxes you edited this block will be replaced."
                  confirmLabel="Go Back"
                  onConfirm={() => { setShowRollbackConfirm(false); handleRollback() }}
                  onCancel={() => setShowRollbackConfirm(false)}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
