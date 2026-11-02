"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  const getErrorMessage = (errorCode: string | null) => {
    switch (errorCode) {
      case "CredentialsSignin":
        return "Email ou mot de passe incorrect. Veuillez réessayer."
      case "AgencyPending":
        return "Votre agence n'est pas encore activée par un administrateur Aqar DZ. Vous recevrez un message dès l'activation."
      case "AgencySuspended":
        return "L'accès de votre agence a été suspendu. Contactez l'équipe Aqar DZ."
      case "AccessDenied":
        return "Accès refusé. Vous n'avez pas les permissions nécessaires."
      case "OAuthAccountNotLinked":
        return "Cet email est déjà associé à un autre compte."
      default:
        return "Une erreur d'authentification est survenue. Veuillez réessayer."
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card>
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-12 w-12 text-red-500" />
            </div>
            <CardTitle className="text-2xl">Erreur d&apos;authentification</CardTitle>
            <CardDescription>{getErrorMessage(error)}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button asChild className="w-full bg-slate-900 hover:bg-slate-800">
              <Link href="/auth/login">Retour à la connexion</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Retour à l&apos;accueil</Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

export default function ErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4">
        <div className="w-full max-w-md text-center">
          <div className="animate-spin h-8 w-8 border-4 border-slate-900 border-t-transparent rounded-full mx-auto" />
        </div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}
