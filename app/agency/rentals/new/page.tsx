import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { requireAgency } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { rentalSchema } from "@/lib/validations"
import { parseForm, withError, withSuccess } from "@/lib/form"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft } from "lucide-react"

const rentalStatuses = [
  { value: "active", label: "Actif" },
  { value: "terminee", label: "Terminée" },
  { value: "annulee", label: "Annulée" },
]

export const metadata: Metadata = { title: "Nouvelle location" }

export default async function NewRentalPage() {
  const { agencyId, userRole, userName } = await requireAgency()

  const properties = await prisma.property.findMany({
    where: { agencyId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  })

  const clients = await prisma.client.findMany({
    where: { agencyId },
    orderBy: { createdAt: "desc" },
    select: { id: true, firstName: true, lastName: true },
  })

  async function createRental(formData: FormData) {
    "use server"

    const BACK = "/agency/rentals/new"
    const { agencyId } = await requireAgency()
    const parsed = parseForm(rentalSchema, formData)

    if (!parsed.ok) {
      redirect(withError(BACK, parsed.message))
    }

    const data = parsed.data

    // Le bien et le client doivent appartenir a l'agence.
    const [property, client] = await Promise.all([
      prisma.property.findFirst({
        where: { id: data.propertyId, agencyId },
        select: { id: true, ownerId: true },
      }),
      prisma.client.findFirst({
        where: { id: data.clientId, agencyId },
        select: { id: true },
      }),
    ])

    if (!property || !client) {
      redirect(withError(BACK, "Bien ou client introuvable"))
    }

    await prisma.rental.create({
      // Le bailleur est celui du bien : il figure sur le contrat et recoit
      // les reversements de gestion locative.
      data: {
        ...data,
        /*
          Le proprietaire est DERIVE du bien, jamais recu du formulaire
          (BUG-39). L'ecran n'a jamais rendu ce champ ; la valeur ne pouvait
          donc venir que d'un POST forge, et elle etait ecrite sans aucune
          verification d'agence. Le bien, lui, est verifie juste au-dessus.
        */
        ownerId: property.ownerId,
        agencyId,
      },
    })

    revalidatePath("/agency/rentals")
    redirect(withSuccess("/agency/rentals", "Location enregistree"))
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/agency/rentals">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux locations
              </Link>
            </Button>
            <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Nouvelle location</h1>
            <p className="text-slate-600 mt-1">
              Enregistrez un nouveau bail de location
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Informations du bail</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createRental} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="propertyId">Bien *</Label>
                    <Select name="propertyId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un bien" />
                      </SelectTrigger>
                      <SelectContent>
                        {properties.map((property) => (
                          <SelectItem key={property.id} value={property.id}>
                            {property.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="clientId">Locataire *</Label>
                    <Select name="clientId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un locataire" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.firstName} {client.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="monthlyRent">Loyer mensuel (DA) *</Label>
                    <Input
                      id="monthlyRent"
                      name="monthlyRent"
                      type="number"
                      placeholder="50 000"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deposit">Caution (DA)</Label>
                    <Input
                      id="deposit"
                      name="deposit"
                      type="number"
                      placeholder="100 000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agencyFees">Frais d&apos;agence (DA)</Label>
                    <Input
                      id="agencyFees"
                      name="agencyFees"
                      type="number"
                      placeholder="25 000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="startDate">Date de début *</Label>
                    <Input
                      id="startDate"
                      name="startDate"
                      type="date"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endDate">Date de fin</Label>
                    <Input
                      id="endDate"
                      name="endDate"
                      type="date"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Statut *</Label>
                    <Select name="status" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un statut" />
                      </SelectTrigger>
                      <SelectContent>
                        {rentalStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="submit" className="bg-dar-ink hover:bg-dar-blue">
                    Créer la location
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/agency/rentals">Annuler</Link>
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
