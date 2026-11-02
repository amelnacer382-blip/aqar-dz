/**
 * Verification de la configuration au demarrage.
 *
 * Une application mal configuree ne doit pas demarrer en silence puis
 * echouer trois semaines plus tard, quand une agence demande pourquoi ses
 * photos ont disparu. Ce module est appele une fois au lancement du
 * serveur et dit tout haut ce qui manque.
 *
 * Deux niveaux, et la difference compte :
 *
 *   - BLOQUANT (production seulement) : le serveur refuse de demarrer.
 *     Reserve a ce qui compromet la securite de tous les comptes — un
 *     secret de session laisse a sa valeur d'exemple, par exemple, permet
 *     a quiconque connait le depot de forger la session d'un super admin.
 *   - AVERTISSEMENT : le serveur demarre, mais la console dit exactement
 *     ce qui ne marchera pas et ce qu'il faut renseigner.
 *
 * En developpement, rien ne bloque : on doit pouvoir lancer le projet
 * juste apres l'avoir clone.
 */

/** Valeurs d'exemple livrees dans .env.example — jamais acceptables en production. */
const PLACEHOLDER_SECRETS = [
  "votre-secret-local-min-32-caracteres",
  "changeme",
  "secret",
]

const MIN_SECRET_LENGTH = 32

/** Adresse absolue en http(s) — la seule forme utilisable dans un email. */
function adresseAbsolue(valeur: string): boolean {
  try {
    const url = new URL(valeur)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

type Check = {
  level: "fatal" | "warn"
  message: string
}

function collect(): Check[] {
  const checks: Check[] = []
  const isProduction = process.env.NODE_ENV === "production"

  // --- Secret de session ---
  const secret = process.env.NEXTAUTH_SECRET ?? ""

  if (!secret) {
    checks.push({
      level: isProduction ? "fatal" : "warn",
      message:
        "NEXTAUTH_SECRET est absent. Générez-en un : openssl rand -base64 32",
    })
  } else if (PLACEHOLDER_SECRETS.includes(secret)) {
    checks.push({
      level: isProduction ? "fatal" : "warn",
      message:
        "NEXTAUTH_SECRET est resté à sa valeur d'exemple. Toute personne " +
        "ayant vu le dépôt peut forger une session de super admin. " +
        "Générez-en un : openssl rand -base64 32",
    })
  } else if (secret.length < MIN_SECRET_LENGTH) {
    checks.push({
      level: isProduction ? "fatal" : "warn",
      message: `NEXTAUTH_SECRET fait ${secret.length} caractères, il en faut au moins ${MIN_SECRET_LENGTH}.`,
    })
  }

  // --- Adresse publique ---
  const url = process.env.NEXTAUTH_URL ?? ""

  if (!url) {
    checks.push({
      level: isProduction ? "fatal" : "warn",
      message:
        "NEXTAUTH_URL est absent. Il construit les liens des emails, le " +
        "sitemap et robots.txt : sans lui, le lien de réinitialisation ne " +
        "mène nulle part.",
    })
  } else if (!adresseAbsolue(url)) {
    // Un `NEXTAUTH_URL` sans schema — « aqar.dz » — passait ce controle
    // sans un mot. Il construit pourtant le lien de reinitialisation, que
    // `emailLayout` refuse desormais s'il n'est pas absolu : l'email
    // partait alors SANS AUCUN LIEN, en silence. Le seul moyen de
    // retrouver son compte.
    checks.push({
      level: isProduction ? "fatal" : "warn",
      message:
        `NEXTAUTH_URL (${url}) n'est pas une adresse absolue en http(s). ` +
        "Elle construit les liens des emails, le sitemap et robots.txt : " +
        "sans schéma, le lien de réinitialisation ne part pas du tout. " +
        "Exemple attendu : https://aqar.dz",
    })
  } else if (isProduction && url.startsWith("http://")) {
    checks.push({
      level: "warn",
      message:
        `NEXTAUTH_URL (${url}) n'est pas en HTTPS. Le cookie de session ` +
        "circulera en clair.",
    })
  }

  // --- Base de donnees ---
  if (!process.env.DATABASE_URL) {
    checks.push({
      level: "fatal",
      message: "DATABASE_URL est absent : aucune donnée n'est accessible.",
    })
  }

  // --- Stockage des fichiers ---
  const storageReady =
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SUPABASE_STORAGE_BUCKET

  // Deux messages qui se contrediraient s'ils coexistaient.
  //
  // Celui-ci invitait à renseigner Supabase ; celui du dessous refuse de
  // démarrer quand il l'est. Aucune configuration de production ne
  // satisfaisait les deux. Tant que le seau des documents n'est pas
  // séparé, la seule voie tenable est le stockage local sur un volume qui
  // survit au déploiement — c'est donc cela qu'il faut demander.
  if (!storageReady && isProduction) {
    checks.push({
      level: "warn",
      message:
        "Stockage LOCAL en production : vérifiez que public/uploads est " +
        "monté sur un volume persistant. Sur un système de fichiers " +
        "éphémère, les photos de biens et les documents disparaîtraient " +
        "au prochain déploiement.",
    })
  }

  // Le stockage Supabase annule la protection des documents.
  //
  // `putFile` enregistre l'adresse rendue par `getPublicUrl()` : le seau
  // est public. Quiconque detient cette adresse ouvre le fichier, sans
  // session, et aucune route de l'application ne s'interpose — la garde
  // posee sur /api/documents/{id}/file ne protege alors plus rien.
  //
  // Rendre le seau prive n'est pas une option en l'etat : il est unique
  // et sert aussi les photos de biens, qui doivent rester publiques pour
  // la vitrine. Il faudra un second seau, prive, dedie aux documents.
  //
  // En attendant, le serveur refuse de demarrer dans ce mode plutot que
  // de laisser croire que les pieces d'identite sont protegees. Le choix
  // est deliberement bloquant : une faille silencieuse coute plus cher
  // qu'un demarrage refuse.
  if (storageReady) {
    checks.push({
      level: isProduction ? "fatal" : "warn",
      message:
        "Le stockage Supabase est actif, or son seau est public : les " +
        "documents déposés par les agences (pièces d'identité, actes) y " +
        "sont lisibles par toute personne connaissant leur adresse, et la " +
        "protection de /api/documents/{id}/file ne s'y applique pas. " +
        "Un seau privé dédié aux documents reste à mettre en place ; " +
        "d'ici là, utilisez le stockage local sur volume persistant.",
    })
  }

  // --- Identification de l'appelant ---
  //
  // `TRUSTED_IP_HEADER` nomme l'en-tete sur lequel la limitation de debit
  // compte l'appelant. Le refus de `x-forwarded-for` n'est pas une
  // pinaillerie : c'est le defaut BUG-20 lui-meme. Cet en-tete est une
  // liste a laquelle le reverse proxy AJOUTE l'adresse reelle, sans
  // effacer ce que le client a ecrit ; l'honorer supposerait de compter
  // les sauts de confiance, ce que `lib/rate-limit.ts` ne fait pas. Le
  // refus est bruyant plutot que silencieux — une configuration ne doit
  // pas pouvoir rouvrir un defaut ferme dans le code.
  const trustedHeader = process.env.TRUSTED_IP_HEADER?.trim()
    .replace(/^["']+|["']+$/g, "")
    .trim()
    .toLowerCase()

  if (trustedHeader === "x-forwarded-for") {
    checks.push({
      level: isProduction ? "fatal" : "warn",
      message:
        "TRUSTED_IP_HEADER=x-forwarded-for n'est pas accepté : cet en-tête " +
        "est une liste que le client alimente et que le proxy complète, " +
        "donc l'appelant y choisit sa propre identité et remet à zéro " +
        "toute limitation de débit. Utilisez x-real-ip (défaut) ou " +
        "l'en-tête de votre CDN — à condition que le proxy en façade " +
        "l'écrase.",
    })
  } else if (trustedHeader && !/^[a-z0-9-]+$/.test(trustedHeader)) {
    checks.push({
      level: isProduction ? "fatal" : "warn",
      message:
        `TRUSTED_IP_HEADER (« ${process.env.TRUSTED_IP_HEADER} ») n'est pas ` +
        "un nom d'en-tête valide. La lecture d'un tel nom lève une " +
        "exception, pas une valeur absente : la limitation retombe donc " +
        "sur x-real-ip. Corrigez la valeur ou retirez la variable.",
    })
  } else if (trustedHeader && trustedHeader !== "x-real-ip") {
    // La garantie ne vient pas du nom de l'en-tête, elle vient de ce que
    // le proxy l'écrase. nginx ne pose et ne remplace que X-Real-IP et
    // X-Forwarded-For ; tout autre en-tête traverse verbatim, tel que le
    // client l'a écrit. Choisir `cf-connecting-ip` sur un déploiement qui
    // n'est pas derrière Cloudflare — ou dont l'IP d'origine est
    // joignable — rouvre BUG-20 à l'identique.
    checks.push({
      level: "warn",
      message:
        `TRUSTED_IP_HEADER=${trustedHeader} : vérifiez que le proxy en ` +
        "façade ÉCRASE cet en-tête (proxy_set_header) et qu'aucun appelant " +
        "ne peut le joindre en le contournant. nginx/nginx.conf n'écrase " +
        "aujourd'hui que X-Real-IP et X-Forwarded-For : sans directive " +
        "équivalente pour cet en-tête, l'appelant choisit son identité et " +
        "toute limitation de débit redevient contournable.",
    })
  }

  // --- Messagerie ---
  const mailReady =
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD

  if (!mailReady) {
    checks.push({
      level: "warn",
      message: isProduction
        ? "SMTP n'est pas configuré : activation d'agence, message reçu et " +
          "réinitialisation de mot de passe ne partiront pas. Un utilisateur " +
          "bloqué dépendra entièrement de son administrateur."
        : "SMTP n'est pas configuré : les emails seront écrits dans .mail/ " +
          "au lieu d'être envoyés.",
    })
  }

  return checks
}

let alreadyRun = false

/**
 * Verifie la configuration. Leve une exception si un point bloquant est
 * rencontre — ce qui, en production, arrete le demarrage du serveur.
 */
export function checkEnvironment(): void {
  if (alreadyRun) return
  alreadyRun = true

  const checks = collect()

  if (checks.length === 0) {
    console.log("[config] Configuration complète.")
    return
  }

  const fatal = checks.filter((check) => check.level === "fatal")
  const warnings = checks.filter((check) => check.level === "warn")

  warnings.forEach((check) => console.warn(`[config] ⚠ ${check.message}`))
  fatal.forEach((check) => console.error(`[config] ✖ ${check.message}`))

  if (fatal.length > 0) {
    throw new Error(
      `Configuration invalide : ${fatal.length} point(s) bloquant(s). ` +
        "Le serveur ne peut pas démarrer en production dans cet état."
    )
  }
}
