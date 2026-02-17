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
  const displayWeight = logState !== undefined ? logState.weight : set.weight
  const displayReps = logState !== undefined ? logState.reps : set.reps
  const hasData = logState !== undefined && (logState.weight != null || logState.reps != null)

  if (confirmClear) {
    return (
      <div className="relative mb-0.5">
        <div className="flex items-center justify-center gap-2 p-[5px_6px] rounded-[5px] bg-danger/[0.09]">
          <span className="text-[17px] text-danger font-semibold">Clear?</span>
          <button
            onClick={() => { onClear(exerciseId, set.index); setConfirmClear(false) }}
            className="bg-danger border-none rounded-[5px] text-white px-3 py-1 text-[17px] font-semibold cursor-pointer min-h-[44px]"
          >
            Yes
          </button>
          <button
            onClick={() => setConfirmClear(false)}
            className="bg-border border-none rounded-[5px] text-muted px-2.5 py-1 text-[17px] cursor-pointer min-h-[44px]"
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
          isCompleted ? 'bg-success/[0.07]' : 'bg-card'
        } ${set.isWarmup ? 'opacity-65' : ''}`}
      >
        {/* Checkbox */}
        <button
          onClick={() => onToggleComplete(exerciseId, set.index)}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer shrink-0`}
        >
          <span className={`w-7 h-7 rounded-[5px] border-[1.5px] flex items-center justify-center text-[19px] ${
            isCompleted
              ? 'border-success bg-success/[0.19] text-success'
              : 'border-border-elevated bg-transparent text-transparent'
          }`}>
            ✓
          </span>
        </button>

        {/* Label */}
        <span
          className={`text-[16px] font-bold w-[22px] text-center shrink-0 ${
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
            inputMode="decimal"
            value={displayWeight ?? ''}
            onChange={(e) => onWeightChange(exerciseId, set.index, e.target.value)}
            className={`w-full bg-bg border border-border rounded px-1.5 py-2 text-[18px] font-mono text-right focus:border-accent outline-none ${
              isCompleted ? 'text-success' : 'text-bright'
            }`}
          />
          <span className="text-[9px] text-faint shrink-0">lb</span>
        </div>

        <span className="text-faint text-[17px]">×</span>

        {/* Reps input */}
        <div className="w-[50px] flex items-center gap-0.5">
          <input
            type="number"
            inputMode="decimal"
            value={displayReps ?? ''}
            onChange={(e) => onRepsChange(exerciseId, set.index, e.target.value)}
            className={`w-full bg-bg border border-border rounded px-1.5 py-2 text-[18px] font-mono text-right focus:border-accent outline-none ${
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
            className="bg-transparent border-none cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center text-[17px] text-faint shrink-0 leading-none opacity-50 hover:opacity-100 active:opacity-100"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
