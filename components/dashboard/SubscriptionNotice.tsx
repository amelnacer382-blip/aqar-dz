import { AlertTriangle, CalendarClock } from "lucide-react"
import { formatDateLong } from "@/lib/format"
import {
  subscriptionMessage,
  subscriptionState,
  type SubscriptionState,
} from "@/lib/subscription"

/**
 * Avis de renouvellement, sur le tableau de bord.
 *
 * L'agence ne doit pas apprendre que son abonnement est fini le jour ou sa
 * console se ferme. Elle est prevenue quinze jours avant, sur l'ecran
 * qu'elle ouvre chaque matin.
 *
 * Le bandeau ne s'affiche que lorsqu'il a quelque chose a dire : une
 * agence a jour ne voit rien. Un avertissement permanent finit par ne plus
 * etre lu.
 *
 * Il n'y a pas de bouton « payer » : le reglement se fait hors du
 * logiciel. Le bandeau donne donc ce qui sert vraiment — la date, et a qui
 * s'adresser.
 */
export function SubscriptionNotice({
  endsAt,
  contactEmail,
}: {
  endsAt: Date | null
  contactEmail: string
}) {
  const state: SubscriptionState = subscriptionState(endsAt)
  const message = subscriptionMessage(state)

  if (!message || state.kind === "untracked" || state.kind === "active") {
    return null
  }

  const expired = state.kind === "expired"

  return (
    <section
      role="status"
      className={`mt-6 flex flex-wrap items-start gap-4 rounded-2xl border p-5 sm:items-center ${
        expired
          ? "border-red-200 bg-red-50"
          : "border-dar-ochre/35 bg-[#FCF6EC]"
      }`}
    >
      <span
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
          expired ? "bg-red-100 text-red-600" : "bg-dar-ochre/15 text-dar-ochre"
        }`}
      >
        {expired ? (
          <AlertTriangle className="h-5 w-5" />
        ) : (
          <CalendarClock className="h-5 w-5" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={`font-medium ${expired ? "text-red-900" : "text-dar-ink"}`}
        >
          {message}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Couvert jusqu&apos;au {formatDateLong(state.endsAt)}. Pour
          renouveler par BaridiMob, CCP ou Virement bancaire,{" "}
          <a
            href="/agency/settings"
            className="font-medium text-dar-blue hover:underline"
          >
            consultez les coordonnées bancaires
          </a>{" "}
          ou écrivez-nous à{" "}
          <a
            href={`mailto:${contactEmail}`}
            className="font-medium text-dar-blue hover:underline"
          >
            {contactEmail}
          </a>
          .
        </p>
      </div>
    </section>
  )
}
