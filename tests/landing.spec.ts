import { test, expect } from "@playwright/test"

test.describe("Landing Page", () => {
  test("should display landing page with all sections", async ({ page }) => {
    await page.goto("/")

    // Le héros annonce le produit, pas un lieu
    await expect(page.locator("text=Aqar DZ").first()).toBeVisible()
    await expect(
      page.getByRole("heading", { level: 1, name: /tient votre agence/i })
    ).toBeVisible()

    // Le panneau produit montre de vraies opérations du métier
    await expect(page.locator("text=Encaissements").first()).toBeVisible()
    await expect(page.locator("text=Quittance de mars générée")).toBeVisible()

    // Les deux entrées : s'inscrire, ou se connecter
    await expect(page.locator("text=Inscrire mon agence").first()).toBeVisible()
    await expect(page.locator("text=Se connecter").first()).toBeVisible()

    // Les sections suivantes existent
    await expect(page.locator("#features")).toBeAttached()
    await expect(page.locator("#pricing")).toBeAttached()
    await expect(page.locator("#contact")).toBeAttached()
  })

  test("should navigate to registration page", async ({ page }) => {
    await page.goto("/")
    await page.locator("text=Inscrire mon agence").first().click()
    await expect(page).toHaveURL(/.*register/)
  })

  test("should navigate to login page", async ({ page }) => {
    await page.goto("/")
    await page.locator("text=Se connecter").first().click()
    await expect(page).toHaveURL(/.*login/)
  })
})

test.describe("Authentication", () => {
  test("should display login page", async ({ page }) => {
    await page.goto("/auth/login")
    
    await expect(page.locator("text=Connexion")).toBeVisible()
    await expect(page.locator("input[type='email']")).toBeVisible()
    await expect(page.locator("input[type='password']")).toBeVisible()
  })

  test("should display register page", async ({ page }) => {
    await page.goto("/auth/register")
    
    await expect(page.locator("text=Inscrire mon agence")).toBeVisible()
    await expect(page.locator("input[name='agencyName']")).toBeVisible()
    await expect(page.locator("input[type='email']")).toBeVisible()
  })

  test("should show error on invalid login", async ({ page }) => {
    await page.goto("/auth/login")
    
    await page.fill("input[type='email']", "test@test.com")
    await page.fill("input[type='password']", "wrongpassword")
    await page.click("button[type='submit']")

    // Le refus passe par une comparaison bcrypt, volontairement lente, puis
    // par une action serveur : 5 s ne suffisent pas quand la suite enchaîne.
    await expect(
      page.locator("text=Email ou mot de passe incorrect")
    ).toBeVisible({ timeout: 20000 })
  })
})

// Le bloc « Dashboard » qui suivait — /agency et /admin sans session —
// est parti dans `acces.spec.ts` (story 4.1). Ces deux cas-la ne
// mentaient pas, contrairement aux dix-sept de BUG-28 : ils sont
// simplement devenus des doublons exacts de la table des 31 routes
// protegees. Signale ici plutot que glisse dans un diff.
