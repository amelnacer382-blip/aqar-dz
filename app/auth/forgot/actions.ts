"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { createResetToken } from "@/lib/password-reset"
import { appUrl, mailerConfigured } from "@/lib/mailer"
import { sendPasswordResetEmail } from "@/lib/notifications"
import { callerIp, rateLimit, cleDeCompteur } from "@/lib/rate-limit"

// Meme normalisation que loginSchema : sans le `.toLowerCase()`, la
// recherche du compte echouerait pour une simple majuscule et
// l'utilisateur attendrait un email qui ne partirait jamais — l'ecran
// repondant volontairement la meme chose dans tous les cas, rien ne le
// lui dirait.
const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
})

export type ForgotResult = {
  /** Message affiche a l'utilisateur, identique dans tous les cas. */
  message: string
  /** Vrai si la messagerie n'est pas configuree sur ce serveur. */
  mailerMissing: boolean
}

/**
 * Demande de reinitialisation.
 *
 * La reponse est volontairement identique que le compte existe ou non :
 * une reponse differenciee permettrait d'enumerer les comptes de la
 * plateforme. Le travail reel (jeton + email) n'a lieu que si le compte
 * existe, mais l'utilisateur ne peut pas le deduire de l'ecran.
 */
export async function requestPasswordReset(
  _prev: ForgotResult | null,
  formData: FormData
): Promise<ForgotResult> {
  const generic = {
    message:
      "Si un compte existe avec cette adresse, un lien de réinitialisation vient d'être envoyé. Vérifiez votre boîte de réception.",
    mailerMissing: !mailerConfigured(),
  }

  const parsed = schema.safeParse({ email: formData.get("email") })

  if (!parsed.success) {
    return generic
  }

  // Cinq demandes par heure. Au-dela, on rend la meme reponse sans rien
  // envoyer : un tiers ne doit pas pouvoir inonder la boite d'un
  // utilisateur en rejouant le formulaire, ni deviner qu'il a ete arrete.
  //
  // LES DEUX COMPTEURS SONT CONSOMMES, PUIS ON DECIDE. `.some()` s'arretait
  // au premier `true` : quand le budget par adresse saturait, celui par
  // compte n'etait plus appele du tout. Les budgets n'etaient donc pas
  // independants, contrairement a ce que ce commentaire affirmait, et un
  // attaquant qui saturait volontairement le premier retardait d'autant le
  // redemarrage du second (REP-39).
  //
  // Ce compteur par compte est CONSERVE : il protege une boite mail contre
  // l'inondation — une ressource qui appartient a un tiers, pas au produit.
  // Ce qui le rendait nuisible etait d'etre la DERNIERE porte ouverte ; la
  // connexion etant reparee (story 1.9), en fermer l'acces une heure n'est
  // plus un deni d'acces mais un delai sur un chemin de secours.
  const ip = await callerIp()
  const fenetre = 60 * 60 * 1000
  const parAdresse = rateLimit({ key: cleDeCompteur("oubli:ip", ip), limit: 5, windowMs: fenetre })
  const parCompte = rateLimit({
    key: cleDeCompteur("oubli:compte", parsed.data.email),
    limit: 5,
    windowMs: fenetre,
  })

  if (!parAdresse.ok || !parCompte.ok) {
    return generic
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, isActive: true },
  })

  if (!user || !user.isActive) {
    return generic
  }

  const token = await createResetToken(user.id)

  await sendPasswordResetEmail({
    to: user.email,
    resetUrl: `${appUrl()}/auth/reset/${token}`,
  })

  return generic
}
