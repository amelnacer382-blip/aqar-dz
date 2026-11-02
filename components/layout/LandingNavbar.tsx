"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, Menu, X, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EASE } from "@/components/motion/primitives"

const navLinks = [
  { href: "#features", label: "Fonctionnalités" },
  { href: "#pricing", label: "Tarifs" },
  { href: "#contact", label: "Contact" },
]

/**
 * En-tete de la page publique.
 *
 * Deux etats, un seul geste. En haut de page la barre est invisible : elle
 * laisse le heros occuper tout le cadre. Des que la page bouge, elle se
 * ramasse en un ilot flottant, detache des bords — la navigation devient un
 * objet pose sur le contenu, plus une bande collee au sommet.
 *
 * La hauteur occupee ne change jamais (64 px) : c'est l'ilot qui rentre a
 * l'interieur. Une barre qui maigrit ouvrirait une bande vide sous elle.
 *
 * La pastille de section n'est pas decorative : elle suit la section a
 * l'ecran et repond a « ou suis-je ». Elle disparait sur le heros, ou la
 * question ne se pose pas.
 */
export function LandingNavbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12)
      // Sur le heros, aucune section n'est « courante ».
      if (window.scrollY < 240) setActive(null)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const sections = navLinks
      .map((link) => document.getElementById(link.href.slice(1)))
      .filter((el): el is HTMLElement => el !== null)

    if (sections.length === 0) return

    // La bande observee est une tranche au milieu de l'ecran : la section
    // « courante » est celle qui occupe le regard, pas celle qui affleure.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(`#${entry.target.id}`)
        })
      },
      { rootMargin: "-45% 0px -50% 0px" }
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  // Le menu plein ecran ne doit pas laisser la page defiler derriere lui.
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  return (
    <motion.header
      initial={{ y: -72 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.7, ease: EASE }}
      className="fixed inset-x-0 top-0 z-50 h-16"
    >
      <div className="container mx-auto h-full px-4">
        <div
          className={`mx-auto flex items-center justify-between transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            scrolled
              ? "my-2 h-12 max-w-5xl rounded-full border border-dar-sand/80 bg-white/85 px-3 shadow-[0_12px_32px_-16px_rgba(18,33,43,0.35)] backdrop-blur-xl"
              : "h-16 max-w-[1400px] rounded-none border border-transparent bg-transparent px-0"
          }`}
        >
          {/* Marque */}
          <Link
            href="/"
            className={`group flex items-center gap-2.5 transition-all duration-500 ${
              scrolled ? "pl-2" : ""
            }`}
          >
            <span
              className={`arch flex items-end justify-center rounded-b-[3px] pb-1 transition-all duration-500 ${
                scrolled ? "h-7 w-6 bg-dar-ink" : "h-8 w-7 bg-white"
              }`}
            >
              <Building2
                className={`h-3.5 w-3.5 ${scrolled ? "text-white" : "text-dar-ink"}`}
              />
            </span>
            {/* Aqar porte le nom, DZ porte le pays : deux poids, une marque */}
            <span
              className={`font-display font-bold tracking-tight transition-all duration-500 ${
                scrolled ? "text-[17px] text-dar-ink" : "text-xl text-white"
              }`}
            >
              Aqar
              <span
                className={`ml-1 font-semibold ${
                  scrolled ? "text-dar-blue" : "text-dar-blue-light"
                }`}
              >
                DZ
              </span>
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => {
              const isActive = active === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-300 ${
                    isActive
                      ? scrolled
                        ? "text-dar-blue"
                        : "text-white"
                      : scrolled
                        ? "text-dar-ink/60 hover:text-dar-ink"
                        : "text-white/65 hover:text-white"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="landing-nav-pill"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      className={`absolute inset-0 rounded-full ${
                        scrolled ? "bg-dar-blue-soft" : "bg-white/12"
                      }`}
                    />
                  )}
                  <span className="relative z-10">{link.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Actions */}
          <div className="hidden items-center gap-1 md:flex">
            {/* Une agence deja inscrite doit pouvoir entrer depuis l'accueil */}
            <Link
              href="/auth/login"
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-300 ${
                scrolled
                  ? "text-dar-ink/60 hover:text-dar-ink"
                  : "text-white/65 hover:text-white"
              }`}
            >
              Se connecter
            </Link>
            <Button
              asChild
              className={`sheen group rounded-full transition-all duration-500 ${
                scrolled
                  ? "h-9 bg-dar-ink px-4 text-[13px] hover:bg-dar-blue"
                  : "h-10 bg-white px-5 text-sm text-dar-ink hover:bg-dar-blue-soft"
              }`}
            >
              <Link href="/auth/register">
                Inscrire mon agence
                <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </div>

          {/* Ouverture du menu mobile */}
          <button
            onClick={() => setIsOpen(true)}
            className={`rounded-full p-2 transition-colors md:hidden ${
              scrolled ? "text-dar-ink/70" : "text-white/80"
            }`}
            aria-label="Ouvrir le menu"
            aria-expanded={isOpen}
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/*
        Menu mobile en panneau plein ecran : sur un telephone, une liste
        deroulante coincee sous la barre donne des cibles serrees. Ici
        chaque entree fait la largeur du pouce.
      */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="limewash fixed inset-0 z-[70] flex flex-col md:hidden"
          >
            <div className="flex h-16 items-center justify-between px-6">
              <span className="font-display text-xl font-bold tracking-tight text-dar-ink">
                Aqar<span className="ml-1 font-semibold text-dar-blue">DZ</span>
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-dar-ink/70"
                aria-label="Fermer le menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <nav className="flex flex-1 flex-col justify-center gap-2 px-6 pb-24">
              {navLinks.map((link, index) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * index + 0.08, duration: 0.5, ease: EASE }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="block border-b border-dar-sand py-4 font-display text-3xl font-semibold tracking-tight text-dar-ink"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
            </nav>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.36, duration: 0.5, ease: EASE }}
              className="space-y-3 px-6 pb-10"
            >
              <Button asChild className="h-12 w-full rounded-full bg-dar-ink text-base hover:bg-dar-blue">
                <Link href="/auth/register" onClick={() => setIsOpen(false)}>
                  Inscrire mon agence
                </Link>
              </Button>
              <Link
                href="/auth/login"
                onClick={() => setIsOpen(false)}
                className="block py-2 text-center text-sm font-medium text-dar-ink/60"
              >
                Se connecter
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
