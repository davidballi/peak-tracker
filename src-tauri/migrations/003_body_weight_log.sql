CREATE TABLE IF NOT EXISTS body_weight_log (
  id TEXT PRIMARY KEY,
  weight REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT 'lb',
  logged_at TEXT NOT NULL DEFAULT (date('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bw_log_date
  ON body_weight_log (logged_at);
