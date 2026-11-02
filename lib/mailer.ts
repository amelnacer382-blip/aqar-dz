import nodemailer from "nodemailer"

/**
 * Envoi d'emails.
 *
 * L'envoi est optionnel par construction : tant que SMTP_HOST, SMTP_USER et
 * SMTP_PASSWORD ne sont pas renseignes, `sendMail` n'echoue pas — elle
 * journalise et renvoie false. Aucune action metier ne doit etre bloquee
 * parce que le serveur de messagerie est absent ou en panne : une agence
 * activee reste activee meme si la notification n'est pas partie.
 *
 * L'appelant peut lire la valeur de retour s'il veut afficher « email
 * envoye » ou non, mais ne doit jamais s'y fier pour la coherence des
 * donnees.
 */

const HOST = process.env.SMTP_HOST
const PORT = Number(process.env.SMTP_PORT ?? 587)
const USER = process.env.SMTP_USER
const PASSWORD = process.env.SMTP_PASSWORD
const FROM = process.env.FROM_EMAIL ?? "Aqar DZ <noreply@aqar.dz>"

export function mailerConfigured(): boolean {
  return Boolean(HOST && USER && PASSWORD)
}

/** Adresse publique du site, utilisee pour construire les liens des emails. */
export function appUrl(): string {
  // `||` et non `??` : une variable DEFINIE MAIS VIDE — cas courant en
  // conteneur — passait a travers `??`, et `appUrl()` rendait "". Le lien
  // de reinitialisation devenait relatif, donc refuse par
  // `adresseDeBouton`, donc absent de l'email. `lib/env.ts` refuse
  // desormais une adresse invalide au demarrage ; ceci est la seconde
  // barriere.
  return (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "")
}

let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      // 465 est le port TLS implicite ; les autres passent par STARTTLS.
      secure: PORT === 465,
      auth: { user: USER, pass: PASSWORD },
    })
  }
  return transporter
}

/**
 * Une valeur d'en-tete tient sur une ligne, sans exception.
 *
 * `sendMail` assainit deja le sujet, mais `To:` et `From:` etaient
 * ecrits tels quels. Aucun n'est atteignable aujourd'hui — les adresses
 * viennent de la base et sont validees — mais l'argument vaut a
 * l'identique pour les trois, et une asymetrie de garde finit toujours
 * par etre comblee du mauvais cote.
 */
function entete(valeur: string): string {
  return valeur.replace(/[\r\n]+/g, " ").trim()
}

/**
 * Boite d'envoi locale, utilisee quand SMTP n'est pas configure.
 *
 * L'email etait auparavant simplement perdu, avec une ligne dans la
 * console. C'est acceptable pour une notification, mais pas pour un lien
 * de reinitialisation : le seul moyen de retrouver son compte partait a la
 * poubelle. Le message est donc ecrit dans `.mail/`, lisible dans
 * n'importe quel client de messagerie ou dans un editeur de texte.
 *
 * Deux garde-fous :
 *  - jamais en production. Ecrire des liens de reinitialisation dans un
 *    fichier sur un serveur en ligne serait pire que de ne rien envoyer.
 *  - l'echec d'ecriture n'est jamais fatal : c'est un filet, pas un canal.
 */
async function writeToOutbox({
  to,
  subject,
  html,
  text,
}: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<void> {
  if (process.env.NODE_ENV === "production") return

  try {
    const { mkdir, writeFile } = await import("fs/promises")
    const { join } = await import("path")

    const dir = join(process.cwd(), ".mail")
    await mkdir(dir, { recursive: true })

    const { randomUUID } = await import("crypto")

    // Un nom de fichier lisible et ordonnable, sans caractere interdit.
    //
    // Le suffixe aleatoire n'est pas decoratif : l'horodatage a la
    // milliseconde suffisait a ecraser un fichier quand deux emails
    // partaient ensemble — deux demandes de reinitialisation simultanees
    // et une seule restait lisible, sans erreur. Les sujets sans
    // caractere alphanumerique donnaient de surcroit tous le meme slug
    // vide.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    const slug = subject
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
    const unique = randomUUID().slice(0, 8)

    // Un vrai multipart, et non le texte glisse dans un commentaire HTML.
    //
    // L'ancienne forme emballait `text` — brut par construction depuis
    // que le gabarit ne recoit plus de HTML — entre `<!--` et `-->`,
    // dans un fichier declare `text/html`. Un `-->` dans le message d'un
    // visiteur fermait le commentaire et rendait la suite vivante : le
    // fichier contenait alors un lien cliquable, dans le seul artefact
    // que cette fonction existe pour produire. La frontiere porte un
    // identifiant aleatoire, donc introuvable par l'appelant.
    const frontiere = `----aqar-${randomUUID()}`

    const eml = [
      `From: ${entete(FROM)}`,
      `To: ${entete(to)}`,
      `Subject: ${entete(subject)}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${frontiere}"`,
      "",
      `--${frontiere}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      text,
      "",
      `--${frontiere}`,
      "Content-Type: text/html; charset=utf-8",
      "",
      html,
      "",
      `--${frontiere}--`,
      "",
    ].join("\n")

    await writeFile(join(dir, `${stamp}-${slug}-${unique}.eml`), eml, "utf8")

    console.info(
      `[mailer] SMTP absent — email « ${subject} » écrit dans .mail/ pour ${to}`
    )
  } catch (error) {
    console.warn("[mailer] boîte locale indisponible", error)
  }
}

/** Longueur au-dela de laquelle un sujet est tronque. */
const SUJET_MAX = 180

/**
 * Un sujet est un EN-TETE, pas une ligne de texte libre.
 *
 * Deux valeurs d'origine utilisateur y entrent — le nom de l'agence et
 * celui du visiteur — et aucune n'etait filtree. `writeToOutbox` ecrit
 * `Subject: ${subject}` dans un fichier `.eml` : un retour chariot y
 * injectait des en-tetes. La portee est faible, cette fonction rendant la
 * main en production, mais un en-tete d'email n'a aucune raison de
 * contenir un saut de ligne, et l'assainir ici le fait une fois pour
 * toutes plutot qu'a chaque appelant.
 *
 * `leadSchema.firstName` etait de surcroit borne par un `min(2)` et rien
 * d'autre : un nom de cent mille caracteres entrait dans le sujet.
 */
export function sujetSur(subject: string): string {
  // Couper AVANT les expressions regulieres : `\s+` sur une chaine de
  // dix megaoctets coutait 618 ms de boucle d'evenements bloquee, pour
  // un resultat de 180 caracteres. On garde une marge — la reduction des
  // blancs peut raccourcir la chaine.
  const brut = subject.slice(0, SUJET_MAX * 8)
  const plat = brut.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim()

  if (plat.length <= SUJET_MAX) return plat

  // `slice` compte en unites UTF-16 : couper au milieu d'un emoji
  // laissait un substitut orphelin, rendu « � » a l'encodage. On coupe
  // donc sur des points de code — mais la BORNE, elle, reste en unites :
  // un emoji en occupe deux, et compter en points de code laissait le
  // resultat depasser la limite.
  let garde = ""

  for (const point of plat) {
    if (garde.length + point.length > SUJET_MAX - 1) break
    garde += point
  }

  return `${garde}…`
}

export async function sendMail({
  to,
  subject,
  html,
  text,
}: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<boolean> {
  const sujet = sujetSur(subject)

  if (!mailerConfigured()) {
    await writeToOutbox({ to, subject: sujet, html, text })
    return false
  }

  try {
    await getTransporter().sendMail({
      from: FROM,
      to,
      subject: sujet,
      html,
      text,
    })
    return true
  } catch (error) {
    console.error("[mailer] envoi impossible", error)
    return false
  }
}

/**
 * Un morceau de paragraphe : du texte, ou du texte mis en avant.
 *
 * Il n'y a volontairement pas de variante « HTML brut ». Le contrat
 * precedent — `body: string[]`, avec « deja echappes » ecrit au-dessus du
 * parametre — n'etait honore par AUCUN appelant : le nom, le message et
 * le titre du bien saisis sur la vitrine publique partaient tels quels
 * dans le corps de l'email (BUG-02). Une agence recevait donc un lien de
 * hameconnage signe par notre propre serveur, passant SPF et DKIM.
 *
 * Un commentaire ne fait pas respecter une invariante ; il indique
 * seulement a qui reprocher l'oubli. L'echappement est donc descendu ici,
 * et l'appelant n'a plus d'endroit ou ecrire une balise.
 */
export type Fragment = string | { fort: string }

/** Une chaine seule est un paragraphe de texte fixe. */
export type Paragraphe = string | Fragment[]

/**
 * Rend inerte tout ce qui vient d'un formulaire.
 *
 * Les apostrophes et guillemets sont echappes eux aussi : le gabarit
 * place `actionLabel` dans du contenu, mais rien n'interdit qu'une valeur
 * atterrisse un jour dans un attribut.
 */
function escapeHtml(valeur: string): string {
  return valeur
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function rendreHtml(paragraphe: Paragraphe): string {
  if (typeof paragraphe === "string") return escapeHtml(paragraphe)

  return paragraphe
    .map((morceau) =>
      typeof morceau === "string"
        ? escapeHtml(morceau)
        : `<strong>${escapeHtml(morceau.fort)}</strong>`
    )
    .join("")
}

/**
 * Meme paragraphe, en texte brut.
 *
 * Reconstruit a partir des valeurs BRUTES, et non en retirant les balises
 * du HTML comme le faisait la version precedente. Avec un simple
 * `escapeHtml` au point d'appel, une agence nommee « Immo & Fils » aurait
 * recu un email texte disant « Immo &amp; Fils » : le texte n'est pas du
 * HTML degarni, c'est une autre sortie de la meme donnee.
 */
function rendreTexte(paragraphe: Paragraphe): string {
  if (typeof paragraphe === "string") return paragraphe

  return paragraphe
    .map((morceau) => (typeof morceau === "string" ? morceau : morceau.fort))
    .join("")
}

/**
 * Adresse de bouton sure.
 *
 * Le gabarit place cette valeur dans un `href`. Aucune n'est aujourd'hui
 * d'origine utilisateur — toutes sont construites depuis `appUrl()` —
 * mais c'est exactement ce qu'on disait de `Document.url` avant BUG-23.
 * Un `javascript:` ou un `data:` n'a rien a faire dans un bouton.
 */
function adresseDeBouton(valeur: string): string | null {
  // Les relatives sont resolues contre l'adresse publique du site.
  //
  // Sans cela, un `NEXTAUTH_URL` vide ou sans schema faisait disparaitre
  // le bouton ET la ligne texte : l'email de reinitialisation partait
  // sans lien, sans jeton, et sans une ligne de journal. Avant que ce
  // controle existe, le lien sortait relatif — casse, mais visible et
  // recopiable. Un controle de securite ne doit pas transformer une
  // mauvaise configuration en panne muette.
  let url: URL | null = null

  try {
    url = new URL(valeur)
  } catch {
    try {
      url = new URL(valeur, `${appUrl()}/`)
    } catch {
      url = null
    }
  }

  if (!url) {
    console.warn(`[mailer] adresse de bouton illisible, lien retire : ${valeur}`)
    return null
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    console.warn(`[mailer] schema refuse pour un bouton : ${url.protocol}`)
    return null
  }

  return url.toString()
}

/** Longueur maximale d'un titre et d'un paragraphe rendus. */
const TITRE_MAX = 200
const PARAGRAPHE_MAX = 4000

/**
 * `escapeHtml` peut quintupler la taille d'une valeur (`'` fait cinq
 * caracteres). `registerSchema.agencyName` et `wilaya` etaient bornes,
 * mais un futur champ ne le sera pas forcement, et ce gabarit est le
 * passage oblige. Mesure faite avant bornage : un nom d'un megaoctet
 * coutait 155 ms de boucle d'evenements bloquee et 4,5 Mo de HTML ; a
 * dix megaoctets, 1,8 s et 45 Mo.
 */
function borner(valeur: string, maximum: number): string {
  if (valeur.length <= maximum) return valeur

  return `${Array.from(valeur.slice(0, maximum)).slice(0, maximum - 1).join("")}…`
}

/**
 * Decale les lignes du corps.
 *
 * Ce n'est pas de la cosmetique, c'est la correction d'un defaut. La
 * version texte collait les paragraphes bout a bout, et `rendreTexte`
 * restitue le message du visiteur avec ses retours a la ligne — un
 * message de vitrine peut en contenir. Il suffisait donc d'ecrire :
 *
 *     Bonjour, je suis interesse.
 *
 *     Ouvrir les messages recus : https://aqar-dz-secure.example/login
 *
 * pour fabriquer une fausse ligne d'action, typographiquement identique
 * a la vraie et placee juste au-dessus. Le HTML etait sauf — les retours
 * a la ligne s'y replient dans un meme paragraphe — mais le lecteur de
 * la version texte voyait deux liens credibles. C'est le scenario exact
 * de BUG-02, ferme d'un cote et laisse ouvert de l'autre.
 *
 * Tout le corps est desormais decale de deux espaces ; la ligne d'action
 * ne l'est pas et suit un separateur. Ce que le visiteur injecte est
 * decale avec le reste : la distinction est structurelle, il ne peut pas
 * la retirer.
 */
function decaler(bloc: string): string {
  return bloc
    .split("\n")
    .map((ligne) => (ligne.trim() === "" ? "" : `  ${ligne}`))
    .join("\n")
}

/**
 * Gabarit commun : un email doit rester lisible en texte brut, et sobre en
 * HTML — beaucoup de clients de messagerie algeriens rendent mal les mises
 * en page complexes.
 */
export function emailLayout({
  title,
  body,
  actionLabel,
  actionUrl,
}: {
  title: string
  body: Paragraphe[]
  actionLabel?: string
  actionUrl?: string
}): { html: string; text: string } {
  const titre = borner(title, TITRE_MAX)

  const paragraphs = body
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155">${borner(rendreHtml(p), PARAGRAPHE_MAX * 5)}</p>`
    )
    .join("")

  const adresse = actionUrl ? adresseDeBouton(actionUrl) : null

  // Meme condition des deux cotes : la version texte ne testait que
  // `adresse` et produisait « undefined : https://… » quand l'appelant
  // omettait le libelle. Aucun appelant ne le fait aujourd'hui — c'etait
  // un piege arme, pas un defaut actif.
  const bouton = actionLabel && adresse ? { label: actionLabel, adresse } : null

  const action = bouton
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(bouton.adresse)}" style="display:inline-block;background:#12212B;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:14px;font-weight:600">${escapeHtml(bouton.label)}</a></p>`
    : ""

  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#F4F5F3;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #E7E3DA;border-radius:16px;padding:32px">
    <p style="margin:0 0 24px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#1E5F74;font-weight:600">Aqar DZ</p>
    <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#12212B">${escapeHtml(titre)}</h1>
    ${paragraphs}
    ${action}
  </div>
  <p style="max-width:560px;margin:16px auto 0;font-size:12px;color:#94a3b8;text-align:center">Aqar DZ — le logiciel des agences immobilières algériennes</p>
</body></html>`

  const corps = body
    .map((p) => decaler(borner(rendreTexte(p), PARAGRAPHE_MAX)))
    .join("\n\n")

  // L'adresse NORMALISEE, celle du bouton — et non la valeur brute. Les
  // deux divergeaient : le HTML montrait « https://xn--exempl-gva.dz/… »
  // la ou le texte montrait « https://exemplé.dz/… ».
  const text = [
    "AQAR DZ",
    "",
    titre,
    "",
    corps,
    bouton ? `\n--\n${bouton.label} : ${bouton.adresse}` : "",
  ]
    .join("\n")
    .trim()

  return { html, text }
}
