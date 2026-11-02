import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import type { Agency } from "@prisma/client"

/**
 * Ce que le jeton a le droit de dire, et ce qu'il n'a plus le droit de dire.
 *
 * La session est signee : elle prouve QUI a ouvert une session, et rien
 * d'autre. Son role, son agence et le fait que son compte existe encore
 * sont des DECISIONS, elles changent apres coup, et elles se lisent donc en
 * base a chaque requete.
 *
 * Ce n'etait pas le cas, et c'etait BUG-33. Le statut de l'agence, lui,
 * etait bien revérifie ici depuis l'origine — le raisonnement etait juste,
 * il n'avait simplement jamais ete applique a l'utilisateur. Consequence
 * mesuree le 12 aout 2026 sur l'instance en marche : un compte desactive
 * pendant sa session creait encore un proprietaire.
 *
 * LA SEULE VALEUR CONSOMMEE DU JETON EST `session.user.id`. Ne pas
 * reintroduire de controle sur `session.user.role` ni sur
 * `session.user.agencyId` : ce serait rouvrir le defaut par la porte de
 * derriere, et le rendre invisible puisque le reste du fichier aurait
 * l'air correct.
 *
 * Le middleware, lui, ne lit plus le role du tout : il AUTHENTIFIE — y
 * a-t-il une session — et laisse passer. Il tourne en Edge Runtime, sans
 * base, donc la seule valeur de role qu'il pourrait lire est celle du
 * jeton ; deux couches qui autorisent sur deux sources finissent par se
 * contredire, et elles l'ont fait : un super admin retrograde rebondissait
 * entre /admin (refuse par sa garde, sur la base) et /agency (refuse par le
 * middleware, sur le jeton) jusqu'a ERR_TOO_MANY_REDIRECTS. C'est pour cela
 * que L'AIGUILLAGE ENTRE LES DEUX ESPACES EST ICI, et nulle part ailleurs :
 * requireSuperAdmin renvoie vers /agency, requireAgency renvoie vers
 * /admin, et les deux lisent la meme colonne.
 *
 * Ne pas chercher a donner Prisma au middleware : la frontiere entre
 * auth.config.ts et auth.ts existe pour cela.
 */
const COMPTE_DESACTIVE = "Votre compte utilisateur a été désactivé."

/**
 * Ou part un compte dont l'acces vient d'etre coupe.
 *
 * Le renvoi depend de QUI peut le reactiver, et c'est la seule information
 * utile a quelqu'un qui vient d'etre verrouille : un compte d'agence
 * s'adresse a son administrateur, un editeur n'a pas d'agence — lui
 * conseiller de contacter « l'administrateur de votre agence » etait
 * l'envoyer chez un interlocuteur qui n'existe pas, sur le seul compte
 * dont le verrouillage n'a aucune issue en libre-service.
 *
 * La premiere phrase est celle d'`explainLoginFailure()`
 * (app/auth/login/actions.ts) : les deux chemins menent au meme ecran, a
 * quelques secondes d'intervalle, et deux formulations differentes pour un
 * meme fait se lisent comme deux causes differentes.
 */
function refusDeCompte(recours: "agence" | "editeur"): string {
  const suite =
    recours === "agence"
      ? "Contactez l'administrateur de votre agence."
      : "Contactez un autre super administrateur pour le réactiver."

  // La page de connexion affiche `?error=` telle quelle, et si l'interesse
  // retente sa chance, `explainLoginFailure()` lui donne la raison exacte
  // apres avoir revalide son mot de passe. Elle ne redirige pas un
  // visiteur porteur d'un cookie : pas de boucle.
  return `/auth/login?error=${encodeURIComponent(`${COMPTE_DESACTIVE} ${suite}`)}`
}

/**
 * Garde d'acces pour toutes les pages et actions de l'espace agence.
 *
 * Verifie a chaque requete, EN BASE, que :
 *  - la session designe un compte qui existe encore
 *  - ce compte est actif (`isActive`)
 *  - il est rattache a une agence, qui existe toujours
 *  - cette agence est ACTIVE (une agence `pending` ou `suspended` est ejectee)
 *
 * Le controle est refait ici et pas seulement a la connexion : si un
 * administrateur desactive un agent, ou si un super admin suspend une
 * agence, l'acces tombe a la requete suivante sans que l'interesse ait a se
 * reconnecter. C'est la propriete que cette garde existe pour tenir.
 *
 * Un seul appel Prisma : le compte et son agence arrivent ensemble, la ou
 * se trouvait un `agency.findUnique`. Ce n'est PAS « zero requete
 * supplementaire », et l'affirmation a circule telle quelle dans quatre
 * documents : Prisma eclate une relation to-one en DEUX instructions SQL
 * (`relationLoadStrategy` par defaut). Le cout reel de la story 1.8 sur ce
 * chemin est donc de un aller-retour SQL de plus, pas de zero.
 */
export async function requireAgency(): Promise<{
  agencyId: string
  agency: Agency
  userId: string
  userRole: string
  userName: string | null
}> {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/auth/login")
  }

  // L'agence ENTIERE — des ecrans lisent son nom, son logo, sa couleur,
  // son slug et son echeance d'abonnement, et le contrat de cette fonction
  // promet `agency: Agency` — mais du COMPTE, seulement ce qui est utilise.
  //
  // `include` ramenait toute la ligne `User`, donc `password` : l'empreinte
  // bcrypt du compte connecte traversait les 68 appels de cette garde, dans
  // chaque page et chaque Server Action de l'espace agence. Elle n'y servait
  // a rien. `getApiAgency`, trois fonctions plus bas, faisait deja le geste
  // etroit : le fichier se contredisait.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      role: true,
      isActive: true,
      agency: true,
    },
  })

  // Le cookie survit a la ligne : un jeton signe ne sait pas que le compte
  // qu'il designe a ete supprime. Ce cas se traite, il ne se suppose pas.
  if (!user) {
    redirect("/auth/login")
  }

  if (!user.isActive) {
    redirect(refusDeCompte("agence"))
  }

  /**
   * L'editeur n'a pas d'agence : sa place est dans sa console.
   *
   * Cet aiguillage etait dans le middleware, sur le role du jeton. Il est
   * ici parce que c'est ici qu'on lit le role a jour — et parce que
   * l'entretenir a deux endroits sur deux sources produisait une boucle de
   * redirection des que les deux divergeaient (voir l'en-tete du fichier).
   *
   * Il precede le controle d'agence : sans lui, un super admin arrivant sur
   * /agency tombait dans `!user.agency` et etait renvoye vers l'ecran de
   * connexion alors qu'il etait connecte — un refus qui se lit comme une
   * panne.
   */
  if (user.role === "super_admin") {
    redirect("/admin")
  }

  if (!user.agency) {
    redirect("/auth/login")
  }

  if (user.agency.status !== "active") {
    redirect(`/auth/inactive?status=${user.agency.status}`)
  }

  return {
    agencyId: user.agency.id,
    agency: user.agency,
    userId: user.id,
    userRole: user.role,
    userName: user.name,
  }
}

/**
 * Garde d'acces pour l'espace super admin.
 *
 * Elle n'interrogeait pas la base DU TOUT : c'etait le seul chemin du
 * produit ou le compte n'etait verifie a aucun moment apres la connexion.
 * Un editeur desactive gardait sa console jusqu'a expiration de son jeton.
 *
 * Elle coute donc desormais une requete la ou elle n'en faisait aucune.
 * C'est assume : six ecrans, un seul utilisateur, un trafic negligeable —
 * et c'est le compte le plus puissant du systeme.
 */
export async function requireSuperAdmin(): Promise<{
  userId: string
  userName: string | null
}> {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/auth/login")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true, isActive: true },
  })

  if (!user) {
    redirect("/auth/login")
  }

  if (!user.isActive) {
    redirect(refusDeCompte("editeur"))
  }

  // Le pendant de l'aiguillage pose dans requireAgency, et la moitie de la
  // boucle qui existait tant que l'autre moitie vivait dans le middleware :
  // les deux refus lisent desormais la meme colonne de la meme ligne.
  if (user.role !== "super_admin") {
    redirect("/agency")
  }

  return { userId: user.id, userName: user.name }
}

/**
 * Garde renforcee : reserve l'action a l'administrateur de l'agence.
 *
 * Le cloisonnement entre agences etait deja assure par requireAgency ; il
 * manquait celui entre roles. Un agent gere le quotidien — biens, clients,
 * visites — mais ne supprime pas, ne touche pas aux parametres de l'agence
 * et n'ouvre pas de comptes.
 *
 * Le super admin passe aussi : il doit pouvoir depanner une agence.
 *
 * SAUF QUE NON, ET C'EST BUG-10 : `requireAgency()` renvoie un editeur vers
 * /admin avant que cette ligne ne s'execute — et, avant meme cet
 * aiguillage, un editeur n'ayant pas d'agence n'a jamais franchi le
 * controle qui la reclame. La branche `super_admin` de cette garde n'a
 * donc jamais rien autorise. Elle est conservee telle quelle : la retirer
 * ou la rendre vraie est un arbitrage produit — un editeur doit-il pouvoir
 * endosser une agence pour la depanner ? — qui appartient a la story 5.1.
 */
export async function requireAgencyAdmin() {
  const context = await requireAgency()

  if (context.userRole !== "agency_admin" && context.userRole !== "super_admin") {
    // Le message etait ecrit sans accents dans un produit qui en met
    // partout — et surtout, il n'etait affiche NULLE PART : le tableau de
    // bord ne lisait pas `searchParams`. Un agent qui suivait un lien vers
    // les parametres etait ejecte sans un mot d'explication, ce qui se lit
    // comme un bogue et non comme une permission. Corrige story 4.3.
    redirect(
      "/agency?error=" +
        encodeURIComponent("Action réservée à l'administrateur de l'agence")
    )
  }

  return context
}

/**
 * Vrai si le role peut effectuer les actions reservees a l'administrateur.
 *
 * La definition a demenage dans `lib/roles.ts` (story 5.13) et n'est plus
 * que RE-EXPORTEE ici : ce module importe `prisma`, `auth` et `redirect`,
 * donc un composant client qui voudrait le predicat tirerait tout le
 * serveur dans son bundle. Les appelants serveur, eux, gardent ce chemin
 * d'import — c'est pourquoi la re-export existe plutot qu'un simple
 * deplacement.
 */
export { isAgencyAdmin } from "@/lib/roles"

/**
 * Variante pour les routes API : renvoie null au lieu de rediriger,
 * pour que l'appelant puisse repondre un vrai 401/403 JSON.
 */
export async function getApiAgency(): Promise<
  | {
      ok: true
      agencyId: string
      userId: string
      userRole: string
      userName: string | null
    }
  | { ok: false; status: 401 | 403; error: string }
> {
  const session = await auth()

  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "Non authentifie" }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      role: true,
      isActive: true,
      agency: { select: { id: true, status: true } },
    },
  })

  if (!user) {
    return { ok: false, status: 401, error: "Non authentifie" }
  }

  // Meme code et meme message qu'une absence de session, a dessein : une
  // reponse d'API est lue par du code, pas par un humain. La raison exacte
  // — « votre compte a ete desactive » — est donnee sur le chemin des
  // pages, qui est celui ou quelqu'un la lira.
  if (!user.isActive) {
    return { ok: false, status: 401, error: "Non authentifie" }
  }

  // Meme reponse encore, et pour la meme raison qu'au-dessus : « Agence
  // introuvable » apprenait a l'appelant qu'il ETAIT authentifie — la
  // fonction masquait deliberement « compte desactive » trois lignes plus
  // haut et revelait l'authentification trois lignes plus bas. C'est le cas
  // d'un super admin, qui n'a pas d'agence : sa console est ailleurs, ces
  // routes ne sont pas les siennes.
  if (!user.agency) {
    return { ok: false, status: 401, error: "Non authentifie" }
  }

  if (user.agency.status !== "active") {
    return { ok: false, status: 403, error: "Agence inactive" }
  }

  return {
    ok: true,
    agencyId: user.agency.id,
    userId: user.id,
    userRole: user.role,
    userName: user.name,
  }
}
