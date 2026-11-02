---
baseline_commit: 4fdbd8be28c11d0b59ec10f484c8ec80b19260bf
---

# Story 1.2: Normaliser les adresses email

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur d'une agence,
I want me connecter avec mon adresse email quelle que soit la casse,
so that je ne perde pas définitivement l'accès à mon compte pour une majuscule.

**Couvre :** BUG-01 (défaut n° 02 de l'audit) · FR-01 · 🔴 Critique, reproduit sur l'instance
**Spec manuscrite d'origine :** `docs/stories/story-01-normalisation-email.md` — matière première, pas source de vérité

## Acceptance Criteria

1. **Given** un compte créé avec `Contact@ImmoAlger.dz`
   **When** l'utilisateur saisit `contact@immoalger.dz`, `CONTACT@IMMOALGER.DZ` ou la casse d'origine
   **Then** la connexion réussit dans les trois cas

2. **Given** un compte existant
   **When** l'utilisateur demande une réinitialisation avec une casse différente de celle enregistrée
   **Then** le jeton est créé et l'email part (vérifiable en base ; l'écran répond volontairement la même chose dans tous les cas)

3. **Given** une adresse déjà prise dans une autre casse
   **When** quelqu'un s'inscrit avec
   **Then** la réponse est « Cet email est déjà utilisé » en HTTP 400, jamais une erreur 500

4. **Given** une inscription avec ` Test@Exemple.dz ` (espaces de bord, casse mixte)
   **When** le compte est créé
   **Then** `users.email` **et** `agencies.email` valent tous deux `test@exemple.dz`

5. **Given** des comptes déjà en base contenant des majuscules ou des espaces de bord
   **When** la migration `normalize_user_emails` s'exécute
   **Then** les adresses de `users` et de `agencies` sont normalisées et leurs propriétaires se connectent sans intervention

6. **Given** deux lignes qui se replieraient sur la même adresse une fois normalisées
   **When** la migration s'exécute
   **Then** elle s'arrête en listant les adresses en conflit, **avant** de heurter la contrainte d'unicité — l'arbitrage est humain, il n'est pas automatisable

7. **Given** que `app/api/auth/register/route.ts` redéfinit son propre `registerSchema`
   **When** la correction est appliquée
   **Then** le doublon a disparu au profit du schéma unique de `lib/validations/index.ts`

8. **Given** la définition de « terminé » de `docs/project-context.md`
   **When** la story est close
   **Then** `npx tsc --noEmit` et `npm run lint` sont à 0 erreur, `npm run test:e2e` est vert, et au moins un test échouerait si la normalisation était retirée

## Tasks / Subtasks

- [x] **Tâche 1 — Normaliser les trois schémas d'entrée** (AC : 1, 2, 4)
  - [x] `lib/validations/index.ts:160` — `loginSchema.email` : ajouter `.trim().toLowerCase()` avant `.email()`
  - [x] `lib/validations/index.ts:166` — `registerSchema.email` : idem
  - [x] `app/auth/forgot/actions.ts:11` — le schéma local a déjà `.trim()`, il lui manque `.toLowerCase()`
  - [x] **Ne pas toucher** `agencyUserSchema` (`lib/validations/index.ts:445`) : il est déjà correct, c'est la référence à imiter

- [x] **Tâche 2 — Supprimer le schéma dupliqué de la route d'inscription** (AC : 3, 4, 7)
  - [x] `app/api/auth/register/route.ts:9-16` — supprimer le `registerSchema` local
  - [x] Importer celui de `@/lib/validations` ; retirer l'import `zod` s'il ne sert plus qu'au `catch (error instanceof z.ZodError)` — **il y sert encore, garder `z`**
  - [x] Vérifier que `validated.email` alimente bien **les deux** écritures : `agency.email` (ligne 111) et `user.email` (ligne 124)

- [x] **Tâche 3 — Migration `normalize_user_emails`** (AC : 5, 6)
  - [x] Créer `prisma/migrations/<horodatage>_normalize_user_emails/migration.sql`
  - [x] Détecter les collisions sur `users` **et** `agencies` avant toute écriture ; `RAISE EXCEPTION` avec la liste
  - [x] Sinon `update ... set email = lower(btrim(email)) where email <> lower(btrim(email))`
  - [x] Aucun changement de `prisma/schema.prisma` : la forme des colonnes ne bouge pas, seule la donnée est corrigée

- [x] **Tâche 4 — Tests de non-régression** (AC : 8)
  - [x] E2E : connexion de `admin@aqar.dz` en `ADMIN@AQAR.DZ` — doit aboutir sur `/agency`
  - [x] E2E : inscription avec ` Test@Exemple.dz `, puis connexion en `test@exemple.dz`
  - [x] E2E : seconde inscription avec `TEST@exemple.dz` — attendre 400 et « Cet email est déjà utilisé », **pas** 500
  - [x] Migration : sur une copie de la base, insérer volontairement une collision et vérifier que la migration s'arrête en la listant

### Review Findings

> Passe du 10-08-2026, exécutée **par le modèle qui a implémenté la story**, faute
> de sous-agents dans cette session. C'est la plus faible des deux revues
> possibles. Les prompts d'une revue réellement indépendante sont prêts dans
> `docs/stories/review-prompts/` — à jouer sur un autre modèle.

- [x] [Review][Decision] **Tranché : accentuer les seuls messages du `registerSchema`.** C'est une régression que ce changement a introduite — la corriger est du ressort de la revue. Accentuer tout le fichier casserait `tests/regression.spec.ts:56`, qui attend un message non accentué d'un autre schéma : c'est une story à part, versée dans `deferred-work.md`. Message d'erreur régressé en français non accentué sur le formulaire d'inscription — la copie locale du schéma affichait « au moins 6 caractères », le schéma partagé affiche « caracteres ». Tout `lib/validations/index.ts` est non accentué : corriger ce seul message le rend incohérent avec son fichier, corriger tout le fichier sort du périmètre de la story. Arbitrage requis. [lib/validations/index.ts:189]
- [x] [Review][Patch] Couvrir `agencies.email` par un test — l'AC 4 exige que **les deux** tables soient en minuscules, mais aucun test automatisé n'assure la seconde ; seule une vérification manuelle en base l'a établie. La console super admin affiche `agency.email`, ce qui donne un point d'observation e2e. [tests/regression.spec.ts:194]
- [x] [Review][Patch] Déconnexion fragile dans le test multi-casse — le test clique un bouton de la page de déconnexion par défaut de NextAuth. `auth.config.ts` ne personnalise que `signIn` et `error` ; le jour où `pages.signOut` est ajouté, le test casse avec une erreur sans rapport. `context().clearCookies()` est plus robuste et plus rapide. [tests/regression.spec.ts:186]
- [x] [Review][Patch] Commentaire JSDoc orphelin — le bloc qui explique l'absence de schéma local ne documente aucun symbole et précède immédiatement le JSDoc de `SIGNUP_LIMIT` : un lecteur peut le lui attribuer. Le rattacher à la ligne d'import. [app/api/auth/register/route.ts:6]
- [x] [Review][Defer] Course à l'inscription : 500 au lieu du message d'erreur — `findUnique` est hors transaction, deux inscriptions simultanées passent le contrôle et la seconde heurte la contrainte d'unicité. L'AC 3 tient en séquentiel, pas en concurrence. **Ce changement élargit la fenêtre** : des saisies de casses différentes entrent désormais en collision là où elles ne le faisaient pas. Propriété de BUG-12 / story 5.2. [app/api/auth/register/route.ts:82] — deferred, pre-existing
- [x] [Review][Defer] Les tests d'inscription accumulent des agences réelles — deux agences et deux comptes créés à chaque exécution, jamais nettoyés, jusqu'à trois fois par run en CI (`retries: 2`). Aucun test ne casse aujourd'hui ; la base de démonstration se remplit lentement. Le nettoyage demande un accès base depuis les tests, qui n'existe pas encore. [tests/regression.spec.ts:194] — deferred, pre-existing
- [x] [Review][Defer] Les AC 5 et 6 n'ont aucune couverture automatisée — la migration a été exercée à la main sur une base jetable (et s'y est révélée cassée, ce qui a payé). Rien ne rejoue ce contrôle. Aucun runner unitaire n'est installé et la story interdisait d'en ajouter un. [prisma/migrations/20260810000000_normalize_user_emails/migration.sql] — deferred, pre-existing
- [x] [Review][Defer] L'AC 2 n'est vérifiée qu'à moitié — « le jeton est créé » est prouvé en base ; « l'email part » ne l'est pas, SMTP n'étant pas configuré dans cet environnement. Le chemin d'envoi n'est pas modifié par cette story. [app/auth/forgot/actions.ts:74] — deferred, pre-existing

**Écartés comme faux positifs, après vérification :**

- Divergence `lower()` JS ↔ PostgreSQL sur les caractères non-ASCII — **réfuté** : Zod refuse `İSTANBUL@example.com` et `ÉCOLE@example.com`. Aucune adresse non-ASCII ne peut entrer, ni aujourd'hui ni avant la story.
- Divergence `btrim()` (espaces seuls) ↔ `.trim()` JS (tout blanc Unicode) — **réfuté** : avant la story, Zod refusait déjà les adresses entourées d'espaces ou de tabulations. Aucune ligne de ce type ne peut exister en base.

## Dev Notes

### État actuel, lu dans le code — les cinq points d'entrée

| Fichier | Ligne | État aujourd'hui | Action |
|---|---|---|---|
| `lib/validations/index.ts` | 160 | `loginSchema.email` : `z.string().email()` | **ajouter** `.trim().toLowerCase()` |
| `lib/validations/index.ts` | 166 | `registerSchema.email` : `z.string().email()` | **ajouter** `.trim().toLowerCase()` |
| `app/api/auth/register/route.ts` | 9-16 | `registerSchema` **dupliqué localement** | **supprimer**, importer celui de `lib/validations` |
| `app/auth/forgot/actions.ts` | 11 | `z.string().trim().email()` | **ajouter** `.toLowerCase()` |
| `lib/validations/index.ts` | 445 | `agencyUserSchema.email` : `.trim().toLowerCase().email()` | **ne rien changer** — c'est le modèle |

Corriger les schémas suffit à couvrir **tous** les chemins de lecture, parce qu'ils sont
tous alimentés par l'un d'eux :

```
auth.ts:56              loginSchema.safeParse(credentials)   → findUnique({ email })      auth.ts:84
login/actions.ts:28     loginSchema.safeParse(...)           → findUnique({ email })      login/actions.ts:49
forgot/actions.ts:39    schema.safeParse(...)                → findUnique({ email })      forgot/actions.ts:59
register/route.ts:75    registerSchema.parse(body)           → findUnique({ email })      register/route.ts:79
agency/users/page.tsx   agencyUserSchema (déjà normalisé)    → findUnique({ email })      users/page.tsx:94
```

Aucune autre requête ne cherche par email. Vérifié : `prisma/seed.ts` n'utilise que des
littéraux déjà en minuscules.

### Le piège n° 1 : `registerSchema` de `lib/validations` est du code mort

`grep` le confirme — **aucun fichier ne l'importe**. La route d'inscription a sa propre
copie, et c'est elle qui tourne réellement. Corriger le schéma de `lib/validations` sans
brancher la route **ne changerait rien à l'exécution** et donnerait l'illusion d'un
correctif. C'est exactement le genre d'erreur que ce défaut a déjà produite une fois.

Deux différences entre les deux copies, à connaître avant de basculer :

- celle de `lib/validations` a `.trim()` sur `agencyName`, celle de la route non. Après
  bascule, un nom d'agence saisi avec des espaces de bord sera nettoyé — **c'est une
  amélioration voulue**, pas une régression ;
- les messages d'erreur sont identiques mot pour mot, sauf « caractères » (route, accentué)
  vs « caracteres » (validations, non accentué). Le reste du fichier `lib/validations`
  n'accentue pas : garder la forme non accentuée par cohérence.

L'import `zod` de la route reste nécessaire — le `catch` teste `error instanceof z.ZodError`
(ligne 155). Ne pas le supprimer.

### Le piège n° 2 : `agencies.email` aussi

`register/route.ts` écrit `validated.email` dans **deux** tables (lignes 111 et 124), et
`agencies.email` est `@unique` lui aussi (`prisma/schema.prisma`). La migration doit donc
traiter les deux tables, et la détection de collision doit couvrir les deux.

Bonne nouvelle pour la suite : `agencies.email` n'est modifiable **nulle part ailleurs**.
`agencySettingsSchema` ne le contient pas, et l'écran des paramètres l'affiche en
`<Input disabled>` avec la mention « L'email sert d'identifiant, il ne peut pas être
modifié ici » (`app/agency/settings/page.tsx:140`). L'inscription est l'unique chemin
d'écriture.

### Bénéfice de sécurité collatéral — à ne pas casser

Trois compteurs de limitation de débit utilisent l'email **comme clé** :

```
auth.ts:67                login:compte:${email}
login/actions.ts:41       explication:compte:${validated.data.email}
forgot/actions.ts:51      oubli:compte:${parsed.data.email}
```

Aujourd'hui, un attaquant contourne ces trois compteurs en faisant simplement varier la
casse : `admin@`, `Admin@`, `ADMIN@` sont trois budgets distincts de dix essais. La
normalisation en amont referme ce trou **automatiquement**, parce que les clés sont
construites après le parsing. Ne pas déplacer ces constructions de clé avant le
`safeParse`, ce serait annuler le gain.

### Hors périmètre — ne pas y toucher

- **`optionalEmail`** (`lib/validations/index.ts:116`), utilisé par `ownerSchema` (230),
  `clientSchema` (244) et `leadSchema` (393). Ce sont des **données de contact**, pas des
  identifiants de connexion : personne ne s'authentifie avec, aucune contrainte d'unicité
  ne s'y applique. Les forcer en minuscules abîmerait l'affichage voulu par l'agence sans
  rien résoudre.
- **Le schéma Prisma.** Aucune colonne ne change de forme. La migration ne touche que la
  donnée.
- **Les autres défauts d'`auth.ts`.** BUG-17 (budget de force brute doublé entre
  `authorize` et `explainLoginFailure`) est réel et visible dans les fichiers que vous
  allez ouvrir — il appartient à la **story 5.6**. Ne pas le corriger ici.

### Pistes écartées, avec la raison

- **Colonne `citext`.** Résoudrait le problème dans la base, mais l'extension doit être
  installée sur l'instance PostgreSQL de production — le VPS monte un `postgres:16-alpine`
  nu — et Prisma ne la gère pas nativement. La normalisation applicative est portable et
  c'est déjà ce que fait `agencyUserSchema`.
- **`findUnique` → `findFirst({ where: { email: { mode: "insensitive" } } })`.** Corrigerait
  la lecture sans corriger l'écriture : la contrainte `@unique` de PostgreSQL reste
  sensible à la casse, donc les doublons continueraient d'être créés. C'est le pansement
  qui masque la plaie.
- **Normaliser uniquement à la lecture, sans migration.** Les comptes déjà créés avec des
  majuscules deviendraient définitivement inaccessibles : la lecture chercherait la forme
  minuscule qui n'existe pas en base. C'est le contraire de l'objectif.

### La migration, dans le détail

`prisma/migrations/` ne contient que `20260803000000_init` et
`20260803120000_agency_subscription` : le nommage est `<horodatage>_<nom_snake_case>`.

Forme attendue — bloc `DO`, parce qu'il faut décider avant d'écrire :

```sql
-- Normalise les adresses email : minuscules, sans espaces de bord.
--
-- Sans ce passage, les comptes deja crees avec une majuscule deviendraient
-- inaccessibles des que le code cherchera la forme minuscule.
--
-- Les collisions ne sont PAS resolues automatiquement : deux comptes qui se
-- replient sur la meme adresse sont deux personnes ou deux historiques, et
-- choisir lequel survit est une decision humaine.
DO $$
DECLARE
  conflits text;
BEGIN
  SELECT string_agg(norme, ', ') INTO conflits
  FROM (
    SELECT lower(btrim(email)) AS norme
    FROM users
    GROUP BY 1
    HAVING count(*) > 1
  ) c;

  IF conflits IS NOT NULL THEN
    RAISE EXCEPTION
      'Collisions de casse dans users : %. Fusionnez ou supprimez ces comptes avant de rejouer la migration.',
      conflits;
  END IF;

  -- Meme controle sur agencies, dont email est @unique lui aussi.
  -- ... bloc symetrique ...

  UPDATE users    SET email = lower(btrim(email)) WHERE email <> lower(btrim(email));
  UPDATE agencies SET email = lower(btrim(email)) WHERE email <> lower(btrim(email));
END $$;
```

`RAISE EXCEPTION` annule la transaction de migration : rien n'est écrit, et Prisma
marque la migration comme échouée avec le message en clair. C'est le comportement voulu
par l'AC 6.

**État réel de la base au 10 août 2026**, relevé sur `aqar-postgres-prod` :

```
users    : admin@aqar.dz, agent@aqar.dz, attente@aqar.dz, superadmin@aqar.dz
collisions de casse : 0
lignes non normalisees : users 0, agencies 0
```

La migration sera donc un **no-op sur le jeu de démonstration**. C'est précisément
pourquoi l'AC 6 ne peut pas être vérifiée en la jouant simplement : il faut insérer une
collision à la main sur une copie.

### Testing

Playwright uniquement (`npm run test:e2e`, projet `chromium`, `baseURL` sur
`PLAYWRIGHT_PORT` ou 3002). **Aucun runner unitaire n'est installé** — ni Vitest ni Jest.
Ne pas en ajouter dans cette story.

Réutiliser `tests/auth-helper.ts` : `loginAsAgency(page, email, password)` fait déjà
`goto` → remplissage → `waitForURL(/.*agency/)`. Ne pas réécrire ce parcours.

Comptes du jeu de démonstration : `superadmin@aqar.dz`, `admin@aqar.dz`, `agent@aqar.dz`,
mot de passe `password123`, agence `agence-demo`.

⚠️ **Ne pas prendre modèle sur les tests existants d'un module.** Sept fichiers
(`documents`, `payments`, `rentals`, `sales`, `visits`, `clients`, `properties`) contiennent
des cas nommés « … when authenticated » qui ne se connectent jamais et vérifient la
redirection vers `/login` — ils testent l'inverse de leur nom (BUG-28, story 4.1). Les
modèles sains sont `tests/regression.spec.ts` et `tests/features.spec.ts`.

Placer les nouveaux cas dans `tests/regression.spec.ts` : c'est le fichier dédié aux
non-régressions de défauts corrigés.

### Ce qui vient de se passer dans le dépôt

Première story menée par le cycle BMAD : il n'existe pas de fichier de story précédente
dont hériter. Le contexte utile vient des cinq derniers commits (`094ed05` → `b23ef1e`) :

- **La story 1.1 est partiellement close, hors cycle.** `mcp-config.json` est sorti du
  suivi git et remplacé par `mcp-config.example.json` (`256d1a4`). Ce qui reste de 1.1 est
  une action hors code, reportée par l'éditeur. **Ne pas rouvrir ce sujet dans cette story.**
- **`tsconfig.tsbuildinfo` n'est plus suivi** (`256d1a4`). Un `npx tsc --noEmit` le modifie
  sur le disque : c'est normal, il n'apparaîtra plus dans `git status`.
- **La documentation a été remise d'aplomb** (`361bb18`) : le registre compte désormais
  31 défauts et une table de correspondance n° d'audit ↔ BUG-xx. Quand la story sera close,
  c'est **BUG-01** qu'il faut marquer corrigé — pas « défaut n° 02 ».
- **Convention de commit observée** dans ces cinq commits : sujet en `type(portée):` à
  l'impératif, corps qui explique *pourquoi* et non *quoi*, sans accents dans le message.

### Project Structure Notes

Aucun fichier nouveau hors migration et tests. Tous les chemins touchés existent déjà et
respectent la structure décrite dans `docs/architecture.md`. Aucune dépendance à ajouter :
`.trim()` et `.toLowerCase()` sont natifs de Zod (3.25.76 installé, `^3.22.4` déclaré) et
sont **déjà utilisés** ligne 445 — la capacité est prouvée dans ce dépôt même.

Aucune variance détectée avec la structure attendue.

### References

- [Source: docs/epics.md#Story 1.2: Normaliser les adresses email] — critères d'acceptation
- [Source: docs/qa/bug-report.md#bug-01] — reproduction sur l'instance, mécanique du cul-de-sac « mot de passe oublié »
- [Source: docs/stories/story-01-normalisation-email.md] — spec manuscrite, tâches et pistes écartées
- [Source: docs/architecture.md#5. Flux d'authentification] — le schéma y marque déjà `findUnique({ email }) ← sensible à la casse (BUG-01)`
- [Source: docs/project-context.md#Définition de « terminé »] — portes de sortie de la story
- [Source: docs/project-context.md#Règles non négociables] — règle 3 : toute entrée passe par un schéma Zod de `lib/validations/index.ts`
- [Source: AGENTS.md#Règle absolue 4] — NextAuth v5, Credentials + bcrypt, JWT

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m] (Claude Opus 5, contexte 1M)

### Debug Log References

**RED — état avant correction**, relevé sur la pile Docker (`localhost:8095`, image
construite avant la story), avec jeton CSRF :

```
[admin@aqar.dz]   → http://localhost:8095/agency                        session=1
[ADMIN@AQAR.DZ]   → /auth/login?error=CredentialsSignin&code=credentials session=0
[Admin@Aqar.dz]   → /auth/login?error=CredentialsSignin&code=credentials session=0
```

**Migration — les trois chemins exercés** sur une base jetable
(`aqar_migration_test`), tables `users` et `agencies` reconstituées avec leurs
contraintes `unique` :

| Cas | Attendu | Obtenu |
|---|---|---|
| Collision présente | refus, aucune écriture | `ERROR: Normalisation impossible … users : contact@immoalger.dz` · psql **exit 3** · données inchangées |
| Collision résolue | normalisation | `NOTICE: Emails normalises — users : 2, agencies : 1` · exit 0 |
| Rejouée | idempotence | `NOTICE: Emails normalises — users : 0, agencies : 0` · exit 0 |

**Défaut trouvé et corrigé pendant l'exercice.** La première version du
`RAISE EXCEPTION` ne compilait pas : `%%` est un `%` littéral en PL/pgSQL, pas un
paramètre, d'où `ERROR: too many parameters specified for RAISE`. Comme la base
réelle ne contient aucune collision, cette branche n'aurait **jamais** été
exercée en production — elle aurait échoué le jour précis où elle devait protéger
les données. Message réécrit en `E'…\n…'` avec deux paramètres.

**Application sur la base réelle :**

```
npx prisma migrate deploy   → All migrations have been successfully applied.
npx prisma migrate status   → Database schema is up to date! (3 migrations)
```

**AC 2 — preuve en base** (l'écran ne peut rien prouver, sa réponse est
volontairement identique). Après soumission de `ADMIN@AQAR.DZ` sur `/auth/forgot` :

```
jeton   2026-08-10 13:40:27.117  admin@aqar.dz
compte  2026-08-10 13:40:25.551  contact.retrouve-…@immoalger.dz   (créé par le test précédent)
```

Le jeton est postérieur de 1,6 s au compte de test : il a bien été créé pendant ce
run. `createResetToken()` supprimant les jetons non utilisés antérieurs, le
compteur reste à 1 — ce n'est pas l'ancien jeton.

**État final des données :** `users` 0 et `agencies` 0 adresse non normalisée.

**Test de mutation — les tests testent-ils vraiment quelque chose ?** La
normalisation a été retirée de `identityEmail`, la suite BUG-01 relancée, puis la
correction restaurée :

```
✘ la connexion accepte n'importe quelle casse
✘ l'inscription enregistre en minuscules et refuse le doublon de casse
✘ le compte cree est retrouve par son adresse en minuscules
✓ mot de passe oublié accepte une autre casse
3 failed, 1 passed
```

Trois cas sur quatre virent au rouge. Le quatrième reste vert et c'est **normal** :
la réponse de « mot de passe oublié » est identique que le compte existe ou non,
donc l'écran ne peut pas distinguer les deux cas — sa valeur est de prouver que le
chemin ne casse pas, pas la normalisation. C'est écrit dans le test.

**Piège d'environnement rencontré.** Le premier run complet a échoué sur 62 cas
sans rapport avec le code : `npm ci` installe `@playwright/test@1.60.0`, qui attend
les navigateurs de build `1223`, alors que le cache local n'avait que `1228`.
`npx playwright install chromium` règle le problème. Les 7 cas qui passaient
malgré tout sont ceux qui n'ouvrent pas de navigateur (fixture `request`).
**Ce piège mérite une ligne dans `docs/project-context.md`**, à côté de
l'avertissement « `node_modules` peut être absent » — hors périmètre de cette
story, laissé au relecteur.

### Completion Notes List

- **Le vrai correctif était dans la route, pas dans le fichier de schémas.**
  `registerSchema` de `lib/validations/index.ts` n'était importé nulle part : la
  route d'inscription portait sa propre copie. Ajouter la normalisation au seul
  schéma partagé n'aurait rien changé à l'exécution tout en donnant l'illusion
  d'un correctif. La route importe désormais le schéma partagé et le doublon a
  disparu.
- **Effet de bord favorable, volontairement conservé.** Trois compteurs de
  limitation de débit prennent l'email pour clé (`login:compte:`,
  `explication:compte:`, `oubli:compte:`). Avant, faire varier une majuscule
  offrait un budget de tentatives neuf à chaque fois — la protection contre la
  force brute se contournait sans outil. Les clés étant construites après le
  parsing, la normalisation referme ce trou. Documenté dans le commentaire de
  `identityEmail` pour que personne ne déplace ces constructions.
- **Changement de comportement mineur assumé :** le schéma partagé applique
  `.trim()` sur `agencyName`, ce que la copie locale ne faisait pas. Un nom
  d'agence saisi avec des espaces de bord est désormais nettoyé.
- **Refactor proposé, non appliqué.** `agencyUserSchema` répète mot pour mot la
  chaîne de `identityEmail`. Les fusionner supprimerait la dernière duplication de
  cette famille — celle-là même qui a produit BUG-01. La story disait
  explicitement de ne pas toucher à ce schéma : **arbitrage laissé au relecteur**,
  la modification n'a pas été faite.
- **Hors périmètre, laissé intact :** `optionalEmail` (owner / client / lead —
  données de contact, pas des identifiants) et BUG-17, visible dans `auth.ts` mais
  propriété de la story 5.6.
- Au moment de clore : marquer **BUG-01** corrigé dans `docs/qa/bug-report.md`
  (numérotation du registre, pas « défaut n° 02 »).

### File List

| Fichier | Nature |
|---|---|
| `lib/validations/index.ts` | modifié — `identityEmail` ajouté, utilisé par `loginSchema` et `registerSchema` |
| `app/api/auth/register/route.ts` | modifié — schéma local supprimé, import du schéma partagé |
| `app/auth/forgot/actions.ts` | modifié — `.toLowerCase()` ajouté |
| `prisma/migrations/20260810000000_normalize_user_emails/migration.sql` | **nouveau** |
| `tests/regression.spec.ts` | modifié — bloc « Normalisation des adresses email (BUG-01) », 4 cas |
| `docs/stories/1-2-normaliser-les-adresses-email.md` | modifié — suivi de la story |
| `docs/stories/sprint-status.yaml` | modifié — statut |

## Change Log

| Date | Changement |
|---|---|
| 10-08-2026 | Normalisation des adresses email d'identité (`trim` + `lowercase`) sur les trois chemins publics ; suppression du `registerSchema` dupliqué de la route d'inscription ; migration `normalize_user_emails` avec détection de collision ; 4 tests de non-régression. Ferme BUG-01. |
