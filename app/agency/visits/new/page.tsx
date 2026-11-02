import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { requireAgency } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { visitSchema } from "@/lib/validations"
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

const visitStatuses = [
  { value: "prevue", label: "Prévue" },
  { value: "effectuee", label: "Effectuée" },
  { value: "annulee", label: "Annulée" },
  { value: "reportee", label: "Reportée" },
]

export const metadata: Metadata = { title: "Nouvelle visite" }

export default async function NewVisitPage() {
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

  const agents = await prisma.user.findMany({
    where: { agencyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })

  async function createVisit(formData: FormData) {
    "use server"

    const { agencyId } = await requireAgency()
    const parsed = parseForm(visitSchema, formData)

    if (!parsed.ok) {
      redirect(withError("/agency/visits/new", parsed.message))
    }

    const data = parsed.data

    // Le bien et le client doivent appartenir a l'agence.
    const [property, client] = await Promise.all([
      prisma.property.findFirst({
        where: { id: data.propertyId, agencyId },
        select: { id: true },
      }),
      prisma.client.findFirst({
        where: { id: data.clientId, agencyId },
        select: { id: true },
      }),
    ])

    if (!property || !client) {
      redirect(withError("/agency/visits/new", "Bien ou client introuvable"))
    }

    await prisma.visit.create({
      data: { ...data, agencyId },
    })

    revalidatePath("/agency/visits")
    redirect(withSuccess("/agency/visits", "Visite planifiee"))
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/agency/visits">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux visites
              </Link>
            </Button>
            <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Nouvelle visite</h1>
            <p className="text-slate-600 mt-1">
              Planifiez une nouvelle visite
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Informations de la visite</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createVisit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      name="date"
                      type="date"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="time">Heure *</Label>
                    <Input
                      id="time"
                      name="time"
                      type="time"
                      required
                    />
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
                    <Label htmlFor="agentId">Agent</Label>
                    <Select name="agentId">
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un agent" />
                      </SelectTrigger>
                      <SelectContent>
                        {agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name || "Agent sans nom"}
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
                        {visitStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="result">Résultat</Label>
                    <Textarea
                      id="result"
                      name="result"
                      rows={3}
                      placeholder="Résultat de la visite..."
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      rows={3}
                      placeholder="Notes complémentaires..."
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="submit" className="bg-dar-ink hover:bg-dar-blue">
                    Créer la visite
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/agency/visits">Annuler</Link>
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
