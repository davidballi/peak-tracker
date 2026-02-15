import { useMemo, useCallback, useState } from 'react'
import type { DayWithExercises } from '../../types/program'
import { useWorkoutLog } from '../../hooks/useWorkoutLog'
import { useTrainingMaxes } from '../../hooks/useTrainingMaxes'
import { useNotes } from '../../hooks/useNotes'
import { DayTabs } from './DayTabs'
import { ProgressBar } from './ProgressBar'
import { ExerciseCard, getExerciseTotalSets } from './ExerciseCard'
import { NoteModal } from './NoteModal'

interface WorkoutViewProps {
  programId: string
  blockNum: number
  currentWeek: number
  currentDay: number
  days: DayWithExercises[]
  onSelectDay: (index: number) => void
  onOpenSettings: () => void
  onAdvanceWeek: () => void
  onAdvanceBlock: () => void
  settingsOpen: boolean
}

export function WorkoutView({
  programId,
  blockNum,
  currentWeek,
  currentDay,
  days,
  onSelectDay,
  onOpenSettings,
  onAdvanceWeek,
  onAdvanceBlock,
  settingsOpen,
}: WorkoutViewProps) {
  const day = days[currentDay]
  if (!day) return null

  const allExercises = useMemo(() => days.flatMap((d) => d.exercises), [days])
  const { maxes, getEffectiveMax } = useTrainingMaxes(allExercises)

  const {
    workoutLogId,
    getSetLog,
    upsertSetLog,
    toggleComplete,
    clearSet,
    getCompletionPercentage,
  } = useWorkoutLog(programId, day.id, blockNum, currentWeek)

  const {
    exerciseNotes,
    workoutNote,
    saveExerciseNote,
    saveWorkoutNote,
    getPreviousNotes,
    getPreviousWorkoutNotes,
  } = useNotes(workoutLogId)

  // Note modal state
  const [noteModal, setNoteModal] = useState<{
    type: 'workout' | 'exercise'
    exerciseId?: string
    exerciseName?: string
  } | null>(null)

  // Compute completion percentage
  const exerciseSetsInfo = useMemo(
    () =>
      day.exercises.map((ex) => ({
        id: ex.id,
        totalSets: getExerciseTotalSets(ex, currentWeek, getEffectiveMax(ex.id)),
      })),
    [day.exercises, currentWeek, maxes, getEffectiveMax],
  )
  const percentage = getCompletionPercentage(exerciseSetsInfo)

  const handleWeightChange = useCallback(
    (exerciseId: string, setIndex: number, value: string) => {
      upsertSetLog(exerciseId, setIndex, 'weight', value)
    },
    [upsertSetLog],
  )

  const handleRepsChange = useCallback(
    (exerciseId: string, setIndex: number, value: string) => {
      upsertSetLog(exerciseId, setIndex, 'reps', value)
    },
    [upsertSetLog],
  )

  const loadPreviousNotesForModal = useCallback(async () => {
    if (!noteModal) return []
    if (noteModal.type === 'workout') {
      return getPreviousWorkoutNotes(day.id)
    } else if (noteModal.exerciseId) {
      return getPreviousNotes(noteModal.exerciseId)
    }
    return []
  }, [noteModal, day.id, getPreviousNotes, getPreviousWorkoutNotes])

  return (
    <>
      {/* Sticky header */}
      <div className="px-4 pt-1 pb-3 border-b border-border sticky top-0 bg-bg z-[100]">
        <div className="flex justify-between items-center mb-2">
          <div>
            <span className="text-accent font-bold text-[15px] tracking-wider">PEAK</span>
            <span className="text-dim font-normal text-[15px] tracking-wider"> TRACKER</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-dim text-[11px]">
              Block {blockNum} · Wk {currentWeek + 1}
            </span>
            <button
              onClick={onOpenSettings}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center border rounded-md px-2 py-1 text-[11px] ${
                settingsOpen
                  ? 'bg-[#f5a62320] border-accent text-accent'
                  : 'bg-transparent border-[#30363d] text-muted'
              }`}
            >
              ⚙
            </button>
          </div>
        </div>
        <DayTabs days={days} currentDay={currentDay} onSelectDay={onSelectDay} />
        <ProgressBar percentage={percentage} />
      </div>

      {/* Day header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-lg font-bold text-bright">{day.subtitle}</div>
            <div className="text-xs text-dim mt-0.5">
              {day.focus} · {percentage}% complete
            </div>
          </div>
          <button
            onClick={() => setNoteModal({ type: 'workout' })}
            className={`border rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1 shrink-0 ${
              workoutNote
                ? 'bg-[#f5a62320] border-accent'
                : 'bg-transparent border-[#30363d]'
            }`}
          >
            <span className="text-[14px]">📝</span>
            <span className={`text-[10px] font-mono ${workoutNote ? 'text-accent' : 'text-dim'}`}>
              {workoutNote ? 'Notes' : 'Add note'}
            </span>
          </button>
        </div>
        {workoutNote && (
          <div className="mt-2 p-2 bg-[#f5a62310] rounded-md border-l-[3px] border-accent text-[11px] text-[#d2a34a] leading-relaxed">
            {workoutNote}
          </div>
        )}
      </div>

      {/* Exercise list */}
      <div className="px-3">
        {day.exercises.map((ex) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            weekIndex={currentWeek}
            currentMax={getEffectiveMax(ex.id)}
            getSetLog={getSetLog}
            onWeightChange={handleWeightChange}
            onRepsChange={handleRepsChange}
            onToggleComplete={toggleComplete}
            onClearSet={clearSet}
            exerciseNote={exerciseNotes[ex.id]}
            onNoteClick={() =>
              setNoteModal({ type: 'exercise', exerciseId: ex.id, exerciseName: ex.name })
            }
          />
        ))}
      </div>

      {/* Progression footer */}
      <div className="px-4 pt-4 pb-6">
        {currentDay < days.length - 1 ? (
          <button
            onClick={() => onSelectDay(currentDay + 1)}
            className="w-full py-3 border border-border rounded-lg bg-card text-bright text-xs font-semibold font-mono cursor-pointer hover:border-accent active:border-accent transition-colors"
          >
            Next Day →
          </button>
        ) : currentWeek < 3 ? (
          <button
            onClick={onAdvanceWeek}
            className="w-full py-3 border-none rounded-lg bg-[#238636] text-white text-xs font-semibold font-mono cursor-pointer"
          >
            Advance to Week {currentWeek + 2} →
          </button>
        ) : (
          <button
            onClick={onAdvanceBlock}
            className="w-full py-3 border-none rounded-lg bg-accent text-bg text-xs font-semibold font-mono cursor-pointer"
          >
            Start New Block →
          </button>
        )}
      </div>

      {/* Note modal */}
      {noteModal && (
        <NoteModal
          type={noteModal.type}
          title={noteModal.type === 'workout' ? 'Workout Notes' : 'Exercise Notes'}
          subtitle={
            noteModal.type === 'workout'
              ? `Block ${blockNum} · Week ${currentWeek + 1} · ${day.subtitle}`
              : noteModal.exerciseName ?? ''
          }
          currentNote={
            noteModal.type === 'workout'
              ? workoutNote
              : (noteModal.exerciseId ? exerciseNotes[noteModal.exerciseId] ?? '' : '')
          }
          onSave={(note) => {
            if (noteModal.type === 'workout') {
              saveWorkoutNote(note)
            } else if (noteModal.exerciseId) {
              saveExerciseNote(noteModal.exerciseId, note)
            }
          }}
          onClose={() => setNoteModal(null)}
          loadPreviousNotes={loadPreviousNotesForModal}
        />
      )}

    </>
  )
}
