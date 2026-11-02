import { test, expect } from "@playwright/test"
import {
  LIMITE_MOTEURS,
  TAILLE_PLAN,
  lirePartie,
  nomDePartie,
  nombreDeParties,
  partiesDuPlan,
  echapperXml,
  indexXml,
  urlsetXml,
} from "../lib/plan-du-site"

/**
 * Le decoupage du plan du site (story 3.12, REP-105).
 *
 * POURQUOI CES CAS N'OUVRENT AUCUN NAVIGATEUR ET NE TOUCHENT AUCUNE BASE.
 * Le defaut que la story ferme se declenche a 50 000 URL. Monter un decor
 * de 50 000 biens pour le voir couterait des minutes a chaque execution et
 * n'apprendrait rien de plus : l'arithmetique du decoupage est une fonction
 * pure, elle s'eprouve directement, y compris sur la borne exacte que
 * personne ne peut atteindre en decor.
 *
 * La plomberie — index, parties servies, 404 — est eprouvee de bout en bout
 * dans `tests/features.spec.ts`. Les deux ensemble couvrent ce que ni l'un
 * ni l'autre ne peut couvrir seul, et c'est ecrit ici pour que personne ne
 * prenne l'un pour l'autre.
 *
 * ⚠ LE CONSTAT D'ORIGINE N'AVAIT JAMAIS ETE MESURE. Il l'a ete le
 * 17-08-2026, avant d'ecrire une ligne : 43 vitrines publiees et 4 biens
 * publies, soit 48 URL — 49 952 de marge. Le defaut est PROSPECTIF, et la
 * story le dit.
 */
test.describe("Le découpage du plan du site (story 3.12)", () => {
  test("aucune partie ne peut dépasser la limite des moteurs", () => {
    expect(
      TAILLE_PLAN,
      "une partie peut atteindre la limite du protocole : au-delà, les " +
        "moteurs ignorent le fichier, et la vitrine redevient invisible"
    ).toBeLessThan(LIMITE_MOTEURS)

    // La partie `agences-0` porte l'accueil EN PLUS de sa tranche : c'est
    // elle qui serre la marge, et c'est donc elle qu'il faut compter.
    expect(
      TAILLE_PLAN + 1,
      "la première partie porte l'accueil en plus de sa tranche"
    ).toBeLessThan(LIMITE_MOTEURS)
  })

  test("le nombre de parties suit le total, sur les bornes exactes", () => {
    // Un plan sans aucune vitrine reste un plan : il porte l'accueil.
    expect(nombreDeParties(0), "un plan vide n'a plus de partie").toBe(1)
    expect(nombreDeParties(1)).toBe(1)
    expect(nombreDeParties(TAILLE_PLAN)).toBe(1)

    // LA BORNE. Une entree de plus, une partie de plus.
    expect(
      nombreDeParties(TAILLE_PLAN + 1),
      "la tranche déborde sans qu'une partie soit ouverte : les entrées " +
        "au-delà de la limite sont perdues"
    ).toBe(2)

    expect(nombreDeParties(TAILLE_PLAN * 2)).toBe(2)
    expect(nombreDeParties(TAILLE_PLAN * 2 + 1)).toBe(3)
  })

  /**
   * LE SCENARIO NOMME PAR L'AC-2 DE LA STORY 3.4, celui qui a ouvert
   * REP-105 : 50 agences de 2 000 biens. Il produit 100 051 URL — le double
   * de ce qu'un fichier unique accepte.
   */
  test("le scénario qui a ouvert le constat tient, découpé", () => {
    const agences = 50
    const biens = 50 * 2_000

    const parties = partiesDuPlan(agences, biens)

    expect(
      1 + agences + biens,
      "le scénario ne dépasse plus la limite : ce n'est plus le scénario"
    ).toBeGreaterThan(LIMITE_MOTEURS)

    // 1 partie d'agences (50 tiennent largement) + 3 parties de biens.
    //
    // LE MESSAGE EST ECRIT, et il l'est parce que la mutation M2 a rougi
    // ici sur un `toEqual` anonyme : « expect(received).toEqual(expected) »
    // ne dit pas ce qui a ete perdu. Un rouge qui ne nomme pas la propriete
    // visee coute une demi-heure a celui qui le lira dans six mois.
    expect(
      parties.map(nomDePartie),
      "le plan ne se découpe pas : les 100 051 URL du scénario partent dans " +
        "un seul fichier, que les moteurs ignoreront"
    ).toEqual(["agences-0.xml", "biens-0.xml", "biens-1.xml", "biens-2.xml"])

    // Et aucune de ces parties ne depasse la limite — c'est la propriete
    // que la story existe pour tenir.
    const derniere = biens - TAILLE_PLAN * 2
    expect(derniere).toBeLessThan(LIMITE_MOTEURS)
    expect(TAILLE_PLAN + 1).toBeLessThan(LIMITE_MOTEURS)
  })

  test("un plan de taille ordinaire ne change rien pour un robot", () => {
    // L'etat mesure de la base le 17-08-2026 : 43 vitrines, 4 biens.
    expect(partiesDuPlan(43, 4).map(nomDePartie)).toEqual([
      "agences-0.xml",
      "biens-0.xml",
    ])

    // Et sans aucun bien publie, on n'annonce pas une partie vide.
    expect(
      partiesDuPlan(43, 0).map(nomDePartie),
      "l'index annonce une partie de biens qui ne contient rien"
    ).toEqual(["agences-0.xml"])

    // Base vide : l'index reste valide et renvoie vers l'accueil.
    expect(
      partiesDuPlan(0, 0).map(nomDePartie),
      "un index vide : verify:deploy n'a plus de <loc> à comparer, et les " +
        "moteurs n'ont plus rien à lire"
    ).toEqual(["agences-0.xml"])
  })

  test("le nom d'une partie se relit, et rien d'autre ne passe", () => {
    // L'aller-retour, sur les deux genres.
    for (const partie of partiesDuPlan(TAILLE_PLAN + 1, TAILLE_PLAN + 1)) {
      expect(
        lirePartie(nomDePartie(partie)),
        `${nomDePartie(partie)} n'est pas relu comme il a été écrit`
      ).toEqual(partie)
    }

    /**
     * LES REFUS. `constructor`, `toString` et `__proto__` sont ici parce
     * qu'ils franchissaient une garde en `valeur in TABLE` (story 3.2,
     * BUG-38) : l'expression reguliere nomme ses deux genres en toutes
     * lettres, elle n'interroge aucun objet.
     *
     * `agences-007.xml` est refuse pour une autre raison : deux adresses
     * qui servent le meme contenu sont du contenu duplique annonce a un
     * moteur — ce que la story 3.4 a corrige sur la pagination.
     */
    for (const brut of [
      "constructor",
      "toString",
      "__proto__",
      "__proto__.xml",
      "agences.xml",
      "agences-.xml",
      "agences-007.xml",
      "agences--1.xml",
      "agences-1.txt",
      "agences-1",
      "biens-99999999.xml",
      "",
    ]) {
      expect(lirePartie(brut), `« ${brut} » a été accepté comme partie`).toBeNull()
    }
  })

  test("les caractères XML sont échappés, index comme partie", () => {
    expect(
      echapperXml(`a&b<c>d"e'f`),
      "un caractère XML passe sans être échappé : le plan devient un XML " +
        "invalide, donc ignoré EN ENTIER par les moteurs"
    ).toBe("a&amp;b&lt;c&gt;d&quot;e&apos;f")

    // CONTROLE POSITIF : une URL ordinaire traverse sans etre abimee.
    expect(
      urlsetXml([{ url: "https://exemple.dz/vitrine/agence-demo" }]),
      "une URL ordinaire est déformée par l'échappement"
    ).toContain("<loc>https://exemple.dz/vitrine/agence-demo</loc>")

    expect(urlsetXml([{ url: "https://exemple.dz/?a=1&b=2" }])).toContain(
      "<loc>https://exemple.dz/?a=1&amp;b=2</loc>"
    )
    expect(indexXml(["https://exemple.dz/sitemap/x.xml?a=1&b=2"])).toContain(
      "&amp;b=2"
    )

    // Et les deux racines sont les bonnes : un index n'est pas un urlset.
    expect(
      indexXml([]),
      "l'index n'a pas la racine d'un index : un moteur le lira comme un plan " +
        "ordinaire et n'ira jamais chercher les parties"
    ).toContain("<sitemapindex")
    expect(
      urlsetXml([]),
      "une partie n'a pas la racine d'un plan"
    ).toContain("<urlset")
  })
})
