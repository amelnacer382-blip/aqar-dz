import type { Metadata } from "next"
import { requireAgency } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { FormMessage } from "@/components/FormMessage"
import {
  DashboardHeader,
  type Alert,
} from "@/components/dashboard/DashboardHeader"
import { PortfolioPanel, RegisterPanel } from "@/components/dashboard/Portfolio"
import { SubscriptionNotice } from "@/components/dashboard/SubscriptionNotice"
import {
  RecentProperties,
  type PropertyRow,
} from "@/components/dashboard/RecentProperties"
import {
  UpcomingVisits,
  type VisitRow,
} from "@/components/dashboard/UpcomingVisits"
import { formatDZD } from "@/lib/format"
import { OPERATION_TYPE_LABELS, label } from "@/lib/labels"

export const metadata: Metadata = { title: "Tableau de bord" }

/**
 * Adresse a laquelle une agence ecrit pour renouveler son abonnement.
 * Reprise de l'adresse d'expedition configuree, pour n'avoir qu'un seul
 * endroit a changer le jour ou elle change.
 */
const SUPPORT_EMAIL =
  process.env.SUPPORT_EMAIL ?? "contact@aqar.dz"

/** « Bonjour » jusqu'a 18 h, « Bonsoir » ensuite. */
function greetingFor(hour: number): string {
  return hour < 18 ? "Bonjour" : "Bonsoir"
}

/**
 * Etiquette de jour d'un rendez-vous.
 *
 * « Aujourd'hui » et « Demain » plutot qu'une date : c'est ainsi qu'on
 * parle d'un rendez-vous proche, et cela evite de compter les jours de
 * tete. Au-dela, la date courte suffit.
 */
function dayLabelFor(date: Date, today: Date): string {
  const days = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      today.getTime()) /
      86_400_000
  )

  if (days <= 0) return "Auj."
  if (days === 1) return "Demain"

  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
  }).format(date)
}

/**
 * Tableau de bord de l'agence.
 *
 * Il repond a une question et une seule : qu'est-ce qui demande mon
 * attention ce matin ? Les totaux (biens, clients, visites) ne bougent pas
 * d'un jour a l'autre et n'appellent aucune action ; ils sont donc passes
 * au second rang, au profit de quatre compteurs qui, eux, changent tous
 * les jours et menent chacun vers l'ecran ou l'on agit.
 *
 * Toutes les valeurs sont mises en forme ici, cote serveur, et transmises
 * en chaines : les composants d'affichage ne calculent rien, et aucune
 * date ni aucun montant ne peut differer entre le rendu serveur et le
 * rendu navigateur.
 */
export default async function AgencyDashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  // Le tableau de bord est l'ecran de RETOMBEE : `requireAgencyAdmin()`
  // y renvoie un agent qui demande une page reservee, avec le motif en
  // parametre. Il ne lisait pas ce parametre — le message voyageait dans
  // la barre d'adresse et n'arrivait nulle part.
  const message = await searchParams
  const { agencyId, agency, userRole, userName } = await requireAgency()

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTomorrow = new Date(startOfToday)
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)

  const [
    totalProperties,
    propertiesByStatus,
    totalClients,
    totalOwners,
    totalVisits,
    visitsToday,
    followUpsDue,
    newLeads,
    unpaidPayments,
    recentProperties,
    upcomingVisits,
  ] = await Promise.all([
    prisma.property.count({ where: { agencyId } }),
    prisma.property.groupBy({
      by: ["status"],
      where: { agencyId },
      _count: { _all: true },
    }),
    prisma.client.count({ where: { agencyId } }),
    prisma.owner.count({ where: { agencyId } }),
    prisma.visit.count({ where: { agencyId } }),

    // --- Les quatre compteurs du bandeau ---
    prisma.visit.count({
      where: {
        agencyId,
        status: "prevue",
        date: { gte: startOfToday, lt: startOfTomorrow },
      },
    }),
    // Meme definition que l'ecran des visites : une relance est due des que
    // sa date est passee et que la visite a bien eu lieu.
    prisma.visit.count({
      where: { agencyId, status: "effectuee", followUpDate: { lte: now } },
    }),
    prisma.lead.count({ where: { agencyId, status: "nouveau" } }),
    prisma.payment.count({ where: { agencyId, status: "impaye" } }),

    prisma.property.findMany({
      where: { agencyId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        operationType: true,
        wilaya: true,
        commune: true,
        salePrice: true,
        rentPrice: true,
        images: { take: 1, orderBy: { isMain: "desc" }, select: { url: true } },
      },
    }),
    prisma.visit.findMany({
      where: { agencyId, status: "prevue", date: { gte: startOfToday } },
      orderBy: [{ date: "asc" }, { time: "asc" }],
      take: 5,
      select: {
        id: true,
        date: true,
        time: true,
        client: { select: { firstName: true, lastName: true, phone: true } },
        property: { select: { title: true } },
      },
    }),
  ])

  const alerts: Alert[] = [
    {
      key: "visites",
      value: visitsToday,
      label: "Visites aujourd'hui",
      detail: visitsToday > 0 ? "à honorer" : "rien de prévu",
      href: "/agency/visits",
      tone: "today",
    },
    {
      key: "relances",
      value: followUpsDue,
      label: "Relances à faire",
      detail: followUpsDue > 0 ? "échéance atteinte" : "aucune en attente",
      href: "/agency/visits",
      tone: "waiting",
    },
    {
      key: "messages",
      value: newLeads,
      label: "Messages reçus",
      detail: newLeads > 0 ? "non traités" : "tout est traité",
      href: "/agency/leads",
      tone: "waiting",
    },
    {
      key: "impayes",
      value: unpaidPayments,
      label: "Paiements impayés",
      detail: unpaidPayments > 0 ? "à recouvrer" : "rien en souffrance",
      href: "/agency/payments?status=impaye",
      tone: "late",
    },
  ]

  const properties: PropertyRow[] = recentProperties.map((property) => ({
    id: property.id,
    title: property.title,
    operationLabel: label(OPERATION_TYPE_LABELS, property.operationType),
    location: `${property.wilaya}, ${property.commune}`,
    priceLabel: property.salePrice
      ? formatDZD(property.salePrice)
      : property.rentPrice
        ? `${formatDZD(property.rentPrice)}/mois`
        : null,
    imageUrl: property.images[0]?.url ?? null,
  }))

  const visits: VisitRow[] = upcomingVisits.map((visit) => ({
    id: visit.id,
    clientName: `${visit.client.firstName} ${visit.client.lastName}`,
    clientPhone: visit.client.phone,
    propertyTitle: visit.property.title,
    dayLabel: dayLabelFor(visit.date, startOfToday),
    time: visit.time,
    isToday: visit.date < startOfTomorrow,
  }))

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash min-h-screen pt-16">
        <div className="container mx-auto max-w-[1400px] px-4 py-8 sm:py-10">
          <DashboardHeader
            greeting={greetingFor(now.getHours())}
            agencyName={agency.name}
            dateLabel={new Intl.DateTimeFormat("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(now)}
            alerts={alerts}
          />

          <FormMessage error={message.error} success={message.success} />

          {/* Ne s'affiche que dans les quinze derniers jours, ou apres
              l'echeance. Une agence a jour ne voit rien. */}
          <SubscriptionNotice
            endsAt={agency.subscriptionEndsAt}
            contactEmail={SUPPORT_EMAIL}
          />

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <PortfolioPanel
                total={totalProperties}
                slices={propertiesByStatus.map((row) => ({
                  status: row.status,
                  count: row._count._all,
                }))}
              />
            </div>

            <RegisterPanel
              lines={[
                { label: "Clients suivis", value: totalClients, href: "/agency/clients" },
                { label: "Propriétaires", value: totalOwners, href: "/agency/owners" },
                { label: "Visites enregistrées", value: totalVisits, href: "/agency/visits" },
              ]}
            />
          </div>

          {/* items-start : les deux panneaux n'ont pas le meme nombre de
              lignes, et les etirer a la meme hauteur creusait un grand vide
              sous le plus court. Chacun prend la hauteur de son contenu. */}
          <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <RecentProperties properties={properties} />
            <UpcomingVisits visits={visits} />
          </div>
        </div>
      </main>
    </>
  )
}
