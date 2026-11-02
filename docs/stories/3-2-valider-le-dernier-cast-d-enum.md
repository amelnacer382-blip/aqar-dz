---
baseline_commit: 2dac690
---

# Story 3.2 : Valider le dernier cast d'énumération

Status: done *(17-08-2026 — sept sites fermés, quatre mutations jouées
séparément. `BUG-06` et `BUG-38` corrigés. Aucune tâche ne relève de
l'éditeur.)*

**Épopée :** 3 — Fiabiliser les données et la tenue à la charge
**Couvre :** `BUG-06` (n° audit 12) et `BUG-38` (relevé par cette story)
**Ouverte le :** 17-08-2026

---

## Story

As a **super admin**,
I want **qu'un statut invalide produise un message et non une erreur Prisma en pleine page**,
So that **la console se comporte comme le reste du logiciel.**

---

## Ce que la mesure a changé au périmètre

La story a été ouverte pour fermer **un** cast, désigné par `BUG-06` :

```ts
// app/admin/agencies/page.tsx:100 — tel que l'audit l'a relevé
const status = formData.get("status") as "pending" | "active" | "suspended"
```

**Ce cast n'existe plus.** Il a été remplacé par
`parseForm(agencyStatusSchema, formData)` dans le commit `92f826b`
(« faire des offres une donnée du produit »), en **effet de bord de
l'épopée 6** — pas par une story qui le portait, et sans que `BUG-06`
soit refermé au registre. Mesuré le 17-08-2026 :

```bash
git log --oneline -L 129,140:app/admin/agencies/page.tsx
# 66e36a0 feat(story-6.3) ...
# 92f826b feat(epic-6)  ← -    const status = formData.get("status") as ...
#                          +    const parsed = parseForm(agencyStatusSchema, formData)
```

Il reste donc **deux** choses à faire sur `BUG-06`, et aucune n'est le
correctif : le **prouver** — rien dans la suite ne vérifie qu'un statut
forgé produit un message français — et le **consigner**.

### Le balayage exigé par l'AC-3 en a trouvé sept, pas un

L'AC-3 demande de chercher **dans le projet entier**. Elle a été lancée,
et c'est elle qui a fait grossir la story :

```bash
grep -rn " in [A-Z_]*LABELS" --include=*.ts --include=*.tsx app lib components
```

Sept sites acceptent une valeur venue de l'extérieur, la confrontent à
une table d'étiquettes avec l'opérateur `in`, puis la castent vers une
énumération Prisma. **L'opérateur `in` remonte la chaîne de prototypes.**

Ce dépôt le sait déjà — `lib/offres.ts:294` le dit noir sur blanc et
utilise `Object.prototype.hasOwnProperty.call` pour cette raison exacte.
La leçon n'avait été appliquée qu'à ce fichier-là.

### La mesure, 17-08-2026

Sur la forme réelle des tables (`Record<string, string>` littérales) :

```
PASSE  "nouveau"   PASSE  "traite"      PASSE  "archive"      ← les vrais statuts
refuse "supprime"  refuse ""                                  ← ce que la garde attrape
PASSE  "constructor"  PASSE  "toString"     PASSE  "valueOf"
PASSE  "__proto__"    PASSE  "hasOwnProperty"  PASSE  "isPrototypeOf"
```

Six valeurs franchissent la garde sans être des statuts. Ce qu'elles
deviennent une fois castées et remises à Prisma, mesuré contre la base de
développement le même jour :

```
LECTURE  OK     status="nouveau"     -> 34 ligne(s)
LECTURE  REFUSE status="constructor" -> PrismaClientValidationError
LECTURE  REFUSE status="toString"    -> PrismaClientValidationError
LECTURE  REFUSE status="__proto__"   -> PrismaClientValidationError
ECRITURE REFUSE status="constructor" -> PrismaClientValidationError
```

### Ce que ce défaut est, et ce qu'il n'est pas

**Il ne corrompt aucune donnée.** La colonne est une énumération
PostgreSQL : elle refuse, et c'est déjà écrit dans ce dépôt — le
commentaire de `agencyPlanSchema` porte la même mesure, faite par
mutation le 16-08-2026, et la conclusion s'applique ici mot pour mot.

Ce qui tombe, c'est le **refus lisible** : `PrismaClientValidationError`
levée dans le rendu d'un Server Component, donc une page d'erreur
technique, au lieu du message français reçu partout ailleurs. C'est
exactement le symptôme que `BUG-06` décrit — il survit dans six autres
écrans.

**Le plus exposé n'est pas dans la console.** `/vitrine/{slug}` est
public et non authentifié : `?type=constructor` suffit.

### Les sept sites

| # | Fichier | Chemin | Ce qui entre |
|---|---|---|---|
| 1 | `app/admin/agencies/page.tsx` | écriture | `status` — **déjà corrigé**, à prouver |
| 2 | `app/agency/leads/page.tsx:88` | écriture | `status` d'un message — cast `as "nouveau" \| "traite" \| "archive"` |
| 3 | `app/agency/leads/page.tsx:47` | lecture | filtre `?status=` |
| 4 | `app/agency/payments/page.tsx:61` | lecture | filtre `?type=` |
| 5 | `app/agency/payments/page.tsx:68` | lecture | filtre `?status=` |
| 6 | `app/vitrine/[slug]/page.tsx:95` | lecture | filtre `?operation=` — **public** |
| 7 | `app/vitrine/[slug]/page.tsx:99` | lecture | filtre `?type=` — **public** |

### Pourquoi les sept, et pas les deux du périmètre littéral

Le titre de la story dit « le **dernier** cast ». Une story dont
l'énoncé est « il en reste un, on le ferme » ne peut pas s'achever sur
« il en restait sept, j'en ai fermé deux » — et son AC-3, qui exige
explicitement qu'**il n'en reste aucun** dans le projet entier, serait
cochée à tort (§9).

Le correctif est par ailleurs **une fonction et six appels**. Poser cette
fonction pour deux sites en laissant quatre appelants du motif qu'on
vient de documenter comme troué, c'est la demi-correction contre laquelle
§8 met en garde.

`BUG-38` est ouvert au registre pour porter les six sites nouvellement
relevés : le constat existe indépendamment de cette story, et doit rester
lisible si elle est un jour rouverte.

### §8 — ce que la correction rend atteignable

| Changement | Ce qui devient atteignable | Décision |
|---|---|---|
| `setStatus` passe par `parseForm` | `id` devient validé (`requiredId` = `min(1)`) : un `id` vide rend « Sélection requise » au lieu de « Message introuvable » | Accepté — les deux refusent, le premier est plus juste |
| Filtres : `in` → `hasOwnProperty` | `?status=constructor` n'est plus « connu » : le filtre est **ignoré**, la liste s'affiche entière | Voulu. `lib/offres.ts` a tranché ce point : une valeur inconnue dans une URL pose l'écran sans présélection, pas une page d'erreur |
| `label()` durci de la même façon | `label(MAP, "toString")` rendait la **fonction** `Object.prototype.toString`, remise à React comme enfant | Corrigé dans la foulée : même fichier, même piège, un mot |

Ce qui **n'est pas** rendu atteignable : aucune donnée nouvelle n'entre
en base. Les sept chemins refusaient déjà au niveau de la colonne.

---

## Acceptance Criteria

### AC-1 — Le statut d'agence passe par un schéma

**Given** `agencyStatusSchema` existe
**When** `updateAgencyStatus` s'exécute
**Then** l'entrée passe par `parseForm(agencyStatusSchema, formData)`

*Déjà satisfait par `92f826b`. Cette story le prouve et le consigne.*

### AC-2 — Un statut forgé produit un message, pas une exception

**Given** une valeur de statut arbitraire postée à la main sur
`/admin/agencies`
**When** l'action s'exécute
**Then** elle redirige avec un message français lisible
**And** le statut de l'agence est **inchangé**
**And** un rejeu identique portant un statut **valide** change bien le
statut — sans quoi le premier constat ne prouverait rien (§6, piège 1)

### AC-3 — Il ne reste aucun cast d'énumération non validé

**Given** le projet entier
**When** on lance le balayage, commande écrite dans la story
**Then** aucun site ne confronte une valeur externe à une table
d'étiquettes avec `in` avant de la caster vers une énumération Prisma

### AC-4 — Le message d'un lead refuse un statut inconnu, lisiblement

**Given** `status=constructor` posté sur `/agency/leads`
**When** l'action s'exécute
**Then** elle redirige avec un message français
**And** le statut du message est inchangé
**And** un rejeu portant `traite` le change bien

### AC-5 — Un filtre d'URL inconnu n'écroule aucun écran

**Given** `/vitrine/{slug}?type=constructor`, servi sans authentification
**When** la page est demandée
**Then** elle s'affiche, filtre ignoré — aucune page d'erreur

### AC-6 — Prouvé par mutation

**Given** la garde retirée, une à une
**When** la suite est rejouée
**Then** exactement le cas visé rougit, et son message désigne la
propriété visée

---

## Tasks / Subtasks

- [x] **T1** — Consigner l'antériorité de `BUG-06` : commit, date, motif
      de sa fermeture sans story (AC-1)
- [x] **T2** — Poser le prédicat sûr dans `lib/labels.ts`, avec le motif
      et la mesure (AC-3)
- [x] **T3** — `leadStatusSchema` dans `lib/validations/index.ts`, sur
      `z.nativeEnum(LeadStatus)` (AC-4)
- [x] **T4** — `setStatus` de `/agency/leads` passe par `parseForm` (AC-4)
- [x] **T5** — Les cinq filtres de lecture passent par le prédicat sûr,
      `label()` avec eux (AC-3, AC-5)
- [x] **T6** — Tests : statut d'agence forgé, statut de lead forgé,
      vitrine publique, listes de l'agence — chacun avec son contrôle
      positif (AC-2, AC-4, AC-5)
- [x] **T7** — Mutations, jouées séparément (AC-6)
- [x] **T8** — `npx tsc --noEmit`, `npm run lint`, `npm run test:e2e`
- [x] **T9** — Registre : `BUG-06` corrigé, `BUG-38` ouvert et corrigé ;
      `sprint-status.yaml` ; `epics.md`

---

## Dev Notes

### Où la correction est un schéma, et où elle est un prédicat

Les deux chemins n'ont pas la même exigence, et les confondre produirait
un écran d'erreur là où il faut une liste :

- **Écriture** (une Server Action change quelque chose) → **schéma Zod +
  `parseForm`**. Une valeur inconnue est une faute : elle mérite un refus
  nommé, journalisable, affiché.
- **Lecture** (un filtre venu de l'URL) → **prédicat sûr**, valeur
  ignorée si inconnue. Un signet périmé ne doit pas rendre un écran
  inaccessible. C'est la décision déjà prise et écrite dans
  `lib/offres.ts` pour `offreDuCatalogue`.

### Le test qui ne doit pas manquer

Une Server Action **se rejoue**, elle ne se clique pas (§6, piège 4) :
`tests/formulaire.ts` relève le formulaire servi, en force les champs,
et rend l'URL d'arrivée. L'identifiant d'action n'est jamais écrit dans
un test — il est calculé au `build`.

Et le contrôle positif est obligatoire : « le statut n'a pas changé » est
**exactement** ce qu'on observerait si l'action était cassée pour tout le
monde.

### References

- `docs/qa/bug-report.md` — `BUG-06`, `BUG-38`
- `lib/offres.ts:290-310` — le prédicat sûr, son motif, sa date
- `lib/validations/index.ts` — `agencyPlanSchema` : la même mesure, faite
  par mutation le 16-08-2026
- `CLAUDE.md` §6 (pièges 1 et 4), §7 (mesurer), §8 (déplacer avant de
  fermer)

---

## Preuves — 17-08-2026

### T7 — quatre mutations, jouées séparément

Chacune est précédée d'un `tsc` et d'un `lint` : une mutation qui casse le
build produirait un rouge qui ne vient pas du test (§6, piège 3). Les
quatre sont restées valides.

| Mutation | Rouges | Le cas, et son message |
|---|:---:|---|
| **M1** — `estCleConnue` redevient `in` | **2** | vitrine publique : *« `?type=constructor` a été remplacé par une page d'erreur »* · listes de l'agence : *« `/agency/leads?status=constructor` a été remplacé par une page d'erreur »* |
| **M2** — `leadStatusSchema.status` accepte tout | **1** | *« le refus n'annonce rien de lisible »* |
| **M3** — `agencyStatusSchema.status` accepte tout, c'est `BUG-06` remis en place | **1** | *« le refus n'annonce rien de lisible »* |
| **M4** — le prédicat refuse **tout** | **2** | les deux **contrôles positifs** : *« le filtre ne filtre plus — un appartement ressort sur une recherche de hangar »* |

**M4 est la mutation qui vaut le plus.** Les trois cas forgés seraient
verts avec un prédicat qui refuse tout — il n'y aurait plus de filtre du
tout, donc plus de page d'erreur. Sans le contrôle positif, la correction
serait indiscernable de sa caricature.

### Ce que M2 et M3 ont révélé du test lui-même

Sous ces deux mutations, l'assertion « **le statut n'a pas changé** » est
restée **verte**. C'est normal, et c'est le fait le plus important de
cette story : la colonne est une énumération PostgreSQL, elle refuse de
son côté. La donnée n'a jamais eu besoin du schéma.

Ce qui rougit, dans les deux cas, c'est l'assertion sur le **message**.
Elle est donc la seule qui porte quelque chose ici. L'assertion sur la
donnée est conservée parce qu'elle est celle qui parlerait le jour où un
chemin d'écriture cesserait d'être protégé par la colonne — mais elle ne
doit être créditée d'aucune preuve dans cette story.

Cette mesure n'est pas neuve : le commentaire d'en-tête d'`agencyPlanSchema`
la porte déjà, faite par mutation le 16-08-2026. Elle a été refaite ici,
et elle a redonné le même résultat.

### Ce qui n'a PAS été prouvé, et il faut le dire

`label()` a été durci du même prédicat, parce que `label(MAP, "toString")`
rendait la **fonction** héritée d'`Object`. **Aucun test ne couvre ce
point** : après la correction des sept filtres, plus aucun chemin
atteignable ne remet à `label()` une clé héritée — ses appelants ne lui
passent que des valeurs relues en base, donc des membres réels de
l'énumération. C'est un durcissement défensif, il est écrit comme tel, et
il ne coche aucune case.

### T8 — les contrôles

```
npx tsc --noEmit     0 erreur
npm run lint         0 erreur   (4 avertissements <img> préexistants)
npm run test:e2e     162 passed   (158 avant, + les 4 de cette story)
```

### AC-3 — le balayage, relancé après correction

```bash
grep -rn " in [A-Z_]*LABELS\| in [A-Z_]*COLORS" --include=*.ts --include=*.tsx app lib components
# (aucun résultat)

grep -rn "formData\.get([^)]*) as " --include=*.ts --include=*.tsx app lib components | grep -v "as string"
# app/admin/agencies/page.tsx:114   ← commentaire décrivant le défaut historique
# lib/form.ts:10                    ← commentaire d'en-tête de parseForm
```

Les deux seules occurrences restantes sont des **commentaires** qui
racontent le défaut, pas du code qui le porte.

---

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m]

### Debug Log References

- Un sélecteur de formulaire trop large a fait rougir le cas des messages
  au premier tour : un message « nouveau » porte **deux** formulaires de
  statut (traiter, archiver), et `:has(input[name="status"])` les relevait
  tous les deux. Le rejeu serait parti sur celui que la page rend en
  premier — donc sur un formulaire choisi par hasard. La valeur est
  désormais dans le sélecteur.
- Le repère des listes de l'agence est le **marqueur d'agence**, pas la
  `reference` du paiement : cette dernière n'est pas rendue dans le
  tableau. Vérifié dans le JSX au lieu d'être supposé.

### Completion Notes List

1. **Le correctif de `BUG-06` était déjà là, et c'est le fait qui a
   décidé de la story.** Posé en effet de bord du commit `92f826b`
   (épopée 6), sans story qui le porte, sans mise à jour du registre, et
   **sans aucun test**. Un correctif que rien ne prouve et que rien ne
   consigne est un correctif qu'une refonte ultérieure peut retirer sans
   que personne ne s'en aperçoive.
2. **Le balayage exigé par l'AC-3 a trouvé six sites de plus.** La story
   avait été ouverte pour un cast ; elle en a fermé sept. Le critère
   d'acceptation dit « le projet entier » — le prendre au mot est ce qui a
   révélé le reste.
3. **Deux des six sont sur la vitrine publique**, atteignables sans
   compte : `/vitrine/{slug}?type=constructor` remplaçait l'écran par une
   page d'erreur.
4. **Aucune donnée n'a jamais été en danger.** La colonne est une
   énumération PostgreSQL. Ce qui manquait est le **refus lisible**, et
   c'est exactement ce que `BUG-06` décrivait.
5. **La leçon était déjà écrite dans ce dépôt**, à `lib/offres.ts:294`,
   depuis l'épopée 6 — appliquée à un seul fichier, elle ne protégeait
   qu'un seul fichier. C'est le motif qui a fait poser le prédicat dans
   `lib/labels.ts`, là où vivent les tables : au plus près de ce qu'il
   protège, pas au plus près de ce qui l'a découvert.
6. **Écriture et lecture n'ont pas la même règle**, et les confondre
   aurait produit une page d'erreur là où il faut une liste. Une valeur
   inconnue est une faute quand elle vient changer quelque chose ; elle
   n'est qu'un signet périmé quand elle vient filtrer.

### Change Log

| Date | Version | Description |
|---|---|---|
| 17-08-2026 | 1.0 | Story ouverte : `BUG-06`, un cast |
| 17-08-2026 | 1.1 | Périmètre étendu à sept sites après le balayage AC-3 ; `BUG-38` ouvert |
| 17-08-2026 | 1.2 | Livrée — quatre mutations, 162 passed |

### File List

**Modifiés**

- `lib/labels.ts` — `estCleConnue()`, et `label()` qui s'en sert
- `lib/validations/index.ts` — import de `LeadStatus`, `leadStatusSchema`
- `app/agency/leads/page.tsx` — `setStatus` par `parseForm` ; filtre
- `app/agency/payments/page.tsx` — filtres `?type=` et `?status=`
- `app/vitrine/[slug]/page.tsx` — filtres `?operation=` et `?type=`
- `docs/qa/bug-report.md` — `BUG-06` corrigé, `BUG-38` ouvert et corrigé,
  décompte recalculé (38)
- `docs/epics.md` — note de livraison sur la story 3.2
- `docs/stories/sprint-status.yaml` — story `done`

**Créés**

- `tests/enums.spec.ts` — quatre cas, chacun avec son contrôle positif
- `docs/stories/3-2-valider-le-dernier-cast-d-enum.md` — ce fichier
