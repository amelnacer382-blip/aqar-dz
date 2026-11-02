"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { EASE, Reveal, Stagger, StaggerItem } from "@/components/motion/primitives"
import { Mail, MapPin, Phone, Send, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"

export function ContactSection() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    
    // Simulation d'envoi
    await new Promise((resolve) => setTimeout(resolve, 1500))
    
    setIsLoading(false)
    setIsSent(true)
  }

  return (
    <section id="contact" className="limewash py-24">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Reveal>
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-dar-ink mb-4">
              Contactez-nous
            </h2>
            <p className="text-lg text-dar-ink/65">
              Une question ? Besoin d&apos;aide ? Notre équipe est là pour vous accompagner.
            </p>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
          <Stagger className="space-y-6" amount={0.2}>
            {[
              {
                icon: Mail,
                title: "Email",
                lines: ["contact@aqar-dz.com"],
              },
              {
                icon: Phone,
                title: "Téléphone",
                lines: ["+213 555 123 456"],
              },
              {
                icon: MapPin,
                title: "Adresse",
                lines: ["123 Rue Didouche Mourad, Alger Centre", "Alger, Algérie"],
              },
            ].map((item) => (
              <StaggerItem key={item.title}>
                {/*
                  Ces cartes ne sont pas cliquables : ni elevation ni
                  remplissage au survol, qui promettraient une action.
                */}
                <Card>
                  <CardContent className="p-6 flex items-start gap-4">
                    {/* Meme arche que partout ailleurs, a l'echelle d'une icone */}
                    <div className="arch relative h-10 w-10 shrink-0 rounded-b-md bg-dar-blue-soft">
                      <item.icon className="absolute bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 text-dar-blue" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-dar-ink mb-1">{item.title}</h3>
                      <p className="text-dar-ink/65">
                        {item.lines.map((line, i) => (
                          <span key={line}>
                            {i > 0 && <br />}
                            {line}
                          </span>
                        ))}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal delay={0.1}>
            <Card>
              <CardContent className="p-6">
                {isSent ? (
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: EASE }}
                    className="text-center py-8"
                  >
                    <motion.span
                      initial={{ scale: 0.7 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 320, damping: 18 }}
                      className="mx-auto mb-4 block w-fit"
                    >
                      <CheckCircle2 className="h-12 w-12 text-green-600" />
                    </motion.span>
                    <h3 className="font-display text-lg font-semibold text-dar-ink mb-2">
                      Message envoyé
                    </h3>
                    <p className="text-dar-ink/65">Nous vous répondrons dans les plus brefs délais.</p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">Prénom</Label>
                        <Input id="firstName" placeholder="Votre prénom" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Nom</Label>
                        <Input id="lastName" placeholder="Votre nom" required />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contactEmail">Email</Label>
                      <Input id="contactEmail" type="email" placeholder="votre@email.com" required />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject">Sujet</Label>
                      <Input id="subject" placeholder="Sujet de votre message" required />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        placeholder="Votre message..."
                        rows={5}
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      className="sheen w-full bg-dar-ink hover:bg-dar-blue"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Envoi...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Envoyer
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
