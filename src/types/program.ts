export type ExerciseCategory = 'tech' | 'absolute' | 'ss' | 'acc'

export interface Program {
  id: string
  name: string
  sourceTemplateId: string | null
  currentDay: number
  currentWeek: number
  blockNum: number
  isActive: boolean
  createdAt: string
}

export interface Day {
  id: string
  programId: string
  dayIndex: number
  name: string
  subtitle: string
  focus: string
}

export interface Exercise {
  id: string
  dayId: string
  exerciseIndex: number
  exerciseKey: string
  name: string
  category: ExerciseCategory
  sets: number
  reps: number
  defaultWeight: number
  note: string
  isWave: boolean
}

export interface WaveConfig {
  id: string
  exerciseId: string
  baseMax: number
}

export interface WaveWarmup {
  id: string
  waveConfigId: string
  setIndex: number
  reps: number
  percentage: number
}

export interface WaveWeek {
  id: string
  waveConfigId: string
  weekIndex: number
  label: string
}

export interface WaveWeekSet {
  id: string
  waveWeekId: string
  setIndex: number
  reps: number
  percentage: number
  isBackoff: boolean
}

export interface TrainingMax {
  id: string
  exerciseId: string
  value: number
  blockNum: number
  source: string
  createdAt: string
}

// Composite types used in the UI
export interface ExerciseWithWave extends Exercise {
  waveConfig?: WaveConfig
  warmups?: WaveWarmup[]
  weeks?: WaveWeek[]
  weekSets?: Record<string, WaveWeekSet[]> // keyed by waveWeekId
}

export interface DayWithExercises extends Day {
  exercises: ExerciseWithWave[]
}

export interface ProgramFull extends Program {
  days: DayWithExercises[]
}
