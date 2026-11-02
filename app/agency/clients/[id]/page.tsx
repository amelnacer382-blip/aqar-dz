import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Pencil, Phone, Mail, MapPin, Calendar } from "lucide-react"
import { InteractionTimeline } from "@/components/InteractionTimeline"
import { FormMessage } from "@/components/FormMessage"
import { requireAgency } from "@/lib/auth-guard"

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

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const { agencyId, userId, userRole, userName } = await requireAgency()
  const { id } = await params
  const query = await searchParams

  const client = await prisma.client.findFirst({
    where: { id, agencyId },
    include: {
      interactions: {
        orderBy: { date: "desc" },
      },
      visits: {
        orderBy: { date: "desc" },
        take: 5,
        include: {
          property: {
            select: { title: true, id: true },
          },
        },
      },
    },
  })

  if (!client) {
    notFound()
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/agency/clients">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux clients
              </Link>
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">
                  {client.firstName} {client.lastName}
                </h1>
                <p className="text-slate-600 mt-1">
                  Fiche client
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href={`/agency/clients/${client.id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Modifier
                </Link>
              </Button>
            </div>
          </div>

          <FormMessage error={query.error} success={query.success} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Informations personnelles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Prénom</p>
                      <p className="font-medium text-slate-900">{client.firstName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Nom</p>
                      <p className="font-medium text-slate-900">{client.lastName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Téléphone</p>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <p className="font-medium text-slate-900">{client.phone || "-"}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Email</p>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <p className="font-medium text-slate-900">{client.email || "-"}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Type</p>
                      <p className="font-medium text-slate-900">{clientTypeLabels[client.type] || client.type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Statut</p>
                      <Badge variant="secondary" className={clientStatusColors[client.status] || ""}>
                        {clientStatusLabels[client.status] || client.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Budget</p>
                      <p className="font-medium text-slate-900">
                        {client.budget ? `${Number(client.budget).toLocaleString()} DA` : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Wilaya recherchée</p>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <p className="font-medium text-slate-900">{client.wilaya || "-"}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Catégorie recherchée</p>
                      <p className="font-medium text-slate-900 capitalize">{client.category || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Type de bien recherché</p>
                      <p className="font-medium text-slate-900 capitalize">{client.propertyType?.replace(/_/g, " ") || "-"}</p>
                    </div>
                  </div>

                  {client.notes && (
                    <div className="pt-4 border-t border-slate-100">
                      <p className="text-sm text-slate-500 mb-2">Notes</p>
                      <p className="text-slate-700 whitespace-pre-wrap">{client.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Dernières visites</CardTitle>
                </CardHeader>
                <CardContent>
                  {client.visits.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500">Aucune visite enregistrée</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {client.visits.map((visit) => (
                        <div
                          key={visit.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-slate-200"
                        >
                          <div>
                            <p className="font-medium text-slate-900">{visit.property.title}</p>
                            <p className="text-sm text-slate-500">
                              {new Date(visit.date).toLocaleDateString("fr-FR")} à {visit.time}
                            </p>
                          </div>
                          <Badge variant="secondary" className="capitalize">
                            {visit.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <InteractionTimeline
                userId={userId}
                userRole={userRole}
                interactions={client.interactions}
                clientId={client.id}
                returnTo={`/agency/clients/${client.id}`}
              />
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Résumé</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Visites</span>
                    <span className="font-medium text-slate-900">{client.visits.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Date d&apos;ajout</span>
                    <span className="font-medium text-slate-900">
                      {new Date(client.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Dernière mise à jour</span>
                    <span className="font-medium text-slate-900">
                      {new Date(client.updatedAt).toLocaleDateString("fr-FR")}
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
