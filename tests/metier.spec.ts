import { test, expect } from "@playwright/test"
import { db } from "./db"
import { login } from "./auth-helper"
import { creerAgence, garnir, effacerAgence, Agence } from "./agence"
import { releverFormulaire, rejouer } from "./formulaire"

/**
 * Story 4.8 — REP-104. Ce fichier repond a UNE question, et a une seule :
 * si un module metier cesse d'enregistrer, est-ce que quelque chose le
 * dit ?
 *
 * LE CONSTAT QUI L'A FAIT NAITRE, MESURE LE 17-08-2026. Les neuf actions
 * de creation du produit ont ete neutralisees EN MEME TEMPS — `tsc` 0 et
 * `lint` 0 erreur verifies AVANT de lancer, sans quoi le build echoue et
 * le rouge ne vient plus du test (CLAUDE.md §6, piege 3) — puis la suite
 * complete relancee :
 *
 *   creation cassee -> ROUGE  : properties, documents, owners
 *   creation cassee -> RIEN   : clients, sales, rentals,
 *                               rental-management, payments, visits
 *
 * Six modules sur neuf pouvaient etre entierement morts sans qu'un seul
 * des 147 cas ne bronche. Verifie isolement sur `clients` d'abord :
 * creation supprimee, l'ecran annoncant toujours « Client cree » —
 * 147 passed.
 *
 * LA CAUSE ETAIT STRUCTURELLE, PAS UN OUBLI. `tests/agence.ts` monte ses
 * decors par `db.client.create`, `db.property.create`… — directement en
 * base, sans traverser une seule Server Action. La suite eprouvait donc
 * remarquablement ce qu'on peut LIRE et ce qu'on ne peut PAS lire ;
 * presque rien de ce qu'on peut ECRIRE.
 *
 * LA REGLE DE CE FICHIER, ET ELLE EST SIMPLE : le DECOR se pose par la
 * base, la CIBLE jamais. Un test qui creerait par `db.*.create` l'objet
 * dont il pretend prouver la creation ne prouverait rien du tout.
 *
 * CE QUE CE FICHIER NE PROUVE PAS, et il faut le lire ici plutot que le
 * supposer : que les modules soient JUSTES. Il prouve qu'ils ne sont pas
 * MORTS. Un formulaire qui enregistre le mauvais montant, une commission
 * mal calculee, un Decimal tronque passent tous dessous — c'est l'epopee 3
 * qui traite la justesse.
 */

/** Aujourd'hui au format d'un `input[type=date]`. */
function aujourdHui(): string {
  return new Date().toISOString().slice(0, 10)
}

test.describe("Les modules metier enregistrent vraiment (story 4.8)", () => {
  let agence: Agence | null = null

  // `afterEach`, JAMAIS `finally` (CLAUDE.md §6) : un depassement de delai
  // n'execute pas un `finally`, et le decor resterait en base. La suite
  // fuit deja environ quatre agences par execution (REP-97, story 4.7) ;
  // cette story ne doit pas aggraver le compte.
  test.afterEach(async () => {
    if (agence) {
      await effacerAgence(agence)
      agence = null
    }
  })

  test("un client s'enregistre par le formulaire, et la ligne existe", async ({
    page,
  }) => {
    test.setTimeout(120000)

    agence = await creerAgence()
    const agencyId = agence.agence.id
    const nom = `Client ${agence.marque}`

    await login(page, agence.admin!.email)

    const html = await releverFormulaire(
      page,
      "/agency/clients/new",
      "input[name='firstName']"
    )

    const arrivee = await rejouer(page, "/agency/clients/new", html, {
      firstName: "Prenom",
      lastName: nom,
    })

    const cree = await db.client.findFirst({ where: { agencyId, lastName: nom } })

    expect(
      cree,
      `MODULE « clients » : le formulaire a ete soumis et AUCUN client n'a ete ` +
        `enregistre. Le produit a repondu : ${arrivee}`
    ).not.toBeNull()
  })

  test("une visite s'enregistre par le formulaire, et la ligne existe", async ({
    page,
  }) => {
    test.setTimeout(120000)

    agence = await creerAgence()
    const agencyId = agence.agence.id
    // Decor uniquement : la visite, elle, doit naitre du formulaire.
    const decor = await garnir(agence)
    const marqueur = `Visite ${agence.marque}`

    await login(page, agence.admin!.email)

    const html = await releverFormulaire(
      page,
      "/agency/visits/new",
      "input[name='time']"
    )

    const arrivee = await rejouer(page, "/agency/visits/new", html, {
      date: aujourdHui(),
      time: "14:30",
      clientId: decor.client.id,
      propertyId: decor.bien.id,
      notes: marqueur,
    })

    const creee = await db.visit.findFirst({ where: { agencyId, notes: marqueur } })

    expect(
      creee,
      `MODULE « visits » : le formulaire a ete soumis et AUCUNE visite n'a ete ` +
        `enregistree. Le produit a repondu : ${arrivee}`
    ).not.toBeNull()
  })

  test("une vente s'enregistre par le formulaire, et la ligne existe", async ({
    page,
  }) => {
    test.setTimeout(120000)

    agence = await creerAgence()
    const agencyId = agence.agence.id
    const decor = await garnir(agence)

    // Aucun champ texte sur ce formulaire : le montant sert de marqueur.
    // `garnir()` pose 11 500 000, celui-ci est distinct a dessein.
    const MONTANT = "7777777"

    await login(page, agence.admin!.email)

    const html = await releverFormulaire(
      page,
      "/agency/sales/new",
      "input[name='finalPrice']"
    )

    const arrivee = await rejouer(page, "/agency/sales/new", html, {
      propertyId: decor.bien.id,
      clientId: decor.client.id,
      finalPrice: MONTANT,
      saleDate: aujourdHui(),
    })

    const creee = await db.sale.findFirst({
      where: { agencyId, finalPrice: Number(MONTANT) },
    })

    expect(
      creee,
      `MODULE « sales » : le formulaire a ete soumis et AUCUNE vente n'a ete ` +
        `enregistree. Le produit a repondu : ${arrivee}`
    ).not.toBeNull()
  })

  test("un bail s'enregistre par le formulaire, et la ligne existe", async ({
    page,
  }) => {
    test.setTimeout(120000)

    agence = await creerAgence()
    const agencyId = agence.agence.id
    const decor = await garnir(agence)

    // `garnir()` pose 60 000 : celui-ci doit s'en distinguer.
    const LOYER = "77777"

    await login(page, agence.admin!.email)

    const html = await releverFormulaire(
      page,
      "/agency/rentals/new",
      "input[name='monthlyRent']"
    )

    const arrivee = await rejouer(page, "/agency/rentals/new", html, {
      propertyId: decor.bien.id,
      clientId: decor.client.id,
      startDate: aujourdHui(),
      monthlyRent: LOYER,
    })

    const cree = await db.rental.findFirst({
      where: { agencyId, monthlyRent: Number(LOYER) },
    })

    expect(
      cree,
      `MODULE « rentals » : le formulaire a ete soumis et AUCUN bail n'a ete ` +
        `enregistre. Le produit a repondu : ${arrivee}`
    ).not.toBeNull()
  })

  test("un paiement s'enregistre par le formulaire, et la ligne existe", async ({
    page,
  }) => {
    test.setTimeout(120000)

    agence = await creerAgence()
    const agencyId = agence.agence.id
    await garnir(agence)
    const marqueur = `Paiement ${agence.marque}`

    await login(page, agence.admin!.email)

    const html = await releverFormulaire(
      page,
      "/agency/payments/new",
      "input[name='amount']"
    )

    // `type` N'A PAS DE VALEUR PAR DEFAUT dans `paymentSchema`,
    // contrairement a `method` et `status` : l'omettre fait refuser le
    // corps, et le refus se lirait comme « la creation ne marche pas ».
    //
    // La valeur vient de l'enumeration `PaymentType` du schema, pas d'une
    // supposition : la premiere redaction avait ecrit « commission », qui
    // n'existe pas — le vrai nom est `commission_agence`. Le produit l'a
    // dit sans ambiguite (`?error=Type de paiement invalide (champ : type)`)
    // parce que ce fichier reporte l'URL d'arrivee dans ses echecs. C'est
    // precisement a cela qu'elle sert.
    const arrivee = await rejouer(page, "/agency/payments/new", html, {
      amount: "12345",
      type: "commission_agence",
      date: aujourdHui(),
      notes: marqueur,
    })

    const cree = await db.payment.findFirst({ where: { agencyId, notes: marqueur } })

    expect(
      cree,
      `MODULE « payments » : le formulaire a ete soumis et AUCUN paiement n'a ` +
        `ete enregistre. Le produit a repondu : ${arrivee}`
    ).not.toBeNull()
  })

  test("une quittance de gestion locative s'enregistre, et la ligne existe", async ({
    page,
  }) => {
    test.setTimeout(120000)

    agence = await creerAgence()
    const decor = await garnir(agence)

    // `garnir()` pose la quittance de janvier 2026 sur ce meme bail :
    // un autre mois evite de buter sur une eventuelle unicite.
    const MOIS = 7

    await login(page, agence.admin!.email)

    const html = await releverFormulaire(
      page,
      "/agency/rental-management/new",
      "input[name='rentAmount']"
    )

    // `month` et `year` sont des CHAINES transformees par le schema, pas
    // des nombres : "7", jamais 7.
    const arrivee = await rejouer(page, "/agency/rental-management/new", html, {
      rentalId: decor.bail.id,
      month: String(MOIS),
      year: "2026",
      rentAmount: "60000",
    })

    // `RentalManagement` ne porte pas d'`agencyId` : il est rattache a
    // l'agence PAR SON BAIL. Le cloisonnement se lit donc sur `rentalId`,
    // et c'est aussi ce qui identifie la quittance de ce test.
    const creee = await db.rentalManagement.findFirst({
      where: { rentalId: decor.bail.id, month: MOIS, year: 2026 },
    })

    expect(
      creee,
      `MODULE « rental-management » : le formulaire a ete soumis et AUCUNE ` +
        `quittance n'a ete enregistree. Le produit a repondu : ${arrivee}`
    ).not.toBeNull()
  })
})
