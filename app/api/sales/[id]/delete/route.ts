import { NextRequest, NextResponse } from "next/server"
import { getApiAgency, isAgencyAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { formatDZD } from "@/lib/format"

/**
 * Suppression d'une vente.
 *
 * Une vente porte le prix final et la commission de l'agence : c'est la
 * ligne qui justifie ce que l'agence a gagne. Sa suppression est reservee
 * a l'administrateur et journalisee avec son montant.
 *
 * Les paiements rattaches ne sont pas detruits — leur lien vers la vente
 * est simplement coupe (onDelete: SetNull). Un encaissement reste un
 * encaissement meme si le dossier de vente est annule.
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

    const sale = await prisma.sale.findFirst({
      where: { id, agencyId },
      select: {
        id: true,
        finalPrice: true,
        property: { select: { title: true } },
        client: { select: { firstName: true, lastName: true } },
      },
    })

    if (!sale) {
      return NextResponse.json({ error: "Vente non trouvée" }, { status: 404 })
    }

    await prisma.sale.delete({ where: { id } })

    await recordAudit({
      agencyId,
      userId: guard.userId,
      userName: guard.userName,
      action: "suppression",
      entity: "vente",
      entityId: id,
      summary: `Vente de « ${sale.property.title} » à ${sale.client.firstName} ${sale.client.lastName} (${formatDZD(sale.finalPrice)}) supprimée définitivement`,
    })

    return NextResponse.json({ message: "Vente supprimée avec succès" })
  } catch (error) {
    console.error("Delete sale error:", error)
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    )
  }
}
