"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireAgency, isAgencyAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { interactionSchema } from "@/lib/validations"
import { parseForm, withError, withSuccess } from "@/lib/form"
import { INTERACTION_TYPE_LABELS, label } from "@/lib/labels"

/**
 * Ajoute une interaction a la fiche d'un client ou d'un proprietaire.
 * L'interaction est toujours rattachee a l'un des deux, jamais aux deux.
 */
export async function createInteraction(formData: FormData) {
  const { agencyId, userId } = await requireAgency()

  const returnTo = (formData.get("returnTo") as string) || "/agency/clients"
  const parsed = parseForm(interactionSchema, formData)

  if (!parsed.ok) {
    redirect(withError(returnTo, parsed.message))
  }

  const data = parsed.data

  if (!data.clientId && !data.ownerId) {
    redirect(withError(returnTo, "L'interaction doit etre rattachee a un contact"))
  }

  // Le contact doit appartenir a l'agence.
  if (data.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, agencyId },
      select: { id: true },
    })
    if (!client) {
      redirect(withError(returnTo, "Client introuvable"))
    }
  }

  if (data.ownerId) {
    const owner = await prisma.owner.findFirst({
      where: { id: data.ownerId, agencyId },
      select: { id: true },
    })
    if (!owner) {
      redirect(withError(returnTo, "Proprietaire introuvable"))
    }
  }

  await prisma.interaction.create({
    data: {
      type: data.type,
      subject: data.subject,
      content: data.content,
      date: data.date,
      clientId: data.clientId,
      ownerId: data.ownerId,
      authorId: userId,
      agencyId,
    },
  })

  revalidatePath(returnTo)
  redirect(withSuccess(returnTo, "Interaction ajoutee a l'historique"))
}

/**
 * Suppression d'une ligne d'historique de contact.
 *
 * ELLE RESTE OUVERTE A L'AGENT, et c'est une decision, pas un oubli — la
 * seule des cinq Server Actions destructives de BUG-32 a ne pas recevoir
 * `requireAgencyAdmin()`. Tranchee le 12-08-2026 par delegation explicite
 * de l'editeur.
 *
 * Le motif : une interaction est une ligne d'historique saisie par l'agent
 * LUI-MEME. La reserver rendrait une faute de frappe ineffacable pour celui
 * qui vient de la commettre, ce qui pousse a contourner l'outil — et un
 * historique qu'on n'ose plus corriger cesse d'etre tenu.
 *
 * MAIS LE MOTIF NE PORTE QUE SUR SES PROPRES LIGNES, et la premiere version
 * de cette correction ne le disait qu'en commentaire : le code, lui,
 * laissait un agent effacer n'importe quelle interaction de l'agence —
 * celle de son administrateur, celle d'un collegue, une ligne vieille de
 * deux ans. La revue du 12-08-2026 a releve l'ecart entre la justification
 * ecrite et la regle appliquee. C'est la justification qui avait raison :
 * le controle d'auteur est pose ici.
 *
 * L'administrateur, lui, efface tout — c'est deja sa regle sur les quatre
 * autres suppressions.
 *
 * Le journal d'audit reste la contrepartie de cette permission.
 */
export async function deleteInteraction(formData: FormData) {
  const { agencyId, userId, userRole, userName } = await requireAgency()

  const id = formData.get("id") as string
  const returnTo = (formData.get("returnTo") as string) || "/agency/clients"

  const interaction = await prisma.interaction.findFirst({
    where: { id, agencyId },
    select: { id: true, type: true, subject: true, authorId: true },
  })

  if (!interaction) {
    redirect(withError(returnTo, "Interaction introuvable"))
  }

  // « Introuvable » serait un mensonge : la ligne est sous ses yeux, dans
  // l'historique qu'il vient de lire. On dit la regle.
  //
  // Une ligne sans auteur — il n'y en a aucune aujourd'hui, `createInteraction`
  // pose `authorId` depuis toujours — n'appartient a personne : elle releve
  // de l'administrateur.
  if (!isAgencyAdmin(userRole) && interaction.authorId !== userId) {
    redirect(
      withError(
        returnTo,
        "Vous ne pouvez supprimer que les interactions que vous avez saisies"
      )
    )
  }

  await prisma.interaction.delete({ where: { id } })

  await recordAudit({
    agencyId,
    userId,
    userName,
    action: "suppression",
    entity: "interaction",
    entityId: id,
    summary: `Interaction « ${interaction.subject} » (${label(INTERACTION_TYPE_LABELS, interaction.type)}) supprimée définitivement`,
  })

  revalidatePath(returnTo)
  redirect(withSuccess(returnTo, "Interaction supprimee"))
}
