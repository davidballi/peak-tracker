/** Round to nearest 5 lb increment */
export function roundToNearest5(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n / 5) * 5
}

/** Epley formula: estimated 1-rep max from weight × reps */
export function estimatedOneRepMax(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return 0
  if (weight <= 0 || reps <= 0) return 0
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30))
}

/** Validation constants for weight and rep inputs */
export const MAX_WEIGHT = 2000
export const MAX_REPS = 100

/** Clamp and validate a weight value. Returns null if invalid. */
export function validateWeight(value: number | null): number | null {
  if (value === null) return null
  if (!Number.isFinite(value) || value < 0) return null
  return Math.min(value, MAX_WEIGHT)
}

/** Clamp and validate a reps value. Returns null if invalid. */
export function validateReps(value: number | null): number | null {
  if (value === null) return null
  if (!Number.isFinite(value) || value < 0) return null
  return Math.min(Math.round(value), MAX_REPS)
}
