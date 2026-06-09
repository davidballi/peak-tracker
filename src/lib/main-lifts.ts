interface MainLiftExerciseRow {
  id: string
  last_logged: string
}

interface MainLiftDb {
  select(sql: string, params?: unknown[]): Promise<MainLiftExerciseRow[]>
}

export interface MainLiftRef {
  id: string
  name: string
}

/**
 * Resolve a MAIN_LIFTS entry to an exercise id: match by exercise_key first
 * (stable across renames like "OHP" → "Overhead Press"), then display name.
 * Prefer the candidate with the most recent set_log so PWA-import duplicates
 * lose to actively-used exercises.
 */
export async function findMainLiftExerciseId(
  db: MainLiftDb,
  programId: string,
  lift: MainLiftRef,
): Promise<string | null> {
  const rows = await db.select(
    `SELECT e.id, COALESCE(MAX(sl.logged_at), '') AS last_logged
     FROM exercises e
     JOIN days d ON e.day_id = d.id
     LEFT JOIN set_logs sl ON sl.exercise_id = e.id
     WHERE d.program_id = ? AND (e.exercise_key = ? OR e.name = ?)
     GROUP BY e.id
     ORDER BY last_logged DESC
     LIMIT 1`,
    [programId, lift.id, lift.name],
  )
  return rows.length > 0 ? rows[0].id : null
}
