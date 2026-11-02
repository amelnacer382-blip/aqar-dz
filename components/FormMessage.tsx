import { AlertCircle, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

/**
 * Affiche le retour d'une Server Action.
 *
 * Les actions redirigent vers `?error=...` ou `?success=...` : ce composant
 * lit ces parametres et rend le message. Cela permet de garder les
 * formulaires en Server Components (pas de "use client" ni de state client)
 * tout en donnant un vrai retour a l'utilisateur.
 */
export function FormMessage({
  error,
  success,
}: {
  error?: string
  success?: string
}) {
  if (!error && !success) return null

  if (error) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert className="mb-6 border-green-200 bg-green-50 text-green-900">
      <CheckCircle2 className="h-4 w-4 !text-green-600" />
      <AlertDescription>{success}</AlertDescription>
    </Alert>
  )
}
