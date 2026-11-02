/**
 * Le catalogue des offres d'abonnement. Source unique.
 *
 * POURQUOI CE FICHIER EXISTE. Avant lui, la page d'accueil vendait trois
 * offres — Starter 2 900 DA, Pro 7 900, Enterprise 19 900 — et la base
 * n'en connaissait que deux, `basic` et `premium`, qui ne portaient aucun
 * de ces noms. La valeur stockee ne conditionnait rien : elle etait une
 * etiquette. Ce qui se vend et ce qui s'applique se lisent desormais ici,
 * et nulle part ailleurs.
 *
 * POURQUOI EN CODE ET PAS EN BASE. Arbitrage de l'editeur du 15-08-2026 :
 * les tarifs bougent rarement, et une table editable coute une migration,
 * des ecrans et des droits que le MVP ne justifie pas. Le prix a payer est
 * assume : changer un tarif est un deploiement.
 *
 * LES PLAFONDS. Ceux de la page tarifaire, sans changement (arbitrage du
 * 15-08-2026, motif dans docs/stories/6-1-poser-le-catalogue-des-offres.md).
 * Ils sont deja vendus publiquement : en inventer d'autres aurait ouvert
 * une seconde divergence entre la promesse et le produit.
 *
 * CE QUE CE FICHIER NE FAIT PAS. Il ne fait rien respecter. Les plafonds y
 * sont ecrits, personne ne les lit encore — c'est la story 6.4 qui les
 * applique. Lire ce fichier ne prouve pas qu'une agence Starter est
 * arretee a son vingtieme bien.
 */

// Type seul, jamais la valeur : ce module est importe par un composant
// client (la section tarifaire publique), et importer `@prisma/client`
// comme valeur y embarquerait le client Prisma dans le bundle navigateur.
import type { AgencyPlan } from "@prisma/client"

/**
 * Un plafond, ou son absence.
 *
 * `null` veut dire ILLIMITE. Pas `Infinity`, qui ne survit pas a
 * `JSON.stringify` et redescend en `null` de toute facon ; pas un grand
 * nombre sentinelle, qui finit toujours par s'afficher quelque part.
 * `null` oblige a traiter le cas au lieu de le laisser filer dans une
 * comparaison numerique — c'est le typage qui le rappelle.
 */
export type Plafond = number | null

export type Offre = {
  /** La cle stockee en base (colonne `plan`). Jamais montree a un humain. */
  cle: AgencyPlan
  /** Le nom affiche. C'est lui qui va dans les ecrans et les messages. */
  nom: string
  accroche: string
  /** Tarif mensuel en dinars, deja formate pour l'affichage. */
  prix: string
  periode: string
  /**
   * Les arguments de vente affiches sur la page tarifaire.
   *
   * ⚠ CHAQUE ENTREE DOIT FIGURER DANS `ARGUMENTS_REVUS`, plus bas. C'est
   * la seule chose qui empeche d'y ecrire ce que le produit ne fait pas —
   * ni `tsc`, ni le lint, ni la suite ne voyaient passer un argument creux
   * avant la story 6.6.
   *
   * ⚠ ET AUCUN N'EST UN VERROU. Seuls les deux plafonds ci-dessous
   * contraignent quelque chose (story 6.4). « Statistiques avancees »,
   * « Gestion locative », « Documents PDF » et « Vitrine personnalisee »
   * EXISTENT — et une agence Starter y accede exactement comme une agence
   * Pro. C'est le plus gros ecart restant entre la promesse et le produit,
   * porte par REP-101 et la story 6.7 : le fermer reviendrait a retirer a
   * des agences des ecrans qu'elles utilisent deja, ce qui n'est pas une
   * decision technique.
   */
  atouts: string[]
  /** Le libelle du bouton d'appel. */
  appel: string
  plafondBiens: Plafond
  plafondComptes: Plafond
  populaire: boolean
}

const OFFRES: Record<AgencyPlan, Offre> = {
  starter: {
    cle: "starter",
    nom: "Starter",
    accroche: "Parfait pour démarrer",
    prix: "2 900",
    periode: "DA/mois",
    atouts: [
      "Jusqu'à 20 biens",
      "2 utilisateurs",
      "Vitrine en ligne",
      "Gestion des clients",
      "Support email",
    ],
    appel: "Commencer",
    plafondBiens: 20,
    plafondComptes: 2,
    populaire: false,
  },
  pro: {
    cle: "pro",
    nom: "Pro",
    accroche: "Pour les agences en croissance",
    prix: "7 900",
    periode: "DA/mois",
    atouts: [
      "Biens illimités",
      "10 utilisateurs",
      "Vitrine personnalisée",
      "Gestion locative",
      "Documents PDF",
      "Statistiques avancées",
      "Support prioritaire",
    ],
    appel: "Choisir Pro",
    plafondBiens: null,
    plafondComptes: 10,
    populaire: true,
  },
  enterprise: {
    cle: "enterprise",
    nom: "Enterprise",
    accroche: "Pour les grands réseaux",
    prix: "19 900",
    periode: "DA/mois",
    atouts: [
      "Tout de l'offre Pro",
      "Utilisateurs illimités",
      "Formation dédiée",
      "Account manager",
      "SLA garanti",
    ],
    appel: "Contactez-nous",
    plafondBiens: null,
    plafondComptes: null,
    populaire: false,
  },
}

/**
 * Les trois offres, dans l'ordre ou elles se presentent : du plus petit au
 * plus grand. `Record<AgencyPlan, Offre>` garantit qu'aucune n'est oubliee
 * — ajouter une valeur a l'enumeration Prisma sans l'ecrire ici ne
 * compile pas.
 */
export const CATALOGUE: readonly Offre[] = [
  OFFRES.starter,
  OFFRES.pro,
  OFFRES.enterprise,
]

/**
 * Comment un argument de vente est tenu.
 *
 * `plafond` le produit le fait RESPECTER (story 6.4). Les seuls verrous.
 * `livre`   la capacite existe et l'ecran est nomme. Elle n'est PAS
 *           reservee a l'offre qui l'affiche — voir REP-101.
 * `service` un engagement humain, hors du code. Un `grep` ne dit rien de
 *           la presence d'un charge de compte : indecidable ici, donc
 *           reconnu comme tel plutot que tranche a l'aveugle.
 */
export type Tenue = "plafond" | "livre" | "service"

/**
 * L'INVENTAIRE DES ARGUMENTS DE VENTE, revu le 16-08-2026 (story 6.6).
 *
 * POURQUOI IL EXISTE. Avant lui, rien n'empechait d'ajouter un argument
 * que le produit ne tient pas : `tests/offres.spec.ts` verifie que chaque
 * argument du catalogue est AFFICHE, jamais qu'il est VRAI. Deux mentions
 * y ont vecu — « API access » et « Integrations custom » — sans designer
 * une seule ligne de code, sur une offre a 19 900 DA/mois.
 *
 * CE QU'IL PROUVE, ET CE QU'IL NE PROUVE PAS. Il ne prouve pas qu'une
 * capacite existe : aucun test ne sait faire ca. Il prouve qu'aucun
 * argument n'est entre au catalogue SANS PASSER PAR UNE DECISION — ajouter
 * une ligne aux `atouts` sans l'inscrire ici fait rougir la suite, et le
 * message dit laquelle.
 *
 * LA COLONNE DE DROITE EST LA MESURE, pas une intention. Chaque `livre`
 * a ete verifie en ouvrant l'ecran nomme le 16-08-2026 ; le detail est
 * dans docs/stories/6-6-ne-plus-vendre-ce-qui-n-existe-pas.md.
 */
export const ARGUMENTS_REVUS: Readonly<Record<string, Tenue>> = {
  // Les cinq plafonds — les seuls que le produit fasse respecter.
  "Jusqu'à 20 biens": "plafond",
  "2 utilisateurs": "plafond",
  "Biens illimités": "plafond",
  "10 utilisateurs": "plafond",
  "Utilisateurs illimités": "plafond",
  // Vrai par inclusion : les plafonds d'Enterprise contiennent ceux de Pro.
  "Tout de l'offre Pro": "plafond",

  // Livrees, et accessibles a TOUTES les offres (REP-101).
  "Vitrine en ligne": "livre", // app/vitrine, app/agency/showcase
  "Gestion des clients": "livre", // app/agency/clients
  "Vitrine personnalisée": "livre", // slug, logo, description — app/agency/settings
  "Gestion locative": "livre", // app/agency/rentals, rental-management
  "Documents PDF": "livre", // lib/pdf/
  "Statistiques avancées": "livre", // app/agency/statistics — 6 graphiques

  // Engagements humains. Indecidables depuis le depot.
  "Support email": "service",
  "Support prioritaire": "service",
  "Formation dédiée": "service",
  "Account manager": "service",
  "SLA garanti": "service",

  // RETIREES le 16-08-2026, et volontairement PAS reinscrites ici :
  // « API access » — les 14 routes de app/api sont internes et derriere une
  // session, aucune n'est appelable par une agence — et « Integrations
  // custom », qui ne renvoyait a aucun code. Les remettre aux `atouts` sans
  // les reinscrire ici fait rougir la suite : c'est le but.
}

/**
 * L'offre posee quand personne n'en a choisi.
 *
 * Elle est la moins-disante a dessein : une agence dont l'offre n'a pas
 * ete tranchee ne doit pas se retrouver avec des capacites qu'elle n'a pas
 * demandees, et la remonter est un geste, la redescendre une negociation.
 */
export const OFFRE_PAR_DEFAUT: AgencyPlan = "starter"

/** L'offre portant cette cle. */
export function offre(cle: AgencyPlan): Offre {
  return OFFRES[cle]
}

/** Le nom affichable d'une offre. Aucun ecran ne montre la cle brute. */
export function nomOffre(cle: AgencyPlan): string {
  return OFFRES[cle].nom
}

/**
 * Le nom d'une offre DEMANDEE, y compris quand il n'y en a pas.
 *
 * « aucune » s'ecrit ici, et pas dans chaque ecran, pour une raison qui
 * n'est pas cosmetique : une cellule vide se lit comme une donnee
 * manquante, et une donnee manquante appelle une correction — on finirait
 * par y poser un defaut, c'est-a-dire par inventer un choix du client. Les
 * agences creees par la console, par la graine ou avant la story 6.2 n'ont
 * rien demande, et cela doit se voir.
 */
export function nomOffreDemandee(cle: AgencyPlan | null): string {
  return cle === null ? "aucune" : OFFRES[cle].nom
}

/**
 * Un plafond, ecrit pour un humain.
 *
 * « illimite » s'ecrit ici et pas dans chaque ecran : sinon la moitie
 * d'entre eux afficherait « Illimité », l'autre « ∞ », et un troisieme
 * un blanc.
 */
export function formaterPlafond(valeur: Plafond): string {
  return valeur === null ? "illimité" : String(valeur)
}

/**
 * Ce que l'offre contient REELLEMENT, en une ligne.
 *
 * Volontairement construit sur les deux plafonds et rien d'autre. Les
 * `atouts` melangent trois natures (voir `ARGUMENTS_REVUS`) : des plafonds,
 * des capacites livrees a TOUTES les offres, et des engagements de service.
 * Seuls les deux nombres sont opposables — ce sont les seuls que la story
 * 6.4 fasse respecter. Un formulaire d'inscription qui reprendrait le reste
 * promettrait, au mieux, ce que l'agence aurait de toute facon.
 */
export function resumeOffre(cle: AgencyPlan): string {
  const o = OFFRES[cle]

  const biens = o.plafondBiens === null ? "biens illimités" : `${o.plafondBiens} biens`
  const comptes =
    o.plafondComptes === null ? "utilisateurs illimités" : `${o.plafondComptes} utilisateurs`

  return `${biens} · ${comptes}`
}

/**
 * Le nom du parametre d'URL qui porte l'offre demandee.
 *
 * Ecrit d'un cote (la page tarifaire), lu de l'autre (le formulaire). Une
 * seule definition, sinon les deux moities se desaccordent en silence : le
 * lien continue de fonctionner, la preselection disparait, et rien
 * n'echoue.
 */
export const PARAM_OFFRE = "offre"

/** L'adresse du formulaire d'inscription, portant l'offre demandee (FR-3). */
export function lienInscription(cle: AgencyPlan): string {
  return `/auth/register?${PARAM_OFFRE}=${cle}`
}

/**
 * Lit une offre venue de l'exterieur — parametre d'URL, champ de
 * formulaire — et rend `null` si elle n'est pas au catalogue.
 *
 * `hasOwnProperty` PLUTOT QUE `in` : `"constructor" in OFFRES` vaut vrai,
 * et un `in` laisserait donc passer les proprietes heritees d'Object,
 * castees en `AgencyPlan` sans en etre.
 *
 * UNE VALEUR INCONNUE N'EST PAS UNE ERREUR ICI (FR-3). Un signet d'avant
 * la livraison, ou une URL bricolee, doit poser un formulaire sans
 * preselection — pas une page d'erreur. Le refus se joue plus loin, au
 * schema Zod, la ou il decide de quelque chose.
 */
export function offreDuCatalogue(valeur: unknown): AgencyPlan | null {
  if (typeof valeur !== "string") return null

  return Object.prototype.hasOwnProperty.call(OFFRES, valeur)
    ? (valeur as AgencyPlan)
    : null
}
