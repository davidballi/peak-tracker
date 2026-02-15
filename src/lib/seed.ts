import { v4 as uuid } from 'uuid'
import { getDb } from './db'
import { PEAK_STRENGTH_TEMPLATE, FIVE_THREE_ONE_TEMPLATE } from './templates'
import type { ProgramTemplate, TemplateExercise } from '../types/template'

/**
 * Seed a program template into the database.
 * Uses deterministic IDs so that double-calls (e.g. React StrictMode)
 * produce identical rows and INSERT OR IGNORE is truly idempotent.
 */
async function seedTemplate(template: ProgramTemplate): Promise<void> {
  const db = await getDb()

  await db.execute(
    `INSERT OR IGNORE INTO program_templates (id, name, author, description, days_per_week) VALUES (?, ?, ?, ?, ?)`,
    [template.id, template.name, template.author, template.description, template.days.length],
  )

  for (let di = 0; di < template.days.length; di++) {
    const day = template.days[di]
    for (let ei = 0; ei < day.exercises.length; ei++) {
      const ex: TemplateExercise = day.exercises[ei]
      const etId = `${template.id}_d${di}_e${ei}`
      await db.execute(
        `INSERT OR IGNORE INTO exercise_templates (id, template_id, day_index, day_name, day_subtitle, day_focus, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [etId, template.id, di, day.name, day.subtitle, day.focus, ei, ex.id, ex.name, ex.category, ex.sets, ex.reps, ex.defaultWeight, ex.note, ex.isWave ? 1 : 0],
      )

      if (ex.isWave && ex.wave) {
        const wcId = `${etId}_wc`
        await db.execute(
          `INSERT OR IGNORE INTO wave_config_templates (id, exercise_template_id, base_max) VALUES (?, ?, ?)`,
          [wcId, etId, ex.wave.baseMax],
        )

        for (let wi = 0; wi < ex.wave.warmup.length; wi++) {
          const w = ex.wave.warmup[wi]
          await db.execute(
            `INSERT OR IGNORE INTO wave_warmup_templates (id, wave_config_id, set_index, reps, percentage) VALUES (?, ?, ?, ?, ?)`,
            [`${wcId}_wu${wi}`, wcId, wi, w.reps, w.pct],
          )
        }

        for (let wki = 0; wki < ex.wave.weeks.length; wki++) {
          const wk = ex.wave.weeks[wki]
          const wwId = `${wcId}_wk${wki}`
          await db.execute(
            `INSERT OR IGNORE INTO wave_week_templates (id, wave_config_id, week_index, label) VALUES (?, ?, ?, ?)`,
            [wwId, wcId, wki, wk.label],
          )
          for (let si = 0; si < wk.sets.length; si++) {
            const s = wk.sets[si]
            await db.execute(
              `INSERT OR IGNORE INTO wave_week_set_templates (id, wave_week_id, set_index, reps, percentage, is_backoff) VALUES (?, ?, ?, ?, ?, ?)`,
              [`${wwId}_s${si}`, wwId, si, s.reps, s.pct, s.backoff ? 1 : 0],
            )
          }
        }
      }
    }
  }
}

/**
 * Fork a template into a user program. Deep copies all template data
 * into the user-editable program/days/exercises tables.
 * Returns the new program ID.
 */
export async function forkTemplate(templateId: string): Promise<string> {
  const db = await getDb()
  const programId = uuid()

  // Get template info
  const templates = await db.select<Array<{ name: string }>>(
    `SELECT name FROM program_templates WHERE id = ?`,
    [templateId],
  )
  if (templates.length === 0) throw new Error(`Template ${templateId} not found`)

  await db.execute('BEGIN TRANSACTION')
  try {
    // Deactivate all existing programs
    await db.execute(`UPDATE programs SET is_active = 0`)

    // Create program
    await db.execute(
      `INSERT INTO programs (id, name, source_template_id, current_day, current_week, block_num, is_active) VALUES (?, ?, ?, 0, 0, 1, 1)`,
      [programId, templates[0].name, templateId],
    )

    // Get all exercise templates for this template, grouped by day
    const exerciseTemplates = await db.select<Array<{
      id: string; day_index: number; day_name: string; day_subtitle: string; day_focus: string;
      exercise_index: number; exercise_key: string; name: string; category: string;
      sets: number; reps: number; default_weight: number; note: string; is_wave: number;
    }>>(
      `SELECT * FROM exercise_templates WHERE template_id = ? ORDER BY day_index, exercise_index`,
      [templateId],
    )

    // Group by day_index to create days
    const dayMap = new Map<number, { name: string; subtitle: string; focus: string; dayId: string }>()
    for (const et of exerciseTemplates) {
      if (!dayMap.has(et.day_index)) {
        const dayId = uuid()
        dayMap.set(et.day_index, { name: et.day_name, subtitle: et.day_subtitle, focus: et.day_focus, dayId })
        await db.execute(
          `INSERT INTO days (id, program_id, day_index, name, subtitle, focus) VALUES (?, ?, ?, ?, ?, ?)`,
          [dayId, programId, et.day_index, et.day_name, et.day_subtitle, et.day_focus],
        )
      }
    }

    // Create exercises + wave configs
    for (const et of exerciseTemplates) {
      const dayInfo = dayMap.get(et.day_index)!
      const exerciseId = uuid()
      await db.execute(
        `INSERT INTO exercises (id, day_id, exercise_index, exercise_key, name, category, sets, reps, default_weight, note, is_wave) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [exerciseId, dayInfo.dayId, et.exercise_index, et.exercise_key, et.name, et.category, et.sets, et.reps, et.default_weight, et.note, et.is_wave],
      )

      if (et.is_wave) {
        // Copy wave config
        const waveConfigs = await db.select<Array<{ id: string; base_max: number }>>(
          `SELECT * FROM wave_config_templates WHERE exercise_template_id = ?`,
          [et.id],
        )
        if (waveConfigs.length > 0) {
          const wc = waveConfigs[0]
          const newWcId = uuid()
          await db.execute(
            `INSERT INTO wave_configs (id, exercise_id, base_max) VALUES (?, ?, ?)`,
            [newWcId, exerciseId, wc.base_max],
          )

          // Copy warmups
          const warmups = await db.select<Array<{ set_index: number; reps: number; percentage: number }>>(
            `SELECT set_index, reps, percentage FROM wave_warmup_templates WHERE wave_config_id = ? ORDER BY set_index`,
            [wc.id],
          )
          for (const w of warmups) {
            await db.execute(
              `INSERT INTO wave_warmups (id, wave_config_id, set_index, reps, percentage) VALUES (?, ?, ?, ?, ?)`,
              [uuid(), newWcId, w.set_index, w.reps, w.percentage],
            )
          }

          // Copy weeks + sets
          const weeks = await db.select<Array<{ id: string; week_index: number; label: string }>>(
            `SELECT * FROM wave_week_templates WHERE wave_config_id = ? ORDER BY week_index`,
            [wc.id],
          )
          for (const wk of weeks) {
            const newWwId = uuid()
            await db.execute(
              `INSERT INTO wave_weeks (id, wave_config_id, week_index, label) VALUES (?, ?, ?, ?)`,
              [newWwId, newWcId, wk.week_index, wk.label],
            )
            const sets = await db.select<Array<{ set_index: number; reps: number; percentage: number; is_backoff: number }>>(
              `SELECT set_index, reps, percentage, is_backoff FROM wave_week_set_templates WHERE wave_week_id = ? ORDER BY set_index`,
              [wk.id],
            )
            for (const s of sets) {
              await db.execute(
                `INSERT INTO wave_week_sets (id, wave_week_id, set_index, reps, percentage, is_backoff) VALUES (?, ?, ?, ?, ?, ?)`,
                [uuid(), newWwId, s.set_index, s.reps, s.percentage, s.is_backoff],
              )
            }
          }

          // Insert initial training max
          await db.execute(
            `INSERT INTO training_maxes (id, exercise_id, value, block_num, source) VALUES (?, ?, ?, 1, 'template')`,
            [uuid(), exerciseId, wc.base_max],
          )
        }
      }
    }

    await db.execute('COMMIT')
  } catch (err) {
    await db.execute('ROLLBACK')
    throw err
  }

  return programId
}

/**
 * Run on first launch: seed built-in templates if they don't exist.
 * Also cleans up duplicate rows left by earlier UUID-based seeding.
 */
export async function seedIfNeeded(): Promise<void> {
  const db = await getDb()

  const existing1 = await db.select<Array<{ id: string }>>(
    `SELECT id FROM program_templates WHERE id = ?`,
    [PEAK_STRENGTH_TEMPLATE.id],
  )
  if (existing1.length === 0) {
    await seedTemplate(PEAK_STRENGTH_TEMPLATE)
  }

  const existing2 = await db.select<Array<{ id: string }>>(
    `SELECT id FROM program_templates WHERE id = ?`,
    [FIVE_THREE_ONE_TEMPLATE.id],
  )
  if (existing2.length === 0) {
    await seedTemplate(FIVE_THREE_ONE_TEMPLATE)
  }

  // Clean up duplicates from earlier UUID-based seeding.
  // Keep deterministic IDs (contain '_d'), delete random UUID dupes.
  await cleanupDuplicateTemplates(db)
}

/**
 * Remove duplicate exercise_templates (and their children) that were
 * created by the old UUID-based seeding running twice under StrictMode.
 * Also cleans up duplicate exercises in already-forked programs.
 */
async function cleanupDuplicateTemplates(db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  for (const templateId of [PEAK_STRENGTH_TEMPLATE.id, FIVE_THREE_ONE_TEMPLATE.id]) {
    // Find duplicate exercise_templates: same (template_id, day_index, exercise_index)
    // but with UUID-style IDs (not our deterministic pattern)
    const dupes = await db.select<Array<{ id: string }>>(
      `SELECT et.id FROM exercise_templates et
       WHERE et.template_id = ?
         AND et.id NOT LIKE ?
         AND EXISTS (
           SELECT 1 FROM exercise_templates et2
           WHERE et2.template_id = et.template_id
             AND et2.day_index = et.day_index
             AND et2.exercise_index = et.exercise_index
             AND et2.id LIKE ?
         )`,
      [templateId, `${templateId}_%`, `${templateId}_%`],
    )

    if (dupes.length === 0) continue

    const dupeIds = dupes.map((d) => d.id)

    // Delete orphaned wave children for these exercise_templates
    for (const etId of dupeIds) {
      const wcs = await db.select<Array<{ id: string }>>(
        `SELECT id FROM wave_config_templates WHERE exercise_template_id = ?`,
        [etId],
      )
      for (const wc of wcs) {
        const wks = await db.select<Array<{ id: string }>>(
          `SELECT id FROM wave_week_templates WHERE wave_config_id = ?`,
          [wc.id],
        )
        for (const wk of wks) {
          await db.execute(`DELETE FROM wave_week_set_templates WHERE wave_week_id = ?`, [wk.id])
        }
        await db.execute(`DELETE FROM wave_week_templates WHERE wave_config_id = ?`, [wc.id])
        await db.execute(`DELETE FROM wave_warmup_templates WHERE wave_config_id = ?`, [wc.id])
      }
      await db.execute(`DELETE FROM wave_config_templates WHERE exercise_template_id = ?`, [etId])
      await db.execute(`DELETE FROM exercise_templates WHERE id = ?`, [etId])
    }
  }

  // Clean up duplicate exercises in already-forked programs.
  // Keep the first exercise per (day_id, exercise_index) by rowid.
  const dupeExercises = await db.select<Array<{ id: string }>>(
    `SELECT e.id FROM exercises e
     WHERE e.rowid NOT IN (
       SELECT MIN(e2.rowid) FROM exercises e2 GROUP BY e2.day_id, e2.exercise_index
     )`,
  )

  for (const ex of dupeExercises) {
    // Delete wave children
    const wcs = await db.select<Array<{ id: string }>>(
      `SELECT id FROM wave_configs WHERE exercise_id = ?`,
      [ex.id],
    )
    for (const wc of wcs) {
      const wks = await db.select<Array<{ id: string }>>(
        `SELECT id FROM wave_weeks WHERE wave_config_id = ?`,
        [wc.id],
      )
      for (const wk of wks) {
        await db.execute(`DELETE FROM wave_week_sets WHERE wave_week_id = ?`, [wk.id])
      }
      await db.execute(`DELETE FROM wave_weeks WHERE wave_config_id = ?`, [wc.id])
      await db.execute(`DELETE FROM wave_warmups WHERE wave_config_id = ?`, [wc.id])
    }
    await db.execute(`DELETE FROM wave_configs WHERE exercise_id = ?`, [ex.id])
    await db.execute(`DELETE FROM training_maxes WHERE exercise_id = ?`, [ex.id])
    await db.execute(`DELETE FROM exercises WHERE id = ?`, [ex.id])
  }
}
