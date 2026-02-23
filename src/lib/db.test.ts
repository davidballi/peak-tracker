import { describe, it, expect } from 'vitest'
import { withWriteLock } from './db'

describe('withWriteLock', () => {
  it('single function returns result', async () => {
    const result = await withWriteLock(() => Promise.resolve(42))
    expect(result).toBe(42)
  })

  it('two concurrent calls resolve in order', async () => {
    const order: number[] = []
    const a = withWriteLock(async () => {
      await new Promise((r) => setTimeout(r, 20))
      order.push(1)
      return 'a'
    })
    const b = withWriteLock(async () => {
      order.push(2)
      return 'b'
    })
    const [ra, rb] = await Promise.all([a, b])
    expect(ra).toBe('a')
    expect(rb).toBe('b')
    expect(order).toEqual([1, 2])
  })

  it('releases lock on error so subsequent call succeeds', async () => {
    const failed = withWriteLock(() => Promise.reject(new Error('fail')))
    await expect(failed).rejects.toThrow('fail')
    const result = await withWriteLock(() => Promise.resolve('ok'))
    expect(result).toBe('ok')
  })

  it('propagates errors', async () => {
    await expect(
      withWriteLock(() => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom')
  })

  it('three concurrent calls resolve in FIFO order', async () => {
    const order: number[] = []
    const a = withWriteLock(async () => {
      await new Promise((r) => setTimeout(r, 10))
      order.push(1)
    })
    const b = withWriteLock(async () => {
      await new Promise((r) => setTimeout(r, 5))
      order.push(2)
    })
    const c = withWriteLock(async () => {
      order.push(3)
    })
    await Promise.all([a, b, c])
    expect(order).toEqual([1, 2, 3])
  })
})
