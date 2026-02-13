-- Add CHECK constraints for weight and reps on set_logs.
-- SQLite doesn't support ALTER TABLE ADD CHECK, so we use triggers instead.

-- Reject negative or extreme weights
CREATE TRIGGER IF NOT EXISTS check_set_log_weight_insert
BEFORE INSERT ON set_logs
WHEN NEW.weight IS NOT NULL AND (NEW.weight < 0 OR NEW.weight > 2000)
BEGIN
  SELECT RAISE(ABORT, 'weight must be between 0 and 2000');
END;

CREATE TRIGGER IF NOT EXISTS check_set_log_weight_update
BEFORE UPDATE OF weight ON set_logs
WHEN NEW.weight IS NOT NULL AND (NEW.weight < 0 OR NEW.weight > 2000)
BEGIN
  SELECT RAISE(ABORT, 'weight must be between 0 and 2000');
END;

-- Reject negative or extreme reps
CREATE TRIGGER IF NOT EXISTS check_set_log_reps_insert
BEFORE INSERT ON set_logs
WHEN NEW.reps IS NOT NULL AND (NEW.reps < 0 OR NEW.reps > 100)
BEGIN
  SELECT RAISE(ABORT, 'reps must be between 0 and 100');
END;

CREATE TRIGGER IF NOT EXISTS check_set_log_reps_update
BEFORE UPDATE OF reps ON set_logs
WHEN NEW.reps IS NOT NULL AND (NEW.reps < 0 OR NEW.reps > 100)
BEGIN
  SELECT RAISE(ABORT, 'reps must be between 0 and 100');
END;

-- Reject negative or extreme training max values
CREATE TRIGGER IF NOT EXISTS check_training_max_insert
BEFORE INSERT ON training_maxes
WHEN NEW.value < 0 OR NEW.value > 2000
BEGIN
  SELECT RAISE(ABORT, 'training max must be between 0 and 2000');
END;
