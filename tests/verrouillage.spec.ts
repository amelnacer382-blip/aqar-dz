import { test, expect, type APIRequestContext } from "@playwright/test"
import { hash } from "bcryptjs"
import { db } from "./db"
import { creerAgence, effacerAgence } from "./agence"
import { login, identiteAppelant } from "./auth-helper"

/**
 * Un tiers ne doit pas pouvoir verrouiller un compte (REP-37, story 1.9).
 *
 * LE DEFAUT. Le compteur par compte est consomme AVANT la verification du
 * mot de passe, et n'est efface qu'en cas de succes — succes que la limite
 * elle-meme empeche d'atteindre. Dix mots de passe faux suffisent donc a
 * mettre le titulaire dehors, et les adresses des directeurs d'agence sont
 * publiees sur les vitrines.
 *
 * CE QUI EST EPROUVE ICI, ET PAR QUEL CHEMIN. Pas `rateLimit()` appele
 * directement — cela prouverait la fonction, pas le produit. On passe par
 * le point d'entree reel de NextAuth, celui qu'un attaquant emprunterait.
 *
 * L'ATTAQUANT ET LA VICTIME ONT DES ADRESSES DIFFERENTES, sans quoi le
 * compteur par ADRESSE (60 / 15 min) fausserait la mesure : on veut isoler
 * le compteur par COMPTE, qui est celui du defaut.
 */

/** Seuil par compte, tel que pose dans `auth.ts`. */
const LIMITE_PAR_COMPTE = 10

/**
 * Decors effaces APRES le cas, y compris quand il a depasse son delai.
 *
 * `finally` ne suffit pas : un depassement interrompt le corps du test et ne
 * l'execute jamais. Ces cas creent un `agency_admin` ACTIF dont le mot de
 * passe est en clair dans ce fichier — exactement le scenario que la regle
 * de `CLAUDE.md` §6 vise. La premiere version les nettoyait par `finally`,
 * dans le meme commit qui posait la regle ; releve par la revue.
 */
const decorsJetables: Array<() => Promise<void>> = []

test.afterEach(async () => {
  while (decorsJetables.length > 0) {
    await decorsJetables.pop()!().catch(() => {})
  }
})

/**
 * Une tentative de connexion par le chemin reel de NextAuth.
 *
 * Le formulaire appelle `signIn("credentials")`, qui poste sur
 * `/api/auth/callback/credentials` avec un jeton anti-CSRF. On fait la
 * meme chose : c'est le point d'entree qu'un attaquant utiliserait, et il
 * est bien plus rapide que onze allers-retours dans l'interface.
 */
async function tenter(
  req: APIRequestContext,
  email: string,
  motDePasse: string,
  entetes: Record<string, string>
) {
  const csrf = await req.get("/api/auth/csrf", { headers: entetes })
  const { csrfToken } = await csrf.json()

  return req.post("/api/auth/callback/credentials", {
    headers: entetes,
    form: { email, password: motDePasse, csrfToken, redirect: "false" },
    maxRedirects: 0,
    failOnStatusCode: false,
  })
}

test.describe("Verrouillage d'un compte par un tiers (REP-37)", () => {
  test("un tiers qui enchaîne les mots de passe faux ne ferme pas le compte", async ({
    page,
    request,
  }) => {
    test.setTimeout(300000)

    const agence = await creerAgence(["agency_admin"])
    decorsJetables.push(() => effacerAgence(agence))

    try {
      // Un compte a soi, avec un mot de passe connu de nous seuls : les
      // comptes du jeu de demonstration sont partages par toute la suite,
      // et saturer leur compteur la casserait.
      const motDePasse = "MotDePasseLegitime!2026"
      const email = `victime-${Date.now()}@aqar.invalid`
      await db.user.create({
        data: {
          email,
          name: "Victime",
          password: await hash(motDePasse, 12),
          role: "agency_admin",
          isActive: true,
          agencyId: agence.agence.id,
        },
      })

      // L'ATTAQUANT : une adresse a lui, et onze mots de passe faux —
      // un de plus que le seuil par compte.
      const attaquant = identiteAppelant()

      for (let essai = 0; essai <= LIMITE_PAR_COMPTE; essai++) {
        await tenter(request, email, `faux-${essai}`, attaquant)
      }

      // LA VICTIME : son adresse a elle, et le BON mot de passe.
      //
      // C'est la seule assertion qui compte. Si elle échoue, un tiers
      // vient de mettre un directeur d'agence dehors avec onze requêtes.
      /**
       * `login()` leve `TimeoutError` si la connexion n'aboutit pas : le
       * message redige plus bas ne s'afficherait donc JAMAIS en regression,
       * et le Debug Log de cette story cite d'ailleurs le timeout nu. On
       * attrape pour que l'echec designe la propriete visee. Releve par la
       * revue du 12-08-2026 — `CLAUDE.md` §6 : « lire le message d'echec,
       * il doit designer la propriete visee ».
       */
      const entre = await login(page, email, motDePasse).then(
        () => true,
        () => false
      )

      expect(
        entre && page.url().includes("/agency"),
        "un tiers a verrouillé le compte : le titulaire ne peut plus entrer avec son propre mot de passe"
      ).toBe(true)
    } finally {
      await effacerAgence(agence)
    }
  })

  /**
   * LE CONTROLE POSITIF, et il n'est pas decoratif : le test ci-dessus
   * passerait tout aussi bien si la limitation etait entierement retiree.
   * On repare un deni d'acces — pas en supprimant la protection.
   */
  test("la limitation freine toujours l'essai systématique", async ({
    request,
  }) => {
    test.setTimeout(300000)

    const agence = await creerAgence(["agency_admin"])
    decorsJetables.push(() => effacerAgence(agence))

    try {
      const email = `cible-${Date.now()}@aqar.invalid`
      await db.user.create({
        data: {
          email,
          name: "Cible",
          password: await hash("MotDePasseLegitime!2026", 12),
          role: "agency_admin",
          isActive: true,
          agencyId: agence.agence.id,
        },
      })

      const attaquant = identiteAppelant()
      const durees: number[] = []

      for (let essai = 0; essai < LIMITE_PAR_COMPTE + 3; essai++) {
        const debut = Date.now()
        await tenter(request, email, `faux-${essai}`, attaquant)
        durees.push(Date.now() - debut)
      }

      /**
       * LE FREIN EST UN DÉLAI, PAS UN REFUS — et c'est le cœur de
       * l'arbitrage de cette story.
       *
       * La première version de ce contrôle exigeait que le serveur
       * CESSE de vérifier après le seuil (réponse quasi instantanée).
       * C'était exiger le défaut lui-même : ne plus vérifier, c'est
       * refuser un mot de passe correct, donc verrouiller le compte.
       *
       * Ce qu'on veut, c'est que l'attaquant paie le temps. Les
       * tentatives d'après le seuil doivent être NETTEMENT plus lentes
       * que celles d'avant.
       */
      const avant = Math.min(...durees.slice(0, LIMITE_PAR_COMPTE))
      const apres = Math.min(...durees.slice(LIMITE_PAR_COMPTE + 1))

      expect(
        apres - avant,
        "la limitation ne freine plus rien : après le seuil, un essai coûte autant qu'avant"
      ).toBeGreaterThan(500)
    } finally {
      await effacerAgence(agence)
    }
  })
})
