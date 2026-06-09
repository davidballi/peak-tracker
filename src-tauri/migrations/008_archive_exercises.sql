-- Soft-delete support for exercises. Archived exercises keep their set_logs,
-- training_maxes, notes, and goals, stay visible in History, but disappear
-- from the workout day tabs and the program builder's active list.
ALTER TABLE exercises ADD COLUMN archived_at TEXT;

-- The PWA importer created placeholder exercises (sets=0, reps=0) on Day 1
-- purely to anchor imported set_logs. They were never part of the day's
-- programming, so archive them out of the workout view.
UPDATE exercises SET archived_at = datetime('now')
WHERE sets = 0 AND reps = 0 AND is_wave = 0;
