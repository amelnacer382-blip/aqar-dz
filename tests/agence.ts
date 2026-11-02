import { hash } from "bcryptjs"
import { db } from "./db"

/**
 * Decor : une agence a soi, creee puis effacee par le test qui s'en sert.
 *
 * POURQUOI PAS LE SEED. Une seconde agence permanente deviendrait un
 * decor que toute la suite traverse — compteurs de la console
 * d'administration, statistiques, listes — et le jour ou un test echoue,
 * on ne saurait plus si c'est a cause d'elle.
 *
 * POURQUOI PRISMA ET PAS L'INTERFACE. Douze entites liees a creer. Les
 * poser par les formulaires prendrait des minutes et eprouverait les
 * formulaires, qui ne sont pas le sujet. LE DECOR N'EST PAS CE QU'ON
 * EPROUVE : ce qu'on eprouve, c'est le chemin de lecture ou le controle
 * de role. Batir le decor par le chemin le plus court est donc legitime,
 * et plus honnete que de faire croire qu'on teste aussi la creation.
 *
 * Ce fichier est partage par `tenancy.spec.ts` (story 4.2) et
 * `roles.spec.ts` (story 4.3). Une seconde copie aurait diverge au
 * premier changement de schema.
 */

export type Compte = {
  email: string
  motDePasse: string
  role: "agency_admin" | "agent"
}

export type Agence = Awaited<ReturnType<typeof creerAgence>>

const MOT_DE_PASSE = "password123"

/**
 * Agence nue : la ligne d'agence et les comptes demandes.
 *
 * Le marqueur est unique par execution et se retrouve dans les champs
 * QUI RESSORTENT DANS LES EXPORTS — titre du bien, noms des personnes,
 * notes de paiement. Chercher ce jeton dans un CSV devient alors une
 * preuve, la ou un « Dupont » pourrait exister des deux cotes.
 */
export async function creerAgence(
  roles: Array<"agency_admin" | "agent"> = ["agency_admin"]
) {
  const marque = `CLOISON-${Date.now()}-${Math.floor(Math.random() * 100000)}`
  const cle = marque.toLowerCase()

  const agence = await db.agency.create({
    data: {
      name: `Agence ${marque}`,
      email: `${cle}@voisine.invalid`,
      wilaya: "Oran",
      status: "active",
      slug: cle,
    },
  })

  // Le hachage est volontairement lent (bcrypt, cout 12). Un seul suffit
  // pour tous les comptes du decor : ils partagent le meme mot de passe.
  const empreinte = await hash(MOT_DE_PASSE, 12)

  const comptes: Compte[] = []

  for (let index = 0; index < roles.length; index++) {
    const role = roles[index]
    const email = `${role}.${index}.${cle}@voisine.invalid`

    await db.user.create({
      data: {
        email,
        name: `${role} ${index} ${marque}`,
        password: empreinte,
        role,
        agencyId: agence.id,
        isActive: true,
      },
    })

    comptes.push({ email, motDePasse: MOT_DE_PASSE, role })
  }

  const admin = comptes.find((c) => c.role === "agency_admin")

  return { marque, agence, comptes, admin }
}

/** Les douze entites metier, toutes marquees. */
export async function garnir(agence: Agence) {
  const agencyId = agence.agence.id
  const marque = agence.marque

  const proprietaire = await db.owner.create({
    data: { firstName: "Propriétaire", lastName: marque, agencyId },
  })

  const bien = await db.property.create({
    data: {
      title: `Bien ${marque}`,
      category: "residentiel",
      type: "appartement",
      operationType: "vente",
      wilaya: "Oran",
      commune: "Bir El Djir",
      salePrice: 12_000_000,
      rentPrice: 60_000,
      agencyId,
      ownerId: proprietaire.id,
    },
  })

  const client = await db.client.create({
    data: { firstName: "Client", lastName: marque, agencyId },
  })

  const visite = await db.visit.create({
    data: {
      date: new Date(),
      time: "10:00",
      clientId: client.id,
      propertyId: bien.id,
      agencyId,
    },
  })

  const vente = await db.sale.create({
    data: {
      propertyId: bien.id,
      clientId: client.id,
      ownerId: proprietaire.id,
      finalPrice: 11_500_000,
      saleDate: new Date(),
      agencyId,
    },
  })

  const bail = await db.rental.create({
    data: {
      propertyId: bien.id,
      clientId: client.id,
      ownerId: proprietaire.id,
      startDate: new Date(),
      monthlyRent: 60_000,
      agencyId,
    },
  })

  const quittance = await db.rentalManagement.create({
    data: { rentalId: bail.id, month: 1, year: 2026, rentAmount: 60_000 },
  })

  const paiement = await db.payment.create({
    data: {
      amount: 60_000,
      type: "loyer",
      date: new Date(),
      notes: `Note ${marque}`,
      agencyId,
      propertyId: bien.id,
      clientId: client.id,
      rentalId: bail.id,
    },
  })

  await db.lead.create({
    data: {
      firstName: "Visiteur",
      lastName: marque,
      message: `Message ${marque}`,
      agencyId,
      propertyId: bien.id,
    },
  })

  const document = await db.document.create({
    data: {
      name: `Document ${marque}`,
      type: "contrat_vente",
      url: `/uploads/documents/${agencyId}/piece.pdf`,
      agencyId,
    },
  })

  return {
    bien,
    client,
    proprietaire,
    visite,
    vente,
    bail,
    quittance,
    paiement,
    document,
  }
}

/**
 * Efface l'agence et ses comptes.
 *
 * `Agency` cascade sur tous ses enfants — biens, clients, ventes, baux,
 * journaux d'audit. `User`, lui, est en `onDelete: SetNull` : sans la
 * premiere ligne, chaque execution laisserait derriere elle un compte
 * sans agence, visible dans /admin/users et rattachable a rien.
 */
export async function effacerAgence(agence: Agence) {
  await db.user.deleteMany({ where: { agencyId: agence.agence.id } })
  await db.agency.delete({ where: { id: agence.agence.id } })
}
