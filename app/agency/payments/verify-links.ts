import { prisma } from "@/lib/prisma"
import { lienInchange } from "@/lib/corbeille"

type PaymentLinks = {
  propertyId: string | null
  clientId: string | null
  ownerId: string | null
  rentalId: string | null
  saleId: string | null
}

/**
 * Verifie que chaque entite rattachee a un paiement appartient a l'agence.
 *
 * Sans ce controle, un identifiant devine dans le formulaire permettrait de
 * lier un paiement a un bien ou un client d'une autre agence, et de faire
 * fuiter son nom dans la liste des paiements.
 */
export async function verifyPaymentLinks(
  agencyId: string,
  links: PaymentLinks,
  /**
   * Les liens DEJA portes par la ligne, a la modification.
   *
   * Un lien inchange n'est pas reverifie contre le filtre de corbeille :
   * il a ete verifie quand il a ete ecrit, et le rejeter rendrait la fiche
   * impossible a enregistrer des que son parent part a la corbeille — le
   * defaut que la revue de la story 3.9 a releve. A la creation, il n'y a
   * rien de courant : tout est verifie normalement.
   */
  courants: Partial<PaymentLinks> = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (links.propertyId) {
    const found = await prisma.property.findFirst({
      where: {
        id: links.propertyId,
        agencyId,
        deletedAt: lienInchange(links.propertyId, courants.propertyId)
          ? undefined
          : null,
      },
      select: { id: true },
    })
    if (!found) return { ok: false, error: "Bien introuvable" }
  }

  if (links.clientId) {
    const found = await prisma.client.findFirst({
      where: {
        id: links.clientId,
        agencyId,
        deletedAt: lienInchange(links.clientId, courants.clientId)
          ? undefined
          : null,
      },
      select: { id: true },
    })
    if (!found) return { ok: false, error: "Client introuvable" }
  }

  if (links.ownerId) {
    const found = await prisma.owner.findFirst({
      where: {
        id: links.ownerId,
        agencyId,
        deletedAt: lienInchange(links.ownerId, courants.ownerId)
          ? undefined
          : null,
      },
      select: { id: true },
    })
    if (!found) return { ok: false, error: "Proprietaire introuvable" }
  }

  if (links.rentalId) {
    const found = await prisma.rental.findFirst({
      where: { id: links.rentalId, agencyId },
      select: { id: true },
    })
    if (!found) return { ok: false, error: "Bail introuvable" }
  }

  if (links.saleId) {
    const found = await prisma.sale.findFirst({
      where: { id: links.saleId, agencyId },
      select: { id: true },
    })
    if (!found) return { ok: false, error: "Vente introuvable" }
  }

  return { ok: true }
}
