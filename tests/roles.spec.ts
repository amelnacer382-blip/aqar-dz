import { test, expect, Page } from "@playwright/test"
import { randomBytes } from "crypto"
import { hash } from "bcryptjs"
import { db } from "./db"
import { creerAgence, effacerAgence, garnir, type Agence } from "./agence"
import { login } from "./auth-helper"

/**
 * Separation des roles (story 4.3).
 *
 * Contrairement au cloisonnement, ce n'etait pas un angle mort total :
 * `features.spec.ts` couvrait deja six routes de suppression sur huit et
 * UN des cinq ecrans reserves. Ce fichier complete, et ajoute trois
 * proprietes que rien ne verifiait.
 *
 * LE CONTROLE POSITIF EST OBLIGATOIRE, et c'est la revue de la story 4.2
 * qui l'a impose : vingt-quatre assertions de refus passent tout aussi
 * bien quand la route est cassee pour TOUT LE MONDE. Chaque refus
 * attendu d'un agent est donc double d'un succes constate d'un
 * administrateur sur la meme adresse.
 */

const SUPPRESSIONS = [
  "properties",
  "clients",
  "owners",
  "documents",
  "payments",
  "visits",
  "sales",
  "rentals",
]

/**
 * Les cinq ecrans qui appellent `requireAgencyAdmin()`.
 *
 * Releves dans le code (`grep -rl requireAgencyAdmin app/agency`), pas
 * choisis : la liste de la story 4.1 a montre ce que vaut une table
 * ecrite de memoire.
 */
const ECRANS_RESERVES = [
  "/agency/users",
  "/agency/settings",
  "/agency/showcase",
  "/agency/trash",
  "/agency/audit",
]

const REFUS = "Action réservée à l'administrateur de l'agence"

/**
 * Le motif affiche a un compte dont l'acces vient d'etre coupe.
 *
 * Asserte, et pas seulement l'adresse `/auth/login` : les trois assertions
 * d'ejection de la story 1.8 se contentaient de l'URL, si bien que
 * remplacer `redirect(refusDeCompte(...))` par `redirect("/auth/login")`
 * laissait la suite verte — alors que le registre affirme que le motif
 * s'affiche. Une promesse qu'aucun test ne tient est une promesse qui
 * disparaitra au prochain refactoring.
 *
 * Seule la premiere phrase est commune aux deux recours (agence, editeur) :
 * c'est donc elle qu'on cherche.
 */
const MOTIF_DESACTIVE = "Votre compte utilisateur a été désactivé"

/**
 * Decors a effacer APRES le cas, y compris quand il a depasse son delai.
 *
 * `try/finally` ne suffit pas. Quand Playwright depasse le delai d'un cas,
 * il interrompt le corps du test : le `finally` ne s'execute jamais. Or ce
 * fichier cree des comptes `super_admin` jetables, et le delai est
 * REALISTE — bcrypt cout 12, un seul processus serveur, quatre
 * travailleurs. Un depassement laissait donc un compte de console editeur
 * a mot de passe connu, definitivement, dans toute base durable.
 *
 * `afterEach` est le mecanisme prevu pour cela : Playwright l'execute avec
 * son propre budget de temps, meme apres un depassement.
 */
const decorsJetables: Array<() => Promise<void>> = []

test.afterEach(async () => {
  while (decorsJetables.length > 0) {
    const effacer = decorsJetables.pop()!
    // Un decor qui refuse de partir ne doit pas masquer le resultat du cas.
    await effacer().catch(() => {})
  }
})

async function avecAgence(
  roles: Array<"agency_admin" | "agent">,
  travail: (agence: Agence) => Promise<void>
) {
  const agence = await creerAgence(roles)
  const filet = () => effacerAgence(agence)
  decorsJetables.push(filet)

  try {
    await travail(agence)
  } finally {
    await effacerAgence(agence)
    // Retirer CE filet, pas le dernier posé : le travail a pu en empiler
    // d'autres par-dessus (un éditeur jetable, par exemple), et un `pop()`
    // aveugle les effacerait de la liste sans les exécuter.
    const rang = decorsJetables.indexOf(filet)
    if (rang !== -1) decorsJetables.splice(rang, 1)
  }
}

/**
 * Un compte d'editeur jetable, actif, au mot de passe imprevisible.
 *
 * `superadmin@aqar.dz` est partage par toute la suite : le desactiver ou le
 * retrograder la casserait. Et le mot de passe n'est PAS `password123` :
 * si un jour ce compte survivait malgre `afterEach`, il vaut mieux qu'il
 * survive avec un secret que personne ne connait.
 */
async function editeurJetable(agencyId: string | null = null) {
  const email = `editeur-jetable-${Date.now()}-${Math.floor(
    Math.random() * 100000
  )}@aqar.invalid`
  const motDePasse = randomBytes(24).toString("hex")

  const compte = await db.user.create({
    data: {
      email,
      name: "Éditeur jetable",
      password: await hash(motDePasse, 12),
      role: "super_admin",
      isActive: true,
      agencyId,
    },
  })

  decorsJetables.push(async () => {
    await db.user.deleteMany({ where: { id: compte.id } })
  })

  return { compte, email, motDePasse }
}

test.describe("Séparation des rôles", () => {
  test("un agent est refusé sur les huit routes de suppression, un administrateur passe", async ({
    page,
  }) => {
    test.setTimeout(180000)

    await login(page, "agent@aqar.dz")

    for (const entite of SUPPRESSIONS) {
      const reponse = await page.request.post(
        `/api/${entite}/inexistant/delete`,
        { failOnStatusCode: false }
      )

      expect
        .soft(reponse.status(), `/api/${entite}/[id]/delete doit refuser un agent`)
        .toBe(403)
    }

    // Le contrôle. 404 et non 403 : le rôle est accepté, c'est
    // l'identifiant qui n'existe pas. C'est ce qui distingue « interdit »
    // de « introuvable » — et ce qui prouve que les huit refus ci-dessus
    // viennent du rôle, pas d'une route morte.
    await page.context().clearCookies()
    await login(page, "admin@aqar.dz")

    for (const entite of SUPPRESSIONS) {
      const reponse = await page.request.post(
        `/api/${entite}/inexistant/delete`,
        { failOnStatusCode: false }
      )

      expect
        .soft(
          reponse.status(),
          `/api/${entite}/[id]/delete doit accepter un administrateur`
        )
        .toBe(404)
    }
  })

  test("un agent est renvoyé des cinq écrans réservés, avec le motif affiché", async ({
    page,
  }) => {
    test.setTimeout(180000)

    await login(page, "agent@aqar.dz")

    for (const ecran of ECRANS_RESERVES) {
      await page.goto(ecran)

      await page.waitForURL((url) => !url.pathname.startsWith(ecran), {
        timeout: 30000,
      })

      expect.soft(page.url(), `${ecran} reste accessible à un agent`).not.toContain(
        ecran
      )

      // Le message AFFICHE, pas celui de l'URL.
      //
      // C'est toute la difference : le motif etait bien pose en
      // parametre, et le tableau de bord ne le lisait pas. Chercher la
      // chaine dans `page.url()` aurait donc passe alors meme que l'agent
      // ne voyait rien — le defaut exact que cette story corrige.
      await expect
        .soft(
          page.getByText(REFUS),
          `${ecran} : l'agent est renvoyé sans qu'on lui dise pourquoi`
        )
        .toBeVisible({ timeout: 15000 })
    }

    // Le contrôle : les cinq écrans existent et répondent à qui de droit.
    await page.context().clearCookies()
    await login(page, "admin@aqar.dz")

    for (const ecran of ECRANS_RESERVES) {
      const reponse = await page.goto(ecran)

      expect
        .soft(reponse?.status(), `${ecran} refuse aussi l'administrateur`)
        .toBe(200)
      expect
        .soft(page.url(), `${ecran} renvoie aussi l'administrateur`)
        .toContain(ecran)
    }
  })

  test("un administrateur d'agence ne peut pas créer de super admin", async ({
    page,
  }) => {
    test.setTimeout(180000)

    await login(page, "admin@aqar.dz")
    await page.goto("/agency/users")

    const email = `super-tente-${Date.now()}@aqar.dz`

    await page.fill("#name", "Tentative")
    await page.fill("#email", email)
    await page.fill("#password", "password123")

    // Ajouter l'option au DOM avant de soumettre. Ce n'est pas un
    // artifice : c'est exactement ce qu'un utilisateur fait depuis la
    // console de son navigateur, et c'est pour cela que la validation
    // doit vivre au serveur.
    //
    // `#role` et non `[name="role"]` : la page porte AUTANT de champs
    // « role » que de comptes affiches — un par ligne, pour le changement
    // de role — et le premier trouve etait celui d'une ligne, pas celui du
    // formulaire de creation. Le test echouait alors sur un ecran ou rien
    // n'avait ete tente.
    await page.evaluate(() => {
      const champ = document.querySelector("#role") as HTMLSelectElement | null

      if (!champ) throw new Error("champ de rôle du formulaire introuvable")

      const option = document.createElement("option")
      option.value = "super_admin"
      option.textContent = "super_admin"
      champ.appendChild(option)
      champ.value = "super_admin"
    })

    await page.click('button:has-text("Créer le compte")')
    await page.waitForURL(/\/agency\/users\?(error|success)=/, { timeout: 30000 })

    // `soft` : sur une assertion dure, la verification en base ci-dessous
    // ne s'executerait jamais quand celle-ci echoue — or c'est ELLE qui
    // dit si un super admin a reellement ete cree. Mesure : la mutation
    // qui elargit le schema faisait rougir le message et taisait la base.
    await expect
      .soft(page.getByText(/Rôle inconnu/i), "aucun refus affiché")
      .toBeVisible({ timeout: 15000 })

    // La vérification qui compte : le message peut mentir, la base non.
    const cree = await db.user.count({ where: { email } })

    // Nettoyage inconditionnel. Sur le chemin vert, aucun compte n'est
    // cree et cette ligne ne fait rien ; le jour ou la garde saute, elle
    // evite qu'un super admin reste en base apres un test rouge. Constate
    // en posant la mutation : trois comptes `super_admin` y ont survecu.
    await db.user.deleteMany({ where: { email } })

    expect(cree, "un compte a été créé malgré le refus affiché").toBe(0)
  })

  test("l'éditeur ne peut pas désactiver le dernier administrateur d'une agence", async ({
    page,
  }) => {
    test.setTimeout(240000)

    // Sur son agence a lui, jamais sur celle de demonstration :
    // `admin@aqar.dz` en est le seul administrateur actif, et le
    // desactiver casserait la moitie de la suite.
    await avecAgence(["agency_admin", "agent"], async (agence) => {
      const admin = await db.user.findFirstOrThrow({
        where: { agencyId: agence.agence.id, role: "agency_admin" },
      })
      const agent = await db.user.findFirstOrThrow({
        where: { agencyId: agence.agence.id, role: "agent" },
      })

      await login(page, "superadmin@aqar.dz")

      // Le contrôle d'abord : l'agent, lui, se désactive sans obstacle.
      // Sans cette moitié, un formulaire cassé donnerait le même vert que
      // le garde qu'on veut prouver.
      await desactiver(page, agent.email, agent.id)

      expect(
        (await db.user.findUnique({ where: { id: agent.id } }))?.isActive,
        "la désactivation d'un agent ne fonctionne plus : le refus ci-dessous " +
          "ne prouverait alors rien"
      ).toBe(false)

      // Puis le dernier administrateur actif de cette agence.
      await desactiver(page, admin.email, admin.id)

      // `soft` ici aussi : sur une assertion dure, la relecture en base
      // ne s'executerait pas quand le message manque — or c'est elle qui
      // dit si le compte a ete desactive pour de bon.
      await expect
        .soft(page.getByText(/dernier administrateur actif/i), "aucun refus affiché")
        .toBeVisible({ timeout: 15000 })

      expect(
        (await db.user.findUnique({ where: { id: admin.id } }))?.isActive,
        "le dernier administrateur de l'agence a été désactivé"
      ).toBe(true)
    })
  })

})

/**
 * Revocation d'un acces a chaud (story 1.8, BUG-33).
 *
 * Les trois tests precedents eprouvent la separation des roles a l'instant
 * de la connexion. Ceux-ci eprouvent autre chose, et c'est une propriete
 * distincte : ce qui se passe quand la decision d'acces CHANGE pendant
 * qu'une session est ouverte.
 *
 * Les gardes revérifiaient l'agence a chaque requete et jamais
 * l'utilisateur : `isActive` n'etait lu qu'a la connexion, le role et
 * l'agence venaient du jeton. Desactiver un compte ne lui retirait donc
 * aucun acces pendant jusqu'a trente jours — alors que l'ecran affichait
 * « Compte désactivé » et que le journal d'audit l'enregistrait.
 *
 * LA DESACTIVATION EST POSEE EN BASE, PAS PAR L'INTERFACE. Ce qu'on
 * eprouve ici est la garde, pas l'ecran : passer par la console d'un
 * administrateur demanderait une seconde session et ajouterait un
 * intermediaire entre la cause et l'effet. `tests/db.ts` ecrit la ligne,
 * la garde doit la lire.
 *
 * JAMAIS SUR LES COMPTES DU SEED. La suite tourne `fullyParallel` :
 * desactiver `agent@aqar.dz` casserait les cas voisins qui s'y connectent.
 * Chaque test travaille dans une agence jetable, ou sur un compte
 * d'editeur cree pour lui seul.
 */
test.describe("Révocation d'un accès à chaud (BUG-33)", () => {
  test("un compte désactivé pendant sa session est éjecté à la requête suivante", async ({
    page,
  }) => {
    test.setTimeout(240000)

    await avecAgence(["agency_admin", "agent"], async (agence) => {
      const agent = await db.user.findFirstOrThrow({
        where: { agencyId: agence.agence.id, role: "agent" },
      })

      await login(page, agent.email)

      // LE CONTROLE POSITIF, et il vient en premier.
      //
      // Sans lui, les trois refus ci-dessous passeraient tout aussi bien
      // sur un compte qui n'a jamais rien pu ouvrir — c'est-a-dire sur un
      // decor casse. Imposé par la revue de la story 4.2.
      const avantPage = await page.goto("/agency/clients")
      expect
        .soft(avantPage?.status(), "le compte n'accède pas à sa liste de clients")
        .toBe(200)
      expect
        .soft(page.url(), "le compte est renvoyé avant même d'être désactivé")
        .toContain("/agency/clients")

      const avantApi = await page.request.get("/api/export/clients", {
        failOnStatusCode: false,
      })
      expect
        .soft(avantApi.status(), "l'export refuse un compte actif")
        .toBe(200)

      // Le formulaire est charge MAINTENANT, pendant que le compte est
      // encore actif : c'est la situation reelle qu'on veut eprouver —
      // quelqu'un a l'ecran ouvert quand son acces est coupe.
      await page.goto("/agency/owners/new")
      await page.fill("#firstName", "Revocation")
      await page.fill("#lastName", `Test-${Date.now()}`)

      // La coupure.
      await db.user.update({
        where: { id: agent.id },
        data: { isActive: false },
      })

      // 1. La Server Action : `requireAgency()` est sa premiere ligne.
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/auth\/login/, { timeout: 30000 })
      expect(
        page.url(),
        "la Server Action a accepté un compte désactivé"
      ).toContain("/auth/login")

      // Rien n'a ete ecrit : la garde s'arrete avant `parseForm`.
      const cree = await db.owner.count({
        where: { agencyId: agence.agence.id, firstName: "Revocation" },
      })
      expect(cree, "un propriétaire a été créé par un compte désactivé").toBe(0)

      // 2. Une page de l'espace agence.
      await page.goto("/agency/clients")
      await page.waitForURL(/\/auth\/login/, { timeout: 30000 })
      expect(
        page.url(),
        "une page d'agence reste ouverte à un compte désactivé"
      ).toContain("/auth/login")

      // Et le MOTIF s'affiche. Sans cette assertion, remplacer
      // `refusDeCompte()` par un `/auth/login` nu laisse la suite verte,
      // et l'utilisateur devant un ecran de connexion qui ne dit pas
      // pourquoi il y est revenu.
      await expect(
        page.getByText(MOTIF_DESACTIVE),
        "aucun motif affiché au compte désactivé"
      ).toBeVisible({ timeout: 15000 })

      // 3. Une route d'API — 401 JSON, pas du HTML de page de connexion.
      const apresApi = await page.request.get("/api/export/clients", {
        failOnStatusCode: false,
      })
      expect(
        apresApi.status(),
        "l'export répond encore à un compte désactivé"
      ).toBe(401)
    })
  })

  test("une rétrogradation prend effet sans reconnexion", async ({ page }) => {
    test.setTimeout(240000)

    await avecAgence(["agency_admin", "agent"], async (agence) => {
      const admin = await db.user.findFirstOrThrow({
        where: { agencyId: agence.agence.id, role: "agency_admin" },
      })

      await login(page, admin.email)

      // Contrôle positif : l'administrateur passe, sur les deux surfaces.
      const avant = await page.goto("/agency/users")
      expect
        .soft(avant?.status(), "l'administrateur n'accède pas à ses comptes")
        .toBe(200)
      expect.soft(page.url(), "l'administrateur est renvoyé").toContain(
        "/agency/users"
      )

      // 404 et non 403 : le role est accepte, c'est l'identifiant qui
      // n'existe pas. C'est ce qui distingue « interdit » de
      // « introuvable ».
      const avantApi = await page.request.post("/api/clients/inexistant/delete", {
        failOnStatusCode: false,
      })
      expect
        .soft(avantApi.status(), "la suppression refuse un administrateur")
        .toBe(404)

      // La rétrogradation.
      await db.user.update({ where: { id: admin.id }, data: { role: "agent" } })

      // L'écran réservé le renvoie, avec le motif affiché.
      await page.goto("/agency/users")
      await page.waitForURL((url) => !url.pathname.startsWith("/agency/users"), {
        timeout: 30000,
      })
      await expect
        .soft(page.getByText(REFUS), "aucun motif affiché après rétrogradation")
        .toBeVisible({ timeout: 15000 })

      // Et la route d'API le refuse : 403, le rôle n'est plus le bon.
      const apresApi = await page.request.post("/api/clients/inexistant/delete", {
        failOnStatusCode: false,
      })
      expect(
        apresApi.status(),
        "la route de suppression lit encore le rôle du jeton"
      ).toBe(403)
    })
  })

  test("un super admin désactivé perd la console de l'éditeur", async ({
    page,
  }) => {
    test.setTimeout(240000)

    const { compte, email, motDePasse } = await editeurJetable()

    await login(page, email, motDePasse)

    // Contrôle positif : `requireSuperAdmin()` n'interrogeait pas la
    // base du tout — c'est le seul chemin où le compte n'était vérifié à
    // AUCUN moment après la connexion.
    const avant = await page.goto("/admin/agencies")
    expect.soft(avant?.status(), "l'éditeur n'accède pas à sa console").toBe(200)
    expect.soft(page.url(), "l'éditeur est renvoyé de sa console").toContain(
      "/admin/agencies"
    )

    await db.user.update({
      where: { id: compte.id },
      data: { isActive: false },
    })

    await page.goto("/admin/agencies")
    await page.waitForURL(/\/auth\/login/, { timeout: 30000 })
    expect(
      page.url(),
      "la console de l'éditeur reste ouverte à un compte désactivé"
    ).toContain("/auth/login")

    // Le motif, et celui des DEUX : un éditeur n'a pas d'agence, on ne
    // l'envoie pas chez « l'administrateur de votre agence ».
    await expect(
      page.getByText(MOTIF_DESACTIVE),
      "aucun motif affiché à l'éditeur désactivé"
    ).toBeVisible({ timeout: 15000 })
    await expect
      .soft(
        page.getByText("Contactez un autre super administrateur"),
        "l'éditeur est renvoyé vers un interlocuteur qui n'existe pas"
      )
      .toBeVisible({ timeout: 15000 })
  })

  /**
   * La RECIPROQUE : le sens ou une lecture perimee ACCORDE un pouvoir.
   *
   * La story 1.8 n'éprouvait que la rétrogradation — le sens ou l'on
   * retire. C'est pourtant le sens inverse qui se remarque le moins : si
   * la promotion ne prenait pas effet, personne ne signalerait un bogue,
   * l'intéressé se reconnecterait et cela marcherait. Un contrôle qui ne
   * s'ouvre pas passe inaperçu ; un contrôle qui ne se ferme pas est une
   * faille. Les deux se lisent dans la même colonne, et un seul test des
   * deux ne prouve que la moitié.
   */
  test("une promotion prend effet sans reconnexion", async ({ page }) => {
    test.setTimeout(240000)

    await avecAgence(["agency_admin", "agent"], async (agence) => {
      const agent = await db.user.findFirstOrThrow({
        where: { agencyId: agence.agence.id, role: "agent" },
      })

      await login(page, agent.email)

      // Contrôle négatif d'abord : l'écran est bien refusé AVANT.
      await page.goto("/agency/users")
      await page.waitForURL((url) => !url.pathname.startsWith("/agency/users"), {
        timeout: 30000,
      })
      await expect
        .soft(page.getByText(REFUS), "l'agent entre déjà dans les comptes")
        .toBeVisible({ timeout: 15000 })

      await db.user.update({
        where: { id: agent.id },
        data: { role: "agency_admin" },
      })

      await page.goto("/agency/users")

      // Le CONTENU, pas le statut ni l'adresse. La page est diffusée en
      // flux : un refus arriverait après l'en-tête, donc en `200`, et la
      // redirection serait posée par le routeur client une fraction de
      // seconde plus tard — les deux assertions faciles seraient vertes
      // sur un écran refusé.
      await expect(
        page.getByRole("heading", { name: "Comptes de l'agence" }),
        "la promotion n'ouvre pas l'écran réservé sans reconnexion"
      ).toBeVisible({ timeout: 15000 })
      await expect
        .soft(
          page.getByText(REFUS),
          "le motif de refus s'affiche encore après la promotion"
        )
        .toHaveCount(0)

      // Et la route d'API, qui lit le rôle par `isAgencyAdmin(userRole)` :
      // 404 et non 403 — le rôle passe, c'est l'identifiant qui n'existe pas.
      const apiApres = await page.request.post("/api/clients/inexistant/delete", {
        failOnStatusCode: false,
      })
      expect(
        apiApres.status(),
        "la route de suppression lit encore le rôle du jeton"
      ).toBe(404)
    })
  })

  /**
   * La boucle de redirection, et le troisieme tiers de la table de
   * fraicheur de `docs/architecture.md`.
   *
   * Deux proprietes en un cas, parce qu'elles n'ont qu'une cause :
   *
   * 1. `requireSuperAdmin()` lit le role EN BASE. Aucun test ne l'epinglait
   *    — le seul cas d'editeur eprouvait `isActive` — si bien que
   *    retablir `session.user.role` dans cette garde laissait la suite
   *    verte, alors que la documentation publie que les trois gardes
   *    relisent le role.
   *
   * 2. Et surtout : la retrogradation ne doit pas ENFERMER le compte. Tant
   *    que le middleware autorisait /admin sur le role du JETON et la garde
   *    sur celui de la BASE, un editeur retrograde rebondissait de l'un a
   *    l'autre — ERR_TOO_MANY_REDIRECTS sur les deux espaces, sans issue en
   *    libre-service. La branche etait inatteignable avant la story 1.8,
   *    qui a fait diverger les deux sources ; elle est fermee par le
   *    retrait du controle de role du middleware.
   *
   * PREUVE PAR MUTATION : retablir `pathname.startsWith("/admin") &&
   * userRole !== "super_admin"` dans `middleware.ts` fait echouer ce cas
   * sur `page.goto`, qui leve `ERR_TOO_MANY_REDIRECTS`.
   */
  test("un éditeur rétrogradé perd sa console sans rebondir entre les deux espaces", async ({
    page,
  }) => {
    test.setTimeout(240000)

    await avecAgence(["agency_admin"], async (agence) => {
      const { compte, email, motDePasse } = await editeurJetable()

      await login(page, email, motDePasse)

      await page.goto("/admin/agencies")
      await expect
        .soft(
          page.getByRole("heading", { name: /agences/i }).first(),
          "l'éditeur n'accède pas à sa console"
        )
        .toBeVisible({ timeout: 15000 })

      // La rétrogradation. On le rattache à l'agence du décor : c'est le
      // cas réel — un compte qu'on fait redescendre au rang d'agence, et
      // qui doit atterrir sur quelque chose plutôt que nulle part.
      await db.user.update({
        where: { id: compte.id },
        data: { role: "agency_admin", agencyId: agence.agence.id },
      })

      await page.goto("/admin/agencies")

      /**
       * `waitForURL`, et surtout PAS `page.url()` juste après `goto`.
       *
       * `app/admin/loading.tsx` existe : la page est diffusée en flux, donc
       * l'en-tête de la réponse est déjà parti quand la garde tranche. Le
       * `redirect()` ne peut plus être un `307` — Next l'émet dans le flux
       * et c'est le routeur client qui navigue, APRÈS l'événement `load`
       * que `goto` attend. Lire l'adresse à cet instant, c'est la lire
       * avant que la redirection ait eu lieu : le test échoue sur un
       * produit correct. La leçon est déjà au dossier
       * (`deferred-work.md`, story 4.2) et elle vient de coûter une
       * troisième fois.
       *
       * C'EST AUSSI CE QUI PROUVE L'ABSENCE DE BOUCLE. Avec le contrôle de
       * rôle rétabli dans `middleware.ts`, l'adresse ne se stabilise
       * jamais — elle rebondit entre les deux espaces — et cette attente
       * expire. Mutation vérifiée le 12-08-2026.
       */
      await page.waitForURL((url) => !url.pathname.startsWith("/admin"), {
        timeout: 30000,
      })

      expect(
        page.url(),
        "le compte rétrogradé n'est pas renvoyé vers son espace"
      ).toContain("/agency")

      // Et il atterrit sur une page qui rend vraiment : un 200 ne prouve
      // rien ici, le flux ayant commencé avant la décision.
      await expect(
        page.getByRole("navigation").first(),
        "le compte rétrogradé n'atterrit sur aucune page rendue"
      ).toBeVisible({ timeout: 15000 })
    })
  })

  /**
   * BUG-33 parle du bouton, pas de la colonne.
   *
   * Le registre dit : « le bouton Désactiver de /agency/users ne ferme
   * rien ». Les trois cas ci-dessus posent la coupure par `db.user.update`
   * — ils prouvent la garde, pas la promesse de l'écran. Entre les deux il
   * reste une Server Action, `toggleActive`, dont rien ne dit qu'elle écrit
   * bien la colonne que les gardes relisent.
   *
   * Deux sessions simultanées, comme dans la réalité : l'administrateur
   * coupe l'accès pendant que l'agent travaille.
   */
  test("le bouton « Désactiver » de la console d'agence coupe réellement l'accès", async ({
    page,
    browser,
  }) => {
    test.setTimeout(240000)

    await avecAgence(["agency_admin", "agent"], async (agence) => {
      const admin = await db.user.findFirstOrThrow({
        where: { agencyId: agence.agence.id, role: "agency_admin" },
      })
      const agent = await db.user.findFirstOrThrow({
        where: { agencyId: agence.agence.id, role: "agent" },
      })

      // L'agent, au travail.
      await login(page, agent.email)
      const avant = await page.goto("/agency/clients")
      expect
        .soft(avant?.status(), "l'agent n'accède pas à sa liste de clients")
        .toBe(200)

      // L'administrateur, dans un autre navigateur.
      const contexteAdmin = await browser.newContext()
      const pageAdmin = await contexteAdmin.newPage()

      try {
        await login(pageAdmin, admin.email)
        await pageAdmin.goto("/agency/users")

        const bouton = pageAdmin.locator(
          `form:has(input[name="targetId"][value="${agent.id}"]) button:has-text("Désactiver")`
        )
        await expect(
          bouton,
          "aucun bouton de désactivation pour l'agent"
        ).toBeVisible({ timeout: 15000 })

        await bouton.click()
        // L'adresse est DÉJÀ `/agency/users` : attendre ce motif seul se
        // satisferait de l'instant présent et n'attendrait rien du tout.
        // C'est le paramètre posé par la redirection de fin d'action qui
        // dit que la Server Action est allée au bout.
        await pageAdmin.waitForURL(/\/agency\/users\?.*(error|success)=/, {
          timeout: 30000,
        })

        // La colonne a bien été écrite — sinon le refus ci-dessous
        // prouverait autre chose que ce qu'on croit.
        const relu = await db.user.findUniqueOrThrow({ where: { id: agent.id } })
        expect(relu.isActive, "le bouton n'a pas écrit `isActive`").toBe(false)
      } finally {
        await contexteAdmin.close()
      }

      // Et l'agent, qui n'a rien fait, tombe à sa requête suivante.
      await page.goto("/agency/clients")
      await page.waitForURL(/\/auth\/login/, { timeout: 30000 })
      await expect(
        page.getByText(MOTIF_DESACTIVE),
        "le bouton « Désactiver » ne ferme rien"
      ).toBeVisible({ timeout: 15000 })
    })
  })
})

/**
 * Soumet la desactivation d'un compte depuis la console de l'editeur.
 *
 * Le formulaire est vise par la valeur de son champ cache ET par le
 * titre de son bouton : la ligne porte DEUX formulaires avec le meme
 * `input[name="userId"]`, celui de la reinitialisation de mot de passe et
 * celui de l'activation.
 */
async function desactiver(page: Page, email: string, userId: string) {
  await page.goto(`/admin/users?q=${encodeURIComponent(email)}`)

  const bouton = page.locator(
    `form:has(input[name="userId"][value="${userId}"]) button[title="Couper l'accès"]`
  )

  await expect(bouton, `aucun bouton de désactivation pour ${email}`).toBeVisible({
    timeout: 15000,
  })

  await bouton.click()
  await page.waitForURL(/\/admin\/users\?.*(error|success)=/, { timeout: 30000 })
}

/**
 * Suppression directe des ecrans d'edition (BUG-32, story 4.6).
 *
 * Cinq Server Actions detruisent sans verifier le role, la ou leur route
 * d'API homologue le refuse a un agent. Ce ne sont ni des routes — donc
 * `api-acces.spec.ts` ne les voit pas — ni des ecrans reserves — donc le
 * bloc « cinq ecrans reserves » ci-dessus ne les voit pas non plus. Elles
 * sont exactement dans l'angle mort des deux.
 *
 * POURQUOI REJOUER LE POST, ET NE PAS CLIQUER. Apres la tache 4, le bouton
 * n'est plus rendu a un agent : un test qui cliquerait ne prouverait que le
 * masquage, et resterait vert le jour ou le garde serveur sauterait. Une
 * Server Action est un point d'entree POST joignable sans l'ecran qui la
 * rend — c'est cela qu'il faut eprouver.
 *
 * L'IDENTIFIANT D'ACTION EST LU A L'EXECUTION, jamais code en dur : il est
 * calcule au `build`, et fige dans un test il pourrirait au premier
 * `next build` en laissant le test vert. C'est le defaut BUG-28 que la
 * story 4.1 a passe son temps a retirer.
 */

/**
 * Releve le formulaire de suppression d'un ecran d'edition, tel quel.
 *
 * React rend une Server Action en formulaire ordinaire — amelioration
 * progressive — avec des champs caches `$ACTION_*` qui portent l'identite
 * de l'action et ses arguments lies, ces derniers CHIFFRES. Nos quatre
 * actions d'ecran capturent `params` : elles sont donc liees, et leur
 * charge utile ne se devine pas. On emporte le HTML entier plutot que de
 * le reconstruire.
 */
async function releverSuppression(
  page: Page,
  ecran: string,
  texteBouton: string
): Promise<string> {
  await page.goto(ecran)

  const form = page.locator(`form:has(button:has-text("${texteBouton}"))`)
  await expect(
    form,
    `aucun formulaire « ${texteBouton} » sur ${ecran}`
  ).toBeAttached({ timeout: 15000 })

  return form.evaluate((el) => (el as HTMLFormElement).outerHTML)
}

/**
 * Rejoue ce formulaire dans la session de `page`, sans passer par React.
 *
 * MESURE, ET NON CHOIX D'ELEGANCE. Trois voies ont ete essayees le
 * 12-08-2026 :
 *  1. `request.post({ form })` — `Failed to find Server Action` : le corps
 *     doit etre du multipart, l'action etant liee ;
 *  2. `request.post({ multipart })` — meme erreur ; la serialisation de
 *     Playwright ne reproduit pas exactement celle de React ;
 *  3. reinjecter le formulaire de l'administrateur dans la page de l'agent
 *     et appeler `form.submit()` — fonctionne.
 *
 * La troisieme est aussi la plus fidele : `submit()` ne declenche aucun
 * gestionnaire React, c'est donc EXACTEMENT le chemin d'un navigateur sans
 * JavaScript. Et elle survit a la tache 4 : le bouton ne sera plus rendu a
 * un agent, mais l'action restera joignable — c'est precisement ce qu'il
 * faut prouver refuse.
 *
 * L'identifiant d'action n'est jamais ecrit ici : il vient du HTML releve a
 * l'execution. Fige dans le test, il pourrirait au premier `next build` en
 * laissant le test vert (BUG-28).
 */
async function rejouer(page: Page, ecran: string, formHtml: string) {
  await page.goto(ecran)

  // L'ATTERRISSAGE SE VERIFIE. `action=""` se resout contre l'URL
  // COURANTE : le jour ou un agent serait renvoye de l'ecran d'edition —
  // suite naturelle du masquage du bouton — le POST partirait de
  // `/agency?error=...`, la navigation aurait bien lieu, la ligne
  // survivrait, et le test serait vert en ne prouvant plus rien. Releve
  // par la revue du 12-08-2026 comme variante du faux vert deja traverse.
  expect(
    page.url(),
    `le rejeu ne part pas de ${ecran} — le POST viserait une autre adresse`
  ).toContain(ecran)

  await Promise.all([
    // Un refus redirige, un succes aussi : dans les deux cas il y a
    // navigation. Si elle n'a pas lieu, le rejeu n'a pas abouti et le
    // silence ne doit pas passer pour un refus.
    page.waitForNavigation({ timeout: 30000 }),
    page.evaluate((html) => {
      const hote = document.createElement("div")
      hote.innerHTML = html
      const form = hote.querySelector("form") as HTMLFormElement
      document.body.appendChild(form)
      form.submit()
    }, formHtml),
  ])
}

test.describe("Suppression directe des écrans d'édition (BUG-32)", () => {
  test("un agent est refusé sur les quatre suppressions réservées, et la ligne survit", async ({
    page,
    browser,
  }) => {
    test.setTimeout(240000)

    await avecAgence(["agency_admin", "agent"], async (agence) => {
      const decor = await garnir(agence)
      const admin = await db.user.findFirstOrThrow({
        where: { agencyId: agence.agence.id, role: "agency_admin" },
      })
      const agent = await db.user.findFirstOrThrow({
        where: { agencyId: agence.agence.id, role: "agent" },
      })

      const cibles = [
        {
          nom: "bien",
          ecran: `/agency/properties/${decor.bien.id}/edit`,
          bouton: "Supprimer ce bien",
          // `deletedAt: null` EST l'assertion. Sans lui, ce compte renvoie
          // 1 que la garde ait refusé OU que l'agent ait réussi à mettre
          // le bien à la corbeille — `deleteProperty` ne supprime plus la
          // ligne, et `tests/db.ts` est le client brut, sans filtre. La
          // revue du 12-08-2026 l'a relevé : c'était le critère central de
          // la story, et il ne prouvait rien pour la seule des quatre
          // actions dont l'échec est destructeur.
          existe: () =>
            db.property.count({
              where: { id: decor.bien.id, deletedAt: null },
            }),
        },
        {
          nom: "visite",
          ecran: `/agency/visits/${decor.visite.id}/edit`,
          bouton: "Supprimer",
          existe: () => db.visit.count({ where: { id: decor.visite.id } }),
        },
        {
          nom: "paiement",
          ecran: `/agency/payments/${decor.paiement.id}/edit`,
          bouton: "Supprimer",
          existe: () => db.payment.count({ where: { id: decor.paiement.id } }),
        },
        {
          nom: "échéance de gestion locative",
          ecran: `/agency/rental-management/${decor.quittance.id}/edit`,
          bouton: "Supprimer",
          existe: () =>
            db.rentalManagement.count({ where: { id: decor.quittance.id } }),
        },
      ]

      // L'administrateur releve les formulaires : lui seul verra les
      // boutons une fois la story terminee.
      await login(page, admin.email)
      const releves: Record<string, string> = {}
      for (const cible of cibles) {
        releves[cible.nom] = await releverSuppression(
          page,
          cible.ecran,
          cible.bouton
        )
      }

      // L'agent rejoue, dans sa propre session.
      const contexteAgent = await browser.newContext()
      const pageAgent = await contexteAgent.newPage()

      try {
        await login(pageAgent, agent.email)

        for (const cible of cibles) {
          await rejouer(pageAgent, cible.ecran, releves[cible.nom])

          // LA SEULE ASSERTION QUI COMPTE : la ligne est toujours là.
          // Le code de la réponse ne prouve rien — une Server Action
          // refusée redirige, et le rendu est diffusé en flux.
          expect(
            await cible.existe(),
            `un agent a supprimé ${cible.nom} par la Server Action de l'écran d'édition`
          ).toBe(1)

          // Et le refus se voit : l'agent est renvoyé au tableau de bord
          // avec le motif, comme sur les cinq écrans réservés.
          expect
            .soft(
              pageAgent.url(),
              `le refus de supprimer ${cible.nom} ne renvoie pas au tableau de bord`
            )
            .toContain("/agency?error=")
        }

        /**
         * CE QUE L'AGENT DOIT CONSERVER, et c'est la moitié oubliable de
         * l'AC 5. Une permission se resserre toujours trop facilement :
         * l'agent garde l'écran d'édition et son bouton d'enregistrement,
         * il perd le seul geste destructeur. Sans cette assertion, poser
         * `requireAgencyAdmin()` sur `updateProperty` par mégarde ne
         * casserait rien dans ce fichier.
         */
        for (const cible of cibles) {
          await pageAgent.goto(cible.ecran)

          await expect(
            pageAgent.getByRole("button", { name: "Enregistrer" }),
            `${cible.nom} : l'agent a perdu l'enregistrement en même temps que la suppression`
          ).toBeVisible({ timeout: 15000 })

          await expect(
            pageAgent.getByRole("button", { name: cible.bouton }),
            `${cible.nom} : le bouton de suppression est encore proposé à un agent`
          ).toHaveCount(0)
        }
      } finally {
        await contexteAgent.close()
      }
    })
  })

  /**
   * LE CONTROLE POSITIF, et il porte aussi les AC 2 et 3.
   *
   * Sans lui, les quatre refus ci-dessus passeraient tout aussi bien sur
   * quatre actions cassees pour tout le monde — c'est la regle imposee par
   * la revue de la story 4.2, et elle vaut ici plus qu'ailleurs : la
   * correction consistait justement a ajouter un garde qui refuse.
   *
   * Il verifie en outre les deux proprietes que la story ajoute au-dela du
   * role : le bien part a la CORBEILLE et non en poussiere, et les cinq
   * suppressions laissent une trace dans `AuditLog`.
   */
  test("un administrateur passe, le bien va à la corbeille et son historique reste", async ({
    page,
  }) => {
    test.setTimeout(240000)

    await avecAgence(["agency_admin"], async (agence) => {
      const decor = await garnir(agence)
      const admin = await db.user.findFirstOrThrow({
        where: { agencyId: agence.agence.id, role: "agency_admin" },
      })

      // `garnir()` ne pose aucune photo, et le registre affirmait pourtant
      // « ses photos … restent en base ». Relevé par la revue : une
      // affirmation que rien n'éprouve. On la rend éprouvable.
      const photo = await db.propertyImage.create({
        data: { propertyId: decor.bien.id, url: "/uploads/properties/x.jpg", isMain: true },
      })

      await login(page, admin.email)

      // 1. LE BIEN — la seule des cinq dont la nature change.
      const ecranBien = `/agency/properties/${decor.bien.id}/edit`
      const formBien = await releverSuppression(
        page,
        ecranBien,
        "Supprimer ce bien"
      )
      await rejouer(page, ecranBien, formBien)

      const bien = await db.property.findUnique({
        where: { id: decor.bien.id },
      })
      expect(bien, "le bien a été supprimé définitivement").not.toBeNull()
      expect(
        bien?.deletedAt,
        "le bien n'a pas été mis à la corbeille"
      ).not.toBeNull()

      // Et la cascade n'a PAS eu lieu : c'est tout l'intérêt de la
      // corbeille, et c'est ce que `delete()` emportait.
      expect
        .soft(
          await db.visit.count({ where: { id: decor.visite.id } }),
          "la visite est partie avec le bien"
        )
        .toBe(1)
      expect
        .soft(
          await db.sale.count({ where: { id: decor.vente.id } }),
          "la vente est partie avec le bien"
        )
        .toBe(1)
      expect
        .soft(
          await db.rental.count({ where: { id: decor.bail.id } }),
          "le bail est parti avec le bien"
        )
        .toBe(1)
      expect
        .soft(
          await db.rentalManagement.count({ where: { id: decor.quittance.id } }),
          "l'échéancier est parti avec le bien"
        )
        .toBe(1)
      expect
        .soft(
          await db.propertyImage.count({ where: { id: photo.id } }),
          "la photo est partie avec le bien"
        )
        .toBe(1)

      // RESTAURABLE — et on le restaure vraiment.
      //
      // La première version se contentait de lire le titre du bien sur
      // l'écran de corbeille, tout en affirmant dans trois documents qu'il
      // « se restaure ». Voir la ligne et pouvoir la ramener sont deux
      // choses ; la revue du 12-08-2026 a demandé la seconde.
      await page.goto("/agency/trash")
      await expect(
        page.getByText(decor.bien.title),
        "le bien n'apparaît pas dans la corbeille"
      ).toBeVisible({ timeout: 15000 })

      const restaurer = page.locator(
        `form:has(input[name="id"][value="${decor.bien.id}"]):has(button:has-text("Restaurer")) button`
      )
      await Promise.all([
        page.waitForNavigation({ timeout: 30000 }),
        restaurer.click(),
      ])

      const restaure = await db.property.findUniqueOrThrow({
        where: { id: decor.bien.id },
      })
      expect(
        restaure.deletedAt,
        "le bien n'est pas revenu de la corbeille"
      ).toBeNull()

      // Et on le remet à la corbeille pour la suite du cas — les trois
      // suppressions définitives ci-dessous portent sur ses enfants.
      await db.property.update({
        where: { id: decor.bien.id },
        data: { deletedAt: new Date() },
      })

      // 2. LES TROIS AUTRES — suppression définitive assumée, comme leur
      // route d'API. Étendre la corbeille à ces modèles est la story 3.5.
      const definitives = [
        {
          nom: "visite",
          ecran: `/agency/visits/${decor.visite.id}/edit`,
          bouton: "Supprimer cette visite",
          reste: () => db.visit.count({ where: { id: decor.visite.id } }),
        },
        {
          nom: "paiement",
          ecran: `/agency/payments/${decor.paiement.id}/edit`,
          bouton: "Supprimer ce paiement",
          reste: () => db.payment.count({ where: { id: decor.paiement.id } }),
        },
        {
          nom: "échéance",
          ecran: `/agency/rental-management/${decor.quittance.id}/edit`,
          bouton: "Supprimer cette quittance",
          reste: () =>
            db.rentalManagement.count({ where: { id: decor.quittance.id } }),
        },
      ]

      for (const cible of definitives) {
        const form = await releverSuppression(page, cible.ecran, cible.bouton)
        await rejouer(page, cible.ecran, form)
        expect(
          await cible.reste(),
          `l'administrateur n'a pas pu supprimer ${cible.nom}`
        ).toBe(0)
      }

      // 3. LE JOURNAL — quatre suppressions, quatre lignes.
      const journal = await db.auditLog.findMany({
        where: { agencyId: agence.agence.id, action: "suppression" },
        select: { entity: true, entityId: true },
      })

      // L'`entityId` compte autant que l'`entity` : sans lui, une ligne
      // écrite contre le mauvais identifiant satisfait le contrôle.
      const attendus: Array<[string, string]> = [
        ["bien", decor.bien.id],
        ["visite", decor.visite.id],
        ["paiement", decor.paiement.id],
        ["gestion locative", decor.quittance.id],
      ]

      for (const [entite, identifiant] of attendus) {
        expect(
          journal.some((l) => l.entity === entite && l.entityId === identifiant),
          `aucune ligne de journal pour la suppression de ${entite} (${identifiant})`
        ).toBe(true)
      }
    })
  })

  /**
   * La cinquieme action, et la seule qui reste ouverte a l'agent.
   *
   * Arbitrage rendu le 12-08-2026 : une interaction est une ligne
   * d'historique que l'agent vient de saisir lui-meme ; la reserver
   * rendrait une faute de frappe ineffacable pour celui qui l'a commise. Ce
   * test EPINGLE cette decision — si quelqu'un pose un jour
   * `requireAgencyAdmin()` sur `deleteInteraction`, il rougit, et
   * l'arbitrage sera rouvert sciemment plutot que par inadvertance.
   *
   * La contrepartie de la permission est le journal, verifiee ici aussi :
   * c'est elle qui rend la decision defendable.
   */
  test("l'agent garde la suppression d'une interaction, et elle est journalisée", async ({
    page,
  }) => {
    test.setTimeout(240000)

    await avecAgence(["agent"], async (agence) => {
      const decor = await garnir(agence)
      const agent = await db.user.findFirstOrThrow({
        where: { agencyId: agence.agence.id, role: "agent" },
      })

      const interaction = await db.interaction.create({
        data: {
          type: "appel",
          subject: `Contact ${agence.marque}`,
          agencyId: agence.agence.id,
          clientId: decor.client.id,
          authorId: agent.id,
        },
      })

      await login(page, agent.email)
      await page.goto(`/agency/clients/${decor.client.id}`)

      const bouton = page.locator(
        `form:has(input[name="id"][value="${interaction.id}"]) button[type="submit"]`
      )
      await expect(
        bouton,
        "l'agent n'a plus le bouton de suppression d'une interaction"
      ).toBeVisible({ timeout: 15000 })

      await Promise.all([
        page.waitForNavigation({ timeout: 30000 }),
        bouton.click(),
      ])

      expect(
        await db.interaction.count({ where: { id: interaction.id } }),
        "l'agent ne peut plus supprimer une interaction qu'il vient de saisir"
      ).toBe(0)

      const trace = await db.auditLog.count({
        where: {
          agencyId: agence.agence.id,
          action: "suppression",
          entity: "interaction",
          entityId: interaction.id,
        },
      })
      expect(trace, "la suppression d'une interaction n'est pas journalisée").toBe(1)
    })
  })

  /**
   * L'AUTRE MOITIE DE L'ARBITRAGE, et celle qui manquait.
   *
   * La premiere version de cette story ecrivait, dans le code et dans
   * l'architecture, qu'un agent efface « une ligne qu'il a saisie lui-meme,
   * a l'instant ». Le code, lui, le laissait effacer N'IMPORTE QUELLE
   * interaction de l'agence — celle de son administrateur, celle d'un
   * collegue, une ligne vieille de deux ans. Et le test « qui epinglait
   * l'arbitrage » n'eprouvait qu'un agent supprimant sa propre ligne : il
   * validait la promesse etroite pendant que le code appliquait la large.
   * Releve par la revue du 12-08-2026.
   *
   * Ce cas eprouve la regle telle qu'elle est desormais ecrite, dans les
   * deux sens : ce que l'agent NE PEUT PAS, et ce que l'administrateur PEUT.
   */
  test("un agent ne peut pas effacer l'interaction d'un autre, l'administrateur si", async ({
    page,
    browser,
  }) => {
    test.setTimeout(240000)

    await avecAgence(["agency_admin", "agent"], async (agence) => {
      const decor = await garnir(agence)
      const admin = await db.user.findFirstOrThrow({
        where: { agencyId: agence.agence.id, role: "agency_admin" },
      })
      const agent = await db.user.findFirstOrThrow({
        where: { agencyId: agence.agence.id, role: "agent" },
      })

      // Une ligne écrite par l'ADMINISTRATEUR.
      const ligneAdmin = await db.interaction.create({
        data: {
          type: "appel",
          subject: `Ligne admin ${agence.marque}`,
          agencyId: agence.agence.id,
          clientId: decor.client.id,
          authorId: admin.id,
        },
      })

      const fiche = `/agency/clients/${decor.client.id}`

      // 1. L'agent ne la voit même pas proposée…
      await login(page, agent.email)
      await page.goto(fiche)
      await expect(
        page.getByText(ligneAdmin.subject),
        "l'agent ne voit pas l'historique du client"
      ).toBeVisible({ timeout: 15000 })
      await expect(
        page.locator(`form:has(input[name="id"][value="${ligneAdmin.id}"])`),
        "le bouton de suppression est proposé à un agent sur la ligne d'un autre"
      ).toHaveCount(0)

      // 2. …et le serveur refuse quand même le geste, rejoué sans l'écran.
      //    Cacher le bouton n'est jamais la mesure.
      //
      // L'agent a bien SA propre ligne effaçable : c'est le contrôle
      // positif, et il prouve que le refus ci-dessous vient de l'auteur et
      // non d'une action cassée.
      const sienne = await db.interaction.create({
        data: {
          type: "appel",
          subject: `Ligne agent ${agence.marque}`,
          agencyId: agence.agence.id,
          clientId: decor.client.id,
          authorId: agent.id,
        },
      })
      await page.goto(fiche)
      const boutonSien = page.locator(
        `form:has(input[name="id"][value="${sienne.id}"]) button[type="submit"]`
      )
      await expect(
        boutonSien,
        "l'agent n'a pas le bouton sur sa propre ligne"
      ).toBeVisible({ timeout: 15000 })

      // On rejoue CE formulaire-là en changeant seulement l'identifiant :
      // même action, même session, seule la cible change.
      const html = await page
        .locator(`form:has(input[name="id"][value="${sienne.id}"])`)
        .evaluate(
          (el, autre) => {
            const f = (el as HTMLFormElement).cloneNode(true) as HTMLFormElement
            const champ = f.querySelector(
              'input[name="id"]'
            ) as HTMLInputElement
            champ.value = autre
            return f.outerHTML
          },
          ligneAdmin.id
        )

      await rejouer(page, fiche, html)

      expect(
        await db.interaction.count({ where: { id: ligneAdmin.id } }),
        "un agent a effacé l'interaction écrite par son administrateur"
      ).toBe(1)
      expect
        .soft(
          page.url(),
          "le refus ne dit pas pourquoi à l'agent"
        )
        .toContain("error=")

      // 3. L'administrateur, lui, efface la même ligne.
      const contexteAdmin = await browser.newContext()
      const pageAdmin = await contexteAdmin.newPage()
      try {
        await login(pageAdmin, admin.email)
        await pageAdmin.goto(fiche)
        const bouton = pageAdmin.locator(
          `form:has(input[name="id"][value="${ligneAdmin.id}"]) button[type="submit"]`
        )
        await expect(
          bouton,
          "l'administrateur n'a pas le bouton sur la ligne qu'il a écrite"
        ).toBeVisible({ timeout: 15000 })

        await Promise.all([
          pageAdmin.waitForNavigation({ timeout: 30000 }),
          bouton.click(),
        ])
      } finally {
        await contexteAdmin.close()
      }

      expect(
        await db.interaction.count({ where: { id: ligneAdmin.id } }),
        "l'administrateur ne peut plus effacer une interaction de son agence"
      ).toBe(0)
    })
  })
})
