import { readdirSync } from "fs"
import { join } from "path"
import { prisma } from "@/lib/prisma"

/**
 * Compare les migrations que CETTE IMAGE embarque a celles que la base a
 * reellement appliquees.
 *
 * BUG-37, 16-08-2026 : la base portait l'enumeration AgencyPlan pendant que
 * l'image servait un client Prisma genere sur `plan String`. Plus personne
 * ne se connectait, et rien ne le disait — `docker-compose.prod.yml:171`
 * garantit que l'application n'est jamais EN AVANCE sur la base, et ne dit
 * rien du cas inverse ; `npm run db:deploy` applique d'ailleurs les
 * migrations depuis l'HOTE, sans consulter le conteneur qui sert.
 *
 * POURQUOI CE MODULE EXISTE ALORS QUE LA SONDE LIT DEJA UNE LIGNE TYPEE :
 * la lecture typee n'attrape la derive QU'UNE FOIS QU'UNE LIGNE L'EXERCE.
 * Une enumeration migree dont aucune ligne ne porte encore la valeur neuve
 * passe dessous — jusqu'au jour ou une agence est creee. Ici, la derive est
 * vue des qu'elle existe.
 */

/** Ce que la base repond quand on lui demande ce qu'elle a applique. */
type LigneMigration = { migration_name: string }

/**
 * Les migrations embarquees, lues une seule fois.
 *
 * Elles ne peuvent pas changer pendant la vie du processus : le dossier est
 * fige dans l'image. La sonde etant interrogee toutes les 30 s, relire le
 * disque a chaque appel serait du gaspillage sans contrepartie.
 */
let embarqueesEnCache: string[] | null = null

/**
 * Lit `prisma/migrations/` a la racine de l'application.
 *
 * En conteneur, le dossier n'y est QUE parce que le Dockerfile l'y recopie
 * — la sortie autonome de Next ne le trace pas. Si la recopie disparait, la
 * lecture leve, et l'appelant refuse de declarer la pile saine : une
 * comparaison qu'on ne peut pas faire ne doit jamais se lire comme une
 * comparaison reussie.
 */
export function migrationsEmbarquees(): string[] {
  if (embarqueesEnCache) return embarqueesEnCache

  const dossier = join(process.cwd(), "prisma", "migrations")

  embarqueesEnCache = readdirSync(dossier, { withFileTypes: true })
    .filter((entree) => entree.isDirectory())
    .map((entree) => entree.name)
    .sort()

  return embarqueesEnCache
}

export type EcartDeMigrations = {
  /** Appliquees en base, INCONNUES de cette image. C'est la forme de BUG-37. */
  imageEnRetard: string[]
  /** Embarquees par l'image, JAMAIS appliquees. La base est en retard. */
  baseEnRetard: string[]
}

/**
 * Rend l'ecart dans les deux sens.
 *
 * LES DEUX SENS COMPTENT, meme si l'ordonnancement Compose en couvre un :
 * il ne le couvre que pour qui deploie par `docker compose up`. Une image
 * reconstruite a la main, ou une migration appliquee depuis l'hote, sortent
 * toutes deux de ce chemin — et c'est par la que BUG-37 est arrive.
 *
 * `finished_at IS NOT NULL` : une migration commencee et jamais terminee
 * n'est pas appliquee. `rolled_back_at IS NULL` : une migration annulee non
 * plus. Compter une ligne presente pour une migration appliquee ferait dire
 * a la sonde que tout va bien sur une base a moitie migree.
 */
export async function ecartDeMigrations(): Promise<EcartDeMigrations> {
  const embarquees = migrationsEmbarquees()

  const lignes = await prisma.$queryRaw<LigneMigration[]>`
    SELECT migration_name
    FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  `

  // On filtre le TABLEAU, on n'etale pas le `Set` : la cible TypeScript du
  // projet interdit d'iterer un Set (TS2802). Le meme piege est deja
  // documente dans tests/deploiement.spec.ts.
  const appliquees = lignes.map((ligne) => ligne.migration_name)
  const dejaAppliquees = new Set(appliquees)
  const connues = new Set(embarquees)

  return {
    imageEnRetard: appliquees.filter((nom) => !connues.has(nom)).sort(),
    baseEnRetard: embarquees.filter((nom) => !dejaAppliquees.has(nom)),
  }
}
