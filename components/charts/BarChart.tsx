import { CHROME, categoricalAt } from "./palette"

export type BarDatum = {
  label: string
  value: number
  /** Teinte imposee (etat, rampe sequentielle). Sinon slot categoriel. */
  color?: string
}

/**
 * Barres horizontales.
 *
 * Chaque barre porte son libelle et sa valeur en clair : l'information ne
 * depend jamais de la couleur seule, ce qui satisfait aussi la regle de
 * compensation pour les teintes a faible contraste sur fond blanc.
 */
export function BarChart({
  data,
  formatValue = (v) => String(v),
  emptyLabel = "Aucune donnée sur cette période",
}: {
  data: BarDatum[]
  formatValue?: (value: number) => string
  emptyLabel?: string
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  if (data.length === 0 || total === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-400">{emptyLabel}</p>
    )
  }

  const max = Math.max(...data.map((d) => d.value))

  return (
    <div className="space-y-3">
      {data.map((datum, index) => {
        const ratio = max === 0 ? 0 : datum.value / max
        const color = datum.color ?? categoricalAt(index)

        return (
          <div key={datum.label} className="space-y-1">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-slate-600">{datum.label}</span>
              <span className="font-medium tabular-nums text-slate-900">
                {formatValue(datum.value)}
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: CHROME.grid }}
              role="img"
              aria-label={`${datum.label} : ${formatValue(datum.value)}`}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(ratio * 100, datum.value > 0 ? 2 : 0)}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
