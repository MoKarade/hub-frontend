'use client'

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

// Données démo. À remplacer par fetch sur /v1/finance/daily-spending
const DEMO = [
  { day: '01', amount: 45 },
  { day: '02', amount: 78 },
  { day: '03', amount: 32 },
  { day: '04', amount: 124 },
  { day: '05', amount: 56 },
  { day: '06', amount: 89 },
  { day: '07', amount: 42 },
  { day: '08', amount: 167 },
  { day: '09', amount: 73 },
  { day: '10', amount: 38 },
  { day: '11', amount: 95 },
  { day: '12', amount: 51 },
  { day: '13', amount: 134 },
  { day: '14', amount: 47 },
  { day: '15', amount: 82 },
  { day: '16', amount: 60 },
  { day: '17', amount: 198 },
  { day: '18', amount: 44 },
  { day: '19', amount: 76 },
  { day: '20', amount: 53 },
]

export function SpendingChart() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={DEMO} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <XAxis
          dataKey="day"
          tick={{ fill: '#5a6572', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: '#5a6572', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: '#171c25',
            border: '1px solid #2a323e',
            borderRadius: '6px',
            fontSize: '12px',
          }}
          cursor={{ fill: '#1f2630' }}
        />
        <Bar dataKey="amount" fill="#5cdb95" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
