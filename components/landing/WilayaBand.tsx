import { MapPin, SlidersHorizontal, Store } from "lucide-react"
import { Reveal } from "@/components/motion/primitives"

/**
 * Deuxieme section : la couverture territoriale.
 *
 * Elle n'est pas decorative. La wilaya est un champ de chaque bien et le
 * premier filtre de la vitrine publique : cette section montre le maillage
 * sur lequel le logiciel travaille, juste apres avoir montre le logiciel.
 *
 * Deux courants opposes plutot qu'un seul defile : la ligne du haut porte
 * les noms a pleine valeur, celle du bas les repete en retrait et en sens
 * inverse. C'est ce croisement qui donne l'impression d'un territoire
 * traverse, la ou un ruban unique ne serait qu'un bandeau publicitaire.
 *
 * Le defilement est en CSS pur (aucun calcul par image) et s'arrete au
 * survol ; la regle globale prefers-reduced-motion le fige.
 */
const WILAYAS_NORD = [
  "Alger",
  "Oran",
  "Constantine",
  "Annaba",
  "Blida",
  "Sétif",
  "Tlemcen",
  "Béjaïa",
  "Tizi Ouzou",
  "Boumerdès",
  "Mostaganem",
  "Skikda",
]

const WILAYAS_SUD = [
  "Batna",
  "Biskra",
  "Djelfa",
  "Ouargla",
  "Ghardaïa",
  "Adrar",
  "Tamanrasset",
  "Béchar",
  "El Oued",
  "Laghouat",
  "Tébessa",
  "Sidi Bel Abbès",
]

const REPERES = [
  { icon: MapPin, label: "La wilaya et la commune sont saisies sur chaque bien" },
  { icon: SlidersHorizontal, label: "Opération, type, wilaya et budget filtrent la vitrine" },
  { icon: Store, label: "Chaque agence publie la sienne, à sa propre adresse" },
]

function Track({
  items,
  className,
  markerClassName,
  ariaHidden,
}: {
  items: string[]
  className: string
  markerClassName: string
  ariaHidden?: boolean
}) {
  return (
    <div
      aria-hidden={ariaHidden ? "true" : undefined}
      className="flex shrink-0 items-center gap-8 pr-8"
    >
      {items.map((wilaya) => (
        <span
          key={wilaya}
          className={`flex items-center gap-8 whitespace-nowrap font-display tracking-tight ${className}`}
        >
          {wilaya}
          {/* Losange de zellige en separateur, plutot qu'une puce */}
          <span className={`h-1.5 w-1.5 rotate-45 ${markerClassName}`} />
        </span>
      ))}
    </div>
  )
}

export function WilayaBand() {
  return (
    <section className="limewash relative overflow-hidden border-b border-dar-sand py-20">
      {/* Fond : quadrillage a l'encre, plus deux lavis de couleur tres dilues */}
      <div aria-hidden="true" className="grid-ink absolute inset-0" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[10%] -top-[30%] h-[30rem] w-[30rem] rounded-full bg-dar-blue/[0.07] blur-[110px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[35%] -right-[8%] h-[26rem] w-[26rem] rounded-full bg-dar-ochre/[0.09] blur-[110px]"
      />

      <div className="container relative z-10 mx-auto px-4">
        <Reveal className="max-w-2xl">
          <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.18em] text-dar-blue">
            Couverture
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-dar-ink md:text-[2.6rem] md:leading-[1.1]">
            Vos biens, wilaya par wilaya.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-dar-ink/65">
            Chaque bien porte sa wilaya et sa commune. Vos clients cherchent
            dessus, sur votre vitrine, sans vous appeler pour savoir ce que vous
            avez à Hydra ou à Oran.
          </p>
        </Reveal>
      </div>

      {/*
        Deux courants opposes. Les fondus sont poses hors du conteneur
        espace : dans un `space-y`, ils heritaient d'une marge et se
        decalaient d'une ligne.
      */}
      <div className="relative z-10 mt-14">
        <div className="space-y-3">
          <div className="group flex w-max animate-marquee items-center hover:[animation-play-state:paused]">
            <Track
              items={WILAYAS_NORD}
              className="text-2xl font-semibold text-dar-ink/75 sm:text-[2rem]"
              markerClassName="bg-dar-ochre"
            />
            <Track
              items={WILAYAS_NORD}
              className="text-2xl font-semibold text-dar-ink/75 sm:text-[2rem]"
              markerClassName="bg-dar-ochre"
              ariaHidden
            />
          </div>

          <div className="group flex w-max animate-marquee-reverse items-center hover:[animation-play-state:paused]">
            <Track
              items={WILAYAS_SUD}
              className="text-xl font-medium text-dar-ink/30 sm:text-2xl"
              markerClassName="bg-dar-blue/40"
            />
            <Track
              items={WILAYAS_SUD}
              className="text-xl font-medium text-dar-ink/30 sm:text-2xl"
              markerClassName="bg-dar-blue/40"
              ariaHidden
            />
          </div>
        </div>

        {/* Fondus lateraux : la bande entre et sort du cadre au lieu d'etre coupee */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#F4F5F3] via-[#F4F5F3]/80 to-transparent sm:w-56" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#F4F5F3] via-[#F4F5F3]/80 to-transparent sm:w-56" />
      </div>

      {/* Ce que le maillage permet concretement */}
      <div className="container relative z-10 mx-auto px-4">
        <Reveal delay={0.1}>
          <ul className="mt-14 grid max-w-5xl gap-x-10 gap-y-5 border-t border-dar-sand pt-8 sm:grid-cols-3">
            {REPERES.map((repere) => (
              <li key={repere.label} className="flex items-start gap-3">
                <span className="arch mt-0.5 flex h-7 w-6 shrink-0 items-end justify-center rounded-b-[2px] bg-dar-blue-soft pb-1">
                  <repere.icon className="h-3 w-3 text-dar-blue" />
                </span>
                <span className="text-sm leading-relaxed text-dar-ink/60">
                  {repere.label}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
