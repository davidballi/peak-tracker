import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { v4 as uuid } from 'uuid'
import { useAppStore } from './store/appStore'
import { getDb, withWriteLock } from './lib/db'
import { seedIfNeeded, forkTemplate } from './lib/seed'
import { estimatedOneRepMax, roundToNearest5 } from './lib/calc'
import { PEAK_STRENGTH_TEMPLATE } from './lib/templates'
import { useProgram } from './hooks/useProgram'
import { useTrainingMaxes } from './hooks/useTrainingMaxes'
import { BottomNav } from './components/layout/BottomNav'
import { WorkoutView } from './components/workout/WorkoutView'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { HistoryView } from './components/history/HistoryView'
import { ProgramBuilder } from './components/programs/ProgramBuilder'
import { ProgramBrowser } from './components/programs/ProgramBrowser'
import { GoalsView } from './components/goals/GoalsView'
import { DashboardView } from './components/dashboard/DashboardView'

interface TemplateRow {
  id: string
  name: string
  author: string
  description: string
  days_per_week: number
}

export default function App() {
  const { dbReady, setDbReady, activeProgramId, setActiveProgramId } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const initRan = useRef(false)
  useEffect(() => {
    if (initRan.current) return
    initRan.current = true

    async function init() {
      try {
        await getDb()
        await seedIfNeeded()
        setDbReady(true)

        const db = await getDb()
        const programs = await db.select<Array<{ id: string }>>(
          `SELECT id FROM programs WHERE is_active = 1 LIMIT 1`,
        )
        if (programs.length > 0) {
          setActiveProgramId(programs[0].id)
        } else {
          const tpls = await db.select<TemplateRow[]>(
            `SELECT id, name, author, description, days_per_week FROM program_templates`,
          )
          setTemplates(tpls)
        }
      } catch (err) {
        console.error('Failed to initialize database:', err)
        setError(`Failed to initialize the app: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [setDbReady, setActiveProgramId])

  if (error) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0d1117', color: '#e94560', padding: '60px 20px 20px', fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'pre-wrap', overflow: 'auto' }}>
        <div style={{ color: '#f5a623', fontWeight: 'bold', fontSize: '16px', marginBottom: '16px' }}>INIT FAILED</div>
        <div>{error}</div>
      </div>
    )
  }

  if (loading || !dbReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg text-text">
        <div className="text-center">
          <div className="text-accent font-bold text-lg tracking-wider mb-2">FORGE</div>
          <div className="text-muted text-base">Loading...</div>
        </div>
      </div>
    )
  }

  if (!activeProgramId) {
    return <TemplateSelector templates={templates} />
  }

  return <MainApp programId={activeProgramId} />
}

function TemplateSelector({ templates }: { templates: TemplateRow[] }) {
  const setActiveProgramId = useAppStore((s) => s.setActiveProgramId)
  const [forking, setForking] = useState(false)

  async function handleFork(templateId: string) {
    setForking(true)
    try {
      const programId = await forkTemplate(templateId)
      setActiveProgramId(programId)
    } catch (err) {
      console.error('Failed to fork template:', err)
    } finally {
      setForking(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg text-text pt-[env(safe-area-inset-top)]">
      <div className="max-w-md w-full px-6">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold">
            <span className="text-accent">FORGE</span>
          </h1>
          <p className="text-muted text-base mt-2">Choose a program to get started</p>
        </div>
        <div className="space-y-3">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => handleFork(t.id)}
              disabled={forking}
              className="w-full text-left p-4 bg-card border border-border-elevated rounded-lg shadow-card hover:border-accent active:border-accent transition-colors disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-bright font-semibold text-base">{t.name}</span>
                <span className="text-faint text-[17px]">{t.days_per_week} days/wk</span>
              </div>
              <div className="text-muted text-[17px] mb-1">{t.author}</div>
              <div className="text-dim text-[17px] leading-relaxed">{t.description}</div>
            </button>
          ))}
          {templates.length === 0 && (
            <button
              onClick={() => handleFork(PEAK_STRENGTH_TEMPLATE.id)}
              disabled={forking}
              className="w-full text-left p-4 bg-card border border-border-elevated rounded-lg shadow-card hover:border-accent active:border-accent transition-colors disabled:opacity-50"
            >
              <div className="text-bright font-semibold text-base mb-1">Wave Periodization</div>
              <div className="text-muted text-[17px] mb-1">Forge</div>
              <div className="text-dim text-[17px] leading-relaxed">
                Wave-loaded periodization: 3 working weeks + 1 deload.
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function MainApp({ programId }: { programId: string }) {
  const { currentView } = useAppStore()
  const { program, loading, reload, setCurrentDay, setCurrentWeek } = useProgram(programId)
  const [showSettings, setShowSettings] = useState(false)
  const [showBrowser, setShowBrowser] = useState(false)

  const allExercises = useMemo(
    () => (program?.days ?? []).flatMap((d) => d.exercises),
    [program?.days],
  )
  const { getEffectiveMax, reload: reloadMaxes } = useTrainingMaxes(allExercises)

  const waveExercises = useMemo(
    () => allExercises.filter((e) => e.isWave),
    [allExercises],
  )

  const handleWeekChange = useCallback(
    async (week: number) => {
      await setCurrentWeek(week)
      await reload()
    },
    [setCurrentWeek, reload],
  )

  const handleAdvance = useCallback(async () => {
    await reload()
    await reloadMaxes()
  }, [reload, reloadMaxes])

  const handleAdvanceWeek = useCallback(async () => {
    if (!program) return
    const nextWeek = program.currentWeek + 1
    await setCurrentWeek(nextWeek)
    await setCurrentDay(0)
    await reload()
  }, [program, setCurrentWeek, setCurrentDay, reload])

  const handleAdvanceBlock = useCallback(async () => {
    if (!program) return
    await withWriteLock(async () => {
      const db = await getDb()

      for (const ex of waveExercises) {
        const currentMax = getEffectiveMax(ex.id)
        let bestE1rm = currentMax

        const rows = await db.select<Array<{ weight: number; reps: number }>>(
          `SELECT sl.weight, sl.reps FROM set_logs sl
           JOIN workout_logs wl ON sl.workout_log_id = wl.id
           WHERE wl.program_id = ? AND sl.exercise_id = ? AND wl.block_num = ? AND wl.week_index = 2
             AND sl.weight IS NOT NULL AND sl.reps IS NOT NULL AND sl.weight > 0 AND sl.reps > 0
             AND sl.is_completed = 1`,
          [programId, ex.id, program.blockNum],
        )

        for (const r of rows) {
          const e1rm = estimatedOneRepMax(r.weight, r.reps)
          if (e1rm > bestE1rm) bestE1rm = e1rm
        }

        let newTm: number
        if (bestE1rm > currentMax) {
          const capped = Math.min(bestE1rm, currentMax * 1.2)
          newTm = roundToNearest5(capped)
        } else {
          newTm = roundToNearest5(currentMax + 5)
        }

        await db.execute(
          `INSERT INTO training_maxes (id, exercise_id, value, block_num, source) VALUES (?, ?, ?, ?, 'auto')`,
          [uuid(), ex.id, newTm, program.blockNum + 1],
        )
      }

      await db.execute(
        `UPDATE programs SET block_num = block_num + 1, current_week = 0, current_day = 0 WHERE id = ?`,
        [programId],
      )
    })

    await reload()
    await reloadMaxes()
  }, [program, programId, waveExercises, getEffectiveMax, reload, reloadMaxes])

  if (loading || !program) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg text-muted text-base">
        Loading program...
      </div>
    )
  }

  function renderContent() {
    if (!program) return null

    switch (currentView) {
      case 'dashboard':
        return (
          <DashboardView
            programId={programId}
            programName={program.name}
            blockNum={program.blockNum}
            currentWeek={program.currentWeek}
          />
        )

      case 'workout':
        return (
          <WorkoutView
            programId={programId}
            blockNum={program.blockNum}
            currentWeek={program.currentWeek}
            currentDay={program.currentDay}
            days={program.days}
            onSelectDay={(i) => { setCurrentDay(i); setShowSettings(false) }}
            onOpenSettings={() => setShowSettings(!showSettings)}
            onAdvanceWeek={handleAdvanceWeek}
            onAdvanceBlock={handleAdvanceBlock}
            settingsOpen={showSettings}
          />
        )

      case 'history':
        return <HistoryView programId={programId} />

      case 'programs':
        if (showBrowser) {
          return <ProgramBrowser onBack={() => setShowBrowser(false)} />
        }
        return (
          <ProgramBuilder
            programId={programId}
            onBrowseTemplates={() => setShowBrowser(true)}
          />
        )

      case 'goals':
        return <GoalsView programId={programId} />

      default:
        return null
    }
  }

  return (
    <div className="h-screen flex flex-col bg-bg text-text text-[19px] pt-[env(safe-area-inset-top)]">
      <div className="flex-1 overflow-y-auto pb-[calc(64px+env(safe-area-inset-bottom))]">
        <div className="max-w-[500px] mx-auto pb-8">
          {renderContent()}
        </div>
      </div>
      <BottomNav />
      <AnimatePresence>
        {showSettings && program && (
          <SettingsPanel
            programId={programId}
            blockNum={program.blockNum}
            currentWeek={program.currentWeek}
            waveExercises={waveExercises}
            getEffectiveMax={getEffectiveMax}
            onWeekChange={handleWeekChange}
            onAdvance={handleAdvance}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
