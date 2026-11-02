"use client"

import { motion } from "framer-motion"
import { EASE, Reveal, Stagger, StaggerItem } from "@/components/motion/primitives"
import {
  Building2,
  Users,
  CalendarDays,
  FileText,
  CreditCard,
  BarChart3,
  Shield,
  Globe,
} from "lucide-react"

const features = [
  {
    icon: Building2,
    title: "Gestion des biens",
    description:
      "Gérez votre portefeuille immobilier complet : appartements, villas, terrains, locaux commerciaux. Suivez le statut de chaque bien en temps réel.",
  },
  {
    icon: Users,
    title: "Clients & Propriétaires",
    description:
      "Centralisez vos contacts, suivez l'historique des interactions et gérez les relations avec vos clients et propriétaires.",
  },
  {
    icon: CalendarDays,
    title: "Visites organisées",
    description:
      "Planifiez vos visites, saisissez un retour structuré après chaque passage (niveau d'intérêt, note, avis sur le prix) et gardez sous les yeux vos relances à faire.",
  },
  {
    icon: FileText,
    title: "Documents & Contrats",
    description:
      "Générez des contrats de vente et de location, des reçus et des rapports personnalisés au format PDF.",
  },
  {
    icon: CreditCard,
    title: "Paiements & Commissions",
    description:
      "Suivez les loyers, cautions, commissions et frais de dossier. Gérez les paiements propriétaires et les abonnements.",
  },
  {
    icon: BarChart3,
    title: "Statistiques & Rapports",
    description:
      "Tableaux de bord détaillés avec graphiques et analyses pour piloter votre activité et prendre les bonnes décisions.",
  },
  {
    icon: Shield,
    title: "Sécurité & Confidentialité",
    description:
      "Mots de passe hachés, contrôle d'accès par rôles et cloisonnement strict des données : chaque agence ne voit que les siennes.",
  },
  {
    icon: Globe,
    title: "Vitrine en ligne",
    description:
      "Exposez vos biens sur une vitrine publique personnalisée. Vos clients peuvent consulter et vous contacter directement.",
  },
]

/**
 * Troisieme section : les huit domaines du logiciel.
 *
 * Le mur est blanc et pique d'une trame pointillee ; les huit domaines sont
 * poses dessus comme des tuiles de badigeon. Au survol, la tuile se
 * detache du mur — elle blanchit, se souleve et son arche se remplit. Le
 * fond n'est donc pas un decor : c'est le mur qui rend la tuile lisible.
 */
export function FeaturesSection() {
  return (
    <section id="features" className="relative overflow-hidden bg-white py-24">
      {/* Le mur : grain pointille et deux lavis presque invisibles */}
      <div aria-hidden="true" className="dot-grid absolute inset-0" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[6%] top-[-12%] h-[32rem] w-[32rem] rounded-full bg-dar-blue/[0.06] blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[8%] bottom-[-14%] h-[26rem] w-[26rem] rounded-full bg-dar-ochre/[0.07] blur-[120px]"
      />

      <div className="container relative z-10 mx-auto px-4">
        <div className="mb-14 max-w-3xl">
          <Reveal>
            <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.18em] text-dar-blue">
              Fonctionnalités
            </p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-dar-ink md:text-[2.6rem] md:leading-[1.1]">
              Ce que le logiciel fait, et le fait vraiment
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-dar-ink/65">
              Huit domaines, du premier appel d&apos;un client jusqu&apos;au
              reversement du loyer au propriétaire.
            </p>
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
              className="zellige-rule mt-8 w-24 origin-left"
            />
          </Reveal>
        </div>

        <Stagger
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          amount={0.1}
        >
          {features.map((feature) => (
            <StaggerItem key={feature.title} className="h-full">
              <article className="group h-full rounded-2xl border border-dar-sand bg-dar-lime p-6 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 hover:border-dar-blue/25 hover:bg-white hover:shadow-[0_24px_48px_-30px_rgba(18,33,43,0.45)]">
                {/* L'icone est logee dans une arche : le motif se repete a
                    toutes les echelles du produit. Au survol, l'arche se
                    remplit par le bas, comme le reste du mouvement du site. */}
                <div className="arch relative mb-6 h-12 w-11 overflow-hidden rounded-b-md bg-dar-blue-soft">
                  <span className="absolute inset-0 origin-bottom scale-y-0 bg-dar-blue transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-y-100" />
                  <feature.icon className="absolute bottom-2.5 left-1/2 h-5 w-5 -translate-x-1/2 text-dar-blue transition-colors duration-300 group-hover:text-white" />
                </div>

                <h3 className="font-display text-[17px] font-semibold leading-snug text-dar-ink">
                  {feature.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-dar-ink/60">
                  {feature.description}
                </p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
