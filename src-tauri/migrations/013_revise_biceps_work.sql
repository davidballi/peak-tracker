-- Migration 013: Revise Day 3 biceps work
--
-- User observation: hammer curls feel forearm-dominant. That is anatomically
-- correct -- a neutral grip removes the biceps' supination role, and the
-- brachioradialis has better leverage in that position. Hammer curls are a
-- brachioradialis/brachialis exercise, not a biceps one.
--
-- Two changes:
--   1. Standing DB curl -> Incline DB curl. The biceps long head crosses the
--      shoulder, so its stretched position needs the arm BEHIND the torso --
--      something no standing curl achieves. Incline is the long-head builder.
--   2. Hammer curl -> Preacher curl. Arm forward and fixed: short-head
--      emphasis, loaded at the bottom, and impossible to cheat.
--
-- Both prescribed at 3x12 rather than 3x10. Each loads the biceps in a deep
-- stretch with the arm fixed, which is where the stimulus lives but also where
-- heavy load strains the distal tendon and where form breaks down. The heavy
-- end stays with Day 4's barbell curl, where a free arm path makes load safe.
--
-- Both changes are archive-and-replace rather than rename: standing and
-- incline curls are different exercises at different loads (27.5 -> 20), so
-- merging their set_logs would corrupt the e1RM and volume history. Archived
-- rows keep their logs and stay visible in History.
--
-- Both replacements land in the exact slots the retired rows vacated, so no
-- index shifting is required.
--
-- Scope: peak-strength-v1 and its forks. Matched by exercise_key; archived
-- rows excluded. Re-runs no-op (the retired rows are already archived).

-- ============================================================
-- TEMPLATE TABLES (scope: peak-strength-v1)
-- ============================================================

-- 1a. Standing DB curl -> incline DB curl.
UPDATE exercise_templates SET
  exercise_key = 'incline_db_curl', name = 'Incline DB Curl',
  category = 'acc', sets = 3, reps = 12, default_weight = 20,
  note = 'Bench at 45-60 deg. Let the arms hang dead behind you - do not swing them forward.'
WHERE template_id = 'peak-strength-v1' AND exercise_key = 'bicep_curl';

-- 2a. Hammer curl -> preacher curl.
UPDATE exercise_templates SET
  exercise_key = 'preacher_curl', name = 'Preacher Curl',
  category = 'acc', sets = 3, reps = 12, default_weight = 50,
  note = 'Full stretch at the bottom, controlled. EZ bar or machine.'
WHERE template_id = 'peak-strength-v1' AND exercise_key = 'hammer_curl';

-- ============================================================
-- USER TABLES (scope: programs forked from peak-strength-v1)
-- ============================================================

-- Capture the retired rows and their slots before mutating.
CREATE TEMPORARY TABLE _curls AS
SELECT e.id AS old_id, e.day_id, e.exercise_index, e.exercise_key AS old_key
FROM programs p
JOIN days d ON d.program_id = p.id
JOIN exercises e ON e.day_id = d.id
WHERE p.source_template_id = 'peak-strength-v1'
  AND e.archived_at IS NULL
  AND e.exercise_key IN ('bicep_curl', 'hammer_curl');

-- 1b. Archive them. set_logs, notes and goals survive.
UPDATE exercises SET archived_at = datetime('now')
WHERE id IN (SELECT old_id FROM _curls);

-- 2b. Insert replacements into the vacated slots.
INSERT INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave)
SELECT lower(hex(randomblob(16))), c.day_id, c.exercise_index,
       'incline_db_curl', 'Incline DB Curl', 'acc', 3, 12, 20,
       'Bench at 45-60 deg. Let the arms hang dead behind you - do not swing them forward.', 0
FROM _curls c WHERE c.old_key = 'bicep_curl'
  AND NOT EXISTS (SELECT 1 FROM exercises e2
                  WHERE e2.day_id = c.day_id AND e2.exercise_key = 'incline_db_curl'
                    AND e2.archived_at IS NULL);

INSERT INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave)
SELECT lower(hex(randomblob(16))), c.day_id, c.exercise_index,
       'preacher_curl', 'Preacher Curl', 'acc', 3, 12, 50,
       'Full stretch at the bottom, controlled. EZ bar or machine.', 0
FROM _curls c WHERE c.old_key = 'hammer_curl'
  AND NOT EXISTS (SELECT 1 FROM exercises e2
                  WHERE e2.day_id = c.day_id AND e2.exercise_key = 'preacher_curl'
                    AND e2.archived_at IS NULL);

DROP TABLE _curls;
