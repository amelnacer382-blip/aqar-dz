import { Page } from "@playwright/test"

/**
 * Ouverture de session pour les tests, et identite d'appelant.
 *
 * Ce fichier existait deja, importe par `owners.spec.ts` et JAMAIS
 * appele (BUG-28, story 4.1). Ses selecteurs — `input[type='email']` —
 * n'etaient d'ailleurs pas ceux du reste de la suite. Un helper qu'aucun
 * test n'exerce est un helper dont personne ne sait s'il fonctionne.
 *
 * Il est desormais LE point de connexion de toute la suite. Les copies
 * locales de `regression.spec.ts` et `features.spec.ts` ont ete
 * supprimees au profit de celle-ci — dette signalee en revue de la story
 * 4.1, payee en 4.3 parce qu'elle est devenue bloquante (voir plus bas).
 */

/**
 * Identite d'appelant propre a chaque usage.
 *
 * POURQUOI C'EST OBLIGATOIRE, ET PAS UN CONFORT. Le harnais n'a pas de
 * proxy devant lui : sans en-tete, tous les appelants tombent dans le
 * meme compteur `inconnu`. Or `auth.ts` limite la connexion a SOIXANTE
 * tentatives par adresse et par quart d'heure — un seuil pense pour une
 * agence entiere sortant par une seule IP publique, pas pour une suite de
 * tests.
 *
 * Constate, et pas suppose : en passant de 80 a 87 cas, la suite a
 * franchi ce plafond. Deux tests sans rapport entre eux ont echoue sur un
 * `waitForURL` de connexion expire — un symptome qui ne designe rien et
 * qu'on met une heure a rattacher a sa cause. Une reussite efface le
 * compteur DU COMPTE et pas celui de l'adresse : c'est volontaire
 * (story 1.4), et cela signifie que le plafond monte quoi qu'il arrive.
 *
 * Le prefixe 2001:db8::/32 est reserve a la documentation (RFC 3849).
 */
let compteurAppelant = 0

export function identiteAppelant(): Record<string, string> {
  const t = Date.now() + compteurAppelant++
  const haut = ((t >>> 16) & 0xffff).toString(16)
  const bas = (t & 0xffff).toString(16)

  return { "x-real-ip": `2001:db8::${haut}:${bas}` }
}

/**
 * Ouvre une session, avec une identite d'appelant propre.
 *
 * Il n'y a qu'une fonction. Les deux precedentes ne differaient que par
 * l'URL attendue apres la connexion — `/agency` ou `/admin` —
 * c'est-a-dire par une information que l'appelant n'a pas a connaitre :
 * c'est le role du compte qui decide de la destination. Attendre la
 * SORTIE de `/auth/` couvre les deux, et ne casse pas le jour ou une page
 * d'accueil s'intercale.
 *
 * L'identite est posee sur la PAGE, donc valable pour la navigation qui
 * suit. Un test qui a besoin d'une identite precise sur une requete
 * donnee la passe dans `page.request.*({ headers })`, qui prime.
 */
export async function login(page: Page, email: string, password = "password123") {
  await page.setExtraHTTPHeaders(identiteAppelant())
  await page.goto("/auth/login", { timeout: 60000 })
  await page.fill("#email", email)
  await page.fill("#password", password)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/"), {
    timeout: 90000,
  })
}
