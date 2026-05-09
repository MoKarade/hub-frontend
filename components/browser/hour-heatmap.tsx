/**
 * Heatmap 7 jours x 24h pour l'historique de navigation.
 *
 * Backend `/v1/browser/stats` retourne `by_hour` (cumul tous jours) et
 * `by_day_of_week` (cumul toutes heures), mais PAS la matrice combinee.
 * On reconstruit donc une matrice approximative en projetant les ratios
 * (par_heure / total) x (par_jour / total) x total. C'est un proxy honnete
 * tant que le backend ne fournit pas la vraie matrice 7x24.
 *
 * Si on veut un jour la vraie matrice, ajouter `by_dow_hour` au backend
 * et passer ces donnees a la place.
 */

import { useMemo } from 'react'

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const HOUR_TICKS = [0, 6, 12, 18, 23]

type HourBucket = { hour: number; count: number }
type DayBucket = { day: number; count: number }

interface Props {
  byHour: HourBucket[]
  byDayOfWeek: DayBucket[]
}

export function HourHeatmap({ byHour, byDayOfWeek }: Props) {
  const matrix = useMemo(() => {
    const hours = new Array(24).fill(0) as number[]
    byHour.forEach((b) => {
      if (b.hour >= 0 && b.hour < 24) hours[b.hour] = b.count
    })
    const days = new Array(7).fill(0) as number[]
    byDayOfWeek.forEach((b) => {
      if (b.day >= 0 && b.day < 7) days[b.day] = b.count
    })
    const totalH = hours.reduce((a, b) => a + b, 0)
    const totalD = days.reduce((a, b) => a + b, 0)
    const total = Math.max(totalH, totalD, 1)

    // Matrice estimee : (h_ratio * d_ratio * total). Approximation, mais
    // visuellement utile pour reperer les patterns soir/weekend.
    const cells: number[][] = []
    for (let d = 0; d < 7; d += 1) {
      const row: number[] = []
      for (let h = 0; h < 24; h += 1) {
        const hr = totalH > 0 ? hours[h] / totalH : 0
        const dr = totalD > 0 ? days[d] / totalD : 0
        row.push(Math.round(hr * dr * total))
      }
      cells.push(row)
    }
    const max = Math.max(...cells.flat(), 1)
    return { cells, max }
  }, [byHour, byDayOfWeek])

  if (byHour.length === 0 && byDayOfWeek.length === 0) {
    return (
      <p className="text-xs text-ink-500 text-center py-4">Pas encore de donnees</p>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5">
        <div className="w-8 shrink-0" />
        <div
          className="grid flex-1 text-[9px] font-mono text-ink-500"
          style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}
        >
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="text-center">
              {HOUR_TICKS.includes(h) ? `${h}h` : ''}
            </div>
          ))}
        </div>
      </div>

      {matrix.cells.map((row, d) => (
        <div key={d} className="flex items-center gap-1 mb-1">
          <div className="w-8 shrink-0 text-[10px] font-mono text-ink-400 text-right">
            {DAYS_FR[d]}
          </div>
          <div
            className="grid flex-1 gap-px"
            style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}
          >
            {row.map((count, h) => {
              const intensity = matrix.max > 0 ? count / matrix.max : 0
              return (
                <div
                  key={h}
                  className="aspect-square rounded-sm transition-colors"
                  style={{
                    background:
                      count === 0
                        ? 'rgba(255,255,255,0.04)'
                        : `rgba(92,219,149,${0.18 + intensity * 0.7})`,
                  }}
                  title={`${DAYS_FR[d]} ${String(h).padStart(2, '0')}h · ${count} visites`}
                />
              )
            })}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-1.5 mt-2 text-[9px] font-mono text-ink-500">
        <span>moins</span>
        <div className="flex gap-px">
          {[0.18, 0.35, 0.52, 0.7, 0.88].map((a) => (
            <div
              key={a}
              className="w-3 h-3 rounded-sm"
              style={{ background: `rgba(92,219,149,${a})` }}
            />
          ))}
        </div>
        <span>plus</span>
      </div>
    </div>
  )
}
