import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Ecran d'attente commun a l'espace agence.
 *
 * Les pages de listes interrogent la base avant de rendre quoi que ce
 * soit : sans ce fichier, un clic dans la navigation ne produisait
 * strictement rien pendant une seconde, ce qui se lit comme un logiciel
 * bloque. La barre de navigation est rendue ici aussi, pour que seule la
 * zone de contenu change entre l'attente et le resultat.
 */
export default function Loading() {
  return (
    <>
      <AgencyNavbar />
      <main className="limewash min-h-screen pt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 space-y-3">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>

          <div className="rounded-xl border border-dar-sand bg-white p-6">
            <Skeleton className="mb-6 h-5 w-40" />
            <div className="space-y-4">
              {[0, 1, 2, 3, 4, 5].map((row) => (
                <div key={row} className="flex items-center gap-4">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="hidden h-4 w-32 sm:block" />
                  <Skeleton className="hidden h-4 w-24 md:block" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
