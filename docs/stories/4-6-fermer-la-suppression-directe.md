---
baseline_commit: 261195695aa1ffef1eec4f349f9a5af8cdf9b423
---

# Story 4.6: Fermer la suppression directe des écrans d'édition

Status: done

## Story

As a administrateur d'agence,
I want que la règle « un agent ne supprime pas » s'applique sur tous les chemins et pas seulement sur ceux qui ont une route d'API,
so that une permission trop large ne détruise pas un historique que rien ne pourra rendre.

**Couvre :** défaut n° 32 (BUG-32), NFR-07

## Ce que cette story doit vraiment faire

Le produit énonce sa règle et la tient **partout où on l'a cherchée**. Les
huit routes `POST /api/*/[id]/delete` vérifient `isAgencyAdmin()`. Les
listes cachent le bouton aux agents. `tests/roles.spec.ts` éprouve les
huit routes et les cinq écrans réservés, refus **et** contrôle positif.

Cinq Server Actions de suppression ne sont ni des routes, ni des écrans
réservés. Elles n'appellent que `requireAgency()`, leur bouton est rendu
sans condition, et **aucune n'écrit dans `AuditLog`** :

| # | Action | Fichier | Homologue d'API | Effet aujourd'hui |
|---|---|---|---|---|
| 1 | `deleteProperty` | `app/agency/properties/[id]/edit/page.tsx:138` | `isAgencyAdmin` + corbeille + journal | **`delete()` définitif + cascade**, aucun journal |
| 2 | `deleteVisit` | `app/agency/visits/[id]/edit/page.tsx:116` | `isAgencyAdmin` + journal | `delete()`, aucun journal |
| 3 | `deletePayment` | `app/agency/payments/[id]/edit/page.tsx:131` | `isAgencyAdmin` + journal | `delete()`, aucun journal |
| 4 | `deleteRecord` | `app/agency/rental-management/[id]/edit/page.tsx:101` | *aucun* | `delete()`, aucun journal |
| 5 | `deleteInteraction` | `app/agency/interactions/actions.ts:68` | *aucun* | `delete()`, aucun journal |

**Le cloisonnement inter-agences tient sur les cinq** — chacune fait son
`findFirst({ id, agencyId })` avant d'écrire. Ce n'est pas une fuite entre
agences. C'est la séparation des rôles, et elle seule.

### Le cas du bien est d'une autre nature que les quatre autres

`Property` est un modèle à **suppression réversible**. La route d'API pose
`deletedAt` ; l'action de l'écran appelle `prisma.property.delete()`. Les
cascades du schéma partent avec la ligne :

```
Property (delete)
├── PropertyImage        Cascade   → les photos
├── Visit                Cascade   → l'historique des visites
├── Sale                 Cascade   → les ventes
├── Rental               Cascade   → les baux
│   └── RentalManagement Cascade   → les échéanciers de loyers
└── Payment              SetNull   → les paiements sont délestés
```

Rien en corbeille — l'écran ne montre que ce qui porte un `deletedAt`, et
il n'y en a plus. Rien dans `AuditLog`. **Et l'épopée 0 n'est pas
commencée : il n'existe aucune sauvegarde d'où revenir.**

## Ce que je tranche, et pourquoi

**Cacher le bouton n'est jamais la mesure.** C'est la seconde, et le
commentaire de `app/agency/properties/page.tsx:215` le dit déjà : « l'API
le vérifie aussi : cacher le bouton ne suffit jamais à protéger une
action ». Une Server Action est un point d'entrée `POST` joignable sans
l'écran qui la rend. L'AC 1 l'exige donc **prouvé au serveur**, en
rejouant le POST sans interface.

**Trois des cinq ne demandent aucun arbitrage.** Bien, visite et paiement
ont un homologue d'API réservé à l'administrateur : la règle est écrite,
il faut l'appliquer des deux côtés. Aligner l'écran sur la route, jamais
l'inverse.

**Les deux autres ont été tranchées le 12-08-2026**, par délégation
explicite de l'éditeur, et la décision est consignée dans
`sprint-status.yaml` :

- **échéance de gestion locative → administrateur.** C'est une ligne
  comptable : la supprimer fausse le décompte du net à reverser au
  propriétaire, et l'erreur ne se voit qu'au versement, chez le
  propriétaire. Coût d'une permission trop étroite : un agent qui demande
  à son administrateur. Coût de l'inverse : un litige.
- **interaction → agent, mais journalisée.** Ligne d'historique saisie par
  l'agent lui-même à l'instant ; la réserver rendrait une faute de frappe
  ineffaçable pour celui qui l'a commise, ce qui pousse à contourner
  l'outil. Le journal couvre l'abus.

**Le bien redevient réversible.** Ce n'est pas un ajout de confort : c'est
la règle 5 de `docs/project-context.md` (« poser `deletedAt`, jamais
`delete` ») que cet écran viole. La destruction définitive existe déjà, à
un seul endroit et à dessein — la corbeille, où elle est explicite et
journalisée.

**Les quatre autres gardent leur `delete()` dur.** `Visit`, `Payment`,
`RentalManagement` et `Interaction` ne sont pas des modèles à suppression
réversible, leurs routes d'API les détruisent aussi, et étendre la
corbeille à de nouveaux modèles est explicitement la **story 3.5** — pas
celle-ci. Ne pas élargir le périmètre.

**La journalisation entre dans cette story et n'en sort pas.** Une
suppression autorisée mais invisible laisse la même question sans réponse
(« qui a fait disparaître ce bien ? ») que la suppression non autorisée.
Les huit routes d'API journalisent déjà ; les cinq actions sont la moitié
manquante du même dispositif.

## Acceptance Criteria

1. **Given** un compte `agent` de l'agence, et un bien, une visite et un paiement de cette même agence
   **When** il soumet la Server Action de suppression de l'écran d'édition — **directement en `POST`, sans passer par l'interface**
   **Then** l'action est refusée exactement comme l'est déjà `POST /api/{properties,visits,payments}/[id]/delete`
   **And** la ligne visée existe toujours en base après le refus

2. **Given** un `agency_admin` qui supprime un **bien** depuis l'écran d'édition
   **When** l'opération aboutit
   **Then** le bien part **à la corbeille** (`deletedAt`) et non en suppression définitive, comme le fait déjà la route d'API
   **And** il est restaurable depuis `/agency/trash`
   **And** ses photos, visites, ventes, baux et échéanciers de gestion locative sont toujours en base

3. **Given** l'une quelconque des cinq suppressions, effectuée par un compte autorisé
   **When** elle aboutit
   **Then** une ligne est écrite dans `AuditLog` via `recordAudit()`, comme le font les huit routes d'API

4. **Given** la fiche de gestion locative et l'interaction n'ont aucune route d'API homologue
   **When** la story démarre
   **Then** l'arbitrage rendu le 12-08-2026 est appliqué tel quel : **administrateur** pour l'échéance de loyer, **agent mais journalisée** pour l'interaction
   **And** tout écart à cette décision est écrit dans la story avec son motif

5. **Given** le bouton « Supprimer » est aujourd'hui rendu sans condition au bas de ces écrans
   **When** la story est terminée
   **Then** il n'est rendu qu'aux comptes qui peuvent réellement l'actionner
   **And** l'agent conserve l'accès à l'écran d'édition et la possibilité d'**enregistrer** ses modifications

6. **Given** `tests/roles.spec.ts` couvre les huit routes de suppression et les cinq écrans réservés
   **When** la story est terminée
   **Then** il couvre aussi les cinq Server Actions de suppression
   **And** chaque refus attendu est doublé d'un **succès constaté** d'un compte autorisé sur la même action
   **And** la couverture est prouvée **par mutation** : en retirant le garde ajouté, le test rougit

7. **Given** l'angle mort qui a produit ce défaut est structurel — une garde absente ne se voit pas dans le fichier qui devrait la porter
   **When** la story se termine
   **Then** l'inventaire des Server Actions destructives et de leur garde est écrit dans `docs/architecture.md`, pour que le prochain écran ajouté se compare à une liste et non à une intuition

## Tasks / Subtasks

- [x] **1. Poser le garde de rôle** (AC 1, 4)
  - [x] `deleteProperty`, `deleteVisit`, `deletePayment` → `requireAgencyAdmin()`
  - [x] `deleteRecord` (gestion locative) → `requireAgencyAdmin()`
  - [x] `deleteInteraction` → reste `requireAgency()`, décision assumée et écrite dans le code
  - [x] Vérifier qu'aucune action de **mise à jour** n'a été restreinte au passage

- [x] **2. Rendre au bien sa suppression réversible** (AC 2)
  - [x] `prisma.property.delete()` → `update({ data: { deletedAt: new Date() } })`
  - [x] Aligner le `findFirst` sur celui de la route : `{ id, agencyId, deletedAt: null }`
  - [x] Aligner la redirection et le message sur « mis à la corbeille »
  - [x] Vérifier la restauration depuis `/agency/trash`

- [x] **3. Journaliser les cinq** (AC 3)
  - [x] `recordAudit()` avec `action: "suppression"`, l'`entity` métier et un `summary` lisible
  - [x] Reprendre les libellés des routes d'API homologues, ne pas en inventer

- [x] **4. Conditionner le rendu des boutons** (AC 5)
  - [x] `isAgencyAdmin(userRole)` autour des quatre formulaires de suppression
  - [x] Récupérer `userRole` depuis la garde de la page — il est déjà rendu par `requireAgency()`
  - [x] `InteractionTimeline` : inchangé, l'agent garde le bouton

- [x] **5. Couvrir dans `tests/roles.spec.ts`** (AC 6)
  - [x] Rejouer les Server Actions en POST, refus agent + succès administrateur
  - [x] Relire la base après chaque refus : la ligne est toujours là
  - [x] Pour le bien : après le succès administrateur, `deletedAt` est posé **et** les enfants sont toujours en base
  - [x] Mutation : retirer un garde, constater le rouge, le remettre

- [x] **6. Écrire l'inventaire** (AC 7)
  - [x] Tableau des Server Actions destructives et de leur garde dans `docs/architecture.md`
  - [x] Marquer BUG-32 corrigé dans `docs/qa/bug-report.md`
  - [x] `docs/stories/sprint-status.yaml` tenu à jour (`review` à la fin du développement, `done` à la sortie de revue)

## Dev Notes

### Le point technique qui décide de la story : rejouer une Server Action en POST

L'AC 1 exige le refus **sans passer par l'interface**. Après la tâche 4,
le bouton n'existe plus dans le HTML servi à un agent : un test qui
cliquerait ne prouverait que le masquage.

**Comment React décode une Server Action** (vérifié dans
`node_modules/next/dist/compiled/react-server-dom-webpack/cjs/react-server-dom-webpack-server.node.production.js`) :
le corps du POST porte des champs cachés

- `$ACTION_ID_<id>` — action **non liée** (fonction de module, prend `FormData`) ;
- `$ACTION_REF_<n>` + `$ACTION_<n>:<k>` — action **liée**, qui capture des
  variables de son composant.

Nos quatre actions d'écran capturent `params` : elles sont **liées**. Seule
`deleteInteraction` est de module.

**Le mode opératoire, et il n'y en a pas d'autre de fiable :**

1. ouvrir une session **administrateur**, charger l'écran d'édition ;
2. lire l'attribut `action` du `<form>` **et tous** ses `input[type=hidden]`
   dont le `name` commence par `$ACTION` ;
3. rouvrir une session **agent**, rejouer ce POST à l'identique ;
4. vérifier le refus **et** relire la ligne en base.

> ⚠ **Ne jamais coder en dur un identifiant d'action.** Il est calculé au
> `build` : figé dans le test, il pourrit au premier `next build` et le
> test devient vert en ne testant plus rien — exactement le défaut BUG-28
> que la story 4.1 a passé son temps à retirer. Le lire à l'exécution.

> Si le harnais ne parvient pas à rejouer une action liée, **c'est un
> résultat, pas une dispense** : le consigner dans le Debug Log avec ce qui
> a été essayé, et couvrir cette action-là par le chemin le plus proche
> disponible. Une case cochée sans preuve vaut moins qu'un trou déclaré.

### Pièges de ce dépôt, mesurés dans les stories précédentes

- **Une Server Action ne capture que des valeurs, jamais des fonctions.**
  `app/agency/trash/page.tsx:40` porte la cicatrice : `locate` a dû être
  remontée au niveau du module après un « locate is not defined » à
  l'exécution. Tout helper extrait pendant cette story se déclare **hors**
  du composant.
- **`redirect()` lève `NEXT_REDIRECT`.** Ne jamais l'entourer d'un
  `try/catch` qui avalerait l'exception. Un refus se lit donc côté test à
  la redirection vers `/agency?error=…`, pas à un code 403.
- **`recordAudit()` n'échoue jamais** — il avale ses erreurs à dessein
  (`lib/audit.ts`). L'appeler ne peut pas casser l'action métier.
- **L'extension Prisma masque les lignes `deletedAt`** au premier niveau
  seulement. Après la tâche 2, un bien mis à la corbeille disparaît des
  listes sans autre changement — c'est voulu, ne pas ajouter de filtre.
- **`tests/db.ts` est un client Prisma brut**, sans cette extension, et
  c'est **pourquoi il faut l'utiliser ici** : il relit une ligne quel que
  soit son état. Avec le client de l'application, un bien supprimé à tort
  ressortirait « introuvable » et le test le lirait comme « la garde a
  tenu » — l'inverse de la vérité.

### Harnais de test disponible

| Besoin | Où |
|---|---|
| Agence jetable + comptes | `tests/agence.ts` — `creerAgence(["agency_admin","agent"])` |
| Décor métier complet (12 entités liées) | `tests/agence.ts` — `garnir(agence)` |
| Nettoyage | `tests/agence.ts` — `effacerAgence(agence)` |
| Lecture en base sans filtre | `tests/db.ts` — `db` |
| Connexion | `tests/auth-helper.ts` — `login(page, email)` |

**`login()` pose une identité d'appelant obligatoire.** Sans elle, tous les
tests tombent dans le même compteur `inconnu` et franchissent le plafond de
60 connexions par quart d'heure — symptôme constaté : des `waitForURL`
expirés sur des tests sans rapport. Ne jamais se connecter autrement.

**Comptes du jeu de démonstration :** `admin@aqar.dz` (agency_admin),
`agent@aqar.dz` (agent), `superadmin@aqar.dz`, mot de passe `password123`,
agence `agence-demo`.

**Pour le bien, utiliser une agence jetable et non l'agence de
démonstration** : la mise à la corbeille d'un bien du seed déplacerait le
décor d'autres tests. `creerAgence` + `garnir` posent exactement le bien,
la visite, la vente, le bail, l'échéance et le paiement dont l'AC 2 a
besoin.

**Compter large sur les délais :** `test.setTimeout(180000)` est le
standard des tests de rôle du dépôt ; chaque `login()` vérifie un bcrypt de
coût 12 sur un serveur unique partagé par quatre travailleurs.

### Le contrôle positif est obligatoire

Imposé par la revue de la story 4.2 et appliqué dans tout
`roles.spec.ts` : **un refus seul ne prouve rien.** Une action cassée pour
tout le monde donne exactement le même vert qu'une action correctement
gardée. Chaque refus d'agent se double d'un succès constaté d'un
administrateur sur la même action.

### Ce que cette story ne fait pas

- Elle n'étend pas la corbeille à `Visit`, `Payment`, `RentalManagement` ou
  `Interaction` — c'est la **story 3.5**.
- Elle ne touche pas aux huit routes d'API : elles sont déjà correctes et
  couvertes.
- Elle ne restreint aucune action de **création** ni de **modification** :
  un agent gère le quotidien, c'est la règle du produit.

### Project Structure Notes

Cinq fichiers de `app/agency/**` et un fichier de test. Aucun nouveau
module, aucune dépendance : `requireAgencyAdmin`, `isAgencyAdmin` et
`recordAudit` existent et sont importés ailleurs dans le même dossier.

Aucun runner unitaire n'est installé (ni Vitest ni Jest) — **ne pas en
ajouter** : la couverture de cette story est E2E, dans le fichier existant
`tests/roles.spec.ts`. Ajouter un runner est la story 4.5.

### References

- [Source: docs/qa/bug-report.md#bug-32] — le constat, les deux axes, la chaîne de cascade
- [Source: docs/epics.md#Story-4.6] — les sept critères
- [Source: docs/stories/sprint-status.yaml] — l'arbitrage du 12-08-2026 (point d'attention épopée 4)
- [Source: docs/project-context.md] — règles 2 (cloisonnement), 5 (suppression réversible), 6 (journalisation), définition de « terminé »
- [Source: docs/architecture.md#3] — le motif garde → appartenance → écriture, et l'encadré d'exception de §4
- [Source: docs/stories/4-3-couvrir-la-separation-des-roles.md] — ce que la couverture des rôles atteint déjà, et ses angles morts déclarés
- [Source: docs/stories/4-4-verrouiller-les-correctifs-epopee-1.md] — méthode de l'audit par mutation, et le coût mesuré d'une mutation qui ne compile pas
- Modèle de référence à copier : `app/api/properties/[id]/delete/route.ts` (garde + corbeille + journal, les trois en dix lignes)

## Dev Agent Record

### Context Reference

`app/agency/{properties,visits,payments,rental-management}/[id]/edit/page.tsx`,
`app/agency/interactions/actions.ts`, `components/InteractionTimeline.tsx`,
`lib/auth-guard.ts`, `lib/audit.ts`, `app/api/*/[id]/delete/route.ts`,
`tests/roles.spec.ts`, `tests/agence.ts`, `tests/db.ts`.

### Implementation Plan

1. Garde de rôle sur quatre des cinq actions, journal sur les cinq.
2. Bien : `delete()` → `deletedAt`, aligné sur la route d'API.
3. Rendu conditionnel des quatre boutons.
4. `tests/roles.spec.ts` : rejeu des Server Actions, refus + contrôle positif.
5. Mutation de chaque garde ajouté, une par une, suite complète à chaque fois.
6. Inventaire dans `docs/architecture.md`, registre et suivi de sprint.

### Debug Log

**Phase rouge — le défaut reproduit, et pire que sa description.** Le test
a d'abord été écrit contre le code non corrigé. Trois voies de rejeu ont
été essayées avant d'en trouver une fiable :

1. `request.post({ form })` → `Failed to find Server Action` — le corps
   doit être du multipart, l'action capturant `params` donc étant *liée* ;
2. `request.post({ multipart })` → même erreur ; la sérialisation de
   Playwright ne reproduit pas exactement celle de React ;
3. réinjecter le formulaire relevé dans la page de l'agent et appeler
   `form.submit()` → **fonctionne**, et c'est la voie la plus fidèle :
   `submit()` ne déclenche aucun gestionnaire React, c'est exactement le
   chemin d'un navigateur sans JavaScript.

Le relevé du formulaire montre pourquoi la charge utile ne se devine pas :
`action=""`, `enctype="multipart/form-data"`, et trois champs cachés dont
`$ACTION_3:2` qui porte les arguments liés **chiffrés**.

**Résultat de la phase rouge, sur l'instance :** l'agent poste, le serveur
répond `303`, la redirection annonce « Bien supprimé », `property.count`
tombe à `0` — **et `visit.count` aussi**. La cascade du schéma avait emporté
l'historique. Le défaut était établi par lecture ; il est désormais
constaté.

**Un faux vert traversé au passage, et il valait la leçon.** La première
version du test « passait » alors que le rejeu échouait : la ligne
survivait parce que l'action n'avait jamais été exécutée, pas parce qu'une
garde l'avait refusée. Un test de refus doit donc prouver que l'action a
bien été *tentée* — d'où l'attente d'une navigation dans `rejouer()` : un
refus redirige, un succès aussi, mais le silence ne prouve rien.

**Audit par mutation — les cinq gardes, un par un.** Chaque mutation a été
compilée avant d'être jugée : retirer `requireAgencyAdmin()` rend son import
inutilisé, ce que le lint refuse et qui fait échouer `next build` — une
mutation qui ne compile pas ne prouve rien (leçon de la story 4.4). L'import
est donc retiré avec la garde.

| Mutation | Résultat |
|---|---|
| `deleteProperty` → `requireAgency()` | 🔴 1 failed |
| `deleteVisit` → `requireAgency()` | 🔴 1 failed — « un agent a supprimé visite » |
| `deletePayment` → `requireAgency()` | 🔴 1 failed — « un agent a supprimé paiement » |
| `deleteRecord` → `requireAgency()` | 🔴 1 failed — « un agent a supprimé échéance » |
| `deleteInteraction` → `requireAgencyAdmin()` | 🔴 1 failed — l'arbitrage inverse est épinglé lui aussi |

La cinquième mutation est la plus intéressante : elle prouve que la
**décision** de laisser l'interaction à l'agent est tenue par un test, et
ne pourra pas être refermée par inadvertance.

### Completion Notes

Les cinq Server Actions destructives des écrans d'édition sont fermées.
Quatre passent par `requireAgencyAdmin()` ; la cinquième reste ouverte à
l'agent **par décision écrite dans le code**, et non par omission — c'est
la différence que cette story existe pour établir. Les cinq journalisent,
en reprenant les libellés de leurs homologues d'API plutôt qu'en en
inventant.

Le bien retrouve la règle 5 de `project-context.md` : `deletedAt` au lieu de
`delete()`. Vérifié en base — après suppression par un administrateur, la
visite, la vente, le bail et l'échéancier sont **toujours là**, et le bien
se restaure depuis `/agency/trash`.

Les quatre boutons ne sont plus rendus qu'à qui peut les actionner. Ce n'est
jamais la mesure, seulement la seconde : le refus est prouvé au serveur, par
rejeu du POST sans interface.

**Ce que la story n'a pas fait, à dessein :** elle n'étend pas la corbeille
à `Visit`, `Payment`, `RentalManagement` ou `Interaction` — c'est la
story 3.5 — et ne restreint aucune création ni modification. Un agent gère
le quotidien.

### File List

**Modifiés**
- `app/agency/properties/[id]/edit/page.tsx` — `requireAgencyAdmin()`, mise à la corbeille au lieu du `delete()` en cascade, `recordAudit()`, bouton conditionnel
- `app/agency/visits/[id]/edit/page.tsx` — `requireAgencyAdmin()`, `recordAudit()`, bouton conditionnel
- `app/agency/payments/[id]/edit/page.tsx` — `requireAgencyAdmin()`, `recordAudit()`, bouton conditionnel
- `app/agency/rental-management/[id]/edit/page.tsx` — `requireAgencyAdmin()` (arbitrage), `recordAudit()`, bouton conditionnel
- `app/agency/interactions/actions.ts` — reste `requireAgency()` (arbitrage assumé et motivé dans le code), `recordAudit()` ajouté comme contrepartie
- `tests/roles.spec.ts` — bloc « Suppression directe des écrans d'édition (BUG-32) », 3 cas, et le mécanisme de rejeu d'une Server Action liée
- `docs/architecture.md` — §1 corrigé (le middleware ne renvoie plus rien), §4 inventaire des Server Actions destructives, §9 état de santé
- `docs/qa/bug-report.md` — BUG-32 **[CONFIRMÉ]** puis corrigé, avec la preuve de la phase rouge
- `docs/README.md` — les bloquants nommés plutôt que comptés, BUG-32 retiré de la liste
- `docs/project-context.md` — quatrième piège corrigé (BUG-32 fermé, renvoi à l'inventaire), et le mécanisme de rejeu d'une Server Action ajouté aux pièges
- `docs/stories/deferred-work.md` — sept reports issus de la revue
- `docs/stories/sprint-status.yaml` — statut de la story

**Ajoutés en revue (12-08-2026)**
- `components/InteractionTimeline.tsx` — le bouton de suppression n'est rendu qu'à l'auteur de la ligne, ou à un administrateur
- `app/agency/clients/[id]/page.tsx`, `app/agency/owners/[id]/page.tsx` — passent l'identité du lecteur à la frise

### Review Findings

Revue adversariale du 12-08-2026, trois couches parallèles (chasseur à
l'aveugle, chasseur de cas limites, auditeur des critères d'acceptation),
menées sans le contexte de la session d'implémentation. **23 constats
retenus**, 3 écartés. Les trois couches ont convergé indépendamment sur le
même défaut central — et il est dans le test, pas dans le code.

**Décision requise (1)**

- [x] [Review][Decision] **Le code laisse un agent supprimer N'IMPORTE QUELLE interaction, alors que l'arbitrage écrit dit « celle qu'il vient de saisir »** — la justification portée dans `app/agency/interactions/actions.ts` et reprise dans `docs/architecture.md` est : « une ligne d'historique saisie par l'agent **lui-même**, **à l'instant** ; la réserver rendrait une faute de frappe ineffaçable pour **celui qui l'a commise** ». Le code, lui, fait `findFirst({ where: { id, agencyId } })` : aucun contrôle d'`authorId`, aucune fenêtre de temps. Un agent peut donc effacer définitivement l'interaction écrite par son administrateur, ou par un collègue, ou vieille de deux ans. Le modèle `Interaction` porte pourtant `authorId`. Le test qui « épingle » l'arbitrage n'éprouve qu'un agent supprimant sa propre ligne : il valide la promesse étroite pendant que le code applique la large. Trois issues — restreindre à `authorId`, assumer la portée large en réécrivant la justification, ou restreindre à une fenêtre de temps. [`app/agency/interactions/actions.ts:95`]

**À corriger (12)**

- [x] [Review][Patch] **L'assertion « LA SEULE ASSERTION QUI COMPTE » est tautologique pour le bien : elle ne peut pas voir une suppression réussie** — `db.property.count({ where: { id } })` renvoie **1** que la garde ait refusé **ou** que l'agent ait réussi à mettre le bien à la corbeille, puisque `deleteProperty` ne supprime plus la ligne mais pose `deletedAt`, et que `tests/db.ts` est le client brut, sans filtre. Le critère central de la story — « la ligne visée existe toujours en base après le refus » — n'est donc pas vérifié pour la seule des quatre actions dont l'échec est destructeur. **Preuve à charge dans le Debug Log lui-même** : la mutation `deleteProperty` est la seule ligne du tableau qui ne cite aucun message d'échec, les trois autres citant « un agent a supprimé … ». Elle n'a rougi que par l'assertion `soft` sur l'URL — celle que le commentaire voisin rétrograde explicitement. Correctif : `where: { id, deletedAt: null }`. **Gravité haute.** [`tests/roles.spec.ts:907`]
- [x] [Review][Patch] **La commande d'inventaire publiée ne reproduit pas l'inventaire** — `grep -rn "prisma\.[a-z]*\.delete(\|deletedAt: new Date()" app/agency` renvoie **8 lignes là où le motif correct en trouve 11**, et rate `prisma.rentalManagement.delete` — c'est-à-dire **une des cinq actions de cette story**, présente dans le tableau qu'elle est censée régénérer. Cause : `[a-z]*` ne matche pas un modèle camelCase, et `delete(` ne matche pas `deleteMany(`. Or l'AC 7 repose entièrement sur « le prochain écran se compare à cette liste » : un futur écran détruisant un modèle camelCase reçoit un feu vert silencieux. Vérifié par exécution. [`docs/architecture.md:160`]
- [x] [Review][Patch] **L'AC 5 est prouvé sur un écran sur quatre** — la seule paire d'assertions (bouton absent / `Enregistrer` présent) porte sur l'écran du bien. Retirer `isAgencyAdmin(userRole)` de `visits`, `payments` ou `rental-management` laisse la suite verte, alors que les Completion Notes généralisent aux quatre. Même trou pour le garde-fou « aucune action de mise à jour n'a été restreinte » : basculer `updateVisit` en `requireAgencyAdmin()` ne serait détecté nulle part. [`tests/roles.spec.ts:975`]
- [x] [Review][Patch] **`rejouer()` ne vérifie jamais qu'il rejoue depuis l'écran visé** — `page.goto(ecran)` sans contrôle d'atterrissage, puis injection d'un formulaire dont `action=""` se résout contre l'URL **courante**. Le jour où un agent serait renvoyé de l'écran d'édition — suite naturelle du masquage du bouton — le POST partirait de `/agency?error=…`, `waitForNavigation` se résoudrait, la ligne survivrait, et le test serait vert en ne prouvant rien. C'est exactement la classe de faux vert que le Debug Log dit avoir traversée une fois ; le remède posé ne couvre pas cette variante. [`tests/roles.spec.ts:868`]
- [x] [Review][Patch] **`docs/project-context.md` déclare toujours BUG-32 ouvert, au présent — dans le fichier que tous les agents BMAD chargent en premier** — « cinq Server Actions d'écrans d'édition **l'ont oublié** (BUG-32, story 4.6) ». Le même commit a pourtant marqué le défaut corrigé dans trois autres documents. La story a ajouté un point juste en dessous sans corriger celui-là. [`docs/project-context.md:145`]
- [x] [Review][Patch] **« Défauts ouverts : 18 sur 33 » est faux — le registre en compte 19** — recompté par exécution : 14 défauts portent « ✅ corrigé », soit 19 ouverts. La valeur précédente (19) était elle-même fausse d'une unité ; la story a propagé la dérive au lieu de la corriger alors qu'elle éditait cette ligne précise. [`docs/architecture.md:391`]
- [x] [Review][Patch] **« Séparation des rôles | complète » surestime ce qui a été prouvé** — la ligne annonce « 5 Server Actions destructives, prouvées par mutation ». Or l'une des cinq n'est **délibérément pas** séparée par rôle, et ce que sa mutation prouve est la propriété inverse. Un lecteur de la table de santé y lit « plus aucun écart de rôle » ; l'exception n'apparaît que 230 lignes plus haut. [`docs/architecture.md:388`]
- [x] [Review][Patch] **« ses photos … restent en base » n'est éprouvé par rien** — `garnir()` ne crée aucune `PropertyImage` (vérifié : zéro occurrence dans `tests/agence.ts`), et le contrôle positif ne compte que visite, vente, bail et échéance. L'affirmation figure pourtant dans le registre des défauts. Corriger le décor ou retirer la photo de la phrase. [`docs/qa/bug-report.md`]
- [x] [Review][Patch] **« il se restaure depuis /agency/trash » est affirmé comme vérifié ; seule sa présence dans la liste l'est** — le test lit le titre du bien sur l'écran de corbeille, ne soumet jamais la restauration et ne relit jamais `deletedAt`. La sous-tâche « Vérifier la restauration depuis /agency/trash » est pourtant cochée. [`tests/roles.spec.ts`]
- [x] [Review][Patch] **La sous-tâche « sprint-status.yaml → done » est cochée alors que le fichier dit `review`** — la liste de tâches se contredit avec le dépôt à l'intérieur d'un même commit. [`docs/stories/4-6-*.md`]
- [x] [Review][Patch] **La File List omet deux fichiers modifiés par la story** — `docs/README.md` (9 lignes) et `docs/project-context.md` (12 lignes) sont dans le commit et absents du relevé. [`docs/stories/4-6-*.md`]
- [x] [Review][Patch] **Le journal d'une interaction imprime l'énumération brute au lieu de son libellé** — `(${interaction.type})` rend « (rendez_vous) » dans une ligne lue par un humain, alors que `INTERACTION_TYPE_LABELS` est déjà utilisé pour la même valeur par le composant qui affiche cette ligne. La tâche 3 dit « un summary lisible » ; faute d'homologue d'API, rien n'a forcé le choix. Accessoirement, l'assertion de journal du contrôle positif sélectionne `entityId` et ne s'en sert pas. [`app/agency/interactions/actions.ts:112`]

**Reporté (7)**

- [x] [Review][Defer] **Mettre un bien à la corbeille repointe silencieusement ses visites et paiements au prochain enregistrement** — le `<select name="propertyId">` est bâti par le client étendu, qui masque les lignes `deletedAt`, tandis que `defaultValue` vise le bien devenu invisible : le navigateur retombe sur la **première** option. Un agent qui ouvre la visite et clique « Enregistrer » la rattache à un bien sans rapport, et le contrôle d'appartenance passe puisque ce bien est de la même agence. Antérieur — la route d'API mettait déjà à la corbeille — mais cette story ouvre un second chemin vers le même état, et ses Completion Notes annoncent « la visite … est toujours là » sans dire qu'elle est désormais orpheline d'un parent masqué. *Story à écrire.* — reporté, préexistant
- [x] [Review][Defer] **`recordAudit()` est au mieux best-effort, et c'est lui qui sert de contrepartie à la permission** — il avale ses erreurs et s'exécute **après** la suppression déjà validée. Une panne transitoire sur l'insertion produit une destruction définitive, par un agent, sans trace — seul un `console.error` côté serveur en témoigne. Les quatre chemins réservés héritent du même trou, mais un seul s'appuie sur le journal comme **justification** d'une permission. — reporté, préexistant (`lib/audit.ts`)
- [x] [Review][Defer] **Une seconde soumission concurrente lève `P2025` au lieu de retomber sur « introuvable »** — `findFirst` puis `delete` sans transaction, et les Server Actions n'ont aucun `try/catch` là où leurs homologues d'API répondent 500 JSON. Double-clic, deux administrateurs, ou un rejeu de POST par le navigateur suffisent ; l'exception remonte à la frontière d'erreur de Next et `recordAudit` ne s'exécute pas. — reporté, préexistant
- [x] [Review][Defer] **`deleteInteraction` sans champ `id` lève une erreur de validation Prisma au lieu de sa branche « introuvable »** — `formData.get("id") as string` vaut `null`, et `findFirst({ where: { id: null } })` échoue avant que le `if (!interaction)` puisse répondre. — reporté, préexistant
- [x] [Review][Defer] **`returnTo` n'est jamais validé, et c'est la seule action ouverte à tous les agents qui l'emprunte** — une valeur absolue (`https://…`) est passée telle quelle à `revalidatePath()` puis à `redirect()`, emportant l'utilisateur hors du site avec une bannière de succès. Aucun contrôle de barre oblique initiale, aucune liste blanche. — reporté, préexistant
- [x] [Review][Defer] **La moitié `super_admin` des quatre nouveaux masques `isAgencyAdmin(userRole)` est inatteignable** — `requireAgency()` renvoie un éditeur vers `/admin` avant tout rendu. La story ajoute quatre consommateurs d'une condition documentée comme morte (BUG-10) ; si la story 5.1 rend le dépannage possible, ce sont exactement ces quatre chemins qui auront été livrés sans test. — reporté, préexistant (BUG-10, story 5.1)
- [x] [Review][Defer] **Rien n'empêche de supprimer une échéance déjà réglée** — `isPaid`, `paymentDate` et `amountToOwner` ne sont ni lus ni contrôlés ; la contrainte d'unicité redevenant libre, une nouvelle ligne peut être créée pour la même période sans lien avec la disparue. La docstring de l'action nomme pourtant ce scénario — « l'erreur ne se voit qu'au moment du versement » — comme motif du contrôle de rôle, et le rôle est la seule condition vérifiée. — reporté, hors périmètre

**Résolution de la revue — 12-08-2026**

Les 13 constats actionnables sont traités, la décision rendue par
délégation. Deux mutations le prouvent, et ce sont les deux qui comptent :

| Mutation | Avant la revue | Après |
|---|---|---|
| `deleteProperty` → `requireAgency()` | 🔴 mais **par l'assertion `soft` sur l'URL** — le compte en base ne voyait rien | 🔴 **« un agent a supprimé bien par la Server Action »** — c'est le compte qui parle |
| contrôle d'auteur retiré de `deleteInteraction` | *n'existait pas* | 🔴 « un agent a effacé l'interaction écrite par son administrateur » |

**La décision : l'agent n'efface que ses propres lignes.** Vérifié avant
d'écrire que `createInteraction` pose `authorId` depuis toujours et que les
7 lignes existantes le portent — sans quoi la règle aurait retiré aux agents
le geste que l'arbitrage veut leur laisser. Un administrateur efface tout.
Une ligne sans auteur relève de l'administrateur. Le bouton de la frise
suit la même règle, et le serveur la revérifie.

**Ce que la revue a appris, au-delà des correctifs.** Les trois couches ont
convergé sur un défaut qui n'était pas dans le code mais dans la **preuve** :
`db.property.count()` renvoyait 1 que la garde ait refusé ou que l'agent ait
réussi, puisque la correction avait justement remplacé la suppression par une
mise à la corbeille. Le Debug Log portait la preuve à charge sans que
personne la lise — la ligne `deleteProperty` du tableau de mutation était la
seule à ne citer aucun message d'échec. **Une correction peut invalider la
mesure qui la démontre ; le tableau de mutation doit être lu, pas seulement
rempli.**

**Écarté (3)**

- La réécriture du §1 de `docs/architecture.md` appartient à la story 1.8, pas à celle-ci. Exact, et c'est une fuite de périmètre — mais le contenu a été vérifié exact et il est déclaré dans la File List. Corriger une dette de documentation en la croisant coûte moins que de la laisser fausse.
- `revalidatePath` ne rafraîchit qu'un chemin sur plusieurs après la mise à la corbeille : identique à ce que fait la route d'API homologue, dont cette story a pour consigne de ne pas s'écarter.
- « Les documents déclarent BUG-32 fermé alors que la story est en `review` » : c'est le cycle normal du dépôt — la documentation est écrite dans la story, la revue vient ensuite. Le constat est juste sur le fond mais vise le processus, pas ce commit.


### Change Log

- 12-08-2026 — story créée. Défaut n° 32 relevé hors des deux audits du 9 août, par relecture des 31 Server Actions.
- 12-08-2026 — phase rouge : défaut reproduit sur l'instance, un agent détruit le bien **et sa visite** par rejeu du POST. Un faux vert traversé et corrigé avant de conclure.
- 12-08-2026 — cinq gardes posés, cinq journaux, bien remis en corbeille, quatre boutons conditionnés. 5 mutations sur 5 rougissent. Inventaire écrit dans `docs/architecture.md`.
- 12-08-2026 — revue adversariale, trois couches parallèles : 23 constats, 1 décision, 12 correctifs, 7 reports. Le défaut central était dans la preuve, pas dans le code — l'assertion du bien ne pouvait pas distinguer un refus d'une mise à la corbeille réussie.
- 12-08-2026 — revue soldée : la suppression d'une interaction est restreinte à son auteur (le code rejoint sa justification), l'AC 5 est prouvé sur les quatre écrans, la restauration est réellement soumise, la commande d'inventaire corrigée après exécution. **103/103 verts**, `tsc` et `lint` propres. Story `done`.
