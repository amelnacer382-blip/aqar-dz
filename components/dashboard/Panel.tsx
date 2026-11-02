"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

/**
 * Coquille commune aux deux panneaux du bas.
 *
 * Meme cadre, meme eyebrow en chasse fixe, meme lien de sortie : les deux
 * colonnes doivent se lire comme deux pages du meme registre, pas comme
 * deux composants ecrits a des moments differents.
 */
export function Panel({
  eyebrow,
  title,
  href,
  linkLabel,
  children,
}: {
  eyebrow: string
  title: string
  href: string
  linkLabel: string
  children: React.ReactNode
}) {
  return (
    // Pas de h-full : la grille aligne deja les panneaux en haut, et forcer
    // la hauteur ici les re-etirait tous les deux a la meme taille — le
    // plus court se retrouvait avec un grand vide sous sa derniere ligne.
    <section className="flex flex-col rounded-2xl border border-dar-sand bg-white">
      <header className="flex items-center justify-between gap-4 border-b border-dar-sand px-7 py-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
            {eyebrow}
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold tracking-tight text-dar-ink">
            {title}
          </h2>
        </div>

        <Link
          href={href}
          className="group inline-flex flex-shrink-0 items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-dar-blue"
        >
          {linkLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </header>

      <div className="flex-1 p-3">{children}</div>
    </section>
  )
}

/** Etat vide : une invitation a agir, jamais un simple constat. */
export function EmptyPanel({
  icon,
  message,
  actionLabel,
  actionHref,
}: {
  icon: React.ReactNode
  message: string
  actionLabel: string
  actionHref: string
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 text-slate-300">{icon}</div>
      <p className="font-medium text-dar-ink">{message}</p>
      <Link
        href={actionHref}
        className="mt-2 text-sm text-dar-blue hover:underline"
      >
        {actionLabel}
      </Link>
    </div>
  )
}
