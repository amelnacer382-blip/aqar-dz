import React from "react"
import { NextResponse } from "next/server"
import { getApiAgency } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { PaymentReceiptPdf } from "@/lib/pdf/documents"
import { pdfResponse } from "@/lib/pdf/render"
import { formatDZD, formatDateLong } from "@/lib/format"
import {
  PAYMENT_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  label,
} from "@/lib/labels"

export const runtime = "nodejs"

/** Recu pour un paiement enregistre. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await getApiAgency()

  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const { id } = await params

  const payment = await prisma.payment.findFirst({
    where: { id, agencyId: guard.agencyId },
    include: { agency: true, client: true, owner: true, property: true },
  })

  if (!payment) {
    return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 })
  }

  // Le payeur depend de la nature du paiement : un reversement va vers le
  // proprietaire, les autres types viennent generalement du client.
  const payerName =
    payment.type === "paiement_proprietaire"
      ? payment.owner
        ? `${payment.owner.firstName} ${payment.owner.lastName}`
        : null
      : payment.client
        ? `${payment.client.firstName} ${payment.client.lastName}`
        : null

  const document = (
    <PaymentReceiptPdf
      agency={payment.agency}
      reference={payment.reference.slice(-10).toUpperCase()}
      amount={formatDZD(payment.amount)}
      typeLabel={label(PAYMENT_TYPE_LABELS, payment.type)}
      methodLabel={label(PAYMENT_METHOD_LABELS, payment.method)}
      statusLabel={label(PAYMENT_STATUS_LABELS, payment.status)}
      date={formatDateLong(payment.date)}
      payerName={payerName}
      propertyTitle={payment.property?.title ?? null}
      notes={payment.notes}
    />
  )

  return pdfResponse(document, `recu-${payment.reference.slice(-8)}.pdf`)
}
