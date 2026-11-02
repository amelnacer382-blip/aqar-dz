import { NextRequest, NextResponse } from "next/server"
import { getApiAgency, isAgencyAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { formatDZD } from "@/lib/format"

/**
 * Suppression d'un paiement.
 *
 * Un paiement est une piece comptable : c'est ce qui atteste qu'un loyer a
 * ete encaisse. Le laisser disparaitre sans trace ni contrainte de role
 * rendait tout rapprochement impossible le jour ou un proprietaire
 * conteste un versement.
 *
 * Reserve a l'administrateur, et inscrit au journal avec son montant :
 * c'est le montant, pas l'identifiant, qu'on cherche dans ce cas-la.
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

    const payment = await prisma.payment.findFirst({
      where: { id, agencyId },
      select: { id: true, reference: true, amount: true },
    })

    if (!payment) {
      return NextResponse.json({ error: "Paiement non trouvé" }, { status: 404 })
    }

    await prisma.payment.delete({ where: { id } })

    await recordAudit({
      agencyId,
      userId: guard.userId,
      userName: guard.userName,
      action: "suppression",
      entity: "paiement",
      entityId: id,
      summary: `Paiement de ${formatDZD(payment.amount)} (${payment.reference}) supprimé définitivement`,
    })

    return NextResponse.json({ message: "Paiement supprimé avec succès" })
  } catch (error) {
    console.error("Delete payment error:", error)
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    )
  }
}
