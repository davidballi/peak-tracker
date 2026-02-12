export type GoalType = 'e1rm' | 'weight' | 'reps'

export interface StrengthGoal {
  id: string
  exerciseId: string
  goalType: GoalType
  targetValue: number
  deadline: string | null
  achievedAt: string | null
  createdAt: string
}
