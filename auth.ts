import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { loginSchema } from "@/lib/validations"
import { authConfig } from "@/auth.config"
import { callerIp, rateLimit, resetRateLimit, cleDeCompteur } from "@/lib/rate-limit"

/**
 * Fenetre de tentatives de connexion.
 *
 * On compte sur deux cles a la fois, avec deux seuils differents.
 *
 * Par COMPTE, dix echecs CONSTATES par quart d'heure : personne ne se
 * trompe dix fois de suite sur son propre mot de passe. Au-dela, la reponse
 * d'echec est retardee, en doublant a chaque essai.
 *
 * ⚠ CE N'EST PLUS « LA LIMITE QUI PROTEGE REELLEMENT », et cette phrase se
 * trouvait ici. Ce compteur ne REFUSE plus rien : il ne peut pas, sans
 * refermer la porte au titulaire — c'etait REP-37, un tiers verrouillait
 * n'importe quel compte dont il connaissait l'adresse. Il freine, il ne
 * borne pas. La borne est le compteur par adresse, ci-dessous, et elle ne
 * vaut que contre un appelant qui n'en possede qu'une (REP-34).
 *
 * Par ADRESSE IP, beaucoup plus large. Une agence fait sortir tous ses
 * postes par une seule adresse publique : a dix, le lundi matin, une
 * equipe de douze personnes se serait bloquee elle-meme. Ce seuil ne vise
 * pas l'utilisateur qui se trompe, mais le script qui essaie des centaines
 * de comptes depuis une meme machine.
 *
 * Une tentative reussie efface le compteur DU COMPTE, et lui seul. Celui
 * de l'adresse subsiste : sinon il suffirait de posseder un compte
 * quelconque pour le remettre a zero a volonte, et la defense contre la
 * pulverisation ne se declencherait jamais.
 */
const LOGIN_LIMIT_PER_ACCOUNT = 10
const LOGIN_LIMIT_PER_IP = 60
const LOGIN_WINDOW_MS = 15 * 60 * 1000

/**
 * Delai impose apres un echec, une fois le seuil par compte franchi.
 *
 * VERROUILLER ET RALENTIR NE SONT PAS LA MEME MESURE. Refuser ferme la
 * porte au titulaire ; retarder ne coute qu'a celui qui insiste. Le
 * titulaire finit toujours par entrer, et son mot de passe correct passe
 * SANS AUCUN delai — la penalite ne frappe que les echecs constates.
 *
 * IL EST PROGRESSIF, ET LA PREMIERE VERSION NE L'ETAIT PAS. Un delai plat
 * d'une seconde ne coute rien a qui parallelise : cent requetes concurrentes
 * attendent une seconde ENSEMBLE, pas cent secondes. La revue du 12-08-2026
 * l'a mesure — le debit d'un attaquant restait inchange, et le commentaire
 * qui se trouvait ici affirmait le contraire. En doublant a chaque essai
 * au-dela du seuil, la penalite finit par couter meme en parallele.
 *
 * ⚠ CE QUE CE DELAI NE FAIT PAS, ET IL FAUT LE LIRE AVANT DE S'Y FIER.
 * Il ne borne pas le DEBIT : aucune penalite de latence ne le fait face a
 * un appelant qui n'attend pas ses reponses. La seule borne reelle est le
 * compteur PAR ADRESSE (60 / 15 min), et elle ne vaut que contre un
 * appelant qui n'en possede qu'une. Un attaquant qui dispose de plusieurs
 * adresses n'est freine par rien ici : c'est REP-34, explicitement hors
 * perimetre de la story 1.9, et la vraie reponse est une epreuve dont le
 * cout est porte par l'appelant — captcha, preuve de travail.
 *
 * On ne peut pas faire mieux sans cela : refuser des essais faux par compte
 * et garantir qu'un mot de passe correct passe sont deux exigences qu'aucun
 * comptage seul ne concilie. C'est pour cette raison qu'un verrou dur par
 * compte, meme a seuil tres eleve, a ete ECARTE : 60 essais par quart
 * d'heure et par adresse mettent n'importe quel plafond a portee d'un
 * tiers, et le verrouillage redeviendrait ce que cette story ferme.
 */
const DELAI_BASE_MS = 1000
const DELAI_PLAFOND_MS = 30_000

/**
 * Compte un echec CONSTATE, et retarde la reponse si le seuil est franchi.
 *
 * Le compteur n'est jamais consomme avant la verification : c'est ce qui
 * distingue « freiner une attaque » de « fermer un compte ».
 */
async function penaliserEchec(email: string) {
  const budget = rateLimit({
    key: cleDeCompteur("login:compte", email),
    limit: LOGIN_LIMIT_PER_ACCOUNT,
    windowMs: LOGIN_WINDOW_MS,
  })

  if (budget.ok) return

  // 1 s, 2 s, 4 s… plafonnees. `depassement` vaut 1 au premier refus.
  const delai = Math.min(
    DELAI_PLAFOND_MS,
    DELAI_BASE_MS * 2 ** (budget.depassement - 1)
  )

  await new Promise((suite) => setTimeout(suite, delai))
}

/**
 * Configuration complete, cote serveur Node.
 *
 * Elle etend la configuration compatible Edge (auth.config.ts) avec tout ce
 * qui a besoin de la base de donnees : l'adaptateur Prisma et le
 * fournisseur Credentials. Le middleware, lui, n'importe jamais ce fichier.
 */
export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const validated = loginSchema.safeParse(credentials)

        if (!validated.success) {
          return null
        }

        const { email, password } = validated.data

        const ip = await callerIp()

        // PAR ADRESSE, ET EN AMONT — le seul compteur qui a le droit de
        // refuser avant d'avoir verifie quoi que ce soit.
        //
        // Il protege le SERVEUR : sans lui, chaque requete d'un attaquant
        // couterait un bcrypt a cout 12, et la verification deviendrait une
        // amplification. Le seuil est large (60 / 15 min) parce qu'une
        // agence entiere sort par une seule adresse publique.
        const budgetAdresse = rateLimit({
          key: cleDeCompteur("login:ip", ip),
          limit: LOGIN_LIMIT_PER_IP,
          windowMs: LOGIN_WINDOW_MS,
        })

        // Le compteur par adresse refuse AVANT toute verification — c'est
        // le seul qui en a le droit, et c'est le serveur qu'il protege de
        // l'amplification bcrypt. Mais on penalise quand meme le compte :
        // un refus par adresse reste une tentative ratee sur ce compte, et
        // ne pas la compter donnait a l'attaquant le moyen de geler le
        // compteur de sa victime en saturant volontairement le sien
        // (REP-39, le court-circuit que `.some()` produisait ailleurs).
        if (!budgetAdresse.ok) {
          await penaliserEchec(email)
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: { agency: true },
        })

        /**
         * LA VERIFICATION A LIEU MEME SI LE COMPTEUR PAR COMPTE EST SATURE,
         * et c'est tout l'objet de la story 1.9.
         *
         * Ce compteur etait consomme ICI, avant `compare`, et n'etait
         * efface qu'en cas de succes — succes que la limite empechait
         * d'atteindre. Dix mots de passe faux suffisaient donc a mettre le
         * titulaire dehors, et les adresses des directeurs d'agence sont
         * publiees sur les vitrines : la cible etait publique et le cout de
         * l'attaque, onze requetes. C'etait REP-37.
         *
         * Le compteur par compte ne garde plus la PORTE, il garde la
         * REPONSE : il n'est alimente que par un echec CONSTATE, et un mot
         * de passe correct passe toujours.
         */
        /**
         * `compare` LEVE sur un hachage malforme — version de sel inconnue,
         * colonne tronquee, ligne importee. Un `$2b$` coupe rend `false`,
         * mais un prefixe inconnu jette, et l'exception traversait
         * `authorize()` jusqu'a un 500 au lieu d'un refus propre. Un
         * hachage illisible est un echec d'authentification, pas une panne.
         */
        let motDePasseValide = false

        if (user?.password) {
          try {
            motDePasseValide = await compare(password, user.password)
          } catch {
            motDePasseValide = false
          }
        }

        /**
         * TOUT REFUS EMPRUNTE LA MEME SORTIE, et c'est une correction de la
         * revue du 12-08-2026.
         *
         * La premiere version renvoyait `null` sans penalite pour un compte
         * DESACTIVE dont le mot de passe etait correct. Au-dela du seuil,
         * l'attaquant distinguait donc a la milliseconde : mauvais mot de
         * passe ~1 s, BON mot de passe immediat. Le mot de passe d'un compte
         * revoque devenait confirmable — et la story 1.8 vient precisement
         * de peupler cet etat.
         *
         * Le statut du compte et celui de l'agence sont donc evalues ici,
         * apres la verification, et leur refus passe par la meme penalite
         * que celui d'un mot de passe faux.
         */
        const agenceRefusee =
          user?.role !== "super_admin" &&
          (!user?.agency || user.agency.status !== "active")

        if (!user || !motDePasseValide || !user.isActive || agenceRefusee) {
          await penaliserEchec(email)
          return null
        }

        // Le statut de l'agence est evalue plus haut, avec le reste : on
        // renvoie `null` et non une exception, NextAuth v5 beta ne
        // transmettant pas de code d'erreur personnalise. La raison exacte
        // est fournie par explainLoginFailure(), qui revalide le mot de
        // passe avant de la reveler.

        // Connexion reussie : les essais precedents SUR CE COMPTE sont
        // oublies, sinon une journee normale finirait par bloquer un
        // utilisateur legitime.
        //
        // Le compteur par ADRESSE n'est pas efface, et c'etait un defaut.
        // L'inscription est publique : un attaquant se creait un compte,
        // essayait 59 mots de passe contre 59 comptes cibles, se
        // connectait une fois chez lui — et le budget de son adresse
        // repartait a zero. La limite par adresse, seule defense contre
        // la pulverisation (un essai sur beaucoup de comptes), ne se
        // declenchait jamais. Le succes sur un compte ne prouve rien sur
        // les echecs subis par les autres.
        resetRateLimit(cleDeCompteur("login:compte", email))

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          agencyId: user.agencyId,
        }
      },
    }),
  ],
})