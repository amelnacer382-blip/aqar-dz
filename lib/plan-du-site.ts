import type { Prisma } from "@prisma/client"

/**
 * Le plan du site, decoupe en parties (story 3.12, REP-105).
 *
 * POURQUOI CE MODULE EXISTE. Un fichier de plan unique ne peut pas porter
 * plus de 50 000 URL — c'est la limite du protocole sitemaps.org, verifiee
 * le 17-08-2026 sur https://www.sitemaps.org/protocol.html :
 *
 *   « Each Sitemap file that you provide must have no more than 50,000 URLs
 *     and must be no larger than 50MB (52,428,800 bytes). »
 *   « Sitemap index files may not list more than 50,000 Sitemaps and must
 *     be no larger than 50MB. »
 *
 * Au-dela, les moteurs ignorent le fichier — et la vitrine redevient
 * invisible au moment precis ou elle compte le plus. La correction n'est
 * PAS une borne : l'AC-2 de la story 3.4 exige que le plan liste TOUT. Un
 * index de plans partiels donne les deux.
 *
 * ⚠ CE QUE LA BASE DIT AUJOURD'HUI, mesure le 17-08-2026 avant d'ecrire une
 * ligne — le constat d'origine n'avait jamais ete mesure :
 *
 *   43 vitrines publiees, 4 biens publies  ->  48 URL au total
 *   marge avant la limite                  ->  49 952 URL
 *
 * Le defaut est donc entierement PROSPECTIF, et c'est ecrit ainsi. Le seuil
 * se franchit vers 50 000 objets publies : 25 agences de 2 000 biens
 * suffisent. Le scenario nomme par l'AC-2 de la story 3.4 — 50 agences de
 * 2 000 biens — en produit 100 051, soit le double de ce qu'un fichier
 * accepte.
 *
 * LA TAILLE DES PARTIES N'EST PAS LA LIMITE. 45 000 laisse 5 000 URL de
 * marge : la partie `agences-0` porte l'accueil EN PLUS de sa tranche, et
 * une entree ajoutee plus tard (des images, par exemple) ne doit pas faire
 * repasser le calcul au-dessus du seuil sans que personne ne s'en apercoive.
 */
export const TAILLE_PLAN = 45_000

/** La limite du protocole. Elle ne se choisit pas, elle se subit. */
export const LIMITE_MOTEURS = 50_000

export type GenrePlan = "agences" | "biens"

/** Une partie du plan : un genre, et son rang dans ce genre. */
export type Partie = { genre: GenrePlan; page: number }

/**
 * Le nombre de parties necessaires pour `total` entrees.
 *
 * Toujours au moins une : un plan sans aucune vitrine publiee doit rester
 * un plan valide, portant l'accueil.
 */
export function nombreDeParties(total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 1
  return Math.ceil(total / TAILLE_PLAN)
}

/**
 * Les parties a lister dans l'index.
 *
 * LE DECOUPAGE SE FAIT PAR GENRE, PAS SUR UN FLUX UNIQUE. Paginer d'un
 * seul `skip`/`take` a travers DEUX tables demanderait un ordre global
 * qu'aucune des deux ne porte ; on paginerait alors sur un decalage calcule
 * a la main, et une entree ajoutee au milieu deplacerait silencieusement
 * tout ce qui suit. Deux suites independantes, chacune ordonnee par son
 * `id`, coutent une entree de plus dans l'index et se raisonnent.
 *
 * `agences-0` est TOUJOURS presente : elle porte l'accueil. C'est ce qui
 * garantit que l'index n'est jamais vide, y compris quand la base est
 * injoignable — invariant dont `scripts/verify-deploy.mjs` depend pour
 * comparer les domaines de `robots.txt` et de `sitemap.xml`.
 *
 * Les parties de biens, elles, n'existent que s'il y a des biens : un
 * `<urlset>` vide serait valide et ne servirait a rien.
 */
export function partiesDuPlan(agences: number, biens: number): Partie[] {
  const parties: Partie[] = []

  for (let page = 0; page < nombreDeParties(agences); page++) {
    parties.push({ genre: "agences", page })
  }

  if (biens > 0) {
    for (let page = 0; page < nombreDeParties(biens); page++) {
      parties.push({ genre: "biens", page })
    }
  }

  return parties
}

/** Le nom de fichier d'une partie, tel qu'il apparait dans l'URL. */
export function nomDePartie(partie: Partie): string {
  return `${partie.genre}-${partie.page}.xml`
}

/**
 * L'inverse, applique a un segment d'URL — donc a une valeur venue de
 * l'exterieur.
 *
 * L'alternation est ECRITE EN TOUTES LETTRES dans l'expression, et non
 * verifiee par une appartenance a une table. C'est la lecon de la story 3.2
 * (BUG-38) : une garde en `valeur in TABLE` est trouee par la chaine de
 * prototypes — `constructor`, `toString`, `__proto__` la franchissent.
 *
 * Le rang refuse aussi les zeros en tete (`agences-007.xml`) : deux URL
 * differentes qui servent le meme contenu sont du contenu duplique annonce
 * a un moteur de recherche, exactement ce que la story 3.4 a corrige sur la
 * pagination de la vitrine.
 */
export function lirePartie(brut: string): Partie | null {
  const trouve = /^(agences|biens)-(0|[1-9][0-9]{0,6})\.xml$/.exec(brut)

  if (!trouve) return null

  return { genre: trouve[1] as GenrePlan, page: Number(trouve[2]) }
}

/**
 * Les conditions de publication, ecrites UNE fois.
 *
 * L'index compte et les parties listent : si les deux ne posaient pas
 * exactement la meme condition, l'index annoncerait des parties vides ou en
 * oublierait — et personne ne le verrait avant qu'un moteur ne s'en
 * plaigne.
 */
export const AGENCES_PUBLIQUES = {
  status: "active",
  showcaseEnabled: true,
  slug: { not: null },
} satisfies Prisma.AgencyWhereInput

export const BIENS_PUBLICS = {
  status: "disponible",
  isAvailable: true,
  agency: AGENCES_PUBLIQUES,
} satisfies Prisma.PropertyWhereInput

/**
 * Echappement XML.
 *
 * ⚠ Next ne le faisait PAS : son serialiseur interpole `item.url` tel quel
 * (`next/dist/build/webpack/loaders/metadata/resolve-route-data.js`). Rien
 * n'etait casse pour autant, et c'est une MESURE et non une supposition :
 * le seul ecrivain d'un slug est `agencySettingsSchema`, qui le contraint a
 * `^[a-z0-9-]{3,40}$`, et les identifiants de biens sont des cuid. Aucun
 * caractere a echapper ne peut donc atteindre la sortie aujourd'hui.
 *
 * On echappe quand meme : le jour ou cette contrainte bouge, le plan
 * deviendrait un XML invalide — donc ignore en entier — et rien dans ce
 * fichier ne rappellerait que le lien existait.
 */
export function echapperXml(valeur: string): string {
  return valeur
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/** Une entree de plan, dans la forme qu'attend `urlsetXml`. */
export type EntreePlan = {
  url: string
  lastModified?: Date
  changeFrequency?: "daily" | "weekly" | "monthly"
  priority?: number
}

/** Un plan partiel : `<urlset>`. */
export function urlsetXml(entrees: EntreePlan[]): string {
  const corps = entrees
    .map((entree) => {
      let bloc = "<url>\n"
      bloc += `<loc>${echapperXml(entree.url)}</loc>\n`
      if (entree.lastModified) {
        bloc += `<lastmod>${entree.lastModified.toISOString()}</lastmod>\n`
      }
      if (entree.changeFrequency) {
        bloc += `<changefreq>${entree.changeFrequency}</changefreq>\n`
      }
      if (typeof entree.priority === "number") {
        bloc += `<priority>${entree.priority}</priority>\n`
      }
      return bloc + "</url>\n"
    })
    .join("")

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    corps +
    "</urlset>\n"
  )
}

/**
 * L'index : `<sitemapindex>`.
 *
 * Il ne porte PAS de `<lastmod>` par partie. Le protocole le permet mais ne
 * l'exige pas, et le calculer couterait une requete d'agregat par partie a
 * chaque appel — pour une information qu'un moteur retrouve dans la partie
 * elle-meme, ou chaque entree porte deja la sienne.
 */
export function indexXml(urls: string[]): string {
  const corps = urls
    .map((url) => `<sitemap>\n<loc>${echapperXml(url)}</loc>\n</sitemap>\n`)
    .join("")

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    corps +
    "</sitemapindex>\n"
  )
}
