import type { Metadata } from "next"
import { requireAgencyAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Pagination } from "@/components/Pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollText } from "lucide-react"
import { formatDateTime } from "@/lib/format"
import { readPageParams } from "@/lib/list-params"

const ACTION_LABELS: Record<string, string> = {
  suppression: "Suppression",
  restauration: "Restauration",
  changement_statut: "Changement de statut",
  creation_compte: "Création de compte",
  modification_compte: "Modification de compte",
  desactivation_compte: "Désactivation de compte",
  reinitialisation_mot_de_passe: "Mot de passe réinitialisé",
}

const ACTION_COLORS: Record<string, string> = {
  suppression: "bg-red-100 text-red-800",
  restauration: "bg-emerald-100 text-emerald-800",
  changement_statut: "bg-amber-100 text-amber-800",
  creation_compte: "bg-dar-blue-soft text-dar-blue",
  modification_compte: "bg-slate-100 text-slate-700",
  desactivation_compte: "bg-red-100 text-red-800",
  reinitialisation_mot_de_passe: "bg-amber-100 text-amber-800",
}

/**
 * Journal des actions consequentes de l'agence.
 *
 * Reserve a l'administrateur : c'est un outil de controle, pas une
 * fonctionnalite de travail. Il repond a la question « qui a supprime ce
 * bien, et quand », qui n'avait aucune reponse jusqu'ici.
 */
export const metadata: Metadata = { title: "Journal" }

export default async function AgencyAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { agencyId, userRole, userName } = await requireAgencyAdmin()
  const query = await searchParams
  const { page, perPage, skip } = readPageParams(query)

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { agencyId },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.auditLog.count({ where: { agencyId } }),
  ])

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash min-h-screen pt-16">
        <div className="container mx-auto max-w-5xl px-4 py-8">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">
              Journal
            </h1>
            <p className="mt-1 text-slate-600">
              Les actions qui font disparaître ou changer quelque chose :
              suppressions, restaurations, gestion des comptes.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{total} entrée{total > 1 ? "s" : ""}</CardTitle>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <div className="py-16 text-center">
                  <ScrollText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                  <p className="font-medium text-dar-ink">Journal vide</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Rien de conséquent ne s&apos;est encore produit sur cet
                    espace.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Quand</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Objet</TableHead>
                          <TableHead>Détail</TableHead>
                          <TableHead>Par</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="whitespace-nowrap font-mono text-xs text-slate-500">
                              {formatDateTime(entry.createdAt)}
                            </TableCell>
                            <TableCell>
                              <Badge className={ACTION_COLORS[entry.action] ?? ""}>
                                {ACTION_LABELS[entry.action] ?? entry.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="capitalize text-slate-600">
                              {entry.entity}
                            </TableCell>
                            <TableCell className="text-dar-ink">
                              {entry.summary}
                            </TableCell>
                            <TableCell className="text-slate-500">
                              {entry.userName ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <Pagination
                    page={page}
                    perPage={perPage}
                    total={total}
                    basePath="/agency/audit"
                    params={{}}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
