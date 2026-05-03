-- Migration 006: Renumber post-import blocks to come after PWA history
--
-- The PWA importer stamped historical workouts with block_num up to ~36 while
-- real recent workouts started at block_num 1, so the History chart ordered
-- by block_num placed brand-new sessions in the middle of the chart.
-- Shift any block_num <= 4 by the highest imported block_num so real recent
-- training is appended sequentially after the imported history.
--
-- Idempotent: only fires when imports (block_num >= 5) coexist with low
-- block_nums; on a fresh install or after a previous run, all UPDATEs no-op.

CREATE TEMPORARY TABLE _block_shift AS
  SELECT COALESCE(
    (SELECT MAX(block_num) FROM workout_logs WHERE block_num >= 5),
    0
  ) AS shift;

UPDATE workout_logs
SET block_num = block_num + (SELECT shift FROM _block_shift)
WHERE block_num BETWEEN 1 AND 4
  AND (SELECT shift FROM _block_shift) > 0;

UPDATE training_maxes
SET block_num = block_num + (SELECT shift FROM _block_shift)
WHERE block_num BETWEEN 1 AND 4
  AND (SELECT shift FROM _block_shift) > 0;

UPDATE programs
SET block_num = block_num + (SELECT shift FROM _block_shift)
WHERE block_num BETWEEN 1 AND 4
  AND (SELECT shift FROM _block_shift) > 0;

DROP TABLE _block_shift;
