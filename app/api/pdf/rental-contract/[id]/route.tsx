import React from "react"
import { NextResponse } from "next/server"
import { getApiAgency } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { RentalContractPdf } from "@/lib/pdf/documents"
import { pdfResponse } from "@/lib/pdf/render"
import { formatDZD, formatDateLong } from "@/lib/format"
import { PROPERTY_TYPE_LABELS, label } from "@/lib/labels"

export const runtime = "nodejs"

/** Contrat de bail pour une location. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await getApiAgency()

  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const { id } = await params

  const rental = await prisma.rental.findFirst({
    where: { id, agencyId: guard.agencyId },
    include: { agency: true, client: true, owner: true, property: true },
  })

  if (!rental) {
    return NextResponse.json({ error: "Location introuvable" }, { status: 404 })
  }

  const { property, client, owner, agency } = rental

  const document = (
    <RentalContractPdf
      agency={agency}
      reference={rental.id.slice(-10).toUpperCase()}
      ownerName={owner ? `${owner.firstName} ${owner.lastName}` : null}
      ownerAddress={owner?.address ?? null}
      ownerIdCard={owner?.idCardNumber ?? null}
      tenantName={`${client.firstName} ${client.lastName}`}
      tenantPhone={client.phone}
      tenantEmail={client.email}
      propertyTitle={property.title}
      propertyAddress={[property.address, property.commune, property.wilaya]
        .filter(Boolean)
        .join(", ")}
      propertyType={label(PROPERTY_TYPE_LABELS, property.type)}
      surface={property.surface ? `${property.surface} m2` : null}
      rooms={property.rooms ? String(property.rooms) : null}
      isFurnished={property.isFurnished}
      monthlyRent={formatDZD(rental.monthlyRent)}
      deposit={rental.deposit ? formatDZD(rental.deposit) : null}
      agencyFees={rental.agencyFees ? formatDZD(rental.agencyFees) : null}
      startDate={formatDateLong(rental.startDate)}
      endDate={rental.endDate ? formatDateLong(rental.endDate) : "Indeterminee"}
      durationLabel={describeDuration(rental.startDate, rental.endDate)}
    />
  )

  return pdfResponse(document, `contrat-location-${client.lastName}.pdf`)
}

/** "12 mois" / "2 ans et 3 mois" / "Indeterminee" */
function describeDuration(start: Date, end: Date | null): string {
  if (!end) return "Duree indeterminee"

  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())

  if (months <= 0) return "Moins d'un mois"
  if (months < 12) return `${months} mois`

  const years = Math.floor(months / 12)
  const rest = months % 12

  if (rest === 0) return years === 1 ? "1 an" : `${years} ans`
  return `${years} ${years === 1 ? "an" : "ans"} et ${rest} mois`
}
