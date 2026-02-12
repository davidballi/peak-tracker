import { create } from 'zustand'

interface NoteModalState {
  type: 'workout' | 'exercise'
  workoutLogId: string
  exerciseId?: string
  exerciseName?: string
}

interface WorkoutState {
  activeWorkoutLogId: string | null
  completedSets: Set<string>
  noteModal: NoteModalState | null
  setActiveWorkoutLogId: (id: string | null) => void
  toggleSetComplete: (setLogId: string) => void
  setSetComplete: (setLogId: string, complete: boolean) => void
  resetCompletedSets: (ids?: string[]) => void
  openNoteModal: (state: NoteModalState) => void
  closeNoteModal: () => void
}

export const useWorkoutStore = create<WorkoutState>((set) => ({
  activeWorkoutLogId: null,
  completedSets: new Set(),
  noteModal: null,
  setActiveWorkoutLogId: (id) => set({ activeWorkoutLogId: id }),
  toggleSetComplete: (setLogId) =>
    set((s) => {
      const next = new Set(s.completedSets)
      if (next.has(setLogId)) next.delete(setLogId)
      else next.add(setLogId)
      return { completedSets: next }
    }),
  setSetComplete: (setLogId, complete) =>
    set((s) => {
      const next = new Set(s.completedSets)
      if (complete) next.add(setLogId)
      else next.delete(setLogId)
      return { completedSets: next }
    }),
  resetCompletedSets: (ids) =>
    set({ completedSets: ids ? new Set(ids) : new Set() }),
  openNoteModal: (state) => set({ noteModal: state }),
  closeNoteModal: () => set({ noteModal: null }),
}))
