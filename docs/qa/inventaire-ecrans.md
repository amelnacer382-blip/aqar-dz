# Inventaire des écrans — référence de test manuel

> **Établi le 15 août 2026 par lecture intégrale de `app/`** (57 `page.tsx`,
> 19 routes API, 41 Server Actions), branche
> `story/5.12-5.13-barres-de-navigation`.
>
> **À quoi sert ce document.** Il liste **toutes** les pages atteignables au
> navigateur, avec pour chacune : son adresse, qui peut l'ouvrir, ce qu'elle
> affiche, les champs de ses formulaires, ce que font ses boutons, et un
> **verdict**. Il est fait pour être ouvert à côté du navigateur pendant un
> passage de test.
>
> **Ce qu'il n'est pas.** Ce n'est pas un rapport de défauts : le registre
> reste `docs/qa/bug-report.md` (35 défauts, BUG-01 à BUG-35). Les constats
> nouveaux relevés ici sont marqués **`NEW-nn`** et n'ont **ni numéro de
> défaut ni story** — ils devront en recevoir un (`CLAUDE.md` §1) avant
> d'être corrigés.
>
> **Statut des vérifications**, honnêtement :
>
> | Contrôle | Fait ? | Résultat |
> |---|---|---|
> | Lecture du code de chaque page | ✅ exécuté | 57 pages lues |
> | `npx tsc --noEmit` | ✅ exécuté le 15-08-2026 | **0 erreur** |
> | `npm run lint` | ✅ exécuté le 15-08-2026 | **0 erreur, 4 avertissements** (`<img>`) |
> | `npm run test:e2e` | ❌ **non lancé** | démarre le projet — `CLAUDE.md` §2 |
> | Reproduction au navigateur | ❌ **non faite** | c'est votre passage de test |
>
> Chaque constat porte donc **`[LECTURE]`** (déduit du code, à confirmer à
> l'écran) ou **`[MESURÉ]`** (constaté par une commande exécutée).
>
> ---
>
> ### ⚠️ Mise à jour du 15-08-2026 — une session au navigateur a eu lieu
>
> Les 33 constats ont été éprouvés à l'écran. Les verdicts sont dans
> **[`verification-navigateur.md`](verification-navigateur.md)** : 16
> confirmés, **1 infirmé** (NEW-33, corrigé ci-dessous), 4 non tranchables,
> 2 constats nouveaux.
>
> **Deux découvertes dominent tout ce document et n'y figuraient pas :**
>
> 1. **NEW-34 — derrière nginx, aucune Server Action ne fonctionne.**
>    `proxy_set_header Host $host` perd le port ; Next compare à l'`Origin`
>    et refuse toutes les actions (`POST 500`). **Le déploiement documenté
>    est en lecture seule.** Tous les parcours de test « créer / modifier »
>    du §10 sont donc **impossibles en l'état**.
> 2. **L'instance déployée date du 9 août et accuse 67 commits de retard** ;
>    elle porte encore BUG-33 (désactiver un compte ne coupe rien), corrigé
>    dans la branche le 12 août. Reconstruire l'image avant tout test de
>    sécurité.

---

## Sommaire

1. [Comptages, et comment les recalculer](#1-comptages-et-comment-les-recalculer)
2. [Se connecter : comptes, adresses, environnements](#2-se-connecter--comptes-adresses-environnements)
3. [Le modèle d'accès — qui voit quoi](#3-le-modèle-daccès--qui-voit-quoi)
4. [Espace **public** — 3 écrans + 2 pages système](#4-espace-public)
5. [Espace **authentification** — 6 écrans](#5-espace-authentification)
6. [Espace **super admin** — 5 écrans](#6-espace-super-admin)
7. [Espace **agence** — 43 écrans](#7-espace-agence)
8. [Routes API — 19 points d'entrée](#8-routes-api)
9. [**Verdict** — ce qui est cassé, suspect, ou manquant](#9-verdict)
10. [Parcours de test proposé](#10-parcours-de-test-proposé)

---

## 1. Comptages, et comment les recalculer

Aucun de ces nombres n'est recopié : chacun vient de la commande écrite à
côté, exécutée le 15-08-2026.

| Quoi | Nombre | Commande |
|---|---:|---|
| Pages (`page.tsx`) | **57** | `find app -name page.tsx \| wc -l` |
| — dont `/admin` | 5 | `find app/admin -name page.tsx \| wc -l` |
| — dont `/agency` | 43 | `find app/agency -name page.tsx \| wc -l` |
| — dont `/auth` | 6 | `find app/auth -name page.tsx \| wc -l` |
| — dont public (`/`, `/vitrine`) | 3 | racine + `find app/vitrine -name page.tsx \| wc -l` |
| Routes API | **19** | `find app/api -name "route.ts*" \| wc -l` |
| Server Actions | **41** | 36 inline (`grep -rhoE '^\s+async function [a-zA-Z]+\(formData' app --include=*.tsx \| wc -l`) + 5 exportées dans les 4 `actions.ts` |
| Pages sans `metadata` propre | **23** | `for f in $(find app -name page.tsx); do grep -qE "export const metadata\|generateMetadata" "$f" \|\| echo "$f"; done \| wc -l` |

> ⚠ **`docs/architecture.md` annonce « 31 Server Actions » et « 28 écrans
> agence »** : les deux chiffres sont **périmés**. Le compte réel est
> **41 actions** et **43 écrans agence**. C'est exactement le mécanisme que
> `CLAUDE.md` §7 décrit — un nombre recopié de document en document. **NEW-01.**

---

## 2. Se connecter : comptes, adresses, environnements

### Environnements

| Mode | Commande | Adresse | Accord §2 requis ? |
|---|---|---|---|
| Développement | `npm run dev` | `http://localhost:3002` | ✅ **oui** |
| Pile conteneurisée | `docker compose -f docker-compose.prod.yml up -d` | `http://localhost:8095` (nginx) | ✅ **oui** |

> Le port applicatif n'est **pas** publié en production : PostgreSQL écoute
> sur la boucle locale uniquement, et nginx est la seule porte.

### Comptes du jeu de démonstration

`docker compose -f docker-compose.prod.yml --profile seed run --rm seed`
— **mot de passe commun : `password123`** (`prisma/seed.ts:16`).

| Email | Rôle | Agence | Sert à tester |
|---|---|---|---|
| `superadmin@aqar.dz` | `super_admin` | *aucune* (`agencyId = null`) | toute la console `/admin` |
| `admin@aqar.dz` | `agency_admin` | Agence Démo (`active`) | tout `/agency`, y compris les 5 écrans réservés |
| `agent@aqar.dz` | `agent` | Agence Démo (`active`) | le **refus** des 5 écrans réservés |
| `attente@aqar.dz` | `agency_admin` | Agence en attente (`pending`) | l'écran `/auth/inactive` et le refus de connexion |

- Vitrine publique de démonstration : **`/vitrine/agence-demo`**
- Seconde vitrine : `agence-en-attente` — **elle doit renvoyer 404**,
  l'agence n'étant pas `active`.

> ⚠ **Ces quatre comptes sont partagés par toute la suite E2E**
> (`CLAUDE.md` §3). Ne les désactivez pas, ne les rétrogradez pas, et ne
> saturez pas leur compteur de tentatives (**10 essais / compte / 15 min**).
> Pour tâtonner, créez un compte jetable depuis `/agency/users`.

---

## 3. Le modèle d'accès — qui voit quoi

### Les trois rôles

| Rôle | Espace | Peut supprimer ? | Gère les comptes ? |
|---|---|---|---|
| `super_admin` | `/admin` **uniquement** | agences : non (statut seulement) | oui, tous |
| `agency_admin` | `/agency` **uniquement** | oui | oui, dans son agence |
| `agent` | `/agency`, 12 écrans sur 17 | **non** | non |

**Un `super_admin` n'a aucun accès à l'espace agence**, et réciproquement.
`requireAgency()` renvoie un éditeur vers `/admin` ; `requireSuperAdmin()`
renvoie tout autre rôle vers `/agency` (`lib/auth-guard.ts`).

### Où se décide l'autorisation

**Une seule couche : `lib/auth-guard.ts`**, qui relit **la base** à chaque
requête (compte existant, `isActive`, `role`, `agencyId`, statut de
l'agence). Le middleware **n'autorise plus rien** : il vérifie qu'une
session existe, refuse `/uploads/documents/` en 404, et laisse passer.

> **Conséquence pour votre test** : désactiver un compte ou changer son rôle
> **coupe à la requête suivante**, sans reconnexion. À vérifier en direct
> avec deux navigateurs.

### Les 5 écrans réservés à l'administrateur d'agence

Gardés par `requireAgencyAdmin()`, **et masqués dans la navbar** pour un
agent (le masquage est un affichage, pas une garde) :

| Écran | Adresse |
|---|---|
| Vitrine | `/agency/showcase` |
| Corbeille | `/agency/trash` |
| Comptes | `/agency/users` |
| Journal | `/agency/audit` |
| Paramètres | `/agency/settings` |

Un agent qui force l'adresse est renvoyé sur `/agency?error=Action réservée
à l'administrateur de l'agence` — **et le tableau de bord affiche bien ce
message** (`app/agency/page.tsx` lit `searchParams`).

### Navigation (règle 3 : navbar horizontale, jamais de sidebar)

- **Public** : `LandingNavbar` — Fonctionnalités / Tarifs / Contact (ancres).
- **Admin** : `AdminNavbar` — Dashboard, Agences, Utilisateurs, Statistiques,
  Paramètres.
- **Agence** : `AgencyNavbar` — 17 entrées en 3 groupes :
  - *primaires* : Accueil, **Vitrine\***, Biens, Clients, Visites
  - *transactions* (menu) : Ventes, Locations, Gestion locative, Paiements
  - *plus* (menu) : Propriétaires, Documents, Messages reçus, Statistiques,
    **Corbeille\***, **Comptes\***, **Journal\***, **Paramètres\***

  `*` = masqué pour un agent.

---

## 4. Espace public

> Aucune authentification. Le middleware laisse passer tout ce qui n'est ni
> `/agency`, ni `/admin`, ni une API non publique.

### 4.1 `/` — Page d'accueil (landing)

| | |
|---|---|
| Fichier | `app/page.tsx` (31 l.) + 7 composants `components/landing/` |
| Garde | aucune |
| Titre d'onglet | *(défaut)* « Aqar DZ — Le logiciel des agences immobilières algériennes » |
| Type | **vitrine produit**, pas de formulaire enregistré |

**Contenu** : `ScrollProgress` (barre de progression), `HeroSection`,
`WilayaBand`, `FeaturesSection`, `PricingSection` (`#pricing`),
`ContactSection` (`#contact`), `Footer`.

**À vérifier** : les 3 ancres de la navbar ; la pastille de section qui suit
le défilement ; le menu plein écran en mobile (il bloque le défilement du
`body`) ; que la barre est **invisible en haut de page** puis se replie en
îlot flottant après 12 px de scroll.

**Verdict** :

- 🟠 **NEW-02 — le formulaire de contact de la page d'accueil est une
  simulation.** `[LECTURE — code lu directement]`
  `components/landing/ContactSection.tsx:17` :

  ```ts
  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    // Simulation d'envoi
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsLoading(false)
    setIsSent(true)
  }
  ```

  **Aucun appel réseau, aucune Server Action, aucun email, aucune ligne en
  base.** Le prospect voit un écran de confirmation et son message n'existe
  nulle part. C'est le formulaire de contact **commercial** du produit —
  celui par lequel arrivent les agences qui veulent s'inscrire.
  À rapprocher de `submitLead`, qui, lui, enregistre et notifie
  correctement : le motif existe, il n'a simplement pas été appliqué ici.

---

### 4.2 `/vitrine/[slug]` — Vitrine publique d'une agence

| | |
|---|---|
| Fichier | `app/vitrine/[slug]/page.tsx` (395 l.) |
| Garde | **aucune** — mais l'agence doit être `status: "active"` **et** `showcaseEnabled: true`, sinon **404** |
| Titre d'onglet | `{Nom agence} — Biens à vendre et à louer` (`generateMetadata`) |
| Adresse de test | `/vitrine/agence-demo` |

**Affiche** : bandeau photo plein cadre (`PhotoBackdrop`, rotation 8 s) avec
nom, description, adresse, téléphone (`tel:`), email (`mailto:`), et le
**compteur de biens disponibles** ; puis une grille de cartes.

**Ne montre que** les biens `status: "disponible"` **et** `isAvailable: true`.

**Formulaire de recherche** (méthode `GET`, 5 champs) :

| Champ | Type | Valeurs |
|---|---|---|
| `operation` | select | Toutes / `vente` / `location` |
| `type` | select | les 10 `PROPERTY_TYPE_LABELS` |
| `wilaya` | select | wilayas **distinctes des biens de l'agence** |
| `maxPrice` | number | budget max en DA |
| — | submit | « Rechercher » |

**Verdicts** :

- 🟡 **BUG-08 (ouvert)** — **aucune pagination**. Une agence avec 500 biens
  publiés rend 500 cartes en une page.
- 🟡 **BUG-29 (ouvert)** — le select `wilaya` est alimenté par
  `status: "disponible"` **sans** `isAvailable: true`, alors que la liste
  filtre sur les deux. Une wilaya peut donc être proposée **et ne rendre
  aucun résultat**. Reproductible : passez un bien à `isAvailable: false`
  s'il est seul dans sa wilaya.
- 🟠 **NEW-03 `[LECTURE]`** — le filtre `maxPrice` construit
  `OR: [salePrice ≤ max, rentPrice ≤ max]` **sans le combiner** au filtre
  `operation`. Un bien en vente qui porte aussi un `rentPrice` peut
  ressortir d'une recherche « à vendre, budget 50 000 DA ».
- ⚪ La page rend `<FormMessage>` pour `?success=` / `?error=` mais **ne
  porte aucun formulaire d'envoi** : ces paramètres n'arrivent ici que si
  `returnTo` est forcé à la main.

---

### 4.3 `/vitrine/[slug]/biens/[id]` — Fiche publique d'un bien

| | |
|---|---|
| Fichier | `app/vitrine/[slug]/biens/[id]/page.tsx` (336 l.) |
| Garde | aucune — 404 si le bien n'est pas `disponible` + `isAvailable` **et** l'agence pas publiée |
| Titre d'onglet | `{Titre du bien} — {Agence}` |

**Affiche** : galerie (`PropertyGallery`), badges opération / type /
catégorie, titre, localisation complète, prix (vente, ou loyer `/ mois`, ou
« Prix sur demande »), caractéristiques (surface, pièces, chambres, SDB),
équipements (garage, jardin, terrasse, meublé), descriptif.

**Formulaire « Ce bien vous intéresse ? »** → Server Action `submitLead`
(`app/vitrine/[slug]/actions.ts`) :

| Champ | Type | Obligatoire | Note |
|---|---|---|---|
| `slug`, `propertyId`, `returnTo` | hidden | — | re-vérifiés côté serveur |
| `website` | hidden, `className="hidden"` | — | **piège à robots** : s'il est rempli, la page répond « succès » sans rien enregistrer |
| `firstName` | text | ✅ | |
| `lastName` | text | ✅ | |
| `phone` | tel | — | **au moins l'un des deux** |
| `email` | email | — | **au moins l'un des deux** |
| `message` | textarea | ✅ | `minLength=10`, pré-rempli |

**Protections** : 5 messages / heure / adresse IP ; l'agence est résolue par
son slug (jamais par un champ posté) ; un `propertyId` étranger est
silencieusement remis à `null`.

**Verdicts** :

- 🟠 **NEW-04 `[LECTURE]`** — **les messages de `submitLead` sont sans
  accents**, dans un produit qui en met partout (`CLAUDE.md` §11 :
  « les chaînes vues par un utilisateur en portent »). Trois occurrences :
  `"Message envoye"`, `"Votre message a bien ete envoye…"`,
  `"Indiquez au moins un telephone ou un email pour etre recontacte"`.
  **Visible immédiatement à l'écran** après un envoi.
- ✅ Le piège à robots répond « succès » — c'est voulu, ne le lisez pas
  comme un bug pendant le test.

---

### 4.4 Pages système

| Adresse | Fichier | Contenu | Verdict |
|---|---|---|---|
| *404* | `app/not-found.tsx` | « Cette page n'existe pas », 2 boutons (Accueil, Mon espace) | ✅ soigné, titre propre |
| *500* | `app/error.tsx` | « Une erreur est survenue » + `digest` affiché, boutons Réessayer / Accueil | ✅ ne fuit jamais le message d'origine |
| `/robots.txt` | `app/robots.ts` | exclut `/uploads/` (BUG-16 corrigé) | ✅ |
| `/sitemap.xml` | `app/sitemap.xml/route.ts` | **index** `<sitemapindex>` renvoyant vers les plans partiels (story 3.12) | ✅ mesuré le 17-08-2026 : 272 o, 2 parties |
| `/sitemap/<partie>.xml` | `app/sitemap/[partie]/route.ts` | un `<urlset>` par tranche de 45 000 URL ; une partie inconnue répond **404** | ✅ mesuré : `agences-0.xml` 8 084 o / 44 entrées |

---

## 5. Espace authentification

### 5.1 `/auth/login` — Connexion

| | |
|---|---|
| Fichier | `app/auth/login/page.tsx` (174 l.), **composant client** |
| Garde | aucune |
| Titre d'onglet | ⚠ *(défaut générique)* |

**Champs** : `email` (requis), `password` (requis, œil afficher/masquer).
**Liens** : « Mot de passe oublié ? » → `/auth/forgot` ; « Inscrire mon
agence » → `/auth/register`.

**Mécanique** — c'est un **double appel délibéré** :
1. `signIn("credentials", { redirect: false })` → NextAuth ne sait renvoyer
   qu'un échec générique ;
2. en cas d'échec, la Server Action `explainLoginFailure(email, password)`
   **revalide le mot de passe** puis donne la raison exacte.

**Messages précis obtenus** (uniquement après preuve d'identité) :
- « Votre compte utilisateur a été désactivé… »
- « Votre agence n'est pas encore activée par Aqar DZ… » → testez avec
  `attente@aqar.dz`
- « L'accès de votre agence a été suspendu… »
- « Votre compte n'est rattaché à aucune agence… »
- sinon : « Email ou mot de passe incorrect »

**Limites de débit** : 10 essais / compte / 15 min, 60 / IP / 15 min — **et
`explainLoginFailure` a son propre budget**, ce qui double le budget réel
(**BUG-17, ouvert**).

**Verdicts** :

- ⚪ `callbackUrl` vaut `/agency` par défaut : un `super_admin` fait donc un
  **aller-retour** `/agency` → `/admin`. Fonctionne, mais l'adresse
  clignote. **NEW-05 `[LECTURE]`**.
- ⚪ La page lit `?error=` et `?success=` de l'URL — c'est par là qu'arrivent
  les messages de `refusDeCompte()` et du lien de réinitialisation consommé.

---

### 5.2 `/auth/register` — Inscription d'une agence

| | |
|---|---|
| Fichier | `app/auth/register/page.tsx` (454 l.), **composant client** |
| Cible | `POST /api/auth/register` (JSON, `fetch`) |
| Titre d'onglet | ⚠ *(défaut générique)* |

**Champs** :

| Groupe | Champ | Type | Obligatoire | Règle serveur |
|---|---|---|---|---|
| Votre agence | `agencyName` | text | ✅ | unicité du **nom** |
| | `wilaya` | select fermé (58 wilayas, `lib/wilayas.ts`) | ✅ | |
| | `phone` | tel | — | |
| | `address` | text | — | |
| Votre compte | `email` | email | ✅ | unicité, normalisé en minuscules |
| | `password` | password | ✅ | **6 caractères minimum** |
| | `confirmPassword` | password | ✅ | égalité |

Deux règles sont **vérifiées en direct** pendant la saisie (pastilles
vertes) : longueur et correspondance.

**Ce qui se passe côté serveur** : transaction Prisma qui crée l'agence en
`status: "pending"`, plan `basic`, **avec un slug de vitrine attribué
d'office** (`availableSlug`, jusqu'à 20 tentatives suffixées), puis le
compte `agency_admin`. Les `super_admin` actifs reçoivent un email de
notification. **5 inscriptions / heure / IP.**

**Écran de succès** : « {Agence} est enregistrée », redirection automatique
vers `/auth/login` **après 5 secondes**.

**Verdicts** :

- 🔵 **BUG-12 (ouvert)** — deux inscriptions simultanées sur le même email
  produisent un **500** au lieu d'un message.
- ⚪ Le texte de succès affirme « le logiciel n'envoie pas d'email », alors
  que l'activation en envoie un (`notifyAgencyActivated`). Formulation
  prudente, pas un défaut.

---

### 5.3 `/auth/forgot` — Mot de passe oublié

| | |
|---|---|
| Fichier | `app/auth/forgot/page.tsx` (113 l.) + `actions.ts` |
| Champ | `email` (requis) |

**Réponse volontairement identique** que le compte existe ou non (anti
énumération). Si SMTP n'est pas configuré, un **bandeau ambre** le dit
explicitement et renvoie vers l'éditeur.

**Limites** : 5 demandes / heure **par IP** et 5 / heure **par compte** — les
deux compteurs sont consommés puis la décision est prise (REP-39 corrigé).

**Verdict** : ✅ Bien traité. En développement sans SMTP, le lien atterrit
dans `.mail/` (repli fichier de `lib/mailer.ts`) — allez l'y chercher pour
tester `/auth/reset/[token]`.

---

### 5.4 `/auth/reset/[token]` — Nouveau mot de passe

| | |
|---|---|
| Fichier | `app/auth/reset/[token]/page.tsx` (156 l.) |
| Titre d'onglet | ⚠ *(défaut générique)* |

**Deux états** :
- **jeton invalide/expiré/consommé** → écran « Lien expiré » + bouton
  « Demander un nouveau lien ». **Durée de vie : 1 heure, usage unique.**
- **jeton valide** → l'email du compte est affiché, puis 2 champs :
  `password` et `confirmPassword` (**6 caractères minimum**).

Le jeton est **revalidé à l'enregistrement** (il peut expirer pendant la
saisie), le changement est journalisé, puis redirection vers
`/auth/login?success=Mot de passe modifié…`.

**Verdict** : ✅ Correct. ⚠ Rappel produit : **changer le mot de passe ne
ferme aucune session ouverte** (stratégie JWT). Le seul remède est la
désactivation du compte.

---

### 5.5 `/auth/inactive` — Agence en attente ou suspendue

| | |
|---|---|
| Fichier | `app/auth/inactive/page.tsx` (63 l.) |
| Atteinte par | `requireAgency()` quand `agency.status !== "active"`, via `?status=pending\|suspended` |
| Titre d'onglet | « Compte en attente · Aqar DZ » ✅ |

**Verdict** :

- 🟠 **NEW-06 `[MESURÉ` par lecture du fichier`]`** — **tout le texte
  utilisateur est sans accents** : « L'acces de votre agence a ete
  suspendu », « Votre inscription a bien ete enregistree », « Un
  administrateur Aqar DZ doit activer votre agence », « Retour a la
  connexion ». C'est **la page la plus visible du parcours d'inscription**,
  et elle contredit frontalement `CLAUDE.md` §11. Correction triviale,
  impact visuel immédiat.

---

### 5.6 `/auth/error` — Erreur d'authentification NextAuth

| | |
|---|---|
| Fichier | `app/auth/error/page.tsx` (74 l.), composant client |
| Codes traités | `CredentialsSignin`, `AgencyPending`, `AgencySuspended`, `AccessDenied`, `OAuthAccountNotLinked`, défaut |

**Verdicts** :

- 🟡 **NEW-07 `[LECTURE]`** — cette page est **le seul écran du produit qui
  n'utilise pas `AuthShell` ni la palette `dar-*`** : elle est en
  `bg-gradient-to-b from-slate-50 to-white`, héritée d'un design antérieur.
  Rupture visuelle nette avec `/auth/login`, `/auth/forgot`, `/auth/reset`.
- 🟡 **NEW-08 `[LECTURE]`** — trois des cinq codes traités
  (`AgencyPending`, `AgencySuspended`, `OAuthAccountNotLinked`) **ne peuvent
  plus être émis** : `authorize()` ne renvoie qu'un échec générique, le
  provider OAuth n'existe pas, et le statut d'agence est expliqué par
  `explainLoginFailure()` sur `/auth/login`. Code mort d'affichage.

---

## 6. Espace super admin

> **Garde : `requireSuperAdmin()` en première ligne des 5 pages** — vérifié :
> `grep -L requireSuperAdmin app/admin/**/page.tsx` ne renvoie rien.
> Fond **`bg-slate-950`** (thème sombre), distinct de l'espace agence.
>
> `app/admin/layout.tsx` ne pose **aucun cadre** : chaque page rend sa propre
> `AdminNavbar` et son propre `<main>`.

### 6.1 `/admin` — Dashboard Super Admin

| | |
|---|---|
| Fichier | `app/admin/page.tsx` (151 l.) |
| Titre | « Console · Aqar DZ » ✅ |
| Formulaire | **aucun** — lecture seule |

**4 tuiles** : Total Agences, Agences Actives, Utilisateurs, Total Biens.
**1 tableau** « Agences récentes » (10 dernières) : Agence, Email, Wilaya,
Statut *(badge)*, Plan, Inscription.

**Verdicts** :

- 🔵 **NEW-09 `[LECTURE]`** — la requête charge `include: { users: { take: 1 } }`
  et **n'affiche jamais** ce champ. Requête inutile à chaque chargement.
- ⚪ Aucun lien depuis les lignes du tableau vers l'agence — il faut passer
  par `/admin/agencies`.

---

### 6.2 `/admin/agencies` — Gestion des agences

| | |
|---|---|
| Fichier | `app/admin/agencies/page.tsx` (347 l.) |
| Titre | « Agences · Aqar DZ » ✅ |
| Recherche / pagination | ❌ **aucune** — toutes les agences, toujours |

**Colonnes** : Agence (+ date d'inscription), Contact (email / téléphone),
Localisation (wilaya / commune), Statut, Plan, **Abonnement**, Utilisateurs,
Biens, Actions.

**Formulaire n°1 — échéance d'abonnement** (une ligne par agence) →
`updateSubscription` :

| Champ | Type | Effet |
|---|---|---|
| `agencyId` | hidden | |
| `endsAt` | `date`, pré-rempli | **champ vide = échéance effacée** |

Sous le champ, `SubscriptionHint` affiche l'état : « Aucune échéance
suivie » / « Expiré depuis N j » *(rouge)* / « Expire dans N j » *(ambre)* /
« À jour — N j restants ».

> **L'échéance ne coupe rien.** Seul le **statut** ouvre ou ferme la porte.

**Formulaire n°2 — statut** (3 boutons conditionnels) → `updateAgencyStatus` :

| Bouton | Icône | Nouveau statut | Visible si |
|---|---|---|---|
| vert | `CheckCircle` | `active` | statut ≠ active |
| ambre | `PauseCircle` | `suspended` | statut ≠ suspended |
| rouge | `XCircle` | `pending` | statut ≠ pending |

Passer à `active` depuis un autre statut **envoie un email** à l'agence
(`notifyAgencyActivated`). Tout changement est **journalisé**.

**Verdicts** :

- 🟡 **BUG-06 (ouvert)** — `updateAgencyStatus` fait
  `formData.get("status") as "pending" | "active" | "suspended"`. C'est
  **exactement l'interdit de `CLAUDE.md` §2** (« `formData.get(x) as Enum` »).
  Le schéma qui devrait s'appliquer **existe déjà** :
  `agencyStatusSchema` (`lib/validations/index.ts:561`) — il n'est **importé
  nulle part**. Un POST forgé avec `status=n'importe quoi` écrit cette valeur
  en base et **verrouille l'agence**, aucun statut inconnu n'étant `active`.
  → À rejouer en test de Server Action (pas au clic).
- 🟡 **BUG-07 (ouvert)** — `include: { users: true, properties: true }` charge
  **toutes** les lignes de chaque agence pour n'en afficher que le nombre.
  À 50 agences × 500 biens, la page devient inutilisable.
- 🟡 **NEW-10 `[LECTURE]`** — les trois boutons de statut **n'ont ni libellé,
  ni confirmation, ni `title`**. Trois icônes colorées côte à côte :
  suspendre une agence en production tient à un clic mal visé. Le bouton
  d'échéance, lui, porte bien un `title`.
- 🔵 **NEW-11 `[LECTURE]`** — aucune recherche ni pagination : au-delà de
  ~50 agences l'écran devient une seule très longue table.

---

### 6.3 `/admin/users` — Gestion des utilisateurs

| | |
|---|---|
| Fichier | `app/admin/users/page.tsx` (465 l.) |
| Titre | « Utilisateurs · Aqar DZ » ✅ |
| Recherche | ✅ `ListToolbar` (nom, email) |
| Pagination | ✅ 25/page |

**3 tuiles** : Total utilisateurs, Admins d'agence, Agents.
**Colonnes** : Utilisateur (nom + email), Rôle *(badge)*, Agence (+ statut si
≠ active), Statut, **Dépannage**.

**Formulaire n°1 — réinitialiser un mot de passe** → `resetPassword` :

| Champ | Type | Règle |
|---|---|---|
| `userId` | hidden | |
| `password` | **`type="text"`**, `minLength=8` | **8 caractères minimum** |

Le mot de passe est haché en bcrypt(12), l'action est **journalisée**, et le
message de retour rappelle de le transmettre par téléphone.

**Formulaire n°2 — couper / rétablir l'accès** → `toggleActive` :
- refus de se désactiver soi-même (le bouton n'est même pas rendu) ;
- **refus de désactiver le dernier `agency_admin` actif d'une agence**, avec
  le message « Pour fermer l'agence, suspendez-la depuis la page Agences ».

**Verdicts** :

- 🟠 **NEW-12 `[LECTURE]`** — **il n'existe aucun moyen de créer un compte
  depuis la console éditeur**, ni de changer un rôle. Créer un second
  `super_admin` passe obligatoirement par la base ou par `prisma/seed.ts`.
  Combiné à « un `super_admin` désactivé ne peut être réactivé que par un
  autre `super_admin` » (`refusDeCompte("editeur")`), une plateforme à un
  seul éditeur peut se verrouiller définitivement.
- 🔵 **NEW-13 `[LECTURE]`** — le champ mot de passe est `type="text"` : il
  s'affiche en clair à l'écran. C'est probablement délibéré (l'éditeur doit
  le relire pour le dicter), mais sur un poste partagé c'est une fuite.
  À trancher, pas à corriger en silence.
- ✅ Le garde « dernier administrateur » est **au bon endroit ici**, et son
  commentaire explique pourquoi il est inatteignable dans la console
  d'agence. Bonne pièce à tester : désactivez `admin@aqar.dz` depuis
  `/admin/users` — cela **doit** échouer.

---

### 6.4 `/admin/statistics` — Statistiques plateforme

| | |
|---|---|
| Fichier | `app/admin/statistics/page.tsx` (236 l.) |
| Titre | « Statistiques plateforme · Aqar DZ » ✅ |
| Formulaire | **aucun** — pas de sélecteur de période |

**4 tuiles** : Agences, Utilisateurs, Biens gérés, **Volume de ventes**
(somme de `finalPrice`, format compact).
**Graphiques** : `TrendChart` « Nouvelles agences par mois » (**12 mois
fixes**), `BarChart` « Agences par statut », `BarChart` « Biens par type »
(top 8).
**Tableau** : « Dernières agences inscrites » (10) — Agence, Statut, Biens,
Clients, Utilisateurs.

**Verdicts** :

- ⚪ Les graphiques sont posés sur des `Card` **claires** au milieu d'une page
  sombre — c'est **délibéré** (« la palette a été validée sur fond blanc »).
  Ne le signalez pas comme un bug de thème.
- 🔵 **NEW-14 `[LECTURE]`** — « Volume de ventes » agrège **toutes** les
  ventes quel que soit leur `status`, y compris celles encore en
  `negociation` ou annulées. Le chiffre affiché n'est pas un volume réalisé.
- 🔵 **NEW-15 `[LECTURE]`** — période figée à 12 mois, alors que
  `/agency/statistics` propose bien un sélecteur (`?months=`). Asymétrie.

---

### 6.5 `/admin/settings` — Paramètres plateforme

| | |
|---|---|
| Fichier | `app/admin/settings/page.tsx` (240 l.) |
| Titre | « Paramètres plateforme · Aqar DZ » ✅ |
| Messages | ✅ `<FormMessage>` présent |

**Tuiles** : une par formule (`basic`, `premium`) avec le nombre d'agences.
**Colonnes** : Agence (+ `/vitrine/{slug}`), Statut, Formule, Vitrine
(Publiée / Masquée), Inscription, Actions.

**Formulaire n°1 — bascule de formule** → `setPlan` : bouton
« Passer en basic » / « Passer en premium » (`basic` ↔ `premium`, validés).

**Formulaire n°2 — couper la vitrine** → `toggleShowcase` : bascule
`showcaseEnabled`, avec `title` explicite.

**Verdicts** :

- 🟠 **NEW-16 `[LECTURE]`** — **ni `setPlan` ni `toggleShowcase` ne sont
  journalisés**, alors que `updateAgencyStatus` et `updateSubscription` le
  sont. Couper la vitrine publique d'un client est une action conséquente
  (`CLAUDE.md` §5 : « journaliser toute action conséquente »). Rien ne
  permet de savoir qui l'a fait.
- 🟡 **NEW-17 `[LECTURE]`** — la formule (`plan`) est purement décorative :
  aucun code ne lit `agency.plan` pour ouvrir ou fermer quoi que ce soit
  (`grep -rn "\.plan" app lib` ne trouve que des affichages). Un testeur
  cherchera en vain la différence entre `basic` et `premium`.
- ⚪ Cet écran et `/admin/agencies` se recouvrent partiellement (statut vs
  formule vs vitrine, sur deux pages). Confusion possible à l'usage.

---

## 7. Espace agence

> **Garde de base : `requireAgency()`** sur les 43 écrans, **plus
> `requireAgencyAdmin()`** sur 5 d'entre eux. Fond clair `limewash`.
> `app/agency/layout.tsx` ne pose aucun cadre ; `app/agency/loading.tsx`
> rend un squelette **avec la navbar en mode le plus restreint** (le rôle
> n'est pas connu à ce stade — arbitrage assumé).
>
> **Contrat uniforme des Server Actions** :
> `requireAgency()` → `parseForm(schema)` → vérification d'appartenance
> → écriture → `revalidatePath()` → `redirect(withSuccess|withError)`.

### 7.0 Tableau récapitulatif des 43 écrans

| # | Adresse | Garde | Type | Recherche | Export | Msg. affichés |
|---|---|---|---|---|:---:|:---:|
| 1 | `/agency` | agence | tableau de bord | — | — | ✅ |
| 2 | `/agency/showcase` | **admin** | aperçu | — | — | — |
| 3 | `/agency/properties` | agence | liste | ✅ | ✅ | ❌ |
| 4 | `/agency/properties/new` | agence | formulaire | — | — | ✅ |
| 5 | `/agency/properties/[id]` | agence | fiche | — | — | ❌ |
| 6 | `/agency/properties/[id]/edit` | agence | formulaire + suppr. | — | — | ✅ |
| 7 | `/agency/clients` | agence | liste | ✅ | ✅ | ❌ |
| 8 | `/agency/clients/new` | agence | formulaire | — | — | ❌ |
| 9 | `/agency/clients/[id]` | agence | fiche + historique | — | — | ✅ |
| 10 | `/agency/clients/[id]/edit` | agence | formulaire | — | — | ❌ |
| 11 | `/agency/owners` | agence | liste | ✅ | ✅ | ❌ |
| 12 | `/agency/owners/new` | agence | formulaire | — | — | ❌ |
| 13 | `/agency/owners/[id]` | agence | fiche + historique | — | — | ✅ |
| 14 | `/agency/owners/[id]/edit` | agence | formulaire | — | — | ❌ |
| 15 | `/agency/visits` | agence | liste | ✅ | ✅ | ✅ |
| 16 | `/agency/visits/new` | agence | formulaire | — | — | ❌ |
| 17 | `/agency/visits/[id]` | agence | fiche | — | — | ❌ |
| 18 | `/agency/visits/[id]/edit` | agence | formulaire + suppr. | — | — | ✅ |
| 19 | `/agency/sales` | agence | liste | ✅ | ✅ | ❌ |
| 20 | `/agency/sales/new` | agence | formulaire | — | — | ❌ |
| 21 | `/agency/sales/[id]` | agence | fiche + PDF | — | — | ❌ |
| 22 | `/agency/sales/[id]/edit` | agence | formulaire | — | — | ❌ |
| 23 | `/agency/rentals` | agence | liste | ✅ | ✅ | ❌ |
| 24 | `/agency/rentals/new` | agence | formulaire | — | — | ❌ |
| 25 | `/agency/rentals/[id]` | agence | fiche + PDF | — | — | ❌ |
| 26 | `/agency/rentals/[id]/edit` | agence | formulaire | — | — | ❌ |
| 27 | `/agency/rental-management` | agence | tableau de période | — | — | ✅ |
| 28 | `/agency/rental-management/new` | agence | formulaire | — | — | ✅ |
| 29 | `/agency/rental-management/[id]/edit` | agence | formulaire + suppr. + PDF | — | — | ✅ |
| 30 | `/agency/payments` | agence | liste | ✅ | ✅ | ✅ |
| 31 | `/agency/payments/new` | agence | formulaire | — | — | ✅ |
| 32 | `/agency/payments/[id]` | agence | fiche | — | — | ❌ |
| 33 | `/agency/payments/[id]/edit` | agence | formulaire + suppr. + PDF | — | — | ✅ |
| 34 | `/agency/documents` | agence | liste | ✅ | — | ❌ |
| 35 | `/agency/documents/new` | agence | formulaire + upload | — | — | ✅ |
| 36 | `/agency/documents/[id]` | agence | fiche + téléchargement | — | — | ❌ |
| 37 | `/agency/documents/[id]/edit` | agence | formulaire | — | — | ✅ |
| 38 | `/agency/leads` | agence | liste + actions | ✅ | ✅ | ✅ |
| 39 | `/agency/statistics` | agence | graphiques | — | — | — |
| 40 | `/agency/trash` | **admin** | liste + restaurer/purger | — | — | ✅ |
| 41 | `/agency/users` | **admin** | liste + 4 formulaires | — | — | ✅ |
| 42 | `/agency/audit` | **admin** | journal paginé | — | — | — |
| 43 | `/agency/settings` | **admin** | formulaire + logo | — | — | ✅ |

> La colonne **« Msg. affichés »** est la plus importante de ce tableau :
> `❌` signifie que la page **reçoit** des `?success=` / `?error=` mais
> **ne rend pas `<FormMessage>`**. Voir **NEW-18**, le défaut le plus
> transversal du produit.

---

### 7.1 `/agency` — Tableau de bord

| | |
|---|---|
| Fichier | `app/agency/page.tsx` (275 l.) |
| Garde | `requireAgency()` |
| Titre | « Tableau de bord · Aqar DZ » ✅ |

**En-tête** : salutation (« Bonjour » avant 18 h, « Bonsoir » après), nom de
l'agence, date longue en français.

**4 alertes cliquables** (`DashboardHeader`) :

| Compteur | Définition | Mène à |
|---|---|---|
| Visites aujourd'hui | `status: prevue` **et** date = aujourd'hui | `/agency/visits` |
| Relances à faire | `status: effectuee` **et** `followUpDate ≤ maintenant` | `/agency/visits` |
| Messages reçus | leads `status: nouveau` | `/agency/leads` |
| Paiements impayés | paiements `status: impaye` | `/agency/payments?status=impaye` |

**Bandeau d'abonnement** (`SubscriptionNotice`) : ne s'affiche que dans les
15 derniers jours ou après l'échéance. Adresse de contact :
`SUPPORT_EMAIL` ou `contact@aqar.dz`.

**Panneaux** : *Portefeuille* (total + répartition par statut), *Registre*
(Clients suivis, Propriétaires, Visites enregistrées), *Biens récents* (5),
*Prochaines visites* (5, avec « Auj. » / « Demain »).

**Verdict** : ✅ Le meilleur écran du produit. C'est aussi l'écran de
**retombée** des refus de rôle — il affiche bien `?error=`. Testez-le en
ouvrant `/agency/settings` avec `agent@aqar.dz`.

---

### 7.2 `/agency/showcase` — Vitrine *(admin)*

| | |
|---|---|
| Fichier | `app/agency/showcase/page.tsx` (218 l.) |
| Garde | **`requireAgencyAdmin()`** |
| Titre | « Vitrine · Aqar DZ » ✅ |

Aperçu des biens **tels que le public les voit** (`disponible` +
`isAvailable`). Deux états :
- **non publiée** (pas de slug **ou** `showcaseEnabled` faux) → alerte +
  bouton « Configurer ma vitrine » vers `/agency/settings` ;
- **publiée** → carte verte avec l'adresse publique + bouton
  « Voir la vitrine publique » (nouvel onglet).

Bouton conditionnel « N nouveaux messages » vers `/agency/leads`.

**Verdicts** :

- 🔵 **NEW-19 `[LECTURE]`** — aucune pagination : même limite que la vitrine
  publique (BUG-08), sur l'écran interne cette fois.
- ⚪ Écran en **lecture seule** : tout le réglage est dans `/agency/settings`.

---

### 7.3 Module **Biens** (4 écrans)

#### `/agency/properties` — Liste

**Recherche** sur `title`, `reference`, `wilaya`, `commune`, `address`.
**Export CSV** : `/api/export/properties?q=…`. **Pagination** 25/page.
**Colonnes** : Bien (vignette + titre + propriétaire), Référence, Type,
Localisation, Prix, Statut *(badge 5 couleurs)*, Actions.

**Actions par ligne** : ✏️ éditer ; 🗑️ **corbeille** — visible seulement si
`isAgencyAdmin(userRole)`, via `<form method="POST"
action="/api/properties/{id}/delete">`.

#### `/agency/properties/new` — Création

**26 champs.** Obligatoires : `title` (≥ 3 car.), `category`, `type`,
`operationType`, `status` (défaut `disponible`), `wilaya`, `commune`.
Optionnels : `quartier`, `address`, `surface`, `rooms`, `bedrooms`,
`bathrooms`, `floor`, `totalFloors`, `salePrice`, `rentPrice`, `commission`,
`ownerId`, `shortDescription`, `description`, `imageUrls` (galerie),
4 cases à cocher (`hasGarage`, `hasGarden`, `hasTerrace`, `isFurnished`).

**Deux règles croisées à tester** (`propertySchema`) :
- opération `vente` **sans** `salePrice` → « Un bien en vente doit avoir un
  prix de vente » ;
- opération `location` ou `gestion_locative` **sans** `rentPrice` → « Un bien
  en location doit avoir un loyer ».

Le `ownerId` posté est **re-vérifié** contre l'agence.

#### `/agency/properties/[id]` — Fiche

Galerie, statut, caractéristiques, équipements, propriétaire, descriptif.
Boutons : « Modifier », **« Fiche PDF »** → `/api/pdf/property/{id}`.

#### `/agency/properties/[id]/edit` — Édition *(563 l., le plus gros écran)*

Mêmes champs, pré-remplis. La galerie est **remplacée en bloc** à chaque
enregistrement (`propertyImage.deleteMany` puis recréation).

Le select `ownerId` passe par **`optionsParent()`** : un
propriétaire mis à la corbeille reste proposé, suffixé « — en corbeille ».
C'est le correctif de **BUG-34** — sans lui, enregistrer sans rien changer
réécrivait le lien métier.

**Zone rouge, admin seulement** → `deleteProperty` (`requireAgencyAdmin()`) :
**mise à la corbeille** (`deletedAt`), journalisée. Restaurable depuis
`/agency/trash`.

**Verdicts du module** :

- 🟠 **NEW-20 `[LECTURE]`** — **la 🗑️ de la liste ne demande aucune
  confirmation**, et voir NEW-21 ci-dessous pour ce qu'elle affiche ensuite.
  La zone de suppression de l'écran d'édition, elle, est correctement isolée.
- ⚪ La liste n'offre **aucun filtre par statut** — pour ne voir que les biens
  vendus il faut taper le mot dans la recherche, qui ne cherche pas dans le
  statut.

---

### 7.4 Module **Clients** (4 écrans)

#### `/agency/clients` — Liste
Recherche : `firstName`, `lastName`, `phone`, `email`, `wilaya`.
Export : `/api/export/clients`. Pagination 25.
🗑️ admin seulement → `POST /api/clients/{id}/delete` (corbeille).

#### `/agency/clients/new` et `/agency/clients/[id]/edit`

| Champ | Obligatoire | Note |
|---|---|---|
| `firstName` | ✅ | ≥ 2 caractères |
| `lastName` | ✅ | ≥ 2 caractères |
| `phone`, `email` | — | |
| `type` | — | défaut `interesse` |
| `status` | — | défaut `nouveau` |
| `budget` | — | ≥ 0 |
| `wilaya`, `category`, `propertyType`, `notes` | — | |

#### `/agency/clients/[id]` — Fiche + **historique d'interactions**

Affiche `<InteractionTimeline>` et le formulaire d'ajout →
`createInteraction` (`app/agency/interactions/actions.ts`).

**Règle de suppression d'une interaction** — la seule exception assumée du
produit : **un agent efface ses propres lignes** (`authorId === userId`),
l'administrateur toutes. Journalisé. À tester dans les deux sens.

**Verdicts** :
- 🟠 **NEW-18** (voir §9) — `new` et `[id]/edit` **n'affichent pas leurs
  erreurs**.
- ⚪ Messages sans accents : « Client cree », « Client mis a jour »,
  « Interaction ajoutee a l'historique », « Proprietaire introuvable »…
  (**NEW-04**, généralisé).

---

### 7.5 Module **Propriétaires** (4 écrans)

Structure identique aux Clients.
Champs : `firstName` ✅, `lastName` ✅, `phone`, `email`, `idCardNumber`,
`address`, `notes`.
Fiche `[id]` : historique d'interactions + liste des biens détenus.
Corbeille : `POST /api/owners/{id}/delete` (admin).

---

### 7.6 Module **Visites** (4 écrans)

#### `/agency/visits` — Liste
Recherche **relationnelle** (`dealSearch`) : titre/référence du bien,
prénom/nom du client. Export : `/api/export/visits`.
3 compteurs en tête : à venir, effectuées, **relances dues**.
✅ **Cette liste affiche bien `<FormMessage>`** — l'une des rares.

#### `/agency/visits/new`

| Champ | Obligatoire |
|---|---|
| `date` | ✅ |
| `time` | ✅ |
| `clientId` | ✅ |
| `propertyId` | ✅ |
| `agentId`, `status` (défaut `prevue`), `result`, `notes` | — |

#### `/agency/visits/[id]/edit` — 13 champs

Ajoute au précédent : `interestLevel`, `rating`, `priceFeedback`,
`followUpDate`. Les selects `propertyId` / `clientId` passent par
`optionsParent()`.

**Zone rouge admin** → `deleteVisit` : **suppression définitive** (pas de
corbeille), journalisée.

**Verdict** : ⚠ `Visit.reminderSent` existe en base mais **rien ne l'écrit** :
les rappels de visite **ne partent jamais** (limite structurelle connue,
`architecture.md` §8.3). Ne cherchez pas l'email.

---

### 7.7 Module **Ventes** (4 écrans)

Champs (`saleSchema`) : `propertyId` ✅, `clientId` ✅, `finalPrice` ✅ (≥ 0),
`saleDate` ✅, `ownerId`, `commission`, `status` (défaut `negociation`).
Fiche `[id]` : bouton **« Contrat PDF »** → `/api/pdf/sale-contract/{id}`.
Corbeille : `POST /api/sales/{id}/delete` (admin) — **suppression définitive**.

**Verdict** : 🟠 **NEW-18** — `new`, `[id]`, `[id]/edit` **n'affichent aucun
message**. Les selects utilisent le `Select` de **Radix** : rappel de
`architecture.md`, son `<select>` caché **retombe exactement comme un select
natif** — l'hypothèse inverse a été mesurée fausse.

---

### 7.8 Module **Locations** (4 écrans)

Champs (`rentalSchema`) : `propertyId` ✅, `clientId` ✅, `monthlyRent` ✅,
`startDate` ✅, `endDate`, `deposit`, `agencyFees`, `status` (défaut `active`).
**Règle croisée** : `endDate` doit être **strictement postérieure** à
`startDate`.
Fiche `[id]` : **« Contrat PDF »** → `/api/pdf/rental-contract/{id}`, et lien
vers la gestion locative.

**Verdict** : même **NEW-18** que les Ventes.

---

### 7.9 Module **Gestion locative** (3 écrans)

#### `/agency/rental-management` — Tableau de la période *(485 l.)*

Paramètres d'URL : `?month=1..12&year=2000..2100` (bornés côté serveur).
Liste **tous les baux `status: "active"`** de l'agence avec la quittance
éventuelle du mois.

**Compteurs** : encaissé, impayés, à reverser, quittances manquantes.

**Formulaire n°1 — `generateMonth`** : crée en une fois les quittances
manquantes de la période. Refuse si tout existe déjà.
**Formulaire n°2 — `togglePaid`** : bascule `isPaid` sur une ligne.

#### `/agency/rental-management/new` et `/[id]/edit`

| Champ | Obligatoire | Note |
|---|---|---|
| `rentalId` | ✅ | bail re-vérifié |
| `month` | ✅ | 1–12 |
| `year` | ✅ | 2000–2100 |
| `rentAmount` | ✅ | |
| `charges`, `expenses`, `commission`, `paymentDate`, `isPaid`, `notes` | — | |

`[id]/edit` : bouton **« Quittance PDF »** → `/api/pdf/receipt/{id}`, et zone
rouge admin → `deleteRecord` (**définitif**, journalisé).

**Verdicts** :

- 🟠 **NEW-22 `[LECTURE]`, financier** — *(déjà consigné en `deferred-work.md`,
  rattaché à la story 4.5)* — **le net à reverser au propriétaire est
  calculé à quatre endroits** : `computeAmountToOwner` (`lib/format.ts:70`),
  et **trois formules réécrites en ligne** — création, édition, et **la
  quittance PDF remise au propriétaire**. La colonne
  `RentalManagement.amountToOwner` est **écrite par trois de ces chemins et
  relue par aucun**. Les quatre concordaient au 12-08-2026 ; rien ne le
  garantit après la prochaine modification, et **l'écart se verrait chez le
  propriétaire**. **Aucun test unitaire ne couvre ces calculs.**
  → **Pendant votre test : comparez le montant à l'écran, celui du tableau,
  et celui du PDF, sur une même quittance.**
- 🔵 **NEW-23 `[LECTURE]`** — aucune pagination : tous les baux actifs sont
  chargés.

---

### 7.10 Module **Paiements** (4 écrans)

#### `/agency/payments` — Liste *(369 l.)*
**Deux filtres réels** : `?type=` et `?status=` (validés contre les
libellés), plus la recherche texte. Export : `/api/export/payments`.
3 compteurs : encaissé, reversé, en attente — calculés en excluant les
`impaye`.
Bouton PDF par ligne → `/api/pdf/payment/{id}`.
✅ **Affiche `<FormMessage>`.**

#### `/agency/payments/new` — 11 champs
`amount` ✅, `date` ✅, `type` ✅, plus `method`, `status`, `receipt`,
`propertyId`, `clientId`, `ownerId`, `rentalId`, `saleId`, `notes`.
Accepte `?rentalId=` / `?saleId=` en pré-remplissage.

**Tous les identifiants relationnels sont revérifiés** par
`app/agency/payments/verify-links.ts` — c'est le fichier qui existe
précisément pour ça.

#### `/agency/payments/[id]/edit` *(476 l.)*
Les **trois** selects (`propertyId`, `clientId`, `ownerId`) passent par
`optionsParent()`. Zone rouge admin → `deletePayment` (**définitif**,
journalisé).

**Verdict** : ✅ Le module le plus rigoureux du produit. 🔵 Rappel :
`Payment.reference` est un `cuid()` illisible dans les exports (**BUG-15**).

---

### 7.11 Module **Documents** (4 écrans)

#### `/agency/documents` — Liste
Recherche sur `name` uniquement. **Pas d'export CSV** (`documents` n'est pas
dans la liste `EXPORTABLE`).
Lien de téléchargement → `GET /api/documents/{id}/file` — **route
authentifiée**, c'est le correctif de **BUG-04**.
🗑️ admin → `POST /api/documents/{id}/delete`.

#### `/agency/documents/new`
`name` ✅ (≥ 2 car.), `type` ✅ (select Radix), **fichier** ✅
(`DocumentUploadField`). L'URL retournée par l'upload est validée par
`estAdresseDeDocument` — une adresse refusée déclenche `ADRESSE_REFUSEE`
(correctif de **BUG-23**, lien `javascript:`).

#### `/agency/documents/[id]/edit`
Schéma `documentSchema.omit({ url: true })` : **on ne peut pas remplacer le
fichier**, seulement renommer et retyper.

**Verdicts** :

- 🟠 **NEW-24 `[LECTURE]`** — **un document n'est rattaché à rien** : ni bien,
  ni client, ni propriétaire. C'est une bibliothèque plate. Sur une agence
  réelle, retrouver « l'acte de propriété du F3 de Hydra » se fait par le
  nom du fichier et rien d'autre.
- 🔵 **BUG-13 (ouvert)** — le `maxSize` du sélecteur de fichier n'est jamais
  appliqué côté client ; la limite de 5 Mo n'est refusée que par le serveur.
- ✅ **Le chemin direct `/uploads/documents/…` répond 404**, y compris pour
  un compte connecté (middleware). À vérifier : copiez l'URL d'un document
  et ouvrez-la dans un onglet privé.

---

### 7.12 `/agency/leads` — Messages reçus

| | |
|---|---|
| Fichier | `app/agency/leads/page.tsx` (369 l.) |
| Garde | `requireAgency()` |
| Filtres | `?status=` (nouveau / traité / archivé) + recherche |
| Export | `/api/export/leads` |
| Messages | ✅ affichés |

**Trois formulaires** :
- `setStatus` × 3 boutons (nouveau / traité / archivé) ;
- `convertToClient` : crée un **Client** à partir du message, **crée une
  interaction** retraçant l'origine, et bascule le lead en `traite`.

**Verdicts** :

- 🟡 **NEW-25 `[LECTURE]`** — `setStatus` fait
  `const status = rawStatus as "nouveau" | "traite" | "archive"` après un
  simple test d'appartenance manuel. Même famille que **BUG-06** : pas de
  schéma Zod, contrairement à la règle §2. Ici le test manuel couvre le cas,
  mais le motif est celui qui a produit le défaut voisin.
- 🟠 **NEW-26 `[LECTURE]`** — `convertToClient` ne vérifie **pas** qu'un
  client de même email/téléphone existe déjà. Cliquer deux fois crée deux
  clients. Aucune confirmation, aucun garde-fou.
- ⚪ **Aucune suppression de lead** : un message ne peut qu'être archivé.
  C'est peut-être voulu — à trancher.

---

### 7.13 `/agency/statistics` — Statistiques de l'agence

| | |
|---|---|
| Fichier | `app/agency/statistics/page.tsx` (425 l.) |
| Garde | `requireAgency()` — **ouvert aux agents** |
| Période | `?months=` borné à une liste fermée (`PERIODS`) |

Chiffre d'affaires (paiements hors `impaye`), répartition des biens, des
clients, des visites, niveaux d'intérêt, baux actifs.

**Verdict** : 🟡 **NEW-27 `[LECTURE]`** — cet écran expose **le chiffre
d'affaires complet de l'agence à un simple `agent`**, alors que le Journal,
les Comptes et les Paramètres lui sont fermés. Incohérence de périmètre à
arbitrer (`CLAUDE.md` §13 : un arbitrage produit se demande).

---

### 7.14 `/agency/trash` — Corbeille *(admin)*

| | |
|---|---|
| Fichier | `app/agency/trash/page.tsx` (311 l.) |
| Garde | **`requireAgencyAdmin()`** |
| Contenu | **Biens, Clients, Propriétaires** uniquement — les 3 modèles à `deletedAt` |

Trois colonnes : type, libellé, date de suppression. Tri par suppression
décroissante.

**Deux formulaires** (`kind` + `id`) :
- **`restore`** → remet `deletedAt: null`, journalisé ;
- **`purge`** → `prisma.{model}.delete()` — **définitif et en cascade**,
  journalisé.

**Verdicts** :

- 🟠 **NEW-28 `[LECTURE]`** — **la purge définitive ne demande aucune
  confirmation**. Un bouton, un clic, la ligne et toute sa descendance
  disparaissent. C'est l'action la plus destructrice de l'espace agence, et
  c'est celle qui a le moins de friction. À rapprocher de `CLAUDE.md` §2 :
  « un `delete()` y est définitif **et en cascade** ».
- 🔵 **NEW-29 `[LECTURE]`** — aucune pagination, aucune purge automatique :
  la corbeille grossit indéfiniment.
- 🟡 **BUG-24 (ouvert)** — la suppression réversible n'est appliquée qu'aux
  **lectures de premier niveau**. Un client en corbeille reste visible via
  `visit.client` dans une relation imbriquée.

---

### 7.15 `/agency/users` — Comptes de l'agence *(admin)*

| | |
|---|---|
| Fichier | `app/agency/users/page.tsx` (506 l.) |
| Garde | **`requireAgencyAdmin()`** |
| Messages | ✅ affichés |

**Colonnes** : nom, email, rôle, statut, nombre d'entrées au journal.

**Quatre Server Actions** :

| Action | Champs | Garde-fous |
|---|---|---|
| `createUser` | `name` ✅ (≥2), `email` ✅, `role` ✅ (`agency_admin` \| `agent`), `password` ✅ | email unique ; **impossible de créer un `super_admin`** |
| `changeRole` | `targetId`, `role` | pas sur soi-même ; jamais le dernier admin actif |
| `toggleActive` | `targetId` | pas sur soi-même ; jamais le dernier admin actif |
| `resetPassword` | `targetId`, `password` (≥ 6) | **efface les jetons de réinitialisation en cours** |

Les quatre sont **journalisées**.

**Verdicts** :

- ✅ **Un `agency_admin` ne peut jamais fabriquer un `super_admin`** — le
  schéma `agencyUserSchema` ferme l'énumération à deux valeurs.
- ⚪ Le garde « dernier administrateur actif » est ici **inatteignable** :
  l'acteur est forcément un `agency_admin` actif distinct de sa cible. Il est
  conservé volontairement ; le garde **utile** est celui de `/admin/users`.
- 🔵 **NEW-30 `[LECTURE]`** — asymétrie de longueur minimale de mot de passe
  entre les trois écrans qui en posent un : **6** ici et sur
  `/auth/reset/[token]`, **8** dans `/admin/users`, **6** à l'inscription.
  Aucune règle unique.

---

### 7.16 `/agency/audit` — Journal *(admin)*

| | |
|---|---|
| Fichier | `app/agency/audit/page.tsx` (151 l.) |
| Garde | **`requireAgencyAdmin()`** |
| Pagination | ✅ 25/page |
| Filtres | ❌ **aucun** |

**Colonnes** : Quand, Action *(badge)*, Objet, Détail, Par.
**7 actions journalisées** : suppression, restauration, changement de statut,
création / modification / désactivation de compte, réinitialisation de mot
de passe.

**Verdicts** :

- 🟡 **NEW-31 `[LECTURE]`** — aucun filtre par action, par auteur ni par
  date. À 2 000 entrées, répondre à « qui a supprimé ce bien » redevient
  impossible — la question même que cet écran existe pour trancher.
- ⚠ Rappel : `recordAudit()` **avale ses erreurs à dessein**. Son appel ne
  prouve donc **pas** qu'une ligne a été écrite. Vérifiez à l'écran, pas dans
  le code.

---

### 7.17 `/agency/settings` — Paramètres de l'agence *(admin)*

| | |
|---|---|
| Fichier | `app/agency/settings/page.tsx` (249 l.) |
| Garde | **`requireAgencyAdmin()`** |
| Messages | ✅ affichés |

**Bandeau lecture seule** : statut du compte, formule, bouton
« Voir ma vitrine » (si publiée).

**Formulaire → `updateSettings`** :

| Section | Champ | Note |
|---|---|---|
| Coordonnées | `name` ✅ (≥ 2) | |
| | `phone`, `wilaya`, `commune`, `address` | saisie **libre** |
| | *email* | **désactivé** — sert d'identifiant |
| Vitrine | `showcaseEnabled` | case à cocher |
| | `slug` | `pattern="[a-z0-9\-]{3,40}"`, **unicité vérifiée entre agences** |
| | `description` | textarea |
| | `logo` | `ImageUploadField` |

**Verdicts** :

- 🟡 **NEW-32 `[LECTURE]`** — la `wilaya` est un **champ texte libre** ici,
  alors qu'elle est une **liste fermée de 58 valeurs** à l'inscription
  (`lib/wilayas.ts`). Or c'est cette valeur qui alimente le filtre wilaya de
  la vitrine publique : une faute de frappe (« Alger » vs « alger » vs
  « ALGER ») y crée un doublon. Le commentaire de `/auth/register` dit
  explicitement pourquoi la liste est fermée — le raisonnement n'a pas été
  reporté ici.
- ⚪ Le `pattern` HTML sur le slug est un contrôle **navigateur seulement** ;
  le schéma serveur le revalide (`agencySettingsSchema`, ligne 552).

---

## 8. Routes API

| Route | Méthode | Garde | Rôle | Réponse |
|---|---|---|---|---|
| `/api/auth/[...nextauth]` | * | — | public | NextAuth |
| `/api/auth/register` | POST | — | public, **5/h/IP** | JSON |
| `/api/public/health` | GET | — | public | JSON 200/503 |
| `/api/upload` | POST | `getApiAgency()` | agence | JSON — **signature vérifiée**, 5 Mo, jpg/jpeg/png/webp |
| `/api/export/[entity]` | GET | `getApiAgency()` | agence | CSV — 8 entités |
| `/api/documents/[id]/file` | GET | `getApiAgency()` | agence | fichier |
| `/api/pdf/property/[id]` | GET | `getApiAgency()` | agence | PDF |
| `/api/pdf/payment/[id]` | GET | `getApiAgency()` | agence | PDF |
| `/api/pdf/receipt/[id]` | GET | `getApiAgency()` | agence | PDF |
| `/api/pdf/sale-contract/[id]` | GET | `getApiAgency()` | agence | PDF |
| `/api/pdf/rental-contract/[id]` | GET | `getApiAgency()` | agence | PDF |
| `/api/properties/[id]/delete` | POST | + `isAgencyAdmin()` | **admin** | JSON — **corbeille** |
| `/api/clients/[id]/delete` | POST | + `isAgencyAdmin()` | **admin** | JSON — **corbeille** |
| `/api/owners/[id]/delete` | POST | + `isAgencyAdmin()` | **admin** | JSON — **corbeille** |
| `/api/documents/[id]/delete` | POST | + `isAgencyAdmin()` | **admin** | JSON — **définitif** |
| `/api/payments/[id]/delete` | POST | + `isAgencyAdmin()` | **admin** | JSON — **définitif** |
| `/api/visits/[id]/delete` | POST | + `isAgencyAdmin()` | **admin** | JSON — **définitif** |
| `/api/sales/[id]/delete` | POST | + `isAgencyAdmin()` | **admin** | JSON — **définitif** |
| `/api/rentals/[id]/delete` | POST | + `isAgencyAdmin()` | **admin** | JSON — **définitif** |

**Entités exportables en CSV** : `properties`, `clients`, `owners`,
`payments`, `visits`, `leads`, `sales`, `rentals` — **8**. `documents` n'y
est pas.

**À tester sans session** : toute route non `/api/auth/` et non
`/api/public/` doit répondre **401 JSON**, jamais une redirection HTML.

---

## 9. Verdict

> **Classement par ce que vous verrez à l'écran**, pas par gravité théorique.
> Les `BUG-nn` renvoient au registre existant ; les `NEW-nn` sont **nouveaux
> et sans propriétaire** — ils devront recevoir un `REP-nn` et une story.

### 9.1 Ce qui casse l'expérience dès le premier clic

#### 🔴 NEW-21 — Supprimer depuis une liste affiche une page de JSON brut `[LECTURE]`

**Le défaut le plus visible du produit, et il n'est dans aucun registre.**

Les **8 listes** de l'espace agence suppriment via un formulaire HTML natif :

```html
<form method="POST" action="/api/properties/{id}/delete">
```

Or ces routes répondent `NextResponse.json({ message: "…" })`. Un formulaire
HTML **navigue** vers sa cible : le navigateur quitte donc la liste et
affiche une page blanche contenant `{"message":"Bien mis à la corbeille"}`.
L'utilisateur doit revenir en arrière à la main.

**Concerne** : `/agency/properties`, `/clients`, `/owners`, `/visits`,
`/sales`, `/rentals`, `/payments`, `/documents`.

**Pourquoi personne ne l'a vu.** Le test qui exerce ce bouton
(`tests/features.spec.ts:51`) clique, attend 2,5 s, puis fait
`page.goto("/agency/trash")` — il ne regarde **jamais** où le navigateur a
atterri. C'est littéralement le cas d'école de `CLAUDE.md` §6 : un test vert
sur un produit cassé.

**Reproduction** : connectez-vous en `admin@aqar.dz`, allez sur
`/agency/properties`, cliquez sur la corbeille de n'importe quelle ligne.

**Piste de correction** *(à instruire dans une story)* : remplacer le
`NextResponse.json` par un `NextResponse.redirect(new URL(withSuccess(...)))`
en 303, ou convertir ces 8 formulaires en Server Actions comme le reste du
produit. La seconde option est la plus cohérente avec le contrat uniforme.

---

#### 🟠 NEW-18 — 19 écrans reçoivent un message et ne l'affichent jamais `[LECTURE]`

`withError(...)` / `withSuccess(...)` posent `?error=` / `?success=` dans
l'URL, et `<FormMessage>` les rend. **19 pages destinataires n'appellent pas
`<FormMessage>`.**

Recensé par croisement de deux commandes exécutées :
`grep -rln "<FormMessage" app --include=page.tsx` (24 pages le rendent) et
`grep -rhoE 'with(Success|Error)\("(/[a-z/-]*)"' app` (les cibles).

**Les 5 créations** — l'erreur de validation est perdue, le formulaire
revient vide, sans un mot :

| Écran | Message perdu |
|---|---|
| `/agency/clients/new` | toute erreur `clientSchema` |
| `/agency/owners/new` | toute erreur `ownerSchema` |
| `/agency/visits/new` | erreurs + « Bien ou client introuvable » |
| `/agency/sales/new` | erreurs + « Bien ou client introuvable » |
| `/agency/rentals/new` | erreurs + « Bien ou client introuvable » |

**Les 4 éditions** — même silence :
`/agency/clients/[id]/edit`, `/agency/owners/[id]/edit`,
`/agency/sales/[id]/edit`, `/agency/rentals/[id]/edit`.

**Les 6 listes d'arrivée** — la confirmation de succès **et** les erreurs
« … introuvable » sont perdues :
`/agency/properties`, `/agency/clients`, `/agency/owners`,
`/agency/documents`, `/agency/sales`, `/agency/rentals`.

**Les 4 fiches d'arrivée** — le « … mis à jour » est perdu :
`/agency/properties/[id]`, `/agency/sales/[id]`, `/agency/rentals/[id]`,
`/agency/documents/[id]`.

> **Le motif est appliqué correctement ailleurs** — Biens (création,
> édition), Paiements, Visites, Gestion locative, Documents (création,
> édition), Clients `[id]`, Propriétaires `[id]` affichent bien leurs
> messages. Ce n'est donc pas une décision, c'est une omission, et elle est
> répartie de façon inégale à l'intérieur d'un même module : un client créé
> confirme, un client modifié aussi, mais une erreur de saisie sur l'un ou
> l'autre est muette.

**Reproduction la plus nette** : `/agency/clients/new`, saisissez un prénom
d'une seule lettre, enregistrez. La page revient vide. Le message
« Le prenom est requis » est dans la barre d'adresse et nulle part ailleurs.

**Correction** : une ligne `<FormMessage error={params.error}
success={params.success} />` par page, plus le `searchParams` correspondant.
Peu coûteux, très visible.

---

#### 🟠 NEW-06 / NEW-04 — Texte utilisateur sans accents

`CLAUDE.md` §11 : les commentaires sont sans accents, **les chaînes vues par
un utilisateur en portent**. Ce n'est pas respecté sur :

- **`/auth/inactive`** — la page entière (« L'acces de votre agence a ete
  suspendu », « Retour a la connexion »…). C'est un écran du parcours
  d'inscription, vu par tout nouveau client.
- **`submitLead`** (vitrine publique) — 3 messages.
- **Une trentaine de messages de Server Actions** de l'espace agence :
  « Client cree », « Proprietaire mis a jour », « Visite planifiee »,
  « Location enregistree », « Quittance supprimee », « Interaction ajoutee a
  l'historique »…

Commande de contrôle :
`grep -rnE 'withSuccess\([^,]+, "[^"]*(cree|creee|ajoute|planifiee|enregistree|supprimee|mis a jour)' app`

---

#### 🟠 NEW-28 / NEW-10 / NEW-20 — Aucune confirmation sur les actions destructrices

| Écran | Action | Effet | Confirmation ? |
|---|---|---|:---:|
| `/agency/trash` | **Purge** | définitif **et en cascade** | ❌ |
| `/admin/agencies` | Suspendre / remettre en attente | coupe l'accès de toute une agence | ❌ |
| 8 listes agence | 🗑️ | corbeille ou définitif | ❌ |

Les zones de suppression des écrans **d'édition** sont, elles, correctement
isolées (bordure haute, fond rouge). L'incohérence est entre les deux
chemins.

---

### 9.2 Ce qui est faux sans se voir

| Réf | Écran | Constat |
|---|---|---|
| 🟠 **NEW-22** | Gestion locative | **Le net à reverser est calculé à 4 endroits**, dont la quittance PDF. `amountToOwner` est écrit et jamais relu. Aucun test. *(déjà en `deferred-work.md`, story 4.5)* |
| 🟡 **BUG-06** | `/admin/agencies` | Statut d'agence **casté sans validation** (`as`), alors que `agencyStatusSchema` existe et n'est importé nulle part |
| 🟡 **NEW-25** | `/agency/leads` | Statut de lead casté après un test manuel — même famille |
| 🟠 **NEW-16** | `/admin/settings` | `setPlan` et `toggleShowcase` **ne sont pas journalisés** |
| 🟠 **NEW-02** | Page d'accueil | **Le formulaire de contact est une simulation** : `setTimeout(1500)` puis « envoyé ». Rien n'est enregistré, rien n'est envoyé |
| 🟠 **NEW-26** | `/agency/leads` | `convertToClient` ne détecte aucun doublon |
| 🟠 **NEW-03** | Vitrine publique | Le budget max n'est pas combiné au filtre opération |
| 🟡 **NEW-14** | `/admin/statistics` | « Volume de ventes » agrège toutes les ventes, statut compris |
| 🟡 **BUG-29** | Vitrine publique | Le filtre wilaya propose des choix sans résultat |
| 🟡 **BUG-24** | Corbeille | La suppression réversible ignore les relations imbriquées |

### 9.3 Ce qui manque

| Réf | Manque | Conséquence |
|---|---|---|
| 🟠 **NEW-12** | Aucune création de compte dans `/admin/users` | un second `super_admin` ne se crée qu'en base |
| 🟠 **NEW-24** | Un document n'est rattaché à rien | bibliothèque plate, non exploitable |
| 🟡 **NEW-31** | Journal sans filtre | inexploitable au-delà de quelques centaines de lignes |
| 🟡 **NEW-27** | `/agency/statistics` ouvert aux agents | le CA de l'agence est visible par tous |
| 🟡 **NEW-17** | `plan` (`basic`/`premium`) n'ouvre rien | fonctionnalité décorative |
| ⚪ — | Aucune tâche planifiée | `Visit.reminderSent` n'est jamais écrit ; aucune relance d'abonnement |
| ⚪ — | Aucun test unitaire | les calculs financiers ne sont couverts par rien |

### 9.4 Cohérence d'interface

| Réf | Constat |
|---|---|
| 🟡 **NEW-33** | ⚠️ **Corrigé après mesure au navigateur (15-08-2026) — la première rédaction était fausse.** J'avais compté les `page.tsx` sans `export const metadata`, soit 23 ; mais **quatre pages clientes portent leur titre dans un `layout.tsx` voisin** (`app/auth/{login,register,forgot,error}/layout.tsx`). Le compte réel est **19**, et le constat ne vise que les **17 écrans de détail/édition** de `/agency` plus `/auth/reset/[token]` — mesurés génériques au navigateur. `app/page.tsx` n'est pas concerné : la page d'accueil doit porter le titre du site. Voir [`verification-navigateur.md`](verification-navigateur.md) §7. |
| 🟡 **NEW-07** | `/auth/error` n'utilise ni `AuthShell` ni la palette `dar-*` |
| 🟡 **NEW-08** | 3 des 5 codes d'erreur de `/auth/error` ne peuvent plus être émis |
| 🟡 **NEW-32** | `wilaya` est une liste fermée à l'inscription et un champ libre dans les paramètres |
| 🔵 **NEW-30** | Longueur minimale de mot de passe : 6 / 6 / 8 selon l'écran |
| 🔵 **NEW-11 / 19 / 23 / 29** | Pas de pagination sur `/admin/agencies`, `/agency/showcase`, `/agency/rental-management`, `/agency/trash` |
| 🔵 **NEW-09** | `/admin` charge `users` sans l'afficher |
| ⚪ **NEW-01** | `docs/architecture.md` annonce 31 Server Actions et 28 écrans agence ; le compte réel est **41** et **43** |
| ⚪ **NEW-05** | Un `super_admin` transite par `/agency` avant d'atterrir sur `/admin` |

### 9.5 Ce qui est solide — et qu'il est inutile de re-tester longuement

- **Le cloisonnement `agencyId`** : appliqué sans exception sur les
  41 Server Actions et les 19 routes API. Aucune fuite inter-agences trouvée
  à la lecture, et `tests/tenancy.spec.ts` l'éprouve.
- **La séparation des rôles** : 8 routes, 5 écrans réservés, 5 Server Actions
  destructives, toutes prouvées par mutation.
- **La révocation d'accès** : désactiver un compte ou changer son rôle tombe
  **à la requête suivante**, navigation client comprise
  (`staleTimes.dynamic = 0`).
- **`/api/documents/[id]/file`** et le 404 sur `/uploads/documents/` : les
  pièces d'identité ne sont plus servies en clair (BUG-04).
- **`optionsParent()`** sur les 10 couples de selects concernés
  (BUG-34).
- **Les limites de débit** : connexion, explication d'échec, inscription,
  mot de passe oublié, formulaire de vitrine, upload.

---

## 10. Parcours de test proposé

> Trois sessions d'environ 45 minutes. **Ouvrez la console du navigateur et
> l'onglet Réseau** : plusieurs des constats ci-dessus s'y voient avant de se
> voir à l'écran.

### Session A — Public et authentification *(sans compte)*

1. `/` — les 3 ancres, la navbar au défilement, le menu mobile. Puis
   **envoyez le formulaire de contact, onglet Réseau ouvert** : aucune
   requête ne part. → **NEW-02**
2. `/vitrine/agence-demo` — les 4 filtres, un par un puis combinés.
   → **BUG-29**, **NEW-03**
3. `/vitrine/agence-en-attente` — **doit répondre 404**.
4. Une fiche de bien → envoyez un message. → **NEW-04** *(accents)*
5. Renvoyez-en 6 d'affilée → le 6ᵉ doit être refusé poliment.
6. `/auth/register` — inscrivez une agence de test. Notez le slug attribué.
7. Essayez de vous connecter avec ce compte → écran « en attente ».
   → **NEW-06** *(accents)*
8. `/auth/forgot` avec une adresse inconnue puis connue → **même réponse**.
9. `/auth/error?error=AgencyPending` → **NEW-07**, **NEW-08**
10. Une URL inexistante → 404 soigné, **pas** un écran de connexion.

### Session B — Espace agence *(`admin@aqar.dz`)*

1. `/agency` — les 4 alertes, chacune mène au bon écran filtré.
2. `/agency/properties` → **cliquez la corbeille d'une ligne**.
   → **NEW-21**, le constat majeur. Revenez en arrière.
3. `/agency/trash` → restaurez. Puis **regardez le bouton de purge** :
   aucune confirmation. → **NEW-28**
4. `/agency/clients/new` — prénom d'une lettre, enregistrez.
   → **NEW-18**, page vide sans message.
5. Répétez sur `/agency/owners/new`, `/visits/new`, `/sales/new`,
   `/rentals/new`. Même silence.
6. `/agency/properties/new` — opération « vente » **sans** prix de vente :
   ici l'erreur **s'affiche** (cette page a `<FormMessage>`). Comparez.
7. `/agency/rental-management` — générez le mois, ouvrez une quittance,
   **comparez le montant à reverser : écran, tableau, PDF**. → **NEW-22**
8. `/agency/documents/new` — déposez un fichier, ouvrez-le, puis **copiez
   l'URL du fichier et ouvrez-la en navigation privée** → doit refuser.
9. `/agency/leads` — convertissez un message **deux fois**. → **NEW-26**
10. `/agency/settings` — changez la wilaya en « alger » minuscule, puis
    regardez le filtre de votre vitrine publique. → **NEW-32**
11. `/agency/audit` — vérifiez que les actions des étapes 2, 3 et 8 y sont.
12. Regardez le **titre de chaque onglet** au fil du parcours. → **NEW-33**

### Session C — Rôles et console éditeur

1. Connectez-vous en `agent@aqar.dz` (autre navigateur) :
   - la navbar ne montre **plus** Vitrine, Corbeille, Comptes, Journal,
     Paramètres ;
   - forcez `/agency/settings` → retour au tableau de bord **avec message** ;
   - aucune corbeille dans les listes ;
   - mais `/agency/statistics` **s'ouvre**, chiffre d'affaires compris.
     → **NEW-27**
2. Pendant ce temps, en `admin@aqar.dz`, **désactivez le compte agent** →
   son écran suivant doit tomber, **sans reconnexion**.
3. `superadmin@aqar.dz` → `/admin` :
   - `/admin/agencies` : les 3 icônes de statut, sans libellé ni
     confirmation → **NEW-10** ;
   - posez une échéance d'abonnement, puis regardez le bandeau côté agence ;
   - `/admin/settings` : coupez la vitrine d'une agence, puis **cherchez la
     trace dans un journal** → **NEW-16**, il n'y en a pas ;
   - `/admin/users` : essayez de désactiver `admin@aqar.dz` → **doit
     refuser** (dernier administrateur actif) ;
   - cherchez un bouton « créer un compte » → **NEW-12**, il n'existe pas.
4. Forcez `/agency` en super admin → renvoi vers `/admin`, **sans boucle**.
5. Forcez `/admin` en `agency_admin` → renvoi vers `/agency`, **sans boucle**.

---

## Annexe — Ce que ce document ne couvre pas

- **Le rendu des 5 PDF** : les routes existent et sont gardées, leur contenu
  n'a pas été lu ligne à ligne. La quittance est concernée par **NEW-22**.
- **Le responsive et l'audit Lighthouse** (règle 10) : non exécutés, ils
  demandent le projet démarré (`CLAUDE.md` §2, §14.2).
- **Les composants `components/ui/`**, issus de shadcn/ui sans modification
  notable.
- **La suite E2E** : non lancée (§2). Les 102 cas verts annoncés dans
  `architecture.md` datent du 12-08-2026 et **n'ont pas été revérifiés ici**.
- **La preuve par mutation** de quoi que ce soit : ce document est un
  inventaire, pas une campagne de tests. Un constat marqué `[LECTURE]` reste
  une hypothèse tant qu'il n'a pas été reproduit à l'écran — c'est ce que
  votre passage va trancher.
