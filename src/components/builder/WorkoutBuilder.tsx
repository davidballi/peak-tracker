import { useState } from 'react'
import { generateProgram, type Goal, type GeneratedProgram } from '../../lib/program-generator'
import { createProgramFromBuilder } from '../../lib/seed'
import { GoalStep } from './GoalStep'
import { ScheduleStep } from './ScheduleStep'
import { ReviewStep } from './ReviewStep'
import { ConfirmStep } from './ConfirmStep'

interface WorkoutBuilderProps {
  onComplete: (programId: string) => void
  onCancel: () => void
}

const TOTAL_STEPS = 4

export function WorkoutBuilder({ onComplete, onCancel }: WorkoutBuilderProps) {
  const [step, setStep] = useState(1)
  const [goal, setGoal] = useState<Goal | null>(null)
  const [dayCount, setDayCount] = useState<number | null>(null)
  const [program, setProgram] = useState<GeneratedProgram | null>(null)
  const [programName, setProgramName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  function handleGoalSelect(g: Goal) {
    setGoal(g)
    setStep(2)
  }

  function handleScheduleSelect(n: number) {
    setDayCount(n)
    const result = generateProgram(goal!, n)
    setProgram(result)
    setProgramName(result.name)
    setStep(3)
  }

  function handleReviewConfirm() {
    setStep(4)
  }

  async function handleFinalConfirm() {
    if (!program || saving) return
    setSaving(true)
    setSaveError(false)
    try {
      const programId = await createProgramFromBuilder({ ...program, name: programName })
      onComplete(programId)
    } catch (err) {
      console.error('Failed to create program:', err)
      setSaving(false)
      setSaveError(true)
    }
  }

  function handleBack() {
    if (step === 1) {
      onCancel()
    } else {
      setStep(step - 1)
    }
  }

  return (
    <div className="fixed inset-0 bg-bg z-[150] flex flex-col pt-[env(safe-area-inset-top)]">
      {/* Top bar */}
      <div className="flex items-center px-4 py-3">
        {/* Back button */}
        <button
          onClick={handleBack}
          className="bg-transparent border-none text-muted cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center hover:text-bright active:text-bright transition-colors"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Step indicator dots */}
        <div className="flex-1 flex justify-center gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i + 1 === step ? 'bg-accent' : i + 1 < step ? 'bg-accent/40' : 'bg-border-elevated'
              }`}
            />
          ))}
        </div>

        {/* Spacer to balance back button */}
        <div className="min-w-[44px]" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {step === 1 && (
          <GoalStep onSelect={handleGoalSelect} />
        )}
        {step === 2 && (
          <ScheduleStep onSelect={handleScheduleSelect} />
        )}
        {step === 3 && program && (
          <ReviewStep
            program={program}
            onUpdate={setProgram}
            onConfirm={handleReviewConfirm}
          />
        )}
        {step === 4 && program && (
          <ConfirmStep
            program={program}
            programName={programName}
            onNameChange={setProgramName}
            onConfirm={handleFinalConfirm}
            saving={saving}
            error={saveError}
          />
        )}
      </div>
    </div>
  )
}
