# CLAUDE.md — contrat de travail sur Aqar DZ

> Chargé automatiquement à chaque session. Il dit **comment travailler ici**.
>
> **Il évite la redite.** Ce dépôt a déjà payé la divergence entre deux
> documents disant la même chose autrement. Quand une information est
> rappelée ici pour être sous la main, sa **source** est nommée : c'est là
> qu'on va vérifier, et c'est elle qui gagne.
>
> **Ordre de préséance : le code d'abord, puis ce fichier.** `AGENTS.md` a
> été supprimé le 12 août 2026 et ses règles sont repliées ici (§12), avec
> leur numérotation d'origine. Les documents datés qui le citent encore
> (`GSD.md`, les stories closes) sont des **archives** : leurs renvois
> pointent vers §12.

---

## 0. Les trois premières minutes d'une session

```
1. docs/project-context.md          règles réelles, pièges, définition de « terminé »
2. docs/stories/sprint-status.yaml  où en est le sprint (SEULE source de vérité)
3. docs/epics.md                    le plan, si vous allez développer
```

| Besoin | Où |
|---|---|
| Règles permanentes du produit | **§12 de ce fichier** |
| Quels serveurs MCP utiliser, et lesquels éviter | **§14 de ce fichier** |
| Architecture réelle | `docs/architecture.md` |
| Défauts, `BUG-nn` | `docs/qa/bug-report.md` |
| Constats reportés, `REP-nn` | `docs/stories/deferred-work.md` |
| Contexte métier — ce qu'est le produit, pour qui | `CONTEXT.md` |
| `GSD.md` | **archive** de la construction (phases 1 à 8). Plus une méthode, ne pas s'y fier. Conservée parce qu'elle porte le seul énoncé formalisé du besoin produit, tant qu'aucun PRD n'existe |

**Réglages Claude Code** : `.claude/settings.json` autorise 16 commandes pour
qu'une vérification ne demande pas la permission — **toutes en lecture seule
sauf une**, `npx prisma generate`, qui n'écrit que le client généré sous
`node_modules/`. Le reste : `git status|log|diff|show|ls-files|rev-parse`,
`git branch` **en forme exacte**, `tsc --noEmit`, `lint`, `prisma validate`,
`ls`, `wc`, `grep`, `rg`. Ce qui démarre le projet n'y figure délibérément
pas : cela reste soumis à l'accord explicite (§2).

> `git branch` y est entré **sans `:*`** le 14-08-2026. Le motif : le joker
> couvre le préfixe, donc `git branch -D` et `git branch -m` passaient sans
> demander — la liste ne tenait pas la « lecture seule » qu'elle annonçait.
> Pour connaître la branche courante, `git rev-parse --abbrev-ref HEAD` reste
> libre.

> ⚠ **Ce que le `deny` garantit, et ce qu'il ne garantit pas.** Il bloque
> l'outil `Read` sur `.env` et les commandes de migration nommées. Il **ne
> peut pas** empêcher n'importe quelle commande shell de lire un fichier :
> `grep` est autorisé, donc `.env` reste techniquement lisible. La première
> version de ce paragraphe affirmait que le fichier « refuse la lecture de
> `.env` » — c'était une garantie que la configuration ne fournit pas, et la
> revue du 12-08-2026 l'a relevée. `find` a été retiré de la liste : son
> `-exec` est une exécution arbitraire déguisée en lecture.
>
> Le `deny` sur Prisma a été élargi le 14-08-2026 : `npx prisma db push:*` ne
> couvrait que `push`, et laissait passer `npx prisma db execute`, qui exécute
> du SQL arbitraire sur `DATABASE_URL`. C'est `npx prisma db:*` qui est bloqué
> désormais, et les formes sans `npx` avec.
>
> La protection réelle de `.env` reste `.gitignore` et la règle §2.

---

## 1. BMAD, toujours. Aucun correctif hors story.

**Tout changement de code passe par une story.** Sans exception, y compris
« c'est une ligne » et « c'est évident ».

```
bmad-sprint-status  →  bmad-create-story  →  bmad-dev-story
                    →  bmad-code-review   →  bmad-retrospective (fin d'épopée)
```

- **Nouvelle fonctionnalité** → `bmad-prd` puis `bmad-create-epics-and-stories`.
  Elle ne se glisse pas dans une story en cours.
- **Changement en cours de route** → `bmad-correct-course`, pas une
  improvisation.
- **Ne jamais enchaîner deux stories sans accord explicite de
  l'utilisateur.**
- Ne créer la story suivante qu'une fois la précédente `done` : c'est ce qui
  permet d'y verser ce qu'on vient d'apprendre.
- Une épopée se termine par `bmad-retrospective`.

### Un constat sans story n'existe pas

Vous relevez quelque chose hors périmètre ? Donnez-lui un `REP-nn` dans
`deferred-work.md` **et** une story qui le porte — quitte à l'ouvrir dans
`docs/epics.md` pour l'occasion.

Cette règle existe parce que **34 constats sur 73 n'avaient aucun
propriétaire**, dont un défaut exploitable resté onze jours invisible : un
tiers pouvait verrouiller n'importe quel compte dont il connaissait
l'adresse.

---

## 2. Garde-fous — ce qui ne se fait jamais

Chacun a coûté quelque chose ici.

| Interdit | Pourquoi |
|---|---|
| **Démarrer le projet sans accord explicite** | Règle 2 (§12). `npm run test:e2e` démarre le projet : il entre dans la règle |
| **Toucher à une base de production** | Jamais, sous aucun prétexte. Les requêtes de contrôle sont fournies en lecture seule et exécutées par l'éditeur |
| **`prisma.property\|client\|owner.delete()` — et `deleteMany()`** | Ces trois modèles sont à corbeille : poser `deletedAt`. C'est définitif **et en cascade** : `npm run audit:cascades` dit ce qui tombe (**11 tables**, dont les quittances par `Client → Rental → RentalManagement`). Cette ligne était écrite au singulier ; `deleteMany()` a détruit une location et ses quittances le 15-08-2026 (`REP-99`). Elle est désormais **tenue par ESLint** (`.eslintrc.json`), avec deux exceptions nommées à l'endroit où elles s'exercent : `app/agency/trash/page.tsx` et la remise à zéro de `prisma/seed.ts` |
| **`findUnique` sur ces trois modèles** | Le filtre de `lib/prisma.ts` ne peut pas le couvrir — Prisma n'accepte que des champs uniques dans son `where`. Utiliser `findFirst`, qui porte aussi le `agencyId` du cloisonnement. Tenu par la même règle ESLint |
| **Un `_count` ou un `include` au pluriel sur ces trois modèles, sans `where: { deletedAt: null }`** | Le filtre de `lib/prisma.ts` n'agit **qu'au premier niveau**. Cinq écrans ont compté des biens en corbeille pendant des semaines (`BUG-24`). Les relations **au singulier**, elles, ne se filtrent jamais : story 3.9 |
| **`formData.get(x) as Enum`** | Toute entrée passe par `parseForm(schema, formData)` avec un schéma Zod |
| **Un contrôle de rôle dans `middleware.ts`** | Il tourne en Edge et ne lit que le jeton. Deux couches qui autorisent sur deux sources finissent par se contredire — ça a déjà enfermé un compte |
| **Lire `session.user.role` ou `session.user.agencyId`** | Le rôle et l'agence se relisent **en base**. Seul `session.user.id` vient du jeton |
| **Ajouter une dépendance sans accord** | Y compris un runner de tests unitaires : il n'y en a **aucun**, et en ajouter un est une story (4.5) |
| **Un second système d'authentification** | NextAuth v5, `Credentials` + bcrypt, stratégie JWT. Supabase ne fait **que** du stockage de fichiers, et il est optionnel |
| **Une sidebar** | La navigation est **toujours** une navbar horizontale. 100 % des pages |
| **`console.log` en production, un secret en dur** | Y compris dans les fichiers de configuration d'outils : `mcp-config.json` a déjà fuité une clé |
| **Cocher une tâche non faite** | Voir §8 |
| **Publier un nombre sans l'avoir recalculé** | Voir §7 |
| **`waitForLoadState("networkidle")` dans un test** | Il se résout pendant qu'une Server Action est encore en vol. Attendre l'**effet**, jamais le silence du réseau |

---

## 3. Environnement et commandes

> *Rappel — source : `docs/project-context.md` et `package.json`.*

```bash
npm ci                    # node_modules PEUT être absent : toujours avant build/lint/test
npx tsc --noEmit          # 0 erreur exigé          ← libre, attendu, ne démarre rien
npm run lint              # 0 erreur exigé          ← idem
                          #   couvre aussi prisma/, scripts/ et tests/ depuis
                          #   la story 3.5 : `next lint` seul ignorait les
                          #   trois, et c'est dans un script qu'a eu lieu
                          #   l'accident de REP-99
npm run audit:cascades    # ce que détruit un delete sur Property/Client/Owner
                          #   ← lit prisma/schema.prisma, ne touche AUCUNE base
npm run test:e2e          # ⚠ DÉMARRE LE PROJET — accord explicite requis
npm run dev               # ⚠ idem. Écoute le port 3002
```

**La suite de tests construit l'application avant de la servir** (`npm run
build && npm start`, délai 420 s dans `playwright.config.ts`). Compter
quelques minutes, et ne pas la lancer pour vérifier une virgule.

**Pile conteneurisée** : `docker compose -f docker-compose.prod.yml up -d` —
nginx sur **8095**, PostgreSQL **publié sur la boucle locale uniquement**.

**Jeu de démonstration** (`--profile seed run --rm seed`) :
`superadmin@aqar.dz`, `admin@aqar.dz`, `agent@aqar.dz`, mot de passe
`password123`, agence `agence-demo`. **Ces comptes sont partagés par toute
la suite** : ne jamais les désactiver, rétrograder, ni saturer leur compteur
de tentatives. Un test qui en a besoin se crée un compte jetable.

**github.com est lent et parfois injoignable** depuis ce réseau ; npm passe
normalement. Ne pas concevoir un workflow qui clone à chaud.

---

## 4. Ce qu'il faut savoir pour ne pas réinventer

- **Next.js 14 App Router, TypeScript strict.** Rendu par Server Components.
  Les **mutations passent par des Server Actions** ; les routes API ne
  servent que ce qui doit être appelé depuis le navigateur (upload, exports,
  PDF, suppressions, santé).
- **Prisma sur PostgreSQL.** Le client est **étendu** (`lib/prisma.ts`) : il
  injecte `deletedAt: null` sur les **lectures** de `Property`, `Client`,
  `Owner` — **au premier niveau seulement**. Les relations imbriquées et
  `findUnique` ne sont pas couverts, et les **écritures** ne le sont pas non
  plus.
- **Pas de runner unitaire.** La couverture est E2E, Playwright. Ne pas en
  ajouter un sans arbitrage.
- **`@tanstack/react-query` est installé et importé nulle part.** Ne pas s'en
  servir sans décision.
- **PDF** : `@react-pdf/renderer` uniquement. Ni Puppeteer, ni jsPDF.
- **UI** : Tailwind + shadcn/ui, Framer Motion, icônes Lucide uniquement.

### Repères de code

| Besoin | Où |
|---|---|
| Gardes d'accès | `lib/auth-guard.ts` |
| Schémas d'entrée | `lib/validations/index.ts` |
| FormData → Zod | `lib/form.ts` — `parseForm`, `withError`, `withSuccess` |
| Pagination, recherche | `lib/list-params.ts` |
| Limitation de débit | `lib/rate-limit.ts` |
| Fichiers | `lib/storage.ts` |
| Emails | `lib/mailer.ts` + `lib/notifications.ts` |
| Journal | `lib/audit.ts` — `recordAudit()` |
| Decimal → nombre | `lib/serialize.ts` — `toPlain` |
| Parent en corbeille dans une liste | `lib/corbeille.ts` |

### Harnais de test

| Besoin | Où |
|---|---|
| Agence jetable + comptes | `tests/agence.ts` — `creerAgence`, `garnir`, `effacerAgence` |
| Base **sans** le filtre de corbeille | `tests/db.ts` |
| Connexion (pose une identité d'appelant **obligatoire**) | `tests/auth-helper.ts` |
| Rejouer une Server Action | `tests/roles.spec.ts` — `releverSuppression` / `rejouer` |

---

## 5. Le cloisonnement, qui prime sur tout

Toute lecture et toute écriture filtre sur `agencyId`. Le motif, sans
exception :

```ts
const { agencyId } = await requireAgency()      // ou getApiAgency() en API
const row = await prisma.x.findFirst({ where: { id, agencyId } })
if (!row) redirect(...)                          // ou 404 JSON
await prisma.x.update({ where: { id }, data })
```

- Un identifiant relationnel reçu d'un formulaire est **re-vérifié**
  (`app/agency/payments/verify-links.ts`).
- **`requireAgency()` ne dit rien du rôle.** Une **suppression** demande en
  plus `requireAgencyAdmin()` ou `isAgencyAdmin()`. L'inventaire des Server
  Actions destructives est dans `docs/architecture.md` §4 : **s'y comparer
  avant d'ajouter un écran.**
- **L'autorisation n'a qu'une couche** : `lib/auth-guard.ts`.
- **Journaliser** toute action conséquente via `recordAudit()` : suppression,
  restauration, changement de statut, gestion des comptes.
- **Un administrateur d'agence ne peut jamais fabriquer un `super_admin`**,
  ni laisser son agence sans administrateur actif.

---

## 6. Écrire un test ici

Quatre pièges ont coûté cher. Les trois premiers ont produit des tests
**verts sur un produit cassé**.

1. **Un test qui vérifie que « X n'a pas changé » doit aussi vérifier que
   l'opération a EU LIEU.** Un enregistrement refusé laisse la donnée
   intacte, exactement comme un enregistrement réussi. *C'est arrivé deux
   fois.*
2. **Un code HTTP ne prouve rien.** Les pages ont un `loading.tsx` : le flux
   part avant que la garde ne tranche, donc **un refus arrive en `200`** et
   c'est le navigateur qui redirige. Ne concluez jamais d'un statut ni d'un
   `page.url()` lu juste après `goto()` — attendre avec `waitForURL`, ou
   asserter le **contenu**.
3. **Une mutation qui ne compile pas ne prouve rien.** Retirer une garde rend
   son import inutilisé → lint en erreur → build en échec, et le « rouge » ne
   vient pas du test. Retirer l'import avec la garde.
4. **Une Server Action se rejoue, elle ne se clique pas.** C'est un point
   d'entrée `POST` joignable sans l'écran qui la rend ; un clic ne prouve que
   le rendu du bouton. Et **ne jamais coder en dur un identifiant d'action** :
   il est calculé au `build`, et figé dans un test il le rendrait vert en ne
   testant plus rien.

**Le contrôle positif est obligatoire.** Un refus attendu ne prouve rien tant
qu'un succès n'est pas constaté sur le même chemin : une action cassée pour
tout le monde donne exactement le même vert qu'une action correctement
gardée. **Et vérifiez que le contrôle positif éprouve le bon scénario** — un
contrôle posé à côté du trou laisse le trou passer dessous.

**Prouver par mutation.** Retirer la garde ou la règle qu'on vient d'ajouter,
constater le rouge, **lire le message d'échec** — il doit désigner la
propriété visée, pas une assertion voisine —, puis rétablir.

**Nettoyer par `afterEach`, jamais par `finally`.** Un dépassement de délai
n'exécute pas un `finally` : c'est ainsi qu'un compte `super_admin` à mot de
passe connu a failli s'installer en base.

---

## 7. Ce qui ne se dit pas sans l'avoir mesuré

Ce dépôt traite **une affirmation que le code ne tient pas comme un défaut**.
Les revues en trouvent à chaque story.

- **Ne jamais écrire un nombre sans le recalculer**, et écrire la commande à
  côté. « les 31 Server Actions », « ses 31 appelants », « 19 défauts
  ouverts » : trois chiffres faux, recopiés de document en document, cités
  comme preuves d'exhaustivité.
- **Une commande de contrôle se lance avant d'être publiée.** Celle qui
  recensait les suppressions destructives en ratait 3 sur 11 — `[a-z]*` ne
  franchit pas une majuscule.
- **« Vérifié » veut dire exécuté.** Pas « lu », pas « raisonné ». Si vous
  n'avez pas pu mesurer, écrivez que vous n'avez pas pu — c'est un résultat.
- **Une hypothèse sur une bibliothèque se mesure.** « Le `Select` de Radix
  conserve sa valeur, donc ces deux écrans sont épargnés » : faux, et la
  mutation l'a montré. Deux écrans seraient restés cassés.

---

## 8. Une correction déplace le problème avant de le fermer

La leçon la plus chère de ce dépôt, vérifiée **trois fois de suite** :

- rendre la révocation effective a **ouvert une boucle de redirection** qui
  enfermait un compte rétrogradé ;
- retirer la cascade destructive d'un bien a **rendu fréquent** un état que
  rien ne traitait — c'est devenu BUG-34 ;
- garder le parent en corbeille dans la liste a **bloqué l'enregistrement**
  des cinq écrans concernés.

**À chaque correctif : qu'est-ce que je viens de rendre atteignable ?**
C'est la revue qui doit répondre, pas le prochain incident.

Corollaire : **une correction peut invalider la mesure qui la démontre.** Un
tableau de mutation se lit, il ne se remplit pas.

---

## 9. Avant de dire qu'une story est terminée

> *La définition fait foi dans `docs/project-context.md`.*

- [ ] `npx tsc --noEmit` — 0 erreur
- [ ] `npm run lint` — 0 erreur
- [ ] `npm run test:e2e` — vert, **et au moins un test couvre la régression
      corrigée**, prouvé **par mutation**
- [ ] cloisonnement `agencyId` vérifié sur tout chemin touché
- [ ] `docs/qa/bug-report.md` à jour (défaut marqué corrigé)
- [ ] `docs/stories/sprint-status.yaml` à jour
- [ ] la **File List** de la story liste **tous** les fichiers touchés
- [ ] les constats hors périmètre versés en `REP-nn`, **avec une story**

**Ne cochez jamais une tâche que vous n'avez pas faite.** Écrire « non fait,
et voici pourquoi » est un résultat ; une case cochée à tort est un mensonge
qui coûtera à quelqu'un d'autre. **Une story dont une tâche reste ouverte
reste `in-progress`.**

---

## 10. Git

- **Commits atomiques**, un sujet par commit.
- **Message en français**, à l'infinitif, qui dit *pourquoi* et pas seulement
  *quoi*. Le corps porte le motif, la mesure, et ce qui n'a pas été fait.
- **Ne jamais commiter ni pousser sans demande.** Sur `main`, brancher
  d'abord si l'utilisateur ne l'a pas dit.
- `.env` reste hors du dépôt, `.env.example` à jour.
- Aucun artefact de build versionné.

---

## 11. Écrire du code ici

- **Français partout** : commentaires, messages d'erreur affichés, messages
  de commit. Les commentaires de code sont **sans accents** (convention
  existante) ; les chaînes vues par un utilisateur en portent.
- **Un commentaire dit pourquoi, pas quoi.** Ceux de ce dépôt portent des
  décisions, des mesures et des dates : c'est ce qui permet de les rouvrir
  sciemment. Ne pas les réduire en passant.
- **Pas de code mort**, pas de commentaire décoratif.
- **Une Server Action ne capture que des VALEURS**, jamais des fonctions, et
  pas un objet rétréci par un `notFound()` situé plus haut.
- **`redirect()` lève `NEXT_REDIRECT`** : ne jamais l'entourer d'un
  `try/catch` qui avalerait l'exception.
- **`recordAudit()` n'échoue jamais** : il avale ses erreurs à dessein.
  L'appeler ne peut pas casser l'action métier — et ne prouve donc pas
  qu'une ligne a été écrite.

---

## 12. Les règles permanentes du produit

> **Reprises d'`AGENTS.md`, supprimé le 12 août 2026 et replié ici.** La
> numérotation est conservée : les documents qui citent « règle 4 » ou
> « règle 13 » continuent de résoudre. Les règles 1, 2, 9, 11 et 13 vivent
> plus haut dans ce fichier — §1 (BMAD, validation des stories), §2 (ne rien
> lancer), §10 (git), §11 (communication et écriture) — et ne sont pas
> répétées ici.

**Règle 3 — Navigation.** La navigation est **toujours** une navbar
horizontale en haut de page. **Jamais** de sidebar, jamais de menu latéral.
Sur 100 % des pages.

**Règle 4 — Authentification.** NextAuth v5 **uniquement**, fournisseur
`Credentials` + bcrypt, stratégie JWT. Pas de JWT custom séparé, pas de
second système. Trois rôles : `super_admin`, `agency_admin`, `agent`.
Supabase n'intervient **pas** dans l'authentification.
*Durée de session : 12 heures (`auth.config.ts`), arbitrage du 12-08-2026.*

**Règle 5 — Base de données.** PostgreSQL 16 auto-hébergé en conteneur, en
développement **et** en production (`docker-compose*.yml`, volume
`postgres_data`). Prisma pour toutes les opérations. `agencyId` obligatoire
sur toutes les tables métier.
*Supabase n'héberge pas la base — la règle d'origine l'annonçait, ça n'a
jamais été le cas. Un basculement resterait une variable `DATABASE_URL`.*

**Règle 6 — Stockage des fichiers.** Développement : `public/uploads/` ; en
conteneur, volume `uploads_data` servi par nginx. Structure
`public/uploads/{properties,agencies,documents}/`. Supabase Storage est une
**option**, activée seulement si `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
et `SUPABASE_STORAGE_BUCKET` sont **tous** renseignés (`lib/storage.ts`).
Max 5 Mo, formats jpg/jpeg/png/webp — **vérifiés par signature** depuis la
story 2.2, plus seulement déclarés par le client.

**Règle 7 — PDF.** `@react-pdf/renderer` uniquement. Ni Puppeteer, ni jsPDF.

**Règle 8 — Design system.** shadcn/ui, style Default, couleur slate.
Interface claire, couleurs sobres immobilières. Cartes modernes, coins
arrondis, ombres douces. Animations Framer Motion. Icônes **Lucide
uniquement**.

**Règle 10 — Tests.** Playwright de bout en bout pour chaque module. Audit
Lighthouse avant validation finale. Vérification du responsive.

**Règle 12 — Docker.** Développement : `docker-compose.yml` (frontend,
postgres, nginx). Production : `docker-compose.prod.yml` (postgres, migrate
éphémère, frontend autonome non-root, nginx). Dockerfile multi-étages ; **les
migrations ne s'appliquent jamais depuis le conteneur qui sert le trafic**.
**Une seule image applicative** : les routes API *sont* l'application.

### Checklist avant chaque commit

- [ ] Pas de `console.log` ni de débogage en production
- [ ] Pas de clé ni de secret en dur — **y compris dans les fichiers de
      configuration d'outils** (`mcp-config.json` a déjà fuité une clé)
- [ ] `npx prisma validate` — schéma valide
- [ ] `npx tsc --noEmit` et `npm run lint` — 0 erreur
- [ ] Pas de code mort ni de commentaire inutile
- [ ] Aucun artefact de build versionné

### Checklist avant chaque story

- [ ] La story existe dans `docs/epics.md`, son statut est à jour dans
      `docs/stories/sprint-status.yaml`
- [ ] Critères d'acceptation écrits en Given / When / Then
- [ ] Fichiers et dépendances identifiés
- [ ] **Test de non-régression planifié** — une correction sans test la
      laisse revenir
- [ ] Le cloisonnement `agencyId` est nommé explicitement si un chemin de
      données est touché

---

## 13. Quand vous êtes bloqué

- **Un blocage se signale, il ne se contourne pas en silence.** Un contournement
  non dit devient une dette que personne ne sait avoir.
- **Une règle vous paraît fausse ?** Dites-le, avec le motif, et demandez
  l'arbitrage. Ne la contournez pas.
- **Trois échecs d'affilée sur la même implémentation** : arrêtez et demandez.
- **Un arbitrage produit se demande à l'utilisateur**, et s'écrit dans la
  story avec son **motif** — dans six mois, seul le motif permettra de le
  rouvrir.
- En cas de contradiction entre deux documents : **le code fait foi**, et la
  contradiction se corrige dans le même passage.

---

## 14. Serveurs MCP — lesquels, et pour quoi faire ici

> Section ajoutée le 14-08-2026. Elle est **numérotée 14 et placée en fin de
> fichier à dessein** : insérer une section au milieu aurait décalé §7, §8 et
> §12, que les stories closes et `docs/` citent par leur numéro.

Les serveurs MCP sont déclarés **au niveau utilisateur** (`~/.claude.json`),
pas dans ce dépôt : ils suivent la machine, pas le projet. Un coéquipier
n'aura pas les mêmes. D'où cette section — **rien ici ne doit dépendre d'un
MCP pour être vérifiable.** `npx tsc --noEmit`, `npm run lint` et
`npm run test:e2e` restent la seule preuve (§9).

**Un serveur MCP est une dépendance qui n'apparaît pas dans
`package.json`.** La règle §2 « ajouter une dépendance sans accord » s'y
applique entièrement : ne pas en brancher un nouveau, ne pas en réparer un
tombé, sans accord explicite.

**Et ne jamais créer de `.mcp.json` dans ce dépôt avec une clé dedans** :
c'est exactement le chemin par lequel `mcp-config.json` a déjà fuité une clé
(§2, §12). La configuration MCP reste hors du dépôt.

### 14.1 Ceux qui servent ici, et quand

| Serveur | Ce qu'on lui demande | Ce qu'il ne remplace pas |
|---|---|---|
| **context7** | La doc réelle de Next.js 14 App Router, Prisma 5, NextAuth v5, Radix/shadcn — **avant** d'affirmer un comportement de bibliothèque | Une mesure. §7 : « le `Select` de Radix conserve sa valeur » était faux et a failli laisser deux écrans cassés. La doc oriente, la **mutation** tranche |
| **gh_grep** | Voir comment un `useFormState`, un `PrismaClient.$extends`, un `@react-pdf/renderer` s'utilisent ailleurs | Rien à cloner : c'est une API de recherche, donc **hors du piège « github.com est lent »** de §3 |
| **exa** | Recherche web quand context7 ne couvre pas la question | ⚠ **Sortant.** Ne jamais y coller de code du dépôt, d'URL interne, ni quoi que ce soit venant de `.env` |
| **sequential-thinking** | Dérouler un raisonnement long. Sans effet de bord | Une story (§1) |

**Le premier réflexe reste context7** : ce dépôt traite une affirmation non
tenue comme un défaut (§7), et la majorité de celles trouvées en revue
portaient sur le comportement supposé d'une bibliothèque.

### 14.2 Ceux qui exigent l'accord explicite de §2

Tous ceux-là **supposent l'application démarrée**, ou touchent à l'état de la
machine. §2 s'applique sans exception : on demande avant.

| Serveur | À quoi il sert quand l'accord est donné | Le danger précis |
|---|---|---|
| **lighthouse** | L'audit Lighthouse **exigé par la règle 10** avant validation finale | Il faut le projet servi (`:3002`, ou nginx `:8095`) — donc §2 |
| **chrome-devtools** | Regarder un rendu, une requête, la console ; il porte aussi un `lighthouse_audit` | Idem : rien à observer sans projet démarré |
| **playwright** | **Regarder** un écran, reproduire un pas à pas à la main | ⚠ Voir 14.3 : ce n'est **pas** un test |
| **mcp-server-docker** | Lire l'état des conteneurs, les logs de la pile `docker-compose.prod.yml` | ⚠ Il expose `remove_volume`. Le volume **`postgres_data`** *est* la base (§12, règle 5) : l'effacer est irréversible et rejoue le pire de §2 |
| **docker-mcp-gateway** | — | ⚠ Il expose `mcp-add` / `mcp-remove` / `mcp-exec` : **ajouter une dépendance sans accord**, déguisé en appel d'outil. Ne pas s'en servir pour brancher un serveur |
| **code-sandbox-mcp** | — | ⚠ Il exécute du code arbitraire. C'est un contournement possible de « ne pas démarrer le projet » : le fait que ce soit un bac à sable ne lève pas §2 |

### 14.3 Playwright MCP ne produit pas de preuve

Le point le plus facile à rater, et il est déjà écrit ailleurs — §6, piège 4 :

> **Une Server Action se rejoue, elle ne se clique pas.**

Le navigateur MCP **clique**. Il prouve donc le rendu d'un bouton, jamais la
garde derrière. Deux conséquences, non négociables :

- La couverture reste dans `tests/*.spec.ts`, jouée par `npm run test:e2e`,
  prouvée **par mutation** (§6, §9). Une session MCP ne coche aucune case de
  §9.
- Les pièges de §6 s'appliquent au navigateur MCP **à l'identique** : pas de
  conclusion tirée d'un code HTTP ni d'un `page.url()` lu après un `goto()`
  (le `loading.tsx` fait arriver un refus en `200`), et **jamais**
  `networkidle` (§2).

Et §3 tient aussi : les comptes de démonstration sont **partagés par toute la
suite**. Ne pas saturer leur compteur de tentatives en tâtonnant dans un
navigateur MCP — un compte jetable se crée avec `tests/agence.ts`.

### 14.4 Ceux qu'on n'utilise pas — et pourquoi c'est écrit

| Serveur | Motif |
|---|---|
| **filesystem** | Il double `Read`/`Edit`/`Grep` **et il contourne la garde**. Le `deny` de `.claude/settings.json` nomme l'outil `Read` ; `mcp__filesystem__read_text_file` est un autre nom d'outil, et le serveur est autorisé sur `/home/ouazene/Dev/web/fullstack/AQAR` — vérifié le 14-08-2026 via `list_allowed_directories`. Passer par lui rendrait `.env` lisible malgré le `deny`. **Utiliser les outils natifs.** |
| **nx-mcp** | Ce n'est pas un espace de travail Nx : pas de `nx.json` (vérifié le 14-08-2026) |
| **threejs**, **blender** | Aucune 3D dans le produit : `three`, `babylon`, `spline` sont absents de `package.json` (vérifié le 14-08-2026). La règle 8 fixe l'UI à shadcn/ui + Framer Motion + icônes Lucide |
| **prisma** | En échec au 14-08-2026, et **on ne le répare pas sans arbitrage** : ses outils offriraient `migrate` et `studio` sous d'autres noms que ceux que le `deny` de `.claude/settings.json` bloque. Les migrations restent des commandes, sous §2 |

Un serveur tombé n'est pas un incident à traiter dans une story en cours. S'il
faut vraiment l'un d'eux, c'est un arbitrage (§13), écrit avec son motif.
