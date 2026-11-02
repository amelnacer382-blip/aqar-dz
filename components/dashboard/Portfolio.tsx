"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { Building2, ArrowRight } from "lucide-react"
import { EASE } from "@/components/motion/primitives"

/**
 * Les chiffres de ces deux panneaux ne sont pas animes, contrairement a
 * ceux du bandeau.
 *
 * Le compteur anime ne demarre qu'une fois la valeur entree dans le cadre :
 * sur telephone, ces panneaux sont sous la ligne de flottaison et
 * affichaient donc « 0 » tant qu'on n'avait pas fait defiler jusqu'a eux.
 * Une page d'accueil peut se le permettre, un outil de travail non — un
 * chiffre faux, meme une seconde, est un chiffre faux.
 */

export type StatusSlice = { status: string; count: number }

/**
 * Les cinq etats d'un bien, dans l'ordre du cycle de vie et non par
 * quantite : disponible, reserve, puis sorti du marche. La barre garde le
 * meme ordre d'un jour a l'autre, sinon on ne peut pas la comparer d'un
 * coup d'oeil avec celle de la veille.
 */
const SLICES: { status: string; label: string; color: string }[] = [
  { status: "disponible", label: "Disponible", color: "#1E5F74" },
  { status: "reserve", label: "Réservé", color: "#C8892F" },
  { status: "loue", label: "Loué", color: "#6FBAD2" },
  { status: "vendu", label: "Vendu", color: "#9C4A2F" },
  { status: "archive", label: "Archivé", color: "#C9C4B8" },
]

/**
 * Le portefeuille de biens.
 *
 * Quatre tuiles affichaient auparavant quatre totaux sans rapport entre
 * eux — dont un « taux de disponibilite » en pourcentage, qui demandait a
 * l'oeil de reconstruire mentalement la repartition. La barre la montre
 * directement : c'est la meme information, lue en une fois.
 */
export function PortfolioPanel({
  total,
  slices,
}: {
  total: number
  slices: StatusSlice[]
}) {
  const reduce = useReducedMotion()

  const byStatus = new Map(slices.map((slice) => [slice.status, slice.count]))
  const present = SLICES.map((slice) => ({
    ...slice,
    count: byStatus.get(slice.status) ?? 0,
  })).filter((slice) => slice.count > 0)

  return (
    <section className="flex h-full flex-col rounded-2xl border border-dar-sand bg-white p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
            Portefeuille
          </p>
          <p className="mt-3 font-display text-5xl font-bold leading-none tracking-tight tabular-nums text-dar-ink">
            {total}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            bien{total > 1 ? "s" : ""} au total
          </p>
        </div>

        <Link
          href="/agency/properties"
          className="group inline-flex items-center gap-1.5 rounded-full border border-dar-sand px-3.5 py-2 text-sm text-slate-600 transition-colors hover:border-dar-blue hover:text-dar-blue"
        >
          Ouvrir
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {total === 0 ? (
        <div className="mt-8 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-dar-sand py-10 text-center">
          <Building2 className="mb-3 h-10 w-10 text-slate-300" />
          <p className="font-medium text-dar-ink">Aucun bien enregistré</p>
          <Link
            href="/agency/properties/new"
            className="mt-2 text-sm text-dar-blue hover:underline"
          >
            Ajouter le premier
          </Link>
        </div>
      ) : (
        <>
          {/* La barre : une seule ligne, pas d'etiquette dessus — elle donne
              la forme, la legende donne les chiffres. */}
          <div className="mt-8 flex h-3 gap-1 overflow-hidden">
            {present.map((slice, index) => (
              <motion.div
                key={slice.status}
                className="h-full rounded-full"
                style={{ backgroundColor: slice.color }}
                initial={{ flexGrow: reduce ? slice.count : 0 }}
                animate={{ flexGrow: slice.count }}
                transition={{
                  duration: 1,
                  delay: 0.15 + index * 0.08,
                  ease: EASE,
                }}
              />
            ))}
          </div>

          <ul className="mt-7 grid grid-cols-2 gap-x-6 gap-y-3.5 sm:grid-cols-3">
            {present.map((slice) => (
              <li key={slice.status} className="flex items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="font-mono text-sm font-medium tabular-nums text-dar-ink">
                  {slice.count}
                </span>
                <span className="truncate text-sm text-slate-500">
                  {slice.label}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export type RegisterLine = {
  label: string
  value: number
  href: string
}

/**
 * Le repertoire : combien de personnes et de rendez-vous l'agence suit.
 *
 * Chiffres alignes a droite en chasse fixe, separes par des filets : c'est
 * une page de registre, et elle se lit en colonne.
 */
export function RegisterPanel({ lines }: { lines: RegisterLine[] }) {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-dar-sand bg-white p-7">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
        Répertoire
      </p>

      <ul className="mt-2 flex flex-1 flex-col justify-center divide-y divide-dar-sand">
        {lines.map((line) => (
          <li key={line.label}>
            <Link
              href={line.href}
              className="group flex items-baseline justify-between gap-4 py-4 transition-colors hover:text-dar-blue"
            >
              <span className="text-sm text-slate-600 group-hover:text-dar-blue">
                {line.label}
              </span>
              <span className="font-display text-2xl font-bold tabular-nums text-dar-ink group-hover:text-dar-blue">
                {line.value}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
