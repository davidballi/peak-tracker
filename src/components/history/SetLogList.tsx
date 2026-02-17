import { useState } from 'react'
import { estimatedOneRepMax } from '../../lib/calc'
import type { SetLogEntry } from '../../hooks/useHistory'

interface SetLogListProps {
  entries: SetLogEntry[]
  onDelete: (id: string) => void
}

export function SetLogList({ entries, onDelete }: SetLogListProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (entries.length === 0) {
    return (
      <div className="text-center py-4 text-faint text-xs">No logged sets yet.</div>
    )
  }

  // Group by block/week
  const groups = new Map<string, { label: string; entries: SetLogEntry[] }>()
  for (const e of entries) {
    const key = `${e.blockNum}_${e.weekIndex}`
    const existing = groups.get(key)
    if (existing) {
      existing.entries.push(e)
    } else {
      groups.set(key, {
        label: `Block ${e.blockNum} · Week ${e.weekIndex + 1}`,
        entries: [e],
      })
    }
  }

  return (
    <div className="mb-4">
      <div className="text-[16px] text-dim font-semibold tracking-wider mb-2">SET LOG HISTORY</div>
      {Array.from(groups.values()).map((group) => (
        <div key={group.label} className="mb-3">
          <div className="text-[16px] text-muted font-bold mb-1">{group.label}</div>
          <div className="space-y-0.5">
            {group.entries.map((entry) => {
              const e1rm = estimatedOneRepMax(entry.weight, entry.reps)
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-1 px-2 bg-card rounded text-[17px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-faint w-6">S{entry.setIndex + 1}</span>
                    <span className="text-accent font-mono">{entry.weight} lb</span>
                    <span className="text-dim">x</span>
                    <span className="text-bright font-mono">{entry.reps}</span>
                    <span className="text-faint">= {e1rm} e1RM</span>
                  </div>
                  {confirmId === entry.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => { onDelete(entry.id); setConfirmId(null) }}
                        className="text-[16px] text-danger bg-transparent border border-danger rounded px-1.5 py-0.5 cursor-pointer"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="text-[16px] text-muted bg-transparent border border-border rounded px-1.5 py-0.5 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(entry.id)}
                      className="text-faint hover:text-danger active:text-danger bg-transparent border-none cursor-pointer text-[17px] min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      x
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
