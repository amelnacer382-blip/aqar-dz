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
import { GalleryUploadField } from "@/components/upload/GalleryUploadField"
import {
  PROPERTY_TYPE_LABELS,
  PROPERTY_CATEGORY_LABELS,
  PROPERTY_STATUS_LABELS,
  OPERATION_TYPE_LABELS,
} from "@/lib/labels"
import { propertySchema } from "@/lib/validations"
import { parseForm, withError, withSuccess } from "@/lib/form"
import { parseGalleryUrls } from "../gallery"
import { quotaBiens, refusDeQuota } from "@/lib/quotas"

const selectClass =
  "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"

export const metadata: Metadata = { title: "Nouveau bien" }

export default async function NewPropertyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const params = await searchParams

  /*
    LE PLAFOND EST LU AVANT LE FORMULAIRE, ET PAS SEULEMENT APRES.

    « La saisie n'est pas perdue » (FR-9) ne se tient pas avec un refus a
    l'envoi : une Server Action se termine par un `redirect`, qui vide le
    formulaire. La seule facon de ne rien perdre est de ne rien faire
    saisir — l'ecran annonce le plafond a la place du formulaire.

    Ce controle-ci est un CONFORT. La garde, celle qui compte, est dans
    `createProperty` : l'action est joignable sans cet ecran.
  */
  const quota = await quotaBiens(agencyId)

  const owners = await prisma.owner.findMany({
    where: { agencyId },
    orderBy: { lastName: "asc" },
    select: { id: true, firstName: true, lastName: true },
  })

  async function createProperty(formData: FormData) {
    "use server"
    const { agencyId } = await requireAgency()

    /*
      LA GARDE, ET PAS SEULEMENT L'ECRAN (FR-9). Cette action est un point
      d'entree POST joignable sans le formulaire qui la rend : masquer le
      formulaire ne refuse rien.

      Le decompte est relu ICI, au moment de l'action, et pas repris de
      celui calcule au rendu : entre les deux, un second onglet a pu creer
      le bien qui remplit la derniere place.
    */
    const quota = await quotaBiens(agencyId)

    if (quota.atteint) {
      redirect(
        withError("/agency/properties/new", refusDeQuota(quota, "bien"))
      )
    }

    const parsed = parseForm(propertySchema, formData)

    if (!parsed.ok) {
      redirect(withError("/agency/properties/new", parsed.message))
    }

    const data = parsed.data

    if (data.ownerId) {
      const owner = await prisma.owner.findFirst({
        where: { id: data.ownerId, agencyId },
        select: { id: true },
      })
      if (!owner) {
        redirect(withError("/agency/properties/new", "Propriétaire introuvable"))
      }
    }

    const urls = parseGalleryUrls(formData.get("imageUrls"))

    await prisma.property.create({
      data: {
        title: data.title,
        category: data.category,
        type: data.type,
        operationType: data.operationType,
        status: data.status,
        wilaya: data.wilaya,
        commune: data.commune,
        quartier: data.quartier,
        address: data.address,
        surface: data.surface,
        rooms: data.rooms,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        floor: data.floor,
        totalFloors: data.totalFloors,
        salePrice: data.salePrice,
        rentPrice: data.rentPrice,
        commission: data.commission,
        shortDescription: data.shortDescription,
        description: data.description,
        ownerId: data.ownerId,
        hasGarage: data.hasGarage,
        hasGarden: data.hasGarden,
        hasTerrace: data.hasTerrace,
        isFurnished: data.isFurnished,
        agencyId,
        images: {
          create: urls.map((url, index) => ({
            url,
            isMain: index === 0,
            sortOrder: index,
          })),
        },
      },
    })

    revalidatePath("/agency/properties")
    redirect(withSuccess("/agency/properties", "Bien créé"))
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/agency/properties">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux biens
              </Link>
            </Button>
            <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Nouveau bien</h1>
            <p className="text-slate-600 mt-1">
              Ajoutez un bien à votre portefeuille
            </p>
          </div>

          <FormMessage error={params.error} />

          {quota.atteint ? (
            /*
              Le formulaire n'est pas affiche du tout : rien ne se saisit,
              donc rien ne se perd (FR-9). Et le ton reste factuel — la
              situation est legitime, l'agence garde tout ce qu'elle a
              (FR-12), elle ne peut simplement pas en ajouter.
            */
            <Card>
              <CardHeader>
                <CardTitle>Plafond de biens atteint</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="leading-relaxed text-slate-700">
                  {refusDeQuota(quota, "bien")}
                </p>
                <p className="text-sm leading-relaxed text-slate-500">
                  Vos {quota.decompte} biens restent en place et modifiables.
                  Envoyer un bien à la corbeille libère aussitôt une place.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href="/agency/properties">Voir mes biens</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/agency/settings">Voir mon offre</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
          <Card>
            <CardHeader>
              <CardTitle>Informations du bien</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createProperty} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="title">Titre du bien *</Label>
                    <Input
                      id="title"
                      name="title"
                      placeholder="Ex : Magnifique appartement F3 à Alger Centre"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Catégorie *</Label>
                    <select id="category" name="category" required className={selectClass}>
                      <option value="">Sélectionnez...</option>
                      {Object.entries(PROPERTY_CATEGORY_LABELS).map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Type de bien *</Label>
                    <select id="type" name="type" required className={selectClass}>
                      <option value="">Sélectionnez...</option>
                      {Object.entries(PROPERTY_TYPE_LABELS).map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="operationType">Type d&apos;opération *</Label>
                    <select
                      id="operationType"
                      name="operationType"
                      required
                      className={selectClass}
                    >
                      <option value="">Sélectionnez...</option>
                      {Object.entries(OPERATION_TYPE_LABELS).map(([value, text]) => (
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
                      defaultValue="disponible"
                      className={selectClass}
                    >
                      {Object.entries(PROPERTY_STATUS_LABELS).map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="wilaya">Wilaya *</Label>
                    <Input id="wilaya" name="wilaya" placeholder="Alger" required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="commune">Commune *</Label>
                    <Input id="commune" name="commune" placeholder="Alger Centre" required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quartier">Quartier</Label>
                    <Input id="quartier" name="quartier" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Adresse</Label>
                    <Input id="address" name="address" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="surface">Surface (m²)</Label>
                    <Input id="surface" name="surface" type="number" step="0.1" min="0" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rooms">Pièces</Label>
                    <Input id="rooms" name="rooms" type="number" min="0" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bedrooms">Chambres</Label>
                    <Input id="bedrooms" name="bedrooms" type="number" min="0" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bathrooms">Salles de bain</Label>
                    <Input id="bathrooms" name="bathrooms" type="number" min="0" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="floor">Étage</Label>
                    <Input id="floor" name="floor" type="number" min="0" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="totalFloors">Nombre d&apos;étages</Label>
                    <Input id="totalFloors" name="totalFloors" type="number" min="0" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="salePrice">Prix de vente (DA)</Label>
                    <Input id="salePrice" name="salePrice" type="number" min="0" />
                    <p className="text-xs text-slate-500">
                      Obligatoire pour un bien en vente.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rentPrice">Loyer (DA/mois)</Label>
                    <Input id="rentPrice" name="rentPrice" type="number" min="0" />
                    <p className="text-xs text-slate-500">
                      Obligatoire pour une location ou une gestion locative.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="commission">Commission (%)</Label>
                    <Input
                      id="commission"
                      name="commission"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="2.5"
                    />
                    <p className="text-xs text-slate-500">
                      Sert au calcul automatique des commissions de gestion.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ownerId">Propriétaire</Label>
                    <select
                      id="ownerId"
                      name="ownerId"
                      defaultValue=""
                      className={selectClass}
                    >
                      <option value="">Aucun</option>
                      {owners.map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.firstName} {owner.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="shortDescription">Description courte</Label>
                    <Input
                      id="shortDescription"
                      name="shortDescription"
                      placeholder="Résumé en une ligne, affiché sur la vitrine"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Description complète</Label>
                    <Textarea id="description" name="description" rows={5} />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Photos du bien</Label>
                    <GalleryUploadField name="imageUrls" />
                  </div>

                  <div className="flex flex-wrap gap-6 md:col-span-2">
                    {[
                      ["hasGarage", "Garage"],
                      ["hasGarden", "Jardin"],
                      ["hasTerrace", "Terrasse"],
                      ["isFurnished", "Meublé"],
                    ].map(([field, text]) => (
                      <div key={field} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={field}
                          name={field}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <Label htmlFor={field} className="font-normal">
                          {text}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="submit" className="bg-dar-ink hover:bg-dar-blue">
                    Créer le bien
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/agency/properties">Annuler</Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          )}
        </div>
      </main>
    </>
  )
}
