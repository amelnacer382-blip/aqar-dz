import { test, expect } from "@playwright/test"

const BASE = `http://localhost:${process.env.PLAYWRIGHT_PORT ?? "3002"}`

/**
 * Le premier ecran de l'accueil se lit sans JavaScript (story 3.14,
 * REP-107).
 *
 * LE DEFAUT. Framer inscrit les valeurs de `initial` DANS LE STYLE RENDU
 * PAR LE SERVEUR. L'accueil etait donc livre avec 34 elements a
 * `opacity: 0` — titre, phrase d'accroche, boutons, panneau du produit —
 * et n'apparaissait qu'une fois le script execute. Mesure du 17-08-2026 :
 * LCP 3,459 s pour un TTI de 3,459 s, la meme milliseconde.
 *
 * ⚠ CE QUE CES CAS GARDENT, ET CE QU'ILS NE MESURENT PAS. Ils gardent la
 * LISIBILITE sans script, qui est une propriete binaire et stable. Ils ne
 * mesurent pas le LCP : il depend du reseau et du processeur emules, et un
 * test de duree serait instable — un test instable finit desactive. Les
 * mesures de LCP sont dans la story, faites une fois, ecrites.
 *
 * LA REGLE QUE LA STORY A POSEE : on n'anime pas l'entree de ce qui est
 * DEJA a l'ecran ; on anime l'entree de ce qui y ARRIVE. Les sections d'en
 * dessous gardent donc leurs animations Framer au defilement, et ces cas ne
 * leur demandent rien.
 */
test.describe("L'accueil sans JavaScript (story 3.14)", () => {
  test.use({ javaScriptEnabled: false })

  test("la phrase d'accroche est lisible, pas transparente", async ({
    page,
  }) => {
    test.setTimeout(120000)

    await page.goto(BASE)

    const accroche = page.getByText(/Biens, propriétaires, clients, visites/)

    await expect(
      accroche,
      "la phrase d'accroche n'est pas dans le HTML servi"
    ).toBeAttached({ timeout: 30000 })

    /**
     * L'OPACITE EFFECTIVE, celle de l'element ET de tous ses parents.
     * Framer la pose parfois sur un conteneur : ne regarder que l'element
     * laisserait passer un parent transparent, et le test serait vert sur
     * une page blanche.
     */
    /*
      ON ATTEND L'EFFET, ET IL EST DECLARE. L'entree est une animation CSS
      de 0,8 s precedee d'un delai de 0,6 s : lire l'opacite tout de suite
      la trouve a zero, et le premier jet de ce test rougissait pour cette
      raison — sur un produit correct. Ce qu'on garde n'est pas « visible a
      la milliseconde zero » mais « visible sans qu'un script s'execute ».
      Le plafond de 4 s est un multiple large de la choregraphie (0,88 s de
      delai + 0,8 s de duree au plus tard) : il rougit sur une page qui
      attend JavaScript, jamais sur une machine lente.
    */
    await expect
      .poll(
        () =>
          accroche.evaluate((noeud) => {
            let courant: HTMLElement | null = noeud as HTMLElement
            let produit = 1
            while (courant) {
              produit *= Number(getComputedStyle(courant).opacity || "1")
              courant = courant.parentElement
            }
            return produit
          }),
        {
          timeout: 4000,
          message:
            "le premier écran reste transparent sans JavaScript : l'accueil " +
            "s'affiche vide, et c'est l'élément que la mesure a désigné " +
            "comme LCP",
        }
      )
      .toBeGreaterThan(0.9)
  })

  /**
   * `CountUp` rendait `0` cote serveur. Sans JavaScript, la page annoncait
   * donc « 0 modules metier » et « 0 types de biens » : pas un ecran vide,
   * un ecran FAUX — et c'est ce que lisait aussi tout robot qui n'execute
   * pas de script.
   */
  test("les chiffres annoncés sont les vrais, pas des zéros", async ({
    page,
  }) => {
    test.setTimeout(120000)

    await page.goto(BASE)

    const modules = page.locator("dt", { hasText: /^\d+$/ }).first()

    await expect(
      modules,
      "aucun compteur dans le HTML servi"
    ).toBeAttached({ timeout: 30000 })

    const chiffres = await page
      .locator("dl dt")
      .evaluateAll((noeuds) => noeuds.map((n) => (n.textContent ?? "").trim()))

    // CONTROLE POSITIF : sans compteur, l'assertion suivante serait vide.
    expect(
      chiffres.length,
      "l'accueil n'annonce plus aucun chiffre"
    ).toBeGreaterThan(0)

    expect(
      chiffres,
      `l'accueil annonce ${JSON.stringify(chiffres)} : un compteur rendu à ` +
        `zéro par le serveur n'est pas une page vide, c'est une page fausse`
    ).not.toContain("0")

    // Et ce sont bien LES valeurs, pas n'importe quel nombre non nul.
    expect(
      chiffres,
      "les 12 modules métier ne sont plus annoncés"
    ).toContain("12")
  })
})
