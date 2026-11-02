import { test, expect, Page } from "@playwright/test"
import { login } from "./auth-helper"
import { db } from "./db"
import { creerAgence, effacerAgence, type Agence } from "./agence"
import { offre } from "../lib/offres"

/**
 * Les plafonds appliques — stories 6.4 et 6.5.
 *
 * CE QUE CE FICHIER PROUVE.
 *  1. au plafond, la creation d'un bien est refusee DANS L'ACTION, et le
 *     message nomme l'offre, le plafond et le decompte (FR-9) ;
 *  2. un plafond illimite ne refuse jamais — controle positif obligatoire,
 *     sans lequel un quota casse pour tout le monde donnerait le meme
 *     vert (FR-9) ;
 *  3. les deux chemins qui font remonter le decompte SANS CREER —
 *     restaurer un bien, reactiver un compte — sont soumis au meme
 *     plafond, et fonctionnent toujours sous le plafond (FR-11) ;
 *  4. une agence retrogradee au-dessous de son decompte ne perd rien
 *     (FR-12) ;
 *  5. l'ecran de l'agence dit ou elle en est, illimite compris (FR-13).
 *
 * LE DECOMPTE EST LE PIEGE, PAS LE REFUS. Chaque cas verifie donc le
 * CHIFFRE en base, et pas seulement la presence d'un message.
 */

const PLAFOND_STARTER_BIENS = offre("starter").plafondBiens as number
const PLAFOND_STARTER_COMPTES = offre("starter").plafondComptes as number

/** Des biens valides, en nombre, poses directement en base. */
async function poserDesBiens(agencyId: string, combien: number, marque: string) {
  await db.property.createMany({
    data: Array.from({ length: combien }, (_, i) => ({
      title: `Bien ${marque} ${i}`,
      category: "residentiel" as const,
      type: "appartement" as const,
      operationType: "vente" as const,
      wilaya: "Oran",
      commune: "Bir El Djir",
      salePrice: 5_000_000,
      agencyId,
    })),
  })
}

/**
 * Rejoue un formulaire en y forcant des champs.
 *
 * Les controles existants sont REMPLACES par des champs caches : un
 * `select` n'accepte pas une valeur absente de ses options, et un POST
 * forge n'utilise de toute facon pas l'ecran. L'identifiant d'action
 * n'est jamais ecrit ici — il vient du HTML releve a l'execution, parce
 * qu'il est calcule au `build` (BUG-28).
 */
async function rejouer(
  page: Page,
  ecran: string,
  formHtml: string,
  champs: Record<string, string>
) {
  await page.goto(ecran)

  expect(
    new URL(page.url()).pathname,
    `le rejeu ne part pas de ${ecran} — le POST viserait une autre adresse`
  ).toBe(ecran)

  await Promise.all([
    page.waitForNavigation({ timeout: 30000 }),
    page.evaluate(
      ({ html, valeurs }) => {
        const hote = document.createElement("div")
        hote.innerHTML = html

        const form = hote.querySelector("form") as HTMLFormElement

        for (const nom of Object.keys(valeurs)) {
          form.querySelector(`[name="${nom}"]`)?.remove()

          const champ = document.createElement("input")
          champ.type = "hidden"
          champ.name = nom
          champ.value = valeurs[nom]
          form.appendChild(champ)
        }

        document.body.appendChild(form)
        form.submit()
      },
      { html: formHtml, valeurs: champs }
    ),
  ])
}

/** Un corps de bien valide pour `propertySchema`. */
function bienValide(titre: string): Record<string, string> {
  return {
    title: titre,
    category: "residentiel",
    type: "appartement",
    operationType: "vente",
    wilaya: "Oran",
    commune: "Bir El Djir",
    salePrice: "5000000",
    status: "disponible",
  }
}

test.describe("Les plafonds de l'offre (stories 6.4 et 6.5)", () => {
  let agence: Agence | null = null

  // Nettoyage par `afterEach`, jamais par `finally` (CLAUDE.md §6).
  test.afterEach(async () => {
    if (agence) {
      await effacerAgence(agence)
      agence = null
    }
  })

  test("au plafond, le bien suivant est refusé — et le précédent était accepté", async ({
    page,
  }) => {
    test.setTimeout(180000)

    agence = await creerAgence()
    const agencyId = agence.agence.id

    // Une place libre, exactement. C'est ce qui permet de jouer le
    // succes et le refus SUR LE MEME FORMULAIRE, dans le meme test.
    await poserDesBiens(agencyId, PLAFOND_STARTER_BIENS - 1, agence.marque)

    const decompte = () => db.property.count({ where: { agencyId } })

    expect(await decompte(), "le décor n'a pas la taille attendue").toBe(
      PLAFOND_STARTER_BIENS - 1
    )

    await login(page, agence.admin!.email)
    await page.goto("/agency/properties/new")

    const formulaire = page.locator("form:has(input[name='title'])")
    await expect(
      formulaire,
      "le formulaire de création est absent alors qu'il reste une place"
    ).toBeAttached({ timeout: 15000 })

    const html = await formulaire.evaluate(
      (el) => (el as HTMLFormElement).outerHTML
    )

    // --- LE CONTROLE POSITIF, D'ABORD ---------------------------------
    // Il occupe la derniere place. Sans lui, le refus ci-dessous serait
    // indiscernable d'une action cassee pour tout le monde.
    await rejouer(
      page,
      "/agency/properties/new",
      html,
      bienValide(`Dernière place ${agence.marque}`)
    )

    expect(
      await decompte(),
      "la dernière place libre n'a pas été utilisable — l'action est cassée, et le refus ci-dessous ne prouverait rien"
    ).toBe(PLAFOND_STARTER_BIENS)

    // --- LE REFUS, SUR LE MEME FORMULAIRE -----------------------------
    await rejouer(
      page,
      "/agency/properties/new",
      html,
      bienValide(`Un de trop ${agence.marque}`)
    )

    expect(
      await decompte(),
      "un bien a été créé au-delà du plafond de l'offre"
    ).toBe(PLAFOND_STARTER_BIENS)

    // Le message NOMME l'offre, le plafond et le decompte : « plafond
    // atteint » tout seul laisse l'agence devant un mur sans issue.
    const message = page.getByText(/Offre Starter/).first()
    await expect(
      message,
      "le refus ne nomme pas l'offre"
    ).toBeVisible({ timeout: 15000 })
    await expect(message).toContainText(`${PLAFOND_STARTER_BIENS} biens`)
    await expect(message).toContainText(
      `vous en avez ${PLAFOND_STARTER_BIENS}`
    )

    // Et la SORTIE est dite : supprimer ramène le décompte (FR-12).
    await expect(
      message,
      "le refus ne dit pas comment en sortir"
    ).toContainText("Supprimez un bien")

    // LA SAISIE N'EST PAS PERDUE parce qu'il n'y en a pas : au plafond,
    // l'écran n'affiche plus le formulaire du tout.
    await expect(
      page.locator("form:has(input[name='title'])"),
      "le formulaire est encore proposé alors que rien ne peut plus être créé"
    ).toHaveCount(0)
  })

  test("un plafond illimité ne refuse jamais, quel que soit le décompte", async ({
    page,
  }) => {
    test.setTimeout(180000)

    /**
     * LE CONTROLE POSITIF DE L'ILLIMITE, et il est obligatoire : une
     * garde posee de travers refuserait tout le monde, et les refus du
     * test precedent seraient verts sur un produit casse.
     *
     * Le decompte est volontairement AU-DELA du plafond Starter : si le
     * code lisait le mauvais plafond, ou traitait `null` comme un zero,
     * cette creation echouerait.
     */
    agence = await creerAgence()
    const agencyId = agence.agence.id

    await db.agency.update({ where: { id: agencyId }, data: { plan: "pro" } })
    await poserDesBiens(agencyId, PLAFOND_STARTER_BIENS + 5, agence.marque)

    await login(page, agence.admin!.email)
    await page.goto("/agency/properties/new")

    const formulaire = page.locator("form:has(input[name='title'])")
    await expect(
      formulaire,
      "l'offre Pro n'a pas de plafond de biens, et le formulaire est pourtant masqué"
    ).toBeAttached({ timeout: 15000 })

    const html = await formulaire.evaluate(
      (el) => (el as HTMLFormElement).outerHTML
    )

    await rejouer(
      page,
      "/agency/properties/new",
      html,
      bienValide(`Illimité ${agence.marque}`)
    )

    expect(
      await db.property.count({ where: { agencyId } }),
      "une agence à plafond illimité a été refusée"
    ).toBe(PLAFOND_STARTER_BIENS + 6)
  })

  test("restaurer un bien est soumis au plafond, et fonctionne toujours sous le plafond", async ({
    page,
  }) => {
    test.setTimeout(180000)

    /**
     * FR-11. Sans ce controle, le plafond se contournerait en trois
     * gestes : supprimer, creer, restaurer. Ce chemin ne comptait pour
     * rien tant que rien ne comptait (CLAUDE.md §8).
     */
    agence = await creerAgence()
    const agencyId = agence.agence.id

    await poserDesBiens(agencyId, PLAFOND_STARTER_BIENS, agence.marque)

    // Un bien de plus, a la corbeille : il ne compte pas, et l'agence est
    // donc pile au plafond avec un candidat a la restauration.
    const enCorbeille = await db.property.create({
      data: {
        title: `Corbeille ${agence.marque}`,
        category: "residentiel",
        type: "appartement",
        operationType: "vente",
        wilaya: "Oran",
        commune: "Bir El Djir",
        salePrice: 5_000_000,
        agencyId,
        deletedAt: new Date(),
      },
    })

    const vivants = () =>
      db.property.count({ where: { agencyId, deletedAt: null } })

    expect(await vivants()).toBe(PLAFOND_STARTER_BIENS)

    await login(page, agence.admin!.email)
    await page.goto("/agency/trash")

    const bouton = page.locator(
      `form:has(input[name="id"][value="${enCorbeille.id}"]) button:has-text("Restaurer")`
    )
    await expect(
      bouton,
      "aucun bouton de restauration pour le bien mis à la corbeille"
    ).toBeVisible({ timeout: 15000 })

    // --- LE REFUS -----------------------------------------------------
    await bouton.click()
    await page.waitForURL(/\/agency\/trash\?.*(error|success)=/, {
      timeout: 30000,
    })

    const relu = await db.property.findUniqueOrThrow({
      where: { id: enCorbeille.id },
      select: { deletedAt: true },
    })

    expect(
      relu.deletedAt,
      "un bien a été restauré alors que l'agence était au plafond — le plafond se contourne en trois gestes"
    ).not.toBeNull()

    await expect(
      page.getByText(/Offre Starter/).first(),
      "la restauration refusée n'annonce pas son motif"
    ).toBeVisible({ timeout: 15000 })

    // --- LE CONTROLE POSITIF, SUR LE MEME CHEMIN ----------------------
    // On libere une place, et la MEME restauration doit aboutir. Sans
    // cela, une restauration cassee pour tout le monde donnerait le meme
    // vert que le refus ci-dessus.
    const aSupprimer = await db.property.findFirstOrThrow({
      where: { agencyId, deletedAt: null },
      select: { id: true },
    })
    await db.property.update({
      where: { id: aSupprimer.id },
      data: { deletedAt: new Date() },
    })

    expect(await vivants()).toBe(PLAFOND_STARTER_BIENS - 1)

    await page.goto("/agency/trash")
    await page
      .locator(
        `form:has(input[name="id"][value="${enCorbeille.id}"]) button:has-text("Restaurer")`
      )
      .click()
    await page.waitForURL(/\/agency\/trash\?.*(error|success)=/, {
      timeout: 30000,
    })

    const apres = await db.property.findUniqueOrThrow({
      where: { id: enCorbeille.id },
      select: { deletedAt: true },
    })

    expect(
      apres.deletedAt,
      "la restauration ne fonctionne plus, même sous le plafond — la garde refuse tout le monde"
    ).toBeNull()
  })

  test("réactiver un compte est soumis au plafond, et fonctionne toujours sous le plafond", async ({
    page,
  }) => {
    test.setTimeout(180000)

    /**
     * FR-11, cote comptes : desactiver, creer, reactiver contournerait le
     * plafond aussi surement que pour les biens.
     */
    agence = await creerAgence(["agency_admin", "agent"])
    const agencyId = agence.agence.id

    const agent = await db.user.findFirstOrThrow({
      where: { agencyId, role: "agent" },
      select: { id: true, email: true },
    })

    // L'agent est mis de cote : l'agence passe a 1 compte actif sur 2.
    await db.user.update({ where: { id: agent.id }, data: { isActive: false } })

    // Puis la place liberee est reprise par un autre compte : l'agence
    // est de nouveau au plafond, avec un compte desactive a reactiver.
    const remplacant = await db.user.create({
      data: {
        email: `remplacant.${agence.marque.toLowerCase()}@voisine.invalid`,
        name: `Remplaçant ${agence.marque}`,
        password: "x",
        role: "agent",
        agencyId,
        isActive: true,
      },
      select: { id: true },
    })

    const actifs = () => db.user.count({ where: { agencyId, isActive: true } })

    expect(await actifs(), "le décor n'est pas au plafond").toBe(
      PLAFOND_STARTER_COMPTES
    )

    await login(page, agence.admin!.email)
    await page.goto("/agency/users")

    const reactiver = page.locator(
      `form:has(input[name="targetId"][value="${agent.id}"]) button:has-text("Réactiver")`
    )
    await expect(
      reactiver,
      "aucun bouton de réactivation pour le compte désactivé"
    ).toBeVisible({ timeout: 15000 })

    // --- LE REFUS -----------------------------------------------------
    await reactiver.click()
    await page.waitForURL(/\/agency\/users\?.*(error|success)=/, {
      timeout: 30000,
    })

    expect(
      (await db.user.findUniqueOrThrow({ where: { id: agent.id } })).isActive,
      "un compte a été réactivé au-delà du plafond — le plafond se contourne en trois gestes"
    ).toBe(false)

    await expect(
      page.getByText(/Offre Starter/).first(),
      "la réactivation refusée n'annonce pas son motif"
    ).toBeVisible({ timeout: 15000 })

    // --- LE CONTROLE POSITIF, SUR LE MEME CHEMIN ----------------------
    await db.user.update({
      where: { id: remplacant.id },
      data: { isActive: false },
    })

    await page.goto("/agency/users")
    await page
      .locator(
        `form:has(input[name="targetId"][value="${agent.id}"]) button:has-text("Réactiver")`
      )
      .click()
    await page.waitForURL(/\/agency\/users\?.*(error|success)=/, {
      timeout: 30000,
    })

    expect(
      (await db.user.findUniqueOrThrow({ where: { id: agent.id } })).isActive,
      "la réactivation ne fonctionne plus, même sous le plafond — la garde refuse tout le monde"
    ).toBe(true)
  })

  test("une agence rétrogradée garde tout, et rien n'est supprimé ni masqué", async ({
    page,
  }) => {
    test.setTimeout(180000)

    /**
     * FR-12, l'arbitrage le plus important de l'epopee : QUOTAS DURS,
     * SANS AUCUNE SUPPRESSION RETROACTIVE. Une agence qui passe de Pro a
     * Starter avec 25 biens les garde tous les 25.
     */
    agence = await creerAgence()
    const agencyId = agence.agence.id

    await db.agency.update({ where: { id: agencyId }, data: { plan: "pro" } })
    await poserDesBiens(agencyId, PLAFOND_STARTER_BIENS + 5, agence.marque)

    // La retrogradation.
    await db.agency.update({
      where: { id: agencyId },
      data: { plan: "starter" },
    })

    const apres = await db.property.count({ where: { agencyId } })

    expect(
      apres,
      "des biens ont disparu à la rétrogradation — le produit détruit ce qu'une agence possède"
    ).toBe(PLAFOND_STARTER_BIENS + 5)

    expect(
      await db.property.count({
        where: { agencyId, deletedAt: { not: null } },
      }),
      "des biens ont été envoyés à la corbeille par la rétrogradation"
    ).toBe(0)

    await login(page, agence.admin!.email)

    // TOUT RESTE MODIFIABLE : seule la creation est refusee. L'ecran
    // d'edition d'un bien s'ouvre et porte son formulaire.
    const bien = await db.property.findFirstOrThrow({
      where: { agencyId },
      select: { id: true },
    })

    await page.goto(`/agency/properties/${bien.id}/edit`)
    await expect(
      page.locator("form:has(input[name='title'])"),
      "une agence au-dessus de son plafond ne peut plus modifier ses biens"
    ).toBeAttached({ timeout: 15000 })
  })

  test("l'agence voit ses plafonds et sa consommation, illimité compris", async ({
    page,
  }) => {
    test.setTimeout(180000)

    // FR-13, story 6.5.
    agence = await creerAgence()
    const agencyId = agence.agence.id

    await poserDesBiens(agencyId, 3, agence.marque)

    await login(page, agence.admin!.email)
    await page.goto("/agency/settings")

    await expect(
      page.getByText("Votre consommation"),
      "l'écran de l'agence ne montre pas sa consommation"
    ).toBeVisible({ timeout: 15000 })

    // Le decompte ET le plafond, dans la meme phrase : verifier l'un sans
    // l'autre laisserait passer un ecran qui affiche « 3 sur 2 ».
    await expect(
      page.getByText(`3 sur ${PLAFOND_STARTER_BIENS}`).first(),
      "l'écran ne dit pas combien de biens sur combien"
    ).toBeVisible({ timeout: 15000 })

    await expect(
      page.getByText(`1 sur ${PLAFOND_STARTER_COMPTES}`).first(),
      "l'écran ne dit pas combien de comptes actifs sur combien"
    ).toBeVisible()

    // --- L'ILLIMITE S'ANNONCE, SANS NOMBRE INVENTE --------------------
    await db.agency.update({ where: { id: agencyId }, data: { plan: "pro" } })
    await page.goto("/agency/settings")

    await expect(
      page.getByText("sur illimité").first(),
      "un plafond illimité n'est pas annoncé comme tel"
    ).toBeVisible({ timeout: 15000 })

    // --- LE DEPASSEMENT EST VISIBLE, ET NON ALARMISTE -----------------
    await poserDesBiens(agencyId, PLAFOND_STARTER_BIENS, `${agence.marque}-bis`)
    await db.agency.update({
      where: { id: agencyId },
      data: { plan: "starter" },
    })
    await page.goto("/agency/settings")

    await expect(
      page.getByText(/au-dessus du plafond/).first(),
      "le dépassement n'est pas dit à l'agence"
    ).toBeVisible({ timeout: 15000 })

    // La situation est LEGITIME : rien n'est en danger, et l'ecran ne
    // doit pas pousser l'agence a effacer ce qu'elle a le droit de garder.
    await expect(
      page.getByText(/Tout est conservé et reste modifiable/).first(),
      "l'écran alarme au lieu de rassurer"
    ).toBeVisible()
  })
})
