"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

export type BackdropPhoto = {
  src: string
  /** object-position, pour cadrer le sujet plutot que le centre du fichier */
  position?: string
  /** legende du lieu, affichee par l'appelant s'il en montre une */
  caption?: string
}

/**
 * Fond photographique vivant.
 *
 * Les photos s'enchainent en fondu et derivent lentement pendant qu'elles
 * sont affichees (travelling avant). Une maison n'est jamais figee : la
 * lumiere y tourne. C'est le meme principe ici, a une vitesse ou le
 * mouvement se remarque sans jamais disputer l'attention au texte.
 *
 * Le composant est purement decoratif : les images portent alt="" et
 * aria-hidden, elles ne sont jamais annoncees. Si le systeme demande moins
 * d'animations, la premiere photo reste affichee, immobile.
 */
export function PhotoBackdrop({
  photos,
  interval = 7000,
  className,
  imageClassName,
  onIndexChange,
}: {
  photos: BackdropPhoto[]
  /** duree d'affichage d'une photo, en millisecondes */
  interval?: number
  className?: string
  imageClassName?: string
  onIndexChange?: (index: number) => void
}) {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)


  useEffect(() => {
    if (reduce || photos.length < 2) {
      return
    }

    const id = window.setInterval(
      () => setIndex((current) => (current + 1) % photos.length),
      interval
    )

    return () => window.clearInterval(id)
  }, [reduce, photos.length, interval])

  // Notifier apres coup, jamais depuis la fonction de mise a jour d'etat :
  // React peut la rejouer, et la legende partirait en double.
  const notify = useRef(onIndexChange)
  notify.current = onIndexChange

  useEffect(() => {
    notify.current?.(index)
  }, [index])

  const photo = photos[index] ?? photos[0]

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <AnimatePresence initial={false}>
        {/*
          L'ANIMATION EST PASSEE AU CONTENEUR, l'image est devenue un
          `next/image` (story 3.7). Animer directement le composant de Next
          aurait demande `motion(Image)`, dont le comportement depend de la
          facon dont Next fusionne SON `style` — celui que pose `fill` —
          avec celui que Framer met a jour a chaque image. Un conteneur
          anime qui porte une image en `fill` donne le meme rendu et ne
          depend d'aucun detail d'implementation des deux bibliotheques.

          `priority` : cette photo est le plus grand element du premier
          ecran de la vitrine et des ecrans d'authentification. Elle EST le
          LCP ; la differer retarderait la mesure qu'on cherche a baisser.
        */}
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: reduce ? 1.02 : 1.14 }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: 1.8, ease: "easeInOut" },
            // Le travelling dure plus longtemps que l'affichage : la photo
            // sort du cadre encore en mouvement, jamais arretee net.
            scale: { duration: interval / 1000 + 4, ease: "linear" },
          }}
          className="absolute inset-0"
        >
          <Image
            src={photo.src}
            alt=""
            aria-hidden="true"
            fill
            sizes="100vw"
            priority
            /*
              QUALITE 60 PLUTOT QUE 75, et c'est mesure : villa.jpg passe
              de 137 164 a 112 954 octets en 1200 px de large. Cette photo
              est un FOND, recouvert d'un voile sombre et anime en
              permanence (scale 1.14) ; les details que les 15 points de
              qualite supplementaires preservent ne sont jamais regardes.
              Ce n'est PAS un reglage a etendre aux photos de biens : la,
              le detail EST le produit.
            */
            quality={60}
            style={{ objectPosition: photo.position ?? "50% 50%" }}
            className={cn("object-cover", imageClassName)}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
