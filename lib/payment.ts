/**
 * Modalités de paiement pour le marché algérien (BaridiMob, CCP, Virement bancaire).
 *
 * En Algérie, les abonnements B2B se règlent par BaridiMob, versement CCP,
 * virement bancaire ou chèque. Ce module centralise les coordonnées officielles
 * et génère les liens WhatsApp pour l'envoi des reçus de paiement.
 */

export type PaymentDetails = {
  baridimobRip: string
  ccpNumber: string
  ccpKey: string
  bankName: string
  bankRib: string
  beneficiary: string
  supportPhone: string
  supportWhatsapp: string
  supportEmail: string
}

export function getPaymentDetails(): PaymentDetails {
  return {
    baridimobRip: process.env.PAYMENT_BARIDIMOB_RIP || "007 99999 0000000000 00",
    ccpNumber: process.env.PAYMENT_CCP_NUMBER || "00000000",
    ccpKey: process.env.PAYMENT_CCP_KEY || "00",
    bankName: process.env.PAYMENT_BANK_NAME || "Banque Nationale d'Algérie (BNA)",
    bankRib: process.env.PAYMENT_BANK_RIB || "001 00000 0000000000 00",
    beneficiary: process.env.PAYMENT_BENEFICIARY || "Aqar DZ",
    supportPhone: process.env.SUPPORT_PHONE || "0652 67 01 51",
    supportWhatsapp: process.env.SUPPORT_WHATSAPP || "213652670151",
    supportEmail: process.env.SUPPORT_EMAIL || "contact@aqar.dz",
  }
}

/**
 * Génère le lien WhatsApp pré-rempli pour transmettre le reçu de versement.
 */
export function buildPaymentWhatsAppUrl({
  agencyName,
  planName,
  amount,
}: {
  agencyName: string
  planName: string
  amount?: string
}): string {
  const details = getPaymentDetails()
  const cleanPhone = details.supportWhatsapp.replace(/[^0-9]/g, "")
  const message = [
    `Bonjour Aqar DZ,`,
    `Je souhaite renouveler l'abonnement de mon agence immobilière "${agencyName}".`,
    `Offre choisie : ${planName}${amount ? ` (${amount} DA/mois)` : ""}.`,
    `Veuillez trouver ci-joint mon reçu de paiement (BaridiMob / CCP / Virement).`,
    `Merci de bien vouloir valider le compte.`,
  ].join("\n")

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
}
