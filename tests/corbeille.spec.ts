import { test, expect } from "@playwright/test"
import { readFileSync } from "fs"
import { db } from "./db"
import { creerAgence, effacerAgence, garnir, type Agence } from "./agence"
import { login } from "./auth-helper"

/**
 * Un parent en corbeille ne doit pas faire changer d'objet ses enfants
 * (BUG-34, story 3.9).
 *
 * LE GESTE EPROUVE EST LE PLUS BANAL DU PRODUIT : ouvrir une fiche, cliquer
 * « Enregistrer », sans rien modifier. C'est celui d'un utilisateur qui
 * corrige un detail — et c'etait celui qui reecrivait le lien metier.
 *
 * La cause : la liste deroulante est batie par le client Prisma etendu, qui
 * masque les lignes `deletedAt`, tandis que `defaultValue` designe toujours
 * le parent devenu invisible. Aucune option ne correspond, le navigateur
 * retombe sur LA PREMIERE, et le formulaire part avec elle.
 */

/** Les cinq ecrans, et ce que chacun ne doit pas perdre. */
type Cible = {
  nom: string
  ecran: (ids: Ids) => string
  champs: (ids: Ids) => Array<{ nom: string; attendu: string }>
  relire: (ids: Ids) => Promise<Record<string, string | null>>
}

type Ids = {
  bien: string
  bienVivant: string
  client: string
  proprietaire: string
  visite: string
  vente: string
  bail: string
  paiement: string
}

const CIBLES: Cible[] = [
  {
    nom: "visite",
    ecran: (i) => `/agency/visits/${i.visite}/edit`,
    champs: (i) => [
      { nom: "propertyId", attendu: i.bien },
      { nom: "clientId", attendu: i.client },
    ],
    relire: async (i) => {
      const r = await db.visit.findUniqueOrThrow({ where: { id: i.visite } })
      return { propertyId: r.propertyId, clientId: r.clientId }
    },
  },
  {
    nom: "vente",
    ecran: (i) => `/agency/sales/${i.vente}/edit`,
    champs: (i) => [
      { nom: "propertyId", attendu: i.bien },
      { nom: "clientId", attendu: i.client },
    ],
    relire: async (i) => {
      const r = await db.sale.findUniqueOrThrow({ where: { id: i.vente } })
      return { propertyId: r.propertyId, clientId: r.clientId }
    },
  },
  {
    nom: "bail",
    ecran: (i) => `/agency/rentals/${i.bail}/edit`,
    champs: (i) => [
      { nom: "propertyId", attendu: i.bien },
      { nom: "clientId", attendu: i.client },
    ],
    relire: async (i) => {
      const r = await db.rental.findUniqueOrThrow({ where: { id: i.bail } })
      return { propertyId: r.propertyId, clientId: r.clientId }
    },
  },
  {
    nom: "paiement",
    ecran: (i) => `/agency/payments/${i.paiement}/edit`,
    champs: (i) => [
      { nom: "propertyId", attendu: i.bien },
      { nom: "clientId", attendu: i.client },
      // Le dixieme couple. `garnir()` cree le paiement sans proprietaire :
      // sans l'ajouter, cette branche n'est jamais empruntee et sa
      // suppression ne rougirait rien.
      { nom: "ownerId", attendu: i.proprietaire },
    ],
    relire: async (i) => {
      const r = await db.payment.findUniqueOrThrow({ where: { id: i.paiement } })
      return {
        propertyId: r.propertyId,
        clientId: r.clientId,
        ownerId: r.ownerId,
      }
    },
  },
  {
    nom: "bien",
    ecran: (i) => `/agency/properties/${i.bienVivant}/edit`,
    champs: (i) => [{ nom: "ownerId", attendu: i.proprietaire }],
    relire: async (i) => {
      const r = await db.property.findUniqueOrThrow({
        where: { id: i.bienVivant },
      })
      return { ownerId: r.ownerId }
    },
  },
]

test.describe("Un parent en corbeille ne déplace pas ses enfants (BUG-34)", () => {
  test("ouvrir puis enregistrer sans rien changer ne réécrit aucun lien", async ({
    page,
  }) => {
    test.setTimeout(300000)

    const agence = await creerAgence(["agency_admin"])

    try {
      const decor = await garnir(agence)
      const admin = await db.user.findFirstOrThrow({
        where: { agencyId: agence.agence.id, role: "agency_admin" },
      })

      // Il faut d'AUTRES options dans les listes : sans elles, le
      // navigateur n'aurait nulle part où retomber et le défaut serait
      // invisible. C'est le décor d'une agence réelle.
      const bienVivant = await db.property.create({
        data: {
          title: `Bien vivant ${agence.marque}`,
          category: "residentiel",
          type: "appartement",
          operationType: "vente",
          wilaya: "Oran",
          commune: "Bir El Djir",
          // Un bien en vente sans prix ne passe pas `propertySchema` : le
          // décor doit être ENREGISTRABLE, sinon le test rougit sur sa
          // propre invalidité et non sur le défaut éprouvé.
          salePrice: 9_000_000,
          agencyId: agence.agence.id,
          ownerId: decor.proprietaire.id,
        },
      })
      await db.client.create({
        data: {
          firstName: "Client",
          lastName: `Vivant ${agence.marque}`,
          agencyId: agence.agence.id,
        },
      })
      await db.owner.create({
        data: {
          firstName: "Propriétaire",
          lastName: `Vivant ${agence.marque}`,
          agencyId: agence.agence.id,
        },
      })

      const ids: Ids = {
        bien: decor.bien.id,
        bienVivant: bienVivant.id,
        client: decor.client.id,
        proprietaire: decor.proprietaire.id,
        visite: decor.visite.id,
        vente: decor.vente.id,
        bail: decor.bail.id,
        paiement: decor.paiement.id,
      }

      // Le paiement du décor n'a pas de propriétaire : on lui en donne un,
      // sans quoi le dixième couple resterait hors d'atteinte.
      await db.payment.update({
        where: { id: decor.paiement.id },
        data: { ownerId: decor.proprietaire.id },
      })

      // LA MISE À LA CORBEILLE — celle que la story 4.6 a rendue possible
      // depuis l'écran d'édition, et que la route d'API faisait déjà.
      const maintenant = new Date()
      await db.property.update({
        where: { id: decor.bien.id },
        data: { deletedAt: maintenant },
      })
      await db.client.update({
        where: { id: decor.client.id },
        data: { deletedAt: maintenant },
      })
      await db.owner.update({
        where: { id: decor.proprietaire.id },
        data: { deletedAt: maintenant },
      })

      await login(page, admin.email)

      for (const cible of CIBLES) {
        const ecran = cible.ecran(ids)
        await page.goto(ecran)

        // 1. La liste PROPOSE toujours le parent en corbeille, étiqueté.
        for (const champ of cible.champs(ids)) {
          const valeur = await page
            .locator(`select[name="${champ.nom}"]`)
            .inputValue()

          expect(
            valeur,
            `${cible.nom} → ${champ.nom} : la liste est retombée sur une autre option`
          ).toBe(champ.attendu)

          /**
           * L'ÉTIQUETTE, et elle n'est pas cosmétique : l'option n'étant
           * délibérément pas `disabled`, le libellé est le SEUL signal que
           * ce parent est en corbeille. Sans cette assertion, vider le
           * suffixe d'`optionsParent()` laisse toute la suite verte et l'agent
           * choisit un parent supprimé sans le savoir — la moitié de
           * l'arbitrage rendu. Relevé par la revue du 12-08-2026.
           */
          const etiquette = await page
            .locator(`select[name="${champ.nom}"] option[value="${champ.attendu}"]`)
            .textContent()

          expect(
            etiquette ?? "",
            `${cible.nom} → ${champ.nom} : le parent en corbeille n'est pas signalé comme tel`
          ).toContain("en corbeille")
        }

        // 2. Et enregistrer SANS RIEN CHANGER ne réécrit rien.
        await Promise.all([
          page.waitForNavigation({ timeout: 30000 }),
          page.getByRole("button", { name: "Enregistrer" }).click(),
        ])

        /**
         * L'ENREGISTREMENT A ABOUTI, et cette assertion n'est pas
         * décorative : un enregistrement REFUSÉ laisse lui aussi le lien
         * inchangé. Sans elle, le test passe alors que l'écran est devenu
         * impossible à enregistrer — c'est-à-dire alors qu'on a remplacé
         * une corruption silencieuse par un blocage, l'issue que cette
         * story écarte explicitement.
         *
         * Relevé par la revue du 12-08-2026, et c'est la deuxième fois que
         * la preuve d'un correctif ne distingue pas le succès de l'échec.
         */
        expect(
          page.url(),
          `${cible.nom} : l'enregistrement a été refusé — le lien est intact parce que RIEN n'a été écrit`
        ).not.toContain("error=")

        const apres = await cible.relire(ids)
        for (const champ of cible.champs(ids)) {
          expect(
            apres[champ.nom],
            `${cible.nom} → ${champ.nom} : le lien a été réécrit par un simple enregistrement`
          ).toBe(champ.attendu)
        }
      }
    } finally {
      await effacerAgence(agence)
    }
  })

  /**
   * LE GESTE QUE LA STORY EXISTE POUR SAUVER, et que rien n'eprouvait.
   *
   * « Corriger une heure » : la premiere version du correctif laissait le
   * lien intact — mais parce que RIEN n'etait ecrit, l'enregistrement etant
   * refuse. La correction de l'heure etait perdue elle aussi. Verifier que
   * le lien n'a pas bouge ne dit donc rien tant qu'on ne verifie pas qu'une
   * modification VOULUE, elle, a bien ete enregistree.
   */
  test("corriger un détail sur une fiche dont le parent est en corbeille l'enregistre vraiment", async ({
    page,
  }) => {
    test.setTimeout(240000)

    const agence = await creerAgence(["agency_admin"])

    try {
      const decor = await garnir(agence)
      const admin = await db.user.findFirstOrThrow({
        where: { agencyId: agence.agence.id, role: "agency_admin" },
      })

      await db.property.create({
        data: {
          title: `Bien vivant ${agence.marque}`,
          category: "residentiel",
          type: "appartement",
          operationType: "vente",
          wilaya: "Oran",
          commune: "Bir El Djir",
          salePrice: 9_000_000,
          agencyId: agence.agence.id,
          ownerId: decor.proprietaire.id,
        },
      })

      await db.property.update({
        where: { id: decor.bien.id },
        data: { deletedAt: new Date() },
      })

      await login(page, admin.email)
      await page.goto(`/agency/visits/${decor.visite.id}/edit`)

      await page.fill('input[name="time"]', "18:45")
      await Promise.all([
        page.waitForNavigation({ timeout: 30000 }),
        page.getByRole("button", { name: "Enregistrer" }).click(),
      ])

      const apres = await db.visit.findUniqueOrThrow({
        where: { id: decor.visite.id },
      })

      expect(
        apres.time,
        "la correction n'a pas été enregistrée : la fiche est bloquée par son parent en corbeille"
      ).toBe("18:45")
      expect(
        apres.propertyId,
        "la correction a réécrit le lien vers le bien"
      ).toBe(decor.bien.id)
    } finally {
      await effacerAgence(agence)
    }
  })

  /**
   * LE CONTROLE POSITIF, et il n'est pas decoratif ici : un test qui
   * verifie qu'un lien NE CHANGE PAS passerait tout aussi bien sur un
   * ecran dont l'enregistrement serait casse pour tout le monde.
   */
  test("un changement de parent voulu fonctionne toujours", async ({ page }) => {
    test.setTimeout(240000)

    const agence = await creerAgence(["agency_admin"])

    try {
      const decor = await garnir(agence)
      const admin = await db.user.findFirstOrThrow({
        where: { agencyId: agence.agence.id, role: "agency_admin" },
      })

      const autre = await db.property.create({
        data: {
          title: `Bien choisi ${agence.marque}`,
          category: "residentiel",
          type: "appartement",
          operationType: "vente",
          wilaya: "Oran",
          commune: "Bir El Djir",
          agencyId: agence.agence.id,
          ownerId: decor.proprietaire.id,
        },
      })

      await login(page, admin.email)
      await page.goto(`/agency/visits/${decor.visite.id}/edit`)

      await page.selectOption('select[name="propertyId"]', autre.id)
      await Promise.all([
        page.waitForNavigation({ timeout: 30000 }),
        page.getByRole("button", { name: "Enregistrer" }).click(),
      ])

      const apres = await db.visit.findUniqueOrThrow({
        where: { id: decor.visite.id },
      })
      expect(
        apres.propertyId,
        "un changement de bien délibéré n'est plus enregistré"
      ).toBe(autre.id)
    } finally {
      await effacerAgence(agence)
    }
  })
})

/**
 * Les bords que la revue de la story 3.9 avait laisses ouverts (story 3.10).
 *
 * REP-03, REP-06 et REP-07 ne sont pas trois defauts mais trois symptomes
 * d'un meme choix : avoir bati la liste en DEUX requetes puis recolle le
 * resultat en memoire. Ils se ferment d'un seul geste — une requete unique
 * — et c'est cette requete que les tests ci-dessous eprouvent, chacun par
 * un effet different.
 */
test.describe("Les bords de la reprise d'un parent en corbeille (story 3.10)", () => {
  const ECRANS = [
    "app/agency/visits/[id]/edit/page.tsx",
    "app/agency/sales/[id]/edit/page.tsx",
    "app/agency/rentals/[id]/edit/page.tsx",
    "app/agency/payments/[id]/edit/page.tsx",
    "app/agency/properties/[id]/edit/page.tsx",
  ]

  const agences: Agence[] = []

  // Nettoyage par `afterEach`, jamais par `finally` (CLAUDE.md §6) : un
  // depassement de delai n'execute pas un `finally`.
  test.afterEach(async () => {
    while (agences.length) {
      await effacerAgence(agences.pop() as Agence)
    }
  })

  /**
   * REP-07 — la requete supplementaire a disparu.
   *
   * CE QUE CE TEST VAUT, ET CE QU'IL NE VAUT PAS. Il garde la FORME DE LA
   * SOURCE, comme `tests/comptage.spec.ts` le fait pour le `_count` : un
   * test de navigateur ne compte pas les requetes qu'un Server Component
   * adresse a PostgreSQL, et un test de duree serait instable.
   *
   * Le motif cherche est la signature exacte de la requete retiree —
   * `deletedAt: { not: null }`, la relecture du seul parent archive. Elle
   * ne subsiste nulle part : la liste et son parent courant viennent
   * ensemble.
   */
  test("aucun écran ne relit le parent archivé par une requête à part", () => {
    for (const ecran of ECRANS) {
      // Les commentaires sont retires avant comparaison : la lecon de la
      // story 2.8, ou un motif avait ete trouve dans le commentaire qui
      // EXPLIQUAIT la regle.
      const source = readFileSync(ecran, "utf-8")
        .split("\n")
        .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
        .join("\n")
        .replace(/\s+/g, " ")

      expect(
        source,
        `${ecran} relit encore le parent archivé par une seconde requête : ` +
          `c'est REP-07, et avec lui REP-03 (une restauration entre les deux ` +
          `requêtes échappe aux deux listes)`
      ).not.toContain("deletedAt: { not: null }")

      expect(
        source,
        `${ecran} ne bâtit plus sa liste par \`vivantsEtCourant()\` : le parent ` +
          `en corbeille va disparaître de la liste, et BUG-34 revient`
      ).toContain("vivantsEtCourant(")
    }
  })

  /**
   * REP-06 — c'est la base qui range, pas nous.
   *
   * Le parent en corbeille etait recolle EN TETE de la liste. Deux couts :
   * l'ordre annonce par l'`orderBy` etait faux, et surtout cette premiere
   * place est exactement celle sur laquelle le navigateur retombe pour
   * TOUT AUTRE decalage — le parent supprime devenait la cible par defaut
   * du defaut suivant.
   */
  test("le parent en corbeille reprend sa place dans l'ordre de la liste", async ({
    page,
  }) => {
    test.setTimeout(180000)

    const agence = await creerAgence(["agency_admin"])
    agences.push(agence)

    const decor = await garnir(agence)
    const admin = await db.user.findFirstOrThrow({
      where: { agencyId: agence.agence.id, role: "agency_admin" },
    })

    // Cree APRES le bien du decor. L'ecran des visites trie les biens par
    // `createdAt: "desc"` : le plus recent doit donc arriver EN PREMIER,
    // meme quand l'autre est en corbeille.
    const plusRecent = await db.property.create({
      data: {
        title: `Bien récent ${agence.marque}`,
        category: "residentiel",
        type: "appartement",
        operationType: "vente",
        wilaya: "Oran",
        commune: "Bir El Djir",
        salePrice: 9_000_000,
        agencyId: agence.agence.id,
        ownerId: decor.proprietaire.id,
      },
    })

    await db.property.update({
      where: { id: decor.bien.id },
      data: { deletedAt: new Date() },
    })

    await login(page, admin.email)
    await page.goto(`/agency/visits/${decor.visite.id}/edit`)

    const options = page.locator('select[name="propertyId"] option')

    await expect(
      options,
      "la liste des biens n'a pas les deux options attendues"
    ).toHaveCount(2, { timeout: 30000 })

    expect(
      await options.first().getAttribute("value"),
      "le bien en corbeille est toujours placé en tête : l'ordre annoncé par " +
        "`orderBy` est faux, et cette place est celle sur laquelle le navigateur " +
        "retombe"
    ).toBe(plusRecent.id)

    // CONTROLE POSITIF, et il n'est pas decoratif : une liste ou le parent
    // en corbeille aurait purement DISPARU passerait la premiere assertion
    // sans rien prouver — ce serait BUG-34 revenu.
    expect(
      await options.nth(1).getAttribute("value"),
      "le bien en corbeille n'est plus proposé du tout : c'est BUG-34 qui revient"
    ).toBe(decor.bien.id)

    expect(
      await page.locator('select[name="propertyId"]').inputValue(),
      "le formulaire ne porte plus le bien de la visite"
    ).toBe(decor.bien.id)
  })

  /**
   * REP-04 — fermer la famille, pas seulement la cause.
   *
   * La story 3.9 a traite UNE cause de « `defaultValue` ne correspond a
   * aucune option » : la corbeille. Les autres restent, et donnent le meme
   * symptome, qui est le vrai defaut : le navigateur choisit a la place de
   * l'utilisateur et personne ne le voit.
   *
   * Le decor monte la cause la plus nette — un lien qui designe le bien
   * d'une AUTRE agence. Le cloisonnement fait que ce bien n'est pas
   * lisible ici ; sans l'option fabriquee, le navigateur retombait sur le
   * premier bien de l'agence et l'enregistrement REUSSISSAIT avec lui.
   */
  test("une référence illisible est affichée, et son enregistrement refusé", async ({
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

    const bienDAilleurs = await db.property.create({
      data: {
        title: `Bien d'ailleurs ${voisine.marque}`,
        category: "residentiel",
        type: "appartement",
        operationType: "vente",
        wilaya: "Oran",
        commune: "Bir El Djir",
        salePrice: 9_000_000,
        agencyId: voisine.agence.id,
      },
    })

    // La derive elle-meme. Aucune contrainte de base ne l'empeche : c'est
    // le logiciel qui tient le cloisonnement, pas le schema.
    await db.visit.update({
      where: { id: decor.visite.id },
      data: { propertyId: bienDAilleurs.id },
    })

    await login(page, admin.email)
    await page.goto(`/agency/visits/${decor.visite.id}/edit`)

    const select = page.locator('select[name="propertyId"]')

    await expect(select, "l'écran ne s'est pas affiché").toBeVisible({
      timeout: 30000,
    })

    expect(
      await select.inputValue(),
      "le formulaire est retombé sur un autre bien : c'est le défaut de BUG-34, " +
        "avec une autre cause"
    ).toBe(bienDAilleurs.id)

    expect(
      await select.locator(`option[value="${bienDAilleurs.id}"]`).textContent(),
      "rien ne signale à l'agent que ce rattachement est illisible"
    ).toContain("introuvable")

    await Promise.all([
      page.waitForNavigation({ timeout: 30000 }),
      page.getByRole("button", { name: "Enregistrer" }).click(),
    ])

    expect(
      page.url(),
      "l'enregistrement a été accepté alors que le bien n'appartient pas à " +
        "l'agence : le cloisonnement passe par-dessus bord"
    ).toContain("error=")

    const apres = await db.visit.findUniqueOrThrow({
      where: { id: decor.visite.id },
    })
    expect(
      apres.propertyId,
      "le lien a été réécrit malgré le refus"
    ).toBe(bienDAilleurs.id)

    /**
     * LE CONTROLE POSITIF, sur le MEME chemin. Sans lui, ce test resterait
     * vert sur un ecran devenu impossible a enregistrer pour tout le monde
     * — c'est la troisieme fois que ce piege se presente dans ce dossier.
     */
    await page.selectOption('select[name="propertyId"]', decor.bien.id)
    await Promise.all([
      page.waitForNavigation({ timeout: 30000 }),
      page.getByRole("button", { name: "Enregistrer" }).click(),
    ])

    const repare = await db.visit.findUniqueOrThrow({
      where: { id: decor.visite.id },
    })
    expect(
      repare.propertyId,
      "corriger le rattachement ne fonctionne pas : l'écran est bloqué"
    ).toBe(decor.bien.id)
  })

  /**
   * REP-14 — une echeance reglee ne se supprime pas.
   *
   * Le voisin de cette famille : ce n'est pas la corbeille, c'est le meme
   * mecanisme — une donnee qui disparait sans que personne ne l'ait voulu.
   * La contrainte `@@unique([rentalId, month, year])` redevient libre a la
   * suppression : une nouvelle ligne peut etre creee pour la meme periode,
   * et la trace du versement au proprietaire n'existe plus nulle part.
   */
  test("une échéance réglée ne se supprime pas, une échéance en attente si", async ({
    page,
  }) => {
    test.setTimeout(180000)

    const agence = await creerAgence(["agency_admin"])
    agences.push(agence)

    const decor = await garnir(agence)
    const admin = await db.user.findFirstOrThrow({
      where: { agencyId: agence.agence.id, role: "agency_admin" },
    })

    await db.rentalManagement.update({
      where: { id: decor.quittance.id },
      data: { isPaid: true, paymentDate: new Date() },
    })

    await login(page, admin.email)
    await page.goto(`/agency/rental-management/${decor.quittance.id}/edit`)

    await Promise.all([
      page.waitForNavigation({ timeout: 30000 }),
      page.getByRole("button", { name: "Supprimer cette quittance" }).click(),
    ])

    expect(
      await db.rentalManagement.findUnique({
        where: { id: decor.quittance.id },
      }),
      "l'échéance réglée a été détruite : la trace du versement au propriétaire " +
        "n'existe plus nulle part"
    ).not.toBeNull()

    await expect(
      page.getByText("Cette échéance est réglée"),
      "rien ne dit à l'administrateur pourquoi sa suppression a été refusée"
    ).toBeVisible({ timeout: 30000 })

    /**
     * LE CONTROLE POSITIF, par le MEME bouton : une suppression cassee pour
     * tout le monde donnerait exactement le meme vert que la garde qu'on
     * vient de poser.
     */
    await db.rentalManagement.update({
      where: { id: decor.quittance.id },
      data: { isPaid: false, paymentDate: null },
    })

    await page.goto(`/agency/rental-management/${decor.quittance.id}/edit`)
    await Promise.all([
      page.waitForNavigation({ timeout: 30000 }),
      page.getByRole("button", { name: "Supprimer cette quittance" }).click(),
    ])

    expect(
      await db.rentalManagement.findUnique({
        where: { id: decor.quittance.id },
      }),
      "une échéance en attente n'est plus supprimable : la garde est trop large"
    ).toBeNull()
  })
})
