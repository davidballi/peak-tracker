interface ProgressBarProps {
  percentage: number
}

export function ProgressBar({ percentage }: ProgressBarProps) {
  return (
    <div className="mt-2 h-[5px] bg-border rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ${
          percentage === 100 ? 'bg-success' : 'bg-accent'
        }`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
