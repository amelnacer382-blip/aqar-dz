import { test, expect } from "@playwright/test"

const BASE = `http://localhost:${process.env.PLAYWRIGHT_PORT ?? "3002"}`

/**
 * Les photographies passent par l'optimiseur (story 3.7).
 *
 * ⚠ CE QUE CES CAS GARDENT, ET CE QU'ILS NE MESURENT PAS. Ils gardent des
 * PROPRIETES : que les images traversent `/_next/image`, qu'elles occupent
 * reellement leur place, et que le bandeau reste visible sans JavaScript.
 *
 * Ils ne mesurent NI le poids NI le LCP. Ces deux-la dependent de la
 * fenetre, du reseau et du processeur emules ; mesures dans un test ils
 * seraient instables, et un test instable finit desactive. Les mesures sont
 * dans la story, faites une fois, ecrites, non rejouees — comme celles de
 * `tests/comptage.spec.ts`.
 */
test.describe("Les images de la vitrine (story 3.7)", () => {
  test("chaque photo servie passe par l'optimiseur", async ({ page }) => {
    test.setTimeout(120000)

    await page.goto(`${BASE}/vitrine/agence-demo`)

    const sources = await page
      .locator("img")
      .evaluateAll((imgs) =>
        imgs.map((i) => (i as HTMLImageElement).getAttribute("src") ?? "")
      )

    // CONTROLE POSITIF, et il n'est pas decoratif : sur une page sans
    // aucune image, l'assertion suivante serait vraie et ne dirait rien.
    expect(
      sources.length,
      "la vitrine ne porte plus aucune image : l'assertion suivante serait " +
        "vide de sens"
    ).toBeGreaterThan(0)

    for (const src of sources) {
      expect(
        src,
        `« ${src.slice(0, 60)} » est servie telle quelle : c'est le JPEG brut ` +
          `d'origine, non redimensionné et non converti (story 3.7)`
      ).toContain("/_next/image")
    }
  })

  /**
   * `fill` occupe le PARENT. Un parent qui n'est ni `relative` ni
   * `absolute` laisse l'image se positionner contre un ancetre plus haut ;
   * un parent sans hauteur la fait disparaitre. Les deux cassent l'ecran
   * SANS casser le chargement — `naturalWidth` reste non nul, et un test
   * qui se contenterait de « l'image charge » resterait vert sur une page
   * ruinee.
   *
   * On mesure donc la BOITE, la seule chose qui distingue les deux cas.
   */
  test("chaque photo occupe réellement sa place", async ({ page }) => {
    test.setTimeout(120000)

    for (const url of ["/vitrine/agence-demo", "/auth/login"]) {
      await page.goto(`${BASE}${url}`)

      const images = page.locator("img")
      const nombre = await images.count()

      expect(nombre, `${url} ne porte aucune image`).toBeGreaterThan(0)

      for (let i = 0; i < nombre; i++) {
        const boite = await images.nth(i).boundingBox()
        const src = (await images.nth(i).getAttribute("src")) ?? ""

        expect(
          boite,
          `${url} : une image n'a aucune boîte — son conteneur s'est effondré ` +
            `(« fill » sur un parent sans hauteur)`
        ).not.toBeNull()

        expect(
          (boite?.width ?? 0) > 0 && (boite?.height ?? 0) > 0,
          `${url} : « ${src.slice(-50)} » occupe ${boite?.width}×${boite?.height}`
        ).toBe(true)

        /**
         * ET ELLE TIENT DANS SON CONTENEUR. Cette assertion a ete AJOUTEE
         * CONTRE UNE MUTATION QUI PASSAIT : en retirant le `relative` du
         * parent d'une image en `fill`, les trois cas restaient VERTS.
         * L'image chargeait, elle avait une boite — simplement pas celle-la.
         * `fill` la positionne contre le plus proche ancetre positionne :
         * sans `relative` sur son conteneur, elle se cale sur la page
         * entiere et recouvre l'ecran.
         *
         * Deborder de plus d'un pixel, c'est ce cas-la et pas un autre.
         */
        const debordement = await images.nth(i).evaluate((img) => {
          const parent = img.parentElement
          if (!parent) return 0
          const i0 = img.getBoundingClientRect()
          const p0 = parent.getBoundingClientRect()
          return Math.max(
            p0.top - i0.top,
            p0.left - i0.left,
            i0.bottom - p0.bottom,
            i0.right - p0.right
          )
        })

        expect(
          debordement,
          `${url} : « ${src.slice(-50)} » déborde de son conteneur de ` +
            `${Math.round(debordement)} px — « fill » sur un parent qui n'est ` +
            `ni relative ni absolute`
        ).toBeLessThanOrEqual(1)
      }
    }
  })
})

/**
 * Le bandeau de la vitrine reste visible SANS JavaScript.
 *
 * Framer ecrit les valeurs de `initial` dans le style rendu par le serveur.
 * Tant que la premiere photo partait de `opacity: 0`, le plus grand element
 * de la page etait invisible dans le HTML livre : elle n'apparaissait
 * qu'apres hydratation.
 *
 * ⚠ CE QUE CE CAS NE PROUVE PAS. Il ne prouve pas que le LCP s'ameliore —
 * la mesure du 17-08-2026 a DEMENTI cette hypothese, Lighthouse ne bouge
 * pas d'un dixieme. Il prouve la propriete pour elle-meme : la vitrine est
 * l'argument commercial du produit, et elle ne doit pas dependre de
 * l'execution d'un script pour montrer sa photo.
 */
test.describe("Sans JavaScript", () => {
  test.use({ javaScriptEnabled: false })

  test("le bandeau de la vitrine montre sa photo", async ({ page }) => {
    test.setTimeout(120000)

    await page.goto(`${BASE}/vitrine/agence-demo`)

    const fond = page.locator('img[src*="/_next/image"]').first()

    await expect(
      fond,
      "aucune photo optimisée dans le HTML servi : le bandeau dépend du " +
        "navigateur pour exister"
    ).toBeAttached({ timeout: 30000 })

    const opacite = await fond.evaluate((img) => {
      // L'opacite EFFECTIVE, celle de l'element et de ses parents : Framer
      // la pose sur le conteneur anime, pas sur l'image.
      let noeud: HTMLElement | null = img as HTMLElement
      let produit = 1
      while (noeud) {
        produit *= Number(getComputedStyle(noeud).opacity || "1")
        noeud = noeud.parentElement
      }
      return produit
    })

    expect(
      opacite,
      "la photo du bandeau est transparente dans le HTML servi : sans " +
        "JavaScript, la vitrine s'affiche vide"
    ).toBeGreaterThan(0.9)
  })
})
