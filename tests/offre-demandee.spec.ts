import { test, expect } from "@playwright/test"
import { identiteAppelant } from "./auth-helper"
import { db } from "./db"
import { CATALOGUE, lienInscription, PARAM_OFFRE } from "../lib/offres"

/**
 * L'offre demandee a l'inscription — story 6.2.
 *
 * CE QUE CE FICHIER PROUVE.
 *  1. les trois boutons de la page tarifaire menent a trois destinations
 *     DISTINCTES, et chacune preselectionne SON offre (FR-3) ;
 *  2. arriver sans parametre ne preselectionne rien et n'est pas une
 *     erreur ; s'inscrire sans choisir est refuse, cote serveur, avec un
 *     message qui le dit (FR-4) ;
 *  3. l'offre demandee est stockee A COTE de l'offre attribuee, jamais a
 *     sa place — ni par le formulaire, ni par un corps de requete forge
 *     (FR-5).
 *
 * CE QU'IL NE PROUVE PAS. « Aucun controle de quota ne lit l'offre
 * demandee » (FR-5) n'est pas assertable aujourd'hui : aucun controle de
 * quota n'existe. C'est la story 6.4 qui les pose, et c'est la qu'une
 * assertion pourra le constater. L'ecrire ici serait une case cochee sur
 * du vide.
 */

const BASE = `http://localhost:${process.env.PLAYWRIGHT_PORT ?? "3002"}`

/**
 * Les agences creees par le formulaire public — donc hors de
 * `creerAgence()`, qui les pose en base directement.
 *
 * Nettoyage par `afterEach`, jamais par `finally` : un depassement de
 * delai n'execute pas un `finally`, et ces agences porteraient des
 * comptes `agency_admin` a mot de passe connu (CLAUDE.md §6).
 */
const aEffacer: string[] = []

test.afterEach(async () => {
  for (const email of aEffacer) {
    const agence = await db.agency.findFirst({
      where: { email },
      select: { id: true },
    })

    if (agence) {
      // `User` est en `onDelete: SetNull` : sans cette ligne, chaque
      // execution laisserait un compte sans agence dans /admin/users.
      await db.user.deleteMany({ where: { agencyId: agence.id } })
      await db.agency.delete({ where: { id: agence.id } })
    }
  }

  aEffacer.length = 0
})

/** Un corps d'inscription valide, a l'offre demandee pres. */
function inscription(marque: string) {
  return {
    agencyName: `Agence ${marque}`,
    email: `${marque}@exemple.invalid`,
    wilaya: "Alger",
    password: "password123",
  }
}

test.describe("L'offre demandée à l'inscription (story 6.2)", () => {
  test("chaque bouton de la page tarifaire porte son offre jusqu'au formulaire", async ({
    page,
  }) => {
    test.setTimeout(120000)

    await page.setExtraHTTPHeaders(identiteAppelant())
    await page.goto("/")

    const section = page.locator("#pricing")

    // LES TROIS DESTINATIONS SONT DISTINCTES. C'est la moitie de FR-3, et
    // c'est ce qui etait faux : les trois boutons pointaient vers
    // `/auth/register` nu. Un test qui ne verifierait que « le bouton Pro
    // mene a l'inscription » serait reste vert tout du long.
    const adresses: string[] = []

    for (const offre of CATALOGUE) {
      const bouton = section.getByRole("link", { name: offre.appel })

      await expect(
        bouton,
        `aucun bouton « ${offre.appel} » dans la section tarifaire`
      ).toBeAttached({ timeout: 15000 })

      adresses.push((await bouton.getAttribute("href")) ?? "")
    }

    expect(
      new Set(adresses).size,
      `les boutons de la page tarifaire mènent à ${new Set(adresses).size} destination(s) et non 3 — ${adresses.join(", ")}`
    ).toBe(3)

    // Le parcours reel, une fois : Karim clique « Choisir Pro » (UJ-1).
    // Les deux autres colonnes sont ensuite verifiees par leur adresse,
    // pour ne pas payer trois fois la revelation au defilement de la
    // section — c'est le MEME lien qui est suivi dans les deux cas.
    const pro = CATALOGUE.find((o) => o.cle === "pro")!
    await section.getByRole("link", { name: pro.appel }).click()
    await page.waitForURL(new RegExp(`${PARAM_OFFRE}=pro`), { timeout: 30000 })

    for (const offre of CATALOGUE) {
      await page.goto(lienInscription(offre.cle))

      const choisie = page.locator(
        `input[name="${PARAM_OFFRE}"][value="${offre.cle}"]`
      )

      await expect(
        choisie,
        `le formulaire n'a pas présélectionné « ${offre.nom} » alors que le visiteur venait de la choisir`
      ).toBeChecked({ timeout: 15000 })

      // Et une seule : deux offres cochees vaudrait un choix indecidable.
      expect(
        await page.locator(`input[name="${PARAM_OFFRE}"]:checked`).count(),
        "plusieurs offres sont présélectionnées à la fois"
      ).toBe(1)
    }
  })

  test("une offre inconnue dans l'URL ne présélectionne rien, et n'est pas une erreur", async ({
    page,
  }) => {
    await page.setExtraHTTPHeaders(identiteAppelant())

    // `premium` est l'ancienne valeur, morte depuis la story 6.1 : c'est
    // exactement ce que porte un signet d'avant la livraison.
    for (const suffixe of [`?${PARAM_OFFRE}=premium`, `?${PARAM_OFFRE}=`, ""]) {
      await page.goto(`/auth/register${suffixe}`)

      // Le formulaire s'affiche : pas de page d'erreur, pas de redirection.
      await expect(
        page.getByRole("heading", { name: "Inscrire mon agence" }),
        `« /auth/register${suffixe} » n'affiche pas le formulaire d'inscription`
      ).toBeVisible({ timeout: 15000 })

      expect(
        await page.locator(`input[name="${PARAM_OFFRE}"]:checked`).count(),
        `« /auth/register${suffixe} » a présélectionné une offre alors qu'aucune n'était demandable`
      ).toBe(0)
    }
  })

  test("le serveur refuse une inscription sans offre, et en accepte une du catalogue", async ({
    request,
  }) => {
    /**
     * LE SERVEUR, PAS LE FORMULAIRE. Le bouton d'envoi verifie lui aussi
     * que l'offre est choisie, mais cette route est un point d'entree
     * POST public et non authentifie, joignable sans l'ecran qui la rend
     * (CLAUDE.md §6, piege 4). Un test qui cliquerait ne prouverait que
     * le rendu du bouton.
     */
    const marque = `sans-offre-${Date.now()}`
    const corps = inscription(marque)
    aEffacer.push(corps.email)

    const existe = async () =>
      (await db.agency.count({ where: { email: corps.email } })) > 0

    // --- LE REFUS : aucune offre --------------------------------------
    const nue = await request.post(`${BASE}/api/auth/register`, {
      headers: identiteAppelant(),
      failOnStatusCode: false,
      data: corps,
    })

    expect(
      nue.status(),
      "une inscription sans offre demandée a été acceptée"
    ).toBe(400)
    expect((await nue.json()).error).toContain("Choisissez une offre")

    // Le refus ne se lit pas au seul code de retour : une agence creee
    // malgre une reponse 400 serait le pire des deux mondes.
    expect(
      await existe(),
      "l'inscription a été refusée en 400 mais l'agence existe quand même"
    ).toBe(false)

    // --- LE REFUS : une offre hors catalogue --------------------------
    const morte = await request.post(`${BASE}/api/auth/register`, {
      headers: identiteAppelant(),
      failOnStatusCode: false,
      data: { ...corps, requestedPlan: "premium" },
    })

    expect(
      morte.status(),
      "« premium », valeur morte depuis la story 6.1, a été acceptée comme offre demandée"
    ).toBe(400)
    expect(await existe(), "une offre hors catalogue a créé une agence").toBe(
      false
    )

    // --- LE CONTROLE POSITIF, SUR LE MEME CHEMIN ----------------------
    // Sans lui, une route cassee pour tout le monde donnerait exactement
    // le meme vert que les deux refus ci-dessus.
    const bonne = await request.post(`${BASE}/api/auth/register`, {
      headers: identiteAppelant(),
      failOnStatusCode: false,
      data: { ...corps, requestedPlan: "enterprise" },
    })

    expect(
      bonne.status(),
      `une inscription portant une offre du catalogue a été refusée (${await bonne.text()}) — les refus ci-dessus ne prouvaient donc rien`
    ).toBe(200)

    const agence = await db.agency.findFirstOrThrow({
      where: { email: corps.email },
      select: { plan: true, requestedPlan: true, status: true },
    })

    expect(
      agence.requestedPlan,
      "l'offre demandée n'a pas été enregistrée"
    ).toBe("enterprise")

    // LE COEUR DE FR-5. La demande est une intention : elle ne devient
    // l'offre attribuee que par une decision du super administrateur
    // (story 6.3). Si cette assertion tombe, n'importe qui s'attribue
    // Enterprise en postant un corps de requete.
    expect(
      agence.plan,
      "l'offre DEMANDÉE est devenue l'offre ATTRIBUÉE — une inscription publique s'accorde ce qu'elle veut"
    ).toBe("starter")

    expect(agence.status, "l'agence inscrite n'est pas en attente").toBe(
      "pending"
    )
  })

  test("un champ d'offre attribuée glissé dans le corps n'attribue rien", async ({
    request,
  }) => {
    // Le corps est du JSON libre : rien n'empeche d'y ajouter `plan`. Zod
    // l'ignore — mais « Zod l'ignore » est une hypothese sur une
    // bibliotheque, et ce depot les mesure (CLAUDE.md §7).
    const marque = `forge-${Date.now()}`
    const corps = inscription(marque)
    aEffacer.push(corps.email)

    const reponse = await request.post(`${BASE}/api/auth/register`, {
      headers: identiteAppelant(),
      failOnStatusCode: false,
      data: { ...corps, requestedPlan: "starter", plan: "enterprise" },
    })

    expect(reponse.status(), await reponse.text()).toBe(200)

    const agence = await db.agency.findFirstOrThrow({
      where: { email: corps.email },
      select: { plan: true, requestedPlan: true },
    })

    expect(
      agence.plan,
      "un champ « plan » posé dans le corps de la requête a fixé l'offre attribuée"
    ).toBe("starter")
    expect(agence.requestedPlan).toBe("starter")
  })

  test("le formulaire enregistre l'offre choisie et la dit sous réserve", async ({
    page,
  }) => {
    test.setTimeout(120000)

    const marque = `formulaire-${Date.now()}`
    const corps = inscription(marque)
    aEffacer.push(corps.email)

    await page.setExtraHTTPHeaders(identiteAppelant())

    // Arrivee nue : c'est le visiteur qui choisit dans le formulaire, pas
    // l'URL. FR-4 exige que le choix reste possible sans passer par la
    // page tarifaire.
    await page.goto("/auth/register")

    await page.fill("input[name='agencyName']", corps.agencyName)
    await page.selectOption("select[name='wilaya']", corps.wilaya)
    await page.fill("input[name='email']", corps.email)
    await page.fill("input[name='password']", corps.password)
    await page.fill("input[name='confirmPassword']", corps.password)

    // LE GESTE REEL EST UN CLIC SUR LA CARTE, pas sur le bouton radio :
    // celui-ci est `sr-only`, et c'est le `label` qui recoit le pointeur.
    // `.check()` echoue d'ailleurs dessus — mesure du 16-08-2026.
    await page
      .locator(`label:has(input[name="${PARAM_OFFRE}"][value="pro"])`)
      .click()

    await expect(
      page.locator(`input[name="${PARAM_OFFRE}"][value="pro"]`),
      "cliquer la carte d'une offre ne la sélectionne pas"
    ).toBeChecked()

    // Ce que l'offre CONTIENT, pas seulement son nom (FR-4).
    await expect(
      page.getByText("10 utilisateurs", { exact: true }).first(),
      "le formulaire ne montre pas ce que contient l'offre choisie"
    ).toBeVisible()

    await page.click('button[type="submit"]')

    await expect(
      page.getByText(`${corps.agencyName} est enregistrée`),
      "l'inscription portant une offre choisie au formulaire a échoué"
    ).toBeVisible({ timeout: 60000 })

    // L'ECRAN NE LAISSE PAS CROIRE A UNE SOUSCRIPTION. Sans cette phrase,
    // le visiteur repart persuade d'avoir obtenu Pro.
    const annonce = page.getByText(/Offre demandée/)
    await expect(annonce, "l'écran de confirmation ne nomme pas l'offre demandée").toContainText("Pro")
    await expect(
      annonce,
      "l'écran de confirmation ne dit pas que l'offre reste à valider"
    ).toContainText("pas encore attribuée")

    const agence = await db.agency.findFirstOrThrow({
      where: { email: corps.email },
      select: { plan: true, requestedPlan: true },
    })

    expect(agence.requestedPlan, "le formulaire n'a pas transmis l'offre choisie").toBe("pro")
    expect(
      agence.plan,
      "le choix du visiteur a été appliqué comme offre attribuée"
    ).toBe("starter")
  })
})
