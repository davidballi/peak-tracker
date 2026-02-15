import type { ExerciseCategory } from './program'

export interface TemplateWaveWeekSet {
  reps: number
  pct: number
  backoff?: boolean
}

export interface TemplateWaveWeek {
  label: string
  sets: TemplateWaveWeekSet[]
}

export interface TemplateWaveWarmup {
  reps: number
  pct: number
}

export interface TemplateWave {
  warmup: TemplateWaveWarmup[]
  weeks: TemplateWaveWeek[]
  baseMax: number
}

export interface TemplateExercise {
  id: string
  name: string
  category: ExerciseCategory
  sets: number
  reps: number
  defaultWeight: number
  note: string
  isWave?: boolean
  wave?: TemplateWave
}

export interface TemplateDay {
  id: string
  name: string
  subtitle: string
  focus: string
  exercises: TemplateExercise[]
}

export interface ProgramTemplate {
  id: string
  name: string
  author: string
  description: string
  days: TemplateDay[]
}
