# Block Rollback — Design

**Date:** 2026-08-10
**Status:** Approved
**Scope:** All wave programs (feature is program-agnostic, not template-scoped)

## Motivation

Block progression is one-way: `Start New Block` in `WorkoutControls.tsx` increments
`programs.block_num`, auto-inserts bumped training maxes, and there is no way back.

The 2026-08-09 backup shows why this hurts. The user stopped squatting and deadlifting
on June 2 (injury layoff, ~10 weeks), but kept training upper body — so blocks 41, 42,
and 43 advanced anyway (Jun 22, Jul 15, Aug 3), and each advance auto-bumped **all**
training maxes +5, including the lifts not being trained. The block counter and the
TMs now describe a lifter who doesn't exist, and there is no way to rewind.

## Decisions (user-confirmed)

1. **Backing up restores that block's TMs** — by appending new `training_maxes` rows
   (append-only rule preserved), not by editing history.
2. **Re-running a block gives fresh workouts; old logs stay intact** in History and on
   charts. Requires distinguishing runs of the same block.
3. **Navigation is "back one block at a time"** — a button beside `Start New Block`
   with a confirm modal, mirroring the advance pattern. No block picker.

## Data model — migration 014

`014_add_block_cycle.sql`, registered in `src-tauri/src/lib.rs` as
`version: 14, description: "add_block_cycle"`.

```sql
ALTER TABLE programs ADD COLUMN cycle INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workout_logs ADD COLUMN cycle INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS idx_workout_logs_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_logs_unique
  ON workout_logs (program_id, day_id, block_num, week_index, cycle);
```

*(Same column list as the migration 002 index, plus `cycle`.)*

`cycle` is a monotonic per-program counter: it increments on every rollback and is
stamped onto every new `workout_log`. Two runs of block 41 therefore never collide
with the unique index, and find-or-create keyed on the current cycle always yields
fresh sessions after a rollback. Forward advances do not change `cycle`.

Existing rows default to `cycle = 0` — no data backfill needed. Migrations must be
idempotent per house rules; `ALTER TABLE ADD COLUMN` is not naturally idempotent
under `IF NOT EXISTS`-less SQLite, but tauri-plugin-sql runs each version exactly
once, matching migrations 003/008 which use the same pattern.

## Rollback action

Lives in `WorkoutControls.tsx` beside the advance handler. On confirm, inside
`withWriteLock()`:

1. For each wave exercise, resolve the TM in effect at the target block
   (`block_num - 1`):

   ```sql
   SELECT value FROM training_maxes
   WHERE exercise_id = ? AND block_num <= ?
   ORDER BY block_num DESC, created_at DESC LIMIT 1
   ```

   If a row exists and its value differs from the current effective TM, append:

   ```sql
   INSERT INTO training_maxes (id, exercise_id, value, block_num, source)
   VALUES (?, ?, ?, ?, 'rollback')
   ```

   with `block_num = target`. If no historical TM exists, append nothing (current
   TM stands). `source` has no CHECK constraint; `'rollback'` is a new value that
   keeps provenance visible alongside `'template' | 'auto' | 'manual'`.

2. `UPDATE programs SET block_num = block_num - 1, current_week = 0,
   cycle = cycle + 1 WHERE id = ?`

Because the effective TM is *latest entry by `created_at`* (`useTrainingMaxes.ts`),
the appended rows take effect immediately with no reader changes.

## Plumbing

- **`useProgram.ts`** — select and expose `cycle` on the program object.
- **`useWorkoutLog.ts`** — new `cycle` parameter; both the find query and the
  `INSERT OR IGNORE` include it. All `INSERT OR REPLACE` set-log paths are keyed by
  `workout_log_id` and need no change.
- **`WorkoutControls.tsx`** — `handleAdvanceWeek`'s auto-TM query gains
  `AND wl.cycle = ?` so a re-run's Week 3 sets are not mixed with the original
  run's sets from the same block number.
- **`App.tsx` / `WorkoutView.tsx`** — thread `cycle` from `useProgram` down to
  `useWorkoutLog`.
- **History / charts** — no changes. `useHistory.ts` already orders by
  `started_at`, which remains correct across cycles.

## UI

- "← Back One Block" button below "Start New Block" in the expanded controls
  panel. Secondary styling (bordered, `text-muted`), 44px min touch target,
  `active:` state per iOS rules.
- Confirm modal mirroring the advance modal:
  - Title: "Go Back One Block?"
  - Message: "This will return to Block N and restore its training maxes. Your
    logged workouts stay in History; you'll get fresh sessions for the re-run."
- Hidden (not just disabled) when `block_num <= 1`.

## Edge cases

- **Block floor:** no rollback below block 1.
- **Mid-block rollback:** the current cycle's partial logs remain in History —
  accurate record of what was done; nothing is deleted.
- **Repeated rollback:** 43 → 42 → 41 increments `cycle` twice; each step restores
  that block's TMs. Fine.
- **Old backups:** JSON exports without `cycle` are unaffected (export includes it
  going forward is optional; import/export currently round-trips workouts by row
  fields and tolerates the added column defaulting to 0).
- **Rollback then advance:** advancing from a re-run block auto-calculates TMs from
  the current cycle's Week 3 logs only (per the `AND wl.cycle` guard) and inserts
  `'auto'` rows for the next block as today.

## Out of scope

- Block picker UI (revisit if step-back proves annoying).
- Any automatic TM adjustment for detraining — post-injury TMs (squat 275,
  deadlift 345, bench 275 per the 2026-08-03 knee-resilience design and the
  2026-08-09 backup analysis) are entered by hand in the TM editor.
- Deleting or editing historical workout logs.

## Testing

- Migration: fresh install and upgrade-from-013 both end with `cycle` columns and
  the widened unique index.
- Rollback restores the correct TM per exercise (multi-entry blocks resolve to the
  latest entry of the target block).
- After rollback, opening a previously-logged day/week yields a blank session; the
  old session still renders in History.
- Advance-after-rollback computes new TMs from the re-run's sets only.
- Rollback hidden at block 1.
