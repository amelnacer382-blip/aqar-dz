import { StyleSheet } from "@react-pdf/renderer"

/**
 * Feuille de styles commune a tous les documents PDF.
 *
 * On s'en tient a Helvetica (police integree a @react-pdf/renderer) :
 * elle couvre l'alphabet latin accentue du francais sans avoir a embarquer
 * un fichier de police, ce qui garderait le PDF plus lourd et ajouterait
 * une dependance au systeme de fichiers en production.
 */
export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 44,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0f172a",
    lineHeight: 1.5,
  },

  // --- En-tete ---
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: "#0f172a",
    paddingBottom: 12,
    marginBottom: 24,
  },
  agencyName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  agencyMeta: {
    fontSize: 8,
    color: "#64748b",
    marginTop: 2,
  },
  docLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    textAlign: "right",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  docReference: {
    fontSize: 8,
    color: "#64748b",
    textAlign: "right",
    marginTop: 2,
  },

  // --- Titre du document ---
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#64748b",
    marginBottom: 24,
  },

  // --- Sections ---
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },

  // --- Grille cle / valeur ---
  row: {
    flexDirection: "row",
    marginBottom: 5,
  },
  label: {
    width: "40%",
    color: "#64748b",
  },
  value: {
    width: "60%",
    fontFamily: "Helvetica-Bold",
  },

  // --- Deux colonnes cote a cote ---
  columns: {
    flexDirection: "row",
    gap: 24,
  },
  column: {
    flex: 1,
  },

  // --- Tableau ---
  table: {
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: "#475569",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  cellLeft: { flex: 3 },
  cellRight: { flex: 1, textAlign: "right" },

  // --- Total mis en avant ---
  totalBox: {
    marginTop: 12,
    backgroundColor: "#f8fafc",
    borderLeftWidth: 3,
    borderLeftColor: "#0f172a",
    padding: 12,
  },
  totalLabel: {
    fontSize: 9,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  totalValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginTop: 2,
  },

  // --- Encadre d'information ---
  notice: {
    backgroundColor: "#f8fafc",
    padding: 10,
    fontSize: 9,
    color: "#475569",
    marginTop: 8,
  },

  // --- Signatures ---
  signatures: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 40,
  },
  signatureBox: {
    width: "45%",
  },
  signatureLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 34,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: "#94a3b8",
    paddingTop: 4,
    fontSize: 8,
    color: "#64748b",
  },

  // --- Pied de page ---
  footer: {
    position: "absolute",
    bottom: 28,
    left: 44,
    right: 44,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#94a3b8",
  },

  muted: {
    color: "#64748b",
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
})
