import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore, parseSettings } from './settingsStore'

function reset() {
  useSettingsStore.setState({ raw: {}, loaded: false })
}

describe('settingsStore', () => {
  beforeEach(reset)

  describe('parseSettings', () => {
    it('returns defaults for empty raw map', () => {
      const parsed = parseSettings({})
      expect(parsed.unitSystem).toBe('lb')
      expect(parsed.bodyWeight).toBe(0)
      expect(parsed.theme).toBe('dark')
      expect(parsed.hapticsEnabled).toBe(true)
      expect(parsed.autoAdvanceWeek).toBe(false)
      expect(parsed.barWeight).toBe(45)
      expect(parsed.availablePlates).toEqual([45, 35, 25, 10, 5, 2.5])
      expect(parsed.tmRuleDefault).toBe('e1rm')
      expect(parsed.tmIncrementDefault).toBe(5)
    })

    it('parses unit_system', () => {
      expect(parseSettings({ unit_system: 'kg' }).unitSystem).toBe('kg')
    })

    it('parses body_weight', () => {
      expect(parseSettings({ body_weight: '185' }).bodyWeight).toBe(185)
    })

    it('parses boolean settings', () => {
      expect(parseSettings({ haptics_enabled: 'false' }).hapticsEnabled).toBe(false)
      expect(parseSettings({ auto_advance_week: 'true' }).autoAdvanceWeek).toBe(true)
    })

    it('parses available_plates JSON', () => {
      expect(parseSettings({ available_plates: '[45,25,10]' }).availablePlates).toEqual([45, 25, 10])
    })

    it('falls back to default for invalid JSON', () => {
      expect(parseSettings({ available_plates: 'bad' }).availablePlates).toEqual([45, 35, 25, 10, 5, 2.5])
    })
  })

  describe('store actions', () => {
    it('setRaw updates raw map and sets loaded', () => {
      useSettingsStore.getState().setRaw({ unit_system: 'kg' })
      expect(useSettingsStore.getState().raw.unit_system).toBe('kg')
      expect(useSettingsStore.getState().loaded).toBe(true)
    })

    it('updateSetting merges a single key', () => {
      useSettingsStore.getState().updateSetting('theme', 'oled')
      expect(useSettingsStore.getState().raw.theme).toBe('oled')
    })
  })
})
