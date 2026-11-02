---
baseline_commit: bc1e56d
---

# Story 4.8 : Prouver que les modules métier fonctionnent

Status: done *(17-08-2026 — les six modules ont un aller-retour prouvé par
mutation, et **les six fonctionnent**. `REP-104` fermé. Aucune tâche ne
relève de l'éditeur : cette story ne touche à aucun déploiement.)*

**Épopée :** 4 — Reprendre la suite de tests
**Couvre :** `REP-104`
**Ouverte le :** 17-08-2026
**Risque :** 🟠 — six modules sur neuf peuvent être morts sans que rien ne le dise

> **Née d'une phrase de l'éditeur**, le 17-08-2026 : *« on est en
> développement pas en production ; ce que je souhaite le plus, c'est
> tester les fonctionnalités de cette application web, que tout fonctionne
> bien. »* La priorité change : les stories 2.3 (HTTPS) et 2.5 (seau privé)
> sont écartées au profit de celle-ci.

---

## Story

As a **éditeur**,
I want **qu'un test échoue si une fonctionnalité du produit cesse de fonctionner**,
So that **« 147 cas verts » veuille enfin dire « le produit marche » et pas seulement « le produit est cloisonné ».**

---

## Le constat — mesuré, pas déduit

Les **neuf** actions de création du produit ont été neutralisées **en même
temps**, puis la suite complète relancée.

**`tsc` 0 et `lint` 0 erreur ont été vérifiés AVANT de lancer**, et ce n'est
pas une précaution de style : `CLAUDE.md` §6, piège 3 — retirer un appel
rend son import inutilisé, le lint tombe, `next build` échoue, et le
« rouge » ne vient plus du test. La première tentative est tombée
exactement là (`'prisma' is defined but never used`) et a dû être refaite
avec un no-op qui **consomme ses arguments**.

| Module | La suite s'en aperçoit-elle ? | Qui l'attrape |
|---|---|---|
| `properties` | ✅ | `plafonds.spec.ts` |
| `documents` | ✅ | `regression.spec.ts` |
| `owners` | ✅ | `roles.spec.ts` *(contrôle positif)* |
| **`clients`** | ❌ | — |
| **`sales`** | ❌ | — |
| **`rentals`** | ❌ | — |
| **`rental-management`** | ❌ | — |
| **`payments`** | ❌ | — |
| **`visits`** | ❌ | — |

Vérifié isolément d'abord, sur `clients` seul : création entièrement
neutralisée, l'écran annonçant toujours « Client cree » — **147 passed**.

### La cause est structurelle, et c'est ce qui la rend intéressante

`tests/agence.ts` monte ses décors par `db.owner.create`,
`db.property.create`, `db.client.create`… — **directement en base**, sans
traverser une seule Server Action. Sur les 17 fichiers de la suite, les
vraies mutations par le produit (`rejouer()`) ne vivent que dans **trois** :
`plafonds`, `attribution-offre`, `roles`.

La suite éprouve donc remarquablement ce qu'on peut **lire** et ce qu'on ne
peut **pas** lire. Elle n'éprouve presque rien de ce qu'on peut **écrire**.

Ce n'est pas un oubli : c'est son histoire. Elle est née des épopées 1 et 4,
qui portaient sur la sécurité et le cloisonnement — et elle les couvre bien.
Le mot « couverture » a simplement fini par se lire comme « couverture
fonctionnelle », ce qu'il n'a jamais été ici.

---

## Acceptance Criteria

### AC-1 — Les six modules ont un aller-retour à travers le produit

**Given** les six modules sans couverture de création
**When** la story est terminée
**Then** chacun a un cas qui **relève le formulaire servi**, **rejoue
l'action** et **vérifie la ligne en base**
**And** aucun de ces six cas n'utilise `db.*.create` pour l'objet qu'il
prétend créer — le décor, oui ; la cible, jamais

### AC-2 — Chaque cas est prouvé par mutation, et le message nomme le module

**Given** qu'un test de création peut passer en ne créant rien si
l'assertion est mal posée
**When** chaque cas est écrit
**Then** la création du module est neutralisée, **le cas doit rougir**, et
le message d'échec doit **nommer le module** — pas une assertion voisine

### AC-3 — La mutation compile, sinon elle ne prouve rien

**Given** `CLAUDE.md` §6, piège 3
**When** une mutation est jouée
**Then** `npx tsc --noEmit` **et** `npm run lint` sont relancés et **verts**
avant d'interpréter le rouge

### AC-4 — Un module cassé aujourd'hui est un défaut, pas un test à ajuster

**Given** qu'un cas peut rougir dès sa première exécution
**When** cela se produit
**Then** c'est inscrit en **`BUG-nn`** dans `docs/qa/bug-report.md`, et le
test **reste rouge** jusqu'à correction — on ne l'assouplit pas

### AC-5 — L'instabilité se nomme, elle ne se relance pas

**Given** `REP-97` — la suite lâche environ un cas par exécution sous charge
**When** la story est terminée
**Then** deux exécutions consécutives sont vertes, **ou** l'instabilité est
nommée et chiffrée plutôt que relancée jusqu'au vert

### AC-6 — Les décors sont effacés

**Given** `REP-97` et la fuite mesurée par la story 4.7 (≈ 4 agences par
exécution)
**When** la story est terminée
**Then** chaque cas nettoie par **`afterEach`**, jamais par `finally`
**And** la story n'aggrave pas le décompte d'agences

---

## Tasks / Subtasks

- [x] **T1** — `tests/formulaire.ts` *(nouveau)* : relevé du formulaire servi
      et rejeu avec champs forcés. Écrit **hors** de `metier.spec.ts` parce
      que deux copies existaient déjà (`roles`, `plafonds`) et qu'une
      troisième dans un fichier de test aurait divergé sans que personne ne
      le voie. Les deux copies existantes restent en place à dessein —
      elles sont vertes, les migrer appartient à la story 4.7.
- [x] **T2** — `clients`.
- [x] **T3** — `visits`.
- [x] **T4** — `sales`.
- [x] **T5** — `rentals`.
- [x] **T6** — `payments`.
- [x] **T7** — `rental-management`.
- [x] **T8** — **Six mutations, jouées séparément**, chacune précédée d'un
      `tsc` **0** et d'un `lint` **0 erreur**. *(AC-2, AC-3)*
- [x] **T9** — **Aucun `BUG-nn` à inscrire : les six modules fonctionnent.**
      C'est un résultat, et il valait d'être mesuré. *(AC-4)*
- [x] **T10** — Deux exécutions complètes consécutives, **153 passed** les
      deux fois. *(AC-5)*
- [x] **T11** — Contrôles §9, `deferred-work.md`, `sprint-status.yaml`,
      File List.

---

## Dev Notes

### Le harnais existe déjà, il ne faut pas le réinventer

Deux formes de `rejouer()` cohabitent dans la suite, et **c'est la seconde
qu'il faut ici** :

| Où | Signature | Ce qu'elle fait |
|---|---|---|
| `tests/roles.spec.ts:868` | `(page, ecran, formHtml)` | rejoue le formulaire **tel quel** |
| `tests/plafonds.spec.ts:55` | `(page, ecran, formHtml, champs)` | rejoue **en forçant des champs** |

La seconde remplace les contrôles par des champs cachés — motif écrit sur
place : *« un `select` n'accepte pas une valeur absente de ses options, et
un POST forgé n'utilise de toute façon pas l'écran »*.

**L'identifiant d'action ne s'écrit jamais dans un test** : il est calculé
au `build`, et figé il rendrait le cas vert en ne testant plus rien
(BUG-28, `CLAUDE.md` §6 piège 4). Il vient du HTML relevé à l'exécution.

### Les corps valides, lus dans `lib/validations/index.ts`

```
clientSchema            firstName≥2, lastName≥2  (le reste optionnel)
visitSchema             date, time, clientId, propertyId
saleSchema              propertyId, clientId, finalPrice, saleDate
rentalSchema            propertyId, clientId, startDate, monthlyRent
                        ⚠ .refine : endDate > startDate
rentalManagementSchema  rentalId, month 1-12, year 2000-2100, rentAmount
paymentSchema           amount, type (SANS défaut — obligatoire), date
```

Deux pièges à ne pas découvrir en boucle :

1. **`paymentSchema.type` n'a pas de valeur par défaut**, contrairement à
   `method` et `status`. Un corps qui l'omet est refusé.
2. **`rentalManagementSchema.month` et `year` sont des chaînes
   transformées**, pas des nombres : `"3"`, pas `3`.

### Ce que cette story NE prouvera pas — et il faut le dire ici

Elle prouve qu'un module **n'est pas mort**. Elle ne prouve pas qu'il est
**juste**. Un formulaire qui enregistre le mauvais montant, une commission
mal calculée, un `Decimal` tronqué : tout cela passe dessous. C'est
l'épopée 3 (« Fiabiliser les données ») qui traite la justesse, et la
story 4.5 qui rendrait ces règles testables ailleurs que dans un écran.

Écrire le contraire dans un rapport serait exactement le genre
d'affirmation que `CLAUDE.md` §7 traite comme un défaut.

### Ce que cette story rend atteignable — `CLAUDE.md` §8

- **Six cas de plus qui créent des lignes réelles**, donc plus de décors à
  effacer. `REP-97` et la fuite d'agences de la story 4.7 s'aggravent si
  l'`afterEach` est oublié — d'où l'AC-6, qui n'est pas décoratif.
- **La suite s'allonge.** Elle est déjà à 2,6 min sous mutation. Six cas
  qui ouvrent une session chacun (bcrypt coût 12) coûteront. Si le temps
  devient un problème, c'est `REP-16`/story 4.7 qui le traite, pas un
  raccourci ici.
- **Un cas rouge dès le premier jour est une bonne nouvelle**, pas un
  incident : c'est un défaut qui existait déjà et que personne ne voyait.

### Hors périmètre, explicitement

- **L'édition et la suppression.** Mesurées comme déjà couvertes :
  `roles.spec.ts` exerce les huit routes de suppression *avec* le contrôle
  positif administrateur, et `corbeille.spec.ts` couvre l'enregistrement de
  cinq écrans d'édition. Si un trou y apparaît, il fera sa story.
- **`properties`, `documents`, `owners`.** Déjà attrapés — la mesure le dit.
  Les recouvrir serait du travail qui ne change aucun résultat.
- **La refonte du harnais** (sessions réutilisées, nettoyage global) :
  c'est la story 4.7, et elle est plus grosse que celle-ci.

### References

- `docs/stories/deferred-work.md` — `REP-104`
- `docs/epics.md` — Story 4.8
- `tests/plafonds.spec.ts:55` — la forme de `rejouer()` à reprendre
- `tests/agence.ts` — `creerAgence`, `garnir`, `effacerAgence`
- `lib/validations/index.ts:297-411` — les six schémas
- `CLAUDE.md` §6 (pièges 3 et 4, `afterEach`), §7 (mesurer), §9 (terminé)

---

## Preuves — 17-08-2026

### La réponse à la question posée : les six modules fonctionnent

Six cas écrits, six verts à la première exécution. **Aucun `BUG-nn` à
ouvrir.** C'était le résultat le plus probable et il n'était pas acquis :
c'est justement parce que rien ne le vérifiait qu'on ne pouvait pas le dire.

### T8 — six mutations, jouées séparément

Pour chacune : restauration complète, neutralisation d'**une** création,
`tsc` et `lint` revérifiés, puis `metier.spec.ts` seul.

| Module muté | `tsc` | `lint` | Cas rouges | Le cas rouge est-il le bon ? |
|---|---|---|---|---|
| `clients` | 0 | 0 | **1** | ✅ *« MODULE « clients » … AUCUN client n'a ete enregistre »* |
| `visits` | 0 | 0 | **1** | ✅ *« MODULE « visits » … AUCUNE visite »* |
| `sales` | 0 | 0 | **1** | ✅ *« MODULE « sales » … AUCUNE vente »* |
| `rentals` | 0 | 0 | **1** | ✅ *« MODULE « rentals » … AUCUN bail »* |
| `payments` | 0 | 0 | **1** | ✅ *« MODULE « payments » … AUCUN paiement »* |
| `rental-management` | 0 | 0 | **1** | ✅ *« MODULE « rental-management » … AUCUNE quittance »* |

**Un seul cas rouge à chaque fois.** C'est l'attribution qu'on cherchait :
casser un module n'entraîne aucun cas voisin, donc aucun message ne désigne
la mauvaise cause.

### Le détail qui justifie toute la story

Les URL d'arrivée relevées sous mutation portent **`?success=`** :

```
… /agency/sales?success=…      alors qu'aucune vente n'a été créée
… /agency/rentals?success=…    alors qu'aucun bail n'a été créé
```

**Le produit annonce un succès en n'ayant rien écrit.** C'est exactement
pourquoi un test qui *clique* et lit le bandeau aurait été vert, et pourquoi
`CLAUDE.md` §6 exige de vérifier **l'effet**, jamais l'apparence.

### Un défaut de mon propre corps, attrapé par le message

Le cas `payments` a rougi à sa première exécution :

```
Le produit a repondu : …/agency/payments/new?error=Type de paiement invalide (champ : type)
```

`commission` n'existe pas dans `PaymentType` — le vrai nom est
`commission_agence`. **Ce n'était pas un défaut du produit**, et le message
l'a dit en une ligne parce que `rejouer()` renvoie l'URL d'arrivée. Sans
elle, la lecture aurait été « la création de paiement ne marche pas », et
j'aurais ouvert un `BUG-nn` qui n'existait pas.

### AC-6 — les décors sont effacés, mesuré

```
AVANT : agences=59 clients=5 paiements=6 baux=1
        npx playwright test tests/metier.spec.ts   → 6 passed
APRES : agences=59 clients=5 paiements=6 baux=1
```

Identique. La story n'aggrave pas la fuite de `REP-97`.

### T10 — les contrôles

```
npx tsc --noEmit     0 erreur
npm run lint         0 erreur (4 avertissements préexistants, <img>)
npm run test:e2e     153 passed  (147 avant, plus les 6 ajoutés)
                     153 passed  — seconde exécution consécutive (AC-5)
```

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — `claude-opus-5[1m]`

### Debug Log References

- Constat fondateur : les 9 créations neutralisées ensemble, suite complète
  relancée. Détail dans `REP-104`.
- T8 : six mutations scriptées, chacune avec restauration, `tsc`, `lint`,
  puis exécution du seul `metier.spec.ts`. Rapports JSON lus, pas résumés.
- AC-6 : décompte avant/après sur `agency`, `client`, `payment`, `rental`.

### Completion Notes List

1. **La réponse à l'éditeur est : oui, les six modules enregistrent.** Et
   désormais quelque chose le vérifie à chaque exécution.
2. **`rejouer()` renvoie l'URL d'arrivée, et ce n'est pas cosmétique.** Elle
   distingue « l'action a refusé mon corps » de « l'action n'a rien fait ».
   Sans elle, le cas `payments` m'aurait fait ouvrir un faux défaut.
3. **Le produit redirige avec `?success=` même quand rien n'est écrit.**
   Constaté sous mutation. Ce n'est pas un défaut en soi — l'action ne peut
   pas savoir que sa propre écriture a été neutralisée — mais c'est la
   démonstration que le bandeau de succès ne prouve rien, et que seul un
   contrôle en base tranche.
4. **Le harnais est sorti dans `tests/formulaire.ts`** plutôt que copié une
   troisième fois. Les deux copies existantes ne sont pas touchées : elles
   sont vertes, et les migrer ferait courir un risque pour un gain nul ici.
   C'est la story 4.7 qui consolide.
5. **Ce que cette story ne prouve toujours pas** : que les modules soient
   *justes*. Un montant mal enregistré, une commission fausse, un `Decimal`
   tronqué passent dessous. Épopée 3.
6. **L'édition et la suppression restent hors périmètre**, et c'est mesuré :
   `roles.spec.ts` exerce les huit suppressions avec contrôle positif, et
   `corbeille.spec.ts` couvre l'enregistrement de cinq écrans d'édition.

### Change Log

| Date | Version | Description |
|---|---|---|
| 17-08-2026 | 0.1 | Story rédigée, sur une mesure : les 9 créations neutralisées ensemble, 6 modules passent inaperçus. |
| 17-08-2026 | 1.0 | Développée. Six allers-retours, six mutations séparées, deux exécutions vertes. Les six modules fonctionnent — aucun `BUG-nn`. |

### File List

**Nouveaux**
- `tests/formulaire.ts`
- `tests/metier.spec.ts`

**Modifiés**
- `docs/epics.md`
- `docs/stories/deferred-work.md`
- `docs/stories/sprint-status.yaml`
- `docs/stories/4-8-prouver-que-les-modules-metier-fonctionnent.md`

**Aucun fichier applicatif touché.** Les neuf pages mutées pendant la mesure
et les six mutées pendant T8 ont été restaurées et vérifiées (`tsc` 0,
`lint` 0, `git status` propre).
