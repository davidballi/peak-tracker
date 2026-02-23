import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkoutStore } from './workoutStore'

function reset() {
  useWorkoutStore.setState({
    activeWorkoutLogId: null,
    completedSets: new Set(),
    noteModal: null,
  })
}

describe('workoutStore', () => {
  beforeEach(reset)

  describe('toggleSetComplete', () => {
    it('adds set when absent', () => {
      useWorkoutStore.getState().toggleSetComplete('set-1')
      expect(useWorkoutStore.getState().completedSets.has('set-1')).toBe(true)
    })

    it('removes set when present', () => {
      useWorkoutStore.getState().toggleSetComplete('set-1')
      useWorkoutStore.getState().toggleSetComplete('set-1')
      expect(useWorkoutStore.getState().completedSets.has('set-1')).toBe(false)
    })

    it('does not affect other sets', () => {
      useWorkoutStore.getState().toggleSetComplete('set-1')
      useWorkoutStore.getState().toggleSetComplete('set-2')
      useWorkoutStore.getState().toggleSetComplete('set-1')
      expect(useWorkoutStore.getState().completedSets.has('set-2')).toBe(true)
    })
  })

  describe('setSetComplete', () => {
    it('adds with true', () => {
      useWorkoutStore.getState().setSetComplete('set-1', true)
      expect(useWorkoutStore.getState().completedSets.has('set-1')).toBe(true)
    })

    it('removes with false', () => {
      useWorkoutStore.getState().setSetComplete('set-1', true)
      useWorkoutStore.getState().setSetComplete('set-1', false)
      expect(useWorkoutStore.getState().completedSets.has('set-1')).toBe(false)
    })

    it('is idempotent for add', () => {
      useWorkoutStore.getState().setSetComplete('set-1', true)
      useWorkoutStore.getState().setSetComplete('set-1', true)
      expect(useWorkoutStore.getState().completedSets.size).toBe(1)
    })
  })

  describe('resetCompletedSets', () => {
    it('clears all when no args', () => {
      useWorkoutStore.getState().toggleSetComplete('set-1')
      useWorkoutStore.getState().resetCompletedSets()
      expect(useWorkoutStore.getState().completedSets.size).toBe(0)
    })

    it('initializes from array', () => {
      useWorkoutStore.getState().resetCompletedSets(['a', 'b', 'c'])
      expect(useWorkoutStore.getState().completedSets.size).toBe(3)
      expect(useWorkoutStore.getState().completedSets.has('b')).toBe(true)
    })
  })

  describe('setActiveWorkoutLogId', () => {
    it('sets and clears', () => {
      useWorkoutStore.getState().setActiveWorkoutLogId('log-1')
      expect(useWorkoutStore.getState().activeWorkoutLogId).toBe('log-1')
      useWorkoutStore.getState().setActiveWorkoutLogId(null)
      expect(useWorkoutStore.getState().activeWorkoutLogId).toBe(null)
    })
  })
})
