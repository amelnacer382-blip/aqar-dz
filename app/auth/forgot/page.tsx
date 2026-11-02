"use client"

import Link from "next/link"
import { useFormState, useFormStatus } from "react-dom"
import { ArrowLeft, Loader2, MailCheck, AlertTriangle } from "lucide-react"
import { AuthShell } from "@/components/layout/AuthShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requestPasswordReset, type ForgotResult } from "./actions"

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={pending}
      className="sheen h-12 w-full rounded-full bg-dar-ink text-base hover:bg-dar-blue"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Envoi du lien…
        </>
      ) : (
        "Envoyer le lien"
      )}
    </Button>
  )
}

export default function ForgotPasswordPage() {
  const [state, formAction] = useFormState<ForgotResult | null, FormData>(
    requestPasswordReset,
    null
  )

  return (
    <AuthShell
      quote="Un mot de passe perdu ne doit pas fermer une agence."
      caption="Maisons de la Casbah, Alger"
    >
      <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">
        Mot de passe oublié
      </h1>
      <p className="mt-2.5 leading-relaxed text-dar-ink/60">
        Indiquez l&apos;adresse de votre compte. Nous vous envoyons un lien pour
        en choisir un nouveau.
      </p>

      {state ? (
        <div className="mt-8">
          <div className="flex items-start gap-3 rounded-xl border border-dar-sand bg-white p-5">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm leading-relaxed text-dar-ink/75">
              {state.message}
            </p>
          </div>

          {/*
            Si la messagerie n'est pas configuree sur ce serveur, l'email ne
            partira jamais. Le dire est plus honnete que laisser l'agence
            attendre un message qui n'existe pas.
          */}
          {state.mailerMissing && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <p className="text-sm leading-relaxed text-amber-900">
                L&apos;envoi d&apos;emails n&apos;est pas configuré sur ce
                serveur : le lien n&apos;a pas pu partir. Contactez
                l&apos;administrateur de la plateforme, qui peut réinitialiser
                votre mot de passe depuis son espace.
              </p>
            </div>
          )}

          <Button asChild variant="ghost" className="mt-6 text-dar-ink/60">
            <Link href="/auth/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à la connexion
            </Link>
          </Button>
        </div>
      ) : (
        <form action={formAction} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email du compte</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="contact@votre-agence.dz"
              required
              autoComplete="email"
            />
          </div>

          <SubmitButton />

          <p className="text-center text-sm text-dar-ink/60">
            <Link
              href="/auth/login"
              className="font-medium text-dar-blue underline-offset-4 hover:underline"
            >
              Retour à la connexion
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  )
}
