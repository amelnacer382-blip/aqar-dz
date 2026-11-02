/**
 * Generation de CSV lisibles par Excel en configuration francaise.
 *
 * Deux details qui font toute la difference a l'ouverture du fichier :
 *  - le separateur est le point-virgule, pas la virgule. Excel en locale
 *    francaise attend le point-virgule ; avec une virgule, tout atterrit
 *    dans une seule colonne.
 *  - le fichier commence par un BOM UTF-8, sans lequel Excel affiche
 *    « BÃ©jaÃ¯a » au lieu de « Béjaïa ».
 */
const SEPARATOR = ";"
const BOM = "﻿"

/**
 * Premiers caracteres qui font d'une cellule une FORMULE.
 *
 * Excel et LibreOffice les interpretent meme lorsque la valeur etait
 * entouree de guillemets dans le fichier : le dequotage a lieu avant
 * l'evaluation. Le guillemetage ci-dessous ne protege donc de rien.
 */
const DEBUT_DE_FORMULE = /^[=+\-@\t\r\n]/

/**
 * Valeur qui commence par `+` ou `-` mais ne peut designer AUCUNE formule.
 *
 * Un numero de telephone international est le cas nominal du produit :
 * `optionalPhone` autorise le `+` de tete (`lib/validations/index.ts`), le
 * jeu de donnees de demonstration n'en contient pas d'autre forme, et
 * trois exports portent cette colonne — clients, proprietaires, messages.
 * Les prefixer tous revenait a poser une apostrophe sur une colonne de
 * routine pour se proteger d'une charge qui ne peut pas s'y trouver.
 *
 * L'exemption est sure, et pas par confiance : une formule a besoin d'un
 * NOM — de fonction (`HYPERLINK`), de cellule (`A1`) ou de commande DDE
 * (`cmd|…`). Tous exigent une lettre. Une chaine faite uniquement de
 * chiffres, d'espaces, de points, de parentheses et de tirets ne peut
 * donc rien appeler ; au pire un tableur y voit une arithmetique, ce
 * qu'il faisait deja avant cette story.
 *
 * `=`, `@`, la tabulation et les retours a la ligne ne sont JAMAIS
 * exemptes : l'exemption ne porte que sur `+` et `-`.
 */
const NUMERIQUE_INOFFENSIF = /^[+-][0-9\s.()\-]*$/

/**
 * Rend une chaine inerte a l'ouverture dans un tableur.
 *
 * NE S'APPLIQUE QU'AUX CHAINES, et c'est le point delicat de cette
 * fonction. Le tiret figure dans la liste : prefixer sans distinguer le
 * type transformerait tout montant negatif en texte — `-500` deviendrait
 * `'-500` et la colonne des paiements cesserait de s'additionner. Un
 * correctif de securite qui casse la comptabilite d'une agence ne tient
 * pas une semaine. `app/api/export/[entity]/route.ts` convertit les
 * decimaux avec `Number(...)` a neuf endroits, et les dates passent par
 * `toISOString()`.
 *
 * Ce qui GARANTIT la separation n'est pas cette fonction mais la
 * signature de `toCsv`, qui exclut `Decimal` du type accepte : un futur
 * appelant qui oublierait `Number()` ne compilerait pas. `escape()`, elle,
 * ne sait pas traiter un `Decimal` — la branche `object` le rendrait
 * `"""-500"""`, une cellule corrompue. Ne pas elargir le type de `toCsv`
 * sans traiter ce cas.
 *
 * L'apostrophe reste VISIBLE dans certains tableurs — Excel la masque
 * quand elle marque une valeur textuelle, LibreOffice l'affiche. Le
 * compromis est assume : une apostrophe dans une cellule contre
 * l'execution d'une commande sur le poste d'un agent.
 *
 * Le premier caractere est teste BRUT, sans detourage : une valeur
 * commencant par une espace n'est pas interpretee comme une formule —
 * c'est meme le contournement classique — et detourer avant de tester
 * ajouterait des apostrophes sans rien fermer.
 */
function inerte(text: string): string {
  if (!DEBUT_DE_FORMULE.test(text)) return text
  if (NUMERIQUE_INOFFENSIF.test(text)) return text

  return `'${text}`
}

function escape(value: unknown): string {
  if (value === null || value === undefined) return ""

  const text =
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : typeof value === "object"
        ? JSON.stringify(value)
        : typeof value === "string"
          ? inerte(value)
          : String(value)

  // Une valeur contenant separateur, guillemet ou saut de ligne doit etre
  // entouree de guillemets, et ses guillemets doubles.
  //
  // Le guillemetage vient APRES la neutralisation : l'apostrophe doit se
  // trouver A L'INTERIEUR des guillemets, sans quoi elle casserait le
  // guillemetage au lieu de proteger la cellule.
  if (/["\n\r;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

export function toCsv(
  headers: string[],
  rows: (string | number | Date | null | undefined)[][]
): string {
  const lines = [
    headers.map(escape).join(SEPARATOR),
    ...rows.map((row) => row.map(escape).join(SEPARATOR)),
  ]

  return BOM + lines.join("\r\n")
}

/** En-tetes HTTP d'un telechargement CSV. */
export function csvHeaders(filename: string): Record<string, string> {
  const stamp = new Date().toISOString().slice(0, 10)

  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}-${stamp}.csv"`,
    "Cache-Control": "no-store",
  }
}
