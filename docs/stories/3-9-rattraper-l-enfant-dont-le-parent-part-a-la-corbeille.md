---
baseline_commit: df3e0ee
---

# Story 3.9: Rattraper l'enfant dont le parent part à la corbeille

Status: done

## Story

As a agent,
I want qu'enregistrer une visite sans rien y changer ne la rattache pas à un autre bien,
so that corriger une heure ne réécrive pas silencieusement l'historique d'un dossier.

**Couvre :** défaut n° 34 (BUG-34)

## Ce que cette story doit vraiment faire

Le défaut est **confirmé sur l'instance**, et le geste qui le déclenche est
le plus banal du produit : ouvrir une fiche, cliquer « Enregistrer ».

```
prisma.property.findMany({ where: { agencyId } })   ← le bien en corbeille n'y est plus
defaultValue={visit.propertyId}                     ← mais il le désigne toujours
```

Aucune `<option>` ne correspond. Le navigateur applique alors la règle du
HTML — sélectionner la **première** option — et le formulaire part avec
elle. La Server Action ne voit rien d'anormal : ce bien-là appartient bien
à l'agence. Le cloisonnement tient, la validation tient, et le lien métier
est réécrit sans un mot.

**Cinq écrans, dix couples écran → champ** portent une liste alimentée par
un modèle à suppression réversible (`Property`, `Client`, `Owner`) :

| Écran | Champs |
|---|---|
| `visits/[id]/edit` | `propertyId`, `clientId` |
| `sales/[id]/edit` | `propertyId`, `clientId` |
| `rentals/[id]/edit` | `propertyId`, `clientId` |
| `payments/[id]/edit` | `propertyId`, `clientId`, `ownerId` |
| `properties/[id]/edit` | `ownerId` |

Les écrans de **création** ne sont pas concernés : sans `defaultValue`, il
n'y a rien à faire retomber. Ne pas les toucher par symétrie.

## Ce que je tranche, et pourquoi

**ARBITRAGE RENDU le 12-08-2026, par délégation explicite de l'éditeur :
le parent en corbeille RESTE dans la liste, étiqueté.**

Trois issues étaient possibles. Celle-ci est la seule qui ne perde ni
l'information ni le geste :

- **retenue — conserver le parent, suffixé « — en corbeille »** : l'agent
  voit ce qui est, le formulaire repart avec la bonne valeur, rien ne
  bascule, et le lien reste corrigeable ;
- *écartée — refuser l'enregistrement* : sûr, mais il bloque un agent sur
  une fiche qu'il ne peut pas débloquer lui-même (la corbeille est
  réservée à l'administrateur). On répare une corruption en fabriquant une
  impasse ;
- *écartée — empêcher la mise à la corbeille d'un parent ayant des enfants
  vivants* : cela annulerait à moitié ce que la story 4.6 vient de gagner.
  C'est précisément pour **garder** l'historique qu'on a cessé de détruire.

**L'option n'est PAS `disabled`, et c'est délibéré.** Une option désactivée
signalerait mieux l'anomalie, mais l'invariant à garantir est
« enregistrer sans rien changer ne change rien » — et il ne doit dépendre
d'aucune subtilité de soumission d'une option désactivée selon le
navigateur. Le libellé porte l'information ; la correctitude passe avant le
signal. Le seul effet de bord est qu'un agent peut re-choisir un parent
déjà en corbeille : c'est-à-dire garder la valeur qu'il avait déjà.

**Le parent en corbeille est relu par une seconde requête, pas par une
ruse.** L'extension de `lib/prisma.ts` injecte `deletedAt: null` **sauf si
le `where` de premier niveau parle déjà de `deletedAt`**. On pourrait
exploiter cela dans un `OR`, ce qui marcherait et serait illisible. Une
requête explicite `findFirst({ where: { id, agencyId, deletedAt: { not: null } } })`
dit ce qu'elle fait. Elle ne coûte qu'un aller-retour, sur un écran
d'édition.

## Acceptance Criteria

1. **Given** un parent mis à la corbeille et un enfant qui le référence —
   **When** un compte ouvre l'écran d'édition de l'enfant et enregistre
   **sans rien modifier** — **Then** l'enfant référence toujours le même
   parent après l'enregistrement.

2. **Given** l'arbitrage rendu ci-dessus — **When** la story est terminée —
   **Then** le parent en corbeille figure dans la liste, suffixé
   « — en corbeille » — **And** tout écart à cette décision est écrit ici
   avec son motif.

3. **Given** dix couples écran → champ sont concernés — **When** la story
   est terminée — **Then** les dix sont traités — **And** l'inventaire de
   ces couples est écrit dans `docs/architecture.md`, comme l'a été celui
   des Server Actions destructives.

4. **Given** aucun test n'éprouve « ouvrir puis enregistrer sans rien
   changer » — **When** la story est terminée — **Then** ce geste est
   couvert sur les cinq écrans — **And** la couverture est prouvée **par
   mutation**.

5. **Given** les écrans de création n'ont pas de `defaultValue` — **When**
   la story est terminée — **Then** ils ne sont pas modifiés.

## Tasks / Subtasks

- [x] **1. Phase rouge** (AC 1, 4)
  - [x] Un test qui ouvre puis enregistre sans rien changer, sur les cinq écrans
  - [x] Constater le rouge avant toute correction
- [x] **2. Le helper** (AC 2)
  - [x] `lib/corbeille.ts` — fusionner le parent courant dans la liste
  - [x] Suffixe unique, jamais réécrit à la main dans les écrans
- [x] **3. Les dix couples** (AC 3, 5)
  - [x] `visits`, `sales`, `rentals`, `payments`, `properties`
  - [x] Ne toucher à aucun écran de création
- [x] **4. Preuve et documentation** (AC 3, 4)
  - [x] Mutation sur chacun des cinq écrans
  - [x] Inventaire écran → champ dans `docs/architecture.md`
  - [x] BUG-34 marqué corrigé, `sprint-status.yaml` à jour

## Dev Notes

- **`lib/prisma.ts` n'injecte `deletedAt: null` qu'au premier niveau**, et
  seulement si la clé est absente du `where`. C'est ce qui rend la seconde
  requête possible sans désactiver l'extension.
- **Ne pas filtrer les enfants sur `parent.deletedAt`** : ce serait
  reproduire la cascade que la story 4.6 vient de retirer.
- **Le contrôle positif est obligatoire** : un test qui vérifie que le lien
  ne change pas passerait tout aussi bien sur un écran cassé pour tout le
  monde. Vérifier aussi qu'un changement **voulu** de parent fonctionne
  toujours.
- **`tests/db.ts`** est le client brut : c'est lui qui relit une ligne en
  corbeille.

## Dev Agent Record

### Debug Log

**Phase rouge.** Le test a été écrit avant toute correction et a rougi sur
le premier écran : `visite → propertyId : la liste est retombée sur une
autre option`. Le contrôle positif, lui, passait déjà — un changement de
bien délibéré fonctionnait. C'est ce qui distingue « la liste est cassée »
de « la liste bascule ».

**Une hypothèse fausse, corrigée par la mutation.** `sales` et `rentals`
emploient le `Select` de Radix et non un `<select>` natif. On pouvait donc
croire que leur état JavaScript conservait la valeur et qu'ils étaient
épargnés — c'est ce que j'ai supposé en lisant. **Faux :** leur mutation
rougit exactement comme les autres. Le `<select>` caché que Radix rend pour
la soumission retombe sur la première option de la même façon. Une
hypothèse sur le comportement d'une bibliothèque se mesure.

| Mutation (`deletedAt: { not: null }` → `deletedAt: null`) | Résultat |
|---|---|
| `visits/[id]/edit` | 🔴 visite → propertyId |
| `sales/[id]/edit` | 🔴 vente → propertyId |
| `rentals/[id]/edit` | 🔴 bail → propertyId |
| `payments/[id]/edit` | 🔴 paiement → propertyId |
| `properties/[id]/edit` | 🔴 bien → ownerId |
| `SUFFIXE_CORBEILLE` vidé | 🔴 « le parent en corbeille n'est pas signalé comme tel » *(ajoutée en revue)* |
| `lienInchange()` neutralisé | 🔴 « la correction n'a pas été enregistrée » *(ajoutée en revue)* |

La mutation choisie fait que la requête ne trouve **jamais** le parent en
corbeille. Elle compile — aucune variable ni import ne devient inutilisé —
ce qui est la condition pour qu'elle prouve quelque chose (leçon de la
story 4.4).

### Completion Notes

Les dix couples écran → champ sont traités par un helper unique. Le parent
mis à la corbeille reste proposé, suffixé « — en corbeille » ; le
formulaire repart avec la bonne valeur, et le lien reste corrigeable par
qui de droit.

Aucun écran de création n'a été touché : sans `defaultValue`, il n'y a rien
à faire retomber, et les modifier par symétrie aurait ajouté du risque sans
fermer quoi que ce soit.

**Ce que la story ne fait pas :** elle ne filtre pas les enfants sur
`parent.deletedAt`. Ce serait reproduire la cascade que la story 4.6 vient
justement de retirer.

### File List

**Créés**
- `lib/corbeille.ts` — `avecParentEnCorbeille()`, `libelleOption()`, et le motif du défaut
- `tests/corbeille.spec.ts` — le geste réel sur les cinq écrans, plus le contrôle positif
- `docs/stories/3-9-*.md` — cette story

**Modifiés**
- `app/agency/visits/[id]/edit/page.tsx` — bien et client
- `app/agency/sales/[id]/edit/page.tsx` — bien et client
- `app/agency/rentals/[id]/edit/page.tsx` — bien et client
- `app/agency/payments/[id]/edit/page.tsx` — bien, client et propriétaire
- `app/agency/properties/[id]/edit/page.tsx` — propriétaire
- `app/agency/payments/verify-links.ts` — *ajouté en revue :* accepte un lien inchangé même en corbeille
- `docs/architecture.md` — second inventaire (écran → champ), §9 état de santé
- `docs/qa/bug-report.md` — BUG-34 corrigé, avec la mesure et l'hypothèse démentie
- `docs/stories/sprint-status.yaml` — statut de la story

### Review Findings

Revue adversariale du 12-08-2026, trois couches parallèles. **Les trois ont
convergé, indépendamment et chacune avec sa propre sonde, sur le même
constat : le correctif rendait les cinq écrans impossibles à enregistrer.**

**Critique — traité**

- [x] [Review][Patch] **Le correctif livrait l'issue que la story avait écartée.** Rendre le parent dans la liste ne suffisait pas : les Server Actions revérifient le lien reçu avec `findFirst({ where: { id, agencyId } })`, un `where` qui ne nomme pas `deletedAt` — l'extension y injecte son filtre, le parent en corbeille est introuvable, l'action répond `error=Bien ou client introuvable`. Mesuré sur les cinq écrans. Le geste que cette story existe pour sauver — corriger une heure — ne fonctionnait pas non plus : `visit.time` restait à `10:00`. **La corruption silencieuse était remplacée par une impasse.** Corrigé par `lienInchange()` : un identifiant inchangé n'est pas revérifié, un identifiant différent l'est normalement.
- [x] [Review][Patch] **Le test ne distinguait pas « lien préservé » de « enregistrement refusé ».** Un refus laisse le lien inchangé, exactement comme un succès. La suite était verte sur un produit cassé. **Deuxième fois en deux stories qu'une preuve ne distingue pas le succès de l'échec** — après l'assertion tautologique de la story 4.6. Le test asserte désormais l'absence d'`error=` dans l'URL, et surtout qu'une **correction volontaire est réellement enregistrée**.

**À corriger — traités**

- [x] [Review][Patch] **L'étiquette « — en corbeille » n'était vérifiée par rien** : vider `libelleOption()` laissait toute la suite verte. L'option n'étant délibérément pas `disabled`, le libellé est le **seul** signal — c'est la moitié de l'arbitrage rendu. Asserté, et prouvé par mutation (suffixe vidé → rouge).
- [x] [Review][Patch] **Le dixième couple `payments → ownerId` n'était jamais exercé** : `garnir()` crée le paiement sans propriétaire, la branche ne s'empruntait pas. Le décor le pose désormais, et le champ est asserté.
- [x] [Review][Patch] **Le contrôle positif tournait sur un décor sans rien en corbeille** — il prouvait que l'écran enregistre quand aucun parent n'est supprimé, c'est-à-dire le cas qui n'est pas en cause. Un cas dédié éprouve maintenant le vrai chemin.
- [x] [Review][Patch] **Le décor du test était lui-même invalide** : un bien en vente sans prix ne passe pas `propertySchema`. Le test rougissait sur sa propre invalidité, pas sur le défaut.
- [x] [Review][Patch] **Affirmations non tenues** : « cinq mutations sur cinq » couvrait un champ par écran, pas les dix couples ; l'introduction du registre annonçait encore 33 défauts ; le registre et l'architecture déclaraient « le lien reste corrigeable » alors que le serveur le refusait. Corrigées.

**Reporté**

- [x] [Review][Defer] **Aucune remédiation des données déjà corrompues.** Le défaut a été reproduit *sur l'instance* : des enfants peuvent déjà pointer vers le mauvais parent en production. Le correctif empêche de nouvelles réécritures, il ne répare pas les anciennes. Ni requête de détection, ni note « rien à réparer, voici pourquoi ». *Story à écrire.* — reporté
- [x] [Review][Defer] **`sale.ownerId` / `rental.ownerId` sont réécrits par un enregistrement à vide** — `ownerId: data.ownerId ?? property.ownerId`, alors qu'aucun formulaire ne rend ce champ : la valeur est dérivée du bien à chaque sauvegarde. Même classe que BUG-34, sur un lien calculé côté serveur plutôt que soumis. L'inventaire, bâti par `grep name="..."`, ne pouvait pas le voir. — reporté, préexistant
- [x] [Review][Defer] **Restauration entre les deux requêtes** : le parent restauré entre le `findMany` et le `findFirst` n'est dans aucune des deux listes, et le défaut d'origine réapparaît. Fenêtre étroite, non transactionnelle. — reporté
- [x] [Review][Defer] **Un `defaultValue` sans option correspondante reste silencieux pour toute autre cause** que la corbeille (identifiant d'une autre agence, dérive de données). Le correctif ferme une cause, pas le symptôme. — reporté
- [x] [Review][Defer] **`libelleOption` accepte une ligne sans `deletedAt`** : un futur écran qui oublie `deletedAt: true` dans son `select` compile et n'étiquette rien. Rendre le champ requis transformerait l'oubli en erreur de compilation. — reporté
- [x] [Review][Defer] **Le parent en corbeille est placé en tête**, ce qui casse l'ordre annoncé et en fait la cible du repli du navigateur pour tout autre décalage. — reporté
- [x] [Review][Defer] **Une requête de plus par affichage**, y compris quand le parent est vivant. La story annonçait « un aller-retour » ; c'est un à trois. — reporté

### Change Log

- 12-08-2026 — story créée à partir de BUG-34, relevé par la revue de la story 4.6 et reproduit sur l'instance. Arbitrage rendu par délégation.
- 12-08-2026 — **revue adversariale : le correctif rendait les cinq écrans impossibles à enregistrer**, et le test ne pouvait pas le voir. Chemins d'écriture réparés par `lienInchange()`, étiquette et correction volontaire désormais assertées, 7 mutations rougissent, 7 reports tracés.
- 12-08-2026 — phase rouge sur les cinq écrans, puis helper unique et dix couples traités. 5 mutations sur 5 rougissent, et l'une d'elles dément l'hypothèse que Radix protégeait `sales` et `rentals`.
