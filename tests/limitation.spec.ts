import { test, expect } from "@playwright/test"
import { rateLimit, cleDeCompteur } from "../lib/rate-limit"

/**
 * Le comptage lui-meme (story 1.9, REP-38 et REP-40).
 *
 * POURQUOI CE FICHIER N'A PAS BESOIN DU SERVEUR. `rateLimit()` et
 * `cleDeCompteur()` sont des fonctions PURES au sens qui compte ici : leur
 * comportement ne depend que de leurs arguments et d'une horloge. Le depot
 * eprouve deja ses fonctions pures de cette facon — `emailLayout`,
 * `toCsv`, `typeReconnu` sont importees directement par
 * `regression.spec.ts`. On ne fait donc pas exception, et on n'ajoute
 * aucun outil : c'est Playwright qui sert de lanceur.
 *
 * LE MODULE EST ICI UNE INSTANCE A PART, distincte de celle du serveur :
 * sa table de compteurs est vierge, ce qui est exactement ce qu'on veut
 * pour eprouver l'algorithme sans dependre de ce que la suite a fait
 * ailleurs.
 *
 * ET SURTOUT : `windowMs` est un PARAMETRE. La frontiere d'une fenetre de
 * quinze minutes est inatteignable dans un test ; celle d'une fenetre de
 * trois cents millisecondes se franchit en trois cents millisecondes. Cette
 * story avait d'abord conclu que la frontiere n'etait pas eprouvable —
 * c'etait faux, et le constat venait d'avoir suppose que le seul chemin
 * passait par le serveur.
 */

test.describe("Comptage des tentatives", () => {
  test("la frontière d'une fenêtre ne laisse pas passer le double du seuil", () => {
    const limite = 5
    const fenetreMs = 300
    const cle = `frontiere-${Date.now()}-${Math.random()}`

    const saturer = () => {
      let acceptes = 0
      for (let essai = 0; essai < limite + 3; essai++) {
        if (rateLimit({ key: cle, limit: limite, windowMs: fenetreMs }).ok) {
          acceptes++
        }
      }
      return acceptes
    }

    const avant = saturer()
    expect(avant, "le seuil n'est pas celui annoncé").toBe(limite)

    const debut = Date.now()

    return new Promise<void>((suite) => {
      // Juste après la bascule : c'est là qu'une fenêtre FIXE repartait
      // de zéro et offrait un second budget entier.
      setTimeout(() => {
        const ecoule = Date.now() - debut

        /**
         * MESURER L'ECOULE, ET NON LE SUPPOSER. Avec vingt millisecondes
         * de marge sur une fenetre de trois cents, un retard d'event loop
         * — banal quand quatre travailleurs pilotent des navigateurs —
         * faisait sortir le callback de la zone eprouvee : `precedent`
         * repassait a zero, le total redevenait le double, et le test
         * accusait le produit d'une regression qui n'existait pas.
         * Releve par la revue du 12-08-2026.
         */
        expect(
          ecoule,
          `le test n'a pas franchi la zone qu'il éprouve (${ecoule} ms) — il faut 0 < écart < ${fenetreMs} ms après la frontière`
        ).toBeLessThan(fenetreMs * 2)

        const apres = saturer()

        // Le total sur une fenêtre glissante ne doit pas dépasser le
        // seuil de manière significative. `< limite * 2` tolérait 180 %
        // du budget : une pondération à 20 % serait passée au vert.
        expect(
          avant + apres,
          `la frontière laisse passer ${avant + apres} essais là où le seuil en annonce ${limite}`
        ).toBeLessThanOrEqual(limite + 1)

        suite()
      }, fenetreMs + 20)
    })
  })

  /**
   * LE CAS QUE LE TEST PRECEDENT NE FRANCHIT PAS : un retour APRES la
   * frontiere mais AVANT la fin de la fenetre suivante.
   *
   * C'est la zone ou vivait le defaut d'ancrage — la premiere version
   * reancrait la fenetre sur l'appel, si bien que le poids de la
   * precedente restait PLEIN quel que soit le temps ecoule. Un titulaire
   * qui revenait a 0,9 fenetre etait refuse, et devait attendre une
   * fenetre de plus.
   */
  test("un retour tardif dans la fenêtre suivante n'est pas puni rétroactivement", () => {
    const limite = 4
    const fenetreMs = 300
    const cle = `retard-${Date.now()}-${Math.random()}`

    for (let essai = 0; essai < limite; essai++) {
      rateLimit({ key: cle, limit: limite, windowMs: fenetreMs })
    }

    const debut = Date.now()

    return new Promise<void>((suite) => {
      setTimeout(() => {
        const ecoule = Date.now() - debut

        expect(
          ecoule,
          `le test n'a pas atterri dans la zone visée (${ecoule} ms)`
        ).toBeGreaterThan(fenetreMs)
        expect(ecoule, `écoulé ${ecoule} ms`).toBeLessThan(fenetreMs * 2)

        expect(
          rateLimit({ key: cle, limit: limite, windowMs: fenetreMs }).ok,
          "un retour tardif est refusé : le poids de la fenêtre précédente ne décroît pas avec le temps"
        ).toBe(true)

        suite()
      }, Math.round(fenetreMs * 1.8))
    })
  })

  test("le compteur repart quand la fenêtre précédente est entièrement sortie", () => {
    const limite = 3
    const fenetreMs = 200
    const cle = `oubli-${Date.now()}-${Math.random()}`

    for (let essai = 0; essai < limite; essai++) {
      rateLimit({ key: cle, limit: limite, windowMs: fenetreMs })
    }

    return new Promise<void>((suite) => {
      // Deux fenêtres plus tard, la précédente ne pèse plus rien : sans
      // cette propriété, la limitation deviendrait un bannissement
      // définitif au lieu d'un frein.
      setTimeout(() => {
        expect(
          rateLimit({ key: cle, limit: limite, windowMs: fenetreMs }).ok,
          "le compteur ne repart jamais : la limitation est devenue un bannissement"
        ).toBe(true)

        suite()
      }, fenetreMs * 2 + 40)
    })
  })

  /**
   * REP-40 : deux appelants distincts ne doivent pas partager un compteur.
   *
   * Aucune collision n'existait au moment du constat, mais cela tenait a
   * deux accidents — `isIP` refuse `@`, et aucun prefixe n'etait prefixe
   * d'un autre. Un futur `rateLimit({ key: 'lead:' + agencyId })` sur une
   * valeur libre cassait l'invariant sans que rien ne le signale.
   */
  test("deux appelants distincts ne peuvent pas partager une clé", () => {
    const prefixes = ["login:ip", "login:compte", "login", "lead", "a:b"]
    const valeurs = [
      "1.2.3.4",
      "compte:1.2.3.4",
      "b:lead",
      "x@y.z",
      "",
      ":",
      "login:compte:x@y.z",
      "é%20:",
    ]

    const vues = new Map<string, string>()

    for (const prefixe of prefixes) {
      for (const valeur of valeurs) {
        const cle = cleDeCompteur(prefixe, valeur)
        const origine = `${prefixe} + ${valeur}`
        const deja = vues.get(cle)

        expect(
          deja,
          `collision : « ${origine} » et « ${deja} » donnent la même clé « ${cle} »`
        ).toBeUndefined()

        vues.set(cle, origine)
      }
    }

    expect(vues.size, "des couples ont été perdus en route").toBe(
      prefixes.length * valeurs.length
    )
  })
})
