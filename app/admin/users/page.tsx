import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { hash } from "bcryptjs"
import { requireSuperAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { AdminNavbar } from "@/components/layout/AdminNavbar"
import { FormMessage } from "@/components/FormMessage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Users, UserCheck, Shield, KeyRound, Ban, Check } from "lucide-react"
import { readPageParams, readSearch, textSearch } from "@/lib/list-params"
import { ListToolbar } from "@/components/ListToolbar"
import { Pagination } from "@/components/Pagination"

export const metadata: Metadata = { title: "Utilisateurs" }

const BASE = "/admin/users"
const MIN_PASSWORD = 8

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  agency_admin: "Admin Agence",
  agent: "Agent",
}

const roleColors: Record<string, string> = {
  super_admin: "bg-red-100 text-red-800",
  agency_admin: "bg-blue-100 text-blue-800",
  agent: "bg-green-100 text-green-800",
}

/**
 * Gestion des comptes, cote plateforme.
 *
 * Cet ecran etait en lecture seule, et c'etait le trou le plus concret du
 * produit : tant que SMTP n'est pas configure, le lien « mot de passe
 * oublie » ne part pas. Un patron d'agence qui oubliait son mot de passe
 * n'avait alors AUCUN moyen de revenir — il est le seul administrateur de
 * son agence, personne au-dessous de lui ne peut le depanner.
 *
 * L'editeur peut donc desormais lui redonner un mot de passe. C'est une
 * action lourde, qui donne acces au compte d'un client : elle est
 * journalisee, et le mot de passe choisi doit etre transmis a l'agence par
 * un autre canal (telephone), jamais reutilise.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    page?: string
    error?: string
    success?: string
  }>
}) {
  const { userId: actorId, userName } = await requireSuperAdmin()
  const params = await searchParams

  const q = readSearch(params)
  const { page, perPage, skip } = readPageParams(params)

  const where = {
    ...(textSearch(q, ["name", "email"]) ?? {}),
  }

  const [users, total, counts] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
      include: { agency: { select: { name: true, status: true } } },
    }),
    prisma.user.count({ where }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
  ])

  const countFor = (role: string) =>
    counts.find((row) => row.role === role)?._count._all ?? 0

  const totalUsers = counts.reduce((sum, row) => sum + row._count._all, 0)

  /**
   * Redonne un mot de passe a un utilisateur.
   *
   * Le mot de passe est choisi par l'editeur et affiche une seule fois
   * dans le message de confirmation : il n'est jamais stocke en clair, et
   * il n'existe aucun moyen de le relire ensuite.
   */
  async function resetPassword(formData: FormData) {
    "use server"
    const { userId: actor, userName } = await requireSuperAdmin()

    const id = String(formData.get("userId") ?? "")
    const password = String(formData.get("password") ?? "")

    if (password.length < MIN_PASSWORD) {
      redirect(
        `${BASE}?error=${encodeURIComponent(
          `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères`
        )}`
      )
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, agencyId: true },
    })

    if (!target) {
      redirect(`${BASE}?error=${encodeURIComponent("Compte introuvable")}`)
    }

    await prisma.user.update({
      where: { id },
      data: { password: await hash(password, 12) },
    })

    // Changer le mot de passe ne ferme pas les sessions deja ouvertes :
    // elles reposent sur un jeton signe, pas sur une table, et rien ne
    // peut invalider un jeton avant son terme.
    //
    // Le remede est donc de DESACTIVER le compte — et depuis la story 1.8,
    // cela fonctionne reellement : les gardes relisent `isActive` en base a
    // chaque requete, l'acces tombe a la suivante. Ce commentaire affirmait
    // ce remede alors qu'il n'existait pas : la desactivation n'etait lue
    // qu'a la connexion, et ne coupait rien (BUG-33).
    //
    // CE QUI RESTE HORS DE PORTEE : un jeton VOLE sur un compte qu'on
    // laisse actif reste utilisable jusqu'a son expiration (douze heures
    // d'inactivite, cf. auth.config.ts). Le fermer demande de comparer la
    // date d'emission du jeton a une marque posee sur le compte — story 5.8.
    await recordAudit({
      agencyId: target.agencyId,
      userId: actor,
      userName,
      action: "reinitialisation_mot_de_passe",
      entity: "compte",
      entityId: id,
      summary: `Mot de passe de ${target.email} réinitialisé par l'éditeur`,
    })

    revalidatePath(BASE)
    redirect(
      `${BASE}?success=${encodeURIComponent(
        `Mot de passe de ${target.email} remplacé. Transmettez-le par téléphone, il ne sera plus affiché.`
      )}`
    )
  }

  /** Coupe ou retablit l'acces d'un compte. */
  async function toggleActive(formData: FormData) {
    "use server"
    const { userId: actor, userName } = await requireSuperAdmin()

    const id = String(formData.get("userId") ?? "")

    if (id === actor) {
      redirect(
        `${BASE}?error=${encodeURIComponent(
          "Vous ne pouvez pas désactiver votre propre compte"
        )}`
      )
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, isActive: true, agencyId: true, role: true },
    })

    if (!target) {
      redirect(`${BASE}?error=${encodeURIComponent("Compte introuvable")}`)
    }

    const next = !target.isActive

    // Ne jamais laisser une agence sans administrateur actif (story 4.3).
    //
    // La console d'agence pose deja ce garde, DEUX fois — et il y est
    // inatteignable : l'acteur y est forcement un `agency_admin` actif de
    // l'agence, distinct de sa cible (l'action sur soi-meme est refusee
    // plus haut), donc le compte restant n'est jamais nul. Le garde etait
    // au seul endroit ou il ne peut pas servir, et absent du seul endroit
    // ou il le pouvait : ici.
    //
    // Une agence privee de son dernier administrateur ne peut plus ouvrir
    // de compte, toucher ses parametres, gerer sa vitrine, vider sa
    // corbeille ni supprimer quoi que ce soit — et elle ne peut pas s'en
    // sortir seule, puisque creer un compte est justement reserve a
    // l'administrateur.
    //
    // L'editeur garde le pouvoir de fermer une agence : c'est la
    // suspension, dans /admin/agencies, qui ferme tout d'un coup et se
    // defait pareil. Desactiver le dernier administrateur n'est pas le
    // moyen de suspendre une agence, c'est le moyen de la casser sans le
    // vouloir.
    if (!next && target.agencyId && target.role === "agency_admin") {
      const restants = await prisma.user.count({
        where: {
          agencyId: target.agencyId,
          isActive: true,
          role: "agency_admin",
          id: { not: target.id },
        },
      })

      if (restants === 0) {
        redirect(
          `${BASE}?error=${encodeURIComponent(
            "Ce compte est le dernier administrateur actif de son agence. " +
              "Pour fermer l'agence, suspendez-la depuis la page Agences."
          )}`
        )
      }
    }

    await prisma.user.update({ where: { id }, data: { isActive: next } })

    await recordAudit({
      agencyId: target.agencyId,
      userId: actor,
      userName,
      action: next ? "modification_compte" : "desactivation_compte",
      entity: "compte",
      entityId: id,
      summary: `${target.email} ${next ? "réactivé" : "désactivé"} par l'éditeur`,
    })

    revalidatePath(BASE)
    redirect(
      `${BASE}?success=${encodeURIComponent(
        next ? "Compte réactivé" : "Compte désactivé"
      )}`
    )
  }

  return (
    <>
      <AdminNavbar userName={userName} />
      <main className="min-h-screen bg-slate-950 pt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold tracking-tight text-white">
              Gestion des utilisateurs
            </h1>
            <p className="mt-1 text-slate-400">
              Dépanner un compte bloqué et couper un accès
            </p>
          </div>

          <FormMessage error={params.error} success={params.success} />

          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                label: "Total utilisateurs",
                value: totalUsers,
                icon: <Users className="h-4 w-4 text-blue-400" />,
              },
              {
                label: "Admins d'agence",
                value: countFor("agency_admin"),
                icon: <UserCheck className="h-4 w-4 text-green-400" />,
              },
              {
                label: "Agents",
                value: countFor("agent"),
                icon: <Shield className="h-4 w-4 text-purple-400" />,
              },
            ].map((stat) => (
              <Card key={stat.label} className="border-slate-800 bg-slate-900">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">
                    {stat.label}
                  </CardTitle>
                  {stat.icon}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    {stat.value}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="[&_input]:border-slate-700 [&_input]:bg-slate-900 [&_input]:text-white">
            <ListToolbar
              basePath={BASE}
              q={q}
              placeholder="Rechercher un compte : nom, email…"
            />
          </div>

          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-white">
                {total} compte{total > 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800">
                      <TableHead className="text-slate-400">Utilisateur</TableHead>
                      <TableHead className="text-slate-400">Rôle</TableHead>
                      <TableHead className="text-slate-400">Agence</TableHead>
                      <TableHead className="text-slate-400">Statut</TableHead>
                      <TableHead className="text-right text-slate-400">
                        Dépannage
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} className="border-slate-800">
                        <TableCell>
                          <p className="font-medium text-white">
                            {user.name || "—"}
                          </p>
                          <p className="font-mono text-xs text-slate-500">
                            {user.email}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge className={roleColors[user.role] || ""}>
                            {roleLabels[user.role] || user.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {user.agency ? (
                            <>
                              {user.agency.name}
                              {user.agency.status !== "active" && (
                                <span className="ml-1.5 text-xs text-yellow-500">
                                  ({user.agency.status})
                                </span>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              user.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-slate-200 text-slate-700"
                            }
                          >
                            {user.isActive ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <form
                              action={resetPassword}
                              className="flex items-center gap-1.5"
                            >
                              <input type="hidden" name="userId" value={user.id} />
                              <Input
                                type="text"
                                name="password"
                                placeholder="Nouveau mot de passe"
                                minLength={MIN_PASSWORD}
                                required
                                className="h-9 w-44 border-slate-700 bg-slate-950 text-white placeholder:text-slate-600"
                              />
                              <Button
                                type="submit"
                                size="sm"
                                variant="ghost"
                                title="Réinitialiser le mot de passe"
                                className="text-blue-400 hover:bg-blue-900/20 hover:text-blue-300"
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                            </form>

                            {user.id !== actorId && (
                              <form action={toggleActive}>
                                <input
                                  type="hidden"
                                  name="userId"
                                  value={user.id}
                                />
                                <Button
                                  type="submit"
                                  size="sm"
                                  variant="ghost"
                                  title={
                                    user.isActive
                                      ? "Couper l'accès"
                                      : "Rétablir l'accès"
                                  }
                                  className={
                                    user.isActive
                                      ? "text-red-400 hover:bg-red-900/20 hover:text-red-300"
                                      : "text-green-400 hover:bg-green-900/20 hover:text-green-300"
                                  }
                                >
                                  {user.isActive ? (
                                    <Ban className="h-4 w-4" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                </Button>
                              </form>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <Pagination
                  page={page}
                  perPage={perPage}
                  total={total}
                  basePath={BASE}
                />

                <p className="mt-5 max-w-3xl text-xs leading-relaxed text-slate-500">
                  Réinitialiser un mot de passe donne accès au compte d&apos;un
                  client : l&apos;action est inscrite au journal. Communiquez le
                  nouveau mot de passe par téléphone et demandez à
                  l&apos;utilisateur de le changer. Changer le mot de passe ne
                  ferme pas les sessions déjà ouvertes — pour couper un accès
                  immédiatement, désactivez le compte.
                </p>

                <p className="mt-3 text-xs text-slate-500">
                  Pour activer ou suspendre une agence entière, passez par{" "}
                  <Link
                    href="/admin/agencies"
                    className="text-blue-400 hover:underline"
                  >
                    Gestion des agences
                  </Link>
                  .
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
