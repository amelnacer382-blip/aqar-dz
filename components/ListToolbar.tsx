import Link from "next/link"
import { Search, X, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * Barre d'outils commune aux listes : recherche et export.
 *
 * Un formulaire GET, pas de JavaScript : la recherche se retrouve dans
 * l'URL, donc elle se partage, se met en favori et survit a un
 * rafraichissement. Les filtres deja presents dans l'URL sont reinjectes en
 * champs caches pour qu'une recherche ne les efface pas.
 */
export function ListToolbar({
  basePath,
  q,
  placeholder,
  hidden = {},
  exportPath,
  exportParams = {},
}: {
  basePath: string
  q?: string
  placeholder: string
  /** Filtres en cours a conserver lors d'une recherche. */
  hidden?: Record<string, string | undefined>
  /** Route d'export CSV, si la liste en propose un. */
  exportPath?: string
  exportParams?: Record<string, string | undefined>
}) {
  const exportHref = () => {
    const search = new URLSearchParams()
    if (q) search.set("q", q)
    Object.entries(exportParams).forEach(([key, value]) => {
      if (value) search.set(key, value)
    })
    const qs = search.toString()
    return qs ? `${exportPath}?${qs}` : (exportPath as string)
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <form action={basePath} method="GET" className="flex flex-1 items-center gap-2">
        {Object.entries(hidden).map(([key, value]) =>
          value ? <input key={key} type="hidden" name={key} value={value} /> : null
        )}

        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder={placeholder}
            className="pl-9"
            aria-label={placeholder}
          />
        </div>

        <Button type="submit" variant="outline">
          Rechercher
        </Button>

        {q && (
          <Button asChild variant="ghost" size="sm" className="text-slate-500">
            <Link href={basePath}>
              <X className="mr-1 h-4 w-4" />
              Effacer
            </Link>
          </Button>
        )}
      </form>

      {exportPath && (
        <Button asChild variant="outline" title="Télécharger la liste filtrée">
          <a href={exportHref()}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </a>
        </Button>
      )}
    </div>
  )
}
