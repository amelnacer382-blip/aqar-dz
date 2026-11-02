import { test, expect, Page } from "@playwright/test"
import { login } from "./auth-helper"
import { creerAgence, effacerAgence, Agence } from "./agence"

const BASE = `http://localhost:${process.env.PLAYWRIGHT_PORT ?? "3002"}`

/**
 * La barre de l'espace agence n'affiche que ce qui s'ouvre.
 *
 * REP-78 : `AgencyNavbar.tsx` rendait ses dix-sept liens a tout le monde,
 * alors que CINQ cibles sont gardees par `requireAgencyAdmin()`. Le chemin
 * etait correctement traite — la story 4.3 avait remplace l'ejection muette
 * par un message lisible — mais un agent voyait en permanence cinq portes
 * qui ne s'ouvriraient jamais pour lui.
 *
 * ARBITRAGE DE L'EDITEUR (14-08-2026) : MASQUER, plutot que desactiver. Le
 * motif est dans la story 5.13 — un outil de terrain se juge a ce qu'il ne
 * demande pas de comprendre.
 *
 * CE QUE CE FICHIER NE PROUVE PAS, ET C'EST VOLONTAIRE : masquer un lien ne
 * garde rien. `lib/auth-guard.ts` reste la seule couche d'autorisation
 * (`CLAUDE.md` §5). Le troisieme cas est la pour que ce fichier ne soit
 * JAMAIS lu comme une preuve de protection.
 *
 * DELAI : 240 s. `login()` traverse a lui seul 150 s de delais (goto 60 s
 * puis waitForURL 90 s, `auth-helper.ts`) et chaque cas ajoute ses propres
 * attentes. Un plafond inferieur a la somme qu'il encadre produit un
 * « Test timeout exceeded » qui ne designe aucune propriete (§6, REP-85).
 */

/** Les cinq entrees gardees par `requireAgencyAdmin()`. */
const RESERVEES = ["Vitrine", "Corbeille", "Comptes", "Journal", "Paramètres"]

/** Une entree que TOUT role peut ouvrir — sert d'ancrage positif. */
const COMMUNE = "Biens"

/**
 * Ouvre le menu mobile, ou tous les liens sont a plat.
 *
 * Le menu mobile est le seul endroit ou les dix-sept entrees sont rendues
 * SANS deroulant : sur le bureau, cinq d'entre elles vivent dans « Plus »,
 * qu'il faudrait ouvrir pour les voir. Une assertion d'absence sur le
 * bureau serait donc verte sans rien prouver — l'entree serait simplement
 * repliee. Le viewport est force ici parce que `npm run test:e2e` ne joue
 * que `chromium` (REP-80) : dependre d'un projet mobile jamais execute ne
 * prouverait rien.
 */
async function ouvrirMenuAplat(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}/agency`)
  await page.getByRole("button", { name: /Ouvrir le menu/i }).click()

  // L'ANCRAGE POSITIF, obligatoire (§6, piege 1) : sans lui, toutes les
  // assertions d'absence ci-dessous seraient vertes sur un menu qui ne
  // s'ouvre pas — elles ne testeraient plus rien.
  await expect(page.getByRole("link", { name: COMMUNE })).toBeVisible()
}

test.describe("Barre de l'espace agence, selon le rôle", () => {
  let agence: Agence

  test.beforeEach(async () => {
    // Un compte jetable par cas : les comptes de demonstration sont
    // partages par toute la suite (`CLAUDE.md` §3).
    agence = await creerAgence(["agency_admin", "agent"])
  })

  // `afterEach` et JAMAIS `finally` : un depassement de delai n'execute pas
  // un `finally`, et c'est ainsi qu'un compte a mot de passe connu a failli
  // rester en base (`CLAUDE.md` §6).
  test.afterEach(async () => {
    if (agence) await effacerAgence(agence)
  })

  test("un agent ne voit aucune des cinq entrées réservées", async ({ page }) => {
    test.setTimeout(240000)
    const agent = agence.comptes.find((c) => c.role === "agent")!
    await login(page, agent.email, agent.motDePasse)

    await ouvrirMenuAplat(page)

    for (const entree of RESERVEES) {
      await expect(
        page.getByRole("link", { name: entree, exact: true })
      ).toHaveCount(0)
    }
  })

  /**
   * LE CONTROLE POSITIF, et il est obligatoire.
   *
   * Le cas ci-dessus serait tout aussi vert si le masquage avait casse la
   * barre pour TOUT LE MONDE — cinq entrees absentes parce qu'aucune n'est
   * rendue. Celui-ci etablit qu'un administrateur les voit, donc que le
   * vert du premier vient bien du filtrage par role.
   */
  test("contrôle positif : un administrateur voit les cinq entrées", async ({
    page,
  }) => {
    test.setTimeout(240000)
    await login(page, agence.admin!.email, agence.admin!.motDePasse)

    await ouvrirMenuAplat(page)

    for (const entree of RESERVEES) {
      await expect(
        page.getByRole("link", { name: entree, exact: true })
      ).toBeVisible()
    }
  })

  /**
   * MASQUER N'EST PAS GARDER, et ce cas existe pour l'ecrire dans la suite.
   *
   * Le jour ou quelqu'un lira le filtrage d'`AgencyNavbar.tsx` comme une
   * protection et allegera `requireAgencyAdmin()`, c'est ce test — et lui
   * seul — qui l'arretera.
   */
  test("masquer n'est pas garder : l'accès direct reste refusé", async ({
    page,
  }) => {
    test.setTimeout(240000)
    const agent = agence.comptes.find((c) => c.role === "agent")!
    await login(page, agent.email, agent.motDePasse)

    await page.goto(`${BASE}/agency/users`)

    // On attend l'EFFET, jamais un code HTTP : un refus arrive en 200 a
    // cause des `loading.tsx`, et c'est le navigateur qui redirige
    // (`CLAUDE.md` §6, piege 2). Jamais `networkidle` (§2).
    await page.waitForURL(/\/agency(\?|$)/, { timeout: 30000 })
    await expect(
      page.getByRole("heading", { name: /Comptes/i })
    ).toHaveCount(0)
  })

  /**
   * LE CHEMIN DU BUREAU, qui n'est pas celui du menu a plat.
   *
   * Les trois cas ci-dessus passent par le menu mobile. Sur le bureau, les
   * liens sont rendus par un AUTRE chemin — la rangee principale et deux
   * deroulants — et « Vitrine » y vit dans la rangee principale. Un filtre
   * pose sur une seule des deux vues laisserait l'autre entiere, et aucun
   * des cas precedents ne le verrait.
   */
  test("sur le bureau aussi, les cinq entrées sont masquées", async ({
    page,
  }) => {
    test.setTimeout(240000)
    const agent = agence.comptes.find((c) => c.role === "agent")!
    await login(page, agent.email, agent.motDePasse)

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${BASE}/agency`)

    // Ancrage positif : la rangee principale est bien rendue.
    await expect(page.getByRole("link", { name: COMMUNE })).toBeVisible()

    // « Vitrine » vit dans la rangee principale.
    await expect(
      page.getByRole("link", { name: "Vitrine", exact: true })
    ).toHaveCount(0)

    /**
     * LES QUATRE AUTRES VIVENT DANS LE DEROULANT « PLUS », et il faut
     * l'ouvrir pour les voir. Sans ce geste, une assertion d'absence serait
     * verte parce que l'entree est REPLIEE, pas parce qu'elle est masquee —
     * exactement le piege 1 de §6. Releve en revue le 15-08-2026 : le
     * premier jet ne verifiait que « Vitrine » cote bureau.
     */
    await page.getByRole("button", { name: /^Plus$/ }).click()

    // Ancrage positif du deroulant : une entree qu'un agent PEUT ouvrir.
    await expect(
      page.getByRole("menuitem", { name: "Documents", exact: true })
    ).toBeVisible()

    for (const entree of ["Corbeille", "Comptes", "Journal", "Paramètres"]) {
      await expect(
        page.getByRole("menuitem", { name: entree, exact: true })
      ).toHaveCount(0)
    }
  })
})
