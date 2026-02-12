import { useEffect, useState, useMemo, useCallback } from 'react'
import { useAppStore } from './store/appStore'
import { getDb } from './lib/db'
import { seedIfNeeded, forkTemplate } from './lib/seed'
import { PEAK_STRENGTH_TEMPLATE } from './lib/templates'
import { useProgram } from './hooks/useProgram'
import { useTrainingMaxes } from './hooks/useTrainingMaxes'
import { WorkoutView } from './components/workout/WorkoutView'
import { SettingsPanel } from './components/settings/SettingsPanel'

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

  useEffect(() => {
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
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [setDbReady, setActiveProgramId])

  if (loading || !dbReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg text-text font-mono">
        <div className="text-center">
          <div className="text-accent font-bold text-lg tracking-wider mb-2">PEAK TRACKER</div>
          <div className="text-muted text-sm">Loading...</div>
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
    <div className="flex items-center justify-center min-h-screen bg-bg text-text font-mono">
      <div className="max-w-md w-full px-6">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold">
            <span className="text-accent">PEAK</span>
            <span className="text-dim"> TRACKER</span>
          </h1>
          <p className="text-muted text-sm mt-2">Choose a program to get started</p>
        </div>
        <div className="space-y-3">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => handleFork(t.id)}
              disabled={forking}
              className="w-full text-left p-4 bg-card border border-border rounded-lg hover:border-accent transition-colors disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-bright font-semibold text-sm">{t.name}</span>
                <span className="text-faint text-xs">{t.days_per_week} days/wk</span>
              </div>
              <div className="text-muted text-xs mb-1">{t.author}</div>
              <div className="text-dim text-xs leading-relaxed">{t.description}</div>
            </button>
          ))}
          {templates.length === 0 && (
            <button
              onClick={() => handleFork(PEAK_STRENGTH_TEMPLATE.id)}
              disabled={forking}
              className="w-full text-left p-4 bg-card border border-border rounded-lg hover:border-accent transition-colors disabled:opacity-50"
            >
              <div className="text-bright font-semibold text-sm mb-1">Peak Strength</div>
              <div className="text-muted text-xs mb-1">Garage Strength</div>
              <div className="text-dim text-xs leading-relaxed">
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
  const { program, loading, reload, setCurrentDay, setCurrentWeek } = useProgram(programId)
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

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

  if (loading || !program) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg text-muted font-mono text-sm">
        Loading program...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-text font-mono text-[13px] pb-24 max-w-[500px] mx-auto">
      {/* Title bar drag region */}
      <div data-tauri-drag-region className="h-8 select-none" />

      <WorkoutView
        programId={programId}
        blockNum={program.blockNum}
        currentWeek={program.currentWeek}
        currentDay={program.currentDay}
        days={program.days}
        onSelectDay={(i) => { setCurrentDay(i); setShowSettings(false); setShowHistory(false) }}
        onOpenSettings={() => { setShowSettings(!showSettings); setShowHistory(false) }}
        onOpenHistory={() => { setShowHistory(!showHistory); setShowSettings(false) }}
        settingsOpen={showSettings}
        historyOpen={showHistory}
      />

      {/* Settings panel */}
      {showSettings && (
        <SettingsPanel
          programId={programId}
          blockNum={program.blockNum}
          currentWeek={program.currentWeek}
          waveExercises={waveExercises}
          getEffectiveMax={getEffectiveMax}
          onWeekChange={handleWeekChange}
          onAdvance={handleAdvance}
        />
      )}

      {/* History placeholder */}
      {showHistory && (
        <div className="px-4 py-4 border-b border-border bg-card">
          <div className="text-xs font-semibold text-accent mb-3">LIFT HISTORY</div>
          <div className="text-center py-8 text-faint text-xs">
            Charts will be built in Phase 4.
          </div>
        </div>
      )}
    </div>
  )
}
