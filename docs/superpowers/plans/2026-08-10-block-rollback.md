# Block Rollback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user step back one training block (restoring that block's training maxes) and re-run it with fresh workout logs while all prior logs stay intact.

**Architecture:** A `cycle` counter on `programs` and `workout_logs` distinguishes re-runs of the same block number (migration 014 widens the unique index). Block advance/rollback logic is extracted into `src/lib/blocks.ts` — currently the advance logic is duplicated in `App.tsx` and `WorkoutControls.tsx`; both get replaced by one tested function. Rollback appends `training_maxes` rows (append-only rule) with `source = 'rollback'`; the effective-TM reader (`latest by created_at`) picks them up with no changes.

**Tech Stack:** Tauri v2 + tauri-plugin-sql (SQLite), React 18 + TypeScript, vitest with mocked `getDb` (pattern: `src/lib/export.test.ts`).

**Spec:** `docs/superpowers/specs/2026-08-10-block-rollback-design.md`

## Global Constraints

- Style: no semicolons, single quotes, trailing commas in multi-line literals.
- All SQL uses `?` placeholders; `db.select` always has a typed row generic.
- `training_maxes` is append-only — never UPDATE/DELETE it.
- Multi-statement writes go through `withWriteLock()` from `src/lib/db.ts` (pool makes BEGIN/COMMIT unsafe).
- All IDs are uuid v4 via the `uuid` package.
- Touch targets ≥ 44px; `active:` states alongside `hover:`; Tailwind theme tokens only (no inline hex).
- Migrations: `src-tauri/migrations/NNN_description.sql`, registered in `src-tauri/src/lib.rs`; a migration change needs a full Tauri rebuild to run on-device (HMR won't do it).
- Run tests with `npm run test` (vitest); type-check with `npx tsc -p tsconfig.app.json --noEmit`.

---

### Task 1: Migration 014 — cycle columns and widened unique index

**Files:**
- Create: `src-tauri/migrations/014_add_block_cycle.sql`
- Modify: `src-tauri/src/lib.rs` (migrations vec, after the `version: 13` entry, before the closing `];` at ~line 89)

**Interfaces:**
- Produces: `programs.cycle INTEGER NOT NULL DEFAULT 0`, `workout_logs.cycle INTEGER NOT NULL DEFAULT 0`, unique index `idx_workout_logs_unique ON workout_logs (program_id, day_id, block_num, week_index, cycle)`. Tasks 2–5 rely on these columns existing.

- [ ] **Step 1: Write the migration**

`src-tauri/migrations/014_add_block_cycle.sql`:

```sql
-- Migration 014: block rollback support
-- Adds a per-program cycle counter so a block can be re-run after rolling
-- back: each rollback increments programs.cycle, and workout_logs are
-- stamped with the cycle they were logged under. Two runs of the same
-- (day, block, week) therefore never collide with the unique index.

ALTER TABLE programs ADD COLUMN cycle INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workout_logs ADD COLUMN cycle INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS idx_workout_logs_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_logs_unique
  ON workout_logs (program_id, day_id, block_num, week_index, cycle);
```

- [ ] **Step 2: Verify the SQL against a scratch database**

tauri-plugin-sql runs each version exactly once, so `ALTER TABLE ADD COLUMN` (not idempotent by itself) is safe — same pattern as migration 008. Verify syntax and index behavior locally:

```bash
cd /private/tmp/claude-501/-Users-dballi-projects-peak-tracker/ce2a3c46-e480-4120-8858-9994ab745528/scratchpad
rm -f scratch.db
sqlite3 scratch.db "
CREATE TABLE programs (id TEXT PRIMARY KEY, block_num INTEGER NOT NULL DEFAULT 1);
CREATE TABLE workout_logs (id TEXT PRIMARY KEY, program_id TEXT NOT NULL, day_id TEXT NOT NULL, block_num INTEGER NOT NULL, week_index INTEGER NOT NULL, started_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_logs_unique ON workout_logs (program_id, day_id, block_num, week_index);
INSERT INTO workout_logs (id, program_id, day_id, block_num, week_index) VALUES ('w1', 'p1', 'd1', 41, 0);"
sqlite3 scratch.db < /Users/dballi/projects/peak-tracker/src-tauri/migrations/014_add_block_cycle.sql
sqlite3 scratch.db "
INSERT INTO workout_logs (id, program_id, day_id, block_num, week_index, cycle) VALUES ('w2', 'p1', 'd1', 41, 0, 1);
SELECT id, cycle FROM workout_logs ORDER BY id;"
```

Expected: no errors; final select prints `w1|0` and `w2|1` (same day/block/week accepted under a different cycle). Also confirm the duplicate is still rejected within a cycle:

```bash
sqlite3 scratch.db "INSERT INTO workout_logs (id, program_id, day_id, block_num, week_index, cycle) VALUES ('w3', 'p1', 'd1', 41, 0, 1);"
```

Expected: `UNIQUE constraint failed` error.

- [ ] **Step 3: Register the migration**

In `src-tauri/src/lib.rs`, after the `version: 13` entry inside the migrations vec:

```rust
        Migration {
            version: 14,
            description: "add_block_cycle",
            sql: include_str!("../migrations/014_add_block_cycle.sql"),
            kind: MigrationKind::Up,
        },
```

- [ ] **Step 4: Verify Rust compiles**

```bash
cd /Users/dballi/projects/peak-tracker/src-tauri && PATH="$HOME/.cargo/bin:$PATH" cargo check 2>&1 | tail -5
```

Expected: `Finished` with no errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/migrations/014_add_block_cycle.sql src-tauri/src/lib.rs
git commit -m "feat: migration 014 — cycle column for block rollback"
```

---

### Task 2: `src/lib/blocks.ts` — advanceBlock and rollbackBlock (TDD)

**Files:**
- Create: `src/lib/blocks.ts`
- Test: `src/lib/blocks.test.ts`

**Interfaces:**
- Consumes: `getDb`/`withWriteLock` from `src/lib/db.ts`, `estimatedOneRepMax`/`roundToNearest5` from `src/lib/calc.ts`, `uuid` v4.
- Produces (Tasks 4–5 call these exact signatures):

```typescript
export interface WaveExerciseRef { id: string }

export async function advanceBlock(
  programId: string,
  blockNum: number,
  cycle: number,
  waveExercises: WaveExerciseRef[],
  getEffectiveMax: (exerciseId: string) => number,
): Promise<void>

export async function rollbackBlock(
  programId: string,
  blockNum: number,
  waveExercises: WaveExerciseRef[],
  getEffectiveMax: (exerciseId: string) => number,
): Promise<void>
```

- [ ] **Step 1: Write the failing tests**

`src/lib/blocks.test.ts` (mock pattern copied from `src/lib/export.test.ts`; `withWriteLock` mocked as passthrough):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const selectMock = vi.fn()
const executeMock = vi.fn()

vi.mock('./db', () => ({
  getDb: async () => ({ select: selectMock, execute: executeMock }),
  withWriteLock: (fn: () => Promise<unknown>) => fn(),
}))

import { advanceBlock, rollbackBlock } from './blocks'

beforeEach(() => {
  selectMock.mockReset()
  executeMock.mockReset()
})

describe('advanceBlock', () => {
  it('scopes the Week 3 set query to the current cycle', async () => {
    selectMock.mockResolvedValueOnce([])
    await advanceBlock('p1', 41, 2, [{ id: 'ex1' }], () => 300)

    const [sql, params] = selectMock.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('wl.cycle = ?')
    expect(params).toEqual(['p1', 'ex1', 41, 2])
  })

  it('caps the new TM at 20% above current and rounds to 5', async () => {
    // e1RM of 400x10 = 533, cap = 300 * 1.2 = 360
    selectMock.mockResolvedValueOnce([{ weight: 400, reps: 10 }])
    await advanceBlock('p1', 41, 0, [{ id: 'ex1' }], () => 300)

    const tmInsert = executeMock.mock.calls[0] as [string, unknown[]]
    expect(tmInsert[0]).toContain('INSERT INTO training_maxes')
    expect(tmInsert[0]).toContain("'auto'")
    expect(tmInsert[1]?.slice(2)).toEqual([360, 42])
  })

  it('falls back to +5 when no Week 3 log beats the current max', async () => {
    selectMock.mockResolvedValueOnce([])
    await advanceBlock('p1', 41, 0, [{ id: 'ex1' }], () => 300)

    const tmInsert = executeMock.mock.calls[0] as [string, unknown[]]
    expect(tmInsert[1]?.slice(2)).toEqual([305, 42])
  })

  it('increments block and resets week and day, leaving cycle unchanged', async () => {
    selectMock.mockResolvedValueOnce([])
    await advanceBlock('p1', 41, 0, [{ id: 'ex1' }], () => 300)

    const progUpdate = executeMock.mock.calls.at(-1) as [string, unknown[]]
    expect(progUpdate[0]).toContain('block_num = block_num + 1')
    expect(progUpdate[0]).toContain('current_week = 0')
    expect(progUpdate[0]).not.toContain('cycle')
    expect(progUpdate[1]).toEqual(['p1'])
  })
})

describe('rollbackBlock', () => {
  it('appends a rollback TM row with the target block value', async () => {
    selectMock.mockResolvedValueOnce([{ value: 285 }])
    await rollbackBlock('p1', 43, [{ id: 'ex1' }], () => 300)

    const tmInsert = executeMock.mock.calls[0] as [string, unknown[]]
    expect(tmInsert[0]).toContain('INSERT INTO training_maxes')
    expect(tmInsert[0]).toContain("'rollback'")
    expect(tmInsert[1]?.slice(2)).toEqual([285, 42])
  })

  it('resolves the TM as latest entry at or before the target block', async () => {
    selectMock.mockResolvedValueOnce([{ value: 285 }])
    await rollbackBlock('p1', 43, [{ id: 'ex1' }], () => 300)

    const [sql, params] = selectMock.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('block_num <= ?')
    expect(sql).toContain('ORDER BY block_num DESC, created_at DESC')
    expect(params).toEqual(['ex1', 42])
  })

  it('skips the TM insert when no historical TM exists', async () => {
    selectMock.mockResolvedValueOnce([])
    await rollbackBlock('p1', 43, [{ id: 'ex1' }], () => 300)

    const inserts = executeMock.mock.calls.filter(([sql]) =>
      (sql as string).includes('training_maxes'))
    expect(inserts).toHaveLength(0)
  })

  it('skips the TM insert when the historical value equals the current max', async () => {
    selectMock.mockResolvedValueOnce([{ value: 300 }])
    await rollbackBlock('p1', 43, [{ id: 'ex1' }], () => 300)

    const inserts = executeMock.mock.calls.filter(([sql]) =>
      (sql as string).includes('training_maxes'))
    expect(inserts).toHaveLength(0)
  })

  it('decrements block, resets week, and increments cycle', async () => {
    selectMock.mockResolvedValueOnce([])
    await rollbackBlock('p1', 43, [{ id: 'ex1' }], () => 300)

    const progUpdate = executeMock.mock.calls.at(-1) as [string, unknown[]]
    expect(progUpdate[0]).toContain('block_num = block_num - 1')
    expect(progUpdate[0]).toContain('current_week = 0')
    expect(progUpdate[0]).toContain('cycle = cycle + 1')
    expect(progUpdate[1]).toEqual(['p1'])
  })

  it('does nothing at block 1', async () => {
    await rollbackBlock('p1', 1, [{ id: 'ex1' }], () => 300)
    expect(selectMock).not.toHaveBeenCalled()
    expect(executeMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/lib/blocks.test.ts`
Expected: FAIL — cannot resolve `./blocks`.

- [ ] **Step 3: Write the implementation**

`src/lib/blocks.ts`:

```typescript
import { v4 as uuid } from 'uuid'
import { getDb, withWriteLock } from './db'
import { estimatedOneRepMax, roundToNearest5 } from './calc'

const MAX_TM_INCREASE_RATIO = 1.2

export interface WaveExerciseRef {
  id: string
}

/**
 * Advance to the next block: auto-calculate new TMs from this cycle's
 * Week 3 logs (capped at +20%), then bump the program pointer.
 */
export async function advanceBlock(
  programId: string,
  blockNum: number,
  cycle: number,
  waveExercises: WaveExerciseRef[],
  getEffectiveMax: (exerciseId: string) => number,
): Promise<void> {
  const db = await getDb()
  await withWriteLock(async () => {
    for (const ex of waveExercises) {
      const currentMax = getEffectiveMax(ex.id)
      let bestE1rm = currentMax

      const rows = await db.select<Array<{ weight: number; reps: number }>>(
        `SELECT sl.weight, sl.reps FROM set_logs sl
         JOIN workout_logs wl ON sl.workout_log_id = wl.id
         WHERE wl.program_id = ? AND sl.exercise_id = ? AND wl.block_num = ? AND wl.cycle = ?
           AND wl.week_index = 2
           AND sl.weight IS NOT NULL AND sl.reps IS NOT NULL AND sl.weight > 0 AND sl.reps > 0
           AND sl.is_completed = 1`,
        [programId, ex.id, blockNum, cycle],
      )

      for (const r of rows) {
        const e1rm = estimatedOneRepMax(r.weight, r.reps)
        if (e1rm > bestE1rm) bestE1rm = e1rm
      }

      const newTm = bestE1rm > currentMax
        ? roundToNearest5(Math.min(bestE1rm, currentMax * MAX_TM_INCREASE_RATIO))
        : roundToNearest5(currentMax + 5)

      await db.execute(
        `INSERT INTO training_maxes (id, exercise_id, value, block_num, source) VALUES (?, ?, ?, ?, 'auto')`,
        [uuid(), ex.id, newTm, blockNum + 1],
      )
    }

    await db.execute(
      `UPDATE programs SET block_num = block_num + 1, current_week = 0, current_day = 0 WHERE id = ?`,
      [programId],
    )
  })
}

/**
 * Step back one block. Restores the target block's TMs by appending new
 * rows (training_maxes is append-only) and increments the program's cycle
 * so the re-run gets fresh workout logs instead of resuming old ones.
 */
export async function rollbackBlock(
  programId: string,
  blockNum: number,
  waveExercises: WaveExerciseRef[],
  getEffectiveMax: (exerciseId: string) => number,
): Promise<void> {
  if (blockNum <= 1) return
  const target = blockNum - 1
  const db = await getDb()
  await withWriteLock(async () => {
    for (const ex of waveExercises) {
      const rows = await db.select<Array<{ value: number }>>(
        `SELECT value FROM training_maxes
         WHERE exercise_id = ? AND block_num <= ?
         ORDER BY block_num DESC, created_at DESC LIMIT 1`,
        [ex.id, target],
      )
      if (rows.length === 0) continue
      if (rows[0].value === getEffectiveMax(ex.id)) continue

      await db.execute(
        `INSERT INTO training_maxes (id, exercise_id, value, block_num, source) VALUES (?, ?, ?, ?, 'rollback')`,
        [uuid(), ex.id, rows[0].value, target],
      )
    }

    await db.execute(
      `UPDATE programs SET block_num = block_num - 1, current_week = 0, cycle = cycle + 1 WHERE id = ?`,
      [programId],
    )
  })
}
```

Note: `advanceBlock` resets `current_day = 0`, matching `App.tsx`'s `handleAdvanceBlock` (the `WorkoutControls` copy didn't reset the day — the App behavior is the deliberate winner when the two are unified in Task 4).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/lib/blocks.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/blocks.ts src/lib/blocks.test.ts
git commit -m "feat: advanceBlock/rollbackBlock lib with cycle-aware TM logic"
```

---

### Task 3: Thread `cycle` through program state and workout logs

**Files:**
- Modify: `src/hooks/useProgram.ts` (ProgramData ~line 5, ProgramRow ~line 14, SELECT ~line 83, setProgram ~line 192)
- Modify: `src/hooks/useWorkoutLog.ts` (signature ~line 25, find/insert queries ~lines 43–58, init effect deps)
- Modify: `src/components/workout/WorkoutView.tsx` (props ~line 19, `useWorkoutLog` call line 69, `WorkoutControls` usage line 179)
- Modify: `src/App.tsx` (`WorkoutView` usage ~line 318)
- Modify: `src/components/workout/WorkoutControls.tsx` (props only — behavior changes are Task 4)

**Interfaces:**
- Consumes: `programs.cycle` / `workout_logs.cycle` from Task 1.
- Produces: `program.cycle: number` on `useProgram`'s return; `useWorkoutLog(programId, dayId, blockNum, weekIndex, cycle)`; `cycle: number` prop on `WorkoutView` and `WorkoutControls`. Tasks 4–5 rely on these names.

- [ ] **Step 1: useProgram exposes cycle**

In `src/hooks/useProgram.ts` add `cycle: number` to `ProgramData`, `cycle: number` to `ProgramRow`, change the program SELECT to:

```typescript
    const programs = await db.select<ProgramRow[]>(
      `SELECT id, name, block_num, current_week, current_day, cycle FROM programs WHERE id = ?`,
      [programId],
    )
```

and add `cycle: p.cycle,` to the `setProgram({ ... })` object.

- [ ] **Step 2: useWorkoutLog keys logs by cycle**

In `src/hooks/useWorkoutLog.ts` change the signature:

```typescript
export function useWorkoutLog(
  programId: string,
  dayId: string,
  blockNum: number,
  weekIndex: number,
  cycle: number,
) {
```

Both find queries become:

```typescript
        `SELECT id FROM workout_logs WHERE program_id = ? AND day_id = ? AND block_num = ? AND week_index = ? AND cycle = ?`,
        [programId, dayId, blockNum, weekIndex, cycle],
```

The insert becomes:

```typescript
          `INSERT OR IGNORE INTO workout_logs (id, program_id, day_id, block_num, week_index, cycle) VALUES (?, ?, ?, ?, ?, ?)`,
          [newId, programId, dayId, blockNum, weekIndex, cycle],
```

(keep the existing variable name for the id if it differs). Add `cycle` to the init effect's dependency array.

- [ ] **Step 3: Thread the prop through WorkoutView and App**

`WorkoutView.tsx`: add `cycle: number` to `WorkoutViewProps`, destructure it, pass it to `useWorkoutLog(programId, day.id, blockNum, currentWeek, cycle)` (line 69) and to `<WorkoutControls ... cycle={cycle} />` (line 179). In `WorkoutControls.tsx` add `cycle: number` to `WorkoutControlsProps` and destructure it (unused until Task 4 — that's fine for one commit).

`App.tsx`: pass `cycle={program.cycle}` in the `<WorkoutView ... />` usage.

- [ ] **Step 4: Verify types and tests**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run test`
Expected: clean compile, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProgram.ts src/hooks/useWorkoutLog.ts src/components/workout/WorkoutView.tsx src/components/workout/WorkoutControls.tsx src/App.tsx
git commit -m "feat: thread program cycle through workout log keying"
```

---

### Task 4: Replace duplicated advance logic with `advanceBlock()`

**Files:**
- Modify: `src/App.tsx` (`handleAdvanceBlock` ~lines 244–292)
- Modify: `src/components/workout/WorkoutControls.tsx` (`handleAdvanceWeek` block branch, ~lines 69–108)

**Interfaces:**
- Consumes: `advanceBlock(programId, blockNum, cycle, waveExercises, getEffectiveMax)` from Task 2; `cycle` prop from Task 3.

- [ ] **Step 1: App.tsx**

Replace the body of `handleAdvanceBlock` (keep the surrounding `useCallback`):

```typescript
  const handleAdvanceBlock = useCallback(async () => {
    if (!program) return
    await advanceBlock(programId, program.blockNum, program.cycle, waveExercises, getEffectiveMax)
    await reload()
    await reloadMaxes()
    bumpDataVersion()
  }, [program, programId, waveExercises, getEffectiveMax, reload, reloadMaxes, bumpDataVersion])
```

Add `import { advanceBlock } from './lib/blocks'` and remove now-unused imports that this change orphans (check: `estimatedOneRepMax`, `roundToNearest5`, `uuid`, `getDb`, `withWriteLock` — remove only the ones nothing else in the file uses; `tsc` will tell you).

- [ ] **Step 2: WorkoutControls.tsx**

In `handleAdvanceWeek`, replace the `else` branch (the whole `withWriteLock(...)` block, lines ~70–107) with:

```typescript
      } else {
        await advanceBlock(programId, blockNum, cycle, waveExercises, getEffectiveMax)
        onAdvance()
      }
```

Add `import { advanceBlock } from '../../lib/blocks'`, add `cycle` to the `useCallback` dependency array, and remove orphaned imports (`estimatedOneRepMax`, `withWriteLock`, the `MAX_TM_INCREASE_RATIO` constant — again, `tsc` confirms).

- [ ] **Step 3: Verify types and tests**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run test`
Expected: clean compile, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/workout/WorkoutControls.tsx
git commit -m "refactor: unify block advance through advanceBlock()"
```

---

### Task 5: "Back One Block" UI

**Files:**
- Modify: `src/components/workout/WorkoutControls.tsx`

**Interfaces:**
- Consumes: `rollbackBlock(programId, blockNum, waveExercises, getEffectiveMax)` from Task 2; existing `ConfirmModal` (`title`, `message`, `detail`, `confirmLabel`, `onConfirm`, `onCancel` props — same usage as the advance confirm at ~line 232); existing `onAdvance` prop for post-action reload.

- [ ] **Step 1: Add state and handler**

Next to the existing `showBlockConfirm` state:

```typescript
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)
```

After `handleAdvanceClick`:

```typescript
  const handleRollback = useCallback(async () => {
    if (rollingBack) return
    setRollingBack(true)
    try {
      await rollbackBlock(programId, blockNum, waveExercises, getEffectiveMax)
      onAdvance()
    } finally {
      setRollingBack(false)
    }
  }, [rollingBack, programId, blockNum, waveExercises, getEffectiveMax, onAdvance])
```

Add `rollbackBlock` to the `blocks` import.

- [ ] **Step 2: Add the button**

Directly below the Advance button (after its closing tag, ~line 227):

```tsx
              {blockNum > 1 && (
                <button
                  onClick={() => setShowRollbackConfirm(true)}
                  disabled={rollingBack}
                  className="w-full mt-2 py-2 min-h-[44px] rounded-md cursor-pointer bg-transparent border border-border-elevated text-muted text-[15px] hover:border-accent active:border-accent disabled:opacity-50"
                >
                  ← Back to Block {blockNum - 1}
                </button>
              )}
```

- [ ] **Step 3: Add the confirm modal**

Inside the same `<AnimatePresence>` as the advance confirm, after the `showBlockConfirm` block:

```tsx
              {showRollbackConfirm && (
                <ConfirmModal
                  title="Go Back One Block?"
                  message={`This will return to Block ${blockNum - 1} and restore its training maxes.`}
                  detail="Your logged workouts stay in History; you'll get fresh sessions for the re-run."
                  confirmLabel="Go Back"
                  onConfirm={() => { setShowRollbackConfirm(false); handleRollback() }}
                  onCancel={() => setShowRollbackConfirm(false)}
                />
              )}
```

- [ ] **Step 4: Verify types and tests**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run test`
Expected: clean compile, all tests pass.

- [ ] **Step 5: Manual smoke test on the simulator**

Migration 014 requires a full rebuild (HMR does not run migrations):

```bash
cd /Users/dballi/projects/peak-tracker && PATH="$HOME/.cargo/bin:$PATH" npm run tauri ios dev
```

Verify: expand workout controls → "← Back to Block N−1" appears below "Start New Block" → confirm modal → after confirming, the header shows the prior block at Week 1, TMs show the restored values, and opening a previously-logged day gives blank sets while History still shows the old session.

- [ ] **Step 6: Commit**

```bash
git add src/components/workout/WorkoutControls.tsx
git commit -m "feat: Back One Block rollback UI in workout controls"
```
