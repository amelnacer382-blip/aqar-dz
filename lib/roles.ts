/**
 * Les predicats de role, et RIEN d'autre.
 *
 * POURQUOI CE FICHIER EXISTE. `isAgencyAdmin` vivait dans
 * `lib/auth-guard.ts`, et elle y reste exportee — mais ce module-la importe
 * `prisma`, `auth` et `redirect`. L'importer depuis un composant CLIENT,
 * comme les barres de navigation, tirerait Prisma et NextAuth dans le
 * bundle du navigateur : echec de build au mieux, code serveur expose au
 * pire.
 *
 * La fonction, elle, est pure. Elle est donc posee ici, sans aucune
 * dependance, et `lib/auth-guard.ts` la RE-EXPORTE — les appelants serveur
 * existants ne changent pas d'une ligne.
 *
 * L'alternative etait de recopier `role === "agency_admin" || ...` dans la
 * barre. Refuse : deux definitions du meme role finissent par diverger,
 * et c'est exactement le mecanisme qui a produit BUG-35 — deux barres
 * disant la meme chose de deux facons, dont une seule a ete reparee.
 *
 * Story 5.13, 14-08-2026.
 */

/** Vrai si le role peut effectuer les actions reservees a l'administrateur. */
export function isAgencyAdmin(role: string): boolean {
  return role === "agency_admin" || role === "super_admin"
}

/**
 * Repli volontairement RESTREINT quand le role est inconnu.
 *
 * `app/agency/loading.tsx` rend la barre et ne peut pas connaitre le role :
 * c'est une fonction synchrone, elle s'affiche AVANT que la page ne
 * resolve. Sans repli explicite, la tentation est d'afficher tout — et un
 * agent verrait alors les cinq entrees interdites clignoter a chaque
 * navigation, ce qui defait le masquage a l'instant precis ou il regarde.
 *
 * `isAgencyAdmin(undefined)` vaut donc `false`, et c'est ecrit ici plutot
 * qu'obtenu par un `?? ""` dissemine dans les appelants : le repli est une
 * DECISION (arbitrage de l'editeur du 14-08-2026), pas un effet de bord.
 */
export function peutVoirEspaceAdmin(role: string | undefined): boolean {
  return role !== undefined && isAgencyAdmin(role)
}
