import { prisma } from "@/lib/prisma"
import { appUrl } from "@/lib/mailer"
import {
  AGENCES_PUBLIQUES,
  BIENS_PUBLICS,
  indexXml,
  nomDePartie,
  partiesDuPlan,
  type Partie,
} from "@/lib/plan-du-site"

/**
 * Plan du site — l'INDEX (story 3.12, REP-105).
 *
 * La vitrine est l'argument commercial du logiciel : une agence la publie
 * pour etre trouvee. Sans plan de site, ses annonces n'existaient pour
 * aucun moteur de recherche — elles n'etaient accessibles qu'a qui
 * connaissait deja l'adresse.
 *
 * POURQUOI CE N'EST PLUS `app/sitemap.ts`. La convention de metadonnees de
 * Next ne sait produire qu'un `<urlset>` : son type `MetadataRoute.Sitemap`
 * est une liste d'URL, pas une liste de plans. Son `generateSitemaps()` ne
 * repond pas non plus au besoin — il deplace le plan vers
 * `/sitemap/<id>.xml` et laisse `/sitemap.xml` en 404 (verifie dans
 * `next/dist/build/webpack/loaders/next-metadata-route-loader.js` : sans
 * `id` correspondant, le handler renvoie `NextResponse('Not Found', 404)`).
 * Or c'est `/sitemap.xml` que `robots.txt` annonce, et c'est cette adresse
 * que les moteurs demandent. Un gestionnaire de route rend les deux.
 *
 * Ce que ce fichier NE change pas : l'AC-2 de la story 3.4 exige que le
 * plan liste TOUT. Il n'y a donc aucune borne ici, seulement un decoupage.
 */

/**
 * Calcule a chaque appel, jamais au moment de la construction.
 *
 * Avec une simple duree de revalidation, Next prerendait ce plan pendant
 * `next build` : a l'interieur de l'image, ou le domaine public n'est pas
 * encore connu et ou la base n'existe pas. Le plan livre annoncait donc
 * l'adresse de construction et pas une seule vitrine — le contraire exact
 * de ce qu'on lui demande. C'est le meme defaut que `BUG-25`, du cote du
 * `robots.txt`, et il se corrige de la meme ligne.
 *
 * Le cout est negligeable : deux `count()`, sur une adresse que seuls les
 * moteurs de recherche visitent, et que nginx limite deja en debit.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  const base = appUrl()

  /**
   * Le repli n'est pas un plan vide : il porte `agences-0`, qui porte
   * l'accueil. Une base injoignable ne doit pas faire echouer le
   * deploiement — mieux vaut un plan reduit qu'une adresse en erreur — et
   * `scripts/verify-deploy.mjs` compte sur ce `<loc>` pour comparer le
   * domaine de `robots.txt` a celui du plan.
   */
  let parties: Partie[] = [{ genre: "agences", page: 0 }]

  try {
    const [agences, biens] = await Promise.all([
      prisma.agency.count({ where: AGENCES_PUBLIQUES }),
      prisma.property.count({ where: BIENS_PUBLICS }),
    ])

    parties = partiesDuPlan(agences, biens)
  } catch (error) {
    console.error("[sitemap] index réduit à l'accueil", error)
  }

  const xml = indexXml(
    parties.map((partie) => `${base}/sitemap/${nomDePartie(partie)}`)
  )

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  })
}
