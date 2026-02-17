import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { E1rmDataPoint } from '../../hooks/useHistory'

interface E1rmChartProps {
  data: E1rmDataPoint[]
  color?: string
}

export function E1rmChart({ data, color = '#f5a623' }: E1rmChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-6 text-faint text-xs">
        No data yet. Log some sets to see your e1RM trend.
      </div>
    )
  }

  return (
    <div className="mb-4">
      <div className="text-[16px] text-dim font-semibold tracking-wider mb-2">ESTIMATED 1RM TREND</div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#636e72' }} />
          <YAxis tick={{ fontSize: 9, fill: '#636e72' }} domain={['dataMin - 10', 'dataMax + 10']} />
          <Tooltip
            contentStyle={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 6, fontSize: 11 }}
            labelStyle={{ color: '#8b949e' }}
            itemStyle={{ color }}
          />
          <Line type="monotone" dataKey="e1rm" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
