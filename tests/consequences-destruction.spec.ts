import { test, expect } from "@playwright/test"
import {
  DETACHEES,
  DETRUITES,
  enumerer,
  lister,
} from "../lib/consequences-destruction"

/**
 * Ce que la confirmation ANNONCE (story 3.13, REP-106).
 *
 * L'AC-1 demande une confirmation qui NOMME ce qui tombera, et pas un
 * « etes-vous sur ? » generique. La difference tient entierement dans ces
 * phrases : elles sont donc eprouvees ici, directement, sans navigateur ni
 * base — y compris sur les accords au pluriel, que personne ne verifie
 * jamais a l'ecran et que tout le monde remarque.
 *
 * La chaine complete — comptes lus en base, dialogue rendu, destruction
 * faite ou non — est eprouvee dans `tests/corbeille-confirmation.spec.ts`.
 */
test.describe("Ce que la confirmation annonce (story 3.13)", () => {
  test("les nombres s'accordent, et les zéros ne se disent pas", () => {
    expect(
      lister(DETRUITES.client, {
        visites: 1,
        ventes: 0,
        locations: 2,
        quittances: 1,
        echanges: 0,
      }),
      "un compte nul est énoncé, ou un accord est faux : la confirmation " +
        "annonce « 0 vente » ou « 2 location »"
    ).toEqual(["1 visite", "2 locations", "1 quittance de loyer"])

    // CONTROLE POSITIF DE L'ACCORD : le meme appel, tout au pluriel.
    expect(lister(DETRUITES.client, { visites: 3, quittances: 12 })).toEqual([
      "3 visites",
      "12 quittances de loyer",
    ])

    // Et une fiche seule n'annonce rien du tout — c'est ce vide qui fait
    // dire au dialogue « aucune autre donnée n'en dépend ».
    expect(lister(DETRUITES.property, {})).toEqual([])
  })

  test("l'énumération se lit comme une phrase", () => {
    expect(enumerer([])).toBe("")
    expect(enumerer(["1 visite"])).toBe("1 visite")
    expect(
      enumerer(["1 visite", "2 ventes"]),
      "deux conséquences ne sont plus reliées par « et »"
    ).toBe("1 visite et 2 ventes")
    expect(
      enumerer(["1 visite", "2 ventes", "3 locations"]),
      "l'énumération se termine par une virgule : elle se lit comme une " +
        "liste tronquée, et on cherche le reste"
    ).toBe("1 visite, 2 ventes et 3 locations")
  })

  /**
   * LA TABLE EST LE FOND DE LA STORY, pas un detail de presentation.
   *
   * Une vente rattachee a un CLIENT est detruite avec lui ; la meme vente
   * rattachee a un PROPRIETAIRE survit en perdant son bailleur. Les ranger
   * du meme cote reviendrait a mentir a l'une des deux natures — et les
   * deux mensonges coutent : l'un fait detruire ce qu'on croyait garder,
   * l'autre fait renoncer a une purge legitime.
   *
   * La source de verite est `npm run audit:cascades`, qui lit
   * `prisma/schema.prisma`.
   */
  test("chaque nature range ses conséquences du bon côté", () => {
    expect(
      DETRUITES.client,
      "les ventes et locations d'un client ne sont plus annoncées comme " +
        "détruites : elles le sont pourtant, et leurs quittances avec"
    ).toContain("ventes")
    expect(
      DETRUITES.client,
      "les quittances de loyer ne sont plus annoncées : c'est de l'argent, " +
        "et c'est exactement ce que l'avertissement d'origine taisait (3.5)"
    ).toContain("quittances")

    expect(
      DETACHEES.owner,
      "les ventes d'un propriétaire sont annoncées comme détruites : elles " +
        "survivent en perdant leur bailleur"
    ).toContain("ventes")
    expect(
      DETRUITES.owner,
      "détruire un propriétaire n'emporte que ses échanges — l'annoncer " +
        "plus large ferait renoncer à une purge légitime"
    ).toEqual(["echanges"])

    // Aucune categorie ne peut etre des deux cotes pour une meme nature :
    // ce serait une phrase qui se contredit dans le meme dialogue.
    for (const nature of ["property", "client", "owner"] as const) {
      const communes = DETRUITES[nature].filter((c) =>
        DETACHEES[nature].includes(c)
      )
      expect(
        communes,
        `${nature} annonce ${communes.join(", ")} à la fois détruit et détaché`
      ).toEqual([])
    }
  })
})
