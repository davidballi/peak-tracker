import { useEffect, useState, useMemo } from 'react'
import { getDb } from '../../lib/db'
import { useHistory } from '../../hooks/useHistory'
import { useBodyWeight } from '../../hooks/useBodyWeight'
import { MAIN_LIFTS } from '../../lib/constants'
import { useAppStore } from '../../store/appStore'
import { StatCards } from './StatCards'
import { E1rmChart } from './E1rmChart'
import { VolumeChart } from './VolumeChart'
import { AllLiftsOverlay } from './AllLiftsOverlay'
import { SetLogList } from './SetLogList'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts'

interface HistoryViewProps {
  programId: string
}

interface ExRow {
  id: string
  name: string
  exercise_key: string
  last_logged: string
}

export function HistoryView({ programId }: HistoryViewProps) {
  const [exercises, setExercises] = useState<ExRow[]>([])
  const [showOverlay, setShowOverlay] = useState(false)
  const [showBodyWeight, setShowBodyWeight] = useState(false)
  const dataVersion = useAppStore((s) => s.dataVersion)
  const { chartData: bwChartData, bwStats, loading: bwLoading } = useBodyWeight()
  const {
    selectedExerciseId,
    e1rmData,
    volumeData,
    setLogHistory,
    stats,
    allLiftsData,
    loading,
    loadExerciseHistory,
    loadAllLiftsOverlay,
    deleteSetLog,
  } = useHistory(programId)

  // Load exercise list
  useEffect(() => {
    async function load() {
      const db = await getDb()
      const rows = await db.select<ExRow[]>(
        `SELECT e.id, e.name, e.exercise_key,
                COALESCE(MAX(sl.logged_at), '') AS last_logged
         FROM exercises e
         JOIN days d ON e.day_id = d.id
         LEFT JOIN set_logs sl ON sl.exercise_id = e.id
         WHERE d.program_id = ?
         GROUP BY e.id, e.name, e.exercise_key, d.day_index, e.exercise_index
         ORDER BY d.day_index, e.exercise_index`,
        [programId],
      )
      setExercises(rows)

      // Auto-select first main lift that exists in this program (most recently
      // logged candidate when multiple exercises share the same key/name).
      for (const ml of MAIN_LIFTS) {
        const matches = rows.filter((e) => e.exercise_key === ml.id || e.name === ml.name)
        if (matches.length === 0) continue
        const best = matches.slice().sort((a, b) => b.last_logged.localeCompare(a.last_logged))[0]
        loadExerciseHistory(best.id)
        return
      }
    }
    load()
  }, [programId, loadExerciseHistory, dataVersion])

  // Get color for selected exercise
  const selectedColor = useMemo(() => {
    if (!selectedExerciseId) return '#f5a623'
    const ex = exercises.find((e) => e.id === selectedExerciseId)
    if (!ex) return '#f5a623'
    const mainLift = MAIN_LIFTS.find((ml) => ml.name === ex.name || ex.exercise_key === ml.id)
    return mainLift?.color ?? '#f5a623'
  }, [selectedExerciseId, exercises])

  // Main lift shortcuts: match by exercise_key first (resilient to renames like
  // OHP → Overhead Press), then by display name. Among multiple matches, pick
  // the one with the most recent log so duplicates from imports don't win.
  const mainLiftExercises = useMemo(() => {
    return MAIN_LIFTS.map((ml) => {
      const matches = exercises.filter(
        (e) => e.exercise_key === ml.id || e.name === ml.name,
      )
      if (matches.length === 0) return { ...ml, exerciseId: null }
      const best = matches.slice().sort((a, b) => b.last_logged.localeCompare(a.last_logged))[0]
      return { ...ml, exerciseId: best.id }
    }).filter((ml) => ml.exerciseId !== null)
  }, [exercises])

  return (
    <div className="px-4 py-4">
      <div className="text-xs font-semibold text-accent mb-3">LIFT HISTORY</div>

      {/* Main lift tabs */}
      {mainLiftExercises.length > 0 && (
        <div className="flex gap-1 mb-3 flex-wrap">
          {mainLiftExercises.map((ml) => (
            <button
              key={ml.id}
              onClick={() => {
                if (ml.exerciseId) {
                  loadExerciseHistory(ml.exerciseId)
                  setShowOverlay(false)
                  setShowBodyWeight(false)
                }
              }}
              className={`px-2.5 py-1 rounded-md text-[17px] border-none cursor-pointer transition-colors ${
                !showBodyWeight && selectedExerciseId === ml.exerciseId
                  ? 'text-bg font-bold'
                  : 'bg-border text-muted hover:text-bright active:text-bright'
              }`}
              style={!showBodyWeight && selectedExerciseId === ml.exerciseId ? { background: ml.color } : undefined}
            >
              {ml.name}
            </button>
          ))}
          <button
            onClick={() => {
              setShowOverlay(true)
              setShowBodyWeight(false)
              loadAllLiftsOverlay()
            }}
            className={`px-2.5 py-1 rounded-md text-[17px] border-none cursor-pointer transition-colors ${
              showOverlay ? 'bg-accent text-bg font-bold' : 'bg-border text-muted hover:text-bright active:text-bright'
            }`}
          >
            All Lifts
          </button>
          <button
            onClick={() => {
              setShowOverlay(false)
              setShowBodyWeight(true)
            }}
            className={`px-2.5 py-1 rounded-md text-[17px] border-none cursor-pointer transition-colors ${
              showBodyWeight ? 'bg-accent text-bg font-bold' : 'bg-border text-muted hover:text-bright active:text-bright'
            }`}
          >
            BW
          </button>
        </div>
      )}

      {loading && <div className="text-center py-8 text-muted text-xs">Loading...</div>}

      {!loading && !bwLoading && showBodyWeight && (
        <>
          {bwStats && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-card border border-border rounded-lg p-3">
                <div className="text-[11px] text-muted uppercase">Current</div>
                <div className="text-[20px] font-bold text-bright font-mono">{bwStats.current}</div>
              </div>
              <div className="bg-card border border-border rounded-lg p-3">
                <div className="text-[11px] text-muted uppercase">30d Change</div>
                <div className={`text-[20px] font-bold font-mono ${bwStats.change30d > 0 ? 'text-danger' : bwStats.change30d < 0 ? 'text-success' : 'text-muted'}`}>
                  {bwStats.change30d > 0 ? '+' : ''}{bwStats.change30d}
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-3">
                <div className="text-[11px] text-muted uppercase">Heaviest</div>
                <div className="text-[20px] font-bold text-bright font-mono">{bwStats.heaviest}</div>
              </div>
              <div className="bg-card border border-border rounded-lg p-3">
                <div className="text-[11px] text-muted uppercase">Lightest</div>
                <div className="text-[20px] font-bold text-bright font-mono">{bwStats.lightest}</div>
              </div>
            </div>
          )}
          {bwChartData.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-3 mb-4">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={bwChartData}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8b949e' }} />
                  <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{ fontSize: 10, fill: '#8b949e' }} />
                  <Line type="monotone" dataKey="weight" stroke="#f5a623" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="rollingAvg" stroke="#636e72" dot={false} strokeWidth={1} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {bwChartData.length === 0 && !bwStats && (
            <div className="text-center py-8 text-faint text-xs">
              No body weight data yet. Log your weight in Settings.
            </div>
          )}
        </>
      )}

      {!loading && !showBodyWeight && showOverlay && <AllLiftsOverlay data={allLiftsData} />}

      {!loading && !showBodyWeight && !showOverlay && stats && (
        <>
          <StatCards stats={stats} />
          <E1rmChart data={e1rmData} color={selectedColor} />
          <VolumeChart data={volumeData} />
          <SetLogList entries={setLogHistory} onDelete={deleteSetLog} />
        </>
      )}

      {!loading && !showBodyWeight && !showOverlay && !stats && (
        <div className="text-center py-8 text-faint text-xs">
          Select an exercise to view history.
        </div>
      )}
    </div>
  )
}
