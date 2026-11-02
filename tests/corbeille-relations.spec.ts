import { test, expect, Page } from "@playwright/test"
import { db } from "./db"
import { creerAgence, effacerAgence, Agence } from "./agence"
import { login } from "./auth-helper"

/**
 * Un bien mis a la corbeille ne doit plus etre compte (BUG-24, story 3.5).
 *
 * L'extension de `lib/prisma.ts` injecte `deletedAt: null` sur le `where` de
 * PREMIER NIVEAU. Une relation imbriquee — `_count`, `include` — n'est pas
 * une operation distincte : elle n'est jamais filtree. Cinq ecrans
 * comptaient donc les biens en corbeille.
 *
 * CE QUE CE FICHIER EPROUVE, ET COMMENT
 *
 * Chaque cas compte AVANT la mise a la corbeille, puis APRES. Le premier
 * nombre est le controle positif exige par §6 : sans lui, un compteur casse
 * qui afficherait toujours zero passerait au vert. Le second est la
 * correction. Les deux sont lus SUR LE MEME ECRAN, par la meme requete.
 *
 * CE QU'IL EPROUVE AUSSI, ET QUI EST L'INVERSE
 *
 * Le dernier cas verifie qu'une location dont le client est a la corbeille
 * AFFICHE TOUJOURS son nom. C'est volontaire, c'est l'arbitrage de la story
 * 3.9 (BUG-34) : on filtre les relations au PLURIEL — un inventaire ne
 * compte pas ce qui n'existe plus — et jamais celles au SINGULIER — une
 * provenance doit rester lisible. Sans ce cas, la correction d'aujourd'hui
 * pourrait etre etendue demain aux vingt-et-un `include` au singulier, et
 * rendre anonymes les quittances d'un locataire supprime.
 */

type Decor = Awaited<ReturnType<typeof batir>>

/** L'agence du cas en cours, effacee par `afterEach`. */
let courante: Agence | null = null

/**
 * Un propriétaire, quatre biens, un client, une location.
 *
 * Quatre et pas deux : le nombre affiché doit changer de façon lisible
 * (4 → 3), et un compteur qui se tromperait d'une unité dans l'autre sens
 * resterait visible.
 */
async function batir() {
  const agence = await creerAgence(["agency_admin"])
  courante = agence

  const agencyId = agence.agence.id
  const marque = agence.marque

  /*
    L'HORODATAGE EST AVANCE D'UN JOUR, ET CE N'EST PAS UN DETAIL.
    `/admin/statistics` n'affiche que les DIX dernieres agences
    (`orderBy: createdAt desc, take: 10`). La suite tourne sur quatre
    travailleurs en parallele, chacun creant ses propres agences jetables :
    sans cette avance, notre ligne pourrait sortir du tableau entre sa
    creation et la lecture de la page, et le cas echouerait pour une raison
    qui n'a rien a voir avec le defaut. L'agence est detruite en fin de cas.
  */
  await db.agency.update({
    where: { id: agencyId },
    data: { createdAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  })

  const proprietaire = await db.owner.create({
    data: { firstName: "Proprietaire", lastName: marque, agencyId },
  })

  const biens = []

  for (let numero = 1; numero <= 4; numero++) {
    biens.push(
      await db.property.create({
        data: {
          title: `Bien ${numero} ${marque}`,
          category: "residentiel",
          type: "appartement",
          operationType: "vente",
          wilaya: "Oran",
          commune: "Bir El Djir",
          salePrice: 12_000_000,
          agencyId,
          ownerId: proprietaire.id,
        },
      })
    )
  }

  const client = await db.client.create({
    data: { firstName: "Client", lastName: marque, agencyId },
  })

  const bail = await db.rental.create({
    data: {
      propertyId: biens[0].id,
      clientId: client.id,
      ownerId: proprietaire.id,
      startDate: new Date(),
      monthlyRent: 60_000,
      agencyId,
    },
  })

  return { agence, marque, proprietaire, biens, client, bail }
}

/** Met le quatrieme bien a la corbeille — un `update`, jamais un `delete`. */
async function corbeille(decor: Decor) {
  await db.property.update({
    where: { id: decor.biens[3].id },
    data: { deletedAt: new Date() },
  })
}

/**
 * Nettoyage par `afterEach`, jamais par `finally`.
 *
 * Un depassement de delai n'execute pas un `finally` (CLAUDE.md §6). Une
 * agence jetable oubliee en base fausse ensuite les compteurs de
 * `/admin/statistics`, c'est-a-dire l'ecran meme que ce fichier eprouve.
 */
test.afterEach(async () => {
  if (courante) {
    await effacerAgence(courante)
    courante = null
  }
})

/** Le nombre de biens lu dans la ligne du proprietaire, sur la liste. */
async function biensDeLaListe(page: Page, decor: Decor): Promise<string> {
  await page.goto("/agency/owners")

  const ligne = page.locator("tr", { hasText: decor.marque })
  await expect(ligne).toHaveCount(1)

  return (await ligne.locator("td").nth(3).innerText()).trim()
}

test.describe("un bien à la corbeille ne compte plus", () => {
  test("la liste des propriétaires passe de 4 à 3", async ({ page }) => {
    const decor = await batir()
    await login(page, decor.agence.admin!.email)

    expect(
      await biensDeLaListe(page, decor),
      "contrôle positif : les 4 biens vivants doivent être comptés AVANT toute mise à la corbeille"
    ).toBe("4 biens")

    await corbeille(decor)

    expect(
      await biensDeLaListe(page, decor),
      "le bien mis à la corbeille est encore compté dans `_count.properties`"
    ).toBe("3 biens")
  })

  test("la fiche du propriétaire n'affiche plus le bien supprimé, ni son lien", async ({
    page,
  }) => {
    const decor = await batir()
    await login(page, decor.agence.admin!.email)

    const fiche = `/agency/owners/${decor.proprietaire.id}`
    const supprime = decor.biens[3]
    const lien = `a[href="/agency/properties/${supprime.id}/edit"]`

    await page.goto(fiche)

    // Controle positif : le bien EST la avant, et son lien aussi.
    await expect(page.getByText(supprime.title)).toBeVisible()
    await expect(page.locator(lien)).toHaveCount(1)

    await corbeille(decor)
    await page.goto(fiche)

    await expect(
      page.getByText(supprime.title),
      "le bien à la corbeille figure toujours dans « Biens associés »"
    ).toHaveCount(0)

    await expect(
      page.locator(lien),
      "la fiche propose encore un lien vers le bien supprimé — il mène à un notFound()"
    ).toHaveCount(0)

    // Les trois autres restent, sinon le filtre aurait tout emporte.
    for (const vivant of decor.biens.slice(0, 3)) {
      await expect(page.getByText(vivant.title)).toBeVisible()
    }

    // Le resume, qui lit la meme liste.
    await expect(
      page.getByText("Biens").locator("xpath=following-sibling::span[1]")
    ).toHaveText("3")
  })

  test("l'export CSV des propriétaires annonce le même nombre que la liste", async ({
    page,
  }) => {
    const decor = await batir()
    await login(page, decor.agence.admin!.email)

    /** La colonne « Biens » de la ligne du propriétaire, dans le CSV. */
    const colonneBiens = async () => {
      const reponse = await page.request.get("/api/export/owners")
      expect(reponse.status()).toBe(200)

      const ligne = (await reponse.text())
        .split("\r\n")
        .find((l) => l.includes(decor.marque))

      expect(
        ligne,
        "le marqueur n'apparaît pas dans l'export : l'assertion suivante ne prouverait rien"
      ).toBeTruthy()

      // Nom;Prénom;Téléphone;Email;Adresse;Biens;Créé le
      return ligne!.split(";")[5]
    }

    expect(await colonneBiens(), "contrôle positif : 4 biens vivants").toBe("4")

    await corbeille(decor)

    expect(
      await colonneBiens(),
      "l'export compte le bien à la corbeille"
    ).toBe("3")
  })

  test("la console super admin et les statistiques comptent comme l'agence", async ({
    page,
  }) => {
    const decor = await batir()
    await login(page, "superadmin@aqar.dz")

    /** [console super admin, page statistiques] pour notre agence. */
    const lesDeux = async () => {
      await page.goto("/admin/agencies")
      const ligneConsole = page.locator("tr", { hasText: decor.marque })
      await expect(ligneConsole).toHaveCount(1)
      // Agence · Contact · Localisation · Statut · Offre · Abonnement ·
      // Utilisateurs · Biens · Actions
      const console_ = (await ligneConsole.locator("td").nth(7).innerText()).trim()

      await page.goto("/admin/statistics")
      const ligneStats = page.locator("tr", { hasText: decor.marque })
      await expect(
        ligneStats,
        "l'agence n'est pas dans les 10 dernières du tableau — l'horodatage avancé de `batir()` ne joue plus son rôle"
      ).toHaveCount(1)
      // Agence · Statut · Biens · Clients · Utilisateurs
      const stats = (await ligneStats.locator("td").nth(2).innerText()).trim()

      return [console_, stats]
    }

    expect(await lesDeux(), "contrôle positif : 4 biens vivants").toEqual([
      "4",
      "4",
    ])

    await corbeille(decor)

    expect(
      await lesDeux(),
      "les deux écrans que lit l'éditeur comptent les biens en corbeille"
    ).toEqual(["3", "3"])
  })

  test("une location dont le client est à la corbeille garde son nom", async ({
    page,
  }) => {
    const decor = await batir()
    await login(page, decor.agence.admin!.email)

    await page.goto("/agency/rentals")
    await expect(page.getByText(`Client ${decor.marque}`)).toBeVisible()

    await db.client.update({
      where: { id: decor.client.id },
      data: { deletedAt: new Date() },
    })

    await page.goto("/agency/rentals")
    await expect(
      page.getByText(`Client ${decor.marque}`),
      "la location a perdu le nom de son locataire : la relation au singulier a été filtrée, " +
        "ce que la story 3.9 interdit — une quittance anonyme fait perdre la trace d'un loyer dû"
    ).toBeVisible()
  })
})
