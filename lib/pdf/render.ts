import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { NextResponse } from "next/server"
import type { ReactElement } from "react"
import { sanitizeFilename } from "@/lib/format"

/**
 * Rend un document React-PDF et le renvoie en reponse HTTP.
 *
 * `inline` affiche le PDF dans l'onglet du navigateur ; sinon il est
 * telecharge sous le nom fourni.
 */
export async function pdfResponse(
  document: ReactElement<DocumentProps>,
  filename: string,
  { inline = true }: { inline?: boolean } = {}
): Promise<NextResponse> {
  const buffer = await renderToBuffer(document)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${sanitizeFilename(filename)}"`,
      "Cache-Control": "no-store",
    },
  })
}
