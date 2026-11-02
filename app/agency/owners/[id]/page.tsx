import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { prisma } from "@/lib/prisma"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Pencil, Phone, Mail, MapPin, Building2 } from "lucide-react"
import { InteractionTimeline } from "@/components/InteractionTimeline"
import { FormMessage } from "@/components/FormMessage"
import { requireAgency } from "@/lib/auth-guard"

export default async function OwnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const { agencyId, userId, userRole, userName } = await requireAgency()
  const query = await searchParams
  const { id } = await params

  const owner = await prisma.owner.findFirst({
    where: { id, agencyId },
    include: {
      properties: {
        /*
          BUG-24 annoncait un ECART entre cet ecran et la liste — « 4 biens »
          la-bas, 3 ici. La mesure du 17-08-2026 l'a dementi : les deux
          affichaient 4. L'extension de `lib/prisma.ts` ne filtre que le
          premier niveau, donc ce `properties` imbrique n'etait pas couvert
          non plus, et les deux ecrans se trompaient DU MEME COTE.

          C'etait pire que l'ecart decrit : un ecart se voit, deux ecrans
          d'accord entre eux ne se voient pas. Le bien supprime s'affichait
          de surcroit avec un lien vers sa fiche d'edition — laquelle passe
          par `findFirst`, donc filtree, donc `notFound()`.
        */
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: {
          images: { take: 1 },
        },
      },
      interactions: {
        orderBy: { date: "desc" },
      },
    },
  })

  if (!owner) {
    notFound()
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/agency/owners">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux propriétaires
              </Link>
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">
                  {owner.firstName} {owner.lastName}
                </h1>
                <p className="text-slate-600 mt-1">
                  Fiche propriétaire
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href={`/agency/owners/${owner.id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Modifier
                </Link>
              </Button>
            </div>
          </div>

          <FormMessage error={query.error} success={query.success} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Informations personnelles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Prénom</p>
                      <p className="font-medium text-slate-900">{owner.firstName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Nom</p>
                      <p className="font-medium text-slate-900">{owner.lastName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Téléphone</p>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <p className="font-medium text-slate-900">{owner.phone || "-"}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Email</p>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <p className="font-medium text-slate-900">{owner.email || "-"}</p>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-sm text-slate-500 mb-1">Numéro de carte d&apos;identité</p>
                      <p className="font-medium text-slate-900">{owner.idCardNumber || "-"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-sm text-slate-500 mb-1">Adresse</p>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <p className="font-medium text-slate-900">{owner.address || "-"}</p>
                      </div>
                    </div>
                  </div>

                  {owner.notes && (
                    <div className="pt-4 border-t border-slate-100">
                      <p className="text-sm text-slate-500 mb-2">Notes</p>
                      <p className="text-slate-700 whitespace-pre-wrap">{owner.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Biens associés</CardTitle>
                </CardHeader>
                <CardContent>
                  {owner.properties.length === 0 ? (
                    <div className="text-center py-8">
                      <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500">Aucun bien associé à ce propriétaire</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {owner.properties.map((property) => (
                        <Link
                          key={property.id}
                          href={`/agency/properties/${property.id}/edit`}
                          className="flex items-center gap-4 p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                        >
                          <div className="relative h-12 w-12 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {property.images[0]?.url ? (
                              <Image
                                src={property.images[0].url}
                                alt={property.title}
                                fill
                                sizes="48px"
                                className="object-cover"
                              />
                            ) : (
                              <Building2 className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 truncate">{property.title}</p>
                            <p className="text-sm text-slate-500">
                              {property.wilaya}, {property.commune}
                            </p>
                          </div>
                          <Badge variant="secondary" className="capitalize">
                            {property.type.replace(/_/g, " ")}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <InteractionTimeline
                userId={userId}
                userRole={userRole}
                interactions={owner.interactions}
                ownerId={owner.id}
                returnTo={`/agency/owners/${owner.id}`}
              />
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Résumé</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Biens</span>
                    <span className="font-medium text-slate-900">{owner.properties.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Date d&apos;ajout</span>
                    <span className="font-medium text-slate-900">
                      {new Date(owner.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Dernière mise à jour</span>
                    <span className="font-medium text-slate-900">
                      {new Date(owner.updatedAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
