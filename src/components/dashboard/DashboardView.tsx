import { useState, useEffect } from 'react'
import { getDb } from '../../lib/db'
import { estimatedOneRepMax } from '../../lib/calc'
import { MAIN_LIFTS } from '../../lib/constants'
import { useAppStore } from '../../store/appStore'
import { importFromPwa } from '../../lib/import'

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
  const [importJson, setImportJson] = useState('')
  const [importResult, setImportResult] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const setCurrentView = useAppStore((s) => s.setCurrentView)

  useEffect(() => {
    async function loadDashboard() {
      const db = await getDb()

      // Total workout sessions
      const sessions = await db.select<Array<{ cnt: number }>>(
        `SELECT COUNT(*) as cnt FROM workout_logs WHERE program_id = ?`,
        [programId],
      )
      setTotalSessions(sessions[0]?.cnt ?? 0)

      // Best e1RM per main lift
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
    }
    loadDashboard()
  }, [programId])

  async function handleImport() {
    if (!importJson.trim()) return
    setImporting(true)
    setImportResult(null)
    try {
      const result = await importFromPwa(importJson, programId)
      const parts = []
      if (result.setsImported > 0) parts.push(`${result.setsImported} sets`)
      if (result.notesImported > 0) parts.push(`${result.notesImported} notes`)
      if (result.maxesImported > 0) parts.push(`${result.maxesImported} training maxes`)
      if (result.errors.length > 0) parts.push(`${result.errors.length} errors`)
      setImportResult(parts.length > 0 ? `Imported: ${parts.join(', ')}` : 'No data to import')
      setImportJson('')
    } catch (err) {
      setImportResult(`Import failed: ${err}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="px-4 py-4">
      {/* Header */}
      <div className="mb-6">
        <div className="text-[20px] font-bold">
          <span className="text-accent">FORGE</span>
        </div>
        <div className="text-[11px] text-muted mt-1">{programName} · Block {blockNum} · Week {currentWeek + 1}</div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <button
          onClick={() => setCurrentView('workout')}
          className="p-3 bg-card border border-border rounded-lg cursor-pointer text-left hover:border-accent active:border-accent transition-colors"
        >
          <div className="text-[14px] mb-1">&#127947;&#65039;</div>
          <div className="text-[12px] font-semibold text-bright">Start Workout</div>
          <div className="text-[10px] text-muted">Continue logging</div>
        </button>
        <button
          onClick={() => setCurrentView('history')}
          className="p-3 bg-card border border-border rounded-lg cursor-pointer text-left hover:border-accent active:border-accent transition-colors"
        >
          <div className="text-[14px] mb-1">&#128200;</div>
          <div className="text-[12px] font-semibold text-bright">View History</div>
          <div className="text-[10px] text-muted">Charts & trends</div>
        </button>
      </div>

      {/* Stats */}
      <div className="mb-5">
        <div className="text-[10px] text-dim font-semibold tracking-wider mb-2">OVERVIEW</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="text-[20px] font-bold text-accent font-mono">{totalSessions}</div>
            <div className="text-[10px] text-muted">Logged Sessions</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="text-[20px] font-bold text-bright font-mono">{blockNum}</div>
            <div className="text-[10px] text-muted">Current Block</div>
          </div>
        </div>
      </div>

      {/* PRs */}
      {liftPrs.length > 0 && (
        <div className="mb-5">
          <div className="text-[10px] text-dim font-semibold tracking-wider mb-2">PERSONAL RECORDS (Est 1RM)</div>
          <div className="space-y-1.5">
            {liftPrs.map((pr) => (
              <div key={pr.name} className="flex justify-between items-center p-2.5 bg-card border border-border rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: pr.color }} />
                  <span className="text-[12px] text-bright">{pr.name}</span>
                </div>
                <span className="text-[13px] font-bold font-mono text-accent">{pr.bestE1rm} lb</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Import */}
      <div className="mb-5">
        <div className="text-[10px] text-dim font-semibold tracking-wider mb-2">DATA IMPORT</div>
        <div className="text-[11px] text-faint mb-2">
          Paste your PWA localStorage data (forge-v2 key) to import history.
        </div>
        <textarea
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
          placeholder='{"logs": {...}, "maxes": {...}, ...}'
          className="w-full min-h-[80px] bg-bg border border-[#30363d] rounded-lg text-bright p-2.5 text-[11px] font-mono resize-y leading-relaxed focus:border-accent outline-none mb-2"
        />
        <button
          onClick={handleImport}
          disabled={importing || !importJson.trim()}
          className="w-full py-2 border-none rounded-md cursor-pointer bg-accent text-bg text-[12px] font-semibold font-mono disabled:opacity-50"
        >
          {importing ? 'Importing...' : 'Import Data'}
        </button>
        {importResult && (
          <div className="mt-2 text-[11px] text-muted bg-card border border-border rounded p-2">
            {importResult}
          </div>
        )}
      </div>
    </div>
  )
}
