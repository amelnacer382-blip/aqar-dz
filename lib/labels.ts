/**
 * Libelles francais des enums Prisma.
 *
 * Ces tables etaient jusqu'ici recopiees en haut de chaque page, ce qui
 * produisait des libelles divergents d'un ecran a l'autre. Elles sont
 * desormais partagees par les pages, les PDF et la vitrine publique.
 */

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  appartement: "Appartement",
  villa: "Villa",
  studio: "Studio",
  duplex: "Duplex",
  maison: "Maison",
  residence: "Résidence",
  terrain_constructible: "Terrain constructible",
  local_commercial: "Local commercial",
  boutique: "Boutique",
  showroom: "Showroom",
  restaurant: "Restaurant",
  cafe: "Café",
  magasin: "Magasin",
  bureau: "Bureau",
  cabinet_medical: "Cabinet médical",
  espace_coworking: "Espace coworking",
  immeuble_professionnel: "Immeuble professionnel",
  plateau_bureaux: "Plateau de bureaux",
  hangar: "Hangar",
  entrepot: "Entrepôt",
  usine: "Usine",
  depot: "Dépôt",
  terrain_industriel: "Terrain industriel",
  bungalow: "Bungalow",
  villa_vacances: "Villa de vacances",
  residence_estivale: "Résidence estivale",
  appartement_saisonnier: "Appartement saisonnier",
  chalet: "Chalet",
  maison_hotes: "Maison d'hôtes",
  terrain_agricole: "Terrain agricole",
  ferme: "Ferme",
  exploitation_agricole: "Exploitation agricole",
  serre_agricole: "Serre agricole",
  domaine_agricole: "Domaine agricole",
}

export const PROPERTY_CATEGORY_LABELS: Record<string, string> = {
  residentiel: "Résidentiel",
  commercial: "Commercial",
  professionnel: "Professionnel",
  industriel: "Industriel",
  touristique: "Touristique",
  agricole: "Agricole",
}

export const PROPERTY_STATUS_LABELS: Record<string, string> = {
  disponible: "Disponible",
  vendu: "Vendu",
  loue: "Loué",
  reserve: "Réservé",
  archive: "Archivé",
}

export const PROPERTY_STATUS_COLORS: Record<string, string> = {
  disponible: "bg-green-100 text-green-800",
  vendu: "bg-blue-100 text-blue-800",
  loue: "bg-purple-100 text-purple-800",
  reserve: "bg-yellow-100 text-yellow-800",
  archive: "bg-slate-100 text-slate-800",
}

export const OPERATION_TYPE_LABELS: Record<string, string> = {
  vente: "Vente",
  location: "Location",
  gestion_locative: "Gestion locative",
}

/** Formulation orientee client, pour la vitrine publique. */
export const OPERATION_PUBLIC_LABELS: Record<string, string> = {
  vente: "À vendre",
  location: "À louer",
  gestion_locative: "À louer",
}

export const CLIENT_TYPE_LABELS: Record<string, string> = {
  acheteur: "Acheteur",
  locataire: "Locataire",
  investisseur: "Investisseur",
  interesse: "Intéressé",
}

export const CLIENT_STATUS_LABELS: Record<string, string> = {
  nouveau: "Nouveau",
  interesse: "Intéressé",
  visite_prevue: "Visite prévue",
  client_chaud: "Client chaud",
  conclu: "Conclu",
  perdu: "Perdu",
}

export const CLIENT_STATUS_COLORS: Record<string, string> = {
  nouveau: "bg-slate-100 text-slate-800",
  interesse: "bg-blue-100 text-blue-800",
  visite_prevue: "bg-yellow-100 text-yellow-800",
  client_chaud: "bg-orange-100 text-orange-800",
  conclu: "bg-green-100 text-green-800",
  perdu: "bg-red-100 text-red-800",
}

export const VISIT_STATUS_LABELS: Record<string, string> = {
  prevue: "Prévue",
  effectuee: "Effectuée",
  annulee: "Annulée",
  reportee: "Reportée",
}

export const VISIT_STATUS_COLORS: Record<string, string> = {
  prevue: "bg-blue-100 text-blue-800",
  effectuee: "bg-green-100 text-green-800",
  annulee: "bg-red-100 text-red-800",
  reportee: "bg-yellow-100 text-yellow-800",
}

export const INTEREST_LEVEL_LABELS: Record<string, string> = {
  tres_interesse: "Très intéressé",
  interesse: "Intéressé",
  mitige: "Mitigé",
  pas_interesse: "Pas intéressé",
}

export const INTEREST_LEVEL_COLORS: Record<string, string> = {
  tres_interesse: "bg-green-100 text-green-800",
  interesse: "bg-blue-100 text-blue-800",
  mitige: "bg-yellow-100 text-yellow-800",
  pas_interesse: "bg-red-100 text-red-800",
}

export const SALE_STATUS_LABELS: Record<string, string> = {
  negociation: "En négociation",
  compromis: "Compromis signé",
  vendu: "Vendu",
  annule: "Annulé",
}

export const SALE_STATUS_COLORS: Record<string, string> = {
  negociation: "bg-yellow-100 text-yellow-800",
  compromis: "bg-blue-100 text-blue-800",
  vendu: "bg-green-100 text-green-800",
  annule: "bg-red-100 text-red-800",
}

export const RENTAL_STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  terminee: "Terminée",
  annulee: "Annulée",
}

export const RENTAL_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  terminee: "bg-slate-100 text-slate-800",
  annulee: "bg-red-100 text-red-800",
}

export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  loyer: "Loyer",
  caution: "Caution",
  commission_agence: "Commission agence",
  frais_dossier: "Frais de dossier",
  avance: "Avance",
  paiement_proprietaire: "Reversement propriétaire",
  abonnement_saas: "Abonnement SaaS",
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Espèces",
  virement: "Virement",
  ccp: "CCP",
  autre: "Autre",
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paye: "Payé",
  partiel: "Partiel",
  impaye: "Impayé",
}

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paye: "bg-green-100 text-green-800",
  partiel: "bg-yellow-100 text-yellow-800",
  impaye: "bg-red-100 text-red-800",
}

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  contrat_vente: "Contrat de vente",
  contrat_location: "Contrat de location",
  recu_paiement: "Reçu de paiement",
  fiche_bien: "Fiche de bien",
  rapport_proprietaire: "Rapport propriétaire",
  piece_identite: "Pièce d'identité",
  acte_propriete: "Acte de propriété",
  image_bien: "Image du bien",
  plan_bien: "Plan du bien",
}

export const INTERACTION_TYPE_LABELS: Record<string, string> = {
  appel: "Appel téléphonique",
  email: "Email",
  sms: "SMS",
  rendez_vous: "Rendez-vous",
  visite: "Visite",
  note: "Note interne",
  relance: "Relance",
}

export const INTERACTION_TYPE_COLORS: Record<string, string> = {
  appel: "bg-blue-100 text-blue-800",
  email: "bg-purple-100 text-purple-800",
  sms: "bg-cyan-100 text-cyan-800",
  rendez_vous: "bg-orange-100 text-orange-800",
  visite: "bg-green-100 text-green-800",
  note: "bg-slate-100 text-slate-800",
  relance: "bg-yellow-100 text-yellow-800",
}

export const LEAD_STATUS_LABELS: Record<string, string> = {
  nouveau: "Nouveau",
  traite: "Traité",
  archive: "Archivé",
}

export const LEAD_STATUS_COLORS: Record<string, string> = {
  nouveau: "bg-blue-100 text-blue-800",
  traite: "bg-green-100 text-green-800",
  archive: "bg-slate-100 text-slate-800",
}

export const AGENCY_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  active: "Active",
  suspended: "Suspendue",
}

export const AGENCY_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  suspended: "bg-red-100 text-red-800",
}

/**
 * Cette valeur venue de l'exterieur est-elle une CLE PROPRE de la table ?
 *
 * `hasOwnProperty` PLUTOT QUE `in`, et c'est tout l'objet de la story 3.2 :
 * l'operateur `in` remonte la chaine de prototypes. Sept ecrans confrontaient
 * un parametre d'URL ou un champ de formulaire a une de ces tables avec `in`,
 * puis castaient le resultat vers une enumeration Prisma.
 *
 * MESURE LE 17-08-2026, sur la forme reelle de ces tables :
 *
 *   PASSE  "nouveau" "traite" "archive"        <- les vrais statuts
 *   refuse "supprime" ""                       <- ce que la garde attrapait
 *   PASSE  "constructor" "toString" "valueOf"  <- ce qu'elle laissait passer
 *   PASSE  "__proto__" "hasOwnProperty" "isPrototypeOf"
 *
 * Remis a Prisma, ces six-la levent un `PrismaClientValidationError` — donc
 * une page d'erreur technique, au lieu du message francais recu partout
 * ailleurs. La DONNEE, elle, n'a jamais ete en danger : la colonne est une
 * enumeration PostgreSQL et refuse de son cote. C'est le REFUS LISIBLE qui
 * manquait.
 *
 * Le depot avait deja tranche ce point pour le catalogue d'offres
 * (`lib/offres.ts`, `offreDuCatalogue`) — la lecon n'avait ete appliquee
 * qu'a ce fichier-la.
 */
export function estCleConnue(
  map: Record<string, string>,
  valeur: unknown
): boolean {
  if (typeof valeur !== "string") return false

  return Object.prototype.hasOwnProperty.call(map, valeur)
}

/**
 * Recherche tolerante : renvoie la valeur brute si aucun libelle n'existe.
 *
 * Passe par `estCleConnue` pour la meme raison, et ce n'etait pas theorique :
 * `map["toString"]` rendait la FONCTION heritee d'Object, remise telle quelle
 * a React comme enfant de noeud.
 */
export function label(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "-"
  return estCleConnue(map, key) ? map[key] : key
}
