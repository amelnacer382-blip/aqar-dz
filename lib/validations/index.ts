import { z } from "zod"
import {
  PropertyCategory,
  PropertyType,
  PropertyStatus,
  OperationType,
  ClientType,
  ClientStatus,
  VisitStatus,
  InterestLevel,
  SaleStatus,
  RentalStatus,
  PaymentType,
  PaymentMethod,
  PaymentStatus,
  DocumentType,
  InteractionType,
  LeadStatus,
  AgencyStatus,
  AgencyPlan,
} from "@prisma/client"

// ==========================================
// HELPERS
// ==========================================

/**
 * Un champ absent du FormData arrive en `undefined` (typiquement une case
 * decochee ou un <Select> jamais ouvert). On normalise tout en chaine vide
 * avant validation pour que "absent" et "vide" soient traites pareil.
 */
const asText = (v: unknown) =>
  v === undefined || v === null ? "" : String(v).trim()

/** Champ texte facultatif : "" devient null plutot que chaine vide. */
const optionalText = z.preprocess(
  asText,
  z.string().transform((v) => (v === "" ? null : v))
)

/**
 * LES BORNES HAUTES — story 3.1, BUG-05 et BUG-11.
 *
 * Sans elles, une saisie trop grande n'etait pas refusee : elle partait
 * jusqu'a PostgreSQL, qui la rejetait par une erreur brute. L'agent
 * recevait un ecran technique et PERDAIT sa saisie.
 *
 * Les deux valeurs sont MESUREES, le 17-08-2026, contre la base, sur des
 * expressions pures (aucune table touchee) :
 *
 *   OK      numeric(15,2) <- 9999999999999.99
 *   REFUSE  numeric(15,2) <- 10000000000000    numeric field overflow  (22003)
 *   OK      int4          <- 2147483647
 *   REFUSE  int4          <- 2147483648        integer out of range    (22003)
 *
 * Elles ne se devinent pas depuis le schema Prisma : `Decimal(15, 2)`
 * compte les chiffres TOTAUX, donc 13 avant la virgule et non 15.
 */

/** Plus grande valeur qu'accepte une colonne `Decimal(15, 2)`. Mesure. */
const MONTANT_MAX = 9_999_999_999_999.99

/** Plus grand entier signe 32 bits — le `Int` de PostgreSQL. Mesure. */
const ENTIER_MAX = 2_147_483_647

/** Nombre facultatif depuis un input HTML (qui envoie toujours une chaine). */
const optionalNumber = z.preprocess(
  asText,
  z
    .string()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || Number.isFinite(v), "Nombre invalide")
    .refine((v) => v === null || v >= 0, "La valeur ne peut pas etre negative")
    .refine(
      (v) => v === null || v <= MONTANT_MAX,
      "Le montant depasse le maximum enregistrable (9 999 999 999 999,99)"
    )
)

/** Nombre obligatoire et positif. */
const requiredAmount = z.preprocess(
  asText,
  z
    .string()
    .min(1, "Montant requis")
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v), "Montant invalide")
    .refine((v) => v >= 0, "Le montant ne peut pas etre negatif")
    .refine(
      (v) => v <= MONTANT_MAX,
      "Le montant depasse le maximum enregistrable (9 999 999 999 999,99)"
    )
)

/**
 * Entier facultatif et positif.
 *
 * LA BORNE RESTE CELLE DE LA COLONNE, ET PAS UNE BORNE DE LOGEMENT.
 * `Document.size` partage cette primitive et vaut des OCTETS : le borner a
 * une centaine casserait tout televersement. Les champs d'un bien
 * recoivent leurs bornes realistes par-dessus, via `entierBorne()`.
 */
const optionalInt = z.preprocess(
  asText,
  z
    .string()
    .transform((v) => (v === "" ? null : parseInt(v, 10)))
    .refine((v) => v === null || Number.isInteger(v), "Nombre entier invalide")
    .refine((v) => v === null || v >= 0, "La valeur ne peut pas etre negative")
    .refine(
      (v) => v === null || v <= ENTIER_MAX,
      "La valeur depasse le maximum enregistrable"
    )
)

/**
 * Entier facultatif, positif, et borne a une valeur REALISTE.
 *
 * Le message porte la borne : « valeur invalide » laisse l'agent deviner
 * ce qu'on attend de lui, et c'est sa saisie qui est en jeu.
 */
const entierBorne = (max: number, message: string) =>
  z.preprocess(
    asText,
    z
      .string()
      .transform((v) => (v === "" ? null : parseInt(v, 10)))
      .refine((v) => v === null || Number.isInteger(v), "Nombre entier invalide")
      .refine((v) => v === null || v >= 0, "La valeur ne peut pas etre negative")
      .refine((v) => v === null || v <= max, message)
  )

/**
 * Un TAUX en pourcentage, de 0 a 100 inclus.
 *
 * BUG-05, et la borne haute n'est que la moitie du defaut. La colonne
 * `Decimal(5, 2)` refusait deja 1000 — par une erreur brute, saisie perdue
 * — mais elle ACCEPTAIT 150, et la gestion locative calculait alors 150 %
 * du loyer. Un chiffre absurde applique fidelement.
 *
 * 100 EST INCLUS a dessein : un mandat a 100 % est une valeur legitime.
 *
 * A N'APPLIQUER QU'A `Property.commission`. « Commission » designe trois
 * choses dans ce schema, et deux d'entre elles sont des MONTANTS en
 * `Decimal(15, 2)` — `Sale.commission` et `RentalManagement.commission`.
 * Poser ce taux sur le nom du champ plutot que sur sa colonne rendrait
 * impossible toute commission de vente au-dela de 100 DA.
 */
const tauxPourcent = z.preprocess(
  asText,
  z
    .string()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || Number.isFinite(v), "Nombre invalide")
    .refine(
      (v) => v === null || (v >= 0 && v <= 100),
      "La commission s'exprime en pourcentage du loyer ou du prix de vente, entre 0 et 100"
    )
)

/**
 * « 2026-07-15 » designe un JOUR CIVIL, pas un instant UTC (BUG-40).
 *
 * `new Date("2026-07-15")` rend MINUIT UTC — soit, a Alger, une heure du
 * matin le 15, et la veille a 19 h a New York. Le produit, lui, ecrit ses
 * dates a minuit LOCAL (mesure du 18-08-2026 : `Visit.date` a
 * `T23:00:00.000Z`, cinq lignes sur cinq en UTC+1).
 *
 * Melanger les deux conventions faisait deriver l'aller-retour d'un jour :
 * le formulaire affichait la veille, et l'enregistrement l'ecrivait. On lit
 * donc en parties locales (`toDateInputValue`) et on relit ici a minuit
 * local — les deux bouts de la meme convention, qui ne peuvent pas bouger
 * l'un sans l'autre.
 *
 * Une valeur qui porte deja une heure (`2026-07-15T14:30`) est laissee a
 * `new Date()` : elle designe un instant, pas un jour.
 */
function jourCivilLocal(valeur: string): Date {
  const jour = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valeur)

  if (!jour) return new Date(valeur)

  return new Date(Number(jour[1]), Number(jour[2]) - 1, Number(jour[3]))
}

/** Date obligatoire. */
const requiredDate = z.preprocess(
  asText,
  z
    .string()
    .min(1, "Date requise")
    .transform(jourCivilLocal)
    .refine((d) => !Number.isNaN(d.getTime()), "Date invalide")
)

/** Date facultative. */
const optionalDate = z.preprocess(
  asText,
  z
    .string()
    .transform((v) => (v === "" ? null : jourCivilLocal(v)))
    .refine((d) => d === null || !Number.isNaN(d.getTime()), "Date invalide")
)

/** Case a cocher HTML : presente = "on", absente = false. */
const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean())

/** Identifiant relationnel facultatif (les <Select> vides envoient ""). */
const optionalId = z.preprocess(
  asText,
  z.string().transform((v) => (v === "" || v === "none" ? null : v))
)

const requiredId = z.preprocess(
  asText,
  z.string().min(1, "Selection requise")
)

/** Telephone algerien souple : chiffres, espaces, +, -, points. */
const optionalPhone = z.preprocess(
  asText,
  z
    .string()
    .transform((v) => (v === "" ? null : v))
    .refine(
      (v) => v === null || /^[+0-9][0-9\s.\-()]{5,19}$/.test(v),
      "Numero de telephone invalide"
    )
)

/** Email facultatif. */
const optionalEmail = z.preprocess(
  asText,
  z
    .string()
    .transform((v) => (v === "" ? null : v))
    .refine(
      (v) => v === null || z.string().email().safeParse(v).success,
      "Email invalide"
    )
)

/** Enum facultatif : "" ou absent devient null. */
function optionalEnum<T extends Record<string, string>>(e: T) {
  return z.preprocess(
    (v) => (asText(v) === "" || asText(v) === "none" ? null : asText(v)),
    z.nativeEnum(e).nullable()
  )
}

/** Enum avec valeur de repli quand le champ est absent ou vide. */
function enumWithDefault<T extends Record<string, string>>(e: T, fallback: T[keyof T]) {
  return z.preprocess(
    (v) => (asText(v) === "" ? fallback : asText(v)),
    z.nativeEnum(e)
  )
}

/** Note de 1 a 5, facultative. */
const optionalRating = z.preprocess(
  asText,
  z
    .string()
    .transform((v) => (v === "" ? null : parseInt(v, 10)))
    .refine(
      (v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 5),
      "La note doit etre comprise entre 1 et 5"
    )
)

// ==========================================
// AUTH
// ==========================================

/**
 * Adresse email servant d'identifiant de connexion.
 *
 * Normalisee des l'entree, et c'est la seule facon qui tienne : la
 * contrainte @unique de PostgreSQL est sensible a la casse, donc
 * `Contact@ImmoAlger.dz` et `contact@immoalger.dz` y sont deux lignes
 * distinctes. Une agence qui s'inscrivait avec la casse de ses cartes de
 * visite se retrouvait enfermee dehors des qu'un collegue tapait
 * l'adresse en minuscules — et « mot de passe oublie » ne la sortait pas
 * de la, puisqu'il repond volontairement la meme chose que le compte
 * existe ou non.
 *
 * Effet de bord voulu : les compteurs de limitation de debit qui prennent
 * l'email pour cle (`login:compte:`, `explication:compte:`, `oubli:compte:`)
 * deviennent insensibles a la casse eux aussi. Sans cela, faire varier une
 * majuscule offrait un budget de tentatives neuf a chaque fois.
 */
const identityEmail = z.string().trim().toLowerCase().email("Email invalide")

export const loginSchema = z.object({
  email: identityEmail,
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caracteres"),
})

/**
 * Inscription publique.
 *
 * Seul schema de ce fichier dont les messages sont accentues, et c'est
 * volontaire : c'est le seul dont les erreurs soient affichees a un
 * visiteur qui n'a pas encore de compte. Les echecs de `loginSchema`, eux,
 * n'atteignent jamais l'ecran — `authorize()` renvoie null et
 * `explainLoginFailure()` renvoie un message generique.
 *
 * Le reste du fichier est ecrit sans accents. C'est une dette de forme, pas
 * une convention a etendre : voir docs/stories/deferred-work.md.
 */
export const registerSchema = z.object({
  // Borne : ce nom entre dans le SUJET de deux emails, dans le <h1> de
  // l'email d'activation et dans le corps de celui envoye aux super
  // admins. Le formulaire d'inscription est public et non authentifie.
  // Il n'avait qu'un `min(2)`, comme `leadSchema` avant la story 1.5 —
  // et le meme raisonnement s'y applique.
  agencyName: z
    .string()
    .trim()
    .min(2, "Le nom de l'agence est requis")
    .max(120, "Le nom de l'agence est trop long"),
  email: identityEmail,
  phone: z.string().optional(),
  wilaya: z.string().trim().min(1, "La wilaya est requise"),
  address: z.string().optional(),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  /**
   * L'offre DEMANDEE. Obligatoire : FR-4 refuse l'inscription tant qu'aucune
   * offre n'est choisie, parce qu'une demande vide oblige le super
   * administrateur a deviner a l'approbation.
   *
   * Le meme message couvre les deux echecs — champ absent et valeur hors
   * catalogue — a dessein : dire « offre inconnue » a quelqu'un qui n'a
   * rien choisi ne l'aide pas, et detailler ce qui a ete recu renseigne
   * surtout celui qui bricole le corps de la requete.
   *
   * ⚠ Ce champ n'accorde RIEN. La route pose l'offre attribuee a
   * `OFFRE_PAR_DEFAUT` sans jamais le lire (FR-5).
   */
  requestedPlan: z.nativeEnum(AgencyPlan, {
    errorMap: () => ({ message: "Choisissez une offre pour continuer" }),
  }),
})

// ==========================================
// BIEN
// ==========================================

export const propertySchema = z
  .object({
    title: z.string().trim().min(3, "Le titre doit contenir au moins 3 caracteres"),
    category: z.nativeEnum(PropertyCategory, {
      errorMap: () => ({ message: "Categorie invalide" }),
    }),
    type: z.nativeEnum(PropertyType, {
      errorMap: () => ({ message: "Type de bien invalide" }),
    }),
    operationType: z.nativeEnum(OperationType, {
      errorMap: () => ({ message: "Type d'operation invalide" }),
    }),
    status: enumWithDefault(PropertyStatus, PropertyStatus.disponible),
    wilaya: z.string().trim().min(1, "La wilaya est requise"),
    commune: z.string().trim().min(1, "La commune est requise"),
    quartier: optionalText,
    address: optionalText,
    // `surface` reste sur `optionalNumber` A DESSEIN : la colonne est un
    // `Float`, pas un `Decimal` — elle ne deborde pas, donc elle n'est ni
    // dans BUG-05 ni dans BUG-11. Lui donner une borne « realiste » serait
    // un arbitrage produit (quelle surface maximale pour un terrain
    // agricole ?), qui n'appartient pas au developpeur (CLAUDE.md §13).
    surface: optionalNumber,
    // 100 pieces et 200 etages sont des CHOIX, pas des mesures : une
    // agence immobiliere algerienne, et le plus haut batiment du monde
    // compte 163 etages. Reversibles en une ligne. Maximum reellement
    // observe en base le 17-08-2026 : 7 pieces, 6 etages.
    rooms: entierBorne(100, "Le nombre de pieces ne peut pas depasser 100"),
    bedrooms: entierBorne(100, "Le nombre de chambres ne peut pas depasser 100"),
    bathrooms: entierBorne(100, "Le nombre de salles de bain ne peut pas depasser 100"),
    floor: entierBorne(200, "L'etage ne peut pas depasser 200"),
    totalFloors: entierBorne(200, "Le nombre d'etages ne peut pas depasser 200"),
    salePrice: optionalNumber,
    rentPrice: optionalNumber,
    // UN TAUX, ET NON UN MONTANT — la colonne est `Decimal(5, 2)`. Voir
    // `tauxPourcent` : les deux autres `commission` du schema sont des
    // montants, et cette borne ne doit surtout pas les atteindre.
    commission: tauxPourcent,
    shortDescription: optionalText,
    description: optionalText,
    ownerId: optionalId,
    hasGarage: checkbox,
    hasGarden: checkbox,
    hasTerrace: checkbox,
    isFurnished: checkbox,
  })
  .refine(
    (d) => d.operationType !== "vente" || d.salePrice !== null,
    { message: "Un bien en vente doit avoir un prix de vente", path: ["salePrice"] }
  )
  .refine(
    (d) =>
      (d.operationType !== "location" && d.operationType !== "gestion_locative") ||
      d.rentPrice !== null,
    { message: "Un bien en location doit avoir un loyer", path: ["rentPrice"] }
  )

// ==========================================
// PROPRIETAIRE
// ==========================================

export const ownerSchema = z.object({
  firstName: z.string().trim().min(2, "Le prenom est requis"),
  lastName: z.string().trim().min(2, "Le nom est requis"),
  phone: optionalPhone,
  email: optionalEmail,
  address: optionalText,
  idCardNumber: optionalText,
  notes: optionalText,
})

// ==========================================
// CLIENT
// ==========================================

export const clientSchema = z.object({
  firstName: z.string().trim().min(2, "Le prenom est requis"),
  lastName: z.string().trim().min(2, "Le nom est requis"),
  phone: optionalPhone,
  email: optionalEmail,
  budget: optionalNumber,
  propertyType: optionalEnum(PropertyType),
  category: optionalEnum(PropertyCategory),
  wilaya: optionalText,
  type: enumWithDefault(ClientType, ClientType.interesse),
  status: enumWithDefault(ClientStatus, ClientStatus.nouveau),
  notes: optionalText,
})

// ==========================================
// VISITE
// ==========================================

export const visitSchema = z.object({
  date: requiredDate,
  time: z.string().trim().min(1, "L'heure est requise"),
  clientId: requiredId,
  propertyId: requiredId,
  agentId: optionalId,
  status: enumWithDefault(VisitStatus, VisitStatus.prevue),
  interestLevel: optionalEnum(InterestLevel),
  rating: optionalRating,
  priceFeedback: optionalText,
  followUpDate: optionalDate,
  result: optionalText,
  notes: optionalText,
})

// ==========================================
// VENTE
// ==========================================

/*
  `ownerId` N'EST PLUS ACCEPTE ICI, et son absence est le correctif
  (BUG-39, story 3.11).

  Aucun des deux ecrans de vente ne rend ce champ : la valeur ne pouvait
  donc venir que d'un POST forge. Elle etait ecrite telle quelle, SANS
  aucune verification d'agence — et le nom du proprietaire d'une autre
  agence ressortait ensuite dans le contrat PDF, dans l'ecran de gestion
  locative et dans l'export CSV. Reproduit par rejeu le 17-08-2026 :
  l'action a repondu « Vente mise a jour ».

  Le vendeur est desormais DERIVE du bien, qui est verifie, lui. Retirer la
  clef du schema plutot que d'ignorer sa valeur rend le trou impossible a
  rouvrir par distraction : `parseForm` ecarte les champs inconnus.
*/
export const saleSchema = z.object({
  propertyId: requiredId,
  clientId: requiredId,
  finalPrice: requiredAmount,
  commission: optionalNumber,
  saleDate: requiredDate,
  status: enumWithDefault(SaleStatus, SaleStatus.negociation),
})

// ==========================================
// LOCATION
// ==========================================

/* Meme correctif que `saleSchema` ci-dessus : voir son commentaire. */
export const rentalSchema = z
  .object({
    propertyId: requiredId,
    clientId: requiredId,
    startDate: requiredDate,
    endDate: optionalDate,
    monthlyRent: requiredAmount,
    deposit: optionalNumber,
    agencyFees: optionalNumber,
    status: enumWithDefault(RentalStatus, RentalStatus.active),
  })
  .refine((d) => d.endDate === null || d.endDate > d.startDate, {
    message: "La date de fin doit etre posterieure a la date de debut",
    path: ["endDate"],
  })

// ==========================================
// GESTION LOCATIVE (quittance mensuelle)
// ==========================================

export const rentalManagementSchema = z.object({
  rentalId: requiredId,
  month: z
    .string()
    .trim()
    .min(1, "Mois requis")
    .transform((v) => parseInt(v, 10))
    .refine((v) => v >= 1 && v <= 12, "Mois invalide"),
  year: z
    .string()
    .trim()
    .min(1, "Annee requise")
    .transform((v) => parseInt(v, 10))
    .refine((v) => v >= 2000 && v <= 2100, "Annee invalide"),
  rentAmount: requiredAmount,
  charges: optionalNumber,
  expenses: optionalNumber,
  commission: optionalNumber,
  isPaid: checkbox,
  paymentDate: optionalDate,
  notes: optionalText,
})

// ==========================================
// PAIEMENT
// ==========================================

export const paymentSchema = z.object({
  amount: requiredAmount,
  type: z.nativeEnum(PaymentType, {
    errorMap: () => ({ message: "Type de paiement invalide" }),
  }),
  date: requiredDate,
  method: enumWithDefault(PaymentMethod, PaymentMethod.cash),
  status: enumWithDefault(PaymentStatus, PaymentStatus.paye),
  propertyId: optionalId,
  clientId: optionalId,
  ownerId: optionalId,
  rentalId: optionalId,
  saleId: optionalId,
  receipt: optionalText,
  notes: optionalText,
})

// ==========================================
// DOCUMENT
// ==========================================

/**
 * Adresse d'un fichier de document.
 *
 * Ce champ etait une chaine libre venue d'un champ cache du formulaire.
 * Tout le code qui la lisait devait donc s'en mefier — c'est ce que fait
 * `lib/documents.ts`, et c'etait une dette payee a chaque lecture.
 *
 * Deux formes, et deux seulement :
 *
 *   - interne : /uploads/documents/<agence>/<fichier>, ou sans agence
 *     pour les lignes anterieures au 10-08-2026, qu'on ne migre pas ;
 *   - Supabase : l'adresse publique du seau configure, faute de quoi ce
 *     mode deviendrait inutilisable.
 *
 * La FORME ne prouve rien de l'appartenance : `/uploads/documents/
 * <une-autre-agence>/x.pdf` la satisfait. C'est `ownsDocumentUrl` qui
 * tranche, au moment de l'ecriture, la ou l'agence appelante est connue.
 *
 * L'environnement est lu directement : importer `lib/storage.ts` ici
 * tirerait @supabase/supabase-js dans un fichier de schemas.
 */
// Chaque segment commence par un caractere qui n'est pas un point, et
// n'admet ni « / » ni « % ». « .. » et ses formes encodees sont donc hors
// de l'alphabet : la remontee de dossier ne se pose pas, et il n'y a pas
// lieu de la rechercher separement dans la chaine.
//
// Le segment d'agence est OBLIGATOIRE. Une adresse a plat reste lisible
// pour les lignes ecrites avant le 10-08-2026 — mais c'est l'affaire de
// `documentKeyFor`, a la lecture. Un schema d'ECRITURE n'a aucune raison
// d'accepter une forme qu'aucune ecriture ne produit plus.
const SEGMENT = "[A-Za-z0-9_-][A-Za-z0-9._-]*"
const INTERNE = new RegExp(`^/uploads/documents/${SEGMENT}/${SEGMENT}$`)

export const ADRESSE_REFUSEE =
  "Le fichier doit être téléversé depuis ce formulaire"

function echapper(valeur: string): string {
  return valeur.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Motif de l'adresse publique Supabase, ancre comme la forme interne.
 *
 * Deux precautions que la comparaison de prefixe n'avait pas :
 *
 *   - `SUPABASE_URL` est normalisee. `supabase-js` retire les espaces et
 *     la barre finale avant de composer l'adresse publique ; ne pas le
 *     faire ici rendait `https://x.supabase.co/` incompatible avec sa
 *     propre sortie, et **tout depot etait refuse** dans ce mode.
 *   - le motif est ancre et va jusqu'au bout. Un simple `startsWith`
 *     laissait libre tout ce qui suit « documents/ », barres obliques et
 *     sequences encodees comprises.
 */
function motifSupabase(): RegExp | null {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "")
  const seau = process.env.SUPABASE_STORAGE_BUCKET?.trim()

  if (!base || !seau) return null

  return new RegExp(
    `^${echapper(base)}/storage/v1/object/public/${echapper(seau)}` +
      `/documents/${SEGMENT}/${SEGMENT}$`
  )
}

function estAdresseDeDocument(valeur: string): boolean {
  if (INTERNE.test(valeur)) return true

  const motif = motifSupabase()

  return motif !== null && motif.test(valeur)
}

const documentUrl = z
  .string()
  .trim()
  .min(1, "Le fichier est requis")
  .max(512, "Adresse de fichier trop longue")
  .refine(estAdresseDeDocument, ADRESSE_REFUSEE)

export const documentSchema = z.object({
  name: z.string().trim().min(2, "Le nom du document est requis"),
  type: z.nativeEnum(DocumentType, {
    errorMap: () => ({ message: "Type de document invalide" }),
  }),
  url: documentUrl,
  size: optionalInt,
  mimeType: optionalText,
})

// ==========================================
// INTERACTION
// ==========================================

export const interactionSchema = z.object({
  type: z.nativeEnum(InteractionType, {
    errorMap: () => ({ message: "Type d'interaction invalide" }),
  }),
  subject: z.string().trim().min(2, "L'objet est requis"),
  content: optionalText,
  date: requiredDate,
  clientId: optionalId,
  ownerId: optionalId,
})

// ==========================================
// LEAD (formulaire public de la vitrine)
// ==========================================

export const leadSchema = z.object({
  // Bornes : ces deux valeurs entrent dans le SUJET de l'email envoye a
  // l'agence, et dans son corps. Elles n'avaient qu'un `min`, la ou
  // `message` etait borne a 2000 — un nom de cent mille caracteres
  // passait donc entier (BUG-02, story 1.5). Les memes champs de
  // `ownerSchema` et `clientSchema` restent non bornes : ils ne sont
  // atteignables que par une agence connectee, et leur bornage releve
  // de la story 3.1.
  firstName: z
    .string()
    .trim()
    .min(2, "Le prenom est requis")
    .max(80, "Le prenom est trop long"),
  lastName: z
    .string()
    .trim()
    .min(2, "Le nom est requis")
    .max(80, "Le nom est trop long"),
  phone: optionalPhone,
  email: optionalEmail,
  message: z
    .string()
    .trim()
    .min(10, "Votre message doit contenir au moins 10 caracteres")
    .max(2000, "Votre message est trop long"),
  propertyId: optionalId,
})

/**
 * Changement de statut d'un message recu par la vitrine, depuis la liste.
 *
 * La liste acceptee vient de l'enumeration Prisma, pas d'une table
 * d'etiquettes : elle etait jusqu'ici confrontee a `LEAD_STATUS_LABELS`
 * avec `in`, puis castee en
 * `"nouveau" | "traite" | "archive"` — c'est-a-dire six valeurs heritees
 * d'Object en plus des trois vraies (story 3.2, BUG-38).
 *
 * `id` n'etait pas valide non plus. `requiredId` n'impose qu'un `min(1)` :
 * il ne change rien pour un identifiant reel, et rend « Selection requise »
 * la ou un champ vide obtenait « Message introuvable » apres un aller-retour
 * en base.
 */
export const leadStatusSchema = z.object({
  id: requiredId,
  status: z.nativeEnum(LeadStatus, {
    errorMap: () => ({ message: "Statut inconnu" }),
  }),
})

// ==========================================
// AGENCE (parametres)
// ==========================================

export const agencySettingsSchema = z.object({
  name: z.string().trim().min(2, "Le nom de l'agence est requis"),
  phone: optionalPhone,
  address: optionalText,
  wilaya: optionalText,
  commune: optionalText,
  slug: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v.toLowerCase()))
    .nullable()
    .refine(
      (v) => v === null || /^[a-z0-9-]{3,40}$/.test(v),
      "L'identifiant doit contenir 3 a 40 caracteres : lettres minuscules, chiffres et tirets"
    ),
  description: optionalText,
  showcaseEnabled: checkbox,
  logo: optionalText,
})

export const agencyStatusSchema = z.object({
  agencyId: requiredId,
  status: z.nativeEnum(AgencyStatus, {
    errorMap: () => ({ message: "Statut invalide" }),
  }),
  /**
   * L'offre attribuee DANS LE MEME GESTE que l'approbation (story 6.3,
   * FR-7). L'editeur voit ce qui a ete demande et tranche la, sans passer
   * par un second ecran.
   *
   * OPTIONNELLE, et c'est la garde : les boutons « suspendre » et
   * « remettre en attente » ne portent pas ce champ. Une absence doit
   * laisser l'offre intacte — la traiter comme un defaut a poser
   * retrograderait une agence a chaque suspension.
   */
  plan: z
    .nativeEnum(AgencyPlan, {
      errorMap: () => ({ message: "Offre inconnue" }),
    })
    .optional(),
})

/**
 * Attribution d'une offre a une agence, par le super administrateur.
 *
 * La liste des valeurs acceptees n'est pas ecrite ici : elle vient de
 * l'enumeration Prisma, qui vient du catalogue (`lib/offres.ts`). Une
 * quatrieme offre ajoutee la-bas devient acceptable ici sans que personne
 * n'ait a y penser — et une offre retiree devient refusee, ce qui est
 * l'autre moitie de l'affaire.
 *
 * ⚠ CE QUE CE SCHEMA PROTEGE EXACTEMENT — MESURE PAR MUTATION LE
 * 16-08-2026, parce que la premiere redaction l'affirmait de travers.
 *
 * Remplace par `z.string()`, une valeur hors catalogue traverse jusqu'a
 * Prisma, qui la refuse : la colonne est une enumeration PostgreSQL. LA
 * DONNEE RESTE DONC PROTEGEE SANS CE SCHEMA — l'assertion de test qui
 * verifie que l'offre n'a pas change est restee VERTE pendant la mutation.
 *
 * Ce qui tombe sans lui, c'est le REFUS LISIBLE : on obtient un
 * `PrismaClientValidationError` en 500 au lieu de « Offre inconnue » a
 * l'ecran. Ce schema fournit le message et la sortie propre, pas le
 * verrou. Les deux comptent, mais il ne faut pas confondre lequel fait
 * quoi le jour ou l'on voudra en retirer un.
 */
export const agencyPlanSchema = z.object({
  agencyId: requiredId,
  plan: z.nativeEnum(AgencyPlan, {
    errorMap: () => ({ message: "Offre inconnue" }),
  }),
})

// ==========================================
// COMPTES DE L'AGENCE
// ==========================================

/**
 * Creation d'un compte par l'administrateur de l'agence.
 *
 * Le role est restreint aux deux roles internes : un administrateur
 * d'agence ne doit jamais pouvoir fabriquer un super_admin.
 */
export const agencyUserSchema = z.object({
  name: z.string().trim().min(2, "Le nom est requis"),
  email: z.string().trim().toLowerCase().email("Email invalide"),
  role: z.enum(["agency_admin", "agent"], {
    errorMap: () => ({ message: "Rôle inconnu" }),
  }),
  password: z
    .string()
    .min(6, "Le mot de passe doit contenir au moins 6 caractères"),
})
