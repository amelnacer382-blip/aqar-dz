---
baseline_commit: 5fe626b
---

# Story 3.1 : Borner les saisies numériques

Status: done *(17-08-2026 — cinq bornes posées, cinq mutations jouées
séparément. `BUG-05` et `BUG-11` corrigés. Aucune tâche ne relève de
l'éditeur.)*

**Épopée :** 3 — Fiabiliser les données et la tenue à la charge
**Couvre :** `BUG-05` (n° audit 11) et `BUG-11` (n° audit 21)
**Ouverte le :** 17-08-2026

---

## Story

As a **agent**,
I want **que le formulaire refuse une valeur impossible**,
So that **je ne perde pas ma saisie sur un écran d'erreur technique, et que les calculs restent justes.**

---

## Ce que les défauts disent, et ce que la mesure ajoute

`BUG-05` **[CONFIRMÉ]** — le formulaire annonce « Commission (%) », la
colonne est `Decimal(5,2)`, et le schéma Zod n'impose que `>= 0` :

| Saisie | Intention probable | Résultat aujourd'hui |
|---|---|---|
| `1000` | 1 000 DA de commission | `numeric field overflow` → **écran d'erreur, saisie perdue** |
| `150` | 150 000 DA | **accepté** — la gestion locative calculera 150 % du loyer |

`BUG-11` **[CONFIRMÉ]** — `rooms`, `bedrooms`, `bathrooms`, `floor`,
`totalFloors` acceptent tout entier positif, alors que les colonnes sont
des `Int` 32 bits.

### Les trois bornes, mesurées le 17-08-2026

Contre la base, sur des expressions pures (aucune table touchée) :

```
OK      numeric(5,2)  <- 999.99
REFUSE  numeric(5,2)  <- 1000               ERROR: numeric field overflow   (22003)
OK      numeric(15,2) <- 9999999999999.99
REFUSE  numeric(15,2) <- 10000000000000     ERROR: numeric field overflow   (22003)
OK      int4          <- 2147483647
REFUSE  int4          <- 2147483648         ERROR: integer out of range     (22003)
```

### Le piège : « commission » désigne trois choses différentes

C'est le point qui décide de toute la correction, et il ne se voit pas
depuis le nom du champ :

| Champ | Colonne | Ce que c'est |
|---|---|---|
| `Property.commission` | `Decimal(5,2)` | un **taux**, en % — ≤ 100 |
| `Sale.commission` | `Decimal(15,2)` | un **montant**, en DA |
| `RentalManagement.commission` | `Decimal(15,2)` | un **montant**, en DA |

**Un `.max(100)` posé sur le nom « commission » casserait les ventes et la
gestion locative** — plus aucune commission au-delà de 100 DA. C'est
exactement `CLAUDE.md` §8 : une correction déplace le problème avant de le
fermer. Seul `propertySchema` reçoit la borne de taux.

### Le même défaut vit ailleurs, et le fermer à moitié n'aurait pas de sens

`BUG-05` nomme la commission, mais **toutes** les colonnes `Decimal(15,2)`
sont dans le même cas — `salePrice`, `rentPrice`, `finalPrice`,
`monthlyRent`, `deposit`, `agencyFees`, `budget`, `amount`, `charges`,
`expenses`, `rentAmount` — parce qu'elles passent toutes par
`optionalNumber` ou `requiredAmount`, qui n'ont **aucune borne haute**.

L'AC-1 exige « sans erreur `numeric field overflow` ». Borner la seule
commission laisserait un `salePrice` de 10 000 000 000 000 produire
exactement l'erreur que cette story existe pour supprimer, **sur le champ
le plus utilisé du produit**. Les deux primitives sont donc bornées.

C'est une extension délibérée du périmètre littéral, écrite ici pour
qu'elle soit relisible : même défaut, même ligne de code, et la refuser
aurait été livrer un défaut à moitié fermé.

### §8 — ce que la correction rend atteignable, mesuré avant de coder

Une borne neuve **rejette les données existantes qui la dépassent** : une
fiche déjà en base deviendrait impossible à ré-enregistrer. Compté avant
d'écrire une ligne :

```
commission de bien > 100 (taux)          0        max observé : 10
rooms|bedrooms|bathrooms > 100           0        max observé : 7
floor|total_floors > 200                 0        max observé : 6
biens au total                           6
```

**Aucune fiche existante ne tombe sous les nouvelles règles.** Si cela
change un jour — une reprise de données, par exemple —, c'est ce paragraphe
qu'il faudra rouvrir, et la mesure est ici pour ça.

---

## Acceptance Criteria

### AC-1 — La commission d'un bien est un taux, et le produit le dit

**Given** le champ « Commission (%) » et une colonne `Decimal(5,2)`
**When** l'agent saisit `1000`
**Then** le formulaire refuse **avec un message français**, sans erreur
`numeric field overflow` et sans écran technique

**Given** un taux de `150`
**When** il est soumis
**Then** il est refusé, et le message précise **« en pourcentage du loyer ou
du prix de vente »**

**And** `100` reste accepté — la borne est inclusive, un mandat à 100 % est
une valeur légitime

### AC-2 — Une commission qui est un MONTANT n'est pas bornée à 100

**Given** `Sale.commission` et `RentalManagement.commission`, en
`Decimal(15,2)`
**When** une commission de `250 000` DA est soumise
**Then** elle est **acceptée** — la borne de taux ne s'applique qu'aux biens

> Le contrôle qui empêche la correction de casser deux modules. Sans lui,
> `.max(100)` sur « commission » passerait tous les tests de l'AC-1.

### AC-3 — Les entiers sont bornés avant PostgreSQL

**Given** `rooms`, `bedrooms`, `bathrooms`, `floor`, `totalFloors`
**When** une valeur dépasse une borne réaliste
**Then** elle est refusée **avant** d'atteindre PostgreSQL, avec un message
français

**And** `Document.size`, qui partage la même primitive, reste borné à
l'entier 32 bits et **pas** à une borne de logement

### AC-4 — Les montants sont bornés à ce que la colonne accepte

**Given** une colonne `Decimal(15,2)`
**When** un montant de `10 000 000 000 000` est soumis
**Then** il est refusé par un message français, pas par un
`numeric field overflow`

### AC-5 — Prouvé par mutation, sur le produit servi

**Given** que ces bornes vivent dans des schémas Zod
**When** la story est terminée
**Then** chaque borne est **prouvée par mutation** — retirée, le cas
correspondant doit rougir —, `tsc` et `lint` restant verts pour que le
rouge ne vienne pas du build (§6, piège 3)
**And** chaque refus a son **contrôle positif** : une valeur juste passe sur
le même chemin, sinon un formulaire cassé pour tout le monde donnerait le
même vert

---

## Tasks / Subtasks

- [x] **T1** — `lib/validations/index.ts` : les deux constantes mesurées
      (`MONTANT_MAX`, `ENTIER_MAX`) avec leur mesure en commentaire.
- [x] **T2** — Borner `optionalNumber` et `requiredAmount`. *(AC-4)*
- [x] **T3** — Borner `optionalInt` à l'entier 32 bits — couvre
      `Document.size`. *(AC-3, seconde clause)*
- [x] **T4** — Un taux `0..100` pour **`propertySchema.commission` seul**,
      message nommant le pourcentage. *(AC-1)*
- [x] **T5** — Des bornes réalistes pour pièces et étages. *(AC-3)*
- [x] **T6** — `tests/bornes.spec.ts` : refus **et** contrôle positif pour
      chaque borne, plus le cas AC-2 qui protège ventes et quittances.
- [x] **T7** — **Mutation**, borne par borne, `tsc` + `lint` verts d'abord.
      *(AC-5)*
- [x] **T8** — `BUG-05` et `BUG-11` marqués corrigés dans
      `docs/qa/bug-report.md`.
- [x] **T9** — Contrôles §9, `sprint-status.yaml`, File List.

---

## Dev Notes

### Où ça se corrige, et où ça ne se corrige pas

**Tout se joue dans `lib/validations/index.ts`.** `CLAUDE.md` §2 interdit
`formData.get(x) as Enum` et impose `parseForm(schema, formData)` : les
écrans ne valident donc rien eux-mêmes, et il n'y a pas de second endroit à
corriger. C'est ce qui rend cette story courte.

**Les libellés d'écran ne sont pas dans le périmètre.** `BUG-05` suggère
« un message qui dit explicitement *en pourcentage du loyer ou du prix de
vente* » : ce message part du **schéma**, donc il s'affiche par
`withError()` sans toucher aux écrans.

### Le découpage des primitives, et pourquoi il n'est pas arbitraire

| Primitive | Borne | Ce qu'elle alimente |
|---|---|---|
| `optionalNumber`, `requiredAmount` | `MONTANT_MAX` | tous les `Decimal(15,2)` |
| `optionalInt` | `ENTIER_MAX` | `rooms`…`totalFloors` **et `Document.size`** |
| *(neuve)* borne de pièces | 100 | `rooms`, `bedrooms`, `bathrooms` |
| *(neuve)* borne d'étages | 200 | `floor`, `totalFloors` |
| *(neuve)* taux | 100 | `propertySchema.commission` **seul** |

**`Document.size` est le piège de T3.** Il partage `optionalInt` et vaut des
octets : le borner à 100 casserait tout téléversement. La borne générique
reste donc l'entier 32 bits, et les bornes de logement s'ajoutent par-dessus.

**`surface` reste sur `optionalNumber`, à dessein.** C'est un `Float`, pas
un `Decimal` : il ne déborde pas, donc il n'est pas dans `BUG-05`/`BUG-11`.
Lui donner une borne « réaliste » serait un **arbitrage produit** — quelle
surface maximale pour un terrain agricole en Algérie ? — qui n'appartient
pas au développeur (§13). Non fait, et écrit ici plutôt que passé sous
silence.

**100 pièces et 200 étages sont des choix, pas des mesures.** Motif : une
agence immobilière algérienne, et le plus haut bâtiment du monde compte
163 étages. Ils sont réversibles en une ligne, et le maximum réellement
observé en base est de 7 pièces et 6 étages.

### Le test qui ne doit pas manquer

L'AC-2 est le contrôle qui empêche cette story d'en casser deux autres. Un
`.max(100)` sur « commission » passerait **tous** les cas de l'AC-1 et
rendrait impossible toute vente avec commission — soit exactement le
scénario de `CLAUDE.md` §8, trois fois vérifié dans ce dépôt.

Le harnais est celui de la story 4.8 : `tests/formulaire.ts`
(`releverFormulaire`, `rejouer`), qui relève le formulaire **servi** et
rejoue l'action. `rejouer()` rend l'URL d'arrivée : c'est elle qui portera
le message de refus à asserter.

### References

- `docs/qa/bug-report.md` — `BUG-05`, `BUG-11`
- `lib/validations/index.ts` — `optionalNumber`, `requiredAmount`,
  `optionalInt`, `propertySchema`
- `prisma/schema.prisma:366` (`Decimal(5,2)`), `:522`, `:590`
  (`Decimal(15,2)`)
- `tests/formulaire.ts` — harnais de la story 4.8
- `CLAUDE.md` §6 (mutation, contrôle positif, piège 3), §7 (mesurer),
  §8 (qu'ai-je rendu atteignable), §13 (arbitrage produit)

---

## Preuves — 17-08-2026

### T7 — cinq mutations, jouées séparément

| Mutation | `tsc` | `lint` | Rouges | Le message |
|---|---|---|---|---|
| taux desserré à 100 000 | 0 | 0 | **1** | *« le refus de 1000 n'annonce pas le pourcentage »* |
| borne d'étages retirée | 0 | 0 | **1** | *« un bien a ete cree avec 5000 etages »* |
| `ENTIER_MAX` desserré | 0 | 0 | **1** | *« la taille hors colonne n'a pas ete refusee par un message »* |
| `MONTANT_MAX` retiré | 0 | 0 | **1** | *« le refus n'annonce pas un maximum »* |
| **taux posé sur la VENTE** | 0 | 0 | **1** | *« LA CORRECTION A DEPLACE LE PROBLEME (§8) : une commission de 250 000 DA sur une vente a ete refusee »* |

**Un seul cas rouge à chaque fois.** La dernière ligne est celle qui compte :
elle prouve que le garde-fou de l'AC-2 fonctionne, c'est-à-dire que la
correction ne peut pas casser deux modules sans qu'on le sache.

### Deux mutations d'abord refusées — et c'est le piège 3 de §6

Les deux premières tentatives ont été **rejetées par le harnais lui-même** :
retirer `commission: tauxPourcent` rendait `tauxPourcent` inutilisé, retirer
le `refine` rendait `ENTIER_MAX` inutilisé — `lint` en erreur, donc
`next build` en échec, donc un rouge qui n'aurait rien prouvé.

Rejouées en **desserrant** la borne au lieu de retirer la ligne : le symbole
reste utilisé, `lint` reste vert, et le rouge vient bien du test.

### Un défaut trouvé dans mon propre test, par la mutation

Le cas de `Document.size` n'assertait d'abord que « la ligne n'a pas
changé ». Or **sans borne, PostgreSQL lève et la ligne ne change pas non
plus** : la mutation l'a laissé **vert**. C'est mot pour mot le piège 1 de
`CLAUDE.md` §6 — *« un test qui vérifie que X n'a pas changé doit aussi
vérifier que l'opération a EU LIEU »*.

Corrigé en assertant aussi le **message de refus** : un refus propre porte
un texte, un plantage n'en porte pas. Le même raisonnement rendait déjà le
cas des montants probant, et c'est pour cela qu'il l'était.

### T9 — les contrôles

```
npx tsc --noEmit     0 erreur
npm run lint         0 erreur (4 avertissements préexistants, <img>)
npm run test:e2e     158 passed  (153 avant, plus les 5 ajoutés)
```

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — `claude-opus-5[1m]`

### Debug Log References

- Bornes mesurées contre la base sur des expressions pures (aucune table).
- `§8` : décompte des lignes existantes au-dessus des bornes envisagées,
  **avant** d'écrire une ligne de code.
- T7 : cinq mutations scriptées, chacune avec restauration, `tsc`, `lint`,
  puis exécution du seul `bornes.spec.ts`. Rapports JSON lus.

### Completion Notes List

1. **Le vrai sujet de cette story n'est pas la borne, c'est le nom.**
   « Commission » désigne un taux dans un modèle et un montant dans deux
   autres. La correction évidente — `.max(100)` sur le champ — aurait
   passé tous les tests de `BUG-05` et cassé les ventes.
2. **Le périmètre a été étendu délibérément** à toutes les colonnes
   `Decimal(15,2)`. L'AC-1 exige « sans erreur `numeric field overflow` » :
   borner la seule commission l'aurait laissé vivre sur `salePrice`, le
   champ le plus utilisé du produit.
3. **`Document.size` a imposé deux couches** plutôt qu'une. Il partage
   `optionalInt` avec `rooms` et vaut des octets : une borne de logement sur
   la primitive commune aurait cassé tout téléversement.
4. **`surface` n'a pas reçu de borne réaliste**, et c'est écrit dans le
   code. C'est un `Float` — il ne déborde pas, donc il n'est ni dans
   `BUG-05` ni dans `BUG-11` — et fixer une surface maximale pour un terrain
   agricole est un arbitrage produit, pas une décision de développeur (§13).
5. **100 pièces et 200 étages sont des choix, pas des mesures**, réversibles
   en une ligne. Le maximum réellement observé en base est de 7 et 6.
6. **`100 %` est accepté** : un mandat à 100 % est légitime, et le contrôle
   positif le garde — une borne posée à `< 100` rougirait.

### Change Log

| Date | Version | Description |
|---|---|---|
| 17-08-2026 | 0.1 | Story rédigée. Trois bornes mesurées contre la base, et l'absence de données existantes en infraction vérifiée avant d'écrire une ligne. |
| 17-08-2026 | 1.0 | Développée. Cinq bornes, cinq mutations séparées, 158 verts. `BUG-05` et `BUG-11` corrigés. |

### File List

**Nouveaux**
- `docs/stories/3-1-borner-les-saisies-numeriques.md`
- `tests/bornes.spec.ts`

**Modifiés**
- `lib/validations/index.ts`
- `docs/qa/bug-report.md`
- `docs/stories/sprint-status.yaml`
