import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { requireAgency } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { ownerSchema } from "@/lib/validations"
import { parseForm, withError, withSuccess } from "@/lib/form"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft } from "lucide-react"

export default async function EditOwnerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const { id } = await params

  const owner = await prisma.owner.findFirst({
    where: { id, agencyId },
  })

  if (!owner) {
    notFound()
  }

  async function updateOwner(formData: FormData) {
    "use server"

    const { agencyId } = await requireAgency()
    const parsed = parseForm(ownerSchema, formData)

    if (!parsed.ok) {
      redirect(withError(`/agency/owners/${id}/edit`, parsed.message))
    }

    const updated = await prisma.owner.updateMany({
      where: { id, agencyId },
      data: parsed.data,
    })

    if (updated.count === 0) {
      redirect(withError("/agency/owners", "Proprietaire introuvable"))
    }

    revalidatePath(`/agency/owners/${id}`)
    redirect(withSuccess(`/agency/owners/${id}`, "Proprietaire mis a jour"))
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href={`/agency/owners/${id}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour au propriétaire
              </Link>
            </Button>
            <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Modifier le propriétaire</h1>
            <p className="text-slate-600 mt-1">
              {owner.firstName} {owner.lastName}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Informations du propriétaire</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateOwner} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Prénom *</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      defaultValue={owner.firstName}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nom *</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      defaultValue={owner.lastName}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      defaultValue={owner.phone || ""}
                      placeholder="0550 123 456"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      defaultValue={owner.email || ""}
                      placeholder="mohamed@exemple.dz"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="idCardNumber">Numéro de carte d&apos;identité</Label>
                    <Input
                      id="idCardNumber"
                      name="idCardNumber"
                      defaultValue={owner.idCardNumber || ""}
                      placeholder="1234567890"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Adresse</Label>
                    <Input
                      id="address"
                      name="address"
                      defaultValue={owner.address || ""}
                      placeholder="123 Rue Example, Alger"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      rows={4}
                      defaultValue={owner.notes || ""}
                      placeholder="Informations complémentaires..."
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="submit" className="bg-dar-ink hover:bg-dar-blue">
                    Enregistrer les modifications
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={`/agency/owners/${id}`}>Annuler</Link>
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
