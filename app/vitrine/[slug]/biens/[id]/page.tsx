import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { FormMessage } from "@/components/FormMessage"
import { PropertyGallery } from "@/components/PropertyGallery"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowLeft,
  MapPin,
  BedDouble,
  Bath,
  Square,
  Building2,
  Layers,
  Car,
  Trees,
  Sun,
  Sofa,
  Phone,
  Mail,
  Send,
} from "lucide-react"
import { formatDZD } from "@/lib/format"
import {
  PROPERTY_TYPE_LABELS,
  PROPERTY_CATEGORY_LABELS,
  OPERATION_PUBLIC_LABELS,
  label,
} from "@/lib/labels"
import { submitLead } from "../../actions"

type Params = { slug: string; id: string }

async function findPublicProperty(slug: string, id: string) {
  return prisma.property.findFirst({
    where: {
      id,
      status: "disponible",
      isAvailable: true,
      agency: { slug, status: "active", showcaseEnabled: true },
    },
    include: {
      agency: true,
      images: { orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }] },
    },
  })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug, id } = await params
  const property = await findPublicProperty(slug, id)

  if (!property) {
    return { title: "Bien introuvable" }
  }

  return {
    title: `${property.title} — ${property.agency.name}`,
    description:
      property.shortDescription ??
      `${label(PROPERTY_TYPE_LABELS, property.type)} à ${property.commune}, ${property.wilaya}.`,
  }
}

export default async function PublicPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const { slug, id } = await params
  const query = await searchParams

  const property = await findPublicProperty(slug, id)

  if (!property) {
    notFound()
  }

  const { agency } = property
  const returnTo = `/vitrine/${slug}/biens/${property.id}`

  const price = property.salePrice
    ? formatDZD(property.salePrice)
    : property.rentPrice
      ? `${formatDZD(property.rentPrice)} / mois`
      : "Prix sur demande"

  const features = [
    property.hasGarage && { icon: Car, text: "Garage" },
    property.hasGarden && { icon: Trees, text: "Jardin" },
    property.hasTerrace && { icon: Sun, text: "Terrasse" },
    property.isFurnished && { icon: Sofa, text: "Meublé" },
  ].filter(Boolean) as { icon: typeof Car; text: string }[]

  const specs = [
    property.surface && { icon: Square, label: "Surface", value: `${property.surface} m²` },
    property.rooms && { icon: Layers, label: "Pièces", value: String(property.rooms) },
    property.bedrooms && {
      icon: BedDouble,
      label: "Chambres",
      value: String(property.bedrooms),
    },
    property.bathrooms && {
      icon: Bath,
      label: "Salles de bain",
      value: String(property.bathrooms),
    },
  ].filter(Boolean) as { icon: typeof Square; label: string; value: string }[]

  return (
    <main className="min-h-screen bg-slate-50">
      <header
        className="border-b border-slate-200 bg-white"
        style={{ borderTopColor: agency.primaryColor, borderTopWidth: 4 }}
      >
        <div className="container mx-auto flex items-center justify-between px-4 py-5">
          <Link href={`/vitrine/${slug}`} className="flex items-center gap-2">
            <Building2 className="h-6 w-6" style={{ color: agency.primaryColor }} />
            <span className="text-lg font-bold text-slate-900">{agency.name}</span>
          </Link>
          {agency.phone && (
            <a
              href={`tel:${agency.phone}`}
              className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              <Phone className="h-4 w-4" />
              {agency.phone}
            </a>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link href={`/vitrine/${slug}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux biens
          </Link>
        </Button>

        <FormMessage error={query.error} success={query.success} />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Colonne principale */}
          <div className="space-y-8 lg:col-span-2">
            <PropertyGallery
              images={property.images.map((image) => image.url)}
              title={property.title}
            />

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-slate-900 text-white hover:bg-slate-900">
                  {label(OPERATION_PUBLIC_LABELS, property.operationType)}
                </Badge>
                <Badge variant="outline">
                  {label(PROPERTY_TYPE_LABELS, property.type)}
                </Badge>
                <Badge variant="outline">
                  {label(PROPERTY_CATEGORY_LABELS, property.category)}
                </Badge>
              </div>

              <h1 className="mt-4 text-3xl font-bold text-slate-900">{property.title}</h1>

              <p className="mt-2 flex items-center gap-1.5 text-slate-600">
                <MapPin className="h-4 w-4 text-slate-400" />
                {[property.address, property.quartier, property.commune, property.wilaya]
                  .filter(Boolean)
                  .join(", ")}
              </p>

              <p className="mt-4 text-3xl font-bold" style={{ color: agency.primaryColor }}>
                {price}
              </p>
            </div>

            {specs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Caractéristiques</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {specs.map((spec) => (
                      <div key={spec.label} className="text-center">
                        <spec.icon className="mx-auto mb-2 h-5 w-5 text-slate-400" />
                        <p className="font-semibold text-slate-900">{spec.value}</p>
                        <p className="text-xs text-slate-500">{spec.label}</p>
                      </div>
                    ))}
                  </div>

                  {features.length > 0 && (
                    <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-6">
                      {features.map((feature) => (
                        <span
                          key={feature.text}
                          className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700"
                        >
                          <feature.icon className="h-4 w-4 text-slate-500" />
                          {feature.text}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {property.description && (
              <Card>
                <CardHeader>
                  <CardTitle>Descriptif</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line leading-relaxed text-slate-600">
                    {property.description}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Formulaire de contact */}
          <div className="lg:col-span-1">
            <Card className="lg:sticky lg:top-8">
              <CardHeader>
                <CardTitle>Ce bien vous intéresse ?</CardTitle>
                <p className="text-sm text-slate-500">
                  Laissez vos coordonnées, l&apos;agence vous recontacte.
                </p>
              </CardHeader>
              <CardContent>
                <form action={submitLead} className="space-y-4">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="propertyId" value={property.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />

                  {/* Piège à robots : invisible pour un visiteur humain. */}
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="hidden"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName">Prénom *</Label>
                      <Input id="firstName" name="firstName" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName">Nom *</Label>
                      <Input id="lastName" name="lastName" required />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="+213 ..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="message">Votre message *</Label>
                    <Textarea
                      id="message"
                      name="message"
                      rows={4}
                      required
                      minLength={10}
                      defaultValue={`Bonjour, je suis intéressé par le bien "${property.title}". Merci de me recontacter.`}
                    />
                  </div>

                  <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800">
                    <Send className="mr-2 h-4 w-4" />
                    Envoyer ma demande
                  </Button>

                  <p className="text-center text-xs text-slate-400">
                    Indiquez au moins un téléphone ou un email.
                  </p>
                </form>

                <div className="mt-6 space-y-2 border-t border-slate-200 pt-6 text-sm">
                  <p className="font-medium text-slate-900">{agency.name}</p>
                  {agency.phone && (
                    <a
                      href={`tel:${agency.phone}`}
                      className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
                    >
                      <Phone className="h-4 w-4 text-slate-400" />
                      {agency.phone}
                    </a>
                  )}
                  <a
                    href={`mailto:${agency.email}`}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
                  >
                    <Mail className="h-4 w-4 text-slate-400" />
                    {agency.email}
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
