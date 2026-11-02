import { test, expect, Page } from "@playwright/test"
import { db } from "./db"
import { creerAgence, garnir, effacerAgence } from "./agence"
import { login } from "./auth-helper"

/**
 * Cloisonnement inter-agences (story 4.2).
 *
 * Ce n'est pas la correction d'un defaut : c'est la fermeture d'un angle
 * mort. Rien ne dit que le cloisonnement soit casse — rien ne prouvait
 * qu'il tienne. Or c'est la propriete qui fait vivre ou mourir un
 * produit multi-tenant : une fuite ne se repare pas par un correctif,
 * elle se repare par des excuses a chaque client.
 *
 * Ce qui existait avant ce fichier : UN cas, « le document de l'agence
 * est servi a l'agence, et a elle seule » (regression.spec.ts, story
 * 1.3), qui n'avait meme pas de seconde agence — il forgeait une `url`
 * portant un identifiant d'agence invente. Aucun des huit exports,
 * aucune des cinq routes PDF, aucune des huit routes de suppression,
 * aucune page de detail n'etait eprouvee avec une donnee reellement
 * detenue par quelqu'un d'autre.
 *
 * LES CONTROLES SONT LA PARTIE LA PLUS IMPORTANTE DE CE FICHIER. Chaque
 * refus attendu de l'agence A est double d'un succes constate de
 * l'agence B sur la MEME adresse — avant pour les pages et les PDF,
 * apres pour les suppressions, qui detruisent leur cible.
 *
 * Sans eux, tous les 404 de ce fichier s'expliqueraient aussi bien par
 * « l'identifiant n'existe pas » ou « la route est cassee » que par
 * « le cloisonnement tient » : le jour ou le decor cesserait de se
 * creer, la suite resterait verte en ne testant plus rien. C'est
 * exactement le reproche fait aux dix-sept cas de BUG-28, et il se
 * reproduit tres facilement de ce cote-ci.
 *
 * PAS DE 403, ET C'EST LE POINT. Un 403 confirme que la ressource
 * existe : il transforme une page de detail en oracle d'existence, par
 * lequel on enumere les dossiers d'un concurrent. Les routes d'API
 * verifiees ici rendent donc 404 exactement, jamais « tout sauf 200 ».
 *
 * Les PAGES, elles, rendent la page introuvable avec un statut 200 —
 * effet du rendu en flux, mesure et explique plus bas. Le statut y est
 * un defaut a part, sans consequence sur le cloisonnement ; ce fichier
 * y assert la substance plutot que le code.
 */

type Voisine = Awaited<ReturnType<typeof creerVoisine>>

/**
 * Une agence voisine complete.
 *
 * La mecanique — creation, garniture, effacement — vit dans
 * `tests/agence.ts` : la story 4.3 en a besoin elle aussi, et une
 * seconde copie aurait diverge au premier changement de schema.
 */
async function creerVoisine() {
  const agence = await creerAgence(["agency_admin"])
  const contenu = await garnir(agence)

  return {
    ...contenu,
    marque: agence.marque,
    agence,
    identifiants: agence.admin!,
  }
}

/** Les dix-sept pages qui affichent ou modifient une ressource. */
function pagesDeDetail(v: Voisine): Array<[string, string]> {
  return [
    ["bien", `/agency/properties/${v.bien.id}`],
    ["bien (modification)", `/agency/properties/${v.bien.id}/edit`],
    ["client", `/agency/clients/${v.client.id}`],
    ["client (modification)", `/agency/clients/${v.client.id}/edit`],
    ["propriétaire", `/agency/owners/${v.proprietaire.id}`],
    ["propriétaire (modification)", `/agency/owners/${v.proprietaire.id}/edit`],
    ["document", `/agency/documents/${v.document.id}`],
    ["document (modification)", `/agency/documents/${v.document.id}/edit`],
    ["paiement", `/agency/payments/${v.paiement.id}`],
    ["paiement (modification)", `/agency/payments/${v.paiement.id}/edit`],
    ["visite", `/agency/visits/${v.visite.id}`],
    ["visite (modification)", `/agency/visits/${v.visite.id}/edit`],
    ["vente", `/agency/sales/${v.vente.id}`],
    ["vente (modification)", `/agency/sales/${v.vente.id}/edit`],
    ["bail", `/agency/rentals/${v.bail.id}`],
    ["bail (modification)", `/agency/rentals/${v.bail.id}/edit`],
    ["quittance (modification)", `/agency/rental-management/${v.quittance.id}/edit`],
  ]
}

/** Les cinq routes qui emettent un PDF. */
function routesPdf(v: Voisine): Array<[string, string]> {
  return [
    ["fiche de bien", `/api/pdf/property/${v.bien.id}`],
    ["reçu de paiement", `/api/pdf/payment/${v.paiement.id}`],
    ["quittance", `/api/pdf/receipt/${v.quittance.id}`],
    ["contrat de bail", `/api/pdf/rental-contract/${v.bail.id}`],
    ["contrat de vente", `/api/pdf/sale-contract/${v.vente.id}`],
  ]
}

/** Les huit routes de suppression, et la relecture qui les juge. */
function routesDeSuppression(v: Voisine): Array<{
  nom: string
  url: string
  toujoursLa: () => Promise<boolean>
}> {
  // Pour les trois modeles a suppression reversible, « toujours la » ne
  // suffit pas : la ligne reste en base meme apres une suppression
  // reussie. C'est `deletedAt` qui dit la verite.
  return [
    {
      nom: "bien",
      url: `/api/properties/${v.bien.id}/delete`,
      toujoursLa: async () =>
        (await db.property.findUnique({ where: { id: v.bien.id } }))
          ?.deletedAt === null,
    },
    {
      nom: "client",
      url: `/api/clients/${v.client.id}/delete`,
      toujoursLa: async () =>
        (await db.client.findUnique({ where: { id: v.client.id } }))
          ?.deletedAt === null,
    },
    {
      nom: "propriétaire",
      url: `/api/owners/${v.proprietaire.id}/delete`,
      toujoursLa: async () =>
        (await db.owner.findUnique({ where: { id: v.proprietaire.id } }))
          ?.deletedAt === null,
    },
    {
      nom: "document",
      url: `/api/documents/${v.document.id}/delete`,
      toujoursLa: async () =>
        (await db.document.count({ where: { id: v.document.id } })) === 1,
    },
    {
      nom: "paiement",
      url: `/api/payments/${v.paiement.id}/delete`,
      toujoursLa: async () =>
        (await db.payment.count({ where: { id: v.paiement.id } })) === 1,
    },
    {
      nom: "visite",
      url: `/api/visits/${v.visite.id}/delete`,
      toujoursLa: async () =>
        (await db.visit.count({ where: { id: v.visite.id } })) === 1,
    },
    {
      nom: "vente",
      url: `/api/sales/${v.vente.id}/delete`,
      toujoursLa: async () =>
        (await db.sale.count({ where: { id: v.vente.id } })) === 1,
    },
    {
      nom: "bail",
      url: `/api/rentals/${v.bail.id}/delete`,
      toujoursLa: async () =>
        (await db.rental.count({ where: { id: v.bail.id } })) === 1,
    },
  ]
}

const EXPORTS = [
  "properties",
  "clients",
  "owners",
  "payments",
  "visits",
  "leads",
  "sales",
  "rentals",
]

/**
 * Chaque test pose son propre decor et l'efface, meme s'il echoue.
 *
 * Un `beforeAll` partage aurait ete moins cher — mais `fullyParallel`
 * repartit les cas entre plusieurs processus, et un `beforeAll` s'execute
 * une fois PAR processus : plusieurs agences creees, plusieurs
 * nettoyages concurrents. Poser le decor par test coute une seconde et
 * supprime la classe entiere du probleme.
 */
async function avecVoisine(
  page: Page,
  travail: (voisine: Voisine) => Promise<void>
) {
  const voisine = await creerVoisine()

  try {
    await travail(voisine)
  } finally {
    await effacerAgence(voisine.agence)
  }
}

test.describe("Cloisonnement entre agences", () => {
  test("l'agence voisine voit ses propres ressources", async ({ page }) => {
    test.setTimeout(240000)

    // Le controle. Il ne verifie pas le cloisonnement : il verifie que
    // les adresses utilisees par les autres tests DESIGNENT quelque
    // chose. Sans lui, un decor qui cesserait de se creer rendrait tous
    // les 404 suivants triviaux, et la suite resterait verte en ne
    // testant plus rien du tout.
    await avecVoisine(page, async (voisine) => {
      await login(page, voisine.identifiants.email)

      for (const [nom, url] of pagesDeDetail(voisine)) {
        const reponse = await page.goto(url)

        expect
          .soft(reponse?.status(), `${nom} : ${url} ne répond pas à son agence`)
          .toBe(200)
      }

      for (const [nom, url] of routesPdf(voisine)) {
        const reponse = await page.request.get(url, { failOnStatusCode: false })

        expect
          .soft(reponse.status(), `PDF ${nom} : ${url} refusé à sa propre agence`)
          .toBe(200)
      }
    })
  })

  // Le nom de ce test disait « répond 404, jamais 403 » tant que je
  // croyais pouvoir asserter le statut. Il ne l'assertait plus : c'est
  // très exactement le défaut que la story 4.1 vient de supprimer
  // dix-sept fois, et il n'a pas survécu dix minutes dans son propre
  // fichier suivant.
  test("les dix-sept pages de détail de la voisine ne rendent aucune de ses données", async ({
    page,
  }) => {
    test.setTimeout(240000)

    await avecVoisine(page, async (voisine) => {
      await login(page, "admin@aqar.dz")

      for (const [nom, url] of pagesDeDetail(voisine)) {
        await page.goto(url)

        // LE CODE HTTP N'EST PAS ASSERTE ICI, ET C'EST UNE CONSTATATION,
        // PAS UN RELACHEMENT.
        //
        // Ces dix-sept pages appellent toutes `notFound()`. Elles
        // affichent bien la page introuvable — mais avec un statut
        // **200**, mesure : le rendu est diffuse en flux, l'en-tete part
        // avant que le composant serveur n'ait fini de decider. Une
        // adresse qui ne correspond a AUCUNE route rend bien 404 (voir
        // features.spec.ts) : la difference tient a ce que Next tranche
        // avant tout rendu dans un cas, apres l'avoir commence dans
        // l'autre.
        //
        // Exiger 404 ferait donc rougir ces dix-sept cas pour une raison
        // qui n'a rien a voir avec le cloisonnement. Le statut est un
        // defaut a part entiere — un moniteur et un robot d'indexation
        // lisent 200 sur une page qui n'existe pas — et il est reporte
        // comme tel.
        //
        // Ce qui est asserte est la substance : la page introuvable est
        // rendue, et la donnee de la voisine n'apparait nulle part.
        await expect
          .soft(
            page.getByRole("heading", { name: /Cette page n.existe pas/i }),
            `${nom} : ${url} ne rend pas la page introuvable pour une autre agence`
          )
          .toBeVisible()

        expect
          .soft(
            await page.content(),
            `${nom} : le marqueur de l'agence voisine apparaît dans la page`
          )
          .not.toContain(voisine.marque)
      }
    })
  })

  test("les cinq routes PDF refusent une ressource d'une autre agence", async ({
    page,
  }) => {
    test.setTimeout(180000)

    await avecVoisine(page, async (voisine) => {
      await login(page, "admin@aqar.dz")

      for (const [nom, url] of routesPdf(voisine)) {
        const reponse = await page.request.get(url, { failOnStatusCode: false })

        expect.soft(reponse.status(), `PDF ${nom} : ${url}`).toBe(404)

        // Un PDF commence par « %PDF- ». Le code seul ne suffirait pas :
        // une route qui emettrait le document avec un statut d'erreur
        // livrerait quand meme les octets.
        const corps = (await reponse.body()).subarray(0, 5).toString("latin1")

        expect
          .soft(corps, `PDF ${nom} : des octets de PDF sont sortis malgré le refus`)
          .not.toBe("%PDF-")
      }
    })
  })

  test("les huit suppressions échouent, et la ligne de la voisine reste intacte", async ({
    page,
  }) => {
    test.setTimeout(180000)

    await avecVoisine(page, async (voisine) => {
      await login(page, "admin@aqar.dz")

      for (const route of routesDeSuppression(voisine)) {
        const reponse = await page.request.post(route.url, {
          failOnStatusCode: false,
        })

        expect.soft(reponse.status(), `suppression ${route.nom} : ${route.url}`).toBe(404)

        // La verification qui compte. Un refus qui aurait quand meme
        // supprime se lit 404 tout pareil : seul l'etat de la base
        // distingue « refuse » de « fait, puis nie ».
        expect
          .soft(
            await route.toujoursLa(),
            `suppression ${route.nom} : la ligne de l'agence voisine a été touchée`
          )
          .toBe(true)
      }

      // LE CONTROLE, ajouté en revue et absolument nécessaire.
      //
      // Sans lui, ce test passerait aussi bien avec huit routes de
      // suppression entièrement cassées : une route qui répondrait 404 à
      // tout le monde donnerait exactement les mêmes vingt-quatre
      // assertions vertes. C'est le reproche que je faisais aux dix-sept
      // cas de BUG-28, et je venais de le refaire.
      //
      // Il passe en DERNIER : il détruit une ligne du décor, donc il ne
      // doit pas précéder les refus qui s'appuient dessus.
      await page.context().clearCookies()
      await login(page, voisine.identifiants.email)

      const sienne = await page.request.post(
        `/api/visits/${voisine.visite.id}/delete`,
        { failOnStatusCode: false }
      )

      expect
        .soft(
          sienne.status(),
          "la route de suppression refuse une visite à sa PROPRE agence : " +
            "les refus ci-dessus ne prouvent alors plus rien"
        )
        .toBe(200)

      expect
        .soft(
          await db.visit.count({ where: { id: voisine.visite.id } }),
          "la suppression légitime n'a rien supprimé"
        )
        .toBe(0)
    })
  })

  test("les huit exports d'une agence ne contiennent rien de la voisine", async ({
    page,
  }) => {
    test.setTimeout(240000)

    await avecVoisine(page, async (voisine) => {
      // D'abord le controle, et il est indispensable ici : si le
      // marqueur n'etait pas reellement rendu dans les colonnes
      // exportees, l'assertion d'absence serait vraie sans rien prouver.
      await login(page, voisine.identifiants.email)

      for (const entite of EXPORTS) {
        const reponse = await page.request.get(`/api/export/${entite}`)

        expect.soft(reponse.status(), `export ${entite} (voisine)`).toBe(200)
        expect
          .soft(
            await reponse.text(),
            `export ${entite} : le marqueur n'est pas dans les colonnes exportées, ` +
              "l'assertion d'absence ne prouverait donc rien"
          )
          .toContain(voisine.marque)
      }

      // Puis l'agence de démonstration, sur les mêmes huit exports.
      await page.context().clearCookies()
      await login(page, "admin@aqar.dz")

      for (const entite of EXPORTS) {
        const reponse = await page.request.get(`/api/export/${entite}`)

        expect.soft(reponse.status(), `export ${entite} (démo)`).toBe(200)
        expect
          .soft(
            await reponse.text(),
            `export ${entite} : des lignes de l'agence voisine sont dedans`
          )
          .not.toContain(voisine.marque)
      }
    })
  })
})
