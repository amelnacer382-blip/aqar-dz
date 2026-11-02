import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { requireAgency } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Pencil, Building2, MapPin, BedDouble, Bath, Square, Car, TreePine, Sun, Sofa, FileDown } from "lucide-react"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const { agencyId, userRole, userName } = await requireAgency()
  const { id } = await params

  const property = await prisma.property.findFirst({
    where: { id, agencyId },
    include: {
      images: { orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }] },
      owner: true,
    },
  })

  if (!property) {
    notFound()
  }

  const statusLabels: Record<string, string> = {
    disponible: "Disponible",
    vendu: "Vendu",
    loue: "Loué",
    reserve: "Réservé",
    archive: "Archivé",
  }

  const statusColors: Record<string, string> = {
    disponible: "bg-green-100 text-green-800",
    vendu: "bg-blue-100 text-blue-800",
    loue: "bg-purple-100 text-purple-800",
    reserve: "bg-yellow-100 text-yellow-800",
    archive: "bg-slate-100 text-slate-800",
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/agency/properties">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux biens
            </Link>
          </Button>

          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">{property.title}</h1>
                <Badge className={statusColors[property.status] || ""}>
                  {statusLabels[property.status] || property.status}
                </Badge>
              </div>
              <p className="text-slate-500">
                Référence: <span className="font-mono">{property.reference}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
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
              <Button asChild className="bg-dar-ink hover:bg-dar-blue">
                <Link href={`/agency/properties/${property.id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Modifier
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Images */}
              <Card>
                <CardContent className="p-0">
                  {property.images.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 p-2">
                      <div className="relative col-span-2 aspect-video rounded-lg overflow-hidden bg-slate-200">
                        {/* La grande photo est le LCP de cette fiche. */}
                        <Image
                          src={property.images[0].url}
                          alt={property.title}
                          fill
                          sizes="(max-width: 1024px) 100vw, 512px"
                          priority
                          className="object-cover"
                        />
                      </div>
                      {property.images.slice(1).map((image) => (
                        <div key={image.id} className="relative aspect-square rounded-lg overflow-hidden bg-slate-200">
                          <Image
                            src={image.url}
                            alt={property.title}
                            fill
                            sizes="(max-width: 1024px) 50vw, 256px"
                            className="object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="aspect-video flex items-center justify-center bg-slate-100">
                      <Building2 className="h-16 w-16 text-slate-300" />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Description */}
              <Card>
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent>
                  {property.description ? (
                    <p className="text-slate-700 leading-relaxed">{property.description}</p>
                  ) : (
                    <p className="text-slate-400 italic">Aucune description</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {/* Prix */}
              <Card>
                <CardHeader>
                  <CardTitle>Prix</CardTitle>
                </CardHeader>
                <CardContent>
                  {property.salePrice ? (
                    <div className="font-display text-3xl font-bold tracking-tight text-dar-ink">
                      {Number(property.salePrice).toLocaleString()} DA
                    </div>
                  ) : property.rentPrice ? (
                    <div>
                      <div className="font-display text-3xl font-bold tracking-tight text-dar-ink">
                        {Number(property.rentPrice).toLocaleString()} DA
                      </div>
                      <p className="text-slate-500">par mois</p>
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">Prix non défini</p>
                  )}
                </CardContent>
              </Card>

              {/* Caractéristiques */}
              <Card>
                <CardHeader>
                  <CardTitle>Caractéristiques</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {property.surface && (
                      <div className="flex items-center gap-3">
                        <Square className="h-5 w-5 text-slate-400" />
                        <div>
                          <p className="text-sm text-slate-500">Surface</p>
                          <p className="font-medium">{property.surface} m²</p>
                        </div>
                      </div>
                    )}

                    {property.rooms && (
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-slate-400" />
                        <div>
                          <p className="text-sm text-slate-500">Pièces</p>
                          <p className="font-medium">{property.rooms}</p>
                        </div>
                      </div>
                    )}

                    {property.bedrooms && (
                      <div className="flex items-center gap-3">
                        <BedDouble className="h-5 w-5 text-slate-400" />
                        <div>
                          <p className="text-sm text-slate-500">Chambres</p>
                          <p className="font-medium">{property.bedrooms}</p>
                        </div>
                      </div>
                    )}

                    {property.bathrooms && (
                      <div className="flex items-center gap-3">
                        <Bath className="h-5 w-5 text-slate-400" />
                        <div>
                          <p className="text-sm text-slate-500">Salles de bain</p>
                          <p className="font-medium">{property.bathrooms}</p>
                        </div>
                      </div>
                    )}

                    {property.floor && (
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-slate-400" />
                        <div>
                          <p className="text-sm text-slate-500">Étage</p>
                          <p className="font-medium">{property.floor}</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {property.hasGarage && (
                        <div className="flex items-center gap-2 text-sm">
                          <Car className="h-4 w-4 text-green-500" />
                          <span>Garage</span>
                        </div>
                      )}
                      {property.hasGarden && (
                        <div className="flex items-center gap-2 text-sm">
                          <TreePine className="h-4 w-4 text-green-500" />
                          <span>Jardin</span>
                        </div>
                      )}
                      {property.hasTerrace && (
                        <div className="flex items-center gap-2 text-sm">
                          <Sun className="h-4 w-4 text-green-500" />
                          <span>Terrasse</span>
                        </div>
                      )}
                      {property.isFurnished && (
                        <div className="flex items-center gap-2 text-sm">
                          <Sofa className="h-4 w-4 text-green-500" />
                          <span>Meublé</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Localisation */}
              <Card>
                <CardHeader>
                  <CardTitle>Localisation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-slate-400" />
                      <div>
                        <p className="font-medium">{property.wilaya}</p>
                        <p className="text-sm text-slate-500">{property.commune}</p>
                      </div>
                    </div>
                    {property.address && (
                      <p className="text-sm text-slate-600 pl-8">{property.address}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Propriétaire */}
              {property.owner && (
                <Card>
                  <CardHeader>
                    <CardTitle>Propriétaire</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">
                      {property.owner.firstName} {property.owner.lastName}
                    </p>
                    {property.owner.phone && (
                      <p className="text-sm text-slate-500">{property.owner.phone}</p>
                    )}
                    {property.owner.email && (
                      <p className="text-sm text-slate-500">{property.owner.email}</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
