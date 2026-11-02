import type { Metadata } from "next"
import Link from "next/link"
import { requireAgency, isAgencyAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { FormMessage } from "@/components/FormMessage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Plus,
  CalendarDays,
  Pencil,
  Trash2,
  Bell,
  AlarmClock,
  AlertTriangle,
} from "lucide-react"
import { formatDate } from "@/lib/format"
import {
  VISIT_STATUS_LABELS,
  VISIT_STATUS_COLORS,
  INTEREST_LEVEL_LABELS,
  INTEREST_LEVEL_COLORS,
  label,
} from "@/lib/labels"
import { Pagination } from "@/components/Pagination"
import { ListToolbar } from "@/components/ListToolbar"
import { readPageParams, readSearch, dealSearch } from "@/lib/list-params"

export const metadata: Metadata = { title: "Visites" }

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string
    success?: string
    page?: string
    q?: string
  }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const params = await searchParams

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const inSevenDays = new Date(startOfToday)
  inSevenDays.setDate(inSevenDays.getDate() + 7)

  const include = {
    client: { select: { id: true, firstName: true, lastName: true, phone: true } },
    property: { select: { id: true, title: true } },
  }

  const { page, perPage, skip } = readPageParams(params)
  const q = readSearch(params)

  // Les rappels ne sont jamais filtres par la recherche : ce sont des
  // alertes, pas une vue de la liste. Les masquer parce qu'on cherche un
  // nom ferait manquer une relance.
  const where = { agencyId, ...(dealSearch(q) ?? {}) }

  const [visits, total, upcoming, followUps, missingFeedback] = await Promise.all([
    prisma.visit.findMany({
      where,
      orderBy: { date: "desc" },
      skip,
      take: perPage,
      include,
    }),
    prisma.visit.count({ where }),
    // Visites prevues dans les 7 prochains jours
    prisma.visit.findMany({
      where: {
        agencyId,
        status: "prevue",
        date: { gte: startOfToday, lte: inSevenDays },
      },
      orderBy: { date: "asc" },
      include,
    }),
    // Relances arrivees a echeance
    prisma.visit.findMany({
      where: {
        agencyId,
        followUpDate: { lte: now },
        status: "effectuee",
      },
      orderBy: { followUpDate: "asc" },
      include,
    }),
    // Visites passees dont le retour n'a jamais ete saisi
    prisma.visit.findMany({
      where: {
        agencyId,
        status: "effectuee",
        interestLevel: null,
        date: { lt: startOfToday },
      },
      orderBy: { date: "desc" },
      include,
    }),
  ])

  const hasReminders =
    upcoming.length > 0 || followUps.length > 0 || missingFeedback.length > 0

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Visites</h1>
              <p className="text-slate-600 mt-1">
                Planification, retours de visite et relances à faire
              </p>
            </div>
            <Button asChild className="bg-dar-ink hover:bg-dar-blue">
              <Link href="/agency/visits/new">
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle visite
              </Link>
            </Button>
          </div>

          <FormMessage error={params.error} success={params.success} />

          {/* Rappels */}
          {hasReminders && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <ReminderCard
                title="Visites à venir"
                subtitle="7 prochains jours"
                icon={<CalendarDays className="h-4 w-4 text-blue-500" />}
                count={upcoming.length}
                items={upcoming.slice(0, 4).map((v) => ({
                  id: v.id,
                  primary: `${v.client.firstName} ${v.client.lastName}`,
                  secondary: `${formatDate(v.date)} à ${v.time} — ${v.property.title}`,
                }))}
              />
              <ReminderCard
                title="Relances à faire"
                subtitle="échéance atteinte"
                icon={<AlarmClock className="h-4 w-4 text-orange-500" />}
                count={followUps.length}
                tone={followUps.length > 0 ? "warning" : "default"}
                items={followUps.slice(0, 4).map((v) => ({
                  id: v.id,
                  primary: `${v.client.firstName} ${v.client.lastName}`,
                  secondary: `Relance prévue le ${formatDate(v.followUpDate)}${
                    v.client.phone ? ` — ${v.client.phone}` : ""
                  }`,
                }))}
              />
              <ReminderCard
                title="Retours manquants"
                subtitle="visites sans compte rendu"
                icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
                count={missingFeedback.length}
                tone={missingFeedback.length > 0 ? "danger" : "default"}
                items={missingFeedback.slice(0, 4).map((v) => ({
                  id: v.id,
                  primary: v.property.title,
                  secondary: `Visitée le ${formatDate(v.date)} par ${v.client.firstName} ${v.client.lastName}`,
                }))}
              />
            </div>
          )}

          <ListToolbar
            basePath="/agency/visits"
            q={q}
            placeholder="Rechercher un bien, une référence, un client…"
            exportPath="/api/export/visits"
          />

          <Card>
            <CardHeader>
              <CardTitle>
                {q ? `${total} visite${total > 1 ? "s" : ""} trouvée${total > 1 ? "s" : ""}` : `Toutes les visites (${total})`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {visits.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarDays className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    Aucune visite
                  </h3>
                  <p className="text-slate-500 mb-6">
                    Planifiez votre première visite pour suivre vos rendez-vous.
                  </p>
                  <Button asChild className="bg-dar-ink hover:bg-dar-blue">
                    <Link href="/agency/visits/new">Nouvelle visite</Link>
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Bien</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Intérêt</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visits.map((visit) => (
                        <TableRow key={visit.id}>
                          <TableCell className="text-slate-600 whitespace-nowrap">
                            {formatDate(visit.date)}
                            <span className="block text-xs text-slate-400">
                              {visit.time}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/agency/clients/${visit.client.id}`}
                              className="font-medium text-slate-900 hover:underline"
                            >
                              {visit.client.firstName} {visit.client.lastName}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/agency/properties/${visit.property.id}`}
                              className="text-slate-600 hover:underline"
                            >
                              {visit.property.title}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={VISIT_STATUS_COLORS[visit.status] ?? ""}
                            >
                              {label(VISIT_STATUS_LABELS, visit.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {visit.interestLevel ? (
                              <Badge
                                variant="secondary"
                                className={
                                  INTEREST_LEVEL_COLORS[visit.interestLevel] ?? ""
                                }
                              >
                                {label(INTEREST_LEVEL_LABELS, visit.interestLevel)}
                              </Badge>
                            ) : (
                              <span className="text-slate-400 text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-amber-500 whitespace-nowrap">
                            {visit.rating ? "★".repeat(visit.rating) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button asChild size="sm" variant="ghost" title="Modifier">
                                <Link href={`/agency/visits/${visit.id}/edit`}>
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>
                              {/* Une visite qui n'a pas eu lieu se passe au
                                  statut « annulee » ; la supprimer efface le
                                  rendez-vous de l'historique du client, d'ou
                                  la reserve a l'administrateur. */}
                              {isAgencyAdmin(userRole) && (
                                <form
                                  action={`/api/visits/${visit.id}/delete`}
                                  method="POST"
                                  className="inline"
                                >
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    type="submit"
                                    title="Supprimer définitivement"
                                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </form>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Pagination
                    page={page}
                    perPage={perPage}
                    total={total}
                    basePath="/agency/visits"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}

function ReminderCard({
  title,
  subtitle,
  icon,
  count,
  items,
  tone = "default",
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  count: number
  items: { id: string; primary: string; secondary: string }[]
  tone?: "default" | "warning" | "danger"
}) {
  const countColor =
    tone === "danger"
      ? "text-red-600"
      : tone === "warning"
        ? "text-orange-600"
        : "text-slate-900"

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <span className={`text-2xl font-bold ${countColor}`}>{count}</span>
        </div>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Rien à signaler
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="text-sm">
                <Link
                  href={`/agency/visits/${item.id}/edit`}
                  className="font-medium text-slate-900 hover:underline"
                >
                  {item.primary}
                </Link>
                <p className="text-xs text-slate-500">{item.secondary}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
