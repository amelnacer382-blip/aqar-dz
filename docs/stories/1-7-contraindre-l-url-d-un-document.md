# Story 1.7: Contraindre l'URL d'un document

Status: done

## Story

As a plateforme,
I want qu'un document ne puisse référencer qu'un fichier déposé par sa propre agence,
so that la donnée cesse d'être une entrée utilisateur qu'il faut désamorcer à chaque lecture.

**Couvre :** BUG-21 (défaut n° 07) et BUG-23 (défaut n° 10) · NFR-01, NFR-02
**Précédée par :** story 1.3, qui a fermé les conséquences de ce défaut côté lecture et suppression

## Ce que cette story n'est plus

La spec d'origine confiait trois choses à cette story. **Deux sont déjà
faites**, et il faut le dire avant de replanifier du travail accompli :

| Critère d'origine | État réel |
|---|---|
| `deleteFile()` refuse `..` et les clés absolues, et journalise le refus | ✅ fait — story 1.3, `lib/storage.ts` |
| Sur un seau partagé, une agence ne retire que ses propres objets | ✅ fait — story 1.3, `lib/documents.ts` |
| Une URL `javascript:` ne doit pas être rendue cliquable (BUG-23) | ✅ fait — story 1.3 : plus aucun `href` ne reçoit `document.url` |

**Ce qui reste, et qui est le cœur du défaut :** `documentSchema.url` est
toujours `z.string().trim().min(1)` (`lib/validations/index.ts:396`). La
colonne reste une chaîne libre. Tout le reste du code doit donc s'en
méfier en permanence — c'est ce que fait `lib/documents.ts`, et c'est une
dette qu'on paie à chaque lecture.

Cette story ne rattrape pas une faille ouverte. Elle supprime la
**cause**, pour que les gardes posées en 1.3 cessent d'être la seule
chose qui tienne.

## Acceptance Criteria

1. **Given** un dépôt de document par une agence
   **When** le formulaire est envoyé
   **Then** l'`url` n'est acceptée que si elle désigne un fichier du dossier de **cette agence** (`/uploads/documents/<agencyId>/<fichier>`) — la forme seule ne suffit pas, l'appartenance est vérifiée côté serveur

2. **Given** une `url` bien formée mais désignant le dossier d'une **autre** agence
   **When** le formulaire est envoyé
   **Then** la création est refusée avec un message, et rien n'est écrit en base

3. **Given** la modification d'un document existant
   **When** le formulaire d'édition est envoyé
   **Then** l'`url` n'est pas modifiable : le fichier d'un document est fixé à son dépôt. Le champ disparaît de l'écran et la valeur postée, s'il y en a une, est ignorée

4. **Given** le champ « URL » de la page d'édition, aujourd'hui `type="url"` avec une valeur relative
   **When** on tente d'enregistrer une modification en mode local
   **Then** le formulaire s'envoie — c'est un défaut ouvert aujourd'hui : la validation HTML5 refuse une adresse relative, donc **la fiche d'un document n'est pas modifiable du tout**. La tâche 2 le referme en supprimant le champ

5. **Given** les documents enregistrés avant cette story, à plat dans `/uploads/documents/`
   **When** on les consulte, les télécharge ou les supprime
   **Then** rien ne change pour eux : la tolérance héritée de `lib/documents.ts` reste en place, et aucune migration n'est faite

6. **Given** le mode de stockage Supabase
   **When** la validation est posée
   **Then** elle accepte aussi l'adresse publique du seau configuré, sans quoi la validation rendrait ce mode inutilisable — même s'il est aujourd'hui refusé au démarrage en production

7. **Given** la définition de « terminé » de `docs/project-context.md`
   **When** la story est close
   **Then** `npx tsc --noEmit` et `npm run lint` sont à 0 erreur, `npm run test:e2e` est vert, et **au moins un test rougit si la vérification d'appartenance à l'écriture est retirée**

## Tasks / Subtasks

- [x] **Tâche 1 — Contraindre la forme de l'`url`** (AC : 1, 6)
  - [x] Dans `lib/validations/index.ts`, remplacer `url: z.string().trim().min(1)` par une contrainte de forme. Deux formes acceptées, et seulement deux :
    - interne : `/uploads/documents/<segment>/<fichier>` ou `/uploads/documents/<fichier>` (hérité)
    - Supabase : le préfixe public du seau configuré, si `SUPABASE_URL` et `SUPABASE_STORAGE_BUCKET` sont renseignés
  - [x] Lire l'environnement **directement** (`process.env`), sans importer `lib/storage.ts` : ce module tire `@supabase/supabase-js`, qui n'a rien à faire dans un fichier de schémas
  - [x] Le message d'erreur doit être lisible par une agence, pas par un développeur
  - [x] Ne pas réutiliser `parseGalleryUrls()` : son motif `^\/uploads\/[a-z]+\/[A-Za-z0-9._-]+$` interdit le sous-dossier par agence introduit en 1.3

- [x] **Tâche 2 — Rendre le fichier d'un document immuable** (AC : 3, 4)
  - [x] `app/agency/documents/[id]/edit/page.tsx` — supprimer le champ « URL » de l'écran, et valider avec `documentSchema.omit({ url: true })`
  - [x] Vérifier que `updateMany` n'écrit plus `url` : une valeur postée à la main ne doit rien changer
  - [x] C'est cette suppression qui referme l'AC 4 — ne pas « corriger » le `type="url"`, retirer le champ

- [x] **Tâche 3 — Vérifier l'appartenance à l'écriture** (AC : 1, 2)
  - [x] `app/agency/documents/new/page.tsx` — après `parseForm`, refuser toute `url` interne dont le dossier n'est pas celui de l'agence appelante. La forme est vérifiée par le schéma ; **l'appartenance ne peut l'être que là**, le schéma ne connaît pas l'agence
  - [x] Réutiliser la règle de `lib/documents.ts` plutôt que d'en écrire une seconde — y ajouter au besoin une fonction sœur qui ne consulte pas la base
  - [x] Refus par message d'erreur sur le formulaire, pas par 404 : ici l'utilisateur n'attaque pas, il voit son propre écran

- [x] **Tâche 4 — Confirmer que BUG-23 est bien clos** (AC : —)
  - [x] Vérifier qu'aucun `href`, `src` ou `window.open` ne reçoit `document.url` dans `app/agency/documents/**`
  - [x] Si c'est le cas, marquer BUG-23 corrigé au crédit de la story 1.3, sans écrire de code

- [x] **Tâche 5 — Tests** (AC : 7)
  - [x] E2E : dépôt normal → toujours accepté
  - [x] E2E : `url` forcée vers le dossier d'une autre agence → refus visible, aucun document créé
  - [x] E2E : `url` forcée vers `/uploads/properties/…` ou `javascript:alert(1)` → refus
  - [x] E2E : la fiche d'un document s'enregistre — elle ne le peut pas aujourd'hui (AC 4)
  - [x] Mutation : retirer la vérification d'appartenance de la tâche 3, vérifier qu'un test rougit, restaurer

### Review Findings

Revue adversariale du 10-08-2026 (`bmad-code-review`) — Blind Hunter,
Edge Case Hunter, Acceptance Auditor, lancés sans mon contexte.
0 décision, 7 correctifs, 4 reports, 2 écartés.

**Correctifs appliqués**

- [x] [Review][Patch] **Le refus n'était affiché nulle part.** `withError` écrit `?error=…`, mais ni la page de création ni celle d'édition ne lisaient `searchParams` : l'agence retombait sur un formulaire vierge, sans un mot, le fichier déjà téléversé perdu. Vingt et une autres pages du dépôt affichent leur retour via `<FormMessage />` — les deux pages « documents » étaient l'exception. L'AC 2 exige « refusée **avec un message** » : il était faux à l'écran et vert dans la suite. [app/agency/documents/new/page.tsx · [id]/edit/page.tsx]
- [x] [Review][Patch] **Une barre finale dans `SUPABASE_URL` refusait 100 % des dépôts.** `supabase-js` normalise sa base (`trim`, barre finale) avant de composer l'adresse publique ; la comparaison de préfixe, non. Vérifié contre la vraie sortie de `getPublicUrl` : les trois formes de base produisent la même URL, et seule la version corrigée les accepte toutes. [lib/validations/index.ts]
- [x] [Review][Patch] **La branche Supabase n'était bornée par rien.** Un simple `startsWith` laissait libre tout ce qui suit `documents/`, barres obliques et `%2e%2e` compris — que le garde `includes("..")` ne voyait pas. Le motif est désormais ancré de bout en bout, comme la forme interne. [lib/validations/index.ts]
- [x] [Review][Patch] **La tolérance « à plat » du schéma d'écriture était du code mort trompeur.** Elle acceptait une forme qu'`ownsDocumentUrl` rejetait systématiquement trois lignes plus loin. Un schéma d'écriture n'a pas à porter une compatibilité qui ne concerne que des lignes déjà écrites. Segment d'agence rendu obligatoire. [lib/validations/index.ts]
- [x] [Review][Patch] **`ownsDocumentUrl` s'appuyait sur `keyFromUrl`, dont le motif n'est pas ancré** — il retient la première occurrence de `/uploads/` où qu'elle soit. Correct tant que le schéma ancre en amont, faux dès qu'on appelle la fonction sans lui. Un contrôle de sécurité ne doit pas dépendre de l'ancrage d'un autre module : la comparaison porte maintenant sur l'adresse entière. [lib/documents.ts]
- [x] [Review][Patch] **Deux libellés différents pour un même refus**, l'un accentué, l'autre non. Constante unique `ADRESSE_REFUSEE`. [lib/validations/index.ts]
- [x] [Review][Patch] **Les tests étaient plus faibles qu'ils n'en avaient l'air.** `expect(arrivee).toContain("error")` était satisfait par n'importe quelle erreur de champ ; les charges de traversée avaient disparu sans remplacement, laissant le garde `..` sans couverture ; et `waitForLoadState("networkidle")` pouvait lire l'URL avant que la redirection d'une Server Action soit appliquée — rouge intermittent garanti. Assertions sur le message exact, sur son **affichage**, trois charges de traversée réintroduites, attente sur l'URL. [tests/regression.spec.ts]

**Reportés**

- [x] [Review][Defer] L'AC 5 (documents hérités) n'est plus vérifiable : cette story supprime le seul moyen de fabriquer une ligne à plat. Le chemin a été tracé à la main et il tient.
- [x] [Review][Defer] Un refus laisse un fichier orphelin sur le disque : le téléversement précède la validation. Antérieur à cette story, mais elle multiplie les chemins de refus.
- [x] [Review][Defer] `keyFromUrl` compose une expression régulière avec le nom du seau sans l'échapper — BUG-14, story 5.4.
- [x] [Review][Defer] Aucune couverture automatisée du mode Supabase : l'environnement de test tourne en local. Le motif a été confronté à la vraie sortie de `getPublicUrl`, à la main.

**Écartés** — le reproche fait au Debug Log de citer un message inexact : la trace relevée provenait bien du contrôle d'appartenance, dont le message est accentué, et non du schéma ; la citation était fidèle. Et le détournement de `keyFromUrl` par une URL portant deux chemins : la même fonction sert des deux côtés, donc aucun accès croisé — corrigé malgré tout, par principe.

## Dev Notes

### Le piège — la forme ne prouve rien, l'appartenance oui

`documentSchema` est un schéma Zod : il valide une chaîne isolée, sans
savoir qui l'envoie. Une agence peut donc écrire
`/uploads/documents/<agencyId-d-une-autre>/x.pdf`, parfaitement bien
formé. **La contrainte de forme seule ne ferme rien** — elle réduit
seulement l'espace des valeurs absurdes.

C'est exactement l'erreur commise en 1.3 : vérifier une propriété
adjacente et croire avoir vérifié la bonne. La tâche 3 est donc la
tâche essentielle, la tâche 1 n'est que l'hygiène qui la rend lisible.

### Ce qui protège déjà, et qui doit continuer

`lib/documents.ts` garde la lecture et la suppression. Cette story **ne
le remplace pas** : elle empêche la donnée sale d'entrer, il continue
d'empêcher la donnée sale déjà entrée de nuire. Les deux restent, et le
second ne pourra être allégé que le jour où plus aucune ligne ne porte
d'adresse à plat.

### Ce qui ne doit pas casser

- **Les documents déjà déposés** (AC 5). Il y en a en base, dont ceux
  créés par la suite de tests. Aucune migration.
- **`/api/upload`** n'est pas touché : il range déjà les documents par
  agence depuis la revue de la story 1.3.
- **La page de création** doit rester utilisable par une agence qui
  téléverse normalement : le champ caché reçoit une URL que le serveur
  vient de produire, elle doit passer sans friction.

### Testing

Playwright uniquement (`npm run test:e2e`, projet `chromium`). L'aide
`createDocument(page, nom, urlForgée)` de `tests/regression.spec.ts`
existe déjà et sert exactement à ça — elle écrit dans le champ caché par
le setter natif, ce qui est le vecteur réel.

Piège connu : après un `npm ci`, `npx playwright install chromium`.

### References

- [Source: docs/epics.md#Story 1.7] — critères d'origine
- [Source: docs/qa/bug-report.md#bug-21] — suppression arbitraire, moitié déjà close
- [Source: docs/qa/bug-report.md#bug-23] — `href` et `javascript:`, déjà clos
- [Source: docs/stories/1-3-proteger-l-acces-aux-documents.md#Review Findings] — pourquoi la vérification d'appartenance est le cœur
- [Source: app/agency/properties/gallery.ts] — motif voisin, volontairement non réutilisé

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5[1m]`) — `bmad-dev-story`, 10-08-2026.

### Debug Log References

**Le correctif a rendu trois tests irréalisables, et c'est le signe qu'il
marche.** Les tests de la story 1.3 qui forgeaient une `url` pour prouver
que la *lecture* refusait ne peuvent plus créer leur mise en scène : le
dépôt les rejette d'abord. Ils échouaient sur `waitForURL`, en arrivant
sur `/agency/documents/new?error=Le fichier doit être téléversé depuis ce
formulaire`.

Deux d'entre eux ont été **retirés**, avec le motif écrit dans le fichier
de tests : ils ne testaient plus la garde, ils testaient le formulaire.
Le troisième a été converti en refus au dépôt — une garantie plus forte.

**Ce qui est perdu, et qu'il faut dire.** `lib/documents.ts` et le verrou
de chemin de `lib/storage.ts` n'ont plus de couverture de bout en bout :
aucun chemin de l'interface ne peut plus produire la donnée qu'ils
arrêtent. Ils restent nécessaires — ils protègent les lignes écrites
avant aujourd'hui, et tout futur chemin d'écriture qui oublierait la
vérification — mais ils sont désormais de la défense en profondeur sans
filet. Consigné dans `deferred-work.md`.

**Test de mutation.** En remplaçant `documents/${agencyId}/` par
`documents/` dans `ownsDocumentUrl`, le dépôt visant le dossier d'une
autre agence aboutit : `« /agency/documents?success=Document ajoute »` au
lieu du refus. Le test rougit. Restauré, suite complète repassée.

Deux tentatives de mutation antérieures ont échoué **pour la mauvaise
raison** — `lint` refusait le code muté (`no-unused-vars`,
condition constante), ce qui empêchait la construction et faisait passer
le test pour rouge sans qu'il ait été exécuté. Une mutation qui casse la
compilation ne prouve rien ; il a fallu en écrire une qui compile.

Portes : `npx tsc --noEmit` 0 erreur, `npm run lint` 0 erreur,
**77 tests verts**, `.last-run.json` à `"status": "passed"`.

### Completion Notes List

1. **La forme et l'appartenance sont deux contrôles distincts, et un seul
   ferme le défaut.** `documentSchema` valide une chaîne isolée : il ne
   sait pas qui la poste, donc `/uploads/documents/<une-autre-agence>/x.pdf`
   le satisfait. C'est `ownsDocumentUrl`, appelé dans l'action de
   création où l'agence est connue, qui tranche. La contrainte de forme
   n'est que l'hygiène qui rend la règle lisible.

2. **Le champ « URL » de la page d'édition a été supprimé, pas réparé.**
   Il était à la fois le vecteur d'écriture de la faille et un défaut
   ouvert : un `type="url"` portant une adresse relative fait refuser
   l'envoi par le navigateur, donc **la fiche d'un document ne
   s'enregistrait pas du tout** en mode local. Le fichier d'un document
   est désormais fixé à son dépôt — changer de fichier, c'est déposer un
   autre document. Un test le prouve.

3. **BUG-23 était déjà clos.** Vérifié : plus aucun `href`, `src` ou
   `window.open` ne reçoit `document.url` dans `app/agency/documents/**`
   — la story 1.3 les avait tous basculés vers la route protégée. Aucun
   code écrit pour ce défaut ; il est marqué corrigé au crédit de 1.3.

4. **Le mode Supabase reste accepté par la validation** alors qu'il est
   refusé au démarrage en production. Les deux ne se contredisent pas :
   la validation ne doit pas devenir le second obstacle à lever le jour
   où le seau privé sera ouvert.

5. **Aucune migration.** Les documents déjà déposés à plat gardent leur
   adresse et restent lisibles par la tolérance héritée de
   `lib/documents.ts`. Elle ne pourra être retirée que le jour où plus
   aucune ligne ne porte d'adresse sans sous-dossier.

### File List

**Modifiés**
- `lib/validations/index.ts` — `documentUrl` : deux formes acceptées, plus rien d'autre
- `lib/documents.ts` — `ownsDocumentUrl`, variante d'écriture sans accès à la base
- `app/agency/documents/new/page.tsx` — vérification d'appartenance après `parseForm`
- `app/agency/documents/[id]/edit/page.tsx` — champ « URL » retiré, `documentSchema.omit({ url: true })`
- `tests/regression.spec.ts` — 3 tests ajoutés, 2 retirés avec motif, 1 converti
- `docs/qa/bug-report.md` — BUG-21 et BUG-23 corrigés
- `docs/stories/deferred-work.md` — perte de couverture consignée
- `docs/stories/sprint-status.yaml` — statut

### Change Log

| Date | Version | Description |
|---|---|---|
| 10-08-2026 | 1.0 | Contrainte de forme et vérification d'appartenance à l'écriture ; fichier d'un document rendu immuable. Statut → `review`. |
| 10-08-2026 | 1.1 | Revue de code : affichage des refus, mode Supabase corrigé et ancré, schéma d'écriture débarrassé de sa tolérance morte, tests renforcés. Statut → `done`. |
