/**
 * Type reel d'un fichier televerse, etabli par ses premiers octets.
 *
 * POURQUOI CE MODULE EXISTE (BUG-09). `/api/upload` admettait un fichier
 * sur la foi de `file.type`, c'est-a-dire de l'en-tete `Content-Type` de
 * la partie multipart — ecrit par l'appelant. Cette seule declaration
 * decidait de trois choses : l'admission, l'extension ecrite sur le
 * disque, et le `contentType` sous lequel le fichier serait RE-SERVI.
 *
 * Le troisieme point est le plus lourd. En production le stockage est
 * Supabase : `contentType` est pose sur l'objet, et `getPublicUrl()`
 * rend une adresse servie par Supabase, donc SANS le
 * `X-Content-Type-Options: nosniff` de notre nginx. Le garde-fou cite
 * dans le registre de defauts ne couvre que le mode local.
 *
 * LA DECLARATION DU CLIENT N'EST PLUS LUE DU TOUT. Comparer le declare
 * au reel parait plus severe ; c'est une illusion. Un attaquant maitrise
 * les deux cotes et obtient l'accord quand il veut. La comparaison
 * n'arrete personne — elle refuse seulement des clients honnetes dont le
 * navigateur a etiquete autrement (`image/jpg` contre `image/jpeg`,
 * `application/octet-stream` faute d'association systeme).
 *
 * CE QUE CE CONTROLE NE FAIT PAS, et il faut le savoir avant de s'y
 * fier : il prouve les PREMIERS OCTETS, pas le fichier. Un PNG
 * authentique peut contenir n'importe quoi apres son en-tete — c'est
 * exactement ainsi que fonctionne un fichier polyglotte. Ce module ferme
 * « un fichier arbitraire est admis sur la seule parole du client ». Il
 * ne ferme pas « un fichier reellement construit comme une image l'est
 * aussi comme autre chose ». Cette seconde classe se ferme par
 * RE-ENCODAGE de l'image, qui detruit ce qui n'est pas de l'image — et
 * qui est impossible pour le PDF. C'est une autre story.
 */

export type TypeReconnu =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "application/pdf"

/**
 * Extension ecrite sur le disque pour chaque type reconnu.
 *
 * C'est la SEULE table qui decide d'une extension. Le nom envoye par le
 * client n'en fournit aucune : il pourrait porter « ../ » ou une
 * extension executable.
 */
export const EXTENSION_PAR_TYPE: Record<TypeReconnu, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
}

/** Nombre d'octets qu'il suffit de lire pour trancher. */
export const OCTETS_UTILES = 12

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG = [0xff, 0xd8, 0xff]
/** « RIFF » a l'offset 0, puis « WEBP » a l'offset 8 : le conteneur RIFF
 *  sert aussi pour AVI et WAV, la seconde marque est ce qui distingue. */
const RIFF = [0x52, 0x49, 0x46, 0x46]
const WEBP = [0x57, 0x45, 0x42, 0x50]
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]

function porte(octets: Uint8Array, signature: number[], depuis: number) {
  if (octets.length < depuis + signature.length) return false
  return signature.every((octet, i) => octets[depuis + i] === octet)
}

/**
 * Renvoie le type admis correspondant au contenu, ou null.
 *
 * Null couvre deux cas qu'il ne sert a rien de distinguer pour
 * l'appelant : un format reel mais non admis (GIF, SVG, ZIP) et un
 * contenu qui n'est aucun format connu.
 *
 * TOUTES les signatures sont exigees A L'OFFSET 0, y compris celle du
 * PDF. La specification tolere du remplissage avant `%PDF-` et Acrobat
 * lit ces fichiers ; on refuse cette tolerance. Accepter la signature
 * plus loin revient a accepter que les premiers octets soient n'importe
 * quoi — c'est-a-dire a ouvrir la porte aux polyglottes, qui sont
 * precisement la facon de contourner un controle par signature. Les
 * producteurs de PDF ecrivent leur en-tete a l'octet 0 ; le cout est un
 * cas de bord rare, et il est explicite plutot que silencieux.
 */
export function typeReconnu(octets: Uint8Array): TypeReconnu | null {
  if (porte(octets, PNG, 0)) return "image/png"
  if (porte(octets, JPEG, 0)) return "image/jpeg"
  if (porte(octets, RIFF, 0) && porte(octets, WEBP, 8)) return "image/webp"
  if (porte(octets, PDF, 0)) return "application/pdf"

  return null
}
