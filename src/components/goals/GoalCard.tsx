import type { GoalWithProgress } from '../../hooks/useGoals'

interface GoalCardProps {
  goal: GoalWithProgress
  onEdit: (goal: GoalWithProgress) => void
  onDelete: (goalId: string) => void
}

const GOAL_TYPE_LABELS = { e1rm: 'Est 1RM', weight: 'Weight', reps: 'Reps' }
const GOAL_TYPE_UNITS = { e1rm: 'lb', weight: 'lb', reps: 'reps' }

export function GoalCard({ goal, onEdit, onDelete }: GoalCardProps) {
  const isAchieved = !!goal.achievedAt
  const isPastDeadline = goal.deadline && !isAchieved && new Date(goal.deadline) < new Date()

  return (
    <div
      className={`border rounded-lg p-3 ${
        isAchieved
          ? 'border-accent bg-[#f5a62310]'
          : isPastDeadline
            ? 'border-danger bg-[#e9456010]'
            : 'border-border bg-card'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="text-[13px] font-semibold text-bright">{goal.exerciseName}</div>
          <div className="text-[10px] text-faint">
            {GOAL_TYPE_LABELS[goal.goalType]} target
          </div>
        </div>
        {isAchieved && <span className="text-[16px]">&#x2B50;</span>}
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-muted">
            {goal.currentValue} / {goal.targetValue} {GOAL_TYPE_UNITS[goal.goalType]}
          </span>
          <span className={`font-bold ${isAchieved ? 'text-accent' : 'text-muted'}`}>
            {goal.progress}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-bg rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isAchieved ? 'bg-accent' : 'bg-success'}`}
            style={{ width: `${Math.min(100, goal.progress)}%` }}
          />
        </div>
      </div>

      {/* Deadline */}
      {goal.deadline && (
        <div className={`text-[10px] mb-2 ${isPastDeadline ? 'text-danger' : 'text-faint'}`}>
          {isAchieved ? 'Achieved' : isPastDeadline ? 'Past deadline' : 'Deadline'}:{' '}
          {new Date(goal.deadline).toLocaleDateString()}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onEdit(goal)}
          className="text-[10px] text-muted bg-transparent border border-border rounded px-2 py-1 cursor-pointer hover:text-bright"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(goal.id)}
          className="text-[10px] text-faint bg-transparent border border-border rounded px-2 py-1 cursor-pointer hover:text-danger"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
