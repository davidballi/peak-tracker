import { useEffect, useState, useMemo } from 'react'
import { getDb } from '../../lib/db'
import { useHistory } from '../../hooks/useHistory'
import { MAIN_LIFTS } from '../../lib/constants'
import { StatCards } from './StatCards'
import { E1rmChart } from './E1rmChart'
import { VolumeChart } from './VolumeChart'
import { AllLiftsOverlay } from './AllLiftsOverlay'
import { SetLogList } from './SetLogList'

interface HistoryViewProps {
  programId: string
}

interface ExRow {
  id: string
  name: string
  is_wave: number
}

export function HistoryView({ programId }: HistoryViewProps) {
  const [exercises, setExercises] = useState<ExRow[]>([])
  const [showOverlay, setShowOverlay] = useState(false)
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
        `SELECT e.id, e.name, e.is_wave FROM exercises e
         JOIN days d ON e.day_id = d.id
         WHERE d.program_id = ?
         ORDER BY d.day_index, e.exercise_index`,
        [programId],
      )
      setExercises(rows)

      // Auto-select first wave exercise (main lift)
      const firstWave = rows.find((e) => e.is_wave)
      if (firstWave) {
        loadExerciseHistory(firstWave.id)
      } else if (rows.length > 0) {
        loadExerciseHistory(rows[0].id)
      }
    }
    load()
  }, [programId, loadExerciseHistory])

  // Get color for selected exercise
  const selectedColor = useMemo(() => {
    if (!selectedExerciseId) return '#f5a623'
    const ex = exercises.find((e) => e.id === selectedExerciseId)
    if (!ex) return '#f5a623'
    const mainLift = MAIN_LIFTS.find((ml) => ml.name === ex.name)
    return mainLift?.color ?? '#f5a623'
  }, [selectedExerciseId, exercises])

  // Main lift shortcuts
  const mainLiftExercises = useMemo(() => {
    return MAIN_LIFTS.map((ml) => {
      const ex = exercises.find((e) => e.name === ml.name)
      return { ...ml, exerciseId: ex?.id ?? null }
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
                }
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono border-none cursor-pointer transition-colors ${
                selectedExerciseId === ml.exerciseId
                  ? 'text-bg font-bold'
                  : 'bg-[#21262d] text-muted hover:text-bright active:text-bright'
              }`}
              style={selectedExerciseId === ml.exerciseId ? { background: ml.color } : undefined}
            >
              {ml.name}
            </button>
          ))}
          <button
            onClick={() => {
              setShowOverlay(true)
              loadAllLiftsOverlay()
            }}
            className={`px-2.5 py-1 rounded-md text-[11px] font-mono border-none cursor-pointer transition-colors ${
              showOverlay ? 'bg-accent text-bg font-bold' : 'bg-[#21262d] text-muted hover:text-bright active:text-bright'
            }`}
          >
            All Lifts
          </button>
        </div>
      )}

      {/* All exercises dropdown */}
      <div className="mb-4">
        <select
          value={selectedExerciseId ?? ''}
          onChange={(e) => {
            setShowOverlay(false)
            loadExerciseHistory(e.target.value)
          }}
          className="w-full bg-bg border border-[#30363d] rounded-lg text-bright p-2 text-[12px] font-mono"
        >
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>{ex.name}</option>
          ))}
        </select>
      </div>

      {loading && <div className="text-center py-8 text-muted text-xs">Loading...</div>}

      {!loading && showOverlay && <AllLiftsOverlay data={allLiftsData} />}

      {!loading && !showOverlay && stats && (
        <>
          <StatCards stats={stats} />
          <E1rmChart data={e1rmData} color={selectedColor} />
          <VolumeChart data={volumeData} />
          <SetLogList entries={setLogHistory} onDelete={deleteSetLog} />
        </>
      )}

      {!loading && !showOverlay && !stats && (
        <div className="text-center py-8 text-faint text-xs">
          Select an exercise to view history.
        </div>
      )}
    </div>
  )
}
