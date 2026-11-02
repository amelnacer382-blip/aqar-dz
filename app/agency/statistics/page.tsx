import type { Metadata } from "next"
import Link from "next/link"
import { requireAgency } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Wallet, Building2, Users, TrendingUp } from "lucide-react"
import { BarChart } from "@/components/charts/BarChart"
import { TrendChart } from "@/components/charts/TrendChart"
import { SEQUENTIAL_BLUE, STATUS, CATEGORICAL } from "@/components/charts/palette"
import { formatDZD, formatDZDCompact, toNumber, monthLabel } from "@/lib/format"
import {
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  CLIENT_STATUS_LABELS,
  INTEREST_LEVEL_LABELS,
  label,
} from "@/lib/labels"

/** Un reversement au proprietaire est une sortie, pas une recette. */
const OUTGOING_TYPES = ["paiement_proprietaire", "abonnement_saas"]

/**
 * Periodes proposees. La borne est un nombre de mois glissants : une agence
 * raisonne en « depuis le debut de l'annee » ou « les 3 derniers mois »,
 * pas en dates absolues.
 */
const PERIODS = [
  { value: "3", label: "3 mois" },
  { value: "6", label: "6 mois" },
  { value: "12", label: "12 mois" },
  { value: "24", label: "24 mois" },
] as const

export const metadata: Metadata = { title: "Statistiques" }

export default async function AgencyStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const query = await searchParams

  // La periode vient de l'URL, donc de l'utilisateur : on la borne a une
  // valeur connue plutot que de faire confiance au parametre.
  const months = PERIODS.some((p) => p.value === query.months)
    ? Number(query.months)
    : 12

  const now = new Date()
  const twelveMonthsAgo = new Date(
    now.getFullYear(),
    now.getMonth() - (months - 1),
    1
  )

  const [
    payments,
    propertiesByStatus,
    propertiesByType,
    clientsByStatus,
    visitsByInterest,
    visitStats,
    activeRentals,
    salesAgg,
  ] = await Promise.all([
    prisma.payment.findMany({
      where: {
        agencyId,
        status: { not: "impaye" },
        date: { gte: twelveMonthsAgo },
      },
      select: { amount: true, date: true, type: true },
    }),
    prisma.property.groupBy({
      by: ["status"],
      where: { agencyId },
      _count: true,
    }),
    prisma.property.groupBy({
      by: ["type"],
      where: { agencyId },
      _count: true,
    }),
    prisma.client.groupBy({
      by: ["status"],
      where: { agencyId },
      _count: true,
    }),
    prisma.visit.groupBy({
      by: ["interestLevel"],
      where: { agencyId, interestLevel: { not: null } },
      _count: true,
    }),
    prisma.visit.groupBy({
      by: ["status"],
      where: { agencyId },
      _count: true,
    }),
    prisma.rental.findMany({
      where: { agencyId, status: "active" },
      select: { monthlyRent: true },
    }),
    prisma.sale.aggregate({
      where: { agencyId, status: "vendu" },
      _sum: { finalPrice: true, commission: true },
      _count: true,
    }),
  ])

  // --- Recettes nettes mois par mois sur la periode choisie ---
  const monthlyBuckets = Array.from({ length: months }, (_, offset) => {
    const d = new Date(
      now.getFullYear(),
      now.getMonth() - (months - 1) + offset,
      1
    )
    return { year: d.getFullYear(), month: d.getMonth(), total: 0 }
  })

  for (const payment of payments) {
    const bucket = monthlyBuckets.find(
      (b) =>
        b.year === payment.date.getFullYear() && b.month === payment.date.getMonth()
    )
    if (!bucket) continue

    const amount = toNumber(payment.amount)
    bucket.total += OUTGOING_TYPES.includes(payment.type) ? -amount : amount
  }

  const trend = monthlyBuckets.map((b) => ({
    label: `${monthLabel(b.month + 1).slice(0, 4)} ${String(b.year).slice(2)}`,
    value: Math.max(b.total, 0),
  }))

  const revenuePeriod = monthlyBuckets.reduce((sum, b) => sum + b.total, 0)
  const monthlyRentRoll = activeRentals.reduce(
    (sum, r) => sum + toNumber(r.monthlyRent),
    0
  )

  const visitsDone = visitStats.find((v) => v.status === "effectuee")?._count ?? 0
  const visitsTotal = visitStats.reduce((sum, v) => sum + v._count, 0)
  const convertedClients =
    clientsByStatus.find((c) => c.status === "conclu")?._count ?? 0
  const clientsTotal = clientsByStatus.reduce((sum, c) => sum + c._count, 0)
  const conversionRate =
    clientsTotal === 0 ? 0 : Math.round((convertedClients / clientsTotal) * 100)

  // --- Mise en forme des series ---
  const statusOrder = ["disponible", "reserve", "loue", "vendu", "archive"]
  const statusData = statusOrder
    .map((status) => ({
      label: label(PROPERTY_STATUS_LABELS, status),
      value: propertiesByStatus.find((p) => p.status === status)?._count ?? 0,
    }))
    .filter((d) => d.value > 0)

  const typeData = propertiesByType
    .map((t) => ({
      label: label(PROPERTY_TYPE_LABELS, t.type),
      value: t._count,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  // Le niveau d'interet est une echelle ordonnee : rampe d'une seule teinte,
  // du plus fonce (tres interesse) au plus clair, plutot que des teintes
  // categorielles qui suggereraient des categories sans ordre.
  const interestOrder = ["tres_interesse", "interesse", "mitige", "pas_interesse"]
  const interestData = interestOrder
    .map((level, index) => ({
      label: label(INTEREST_LEVEL_LABELS, level),
      value: visitsByInterest.find((v) => v.interestLevel === level)?._count ?? 0,
      color: SEQUENTIAL_BLUE[6 - index],
    }))
    .filter((d) => d.value > 0)

  const pipelineOrder = [
    "nouveau",
    "interesse",
    "visite_prevue",
    "client_chaud",
    "conclu",
    "perdu",
  ]
  const pipelineData = pipelineOrder
    .map((status) => ({
      label: label(CLIENT_STATUS_LABELS, status),
      value: clientsByStatus.find((c) => c.status === status)?._count ?? 0,
      color:
        status === "conclu"
          ? STATUS.good
          : status === "perdu"
            ? STATUS.critical
            : CATEGORICAL[0],
    }))
    .filter((d) => d.value > 0)

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">
                Statistiques
              </h1>
              <p className="mt-1 text-slate-600">
                Activité de votre agence sur les {months} derniers mois
              </p>
            </div>

            {/* La periode se choisit par des liens : elle reste dans l'URL,
                donc elle se partage et survit a un rafraichissement. */}
            <div
              className="flex items-center gap-1 rounded-full border border-dar-sand bg-white p-1"
              role="group"
              aria-label="Période"
            >
              {PERIODS.map((period) => {
                const active = String(months) === period.value
                return (
                  <Link
                    key={period.value}
                    href={`/agency/statistics?months=${period.value}`}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-dar-blue-soft text-dar-blue"
                        : "text-dar-ink/60 hover:text-dar-ink"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    {period.label}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Indicateurs de tete */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatTile
              label={`Recettes nettes (${months} mois)`}
              value={formatDZDCompact(revenuePeriod)}
              icon={<Wallet className="h-4 w-4 text-blue-500" />}
            />
            <StatTile
              label="Loyers gérés / mois"
              value={formatDZDCompact(monthlyRentRoll)}
              hint={`${activeRentals.length} bail${activeRentals.length > 1 ? "s" : ""} actif${activeRentals.length > 1 ? "s" : ""}`}
              icon={<Building2 className="h-4 w-4 text-emerald-500" />}
            />
            <StatTile
              label="Taux de conversion"
              value={`${conversionRate} %`}
              hint={`${convertedClients} client${convertedClients > 1 ? "s" : ""} conclu${convertedClients > 1 ? "s" : ""} sur ${clientsTotal}`}
              icon={<TrendingUp className="h-4 w-4 text-purple-500" />}
            />
            <StatTile
              label="Visites effectuées"
              value={String(visitsDone)}
              hint={`sur ${visitsTotal} planifiée${visitsTotal > 1 ? "s" : ""}`}
              icon={<Users className="h-4 w-4 text-orange-500" />}
            />
          </div>

          {/* Evolution */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Recettes encaissées par mois</CardTitle>
              <p className="text-sm text-slate-500">
                Encaissements moins reversements propriétaires, en dinars
              </p>
            </CardHeader>
            <CardContent>
              <TrendChart data={trend} formatValue={(v) => formatDZDCompact(v)} />

              {/* Vue tableau : l'information reste lisible sans le graphique */}
              <details className="mt-6">
                <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-900">
                  Afficher les valeurs sous forme de tableau
                </summary>
                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mois</TableHead>
                        <TableHead className="text-right">Recettes nettes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyBuckets.map((b) => (
                        <TableRow key={`${b.year}-${b.month}`}>
                          <TableCell>
                            {monthLabel(b.month + 1)} {b.year}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatDZD(b.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </details>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Biens par statut</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart data={statusData} emptyLabel="Aucun bien enregistré" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Biens par type</CardTitle>
                <p className="text-sm text-slate-500">Les 6 types les plus représentés</p>
              </CardHeader>
              <CardContent>
                <BarChart data={typeData} emptyLabel="Aucun bien enregistré" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pipeline commercial</CardTitle>
                <p className="text-sm text-slate-500">Répartition des clients par étape</p>
              </CardHeader>
              <CardContent>
                <BarChart data={pipelineData} emptyLabel="Aucun client enregistré" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Retours de visite</CardTitle>
                <p className="text-sm text-slate-500">
                  Niveau d&apos;intérêt déclaré après visite
                </p>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={interestData}
                  emptyLabel="Aucun retour de visite saisi pour l'instant"
                />
              </CardContent>
            </Card>
          </div>

          {salesAgg._count > 0 && (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Ventes conclues</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-slate-500">Nombre de ventes</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {salesAgg._count}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Volume total</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {formatDZDCompact(toNumber(salesAgg._sum.finalPrice))}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Commissions</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {formatDZDCompact(toNumber(salesAgg._sum.commission))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </>
  )
}

function StatTile({
  label: text,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint?: string
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{text}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </CardContent>
    </Card>
  )
}
