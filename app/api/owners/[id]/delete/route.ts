import { NextRequest, NextResponse } from "next/server"
import { getApiAgency, isAgencyAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"

/**
 * Mise a la corbeille d'un propriétaire.
 *
 * Ce n'est plus une suppression definitive : la ligne reste en base avec
 * une date de suppression, disparait des listes, et reste restaurable
 * depuis la corbeille. Un propriétaire supprime par erreur emportait avec lui
 * tout son historique.
 *
 * Reserve a l'administrateur de l'agence : un agent gere le quotidien, il
 * ne fait pas disparaitre de dossiers.
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

    const record = await prisma.owner.findFirst({
      where: { id, agencyId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    })

    if (!record) {
      return NextResponse.json({ error: "Propriétaire introuvable" }, { status: 404 })
    }

    await prisma.owner.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    await recordAudit({
      agencyId,
      userId: guard.userId,
      userName: guard.userName,
      action: "suppression",
      entity: "propriétaire",
      entityId: id,
      summary: `Propriétaire « ${`${record.firstName} ${record.lastName}`} » mis a la corbeille`,
    })

    return NextResponse.json({ message: "Propriétaire mis à la corbeille" })
  } catch (error) {
    console.error("Delete owner error:", error)
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    )
  }
}
