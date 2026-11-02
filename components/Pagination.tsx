import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { pageCount } from "@/lib/list-params"

/**
 * Pagination des listes.
 *
 * Deux liens et un reperage : « 26–50 sur 312 ». Le nombre total compte
 * autant que la navigation — une agence doit savoir combien de biens elle
 * possede sans changer de page.
 *
 * Les liens conservent les filtres en cours : changer de page ne doit
 * jamais reinitialiser une recherche.
 */
export function Pagination({
  page,
  perPage,
  total,
  basePath,
  params = {},
}: {
  page: number
  perPage: number
  total: number
  basePath: string
  /** Filtres a conserver dans l'URL (recherche, statut, tri...). */
  params?: Record<string, string | undefined>
}) {
  const pages = pageCount(total, perPage)

  if (total === 0) return null

  const href = (target: number) => {
    const search = new URLSearchParams()

    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value)
    })

    if (target > 1) search.set("page", String(target))

    const qs = search.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  const first = (page - 1) * perPage + 1
  const last = Math.min(page * perPage, total)

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-dar-sand pt-4">
      <p className="font-mono text-xs text-slate-500">
        {first}–{last} sur {total}
      </p>

      {pages > 1 && (
        <div className="flex items-center gap-1">
          {page > 1 ? (
            <Link
              href={href(page - 1)}
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-dar-ink/70 transition-colors hover:bg-white hover:text-dar-ink"
            >
              <ChevronLeft className="h-4 w-4" />
              Précédent
            </Link>
          ) : (
            <span className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-300">
              <ChevronLeft className="h-4 w-4" />
              Précédent
            </span>
          )}

          <span className="px-3 font-mono text-xs text-slate-500">
            {page} / {pages}
          </span>

          {page < pages ? (
            <Link
              href={href(page + 1)}
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-dar-ink/70 transition-colors hover:bg-white hover:text-dar-ink"
            >
              Suivant
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-300">
              Suivant
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </div>
      )}
    </div>
  )
}
