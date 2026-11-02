import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireAgency, requireAgencyAdmin, isAgencyAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { optionsParent, vivantsEtCourant, lienInchange } from "@/lib/corbeille"
import { recordAudit } from "@/lib/audit"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { FormMessage } from "@/components/FormMessage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, FileDown, Trash2 } from "lucide-react"
import { GalleryUploadField } from "@/components/upload/GalleryUploadField"
import { toNumber } from "@/lib/format"
import {
  PROPERTY_TYPE_LABELS,
  PROPERTY_CATEGORY_LABELS,
  PROPERTY_STATUS_LABELS,
  OPERATION_TYPE_LABELS,
} from "@/lib/labels"
import { propertySchema } from "@/lib/validations"
import { parseForm, withError, withSuccess } from "@/lib/form"
import { parseGalleryUrls } from "../../gallery"

const selectClass =
  "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"

export default async function EditPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const { id } = await params
  const query = await searchParams

  const property = await prisma.property.findFirst({
    where: { id, agencyId },
    include: { images: { orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }] } },
  })

  if (!property) {
    notFound()
  }

  /**
   * Le parent mis a la corbeille reste dans la liste, etiquete (BUG-34).
   * Sans lui, aucune option ne correspond au `defaultValue` et enregistrer
   * sans rien changer reecrit le lien. Voir `lib/corbeille.ts` — et pour la
   * raison qui fait que cette liste tient en UNE requete.
   */
  const owners = await prisma.owner.findMany({
    where: { agencyId, ...vivantsEtCourant(property.ownerId) },
    orderBy: { lastName: "asc" },
    select: { id: true, firstName: true, lastName: true, deletedAt: true },
  })

  const bailleurs = optionsParent(
    owners,
    (o) => `${o.firstName} ${o.lastName}`,
    property.ownerId
  )
  const bailleurCourant = property.ownerId

  async function updateProperty(formData: FormData) {
    "use server"
    const { agencyId } = await requireAgency()
    const { id } = await params

    const parsed = parseForm(propertySchema, formData)

    if (!parsed.ok) {
      redirect(withError(`/agency/properties/${id}/edit`, parsed.message))
    }

    const data = parsed.data

    const owned = await prisma.property.findFirst({
      where: { id, agencyId },
      select: { id: true },
    })

    if (!owned) {
      redirect(withError("/agency/properties", "Bien introuvable"))
    }

    if (data.ownerId) {
      const owner = await prisma.owner.findFirst({
        where: {
          id: data.ownerId,
          agencyId,
          // Inchange : on accepte le proprietaire meme en corbeille.
          deletedAt: lienInchange(data.ownerId, bailleurCourant)
            ? undefined
            : null,
        },
        select: { id: true },
      })
      if (!owner) {
        redirect(withError(`/agency/properties/${id}/edit`, "Propriétaire introuvable"))
      }
    }

    const urls = parseGalleryUrls(formData.get("imageUrls"))

    // La galerie est remplacee en bloc : le formulaire porte l'etat complet
    // (ordre compris), donc on repart de zero plutot que de tenter un diff.
    await prisma.$transaction([
      prisma.property.update({
        where: { id },
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
        },
      }),
      prisma.propertyImage.deleteMany({ where: { propertyId: id } }),
      prisma.propertyImage.createMany({
        data: urls.map((url, index) => ({
          propertyId: id,
          url,
          isMain: index === 0,
          sortOrder: index,
        })),
      }),
    ])

    revalidatePath("/agency/properties")
    redirect(withSuccess(`/agency/properties/${id}`, "Bien mis à jour"))
  }

  /**
   * Mise a la corbeille d'un bien, depuis l'ecran d'edition.
   *
   * Cette action faisait `prisma.property.delete()` — une suppression
   * DEFINITIVE, sur un modele a suppression reversible, et l'extension de
   * `lib/prisma.ts` n'intercepte que les LECTURES : rien ne la rattrapait.
   * Le schema part alors en cascade sur les photos, les visites, les
   * ventes, les baux et leurs echeanciers ; les paiements sont delestes.
   * Sans corbeille, sans journal, et sans sauvegarde d'ou revenir.
   *
   * Elle n'exigeait par ailleurs aucun role : `requireAgency()` dit
   * l'agence, jamais le role. Un agent detruisait donc par cet ecran ce que
   * `POST /api/properties/[id]/delete` lui refuse depuis toujours. C'etait
   * BUG-32, et le rejeu de cette Server Action l'a confirme sur l'instance
   * le 12-08-2026 : bien efface, visite emportee.
   *
   * Le modele est desormais la route d'API, a la ligne pres : meme garde,
   * meme corbeille, meme journal. Aligner l'ecran sur la route, jamais
   * l'inverse.
   */
  async function deleteProperty() {
    "use server"
    const { agencyId, userId, userName } = await requireAgencyAdmin()
    const { id } = await params

    const owned = await prisma.property.findFirst({
      where: { id, agencyId, deletedAt: null },
      select: { id: true, title: true },
    })

    if (!owned) {
      redirect(withError("/agency/properties", "Bien introuvable"))
    }

    await prisma.property.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    await recordAudit({
      agencyId,
      userId,
      userName,
      action: "suppression",
      entity: "bien",
      entityId: id,
      summary: `Bien « ${owned.title} » mis a la corbeille`,
    })

    revalidatePath("/agency/properties")
    redirect(withSuccess("/agency/properties", "Bien mis à la corbeille"))
  }

  const checkboxes: Array<[string, string, boolean]> = [
    ["hasGarage", "Garage", property.hasGarage],
    ["hasGarden", "Jardin", property.hasGarden],
    ["hasTerrace", "Terrasse", property.hasTerrace],
    ["isFurnished", "Meublé", property.isFurnished],
  ]

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href={`/agency/properties/${property.id}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour au bien
              </Link>
            </Button>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Modifier le bien</h1>
                <p className="text-slate-600 mt-1">{property.title}</p>
              </div>
              <Button asChild variant="outline">
                <a
                  href={`/api/pdf/property/${property.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Fiche PDF
                </a>
              </Button>
            </div>
          </div>

          <FormMessage error={query.error} />

          <Card>
            <CardHeader>
              <CardTitle>Informations du bien</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateProperty} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="title">Titre du bien *</Label>
                    <Input id="title" name="title" defaultValue={property.title} required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Catégorie *</Label>
                    <select
                      id="category"
                      name="category"
                      required
                      defaultValue={property.category}
                      className={selectClass}
                    >
                      {Object.entries(PROPERTY_CATEGORY_LABELS).map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Type de bien *</Label>
                    <select
                      id="type"
                      name="type"
                      required
                      defaultValue={property.type}
                      className={selectClass}
                    >
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
                      defaultValue={property.operationType}
                      className={selectClass}
                    >
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
                      defaultValue={property.status}
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
                    <Input id="wilaya" name="wilaya" defaultValue={property.wilaya} required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="commune">Commune *</Label>
                    <Input
                      id="commune"
                      name="commune"
                      defaultValue={property.commune}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quartier">Quartier</Label>
                    <Input
                      id="quartier"
                      name="quartier"
                      defaultValue={property.quartier ?? ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Adresse</Label>
                    <Input id="address" name="address" defaultValue={property.address ?? ""} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="surface">Surface (m²)</Label>
                    <Input
                      id="surface"
                      name="surface"
                      type="number"
                      step="0.1"
                      min="0"
                      defaultValue={property.surface ?? ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rooms">Pièces</Label>
                    <Input
                      id="rooms"
                      name="rooms"
                      type="number"
                      min="0"
                      defaultValue={property.rooms ?? ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bedrooms">Chambres</Label>
                    <Input
                      id="bedrooms"
                      name="bedrooms"
                      type="number"
                      min="0"
                      defaultValue={property.bedrooms ?? ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bathrooms">Salles de bain</Label>
                    <Input
                      id="bathrooms"
                      name="bathrooms"
                      type="number"
                      min="0"
                      defaultValue={property.bathrooms ?? ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="floor">Étage</Label>
                    <Input
                      id="floor"
                      name="floor"
                      type="number"
                      min="0"
                      defaultValue={property.floor ?? ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="totalFloors">Nombre d&apos;étages</Label>
                    <Input
                      id="totalFloors"
                      name="totalFloors"
                      type="number"
                      min="0"
                      defaultValue={property.totalFloors ?? ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="salePrice">Prix de vente (DA)</Label>
                    <Input
                      id="salePrice"
                      name="salePrice"
                      type="number"
                      min="0"
                      defaultValue={property.salePrice ? toNumber(property.salePrice) : ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rentPrice">Loyer (DA/mois)</Label>
                    <Input
                      id="rentPrice"
                      name="rentPrice"
                      type="number"
                      min="0"
                      defaultValue={property.rentPrice ? toNumber(property.rentPrice) : ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="commission">Commission (%)</Label>
                    <Input
                      id="commission"
                      name="commission"
                      type="number"
                      step="0.1"
                      min="0"
                      defaultValue={property.commission ? toNumber(property.commission) : ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ownerId">Propriétaire</Label>
                    <select
                      id="ownerId"
                      name="ownerId"
                      defaultValue={property.ownerId ?? ""}
                      className={selectClass}
                    >
                      <option value="">Aucun</option>
                      {bailleurs.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="shortDescription">Description courte</Label>
                    <Input
                      id="shortDescription"
                      name="shortDescription"
                      defaultValue={property.shortDescription ?? ""}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Description complète</Label>
                    <Textarea
                      id="description"
                      name="description"
                      rows={5}
                      defaultValue={property.description ?? ""}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Photos du bien</Label>
                    <GalleryUploadField
                      name="imageUrls"
                      defaultValue={property.images.map((image) => image.url)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-6 md:col-span-2">
                    {checkboxes.map(([field, text, checked]) => (
                      <div key={field} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={field}
                          name={field}
                          defaultChecked={checked}
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
                    Enregistrer
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={`/agency/properties/${property.id}`}>Annuler</Link>
                  </Button>
                </div>
              </form>

              {/* Le bouton ne s'affiche qu'a qui peut l'actionner — et ce
                  n'est JAMAIS la mesure, seulement la seconde. Le refus est
                  pose dans l'action elle-meme, qui reste joignable en POST
                  sans cet ecran ; le masquage evite de proposer a un agent
                  un geste qui lui sera refuse. */}
              {isAgencyAdmin(userRole) && (
                <form action={deleteProperty} className="mt-8 border-t border-slate-200 pt-6">
                  <Button
                    type="submit"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer ce bien
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
