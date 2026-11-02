import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAgency } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Pencil, FileText, ExternalLink, Calendar } from "lucide-react"

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

/**
 * Nom du fichier tel qu'il est range dans le stockage.
 *
 * Purement indicatif : ce nom ne sert plus a construire aucun lien.
 */
function storedFilename(url: string): string {
  // Pas de repli sur `url` : une adresse se terminant par « / » — valeur
  // qu'aucune validation n'interdit — reaffichait l'adresse de stockage
  // complete, ce que cet ecran ne veut precisement plus montrer.
  const nom = url.split("?")[0].split("/").filter(Boolean).pop()
  return nom ?? "—"
}

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const { id } = await params

  const document = await prisma.document.findFirst({
    where: { id, agencyId },
  })

  if (!document) {
    notFound()
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/agency/documents">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux documents
              </Link>
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">{document.name}</h1>
                <p className="text-slate-600 mt-1">Détails du document</p>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  {/* Le fichier passe par l'API, jamais par son adresse de
                      stockage : celle-ci s'ouvrait sans session. */}
                  <a
                    href={`/api/documents/${document.id}/file`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Télécharger
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/agency/documents/${document.id}/edit`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Modifier
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Informations du document</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Nom</p>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <p className="font-medium text-slate-900">{document.name}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Type</p>
                      <Badge variant="secondary" className="capitalize">
                        {documentTypeLabels[document.type] || document.type}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Type MIME</p>
                      <p className="font-medium text-slate-900">{document.mimeType || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Taille</p>
                      <p className="font-medium text-slate-900">
                        {document.size ? `${(document.size / 1024).toFixed(1)} KB` : "-"}
                      </p>
                    </div>
                    {/* L'adresse de stockage n'est plus affichee : elle
                        n'ouvre plus rien, et la donner invitait a la
                        copier hors de l'application. Reste le nom du
                        fichier, qui sert a le reconnaitre. */}
                    <div className="md:col-span-2">
                      <p className="text-sm text-slate-500 mb-1">Fichier</p>
                      <p className="font-medium text-slate-900 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        {storedFilename(document.url)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Résumé</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Date de création</span>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span className="font-medium text-slate-900">
                        {new Date(document.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Dernière mise à jour</span>
                    <span className="font-medium text-slate-900">
                      {new Date(document.updatedAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
