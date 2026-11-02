import { readFileSync } from "fs"
import { join } from "path"

/**
 * Dit de quel commit du depot l'application servie est issue.
 *
 * REP-96, story 2.8. Le 15-08-2026, l'image en service datait du 09-08 et
 * accusait 67 commits de retard — sans qu'AUCUN ecran, aucune sonde, aucun
 * journal ne puisse le dire. Le cout a ete mesure, et il n'a pas ete
 * theorique : la verification a d'abord conclu a une regression de securite
 * qui n'existait pas, et il a fallu DATER l'image pour l'ecarter.
 *
 * La sonde de la story 2.6 ne ferme pas ce cas. Elle compare les migrations
 * embarquees a celles appliquees, donc elle voit la derive QUI CASSE
 * L'AUTHENTIFICATION — la forme de BUG-37. Une image en retard dont aucune
 * migration n'a bouge passe integralement dessous : c'est exactement le
 * 15-08, ou 67 commits n'avaient touche a aucun schema.
 *
 * POURQUOI UN FICHIER, ET PAS UNE VARIABLE D'ENVIRONNEMENT.
 *
 * Mesure du 17-08-2026, sur une image jetable batie sur alpine, portant a
 * la fois une `ENV COMMIT_SHA` et un fichier graves a la construction :
 *
 *   docker run --rm -e COMMIT_SHA=valeur-venue-du-.env image
 *   -> ENV=[valeur-venue-du-.env]   FICHIER=[abc1234]
 *
 * `docker-compose.prod.yml` charge `.env` dans le conteneur applicatif
 * (`env_file: - .env`), et un `env_file` pose exactement les variables que
 * `-e` pose. Une `ENV` gravee dans l'image serait donc ECRASEE par une
 * variable homonyme venue de `.env`, et cette fonction annoncerait un
 * commit qui n'est pas celui de l'image — une affirmation que le code ne
 * tient pas, ce que CLAUDE.md §7 traite comme un defaut.
 *
 * L'environnement ne peut rien contre un fichier. Le depot a deja ce
 * motif : `prisma/migrations` est un fait de l'image, recopie par le
 * Dockerfile et lu par `lib/migrations.ts`.
 *
 * CE MODULE NE DEPEND PAS DE PRISMA, a dessein : c'est ce qui permet a la
 * sonde de rendre le commit MEME QUAND LA BASE EST INJOIGNABLE — le moment
 * ou l'on en a le plus besoin.
 */

/** Le marqueur grave par `docker/Dockerfile`, etage `production`. */
const MARQUEUR = ".commit"

/** Ce a quoi ressemble un commit git, court ou complet. */
const FORME = /^[0-9a-f]{7,40}$/

/**
 * Ce que rend cette fonction quand elle ne sait pas.
 *
 * VALEUR EXPLICITE, JAMAIS UN CHAMP ABSENT. Un champ manquant se lit comme
 * « ce produit est trop ancien pour le dire », indiscernable de « ce
 * produit ne sait pas d'ou il vient » — et les deux appellent des gestes
 * differents. La sonde de la story 2.6 a deja tranche dans ce sens avec
 * `schema: "incomparable"`.
 */
export const COMMIT_INCONNU = "inconnu"

/**
 * ON NE MET PAS EN CACHE, et c'est un arbitrage.
 *
 * `lib/migrations.ts` cache sa lecture, avec le motif « le dossier est fige
 * dans l'image ». Le meme motif vaudrait ici. Mais un cache rendrait les
 * deux etats — marqueur present, marqueur absent — INOBSERVABLES dans un
 * meme processus, et nous couterait la seule preuve de cette story qui
 * porte sur le produit REELLEMENT SERVI (tests/deploiement.spec.ts). Un
 * fichier de 40 octets relu toutes les 30 s ne se compare pas a ce cout-la.
 */
export function commitServi(): string {
  let brut: string

  try {
    brut = readFileSync(join(process.cwd(), MARQUEUR), "utf-8").trim()
  } catch {
    // Marqueur absent : construction sans l'ARG, ou execution hors
    // conteneur (`npm start` sur le poste, la suite de tests). Ce n'est
    // pas une anomalie, on ne journalise pas.
    return COMMIT_INCONNU
  }

  if (!FORME.test(brut)) {
    /**
     * La QUELQU'UN S'EST TROMPE, contrairement au cas ci-dessus : le
     * marqueur existe et ne porte pas un commit. On le dit dans les logs.
     *
     * Et on ne rend pas la valeur telle quelle : cette route est PUBLIQUE,
     * un `COMMIT_SHA` mal pose y verserait un texte arbitraire de longueur
     * non bornee.
     */
    console.error(
      `[version] le marqueur ${MARQUEUR} ne porte pas un commit (${brut.length} caracteres)`
    )

    return COMMIT_INCONNU
  }

  return brut
}
