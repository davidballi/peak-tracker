import type { GeneratedProgram } from '../../lib/program-generator'

interface ConfirmStepProps {
  program: GeneratedProgram
  programName: string
  onNameChange: (name: string) => void
  onConfirm: () => void
  saving: boolean
}

export function ConfirmStep({ program, programName, onNameChange, onConfirm, saving }: ConfirmStepProps) {
  const totalExercises = program.days.reduce((sum, d) => sum + d.exercises.length, 0)
  const waveCount = program.days.reduce(
    (sum, d) => sum + d.exercises.filter((e) => e.isWave).length,
    0,
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="text-[18px] font-bold text-bright">
        Name your program
      </div>

      {/* Program name input */}
      <input
        type="text"
        value={programName}
        onChange={(e) => onNameChange(e.target.value)}
        maxLength={100}
        className="w-full bg-bg border border-border-elevated rounded-lg text-bright p-3 text-[18px] focus:border-accent outline-none"
        placeholder="Program name"
      />

      {/* Summary */}
      <div className="text-[16px] text-muted">
        {program.days.length} days &middot; {totalExercises} exercises{waveCount > 0 ? ` \u00b7 ${waveCount} wave-loaded` : ''}
      </div>

      {/* Day previews */}
      <div className="flex flex-col gap-2">
        {program.days.map((day, i) => (
          <div
            key={i}
            className="bg-card border border-border-elevated rounded-lg px-4 py-3 flex items-center justify-between"
          >
            <div>
              <div className="text-[15px] font-semibold text-bright">{day.name}</div>
              <div className="text-[13px] text-dim">{day.subtitle}</div>
            </div>
            <div className="text-[14px] text-muted">
              {day.exercises.length} exercise{day.exercises.length !== 1 ? 's' : ''}
            </div>
          </div>
        ))}
      </div>

      {/* Start Training button */}
      <button
        onClick={onConfirm}
        disabled={saving || !programName.trim()}
        className={`mt-2 w-full bg-accent text-bg font-bold text-[19px] py-3 rounded-lg border-none cursor-pointer min-h-[52px] transition-opacity ${
          saving || !programName.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 active:opacity-80'
        }`}
      >
        {saving ? 'Saving...' : 'Start Training'}
      </button>
    </div>
  )
}
