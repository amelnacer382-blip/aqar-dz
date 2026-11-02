---
baseline_commit: ec0ac45
---

# Story 6.4 : Faire tenir les plafonds, sans rien détruire

Status: done

**Épopée :** 6 — Vendre ce que le produit tient
**Couvre :** FR-9, FR-10, FR-11, FR-12 · **Réalise :** UJ-3
**Source :** [`docs/prds/prd-aqar-dz-offres-2026-08-15/prd.md`](../prds/prd-aqar-dz-offres-2026-08-15/prd.md) §4.4
**Découpage :** [`docs/epics.md`](../epics.md) — Epic 6, story 6.4
**Dépend de :** 6.1, 6.3
**Date :** 16 août 2026

---

## Story

**En tant qu'**éditeur d'Aqar DZ,
**je veux** qu'une agence ne dépasse pas ce que son offre autorise,
**afin que** l'offre cesse d'être une étiquette — **sans jamais supprimer ce
qu'une agence possède déjà**.

---

## Le décompte est le piège, pas le refus

Le refus tient en trois lignes. Ce qui coûte, c'est de compter juste et de
n'oublier aucun chemin.

| | Ce qui compte | Ce qui ne compte pas |
|---|---|---|
| **Biens** | non supprimés, **tous statuts** — un bien vendu occupe une fiche | ceux à la corbeille |
| **Comptes** | **actifs**, tous rôles, l'administrateur compris | les comptes désactivés |

Et **trois** points d'entrée par plafond, pas un :

| Plafond | Créer | Faire remonter le décompte sans créer |
|---|---|---|
| Biens | `properties/new` | **restaurer depuis la corbeille** |
| Comptes | `agency/users` | **réactiver un compte désactivé** |

Oublier la colonne de droite ferait un plafond contournable en trois
gestes : supprimer, créer, restaurer.

**Un quatrième point de création existe et reste hors quota :**
`app/api/auth/register/route.ts` crée le premier administrateur d'une agence
neuve, dans la transaction qui crée l'agence. Elle a zéro compte, son
plafond le plus bas en autorise deux : le contrôle **ne peut pas refuser**,
et interrogerait une agence non encore validée. C'est écrit dans le code
pour qu'on ne le « corrige » pas.

---

## Ce qui a été mesuré avant d'écrire

```bash
grep -rn "user.create\|property.create" tests/          # → toutes via `db`
grep -rn "agency/users\|agency/properties/new" tests/   # → aucune création par l'écran
```

**Aucun test existant ne crée un bien ni un compte par l'interface**, sauf
un : `features.spec.ts:100` crée un agent sur l'**agence de démonstration**.
Celle-ci porte 2 comptes actifs (`admin@aqar.dz`, `agent@aqar.dz` — le
super admin n'a pas d'agence) et l'offre **Pro**, plafonnée à 10.

> ⚠ **Dépendance vivante, à ne pas casser.** Si l'agence de démonstration
> repassait en **Starter**, son plafond serait de **2** — exactement son
> décompte actuel — et `features.spec.ts` échouerait dès la création de
> l'agent. La migration `20260815000000` la place en `pro` ; c'est ce qui
> tient ce test debout.

Les restaurations testées (`corbeille.spec.ts`) portent sur des agences à
1 ou 2 biens : très loin des 20 de Starter.

---

## Acceptance Criteria

**AC-1 (FR-9)** — **Given** une agence Starter possédant 20 biens non
supprimés
**When** un de ses membres enregistre un vingt-et-unième bien
**Then** l'enregistrement est refusé
**And** le message nomme l'**offre**, le **plafond** et le **décompte**
**And** la saisie n'est pas perdue

**AC-2 (FR-9)** — **Given** la même agence
**When** on **rejoue la Server Action** sans passer par l'écran
**Then** le refus est identique — la garde est **dans l'action**

**AC-3 (FR-9)** — **Given** une agence Pro, plafond de biens illimité
**When** elle crée un bien, quel que soit son décompte
**Then** rien n'est refusé — **contrôle positif obligatoire**

**AC-4 (FR-11)** — **Given** une agence au plafond, avec un bien à la
corbeille
**When** elle restaure ce bien
**Then** la restauration est refusée, même message
**And** sous le plafond, elle fonctionne toujours — **contrôle positif**

**AC-5 (FR-11)** — **Given** une agence au plafond de comptes, avec un
compte désactivé
**When** un `agency_admin` le réactive
**Then** la réactivation est refusée
**And** sous le plafond, elle fonctionne toujours — **contrôle positif**

**AC-6 (FR-12)** — **Given** une agence rétrogradée au-dessous de son
décompte
**Then** aucun bien ni compte n'est supprimé, désactivé ni masqué
**And** tout reste **modifiable** : seule la création est refusée
**And** supprimer un objet ramène le décompte, **et le message le dit**

**AC-7** — **Given** un contrôle de quota
**Then** il utilise `count()`, jamais `findMany().length`
**And** il lit le décompte **en base au moment de l'action**, jamais dans la
session ni le jeton

---

## Ce que cette story rend atteignable (`CLAUDE.md` §8)

1. **Un plafond peut enfermer une agence.** Ce dépôt a déjà payé ce
   mécanisme exact avec la révocation qui ouvrait une boucle de
   redirection. La parade est écrite en dur dans la conception : **seule la
   création est refusée**. Désactiver, supprimer, modifier, mettre à la
   corbeille restent possibles en toutes circonstances — ce sont les
   sorties, les bloquer fermerait la porte de l'intérieur.

2. **Le refus se déplace sur le compte de l'administrateur lui-même.** Il
   entre dans le décompte des comptes actifs (FR-10). Une agence Starter
   avec 2 admins actifs ne peut plus créer d'agent — c'est voulu, et
   `resumeOffre()` l'annonçait déjà sur la page tarifaire (« 2
   utilisateurs »).

3. **`refusDeQuota` peut être appelée hors plafond.** Un plafond `null`
   produirait « null biens au maximum », qui se lit comme un bogue
   d'affichage. La fonction traite le cas et rend une phrase vraie.

4. **La barre de consommation peut déborder** après rétrogradation (23 sur
   20). Bornée à 100 %, et **teintée d'ocre et non de rouge** : la
   situation est légitime, l'alarme pousserait l'agence à effacer ce
   qu'elle a le droit de garder.

5. **Deux requêtes de plus au rendu** de trois écrans. Négligeable, et le
   décompte est relu **dans l'action** de toute façon : celui du rendu ne
   sert qu'à l'affichage, et un second onglet peut le périmer entre les
   deux.

---

## Tasks / Subtasks

- [x] **T1 — `lib/quotas.ts`.** Un seul endroit qui compte et qui décide.
      Hors de `lib/offres.ts`, qui est importé par des composants client.
- [x] **T2 — Le plafond des biens.** Garde dans `createProperty`, et écran
      qui n'affiche plus le formulaire au plafond (c'est ainsi que « la
      saisie n'est pas perdue » se tient).
- [x] **T3 — Le plafond des comptes.** Garde dans `createUser`.
- [x] **T4 — Les deux chemins détournés.** `restore` (biens seulement) et
      `toggleActive` (réactivation seulement).
- [x] **T5 — Le point hors quota, nommé.** `app/api/auth/register/route.ts`.
- [x] **T6 — Les tests.** `tests/plafonds.spec.ts`, 6 cas, chacun avec son
      contrôle positif.
- [x] **T7 — La preuve.** `npm run test:e2e` exécutée le 16-08-2026 :
      **140 passed**. Les trois gardes mutées, trois rouges, trois verts
      intacts.
- [x] **T8 — Les contrôles.** `prisma validate` ✅ · `tsc --noEmit` ✅ 0 ·
      `lint` ✅ 0 · `test:e2e` ✅ 140 verts.

---

## Dev Notes

### Pourquoi le quota n'est pas dans `lib/auth-guard.ts`

`docs/epics.md` listait ce fichier « à confirmer ». **Il n'a pas été
touché**, et c'est délibéré : un quota n'est pas une autorisation. Le rôle
dit *qui a le droit*, le quota dit *combien il en reste* — les mélanger
ferait de `auth-guard.ts` un endroit où l'on cherche deux choses, et
`CLAUDE.md` §5 tient à ce que **l'autorisation n'ait qu'une couche**.

### `count()` couvre la corbeille tout seul

`lib/prisma.ts` injecte `deletedAt: null` sur les lectures des trois modèles
à corbeille, et **`count` figure bien dans ses `READ_OPERATIONS`** — lu dans
l'extension, pas supposé. Écrire le filtre à la main ici aurait donné un
`where` que le client aurait laissé tel quel (il ne réécrit pas un `where`
qui parle déjà de `deletedAt`) : le même résultat, obtenu par un chemin
différent, et deux vérités à maintenir.

### Le décompte n'est jamais dérivé d'une liste d'affichage

`app/agency/users/page.tsx` a déjà `users` sous la main. Le décompte est
quand même relu : `users` est une liste d'écran, et le jour où elle gagne
une pagination ou un filtre, sa longueur cesserait d'être le décompte
**sans que rien ne le signale**.

### Le refus dit la sortie

« Plafond atteint » laisse l'agence devant un mur : payer ? appeler ?
attendre ? Le message nomme la sortie gratuite — libérer une place — parce
que FR-12 la garantit.

---

## La preuve par mutation

Jouée le 16-08-2026. Les **trois** gardes retirées d'un coup — elles
portent sur trois tests distincts, donc chaque rouge reste attribuable.
`tests/plafonds.spec.ts` : **3 rouges, 3 verts**.

| Garde retirée | Message d'échec |
|---|---|
| `createProperty` | « un bien a été créé au-delà du plafond de l'offre » |
| `restore` (biens) | « un bien a été restauré alors que l'agence était au plafond — le plafond se contourne en trois gestes » |
| `toggleActive` (réactivation) | « un compte a été réactivé au-delà du plafond — le plafond se contourne en trois gestes » |

**Les trois autres cas sont restés verts** — l'illimité, la
rétrogradation, l'affichage. C'est ce qui rend la démonstration lisible :
les mutations n'ont pas débordé sur ce qu'elles ne visaient pas.

Retirer la garde de `restore` a rendu ses imports inutilisés, donc le lint
en erreur, donc le build en échec — `CLAUDE.md` §6, piège 3, rencontré tel
quel. Les imports ont été retirés **avec** la garde, sans quoi le rouge ne
serait pas venu du test.

---

## Dev Agent Record

### Debug Log References

Aucune erreur de compilation. Un défaut d'affichage a été corrigé en
passant : le décompte et son plafond se rendaient **collés** (`3sur 20`),
l'espace n'étant dessiné que par une marge CSS. Une synthèse vocale lit le
texte, pas la marge.

### Completion Notes List

**Fait :** les deux plafonds, leurs quatre points d'entrée, et le refus qui
nomme la sortie. Six cas de test, chacun avec son contrôle positif sur le
même chemin.

~~**Non fait :** T7 — ni `test:e2e`, ni la mutation. Les six cas sont
**écrits, pas verts**.~~ **Fait le 16-08-2026** : `npm run test:e2e` → 140
verts, et les **trois** gardes de quota mutées séparément, trois rouges
attribuables (création d'un bien, restauration depuis la corbeille,
réactivation d'un compte).

~~**Laissé ouvert :** les `atouts` du catalogue vendent toujours des capacités
que le produit ne tient pas (« API access », « Statistiques avancées »).~~
Seuls les deux plafonds contraignent quelque chose — question ouverte n° 2
du PRD, décision commerciale.

**⚠ « Statistiques avancées » existe** — `app/agency/statistics`, 425 lignes,
six graphiques. L'inventaire de la story 6.6 l'a mesuré le 16-08-2026 ; seules
« API access » et « Intégrations custom » ne désignaient rien, et elles ont
été retirées. Ce qui reste ouvert est autre chose, et plus grave : **aucune
de ces capacités n'est réservée à l'offre qui la vend** (`REP-101`, story 6.7).

### File List

**Nouveaux (2)**
- `lib/quotas.ts`
- `tests/plafonds.spec.ts`

**Modifiés (5)**
- `app/agency/properties/new/page.tsx`
- `app/agency/users/page.tsx`
- `app/agency/trash/page.tsx`
- `app/api/auth/register/route.ts`
- `docs/stories/sprint-status.yaml`
