import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireAgency } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { FormMessage } from "@/components/FormMessage"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Inbox,
  Phone,
  Mail,
  Building2,
  CheckCircle2,
  Archive,
  UserPlus,
  RotateCcw,
} from "lucide-react"
import { formatDate } from "@/lib/format"
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  label,
  estCleConnue,
} from "@/lib/labels"
import { parseForm, withError } from "@/lib/form"
import { leadStatusSchema } from "@/lib/validations"
import { ListToolbar } from "@/components/ListToolbar"
import { Pagination } from "@/components/Pagination"
import { readPageParams, readSearch, textSearch } from "@/lib/list-params"

const BASE = "/agency/leads"

export const metadata: Metadata = { title: "Messages reçus" }

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    error?: string
    success?: string
    q?: string
    page?: string
  }>
}) {
  const { agencyId, agency, userRole, userName } = await requireAgency()
  const params = await searchParams

  const statusFilter = estCleConnue(LEAD_STATUS_LABELS, params.status)
    ? params.status
    : undefined

  const q = readSearch(params)
  const { page, perPage, skip } = readPageParams(params)

  const where = {
    agencyId,
    ...(statusFilter ? { status: statusFilter as never } : {}),
    ...(textSearch(q, ["firstName", "lastName", "phone", "email", "message"]) ?? {}),
  }

  const [leads, counts, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
      include: { property: { select: { id: true, title: true } } },
    }),
    prisma.lead.groupBy({
      by: ["status"],
      where: { agencyId },
      _count: true,
    }),
    prisma.lead.count({ where }),
  ])

  const countBy = (status: string) =>
    counts.find((c) => c.status === status)?._count ?? 0

  /** Change le statut d'un message (nouveau / traité / archivé). */
  async function setStatus(formData: FormData) {
    "use server"
    const { agencyId } = await requireAgency()

    // LE STATUT PASSE PAR UN SCHEMA, il ne se caste pas. Il etait confronte
    // a `LEAD_STATUS_LABELS` avec `in`, puis caste — et `in` remonte la
    // chaine de prototypes : `constructor`, `toString`, `__proto__` et trois
    // autres franchissaient la garde, pour finir en
    // `PrismaClientValidationError` en pleine page (story 3.2, BUG-38).
    const parsed = parseForm(leadStatusSchema, formData)

    if (!parsed.ok) {
      redirect(withError(BASE, parsed.message))
    }

    const { id, status } = parsed.data

    const lead = await prisma.lead.findFirst({
      where: { id, agencyId },
      select: { id: true },
    })

    if (!lead) {
      redirect(`${BASE}?error=${encodeURIComponent("Message introuvable")}`)
    }

    await prisma.lead.update({ where: { id }, data: { status } })

    revalidatePath(BASE)
    redirect(`${BASE}?success=${encodeURIComponent("Statut mis à jour")}`)
  }

  /**
   * Transforme un message en fiche client, pour faire entrer le contact
   * dans le pipeline commercial sans ressaisie.
   */
  async function convertToClient(formData: FormData) {
    "use server"
    const { agencyId } = await requireAgency()

    const id = formData.get("id") as string

    const lead = await prisma.lead.findFirst({ where: { id, agencyId } })

    if (!lead) {
      redirect(`${BASE}?error=${encodeURIComponent("Message introuvable")}`)
    }

    const client = await prisma.client.create({
      data: {
        firstName: lead.firstName,
        lastName: lead.lastName,
        phone: lead.phone,
        email: lead.email,
        type: "interesse",
        status: "nouveau",
        notes: `Contact reçu via la vitrine en ligne le ${formatDate(lead.createdAt)}.`,
        agencyId,
      },
    })

    // Le message d'origine devient la premiere ligne de l'historique.
    await prisma.interaction.create({
      data: {
        type: "email",
        subject: "Demande reçue via la vitrine",
        content: lead.message,
        date: lead.createdAt,
        clientId: client.id,
        agencyId,
      },
    })

    await prisma.lead.update({ where: { id }, data: { status: "traite" } })

    revalidatePath(BASE)
    redirect(
      `/agency/clients/${client.id}?success=${encodeURIComponent("Fiche client créée depuis le message")}`
    )
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Messages reçus</h1>
              <p className="text-slate-600 mt-1">
                Demandes envoyées depuis votre vitrine en ligne
              </p>
            </div>
            {agency.slug && agency.showcaseEnabled && (
              <Button asChild variant="outline">
                <a
                  href={`/vitrine/${agency.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  Voir ma vitrine
                </a>
              </Button>
            )}
          </div>

          <FormMessage error={params.error} success={params.success} />

          <ListToolbar
            basePath="/agency/leads"
            q={q}
            placeholder="Rechercher un message : nom, téléphone, contenu…"
            hidden={{ status: statusFilter }}
            exportPath="/api/export/leads"
            exportParams={{ status: statusFilter }}
          />

          <div className="mb-6 flex flex-wrap gap-2">
            <Button
              asChild
              size="sm"
              variant={statusFilter ? "outline" : "default"}
              className={statusFilter ? "" : "bg-dar-ink hover:bg-dar-blue"}
            >
              <Link href={BASE}>Tous ({counts.reduce((s, c) => s + c._count, 0)})</Link>
            </Button>
            {Object.entries(LEAD_STATUS_LABELS).map(([value, text]) => (
              <Button
                key={value}
                asChild
                size="sm"
                variant={statusFilter === value ? "default" : "outline"}
                className={statusFilter === value ? "bg-dar-ink hover:bg-dar-blue" : ""}
              >
                <Link href={`${BASE}?status=${value}`}>
                  {text} ({countBy(value)})
                </Link>
              </Button>
            ))}
          </div>

          {leads.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Inbox className="mx-auto mb-4 h-16 w-16 text-slate-300" />
                <h2 className="mb-2 text-lg font-medium text-slate-900">
                  Aucun message
                </h2>
                <p className="text-slate-500">
                  {agency.slug && agency.showcaseEnabled
                    ? "Les demandes envoyées depuis votre vitrine apparaîtront ici."
                    : "Activez votre vitrine dans les paramètres pour recevoir des demandes."}
                </p>
                {(!agency.slug || !agency.showcaseEnabled) && (
                  <Button asChild className="mt-6 bg-dar-ink hover:bg-dar-blue">
                    <Link href="/agency/settings">Configurer ma vitrine</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {leads.map((lead) => (
                <Card key={lead.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">
                          {lead.firstName} {lead.lastName}
                        </CardTitle>
                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                          {lead.phone && (
                            <a
                              href={`tel:${lead.phone}`}
                              className="flex items-center gap-1.5 hover:text-slate-900"
                            >
                              <Phone className="h-4 w-4 text-slate-400" />
                              {lead.phone}
                            </a>
                          )}
                          {lead.email && (
                            <a
                              href={`mailto:${lead.email}`}
                              className="flex items-center gap-1.5 hover:text-slate-900"
                            >
                              <Mail className="h-4 w-4 text-slate-400" />
                              {lead.email}
                            </a>
                          )}
                          <span className="text-slate-400">
                            {formatDate(lead.createdAt)}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={LEAD_STATUS_COLORS[lead.status] ?? ""}
                      >
                        {label(LEAD_STATUS_LABELS, lead.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {lead.property && (
                      <p className="mb-3 text-sm">
                        <span className="text-slate-500">Bien concerné : </span>
                        <Link
                          href={`/agency/properties/${lead.property.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {lead.property.title}
                        </Link>
                      </p>
                    )}

                    <p className="rounded-lg bg-slate-50 p-4 text-slate-700">
                      {lead.message}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <form action={convertToClient}>
                        <input type="hidden" name="id" value={lead.id} />
                        <Button type="submit" size="sm" variant="outline">
                          <UserPlus className="mr-2 h-4 w-4" />
                          Créer une fiche client
                        </Button>
                      </form>

                      {lead.status !== "traite" && (
                        <form action={setStatus}>
                          <input type="hidden" name="id" value={lead.id} />
                          <input type="hidden" name="status" value="traite" />
                          <Button
                            type="submit"
                            size="sm"
                            variant="ghost"
                            className="text-green-600 hover:text-green-700"
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Marquer traité
                          </Button>
                        </form>
                      )}

                      {lead.status !== "archive" ? (
                        <form action={setStatus}>
                          <input type="hidden" name="id" value={lead.id} />
                          <input type="hidden" name="status" value="archive" />
                          <Button
                            type="submit"
                            size="sm"
                            variant="ghost"
                            className="text-slate-500"
                          >
                            <Archive className="mr-2 h-4 w-4" />
                            Archiver
                          </Button>
                        </form>
                      ) : (
                        <form action={setStatus}>
                          <input type="hidden" name="id" value={lead.id} />
                          <input type="hidden" name="status" value="nouveau" />
                          <Button
                            type="submit"
                            size="sm"
                            variant="ghost"
                            className="text-slate-500"
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Désarchiver
                          </Button>
                        </form>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Pagination
            page={page}
            perPage={perPage}
            total={total}
            basePath="/agency/leads"
            params={{ q, status: statusFilter }}
          />
        </div>
      </main>
    </>
  )
}
