"use server"

import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { leadSchema } from "@/lib/validations"
import { parseForm, withError, withSuccess } from "@/lib/form"
import { notifyAgencyOfLead } from "@/lib/notifications"
import { callerIp, rateLimit, cleDeCompteur } from "@/lib/rate-limit"

/**
 * Enregistre un message envoye depuis la vitrine publique.
 *
 * Cette action est accessible sans authentification : on ne fait donc
 * confiance a aucune donnee postee. L'agence est resolue par son slug,
 * et le bien eventuel doit lui appartenir.
 */
export async function submitLead(formData: FormData) {
  const slug = String(formData.get("slug") ?? "")
  const returnTo = String(formData.get("returnTo") ?? `/vitrine/${slug}`)

  // Piege a robots : un champ invisible pour un humain, rempli par les bots.
  if (String(formData.get("website") ?? "") !== "") {
    redirect(withSuccess(returnTo, "Message envoye"))
  }

  // Le piege ci-dessus ne retient que les robots naifs. Cinq messages par
  // heure et par adresse : un visiteur n'ecrit pas six fois a la meme
  // agence, et l'agence ne recoit pas une boite pleine de faux contacts.
  //
  // La limite porte sur l'adresse seule, pas sur l'agence : une agence
  // populaire ne doit pas voir son formulaire ferme parce qu'elle recoit
  // beaucoup de messages legitimes.
  const ip = await callerIp()
  const flood = rateLimit({
    key: cleDeCompteur("vitrine", ip),
    limit: 5,
    windowMs: 60 * 60 * 1000,
  })

  if (!flood.ok) {
    redirect(
      withError(
        returnTo,
        "Vous avez envoyé plusieurs messages récemment. Réessayez dans un moment ou appelez directement l'agence."
      )
    )
  }

  const agency = await prisma.agency.findFirst({
    where: { slug, status: "active", showcaseEnabled: true },
    // name et email servent a prevenir l'agence du message recu.
    select: { id: true, name: true, email: true },
  })

  if (!agency) {
    redirect(withError(returnTo, "Cette agence n'accepte pas de messages"))
  }

  const parsed = parseForm(leadSchema, formData)

  if (!parsed.ok) {
    redirect(withError(returnTo, parsed.message))
  }

  const data = parsed.data

  if (!data.phone && !data.email) {
    redirect(
      withError(returnTo, "Indiquez au moins un telephone ou un email pour etre recontacte")
    )
  }

  /*
    Un bien reference doit appartenir a cette agence et etre publie.

    LE TITRE EST LU ICI, ET PAS PLUS BAS (story 3.5). Cette action relisait
    le meme bien apres coup, par `findUnique`, pour l'annoncer dans l'email
    de notification. C'etait le DERNIER `findUnique` du produit portant sur
    un modele a corbeille — l'angle mort que `lib/prisma.ts` documente et
    ne couvre pas : Prisma n'accepte que des champs uniques dans son
    `where`, donc l'extension ne peut pas y ajouter `deletedAt: null`.

    Le selectionner ici supprime l'angle mort ET une requete : ce
    `findFirst`, lui, est filtre.
  */
  let propertyId: string | null = null
  let propertyTitle: string | undefined

  if (data.propertyId) {
    const property = await prisma.property.findFirst({
      where: { id: data.propertyId, agencyId: agency.id },
      select: { id: true, title: true },
    })
    propertyId = property?.id ?? null
    propertyTitle = property?.title
  }

  await prisma.lead.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email,
      message: data.message,
      propertyId,
      agencyId: agency.id,
    },
  })

  // Prevenir l'agence. L'envoi ne conditionne rien : le message est deja
  // enregistre et visible dans « Messages recus » meme sans email.
  await notifyAgencyOfLead({
    agencyEmail: agency.email,
    agencyName: agency.name,
    leadName: `${data.firstName} ${data.lastName}`.trim(),
    leadPhone: data.phone,
    leadEmail: data.email,
    message: data.message,
    propertyTitle,
  })

  redirect(
    withSuccess(
      returnTo,
      "Votre message a bien ete envoye. L'agence vous recontactera rapidement."
    )
  )
}
