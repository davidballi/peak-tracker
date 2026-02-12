interface ProgressBarProps {
  percentage: number
}

export function ProgressBar({ percentage }: ProgressBarProps) {
  return (
    <div className="mt-2 h-[3px] bg-[#21262d] rounded-sm overflow-hidden">
      <div
        className={`h-full rounded-sm transition-all duration-300 ${
          percentage === 100 ? 'bg-success' : 'bg-accent'
        }`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
