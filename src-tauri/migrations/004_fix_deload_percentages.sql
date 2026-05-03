-- Fix deload week percentages that were too high (working-set intensity instead of deload)
-- Deload weeks (week_index = 3) should use 40/50/60% TM, not 60-87%

UPDATE wave_week_sets
SET percentage = CASE set_index
  WHEN 0 THEN 0.40
  WHEN 1 THEN 0.50
  WHEN 2 THEN 0.60
  ELSE percentage
END,
reps = 5
WHERE wave_week_id IN (
  SELECT ww.id FROM wave_weeks ww
  WHERE ww.week_index = 3
)
AND set_index <= 2;
