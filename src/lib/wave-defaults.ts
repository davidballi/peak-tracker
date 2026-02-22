import { v4 as uuid } from 'uuid'
import type { getDb } from './db'

type Db = Awaited<ReturnType<typeof getDb>>

export async function insertDefaultWaveConfig(db: Db, exerciseId: string, _baseMax: number): Promise<void> {
  const wcRows = await db.select<Array<{ id: string }>>(`SELECT id FROM wave_configs WHERE exercise_id = ?`, [exerciseId])
  if (wcRows.length === 0) return
  const wcId = wcRows[0].id

  // Default warmups
  const warmups = [{ reps: 5, pct: 0.5 }, { reps: 3, pct: 0.65 }]
  for (let i = 0; i < warmups.length; i++) {
    await db.execute(
      `INSERT INTO wave_warmups (id, wave_config_id, set_index, reps, percentage) VALUES (?, ?, ?, ?, ?)`,
      [uuid(), wcId, i, warmups[i].reps, warmups[i].pct],
    )
  }

  // Default weeks
  const weeks = [
    { label: 'Wk1 (5s)', sets: [{ reps: 5, pct: 0.75 }, { reps: 5, pct: 0.82 }, { reps: 5, pct: 0.88 }, { reps: 8, pct: 0.75, backoff: true }] },
    { label: 'Wk2 (4s)', sets: [{ reps: 4, pct: 0.79 }, { reps: 4, pct: 0.85 }, { reps: 4, pct: 0.91 }, { reps: 6, pct: 0.79, backoff: true }] },
    { label: 'Wk3 (3s)', sets: [{ reps: 3, pct: 0.82 }, { reps: 3, pct: 0.88 }, { reps: 3, pct: 0.94 }, { reps: 5, pct: 0.82, backoff: true }] },
    { label: 'Wk4 (deload)', sets: [{ reps: 5, pct: 0.69 }, { reps: 5, pct: 0.75 }, { reps: 3, pct: 0.82 }] },
  ]

  for (let wi = 0; wi < weeks.length; wi++) {
    const wwId = uuid()
    await db.execute(
      `INSERT INTO wave_weeks (id, wave_config_id, week_index, label) VALUES (?, ?, ?, ?)`,
      [wwId, wcId, wi, weeks[wi].label],
    )
    for (let si = 0; si < weeks[wi].sets.length; si++) {
      const s = weeks[wi].sets[si]
      await db.execute(
        `INSERT INTO wave_week_sets (id, wave_week_id, set_index, reps, percentage, is_backoff) VALUES (?, ?, ?, ?, ?, ?)`,
        [uuid(), wwId, si, s.reps, s.pct, s.backoff ? 1 : 0],
      )
    }
  }
}
