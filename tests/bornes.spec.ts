import { test, expect } from "@playwright/test"
import { db } from "./db"
import { login } from "./auth-helper"
import { creerAgence, garnir, effacerAgence, Agence } from "./agence"
import { releverFormulaire, rejouer } from "./formulaire"

/**
 * Story 3.1 — BUG-05 et BUG-11. Une saisie trop grande ne partait pas
 * jusqu'a PostgreSQL par negligence : rien ne la bornait. L'agent
 * recevait une erreur brute et PERDAIT sa saisie.
 *
 * LES TROIS BORNES SONT MESUREES, le 17-08-2026, contre la base, sur des
 * expressions pures :
 *
 *   REFUSE  numeric(5,2)  <- 1000            numeric field overflow  (22003)
 *   REFUSE  numeric(15,2) <- 10000000000000  numeric field overflow  (22003)
 *   REFUSE  int4          <- 2147483648      integer out of range    (22003)
 *
 * CHAQUE REFUS A SON CONTROLE POSITIF, et ce n'est pas de la ceinture et
 * bretelles (CLAUDE.md §6) : un formulaire casse pour tout le monde
 * donnerait exactement le meme vert qu'une borne correctement posee. Les
 * cas ci-dessous soumettent donc toujours DEUX corps sur le meme
 * formulaire — un juste, un faux — et verifient les deux effets EN BASE.
 *
 * LE CAS QUI COMPTE LE PLUS EST LE DERNIER. « Commission » designe trois
 * choses dans ce schema, et deux sont des MONTANTS en Decimal(15,2). Une
 * borne posee sur le NOM du champ plutot que sur sa colonne passerait tous
 * les autres cas de ce fichier et rendrait impossible toute commission de
 * vente au-dela de 100 DA — CLAUDE.md §8, trois fois verifie dans ce depot.
 */

/** Aujourd'hui au format d'un `input[type=date]`. */
function aujourdHui(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Le minimum qu'exige `propertySchema` pour un bien en vente. */
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

test.describe("Les saisies numeriques sont bornees (story 3.1)", () => {
  let agence: Agence | null = null

  // `afterEach`, JAMAIS `finally` (CLAUDE.md §6).
  test.afterEach(async () => {
    if (agence) {
      await effacerAgence(agence)
      agence = null
    }
  })

  test("la commission d'un bien est un taux : 1000 et 150 sont refuses, 100 passe", async ({
    page,
  }) => {
    test.setTimeout(180000)

    agence = await creerAgence()
    const agencyId = agence.agence.id

    await login(page, agence.admin!.email)

    const html = await releverFormulaire(
      page,
      "/agency/properties/new",
      "input[name='title']"
    )

    // --- LE CONTROLE POSITIF, D'ABORD --------------------------------
    // 100 EST INCLUS : un mandat a 100 % est legitime. Sans ce cas, une
    // borne posee a `< 100` — ou un formulaire entierement casse —
    // donnerait le meme vert que les deux refus ci-dessous.
    const titreJuste = `Taux juste ${agence.marque}`
    await rejouer(page, "/agency/properties/new", html, {
      ...bienValide(titreJuste),
      commission: "100",
    })

    const accepte = await db.property.findFirst({
      where: { agencyId, title: titreJuste },
    })

    expect(
      accepte,
      "une commission de 100 % a ete REFUSEE : la borne est exclusive alors " +
        "qu'un mandat a 100 % est legitime — et les deux refus ci-dessous ne " +
        "prouveraient plus rien"
    ).not.toBeNull()
    expect(Number(accepte!.commission), "le taux accepte n'a pas ete enregistre").toBe(100)

    // --- 1000 : ce qui faisait PERDRE LA SAISIE ----------------------
    // La colonne Decimal(5,2) le refusait deja, par `numeric field
    // overflow` — un ecran technique. Il doit desormais etre refuse
    // proprement, AVANT la base.
    const titreMille = `Taux 1000 ${agence.marque}`
    const apresMille = await rejouer(page, "/agency/properties/new", html, {
      ...bienValide(titreMille),
      commission: "1000",
    })

    expect(
      await db.property.findFirst({ where: { agencyId, title: titreMille } }),
      "un bien a ete cree avec une commission de 1000 % (BUG-05)"
    ).toBeNull()

    expect(
      apresMille,
      "le refus de 1000 n'annonce pas le pourcentage : l'agent ne saura pas " +
        "qu'on attend un taux et non un montant en dinars"
    ).toContain("pourcentage")

    // --- 150 : ce qui etait ACCEPTE, et le pire des deux --------------
    // La base l'acceptait, et la gestion locative calculait alors 150 %
    // du loyer. Un chiffre absurde applique fidelement, sans qu'aucun
    // ecran ne proteste.
    const titreCentCinquante = `Taux 150 ${agence.marque}`
    const apres150 = await rejouer(page, "/agency/properties/new", html, {
      ...bienValide(titreCentCinquante),
      commission: "150",
    })

    expect(
      await db.property.findFirst({ where: { agencyId, title: titreCentCinquante } }),
      "un bien a ete cree avec une commission de 150 % : la gestion locative " +
        "calculera 150 % du loyer (BUG-05, le cas le plus couteux car SILENCIEUX)"
    ).toBeNull()

    expect(
      apres150,
      "le refus de 150 n'annonce pas le pourcentage"
    ).toContain("pourcentage")
  })

  test("les pieces et les etages sont bornes avant PostgreSQL", async ({ page }) => {
    test.setTimeout(180000)

    agence = await creerAgence()
    const agencyId = agence.agence.id

    await login(page, agence.admin!.email)

    const html = await releverFormulaire(
      page,
      "/agency/properties/new",
      "input[name='title']"
    )

    // --- LE CONTROLE POSITIF -----------------------------------------
    const titreJuste = `Entiers justes ${agence.marque}`
    await rejouer(page, "/agency/properties/new", html, {
      ...bienValide(titreJuste),
      rooms: "5",
      totalFloors: "12",
    })

    const accepte = await db.property.findFirst({
      where: { agencyId, title: titreJuste },
    })

    expect(
      accepte,
      "un bien de 5 pieces et 12 etages a ete refuse : la borne mord sur des " +
        "valeurs normales, et les refus ci-dessous ne prouveraient rien"
    ).not.toBeNull()
    expect(accepte!.rooms, "le nombre de pieces n'a pas ete enregistre").toBe(5)

    // --- AU-DELA DE L'ENTIER 32 BITS : ce que decrit BUG-11 -----------
    // 2 147 483 648 faisait lever PostgreSQL (`integer out of range`).
    const titreEnorme = `Entier hors colonne ${agence.marque}`
    await rejouer(page, "/agency/properties/new", html, {
      ...bienValide(titreEnorme),
      rooms: "2147483648",
    })

    expect(
      await db.property.findFirst({ where: { agencyId, title: titreEnorme } }),
      "un bien a ete cree avec 2 147 483 648 pieces (BUG-11)"
    ).toBeNull()

    // --- AU-DELA DU REALISTE ------------------------------------------
    const titreIrrealiste = `Etages irrealistes ${agence.marque}`
    const apres = await rejouer(page, "/agency/properties/new", html, {
      ...bienValide(titreIrrealiste),
      totalFloors: "5000",
    })

    expect(
      await db.property.findFirst({ where: { agencyId, title: titreIrrealiste } }),
      "un bien a ete cree avec 5000 etages"
    ).toBeNull()

    expect(
      apres,
      "le refus ne porte pas de message francais lisible pour l'agent"
    ).toMatch(/etages?/i)
  })

  test("un montant au-dela de la colonne est refuse proprement, pas par la base", async ({
    page,
  }) => {
    test.setTimeout(180000)

    agence = await creerAgence()
    const agencyId = agence.agence.id

    await login(page, agence.admin!.email)

    const html = await releverFormulaire(
      page,
      "/agency/properties/new",
      "input[name='title']"
    )

    // --- LE CONTROLE POSITIF : le plus grand montant ENCORE valide ----
    // Mesure : `numeric(15,2)` accepte 9 999 999 999 999,99 et refuse la
    // valeur suivante. La borne est donc eprouvee A SON BORD, la ou une
    // erreur d'un chiffre se verrait.
    const titreJuste = `Montant au bord ${agence.marque}`
    await rejouer(page, "/agency/properties/new", html, {
      ...bienValide(titreJuste),
      salePrice: "9999999999999.99",
    })

    expect(
      await db.property.findFirst({ where: { agencyId, title: titreJuste } }),
      "le plus grand montant que la colonne accepte a ete refuse : la borne " +
        "est posee un cran trop bas"
    ).not.toBeNull()

    // --- LE PREMIER MONTANT QUI DEBORDE -------------------------------
    const titreTrop = `Montant hors colonne ${agence.marque}`
    const apres = await rejouer(page, "/agency/properties/new", html, {
      ...bienValide(titreTrop),
      salePrice: "10000000000000",
    })

    expect(
      await db.property.findFirst({ where: { agencyId, title: titreTrop } }),
      "un bien a ete cree avec un prix que la colonne ne peut pas porter"
    ).toBeNull()

    expect(
      apres,
      "le refus n'annonce pas un maximum : l'agent recevrait un ecran " +
        "technique et perdrait sa saisie (BUG-05, meme famille)"
    ).toMatch(/maximum/i)
  })

  test("la taille d'un document reste bornee a l'entier de la colonne, pas a une borne de logement", async ({
    page,
  }) => {
    test.setTimeout(180000)

    agence = await creerAgence()
    const decor = await garnir(agence)

    await login(page, agence.admin!.email)

    const ecran = `/agency/documents/${decor.document.id}/edit`
    const html = await releverFormulaire(page, ecran, "input[name='size']")

    // --- LE CONTROLE POSITIF, ET C'EST LUI LE VRAI SUJET --------------
    // `Document.size` partage `optionalInt` avec `rooms` et `floor`, mais
    // il vaut des OCTETS. Une borne de logement posee sur la primitive
    // commune casserait tout televersement : 5 Mo, c'est 5 242 880.
    const TAILLE = 5_242_880

    await rejouer(page, ecran, html, { size: String(TAILLE) })

    const apresJuste = await db.document.findUnique({
      where: { id: decor.document.id },
    })

    expect(
      apresJuste?.size,
      "une taille de 5 Mo a ete refusee : la borne de `optionalInt` a ete " +
        "reglee sur une valeur de logement, et plus aucun document ne " +
        "s'enregistre (story 3.1, T3)"
    ).toBe(TAILLE)

    // --- AU-DELA DE L'ENTIER 32 BITS ----------------------------------
    const apres = await rejouer(page, ecran, html, { size: "2147483648" })

    const apresTrop = await db.document.findUnique({
      where: { id: decor.document.id },
    })

    expect(
      apresTrop?.size,
      "une taille de 2 147 483 648 a ete enregistree : la colonne est un " +
        `Int 32 bits, PostgreSQL leverait (BUG-11). Le produit a repondu : ${apres}`
    ).toBe(TAILLE)

    // ET LE REFUS DOIT ETRE PROPRE, pas un plantage. Cette seconde
    // assertion n'est pas de la redondance : sans borne, l'ecriture part
    // jusqu'a PostgreSQL, qui leve — la ligne reste alors inchangee
    // EXACTEMENT comme apres un refus propre, et l'assertion ci-dessus
    // resterait verte sur un produit casse. C'est le piege 1 de
    // CLAUDE.md §6, et il s'est referme sur la premiere redaction de ce
    // cas : la mutation l'a laisse vert.
    expect(
      apres,
      "la taille hors colonne n'a pas ete refusee par un message : l'agent " +
        "recoit un ecran technique au lieu d'une explication"
    ).toMatch(/maximum/i)
  })

  test("une commission de VENTE reste un montant, et n'est pas bornee a 100", async ({
    page,
  }) => {
    test.setTimeout(180000)

    agence = await creerAgence()
    const agencyId = agence.agence.id
    const decor = await garnir(agence)

    await login(page, agence.admin!.email)

    const html = await releverFormulaire(
      page,
      "/agency/sales/new",
      "input[name='finalPrice']"
    )

    // 250 000 DA de commission : parfaitement normal sur une vente, et
    // trois mille fois au-dessus de la borne de TAUX.
    const MONTANT = "7654321"
    const COMMISSION = "250000"

    const apres = await rejouer(page, "/agency/sales/new", html, {
      propertyId: decor.bien.id,
      clientId: decor.client.id,
      finalPrice: MONTANT,
      commission: COMMISSION,
      saleDate: aujourdHui(),
    })

    const creee = await db.sale.findFirst({
      where: { agencyId, finalPrice: Number(MONTANT) },
    })

    expect(
      creee,
      "LA CORRECTION A DEPLACE LE PROBLEME (CLAUDE.md §8) : une commission de " +
        "250 000 DA sur une vente a ete refusee. La borne de TAUX a ete posee " +
        "sur le NOM « commission » au lieu de la colonne — `Sale.commission` " +
        `est un Decimal(15,2), un montant. Le produit a repondu : ${apres}`
    ).not.toBeNull()

    expect(
      Number(creee!.commission),
      "la commission de vente n'a pas ete enregistree telle que soumise"
    ).toBe(Number(COMMISSION))
  })
})
