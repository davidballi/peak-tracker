import { describe, it, expect, vi, beforeEach } from 'vitest'

const selectMock = vi.fn()

vi.mock('./db', () => ({
  getDb: async () => ({ select: selectMock, execute: vi.fn() }),
}))

import { buildCsvString } from './export'

beforeEach(() => {
  selectMock.mockReset()
})

describe('buildCsvString', () => {
  it('orders rows chronologically by started_at, not block_num', async () => {
    selectMock.mockResolvedValueOnce([])
    await buildCsvString('prog-1')

    const [sql, params] = selectMock.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('ORDER BY wl.started_at')
    expect(sql).not.toContain('ORDER BY wl.block_num')
    expect(params).toEqual(['prog-1'])
  })

  it('formats rows as CSV with computed e1rm and escaped fields', async () => {
    selectMock.mockResolvedValueOnce([
      {
        started_at: '2026-01-05 10:00:00',
        block_num: 1,
        week_index: 0,
        day_name: 'Day A',
        exercise_name: 'Bench, Press',
        set_index: 0,
        weight: 100,
        reps: 5,
      },
    ])
    const csv = await buildCsvString('prog-1')
    const lines = csv.split('\n')
    expect(lines[0]).toBe('date,block,week,day,exercise,set,weight,reps,e1rm')
    expect(lines[1]).toBe('2026-01-05,1,1,Day A,"Bench, Press",1,100,5,117')
  })
})
