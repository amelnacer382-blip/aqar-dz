"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { explainLoginFailure } from "./actions"
import { motion } from "framer-motion"
import { AuthShell } from "@/components/layout/AuthShell"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/agency"
  const error = searchParams.get("error")
  const success = searchParams.get("success")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loginError, setLoginError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setLoginError("")

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        // NextAuth ne renvoie qu'un echec generique : on demande au serveur
        // la raison precise (agence non activee, compte suspendu...).
        setLoginError(await explainLoginFailure(email, password))
      } else {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch {
      setLoginError("Une erreur est survenue")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell quote="Toute votre agence, dans une seule cour.">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="border-dar-sand shadow-card">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Connexion</CardTitle>
            <CardDescription className="text-center">
              Connectez-vous à votre espace agence
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success && (
              <Alert className="mb-4 border-emerald-200 bg-emerald-50 text-emerald-900">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {(error || loginError) && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>
                  {loginError || error || "Une erreur d'authentification est survenue"}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Link
                    href="/auth/forgot"
                    className="text-xs font-medium text-dar-blue underline-offset-4 hover:underline"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-dar-ink hover:bg-dar-blue"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  "Se connecter"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <div className="text-center text-sm text-dar-ink/65">
              Pas encore de compte ?{" "}
              <Link href="/auth/register" className="font-medium text-dar-blue hover:underline">
                Inscrire mon agence
              </Link>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="limewash flex min-h-screen items-center justify-center px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-dar-ink border-t-transparent" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
