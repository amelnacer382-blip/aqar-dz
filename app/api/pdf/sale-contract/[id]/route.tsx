import React from "react"
import { NextResponse } from "next/server"
import { getApiAgency } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { SaleContractPdf } from "@/lib/pdf/documents"
import { pdfResponse } from "@/lib/pdf/render"
import { formatDZD, formatDateLong } from "@/lib/format"
import { PROPERTY_TYPE_LABELS, SALE_STATUS_LABELS, label } from "@/lib/labels"

export const runtime = "nodejs"

/** Compromis de vente pour une transaction. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await getApiAgency()

  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const { id } = await params

  const sale = await prisma.sale.findFirst({
    where: { id, agencyId: guard.agencyId },
    include: { agency: true, client: true, owner: true, property: true },
  })

  if (!sale) {
    return NextResponse.json({ error: "Vente introuvable" }, { status: 404 })
  }

  const { property, client, owner, agency } = sale

  const document = (
    <SaleContractPdf
      agency={agency}
      reference={sale.id.slice(-10).toUpperCase()}
      sellerName={owner ? `${owner.firstName} ${owner.lastName}` : null}
      sellerAddress={owner?.address ?? null}
      buyerName={`${client.firstName} ${client.lastName}`}
      buyerPhone={client.phone}
      buyerEmail={client.email}
      propertyTitle={property.title}
      propertyAddress={[property.address, property.commune, property.wilaya]
        .filter(Boolean)
        .join(", ")}
      propertyType={label(PROPERTY_TYPE_LABELS, property.type)}
      surface={property.surface ? `${property.surface} m2` : null}
      finalPrice={formatDZD(sale.finalPrice)}
      commission={sale.commission ? formatDZD(sale.commission) : null}
      saleDate={formatDateLong(sale.saleDate)}
      statusLabel={label(SALE_STATUS_LABELS, sale.status)}
    />
  )

  return pdfResponse(document, `compromis-vente-${client.lastName}.pdf`)
}
