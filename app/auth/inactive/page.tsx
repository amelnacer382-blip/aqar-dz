import type { Metadata } from "next"
import Link from "next/link"
import { Building2, Clock, Ban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = { title: "Compte en attente" }

export default async function InactiveAgencyPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const isSuspended = status === "suspended"

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center">
            {isSuspended ? (
              <Ban className="h-7 w-7 text-red-500" />
            ) : (
              <Clock className="h-7 w-7 text-yellow-600" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isSuspended ? "Compte suspendu" : "Compte en attente d'activation"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-slate-600">
            {isSuspended ? (
              <>
                L&apos;acces de votre agence a ete suspendu. Contactez
                l&apos;equipe Aqar DZ pour retablir votre acces.
              </>
            ) : (
              <>
                Votre inscription a bien ete enregistree. Un administrateur
                Aqar DZ doit activer votre agence avant que vous puissiez
                acceder a votre espace. Vous serez prevenu des l&apos;activation.
              </>
            )}
          </p>

          <div className="rounded-lg bg-slate-100 p-4 text-sm text-slate-600">
            <p className="flex items-center justify-center gap-2 font-medium text-slate-900">
              <Building2 className="h-4 w-4" />
              Besoin d&apos;aide ?
            </p>
            <p className="mt-1">contact@aqar.dz</p>
          </div>

          <Button asChild variant="outline" className="w-full">
            <Link href="/auth/login">Retour a la connexion</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
