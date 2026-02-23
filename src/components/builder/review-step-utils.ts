import type { GeneratedExercise } from '../../lib/program-generator'
import type { ExerciseFormData } from '../programs/ExerciseEditor'

export function exerciseToFormData(ex: GeneratedExercise): ExerciseFormData {
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

export function formDataToExercise(formData: ExerciseFormData): GeneratedExercise {
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

export function exerciseSummary(ex: GeneratedExercise): string {
  if (ex.isWave) {
    return `Wave \u00b7 TM: ${ex.baseMax}`
  }
  const weightStr = ex.defaultWeight > 0 ? ` @ ${ex.defaultWeight} lb` : ''
  return `${ex.sets}\u00d7${ex.reps}${weightStr}`
}
