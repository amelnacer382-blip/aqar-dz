import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAgency } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Pencil, Calendar, Building2, KeyRound, FileDown, Wallet } from "lucide-react"

const rentalStatusLabels: Record<string, string> = {
  active: "Actif",
  terminee: "Terminée",
  annulee: "Annulée",
}

const rentalStatusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  terminee: "bg-slate-100 text-slate-800",
  annulee: "bg-red-100 text-red-800",
}

export default async function RentalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const { id } = await params

  const rental = await prisma.rental.findFirst({
    where: { id, agencyId },
    include: {
      property: {
        select: { title: true, id: true, wilaya: true, commune: true },
      },
      rentalManagements: {
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: 12,
      },
    },
  })

  if (!rental) {
    notFound()
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/agency/rentals">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux locations
              </Link>
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">
                  Location - {rental.property.title}
                </h1>
                <p className="text-slate-600 mt-1">
                  Détails du bail
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <a
                    href={`/api/pdf/rental-contract/${rental.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    Contrat PDF
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/agency/rental-management">
                    <Wallet className="mr-2 h-4 w-4" />
                    Gestion locative
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/agency/rentals/${rental.id}/edit`}>
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
                  <CardTitle>Informations du bail</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Bien</p>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        <p className="font-medium text-slate-900">{rental.property.title}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Localisation</p>
                      <p className="font-medium text-slate-900">
                        {rental.property.wilaya}, {rental.property.commune}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Loyer mensuel</p>
                      <p className="font-medium text-slate-900 text-lg">
                        {Number(rental.monthlyRent).toLocaleString()} DA
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Caution</p>
                      <p className="font-medium text-slate-900">
                        {rental.deposit ? `${Number(rental.deposit).toLocaleString()} DA` : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Frais d&apos;agence</p>
                      <p className="font-medium text-slate-900">
                        {rental.agencyFees ? `${Number(rental.agencyFees).toLocaleString()} DA` : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Date de début</p>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <p className="font-medium text-slate-900">
                          {new Date(rental.startDate).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Date de fin</p>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <p className="font-medium text-slate-900">
                          {rental.endDate
                            ? new Date(rental.endDate).toLocaleDateString("fr-FR")
                            : "Indéterminée"}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Statut</p>
                      <Badge variant="secondary" className={rentalStatusColors[rental.status] || ""}>
                        {rentalStatusLabels[rental.status] || rental.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Suivi des paiements</CardTitle>
                </CardHeader>
                <CardContent>
                  {rental.rentalManagements.length === 0 ? (
                    <div className="text-center py-8">
                      <KeyRound className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500">Aucun paiement enregistré</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rental.rentalManagements.map((rm) => (
                        <div
                          key={rm.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-slate-200"
                        >
                          <div>
                            <p className="font-medium text-slate-900">
                              {rm.month.toString().padStart(2, "0")}/{rm.year}
                            </p>
                            <p className="text-sm text-slate-500">
                              {Number(rm.rentAmount).toLocaleString()} DA
                            </p>
                          </div>
                          <Badge variant={rm.isPaid ? "default" : "secondary"}>
                            {rm.isPaid ? "Payé" : "En attente"}
                          </Badge>
                        </div>
                      ))}
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
                    <span className="text-sm text-slate-500">Paiements enregistrés</span>
                    <span className="font-medium text-slate-900">{rental.rentalManagements.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Date de création</span>
                    <span className="font-medium text-slate-900">
                      {new Date(rental.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Dernière mise à jour</span>
                    <span className="font-medium text-slate-900">
                      {new Date(rental.updatedAt).toLocaleDateString("fr-FR")}
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
