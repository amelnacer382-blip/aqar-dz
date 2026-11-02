"use client"

import Image from "next/image"
import { useRef } from "react"
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion"
import { Reveal, Stagger, StaggerItem } from "@/components/motion/primitives"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { CATALOGUE, lienInscription } from "@/lib/offres"

/**
 * Cette section LIT le catalogue, elle ne le redit pas.
 *
 * Elle en portait sa propre copie — trois noms, trois tarifs, trois listes
 * d'arguments — pendant que la base ne connaissait que `basic` et
 * `premium`. La page vendait donc ce que le produit ignorait. Les tarifs
 * et les plafonds vivent desormais dans `lib/offres.ts` (story 6.1).
 *
 * Chaque bouton porte SON offre jusqu'au formulaire (story 6.2, FR-3) :
 * les trois destinations sont distinctes. Elles menaient toutes les trois
 * a `/auth/register` nu, et le visiteur qui venait de choisir sa colonne
 * arrivait devant un formulaire qui l'ignorait.
 */
export function PricingSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()

  // La photo derriere les tarifs derive plus lentement que la page : c'est
  // ce decalage qui donne la profondeur, pas un effet supplementaire.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  })
  const backdropY = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"])

  return (
    <section
      ref={sectionRef}
      id="pricing"
      className="relative overflow-hidden bg-dar-ink py-24"
    >
      {/* La villa au crepuscule : ce que l'agence vend, en arriere-plan. */}
      <div className="absolute inset-0">
        {/*
          L'ANIMATION EST PASSEE AU CONTENEUR (story 3.7) : l'image est
          desormais servie par `next/image`, qui pose son propre `style`
          quand on lui demande `fill`. Un conteneur anime portant une image
          en `fill` donne le meme rendu sans dependre de la facon dont les
          deux bibliotheques fusionnent leurs styles.

          PAS DE `priority` ICI : ce bandeau est la section des tarifs, tout
          en bas de la page d'accueil. Le charger en priorite volerait de la
          bande passante a ce que le visiteur regarde d'abord.
        */}
        <motion.div
          style={reduce ? undefined : { y: backdropY }}
          /*
            Deux mouvements composes : la derive au defilement (y, pilotee
            par la position de la page) et un travelling continu (scale, en
            boucle lente). La villa ne se fige jamais completement.
          */
          animate={reduce ? undefined : { scale: [1, 1.14, 1] }}
          transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
          className="relative h-[112%] w-full"
        >
          <Image
            src="/images/villa.jpg"
            alt=""
            aria-hidden="true"
            fill
            sizes="100vw"
            /* Meme motif que PhotoBackdrop : un fond voile, jamais scrute. */
            quality={60}
            className="object-cover"
          />
        </motion.div>
        {/*
          Le voile est plus dense au centre, la ou se posent les cartes : la
          photo reste lisible en haut et en bas du cadre, et le texte blanc
          garde un fond assez sombre pour rester net.
        */}
        <div className="absolute inset-0 bg-dar-ink/72" />
        <div className="absolute inset-0 bg-gradient-to-b from-dar-ink/25 via-dar-ink/60 to-dar-ink/35" />
        <div className="claustra absolute inset-0 opacity-30" />
      </div>

      <div className="container relative z-10 mx-auto px-4">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <Reveal>
            <h2 className="font-display text-3xl font-bold tracking-tight text-white md:text-[2.6rem] md:leading-[1.1]">
              Un tarif par taille d&apos;agence
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-white/80">
              Sans engagement. Votre agence est activée manuellement par notre
              équipe après inscription.
            </p>
          </Reveal>
        </div>

        <Stagger className="grid grid-cols-1 gap-6 md:grid-cols-3" amount={0.15}>
          {CATALOGUE.map((offre) => (
            <StaggerItem key={offre.cle} className="h-full">
              <Card
                className={
                  offre.populaire
                    ? "lift relative h-full border-dar-ochre/60 bg-white shadow-arch"
                    : "lift h-full border-white/15 bg-dar-ink/55 backdrop-blur-md hover:border-white/30"
                }
              >
                {offre.populaire && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-dar-ochre px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-white">
                    Le plus choisi
                  </span>
                )}
                <CardHeader>
                  <CardTitle
                    className={`font-display text-xl ${offre.populaire ? "text-dar-ink" : "text-white"}`}
                  >
                    {offre.nom}
                  </CardTitle>
                  <CardDescription
                    className={offre.populaire ? "text-dar-ink/60" : "text-white/70"}
                  >
                    {offre.accroche}
                  </CardDescription>
                  <p className="pt-4">
                    <span
                      className={`font-display text-4xl font-bold ${offre.populaire ? "text-dar-ink" : "text-white"}`}
                    >
                      {offre.prix}
                    </span>
                    <span
                      className={`ml-1.5 font-mono text-sm ${offre.populaire ? "text-dar-ink/50" : "text-white/60"}`}
                    >
                      {offre.periode}
                    </span>
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {offre.atouts.map((atout) => (
                      <li key={atout} className="flex items-start gap-2.5 text-sm">
                        <Check
                          className={`mt-0.5 h-4 w-4 shrink-0 ${offre.populaire ? "text-dar-blue" : "text-dar-ochre"}`}
                        />
                        <span className={offre.populaire ? "text-dar-ink/75" : "text-white/85"}>
                          {atout}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    asChild
                    className={
                      offre.populaire
                        ? "sheen w-full bg-dar-ink hover:bg-dar-blue"
                        : "w-full border border-white/30 bg-white/15 text-white hover:bg-white hover:text-dar-ink"
                    }
                  >
                    <Link href={lienInscription(offre.cle)}>{offre.appel}</Link>
                  </Button>
                </CardFooter>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
