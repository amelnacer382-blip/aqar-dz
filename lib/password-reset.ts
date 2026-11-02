import { createHash, randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"

/**
 * Reinitialisation de mot de passe.
 *
 * Le jeton en clair n'existe qu'une fois, dans le lien envoye par email.
 * La base ne stocke que son empreinte SHA-256 : une lecture de la table ne
 * permet donc pas de prendre la main sur un compte.
 *
 * Un jeton est valable une heure et une seule fois. Toute nouvelle demande
 * invalide les jetons precedents du meme compte, pour qu'un lien oublie
 * dans une boite mail ne reste pas actif.
 */
const VALIDITY_MS = 60 * 60 * 1000

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/** Cree un jeton et renvoie sa version en clair, a mettre dans le lien. */
export async function createResetToken(userId: string): Promise<string> {
  await prisma.passwordResetToken.deleteMany({
    where: { userId, usedAt: null },
  })

  const token = randomBytes(32).toString("hex")

  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + VALIDITY_MS),
    },
  })

  return token
}

/**
 * Verifie un jeton et renvoie l'utilisateur concerne, ou null.
 * Ne consomme pas le jeton : la consommation a lieu apres le changement.
 */
export async function findValidToken(token: string) {
  if (!token) return null

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true, isActive: true } } },
  })

  if (!record) return null
  if (record.usedAt) return null
  if (record.expiresAt.getTime() < Date.now()) return null
  if (!record.user.isActive) return null

  return record
}

/** Marque le jeton comme consomme. */
export async function consumeToken(id: string): Promise<void> {
  await prisma.passwordResetToken.update({
    where: { id },
    data: { usedAt: new Date() },
  })
}
