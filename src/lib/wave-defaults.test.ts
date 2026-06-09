import { describe, it, expect, vi } from 'vitest'
import { insertDefaultWaveConfig } from './wave-defaults'
import type { getDb } from './db'

type Db = Awaited<ReturnType<typeof getDb>>

// Pins the research-consensus percentages (see migrations 004/005) so an
// accidental edit fails loudly instead of silently changing programming.
describe('insertDefaultWaveConfig percentages', () => {
  it('inserts the standard warmup, working, and deload percentages', async () => {
    const executes: Array<{ sql: string; params: unknown[] }> = []
    const db = {
      select: vi.fn(async () => [{ id: 'wc-1' }]),
      execute: vi.fn(async (sql: string, params: unknown[] = []) => {
        executes.push({ sql, params })
      }),
    } as unknown as Db

    await insertDefaultWaveConfig(db, 'ex-1', 200)

    const warmups = executes
      .filter((e) => e.sql.includes('INSERT INTO wave_warmups'))
      .map((e) => ({ reps: e.params[3], pct: e.params[4] }))
    expect(warmups).toEqual([
      { reps: 5, pct: 0.40 },
      { reps: 3, pct: 0.55 },
    ])

    const weekInserts = executes.filter((e) => e.sql.includes('INSERT INTO wave_weeks '))
    expect(weekInserts.map((e) => e.params[3])).toEqual([
      'Wk1 (5s)',
      'Wk2 (4s)',
      'Wk3 (3s)',
      'Wk4 (deload)',
    ])

    const setsByWeek = new Map<unknown, Array<{ reps: unknown; pct: unknown; backoff: unknown }>>()
    for (const e of executes.filter((x) => x.sql.includes('INSERT INTO wave_week_sets'))) {
      const wwId = e.params[1]
      const list = setsByWeek.get(wwId) ?? []
      list.push({ reps: e.params[3], pct: e.params[4], backoff: e.params[5] })
      setsByWeek.set(wwId, list)
    }
    const weeks = weekInserts.map((e) => setsByWeek.get(e.params[0]))
    expect(weeks[0]).toEqual([
      { reps: 5, pct: 0.70, backoff: 0 },
      { reps: 5, pct: 0.75, backoff: 0 },
      { reps: 5, pct: 0.80, backoff: 0 },
      { reps: 8, pct: 0.70, backoff: 1 },
    ])
    expect(weeks[1]).toEqual([
      { reps: 4, pct: 0.75, backoff: 0 },
      { reps: 4, pct: 0.80, backoff: 0 },
      { reps: 4, pct: 0.85, backoff: 0 },
      { reps: 6, pct: 0.75, backoff: 1 },
    ])
    expect(weeks[2]).toEqual([
      { reps: 3, pct: 0.80, backoff: 0 },
      { reps: 3, pct: 0.85, backoff: 0 },
      { reps: 3, pct: 0.90, backoff: 0 },
      { reps: 5, pct: 0.80, backoff: 1 },
    ])
    expect(weeks[3]).toEqual([
      { reps: 5, pct: 0.40, backoff: 0 },
      { reps: 5, pct: 0.50, backoff: 0 },
      { reps: 5, pct: 0.60, backoff: 0 },
    ])
  })
})
