import { useMemo, useCallback, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
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
            <span className="text-accent font-bold text-[19px] tracking-wider">FORGE</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-dim text-[17px]">
              Block {blockNum} · Wk {currentWeek + 1}
            </span>
            <button
              onClick={onOpenSettings}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center border rounded-md px-2 py-1 text-[17px] ${
                settingsOpen
                  ? 'bg-accent/[0.125] border-accent text-accent'
                  : 'bg-transparent border-border-elevated text-muted'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
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
            <div className="text-[17px] text-dim mt-0.5">
              {day.focus} · {percentage}% complete
            </div>
          </div>
          <button
            onClick={() => setNoteModal({ type: 'workout' })}
            className={`border rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1 shrink-0 ${
              workoutNote
                ? 'bg-accent/[0.125] border-accent'
                : 'bg-transparent border-border-elevated'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span className={`text-[16px] ${workoutNote ? 'text-accent' : 'text-dim'}`}>
              {workoutNote ? 'Notes' : 'Add note'}
            </span>
          </button>
        </div>
        {workoutNote && (
          <div className="mt-2 p-2 bg-accent/[0.06] rounded-md border-l-[3px] border-accent text-[17px] text-accent leading-relaxed">
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
            className="w-full py-3 border border-border rounded-lg bg-card text-bright text-[17px] font-semibold cursor-pointer hover:border-accent active:border-accent transition-colors"
          >
            Next Day →
          </button>
        ) : currentWeek < 3 ? (
          <button
            onClick={onAdvanceWeek}
            className="w-full py-3 border-none rounded-lg bg-success text-white text-[17px] font-semibold cursor-pointer"
          >
            Advance to Week {currentWeek + 2} →
          </button>
        ) : (
          <button
            onClick={onAdvanceBlock}
            className="w-full py-3 border-none rounded-lg bg-accent text-bg text-[17px] font-semibold cursor-pointer"
          >
            Start New Block →
          </button>
        )}
      </div>

      {/* Note modal */}
      <AnimatePresence>
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
      </AnimatePresence>

    </>
  )
}
