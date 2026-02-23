import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { E1rmDataPoint } from '../../hooks/useHistory'
import { useSettingsStore, parseSettings } from '../../store/settingsStore'
import { bwMultiple } from '../../lib/calc'

interface E1rmChartProps {
  data: E1rmDataPoint[]
  color?: string
}

export function E1rmChart({ data, color = '#f5a623' }: E1rmChartProps) {
  const raw = useSettingsStore((s) => s.raw)
  const bodyWeight = parseSettings(raw).bodyWeight

  function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    const e1rm = payload[0]?.value
    const bwx = bodyWeight > 0 && e1rm ? bwMultiple(e1rm, bodyWeight) : null
    return (
      <div className="bg-card border border-border rounded-md px-3 py-2">
        <div className="text-[11px] text-muted">{label}</div>
        <div className="text-[13px] text-accent font-mono">{e1rm} lb</div>
        {bwx !== null && (
          <div className="text-[11px] text-dim">{bwx.toFixed(1)}x BW</div>
        )}
      </div>
    )
  }

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
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="e1rm" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} name="e1RM" />
          <Line
            type="monotone"
            dataKey="rollingAvg"
            stroke="#8b949e"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            dot={false}
            name="180d avg"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
