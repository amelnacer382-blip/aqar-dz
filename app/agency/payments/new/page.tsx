import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireAgency } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { FormMessage } from "@/components/FormMessage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft } from "lucide-react"
import { formatDZD, toDateInputValue } from "@/lib/format"
import {
  PAYMENT_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/labels"
import { paymentSchema } from "@/lib/validations"
import { parseForm, withError, withSuccess } from "@/lib/form"
import { verifyPaymentLinks } from "../verify-links"

const selectClass =
  "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"

export const metadata: Metadata = { title: "Nouveau paiement" }

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; rentalId?: string; saleId?: string }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const params = await searchParams

  const [properties, clients, owners, rentals, sales] = await Promise.all([
    prisma.property.findMany({
      where: { agencyId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
    prisma.client.findMany({
      where: { agencyId },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.owner.findMany({
      where: { agencyId },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.rental.findMany({
      where: { agencyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        monthlyRent: true,
        property: { select: { title: true } },
        client: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.sale.findMany({
      where: { agencyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        finalPrice: true,
        property: { select: { title: true } },
        client: { select: { firstName: true, lastName: true } },
      },
    }),
  ])

  async function createPayment(formData: FormData) {
    "use server"
    const { agencyId } = await requireAgency()

    const parsed = parseForm(paymentSchema, formData)

    if (!parsed.ok) {
      redirect(withError("/agency/payments/new", parsed.message))
    }

    const data = parsed.data

    // Chaque rattachement doit appartenir a l'agence : on verifie les
    // identifiants postes plutot que de leur faire confiance.
    const links = await verifyPaymentLinks(agencyId, data)

    if (!links.ok) {
      redirect(withError("/agency/payments/new", links.error))
    }

    await prisma.payment.create({
      data: {
        amount: data.amount,
        type: data.type,
        date: data.date,
        method: data.method,
        status: data.status,
        propertyId: data.propertyId,
        clientId: data.clientId,
        ownerId: data.ownerId,
        rentalId: data.rentalId,
        saleId: data.saleId,
        receipt: data.receipt,
        notes: data.notes,
        agencyId,
      },
    })

    revalidatePath("/agency/payments")
    redirect(withSuccess("/agency/payments", "Paiement enregistre"))
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
            <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Nouveau paiement</h1>
            <p className="text-slate-600 mt-1">
              Rattachez le paiement a un bien, un client, un bail ou une vente
              pour le retrouver ensuite et editer un recu.
            </p>
          </div>

          <FormMessage error={params.error} />

          <Card>
            <CardHeader>
              <CardTitle>Informations du paiement</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createPayment} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Montant (DA) *</Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="50000"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      name="date"
                      type="date"
                      defaultValue={toDateInputValue(new Date())}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Type de paiement *</Label>
                    <select id="type" name="type" required className={selectClass}>
                      <option value="">Sélectionnez...</option>
                      {Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="method">Mode de règlement *</Label>
                    <select
                      id="method"
                      name="method"
                      required
                      defaultValue="cash"
                      className={selectClass}
                    >
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Statut *</Label>
                    <select
                      id="status"
                      name="status"
                      required
                      defaultValue="paye"
                      className={selectClass}
                    >
                      {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="receipt">N&deg; de reçu externe</Label>
                    <Input id="receipt" name="receipt" placeholder="Facultatif" />
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">
                    Rattachement
                  </h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Facultatif, mais un paiement rattaché remonte
                    automatiquement dans la fiche du bien et du client.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="propertyId">Bien concerné</Label>
                      <select
                        id="propertyId"
                        name="propertyId"
                        defaultValue=""
                        className={selectClass}
                      >
                        <option value="">Aucun</option>
                        {properties.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="clientId">Client</Label>
                      <select
                        id="clientId"
                        name="clientId"
                        defaultValue=""
                        className={selectClass}
                      >
                        <option value="">Aucun</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.firstName} {c.lastName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ownerId">Propriétaire</Label>
                      <select
                        id="ownerId"
                        name="ownerId"
                        defaultValue=""
                        className={selectClass}
                      >
                        <option value="">Aucun</option>
                        {owners.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.firstName} {o.lastName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rentalId">Bail (location)</Label>
                      <select
                        id="rentalId"
                        name="rentalId"
                        defaultValue={params.rentalId ?? ""}
                        className={selectClass}
                      >
                        <option value="">Aucun</option>
                        {rentals.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.property.title} — {r.client.firstName} {r.client.lastName} (
                            {formatDZD(r.monthlyRent)}/mois)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="saleId">Vente</Label>
                      <select
                        id="saleId"
                        name="saleId"
                        defaultValue={params.saleId ?? ""}
                        className={selectClass}
                      >
                        <option value="">Aucune</option>
                        {sales.map((sale) => (
                          <option key={sale.id} value={sale.id}>
                            {sale.property.title} — {sale.client.firstName}{" "}
                            {sale.client.lastName} ({formatDZD(sale.finalPrice)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" rows={3} />
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="submit" className="bg-dar-ink hover:bg-dar-blue">
                    Enregistrer le paiement
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/agency/payments">Annuler</Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
