import { appUrl, emailLayout, sendMail } from "@/lib/mailer"
import type { Paragraphe } from "@/lib/mailer"

/**
 * Les emails que le logiciel envoie reellement.
 *
 * Chaque fonction est sans effet si SMTP n'est pas configure : elle
 * journalise et rend la main. Aucun appelant ne doit dependre de son
 * resultat pour la coherence de ses donnees.
 */

/** Un visiteur a ecrit depuis la vitrine publique de l'agence. */
export async function notifyAgencyOfLead({
  agencyEmail,
  agencyName,
  leadName,
  leadPhone,
  leadEmail,
  message,
  propertyTitle,
}: {
  agencyEmail: string
  agencyName: string
  leadName: string
  leadPhone: string | null
  leadEmail: string | null
  message: string | null
  propertyTitle?: string | null
}) {
  const coordonnees = [leadPhone, leadEmail].filter(Boolean).join(" · ")

  // Tout ce qui suit vient du formulaire public de la vitrine, ouvert
  // sans compte : le nom, le message, et le titre du bien choisi. Aucun
  // de ces morceaux n'est du HTML — `emailLayout` echappe, et c'est la
  // seule raison pour laquelle un « <a href> » poste par un visiteur
  // ressort en texte inerte (BUG-02).
  const morceaux: Array<Paragraphe | null> = [
    [{ fort: leadName }, " vous a écrit depuis votre vitrine en ligne."],
    propertyTitle ? ["Bien concerné : ", { fort: propertyTitle }] : null,
    coordonnees ? ["Pour le rappeler : ", { fort: coordonnees }] : null,
    message ? `« ${message} »` : null,
  ]

  const body = morceaux.filter((p): p is Paragraphe => p !== null)

  const { html, text } = emailLayout({
    title: "Nouveau message sur votre vitrine",
    body,
    actionLabel: "Ouvrir les messages reçus",
    actionUrl: `${appUrl()}/agency/leads`,
  })

  return sendMail({
    to: agencyEmail,
    subject: `${agencyName} — nouveau message de ${leadName}`,
    html,
    text,
  })
}

/** L'agence vient d'etre activee : elle peut se connecter. */
export async function notifyAgencyActivated({
  agencyEmail,
  agencyName,
}: {
  agencyEmail: string
  agencyName: string
}) {
  const { html, text } = emailLayout({
    // Le nom de l'agence vient du formulaire d'inscription : `title`
    // etait interpole brut dans le <h1>, ce que le registre ne relevait
    // pas. `emailLayout` l'echappe desormais.
    title: `${agencyName} est activée`,
    body: [
      "Votre agence vient d'être validée par l'équipe Aqar DZ.",
      "Vous pouvez désormais vous connecter à votre espace, ajouter vos biens et publier votre vitrine.",
    ],
    actionLabel: "Se connecter",
    actionUrl: `${appUrl()}/auth/login`,
  })

  return sendMail({
    to: agencyEmail,
    subject: "Votre agence est activée sur Aqar DZ",
    html,
    text,
  })
}

/**
 * Une agence vient de s'inscrire et attend d'etre activee.
 *
 * Sans cet email, une inscription restait invisible jusqu'a ce que
 * quelqu'un pense a ouvrir la console d'administration : l'agence
 * attendait devant une porte close sans que personne le sache.
 *
 * Les destinataires sont les super admins enregistres, pas une adresse
 * codee en dur : la liste suit l'equipe sans passer par une variable
 * d'environnement de plus.
 */
export async function notifyPlatformOfSignup({
  recipients,
  agencyName,
  agencyEmail,
  wilaya,
}: {
  recipients: string[]
  agencyName: string
  agencyEmail: string
  wilaya?: string | null
}) {
  if (recipients.length === 0) return false

  const morceaux: Array<Paragraphe | null> = [
    [{ fort: agencyName }, " vient de créer un compte."],
    wilaya ? ["Wilaya : ", { fort: wilaya }] : null,
    ["Contact : ", { fort: agencyEmail }],
    "Elle ne pourra pas se connecter tant que son compte n'est pas activé.",
  ]

  const { html, text } = emailLayout({
    title: "Nouvelle agence en attente d'activation",
    body: morceaux.filter((p): p is Paragraphe => p !== null),
    actionLabel: "Voir les agences",
    actionUrl: `${appUrl()}/admin/agencies`,
  })

  return sendMail({
    to: recipients.join(", "),
    subject: `Aqar DZ — inscription de ${agencyName}`,
    html,
    text,
  })
}

/** Lien de reinitialisation de mot de passe, valable une heure. */
export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: {
  to: string
  resetUrl: string
}) {
  const { html, text } = emailLayout({
    title: "Réinitialiser votre mot de passe",
    body: [
      "Vous avez demandé un nouveau mot de passe pour votre compte Aqar DZ.",
      ["Ce lien est valable ", { fort: "une heure" }, " et ne fonctionne qu'une seule fois."],
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe actuel reste valable.",
    ],
    actionLabel: "Choisir un nouveau mot de passe",
    actionUrl: resetUrl,
  })

  return sendMail({
    to,
    subject: "Réinitialiser votre mot de passe Aqar DZ",
    html,
    text,
  })
}
