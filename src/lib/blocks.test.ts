import { describe, it, expect, vi, beforeEach } from 'vitest'

const selectMock = vi.fn()
const executeMock = vi.fn()

vi.mock('./db', () => ({
  getDb: async () => ({ select: selectMock, execute: executeMock }),
  withWriteLock: (fn: () => Promise<unknown>) => fn(),
}))

import { advanceBlock, rollbackBlock } from './blocks'

beforeEach(() => {
  selectMock.mockReset()
  executeMock.mockReset()
})

describe('advanceBlock', () => {
  it('scopes the Week 3 set query to the current cycle', async () => {
    selectMock.mockResolvedValueOnce([])
    await advanceBlock('p1', 41, 2, [{ id: 'ex1' }], () => 300)

    const [sql, params] = selectMock.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('wl.cycle = ?')
    expect(params).toEqual(['p1', 'ex1', 41, 2])
  })

  it('caps the new TM at 20% above current and rounds to 5', async () => {
    // e1RM of 400x10 = 533, cap = 300 * 1.2 = 360
    selectMock.mockResolvedValueOnce([{ weight: 400, reps: 10 }])
    await advanceBlock('p1', 41, 0, [{ id: 'ex1' }], () => 300)

    const tmInsert = executeMock.mock.calls[0] as [string, unknown[]]
    expect(tmInsert[0]).toContain('INSERT INTO training_maxes')
    expect(tmInsert[0]).toContain("'auto'")
    expect(tmInsert[1]?.slice(2)).toEqual([360, 42])
  })

  it('falls back to +5 when no Week 3 log beats the current max', async () => {
    selectMock.mockResolvedValueOnce([])
    await advanceBlock('p1', 41, 0, [{ id: 'ex1' }], () => 300)

    const tmInsert = executeMock.mock.calls[0] as [string, unknown[]]
    expect(tmInsert[1]?.slice(2)).toEqual([305, 42])
  })

  it('increments block and resets week and day, leaving cycle unchanged', async () => {
    selectMock.mockResolvedValueOnce([])
    await advanceBlock('p1', 41, 0, [{ id: 'ex1' }], () => 300)

    const progUpdate = executeMock.mock.calls.at(-1) as [string, unknown[]]
    expect(progUpdate[0]).toContain('block_num = block_num + 1')
    expect(progUpdate[0]).toContain('current_week = 0')
    expect(progUpdate[0]).not.toContain('cycle')
    expect(progUpdate[1]).toEqual(['p1'])
  })
})

describe('rollbackBlock', () => {
  it('appends a rollback TM row with the target block value', async () => {
    selectMock.mockResolvedValueOnce([{ value: 285 }])
    await rollbackBlock('p1', 43, [{ id: 'ex1' }], () => 300)

    const tmInsert = executeMock.mock.calls[0] as [string, unknown[]]
    expect(tmInsert[0]).toContain('INSERT INTO training_maxes')
    expect(tmInsert[0]).toContain("'rollback'")
    expect(tmInsert[1]?.slice(2)).toEqual([285, 42])
  })

  it('resolves the TM as latest entry at or before the target block', async () => {
    selectMock.mockResolvedValueOnce([{ value: 285 }])
    await rollbackBlock('p1', 43, [{ id: 'ex1' }], () => 300)

    const [sql, params] = selectMock.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('block_num <= ?')
    expect(sql).toContain('ORDER BY block_num DESC, created_at DESC')
    expect(params).toEqual(['ex1', 42])
  })

  it('skips the TM insert when no historical TM exists', async () => {
    selectMock.mockResolvedValueOnce([])
    await rollbackBlock('p1', 43, [{ id: 'ex1' }], () => 300)

    const inserts = executeMock.mock.calls.filter(([sql]) =>
      (sql as string).includes('training_maxes'))
    expect(inserts).toHaveLength(0)
  })

  it('skips the TM insert when the historical value equals the current max', async () => {
    selectMock.mockResolvedValueOnce([{ value: 300 }])
    await rollbackBlock('p1', 43, [{ id: 'ex1' }], () => 300)

    const inserts = executeMock.mock.calls.filter(([sql]) =>
      (sql as string).includes('training_maxes'))
    expect(inserts).toHaveLength(0)
  })

  it('decrements block, resets week, and increments cycle', async () => {
    selectMock.mockResolvedValueOnce([])
    await rollbackBlock('p1', 43, [{ id: 'ex1' }], () => 300)

    const progUpdate = executeMock.mock.calls.at(-1) as [string, unknown[]]
    expect(progUpdate[0]).toContain('block_num = block_num - 1')
    expect(progUpdate[0]).toContain('current_week = 0')
    expect(progUpdate[0]).toContain('cycle = cycle + 1')
    expect(progUpdate[1]).toEqual(['p1'])
  })

  it('does nothing at block 1', async () => {
    await rollbackBlock('p1', 1, [{ id: 'ex1' }], () => 300)
    expect(selectMock).not.toHaveBeenCalled()
    expect(executeMock).not.toHaveBeenCalled()
  })
})
