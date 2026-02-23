# Settings Redesign — Design Doc

## Problem

The gear icon currently opens a workout-specific control panel (week selector, training max editor, advance block). This mixes workout controls with what users expect from "Settings." There are no app-wide preferences — no unit toggle, no data export, no customization. The `user_settings` table exists in the DB but is unused.

## Decision Summary

- **Replace** the current SettingsPanel with a true app-wide Settings page
- **Relocate** week/TM/advance controls to a collapsible section in the workout view header
- **Use** the existing `user_settings` key-value table (no migration needed)
- **Add** body weight tracking with BW-relative strength multiples on Dashboard + History

## Data Layer

### `user_settings` table (existing, no migration)

```sql
CREATE TABLE IF NOT EXISTS user_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### Settings keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `unit_system` | `'lb' \| 'kg'` | `'lb'` | Weight display units |
| `body_weight` | number string | `''` | User body weight (stored in lb internally) |
| `theme` | `'dark' \| 'oled'` | `'dark'` | App theme |
| `haptics_enabled` | `'true' \| 'false'` | `'true'` | Haptic feedback on set completion |
| `auto_advance_week` | `'true' \| 'false'` | `'false'` | Auto-advance week when all sets completed |
| `bar_weight` | number string | `'45'` | Bar weight for plate calculator (in lb) |
| `available_plates` | JSON string | `'[45,35,25,10,5,2.5]'` | Available plate denominations (in lb) |
| `tm_rule_default` | `'e1rm' \| 'fixed' \| 'percent'` | `'e1rm'` | Default TM progression strategy |
| `tm_increment_default` | number string | `'5'` | Default fixed increment (in lb) |

### `useSettings` hook + Zustand store

- Loads all rows from `user_settings` on app init
- Returns a typed `Settings` object with parsed values (booleans, numbers, arrays)
- `setSetting(key, value)` writes to DB and updates Zustand state
- Falls back to defaults for missing keys
- All weight values stored in pounds; conversion to kg happens at display time

### Unit conversion

- `convertWeight(value, from, to)` utility in `lib/calc.ts`
- `roundToNearest(value, increment)` — generalized rounding (2.5 for kg, 5 for lb)
- All DB values remain in pounds; conversion is display-only

### BW multiples

- `bwMultiple(e1rm, bodyWeight)` → `number | null` (null if BW not set)
- Displayed on Dashboard lift cards and History e1RM chart tooltips
- Format: `370 lb (2.0x BW)`

## Settings Page UI

Full-screen scrollable page. Slides up from bottom, covers bottom nav. Single page with section dividers (no sub-pages or tabs).

### Layout

```
┌─────────────────────────────┐
│ ← Settings                  │
├─────────────────────────────┤
│ UNITS                       │
│ ┌─────────────────────────┐ │
│ │ Weight Unit    [lb │ kg]│ │  Segmented control
│ │ Body Weight      185 lb │ │  Editable number
│ └─────────────────────────┘ │
│                             │
│ PROGRESSION                 │
│ ┌─────────────────────────┐ │
│ │ TM Strategy     e1RM  ▾ │ │  Dropdown selector
│ │ Default Increment  5 lb │ │  Number input (visible when strategy = 'fixed')
│ └─────────────────────────┘ │
│                             │
│ PLATE CALCULATOR            │
│ ┌─────────────────────────┐ │
│ │ Bar Weight        45 lb │ │  Editable number
│ │ Available Plates        │ │
│ │ [45][35][25][10][5][2.5]│ │  Toggleable chips
│ └─────────────────────────┘ │
│                             │
│ PREFERENCES                 │
│ ┌─────────────────────────┐ │
│ │ Theme        [Dark│OLED]│ │  Segmented control
│ │ Haptic Feedback    [ON] │ │  Toggle switch
│ │ Auto-advance Week  [OFF]│ │  Toggle switch
│ └─────────────────────────┘ │
│                             │
│ DATA                        │
│ ┌─────────────────────────┐ │
│ │ Export History     CSV ▸ │ │  Share sheet
│ │ Export History    JSON ▸ │ │  Share sheet
│ │─────────────────────────│ │
│ │ Reset All Data     ⚠️    │ │  Danger with confirm
│ └─────────────────────────┘ │
│                             │
│ ABOUT                       │
│ ┌─────────────────────────┐ │
│ │ Version          1.0.0  │ │
│ │ Build              42   │ │
│ │ Send Feedback        ▸  │ │
│ └─────────────────────────┘ │
│                             │
│        Made with Forge      │
└─────────────────────────────┘
```

### Styling

- Section headers: `text-[12px] uppercase tracking-wide text-muted font-semibold px-4 pt-6 pb-2`
- Section cards: `bg-card rounded-xl border border-border mx-4`
- Rows: `px-4 py-3 flex justify-between items-center min-h-[48px]`, separated by `border-b border-border`
- Segmented controls: accent-colored selected state (matches existing week selector)
- Toggle switches: custom CSS, accent when on, border-elevated when off
- Danger zone: `text-danger` for reset button

## Collapsible Workout Controls

Replaces the current SettingsPanel for week/TM/advance. Lives inline in the workout view.

### Collapsed state

A thin bar below the workout header:
```
│ ▼ Week 1 (5s) · Block 2    │
```
Shows current week label and block number. Tap to expand.

### Expanded state

```
│ ▲ Week 1 (5s) · Block 2    │
├─────────────────────────────┤
│ [W1] [W2] [W3] [DL]        │  Week pills
│                             │
│ Training Maxes              │
│ Back Squat          315 lb  │  Tap to edit inline
│ Bench Press         225 lb  │
│ Deadlift            405 lb  │
│ OHP                 155 lb  │
│                             │
│ [ Advance to Week 2 →     ] │
```

### Behavior

- Starts collapsed by default
- Tap the bar to toggle
- Week selector, TM editing, and advance block logic are identical to current implementation
- Gear icon in the workout header now navigates to the Settings page

## Files Affected

### New files
- `src/hooks/useSettings.ts` — settings hook + Zustand store
- `src/components/settings/SettingsPage.tsx` — full settings page
- `src/components/workout/WorkoutControls.tsx` — collapsible week/TM/advance

### Modified files
- `src/lib/calc.ts` — add `convertWeight()`, `roundToNearest()`, `bwMultiple()`
- `src/components/workout/WorkoutView.tsx` — replace gear icon behavior, add collapsible controls
- `src/App.tsx` — remove old SettingsPanel rendering, add Settings page routing
- `src/components/settings/SettingsPanel.tsx` — delete (replaced)
- `src/components/layout/Dashboard.tsx` — add BW multiples to lift cards
- `src/hooks/useHistory.ts` — add BW multiples to e1RM chart data

## Out of Scope

- Per-exercise TM progression rules (v2 — start with a global default)
- Rest timer (decided against for v1)
- Wilks/strength standards rating system
- Body weight history tracking over time (just current weight for now)
