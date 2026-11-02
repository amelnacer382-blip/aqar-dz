import type { AgencyPlan } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { offre, type Offre, type Plafond } from "@/lib/offres"

/**
 * Les plafonds de l'offre, appliques. Story 6.4.
 *
 * POURQUOI UN MODULE A PART, ET PAS DANS `lib/offres.ts`. Celui-la est
 * importe par des composants CLIENT — la section tarifaire, le formulaire
 * d'inscription. Y mettre `prisma` embarquerait le client de base de
 * donnees dans le bundle navigateur. Ici, rien n'est importe cote client.
 *
 * CE QUI SE COMPTE, ET CE QUI NE SE COMPTE PAS. Deux decisions du PRD
 * (FR-9, FR-10), et ce sont elles le piege de cette story — le refus, lui,
 * est facile :
 *
 *  - LES BIENS : ceux qui ne sont pas a la corbeille, TOUS STATUTS
 *    CONFONDUS. Un bien vendu ou loue compte encore : il occupe une fiche.
 *    Le filtre `deletedAt: null` n'est pas ecrit ici — le client etendu de
 *    `lib/prisma.ts` l'injecte sur `count`, qui figure bien dans ses
 *    `READ_OPERATIONS`. Verifie en lisant l'extension, pas suppose.
 *
 *  - LES COMPTES : ceux qui sont ACTIFS, tous roles confondus, y compris
 *    l'administrateur qui regarde. Un compte desactive ne consomme rien —
 *    c'est ce qui rend la desactivation une sortie utilisable quand on
 *    depasse.
 *
 * LE DECOMPTE SE LIT EN BASE, AU MOMENT DE L'ACTION. Jamais dans la
 * session, jamais dans le jeton : deux onglets ouverts suffiraient a
 * franchir le plafond, et un jeton de douze heures le rendrait faux
 * pendant douze heures. L'offre attribuee se relit de la meme facon, et
 * pour la meme raison que `lib/auth-guard.ts` relit le role.
 *
 * CE QUE CE MODULE NE FAIT JAMAIS : supprimer, desactiver ou masquer quoi
 * que ce soit (FR-12). Une agence retrogradee au-dessous de son decompte
 * garde tout, et tout reste modifiable. Seule la CREATION est refusee.
 */
export type Quota = {
  /** L'offre attribuee, relue en base. */
  offre: Offre
  plafond: Plafond
  decompte: number
  /** Vrai quand une creation de plus doit etre refusee. */
  atteint: boolean
}

function etat(plan: AgencyPlan, plafond: Plafond, decompte: number): Quota {
  return {
    offre: offre(plan),
    plafond,
    decompte,
    // `>=` et non `>` : au plafond, la place suivante n'existe pas.
    // Un plafond nul est ILLIMITE et n'atteint jamais rien — c'est le
    // seul endroit du code ou ce `null` decide de quelque chose.
    atteint: plafond !== null && decompte >= plafond,
  }
}

/**
 * L'offre attribuee de cette agence.
 *
 * `findUniqueOrThrow` a dessein : l'appelant vient de passer une garde
 * (`requireAgency`), qui a deja relu l'agence en base. Une absence ici
 * n'est pas un cas metier a rattraper, c'est un invariant rompu — et le
 * masquer en accordant un plafond par defaut ouvrirait exactement la
 * porte que cette story ferme.
 */
async function offreAttribuee(agencyId: string): Promise<AgencyPlan> {
  const agence = await prisma.agency.findUniqueOrThrow({
    where: { id: agencyId },
    select: { plan: true },
  })

  return agence.plan
}

/** Ou en est cette agence sur son plafond de biens. */
export async function quotaBiens(agencyId: string): Promise<Quota> {
  const plan = await offreAttribuee(agencyId)

  // `count()`, jamais `findMany().length` : le second ramene toutes les
  // lignes pour n'en garder que le nombre, et devient un probleme le jour
  // ou une agence en a beaucoup — c'est-a-dire exactement quand le
  // plafond compte.
  const decompte = await prisma.property.count({ where: { agencyId } })

  return etat(plan, offre(plan).plafondBiens, decompte)
}

/** Ou en est cette agence sur son plafond de comptes actifs. */
export async function quotaComptes(agencyId: string): Promise<Quota> {
  const plan = await offreAttribuee(agencyId)

  const decompte = await prisma.user.count({
    where: { agencyId, isActive: true },
  })

  return etat(plan, offre(plan).plafondComptes, decompte)
}

/**
 * Le message de refus. Il nomme l'offre, le plafond, le decompte actuel —
 * et la SORTIE.
 *
 * Dire « plafond atteint » sans dire comment en sortir laisse l'agence
 * devant un mur : elle ne sait pas si elle doit payer, appeler, ou
 * attendre. La sortie normale est de liberer une place, et elle est
 * gratuite (FR-12).
 */
export function refusDeQuota(quota: Quota, quoi: "bien" | "compte"): string {
  // Un plafond illimite n'atteint jamais rien. Si un appelant oubliait de
  // tester `atteint`, mieux vaut une phrase absurde mais vraie qu'un
  // « null biens au maximum » qui ferait croire a un bogue d'affichage.
  if (quota.plafond === null) {
    return `Offre ${quota.offre.nom} : aucun plafond n'est atteint.`
  }

  const objets = quoi === "bien" ? "biens" : "utilisateurs actifs"
  const sortie =
    quoi === "bien"
      ? "Supprimez un bien pour libérer une place"
      : "Désactivez un compte pour libérer une place"

  return (
    `Offre ${quota.offre.nom} : ${quota.plafond} ${objets} au maximum, ` +
    `vous en avez ${quota.decompte}. ${sortie}, ou demandez une offre ` +
    `supérieure à l'équipe Aqar DZ.`
  )
}
