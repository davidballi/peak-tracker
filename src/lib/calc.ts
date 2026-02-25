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

const LB_TO_KG = 0.453592
const KG_TO_LB = 2.20462

export type WeightUnit = 'lb' | 'kg'

/** Convert a weight value between lb and kg. */
export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (!Number.isFinite(value)) return 0
  if (from === to) return value
  return from === 'lb' ? value * LB_TO_KG : value * KG_TO_LB
}

/** Round to the nearest increment (5 for lb, 2.5 for kg). */
export function roundToNearest(value: number, increment: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.round(value / increment) * increment
}

/** Calculate bodyweight multiple. Returns null if either value is invalid. */
export function bwMultiple(e1rm: number, bodyWeight: number): number | null {
  if (!Number.isFinite(e1rm) || !Number.isFinite(bodyWeight)) return null
  if (e1rm <= 0 || bodyWeight <= 0) return null
  return Math.round((e1rm / bodyWeight) * 100) / 100
}

/** Calculate plates needed per side for a target weight. Greedy algorithm. */
export function calculatePlates(
  targetWeight: number,
  barWeight: number,
  availablePlates: number[],
): number[] {
  if (!Number.isFinite(targetWeight) || !Number.isFinite(barWeight)) return []
  if (targetWeight <= barWeight) return []

  let remaining = (targetWeight - barWeight) / 2
  const sorted = [...availablePlates].sort((a, b) => b - a)
  const result: number[] = []

  for (const plate of sorted) {
    while (remaining >= plate) {
      result.push(plate)
      remaining -= plate
    }
  }

  return result
}
