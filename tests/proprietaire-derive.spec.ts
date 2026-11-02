import { test, expect } from "@playwright/test"
import { db } from "./db"
import { creerAgence, effacerAgence, garnir, type Agence } from "./agence"
import { login } from "./auth-helper"
import { releverFormulaire, rejouer } from "./formulaire"

/**
 * Le proprietaire d'une vente et d'un bail : ni devine, ni recalcule
 * (story 3.11, REP-02 et BUG-39).
 *
 * DEUX DEFAUTS SUR LA MEME LIGNE, et c'est ce qui les a rendus invisibles :
 *
 *     data: { ...data, ownerId: data.ownerId ?? property.ownerId }
 *
 * `REP-02` — a gauche du `??`. Aucun des deux formulaires ne rend de champ
 * `ownerId` : la valeur soumise est donc TOUJOURS absente, et le
 * proprietaire est RECALCULE depuis le bien a chaque enregistrement. Si le
 * bien a change de mains depuis, la vente suit silencieusement. C'est la
 * famille de BUG-34 — « enregistrer sans rien changer reecrit un lien » —
 * sur un lien calcule cote serveur, ce que l'inventaire bati par
 * `grep name="..."` ne pouvait pas voir.
 *
 * `BUG-39` — a droite du `??`. `saleSchema` et `rentalSchema` ACCEPTENT
 * pourtant `ownerId`, et personne ne le verifie contre l'agence. Un
 * identifiant pose dans un POST rattachait donc la vente au proprietaire
 * d'une AUTRE agence — dont le nom ressort ensuite dans le contrat PDF,
 * dans l'ecran de gestion locative et dans l'export CSV.
 *
 * Le mecanisme de verification existait deja : `verifyPaymentLinks`, ecrit
 * pour les paiements. Il n'avait jamais ete applique ici.
 */
test.describe("Le propriétaire d'une vente et d'un bail (story 3.11)", () => {
  const agences: Agence[] = []

  // Nettoyage par `afterEach`, jamais par `finally` (CLAUDE.md §6).
  test.afterEach(async () => {
    while (agences.length) {
      await effacerAgence(agences.pop() as Agence)
    }
  })

  test("un propriétaire d'une autre agence est refusé", async ({ page }) => {
    test.setTimeout(240000)

    const agence = await creerAgence(["agency_admin"])
    agences.push(agence)
    const voisine = await creerAgence(["agency_admin"])
    agences.push(voisine)

    const decor = await garnir(agence)
    const admin = await db.user.findFirstOrThrow({
      where: { agencyId: agence.agence.id, role: "agency_admin" },
    })

    const etranger = await db.owner.create({
      data: {
        firstName: "Propriétaire",
        lastName: `D'ailleurs ${voisine.marque}`,
        agencyId: voisine.agence.id,
      },
    })

    const avant = await db.sale.findUniqueOrThrow({
      where: { id: decor.vente.id },
    })

    await login(page, admin.email)

    // Le formulaire de mise a jour se designe par un champ qui n'appartient
    // qu'a lui : l'ecran porte aussi celui de la suppression.
    const html = await releverFormulaire(
      page,
      `/agency/sales/${decor.vente.id}/edit`,
      'input[name="finalPrice"]'
    )

    const arrivee = await rejouer(
      page,
      `/agency/sales/${decor.vente.id}/edit`,
      html,
      { ownerId: etranger.id }
    )

    const apres = await db.sale.findUniqueOrThrow({
      where: { id: decor.vente.id },
    })

    expect(
      apres.ownerId,
      `la vente a été rattachée au propriétaire d'une autre agence — son nom ` +
        `ressortira dans le contrat PDF, la gestion locative et l'export CSV ` +
        `(arrivée : ${arrivee})`
    ).not.toBe(etranger.id)

    expect(
      apres.ownerId,
      "le propriétaire de la vente a changé alors que le POST devait être refusé"
    ).toBe(avant.ownerId)

    /**
     * LE PREMIER CONTROLE POSITIF : l'action a bien TOURNE.
     *
     * Ce cas a ete reecrit apres coup, et le motif merite d'etre garde :
     * sa premiere version rejouait le formulaire avec un proprietaire de
     * SA PROPRE agence et attendait qu'il soit ecrit. C'etait le controle
     * de l'ANCIEN contrat — celui ou le champ etait accepte. Il ne l'est
     * plus DU TOUT, et c'est le correctif : le rouge disait donc que le
     * test etait perime, pas que le produit l'etait.
     *
     * La propriete a garder est ailleurs : l'enregistrement doit aboutir
     * et ecrire le reste. Sans elle, une action cassee pour tout le monde
     * donnerait exactement le meme vert que la garde qu'on vient de poser.
     */
    expect(
      arrivee,
      "l'enregistrement a été refusé : le lien est intact parce que RIEN " +
        "n'a été écrit, ce qui ne prouve pas la propriété visée"
    ).not.toContain("error=")

    await rejouer(page, `/agency/sales/${decor.vente.id}/edit`, html, {
      ownerId: etranger.id,
      finalPrice: "12345678",
    })

    const ecrit = await db.sale.findUniqueOrThrow({
      where: { id: decor.vente.id },
    })
    expect(
      Number(ecrit.finalPrice),
      "l'écran de vente n'enregistre plus rien : la garde est trop large"
    ).toBe(12345678)
    expect(
      ecrit.ownerId,
      "le propriétaire étranger est passé pendant qu'un autre champ était écrit"
    ).toBe(avant.ownerId)

    /**
     * LE SECOND CONTROLE POSITIF : quand le BIEN change, le vendeur DOIT
     * suivre. La vente porte alors sur un autre bien, dont le proprietaire
     * est quelqu'un d'autre — ne pas le suivre serait l'erreur inverse.
     */
    const autreProprietaire = await db.owner.create({
      data: {
        firstName: "Autre",
        lastName: `Propriétaire ${agence.marque}`,
        agencyId: agence.agence.id,
      },
    })
    const autreBien = await db.property.create({
      data: {
        title: `Autre bien ${agence.marque}`,
        category: "residentiel",
        type: "appartement",
        operationType: "vente",
        wilaya: "Oran",
        commune: "Bir El Djir",
        salePrice: 9_000_000,
        agencyId: agence.agence.id,
        ownerId: autreProprietaire.id,
      },
    })

    await rejouer(page, `/agency/sales/${decor.vente.id}/edit`, html, {
      propertyId: autreBien.id,
    })

    expect(
      (await db.sale.findUniqueOrThrow({ where: { id: decor.vente.id } }))
        .ownerId,
      "changer le bien ne fait plus suivre le vendeur : la vente porte sur " +
        "un bien dont le propriétaire est quelqu'un d'autre"
    ).toBe(autreProprietaire.id)
  })

  /**
   * LE BAIL PORTE LE MEME CORRECTIF, ET IL LUI FAUT SON PROPRE CAS.
   *
   * `app/agency/rentals/[id]/edit/page.tsx` a ete corrige de la meme ligne
   * que la vente. Sans ce cas, retirer la garde de ce fichier-la ne
   * rougirait RIEN : deux ecrans repares, un seul eprouve, et c'est
   * exactement ainsi qu'une moitie de correctif se defait sans bruit.
   */
  test("un bail refuse lui aussi un propriétaire d'une autre agence", async ({
    page,
  }) => {
    test.setTimeout(240000)

    const agence = await creerAgence(["agency_admin"])
    agences.push(agence)
    const voisine = await creerAgence(["agency_admin"])
    agences.push(voisine)

    const decor = await garnir(agence)
    const admin = await db.user.findFirstOrThrow({
      where: { agencyId: agence.agence.id, role: "agency_admin" },
    })

    const etranger = await db.owner.create({
      data: {
        firstName: "Propriétaire",
        lastName: `D'ailleurs ${voisine.marque}`,
        agencyId: voisine.agence.id,
      },
    })

    const avant = await db.rental.findUniqueOrThrow({
      where: { id: decor.bail.id },
    })

    await login(page, admin.email)

    const html = await releverFormulaire(
      page,
      `/agency/rentals/${decor.bail.id}/edit`,
      'input[name="monthlyRent"]'
    )

    const arrivee = await rejouer(
      page,
      `/agency/rentals/${decor.bail.id}/edit`,
      html,
      { ownerId: etranger.id, monthlyRent: "77777" }
    )

    // CONTROLE POSITIF : l'action a tourne et a ecrit le reste.
    expect(
      arrivee,
      "l'enregistrement du bail a été refusé : rien n'a été écrit, et " +
        "l'assertion suivante ne prouverait donc rien"
    ).not.toContain("error=")

    const apres = await db.rental.findUniqueOrThrow({
      where: { id: decor.bail.id },
    })

    expect(
      Number(apres.monthlyRent),
      "le bail n'enregistre plus rien : la garde est trop large"
    ).toBe(77777)

    expect(
      apres.ownerId,
      "le bail a été rattaché au bailleur d'une autre agence — son nom " +
        "ressortira dans le contrat PDF et dans l'écran de gestion locative"
    ).toBe(avant.ownerId)
  })

  /**
   * `REP-02`. Le geste eprouve est le plus banal du produit — ouvrir une
   * fiche, cliquer « Enregistrer », sans rien modifier — et c'est celui qui
   * reecrivait le vendeur.
   */
  test("enregistrer sans rien changer ne recalcule pas le propriétaire", async ({
    page,
  }) => {
    test.setTimeout(240000)

    const agence = await creerAgence(["agency_admin"])
    agences.push(agence)

    const decor = await garnir(agence)
    const admin = await db.user.findFirstOrThrow({
      where: { agencyId: agence.agence.id, role: "agency_admin" },
    })

    const vendeur = await db.sale.findUniqueOrThrow({
      where: { id: decor.vente.id },
    })

    expect(
      vendeur.ownerId,
      "le décor ne porte aucun propriétaire sur la vente : le défaut serait " +
        "hors d'atteinte et ce test ne prouverait rien"
    ).not.toBeNull()

    // LE BIEN CHANGE DE MAINS. C'est banal : une agence corrige une saisie,
    // ou le bien est effectivement revendu.
    const nouveau = await db.owner.create({
      data: {
        firstName: "Nouveau",
        lastName: `Propriétaire ${agence.marque}`,
        agencyId: agence.agence.id,
      },
    })
    await db.property.update({
      where: { id: decor.bien.id },
      data: { ownerId: nouveau.id },
    })

    await login(page, admin.email)
    await page.goto(`/agency/sales/${decor.vente.id}/edit`)

    await Promise.all([
      page.waitForNavigation({ timeout: 30000 }),
      page.getByRole("button", { name: "Enregistrer" }).click(),
    ])

    expect(
      page.url(),
      "l'enregistrement a été refusé — le lien est intact parce que RIEN " +
        "n'a été écrit, ce qui ne prouve pas la propriété visée"
    ).not.toContain("error=")

    expect(
      (await db.sale.findUniqueOrThrow({ where: { id: decor.vente.id } }))
        .ownerId,
      "le vendeur de la vente a suivi le nouveau propriétaire du bien : " +
        "l'historique du dossier est réécrit par un simple enregistrement"
    ).toBe(vendeur.ownerId)
  })
})
