"use client"

import Link from "next/link"
import { CalendarDays, Phone } from "lucide-react"
import { Panel, EmptyPanel } from "@/components/dashboard/Panel"

export type VisitRow = {
  id: string
  clientName: string
  clientPhone: string | null
  propertyTitle: string
  /** « aujourd'hui », « demain », ou « ven. 7 août » — calcule cote serveur. */
  dayLabel: string
  time: string
  isToday: boolean
}

/**
 * Les prochaines visites.
 *
 * Ce panneau montrait auparavant les cinq visites les plus recemment
 * SAISIES. C'est l'ordre de creation, pas celui du calendrier : un
 * rendez-vous de demain enregistre la semaine derniere passait derriere
 * une visite d'il y a un mois saisie ce matin. Un tableau de bord doit
 * repondre a « qu'est-ce qui vient », pas a « qu'est-ce qui a ete tape en
 * dernier ».
 *
 * Le telephone du client est affiche ici : quand une visite approche, la
 * seule chose qu'on veut faire est confirmer par appel.
 */
export function UpcomingVisits({ visits }: { visits: VisitRow[] }) {
  return (
    <Panel
      eyebrow="Agenda"
      title="Prochaines visites"
      href="/agency/visits"
      linkLabel="Tout voir"
    >
      {visits.length === 0 ? (
        <EmptyPanel
          icon={<CalendarDays className="h-10 w-10" />}
          message="Aucune visite à venir"
          actionLabel="Planifier une visite"
          actionHref="/agency/visits/new"
        />
      ) : (
        <ul>
          {visits.map((visit) => (
            <li key={visit.id}>
              <Link
                href={`/agency/visits/${visit.id}/edit`}
                className="group flex items-center gap-4 rounded-xl p-4 transition-colors hover:bg-dar-lime"
              >
                {/* Le jour et l'heure forment un bloc : c'est par la qu'on
                    lit un agenda, pas par le nom. */}
                <div
                  className={`flex h-14 w-16 flex-shrink-0 flex-col items-center justify-center rounded-xl border ${
                    visit.isToday
                      ? "border-dar-blue bg-dar-blue-soft"
                      : "border-dar-sand bg-dar-lime"
                  }`}
                >
                  <span
                    className={`font-mono text-[10px] uppercase tracking-wider ${
                      visit.isToday ? "text-dar-blue" : "text-slate-400"
                    }`}
                  >
                    {visit.dayLabel}
                  </span>
                  <span
                    className={`font-display text-base font-bold tabular-nums ${
                      visit.isToday ? "text-dar-blue" : "text-dar-ink"
                    }`}
                  >
                    {visit.time}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-dar-ink">
                    {visit.clientName}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-slate-500">
                    {visit.propertyTitle}
                  </p>
                </div>

                {visit.clientPhone && (
                  <span className="hidden flex-shrink-0 items-center gap-1.5 font-mono text-xs text-slate-400 transition-colors group-hover:text-dar-blue sm:inline-flex">
                    <Phone className="h-3.5 w-3.5" />
                    {visit.clientPhone}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
