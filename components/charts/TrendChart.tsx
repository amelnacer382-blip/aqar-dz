import { CHROME, CATEGORICAL } from "./palette"

export type TrendPoint = {
  label: string
  value: number
}

/**
 * Evolution d'une grandeur dans le temps : aire + ligne, une seule serie.
 *
 * Une seule serie, donc pas de legende : le titre de la carte nomme la
 * mesure. Chaque point porte un <title> SVG, qui donne l'infobulle native
 * du navigateur au survol sans imposer de composant client.
 *
 * Une seule echelle verticale, jamais deux : deux mesures d'ordres de
 * grandeur differents demandent deux graphiques distincts.
 */
export function TrendChart({
  data,
  formatValue = (v) => String(v),
  height = 200,
  color = CATEGORICAL[0],
}: {
  data: TrendPoint[]
  formatValue?: (value: number) => string
  height?: number
  color?: string
}) {
  if (data.length < 2) {
    return (
      <p className="py-10 text-center text-sm text-slate-400">
        Pas encore assez d&apos;historique pour tracer une évolution
      </p>
    )
  }

  const width = 720
  const padding = { top: 16, right: 16, bottom: 28, left: 16 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  const max = Math.max(...data.map((d) => d.value))
  // Echelle ancree a zero : tronquer l'axe exagererait les variations.
  const scaleMax = max === 0 ? 1 : max * 1.1

  const x = (index: number) =>
    padding.left + (index / (data.length - 1)) * plotWidth

  const y = (value: number) =>
    padding.top + plotHeight - (value / scaleMax) * plotHeight

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`)
    .join(" ")

  const areaPath =
    `${linePath} L ${x(data.length - 1).toFixed(1)} ${(padding.top + plotHeight).toFixed(1)}` +
    ` L ${x(0).toFixed(1)} ${(padding.top + plotHeight).toFixed(1)} Z`

  const gridLines = [0, 0.5, 1]
  const peakIndex = data.findIndex((d) => d.value === max)

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ minWidth: 420 }}
        role="img"
        aria-label={`Évolution sur ${data.length} périodes, maximum ${formatValue(max)}`}
      >
        {/* Grille discrete */}
        {gridLines.map((ratio) => (
          <line
            key={ratio}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + plotHeight * ratio}
            y2={padding.top + plotHeight * ratio}
            stroke={CHROME.grid}
            strokeWidth={1}
          />
        ))}

        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        <path d={areaPath} fill="url(#trend-fill)" />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points : anneau de surface pour les detacher de l'aire */}
        {data.map((d, i) => (
          <g key={d.label}>
            <circle
              cx={x(i)}
              cy={y(d.value)}
              r={4}
              fill={color}
              stroke={CHROME.surface}
              strokeWidth={2}
            />
            {/* Cible de survol plus large que la marque */}
            <circle cx={x(i)} cy={y(d.value)} r={14} fill="transparent">
              <title>{`${d.label} : ${formatValue(d.value)}`}</title>
            </circle>
          </g>
        ))}

        {/* Etiquette directe du pic uniquement, pas une valeur par point */}
        {peakIndex >= 0 && max > 0 && (
          <text
            x={x(peakIndex)}
            y={Math.max(y(max) - 12, 12)}
            textAnchor={
              peakIndex === 0
                ? "start"
                : peakIndex === data.length - 1
                  ? "end"
                  : "middle"
            }
            fontSize={11}
            fontWeight={600}
            fill={CHROME.textPrimary}
          >
            {formatValue(max)}
          </text>
        )}

        {/* Axe des periodes */}
        {data.map((d, i) => {
          const isEdge = i === 0 || i === data.length - 1
          const step = Math.ceil(data.length / 6)
          if (!isEdge && i % step !== 0) return null

          return (
            <text
              key={`label-${d.label}`}
              x={x(i)}
              y={height - 8}
              textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
              fontSize={10}
              fill={CHROME.textSecondary}
            >
              {d.label}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
