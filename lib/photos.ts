import type { BackdropPhoto } from "@/components/motion/PhotoBackdrop"

/**
 * Les photographies de la marque, en un seul endroit.
 *
 * Toutes sont des lieux algeriens reels, sous licence libre, servies depuis
 * /public : aucune dependance a un service externe a l'execution. Les
 * mentions d'auteur et de licence sont dans le pied de page du site.
 *
 * Deux jeux, parce qu'un cadrage n'est pas transposable : la meme photo
 * n'expose pas le meme sujet dans une arche verticale et dans un bandeau
 * large.
 */

/** Cadre vertical : arche du heros, panneau des ecrans de connexion. */
export const CASBAH_TALL: BackdropPhoto[] = [
  {
    src: "/images/casbah-interieur.jpg",
    position: "50% 38%",
    caption: "Une arche en ouvre une autre",
  },
  {
    src: "/images/casbah-patrimoine.jpg",
    position: "52% 46%",
    caption: "Une porte sculptée, rue de la Casbah",
  },
]

/** Cadre large : bandeau de la vitrine, bande des wilayas. */
export const CASBAH_WIDE: BackdropPhoto[] = [
  {
    src: "/images/casbah-interieur.jpg",
    position: "50% 28%",
    caption: "Une arche en ouvre une autre",
  },
  {
    src: "/images/casbah-patrimoine.jpg",
    position: "50% 30%",
    caption: "Une porte sculptée, rue de la Casbah",
  },
]
