import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGoals, type GoalWithProgress } from '../../hooks/useGoals'
import { GoalCard } from './GoalCard'
import { GoalEditor } from './GoalEditor'

interface GoalsViewProps {
  programId: string
}

export function GoalsView({ programId }: GoalsViewProps) {
  const { goals, loading, createGoal, updateGoal, deleteGoal, checkAchievements } = useGoals(programId)
  const [showEditor, setShowEditor] = useState(false)
  const [editingGoal, setEditingGoal] = useState<GoalWithProgress | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Check achievements on load
  useEffect(() => {
    checkAchievements().then((achieved) => {
      if (achieved.length > 0) {
        setToast(`Goal achieved: ${achieved.map((a) => a.exerciseName).join(', ')}!`)
        setTimeout(() => setToast(null), 4000)
      }
    })
  }, [checkAchievements])

  const activeGoals = goals.filter((g) => !g.achievedAt)
  const achievedGoals = goals.filter((g) => g.achievedAt)

  return (
    <div className="px-4 py-4">
      <div className="flex justify-between items-center mb-4">
        <div className="text-xs font-semibold text-accent">STRENGTH GOALS</div>
        <button
          onClick={() => { setEditingGoal(null); setShowEditor(true) }}
          className="text-[11px] bg-success text-white border-none rounded-md px-3 py-1.5 cursor-pointer"
        >
          + New Goal
        </button>
      </div>

      {/* Toast */}
      <AnimatePresence>
      {toast && (
        <motion.div
          className="mb-3 p-2.5 bg-accent/[0.125] border border-accent rounded-lg text-[12px] text-accent text-center font-semibold"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {toast}
        </motion.div>
      )}
      </AnimatePresence>

      {loading && <div className="text-center py-8 text-muted text-xs">Loading goals...</div>}

      {!loading && goals.length === 0 && (
        <div className="text-center py-12">
          <div className="text-accent mb-2"><svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></div>
          <div className="text-muted text-sm mb-1">No goals yet</div>
          <div className="text-faint text-xs">Set a strength target to track your progress.</div>
        </div>
      )}

      {/* Active goals */}
      {activeGoals.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] text-dim font-semibold tracking-wider mb-2">ACTIVE</div>
          <div className="grid grid-cols-1 gap-2">
            {activeGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={(g) => { setEditingGoal(g); setShowEditor(true) }}
                onDelete={deleteGoal}
              />
            ))}
          </div>
        </div>
      )}

      {/* Achieved goals */}
      {achievedGoals.length > 0 && (
        <div>
          <div className="text-[10px] text-dim font-semibold tracking-wider mb-2">ACHIEVED</div>
          <div className="grid grid-cols-1 gap-2">
            {achievedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={(g) => { setEditingGoal(g); setShowEditor(true) }}
                onDelete={deleteGoal}
              />
            ))}
          </div>
        </div>
      )}

      {/* Editor modal */}
      <AnimatePresence>
      {showEditor && (
        <GoalEditor
          programId={programId}
          editingGoal={editingGoal}
          onSave={createGoal}
          onUpdate={updateGoal}
          onClose={() => setShowEditor(false)}
        />
      )}
      </AnimatePresence>
    </div>
  )
}
