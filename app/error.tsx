"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RotateCcw, Home } from "lucide-react"

/**
 * Ecran d'erreur.
 *
 * Sans ce fichier, une exception non rattrapee affichait en production
 * l'ecran par defaut de Next.js : fond blanc, texte anglais, un identifiant
 * technique et rien a faire. Une agence en clientele ne peut pas voir ca.
 *
 * On ne montre jamais le message d'origine — il peut contenir un fragment
 * de requete ou un nom de table. Le `digest` est en revanche affiche : il
 * relie ce qu'a vu l'utilisateur a la ligne correspondante dans les
 * journaux du serveur, ce qui est la seule chose exploitable au support.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[erreur]", error)
  }, [error])

  return (
    <main className="limewash flex min-h-screen items-center justify-center px-6 py-24">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
          <AlertTriangle className="h-8 w-8 text-dar-ochre" />
        </div>

        <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink sm:text-4xl">
          Une erreur est survenue
        </h1>

        <p className="mt-4 text-slate-600">
          L&apos;opération n&apos;a pas pu aboutir. Vos données ne sont pas
          perdues : réessayez, et si le problème persiste, signalez-le en
          indiquant le code ci-dessous.
        </p>

        {error.digest && (
          <p className="mt-6 inline-block rounded-md border border-dar-sand bg-white px-3 py-1.5 font-mono text-xs text-slate-500">
            Code : {error.digest}
          </p>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset} className="bg-dar-ink hover:bg-dar-blue">
            <RotateCcw className="mr-2 h-4 w-4" />
            Réessayer
          </Button>
          {/* « Accueil » et non « tableau de bord » : cet ecran couvre aussi
              la vitrine publique, ou le visiteur n'a pas de compte. */}
          <Button asChild variant="outline">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Revenir à l&apos;accueil
            </Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
