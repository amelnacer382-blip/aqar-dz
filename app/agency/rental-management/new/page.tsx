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
import { MONTH_NAMES, toNumber, formatDZD, periodLabel } from "@/lib/format"
import { rentalManagementSchema } from "@/lib/validations"
import { parseForm, withError, withSuccess } from "@/lib/form"

const BASE = "/agency/rental-management"

export const metadata: Metadata = { title: "Nouveau mois de gestion" }

export default async function NewRentalManagementPage({
  searchParams,
}: {
  searchParams: Promise<{
    rentalId?: string
    month?: string
    year?: string
    error?: string
  }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const params = await searchParams

  const now = new Date()
  const month = clamp(params.month, 1, 12, now.getMonth() + 1)
  const year = clamp(params.year, 2000, 2100, now.getFullYear())

  const rentals = await prisma.rental.findMany({
    where: { agencyId, status: "active" },
    orderBy: { createdAt: "desc" },
    include: {
      property: { select: { title: true, commission: true } },
      client: { select: { firstName: true, lastName: true } },
    },
  })

  const selected =
    rentals.find((r) => r.id === params.rentalId) ?? rentals[0] ?? null

  async function createRecord(formData: FormData) {
    "use server"
    const { agencyId } = await requireAgency()

    const parsed = parseForm(rentalManagementSchema, formData)
    const backTo = `${BASE}/new?rentalId=${formData.get("rentalId")}&month=${formData.get("month")}&year=${formData.get("year")}`

    if (!parsed.ok) {
      redirect(withError(backTo, parsed.message))
    }

    const data = parsed.data

    // Le bail doit appartenir a l'agence : sans ce controle, un identifiant
    // devine permettrait d'ecrire dans les donnees d'une autre agence.
    const rental = await prisma.rental.findFirst({
      where: { id: data.rentalId, agencyId },
      select: { id: true },
    })

    if (!rental) {
      redirect(withError(backTo, "Bail introuvable"))
    }

    const existing = await prisma.rentalManagement.findUnique({
      where: {
        rentalId_month_year: {
          rentalId: data.rentalId,
          month: data.month,
          year: data.year,
        },
      },
      select: { id: true },
    })

    if (existing) {
      redirect(
        withError(
          backTo,
          `Une quittance existe deja pour ${periodLabel(data.month, data.year)}`
        )
      )
    }

    const amountToOwner =
      data.rentAmount +
      (data.charges ?? 0) -
      (data.expenses ?? 0) -
      (data.commission ?? 0)

    await prisma.rentalManagement.create({
      data: {
        rentalId: data.rentalId,
        month: data.month,
        year: data.year,
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
        `Quittance enregistree pour ${periodLabel(data.month, data.year)}`
      )
    )
  }

  if (!selected) {
    return (
      <>
        <AgencyNavbar role={userRole} userName={userName} />
        <main className="limewash pt-16 min-h-screen">
          <div className="container mx-auto px-4 py-8 max-w-2xl">
            <Card>
              <CardContent className="text-center py-16">
                <h2 className="text-lg font-medium text-slate-900 mb-2">
                  Aucun bail actif
                </h2>
                <p className="text-slate-500 mb-6">
                  Vous devez d&apos;abord creer une location active.
                </p>
                <Button asChild>
                  <Link href="/agency/rentals/new">Nouvelle location</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </>
    )
  }

  const suggestedCommission = Math.round(
    (toNumber(selected.monthlyRent) * toNumber(selected.property.commission)) / 100
  )

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href={`${BASE}?month=${month}&year=${year}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour a la gestion locative
              </Link>
            </Button>
            <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">
              Saisir un loyer mensuel
            </h1>
            <p className="text-slate-600 mt-1">
              Enregistrez l&apos;encaissement du mois et le net a reverser au
              proprietaire.
            </p>
          </div>

          <FormMessage error={params.error} />

          <Card>
            <CardHeader>
              <CardTitle>Quittance de loyer</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createRecord} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="rentalId">Bail *</Label>
                    <select
                      id="rentalId"
                      name="rentalId"
                      defaultValue={selected.id}
                      required
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      {rentals.map((rental) => (
                        <option key={rental.id} value={rental.id}>
                          {rental.property.title} &mdash; {rental.client.firstName}{" "}
                          {rental.client.lastName} ({formatDZD(rental.monthlyRent)}/mois)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="month">Mois *</Label>
                    <select
                      id="month"
                      name="month"
                      defaultValue={month}
                      required
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      {MONTH_NAMES.map((label, index) => (
                        <option key={label} value={index + 1}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="year">Annee *</Label>
                    <Input
                      id="year"
                      name="year"
                      type="number"
                      min={2000}
                      max={2100}
                      defaultValue={year}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rentAmount">Loyer percu (DA) *</Label>
                    <Input
                      id="rentAmount"
                      name="rentAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={toNumber(selected.monthlyRent)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="charges">Charges recuperees (DA)</Label>
                    <Input id="charges" name="charges" type="number" step="0.01" min="0" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expenses">Depenses avancees (DA)</Label>
                    <Input id="expenses" name="expenses" type="number" step="0.01" min="0" />
                    <p className="text-xs text-slate-500">
                      Reparations, entretien... payes par l&apos;agence.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="commission">Commission agence (DA)</Label>
                    <Input
                      id="commission"
                      name="commission"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={suggestedCommission > 0 ? suggestedCommission : undefined}
                    />
                    {suggestedCommission > 0 && (
                      <p className="text-xs text-slate-500">
                        Calculee au taux de {toNumber(selected.property.commission)} % du bien.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paymentDate">Date d&apos;encaissement</Label>
                    <Input id="paymentDate" name="paymentDate" type="date" />
                  </div>

                  <div className="flex items-center gap-2 md:col-span-2">
                    <input
                      type="checkbox"
                      id="isPaid"
                      name="isPaid"
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <Label htmlFor="isPaid" className="font-normal">
                      Le loyer a ete encaisse
                    </Label>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea id="notes" name="notes" rows={3} />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="submit" className="bg-dar-ink hover:bg-dar-blue">
                    Enregistrer la quittance
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={`${BASE}?month=${month}&year=${year}`}>Annuler</Link>
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

function clamp(value: string | undefined, min: number, max: number, fallback: number) {
  const n = parseInt(value ?? "", 10)
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback
}
