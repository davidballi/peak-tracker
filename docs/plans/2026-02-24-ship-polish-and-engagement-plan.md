# Ship Polish + Engagement Features — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement 5 features — haptics, export, rest timer, plate calculator, body weight tracking — to polish for App Store and improve daily engagement.

**Architecture:** All features build on the existing Tauri v2 + React + SQLite stack. Only body weight tracking needs a new DB table (migration v3). Haptics requires a new Tauri Rust command. The rest are pure TypeScript/React.

**Tech Stack:** Tauri v2 (Rust + Swift bridge for haptics), React 18, TypeScript, Vitest, Zustand, Recharts, SQLite

**Test runner:** `npm test` (vitest run), `npm run test:watch` (vitest). Test files co-locate as `*.test.ts` next to source.

**Key patterns to follow:**
- All DB IDs are TEXT UUIDs via `uuid` v4
- Use `getDb()` singleton from `src/lib/db.ts`
- Use `withWriteLock()` for multi-statement writes
- No semicolons, single quotes, trailing commas
- Tailwind theme tokens only (no hardcoded hex except Recharts SVG props)
- Touch targets min 44x44px, number inputs use `text-[16px]` + `inputMode="decimal"`

---

## Task 1: Plate Calculator — Pure Function

**Files:**
- Modify: `src/lib/calc.ts`
- Modify: `src/lib/calc.test.ts`

**Step 1: Write failing tests**

Add to `src/lib/calc.test.ts`:

```ts
describe('calculatePlates', () => {
  const defaultPlates = [45, 35, 25, 10, 5, 2.5]

  it('returns empty for weight equal to bar', () => {
    expect(calculatePlates(45, 45, defaultPlates)).toEqual([])
  })

  it('returns empty for weight less than bar', () => {
    expect(calculatePlates(30, 45, defaultPlates)).toEqual([])
  })

  it('calculates single plate pair', () => {
    // (135 - 45) / 2 = 45 per side
    expect(calculatePlates(135, 45, defaultPlates)).toEqual([45])
  })

  it('calculates multiple plates per side', () => {
    // (225 - 45) / 2 = 90 per side → 45 + 35 + 10
    expect(calculatePlates(225, 45, defaultPlates)).toEqual([45, 35, 10])
  })

  it('handles repeated plates', () => {
    // (315 - 45) / 2 = 135 per side → 45 + 45 + 45
    expect(calculatePlates(315, 45, defaultPlates)).toEqual([45, 45, 45])
  })

  it('handles small increments', () => {
    // (50 - 45) / 2 = 2.5 per side
    expect(calculatePlates(50, 45, defaultPlates)).toEqual([2.5])
  })

  it('returns closest loadable when not exact', () => {
    // (48 - 45) / 2 = 1.5 per side — can't load exactly, closest is 2.5
    // Greedy: no plate fits 1.5, so empty
    expect(calculatePlates(48, 45, defaultPlates)).toEqual([])
  })

  it('works with limited plate selection', () => {
    // Only 45 and 10 available: (155 - 45) / 2 = 55 → 45 + 10
    expect(calculatePlates(155, 45, [45, 10])).toEqual([45, 10])
  })

  it('returns empty for non-finite input', () => {
    expect(calculatePlates(NaN, 45, defaultPlates)).toEqual([])
    expect(calculatePlates(225, NaN, defaultPlates)).toEqual([])
  })

  it('returns empty for negative weight', () => {
    expect(calculatePlates(-100, 45, defaultPlates)).toEqual([])
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/calc.test.ts`
Expected: FAIL — `calculatePlates` is not exported

**Step 3: Implement `calculatePlates`**

Add to `src/lib/calc.ts`:

```ts
/** Calculate plates needed per side for a target weight. Greedy algorithm. */
export function calculatePlates(
  targetWeight: number,
  barWeight: number,
  availablePlates: number[],
): number[] {
  if (!Number.isFinite(targetWeight) || !Number.isFinite(barWeight)) return []
  if (targetWeight <= barWeight) return []

  let remaining = (targetWeight - barWeight) / 2
  const sorted = [...availablePlates].sort((a, b) => b - a)
  const result: number[] = []

  for (const plate of sorted) {
    while (remaining >= plate) {
      result.push(plate)
      remaining -= plate
    }
  }

  return result
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/calc.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/lib/calc.ts src/lib/calc.test.ts
git commit -m "feat: add calculatePlates pure function with tests"
```

---

## Task 2: Plate Calculator — SetRow UI

**Files:**
- Modify: `src/components/workout/SetRow.tsx`

**Step 1: Add plate display to SetRow**

The plate calc needs settings (barWeight, availablePlates). Pass them as props from the parent chain. Add props to `SetRowProps`:

```ts
barWeight: number
availablePlates: number[]
```

After the existing row `<div>`, add a conditional plate display:

```tsx
{/* Plate loading */}
{displayWeight != null && displayWeight > barWeight && (
  <div className="flex items-center gap-1 pl-[58px] pb-1">
    {calculatePlates(displayWeight, barWeight, availablePlates).map((plate, i) => (
      <span key={i} className="px-1 py-0.5 bg-border/50 rounded text-[11px] text-faint font-mono">
        {plate}
      </span>
    ))}
    <span className="text-[10px] text-faint ml-0.5">per side</span>
  </div>
)}
```

Import `calculatePlates` from `../../lib/calc`.

**Step 2: Thread settings through parent components**

In `ExerciseCard.tsx`: pass `barWeight` and `availablePlates` through to each `SetRow`. These props come from the settings store. The cleanest path is to read settings at the `WorkoutView` level and pass down.

In `WorkoutView.tsx`: import `useSettings` and destructure `settings.barWeight` and `settings.availablePlates`. Pass to each `ExerciseCard`.

In `ExerciseCard.tsx`: accept `barWeight: number` and `availablePlates: number[]` props, pass to each `SetRow`.

**Step 3: Verify visually**

Run: `npm run dev`
Navigate to Workout tab. Verify plate pills appear below weight inputs for sets with weight > bar weight.

**Step 4: Commit**

```bash
git add src/components/workout/SetRow.tsx src/components/workout/ExerciseCard.tsx src/components/workout/WorkoutView.tsx
git commit -m "feat: show plate loading breakdown on workout sets"
```

---

## Task 3: Haptics — Rust Command

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add the haptic_feedback Tauri command**

In `src-tauri/src/lib.rs`, add a Tauri command that bridges to iOS haptics:

```rust
#[tauri::command]
fn haptic_feedback(style: String) {
    #[cfg(target_os = "ios")]
    {
        // UIImpactFeedbackGenerator is automatically available via UIKit on iOS
        // The actual haptic call happens through the Swift bridge
        // For now, this is a no-op placeholder — the JS side will use
        // the WebView's built-in haptic support or we add Swift later
        let _ = style;
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = style;
    }
}
```

Register the command in the builder:

```rust
tauri::Builder::default()
    .plugin(...)
    .invoke_handler(tauri::generate_handler![haptic_feedback])
    .run(...)
```

**Note:** Tauri v2 on iOS runs in WKWebView. For real iOS haptics, we'll use the `@nicegoodthings/tauri-plugin-haptics` or invoke Swift directly. For the initial implementation, we can use a simpler approach: call the Tauri command from JS, and the Rust side can be a no-op initially while we verify the plumbing works. The actual haptic firing can be enhanced later with a Swift plugin.

**Alternative simpler approach:** Since WKWebView doesn't support `navigator.vibrate()`, and writing a full Swift bridge is complex, consider using the `tauri-plugin-haptics` crate if available, or start with the command plumbing and add the Swift bridge as a follow-up.

**Step 2: Build to verify compilation**

Run: `cd src-tauri && cargo check`
Expected: compiles without errors

**Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add haptic_feedback Tauri command scaffold"
```

---

## Task 4: Haptics — TypeScript Utility

**Files:**
- Create: `src/lib/haptics.ts`

**Step 1: Create the haptics utility**

```ts
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
```

**Step 2: Commit**

```bash
git add src/lib/haptics.ts
git commit -m "feat: add haptics utility with light/medium/heavy"
```

---

## Task 5: Haptics — Wire Up Trigger Points

**Files:**
- Modify: `src/components/workout/SetRow.tsx` (checkbox toggle)
- Modify: `src/components/workout/WorkoutView.tsx` (block advance)
- Modify: `src/hooks/useGoals.ts` (achievement detection)

**Step 1: Add haptic to SetRow checkbox**

In `SetRow.tsx`, import `hapticLight` from `../../lib/haptics`. In the checkbox `onClick`:

```ts
onClick={() => {
  hapticLight()
  onToggleComplete(exerciseId, set.index, set.weight, set.reps)
}}
```

**Step 2: Add haptic to block advance**

In `WorkoutView.tsx`, import `hapticMedium` from `../../lib/haptics`. In the "Start New Block" button `onClick`, call `hapticMedium()` before `onAdvanceBlock()`.

**Step 3: Add haptic to goal achievement**

In `useGoals.ts`, import `hapticMedium` from `../lib/haptics`. In `checkAchievements`, after marking a goal achieved:

```ts
if (achieved.length > 0) {
  hapticMedium()
  await loadGoals()
}
```

**Step 4: Verify visually**

Run: `npm run dev`
Toggle a set checkbox — no crash (haptic silently fails in browser).

**Step 5: Commit**

```bash
git add src/components/workout/SetRow.tsx src/components/workout/WorkoutView.tsx src/hooks/useGoals.ts
git commit -m "feat: wire haptic feedback to set toggle, block advance, goal achievement"
```

---

## Task 6: Export — Data Queries

**Files:**
- Create: `src/lib/export.ts`

**Step 1: Implement export functions**

```ts
import { getDb } from './db'
import { estimatedOneRepMax } from './calc'

interface CsvSetRow {
  started_at: string
  block_num: number
  week_index: number
  day_subtitle: string
  exercise_name: string
  set_index: number
  weight: number
  reps: number
}

interface JsonWorkoutRow {
  id: string
  block_num: number
  week_index: number
  day_subtitle: string
  started_at: string
}

interface JsonSetRow {
  workout_log_id: string
  exercise_name: string
  set_index: number
  weight: number
  reps: number
  is_completed: number
}

interface TmExportRow {
  exercise_name: string
  value: number
  block_num: number
  source: string
  created_at: string
}

interface NoteExportRow {
  exercise_name: string | null
  note: string
  created_at: string
}

interface GoalExportRow {
  exercise_name: string
  goal_type: string
  target_value: number
  deadline: string | null
  achieved_at: string | null
}

interface SettingRow {
  key: string
  value: string
}

export async function buildCsvString(programId: string): Promise<string> {
  const db = await getDb()
  const rows = await db.select<CsvSetRow[]>(
    `SELECT wl.started_at, wl.block_num, wl.week_index,
            d.subtitle as day_subtitle, e.name as exercise_name,
            sl.set_index, sl.weight, sl.reps
     FROM set_logs sl
     JOIN workout_logs wl ON sl.workout_log_id = wl.id
     JOIN exercises e ON sl.exercise_id = e.id
     JOIN days d ON e.day_id = d.id
     WHERE wl.program_id = ? AND sl.is_completed = 1
       AND sl.weight IS NOT NULL AND sl.reps IS NOT NULL
     ORDER BY wl.block_num, wl.week_index, d.day_index, e.exercise_index, sl.set_index`,
    [programId],
  )

  const header = 'date,block,week,day,exercise,set,weight,reps,e1rm'
  const lines = rows.map((r) => {
    const date = r.started_at.split('T')[0] ?? r.started_at.split(' ')[0]
    const e1rm = estimatedOneRepMax(r.weight, r.reps)
    const escapedDay = r.day_subtitle.includes(',') ? `"${r.day_subtitle}"` : r.day_subtitle
    const escapedName = r.exercise_name.includes(',') ? `"${r.exercise_name}"` : r.exercise_name
    return `${date},${r.block_num},${r.week_index + 1},${escapedDay},${escapedName},${r.set_index + 1},${r.weight},${r.reps},${e1rm}`
  })

  return [header, ...lines].join('\n')
}

export async function buildJsonBackup(programId: string): Promise<string> {
  const db = await getDb()

  // Workouts + sets
  const workouts = await db.select<JsonWorkoutRow[]>(
    `SELECT wl.id, wl.block_num, wl.week_index, d.subtitle as day_subtitle, wl.started_at
     FROM workout_logs wl
     JOIN days d ON wl.day_id = d.id
     WHERE wl.program_id = ?
     ORDER BY wl.block_num, wl.week_index`,
    [programId],
  )

  const sets = await db.select<JsonSetRow[]>(
    `SELECT sl.workout_log_id, e.name as exercise_name, sl.set_index, sl.weight, sl.reps, sl.is_completed
     FROM set_logs sl
     JOIN exercises e ON sl.exercise_id = e.id
     JOIN workout_logs wl ON sl.workout_log_id = wl.id
     WHERE wl.program_id = ?
     ORDER BY sl.set_index`,
    [programId],
  )

  const setsByWorkout = new Map<string, typeof sets>()
  for (const s of sets) {
    const arr = setsByWorkout.get(s.workout_log_id) ?? []
    arr.push(s)
    setsByWorkout.set(s.workout_log_id, arr)
  }

  // Training maxes
  const tms = await db.select<TmExportRow[]>(
    `SELECT e.name as exercise_name, tm.value, tm.block_num, tm.source, tm.created_at
     FROM training_maxes tm
     JOIN exercises e ON tm.exercise_id = e.id
     JOIN days d ON e.day_id = d.id
     WHERE d.program_id = ?
     ORDER BY tm.created_at`,
    [programId],
  )

  // Notes
  const notes = await db.select<NoteExportRow[]>(
    `SELECT e.name as exercise_name, en.note, en.created_at
     FROM exercise_notes en
     LEFT JOIN exercises e ON en.exercise_id = e.id
     JOIN workout_logs wl ON en.workout_log_id = wl.id
     WHERE wl.program_id = ?
     ORDER BY en.created_at`,
    [programId],
  )

  // Goals
  const goals = await db.select<GoalExportRow[]>(
    `SELECT e.name as exercise_name, sg.goal_type, sg.target_value, sg.deadline, sg.achieved_at
     FROM strength_goals sg
     JOIN exercises e ON sg.exercise_id = e.id
     JOIN days d ON e.day_id = d.id
     WHERE d.program_id = ?`,
    [programId],
  )

  // Settings
  const settingsRows = await db.select<SettingRow[]>(`SELECT key, value FROM user_settings`)
  const settings: Record<string, string> = {}
  for (const r of settingsRows) settings[r.key] = r.value

  const backup = {
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    workouts: workouts.map((w) => ({
      block: w.block_num,
      week: w.week_index,
      day: w.day_subtitle,
      startedAt: w.started_at,
      sets: (setsByWorkout.get(w.id) ?? []).map((s) => ({
        exercise: s.exercise_name,
        set: s.set_index + 1,
        weight: s.weight,
        reps: s.reps,
        completed: !!s.is_completed,
      })),
    })),
    trainingMaxes: tms.map((t) => ({
      exercise: t.exercise_name,
      value: t.value,
      block: t.block_num,
      source: t.source,
      createdAt: t.created_at,
    })),
    notes: notes.map((n) => ({
      exercise: n.exercise_name ?? '(workout)',
      note: n.note,
      createdAt: n.created_at,
    })),
    goals: goals.map((g) => ({
      exercise: g.exercise_name,
      type: g.goal_type,
      target: g.target_value,
      deadline: g.deadline,
      achievedAt: g.achieved_at,
    })),
    settings,
  }

  return JSON.stringify(backup, null, 2)
}

export async function shareFile(content: string, filename: string, mimeType: string): Promise<void> {
  const blob = new Blob([content], { type: mimeType })
  const file = new File([blob], filename, { type: mimeType })

  if (navigator.share && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file] })
  } else {
    // Fallback: download via anchor
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/export.ts
git commit -m "feat: add CSV and JSON export data builders with share"
```

---

## Task 7: Export — Settings UI

**Files:**
- Modify: `src/components/settings/SettingsPage.tsx`

**Step 1: Wire export buttons**

Import the export functions at the top of `SettingsPage.tsx`:

```ts
import { buildCsvString, buildJsonBackup, shareFile } from '../../lib/export'
```

The component needs `programId`. Add it as a prop:

```ts
interface SettingsPageProps {
  onClose: () => void
  programId: string
}
```

Add state for export loading:

```ts
const [exportingCsv, setExportingCsv] = useState(false)
const [exportingJson, setExportingJson] = useState(false)
```

Add handlers:

```ts
async function handleExportCsv() {
  setExportingCsv(true)
  try {
    const csv = await buildCsvString(programId)
    const date = new Date().toISOString().split('T')[0]
    await shareFile(csv, `forge-export-${date}.csv`, 'text/csv')
  } catch {
    // User cancelled share sheet — no error needed
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
    // User cancelled share sheet — no error needed
  }
  setExportingJson(false)
}
```

Replace the two "Coming soon" `<SettingRow>` elements:

```tsx
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
```

**Step 2: Thread programId to SettingsPage**

Find where `SettingsPage` is rendered (in the main App component or WorkoutView parent) and pass `programId` as a prop.

**Step 3: Verify visually**

Run: `npm run dev`
Open Settings → Data section. Verify export buttons appear and are clickable.

**Step 4: Commit**

```bash
git add src/components/settings/SettingsPage.tsx
git commit -m "feat: wire export CSV and JSON buttons in settings"
```

---

## Task 8: Rest Timer — Settings Store

**Files:**
- Modify: `src/store/settingsStore.ts`
- Modify: `src/store/settingsStore.test.ts`

**Step 1: Write failing test**

Add to `settingsStore.test.ts`:

```ts
it('parses rest_timer_seconds with default 90', () => {
  expect(parseSettings({}).restTimerSeconds).toBe(90)
})

it('parses rest_timer_seconds from raw', () => {
  expect(parseSettings({ rest_timer_seconds: '120' }).restTimerSeconds).toBe(120)
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/store/settingsStore.test.ts`
Expected: FAIL — `restTimerSeconds` not in type

**Step 3: Add rest_timer_seconds to settingsStore.ts**

Add `'rest_timer_seconds'` to the `SettingsKey` union type.

Add to `SETTINGS_DEFAULTS`:
```ts
rest_timer_seconds: '90',
```

Add to `ParsedSettings` interface:
```ts
restTimerSeconds: number
```

Add to `parseSettings` return:
```ts
restTimerSeconds: parseInt(get('rest_timer_seconds'), 10) || 90,
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/store/settingsStore.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/store/settingsStore.ts src/store/settingsStore.test.ts
git commit -m "feat: add rest_timer_seconds setting (default 90s)"
```

---

## Task 9: Rest Timer — Component

**Files:**
- Create: `src/components/workout/RestTimer.tsx`

**Step 1: Implement the RestTimer component**

```tsx
import { useState, useRef, useCallback, useEffect } from 'react'
import { hapticMedium } from '../../lib/haptics'

interface RestTimerProps {
  durationSeconds: number
}

type TimerState = 'idle' | 'running' | 'done'

export function RestTimer({ durationSeconds }: RestTimerProps) {
  const [state, setState] = useState<TimerState>('idle')
  const [remaining, setRemaining] = useState(durationSeconds)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef(0)
  const durationRef = useRef(durationSeconds)

  // Keep duration ref in sync
  useEffect(() => {
    durationRef.current = durationSeconds
    if (state === 'idle') setRemaining(durationSeconds)
  }, [durationSeconds, state])

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    stop()
    const dur = durationRef.current
    startTimeRef.current = Date.now()
    setRemaining(dur)
    setState('running')

    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      const left = Math.max(0, dur - elapsed)
      setRemaining(Math.ceil(left))

      if (left <= 0) {
        stop()
        setState('done')
        hapticMedium()
        setTimeout(() => setState('idle'), 3000)
      }
    }, 250)
  }, [stop])

  const handleTap = useCallback(() => {
    if (state === 'idle' || state === 'done') {
      start()
    } else {
      stop()
      setState('idle')
    }
  }, [state, start, stop])

  // Cleanup on unmount
  useEffect(() => stop, [stop])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`
  const progress = state === 'running' ? remaining / durationRef.current : state === 'done' ? 0 : 1

  if (state === 'idle') {
    return (
      <button
        onClick={handleTap}
        className="fixed right-4 bottom-[calc(70px+env(safe-area-inset-bottom))] z-[150] w-12 h-12 rounded-full bg-card border border-border-elevated flex items-center justify-center cursor-pointer active:border-accent"
      >
        <svg className="w-5 h-5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>
    )
  }

  const radius = 20
  const circumference = 2 * Math.PI * radius
  const strokeOffset = circumference * (1 - progress)

  return (
    <button
      onClick={handleTap}
      className={`fixed right-4 bottom-[calc(70px+env(safe-area-inset-bottom))] z-[150] flex items-center gap-2 px-3 h-12 rounded-full border cursor-pointer transition-colors ${
        state === 'done'
          ? 'bg-success/20 border-success animate-pulse'
          : 'bg-card border-accent'
      }`}
    >
      <svg width="28" height="28" viewBox="0 0 44 44" className="shrink-0">
        <circle cx="22" cy="22" r={radius} fill="none" stroke="#21262d" strokeWidth="3" />
        <circle
          cx="22" cy="22" r={radius}
          fill="none"
          stroke={state === 'done' ? '#2ea043' : '#f5a623'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeOffset}
          transform="rotate(-90 22 22)"
          className="transition-[stroke-dashoffset] duration-200"
        />
      </svg>
      <span className={`text-[17px] font-mono font-bold ${
        state === 'done' ? 'text-success' : 'text-accent'
      }`}>
        {state === 'done' ? 'Done' : timeStr}
      </span>
    </button>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/workout/RestTimer.tsx
git commit -m "feat: add RestTimer floating component with countdown"
```

---

## Task 10: Rest Timer — Integration

**Files:**
- Modify: `src/components/workout/WorkoutView.tsx`
- Modify: `src/components/settings/SettingsPage.tsx`

**Step 1: Add RestTimer to WorkoutView**

Import and render `RestTimer` inside `WorkoutView`, after the closing `</>`:

Actually, since WorkoutView returns a fragment, add `RestTimer` as the last child inside the fragment:

```tsx
import { RestTimer } from './RestTimer'
// ... inside the component, get settings:
import { useSettings } from '../../hooks/useSettings'
// ... destructure:
const { settings } = useSettings()
// ... add before the closing </>:
<RestTimer durationSeconds={settings.restTimerSeconds} />
```

**Step 2: Add rest timer duration picker to Settings**

In `SettingsPage.tsx`, add after the "Haptic Feedback" row and before "Auto-advance Week":

```tsx
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
```

**Step 3: Verify visually**

Run: `npm run dev`
Navigate to Workout tab. Verify floating timer button appears bottom-right. Tap to start countdown. Verify it counts down, shows done state, and resets.

**Step 4: Commit**

```bash
git add src/components/workout/WorkoutView.tsx src/components/settings/SettingsPage.tsx
git commit -m "feat: integrate rest timer in workout view with settings picker"
```

---

## Task 11: Body Weight — Migration

**Files:**
- Create: `src-tauri/migrations/003_body_weight_log.sql`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Create migration file**

```sql
CREATE TABLE IF NOT EXISTS body_weight_log (
  id TEXT PRIMARY KEY,
  weight REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT 'lb',
  logged_at TEXT NOT NULL DEFAULT (date('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bw_log_date
  ON body_weight_log (logged_at);
```

**Step 2: Register migration in lib.rs**

Add to the `migrations` vec in `src-tauri/src/lib.rs`:

```rust
Migration {
    version: 3,
    description: "body_weight_log",
    sql: include_str!("../migrations/003_body_weight_log.sql"),
    kind: MigrationKind::Up,
},
```

**Step 3: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: compiles without errors

**Step 4: Commit**

```bash
git add src-tauri/migrations/003_body_weight_log.sql src-tauri/src/lib.rs
git commit -m "feat: add body_weight_log table migration"
```

---

## Task 12: Body Weight — Hook

**Files:**
- Create: `src/hooks/useBodyWeight.ts`

**Step 1: Implement the hook**

```ts
import { useState, useCallback, useEffect, useRef } from 'react'
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

      // Check if entry exists for today
      const existing = await db.select<BwRow[]>(
        `SELECT id FROM body_weight_log WHERE logged_at = ?`,
        [today],
      )

      if (existing.length > 0) {
        await db.execute(
          `UPDATE body_weight_log SET weight = ?, unit = ? WHERE logged_at = ?`,
          [weight, unit, today],
        )
      } else {
        await db.execute(
          `INSERT INTO body_weight_log (id, weight, unit, logged_at) VALUES (?, ?, ?, ?)`,
          [uuid(), weight, unit, today],
        )
      }

      // Also update the user_settings body_weight (stored in lb)
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

  return {
    history,
    latest: history.length > 0 ? history[0] : null,
    loading,
    logWeight,
    reload: loadHistory,
  }
}
```

**Step 2: Commit**

```bash
git add src/hooks/useBodyWeight.ts
git commit -m "feat: add useBodyWeight hook with log and history"
```

---

## Task 13: Body Weight — Settings Entry Point

**Files:**
- Modify: `src/components/settings/SettingsPage.tsx`

**Step 1: Add body weight logging modal**

Import `useBodyWeight` at the top. Add state for the BW log modal:

```ts
const { history: bwHistory, logWeight } = useBodyWeight()
const [showBwLog, setShowBwLog] = useState(false)
const [bwLogValue, setBwLogValue] = useState('')
```

Replace the existing Body Weight `<SettingRow>` with one that opens a modal when tapped:

```tsx
<SettingRow label="Body Weight" last>
  <button
    onClick={() => {
      setBwLogValue(settings.bodyWeight > 0 ? displayWeight(settings.bodyWeight) : '')
      setShowBwLog(true)
    }}
    className="bg-transparent border border-border-elevated rounded text-accent px-2.5 py-1.5 min-h-[44px] text-[16px] cursor-pointer font-mono"
  >
    {settings.bodyWeight > 0 ? `${displayWeight(settings.bodyWeight)} ${unitLabel}` : 'Not set'}
  </button>
</SettingRow>
```

Add a modal (before the `AnimatePresence` for resetConfirm):

```tsx
<AnimatePresence>
  {showBwLog && (
    <motion.div
      className="fixed inset-0 bg-black/60 z-[300] flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => setShowBwLog(false)}
    >
      <motion.div
        className="bg-card w-full max-w-md rounded-t-2xl p-4 pb-[calc(16px+env(safe-area-inset-bottom))]"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[17px] font-bold text-bright mb-3">Log Body Weight</div>
        <div className="flex gap-2 mb-4">
          <input
            type="number"
            inputMode="decimal"
            value={bwLogValue}
            onChange={(e) => setBwLogValue(e.target.value)}
            placeholder={unitLabel}
            className="flex-1 bg-bg border border-border-elevated rounded-lg text-accent px-3 py-2.5 text-[18px] font-mono"
            autoFocus
          />
          <button
            onClick={async () => {
              const num = parseFloat(bwLogValue)
              if (!Number.isFinite(num) || num <= 0) return
              await logWeight(num, settings.unitSystem)
              setShowBwLog(false)
            }}
            className="bg-accent border-none rounded-lg text-bg px-4 py-2.5 text-[16px] font-semibold cursor-pointer min-h-[44px]"
          >
            Log
          </button>
        </div>
        {bwHistory.slice(0, 5).length > 0 && (
          <div>
            <div className="text-[12px] text-muted uppercase tracking-wide mb-2">Recent</div>
            {bwHistory.slice(0, 5).map((entry) => (
              <div key={entry.id} className="flex justify-between py-1.5 text-[15px]">
                <span className="text-dim">{entry.loggedAt}</span>
                <span className="text-text font-mono">{entry.weight} {entry.unit}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

Remove the old `editingBodyWeight` state and inline edit logic since the modal replaces it.

**Step 2: Verify visually**

Run: `npm run dev`
Open Settings → tap Body Weight → modal slides up with input and recent entries.

**Step 3: Commit**

```bash
git add src/components/settings/SettingsPage.tsx
git commit -m "feat: add body weight logging modal in settings"
```

---

## Task 14: Body Weight — History Chart

**Files:**
- Modify: `src/components/history/HistoryView.tsx`
- Modify: `src/hooks/useBodyWeight.ts` (add chart-ready data)

**Step 1: Add chart data to useBodyWeight**

Add a `chartData` computed property to the hook that returns entries in chronological order with a rolling 7-day average:

```ts
// Add inside useBodyWeight, after history state:
const chartData = useMemo(() => {
  const chronological = [...history].reverse()
  return chronological.map((entry, i) => {
    const start = Math.max(0, i - 6)
    const window = chronological.slice(start, i + 1)
    const avg = window.reduce((sum, e) => sum + e.weight, 0) / window.length
    return {
      label: entry.loggedAt,
      weight: entry.weight,
      rollingAvg: Math.round(avg * 10) / 10,
    }
  })
}, [history])

const bwStats = useMemo(() => {
  if (history.length === 0) return null
  const weights = history.map((e) => e.weight)
  const current = weights[0]
  const heaviest = Math.max(...weights)
  const lightest = Math.min(...weights)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const dateStr = thirtyDaysAgo.toISOString().split('T')[0]
  const olderEntries = history.filter((e) => e.loggedAt <= dateStr!)
  const change30d = olderEntries.length > 0 ? current - olderEntries[0].weight : 0
  return { current, heaviest, lightest, change30d }
}, [history])
```

Import `useMemo` and return `chartData` and `bwStats` from the hook.

**Step 2: Add "Body Weight" option to HistoryView**

In `HistoryView.tsx`:
- Import `useBodyWeight` hook
- Add a `showBodyWeight` state flag
- Add a "BW" button alongside the main lift buttons
- When selected, render a Recharts `LineChart` using the same `E1rmChart` pattern but with BW data
- Show stat cards for current/heaviest/lightest/30d change

Add a "BW" button in the main lift tabs area:

```tsx
<button
  onClick={() => {
    setShowOverlay(false)
    setShowBodyWeight(true)
  }}
  className={`px-2.5 py-1 rounded-md text-[17px] border-none cursor-pointer transition-colors ${
    showBodyWeight ? 'bg-accent text-bg font-bold' : 'bg-border text-muted hover:text-bright active:text-bright'
  }`}
>
  BW
</button>
```

When `showBodyWeight` is true, render:

```tsx
{!loading && showBodyWeight && bwChartData.length > 0 && (
  <>
    {bwStats && (
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="text-[11px] text-muted uppercase">Current</div>
          <div className="text-[20px] font-bold text-bright font-mono">{bwStats.current}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="text-[11px] text-muted uppercase">30d Change</div>
          <div className={`text-[20px] font-bold font-mono ${bwStats.change30d > 0 ? 'text-danger' : bwStats.change30d < 0 ? 'text-success' : 'text-muted'}`}>
            {bwStats.change30d > 0 ? '+' : ''}{bwStats.change30d}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="text-[11px] text-muted uppercase">Heaviest</div>
          <div className="text-[20px] font-bold text-bright font-mono">{bwStats.heaviest}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="text-[11px] text-muted uppercase">Lightest</div>
          <div className="text-[20px] font-bold text-bright font-mono">{bwStats.lightest}</div>
        </div>
      </div>
    )}
    <div className="bg-card border border-border rounded-lg p-3 mb-4">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={bwChartData}>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8b949e' }} />
          <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{ fontSize: 10, fill: '#8b949e' }} />
          <Line type="monotone" dataKey="weight" stroke="#f5a623" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="rollingAvg" stroke="#636e72" dot={false} strokeWidth={1} strokeDasharray="4 4" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </>
)}
```

Import `LineChart`, `Line`, `XAxis`, `YAxis`, `ResponsiveContainer` from `recharts`.

Clear `showBodyWeight` when selecting an exercise or "All Lifts".

**Step 3: Verify visually**

Run: `npm run dev`
Navigate to History → tap "BW" button → should show chart and stats (empty state if no data).

**Step 4: Commit**

```bash
git add src/hooks/useBodyWeight.ts src/components/history/HistoryView.tsx
git commit -m "feat: add body weight trend chart to history view"
```

---

## Task 15: Final Integration Test

**Step 1: Run full test suite**

Run: `npm test`
Expected: ALL PASS

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

**Step 3: Verify Rust compilation**

Run: `cd src-tauri && cargo check`
Expected: No errors

**Step 4: Commit any remaining fixes**

If any tests or build issues are found, fix them and commit:

```bash
git add -A
git commit -m "fix: resolve build/test issues from feature integration"
```
