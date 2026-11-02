import { afterEach, expect, it, vi } from 'vitest'
import { startScheduler } from '../../src/server/scheduler.ts'

afterEach(() => {
  vi.useRealTimers()
})

it('skips a tick while the previous reminder run is still in progress', async () => {
  vi.useFakeTimers()
  let calls = 0
  let release = () => {}
  const reminder = {
    runIfDue: () => {
      calls++
      return new Promise<{ notified: number }>((resolve) => {
        release = () => resolve({ notified: 0 })
      })
    },
  }
  const stop = startScheduler(reminder, 1000)
  await vi.advanceTimersByTimeAsync(3500)
  expect(calls).toBe(1)
  release()
  await vi.advanceTimersByTimeAsync(1000)
  expect(calls).toBe(2)
  stop()
})
