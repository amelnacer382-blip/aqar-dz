import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAgency } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Pencil, CalendarDays, Clock, User, Building2 } from "lucide-react"

const visitStatusLabels: Record<string, string> = {
  prevue: "Prévue",
  effectuee: "Effectuée",
  annulee: "Annulée",
  reportee: "Reportée",
}

const visitStatusColors: Record<string, string> = {
  prevue: "bg-blue-100 text-blue-800",
  effectuee: "bg-green-100 text-green-800",
  annulee: "bg-red-100 text-red-800",
  reportee: "bg-yellow-100 text-yellow-800",
}

export default async function VisitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const { id } = await params

  const visit = await prisma.visit.findFirst({
    where: { id, agencyId },
    include: {
      client: {
        select: { firstName: true, lastName: true, phone: true, email: true },
      },
      property: {
        select: { title: true, id: true, wilaya: true, commune: true },
      },
    },
  })

  if (!visit) {
    notFound()
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/agency/visits">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux visites
              </Link>
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">
                  Visite du {new Date(visit.date).toLocaleDateString("fr-FR")}
                </h1>
                <p className="text-slate-600 mt-1">
                  Détails de la visite
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href={`/agency/visits/${visit.id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Modifier
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Informations de la visite</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Date</p>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        <p className="font-medium text-slate-900">
                          {new Date(visit.date).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Heure</p>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-400" />
                        <p className="font-medium text-slate-900">{visit.time}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Client</p>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" />
                        <p className="font-medium text-slate-900">
                          {visit.client.firstName} {visit.client.lastName}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Bien</p>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        <p className="font-medium text-slate-900">{visit.property.title}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Localisation</p>
                      <p className="font-medium text-slate-900">
                        {visit.property.wilaya}, {visit.property.commune}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Statut</p>
                      <Badge variant="secondary" className={visitStatusColors[visit.status] || ""}>
                        {visitStatusLabels[visit.status] || visit.status}
                      </Badge>
                    </div>
                  </div>

                  {visit.result && (
                    <div className="pt-4 border-t border-slate-100">
                      <p className="text-sm text-slate-500 mb-2">Résultat</p>
                      <p className="text-slate-700 whitespace-pre-wrap">{visit.result}</p>
                    </div>
                  )}

                  {visit.notes && (
                    <div className="pt-4 border-t border-slate-100">
                      <p className="text-sm text-slate-500 mb-2">Notes</p>
                      <p className="text-slate-700 whitespace-pre-wrap">{visit.notes}</p>
                    </div>
                  )}
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
                    <span className="font-medium text-slate-900">
                      {new Date(visit.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Dernière mise à jour</span>
                    <span className="font-medium text-slate-900">
                      {new Date(visit.updatedAt).toLocaleDateString("fr-FR")}
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
