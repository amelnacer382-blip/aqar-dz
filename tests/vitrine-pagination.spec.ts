import { test, expect, Page } from "@playwright/test"
import { db } from "./db"
import { creerAgence, effacerAgence, type Agence } from "./agence"

/**
 * La pagination de la vitrine publique — story 3.4, BUG-08.
 *
 * AUCUNE CONNEXION DANS CE FICHIER, et c'est fidele : la vitrine est la
 * seule page publique du logiciel. Un robot d'indexation la parcourt dans
 * ces conditions exactement.
 *
 * CE FICHIER MESURE, il ne se contente pas d'un invariant. La story 3.3
 * gardait la FORME d'une requete faute de pouvoir observer son cout — qui
 * ne quittait pas le serveur. Ici, le poids servi EST la grandeur du
 * defaut : il se lit par `page.request.get()`, donc on le lit.
 */

/** 40 appartements et 20 villas : 60 biens, deux familles inegales. */
const APPARTEMENTS = 40
const VILLAS = 20
const TOTAL = APPARTEMENTS + VILLAS

/** Taille de page du contrat commun (`lib/list-params.ts`). */
const PAR_PAGE = 25

/**
 * Plafond de poids d'UNE page, en octets.
 *
 * MESURE DU 17-08-2026, sur 300 biens publies de cette forme exactement :
 *   sans borne : 2 302 954 octets, 399 ms
 *   avec borne :   222 231 octets, 210 ms
 *
 * Soit ~7,7 Ko par bien servi. Les 60 biens de ce decor peseraient donc
 * ~490 Ko sans pagination, contre ~220 Ko pour une page de 25. Le seuil
 * est pose ENTRE LES DEUX, largement : c'est un test de tenue a la charge,
 * pas de mise en page. Une refonte du graphisme ne doit pas le faire
 * rougir ; la disparition de la borne, si.
 */
const PLAFOND_OCTETS = 380_000

async function garnirVitrine(agence: Agence) {
  const agencyId = agence.agence.id

  const proprietaire = await db.owner.create({
    data: { firstName: "Proprietaire", lastName: agence.marque, agencyId },
  })

  for (let i = 0; i < TOTAL; i++) {
    const bien = await db.property.create({
      data: {
        // Le rang est dans le titre : c'est lui qui permet de dire que la
        // page 2 ne montre PAS les memes biens que la page 1.
        title: `Bien ${String(i).padStart(3, "0")} ${agence.marque}`,
        description:
          "Bel appartement lumineux, proche des commodites, cuisine equipee. ".repeat(
            4
          ),
        category: "residentiel",
        type: i < APPARTEMENTS ? "appartement" : "villa",
        operationType: "vente",
        wilaya: "Alger",
        commune: "Hydra",
        address: "12 rue des Freres Bouadou",
        salePrice: 25_000_000,
        surface: 120,
        rooms: 4,
        bedrooms: 3,
        bathrooms: 2,
        agencyId,
        ownerId: proprietaire.id,
      },
    })

    await db.propertyImage.create({
      data: {
        propertyId: bien.id,
        url: `/uploads/properties/${agencyId}/photo-${i}.jpg`,
        isMain: true,
        sortOrder: 0,
      },
    })
  }

  return proprietaire
}

/** Les titres des biens rendus sur la page courante, dans l'ordre. */
async function biensAffiches(page: Page): Promise<string[]> {
  return page.locator('a[href*="/biens/"] h3, a[href*="/biens/"] h2').allInnerTexts()
}

test.describe("La pagination de la vitrine publique (story 3.4)", () => {
  let agence: Agence | null = null

  // Nettoyage par `afterEach`, jamais par `finally` (CLAUDE.md §6).
  test.afterEach(async () => {
    if (agence) {
      await effacerAgence(agence)
      agence = null
    }
  })

  test("la page est bornée, et le bandeau annonce quand même le total", async ({
    page,
  }) => {
    test.setTimeout(180000)

    agence = await creerAgence()
    await garnirVitrine(agence)
    const slug = agence.agence.slug!

    await page.goto(`/vitrine/${slug}`)

    const cartes = page.locator('a[href*="/biens/"]')

    await expect(
      cartes,
      `la vitrine sert ${TOTAL} biens d'un coup : la page n'est pas bornée`
    ).toHaveCount(PAR_PAGE, { timeout: 30000 })

    // LE PIEGE DE §8. Branche sur la liste paginee, ce nombre annoncerait
    // 25 a toutes les agences du produit — c'est l'argument commercial de
    // l'agence, affiche en tres gros dans le bandeau.
    await expect(
      page.locator("header"),
      `le bandeau n'annonce plus les ${TOTAL} biens de l'agence : il compte ` +
        `la page courante au lieu du catalogue`
    ).toContainText(String(TOTAL))

    // Le poids servi, qui est la grandeur meme du defaut.
    const reponse = await page.request.get(`/vitrine/${slug}`)
    const octets = (await reponse.body()).byteLength

    expect(
      octets,
      `la vitrine sert ${octets.toLocaleString("fr-FR")} octets pour ${TOTAL} ` +
        `biens publiés — au-delà du plafond de ${PLAFOND_OCTETS.toLocaleString("fr-FR")}, ` +
        `la page n'est plus bornée`
    ).toBeLessThan(PLAFOND_OCTETS)
  })

  test("la page 2 montre d'autres biens, et le filtre lui survit", async ({
    page,
  }) => {
    test.setTimeout(180000)

    agence = await creerAgence()
    await garnirVitrine(agence)
    const slug = agence.agence.slug!

    // 40 appartements : deux pages pleines et une entamée, donc un vrai
    // « Suivant » a suivre.
    await page.goto(`/vitrine/${slug}?type=appartement`)

    await expect(
      page.locator("header"),
      "le bandeau ne compte pas les biens du FILTRE : le nombre annoncé doit " +
        "suivre la recherche, comme avant la pagination"
    ).toContainText(String(APPARTEMENTS))

    const page1 = await biensAffiches(page)
    expect(page1.length, "la page 1 filtrée n'est pas bornée").toBe(PAR_PAGE)

    // Le lien « Suivant » est un vrai lien : c'est ce qu'un robot suit.
    await page.locator('a:has-text("Suivant")').click()
    await page.waitForURL(/page=2/, { timeout: 30000 })

    expect(
      new URL(page.url()).searchParams.get("type"),
      "changer de page a PERDU le filtre : le visiteur retombe sur tout le " +
        "catalogue après avoir cherché"
    ).toBe("appartement")

    const page2 = await biensAffiches(page)

    expect(
      page2.length,
      "la page 2 est vide alors que le filtre porte sur 40 biens"
    ).toBeGreaterThan(0)

    // LE CONTROLE QUI COMPTE : sans `skip`, la page 2 rendrait EXACTEMENT
    // les memes biens que la page 1, et tout le reste resterait vert.
    expect(
      page2.some((titre) => page1.includes(titre)),
      "la page 2 montre les mêmes biens que la page 1 : le décalage n'est pas " +
        "appliqué, la pagination ne pagine rien"
    ).toBe(false)

    // Le filtre est applique sur les DEUX pages, pas seulement la premiere.
    const villas = page.locator('a[href*="/biens/"]', { hasText: "Villa" })
    await expect(
      villas,
      "une villa ressort sur une recherche d'appartements en page 2"
    ).toHaveCount(0)
  })

  test("une page au-delà de la dernière le dit, au lieu de mentir", async ({
    page,
  }) => {
    test.setTimeout(180000)

    agence = await creerAgence()
    await garnirVitrine(agence)
    const slug = agence.agence.slug!

    await page.goto(`/vitrine/${slug}?page=99`)

    // CE CAS N'EXISTAIT PAS AVANT LA PAGINATION (§8). Sans traitement, le
    // visiteur voit une grille vide sans un mot — ou pire, « aucun bien ne
    // correspond », ce qui est faux et le fait repartir.
    await expect(
      page.locator("main"),
      "une page hors bornes ne dit pas au visiteur ce qui se passe"
    ).toContainText("Cette page n'existe pas", { timeout: 30000 })

    await expect(
      page.locator("main"),
      `la page hors bornes n'indique pas que l'agence propose ${TOTAL} biens`
    ).toContainText(String(TOTAL))
  })

  test("chaque page porte son propre titre", async ({ page }) => {
    test.setTimeout(180000)

    agence = await creerAgence()
    await garnirVitrine(agence)
    const slug = agence.agence.slug!

    // Le gabarit racine ajoute « · Aqar DZ » a tous les titres : les motifs
    // ne s'ancrent donc pas sur la fin, sinon ce cas rougirait pour une
    // raison qui n'a rien a voir avec la pagination.
    await page.goto(`/vitrine/${slug}`)
    await expect(
      page,
      "la première page s'annonce comme une page numérotée"
    ).not.toHaveTitle(/page \d/)

    // Sans numero, `?page=2` et `?page=3` sont du contenu duplique annonce
    // sous un titre identique — pour un ecran dont l'AC-2 parle du robot
    // d'indexation.
    await page.goto(`/vitrine/${slug}?page=2`)
    await expect(
      page,
      "la page 2 porte le même titre que la page 1"
    ).toHaveTitle(/— page 2/)
  })
})
