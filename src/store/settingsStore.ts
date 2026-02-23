import { create } from 'zustand'

export type UnitSystem = 'lb' | 'kg'
export type Theme = 'dark' | 'oled'
export type TmRule = 'e1rm' | 'fixed' | 'percent'

export type SettingsKey =
  | 'unit_system'
  | 'body_weight'
  | 'theme'
  | 'haptics_enabled'
  | 'auto_advance_week'
  | 'bar_weight'
  | 'available_plates'
  | 'tm_rule_default'
  | 'tm_increment_default'

export const SETTINGS_DEFAULTS: Record<SettingsKey, string> = {
  unit_system: 'lb',
  body_weight: '',
  theme: 'dark',
  haptics_enabled: 'true',
  auto_advance_week: 'false',
  bar_weight: '45',
  available_plates: '[45,35,25,10,5,2.5]',
  tm_rule_default: 'e1rm',
  tm_increment_default: '5',
}

export interface ParsedSettings {
  unitSystem: UnitSystem
  bodyWeight: number
  theme: Theme
  hapticsEnabled: boolean
  autoAdvanceWeek: boolean
  barWeight: number
  availablePlates: number[]
  tmRuleDefault: TmRule
  tmIncrementDefault: number
}

export function parseSettings(raw: Record<string, string>): ParsedSettings {
  const get = (key: SettingsKey) => raw[key] ?? SETTINGS_DEFAULTS[key]

  let plates: number[]
  try {
    plates = JSON.parse(get('available_plates'))
    if (!Array.isArray(plates)) plates = JSON.parse(SETTINGS_DEFAULTS.available_plates)
  } catch {
    plates = JSON.parse(SETTINGS_DEFAULTS.available_plates)
  }

  return {
    unitSystem: get('unit_system') as UnitSystem,
    bodyWeight: parseFloat(get('body_weight')) || 0,
    theme: get('theme') as Theme,
    hapticsEnabled: get('haptics_enabled') === 'true',
    autoAdvanceWeek: get('auto_advance_week') === 'true',
    barWeight: parseFloat(get('bar_weight')) || 45,
    availablePlates: plates,
    tmRuleDefault: get('tm_rule_default') as TmRule,
    tmIncrementDefault: parseFloat(get('tm_increment_default')) || 5,
  }
}

interface SettingsState {
  raw: Record<string, string>
  loaded: boolean
  setRaw: (raw: Record<string, string>) => void
  updateSetting: (key: SettingsKey, value: string) => void
  setLoaded: (loaded: boolean) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  raw: {},
  loaded: false,
  setRaw: (raw) => set({ raw, loaded: true }),
  updateSetting: (key, value) =>
    set((s) => ({ raw: { ...s.raw, [key]: value } })),
  setLoaded: (loaded) => set({ loaded }),
}))
