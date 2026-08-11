-- Migration 014: block rollback support
-- Adds a per-program cycle counter so a block can be re-run after rolling
-- back: each rollback increments programs.cycle, and workout_logs are
-- stamped with the cycle they were logged under. Two runs of the same
-- (day, block, week) therefore never collide with the unique index.

ALTER TABLE programs ADD COLUMN cycle INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workout_logs ADD COLUMN cycle INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS idx_workout_logs_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_logs_unique
  ON workout_logs (program_id, day_id, block_num, week_index, cycle);
