-- Migration 006: Tune top-set reps to match Prilepin's chart
-- Wk1 (5s): cap S3 at 3 reps (was 5) -- 5 reps @ 80% exceeds Prilepin's 80-89% per-set max of 4
-- Wk3 (3s): cap S2 and S3 at 2 reps (was 3) -- 3 reps @ 90% exceeds Prilepin's 90%+ per-set max of 2
--
-- New scheme (Wave Periodization template only -- 5/3/1 untouched):
--   Wk1 (5s): 5/5/3 @ 70/75/80 + 70% x8 backoff
--   Wk2 (4s): 4/4/4 @ 75/80/85 + 75% x6 backoff (unchanged)
--   Wk3 (3s): 3/2/2 @ 80/85/90 + 80% x5 backoff
--   Wk4 (deload): 40/50/60 (unchanged)

-- ============================================================
-- TEMPLATE TABLES (scope to peak-strength-v1 only)
-- ============================================================

-- Wk1 S3: 5 reps -> 3 reps
UPDATE wave_week_set_templates SET reps = 3
  WHERE set_index = 2 AND is_backoff = 0
  AND wave_week_id IN (
    SELECT wwt.id FROM wave_week_templates wwt
    JOIN wave_config_templates wct ON wwt.wave_config_id = wct.id
    JOIN exercise_templates et ON wct.exercise_template_id = et.id
    WHERE wwt.week_index = 0 AND et.template_id = 'peak-strength-v1'
  );

-- Wk3 S2: 3 reps -> 2 reps
UPDATE wave_week_set_templates SET reps = 2
  WHERE set_index = 1 AND is_backoff = 0
  AND wave_week_id IN (
    SELECT wwt.id FROM wave_week_templates wwt
    JOIN wave_config_templates wct ON wwt.wave_config_id = wct.id
    JOIN exercise_templates et ON wct.exercise_template_id = et.id
    WHERE wwt.week_index = 2 AND et.template_id = 'peak-strength-v1'
  );

-- Wk3 S3: 3 reps -> 2 reps
UPDATE wave_week_set_templates SET reps = 2
  WHERE set_index = 2 AND is_backoff = 0
  AND wave_week_id IN (
    SELECT wwt.id FROM wave_week_templates wwt
    JOIN wave_config_templates wct ON wwt.wave_config_id = wct.id
    JOIN exercise_templates et ON wct.exercise_template_id = et.id
    WHERE wwt.week_index = 2 AND et.template_id = 'peak-strength-v1'
  );

-- ============================================================
-- USER TABLES (scope to programs forked from peak-strength-v1)
-- ============================================================

-- Wk1 S3: 5 reps -> 3 reps
UPDATE wave_week_sets SET reps = 3
  WHERE set_index = 2 AND is_backoff = 0
  AND wave_week_id IN (
    SELECT ww.id FROM wave_weeks ww
    JOIN wave_configs wc ON ww.wave_config_id = wc.id
    JOIN exercises e ON wc.exercise_id = e.id
    JOIN days d ON e.day_id = d.id
    JOIN programs p ON d.program_id = p.id
    WHERE ww.week_index = 0 AND p.source_template_id = 'peak-strength-v1'
  );

-- Wk3 S2: 3 reps -> 2 reps
UPDATE wave_week_sets SET reps = 2
  WHERE set_index = 1 AND is_backoff = 0
  AND wave_week_id IN (
    SELECT ww.id FROM wave_weeks ww
    JOIN wave_configs wc ON ww.wave_config_id = wc.id
    JOIN exercises e ON wc.exercise_id = e.id
    JOIN days d ON e.day_id = d.id
    JOIN programs p ON d.program_id = p.id
    WHERE ww.week_index = 2 AND p.source_template_id = 'peak-strength-v1'
  );

-- Wk3 S3: 3 reps -> 2 reps
UPDATE wave_week_sets SET reps = 2
  WHERE set_index = 2 AND is_backoff = 0
  AND wave_week_id IN (
    SELECT ww.id FROM wave_weeks ww
    JOIN wave_configs wc ON ww.wave_config_id = wc.id
    JOIN exercises e ON wc.exercise_id = e.id
    JOIN days d ON e.day_id = d.id
    JOIN programs p ON d.program_id = p.id
    WHERE ww.week_index = 2 AND p.source_template_id = 'peak-strength-v1'
  );
