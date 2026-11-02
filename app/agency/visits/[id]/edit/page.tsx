import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireAgency, requireAgencyAdmin, isAgencyAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { optionsParent, vivantsEtCourant, lienInchange } from "@/lib/corbeille"
import { recordAudit } from "@/lib/audit"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { FormMessage } from "@/components/FormMessage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Trash2 } from "lucide-react"
import { toDateInputValue, formatDate } from "@/lib/format"
import { VISIT_STATUS_LABELS, INTEREST_LEVEL_LABELS } from "@/lib/labels"
import { visitSchema } from "@/lib/validations"
import { parseForm, withError, withSuccess } from "@/lib/form"

const selectClass =
  "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"

export default async function EditVisitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const { id } = await params
  const query = await searchParams

  const visit = await prisma.visit.findFirst({ where: { id, agencyId } })

  if (!visit) {
    notFound()
  }

  /**
   * Le parent mis a la corbeille reste dans la liste, etiquete (BUG-34).
   *
   * Sans lui, aucune `<option>` ne correspond au `defaultValue` : le
   * navigateur retombe sur la PREMIERE, et enregistrer sans rien changer
   * reecrit le lien metier. Reproduit sur l'instance le 12 aout 2026.
   *
   * UNE SEULE requete par parent (story 3.10) : la liste et le parent
   * courant viennent ensemble, donc rien ne peut etre restaure entre les
   * deux, et c'est l'`orderBy` ci-dessous qui range — le parent en
   * corbeille ne squatte plus la premiere place.
   */
  const [properties, clients, agents] = await Promise.all([
    prisma.property.findMany({
      where: { agencyId, ...vivantsEtCourant(visit.propertyId) },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, deletedAt: true },
    }),
    prisma.client.findMany({
      where: { agencyId, ...vivantsEtCourant(visit.clientId) },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true, deletedAt: true },
    }),
    prisma.user.findMany({
      where: { agencyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  const biens = optionsParent(properties, (p) => p.title, visit.propertyId)
  const contacts = optionsParent(
    clients,
    (c) => `${c.firstName} ${c.lastName}`,
    visit.clientId
  )

  // Captures comme VALEURS : une Server Action ne capture pas un objet
  // retreci par un `notFound()` situe plus haut.
  const bienCourant = visit.propertyId
  const contactCourant = visit.clientId

  async function updateVisit(formData: FormData) {
    "use server"
    const { agencyId } = await requireAgency()
    const { id } = await params

    const parsed = parseForm(visitSchema, formData)

    if (!parsed.ok) {
      redirect(withError(`/agency/visits/${id}/edit`, parsed.message))
    }

    const data = parsed.data

    const owned = await prisma.visit.findFirst({
      where: { id, agencyId },
      select: { id: true },
    })

    if (!owned) {
      redirect(withError("/agency/visits", "Visite introuvable"))
    }

    // Le bien et le client doivent appartenir a l'agence.
    // Un lien INCHANGE n'est pas reverifie : il l'a ete quand il a ete
    // ecrit, et le reverifier le rejetterait si le parent est passe a la
    // corbeille depuis (voir `lienInchange`).
    const [property, client] = await Promise.all([
      prisma.property.findFirst({
        where: {
          id: data.propertyId,
          agencyId,
          // Nommer la clef suffit a desactiver l'injection de
          // `lib/prisma.ts` ; `undefined` n'ajoute aucune condition.
          deletedAt: lienInchange(data.propertyId, bienCourant)
            ? undefined
            : null,
        },
        select: { id: true },
      }),
      prisma.client.findFirst({
        where: {
          id: data.clientId,
          agencyId,
          deletedAt: lienInchange(data.clientId, contactCourant)
            ? undefined
            : null,
        },
        select: { id: true },
      }),
    ])

    if (!property || !client) {
      redirect(withError(`/agency/visits/${id}/edit`, "Bien ou client introuvable"))
    }

    await prisma.visit.update({
      where: { id },
      data: {
        date: data.date,
        time: data.time,
        clientId: data.clientId,
        propertyId: data.propertyId,
        agentId: data.agentId,
        status: data.status,
        interestLevel: data.interestLevel,
        rating: data.rating,
        priceFeedback: data.priceFeedback,
        followUpDate: data.followUpDate,
        result: data.result,
        notes: data.notes,
      },
    })

    revalidatePath("/agency/visits")
    redirect(withSuccess("/agency/visits", "Visite mise à jour"))
  }

  /**
   * Suppression definitive d'une visite, alignee sur sa route d'API.
   *
   * Elle n'exigeait aucun role la ou `POST /api/visits/[id]/delete` reserve
   * le geste a l'administrateur, et n'ecrivait rien dans le journal
   * (BUG-32). `Visit` n'est pas un modele a suppression reversible : le
   * `delete()` reste, comme dans la route. Etendre la corbeille a ce modele
   * est la story 3.5, pas celle-ci.
   */
  async function deleteVisit() {
    "use server"
    const { agencyId, userId, userName } = await requireAgencyAdmin()
    const { id } = await params

    const owned = await prisma.visit.findFirst({
      where: { id, agencyId },
      select: {
        id: true,
        date: true,
        property: { select: { title: true } },
        client: { select: { firstName: true, lastName: true } },
      },
    })

    if (!owned) {
      redirect(withError("/agency/visits", "Visite introuvable"))
    }

    await prisma.visit.delete({ where: { id } })

    await recordAudit({
      agencyId,
      userId,
      userName,
      action: "suppression",
      entity: "visite",
      entityId: id,
      summary: `Visite de « ${owned.property.title} » par ${owned.client.firstName} ${owned.client.lastName} du ${formatDate(owned.date)} supprimée définitivement`,
    })

    revalidatePath("/agency/visits")
    redirect(withSuccess("/agency/visits", "Visite supprimée"))
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/agency/visits">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux visites
              </Link>
            </Button>
            <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Modifier la visite</h1>
            <p className="text-slate-600 mt-1">
              Renseignez le retour après la visite pour alimenter le suivi commercial.
            </p>
          </div>

          <FormMessage error={query.error} />

          <Card>
            <CardHeader>
              <CardTitle>Planification</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateVisit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      name="date"
                      type="date"
                      defaultValue={toDateInputValue(visit.date)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="time">Heure *</Label>
                    <Input
                      id="time"
                      name="time"
                      type="time"
                      defaultValue={visit.time}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clientId">Client *</Label>
                    <select
                      id="clientId"
                      name="clientId"
                      required
                      defaultValue={visit.clientId}
                      className={selectClass}
                    >
                      {contacts.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="propertyId">Bien *</Label>
                    <select
                      id="propertyId"
                      name="propertyId"
                      required
                      defaultValue={visit.propertyId}
                      className={selectClass}
                    >
                      {biens.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agentId">Agent</Label>
                    <select
                      id="agentId"
                      name="agentId"
                      defaultValue={visit.agentId ?? ""}
                      className={selectClass}
                    >
                      <option value="">Non assigné</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name ?? "Sans nom"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Statut *</Label>
                    <select
                      id="status"
                      name="status"
                      required
                      defaultValue={visit.status}
                      className={selectClass}
                    >
                      {Object.entries(VISIT_STATUS_LABELS).map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Retour structuré après visite */}
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">
                    Retour de visite
                  </h3>
                  <p className="text-sm text-slate-500 mb-4">
                    À renseigner une fois la visite effectuée. Ces informations
                    alimentent les statistiques et la liste des relances.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="interestLevel">Niveau d&apos;intérêt</Label>
                      <select
                        id="interestLevel"
                        name="interestLevel"
                        defaultValue={visit.interestLevel ?? ""}
                        className={selectClass}
                      >
                        <option value="">Non renseigné</option>
                        {Object.entries(INTEREST_LEVEL_LABELS).map(([value, text]) => (
                          <option key={value} value={value}>
                            {text}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rating">Note du bien (1 à 5)</Label>
                      <select
                        id="rating"
                        name="rating"
                        defaultValue={visit.rating ? String(visit.rating) : ""}
                        className={selectClass}
                      >
                        <option value="">Non noté</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {"★".repeat(n)} ({n}/5)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="followUpDate">Date de relance</Label>
                      <Input
                        id="followUpDate"
                        name="followUpDate"
                        type="date"
                        defaultValue={toDateInputValue(visit.followUpDate)}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-3">
                      <Label htmlFor="priceFeedback">Retour sur le prix</Label>
                      <Input
                        id="priceFeedback"
                        name="priceFeedback"
                        defaultValue={visit.priceFeedback ?? ""}
                        placeholder="Ex : prix jugé trop élevé, propose une négociation"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-3">
                      <Label htmlFor="result">Compte rendu de la visite</Label>
                      <Textarea
                        id="result"
                        name="result"
                        rows={3}
                        defaultValue={visit.result ?? ""}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes internes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    rows={2}
                    defaultValue={visit.notes ?? ""}
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="submit" className="bg-dar-ink hover:bg-dar-blue">
                    Enregistrer
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/agency/visits">Annuler</Link>
                  </Button>
                </div>
              </form>

              {/* Le bouton ne s'affiche qu'a qui peut l'actionner — et ce
                  n'est JAMAIS la mesure, seulement la seconde. Le refus est
                  pose dans l'action elle-meme, qui reste joignable en POST
                  sans cet ecran ; le masquage evite de proposer a un agent
                  un geste qui lui sera refuse. */}
              {isAgencyAdmin(userRole) && (
                <form action={deleteVisit} className="mt-8 border-t border-slate-200 pt-6">
                  <Button
                    type="submit"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer cette visite
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
