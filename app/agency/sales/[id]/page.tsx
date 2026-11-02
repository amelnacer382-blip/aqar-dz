import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAgency } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Pencil, Calendar, Building2, FileDown } from "lucide-react"

const saleStatusLabels: Record<string, string> = {
  negociation: "Négociation",
  compromis: "Compromis",
  vendu: "Vendu",
  annule: "Annulé",
}

const saleStatusColors: Record<string, string> = {
  negociation: "bg-yellow-100 text-yellow-800",
  compromis: "bg-blue-100 text-blue-800",
  vendu: "bg-green-100 text-green-800",
  annule: "bg-red-100 text-red-800",
}

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const { id } = await params

  const sale = await prisma.sale.findFirst({
    where: { id, agencyId },
    include: {
      property: {
        select: { title: true, id: true, wilaya: true, commune: true },
      },
    },
  })

  if (!sale) {
    notFound()
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/agency/sales">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux ventes
              </Link>
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">
                  Vente - {sale.property.title}
                </h1>
                <p className="text-slate-600 mt-1">
                  Détails de la transaction
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <a
                    href={`/api/pdf/sale-contract/${sale.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    Compromis PDF
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/agency/sales/${sale.id}/edit`}>
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
                  <CardTitle>Informations de la vente</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Bien</p>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        <p className="font-medium text-slate-900">{sale.property.title}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Localisation</p>
                      <p className="font-medium text-slate-900">
                        {sale.property.wilaya}, {sale.property.commune}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Prix final</p>
                      <p className="font-medium text-slate-900 text-lg">
                        {Number(sale.finalPrice).toLocaleString()} DA
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Commission</p>
                      <p className="font-medium text-slate-900">
                        {sale.commission ? `${Number(sale.commission).toLocaleString()} DA` : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Date de vente</p>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <p className="font-medium text-slate-900">
                          {new Date(sale.saleDate).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Statut</p>
                      <Badge variant="secondary" className={saleStatusColors[sale.status] || ""}>
                        {saleStatusLabels[sale.status] || sale.status}
                      </Badge>
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
                    <span className="font-medium text-slate-900">
                      {new Date(sale.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Dernière mise à jour</span>
                    <span className="font-medium text-slate-900">
                      {new Date(sale.updatedAt).toLocaleDateString("fr-FR")}
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
