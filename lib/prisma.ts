import { PrismaClient } from "@prisma/client"

/**
 * Modeles a suppression reversible.
 *
 * Leur suppression pose une date dans `deletedAt` au lieu d'effacer la
 * ligne. Il faut donc exclure ces lignes des lectures. Les filtrer une par
 * une garantissait un oubli : le filtre est pose ici, une fois, sur le
 * client lui-meme.
 *
 * ⚠ CE QU'IL COUVRE, ET CE QU'IL NE COUVRE PAS.
 *
 * La version precedente de ce commentaire disait « toutes les lectures ».
 * C'etait faux, et cette phrase a coute cinq compteurs errones pendant
 * plusieurs semaines (BUG-24, ferme par la story 3.5). Ce qui est vrai :
 *
 *   COUVERT      le `where` de PREMIER NIVEAU des operations listees dans
 *                READ_OPERATIONS ci-dessous.
 *
 *   NON COUVERT  les relations imbriquees — `include: { properties: … }` —
 *                et les `_count: { select: { properties: true } }`. Ce ne
 *                sont pas des operations distinctes : l'extension ne les
 *                voit jamais passer. Chaque relation AU PLURIEL pointant
 *                vers un modele d'ici doit porter son propre
 *                `where: { deletedAt: null }`.
 *
 *   NON COUVERT  `findUnique` et `findUniqueOrThrow`, voir READ_OPERATIONS.
 *
 *   NON COUVERT  les ECRITURES. Un `update` sur un identifiant en corbeille
 *                aboutit.
 *
 * Les relations AU SINGULIER — `property`, `client`, `owner` depuis une
 * location, une vente, une visite — ne doivent PAS etre filtrees : une
 * quittance dont le locataire est a la corbeille doit garder son nom.
 * C'est l'arbitrage de la story 3.9 (BUG-34), pas un oubli.
 */
const SOFT_DELETE_MODELS = new Set(["Property", "Client", "Owner"])

/**
 * Operations de lecture auxquelles on peut ajouter une condition.
 *
 * `findUnique` en est volontairement absent : Prisma n'y accepte que des
 * champs uniques dans le `where`. Ce n'est donc pas un choix mais une
 * limite, et elle est desormais tenue par une regle ESLint
 * (`.eslintrc.json`) qui refuse `findUnique` sur ces trois modeles — le
 * dernier appel restant, dans le formulaire public de la vitrine, a ete
 * remplace par un `findFirst` en meme temps.
 */
const READ_OPERATIONS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
])

function createPrismaClient() {
  return new PrismaClient().$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (
            !SOFT_DELETE_MODELS.has(model) ||
            !READ_OPERATIONS.has(operation)
          ) {
            return query(args)
          }

          const typed = args as { where?: Record<string, unknown> }
          const where = typed.where ?? {}

          // Une requete qui parle explicitement de deletedAt sait ce
          // qu'elle fait : c'est ainsi que la corbeille lit les lignes
          // supprimees.
          if (!("deletedAt" in where)) {
            typed.where = { ...where, deletedAt: null }
          }

          return query(args)
        },
      },
    },
  })
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
