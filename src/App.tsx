import { useEffect, useState } from 'react'
import { useAppStore } from './store/appStore'
import { getDb } from './lib/db'
import { seedIfNeeded, forkTemplate } from './lib/seed'
import { PEAK_STRENGTH_TEMPLATE } from './lib/templates'

interface ProgramRow {
  id: string
  name: string
  block_num: number
  current_week: number
  current_day: number
}

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
        const db = await getDb()
        await seedIfNeeded()
        setDbReady(true)

        // Check for active program
        const programs = await db.select<ProgramRow[]>(
          `SELECT id, name, block_num, current_week, current_day FROM programs WHERE is_active = 1 LIMIT 1`,
        )
        if (programs.length > 0) {
          setActiveProgramId(programs[0].id)
        } else {
          // Load templates for selection
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

  // No active program — show template selector
  if (!activeProgramId) {
    return <TemplateSelector templates={templates} />
  }

  // Active program — show main app
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
  const [program, setProgram] = useState<ProgramRow | null>(null)

  useEffect(() => {
    async function load() {
      const db = await getDb()
      const rows = await db.select<ProgramRow[]>(
        `SELECT id, name, block_num, current_week, current_day FROM programs WHERE id = ?`,
        [programId],
      )
      if (rows.length > 0) setProgram(rows[0])
    }
    load()
  }, [programId])

  if (!program) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg text-muted font-mono text-sm">
        Loading program...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-text font-mono text-sm">
      {/* Title bar drag region */}
      <div
        data-tauri-drag-region
        className="h-8 flex items-center justify-center select-none"
      >
        <span className="text-faint text-xs">
          <span className="text-accent font-bold">PEAK</span>
          <span className="text-dim"> TRACKER</span>
        </span>
      </div>

      {/* Placeholder content — will be replaced with full workout view in Phase 2 */}
      <div className="max-w-3xl mx-auto px-4 pb-20">
        <div className="border-b border-border pb-4 mb-6">
          <h1 className="text-bright text-lg font-bold">{program.name}</h1>
          <p className="text-muted text-xs mt-1">
            Block {program.block_num} · Week {program.current_week + 1}
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <div className="text-accent text-4xl mb-4">&#x1F3CB;</div>
          <div className="text-bright font-semibold mb-2">Program Ready</div>
          <div className="text-muted text-xs leading-relaxed max-w-sm mx-auto">
            Database initialized with {program.name} template.
            Workout logging UI will be built in Phase 2.
          </div>
        </div>

        <div className="mt-6 text-center text-faint text-xs">
          Block {program.block_num} · Week {program.current_week + 1}
        </div>
      </div>
    </div>
  )
}
