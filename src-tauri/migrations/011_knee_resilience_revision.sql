-- Migration 011: Knee-resilience revision of the Wave Periodization plan
-- Design: docs/superpowers/specs/2026-08-03-knee-resilience-revision-design.md
--
-- User presentation (self-assessed, no imaging): left ITB syndrome w/ TFL and
-- deep-glute involvement, medial hamstring soreness, quad tendon soreness at
-- the superior pole, and a Baker's cyst behind the left knee. Moderate
-- irritability (aches, no visible swelling). ~4 weeks detrained on squat/DL.
--
-- Two structural problems in the plan:
--   1. Anterior-knee and impact load is over-represented -- three plyometric
--      exercises, deep knee flexion under load twice weekly, and open-chain
--      knee extension at 155 lb, into an active quad tendinopathy. The box
--      jump superset added by 009 is the sharpest case: repeated landings
--      performed pre-fatigued with known hip-abductor weakness.
--   2. The stated deficit -- frontal-plane hip weakness -- had NO exercise
--      assigned to it anywhere in the program.
--
-- Squat and deadlift are deliberately RETAINED. Quadriceps strength is the
-- strongest modifiable protection against symptomatic knee OA progression,
-- and cartilage is load-responsive. The compounds were never the problem.
--
-- Training maxes are intentionally NOT touched here -- `training_maxes` is
-- append-only and personal, so the reset (squat 325->275, DL 405->345) is
-- entered through the app. Migrations carry program structure only.
--
-- Scope: peak-strength-v1 and its forks. 5/3/1 and builder programs untouched.
-- Day 2 untouched. Deadlift wave untouched. Exercises matched by exercise_key
-- (survives renames); archived rows excluded.
--
-- Template vs user asymmetry: `exercise_templates` has no archived_at (008 only
-- added it to `exercises`), and template rows carry no history, so replacements
-- there are UPDATE-in-place. User rows are ARCHIVED and replaced with a fresh
-- insert at the same slot, so set_logs / training_maxes / notes / goals survive
-- and any archived movement can be restored if the knee comes good.

-- ============================================================
-- TEMPLATE TABLES (scope: peak-strength-v1)
-- ============================================================

-- 1a. Day 1: box jump -> side plank w/ hip abduction (squat's superset slot).
UPDATE exercise_templates SET
  exercise_key = 'side_plank_abd', name = 'Side Plank w/ Hip Abduction',
  category = 'ss', sets = 3, reps = 1, default_weight = 0,
  note = '30s each side. Superset w/ squat. Top leg lifts and holds - glute med.'
WHERE template_id = 'peak-strength-v1' AND exercise_key = 'box_jump';

-- 2a. Day 1: pistol squat -> Bulgarian split squat (existing library key).
UPDATE exercise_templates SET
  exercise_key = 'bulgarian_split_squat', name = 'Bulgarian Split Squat',
  category = 'acc', sets = 3, reps = 8, default_weight = 40,
  note = 'Each leg. Front shin near vertical, moderate depth. Control the descent.'
WHERE template_id = 'peak-strength-v1' AND exercise_key = 'pistol_squat';

-- 3a. Day 3: hang power clean -> kettlebell swing (existing library key).
--     Removes the loaded catch. The original note already listed this sub.
UPDATE exercise_templates SET
  exercise_key = 'kettlebell_swing', name = 'Kettlebell Swing',
  category = 'tech', sets = 4, reps = 8, default_weight = 70,
  note = 'Hip hinge power. No catch - protects the knee.'
WHERE template_id = 'peak-strength-v1' AND exercise_key = 'hang_clean';

-- 4a. Day 3: front squat -> Copenhagen plank.
UPDATE exercise_templates SET
  exercise_key = 'copenhagen', name = 'Copenhagen Plank',
  category = 'acc', sets = 3, reps = 1, default_weight = 0,
  note = '30s each side. Adductor - start knee-supported, progress to full.'
WHERE template_id = 'peak-strength-v1' AND exercise_key = 'front_squat';

-- 5a. Day 3: lateral raise loses its superset partner (front squat).
UPDATE exercise_templates SET category = 'acc'
WHERE template_id = 'peak-strength-v1' AND exercise_key = 'lat_raise' AND category = 'ss';

-- 6a. Day 3: farmer's carry -> suitcase carry (unilateral = frontal-plane hip).
--     Key preserved so history carries over. Day 4's farmer_carry_d4 untouched.
UPDATE exercise_templates SET
  name = 'Suitcase Carry (each side)',
  note = '40 yards each side. Unilateral - resist the side-bend.'
WHERE template_id = 'peak-strength-v1' AND exercise_key = 'farmer_carry';

-- 7a. Day 4: trap bar jump -> trap bar pull from blocks. Keeps explosive
--     intent, removes the landing. Key preserved so history carries over.
UPDATE exercise_templates SET
  name = 'Trap Bar Pull (from blocks)',
  note = 'Explosive intent, no jump. Moderate load.'
WHERE template_id = 'peak-strength-v1' AND exercise_key = 'trap_jump';

-- 8a. Day 1: leg extension load down, range and tempo restricted.
UPDATE exercise_templates SET
  default_weight = 100,
  note = 'Slow 3s eccentric. Partial range - stop short of lockout.'
WHERE template_id = 'peak-strength-v1' AND exercise_key = 'leg_ext';

-- 9a. Day 1: squat depth cue. PF contact stress and quad tendon load climb
--     sharply past ~90-100 deg of knee flexion.
UPDATE exercise_templates SET
  note = 'Parallel depth this cycle - stop at ~90 deg knee flexion. Control the descent.'
WHERE template_id = 'peak-strength-v1' AND exercise_key = 'squat';

-- 10a. Day 1: append Spanish squat isometric (quad tendon analgesia).
INSERT INTO exercise_templates (id, template_id, day_index, day_name, day_subtitle, day_focus, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave)
SELECT 'peak-strength-v1_d0_spaniso', 'peak-strength-v1',
       et.day_index, et.day_name, et.day_subtitle, et.day_focus,
       (SELECT MAX(e2.exercise_index) + 1 FROM exercise_templates e2
         WHERE e2.template_id = 'peak-strength-v1' AND e2.day_index = 0),
       'spanish_squat_iso', 'Spanish Squat (Isometric)', 'acc', 5, 1, 0,
       '45s hold @ ~70% effort. Quad tendon - do before squats if it barks.', 0
FROM exercise_templates et
WHERE et.template_id = 'peak-strength-v1' AND et.day_index = 0 AND et.exercise_key = 'squat'
  AND NOT EXISTS (SELECT 1 FROM exercise_templates WHERE id = 'peak-strength-v1_d0_spaniso');

-- 11a. Day 3: append side-lying hip abduction (direct glute med).
INSERT INTO exercise_templates (id, template_id, day_index, day_name, day_subtitle, day_focus, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave)
SELECT 'peak-strength-v1_d2_slabd', 'peak-strength-v1',
       et.day_index, et.day_name, et.day_subtitle, et.day_focus,
       (SELECT MAX(e2.exercise_index) + 1 FROM exercise_templates e2
         WHERE e2.template_id = 'peak-strength-v1' AND e2.day_index = 2),
       'side_lying_abd', 'Side-Lying Hip Abduction', 'acc', 3, 15, 0,
       'Each side. Slow, no hip rotation - glute med.', 0
FROM exercise_templates et
WHERE et.template_id = 'peak-strength-v1' AND et.day_index = 2 AND et.exercise_key = 'ohp'
  AND NOT EXISTS (SELECT 1 FROM exercise_templates WHERE id = 'peak-strength-v1_d2_slabd');

-- 12a. Squat wave Wk3 top set: 90% -> 87.5%. Scoped to squat only (bench, OHP
--      and deadlift keep their 90%). 87.5% rather than 85% preserves the
--      crescendo 009 established -- 85% would flatten Wk3 to equal Wk2.
UPDATE wave_week_set_templates SET percentage = 0.875
  WHERE set_index = 2 AND is_backoff = 0 AND percentage = 0.90
  AND wave_week_id IN (
    SELECT wwt.id FROM wave_week_templates wwt
    JOIN wave_config_templates wct ON wwt.wave_config_id = wct.id
    JOIN exercise_templates et ON wct.exercise_template_id = et.id
    WHERE wwt.week_index = 2 AND et.template_id = 'peak-strength-v1'
      AND et.exercise_key = 'squat'
  );

-- ============================================================
-- USER TABLES (scope: programs forked from peak-strength-v1)
-- ============================================================

-- Capture every live row being retired, with its slot, before mutating.
-- Re-runs find nothing (the rows are archived by then), so all inserts no-op.
CREATE TEMPORARY TABLE _retire AS
SELECT e.id AS old_id, e.day_id, e.exercise_index, e.exercise_key AS old_key
FROM programs p
JOIN days d ON d.program_id = p.id
JOIN exercises e ON e.day_id = d.id
WHERE p.source_template_id = 'peak-strength-v1'
  AND e.archived_at IS NULL
  AND e.exercise_key IN ('box_jump', 'pistol_squat', 'hang_clean', 'front_squat');

-- 1b. Archive the retired movements. History, TMs, notes and goals survive.
UPDATE exercises SET archived_at = datetime('now')
WHERE id IN (SELECT old_id FROM _retire);

-- 2b. Insert replacements into the exact slots the retired rows vacated.
INSERT INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave)
SELECT lower(hex(randomblob(16))), r.day_id, r.exercise_index,
       'side_plank_abd', 'Side Plank w/ Hip Abduction', 'ss', 3, 1, 0,
       '30s each side. Superset w/ squat. Top leg lifts and holds - glute med.', 0
FROM _retire r WHERE r.old_key = 'box_jump'
  AND NOT EXISTS (SELECT 1 FROM exercises e2
                  WHERE e2.day_id = r.day_id AND e2.exercise_key = 'side_plank_abd'
                    AND e2.archived_at IS NULL);

INSERT INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave)
SELECT lower(hex(randomblob(16))), r.day_id, r.exercise_index,
       'bulgarian_split_squat', 'Bulgarian Split Squat', 'acc', 3, 8, 40,
       'Each leg. Front shin near vertical, moderate depth. Control the descent.', 0
FROM _retire r WHERE r.old_key = 'pistol_squat'
  AND NOT EXISTS (SELECT 1 FROM exercises e2
                  WHERE e2.day_id = r.day_id AND e2.exercise_key = 'bulgarian_split_squat'
                    AND e2.archived_at IS NULL);

INSERT INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave)
SELECT lower(hex(randomblob(16))), r.day_id, r.exercise_index,
       'kettlebell_swing', 'Kettlebell Swing', 'tech', 4, 8, 70,
       'Hip hinge power. No catch - protects the knee.', 0
FROM _retire r WHERE r.old_key = 'hang_clean'
  AND NOT EXISTS (SELECT 1 FROM exercises e2
                  WHERE e2.day_id = r.day_id AND e2.exercise_key = 'kettlebell_swing'
                    AND e2.archived_at IS NULL);

INSERT INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave)
SELECT lower(hex(randomblob(16))), r.day_id, r.exercise_index,
       'copenhagen', 'Copenhagen Plank', 'acc', 3, 1, 0,
       '30s each side. Adductor - start knee-supported, progress to full.', 0
FROM _retire r WHERE r.old_key = 'front_squat'
  AND NOT EXISTS (SELECT 1 FROM exercises e2
                  WHERE e2.day_id = r.day_id AND e2.exercise_key = 'copenhagen'
                    AND e2.archived_at IS NULL);

DROP TABLE _retire;

-- 3b. Lateral raise loses its superset partner (front squat).
UPDATE exercises SET category = 'acc'
WHERE archived_at IS NULL AND category = 'ss' AND exercise_key = 'lat_raise'
  AND day_id IN (
    SELECT d.id FROM programs p JOIN days d ON d.program_id = p.id
    WHERE p.source_template_id = 'peak-strength-v1'
  );

-- 4b. Farmer's carry -> suitcase carry. Day 4's farmer_carry_d4 untouched.
UPDATE exercises SET
  name = 'Suitcase Carry (each side)',
  note = '40 yards each side. Unilateral - resist the side-bend.'
WHERE archived_at IS NULL AND exercise_key = 'farmer_carry'
  AND day_id IN (
    SELECT d.id FROM programs p JOIN days d ON d.program_id = p.id
    WHERE p.source_template_id = 'peak-strength-v1'
  );

-- 5b. Trap bar jump -> trap bar pull from blocks.
UPDATE exercises SET
  name = 'Trap Bar Pull (from blocks)',
  note = 'Explosive intent, no jump. Moderate load.'
WHERE archived_at IS NULL AND exercise_key = 'trap_jump'
  AND day_id IN (
    SELECT d.id FROM programs p JOIN days d ON d.program_id = p.id
    WHERE p.source_template_id = 'peak-strength-v1'
  );

-- 6b. Leg extension: load down, range and tempo restricted.
UPDATE exercises SET
  default_weight = 100,
  note = 'Slow 3s eccentric. Partial range - stop short of lockout.'
WHERE archived_at IS NULL AND exercise_key = 'leg_ext'
  AND day_id IN (
    SELECT d.id FROM programs p JOIN days d ON d.program_id = p.id
    WHERE p.source_template_id = 'peak-strength-v1'
  );

-- 7b. Squat depth cue.
UPDATE exercises SET
  note = 'Parallel depth this cycle - stop at ~90 deg knee flexion. Control the descent.'
WHERE archived_at IS NULL AND exercise_key = 'squat'
  AND day_id IN (
    SELECT d.id FROM programs p JOIN days d ON d.program_id = p.id
    WHERE p.source_template_id = 'peak-strength-v1'
  );

-- 8b. Append the two new hip/tendon accessories, one per target day.
--     day_index 0 = Day 1 (lower), day_index 2 = Day 3 (athletic).
CREATE TEMPORARY TABLE _append AS
SELECT d.id AS day_id, d.day_index,
       (SELECT MAX(e2.exercise_index) FROM exercises e2 WHERE e2.day_id = d.id) AS day_max
FROM programs p
JOIN days d ON d.program_id = p.id
WHERE p.source_template_id = 'peak-strength-v1' AND d.day_index IN (0, 2);

INSERT INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave)
SELECT lower(hex(randomblob(16))), a.day_id, a.day_max + 1,
       'spanish_squat_iso', 'Spanish Squat (Isometric)', 'acc', 5, 1, 0,
       '45s hold @ ~70% effort. Quad tendon - do before squats if it barks.', 0
FROM _append a WHERE a.day_index = 0
  AND NOT EXISTS (SELECT 1 FROM exercises e2
                  WHERE e2.day_id = a.day_id AND e2.exercise_key = 'spanish_squat_iso'
                    AND e2.archived_at IS NULL);

INSERT INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave)
SELECT lower(hex(randomblob(16))), a.day_id, a.day_max + 1,
       'side_lying_abd', 'Side-Lying Hip Abduction', 'acc', 3, 15, 0,
       'Each side. Slow, no hip rotation - glute med.', 0
FROM _append a WHERE a.day_index = 2
  AND NOT EXISTS (SELECT 1 FROM exercises e2
                  WHERE e2.day_id = a.day_id AND e2.exercise_key = 'side_lying_abd'
                    AND e2.archived_at IS NULL);

DROP TABLE _append;

-- 9b. Squat wave Wk3 top set: 90% -> 87.5%. Squat only.
UPDATE wave_week_sets SET percentage = 0.875
  WHERE set_index = 2 AND is_backoff = 0 AND percentage = 0.90
  AND wave_week_id IN (
    SELECT ww.id FROM wave_weeks ww
    JOIN wave_configs wc ON ww.wave_config_id = wc.id
    JOIN exercises e ON wc.exercise_id = e.id
    JOIN days d ON e.day_id = d.id
    JOIN programs p ON d.program_id = p.id
    WHERE ww.week_index = 2 AND p.source_template_id = 'peak-strength-v1'
      AND e.exercise_key = 'squat'
  );
