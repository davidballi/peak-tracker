import { getDb } from './db'
import { estimatedOneRepMax } from './calc'

interface CsvRow {
  started_at: string
  block_num: number
  week_index: number
  day_name: string
  exercise_name: string
  set_index: number
  weight: number
  reps: number
}

function csvEscape(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

export async function buildCsvString(programId: string): Promise<string> {
  const db = await getDb()

  const rows = await db.select<CsvRow[]>(
    `SELECT
       wl.started_at,
       wl.block_num,
       wl.week_index,
       d.name AS day_name,
       e.name AS exercise_name,
       sl.set_index,
       sl.weight,
       sl.reps
     FROM set_logs sl
     JOIN workout_logs wl ON sl.workout_log_id = wl.id
     JOIN days d ON wl.day_id = d.id
     JOIN exercises e ON sl.exercise_id = e.id
     WHERE wl.program_id = ?
       AND sl.is_completed = 1
       AND sl.weight IS NOT NULL
       AND sl.reps IS NOT NULL
     ORDER BY wl.started_at, d.day_index, e.exercise_index, sl.set_index`,
    [programId],
  )

  const header = 'date,block,week,day,exercise,set,weight,reps,e1rm'
  const lines = rows.map((r) => {
    const date = r.started_at.split(/[T ]/)[0]
    const week = r.week_index + 1
    const set = r.set_index + 1
    const e1rm = estimatedOneRepMax(r.weight, r.reps)
    return [
      csvEscape(date),
      r.block_num,
      week,
      csvEscape(r.day_name),
      csvEscape(r.exercise_name),
      set,
      r.weight,
      r.reps,
      e1rm,
    ].join(',')
  })

  return [header, ...lines].join('\n')
}

interface SetLogRow {
  id: string
  exercise_id: string
  set_index: number
  weight: number | null
  reps: number | null
  is_completed: number
  logged_at: string
}

interface WorkoutLogRow {
  id: string
  day_id: string
  block_num: number
  week_index: number
  started_at: string
}

interface TrainingMaxRow {
  id: string
  exercise_id: string
  value: number
  block_num: number
  source: string
  created_at: string
}

interface NoteRow {
  id: string
  exercise_id: string
  workout_log_id: string | null
  note: string
  created_at: string
}

interface GoalRow {
  id: string
  exercise_id: string
  goal_type: string
  target_value: number
  deadline: string | null
  achieved_at: string | null
  created_at: string
}

interface SettingRow {
  key: string
  value: string
}

export async function buildJsonBackup(programId: string): Promise<string> {
  const db = await getDb()

  const workoutLogs = await db.select<WorkoutLogRow[]>(
    `SELECT id, day_id, block_num, week_index, started_at
     FROM workout_logs
     WHERE program_id = ?
     ORDER BY started_at`,
    [programId],
  )

  const workouts = []
  for (const wl of workoutLogs) {
    const sets = await db.select<SetLogRow[]>(
      `SELECT id, exercise_id, set_index, weight, reps, is_completed, logged_at
       FROM set_logs
       WHERE workout_log_id = ?
       ORDER BY set_index`,
      [wl.id],
    )
    workouts.push({ ...wl, sets })
  }

  const trainingMaxes = await db.select<TrainingMaxRow[]>(
    `SELECT tm.id, tm.exercise_id, tm.value, tm.block_num, tm.source, tm.created_at
     FROM training_maxes tm
     JOIN exercises e ON tm.exercise_id = e.id
     JOIN days d ON e.day_id = d.id
     WHERE d.program_id = ?
     ORDER BY tm.created_at`,
    [programId],
  )

  const notes = await db.select<NoteRow[]>(
    `SELECT en.id, en.exercise_id, en.workout_log_id, en.note, en.created_at
     FROM exercise_notes en
     JOIN exercises e ON en.exercise_id = e.id
     JOIN days d ON e.day_id = d.id
     WHERE d.program_id = ?
     ORDER BY en.created_at`,
    [programId],
  )

  const goals = await db.select<GoalRow[]>(
    `SELECT sg.id, sg.exercise_id, sg.goal_type, sg.target_value, sg.deadline, sg.achieved_at, sg.created_at
     FROM strength_goals sg
     JOIN exercises e ON sg.exercise_id = e.id
     JOIN days d ON e.day_id = d.id
     WHERE d.program_id = ?
     ORDER BY sg.created_at`,
    [programId],
  )

  const settingsRows = await db.select<SettingRow[]>(
    `SELECT key, value FROM user_settings`,
  )
  const settings: Record<string, string> = {}
  for (const row of settingsRows) {
    settings[row.key] = row.value
  }

  const backup = {
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    workouts,
    trainingMaxes,
    notes,
    goals,
    settings,
  }

  return JSON.stringify(backup, null, 2)
}

export async function shareFile(
  content: string,
  filename: string,
  mimeType: string,
): Promise<void> {
  const blob = new Blob([content], { type: mimeType })
  const file = new File([blob], filename, { type: mimeType })
  if (navigator.share && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file] })
  } else {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
}
