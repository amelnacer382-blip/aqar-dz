/**
 * Etat de l'abonnement d'une agence.
 *
 * Aqar DZ n'encaisse rien lui-meme : il n'y a ni carte bancaire ni
 * prelevement, et le paiement en ligne reste peu repandu en Algerie. Le
 * reglement se fait donc hors du logiciel, et l'editeur reporte la date
 * couverte sur la fiche de l'agence.
 *
 * Ce module ne fait qu'une chose : dire ou en est cette date. Il ne coupe
 * rien. Suspendre une agence reste une decision humaine, prise depuis la
 * console d'administration — un logiciel qui ferme la porte d'une agence
 * un dimanche matin sur un virement recu la veille ferait plus de mal que
 * de bien.
 */

/** En dessous de ce seuil, on previent l'agence. */
export const RENEWAL_NOTICE_DAYS = 15

export type SubscriptionState =
  /** Aucune echeance suivie : essai, ou compte offert. */
  | { kind: "untracked" }
  /** Reglee, et l'echeance est encore loin. */
  | { kind: "active"; endsAt: Date; daysLeft: number }
  /** Reglee, mais l'echeance approche. */
  | { kind: "expiring"; endsAt: Date; daysLeft: number }
  /** Depassee : l'agence travaille sans avoir renouvele. */
  | { kind: "expired"; endsAt: Date; daysOver: number }

/** Nombre de jours entiers entre deux dates, en ignorant les heures. */
function daysBetween(from: Date, to: Date): number {
  const startOfFrom = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate()
  )
  const startOfTo = new Date(to.getFullYear(), to.getMonth(), to.getDate())

  return Math.round((startOfTo.getTime() - startOfFrom.getTime()) / 86_400_000)
}

export function subscriptionState(
  endsAt: Date | null | undefined,
  now: Date = new Date()
): SubscriptionState {
  if (!endsAt) {
    return { kind: "untracked" }
  }

  const days = daysBetween(now, endsAt)

  // Le jour de l'echeance lui-meme est encore couvert : une agence qui a
  // paye « jusqu'au 31 » travaille le 31.
  if (days < 0) {
    return { kind: "expired", endsAt, daysOver: -days }
  }

  if (days <= RENEWAL_NOTICE_DAYS) {
    return { kind: "expiring", endsAt, daysLeft: days }
  }

  return { kind: "active", endsAt, daysLeft: days }
}

/** Phrase courte, telle qu'affichee a l'agence. */
export function subscriptionMessage(state: SubscriptionState): string | null {
  if (state.kind === "untracked" || state.kind === "active") {
    return null
  }

  if (state.kind === "expired") {
    return state.daysOver === 1
      ? "Votre abonnement a expiré hier."
      : `Votre abonnement a expiré il y a ${state.daysOver} jours.`
  }

  if (state.daysLeft === 0) return "Votre abonnement expire aujourd'hui."
  if (state.daysLeft === 1) return "Votre abonnement expire demain."

  return `Votre abonnement expire dans ${state.daysLeft} jours.`
}
