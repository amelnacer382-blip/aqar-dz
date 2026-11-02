#!/usr/bin/env node
/**
 * Recense les cascades destructives partant des modeles a corbeille.
 *
 * NE PARLE A AUCUNE BASE. Il lit `prisma/schema.prisma` et ne fait que
 * suivre les aretes `@relation(..., onDelete: ...)`. On peut donc le lancer
 * partout, y compris avant `npm ci`.
 *
 * MOTIF — REP-99, eprouve le 15-08-2026. Un `client.deleteMany()` destine a
 * retirer un doublon a emporte une location et ses quittances par la cascade
 * `Client -> Rental -> RentalManagement`. Le constat qui a suivi tenait en
 * une phrase : « aucune commande ne recense les cascades destructives
 * partant des trois modeles a corbeille — personne ne sait dire ce qui tombe
 * quand on supprime un Client ».
 *
 * C'est cette commande. Elle repond a la question, et elle la repond a
 * partir du schema, pas d'une liste recopiee a la main qui vieillirait sans
 * prevenir (CLAUDE.md §7).
 *
 *   npm run audit:cascades
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..")
const SCHEMA = join(RACINE, "prisma", "schema.prisma")

const MODELES_CORBEILLE = ["Property", "Client", "Owner"]

/**
 * Extrait les aretes du schema.
 *
 * Une arete part du modele REFERENCE (le parent) vers le modele qui PORTE le
 * champ (l'enfant) : c'est la suppression du parent qui declenche l'action
 * sur l'enfant. Prisma ecrit la relation du cote de l'enfant, donc le sens
 * de lecture est inverse de celui de l'effet.
 */
function lireAretes(source) {
  const aretes = []
  let modeleCourant = null

  for (const [index, ligne] of source.split("\n").entries()) {
    const debutModele = ligne.match(/^model\s+(\w+)\s*\{/)
    if (debutModele) {
      modeleCourant = debutModele[1]
      continue
    }
    if (ligne.startsWith("}")) {
      modeleCourant = null
      continue
    }
    if (!modeleCourant) continue

    const relation = ligne.match(
      /^\s+(\w+)\s+(\w+)\??\s+@relation\(.*?onDelete:\s*(\w+)/
    )
    if (!relation) continue

    const [, champ, parent, action] = relation
    aretes.push({
      parent,
      enfant: modeleCourant,
      champ,
      action,
      ligne: index + 1,
    })
  }

  return aretes
}

/**
 * Parcourt les cascades depuis un modele, en largeur.
 *
 * Seul `Cascade` se propage : `SetNull` modifie l'enfant sans le detruire,
 * donc la chaine s'arrete la. Les deux sont rapportes — un `SetNull` casse
 * un lien metier, ce n'est pas rien —, mais seul le premier est une perte de
 * ligne.
 */
function parcourir(depart, aretes) {
  const cascades = []
  const detachements = []
  const vus = new Set([depart])
  const file = [{ modele: depart, profondeur: 1, chemin: depart }]

  while (file.length > 0) {
    const { modele, profondeur, chemin } = file.shift()

    for (const arete of aretes.filter((a) => a.parent === modele)) {
      const trace = `${chemin} -> ${arete.enfant}`

      if (arete.action === "Cascade") {
        cascades.push({ ...arete, profondeur, chemin: trace })
        if (!vus.has(arete.enfant)) {
          vus.add(arete.enfant)
          file.push({
            modele: arete.enfant,
            profondeur: profondeur + 1,
            chemin: trace,
          })
        }
      } else {
        detachements.push({ ...arete, profondeur, chemin: trace })
      }
    }
  }

  return { cascades, detachements }
}

const source = readFileSync(SCHEMA, "utf8")
const aretes = lireAretes(source)

console.log("Cascades destructives partant des modeles a corbeille")
console.log(`Source : prisma/schema.prisma — ${aretes.length} aretes @relation lues`)
console.log("")

let totalDetruit = 0

for (const modele of MODELES_CORBEILLE) {
  const { cascades, detachements } = parcourir(modele, aretes)
  totalDetruit += cascades.length

  console.log(`### Supprimer un ${modele} (delete OU deleteMany)`)
  console.log("")

  if (cascades.length === 0) {
    console.log("  DETRUIT : rien")
  } else {
    console.log(`  DETRUIT ${cascades.length} table(s) :`)
    for (const c of cascades) {
      console.log(
        `    - ${c.chemin}` +
          `   (${c.enfant}.${c.champ}, schema.prisma:${c.ligne})`
      )
    }
  }

  if (detachements.length > 0) {
    console.log(`  DETACHE ${detachements.length} lien(s) — SetNull, la ligne survit :`)
    for (const d of detachements) {
      console.log(
        `    - ${d.chemin}.${d.champ} := null` +
          `   (schema.prisma:${d.ligne})`
      )
    }
  }

  console.log("")
}

console.log(
  `TOTAL : ${totalDetruit} suppressions en cascade partant des trois modeles.`
)
console.log(
  "Un `delete()` ou un `deleteMany()` sur l'un d'eux les declenche toutes."
)
