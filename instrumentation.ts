/**
 * Point d'entrée exécuté une fois au démarrage du serveur, avant toute
 * requête. C'est le seul endroit où l'on peut refuser de démarrer.
 */
import { checkEnvironment } from "@/lib/env"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NEXT_PHASE === "phase-production-build") return
    checkEnvironment()
  }
}
