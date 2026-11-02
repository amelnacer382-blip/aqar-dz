"use client"

import { useEffect, useRef, useState } from "react"
import {
  animate,
  motion,
  useInView,
  useReducedMotion,
  type Variants,
} from "framer-motion"
import { cn } from "@/lib/utils"

/**
 * Vocabulaire d'animation de la marque.
 *
 * Le motif du produit est l'arche : une ouverture. Le mouvement dit donc
 * toujours la meme chose — quelque chose s'ouvre, de bas en haut. Une seule
 * courbe d'acceleration partout (demarrage vif, arrivee longue), et jamais de
 * translation horizontale : elle deborderait la page sur mobile.
 *
 * Toutes les primitives lisent la preference systeme "reduire les animations"
 * et se contentent alors d'un fondu.
 */
export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

/** Reveal au defilement : monte et apparait une fois entre dans le cadre. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  amount = 0.25,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
  amount?: number
}) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

const staggerParent: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
}

const staggerChild: Variants = {
  hidden: { opacity: 0, y: 26 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.75, ease: EASE } },
}

/** Conteneur dont les enfants <StaggerItem> entrent l'un apres l'autre. */
export function Stagger({
  children,
  className,
  amount = 0.15,
}: {
  children: React.ReactNode
  className?: string
  amount?: number
}) {
  return (
    <motion.div
      className={className}
      variants={staggerParent}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div className={className} variants={staggerChild}>
      {children}
    </motion.div>
  )
}

/**
 * Ligne de titre revelee par un masque : le texte monte depuis sous la ligne
 * de base, comme un store qu'on leve. Le rembourrage bas evite que le masque
 * ne rogne les jambages des lettres.
 */
export function MaskLine({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <span className="block overflow-hidden pb-[0.12em]">
      {/*
        CETTE ANIMATION EST EN CSS, ET C'EST LE SUJET DE LA STORY 3.14.

        Elle etait ecrite en Framer : `initial={{ y: "115%" }}`. Or Framer
        ecrit les valeurs de `initial` DANS LE STYLE RENDU PAR LE SERVEUR —
        le titre de l'accueil etait donc livre pousse sous son masque, et
        n'apparaissait qu'une fois le JavaScript execute. Mesure du
        17-08-2026 : LCP 3,459 s pour un TTI de 3,459 s, la meme
        milliseconde (REP-107).

        `MaskLine` n'est utilise QUE dans le heros, c'est-a-dire au-dessus
        de la ligne de flottaison. La regle posee par la story : on n'anime
        pas l'entree de ce qui est deja a l'ecran. Les primitives voisines —
        `Reveal`, `Stagger` — restent en Framer : elles se declenchent au
        DEFILEMENT, sur ce qui n'est pas encore regarde.

        `useReducedMotion()` n'est plus consulte ici : le bloc
        `prefers-reduced-motion` de `app/globals.css` coupe deja duree ET
        delai de toute animation CSS. Une seule regle plutot que deux.
      */}
      <span
        className={cn("entree-masque block", className)}
        style={{ animationDelay: `${delay}s` }}
      >
        {children}
      </span>
    </span>
  )
}

/**
 * Compteur : un chiffre qui se pose vaut mieux qu'un chiffre qui apparait.
 * Le decompte ne part qu'une fois la valeur visible, et la valeur finale est
 * affichee telle quelle si l'utilisateur a demande moins d'animations.
 */
export function CountUp({
  value,
  suffix = "",
  duration = 1.4,
  className,
}: {
  value: number
  suffix?: string
  duration?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const reduce = useReducedMotion()

  /**
   * LE RENDU SERVEUR PORTE LA VALEUR FINALE — story 3.14.
   *
   * Il portait `0`. Sans JavaScript, la page d'accueil annoncait donc
   * « 0 modules metier », « 0 types de biens » : pas un ecran vide, un
   * ecran FAUX. Et c'est ce que lisait aussi tout robot qui n'execute pas
   * de script.
   *
   * `null` signifie « le decompte n'a pas commence » : on rend alors la
   * valeur reelle. Une fois la valeur en vue et le script en marche, le
   * decompte prend la main.
   *
   * LE COUT, ecrit parce qu'il est reel : a l'hydratation, le chiffre
   * repart de zero — une image, avant que l'oeil ne s'y pose. C'est le
   * prix d'un chiffre juste pour qui n'a pas de JavaScript, et il est
   * moins cher que l'inverse.
   */
  const [display, setDisplay] = useState<number | null>(null)

  useEffect(() => {
    if (!inView || reduce) {
      return
    }

    const controls = animate(0, value, {
      duration,
      ease: EASE,
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    })

    return () => controls.stop()
  }, [inView, reduce, value, duration])

  return (
    <span ref={ref} className={className}>
      {display ?? value}
      {suffix}
    </span>
  )
}
