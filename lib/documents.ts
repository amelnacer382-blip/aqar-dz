import { prisma } from "@/lib/prisma"
import { keyFromUrl } from "@/lib/storage"

/**
 * Rattacher un fichier de document a une agence.
 *
 * La garde de cloisonnement habituelle — `findFirst({ where: { id,
 * agencyId } })` — prouve que la *ligne* appartient a l'agence. Elle ne
 * prouve rien sur le *fichier* qu'elle designe : `Document.url` est une
 * chaine libre, editable depuis le formulaire (BUG-21, story 1.7), et
 * tous les fichiers ont longtemps vecu dans un meme dossier plat.
 *
 * Une agence pouvait donc coller dans l'`url` d'un de ses propres
 * documents la cle d'un document d'une autre agence — le scenario exact
 * de BUG-04, ou l'adresse a fuite par un partage ou un journal — et le
 * telecharger avec un 200. Ce module est le controle qui manquait.
 *
 * Deux dispositions coexistent, et c'est temporaire :
 *
 *   - **la nouvelle** : `documents/<agencyId>/<fichier>`. Le cloisonnement
 *     est porte par le chemin lui-meme, donc verifiable sans requete.
 *   - **l'heritee** : `documents/<fichier>`, a plat, telle que deposee
 *     avant le 10-08-2026. Ces fichiers ne sont pas deplaces (AC 6 de la
 *     story 1.3), mais l'exception est refermee par une verification en
 *     base : si une autre agence revendique la meme adresse, c'est qu'elle
 *     a ete recopiee, et l'acces est refuse.
 *
 * La tolerance heritee disparaitra le jour ou plus aucune ligne ne porte
 * d'adresse a plat.
 */

/** Adresse a plat, sans sous-dossier : disposition anterieure. */
const HERITE = /^documents\/[^/]+$/

/**
 * L'adresse designe-t-elle un fichier depose par cette agence ?
 *
 * Variante sans acces a la base, destinee a l'ECRITURE : au moment ou
 * une agence enregistre un document, on exige la disposition courante,
 * sans tolerance heritee — celle-ci n'existe que pour les lignes deja
 * ecrites.
 *
 * La forme est verifiee par `documentSchema` ; l'appartenance ne peut
 * l'etre qu'ici, un schema Zod ne sachant pas qui lui parle. C'est la
 * distinction que la story 1.3 avait manquee : une adresse bien formee
 * peut parfaitement designer le dossier d'une autre agence.
 */
export function ownsDocumentUrl(url: string, agencyId: string): boolean {
  // Volontairement sans `keyFromUrl` : son motif local n'est pas ancre et
  // retient la premiere occurrence de « /uploads/ » n'importe ou dans la
  // chaine. Il rendrait donc un verdict d'appartenance sur une
  // sous-chaine — correct tant que le schema ancre la valeur en amont,
  // faux le jour ou quelqu'un appelle cette fonction sans lui. Un
  // controle de securite ne doit pas dependre de l'ancrage d'un autre
  // module ; celui-ci compare des prefixes complets, sur l'adresse
  // entiere.
  if (url.startsWith(`/uploads/documents/${agencyId}/`)) return true

  const base = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "")
  const seau = process.env.SUPABASE_STORAGE_BUCKET?.trim()

  if (!base || !seau) return false

  return url.startsWith(
    `${base}/storage/v1/object/public/${seau}/documents/${agencyId}/`
  )
}

export async function documentKeyFor(
  url: string,
  agencyId: string
): Promise<string | null> {
  const key = keyFromUrl(url)

  if (!key) return null

  // Disposition courante : le chemin porte l'agence.
  if (key.startsWith(`documents/${agencyId}/`)) return key

  if (!HERITE.test(key)) return null

  // Fichier a plat : nul autre que son proprietaire ne doit le reclamer.
  const usurpateur = await prisma.document.findFirst({
    where: { url, agencyId: { not: agencyId } },
    select: { id: true },
  })

  return usurpateur ? null : key
}
