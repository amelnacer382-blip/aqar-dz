import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { requireAgencyAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Building2,
  MapPin,
  BedDouble,
  Bath,
  Square,
  Eye,
  ExternalLink,
  Inbox,
  Settings,
  AlertCircle,
} from "lucide-react"
import { formatDZD } from "@/lib/format"
import {
  OPERATION_PUBLIC_LABELS,
  PROPERTY_TYPE_LABELS,
  label,
} from "@/lib/labels"

export const metadata: Metadata = { title: "Vitrine" }

export default async function ShowcasePage() {
  const { agencyId, agency, userRole, userName } = await requireAgencyAdmin()

  const [properties, newLeads] = await Promise.all([
    prisma.property.findMany({
      where: { agencyId, status: "disponible", isAvailable: true },
      orderBy: { createdAt: "desc" },
      include: {
        images: { orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }], take: 1 },
      },
    }),
    prisma.lead.count({ where: { agencyId, status: "nouveau" } }),
  ])

  const isPublished = Boolean(agency.slug) && agency.showcaseEnabled
  const publicUrl = agency.slug ? `/vitrine/${agency.slug}` : null

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Vitrine</h1>
              <p className="text-slate-600 mt-1">
                Vos {properties.length} bien{properties.length > 1 ? "s" : ""} disponible
                {properties.length > 1 ? "s" : ""}, tels que vos clients les voient
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {newLeads > 0 && (
                <Button asChild variant="outline">
                  <Link href="/agency/leads">
                    <Inbox className="mr-2 h-4 w-4" />
                    {newLeads} nouveau{newLeads > 1 ? "x" : ""} message
                    {newLeads > 1 ? "s" : ""}
                  </Link>
                </Button>
              )}
              {isPublished && publicUrl ? (
                <Button asChild className="bg-dar-ink hover:bg-dar-blue">
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Voir la vitrine publique
                  </a>
                </Button>
              ) : (
                <Button asChild className="bg-dar-ink hover:bg-dar-blue">
                  <Link href="/agency/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Configurer ma vitrine
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {!isPublished && (
            <Alert className="mb-8">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Votre vitrine n&apos;est pas encore publiée. Choisissez un
                identifiant d&apos;URL dans les{" "}
                <Link href="/agency/settings" className="font-medium underline">
                  paramètres de l&apos;agence
                </Link>{" "}
                pour la rendre accessible à vos clients et recevoir leurs demandes.
              </AlertDescription>
            </Alert>
          )}

          {isPublished && publicUrl && (
            <Card className="mb-8 border-green-200 bg-green-50">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div>
                  <p className="text-sm font-medium text-green-900">Vitrine en ligne</p>
                  <p className="mt-0.5 text-sm text-green-800">
                    Adresse publique :{" "}
                    <code className="rounded bg-white px-1.5 py-0.5">{publicUrl}</code>
                  </p>
                </div>
                <Badge className="bg-green-600 text-white hover:bg-green-600">
                  Publiée
                </Badge>
              </CardContent>
            </Card>
          )}

          {properties.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Building2 className="mx-auto mb-4 h-16 w-16 text-slate-300" />
                <h3 className="mb-2 text-lg font-medium text-slate-900">
                  Aucun bien disponible
                </h3>
                <p className="mb-6 text-slate-500">
                  Seuls les biens au statut &laquo; Disponible &raquo; apparaissent
                  sur votre vitrine.
                </p>
                <Button asChild className="bg-dar-ink hover:bg-dar-blue">
                  <Link href="/agency/properties/new">Ajouter un bien</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {properties.map((property) => (
                <Link
                  key={property.id}
                  href={`/agency/properties/${property.id}`}
                  className="group"
                >
                  <Card className="h-full overflow-hidden transition-shadow hover:shadow-lg">
                    <div className="relative aspect-[4/3] overflow-hidden bg-dar-sand">
                      {property.images[0]?.url ? (
                        <Image
                          src={property.images[0].url}
                          alt={property.title}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 384px"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Building2 className="h-12 w-12 text-slate-400" />
                        </div>
                      )}
                      <div className="absolute left-3 top-3">
                        <Badge className="bg-slate-900 text-white hover:bg-slate-900">
                          {label(OPERATION_PUBLIC_LABELS, property.operationType)}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        {label(PROPERTY_TYPE_LABELS, property.type)}
                      </p>
                      <h3 className="mt-1 line-clamp-1 font-semibold text-slate-900">
                        {property.title}
                      </h3>
                      <div className="mb-3 mt-2 flex items-center gap-1 text-sm text-slate-500">
                        <MapPin className="h-4 w-4" />
                        {property.wilaya}, {property.commune}
                      </div>
                      <div className="mb-3 flex items-center gap-4 text-sm text-slate-600">
                        {property.surface && (
                          <span className="flex items-center gap-1">
                            <Square className="h-4 w-4" />
                            {property.surface} m²
                          </span>
                        )}
                        {property.bedrooms && (
                          <span className="flex items-center gap-1">
                            <BedDouble className="h-4 w-4" />
                            {property.bedrooms}
                          </span>
                        )}
                        {property.bathrooms && (
                          <span className="flex items-center gap-1">
                            <Bath className="h-4 w-4" />
                            {property.bathrooms}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-slate-900">
                          {property.salePrice
                            ? formatDZD(property.salePrice)
                            : property.rentPrice
                              ? `${formatDZD(property.rentPrice)} / mois`
                              : "Prix sur demande"}
                        </span>
                        <span className="flex items-center gap-1 text-sm text-slate-500">
                          <Eye className="h-4 w-4" />
                          Voir
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
