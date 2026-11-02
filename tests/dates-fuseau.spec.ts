import { test, expect } from "@playwright/test"
import { db } from "./db"
import { creerAgence, effacerAgence, garnir, type Agence } from "./agence"
import { login } from "./auth-helper"

/**
 * Une date ne recule pas d'un jour parce qu'on a ouvert sa fiche (BUG-40).
 *
 * LE DEFAUT. `toDateInputValue()` (`lib/format.ts`) construisait la valeur
 * d'un `<input type="date">` par `toISOString().slice(0, 10)` — c'est-a-dire
 * en **UTC**. Or les dates du produit sont ecrites a MINUIT LOCAL : mesure
 * du 18-08-2026 sur la base de developpement, en UTC+1 —
 *
 *     Visit.date              5 lignes sur 5   a T23:00:00.000Z
 *     Payment.date            6 lignes sur 6   a T23:00:00.000Z
 *     RentalManagement…       3 lignes sur 4   a T23:00:00.000Z
 *
 * `2026-08-02T23:00:00Z` EST le 3 aout en heure locale. Le formulaire
 * affichait donc le 2, et l'enregistrement le reecrivait tel quel : la
 * visite reculait d'un jour, sans que personne ne touche au champ.
 *
 * C'EST LA FAMILLE DE BUG-34, sur une colonne de date au lieu d'un lien :
 * ouvrir une fiche et cliquer « Enregistrer » modifie la donnee. La
 * story 3.9 avait ferme les liens ; celui-ci passait a cote parce qu'aucun
 * inventaire de liens ne regarde une date.
 *
 * ⚠ CE CAS NE SE DECLENCHE QUE SI LE FUSEAU DE LA MACHINE DECALE LA DATE.
 * En UTC pur, la conversion est l'identite et le defaut est invisible — ce
 * qui explique qu'il ait survecu. Le decor pose donc explicitement une date
 * a minuit local, quel que soit le fuseau : c'est la condition du defaut,
 * pas une coincidence qu'on espere.
 */
test.describe("Les dates ne reculent pas d'un jour (BUG-40)", () => {
  const agences: Agence[] = []

  // Nettoyage par `afterEach`, jamais par `finally` (CLAUDE.md §6).
  test.afterEach(async () => {
    while (agences.length) {
      await effacerAgence(agences.pop() as Agence)
    }
  })

  test("ouvrir une visite et enregistrer ne change pas sa date", async ({
    page,
  }) => {
    test.setTimeout(240000)

    const agence = await creerAgence(["agency_admin"])
    agences.push(agence)

    const decor = await garnir(agence)
    const admin = await db.user.findFirstOrThrow({
      where: { agencyId: agence.agence.id, role: "agency_admin" },
    })

    /*
      MINUIT LOCAL, pose explicitement. `new Date(a, m, j)` construit
      l'instant dans le fuseau de la machine : en UTC+1 il vaut
      `…T23:00:00Z` la veille, ce qui est exactement la forme mesuree en
      base. En UTC pur il vaut `…T00:00:00Z` et le cas passe sans rien
      prouver — c'est dit dans l'en-tete plutot que masque.
    */
    const jour = new Date(2026, 6, 15) // 15 juillet 2026, minuit local
    await db.visit.update({
      where: { id: decor.visite.id },
      data: { date: jour },
    })

    await login(page, admin.email)
    await page.goto(`/agency/visits/${decor.visite.id}/edit`)

    const affichee = await page.locator('input[name="date"]').inputValue()

    expect(
      affichee,
      "le formulaire affiche une autre date que celle enregistrée : la " +
        "conversion passe par UTC alors que la date est écrite à minuit local"
    ).toBe("2026-07-15")

    await Promise.all([
      page.waitForNavigation({ timeout: 30000 }),
      page.getByRole("button", { name: "Enregistrer" }).click(),
    ])

    // CONTROLE POSITIF : l'enregistrement a bien eu lieu. Un refus
    // laisserait la date intacte exactement comme un succes.
    expect(
      page.url(),
      "l'enregistrement a été refusé — la date est intacte parce que RIEN " +
        "n'a été écrit, ce qui ne prouve pas la propriété visée"
    ).not.toContain("error=")

    const apres = await db.visit.findUniqueOrThrow({
      where: { id: decor.visite.id },
    })

    /*
      On compare le JOUR CIVIL LOCAL, pas l'instant : le produit ecrit
      minuit UTC quand on lui soumet « 2026-07-15 », et le decor avait pose
      minuit local. Ce qui doit tenir est la date que lit l'agent, pas la
      representation interne.
    */
    const jourLocal = (d: Date) =>
      [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
      ].join("-")

    expect(
      jourLocal(apres.date),
      "la visite a changé de jour par un simple enregistrement : c'est " +
        "BUG-34, sur une date au lieu d'un lien"
    ).toBe("2026-07-15")

    /**
     * ET ELLE EST ECRITE A MINUIT LOCAL — l'autre bout de la convention.
     *
     * Cette assertion existe parce que sans elle, la mutation du cote
     * ECRITURE reste VERTE : en UTC+1, ecrire minuit UTC puis relire en
     * parties locales redonne le bon jour, et l'aller-retour semble sain.
     * Il ne l'est que d'une heure pres, et il derive d'un jour entier dans
     * tout fuseau NEGATIF — ou personne ici n'ira le constater.
     *
     * Le jour civil se lit donc a l'heure : minuit local, ou rien.
     */
    expect(
      [apres.date.getHours(), apres.date.getMinutes()],
      `la date est enregistrée à ${apres.date.getHours()} h locale et non à ` +
        `minuit : « 2026-07-15 » a été relu comme un instant UTC, ce qui ` +
        `recule le jour d'un cran dans tout fuseau négatif`
    ).toEqual([0, 0])
  })
})
