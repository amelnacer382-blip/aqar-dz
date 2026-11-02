import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { requireAgency } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { clientSchema } from "@/lib/validations"
import { parseForm, withError, withSuccess } from "@/lib/form"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft } from "lucide-react"

const clientTypes = [
  { value: "acheteur", label: "Acheteur" },
  { value: "locataire", label: "Locataire" },
  { value: "investisseur", label: "Investisseur" },
  { value: "interesse", label: "Intéressé" },
]

const clientStatuses = [
  { value: "nouveau", label: "Nouveau" },
  { value: "interesse", label: "Intéressé" },
  { value: "visite_prevue", label: "Visite prévue" },
  { value: "client_chaud", label: "Client chaud" },
  { value: "conclu", label: "Conclu" },
  { value: "perdu", label: "Perdu" },
]

const categories = [
  { value: "residentiel", label: "Résidentiel" },
  { value: "commercial", label: "Commercial" },
  { value: "professionnel", label: "Professionnel" },
  { value: "industriel", label: "Industriel" },
  { value: "touristique", label: "Touristique" },
  { value: "agricole", label: "Agricole" },
]

const propertyTypes = [
  { value: "appartement", label: "Appartement" },
  { value: "villa", label: "Villa" },
  { value: "studio", label: "Studio" },
  { value: "duplex", label: "Duplex" },
  { value: "maison", label: "Maison" },
  { value: "terrain_constructible", label: "Terrain constructible" },
  { value: "local_commercial", label: "Local commercial" },
  { value: "boutique", label: "Boutique" },
  { value: "bureau", label: "Bureau" },
  { value: "hangar", label: "Hangar" },
  { value: "entrepot", label: "Entrepôt" },
]

export const metadata: Metadata = { title: "Nouveau client" }

export default async function NewClientPage() {
  const { userRole, userName } = await requireAgency()

  async function createClient(formData: FormData) {
    "use server"

    const { agencyId } = await requireAgency()
    const parsed = parseForm(clientSchema, formData)

    if (!parsed.ok) {
      redirect(withError("/agency/clients/new", parsed.message))
    }

    await prisma.client.create({
      data: { ...parsed.data, agencyId },
    })

    revalidatePath("/agency/clients")
    redirect(withSuccess("/agency/clients", "Client cree"))
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/agency/clients">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux clients
              </Link>
            </Button>
            <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Nouveau client</h1>
            <p className="text-slate-600 mt-1">
              Ajoutez un client à votre base de données
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Informations du client</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createClient} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Prénom *</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      placeholder="Karim"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nom *</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      placeholder="Merad"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="0550 123 456"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="karim@exemple.dz"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Type de client *</Label>
                    <Select name="type" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un type" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Statut *</Label>
                    <Select name="status" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un statut" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="budget">Budget (DA)</Label>
                    <Input
                      id="budget"
                      name="budget"
                      type="number"
                      placeholder="10 000 000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="wilaya">Wilaya recherchée</Label>
                    <Input
                      id="wilaya"
                      name="wilaya"
                      placeholder="Alger"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Catégorie recherchée</Label>
                    <Select name="category">
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez une catégorie" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="propertyType">Type de bien recherché</Label>
                    <Select name="propertyType">
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un type" />
                      </SelectTrigger>
                      <SelectContent>
                        {propertyTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      rows={4}
                      placeholder="Informations complémentaires sur le client..."
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="submit" className="bg-dar-ink hover:bg-dar-blue">
                    Créer le client
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/agency/clients">Annuler</Link>
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
