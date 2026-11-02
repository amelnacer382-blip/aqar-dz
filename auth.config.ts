import type { NextAuthConfig } from "next-auth"

/**
 * Configuration d'authentification compatible Edge Runtime.
 *
 * Le middleware s'execute en Edge : il n'y a ni systeme de fichiers ni
 * moteur de base de donnees. Tout ce qui touche Prisma ou bcrypt doit donc
 * rester hors de ce fichier — c'est ici que passe la frontiere.
 *
 * Ce fichier ne contient que ce que le middleware a besoin de savoir pour
 * lire un jeton : la strategie de session, les pages, et la facon dont le
 * role et l'agence voyagent dans le JWT. Le fournisseur Credentials, qui
 * interroge la base, vit dans auth.ts.
 */
export const authConfig = {
  session: {
    strategy: "jwt",

    /**
     * Duree d'une session : douze heures.
     *
     * Sans cette ligne, la valeur etait celle par defaut de @auth/core —
     * TRENTE JOURS (`lib/init.js`). Trente jours n'est pas une session,
     * c'est un identifiant permanent laisse dans un navigateur. Sur un
     * outil qui detient des pieces d'identite et des actes de propriete,
     * la duree d'un acces ne doit pas survivre au poste de travail.
     *
     * Douze heures couvrent la journee d'une agence, du matin au soir. Le
     * prix est une reconnexion par jour, et c'est le prix normal.
     *
     * MESURE, et non deduction : sur la strategie JWT, @auth/core
     * re-signe le jeton a chaque lecture de session avec une nouvelle
     * echeance et ne consulte PAS `updateAge` (`lib/actions/session.js`).
     * Le delai se comporte donc en inactivite glissante quand la reponse
     * peut poser un cookie — ce que le middleware fait, et pas un Server
     * Component. Verifie a 60 secondes avant d'etre fixe ici : une
     * navigation continue ne coupe pas la session, une inactivite plus
     * longue que le delai la coupe.
     *
     * ARBITRAGE PRODUIT, rendu le 12 aout 2026 et consigne dans
     * docs/stories/sprint-status.yaml. Il se change ici, en une ligne : si
     * les agences se plaignent, la valeur monte. Elle part de ce qui
     * protege, pas de ce qui est confortable.
     *
     * `jwt.maxAge` reprend `session.maxAge` (`lib/init.js`) : ne pas le
     * dupliquer.
     */
    maxAge: 12 * 60 * 60,
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  // Les fournisseurs sont ajoutes dans auth.ts, cote serveur Node.
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.agencyId = user.agencyId
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub as string
        session.user.role = token.role as string
        session.user.agencyId = token.agencyId as string | null
      }
      return session
    },
  },
} satisfies NextAuthConfig
