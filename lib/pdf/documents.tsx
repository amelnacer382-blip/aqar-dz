import React from "react"
import { Text, View } from "@react-pdf/renderer"
import { pdfStyles as s } from "./theme"
import { PdfShell, Field, Section, TotalBox, Signatures, type PdfAgency } from "./layout"

// ==========================================
// QUITTANCE DE LOYER
// ==========================================

export function RentReceiptPdf({
  agency,
  reference,
  period,
  propertyTitle,
  propertyAddress,
  tenantName,
  ownerName,
  rentAmount,
  charges,
  expenses,
  commission,
  netToOwner,
  total,
  isPaid,
  paymentDate,
  notes,
}: {
  agency: PdfAgency
  reference: string
  period: string
  propertyTitle: string
  propertyAddress: string
  tenantName: string
  ownerName: string | null
  rentAmount: string
  charges: string | null
  expenses: string | null
  commission: string | null
  netToOwner: string
  total: string
  isPaid: boolean
  paymentDate: string | null
  notes: string | null
}) {
  return (
    <PdfShell
      agency={agency}
      docLabel="Quittance de loyer"
      reference={reference}
      title={`Quittance de loyer - ${period}`}
      subtitle={propertyTitle}
    >
      <View style={s.columns}>
        <View style={s.column}>
          <Section title="Locataire">
            <Field label="Nom" value={tenantName} />
          </Section>
        </View>
        <View style={s.column}>
          <Section title="Proprietaire">
            <Field label="Nom" value={ownerName} />
          </Section>
        </View>
      </View>

      <Section title="Bien loue">
        <Field label="Designation" value={propertyTitle} />
        <Field label="Adresse" value={propertyAddress} />
        <Field label="Periode" value={period} />
      </Section>

      <Section title="Detail du decompte">
        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderCell, s.cellLeft]}>Libelle</Text>
            <Text style={[s.tableHeaderCell, s.cellRight]}>Montant</Text>
          </View>
          <Line label="Loyer" value={rentAmount} />
          {charges ? <Line label="Charges recuperees" value={charges} /> : null}
          {expenses ? <Line label="Depenses avancees par l'agence" value={`- ${expenses}`} /> : null}
          {commission ? <Line label="Commission de gestion" value={`- ${commission}`} /> : null}
        </View>

        <View style={s.row}>
          <Text style={[s.label, { width: "60%", marginTop: 8 }]}>
            Total percu du locataire
          </Text>
          <Text style={[s.value, { width: "40%", textAlign: "right", marginTop: 8 }]}>
            {total}
          </Text>
        </View>
      </Section>

      <TotalBox label="Net a reverser au proprietaire" value={netToOwner} />

      <View style={s.notice}>
        {isPaid ? (
          <Text>
            Je soussigne, {agency.name}, agissant pour le compte du proprietaire,
            reconnais avoir recu du locataire la somme indiquee ci-dessus au titre
            du loyer et des charges de la periode de {period}
            {paymentDate ? `, encaissee le ${paymentDate}` : ""}. La presente
            quittance annule tous recus anterieurs pour cette meme periode.
          </Text>
        ) : (
          <Text>
            Ce document constitue un avis d&apos;echeance pour la periode de {period}.
            Le reglement n&apos;a pas encore ete encaisse a la date d&apos;edition.
            Il ne vaut pas quittance.
          </Text>
        )}
      </View>

      {notes ? (
        <Section title="Observations">
          <Text style={s.muted}>{notes}</Text>
        </Section>
      ) : null}

      <View style={s.signatures}>
        <View style={s.signatureBox}>
          <Text style={s.signatureLabel}>Pour l&apos;agence</Text>
          <Text style={s.signatureLine}>{agency.name}</Text>
        </View>
      </View>
    </PdfShell>
  )
}

// ==========================================
// CONTRAT DE LOCATION
// ==========================================

export function RentalContractPdf({
  agency,
  reference,
  ownerName,
  ownerAddress,
  ownerIdCard,
  tenantName,
  tenantPhone,
  tenantEmail,
  propertyTitle,
  propertyAddress,
  propertyType,
  surface,
  rooms,
  isFurnished,
  monthlyRent,
  deposit,
  agencyFees,
  startDate,
  endDate,
  durationLabel,
}: {
  agency: PdfAgency
  reference: string
  ownerName: string | null
  ownerAddress: string | null
  ownerIdCard: string | null
  tenantName: string
  tenantPhone: string | null
  tenantEmail: string | null
  propertyTitle: string
  propertyAddress: string
  propertyType: string
  surface: string | null
  rooms: string | null
  isFurnished: boolean
  monthlyRent: string
  deposit: string | null
  agencyFees: string | null
  startDate: string
  endDate: string
  durationLabel: string
}) {
  return (
    <PdfShell
      agency={agency}
      docLabel="Contrat de location"
      reference={reference}
      title="Contrat de bail a usage d'habitation"
      subtitle={propertyTitle}
    >
      <Section title="Entre les soussignes">
        <Text style={{ marginBottom: 6 }}>
          <Text style={s.bold}>Le bailleur : </Text>
          {ownerName ?? "Non renseigne"}
          {ownerAddress ? `, demeurant a ${ownerAddress}` : ""}
          {ownerIdCard ? `, titulaire de la piece d'identite n° ${ownerIdCard}` : ""}
          {", represente par l'agence "}
          {agency.name}
          {", ci-apres denomme LE BAILLEUR."}
        </Text>
        <Text>
          <Text style={s.bold}>Le preneur : </Text>
          {tenantName}
          {tenantPhone ? `, telephone ${tenantPhone}` : ""}
          {tenantEmail ? `, courriel ${tenantEmail}` : ""}
          {", ci-apres denomme LE PRENEUR."}
        </Text>
      </Section>

      <Section title="Article 1 - Designation du bien loue">
        <Field label="Designation" value={propertyTitle} />
        <Field label="Nature" value={propertyType} />
        <Field label="Adresse" value={propertyAddress} />
        <Field label="Surface" value={surface} />
        <Field label="Nombre de pieces" value={rooms} />
        <Field label="Etat" value={isFurnished ? "Meuble" : "Non meuble"} />
      </Section>

      <Section title="Article 2 - Duree du bail">
        <Field label="Date de prise d'effet" value={startDate} />
        <Field label="Date d'echeance" value={endDate} />
        <Field label="Duree" value={durationLabel} />
        <Text style={[s.muted, { marginTop: 6 }]}>
          A l&apos;expiration du terme, le bail pourra etre renouvele par accord
          ecrit entre les parties.
        </Text>
      </Section>

      <Section title="Article 3 - Loyer et charges">
        <Field label="Loyer mensuel" value={monthlyRent} />
        <Field label="Depot de garantie" value={deposit} />
        <Field label="Frais d'agence" value={agencyFees} />
        <Text style={[s.muted, { marginTop: 6 }]}>
          Le loyer est payable d&apos;avance, au plus tard le cinq (5) de chaque
          mois, entre les mains de l&apos;agence mandatee. Le depot de garantie
          sera restitue au preneur dans un delai maximum d&apos;un mois apres la
          restitution des cles, deduction faite des sommes eventuellement dues.
        </Text>
      </Section>

      <Section title="Article 4 - Obligations du preneur">
        <Text style={s.muted}>
          Le preneur s&apos;engage a user paisiblement du bien loue, a
          l&apos;entretenir en bon pere de famille, a s&apos;acquitter du loyer
          aux echeances convenues, a ne pas sous-louer ni ceder le present bail
          sans l&apos;accord ecrit du bailleur, et a souscrire une assurance
          couvrant les risques locatifs.
        </Text>
      </Section>

      <Section title="Article 5 - Obligations du bailleur">
        <Text style={s.muted}>
          Le bailleur s&apos;engage a delivrer le bien en bon etat d&apos;usage,
          a en assurer la jouissance paisible pendant toute la duree du bail et a
          prendre en charge les grosses reparations au sens de la legislation en
          vigueur.
        </Text>
      </Section>

      <Section title="Article 6 - Resiliation">
        <Text style={s.muted}>
          Le present contrat pourra etre resilie de plein droit en cas de
          non-paiement du loyer, apres mise en demeure restee sans effet pendant
          trente (30) jours. Chaque partie peut mettre fin au bail moyennant un
          preavis ecrit d&apos;un (1) mois.
        </Text>
      </Section>

      <Signatures left="Le bailleur" right="Le preneur" />
    </PdfShell>
  )
}

// ==========================================
// CONTRAT DE VENTE (compromis)
// ==========================================

export function SaleContractPdf({
  agency,
  reference,
  sellerName,
  sellerAddress,
  buyerName,
  buyerPhone,
  buyerEmail,
  propertyTitle,
  propertyAddress,
  propertyType,
  surface,
  finalPrice,
  commission,
  saleDate,
  statusLabel,
}: {
  agency: PdfAgency
  reference: string
  sellerName: string | null
  sellerAddress: string | null
  buyerName: string
  buyerPhone: string | null
  buyerEmail: string | null
  propertyTitle: string
  propertyAddress: string
  propertyType: string
  surface: string | null
  finalPrice: string
  commission: string | null
  saleDate: string
  statusLabel: string
}) {
  return (
    <PdfShell
      agency={agency}
      docLabel="Compromis de vente"
      reference={reference}
      title="Compromis de vente immobiliere"
      subtitle={`${propertyTitle} - ${statusLabel}`}
    >
      <Section title="Entre les soussignes">
        <Text style={{ marginBottom: 6 }}>
          <Text style={s.bold}>Le vendeur : </Text>
          {sellerName ?? "Non renseigne"}
          {sellerAddress ? `, demeurant a ${sellerAddress}` : ""}
          {", ci-apres denomme LE VENDEUR."}
        </Text>
        <Text>
          <Text style={s.bold}>L&apos;acquereur : </Text>
          {buyerName}
          {buyerPhone ? `, telephone ${buyerPhone}` : ""}
          {buyerEmail ? `, courriel ${buyerEmail}` : ""}
          {", ci-apres denomme L'ACQUEREUR."}
        </Text>
      </Section>

      <Section title="Article 1 - Designation du bien">
        <Field label="Designation" value={propertyTitle} />
        <Field label="Nature" value={propertyType} />
        <Field label="Adresse" value={propertyAddress} />
        <Field label="Surface" value={surface} />
      </Section>

      <Section title="Article 2 - Prix et conditions">
        <Field label="Prix de vente convenu" value={finalPrice} />
        <Field label="Commission d'agence" value={commission} />
        <Field label="Date de l'accord" value={saleDate} />
      </Section>

      <TotalBox label="Prix de vente" value={finalPrice} />

      <Section title="Article 3 - Conditions suspensives">
        <Text style={s.muted}>
          La presente vente est conclue sous les conditions suspensives
          habituelles, notamment l&apos;obtention par l&apos;acquereur du
          financement necessaire, la production par le vendeur d&apos;un titre de
          propriete regulier et l&apos;absence de toute inscription hypothecaire
          non levee a la date de la signature de l&apos;acte authentique.
        </Text>
      </Section>

      <Section title="Article 4 - Acte authentique">
        <Text style={s.muted}>
          Les parties s&apos;engagent a reiterer les presentes par acte
          authentique devant notaire. Les frais d&apos;acte, droits
          d&apos;enregistrement et taxes sont a la charge de l&apos;acquereur,
          sauf convention contraire des parties.
        </Text>
      </Section>

      <View style={s.notice}>
        <Text>
          Ce document est un compromis etabli par l&apos;intermediaire de
          l&apos;agence {agency.name}. Il ne se substitue pas a l&apos;acte
          authentique de vente qui doit etre dresse par un notaire.
        </Text>
      </View>

      <Signatures left="Le vendeur" right="L'acquereur" />
    </PdfShell>
  )
}

// ==========================================
// RECU DE PAIEMENT
// ==========================================

export function PaymentReceiptPdf({
  agency,
  reference,
  amount,
  typeLabel,
  methodLabel,
  statusLabel,
  date,
  payerName,
  propertyTitle,
  notes,
}: {
  agency: PdfAgency
  reference: string
  amount: string
  typeLabel: string
  methodLabel: string
  statusLabel: string
  date: string
  payerName: string | null
  propertyTitle: string | null
  notes: string | null
}) {
  return (
    <PdfShell
      agency={agency}
      docLabel="Recu de paiement"
      reference={reference}
      title="Recu de paiement"
      subtitle={typeLabel}
    >
      <Section title="Details du reglement">
        <Field label="Nature du paiement" value={typeLabel} />
        <Field label="Mode de reglement" value={methodLabel} />
        <Field label="Date" value={date} />
        <Field label="Statut" value={statusLabel} />
        {payerName ? <Field label="Verse par" value={payerName} /> : null}
        {propertyTitle ? <Field label="Bien concerne" value={propertyTitle} /> : null}
      </Section>

      <TotalBox label="Montant recu" value={amount} />

      <View style={s.notice}>
        <Text>
          Je soussigne, {agency.name}, reconnais avoir recu la somme de {amount}
          {payerName ? ` de la part de ${payerName}` : ""} au titre de :{" "}
          {typeLabel.toLowerCase()}, par {methodLabel.toLowerCase()}, en date du{" "}
          {date}.
        </Text>
      </View>

      {notes ? (
        <Section title="Observations">
          <Text style={s.muted}>{notes}</Text>
        </Section>
      ) : null}

      <View style={s.signatures}>
        <View style={s.signatureBox}>
          <Text style={s.signatureLabel}>Pour l&apos;agence</Text>
          <Text style={s.signatureLine}>{agency.name}</Text>
        </View>
      </View>
    </PdfShell>
  )
}

// ==========================================
// FICHE DE PRESENTATION D'UN BIEN
// ==========================================

export function PropertySheetPdf({
  agency,
  reference,
  title,
  typeLabel,
  categoryLabel,
  operationLabel,
  statusLabel,
  price,
  location,
  address,
  surface,
  rooms,
  bedrooms,
  bathrooms,
  floor,
  features,
  shortDescription,
  description,
}: {
  agency: PdfAgency
  reference: string
  title: string
  typeLabel: string
  categoryLabel: string
  operationLabel: string
  statusLabel: string
  price: string
  location: string
  address: string | null
  surface: string | null
  rooms: string | null
  bedrooms: string | null
  bathrooms: string | null
  floor: string | null
  features: string[]
  shortDescription: string | null
  description: string | null
}) {
  return (
    <PdfShell
      agency={agency}
      docLabel="Fiche bien"
      reference={reference}
      title={title}
      subtitle={shortDescription ?? `${typeLabel} - ${location}`}
    >
      <TotalBox label={operationLabel} value={price} />

      <View style={[s.columns, { marginTop: 18 }]}>
        <View style={s.column}>
          <Section title="Caracteristiques">
            <Field label="Type" value={typeLabel} />
            <Field label="Categorie" value={categoryLabel} />
            <Field label="Surface" value={surface} />
            <Field label="Pieces" value={rooms} />
            <Field label="Chambres" value={bedrooms} />
            <Field label="Salles de bain" value={bathrooms} />
            <Field label="Etage" value={floor} />
          </Section>
        </View>
        <View style={s.column}>
          <Section title="Localisation">
            <Field label="Wilaya / Commune" value={location} />
            <Field label="Adresse" value={address} />
            <Field label="Disponibilite" value={statusLabel} />
            <Field label="Reference" value={reference} />
          </Section>
        </View>
      </View>

      {features.length > 0 ? (
        <Section title="Prestations">
          <Text>{features.join("  -  ")}</Text>
        </Section>
      ) : null}

      {description ? (
        <Section title="Descriptif">
          <Text style={s.muted}>{description}</Text>
        </Section>
      ) : null}

      <View style={s.notice}>
        <Text>
          Pour toute information complementaire ou pour organiser une visite,
          contactez {agency.name}
          {agency.phone ? ` au ${agency.phone}` : ""}
          {agency.email ? ` ou par courriel a ${agency.email}` : ""}.
        </Text>
      </View>
    </PdfShell>
  )
}

// ------------------------------------------------------------------

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.tableRow}>
      <Text style={s.cellLeft}>{label}</Text>
      <Text style={[s.cellRight, s.bold]}>{value}</Text>
    </View>
  )
}
