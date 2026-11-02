import type { Metadata } from "next"
import { requireSuperAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AdminNavbar } from "@/components/layout/AdminNavbar"
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
import { Building2, Users, TrendingUp, Shield } from "lucide-react"
import { nomOffre } from "@/lib/offres"

export const metadata: Metadata = { title: "Console" }

export default async function AdminDashboard() {
  const { userName } = await requireSuperAdmin()

  const [
    totalAgencies,
    activeAgencies,
    totalUsers,
    totalProperties,
    recentAgencies,
  ] = await Promise.all([
    prisma.agency.count(),
    prisma.agency.count({ where: { status: "active" } }),
    prisma.user.count(),
    prisma.property.count(),
    prisma.agency.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        users: { take: 1 },
      },
    }),
  ])

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

  return (
    <>
      <AdminNavbar userName={userName} />
      <main className="pt-16 min-h-screen bg-slate-950">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold tracking-tight text-white">Dashboard Super Admin</h1>
            <p className="text-slate-400 mt-1">
              Vue d&apos;ensemble de la plateforme Aqar DZ
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Total Agences</CardTitle>
                <Building2 className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{totalAgencies}</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Agences Actives</CardTitle>
                <Shield className="h-4 w-4 text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{activeAgencies}</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Utilisateurs</CardTitle>
                <Users className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{totalUsers}</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Total Biens</CardTitle>
                <TrendingUp className="h-4 w-4 text-orange-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{totalProperties}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Agences récentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800">
                      <TableHead className="text-slate-400">Agence</TableHead>
                      <TableHead className="text-slate-400">Email</TableHead>
                      <TableHead className="text-slate-400">Wilaya</TableHead>
                      <TableHead className="text-slate-400">Statut</TableHead>
                      <TableHead className="text-slate-400">Offre</TableHead>
                      <TableHead className="text-slate-400">Inscription</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentAgencies.map((agency) => (
                      <TableRow key={agency.id} className="border-slate-800">
                        <TableCell className="text-white">{agency.name}</TableCell>
                        <TableCell className="text-slate-400">{agency.email}</TableCell>
                        <TableCell className="text-slate-400">{agency.wilaya || "-"}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[agency.status] || ""}>
                            {statusLabels[agency.status] || agency.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-400">{nomOffre(agency.plan)}</TableCell>
                        <TableCell className="text-slate-400">
                          {new Date(agency.createdAt).toLocaleDateString('fr-FR')}
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
