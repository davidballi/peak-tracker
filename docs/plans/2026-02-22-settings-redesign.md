# Settings Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current workout-specific SettingsPanel with a true app-wide Settings page, relocate week/TM/advance controls to a collapsible section in the workout view, and add BW-relative strength multiples.

**Architecture:** Zustand store backed by the existing `user_settings` key-value table. All weight values stored in pounds; kg conversion is display-only. Settings page is a full-screen slide-up. Workout controls become an inline collapsible component.

**Tech Stack:** React 18, TypeScript, Zustand 5, Tailwind CSS, SQLite via @tauri-apps/plugin-sql, Framer Motion, Vitest

**Design doc:** `docs/plans/2026-02-22-settings-redesign-design.md`

---

### Task 1: Add calc utilities — `convertWeight`, `roundToNearest`, `bwMultiple`

**Files:**
- Modify: `src/lib/calc.ts` (append after line 31)
- Test: `src/lib/calc.test.ts` (append new describe blocks)

**Step 1: Write the failing tests**

Add to `src/lib/calc.test.ts`:

```typescript
import { convertWeight, roundToNearest, bwMultiple } from './calc'

describe('convertWeight', () => {
  it('converts lb to kg', () => {
    expect(convertWeight(225, 'lb', 'kg')).toBeCloseTo(102.06, 1)
  })

  it('converts kg to lb', () => {
    expect(convertWeight(100, 'kg', 'lb')).toBeCloseTo(220.46, 1)
  })

  it('returns same value when units match', () => {
    expect(convertWeight(100, 'lb', 'lb')).toBe(100)
  })

  it('returns 0 for non-finite input', () => {
    expect(convertWeight(NaN, 'lb', 'kg')).toBe(0)
  })
})

describe('roundToNearest', () => {
  it('rounds to 5 by default', () => {
    expect(roundToNearest(132, 5)).toBe(130)
  })

  it('rounds to 2.5 for kg', () => {
    expect(roundToNearest(51, 2.5)).toBe(50)
  })

  it('returns 0 for non-finite input', () => {
    expect(roundToNearest(NaN, 5)).toBe(0)
  })
})

describe('bwMultiple', () => {
  it('returns ratio when both values are positive', () => {
    expect(bwMultiple(370, 185)).toBeCloseTo(2.0)
  })

  it('returns null when bodyWeight is 0', () => {
    expect(bwMultiple(370, 0)).toBe(null)
  })

  it('returns null when bodyWeight is not set (NaN)', () => {
    expect(bwMultiple(370, NaN)).toBe(null)
  })

  it('returns null when e1rm is 0', () => {
    expect(bwMultiple(0, 185)).toBe(null)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/calc.test.ts`
Expected: FAIL — `convertWeight`, `roundToNearest`, `bwMultiple` not exported

**Step 3: Write the implementation**

Add to `src/lib/calc.ts` after the `validateReps` function:

```typescript
const LB_TO_KG = 0.453592
const KG_TO_LB = 2.20462

export type WeightUnit = 'lb' | 'kg'

/** Convert a weight value between lb and kg. */
export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (!Number.isFinite(value)) return 0
  if (from === to) return value
  return from === 'lb' ? value * LB_TO_KG : value * KG_TO_LB
}

/** Round to the nearest increment (5 for lb, 2.5 for kg). */
export function roundToNearest(value: number, increment: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.round(value / increment) * increment
}

/** Calculate bodyweight multiple. Returns null if either value is invalid. */
export function bwMultiple(e1rm: number, bodyWeight: number): number | null {
  if (!Number.isFinite(e1rm) || !Number.isFinite(bodyWeight)) return null
  if (e1rm <= 0 || bodyWeight <= 0) return null
  return Math.round((e1rm / bodyWeight) * 100) / 100
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/calc.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/lib/calc.ts src/lib/calc.test.ts
git commit -m "feat: add convertWeight, roundToNearest, bwMultiple to calc utils"
```

---

### Task 2: Create settings Zustand store + `useSettings` hook

**Files:**
- Create: `src/store/settingsStore.ts`
- Create: `src/hooks/useSettings.ts`
- Test: `src/store/settingsStore.test.ts`

**Step 1: Write the failing test**

Create `src/store/settingsStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore, SETTINGS_DEFAULTS, parseSettings, type SettingsKey } from '../store/settingsStore'

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
    it('setRaw updates raw map and triggers re-parse', () => {
      useSettingsStore.getState().setRaw({ unit_system: 'kg' })
      expect(useSettingsStore.getState().raw.unit_system).toBe('kg')
    })

    it('updateSetting merges a single key', () => {
      useSettingsStore.getState().updateSetting('theme', 'oled')
      expect(useSettingsStore.getState().raw.theme).toBe('oled')
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/store/settingsStore.test.ts`
Expected: FAIL — module not found

**Step 3: Write the settingsStore**

Create `src/store/settingsStore.ts`:

```typescript
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
```

**Step 4: Write the `useSettings` hook**

Create `src/hooks/useSettings.ts`:

```typescript
import { useCallback, useEffect, useRef } from 'react'
import { getDb } from '../lib/db'
import { useSettingsStore, parseSettings, type SettingsKey } from '../store/settingsStore'

export function useSettings() {
  const { raw, loaded, setRaw, updateSetting } = useSettingsStore()
  const initRan = useRef(false)

  useEffect(() => {
    if (initRan.current) return
    initRan.current = true

    async function load() {
      const db = await getDb()
      const rows = await db.select<Array<{ key: string; value: string }>>(
        `SELECT key, value FROM user_settings`,
      )
      const map: Record<string, string> = {}
      for (const row of rows) {
        map[row.key] = row.value
      }
      setRaw(map)
    }
    load()
  }, [setRaw])

  const setSetting = useCallback(
    async (key: SettingsKey, value: string) => {
      updateSetting(key, value)
      const db = await getDb()
      await db.execute(
        `INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)`,
        [key, value],
      )
    },
    [updateSetting],
  )

  return {
    settings: parseSettings(raw),
    loaded,
    setSetting,
  }
}
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- src/store/settingsStore.test.ts`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/store/settingsStore.ts src/hooks/useSettings.ts src/store/settingsStore.test.ts
git commit -m "feat: add settings Zustand store and useSettings hook"
```

---

### Task 3: Build the Settings page UI

**Files:**
- Create: `src/components/settings/SettingsPage.tsx`

This is a large UI component. Build it section by section.

**Step 1: Create the SettingsPage component**

Create `src/components/settings/SettingsPage.tsx`:

```typescript
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettings } from '../../hooks/useSettings'
import { ConfirmModal } from '../ui/ConfirmModal'
import { getDb } from '../../lib/db'
import type { UnitSystem, Theme, TmRule, SettingsKey } from '../../store/settingsStore'

interface SettingsPageProps {
  onClose: () => void
}

// ── Reusable row components ──────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="text-[12px] uppercase tracking-wide text-muted font-semibold px-4 pt-6 pb-2">
      {title}
    </div>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border border-border mx-4">
      {children}
    </div>
  )
}

function SettingRow({
  label,
  children,
  last = false,
}: {
  label: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      className={`px-4 py-3 flex justify-between items-center min-h-[48px] ${
        last ? '' : 'border-b border-border'
      }`}
    >
      <span className="text-[16px] text-text">{label}</span>
      {children}
    </div>
  )
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex border border-border-elevated rounded-lg overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-[15px] font-medium min-w-[48px] border-none cursor-pointer ${
            value === opt.value
              ? 'bg-accent text-bg'
              : 'bg-transparent text-muted'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({
  value,
  onChange,
}: {
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-[50px] h-[28px] rounded-full border-none cursor-pointer transition-colors ${
        value ? 'bg-accent' : 'bg-border-elevated'
      }`}
    >
      <div
        className={`absolute top-[2px] w-[24px] h-[24px] bg-white rounded-full transition-transform ${
          value ? 'translate-x-[24px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function SettingsPage({ onClose }: SettingsPageProps) {
  const { settings, setSetting } = useSettings()
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [editingBodyWeight, setEditingBodyWeight] = useState(false)
  const [bwValue, setBwValue] = useState('')
  const [editingBarWeight, setEditingBarWeight] = useState(false)
  const [barValue, setBarValue] = useState('')
  const [editingIncrement, setEditingIncrement] = useState(false)
  const [incrementValue, setIncrementValue] = useState('')

  const unitLabel = settings.unitSystem === 'lb' ? 'lb' : 'kg'

  function displayWeight(lbValue: number): string {
    if (settings.unitSystem === 'kg') {
      return String(Math.round(lbValue * 0.453592 * 10) / 10)
    }
    return String(lbValue)
  }

  function parseInputAsLb(input: string): number {
    const num = parseFloat(input)
    if (!Number.isFinite(num) || num < 0) return 0
    if (settings.unitSystem === 'kg') return Math.round(num / 0.453592)
    return num
  }

  async function handleReset() {
    const db = await getDb()
    await db.execute(`DELETE FROM set_logs`)
    await db.execute(`DELETE FROM workout_logs`)
    await db.execute(`DELETE FROM training_maxes`)
    await db.execute(`DELETE FROM exercise_notes`)
    await db.execute(`DELETE FROM user_settings`)
    setShowResetConfirm(false)
    window.location.reload()
  }

  // Default plate options (in lb)
  const ALL_PLATES = [45, 35, 25, 10, 5, 2.5]

  function togglePlate(plate: number) {
    const current = settings.availablePlates
    const next = current.includes(plate)
      ? current.filter((p) => p !== plate)
      : [...current, plate].sort((a, b) => b - a)
    setSetting('available_plates', JSON.stringify(next))
  }

  return (
    <motion.div
      className="fixed inset-0 bg-bg z-[200] flex flex-col pt-[env(safe-area-inset-top)]"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
    >
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-border-elevated">
        <button
          onClick={onClose}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-transparent border-none text-muted cursor-pointer"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
        </button>
        <div className="text-[19px] font-bold text-accent">Settings</div>
        <div className="w-[44px]" /> {/* Spacer for centering */}
      </div>

      <div className="flex-1 overflow-y-auto pb-[calc(32px+env(safe-area-inset-bottom))]">

        {/* ── UNITS ─────────────────────────────────────────── */}
        <SectionHeader title="Units" />
        <SectionCard>
          <SettingRow label="Weight Unit">
            <SegmentedControl
              options={[
                { label: 'lb', value: 'lb' as UnitSystem },
                { label: 'kg', value: 'kg' as UnitSystem },
              ]}
              value={settings.unitSystem}
              onChange={(v) => setSetting('unit_system', v)}
            />
          </SettingRow>
          <SettingRow label="Body Weight" last>
            {editingBodyWeight ? (
              <div className="flex gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  value={bwValue}
                  onChange={(e) => setBwValue(e.target.value)}
                  className="w-[70px] bg-bg border border-border-elevated rounded text-accent px-1.5 py-1.5 text-[16px] font-mono"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setSetting('body_weight', String(parseInputAsLb(bwValue)))
                      setEditingBodyWeight(false)
                    }
                    if (e.key === 'Escape') setEditingBodyWeight(false)
                  }}
                />
                <button
                  onClick={() => {
                    setSetting('body_weight', String(parseInputAsLb(bwValue)))
                    setEditingBodyWeight(false)
                  }}
                  className="bg-success border-none rounded text-white px-3 py-1.5 min-h-[44px] text-[15px] cursor-pointer"
                >
                  ✓
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setBwValue(settings.bodyWeight > 0 ? displayWeight(settings.bodyWeight) : '')
                  setEditingBodyWeight(true)
                }}
                className="bg-transparent border border-border-elevated rounded text-accent px-2.5 py-1.5 min-h-[44px] text-[16px] cursor-pointer font-mono"
              >
                {settings.bodyWeight > 0 ? `${displayWeight(settings.bodyWeight)} ${unitLabel}` : 'Not set'}
              </button>
            )}
          </SettingRow>
        </SectionCard>

        {/* ── PROGRESSION ───────────────────────────────────── */}
        <SectionHeader title="Progression" />
        <SectionCard>
          <SettingRow label="TM Strategy" last={settings.tmRuleDefault !== 'fixed'}>
            <SegmentedControl
              options={[
                { label: 'e1RM', value: 'e1rm' as TmRule },
                { label: 'Fixed', value: 'fixed' as TmRule },
                { label: '%', value: 'percent' as TmRule },
              ]}
              value={settings.tmRuleDefault}
              onChange={(v) => setSetting('tm_rule_default', v)}
            />
          </SettingRow>
          {settings.tmRuleDefault === 'fixed' && (
            <SettingRow label="Default Increment" last>
              {editingIncrement ? (
                <div className="flex gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={incrementValue}
                    onChange={(e) => setIncrementValue(e.target.value)}
                    className="w-[60px] bg-bg border border-border-elevated rounded text-accent px-1.5 py-1.5 text-[16px] font-mono"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const v = parseFloat(incrementValue)
                        if (Number.isFinite(v) && v > 0) setSetting('tm_increment_default', String(v))
                        setEditingIncrement(false)
                      }
                      if (e.key === 'Escape') setEditingIncrement(false)
                    }}
                  />
                  <button
                    onClick={() => {
                      const v = parseFloat(incrementValue)
                      if (Number.isFinite(v) && v > 0) setSetting('tm_increment_default', String(v))
                      setEditingIncrement(false)
                    }}
                    className="bg-success border-none rounded text-white px-3 py-1.5 min-h-[44px] text-[15px] cursor-pointer"
                  >
                    ✓
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setIncrementValue(String(settings.tmIncrementDefault)); setEditingIncrement(true) }}
                  className="bg-transparent border border-border-elevated rounded text-accent px-2.5 py-1.5 min-h-[44px] text-[16px] cursor-pointer font-mono"
                >
                  {settings.tmIncrementDefault} {unitLabel}
                </button>
              )}
            </SettingRow>
          )}
        </SectionCard>

        {/* ── PLATE CALCULATOR ──────────────────────────────── */}
        <SectionHeader title="Plate Calculator" />
        <SectionCard>
          <SettingRow label="Bar Weight">
            {editingBarWeight ? (
              <div className="flex gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  value={barValue}
                  onChange={(e) => setBarValue(e.target.value)}
                  className="w-[60px] bg-bg border border-border-elevated rounded text-accent px-1.5 py-1.5 text-[16px] font-mono"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setSetting('bar_weight', String(parseInputAsLb(barValue)))
                      setEditingBarWeight(false)
                    }
                    if (e.key === 'Escape') setEditingBarWeight(false)
                  }}
                />
                <button
                  onClick={() => {
                    setSetting('bar_weight', String(parseInputAsLb(barValue)))
                    setEditingBarWeight(false)
                  }}
                  className="bg-success border-none rounded text-white px-3 py-1.5 min-h-[44px] text-[15px] cursor-pointer"
                >
                  ✓
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setBarValue(displayWeight(settings.barWeight)); setEditingBarWeight(true) }}
                className="bg-transparent border border-border-elevated rounded text-accent px-2.5 py-1.5 min-h-[44px] text-[16px] cursor-pointer font-mono"
              >
                {displayWeight(settings.barWeight)} {unitLabel}
              </button>
            )}
          </SettingRow>
          <SettingRow label="Available Plates" last>
            <div className="flex gap-1.5 flex-wrap justify-end">
              {ALL_PLATES.map((plate) => (
                <button
                  key={plate}
                  onClick={() => togglePlate(plate)}
                  className={`px-2 py-1 rounded-md text-[14px] font-mono cursor-pointer border transition-colors min-h-[36px] ${
                    settings.availablePlates.includes(plate)
                      ? 'bg-accent/[0.15] border-accent text-accent'
                      : 'bg-transparent border-border-elevated text-faint'
                  }`}
                >
                  {plate}
                </button>
              ))}
            </div>
          </SettingRow>
        </SectionCard>

        {/* ── PREFERENCES ───────────────────────────────────── */}
        <SectionHeader title="Preferences" />
        <SectionCard>
          <SettingRow label="Theme">
            <SegmentedControl
              options={[
                { label: 'Dark', value: 'dark' as Theme },
                { label: 'OLED', value: 'oled' as Theme },
              ]}
              value={settings.theme}
              onChange={(v) => setSetting('theme', v)}
            />
          </SettingRow>
          <SettingRow label="Haptic Feedback">
            <Toggle
              value={settings.hapticsEnabled}
              onChange={(v) => setSetting('haptics_enabled', String(v))}
            />
          </SettingRow>
          <SettingRow label="Auto-advance Week" last>
            <Toggle
              value={settings.autoAdvanceWeek}
              onChange={(v) => setSetting('auto_advance_week', String(v))}
            />
          </SettingRow>
        </SectionCard>

        {/* ── DATA ──────────────────────────────────────────── */}
        <SectionHeader title="Data" />
        <SectionCard>
          <SettingRow label="Export History (CSV)">
            <span className="text-dim text-[16px]">Coming soon</span>
          </SettingRow>
          <SettingRow label="Export History (JSON)">
            <span className="text-dim text-[16px]">Coming soon</span>
          </SettingRow>
          <div className="px-4 py-3 min-h-[48px]">
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full py-2.5 min-h-[44px] bg-transparent border border-danger rounded-lg text-danger text-[16px] font-semibold cursor-pointer"
            >
              Reset All Data
            </button>
          </div>
        </SectionCard>

        {/* ── ABOUT ─────────────────────────────────────────── */}
        <SectionHeader title="About" />
        <SectionCard>
          <SettingRow label="Version">
            <span className="text-[16px] text-muted font-mono">1.0.0</span>
          </SettingRow>
          <SettingRow label="Send Feedback" last>
            <svg className="w-4 h-4 text-dim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </SettingRow>
        </SectionCard>

        {/* Footer */}
        <div className="text-center text-faint text-[13px] pt-8 pb-4">
          Made with Forge
        </div>

      </div>

      <AnimatePresence>
        {showResetConfirm && (
          <ConfirmModal
            title="Reset All Data?"
            message="This will permanently delete all workout logs, training maxes, notes, and settings."
            detail="This action cannot be undone."
            confirmLabel="Reset Everything"
            danger
            onConfirm={handleReset}
            onCancel={() => setShowResetConfirm(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/settings/SettingsPage.tsx
git commit -m "feat: add SettingsPage UI component"
```

---

### Task 4: Create WorkoutControls collapsible component

**Files:**
- Create: `src/components/workout/WorkoutControls.tsx`

**Step 1: Create the component**

Extract the week selector, training max editor, and advance logic from `SettingsPanel.tsx` into a new collapsible component. This component receives the same props but renders inline with a collapse toggle.

Create `src/components/workout/WorkoutControls.tsx`:

```typescript
import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { v4 as uuid } from 'uuid'
import { getDb, withWriteLock } from '../../lib/db'
import { estimatedOneRepMax, roundToNearest5, validateWeight } from '../../lib/calc'
import { ConfirmModal } from '../ui/ConfirmModal'
import type { ExerciseWithWave } from '../../types/program'

const MAX_TM_INCREASE_RATIO = 1.2
const WEEK_LABELS = ['Wk1 (5s)', 'Wk2 (4s)', 'Wk3 (3s)', 'Wk4 (deload)']

interface WorkoutControlsProps {
  programId: string
  blockNum: number
  currentWeek: number
  waveExercises: ExerciseWithWave[]
  getEffectiveMax: (exerciseId: string) => number
  onWeekChange: (week: number) => void
  onAdvance: () => void
}

export function WorkoutControls({
  programId,
  blockNum,
  currentWeek,
  waveExercises,
  getEffectiveMax,
  onWeekChange,
  onAdvance,
}: WorkoutControlsProps) {
  const [expanded, setExpanded] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [advancing, setAdvancing] = useState(false)
  const advancingRef = useRef(false)
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)

  const handleSaveMax = useCallback(
    async (exerciseId: string) => {
      const raw = parseFloat(editValue)
      const val = validateWeight(raw)
      if (val === null || val <= 0) {
        setEditingId(null)
        return
      }
      const db = await getDb()
      await db.execute(
        `INSERT INTO training_maxes (id, exercise_id, value, block_num, source) VALUES (?, ?, ?, ?, 'manual')`,
        [uuid(), exerciseId, val, blockNum],
      )
      setEditingId(null)
      onAdvance()
    },
    [editValue, blockNum, onAdvance],
  )

  const handleAdvanceWeek = useCallback(async () => {
    if (advancingRef.current) return
    advancingRef.current = true
    setAdvancing(true)

    try {
      const db = await getDb()

      if (currentWeek < 3) {
        const nextWeek = currentWeek + 1
        await db.execute(`UPDATE programs SET current_week = ? WHERE id = ?`, [nextWeek, programId])
        onWeekChange(nextWeek)
      } else {
        await withWriteLock(async () => {
          for (const ex of waveExercises) {
            const currentMax = getEffectiveMax(ex.id)
            let bestE1rm = currentMax

            const rows = await db.select<Array<{ weight: number; reps: number }>>(
              `SELECT sl.weight, sl.reps FROM set_logs sl
               JOIN workout_logs wl ON sl.workout_log_id = wl.id
               WHERE wl.program_id = ? AND sl.exercise_id = ? AND wl.block_num = ? AND wl.week_index = 2
                 AND sl.weight IS NOT NULL AND sl.reps IS NOT NULL AND sl.weight > 0 AND sl.reps > 0
                 AND sl.is_completed = 1`,
              [programId, ex.id, blockNum],
            )

            for (const r of rows) {
              const e1rm = estimatedOneRepMax(r.weight, r.reps)
              if (e1rm > bestE1rm) bestE1rm = e1rm
            }

            let newTm: number
            if (bestE1rm > currentMax) {
              const capped = Math.min(bestE1rm, currentMax * MAX_TM_INCREASE_RATIO)
              newTm = roundToNearest5(capped)
            } else {
              newTm = roundToNearest5(currentMax + 5)
            }

            await db.execute(
              `INSERT INTO training_maxes (id, exercise_id, value, block_num, source) VALUES (?, ?, ?, ?, 'auto')`,
              [uuid(), ex.id, newTm, blockNum + 1],
            )
          }

          await db.execute(
            `UPDATE programs SET block_num = block_num + 1, current_week = 0 WHERE id = ?`,
            [programId],
          )
        })
        onAdvance()
      }
    } finally {
      advancingRef.current = false
      setAdvancing(false)
    }
  }, [currentWeek, programId, blockNum, waveExercises, getEffectiveMax, onAdvance, onWeekChange])

  const handleAdvanceClick = useCallback(() => {
    if (currentWeek >= 3) {
      setShowBlockConfirm(true)
    } else {
      handleAdvanceWeek()
    }
  }, [currentWeek, handleAdvanceWeek])

  return (
    <div className="border-b border-border">
      {/* Collapsed bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center gap-2 bg-transparent border-none cursor-pointer min-h-[40px]"
      >
        <svg
          className={`w-3 h-3 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        <span className="text-[15px] text-muted">
          {WEEK_LABELS[currentWeek]} · Block {blockNum}
        </span>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              {/* Week pills */}
              <div className="flex gap-1 mb-3">
                {[0, 1, 2, 3].map((w) => (
                  <button
                    key={w}
                    onClick={() => onWeekChange(w)}
                    className={`flex-1 py-2 min-h-[40px] border-none rounded text-[15px] cursor-pointer ${
                      w === currentWeek
                        ? 'bg-accent text-bg'
                        : 'bg-border text-muted'
                    }`}
                  >
                    {w === 3 ? 'DL' : `W${w + 1}`}
                  </button>
                ))}
              </div>

              {/* Training maxes */}
              {waveExercises.length > 0 && (
                <div className="mb-3">
                  <div className="text-[13px] text-dim font-semibold tracking-wider mb-1">TRAINING MAXES</div>
                  {waveExercises.map((ex) => {
                    const mx = getEffectiveMax(ex.id)
                    return (
                      <div key={ex.id} className="flex justify-between items-center py-1.5 border-b border-border">
                        <span className="text-text text-[15px]">{ex.name}</span>
                        {editingId === ex.id ? (
                          <div className="flex gap-1">
                            <input
                              type="number"
                              inputMode="decimal"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-[65px] bg-bg border border-border-elevated rounded text-accent px-1.5 py-1 text-[16px] font-mono"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveMax(ex.id)
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                            />
                            <button
                              onClick={() => handleSaveMax(ex.id)}
                              className="bg-success border-none rounded text-white px-2.5 py-1 min-h-[40px] text-[15px] cursor-pointer"
                            >
                              ✓
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingId(ex.id); setEditValue(String(mx)) }}
                            className="bg-transparent border border-border-elevated rounded text-accent px-2 py-1 min-h-[40px] text-[15px] cursor-pointer font-mono"
                          >
                            {mx} lb
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Advance button */}
              <button
                onClick={handleAdvanceClick}
                disabled={advancing}
                className="w-full py-2 border-none rounded-md cursor-pointer bg-success text-white text-[15px] font-semibold disabled:opacity-50"
              >
                {currentWeek < 3 ? `Advance to Week ${currentWeek + 2}` : 'Start New Block →'}
              </button>
            </div>

            <AnimatePresence>
              {showBlockConfirm && (
                <ConfirmModal
                  title="Start New Block?"
                  message="This will advance to the next training block and auto-calculate new training maxes from your Week 3 logs."
                  detail="TM increases are capped at 20% per block for safety."
                  confirmLabel="Start New Block"
                  onConfirm={() => { setShowBlockConfirm(false); handleAdvanceWeek() }}
                  onCancel={() => setShowBlockConfirm(false)}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/workout/WorkoutControls.tsx
git commit -m "feat: add WorkoutControls collapsible component"
```

---

### Task 5: Wire up App.tsx — replace SettingsPanel with SettingsPage

**Files:**
- Modify: `src/App.tsx`

**Step 1: Update imports and replace SettingsPanel rendering**

In `src/App.tsx`:

1. Replace `import { SettingsPanel }` with `import { SettingsPage }` from the new path
2. In `MainApp`, rename `showSettings` to `showSettingsPage`
3. Replace the `<SettingsPanel>` block at the bottom with `<SettingsPage>`
4. Remove all SettingsPanel-specific props that are no longer needed (`waveExercises`, `getEffectiveMax`, `handleWeekChange`, `handleAdvance` passed to SettingsPanel)
5. The gear icon click now just toggles `showSettingsPage`

Key changes:
- Remove import of `SettingsPanel`
- Add import of `SettingsPage` from `'./components/settings/SettingsPage'`
- Change the `AnimatePresence` block at the bottom to render `<SettingsPage onClose={() => setShowSettings(false)} />`
- Remove `settingsOpen` prop passed to `WorkoutView` (no longer needed for gear button highlighting — the gear now navigates to settings page)

**Step 2: Verify the app still renders**

Run: `npm run dev`
Open browser, verify gear icon opens the new Settings page.

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire SettingsPage into App, replace old SettingsPanel"
```

---

### Task 6: Wire up WorkoutView — add collapsible controls, update gear icon

**Files:**
- Modify: `src/components/workout/WorkoutView.tsx`

**Step 1: Update WorkoutView**

1. Add import for `WorkoutControls`
2. Add new props needed by `WorkoutControls`: `waveExercises`, `getEffectiveMax`, `onWeekChange`, `onReload`
3. Remove `settingsOpen` prop (no longer used for gear button state)
4. Insert `<WorkoutControls>` between the sticky header and the day header
5. The gear icon button now calls `onOpenSettings()` without any toggle styling

Update the interface to add new props and remove `settingsOpen`. Insert `<WorkoutControls>` right after the `<ProgressBar>` closing tag inside the sticky header div.

**Step 2: Update WorkoutView call site in App.tsx**

Pass the new props (`waveExercises`, `getEffectiveMax`, `onWeekChange: handleWeekChange`, `onReload: handleAdvance`). Remove `settingsOpen` prop.

**Step 3: Verify everything works**

Run: `npm run dev`
Test: collapsible section expands/contracts, week change works, TM edit works, advance works.

**Step 4: Commit**

```bash
git add src/components/workout/WorkoutView.tsx src/App.tsx
git commit -m "feat: add WorkoutControls to WorkoutView, update gear icon to open Settings"
```

---

### Task 7: Delete old SettingsPanel

**Files:**
- Delete: `src/components/settings/SettingsPanel.tsx`

**Step 1: Delete the file**

```bash
rm src/components/settings/SettingsPanel.tsx
```

**Step 2: Verify no remaining imports**

Search for `SettingsPanel` in the codebase. There should be zero references.

**Step 3: Verify build**

Run: `npm run dev` — should compile without errors.

**Step 4: Commit**

```bash
git add -u src/components/settings/SettingsPanel.tsx
git commit -m "chore: delete old SettingsPanel (replaced by SettingsPage + WorkoutControls)"
```

---

### Task 8: Add BW multiples to Dashboard

**Files:**
- Modify: `src/components/dashboard/DashboardView.tsx`

**Step 1: Update DashboardView to show BW multiples**

1. Import `useSettings` hook and `bwMultiple` from calc
2. Get `settings.bodyWeight` from the hook
3. In the PR cards section, after `{pr.bestE1rm} lb`, conditionally show the BW multiple:

```typescript
const bwx = bwMultiple(pr.bestE1rm, settings.bodyWeight)
```

In the JSX, change the e1RM display line:
```tsx
<span className="text-[19px] font-bold font-mono text-accent">
  {pr.bestE1rm} lb
  {bwx !== null && (
    <span className="text-[14px] font-normal text-muted ml-1.5">
      ({bwx.toFixed(1)}x BW)
    </span>
  )}
</span>
```

**Step 2: Verify on dashboard**

Set a body weight in Settings, return to Dashboard, verify BW multiples appear next to PR values.

**Step 3: Commit**

```bash
git add src/components/dashboard/DashboardView.tsx
git commit -m "feat: show BW multiples on dashboard PR cards"
```

---

### Task 9: Add BW multiples to E1rm chart tooltip

**Files:**
- Modify: `src/components/history/E1rmChart.tsx`

**Step 1: Update E1rmChart to show BW multiples in tooltip**

1. Import `useSettings` and `bwMultiple`
2. Create a custom Tooltip component that includes BW multiple when bodyWeight is set
3. Replace the default `<Tooltip>` with the custom component

```typescript
import { useSettingsStore, parseSettings } from '../../store/settingsStore'
import { bwMultiple } from '../../lib/calc'

// Inside the component:
const raw = useSettingsStore((s) => s.raw)
const bodyWeight = parseSettings(raw).bodyWeight

// Custom tooltip:
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const e1rm = payload[0]?.value
  const bwx = bodyWeight > 0 && e1rm ? bwMultiple(e1rm, bodyWeight) : null
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="text-[13px] text-accent font-mono">{e1rm} lb</div>
      {bwx !== null && (
        <div className="text-[11px] text-dim">{bwx.toFixed(1)}x BW</div>
      )}
    </div>
  )
}
```

Replace `<Tooltip contentStyle={...} />` with `<Tooltip content={<CustomTooltip />} />`.

**Step 2: Verify in history view**

Navigate to History, select an exercise, hover/tap on chart points — tooltip should show BW multiple.

**Step 3: Commit**

```bash
git add src/components/history/E1rmChart.tsx
git commit -m "feat: show BW multiples in e1RM chart tooltip"
```

---

### Task 10: Load settings at app init

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add settings initialization to App init**

In the `MainApp` component, call `useSettings()` so settings load when the app starts. This ensures the Zustand store is populated before any component reads from it.

```typescript
import { useSettings } from './hooks/useSettings'

// Inside MainApp:
const { settings } = useSettings()
```

**Step 2: Apply OLED theme**

Add a `useEffect` that toggles a CSS class on `document.documentElement` based on `settings.theme`:

```typescript
useEffect(() => {
  if (settings.theme === 'oled') {
    document.documentElement.classList.add('oled')
  } else {
    document.documentElement.classList.remove('oled')
  }
}, [settings.theme])
```

Add OLED overrides to `src/index.css` (or the Tailwind layer):

```css
.oled {
  --color-bg: #000000;
  --color-card: #0a0a0a;
}
```

**Step 3: Verify**

Toggle theme in Settings — background should switch between `#0d1117` (dark) and `#000000` (OLED).

**Step 4: Commit**

```bash
git add src/App.tsx src/index.css
git commit -m "feat: load settings at init, apply OLED theme"
```

---

### Task 11: Run full test suite + verify build

**Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass (existing 93 + new settingsStore tests).

**Step 2: Verify TypeScript**

```bash
npx tsc -b --noEmit
```

Expected: No new errors beyond pre-existing ones.

**Step 3: Manual smoke test**

Run: `npm run dev`
- Gear icon opens Settings page (not old panel)
- Collapsible controls work in workout view
- Settings persist across page reloads
- BW multiples appear on dashboard when body weight is set
- Theme toggle works

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during smoke testing"
```
