import { CATEGORY_CONFIG } from '../../lib/constants'
import { getWaveSets } from '../../lib/wave'
import type { ExerciseWithWave } from '../../types/program'
import type { SetLogState } from '../../hooks/useWorkoutLog'
import { SetRow } from './SetRow'

interface ExerciseCardProps {
  exercise: ExerciseWithWave
  weekIndex: number
  currentMax: number
  getSetLog: (exerciseId: string, setIndex: number) => SetLogState | undefined
  onWeightChange: (exerciseId: string, setIndex: number, value: string) => void
  onRepsChange: (exerciseId: string, setIndex: number, value: string) => void
  onToggleComplete: (exerciseId: string, setIndex: number) => void
  onClearSet: (exerciseId: string, setIndex: number) => void
  exerciseNote?: string
  onNoteClick: () => void
}

export function ExerciseCard({
  exercise,
  weekIndex,
  currentMax,
  getSetLog,
  onWeightChange,
  onRepsChange,
  onToggleComplete,
  onClearSet,
  exerciseNote,
  onNoteClick,
}: ExerciseCardProps) {
  const cat = CATEGORY_CONFIG[exercise.category]

  // Generate sets
  let sets: Array<{ index: number; label: string; weight: number; reps: number; isWarmup: boolean; isBackoff: boolean }> = []
  let waveLabel = ''

  if (exercise.isWave && exercise.warmups && exercise.weeks && exercise.weekSets) {
    const waveSets = getWaveSets(exercise.warmups, exercise.weeks, exercise.weekSets, weekIndex, currentMax)
    waveLabel = waveSets.label
    sets = waveSets.all
  } else {
    for (let i = 0; i < exercise.sets; i++) {
      sets.push({
        index: i,
        label: `S${i + 1}`,
        weight: exercise.defaultWeight,
        reps: exercise.reps,
        isWarmup: false,
        isBackoff: false,
      })
    }
  }

  return (
    <div
      className="mb-2 rounded-lg overflow-hidden shadow-card"
      style={{
        border: `1px solid ${cat.border}22`,
        background: cat.bg,
      }}
    >
      {/* Header */}
      <div className="p-[10px_12px_6px] flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-bright">{exercise.name}</span>
            <span
              className="text-[9px] font-bold tracking-wider rounded-[3px] px-1.5 py-0.5"
              style={{ color: cat.badge, background: `${cat.badge}18` }}
            >
              {cat.label}
            </span>
          </div>
          {exercise.isWave && (
            <span className="text-[10px] text-dim">
              {waveLabel} · TM: {currentMax} lb
            </span>
          )}
          {exercise.note && !exercise.isWave && (
            <div className="text-[10px] text-faint mt-0.5">{exercise.note}</div>
          )}
        </div>
        <button
          onClick={onNoteClick}
          className={`bg-transparent border-none cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center text-[18px] shrink-0 transition-opacity ${
            exerciseNote ? 'opacity-100' : 'opacity-30 grayscale'
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </button>
      </div>

      {/* Exercise note display */}
      {exerciseNote && (
        <div className="mx-3 mb-1.5 p-[5px_8px] bg-superset/[0.07] rounded-[5px] border-l-2 border-superset text-[10px] text-muted leading-relaxed">
          {exerciseNote}
        </div>
      )}

      {/* Sets */}
      <div className="px-2 pb-2">
        {sets.map((s) => (
          <SetRow
            key={s.index}
            set={s}
            exerciseId={exercise.id}
            categoryBadge={cat.badge}
            logState={getSetLog(exercise.id, s.index)}
            onWeightChange={onWeightChange}
            onRepsChange={onRepsChange}
            onToggleComplete={onToggleComplete}
            onClear={onClearSet}
          />
        ))}
      </div>
    </div>
  )
}

/** Get total set count for an exercise (used for completion calculation) */
export function getExerciseTotalSets(
  exercise: ExerciseWithWave,
  weekIndex: number,
  currentMax: number,
): number {
  if (exercise.isWave && exercise.warmups && exercise.weeks && exercise.weekSets) {
    const waveSets = getWaveSets(exercise.warmups, exercise.weeks, exercise.weekSets, weekIndex, currentMax)
    return waveSets.all.length
  }
  return exercise.sets
}
