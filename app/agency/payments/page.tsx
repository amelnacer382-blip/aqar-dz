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
  CreditCard,
  Pencil,
  Trash2,
  FileDown,
  TrendingUp,
  TrendingDown,
  Wallet,
} from "lucide-react"
import { formatDZD, formatDZDCompact, formatDate, toNumber } from "@/lib/format"
import {
  PAYMENT_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  label,
  estCleConnue,
} from "@/lib/labels"
import { ListToolbar } from "@/components/ListToolbar"
import { Pagination } from "@/components/Pagination"
import { readPageParams, readSearch, textSearch } from "@/lib/list-params"

/** Un reversement au proprietaire est une sortie de caisse, pas une recette. */
const OUTGOING_TYPES = new Set(["paiement_proprietaire", "abonnement_saas"])

export const metadata: Metadata = { title: "Paiements" }

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string
    success?: string
    type?: string
    status?: string
    q?: string
    page?: string
  }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const params = await searchParams

  // `estCleConnue`, pas `in` : l'operateur `in` remonte la chaine de
  // prototypes, et `?type=constructor` partait donc dans le `where` de
  // Prisma, qui repondait par une page d'erreur (story 3.2, BUG-38).
  const typeFilter = estCleConnue(PAYMENT_TYPE_LABELS, params.type)
    ? params.type
    : undefined

  // Le tableau de bord renvoie ici sur « paiements impayés » : sans ce
  // filtre, le lien deposait l'utilisateur devant la liste entiere, a lui
  // de retrouver les impayes a l'oeil. Comme le type, la valeur vient de
  // l'URL : elle est bornee a la liste des statuts connus.
  const statusFilter = estCleConnue(PAYMENT_STATUS_LABELS, params.status)
    ? params.status
    : undefined

  const q = readSearch(params)
  const { page, perPage, skip } = readPageParams(params)

  const where = {
    agencyId,
    ...(typeFilter ? { type: typeFilter as never } : {}),
    ...(statusFilter ? { status: statusFilter as never } : {}),
    ...(textSearch(q, ["reference", "notes"]) ?? {}),
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { date: "desc" },
      skip,
      take: perPage,
      include: {
        property: { select: { id: true, title: true } },
        client: { select: { id: true, firstName: true, lastName: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.payment.count({ where }),
  ])

  const incoming = payments
    .filter((p) => !OUTGOING_TYPES.has(p.type) && p.status !== "impaye")
    .reduce((sum, p) => sum + toNumber(p.amount), 0)

  const outgoing = payments
    .filter((p) => OUTGOING_TYPES.has(p.type) && p.status !== "impaye")
    .reduce((sum, p) => sum + toNumber(p.amount), 0)

  const pending = payments
    .filter((p) => p.status !== "paye")
    .reduce((sum, p) => sum + toNumber(p.amount), 0)

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Paiements</h1>
              <p className="text-slate-600 mt-1">
                Encaissements, commissions et reversements propriétaires
              </p>
            </div>
            <Button asChild className="bg-dar-ink hover:bg-dar-blue">
              <Link href="/agency/payments/new">
                <Plus className="mr-2 h-4 w-4" />
                Nouveau paiement
              </Link>
            </Button>
          </div>

          <FormMessage error={params.error} success={params.success} />

          <ListToolbar
            basePath="/agency/payments"
            q={q}
            placeholder="Rechercher un paiement : référence, note…"
            hidden={{ type: typeFilter, status: statusFilter }}
            exportPath="/api/export/payments"
            exportParams={{ type: typeFilter }}
          />

          {statusFilter && (
            <div className="mb-6 flex items-center gap-3">
              <span className="text-sm text-slate-600">
                Filtré sur&nbsp;
                <span className="font-medium text-dar-ink">
                  {label(PAYMENT_STATUS_LABELS, statusFilter)}
                </span>
              </span>
              <Button asChild size="sm" variant="ghost" className="text-slate-500">
                <Link href={`/agency/payments${typeFilter ? `?type=${typeFilter}` : ""}`}>
                  Retirer le filtre
                </Link>
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Encaissé
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  {formatDZDCompact(incoming)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Reversé / sorties
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  {formatDZDCompact(outgoing)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  En attente
                </CardTitle>
                <Wallet className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  {formatDZDCompact(pending)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtre par type */}
          <div className="mb-6 flex flex-wrap gap-2">
            <Button
              asChild
              size="sm"
              variant={typeFilter ? "outline" : "default"}
              className={typeFilter ? "" : "bg-dar-ink hover:bg-dar-blue"}
            >
              <Link href="/agency/payments">Tous</Link>
            </Button>
            {Object.entries(PAYMENT_TYPE_LABELS).map(([value, text]) => (
              <Button
                key={value}
                asChild
                size="sm"
                variant={typeFilter === value ? "default" : "outline"}
                className={typeFilter === value ? "bg-dar-ink hover:bg-dar-blue" : ""}
              >
                <Link href={`/agency/payments?type=${value}`}>{text}</Link>
              </Button>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Liste des paiements ({payments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-12">
                  <CreditCard className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    Aucun paiement
                  </h3>
                  <p className="text-slate-500 mb-6">
                    Enregistrez votre premier paiement pour suivre votre trésorerie.
                  </p>
                  <Button asChild className="bg-dar-ink hover:bg-dar-blue">
                    <Link href="/agency/payments/new">Nouveau paiement</Link>
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Rattaché à</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => {
                        const outgoingRow = OUTGOING_TYPES.has(payment.type)
                        const counterparty =
                          payment.owner
                            ? `${payment.owner.firstName} ${payment.owner.lastName}`
                            : payment.client
                              ? `${payment.client.firstName} ${payment.client.lastName}`
                              : null

                        return (
                          <TableRow key={payment.id}>
                            <TableCell className="text-slate-600">
                              {formatDate(payment.date)}
                            </TableCell>
                            <TableCell className="font-medium text-slate-900">
                              {label(PAYMENT_TYPE_LABELS, payment.type)}
                            </TableCell>
                            <TableCell>
                              {payment.property ? (
                                <Link
                                  href={`/agency/properties/${payment.property.id}`}
                                  className="text-slate-900 hover:underline"
                                >
                                  {payment.property.title}
                                </Link>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                              {counterparty && (
                                <p className="text-xs text-slate-500">{counterparty}</p>
                              )}
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {label(PAYMENT_METHOD_LABELS, payment.method)}
                            </TableCell>
                            <TableCell
                              className={`text-right font-medium ${
                                outgoingRow ? "text-purple-700" : "text-slate-900"
                              }`}
                            >
                              {outgoingRow ? "− " : ""}
                              {formatDZD(payment.amount)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={PAYMENT_STATUS_COLORS[payment.status] ?? ""}
                              >
                                {label(PAYMENT_STATUS_LABELS, payment.status)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  asChild
                                  size="sm"
                                  variant="ghost"
                                  title="Télécharger le reçu PDF"
                                >
                                  <a
                                    href={`/api/pdf/payment/${payment.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <FileDown className="h-4 w-4" />
                                  </a>
                                </Button>
                                <Button asChild size="sm" variant="ghost" title="Modifier">
                                  <Link href={`/agency/payments/${payment.id}/edit`}>
                                    <Pencil className="h-4 w-4" />
                                  </Link>
                                </Button>
                                {/* Un paiement est une piece comptable : sa
                                    suppression est definitive, reservee a
                                    l'administrateur et inscrite au journal. */}
                                {isAgencyAdmin(userRole) && (
                                  <form
                                    action={`/api/payments/${payment.id}/delete`}
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
                        )
                      })}
                    </TableBody>
                  </Table>

                  <Pagination
                    page={page}
                    perPage={perPage}
                    total={total}
                    basePath="/agency/payments"
                    params={{ q, type: typeFilter }}
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
