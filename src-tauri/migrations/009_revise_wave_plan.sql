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
