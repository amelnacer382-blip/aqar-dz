import { LandingNavbar } from "@/components/layout/LandingNavbar"
import { ScrollProgress } from "@/components/motion/ScrollProgress"
import { HeroSection } from "@/components/landing/HeroSection"
import { WilayaBand } from "@/components/landing/WilayaBand"
import { FeaturesSection } from "@/components/landing/FeaturesSection"
import { PricingSection } from "@/components/landing/PricingSection"
import { ContactSection } from "@/components/landing/ContactSection"
import { Footer } from "@/components/landing/Footer"

export default function Home() {
  return (
    <>
      <ScrollProgress />
      <LandingNavbar />
      {/*
        Pas de marge haute ici : le heros passe SOUS la barre fixe et
        reserve lui-meme la hauteur. Avec une marge sur <main>, la barre
        flottait au-dessus d'une bande blanche de body et son texte clair
        devenait invisible.
      */}
      <main>
        <HeroSection />
        <WilayaBand />
        <FeaturesSection />
        <PricingSection />
        <ContactSection />
        <Footer />
      </main>
    </>
  )
}
