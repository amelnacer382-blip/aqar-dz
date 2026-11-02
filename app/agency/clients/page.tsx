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
import { Plus, Users, Pencil, Trash2, Phone, Mail } from "lucide-react"
import { ListToolbar } from "@/components/ListToolbar"
import { Pagination } from "@/components/Pagination"
import { readPageParams, readSearch, textSearch } from "@/lib/list-params"

const clientTypeLabels: Record<string, string> = {
  acheteur: "Acheteur",
  locataire: "Locataire",
  investisseur: "Investisseur",
  interesse: "Intéressé",
}

const clientStatusLabels: Record<string, string> = {
  nouveau: "Nouveau",
  interesse: "Intéressé",
  visite_prevue: "Visite prévue",
  client_chaud: "Client chaud",
  conclu: "Conclu",
  perdu: "Perdu",
}

const clientStatusColors: Record<string, string> = {
  nouveau: "bg-blue-100 text-blue-800",
  interesse: "bg-green-100 text-green-800",
  visite_prevue: "bg-yellow-100 text-yellow-800",
  client_chaud: "bg-orange-100 text-orange-800",
  conclu: "bg-purple-100 text-purple-800",
  perdu: "bg-red-100 text-red-800",
}

export const metadata: Metadata = { title: "Clients" }

export default async function ClientsPage({
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
    ...(textSearch(q, ["firstName", "lastName", "phone", "email", "wilaya"]) ?? {}),
  }

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
      include: {
        _count: {
          select: { visits: true },
        },
      },
    }),
    prisma.client.count({ where }),
  ])

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Clients</h1>
              <p className="text-slate-600 mt-1">
                Gérez votre base de clients
              </p>
            </div>
            <Button asChild className="bg-dar-ink hover:bg-dar-blue">
              <Link href="/agency/clients/new">
                <Plus className="mr-2 h-4 w-4" />
                Nouveau client
              </Link>
            </Button>
          </div>

          <ListToolbar
            basePath="/agency/clients"
            q={q}
            placeholder="Rechercher un client : nom, téléphone, email…"
            exportPath="/api/export/clients"
          />

          <Card>
            <CardHeader>
              <CardTitle>
                {total} client{total > 1 ? "s" : ""}
                {q ? ` correspondant à « ${q} »` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {clients.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    Aucun client enregistré
                  </h3>
                  <p className="text-slate-500 mb-4">
                    Commencez par ajouter votre premier client
                  </p>
                  <Button asChild className="bg-dar-ink hover:bg-dar-blue">
                    <Link href="/agency/clients/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter un client
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
                        <TableHead>Type</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Budget</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.map((client) => (
                        <TableRow key={client.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-medium text-slate-700">
                                  {client.firstName[0]}{client.lastName[0]}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">
                                  {client.firstName} {client.lastName}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {client._count.visits} visite{client._count.visits !== 1 ? "s" : ""}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {client.phone && (
                                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                                  <Phone className="h-3.5 w-3.5" />
                                  {client.phone}
                                </div>
                              )}
                              {client.email && (
                                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                                  <Mail className="h-3.5 w-3.5" />
                                  {client.email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-slate-700">
                              {clientTypeLabels[client.type] || client.type}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={clientStatusColors[client.status] || ""}>
                              {clientStatusLabels[client.status] || client.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {client.budget ? (
                              <p className="font-medium text-slate-900">
                                {Number(client.budget).toLocaleString()} DA
                              </p>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="icon" asChild>
                                <Link href={`/agency/clients/${client.id}`}>
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>
                              {isAgencyAdmin(userRole) && (
                              <form
                                action={`/api/clients/${client.id}/delete`}
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
                    basePath="/agency/clients"
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
