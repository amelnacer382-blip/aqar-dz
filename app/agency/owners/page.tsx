import type { Metadata } from "next"
import Link from "next/link"
import { requireAgency, isAgencyAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, UserCheck, Pencil, Trash2, Phone, Mail } from "lucide-react"
import { ListToolbar } from "@/components/ListToolbar"
import { Pagination } from "@/components/Pagination"
import { readPageParams, readSearch, textSearch } from "@/lib/list-params"

export const metadata: Metadata = { title: "Propriétaires" }

export default async function OwnersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const query = await searchParams

  const q = readSearch(query)
  const { page, perPage, skip } = readPageParams(query)

  const where = {
    agencyId,
    ...(textSearch(q, ["firstName", "lastName", "phone", "email"]) ?? {}),
  }

  const [owners, total] = await Promise.all([
    prisma.owner.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
      include: {
        _count: {
          /*
            LE FILTRE DE CORBEILLE NE VIENT PAS TOUT SEUL ICI (BUG-24,
            story 3.5). L'extension de `lib/prisma.ts` agit sur le `where`
            de PREMIER NIVEAU de l'operation : elle couvre le `findMany`
            ci-dessus, jamais ce `_count`, qui n'est pas une operation
            distincte. Sans cette ligne, la colonne « Biens » compte les
            biens mis a la corbeille.
          */
          select: { properties: { where: { deletedAt: null } } },
        },
      },
    }),
    prisma.owner.count({ where }),
  ])

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Propriétaires</h1>
              <p className="text-slate-600 mt-1">
                Gérez votre base de propriétaires
              </p>
            </div>
            <Button asChild className="bg-dar-ink hover:bg-dar-blue">
              <Link href="/agency/owners/new">
                <Plus className="mr-2 h-4 w-4" />
                Nouveau propriétaire
              </Link>
            </Button>
          </div>

          <ListToolbar
            basePath="/agency/owners"
            q={q}
            placeholder="Rechercher un propriétaire : nom, téléphone, email…"
            exportPath="/api/export/owners"
          />

          <Card>
            <CardHeader>
              <CardTitle>
                {total} propriétaire{total > 1 ? "s" : ""}
                {q ? ` correspondant à « ${q} »` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {owners.length === 0 ? (
                <div className="text-center py-12">
                  <UserCheck className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    Aucun propriétaire enregistré
                  </h3>
                  <p className="text-slate-500 mb-4">
                    Commencez par ajouter votre premier propriétaire
                  </p>
                  <Button asChild className="bg-dar-ink hover:bg-dar-blue">
                    <Link href="/agency/owners/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter un propriétaire
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Adresse</TableHead>
                        <TableHead>Biens</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {owners.map((owner) => (
                        <TableRow key={owner.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-medium text-slate-700">
                                  {owner.firstName[0]}{owner.lastName[0]}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">
                                  {owner.firstName} {owner.lastName}
                                </p>
                                {owner.idCardNumber && (
                                  <p className="text-xs text-slate-500">
                                    N° carte: {owner.idCardNumber}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {owner.phone && (
                                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                                  <Phone className="h-3.5 w-3.5" />
                                  {owner.phone}
                                </div>
                              )}
                              {owner.email && (
                                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                                  <Mail className="h-3.5 w-3.5" />
                                  {owner.email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-slate-600 max-w-[200px] truncate">
                              {owner.address || "-"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                              {owner._count.properties} bien{owner._count.properties !== 1 ? "s" : ""}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="icon" asChild>
                                <Link href={`/agency/owners/${owner.id}`}>
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>
                              {isAgencyAdmin(userRole) && (
                              <form
                                action={`/api/owners/${owner.id}/delete`}
                                method="POST"
                                className="inline"
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
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
                    basePath="/agency/owners"
                    params={{ q }}
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
