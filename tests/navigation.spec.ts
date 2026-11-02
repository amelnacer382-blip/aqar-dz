import { test, expect } from "@playwright/test"
import { login } from "./auth-helper"

const BASE = `http://localhost:${process.env.PLAYWRIGHT_PORT ?? "3002"}`

/**
 * La barre de navigation de la console editeur, et ses commandes mortes.
 *
 * BUG-35 : `components/layout/AdminNavbar.tsx` portait cinq commandes sans
 * aucune action — deux boutons « Deconnexion » (bureau et mobile), une
 * entree « Parametres », une entree « Profil », et une cloche de
 * notifications surmontee d'une pastille rouge permanente. Le fichier
 * n'importait meme pas `signOut`.
 *
 * LE PLUS GRAVE ETAIT LA DECONNEXION : un editeur ne pouvait pas fermer sa
 * session depuis sa console. Sur un poste partage, la session — douze
 * heures depuis la story 1.8 — restait ouverte, sur le compte le plus
 * puissant du produit. Le recours restant etait l'URL `/api/auth/signout`
 * de NextAuth, que rien n'affiche : la page existe (`auth.config.ts` ne
 * surcharge que `signIn` et `error`), mais aucun editeur ne la devine.
 *
 * POURQUOI CES TESTS CLIQUENT, alors que `CLAUDE.md` §6 dit qu'une Server
 * Action se rejoue et ne se clique pas. La regle vise les gardes : cliquer
 * ne prouve alors que le rendu du bouton. Ici, c'est EXACTEMENT le rendu du
 * bouton qui est en cause — son cablage, pas la logique derriere. Rejouer
 * l'appel NextAuth prouverait que NextAuth sait deconnecter, ce que
 * personne ne conteste, et laisserait le defaut passer dessous.
 *
 * DELAI : 240 s, et le calcul est ecrit parce qu'il a deja ete faux DEUX
 * fois. Un plafond de cas inferieur a la somme des delais qu'il encadre
 * produit un « Test timeout exceeded » qui ne designe aucune propriete —
 * ce que §6 interdit.
 *
 *   login()  : goto 60 s + waitForURL 90 s          = 150 s
 *   ce cas   : waitForURL 30 s + waitForURL 30 s    =  60 s
 *                                                     -----
 *   pire cas                                          210 s
 *
 * Le premier jet posait 120 s (revue : REP-85). La correction a pose
 * 180 s en affirmant « aligne sur la somme qu'il encadre » — c'etait FAUX
 * de 30 s, le `goto` de 60 s de `login()` ayant ete oublie. Verifie le
 * 14-08-2026 en relisant `auth-helper.ts` ligne par ligne. La question de
 * fond — un harnais ou les delais s'empilent sans etre additionnes — reste
 * a la story 4.7.
 */

/** Ouvre le menu utilisateur du bureau, et PROUVE qu'il est ouvert. */
async function ouvrirMenuUtilisateur(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /Menu utilisateur/i }).click()

  /**
   * L'ancrage positif, et il est OBLIGATOIRE.
   *
   * Sans lui, une assertion d'absence — « Profil n'est pas la » — est verte
   * sur un menu qui ne s'ouvre pas du tout : c'est le piege 1 de §6, un
   * test qui verifie qu'une chose est absente sans verifier que
   * l'operation a EU LIEU. Releve en revue le 14-08-2026 : le premier jet
   * de ce fichier assertait `toHaveCount(0)` juste apres le clic, et
   * serait reste vert si le declencheur avait casse.
   */
  await expect(page.getByRole("menuitem", { name: /Déconnexion/i })).toBeVisible()
}

test.describe("Barre de navigation de la console éditeur", () => {
  test("le bouton Déconnexion ferme réellement la session", async ({ page }) => {
    test.setTimeout(240000)
    await login(page, "superadmin@aqar.dz")

    // Le compte de demonstration est partage par toute la suite
    // (`CLAUDE.md` §3). Se deconnecter ne le modifie pas : aucune colonne
    // n'est touchee, et la connexion qui precede a remis son compteur de
    // tentatives a zero. Rien a nettoyer, donc pas d'`afterEach` ici.
    await page.goto(`${BASE}/admin`)
    await expect(
      page.getByRole("heading", { name: /Dashboard Super Admin/i })
    ).toBeVisible()

    await ouvrirMenuUtilisateur(page)
    await page.getByRole("menuitem", { name: /Déconnexion/i }).click()

    // On attend la SORTIE, pas un code HTTP : sur ce depot un refus arrive
    // en 200 et c'est le navigateur qui redirige (`CLAUDE.md` §6, piege 2).
    await page.waitForURL(/\/auth\/login/, { timeout: 30000 })

    /**
     * LA PARTIE QUI PROUVE QUELQUE CHOSE.
     *
     * Arriver sur /auth/login ne dit pas que la session est morte : un lien
     * ordinaire vers l'ecran de connexion y menerait aussi, cookie intact.
     * Ce qui se verifie, c'est que la console est REDEVENUE inaccessible.
     */
    await page.goto(`${BASE}/admin`)
    await page.waitForURL(/\/auth\/login/, { timeout: 30000 })
    await expect(
      page.getByRole("heading", { name: /Dashboard Super Admin/i })
    ).toHaveCount(0)
  })

  /**
   * LE BOUTON MOBILE, et il a bien failli n'etre couvert par rien.
   *
   * La revue du 14-08-2026 l'a releve : les quatre premiers cas passaient
   * tous par le menu utilisateur du bureau, qui vit dans un conteneur
   * `hidden md:flex`. Le bouton mobile, lui, est dans le bloc `md:hidden`.
   * On pouvait donc retirer son `onClick` sans faire rougir la suite —
   * BUG-35 a moitie rouvert, sans aucun signal.
   *
   * Le viewport est force ICI plutot que de compter sur un projet mobile :
   * `npm run test:e2e` ne joue que `chromium` alors que la configuration
   * declare cinq projets (REP-80). Un test qui dependrait d'un projet
   * jamais joue ne prouverait rien.
   */
  test("sur mobile, le bouton Déconnexion ferme réellement la session", async ({
    page,
  }) => {
    test.setTimeout(240000)
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, "superadmin@aqar.dz")

    await page.goto(`${BASE}/admin`)
    await expect(
      page.getByRole("heading", { name: /Dashboard Super Admin/i })
    ).toBeVisible()

    // Joignable par role uniquement depuis que l'aria-label existe
    // (REP-84) : l'icone Lucide n'a pas de <title>, le nom accessible
    // etait vide, et ce test etait donc INECRIVABLE avant ce correctif.
    await page.getByRole("button", { name: /Ouvrir le menu/i }).click()

    const deconnexion = page.getByRole("button", { name: /Déconnexion/i })
    await expect(deconnexion).toBeVisible()
    await deconnexion.click()

    await page.waitForURL(/\/auth\/login/, { timeout: 30000 })

    await page.goto(`${BASE}/admin`)
    await page.waitForURL(/\/auth\/login/, { timeout: 30000 })
    await expect(
      page.getByRole("heading", { name: /Dashboard Super Admin/i })
    ).toHaveCount(0)
  })

  /**
   * Le controle positif, et il est obligatoire (`CLAUDE.md` §6).
   *
   * Les cas ci-dessus passeraient tout aussi bien sur une console
   * entierement cassee : si /admin etait inaccessible a tout le monde, le
   * second `waitForURL` serait vert et ne prouverait plus rien. Celui-ci
   * etablit qu'avec une session valide, la console s'ouvre — donc que le
   * rouge des deux premiers vient bien de la deconnexion.
   */
  test("contrôle positif : avec une session, la console s'ouvre", async ({ page }) => {
    test.setTimeout(240000)
    await login(page, "superadmin@aqar.dz")

    await page.goto(`${BASE}/admin`)
    await expect(
      page.getByRole("heading", { name: /Dashboard Super Admin/i })
    ).toBeVisible()
  })

  test("l'entrée Paramètres du menu mène à la page des paramètres", async ({ page }) => {
    test.setTimeout(240000)
    await login(page, "superadmin@aqar.dz")

    await page.goto(`${BASE}/admin`)
    await ouvrirMenuUtilisateur(page)
    await page.getByRole("menuitem", { name: /Paramètres/i }).click()

    await page.waitForURL(/\/admin\/settings/, { timeout: 30000 })
    await expect(
      page.getByRole("heading", { name: /Paramètres plateforme/i })
    ).toBeVisible()
  })

  /**
   * Les deux entrees retirees ne doivent pas revenir sans leur page.
   *
   * « Profil » n'a jamais eu d'ecran, et la cloche n'a jamais eu de
   * notifications. Les reintroduire suppose d'ecrire d'abord ce qu'elles
   * ouvrent ; ce cas est la pour que la reintroduction soit un choix et non
   * un copier-coller.
   *
   * LA CLOCHE EST VERIFIEE PAR SA CLASSE, et c'est assume. Le critere
   * d'acceptation dit « ELLES », au pluriel ; le premier jet n'assertait
   * que « Profil », et la revue l'a releve — une case cochee a moitie. Or
   * la cloche etait un bouton icone SANS aria-label : elle n'a aucun nom
   * accessible sur lequel asserter. `lucide-bell` est pose par la
   * bibliotheque elle-meme (`class="lucide lucide-bell"`, verifie le
   * 14-08-2026), pas par nos classes Tailwind : il ne bougera pas au
   * prochain remaniement de style.
   */
  test("le menu ne propose rien qui n'ouvre nulle part", async ({ page }) => {
    test.setTimeout(240000)
    await login(page, "superadmin@aqar.dz")

    await page.goto(`${BASE}/admin`)

    // La cloche vivait dans l'en-tete, HORS du menu deroulant : elle se
    // verifie donc avant de l'ouvrir, et sur l'en-tete entier.
    await expect(page.locator("header .lucide-bell")).toHaveCount(0)

    await ouvrirMenuUtilisateur(page)
    await expect(page.getByRole("menuitem", { name: /^Profil$/i })).toHaveCount(0)
  })
})
