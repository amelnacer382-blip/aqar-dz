import { mkdir, writeFile, unlink, readFile as readFromDisk, realpath } from "fs/promises"
import { join, resolve, sep, extname } from "path"
import { createClient } from "@supabase/supabase-js"

/**
 * Stockage des fichiers televerses (photos de biens, logos, documents).
 *
 * Deux modes, choisis par la configuration :
 *
 *   - « supabase » des que SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY et
 *     SUPABASE_STORAGE_BUCKET sont renseignes. C'est le mode a utiliser en
 *     production.
 *   - « local » sinon : ecriture dans public/uploads. Pratique en
 *     developpement, mais le dossier d'une application deployee est
 *     ephemere : les photos disparaitraient au redeploiement. Le demarrage
 *     en production dans ce mode emet donc un avertissement explicite.
 *
 * La cle retournee (`key`) est le chemin interne du fichier ; elle est la
 * seule chose a conserver pour pouvoir le supprimer plus tard, quel que
 * soit le mode.
 */

export type StorageMode = "supabase" | "local"

export type StoredFile = {
  /** Adresse publique du fichier, telle qu'affichee dans une balise img. */
  url: string
  /** Chemin interne, necessaire a la suppression. */
  key: string
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET

export function storageMode(): StorageMode {
  return SUPABASE_URL && SUPABASE_KEY && SUPABASE_BUCKET ? "supabase" : "local"
}

let warned = false

/** Previent une fois si l'on stocke en local alors qu'on est en production. */
function warnIfUnsafe() {
  if (warned || storageMode() === "supabase") return
  warned = true

  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[storage] Stockage LOCAL en production : les fichiers televerses " +
        "seront perdus au prochain deploiement. Renseignez SUPABASE_URL, " +
        "SUPABASE_SERVICE_ROLE_KEY et SUPABASE_STORAGE_BUCKET."
    )
  }
}

function supabase() {
  return createClient(SUPABASE_URL as string, SUPABASE_KEY as string, {
    auth: { persistSession: false },
  })
}

/** Depose un fichier et renvoie son adresse publique. */
export async function putFile({
  buffer,
  folder,
  filename,
  contentType,
}: {
  buffer: Buffer
  /** Sous-dossier logique : properties, agencies, documents. */
  folder: string
  filename: string
  contentType: string
}): Promise<StoredFile> {
  warnIfUnsafe()

  const key = `${folder}/${filename}`

  if (storageMode() === "supabase") {
    const { error } = await supabase()
      .storage.from(SUPABASE_BUCKET as string)
      .upload(key, buffer, { contentType, upsert: false })

    if (error) {
      throw new Error(`Stockage indisponible : ${error.message}`)
    }

    const { data } = supabase()
      .storage.from(SUPABASE_BUCKET as string)
      .getPublicUrl(key)

    return { url: data.publicUrl, key }
  }

  const dir = join(process.cwd(), "public", "uploads", folder)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, filename), buffer)

  return { url: `/uploads/${key}`, key }
}

/**
 * Racine sous laquelle tout fichier local doit rester, sans exception.
 */
const UPLOADS_ROOT = join(process.cwd(), "public", "uploads")

/**
 * Valide une cle avant tout acces au stockage, et renvoie null si elle
 * sort du dossier des televersements.
 *
 * Ce verrou n'est pas theorique. `Document.url` est une chaine libre
 * (voir BUG-21) : la cle qui arrive ici a pu etre choisie par
 * l'utilisateur. Sans ce controle, `/uploads/../.env` se resout hors du
 * projet et livre NEXTAUTH_SECRET et DATABASE_URL a tout compte
 * authentifie. La lecture protegee des documents creerait alors une
 * faille bien pire que celle qu'elle ferme.
 *
 * Trois precautions, chacune pour une raison distincte :
 *
 *   - le decodage pourcent d'abord, sinon `%2e%2e%2f` passerait ce
 *     controle et serait interprete plus bas ;
 *   - la resolution reelle du chemin plutot qu'une recherche de « .. »
 *     dans la chaine, qui laisse passer les formes detournees ;
 *   - le refus de l'octet nul, qui tronque le nom au niveau de l'appel
 *     systeme sous certains runtimes.
 *
 * Les liens symboliques echappent a `resolve()`, purement lexical : ils
 * sont traites par `verifiedPath`, apres resolution reelle sur disque.
 */
function safeKey(key: string): string | null {
  if (!key) return null

  let decoded: string
  try {
    decoded = decodeURIComponent(key)
  } catch {
    // Sequence pourcent invalide : on ne devine pas l'intention.
    return null
  }

  if (decoded.includes("\0")) return null
  if (decoded.startsWith("/") || decoded.startsWith("\\")) return null

  // Aucune remontee, meme si elle retombe sous la racine.
  //
  // Le seul controle de racine ne suffisait pas : `documents/../properties/
  // photo.jpg` reste sous public/uploads et passait, ce qui laissait un
  // compte d'agence lire — et supprimer — les fichiers d'une autre. Une
  // cle legitime n'a jamais besoin de « .. » : elle est construite par
  // `putFile`, pas ecrite a la main.
  if (decoded.split(/[/\\]/).includes("..")) return null

  const resolved = resolve(UPLOADS_ROOT, decoded)

  if (resolved !== UPLOADS_ROOT && !resolved.startsWith(UPLOADS_ROOT + sep)) {
    return null
  }

  return decoded
}

let racineReelle: string | null = null

/**
 * Racine des televersements, liens symboliques suivis.
 *
 * `UPLOADS_ROOT` est construit lexicalement par `join`. Comparer un chemin
 * resolu par `realpath` a une racine qui ne l'est pas fait echouer toute
 * verification des que `public/uploads` est lui-meme un lien — montage de
 * volume hors conteneur, cas ordinaire du stockage local sur disque
 * persistant, qui est justement le seul mode autorise en production. Sans
 * cela, tous les documents repondaient 404 et aucune suppression ne
 * passait.
 */
async function realRoot(): Promise<string> {
  if (racineReelle) return racineReelle

  try {
    racineReelle = await realpath(UPLOADS_ROOT)
  } catch {
    // Le dossier n'existe pas encore : la comparaison lexicale reste
    // correcte tant qu'aucun lien n'est en jeu.
    racineReelle = UPLOADS_ROOT
  }

  return racineReelle
}

/**
 * Chemin absolu d'une cle locale, une fois les liens symboliques suivis.
 * Renvoie null si la cle est refusee, si le fichier n'existe pas, ou si
 * sa cible reelle se trouve hors du dossier des televersements.
 *
 * Ce controle recouvre volontairement celui de `safeKey` : l'un est
 * lexical et vaut pour les deux modes de stockage, l'autre interroge le
 * disque et rattrape les liens symboliques. Retirer les deux ouvre la
 * lecture de fichier arbitraire — verifie par mutation, voir la story.
 */
async function verifiedPath(key: string): Promise<string | null> {
  const safe = safeKey(key)
  if (!safe) return null

  try {
    const racine = await realRoot()
    const real = await realpath(resolve(UPLOADS_ROOT, safe))

    if (real !== racine && !real.startsWith(racine + sep)) {
      return null
    }

    return real
  } catch {
    // Fichier absent : indiscernable d'une cle invalide pour l'appelant.
    return null
  }
}

/** Types devines a partir de l'extension, faute de mieux. */
const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

export type LoadedFile = {
  buffer: Buffer
  /** Devine d'apres l'extension ; l'appelant a souvent mieux en base. */
  contentType: string
}

/**
 * Lit un fichier du stockage. Renvoie null pour toute cle refusee ou
 * introuvable — l'appelant ne doit pas pouvoir distinguer les deux, sans
 * quoi la route deviendrait un outil d'exploration du disque.
 */
export async function readFile(key: string): Promise<LoadedFile | null> {
  const contentType =
    CONTENT_TYPES[extname(key).toLowerCase()] ?? "application/octet-stream"

  if (storageMode() === "supabase") {
    // Meme verrou : la cle est tout aussi libre, et « .. » a un sens
    // dans un chemin d'objet.
    const safe = safeKey(key)
    if (!safe) return null

    const { data, error } = await supabase()
      .storage.from(SUPABASE_BUCKET as string)
      .download(safe)

    if (error || !data) return null

    return {
      buffer: Buffer.from(await data.arrayBuffer()),
      contentType: data.type || contentType,
    }
  }

  const path = await verifiedPath(key)
  if (!path) return null

  try {
    return { buffer: await readFromDisk(path), contentType }
  } catch {
    return null
  }
}

/**
 * Supprime un fichier. L'echec n'est jamais fatal : un fichier orphelin
 * coute moins cher qu'une suppression metier bloquee par le stockage.
 *
 * La cle passe par le meme verrou que la lecture : sans lui, supprimer
 * un document dont l'`url` a ete forgee effacait un fichier arbitraire
 * du serveur (BUG-21). C'est irreversible — le refus est silencieux
 * pour l'appelant, mais trace dans la console.
 */
export async function deleteFile(key: string): Promise<void> {
  try {
    if (storageMode() === "supabase") {
      const safe = safeKey(key)

      if (!safe) {
        console.warn("[storage] cle refusee a la suppression", key)
        return
      }

      await supabase()
        .storage.from(SUPABASE_BUCKET as string)
        .remove([safe])
      return
    }

    const path = await verifiedPath(key)

    if (!path) {
      console.warn("[storage] cle refusee ou introuvable a la suppression", key)
      return
    }

    await unlink(path)
  } catch (error) {
    console.warn("[storage] suppression impossible", key, error)
  }
}

/**
 * Retrouve la cle a partir d'une adresse publique enregistree en base.
 * Renvoie null si l'adresse ne vient pas de notre stockage.
 */
export function keyFromUrl(url: string): string | null {
  const local = url.match(/\/uploads\/(.+)$/)
  if (local) return local[1]

  if (SUPABASE_BUCKET) {
    const remote = url.match(
      new RegExp(`/object/public/${SUPABASE_BUCKET}/(.+)$`)
    )
    if (remote) return remote[1]
  }

  return null
}
