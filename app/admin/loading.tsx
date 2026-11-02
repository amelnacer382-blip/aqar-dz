import { AdminNavbar } from "@/components/layout/AdminNavbar"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Attente de l'espace super admin.
 *
 * Meme role que celui de l'espace agence, mais sur le fond sombre de la
 * console : les blocs d'attente y sont clairs et discrets, sinon ils
 * clignotent en blanc sur noir a chaque navigation.
 */
export default function Loading() {
  return (
    <>
      <AdminNavbar />
      <main className="min-h-screen bg-slate-950 pt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 space-y-3">
            <Skeleton className="h-9 w-56 bg-slate-800" />
            <Skeleton className="h-4 w-80 bg-slate-800" />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <Skeleton className="mb-6 h-5 w-40 bg-slate-800" />
            <div className="space-y-4">
              {[0, 1, 2, 3, 4, 5].map((row) => (
                <div key={row} className="flex items-center gap-4">
                  <Skeleton className="h-4 flex-1 bg-slate-800" />
                  <Skeleton className="hidden h-4 w-32 bg-slate-800 sm:block" />
                  <Skeleton className="h-4 w-16 bg-slate-800" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
