/**
 * Lecture des parametres communs aux listes : page, taille de page,
 * recherche.
 *
 * Les listes chargeaient jusqu'ici l'integralite des lignes. A quarante
 * biens cela ne se voit pas ; a plusieurs milliers de paiements la page
 * devient inutilisable et la base travaille pour rien. Ces deux fonctions
 * donnent le meme contrat a toutes les listes du logiciel.
 *
 * Tout vient de l'URL et donc de l'utilisateur : chaque valeur est bornee.
 */

export const DEFAULT_PER_PAGE = 25
const MAX_PER_PAGE = 100
const MAX_SEARCH_LENGTH = 80

export type PageParams = { page: number; perPage: number; skip: number }

export function readPageParams(query: {
  page?: string
  perPage?: string
}): PageParams {
  const rawPage = Number(query.page)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1

  const rawPerPage = Number(query.perPage)
  const perPage =
    Number.isFinite(rawPerPage) && rawPerPage > 0
      ? Math.min(Math.floor(rawPerPage), MAX_PER_PAGE)
      : DEFAULT_PER_PAGE

  return { page, perPage, skip: (page - 1) * perPage }
}

/** Terme de recherche nettoye, ou undefined s'il n'y a rien a chercher. */
export function readSearch(query: { q?: string }): string | undefined {
  const term = (query.q ?? "").trim().slice(0, MAX_SEARCH_LENGTH)
  return term.length > 0 ? term : undefined
}

/**
 * Clause OR « ce terme apparait dans l'un de ces champs texte ».
 * Renvoie undefined quand il n'y a pas de recherche, pour pouvoir
 * l'etaler dans un where sans condition.
 */
export function textSearch(
  term: string | undefined,
  fields: string[]
): { OR: Record<string, unknown>[] } | undefined {
  if (!term) return undefined

  return {
    OR: fields.map((field) => ({
      [field]: { contains: term, mode: "insensitive" },
    })),
  }
}

/**
 * Clause de recherche pour les listes qui relient un bien et un client :
 * ventes, baux, visites.
 *
 * `textSearch` ne sait chercher que dans les colonnes de la table elle-meme,
 * or ces trois listes n'en ont aucune de lisible : une vente ne porte qu'un
 * prix et deux identifiants. On y cherche donc par ce qui est affiche a
 * l'ecran — le nom du bien, sa reference, le nom du client.
 */
export function dealSearch(
  term: string | undefined
): { OR: Record<string, unknown>[] } | undefined {
  if (!term) return undefined

  const contains = { contains: term, mode: "insensitive" }

  return {
    OR: [
      { property: { title: contains } },
      { property: { reference: contains } },
      { client: { firstName: contains } },
      { client: { lastName: contains } },
    ],
  }
}

/** Nombre total de pages, au minimum 1 pour ne jamais afficher « page 1 / 0 ». */
export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage))
}
