import { test, expect } from "@playwright/test"
import { db } from "./db"
import { creerAgence, effacerAgence, type Agence } from "./agence"

/**
 * Le menu wilaya de la vitrine ne doit proposer que des choix qui
 * repondent — story 3.6, BUG-29.
 *
 * AUCUNE CONNEXION ICI, comme dans `vitrine-pagination.spec.ts` : la
 * vitrine est la seule page publique du logiciel, et c'est dans ces
 * conditions exactement qu'un visiteur — ou un robot — la parcourt.
 *
 * CE QUE LE DEFAUT COUTE, ET POURQUOI IL MERITE UN TEST A LUI. La liste des
 * biens filtre sur `status` ET `isAvailable`. La liste qui alimente le menu
 * ne filtrait que `status`. Un visiteur qui choisit une option PROPOSEE PAR
 * LE SITE et tombe sur zero resultat ne conclut pas « il n'y a rien » : il
 * conclut « ce site est casse », et il part — sur la page qui sert
 * d'argument commercial a l'agence.
 */

/** L'agence du cas en cours, effacee par `afterEach`. */
let courante: Agence | null = null

/**
 * Deux wilayas, et une seule doit survivre au filtre.
 *
 * Alger : un bien publie, disponible.
 * Oran  : un bien publie mais RETIRE DE LA VENTE (`isAvailable: false`).
 *
 * Les deux ont `status: "disponible"` — c'est le point du defaut : la
 * seconde requete ne regardait que ce champ-la.
 */
async function batir() {
  const agence = await creerAgence(["agency_admin"])
  courante = agence

  const agencyId = agence.agence.id
  const marque = agence.marque

  const commun = {
    category: "residentiel" as const,
    type: "appartement" as const,
    operationType: "vente" as const,
    commune: "Centre",
    salePrice: 18_000_000,
    agencyId,
  }

  const visible = await db.property.create({
    data: {
      ...commun,
      title: `Bien visible ${marque}`,
      wilaya: "Alger",
      status: "disponible",
      isAvailable: true,
    },
  })

  const retire = await db.property.create({
    data: {
      ...commun,
      title: `Bien retiré ${marque}`,
      wilaya: "Oran",
      status: "disponible",
      isAvailable: false,
    },
  })

  return { agence, marque, slug: agence.agence.slug as string, visible, retire }
}

/**
 * Nettoyage par `afterEach`, jamais par `finally` : un depassement de delai
 * n'execute pas un `finally` (CLAUDE.md §6).
 */
test.afterEach(async () => {
  if (courante) {
    await effacerAgence(courante)
    courante = null
  }
})

test.describe("le filtre wilaya de la vitrine (story 3.6)", () => {
  test("une wilaya sans bien disponible n'est pas proposée", async ({ page }) => {
    const decor = await batir()

    await page.goto(`/vitrine/${decor.slug}`)

    const options = await page.locator("#wilaya option").allTextContents()

    // CONTROLE POSITIF D'ABORD. Sans lui, un menu vide — ou une page qui ne
    // s'affiche pas du tout — rendrait l'assertion suivante vraie sans
    // rien prouver.
    expect(
      options,
      "la wilaya qui a un bien disponible doit rester proposée : " +
        "sans elle, l'absence de l'autre ne prouverait rien"
    ).toContain("Alger")

    expect(
      options,
      "« Oran » est proposé alors que son seul bien est retiré de la vente : " +
        "le visiteur choisira une option qui ne renvoie rien"
    ).not.toContain("Oran")
  })

  test("le bien retiré n'est ni listé, ni atteignable par le filtre", async ({
    page,
  }) => {
    const decor = await batir()

    // La liste, elle, faisait deja son travail : c'est l'ecart entre les
    // deux requetes qui est le defaut, pas la liste.
    await page.goto(`/vitrine/${decor.slug}`)
    await expect(page.getByText(decor.visible.title)).toBeVisible()
    await expect(page.getByText(decor.retire.title)).toHaveCount(0)

    // Et voici ce que le menu promettait : une page vide.
    await page.goto(`/vitrine/${decor.slug}?wilaya=Oran`)
    await expect(
      page.getByText("Aucun bien ne correspond à votre recherche")
    ).toBeVisible()

    // Le controle positif du chemin inverse : le filtre FONCTIONNE quand la
    // wilaya a un bien. Sans ce cas, un filtre casse pour tout le monde
    // donnerait exactement le meme vert que le filtre corrige.
    await page.goto(`/vitrine/${decor.slug}?wilaya=Alger`)
    await expect(page.getByText(decor.visible.title)).toBeVisible()
  })
})
