---
baseline_commit: 9c8055d371d93d88a03f301f3d4a6784956d25c6
---

# Story 5.13 : N'afficher que ce qui s'ouvre, et dire qui est connecté

Status: done

**Épopée :** 5 — Dette technique et lisibilité produit
**Couvre :** REP-78, 79, 81, 83, 84 — **fermés**
**Laisse ouvert :** REP-82 · **Ouvre :** REP-89, 90, 91, 92, 93
**Ouverte par :** la story 5.12, qui a inspecté les trois barres en en réparant une
**Date :** 14 août 2026

---

## Story

**En tant qu'**agent d'une agence immobilière,
**je veux** que la barre de navigation ne me propose que ce que je peux
réellement ouvrir, et qu'elle m'indique quel compte est connecté,
**afin de** ne pas apprendre la hiérarchie des rôles du produit en me
faisant refuser l'accès cinq fois.

---

## ⚠ Les trois pièges de cette story — à lire AVANT d'écrire une ligne

### Piège 1 — `loading.tsx` ne peut pas connaître le rôle, et il rend la barre

**C'est le piège central. Il fera échouer l'implémentation naïve.**

`app/agency/loading.tsx` et `app/admin/loading.tsx` rendent tous deux la
barre, et ce sont des fonctions **synchrones** (`export default function
Loading()`). Elles ne peuvent pas `await` une garde — c'est tout l'intérêt
d'un écran d'attente : il s'affiche **avant** que la page ne résolve.

```
grep -rl "<AgencyNavbar" app --include="*.tsx" | wc -l   -> 45
grep -rl "requireAgency" app/agency --include="*.tsx" | wc -l -> 43
```

**Les deux fichiers de l'écart sont exactement `layout.tsx` et
`loading.tsx`.** (`comm -23` sur les deux listes, vérifié le 14-08-2026.)

Conséquence, et il faut la trancher explicitement : si `role` devient une
prop **requise**, `loading.tsx` ne compile plus. Si elle devient
**optionnelle avec repli « tout afficher »**, un agent verra les cinq
entrées interdites **clignoter** pendant l'attente avant de disparaître —
le masquage serait défait précisément à l'instant où l'utilisateur regarde.

> **Ce que §8 demande de se demander : qu'est-ce que je viens de rendre
> atteignable ?** Ici, un repli mal choisi rend atteignable un
> clignotement qui annule la story. **Le repli par défaut doit être le plus
> restreint** (n'afficher que ce que tout rôle peut ouvrir), pas le plus
> large.

### Piège 2 — masquer un lien ne garde rien

`CLAUDE.md` §5 : **l'autorisation n'a qu'une couche**, `lib/auth-guard.ts`.
Une entrée masquée n'est pas une entrée protégée. Le jour où quelqu'un lira
ce masquage comme une protection et allégera une garde, le trou s'ouvre.

**Un test doit donc constater que l'accès direct reste refusé** — c'est un
critère d'acceptation, pas une précaution.

### Piège 3 — `session.user.role` ne se lit pas

`CLAUDE.md` §2, et c'est BUG-33 : le rôle et l'agence se relisent **en
base** ; seul `session.user.id` vient du jeton. **Ne pas** appeler
`useSession()` côté client pour obtenir le rôle. Y remettre un contrôle sur
le rôle du jeton rouvrirait BUG-33 sans que rien ne le montre.

**Bonne nouvelle : aucune requête nouvelle n'est nécessaire.** Voir ci-dessous.

---

## Ce qui existe déjà et qu'il ne faut PAS réinventer

**`requireAgency()` retourne déjà tout ce dont la barre a besoin.**
`lib/auth-guard.ts` :

```ts
export async function requireAgency(): Promise<{
  agencyId: string
  agency: Agency
  userId: string
  userRole: string      // ← relu EN BASE (story 1.8)
  userName: string | null   // ← pour l'identité affichée (REP-79)
}>
```

- **43 des 45 pages** qui rendent `<AgencyNavbar />` appellent déjà cette
  garde. La donnée est **déjà en main à chaque site d'appel** ; elle n'est
  simplement jamais transmise.
- `requireSuperAdmin()` retourne `{ userId, userName }` — suffisant pour
  remplacer « SA » et « Super Admin » en dur dans `AdminNavbar`.
- **`isAgencyAdmin(role: string): boolean` existe déjà** (`lib/auth-guard.ts`).
  C'est une fonction pure : `role === "agency_admin" || role === "super_admin"`.
  **Ne pas réécrire la comparaison de rôles à la main.**

### ⚠ Piège 4 — découvert au démarrage de l'implémentation, le 14-08-2026

**`isAgencyAdmin` est pure, mais le module qui la porte ne l'est pas.**
`lib/auth-guard.ts` commence par :

```ts
import { redirect } from "next/navigation"
import { auth } from "@/auth"        // NextAuth serveur
import { prisma } from "@/lib/prisma"
```

L'importer depuis `AgencyNavbar.tsx`, qui est un composant **client**,
tirerait Prisma et NextAuth dans le bundle du navigateur. C'est un échec de
build au mieux, une fuite de code serveur au pire.

**Remède retenu, et il évite de dupliquer la règle :** extraire le prédicat
pur dans un module sans dépendance — `lib/roles.ts` — et le **ré-exporter**
depuis `lib/auth-guard.ts`. Les appelants serveur existants ne changent pas
d'une ligne ; le composant client importe la version pure.

*Ce qu'il ne faut PAS faire : recopier `role === "agency_admin" || role ===
"super_admin"` dans la barre. Deux définitions du même rôle finissent par
diverger, et c'est exactement le mécanisme qui a produit BUG-35 — deux
barres qui disent la même chose de deux façons.*

---

## Acceptance Criteria

**Given** un compte `agent` connecté
**When** il regarde la barre de son espace
**Then** les cinq entrées réservées à l'administrateur **ne sont pas rendues** — `/agency/showcase`, `/agency/trash`, `/agency/users`, `/agency/audit`, `/agency/settings`
**And** elles ne le sont **ni** dans la barre, **ni** dans les menus déroulants « Transactions » / « Plus », **ni** dans le menu mobile qui aplatit les dix-sept liens, **ni** dans le menu utilisateur (« Paramètres de l'agence »)

**Given** un compte `agency_admin` connecté
**When** il regarde la même barre
**Then** il voit les **dix-sept** entrées — sans ce contrôle positif, le masquage aurait simplement cassé la barre pour tout le monde et le test serait vert quand même (`CLAUDE.md` §6)

**Given** que masquer un lien ne garde rien
**When** un compte `agent` demande directement `/agency/users`
**Then** il est **toujours refusé par la garde**, et un test le constate — le jour où quelqu'un lira le masquage comme une protection, ce test sera la seule chose qui l'en empêchera (`CLAUDE.md` §5)

**Given** l'écran d'attente `app/agency/loading.tsx`, qui rend la barre sans pouvoir connaître le rôle
**When** il s'affiche
**Then** il n'affiche **aucune** entrée réservée — le repli est le plus restreint, jamais le plus large
**And** aucune entrée réservée n'apparaît puis ne disparaît à la résolution de la page pour un `agency_admin` : le passage attente → contenu ne doit pas produire de clignotement, et si le remède retenu est de ne pas rendre la barre dans `loading.tsx`, c'est un arbitrage à écrire

**Given** le rôle et le nom affichés dans les deux barres de gestion
**When** ils sont branchés sur l'utilisateur réel
**Then** ils proviennent d'une lecture **en base** descendue en `props` depuis un Server Component, jamais de `session.user.role` ni d'un `useSession()` (`CLAUDE.md` §2, BUG-33)
**And** « SA » / « Super Admin » et « A » / « Mon compte » ne sont plus écrits en dur

**Given** un groupe déroulant dont toutes les entrées seraient masquées
**When** la barre est rendue
**Then** le groupe n'est pas rendu non plus — pas de menu vide qui s'ouvre sur rien, ce qui serait exactement le défaut que la story 5.12 vient de fermer

**Given** `signOut()`, appelé sans `.catch()` dans les deux barres (REP-81)
**When** l'appel échoue — réponse non-JSON, réseau coupé
**Then** l'utilisateur le sait, au lieu d'un bouton qui paraît inerte
**And** le cas est reproductible dans un test, ou à défaut la raison de ne pas le tester est écrite

**Given** le bouton « Déconnexion » du menu mobile (REP-83)
**When** il est actionné
**Then** il ferme son menu comme le font tous les `<Link>` du même bloc, et une seconde activation pendant que l'appel est en vol ne produit pas un second `POST /api/auth/signout`

**Given** les boutons icônes sans nom accessible (REP-84)
**When** la story est terminée
**Then** ceux d'`AgencyNavbar` ont un `aria-label`, comme celui d'`AdminNavbar` posé par la story 5.12

---

## Tasks / Subtasks

- [x] **Trancher et écrire l'arbitrage `loading.tsx`** (AC 4) — repli restreint, ou barre non rendue pendant l'attente. **À faire en premier : la réponse conditionne la signature de la prop.**
- [x] Filtrer les liens par rôle dans `AgencyNavbar.tsx` (AC 1, 2, 6)
  - [x] Recevoir le rôle en `props`, pas via `useSession()`
  - [x] Filtrer `primaryLinks`, `transactionLinks`, `moreLinks` **et** `allLinks` (menu mobile)
  - [x] Filtrer l'entrée « Paramètres de l'agence » du menu utilisateur
  - [x] Ne pas rendre un `NavGroup` devenu vide
  - [x] Réutiliser `isAgencyAdmin()` de `lib/auth-guard.ts`
- [x] Transmettre `userRole` et `userName` depuis les **43 pages** qui appellent déjà `requireAgency()` (AC 1, 5)
  - [x] Enveloppe serveur **écartée** — elle coûtait une requête Prisma par page ; décision et mesure dans le Debug Log. Envisagée : plutôt que 43 modifications répétées — **décision à écrire**
- [x] Brancher l'identité réelle dans `AdminNavbar.tsx` depuis `requireSuperAdmin()` (AC 5)
- [x] Poser les `aria-label` manquants d'`AgencyNavbar` (AC 8, REP-84)
- [x] Garder l'activation répétée **et** refermer les menus au clic (REP-83) — l'écart annoncé au premier jet a été supprimé par la revue, voir Completion Notes
- [x] Traiter l'échec de `signOut()` (REP-81). **REP-82 reste OUVERT** : l'origine de la sortie n'a pas été touchée, c'est un arbitrage et non un correctif
- [x] Tests : masquage agent, **contrôle positif** admin, **accès direct toujours refusé**, chemin du bureau. *Le repli de `loading.tsx` n'est pas couvert — écrit en Completion Notes plutôt que coché*
- [x] Prouver par mutation : retirer le filtre → le cas agent rougit ; **et vérifier que le message désigne le lien visé**
- [x] `npx tsc --noEmit` **0**, `npm run lint` **0**, `npm run test:e2e` **121/121 verts**
- [x] Mettre à jour `deferred-work.md` (REP-78, 79, 81, 82, 83, 84 fermés) et `sprint-status.yaml`

---

## Dev Notes

### Fichiers à toucher

| Fichier | Nature |
|---|---|
| `components/layout/AgencyNavbar.tsx` | **UPDATE** — 17 liens en 3 groupes + menu utilisateur + menu mobile à plat |
| `components/layout/AdminNavbar.tsx` | **UPDATE** — identité en dur (« SA », « Super Admin ») |
| `app/agency/loading.tsx`, `app/admin/loading.tsx` | **UPDATE** — le piège 1 |
| 43 pages de `app/agency/**` | **UPDATE** — transmission de `userRole` / `userName` |
| `tests/navigation.spec.ts` | **UPDATE** — le fichier existe depuis la story 5.12 |

### État actuel d'`AgencyNavbar.tsx` — lu le 14-08-2026

- Composant **client** (`"use client"`), **aucune prop**, `signOut` déjà câblé
  sur ses deux boutons.
- Trois tableaux de liens : `primaryLinks` (5), `transactionLinks` (4),
  `moreLinks` (8) = **17**, plus `allLinks` qui les concatène pour le menu
  mobile. `grep -c 'href: "/agency' components/layout/AgencyNavbar.tsx` → 17.
- **Les cinq cibles à masquer**, vérifiées garde par garde le 14-08-2026 en
  lisant l'en-tête des 17 pages liées : `showcase`, `trash`, `users`,
  `audit`, `settings` sont sous `requireAgencyAdmin()`. Les douze autres sont
  sous `requireAgency()` — accessibles à un agent.
- La pastille `layoutId="agency-nav-pill"` est **partagée** entre les liens
  primaires et les deux `NavGroup`. Filtrer des liens ne la casse pas, mais
  ne pas la dupliquer par inadvertance.
- **Ne pas transformer la barre en sidebar** — `CLAUDE.md` §12 règle 3, sur
  100 % des pages. Le regroupement en menus déroulants existe précisément
  parce que la navigation reste horizontale.

### Ce que la story 5.12 a appris, et qui s'applique ici

1. **Un bouton sans gestionnaire ne casse ni `tsc`, ni `lint`, ni aucun
   test.** Il n'existe aucun signal automatique pour cette classe de défaut.
   Un lien masqué à tort ne produira, lui non plus, aucun rouge.
2. **Une assertion d'absence doit être ancrée sur une preuve de présence.**
   Vérifier que « Comptes » n'est pas dans la barre est **vert sur une page
   qui n'a pas chargé**. Asserter d'abord qu'une entrée autorisée est bien
   là.
3. **`npm run test:e2e` ne joue que `chromium`** (REP-80), alors que la
   configuration déclare cinq projets. Le menu mobile ne se teste qu'en
   **forçant le viewport** (`page.setViewportSize`), comme le fait déjà le
   cas mobile de `tests/navigation.spec.ts`.
4. **Ne pas publier de numéro de ligne** dans la story ou les REP : il se
   périme à la première édition du fichier qu'il désigne — y compris par le
   correctif qui l'accompagne. Référencer par symbole ou par contenu.
5. **Les comptes de démonstration sont partagés par toute la suite**
   (`CLAUDE.md` §3). Un test qui a besoin d'un `agent` s'en crée un jetable
   avec `tests/agence.ts` (`creerAgence`, `garnir`, `effacerAgence`), et
   nettoie en **`afterEach`, jamais en `finally`** — un dépassement de délai
   n'exécute pas un `finally`.

### Repères de test

| Besoin | Où |
|---|---|
| Agence jetable + comptes des trois rôles | `tests/agence.ts` |
| Connexion (pose une identité d'appelant **obligatoire**) | `tests/auth-helper.ts` |
| Cas de barre déjà écrits, dont un cas mobile | `tests/navigation.spec.ts` |
| Base **sans** le filtre de corbeille | `tests/db.ts` |

**Rappel `CLAUDE.md` §6, piège 2 :** un refus de garde arrive en **200** à
cause des `loading.tsx`, et c'est le navigateur qui redirige. Ne jamais
conclure d'un code HTTP ni d'un `page.url()` lu juste après `goto()` :
`waitForURL`, ou asserter le contenu. Et **jamais** `networkidle`.

### Project Structure Notes

- Le filtrage est un **affichage**, pas une autorisation. Il ne crée pas une
  seconde couche : `lib/auth-guard.ts` reste la seule (`CLAUDE.md` §5).
- Aucun chemin de données n'est touché : **pas de requête, pas d'écriture,
  donc pas de nouveau cloisonnement `agencyId` à vérifier** — mais la prop
  transmise vient d'une garde qui, elle, cloisonne déjà.
- Aucune dépendance à ajouter (`CLAUDE.md` §2). Tout existe :
  `isAgencyAdmin`, `requireAgency`, `requireSuperAdmin`.

### References

- [Source: docs/epics.md#Story 5.13] — critères d'acceptation, **la source fait foi**
- [Source: docs/stories/deferred-work.md] — REP-78, 79, 81, 82, 83, 84, avec l'arbitrage « masquer » et son motif
- [Source: docs/stories/5-12-rebrancher-les-commandes-mortes-de-la-console.md] — story précédente, ses quatre mutations et ses fautes
- [Source: CLAUDE.md §2, §5, §6, §8, §9, §12 règle 3]
- [Source: docs/project-context.md] — définition de « terminé », pièges du dépôt
- [Source: lib/auth-guard.ts] — `requireAgency`, `requireSuperAdmin`, `isAgencyAdmin`

---

## Arbitrage `loading.tsx` — rendu le 14-08-2026 par l'éditeur

**Décision : l'écran d'attente n'affiche que les douze entrées communes**,
c'est-à-dire uniquement ce que **tout** rôle peut ouvrir.

**Le motif, pour pouvoir le rouvrir sciemment.** Trois options étaient sur
la table :

| Option | Ce qu'elle coûte |
|---|---|
| **Les 12 communes** ✅ retenue | Un `agency_admin` voit « Vitrine » et quatre entrées du menu « Plus » **apparaître** à la résolution : la barre s'allonge un peu |
| Un squelette neutre | Rien de faux ni d'incomplet n'est jamais montré — mais **on ne peut plus naviguer pendant un chargement lent**, alors que c'est précisément pourquoi la barre est rendue là (le commentaire du fichier le dit) |
| Laisser les 17 | Zéro travail, mais un agent verrait les cinq entrées interdites **clignoter à chaque navigation** — le défaut que la story ferme, rejoué en boucle |

Ce qui a emporté la décision : **rien de faux n'est jamais affiché, seulement
de l'incomplet**, et l'incomplet se complète sous les yeux au lieu de se
rétracter. L'agent — celui que la story protège — voit une barre
rigoureusement stable ; c'est l'administrateur qui absorbe le petit
mouvement, et lui sait ce qu'il a le droit de voir.

**Conséquence technique directe :** la prop de rôle est **optionnelle**, et
son absence vaut « rôle le plus restreint ». `isAgencyAdmin(role ?? "")`
renvoie `false` : le repli restreint est obtenu sans branche
supplémentaire, donc sans endroit où se tromper.

---

## Arbitrage produit — déjà rendu, ne pas le rouvrir sans motif

**L'éditeur, le 14-08-2026 : MASQUER** les entrées qu'un agent ne peut pas
ouvrir, plutôt que les afficher désactivées.

**Le motif, parce que dans six mois seul le motif permettra de le
rouvrir :** un outil de terrain se juge à ce qu'il ne demande pas de
comprendre. Un agent immobilier n'a pas à apprendre la hiérarchie des rôles
du produit pour se servir de sa barre ; cinq entrées qui le rejettent lui
apprennent surtout à se méfier des liens.

**Le coût est assumé** : il ignorera que ces écrans existent, donc qu'il
pourrait les demander à son administrateur. Jugé moindre que celui d'une
barre qui propose ce qu'elle refuse. *Réversible : c'est un filtre sur une
liste, pas une architecture.*

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — `claude-opus-5[1m]`

### Debug Log References

**Décision de transmission — mesurée, pas supposée.** Deux voies étaient
possibles pour donner le rôle à la barre :

| Voie | Coût réel |
|---|---|
| Composant serveur enveloppe appelant `requireAgency()` | **Une requête Prisma de plus par page.** `requireAgency()` fait un `prisma.user.findUnique` — la garde est déjà appelée par la page, l'enveloppe la rappellerait. 45 pages × 1 requête |
| **Transmission depuis la déstructuration existante** ✅ | Aucune requête nouvelle. La donnée est déjà en main : 43 pages sur 45 appellent déjà la garde |

Retenu : la transmission. Motif — la story disait « la donnée est déjà en
main à chaque site d'appel », et la mesure le confirme. Payer une requête
par page pour éviter des modifications mécaniques serait un mauvais
échange, sur un produit où la story 3.3 existe précisément pour cesser de
compter en chargeant tout.

**Constat en passant :** `app/agency/layout.tsx` ne rend **aucune** barre —
il ne fait que la citer en commentaire. Son commentaire annonce « vérifiée
sur les 41 pages », un décompte qui n'est plus juste. Famille de `REP-74`.

### Completion Notes List

**La règle de rôle reste définie à un seul endroit.** `isAgencyAdmin` a
déménagé dans `lib/roles.ts`, module **sans aucune dépendance**, et
`lib/auth-guard.ts` la **ré-exporte** : les 22 appelants serveur
(`grep -rl "isAgencyAdmin" app components --include="*.ts" --include="*.tsx" | wc -l`
→ **22** ; `lib/roles.ts` et `lib/auth-guard.ts` en plus portent la
définition et la ré-export, ils ne sont pas des appelants) ne changent
pas d'une ligne, et le composant client importe la version pure. Recopier
`role === "agency_admin" || …` dans la barre aurait créé une seconde
définition — le mécanisme exact qui a produit BUG-35, deux barres disant la
même chose de deux façons dont une seule a été réparée.

**Le repli restreint est obtenu sans branche.** `peutVoirEspaceAdmin(undefined)`
vaut `false` : `loading.tsx` rend `<AgencyNavbar />` sans prop et n'affiche
donc que les douze entrées communes, sans qu'aucun appelant n'ait à s'en
souvenir. Un endroit de moins où se tromper.

**Pas de toast pour l'échec de déconnexion, et c'est mesuré.** `<Toaster />`
n'est **monté nulle part** dans ce dépôt (`grep -rn "<Toaster" app components`
→ aucun résultat), alors que `components/ui/toaster.tsx` et
`hooks/use-toast.ts` existent. Un `toast()` ne se serait affiché nulle part
— **la classe de défaut de la cloche de BUG-35.** Le message est donc rendu
dans le menu lui-même, avec `/api/auth/signout` comme sortie manuelle qui,
elle, fonctionne. *Constat versé en `REP-88`.*

**L'écart que je revendiquais sur AC 7 n'existait pas — il reposait sur un
raisonnement faux, et la revue l'a démonté.** Le premier jet gardait les
menus ouverts au clic, avec cette justification : « le menu est le seul
endroit où l'échec peut être annoncé, le fermer rendrait le message
invisible ». **Elle ne tenait pas.** Radix ferme son menu sur Échap et sur
un clic extérieur, quoi que fasse `preventDefault` : un utilisateur qui
fermait puis ne rouvrait pas ne voyait **jamais** l'échec — le `catch`
s'exécutait dans le vide. Le bandeau était donc invisible dans le cas
précis pour lequel il avait été écrit.

Le remède est structurel : **le bandeau vit désormais dans l'en-tête, hors
de tout menu.** Il survit à la fermeture, et du même coup les deux menus
peuvent de nouveau se refermer au clic — **AC 7 est tenu à la lettre, et
l'écart supprimé.** *Une justification qui ne survit pas à la première
vérification n'est pas un arbitrage, c'est une erreur habillée.*

**Un test a été écrit puis jeté, et il faut le dire.** Le premier jet
comportait un cas « l'écran d'attente n'affiche aucune entrée réservée » qui
vérifiait l'absence de « Comptes » pour un **agent** — donc vert avec ou
sans le repli. Un test vert dans les deux cas est pire que pas de test : il
certifie sans rien éprouver. Remplacé par un cas qui couvre le **chemin du
bureau**, distinct de celui du menu à plat.

**Le repli de `loading.tsx` n'est donc PAS couvert par un test E2E**, et
c'est un résultat écrit plutôt qu'une case cochée : le prouver demanderait
d'attraper une frame d'attente, ce qui serait instable. La propriété est
garantie par construction — `peutVoirEspaceAdmin(undefined) === false` — et
la mutation du filtre l'exercerait indirectement.

### Corrections apportées par la revue du 15-08-2026

Trois couches adversariales, **jouées sur un autre modèle que celui qui a
implémenté** — le workflow le recommande, et la revue de la 5.12 avait
montré pourquoi.

| Constat | Correction |
|---|---|
| **Le bandeau d'échec vivait dans le menu**, que Radix ferme sur Échap ou clic extérieur : l'échec devenait invisible | Bandeau remonté dans l'en-tête. **L'écart sur AC 7 disparaît** : les menus se referment de nouveau au clic |
| `initiale()` / `initiales()` indexaient par **unité UTF-16** : un nom commençant par un emoji rendait une demi-paire de substitution. Le schéma n'impose qu'une longueur ≥ 2, qu'un emoji satisfait | `Array.from`, qui découpe par point de code |
| Le lien de secours promettait « Fermer la session autrement », alors que `auth.config.ts` ne déclare pas `pages.signOut` : NextAuth sert sa page de confirmation **anglaise**, qui demande un second clic | Texte rendu exact. *Le fond — une page de secours non francisée — est versé en `REP-90`* |
| Le cas bureau ne vérifiait que « Vitrine » ; les quatre autres entrées vivent dans le déroulant « Plus », qu'aucun test n'ouvrait | Le cas ouvre « Plus », avec son propre ancrage positif |
| Cinq REP déclarés fermés dans l'index, mais **leur corps portait toujours « → story 5.13 »** | Marqués `→ **fermé par la story 5.13**`, selon le précédent du dépôt |
| `docs/epics.md` — que cette story cite comme **faisant foi** — ne couvrait que REP-78 et 79, sans critère pour REP-81, 83, 84 ni pour le repli d'attente | Quatre critères ajoutés, et la ligne « Couvre » complétée |
| Le constat « 41 pages » d'`app/agency/layout.tsx` était noté « famille de REP-74 » **sans numéro ni entrée** — l'orphelin exact que §1 interdit | `REP-89`, rattaché à la story 5.11 |

**Ce que la revue n'a pas trouvé, et qui vaut d'être écrit :** aucun défaut
de cloisonnement, aucune seconde couche d'autorisation, aucune lecture de
`session.user.role`, aucune fuite de code serveur dans le bundle client.
Les six chiffres publiés se reproduisent tous, et la File List est exacte
au fichier près.

### La preuve par mutation

Mutation : `const visibles = (liens) => liens` — le filtre ne filtre plus.
**Chirurgicale à dessein** : `estAdmin` reste utilisé par le menu
utilisateur, donc l'import et la variable restent légitimes et le lint ne
casse pas (§6, piège 3). Vérifié avant de lancer — `tsc` et `lint`
**passent sous mutation**, donc le rouge vient du test.

| Cas | Résultat | Le message désigne-t-il la bonne propriété ? |
|---|---|---|
| « un agent ne voit aucune des cinq entrées réservées » | 🔴 | **Oui** — `getByRole('link', { name: 'Vitrine', exact: true })`, `Expected: 0 / Received: 1` |
| « sur le bureau aussi, la rangée principale masque Vitrine » | 🔴 | **Oui** — même locator, sur l'autre chemin de rendu |
| « contrôle positif : un administrateur voit les cinq entrées » | 🟢 | Attendu : un admin les voit filtre ou pas. C'est ce qui établit que le rouge vient du **rôle**, pas d'une barre cassée |
| « masquer n'est pas garder : l'accès direct reste refusé » | 🟢 | **Attendu, et c'est le point** : la garde ne dépend pas de l'affichage. Ce vert prouve que le masquage n'est pas devenu une couche d'autorisation |

#### Seconde passe — et elle était nécessaire

La mutation ci-dessus **ne prouvait pas** la couverture ajoutée en revue.
Le cas bureau échouait sur « Vitrine », c'est-à-dire **avant** d'ouvrir le
déroulant « Plus » : les quatre assertions posées derrière n'étaient jamais
atteintes. Un cas rouge n'est pas une preuve tant qu'on n'a pas lu **où** il
rougit.

Mutation ciblée : `const autres = moreLinks` — seul le menu « Plus » cesse
d'être filtré, « Vitrine » reste masquée.

| Cas | Résultat | Où il échoue |
|---|---|---|
| « un agent ne voit aucune des cinq entrées réservées » | 🔴 | `getByRole('link', { name: 'Corbeille' })` — le menu à plat |
| « sur le bureau aussi, les cinq entrées sont masquées » | 🔴 | **`getByRole('menuitem', { name: 'Corbeille' })`** — donc APRÈS l'ouverture du déroulant, sur l'assertion ajoutée en revue |
| contrôle positif admin · garde | 🟢 | inchangés |

*C'est la deuxième fois dans ce cycle qu'une mutation trop large masque ce
qu'elle prétend prouver. La première avait donné 17 échecs sur 20 en
changeant deux variables à la fois (REP-80).*

### File List

| Fichier | Nature |
|---|---|
| `lib/roles.ts` | **NOUVEAU** — prédicats de rôle purs, importables par un client |
| `lib/auth-guard.ts` | ré-export d'`isAgencyAdmin` |
| `components/layout/AgencyNavbar.tsx` | filtrage par rôle, identité réelle, `aria-label`, échec de `signOut` |
| `components/layout/AdminNavbar.tsx` | identité réelle, `aria-label`, échec de `signOut` |
| 43 pages de `app/agency/**` | transmission de `userRole` et `userName` |
| 5 pages de `app/admin/**` | transmission de `userName` |
| `tests/navigation-roles.spec.ts` | **NOUVEAU** — 4 cas, contrôle positif compris |
| `tests/navigation.spec.ts` | sélecteur du menu utilisateur rendu stable |
| `docs/stories/5-13-n-afficher-que-ce-qui-s-ouvre.md` | cette story |
| `docs/stories/sprint-status.yaml` | statut et motifs |
| `docs/stories/deferred-work.md` | REP-78/79/81/83/84 fermés · REP-89 à 93 ouverts |
| `docs/epics.md` | couverture et quatre critères ajoutés en revue |

> *Écrite sans ellipse à dessein : une File List abrégée est ce que §9
> sanctionne. La story 1.9 en avait déclaré 7 sur 17, et l'écart n'a été vu
> qu'au moment de clore.*
