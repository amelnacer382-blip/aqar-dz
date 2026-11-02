import { NextRequest, NextResponse } from "next/server"
import { getApiAgency, isAgencyAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { formatDate } from "@/lib/format"

/**
 * Suppression d'une visite.
 *
 * Reserve a l'administrateur, comme le reste — et cela ne gene pas
 * l'agent dans son quotidien : une visite qui n'a pas lieu se passe au
 * statut « annulee », ce qui garde la trace du rendez-vous manque dans
 * l'historique du client. La suppression, elle, l'efface.
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

    const visit = await prisma.visit.findFirst({
      where: { id, agencyId },
      select: {
        id: true,
        date: true,
        property: { select: { title: true } },
        client: { select: { firstName: true, lastName: true } },
      },
    })

    if (!visit) {
      return NextResponse.json({ error: "Visite non trouvée" }, { status: 404 })
    }

    await prisma.visit.delete({ where: { id } })

    await recordAudit({
      agencyId,
      userId: guard.userId,
      userName: guard.userName,
      action: "suppression",
      entity: "visite",
      entityId: id,
      summary: `Visite de « ${visit.property.title} » par ${visit.client.firstName} ${visit.client.lastName} du ${formatDate(visit.date)} supprimée définitivement`,
    })

    return NextResponse.json({ message: "Visite supprimée avec succès" })
  } catch (error) {
    console.error("Delete visit error:", error)
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    )
  }
}
