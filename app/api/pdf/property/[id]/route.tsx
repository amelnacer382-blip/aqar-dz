import React from "react"
import { NextResponse } from "next/server"
import { getApiAgency } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { PropertySheetPdf } from "@/lib/pdf/documents"
import { pdfResponse } from "@/lib/pdf/render"
import { formatDZD } from "@/lib/format"
import {
  PROPERTY_TYPE_LABELS,
  PROPERTY_CATEGORY_LABELS,
  PROPERTY_STATUS_LABELS,
  OPERATION_TYPE_LABELS,
  label,
} from "@/lib/labels"

export const runtime = "nodejs"

/** Fiche de presentation d'un bien, a remettre au client. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await getApiAgency()

  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const { id } = await params

  const property = await prisma.property.findFirst({
    where: { id, agencyId: guard.agencyId },
    include: { agency: true },
  })

  if (!property) {
    return NextResponse.json({ error: "Bien introuvable" }, { status: 404 })
  }

  const price =
    property.operationType === "vente"
      ? property.salePrice
        ? formatDZD(property.salePrice)
        : "Prix sur demande"
      : property.rentPrice
        ? `${formatDZD(property.rentPrice)} / mois`
        : "Loyer sur demande"

  const features = [
    property.hasGarage ? "Garage" : null,
    property.hasGarden ? "Jardin" : null,
    property.hasTerrace ? "Terrasse" : null,
    property.isFurnished ? "Meuble" : null,
  ].filter((f): f is string => f !== null)

  const document = (
    <PropertySheetPdf
      agency={property.agency}
      reference={property.reference.slice(-10).toUpperCase()}
      title={property.title}
      typeLabel={label(PROPERTY_TYPE_LABELS, property.type)}
      categoryLabel={label(PROPERTY_CATEGORY_LABELS, property.category)}
      operationLabel={label(OPERATION_TYPE_LABELS, property.operationType)}
      statusLabel={label(PROPERTY_STATUS_LABELS, property.status)}
      price={price}
      location={`${property.wilaya}, ${property.commune}`}
      address={property.address}
      surface={property.surface ? `${property.surface} m2` : null}
      rooms={property.rooms ? String(property.rooms) : null}
      bedrooms={property.bedrooms ? String(property.bedrooms) : null}
      bathrooms={property.bathrooms ? String(property.bathrooms) : null}
      floor={property.floor !== null ? String(property.floor) : null}
      features={features}
      shortDescription={property.shortDescription}
      description={property.description}
    />
  )

  return pdfResponse(document, `fiche-${property.reference.slice(-8)}.pdf`)
}
