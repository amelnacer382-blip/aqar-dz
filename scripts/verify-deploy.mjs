#!/usr/bin/env node
/**
 * Verifie qu'une Server Action aboutit A TRAVERS le relais.
 *
 * POURQUOI CE SCRIPT EXISTE
 *
 * `npm run test:e2e` sert l'application EN DIRECT (`playwright.config.ts`,
 * bloc `webServer` : `npm run build && npm start`). nginx n'est jamais dans
 * son chemin. La suite n'a donc jamais rien dit — et ne dira jamais rien —
 * de la topologie de deploiement. C'est REP-95.
 *
 * Le 15-08-2026, cet angle mort a laisse passer BUG-36 : `nginx.conf`
 * posait `proxy_set_header Host $host;`, qui ne porte PAS le port. Next 14
 * en derive `x-forwarded-host`, le compare a l'`Origin` du navigateur — qui
 * porte `:8095` — et refuse l'action au titre de sa protection anti-CSRF.
 * Les 41 Server Actions du produit repondaient 500. Le produit etait en
 * lecture seule SAUF pour supprimer (les suppressions passent par des
 * routes API), et les 121 cas de la suite restaient verts.
 *
 * Ce script est la contre-mesure : il attaque la pile REELLE, par le port
 * publie, exactement comme un navigateur.
 *
 * CE QU'IL NE FAIT PAS
 *
 * Il n'est lance par rien automatiquement. Il appartient a la procedure de
 * deploiement — c'est une faiblesse assumee, inscrite dans la story 5.14
 * avec son motif. Le garde-fou qui tourne, lui, est l'assertion statique de
 * `tests/deploiement.spec.ts`.
 *
 * IL N'ECRIT RIEN EN BASE
 *
 * `submitLead` resout l'agence par le `slug` POSTE (pas par l'URL) et sort
 * en `redirect(withError(...))` si aucune agence active ne le porte. On
 * poste donc un slug qui ne peut pas exister : l'action s'execute jusqu'au
 * bout, prouve que le relais la laisse passer, et ne cree aucun `Lead`.
 * Aucun nettoyage a faire apres coup — c'est la raison de ce detour.
 *
 * USAGE
 *   npm run verify:deploy
 *   VERIFY_BASE=https://aqar.example.dz npm run verify:deploy
 *
 * SORTIES
 *   0 — le relais conserve le port, l'action aboutit
 *   1 — ECHEC : l'action est refusee (le defaut est de retour)
 *   2 — NON CONCLUANT : la pile ou la vitrine manquent. Ce n'est PAS un
 *       succes, et le script le dit plutot que de se taire (CLAUDE.md §7).
 */

import { execSync } from "child_process"

const BASE = (process.env.VERIFY_BASE ?? "http://localhost:8095").replace(/\/$/, "")

/** Slug volontairement introuvable : il fait sortir l'action avant toute ecriture. */
const SLUG_INEXISTANT = "verification-de-deploiement-slug-absent"

/**
 * Le compte sonde par l'epreuve d'echec (story 2.6, AC-2).
 *
 * IL DOIT EXISTER, et c'est la seule fragilite de cette epreuve : un email
 * inconnu fait rendre `null` a `findUnique`, aucune ligne `Agency` n'est
 * alors deserialisee, et l'epreuve serait VERTE en n'ayant rien eprouve —
 * exactement le controle pose a cote du trou de CLAUDE.md §6. Le script
 * affiche donc l'adresse employee, pour qu'on puisse le verifier d'un coup
 * d'oeil, et l'ecart de migrations (sonde de sante) reste le filet qui ne
 * depend d'aucun compte.
 *
 * Aucun mot de passe valide n'est detenu nulle part : l'epreuve ne sait que
 * ECHOUER.
 */
const COMPTE_SONDE = process.env.VERIFY_EMAIL ?? "agent@aqar.dz"

/**
 * Au-dela de `DELAI_PLAFOND_MS` d'auth.ts (30 s).
 *
 * `penaliserEchec` ne ferme aucun compte — il RETARDE la reponse, jusqu'a
 * 30 s quand le budget par compte est depasse. Un delai d'attente plus court
 * lirait cette penalite comme une panne.
 */
const DELAI_EPREUVE_MS = 45_000

let etape = 0

function dire(message) {
  etape += 1
  console.log(`  ${etape}. ${message}`)
}

function echec(message, code = 1) {
  console.error(`\n❌ ${code === 2 ? "NON CONCLUANT" : "ÉCHEC"} — ${message}\n`)
  process.exit(code)
}

async function lire(url, options) {
  try {
    return await fetch(url, options)
  } catch (erreur) {
    echec(`${url} est injoignable : ${erreur.message}`, 2)
  }
}

console.log(`\nVérification du déploiement — ${BASE}\n`)

// --- 1. La pile repond ------------------------------------------------------
const sante = await lire(`${BASE}/api/public/health`)
const corpsSante = (await sante.text()).trim()

if (sante.status !== 200) {
  // Un 503 ne veut plus dire « la pile est éteinte » depuis la story 2.6 :
  // la sonde répond aussi 503 quand elle est joignable mais qu'elle ne sait
  // pas lire la base. Le corps porte le motif, on le rend tel quel plutôt
  // que de deviner — c'est lui qui nomme les migrations en écart.
  const detail = corpsSante || "(corps vide)"

  if (corpsSante.includes("image-en-retard")) {
    echec(
      `l'image en service IGNORE des migrations déjà appliquées. C'est la ` +
        `signature de BUG-37 : la base a été migrée sans que l'image soit ` +
        `reconstruite, et aucune connexion n'aboutira. Reconstruisez-la ` +
        `(docker compose -f docker-compose.prod.yml up -d --build).\n   ${detail}`
    )
  }

  if (corpsSante.includes("base-en-retard")) {
    echec(
      `des migrations embarquées par l'image ne sont pas appliquées à la ` +
        `base. Appliquez-les avant de servir.\n   ${detail}`
    )
  }

  echec(
    `/api/public/health répond ${sante.status}. La pile est-elle démarrée ?\n   ${detail}`,
    2
  )
}

dire(`santé : ${corpsSante}`)

// --- 1 bis. Comparer le commit SERVI a celui de la branche courante ---------
//
// REP-96, story 2.8. La sonde de la story 2.6 compare les MIGRATIONS, donc
// elle voit la derive qui casse l'authentification. Elle ne voit pas
// l'ecart de COMMIT : le 15-08-2026, l'image en service accusait 67 commits
// de retard SANS changement de schema, et cette sonde l'aurait declaree
// `a-jour`. Le cout a ete mesure — la verification a conclu a une
// regression de securite qui n'existait pas.
//
// CETTE ETAPE NE FAIT JAMAIS ECHOUER LE SCRIPT, et c'est un arbitrage :
// servir une image plus ancienne que la branche courante est un etat NORMAL
// en cours de travail. Un echec ici rendrait le script inutilisable des
// qu'on a un commit d'avance, donc on l'ignorerait, donc il ne dirait plus
// rien. On nomme les deux, et on laisse trancher celui qui lit.
{
  let servi = null

  try {
    servi = JSON.parse(corpsSante).commit ?? null
  } catch {
    // Corps illisible : rien a comparer. Ce n'est pas un echec — le
    // diagnostic principal de ce script ne depend pas de cette etape.
  }

  let local = null

  try {
    // `git` peut manquer, et le depot avec : ce script est fait pour etre
    // lance depuis un serveur de deploiement autant que depuis un poste.
    local = execSync("git rev-parse HEAD", {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    local = null
  }

  if (servi === null) {
    dire(
      `commit servi : non rendu par la sonde. L'image est anterieure a la ` +
        `story 2.8 — reconstruisez-la pour qu'elle sache le dire.`
    )
  } else if (servi === "inconnu") {
    dire(
      `commit servi : inconnu. L'image a ete construite sans COMMIT_SHA. ` +
        `Reconstruisez avec « COMMIT_SHA=$(git rev-parse HEAD) docker compose ` +
        `-f docker-compose.prod.yml up -d --build ».`
    )
  } else if (local === null) {
    dire(`commit servi : ${servi} (pas de dépôt git ici, aucune comparaison)`)
  } else if (local.startsWith(servi) || servi.startsWith(local)) {
    // Comparaison par prefixe : le marqueur peut porter un SHA court.
    dire(`commit servi : ${servi} — identique à HEAD`)
  } else {
    let retard = ""

    try {
      // `--` isole le SHA d'un eventuel fichier homonyme. Si le commit
      // servi est inconnu du depot local, git leve et on n'affiche rien
      // plutot que d'inventer un nombre (CLAUDE.md §7).
      const compte = execSync(`git rev-list --count ${servi}..HEAD --`, {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim()

      retard = ` (${compte} commit(s) d'écart)`
    } catch {
      retard = " (commit servi inconnu de ce dépôt)"
    }

    dire(
      `⚠ ÉCART DE VERSION${retard}\n      servi : ${servi}\n      HEAD  : ${local}\n` +
        `      Ce n'est pas un échec : servir une image plus ancienne que la ` +
        `branche est normal en cours de travail.`
    )
  }
}

// --- 1 ter. robots.txt annonce-t-il le sitemap sur l'adresse SERVIE ? -------
//
// BUG-25, story 3.6. `app/robots.ts` etait prerendu pendant `next build`,
// donc gele avec le `NEXTAUTH_URL` du `Dockerfile` — et la ligne `Sitemap:`
// designait un fichier qui n'existe pas sur le domaine reel.
//
// C'EST ICI QUE CE DEFAUT SE VOIT, ET NULLE PART AILLEURS. `npm run
// test:e2e` construit et sert avec le meme environnement : la valeur gelee
// et la valeur d'execution y sont identiques, donc l'ecart y est
// structurellement invisible (REP-95). Ce script, lui, interroge la pile
// servie sans rien savoir de sa construction.
//
// ON COMPARE LES DEUX FICHIERS ENTRE EUX, PAS A `VERIFY_BASE`.
//
// Premiere version de cette etape, ecrite puis jetee le 17-08-2026 : elle
// comparait la ligne `Sitemap:` a `VERIFY_BASE`. Le differentiel l'a mise
// en echec sur une configuration PARFAITEMENT SAINE — on sonde souvent une
// pile par `http://localhost:8095` alors que son domaine public est autre
// chose, et robots.txt annonce alors le domaine public, a juste titre. Un
// script qui echoue a tort est un script qu'on cesse de lancer.
//
// L'invariant juste est ailleurs : `robots.txt` et `sitemap.xml` derivent
// tous deux leur adresse du MEME `appUrl()`. Ils ne peuvent diverger que si
// l'un est gele et l'autre non — c'est-a-dire exactement BUG-25. La
// comparaison ne depend alors plus du tout de par ou l'on sonde.
{
  const robots = await lire(`${BASE}/robots.txt`)

  if (robots.status !== 200) {
    echec(`/robots.txt répond ${robots.status}`, 2)
  }

  const ligne = (await robots.text())
    .split("\n")
    .find((l) => /^\s*sitemap\s*:/i.test(l))

  if (!ligne) {
    echec(
      "/robots.txt n'annonce aucun sitemap : les vitrines perdent le " +
        "raccourci d'indexation qui est l'argument du module"
    )
  }

  const annonce = ligne.slice(ligne.indexOf(":") + 1).trim()

  const plan = await lire(`${BASE}/sitemap.xml`)

  if (plan.status !== 200) {
    echec(`/sitemap.xml répond ${plan.status}`, 2)
  }

  // Depuis la story 3.12, `/sitemap.xml` est un INDEX : sa premiere entree
  // n'est plus l'accueil mais l'adresse de la partie `agences-0.xml`. Elle
  // porte la meme origine, qui est tout ce qu'on compare ici — et elle
  // existe TOUJOURS, y compris sans vitrine publiee et base injoignable :
  // le repli de l'index liste cette partie, qui porte l'accueil.
  const premiere = /<loc>([^<]+)<\/loc>/.exec(await plan.text())

  if (!premiere) {
    echec("/sitemap.xml ne porte aucune entrée : rien à comparer", 2)
  }

  const origineAnnoncee = new URL(annonce).origin
  const origineDuPlan = new URL(premiere[1]).origin

  if (origineAnnoncee !== origineDuPlan) {
    echec(
      `robots.txt et sitemap.xml ne parlent pas du même domaine. Les deux ` +
        `dérivent pourtant du même NEXTAUTH_URL : l'un des deux est FIGÉ à ` +
        `la construction. C'est la signature de BUG-25 — vérifiez que ` +
        `app/robots.ts porte « export const dynamic = "force-dynamic" » et ` +
        `reconstruisez l'image.\n` +
        `      robots.txt  annonce : ${origineAnnoncee}\n` +
        `      sitemap.xml se dit  : ${origineDuPlan}`
    )
  }

  const memeQueLaSonde = origineAnnoncee === new URL(BASE).origin

  dire(
    `robots.txt et sitemap.xml s'accordent sur ${origineAnnoncee}` +
      (memeQueLaSonde
        ? ""
        : ` (différent de l'adresse sondée ${BASE} — normal si vous sondez la pile par la boucle locale)`)
  )
}

// --- 2. Trouver une vitrine publiee, puis une fiche de bien -----------------
//
// La fiche est le seul ecran public qui porte le formulaire de contact,
// donc la seule Server Action joignable sans compte. Sans vitrine publiee,
// il n'y a rien a eprouver : on le dit, on ne conclut pas.
const vitrine = process.env.VERIFY_SLUG ?? "agence-demo"
const accueil = await lire(`${BASE}/vitrine/${vitrine}`)

if (accueil.status !== 200) {
  echec(
    `/vitrine/${vitrine} répond ${accueil.status}. Indiquez une vitrine publiée ` +
      `avec VERIFY_SLUG=<slug>.`,
    2
  )
}

const html = await accueil.text()
const fiche = html.match(new RegExp(`/vitrine/${vitrine}/biens/[a-z0-9]+`))

if (!fiche) {
  echec(
    `la vitrine /vitrine/${vitrine} n'expose aucun bien, donc aucun formulaire ` +
      `de contact à éprouver.`,
    2
  )
}

dire(`fiche publique : ${fiche[0]}`)

// --- 3. Relever l'identifiant d'action SERVI --------------------------------
//
// Il est calcule au build : le figer dans ce fichier le rendrait vert en ne
// verifiant plus rien (CLAUDE.md §6, piege 4). On le lit dans le HTML rendu.
const pageFiche = await lire(`${BASE}${fiche[0]}`)
const idAction = (await pageFiche.text()).match(/\$ACTION_ID_[a-f0-9]+/)

if (!idAction) {
  echec(
    `aucun $ACTION_ID trouvé sur ${fiche[0]} : le formulaire de contact a-t-il ` +
      `changé de forme ?`,
    2
  )
}

dire(`identifiant d'action relevé : ${idAction[0].slice(0, 24)}…`)

// --- 4. Rejouer l'action, comme un navigateur -------------------------------
//
// `Origin` est ce que le navigateur envoie et ce que Next compare : c'est
// la moitie du test. L'autre moitie est le `Host` que fetch derive de
// l'URL, port compris — celui que nginx doit transmettre sans le tronquer.
const corps = new FormData()
corps.set(idAction[0], "")
corps.set("slug", SLUG_INEXISTANT)
corps.set("returnTo", `/vitrine/${SLUG_INEXISTANT}`)
corps.set("firstName", "Vérification")
corps.set("lastName", "Déploiement")
corps.set("phone", "0000000000")
corps.set("message", "Contrôle de déploiement — aucun enregistrement attendu")

const reponse = await lire(`${BASE}${fiche[0]}`, {
  method: "POST",
  headers: { Origin: BASE },
  body: corps,
  redirect: "manual",
})

const destination = reponse.headers.get("location") ?? ""

dire(`POST de la Server Action → ${reponse.status}${destination ? ` → ${decodeURIComponent(destination)}` : ""}`)

// --- 5. Trancher ------------------------------------------------------------
if (reponse.status === 500) {
  echec(
    `la Server Action répond 500. C'est la signature de BUG-36 : le relais ne ` +
      `transmet pas le port dans « Host ». Vérifiez que nginx.conf pose bien ` +
      `« proxy_set_header Host $http_host; » sur ses quatre blocs location, ` +
      `puis rechargez nginx.`
  )
}

if (reponse.status < 300 || reponse.status >= 400) {
  echec(
    `la Server Action répond ${reponse.status} au lieu d'une redirection. ` +
      `Ce n'est pas la signature de BUG-36, mais l'action n'a pas abouti.`
  )
}

if (!destination.includes(SLUG_INEXISTANT)) {
  echec(
    `la redirection pointe vers « ${destination} », qui ne porte pas le slug posté. ` +
      `L'action n'a pas exécuté le chemin attendu.`
  )
}

// --- 6. Éprouver le chemin AUTHENTIFIÉ, sans ouvrir de session -------------
//
// Story 2.6, AC-2. Jusqu'ici ce script ne parcourait que du public — et il
// serait donc resté VERT le 16-08-2026, sur un produit où plus personne ne
// pouvait entrer (BUG-37).
//
// L'épreuve tente une connexion volontairement INVALIDE. Le motif est
// mesuré, pas supposé : `auth.ts:157-159` lit la ligne `Agency`
// (`include: { agency: true }`) AVANT `compare()` en ligne 188. Un mot de
// passe faux traverse donc exactement le code qui casse sous dérive, sans
// accorder aucun accès et sans qu'aucun secret n'ait à être détenu.
//
// Les deux signatures ont été relevées le 16-08-2026, contre la pile saine
// et contre une image dérivée lancée en side-car :
//
//   sain    302 → /auth/login?error=CredentialsSignin&code=credentials
//   dérivé  302 → /auth/error?error=Configuration
//
// Ce n'est pas seulement le paramètre `error=` qui change, c'est le CHEMIN :
// un refus normal renvoie vers l'écran de connexion, une exception vers
// l'écran d'erreur.
const jeton = await lire(`${BASE}/api/auth/csrf`, {
  signal: AbortSignal.timeout(DELAI_EPREUVE_MS),
})
const csrf = (await jeton.json()).csrfToken

// NextAuth lie le jeton CSRF a un cookie : les deux doivent repartir
// ensemble, sinon la route repond `error=MissingCSRF` — mesure, pas suppose.
//
// Deux pieges ici, tous deux MESURES le 16-08-2026 en voyant l'epreuve
// echouer sur `error=MissingCSRF` :
//
//   1. `getSetCookie()` rend l'en-tete COMPLET, attributs compris
//      (`Path=/; HttpOnly; SameSite=Lax`). Les recoller tels quels fabrique
//      un en-tete `Cookie` invalide. On ne garde que `nom=valeur`.
//
//   2. La route pose DEUX `authjs.csrf-token`, et seul le SECOND correspond
//      au `csrfToken` rendu dans le corps. Envoyer les deux fait retenir le
//      premier — le perime — et NextAuth refuse. Un navigateur ecrase les
//      doublons ; on fait pareil, le dernier gagne.
const enTetes =
  jeton.headers.getSetCookie?.() ??
  (jeton.headers.get("set-cookie") ? [jeton.headers.get("set-cookie")] : [])

const bocal = new Map()

for (const entete of enTetes) {
  const paire = entete.split(";")[0].trim()
  bocal.set(paire.slice(0, paire.indexOf("=")), paire)
}

const biscuits = Array.from(bocal.values()).join("; ")

if (!csrf) {
  echec(`/api/auth/csrf ne rend pas de jeton : NextAuth répond-il ?`, 2)
}

const epreuve = new URLSearchParams({
  csrfToken: csrf,
  email: COMPTE_SONDE,
  password: "mot-de-passe-volontairement-faux-verification-de-deploiement",
  callbackUrl: `${BASE}/agency`,
})

const refus = await lire(`${BASE}/api/auth/callback/credentials`, {
  method: "POST",
  headers: {
    Origin: BASE,
    "Content-Type": "application/x-www-form-urlencoded",
    ...(biscuits ? { Cookie: biscuits } : {}),
  },
  body: epreuve,
  redirect: "manual",
  signal: AbortSignal.timeout(DELAI_EPREUVE_MS),
})

const apres = refus.headers.get("location") ?? ""

dire(`épreuve d'échec sur ${COMPTE_SONDE} → ${refus.status} → ${apres || "(sans redirection)"}`)

if (apres.includes("/auth/error")) {
  echec(
    `la connexion part vers l'écran d'ERREUR au lieu de l'écran de connexion. ` +
      `C'est la signature de BUG-37 : l'image en service ne sait pas lire la ` +
      `base — un mot de passe faux devrait être refusé, pas lever. ` +
      `Regardez « docker logs » et reconstruisez l'image.`
  )
}

if (!apres.includes("error=CredentialsSignin")) {
  echec(
    `la connexion invalide rend « ${apres || refus.status} » au lieu du refus ` +
      `attendu (error=CredentialsSignin). Ce n'est PAS un succès : le chemin ` +
      `authentifié n'a pas été éprouvé.`
  )
}

console.log(
  `\n✅ Le relais conserve le port : la Server Action s'est exécutée jusqu'à sa ` +
    `redirection.\n   Aucun enregistrement créé (slug volontairement introuvable).` +
    `\n   Le chemin authentifié refuse proprement : l'image sait lire la base.` +
    `\n   Aucune session ouverte, aucun mot de passe valide détenu.\n`
)
