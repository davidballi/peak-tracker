import { describe, it, expect } from 'vitest'
import { adoptedDefaultWeight } from './default-weight'

const aux = { isWave: false, defaultWeight: 85 }

describe('adoptedDefaultWeight', () => {
  it('adopts the logged weight when completing an aux set at a new weight', () => {
    const log = { weight: 90, isCompleted: false }
    expect(adoptedDefaultWeight(aux, log, 85)).toBe(90)
  })

  it('falls back to the prefill weight when the set was never typed into', () => {
    expect(adoptedDefaultWeight(aux, undefined, 85)).toBeNull() // same as default — nothing to persist
    expect(adoptedDefaultWeight({ ...aux, defaultWeight: 80 }, undefined, 85)).toBe(85)
  })

  it('returns null for wave exercises', () => {
    const log = { weight: 90, isCompleted: false }
    expect(adoptedDefaultWeight({ isWave: true, defaultWeight: 85 }, log, 85)).toBeNull()
  })

  it('returns null when un-completing a set', () => {
    const log = { weight: 90, isCompleted: true }
    expect(adoptedDefaultWeight(aux, log, 85)).toBeNull()
  })

  it('returns null when the weight matches the current default', () => {
    const log = { weight: 85, isCompleted: false }
    expect(adoptedDefaultWeight(aux, log, 85)).toBeNull()
  })

  it('returns null for missing or non-positive weights', () => {
    expect(adoptedDefaultWeight(aux, { weight: null, isCompleted: false }, undefined)).toBeNull()
    expect(adoptedDefaultWeight(aux, { weight: 0, isCompleted: false }, 0)).toBeNull()
    expect(adoptedDefaultWeight(aux, { weight: -5, isCompleted: false }, 85)).toBeNull()
  })
})
