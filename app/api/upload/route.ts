import { NextRequest, NextResponse } from "next/server"
import { getApiAgency } from "@/lib/auth-guard"
import { putFile } from "@/lib/storage"
import { rateLimit, retryMessage, cleDeCompteur } from "@/lib/rate-limit"
import { typeReconnu, EXTENSION_PAR_TYPE } from "@/lib/file-type"

const MAX_SIZE = 5 * 1024 * 1024 // 5 Mo

/**
 * Marge au-dessus de MAX_SIZE pour le refus precoce : le corps multipart
 * porte des frontieres, des en-tetes de partie et le champ `type` en plus
 * du fichier lui-meme. Large a dessein — ce refus-la sert a arreter les
 * corps manifestement hors norme, pas a mesurer.
 */
const MARGE_MULTIPART = 16 * 1024

/**
 * Budget de depot, par agence.
 *
 * C'est la seule route qui ecrive sur le disque, et c'etait la seule
 * route authentifiee sans compteur (BUG-09).
 *
 * Une fenetre COURTE plutot qu'une heure : ce compteur n'est pas le
 * quota de disque et ne doit pas le devenir. Une agence qui charge son
 * catalogue le jour de son arrivee touchera la limite ; qu'elle attende
 * dix minutes est une gene, qu'elle attende une heure est un appel au
 * support.
 *
 * 40, parce qu'une galerie fait au plus 12 photos (`GalleryUploadField`,
 * max = 12) : trois galeries d'affilee passent, une boucle de script est
 * arretee en quelques secondes.
 *
 * Ce que ce budget NE fait PAS : borner le disque. 40 x 5 Mo par tranche
 * de dix minutes font 1,2 Go par heure et par agence. Il retire le cas
 * « des milliers de fichiers par minute » et laisse le temps de voir
 * venir ; le vrai remede est un quota de stockage.
 *
 * La fenetre est GLISSANTE depuis la story 1.9 : la rafale de 80 a cheval
 * sur deux fenetres, que ce commentaire annoncait, n'est plus possible —
 * la fenetre qui s'acheve pese encore le temps du chevauchement. Le seuil
 * tient donc ce qu'il annonce, et le raisonnement qui a fixe ce nombre
 * n'en est que plus vrai.
 */
const DEPOTS_MAX = 40
const FENETRE_MS = 10 * 60 * 1000

const DOSSIERS = ["properties", "agencies", "documents"]

const TROP_VOLUMINEUX = "Fichier trop volumineux. Taille maximale: 5MB"

export async function POST(request: NextRequest) {
  try {
    const guard = await getApiAgency()

    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    // Le compteur est ouvert APRES le garde, et c'est voulu : un
    // appelant sans session est refuse en 401 avant d'ouvrir une entree.
    // Le nombre de cles de cette route est donc borne par le nombre
    // d'agences, la ou `inscription:<ip>` l'est par le nombre d'adresses
    // IP — voir le plafond MAX_COMPTEURS de lib/rate-limit.ts.
    const budget = rateLimit({
      key: cleDeCompteur("depot", guard.agencyId),
      limit: DEPOTS_MAX,
      windowMs: FENETRE_MS,
    })

    if (!budget.ok) {
      return NextResponse.json(
        { error: retryMessage(budget.retryAfter) },
        { status: 429, headers: { "Retry-After": String(budget.retryAfter) } }
      )
    }

    // Refus precoce, AVANT `formData()` qui met tout le corps en memoire :
    // un route handler de l'App Router n'a pas de `bodyParser.sizeLimit`.
    //
    // A dire franchement : `Content-Length` est declaratif, comme le type
    // que cette route a justement cesse de croire. La difference tient au
    // SENS du refus — on ne fait qu'arreter plus tot quelqu'un qui dit la
    // verite. Un menteur qui annonce 1 Ko et en envoie 900 Mo passe
    // toujours ici, et la vraie borne reste a poser ailleurs
    // (`client_max_body_size` de nginx sur le chemin normal, un quota
    // au-dela). Le gain n'est pas de securite, il est de ressource : un
    // utilisateur qui choisit une video de 200 Mo recoit une erreur
    // immediate au lieu de 200 Mo mis en tampon.
    const annonce = Number(request.headers.get("content-length"))

    if (Number.isFinite(annonce) && annonce > MAX_SIZE + MARGE_MULTIPART) {
      return NextResponse.json({ error: TROP_VOLUMINEUX }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get("file")
    const type = formData.get("type")

    // `instanceof File` plutot qu'un cast : un champ texte nomme « file »
    // arrivait jusqu'ici et n'echouait que plus bas, par accident.
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 })
    }

    if (typeof type !== "string" || !DOSSIERS.includes(type)) {
      return NextResponse.json(
        { error: "Type de dossier invalide" },
        { status: 400 }
      )
    }

    // `file.size` et non `buffer.length` : les deux valent la meme chose
    // — l'analyseur multipart compte les octets qu'il a reellement lus —
    // et celui-ci arrive AVANT la copie faite par `arrayBuffer()`.
    //
    // La premiere redaction faisait les deux, en presentant le second
    // comme « le controle reel ». C'etait faux : il n'existe aucun cas ou
    // les deux different. Une verification morte qui se donne le nom de
    // garde-fou est pire que pas de verification du tout.
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: TROP_VOLUMINEUX }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // LE CONTENU DECIDE. `file.type` n'est plus lu nulle part dans cette
    // route : ni pour admettre, ni pour nommer, ni pour stocker.
    const reel = typeReconnu(buffer)

    if (!reel) {
      return NextResponse.json(
        {
          error:
            "Le contenu de ce fichier ne correspond à aucun format accepté " +
            "(jpg, png, webp, pdf). C'est le contenu qui décide, pas " +
            "l'extension ni le type annoncé par le navigateur.",
        },
        { status: 400 }
      )
    }

    const ext = EXTENSION_PAR_TYPE[reel]
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const filename = `${timestamp}-${random}.${ext}`

    // Les documents sont ranges par agence.
    //
    // Un dossier plat commun laissait le cloisonnement reposer sur la
    // seule ligne `Document`, dont l'`url` est modifiable : une agence
    // pouvait designer le fichier d'une autre et le lire, voire le faire
    // supprimer. Le chemin porte desormais l'agence, donc le controle ne
    // depend plus d'une donnee que l'utilisateur maitrise.
    //
    // Les photos de biens et les logos restent a plat : ils sont publics
    // par destination, la vitrine les sert sans session.
    const folder = type === "documents" ? `documents/${guard.agencyId}` : type

    // Le stockage choisit lui-meme sa destination : objet en production,
    // disque en developpement. La route n'a pas a le savoir.
    //
    // `contentType` est le type RECONNU. En mode Supabase il est pose sur
    // l'objet et renvoye tel quel a chaque lecture publique, par un
    // domaine qui n'est pas le notre et qui n'a donc pas le `nosniff` de
    // notre nginx : y laisser passer une declaration du client revenait a
    // lui laisser choisir sous quel type son fichier serait re-servi.
    const stored = await putFile({
      buffer,
      folder,
      filename,
      contentType: reel,
    })

    return NextResponse.json({
      success: true,
      url: stored.url,
      key: stored.key,
      filename: file.name,
      size: file.size,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: "Erreur lors de l'upload" },
      { status: 500 }
    )
  }
}
