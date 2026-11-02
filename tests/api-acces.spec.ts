import { test, expect } from "@playwright/test"
import { readdirSync } from "fs"
import { join } from "path"

/**
 * Refus par defaut des routes d'API (story 4.4).
 *
 * `middleware.ts` applique aux routes `/api/*` un refus par defaut, avec
 * un motif ecrit : « une API inconnue n'a pas a reveler ce qu'elle est ».
 * Rien ne verifiait que ce refus tienne — lacune que j'avais moi-meme
 * reportee en revue de la story 4.1.
 *
 * DEUX PROPRIETES, ET LA SECONDE COMPTE AUTANT QUE LA PREMIERE.
 *
 * Le refus doit etre un 401 **en JSON**. Une redirection 307 vers l'ecran
 * de connexion rendrait du HTML a un client qui attend des donnees : il
 * afficherait une page de connexion dans une boite de dialogue, ou pire,
 * la lirait comme un succes. C'est ecrit dans le middleware, et c'est ce
 * qui distingue une API d'une page.
 */

/**
 * Routes protegees, avec leur methode REELLE.
 *
 * La methode compte : sur une route qui n'exporte que `POST`, un `GET`
 * recevrait 405 sans jamais atteindre le controle. On demande donc
 * chaque route comme le produit l'appelle.
 */
const PROTEGEES: Array<{ chemin: string; methode: "GET" | "POST" }> = [
  { chemin: "/api/clients/inexistant/delete", methode: "POST" },
  { chemin: "/api/documents/inexistant/delete", methode: "POST" },
  { chemin: "/api/documents/inexistant/file", methode: "GET" },
  { chemin: "/api/export/properties", methode: "GET" },
  { chemin: "/api/owners/inexistant/delete", methode: "POST" },
  { chemin: "/api/payments/inexistant/delete", methode: "POST" },
  { chemin: "/api/pdf/payment/inexistant", methode: "GET" },
  { chemin: "/api/pdf/property/inexistant", methode: "GET" },
  { chemin: "/api/pdf/receipt/inexistant", methode: "GET" },
  { chemin: "/api/pdf/rental-contract/inexistant", methode: "GET" },
  { chemin: "/api/pdf/sale-contract/inexistant", methode: "GET" },
  { chemin: "/api/properties/inexistant/delete", methode: "POST" },
  { chemin: "/api/rentals/inexistant/delete", methode: "POST" },
  { chemin: "/api/sales/inexistant/delete", methode: "POST" },
  { chemin: "/api/upload", methode: "POST" },
  { chemin: "/api/visits/inexistant/delete", methode: "POST" },
]

/**
 * Les trois routes ouvertes, et le motif de chacune.
 *
 * Elles sont listees pour que le garde table/disque ci-dessous puisse
 * distinguer « ouverte a dessein » de « oubliee ». Une route qui
 * apparaitrait dans `app/api` sans etre dans l'une des deux listes fait
 * rougir la suite.
 */
const PUBLIQUES = [
  // C'est par la que passe la connexion elle-meme.
  "/api/auth/[...nextauth]",
  // Inscription : formulaire public par definition.
  "/api/auth/register",
  // Sonde de sante, interrogee par Docker sans session.
  "/api/public/health",
]

test.describe("Refus par défaut des routes d'API (BUG-04, middleware)", () => {
  test("sans session, chaque route protégée répond 401 en JSON", async ({
    request,
  }) => {
    test.setTimeout(120000)

    for (const { chemin, methode } of PROTEGEES) {
      const reponse =
        methode === "GET"
          ? await request.get(chemin, { failOnStatusCode: false })
          : await request.post(chemin, { failOnStatusCode: false })

      expect
        .soft(reponse.status(), `${methode} ${chemin} n'est pas refusé`)
        .toBe(401)

      // Le type de contenu, et pas seulement le code. Une redirection
      // vers l'ecran de connexion rendrait 200 et du HTML : un client qui
      // attend des donnees le lirait comme un succes.
      expect
        .soft(
          reponse.headers()["content-type"],
          `${methode} ${chemin} refuse en HTML, pas en JSON`
        )
        .toContain("application/json")
    }
  })

  test("les routes publiques répondent sans session", async ({ request }) => {
    // Le contrôle. Sans lui, une application entièrement en panne — tout
    // en 401 — donnerait le même vert que le test ci-dessus.
    const sante = await request.get("/api/public/health", {
      failOnStatusCode: false,
    })

    expect(
      sante.status(),
      "la sonde de santé est refusée : Docker croirait la pile morte"
    ).toBe(200)

    // L'inscription : un corps vide suffit, on ne veut pas créer d'agence.
    // Ce qui compte est qu'elle ne soit pas arrêtée par le middleware —
    // 400 (corps invalide) et non 401.
    const inscription = await request.post("/api/auth/register", {
      failOnStatusCode: false,
      data: {},
    })

    expect(
      inscription.status(),
      "l'inscription est refusée avant même de lire son corps"
    ).not.toBe(401)
  })

  test("la table des routes d'API est celle du disque", () => {
    // Meme garde que pour les pages (story 4.1), et pour la meme raison :
    // une table ecrite a la main n'est exhaustive que le jour de son
    // ecriture. Sans ceci, une route d'API ajoutee n'entre dans aucune
    // liste, aucun test ne la demande, et la couverture se degrade en
    // silence pendant que le compteur de tests ne bouge pas.
    const surDisque: string[] = []

    const parcourir = (dossier: string, chemin: string) => {
      let entrees
      try {
        entrees = readdirSync(dossier, { withFileTypes: true })
      } catch {
        return
      }

      if (
        entrees.some(
          (e) => e.isFile() && (e.name === "route.ts" || e.name === "route.tsx")
        )
      ) {
        surDisque.push(`/api${chemin}`)
      }

      for (const entree of entrees) {
        if (!entree.isDirectory()) continue
        const segment = entree.name.startsWith("(") ? "" : `/${entree.name}`
        parcourir(join(dossier, entree.name), `${chemin}${segment}`)
      }
    }

    parcourir(join(__dirname, "..", "app", "api"), "")

    // Les chemins declares portent des identifiants concrets ; on les
    // ramene a leur gabarit pour comparer ce qui est comparable.
    const declarees = [
      ...PROTEGEES.map(({ chemin }) =>
        chemin
          .replace(/\/inexistant\b/, "/[id]")
          .replace("/api/export/properties", "/api/export/[entity]")
      ),
      ...PUBLIQUES,
    ]

    // `/api/pdf/property/[id]` et consorts : le segment variable est le
    // dernier, deja remplace ci-dessus.
    expect(
      declarees.sort(),
      "la table de ce fichier ne correspond plus à app/api : une route a été " +
        "ajoutée ou retirée sans que la couverture suive"
    ).toEqual(surDisque.sort())
  })
})
