import type { Metadata } from "next"
import { requireSuperAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AdminNavbar } from "@/components/layout/AdminNavbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Building2, Users, Home, Wallet } from "lucide-react"
import { BarChart } from "@/components/charts/BarChart"
import { TrendChart } from "@/components/charts/TrendChart"
import { STATUS, CATEGORICAL } from "@/components/charts/palette"
import { formatDZDCompact, toNumber, monthLabel } from "@/lib/format"
import { AGENCY_STATUS_LABELS, PROPERTY_TYPE_LABELS, label } from "@/lib/labels"

export const metadata: Metadata = { title: "Statistiques plateforme" }

export default async function AdminStatisticsPage() {
  const { userName } = await requireSuperAdmin()

  const now = new Date()
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)

  const [
    agencies,
    agenciesByStatus,
    totalUsers,
    totalProperties,
    propertiesByType,
    volumeAgg,
    topAgencies,
  ] = await Promise.all([
    prisma.agency.findMany({
      where: { createdAt: { gte: twelveMonthsAgo } },
      select: { createdAt: true },
    }),
    prisma.agency.groupBy({ by: ["status"], _count: true }),
    prisma.user.count(),
    prisma.property.count(),
    prisma.property.groupBy({ by: ["type"], _count: true }),
    prisma.sale.aggregate({ _sum: { finalPrice: true } }),
    prisma.agency.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        /*
          `properties` et `clients` portent leur propre condition : ce sont
          des modeles a corbeille, et l'extension de `lib/prisma.ts` ne
          filtre que le premier niveau — un `_count` imbrique lui echappe
          (BUG-24, story 3.5). `users` n'en porte pas, `User` n'a pas de
          `deletedAt`.
        */
        _count: {
          select: {
            properties: { where: { deletedAt: null } },
            users: true,
            clients: { where: { deletedAt: null } },
          },
        },
      },
    }),
  ])

  // Inscriptions d'agences mois par mois
  const buckets = Array.from({ length: 12 }, (_, offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + offset, 1)
    return { year: d.getFullYear(), month: d.getMonth(), total: 0 }
  })

  for (const agency of agencies) {
    const bucket = buckets.find(
      (b) =>
        b.year === agency.createdAt.getFullYear() &&
        b.month === agency.createdAt.getMonth()
    )
    if (bucket) bucket.total += 1
  }

  const trend = buckets.map((b) => ({
    label: `${monthLabel(b.month + 1).slice(0, 4)} ${String(b.year).slice(2)}`,
    value: b.total,
  }))

  const statusColors: Record<string, string> = {
    active: STATUS.good,
    pending: STATUS.warning,
    suspended: STATUS.critical,
  }

  const statusData = ["active", "pending", "suspended"]
    .map((status) => ({
      label: label(AGENCY_STATUS_LABELS, status),
      value: agenciesByStatus.find((a) => a.status === status)?._count ?? 0,
      color: statusColors[status],
    }))
    .filter((d) => d.value > 0)

  const typeData = propertiesByType
    .map((t) => ({ label: label(PROPERTY_TYPE_LABELS, t.type), value: t._count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  const totalAgencies = agenciesByStatus.reduce((sum, a) => sum + a._count, 0)

  return (
    <>
      <AdminNavbar userName={userName} />
      <main className="pt-16 min-h-screen bg-slate-950">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold tracking-tight text-white">Statistiques plateforme</h1>
            <p className="text-slate-400 mt-1">
              Vue consolidée de toutes les agences Aqar DZ
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <DarkTile
              label="Agences"
              value={String(totalAgencies)}
              icon={<Building2 className="h-4 w-4 text-blue-400" />}
            />
            <DarkTile
              label="Utilisateurs"
              value={String(totalUsers)}
              icon={<Users className="h-4 w-4 text-purple-400" />}
            />
            <DarkTile
              label="Biens gérés"
              value={String(totalProperties)}
              icon={<Home className="h-4 w-4 text-emerald-400" />}
            />
            <DarkTile
              label="Volume de ventes"
              value={formatDZDCompact(toNumber(volumeAgg._sum.finalPrice))}
              icon={<Wallet className="h-4 w-4 text-orange-400" />}
            />
          </div>

          {/* Les graphiques sont poses sur une surface claire : la palette
              a ete validee sur fond blanc, pas sur le fond sombre du panneau. */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Nouvelles agences par mois</CardTitle>
              <p className="text-sm text-slate-500">12 derniers mois</p>
            </CardHeader>
            <CardContent>
              <TrendChart
                data={trend}
                formatValue={(v) => `${v} agence${v > 1 ? "s" : ""}`}
                color={CATEGORICAL[0]}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Agences par statut</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart data={statusData} emptyLabel="Aucune agence" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Biens par type</CardTitle>
                <p className="text-sm text-slate-500">Toutes agences confondues</p>
              </CardHeader>
              <CardContent>
                <BarChart data={typeData} emptyLabel="Aucun bien" />
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Dernières agences inscrites</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800">
                      <TableHead className="text-slate-400">Agence</TableHead>
                      <TableHead className="text-slate-400">Statut</TableHead>
                      <TableHead className="text-slate-400 text-right">Biens</TableHead>
                      <TableHead className="text-slate-400 text-right">Clients</TableHead>
                      <TableHead className="text-slate-400 text-right">
                        Utilisateurs
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topAgencies.map((agency) => (
                      <TableRow key={agency.id} className="border-slate-800">
                        <TableCell className="text-white">{agency.name}</TableCell>
                        <TableCell className="text-slate-400">
                          {label(AGENCY_STATUS_LABELS, agency.status)}
                        </TableCell>
                        <TableCell className="text-slate-400 text-right">
                          {agency._count.properties}
                        </TableCell>
                        <TableCell className="text-slate-400 text-right">
                          {agency._count.clients}
                        </TableCell>
                        <TableCell className="text-slate-400 text-right">
                          {agency._count.users}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}

function DarkTile({
  label: text,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-400">{text}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-white">{value}</div>
      </CardContent>
    </Card>
  )
}
