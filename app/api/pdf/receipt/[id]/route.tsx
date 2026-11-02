import React from "react"
import { NextResponse } from "next/server"
import { getApiAgency } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { RentReceiptPdf } from "@/lib/pdf/documents"
import { pdfResponse } from "@/lib/pdf/render"
import { formatDZD, formatDate, periodLabel, toNumber } from "@/lib/format"

export const runtime = "nodejs"

/** Quittance de loyer pour un mois de gestion locative. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await getApiAgency()

  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const { id } = await params

  const record = await prisma.rentalManagement.findFirst({
    where: { id, rental: { agencyId: guard.agencyId } },
    include: {
      rental: {
        include: {
          agency: true,
          client: true,
          owner: true,
          property: true,
        },
      },
    },
  })

  if (!record) {
    return NextResponse.json({ error: "Quittance introuvable" }, { status: 404 })
  }

  const { rental } = record
  const { property, client, owner, agency } = rental

  const total =
    toNumber(record.rentAmount) + toNumber(record.charges)

  const netToOwner =
    toNumber(record.rentAmount) +
    toNumber(record.charges) -
    toNumber(record.expenses) -
    toNumber(record.commission)

  const period = periodLabel(record.month, record.year)

  const document = (
    <RentReceiptPdf
      agency={agency}
      reference={record.reference.slice(-10).toUpperCase()}
      period={period}
      propertyTitle={property.title}
      propertyAddress={[property.address, property.commune, property.wilaya]
        .filter(Boolean)
        .join(", ")}
      tenantName={`${client.firstName} ${client.lastName}`}
      ownerName={owner ? `${owner.firstName} ${owner.lastName}` : null}
      rentAmount={formatDZD(record.rentAmount)}
      charges={record.charges ? formatDZD(record.charges) : null}
      expenses={record.expenses ? formatDZD(record.expenses) : null}
      commission={record.commission ? formatDZD(record.commission) : null}
      netToOwner={formatDZD(netToOwner)}
      total={formatDZD(total)}
      isPaid={record.isPaid}
      paymentDate={record.paymentDate ? formatDate(record.paymentDate) : null}
      notes={record.notes}
    />
  )

  return pdfResponse(document, `quittance-${period}-${client.lastName}.pdf`)
}
