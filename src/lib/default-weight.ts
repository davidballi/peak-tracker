interface ExerciseDefaults {
  isWave: boolean
  defaultWeight: number
}

interface SetLogLike {
  weight: number | null
  isCompleted: boolean
}

/**
 * When a set is being marked complete on an auxiliary (non-wave) exercise,
 * its weight becomes the exercise's new default so the next week and block
 * prefill with what was actually lifted. Returns the weight to persist, or
 * null when nothing should change.
 */
export function adoptedDefaultWeight(
  exercise: ExerciseDefaults,
  log: SetLogLike | undefined,
  prefillWeight: number | undefined,
): number | null {
  if (exercise.isWave) return null
  if (log?.isCompleted) return null // un-completing, not completing
  const weight = log?.weight ?? prefillWeight ?? null
  if (weight === null || weight <= 0) return null
  if (weight === exercise.defaultWeight) return null
  return weight
}
