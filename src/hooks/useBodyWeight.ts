import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { v4 as uuid } from 'uuid'
import { getDb } from '../lib/db'
import { useSettingsStore } from '../store/settingsStore'
import type { UnitSystem } from '../store/settingsStore'

export interface BodyWeightEntry {
  id: string
  weight: number
  unit: string
  loggedAt: string
}

interface BwRow {
  id: string
  weight: number
  unit: string
  logged_at: string
}

export function useBodyWeight() {
  const [history, setHistory] = useState<BodyWeightEntry[]>([])
  const [loading, setLoading] = useState(true)
  const initRan = useRef(false)

  const loadHistory = useCallback(async () => {
    const db = await getDb()
    const rows = await db.select<BwRow[]>(
      `SELECT id, weight, unit, logged_at FROM body_weight_log ORDER BY logged_at DESC`,
    )
    setHistory(
      rows.map((r) => ({
        id: r.id,
        weight: r.weight,
        unit: r.unit,
        loggedAt: r.logged_at,
      })),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    if (initRan.current) return
    initRan.current = true
    loadHistory()
  }, [loadHistory])

  const logWeight = useCallback(
    async (weight: number, unit: UnitSystem) => {
      const db = await getDb()
      const today = new Date().toISOString().split('T')[0]

      // The unique index on logged_at makes this an upsert — one statement,
      // so a rapid double-tap can't race a SELECT-then-INSERT
      await db.execute(
        `INSERT OR REPLACE INTO body_weight_log (id, weight, unit, logged_at) VALUES (?, ?, ?, ?)`,
        [uuid(), weight, unit, today],
      )

      // Convert to lb for user_settings storage
      const lbValue = unit === 'kg' ? Math.round(weight / 0.453592) : weight
      await db.execute(
        `INSERT OR REPLACE INTO user_settings (key, value) VALUES ('body_weight', ?)`,
        [String(lbValue)],
      )
      useSettingsStore.getState().updateSetting('body_weight', String(lbValue))

      await loadHistory()
    },
    [loadHistory],
  )

  const latest = useMemo(() => (history.length > 0 ? history[0] : null), [history])

  const chartData = useMemo(() => {
    const chronological = [...history].reverse()
    return chronological.map((entry, i) => {
      const windowStart = Math.max(0, i - 6)
      const window = chronological.slice(windowStart, i + 1)
      const rollingAvg =
        Math.round((window.reduce((sum, e) => sum + e.weight, 0) / window.length) * 10) / 10

      return {
        label: entry.loggedAt,
        weight: entry.weight,
        rollingAvg,
      }
    })
  }, [history])

  const bwStats = useMemo(() => {
    if (history.length === 0) return null

    const current = history[0].weight
    const heaviest = Math.max(...history.map((e) => e.weight))
    const lightest = Math.min(...history.map((e) => e.weight))

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

    const olderEntries = history.filter((e) => e.loggedAt <= thirtyDaysAgoStr)
    const change30d = olderEntries.length > 0
      ? Math.round((current - olderEntries[0].weight) * 10) / 10
      : 0

    return { current, heaviest, lightest, change30d }
  }, [history])

  return {
    history,
    latest,
    loading,
    logWeight,
    chartData,
    bwStats,
    reload: loadHistory,
  }
}
