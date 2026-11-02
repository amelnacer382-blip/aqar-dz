import { prisma } from "@/lib/prisma"

/**
 * Journal des actions consequentes.
 *
 * On n'enregistre pas tout : une consultation n'interesse personne. Sont
 * tracees les actions qui font disparaitre ou changer de main quelque
 * chose — suppression, restauration, changement de statut, gestion des
 * comptes. C'est ce qu'on cherche quand un bien « a disparu ».
 *
 * L'ecriture ne fait jamais echouer l'action metier : un journal muet vaut
 * mieux qu'une suppression bloquee parce que le journal est indisponible.
 */
export type AuditAction =
  | "suppression"
  | "restauration"
  | "changement_statut"
  | "creation_compte"
  | "modification_compte"
  | "desactivation_compte"
  | "reinitialisation_mot_de_passe"

export async function recordAudit({
  agencyId,
  userId,
  userName,
  action,
  entity,
  entityId,
  summary,
}: {
  agencyId?: string | null
  userId?: string | null
  userName?: string | null
  action: AuditAction
  /** Nom metier de l'objet : bien, client, proprietaire, agence, compte. */
  entity: string
  entityId?: string | null
  /** Phrase lisible, affichee telle quelle dans le journal. */
  summary: string
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        agencyId: agencyId ?? null,
        userId: userId ?? null,
        userName: userName ?? null,
        action,
        entity,
        entityId: entityId ?? null,
        summary,
      },
    })
  } catch (error) {
    console.error("[audit] enregistrement impossible", error)
  }
}
