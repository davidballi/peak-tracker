import type { ProgramTemplate } from '../types/template'

/**
 * Wave Periodization template — default 4-day program.
 * This is the default template seeded into program_templates on first launch.
 */
export const PEAK_STRENGTH_TEMPLATE: ProgramTemplate = {
  id: 'peak-strength-v1',
  name: 'Wave Periodization',
  author: 'Forge',
  description: 'Wave-loaded periodization: 3 working weeks + 1 deload. 4 days/week targeting squat, bench, OHP, and deadlift with technical primers, supersets, and accessories.',
  days: [
    {
      id: 'day1',
      name: 'Day 1',
      subtitle: 'Lower Body Strength',
      focus: 'Squat + Posterior Chain',
      exercises: [
        { id: 'db_snatch', name: 'DB Snatch (each arm)', category: 'tech', sets: 3, reps: 3, defaultWeight: 55, note: 'Explosive from floor. CNS primer.' },
        {
          id: 'squat', name: 'Back Squat', category: 'absolute', sets: 0, reps: 0, defaultWeight: 0, note: '', isWave: true,
          wave: {
            warmup: [{ reps: 5, pct: 0.415 }, { reps: 3, pct: 0.569 }],
            weeks: [
              { label: 'Wk1 (5s)', sets: [{ reps: 5, pct: 0.754 }, { reps: 5, pct: 0.815 }, { reps: 5, pct: 0.877 }, { reps: 8, pct: 0.754, backoff: true }] },
              { label: 'Wk2 (4s)', sets: [{ reps: 4, pct: 0.785 }, { reps: 4, pct: 0.846 }, { reps: 4, pct: 0.908 }, { reps: 6, pct: 0.785, backoff: true }] },
              { label: 'Wk3 (3s)', sets: [{ reps: 3, pct: 0.815 }, { reps: 3, pct: 0.877 }, { reps: 3, pct: 0.938 }, { reps: 5, pct: 0.815, backoff: true }] },
              { label: 'Wk4 (deload)', sets: [{ reps: 5, pct: 0.692 }, { reps: 5, pct: 0.754 }, { reps: 3, pct: 0.815 }] },
            ],
            baseMax: 325,
          },
        },
        { id: 'hang_leg_raise', name: 'Hanging Leg Raise', category: 'ss', sets: 4, reps: 10, defaultWeight: 0, note: 'Superset w/ squat. Trunk control.' },
        { id: 'rdl', name: 'Romanian Deadlift', category: 'acc', sets: 3, reps: 8, defaultWeight: 225, note: 'Control the eccentric.' },
        { id: 'pistol_squat', name: 'Pistol Squat (each leg)', category: 'ss', sets: 2, reps: 8, defaultWeight: 0, note: 'Superset w/ RDL.' },
        { id: 'leg_ext', name: 'Leg Extension', category: 'acc', sets: 3, reps: 12, defaultWeight: 155, note: 'Slow eccentric.' },
        { id: 'leg_curl', name: 'Prone Leg Curl', category: 'acc', sets: 3, reps: 12, defaultWeight: 110, note: '' },
        { id: 'calf_raise', name: 'Calf Raise', category: 'acc', sets: 2, reps: 20, defaultWeight: 185, note: '' },
        { id: 'dorsi', name: 'Toe Dorsiflexion', category: 'acc', sets: 2, reps: 20, defaultWeight: 0, note: '' },
      ],
    },
    {
      id: 'day2',
      name: 'Day 2',
      subtitle: 'Upper Body Strength',
      focus: 'Bench Press + Chest/Tri',
      exercises: [
        { id: 'push_press', name: 'Push Press', category: 'tech', sets: 3, reps: 3, defaultWeight: 145, note: 'Explosive leg drive. Prime for bench.' },
        {
          id: 'bench', name: 'Bench Press', category: 'absolute', sets: 0, reps: 0, defaultWeight: 0, note: '', isWave: true,
          wave: {
            warmup: [{ reps: 5, pct: 0.50 }, { reps: 3, pct: 0.685 }],
            weeks: [
              { label: 'Wk1 (5s)', sets: [{ reps: 5, pct: 0.759 }, { reps: 5, pct: 0.833 }, { reps: 5, pct: 0.907 }, { reps: 8, pct: 0.759, backoff: true }] },
              { label: 'Wk2 (4s)', sets: [{ reps: 4, pct: 0.796 }, { reps: 4, pct: 0.870 }, { reps: 4, pct: 0.944 }, { reps: 6, pct: 0.796, backoff: true }] },
              { label: 'Wk3 (3s)', sets: [{ reps: 3, pct: 0.833 }, { reps: 3, pct: 0.907 }, { reps: 3, pct: 0.981 }, { reps: 5, pct: 0.833, backoff: true }] },
              { label: 'Wk4 (deload)', sets: [{ reps: 5, pct: 0.722 }, { reps: 5, pct: 0.796 }, { reps: 3, pct: 0.870 }] },
            ],
            baseMax: 270,
          },
        },
        { id: 'wsitup_b', name: 'Weighted Sit-Up', category: 'ss', sets: 4, reps: 12, defaultWeight: 35, note: 'Superset w/ bench.' },
        { id: 'incline_db', name: 'Incline DB Press', category: 'acc', sets: 3, reps: 10, defaultWeight: 65, note: 'Full ROM. DBs each hand.' },
        { id: 'lat_pd_d2', name: 'Lat Pulldown', category: 'ss', sets: 3, reps: 10, defaultWeight: 130, note: 'Superset w/ incline. Antagonist.' },
        { id: 'dips', name: 'Dips', category: 'acc', sets: 3, reps: 10, defaultWeight: 0, note: 'BW or +25. Lean forward.' },
        { id: 'chest_fly', name: 'Chest Fly', category: 'acc', sets: 3, reps: 12, defaultWeight: 50, note: 'DB or machine.' },
        { id: 'tri_ext', name: 'Tricep Extension', category: 'acc', sets: 3, reps: 12, defaultWeight: 90, note: 'Pump finisher.' },
      ],
    },
    {
      id: 'day3',
      name: 'Day 3',
      subtitle: 'Athletic / Dynamic',
      focus: 'OHP + Unilateral + Core',
      exercises: [
        { id: 'hang_clean', name: 'Hang Power Clean', category: 'tech', sets: 4, reps: 3, defaultWeight: 150, note: 'Fast & aggressive. Sub KB swings if needed.' },
        {
          id: 'ohp', name: 'Overhead Press', category: 'absolute', sets: 0, reps: 0, defaultWeight: 0, note: '', isWave: true,
          wave: {
            warmup: [{ reps: 10, pct: 0.237 }, { reps: 5, pct: 0.50 }],
            weeks: [
              { label: 'Wk1 (5s)', sets: [{ reps: 5, pct: 0.632 }, { reps: 5, pct: 0.711 }, { reps: 5, pct: 0.789 }, { reps: 12, pct: 0.50, backoff: true }] },
              { label: 'Wk2 (4s)', sets: [{ reps: 4, pct: 0.658 }, { reps: 4, pct: 0.737 }, { reps: 4, pct: 0.816 }, { reps: 10, pct: 0.50, backoff: true }] },
              { label: 'Wk3 (3s)', sets: [{ reps: 3, pct: 0.711 }, { reps: 3, pct: 0.789 }, { reps: 3, pct: 0.868 }, { reps: 10, pct: 0.50, backoff: true }] },
              { label: 'Wk4 (deload)', sets: [{ reps: 5, pct: 0.605 }, { reps: 5, pct: 0.684 }, { reps: 3, pct: 0.763 }] },
            ],
            baseMax: 190,
          },
        },
        { id: 'box_jump', name: 'Box Jump', category: 'ss', sets: 3, reps: 5, defaultWeight: 0, note: 'Superset w/ OHP. Reset each rep.' },
        { id: 'front_squat', name: 'Front Squat', category: 'acc', sets: 3, reps: 6, defaultWeight: 195, note: 'Trunk control + quad emphasis.' },
        { id: 'lat_raise', name: 'Lateral Raise', category: 'ss', sets: 3, reps: 12, defaultWeight: 22.5, note: 'Superset w/ front squat.' },
        { id: 'bicep_curl', name: 'Bicep Curl', category: 'acc', sets: 3, reps: 10, defaultWeight: 27.5, note: '' },
        { id: 'hammer_curl', name: 'Hammer Curl', category: 'acc', sets: 3, reps: 10, defaultWeight: 27.5, note: '' },
        { id: 'farmer_carry', name: "Farmer's Carry", category: 'acc', sets: 3, reps: 1, defaultWeight: 70, note: '40 yards each. Each hand.' },
      ],
    },
    {
      id: 'day4',
      name: 'Day 4',
      subtitle: 'Upper Hypertrophy + Pull',
      focus: 'Deadlift + Back/Bicep',
      exercises: [
        { id: 'trap_jump', name: 'Trap Bar Jump / DB Snatch', category: 'tech', sets: 3, reps: 3, defaultWeight: 0, note: 'Explosive intent. Moderate load.' },
        {
          id: 'deadlift', name: 'Deadlift', category: 'absolute', sets: 0, reps: 0, defaultWeight: 0, note: '', isWave: true,
          wave: {
            warmup: [{ reps: 5, pct: 0.333 }, { reps: 3, pct: 0.556 }],
            weeks: [
              { label: 'Wk1 (5s)', sets: [{ reps: 5, pct: 0.679 }, { reps: 5, pct: 0.753 }, { reps: 5, pct: 0.827 }, { reps: 10, pct: 0.556, backoff: true }] },
              { label: 'Wk2 (4s)', sets: [{ reps: 4, pct: 0.704 }, { reps: 4, pct: 0.778 }, { reps: 4, pct: 0.852 }, { reps: 8, pct: 0.556, backoff: true }] },
              { label: 'Wk3 (3s)', sets: [{ reps: 3, pct: 0.728 }, { reps: 3, pct: 0.802 }, { reps: 3, pct: 0.877 }, { reps: 8, pct: 0.556, backoff: true }] },
              { label: 'Wk4 (deload)', sets: [{ reps: 5, pct: 0.630 }, { reps: 5, pct: 0.704 }, { reps: 3, pct: 0.778 }] },
            ],
            baseMax: 405,
          },
        },
        { id: 'ab_wheel', name: 'Ab Wheel Rollout', category: 'ss', sets: 3, reps: 10, defaultWeight: 0, note: 'Superset w/ deadlift.' },
        { id: 'seated_row', name: 'Seated Cable Row', category: 'acc', sets: 4, reps: 10, defaultWeight: 140, note: 'Squeeze at chest.' },
        { id: 'face_pull', name: 'Face Pull', category: 'ss', sets: 3, reps: 15, defaultWeight: 0, note: 'Light. Rear delt / cuff health.' },
        { id: 'lat_pd_d4', name: 'Lat Pulldown (wide)', category: 'acc', sets: 3, reps: 10, defaultWeight: 130, note: '' },
        { id: 'bb_curl', name: 'Barbell Curl', category: 'acc', sets: 3, reps: 10, defaultWeight: 80, note: '' },
        { id: 'farmer_carry_d4', name: "Farmer's Carry / Plate Pinch", category: 'acc', sets: 2, reps: 1, defaultWeight: 0, note: '30s hold. Grip finisher.' },
      ],
    },
  ],
}

/**
 * Wendler's 5/3/1 template — classic 4-day periodization.
 * Week 1: 5/5/5+  Week 2: 3/3/3+  Week 3: 5/3/1+  Deload: 5/5/5
 */
export const FIVE_THREE_ONE_TEMPLATE: ProgramTemplate = {
  id: '531-classic-v1',
  name: "Wendler's 5/3/1",
  author: 'Jim Wendler',
  description: 'Classic 4-day strength program. Each day focuses on one main lift with 5/3/1 wave loading and Boring But Big accessories.',
  days: [
    {
      id: '531_day1',
      name: 'Day 1',
      subtitle: 'Squat Day',
      focus: 'Squat + Leg Accessories',
      exercises: [
        {
          id: '531_squat', name: 'Back Squat', category: 'absolute', sets: 0, reps: 0, defaultWeight: 0, note: '', isWave: true,
          wave: {
            warmup: [{ reps: 5, pct: 0.40 }, { reps: 5, pct: 0.50 }, { reps: 3, pct: 0.60 }],
            weeks: [
              { label: 'Wk1 (5s)', sets: [{ reps: 5, pct: 0.65 }, { reps: 5, pct: 0.75 }, { reps: 5, pct: 0.85 }] },
              { label: 'Wk2 (3s)', sets: [{ reps: 3, pct: 0.70 }, { reps: 3, pct: 0.80 }, { reps: 3, pct: 0.90 }] },
              { label: 'Wk3 (1s)', sets: [{ reps: 5, pct: 0.75 }, { reps: 3, pct: 0.85 }, { reps: 1, pct: 0.95 }] },
              { label: 'Wk4 (deload)', sets: [{ reps: 5, pct: 0.40 }, { reps: 5, pct: 0.50 }, { reps: 5, pct: 0.60 }] },
            ],
            baseMax: 300,
          },
        },
        { id: '531_squat_bbb', name: 'Squat (BBB 5x10)', category: 'acc', sets: 5, reps: 10, defaultWeight: 150, note: 'Boring But Big. 50-60% TM.' },
        { id: '531_leg_curl', name: 'Leg Curl', category: 'acc', sets: 5, reps: 10, defaultWeight: 90, note: '' },
        { id: '531_ab1', name: 'Hanging Leg Raise', category: 'acc', sets: 5, reps: 15, defaultWeight: 0, note: '' },
      ],
    },
    {
      id: '531_day2',
      name: 'Day 2',
      subtitle: 'Bench Day',
      focus: 'Bench Press + Push Accessories',
      exercises: [
        {
          id: '531_bench', name: 'Bench Press', category: 'absolute', sets: 0, reps: 0, defaultWeight: 0, note: '', isWave: true,
          wave: {
            warmup: [{ reps: 5, pct: 0.40 }, { reps: 5, pct: 0.50 }, { reps: 3, pct: 0.60 }],
            weeks: [
              { label: 'Wk1 (5s)', sets: [{ reps: 5, pct: 0.65 }, { reps: 5, pct: 0.75 }, { reps: 5, pct: 0.85 }] },
              { label: 'Wk2 (3s)', sets: [{ reps: 3, pct: 0.70 }, { reps: 3, pct: 0.80 }, { reps: 3, pct: 0.90 }] },
              { label: 'Wk3 (1s)', sets: [{ reps: 5, pct: 0.75 }, { reps: 3, pct: 0.85 }, { reps: 1, pct: 0.95 }] },
              { label: 'Wk4 (deload)', sets: [{ reps: 5, pct: 0.40 }, { reps: 5, pct: 0.50 }, { reps: 5, pct: 0.60 }] },
            ],
            baseMax: 225,
          },
        },
        { id: '531_bench_bbb', name: 'Bench Press (BBB 5x10)', category: 'acc', sets: 5, reps: 10, defaultWeight: 115, note: 'Boring But Big. 50-60% TM.' },
        { id: '531_db_row', name: 'DB Row', category: 'acc', sets: 5, reps: 10, defaultWeight: 60, note: '' },
        { id: '531_ab2', name: 'Ab Wheel Rollout', category: 'acc', sets: 5, reps: 10, defaultWeight: 0, note: '' },
      ],
    },
    {
      id: '531_day3',
      name: 'Day 3',
      subtitle: 'Deadlift Day',
      focus: 'Deadlift + Posterior Chain',
      exercises: [
        {
          id: '531_deadlift', name: 'Deadlift', category: 'absolute', sets: 0, reps: 0, defaultWeight: 0, note: '', isWave: true,
          wave: {
            warmup: [{ reps: 5, pct: 0.40 }, { reps: 5, pct: 0.50 }, { reps: 3, pct: 0.60 }],
            weeks: [
              { label: 'Wk1 (5s)', sets: [{ reps: 5, pct: 0.65 }, { reps: 5, pct: 0.75 }, { reps: 5, pct: 0.85 }] },
              { label: 'Wk2 (3s)', sets: [{ reps: 3, pct: 0.70 }, { reps: 3, pct: 0.80 }, { reps: 3, pct: 0.90 }] },
              { label: 'Wk3 (1s)', sets: [{ reps: 5, pct: 0.75 }, { reps: 3, pct: 0.85 }, { reps: 1, pct: 0.95 }] },
              { label: 'Wk4 (deload)', sets: [{ reps: 5, pct: 0.40 }, { reps: 5, pct: 0.50 }, { reps: 5, pct: 0.60 }] },
            ],
            baseMax: 365,
          },
        },
        { id: '531_dl_bbb', name: 'Deadlift (BBB 5x10)', category: 'acc', sets: 5, reps: 10, defaultWeight: 185, note: 'Boring But Big. 50-60% TM.' },
        { id: '531_leg_raise', name: 'Hanging Leg Raise', category: 'acc', sets: 5, reps: 15, defaultWeight: 0, note: '' },
        { id: '531_good_morning', name: 'Good Morning', category: 'acc', sets: 3, reps: 10, defaultWeight: 95, note: '' },
      ],
    },
    {
      id: '531_day4',
      name: 'Day 4',
      subtitle: 'OHP Day',
      focus: 'OHP + Shoulder/Back Accessories',
      exercises: [
        {
          id: '531_ohp', name: 'OHP', category: 'absolute', sets: 0, reps: 0, defaultWeight: 0, note: '', isWave: true,
          wave: {
            warmup: [{ reps: 5, pct: 0.40 }, { reps: 5, pct: 0.50 }, { reps: 3, pct: 0.60 }],
            weeks: [
              { label: 'Wk1 (5s)', sets: [{ reps: 5, pct: 0.65 }, { reps: 5, pct: 0.75 }, { reps: 5, pct: 0.85 }] },
              { label: 'Wk2 (3s)', sets: [{ reps: 3, pct: 0.70 }, { reps: 3, pct: 0.80 }, { reps: 3, pct: 0.90 }] },
              { label: 'Wk3 (1s)', sets: [{ reps: 5, pct: 0.75 }, { reps: 3, pct: 0.85 }, { reps: 1, pct: 0.95 }] },
              { label: 'Wk4 (deload)', sets: [{ reps: 5, pct: 0.40 }, { reps: 5, pct: 0.50 }, { reps: 5, pct: 0.60 }] },
            ],
            baseMax: 155,
          },
        },
        { id: '531_ohp_bbb', name: 'OHP (BBB 5x10)', category: 'acc', sets: 5, reps: 10, defaultWeight: 80, note: 'Boring But Big. 50-60% TM.' },
        { id: '531_chinup', name: 'Chin-ups', category: 'acc', sets: 5, reps: 10, defaultWeight: 0, note: '' },
        { id: '531_face_pull', name: 'Face Pull', category: 'acc', sets: 5, reps: 15, defaultWeight: 0, note: '' },
      ],
    },
  ],
}
