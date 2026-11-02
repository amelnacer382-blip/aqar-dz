import Link from "next/link"
import { redirect } from "next/navigation"
import { hash } from "bcryptjs"
import { AlertTriangle } from "lucide-react"
import { AuthShell } from "@/components/layout/AuthShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FormMessage } from "@/components/FormMessage"
import { prisma } from "@/lib/prisma"
import { consumeToken, findValidToken } from "@/lib/password-reset"
import { recordAudit } from "@/lib/audit"

/**
 * Choix d'un nouveau mot de passe a partir d'un lien recu par email.
 *
 * Le jeton est verifie deux fois : a l'affichage, pour ne pas presenter un
 * formulaire inutile, et a l'enregistrement, parce qu'un lien peut expirer
 * ou etre consomme entre les deux.
 */
export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { token } = await params
  const query = await searchParams

  const record = await findValidToken(token)

  async function updatePassword(formData: FormData) {
    "use server"
    const { token } = await params

    const password = String(formData.get("password") ?? "")
    const confirm = String(formData.get("confirmPassword") ?? "")

    if (password.length < 6) {
      redirect(
        `/auth/reset/${token}?error=${encodeURIComponent("Le mot de passe doit contenir au moins 6 caractères")}`
      )
    }

    if (password !== confirm) {
      redirect(
        `/auth/reset/${token}?error=${encodeURIComponent("Les deux mots de passe ne correspondent pas")}`
      )
    }

    // Revalidation : le lien a pu expirer pendant la saisie.
    const valid = await findValidToken(token)

    if (!valid) {
      redirect(
        `/auth/login?error=${encodeURIComponent("Ce lien de réinitialisation n'est plus valable")}`
      )
    }

    await prisma.user.update({
      where: { id: valid.userId },
      data: { password: await hash(password, 12) },
    })

    await consumeToken(valid.id)

    await recordAudit({
      userId: valid.userId,
      userName: valid.user.email,
      action: "reinitialisation_mot_de_passe",
      entity: "compte",
      entityId: valid.userId,
      summary: `Mot de passe réinitialisé par lien pour ${valid.user.email}`,
    })

    redirect(
      `/auth/login?success=${encodeURIComponent("Mot de passe modifié. Vous pouvez vous connecter.")}`
    )
  }

  if (!record) {
    return (
      <AuthShell quote="Un lien de réinitialisation ne vit qu'une heure.">
        <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">
          Lien expiré
        </h1>

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm leading-relaxed text-amber-900">
            Ce lien a expiré, a déjà servi, ou n&apos;est pas valable. Les liens
            de réinitialisation ne fonctionnent qu&apos;une heure et une seule
            fois.
          </p>
        </div>

        <Button
          asChild
          className="mt-7 h-12 w-full rounded-full bg-dar-ink text-base hover:bg-dar-blue"
        >
          <Link href="/auth/forgot">Demander un nouveau lien</Link>
        </Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell quote="Un mot de passe perdu ne doit pas fermer une agence.">
      <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">
        Nouveau mot de passe
      </h1>
      <p className="mt-2.5 leading-relaxed text-dar-ink/60">
        Pour le compte <strong className="text-dar-ink">{record.user.email}</strong>.
      </p>

      <FormMessage error={query.error} />

      <form action={updatePassword} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe *</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            minLength={6}
            autoComplete="new-password"
          />
          <p className="text-xs text-dar-ink/45">6 caractères minimum.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmation *</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="••••••••"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        <Button
          type="submit"
          className="sheen h-12 w-full rounded-full bg-dar-ink text-base hover:bg-dar-blue"
        >
          Enregistrer et se connecter
        </Button>
      </form>
    </AuthShell>
  )
}
