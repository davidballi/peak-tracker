import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import type { AllLiftsData } from '../../hooks/useHistory'

interface AllLiftsOverlayProps {
  data: AllLiftsData[]
}

export function AllLiftsOverlay({ data }: AllLiftsOverlayProps) {
  if (data.length === 0 || data.every((d) => d.data.length === 0)) {
    return (
      <div className="text-center py-6 text-faint text-xs">
        No lift data to overlay yet.
      </div>
    )
  }

  // Merge all lifts into a single dataset keyed by label
  const merged = new Map<string, Record<string, number>>()
  for (const lift of data) {
    for (const point of lift.data) {
      const existing = merged.get(point.label) ?? {}
      existing[lift.liftId] = point.e1rm
      merged.set(point.label, existing)
    }
  }

  const chartData = Array.from(merged.entries())
    .map(([label, values]) => ({ label, ...values }))
    .sort((a, b) => {
      // Sort by block then week from the label
      return a.label.localeCompare(b.label)
    })

  return (
    <div className="mb-4">
      <div className="text-[10px] text-dim font-semibold tracking-wider mb-2">ALL LIFTS OVERLAY</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#636e72' }} />
          <YAxis tick={{ fontSize: 9, fill: '#636e72' }} />
          <Tooltip
            contentStyle={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 6, fontSize: 11 }}
            labelStyle={{ color: '#8b949e' }}
          />
          <Legend
            wrapperStyle={{ fontSize: 10 }}
            formatter={(value: string) => {
              const lift = data.find((d) => d.liftId === value)
              return lift?.liftName ?? value
            }}
          />
          {data.map((lift) => (
            <Line
              key={lift.liftId}
              type="monotone"
              dataKey={lift.liftId}
              stroke={lift.color}
              strokeWidth={2}
              dot={{ r: 2.5, fill: lift.color }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
