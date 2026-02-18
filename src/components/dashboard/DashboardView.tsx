import { useState, useEffect, useCallback } from 'react'
import { getDb } from '../../lib/db'
import { estimatedOneRepMax } from '../../lib/calc'
import { MAIN_LIFTS } from '../../lib/constants'
import { useAppStore } from '../../store/appStore'
import { importWorkoutHistory } from '../../lib/import-history'

interface DashboardViewProps {
  programId: string
  programName: string
  blockNum: number
  currentWeek: number
}

interface LiftPr {
  name: string
  color: string
  bestE1rm: number
}

export function DashboardView({ programId, programName, blockNum, currentWeek }: DashboardViewProps) {
  const [liftPrs, setLiftPrs] = useState<LiftPr[]>([])
  const [totalSessions, setTotalSessions] = useState(0)
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'done' | 'error'>('idle')
  const [importCount, setImportCount] = useState(0)
  const [importError, setImportError] = useState('')
  const setCurrentView = useAppStore((s) => s.setCurrentView)

  const loadDashboard = useCallback(async () => {
    const db = await getDb()

    const sessions = await db.select<Array<{ cnt: number }>>(
      `SELECT COUNT(*) as cnt FROM workout_logs WHERE program_id = ?`,
      [programId],
    )
    setTotalSessions(sessions[0]?.cnt ?? 0)

    const prs: LiftPr[] = []
    for (const lift of MAIN_LIFTS) {
      const exercises = await db.select<Array<{ id: string }>>(
        `SELECT e.id FROM exercises e JOIN days d ON e.day_id = d.id WHERE d.program_id = ? AND e.name = ? LIMIT 1`,
        [programId, lift.name],
      )
      if (exercises.length === 0) continue

      const rows = await db.select<Array<{ weight: number; reps: number }>>(
        `SELECT sl.weight, sl.reps FROM set_logs sl
         JOIN workout_logs wl ON sl.workout_log_id = wl.id
         WHERE sl.exercise_id = ? AND wl.program_id = ?
           AND sl.weight IS NOT NULL AND sl.weight > 0
           AND sl.reps IS NOT NULL AND sl.reps > 0`,
        [exercises[0].id, programId],
      )

      let best = 0
      for (const r of rows) {
        const e1rm = estimatedOneRepMax(r.weight, r.reps)
        if (e1rm > best) best = e1rm
      }

      if (best > 0) {
        prs.push({ name: lift.name, color: lift.color, bestE1rm: best })
      }
    }
    setLiftPrs(prs)
  }, [programId])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const handleImport = useCallback(async () => {
    setImportStatus('importing')
    setImportError('')
    try {
      const count = await importWorkoutHistory(programId)
      setImportCount(count)
      setImportStatus('done')
      if (count > 0) {
        await loadDashboard()
      }
    } catch (err) {
      setImportStatus('error')
      setImportError(err instanceof Error ? err.message : String(err))
    }
  }, [programId, loadDashboard])

  return (
    <div className="px-4 py-4">
      {/* Header */}
      <div className="mb-6">
        <div className="text-[20px] font-bold">
          <span className="text-accent">FORGE</span>
        </div>
        <div className="text-[17px] text-muted mt-1">{programName} · Block {blockNum} · Week {currentWeek + 1}</div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <button
          onClick={() => setCurrentView('workout')}
          className="p-3 bg-card border border-border-elevated rounded-lg shadow-card cursor-pointer text-left hover:border-accent active:border-accent transition-colors"
        >
          <div className="text-accent mb-1"><svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5h0M17.5 6.5h0"/><path d="M2 12h2m16 0h2M6 12H4.5a2.5 2.5 0 0 1 0-5H6m0 5V7m0 5v5.5a2.5 2.5 0 0 0 5 0V12m-5 0h5m0 0h1m0 0h5m-5 0V7m0 5v5.5a2.5 2.5 0 0 1-5 0m10-5h1.5a2.5 2.5 0 0 0 0-5H18m0 5V7"/></svg></div>
          <div className="text-[18px] font-semibold text-bright">Start Workout</div>
          <div className="text-[16px] text-muted">Continue logging</div>
        </button>
        <button
          onClick={() => setCurrentView('history')}
          className="p-3 bg-card border border-border-elevated rounded-lg shadow-card cursor-pointer text-left hover:border-accent active:border-accent transition-colors"
        >
          <div className="text-accent mb-1"><svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg></div>
          <div className="text-[18px] font-semibold text-bright">View History</div>
          <div className="text-[16px] text-muted">Charts & trends</div>
        </button>
      </div>

      {/* Import History */}
      {importStatus !== 'done' && (
        <div className="mb-5 p-3 bg-card border border-border-elevated rounded-lg">
          <div className="text-[16px] text-dim font-semibold tracking-wider mb-2">IMPORT DATA</div>
          {importStatus === 'idle' && (
            <button
              onClick={handleImport}
              className="w-full py-3 min-h-[44px] bg-accent text-bg rounded-lg text-[17px] font-semibold border-none cursor-pointer active:opacity-80"
            >
              Import Workout History
            </button>
          )}
          {importStatus === 'importing' && (
            <div className="text-[17px] text-accent text-center py-3">Importing... this may take a moment</div>
          )}
          {importStatus === 'error' && (
            <div>
              <div className="text-[16px] text-danger mb-2">Import failed: {importError}</div>
              <button
                onClick={handleImport}
                className="w-full py-3 min-h-[44px] bg-danger text-white rounded-lg text-[17px] font-semibold border-none cursor-pointer active:opacity-80"
              >
                Retry Import
              </button>
            </div>
          )}
        </div>
      )}
      {importStatus === 'done' && importCount > 0 && (
        <div className="mb-5 p-3 bg-card border border-success rounded-lg">
          <div className="text-[17px] text-success text-center">Imported {importCount} workout sessions</div>
        </div>
      )}
      {importStatus === 'done' && importCount === 0 && totalSessions === 0 && (
        <div className="mb-5 p-3 bg-card border border-border-elevated rounded-lg">
          <div className="text-[16px] text-muted text-center">No history data to import (already imported or no data found)</div>
        </div>
      )}

      {/* Stats */}
      <div className="mb-5">
        <div className="text-[16px] text-dim font-semibold tracking-wider mb-2">OVERVIEW</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-card border border-border-elevated rounded-lg shadow-card p-3">
            <div className="text-[20px] font-bold text-accent font-mono">{totalSessions}</div>
            <div className="text-[16px] text-muted">Logged Sessions</div>
          </div>
          <div className="bg-card border border-border-elevated rounded-lg shadow-card p-3">
            <div className="text-[20px] font-bold text-bright font-mono">{blockNum}</div>
            <div className="text-[16px] text-muted">Current Block</div>
          </div>
        </div>
      </div>

      {/* PRs */}
      {liftPrs.length > 0 && (
        <div className="mb-5">
          <div className="text-[16px] text-dim font-semibold tracking-wider mb-2">PERSONAL RECORDS (Est 1RM)</div>
          <div className="space-y-1.5">
            {liftPrs.map((pr) => (
              <div key={pr.name} className="flex justify-between items-center p-2.5 bg-card border border-border-elevated rounded-lg shadow-card">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: pr.color }} />
                  <span className="text-[18px] text-bright">{pr.name}</span>
                </div>
                <span className="text-[19px] font-bold font-mono text-accent">{pr.bestE1rm} lb</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
