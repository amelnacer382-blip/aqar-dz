import type { Metadata } from "next"
import Link from "next/link"
import { requireAgency, isAgencyAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
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
import { Plus, ShoppingCart, Pencil, Trash2, Calendar } from "lucide-react"
import { Pagination } from "@/components/Pagination"
import { ListToolbar } from "@/components/ListToolbar"
import { readPageParams, readSearch, dealSearch } from "@/lib/list-params"

const saleStatusLabels: Record<string, string> = {
  negociation: "Négociation",
  compromis: "Compromis",
  vendu: "Vendu",
  annule: "Annulé",
}

const saleStatusColors: Record<string, string> = {
  negociation: "bg-yellow-100 text-yellow-800",
  compromis: "bg-blue-100 text-blue-800",
  vendu: "bg-green-100 text-green-800",
  annule: "bg-red-100 text-red-800",
}

export const metadata: Metadata = { title: "Ventes" }

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const query = await searchParams

  const { page, perPage, skip } = readPageParams(query)
  const q = readSearch(query)
  const where = { agencyId, ...(dealSearch(q) ?? {}) }

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
      include: {
        property: {
          select: { title: true, id: true, reference: true },
        },
        client: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    }),
    prisma.sale.count({ where }),
  ])

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Ventes</h1>
              <p className="text-slate-600 mt-1">
                Suivez vos transactions de vente
              </p>
            </div>
            <Button asChild className="bg-dar-ink hover:bg-dar-blue">
              <Link href="/agency/sales/new">
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle vente
              </Link>
            </Button>
          </div>

          <ListToolbar
            basePath="/agency/sales"
            q={q}
            placeholder="Rechercher un bien, une référence, un client…"
            exportPath="/api/export/sales"
          />

          <Card>
            <CardHeader>
              <CardTitle>
                {total} vente{total > 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sales.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    Aucune vente enregistrée
                  </h3>
                  <p className="text-slate-500 mb-4">
                    Commencez par ajouter votre première vente
                  </p>
                  <Button asChild className="bg-dar-ink hover:bg-dar-blue">
                    <Link href="/agency/sales/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter une vente
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bien</TableHead>
                        <TableHead>Acquéreur</TableHead>
                        <TableHead>Prix final</TableHead>
                        <TableHead>Commission</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-slate-900">{sale.property.title}</p>
                              <p className="font-mono text-xs text-slate-500">
                                {sale.property.reference}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/agency/clients/${sale.client.id}`}
                              className="text-slate-700 hover:underline"
                            >
                              {sale.client.firstName} {sale.client.lastName}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-slate-900">
                              {Number(sale.finalPrice).toLocaleString()} DA
                            </p>
                          </TableCell>
                          <TableCell>
                            {sale.commission ? (
                              <p className="text-slate-700">
                                {Number(sale.commission).toLocaleString()} DA
                              </p>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(sale.saleDate).toLocaleDateString("fr-FR")}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={saleStatusColors[sale.status] || ""}>
                              {saleStatusLabels[sale.status] || sale.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="icon" asChild>
                                <Link href={`/agency/sales/${sale.id}`}>
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>
                              {/* La suppression est reservee a l'administrateur.
                                  L'API le verifie aussi : cacher le bouton
                                  ne suffit jamais a proteger une action. */}
                              {isAgencyAdmin(userRole) && (
                                <form
                                  action={`/api/sales/${sale.id}/delete`}
                                  method="POST"
                                  className="inline"
                                >
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Supprimer définitivement"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    type="submit"
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
                    basePath="/agency/sales"
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
