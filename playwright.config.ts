import { defineConfig, devices } from "@playwright/test"

/**
 * Port de l'application pendant les tests.
 *
 * Il ne peut pas etre fige a 3000 : cette machine y heberge un autre
 * projet. PLAYWRIGHT_PORT permet de le changer sans toucher aux tests.
 */
const PORT = process.env.PLAYWRIGHT_PORT ?? "3002"
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  /**
   * Delai par cas : 90 s, contre 30 s par defaut.
   *
   * MESURE, pas prudence. En passant de 65 a 93 cas, deux executions
   * consecutives ont echoue sur des tests differents, tous deux sur un
   * `waitForURL` de connexion — et sur le delai DU CAS, pas sur celui de
   * l'attente. La cause n'est pas le produit : c'est le harnais. Chaque
   * connexion verifie un mot de passe avec bcrypt, volontairement lent
   * (cout 12), sur un seul processus serveur partage par quatre
   * travailleurs.
   *
   * C'est un pansement, et il est assume comme tel. Le vrai remede est de
   * cesser de se reconnecter a chaque cas — `storageState` enregistre une
   * fois par role, reutilise partout — ce qui supprimerait des dizaines
   * de verifications bcrypt. C'est une refonte de la suite, donc sa
   * propre story ; elle est reportee.
   */
  timeout: 90_000,

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },
  ],

  /**
   * ⚠ CETTE SUITE NE PASSE PAS PAR nginx, ET NE LE FERA PAS.
   *
   * Elle sert l'application EN DIRECT sur le port ci-dessous. Le relais, les
   * volumes, les migrations et les variables d'environnement du deploiement
   * conteneurise sont HORS de son chemin — c'est REP-95.
   *
   * Ce n'est pas une lacune theorique. Le 15-08-2026, BUG-36 a mis les 41
   * Server Actions du produit en echec derriere nginx (`Host` transmis sans
   * son port, donc rejet anti-CSRF de Next 14) pendant que les 121 cas
   * d'ici restaient verts. Un vert de cette suite ne dit RIEN de la
   * topologie de deploiement.
   *
   * Ce qui couvre ce chemin, et rien d'autre :
   *   - `npm run verify:deploy`      preuve reelle, a la main, sur la pile
   *   - `tests/deploiement.spec.ts`  garde-fou statique, joue ici meme
   */
  webServer: {
    command: `npm run build && npm start -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    /**
     * Cette commande construit l'application avant de la servir : deux
     * minutes n'y suffisent pas depuis un cache vide. Au-dela du delai,
     * Playwright tue la construction en cours et laisse un dossier .next
     * incomplet, que `next start` refuse ensuite d'ouvrir.
     */
    timeout: 420000,
  },
})
