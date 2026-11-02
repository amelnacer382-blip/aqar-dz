import { test, expect, Page, APIRequestContext } from "@playwright/test"
import { readFileSync } from "fs"
import { emailLayout, sujetSur } from "../lib/mailer"
import { typeReconnu } from "../lib/file-type"
import { login, identiteAppelant } from "./auth-helper"
import { toCsv } from "../lib/csv"
import { documentSchema } from "../lib/validations"
import { join } from "path"
/*
  L'offre demandee est OBLIGATOIRE a l'inscription depuis la story 6.2 :
  sans elle, ces quatre inscriptions repondraient 400 et les tests
  echoueraient sur un motif etranger a ce qu'ils verifient.

  `OFFRE_PAR_DEFAUT` plutot qu'un « starter » ecrit en dur : la demande
  coincide alors avec l'offre attribuee, donc aucune de ces agences ne
  change de capacite du fait de ce champ.
*/
import { OFFRE_PAR_DEFAUT } from "../lib/offres"

const BASE = `http://localhost:${process.env.PLAYWRIGHT_PORT ?? "3002"}`

/**
 * L'identite d'appelant et la connexion vivent dans `tests/auth-helper.ts`
 * (story 4.3).
 *
 * Elles etaient definies ici, et `features.spec.ts` en avait sa propre
 * copie. Trois helpers pour une seule action : la dette avait ete
 * signalee en revue de la story 4.1 et reportee. Elle est devenue
 * bloquante en 4.3 — seul le `login()` de ce fichier posait une identite,
 * si bien que toute la suite partageait le compteur `login:ip:inconnu` et
 * franchissait les soixante tentatives par quart d'heure d'`auth.ts`.
 *
 * `identiteAppelant()` reste importe : plusieurs tests d'ici en ont
 * besoin sur une requete precise, ou avant toute connexion.
 */

test.describe("Vitrine publique (sans compte)", () => {
  test("liste, filtre et fiche accessibles", async ({ page }) => {
    await page.goto(`${BASE}/vitrine/agence-demo`)
    await expect(page.getByRole("heading", { name: "Agence Démo" })).toBeVisible()

    await page.goto(`${BASE}/vitrine/agence-demo?operation=vente`)
    // On regarde les cartes de biens, pas les <option> du filtre
    const cards = page.locator('a[href*="/biens/"]')
    await expect(cards.getByText("À vendre").first()).toBeVisible()
    // "À louer" ne doit plus apparaitre parmi les biens listes
    await expect(cards.getByText("À louer")).toHaveCount(0)

    await page.locator('a[href*="/vitrine/agence-demo/biens/"]').first().click()
    await page.waitForLoadState("networkidle")
    await expect(page.getByText("Ce bien vous intéresse ?")).toBeVisible({ timeout: 30000 })
  })

  test("le formulaire de contact crée un message", async ({ page }) => {
    // Le formulaire public est limite a cinq envois par heure et par
    // appelant, comptes en memoire du processus. Sans identite propre,
    // les tests qui postent partagent le compteur `vitrine:inconnu` — et
    // comme `reuseExistingServer` conserve le serveur entre deux
    // executions, une seconde passe dans l'heure en faisait echouer un,
    // avec un diagnostic trompeur (« message envoye » invisible).
    await page.setExtraHTTPHeaders(identiteAppelant())
    await page.goto(`${BASE}/vitrine/agence-demo`)
    await page.locator('a[href*="/vitrine/agence-demo/biens/"]').first().click()
    await page.waitForLoadState("networkidle")

    await page.fill('input[name="firstName"]', "Sofia")
    await page.fill('input[name="lastName"]', "Regression")
    await page.fill('input[name="phone"]', "+213 770 555 444")
    await page.fill('textarea[name="message"]', "Bonjour, ce bien est-il toujours disponible a la visite ?")
    await page.getByRole("button", { name: /Envoyer ma demande/i }).click()
    await page.waitForLoadState("networkidle")

    await expect(page.getByText(/message a bien ete envoye/i)).toBeVisible({ timeout: 30000 })
  })

  test("sans coordonnées, la demande est refusée", async ({ page }) => {
    // Ce test consomme lui aussi un jeton : le compteur est consomme
    // AVANT la validation du formulaire.
    await page.setExtraHTTPHeaders(identiteAppelant())
    await page.goto(`${BASE}/vitrine/agence-demo`)
    await page.locator('a[href*="/vitrine/agence-demo/biens/"]').first().click()
    await page.waitForLoadState("networkidle")

    await page.fill('input[name="firstName"]', "Sans")
    await page.fill('input[name="lastName"]', "Contact")
    await page.fill('textarea[name="message"]', "Message sans telephone ni adresse email fournie.")
    await page.getByRole("button", { name: /Envoyer ma demande/i }).click()
    await page.waitForLoadState("networkidle")

    await expect(page.getByText(/au moins un telephone ou un email/i)).toBeVisible({
      timeout: 30000,
    })
  })
})

test.describe("Contrôle d'accès", () => {
  test("agence en attente : connexion refusée avec la vraie raison", async ({ page }) => {
    await page.goto(`${BASE}/auth/login`)
    await page.fill("#email", "attente@aqar.dz")
    await page.fill("#password", "password123")
    await page.click('button[type="submit"]')
    await page.waitForTimeout(5000)

    expect(page.url()).toContain("/auth/login")
    await expect(page.getByText(/pas encore activée/i)).toBeVisible()
  })

  test("mauvais mot de passe : message générique, aucune fuite", async ({ page }) => {
    await page.goto(`${BASE}/auth/login`)
    await page.fill("#email", "attente@aqar.dz")
    await page.fill("#password", "mauvais-mot-de-passe")
    await page.click('button[type="submit"]')
    await page.waitForTimeout(5000)

    await expect(page.getByText(/Email ou mot de passe incorrect/i)).toBeVisible()
    await expect(page.getByText(/pas encore activée/i)).toHaveCount(0)
  })

  test("les routes API répondent 401 en JSON, pas du HTML", async ({ request }) => {
    const res = await request.post(`${BASE}/api/upload`, { failOnStatusCode: false })
    expect(res.status()).toBe(401)
    expect(res.headers()["content-type"]).toContain("application/json")
  })
})

test.describe("Modules métier", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin@aqar.dz")
  })

  test("gestion locative : indicateurs et quittances du seed", async ({ page }) => {
    await page.goto(`${BASE}/agency/rental-management`)
    await expect(page.getByRole("heading", { name: "Gestion locative" })).toBeVisible()
    await expect(page.getByText("Loyers attendus")).toBeVisible()
    await expect(page.getByText("Studio meublé — Bab Ezzouar")).toBeVisible()
  })

  test("statistiques : graphiques tracés et tableau de repli", async ({ page }) => {
    await page.goto(`${BASE}/agency/statistics`)
    await expect(page.getByText("Recettes encaissées par mois")).toBeVisible()
    await expect(page.locator("svg path").first()).toBeVisible()
    await page.getByText("Afficher les valeurs sous forme de tableau").click()
    await expect(page.getByRole("cell", { name: /2026/ }).first()).toBeVisible()
  })

  test("visites : rappels et retours structurés", async ({ page }) => {
    await page.goto(`${BASE}/agency/visits`)
    await expect(page.getByText("Visites à venir", { exact: true })).toBeVisible()
    await expect(page.getByText("Relances à faire", { exact: true })).toBeVisible()
    await expect(page.getByText("Très intéressé").first()).toBeVisible()
  })

  test("historique des interactions sur la fiche client", async ({ page }) => {
    await page.goto(`${BASE}/agency/clients`)
    await page
      .locator('a[href^="/agency/clients/"]:not([href$="/new"]):not([href$="/edit"])')
      .first()
      .click()
    await page.waitForLoadState("networkidle")
    await expect(page.getByText(/Historique des interactions/i)).toBeVisible({ timeout: 30000 })
  })

  test("une vente invalide est rejetée par la validation serveur", async ({ page }) => {
    await page.goto(`${BASE}/agency/sales/new`)
    await page.evaluate(() => {
      const form = document.querySelector("form") as HTMLFormElement
      form.setAttribute("novalidate", "true")
      const price = form.querySelector('[name="finalPrice"]') as HTMLInputElement
      if (price) price.value = "-1000"
    })
    await page.locator('form button[type="submit"]').first().click()
    await page.waitForLoadState("networkidle")
    // La vente n'est pas creee : on n'atterrit jamais sur la liste des ventes
    expect(page.url()).not.toMatch(/\/agency\/sales$/)
  })

  test("les PDF se téléchargent depuis la fiche d'un bien", async ({ page }) => {
    await page.goto(`${BASE}/agency/properties`)
    await page
      .locator('a[href^="/agency/properties/"]:not([href$="/new"]):not([href$="/edit"])')
      .first()
      .click()
    await page.waitForLoadState("networkidle")

    const link = page.locator('a[href*="/api/pdf/property/"]').first()
    await expect(link).toBeVisible({ timeout: 30000 })

    const href = await link.getAttribute("href")
    const res = await page.request.get(`${BASE}${href}`)
    expect(res.status()).toBe(200)
    expect(res.headers()["content-type"]).toContain("application/pdf")
  })
})

test.describe("Super admin", () => {
  test("statistiques et paramètres répondent", async ({ page }) => {
    await login(page, "superadmin@aqar.dz")

    const stats = await page.goto(`${BASE}/admin/statistics`)
    expect(stats?.status()).toBe(200)
    await expect(page.getByRole("heading", { name: /Statistiques plateforme/i })).toBeVisible()

    const settings = await page.goto(`${BASE}/admin/settings`)
    expect(settings?.status()).toBe(200)
    await expect(page.getByRole("heading", { name: /Paramètres plateforme/i })).toBeVisible()
  })
})

/**
 * BUG-01 — l'adresse email etait sensible a la casse.
 *
 * Ces trois cas echouent si la normalisation est retiree de
 * `identityEmail` (lib/validations/index.ts) ou si la route d'inscription
 * reprend un schema local. C'est le filet demande par la story 1.2.
 */
/**
 * BUG-04 et BUG-21 — les documents deposes par une agence.
 *
 * Trois choses distinctes sont verifiees ici, et il faut les garder
 * distinctes : l'appartenance (une agence ne lit que ses documents),
 * l'authentification (aucune session, aucun octet), et le verrou de
 * chemin de `lib/storage.ts` (une `url` forgee ne fait rien lire).
 *
 * Le troisieme est le plus important : sans lui, cette story
 * remplacerait une lecture non authentifiee de documents par une lecture
 * de fichier arbitraire pour tout compte d'agence.
 */

/** 1x1 PNG transparent — le plus petit fichier qu'accepte /api/upload. */
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk" +
    "YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
)

/** Un PDF minimal mais valide, suffisant pour traverser /api/upload. */
const PDF_MINIMAL = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF\n"
)

/**
 * Depose un document via l'interface et renvoie le lien de lecture.
 *
 * `forgedUrl` remplace l'adresse rendue par le televersement juste avant
 * l'envoi du formulaire. Ce n'est pas un artifice de test : le champ est
 * un `input hidden` qu'aucune validation ne contraint (BUG-21), donc
 * c'est exactement ce qu'un compte d'agence peut faire depuis son
 * navigateur.
 */
async function createDocument(
  page: Page,
  name: string,
  forgedUrl?: string
): Promise<string> {
  await page.goto(`${BASE}/agency/documents/new`)
  await page.fill("#name", name)

  await page.getByRole("combobox").click()
  await page.getByRole("option", { name: "Contrat de vente", exact: true }).click()

  await page.setInputFiles('input[type="file"]', {
    name: "piece.pdf",
    mimeType: "application/pdf",
    buffer: PDF_MINIMAL,
  })
  await expect(page.getByText(/Document uploadé avec succès/i)).toBeVisible({
    timeout: 60000,
  })

  if (forgedUrl) {
    // Ecriture par le setter natif : React ne rerend rien apres coup, la
    // valeur posee est bien celle qui part avec le formulaire.
    await page.evaluate((url) => {
      const field = document.querySelector(
        'input[name="documentUrl"]'
      ) as HTMLInputElement
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )!.set!
      setter.call(field, url)
    }, forgedUrl)
  }

  await page.getByRole("button", { name: /Créer le document/i }).click()
  await page.waitForURL(/\/agency\/documents(\?|$)/, { timeout: 60000 })

  const href = await page
    .locator(`tr:has-text("${name}") a[href*="/api/documents/"]`)
    .first()
    .getAttribute("href")

  expect(href).toBeTruthy()
  return href as string
}


/**
 * Tente un depot avec une adresse forgee et renvoie l'URL d'arrivee.
 *
 * Contrairement a `createDocument`, on n'attend aucune redirection vers la
 * liste : le propos est justement que le depot soit refuse.
 */
async function tentativeDeDepot(
  page: Page,
  nom: string,
  url: string
): Promise<string> {
  await page.goto(`${BASE}/agency/documents/new`)
  await page.fill("#name", nom)
  await page.getByRole("combobox").click()
  await page.getByRole("option", { name: "Contrat de vente", exact: true }).click()

  await page.evaluate((valeur) => {
    const champ = document.querySelector(
      'input[name="documentUrl"]'
    ) as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )!.set!
    setter.call(champ, valeur)
  }, url)

  await page.getByRole("button", { name: /Créer le document/i }).click()

  // Attendre l'URL et non `networkidle` : une Server Action ne provoque
  // pas de chargement de document, et `networkidle` peut se resoudre avant
  // que la redirection ait ete appliquee — `page.url()` rendait alors
  // l'adresse d'origine, sans parametre. Rouge intermittent garanti.
  await page.waitForURL(/[?&](error|success)=/, { timeout: 30000 })

  return page.url()
}

test.describe("Accès aux documents (BUG-04, BUG-21)", () => {
  test("le document de l'agence est servi à l'agence, et à elle seule", async ({
    page,
    request,
  }) => {
    await login(page, "admin@aqar.dz")

    const nom = `Contrat protege ${Date.now()}`
    const lien = await createDocument(page, nom)

    // Connecte : le fichier arrive, avec son type reel et le nom lisible.
    const servi = await page.request.get(`${BASE}${lien}`)
    expect(servi.status()).toBe(200)
    expect(servi.headers()["content-type"]).toContain("application/pdf")
    expect(servi.headers()["content-disposition"]).toContain("Contrat-protege")
    expect(servi.headers()["cache-control"]).toContain("no-store")
    expect((await servi.body()).length).toBeGreaterThan(0)

    // `request` est un contexte distinct de celui de `page` : aucun cookie
    // de session ne l'accompagne. C'est l'appel qui reussissait avant
    // cette story, directement sur /uploads/documents/.
    const anonyme = await request.get(`${BASE}${lien}`, {
      failOnStatusCode: false,
    })
    expect(anonyme.status()).toBe(401)
    expect(await anonyme.text()).not.toContain("%PDF")

    // AC 1 — l'acces direct au fichier. Longtemps invérifiable ici faute
    // de nginx dans l'environnement de test : c'est le middleware, ajoute
    // a la revue, qui rend la garde independante du proxy et donc
    // observable. Il repond 404 avec un corps VIDE, la ou Next servirait
    // le fichier ou sa page 404 en HTML — c'est ce qui distingue une vraie
    // garde d'un fichier simplement absent.
    const depotDirect = await page.request.post(`${BASE}/api/upload`, {
      multipart: {
        file: {
          name: "direct.pdf",
          mimeType: "application/pdf",
          buffer: PDF_MINIMAL,
        },
        type: "documents",
      },
    })
    const { url: cheminFichier } = await depotDirect.json()

    const direct = await request.get(`${BASE}${cheminFichier}`, {
      failOnStatusCode: false,
    })
    expect(direct.status()).toBe(404)
    expect((await direct.body()).length).toBe(0)
  })

  test("une autre agence reçoit 404, jamais 403", async ({ page }) => {
    // Le document appartient a l'agence de demonstration. On depose son
    // fichier par l'API pour en retenir l'adresse : c'est elle que
    // l'agence voisine tentera de revendiquer.
    await login(page, "admin@aqar.dz")

    const depot = await page.request.post(`${BASE}/api/upload`, {
      multipart: {
        file: {
          name: "acte.pdf",
          mimeType: "application/pdf",
          buffer: PDF_MINIMAL,
        },
        type: "documents",
      },
    })
    expect(depot.status()).toBe(200)
    const { url: urlDemo } = await depot.json()

    const lien = await createDocument(
      page,
      `Acte cloisonne ${Date.now()}`,
      urlDemo
    )

    // Une agence fraichement inscrite est « en attente » : dans cet etat
    // elle n'atteint meme pas la route. Il faut donc l'activer pour que
    // le test porte sur l'appartenance, et non sur le statut.
    const unique = `cloison-${Date.now()}`
    const voisine = `Agence ${unique}`
    const email = `${unique}@exemple.dz`

    const inscription = await page.request.post(`${BASE}/api/auth/register`, {
      headers: identiteAppelant(),
      data: {
        agencyName: voisine,
        email,
        wilaya: "Constantine",
        password: "password123",
        requestedPlan: OFFRE_PAR_DEFAUT,
      },
    })
    expect(inscription.status()).toBe(200)

    await page.context().clearCookies()
    await login(page, "superadmin@aqar.dz")
    await page.goto(`${BASE}/admin/agencies`)
    await page
      .locator(`tr:has-text("${voisine}") form:has(input[value="active"]) button`)
      .first()
      .click()

    /**
     * Attendre l'EFFET de l'activation, pas le silence du réseau.
     *
     * `waitForLoadState("networkidle")` ne dit rien de la Server Action :
     * il dit que le réseau s'est tu, ce qui arrive aussi AVANT que
     * l'action ait abouti. Le test poursuivait alors, effaçait les
     * cookies pendant que l'activation était encore en vol, et se
     * connectait à une agence restée « en attente » — que `authorize()`
     * refuse. L'échec tombait 90 s plus tard sur un `waitForURL` de
     * connexion, à trente lignes de sa cause.
     *
     * Diagnostiqué le 12-08-2026 en relevant en base le statut des
     * agences laissées par les exécutions rouges : `pending`. Le cas est
     * antérieur — une agence figée à `pending` datait du 11 août — mais il
     * est devenu fréquent, chaque requête coûtant désormais une lecture de
     * compte de plus (story 1.8).
     *
     * Le badge de la ligne est le seul signal qui prouve que la base a
     * changé ET que la page a été revalidée.
     */
    await expect(
      page.locator(`tr:has-text("${voisine}")`).getByText("Active", { exact: true }),
      "l'agence voisine n'a pas été activée"
    ).toBeVisible({ timeout: 30000 })

    await page.context().clearCookies()
    await login(page, email)

    const reponse = await page.request.get(`${BASE}${lien}`, {
      failOnStatusCode: false,
    })

    // 404 et non 403 : un 403 confirmerait que cet identifiant existe.
    expect(reponse.status()).toBe(404)
    expect(await reponse.text()).not.toContain("%PDF")

    // Le vrai contournement, celui que la premiere version de la story
    // 1.3 ne voyait pas : ne pas demander le document de l'autre, mais en
    // creer un a soi qui designe son fichier. L'appartenance de la LIGNE
    // est alors satisfaite.
    //
    // Depuis la story 1.7, il est arrete plus tot — au depot. Le document
    // n'existe jamais, ce qui vaut mieux qu'un 404 a la lecture.
    const arrivee = await tentativeDeDepot(
      page,
      `Usurpation ${Date.now()}`,
      urlDemo
    )

    expect(arrivee).toContain("/agency/documents/new")
    expect(decodeURIComponent(arrivee)).toContain(
      "Le fichier doit être téléversé depuis ce formulaire"
    )
  })

  /**
   * Deux tests ont vecu ici, et ils ont ete retires en connaissance de
   * cause a la story 1.7 — pas parce qu'ils genaient, mais parce que leur
   * mise en scene est devenue impossible.
   *
   * Ils forgeaient l'`url` d'un document (« /uploads/../.env »,
   * « documents/../properties/x.jpg », la cle d'une autre agence) pour
   * prouver que la LECTURE refusait. Depuis que l'ECRITURE refuse ces
   * memes valeurs, aucune ligne de ce genre ne peut plus etre creee par
   * l'interface : le test ne testait plus la garde, il testait le
   * formulaire.
   *
   * Leur substance est reprise plus bas, en refus au depot — une garantie
   * plus forte, et celle-la atteignable.
   *
   * Ce qui est PERDU, et qu'il faut dire : `lib/documents.ts` et le
   * verrou de chemin de `lib/storage.ts` n'ont plus de couverture de bout
   * en bout. Ils protegent les lignes ecrites avant aujourd'hui, et tout
   * futur chemin d'ecriture qui oublierait la verification. C'est de la
   * defense en profondeur sans filet — consigne dans deferred-work.md.
   */

  test("le nom arabe survit au telechargement", async ({ page }) => {
    await login(page, "admin@aqar.dz")

    // Nom sans un seul caractere latin : assaini, il ne resterait rien,
    // et tous les documents d'une agence arriveraient sous « fichier ».
    const lien = await createDocument(page, `عقد بيع ${Date.now()}`)
    const reponse = await page.request.get(`${BASE}${lien}`)

    expect(reponse.status()).toBe(200)

    const disposition = reponse.headers()["content-disposition"]
    // RFC 6266 : le nom d'origine voyage dans filename*, le repli ASCII
    // reste present pour les clients qui l'ignorent.
    expect(disposition).toContain("filename*=UTF-8''")
    expect(disposition).toContain(encodeURIComponent("عقد"))
  })

  test("un type MIME invalide ne casse pas le telechargement", async ({
    page,
  }) => {
    await login(page, "admin@aqar.dz")

    const nom = `Type douteux ${Date.now()}`
    const lien = await createDocument(page, nom)
    const id = lien.split("/")[3]

    // Le champ « Type MIME » de la fiche est un texte libre. Pose tel quel
    // dans l'en-tete, il rendait le document illisible pour de bon.
    await page.goto(`${BASE}/agency/documents/${id}/edit`)
    await page.fill("#mimeType", "n'importe quoi du tout")
    await page.getByRole("button", { name: /Enregistrer les modifications/i }).click()
    await page.waitForLoadState("networkidle")

    const reponse = await page.request.get(`${BASE}${lien}`, {
      failOnStatusCode: false,
    })

    expect(reponse.status()).toBe(200)
    expect(reponse.headers()["content-type"]).toContain("application/pdf")
  })

  test("les photos de biens restent servies sans session", async ({
    page,
    request,
  }) => {
    await login(page, "admin@aqar.dz")

    const depot = await page.request.post(`${BASE}/api/upload`, {
      multipart: {
        file: { name: "vitrine.png", mimeType: "image/png", buffer: PNG_1x1 },
        type: "properties",
      },
    })
    expect(depot.status()).toBe(200)

    const { url } = await depot.json()
    expect(url).toContain("/uploads/properties/")

    // Ce que ce test prouve, et ce qu'il ne prouve pas.
    //
    // La suite tourne sur `npm start`, sans nginx : c'est Next qui sert
    // public/, et il en dresse l'inventaire une fois au demarrage. Un
    // fichier televerse pendant le test repond donc 404 quoi qu'il
    // arrive — verifie, ce n'est pas une supposition. Exiger 200 ici
    // ferait echouer un test pour une raison sans rapport avec la story.
    //
    // Ce qui reste verifiable, et qui est le vrai risque : que la
    // fermeture de /uploads/documents/ ait au passage mis /uploads/
    // entier derriere une session. Un 401 ou un 403 le dirait.
    //
    // La preuve reelle (200 sur une photo, 404 sur un document, sans
    // session, derriere nginx) est relevee sur la pile Docker et
    // consignee dans le Debug Log de la story 1.3.
    const anonyme = await request.get(`${BASE}${url}`, { failOnStatusCode: false })
    expect(anonyme.status()).not.toBe(401)
    expect(anonyme.status()).not.toBe(403)
  })
})

/**
 * BUG-21 / BUG-23 — l'adresse d'un document n'etait contrainte par rien.
 *
 * La story 1.3 avait desamorce les consequences a la lecture et a la
 * suppression ; celle-ci empeche la donnee sale d'entrer. Les deux
 * restent : le second filet couvre les lignes deja ecrites.
 */
test.describe("Contrainte sur l'adresse d'un document (BUG-21)", () => {
  test("l'alphabet des segments d'adresse est verrouillé", () => {
    // AJOUTE PAR L'AUDIT DE LA STORY 4.4, et c'est le seul trou qu'il ait
    // trouvé.
    //
    // La mutation qui rouvrait l'alphabet des segments — `[^/]+` au lieu
    // de `[A-Za-z0-9_-][A-Za-z0-9._-]*` — n'a fait rougir AUCUN des
    // quatre-vingt-douze tests. Motif : les adresses forgées du test
    // voisin comptent trois segments ou plus et échouent sur la FORME
    // générale, tandis que celles à deux segments sont arrêtées plus bas
    // par `ownsDocumentUrl` (le segment d'agence ne correspond pas) puis
    // par `safeKey` (lib/storage.ts refuse « .. » après décodage).
    //
    // La défense en profondeur fonctionnait donc, mais la couche la plus
    // externe n'était tenue par rien : on pouvait la desserrer sans que
    // la suite bronche. Ce cas-ci l'éprouve seule, au niveau du schéma,
    // sans passer par les couches qui la couvraient.
    const refusees = [
      // Remontée de dossier, à deux segments : la forme passe, seul
      // l'alphabet la refuse.
      "/uploads/documents/../acte.pdf",
      "/uploads/documents/agence/..",
      // Encodage pourcent : « % » est hors alphabet, donc la séquence
      // n'a même pas à être décodée pour être écartée.
      "/uploads/documents/agence/..%2facte.pdf",
      "/uploads/documents/%2e%2e/acte.pdf",
      // Un segment ne commence jamais par un point.
      "/uploads/documents/.git/config",
      // Ni trois segments, ni un seul.
      "/uploads/documents/agence/dossier/acte.pdf",
      "/uploads/documents/agence",
      // Le bon dossier est « documents ».
      "/uploads/properties/photo.png",
      // Une adresse absolue étrangère, et un schéma exécutable.
      "https://exemple.invalid/uploads/documents/agence/acte.pdf",
      "javascript:alert(1)",
    ]

    for (const url of refusees) {
      const resultat = documentSchema.safeParse({
        name: "Pièce",
        type: "contrat_vente",
        url,
      })

      expect.soft(resultat.success, `« ${url} » est acceptée par le schéma`).toBe(
        false
      )
    }

    // Le contrôle : la forme légitime passe. Sans lui, un schéma qui
    // refuserait TOUT donnerait le même vert.
    const legitime = documentSchema.safeParse({
      name: "Pièce",
      type: "contrat_vente",
      url: "/uploads/documents/cm00000000000000000000000/1754-a1b2c3.pdf",
    })

    expect(
      legitime.success,
      "une adresse produite par le téléversement est refusée"
    ).toBe(true)
  })

  test("une adresse hors du formulaire est refusee", async ({ page }) => {
    await login(page, "admin@aqar.dz")

    const forgees = [
      // Bien formee, mais le dossier d'une AUTRE agence. C'est le seul cas
      // qui franchit le schema et exerce reellement `ownsDocumentUrl` —
      // les autres sont arretes plus haut, par la forme.
      "/uploads/documents/cm00000000000000000000000/acte.pdf",
      // Remontees de dossier, brutes et encodees. Elles reprennent la
      // substance des tests de lecture retires : le refus a simplement
      // change de couche.
      "/uploads/documents/../../.env",
      "/uploads/documents/moi/../../../.env",
      "/uploads/documents/moi/%2e%2e/%2e%2e/.env",
      // Hors du dossier des documents.
      "/uploads/properties/photo.png",
      // Le vecteur de BUG-23.
      "javascript:alert(1)",
      // Adresse externe deguisee.
      "https://exemple.invalid/uploads/documents/moi/acte.pdf",
    ]

    for (const forgee of forgees) {
      const nom = `Refus ${forgees.indexOf(forgee)} ${Date.now()}`
      const arrivee = await tentativeDeDepot(page, nom, forgee)

      // On reste sur le formulaire, avec LE motif attendu — et non pas
      // « une erreur quelconque » : sans cette precision, une validation
      // cassee ailleurs (nom, type) rendrait le test vert sans que la
      // contrainte d'adresse ait ete exercee.
      expect(arrivee).toContain("/agency/documents/new")
      expect(decodeURIComponent(arrivee)).toContain(
        "Le fichier doit être téléversé depuis ce formulaire"
      )

      // Le motif est bien AFFICHE, pas seulement present dans l'adresse.
      await expect(
        page.getByText(/Le fichier doit être téléversé depuis ce formulaire/)
      ).toBeVisible()

      // Et rien n'a ete ecrit.
      await page.goto(`${BASE}/agency/documents`)
      await expect(page.getByText(nom, { exact: true })).toHaveCount(0)
    }
  })

  test("le depot normal reste accepte", async ({ page }) => {
    await login(page, "admin@aqar.dz")

    const nom = `Depot normal ${Date.now()}`
    const lien = await createDocument(page, nom)

    expect(lien).toContain("/api/documents/")
    expect((await page.request.get(`${BASE}${lien}`)).status()).toBe(200)
  })

  test("la fiche d'un document s'enregistre", async ({ page }) => {
    // Elle ne le pouvait pas : le champ « URL » etait un input type="url"
    // portant une adresse relative, que le navigateur refusait d'envoyer.
    // Retirer le champ ferme le defaut et la faille du meme geste.
    await login(page, "admin@aqar.dz")

    const nom = `Fiche ${Date.now()}`
    const lien = await createDocument(page, nom)
    const id = lien.split("/")[3]

    await page.goto(`${BASE}/agency/documents/${id}/edit`)
    await expect(page.locator('input[name="url"]')).toHaveCount(0)

    await page.fill("#name", `${nom} renomme`)
    await page.getByRole("button", { name: /Enregistrer les modifications/i }).click()
    await page.waitForURL(`**/agency/documents/${id}**`, { timeout: 30000 })

    await expect(
      page.getByRole("heading", { name: `${nom} renomme` })
    ).toBeVisible({ timeout: 30000 })
  })
})

test.describe("Normalisation des adresses email (BUG-01)", () => {
  test("la connexion accepte n'importe quelle casse", async ({ page }) => {
    for (const saisie of ["admin@aqar.dz", "ADMIN@AQAR.DZ", "Admin@Aqar.Dz"]) {
      await login(page, saisie)
      expect(page.url()).toContain("/agency")

      // Vider les cookies plutot que de passer par /api/auth/signout : cette
      // page-la est celle, par defaut, de NextAuth, et auth.config ne
      // personnalise que `signIn` et `error`. Le jour ou `pages.signOut` est
      // ajoute, un clic sur son bouton casserait ce test pour une raison
      // sans rapport avec ce qu'il verifie.
      await page.context().clearCookies()
    }
  })

  test("l'inscription enregistre en minuscules et refuse le doublon de casse", async ({
    request,
  }) => {
    // Adresse unique : ce test cree reellement une agence en attente.
    const unique = `casse-${Date.now()}`
    const appelant = identiteAppelant()
    const inscription = (email: string) =>
      request.post(`${BASE}/api/auth/register`, {
        headers: appelant,
        data: {
          agencyName: `Agence ${unique}`,
          email,
          wilaya: "Alger",
          password: "password123",
          requestedPlan: OFFRE_PAR_DEFAUT,
        },
      })

    const premiere = await inscription(`  Test.${unique}@Exemple.DZ  `)
    expect(premiere.status()).toBe(200)

    // Meme adresse, casse differente : refus explicite, jamais une 500.
    const doublon = await inscription(`TEST.${unique}@EXEMPLE.dz`)
    expect(doublon.status()).toBe(400)
    expect((await doublon.json()).error).toContain("Cet email est déjà utilisé")
  })

  test("le compte cree est retrouve par son adresse en minuscules", async ({ page }) => {
    const unique = `retrouve-${Date.now()}`
    const reponse = await page.request.post(`${BASE}/api/auth/register`, {
      headers: identiteAppelant(),
      data: {
        agencyName: `Agence ${unique}`,
        email: ` Contact.${unique}@ImmoAlger.DZ `,
        wilaya: "Oran",
        password: "password123",
        requestedPlan: OFFRE_PAR_DEFAUT,
      },
    })
    expect(reponse.status()).toBe(200)

    // La nouvelle agence est en attente d'activation : la connexion echoue,
    // mais le MOTIF prouve que le compte a ete retrouve et le mot de passe
    // valide — donc que la ligne est bien stockee en minuscules.
    await page.goto(`${BASE}/auth/login`)
    await page.fill("#email", `contact.${unique}@immoalger.dz`)
    await page.fill("#password", "password123")
    await page.click('button[type="submit"]')
    await page.waitForLoadState("networkidle")

    await expect(page.getByText(/agence n'est pas encore activée/i)).toBeVisible({
      timeout: 30000,
    })

    // agencies.email est @unique lui aussi, et la route d'inscription y ecrit
    // la meme valeur. Sans cette assertion, un retour a `body.email` pour la
    // seule agence passerait inapercu : rien d'autre n'expose ce champ.
    await page.context().clearCookies()
    await login(page, "superadmin@aqar.dz")
    await page.goto(`${BASE}/admin/agencies`)
    await expect(
      page.getByText(`contact.${unique}@immoalger.dz`, { exact: true })
    ).toBeVisible({ timeout: 30000 })
  })

  test("mot de passe oublié accepte une autre casse", async ({ page }) => {
    await page.goto(`${BASE}/auth/forgot`)
    await page.fill("#email", "ADMIN@AQAR.DZ")
    await page.click('button[type="submit"]')
    await page.waitForLoadState("networkidle")

    // La reponse est volontairement identique que le compte existe ou non :
    // l'ecran ne peut donc pas prouver la normalisation. Il prouve seulement
    // que le chemin ne casse pas. La creation reelle du jeton est verifiee
    // en base (voir Debug Log de la story).
    await expect(page.getByText(/lien de réinitialisation vient d'être envoyé/i)).toBeVisible({
      timeout: 30000,
    })
  })
})


test.describe("Identification de l'appelant (BUG-20)", () => {
  /**
   * Corps volontairement invalide : le compteur est consomme AVANT la
   * validation du corps, donc ces tests n'inscrivent aucune agence. Le
   * refus attendu est 400 tant que le budget tient, 429 ensuite — deux
   * codes distincts, c'est ce qui rend le compteur observable de
   * l'exterieur.
   */
  const inscrire = (
    request: APIRequestContext,
    entetes: Record<string, string>
  ) =>
    request.post(`${BASE}/api/auth/register`, { headers: entetes, data: {} })

  test("un X-Forwarded-For forgé ne rouvre pas le budget d'inscription", async ({
    request,
  }, testInfo) => {
    // Identite propre a cette tentative — `testInfo.retry` la fait varier,
    // sans quoi une reprise en integration continue retrouverait un
    // compteur deja epuise et echouerait des la premiere requete.
    const moi = identiteAppelant()
    const identite = { "x-real-ip": `${moi["x-real-ip"]}:${testInfo.retry}` }

    // Cinq tentatives : le budget est consomme, sans etre depasse.
    for (let i = 0; i < 5; i++) {
      expect(
        (await inscrire(request, identite)).status(),
        `tentative ${i + 1} sur 5 : le budget ne devrait pas etre epuise`
      ).toBe(400)
    }

    // La sixieme le depasse.
    expect((await inscrire(request, identite)).status()).toBe(429)

    // Le coeur du defaut : trois adresses forgees d'affilee ouvraient
    // chacune un compteur neuf, et la limitation ne valait plus rien.
    for (const forge of ["9.9.9.1", "9.9.9.2", "9.9.9.3"]) {
      const reponse = await inscrire(request, {
        ...identite,
        "x-forwarded-for": forge,
      })
      expect(
        reponse.status(),
        `X-Forwarded-For: ${forge} a rouvert un compteur`
      ).toBe(429)
    }

    // Et sous la forme exacte que nginx produisait : valeur du client,
    // puis adresse reelle ajoutee A LA FIN. C'est en lisant la premiere
    // de cette liste que l'application comptait une identite choisie par
    // l'appelant.
    const enListe = await inscrire(request, {
      ...identite,
      "x-forwarded-for": `9.9.9.4, ${identite["x-real-ip"]}`,
    })
    expect(enListe.status()).toBe(429)

    // Volontairement PAS de requete sans `x-real-ip` ici : elle
    // consommerait le compteur partage `inconnu`, dont depend le test
    // suivant. Et son assertion serait creuse — le corps etant invalide,
    // la route repond 400 quoi qu'il arrive, y compris sans aucune
    // limitation.
  })

  test("une même adresse écrite autrement ne donne pas un compteur neuf", async ({
    request,
  }, testInfo) => {
    // `net.isIP` valide la forme, il ne canonicalise pas : la meme
    // machine s'ecrit `1.2.3.4`, `::ffff:1.2.3.4`, `::FFFF:1.2.3.4`,
    // `0:0:0:0:0:ffff:1.2.3.4`... toutes acceptees. Sans normalisation,
    // chacune ouvrirait son compteur — et le controle de forme ne
    // servirait a rien.
    //
    // 198.51.100.0/24 est reserve a la documentation (RFC 5737).
    const octet = ((Date.now() + testInfo.retry * 7) % 200) + 20
    const brute = `198.51.100.${octet}`

    for (let i = 0; i < 5; i++) {
      expect((await inscrire(request, { "x-real-ip": brute })).status()).toBe(400)
    }

    // Meme machine, ecriture IPv4 vue a travers IPv6.
    for (const ecriture of [
      `::ffff:${brute}`,
      `::FFFF:${brute}`,
      `0:0:0:0:0:ffff:${brute}`,
    ]) {
      expect(
        (await inscrire(request, { "x-real-ip": ecriture })).status(),
        `« ${ecriture} » a ouvert un compteur distinct de « ${brute} »`
      ).toBe(429)
    }
  })

  test("une valeur qui n'est pas une adresse IP ne fabrique pas de compteur", async ({
    request,
  }) => {
    // ⚠ CE TEST SATURE `inscription:inconnu` POUR UNE HEURE.
    //
    // C'est inevitable : le seul signe observable de l'exterieur que des
    // valeurs invalides ne fabriquent pas de compteur, c'est qu'elles
    // partagent celui de `inconnu`. Tout test futur qui s'inscrit doit
    // donc passer par `identiteAppelant()` — sans quoi il echouera ici,
    // pour une raison sans rapport avec ce qu'il verifie.
    //
    // Onze identites, toutes invalides. « 9.9.9.5 » avec espace final
    // n'en fait PAS partie : la fonction trim avant de valider, donc
    // cette valeur est bonne et ouvre legitimement son propre compteur.
    const invalides = [
      "9.9.9.1, 8.8.8.8",
      "9.9.9.2:80",
      "[2001:db8::1]",
      "010.9.9.3",
      "999.9.9.4",
      "pas-une-adresse",
      "",
      "   ",
      "<script>",
      "9.9.9.6/32",
      "localhost",
    ]

    const codes: number[] = []

    for (const valeur of invalides) {
      codes.push((await inscrire(request, { "x-real-ip": valeur })).status())
    }

    // On compte les ACCEPTATIONS, pas les refus.
    //
    // Si chaque valeur invalide ouvrait son propre compteur, les onze
    // seraient acceptees. Comme elles retombent toutes sur `inconnu`,
    // dont le budget est de cinq, il ne peut y en avoir plus de cinq —
    // et moins si un autre test a deja entame ce compteur. Le sens de
    // l'inegalite compte : elle reste vraie quel que soit l'etat
    // anterieur du processus, et elle rougit des qu'une seule valeur
    // supplementaire fabrique une cle.
    expect(
      codes.filter((code) => code === 400).length,
      `des identites invalides ont fabrique leur propre compteur — codes : ${codes.join(", ")}`
    ).toBeLessThanOrEqual(5)
  })

  test("la configuration nginx n'expose aucun relais sans écrasement", async () => {
    // La suite attaque `next start` en direct : nginx n'est jamais dans
    // le chemin, donc aucun test d'execution ne peut prouver l'AC 6. Un
    // retour a `$proxy_add_x_forwarded_for` passerait inapercu. Ce test
    // lit le fichier — c'est un garde-fou de configuration, pas une
    // preuve de comportement, et il ne pretend pas l'etre.
    // Les commentaires sont retires : ce fichier EXPLIQUE pourquoi
    // `$proxy_add_x_forwarded_for` a ete abandonne, et le mot y figure
    // donc legitimement. Un garde-fou qui rougit sur sa propre
    // justification pousse a effacer l'explication.
    const conf = readFileSync(
      join(__dirname, "..", "nginx", "nginx.conf"),
      "utf-8"
    )
      .split("\n")
      .filter((ligne) => !ligne.trim().startsWith("#"))
      .join("\n")

    expect(
      conf.includes("$proxy_add_x_forwarded_for"),
      "nginx ajoute de nouveau l'adresse a la liste du client (BUG-20)"
    ).toBe(false)

    // L'en-tete recu du client n'a plus sa place dans le journal : il
    // n'y apporterait qu'une adresse choisie par l'appelant, posee a
    // cote de $remote_addr sans rien qui les distingue.
    expect(conf.includes("$http_x_forwarded_for")).toBe(false)

    // Chaque bloc qui relaie vers l'application doit ecraser les deux
    // en-tetes. Sans cela l'invariant ne vaut pour aucun.
    const relais = conf.match(/proxy_pass\s+http:\/\/nextjs/g) ?? []
    const reels = conf.match(/proxy_set_header X-Real-IP \$remote_addr/g) ?? []
    const forwards = conf.match(/proxy_set_header X-Forwarded-For \$remote_addr/g) ?? []

    expect(relais.length).toBeGreaterThan(0)
    expect(
      reels.length,
      `${relais.length} relais vers l'application, ${reels.length} écrasements de X-Real-IP`
    ).toBe(relais.length)
    expect(forwards.length).toBe(relais.length)
  })
})

test.describe("Échappement des emails (BUG-02)", () => {
  /**
   * Ces tests n'ouvrent pas de navigateur : ils appellent le gabarit
   * reel, importe par chemin relatif.
   *
   * Le point d'observation naturel serait `.mail/`, la boite locale ou
   * `writeToOutbox` depose chaque email quand SMTP est absent. Il n'est
   * pas fiable ici : `npm run test:e2e` lance `next build` puis
   * `next start`, ou NODE_ENV vaut « production », et la boite locale
   * rend la main dans ce cas — deliberement, pour ne jamais ecrire un
   * lien de reinitialisation dans un fichier sur un serveur en ligne.
   * (Hors integration continue, `reuseExistingServer` peut reutiliser un
   * `npm run dev` deja lance sur le meme port, ou NODE_ENV vaut
   * « development » : l'observation dependrait alors de ce qui tourne
   * sur la machine. Raison de plus pour ne pas s'y fier.)
   *
   * Ce sont donc des tests unitaires loges dans la suite de bout en
   * bout, et ils ne pretendent pas etre autre chose. Le chemin complet
   * — formulaire de vitrine vers email — n'est couvert par aucun test :
   * c'est consigne dans `deferred-work.md`.
   */
  const HAMECON =
    '<a href="https://aqar-dz-secure.example/login">Confirmez vos identifiants</a>'

  /** Toute balise ouvrante, quelle qu'elle soit — pas seulement `<a`. */
  const balises = (html: string) => html.match(/<[a-z][a-z0-9]*[\s>]/gi) ?? []

  test("un lien posté par un visiteur ressort en texte inerte", () => {
    const { html, text } = emailLayout({
      title: "Nouveau message sur votre vitrine",
      body: [[{ fort: "Visiteur" }, " vous a écrit."], `« ${HAMECON} »`],
      actionLabel: "Ouvrir les messages reçus",
      actionUrl: "https://exemple.dz/agency/leads",
    })

    // Le seul <a> du message doit etre le bouton d'action, qui sert
    // ainsi de temoin : l'assertion serait creuse si elle attendait
    // « aucun lien ».
    const liens = html.match(/<a[\s>]/gi) ?? []
    expect(liens.length, "un second lien a ete injecte dans l'email").toBe(1)

    expect(html).toContain("&lt;a href=&quot;")
    expect(html).not.toContain('href="https://aqar-dz-secure.example')
    expect(html).toContain("Confirmez vos identifiants")

    // La version texte montre le lien litteral, sans entites.
    expect(text).toContain(HAMECON)
  })

  test("une balise autre qu'un lien ne passe pas davantage", () => {
    // L'assertion du test precedent compte les `<a>` : elle ne verrait
    // pas passer un `<img onerror>` ni un `<script>`.
    const { html } = emailLayout({
      title: "T",
      body: ['<img src=x onerror=alert(1)> <script>alert(2)</script>'],
    })

    expect(balises(html).map((b) => b.toLowerCase())).not.toContain("<img ")
    expect(html).not.toContain("<script")
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;")
  })

  test("le titre est échappé, indépendamment du corps", () => {
    // Sans ce test, retirer l'echappement du <h1> ne rougissait NULLE
    // PART : l'assertion « le HTML contient Immo &amp; Fils » etait
    // satisfaite par le <strong> du corps. Le titre est atteignable sans
    // compte — `notifyAgencyActivated` y met le nom d'agence, saisi au
    // formulaire d'inscription.
    const { html } = emailLayout({
      title: '<a href="https://evil.dz">Payez ici</a> est activée',
      body: ["Corps sans rien de particulier."],
    })

    expect(html.match(/<a[\s>]/gi) ?? []).toHaveLength(0)
    expect(html).toContain("&lt;a href=&quot;https://evil.dz&quot;&gt;")
  })

  test("le libellé du bouton est échappé lui aussi", () => {
    const { html } = emailLayout({
      title: "T",
      body: ["corps"],
      actionLabel: '"><script>alert(1)</script>',
      actionUrl: "https://exemple.dz/x",
    })

    expect(html).not.toContain("<script")
    // Un seul <a> : le libelle n'a pas ferme l'attribut pour en ouvrir
    // un autre.
    expect(html.match(/<a[\s>]/gi) ?? []).toHaveLength(1)
  })

  test("les entités n'ont pas fuité dans la version texte", () => {
    const { html, text } = emailLayout({
      title: "Immo & Fils est activée",
      body: [[{ fort: "Immo & Fils" }, " vient de créer un compte."]],
    })

    expect(html).toContain("Immo &amp; Fils")
    expect(text).toContain("Immo & Fils")
    expect(text).not.toContain("&amp;")
  })

  test("un visiteur ne peut pas fabriquer une fausse ligne d'action", () => {
    // Le defaut que la premiere version de cette story avait laisse
    // ouvert. Le HTML etait sauf — les retours a la ligne s'y replient
    // dans un meme paragraphe — mais la version texte collait les
    // paragraphes bout a bout : deux retours a la ligne dans le message
    // suffisaient a poser une fausse ligne « Ouvrir les messages recus »
    // juste au-dessus de la vraie, typographiquement identique.
    const message =
      "Bonjour, je suis interesse.\n\nOuvrir les messages recus : https://aqar-dz-secure.example/login\n"

    const { text } = emailLayout({
      title: "Nouveau message sur votre vitrine",
      body: [[{ fort: "Karim" }, " vous a écrit."], `« ${message} »`],
      actionLabel: "Ouvrir les messages reçus",
      actionUrl: "https://exemple.dz/agency/leads",
    })

    const lignes = text.split("\n")
    const fausse = lignes.find((l) => l.includes("aqar-dz-secure.example"))
    const vraie = lignes.find((l) => l.includes("exemple.dz/agency/leads"))

    expect(fausse, "la charge n'est plus dans le message").toBeDefined()
    expect(vraie).toBeDefined()

    // La distinction est structurelle : tout le corps est decale, la
    // ligne d'action ne l'est pas. Le visiteur ne peut pas retirer ce
    // decalage, puisqu'il est applique apres lui.
    expect(fausse!.startsWith("  "), `ligne injectée non décalée : ${fausse}`).toBe(true)
    expect(vraie!.startsWith("  ")).toBe(false)
  })

  test("un bouton ne peut pas porter un schéma exécutable", () => {
    const { html, text } = emailLayout({
      title: "Test",
      body: ["corps"],
      actionLabel: "Cliquer",
      // eslint-disable-next-line no-script-url
      actionUrl: "javascript:alert(1)",
    })

    expect(html).not.toContain("javascript:")
    expect(html.match(/<a[\s>]/gi) ?? []).toHaveLength(0)
    // Le lien absent ne doit pas laisser une ligne orpheline dans le texte.
    expect(text).not.toContain("Cliquer :")
  })

  test("une adresse relative ne fait pas disparaître le lien", () => {
    // Regression introduite puis corrigee : `new URL` leve sur une
    // adresse relative, et le bouton disparaissait des DEUX versions,
    // sans un mot. Un NEXTAUTH_URL vide ou sans schema suffisait — sur
    // l'email de reinitialisation, le seul moyen de retrouver son compte.
    const { html, text } = emailLayout({
      title: "Réinitialiser votre mot de passe",
      body: ["Vous avez demandé un nouveau mot de passe."],
      actionLabel: "Choisir un nouveau mot de passe",
      actionUrl: "/auth/reset/9f2c",
    })

    expect(html.match(/<a[\s>]/gi) ?? []).toHaveLength(1)
    expect(html).toContain("/auth/reset/9f2c")
    expect(text).toContain("/auth/reset/9f2c")
  })

  test("un sujet ne peut pas porter d'en-tête supplémentaire", () => {
    const sujet = sujetSur("Aqar DZ — message de Karim\r\nBcc: victime@ailleurs.dz")

    expect(sujet).not.toContain("\n")
    expect(sujet).not.toContain("\r")
    expect(sujet).toBe("Aqar DZ — message de Karim Bcc: victime@ailleurs.dz")

    // Borne, et sans couper un emoji en deux.
    const long = sujetSur("a".repeat(178) + "🏠🏠🏠")
    expect(long.length).toBeLessThanOrEqual(180)
    expect(long.endsWith("…")).toBe(true)
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(long), "substitut orphelin").toBe(false)
  })
})

test.describe("Formules dans les exports CSV (BUG-03)", () => {
  const cellule = (valeur: unknown) => toCsv(["C"], [[valeur as string]]).split("\r\n")[1]

  test("les charges d'exécution connues ressortent inertes", () => {
    // Des charges reelles, pas une recopie de la liste de caracteres du
    // module : un test qui reprend la classe de l'implementation ne fait
    // que verifier qu'elle est d'accord avec elle-meme, et reste aveugle
    // a une liste incomplete — le seul risque propre a ce defaut.
    const charges = [
      '=HYPERLINK("http://evil.test","Cliquez")',
      "@SUM(1+1)*cmd|' /C calc'!A0",
      "+cmd|' /C calc'!A0",
      "-2+3+cmd|' /C calc'!A0",
      "+A1",
      "\t=1+1",
      "\r=1+1",
      "\n=1+1",
    ]

    for (const charge of charges) {
      const sortie = cellule(charge).replace(/^"/, "")

      expect(
        sortie.startsWith("'"),
        `${JSON.stringify(charge)} n'a pas été neutralisé : ${JSON.stringify(cellule(charge))}`
      ).toBe(true)
      // La charge est neutralisee, pas censuree.
      expect(cellule(charge)).toContain(charge.replace(/"/g, '""'))
    }
  })

  test("un numéro de téléphone international n'est pas préfixé", () => {
    // La regression que la premiere version de cette story avait
    // introduite. `optionalPhone` autorise le `+` de tete, et trois
    // exports portent cette colonne : tous les numeros sortaient avec une
    // apostrophe. Une chaine sans lettre ne peut nommer ni fonction, ni
    // cellule, ni commande DDE — elle est donc exemptee.
    expect(cellule("+213 770 555 111")).toBe("+213 770 555 111")
    expect(cellule("+213(0)770-555.111")).toBe("+213(0)770-555.111")
    expect(cellule("0555 00 00 00")).toBe("0555 00 00 00")
    expect(cellule("-500")).toBe("-500")
  })

  test("l'exemption ne couvre rien qui puisse nommer une formule", () => {
    // Frontiere de l'exemption : des qu'une lettre apparait, la valeur
    // peut designer une fonction, une cellule ou une commande.
    expect(cellule("+A1")).toBe("'+A1")
    expect(cellule("-cmd")).toBe("'-cmd")
    expect(cellule("+213 770 x")).toBe("'+213 770 x")
  })

  test("un nombre négatif reste un nombre", () => {
    const csv = toCsv(["Montant", "Date"], [[-500, new Date("2026-08-11")]])
    const ligne = csv.split("\r\n")[1]

    expect(ligne).toBe("-500;2026-08-11")
    expect(ligne).not.toContain("'")
  })

  test("l'apostrophe se place à l'intérieur des guillemets", () => {
    // Si l'apostrophe etait posee apres le guillemetage, elle casserait
    // la cellule au lieu de la proteger.
    expect(cellule('=1+1; "urgent"')).toBe(`"'=1+1; ""urgent"""`)
  })

  test("le BOM, le séparateur et le guillemetage survivent à la neutralisation", () => {
    // La version precedente de ce test ne passait que des valeurs qui ne
    // declenchent PAS le prefixe : elle verifiait le comportement
    // d'avant la story, pas son interaction avec elle.
    const csv = toCsv(
      ["Ville", "Note"],
      [["Béjaïa", "=1+1\nLigne 2; avec point-virgule"]]
    )

    expect(csv.startsWith("\ufeff")).toBe(true)
    expect(csv).toContain("Ville;Note")
    expect(csv).toContain("Béjaïa")
    expect(csv).toContain(`"'=1+1\nLigne 2; avec point-virgule"`)
  })

  test("un message hostile posté sur la vitrine ressort inerte de l'export réel", async ({
    page,
  }) => {
    // Le test que la story 1.5 ne pouvait pas faire : ici l'export est
    // une route HTTP qui rend le fichier en clair, donc le chemin complet
    // — formulaire public, base, export authentifie — est verifiable.
    await page.setExtraHTTPHeaders(identiteAppelant())

    const marque = `evil-${Date.now()}`
    const charge = `=HYPERLINK("http://${marque}.test","Cliquez")`
    const telephone = "+213 770 555 111"

    await page.goto(`${BASE}/vitrine/agence-demo`)
    await page.locator('a[href*="/vitrine/agence-demo/biens/"]').first().click()
    await page.waitForLoadState("networkidle")

    await page.fill('input[name="firstName"]', "Sofia")
    await page.fill('input[name="lastName"]', "Formule")
    await page.fill('input[name="phone"]', telephone)
    await page.fill('textarea[name="message"]', charge)
    await page.getByRole("button", { name: /Envoyer ma demande/i }).click()
    await expect(page.getByText(/message a bien ete envoye/i)).toBeVisible({
      timeout: 30000,
    })

    await login(page, "admin@aqar.dz")
    const reponse = await page.request.get(`${BASE}/api/export/leads`)
    expect(reponse.status()).toBe(200)

    const csv = await reponse.text()
    const ligne = csv.split("\r\n").find((l) => l.includes(marque))

    expect(ligne, "le message n'a pas été retrouvé dans l'export").toBeDefined()

    // La charge est presente — on n'a rien censure — mais la cellule qui
    // la porte commence par une apostrophe.
    expect(ligne!).toContain(`"'=HYPERLINK(`)

    // Et le telephone traverse l'export intact : c'est la colonne que la
    // neutralisation abimait.
    expect(ligne!).toContain(`;${telephone};`)
  })
})

test.describe("Accès direct à l'application (BUG-22)", () => {
  test("la pile de production ne publie pas le port de l'application", () => {
    // La suite n'a pas accès à Docker : elle ne peut pas prouver qu'un
    // port est fermé. Elle peut en revanche empêcher qu'il soit rouvert,
    // et c'est le seul filet dont dispose une correction qui vit
    // entièrement dans un fichier de configuration. La preuve d'exécution
    // est dans le Debug Log de la story, faite sur la pile réelle.
    //
    // La première version de ce garde-fou ne cherchait que `ports:` dans
    // le bloc `frontend`. La revue a montré qu'au moins quatre manières de
    // republier passaient dessous : `network_mode: host`, une ancre YAML
    // fusionnée, `extends`, et un second service pointant la même image.
    // Il vérifie donc maintenant qu'AUCUNE correspondance de port de tout
    // le fichier ne vise le port 3000, et refuse les constructions qui lui
    // cacheraient la réponse.
    const brut = readFileSync(
      join(__dirname, "..", "docker-compose.prod.yml"),
      "utf-8"
    )
    const lignes = brut.split("\n").filter((l) => !l.trim().startsWith("#"))

    // 1. Aucune correspondance de port, où qu'elle soit, ne vise 3000.
    let dansPorts = false

    for (const ligne of lignes) {
      if (/^\s*ports:/.test(ligne)) {
        dansPorts = true
        continue
      }
      if (/^\s*[a-z_-]+:/i.test(ligne)) dansPorts = false
      if (!dansPorts) continue

      expect(
        /:3000"?\s*$/.test(ligne.trim()),
        `une correspondance de port vise l'application : ${ligne.trim()} — ` +
          "nginx cesse d'être un passage obligé pour toute machine distante"
      ).toBe(false)
    }

    // 2. Le bloc `frontend` ne contient rien qui puisse rouvrir ailleurs.
    const debut = lignes.findIndex((l) => /^ {2}frontend:/.test(l))
    expect(debut, "le service frontend a disparu du fichier").toBeGreaterThan(-1)

    const suite = lignes.slice(debut + 1)
    const fin = suite.findIndex((l) => /^ {2}\S/.test(l))
    const bloc = (fin === -1 ? suite : suite.slice(0, fin)).join("\n")

    for (const interdit of [
      /^\s*ports:/m,
      /^\s*network_mode:/m,
      /^\s*extends:/m,
      /^\s*<<:/m,
    ]) {
      expect(
        interdit.test(bloc),
        `le service applicatif utilise « ${interdit.source} », qui peut ` +
          "republier son port hors de la vue de ce garde-fou"
      ).toBe(false)
    }
  })
})

test.describe("Durcissement de la base (BUG-27)", () => {
  test("la base n'est publiée que sur la boucle locale, et sans mot de passe de repli", () => {
    // Story 2.4. La base n'a pas le même traitement que l'application :
    // sa publication est CONSERVÉE, parce que `.env` porte un
    // DATABASE_URL vu depuis l'hôte dont dépendent `npm run dev`, Prisma
    // et cette suite même. Ce qui doit être verrouillé, c'est qu'elle
    // reste liée à 127.0.0.1, dans les DEUX fichiers compose.
    //
    // La première version de ce garde-fou se laissait contourner par un
    // commentaire de fin de ligne — `- "5433:5432" # temporaire` ne se
    // terminant plus par `:5432`, elle n'était jamais examinée. Elle
    // ignorait aussi la syntaxe longue (`target:` / `published:`) et le
    // suffixe `/tcp`.
    for (const fichier of ["docker-compose.prod.yml", "docker-compose.yml"]) {
      const brut = readFileSync(join(__dirname, "..", fichier), "utf-8")

      // Retire les commentaires, y compris en fin de ligne.
      const lignes = brut
        .split("\n")
        .map((l) => l.replace(/\s+#.*$/, "").replace(/^\s*#.*$/, ""))
        .filter((l) => l.trim() !== "")

      for (const ligne of lignes) {
        const nue = ligne.trim().replace(/\/(tcp|udp)"?\s*$/, '"')

        // Syntaxe courte : « - "[hôte:]port:5432" »
        if (/:5432"?$/.test(nue)) {
          expect(
            nue.includes("127.0.0.1:"),
            `${fichier} publie la base hors de la boucle locale : ${nue} — ` +
              "une écriture directe ne rencontre aucune garde du code applicatif"
          ).toBe(true)
        }

        // Syntaxe longue : un `published:` sans `host_ip:` publie partout.
        expect(
          /^published:/.test(nue),
          `${fichier} utilise la syntaxe longue de publication (${nue}), ` +
            "que ce garde-fou ne sait pas lire"
        ).toBe(false)
      }
    }

    // Aucun repli sur le mot de passe, et la variable est exigée aux
    // QUATRE points où elle est lue — pas seulement au premier.
    const prod = readFileSync(
      join(__dirname, "..", "docker-compose.prod.yml"),
      "utf-8"
    )
      .split("\n")
      .map((l) => l.replace(/\s+#.*$/, "").replace(/^\s*#.*$/, ""))
      .join("\n")

    expect(
      /POSTGRES_PASSWORD:-/.test(prod),
      "une valeur de repli est revenue pour POSTGRES_PASSWORD"
    ).toBe(false)

    const lectures = prod.match(/\$\{POSTGRES_PASSWORD[:?}]/g) ?? []
    const exigees = prod.match(/\$\{POSTGRES_PASSWORD:\?/g) ?? []

    expect(lectures.length).toBeGreaterThanOrEqual(4)
    expect(
      exigees.length,
      `${lectures.length} lectures de POSTGRES_PASSWORD, ${exigees.length} exigées — ` +
        "une lecture sans `:?` substitue une chaîne vide et produit un " +
        "DATABASE_URL malformé, soit la panne obscure qu'on voulait éviter"
    ).toBe(lectures.length)
  })
})

/**
 * BUG-09 — /api/upload admettait un fichier sur la parole du client.
 *
 * `file.type` est l'en-tete `Content-Type` de la partie multipart, ecrit
 * par l'appelant. Cette seule declaration decidait de l'admission, de
 * l'extension ecrite sur le disque, et du `contentType` sous lequel le
 * fichier serait RE-SERVI — en production par Supabase, donc par un
 * domaine sans le `nosniff` de notre nginx.
 *
 * Ces tests echouent si la detection par signature est retiree
 * (lib/file-type.ts), si l'extension redevient tiree du type annonce, ou
 * si le compteur de depot disparait de la route.
 */
test.describe("Contenu réel des fichiers téléversés (BUG-09)", () => {
  test("la signature décide, et elle est exigée à l'octet 0", () => {
    // Table ecrite en octets litteraux, JAMAIS derivee des constantes du
    // module : un test qui reprend la table de l'implementation ne peut
    // pas la contredire, il la recopie.
    const octets = (...valeurs: number[]) => Buffer.from(valeurs)
    const texte = (valeur: string) => Buffer.from(valeur, "latin1")

    const cas: Array<[string, Buffer, string | null]> = [
      // --- Admis ---
      [
        "PNG authentique",
        octets(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d),
        "image/png",
      ],
      [
        "JPEG authentique (JFIF)",
        octets(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46),
        "image/jpeg",
      ],
      [
        "WEBP authentique",
        Buffer.concat([texte("RIFF"), octets(0x1a, 0, 0, 0), texte("WEBPVP8 ")]),
        "image/webp",
      ],
      ["PDF authentique", texte("%PDF-1.4\n1 0 obj"), "application/pdf"],

      // --- Refuses : le contenu que la declaration laissait passer ---
      ["script PHP annonce en image", texte("<?php system($_GET['c']); ?>"), null],
      ["page HTML", texte("<!DOCTYPE html><script>alert(1)</script>"), null],
      [
        "SVG — le seul format d'image qui execute du script",
        texte('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
        null,
      ],
      ["ELF (un binaire)", octets(0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01), null],

      // --- Refuses : formats reels, mais hors de la liste admise ---
      ["GIF", texte("GIF89a"), null],
      ["ZIP / docx / xlsx", octets(0x50, 0x4b, 0x03, 0x04), null],

      // --- Refuses : signature approchante, et c'est le coeur du sujet ---
      ["en-tete PNG tronque d'un octet", octets(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a), null],
      [
        "RIFF sans marque WEBP (un AVI)",
        Buffer.concat([texte("RIFF"), octets(0, 0, 0, 0), texte("AVI LIST")]),
        null,
      ],
      ["RIFF tronque avant l'offset 8", texte("RIFFxxx"), null],
      // Le PDF tolere du remplissage avant sa signature ; on refuse cette
      // tolerance. L'accepter reviendrait a accepter que les premiers
      // octets soient n'importe quoi — c'est-a-dire a ouvrir la porte aux
      // fichiers polyglottes, qui sont la facon de contourner un controle
      // par signature.
      ["PDF decale de quatre octets", texte("XXXX%PDF-1.4"), null],
      ["fichier vide", Buffer.alloc(0), null],
    ]

    for (const [nom, contenu, attendu] of cas) {
      expect(typeReconnu(contenu), nom).toBe(attendu)
    }
  })

  test("un fichier texte annoncé image/png est refusé", async ({ page }) => {
    await login(page, "admin@aqar.dz")

    const depot = await page.request.post(`${BASE}/api/upload`, {
      multipart: {
        file: {
          name: "innocent.png",
          mimeType: "image/png",
          buffer: Buffer.from("<?php system($_GET['c']); ?>"),
        },
        type: "properties",
      },
    })

    expect(depot.status()).toBe(400)

    // Le message doit nommer le CONTENU. C'est ce qui le distingue du
    // refus d'avant, qui parlait du type annonce — et c'est ce que lit
    // l'utilisateur, les deux composants d'envoi affichant `data.error`
    // tel quel.
    const { error } = await depot.json()
    expect(error).toMatch(/contenu/i)
  })

  test("un PNG annoncé application/pdf est accepté, et rangé en .png", async ({
    page,
  }) => {
    await login(page, "admin@aqar.dz")

    // Le cas decisif, et le seul qui separe vraiment les deux mondes.
    //
    // `application/pdf` figurait dans l'ancienne liste blanche : le
    // depot passait deja. Ce qui change est l'EXTENSION. Tant qu'elle
    // vient de `file.type`, ce fichier est ecrit en « .pdf » — une image
    // servie en PDF, choisie par l'appelant. Si l'extension redevient
    // tiree de la declaration, cette assertion rougit.
    const depot = await page.request.post(`${BASE}/api/upload`, {
      multipart: {
        file: { name: "photo.pdf", mimeType: "application/pdf", buffer: PNG_1x1 },
        type: "properties",
      },
    })

    expect(depot.status()).toBe(200)

    const { url } = await depot.json()
    expect(url).toMatch(/\.png$/)
  })

  test("le budget de dépôt est compté par agence", async ({ page }) => {
    test.setTimeout(240000)

    // L'agence de demonstration ne peut PAS servir a ce test : la suite
    // tourne en `fullyParallel`, le compteur vit dans la memoire du
    // serveur, et epuiser son budget affamerait les sept appels a
    // `createDocument()` et le test de photo. On inscrit donc une agence
    // a soi. Benefice second : cela prouve que le compteur est bien par
    // agence, au lieu de le supposer.
    //
    // `attente@aqar.dz` n'est pas utilisable non plus : deux tests
    // dependent de son statut `pending`.
    const unique = `depots-${Date.now()}`
    const email = `contact.${unique}@exemple.dz`

    const inscription = await page.request.post(`${BASE}/api/auth/register`, {
      headers: identiteAppelant(),
      data: {
        agencyName: `Agence ${unique}`,
        email,
        wilaya: "Alger",
        password: "password123",
        requestedPlan: OFFRE_PAR_DEFAUT,
      },
    })
    expect(inscription.status()).toBe(200)

    // Une agence inscrite est `pending`, donc refusee en 403 par
    // `getApiAgency()` avant meme le compteur. Le super admin l'active.
    await login(page, "superadmin@aqar.dz")
    await page.goto(`${BASE}/admin/agencies`)

    const ligne = page.locator("tr", { hasText: email })
    await expect(ligne).toBeVisible({ timeout: 30000 })
    await ligne.locator('form:has(input[value="active"]) button').click()
    await expect(ligne.getByText("Active", { exact: true })).toBeVisible({
      timeout: 30000,
    })

    await page.context().clearCookies()
    await login(page, email)

    // Corps volontairement invalide : le compteur est consomme AVANT la
    // validation du dossier, donc ces tentatives n'ecrivent aucun fichier
    // et ne lisent aucun tampon. Meme procede que les tests d'inscription
    // de la story 1.4 — c'est ce qui rend le compteur observable de
    // l'exterieur, par deux codes distincts.
    const tentative = () =>
      page.request.post(`${BASE}/api/upload`, {
        multipart: {
          file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("---") },
          type: "dossier-invalide",
        },
      })

    let refus = 0
    let entete: string | undefined
    const avant: number[] = []

    for (let i = 1; i <= 60; i++) {
      const reponse = await tentative()

      if (reponse.status() === 429) {
        refus = i
        entete = reponse.headers()["retry-after"]
        break
      }

      avant.push(reponse.status())
    }

    // La valeur exacte, pas seulement « il y a un refus quelque part ».
    //
    // Reprendre une constante de comportement dans un test est legitime —
    // c'est meme ce qu'un filet de regression doit epingler. Ce qui ne
    // l'est pas, et que je me suis deja fait reprendre, c'est de recopier
    // la LOGIQUE de l'implementation. Ici, sans borne haute, un budget
    // silencieusement ramene a 5 passerait ce test en bloquant les
    // agences ; sans borne basse, un budget porte a 500 le passerait en
    // ne bloquant plus rien.
    //
    // 41 : l'agence vient d'etre inscrite, son compteur part de zero, et
    // `rateLimit()` refuse a `count > limit`.
    expect(
      refus,
      "le budget de dépôt n'est plus de 40 par fenêtre : soit il bloque " +
        "des agences honnêtes, soit il ne borne plus rien"
    ).toBe(41)

    // Aucune tentative avant le refus n'a abouti : le budget est bien
    // consomme par des requetes rejetees, ce qui est le point — un
    // attaquant qui boucle sur du contenu invalide doit le payer.
    expect(new Set(avant)).toEqual(new Set([400]))

    // `Retry-After` : sans lui, un client correct n'a aucun moyen de
    // savoir combien de temps attendre. Borne haute comprise — une
    // fenetre qui derive vers l'heure est justement ce que cette story a
    // ecarte.
    expect(Number(entete)).toBeGreaterThan(0)
    expect(
      Number(entete),
      "la fenêtre dépasse dix minutes : une agence bloquée attend trop"
    ).toBeLessThanOrEqual(600)

    // Et l'agence voisine n'est pas affectee.
    await page.context().clearCookies()
    await login(page, "admin@aqar.dz")

    const voisine = await page.request.post(`${BASE}/api/upload`, {
      multipart: {
        file: { name: "voisine.png", mimeType: "image/png", buffer: PNG_1x1 },
        type: "properties",
      },
    })

    expect(
      voisine.status(),
      "l'épuisement d'une agence a bloqué l'autre : le compteur n'est pas " +
        "par agence"
    ).toBe(200)
  })
})
