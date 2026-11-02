"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { Plus, CalendarPlus, ArrowUpRight } from "lucide-react"
import { CountUp, EASE } from "@/components/motion/primitives"

export type Alert = {
  key: string
  value: number
  label: string
  detail: string
  href: string
  /** Ce que la couleur dit : bleu = aujourd'hui, ocre = en attente, terre = en retard. */
  tone: "today" | "waiting" | "late"
}

const TONES: Record<Alert["tone"], string> = {
  today: "text-dar-blue-light",
  waiting: "text-dar-ochre",
  late: "text-[#E0836A]",
}

/**
 * Bandeau d'ouverture du tableau de bord.
 *
 * C'est la seule surface sombre de l'espace de gestion, et c'est
 * volontaire : le tableau de bord doit se reconnaitre au premier coup
 * d'oeil parmi une trentaine d'ecrans qui partagent tous le meme fond
 * clair. La trame de claustra et l'encre viennent du site public — on ne
 * cree pas un langage de plus, on ramene celui de la marque a l'interieur.
 *
 * Il porte quatre chiffres, et ce ne sont pas des totaux : ce sont les
 * quatre choses qui attendent quelqu'un aujourd'hui. Un total de biens ne
 * change pas d'un jour a l'autre et n'appelle aucune action ; une relance
 * en retard, si. Chaque chiffre est un lien vers l'ecran ou l'on agit.
 *
 * Un compteur a zero est volontairement eteint : rien a signaler doit se
 * lire comme rien a signaler, pas comme une pastille de plus.
 */
export function DashboardHeader({
  greeting,
  agencyName,
  dateLabel,
  alerts,
}: {
  greeting: string
  agencyName: string
  dateLabel: string
  alerts: Alert[]
}) {
  const reduce = useReducedMotion()

  return (
    <motion.section
      initial={{ opacity: 0, y: reduce ? 0 : 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: EASE }}
      className="relative overflow-hidden rounded-3xl bg-dar-ink text-white shadow-arch"
    >
      {/* Trame de moucharabieh, très en retrait : elle donne de la matière
          sans jamais concurrencer le texte. */}
      <div className="claustra pointer-events-none absolute inset-0 opacity-[0.55]" />

      {/* Une seule source de lumière, en haut à droite, derrière le titre. */}
      <div
        className="pointer-events-none absolute -right-24 -top-40 h-[420px] w-[420px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(30,95,116,0.55) 0%, rgba(30,95,116,0) 68%)",
        }}
      />

      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-6 p-7 sm:p-9">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/45">
              {dateLabel}
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-[2.5rem] sm:leading-[1.1]">
              {greeting},{" "}
              <span className="text-dar-blue-light">{agencyName}</span>
            </h1>
          </div>

          {/* En etroit les deux actions occupent chacune la moitie de la
              largeur : empilees et de longueurs differentes, elles
              donnaient un bord droit en escalier. */}
          <div className="flex w-full items-center gap-2.5 sm:w-auto">
            <Link
              href="/agency/visits/new"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-sm font-medium text-white/85 transition-colors hover:border-white/40 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dar-blue-light sm:flex-none"
            >
              <CalendarPlus className="h-4 w-4" />
              {/* Le complement vit DANS le meme span : en faire un enfant
                  du flex lui appliquait l'ecart, et le libelle s'affichait
                  « Planifier  une visite » avec deux espaces. */}
              <span className="whitespace-nowrap">
                Planifier<span className="hidden lg:inline"> une visite</span>
              </span>
            </Link>
            <Link
              href="/agency/properties/new"
              className="sheen inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-dar-ink transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dar-blue-light sm:flex-none"
            >
              <Plus className="h-4 w-4" />
              <span className="whitespace-nowrap">Nouveau bien</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-white/10 lg:grid-cols-4">
          {alerts.map((alert, index) => {
            const active = alert.value > 0

            return (
              <Link
                key={alert.key}
                href={alert.href}
                className={`group relative p-6 transition-colors hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dar-blue-light sm:p-7 ${
                  index % 2 === 1 ? "border-l border-white/10" : ""
                } ${index >= 2 ? "border-t border-white/10 lg:border-t-0" : ""} ${
                  index === 2 ? "lg:border-l lg:border-white/10" : ""
                }`}
              >
                <span
                  className={`block font-display text-4xl font-bold tabular-nums ${
                    active ? TONES[alert.tone] : "text-white/25"
                  }`}
                >
                  <CountUp value={alert.value} />
                </span>

                <span className="mt-2 block text-sm font-medium text-white/90 group-hover:text-white">
                  {alert.label}
                </span>
                <span
                  className={`mt-0.5 block text-xs ${
                    active ? "text-white/50" : "text-white/30"
                  }`}
                >
                  {alert.detail}
                </span>

                {/* Visible en permanence, pas seulement au survol : sur
                    telephone il n'y a pas de survol, et l'indice qu'une
                    tuile mene quelque part disparaissait entierement. */}
                <ArrowUpRight className="absolute right-5 top-5 h-4 w-4 text-white/20 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-white/60" />
              </Link>
            )
          })}
        </div>
      </div>
    </motion.section>
  )
}
