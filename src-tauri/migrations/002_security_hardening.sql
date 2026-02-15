-- Security hardening migration
-- 1. Make exercise_notes.exercise_id nullable (workout-level notes use NULL)
-- 2. Deduplicate workout_logs and set_logs, then add unique constraints

-- Recreate exercise_notes with nullable exercise_id
CREATE TABLE IF NOT EXISTS exercise_notes_new (
  id TEXT PRIMARY KEY,
  exercise_id TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  workout_log_id TEXT REFERENCES workout_logs(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO exercise_notes_new (id, exercise_id, workout_log_id, note, created_at)
  SELECT id,
         CASE WHEN exercise_id = '__workout__' THEN NULL ELSE exercise_id END,
         workout_log_id, note, created_at
  FROM exercise_notes;

DROP TABLE IF EXISTS exercise_notes;
ALTER TABLE exercise_notes_new RENAME TO exercise_notes;

-- Deduplicate workout_logs: delete set_logs + exercise_notes for duplicate workout_logs first
DELETE FROM set_logs WHERE workout_log_id IN (
  SELECT id FROM workout_logs WHERE rowid NOT IN (
    SELECT MIN(rowid) FROM workout_logs
    GROUP BY program_id, day_id, block_num, week_index
  )
);

DELETE FROM exercise_notes WHERE workout_log_id IN (
  SELECT id FROM workout_logs WHERE rowid NOT IN (
    SELECT MIN(rowid) FROM workout_logs
    GROUP BY program_id, day_id, block_num, week_index
  )
);

DELETE FROM workout_logs WHERE rowid NOT IN (
  SELECT MIN(rowid) FROM workout_logs
  GROUP BY program_id, day_id, block_num, week_index
);

-- Deduplicate set_logs: keep latest per (workout_log_id, exercise_id, set_index)
DELETE FROM set_logs WHERE rowid NOT IN (
  SELECT MAX(rowid) FROM set_logs
  GROUP BY workout_log_id, exercise_id, set_index
);

-- Add unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_logs_unique
  ON workout_logs (program_id, day_id, block_num, week_index);

CREATE UNIQUE INDEX IF NOT EXISTS idx_set_logs_unique
  ON set_logs (workout_log_id, exercise_id, set_index);
