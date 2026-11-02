---
baseline_commit: bb96dc9e00ccf8109c354340ab5fea0a2be7e14c
---

# Story 6.1 : Poser le catalogue des offres, et n'en avoir qu'un

Status: done

**Épopée :** 6 — Vendre ce que le produit tient
**Couvre :** FR-1, FR-2, FR-14
**Source :** [`docs/prds/prd-aqar-dz-offres-2026-08-15/prd.md`](../prds/prd-aqar-dz-offres-2026-08-15/prd.md) §4.1, §4.5
**Découpage :** [`docs/epics.md`](../epics.md) — Epic 6, story 6.1
**Date :** 15 août 2026

---

## Story

**En tant qu'**éditeur d'Aqar DZ,
**je veux** que les trois offres soient définies une seule fois,
**afin que** la page qui les vend et le code qui les applique ne puissent
plus diverger.

---

## L'arbitrage qui débloquait cette story

La question ouverte n° 1 du PRD — **les plafonds exacts** — était marquée
**bloquante** : rien ne pouvait s'écrire sans elle. Bilal a délégué la
décision le 15-08-2026 (« je te laisse trancher »).

**Tranché : les plafonds sont ceux de la page tarifaire, inchangés.**

| Offre | Tarif | Biens | Comptes |
|---|---|---|---|
| Starter | 2 900 DA/mois | **20** | **2** |
| Pro | 7 900 DA/mois | illimité | **10** |
| Enterprise | 19 900 DA/mois | illimité | illimité |

**Motif, et il n'y en a qu'un.** Ces chiffres sont **déjà vendus
publiquement** — ils sont en ligne dans `components/landing/PricingSection.tsx`
depuis avant cette épopée. En inventer d'autres ouvrirait une **seconde**
divergence entre ce que la page promet et ce que le produit applique,
alors que l'épopée 6 existe précisément pour fermer la première. Le
catalogue devient la source ; la page devient un lecteur.

C'est une décision **commerciale**, pas technique : elle se rouvre d'un
changement de `lib/offres.ts` et d'un déploiement, ce qui est exactement le
coût qu'a accepté l'arbitrage « catalogue en code » du 15-08-2026.

> **Ce qui reste ouvert et n'est pas de cette story.** ~~Les 15 arguments de
> vente que le produit ne tient pas (« API access », « Statistiques
> avancées », « Intégrations custom »…) restent affichés tels quels.~~ Ils
> sont désormais **portés par le catalogue**, donc à un seul endroit — les
> retirer ou les implémenter devient un geste, plus une chasse. C'est la
> question ouverte n° 2 du PRD, et elle n'est pas technique.
>
> **⚠ Cette phrase était fausse, et l'inventaire l'a montré le 16-08-2026
> (story 6.6).** Ni « 15 », ni « Statistiques avancées ». Les 19 arguments
> ont été mesurés un par un : **deux** ne désignaient rien (« API access »,
> « Intégrations custom », retirées), **six** sont des capacités livrées —
> `app/agency/statistics` fait 425 lignes et porte six graphiques —, **cinq**
> sont des engagements de service, et **six** sont les plafonds. Le vrai
> défaut restant n'est pas l'absence des capacités mais leur **absence
> d'exclusivité** : `REP-101`, story 6.7.

---

## Ce qui a été mesuré avant d'écrire

```
$ grep -rn "premium\|basic" --include="*.ts*" app/ lib/ components/ \
    | grep -v app/admin/settings
app/api/auth/register/route.ts:112:          plan: "basic",
                                                        → 1 occurrence
```

Une seule : la valeur par défaut posée à l'inscription. **L'offre ne
conditionne rien.** C'est le défaut de fond de l'épopée.

```
$ grep -rln "2 900\|7 900\|19 900" --include="*.ts*" app/ components/ lib/
components/landing/PricingSection.tsx                   → 1 fichier
```

Un seul aussi, mais ce n'est pas la même chose : ce fichier est un **écran**,
pas un catalogue. Personne d'autre ne peut lire ces tarifs, donc le code qui
applique les plafonds devrait les redire — et diverger.

```
$ grep -rn "agency.plan" --include="*.tsx" app/
app/admin/page.tsx:136          {agency.plan}
app/admin/agencies/page.tsx:261 {agency.plan}
app/admin/settings/page.tsx:169 {agency.plan}
app/agency/settings/page.tsx:106  Formule {agency.plan}
                                                        → 4 écrans
```

Quatre écrans affichent **la valeur brute de la colonne**. Une fois
l'énumération posée, ils afficheraient « starter » au lieu de « Starter » :
ils passent au catalogue dans cette story, sinon on remplace une laideur
par une autre.

---

## Acceptance Criteria

**AC-1 — un seul endroit**
**Given** un développeur cherche le tarif ou le plafond d'une offre
**When** il le cherche dans le dépôt
**Then** il le trouve dans un seul fichier
**And** `grep -rln "2 900\|7 900\|19 900" --include="*.ts*" app/ components/ lib/` renvoie **1**, et c'est `lib/offres.ts`

**AC-2 — la page tarifaire lit, elle ne redit pas**
**Given** la section tarifaire publique
**When** elle affiche ses trois colonnes
**Then** elle lit le catalogue et ne contient aucun tarif ni nom d'offre en dur

**AC-3 — l'offre attribuée est une valeur fermée**
**Given** le champ qui porte l'offre attribuée
**When** on tente d'y écrire une valeur hors catalogue
**Then** l'écriture est refusée — le champ est une énumération Prisma, et toute entrée passe par `parseForm(schema, formData)`
**And** *(précisé après mesure — voir « Ce que la mutation a corrigé »)* c'est l'**énumération** qui protège la donnée ; le schéma Zod fournit le **refus lisible**
**And** les deux `formData.get(x) as Enum` de la console (`app/admin/settings/page.tsx:57`, `app/admin/agencies/page.tsx:100`) ont disparu

**AC-4 — la reprise de l'existant**
**Given** les agences déjà en base, portant `basic` ou `premium`
**When** la migration s'applique
**Then** `basic` devient Starter et `premium` devient Pro
**And** aucune agence ne se retrouve sans offre attribuée
**And** aucune agence active ne perd l'accès, quel que soit son décompte

**AC-5 — aucun écran n'affiche la valeur brute**
**Given** l'un des quatre écrans qui montrent l'offre d'une agence
**When** il l'affiche
**Then** il montre le **nom** du catalogue (« Starter »), jamais la clé technique

---

## Ce que cette story rend atteignable (`CLAUDE.md` §8)

Question posée **avant** l'implémentation, pas après l'incident.

1. **Une valeur `plan` hors catalogue en base casserait toute lecture
   d'agence.** Prisma lève à la désérialisation d'une énumération inconnue,
   et `requireAgency()` lit l'agence à chaque requête : une seule ligne
   corrompue enfermerait l'agence entière, écran par écran. → La migration
   ne laisse **aucune** valeur non convertie : son `CASE` porte un `ELSE`
   qui rabat tout le reste sur Starter, y compris `NULL` et une chaîne
   inconnue. C'est l'AC-4, et c'est vérifié en base après application.

2. **Poser une énumération à trois valeurs pendant que la console n'offre
   qu'une bascule à deux rend `enterprise` inatteignable par l'interface.**
   C'est **assumé et temporaire** : FR-7 (« les trois offres proposées »)
   appartient à la story 6.3, qui remplace la bascule par un sélecteur.
   Rien n'est cassé — une agence Enterprise se pose en base — mais la
   console ne sait pas encore l'attribuer. Écrit ici pour que 6.3 ne
   redécouvre pas le trou.

3. **`plan` cesse d'être une chaîne : tout code qui lui comparait un
   littéral devient une erreur de compilation.** C'est voulu — c'est le
   compilateur qui trouve les appelants à la place d'un `grep`. Les cinq
   sites sont dans la File List.

4. **Aucun plafond n'est appliqué par cette story.** Le catalogue les
   *porte*, personne ne les *lit* encore. Une agence Starter peut toujours
   créer son vingt-et-unième bien. C'est la story 6.4, et c'est écrit ici
   pour que personne ne coche « quotas faits » en lisant `lib/offres.ts`.

---

## Tasks / Subtasks

- [x] **T1 — le catalogue** (AC-1)
  - [x] `lib/offres.ts` : les trois offres, tarifs, descriptions, arguments
        de vente, plafonds. `null` = illimité, jamais un grand nombre
        sentinelle.
  - [x] Un formateur de plafond, pour que « illimité » s'écrive au même
        endroit que le nombre.
- [x] **T2 — l'énumération et la reprise** (AC-3, AC-4)
  - [x] `prisma/schema.prisma` : `enum AgencyPlan`, `plan` typé, défaut
        `starter`. `npx prisma validate` : valide.
  - [x] Migration SQL écrite à la main, avec son `CASE ... ELSE`.
  - [x] **Appliquée le 16-08-2026** par l'éditeur, puis **comptée en
        base** : aucune agence hors catalogue. Relevé d'après ci-dessous.
- [x] **T3 — la page tarifaire lit le catalogue** (AC-2)
  - [x] `components/landing/PricingSection.tsx` : plus aucun tarif en dur.
- [x] **T4 — la console valide ses entrées** (AC-3)
  - [x] `lib/validations/index.ts` : `agencyPlanSchema`.
  - [x] `app/admin/settings/page.tsx` : `parseForm(agencyPlanSchema, …)`.
  - [x] `app/admin/agencies/page.tsx` : `parseForm(agencyStatusSchema, …)`
        — le schéma existait déjà et n'était appelé nulle part.
  - [x] **Et son message est devenu visible** : `/admin/agencies` n'avait
        aucun bandeau. Rediriger avec un `?error=` que personne ne lit,
        c'est le défaut fermé par la story 5.13 sur un autre écran.
- [x] **T5 — les quatre écrans nomment l'offre** (AC-5)
- [x] **T6 — la couverture** (§9)
  - [x] `tests/offres.spec.ts` : refus d'une valeur hors catalogue **et
        contrôle positif** sur le même chemin.
  - [x] **Exécutée le 16-08-2026 : 140 passed.** Preuve par mutation jouée,
        message d'échec relu — et il a **corrigé la story** (voir plus bas).
- [x] **T7 — §9** : `tsc` ✅ 0, `lint` ✅ 0, `prisma validate` ✅,
      `test:e2e` ✅ 140 passed, `sprint-status.yaml` ✅, File List ✅.
      **AC-1 recalculé au moment de clore**, et il était faux : un tarif
      s'était glissé dans un commentaire d'écran (story 6.3). Retiré — le
      grep renvoie de nouveau **1** fichier.

---

## Le blocage, dit et non contourné (`CLAUDE.md` §13)

Deux commandes manquent, et **aucune n'a été contournée**.

| Commande | Pourquoi je ne l'ai pas lancée | Décision |
|---|---|---|
| ~~`npm run db:deploy`~~ | `npm run db:deploy:*` et `npx prisma migrate:*` sont dans le `deny` de `.claude/settings.json`. C'est délibéré : les migrations restent des commandes, sous §2 | **Levé le 16-08-2026** : l'éditeur l'a lancée. Relevé d'après plus bas |
| ~~`npm run test:e2e`~~ | Démarre le projet — §2, accord explicite requis | **Levé le 16-08-2026** : accord donné, suite jouée, **140 passed** |

**Ce qui en découlait, et qui est réglé.** ~~Tant que la migration n'est
pas appliquée, la colonne `plan` est encore `text` et le produit ne
tourne pas.~~ ~~Tant que `test:e2e` n'est pas joué, AC-1 à AC-5 sont
mesurés mais pas éprouvés.~~

**Les deux blocages ont été levés le 16-08-2026**, dans cet ordre : la
migration par l'éditeur, puis la suite avec son accord explicite. Le relevé
d'après migration est plus bas, conforme à l'attendu écrit avant. Les
mutations ont été jouées et l'une d'elles a corrigé un énoncé de cette
story.

**Ce passage est conservé barré plutôt que supprimé** : il dit ce qui a
bloqué, quand, et pourquoi on n'a pas contourné. C'est ce qu'on relira le
jour où la même situation se présentera.

### La mesure d'avant, prise pendant qu'elle existait encore

Relevée le 15-08-2026, avant application, en lecture seule :

```sql
-- La commande, écrite à côté du chiffre (§7). Lecture seule.
SELECT data_type, udt_name, column_default FROM information_schema.columns
 WHERE table_name = 'agencies' AND column_name = 'plan';
SELECT "plan"::text AS offre, count(*) AS n,
       count(*) FILTER (WHERE status = 'active') AS actives
  FROM "agencies" GROUP BY 1 ORDER BY 1;
```

```
data_type=text  udt_name=text  column_default='basic'::text
basic   → 2 agences (0 active)
premium → 1 agence  (1 active)
NULL    → 0
```

**Elle ne se reprendra pas.** Une fois la migration passée, `basic` et
`premium` n'existent plus : c'est le cas typique de §8 — *une correction
peut invalider la mesure qui la démontre*. L'attendu d'après est donc écrit
ici, avant : `starter → 2 (0 active)`, `pro → 1 (1 active)`,
`udt_name = AgencyPlan`, aucune agence sans offre, et **l'agence active
reste active**.

### La mesure d'après, relevée le 16-08-2026

Migration appliquée par l'éditeur (`npm run db:deploy`), puis relecture en
lecture seule. **Le relevé correspond ligne pour ligne à l'attendu écrit
ci-dessus, qui n'a pas été retouché après coup.**

```
plan            : udt_name=AgencyPlan  défaut='starter'::"AgencyPlan"  NOT NULL
requested_plan  : udt_name=AgencyPlan  défaut=aucun                    NULLABLE
enum AgencyPlan : starter, pro, enterprise

starter → 2 agences (0 active)     ← attendu : 2 (0 active)   ✅
pro     → 1 agence  (1 active)     ← attendu : 1 (1 active)   ✅
sans offre attribuée        : 0    ← attendu : 0             ✅
avec une offre demandée     : 0    ← attendu : 0             ✅
Agence Démo : plan=pro, status=active                        ✅
```

Trois vérifications que ce relevé permet, et qui comptaient :

1. **`premium` est devenu `pro`, et l'agence active l'est restée.** C'était
   le risque du `CASE` : une agence perdue en route se serait vue refuser
   l'accès à *chaque* requête, `requireAgency()` relisant l'agence en base.
2. **`requested_plan` est nullable et sans défaut**, et personne ne l'a.
   « Aucune demande » est bien un état, pas un trou comblé par un défaut
   (story 6.2).
3. **L'agence de démonstration porte `pro`.** C'est ce qui tient
   `features.spec.ts` debout : en Starter, son plafond de comptes serait de
   2 — exactement son décompte — et le test échouerait (story 6.4).

---

## Dev Notes

### `null` pour illimité, et pas `Infinity`

`Infinity` ne survit pas à `JSON.stringify` (il devient `null`), et un grand
nombre sentinelle (`999999`) finit toujours par s'afficher quelque part.
`null` se lit, se sérialise, et **oblige** à traiter le cas au lieu de le
laisser passer dans une comparaison numérique. Le typage l'impose :
`number | null`.

### `AgencyPlan`, mais on dit « offre »

Le type Prisma s'appelle `AgencyPlan` — comme `AgencyStatus`, `UserRole`,
`PropertyType` : la convention des énumérations de ce schéma est l'anglais
en `PascalCase`, et la colonne s'appelle déjà `plan`. **Rien de tout cela
n'est vu par un utilisateur.** Dans les écrans, les messages et le
glossaire, on dit **offre** (PRD §3). Le module s'appelle `lib/offres.ts`,
comme `lib/corbeille.ts`.

### La migration ne peut pas s'appliquer depuis ici

`.claude/settings.json` interdit `npx prisma migrate:*` et `npm run
db:deploy:*`. **C'est délibéré et ça ne se contourne pas** (`CLAUDE.md` §13).
La migration est écrite dans le dépôt, et son application est demandée à
l'éditeur — une commande, une fois.

### Le pattern d'entrée

`parseForm(schema, formData)` (`lib/form.ts`) renvoie `{ ok, data }` ou
`{ ok, message }` ; l'échec repart en `redirect(withError(BASE, message))`.
`redirect()` lève `NEXT_REDIRECT` : jamais de `try/catch` autour
(`CLAUDE.md` §11).

### Le test doit prouver deux choses, pas une

`CLAUDE.md` §6 : un refus attendu ne prouve rien tant qu'un succès n'est pas
constaté **sur le même chemin**. Une action cassée pour tout le monde donne
exactement le même vert qu'une action correctement validée. Donc :
rejeu avec `plan=premium` (valeur morte) → refusé **et la ligne n'a pas
bougé** ; rejeu avec `plan=enterprise` → **accepté et la ligne a changé**.

Et la Server Action **se rejoue, elle ne se clique pas** (§6, piège 4) : le
formulaire est relevé dans le HTML servi, jamais son identifiant écrit en
dur.

---

## La preuve par mutation, et ce qu'elle a corrigé

Jouée le 16-08-2026. `agencyPlanSchema` : `z.nativeEnum(AgencyPlan)` →
`z.string().transform(v => v as AgencyPlan)`. Test rejoué :
`tests/offres.spec.ts` — **1 rouge, 2 verts**.

**Le résultat n'est pas celui que la story affirmait**, et c'est pour cela
qu'on mute :

| Ce qui était écrit | Ce que la mesure dit |
|---|---|
| « l'écriture est refusée — le champ est une énumération **et** toute entrée passe par `parseForm` » | La donnée est protégée par l'**énumération PostgreSQL seule**. Sans le schéma Zod, l'assertion « l'offre n'a pas changé » reste **VERTE** |

Ce qui tombe sans le schéma, c'est le **refus lisible** : le serveur lève
`PrismaClientValidationError` en 500 au lieu d'afficher « Offre inconnue ».
Seule l'assertion souple sur le message a rougi.

**`agencyPlanSchema` fournit le message et la sortie propre, pas le
verrou.** Les deux comptent — mais confondre lequel fait quoi coûterait
cher le jour où l'on voudra en retirer un. Le commentaire de
`lib/validations/index.ts` porte désormais cette mesure.

### Une erreur de méthode, et sa correction

Cette mutation avait d'abord été jouée **groupée** avec celle de la garde
de rôle de `setPlan` (story 6.3). Les deux touchent la même action, et
`offres.spec.ts` l'exerce : le rouge venait de la garde de rôle — un super
administrateur n'a pas d'agence, donc `requireAgencyAdmin()` le refusait et
l'action ne tournait pour personne. **Un rouge dont on ne sait pas d'où il
vient ne prouve rien.** Rejouée seule, elle donne le résultat ci-dessus.

---

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m]

### Debug Log References

`npx prisma validate` → valide · `npx prisma generate` → client régénéré,
`AgencyPlan` présent dans `node_modules/.prisma/client/index.d.ts:142`.

`npx tsc --noEmit` → **0 erreur**, après avoir traversé les deux seules
erreurs qu'il ait levées :

```
prisma/seed.ts(53,7): TS2322: Type '"premium"' is not assignable to type 'AgencyPlan | undefined'.
prisma/seed.ts(76,7): TS2322: Type '"basic"' is not assignable to type 'AgencyPlan | undefined'.
```

**C'est l'effet recherché**, annoncé au point 3 de « ce que cette story rend
atteignable » : la colonne cesse d'être une chaîne, et le compilateur trouve
les appelants à la place d'un `grep`. Ces deux-là étaient dans la graine,
c'est-à-dire dans le décor de toute la suite E2E — un `grep` sur `app/` les
aurait manqués.

`npm run lint` → **0 erreur** (4 avertissements `no-img-element`,
préexistants et hors périmètre).

### Completion Notes List

**Les trois greps d'acceptation, relancés après coup et non recopiés (§7) :**

```
$ grep -rln "2 900\|7 900\|19 900" --include="*.ts*" app/ components/ lib/
lib/offres.ts                                            → 1  ✅ AC-1

$ grep -rn "formData.get(.*) as " --include="*.ts*" app/admin/
app/admin/settings/page.tsx:100  formData.get("agencyId") as string
                                                         → AC-3 ✅
```

Les deux `as Enum` ont disparu. Le `as string` restant porte un
identifiant, pas une énumération — il est dans `toggleShowcase`, hors
périmètre de cette story, et §2 vise nommément `formData.get(x) as Enum`.

**Ce que j'ai touché en plus du périmètre annoncé, et pourquoi.** Quatre
fichiers ne figuraient pas dans le découpage de `docs/epics.md` :

- `app/admin/page.tsx` et `app/agency/settings/page.tsx` — ils affichaient
  la valeur brute de la colonne. Sans eux, la livraison remplaçait
  « Formule basic » par « Formule starter » : une laideur pour une autre.
  C'est l'AC-5, ajouté à l'écriture de la story pour cette raison.
- `app/api/auth/register/route.ts` — il écrivait `plan: "basic"` en dur.
  Le laisser ne compilait pas.
- `prisma/seed.ts` — voir le Debug Log. La graine doit dire ce que dit la
  base migrée, sinon la rejouer ferait diverger le décor de la suite.

**Ce qui reste ouvert, et qui n'est pas un oubli :**

1. **`enterprise` n'est pas atteignable depuis la console.** La bascule de
   `/admin/settings` ne produit que deux valeurs. La Server Action, elle,
   accepte les trois — et le test le prouve en l'attribuant. Le sélecteur
   est la story 6.3.
2. **Aucun plafond n'est appliqué.** Le catalogue les porte, personne ne les
   lit. Story 6.4.
3. **Les 15 arguments de vente non tenus** restent affichés. Ils sont
   désormais à un seul endroit, ce qui rend la décision faisable — c'est la
   question ouverte n° 2 du PRD, et elle est commerciale.

### File List

**Nouveaux**

- `lib/offres.ts` — le catalogue, source unique
- `prisma/migrations/20260815000000_agency_plan_enum/migration.sql`
- `tests/offres.spec.ts`
- `docs/stories/6-1-poser-le-catalogue-des-offres.md` *(ce fichier)*

**Modifiés**

- `prisma/schema.prisma` — `enum AgencyPlan`, `plan AgencyPlan @default(starter)`
- `prisma/seed.ts` — `premium` → `pro`, `basic` → `starter`
- `lib/validations/index.ts` — `agencyPlanSchema`, import `AgencyPlan`
- `components/landing/PricingSection.tsx` — lit `CATALOGUE`
- `app/admin/settings/page.tsx` — `parseForm(agencyPlanSchema)`, libellés
- `app/admin/agencies/page.tsx` — `parseForm(agencyStatusSchema)`,
  `FormMessage`, colonne « Offre »
- `app/admin/page.tsx` — colonne « Offre », `nomOffre()`
- `app/agency/settings/page.tsx` — `nomOffre()`
- `app/api/auth/register/route.ts` — `OFFRE_PAR_DEFAUT`
- `docs/stories/sprint-status.yaml` — épopée 6 et story 6.1 `in-progress`
- `docs/prds/prd-aqar-dz-offres-2026-08-15/.memlog.md` — l'arbitrage des
  plafonds
