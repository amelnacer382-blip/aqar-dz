import { isIP } from "node:net"
import { headers } from "next/headers"

/**
 * Limitation du nombre de tentatives sur les points d'entree publics.
 *
 * Trois endroits en ont besoin, et pour trois raisons differentes :
 *  - la connexion, contre l'essai systematique de mots de passe ;
 *  - la demande de reinitialisation, pour ne pas transformer le serveur
 *    en machine a envoyer des emails a une adresse qu'on ne possede pas ;
 *  - le formulaire public de la vitrine, dont le piege a robots ne
 *    retient que les plus naifs.
 *
 * PORTEE : le compteur vit dans la memoire du processus. Sur un serveur
 * unique — le cas d'un VPS, celui prevu ici — il fait exactement son
 * travail. Derriere plusieurs instances, chacune compte de son cote : la
 * limite reelle est alors multipliee par leur nombre. C'est une premiere
 * barriere, pas un pare-feu ; devant plusieurs instances, il faut la
 * refaire porter par un magasin partage (Redis) ou par le reverse proxy.
 */

/**
 * Un compteur, et la trace de la fenetre qui vient de s'achever.
 *
 * `precedent` est ce qui rend la fenetre GLISSANTE : sans lui, le comptage
 * repartait de zero a chaque bascule, et il suffisait d'attendre la
 * frontiere pour depenser deux budgets en quelques secondes (REP-38).
 *
 * `windowMs` est retenu pour le menage : une entree n'est jetable que
 * lorsque sa fenetre precedente est elle aussi entierement sortie du
 * champ, sans quoi on effacerait la memoire que ce mecanisme existe pour
 * garder.
 */
type Bucket = {
  count: number
  precedent: number
  resetAt: number
  windowMs: number
}

const buckets = new Map<string, Bucket>()

/** Age au-dela duquel une entree expiree est jetee lors du menage. */
const SWEEP_EVERY_MS = 5 * 60 * 1000
let lastSweep = 0

/**
 * Nombre maximal de compteurs vivants.
 *
 * `adresseValide` contraint la FORME d'une adresse, jamais leur NOMBRE :
 * un appelant disposant d'un /64 IPv6 — allocation residentielle
 * ordinaire — ouvre une entree par requete, chacune vivante une heure
 * pour l'inscription et la vitrine. Mesure faite : 500 000 cles coutent
 * 94 Mo, et un balayage sur deux millions d'entrees bloque la boucle
 * d'evenements 420 ms, boucle que TOUTE requete peut declencher.
 *
 * Au plafond, on refuse de CREER une entree, et on n'en evince aucune.
 * Le sens de ce choix : evincer reviendrait a offrir a l'attaquant le
 * moyen d'effacer le compteur de sa victime, c'est-a-dire le defaut
 * qu'on vient de fermer. Sous inondation, les appelants deja comptes
 * gardent donc leur compteur et les nouveaux venus sont refuses — une
 * indisponibilite bornee et volontaire, plutot qu'un processus qui
 * s'effondre.
 *
 * La vraie reponse est un magasin partage et borne (BUG-18, story 5.6).
 *
 * ⚠ ET CE MODULE NE REPOND PAS A CELUI QUI POSSEDE PLUSIEURS ADRESSES.
 * Botnet, sortie mobile en CGNAT, fournisseur de proxys residentiels :
 * compter par adresse ne freine que celui qui n'en a qu'une. Il y faut une
 * epreuve dont le cout est porte par l'appelant — captcha, preuve de
 * travail — ou un signal de reputation. C'est REP-34, et ce n'est PAS
 * couvert ici : les deux points exposes sont l'inscription et le formulaire
 * public de la vitrine.
 */
const MAX_COMPTEURS = 50_000
let plafondSignale = false

/**
 * Retire les compteurs expires.
 *
 * Sans ce menage, la table grossit d'une entree par adresse IP vue et ne
 * redescend jamais : c'est une fuite de memoire lente sur un serveur qui
 * tourne des mois.
 */
function sweep(now: number, force = false) {
  if (!force && now - lastSweep < SWEEP_EVERY_MS) return
  lastSweep = now

  buckets.forEach((bucket, key) => {
    // Une fenetre entiere APRES la fin de la courante : au-dela, la
    // precedente ne pese plus rien et l'entree ne dit plus rien.
    if (bucket.resetAt + bucket.windowMs <= now) {
      buckets.delete(key)
    }
  })
}

export type RateLimitResult = {
  ok: boolean
  /** Secondes restantes avant de pouvoir reessayer. */
  retryAfter: number
  /**
   * De combien le budget est depasse, en tentatives, au moment du refus.
   *
   * Vaut 0 tant que l'appel est accepte. Il sert a rendre une penalite
   * PROGRESSIVE : un delai plat ne coute rien a qui parallelise, alors
   * qu'un delai qui double a chaque essai finit par coûter, meme en
   * parallele. Voir `penaliserEchec` dans `auth.ts`.
   */
  depassement: number
}

/**
 * Consomme une tentative, sur une fenetre GLISSANTE.
 *
 * La fenetre qui s'acheve est conservee et ponderee par la part d'elle-meme
 * qui chevauche encore la fenetre courante : a la bascule elle compte pour
 * presque tout, une fenetre plus tard pour rien. Une fenetre FIXE remettait
 * le compte a zero d'un coup, et laissait donc passer le DOUBLE du seuil a
 * sa frontiere (REP-38, story 1.9).
 *
 * Refuse a `estime >= limit`. Sur une cle neuve, `precedent` valant zero,
 * cela revient exactement a l'ancien `count > limit` : `limit` tentatives
 * passent, la suivante est refusee.
 */
export function rateLimit({
  key,
  limit,
  windowMs,
}: {
  /** Identifie qui est compte : « login:ip:1.2.3.4 », « lead:agence-x ». */
  key: string
  limit: number
  windowMs: number
}): RateLimitResult {
  const now = Date.now()
  sweep(now)

  let bucket = buckets.get(key)

  // La fenetre a roule : la courante devient la precedente, et on repart —
  // mais on GARDE son compte, qui pesera encore le temps du chevauchement.
  if (bucket && bucket.resetAt <= now) {
    /**
     * LA NOUVELLE FENETRE S'ALIGNE SUR L'ANCIENNE, PAS SUR L'APPEL.
     *
     * La premiere version posait `resetAt = now + windowMs`, c'est-a-dire
     * qu'elle deplacait le passe vers le present : quel que soit le temps
     * reellement ecoule, la fenetre precedente se retrouvait a peser son
     * poids PLEIN. Mesure par la revue du 12-08-2026 : quarante depots,
     * retour a `expiration + 598 s` -> trois acceptes ; a `+ 602 s` ->
     * quarante. Une falaise de quatre secondes, facteur treize. Et sur
     * `oubli:compte`, le titulaire restait refuse jusqu'a DEUX fenetres la
     * ou la fenetre fixe rouvrait a une — le correctif ALLONGEAIT le deni
     * d'acces qu'il pretendait fermer.
     *
     * On avance donc par fenetres ENTIERES depuis l'ancienne frontiere. Le
     * chevauchement reflete alors la position reelle dans la fenetre
     * courante, et le poids de la precedente decroit avec le temps.
     */
    const fenetresSautees = Math.floor((now - bucket.resetAt) / windowMs) + 1

    bucket = {
      count: 0,
      // Au-dela d'une fenetre entiere, la precedente est hors du champ.
      precedent: fenetresSautees === 1 ? bucket.count : 0,
      resetAt: bucket.resetAt + fenetresSautees * windowMs,
      windowMs,
    }

    buckets.set(key, bucket)
  }

  if (!bucket) {
    if (buckets.size >= MAX_COMPTEURS) {
      // Un dernier menage avant de refuser : la table est peut-etre
      // pleine d'entrees expirees que le rythme normal n'a pas encore
      // ramassees.
      sweep(now, true)
    }

    if (buckets.size >= MAX_COMPTEURS) {
      if (!plafondSignale) {
        plafondSignale = true
        console.warn(
          `[rate-limit] ${MAX_COMPTEURS} compteurs vivants : les nouveaux ` +
            "appelants sont refuses jusqu'a expiration. Inondation en cours, " +
            "ou limitation a reporter sur un magasin partage."
        )
      }

      return { ok: false, retryAfter: Math.ceil(windowMs / 1000), depassement: 0 }
    }

    bucket = { count: 0, precedent: 0, resetAt: now + windowMs, windowMs }
    buckets.set(key, bucket)
  }

  /**
   * L'ESTIMATION GLISSANTE, et pourquoi elle remplace un simple compteur.
   *
   * Une fenetre FIXE remet le compte a zero d'un coup. Dix essais juste
   * avant la bascule et dix juste apres font vingt essais en quelques
   * secondes, la ou le seuil en annonce dix : le budget reel etait le
   * DOUBLE a la frontiere (REP-38).
   *
   * On pondere donc la fenetre precedente par la part d'elle-meme qui
   * chevauche encore la fenetre glissante. A la bascule, elle compte pour
   * presque tout ; une fenetre plus tard, pour rien.
   *
   * CE QUE CE CHOIX COUTE :
   *  - deux nombres par compteur au lieu d'un, et une entree conservee une
   *    fenetre de plus — sur 50 000 compteurs, quelques megaoctets ;
   *  - une APPROXIMATION : on suppose les essais de la fenetre precedente
   *    repartis uniformement. Un attaquant qui les concentre juste avant la
   *    bascule est legerement surestime, juste apres legerement sous-estime.
   *    L'ecart est borne par le seuil lui-meme, la ou la fenetre fixe le
   *    doublait ;
   *  - la solution exacte serait de garder l'horodatage de chaque essai.
   *    Elle coute une liste par compteur et un parcours par appel : trop
   *    cher pour ce qu'elle ajoute ici.
   *
   * `precedent` valant zero au premier passage, une cle neuve se comporte
   * exactement comme avant : `limit` essais passent, le suivant est refuse.
   */
  // Borne a [0, 1] : une horloge qui recule (NTP, restauration d'instantane)
  // ou deux appelants passant des fenetres differentes sur la meme cle
  // rendraient sinon un poids superieur a 1, donc un refus a une fraction
  // du budget prevu.
  const chevauchement = Math.min(
    1,
    Math.max(0, (bucket.resetAt - now) / windowMs)
  )
  const estime = bucket.precedent * chevauchement + bucket.count

  if (estime >= limit) {
    bucket.count += 1

    return {
      ok: false,
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
      depassement: Math.max(1, Math.floor(estime - limit) + 1),
    }
  }

  bucket.count += 1

  return { ok: true, retryAfter: 0, depassement: 0 }
}

/**
 * Fabrique une cle de compteur dont les segments ne peuvent pas se
 * melanger.
 *
 * POURQUOI CE N'EST PAS DU ZELE. Les cles etaient concatenees a la main —
 * `login:compte:${email}`. Aucune collision n'existait, mais cela tenait a
 * deux accidents : `isIP` refuse `@`, et aucun prefixe n'etait prefixe d'un
 * autre. Un futur `rateLimit({ key: 'lead:' + agencyId })` sur une valeur
 * libre — un nom d'agence, un slug — casserait l'invariant sans que rien ne
 * le signale, et deux appelants distincts partageraient un compteur.
 *
 * `encodeURIComponent` echappe le `:`, donc la valeur ne peut plus
 * ressembler a un prefixe suivi d'une autre valeur. La cle reste lisible
 * dans un journal, ce qui compte pour diagnostiquer.
 *
 * Verifie : `cleDeCompteur('a', 'b:c')` et `cleDeCompteur('a:b', 'c')`
 * donnent deux cles differentes, la ou la concatenation en donnait une.
 */
export function cleDeCompteur(prefixe: string, valeur: string): string {
  return `${prefixe}:${encodeURIComponent(valeur)}`
}

/** Efface le compteur : appele apres une tentative reussie. */
export function resetRateLimit(key: string) {
  buckets.delete(key)
}

/**
 * ─── Identification de l'appelant ────────────────────────────────────
 *
 * Un compteur ne vaut que si l'appelant ne peut pas choisir sa propre
 * identite. Ce module a longtemps lu `X-Forwarded-For` et retenu la
 * PREMIERE valeur de la liste (BUG-20). nginx etait alors configure avec
 * `$proxy_add_x_forwarded_for`, qui AJOUTE l'adresse reelle A LA FIN de
 * ce que le client a envoye : la premiere valeur etait donc celle que
 * l'appelant avait ecrite lui-meme. Tous les compteurs par adresse se
 * remettaient a zero avec un en-tete.
 *
 * `X-Forwarded-For` n'est plus lu du tout, et c'est deliberement plus
 * radical que d'en inverser la lecture. C'est une LISTE dont la longueur
 * depend de la topologie : lire la premiere valeur est faux derriere un
 * proxy qui ajoute a la fin, lire la derniere est faux des qu'il y a deux
 * proxys, et lire n'importe laquelle est faux quand il n'y a aucun proxy
 * — le cas de la suite de tests. Aucune lecture n'est correcte sans
 * connaitre le nombre de sauts de confiance, et le deduire est
 * exactement l'erreur d'indice qui a produit ce defaut.
 *
 * `X-Real-IP` n'a pas ce probleme : une seule valeur, un seul auteur.
 *
 * ⚠ CETTE GARANTIE N'APPARTIENT PAS A L'EN-TETE. Elle vient de la ligne
 * `proxy_set_header X-Real-IP $remote_addr` de `nginx/nginx.conf`, qui
 * REMPLACE ce que le client a envoye. nginx ne supprime pas les en-tetes
 * qu'il ne pose pas : configurer `TRUSTED_IP_HEADER` sur un autre nom
 * (`cf-connecting-ip`…) SANS que le proxy pose ce nom-la rouvre BUG-20 a
 * l'identique. Le nom est configurable ; l'ecrasement doit l'accompagner.
 *
 * CETTE LECTURE SUPPOSE QUE LE PROXY EST UN PASSAGE OBLIGE, et il ne
 * l'est qu'a moitie.
 *
 * La story 2.1 a retire la publication du port applicatif : plus aucune
 * machine distante ne joint l'application sans passer par nginx, et c'est
 * la moitie qui comptait. Mais un processus tournant SUR L'HOTE atteint
 * toujours le conteneur par son adresse de reseau Docker — verifie,
 * `curl http://<ip-du-conteneur>:3000/…` repond 200 et un `X-Real-IP`
 * forge y passe. Aucun reglage de docker-compose ne ferme ce chemin, pas
 * meme un reseau `internal: true` ; il y faut une regle de pare-feu dans
 * la chaine DOCKER-USER.
 *
 * Autrement dit : ce module identifie fiablement un appelant DISTANT, et
 * pas un processus local. Et si l'application est un jour deployee sans
 * reverse proxy, il redevient entierement decoratif.
 */

/** En-tete lu par defaut. nginx le pose depuis `$remote_addr`. */
const EN_TETE_PAR_DEFAUT = "x-real-ip"

/** Jeton HTTP : tout le reste ferait LEVER `Headers.get()`. */
const NOM_D_EN_TETE = /^[a-z0-9-]+$/

/** Appelant non identifiable : compteur unique, partage. */
export const APPELANT_INCONNU = "inconnu"

let inconnuSignale = false

/**
 * Nom de l'en-tete de confiance.
 *
 * Configurable par `TRUSTED_IP_HEADER` : derriere un CDN qui pose sa
 * propre en-tete, on ecrira son nom — a condition que le proxy en facade
 * l'ecrase, voir l'avertissement ci-dessus.
 *
 * Toute valeur douteuse retombe sur le defaut, jamais sur une lecture
 * hasardeuse :
 *
 *   - `x-forwarded-for` : refuse. `lib/env.ts` le rejette au demarrage.
 *     L'accepter serait promettre un comptage de sauts que ce module ne
 *     fait pas.
 *   - nom syntaxiquement invalide : refuse. `Headers.get("x real ip")`
 *     ne rend pas `null`, il LEVE un `TypeError` — et cette exception
 *     traversait la route d'inscription, qui repondait alors 500 a
 *     chaque tentative. Les guillemets sont retires avant examen : un
 *     `TRUSTED_IP_HEADER="none"` mal deguillemete par docker-compose
 *     suffisait a declencher exactement ce cas.
 */
function enTeteDeConfiance(): string {
  const configure = process.env.TRUSTED_IP_HEADER?.trim()
    .replace(/^["']+|["']+$/g, "")
    .trim()
    .toLowerCase()

  if (!configure) return EN_TETE_PAR_DEFAUT
  if (configure === "x-forwarded-for") return EN_TETE_PAR_DEFAUT
  if (!NOM_D_EN_TETE.test(configure)) return EN_TETE_PAR_DEFAUT

  return configure
}

/**
 * Ramene une adresse a une ecriture unique, ou rend `null`.
 *
 * `isIP` valide la forme ; il ne CANONICALISE pas. Or une meme machine
 * s'ecrit de dizaines de facons que `isIP` accepte toutes — donc autant
 * de compteurs pour un seul appelant, ce que le controle est justement
 * cense empecher. Verifie par execution :
 *
 *   1.2.3.4 · ::ffff:1.2.3.4 · ::FFFF:1.2.3.4 · 0:0:0:0:0:ffff:1.2.3.4
 *   · ::ffff:0102:0304 · ::ffff:102:304        -> une seule machine
 *   2001:db8::1 · 2001:0db8::1 · 2001:DB8:0:0:0:0:0:1 -> une seule
 *
 * Le zone-id (« fe80::1%eth0 ») est pire : `isIP` en accepte un de huit
 * mille caracteres, et `%0`, `%00`, `%000` donnent trois cles. Il ne
 * designe qu'une interface LOCALE et n'a aucun sens dans un en-tete
 * transmis : il est coupe.
 *
 * Refuse au passage ce qui n'est pas une adresse du tout — une liste
 * (« 1.2.3.4, 5.6.7.8 », ce que rend `Headers.get()` quand le client
 * envoie l'en-tete deux fois), un port, des crochets, du texte libre.
 * Sans ce refus, n'importe quelle chaine devenait une cle de compteur.
 */
function adresseValide(valeur: string | null | undefined): string | null {
  if (!valeur) return null

  const sansZone = valeur.trim().toLowerCase().split("%")[0]
  const famille = isIP(sansZone)

  if (famille === 4) return sansZone
  if (famille !== 6) return null

  let nu: string

  try {
    // `URL` applique la canonicalisation IPv6 : minuscules, zeros de
    // tete retires, plus longue suite de zeros compressee.
    nu = new URL(`http://[${sansZone}]`).hostname.slice(1, -1)
  } catch {
    return null
  }

  // Une adresse IPv4 vue a travers IPv6 reste la meme machine.
  const mappee = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(nu)

  if (mappee) {
    const haut = parseInt(mappee[1], 16)
    const bas = parseInt(mappee[2], 16)

    return `${haut >> 8}.${haut & 255}.${bas >> 8}.${bas & 255}`
  }

  return nu
}

/** Identification a partir d'en-tetes deja en main (routes API). */
export function callerIpFrom(entetes: Headers): string {
  const adresse = adresseValide(entetes.get(enTeteDeConfiance()))

  if (adresse) return adresse

  // Un compteur qui ne distingue plus personne n'est plus une limite,
  // c'est un compte a rebours d'indisponibilite : tous les appelants non
  // identifies partagent « inconnu », donc cinq inscriptions par heure
  // POUR TOUTE LA PLATEFORME. C'est le comportement prudent — ferme
  // plutot qu'ouvert — mais il ne doit surtout pas etre silencieux.
  if (!inconnuSignale) {
    inconnuSignale = true
    console.warn(
      `[rate-limit] appelant non identifiable : l'en-tete ` +
        `« ${enTeteDeConfiance()} » est absent ou n'est pas une adresse IP. ` +
        "Tous les appelants dans ce cas partagent UN SEUL compteur, donc " +
        "les seuils par adresse s'appliquent a l'ensemble du trafic. " +
        "Verifiez que le reverse proxy pose bien cet en-tete."
    )
  }

  return APPELANT_INCONNU
}

/** Identification depuis le contexte de requete (Server Actions, auth). */
export async function callerIp(): Promise<string> {
  try {
    return callerIpFrom(await headers())
  } catch (erreur) {
    // headers() n'est pas disponible partout. Une limitation degradee vaut
    // mieux qu'une page qui casse — mais en silence, elle transformerait
    // une regression de securite en degradation invisible.
    console.warn("[rate-limit] identification impossible :", erreur)
    return APPELANT_INCONNU
  }
}

/** Phrase affichee a l'utilisateur, en minutes plutot qu'en secondes. */
export function retryMessage(retryAfter: number): string {
  const minutes = Math.ceil(retryAfter / 60)
  return minutes <= 1
    ? "Trop de tentatives. Réessayez dans une minute."
    : `Trop de tentatives. Réessayez dans ${minutes} minutes.`
}
