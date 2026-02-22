import { useState, useRef, useCallback } from 'react'
import { AnimatePresence, Reorder } from 'framer-motion'
import type { GeneratedProgram, GeneratedExercise } from '../../lib/program-generator'
import { CATEGORY_CONFIG } from '../../lib/constants'
import { ExerciseEditor, type ExerciseFormData } from '../programs/ExerciseEditor'
import type { ExerciseCategory } from '../../types/program'

interface ReviewStepProps {
  program: GeneratedProgram
  onUpdate: (program: GeneratedProgram) => void
  onConfirm: () => void
}

/** Exercise with a stable UID for Reorder identity */
type TaggedExercise = GeneratedExercise & { _uid: string }

let _counter = 0

function exerciseToFormData(ex: GeneratedExercise): ExerciseFormData {
  return {
    name: ex.name,
    category: ex.category,
    sets: ex.isWave ? 3 : ex.sets,
    reps: ex.isWave ? 5 : ex.reps,
    defaultWeight: ex.defaultWeight,
    note: ex.note,
    isWave: ex.isWave,
    baseMax: ex.baseMax,
  }
}

function formDataToExercise(formData: ExerciseFormData): GeneratedExercise {
  return {
    name: formData.name,
    key: formData.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    category: formData.category,
    sets: formData.isWave ? 0 : formData.sets,
    reps: formData.isWave ? 0 : formData.reps,
    defaultWeight: formData.isWave ? 0 : formData.defaultWeight,
    note: formData.note,
    isWave: formData.isWave,
    baseMax: formData.baseMax,
  }
}

function exerciseSummary(ex: GeneratedExercise): string {
  if (ex.isWave) {
    return `Wave \u00b7 TM: ${ex.baseMax}`
  }
  const weightStr = ex.defaultWeight > 0 ? ` @ ${ex.defaultWeight} lb` : ''
  return `${ex.sets}\u00d7${ex.reps}${weightStr}`
}

export function ReviewStep({ program, onUpdate, onConfirm }: ReviewStepProps) {
  const [activeDayIndex, setActiveDayIndex] = useState(0)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null)
  const isDragging = useRef(false)

  const activeDay = program.days[activeDayIndex]

  // Maintain stable UIDs per day as a ref map: dayIndex → TaggedExercise[]
  const uidMapRef = useRef<Map<number, TaggedExercise[]>>(new Map())

  const getTagged = useCallback((dayIdx: number, exercises: GeneratedExercise[]): TaggedExercise[] => {
    const prev = uidMapRef.current.get(dayIdx) ?? []
    const tagged: TaggedExercise[] = exercises.map((ex, i) => {
      // Try to match existing UID by position if exercise name matches
      const existing = prev[i]
      if (existing && existing.name === ex.name && existing.key === ex.key) {
        return { ...ex, _uid: existing._uid }
      }
      // Otherwise try to find by name+key anywhere in previous list (handles reorder)
      const found = prev.find((p) => p.name === ex.name && p.key === ex.key && !tagged.some((t) => t._uid === p._uid))
      if (found) {
        return { ...ex, _uid: found._uid }
      }
      return { ...ex, _uid: `ex_${++_counter}` }
    })
    uidMapRef.current.set(dayIdx, tagged)
    return tagged
  }, [])

  const activeTagged = getTagged(activeDayIndex, activeDay.exercises)

  function handleReorder(reordered: TaggedExercise[]) {
    isDragging.current = true
    // Update UID map with new order
    uidMapRef.current.set(activeDayIndex, reordered)
    const newDays = program.days.map((day, di) => {
      if (di !== activeDayIndex) return day
      return {
        ...day,
        exercises: reordered.map(({ _uid, ...ex }) => ex),
      }
    })
    onUpdate({ ...program, days: newDays })
    // Reset drag flag after a tick so click handler can check it
    requestAnimationFrame(() => { isDragging.current = false })
  }

  function handleCardClick(ei: number) {
    if (isDragging.current) return
    setEditingIndex(ei)
  }

  function handleDeleteExercise(exIndex: number) {
    const newDays = program.days.map((day, di) => {
      if (di !== activeDayIndex) return day
      return {
        ...day,
        exercises: day.exercises.filter((_, ei) => ei !== exIndex),
      }
    })
    onUpdate({ ...program, days: newDays })
    setPendingDeleteIndex(null)
  }

  function handleEditSave(formData: ExerciseFormData) {
    if (editingIndex === null) return
    const updated = formDataToExercise(formData)
    const newDays = program.days.map((day, di) => {
      if (di !== activeDayIndex) return day
      return {
        ...day,
        exercises: day.exercises.map((ex, ei) =>
          ei === editingIndex ? updated : ex,
        ),
      }
    })
    onUpdate({ ...program, days: newDays })
    setEditingIndex(null)
  }

  function handleAddSave(formData: ExerciseFormData) {
    const newEx = formDataToExercise(formData)
    const newDays = program.days.map((day, di) => {
      if (di !== activeDayIndex) return day
      return {
        ...day,
        exercises: [...day.exercises, newEx],
      }
    })
    onUpdate({ ...program, days: newDays })
    setIsAdding(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[18px] font-bold text-bright">
        Review your program
      </div>

      {/* Day tabs - horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {program.days.map((day, i) => (
          <button
            key={i}
            onClick={() => { setActiveDayIndex(i); setPendingDeleteIndex(null) }}
            className={`flex-shrink-0 px-3 py-2 rounded-lg text-[15px] font-medium cursor-pointer transition-colors border whitespace-nowrap min-h-[44px] ${
              i === activeDayIndex
                ? 'bg-accent text-bg border-accent'
                : 'bg-card text-muted border-border-elevated hover:border-accent active:border-accent'
            }`}
          >
            {day.subtitle}
          </button>
        ))}
      </div>

      {/* Day name + focus */}
      <div>
        <div className="text-[16px] font-semibold text-bright">{activeDay.name}</div>
        <div className="text-[14px] text-dim">{activeDay.focus}</div>
      </div>

      <div className="text-[13px] text-faint">Drag to reorder</div>

      {/* Exercise cards — drag to reorder */}
      <Reorder.Group
        axis="y"
        values={activeTagged}
        onReorder={handleReorder}
        className="flex flex-col gap-2 list-none p-0 m-0"
      >
        {activeTagged.map((ex, ei) => {
          const catConfig = CATEGORY_CONFIG[ex.category as ExerciseCategory]
          return (
            <Reorder.Item
              key={ex._uid}
              value={ex}
              className="bg-card border border-border-elevated rounded-lg p-3 flex items-center gap-3 cursor-grab active:cursor-grabbing hover:border-accent transition-colors"
              style={{ touchAction: 'none' }}
              whileDrag={{ scale: 1.02, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 50 }}
              onDragStart={() => { isDragging.current = true }}
              onDragEnd={() => { setTimeout(() => { isDragging.current = false }, 100) }}
            >
              {/* Drag handle icon */}
              <div className="shrink-0 text-faint">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="1.5" />
                  <circle cx="15" cy="6" r="1.5" />
                  <circle cx="9" cy="12" r="1.5" />
                  <circle cx="15" cy="12" r="1.5" />
                  <circle cx="9" cy="18" r="1.5" />
                  <circle cx="15" cy="18" r="1.5" />
                </svg>
              </div>
              <div className="flex-1 min-w-0" onClick={() => handleCardClick(ei)}>
                <div className="flex items-center gap-2">
                  <span className="text-[16px] font-semibold text-bright truncate">
                    {ex.name}
                  </span>
                  {catConfig && (
                    <span
                      className="text-[11px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        color: catConfig.badge,
                        border: `1px solid ${catConfig.badge}`,
                      }}
                    >
                      {catConfig.label}
                    </span>
                  )}
                </div>
                <div className="text-[14px] text-muted mt-0.5">
                  {exerciseSummary(ex)}
                </div>
              </div>
              {/* Delete button */}
              {pendingDeleteIndex === ei ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDeleteExercise(ei)}
                    className="bg-danger border-none rounded text-white px-2 py-1 text-[14px] font-semibold cursor-pointer min-h-[44px]"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setPendingDeleteIndex(null)}
                    className="bg-border border-none rounded text-muted px-2 py-1 text-[14px] cursor-pointer min-h-[44px]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setPendingDeleteIndex(ei)
                  }}
                  className="bg-transparent border-none text-dim hover:text-danger active:text-danger cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              )}
            </Reorder.Item>
          )
        })}
      </Reorder.Group>

      {/* Add exercise button */}
      <button
        onClick={() => setIsAdding(true)}
        className="bg-card border border-dashed border-border-elevated rounded-lg p-3 min-h-[48px] flex items-center justify-center gap-2 cursor-pointer text-muted hover:border-accent hover:text-accent active:border-accent active:text-accent transition-colors"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        <span className="text-[15px] font-medium">Add Exercise</span>
      </button>

      {/* Continue button */}
      <button
        onClick={onConfirm}
        className="mt-2 w-full bg-accent text-bg font-bold text-[17px] py-3 rounded-lg border-none cursor-pointer min-h-[48px] hover:opacity-90 active:opacity-80 transition-opacity"
      >
        Continue
      </button>

      {/* Exercise editor modals */}
      <AnimatePresence>
        {editingIndex !== null && (
          <ExerciseEditor
            initial={exerciseToFormData(activeDay.exercises[editingIndex])}
            onSave={handleEditSave}
            onClose={() => setEditingIndex(null)}
          />
        )}
        {isAdding && (
          <ExerciseEditor
            onSave={handleAddSave}
            onClose={() => setIsAdding(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
