import { readFileSync } from "fs"
import { join } from "path"
import { PrismaClient } from "@prisma/client"

/**
 * Acces direct a la base depuis les tests.
 *
 * POURQUOI un client brut plutot que `lib/prisma.ts` : celui de
 * l'application est etendu d'un filtre de suppression reversible, qui
 * masque a la LECTURE toute ligne portant un `deletedAt`. Or plusieurs
 * tests doivent justement relire une ligne « quel que soit son etat »
 * pour prouver qu'une tentative de suppression n'a rien fait. Avec le
 * client de l'application, une ligne mise a la corbeille par erreur
 * ressortirait introuvable — et le test la lirait comme « la garde a
 * tenu », ce qui est l'inverse de la verite.
 *
 * POURQUOI la regle ESLint de la corbeille est DESACTIVEE sur `tests/**`
 * (`.eslintrc.json`, bloc `overrides`) : cette regle refuse `findUnique` et
 * `delete`/`deleteMany` sur les trois modeles a corbeille, parce que le
 * filtre de `lib/prisma.ts` ne les couvre pas (story 3.5, REP-99). Ici,
 * c'est exactement l'inverse qu'on veut — `db` est le client NON filtre, et
 * huit cas s'en servent pour relire une ligne quel que soit son etat. Le
 * fichier de configuration est du JSON, il ne porte pas de commentaire :
 * le motif est ecrit ici, a l'endroit qu'il exempte.
 *
 * POURQUOI relire `.env` a la main : le processus de test est du Node
 * ordinaire, il ne passe pas par le chargement d'environnement de Next.
 * `DATABASE_URL` n'y est donc pas defini, et le projet ne depend pas de
 * `dotenv`. Six lignes ici valent mieux qu'une dependance de plus.
 */
function urlDeBase(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const brut = readFileSync(join(__dirname, "..", ".env"), "utf-8")
  const ligne = brut
    .split("\n")
    .find((l) => /^\s*DATABASE_URL\s*=/.test(l))

  if (!ligne) {
    throw new Error(
      "DATABASE_URL introuvable : ni dans l'environnement, ni dans .env. " +
        "Les tests de cloisonnement ont besoin de la base pour poser leur décor."
    )
  }

  return ligne
    .slice(ligne.indexOf("=") + 1)
    .trim()
    .replace(/^["']|["']$/g, "")
}

export const db = new PrismaClient({
  datasources: { db: { url: urlDeBase() } },
})
