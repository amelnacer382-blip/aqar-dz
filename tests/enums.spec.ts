import { test, expect, Page } from "@playwright/test"
import { login } from "./auth-helper"
import { db } from "./db"
import { creerAgence, garnir, effacerAgence, type Agence } from "./agence"

/**
 * Les valeurs d'enumeration venues de l'exterieur — story 3.2.
 *
 * CE QUE CE FICHIER PROUVE.
 *  1. un statut d'agence forge produit un MESSAGE FRANCAIS, pas une
 *     exception Prisma en pleine page, et ne change rien (BUG-06) ;
 *  2. la meme chose pour le statut d'un message recu par la vitrine
 *     (BUG-38) ;
 *  3. un filtre d'URL inconnu ne remplace aucun ecran par une page
 *     d'erreur — y compris la vitrine PUBLIQUE, atteignable sans compte.
 *
 * POURQUOI CHAQUE CAS PORTE SON CONTROLE POSITIF. « Le statut n'a pas
 * change » est EXACTEMENT ce qu'on observerait d'une action cassee pour
 * tout le monde : le refus ne prouve rien tant qu'un succes n'est pas
 * constate sur le meme chemin (CLAUDE.md §6, piege 1). Ce piege a deja
 * laisse un test vert sur un produit casse dans ce depot — deux fois.
 *
 * LA VALEUR FORGEE EST `constructor`, ET CE N'EST PAS UN CAPRICE. Les
 * gardes remplacees confrontaient l'entree a une table d'etiquettes avec
 * l'operateur `in`, qui remonte la chaine de prototypes : `supprime`
 * etait refuse, `constructor` passait. Un test qui posterait `supprime`
 * serait vert AVANT comme APRES la correction, et ne prouverait rien.
 */

/**
 * Rejoue un formulaire SERVI vers une adresse explicite.
 *
 * L'identifiant d'action n'est jamais ecrit ici : il est calcule au
 * `build`, et fige dans un test il le rendrait vert en ne testant plus
 * rien (BUG-28, CLAUDE.md §6 piege 4). Il vient du HTML releve a
 * l'execution — c'est toute la raison de relever le formulaire au lieu de
 * forger un POST.
 *
 * Rend l'URL d'arrivee : sur refus comme sur succes il y a redirection,
 * et c'est elle qui porte le message.
 */
async function rejouer(
  page: Page,
  depuis: string,
  cible: string,
  formHtml: string,
  champs: Record<string, string>
): Promise<string> {
  await page.goto(depuis)

  await Promise.all([
    // Jamais `networkidle` (CLAUDE.md §2) : il se resout pendant qu'une
    // Server Action est encore en vol.
    page.waitForNavigation({ timeout: 30000 }),
    page.evaluate(
      ({ html, valeurs, adresse }) => {
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

        form.setAttribute("action", adresse)
        document.body.appendChild(form)
        form.submit()
      },
      { html: formHtml, valeurs: champs, adresse: cible }
    ),
  ])

  return decodeURIComponent(page.url())
}

/** Le HTML d'un formulaire servi, designe par un champ temoin. */
async function formulaire(page: Page, selecteur: string): Promise<string> {
  const cible = page.locator(selecteur)

  await expect(
    cible,
    `aucun formulaire ne correspond a ${selecteur} — l'ecran a-t-il change ` +
      `de forme, ou la garde a-t-elle renvoye ailleurs ?`
  ).toBeAttached({ timeout: 15000 })

  return cible.evaluate((el) => (el as HTMLFormElement).outerHTML)
}

test.describe("Les valeurs d'énumération forgées (story 3.2)", () => {
  let agence: Agence | null = null

  // Nettoyage par `afterEach`, jamais par `finally` : un depassement de
  // delai n'execute pas un `finally` (CLAUDE.md §6).
  test.afterEach(async () => {
    if (agence) {
      await effacerAgence(agence)
      agence = null
    }
  })

  test("un statut d'agence forgé produit un message, et ne change rien (BUG-06)", async ({
    page,
  }) => {
    test.setTimeout(120000)

    agence = await creerAgence()
    const id = agence.agence.id

    await db.agency.update({ where: { id }, data: { status: "pending" } })

    await login(page, "superadmin@aqar.dz")
    await page.goto("/admin/agencies")

    const html = await formulaire(
      page,
      `form:has(input[name="agencyId"][value="${id}"]):has(input[value="active"])`
    )

    const arrivee = await rejouer(page, "/admin/agencies", "/admin/agencies", html, {
      status: "constructor",
    })

    const refus = await db.agency.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    })

    expect(
      refus.status,
      `un statut forgé a été écrit en base : l'agence est passée à « ${refus.status} »`
    ).toBe("pending")

    expect(
      arrivee,
      `le refus n'annonce rien de lisible. L'écran a répondu : ${arrivee}`
    ).toMatch(/Statut invalide/i)

    // CONTROLE POSITIF — sans lui, une action cassée pour tout le monde
    // donnerait exactement le même vert que la garde qu'on prétend prouver.
    await rejouer(page, "/admin/agencies", "/admin/agencies", html, {
      status: "active",
    })

    const succes = await db.agency.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    })

    expect(
      succes.status,
      "CONTRÔLE POSITIF EN ÉCHEC : un statut VALIDE n'a pas été enregistré non " +
        "plus. L'action est cassée pour tout le monde, et le refus ci-dessus " +
        "ne prouvait donc rien."
    ).toBe("active")
  })

  test("un statut de message forgé produit un message, et ne change rien (BUG-38)", async ({
    page,
  }) => {
    test.setTimeout(120000)

    agence = await creerAgence()
    await garnir(agence)

    const lead = await db.lead.findFirstOrThrow({
      where: { agencyId: agence.agence.id },
      select: { id: true, status: true },
    })

    expect(lead.status, "le décor ne part pas de « nouveau »").toBe("nouveau")

    await login(page, agence.admin!.email)

    const CIBLE = "/agency/leads"
    await page.goto(CIBLE)

    // La VALEUR est dans le sélecteur : un message « nouveau » porte DEUX
    // formulaires de statut (traiter, archiver), et `:has(input[name=status])`
    // les relevait tous les deux. Le rejeu serait parti sur celui que la
    // page a rendu en premier, donc sur un formulaire choisi par hasard.
    const html = await formulaire(
      page,
      `form:has(input[name="id"][value="${lead.id}"]):has(input[name="status"][value="traite"])`
    )

    const arrivee = await rejouer(page, CIBLE, CIBLE, html, {
      status: "constructor",
    })

    const refus = await db.lead.findUniqueOrThrow({
      where: { id: lead.id },
      select: { status: true },
    })

    expect(
      refus.status,
      `un statut forgé a été écrit en base : le message est passé à « ${refus.status} »`
    ).toBe("nouveau")

    expect(
      arrivee,
      `le refus n'annonce rien de lisible. L'écran a répondu : ${arrivee}`
    ).toMatch(/Statut inconnu/i)

    // CONTROLE POSITIF.
    await rejouer(page, CIBLE, CIBLE, html, { status: "traite" })

    const succes = await db.lead.findUniqueOrThrow({
      where: { id: lead.id },
      select: { status: true },
    })

    expect(
      succes.status,
      "CONTRÔLE POSITIF EN ÉCHEC : un statut VALIDE n'a pas été enregistré non " +
        "plus — le refus ci-dessus ne prouvait rien."
    ).toBe("traite")
  })

  test("un filtre d'URL inconnu n'écroule pas la vitrine PUBLIQUE", async ({
    page,
  }) => {
    test.setTimeout(120000)

    agence = await creerAgence()
    const decor = await garnir(agence)
    const slug = agence.agence.slug!

    // AUCUNE CONNEXION ICI, ET C'EST LE POINT. C'est le plus exposé des
    // sept sites : `?type=constructor` suffisait, sans compte.
    for (const forge of [
      `/vitrine/${slug}?type=constructor`,
      `/vitrine/${slug}?operation=constructor`,
      `/vitrine/${slug}?type=__proto__&operation=toString`,
    ]) {
      await page.goto(forge)

      await expect(
        page.locator("body"),
        `${forge} a été remplacé par une page d'erreur — le filtre forgé est ` +
          `parti dans le \`where\` de Prisma`
      ).toContainText(agence.agence.name, { timeout: 30000 })

      // Un filtre inconnu est IGNORÉ, pas appliqué : la vitrine reste
      // entière. C'est l'arbitrage écrit dans `lib/offres.ts` — un signet
      // périmé pose l'écran, il ne le refuse pas.
      await expect(
        page.locator("body"),
        `${forge} a fait disparaître les biens : le filtre forgé a été APPLIQUÉ ` +
          `au lieu d'être ignoré`
      ).toContainText(decor.bien.title)
    }

    // CONTROLE POSITIF — un filtre CONNU, lui, filtre pour de bon. Sans
    // cette jambe, un `estCleConnue` qui rendrait toujours `false` passerait
    // les trois cas ci-dessus.
    await page.goto(`/vitrine/${slug}?type=appartement`)
    await expect(
      page.locator("body"),
      "CONTRÔLE POSITIF EN ÉCHEC : un type CONNU ne rend plus le bien"
    ).toContainText(decor.bien.title, { timeout: 30000 })

    await page.goto(`/vitrine/${slug}?type=hangar`)
    await expect(
      page.locator("body"),
      "CONTRÔLE POSITIF EN ÉCHEC : le filtre ne filtre plus — un appartement " +
        "ressort sur une recherche de hangar, donc les trois cas forgés " +
        "ci-dessus ne prouvaient rien"
    ).not.toContainText(decor.bien.title)
  })

  test("un filtre d'URL inconnu n'écroule pas les listes de l'agence", async ({
    page,
  }) => {
    test.setTimeout(120000)

    agence = await creerAgence()
    await garnir(agence)

    await login(page, agence.admin!.email)

    // Le repère est le marqueur de l'agence : il est porté par le nom du
    // client du paiement et par celui de l'expéditeur du message, tous deux
    // rendus dans ces listes. La `reference` du paiement, elle, ne l'est
    // pas — vérifié dans le JSX plutôt que supposé.
    const repere = agence.marque

    for (const url of [
      "/agency/leads?status=constructor",
      "/agency/payments?type=constructor",
      "/agency/payments?status=__proto__",
    ]) {
      await page.goto(url)

      await expect(
        page.locator("body"),
        `${url} a été remplacé par une page d'erreur, ou a masqué ses lignes : ` +
          `le filtre forgé est parti dans le \`where\` de Prisma`
      ).toContainText(repere, { timeout: 30000 })
    }

    // CONTROLE POSITIF — un filtre CONNU filtre encore. Le paiement du décor
    // est `paye` par défaut de colonne : demander les impayés doit le faire
    // disparaître.
    await page.goto("/agency/payments?status=impaye")
    await expect(
      page.locator("body"),
      "CONTRÔLE POSITIF EN ÉCHEC : un statut de paiement CONNU ne filtre plus, " +
        "donc les trois cas forgés ci-dessus ne prouvaient rien"
    ).not.toContainText(repere, { timeout: 30000 })
  })
})
