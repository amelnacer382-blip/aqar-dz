import { test, expect } from "@playwright/test"
import { login } from "./auth-helper"

const BASE = `http://localhost:${process.env.PLAYWRIGHT_PORT ?? "3002"}`

test.describe("Nouvelles fonctionnalités", () => {
  test("recherche et pagination sur les biens", async ({ page }) => {
    test.setTimeout(120000)
    await login(page, "admin@aqar.dz")

    await page.goto(`${BASE}/agency/properties`)
    await expect(page.getByRole("heading", { name: /Biens immobiliers/i })).toBeVisible()

    // La recherche filtre bien
    await page.fill('input[name="q"]', "Hydra")
    await page.click('button:has-text("Rechercher")')
    await page.waitForURL(/q=Hydra/, { timeout: 30000 })
    await expect(page.getByText(/correspondant à/i)).toBeVisible()

    // Un terme absent ne renvoie rien, avec le bon message
    await page.goto(`${BASE}/agency/properties?q=zzzzintrouvable`)
    await expect(page.getByText(/Aucun bien ne correspond/i)).toBeVisible()
  })

  test("export CSV des biens", async ({ page }) => {
    test.setTimeout(120000)
    await login(page, "admin@aqar.dz")

    const response = await page.request.get(`${BASE}/api/export/properties`)
    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain("text/csv")

    const body = await response.text()
    expect(body).toContain("Référence")
    expect(body.split("\r\n").length).toBeGreaterThan(1)
  })

  test("l'export refuse un visiteur non authentifié", async ({ request }) => {
    const response = await request.get(`${BASE}/api/export/properties`)
    expect(response.status()).toBe(401)
  })

  test("corbeille : suppression réversible puis restauration", async ({ page }) => {
    test.setTimeout(180000)
    await login(page, "admin@aqar.dz")

    await page.goto(`${BASE}/agency/properties`)
    const firstTitle = await page.locator("table tbody tr").first().innerText()

    // Supprimer le premier bien
    await page.locator('form[action*="/delete"] button').first().click()
    await page.waitForTimeout(2500)

    // Il doit être dans la corbeille
    await page.goto(`${BASE}/agency/trash`)
    await expect(page.getByRole("heading", { name: "Corbeille" })).toBeVisible()
    const trashRows = await page.locator("table tbody tr").count()
    expect(trashRows).toBeGreaterThan(0)

    // Le restaurer
    await page.locator('button:has-text("Restaurer")').first().click()
    await page.waitForTimeout(2500)
    await expect(page.getByText(/Élément restauré/i)).toBeVisible()

    // Et le journal doit en garder trace
    await page.goto(`${BASE}/agency/audit`)
    await expect(page.getByText(/Restauration/i).first()).toBeVisible()
    expect(firstTitle.length).toBeGreaterThan(0)
  })

  test("un agent ne peut ni supprimer ni ouvrir les comptes", async ({ page }) => {
    test.setTimeout(120000)
    await login(page, "agent@aqar.dz")

    // Aucun bouton de suppression dans la liste des biens
    await page.goto(`${BASE}/agency/properties`)
    await expect(page.locator('form[action*="/delete"]')).toHaveCount(0)

    // L'écran des comptes le renvoie au tableau de bord.
    //
    // On attend que l'adresse ait effectivement change, plutot que de
    // relire page.url() apres un delai fixe : sous charge, le contenu du
    // tableau de bord etait deja affiche alors que la barre d'adresse
    // n'avait pas encore ete mise a jour, et le test echouait sur une
    // redirection qui avait pourtant bien eu lieu.
    await page.goto(`${BASE}/agency/users`)
    await page.waitForURL(
      (url) => !url.pathname.startsWith("/agency/users"),
      { timeout: 30000 }
    )
    expect(page.url()).not.toContain("/agency/users")

    // Et l'API refuse aussi, pas seulement l'écran
    const response = await page.request.post(
      `${BASE}/api/properties/inexistant/delete`
    )
    expect(response.status()).toBe(403)
  })

  test("comptes : créer un agent puis le désactiver", async ({ page }) => {
    test.setTimeout(180000)
    await login(page, "admin@aqar.dz")

    await page.goto(`${BASE}/agency/users`)
    await expect(page.getByRole("heading", { name: /Comptes de l/i })).toBeVisible()

    const email = `agent-test-${Date.now()}@aqar.dz`
    await page.fill("#name", "Agent de test")
    await page.fill("#email", email)
    await page.fill("#password", "password123")
    await page.click('button:has-text("Créer le compte")')

    // On attend la redirection de l'action serveur, pas une duree fixe :
    // la creation hache un mot de passe (bcrypt, volontairement lent) et,
    // quand toute la suite tourne en parallele sur un seul serveur, elle
    // depasse regulierement les deux secondes et demie qui etaient
    // attendues ici. Le test echouait alors que le compte etait bien cree.
    await page.waitForURL(/\/agency\/users\?success=/, { timeout: 30000 })

    // Le viser dans le tableau : l'email figure aussi dans le message de succes
    const row = page.locator("tr", { hasText: email })
    await expect(row).toBeVisible({ timeout: 15000 })

    // Désactivation
    await row.locator('button:has-text("Désactiver")').click()
    await expect(page.getByText(/Compte désactivé/i)).toBeVisible({
      timeout: 30000,
    })
  })

  test("mot de passe oublié : réponse identique quel que soit le compte", async ({
    page,
  }) => {
    test.setTimeout(120000)

    await page.goto(`${BASE}/auth/forgot`)
    await page.fill("#email", "admin@aqar.dz")
    await page.click('button[type="submit"]')
    await expect(page.getByText(/Si un compte existe/i)).toBeVisible({
      timeout: 30000,
    })

    await page.goto(`${BASE}/auth/forgot`)
    await page.fill("#email", "personne-ici@aqar.dz")
    await page.click('button[type="submit"]')
    await expect(page.getByText(/Si un compte existe/i)).toBeVisible({
      timeout: 30000,
    })
  })

  test("lien de réinitialisation invalide", async ({ page }) => {
    await page.goto(`${BASE}/auth/reset/jeton-invente`)
    await expect(page.getByRole("heading", { name: /Lien expiré/i })).toBeVisible()
  })

  test("statistiques : le filtre de période change la borne", async ({ page }) => {
    test.setTimeout(120000)
    await login(page, "admin@aqar.dz")

    await page.goto(`${BASE}/agency/statistics?months=3`)
    await expect(page.getByText(/sur les 3 derniers mois/i)).toBeVisible()
    await expect(page.getByText(/Recettes nettes \(3 mois\)/i)).toBeVisible()

    // Une valeur fantaisiste retombe sur la période par défaut
    await page.goto(`${BASE}/agency/statistics?months=999`)
    await expect(page.getByText(/sur les 12 derniers mois/i)).toBeVisible()
  })
})

test.describe("Suppressions réservées à l'administrateur", () => {
  /**
   * Cinq routes de suppression n'avaient aucun controle de role : un agent
   * pouvait detruire une vente, un bail, un paiement, un document ou une
   * visite. On verifie ici l'API, pas le bouton — cacher un bouton n'a
   * jamais protege une action.
   */
  const ROUTES = ["sales", "rentals", "payments", "documents", "visits"]

  test("un agent reçoit 403 sur chaque route de suppression", async ({
    page,
  }) => {
    test.setTimeout(180000)
    await login(page, "agent@aqar.dz")

    for (const entity of ROUTES) {
      const response = await page.request.post(
        `${BASE}/api/${entity}/inexistant/delete`
      )
      expect(
        response.status(),
        `/api/${entity}/[id]/delete doit refuser un agent`
      ).toBe(403)
    }
  })

  test("l'administrateur passe le contrôle de rôle", async ({ page }) => {
    test.setTimeout(180000)
    await login(page, "admin@aqar.dz")

    // 404 et non 403 : le role est accepte, c'est l'identifiant qui n'existe
    // pas. C'est ce qui distingue « interdit » de « introuvable ».
    for (const entity of ROUTES) {
      const response = await page.request.post(
        `${BASE}/api/${entity}/inexistant/delete`
      )
      expect(
        response.status(),
        `/api/${entity}/[id]/delete doit accepter un administrateur`
      ).toBe(404)
    }
  })
})

test.describe("Référencement et pages système", () => {
  test("robots.txt et sitemap.xml sont publics", async ({ request }) => {
    const robots = await request.get(`${BASE}/robots.txt`)
    expect(robots.status()).toBe(200)

    const rules = await robots.text()
    expect(rules).toContain("Allow: /vitrine/")
    expect(rules).toContain("Disallow: /agency/")
    expect(rules).toContain("Sitemap:")

    const sitemap = await request.get(`${BASE}/sitemap.xml`)
    expect(sitemap.status()).toBe(200)

    /**
     * DEPUIS LA STORY 3.12, `/sitemap.xml` EST UN INDEX. Il ne porte plus
     * d'URL de vitrine mais les adresses des plans partiels ; ce test suit
     * donc la chaine, ce qui vaut mieux que de la contourner — c'est elle
     * que les moteurs empruntent.
     */
    const index = await sitemap.text()
    expect(
      index,
      "/sitemap.xml n'est pas un index : le decoupage de la story 3.12 est defait"
    ).toContain("<sitemapindex")

    const parties = (index.match(/<loc>[^<]+<\/loc>/g) ?? []).map((bloc) =>
      bloc.slice("<loc>".length, -"</loc>".length)
    )
    expect(
      parties.length,
      "l'index ne renvoie vers aucun plan partiel"
    ).toBeGreaterThan(0)

    let xml = ""
    for (const url of parties) {
      // L'index annonce des adresses ABSOLUES, derivees d'`appUrl()` — donc
      // du domaine public, qui n'est pas celui par lequel la suite sonde.
      // On ne suit que le chemin. Comparer les domaines est le travail de
      // `npm run verify:deploy`, qui interroge la pile reelle.
      const chemin = new URL(url).pathname
      const partie = await request.get(`${BASE}${chemin}`)
      expect(partie.status(), `${chemin} ne repond pas`).toBe(200)
      const corps = await partie.text()
      expect(corps, `${url} n'est pas un plan valide`).toContain("<urlset")
      xml += corps
    }

    // La vitrine de l'agence active y figure ; celle de l'agence en
    // attente ne doit pas y etre — un plan de site ne promet que des
    // adresses qui repondent.
    expect(xml).toContain("/vitrine/agence-demo")
    expect(xml).not.toContain("agence-en-attente")
  })

  /**
   * Story 3.12 — une partie qui n'existe pas repond 404, pas un plan vide.
   *
   * Le nom de partie vient d'un segment d'URL : c'est une valeur exterieure.
   * L'alternation est ecrite en toutes lettres dans l'expression reguliere
   * de `lirePartie()`, et non verifiee par une appartenance a une table —
   * lecon de la story 3.2 (BUG-38), ou `constructor` et `__proto__`
   * franchissaient une garde en `valeur in TABLE`.
   */
  test("une partie de plan inconnue répond 404", async ({ request }) => {
    const valide = await request.get(`${BASE}/sitemap/agences-0.xml`)
    expect(
      valide.status(),
      "la premiere partie du plan ne repond plus : le controle positif tombe, " +
        "et les 404 ci-dessous ne prouveraient plus rien"
    ).toBe(200)

    for (const nom of [
      "constructor",
      "__proto__.xml",
      "agences-007.xml",
      "agences--1.xml",
      "biens-0.txt",
      "agences.xml",
    ]) {
      const reponse = await request.get(`${BASE}/sitemap/${nom}`)
      expect(
        reponse.status(),
        `/sitemap/${nom} ne devrait pas être servi comme un plan`
      ).toBe(404)
    }
  })

  test("une adresse inconnue affiche la page 404 du produit", async ({
    page,
  }) => {
    const response = await page.goto(`${BASE}/cette-page-nexiste-pas`)
    expect(response?.status()).toBe(404)
    await expect(
      page.getByRole("heading", { name: /Cette page n.existe pas/i })
    ).toBeVisible()
  })

  test("les en-têtes de sécurité sont posés", async ({ request }) => {
    const response = await request.get(`${BASE}/`)
    const headers = response.headers()

    expect(headers["x-frame-options"]).toBe("SAMEORIGIN")
    expect(headers["x-content-type-options"]).toBe("nosniff")
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin")
    // Le serveur ne s'annonce pas.
    expect(headers["x-powered-by"]).toBeUndefined()
  })
})

test.describe("Recherche sur les listes rattachées", () => {
  /**
   * Ventes, baux et visites n'ont aucune colonne texte propre : la
   * recherche doit porter sur le bien et le client, sans quoi elle ne
   * trouve jamais rien.
   */
  test("ventes, locations et visites se cherchent par bien ou par client", async ({
    page,
  }) => {
    test.setTimeout(180000)
    await login(page, "admin@aqar.dz")

    for (const path of ["sales", "rentals", "visits"]) {
      await page.goto(`${BASE}/agency/${path}?q=zzzzintrouvable`)
      await expect(
        page.locator("table tbody tr"),
        `/agency/${path} ne doit rien renvoyer sur un terme absent`
      ).toHaveCount(0)

      await page.goto(`${BASE}/agency/${path}?q=Hydra`)
      await expect(
        page.locator('input[name="q"]'),
        `/agency/${path} doit conserver le terme cherché`
      ).toHaveValue("Hydra")
    }
  })
})

test.describe("Dépannage d'un compte bloqué", () => {
  /**
   * Sans SMTP, le lien « mot de passe oublie » ne part pas. Un patron
   * d'agence bloque n'avait alors aucun recours : il est le seul
   * administrateur de son agence. L'editeur doit pouvoir le depanner.
   */
  test("l'éditeur redonne un mot de passe, l'agent s'en sert", async ({
    page,
  }) => {
    test.setTimeout(180000)

    const motDePasse = `depannage-${Date.now()}`

    await login(page, "superadmin@aqar.dz")
    await page.goto(`${BASE}/admin/users?q=agent@aqar.dz`)

    const ligne = page.locator("tr", { hasText: "agent@aqar.dz" })
    await expect(ligne).toBeVisible()

    await ligne.locator('input[name="password"]').fill(motDePasse)
    await ligne.locator('button[title="Réinitialiser le mot de passe"]').click()
    await expect(page.getByText(/Transmettez-le par téléphone/i)).toBeVisible({
      timeout: 30000,
    })

    // Le nouveau mot de passe ouvre bien la session.
    await page.goto(`${BASE}/api/auth/signout`)
    await page.goto(`${BASE}/auth/login`)
    await page.fill("#email", "agent@aqar.dz")
    await page.fill("#password", motDePasse)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/agency/, { timeout: 60000 })

    // Remettre le mot de passe d'origine : la suite entiere s'en sert.
    await page.goto(`${BASE}/api/auth/signout`)
    await login(page, "superadmin@aqar.dz")
    await page.goto(`${BASE}/admin/users?q=agent@aqar.dz`)
    const retour = page.locator("tr", { hasText: "agent@aqar.dz" })
    await retour.locator('input[name="password"]').fill("password123")
    await retour.locator('button[title="Réinitialiser le mot de passe"]').click()
    await expect(page.getByText(/Transmettez-le par téléphone/i)).toBeVisible({
      timeout: 30000,
    })
  })

  test("un mot de passe trop court est refusé", async ({ page }) => {
    test.setTimeout(120000)
    await login(page, "superadmin@aqar.dz")

    await page.goto(`${BASE}/admin/users?q=agent@aqar.dz`)
    const ligne = page.locator("tr", { hasText: "agent@aqar.dz" })

    // Le champ porte minLength : on contourne la validation du navigateur
    // pour vérifier que le SERVEUR refuse aussi — c'est lui qui protège.
    await ligne.locator('input[name="password"]').evaluate((input) => {
      const field = input as HTMLInputElement
      field.removeAttribute("minLength")
      field.value = "court"
    })
    await ligne.locator('button[title="Réinitialiser le mot de passe"]').click()

    await expect(page.getByText(/au moins 8 caractères/i)).toBeVisible({
      timeout: 30000,
    })
  })
})

test.describe("Suivi d'abonnement", () => {
  test("l'éditeur fixe une échéance, l'agence en est avertie", async ({
    page,
  }) => {
    test.setTimeout(180000)

    /*
      Une échéance dans 5 jours : sous le seuil d'alerte de 15 jours.

      LA DATE SE CONSTRUIT EN PARTIES LOCALES, et ce n'est pas du zèle.
      Ce cas s'écrivait `dans5jours.toISOString().slice(0, 10)`, qui bascule
      en UTC : le 18-08-2026 à 00 h 35 (heure locale, UTC+1), il produisait
      « 2026-08-22 » là où l'intention était le 23. Le produit compte les
      jours en calendrier LOCAL (`lib/subscription.ts`), il annonçait donc
      « 4 jours » et le cas en attendait 5.

      Une heure par jour, ce test rougissait sur un produit correct. C'est
      la même conversion que celle qui a produit BUG-40, et elle a été
      trouvée par ce rouge-là.
    */
    const dans5jours = new Date()
    dans5jours.setDate(dans5jours.getDate() + 5)
    const valeur = [
      dans5jours.getFullYear(),
      String(dans5jours.getMonth() + 1).padStart(2, "0"),
      String(dans5jours.getDate()).padStart(2, "0"),
    ].join("-")

    await login(page, "superadmin@aqar.dz")
    await page.goto(`${BASE}/admin/agencies`)

    const ligne = page.locator("tr", { hasText: "Agence Démo" })
    await ligne.locator('input[name="endsAt"]').fill(valeur)
    await ligne.locator('button[title="Enregistrer l\'échéance"]').click()

    await expect(
      page.locator("tr", { hasText: "Agence Démo" }).getByText(/Expire dans/i)
    ).toBeVisible({ timeout: 30000 })

    // Côté agence, l'avis apparaît sur le tableau de bord.
    await page.goto(`${BASE}/api/auth/signout`)
    await login(page, "admin@aqar.dz")
    await expect(
      page.getByText(/Votre abonnement expire dans 5 jours/i)
    ).toBeVisible({ timeout: 30000 })

    // Remettre l'agence sans échéance : les autres tests n'ont pas à voir
    // ce bandeau.
    await page.goto(`${BASE}/api/auth/signout`)
    await login(page, "superadmin@aqar.dz")
    await page.goto(`${BASE}/admin/agencies`)
    const retour = page.locator("tr", { hasText: "Agence Démo" })
    await retour.locator('input[name="endsAt"]').fill("")
    await retour.locator('button[title="Enregistrer l\'échéance"]').click()
    await expect(
      page.locator("tr", { hasText: "Agence Démo" }).getByText(/Aucune échéance/i)
    ).toBeVisible({ timeout: 30000 })
  })

  test("une agence à jour ne voit aucun bandeau", async ({ page }) => {
    test.setTimeout(120000)
    await login(page, "admin@aqar.dz")

    await expect(page.getByText(/Votre abonnement/i)).toHaveCount(0)
  })
})
