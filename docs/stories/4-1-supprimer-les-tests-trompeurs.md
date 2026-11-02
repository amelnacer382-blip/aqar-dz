# Story 4.1: Supprimer les tests trompeurs

Status: done

## Story

As a développeur,
I want que le nom d'un test décrive ce qu'il vérifie,
so that une suite verte veuille dire quelque chose.

**Couvre :** BUG-28 (défaut n° 19) · NFR-07
**Fichiers :** `tests/{admin,api-upload,clients,documents,owners,payments,properties,rentals,sales,visits}.spec.ts`, `tests/auth-helper.ts`, `tests/landing.spec.ts`

## Le défaut, recompté un par un

Le registre annonce dix-sept cas. Vérifié, ils y sont exactement :

| Fichier | Cas trompeurs | Ce qu'ils affirment | Ce qu'ils vérifient |
|---|:--:|---|---|
| `clients.spec.ts` | 2 | « display … when authenticated » | redirection vers `/auth/login` |
| `owners.spec.ts` | 3 | idem, + « validate required fields » | idem |
| `properties.spec.ts` | 3 | « display … page / form / showcase » | idem |
| `admin.spec.ts` | 3 | « redirect **non-admin** users » | redirection d'un visiteur **sans session** |
| `documents.spec.ts` | 1 | « display … when authenticated » | idem |
| `payments.spec.ts` | 1 | idem | idem |
| `rentals.spec.ts` | 1 | idem | idem |
| `sales.spec.ts` | 1 | idem | idem |
| `visits.spec.ts` | 1 | idem | idem |
| `api-upload.spec.ts` | 1 | « reject invalid file **types** » | le 401 d'un appel sans session |
| **Total** | **17** | | |

Trois remarques que le registre ne fait pas.

**1. Les cas d'`admin.spec.ts` sont d'une espèce plus insidieuse.** Ils
n'annoncent pas une session, ils annoncent un **rôle** : « redirect
non-admin users ». Or aucune session n'est ouverte. Ils prétendent donc
couvrir la séparation des rôles — la propriété la plus chère à vérifier
— en couvrant l'authentification, qui est la moins chère. C'est le seul
endroit où un test vert répond à une question qu'on ne lui a pas posée.

**2. `auth-helper.ts` est mort.** Il est importé par `owners.spec.ts` et
jamais appelé. Ses sélecteurs (`input[type='email']`) ne sont d'ailleurs
pas ceux du reste de la suite (`#email`). Un helper qu'aucun test
n'exerce est un helper dont on ne sait pas s'il fonctionne.

**3. Onze fichiers pour une seule assertion réelle.** Débarrassés de
leurs mensonges, ces dix cas disent tous la même chose : *un visiteur
sans session est renvoyé vers la connexion*. C'est vrai, c'est utile,
c'est la garde la plus extérieure du produit — et c'est répété dix fois
sur une liste **partielle** de routes.

## Ce que je tranche, et pourquoi

### Une table, pas dix fichiers

Les dix stubs disparaissent au profit d'un seul `tests/acces.spec.ts`
piloté par la table **complète** des routes protégées — 31 routes
statiques relevées dans `app/agency` et `app/admin`, contre 13 couvertes
aujourd'hui. Le remplacement n'est donc pas une simple suppression : la
couverture réelle **augmente** pendant que le nombre de fichiers baisse.

### Les deux moitiés, séparées et honnêtes

- **Sans session** : chaque route protégée renvoie vers `/auth/login`.
- **Avec session** : chaque route répond `200`, **ne** renvoie **pas**
  vers la connexion, et **n'affiche pas l'écran d'erreur**. Deux comptes,
  parce que `middleware.ts` sépare les deux domaines : un super admin est
  renvoyé de `/agency/*` vers `/admin`, un compte d'agence de `/admin/*`
  vers `/agency`.

Ce que la seconde moitié prouve, et il faut le dire : **la route est
joignable et ne casse pas**. Elle ne dit rien de l'utilité de la page.
C'est exactement ce que les dix cas menteurs prétendaient faire — et ne
faisaient pas du tout.

**La troisième assertion n'était pas dans mon plan, et sans elle tout ce
paragraphe aurait été faux.** J'avais écrit que le `200` suffisait à
attraper une page qui lève côté serveur. C'est inexact : Next diffuse le
rendu en flux, l'en-tête `200` est déjà parti quand l'exception survient,
et `app/error.tsx` prend la suite dans le corps. Mesuré par mutation —
voir le Debug Log. Sans l'assertion sur l'absence du titre « Une erreur
est survenue », cette table aurait été verte pendant que les trente et
une pages affichaient un écran d'erreur : le défaut même que la story
supprime, reproduit dans son remède.

### `api-upload.spec.ts` est supprimé, pas réparé

Ses deux assertions existent ailleurs, et en mieux :

- le 401 sans session → `regression.spec.ts`, « les routes API répondent
  401 en JSON, pas du HTML » — qui vérifie en plus le type de contenu ;
- le refus de type → `regression.spec.ts`, bloc BUG-09 de la story 2.2,
  qui vérifie le refus **par le contenu** et non par le type annoncé,
  c'est-à-dire la chose que ce fichier prétendait tester.

Le réparer produirait un doublon plus faible que l'original. Je le
supprime en écrivant où chaque assertion a migré.

### `auth-helper.ts` devient le helper réel

Plutôt que de le supprimer, je le fais servir : c'est lui qu'utilise
`acces.spec.ts`, avec les sélecteurs du reste de la suite. L'AC le
prescrit, et cela ne coûte rien.

Ce que je **ne** fais **pas** : convertir `regression.spec.ts` et
`features.spec.ts`, qui ont chacun leur `login()` local. Trois helpers
pour une seule action est une dette réelle, mais la payer ici toucherait
soixante-dix tests qui passent, sans rapport avec le nom trompeur d'un
onzième. Reporté.

### Les deux cas honnêtes de `landing.spec.ts` partent aussi

Ses cas « redirect unauthenticated users to login » et « … from admin »
ne mentent pas — mais ils deviennent des doublons exacts de la table.
Les retirer relève du même ménage ; je le signale plutôt que de le
glisser.

### Ce que je laisse aux stories suivantes

- **4.2** — le cloisonnement inter-agences. Aucun test ne le couvre
  aujourd'hui, et ce n'est pas ce que corrige 4.1.
- **4.3** — la séparation des rôles, c'est-à-dire ce qu'`admin.spec.ts`
  prétendait faire. Un agent connecté qui tente `/admin` : la table de
  4.1 ne le couvre pas, et je ne l'y glisse pas en douce.

## Acceptance Criteria

1. **Given** les dix-sept cas dont le nom contredit l'assertion
   **When** la story est terminée
   **Then** aucun ne subsiste : chacun est supprimé, ou remplacé par un cas dont le nom décrit ce qu'il vérifie

2. **Given** `api-upload.spec.ts` vérifiait un 401 sous le nom « reject invalid file types »
   **When** il est traité
   **Then** ses deux assertions sont couvertes ailleurs, et l'endroit est écrit dans la story

3. **Given** la liste des routes protégées
   **When** la nouvelle table est écrite
   **Then** elle couvre les 31 routes statiques de `app/agency` et `app/admin`, et non les 13 d'aujourd'hui

4. **Given** un visiteur sans session
   **When** il demande n'importe laquelle de ces routes
   **Then** il est renvoyé vers `/auth/login`

5. **Given** une session réelle du bon domaine
   **When** elle demande ces mêmes routes
   **Then** chacune répond `200` sans renvoyer vers la connexion

6. **Given** `tests/auth-helper.ts`, importé mais jamais appelé
   **When** la story est terminée
   **Then** il est réellement exercé par la suite

## Tasks / Subtasks

- [x] **1. `tests/auth-helper.ts` — le rendre vrai** (AC 6)
  - [x] Sélecteurs alignés sur le reste de la suite (`#email`, `#password`)
  - [x] Attente de sortie de `/auth/` plutôt que d'une URL devinée

- [x] **2. `tests/acces.spec.ts` — la table complète** (AC 3, 4, 5)
  - [x] Table des 31 routes statiques, séparée agence / éditeur
  - [x] Passe sans session : renvoi vers `/auth/login`, message nommant la route
  - [x] Passe avec session : `200` et pas de renvoi, deux comptes

- [x] **3. Suppression des stubs** (AC 1, 2)
  - [x] `admin`, `api-upload`, `clients`, `documents`, `owners`, `payments`, `properties`, `rentals`, `sales`, `visits`
  - [x] Les deux doublons de `landing.spec.ts`

- [x] **4. Vérification par mutation**
  - [x] Retirer la garde d'une route protégée → la passe sans session doit rougir
  - [x] Rendre une page en erreur → la passe avec session doit rougir

## Dev Notes

**Le compte de cas va baisser, et c'est le but.** 103 aujourd'hui, dont
25 dans les fichiers supprimés. Un nombre de tests qui descend pendant
que la couverture monte est exactement ce que cette story doit produire ;
le noter ici évite qu'on le lise plus tard comme une perte.

**Les routes `[id]` sont hors table.** Elles demandent une donnée
existante, donc un `beforeEach` qui la crée ou la cherche — c'est le
travail de la story 4.2, qui a besoin de deux agences de toute façon.

**Un super admin est renvoyé de `/agency/*`.** `requireAgency()` redirige
dès que la session n'a pas d'`agencyId`, ce qui est toujours le cas d'un
super admin. La table doit donc être parcourue par deux comptes, pas un.

## Dev Agent Record

### Context Reference

`docs/qa/bug-report.md` (BUG-28), `docs/epics.md` (story 4.1), les dix
fichiers de stubs, `tests/auth-helper.ts`, `tests/landing.spec.ts`,
`middleware.ts`, `app/error.tsx`.

### Implementation Plan

1. `auth-helper.ts` rendu réel et unique.
2. `acces.spec.ts` : table des 31 routes, deux moitiés, deux comptes.
3. Suppression des dix stubs et des deux doublons de `landing.spec.ts`.
4. Mutations.

### Debug Log

Trois mutations, et **deux d'entre elles m'ont contredit** — c'est le
passage le plus utile de cette story.

**Mutation A — vider le garde d'une page n'a rien changé.** J'ai
neutralisé `requireAgency()` dans `app/agency/leads/page.tsx` en
m'attendant à voir la passe « sans session » rougir. Elle est restée
verte. Motif : la garde effective est `middleware.ts`, qui s'exécute
**avant** la page ; la requête n'arrivait déjà plus jusqu'au garde que je
venais de retirer. La mutation n'a donc rien prouvé sur le test — mais
elle a prouvé quelque chose sur ma compréhension : j'avais écrit dans
`acces.spec.ts` que `requireAgency()` renvoie un super admin de
`/agency/*`. C'est le middleware qui le fait, et vers `/admin`, pas vers
la connexion. Commentaire corrigé.

**Mutation B — la garde retirée, mais le rapport tronqué.** En rétrécissant
la protection du middleware à `/agency/leads`, la passe « sans session »
est bien devenue rouge — sur **une seule** route, `/agency`, la première
de la liste. Une assertion dure s'arrête au premier échec et cache les
vingt-cinq autres. Passé en `expect.soft` : le test échoue toujours, mais
il dit tout ce qui est cassé.

**Mutation C — mon assertion `200` ne valait rien, et je l'avais
commentée comme si elle valait tout.** J'avais écrit : « Le 200 est ce
qui attrape la régression qui compte ici : une page qui lève côté serveur
rend 500, et aucun test ne le voyait. » J'ai posé un `throw` dans
`app/agency/trash/page.tsx` : la page a bien levé — l'erreur est dans les
journaux du serveur — et **le test est resté vert**. Next diffuse le
rendu en flux : l'en-tête `200` est déjà parti quand l'exception
survient, et `app/error.tsx` prend la suite dans le corps de la réponse.

C'est un échec sérieux, et pas un détail de forme : sans correction,
cette table aurait été verte pendant que les trente et une pages
affichaient un écran d'erreur — exactement le défaut que la story est
censée supprimer, reproduit dans son propre remède. Assertion ajoutée sur
l'absence du titre « Une erreur est survenue » ; mutation relancée, rouge
en nommant `/agency/trash`.

### Completion Notes

**79 tests passés**, contre 103 avant. La baisse est le but : 25 cas
supprimés (dont 17 menteurs), 2 doublons retirés de `landing.spec.ts`,
3 cas ajoutés qui couvrent **31 routes** au lieu des 13 d'avant.

Chaque assertion des fichiers supprimés a été relogée, et voici où :

| Assertion d'origine | Où elle vit maintenant |
|---|---|
| « visiteur sans session renvoyé vers la connexion » (×10 fichiers, 13 routes) | `acces.spec.ts`, passe 1, 31 routes |
| « display … when authenticated » (17 menteurs) | `acces.spec.ts`, passes 2 et 3 — pour de vrai |
| `api-upload` : 401 sans session | `regression.spec.ts`, « les routes API répondent 401 en JSON » (+ type de contenu) |
| `api-upload` : « reject invalid file types » | `regression.spec.ts`, bloc BUG-09 — refus **par le contenu** |

### Review Findings

Revue adversariale du 11-08-2026. Le gros du travail avait déjà été fait
par les mutations (voir Debug Log) ; la revue en a trouvé un de plus, et
c'est celui qui manquait.

**1. Ma table se disait exhaustive et ne l'était que le jour de son
écriture.** `tests/acces.spec.ts` — les 31 routes étaient recopiées à la
main depuis un `find`. Le lendemain d'un
`app/agency/quelque-chose/page.tsx`, la route nouvelle n'entre dans
aucune liste, aucun test ne la demande, et la suite reste verte en
couvrant une page de moins. **Une couverture qui se dégrade en silence
pendant que le compteur de tests ne bouge pas — c'est exactement la
tromperie de BUG-28, déplacée d'un cran** : j'aurais remplacé dix-sept
tests qui mentent sur ce qu'ils vérifient par une table qui ment sur ce
qu'elle couvre.

Un quatrième cas confronte désormais la table au disque
(`readdirSync` sur `app/agency` et `app/admin`, routes `[id]` et groupes
`(…)` écartés). Mutation : une entrée retirée de la table → rouge.

**2. Les trois constats des mutations, rappelés ici** parce qu'ils
relèvent de la revue autant que du développement : la garde effective est
le middleware et non le garde de page ; une assertion dure sur une table
cache tout après le premier échec ; et un `200` ne prouve pas qu'une page
ne lève pas.

**3. Ce que la story ne couvre toujours pas, et je l'écris plutôt que de
le laisser deviner :** les routes `/api/*` autres que `/api/upload` n'ont
aucune passe systématique. La table ne couvre que des pages. C'est une
lacune réelle, du même genre que celle que cette story ferme — mais elle
appartient à la story 4.4, qui verrouille les correctifs de l'épopée 1.

### File List

- `tests/acces.spec.ts` *(nouveau)*
- `tests/auth-helper.ts` *(réécrit)*
- `tests/landing.spec.ts`
- `tests/{admin,api-upload,clients,documents,owners,payments,properties,rentals,sales,visits}.spec.ts` *(supprimés)*
- `docs/qa/bug-report.md`
- `docs/stories/sprint-status.yaml`

### Change Log

- 11-08-2026 — story créée, implémentée, testée (79 verts), 3 mutations dont 2 m'ont contredit.
- 11-08-2026 — revue : garde table/disque ajouté (4e mutation tuée), 80 verts.
