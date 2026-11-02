import type { Metadata } from "next"
import Link from "next/link"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAgency } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { FormMessage } from "@/components/FormMessage"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  KeyRound,
  Wallet,
  AlertTriangle,
  ArrowRightLeft,
  FileDown,
  Sparkles,
  Pencil,
} from "lucide-react"
import {
  formatDZD,
  formatDZDCompact,
  computeAmountToOwner,
  periodLabel,
  MONTH_NAMES,
  toNumber,
} from "@/lib/format"
import { withError, withSuccess } from "@/lib/form"

const BASE = "/agency/rental-management"

export const metadata: Metadata = { title: "Gestion locative" }

export default async function RentalManagementPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string
    year?: string
    error?: string
    success?: string
  }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const params = await searchParams

  const now = new Date()
  const month = clampMonth(params.month, now.getMonth() + 1)
  const year = clampYear(params.year, now.getFullYear())

  // Tous les baux actifs, avec l'eventuelle quittance deja saisie pour la periode
  const rentals = await prisma.rental.findMany({
    where: { agencyId, status: "active" },
    orderBy: { createdAt: "desc" },
    include: {
      property: { select: { id: true, title: true, wilaya: true, commune: true } },
      client: { select: { firstName: true, lastName: true } },
      owner: { select: { firstName: true, lastName: true } },
      rentalManagements: { where: { month, year } },
    },
  })

  const rows = rentals.map((rental) => {
    const record = rental.rentalManagements[0] ?? null
    return {
      rental,
      record,
      expected: toNumber(rental.monthlyRent),
      netToOwner: record
        ? computeAmountToOwner({
            rentAmount: record.rentAmount,
            charges: record.charges,
            expenses: record.expenses,
            commission: record.commission,
          })
        : 0,
    }
  })

  const totalExpected = rows.reduce((sum, r) => sum + r.expected, 0)
  const totalCollected = rows
    .filter((r) => r.record?.isPaid)
    .reduce((sum, r) => sum + toNumber(r.record?.rentAmount), 0)
  const unpaidCount = rows.filter((r) => !r.record?.isPaid).length
  const totalToOwners = rows
    .filter((r) => r.record?.isPaid)
    .reduce((sum, r) => sum + r.netToOwner, 0)
  const missingCount = rows.filter((r) => !r.record).length

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  /** Cree en une fois les quittances manquantes de tous les baux actifs. */
  async function generateMonth(formData: FormData) {
    "use server"
    const { agencyId } = await requireAgency()

    const m = clampMonth(formData.get("month") as string, 1)
    const y = clampYear(formData.get("year") as string, 2000)
    const period = `${BASE}?month=${m}&year=${y}`

    const activeRentals = await prisma.rental.findMany({
      where: { agencyId, status: "active" },
      include: {
        property: { select: { commission: true } },
        rentalManagements: { where: { month: m, year: y }, select: { id: true } },
      },
    })

    const toCreate = activeRentals.filter((r) => r.rentalManagements.length === 0)

    if (toCreate.length === 0) {
      redirect(withError(period, "Toutes les quittances de cette periode existent deja"))
    }

    await prisma.rentalManagement.createMany({
      data: toCreate.map((rental) => {
        const rent = toNumber(rental.monthlyRent)
        const rate = toNumber(rental.property.commission)
        return {
          rentalId: rental.id,
          month: m,
          year: y,
          rentAmount: rent,
          // La commission mensuelle decoule du taux porte par le bien.
          commission: rate > 0 ? Math.round((rent * rate) / 100) : null,
          amountToOwner: rate > 0 ? rent - Math.round((rent * rate) / 100) : rent,
          isPaid: false,
        }
      }),
    })

    revalidatePath(BASE)
    redirect(
      withSuccess(
        period,
        `${toCreate.length} quittance(s) generee(s) pour ${periodLabel(m, y)}`
      )
    )
  }

  /** Bascule payee / impayee depuis la liste. */
  async function togglePaid(formData: FormData) {
    "use server"
    const { agencyId } = await requireAgency()

    const id = formData.get("id") as string
    const m = clampMonth(formData.get("month") as string, 1)
    const y = clampYear(formData.get("year") as string, 2000)
    const period = `${BASE}?month=${m}&year=${y}`

    const record = await prisma.rentalManagement.findFirst({
      where: { id, rental: { agencyId } },
    })

    if (!record) {
      redirect(withError(period, "Quittance introuvable"))
    }

    const nowPaid = !record.isPaid

    await prisma.rentalManagement.update({
      where: { id },
      data: {
        isPaid: nowPaid,
        paymentDate: nowPaid ? new Date() : null,
      },
    })

    revalidatePath(BASE)
    redirect(
      withSuccess(period, nowPaid ? "Loyer marque comme encaisse" : "Loyer remis en attente")
    )
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Gestion locative</h1>
              <p className="text-slate-600 mt-1">
                Suivi des loyers, commissions et reversements proprietaires &mdash;{" "}
                {periodLabel(month, year)}
              </p>
            </div>

            <form action={generateMonth}>
              <input type="hidden" name="month" value={month} />
              <input type="hidden" name="year" value={year} />
              <Button
                type="submit"
                className="bg-dar-ink hover:bg-dar-blue"
                disabled={missingCount === 0}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generer les quittances ({missingCount})
              </Button>
            </form>
          </div>

          <FormMessage error={params.error} success={params.success} />

          {/* Selecteur de periode */}
          <Card className="mb-8">
            <CardContent className="py-4">
              <form method="GET" className="flex flex-wrap items-end gap-4">
                <div className="space-y-1">
                  <label htmlFor="month" className="text-sm font-medium text-slate-700">
                    Mois
                  </label>
                  <select
                    id="month"
                    name="month"
                    defaultValue={month}
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    {MONTH_NAMES.map((label, index) => (
                      <option key={label} value={index + 1}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="year" className="text-sm font-medium text-slate-700">
                    Annee
                  </label>
                  <select
                    id="year"
                    name="year"
                    defaultValue={year}
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    {yearRange(now.getFullYear()).map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" variant="outline">
                  Afficher
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Indicateurs de la periode */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              label="Loyers attendus"
              value={formatDZDCompact(totalExpected)}
              icon={<KeyRound className="h-4 w-4 text-blue-500" />}
            />
            <StatCard
              label="Encaisse"
              value={formatDZDCompact(totalCollected)}
              icon={<Wallet className="h-4 w-4 text-green-500" />}
            />
            <StatCard
              label="Impayes"
              value={String(unpaidCount)}
              icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
              tone={unpaidCount > 0 ? "danger" : "default"}
            />
            <StatCard
              label="A reverser aux proprietaires"
              value={formatDZDCompact(totalToOwners)}
              icon={<ArrowRightLeft className="h-4 w-4 text-purple-500" />}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Baux actifs ({rows.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <div className="text-center py-16">
                  <KeyRound className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    Aucun bail actif
                  </h3>
                  <p className="text-slate-500 mb-6">
                    Creez une location active pour commencer le suivi des loyers.
                  </p>
                  <Button asChild variant="outline">
                    <Link href="/agency/rentals/new">Nouvelle location</Link>
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bien / Locataire</TableHead>
                        <TableHead className="text-right">Loyer</TableHead>
                        <TableHead className="text-right">Charges</TableHead>
                        <TableHead className="text-right">Depenses</TableHead>
                        <TableHead className="text-right">Commission</TableHead>
                        <TableHead className="text-right">Net proprietaire</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map(({ rental, record, netToOwner }) => (
                        <TableRow key={rental.id}>
                          <TableCell>
                            <Link
                              href={`/agency/rentals/${rental.id}`}
                              className="font-medium text-slate-900 hover:underline"
                            >
                              {rental.property.title}
                            </Link>
                            <p className="text-xs text-slate-500">
                              {rental.client.firstName} {rental.client.lastName}
                              {rental.owner
                                ? ` → ${rental.owner.firstName} ${rental.owner.lastName}`
                                : ""}
                            </p>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatDZD(record ? record.rentAmount : rental.monthlyRent)}
                          </TableCell>
                          <TableCell className="text-right text-slate-500">
                            {record?.charges ? formatDZD(record.charges) : "-"}
                          </TableCell>
                          <TableCell className="text-right text-slate-500">
                            {record?.expenses ? formatDZD(record.expenses) : "-"}
                          </TableCell>
                          <TableCell className="text-right text-slate-500">
                            {record?.commission ? formatDZD(record.commission) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium text-slate-900">
                            {record ? formatDZD(netToOwner) : "-"}
                          </TableCell>
                          <TableCell>
                            {!record ? (
                              <Badge variant="outline" className="text-slate-500">
                                Non generee
                              </Badge>
                            ) : record.isPaid ? (
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                                Encaisse
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                                Impaye
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {record ? (
                                <>
                                  <form action={togglePaid}>
                                    <input type="hidden" name="id" value={record.id} />
                                    <input type="hidden" name="month" value={month} />
                                    <input type="hidden" name="year" value={year} />
                                    <Button
                                      type="submit"
                                      size="sm"
                                      variant="ghost"
                                      title={
                                        record.isPaid
                                          ? "Remettre en attente"
                                          : "Marquer comme encaisse"
                                      }
                                      className={
                                        record.isPaid
                                          ? "text-slate-500"
                                          : "text-green-600 hover:text-green-700"
                                      }
                                    >
                                      <Wallet className="h-4 w-4" />
                                    </Button>
                                  </form>
                                  <Button asChild size="sm" variant="ghost" title="Modifier">
                                    <Link
                                      href={`${BASE}/${record.id}/edit?month=${month}&year=${year}`}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Link>
                                  </Button>
                                  <Button
                                    asChild
                                    size="sm"
                                    variant="ghost"
                                    title="Telecharger la quittance PDF"
                                  >
                                    <a
                                      href={`/api/pdf/receipt/${record.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <FileDown className="h-4 w-4" />
                                    </a>
                                  </Button>
                                </>
                              ) : (
                                <Button asChild size="sm" variant="outline">
                                  <Link
                                    href={`${BASE}/new?rentalId=${rental.id}&month=${month}&year=${year}`}
                                  >
                                    Saisir
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}

// ------------------------------------------------------------------
// Helpers locaux
// ------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string
  value: string
  icon: React.ReactNode
  tone?: "default" | "danger"
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div
          className={`text-2xl font-bold ${
            tone === "danger" ? "text-red-600" : "text-slate-900"
          }`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  )
}

function clampMonth(value: string | undefined, fallback: number): number {
  const n = parseInt(value ?? "", 10)
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : fallback
}

function clampYear(value: string | undefined, fallback: number): number {
  const n = parseInt(value ?? "", 10)
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : fallback
}

function yearRange(current: number): number[] {
  return [current - 2, current - 1, current, current + 1]
}
