-- Migration 012: Add single-arm landmine press to Day 3
--
-- Day 3's identity is "OHP + Unilateral + Core". A single-arm landmine press
-- is all three: unilateral pressing through a shoulder-friendly arc, with a
-- large anti-rotation trunk demand from the offset load. Day 2 is already
-- nine exercises and press-saturated, so it goes here rather than there.
--
-- Placed at exercise_index 3 -- the first accessory slot, directly after
-- OHP's superset partner -- because it is the most demanding movement on the
-- day after the main lift. Live rows at index >= 3 shift down by one.
--
-- Note recommends standing over half-kneeling: half-kneeling puts the trailing
-- knee on the floor, which is not what we want given the left-knee picture
-- that migration 011 addressed.
--
-- Scope: peak-strength-v1 and its forks. Matched by exercise_key; archived
-- rows excluded. The NOT EXISTS guards make the index shift idempotent -- on
-- a re-run the press already exists, so neither the shift nor the insert runs.

-- ============================================================
-- TEMPLATE TABLES (scope: peak-strength-v1)
-- ============================================================

-- 1a. Make room at slot 3 on Day 3 (day_index 2).
UPDATE exercise_templates SET exercise_index = exercise_index + 1
WHERE template_id = 'peak-strength-v1' AND day_index = 2 AND exercise_index >= 3
  AND NOT EXISTS (
    SELECT 1 FROM exercise_templates
    WHERE template_id = 'peak-strength-v1' AND exercise_key = 'landmine_press'
  );

-- 2a. Insert the press into the vacated slot.
INSERT INTO exercise_templates (id, template_id, day_index, day_name, day_subtitle, day_focus, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave)
SELECT 'peak-strength-v1_d2_landmine', 'peak-strength-v1',
       et.day_index, et.day_name, et.day_subtitle, et.day_focus, 3,
       'landmine_press', 'Single-Arm Landmine Press', 'acc', 3, 10, 45,
       'Each arm. Standing - resist the trunk rotation. Weight is the plate load.', 0
FROM exercise_templates et
WHERE et.template_id = 'peak-strength-v1' AND et.day_index = 2 AND et.exercise_key = 'ohp'
  AND NOT EXISTS (SELECT 1 FROM exercise_templates WHERE id = 'peak-strength-v1_d2_landmine');

-- ============================================================
-- USER TABLES (scope: programs forked from peak-strength-v1)
-- ============================================================

-- Day 3 of every fork that does not already have a live landmine press.
CREATE TEMPORARY TABLE _lm AS
SELECT d.id AS day_id
FROM programs p
JOIN days d ON d.program_id = p.id
WHERE p.source_template_id = 'peak-strength-v1' AND d.day_index = 2
  AND NOT EXISTS (
    SELECT 1 FROM exercises e
    WHERE e.day_id = d.id AND e.exercise_key = 'landmine_press' AND e.archived_at IS NULL
  );

-- 1b. Shift live rows at slot 3 and below down by one.
UPDATE exercises SET exercise_index = exercise_index + 1
WHERE archived_at IS NULL
  AND day_id IN (SELECT day_id FROM _lm)
  AND exercise_index >= 3;

-- 2b. Insert the press.
INSERT INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave)
SELECT lower(hex(randomblob(16))), day_id, 3,
       'landmine_press', 'Single-Arm Landmine Press', 'acc', 3, 10, 45,
       'Each arm. Standing - resist the trunk rotation. Weight is the plate load.', 0
FROM _lm;

DROP TABLE _lm;
