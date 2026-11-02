import type { Decimal } from "@prisma/client/runtime/library"

type Numeric = number | string | Decimal | null | undefined

/** Convertit un Decimal Prisma (non serialisable vers le client) en number. */
export function toNumber(value: Numeric): number {
  if (value === null || value === undefined) return 0
  return typeof value === "number" ? value : Number(value.toString())
}

/** 1250000 -> "1 250 000 DA" */
export function formatDZD(value: Numeric): string {
  const n = toNumber(value)
  return `${n.toLocaleString("fr-DZ", { maximumFractionDigits: 2 })} DA`
}

/** Version compacte pour les cartes de statistiques : 1 250 000 -> "1.25 M DA" */
export function formatDZDCompact(value: Numeric): string {
  const n = toNumber(value)
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} Md DA`
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M DA`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)} k DA`
  return `${n.toLocaleString("fr-DZ")} DA`
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-"
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function formatDateLong(date: Date | string | null | undefined): string {
  if (!date) return "-"
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/** Valeur pour un <input type="date"> : "2026-08-02" */
export function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return ""
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ""

  /*
    LE JOUR CIVIL LOCAL, ET NON LA DATE UTC (BUG-40, story 3.11).

    Cette fonction rendait `d.toISOString().slice(0, 10)`. Or les dates du
    produit sont ecrites a MINUIT LOCAL — mesure du 18-08-2026 sur la base
    de developpement, en UTC+1 :

      Visit.date          5 lignes sur 5   a T23:00:00.000Z
      Payment.date        6 lignes sur 6   a T23:00:00.000Z

    `2026-07-14T23:00:00Z` EST le 15 juillet en heure locale. Le formulaire
    affichait donc le 14, et l'enregistrement le reecrivait tel quel : la
    visite reculait d'un jour sans que personne ne touche au champ. C'est
    la famille de BUG-34, sur une colonne de date au lieu d'un lien —
    reproduit le 18-08-2026, « Expected 2026-07-15, Received 2026-07-14 ».

    LA CONVENTION EST DESORMAIS UNIQUE ET ECRITE : une date de ce produit
    designe un JOUR CIVIL dans le fuseau de l'agence. On la lit ici en
    parties locales, et `requiredDate` / `optionalDate`
    (`lib/validations/index.ts`) la relisent a minuit LOCAL. Les deux bouts
    doivent bouger ensemble : lire en local et ecrire en UTC ferait deriver
    l'aller-retour d'un jour dans tout fuseau negatif.

    ⚠ En UTC pur, l'ancienne et la nouvelle version rendent la meme chose.
    C'est ce qui a laisse ce defaut passer : il ne se voit pas depuis un
    serveur en UTC, et il se voit tous les jours depuis Alger.
  */
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-")
}

export const MONTH_NAMES = [
  "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
] as const

export function monthLabel(month: number): string {
  return MONTH_NAMES[month - 1] ?? String(month)
}

/** "Aout 2026" */
export function periodLabel(month: number, year: number): string {
  return `${monthLabel(month)} ${year}`
}

/**
 * Calcul du net a reverser au proprietaire pour un mois de gestion locative.
 * Loyer + charges recuperees - depenses avancees par l'agence - commission.
 */
export function computeAmountToOwner(input: {
  rentAmount: Numeric
  charges?: Numeric
  expenses?: Numeric
  commission?: Numeric
}): number {
  return (
    toNumber(input.rentAmount) +
    toNumber(input.charges) -
    toNumber(input.expenses) -
    toNumber(input.commission)
  )
}

/**
 * Table de remplacement des caracteres accentues.
 * On evite volontairement `normalize("NFD")` + classe de diacritiques :
 * cette correspondance explicite est plus lisible et couvre le francais
 * utilise dans les noms d'agences.
 */
const ACCENTED = "àáâãäåçèéêëìíîïñòóôõöøùúûüýÿ"
const PLAIN = "aaaaaaceeeeiiiinoooooouuuuyy"

/** Transforme un nom d'agence en identifiant d'URL : "Agence Demo" -> "agence-demo" */
export function slugify(input: string): string {
  const lowered = input.toLowerCase()
  let unaccented = ""

  for (const char of lowered) {
    const index = ACCENTED.indexOf(char)
    unaccented += index === -1 ? char : PLAIN[index]
  }

  return unaccented
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

/**
 * Nettoie un nom de fichier destine a l'en-tete Content-Disposition.
 *
 * Un nom saisi par une agence finit dans un en-tete HTTP entoure de
 * guillemets. Un guillemet ou un retour chariot dans ce nom permettrait
 * d'y injecter un autre en-tete : ne restent donc que les caracteres
 * inoffensifs. La troncature evite un en-tete demesure.
 *
 * Le repli n'est pas cosmetique : un nom entierement compose de
 * caracteres refuses (« ??? ») donnerait `filename=""`, que les
 * navigateurs interpretent chacun a leur facon.
 */
export function sanitizeFilename(filename: string): string {
  const cleaned = filename
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

  return cleaned || "fichier"
}

/**
 * En-tete Content-Disposition d'un telechargement, nom d'origine preserve.
 *
 * `sanitizeFilename` seule ne garde que l'ASCII : sur ce produit, « عقد
 * بيع » n'en laisse rien et tous les documents d'une agence arrivaient
 * sous le meme « fichier.pdf ». Ce n'est pas un cas limite ici, c'est le
 * cas courant.
 *
 * La RFC 6266 prevoit exactement cela : `filename` en ASCII pour les
 * clients anciens, `filename*` en UTF-8 pourcent-encode pour les autres,
 * qui le preferent quand les deux sont presents. Le repli reste donc
 * necessaire — il n'est plus le seul nom transmis.
 */
export function attachmentHeader(filename: string): string {
  const ascii = sanitizeFilename(filename)
  const utf8 = encodeURIComponent(filename.slice(0, 80))

  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`
}

/**
 * Type MIME utilisable dans un en-tete, ou null.
 *
 * `Document.mimeType` est un champ texte libre de la page d'edition. Pose
 * tel quel dans `Content-Type`, un retour chariot y fait lever le
 * constructeur `Headers` : l'agence rendait son propre document
 * definitivement illisible, avec une 500 qu'aucun ecran n'explique. Un
 * caractere hors latin-1 echoue plus tard encore, a l'ecriture de la
 * reponse. On n'accepte donc que ce qui ressemble a un type MIME.
 */
export function safeMimeType(value: string | null | undefined): string | null {
  if (!value) return null

  const trimmed = value.trim()

  return /^[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*$/.test(
    trimmed
  )
    ? trimmed
    : null
}

/** Date et heure, pour le journal : « 03/08/2026 à 14:32 ». */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—"

  const value = typeof date === "string" ? new Date(date) : date

  return new Intl.DateTimeFormat("fr-DZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value)
}
