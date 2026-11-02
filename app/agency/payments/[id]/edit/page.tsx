import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireAgency, requireAgencyAdmin, isAgencyAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { optionsParent, vivantsEtCourant } from "@/lib/corbeille"
import { recordAudit } from "@/lib/audit"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { FormMessage } from "@/components/FormMessage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, FileDown, Trash2 } from "lucide-react"
import { formatDZD, toDateInputValue, toNumber } from "@/lib/format"
import {
  PAYMENT_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/labels"
import { paymentSchema } from "@/lib/validations"
import { parseForm, withError, withSuccess } from "@/lib/form"
import { verifyPaymentLinks } from "../../verify-links"

const selectClass =
  "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"

export default async function EditPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const { id } = await params
  const query = await searchParams

  const payment = await prisma.payment.findFirst({ where: { id, agencyId } })

  if (!payment) {
    notFound()
  }

  /**
   * Le parent mis a la corbeille reste dans la liste, etiquete (BUG-34).
   * Sans lui, aucune option ne correspond au `defaultValue` et enregistrer
   * sans rien changer reecrit le lien. Voir `lib/corbeille.ts`.
   *
   * C'est l'ecran qui gagne le plus a la requete unique de la story 3.10 :
   * il portait TROIS requetes supplementaires par affichage, une par
   * rattachement, payees meme quand les trois parents sont vivants.
   */
  const [properties, clients, owners, rentals, sales] = await Promise.all([
    prisma.property.findMany({
      where: { agencyId, ...vivantsEtCourant(payment.propertyId) },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, deletedAt: true },
    }),
    prisma.client.findMany({
      where: { agencyId, ...vivantsEtCourant(payment.clientId) },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true, deletedAt: true },
    }),
    prisma.owner.findMany({
      where: { agencyId, ...vivantsEtCourant(payment.ownerId) },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true, deletedAt: true },
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

  const biens = optionsParent(properties, (p) => p.title, payment.propertyId)
  const contacts = optionsParent(
    clients,
    (c) => `${c.firstName} ${c.lastName}`,
    payment.clientId
  )
  const bailleurs = optionsParent(
    owners,
    (o) => `${o.firstName} ${o.lastName}`,
    payment.ownerId
  )

  // Captures comme VALEURS, pour le controle des liens inchanges.
  const liensCourants = {
    propertyId: payment.propertyId,
    clientId: payment.clientId,
    ownerId: payment.ownerId,
  }

  async function updatePayment(formData: FormData) {
    "use server"
    const { agencyId } = await requireAgency()
    const { id } = await params

    const parsed = parseForm(paymentSchema, formData)

    if (!parsed.ok) {
      redirect(withError(`/agency/payments/${id}/edit`, parsed.message))
    }

    const data = parsed.data

    const owned = await prisma.payment.findFirst({
      where: { id, agencyId },
      select: { id: true },
    })

    if (!owned) {
      redirect(withError("/agency/payments", "Paiement introuvable"))
    }

    const links = await verifyPaymentLinks(agencyId, data, liensCourants)

    if (!links.ok) {
      redirect(withError(`/agency/payments/${id}/edit`, links.error))
    }

    await prisma.payment.update({
      where: { id },
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
      },
    })

    revalidatePath("/agency/payments")
    redirect(withSuccess("/agency/payments", "Paiement mis à jour"))
  }

  /**
   * Suppression definitive d'un paiement, alignee sur sa route d'API.
   *
   * Meme constat que pour la visite : aucun controle de role, aucun
   * journal, la ou `POST /api/payments/[id]/delete` exige l'administrateur
   * et journalise (BUG-32). Un paiement est une piece comptable — sa
   * disparition silencieuse est exactement ce que le journal existe pour
   * empecher.
   */
  async function deletePayment() {
    "use server"
    const { agencyId, userId, userName } = await requireAgencyAdmin()
    const { id } = await params

    const owned = await prisma.payment.findFirst({
      where: { id, agencyId },
      select: { id: true, reference: true, amount: true },
    })

    if (!owned) {
      redirect(withError("/agency/payments", "Paiement introuvable"))
    }

    await prisma.payment.delete({ where: { id } })

    await recordAudit({
      agencyId,
      userId,
      userName,
      action: "suppression",
      entity: "paiement",
      entityId: id,
      summary: `Paiement de ${formatDZD(owned.amount)} (${owned.reference}) supprimé définitivement`,
    })

    revalidatePath("/agency/payments")
    redirect(withSuccess("/agency/payments", "Paiement supprimé"))
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
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">
                  Modifier le paiement
                </h1>
                <p className="text-slate-600 mt-1">
                  {formatDZD(payment.amount)} — réf.{" "}
                  {payment.reference.slice(-8).toUpperCase()}
                </p>
              </div>
              <Button asChild variant="outline">
                <a
                  href={`/api/pdf/payment/${payment.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Reçu PDF
                </a>
              </Button>
            </div>
          </div>

          <FormMessage error={query.error} />

          <Card>
            <CardHeader>
              <CardTitle>Informations du paiement</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updatePayment} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Montant (DA) *</Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={toNumber(payment.amount)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      name="date"
                      type="date"
                      defaultValue={toDateInputValue(payment.date)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Type de paiement *</Label>
                    <select
                      id="type"
                      name="type"
                      required
                      defaultValue={payment.type}
                      className={selectClass}
                    >
                      {Object.entries(PAYMENT_TYPE_LABELS).map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
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
                      defaultValue={payment.method}
                      className={selectClass}
                    >
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
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
                      defaultValue={payment.status}
                      className={selectClass}
                    >
                      {Object.entries(PAYMENT_STATUS_LABELS).map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="receipt">N&deg; de reçu externe</Label>
                    <Input
                      id="receipt"
                      name="receipt"
                      defaultValue={payment.receipt ?? ""}
                    />
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-4">
                    Rattachement
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="propertyId">Bien concerné</Label>
                      <select
                        id="propertyId"
                        name="propertyId"
                        defaultValue={payment.propertyId ?? ""}
                        className={selectClass}
                      >
                        <option value="">Aucun</option>
                        {biens.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="clientId">Client</Label>
                      <select
                        id="clientId"
                        name="clientId"
                        defaultValue={payment.clientId ?? ""}
                        className={selectClass}
                      >
                        <option value="">Aucun</option>
                        {contacts.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ownerId">Propriétaire</Label>
                      <select
                        id="ownerId"
                        name="ownerId"
                        defaultValue={payment.ownerId ?? ""}
                        className={selectClass}
                      >
                        <option value="">Aucun</option>
                        {bailleurs.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rentalId">Bail (location)</Label>
                      <select
                        id="rentalId"
                        name="rentalId"
                        defaultValue={payment.rentalId ?? ""}
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
                        defaultValue={payment.saleId ?? ""}
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
                  <Textarea
                    id="notes"
                    name="notes"
                    rows={3}
                    defaultValue={payment.notes ?? ""}
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="submit" className="bg-dar-ink hover:bg-dar-blue">
                    Enregistrer
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/agency/payments">Annuler</Link>
                  </Button>
                </div>
              </form>

              {/* Le bouton ne s'affiche qu'a qui peut l'actionner — et ce
                  n'est JAMAIS la mesure, seulement la seconde. Le refus est
                  pose dans l'action elle-meme, qui reste joignable en POST
                  sans cet ecran ; le masquage evite de proposer a un agent
                  un geste qui lui sera refuse. */}
              {isAgencyAdmin(userRole) && (
                <form action={deletePayment} className="mt-8 border-t border-slate-200 pt-6">
                  <Button
                    type="submit"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer ce paiement
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
