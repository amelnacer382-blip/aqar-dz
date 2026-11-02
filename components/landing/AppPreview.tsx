"use client"

import {
  Building2,
  CalendarDays,
  FileCheck2,
  LayoutDashboard,
  Users,
} from "lucide-react"
import { CountUp } from "@/components/motion/primitives"

/**
 * Le logiciel lui-meme, en vitrine.
 *
 * Un heros doit ouvrir sur ce qu'il y a de plus caracteristique du sujet.
 * Ici le sujet est un outil de travail : ce sont donc ses ecrans, ses
 * montants en dinars et son vocabulaire metier qui ouvrent la page, pas une
 * photographie d'ambiance.
 *
 * Les donnees affichees sont un exemple, du meme ordre de grandeur qu'une
 * agence reelle — jamais une moyenne ni un resultat promis.
 */

const KPIS = [
  { label: "Biens", value: 24, icon: Building2 },
  { label: "Clients", value: 18, icon: Users },
  { label: "Visites", value: 6, icon: CalendarDays, hint: "cette semaine" },
]

/** Encaissements mensuels, en millions de dinars — echelle de l'exemple. */
const MONTHS = [
  { label: "Oct", value: 38 },
  { label: "Nov", value: 52 },
  { label: "Déc", value: 46 },
  { label: "Jan", value: 71 },
  { label: "Fév", value: 64 },
  { label: "Mar", value: 88 },
]

const ROWS = [
  {
    title: "Villa avec jardin — Hydra",
    meta: "Alger · 320 m²",
    amount: "32 000 000 DA",
    state: "À vendre",
    tone: "bg-dar-blue-soft text-dar-blue",
  },
  {
    title: "Local commercial — Kouba",
    meta: "Alger · 120 m²",
    amount: "120 000 DA / mois",
    state: "Disponible",
    tone: "bg-emerald-100 text-emerald-800",
  },
  {
    title: "Studio meublé — Bab Ezzouar",
    meta: "Alger · 38 m²",
    amount: "35 000 DA / mois",
    state: "Loué",
    tone: "bg-dar-sand text-dar-ink/70",
  },
]

const MAX = Math.max(...MONTHS.map((m) => m.value))

/** Hauteur de la barre la plus haute, en pixels. */
const BAR_MAX_PX = 60

export function AppPreview() {
  return (
    <div className="relative">
      {/*
        Le panneau est legerement incline sur grand ecran : il se lit comme
        un objet pose devant la page, pas comme une capture collee. Sous
        1024px l'inclinaison disparait — un ecran etroit rendrait le texte
        du panneau illisible.
      */}
      <div className="lg:[transform:perspective(1600px)_rotateY(-5deg)_rotateX(2.5deg)]">
        {/*
          ENTREES EN CSS (story 3.14, REP-107). Ce panneau et son contenu
          sont sur le PREMIER ECRAN de l'accueil. Ecrits en Framer, ils
          etaient livres a `opacity: 0` dans le HTML rendu par le serveur :
          le produit que cette page existe pour montrer n'apparaissait
          qu'une fois le JavaScript execute.
          La choregraphie ne change pas — memes delais, memes durees, meme
          courbe. Seul le moment ou elle peut commencer change.
        */}
        <div
          style={{ animationDelay: "0.15s", animationDuration: "1s" }}
          className="entree overflow-hidden rounded-2xl border border-white/10 bg-[#F7F8F7] shadow-[0_50px_100px_-40px_rgba(0,0,0,0.75)]"
        >
          {/* Barre du logiciel : la vraie, reduite */}
          <div className="flex items-center justify-between border-b border-dar-sand bg-white/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="arch flex h-6 w-5 items-end justify-center rounded-b-[2px] bg-dar-ink pb-0.5">
                <Building2 className="h-2.5 w-2.5 text-white" />
              </span>
              {/* La maquette montre le vrai logiciel : elle doit porter le
                  meme nom que sa barre de navigation. */}
              <span className="font-display text-sm font-bold tracking-tight text-dar-ink">
                Aqar<span className="font-medium text-dar-blue"> DZ</span>
              </span>
            </div>
            <div className="hidden items-center gap-1 sm:flex">
              <span className="flex items-center gap-1 rounded bg-dar-blue-soft px-2 py-1 text-[11px] font-medium text-dar-blue">
                <LayoutDashboard className="h-3 w-3" />
                Dashboard
              </span>
              {["Biens", "Clients", "Visites", "Loyers"].map((tab) => (
                <span key={tab} className="px-2 py-1 text-[11px] text-dar-ink/45">
                  {tab}
                </span>
              ))}
            </div>
            <span className="h-6 w-6 rounded-full bg-dar-blue-soft" />
          </div>

          <div className="space-y-4 p-4">
            {/* Indicateurs */}
            <div className="grid grid-cols-3 gap-3">
              {KPIS.map((kpi, index) => (
                <div
                  key={kpi.label}
                  style={{
                    animationDelay: `${0.5 + index * 0.1}s`,
                    animationDuration: "0.6s",
                  }}
                  className="entree rounded-lg border border-dar-sand bg-white p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-dar-ink/50">{kpi.label}</span>
                    <kpi.icon className="h-3 w-3 text-dar-ink/30" />
                  </div>
                  <p className="mt-1 font-display text-xl font-bold text-dar-ink">
                    <CountUp value={kpi.value} duration={1.2} />
                  </p>
                  {kpi.hint && (
                    <p className="text-[10px] text-dar-ink/40">{kpi.hint}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Encaissements : une seule serie, donc une seule couleur */}
            <div
              style={{ animationDelay: "0.8s", animationDuration: "0.6s" }}
              className="entree rounded-lg border border-dar-sand bg-white p-3"
            >
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-medium text-dar-ink/60">
                  Encaissements
                </p>
                <p className="font-mono text-[10px] text-dar-ink/40">
                  6 derniers mois
                </p>
              </div>
              {/*
                Hauteurs en pixels, pas en pourcentage : un pourcentage se
                resout contre un parent de hauteur automatique et retombe a
                zero — les barres etaient invisibles.
              */}
              <div className="mt-3 flex items-end gap-2">
                {MONTHS.map((month, index) => (
                  <div
                    key={month.label}
                    className="flex flex-1 flex-col items-center justify-end gap-1"
                  >
                    <span
                      style={{
                        height: Math.round((month.value / MAX) * BAR_MAX_PX),
                        animationDelay: `${1 + index * 0.07}s`,
                      }}
                      className="entree-hauteur w-full rounded-t bg-dar-blue"
                    />
                    <span className="font-mono text-[9px] text-dar-ink/35">
                      {month.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Portefeuille */}
            <div className="rounded-lg border border-dar-sand bg-white">
              {ROWS.map((row, index) => (
                <div
                  key={row.title}
                  style={{
                    animationDelay: `${1.25 + index * 0.14}s`,
                    animationDuration: "0.6s",
                  }}
                  className="entree flex items-center gap-3 border-b border-dar-sand px-3 py-2.5 last:border-b-0"
                >
                  <span className="h-8 w-8 shrink-0 rounded bg-dar-sand" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-dar-ink">
                      {row.title}
                    </p>
                    <p className="truncate text-[10px] text-dar-ink/45">{row.meta}</p>
                  </div>
                  <span
                    className={`hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium sm:inline ${row.tone}`}
                  >
                    {row.state}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-dar-ink/70">
                    {row.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/*
        La preuve que le logiciel travaille : une quittance sort en PDF.
        C'est l'operation la plus concrete du metier, elle arrive en dernier.
      */}
      <div
        style={{ animationDelay: "2.2s" }}
        className="entree-pose absolute -bottom-7 left-2 flex items-center gap-2.5 rounded-xl border border-dar-sand bg-white px-3.5 py-2.5 shadow-card lg:-left-14"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
          <FileCheck2 className="h-4 w-4 text-emerald-700" />
        </span>
        <div>
          <p className="text-[12px] font-medium text-dar-ink">
            Quittance de mars générée
          </p>
          <p className="font-mono text-[10px] text-dar-ink/45">
            Studio Bab Ezzouar · PDF
          </p>
        </div>
      </div>
    </div>
  )
}
