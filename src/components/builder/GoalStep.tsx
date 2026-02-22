import type { Goal } from '../../lib/program-generator'

interface GoalStepProps {
  onSelect: (goal: Goal) => void
}

const GOALS: Array<{ goal: Goal; title: string; description: string }> = [
  {
    goal: 'strength',
    title: 'Strength',
    description: 'Heavy compounds, low reps, wave-loaded periodization',
  },
  {
    goal: 'hypertrophy',
    title: 'Hypertrophy',
    description: 'Moderate weight, higher volume, muscle growth',
  },
  {
    goal: 'general',
    title: 'General Fitness',
    description: 'Balanced strength and conditioning',
  },
]

function GoalIcon({ goal }: { goal: Goal }) {
  const props = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (goal) {
    case 'strength':
      // Dumbbell icon
      return (
        <svg {...props}>
          <rect x="2" y="11" width="20" height="2" rx="1" />
          <rect x="4" y="7" width="3.5" height="10" rx="1.5" />
          <rect x="16.5" y="7" width="3.5" height="10" rx="1.5" />
        </svg>
      )
    case 'hypertrophy':
      // Bicep/muscle icon
      return (
        <svg {...props}>
          <path d="M7 12.5c0-3 2-5.5 5-5.5s5 2.5 5 5.5" />
          <path d="M7 12.5c-1.5 0-3 1-3 3s1.5 3 3 3h10c1.5 0 3-1 3-3s-1.5-3-3-3" />
          <path d="M9 8V5a2 2 0 012-2h2a2 2 0 012 2v3" />
        </svg>
      )
    case 'general':
      // Activity/pulse icon
      return (
        <svg {...props}>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      )
  }
}

export function GoalStep({ onSelect }: GoalStepProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[18px] font-bold text-bright mb-1">
        What's your goal?
      </div>
      {GOALS.map(({ goal, title, description }) => (
        <button
          key={goal}
          onClick={() => onSelect(goal)}
          className="bg-card border border-border-elevated rounded-lg p-4 min-h-[80px] flex items-center gap-4 text-left cursor-pointer hover:border-accent active:border-accent transition-colors"
        >
          <div className="text-accent flex-shrink-0">
            <GoalIcon goal={goal} />
          </div>
          <div>
            <div className="text-[17px] font-bold text-bright">{title}</div>
            <div className="text-[15px] text-muted mt-0.5">{description}</div>
          </div>
        </button>
      ))}
    </div>
  )
}
