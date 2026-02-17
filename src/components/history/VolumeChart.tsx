import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { VolumeDataPoint } from '../../hooks/useHistory'

interface VolumeChartProps {
  data: VolumeDataPoint[]
}

export function VolumeChart({ data }: VolumeChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-6 text-faint text-xs">
        No volume data yet.
      </div>
    )
  }

  return (
    <div className="mb-4">
      <div className="text-[16px] text-dim font-semibold tracking-wider mb-2">VOLUME PER SESSION</div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#636e72' }} />
          <YAxis tick={{ fontSize: 9, fill: '#636e72' }} />
          <Tooltip
            contentStyle={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 6, fontSize: 11 }}
            labelStyle={{ color: '#8b949e' }}
            formatter={(value: number) => [`${value.toLocaleString()} lb`, 'Volume']}
          />
          <Bar dataKey="volume" fill="#2ea043" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
