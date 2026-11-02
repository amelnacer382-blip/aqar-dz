import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireSuperAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AdminNavbar } from "@/components/layout/AdminNavbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Building2,
  CheckCircle,
  XCircle,
  PauseCircle,
  CalendarCheck,
} from "lucide-react"
import { FormMessage } from "@/components/FormMessage"
import { parseForm, withError } from "@/lib/form"
import { agencyStatusSchema } from "@/lib/validations"
import { CATALOGUE, nomOffre, nomOffreDemandee } from "@/lib/offres"
import { recordAudit } from "@/lib/audit"
import { notifyAgencyActivated } from "@/lib/notifications"
import { toDateInputValue, formatDate } from "@/lib/format"
import { subscriptionState } from "@/lib/subscription"

export const metadata: Metadata = { title: "Agences" }

/**
 * Une ligne sous le champ de date : ou en est l'echeance.
 *
 * Une date seule ne se lit pas d'un coup d'oeil sur vingt lignes — il faut
 * la comparer mentalement a aujourd'hui. Le texte le fait a la place du
 * lecteur, et la couleur trie : rouge ce qui est depasse, ambre ce qui
 * approche.
 */
function SubscriptionHint({ endsAt }: { endsAt: Date | null }) {
  const state = subscriptionState(endsAt)

  if (state.kind === "untracked") {
    return (
      <p className="mt-1 text-xs text-slate-600">Aucune échéance suivie</p>
    )
  }

  if (state.kind === "expired") {
    return (
      <p className="mt-1 text-xs font-medium text-red-400">
        Expiré depuis {state.daysOver} j — réglé jusqu&apos;au{" "}
        {formatDate(state.endsAt)}
      </p>
    )
  }

  if (state.kind === "expiring") {
    return (
      <p className="mt-1 text-xs font-medium text-yellow-400">
        Expire dans {state.daysLeft} j
      </p>
    )
  }

  return (
    <p className="mt-1 text-xs text-slate-500">
      À jour — {state.daysLeft} j restants
    </p>
  )
}

export default async function AdminAgenciesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { userName } = await requireSuperAdmin()

  // Sans ce relais, le motif du refus partirait en `?error=` et personne ne
  // le lirait : l'ecran n'affichait aucun bandeau. C'est exactement le
  // defaut ferme par la story 5.13 sur un autre ecran — une annonce
  // d'echec invisible vaut un echec silencieux.
  const params = await searchParams

  /*
    ON COMPTE, ON NE CHARGE PAS (story 3.3, BUG-07). Cet ecran chargeait
    `users: true, properties: true` — toutes les lignes, entieres — pour
    n'afficher que deux entiers.

    MESURE DU 17-08-2026, sur une agence de 500 biens : 624 944 octets et
    23 ms avec l'`include`, contre 34 112 octets et 4 ms avec `_count`.
    Soit ~1,18 Ko par bien, paye a chaque affichage de la console. C'est
    une degradation qui grandit exactement avec le succes commercial.

    LE NOMBRE AFFICHE NE CHANGE PAS, et c'etait la question a poser avant
    (§8) : le filtre de corbeille de `lib/prisma.ts` ne couvre que le
    PREMIER NIVEAU, donc ni l'`include` d'hier ni le `_count` d'aujourd'hui
    — les deux comptent les biens en corbeille. Verifie sur les 67 agences
    de la base : 0 agence dont le nombre changerait.

    LA STORY 3.5 A FERME CE POINT-LA. `properties` porte desormais sa
    propre condition : le `_count` ne compte plus les biens a la corbeille.
    Mesure du 17-08-2026 avant correction, sur les 75 agences de la base :
    0 agence dont le nombre change aujourd'hui — l'ecart n'apparaitra qu'a
    la premiere mise a la corbeille.

    `users` n'en porte pas : `User` n'est pas un modele a corbeille, il n'a
    pas de colonne `deletedAt`. Un compte se desactive (`isActive`), et ce
    compteur-la annonce bien tous les comptes rattaches.
  */
  const agencies = await prisma.agency.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, properties: { where: { deletedAt: null } } } },
    },
  })

  const statusLabels: Record<string, string> = {
    pending: "En attente",
    active: "Active",
    suspended: "Suspendue",
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    active: "bg-green-100 text-green-800",
    suspended: "bg-red-100 text-red-800",
  }

  /**
   * Change le statut d'une agence — c'est le geste qui ouvre ou ferme la
   * porte.
   *
   * L'entree passe par `parseForm` : elle arrivait jusqu'ici en
   * `formData.get("status") as "pending" | "active" | "suspended"`,
   * c'est-a-dire aucune verification. Une valeur forgee partait
   * directement dans Prisma. Le schema existait deja
   * (`agencyStatusSchema`) et n'etait appele nulle part.
   *
   * DEPUIS LA STORY 6.3, ce geste porte aussi l'offre attribuee. Le motif
   * est dans le PRD (UJ-2) : l'editeur ne doit pas vendre ce qu'il n'a pas
   * encaisse, et un second ecran pour trancher l'offre serait un second
   * ecran qu'on oublie d'ouvrir. Il voit la demande sur la ligne, il
   * corrige ou non, il approuve — un seul clic.
   *
   * `plan` est OPTIONNEL a dessein : les boutons « suspendre » et
   * « remettre en attente » ne le portent pas. Une suspension ne doit pas
   * toucher a l'offre, et surtout pas la ramener a un defaut.
   */
  async function updateAgencyStatus(formData: FormData) {
    "use server"
    const admin = await requireSuperAdmin()

    const parsed = parseForm(agencyStatusSchema, formData)

    if (!parsed.ok) {
      redirect(withError("/admin/agencies", parsed.message))
    }

    const { agencyId, status, plan } = parsed.data

    const before = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: {
        name: true,
        email: true,
        status: true,
        plan: true,
        requestedPlan: true,
      },
    })

    if (!before) {
      redirect("/admin/agencies")
    }

    await prisma.agency.update({
      where: { id: agencyId },
      // Sans offre soumise, la cle `plan` est absente de `data`. Ecrire
      // `plan: undefined` serait sans effet aujourd'hui, mais rendrait
      // indetectable a la relecture le jour ou quelqu'un y glisserait une
      // valeur « par defaut » : chaque suspension retrograderait l'agence.
      data: plan ? { status, plan } : { status },
    })

    /*
      L'ECART DEMANDE → ATTRIBUTION EST JOURNALISE, y compris quand il est
      nul. C'est la seule trace qui permettra, dans six mois, de repondre a
      « on m'avait promis Pro » : elle dit ce qui a ete demande, ce qui a
      ete donne, et par qui.
    */
    const journal = [`${before.name} : ${before.status} → ${status}`]

    if (plan) {
      journal.push(
        `offre demandée ${nomOffreDemandee(before.requestedPlan)} → attribuée ${nomOffre(plan)}`
      )
    }

    await recordAudit({
      agencyId,
      userId: admin.userId,
      userName: admin.userName,
      action: "changement_statut",
      entity: "agence",
      entityId: agencyId,
      summary: journal.join(" · "),
    })

    // Une agence qui vient d'etre ouverte doit l'apprendre autrement qu'en
    // reessayant de se connecter au hasard.
    if (status === "active" && before.status !== "active") {
      await notifyAgencyActivated({
        agencyEmail: before.email,
        agencyName: before.name,
      })
    }

    redirect("/admin/agencies")
  }

  /**
   * Reporte l'echeance d'abonnement.
   *
   * Le reglement se fait hors du logiciel : c'est ici qu'on inscrit
   * jusqu'a quand l'agence est couverte. Un champ vide efface l'echeance
   * — le cas d'une agence en essai ou d'un compte offert.
   *
   * Fixer une date ne donne aucun acces et l'echeance ne coupe rien : le
   * statut reste la seule chose qui ouvre ou ferme la porte.
   */
  async function updateSubscription(formData: FormData) {
    "use server"
    const admin = await requireSuperAdmin()

    const agencyId = String(formData.get("agencyId") ?? "")
    const raw = String(formData.get("endsAt") ?? "").trim()

    const before = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: { name: true },
    })

    if (!before) {
      redirect("/admin/agencies")
    }

    let endsAt: Date | null = null

    if (raw) {
      const parsed = new Date(raw)

      if (Number.isNaN(parsed.getTime())) {
        redirect("/admin/agencies")
      }

      endsAt = parsed
    }

    await prisma.agency.update({
      where: { id: agencyId },
      data: { subscriptionEndsAt: endsAt },
    })

    await recordAudit({
      agencyId,
      userId: admin.userId,
      userName: admin.userName,
      action: "changement_statut",
      entity: "abonnement",
      entityId: agencyId,
      summary: endsAt
        ? `${before.name} : abonnement réglé jusqu'au ${endsAt.toLocaleDateString("fr-FR")}`
        : `${before.name} : échéance d'abonnement retirée`,
    })

    redirect("/admin/agencies")
  }

  return (
    <>
      <AdminNavbar userName={userName} />
      <main className="pt-16 min-h-screen bg-slate-950">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold tracking-tight text-white">Gestion des agences</h1>
            <p className="text-slate-400 mt-1">
              Gérez toutes les agences inscrites sur la plateforme
            </p>
          </div>

          <FormMessage error={params.error} />

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Liste des agences ({agencies.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800">
                      <TableHead className="text-slate-400">Agence</TableHead>
                      <TableHead className="text-slate-400">Contact</TableHead>
                      <TableHead className="text-slate-400">Localisation</TableHead>
                      <TableHead className="text-slate-400">Statut</TableHead>
                      <TableHead className="text-slate-400">Offre</TableHead>
                      <TableHead className="text-slate-400">Abonnement</TableHead>
                      <TableHead className="text-slate-400">Utilisateurs</TableHead>
                      <TableHead className="text-slate-400">Biens</TableHead>
                      <TableHead className="text-slate-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agencies.map((agency) => (
                      <TableRow key={agency.id} className="border-slate-800">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-slate-400" />
                            </div>
                            <div>
                              <p className="font-medium text-white">{agency.name}</p>
                              <p className="text-xs text-slate-500">
                                {new Date(agency.createdAt).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-400">
                          <div>
                            <p>{agency.email}</p>
                            <p className="text-xs">{agency.phone || "-"}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-400">
                          <div>
                            <p>{agency.wilaya || "-"}</p>
                            <p className="text-xs">{agency.commune || "-"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[agency.status] || ""}>
                            {statusLabels[agency.status] || agency.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {nomOffre(agency.plan)}
                          {/* Ce qui a ete DEMANDE, sous ce qui est
                              ATTRIBUE. Les deux se lisent d'un coup d'oeil,
                              parce que c'est leur ECART qui interesse
                              l'editeur au moment ou il tranche. */}
                          <p className="text-xs text-slate-500">
                            Demandée : {nomOffreDemandee(agency.requestedPlan)}
                          </p>
                        </TableCell>
                        <TableCell>
                          {/* Le champ porte la date deja enregistree : on
                              corrige une echeance, on ne la retape pas. */}
                          <form
                            action={updateSubscription}
                            className="flex items-center gap-1.5"
                          >
                            <input type="hidden" name="agencyId" value={agency.id} />
                            <input
                              type="date"
                              name="endsAt"
                              defaultValue={toDateInputValue(agency.subscriptionEndsAt)}
                              className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-white"
                            />
                            <Button
                              type="submit"
                              size="sm"
                              variant="ghost"
                              title="Enregistrer l'échéance"
                              className="text-blue-400 hover:bg-blue-900/20 hover:text-blue-300"
                            >
                              <CalendarCheck className="h-4 w-4" />
                            </Button>
                          </form>
                          <SubscriptionHint endsAt={agency.subscriptionEndsAt} />
                        </TableCell>
                        <TableCell className="text-slate-400">{agency._count.users}</TableCell>
                        <TableCell className="text-slate-400">{agency._count.properties}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {agency.status !== "active" && (
                              /*
                                APPROUVER ET ATTRIBUER, EN UN SEUL GESTE.
                                Le selecteur est pre-rempli avec l'offre
                                DEMANDEE : ne pas y toucher revient donc a
                                accorder ce qui a ete demande, ce qui est le
                                cas courant. L'editeur ne corrige que quand
                                il a une raison.

                                Un `select` natif, pas celui de Radix : ce
                                depot a deja paye l'hypothese inverse
                                (CLAUDE.md §7). Un `select` natif poste sa
                                valeur avec le formulaire, sans etat React a
                                maintenir cote client.
                              */
                              <form
                                action={updateAgencyStatus}
                                className="flex items-center gap-1"
                              >
                                <input type="hidden" name="agencyId" value={agency.id} />
                                <input type="hidden" name="status" value="active" />
                                <select
                                  name="plan"
                                  defaultValue={agency.requestedPlan ?? agency.plan}
                                  aria-label={`Offre à attribuer à ${agency.name}`}
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
                                  title="Approuver et attribuer l'offre sélectionnée"
                                  className="text-green-400 hover:text-green-300 hover:bg-green-900/20"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              </form>
                            )}
                            {agency.status !== "suspended" && (
                              <form action={updateAgencyStatus}>
                                <input type="hidden" name="agencyId" value={agency.id} />
                                <input type="hidden" name="status" value="suspended" />
                                <Button
                                  type="submit"
                                  size="sm"
                                  variant="ghost"
                                  className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/20"
                                >
                                  <PauseCircle className="h-4 w-4" />
                                </Button>
                              </form>
                            )}
                            {agency.status !== "pending" && (
                              <form action={updateAgencyStatus}>
                                <input type="hidden" name="agencyId" value={agency.id} />
                                <input type="hidden" name="status" value="pending" />
                                <Button
                                  type="submit"
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </form>
                            )}
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
