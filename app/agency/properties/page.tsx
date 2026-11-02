import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
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
import { Plus, Building2, Pencil, Trash2 } from "lucide-react"
import { ListToolbar } from "@/components/ListToolbar"
import { Pagination } from "@/components/Pagination"
import { readPageParams, readSearch, textSearch } from "@/lib/list-params"

export const metadata: Metadata = { title: "Biens" }

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const query = await searchParams

  const q = readSearch(query)
  const { page, perPage, skip } = readPageParams(query)

  // La recherche porte sur ce qu'une agence a en tete quand elle cherche un
  // bien : son titre, sa reference, ou l'endroit ou il se trouve.
  const where = {
    agencyId,
    ...(textSearch(q, ["title", "reference", "wilaya", "commune", "address"]) ?? {}),
  }

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
      include: {
        images: { take: 1 },
        owner: true,
      },
    }),
    prisma.property.count({ where }),
  ])

  const statusLabels: Record<string, string> = {
    disponible: "Disponible",
    vendu: "Vendu",
    loue: "Loué",
    reserve: "Réservé",
    archive: "Archivé",
  }

  const statusColors: Record<string, string> = {
    disponible: "bg-green-100 text-green-800 hover:bg-green-100",
    vendu: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    loue: "bg-purple-100 text-purple-800 hover:bg-purple-100",
    reserve: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
    archive: "bg-slate-100 text-slate-800 hover:bg-slate-100",
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Biens immobiliers</h1>
              <p className="text-slate-600 mt-1">
                Gérez votre portefeuille immobilier
              </p>
            </div>
            <Button asChild className="bg-dar-ink hover:bg-dar-blue">
              <Link href="/agency/properties/new">
                <Plus className="mr-2 h-4 w-4" />
                Nouveau bien
              </Link>
            </Button>
          </div>

          <ListToolbar
            basePath="/agency/properties"
            q={q}
            placeholder="Rechercher un bien : titre, référence, wilaya…"
            exportPath="/api/export/properties"
          />

          <Card>
            <CardHeader>
              <CardTitle>
                {total} bien{total > 1 ? "s" : ""}
                {q ? ` correspondant à « ${q} »` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {properties.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    {q ? "Aucun bien ne correspond" : "Aucun bien enregistré"}
                  </h3>
                  <p className="text-slate-500 mb-4">
                    {q
                      ? "Essayez un autre terme, ou effacez la recherche."
                      : "Commencez par ajouter votre premier bien immobilier"}
                  </p>
                  <Button asChild className="bg-dar-ink hover:bg-dar-blue">
                    <Link href={q ? "/agency/properties" : "/agency/properties/new"}>
                      {q ? (
                        "Voir tous les biens"
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Ajouter un bien
                        </>
                      )}
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bien</TableHead>
                        <TableHead>Référence</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Localisation</TableHead>
                        <TableHead>Prix</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {properties.map((property) => (
                        <TableRow key={property.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="relative h-10 w-10 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                {property.images[0]?.url ? (
                                  <Image
                                    src={property.images[0].url}
                                    alt={property.title}
                                    fill
                                    sizes="40px"
                                    className="object-cover"
                                  />
                                ) : (
                                  <Building2 className="h-5 w-5 text-slate-400" />
                                )}
                              </div>
                              <div>
                                <Link
                                  href={`/agency/properties/${property.id}`}
                                  className="font-medium text-slate-900 hover:underline"
                                >
                                  {property.title}
                                </Link>
                                {property.owner && (
                                  <p className="text-xs text-slate-500">
                                    {property.owner.firstName} {property.owner.lastName}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {property.reference}
                          </TableCell>
                          <TableCell className="capitalize">
                            {property.type.replace(/_/g, " ")}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm">{property.wilaya}</p>
                              <p className="text-xs text-slate-500">{property.commune}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {property.salePrice ? (
                              <p className="font-medium">
                                {Number(property.salePrice).toLocaleString()} DA
                              </p>
                            ) : property.rentPrice ? (
                              <p className="font-medium">
                                {Number(property.rentPrice).toLocaleString()} DA/mois
                              </p>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={statusColors[property.status] || ""}>
                              {statusLabels[property.status] || property.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="icon" asChild>
                                <Link href={`/agency/properties/${property.id}/edit`}>
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>
                              {/* La suppression est reservee a l'administrateur.
                                  L'API le verifie aussi : cacher le bouton
                                  ne suffit jamais a proteger une action. */}
                              {isAgencyAdmin(userRole) && (
                                <form
                                  action={`/api/properties/${property.id}/delete`}
                                  method="POST"
                                  className="inline"
                                >
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Mettre à la corbeille"
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
                    basePath="/agency/properties"
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
