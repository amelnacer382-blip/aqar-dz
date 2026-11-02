"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Store,
} from "lucide-react"
import { AuthShell } from "@/components/layout/AuthShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { WILAYAS } from "@/lib/wilayas"
import type { AgencyPlan } from "@prisma/client"
import {
  CATALOGUE,
  PARAM_OFFRE,
  nomOffre,
  offre as offreDuCatalogueParCle,
  offreDuCatalogue,
  resumeOffre,
} from "@/lib/offres"

const selectClass =
  "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dar-blue/40"

/** Ce que l'agence obtient — chaque point correspond a un module livre. */
const PROMESSES = [
  {
    icon: Building2,
    title: "Votre portefeuille, structuré",
    text: "Biens, propriétaires, clients, visites, baux et loyers dans un seul outil, en dinars.",
  },
  {
    icon: Store,
    title: "Votre vitrine publique",
    text: "Une adresse à vous où vos clients consultent vos biens et vous écrivent directement.",
  },
  {
    icon: ShieldCheck,
    title: "Vos données cloisonnées",
    text: "Mots de passe hachés, accès par rôles, et aucune autre agence ne voit vos dossiers.",
  },
]

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  /**
   * L'offre demandee, preselectionnee depuis l'URL quand le visiteur
   * arrive par un bouton de la page tarifaire (FR-3).
   *
   * `null` au depart si le parametre est absent OU inconnu, et ce n'est
   * pas une erreur : on n'affiche rien, on ne signale rien. Le refus,
   * lui, vient a l'envoi, une fois que le visiteur a eu l'occasion de
   * choisir.
   *
   * L'initialisateur de `useState` ne s'execute qu'au premier rendu :
   * changer l'URL ensuite ne rejette pas le choix en cours, ce qui est
   * bien le comportement voulu (FR-4 : le choix reste modifiable).
   */
  const [offreDemandee, setOffreDemandee] = useState<AgencyPlan | null>(() =>
    offreDuCatalogue(searchParams.get(PARAM_OFFRE))
  )

  const [formData, setFormData] = useState({
    agencyName: "",
    email: "",
    phone: "",
    wilaya: "",
    address: "",
    password: "",
    confirmPassword: "",
  })

  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  // Regles verifiees en direct : le serveur les revalide de toute facon,
  // mais l'agence ne doit pas decouvrir la contrainte apres l'envoi.
  const longEnough = formData.password.length >= 6
  const matches =
    formData.confirmPassword.length > 0 &&
    formData.password === formData.confirmPassword

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    if (formData.password !== formData.confirmPassword) {
      setError("Les mots de passe ne correspondent pas")
      setIsLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères")
      setIsLoading(false)
      return
    }

    // Le serveur refuse de toute facon (`registerSchema`), et c'est lui qui
    // fait foi. Ce controle-ci evite seulement au visiteur de perdre sa
    // saisie pour un champ qu'il voit a l'ecran.
    if (!offreDemandee) {
      setError("Choisissez une offre pour continuer")
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencyName: formData.agencyName,
          email: formData.email,
          phone: formData.phone,
          wilaya: formData.wilaya,
          address: formData.address,
          password: formData.password,
          requestedPlan: offreDemandee,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Une erreur est survenue")
      }

      setSuccess(true)
      setTimeout(() => {
        router.push("/auth/login")
      }, 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue")
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="limewash flex min-h-screen items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-lg text-center"
        >
          <motion.span
            initial={{ scale: 0.7 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className="mx-auto mb-6 block w-fit"
          >
            <CheckCircle2 className="h-14 w-14 text-emerald-600" />
          </motion.span>

          <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">
            {formData.agencyName} est enregistrée
          </h1>
          <p className="mx-auto mt-4 max-w-md leading-relaxed text-dar-ink/65">
            Votre espace est créé. Il reste à être activé manuellement par
            l&apos;équipe Aqar DZ — nous vérifions chaque agence avant
            l&apos;ouverture.
          </p>

          {/*
            L'offre est NOMMEE, et dite sous reserve (FR-4). Sans cette
            phrase, le visiteur repart persuade d'avoir souscrit Pro : il a
            coche Pro, payé personne, et rien ne l'a detrompe. C'est
            l'editeur qui tranche a l'approbation (story 6.3).
          */}
          {offreDemandee && (
            <p className="mx-auto mt-6 max-w-md rounded-lg border border-dar-sand bg-dar-sand/30 px-4 py-3 text-sm leading-relaxed text-dar-ink/70">
              Offre demandée :{" "}
              <span className="font-semibold text-dar-ink">
                {nomOffre(offreDemandee)}
              </span>
              . Elle sera confirmée par notre équipe au moment de
              l&apos;activation — elle n&apos;est pas encore attribuée.
            </p>
          )}

          {/*
            Aucune promesse d'email : le logiciel n'en envoie pas. On indique
            le seul canal qui existe reellement — l'ecran de connexion, qui
            affiche l'etat du dossier.
          */}
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-dar-ink/50">
            Pour connaître l&apos;avancement, essayez de vous connecter : la
            page vous indiquera où en est votre dossier.
          </p>

          <Button asChild className="mt-8 h-11 rounded-full bg-dar-ink px-6 hover:bg-dar-blue">
            <Link href="/auth/login">Aller à la connexion</Link>
          </Button>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-dar-ink/35">
            Redirection automatique…
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <AuthShell
      wide
      panel={
        /*
          Le panneau ne montre plus un lieu mais ce qui est acquis en
          s'inscrivant : meme surface d'encre et meme trame que le heros du
          site, pour que l'inscription soit la suite de la page d'accueil.
        */
        <div className="relative h-full overflow-hidden">
          <div aria-hidden="true" className="tech-grid absolute inset-0" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-[15%] top-[12%] h-[30rem] w-[30rem] rounded-full bg-dar-blue/25 blur-[120px]"
          />

          <div className="relative flex h-full flex-col justify-center p-12 xl:p-16">
            <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.18em] text-dar-blue-light">
              Ce que vous obtenez
            </p>
            <h2 className="max-w-sm font-display text-[2.1rem] font-bold leading-[1.15] tracking-tight text-white">
              Toute votre agence, dès l&apos;activation.
            </h2>

            <ul className="mt-10 max-w-md space-y-7">
              {PROMESSES.map((item) => (
                <li key={item.title} className="flex items-start gap-4">
                  <span className="arch mt-0.5 flex h-9 w-8 shrink-0 items-end justify-center rounded-b-[3px] bg-white/10 pb-1.5">
                    <item.icon className="h-4 w-4 text-dar-blue-light" />
                  </span>
                  <div>
                    <p className="font-display text-[15px] font-semibold text-white">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-white/55">
                      {item.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-12 max-w-md border-t border-white/10 pt-6 text-sm leading-relaxed text-white/45">
              L&apos;inscription est gratuite. Votre agence est vérifiée puis
              activée manuellement par notre équipe avant l&apos;ouverture de
              l&apos;espace.
            </p>
          </div>
        </div>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">
          Inscrire mon agence
        </h1>
        <p className="mt-2.5 leading-relaxed text-dar-ink/60">
          Deux minutes. Votre espace est créé aussitôt, puis activé par notre
          équipe.
        </p>

        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-8">
          {/*
            Groupe 1 : l'offre.

            EN PREMIER, ET PAS EN DERNIER. Le visiteur qui arrive d'un
            bouton de la page tarifaire vient de choisir : il doit voir son
            choix repris, sinon il doute d'avoir cliqué la bonne colonne. Et
            celui qui arrive directement doit rencontrer la question avant
            d'avoir investi dix champs de saisie.
          */}
          <fieldset className="space-y-4" disabled={isLoading}>
            <legend className="w-full border-b border-dar-sand pb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-dar-blue">
              Votre offre
            </legend>

            <div
              role="radiogroup"
              aria-label="Offre demandée"
              className="grid grid-cols-1 gap-3 sm:grid-cols-3"
            >
              {CATALOGUE.map((item) => {
                const choisie = offreDemandee === item.cle

                return (
                  <label
                    key={item.cle}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      choisie
                        ? "border-dar-blue bg-dar-blue/5 ring-1 ring-dar-blue/40"
                        : "border-dar-sand hover:border-dar-blue/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name={PARAM_OFFRE}
                      value={item.cle}
                      checked={choisie}
                      onChange={() => setOffreDemandee(item.cle)}
                      className="sr-only"
                    />
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-[15px] font-semibold text-dar-ink">
                        {item.nom}
                      </span>
                      <span className="font-mono text-xs text-dar-ink/50">
                        {item.prix}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-dar-ink/55">
                      {resumeOffre(item.cle)}
                    </span>
                  </label>
                )
              })}
            </div>

            {/*
              CE QU'ELLE CONTIENT, pas seulement son nom (FR-4). Deplie
              seulement pour l'offre retenue : les trois listes cote a cote
              rendraient le formulaire illisible, et le visiteur a deja
              compare sur la page tarifaire.
            */}
            {offreDemandee && (
              <ul className="flex flex-wrap gap-x-5 gap-y-1.5 pt-1">
                {offreDuCatalogueParCle(offreDemandee).atouts.map((atout) => (
                  <li
                    key={atout}
                    className="flex items-center gap-1.5 text-xs text-dar-ink/60"
                  >
                    <Check className="h-3 w-3 text-dar-blue" />
                    {atout}
                  </li>
                ))}
              </ul>
            )}

            <p className="text-xs leading-relaxed text-dar-ink/45">
              Votre offre est confirmée par notre équipe lors de
              l&apos;activation. Aucun paiement n&apos;est demandé ici.
            </p>
          </fieldset>

          {/* Groupe 2 : l'agence */}
          <fieldset className="space-y-4" disabled={isLoading}>
            <legend className="w-full border-b border-dar-sand pb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-dar-blue">
              Votre agence
            </legend>

            <div className="space-y-2">
              <Label htmlFor="agencyName">Nom de l&apos;agence *</Label>
              <Input
                id="agencyName"
                name="agencyName"
                placeholder="Agence Horizon Immobilier"
                value={formData.agencyName}
                onChange={handleChange}
                required
                autoComplete="organization"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wilaya">Wilaya *</Label>
                {/*
                  Liste fermee : la wilaya sert de filtre sur la vitrine
                  publique, une saisie libre y creerait des doublons.
                */}
                <select
                  id="wilaya"
                  name="wilaya"
                  value={formData.wilaya}
                  onChange={handleChange}
                  required
                  className={selectClass}
                >
                  <option value="">Choisir…</option>
                  {WILAYAS.map((wilaya) => (
                    <option key={wilaya.code} value={wilaya.name}>
                      {wilaya.code} — {wilaya.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="05 55 12 34 56"
                  value={formData.phone}
                  onChange={handleChange}
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                name="address"
                placeholder="12 rue Didouche Mourad, Alger Centre"
                value={formData.address}
                onChange={handleChange}
                autoComplete="street-address"
              />
            </div>
          </fieldset>

          {/* Groupe 3 : le compte */}
          <fieldset className="space-y-4" disabled={isLoading}>
            <legend className="w-full border-b border-dar-sand pb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-dar-blue">
              Votre compte
            </legend>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="contact@votre-agence.dz"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
              <p className="text-xs text-dar-ink/45">
                Cet email sera votre identifiant de connexion.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dar-ink/40 transition-colors hover:text-dar-ink"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmation *</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            {/* Les deux regles, verifiees pendant la saisie */}
            <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
              <Rule ok={longEnough} label="6 caractères minimum" />
              <Rule ok={matches} label="Les deux saisies correspondent" />
            </ul>
          </fieldset>

          <Button
            type="submit"
            className="sheen group h-12 w-full rounded-full bg-dar-ink text-base hover:bg-dar-blue"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création du compte…
              </>
            ) : (
              <>
                Créer mon compte
                <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </>
            )}
          </Button>

          <p className="text-center text-sm text-dar-ink/60">
            Déjà inscrit ?{" "}
            <Link
              href="/auth/login"
              className="font-medium text-dar-blue underline-offset-4 hover:underline"
            >
              Se connecter
            </Link>
          </p>
        </form>
      </motion.div>
    </AuthShell>
  )
}

/**
 * `useSearchParams()` impose une frontiere Suspense, sinon le rendu
 * statique de la page bascule cote client et le `build` echoue. Meme
 * decoupage qu'a la connexion, meme raison.
 */
export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="limewash flex min-h-screen items-center justify-center px-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-dar-ink border-t-transparent" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  )
}

/** Une regle de mot de passe, satisfaite ou non. */
function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li
      className={`flex items-center gap-1.5 text-xs transition-colors duration-300 ${
        ok ? "text-emerald-700" : "text-dar-ink/40"
      }`}
    >
      {/* Pas de coche tant que la regle n'est pas remplie : une coche grise
          se lit comme « c'est fait », et induit en erreur. */}
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full transition-colors duration-300 ${
          ok ? "bg-emerald-100" : "bg-dar-sand"
        }`}
      >
        {ok ? (
          <Check className="h-2.5 w-2.5" />
        ) : (
          <span className="h-1 w-1 rounded-full bg-dar-ink/30" />
        )}
      </span>
      {label}
    </li>
  )
}
