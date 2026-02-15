export interface WorkoutLog {
  id: string
  programId: string
  dayId: string
  blockNum: number
  weekIndex: number
  startedAt: string
}

export interface SetLog {
  id: string
  workoutLogId: string
  exerciseId: string
  setIndex: number
  weight: number | null
  reps: number | null
  isCompleted: boolean
  loggedAt: string
}

export interface ExerciseNote {
  id: string
  exerciseId: string
  workoutLogId: string | null
  note: string
  createdAt: string
}
