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
import { Plus, FileText, Pencil, Trash2, ExternalLink } from "lucide-react"
import { Pagination } from "@/components/Pagination"
import { ListToolbar } from "@/components/ListToolbar"
import { readPageParams, readSearch, textSearch } from "@/lib/list-params"

const documentTypeLabels: Record<string, string> = {
  contrat_vente: "Contrat de vente",
  contrat_location: "Contrat de location",
  recu_paiement: "Reçu de paiement",
  fiche_bien: "Fiche bien",
  rapport_proprietaire: "Rapport propriétaire",
  piece_identite: "Pièce d'identité",
  acte_propriete: "Acte de propriété",
  image_bien: "Image bien",
  plan_bien: "Plan bien",
}

export const metadata: Metadata = { title: "Documents" }

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const query = await searchParams

  const { page, perPage, skip } = readPageParams(query)
  const q = readSearch(query)
  const where = { agencyId, ...(textSearch(q, ["name"]) ?? {}) }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.document.count({ where }),
  ])

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Documents</h1>
              <p className="text-slate-600 mt-1">
                Gérez vos documents et fichiers
              </p>
            </div>
            <Button asChild className="bg-dar-ink hover:bg-dar-blue">
              <Link href="/agency/documents/new">
                <Plus className="mr-2 h-4 w-4" />
                Nouveau document
              </Link>
            </Button>
          </div>

          <ListToolbar
            basePath="/agency/documents"
            q={q}
            placeholder="Rechercher un document par son nom…"
          />

          <Card>
            <CardHeader>
              <CardTitle>
                {total} document{total > 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    Aucun document enregistré
                  </h3>
                  <p className="text-slate-500 mb-4">
                    Commencez par ajouter votre premier document
                  </p>
                  <Button asChild className="bg-dar-ink hover:bg-dar-blue">
                    <Link href="/agency/documents/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter un document
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Taille</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((document) => (
                        <TableRow key={document.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                                <FileText className="h-5 w-5 text-slate-400" />
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">{document.name}</p>
                                <p className="text-xs text-slate-500">{document.mimeType || "-"}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {documentTypeLabels[document.type] || document.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {document.size ? (
                              <span className="text-sm text-slate-600">
                                {(document.size / 1024).toFixed(1)} KB
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-slate-600">
                              {new Date(document.createdAt).toLocaleDateString("fr-FR")}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="icon" asChild>
                                {/* Le fichier passe par l'API, jamais par son
                                    adresse de stockage : celle-ci s'ouvrait
                                    sans session. */}
                                <a
                                  href={`/api/documents/${document.id}/file`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                              <Button variant="ghost" size="icon" asChild>
                                <Link href={`/agency/documents/${document.id}`}>
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>
                              {/* Supprimer un document efface aussi le fichier :
                                  reserve a l'administrateur, et verifie
                                  cote API. */}
                              {isAgencyAdmin(userRole) && (
                                <form
                                  action={`/api/documents/${document.id}/delete`}
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
                    basePath="/agency/documents"
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
