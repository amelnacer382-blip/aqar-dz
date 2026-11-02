import { test, expect, Page } from "@playwright/test"
import { login } from "./auth-helper"
import { db } from "./db"
import { creerAgence, effacerAgence, type Agence } from "./agence"
import { CATALOGUE, ARGUMENTS_REVUS } from "../lib/offres"

/**
 * Le catalogue des offres — story 6.1.
 *
 * CE QUE CE FICHIER PROUVE, ET CE QU'IL NE PROUVE PAS.
 *
 * Il prouve trois choses :
 *  1. l'attribution d'une offre REFUSE une valeur hors catalogue, et
 *     ACCEPTE une valeur du catalogue — sur le meme chemin, dans le meme
 *     cas de test. C'est le controle positif obligatoire de CLAUDE.md §6 :
 *     une action cassee pour tout le monde donnerait exactement le meme
 *     vert qu'une action correctement validee ;
 *  2. la page tarifaire publique LIT le catalogue au lieu d'en porter une
 *     copie ;
 *  3. les ecrans nomment l'offre au lieu d'afficher la cle stockee.
 *
 * Il ne prouve AUCUN plafond. Le catalogue les porte, personne ne les lit
 * encore : c'est la story 6.4. Lire ce fichier ne dit rien de ce qui
 * arrive a une agence Starter au vingt-et-unieme bien.
 */

/**
 * Rejoue le formulaire d'attribution en y forcant une offre.
 *
 * POURQUOI UN REJEU ET PAS UN CLIC. Le selecteur de l'ecran ne propose que
 * les trois offres du catalogue : il ne peut donc pas eprouver le REFUS
 * d'une valeur hors catalogue, qui est la moitie de ce qu'on verifie. Et
 * une Server Action est un point d'entree POST joignable sans l'ecran qui
 * la rend : un clic ne prouverait que le rendu du bouton (CLAUDE.md §6,
 * piege 4).
 *
 * L'identifiant d'action n'est jamais ecrit ici. Il vient du HTML releve a
 * l'execution, parce qu'il est calcule au `build` : fige dans le test, il
 * resterait vert en ne testant plus rien (BUG-28).
 */
async function attribuer(
  page: Page,
  ecran: string,
  formHtml: string,
  offre: string
) {
  await page.goto(ecran)

  // L'ATTERRISSAGE SE VERIFIE. `action=""` se resout contre l'URL
  // COURANTE : si la navigation avait echoue, le POST partirait ailleurs,
  // l'agence ne changerait pas, et le test lirait ce silence comme un
  // refus.
  expect(
    page.url(),
    `le rejeu ne part pas de ${ecran} — le POST viserait une autre adresse`
  ).toContain(ecran)

  await Promise.all([
    // Un refus redirige, un succes aussi. Si rien ne navigue, le rejeu n'a
    // pas abouti — et l'absence de changement ne doit pas passer pour une
    // garde qui tient.
    page.waitForNavigation({ timeout: 30000 }),
    page.evaluate(
      ({ html, valeur }) => {
        const hote = document.createElement("div")
        hote.innerHTML = html

        const form = hote.querySelector("form") as HTMLFormElement

        // LE CHAMP EST REMPLACE, PAS RENSEIGNE. Depuis la story 6.3 le
        // controle d'offre est un `select` : lui poser une valeur absente
        // de ses options ne fait rien, et le formulaire partirait avec un
        // `plan` vide — le test lirait alors le refus d'un champ manquant
        // la ou il croit eprouver le refus d'une valeur hors catalogue.
        //
        // Un `input` cache tient aussi plus pres de ce qu'on simule : un
        // POST forge n'utilise pas le selecteur de l'ecran.
        form.querySelector('[name="plan"]')?.remove()

        const champ = document.createElement("input")
        champ.type = "hidden"
        champ.name = "plan"
        champ.value = valeur
        form.appendChild(champ)

        document.body.appendChild(form)
        form.submit()
      },
      { html: formHtml, valeur: offre }
    ),
  ])
}

test.describe("Le catalogue des offres (story 6.1)", () => {
  let agence: Agence | null = null

  /**
   * Nettoyage par `afterEach`, jamais par `finally` : un depassement de
   * delai n'execute pas un `finally`, et l'agence jetable resterait en
   * base (CLAUDE.md §6).
   */
  test.afterEach(async () => {
    if (agence) {
      await effacerAgence(agence)
      agence = null
    }
  })

  test("une offre hors catalogue est refusée, une offre du catalogue est appliquée", async ({
    page,
  }) => {
    test.setTimeout(120000)

    agence = await creerAgence()
    const id = agence.agence.id

    const offreDe = async () =>
      (await db.agency.findUniqueOrThrow({ where: { id } })).plan

    // Le point de depart n'est pas suppose : il est lu. C'est le defaut
    // Prisma pose par la migration, et le refus plus bas ne veut dire
    // quelque chose que si on sait d'ou l'on part.
    expect(
      await offreDe(),
      "l'agence jetable ne part pas de l'offre par défaut"
    ).toBe("starter")

    await login(page, "superadmin@aqar.dz")
    await page.goto("/admin/settings")

    const formulaire = page.locator(
      `form:has(input[name="agencyId"][value="${id}"]):has(select[name="plan"])`
    )
    await expect(
      formulaire,
      "aucun formulaire d'attribution d'offre pour l'agence jetable"
    ).toBeAttached({ timeout: 15000 })

    const html = await formulaire.evaluate(
      (el) => (el as HTMLFormElement).outerHTML
    )

    // --- LE REFUS -----------------------------------------------------
    // `premium` est l'ancienne valeur, morte depuis la migration. C'est
    // exactement ce qu'un formulaire forge, ou un signet d'avant la
    // livraison, enverrait.
    await attribuer(page, "/admin/settings", html, "premium")

    expect(
      await offreDe(),
      "une valeur hors catalogue (« premium ») a été écrite dans l'offre de l'agence"
    ).toBe("starter")

    // Et le refus se VOIT. Un refus muet est un refus qu'on croit etre un
    // succes.
    await expect
      .soft(
        page.getByText("Offre inconnue"),
        "le refus n'annonce pas son motif à l'écran"
      )
      .toBeVisible()

    // --- LE CONTROLE POSITIF, SUR LE MEME CHEMIN ----------------------
    // Sans lui, une action cassee pour tout le monde donnerait le meme
    // vert. `enterprise` est choisi a dessein : c'est l'offre qu'aucun
    // ecran ne savait attribuer avant la story 6.3, alors qu'elle se vend
    // publiquement. Le tarif n'est pas recopie : il vit dans le catalogue.
    await attribuer(page, "/admin/settings", html, "enterprise")

    expect(
      await offreDe(),
      "une offre du catalogue n'a pas été appliquée — l'action est cassée pour tout le monde, et le refus ci-dessus ne prouvait rien"
    ).toBe("enterprise")

    // AC-5 : l'ecran nomme l'offre, il ne montre pas la cle stockee.
    const ligne = page.locator("tr", { hasText: agence.agence.name })
    await expect(
      ligne,
      "la console n'affiche pas le nom de l'offre attribuée"
    ).toContainText("Enterprise")
  })

  test("la page tarifaire affiche le catalogue, et pas une copie", async ({
    page,
  }) => {
    await page.goto("/")

    const section = page.locator("#pricing")
    await expect(section).toBeVisible()

    /**
     * PREUVE PAR MUTATION. Changer un tarif dans `lib/offres.ts` doit
     * laisser ce test vert — la page suit. Le rendre rouge demande de
     * reecrire un tarif EN DUR dans `PricingSection.tsx`, ce qui est
     * precisement le defaut que la story ferme.
     */
    for (const offre of CATALOGUE) {
      await expect(
        section.getByText(offre.nom, { exact: true }).first(),
        `l'offre « ${offre.nom} » n'est pas affichée sur la page tarifaire`
      ).toBeVisible()

      await expect(
        section.getByText(offre.prix, { exact: true }).first(),
        `le tarif de « ${offre.nom} » affiché ne vient pas du catalogue (attendu ${offre.prix})`
      ).toBeVisible()

      for (const atout of offre.atouts) {
        await expect(
          section.getByText(atout, { exact: true }).first(),
          `l'argument « ${atout} » de « ${offre.nom} » ne vient pas du catalogue`
        ).toBeVisible()
      }
    }
  })

  test("aucun argument de vente n'entre au catalogue sans passer par la revue (story 6.6)", async () => {
    /**
     * AC-4 de la story 6.6.
     *
     * CE QUE CE CAS PROUVE, ET CE QU'IL NE PROUVE PAS. Il ne prouve pas
     * qu'une capacite existe — aucun test ne sait faire ca, et pretendre le
     * contraire serait exactement l'affirmation non tenue que CLAUDE.md §7
     * traite comme un defaut. Il prouve qu'aucun argument n'est entre au
     * catalogue SANS DECISION : « API access » et « Integrations custom » y
     * ont vecu sans designer une ligne de code, sur une offre a 19 900 DA.
     *
     * LES DEUX SENS COMPTENT. Un argument non inventorie est une promesse
     * non revue ; une entree d'inventaire que plus personne n'affiche est
     * un vestige, et un vestige finit par etre relu comme une garantie.
     */
    const affiches = CATALOGUE.flatMap((offre) => offre.atouts)

    const nonRevus = affiches.filter(
      (a) => !Object.prototype.hasOwnProperty.call(ARGUMENTS_REVUS, a)
    )

    expect(
      nonRevus,
      `argument(s) affiché(s) sur la page tarifaire sans figurer dans ARGUMENTS_REVUS — la capacité correspondante a-t-elle été vérifiée ? : ${nonRevus.join(" · ")}`
    ).toEqual([])

    const orphelins = Object.keys(ARGUMENTS_REVUS).filter(
      (a) => !affiches.includes(a)
    )

    expect(
      orphelins,
      `entrée(s) d'inventaire que plus aucune offre n'affiche — vestige à retirer : ${orphelins.join(" · ")}`
    ).toEqual([])

    // Le controle positif de l'inventaire lui-meme : un tableau vide des
    // deux cotes passerait ces deux assertions sans rien garder.
    expect(
      affiches.length,
      "le catalogue n'affiche plus aucun argument — les deux assertions ci-dessus seraient vertes pour rien"
    ).toBeGreaterThan(0)
  })

  test("l'agence de démonstration, qui portait « premium », porte l'offre Pro", async () => {
    /**
     * FR-14, la reprise de l'existant.
     *
     * ⚠ CE QUE CETTE ASSERTION VAUT EXACTEMENT. `prisma/seed.ts` ecrit
     * lui aussi `pro` depuis la story 6.1 : rejouer la graine suffirait a
     * la satisfaire. Elle prouve donc que la MIGRATION ET LA GRAINE DISENT
     * LA MEME CHOSE — ce qui est deja ce qui divergerait en premier — mais
     * pas que la conversion a eu lieu. La conversion, elle, a ete mesuree
     * une fois, avant et apres, et le releve est dans la story.
     */
    const demo = await db.agency.findFirstOrThrow({
      where: { email: "demo@aqar.dz" },
      select: { plan: true },
    })

    expect(
      demo.plan,
      "l'agence de démonstration n'a pas reçu l'offre équivalente à « premium »"
    ).toBe("pro")
  })
})
