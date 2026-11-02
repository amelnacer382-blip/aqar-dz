"use client"

import Link from "next/link"
import { useRef } from "react"
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion"
import { ArrowRight, MoveDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CountUp, MaskLine } from "@/components/motion/primitives"
import { AppPreview } from "@/components/landing/AppPreview"

/**
 * Le heros ouvre sur le logiciel lui-meme.
 *
 * Le sujet de cette page n'est pas un lieu, c'est un outil de travail : ce
 * sont donc ses ecrans qui doivent apparaitre en premier. Le fond est la
 * surface sombre d'un tableau de bord, quadrillee comme une feuille de
 * calcul, avec une seule source de lumiere derriere le panneau — ce qui
 * brille sur cette page, c'est le produit.
 *
 * A l'arrivee, une seule sequence : les lignes du titre montent sous leur
 * masque pendant que le panneau se pose, puis le logiciel se remplit sous
 * les yeux (indicateurs, encaissements, portefeuille, quittance).
 */
export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  })

  const previewY = useTransform(scrollYProgress, [0, 1], [0, -70])
  const textY = useTransform(scrollYProgress, [0, 1], [0, 60])
  const textFade = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  return (
    <section
      ref={sectionRef}
      /* pt-16 : la hauteur de la barre fixe, reservee par le heros lui-meme */
      className="relative overflow-hidden bg-dar-ink pt-16"
    >
      {/* Quadrillage de tableau de bord, efface vers les bords */}
      <div aria-hidden="true" className="tech-grid absolute inset-0" />

      {/* Une seule source de lumiere, derriere le panneau du logiciel */}
      <motion.div
        aria-hidden="true"
        animate={reduce ? undefined : { opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute right-[-10%] top-[8%] h-[38rem] w-[38rem] rounded-full bg-dar-blue/25 blur-[130px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-10%] left-[-8%] h-[26rem] w-[26rem] rounded-full bg-dar-ochre/10 blur-[120px]"
      />

      <div className="container relative z-10 mx-auto px-4">
        <div className="grid min-h-[calc(100vh-4rem)] items-center gap-14 py-16 lg:grid-cols-[0.92fr_1.08fr] lg:py-20">
          {/* Colonne texte */}
          <motion.div style={reduce ? undefined : { y: textY, opacity: textFade }}>
            {/*
              LES ENTREES DE CE PREMIER ECRAN SONT EN CSS (story 3.14).

              Elles etaient ecrites en Framer. Or Framer inscrit les valeurs
              de `initial` DANS LE STYLE RENDU PAR LE SERVEUR : cette page
              etait livree avec 34 elements a `opacity: 0` et n'apparaissait
              qu'une fois le script execute. Lighthouse mobile bride le
              disait sans ambiguite — LCP 3,459 s pour un TTI de 3,459 s, la
              meme milliseconde (REP-107).

              La choregraphie est INCHANGEE : memes delais, memes durees,
              meme courbe. Seul le moteur change, et avec lui le moment ou
              elle peut commencer — au premier rendu, sans attendre le
              JavaScript. Le reste de la page garde Framer, y compris la
              parallaxe de ce bloc juste au-dessus.
            */}
            <div
              style={{ animationDelay: "0.05s", animationDuration: "0.7s" }}
              className="entree mb-7 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm text-white/75 backdrop-blur-sm"
            >
              {/* Le point dit que le service tourne — c'est une information */}
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Conçu en Algérie, pour les agences algériennes
            </div>

            <h1 className="font-display text-[2.6rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-white sm:text-[3.4rem] lg:text-[3.9rem]">
              <MaskLine delay={0.14}>Le logiciel qui</MaskLine>
              <MaskLine delay={0.26}>tient votre agence</MaskLine>
              <MaskLine delay={0.38} className="text-dar-blue-light">
                de bout en bout.
              </MaskLine>
            </h1>

            {/* C'est CE paragraphe que la mesure a designe comme l'element LCP. */}
            <p
              style={{ animationDelay: "0.6s" }}
              className="entree mt-7 max-w-lg text-lg leading-relaxed text-white/65"
            >
              Biens, propriétaires, clients, visites, baux, loyers et
              quittances&nbsp;: un seul outil, en dinars. Et une vitrine
              publique où vos clients consultent vos biens et vous écrivent.
            </p>

            <div
              style={{ animationDelay: "0.72s" }}
              className="entree mt-9 flex flex-wrap items-center gap-3"
            >
              <Button
                asChild
                size="lg"
                className="sheen group h-12 bg-white px-7 text-base text-dar-ink hover:bg-dar-blue-soft"
              >
                <Link href="/auth/register">
                  Inscrire mon agence
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 border-white/20 bg-white/5 px-7 text-base text-white backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white"
              >
                <Link href="/vitrine/agence-demo">Voir une vitrine</Link>
              </Button>
            </div>

            {/* Ce que le logiciel couvre reellement — pas des promesses */}
            <dl
              style={{ animationDelay: "0.88s" }}
              className="entree mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-7"
            >
              <div>
                <dt className="font-display text-2xl font-bold text-white">
                  <CountUp value={12} />
                </dt>
                <dd className="mt-1 text-sm leading-snug text-white/45">
                  modules métier
                </dd>
              </div>
              <div>
                <dt className="font-display text-2xl font-bold text-white">
                  <CountUp value={33} />
                </dt>
                <dd className="mt-1 text-sm leading-snug text-white/45">
                  types de biens
                </dd>
              </div>
              <div>
                <dt className="font-display text-2xl font-bold text-white">DZD</dt>
                <dd className="mt-1 text-sm leading-snug text-white/45">
                  devise native
                </dd>
              </div>
            </dl>
          </motion.div>

          {/* Colonne produit */}
          <motion.div style={reduce ? undefined : { y: previewY }}>
            <AppPreview />
          </motion.div>
        </div>
      </div>

      {/* Invite a defiler : elle s'efface des que la page bouge */}
      <motion.div
        aria-hidden="true"
        style={reduce ? undefined : { opacity: textFade }}
        className="pointer-events-none absolute inset-x-0 bottom-6 hidden justify-center lg:flex"
      >
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.6, duration: 0.8 }}
          className="flex flex-col items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30"
        >
          Défiler
          <motion.span
            animate={{ y: [0, 7, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <MoveDown className="h-3.5 w-3.5" />
          </motion.span>
        </motion.span>
      </motion.div>
    </section>
  )
}
