import { describe, it, expect, vi } from 'vitest'
import { findMainLiftExerciseId } from './main-lifts'

const BENCH = { id: 'bench', name: 'Bench Press' }

describe('findMainLiftExerciseId', () => {
  it('returns the matched exercise id', async () => {
    const select = vi.fn(async () => [{ id: 'ex-1', last_logged: '2026-06-01' }])
    const id = await findMainLiftExerciseId({ select }, 'prog-1', BENCH)
    expect(id).toBe('ex-1')
  })

  it('returns null when no exercise matches', async () => {
    const select = vi.fn(async () => [])
    const id = await findMainLiftExerciseId({ select }, 'prog-1', BENCH)
    expect(id).toBeNull()
  })

  it('matches by exercise_key first with name fallback, preferring recently logged', async () => {
    const select = vi.fn(async () => [{ id: 'ex-1', last_logged: '' }])
    await findMainLiftExerciseId({ select }, 'prog-1', BENCH)

    const [sql, params] = select.mock.calls[0] as unknown as [string, unknown[]]
    expect(sql).toContain('e.exercise_key = ? OR e.name = ?')
    expect(sql).toContain('ORDER BY last_logged DESC')
    expect(params).toEqual(['prog-1', 'bench', 'Bench Press'])
  })
})
