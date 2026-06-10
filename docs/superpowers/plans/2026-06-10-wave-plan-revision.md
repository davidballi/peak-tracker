# Wave Plan Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved wave plan revision (spec: `docs/superpowers/specs/2026-06-10-wave-plan-revision-design.md`): Wk2 top set 85%→82.5%, deload single @75%×1, PAP superset re-pairing (box jump↔squat, plyo push-up↔bench, leg raise↔OHP), and TM progression rule in the description — delivered as migration 009 + `templates.ts` mirror.

**Architecture:** Follows the migration-007 pattern: one SQL migration updates both template tables and live user tables (scoped to `peak-strength-v1` and its forks), registered in `lib.rs`; `src/lib/templates.ts` mirrors every change for fresh installs (on fresh installs migrations run before JS seeding, so the migration's template statements no-op and seeding supplies the new data). The migration is validated locally by a shell test harness that builds a fixture DB with `/usr/bin/sqlite3`, runs migrations 001–009, and asserts the results — written first, TDD-style.

**Tech Stack:** SQLite (tauri-plugin-sql migrations), TypeScript (templates seed), Rust (migration registration only), bash + sqlite3 CLI (migration test), vitest (existing suite must stay green).

---

## Context for a zero-context engineer

- **Two-tier data model:** `*_templates` tables are read-only seeds; user programs are deep-forked copies (`programs`/`days`/`exercises`/`wave_configs`/`wave_weeks`/`wave_week_sets`). A migration must update BOTH tiers: templates for not-yet-forked installs, user tables for the live program on the user's phone.
- **No `day_templates` table.** Template "days" are flattened columns (`day_index`, `day_name`, `day_subtitle`, `day_focus`) on each `exercise_templates` row. User-side days are real rows in `days`, referenced by `exercises.day_id`.
- **Matching rule:** match exercises by `exercise_key` (survives user renames), never by `name`. Exclude archived rows (`archived_at IS NULL`) when picking swap targets.
- **Scope guard:** every statement must be scoped to `template_id = 'peak-strength-v1'` (templates) or `programs.source_template_id = 'peak-strength-v1'` (user side). The 5/3/1 template (`531-classic-v1`) and builder-created programs (`source_template_id IS NULL`) must be untouched. The 5/3/1 template also has exercises named "Hanging Leg Raise" — the scope guard is what protects them.
- **TEMP tables in migrations are safe:** the migration runner executes each file on a single connection (proven pattern — see `006_renumber_post_import_blocks.sql`). The runtime app code can NOT use transactions (connection pool), but migrations can use TEMP tables.
- **IDs:** template-side inserts use deterministic ids matching the seed convention (`peak-strength-v1_…`, see `src/lib/seed.ts:25`); user-side inserts use `lower(hex(randomblob(16)))` (SQL can't call the JS uuid package; a random 32-hex TEXT id is fine).
- **Deliberately untouched:** `src/lib/wave-defaults.ts` (builder-program wave defaults) keeps the old scheme — migration 007 set the precedent of scoping wave tuning to the template only, and `wave-defaults.test.ts` pins those percentages on purpose. Do not "fix" it.
- **Style:** no semicolons in TS, single quotes, trailing commas. ASCII-only strings in SQL/TS notes (no em-dashes).

## File Structure

- Create: `scripts/test-migration-009.sh` — fixture-DB test harness for the migration (committed, rerunnable)
- Create: `src-tauri/migrations/009_revise_wave_plan.sql` — the migration (template + user tables)
- Modify: `src-tauri/src/lib.rs` — register migration version 9 (after the version-8 entry, ~line 58)
- Modify: `src/lib/templates.ts` — mirror all changes in `PEAK_STRENGTH_TEMPLATE` (description, 4 wave configs, Day 1/2/3 exercise lists)

---

### Task 1: Migration test harness (write the failing test)

**Files:**
- Create: `scripts/test-migration-009.sh`

- [ ] **Step 1: Write the test script**

Create `scripts/test-migration-009.sh` with exactly this content:

```bash
#!/usr/bin/env bash
# Test harness for migration 009_revise_wave_plan.sql.
# Builds a fixture DB (migrations 001-008 + seeded template/fork rows),
# runs 009, and asserts every change — including scope exclusions
# (5/3/1 template, builder programs, archived exercises).
set -euo pipefail
cd "$(dirname "$0")/.."

MIG_DIR="src-tauri/migrations"
DB="$(mktemp -t forge-mig-009-XXXXXX).db"
trap 'rm -f "$DB"' EXIT

[ -f "$MIG_DIR/009_revise_wave_plan.sql" ] || { echo "FAIL: $MIG_DIR/009_revise_wave_plan.sql does not exist"; exit 1; }

for n in 001 002 003 004 005 006 007 008; do
  sqlite3 "$DB" < "$MIG_DIR"/${n}_*.sql
done

sqlite3 "$DB" <<'FIXTURE'
-- ===== Template tier: peak-strength-v1 (pre-009 state) =====
INSERT INTO program_templates (id, name, author, description, days_per_week)
VALUES ('peak-strength-v1', 'Wave Periodization', 'Forge', 'old description', 4);

INSERT INTO exercise_templates (id, template_id, day_index, day_name, day_subtitle, day_focus, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave) VALUES
('peak-strength-v1_d0_e1', 'peak-strength-v1', 0, 'Day 1', 'Lower Body Strength', 'Squat + Posterior Chain', 1, 'squat',          'Back Squat',        'absolute', 0, 0,  0,  '', 1),
('peak-strength-v1_d0_e2', 'peak-strength-v1', 0, 'Day 1', 'Lower Body Strength', 'Squat + Posterior Chain', 2, 'hang_leg_raise', 'Hanging Leg Raise', 'ss',       4, 10, 0,  'Superset w/ squat. Trunk control.', 0),
('peak-strength-v1_d1_e2', 'peak-strength-v1', 1, 'Day 2', 'Upper Body Strength', 'Bench Press + Chest/Tri', 2, 'wsitup_b',       'Weighted Sit-Up',   'ss',       4, 12, 35, 'Superset w/ bench.', 0),
('peak-strength-v1_d1_e7', 'peak-strength-v1', 1, 'Day 2', 'Upper Body Strength', 'Bench Press + Chest/Tri', 7, 'tri_ext',        'Tricep Extension',  'acc',      3, 12, 90, '', 0),
('peak-strength-v1_d2_e2', 'peak-strength-v1', 2, 'Day 3', 'Athletic / Dynamic',  'OHP + Unilateral + Core', 2, 'box_jump',       'Box Jump',          'ss',       3, 5,  0,  'Superset w/ OHP. Reset each rep.', 0);

INSERT INTO wave_config_templates (id, exercise_template_id, base_max)
VALUES ('peak-strength-v1_d0_e1_wc', 'peak-strength-v1_d0_e1', 325);
INSERT INTO wave_week_templates (id, wave_config_id, week_index, label) VALUES
('peak-strength-v1_d0_e1_wc_wk1', 'peak-strength-v1_d0_e1_wc', 1, 'Wk2 (4s)'),
('peak-strength-v1_d0_e1_wc_wk3', 'peak-strength-v1_d0_e1_wc', 3, 'Wk4 (deload)');
INSERT INTO wave_week_set_templates (id, wave_week_id, set_index, reps, percentage, is_backoff) VALUES
('peak-strength-v1_d0_e1_wc_wk1_s0', 'peak-strength-v1_d0_e1_wc_wk1', 0, 4, 0.75, 0),
('peak-strength-v1_d0_e1_wc_wk1_s1', 'peak-strength-v1_d0_e1_wc_wk1', 1, 4, 0.80, 0),
('peak-strength-v1_d0_e1_wc_wk1_s2', 'peak-strength-v1_d0_e1_wc_wk1', 2, 4, 0.85, 0),
('peak-strength-v1_d0_e1_wc_wk1_s3', 'peak-strength-v1_d0_e1_wc_wk1', 3, 6, 0.75, 1),
('peak-strength-v1_d0_e1_wc_wk3_s0', 'peak-strength-v1_d0_e1_wc_wk3', 0, 5, 0.40, 0),
('peak-strength-v1_d0_e1_wc_wk3_s1', 'peak-strength-v1_d0_e1_wc_wk3', 1, 5, 0.50, 0),
('peak-strength-v1_d0_e1_wc_wk3_s2', 'peak-strength-v1_d0_e1_wc_wk3', 2, 5, 0.60, 0);

-- ===== Template tier: 5/3/1 control (must remain untouched) =====
INSERT INTO program_templates (id, name, author, description, days_per_week)
VALUES ('531-classic-v1', 'Wendler 531', 'Jim Wendler', '531 description', 4);
INSERT INTO exercise_templates (id, template_id, day_index, day_name, day_subtitle, day_focus, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave) VALUES
('531-classic-v1_d0_e0', '531-classic-v1', 0, 'Day 1', 'Squat Day', 'Squat + Leg Accessories', 0, '531_squat', 'Back Squat', 'absolute', 0, 0, 0, '', 1),
('531-classic-v1_d0_e1', '531-classic-v1', 0, 'Day 1', 'Squat Day', 'Squat + Leg Accessories', 1, '531_leg_raise', 'Hanging Leg Raise', 'acc', 5, 15, 0, '', 0);
INSERT INTO wave_config_templates (id, exercise_template_id, base_max)
VALUES ('531-classic-v1_d0_e0_wc', '531-classic-v1_d0_e0', 300);
INSERT INTO wave_week_templates (id, wave_config_id, week_index, label) VALUES
('531-classic-v1_d0_e0_wc_wk1', '531-classic-v1_d0_e0_wc', 1, 'Wk2 (3s)'),
('531-classic-v1_d0_e0_wc_wk3', '531-classic-v1_d0_e0_wc', 3, 'Wk4 (deload)');
INSERT INTO wave_week_set_templates (id, wave_week_id, set_index, reps, percentage, is_backoff) VALUES
('531-classic-v1_d0_e0_wc_wk1_s2', '531-classic-v1_d0_e0_wc_wk1', 2, 3, 0.90, 0),
('531-classic-v1_d0_e0_wc_wk3_s0', '531-classic-v1_d0_e0_wc_wk3', 0, 5, 0.40, 0),
('531-classic-v1_d0_e0_wc_wk3_s1', '531-classic-v1_d0_e0_wc_wk3', 1, 5, 0.50, 0),
('531-classic-v1_d0_e0_wc_wk3_s2', '531-classic-v1_d0_e0_wc_wk3', 2, 5, 0.60, 0);

-- ===== User tier: fork of peak-strength-v1 =====
INSERT INTO programs (id, name, source_template_id, current_day, current_week, block_num, is_active)
VALUES ('prog1', 'Wave Periodization', 'peak-strength-v1', 0, 0, 1, 1);
INSERT INTO days (id, program_id, day_index, name, subtitle, focus) VALUES
('p1d1', 'prog1', 0, 'Day 1', 'Lower Body Strength', 'Squat + Posterior Chain'),
('p1d2', 'prog1', 1, 'Day 2', 'Upper Body Strength', 'Bench Press + Chest/Tri'),
('p1d3', 'prog1', 2, 'Day 3', 'Athletic / Dynamic',  'OHP + Unilateral + Core');
INSERT INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave) VALUES
('ex-squat', 'p1d1', 1, 'squat',          'Back Squat',        'absolute', 0, 0,  0,  '', 1),
('ex-lr',    'p1d1', 2, 'hang_leg_raise', 'Hanging Leg Raise', 'ss',       4, 10, 0,  'Superset w/ squat. Trunk control.', 0),
('ex-su',    'p1d2', 2, 'wsitup_b',       'Weighted Sit-Up',   'ss',       4, 12, 35, 'Superset w/ bench.', 0),
('ex-tri',   'p1d2', 7, 'tri_ext',        'Tricep Extension',  'acc',      3, 12, 90, '', 0),
('ex-bj',    'p1d3', 2, 'box_jump',       'Box Jump',          'ss',       3, 5,  0,  'Superset w/ OHP. Reset each rep.', 0);
-- Archived duplicate box_jump (e.g. left over from a PWA import) — swap must ignore it
INSERT INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave, archived_at)
VALUES ('ex-bj-arch', 'p1d1', 5, 'box_jump', 'Box Jump', 'ss', 3, 5, 0, '', 0, datetime('now'));

INSERT INTO wave_configs (id, exercise_id, base_max) VALUES ('wc-squat', 'ex-squat', 325);
INSERT INTO wave_weeks (id, wave_config_id, week_index, label) VALUES
('ww-wk2', 'wc-squat', 1, 'Wk2 (4s)'),
('ww-wk4', 'wc-squat', 3, 'Wk4 (deload)');
INSERT INTO wave_week_sets (id, wave_week_id, set_index, reps, percentage, is_backoff) VALUES
('uws-0', 'ww-wk2', 0, 4, 0.75, 0),
('uws-1', 'ww-wk2', 1, 4, 0.80, 0),
('uws-2', 'ww-wk2', 2, 4, 0.85, 0),
('uws-3', 'ww-wk2', 3, 6, 0.75, 1),
('uws-d0', 'ww-wk4', 0, 5, 0.40, 0),
('uws-d1', 'ww-wk4', 1, 5, 0.50, 0),
('uws-d2', 'ww-wk4', 2, 5, 0.60, 0);

-- ===== User tier: builder-created program (source_template_id NULL, untouched) =====
INSERT INTO programs (id, name, source_template_id, current_day, current_week, block_num, is_active)
VALUES ('prog2', 'My Builder Program', NULL, 0, 0, 1, 0);
INSERT INTO days (id, program_id, day_index, name, subtitle, focus)
VALUES ('p2d1', 'prog2', 0, 'Day 1', '', '');
INSERT INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave) VALUES
('p2-bj', 'p2d1', 0, 'box_jump', 'Box Jump',        'ss', 3, 5,  0,  'my note', 0),
('p2-su', 'p2d1', 1, 'wsitup_b', 'Weighted Sit-Up', 'ss', 4, 12, 35, 'my note', 0),
('p2-sq', 'p2d1', 2, 'squat',    'Back Squat',      'absolute', 0, 0, 0, '', 1);
INSERT INTO wave_configs (id, exercise_id, base_max) VALUES ('wc-p2', 'p2-sq', 200);
INSERT INTO wave_weeks (id, wave_config_id, week_index, label) VALUES
('p2-wk2', 'wc-p2', 1, 'Wk2 (4s)'),
('p2-wk4', 'wc-p2', 3, 'Wk4 (deload)');
INSERT INTO wave_week_sets (id, wave_week_id, set_index, reps, percentage, is_backoff) VALUES
('p2ws-2', 'p2-wk2', 2, 4, 0.85, 0),
('p2ws-d0', 'p2-wk4', 0, 5, 0.40, 0);
FIXTURE

sqlite3 "$DB" < "$MIG_DIR/009_revise_wave_plan.sql"

assert() {
  local label="$1" actual="$2" expected="$3"
  if [ "$actual" != "$expected" ]; then
    echo "FAIL: $label"
    echo "  expected: $expected"
    echo "  actual:   $actual"
    exit 1
  fi
  echo "PASS: $label"
}

q() { sqlite3 "$DB" "$1"; }

# --- 1. Wk2 top set 0.85 -> 0.825 ---
assert "template Wk2 S3 percentage" \
  "$(q "SELECT percentage FROM wave_week_set_templates WHERE id = 'peak-strength-v1_d0_e1_wc_wk1_s2'")" "0.825"
assert "template Wk2 other sets unchanged" \
  "$(q "SELECT group_concat(percentage) FROM wave_week_set_templates WHERE wave_week_id = 'peak-strength-v1_d0_e1_wc_wk1' AND set_index != 2 ORDER BY set_index")" "0.75,0.8,0.75"
assert "user Wk2 S3 percentage" "$(q "SELECT percentage FROM wave_week_sets WHERE id = 'uws-2'")" "0.825"
assert "user Wk2 backoff unchanged" "$(q "SELECT percentage FROM wave_week_sets WHERE id = 'uws-3'")" "0.75"
assert "531 template Wk2 untouched" \
  "$(q "SELECT percentage FROM wave_week_set_templates WHERE id = '531-classic-v1_d0_e0_wc_wk1_s2'")" "0.9"
assert "builder program Wk2 untouched" "$(q "SELECT percentage FROM wave_week_sets WHERE id = 'p2ws-2'")" "0.85"

# --- 2. Deload single 75% x1 appended ---
assert "template deload single" \
  "$(q "SELECT set_index || '|' || reps || '|' || percentage || '|' || is_backoff FROM wave_week_set_templates WHERE id = 'peak-strength-v1_d0_e1_wc_wk3_s3'")" "3|1|0.75|0"
assert "template deload set count" \
  "$(q "SELECT COUNT(*) FROM wave_week_set_templates WHERE wave_week_id = 'peak-strength-v1_d0_e1_wc_wk3'")" "4"
assert "user deload single" \
  "$(q "SELECT COUNT(*) FROM wave_week_sets WHERE wave_week_id = 'ww-wk4' AND set_index = 3 AND reps = 1 AND percentage = 0.75 AND is_backoff = 0")" "1"
assert "user deload single id is 32-hex" \
  "$(q "SELECT length(id) FROM wave_week_sets WHERE wave_week_id = 'ww-wk4' AND set_index = 3")" "32"
assert "531 template deload untouched" \
  "$(q "SELECT COUNT(*) FROM wave_week_set_templates WHERE wave_week_id = '531-classic-v1_d0_e0_wc_wk3'")" "3"
assert "builder deload untouched" \
  "$(q "SELECT COUNT(*) FROM wave_week_sets WHERE wave_week_id = 'p2-wk4'")" "1"

# --- 3. Superset swap: box_jump <-> hang_leg_raise ---
assert "template box_jump moved to Day 1" \
  "$(q "SELECT day_index || '|' || day_name || '|' || day_subtitle || '|' || day_focus || '|' || exercise_index FROM exercise_templates WHERE id = 'peak-strength-v1_d2_e2'")" \
  "0|Day 1|Lower Body Strength|Squat + Posterior Chain|2"
assert "template box_jump note" \
  "$(q "SELECT note FROM exercise_templates WHERE id = 'peak-strength-v1_d2_e2'")" \
  "Superset w/ squat. Jump between squat sets, reset each rep."
assert "template leg raise moved to Day 3" \
  "$(q "SELECT day_index || '|' || day_name || '|' || day_subtitle || '|' || day_focus || '|' || exercise_index FROM exercise_templates WHERE id = 'peak-strength-v1_d0_e2'")" \
  "2|Day 3|Athletic / Dynamic|OHP + Unilateral + Core|2"
assert "template leg raise note" \
  "$(q "SELECT note FROM exercise_templates WHERE id = 'peak-strength-v1_d0_e2'")" \
  "Superset w/ OHP. Trunk control."
assert "user box_jump on Day 1 slot 2" \
  "$(q "SELECT day_id || '|' || exercise_index || '|' || note FROM exercises WHERE id = 'ex-bj'")" \
  "p1d1|2|Superset w/ squat. Jump between squat sets, reset each rep."
assert "user leg raise on Day 3 slot 2" \
  "$(q "SELECT day_id || '|' || exercise_index || '|' || note FROM exercises WHERE id = 'ex-lr'")" \
  "p1d3|2|Superset w/ OHP. Trunk control."
assert "archived box_jump untouched" \
  "$(q "SELECT day_id || '|' || exercise_index FROM exercises WHERE id = 'ex-bj-arch'")" "p1d1|5"
assert "531 leg raise untouched" \
  "$(q "SELECT day_index || '|' || exercise_index FROM exercise_templates WHERE id = '531-classic-v1_d0_e1'")" "0|1"
assert "builder box_jump untouched" \
  "$(q "SELECT day_id || '|' || exercise_index || '|' || note FROM exercises WHERE id = 'p2-bj'")" "p2d1|0|my note"

# --- 4. Plyo push-up insert + sit-up move ---
assert "template plyo inserted" \
  "$(q "SELECT day_index || '|' || exercise_index || '|' || exercise_key || '|' || category || '|' || sets || '|' || reps || '|' || note FROM exercise_templates WHERE id = 'peak-strength-v1_d1_plyo'")" \
  "1|2|plyo_pushup|ss|3|5|Superset w/ bench. Explosive - hands leave the floor."
assert "template sit-up moved to end as acc" \
  "$(q "SELECT exercise_index || '|' || category || '|' || note FROM exercise_templates WHERE id = 'peak-strength-v1_d1_e2'")" \
  "8|acc|Core finisher."
assert "user plyo inserted on Day 2 slot 2" \
  "$(q "SELECT COUNT(*) FROM exercises WHERE day_id = 'p1d2' AND exercise_key = 'plyo_pushup' AND exercise_index = 2 AND category = 'ss' AND sets = 3 AND reps = 5")" "1"
assert "user sit-up moved to end as acc" \
  "$(q "SELECT exercise_index || '|' || category || '|' || note FROM exercises WHERE id = 'ex-su'")" \
  "8|acc|Core finisher."
assert "builder sit-up untouched" \
  "$(q "SELECT exercise_index || '|' || category || '|' || note FROM exercises WHERE id = 'p2-su'")" "1|ss|my note"
assert "no plyo on builder program" \
  "$(q "SELECT COUNT(*) FROM exercises WHERE day_id = 'p2d1' AND exercise_key = 'plyo_pushup'")" "0"

# --- 5. Description ---
assert "template description updated" \
  "$(q "SELECT description LIKE '%TM progression: after each deload, add 10 lb to squat/deadlift and 5 lb to bench/OHP.%' FROM program_templates WHERE id = 'peak-strength-v1'")" "1"
assert "531 description untouched" \
  "$(q "SELECT description FROM program_templates WHERE id = '531-classic-v1'")" "531 description"

# --- 6. No work tables accidentally created as permanent (TEMPORARY keyword missing) ---
assert "no permanent work tables leaked" \
  "$(q "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name LIKE '\_%' ESCAPE '\'")" "0"

echo ""
echo "ALL ASSERTIONS PASSED"
```

Note on the plyo template-row assertion: `default_weight` is intentionally omitted from the concatenation to keep the expected string readable; sets/reps/category/note cover the inserted values that matter.

- [ ] **Step 2: Make it executable and run it to verify it fails**

Run:
```bash
chmod +x scripts/test-migration-009.sh && bash scripts/test-migration-009.sh
```
Expected: `FAIL: src-tauri/migrations/009_revise_wave_plan.sql does not exist` with exit code 1. (Do NOT commit yet — the commit lands with the green migration in Task 2.)

---

### Task 2: Migration 009

**Files:**
- Create: `src-tauri/migrations/009_revise_wave_plan.sql`
- Test: `scripts/test-migration-009.sh` (from Task 1)

- [ ] **Step 1: Write the migration**

Create `src-tauri/migrations/009_revise_wave_plan.sql` with exactly this content:

```sql
-- Migration 009: Revise Wave Periodization plan
-- Design: docs/superpowers/specs/2026-06-10-wave-plan-revision-design.md
--
-- 1. Wk2 top set 85% -> 82.5%: the wave's volume curve descends correctly,
--    but 85%x4 made Wk2 the peak-strain week (~RPE 9) over Wk3's 90%x2.
--    82.5%x4 restores the crescendo so effort peaks in Wk3.
-- 2. Deload gains a crisp single @ 75% (4th set) to keep the groove sharp.
-- 3. Superset re-pairing for post-activation potentiation: box jump moves
--    to Day 1 with squat, hanging leg raise to Day 3 with OHP (a clean
--    (day, slot) swap), and a new plyo push-up pairs with bench on Day 2
--    (weighted sit-up moves to the end of Day 2 as a plain accessory).
-- 4. Program description documents the TM progression rule.
--
-- Scoped to peak-strength-v1 and its forks. 5/3/1 and builder programs
-- untouched. Exercises matched by exercise_key (survives renames);
-- archived rows excluded. Percentage updates guarded with `= 0.85` so a
-- hand-edited top set is respected. All statements no-op gracefully when
-- their target is missing (fresh installs run migrations before seeding).

-- ============================================================
-- TEMPLATE TABLES (scope: peak-strength-v1)
-- ============================================================

-- 1a. Wk2 top set: 85% -> 82.5%
UPDATE wave_week_set_templates SET percentage = 0.825
  WHERE set_index = 2 AND is_backoff = 0 AND percentage = 0.85
  AND wave_week_id IN (
    SELECT wwt.id FROM wave_week_templates wwt
    JOIN wave_config_templates wct ON wwt.wave_config_id = wct.id
    JOIN exercise_templates et ON wct.exercise_template_id = et.id
    WHERE wwt.week_index = 1 AND et.template_id = 'peak-strength-v1'
  );

-- 2a. Deload single: 75% x1 as set_index 3 (deterministic seed-style id)
INSERT INTO wave_week_set_templates (id, wave_week_id, set_index, reps, percentage, is_backoff)
SELECT wwt.id || '_s3', wwt.id, 3, 1, 0.75, 0
FROM wave_week_templates wwt
JOIN wave_config_templates wct ON wwt.wave_config_id = wct.id
JOIN exercise_templates et ON wct.exercise_template_id = et.id
WHERE wwt.week_index = 3 AND et.template_id = 'peak-strength-v1'
  AND NOT EXISTS (
    SELECT 1 FROM wave_week_set_templates s
    WHERE s.wave_week_id = wwt.id AND s.set_index = 3
  );

-- 3a. Swap box_jump <-> hang_leg_raise day placement.
-- Capture both originals first: the second UPDATE needs pre-swap values.
CREATE TEMPORARY TABLE _tswap AS
SELECT bj.id AS bj_id, lr.id AS lr_id,
       bj.day_index AS bj_day_index, bj.day_name AS bj_day_name,
       bj.day_subtitle AS bj_day_subtitle, bj.day_focus AS bj_day_focus,
       bj.exercise_index AS bj_ei,
       lr.day_index AS lr_day_index, lr.day_name AS lr_day_name,
       lr.day_subtitle AS lr_day_subtitle, lr.day_focus AS lr_day_focus,
       lr.exercise_index AS lr_ei
FROM exercise_templates bj, exercise_templates lr
WHERE bj.template_id = 'peak-strength-v1' AND bj.exercise_key = 'box_jump'
  AND lr.template_id = 'peak-strength-v1' AND lr.exercise_key = 'hang_leg_raise';

UPDATE exercise_templates SET
  day_index    = (SELECT lr_day_index FROM _tswap),
  day_name     = (SELECT lr_day_name FROM _tswap),
  day_subtitle = (SELECT lr_day_subtitle FROM _tswap),
  day_focus    = (SELECT lr_day_focus FROM _tswap),
  exercise_index = (SELECT lr_ei FROM _tswap),
  note = 'Superset w/ squat. Jump between squat sets, reset each rep.'
WHERE id = (SELECT bj_id FROM _tswap);

UPDATE exercise_templates SET
  day_index    = (SELECT bj_day_index FROM _tswap),
  day_name     = (SELECT bj_day_name FROM _tswap),
  day_subtitle = (SELECT bj_day_subtitle FROM _tswap),
  day_focus    = (SELECT bj_day_focus FROM _tswap),
  exercise_index = (SELECT bj_ei FROM _tswap),
  note = 'Superset w/ OHP. Trunk control.'
WHERE id = (SELECT lr_id FROM _tswap);

DROP TABLE _tswap;

-- 4a. Plyo push-up onto Day 2 at the sit-up's slot; sit-up to end of day.
CREATE TEMPORARY TABLE _tsitup AS
SELECT et.id AS su_id, et.day_index AS su_day_index, et.day_name AS su_day_name,
       et.day_subtitle AS su_day_subtitle, et.day_focus AS su_day_focus,
       et.exercise_index AS su_ei,
       (SELECT MAX(e2.exercise_index) FROM exercise_templates e2
         WHERE e2.template_id = 'peak-strength-v1' AND e2.day_index = et.day_index) AS day_max
FROM exercise_templates et
WHERE et.template_id = 'peak-strength-v1' AND et.exercise_key = 'wsitup_b';

UPDATE exercise_templates SET
  exercise_index = (SELECT day_max + 1 FROM _tsitup),
  category = 'acc',
  note = 'Core finisher.'
WHERE id = (SELECT su_id FROM _tsitup);

INSERT INTO exercise_templates (id, template_id, day_index, day_name, day_subtitle, day_focus, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave)
SELECT 'peak-strength-v1_d1_plyo', 'peak-strength-v1',
       su_day_index, su_day_name, su_day_subtitle, su_day_focus, su_ei,
       'plyo_pushup', 'Plyo Push-Up', 'ss', 3, 5, 0,
       'Superset w/ bench. Explosive - hands leave the floor.', 0
FROM _tsitup
WHERE NOT EXISTS (SELECT 1 FROM exercise_templates WHERE id = 'peak-strength-v1_d1_plyo');

DROP TABLE _tsitup;

-- 5a. Description: document the TM progression rule.
UPDATE program_templates SET description = 'Wave-loaded periodization: 3 working weeks + 1 deload. 4 days/week targeting squat, bench, OHP, and deadlift with technical primers, supersets, and accessories. TM progression: after each deload, add 10 lb to squat/deadlift and 5 lb to bench/OHP.'
WHERE id = 'peak-strength-v1';

-- ============================================================
-- USER TABLES (scope: programs forked from peak-strength-v1)
-- ============================================================

-- 1b. Wk2 top set: 85% -> 82.5%
UPDATE wave_week_sets SET percentage = 0.825
  WHERE set_index = 2 AND is_backoff = 0 AND percentage = 0.85
  AND wave_week_id IN (
    SELECT ww.id FROM wave_weeks ww
    JOIN wave_configs wc ON ww.wave_config_id = wc.id
    JOIN exercises e ON wc.exercise_id = e.id
    JOIN days d ON e.day_id = d.id
    JOIN programs p ON d.program_id = p.id
    WHERE ww.week_index = 1 AND p.source_template_id = 'peak-strength-v1'
  );

-- 2b. Deload single: 75% x1 as set_index 3
INSERT INTO wave_week_sets (id, wave_week_id, set_index, reps, percentage, is_backoff)
SELECT lower(hex(randomblob(16))), ww.id, 3, 1, 0.75, 0
FROM wave_weeks ww
JOIN wave_configs wc ON ww.wave_config_id = wc.id
JOIN exercises e ON wc.exercise_id = e.id
JOIN days d ON e.day_id = d.id
JOIN programs p ON d.program_id = p.id
WHERE ww.week_index = 3 AND p.source_template_id = 'peak-strength-v1'
  AND NOT EXISTS (
    SELECT 1 FROM wave_week_sets s
    WHERE s.wave_week_id = ww.id AND s.set_index = 3
  );

-- 3b. Swap box_jump <-> hang_leg_raise per fork.
-- Pick one active row per key per program (archived rows excluded).
CREATE TEMPORARY TABLE _uswap AS
SELECT p.id AS program_id,
  (SELECT e.id FROM exercises e JOIN days d ON e.day_id = d.id
     WHERE d.program_id = p.id AND e.exercise_key = 'box_jump' AND e.archived_at IS NULL
     ORDER BY e.rowid LIMIT 1) AS bj_id,
  (SELECT e.id FROM exercises e JOIN days d ON e.day_id = d.id
     WHERE d.program_id = p.id AND e.exercise_key = 'hang_leg_raise' AND e.archived_at IS NULL
     ORDER BY e.rowid LIMIT 1) AS lr_id
FROM programs p
WHERE p.source_template_id = 'peak-strength-v1';

DELETE FROM _uswap WHERE bj_id IS NULL OR lr_id IS NULL;

CREATE TEMPORARY TABLE _uswap_pos AS
SELECT s.bj_id, s.lr_id,
       bj.day_id AS bj_day, bj.exercise_index AS bj_ei,
       lr.day_id AS lr_day, lr.exercise_index AS lr_ei
FROM _uswap s
JOIN exercises bj ON bj.id = s.bj_id
JOIN exercises lr ON lr.id = s.lr_id;

UPDATE exercises SET
  day_id = (SELECT lr_day FROM _uswap_pos WHERE bj_id = exercises.id),
  exercise_index = (SELECT lr_ei FROM _uswap_pos WHERE bj_id = exercises.id),
  note = 'Superset w/ squat. Jump between squat sets, reset each rep.'
WHERE id IN (SELECT bj_id FROM _uswap_pos);

UPDATE exercises SET
  day_id = (SELECT bj_day FROM _uswap_pos WHERE lr_id = exercises.id),
  exercise_index = (SELECT bj_ei FROM _uswap_pos WHERE lr_id = exercises.id),
  note = 'Superset w/ OHP. Trunk control.'
WHERE id IN (SELECT lr_id FROM _uswap_pos);

DROP TABLE _uswap_pos;
DROP TABLE _uswap;

-- 4b. Plyo push-up + sit-up move per fork.
CREATE TEMPORARY TABLE _usitup AS
SELECT e.id AS su_id, e.day_id AS su_day, e.exercise_index AS su_ei,
  (SELECT MAX(e2.exercise_index) FROM exercises e2 WHERE e2.day_id = e.day_id) AS day_max
FROM programs p
JOIN days d ON d.program_id = p.id
JOIN exercises e ON e.day_id = d.id
WHERE p.source_template_id = 'peak-strength-v1'
  AND e.exercise_key = 'wsitup_b' AND e.archived_at IS NULL
  AND e.rowid = (SELECT MIN(e3.rowid) FROM exercises e3 JOIN days d3 ON e3.day_id = d3.id
                 WHERE d3.program_id = p.id AND e3.exercise_key = 'wsitup_b' AND e3.archived_at IS NULL);

UPDATE exercises SET
  exercise_index = (SELECT day_max + 1 FROM _usitup WHERE su_id = exercises.id),
  category = 'acc',
  note = 'Core finisher.'
WHERE id IN (SELECT su_id FROM _usitup);

INSERT INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave)
SELECT lower(hex(randomblob(16))), su_day, su_ei,
       'plyo_pushup', 'Plyo Push-Up', 'ss', 3, 5, 0,
       'Superset w/ bench. Explosive - hands leave the floor.', 0
FROM _usitup
WHERE NOT EXISTS (
  SELECT 1 FROM exercises e WHERE e.day_id = _usitup.su_day AND e.exercise_key = 'plyo_pushup'
);

DROP TABLE _usitup;
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `bash scripts/test-migration-009.sh`
Expected: every `PASS: …` line, ending with `ALL ASSERTIONS PASSED`, exit code 0.

If an assertion fails, fix the migration (not the assertion) unless the assertion contradicts the spec.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-migration-009.sh src-tauri/migrations/009_revise_wave_plan.sql
git commit -m "feat: migration 009 — revise wave plan (Wk2 82.5%, deload single, PAP supersets)"
```

---

### Task 3: Register migration in lib.rs

**Files:**
- Modify: `src-tauri/src/lib.rs` (after the version-8 entry, lines 53-58)

- [ ] **Step 1: Add the migration entry**

In `src-tauri/src/lib.rs`, after the `version: 8` entry's closing `},` (line 58), insert:

```rust
        Migration {
            version: 9,
            description: "revise_wave_plan",
            sql: include_str!("../migrations/009_revise_wave_plan.sql"),
            kind: MigrationKind::Up,
        },
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
cd src-tauri && PATH="$HOME/.cargo/bin:$PATH" cargo check 2>&1 | tail -5; cd ..
```
Expected: `Finished` line, no errors. (First run may take a few minutes compiling dependencies.)

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: register migration 009"
```

---

### Task 4: Mirror changes in templates.ts

**Files:**
- Modify: `src/lib/templates.ts` (PEAK_STRENGTH_TEMPLATE only — do NOT touch FIVE_THREE_ONE_TEMPLATE or `src/lib/wave-defaults.ts`)

- [ ] **Step 1: Update the description (line 11)**

Old:
```typescript
  description: 'Wave-loaded periodization: 3 working weeks + 1 deload. 4 days/week targeting squat, bench, OHP, and deadlift with technical primers, supersets, and accessories.',
```
New:
```typescript
  description: 'Wave-loaded periodization: 3 working weeks + 1 deload. 4 days/week targeting squat, bench, OHP, and deadlift with technical primers, supersets, and accessories. TM progression: after each deload, add 10 lb to squat/deadlift and 5 lb to bench/OHP.',
```

- [ ] **Step 2: Update all four wave configs (squat, bench, OHP, deadlift)**

In each of the four wave blocks (squat ~line 26, bench ~line 55, OHP ~line 83, deadlift ~line 111), change the Wk2 line and the Wk4 line.

Wk2 — old (identical in all four):
```typescript
              { label: 'Wk2 (4s)', sets: [{ reps: 4, pct: 0.75 }, { reps: 4, pct: 0.80 }, { reps: 4, pct: 0.85 }, { reps: 6, pct: 0.75, backoff: true }] },
```
Wk2 — new:
```typescript
              { label: 'Wk2 (4s)', sets: [{ reps: 4, pct: 0.75 }, { reps: 4, pct: 0.80 }, { reps: 4, pct: 0.825 }, { reps: 6, pct: 0.75, backoff: true }] },
```

Wk4 — old (identical in all four):
```typescript
              { label: 'Wk4 (deload)', sets: [{ reps: 5, pct: 0.40 }, { reps: 5, pct: 0.50 }, { reps: 5, pct: 0.60 }] },
```
Wk4 — new:
```typescript
              { label: 'Wk4 (deload)', sets: [{ reps: 5, pct: 0.40 }, { reps: 5, pct: 0.50 }, { reps: 5, pct: 0.60 }, { reps: 1, pct: 0.75 }] },
```

How to apply safely — the deload line is byte-identical across all EIGHT wave blocks (4 Wave + 4 in `FIVE_THREE_ONE_TEMPLATE`, which must NOT change):

- **Wk2 edit:** the Wk2 line above occurs exactly 4 times in the file, all in the Wave template (5/3/1's Wk2 is `'Wk2 (3s)'` with different sets). One edit with `replace_all: true` on the single line is safe. Verify afterwards: `grep -c "0.825" src/lib/templates.ts` → `4`.
- **Wk4 edit:** anchor on the Wave template's unique Wk3 line. Use `replace_all: true` with this exact two-line old_string (occurs exactly 4 times, all in the Wave template — 5/3/1's Wk3 is `'Wk3 (1s)'`):

```typescript
              { label: 'Wk3 (3s)', sets: [{ reps: 3, pct: 0.80 }, { reps: 2, pct: 0.85 }, { reps: 2, pct: 0.90 }, { reps: 5, pct: 0.80, backoff: true }] },
              { label: 'Wk4 (deload)', sets: [{ reps: 5, pct: 0.40 }, { reps: 5, pct: 0.50 }, { reps: 5, pct: 0.60 }] },
```
replaced with:
```typescript
              { label: 'Wk3 (3s)', sets: [{ reps: 3, pct: 0.80 }, { reps: 2, pct: 0.85 }, { reps: 2, pct: 0.90 }, { reps: 5, pct: 0.80, backoff: true }] },
              { label: 'Wk4 (deload)', sets: [{ reps: 5, pct: 0.40 }, { reps: 5, pct: 0.50 }, { reps: 5, pct: 0.60 }, { reps: 1, pct: 0.75 }] },
```

Verify afterwards: `grep -c "reps: 1, pct: 0.75" src/lib/templates.ts` → `4`, and the 5/3/1 deload lines (inside `FIVE_THREE_ONE_TEMPLATE`) still have 3 sets.

- [ ] **Step 3: Day 1 — swap hanging leg raise for box jump (line 33)**

Old:
```typescript
        { id: 'hang_leg_raise', name: 'Hanging Leg Raise', category: 'ss', sets: 4, reps: 10, defaultWeight: 0, note: 'Superset w/ squat. Trunk control.' },
```
New:
```typescript
        { id: 'box_jump', name: 'Box Jump', category: 'ss', sets: 3, reps: 5, defaultWeight: 0, note: 'Superset w/ squat. Jump between squat sets, reset each rep.' },
```

- [ ] **Step 4: Day 2 — plyo push-up in, weighted sit-up to the end (lines 62-67)**

Old (line 62):
```typescript
        { id: 'wsitup_b', name: 'Weighted Sit-Up', category: 'ss', sets: 4, reps: 12, defaultWeight: 35, note: 'Superset w/ bench.' },
```
New:
```typescript
        { id: 'plyo_pushup', name: 'Plyo Push-Up', category: 'ss', sets: 3, reps: 5, defaultWeight: 0, note: 'Superset w/ bench. Explosive - hands leave the floor.' },
```

Then after the tricep extension line (line 67):
```typescript
        { id: 'tri_ext', name: 'Tricep Extension', category: 'acc', sets: 3, reps: 12, defaultWeight: 90, note: 'Pump finisher.' },
```
add below it:
```typescript
        { id: 'wsitup_b', name: 'Weighted Sit-Up', category: 'acc', sets: 4, reps: 12, defaultWeight: 35, note: 'Core finisher.' },
```

- [ ] **Step 5: Day 3 — swap box jump for hanging leg raise (line 90)**

Old:
```typescript
        { id: 'box_jump', name: 'Box Jump', category: 'ss', sets: 3, reps: 5, defaultWeight: 0, note: 'Superset w/ OHP. Reset each rep.' },
```
New:
```typescript
        { id: 'hang_leg_raise', name: 'Hanging Leg Raise', category: 'ss', sets: 4, reps: 10, defaultWeight: 0, note: 'Superset w/ OHP. Trunk control.' },
```

(Do Step 5 BEFORE Step 3 if editing by exact string match — otherwise after Step 3 there are two `box_jump` lines. Alternatively anchor each edit with its neighboring line. The Day 3 box_jump line is uniquely identifiable by its note `'Superset w/ OHP. Reset each rep.'`.)

- [ ] **Step 6: Verify — typecheck and full test suite**

Run:
```bash
npm run build && npx vitest run
```
Expected: tsc completes with no errors; all vitest suites pass (template content has no pinning tests; `wave-defaults.test.ts` passes because wave-defaults.ts is untouched).

- [ ] **Step 7: Re-run the migration harness (regression)**

Run: `bash scripts/test-migration-009.sh`
Expected: `ALL ASSERTIONS PASSED` (unchanged — confirms no accidental edits to migration files).

- [ ] **Step 8: Commit**

```bash
git add src/lib/templates.ts
git commit -m "feat: mirror wave plan revision in seed template"
```

---

### Task 5: On-device verification (manual gate)

No code. Run the app and verify against the spec's checklist. Per CLAUDE.md, migrations only execute after a full rebuild + reinstall (HMR will NOT run them).

- [ ] **Step 1: Build to the iOS simulator**

Run: `npm run tauri ios dev` (choose a simulator). If cargo is missing from PATH: `PATH="$HOME/.cargo/bin:$PATH" npm run tauri ios dev`.

- [ ] **Step 2: Verify in the app**

1. Workout view, any main lift, Wk2: top working set shows `roundToNearest5(TM × 0.825)` (270/225/155/335 if TMs are the template-seed 325/270/190/405) — NOT the old 85% number.
2. Wk4 (deload): four sets, last one ×1 @ 75%.
3. Day 1: Box Jump appears supersetted after Back Squat; Hanging Leg Raise is gone from Day 1.
4. Day 2: Plyo Push-Up after Bench Press; Weighted Sit-Up at the end of the day as accessory.
5. Day 3: Hanging Leg Raise after OHP; Box Jump gone from Day 3.
6. Programs tab → Wave Periodization template description mentions the TM progression rule.
7. 5/3/1 template: deload still 3 sets, structure unchanged.
8. History charts unchanged (set_logs are by-value, no FK to wave sets).

- [ ] **Step 3: Fresh-install path (simulator only — NOT the physical phone)**

Delete the app from the simulator, rerun `npm run tauri ios dev`, fork the Wave Periodization template, and re-verify items 1-6 (this exercises the seed path from the new `templates.ts` instead of the migration).

---

## Out of scope (do not implement)

- `src/lib/wave-defaults.ts` / `wave-defaults.test.ts` — builder defaults deliberately keep the old scheme (007 precedent; pinning test).
- Day 4 subtitle typo, AMRAP support, TM-bump automation, press/pull swaps — all explicitly excluded in the spec.
