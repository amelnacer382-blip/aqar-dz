import Link from "next/link"
import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Compass } from "lucide-react"

export const metadata: Metadata = {
  title: "Page introuvable — Aqar DZ",
}

/**
 * 404.
 *
 * Un lien mort dans une vitrine d'agence n'est pas un incident technique :
 * c'est un visiteur qui cherchait un bien et qui ne le trouve plus, parce
 * qu'il vient d'etre vendu ou retire. La page le renvoie donc vers quelque
 * chose d'utile plutot que de s'excuser.
 */
export default function NotFound() {
  return (
    <main className="limewash flex min-h-screen items-center justify-center px-6 py-24">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-dar-blue-soft">
          <Compass className="h-8 w-8 text-dar-blue" />
        </div>

        <p className="font-mono text-sm uppercase tracking-[0.2em] text-dar-blue">
          Erreur 404
        </p>

        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-dar-ink sm:text-5xl">
          Cette page n&apos;existe pas
        </h1>

        <p className="mt-4 text-slate-600">
          L&apos;adresse est peut-être incomplète, ou le bien que vous
          cherchiez n&apos;est plus en ligne.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="bg-dar-ink hover:bg-dar-blue">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à l&apos;accueil
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/auth/login">Accéder à mon espace</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
