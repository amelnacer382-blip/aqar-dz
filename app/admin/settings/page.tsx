import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireSuperAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AdminNavbar } from "@/components/layout/AdminNavbar"
import { FormMessage } from "@/components/FormMessage"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ShieldCheck, ShieldOff, Store, StoreIcon } from "lucide-react"
import { formatDate } from "@/lib/format"
import { AGENCY_STATUS_LABELS, AGENCY_STATUS_COLORS, label } from "@/lib/labels"
import { parseForm, withError, withSuccess } from "@/lib/form"
import { agencyPlanSchema } from "@/lib/validations"
import { CATALOGUE, nomOffre, nomOffreDemandee } from "@/lib/offres"
import { recordAudit } from "@/lib/audit"

const BASE = "/admin/settings"

export const metadata: Metadata = { title: "Paramètres plateforme" }

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const { userName } = await requireSuperAdmin()
  const params = await searchParams

  const [agencies, stats] = await Promise.all([
    prisma.agency.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        requestedPlan: true,
        status: true,
        showcaseEnabled: true,
        createdAt: true,
      },
    }),
    prisma.agency.groupBy({ by: ["plan"], _count: true }),
  ])

  /**
   * Change l'offre d'abonnement d'une agence.
   *
   * L'entree passe par `parseForm` : elle arrivait jusqu'ici en
   * `formData.get("plan") as string`, compare a une liste ecrite en dur
   * (`["basic", "premium"]`) qui ne portait aucun des noms vendus sur la
   * page tarifaire. La liste acceptee vient desormais de l'enumeration
   * Prisma, donc du catalogue.
   *
   * LES TROIS OFFRES SONT PROPOSEES depuis la story 6.3. C'etait une
   * bascule entre deux, et `enterprise` — qui existe en base et se vend
   * publiquement — n'etait attribuable par aucun ecran. Le tarif ne se
   * recopie pas ici : AC-1 de la story 6.1 exige qu'un seul fichier le
   * porte, commentaires compris, sinon il se perime sans que rien
   * n'echoue.
   *
   * Cet ecran sert le changement A FROID, sur une agence deja active.
   * L'attribution INITIALE, elle, se fait dans le geste d'approbation
   * (`/admin/agencies`) : deux moments distincts, deux ecrans distincts,
   * une seule action de chaque cote.
   */
  async function setPlan(formData: FormData) {
    "use server"
    const admin = await requireSuperAdmin()

    const parsed = parseForm(agencyPlanSchema, formData)

    if (!parsed.ok) {
      redirect(withError(BASE, parsed.message))
    }

    const { agencyId, plan } = parsed.data

    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: { id: true, name: true, plan: true, requestedPlan: true },
    })

    if (!agency) {
      redirect(withError(BASE, "Agence introuvable"))
    }

    // RIEN A FAIRE N'EST PAS UN SUCCES A ANNONCER. Reecrire la meme valeur
    // et journaliser un changement qui n'a pas eu lieu remplirait le
    // journal de lignes qui ne disent rien — et c'est ce journal qu'on
    // lira le jour ou une agence conteste son offre.
    if (agency.plan === plan) {
      redirect(withSuccess(BASE, `Offre inchangée : ${nomOffre(plan)}`))
    }

    await prisma.agency.update({ where: { id: agencyId }, data: { plan } })

    await recordAudit({
      agencyId,
      userId: admin.userId,
      userName: admin.userName,
      action: "changement_statut",
      entity: "offre",
      entityId: agencyId,
      summary: `${agency.name} : offre ${nomOffre(agency.plan)} → ${nomOffre(plan)} (demandée : ${nomOffreDemandee(agency.requestedPlan)})`,
    })

    revalidatePath(BASE)
    redirect(withSuccess(BASE, `Offre mise à jour : ${nomOffre(plan)}`))
  }

  /** Coupe ou retablit la vitrine publique d'une agence. */
  async function toggleShowcase(formData: FormData) {
    "use server"
    await requireSuperAdmin()

    const agencyId = formData.get("agencyId") as string

    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: { id: true, showcaseEnabled: true },
    })

    if (!agency) {
      redirect(`${BASE}?error=${encodeURIComponent("Agence introuvable")}`)
    }

    await prisma.agency.update({
      where: { id: agencyId },
      data: { showcaseEnabled: !agency.showcaseEnabled },
    })

    revalidatePath(BASE)
    redirect(`${BASE}?success=${encodeURIComponent("Vitrine mise à jour")}`)
  }

  return (
    <>
      <AdminNavbar userName={userName} />
      <main className="pt-16 min-h-screen bg-slate-950">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold tracking-tight text-white">Paramètres plateforme</h1>
            <p className="text-slate-400 mt-1">
              Offres d&apos;abonnement et visibilité des vitrines
            </p>
          </div>

          <FormMessage error={params.error} success={params.success} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {stats.map((stat) => (
              <Card key={stat.plan} className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">
                    Offre {nomOffre(stat.plan)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stat._count}</div>
                  <p className="text-xs text-slate-500">
                    agence{stat._count > 1 ? "s" : ""}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">
                Configuration des agences ({agencies.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800">
                      <TableHead className="text-slate-400">Agence</TableHead>
                      <TableHead className="text-slate-400">Statut</TableHead>
                      <TableHead className="text-slate-400">Offre</TableHead>
                      <TableHead className="text-slate-400">Vitrine</TableHead>
                      <TableHead className="text-slate-400">Inscription</TableHead>
                      <TableHead className="text-slate-400 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agencies.map((agency) => (
                      <TableRow key={agency.id} className="border-slate-800">
                        <TableCell>
                          <p className="font-medium text-white">{agency.name}</p>
                          {agency.slug && (
                            <p className="text-xs text-slate-500">/vitrine/{agency.slug}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={AGENCY_STATUS_COLORS[agency.status] ?? ""}>
                            {label(AGENCY_STATUS_LABELS, agency.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {nomOffre(agency.plan)}
                        </TableCell>
                        <TableCell>
                          {agency.showcaseEnabled ? (
                            <span className="flex items-center gap-1.5 text-sm text-green-400">
                              <Store className="h-4 w-4" />
                              Publiée
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-sm text-slate-500">
                              <StoreIcon className="h-4 w-4" />
                              Masquée
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {formatDate(agency.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            {/* Les TROIS offres, pas une bascule entre
                                deux : une bascule ne peut pas exprimer un
                                catalogue de trois, et laissait Enterprise
                                hors d'atteinte. */}
                            <form
                              action={setPlan}
                              className="flex items-center gap-1"
                            >
                              <input type="hidden" name="agencyId" value={agency.id} />
                              <select
                                name="plan"
                                defaultValue={agency.plan}
                                aria-label={`Offre de ${agency.name}`}
                                className="h-8 rounded-md border border-slate-700 bg-slate-950 px-1.5 text-xs text-white"
                              >
                                {CATALOGUE.map((offre) => (
                                  <option key={offre.cle} value={offre.cle}>
                                    {offre.nom}
                                  </option>
                                ))}
                              </select>
                              <Button
                                type="submit"
                                size="sm"
                                variant="ghost"
                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                              >
                                Attribuer
                              </Button>
                            </form>
                            <form action={toggleShowcase}>
                              <input type="hidden" name="agencyId" value={agency.id} />
                              <Button
                                type="submit"
                                size="sm"
                                variant="ghost"
                                title={
                                  agency.showcaseEnabled
                                    ? "Masquer la vitrine"
                                    : "Publier la vitrine"
                                }
                                className="text-slate-400 hover:text-white hover:bg-slate-800"
                              >
                                {agency.showcaseEnabled ? (
                                  <ShieldOff className="h-4 w-4" />
                                ) : (
                                  <ShieldCheck className="h-4 w-4" />
                                )}
                              </Button>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
