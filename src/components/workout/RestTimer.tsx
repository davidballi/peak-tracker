import { useState, useRef, useCallback, useEffect } from 'react'
import { hapticMedium } from '../../lib/haptics'

interface RestTimerProps {
  durationSeconds: number
}

type TimerState = 'idle' | 'running' | 'done'

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function RestTimer({ durationSeconds }: RestTimerProps) {
  const [state, setState] = useState<TimerState>('idle')
  const [remaining, setRemaining] = useState(durationSeconds)

  const startTimeRef = useRef(0)
  const durationRef = useRef(durationSeconds)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => stop, [stop])

  // Update duration ref when prop changes
  useEffect(() => {
    durationRef.current = durationSeconds
  }, [durationSeconds])

  const start = useCallback(() => {
    setState('running')
    setRemaining(durationRef.current)
    startTimeRef.current = Date.now()

    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      const left = Math.max(0, durationRef.current - elapsed)
      setRemaining(left)

      if (left <= 0) {
        stop()
        setState('done')
        hapticMedium()
        setTimeout(() => {
          setState('idle')
        }, 3000)
      }
    }, 250)
  }, [stop])

  const cancel = useCallback(() => {
    stop()
    setState('idle')
    setRemaining(durationRef.current)
  }, [stop])

  const progress = durationSeconds > 0
    ? (durationSeconds - remaining) / durationSeconds
    : 0

  // SVG progress ring constants
  const radius = 20
  const circumference = 2 * Math.PI * radius
  const strokeOffset = circumference * (1 - progress)

  if (state === 'idle') {
    return (
      <button
        onClick={start}
        className="fixed bottom-[calc(70px+env(safe-area-inset-bottom))] right-4 z-[150] w-[48px] h-[48px] rounded-full bg-card border border-border-elevated flex items-center justify-center cursor-pointer hover:border-accent active:border-accent transition-colors"
        aria-label="Start rest timer"
      >
        <svg className="w-6 h-6 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>
    )
  }

  if (state === 'running') {
    return (
      <button
        onClick={cancel}
        className="fixed bottom-[calc(70px+env(safe-area-inset-bottom))] right-4 z-[150] flex items-center gap-2 bg-card border border-border-elevated rounded-full pl-1.5 pr-3 py-1.5 cursor-pointer hover:border-accent active:border-accent transition-colors"
        aria-label="Cancel rest timer"
      >
        <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0 -rotate-90">
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="#21262d"
            strokeWidth="3"
          />
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="#f5a623"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
            className="transition-[stroke-dashoffset] duration-300"
          />
        </svg>
        <span className="text-accent font-mono text-[17px] font-semibold">
          {formatTime(remaining)}
        </span>
      </button>
    )
  }

  // state === 'done'
  return (
    <div
      className="fixed bottom-[calc(70px+env(safe-area-inset-bottom))] right-4 z-[150] flex items-center gap-2 bg-card border border-success rounded-full pl-1.5 pr-3 py-1.5 animate-pulse"
    >
      <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0 -rotate-90">
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke="#21262d"
          strokeWidth="3"
        />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke="#2ea043"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={0}
        />
      </svg>
      <span className="text-success font-mono text-[17px] font-semibold">
        Done
      </span>
    </div>
  )
}
