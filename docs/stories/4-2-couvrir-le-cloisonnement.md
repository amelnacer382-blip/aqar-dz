# Story 4.2: Couvrir le cloisonnement inter-agences

Status: done

## Story

As a éditeur,
I want qu'un test échoue si une agence peut voir les données d'une autre,
so that la propriété la plus critique du produit soit protégée par autre chose qu'une relecture.

**Couvre :** lacune NFR-07 · **Nouveau fichier :** `tests/tenancy.spec.ts`

## Le défaut : ce n'en est pas un, c'est un angle mort

Rien ne dit que le cloisonnement soit cassé. Ce qui manque, c'est la
preuve qu'il tient — et c'est la propriété qui fait vivre ou meurt le
produit. Un multi-tenant qui fuit une fois ne se répare pas par un
correctif : il se répare par des excuses à chaque client.

L'état actuel, relevé précisément :

- **Un seul cas** couvre du cloisonnement : « le document de l'agence est
  servi à l'agence, et à elle seule » (`regression.spec.ts`, story 1.3),
  et il n'a même pas de seconde agence — il forge une `url` pointant un
  identifiant d'agence inventé.
- **Aucun** des huit exports, **aucune** des cinq routes PDF, **aucune**
  des huit routes de suppression, **aucune** page de détail n'est
  éprouvée avec une donnée réellement détenue par une autre agence.

C'est-à-dire que la règle « `findFirst({ id, agencyId })` puis 404 »,
appliquée à la main dans des dizaines de fichiers, n'est vérifiée nulle
part. Un seul oubli — un `findUnique({ id })` là où il fallait
`findFirst` — ouvre la fuite sans qu'aucun test ne bouge.

## Ce que je tranche, et pourquoi

### La seconde agence est créée par le test, pas ajoutée au seed

L'épopée le prescrit, et c'est le bon choix. Une seconde agence dans
`prisma/seed.ts` deviendrait un décor permanent que toute la suite
traverse : les compteurs de la console d'administration changent, les
statistiques changent, et le jour où un test échoue on ne sait plus si
c'est à cause d'elle. Le test crée son agence, la remplit, et la
**supprime en fin de parcours**.

### Elle est créée par Prisma, pas par l'interface

Douze entités liées à créer — bien, propriétaire, client, visite, vente,
location, quittance, paiement, message, document. Les poser par
l'interface prendrait plusieurs minutes et testerait les formulaires,
qui ne sont pas le sujet. **Le décor n'est pas ce qu'on éprouve** : ce
qu'on éprouve, c'est le chemin de lecture de l'agence A. Il est donc
légitime — et plus honnête — de bâtir le décor par le chemin le plus
court.

Le nettoyage tient en deux appels : `Agency` cascade sur tout
(`onDelete: Cascade` sur chaque enfant), sauf `User` qui est en
`SetNull` et qu'il faut donc supprimer à part. Un orphelin resterait
sinon à chaque exécution.

### Quatre surfaces, et le motif attendu pour chacune

| Surface | Ce qui est demandé | Attendu |
|---|---|---|
| Pages de détail (17) | l'`id` d'une ressource de B | la page introuvable, et **aucune donnée** — voir plus bas, le statut n'est pas 404 |
| Routes PDF (5) | `/api/pdf/{property,payment,receipt,rental-contract,sale-contract}/<idB>` | **404** |
| Routes de suppression (8) | `POST /api/{entite}/<idB>/delete` | refus **et la ligne de B existe toujours** |
| Exports (8) | `/api/export/<entite>` en tant que A | **200**, et aucune trace de B dedans |

**404 et non 403, et ce n'est pas un détail de style.** Un 403 confirme
que la ressource existe : il transforme la page de détail en oracle
d'existence, par lequel on énumère les identifiants d'un concurrent. La
règle est écrite ainsi dans le code depuis la story 1.3 ; ce test la
verrouille — **sur les routes d'API**.

**Sur les pages, j'avais tort, et je l'ai écrit avant de le mesurer.**
Les dix-sept pages appellent bien `notFound()`, elles affichent bien la
page introuvable — avec un statut **200**. Le rendu est diffusé en flux :
l'en-tête part avant que le composant serveur ait fini de décider. Une
adresse ne correspondant à aucune route rend bien 404, parce que Next
tranche avant tout rendu. C'est la même leçon que la mutation C de la
story 4.1, un jour plus tôt, à un autre endroit.

Le test assert donc la **substance** sur les pages — la page introuvable
est rendue, le marqueur de la voisine n'apparaît nulle part — et le
statut sur les routes d'API, où il est fiable. Le 200 sur une page
inexistante est un défaut à part entière ; il est reporté.

**Les exports n'ont pas d'identifiant, donc pas de vecteur direct.**
`/api/export/[entity]` lit toujours l'agence de la session. La propriété
à vérifier n'est donc pas un 404 mais une **absence** : l'export de A ne
doit contenir aucune ligne de B. C'est le seul endroit où le test doit
lire le contenu plutôt que le code de réponse.

**La suppression doit être vérifiée en base, pas au code de retour.** Un
refus qui aurait quand même supprimé se lit 404 tout pareil. Chaque
tentative est donc suivie d'une relecture de la ligne de B.

### Le marqueur qui rend l'absence prouvable

Toutes les données de B portent un jeton unique par exécution
(`CLOISON-<horodatage>`) dans un champ qui **ressort dans l'export** :
titre du bien, nom du client, etc. Chercher ce jeton dans les huit CSV
est alors une preuve, pas une approximation — contrairement à un
« Dupont » qui pourrait exister des deux côtés.

### Ce que je ne fais pas

- **La séparation des rôles** (story 4.3). Un agent de A face aux
  actions réservées de A est une autre question ; l'y mêler rendrait les
  deux illisibles.
- **Les routes `[id]` de la table de la story 4.1.** Elles y restaient
  hors table faute de donnée ; ce fichier les couvre pour l'agence
  **voisine**, pas pour la sienne. La distinction est écrite dans les
  deux fichiers.

## Acceptance Criteria

1. **Given** deux agences actives, chacune avec un jeu d'entités complet
   **When** un compte de A demande une page de détail de B
   **Then** il obtient 404, jamais 403 et jamais la donnée

2. **Given** les cinq routes PDF
   **When** A demande celle d'une ressource de B
   **Then** chacune répond 404, et aucune n'émet de PDF

3. **Given** les huit routes de suppression
   **When** A les appelle sur une ressource de B
   **Then** chacune refuse **et** la ligne de B est toujours présente en base après coup

4. **Given** les huit exports
   **When** A les demande
   **Then** chacun répond 200 et aucun ne contient le marqueur de B

5. **Given** l'agence créée par le test
   **When** le parcours se termine
   **Then** elle est supprimée, utilisateur compris — aucun orphelin

## Tasks / Subtasks

- [x] **1. Décor : une seconde agence complète** (AC 1-5)
  - [x] `beforeAll` Prisma : agence, utilisateur, propriétaire, bien, client, visite, vente, location, quittance, paiement, message, document
  - [x] Marqueur unique par exécution dans les champs exportés
  - [x] `afterAll` : suppression de l'agence (cascade) et de l'utilisateur (SetNull)

- [x] **2. Pages de détail** (AC 1)
  - [x] Table des neuf routes de détail, 404 attendu, message nommant la route

- [x] **3. Routes PDF** (AC 2)
  - [x] Les cinq, 404 attendu, et rien qui ressemble à un PDF dans le corps

- [x] **4. Routes de suppression** (AC 3)
  - [x] Les huit, refus **et** relecture en base après chaque tentative

- [x] **5. Exports** (AC 4)
  - [x] Les huit, 200, et absence du marqueur

- [x] **6. Vérification par mutation**
  - [x] Remplacer un `findFirst({ id, agencyId })` par `findFirst({ id })` sur une page de détail → le test de détail doit rougir
  - [x] Retirer le filtre d'agence d'un export → le test d'export doit rougir
  - [x] Retirer le filtre d'agence d'une route de suppression → le test de suppression doit rougir, **et sur la relecture en base**, pas seulement sur le code

## Dev Notes

**`lib/prisma.ts` filtre les lectures.** Le client est étendu d'un filtre
de suppression réversible sur `Property`, `Client` et `Owner`. Les
écritures et les suppressions n'en dépendent pas ; les relectures de
l'AC 3 sur ces trois modèles doivent en tenir compte — une ligne
« encore là » mais marquée `deletedAt` ressortirait introuvable et
donnerait un vert mensonger.

**`Agency.onDelete: Cascade` partout, sauf `User` en `SetNull`.**
Supprimer l'agence sans supprimer l'utilisateur laisse un compte sans
agence, qui s'accumule à chaque exécution et qu'`/admin/users` affichera.

**Le marqueur doit ressortir dans le CSV.** Vérifier `lib/csv.ts` et les
colonnes réellement exportées par entité : un marqueur posé dans un champ
que l'export ne rend pas rendrait l'AC 4 tautologique.

**404 partout, et une seule exception connue à surveiller :** une route
qui répondrait 403 signalerait que le cloisonnement passe par un contrôle
de droit plutôt que par un filtre de requête. C'est exactement ce qu'on
ne veut pas ; le test doit donc distinguer les deux codes et non accepter
« tout sauf 200 ».

## Dev Agent Record

### Context Reference

`docs/epics.md` (story 4.2), `prisma/schema.prisma`,
`app/api/export/[entity]/route.ts`, les cinq `app/api/pdf/*/[id]/route.tsx`,
les huit `app/api/*/[id]/delete/route.ts`, les dix-sept pages `[id]`,
`middleware.ts`, `app/not-found.tsx`.

### Implementation Plan

1. `tests/db.ts` — client Prisma brut pour les tests.
2. `tests/tenancy.spec.ts` — décor par test, cinq cas, contrôles inclus.
3. Mutations sur les trois familles de garde.

### Debug Log

**Le test a rougi du premier coup sur dix-sept routes, et j'ai bien cru
avoir trouvé une fuite totale.** Toutes les pages de détail de la voisine
répondaient `200` à l'agence A. Vérification avant de crier : l'assertion
sur le marqueur, elle, ne rougissait **pas** — donc aucune donnée ne
sortait. Les pages rendaient « Cette page n'existe pas » avec un statut
200, effet du rendu en flux. Le cloisonnement tenait ; c'est mon
assertion qui était fausse.

Deux choses à en retenir. La première : j'avais écrit « 404 exactement »
dans la story, dans l'en-tête du fichier et dans dix-sept assertions,
**sans jamais l'avoir mesuré**. La seconde : c'est la leçon de la
mutation C de la story 4.1 — un `200` ne dit rien de ce qui est rendu —
reproduite le lendemain, à un autre endroit, sans que je la reconnaisse.

**Et le nom du test a menti pendant dix minutes.** Il s'appelait encore
« répond 404, jamais 403 » alors qu'il n'assertait plus ni l'un ni
l'autre : le défaut exact que la story 4.1 venait de supprimer dix-sept
fois. Renommé.

**Une mutation cassée par le lint, encore.** Retirer `agencyId` d'un
`where` le rend inutilisé, et `@typescript-eslint/no-unused-vars` fait
échouer la construction. Une mutation qui ne compile pas ne prouve rien ;
reformulée en `...(false ? { agencyId } : {})`, qui garde la référence et
supprime le filtre.

**Nettoyage vérifié en base**, pas supposé : après la suite complète,
`0` agence `cloison-*` et `0` compte `agency_admin` orphelin.

### Completion Notes

**85 tests passés** (80 avant, +5). Trois mutations tuées :

| Mutation | Test devenu rouge |
|---|---|
| `findFirst({ id })` sur la fiche d'un bien | pages de détail — sur les **deux** assertions, page introuvable absente *et* marqueur présent |
| filtre d'agence retiré de l'export `clients` | exports |
| filtre d'agence retiré de `/api/visits/[id]/delete` | suppressions — dont la **relecture en base**, qui est celle qui compte |

Chaque mutation n'a fait rougir que sa route : les assertions sont bien
indépendantes.

**Couverture ajoutée :** 17 pages de détail et de modification, 5 routes
PDF, 8 routes de suppression (avec relecture en base), 8 exports — soit
38 surfaces, contre une seule auparavant, qui n'avait même pas de seconde
agence.

### File List

- `tests/tenancy.spec.ts` *(nouveau)*
- `tests/db.ts` *(nouveau)*
- `docs/stories/sprint-status.yaml`

### Review Findings

**1. Mon test de suppression passait aussi bien avec huit routes
cassées.** Vingt-quatre assertions vertes — 404 attendu, ligne intacte —
qu'une route répondant 404 à *tout le monde* aurait satisfaites à
l'identique. C'est mot pour mot le reproche que la story 4.1 adresse aux
dix-sept cas de BUG-28, et je venais de le refaire. Un contrôle a été
ajouté : la voisine supprime sa propre visite, et la ligne disparaît
vraiment. Il passe en dernier — il détruit sa cible.

**2. Les deux autres familles avaient leur contrôle dès l'écriture** —
la voisine ouvre ses dix-sept pages et ses cinq PDF, son export contient
le marqueur. C'est ce qui empêche l'assertion d'absence d'être vraie sans
rien prouver. Le seul oubli était la suppression, et il n'était pas
visible tant qu'on ne se demandait pas « qu'est-ce qui rendrait ce test
vert à tort ? ».

**3. Reporté : une page qui n'existe pas répond 200.** Découvert ici, sans
conséquence sur le cloisonnement, mais réel — un moniteur, un robot
d'indexation et un cache lisent « tout va bien » sur dix-sept pages
introuvables.

### Change Log

- 11-08-2026 — story créée, implémentée, testée (85 verts), 3 mutations tuées.
- 11-08-2026 — revue : contrôle ajouté sur les suppressions, en-tête et nom de test corrigés.
