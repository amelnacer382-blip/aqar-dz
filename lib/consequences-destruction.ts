/**
 * Dire ce qui tombe, avec des nombres (story 3.13, REP-106).
 *
 * POURQUOI CE MODULE EXISTE. « Detruire » declenche onze suppressions en
 * cascade — `npm run audit:cascades` les recense, et la story 3.5 a du
 * corriger l'avertissement de l'ecran, qui n'en nommait que trois, toutes
 * anodines. Les vraies emportent les ventes, les locations et LEURS
 * QUITTANCES : de l'argent.
 *
 * Mais un avertissement general, si juste soit-il, ne dit pas a une agence
 * ce QU'ELLE va perdre, ELLE. « Et tout ce qui en depend » est vrai pour
 * une fiche vide comme pour un client de douze ans d'historique. Une agence
 * ne peut pas consentir a ce qu'on ne lui chiffre pas.
 *
 * Ce module transforme des comptes en phrases. Il est pur, donc il
 * s'eprouve directement, y compris sur les accords au pluriel — que
 * personne ne verifie jamais a l'ecran et que tout le monde remarque.
 */

/** Les categories, dans l'ordre ou elles seront enoncees. */
export type Categorie =
  | "photos"
  | "visites"
  | "ventes"
  | "locations"
  | "quittances"
  | "echanges"
  | "paiements"
  | "demandes"
  | "biens"

export type Comptes = Partial<Record<Categorie, number>>

/** Singulier, pluriel. Le francais ne se devine pas en ajoutant un « s ». */
const MOTS: Record<Categorie, [string, string]> = {
  photos: ["photo", "photos"],
  visites: ["visite", "visites"],
  ventes: ["vente", "ventes"],
  locations: ["location", "locations"],
  quittances: ["quittance de loyer", "quittances de loyer"],
  echanges: ["échange", "échanges"],
  paiements: ["paiement", "paiements"],
  demandes: ["demande de contact", "demandes de contact"],
  biens: ["bien", "biens"],
}

/** Les trois modeles a corbeille. */
export type Nature = "property" | "client" | "owner"

/**
 * Ce qui DISPARAIT, par nature — `onDelete: Cascade` dans
 * `prisma/schema.prisma`, tel que `npm run audit:cascades` le recense.
 *
 * CES DEUX TABLES NE SE DEVINENT PAS, ET ELLES NE SE PARTAGENT PAS. Une
 * vente rattachee a un CLIENT est detruite avec lui ; la meme vente
 * rattachee a un PROPRIETAIRE survit en perdant son bailleur. Une seule
 * liste commune aurait donc menti a l'une des deux natures — dans un sens
 * ou dans l'autre, et les deux mensonges coutent.
 *
 * L'ordre suit la gravite telle qu'une agence la percoit : une photo se
 * reprend en photo, une quittance de loyer ne se reprend pas.
 */
export const DETRUITES: Record<Nature, Categorie[]> = {
  property: ["photos", "visites", "ventes", "locations", "quittances"],
  client: ["visites", "ventes", "locations", "quittances", "echanges"],
  owner: ["echanges"],
}

/**
 * Ce qui SURVIT mais perd son rattachement — `onDelete: SetNull`.
 *
 * Dit a part, et pas melange au reste : ce n'est pas la meme perte, et les
 * confondre ferait passer une destruction pour moins grave qu'elle n'est
 * dans un sens, et plus grave dans l'autre.
 */
export const DETACHEES: Record<Nature, Categorie[]> = {
  property: ["paiements", "demandes"],
  client: ["paiements"],
  owner: ["biens", "ventes", "locations", "paiements"],
}

/** « 1 visite », « 3 quittances de loyer ». Les zeros ne sont pas enonces. */
export function lister(
  categories: Categorie[],
  comptes: Comptes
): string[] {
  return categories
    .map((categorie) => ({ categorie, nombre: comptes[categorie] ?? 0 }))
    .filter(({ nombre }) => nombre > 0)
    .map(({ categorie, nombre }) => {
      const [singulier, pluriel] = MOTS[categorie]
      return `${nombre} ${nombre === 1 ? singulier : pluriel}`
    })
}

/**
 * « a, b et c ».
 *
 * Le « et » final n'est pas de la coquetterie : une enumeration en virgules
 * seules se lit comme une liste tronquee, et on cherche le reste.
 */
export function enumerer(parties: string[]): string {
  if (parties.length === 0) return ""
  if (parties.length === 1) return parties[0]

  return `${parties.slice(0, -1).join(", ")} et ${parties[parties.length - 1]}`
}
