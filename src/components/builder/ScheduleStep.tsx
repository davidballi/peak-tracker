import { useState } from 'react'

interface ScheduleStepProps {
  onSelect: (dayCount: number) => void
}

const DAY_OPTIONS = [2, 3, 4, 5, 6] as const

const DAY_DESCRIPTIONS: Record<number, string> = {
  2: 'Upper / Lower split',
  3: 'Push / Pull / Legs',
  4: '4-day split',
  5: '5-day PPL hybrid',
  6: '6-day PPL',
}

export function ScheduleStep({ onSelect }: ScheduleStepProps) {
  const [selected, setSelected] = useState<number | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="text-[18px] font-bold text-bright">
        How many days per week?
      </div>

      <div className="flex gap-2 justify-center">
        {DAY_OPTIONS.map((n) => (
          <button
            key={n}
            onClick={() => setSelected(n)}
            className={`min-w-[56px] min-h-[56px] rounded-xl text-lg font-bold cursor-pointer transition-colors border ${
              selected === n
                ? 'bg-accent text-bg border-accent'
                : 'bg-card text-bright border-border-elevated hover:border-accent active:border-accent'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {selected !== null && (
        <>
          <div className="text-center text-[16px] text-muted">
            {DAY_DESCRIPTIONS[selected]}
          </div>
          <button
            onClick={() => onSelect(selected)}
            className="w-full bg-accent text-bg font-bold text-[17px] py-3 rounded-lg border-none cursor-pointer min-h-[48px] hover:opacity-90 active:opacity-80 transition-opacity"
          >
            Continue
          </button>
        </>
      )}
    </div>
  )
}
