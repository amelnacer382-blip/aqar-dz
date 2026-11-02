---
baseline_commit: 902c1ed65b31d45224af3f0d2aaf221b6330dbb5
---

# Story 1.3: Protéger l'accès aux documents

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a agence,
I want que les pièces d'identité et actes que je dépose ne soient lisibles que par mes comptes,
so that une URL devinée ou partagée n'expose pas les papiers de mes clients.

**Couvre :** BUG-04 (défaut n° 01) et BUG-16 (défaut n° 26) · FR-02, NFR-01 · 🔴 à traiter comme critique, reproduit sur l'instance
**Spec manuscrite d'origine :** `docs/stories/story-03-acces-aux-documents.md` — matière première, pas source de vérité

## Acceptance Criteria

1. **Given** un document déposé dans `/uploads/documents/`
   **When** on le demande sans session, directement par son URL de fichier
   **Then** la réponse est 401 ou 404 — jamais le fichier

2. **Given** un document appartenant à l'agence A
   **When** un compte de l'agence B demande `/api/documents/{id}/file`
   **Then** la réponse est **404** — jamais 403, qui confirmerait l'existence du document

3. **Given** un compte de l'agence propriétaire
   **When** il demande `/api/documents/{id}/file`
   **Then** le fichier est servi avec son `Content-Type` réel, `Content-Disposition` portant le nom lisible saisi par l'agence, et `Cache-Control: private, no-store`

4. **Given** les photos de biens qui alimentent la vitrine publique
   **When** la protection est posée
   **Then** `/uploads/properties/` et `/uploads/agencies/` restent servis publiquement, sans session, par nginx comme aujourd'hui

5. **Given** un document dont l'`url` en base contient `..` ou pointe hors de `uploads/documents/`
   **When** un compte authentifié de l'agence propriétaire le demande
   **Then** la réponse est 404 et **aucun octet du système de fichiers n'est lu** — voir « Le piège n° 1 », c'est le point le plus important de cette story

6. **Given** les documents déjà déposés avant cette story
   **When** la protection est en place
   **Then** ils restent accessibles par le nouveau chemin, sans migration ni déplacement de fichier

7. **Given** `robots.txt`
   **When** on le lit
   **Then** `/uploads/documents/` est en `Disallow` — ce qui ferme aussi BUG-16
   > **Amendé à la revue du 10-08-2026.** Le critère disait `/uploads/` en
   > bloc. Les documents n'étant plus servis depuis ce chemin, la règle
   > élargie ne protégeait plus rien de plus, tandis qu'elle sortait
   > `/uploads/properties/` de l'index d'images — c'est-à-dire les photos
   > d'annonces de la vitrine, module désigné prioritaire.

8. **Given** la définition de « terminé » de `docs/project-context.md`
   **When** la story est close
   **Then** `npx tsc --noEmit` et `npm run lint` sont à 0 erreur, `npm run test:e2e` est vert, et au moins un test échouerait si la garde d'appartenance était retirée

## Tasks / Subtasks

- [x] **Tâche 1 — Rendre `lib/storage.ts` incapable de sortir de son dossier** (AC : 5)
  - [x] Ajouter une fonction interne `safeKey(key: string): string | null` qui **refuse** toute clé contenant `..`, commençant par `/`, ou dont le chemin résolu ne reste pas sous `public/uploads/`. Vérifier par résolution réelle (`resolve()` + test de préfixe), pas seulement par test de sous-chaîne
  - [x] Ajouter `readFile(key)` qui renvoie `{ buffer, contentType } | null` et passe par `safeKey` **avant** tout accès disque
  - [x] Faire passer `deleteFile(key)` par le même `safeKey` — c'est BUG-21, et le correctif est le même verrou. Le noter dans la story 1.7 plutôt que de le refaire
  - [x] `keyFromUrl()` reste tel quel : il décrit ce qui est stocké, il ne valide pas. C'est `safeKey` qui garde la porte

- [x] **Tâche 2 — Créer `app/api/documents/[id]/file/route.ts`** (AC : 1, 2, 3, 6)
  - [x] Motif imposé, identique aux routes PDF : `getApiAgency()` → `findFirst({ where: { id, agencyId } })` → 404 si absent → réponse
  - [x] 404 pour une autre agence, **jamais 403** : le reste du code applique déjà cette règle
  - [x] `Content-Type` : `document.mimeType` s'il existe, sinon celui déduit par `readFile`, sinon `application/octet-stream`
  - [x] `Content-Disposition: attachment; filename="…"` avec le nom **assaini** — réutiliser `sanitize()` de `lib/pdf/render.ts` (l'extraire dans `lib/format.ts` plutôt que le recopier)
  - [x] `Cache-Control: private, no-store`
  - [x] Un 5 Mo maximum est déjà imposé au dépôt : mettre le fichier en mémoire suffit, ne pas monter un flux

- [x] **Tâche 3 — Basculer les écrans vers la nouvelle route** (AC : 3, 6)
  - [x] `app/agency/documents/page.tsx:155` — `href={document.url}` → `/api/documents/${document.id}/file`
  - [x] `app/agency/documents/[id]/page.tsx:58` et `:107` — même bascule
  - [x] `app/agency/documents/[id]/page.tsx:113` affiche l'URL brute en texte : la remplacer par le nom du fichier, l'URL de stockage n'a plus à être montrée

- [x] **Tâche 4 — Fermer l'accès direct** (AC : 1, 4)
  - [x] `nginx/nginx.conf` — ajouter `location /uploads/documents/ { return 404; }` **avant** le bloc `/uploads/` dans le fichier (nginx choisit le préfixe le plus long, l'ordre ne change rien au comportement, mais la lecture du fichier en dépend)
  - [x] Vérifier que `/uploads/properties/` et `/uploads/agencies/` répondent toujours 200 sans session

- [x] **Tâche 5 — `robots.txt`** (AC : 7)
  - [x] `app/robots.ts:20` — ajouter `/uploads/documents/` à `disallow` (périmètre restreint à la revue, voir AC 7). Ferme BUG-16

- [x] **Tâche 6 — Tests de non-régression** (AC : 8)
  - [x] E2E : déposer un document en tant qu'`admin@aqar.dz`, appeler `/api/documents/{id}/file` connecté → 200 + bon `Content-Type`
  - [x] E2E : le même appel sans session → 401
  - [x] E2E : `curl` direct sur `/uploads/documents/<fichier>` → 404 (nginx) — **attention**, la suite e2e tourne sur `npm start` sans nginx : ce cas doit être vérifié séparément sur la pile Docker et consigné dans le Debug Log
  - [x] E2E : une photo de bien reste accessible sans session — **même limite que ci-dessus**, et elle n'était pas anticipée : `next start` fige l'inventaire de `public/` au démarrage, donc un fichier téléversé pendant le test répond 404 quoi qu'il arrive. Le test vérifie l'absence de 401/403 ; la preuve du 200 est relevée sur la pile Docker (Debug Log)
  - [x] E2E : un document dont l'`url` a été forcée à `/uploads/../.env` répond 404 et ne renvoie aucun contenu

### Review Findings

Revue adversariale du 10-08-2026 (`bmad-code-review`) — trois couches
indépendantes lancées sans mon contexte : Blind Hunter, Edge Case Hunter,
Acceptance Auditor. 2 décisions, 7 correctifs, 6 reports, 3 écartés.

**Décisions tranchées le 10-08-2026**

- [x] [Review][Decision] **Les fichiers de documents vivent dans un espace de noms plat, commun à toutes les agences** — `putFile` range tout dans `documents/<horodatage>-<aléa>.<ext>`, sans distinction d'agence. La route vérifie que la *ligne* `Document` appartient à l'agence, jamais le *fichier* qu'elle désigne. Une agence qui détient l'adresse d'un document d'une autre — le scénario exact de BUG-04 : adresse partagée, journalisée, indexée — la colle dans l'`url` d'un de ses propres documents et le télécharge en 200. Vérifié : `url = /uploads/documents/<fichier de B>` → clé `documents/<fichier de B>` → préfixe accepté → servi. Le correctif propre est un dossier par agence (`documents/<agencyId>/…`), qui touche le chemin d'écriture et les fichiers déjà déposés — donc l'AC 6.
- [x] [Review][Decision] **`Disallow: /uploads/` désindexe aussi les photos de vitrine** — l'AC 7 l'exige en toutes lettres, mais les documents ne sont plus servis depuis ce chemin : la règle ne protège plus rien qui ne le soit déjà, tandis qu'elle sort `/uploads/properties/` de Google Images. La vitrine est le module désigné prioritaire.

**Correctifs**

- [x] [Review][Patch] La traversée **latérale** franchit le verrou : `documents/../properties/photo-de-B.jpg` reste sous `public/uploads/` et passe `startsWith("documents/")` [lib/storage.ts:145 · app/api/documents/[id]/file/route.ts:57]
- [x] [Review][Patch] `verifiedPath` compare un chemin résolu à une racine qui ne l'est pas : `public/uploads` en lien symbolique fait répondre 404 à **tous** les documents [lib/storage.ts:105,164]
- [x] [Review][Patch] `lib/env.ts` se contredit — il recommande Supabase en production ligne 98 et refuse de démarrer avec ligne 123 : aucune configuration de production ne satisfait les deux [lib/env.ts:98,123]
- [x] [Review][Patch] `/uploads/documents/` reste servi par Next lui-même sur le port applicatif, que le middleware ne couvre pas — la protection ne tient qu'à nginx [middleware.ts:81]
- [x] [Review][Patch] `mimeType` est un champ texte libre injecté brut dans `Content-Type` : un CRLF y fait lever le constructeur `Headers` et rend le document définitivement illisible (500) [app/api/documents/[id]/file/route.ts:80]
- [x] [Review][Patch] `sanitizeFilename` ne garde que l'ASCII : tout document nommé en arabe se télécharge sous `fichier.pdf`. Cas nominal sur ce produit, pas cas limite. `filename*=UTF-8''…` (RFC 5987) n'est pas posé [lib/format.ts:120 · route.ts:71]
- [x] [Review][Patch] `storedFilename` réaffiche l'adresse de stockage complète quand l'`url` se termine par `/` — exactement ce que le commentaire dit vouloir cesser de montrer [app/agency/documents/[id]/page.tsx:28]

**Reportés**

- [x] [Review][Defer] Le port applicatif 3000 est publié hors de nginx — BUG-22, story 2.1
- [x] [Review][Defer] Une bascule de mode de stockage rend illisibles les documents déjà enregistrés, en silence
- [x] [Review][Defer] La page d'édition affiche et laisse modifier l'`url` en clair — BUG-21/23, story 1.7
- [x] [Review][Defer] Le test de l'AC 4 ne peut pas rougir (déjà tracé)
- [x] [Review][Defer] Les tests accumulent des données et `Date.now()` peut collisionner en parallèle
- [x] [Review][Defer] Un fichier de 0 octet est servi en 200 ; `target="_blank"` sur une réponse `attachment` laisse un onglet vide

**Écartés** — BUG-22 lu comme « corrigé » alors que la colonne dit « Confirmé » ; extension non assainie dans le nom de téléchargement (chemin non atteignable, l'agent l'a lui-même démontré) ; hôte ignoré dans une URL absolue (sans conséquence, le fichier reste confiné).

## Dev Notes

### Le piège n° 1 — cette story peut créer une faille pire que celle qu'elle ferme

**À lire avant d'écrire une ligne.** `Document.url` est une chaîne libre venue d'un champ caché du formulaire : `documentSchema.url` n'est qu'un `z.string().trim().min(1)` (`lib/validations/index.ts:365`). C'est BUG-21 / BUG-23, propriété de la story 1.7, **pas encore corrigé**.

Or la route de lecture doit forcément faire `keyFromUrl(document.url)` → lire le fichier. Et `keyFromUrl` capture tout :

```ts
url.match(/\/uploads\/(.+)$/)      // capture ".." compris
join(process.cwd(), "public", "uploads", "../../../etc/passwd")
```

Vérifié :

```
url stockée   : /uploads/../../../../etc/passwd
clé extraite  : ../../../../etc/passwd
chemin résolu : /home/ouazene/Dev/web/etc/passwd     ← hors du projet
```

Écrire la route sans verrou donnerait à tout administrateur d'agence une **lecture de fichier arbitraire sur le serveur**. `/uploads/../.env` suffirait à récupérer `NEXTAUTH_SECRET`, `DATABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`. On remplacerait une lecture non authentifiée de documents par une prise de contrôle complète.

**C'est la raison d'être de la tâche 1, et elle passe en premier.** `safeKey` doit résoudre le chemin et vérifier qu'il reste sous `public/uploads/` — un test de sous-chaîne sur `..` ne suffit pas (encodages, liens symboliques).

### Le piège n° 2 — le mode Supabase annule la protection

`putFile()` appelle `getPublicUrl()` : **le bucket est public**. En mode Supabase, l'URL enregistrée est directement lisible par quiconque la possède, et aucune route Next ne s'interpose. Bloquer nginx et créer la route protégée ne changerait rien.

Le bucket est unique (`SUPABASE_STORAGE_BUCKET`) et sert **aussi** les photos de biens, qui doivent rester publiques pour la vitrine. Le rendre privé casserait la vitrine.

**Ce mode n'est pas configuré sur cette installation** (`storageMode()` renvoie `local`, vérifié). Trois issues possibles, aucune n'est évidente — **voir les questions en fin de story, à trancher avant la tâche 1**. Ce qui est certain : livrer la story en laissant le mode Supabase silencieusement non protégé serait un mensonge. À défaut d'arbitrage, la position sûre est un refus au démarrage (`lib/env.ts`, comme pour le secret de session) quand le stockage Supabase est actif.

### Le piège n° 3 — un super admin ne pourra lire aucun document

`getApiAgency()` exige `session.user.agencyId`. Un `super_admin` n'est rattaché à aucune agence : il recevra **401**. C'est cohérent avec le fait que la story 5.1 (« un super admin doit-il pouvoir endosser une agence ? ») n'est pas tranchée, et c'est la position sûre par défaut.

**Ne pas contourner** en ajoutant une branche `super_admin` dans cette story : ce serait décider à la place du produit. Le noter dans les notes de complétion.

### État actuel — ce que la story touche

| Fichier | État aujourd'hui | Action |
|---|---|---|
| `lib/storage.ts` | `putFile`, `deleteFile`, `keyFromUrl`. Aucune validation de chemin | **ajouter** `safeKey` + `readFile` ; brancher `deleteFile` dessus |
| `app/api/documents/[id]/file/route.ts` | n'existe pas | **créer** |
| `app/agency/documents/page.tsx:155` | `href={document.url}` | basculer vers la route |
| `app/agency/documents/[id]/page.tsx:58,107,113` | idem + URL affichée en clair | basculer, et cesser d'afficher l'URL |
| `nginx/nginx.conf:59` | `location /uploads/` sert tout le dossier | **ajouter** un bloc qui refuse `documents/` |
| `app/robots.ts:20` | `disallow` sans `/uploads/` | ajouter |
| `middleware.ts` | ne couvre pas `/uploads/…` | **ne pas toucher** — en production c'est nginx qui répond, Next n'est jamais atteint |

### Motif à copier, littéralement

`app/api/pdf/property/[id]/route.tsx:23-38` fait déjà exactement la garde attendue :

```ts
const guard = await getApiAgency()
if (!guard.ok) {
  return NextResponse.json({ error: guard.error }, { status: guard.status })
}
const { id } = await params
const property = await prisma.property.findFirst({
  where: { id, agencyId: guard.agencyId },
})
if (!property) {
  return NextResponse.json({ error: "Bien introuvable" }, { status: 404 })
}
```

`params` est une **Promise** (Next 14 App Router) : `const { id } = await params`.

Et `lib/pdf/render.ts:28-33` porte déjà l'assainissement de nom de fichier pour `Content-Disposition` — il retire tout ce qui n'est pas `[a-zA-Z0-9._-]` et tronque à 80 caractères, ce qui neutralise l'injection d'en-tête par guillemet ou retour chariot. **Extraire cette fonction, ne pas en écrire une seconde.**

### Ce qui ne doit pas casser

- **La vitrine publique dépend de `/uploads/properties/`.** C'est le module désigné prioritaire. Un blocage trop large le casse et personne ne s'en aperçoit avant qu'un visiteur voie des images manquantes. Le test e2e `regression.spec.ts` « liste, filtre et fiche accessibles » couvre la vitrine — il doit rester vert.
- **`tests/documents.spec.ts`** contient deux cas dont un « … when authenticated » qui ne s'authentifie pas (BUG-28, story 4.1). Ne pas s'en inspirer, ne pas les corriger ici.
- **Le dépôt continue de passer par `/api/upload`** avec `folder: "documents"`. Cette story ne change pas le chemin d'écriture, seulement celui de lecture. Les fichiers déjà sur disque restent où ils sont (AC 6).

### Hors périmètre

- **BUG-21 / BUG-23** (URL de document non contrainte à l'écriture, lien `javascript:`) — story 1.7. La tâche 1 en pose le verrou côté lecture *et* suppression ; 1.7 gardera la validation à l'écriture et l'attribut `href`.
- **BUG-09** (type de fichier déclaré par le client à l'upload) — story 2.2.
- **La question du super admin** — story 5.1.

### Testing

Playwright uniquement (`npm run test:e2e`, projet `chromium`). Aucun runner unitaire installé — ne pas en ajouter.

Modèles sains : `tests/regression.spec.ts` et `tests/features.spec.ts`. Le helper `login(page, email)` de `regression.spec.ts:5` et `page.context().clearCookies()` pour se déconnecter (voir story 1.2 : ne pas passer par la page de déconnexion de NextAuth).

Pour les appels sans session, `page.request` porte les cookies du contexte : utiliser un **contexte neuf** (`browser.newContext()`) ou `request` en fixture séparée pour un vrai appel anonyme.

**Limite connue de l'environnement de test :** la suite tourne sur `npm start` (port 3002), **sans nginx**. L'AC 1 par accès direct au fichier ne peut donc pas être vérifiée par Playwright — en local, `/uploads/documents/x.pdf` est servi par Next depuis `public/`. Ce cas doit être vérifié à la main sur la pile Docker (`localhost:8095`) et le relevé consigné dans le Debug Log. Ne pas prétendre le contraire.

**Piège d'environnement, hérité de la story 1.2 :** après un `npm ci`, les navigateurs Playwright en cache peuvent ne pas correspondre à la version installée. Symptôme : des dizaines d'échecs sans rapport avec le code, seuls passant les tests qui n'ouvrent pas de navigateur. Remède : `npx playwright install chromium`.

### Ce qui vient de se passer dans le dépôt

Story 1.2 close (`3456faf`, revue `64b8b55`). Enseignements réutilisables :

- **Le test de mutation est devenu la norme ici.** Retirer la garde, vérifier que le test rougit, restaurer. Un test qui ne rougit pas ne protège rien.
- **Une branche jamais exercée est une branche cassée.** La détection de collision de la migration 1.2 ne compilait pas et personne ne l'aurait su, faute de collision réelle. Ici, l'équivalent est l'AC 5 : forcer une `url` malveillante en base pour exercer `safeKey`, sinon elle ne sera jamais éprouvée.
- **Convention de commit :** sujet `type(portée):` à l'impératif, corps expliquant le *pourquoi*, sans accents dans le message.
- Quatre reports ouverts dans `docs/stories/deferred-work.md`, dont l'accumulation d'agences par les tests — cette story crée des documents, même remarque.

### Project Structure Notes

Un seul fichier nouveau : `app/api/documents/[id]/file/route.ts`, qui suit la structure existante `app/api/documents/[id]/delete/route.ts`. Aucune dépendance à ajouter — `fs/promises` et `path` sont déjà importés par `lib/storage.ts`.

Aucune variance avec la structure décrite dans `docs/architecture.md`.

### References

- [Source: docs/epics.md#Story 1.3: Protéger l'accès aux documents] — critères d'acceptation
- [Source: docs/qa/bug-report.md#bug-04] — reproduction sur l'instance, analyse de l'URL secrète
- [Source: docs/qa/bug-report.md#bug-21] — la traversée de chemin par `document.url`, côté suppression
- [Source: docs/qa/bug-report.md#bug-16] — `robots.txt` et `/uploads/`
- [Source: docs/stories/story-03-acces-aux-documents.md] — spec manuscrite
- [Source: docs/project-context.md#Règles non négociables] — règle 2, motif de cloisonnement imposé
- [Source: docs/project-context.md#Définition de « terminé »] — portes de sortie
- [Source: docs/stories/deferred-work.md] — reports ouverts

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5[1m]`) — `bmad-dev-story`, 10-08-2026.

### Debug Log References

**Arbitrage du piège n° 2, tranché par l'éditeur (« je te laisse tranché ») :**
refus au démarrage en mode Supabase, implémentation cadrée sur le mode local.
Le second seau privé est reporté, tracé dans `deferred-work.md`.

**Vérification du refus au démarrage** — la seule preuve qui vaille est
d'essayer :

```
NODE_ENV=production SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
SUPABASE_STORAGE_BUCKET=aqar npx next start -p 3011

[config] ✖ Le stockage Supabase est actif, or son seau est public : …
Failed to prepare server Error: An error occurred while loading
instrumentation hook: Configuration invalide : 1 point(s) bloquant(s).

curl http://localhost:3011/                 -> 500
curl http://localhost:3011/api/public/health -> 500
```

Précision qui compte : le processus ne s'arrête pas, il affiche même
« Ready ». Mais le serveur n'est jamais préparé et **toute** requête
répond 500, sonde de santé comprise — le conteneur est donc marqué
*unhealthy* par Docker. C'est un refus effectif, pas une sortie propre.
Même mécanisme que la garde existante sur `NEXTAUTH_SECRET`.

**AC 1 et AC 4 sur la pile Docker** (`localhost:8095`, nginx réel, sans
session). Sondes déposées dans le volume `uploads_data`, puis retirées :

```
/uploads/properties/sonde.txt                     -> 200   (vitrine intacte)
/uploads/documents/sonde.txt                      -> 404   (nginx)
/uploads/documents/../documents/sonde.txt         -> 404
/uploads/documents%2Fsonde.txt                    -> 404
/uploads/DOCUMENTS/sonde.txt                      -> 404
```

Réserve sur la dernière ligne : `location` est sensible à la casse chez
nginx. Ce 404 vient du fichier absent sur un système de fichiers
sensible à la casse, **pas** du bloc de refus. Sur un volume monté en
casse indifférente, `/uploads/DOCUMENTS/` contournerait la règle. Le
volume est Linux, donc le point est théorique ici — il ne l'est plus le
jour d'une bascule.

**Tests de mutation** — deux gardes retirées tour à tour, reconstruction
et exécution ciblée à chaque fois :

| Mutation | Test | Résultat |
|---|---|---|
| `safeKey` **et** `verifiedPath` privés de leur contrôle de préfixe | « une url forgée ne fait lire aucun fichier du serveur » | **rouge** — 200 au lieu de 404, le `.env` du projet est servi |
| `where: { id, agencyId }` → `where: { id }` | « une autre agence reçoit 404, jamais 403 » | **rouge** — 200 au lieu de 404 |

Les deux gardes ont été restaurées et la suite repassée en entier.

Point relevé au passage : en mode **local**, les deux contrôles de chemin
se recouvrent — `realpath` seul suffirait. Le recouvrement est gardé
volontairement, `safeKey` étant le seul verrou en mode Supabase et le
seul à s'appliquer aux clés dont le fichier n'existe pas. C'est pourquoi
la mutation devait retirer les deux : n'en retirer qu'un ne rougit rien,
ce qui est le comportement attendu d'une défense en profondeur.

**Suite complète** — `73 passed`, `test-results/.last-run.json` :
`"status": "passed"`, `failedTests: []`. Le code de sortie a été relevé
directement, sans passer par un `tail` qui l'aurait masqué (leçon de la
story 1.2).

`npx tsc --noEmit` : 0 erreur. `npm run lint` : 0 erreur, 4 avertissements
`no-img-element` préexistants et sans rapport.

**Incident de manipulation, sans conséquence sur le livrable :** un
`git checkout -- lib/storage.ts` destiné à annuler une mutation a effacé
l'ensemble des ajouts du fichier. Ils ont été réécrits, puis `tsc`, la
suite complète et le diff ont confirmé l'état. Les mutations suivantes
ont été annulées par remplacement ciblé, jamais par `checkout`.

### Completion Notes List

**Ce qui a été fait au-delà de la lettre de la story, et pourquoi.**

1. **`deleteFile()` est passé sous le même verrou** (tâche 1, prévu) : la
   moitié « suppression de fichier arbitraire » de BUG-21 est donc close.
   La moitié « contraindre `url` à l'écriture » reste la story 1.7, qui
   n'est plus une correction de sécurité mais de justesse des données.

2. **L'extension réelle est rajoutée au nom téléchargé.** Le nom lisible
   saisi par l'agence — « Contrat de vente » — n'en porte pas. Assaini
   puis servi tel quel, le fichier arrivait sans extension et n'était
   ouvrable par aucun système. `Content-Disposition` porte donc
   `Contrat-de-vente.pdf`.

3. **`sanitizeFilename` renvoie « fichier » plutôt qu'une chaîne vide.**
   Un nom entièrement composé de caractères refusés (« ??? ») produisait
   `filename=""`, que chaque navigateur interprète à sa façon.

4. **`attachment` et non `inline`.** Un PDF ou une image servis en
   `inline` s'exécutent dans l'origine de l'application. Le bouton
   « Ouvrir » de la fiche a été renommé « Télécharger » pour ne pas
   promettre autre chose que ce qui se passe.

5. **`X-Content-Type-Options: nosniff` sur la réponse**, par symétrie avec
   ce que nginx pose déjà sur `/uploads/`.

**Décisions non prises, délibérément.**

- **Le super admin reçoit 401 sur tout document.** `getApiAgency()` exige
  une agence. Ne pas contourner ici relève de la story 5.1, non tranchée :
  c'est une décision produit, pas un détail technique.
- **Le mode Supabase est bloqué, pas réparé.** Le seau est public et
  partagé avec la vitrine. Le rendre privé casserait le module
  prioritaire ; ouvrir un second seau dépasse cette story. Le refus au
  démarrage est la position sûre en attendant — il vaut mieux un
  déploiement qui refuse de servir qu'une protection qui n'en est pas une.
- **`middleware.ts` n'a pas été touché**, comme la story le demandait :
  en production c'est nginx qui répond sur `/uploads/`, Next n'est jamais
  atteint.

**Ce qui n'est pas prouvé par la suite automatisée** — et qui doit être
rejoué à la main à chaque changement de `nginx.conf` : AC 1 et AC 4 par
accès direct au fichier. La suite tourne sans nginx, et `next start` fige
l'inventaire de `public/` au démarrage. Les relevés Docker sont
ci-dessus ; ils ne sont pas rejoués par la CI. Reporté vers l'épopée 4,
qui outille les tests.

### File List

**Modifiés**
- `lib/storage.ts` — `safeKey`, `verifiedPath`, `readFile` ; `deleteFile` sous verrou
- `lib/format.ts` — `sanitizeFilename`, extraite de `lib/pdf/render.ts`
- `lib/pdf/render.ts` — utilise `sanitizeFilename`, copie locale supprimée
- `lib/env.ts` — refus au démarrage quand le stockage Supabase est actif
- `app/agency/documents/page.tsx` — lien vers la route protégée
- `app/agency/documents/[id]/page.tsx` — lien vers la route protégée, URL de stockage retirée de l'affichage
- `app/robots.ts` — `/uploads/` en `disallow`
- `nginx/nginx.conf` — `location /uploads/documents/ { return 404; }`
- `tests/regression.spec.ts` — 4 tests, dont l'aide `createDocument`
- `docs/qa/bug-report.md` — BUG-04 et BUG-16 corrigés, BUG-21 à moitié
- `docs/stories/deferred-work.md` — 3 reports ajoutés
- `docs/stories/sprint-status.yaml` — statut et points d'attention

**Créés**
- `app/api/documents/[id]/file/route.ts`

### Révision après revue de code (10-08-2026)

La revue a trouvé ce que ma première passe avait manqué, et le constat
mérite d'être écrit sans détour : **je vérifiais que la clé ne sortait pas
de `public/uploads/`, jamais qu'elle appartenait à l'agence appelante.**
Deux propriétés différentes. Vérifié en exécutant la logique réelle :

```
url = /uploads/documents/../properties/photo-de-B.jpg
  → clé  documents/../properties/photo-de-B.jpg
  → startsWith("documents/")  vrai
  → safeKey                   accepté  (reste sous public/uploads/)
  → SERVI

url = /uploads/documents/<fichier d'une autre agence>
  → SERVI
```

Et par la route de suppression, la même URL forgée faisait **effacer** le
fichier d'une autre agence — irréversible. Ce que le registre affirmait
(« elle ne fait plus rien lire ni supprimer ») était vrai pour la moitié
hors `uploads/` et faux pour la moitié latérale.

**Pourquoi mes tests ne l'ont pas vu.** Ils n'exerçaient que les formes
qui *sortent* de la racine — le seul cas que le verrou arrêtait. Ils
confirmaient ce qui marchait au lieu d'attaquer ce qui ne marchait pas.
Le test de mutation lui-même était trompeur : il retirait la garde que je
venais d'écrire, pas celle qui manquait.

**Ce qui a changé.**

1. `lib/documents.ts` — nouvelle règle unique, partagée par la lecture et
   la suppression : le chemin porte l'agence (`documents/<agencyId>/…`).
   Les fichiers déposés à plat avant ce jour restent lisibles (AC 6), mais
   l'exception est refermée par une vérification en base — si une autre
   agence revendique la même adresse, c'est qu'elle l'a recopiée.
2. `safeKey` refuse désormais **tout** segment `..`, même retombant sous
   la racine.
3. `verifiedPath` résout aussi la racine : `public/uploads` en lien
   symbolique faisait répondre 404 à tous les documents.
4. `middleware.ts` renvoie 404 sur `/uploads/documents/`, avec une entrée
   de `matcher` dédiée — la première exclut les extensions d'image, or une
   pièce d'identité photographiée est un JPEG. La protection ne dépend
   plus de nginx, ni du port par lequel on entre (BUG-22).
5. `lib/env.ts` ne se contredit plus : il recommandait Supabase en
   production ligne 98 et refusait de démarrer avec ligne 123.
6. `safeMimeType` — le champ « Type MIME » est un texte libre ; un retour
   chariot y faisait lever la construction des en-têtes et rendait le
   document définitivement illisible.
7. `attachmentHeader` — `filename*=UTF-8''` (RFC 6266). Sans lui, tout
   document nommé en arabe se téléchargeait sous `fichier.pdf`. Sur ce
   produit, c'est le cas courant, pas le cas limite.

**Trois tests de mutation, cette fois sur les bonnes gardes :**

| Mutation | Test | Résultat |
|---|---|---|
| `documents/<agencyId>/` → `documents/` | « une autre agence reçoit 404 » | **rouge** — 200, l'agence voisine télécharge le document de l'agence de démonstration |
| garde middleware retirée | « le document est servi à l'agence, et à elle seule » | **rouge** — corps de 14 294 octets au lieu de 0 |
| verrous de chemin retirés (1re passe) | « une url forgée ne fait lire aucun fichier » | **rouge** — le `.env` du projet est servi |

**Gain collatéral :** l'AC 1 était relevé à la main sur la pile Docker,
faute de nginx dans l'environnement de test. La garde middleware le rend
observable sans proxy — un 404 à corps vide, là où Next renverrait sa
page 404 en HTML. Ce n'est plus un relevé, c'est un test.

Portes finales : `npx tsc --noEmit` 0 erreur, `npm run lint` 0 erreur,
**76 tests verts**, `.last-run.json` à `"status": "passed"`.

### Change Log

| Date | Version | Description |
|---|---|---|
| 10-08-2026 | 1.0 | Implémentation complète des 6 tâches, 8 AC couverts (AC 1 et 4 partiellement automatisés, voir Debug Log). Statut → `review`. |
| 10-08-2026 | 1.1 | Revue de code adversariale : cloisonnement des fichiers par agence, 7 correctifs, AC 7 restreint, AC 1 désormais automatisé. Statut → `done`. |
