/** Round to nearest 5 lb increment */
export function roundToNearest5(n: number): number {
  return Math.round(n / 5) * 5
}

/** Epley formula: estimated 1-rep max from weight × reps */
export function estimatedOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return weight
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30))
}
