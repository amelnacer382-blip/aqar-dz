import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { requireAgency } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { documentSchema } from "@/lib/validations"
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
import { FormMessage } from "@/components/FormMessage"

const documentTypes = [
  { value: "contrat_vente", label: "Contrat de vente" },
  { value: "contrat_location", label: "Contrat de location" },
  { value: "recu_paiement", label: "Reçu de paiement" },
  { value: "fiche_bien", label: "Fiche bien" },
  { value: "rapport_proprietaire", label: "Rapport propriétaire" },
  { value: "piece_identite", label: "Pièce d'identité" },
  { value: "acte_propriete", label: "Acte de propriété" },
  { value: "image_bien", label: "Image bien" },
  { value: "plan_bien", label: "Plan bien" },
]

export default async function EditDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const retour = await searchParams
  const { agencyId, userRole, userName } = await requireAgency()
  const { id } = await params

  const document = await prisma.document.findFirst({
    where: { id, agencyId },
  })

  if (!document) {
    notFound()
  }

  async function updateDocument(formData: FormData) {
    "use server"

    const { agencyId } = await requireAgency()

    // `url` est retire du schema : une valeur postee a la main n'est pas
    // seulement refusee, elle n'existe pas pour cette action. Le fichier
    // est fixe au depot.
    const parsed = parseForm(documentSchema.omit({ url: true }), formData)

    if (!parsed.ok) {
      redirect(withError(`/agency/documents/${id}/edit`, parsed.message))
    }

    const updated = await prisma.document.updateMany({
      where: { id, agencyId },
      data: parsed.data,
    })

    if (updated.count === 0) {
      redirect(withError("/agency/documents", "Document introuvable"))
    }

    revalidatePath(`/agency/documents/${id}`)
    redirect(withSuccess(`/agency/documents/${id}`, "Document mis a jour"))
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href={`/agency/documents/${id}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour au document
              </Link>
            </Button>
            <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Modifier le document</h1>
            <p className="text-slate-600 mt-1">{document.name}</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Informations du document</CardTitle>
            </CardHeader>
            <CardContent>
              <FormMessage error={retour.error} />

              <form action={updateDocument} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="name">Nom *</Label>
                    <Input
                      id="name"
                      name="name"
                      defaultValue={document.name}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Type *</Label>
                    <Select name="type" defaultValue={document.type} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un type" />
                      </SelectTrigger>
                      <SelectContent>
                        {documentTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mimeType">Type MIME</Label>
                    <Input
                      id="mimeType"
                      name="mimeType"
                      defaultValue={document.mimeType || ""}
                    />
                  </div>

                  {/* Le fichier d'un document n'est pas modifiable.
                      Ce champ affichait l'adresse de stockage en clair et
                      la laissait reecrire. La story 1.3 avait deja neutralise
                      ce que cela permettait — `documentKeyFor` refuse a la
                      lecture comme a la suppression le fichier d'une autre
                      agence — mais la surface restait, et il n'y a aucune
                      raison de la garder : changer de fichier, c'est
                      deposer un autre document.
                      Le champ etait de surcroit inutilisable : un
                      type="url" sur une adresse relative fait refuser
                      l'envoi par le navigateur, donc cette fiche ne
                      s'enregistrait pas du tout en mode local. */}

                  <div className="space-y-2">
                    <Label htmlFor="size">Taille (bytes)</Label>
                    <Input
                      id="size"
                      name="size"
                      type="number"
                      defaultValue={document.size || ""}
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="submit" className="bg-dar-ink hover:bg-dar-blue">
                    Enregistrer les modifications
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={`/agency/documents/${id}`}>Annuler</Link>
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
