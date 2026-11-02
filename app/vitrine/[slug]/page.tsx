import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { FormMessage } from "@/components/FormMessage"
import { ScrollProgress } from "@/components/motion/ScrollProgress"
import { PhotoBackdrop } from "@/components/motion/PhotoBackdrop"
import { CASBAH_WIDE } from "@/lib/photos"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Building2,
  MapPin,
  BedDouble,
  Bath,
  Square,
  Phone,
  Mail,
  Search,
} from "lucide-react"
import { formatDZD } from "@/lib/format"
import { readPageParams } from "@/lib/list-params"
import { Pagination } from "@/components/Pagination"
import {
  PROPERTY_TYPE_LABELS,
  OPERATION_PUBLIC_LABELS,
  label,
  estCleConnue,
} from "@/lib/labels"

const selectClass =
  "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"

type Params = { slug: string }
type Query = {
  operation?: string
  type?: string
  wilaya?: string
  maxPrice?: string
  page?: string
  error?: string
  success?: string
}

/** L'agence doit exister, etre active et avoir publie sa vitrine. */
async function findPublicAgency(slug: string) {
  return prisma.agency.findFirst({
    where: { slug, status: "active", showcaseEnabled: true },
  })
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<Query>
}): Promise<Metadata> {
  const { slug } = await params
  const agency = await findPublicAgency(slug)

  if (!agency) {
    return { title: "Agence introuvable" }
  }

  /*
    LE NUMERO DE PAGE ENTRE DANS LE TITRE (story 3.4, §8). Paginer cet
    ecran cree `?page=2`, `?page=3`... : autant d'adresses distinctes qui
    partageaient jusqu'ici un seul et meme titre. C'est du contenu
    duplique annonce comme identique, et l'AC-2 de la story parle
    explicitement du robot d'indexation.
  */
  const { page } = readPageParams(await searchParams)
  const suite = page > 1 ? ` — page ${page}` : ""

  return {
    title: `${agency.name} — Biens à vendre et à louer${suite}`,
    description:
      agency.description ??
      `Découvrez les biens immobiliers proposés par ${agency.name}.`,
  }
}

export default async function ShowcasePage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<Query>
}) {
  const { slug } = await params
  const query = await searchParams

  const agency = await findPublicAgency(slug)

  if (!agency) {
    notFound()
  }

  // Seuls les biens reellement disponibles sont exposes publiquement.
  const where: Prisma.PropertyWhereInput = {
    agencyId: agency.id,
    status: "disponible",
    isAvailable: true,
  }

  // CET ECRAN EST PUBLIC ET NON AUTHENTIFIE : c'est le plus expose des sept
  // sites de BUG-38. Avec `in`, `?type=constructor` suffisait a le remplacer
  // par une page d'erreur technique — sans compte, sans rien. Une valeur
  // inconnue est desormais IGNOREE, pas refusee : un signet perime doit poser
  // la vitrine entiere, jamais une erreur (meme arbitrage que `lib/offres.ts`).
  if (estCleConnue(OPERATION_PUBLIC_LABELS, query.operation)) {
    where.operationType = query.operation as never
  }

  if (estCleConnue(PROPERTY_TYPE_LABELS, query.type)) {
    where.type = query.type as never
  }

  if (query.wilaya) {
    where.wilaya = { contains: query.wilaya, mode: "insensitive" }
  }

  const maxPrice = Number(query.maxPrice)
  if (Number.isFinite(maxPrice) && maxPrice > 0) {
    where.OR = [
      { salePrice: { lte: maxPrice } },
      { rentPrice: { lte: maxPrice } },
    ]
  }

  /*
    LA SEULE PAGE PUBLIQUE DU LOGICIEL ETAIT LA SEULE SANS BORNE (story
    3.4, BUG-08). Les onze listes de l'espace agence passent par
    `readPageParams()` depuis longtemps ; celle-ci servait tout.

    MESURE DU 17-08-2026, sur l'application servie, 300 biens publies avec
    photo et description : 2 302 954 octets et 399 ms — soit ~7,7 Ko par
    bien, a chaque visite ET a chaque passage de robot. `?page=2` rendait
    alors exactement la meme page.
  */
  const { page, perPage, skip } = readPageParams(query)

  const [properties, total, wilayas] = await Promise.all([
    prisma.property.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
      include: {
        images: { orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }], take: 1 },
      },
    }),
    /*
      LE GRAND NOMBRE DU BANDEAU NE SE COMPTE PAS SUR LA PAGE COURANTE.
      Il affichait `properties.length` ; branche sur une liste paginee, il
      annoncerait 25 a toutes les agences du produit — une regression bien
      plus grave que la lenteur corrigee, puisque c'est l'argument
      commercial de l'agence.

      Le `where` est le MEME que celui de la liste : le nombre suit donc
      les filtres, exactement comme avant.
    */
    prisma.property.count({ where }),
    /*
      LES DEUX CONDITIONS DE PUBLICATION, PAS UNE (BUG-29, story 3.6).
      Cette requete ne portait que `status`. Une wilaya dont tous les biens
      sont retires de la vente apparaissait donc dans le menu et ne
      renvoyait rien — un visiteur qui choisit une option PROPOSEE PAR LE
      SITE et tombe sur zero resultat conclut que le site est casse.

      ELLE N'APPLIQUE DELIBEREMENT PAS LES AUTRES FILTRES — operation,
      type, budget. Une facette qui se filtrerait elle-meme enfermerait le
      visiteur dans son premier choix : apres avoir selectionne « Alger »,
      il ne pourrait plus voir les autres wilayas pour en changer.
      `isAvailable` n'est pas un filtre de visiteur, c'est une condition de
      publication, au meme rang que `status` : c'est pour cela, et
      seulement pour cela, qu'elle descend dans les deux requetes.
    */
    prisma.property.findMany({
      where: { agencyId: agency.id, status: "disponible", isAvailable: true },
      select: { wilaya: true },
      distinct: ["wilaya"],
      orderBy: { wilaya: "asc" },
    }),
  ])

  return (
    <main className="limewash min-h-screen">
      <ScrollProgress />
      {/*
        Bandeau d'accueil : une photographie plein cadre plutot qu'un simple
        titre. Un client qui arrive sur la vitrine doit voir un lieu, pas un
        formulaire. La couleur de l'agence sert d'accent, jamais de fond.
      */}
      <header className="relative overflow-hidden bg-dar-ink">
        {/* Les maisons se succedent derriere le nom de l'agence */}
        <PhotoBackdrop photos={CASBAH_WIDE} interval={8000} />
        <div className="photo-scrim absolute inset-0" />

        <div className="container relative z-10 mx-auto px-4 py-14 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <span
                  className="arch flex h-10 w-9 items-end justify-center rounded-b-[4px] pb-1.5"
                  style={{ backgroundColor: agency.primaryColor }}
                >
                  <Building2 className="h-4 w-4 text-white" />
                </span>
                <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-[2.75rem] sm:leading-[1.05]">
                  {agency.name}
                </h1>
              </div>

              {agency.description && (
                <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/75">
                  {agency.description}
                </p>
              )}

              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70">
                {[agency.commune, agency.wilaya].filter(Boolean).length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-white/45" />
                    {[agency.address, agency.commune, agency.wilaya]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                )}
                {agency.phone && (
                  <a
                    href={`tel:${agency.phone}`}
                    className="flex items-center gap-1.5 transition-colors hover:text-white"
                  >
                    <Phone className="h-4 w-4 text-white/45" />
                    {agency.phone}
                  </a>
                )}
                <a
                  href={`mailto:${agency.email}`}
                  className="flex items-center gap-1.5 transition-colors hover:text-white"
                >
                  <Mail className="h-4 w-4 text-white/45" />
                  {agency.email}
                </a>
              </div>
            </div>

            <p className="font-display text-white">
              <span className="block text-5xl font-bold leading-none">
                {total}
              </span>
              <span className="mt-2 block text-sm font-normal text-white/60">
                bien{total > 1 ? "s" : ""} disponible
                {total > 1 ? "s" : ""}
              </span>
            </p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <FormMessage error={query.error} success={query.success} />

        {/* Recherche */}
        <Card className="mb-8">
          <CardContent className="py-5">
            <form method="GET" className="grid grid-cols-1 gap-4 md:grid-cols-5">
              <div className="space-y-1.5">
                <Label htmlFor="operation" className="text-xs">
                  Opération
                </Label>
                <select
                  id="operation"
                  name="operation"
                  defaultValue={query.operation ?? ""}
                  className={selectClass}
                >
                  <option value="">Toutes</option>
                  <option value="vente">À vendre</option>
                  <option value="location">À louer</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="type" className="text-xs">
                  Type de bien
                </Label>
                <select
                  id="type"
                  name="type"
                  defaultValue={query.type ?? ""}
                  className={selectClass}
                >
                  <option value="">Tous</option>
                  {Object.entries(PROPERTY_TYPE_LABELS).map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wilaya" className="text-xs">
                  Wilaya
                </Label>
                <select
                  id="wilaya"
                  name="wilaya"
                  defaultValue={query.wilaya ?? ""}
                  className={selectClass}
                >
                  <option value="">Toutes</option>
                  {wilayas.map((w) => (
                    <option key={w.wilaya} value={w.wilaya}>
                      {w.wilaya}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="maxPrice" className="text-xs">
                  Budget maximum (DA)
                </Label>
                <Input
                  id="maxPrice"
                  name="maxPrice"
                  type="number"
                  min="0"
                  defaultValue={query.maxPrice ?? ""}
                  placeholder="Sans limite"
                />
              </div>

              <div className="flex items-end">
                <Button type="submit" className="w-full bg-dar-ink hover:bg-dar-blue">
                  <Search className="mr-2 h-4 w-4" />
                  Rechercher
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Resultats */}
        {/*
          DEUX RAISONS DE NE RIEN AVOIR A MONTRER, ET CE NE SONT PAS LES
          MEMES (story 3.4, §8). Avant la pagination, une grille vide
          voulait dire « aucun resultat ». Depuis, `?page=99` la vide aussi
          alors que l'agence a des biens : dire au visiteur qu'aucun bien ne
          correspond serait faux, et il repartirait.
        */}
        {properties.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Building2 className="mx-auto mb-4 h-16 w-16 text-slate-300" />
              <h2 className="mb-2 text-lg font-medium text-slate-900">
                {total === 0
                  ? "Aucun bien ne correspond à votre recherche"
                  : "Cette page n'existe pas"}
              </h2>
              <p className="mb-6 text-slate-500">
                {total === 0
                  ? "Modifiez vos critères ou contactez directement l'agence."
                  : `Cette agence propose ${total} bien${total > 1 ? "s" : ""}.`}
              </p>
              <Button asChild variant="outline">
                <Link href={`/vitrine/${slug}`}>Voir tous les biens</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {properties.map((property, index) => (
              <Link
                key={property.id}
                href={`/vitrine/${slug}/biens/${property.id}`}
                className="group animate-rise-in"
                /* Les cartes se posent l'une apres l'autre ; au-dela de la
                   premiere page visible le decalage n'apporte plus rien. */
                style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
              >
                <Card className="h-full overflow-hidden border-dar-sand/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-arch">
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
                      <Badge className="bg-dar-ink/90 text-white backdrop-blur-sm hover:bg-dar-ink">
                        {label(OPERATION_PUBLIC_LABELS, property.operationType)}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-dar-blue">
                      {label(PROPERTY_TYPE_LABELS, property.type)}
                    </p>
                    <h3 className="mt-1 line-clamp-1 font-display text-[17px] font-semibold text-dar-ink">
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
                    <p className="font-display text-lg font-bold text-dar-ink">
                      {property.salePrice
                        ? formatDZD(property.salePrice)
                        : property.rentPrice
                          ? `${formatDZD(property.rentPrice)} / mois`
                          : "Prix sur demande"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/*
          Les filtres sont passes a `<Pagination />` : changer de page ne
          doit jamais reinitialiser une recherche, et les liens rendus sont
          de vrais `<Link>` — donc suivis par un robot d'indexation, ce que
          l'AC-2 demande.
        */}
        {properties.length > 0 && (
          <Pagination
            page={page}
            perPage={perPage}
            total={total}
            basePath={`/vitrine/${slug}`}
            params={{
              operation: query.operation,
              type: query.type,
              wilaya: query.wilaya,
              maxPrice: query.maxPrice,
            }}
          />
        )}
      </div>

      <footer className="mt-16 border-t border-dar-sand bg-white py-10">
        <div className="container mx-auto px-4 text-center text-sm text-slate-500">
          <p className="font-display font-semibold text-dar-ink">{agency.name}</p>
          <p className="mt-1">
            {[agency.phone, agency.email].filter(Boolean).join("  ·  ")}
          </p>
          <p className="mt-4 text-xs text-slate-400">Vitrine propulsée par Aqar DZ</p>
        </div>
      </footer>
    </main>
  )
}
