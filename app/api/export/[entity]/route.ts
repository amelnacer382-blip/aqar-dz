import { NextRequest, NextResponse } from "next/server"
import { getApiAgency } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { toCsv, csvHeaders } from "@/lib/csv"
import { readSearch, textSearch, dealSearch } from "@/lib/list-params"
import {
  PROPERTY_TYPE_LABELS,
  PROPERTY_STATUS_LABELS,
  CLIENT_STATUS_LABELS,
  label,
} from "@/lib/labels"

/**
 * Export CSV des listes de l'agence.
 *
 * L'export porte sur la selection courante — meme recherche que l'ecran,
 * pas de pagination : une agence qui filtre puis exporte s'attend a
 * retrouver exactement ce qu'elle voyait, en entier.
 *
 * L'agence est toujours celle de la session : `entity` ne choisit que le
 * type de donnees, jamais le perimetre.
 */
export const runtime = "nodejs"

const EXPORTABLE = [
  "properties",
  "clients",
  "owners",
  "payments",
  "visits",
  "leads",
  "sales",
  "rentals",
] as const

type Exportable = (typeof EXPORTABLE)[number]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const guard = await getApiAgency()

  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const { entity } = await params

  if (!EXPORTABLE.includes(entity as Exportable)) {
    return NextResponse.json({ error: "Export inconnu" }, { status: 404 })
  }

  const agencyId = guard.agencyId
  const q = readSearch({
    q: request.nextUrl.searchParams.get("q") ?? undefined,
  })

  switch (entity as Exportable) {
    case "properties": {
      const rows = await prisma.property.findMany({
        where: {
          agencyId,
          deletedAt: null,
          ...(textSearch(q, ["title", "reference", "wilaya", "commune", "address"]) ??
            {}),
        },
        orderBy: { createdAt: "desc" },
        include: { owner: { select: { firstName: true, lastName: true } } },
      })

      return new NextResponse(
        toCsv(
          [
            "Référence",
            "Titre",
            "Type",
            "Statut",
            "Opération",
            "Wilaya",
            "Commune",
            "Surface (m²)",
            "Chambres",
            "Prix vente (DA)",
            "Loyer (DA/mois)",
            "Propriétaire",
            "Créé le",
          ],
          rows.map((p) => [
            p.reference,
            p.title,
            label(PROPERTY_TYPE_LABELS, p.type),
            label(PROPERTY_STATUS_LABELS, p.status),
            p.operationType,
            p.wilaya,
            p.commune,
            p.surface,
            p.bedrooms,
            p.salePrice ? Number(p.salePrice) : null,
            p.rentPrice ? Number(p.rentPrice) : null,
            p.owner ? `${p.owner.firstName} ${p.owner.lastName}` : null,
            p.createdAt,
          ])
        ),
        { headers: csvHeaders("biens") }
      )
    }

    case "clients": {
      const rows = await prisma.client.findMany({
        where: {
          agencyId,
          deletedAt: null,
          ...(textSearch(q, ["firstName", "lastName", "phone", "email", "wilaya"]) ??
            {}),
        },
        orderBy: { createdAt: "desc" },
      })

      return new NextResponse(
        toCsv(
          [
            "Nom",
            "Prénom",
            "Téléphone",
            "Email",
            "Type",
            "Statut",
            "Budget (DA)",
            "Wilaya recherchée",
            "Créé le",
          ],
          rows.map((c) => [
            c.lastName,
            c.firstName,
            c.phone,
            c.email,
            c.type,
            label(CLIENT_STATUS_LABELS, c.status),
            c.budget ? Number(c.budget) : null,
            c.wilaya,
            c.createdAt,
          ])
        ),
        { headers: csvHeaders("clients") }
      )
    }

    case "owners": {
      const rows = await prisma.owner.findMany({
        where: {
          agencyId,
          deletedAt: null,
          ...(textSearch(q, ["firstName", "lastName", "phone", "email"]) ?? {}),
        },
        orderBy: { createdAt: "desc" },
        // `deletedAt: null` ci-dessus ne descend pas dans le `_count` :
        // l'extension de `lib/prisma.ts` ne filtre que le premier niveau.
        // Sans la condition portee ici, le CSV annoncerait un nombre de
        // biens que l'ecran ne montre pas (BUG-24, story 3.5).
        include: {
          _count: { select: { properties: { where: { deletedAt: null } } } },
        },
      })

      return new NextResponse(
        toCsv(
          ["Nom", "Prénom", "Téléphone", "Email", "Adresse", "Biens", "Créé le"],
          rows.map((o) => [
            o.lastName,
            o.firstName,
            o.phone,
            o.email,
            o.address,
            o._count.properties,
            o.createdAt,
          ])
        ),
        { headers: csvHeaders("proprietaires") }
      )
    }

    case "payments": {
      const rows = await prisma.payment.findMany({
        where: {
          agencyId,
          ...(textSearch(q, ["reference", "notes"]) ?? {}),
        },
        orderBy: { date: "desc" },
      })

      return new NextResponse(
        toCsv(
          ["Référence", "Date", "Type", "Méthode", "Statut", "Montant (DA)", "Notes"],
          rows.map((p) => [
            p.reference,
            p.date,
            p.type,
            p.method,
            p.status,
            Number(p.amount),
            p.notes,
          ])
        ),
        { headers: csvHeaders("paiements") }
      )
    }

    case "visits": {
      const rows = await prisma.visit.findMany({
        where: { agencyId, ...(dealSearch(q) ?? {}) },
        orderBy: { date: "desc" },
        include: {
          client: { select: { firstName: true, lastName: true } },
          property: { select: { title: true, reference: true } },
        },
      })

      return new NextResponse(
        toCsv(
          ["Date", "Heure", "Client", "Bien", "Référence", "Statut", "Intérêt", "Note", "Relance"],
          rows.map((v) => [
            v.date,
            v.time,
            `${v.client.firstName} ${v.client.lastName}`,
            v.property.title,
            v.property.reference,
            v.status,
            v.interestLevel,
            v.rating,
            v.followUpDate,
          ])
        ),
        { headers: csvHeaders("visites") }
      )
    }

    case "leads": {
      const rows = await prisma.lead.findMany({
        where: {
          agencyId,
          ...(textSearch(q, ["firstName", "lastName", "phone", "email", "message"]) ??
            {}),
        },
        orderBy: { createdAt: "desc" },
        include: { property: { select: { title: true } } },
      })

      return new NextResponse(
        toCsv(
          ["Reçu le", "Nom", "Prénom", "Téléphone", "Email", "Bien", "Statut", "Message"],
          rows.map((l) => [
            l.createdAt,
            l.lastName,
            l.firstName,
            l.phone,
            l.email,
            l.property?.title,
            l.status,
            l.message,
          ])
        ),
        { headers: csvHeaders("messages-vitrine") }
      )
    }

    case "sales": {
      const rows = await prisma.sale.findMany({
        where: { agencyId, ...(dealSearch(q) ?? {}) },
        orderBy: { saleDate: "desc" },
        include: {
          property: { select: { title: true, reference: true } },
          client: { select: { firstName: true, lastName: true } },
          owner: { select: { firstName: true, lastName: true } },
        },
      })

      return new NextResponse(
        toCsv(
          [
            "Date",
            "Référence bien",
            "Bien",
            "Acquéreur",
            "Vendeur",
            "Statut",
            "Prix final (DA)",
            "Commission (DA)",
          ],
          rows.map((s) => [
            s.saleDate,
            s.property.reference,
            s.property.title,
            `${s.client.firstName} ${s.client.lastName}`,
            s.owner ? `${s.owner.firstName} ${s.owner.lastName}` : null,
            s.status,
            Number(s.finalPrice),
            s.commission ? Number(s.commission) : null,
          ])
        ),
        { headers: csvHeaders("ventes") }
      )
    }

    case "rentals": {
      const rows = await prisma.rental.findMany({
        where: { agencyId, ...(dealSearch(q) ?? {}) },
        orderBy: { startDate: "desc" },
        include: {
          property: { select: { title: true, reference: true } },
          client: { select: { firstName: true, lastName: true } },
          owner: { select: { firstName: true, lastName: true } },
        },
      })

      return new NextResponse(
        toCsv(
          [
            "Début",
            "Fin",
            "Référence bien",
            "Bien",
            "Locataire",
            "Propriétaire",
            "Statut",
            "Loyer (DA/mois)",
            "Dépôt (DA)",
            "Honoraires (DA)",
          ],
          rows.map((r) => [
            r.startDate,
            r.endDate,
            r.property.reference,
            r.property.title,
            `${r.client.firstName} ${r.client.lastName}`,
            r.owner ? `${r.owner.firstName} ${r.owner.lastName}` : null,
            r.status,
            Number(r.monthlyRent),
            r.deposit ? Number(r.deposit) : null,
            r.agencyFees ? Number(r.agencyFees) : null,
          ])
        ),
        { headers: csvHeaders("baux") }
      )
    }
  }
}
