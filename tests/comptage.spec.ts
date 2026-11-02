import { test, expect } from "@playwright/test"
import { readFileSync } from "fs"
import { login } from "./auth-helper"
import { db } from "./db"
import { creerAgence, effacerAgence, type Agence } from "./agence"

/**
 * Compter sans tout charger — story 3.3, BUG-07.
 *
 * CE QUE CE FICHIER PROUVE, ET CE QU'IL NE PROUVE PAS.
 *
 * Il prouve que les deux nombres de la console restent JUSTES, chacun dans
 * sa colonne, apres le passage de `include` a `_count`.
 *
 * Il NE PROUVE PAS que le volume a baisse. Ce cout est SERVEUR — base vers
 * Node — et ne traverse pas le reseau vers le navigateur : les donnees d'un
 * Server Component qui ne sont passees a aucun composant client ne sont pas
 * serialisees dans la charge utile. Un test de navigateur ne peut donc pas
 * le voir, et un test de DUREE serait instable.
 *
 * L'invariant est par consequent garde sur la FORME DE LA REQUETE, comme
 * `tests/deploiement.spec.ts` garde celle du `Dockerfile`. La mesure du
 * volume, elle, est dans la story — faite une fois, ecrite, non rejouee.
 */

const ECRAN = "app/admin/agencies/page.tsx"

test.describe("Le comptage de la console (story 3.3)", () => {
  test("la forme de la requête ne se redéfait pas", () => {
    // LES COMMENTAIRES SONT RETIRES AVANT COMPARAISON. La story 2.8 a paye
    // cette lecon : un `indexOf` avait trouve son motif dans le commentaire
    // qui EXPLIQUAIT la regle, et l'assertion passait sur un fichier faux.
    // Ici le commentaire d'en-tete cite justement `users: true`.
    const source = readFileSync(ECRAN, "utf-8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
      .join("\n")

    /*
      L'INVARIANT S'EST RESSERRE LE 17-08-2026 (story 3.5), il n'a pas
      bouge de sujet. Il exigeait `properties: true` ; il exige maintenant
      la condition de corbeille avec, parce que `_count` echappe au filtre
      de `lib/prisma.ts` et comptait les biens supprimes (BUG-24).

      Les deux defauts se gardent donc ensemble, et c'est voulu : revenir
      a `properties: true` ferait revenir BUG-24 sans faire revenir BUG-07,
      et une assertion qui ne verrait que le second laisserait passer le
      premier.

      La comparaison se fait sur la source aux blancs normalises : la forme
      correcte tient sur trois lignes, et un test qui dependrait de la
      largeur des lignes rougirait au prochain passage de formateur.
    */
    const normalise = source.replace(/\s+/g, " ")

    expect(
      normalise,
      `${ECRAN} ne compte plus avec \`_count\` filtré : la console rechargerait ` +
        `toutes les lignes (BUG-07) ou compterait les biens à la corbeille (BUG-24)`
    ).toContain(
      "_count: { select: { users: true, properties: { where: { deletedAt: null } } } }"
    )

    // La forme fautive, telle qu'elle etait ecrite. Le `include` d'origine
    // portait les deux relations entieres.
    expect(
      normalise,
      `${ECRAN} recharge des relations entieres — c'est BUG-07 qui revient`
    ).not.toMatch(/include:\s*\{\s*users:\s*true/)
  })

  test.describe("sur une agence réelle", () => {
    let agence: Agence | null = null

    // Nettoyage par `afterEach`, jamais par `finally` (CLAUDE.md §6).
    test.afterEach(async () => {
      if (agence) {
        await effacerAgence(agence)
        agence = null
      }
    })

    test("chaque colonne montre son propre nombre", async ({ page }) => {
      test.setTimeout(120000)

      // DEUX NOMBRES DIFFERENTS, ET C'EST DELIBERE : 2 comptes, 3 biens.
      // Avec deux nombres egaux, une colonne branchee sur l'autre resterait
      // verte, et le test ne dirait rien.
      agence = await creerAgence(["agency_admin", "agent"])
      const agencyId = agence.agence.id

      const proprietaire = await db.owner.create({
        data: { firstName: "Propriétaire", lastName: agence.marque, agencyId },
      })

      for (let i = 0; i < 3; i++) {
        await db.property.create({
          data: {
            title: `Bien ${i} ${agence.marque}`,
            // CE TEXTE EST LE TEMOIN de la seconde assertion plus bas : il
            // ne doit apparaitre nulle part dans la page servie.
            description: `DESCRIPTION-TEMOIN-${agence.marque}`,
            category: "residentiel",
            type: "appartement",
            operationType: "vente",
            wilaya: "Alger",
            commune: "Hydra",
            salePrice: 25_000_000,
            agencyId,
            ownerId: proprietaire.id,
          },
        })
      }

      await login(page, "superadmin@aqar.dz")
      await page.goto("/admin/agencies")

      const ligne = page.locator("tr", { hasText: agence.agence.name })

      await expect(
        ligne,
        "la ligne de l'agence n'apparaît pas dans la console"
      ).toBeVisible({ timeout: 30000 })

      // Ordre des colonnes : Agence, Contact, Localisation, Statut, Offre,
      // Abonnement, Utilisateurs, Biens, Actions.
      await expect(
        ligne.locator("td").nth(6),
        "la colonne « Utilisateurs » ne montre pas les 2 comptes de l'agence"
      ).toHaveText("2")

      await expect(
        ligne.locator("td").nth(7),
        "la colonne « Biens » ne montre pas les 3 biens de l'agence — si elle " +
          "montre 2, elle est branchée sur le comptage des comptes"
      ).toHaveText("3")

      // COMPLEMENT, ET IL FAUT DIRE CE QU'IL VAUT : le contenu des fiches
      // n'atteint pas le navigateur. C'etait DEJA vrai avant la correction
      // — un Server Component ne serialise pas ce qu'il ne transmet a aucun
      // composant client. Ce n'est donc pas la preuve de BUG-07 ; c'est la
      // garde qui verra le jour ou ces lignes deviendraient une prop.
      const html = await page.content()
      expect(
        html.includes(`DESCRIPTION-TEMOIN-${agence.marque}`),
        "le contenu des fiches de biens est servi au navigateur pour afficher " +
          "un nombre"
      ).toBe(false)
    })
  })
})
