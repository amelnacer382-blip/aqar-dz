import { NextRequest, NextResponse } from "next/server"
import { extname } from "path"
import { getApiAgency } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { attachmentHeader, safeMimeType } from "@/lib/format"
import { documentKeyFor } from "@/lib/documents"
import { readFile } from "@/lib/storage"

/**
 * Lecture d'un document.
 *
 * Les pieces d'identite et actes deposes par une agence etaient jusqu'ici
 * servis directement depuis /uploads/documents/, sans session : l'adresse
 * du fichier suffisait a l'ouvrir, et rien n'empeche une adresse d'etre
 * partagee, journalisee par un intermediaire ou indexee. Le fichier passe
 * desormais par ici, derriere la meme garde d'appartenance que le reste
 * de l'agence (BUG-04).
 *
 * Une agence qui demande le document d'une autre recoit 404, jamais 403 :
 * un 403 confirmerait que l'identifiant existe.
 *
 * Le televersement plafonne a 5 Mo, ce qui autorise a garder le fichier
 * en memoire le temps de la reponse plutot qu'a monter un flux.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await getApiAgency()

    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const { id } = await params

    const document = await prisma.document.findFirst({
      where: { id, agencyId: guard.agencyId },
      select: { name: true, url: true, mimeType: true },
    })

    if (!document) {
      return NextResponse.json({ error: "Document non trouvé" }, { status: 404 })
    }

    // La ligne appartient bien a l'agence — le fichier qu'elle designe,
    // c'est une autre question. `Document.url` reste une chaine libre
    // (BUG-21, story 1.7) : sans ce controle, une agence collait la cle
    // d'un document d'une autre dans l'`url` du sien et le telechargeait.
    // Voir `lib/documents.ts` pour la regle exacte et sa tolerance
    // heritee.
    const key = await documentKeyFor(document.url, guard.agencyId)

    if (!key) {
      return NextResponse.json({ error: "Document non trouvé" }, { status: 404 })
    }

    const file = await readFile(key)

    if (!file) {
      return NextResponse.json({ error: "Document non trouvé" }, { status: 404 })
    }

    // Le nom lisible saisi par l'agence, et non le nom horodate du fichier
    // sur le disque. L'extension reelle y est rajoutee si elle manque :
    // « Contrat de vente » telecharge sans « .pdf » n'est ouvrable par
    // aucun systeme.
    const extension = extname(key).toLowerCase()
    const nom = document.name.toLowerCase().endsWith(extension)
      ? document.name
      : `${document.name}${extension}`

    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        // `mimeType` vient d'un champ texte libre : un retour chariot y
        // ferait lever la construction des en-tetes, et le document
        // deviendrait illisible pour de bon.
        "Content-Type": safeMimeType(document.mimeType) ?? file.contentType,
        // Toujours `attachment` : un PDF ou une image servis en `inline`
        // s'executeraient dans l'origine de l'application.
        "Content-Disposition": attachmentHeader(nom),
        // Ni cache partage, ni disque : une piece d'identite ne doit pas
        // survivre a la session dans le cache du navigateur.
        "Cache-Control": "private, no-store",
        // Contenu venu de l'exterieur : pas de reniflage de type.
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("Document file error:", error)
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 })
  }
}
