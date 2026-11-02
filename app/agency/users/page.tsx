import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { hash } from "bcryptjs"
import { requireAgencyAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { FormMessage } from "@/components/FormMessage"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { KeyRound, ShieldCheck, UserPlus, UserX, UserCheck } from "lucide-react"
import { formatDate } from "@/lib/format"
import { agencyUserSchema } from "@/lib/validations"
import { parseForm, withError, withSuccess } from "@/lib/form"
import { quotaComptes, refusDeQuota } from "@/lib/quotas"
import { formaterPlafond } from "@/lib/offres"

const BASE = "/agency/users"

const selectClass =
  "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dar-blue/40"

const ROLE_LABELS: Record<string, string> = {
  agency_admin: "Administrateur",
  agent: "Agent",
  super_admin: "Super admin",
}

/**
 * Comptes de l'agence.
 *
 * Ecran reserve a l'administrateur de l'agence : c'est lui qui ouvre et
 * ferme les acces de ses collaborateurs. Jusqu'ici aucun ecran ne le
 * permettait, et les comptes ne pouvaient etre crees qu'en base.
 *
 * Deux garde-fous non negociables :
 *  - on ne peut pas se desactiver ni se retrograder soi-meme (un
 *    administrateur qui se coupe l'acces bloque toute l'agence) ;
 *  - un compte n'est jamais supprime, il est desactive : les visites et
 *    les operations qu'il a saisies gardent leur auteur.
 */
export const metadata: Metadata = { title: "Comptes de l'agence" }

export default async function AgencyUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  // userName n'est utile qu'aux actions serveur, qui rappellent la garde.
  const { agencyId, userId, userRole, userName } = await requireAgencyAdmin()
  const query = await searchParams

  const users = await prisma.user.findMany({
    where: { agencyId },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: { select: { auditLogs: true } },
    },
  })

  const activeAdmins = users.filter(
    (user) => user.isActive && user.role === "agency_admin"
  ).length

  // Le decompte est relu en base plutot que derive de `users` ci-dessus :
  // c'est le meme chiffre aujourd'hui, mais `users` est une liste
  // d'affichage — le jour ou elle gagne une pagination ou un filtre, sa
  // longueur cesserait d'etre le decompte sans que rien ne le signale.
  const quota = await quotaComptes(agencyId)

  async function createUser(formData: FormData) {
    "use server"
    const { agencyId, userId, userName } = await requireAgencyAdmin()

    // La garde est DANS L'ACTION : masquer le formulaire au plafond ne
    // refuse rien, l'action reste joignable sans l'ecran (FR-10).
    const quota = await quotaComptes(agencyId)

    if (quota.atteint) {
      redirect(withError(BASE, refusDeQuota(quota, "compte")))
    }

    const parsed = parseForm(agencyUserSchema, formData)

    if (!parsed.ok) {
      redirect(withError(BASE, parsed.message))
    }

    const data = parsed.data

    const existing = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    })

    if (existing) {
      redirect(withError(BASE, "Cet email est déjà utilisé"))
    }

    const created = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        role: data.role,
        password: await hash(data.password, 12),
        agencyId,
        isActive: true,
      },
      select: { id: true },
    })

    await recordAudit({
      agencyId,
      userId,
      userName,
      action: "creation_compte",
      entity: "compte",
      entityId: created.id,
      summary: `Compte ${data.email} créé (${ROLE_LABELS[data.role]})`,
    })

    revalidatePath(BASE)
    redirect(withSuccess(BASE, `Compte ${data.email} créé`))
  }

  async function toggleActive(formData: FormData) {
    "use server"
    const { agencyId, userId, userName } = await requireAgencyAdmin()

    const targetId = String(formData.get("targetId") ?? "")

    if (targetId === userId) {
      redirect(withError(BASE, "Vous ne pouvez pas désactiver votre propre compte"))
    }

    const target = await prisma.user.findFirst({
      where: { id: targetId, agencyId },
      select: { id: true, email: true, isActive: true, role: true },
    })

    if (!target) {
      redirect(withError(BASE, "Compte introuvable"))
    }

    // Ne jamais laisser une agence sans administrateur actif.
    if (target.isActive && target.role === "agency_admin") {
      const remaining = await prisma.user.count({
        where: { agencyId, isActive: true, role: "agency_admin", id: { not: targetId } },
      })

      if (remaining === 0) {
        redirect(
          withError(BASE, "L'agence doit garder au moins un administrateur actif")
        )
      }
    }

    /*
      REACTIVER FAIT REMONTER LE DECOMPTE SANS RIEN CREER (FR-11).

      Sans ce controle, le plafond des comptes se contournerait en deux
      gestes : desactiver un compte, en creer un neuf, reactiver l'ancien.
      C'est le chemin que poser un plafond vient de rendre atteignable —
      il ne comptait pour rien tant que rien ne comptait.

      Le controle ne vaut QUE dans ce sens. Desactiver doit rester
      possible en toutes circonstances : c'est la sortie normale d'une
      agence qui depasse (FR-12), et la bloquer l'enfermerait.
    */
    if (!target.isActive) {
      const quota = await quotaComptes(agencyId)

      if (quota.atteint) {
        redirect(withError(BASE, refusDeQuota(quota, "compte")))
      }
    }

    await prisma.user.update({
      where: { id: targetId },
      data: { isActive: !target.isActive },
    })

    await recordAudit({
      agencyId,
      userId,
      userName,
      action: target.isActive ? "desactivation_compte" : "modification_compte",
      entity: "compte",
      entityId: targetId,
      summary: `${target.email} ${target.isActive ? "désactivé" : "réactivé"}`,
    })

    revalidatePath(BASE)
    redirect(
      withSuccess(BASE, target.isActive ? "Compte désactivé" : "Compte réactivé")
    )
  }

  async function changeRole(formData: FormData) {
    "use server"
    const { agencyId, userId, userName } = await requireAgencyAdmin()

    const targetId = String(formData.get("targetId") ?? "")
    const role = String(formData.get("role") ?? "")

    if (role !== "agency_admin" && role !== "agent") {
      redirect(withError(BASE, "Rôle inconnu"))
    }

    if (targetId === userId) {
      redirect(withError(BASE, "Vous ne pouvez pas changer votre propre rôle"))
    }

    const target = await prisma.user.findFirst({
      where: { id: targetId, agencyId },
      select: { id: true, email: true, role: true, isActive: true },
    })

    if (!target) {
      redirect(withError(BASE, "Compte introuvable"))
    }

    if (target.role === "agency_admin" && role === "agent" && target.isActive) {
      const remaining = await prisma.user.count({
        where: { agencyId, isActive: true, role: "agency_admin", id: { not: targetId } },
      })

      if (remaining === 0) {
        redirect(
          withError(BASE, "L'agence doit garder au moins un administrateur actif")
        )
      }
    }

    await prisma.user.update({ where: { id: targetId }, data: { role } })

    await recordAudit({
      agencyId,
      userId,
      userName,
      action: "modification_compte",
      entity: "compte",
      entityId: targetId,
      summary: `${target.email} : ${ROLE_LABELS[target.role]} → ${ROLE_LABELS[role]}`,
    })

    revalidatePath(BASE)
    redirect(withSuccess(BASE, "Rôle mis à jour"))
  }

  async function resetPassword(formData: FormData) {
    "use server"
    const { agencyId, userId, userName } = await requireAgencyAdmin()

    const targetId = String(formData.get("targetId") ?? "")
    const password = String(formData.get("password") ?? "")

    if (password.length < 6) {
      redirect(withError(BASE, "Le mot de passe doit contenir au moins 6 caractères"))
    }

    const target = await prisma.user.findFirst({
      where: { id: targetId, agencyId },
      select: { id: true, email: true },
    })

    if (!target) {
      redirect(withError(BASE, "Compte introuvable"))
    }

    await prisma.user.update({
      where: { id: targetId },
      data: { password: await hash(password, 12) },
    })

    // Les liens de reinitialisation en cours n'ont plus lieu d'etre.
    await prisma.passwordResetToken.deleteMany({ where: { userId: targetId } })

    await recordAudit({
      agencyId,
      userId,
      userName,
      action: "reinitialisation_mot_de_passe",
      entity: "compte",
      entityId: targetId,
      summary: `Mot de passe de ${target.email} réinitialisé par l'administrateur`,
    })

    revalidatePath(BASE)
    redirect(withSuccess(BASE, `Mot de passe de ${target.email} modifié`))
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash min-h-screen pt-16">
        <div className="container mx-auto max-w-5xl px-4 py-8">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">
              Comptes de l&apos;agence
            </h1>
            <p className="mt-1 text-slate-600">
              Ouvrez l&apos;accès à vos collaborateurs et décidez de ce que
              chacun peut faire.
            </p>
          </div>

          <FormMessage error={query.error} success={query.success} />

          {/* Ce que chaque role peut faire — la regle est appliquee, pas indicative */}
          <Card className="mb-8 border-dar-sand">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-dar-blue" />
                Ce que chaque rôle peut faire
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="font-medium text-dar-ink">Administrateur</p>
                <p className="mt-1 leading-relaxed text-dar-ink/60">
                  Tout l&apos;espace : biens, clients, transactions, mais aussi
                  les suppressions, la vitrine, les paramètres de l&apos;agence
                  et ces comptes.
                </p>
              </div>
              <div>
                <p className="font-medium text-dar-ink">Agent</p>
                <p className="mt-1 leading-relaxed text-dar-ink/60">
                  Le quotidien : créer et modifier biens, clients,
                  propriétaires, visites et transactions. Il ne supprime rien et
                  ne touche ni à la vitrine ni aux paramètres.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Comptes ({users.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Personne</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>État</TableHead>
                      <TableHead>Depuis</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <p className="font-medium text-dar-ink">
                            {user.name ?? "Sans nom"}
                            {user.id === userId && (
                              <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-dar-blue">
                                vous
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </TableCell>
                        <TableCell>
                          {user.id === userId || user.role === "super_admin" ? (
                            <Badge variant="secondary">
                              {ROLE_LABELS[user.role] ?? user.role}
                            </Badge>
                          ) : (
                            <form action={changeRole} className="flex items-center gap-2">
                              <input type="hidden" name="targetId" value={user.id} />
                              <select
                                name="role"
                                defaultValue={user.role}
                                className={`${selectClass} h-8 w-40 text-xs`}
                              >
                                <option value="agent">Agent</option>
                                <option value="agency_admin">Administrateur</option>
                              </select>
                              <Button type="submit" size="sm" variant="ghost">
                                Changer
                              </Button>
                            </form>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.isActive ? (
                            <span className="flex items-center gap-1.5 text-sm text-emerald-700">
                              <UserCheck className="h-4 w-4" />
                              Actif
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-sm text-slate-400">
                              <UserX className="h-4 w-4" />
                              Désactivé
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {formatDate(user.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <form action={resetPassword} className="flex items-center gap-1.5">
                              <input type="hidden" name="targetId" value={user.id} />
                              <Input
                                name="password"
                                type="password"
                                placeholder="Nouveau mot de passe"
                                minLength={6}
                                required
                                className="h-8 w-44 text-xs"
                              />
                              <Button
                                type="submit"
                                size="sm"
                                variant="ghost"
                                title="Définir ce mot de passe"
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                            </form>

                            {user.id !== userId && (
                              <form action={toggleActive}>
                                <input type="hidden" name="targetId" value={user.id} />
                                <Button
                                  type="submit"
                                  size="sm"
                                  variant="ghost"
                                  className={
                                    user.isActive
                                      ? "text-red-600 hover:bg-red-50 hover:text-red-700"
                                      : "text-emerald-700 hover:bg-emerald-50"
                                  }
                                >
                                  {user.isActive ? "Désactiver" : "Réactiver"}
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

              {activeAdmins === 1 && (
                <p className="mt-4 text-xs leading-relaxed text-slate-500">
                  Votre agence n&apos;a qu&apos;un seul administrateur actif. Le
                  système empêchera de le désactiver ou de le rétrograder tant
                  qu&apos;il est le dernier.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-dar-blue" />
                Ajouter un collaborateur
              </CardTitle>
              {/* Le quota se lit AVANT de buter dessus, pas au moment ou
                  il bloque. Il est ecrit meme quand il est loin : c'est
                  ainsi qu'on choisit son offre en connaissance de cause. */}
              <p className="text-sm text-slate-500">
                Offre {quota.offre.nom} — {quota.decompte} compte
                {quota.decompte > 1 ? "s" : ""} actif
                {quota.decompte > 1 ? "s" : ""} sur{" "}
                {formaterPlafond(quota.plafond)}
              </p>
            </CardHeader>
            <CardContent>
              {quota.atteint ? (
                /*
                  Le formulaire disparait au plafond : rien ne se saisit,
                  donc rien ne se perd. Le ton reste factuel — l'agence
                  garde tous ses comptes, elle ne peut pas en ouvrir un de
                  plus.
                */
                <div className="space-y-2">
                  <p className="leading-relaxed text-slate-700">
                    {refusDeQuota(quota, "compte")}
                  </p>
                  <p className="text-sm leading-relaxed text-slate-500">
                    Vos comptes existants restent actifs et modifiables.
                    Désactiver un collaborateur libère aussitôt une place, et
                    son historique est conservé.
                  </p>
                </div>
              ) : (
              <form action={createUser} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom complet *</Label>
                  <Input id="name" name="name" placeholder="Yacine Meziane" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="yacine@votre-agence.dz"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Rôle *</Label>
                  <select id="role" name="role" defaultValue="agent" className={selectClass}>
                    <option value="agent">Agent</option>
                    <option value="agency_admin">Administrateur</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe provisoire *</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    minLength={6}
                    placeholder="6 caractères minimum"
                    required
                  />
                  <p className="text-xs text-slate-500">
                    Communiquez-le à la personne : elle pourra le changer depuis
                    « Mot de passe oublié ».
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <Button type="submit" className="bg-dar-ink hover:bg-dar-blue">
                    Créer le compte
                  </Button>
                </div>
              </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
