import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { requireAgency } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { documentSchema, ADRESSE_REFUSEE } from "@/lib/validations"
import { ownsDocumentUrl } from "@/lib/documents"
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
import { DocumentUploadField } from "@/components/upload/DocumentUploadField"
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

export const metadata: Metadata = { title: "Nouveau document" }

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { userRole, userName } = await requireAgency()

  // Sans cela, un refus de validation renvoyait l'agence sur un
  // formulaire vierge, sans un mot : le motif n'existait que dans la
  // barre d'adresse. Vingt et une autres pages du depot affichent deja
  // leur retour de cette facon — les deux pages « documents » etaient
  // l'exception.
  const params = await searchParams

  async function createDocument(formData: FormData) {
    "use server"

    const { agencyId } = await requireAgency()

    // Le champ d'upload poste l'URL sous le nom documentUrl : on la remappe
    // vers `url`, le nom attendu par le schema de validation.
    formData.set("url", String(formData.get("documentUrl") ?? ""))

    const parsed = parseForm(documentSchema, formData)

    if (!parsed.ok) {
      redirect(withError("/agency/documents/new", parsed.message))
    }

    // Le schema a valide la FORME de l'adresse ; il ne sait pas qui la
    // poste. `/uploads/documents/<une-autre-agence>/x.pdf` la satisfait
    // parfaitement. L'appartenance ne peut etre verifiee qu'ici, et c'est
    // elle qui ferme le defaut — la forme n'en reduit que le bruit.
    //
    // Message et non 404 : l'utilisateur regarde son propre ecran.
    if (!ownsDocumentUrl(parsed.data.url, agencyId)) {
      redirect(withError("/agency/documents/new", ADRESSE_REFUSEE))
    }

    await prisma.document.create({
      data: { ...parsed.data, agencyId },
    })

    revalidatePath("/agency/documents")
    redirect(withSuccess("/agency/documents", "Document ajoute"))
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/agency/documents">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux documents
              </Link>
            </Button>
            <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Nouveau document</h1>
            <p className="text-slate-600 mt-1">
              Ajoutez un document à votre bibliothèque
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Informations du document</CardTitle>
            </CardHeader>
            <CardContent>
              <FormMessage error={params.error} />

              <form action={createDocument} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="name">Nom *</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Contrat de vente - Appartement F3"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Type *</Label>
                    <Select name="type" required>
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

                  <div className="space-y-2 md:col-span-2">
                    <Label>Document *</Label>
                    <DocumentUploadField />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="submit" className="bg-dar-ink hover:bg-dar-blue">
                    Créer le document
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/agency/documents">Annuler</Link>
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
