-- Migration 005: Standardize wave periodization percentages
-- Old percentages were reverse-engineered from plate-friendly weights at specific maxes,
-- creating ~7.5% intra-set jumps and peaks up to 98.1%. Research consensus is 5% jumps
-- between sets, 5% week-to-week, peaking at 90%.
--
-- New scheme (all lifts):
--   Warmups: 40% x5, 55% x3
--   Wk1 (5s): 70/75/80 + 70% x8 backoff
--   Wk2 (4s): 75/80/85 + 75% x6 backoff
--   Wk3 (3s): 80/85/90 + 80% x5 backoff
--   Wk4 (deload): 40/50/60 (unchanged)

-- ============================================================
-- UPDATE TEMPLATE TABLES (wave_warmup_templates, wave_week_set_templates)
-- ============================================================

-- Fix all template warmups: set_index 0 = 40% x5, set_index 1 = 55% x3
UPDATE wave_warmup_templates SET percentage = 0.40, reps = 5 WHERE set_index = 0;
UPDATE wave_warmup_templates SET percentage = 0.55, reps = 3 WHERE set_index = 1;

-- Fix template week sets via wave_week_templates join
-- Week 1 (5s) — week_index = 0
UPDATE wave_week_set_templates SET percentage = 0.70, reps = 5
  WHERE set_index = 0 AND is_backoff = 0
  AND wave_week_id IN (SELECT id FROM wave_week_templates WHERE week_index = 0);

UPDATE wave_week_set_templates SET percentage = 0.75, reps = 5
  WHERE set_index = 1 AND is_backoff = 0
  AND wave_week_id IN (SELECT id FROM wave_week_templates WHERE week_index = 0);

UPDATE wave_week_set_templates SET percentage = 0.80, reps = 5
  WHERE set_index = 2 AND is_backoff = 0
  AND wave_week_id IN (SELECT id FROM wave_week_templates WHERE week_index = 0);

UPDATE wave_week_set_templates SET percentage = 0.70, reps = 8
  WHERE is_backoff = 1
  AND wave_week_id IN (SELECT id FROM wave_week_templates WHERE week_index = 0);

-- Week 2 (4s) — week_index = 1
UPDATE wave_week_set_templates SET percentage = 0.75, reps = 4
  WHERE set_index = 0 AND is_backoff = 0
  AND wave_week_id IN (SELECT id FROM wave_week_templates WHERE week_index = 1);

UPDATE wave_week_set_templates SET percentage = 0.80, reps = 4
  WHERE set_index = 1 AND is_backoff = 0
  AND wave_week_id IN (SELECT id FROM wave_week_templates WHERE week_index = 1);

UPDATE wave_week_set_templates SET percentage = 0.85, reps = 4
  WHERE set_index = 2 AND is_backoff = 0
  AND wave_week_id IN (SELECT id FROM wave_week_templates WHERE week_index = 1);

UPDATE wave_week_set_templates SET percentage = 0.75, reps = 6
  WHERE is_backoff = 1
  AND wave_week_id IN (SELECT id FROM wave_week_templates WHERE week_index = 1);

-- Week 3 (3s) — week_index = 2
UPDATE wave_week_set_templates SET percentage = 0.80, reps = 3
  WHERE set_index = 0 AND is_backoff = 0
  AND wave_week_id IN (SELECT id FROM wave_week_templates WHERE week_index = 2);

UPDATE wave_week_set_templates SET percentage = 0.85, reps = 3
  WHERE set_index = 1 AND is_backoff = 0
  AND wave_week_id IN (SELECT id FROM wave_week_templates WHERE week_index = 2);

UPDATE wave_week_set_templates SET percentage = 0.90, reps = 3
  WHERE set_index = 2 AND is_backoff = 0
  AND wave_week_id IN (SELECT id FROM wave_week_templates WHERE week_index = 2);

UPDATE wave_week_set_templates SET percentage = 0.80, reps = 5
  WHERE is_backoff = 1
  AND wave_week_id IN (SELECT id FROM wave_week_templates WHERE week_index = 2);

-- Week 4 (deload) — week_index = 3 — already 40/50/60, no change needed

-- ============================================================
-- UPDATE USER TABLES (wave_warmups, wave_week_sets)
-- ============================================================

-- Fix all user warmups: set_index 0 = 40% x5, set_index 1 = 55% x3
UPDATE wave_warmups SET percentage = 0.40, reps = 5 WHERE set_index = 0;
UPDATE wave_warmups SET percentage = 0.55, reps = 3 WHERE set_index = 1;

-- Week 1 (5s) — week_index = 0
UPDATE wave_week_sets SET percentage = 0.70, reps = 5
  WHERE set_index = 0 AND is_backoff = 0
  AND wave_week_id IN (SELECT id FROM wave_weeks WHERE week_index = 0);

UPDATE wave_week_sets SET percentage = 0.75, reps = 5
  WHERE set_index = 1 AND is_backoff = 0
  AND wave_week_id IN (SELECT id FROM wave_weeks WHERE week_index = 0);

UPDATE wave_week_sets SET percentage = 0.80, reps = 5
  WHERE set_index = 2 AND is_backoff = 0
  AND wave_week_id IN (SELECT id FROM wave_weeks WHERE week_index = 0);

UPDATE wave_week_sets SET percentage = 0.70, reps = 8
  WHERE is_backoff = 1
  AND wave_week_id IN (SELECT id FROM wave_weeks WHERE week_index = 0);

-- Week 2 (4s) — week_index = 1
UPDATE wave_week_sets SET percentage = 0.75, reps = 4
  WHERE set_index = 0 AND is_backoff = 0
  AND wave_week_id IN (SELECT id FROM wave_weeks WHERE week_index = 1);

UPDATE wave_week_sets SET percentage = 0.80, reps = 4
  WHERE set_index = 1 AND is_backoff = 0
  AND wave_week_id IN (SELECT id FROM wave_weeks WHERE week_index = 1);

UPDATE wave_week_sets SET percentage = 0.85, reps = 4
  WHERE set_index = 2 AND is_backoff = 0
  AND wave_week_id IN (SELECT id FROM wave_weeks WHERE week_index = 1);

UPDATE wave_week_sets SET percentage = 0.75, reps = 6
  WHERE is_backoff = 1
  AND wave_week_id IN (SELECT id FROM wave_weeks WHERE week_index = 1);

-- Week 3 (3s) — week_index = 2
UPDATE wave_week_sets SET percentage = 0.80, reps = 3
  WHERE set_index = 0 AND is_backoff = 0
  AND wave_week_id IN (SELECT id FROM wave_weeks WHERE week_index = 2);

UPDATE wave_week_sets SET percentage = 0.85, reps = 3
  WHERE set_index = 1 AND is_backoff = 0
  AND wave_week_id IN (SELECT id FROM wave_weeks WHERE week_index = 2);

UPDATE wave_week_sets SET percentage = 0.90, reps = 3
  WHERE set_index = 2 AND is_backoff = 0
  AND wave_week_id IN (SELECT id FROM wave_weeks WHERE week_index = 2);

UPDATE wave_week_sets SET percentage = 0.80, reps = 5
  WHERE is_backoff = 1
  AND wave_week_id IN (SELECT id FROM wave_weeks WHERE week_index = 2);

-- Week 4 (deload) — week_index = 3 — already 40/50/60, no change needed
