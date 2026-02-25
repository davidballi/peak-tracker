# Ship Polish + Engagement Features — Design

**Date:** 2026-02-24
**Scope:** 5 features across 2 phases
**Priority order:** Haptics → Export → Rest Timer → Plate Calculator → Body Weight Tracking

---

## Data Model

### New Migration: `003_body_weight_log.sql`

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

- One entry per date (unique index on `logged_at`, date only)
- Stores unit at time of logging for historical accuracy
- No FK to programs — body weight is global
- Logging also updates `user_settings.body_weight` for dashboard BW multiples

### New Settings Keys

| Key | Default | Used By |
|-----|---------|---------|
| `rest_timer_seconds` | `'90'` | Rest Timer |

All other features use existing settings (`haptics_enabled`, `bar_weight`, `available_plates`, `body_weight`).

### Rust Migration Entry

```rust
Migration {
    version: 3,
    description: "body_weight_log",
    sql: include_str!("../migrations/003_body_weight_log.sql"),
    kind: MigrationKind::Up,
},
```

---

## Phase A: Ship Polish

### 1. Haptics

**Goal:** Wire up the existing `haptics_enabled` setting to actual haptic feedback.

**Approach:** Tauri command bridging to iOS `UIImpactFeedbackGenerator`.

**New files:**
- `src/lib/haptics.ts` — `hapticLight()`, `hapticMedium()`, `hapticHeavy()` functions
- Rust command `haptic_feedback(style: String)` in `lib.rs` with `#[cfg(target_os = "ios")]`

**Behavior:**
- Each function checks `settingsStore.hapticsEnabled` before firing
- Falls back silently in web dev mode (no Tauri invoke available)

**Trigger points:**
| Action | Intensity |
|--------|-----------|
| SetRow checkbox toggle | Light |
| Block advance confirmation | Medium |
| Goal achieved toast | Medium |

**No new UI** — setting toggle already exists in SettingsPage.

---

### 2. Export (CSV + JSON)

**Goal:** Replace "Coming soon" stubs with working export via native share sheet.

**Approach:** Build export data in JS, use Web Share API (`navigator.share({ files })`) for native iOS share sheet. Supported in WKWebView on iOS 15+.

**New file:** `src/lib/export.ts`

**CSV format** — flat, one row per completed set:
```
date,block,week,day,exercise,set,weight,reps,e1rm
2025-12-01,1,0,Day 1,Bench Press,S1,225,5,262
```
- Query: `set_logs JOIN workout_logs JOIN days JOIN exercises`
- Only completed sets (`is_completed = 1`)
- Filename: `forge-export-YYYY-MM-DD.csv`

**JSON format** — structured backup:
```json
{
  "exportedAt": "2025-12-01T00:00:00Z",
  "version": "1.0.0",
  "workouts": [
    {
      "block": 1, "week": 0, "day": "Upper A",
      "startedAt": "...",
      "sets": [{ "exercise": "Bench Press", "set": 1, "weight": 225, "reps": 5 }]
    }
  ],
  "trainingMaxes": [{ "exercise": "Bench Press", "value": 275, "block": 1, "source": "e1rm" }],
  "notes": [{ "exercise": "Bench Press", "note": "...", "createdAt": "..." }],
  "goals": [{ "exercise": "Bench Press", "type": "e1rm", "target": 315 }],
  "settings": { "unitSystem": "lb", "bodyWeight": 185 }
}
```
- Filename: `forge-backup-YYYY-MM-DD.json`
- Can later be used for import/restore

**UI changes in SettingsPage:**
- Replace "Coming soon" spans with tap-able buttons
- Brief loading state while query runs
- Error toast if share fails (e.g., user cancels)

---

## Phase B: Engagement

### 3. Rest Timer (Manual)

**Goal:** Floating timer button in WorkoutView for timing rest between sets.

**New files:**
- `src/components/workout/RestTimer.tsx`

**New settings:**
- `rest_timer_seconds` in `settingsStore.ts` (default: 90)
- New row in SettingsPage under Preferences: preset pills for 60 / 90 / 120 / 180s

**States:**

| State | Appearance | Tap action |
|-------|-----------|------------|
| Idle | 48x48 circle, accent border, clock icon | Start countdown |
| Running | Expanded pill with MM:SS + circular SVG progress ring | Cancel → idle |
| Done | Pulses green, haptic fires | Auto-returns to idle after 3s |

**Position:** Fixed, `bottom-[calc(70px+env(safe-area-inset-bottom))] right-4` — above BottomNav, out of the way.

**Implementation details:**
- `useState` for timer state (idle/running/done)
- `useRef` for interval ID
- Stores `startTime` + `duration`, computes remaining via `Date.now()` diff (resilient to re-renders)
- On done: calls `hapticMedium()` if haptics enabled
- No auto-start on set completion (manual only)
- Timer survives day tab switches (lives in WorkoutView, not ExerciseCard)

---

### 4. Plate Calculator

**Goal:** Show plate loading breakdown inline on SetRow.

**New function in `src/lib/calc.ts`:**
```ts
export function calculatePlates(
  targetWeight: number,
  barWeight: number,
  availablePlates: number[],
): number[]  // plates per side, e.g. [45, 25, 5]
```

**Algorithm:** Greedy selection.
1. `perSide = (targetWeight - barWeight) / 2`
2. For each plate size (descending), take `floor(perSide / plate)` of that plate
3. Subtract used weight from remaining
4. If `targetWeight <= barWeight`, return empty array

**Display in SetRow:**
- Small line below the weight input, only when weight > barWeight
- Compact plate pills: `[45] [25] [5]` with "per side" label
- Styled: `text-[11px] text-faint`, rounded mini-badges
- Only shown for rows with a non-null weight value
- Reads `barWeight` and `availablePlates` from settings store

**Edge case:** If weight doesn't divide evenly with available plates, show the closest loadable weight with a subtle "(~)" indicator.

---

### 5. Body Weight Tracking

**Goal:** Track body weight over time with trend visualization.

**New files:**
- `src/hooks/useBodyWeight.ts` — `logWeight()`, `getHistory()`, `getLatest()`

**Hook API:**
```ts
interface BodyWeightEntry { id: string; weight: number; unit: string; loggedAt: string }

function useBodyWeight(): {
  history: BodyWeightEntry[]
  latest: BodyWeightEntry | null
  loading: boolean
  logWeight: (weight: number, unit: UnitSystem) => Promise<void>
}
```

**`logWeight` behavior:**
1. INSERT OR REPLACE into `body_weight_log` (unique on date)
2. Also update `user_settings.body_weight` so dashboard BW multiples refresh immediately

**Settings entry point:**
- Current Body Weight row in SettingsPage becomes a tap target opening a small modal
- Modal shows: current weight input, "Log" button, last 5 entries as a mini list
- Quick-edit inline behavior preserved for users who just want to set it once

**History integration:**
- New "Body Weight" option in HistoryView exercise selector (alongside Bench/Squat/Deadlift/OHP/All Lifts)
- When selected, shows:
  - **Line chart** of weight over time with 7-day rolling average overlay (same Recharts pattern as E1rmChart)
  - **Stat cards:** Current, Heaviest, Lightest, 30-day change
- No set log list (not applicable)

**Dashboard:** Existing BW multiple display reads from `bodyWeight` setting — updates automatically when new weight is logged.

---

## File Summary

### New Files
| File | Feature |
|------|---------|
| `src-tauri/migrations/003_body_weight_log.sql` | Body Weight |
| `src/lib/haptics.ts` | Haptics |
| `src/lib/export.ts` | Export |
| `src/components/workout/RestTimer.tsx` | Rest Timer |
| `src/hooks/useBodyWeight.ts` | Body Weight |

### Modified Files
| File | Changes |
|------|---------|
| `src-tauri/src/lib.rs` | Migration v3, haptic_feedback command |
| `src-tauri/Cargo.toml` | (possibly tauri-plugin for haptics if needed) |
| `src-tauri/capabilities/default.json` | Permissions for new commands |
| `src/store/settingsStore.ts` | Add `rest_timer_seconds` key + parsed field |
| `src/components/settings/SettingsPage.tsx` | Export buttons, rest timer duration, BW modal |
| `src/components/workout/SetRow.tsx` | Plate calculator display |
| `src/components/workout/WorkoutView.tsx` | RestTimer component |
| `src/components/history/HistoryView.tsx` | BW chart option |
| `src/lib/calc.ts` | `calculatePlates()` function |
