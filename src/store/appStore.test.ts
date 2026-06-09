import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './appStore'

const initialState = useAppStore.getState()

beforeEach(() => {
  useAppStore.setState(initialState, true)
})

describe('appStore', () => {
  it('has expected defaults', () => {
    const s = useAppStore.getState()
    expect(s.activeProgramId).toBeNull()
    expect(s.currentView).toBe('workout')
    expect(s.dbReady).toBe(false)
    expect(s.dataVersion).toBe(0)
  })

  it('setCurrentView updates the view', () => {
    useAppStore.getState().setCurrentView('history')
    expect(useAppStore.getState().currentView).toBe('history')
  })

  it('setActiveProgramId and setDbReady gate app init', () => {
    useAppStore.getState().setActiveProgramId('prog-1')
    useAppStore.getState().setDbReady(true)
    expect(useAppStore.getState().activeProgramId).toBe('prog-1')
    expect(useAppStore.getState().dbReady).toBe(true)
  })

  it('bumpDataVersion increments monotonically', () => {
    useAppStore.getState().bumpDataVersion()
    useAppStore.getState().bumpDataVersion()
    expect(useAppStore.getState().dataVersion).toBe(2)
  })
})
