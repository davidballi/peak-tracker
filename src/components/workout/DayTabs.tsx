import type { DayWithExercises } from '../../types/program'

interface DayTabsProps {
  days: DayWithExercises[]
  currentDay: number
  onSelectDay: (index: number) => void
}

export function DayTabs({ days, currentDay, onSelectDay }: DayTabsProps) {
  return (
    <div className="flex gap-1">
      {days.map((d, i) => (
        <button
          key={d.id}
          onClick={() => onSelectDay(i)}
          className={`flex-1 py-2.5 border-none rounded-md text-[17px] font-semibold tracking-wide transition-all ${
            i === currentDay
              ? 'bg-border text-accent'
              : 'bg-transparent text-faint hover:text-muted active:text-muted'
          }`}
        >
          {d.name}
        </button>
      ))}
    </div>
  )
}
