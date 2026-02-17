import type { LiftStats } from '../../hooks/useHistory'

interface StatCardsProps {
  stats: LiftStats
}

export function StatCards({ stats }: StatCardsProps) {
  const cards = [
    { label: 'Est 1RM', value: `${stats.currentE1rm}`, unit: 'lb' },
    { label: 'Best 1RM', value: `${stats.bestE1rm}`, unit: 'lb' },
    {
      label: 'Change',
      value: `${stats.change >= 0 ? '+' : ''}${stats.change}`,
      unit: 'lb',
      color: stats.change > 0 ? 'text-success' : stats.change < 0 ? 'text-danger' : 'text-muted',
    },
    { label: 'TM', value: `${stats.trainingMax}`, unit: 'lb' },
  ]

  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-card border border-border-elevated rounded-lg shadow-card p-2.5 text-center">
          <div className="text-[9px] text-faint font-semibold tracking-wider mb-1">{card.label}</div>
          <div className={`text-[18px] font-bold font-mono ${card.color ?? 'text-accent'}`}>
            {card.value}
          </div>
          <div className="text-[9px] text-faint">{card.unit}</div>
        </div>
      ))}
    </div>
  )
}
