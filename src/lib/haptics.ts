import { invoke } from '@tauri-apps/api/core'
import { useSettingsStore, parseSettings } from '../store/settingsStore'

function isEnabled(): boolean {
  const raw = useSettingsStore.getState().raw
  return parseSettings(raw).hapticsEnabled
}

async function fire(style: 'light' | 'medium' | 'heavy'): Promise<void> {
  if (!isEnabled()) return
  try {
    await invoke('haptic_feedback', { style })
  } catch {
    // Silently fail in dev mode or if command unavailable
  }
}

export function hapticLight(): Promise<void> {
  return fire('light')
}

export function hapticMedium(): Promise<void> {
  return fire('medium')
}

export function hapticHeavy(): Promise<void> {
  return fire('heavy')
}
