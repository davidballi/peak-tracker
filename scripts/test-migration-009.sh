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
