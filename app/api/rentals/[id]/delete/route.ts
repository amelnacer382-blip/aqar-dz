import { NextRequest, NextResponse } from "next/server"
import { getApiAgency, isAgencyAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { formatDZD } from "@/lib/format"

/**
 * Suppression d'un bail.
 *
 * C'est la suppression la plus lourde de l'application : detruire un bail
 * emporte, en cascade, tous ses mois de gestion locative — donc les
 * quittances deja emises. Le journal indique combien de mois ont disparu,
 * parce que c'est la seule question qu'on se posera ensuite.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await getApiAgency()

    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    if (!isAgencyAdmin(guard.userRole)) {
      return NextResponse.json(
        { error: "Seul l'administrateur de l'agence peut supprimer" },
        { status: 403 }
      )
    }

    const agencyId = guard.agencyId
    const { id } = await params

    const rental = await prisma.rental.findFirst({
      where: { id, agencyId },
      select: {
        id: true,
        monthlyRent: true,
        property: { select: { title: true } },
        client: { select: { firstName: true, lastName: true } },
        _count: { select: { rentalManagements: true } },
      },
    })

    if (!rental) {
      return NextResponse.json({ error: "Location non trouvée" }, { status: 404 })
    }

    const months = rental._count.rentalManagements

    await prisma.rental.delete({ where: { id } })

    await recordAudit({
      agencyId,
      userId: guard.userId,
      userName: guard.userName,
      action: "suppression",
      entity: "bail",
      entityId: id,
      summary:
        `Bail de « ${rental.property.title} » avec ${rental.client.firstName} ${rental.client.lastName} ` +
        `(${formatDZD(rental.monthlyRent)}/mois) supprimé définitivement` +
        (months > 0 ? `, avec ${months} mois de gestion locative` : ""),
    })

    return NextResponse.json({ message: "Location supprimée avec succès" })
  } catch (error) {
    console.error("Delete rental error:", error)
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    )
  }
}
