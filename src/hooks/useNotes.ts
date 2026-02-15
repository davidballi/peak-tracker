import { useEffect, useState, useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import { getDb } from '../lib/db'

const MAX_NOTE_LENGTH = 2000

interface NoteEntry {
  id: string
  note: string
  createdAt: string
  blockNum?: number
  weekIndex?: number
}

/**
 * Manages workout-level and exercise-level notes.
 * Workout notes are stored as exercise_notes with exercise_id = 'workout' convention,
 * linked to the workout_log_id.
 */
export function useNotes(workoutLogId: string | null) {
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({})
  const [workoutNote, setWorkoutNote] = useState<string>('')
  const [workoutNoteId, setWorkoutNoteId] = useState<string | null>(null)

  useEffect(() => {
    if (!workoutLogId) return

    async function load() {
      const db = await getDb()

      // Load exercise notes for this workout log
      const rows = await db.select<Array<{ id: string; exercise_id: string | null; note: string }>>(
        `SELECT id, exercise_id, note FROM exercise_notes WHERE workout_log_id = ?`,
        [workoutLogId],
      )

      const notes: Record<string, string> = {}
      let wNote = ''
      let wNoteId: string | null = null
      for (const r of rows) {
        if (r.exercise_id === null) {
          wNote = r.note
          wNoteId = r.id
        } else {
          notes[r.exercise_id] = r.note
        }
      }
      setExerciseNotes(notes)
      setWorkoutNote(wNote)
      setWorkoutNoteId(wNoteId)
    }
    load()
  }, [workoutLogId])

  const saveExerciseNote = useCallback(
    async (exerciseId: string, note: string) => {
      if (!workoutLogId) return
      const db = await getDb()

      const trimmed = note.trim().slice(0, MAX_NOTE_LENGTH)
      const existing = await db.select<Array<{ id: string }>>(
        `SELECT id FROM exercise_notes WHERE workout_log_id = ? AND exercise_id = ?`,
        [workoutLogId, exerciseId],
      )

      if (trimmed) {
        if (existing.length > 0) {
          await db.execute(`UPDATE exercise_notes SET note = ? WHERE id = ?`, [trimmed, existing[0].id])
        } else {
          await db.execute(
            `INSERT INTO exercise_notes (id, exercise_id, workout_log_id, note) VALUES (?, ?, ?, ?)`,
            [uuid(), exerciseId, workoutLogId, trimmed],
          )
        }
        setExerciseNotes((prev) => ({ ...prev, [exerciseId]: trimmed }))
      } else {
        if (existing.length > 0) {
          await db.execute(`DELETE FROM exercise_notes WHERE id = ?`, [existing[0].id])
        }
        setExerciseNotes((prev) => {
          const next = { ...prev }
          delete next[exerciseId]
          return next
        })
      }
    },
    [workoutLogId],
  )

  const saveWorkoutNote = useCallback(
    async (note: string) => {
      if (!workoutLogId) return
      const db = await getDb()

      const trimmed = note.trim().slice(0, MAX_NOTE_LENGTH)
      if (trimmed) {
        if (workoutNoteId) {
          await db.execute(`UPDATE exercise_notes SET note = ? WHERE id = ?`, [trimmed, workoutNoteId])
        } else {
          const newId = uuid()
          await db.execute(
            `INSERT INTO exercise_notes (id, exercise_id, workout_log_id, note) VALUES (?, ?, ?, ?)`,
            [newId, null, workoutLogId, trimmed],
          )
          setWorkoutNoteId(newId)
        }
        setWorkoutNote(trimmed)
      } else {
        if (workoutNoteId) {
          await db.execute(`DELETE FROM exercise_notes WHERE id = ?`, [workoutNoteId])
          setWorkoutNoteId(null)
        }
        setWorkoutNote('')
      }
    },
    [workoutLogId, workoutNoteId],
  )

  const getPreviousNotes = useCallback(
    async (exerciseId: string, limit = 3): Promise<NoteEntry[]> => {
      const db = await getDb()
      const rows = await db.select<Array<{
        id: string; note: string; created_at: string; block_num: number; week_index: number
      }>>(
        `SELECT en.id, en.note, en.created_at, wl.block_num, wl.week_index
         FROM exercise_notes en
         JOIN workout_logs wl ON en.workout_log_id = wl.id
         WHERE en.exercise_id = ? AND en.workout_log_id != ?
         ORDER BY en.created_at DESC
         LIMIT ?`,
        [exerciseId, workoutLogId ?? '', limit],
      )
      return rows.map((r) => ({
        id: r.id,
        note: r.note,
        createdAt: r.created_at,
        blockNum: r.block_num,
        weekIndex: r.week_index,
      }))
    },
    [workoutLogId],
  )

  const getPreviousWorkoutNotes = useCallback(
    async (dayId: string, limit = 3): Promise<NoteEntry[]> => {
      const db = await getDb()
      const rows = await db.select<Array<{
        id: string; note: string; created_at: string; block_num: number; week_index: number
      }>>(
        `SELECT en.id, en.note, en.created_at, wl.block_num, wl.week_index
         FROM exercise_notes en
         JOIN workout_logs wl ON en.workout_log_id = wl.id
         WHERE en.exercise_id IS NULL AND wl.day_id = ? AND en.workout_log_id != ?
         ORDER BY en.created_at DESC
         LIMIT ?`,
        [dayId, workoutLogId ?? '', limit],
      )
      return rows.map((r) => ({
        id: r.id,
        note: r.note,
        createdAt: r.created_at,
        blockNum: r.block_num,
        weekIndex: r.week_index,
      }))
    },
    [workoutLogId],
  )

  return {
    exerciseNotes,
    workoutNote,
    saveExerciseNote,
    saveWorkoutNote,
    getPreviousNotes,
    getPreviousWorkoutNotes,
  }
}
