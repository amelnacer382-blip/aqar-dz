import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireAgency, requireAgencyAdmin, isAgencyAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { FormMessage } from "@/components/FormMessage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, FileDown, Trash2 } from "lucide-react"
import { toNumber, toDateInputValue, periodLabel, formatDZD } from "@/lib/format"
import { rentalManagementSchema } from "@/lib/validations"
import { parseForm, withError, withSuccess } from "@/lib/form"

const BASE = "/agency/rental-management"

export default async function EditRentalManagementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ month?: string; year?: string; error?: string }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const { id } = await params
  const query = await searchParams

  const record = await prisma.rentalManagement.findFirst({
    where: { id, rental: { agencyId } },
    include: {
      rental: {
        include: {
          property: { select: { title: true } },
          client: { select: { firstName: true, lastName: true } },
          owner: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })

  if (!record) {
    notFound()
  }

  const backTo = `${BASE}?month=${query.month ?? record.month}&year=${query.year ?? record.year}`

  async function updateRecord(formData: FormData) {
    "use server"
    const { agencyId } = await requireAgency()

    const { id } = await params
    const parsed = parseForm(rentalManagementSchema, formData)

    if (!parsed.ok) {
      redirect(withError(`${BASE}/${id}/edit`, parsed.message))
    }

    const data = parsed.data

    const owned = await prisma.rentalManagement.findFirst({
      where: { id, rental: { agencyId } },
      select: { id: true },
    })

    if (!owned) {
      redirect(withError(BASE, "Quittance introuvable"))
    }

    const amountToOwner =
      data.rentAmount +
      (data.charges ?? 0) -
      (data.expenses ?? 0) -
      (data.commission ?? 0)

    await prisma.rentalManagement.update({
      where: { id },
      data: {
        rentAmount: data.rentAmount,
        charges: data.charges,
        expenses: data.expenses,
        commission: data.commission,
        amountToOwner,
        isPaid: data.isPaid,
        paymentDate: data.isPaid ? data.paymentDate ?? new Date() : null,
        notes: data.notes,
      },
    })

    revalidatePath(BASE)
    redirect(
      withSuccess(
        `${BASE}?month=${data.month}&year=${data.year}`,
        "Quittance mise a jour"
      )
    )
  }

  /**
   * Suppression d'une echeance de gestion locative.
   *
   * AUCUNE ROUTE D'API HOMOLOGUE : contrairement au bien, a la visite et au
   * paiement, aucune regle n'etait deja ecrite ailleurs dans le code. Elle
   * a donc ete TRANCHEE, le 12-08-2026, par delegation explicite de
   * l'editeur : reservee a l'ADMINISTRATEUR.
   *
   * Le motif, parce qu'il ne se devine pas dans six mois : une echeance est
   * une ligne comptable. La supprimer fausse le decompte du net a reverser
   * au proprietaire, et l'erreur ne se voit qu'au moment du versement,
   * c'est-a-dire chez le proprietaire. Le cout d'une permission trop
   * etroite est un agent qui demande a son administrateur ; le cout de
   * l'inverse est un litige.
   *
   * UNE ECHEANCE REGLEE NE SE SUPPRIME PAS (REP-14, story 3.10). Le role
   * etait jusqu'ici la SEULE condition verifiee : `isPaid`, `paymentDate`
   * et `amountToOwner` n'etaient ni lus ni controles. Or la contrainte
   * `@@unique([rentalId, month, year])` redevient libre a la suppression —
   * une nouvelle ligne peut donc etre creee pour la meme periode, sans
   * aucun lien avec la disparue, et la trace du versement au proprietaire
   * n'existe plus nulle part. C'est exactement le scenario que la docstring
   * ci-dessus nomme deja comme motif du controle de role.
   *
   * ARBITRAGE, rendu le 17-08-2026 par delegation explicite de l'editeur :
   * REFUSER. Une echeance non reglee est une prevision, on peut la jeter ;
   * une echeance reglee est la trace d'un versement, et rien d'autre ne la
   * porte. La troisieme issue — permettre la suppression derriere une
   * confirmation — n'est pas ecartee sur le fond : elle appartient a la
   * story 3.13, qui pose le dispositif pour tout le produit. Une
   * confirmation inventee ici seulement serait la dixieme.
   */
  async function deleteRecord() {
    "use server"
    const { agencyId, userId, userName } = await requireAgencyAdmin()
    const { id } = await params

    const owned = await prisma.rentalManagement.findFirst({
      where: { id, rental: { agencyId } },
      select: { id: true, month: true, year: true, isPaid: true },
    })

    if (!owned) {
      redirect(withError(BASE, "Quittance introuvable"))
    }

    if (owned.isPaid) {
      redirect(
        withError(
          `${BASE}/${id}/edit`,
          "Cette échéance est réglée : elle ne peut plus être supprimée. Marquez-la comme non réglée si le versement n'a pas eu lieu."
        )
      )
    }

    await prisma.rentalManagement.delete({ where: { id } })

    await recordAudit({
      agencyId,
      userId,
      userName,
      action: "suppression",
      entity: "gestion locative",
      entityId: id,
      summary: `Échéance de ${periodLabel(owned.month, owned.year)} supprimée définitivement`,
    })

    revalidatePath(BASE)
    redirect(
      withSuccess(`${BASE}?month=${owned.month}&year=${owned.year}`, "Quittance supprimee")
    )
  }

  const netToOwner =
    toNumber(record.rentAmount) +
    toNumber(record.charges) -
    toNumber(record.expenses) -
    toNumber(record.commission)

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href={backTo}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour a la gestion locative
              </Link>
            </Button>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">
                  {periodLabel(record.month, record.year)}
                </h1>
                <p className="text-slate-600 mt-1">
                  {record.rental.property.title} &mdash;{" "}
                  {record.rental.client.firstName} {record.rental.client.lastName}
                </p>
              </div>
              <Button asChild variant="outline">
                <a
                  href={`/api/pdf/receipt/${record.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Quittance PDF
                </a>
              </Button>
            </div>
          </div>

          <FormMessage error={query.error} />

          <Card>
            <CardHeader>
              <CardTitle>
                Detail du mois &mdash; net proprietaire actuel : {formatDZD(netToOwner)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateRecord} className="space-y-6">
                <input type="hidden" name="rentalId" value={record.rentalId} />
                <input type="hidden" name="month" value={record.month} />
                <input type="hidden" name="year" value={record.year} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="rentAmount">Loyer percu (DA) *</Label>
                    <Input
                      id="rentAmount"
                      name="rentAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={toNumber(record.rentAmount)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="charges">Charges recuperees (DA)</Label>
                    <Input
                      id="charges"
                      name="charges"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={record.charges ? toNumber(record.charges) : undefined}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expenses">Depenses avancees (DA)</Label>
                    <Input
                      id="expenses"
                      name="expenses"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={record.expenses ? toNumber(record.expenses) : undefined}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="commission">Commission agence (DA)</Label>
                    <Input
                      id="commission"
                      name="commission"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={
                        record.commission ? toNumber(record.commission) : undefined
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paymentDate">Date d&apos;encaissement</Label>
                    <Input
                      id="paymentDate"
                      name="paymentDate"
                      type="date"
                      defaultValue={toDateInputValue(record.paymentDate)}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isPaid"
                      name="isPaid"
                      defaultChecked={record.isPaid}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <Label htmlFor="isPaid" className="font-normal">
                      Le loyer a ete encaisse
                    </Label>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      rows={3}
                      defaultValue={record.notes ?? ""}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 pt-4">
                  <Button type="submit" className="bg-dar-ink hover:bg-dar-blue">
                    Enregistrer
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={backTo}>Annuler</Link>
                  </Button>
                </div>
              </form>

              {/* Le bouton ne s'affiche qu'a qui peut l'actionner — et ce
                  n'est JAMAIS la mesure, seulement la seconde. Le refus est
                  pose dans l'action elle-meme, qui reste joignable en POST
                  sans cet ecran ; le masquage evite de proposer a un agent
                  un geste qui lui sera refuse. */}
              {isAgencyAdmin(userRole) && (
                <form action={deleteRecord} className="mt-8 border-t border-slate-200 pt-6">
                  <Button
                    type="submit"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer cette quittance
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
