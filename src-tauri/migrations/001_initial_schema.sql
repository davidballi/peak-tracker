-- Forge: Initial Schema
-- All IDs are TEXT (UUIDs generated in JS)

-- ============================================================
-- TEMPLATES (read-only seed data, never modified by user)
-- ============================================================

CREATE TABLE IF NOT EXISTS program_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  days_per_week INTEGER NOT NULL DEFAULT 4,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exercise_templates (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL,
  day_name TEXT NOT NULL DEFAULT '',
  day_subtitle TEXT NOT NULL DEFAULT '',
  day_focus TEXT NOT NULL DEFAULT '',
  exercise_index INTEGER NOT NULL,
  exercise_key TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('tech','absolute','ss','acc')),
  sets INTEGER NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  default_weight REAL NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  is_wave INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wave_config_templates (
  id TEXT PRIMARY KEY,
  exercise_template_id TEXT NOT NULL UNIQUE REFERENCES exercise_templates(id) ON DELETE CASCADE,
  base_max REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS wave_warmup_templates (
  id TEXT PRIMARY KEY,
  wave_config_id TEXT NOT NULL REFERENCES wave_config_templates(id) ON DELETE CASCADE,
  set_index INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  percentage REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS wave_week_templates (
  id TEXT PRIMARY KEY,
  wave_config_id TEXT NOT NULL REFERENCES wave_config_templates(id) ON DELETE CASCADE,
  week_index INTEGER NOT NULL,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wave_week_set_templates (
  id TEXT PRIMARY KEY,
  wave_week_id TEXT NOT NULL REFERENCES wave_week_templates(id) ON DELETE CASCADE,
  set_index INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  percentage REAL NOT NULL,
  is_backoff INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- USER PROGRAMS (forked from templates, fully editable)
-- ============================================================

CREATE TABLE IF NOT EXISTS programs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_template_id TEXT REFERENCES program_templates(id),
  current_day INTEGER NOT NULL DEFAULT 0,
  current_week INTEGER NOT NULL DEFAULT 0,
  block_num INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS days (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  focus TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  day_id TEXT NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  exercise_index INTEGER NOT NULL,
  exercise_key TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('tech','absolute','ss','acc')),
  sets INTEGER NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  default_weight REAL NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  is_wave INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wave_configs (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL UNIQUE REFERENCES exercises(id) ON DELETE CASCADE,
  base_max REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS wave_warmups (
  id TEXT PRIMARY KEY,
  wave_config_id TEXT NOT NULL REFERENCES wave_configs(id) ON DELETE CASCADE,
  set_index INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  percentage REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS wave_weeks (
  id TEXT PRIMARY KEY,
  wave_config_id TEXT NOT NULL REFERENCES wave_configs(id) ON DELETE CASCADE,
  week_index INTEGER NOT NULL,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wave_week_sets (
  id TEXT PRIMARY KEY,
  wave_week_id TEXT NOT NULL REFERENCES wave_weeks(id) ON DELETE CASCADE,
  set_index INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  percentage REAL NOT NULL,
  is_backoff INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- TRAINING MAXES (append-only log for TM changes)
-- ============================================================

CREATE TABLE IF NOT EXISTS training_maxes (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  value REAL NOT NULL,
  block_num INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- WORKOUT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS workout_logs (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  day_id TEXT NOT NULL REFERENCES days(id),
  block_num INTEGER NOT NULL,
  week_index INTEGER NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS set_logs (
  id TEXT PRIMARY KEY,
  workout_log_id TEXT NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  set_index INTEGER NOT NULL,
  weight REAL,
  reps INTEGER,
  is_completed INTEGER NOT NULL DEFAULT 0,
  logged_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exercise_notes (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  workout_log_id TEXT REFERENCES workout_logs(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- STRENGTH GOALS
-- ============================================================

CREATE TABLE IF NOT EXISTS strength_goals (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL DEFAULT 'e1rm' CHECK(goal_type IN ('e1rm','weight','reps')),
  target_value REAL NOT NULL,
  deadline TEXT,
  achieved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- USER SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS user_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
