import { prisma } from "@/lib/prisma"
import { appUrl } from "@/lib/mailer"
import {
  AGENCES_PUBLIQUES,
  BIENS_PUBLICS,
  TAILLE_PLAN,
  lirePartie,
  urlsetXml,
  type EntreePlan,
} from "@/lib/plan-du-site"

/**
 * Plan du site — une PARTIE (story 3.12, REP-105).
 *
 * L'index (`app/sitemap.xml/route.ts`) renvoie ici, une adresse par
 * tranche. Chaque partie reste un `<urlset>` valide et autonome : un moteur
 * qui ne demanderait qu'elle obtient un plan correct.
 *
 * Ne sont listees que les pages reellement publiques : agences actives
 * ayant publie leur vitrine, et biens disponibles. Les memes conditions
 * exactement que les pages elles-memes — ecrites une seule fois dans
 * `lib/plan-du-site.ts` — sans quoi le plan annoncerait des adresses qui
 * repondent 404.
 *
 * ⚠ LA PAGINATION N'EST PAS UN INSTANTANE. Les tranches sont lues par
 * `skip`/`take` sur un ordre stable (`id`), mais un robot demande les
 * parties les unes apres les autres : une agence publiee entre deux
 * requetes peut decaler la suite, et une entree etre vue deux fois ou pas
 * du tout ce jour-la. C'est inherent a tout plan pagine, la correction
 * arrive au passage suivant du robot, et c'est ecrit ici pour que personne
 * ne le decouvre comme un defaut.
 */
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ partie: string }> }
) {
  const { partie } = await params
  const lue = lirePartie(partie)

  // Une partie qui n'existe pas repond 404, elle ne repond pas un plan
  // vide : un `<urlset>` sans entree serait valide, et laisserait croire
  // que la tranche est bien servie et simplement deserte.
  if (!lue) {
    return new Response("Not Found", { status: 404 })
  }

  const base = appUrl()
  const saut = lue.page * TAILLE_PLAN
  const entrees: EntreePlan[] = []

  // L'accueil ouvre la premiere partie des agences. Il est pose AVANT
  // toute requete : il existe donc meme sans vitrine publiee, et meme si
  // la base est injoignable.
  if (lue.genre === "agences" && lue.page === 0) {
    entrees.push({
      url: base,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    })
  }

  try {
    if (lue.genre === "agences") {
      const agences = await prisma.agency.findMany({
        where: AGENCES_PUBLIQUES,
        orderBy: { id: "asc" },
        skip: saut,
        take: TAILLE_PLAN,
        select: { slug: true, updatedAt: true },
      })

      agences.forEach((agence) => {
        entrees.push({
          url: `${base}/vitrine/${agence.slug}`,
          lastModified: agence.updatedAt,
          changeFrequency: "daily",
          priority: 0.8,
        })
      })
    } else {
      const biens = await prisma.property.findMany({
        where: BIENS_PUBLICS,
        orderBy: { id: "asc" },
        skip: saut,
        take: TAILLE_PLAN,
        select: { id: true, updatedAt: true, agency: { select: { slug: true } } },
      })

      biens.forEach((bien) => {
        // Le `where` exige deja `slug: { not: null }` du cote de l'agence ;
        // ce garde-fou est la pour le typage, pas pour le cas.
        if (!bien.agency.slug) return

        entrees.push({
          url: `${base}/vitrine/${bien.agency.slug}/biens/${bien.id}`,
          lastModified: bien.updatedAt,
          changeFrequency: "weekly",
          priority: 0.6,
        })
      })
    }
  } catch (error) {
    // Une base indisponible ne doit pas faire echouer la construction :
    // mieux vaut un plan reduit a l'accueil qu'un deploiement bloque.
    console.error("[sitemap] génération partielle", error)
  }

  return new Response(urlsetXml(entrees), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  })
}
