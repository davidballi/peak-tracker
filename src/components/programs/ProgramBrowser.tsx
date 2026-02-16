import { useState, useEffect } from 'react'
import { getDb } from '../../lib/db'
import { forkTemplate } from '../../lib/seed'
import { useAppStore } from '../../store/appStore'

interface ProgramBrowserProps {
  onBack: () => void
}

interface TemplateRow {
  id: string
  name: string
  author: string
  description: string
  days_per_week: number
}

export function ProgramBrowser({ onBack }: ProgramBrowserProps) {
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [forking, setForking] = useState(false)
  const setActiveProgramId = useAppStore((s) => s.setActiveProgramId)

  useEffect(() => {
    async function load() {
      const db = await getDb()
      const rows = await db.select<TemplateRow[]>(
        `SELECT id, name, author, description, days_per_week FROM program_templates`,
      )
      setTemplates(rows)
    }
    load()
  }, [])

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
    <div className="px-4 py-4">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="text-[11px] text-muted bg-transparent border border-border rounded-md px-2 py-1 cursor-pointer"
        >
          &larr; Back
        </button>
        <div className="text-xs font-semibold text-accent">PROGRAM TEMPLATES</div>
      </div>

      <div className="text-[11px] text-dim mb-3">
        Fork a template to create a new program. Your current program will be deactivated.
      </div>

      <div className="space-y-2">
        {templates.map((t) => (
          <div key={t.id} className="p-4 bg-card border border-border-elevated rounded-lg shadow-card">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-[13px] font-semibold text-bright">{t.name}</div>
                <div className="text-[10px] text-muted">{t.author} · {t.days_per_week} days/week</div>
              </div>
              <button
                onClick={() => handleFork(t.id)}
                disabled={forking}
                className="text-[11px] bg-success text-white border-none rounded-md px-3 py-1.5 cursor-pointer disabled:opacity-50"
              >
                Fork
              </button>
            </div>
            <div className="text-[11px] text-dim leading-relaxed">{t.description}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
