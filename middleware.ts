import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "@/auth.config"

/**
 * Le middleware n'importe surtout pas @/auth : ce module tire l'adaptateur
 * Prisma et bcrypt, qui ne peuvent pas s'executer en Edge Runtime. Il se
 * contente de la configuration Edge, suffisante pour lire le jeton.
 */
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const pathname = nextUrl.pathname

  /**
   * Les fichiers de documents ne sont jamais servis par leur chemin.
   *
   * nginx les refuse deja, mais la protection ne doit pas dependre de la
   * couche qui se trouve devant — surtout pas d'une couche absente de
   * l'environnement de test. Next sert lui-meme public/uploads, et le
   * port applicatif, s'il n'est plus publie depuis la story 2.1, reste
   * joignable depuis l'hote par l'adresse du conteneur.
   *
   * 404 et non 401 : cette adresse n'a plus a exister pour personne, y
   * compris pour un compte connecte. Le fichier passe par
   * /api/documents/{id}/file.
   */
  if (pathname.startsWith("/uploads/documents/")) {
    return new NextResponse(null, { status: 404 })
  }

  const isApiRoute = pathname.startsWith("/api/")

  /**
   * Ce qui exige un compte, nomme explicitement.
   *
   * La regle etait auparavant inverse : tout ce qui n'etait pas declare
   * public exigeait une session. Une adresse qui n'existe pas — un lien de
   * vitrine mal recopie, par exemple — n'etait alors pas une page
   * introuvable mais un ecran de connexion, pour un visiteur qui n'a
   * aucun compte a y saisir. Les seuls espaces reellement prives sont
   * /agency et /admin ; tout le reste doit pouvoir aboutir a un 404.
   *
   * Les routes API gardent le refus par defaut : une API inconnue n'a pas
   * a reveler ce qu'elle est, et /api/auth reste ouverte parce que c'est
   * par la que passe la connexion elle-meme.
   */
  const isProtectedPage =
    pathname.startsWith("/agency") || pathname.startsWith("/admin")

  const isProtectedApi =
    isApiRoute &&
    !pathname.startsWith("/api/auth/") &&
    !pathname.startsWith("/api/public/")

  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next()
  }

  if (!isLoggedIn) {
    // Une route API doit repondre un 401 JSON exploitable par le client,
    // pas une redirection 307 qui renvoie du HTML de page de connexion.
    if (isApiRoute) {
      return NextResponse.json(
        { error: "Non authentifie" },
        { status: 401 }
      )
    }

    const loginUrl = new URL("/auth/login", nextUrl)
    loginUrl.searchParams.set("callbackUrl", pathname)

    /**
     * 303 des que la methode n'est pas GET, et un message.
     *
     * Une redirection 307 PRESERVE la methode : le navigateur re-POSTe le
     * corps de la Server Action vers /auth/login, qui n'en connait aucune.
     * Tout ce qui venait d'etre saisi disparait, sans un mot.
     *
     * Le comportement est anterieur a la story 1.8, mais celle-ci le rend
     * quotidien : a trente jours, une session expirait rarement pendant
     * qu'un formulaire etait ouvert ; a douze heures, cela arrive chaque
     * matin sur tout onglet laisse ouvert la veille. 303 force le GET,
     * l'ecran de connexion s'affiche vraiment, et `callbackUrl` ramene sur
     * la page quittee.
     *
     * Ce qui n'est PAS repare : la saisie est perdue quand meme. La
     * conserver demanderait de la retenir cote client avant l'envoi —
     * autre chantier, autre story.
     */
    if (req.method !== "GET") {
      loginUrl.searchParams.set(
        "error",
        "Votre session a expiré. Reconnectez-vous, puis ressaisissez votre formulaire."
      )
      return NextResponse.redirect(loginUrl, 303)
    }

    return NextResponse.redirect(loginUrl)
  }

  /**
   * LE ROLE N'EST PAS LU ICI, ET C'EST DELIBERE.
   *
   * Ce bloc aiguillait autrefois les deux espaces sur `req.auth.user.role`,
   * c'est-a-dire sur le JETON. Tant que les gardes lisaient la meme valeur,
   * les deux couches disaient toujours la meme chose. La story 1.8 a fait
   * lire la BASE aux gardes — et a ainsi rendu atteignable une branche qui
   * ne l'etait pas : un super admin retrograde etait renvoye de /admin vers
   * /agency par sa garde (base), puis de /agency vers /admin par ce
   * middleware (jeton). ERR_TOO_MANY_REDIRECTS sur les deux espaces. Le
   * compte n'etait pas retrograde, il etait ENFERME, sans issue en
   * libre-service.
   *
   * Deux couches qui autorisent sur deux sources ne peuvent pas etre mises
   * d'accord ; il faut en retirer une. C'est celle-ci qui part, parce que
   * c'est elle qui lit la source perimee : en Edge Runtime, sans base, elle
   * ne peut pas faire autrement.
   *
   * Le middleware AUTHENTIFIE donc — y a-t-il une session — et rien de
   * plus. L'AUTORISATION appartient a `lib/auth-guard.ts`, qui lit la base
   * a chaque requete : `requireSuperAdmin()` renvoie un role non-editeur
   * vers /agency, `requireAgency()` renvoie un editeur vers /admin. Les
   * deux lisent la meme colonne : elles ne peuvent plus se contredire.
   *
   * VERIFIE avant de retirer le controle, et a reverifier avant d'ajouter
   * un ecran : les cinq pages de /admin appellent TOUTES
   * `requireSuperAdmin()` en premiere ligne (`grep -L requireSuperAdmin
   * app/admin/**\/page.tsx` ne renvoie rien). Le middleware ne couvrait
   * aucune page que sa propre garde ne couvre pas. La branche `403` sur
   * `isApiRoute` qui se trouvait ici etait d'ailleurs morte : un chemin ne
   * peut pas commencer a la fois par /admin et par /api/.
   *
   * Le cloisonnement multi-tenant (agencyId) et le statut de l'agence sont
   * verifies au meme endroit, pour la meme raison.
   */
  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    /**
     * Entree distincte, et necessaire : la premiere exclut les extensions
     * d'image, or un document televerse peut etre un JPEG comme un PDF.
     * Sans cette ligne, une piece d'identite photographiee echappait au
     * middleware par sa seule extension.
     */
    "/uploads/documents/:path*",
  ],
}
