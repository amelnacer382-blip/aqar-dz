"use server"

import { compare } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { loginSchema } from "@/lib/validations"
import { callerIp, rateLimit, cleDeCompteur } from "@/lib/rate-limit"

/**
 * Explique pourquoi une connexion vient d'echouer.
 *
 * `authorize()` ne peut renvoyer qu'un echec generique : cette action donne
 * la raison exacte pour l'afficher a l'utilisateur.
 *
 * Le mot de passe est revalide ici AVANT de reveler quoi que ce soit sur le
 * compte. Sans cela, la reponse permettrait d'enumerer les comptes existants
 * et de decouvrir le statut d'une agence sans en connaitre les identifiants.
 *
 * Cette revalidation est un second endroit ou l'on peut essayer des mots de
 * passe : elle est donc limitee comme la connexion elle-meme, avec son
 * propre budget de tentatives.
 */
export async function explainLoginFailure(
  email: string,
  password: string
): Promise<string> {
  const GENERIC = "Email ou mot de passe incorrect"

  const validated = loginSchema.safeParse({ email, password })

  if (!validated.success) {
    return GENERIC
  }

  // Memes seuils que la connexion elle-meme (voir auth.ts) : large par
  // adresse, car toute une agence sort par la meme ; etroit par compte,
  // qui est la cle reellement visee par une attaque.
  const ip = await callerIp()
  const window = 15 * 60 * 1000

  // PAR ADRESSE, en amont : le seul compteur qui refuse avant d'avoir
  // verifie. Meme raisonnement que dans `auth.ts` — il protege le serveur,
  // pas le compte.
  const budgetAdresse = rateLimit({
    key: cleDeCompteur("explication:ip", ip),
    limit: 60,
    windowMs: window,
  })

  // Les deux compteurs sont consommes, puis on decide (REP-39).
  const penaliser = () =>
    rateLimit({
      key: cleDeCompteur("explication:compte", validated.data.email),
      limit: 10,
      windowMs: window,
    })

  if (!budgetAdresse.ok) {
    penaliser()
    return "Trop de tentatives de connexion. Réessayez dans quelques minutes."
  }

  const user = await prisma.user.findUnique({
    where: { email: validated.data.email },
    include: { agency: true },
  })

  // Un compte INCONNU emprunte la meme sortie qu'un mot de passe faux :
  // sans cela, l'absence de bcrypt et de penalite rendait les deux cas
  // distinguables au chronometre, et l'existence d'une adresse enumerable.
  let passwordMatches = false

  if (user?.password) {
    try {
      passwordMatches = await compare(validated.data.password, user.password)
    } catch {
      passwordMatches = false
    }
  }

  if (!user || !passwordMatches) {
    /**
     * L'echec est CONSTATE : c'est maintenant qu'on le compte.
     *
     * Ce compteur etait consomme avant la verification, comme celui de
     * `auth.ts` — et il fermait donc la deuxieme des trois portes d'un
     * compte, celle qui dit POURQUOI l'acces est refuse. Un titulaire
     * legitime la trouvait close en meme temps que la premiere (REP-37).
     */
    const budget = penaliser()

    if (!budget.ok) {
      // Meme penalite progressive que `auth.ts` : un delai plat ne coute
      // rien a qui parallelise.
      await new Promise((suite) =>
        setTimeout(suite, Math.min(30_000, 1000 * 2 ** (budget.depassement - 1)))
      )
    }

    return GENERIC
  }

  // A partir d'ici, l'identite est prouvee : on peut etre precis.
  if (!user.isActive) {
    return "Votre compte utilisateur a été désactivé. Contactez l'administrateur de votre agence."
  }

  if (user.role !== "super_admin") {
    if (!user.agency) {
      return "Votre compte n'est rattaché à aucune agence. Contactez l'équipe Aqar DZ."
    }

    if (user.agency.status === "pending") {
      return "Votre agence n'est pas encore activée par Aqar DZ. Vous serez prévenu dès l'activation."
    }

    if (user.agency.status === "suspended") {
      return "L'accès de votre agence a été suspendu. Contactez l'équipe Aqar DZ."
    }
  }

  return GENERIC
}
