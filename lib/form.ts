import { z } from "zod"

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string }

/**
 * Valide un FormData contre un schema Zod.
 *
 * Les Server Actions recevaient jusqu'ici des `formData.get(x) as Enum`,
 * c'est-a-dire aucune validation : une valeur d'enum invalide partait
 * directement dans Prisma et faisait planter la page avec une erreur
 * technique. Ici on renvoie un message lisible, en francais, rattache
 * au premier champ fautif.
 */
export function parseForm<S extends z.ZodTypeAny>(
  schema: S,
  formData: FormData
): ParseResult<z.infer<S>> {
  const raw: Record<string, unknown> = {}

  // forEach plutot que for..of : la cible TypeScript du projet est ES5,
  // qui n'autorise pas l'iteration directe d'un FormDataIterator.
  formData.forEach((value, key) => {
    if (typeof value === "string") {
      raw[key] = value
    }
  })

  const parsed = schema.safeParse(raw)

  if (parsed.success) {
    return { ok: true, data: parsed.data }
  }

  const first = parsed.error.errors[0]
  const field = first?.path?.join(".")
  const message = first?.message ?? "Donnees invalides"

  return {
    ok: false,
    message: field ? `${message} (champ : ${field})` : message,
  }
}

/**
 * Construit l'URL de retour d'une Server Action en cas d'echec de validation.
 * La page cible relit `?error=` et affiche le message via <FormError />.
 */
export function withError(path: string, message: string): string {
  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}error=${encodeURIComponent(message)}`
}

/** Idem pour un message de succes. */
export function withSuccess(path: string, message: string): string {
  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}success=${encodeURIComponent(message)}`
}
