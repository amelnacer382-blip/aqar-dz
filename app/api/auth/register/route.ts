import { NextRequest, NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { slugify } from "@/lib/format"
// Cette route portait une copie locale de `registerSchema`, et c'etait elle
// qui tournait : celle de lib/validations n'etait importee nulle part.
// Corriger la seconde sans brancher la premiere n'aurait rien change a
// l'execution — c'est ainsi que la normalisation des emails a pu manquer ici
// alors qu'elle existait deja ailleurs dans le fichier de schemas.
// `z` reste importe plus haut : le bloc catch teste `error instanceof z.ZodError`.
import { registerSchema } from "@/lib/validations"
import { OFFRE_PAR_DEFAUT } from "@/lib/offres"
import { callerIpFrom, rateLimit, retryMessage, cleDeCompteur } from "@/lib/rate-limit"
import { notifyPlatformOfSignup } from "@/lib/notifications"

/**
 * Cinq inscriptions par heure et par adresse.
 *
 * C'est large pour une agence qui se trompe et recommence, et etroit pour
 * un script : chaque inscription cree une agence et un compte, et hache un
 * mot de passe — trois operations couteuses declenchees sans authentification.
 */
const SIGNUP_LIMIT = 5
const SIGNUP_WINDOW_MS = 60 * 60 * 1000

/**
 * Trouve un identifiant d'URL libre pour la vitrine.
 *
 * Il est attribue des l'inscription : sans lui, la vitrine de l'agence
 * reste eteinte jusqu'a ce que quelqu'un pense a ouvrir les parametres.
 * Deux agences peuvent porter des noms proches, d'ou le suffixe numerique.
 */
async function availableSlug(name: string): Promise<string | null> {
  const base = slugify(name)

  if (!base) return null

  for (let suffix = 0; suffix < 20; suffix++) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`
    const taken = await prisma.agency.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })

    if (!taken) return candidate
  }

  // Aucun candidat libre : l'agence choisira le sien dans ses parametres.
  return null
}

export async function POST(req: NextRequest) {
  try {
    const ip = callerIpFrom(req.headers)

    const limit = rateLimit({
      key: cleDeCompteur("inscription", ip),
      limit: SIGNUP_LIMIT,
      windowMs: SIGNUP_WINDOW_MS,
    })

    if (!limit.ok) {
      return NextResponse.json(
        { error: retryMessage(limit.retryAfter) },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      )
    }

    const body = await req.json()
    const validated = registerSchema.parse(body)

    // Vérifier si l'email existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Cet email est déjà utilisé" },
        { status: 400 }
      )
    }

    // Vérifier si une agence avec ce nom existe déjà
    const existingAgency = await prisma.agency.findFirst({
      where: { name: validated.agencyName },
    })

    if (existingAgency) {
      return NextResponse.json(
        { error: "Une agence avec ce nom existe déjà" },
        { status: 400 }
      )
    }

    // Hasher le mot de passe
    const hashedPassword = await hash(validated.password, 12)
    const slug = await availableSlug(validated.agencyName)

    // Créer l'agence et l'utilisateur admin en transaction
    const result = await prisma.$transaction(async (tx) => {
      // Créer l'agence avec statut pending
      const agency = await tx.agency.create({
        data: {
          name: validated.agencyName,
          email: validated.email,
          phone: validated.phone,
          wilaya: validated.wilaya,
          address: validated.address,
          slug,
          status: "pending",
          /*
            LES DEUX COLONNES NE SE TOUCHENT PAS, ET C'EST TOUT L'ENJEU
            (FR-5). `plan` est l'offre ATTRIBUEE : elle part a la
            moins-disante et n'est remplacee que par une decision du super
            administrateur, a l'approbation (story 6.3).
            `requestedPlan` est ce que le visiteur a DEMANDE.

            Ecrire `plan: validated.requestedPlan` ici suffirait a laisser
            n'importe qui s'attribuer Enterprise en postant un corps de
            requete — la route est publique et non authentifiee. C'est
            exactement pourquoi la demande est stockee ailleurs.
          */
          plan: OFFRE_PAR_DEFAUT,
          requestedPlan: validated.requestedPlan,
        },
      })

      /*
        LE PREMIER ADMINISTRATEUR EST HORS QUOTA PAR CONSTRUCTION, et ce
        n'est pas un oubli (story 6.4, FR-10).

        L'agence vient d'etre creee dans cette meme transaction : elle a
        zero compte actif, et son plafond le plus bas en autorise deux. Y
        appeler `quotaComptes()` interrogerait une agence que la
        transaction n'a pas encore validee, pour un controle qui ne peut
        pas refuser.

        Ecrit ici pour qu'on ne le « corrige » pas en ajoutant la garde
        des autres points de creation.
      */
      const user = await tx.user.create({
        data: {
          email: validated.email,
          name: validated.agencyName,
          password: hashedPassword,
          role: "agency_admin",
          agencyId: agency.id,
          isActive: true,
        },
      })

      return { agency, user }
    })

    // Prevenir l'equipe. L'envoi ne conditionne rien : le compte existe
    // deja et apparait dans la console d'administration.
    const admins = await prisma.user.findMany({
      where: { role: "super_admin", isActive: true },
      select: { email: true },
    })

    await notifyPlatformOfSignup({
      recipients: admins.map((admin) => admin.email),
      agencyName: result.agency.name,
      agencyEmail: result.agency.email,
      wilaya: result.agency.wilaya,
    })

    return NextResponse.json({
      message: "Inscription réussie",
      agencyId: result.agency.id,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Une erreur est survenue lors de l'inscription" },
      { status: 500 }
    )
  }
}
