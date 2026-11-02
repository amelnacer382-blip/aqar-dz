"use client"

import { motion, useScroll, useSpring } from "framer-motion"

/**
 * Jauge de lecture en haut de page. Elle reprend les deux couleurs de la
 * frise de zelliges : le filet decoratif de la marque devient un indicateur
 * de position, plutot qu'une barre de progression generique.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 240,
    damping: 40,
    restDelta: 0.001,
  })

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-dar-blue via-dar-blue to-dar-ochre"
    />
  )
}
