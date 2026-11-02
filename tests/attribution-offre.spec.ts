import { test, expect, Page } from "@playwright/test"
import { login, identiteAppelant } from "./auth-helper"
import { db } from "./db"
import { creerAgence, effacerAgence, type Agence } from "./agence"

/**
 * L'attribution de l'offre a l'approbation — story 6.3.
 *
 * CE QUE CE FICHIER PROUVE.
 *  1. la console montre l'offre DEMANDEE a cote de l'offre ATTRIBUEE, et
 *     « aucune » quand il n'y a pas eu de demande (FR-6) ;
 *  2. approuver sans toucher au selecteur attribue l'offre demandee, EN UN
 *     SEUL CLIC ; en choisir une autre attribue celle-la (FR-7) ;
 *  3. l'ecart demande → attribution est journalise (FR-7) ;
 *  4. un `agency_admin` qui rejoue l'action de changement d'offre est
 *     refuse — le controle est DANS L'ACTION, pas dans l'ecran (FR-8).
 */

/**
 * Rejoue un formulaire de la console vers une ADRESSE EXPLICITE.
 *
 * MESURE DU 16-08-2026, ET ELLE A COUTE UN TEST ROUGE. Une Server Action
 * ne se rejoue PAS depuis n'importe quelle route : Next resout
 * l'identifiant d'action dans le manifeste de la route VISEE. Postee vers
 * `/`, qui ne rend pas cette action, elle leve
 * `TypeError: e[o] is not a function` dans `decodeAction` — cote serveur,
 * en 500, sans jamais atteindre la garde.
 *
 * L'adresse est donc POSEE sur le formulaire au lieu d'etre heritee de
 * l'URL courante. C'est plus fidele a ce qu'on simule — un POST forge
 * choisit sa cible — et cela permet aux deux jambes du controle de viser
 * exactement la meme, meme quand elles ne peuvent pas stationner au meme
 * endroit.
 *
 * L'identifiant d'action n'est jamais ecrit ici : il vient du HTML releve
 * a l'execution, parce qu'il est calcule au `build`. Fige dans un test, il
 * le rendrait vert en ne testant plus rien (BUG-28).
 */
async function rejouer(
  page: Page,
  depuis: string,
  cible: string,
  formHtml: string,
  champs: Record<string, string>
) {
  await page.goto(depuis)

  await Promise.all([
    page.waitForNavigation({ timeout: 30000 }),
    page.evaluate(
      ({ html, valeurs, adresse }) => {
        const hote = document.createElement("div")
        hote.innerHTML = html

        const form = hote.querySelector("form") as HTMLFormElement

        // Les controles existants sont remplaces par des champs caches :
        // un `select` n'accepte pas une valeur absente de ses options, et
        // un POST forge n'utilise de toute facon pas l'ecran.
        for (const nom of Object.keys(valeurs)) {
          form.querySelector(`[name="${nom}"]`)?.remove()

          const champ = document.createElement("input")
          champ.type = "hidden"
          champ.name = nom
          champ.value = valeurs[nom]
          form.appendChild(champ)
        }

        form.setAttribute("action", adresse)
        document.body.appendChild(form)
        form.submit()
      },
      { html: formHtml, valeurs: champs, adresse: cible }
    ),
  ])
}

/** Le formulaire d'approbation de cette agence, tel qu'il est rendu. */
async function formulaireApprobation(page: Page, agencyId: string) {
  const formulaire = page.locator(
    `form:has(input[name="agencyId"][value="${agencyId}"]):has(input[value="active"])`
  )

  await expect(
    formulaire,
    "aucun formulaire d'approbation pour cette agence"
  ).toBeAttached({ timeout: 15000 })

  return formulaire.evaluate((el) => (el as HTMLFormElement).outerHTML)
}

test.describe("L'attribution de l'offre (story 6.3)", () => {
  let agence: Agence | null = null

  // Nettoyage par `afterEach`, jamais par `finally` : un depassement de
  // delai n'execute pas un `finally` (CLAUDE.md §6).
  test.afterEach(async () => {
    if (agence) {
      await effacerAgence(agence)
      agence = null
    }
  })

  test("approuver sans toucher au sélecteur attribue l'offre demandée, en un clic", async ({
    page,
  }) => {
    test.setTimeout(120000)

    agence = await creerAgence()
    const id = agence.agence.id

    // `creerAgence()` pose une agence ACTIVE et sans demande : on la remet
    // dans l'etat qui nous interesse — en attente, ayant demande Pro.
    await db.agency.update({
      where: { id },
      data: { status: "pending", plan: "starter", requestedPlan: "pro" },
    })

    await login(page, "superadmin@aqar.dz")
    await page.goto("/admin/agencies")

    const ligne = page.locator("tr", { hasText: agence.agence.name })

    // FR-6 : les deux offres se lisent, et c'est leur ecart qui informe.
    await expect(
      ligne,
      "la ligne n'affiche pas l'offre demandée par l'agence"
    ).toContainText("Demandée : Pro")
    await expect(
      ligne,
      "la ligne n'affiche pas l'offre actuellement attribuée"
    ).toContainText("Starter")

    // UN SEUL CLIC, sans toucher au selecteur : c'est le cas courant, et
    // c'est ce que FR-7 exige. Le selecteur est pre-rempli avec la
    // demande, donc ne rien faire revient a l'accorder.
    await ligne.locator('form:has(input[value="active"]) button').click()

    await expect(ligne, "l'agence n'a pas été activée").toContainText(
      "Active",
      { timeout: 30000 }
    )

    const apres = await db.agency.findUniqueOrThrow({
      where: { id },
      select: { status: true, plan: true, requestedPlan: true },
    })

    expect(apres.status, "l'agence n'est pas active").toBe("active")
    expect(
      apres.plan,
      "approuver n'a pas attribué l'offre demandée — l'éditeur croit avoir vendu Pro et l'agence reste en Starter"
    ).toBe("pro")

    // La DEMANDE n'est pas effacee par l'attribution : c'est elle qui
    // permettra plus tard de dire ce qui avait ete demande.
    expect(apres.requestedPlan, "la demande a été écrasée par l'attribution").toBe(
      "pro"
    )

    // FR-7 : l'ecart est journalise, nomme des deux cotes.
    const trace = await db.auditLog.findFirst({
      where: { entityId: id, entity: "agence" },
      orderBy: { createdAt: "desc" },
      select: { summary: true, userName: true },
    })

    expect(
      trace?.summary,
      "le journal ne dit pas quelle offre a été demandée puis attribuée"
    ).toContain("demandée Pro")
    expect(trace?.summary).toContain("attribuée Pro")
  })

  test("choisir une autre offre que celle demandée attribue celle-là, et le dit au journal", async ({
    page,
  }) => {
    test.setTimeout(120000)

    agence = await creerAgence()
    const id = agence.agence.id

    await db.agency.update({
      where: { id },
      data: { status: "pending", plan: "starter", requestedPlan: "enterprise" },
    })

    await login(page, "superadmin@aqar.dz")
    await page.goto("/admin/agencies")

    // L'editeur ne vend pas ce qu'il n'a pas encaisse : Enterprise a été
    // demandé, il accorde Starter.
    const html = await formulaireApprobation(page, id)
    await rejouer(page, "/admin/agencies", "/admin/agencies", html, {
      status: "active",
      plan: "starter",
    })

    const apres = await db.agency.findUniqueOrThrow({
      where: { id },
      select: { status: true, plan: true, requestedPlan: true },
    })

    expect(apres.status).toBe("active")
    expect(
      apres.plan,
      "l'offre choisie par l'éditeur n'a pas primé sur celle demandée"
    ).toBe("starter")
    expect(apres.requestedPlan, "la demande a été écrasée").toBe("enterprise")

    const trace = await db.auditLog.findFirst({
      where: { entityId: id, entity: "agence" },
      orderBy: { createdAt: "desc" },
      select: { summary: true, userName: true, userId: true },
    })

    // QUI, QUAND, QUELLE AGENCE, ET L'ECART. Sans l'ecart, le journal
    // enregistre une decision sans son contexte, et ne repond pas a la
    // seule question qu'on lui posera : « on m'avait promis Enterprise ».
    expect(
      trace?.summary,
      "le journal ne porte pas l'écart entre ce qui a été demandé et ce qui a été attribué"
    ).toContain("demandée Enterprise")
    expect(trace?.summary).toContain("attribuée Starter")
    expect(trace?.summary).toContain(agence.agence.name)
    expect(trace?.userId, "le journal ne dit pas qui a tranché").toBeTruthy()
  })

  test("suspendre une agence ne touche pas à son offre", async ({ page }) => {
    test.setTimeout(120000)

    /**
     * CE QUE LA STORY 6.3 A RENDU ATTEIGNABLE (CLAUDE.md §8). Le geste de
     * changement de statut ecrit desormais aussi l'offre. Les boutons
     * « suspendre » et « remettre en attente » ne portent pas ce champ —
     * et une absence doit laisser l'offre INTACTE.
     *
     * Le jour ou quelqu'un remplacera l'absence par un defaut, chaque
     * suspension retrogradera l'agence en Starter, silencieusement.
     */
    agence = await creerAgence()
    const id = agence.agence.id

    await db.agency.update({
      where: { id },
      data: { status: "active", plan: "enterprise" },
    })

    await login(page, "superadmin@aqar.dz")
    await page.goto("/admin/agencies")

    const ligne = page.locator("tr", { hasText: agence.agence.name })
    await ligne.locator('form:has(input[value="suspended"]) button').click()

    await expect(ligne, "l'agence n'a pas été suspendue").toContainText(
      "Suspendue",
      { timeout: 30000 }
    )

    const apres = await db.agency.findUniqueOrThrow({
      where: { id },
      select: { status: true, plan: true },
    })

    // Le controle positif de ce cas est la suspension elle-meme : sans
    // elle, une action cassee laisserait l'offre intacte pour la mauvaise
    // raison, et ce test serait vert sur un produit mort.
    expect(apres.status, "la suspension n'a pas eu lieu").toBe("suspended")
    expect(
      apres.plan,
      "suspendre une agence a changé son offre"
    ).toBe("enterprise")
  })

  test("un agency_admin ne peut pas s'attribuer une offre en rejouant l'action", async ({
    page,
  }) => {
    test.setTimeout(120000)

    agence = await creerAgence()
    const id = agence.agence.id

    await db.agency.update({ where: { id }, data: { plan: "starter" } })

    // Le formulaire est relevé en tant que super administrateur : c'est le
    // seul moyen d'obtenir l'identifiant d'action, et c'est exactement ce
    // dont dispose quelqu'un qui a vu passer un POST.
    await login(page, "superadmin@aqar.dz")
    await page.goto("/admin/settings")

    const formulaire = page.locator(
      `form:has(input[name="agencyId"][value="${id}"]):has(select[name="plan"])`
    )
    await expect(formulaire).toBeAttached({ timeout: 15000 })

    const html = await formulaire.evaluate(
      (el) => (el as HTMLFormElement).outerHTML
    )

    /*
      LES DEUX JAMBES VISENT LA MEME ADRESSE, ET C'EST LE POINT.

      Aucun des deux comptes ne peut STATIONNER au meme endroit : un
      `agency_admin` est renvoye de `/admin/settings` avant d'y arriver, un
      `super_admin` est renvoye de `/agency`. Ce qui doit coincider, ce
      n'est pas la page ou se trouve le navigateur — c'est la CIBLE DU
      POST. Le serveur ne voit que celle-la.

      Premiere version de ce test : les deux partaient de `/`, en heritant
      de l'URL courante. Le controle positif est tombe, et il a bien fait —
      une Server Action ne se resout que dans le manifeste de la route qui
      la rend. C'est la mesure qui a produit la note de `rejouer()`.
    */
    const CIBLE = "/admin/settings"

    // --- LE REFUS -----------------------------------------------------
    // L'administrateur de SA PROPRE agence rejoue l'action sur SA PROPRE
    // agence : le cas le plus favorable a l'attaquant, et donc le seul
    // qui prouve quelque chose. Il stationne sur son propre tableau de
    // bord, la ou il a le droit d'etre.
    await page.context().clearCookies()
    await page.setExtraHTTPHeaders(identiteAppelant())
    await login(page, agence.admin!.email)

    await rejouer(page, "/agency", CIBLE, html, { plan: "enterprise" })

    const apres = await db.agency.findUniqueOrThrow({
      where: { id },
      select: { plan: true },
    })

    expect(
      apres.plan,
      "un agency_admin s'est attribué Enterprise en rejouant l'action — le contrôle est dans l'écran, pas dans l'action"
    ).toBe("starter")

    // --- LE CONTROLE POSITIF, SUR LE MEME CHEMIN ----------------------
    // Meme formulaire, MEME CIBLE, meme valeur : seul le compte change.
    // Sans cette jambe, une action cassee pour tout le monde donnerait
    // exactement le meme vert que le refus ci-dessus — et c'est
    // precisement ce qui s'est produit a la premiere execution.
    await page.context().clearCookies()
    await login(page, "superadmin@aqar.dz")
    await rejouer(page, CIBLE, CIBLE, html, { plan: "enterprise" })

    const controle = await db.agency.findUniqueOrThrow({
      where: { id },
      select: { plan: true },
    })

    expect(
      controle.plan,
      "le super administrateur non plus n'a pas pu attribuer l'offre — l'action est cassée pour tout le monde, et le refus ci-dessus ne prouvait rien"
    ).toBe("enterprise")
  })
})
