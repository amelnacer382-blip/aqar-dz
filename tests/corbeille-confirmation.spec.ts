import { test, expect } from "@playwright/test"
import { db } from "./db"
import { creerAgence, effacerAgence, garnir, type Agence } from "./agence"
import { login } from "./auth-helper"
import { rejouer } from "./formulaire"

/**
 * « Détruire » demande confirmation, et dit ce qui tombe (story 3.13,
 * REP-106).
 *
 * LE DEFAUT. `npm run audit:cascades` recense onze suppressions en cascade
 * partant des trois modeles a corbeille : detruire un client emporte ses
 * visites, ses ventes, ses locations ET LES QUITTANCES de celles-ci. Le
 * bouton qui declenchait tout cela etait un simple envoi de formulaire,
 * pose a cote de « Restaurer », dans la meme ligne du meme tableau.
 *
 * ⚠ CE QUE CES DEUX CAS PROUVENT, ET CE QU'ILS NE PROUVENT PAS. Le premier
 * prouve que le RENDU est garde : le geste demande une seconde intention,
 * et cette intention est informee. Le second rejoue la Server Action SANS
 * L'ECRAN et constate qu'elle aboutit — parce que c'est vrai, et qu'il
 * vaut mieux l'ecrire que de laisser croire a une garde (CLAUDE.md §6,
 * piege 4). L'autorisation, elle, est ailleurs et n'a pas bouge :
 * `requireAgencyAdmin()`.
 */
test.describe("La confirmation avant destruction (story 3.13)", () => {
  const agences: Agence[] = []

  // Nettoyage par `afterEach`, jamais par `finally` (CLAUDE.md §6).
  test.afterEach(async () => {
    while (agences.length) {
      await effacerAgence(agences.pop() as Agence)
    }
  })

  test("annuler ne détruit rien, confirmer détruit — et le dialogue chiffre ce qui tombe", async ({
    page,
  }) => {
    test.setTimeout(240000)

    const agence = await creerAgence(["agency_admin"])
    agences.push(agence)

    const decor = await garnir(agence)
    const admin = await db.user.findFirstOrThrow({
      where: { agencyId: agence.agence.id, role: "agency_admin" },
    })

    const nom = `${decor.client.firstName} ${decor.client.lastName}`

    await db.client.update({
      where: { id: decor.client.id },
      data: { deletedAt: new Date() },
    })

    await login(page, admin.email)
    await page.goto("/agency/trash")

    const ligne = page.locator("tr", { hasText: nom })
    await expect(ligne, "le client n'est pas dans la corbeille").toBeVisible({
      timeout: 30000,
    })

    // « Détruire » exactement : « Détruire définitivement » est le bouton
    // du dialogue, et le confondre avec le declencheur ferait passer le
    // test sans jamais ouvrir la confirmation.
    const declencheur = ligne.getByRole("button", {
      name: "Détruire",
      exact: true,
    })

    /**
     * LE DECLENCHEUR NE DOIT PAS ETRE UN `submit`, et cette assertion est
     * ecrite parce que la mutation l'a demandee. En remettant
     * `type="submit"` — le defaut d'origine — le reste du cas rougissait
     * bien, mais par un DEPASSEMENT DE DELAI de quatre minutes : le clic
     * ouvrait le dialogue ET envoyait le formulaire, la ligne disparaissait,
     * et la suite attendait un bouton parti. Un rouge de quatre minutes qui
     * ne nomme rien ne vaut pas grand-chose (§6). Celui-ci tombe en une
     * seconde et dit quoi.
     */
    expect(
      await declencheur.getAttribute("type"),
      "le bouton « Détruire » est un `submit` : il détruit au premier clic, " +
        "et le dialogue s'ouvre sur une page déjà partie"
    ).toBe("button")

    await declencheur.click()

    const dialogue = page.getByRole("dialog")
    await expect(
      dialogue,
      "aucun dialogue ne s'ouvre : le clic détruit directement"
    ).toBeVisible({ timeout: 15000})

    // 1. IL NOMME LA LIGNE, et pas « cet élément ».
    await expect(
      dialogue.getByText(nom),
      "le dialogue ne nomme pas le client visé"
    ).toBeVisible()

    // 2. IL CHIFFRE. C'est ce qui distingue une confirmation d'un
    // « êtes-vous sûr ? », et la quittance est celle qui compte : c'est de
    // l'argent, et le décor n'en a qu'une.
    const texte = (await dialogue.textContent()) ?? ""
    expect(
      texte,
      "le dialogue n'annonce pas les quittances de loyer : c'est précisément " +
        "ce que l'avertissement d'origine taisait (story 3.5)"
    ).toContain("1 quittance de loyer")
    expect(
      texte,
      "le dialogue n'annonce pas la location détruite"
    ).toContain("1 location")

    // 3. ANNULER NE DETRUIT RIEN.
    await dialogue.getByRole("button", { name: "Annuler" }).click()
    await expect(
      dialogue,
      "le dialogue reste ouvert après « Annuler »"
    ).toBeHidden({ timeout: 15000 })

    // Relu par le client NON FILTRE : un `deletedAt` ne doit pas se lire
    // comme une destruction.
    expect(
      await db.client.findUnique({ where: { id: decor.client.id } }),
      "le client a été détruit alors que la confirmation a été refusée"
    ).not.toBeNull()
    expect(
      await db.rentalManagement.findUnique({
        where: { id: decor.quittance.id },
      }),
      "la quittance a été détruite alors que la confirmation a été refusée"
    ).not.toBeNull()

    /**
     * 4. LE CONTROLE POSITIF, sur le MEME chemin et le MEME bouton. Sans
     * lui, une destruction cassée pour tout le monde donnerait exactement
     * le même vert que la confirmation qu'on vient de poser — c'est le
     * piège n° 1 de §6, et il s'est déjà présenté trois fois ici.
     */
    await declencheur.click()
    await expect(dialogue).toBeVisible({ timeout: 15000 })

    await dialogue.getByRole("button", { name: "Détruire définitivement" }).click()

    /**
     * ON ATTEND L'EFFET, PAS LA NAVIGATION, et là encore c'est la mutation
     * qui l'a demandé. En retirant l'attribut `form` du bouton — le
     * dialogue est déplacé hors du `<form>` par le portail de Radix, c'est
     * cet attribut qui l'y rattache — le cas rougissait sur un
     * « waitForNavigation: Timeout 30000ms exceeded » : vrai, mais muet.
     * Attendre le message de succès nomme la propriété perdue.
     */
    await expect(
      page.getByText("Supprimé définitivement"),
      "confirmer n'a rien envoyé : le bouton du dialogue n'est plus relié au " +
        "formulaire par son attribut `form`, et le portail de Radix l'a sorti " +
        "du <form>"
    ).toBeVisible({ timeout: 30000 })

    expect(
      page.url(),
      "la destruction a été refusée : la corbeille n'est plus vidable"
    ).not.toContain("error=")

    expect(
      await db.client.findUnique({ where: { id: decor.client.id } }),
      "confirmer ne détruit pas : le bouton du dialogue n'est plus relié au " +
        "formulaire (attribut `form`)"
    ).toBeNull()
    expect(
      await db.rentalManagement.findUnique({
        where: { id: decor.quittance.id },
      }),
      "la cascade n'a pas eu lieu — ce qui voudrait dire que le décor ne " +
        "portait pas ce qu'on croit, et que l'assertion sur « 1 quittance » " +
        "ne prouvait rien"
    ).toBeNull()
  })

  /**
   * CE QUE LA CONFIRMATION NE PROTEGE PAS, dit par un test plutot que par
   * une note de bas de page.
   *
   * Une Server Action est un point d'entree POST joignable sans l'ecran.
   * Le dialogue ne s'y interpose pas, ne peut pas s'y interposer, et ce
   * cas le CONSTATE — il n'echoue donc pas, il documente.
   *
   * Et c'est le bon perimetre : l'appelant est un administrateur d'agence,
   * `requireAgencyAdmin()` l'a deja autorise a detruire. Un champ de
   * confirmation ajoute cote serveur, que le navigateur enverrait toujours,
   * n'arreterait ni l'accident — deja traite par le dialogue — ni un
   * administrateur decide. Ce serait un garde-fou en trompe-l'oeil.
   */
  test("rejouée sans l'écran, la destruction aboutit toujours — et c'est dit", async ({
    page,
  }) => {
    test.setTimeout(240000)

    const agence = await creerAgence(["agency_admin"])
    agences.push(agence)

    const decor = await garnir(agence)
    const admin = await db.user.findFirstOrThrow({
      where: { agencyId: agence.agence.id, role: "agency_admin" },
    })

    await db.client.update({
      where: { id: decor.client.id },
      data: { deletedAt: new Date() },
    })

    await login(page, admin.email)
    await page.goto("/agency/trash")

    /**
     * Le formulaire se releve par son `id` et non par `releverFormulaire()`
     * : l'ecran porte DEUX formulaires par ligne — « Restaurer » et
     * « Détruire » — qui partagent leurs champs `kind` et `id`. Un témoin
     * bâti sur un nom de champ relèverait le premier venu, et le rejeu
     * partirait sur une action qui n'a rien à voir.
     *
     * L'identifiant de l'action n'est JAMAIS écrit ici : il est calculé au
     * `build`, et figé dans un test il le rendrait vert en ne testant plus
     * rien (§6, piège 4). Il vient du HTML servi.
     */
    const html = await page
      .locator(`form#detruire-client-${decor.client.id}`)
      .evaluate((el) => (el as HTMLFormElement).outerHTML)

    const arrivee = await rejouer(page, "/agency/trash", html, {})

    expect(
      arrivee,
      "le rejeu a été refusé — ce qui voudrait dire qu'une garde a été " +
        "ajoutée côté serveur, et alors ce test doit être réécrit, pas supprimé"
    ).not.toContain("error=")

    expect(
      await db.client.findUnique({ where: { id: decor.client.id } }),
      "le rejeu n'a rien détruit : la destruction ne passe donc plus par " +
        "cette action, et l'inventaire des actions destructives est faux"
    ).toBeNull()
  })
})
