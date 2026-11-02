---
baseline_commit: 7409b6e
---

# Story 6.3 : Attribuer l'offre dans le geste d'approbation

Status: done

**Épopée :** 6 — Vendre ce que le produit tient
**Couvre :** FR-6, FR-7, FR-8 · **Réalise :** UJ-2
**Source :** [`docs/prds/prd-aqar-dz-offres-2026-08-15/prd.md`](../prds/prd-aqar-dz-offres-2026-08-15/prd.md) §4.3
**Découpage :** [`docs/epics.md`](../epics.md) — Epic 6, story 6.3
**Dépend de :** 6.1, 6.2
**Date :** 15 août 2026

---

## Story

**En tant que** super administrateur,
**je veux** voir ce qui a été demandé et trancher au moment où j'approuve,
**afin de** ne pas vendre ce que je n'ai pas encaissé, sans pour autant
multiplier les écrans.

---

## Les deux moments, et pourquoi deux écrans

| | Attribution **initiale** | Changement **à froid** |
|---|---|---|
| Où | `/admin/agencies` | `/admin/settings` |
| Quand | au moment d'approuver une agence `pending` | sur une agence déjà active |
| Le geste | **un seul clic** — le sélecteur est pré-rempli avec la demande | choisir, puis « Attribuer » |
| Ce qu'il journalise | statut **et** écart demande → attribution | ancienne → nouvelle offre |

Le sélecteur pré-rempli est le cœur de UJ-2 : **ne rien faire revient à
accorder ce qui a été demandé**, ce qui est le cas courant. L'éditeur ne
corrige que quand il a une raison — et cette correction-là est précisément
ce que le journal doit retenir.

---

## Ce qui a été mesuré avant d'écrire

```bash
grep -rn 'name="plan"\|input\[value="active"\]' tests/
```

- `tests/offres.spec.ts:69,119` — **le rejeu de la story 6.1 cible
  `input[name="plan"]`.** Passer le contrôle en `<select>` le cassait net.
  Réparé dans cette story.
- `tests/regression.spec.ts:438,1627` — cliquent
  `form:has(input[value="active"]) button`. Le `<select>` ajouté dans ce
  formulaire n'est pas un `button` : le sélecteur reste exact, **une seule
  correspondance**. Inchangés.

L'écran `/admin/settings` proposait **deux** offres en bascule. `enterprise`
existait en base, se vendait 19 900 DA sur la page d'accueil, et **n'était
attribuable par aucun écran**.

---

## Acceptance Criteria

**AC-1 (FR-6)** — **Given** une agence `pending` porteuse d'une offre
demandée
**When** un super administrateur ouvre `/admin/agencies`
**Then** la ligne affiche l'offre demandée, ou **« aucune »** si elle est
nulle

**AC-2 (FR-7)** — **Given** un super administrateur qui approuve sans
toucher au sélecteur
**When** il clique le bouton d'activation
**Then** l'offre demandée devient l'offre attribuée
**And** l'opération reste **un seul clic**

**AC-3 (FR-7)** — **Given** un super administrateur qui attribue autre chose
que ce qui a été demandé
**When** il approuve
**Then** c'est cette offre-là qui est attribuée
**And** `recordAudit()` inscrit **qui, quand, quelle agence**, et l'**écart
demande → attribution**

**AC-4 (FR-7)** — **Given** une agence déjà active
**When** un super administrateur change son offre
**Then** les **trois** offres lui sont proposées, pas une bascule entre deux
**And** le changement est journalisé, ancienne et nouvelle offre nommées

**AC-5 (FR-8)** — **Given** un `agency_admin`
**When** il rejoue la Server Action de changement d'offre sur **sa propre**
agence
**Then** elle est refusée — le contrôle est **dans l'action**, pas dans
l'écran

---

## Ce que cette story rend atteignable (`CLAUDE.md` §8)

1. **Le geste de statut écrit maintenant aussi l'offre.** `updateAgencyStatus`
   sert **trois** boutons : activer, suspendre, remettre en attente. Seul le
   premier porte un `plan`. **Le jour où quelqu'un remplacera l'absence par
   un défaut, chaque suspension rétrogradera l'agence en Starter,
   silencieusement.** C'est pourquoi le code écrit
   `data: plan ? { status, plan } : { status }` plutôt que
   `plan: plan ?? "starter"`, et pourquoi un test suspend une agence
   Enterprise et vérifie qu'elle le reste.

2. **Un `<select>` remplace un `<input type="hidden">`.** Le rejeu de la
   story 6.1 ciblait l'input et cassait. Réparé — et la réparation est plus
   fidèle : le helper **remplace** le contrôle par un champ caché au lieu de
   lui poser une valeur, parce qu'un `<select>` refuse une valeur absente de
   ses options. Sans cela, le test aurait posté un `plan` **vide** et lu le
   refus d'un champ manquant là où il croit éprouver le refus d'une valeur
   hors catalogue.

3. **La demande n'est jamais effacée par l'attribution.** `requestedPlan`
   survit à l'approbation. C'est ce qui permettra, dans six mois, de
   répondre à « on m'avait promis Pro ». Deux tests l'asservissent.

4. **Un super administrateur peut désormais attribuer Enterprise.** Ce qui
   était impossible devient un clic — et n'est plafonné par rien, puisque
   les plafonds arrivent en 6.4. Aucun risque aujourd'hui ; à surveiller
   quand 6.4 posera les quotas, car **descendre** une agence d'Enterprise à
   Starter la mettra instantanément au-dessus de son plafond. C'est le
   scénario que 6.4 doit traiter **sans rien détruire**.

---

## Tasks / Subtasks

- [x] **T1 — Le catalogue.** `nomOffreDemandee()` : « aucune » s'écrit à un
      seul endroit, pour qu'une cellule vide ne pousse jamais à « corriger »
      la donnée en y posant un défaut.
- [x] **T2 — Le schéma.** `agencyStatusSchema` gagne un `plan` **optionnel**.
- [x] **T3 — L'approbation.** `/admin/agencies` : la demande s'affiche, le
      sélecteur est pré-rempli, un clic approuve et attribue.
- [x] **T4 — Le journal.** L'écart demande → attribution, dans les deux
      écrans, avec qui et quand.
- [x] **T5 — Le changement à froid.** `/admin/settings` : trois offres, plus
      une bascule. Une offre inchangée ne s'écrit pas et ne se journalise
      pas.
- [x] **T6 — Le rejeu de 6.1 réparé.** `tests/offres.spec.ts`.
- [x] **T7 — Les tests.** `tests/attribution-offre.spec.ts`, 4 cas.
- [x] **T8 — La preuve.** `npm run test:e2e` exécutée le 16-08-2026 :
      **140 passed**. Deux mutations séparées, deux rouges attribuables.
- [x] **T9 — Les contrôles.** `npx prisma validate` ✅ · `npx tsc --noEmit`
      ✅ 0 · `npm run lint` ✅ 0 erreur · `test:e2e` ✅ 140 verts.

---

## Le blocage, dit et non contourné (`CLAUDE.md` §13)

~~Les deux migrations attendent `npm run db:deploy`~~ — **appliquées le
16-08-2026** par l'éditeur, la commande étant dans le `deny` de
`.claude/settings.json`. `requested_plan` existe désormais en base.

~~**Ce qui reste bloqué :** `npm run test:e2e` démarre le projet (§2) et n'a
pas été jouée. AC-1 à AC-5 sont **mesurés par la compilation, pas éprouvés
par l'exécution**.~~

**Débloqué le 16-08-2026** par un accord explicite de l'éditeur : `npm run
test:e2e` → **140 verts, 1,7 min, sortie 0**. AC-1 à AC-5 sont éprouvés par
l'exécution ; `tests/attribution-offre.spec.ts` (4 cas) les porte.

**Deux mutations, et l'une a corrigé cette story au lieu de la confirmer.**

- *Retirer l'attribution du geste d'approbation* → rouge attendu, message
  juste : « approuver n'a pas attribué l'offre demandée ».
- *Remplacer `z.nativeEnum(AgencyPlan)` par `z.string()` dans
  `agencyPlanSchema`* → **l'assertion sur la donnée est restée VERTE**.
  Cette story affirmait que l'écriture est refusée « parce que le champ est
  une énumération **et** que tout passe par `parseForm` » : c'est faux. Le
  verrou est l'énumération PostgreSQL, **seule**. Ce que le schéma Zod
  fournit, c'est le **refus lisible** — sans lui, une valeur hors catalogue
  produit un `PrismaClientValidationError` en 500 au lieu de « Offre
  inconnue ». Le commentaire de `lib/validations/index.ts` a été réécrit en
  conséquence.

⚠ **Erreur de méthode, gardée pour qu'elle ne se répète pas.** Cette
mutation avait d'abord été jouée en même temps que celle de la garde de
rôle : les deux touchent `setPlan`. Le rouge venait de la garde — un
`super_admin` n'a pas d'agence, donc `requireAgencyAdmin()` le refusait et
l'action ne tournait plus pour personne. **Un rouge dont on ne sait pas d'où
il vient ne prouve rien.** Rejouée seule.

---

## Dev Notes

### Un `select` natif, et pas celui de Radix

`CLAUDE.md` §7 nomme l'hypothèse exacte qui a coûté cher ici : « le `Select`
de Radix conserve sa valeur, donc ces deux écrans sont épargnés » — faux, et
la mutation l'a montré. Les deux sélecteurs de cette story sont des `<select>`
**natifs** : ils postent leur valeur avec le formulaire, sans état React à
maintenir, et un rendu serveur suffit. C'est un choix, pas un oubli.

### Pourquoi `changement_statut` et pas une nouvelle action d'audit

`AuditAction` est une union fermée, lue par les écrans de journal. En
ajouter une valeur demande d'en vérifier tous les consommateurs — hors
périmètre. `updateSubscription` avait déjà créé le précédent :
`action: "changement_statut"`, `entity: "abonnement"`. Cette story suit,
avec `entity: "offre"`.

### Une offre inchangée n'est pas un succès à annoncer

`setPlan` sort tôt quand la valeur soumise égale celle en base. Motif :
c'est ce journal qu'on lira le jour où une agence contestera son offre, et
le remplir de lignes qui ne disent rien le rendrait inutilisable. Le message
retourné le dit — « Offre inchangée : X » — plutôt que d'annoncer une mise à
jour qui n'a pas eu lieu.

### Les deux jambes du test de rôle partent de la même adresse

Un `agency_admin` ne peut pas atteindre `/admin/settings`, et un
`super_admin` ne peut pas atteindre `/agency` : jouer le refus et le
contrôle positif depuis les écrans « naturels » les aurait mis sur **deux
chemins différents**, et le contrôle positif n'aurait pas éprouvé le
scénario du refus. Les deux partent donc de la page d'accueil, publique.

**Bénéfice second, voulu :** si Next refusait de router une Server Action
depuis une route qui ne la rend pas, c'est le **contrôle positif** qui
tomberait bruyamment — au lieu du refus qui passerait pour une garde.
Le rejeu de `roles.spec.ts` part toujours de l'écran d'origine ; **c'est le
premier de ce dépôt à en changer**, et c'est à vérifier en priorité quand la
suite tournera.

---

## La preuve par mutation

Jouée le 16-08-2026, **deux mutations séparées** — voir plus bas pourquoi
elles ne pouvaient pas être groupées.

| Mutation | Test rougi | Message d'échec |
|---|---|---|
| `data: plan ? { status, plan } : { status }` → `data: { status }` | *approuver sans toucher au sélecteur* | « approuver n'a pas attribué l'offre demandée — l'éditeur croit avoir vendu Pro et l'agence reste en Starter » |
| `requireSuperAdmin()` → `requireAgencyAdmin()` dans `setPlan` | *un `agency_admin` ne peut pas s'attribuer une offre* | « un agency_admin s'est attribué Enterprise en rejouant l'action — le contrôle est dans l'écran, pas dans l'action » |

### Ce que la première exécution a appris, et qui n'était écrit nulle part

**Une Server Action ne se rejoue pas depuis n'importe quelle route.** Next
résout l'identifiant d'action dans le manifeste de la route **visée** ;
postée vers `/`, elle lève `TypeError: e[o] is not a function` dans
`decodeAction` — côté serveur, sans jamais atteindre la garde.

C'est **le contrôle positif qui est tombé**, exactement comme la story
l'avait prévu en le construisant ainsi. Dans l'autre sens, l'`agency_admin`
aurait été « refusé » par une erreur 500 et le test serait passé au vert
en ne prouvant rien. Le rejeu pose désormais l'adresse sur le formulaire
au lieu de l'hériter de l'URL courante.

---

## Dev Agent Record

### Debug Log References

Aucune erreur de compilation. Le seul défaut réel introduit — le rejeu de la
story 6.1 cassé par le passage en `<select>` — **n'était pas détectable par
`tsc`** : c'est un sélecteur CSS dans une chaîne. Il a été trouvé par le
`grep` de la question §8, pas par un outil.

### Completion Notes List

**Fait :**
- L'attribution entre dans le geste d'approbation, pré-remplie avec la
  demande : ne rien faire accorde ce qui a été demandé.
- Enterprise devient attribuable. Il ne l'était par aucun écran depuis
  toujours, alors qu'il se vend sur la page d'accueil.
- L'écart demande → attribution est journalisé même quand il est nul.
- Le rejeu de 6.1 est réparé, et de façon plus fidèle qu'avant.

**Non fait, et pourquoi :**
- **T8.** Ni `test:e2e`, ni la preuve par mutation : la suite démarre le
  projet (§2). Les migrations, elles, sont appliquées depuis le 16-08-2026.

**Laissé ouvert à dessein :**
- `/admin/settings` n'affiche pas l'offre demandée — seule `/admin/agencies`
  le fait, et c'est là que la décision se prend. Ajouté en base au `select`
  du premier écran, ce serait du bruit.
- Aucun plafond n'est appliqué. Story 6.4.

### File List

**Nouveaux (1)**
- `tests/attribution-offre.spec.ts`

**Modifiés (6)**
- `lib/offres.ts`
- `lib/validations/index.ts`
- `app/admin/agencies/page.tsx`
- `app/admin/settings/page.tsx`
- `tests/offres.spec.ts`
- `docs/stories/sprint-status.yaml`
