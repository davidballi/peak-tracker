import { describe, it, expect, vi } from 'vitest'
import { dedupeForkedExercises } from './seed'

interface ExecCall {
  sql: string
  params: unknown[]
}

type DedupeDb = Parameters<typeof dedupeForkedExercises>[0]

function fakeDb(selectResponses: Array<unknown[]>) {
  const executes: ExecCall[] = []
  let selectCall = 0
  const db = {
    select: vi.fn(async () => selectResponses[selectCall++] ?? []),
    execute: vi.fn(async (sql: string, params: unknown[] = []) => {
      executes.push({ sql, params })
    }),
  }
  return { executes, db: db as unknown as DedupeDb }
}

describe('dedupeForkedExercises', () => {
  it('does nothing when there are no duplicates', async () => {
    const { executes, db } = fakeDb([[]])
    await dedupeForkedExercises(db)
    expect(executes).toEqual([])
  })

  it('ignores archived exercises entirely', async () => {
    const { db } = fakeDb([[]])
    await dedupeForkedExercises(db)

    // Archived exercises may legitimately share (day_id, exercise_index) with
    // active ones — they must be neither dupe candidates nor keepers.
    const [sql] = (db.select as ReturnType<typeof vi.fn>).mock.calls[0] as [string]
    expect(sql).toContain('e.archived_at IS NULL')
    expect(sql).toContain('e2.archived_at IS NULL')
    expect(sql).toContain('e3.archived_at IS NULL')
  })

  it('re-points user data to the kept exercise instead of deleting it', async () => {
    const { executes, db } = fakeDb([
      [{ dupe_id: 'dupe-1', keep_id: 'keep-1' }], // duplicate exercises
      [], // wave_configs for dupe
    ])
    await dedupeForkedExercises(db)

    const sqls = executes.map((e) => e.sql)

    // training_maxes history must survive — re-pointed, never deleted
    expect(sqls.some((s) => s.includes('DELETE FROM training_maxes'))).toBe(false)
    const tmUpdate = executes.find((e) => /UPDATE training_maxes SET exercise_id/.test(e.sql))
    expect(tmUpdate?.params).toEqual(['keep-1', 'dupe-1'])

    // set_logs re-pointed (OR IGNORE for unique-index collisions), leftovers cleaned
    const slUpdate = executes.find((e) => /UPDATE OR IGNORE set_logs SET exercise_id/.test(e.sql))
    expect(slUpdate?.params).toEqual(['keep-1', 'dupe-1'])
    const slDelete = executes.find((e) => /DELETE FROM set_logs WHERE exercise_id/.test(e.sql))
    expect(slDelete?.params).toEqual(['dupe-1'])

    // notes and goals follow the kept exercise
    expect(executes.find((e) => /UPDATE exercise_notes SET exercise_id/.test(e.sql))?.params).toEqual(['keep-1', 'dupe-1'])
    expect(executes.find((e) => /UPDATE strength_goals SET exercise_id/.test(e.sql))?.params).toEqual(['keep-1', 'dupe-1'])

    // the duplicate exercise row itself is removed
    const exDelete = executes.find((e) => /DELETE FROM exercises WHERE id/.test(e.sql))
    expect(exDelete?.params).toEqual(['dupe-1'])

    // re-points happen before the exercise delete (FK + cascade safety)
    const deleteIdx = sqls.findIndex((s) => /DELETE FROM exercises WHERE id/.test(s))
    const tmIdx = sqls.findIndex((s) => /UPDATE training_maxes/.test(s))
    expect(tmIdx).toBeGreaterThanOrEqual(0)
    expect(tmIdx).toBeLessThan(deleteIdx)
  })
})
