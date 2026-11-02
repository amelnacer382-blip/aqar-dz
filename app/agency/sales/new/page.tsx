import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { requireAgency } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { saleSchema } from "@/lib/validations"
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

const saleStatuses = [
  { value: "negociation", label: "Négociation" },
  { value: "compromis", label: "Compromis" },
  { value: "vendu", label: "Vendu" },
  { value: "annule", label: "Annulé" },
]

export const metadata: Metadata = { title: "Nouvelle vente" }

export default async function NewSalePage() {
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

  async function createSale(formData: FormData) {
    "use server"

    const BACK = "/agency/sales/new"
    const { agencyId } = await requireAgency()
    const parsed = parseForm(saleSchema, formData)

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

    await prisma.sale.create({
      // Le proprietaire vendeur est repris du bien : c'est lui qui figure
      // sur le compromis, inutile de le ressaisir.
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

    revalidatePath("/agency/sales")
    redirect(withSuccess("/agency/sales", "Vente enregistree"))
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/agency/sales">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux ventes
              </Link>
            </Button>
            <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Nouvelle vente</h1>
            <p className="text-slate-600 mt-1">
              Enregistrez une nouvelle transaction de vente
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Informations de la vente</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createSale} className="space-y-6">
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
                    <Label htmlFor="clientId">Client *</Label>
                    <Select name="clientId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un client" />
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
                    <Label htmlFor="finalPrice">Prix final (DA) *</Label>
                    <Input
                      id="finalPrice"
                      name="finalPrice"
                      type="number"
                      placeholder="10 000 000"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="commission">Commission (DA)</Label>
                    <Input
                      id="commission"
                      name="commission"
                      type="number"
                      placeholder="500 000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="saleDate">Date de vente *</Label>
                    <Input
                      id="saleDate"
                      name="saleDate"
                      type="date"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Statut *</Label>
                    <Select name="status" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un statut" />
                      </SelectTrigger>
                      <SelectContent>
                        {saleStatuses.map((status) => (
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
                    Créer la vente
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/agency/sales">Annuler</Link>
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
