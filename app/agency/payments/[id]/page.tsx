import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAgency } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Pencil, Calendar, CreditCard } from "lucide-react"

const paymentTypeLabels: Record<string, string> = {
  loyer: "Loyer",
  caution: "Caution",
  commission_agence: "Commission agence",
  frais_dossier: "Frais de dossier",
  avance: "Avance",
  paiement_proprietaire: "Paiement propriétaire",
  abonnement_saas: "Abonnement SaaS",
}

const paymentMethodLabels: Record<string, string> = {
  cash: "Espèces",
  virement: "Virement",
  ccp: "CCP",
  autre: "Autre",
}

const paymentStatusLabels: Record<string, string> = {
  paye: "Payé",
  partiel: "Partiel",
  impaye: "Impayé",
}

const paymentStatusColors: Record<string, string> = {
  paye: "bg-green-100 text-green-800",
  partiel: "bg-yellow-100 text-yellow-800",
  impaye: "bg-red-100 text-red-800",
}

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const { id } = await params

  const payment = await prisma.payment.findFirst({
    where: { id, agencyId },
  })

  if (!payment) {
    notFound()
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/agency/payments">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux paiements
              </Link>
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">
                  Paiement
                </h1>
                <p className="text-slate-600 mt-1">
                  Détails du paiement
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href={`/agency/payments/${payment.id}/edit`}>
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
                  <CardTitle>Informations du paiement</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Montant</p>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-slate-400" />
                        <p className="font-medium text-slate-900 text-lg">
                          {Number(payment.amount).toLocaleString()} DA
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Type</p>
                      <p className="font-medium text-slate-900">
                        {paymentTypeLabels[payment.type] || payment.type}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Date</p>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <p className="font-medium text-slate-900">
                          {new Date(payment.date).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Méthode</p>
                      <p className="font-medium text-slate-900">
                        {paymentMethodLabels[payment.method] || payment.method}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Statut</p>
                      <Badge variant="secondary" className={paymentStatusColors[payment.status] || ""}>
                        {paymentStatusLabels[payment.status] || payment.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Numéro de reçu</p>
                      <p className="font-medium text-slate-900">{payment.receipt || "-"}</p>
                    </div>
                  </div>

                  {payment.notes && (
                    <div className="pt-4 border-t border-slate-100">
                      <p className="text-sm text-slate-500 mb-2">Notes</p>
                      <p className="text-slate-700 whitespace-pre-wrap">{payment.notes}</p>
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
                      {new Date(payment.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Dernière mise à jour</span>
                    <span className="font-medium text-slate-900">
                      {new Date(payment.updatedAt).toLocaleDateString("fr-FR")}
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
