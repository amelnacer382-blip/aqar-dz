import { Prisma } from "@prisma/client"

/**
 * Rend une valeur Prisma transmissible a un composant client.
 *
 * Prisma renvoie les colonnes numeriques exactes (prix, loyers, budgets,
 * commissions) sous forme d'objets Decimal. React refuse de les faire
 * traverser la frontiere serveur → client : chaque objet non converti
 * declenche « Only plain objects can be passed to Client Components ». La
 * conversion etait faite champ par champ, donc oubliee des qu'un champ
 * s'ajoutait — `commission` et `budget` passaient encore.
 *
 * On convertit ici en nombre, une bonne fois, en profondeur. La precision
 * decimale n'a pas d'utilite cote affichage : les montants y sont formates,
 * jamais recalcules. Les calculs restent cote serveur, sur les Decimal.
 */
/**
 * Le type resultat : Decimal devient number, le reste est traverse a
 * l'identique. Sans ce type, le compilateur continuait a croire que les
 * montants etaient des Decimal apres conversion.
 */
export type Plain<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? Date
    : T extends Array<infer U>
      ? Plain<U>[]
      : T extends object
        ? { [K in keyof T]: Plain<T[K]> }
        : T

export function toPlain<T>(value: T): Plain<T> {
  if (value === null || value === undefined) {
    return value as Plain<T>
  }

  if (value instanceof Prisma.Decimal) {
    return value.toNumber() as Plain<T>
  }

  if (value instanceof Date) {
    return value as Plain<T>
  }

  if (Array.isArray(value)) {
    return value.map((item) => toPlain(item)) as Plain<T>
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {}

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = toPlain(item)
    }

    return result as Plain<T>
  }

  return value as Plain<T>
}
