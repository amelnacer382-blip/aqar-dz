import { NextRequest, NextResponse } from "next/server"
import { getApiAgency, isAgencyAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { deleteFile } from "@/lib/storage"
import { documentKeyFor } from "@/lib/documents"

/**
 * Suppression d'un document.
 *
 * Un document n'a pas de corbeille : c'est un fichier, pas un dossier
 * metier avec un historique. La suppression est donc definitive, ce qui la
 * reserve d'autant plus a l'administrateur de l'agence, et la fait
 * inscrire au journal.
 *
 * Le fichier part du stockage en meme temps que la ligne. Sans cela,
 * chaque suppression laissait un fichier orphelin dans le bucket, facture
 * indefiniment et sans plus aucun moyen de le retrouver.
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

    const document = await prisma.document.findFirst({
      where: { id, agencyId },
      select: { id: true, name: true, url: true },
    })

    if (!document) {
      return NextResponse.json({ error: "Document non trouvé" }, { status: 404 })
    }

    await prisma.document.delete({ where: { id } })

    // Meme regle qu'a la lecture, et pour une raison plus forte : une
    // suppression ne se rattrape pas. Sans ce controle, une agence
    // pointait l'`url` de son document vers le fichier d'une autre —
    // photo de vitrine comprise — et le faisait effacer en supprimant le
    // sien (BUG-21).
    const key = await documentKeyFor(document.url, agencyId)
    if (key) {
      await deleteFile(key)
    }

    await recordAudit({
      agencyId,
      userId: guard.userId,
      userName: guard.userName,
      action: "suppression",
      entity: "document",
      entityId: id,
      summary: `Document « ${document.name} » supprimé définitivement`,
    })

    return NextResponse.json({ message: "Document supprimé avec succès" })
  } catch (error) {
    console.error("Delete document error:", error)
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    )
  }
}
