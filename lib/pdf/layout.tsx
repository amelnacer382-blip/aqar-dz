import React from "react"
import { Document, Page, Text, View } from "@react-pdf/renderer"
import { pdfStyles as s } from "./theme"

export type PdfAgency = {
  name: string
  email: string
  phone: string | null
  address: string | null
  wilaya: string | null
  commune: string | null
}

/** En-tete + pied de page communs a tous les documents. */
export function PdfShell({
  agency,
  docLabel,
  reference,
  title,
  subtitle,
  children,
}: {
  agency: PdfAgency
  docLabel: string
  reference: string
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  const location = [agency.commune, agency.wilaya].filter(Boolean).join(", ")

  return (
    <Document
      title={`${docLabel} - ${reference}`}
      author={agency.name}
      creator="Aqar DZ"
    >
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <View>
            <Text style={s.agencyName}>{agency.name}</Text>
            {agency.address ? <Text style={s.agencyMeta}>{agency.address}</Text> : null}
            {location ? <Text style={s.agencyMeta}>{location}</Text> : null}
            <Text style={s.agencyMeta}>
              {[agency.phone, agency.email].filter(Boolean).join("  |  ")}
            </Text>
          </View>
          <View>
            <Text style={s.docLabel}>{docLabel}</Text>
            <Text style={s.docReference}>Ref. {reference}</Text>
            <Text style={s.docReference}>
              {new Date().toLocaleDateString("fr-FR")}
            </Text>
          </View>
        </View>

        <Text style={s.title}>{title}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}

        {children}

        <View style={s.footer} fixed>
          <Text>
            {agency.name} &mdash; Document genere par Aqar DZ
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}

/** Ligne cle / valeur. */
export function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value && value !== "" ? value : "-"}</Text>
    </View>
  )
}

export function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

/** Bloc de total mis en avant. */
export function TotalBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.totalBox}>
      <Text style={s.totalLabel}>{label}</Text>
      <Text style={s.totalValue}>{value}</Text>
    </View>
  )
}

/** Deux zones de signature cote a cote. */
export function Signatures({ left, right }: { left: string; right: string }) {
  return (
    <View style={s.signatures}>
      <View style={s.signatureBox}>
        <Text style={s.signatureLabel}>{left}</Text>
        <Text style={s.signatureLine}>Signature precedee de la mention Lu et approuve</Text>
      </View>
      <View style={s.signatureBox}>
        <Text style={s.signatureLabel}>{right}</Text>
        <Text style={s.signatureLine}>Signature precedee de la mention Lu et approuve</Text>
      </View>
    </View>
  )
}
