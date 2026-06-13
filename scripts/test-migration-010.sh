#!/usr/bin/env bash
# Test harness for migration 010_complete_box_jump_pairing.sql.
# Builds a fixture DB (migrations 001-009 + post-009 user rows), runs 010,
# and asserts: the affected fork gets box_jump on Day 1 + leg raise relocated
# to Day 3 after OHP (with the Day 3 shift), while a control fork that already
# has box_jump and a builder program are left untouched.
set -euo pipefail
cd "$(dirname "$0")/.."

MIG_DIR="src-tauri/migrations"
DB="$(mktemp -t forge-mig-010-XXXXXX).db"
trap 'rm -f "$DB"' EXIT

[ -f "$MIG_DIR/010_complete_box_jump_pairing.sql" ] || { echo "FAIL: $MIG_DIR/010_complete_box_jump_pairing.sql does not exist"; exit 1; }

for n in 001 002 003 004 005 006 007 008 009; do
  sqlite3 "$DB" < "$MIG_DIR"/${n}_*.sql
done

sqlite3 "$DB" <<'FIXTURE'
-- ===== AFFECTED fork: peak-strength-v1, live leg raise on Day 1, NO box_jump
-- (mirrors David's active program: OHP renamed, front_squat after OHP) =====
INSERT INTO programs (id, name, source_template_id, current_day, current_week, block_num, is_active)
VALUES ('prog1', 'Wave Periodization', 'peak-strength-v1', 0, 0, 1, 1);
INSERT INTO days (id, program_id, day_index, name, subtitle, focus) VALUES
('p1d1', 'prog1', 0, 'Day 1', 'Lower Body Strength', 'Squat + Posterior Chain'),
('p1d2', 'prog1', 1, 'Day 2', 'Upper Body Strength', 'Bench Press + Chest/Tri'),
('p1d3', 'prog1', 2, 'Day 3', 'Athletic / Dynamic', 'OHP + Unilateral + Core');
INSERT INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave) VALUES
('p1-snatch', 'p1d1', 0, 'db_snatch',      'DB Snatch',         'tech',     3, 3,  55, '', 0),
('p1-squat',  'p1d1', 1, 'squat',          'Back Squat',        'absolute', 0, 0,  0,  '', 1),
('p1-lr',     'p1d1', 2, 'hang_leg_raise', 'Hanging Leg Raise', 'ss',       4, 10, 0,  'Superset w/ squat. Trunk control.', 0),
('p1-rdl',    'p1d1', 3, 'rdl',            'Romanian Deadlift', 'acc',      3, 8,  225,'', 0),
('p1-pistol', 'p1d1', 4, 'pistol_squat',   'Pistol Squat',      'ss',       2, 8,  0,  '', 0),
('p1-clean',  'p1d3', 0, 'hang_clean',     'Hang Power Clean',  'tech',     4, 3,  150,'', 0),
('p1-ohp',    'p1d3', 1, 'ohp',            'Overhead Press',    'absolute', 0, 0,  0,  '', 1),
('p1-fsq',    'p1d3', 2, 'front_squat',    'Front Squat',       'acc',      3, 6,  195,'', 0),
('p1-lraise', 'p1d3', 3, 'lat_raise',      'Lateral Raise',     'ss',       3, 12, 22, '', 0),
('p1-bicep',  'p1d3', 4, 'bicep_curl',     'Bicep Curl',        'acc',      3, 10, 27, '', 0);
-- An archived ohp on Day 1 (PWA import remnant) must NOT be mistaken for the real OHP
INSERT INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave, archived_at)
VALUES ('p1-ohp-arch', 'p1d1', 35, 'ohp', 'OHP', 'acc', 3, 5, 0, '', 0, datetime('now'));

-- ===== CONTROL fork: peak-strength-v1, ALREADY has box_jump (post-009 correct) =====
INSERT INTO programs (id, name, source_template_id, current_day, current_week, block_num, is_active)
VALUES ('prog2', 'Wave Periodization', 'peak-strength-v1', 0, 0, 1, 0);
INSERT INTO days (id, program_id, day_index, name, subtitle, focus) VALUES
('p2d1', 'prog2', 0, 'Day 1', '', ''),
('p2d3', 'prog2', 2, 'Day 3', '', '');
INSERT INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave) VALUES
('p2-squat', 'p2d1', 1, 'squat',          'Back Squat',        'absolute', 0, 0,  0, '', 1),
('p2-bj',    'p2d1', 2, 'box_jump',       'Box Jump',          'ss',       3, 5,  0, 'Superset w/ squat. Jump between squat sets, reset each rep.', 0),
('p2-ohp',   'p2d3', 1, 'ohp',            'Overhead Press',    'absolute', 0, 0,  0, '', 1),
('p2-lr',    'p2d3', 2, 'hang_leg_raise', 'Hanging Leg Raise', 'ss',       4, 10, 0, 'Superset w/ OHP. Trunk control.', 0);

-- ===== BUILDER program (source NULL): leg raise, no box_jump -- must be untouched =====
INSERT INTO programs (id, name, source_template_id, current_day, current_week, block_num, is_active)
VALUES ('prog3', 'My Builder', NULL, 0, 0, 1, 0);
INSERT INTO days (id, program_id, day_index, name, subtitle, focus) VALUES
('p3d1', 'prog3', 0, 'Day 1', '', ''),
('p3d3', 'prog3', 2, 'Day 3', '', '');
INSERT INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave) VALUES
('p3-squat', 'p3d1', 1, 'squat',          'Back Squat',        'absolute', 0, 0,  0, '', 1),
('p3-lr',    'p3d1', 2, 'hang_leg_raise', 'Hanging Leg Raise', 'ss',       4, 10, 0, 'my note', 0),
('p3-ohp',   'p3d3', 1, 'ohp',            'OHP',               'absolute', 0, 0,  0, '', 1);
FIXTURE

sqlite3 "$DB" < "$MIG_DIR/010_complete_box_jump_pairing.sql"

assert() {
  local label="$1" actual="$2" expected="$3"
  if [ "$actual" != "$expected" ]; then
    echo "FAIL: $label"; echo "  expected: $expected"; echo "  actual:   $actual"; exit 1
  fi
  echo "PASS: $label"
}
q() { sqlite3 "$DB" "$1"; }

# --- Affected fork: box_jump inserted on Day 1 at the vacated leg-raise slot ---
assert "affected: box_jump on Day 1 slot 2, ss, live, correct note" \
  "$(q "SELECT day_id || '|' || exercise_index || '|' || category || '|' || sets || '|' || reps || '|' || (archived_at IS NULL) || '|' || note
        FROM exercises WHERE day_id = 'p1d1' AND exercise_key = 'box_jump'")" \
  "p1d1|2|ss|3|5|1|Superset w/ squat. Jump between squat sets, reset each rep."
assert "affected: exactly one live box_jump in program" \
  "$(q "SELECT COUNT(*) FROM exercises e JOIN days d ON e.day_id=d.id
        WHERE d.program_id='prog1' AND e.exercise_key='box_jump' AND e.archived_at IS NULL")" "1"

# --- Affected fork: leg raise relocated to Day 3 right after OHP (slot 2) ---
assert "affected: leg raise now on Day 3 slot 2, ss, OHP note" \
  "$(q "SELECT day_id || '|' || exercise_index || '|' || category || '|' || note
        FROM exercises WHERE id = 'p1-lr'")" \
  "p1d3|2|ss|Superset w/ OHP. Trunk control."
assert "affected: no live leg raise left on Day 1" \
  "$(q "SELECT COUNT(*) FROM exercises WHERE day_id='p1d1' AND exercise_key='hang_leg_raise' AND archived_at IS NULL")" "0"

# --- Affected fork: Day 3 shift (front_squat 2->3, lat_raise 3->4, bicep 4->5); OHP stays 1 ---
assert "affected: OHP still Day 3 slot 1" "$(q "SELECT exercise_index FROM exercises WHERE id='p1-ohp'")" "1"
assert "affected: front_squat shifted 2->3" "$(q "SELECT exercise_index FROM exercises WHERE id='p1-fsq'")" "3"
assert "affected: lat_raise shifted 3->4"   "$(q "SELECT exercise_index FROM exercises WHERE id='p1-lraise'")" "4"
assert "affected: bicep_curl shifted 4->5"  "$(q "SELECT exercise_index FROM exercises WHERE id='p1-bicep'")" "5"
assert "affected: Day 3 order intact, no dupes" \
  "$(q "SELECT group_concat(exercise_key) FROM (SELECT exercise_key FROM exercises WHERE day_id='p1d3' AND archived_at IS NULL ORDER BY exercise_index)")" \
  "hang_clean,ohp,hang_leg_raise,front_squat,lat_raise,bicep_curl"
assert "affected: archived Day 1 ohp untouched" \
  "$(q "SELECT day_id || '|' || exercise_index FROM exercises WHERE id='p1-ohp-arch'")" "p1d1|35"

# --- Control fork (already had box_jump): completely untouched ---
assert "control: box_jump still Day 1 slot 2" \
  "$(q "SELECT day_id || '|' || exercise_index FROM exercises WHERE id='p2-bj'")" "p2d1|2"
assert "control: leg raise still Day 3 slot 2" \
  "$(q "SELECT day_id || '|' || exercise_index || '|' || note FROM exercises WHERE id='p2-lr'")" \
  "p2d3|2|Superset w/ OHP. Trunk control."
assert "control: no duplicate box_jump inserted" \
  "$(q "SELECT COUNT(*) FROM exercises e JOIN days d ON e.day_id=d.id
        WHERE d.program_id='prog2' AND e.exercise_key='box_jump'")" "1"

# --- Builder program (source NULL): untouched ---
assert "builder: leg raise untouched on Day 1" \
  "$(q "SELECT day_id || '|' || exercise_index || '|' || note FROM exercises WHERE id='p3-lr'")" "p3d1|2|my note"
assert "builder: no box_jump inserted" \
  "$(q "SELECT COUNT(*) FROM exercises e JOIN days d ON e.day_id=d.id
        WHERE d.program_id='prog3' AND e.exercise_key='box_jump'")" "0"

# --- Idempotency: a second run must change nothing ---
sqlite3 "$DB" < "$MIG_DIR/010_complete_box_jump_pairing.sql"
assert "idempotent: still exactly one live box_jump in affected fork" \
  "$(q "SELECT COUNT(*) FROM exercises e JOIN days d ON e.day_id=d.id
        WHERE d.program_id='prog1' AND e.exercise_key='box_jump' AND e.archived_at IS NULL")" "1"
assert "idempotent: affected Day 3 unchanged after re-run" \
  "$(q "SELECT group_concat(exercise_key) FROM (SELECT exercise_key FROM exercises WHERE day_id='p1d3' AND archived_at IS NULL ORDER BY exercise_index)")" \
  "hang_clean,ohp,hang_leg_raise,front_squat,lat_raise,bicep_curl"

# --- No work tables leaked as permanent ---
assert "no permanent work tables leaked" \
  "$(q "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name LIKE '\_%' ESCAPE '\'")" "0"

echo ""
echo "ALL ASSERTIONS PASSED"
