/**
 * Point d'entree execute une fois au demarrage du serveur, avant toute
 * requete. C'est le seul endroit ou l'on peut refuser de demarrer.
 *
 * La verification ne concerne que le runtime Node : le middleware tourne
 * en Edge, ou ni le systeme de fichiers ni la plupart des variables ne
 * sont disponibles.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkEnvironment } = await import("@/lib/env")
    checkEnvironment()
  }
}
