import { useState } from 'react'
import { motion } from 'framer-motion'
import type { ExerciseCategory } from '../../types/program'
import { CATEGORY_CONFIG } from '../../lib/constants'

export interface ExerciseFormData {
  name: string
  category: ExerciseCategory
  sets: number
  reps: number
  defaultWeight: number
  note: string
  isWave: boolean
  baseMax: number
}

interface ExerciseEditorProps {
  initial?: ExerciseFormData
  onSave: (data: ExerciseFormData) => void
  onClose: () => void
}

const DEFAULT_DATA: ExerciseFormData = {
  name: '',
  category: 'acc',
  sets: 3,
  reps: 10,
  defaultWeight: 0,
  note: '',
  isWave: false,
  baseMax: 0,
}

export function ExerciseEditor({ initial, onSave, onClose }: ExerciseEditorProps) {
  const [data, setData] = useState<ExerciseFormData>(initial ?? DEFAULT_DATA)

  function handleSubmit() {
    if (!data.name.trim()) return
    onSave(data)
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
        className="w-full max-w-[420px] bg-card border border-border-elevated rounded-xl p-5 shadow-modal"
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="text-[14px] font-bold text-accent">
            {initial ? 'Edit Exercise' : 'Add Exercise'}
          </div>
          <button onClick={onClose} className="bg-transparent border-none text-dim text-xl cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center">
            x
          </button>
        </div>

        {/* Name */}
        <div className="mb-3">
          <label className="text-[11px] text-muted block mb-1">Name</label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            maxLength={100}
            className="w-full bg-bg border border-border-elevated rounded-lg text-bright p-2 text-[13px] focus:border-accent outline-none"
            placeholder="e.g. Bench Press"
            autoFocus
          />
        </div>

        {/* Category */}
        <div className="mb-3">
          <label className="text-[11px] text-muted block mb-1">Category</label>
          <div className="flex gap-1">
            {(Object.keys(CATEGORY_CONFIG) as ExerciseCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setData({ ...data, category: cat })}
                className={`flex-1 py-2.5 min-h-[44px] rounded text-[10px] border-none cursor-pointer ${
                  cat === data.category ? 'font-bold' : 'bg-border text-muted'
                }`}
                style={
                  cat === data.category
                    ? { background: CATEGORY_CONFIG[cat].badge, color: '#0d1117' }
                    : undefined
                }
              >
                {CATEGORY_CONFIG[cat].label}
              </button>
            ))}
          </div>
        </div>

        {/* Wave toggle */}
        <div className="mb-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.isWave}
            onChange={(e) => setData({ ...data, isWave: e.target.checked })}
            className="accent-accent"
            id="wave-toggle"
          />
          <label htmlFor="wave-toggle" className="text-[11px] text-muted cursor-pointer">
            Wave-loaded (auto-generates sets from percentages)
          </label>
        </div>

        {data.isWave ? (
          /* Wave base max */
          <div className="mb-3">
            <label className="text-[11px] text-muted block mb-1">Base Training Max (lb)</label>
            <input
              type="number"
              inputMode="decimal"
              value={data.baseMax || ''}
              onChange={(e) => setData({ ...data, baseMax: parseInt(e.target.value) || 0 })}
              className="w-full bg-bg border border-border-elevated rounded-lg text-accent p-2 text-[16px] font-mono focus:border-accent outline-none"
              placeholder="e.g. 315"
            />
            <div className="text-[10px] text-faint mt-1">
              Sets/reps/percentages will use the default wave pattern.
            </div>
          </div>
        ) : (
          /* Standard sets/reps/weight */
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div>
              <label className="text-[11px] text-muted block mb-1">Sets</label>
              <input
                type="number"
                inputMode="decimal"
                value={data.sets}
                onChange={(e) => setData({ ...data, sets: parseInt(e.target.value) || 0 })}
                className="w-full bg-bg border border-border-elevated rounded-lg text-bright p-2 text-[16px] font-mono focus:border-accent outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted block mb-1">Reps</label>
              <input
                type="number"
                inputMode="decimal"
                value={data.reps}
                onChange={(e) => setData({ ...data, reps: parseInt(e.target.value) || 0 })}
                className="w-full bg-bg border border-border-elevated rounded-lg text-bright p-2 text-[16px] font-mono focus:border-accent outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted block mb-1">Weight (lb)</label>
              <input
                type="number"
                inputMode="decimal"
                value={data.defaultWeight || ''}
                onChange={(e) => setData({ ...data, defaultWeight: parseInt(e.target.value) || 0 })}
                className="w-full bg-bg border border-border-elevated rounded-lg text-accent p-2 text-[16px] font-mono focus:border-accent outline-none"
              />
            </div>
          </div>
        )}

        {/* Note */}
        <div className="mb-4">
          <label className="text-[11px] text-muted block mb-1">Note (optional)</label>
          <input
            type="text"
            value={data.note}
            onChange={(e) => setData({ ...data, note: e.target.value })}
            maxLength={500}
            className="w-full bg-bg border border-border-elevated rounded-lg text-bright p-2 text-[12px] focus:border-accent outline-none"
            placeholder="Form cues, tips..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            className="flex-1 py-2.5 border-none rounded-lg cursor-pointer bg-success text-white text-[13px] font-semibold"
          >
            {initial ? 'Save Changes' : 'Add Exercise'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-border-elevated rounded-lg cursor-pointer bg-transparent text-muted text-[13px]"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
