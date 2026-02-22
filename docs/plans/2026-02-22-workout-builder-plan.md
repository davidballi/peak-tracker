# Workout Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a 4-step wizard that lets users build custom workout programs by choosing a goal, schedule, reviewing auto-generated exercises, and confirming.

**Architecture:** Pure TypeScript exercise library + program generator feeds an in-memory program structure through a 4-step wizard UI. On confirm, a single `withWriteLock()` transaction writes the program to the existing SQLite tables. No schema changes needed.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Framer Motion, Zustand, SQLite via tauri-plugin-sql, uuid v4

---

### Task 1: Exercise Library

**Files:**
- Create: `src/lib/exercise-library.ts`

**Step 1: Create the exercise library with types and catalog**

The library is a flat array of ~40 exercises organized by movement pattern. Each exercise has a `key` that matches `exerciseKey` in the DB for history cross-referencing. The `key` is generated as `name.toLowerCase().replace(/[^a-z0-9]/g, '_')` — same logic as `ProgramBuilder.tsx:150`.

```typescript
// src/lib/exercise-library.ts
import type { ExerciseCategory } from '../types/program'

export interface LibraryExercise {
  key: string
  name: string
  category: ExerciseCategory
  defaultSets: number
  defaultReps: number
  defaultWeight: number
  waveEligible: boolean
  muscles: string[]  // for split matching: 'chest', 'back', 'shoulders', 'legs', 'arms', 'core'
}

export const EXERCISE_LIBRARY: LibraryExercise[] = [
  // Main Compounds (waveEligible)
  { key: 'back_squat', name: 'Back Squat', category: 'absolute', defaultSets: 3, defaultReps: 5, defaultWeight: 135, waveEligible: true, muscles: ['legs'] },
  { key: 'bench_press', name: 'Bench Press', category: 'absolute', defaultSets: 3, defaultReps: 5, defaultWeight: 135, waveEligible: true, muscles: ['chest'] },
  { key: 'deadlift', name: 'Deadlift', category: 'absolute', defaultSets: 3, defaultReps: 5, defaultWeight: 185, waveEligible: true, muscles: ['back', 'legs'] },
  { key: 'overhead_press', name: 'Overhead Press', category: 'absolute', defaultSets: 3, defaultReps: 5, defaultWeight: 95, waveEligible: true, muscles: ['shoulders'] },
  { key: 'front_squat', name: 'Front Squat', category: 'absolute', defaultSets: 3, defaultReps: 5, defaultWeight: 115, waveEligible: true, muscles: ['legs'] },
  { key: 'barbell_row', name: 'Barbell Row', category: 'absolute', defaultSets: 3, defaultReps: 5, defaultWeight: 135, waveEligible: true, muscles: ['back'] },

  // Tech / Coordination
  { key: 'db_snatch', name: 'DB Snatch (each arm)', category: 'tech', defaultSets: 3, defaultReps: 3, defaultWeight: 50, waveEligible: false, muscles: ['legs', 'shoulders'] },
  { key: 'hang_power_clean', name: 'Hang Power Clean', category: 'tech', defaultSets: 3, defaultReps: 3, defaultWeight: 135, waveEligible: false, muscles: ['legs', 'back'] },
  { key: 'push_press', name: 'Push Press', category: 'tech', defaultSets: 3, defaultReps: 3, defaultWeight: 115, waveEligible: false, muscles: ['shoulders', 'legs'] },
  { key: 'box_jump', name: 'Box Jump', category: 'tech', defaultSets: 3, defaultReps: 5, defaultWeight: 0, waveEligible: false, muscles: ['legs'] },
  { key: 'kettlebell_swing', name: 'Kettlebell Swing', category: 'tech', defaultSets: 3, defaultReps: 10, defaultWeight: 53, waveEligible: false, muscles: ['legs', 'back'] },

  // Chest Accessories
  { key: 'incline_db_press', name: 'Incline DB Press', category: 'acc', defaultSets: 3, defaultReps: 10, defaultWeight: 50, waveEligible: false, muscles: ['chest'] },
  { key: 'dips', name: 'Dips', category: 'acc', defaultSets: 3, defaultReps: 10, defaultWeight: 0, waveEligible: false, muscles: ['chest', 'arms'] },
  { key: 'chest_fly', name: 'Chest Fly', category: 'acc', defaultSets: 3, defaultReps: 12, defaultWeight: 30, waveEligible: false, muscles: ['chest'] },
  { key: 'push_up', name: 'Push-Up', category: 'acc', defaultSets: 3, defaultReps: 15, defaultWeight: 0, waveEligible: false, muscles: ['chest'] },

  // Back Accessories
  { key: 'lat_pulldown', name: 'Lat Pulldown', category: 'acc', defaultSets: 3, defaultReps: 10, defaultWeight: 120, waveEligible: false, muscles: ['back'] },
  { key: 'seated_cable_row', name: 'Seated Cable Row', category: 'acc', defaultSets: 3, defaultReps: 10, defaultWeight: 120, waveEligible: false, muscles: ['back'] },
  { key: 'db_row', name: 'DB Row', category: 'acc', defaultSets: 3, defaultReps: 10, defaultWeight: 50, waveEligible: false, muscles: ['back'] },
  { key: 'face_pull', name: 'Face Pull', category: 'acc', defaultSets: 3, defaultReps: 15, defaultWeight: 30, waveEligible: false, muscles: ['back', 'shoulders'] },
  { key: 'chin_up', name: 'Chin-Up', category: 'acc', defaultSets: 3, defaultReps: 8, defaultWeight: 0, waveEligible: false, muscles: ['back', 'arms'] },
  { key: 'pull_up', name: 'Pull-Up', category: 'acc', defaultSets: 3, defaultReps: 8, defaultWeight: 0, waveEligible: false, muscles: ['back'] },

  // Shoulder Accessories
  { key: 'lateral_raise', name: 'Lateral Raise', category: 'acc', defaultSets: 3, defaultReps: 12, defaultWeight: 20, waveEligible: false, muscles: ['shoulders'] },
  { key: 'rear_delt_fly', name: 'Rear Delt Fly', category: 'acc', defaultSets: 3, defaultReps: 12, defaultWeight: 15, waveEligible: false, muscles: ['shoulders'] },

  // Leg Accessories
  { key: 'romanian_deadlift', name: 'Romanian Deadlift', category: 'acc', defaultSets: 3, defaultReps: 8, defaultWeight: 135, waveEligible: false, muscles: ['legs'] },
  { key: 'leg_press', name: 'Leg Press', category: 'acc', defaultSets: 3, defaultReps: 10, defaultWeight: 180, waveEligible: false, muscles: ['legs'] },
  { key: 'leg_extension', name: 'Leg Extension', category: 'acc', defaultSets: 3, defaultReps: 12, defaultWeight: 90, waveEligible: false, muscles: ['legs'] },
  { key: 'leg_curl', name: 'Leg Curl', category: 'acc', defaultSets: 3, defaultReps: 12, defaultWeight: 80, waveEligible: false, muscles: ['legs'] },
  { key: 'bulgarian_split_squat', name: 'Bulgarian Split Squat', category: 'acc', defaultSets: 3, defaultReps: 8, defaultWeight: 40, waveEligible: false, muscles: ['legs'] },
  { key: 'calf_raise', name: 'Calf Raise', category: 'acc', defaultSets: 3, defaultReps: 15, defaultWeight: 135, waveEligible: false, muscles: ['legs'] },
  { key: 'hip_thrust', name: 'Hip Thrust', category: 'acc', defaultSets: 3, defaultReps: 10, defaultWeight: 135, waveEligible: false, muscles: ['legs'] },
  { key: 'walking_lunge', name: 'Walking Lunge', category: 'acc', defaultSets: 3, defaultReps: 10, defaultWeight: 40, waveEligible: false, muscles: ['legs'] },

  // Arm Accessories
  { key: 'barbell_curl', name: 'Barbell Curl', category: 'acc', defaultSets: 3, defaultReps: 10, defaultWeight: 65, waveEligible: false, muscles: ['arms'] },
  { key: 'hammer_curl', name: 'Hammer Curl', category: 'acc', defaultSets: 3, defaultReps: 10, defaultWeight: 30, waveEligible: false, muscles: ['arms'] },
  { key: 'tricep_pushdown', name: 'Tricep Pushdown', category: 'acc', defaultSets: 3, defaultReps: 12, defaultWeight: 50, waveEligible: false, muscles: ['arms'] },
  { key: 'tricep_extension', name: 'Overhead Tricep Extension', category: 'acc', defaultSets: 3, defaultReps: 12, defaultWeight: 50, waveEligible: false, muscles: ['arms'] },
  { key: 'skullcrusher', name: 'Skullcrusher', category: 'acc', defaultSets: 3, defaultReps: 10, defaultWeight: 65, waveEligible: false, muscles: ['arms'] },

  // Core
  { key: 'hanging_leg_raise', name: 'Hanging Leg Raise', category: 'ss', defaultSets: 3, defaultReps: 10, defaultWeight: 0, waveEligible: false, muscles: ['core'] },
  { key: 'ab_wheel_rollout', name: 'Ab Wheel Rollout', category: 'ss', defaultSets: 3, defaultReps: 10, defaultWeight: 0, waveEligible: false, muscles: ['core'] },
  { key: 'plank', name: 'Plank', category: 'ss', defaultSets: 3, defaultReps: 1, defaultWeight: 0, waveEligible: false, muscles: ['core'] },
  { key: 'cable_crunch', name: 'Cable Crunch', category: 'ss', defaultSets: 3, defaultReps: 15, defaultWeight: 60, waveEligible: false, muscles: ['core'] },

  // Carry / Functional
  { key: 'farmers_carry', name: "Farmer's Carry", category: 'acc', defaultSets: 3, defaultReps: 1, defaultWeight: 70, waveEligible: false, muscles: ['legs', 'back', 'arms'] },
]

export function getExercisesByMuscle(muscle: string): LibraryExercise[] {
  return EXERCISE_LIBRARY.filter((e) => e.muscles.includes(muscle))
}

export function getCompounds(): LibraryExercise[] {
  return EXERCISE_LIBRARY.filter((e) => e.waveEligible)
}
```

**Step 2: Commit**

```bash
git add src/lib/exercise-library.ts
git commit -m "feat: add exercise library with ~40 exercises for workout builder"
```

---

### Task 2: Program Generator

**Files:**
- Create: `src/lib/program-generator.ts`

**Step 1: Create the generator with types and split logic**

This is a pure function with no side effects or DB access. It takes a goal and day count and returns an in-memory program structure that the wizard UI will render and allow editing.

```typescript
// src/lib/program-generator.ts
import type { ExerciseCategory } from '../types/program'
import { EXERCISE_LIBRARY, type LibraryExercise } from './exercise-library'

export type Goal = 'strength' | 'hypertrophy' | 'general'

export interface GeneratedExercise {
  name: string
  key: string
  category: ExerciseCategory
  sets: number
  reps: number
  defaultWeight: number
  note: string
  isWave: boolean
  baseMax: number
}

export interface GeneratedDay {
  name: string
  subtitle: string
  focus: string
  exercises: GeneratedExercise[]
}

export interface GeneratedProgram {
  name: string
  days: GeneratedDay[]
}
```

The generator:
1. Looks up the split pattern for the given `dayCount` (2-6)
2. For each day in the split, picks exercises from the library based on the day's muscle focus
3. Applies goal modifiers (sets/reps/wave toggles) to each exercise

Split definitions are hardcoded lookup tables. Each split day definition specifies:
- Day metadata (name, subtitle, focus)
- Which compound(s) to use
- Which accessory muscle groups to fill from

Goal modifiers:
- **Strength**: Compounds get `isWave: true` with `baseMax = defaultWeight * 2` (estimated), accessories get 3-4 sets × 6-8 reps
- **Hypertrophy**: Compounds get `isWave: false`, 4×8-12. More accessories at 3×12-15
- **General Fitness**: Compounds `isWave: false`, 3×8-10. Accessories 3×10-12

The function `generateProgram(goal: Goal, dayCount: number): GeneratedProgram` returns the full structure.

Reference `src/lib/templates.ts` for the exact shape of existing template exercises. Wave exercises use `sets: 0, reps: 0, defaultWeight: 0` since their sets come from the wave config.

Helper function `findExercise(key: string): LibraryExercise` does the lookup from the library.

Split patterns:

- **2 days**: Upper (bench + OHP + back/chest/arm accs) / Lower (squat + deadlift + leg accs)
- **3 days**: Push (bench + OHP + chest/shoulder/tri accs) / Pull (barbell row + deadlift + back/bi accs) / Legs (squat + front squat + leg accs)
- **4 days**:
  - Strength: Squat day / Bench day / Deadlift day / OHP day (each with relevant accessories)
  - Hypertrophy/General: Upper A / Lower A / Upper B / Lower B
- **5 days**: Push / Pull / Legs / Upper / Lower
- **6 days**: Push / Pull / Legs / Push / Pull / Legs (second round with exercise variation)

Each day gets 1-2 compounds + 1 core superset + 3-4 accessories.

**Step 2: Commit**

```bash
git add src/lib/program-generator.ts
git commit -m "feat: add program generator with split patterns and goal modifiers"
```

---

### Task 3: createProgramFromBuilder in seed.ts

**Files:**
- Modify: `src/lib/seed.ts` (add new export at bottom)

**Step 1: Add the save function**

This function takes a `GeneratedProgram` and writes it to the DB. Pattern follows `_forkTemplate` closely but reads from the in-memory structure instead of template tables.

```typescript
// Add to bottom of src/lib/seed.ts

import type { GeneratedProgram } from './program-generator'

export function createProgramFromBuilder(program: GeneratedProgram): Promise<string> {
  return withWriteLock(() => _createProgramFromBuilder(program))
}

async function _createProgramFromBuilder(program: GeneratedProgram): Promise<string> {
  const db = await getDb()
  const programId = uuid()

  // Deactivate all existing programs
  await db.execute(`UPDATE programs SET is_active = 0`)

  // Create program (no source_template_id)
  await db.execute(
    `INSERT INTO programs (id, name, source_template_id, current_day, current_week, block_num, is_active) VALUES (?, ?, NULL, 0, 0, 1, 1)`,
    [programId, program.name],
  )

  for (let di = 0; di < program.days.length; di++) {
    const day = program.days[di]
    const dayId = uuid()
    await db.execute(
      `INSERT INTO days (id, program_id, day_index, name, subtitle, focus) VALUES (?, ?, ?, ?, ?, ?)`,
      [dayId, programId, di, day.name, day.subtitle, day.focus],
    )

    for (let ei = 0; ei < day.exercises.length; ei++) {
      const ex = day.exercises[ei]
      const exerciseId = uuid()
      const exerciseKey = ex.key || ex.name.toLowerCase().replace(/[^a-z0-9]/g, '_')

      await db.execute(
        `INSERT INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [exerciseId, dayId, ei, exerciseKey, ex.name, ex.category, ex.isWave ? 0 : ex.sets, ex.isWave ? 0 : ex.reps, ex.isWave ? 0 : ex.defaultWeight, ex.note, ex.isWave ? 1 : 0],
      )

      if (ex.isWave && ex.baseMax > 0) {
        const wcId = uuid()
        await db.execute(
          `INSERT INTO wave_configs (id, exercise_id, base_max) VALUES (?, ?, ?)`,
          [wcId, exerciseId, ex.baseMax],
        )

        // Reuse insertDefaultWaveConfig pattern (inline it here since it's in ProgramBuilder)
        const warmups = [{ reps: 5, pct: 0.5 }, { reps: 3, pct: 0.65 }]
        for (let i = 0; i < warmups.length; i++) {
          await db.execute(
            `INSERT INTO wave_warmups (id, wave_config_id, set_index, reps, percentage) VALUES (?, ?, ?, ?, ?)`,
            [uuid(), wcId, i, warmups[i].reps, warmups[i].pct],
          )
        }

        const weeks = [
          { label: 'Wk1 (5s)', sets: [{ reps: 5, pct: 0.75 }, { reps: 5, pct: 0.82 }, { reps: 5, pct: 0.88 }, { reps: 8, pct: 0.75, backoff: true }] },
          { label: 'Wk2 (4s)', sets: [{ reps: 4, pct: 0.79 }, { reps: 4, pct: 0.85 }, { reps: 4, pct: 0.91 }, { reps: 6, pct: 0.79, backoff: true }] },
          { label: 'Wk3 (3s)', sets: [{ reps: 3, pct: 0.82 }, { reps: 3, pct: 0.88 }, { reps: 3, pct: 0.94 }, { reps: 5, pct: 0.82, backoff: true }] },
          { label: 'Wk4 (deload)', sets: [{ reps: 5, pct: 0.69 }, { reps: 5, pct: 0.75 }, { reps: 3, pct: 0.82 }] },
        ]

        for (let wi = 0; wi < weeks.length; wi++) {
          const wwId = uuid()
          await db.execute(
            `INSERT INTO wave_weeks (id, wave_config_id, week_index, label) VALUES (?, ?, ?, ?)`,
            [wwId, wcId, wi, weeks[wi].label],
          )
          for (let si = 0; si < weeks[wi].sets.length; si++) {
            const s = weeks[wi].sets[si]
            await db.execute(
              `INSERT INTO wave_week_sets (id, wave_week_id, set_index, reps, percentage, is_backoff) VALUES (?, ?, ?, ?, ?, ?)`,
              [uuid(), wwId, si, s.reps, s.pct, s.backoff ? 1 : 0],
            )
          }
        }

        // Insert initial training max
        await db.execute(
          `INSERT INTO training_maxes (id, exercise_id, value, block_num, source) VALUES (?, ?, ?, 1, 'manual')`,
          [uuid(), exerciseId, ex.baseMax],
        )
      }
    }
  }

  return programId
}
```

**Important:** Extract `insertDefaultWaveConfig` from `ProgramBuilder.tsx` into a shared location (either `seed.ts` or a new `src/lib/wave-defaults.ts`) so both ProgramBuilder and this function use the same wave pattern. Update ProgramBuilder to import it.

**Step 2: Commit**

```bash
git add src/lib/seed.ts
git commit -m "feat: add createProgramFromBuilder for saving wizard output to DB"
```

---

### Task 4: Wizard Shell — WorkoutBuilder.tsx

**Files:**
- Create: `src/components/builder/WorkoutBuilder.tsx`

**Step 1: Create the wizard container**

This manages the step state (1-4), the accumulated data (`goal`, `dayCount`, `generatedProgram`), the step progress indicator, and back/forward navigation.

Props:
```typescript
interface WorkoutBuilderProps {
  onComplete: (programId: string) => void  // called after DB save
  onCancel: () => void                       // back to landing/template selector
}
```

State:
```typescript
const [step, setStep] = useState(1)
const [goal, setGoal] = useState<Goal | null>(null)
const [dayCount, setDayCount] = useState<number | null>(null)
const [program, setProgram] = useState<GeneratedProgram | null>(null)
const [programName, setProgramName] = useState('')
```

Flow:
- Step 1 → user picks goal → `setGoal(g)` → advance to step 2
- Step 2 → user picks dayCount → `setDayCount(n)` → run `generateProgram(goal, n)` → `setProgram(result)` → `setProgramName(result.name)` → advance to step 3
- Step 3 → user edits program in place (mutations to `program` state) → advance to step 4
- Step 4 → user edits name → taps "Start Training" → calls `createProgramFromBuilder({...program, name: programName})` → `onComplete(programId)`

Back button goes to previous step. On step 1, back calls `onCancel`.

Progress indicator: 4 dots at top, current step highlighted in accent color.

Layout: Full screen, `pt-[env(safe-area-inset-top)]` for iOS safe area. Matches the dark theme (`bg-bg`).

**Step 2: Commit**

```bash
git add src/components/builder/WorkoutBuilder.tsx
git commit -m "feat: add WorkoutBuilder wizard shell with step navigation"
```

---

### Task 5: GoalStep.tsx

**Files:**
- Create: `src/components/builder/GoalStep.tsx`

**Step 1: Create the goal selection screen**

Three large tappable cards, vertically stacked. Each card has:
- Icon (inline SVG, 24x24 viewBox, 1.5px stroke — match BottomNav style)
- Title (bold, text-bright)
- Description (text-muted, 1 line)

Cards:
1. **Strength** — dumbbell icon — "Heavy compounds, low reps, wave-loaded periodization"
2. **Hypertrophy** — bicep/muscle icon — "Moderate weight, higher volume, muscle growth"
3. **General Fitness** — activity/heart icon — "Balanced strength and conditioning"

Tapping a card calls `onSelect(goal: Goal)`. Use `motion.div` for a subtle entry animation matching existing patterns.

Touch targets: min 44px height per card. Style: `bg-card border border-border-elevated rounded-lg` with `hover:border-accent active:border-accent`.

Props:
```typescript
interface GoalStepProps {
  onSelect: (goal: Goal) => void
}
```

**Step 2: Commit**

```bash
git add src/components/builder/GoalStep.tsx
git commit -m "feat: add GoalStep component for workout builder"
```

---

### Task 6: ScheduleStep.tsx

**Files:**
- Create: `src/components/builder/ScheduleStep.tsx`

**Step 1: Create the day count selection screen**

Header: "How many days per week?"

5 pill buttons in a horizontal row: 2, 3, 4, 5, 6. Each is a `min-w-[56px] min-h-[56px]` rounded button. Tapping selects and calls `onSelect(dayCount)`.

Style: `bg-card border border-border-elevated rounded-xl text-bright text-lg font-bold`. Selected state: `bg-accent text-bg`.

Brief descriptor text below the pills that updates based on hover/selection:
- 2: "Upper / Lower split"
- 3: "Push / Pull / Legs"
- 4: "4-day split"
- 5: "5-day push/pull/legs hybrid"
- 6: "6-day PPL double"

Props:
```typescript
interface ScheduleStepProps {
  onSelect: (dayCount: number) => void
}
```

**Step 2: Commit**

```bash
git add src/components/builder/ScheduleStep.tsx
git commit -m "feat: add ScheduleStep component for workout builder"
```

---

### Task 7: ReviewStep.tsx

**Files:**
- Create: `src/components/builder/ReviewStep.tsx`

**Step 1: Create the review & edit screen**

This is the most complex step. It shows the auto-generated program and lets the user edit it before confirming.

Layout:
- Day tabs at top (reuse `DayTabs` style — horizontal scrollable pills showing day subtitles)
- Selected day's exercises listed as cards below
- Each card: exercise name, category badge (from `CATEGORY_CONFIG`), summary text (e.g. "3×10 @ 135 lb" or "Wave-loaded · TM: 225 lb")
- Tap card → opens `ExerciseEditor` (existing component from `src/components/programs/ExerciseEditor.tsx`) in edit mode
- Delete button (trash icon) on each card
- "+" button at bottom to add exercise (opens `ExerciseEditor` in create mode)
- Tappable day header to edit name/subtitle/focus (use a simple inline edit or small modal)

State: operates on `GeneratedProgram` passed as prop. All mutations call `onUpdate(updatedProgram)` to propagate changes up to the wizard shell.

Props:
```typescript
interface ReviewStepProps {
  program: GeneratedProgram
  onUpdate: (program: GeneratedProgram) => void
  onConfirm: () => void
}
```

When user taps "Continue" at the bottom, calls `onConfirm()`.

**Important patterns to follow:**
- Use Tailwind theme tokens (`bg-card`, `text-accent`, `border-border`, etc.)
- Touch targets min 44x44px
- `active:` states alongside `hover:` for iOS tap feedback
- Use `AnimatePresence` + `motion.div` for the `ExerciseEditor` modal overlay (it already handles this internally)

For the ExerciseEditor integration: when saving from the editor, map `ExerciseFormData` back to `GeneratedExercise`:
```typescript
const updated: GeneratedExercise = {
  name: formData.name,
  key: formData.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
  category: formData.category,
  sets: formData.isWave ? 0 : formData.sets,
  reps: formData.isWave ? 0 : formData.reps,
  defaultWeight: formData.isWave ? 0 : formData.defaultWeight,
  note: formData.note,
  isWave: formData.isWave,
  baseMax: formData.baseMax,
}
```

**Step 2: Commit**

```bash
git add src/components/builder/ReviewStep.tsx
git commit -m "feat: add ReviewStep component with exercise editing for workout builder"
```

---

### Task 8: ConfirmStep.tsx

**Files:**
- Create: `src/components/builder/ConfirmStep.tsx`

**Step 1: Create the confirmation screen**

Simple screen with:
- Program name input (pre-filled, text-[16px] min for iOS, `inputMode` not needed since it's text)
- Summary stats: "X days · Y exercises · Z wave-loaded"
- Quick preview list: day names with exercise counts
- "Start Training" button: large, `bg-accent text-bg`, full width, min-h-[52px]

Props:
```typescript
interface ConfirmStepProps {
  program: GeneratedProgram
  programName: string
  onNameChange: (name: string) => void
  onConfirm: () => void
  saving: boolean
}
```

The `onConfirm` triggers the parent to call `createProgramFromBuilder`. Show loading state while saving.

**Step 2: Commit**

```bash
git add src/components/builder/ConfirmStep.tsx
git commit -m "feat: add ConfirmStep component for workout builder"
```

---

### Task 9: Integration — App.tsx Landing + ProgramBuilder

**Files:**
- Modify: `src/App.tsx` (replace `TemplateSelector`, add builder state)
- Modify: `src/components/programs/ProgramBuilder.tsx` (add "Create New Program" button)

**Step 1: Update App.tsx**

Replace the current `TemplateSelector` with a new landing component that offers two paths:

1. **"Build Your Program"** — large primary button/card → opens `WorkoutBuilder`
2. **"Use a Template"** — secondary option → shows existing template list

State changes in `App()`:
```typescript
const [showBuilder, setShowBuilder] = useState(false)
```

When `!activeProgramId`:
- If `showBuilder` → render `<WorkoutBuilder onComplete={...} onCancel={() => setShowBuilder(false)} />`
- Else → render the new landing with both options

The landing layout: centered like current `TemplateSelector`. FORGE logo at top. Two main action cards, then the template list below "Or choose a template:".

**Step 2: Update ProgramBuilder.tsx**

Add a "Create New Program" button in the header area of ProgramBuilder. When tapped, it needs to switch to the builder wizard. This requires either:
- A new piece of state in `MainApp` (e.g., `showProgramBuilder: boolean`) that when true renders `WorkoutBuilder` instead of `ProgramBuilder`
- Or a callback prop `onCreateNew` passed down from `MainApp`

Use the callback approach: add `onCreateNew: () => void` prop to `ProgramBuilder`, render a button in the header, and handle it in `MainApp` alongside the existing `showBrowser` state.

In `MainApp`, add:
```typescript
const [showNewBuilder, setShowNewBuilder] = useState(false)
```

In the `case 'programs':` switch:
```typescript
if (showNewBuilder) {
  return <WorkoutBuilder onComplete={(id) => { setActiveProgramId(id); setShowNewBuilder(false) }} onCancel={() => setShowNewBuilder(false)} />
}
if (showBrowser) { ... }
return <ProgramBuilder ... onCreateNew={() => setShowNewBuilder(true)} />
```

**Step 3: Commit**

```bash
git add src/App.tsx src/components/programs/ProgramBuilder.tsx
git commit -m "feat: integrate workout builder into app landing and programs tab"
```

---

### Task 10: Extract insertDefaultWaveConfig to shared location

**Files:**
- Create: `src/lib/wave-defaults.ts`
- Modify: `src/components/programs/ProgramBuilder.tsx` (import from shared)
- Modify: `src/lib/seed.ts` (import from shared)

**Step 1: Extract the function**

Move `insertDefaultWaveConfig` from the bottom of `ProgramBuilder.tsx` into `src/lib/wave-defaults.ts`. Update both ProgramBuilder and seed.ts to import from there. This eliminates the duplicated wave config pattern.

```typescript
// src/lib/wave-defaults.ts
import { v4 as uuid } from 'uuid'
import type { getDb } from './db'

type Db = Awaited<ReturnType<typeof getDb>>

export async function insertDefaultWaveConfig(db: Db, waveConfigId: string): Promise<void> {
  // ... exact same implementation as ProgramBuilder.tsx lines 422-458
  // but takes waveConfigId directly instead of exerciseId
}
```

**Step 2: Commit**

```bash
git add src/lib/wave-defaults.ts src/components/programs/ProgramBuilder.tsx src/lib/seed.ts
git commit -m "refactor: extract insertDefaultWaveConfig to shared module"
```

---

### Task 11: Manual Testing & Polish

**Step 1: Run the app**

```bash
npm run dev
```

Verify in browser (port 1420):
- New user flow: landing shows "Build Your Program" + template options
- Wizard: Goal → Schedule → Review → Confirm works end-to-end
- Generated program has correct exercises for each goal/day combo
- Editing exercises in Review step works (tap to edit, delete, add)
- Wave toggle in Review step correctly sets `isWave` and `baseMax`
- "Start Training" creates the program and navigates to workout view
- Programs tab: "Create New Program" button opens the builder
- Built program is fully functional in the workout view (sets render, logging works)

**Step 2: Run on iOS**

```bash
npm run tauri ios dev
```

Verify:
- Safe areas render correctly
- Touch targets are 44px+
- Number inputs are 16px+ (no iOS zoom)
- Back gestures work naturally with wizard back button
- Keyboard doesn't obscure inputs in the Review/Confirm steps

**Step 3: Final commit**

```bash
git add -A
git commit -m "polish: workout builder manual testing fixes"
```

---

## Task Dependency Order

```
Task 1 (exercise library) ─┐
                            ├─► Task 2 (generator) ─► Task 3 (DB save) ─┐
                            │                                             │
Task 10 (extract wave fn) ─┘                                             │
                                                                          ├─► Task 9 (integration)
Task 4 (wizard shell) ──────────────────────────────────────────────────┤     ─► Task 11 (testing)
Task 5 (GoalStep) ──────────────────────────────────────────────────────┤
Task 6 (ScheduleStep) ──────────────────────────────────────────────────┤
Task 7 (ReviewStep) ────────────────────────────────────────────────────┤
Task 8 (ConfirmStep) ───────────────────────────────────────────────────┘
```

Tasks 1, 4-8, and 10 can be implemented in parallel. Task 2 depends on 1. Task 3 depends on 2 and 10. Task 9 depends on 3-8. Task 11 depends on 9.
