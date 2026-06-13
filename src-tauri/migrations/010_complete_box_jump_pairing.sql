-- Migration 010: Complete box_jump pairing for Wave forks that were missing it
-- Design: docs/superpowers/specs/2026-06-10-wave-plan-revision-design.md (follow-up)
--
-- Migration 009 re-paired supersets by SWAPPING box_jump <-> hang_leg_raise
-- positions. That swap required BOTH exercises to exist in a fork. A fork that
-- had box_jump removed before 009 kept hang_leg_raise paired with squat on
-- Day 1 and never received box_jump, so 009 correctly no-op'd there.
--
-- This migration completes the approved design for those forks: relocate
-- hang_leg_raise to Day 3 as OHP's superset partner, and insert box_jump as
-- squat's Day 1 partner in the slot the leg raise vacated.
--
-- Scope: peak-strength-v1 forks with a LIVE hang_leg_raise but NO LIVE
-- box_jump. Matched by exercise_key (survives renames); archived rows
-- excluded. Idempotent -- the no-box_jump guard makes re-runs no-op, and
-- fresh forks (created post-009 from the already-correct template) are never
-- in this state, so this no-ops for all new installs. Template tables are
-- intentionally untouched: 009 already gave the template the correct layout.

-- Capture, per affected program: the leg raise row + its Day 1 slot, the
-- Day 3 id, and OHP's Day 3 slot. The NOT EXISTS guard restricts this to
-- forks still missing a live box_jump.
CREATE TEMPORARY TABLE _bjfix AS
SELECT p.id AS program_id,
       lr.id AS lr_id,
       lr.day_id AS d1_id,
       lr.exercise_index AS lr_idx,
       d3.id AS d3_id,
       ohp.exercise_index AS ohp_idx
FROM programs p
JOIN days d1 ON d1.program_id = p.id
JOIN exercises lr ON lr.day_id = d1.id AND lr.exercise_key = 'hang_leg_raise' AND lr.archived_at IS NULL
JOIN days d3 ON d3.program_id = p.id AND d3.day_index = 2
JOIN exercises ohp ON ohp.day_id = d3.id AND ohp.exercise_key = 'ohp' AND ohp.archived_at IS NULL
WHERE p.source_template_id = 'peak-strength-v1'
  AND NOT EXISTS (
    SELECT 1 FROM days dx JOIN exercises bx ON bx.day_id = dx.id
    WHERE dx.program_id = p.id AND bx.exercise_key = 'box_jump' AND bx.archived_at IS NULL
  );

-- 1. Make room on Day 3: shift live exercises after OHP down by one.
--    (leg raise is still on Day 1 here, so it is untouched by this shift.)
UPDATE exercises
SET exercise_index = exercise_index + 1
WHERE archived_at IS NULL
  AND day_id IN (SELECT d3_id FROM _bjfix)
  AND exercise_index > (SELECT ohp_idx FROM _bjfix WHERE _bjfix.d3_id = exercises.day_id);

-- 2. Relocate leg raise to Day 3 immediately after OHP, re-pair with OHP.
UPDATE exercises
SET day_id = (SELECT d3_id FROM _bjfix WHERE _bjfix.lr_id = exercises.id),
    exercise_index = (SELECT ohp_idx + 1 FROM _bjfix WHERE _bjfix.lr_id = exercises.id),
    category = 'ss',
    note = 'Superset w/ OHP. Trunk control.'
WHERE id IN (SELECT lr_id FROM _bjfix);

-- 3. Insert box_jump into the Day 1 slot the leg raise vacated, paired w/ squat.
INSERT INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave)
SELECT lower(hex(randomblob(16))), d1_id, lr_idx, 'box_jump', 'Box Jump', 'ss', 3, 5, 0,
       'Superset w/ squat. Jump between squat sets, reset each rep.', 0
FROM _bjfix;

DROP TABLE _bjfix;
