import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettings } from '../../hooks/useSettings'
import { ConfirmModal } from '../ui/ConfirmModal'
import { getDb } from '../../lib/db'
import { buildCsvString, buildJsonBackup, shareFile } from '../../lib/export'
import type { UnitSystem, Theme, TmRule } from '../../store/settingsStore'

interface SettingsPageProps {
  onClose: () => void
  programId: string
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

export function SettingsPage({ onClose, programId }: SettingsPageProps) {
  const { settings, setSetting } = useSettings()
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [exportingJson, setExportingJson] = useState(false)
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

  async function handleExportCsv() {
    setExportingCsv(true)
    try {
      const csv = await buildCsvString(programId)
      const date = new Date().toISOString().split('T')[0]
      await shareFile(csv, `forge-export-${date}.csv`, 'text/csv')
    } catch {
      // User cancelled share sheet
    }
    setExportingCsv(false)
  }

  async function handleExportJson() {
    setExportingJson(true)
    try {
      const json = await buildJsonBackup(programId)
      const date = new Date().toISOString().split('T')[0]
      await shareFile(json, `forge-backup-${date}.json`, 'application/json')
    } catch {
      // User cancelled share sheet
    }
    setExportingJson(false)
  }

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
        <div className="w-[44px]" />
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
                  Done
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
                    Done
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
                  Done
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
          <SettingRow label="Rest Timer">
            <div className="flex gap-1.5">
              {[60, 90, 120, 180].map((secs) => (
                <button
                  key={secs}
                  onClick={() => setSetting('rest_timer_seconds', String(secs))}
                  className={`px-2 py-1 rounded-md text-[14px] font-mono cursor-pointer border min-h-[36px] ${
                    settings.restTimerSeconds === secs
                      ? 'bg-accent/[0.15] border-accent text-accent'
                      : 'bg-transparent border-border-elevated text-faint'
                  }`}
                >
                  {secs >= 60 ? `${secs / 60}m` : `${secs}s`}
                </button>
              ))}
            </div>
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
            <button
              onClick={handleExportCsv}
              disabled={exportingCsv}
              className="bg-transparent border border-border-elevated rounded text-accent px-2.5 py-1.5 min-h-[44px] text-[16px] cursor-pointer disabled:opacity-50"
            >
              {exportingCsv ? 'Exporting...' : 'Export'}
            </button>
          </SettingRow>
          <SettingRow label="Export History (JSON)">
            <button
              onClick={handleExportJson}
              disabled={exportingJson}
              className="bg-transparent border border-border-elevated rounded text-accent px-2.5 py-1.5 min-h-[44px] text-[16px] cursor-pointer disabled:opacity-50"
            >
              {exportingJson ? 'Exporting...' : 'Export'}
            </button>
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
          <SettingRow label="Version" last>
            <span className="text-[16px] text-muted font-mono">1.0.0</span>
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
