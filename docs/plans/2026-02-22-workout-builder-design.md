# Workout Builder Design

## Problem

New users must fork a preset template (Peak Strength or 5/3/1) to start training. Not everyone wants 4 days/week or the same lifts. There is no way to create a custom program from scratch.

## Solution

A 4-step wizard that asks the user their goal, schedule, and then auto-generates a full program they can review and edit before starting. Entirely local — no API calls.

## Wizard Flow

### Step 1 — Goal

Three tappable cards:
- **Strength** — Heavy compounds, low reps, wave-loaded periodization
- **Hypertrophy** — Moderate weight, higher volume, muscle growth focus
- **General Fitness** — Balanced strength and conditioning

Single selection. Advances to Step 2.

### Step 2 — Schedule

"How many days per week?" — 5 pill buttons: 2, 3, 4, 5, 6. Advances to Step 3.

### Step 3 — Review & Edit

Auto-generated program displayed as day tabs with exercise cards. User can:
- Tap an exercise to edit (opens ExerciseEditor) — name, category, wave toggle, sets/reps/weight, training max
- Delete an exercise
- Add an exercise via "+" button at bottom of day
- Edit day name/focus by tapping the day header

### Step 4 — Confirm

Program name field (pre-filled, e.g. "Strength Program"). "Start Training" button creates the DB rows and enters MainApp.

Step indicator at top. Back button on each step.

## Auto-Generation Engine

Pure function: `generateProgram(goal, dayCount) → GeneratedProgram`

### Split Patterns

| Days | Split |
|------|-------|
| 2 | Upper / Lower |
| 3 | Push / Pull / Legs |
| 4 | Upper / Lower / Upper / Lower (Strength variant: Squat / Bench / Deadlift / OHP focused) |
| 5 | Push / Pull / Legs / Upper / Lower |
| 6 | Push / Pull / Legs / Push / Pull / Legs |

### Goal Modifiers

- **Strength**: Main compounds wave-loaded, accessories 3-4 sets x 6-8 reps
- **Hypertrophy**: Compounds fixed 4x8-12, more accessories at 3x12-15, no wave by default
- **General Fitness**: Compounds 3x8-10, accessories 2-3x10-12

## Exercise Library

Hardcoded catalog of ~40 common exercises:

```typescript
interface LibraryExercise {
  key: string           // e.g. 'bench_press' — matches exerciseKey for history
  name: string          // 'Bench Press'
  category: ExerciseCategory
  defaultSets: number
  defaultReps: number
  defaultWeight: number
  waveEligible: boolean // true for main compounds
}
```

Organized by muscle group / movement pattern. Generator picks exercises from this catalog based on split and goal.

## Data Model

No schema changes. Builder creates rows in existing user tables:
- `programs` with `source_template_id = NULL`
- `days` — one per scheduled day
- `exercises` — from generated/edited list
- `wave_configs` / `wave_warmups` / `wave_weeks` / `wave_week_sets` — for wave-toggled exercises (existing `insertDefaultWaveConfig`)
- `training_maxes` — initial entry per wave exercise (source: `'manual'`)

## New Files

```
src/components/builder/WorkoutBuilder.tsx   — wizard shell (step state, nav, progress)
src/components/builder/GoalStep.tsx         — step 1
src/components/builder/ScheduleStep.tsx     — step 2
src/components/builder/ReviewStep.tsx       — step 3
src/components/builder/ConfirmStep.tsx      — step 4
src/lib/program-generator.ts               — (goal, days) → program structure
src/lib/exercise-library.ts                — ~40 exercises with keys/defaults
```

## Integration

- **App.tsx**: Replace `<TemplateSelector>` with landing offering "Build Your Program" (wizard) and "Use a Template" (existing flow)
- **ProgramBuilder.tsx**: Add "Create New Program" button that opens the wizard
- **Saving**: New `createProgramFromBuilder()` in `src/lib/seed.ts` — inserts program/days/exercises/wave configs in `withWriteLock()`, similar to `forkTemplate` but from builder's in-memory state
