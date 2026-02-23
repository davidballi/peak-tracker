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
