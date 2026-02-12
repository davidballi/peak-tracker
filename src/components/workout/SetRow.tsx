import { useState } from 'react'
import type { ComputedSet } from '../../lib/wave'
import type { SetLogState } from '../../hooks/useWorkoutLog'

interface SetRowProps {
  set: ComputedSet | { index: number; label: string; weight: number; reps: number; isWarmup: false; isBackoff: false }
  exerciseId: string
  categoryBadge: string
  logState?: SetLogState
  onWeightChange: (exerciseId: string, setIndex: number, value: string) => void
  onRepsChange: (exerciseId: string, setIndex: number, value: string) => void
  onToggleComplete: (exerciseId: string, setIndex: number) => void
  onClear: (exerciseId: string, setIndex: number) => void
}

export function SetRow({
  set,
  exerciseId,
  categoryBadge,
  logState,
  onWeightChange,
  onRepsChange,
  onToggleComplete,
  onClear,
}: SetRowProps) {
  const [confirmClear, setConfirmClear] = useState(false)

  const isCompleted = logState?.isCompleted ?? false
  const displayWeight = logState?.weight ?? set.weight
  const displayReps = logState?.reps ?? set.reps
  const hasData = logState?.weight != null || logState?.reps != null

  if (confirmClear) {
    return (
      <div className="relative mb-0.5">
        <div className="flex items-center justify-center gap-2 p-[5px_6px] rounded-[5px] bg-[#e9456018]">
          <span className="text-[11px] text-danger font-semibold">Clear?</span>
          <button
            onClick={() => { onClear(exerciseId, set.index); setConfirmClear(false) }}
            className="bg-danger border-none rounded-[5px] text-white px-3 py-1 text-[11px] font-semibold cursor-pointer"
          >
            Yes
          </button>
          <button
            onClick={() => setConfirmClear(false)}
            className="bg-[#21262d] border-none rounded-[5px] text-muted px-2.5 py-1 text-[11px] cursor-pointer"
          >
            No
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-0.5">
      <div
        className={`flex items-center gap-1.5 p-[5px_6px] rounded-[5px] transition-all ${
          isCompleted ? 'bg-[#2ea04312]' : 'bg-card'
        } ${set.isWarmup ? 'opacity-65' : ''}`}
      >
        {/* Checkbox */}
        <button
          onClick={() => onToggleComplete(exerciseId, set.index)}
          className={`w-6 h-6 rounded-[5px] border-[1.5px] flex items-center justify-center cursor-pointer shrink-0 text-[13px] ${
            isCompleted
              ? 'border-success bg-[#2ea04330] text-success'
              : 'border-[#30363d] bg-transparent text-transparent'
          }`}
        >
          ✓
        </button>

        {/* Label */}
        <span
          className={`text-[10px] font-bold w-[22px] text-center shrink-0 ${
            set.isWarmup
              ? 'text-faint'
              : set.isBackoff
                ? 'text-superset'
                : `text-[${categoryBadge}]`
          }`}
          style={{ color: set.isWarmup ? undefined : set.isBackoff ? undefined : categoryBadge }}
        >
          {set.label}
        </span>

        {/* Weight input */}
        <div className="flex-1 flex items-center gap-0.5">
          <input
            type="number"
            value={displayWeight ?? ''}
            onChange={(e) => onWeightChange(exerciseId, set.index, e.target.value)}
            className={`w-full bg-bg border border-border rounded px-1.5 py-[5px] text-[13px] font-mono text-right focus:border-accent outline-none ${
              isCompleted ? 'text-success' : 'text-bright'
            }`}
          />
          <span className="text-[9px] text-faint shrink-0">lb</span>
        </div>

        <span className="text-[#30363d] text-xs">×</span>

        {/* Reps input */}
        <div className="w-[50px] flex items-center gap-0.5">
          <input
            type="number"
            value={displayReps ?? ''}
            onChange={(e) => onRepsChange(exerciseId, set.index, e.target.value)}
            className={`w-full bg-bg border border-border rounded px-1.5 py-[5px] text-[13px] font-mono text-right focus:border-accent outline-none ${
              isCompleted ? 'text-success' : 'text-bright'
            }`}
          />
        </div>

        {/* Badges */}
        {set.isWarmup && <span className="text-[8px] text-faint tracking-wider">WU</span>}
        {set.isBackoff && <span className="text-[8px] text-superset tracking-wider">BO</span>}

        {/* Clear button */}
        {(hasData || isCompleted) && (
          <button
            onClick={() => setConfirmClear(true)}
            className="bg-transparent border-none cursor-pointer p-0.5 text-[11px] text-faint shrink-0 leading-none opacity-50 hover:opacity-100"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
