const isProduction = process.env.NODE_ENV === "production"

/**
 * En-tetes de securite appliques a toutes les reponses.
 *
 * Aucune politique de contenu (CSP) stricte n'est posee ici : Next injecte
 * ses propres scripts en ligne, et une CSP ecrite a l'aveugle casserait
 * l'application au premier deploiement. Elle se met en place au niveau du
 * reverse proxy, avec les nonces, une fois le domaine de production connu.
 */
const securityHeaders = [
  // La console d'agence ne doit jamais s'afficher dans le cadre d'un autre
  // site : sans cela, une page tierce peut superposer ses propres boutons
  // aux notres et faire cliquer l'utilisateur sur une action qu'il ne voit
  // pas.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },

  // Un fichier televerse ne doit pas etre reinterprete par le navigateur
  // selon son contenu : une image acceptee a l'upload ne devient pas du
  // script parce qu'elle en contient.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Les URL de l'espace agence contiennent des identifiants de dossiers :
  // elles ne partent pas vers les sites externes que l'on visite ensuite.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Le logiciel n'a besoin ni de camera, ni de micro, ni de position.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
]

/**
 * HSTS uniquement en production.
 *
 * Cet en-tete interdit au navigateur de revenir en HTTP pendant six mois.
 * Pose en developpement — ou l'on travaille en http://localhost — il
 * rendrait le site inaccessible sans passer par les parametres du
 * navigateur. Il suppose donc un certificat TLS valide en face.
 */
if (isProduction) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=15552000; includeSubDomains",
  })
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Sortie autonome, attendue par le Dockerfile.
   *
   * L'etape de production copie `.next/standalone` : sans elle, Next ne
   * produit pas ce dossier et la construction de l'image echoue au COPY.
   *
   * Mais elle est incompatible avec `next start`, qui affiche alors un
   * avertissement a chaque demarrage local. On l'active donc uniquement
   * quand on construit l'image — le Dockerfile pose NEXT_OUTPUT — et on
   * laisse le developpement tranquille. Un avertissement affiche a chaque
   * lancement finit par ne plus etre lu, y compris quand il compte.
   */
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,

  /**
   * Active instrumentation.ts, execute une fois au demarrage du serveur.
   * C'est lui qui verifie la configuration et refuse de demarrer en
   * production si le secret de session est resté celui de l'exemple.
   */
  experimental: {
    instrumentationHook: true,

    /**
     * Le cache de routeur client ne survit pas a une revocation d'acces.
     *
     * Next 14.2 ressert pendant TRENTE SECONDES, depuis le cache du
     * navigateur et SANS AUCUNE REQUETE AU SERVEUR, tout segment dynamique
     * deja visite. Aucune garde ne s'execute pendant ce temps : un compte
     * desactive continue de lire les pages qu'il avait ouvertes. La
     * propriete que la story 1.8 croyait tenir — « l'acces tombe a la
     * requete suivante » — n'etait vraie que de la requete suivante, pas de
     * la NAVIGATION suivante, et c'est la navigation que fait un
     * utilisateur.
     *
     * ARBITRAGE, rendu le 12 aout 2026 : la fraicheur l'emporte. Ce logiciel
     * detient des pieces d'identite et des actes de propriete, ses pages
     * sont rendues par le serveur, son trafic est celui d'une agence — le
     * cout est quelques allers-retours de plus au retour arriere, le gain
     * est que la revocation ne connaisse plus d'exception. Un cache qui
     * garde trente secondes une page qu'on vient d'interdire n'est pas un
     * gain de confort, c'est un trou dont personne ne se souvient.
     *
     * `static` reste a sa valeur par defaut : la vitrine publique et la page
     * d'accueil n'ont rien a revalider a la seconde.
     */
    staleTimes: {
      dynamic: 0,
    },
  },

  /**
   * On n'annonce pas le serveur utilise : cette information ne sert qu'a
   * celui qui cherche une version vulnerable a viser.
   */
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
