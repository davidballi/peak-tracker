import { useState, useEffect } from 'react'

interface NoteEntry {
  id: string
  note: string
  blockNum?: number
  weekIndex?: number
}

interface NoteModalProps {
  type: 'workout' | 'exercise'
  title: string
  subtitle: string
  currentNote: string
  onSave: (note: string) => void
  onClose: () => void
  loadPreviousNotes: () => Promise<NoteEntry[]>
}

export function NoteModal({
  type,
  title,
  subtitle,
  currentNote,
  onSave,
  onClose,
  loadPreviousNotes,
}: NoteModalProps) {
  const [text, setText] = useState(currentNote)
  const [previousNotes, setPreviousNotes] = useState<NoteEntry[]>([])

  useEffect(() => {
    loadPreviousNotes().then(setPreviousNotes)
  }, [loadPreviousNotes])

  function handleSave() {
    onSave(text)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 z-[200] flex items-end justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-[500px] bg-card border-t-2 border-accent rounded-t-2xl p-4 pb-6">
        <div className="flex justify-between items-center mb-3">
          <div>
            <div className="text-[13px] font-bold text-accent">{title}</div>
            <div className="text-[11px] text-dim mt-0.5">{subtitle}</div>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-dim text-xl cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            type === 'workout'
              ? "How'd the session go? Energy, sleep, anything to remember..."
              : 'Notes for this exercise — form cues, repeat weight, etc.'
          }
          autoFocus
          className="w-full min-h-[100px] bg-bg border border-[#30363d] rounded-lg text-bright p-3 text-[16px] font-mono resize-y leading-relaxed focus:border-accent outline-none"
        />

        {previousNotes.length > 0 && (
          <div className="mt-2.5">
            <div className="text-[10px] text-dim font-semibold tracking-wider mb-1.5">
              {type === 'workout' ? 'PREVIOUS SESSIONS' : 'PREVIOUS NOTES'}
            </div>
            {previousNotes.map((n) => {
              const label = n.blockNum != null && n.weekIndex != null
                ? (type === 'workout'
                    ? `Block ${n.blockNum} · Week ${n.weekIndex + 1}`
                    : `B${n.blockNum} W${n.weekIndex + 1}`)
                : ''
              return (
                <div
                  key={n.id}
                  className="p-[6px_8px] bg-bg rounded-md mb-1 border-l-2 border-[#30363d]"
                >
                  <span className="text-[9px] text-faint font-bold">{label}</span>
                  <div className="text-[11px] text-muted mt-0.5">{n.note}</div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 border-none rounded-lg cursor-pointer bg-[#238636] text-white text-[13px] font-semibold font-mono"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-[#30363d] rounded-lg cursor-pointer bg-transparent text-muted text-[13px] font-mono"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
