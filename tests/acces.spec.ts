import { test, expect } from "@playwright/test"
import { readdirSync } from "fs"
import { join } from "path"
import { login } from "./auth-helper"

/**
 * BUG-28 — dix-sept cas dont le nom contredisait l'assertion.
 *
 * Dix fichiers portaient des cas nommes « should display … when
 * authenticated » qui n'ouvraient aucune session et verifiaient la
 * redirection vers l'ecran de connexion : l'inverse exact de leur nom.
 * Ils passaient, et une suite verte ne voulait donc rien dire sur ces
 * pages-la.
 *
 * Debarrassees de leurs mensonges, ces dix cas disaient tous la MEME
 * chose — un visiteur sans session est renvoye vers la connexion — et le
 * disaient sur une liste PARTIELLE de routes. Ce fichier les remplace
 * par une table complete, relevee dans `app/agency` et `app/admin`, et
 * par les deux moities separees : sans session, puis avec.
 *
 * CE QUE LA SECONDE MOITIE PROUVE, et ce qu'elle ne prouve pas. Elle dit
 * que la route est joignable et ne casse pas — un 200, pas un renvoi
 * vers la connexion, pas une erreur serveur. Elle ne dit RIEN de
 * l'utilite de la page. C'est exactement ce que les cas menteurs
 * pretendaient faire ; la difference est qu'ici c'est vrai, et ecrit.
 *
 * Ce fichier ne couvre NI le cloisonnement entre agences (story 4.2), NI
 * la separation des roles (story 4.3) — c'est-a-dire ce que les trois
 * cas d'`admin.spec.ts` pretendaient couvrir en n'ouvrant aucune
 * session. Ces deux proprietes valent chacune leur propre story ; les
 * glisser ici les rendrait invisibles.
 */

/**
 * Routes protegees, relevees exhaustivement (`find app/agency app/admin
 * -name page.tsx`). Les routes parametrees — `[id]` — sont hors table :
 * elles demandent une donnee existante, donc une preparation qui est le
 * travail de la story 4.2.
 */
const ROUTES_AGENCE = [
  "/agency",
  "/agency/audit",
  "/agency/clients",
  "/agency/clients/new",
  "/agency/documents",
  "/agency/documents/new",
  "/agency/leads",
  "/agency/owners",
  "/agency/owners/new",
  "/agency/payments",
  "/agency/payments/new",
  "/agency/properties",
  "/agency/properties/new",
  "/agency/rental-management",
  "/agency/rental-management/new",
  "/agency/rentals",
  "/agency/rentals/new",
  "/agency/sales",
  "/agency/sales/new",
  "/agency/settings",
  "/agency/showcase",
  "/agency/statistics",
  "/agency/trash",
  "/agency/users",
  "/agency/visits",
  "/agency/visits/new",
]

const ROUTES_EDITEUR = [
  "/admin",
  "/admin/agencies",
  "/admin/settings",
  "/admin/statistics",
  "/admin/users",
]

/**
 * Les deux tables ci-dessus sont ecrites a la main. Ce test les confronte
 * au disque.
 *
 * Sans lui, elles se disent exhaustives et ne le restent que jusqu'au
 * prochain `app/agency/quelque-chose/page.tsx` : la route nouvelle
 * n'entre dans aucune liste, aucun test ne la demande, et la suite reste
 * verte en couvrant une page de moins. Une couverture qui se degrade en
 * silence pendant que le compteur de tests ne bouge pas — c'est-a-dire
 * la meme tromperie que BUG-28, deplacee d'un cran.
 */
function routesSurDisque(racine: string, prefixe: string): string[] {
  const trouvees: string[] = []

  const parcourir = (dossier: string, chemin: string) => {
    let entrees
    try {
      entrees = readdirSync(dossier, { withFileTypes: true })
    } catch {
      return
    }

    if (entrees.some((e) => e.isFile() && e.name === "page.tsx")) {
      trouvees.push(chemin === "" ? prefixe : `${prefixe}${chemin}`)
    }

    for (const entree of entrees) {
      if (!entree.isDirectory()) continue

      // Routes parametrees : hors table, elles demandent une donnee
      // existante (story 4.2).
      if (entree.name.startsWith("[")) continue

      // Groupes de routes : le segment n'apparait pas dans l'URL.
      const segment = entree.name.startsWith("(") ? "" : `/${entree.name}`

      parcourir(join(dossier, entree.name), `${chemin}${segment}`)
    }
  }

  parcourir(join(__dirname, "..", "app", racine), "")

  return trouvees.sort()
}

test("la table des routes protégées est celle du disque", () => {
  const attendues = [
    ...routesSurDisque("agency", "/agency"),
    ...routesSurDisque("admin", "/admin"),
  ].sort()

  const declarees = [...ROUTES_AGENCE, ...ROUTES_EDITEUR].sort()

  expect(
    declarees,
    "la table de ce fichier ne correspond plus aux pages de app/agency et " +
      "app/admin : une route a été ajoutée ou retirée sans que la couverture suive"
  ).toEqual(attendues)
})

test.describe("Accès aux routes protégées (BUG-28)", () => {
  test("sans session, chaque route protégée renvoie vers la connexion", async ({
    page,
  }) => {
    test.setTimeout(180000)

    for (const route of [...ROUTES_AGENCE, ...ROUTES_EDITEUR]) {
      await page.goto(route)

      // `expect.soft` : sur une table, une assertion dure s'arrete a la
      // premiere route et cache toutes les suivantes. Verifie — une
      // mutation qui ouvrait tout `/agency/*` n'a fait remonter que
      // `/agency`, la premiere de la liste. Le test echoue quand meme a la
      // fin ; il dit seulement TOUT ce qui est casse, pas le premier
      // symptome.
      expect.soft(
        page.url(),
        `${route} est accessible sans session — la garde manque ou a sauté`
      ).toMatch(/\/auth\/login/)
    }
  })

  test("avec une session d'agence, chaque route de l'espace agence répond", async ({
    page,
  }) => {
    test.setTimeout(240000)

    await login(page, "admin@aqar.dz")

    for (const route of ROUTES_AGENCE) {
      const reponse = await page.goto(route)

      // Le code HTTP ne suffit PAS, et je l'ai cru. Une page dont le
      // composant serveur leve rend quand meme **200** : le rendu est
      // diffuse en flux, l'en-tete est deja parti quand l'exception
      // survient, et c'est `app/error.tsx` qui prend la suite dans le
      // corps de la reponse. Verifie par mutation — un `throw` pose dans
      // /agency/trash a laisse ce test au vert.
      //
      // Sans l'assertion suivante, cette table serait exactement aussi
      // trompeuse que les dix-sept cas qu'elle remplace : verte pendant
      // que les 31 pages affichent un ecran d'erreur.
      expect.soft(reponse?.status(), `${route} ne répond pas 200`).toBe(200)

      await expect
        .soft(
          page.getByRole("heading", { name: /Une erreur est survenue/i }),
          `${route} affiche l'écran d'erreur : le composant serveur a levé`
        )
        .toHaveCount(0)

      expect
        .soft(
          page.url(),
          `${route} renvoie vers la connexion alors que la session est ouverte`
        )
        .not.toMatch(/\/auth\/login/)
    }
  })

  test("avec une session d'éditeur, chaque route d'administration répond", async ({
    page,
  }) => {
    test.setTimeout(180000)

    // Deux comptes, parce que deux domaines separes par le middleware :
    // un super admin est renvoye de `/agency/*` vers `/admin`, et un
    // compte d'agence de `/admin/*` vers `/agency` (middleware.ts,
    // lignes 79-89).
    //
    // La premiere redaction de ce commentaire attribuait ce renvoi a
    // `requireAgency()`. C'est faux : la garde effective est le
    // middleware, qui s'execute AVANT la page. Une mutation l'a montre —
    // vider le garde d'une page n'a rien change au comportement observe,
    // parce que la requete n'y arrivait deja plus. Le garde de page est
    // une seconde ligne, pas la ligne.
    await login(page, "superadmin@aqar.dz")

    for (const route of ROUTES_EDITEUR) {
      const reponse = await page.goto(route)

      expect.soft(reponse?.status(), `${route} ne répond pas 200`).toBe(200)

      await expect
        .soft(
          page.getByRole("heading", { name: /Une erreur est survenue/i }),
          `${route} affiche l'écran d'erreur : le composant serveur a levé`
        )
        .toHaveCount(0)

      expect
        .soft(
          page.url(),
          `${route} renvoie vers la connexion alors que la session est ouverte`
        )
        .not.toMatch(/\/auth\/login/)
    }
  })
})
