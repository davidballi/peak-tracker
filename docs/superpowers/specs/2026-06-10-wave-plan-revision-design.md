# Wave Periodization Plan Revision — Design

**Date:** 2026-06-10
**Status:** Approved
**Scope:** Wave Periodization template (`peak-strength-v1`) only — 5/3/1 untouched

## Motivation

A coach-level review of the Wave Periodization plan against the program-design option space identified three adopted improvements plus one hygiene item. User-reported experience confirmed the key finding: Week 2 feels like the hardest week of the cycle ("Wk2 can be a grind").

Analysis: the wave's volume curve is correct (21 → 18 → 12 working reps, descending), but the peak-set strain curve is inverted. Wk2's 85%×4 (~RPE 8.5–9, arriving as the third set of 4s) is harder than Wk3's 90%×2 (~RPE 8–8.5), so effort peaks mid-cycle instead of cresting in Wk3.

Goals (user-confirmed): strength on the big 4 first; athletic work (cleans, jumps, carries) is a valued ingredient, not filler.

## Decisions

### 1. Wk2 top set: 85%×4 → 82.5%×4

Re-grades the cycle into a true crescendo (~RPE 7 → 7 → 8, peaking Wk3). Applies to all four wave lifts. The "week of 4s" identity is preserved.

| Week | Working sets | Backoff |
|------|-------------|---------|
| Wk1 (5s) | 70%×5, 75%×5, 80%×3 | 70%×8 |
| Wk2 (4s) | 75%×4, 80%×4, **82.5%×4** (was 85%) | 75%×6 |
| Wk3 (3s) | 80%×3, 85%×2, 90%×2 | 80%×5 |
| Wk4 (deload) | 40%×5, 50%×5, 60%×5, **75%×1** (new) | — |

Concrete effect at current TMs: squat 275→270, bench 230→225, OHP 160→155, deadlift 345→335 on the Wk2 top set.

### 2. Deload: add one crisp single @ 75%

Appended as a 4th set on the deload week for each wave lift (reps 1, percentage 0.75, not a backoff). Purpose: keep the groove/technique sharp during the deload without meaningful fatigue (~RPE 4–5). 75% chosen over 70% as more groove-relevant while still trivially easy.

### 3. Superset re-pairing (post-activation potentiation)

Current pairings are backwards from a contrast-training standpoint (box jumps with OHP, leg raises with squat). Re-pair so explosive movements potentiate the matching heavy lift:

- **Day 1:** Box jump 3×5 supersets with back squat (moves from Day 3). Note: "Superset w/ squat. Jump between squat sets — reset each rep."
- **Day 2:** NEW exercise — Plyo push-up 3×5, bodyweight, supersets with bench (`exercise_key: plyo_pushup`, category `ss`). Note: "Superset w/ bench. Explosive — hands leave the floor."
- **Day 2:** Weighted sit-up 4×12 @35 moves to the end of Day 2 as a core finisher (category `ss` → `acc`, note: "Core finisher.").
- **Day 3:** Hanging leg raise 4×10 supersets with OHP (moves from Day 1). Note: "Superset w/ OHP. Trunk control."
- **Day 4:** untouched.

Box jump and hanging leg raise both currently sit at slot index 2 of their respective days, so the move is a clean positional swap of `(day_id, exercise_index)` between the two rows.

### 4. TM progression rule (documentation only)

Appended to the program template description: **after each deload, add 10 lb to squat/deadlift TM and 5 lb to bench/OHP TM.** Manual practice — the user adds the new TM as usual (`training_maxes` remains append-only). No in-app automation.

New description text:
> Wave-loaded periodization: 3 working weeks + 1 deload. 4 days/week targeting squat, bench, OHP, and deadlift with technical primers, supersets, and accessories. TM progression: after each deload, add 10 lb to squat/deadlift and 5 lb to bench/OHP.

## Explicitly out of scope (user decisions)

- Autoregulation (AMRAP sets, RPE loading, readiness adjustments)
- Bench frequency changes / upper-lower restructure
- Deload-week 1RM testing protocols
- Press/pull rebalance (chest fly → row)
- Day 4 subtitle typo ("Upper Hypertrophy + Pull" on deadlift day) — part of skipped dimension
- Macro periodization (blocks, leader/anchor)
- Front squat placement before deadlift day — watch item only; act only if Wk3 deadlifts degrade

## Implementation Design

Follows the established pattern from migrations 004/005/007: one SQL migration updates **both** template tables and live user tables (scoped to `peak-strength-v1` and forks via `source_template_id`), and `src/lib/templates.ts` is updated to match for fresh installs.

### Migration `009_revise_wave_plan.sql`

Registered in `src-tauri/src/lib.rs` as version 9. Sections:

1. **Wk2 percentage** — `UPDATE … SET percentage = 0.825 WHERE week_index = 1 AND set_index = 2 AND is_backoff = 0` against `wave_week_set_templates` (joined to `peak-strength-v1`) and `wave_week_sets` (joined through programs with `source_template_id = 'peak-strength-v1'`), mirroring migration 007's join shape.
2. **Deload single** — `INSERT` a new row (set_index 3, reps 1, percentage 0.75, is_backoff 0) into `wave_week_set_templates` and `wave_week_sets` for each week_index 3 wave week, using `INSERT … SELECT` so every fork gets one row per lift. IDs generated with `lower(hex(randomblob(16)))` (SQLite migrations cannot call the JS uuid package; random 32-hex TEXT ids are acceptable here).
3. **Superset swap** — exchange `(day_id, exercise_index)` between the `box_jump` and `hang_leg_raise` rows **within each program fork**, matched by `exercise_key` (robust to user renames). Use the `CREATE TEMPORARY TABLE` pattern from migration 006 to capture both positions per program before either UPDATE runs. Guarded so it no-ops gracefully if either exercise was deleted in a fork. Update note text on both. Archived exercises still swap (harmless).
4. **Plyo push-up insert** — `INSERT … SELECT` a new `plyo_pushup` exercise row into each fork's Day 2 at the weighted sit-up's current `exercise_index`; move `wsitup_b` to `MAX(exercise_index) + 1` on its day, set category to `acc` and note to "Core finisher." Order of operations: capture sit-up's index first (temp table), then move sit-up, then insert plyo push-up at the captured index.
5. **Description** — `UPDATE program_templates SET description = …` for `peak-strength-v1`.

All statements scoped so the 5/3/1 template (`531-classic-v1`) and any non-template programs are untouched. The 5/3/1 template also contains exercises named "Hanging Leg Raise" (`531_ab1`, `531_leg_raise`) — the template-id scoping excludes them.

### `src/lib/templates.ts`

Mirror every change in `PEAK_STRENGTH_TEMPLATE`: Wk2 set percentage, deload 4th set, box_jump ↔ hang_leg_raise day/position swap with new notes, plyo_pushup insertion, wsitup_b move/category/note, description text.

### Constraints

- **Full rebuild required:** HMR does not reload migrations — testing the migration path requires a full Tauri rebuild and reinstall on device/simulator (per CLAUDE.md).
- **No transaction wrappers in app code needed** — migrations run through tauri-plugin-sql's migration runner, which already wraps each migration.
- Past workout history is unaffected: `set_logs` stores actual weights/reps by value, not FK references to `wave_week_sets`.
- If the user is mid-cycle on Wk2 when the migration lands, the displayed top-set weight simply drops 5–10 lb. Acceptable.

## Verification

1. **Migration path:** build to iOS simulator with a copy of an existing DB (or run the app over the current dev DB); confirm the Wk2 top set reads `roundToNearest5(TM × 0.825)` for each lift (270/225/155/335 if TMs equal the template seeds 325/270/190/405), deload shows a 4th set (×1 @ 75%), box jump renders on Day 1 supersetted under squat, plyo push-up on Day 2, leg raise on Day 3, sit-up at end of Day 2.
2. **Fresh-install path:** delete app, reinstall, fork the template, verify identical structure from seed.
3. **Scope check:** open 5/3/1 template and confirm it is unchanged (still 3 deload sets, leg raises in place).
4. **History check:** History charts and past workout logs unchanged.
