---
baseline_commit: 77323af
---

# Story 3.11 : Réparer les liens déjà réécrits

Status: in-progress *(18-08-2026 — `REP-02` soldé, `BUG-39` et `BUG-40`
trouvés en chemin et corrigés. **`REP-01` reste ouvert et relève de
l'éditeur** : il demande la base de production, que je ne peux ni ne dois
toucher.)*

**Épopée :** 3 — Fiabiliser les données et la tenue à la charge
**Couvre :** `REP-01` *(éditeur)*, `REP-02` ✅, `BUG-39` ✅, `BUG-40` ✅
**Ouverte le :** 18-08-2026

---

## Story

As a **éditeur**,
I want **savoir quelles lignes BUG-34 a corrompues avant de les corriger**,
So that **la réparation ne repose pas sur une supposition.**

---

## Ce que j'ai pu faire, et ce que je ne peux pas

| | |
|---|---|
| `REP-02` — le propriétaire recalculé à chaque enregistrement | ✅ **corrigé et éprouvé** |
| `BUG-39` — le propriétaire posé par un POST, sans contrôle d'agence | ✅ **trouvé en chemin, corrigé, éprouvé** |
| `BUG-40` — une date qui recule d'un jour | ✅ **trouvé par un test rouge, corrigé, éprouvé** |
| `REP-01` — retrouver et réparer les lignes déjà corrompues | ⛔ **l'éditeur.** La requête de détection existe (`docs/qa/detection-bug-34.sql`) et a été éprouvée sur une victime fabriquée ; **la passer sur la production n'est pas à moi**, et décider du sort des lignes remontées encore moins — corriger d'office supposerait de savoir quelle valeur était la bonne, ce que seule l'agence sait |

---

## `REP-02` et `BUG-39` tenaient sur la même ligne

C'est ce qui explique qu'aucun des deux n'ait été vu :

```ts
data: { ...data, ownerId: data.ownerId ?? property.ownerId }
```

### À gauche du `??` — `REP-02`

Aucun des quatre écrans ne rend de champ `ownerId`. La valeur soumise est
donc **toujours absente**, et le propriétaire est **recalculé depuis le
bien à chaque enregistrement**. Si le bien a changé de mains depuis, la
vente suit silencieusement.

C'est la famille de `BUG-34` — *« enregistrer sans rien changer réécrit un
lien »* — sur un lien **calculé côté serveur**. L'inventaire des couples
écran → champ de la story 3.9 avait été bâti par `grep name="..."` : il ne
pouvait pas voir un champ que le formulaire ne rend pas.

### À droite du `??` — `BUG-39`, et c'est une fuite

`saleSchema` et `rentalSchema` **acceptaient pourtant** `ownerId`, et
**personne ne le vérifiait contre l'agence**. Un identifiant posé dans un
POST rattachait la vente au propriétaire d'une **autre agence** — dont le
nom ressort ensuite dans le contrat PDF, dans l'écran de gestion locative
et dans l'export CSV.

**Reproduit, pas déduit.** Le rejeu a répondu :

```
/agency/sales/<id>?success=Vente mise a jour
sale.ownerId = <propriétaire de l'agence voisine>
```

Le mécanisme de vérification **existait déjà** —
`verifyPaymentLinks`, écrit pour les paiements. Il n'avait jamais été
appliqué ici.

### Le correctif, en une phrase

Le propriétaire n'est **plus jamais reçu du formulaire** : la clef est
retirée des deux schémas, et la valeur est **dérivée du bien**, qui est
vérifié. Elle n'est réécrite **que si le bien change** — auquel cas elle
doit suivre, la vente portant alors sur un autre bien.

---

## `BUG-40` — trouvé par un rouge, pas par une lecture

La suite a échoué sur un cas d'abonnement **sans rapport** avec le travail
en cours. L'heure a tout expliqué : **00 h 35 en heure locale, 23 h 35 en
UTC.**

`toDateInputValue()` convertissait en UTC une date écrite à **minuit
local** — mesuré, `Visit.date` à `T23:00:00.000Z`, cinq lignes sur cinq. Le
formulaire affichait donc **la veille**, et l'enregistrement l'écrivait :
la visite reculait d'un jour.

**En UTC pur, le défaut est invisible.** C'est ce qui l'a laissé passer :
il ne se voit pas depuis un serveur en UTC, et il se voit tous les jours
depuis Alger.

La convention est désormais **unique et écrite** : une date désigne un
**jour civil dans le fuseau de l'agence**, lue en parties locales et relue
à minuit local. Les deux bouts ne peuvent pas bouger l'un sans l'autre, et
**deux mutations le prouvent** — une par bout.

---

## Ce qui reste, et pourquoi je ne le fais pas

**`REP-01` demande la base de production.** `CLAUDE.md` §2 :

> **Toucher à une base de production** — *Jamais, sous aucun prétexte. Les
> requêtes de contrôle sont fournies en lecture seule et exécutées par
> l'éditeur.*

Ce n'est pas une limite technique que je pourrais contourner : c'est la
règle, et elle est juste. Ce qui est prêt pour vous :

1. **La requête de détection** — `docs/qa/detection-bug-34.sql`, déjà
   éprouvée sur une victime fabriquée. Elle est en lecture seule.
2. **Ce qu'elle ne trouvera pas**, et il faut le savoir avant de conclure :
   **une visite réécrite reste indétectable.** `Visit` n'a aucune colonne
   redondante qui permette de comparer le lien actuel à un état antérieur.
   Une détection à zéro ligne ne veut donc pas dire « rien n'a été
   corrompu » — elle veut dire « rien de détectable ».
3. **Ce que `BUG-40` ajoute à l'enquête** : les dates déjà reculées d'un
   jour par un enregistrement passé sont, elles aussi, indétectables — rien
   ne garde la valeur d'origine. Même base, même arbitrage, même passage.
4. **La décision sur les lignes remontées reste la vôtre.** Corriger
   d'office supposerait de savoir quelle valeur était la bonne, ce que seule
   l'agence sait.

---

## Acceptance Criteria

**Given** `sale.ownerId` et `rental.ownerId` sont réécrits par un enregistrement à vide
**When** la story est terminée
**Then** ils ne le sont plus ✅ — et le geste est éprouvé, avec son contrôle positif

**Given** que le champ était accepté du formulaire sans contrôle d'agence
**When** on le mesure
**Then** le défaut est reproduit, inscrit (`BUG-39`) et fermé ✅

**Given** la requête de détection
**When** l'éditeur la passe sur la production
**Then** le sort des lignes remontées est décidé ⛔ **non fait — l'éditeur**

**Given** qu'une visite réécrite est indétectable
**When** la story est terminée
**Then** cette limite est **assumée par écrit**, pas masquée ✅

---

## Tasks / Subtasks

- [x] T1 — instruire `REP-02` et mesurer ce que la ligne fait vraiment
- [x] T2 — obtenir le rouge **avant** de corriger, sur les deux défauts
- [x] T3 — retirer `ownerId` des deux schémas, dériver du bien vérifié
- [x] T4 — les quatre écrans : création et édition, vente et bail
- [x] T5 — `BUG-40` : reproduire, corriger la convention aux deux bouts
- [x] T6 — cinq mutations, jouées séparément
- [x] T7 — `tsc` 0 · `lint` 0 · `test:e2e` **201 passed**
- [x] T8 — `BUG-39` et `BUG-40` inscrits au registre ; `REP-02` soldé
- [ ] **T9 — passer `detection-bug-34.sql` sur la production, et décider du
      sort des lignes remontées. L'ÉDITEUR.** C'est cette tâche qui garde la
      story `in-progress`.

---

## Preuves — les cinq mutations

| # | Ce qu'on casse | Résultat | Message lu |
|---|---|---|---|
| **M1** | la ligne d'origine est remise sur la vente | ROUGE ×2 | *« rattachée au propriétaire d'une autre agence »* **et** *« le vendeur a suivi le nouveau propriétaire du bien »* |
| **M2** | le vendeur ne suit plus un changement de bien | ROUGE | *« changer le bien ne fait plus suivre le vendeur »* |
| **M3** | le trou est remis du côté des **baux** | ROUGE | *« le bail a été rattaché au bailleur d'une autre agence »* |
| **M4** | `toDateInputValue` repasse en UTC | ROUGE | *« le formulaire affiche une autre date que celle enregistrée »* |
| **M5** | l'**écriture** repasse en UTC | ROUGE | *« la date est enregistrée à 1 h locale et non à minuit »* |

**M3 existe parce que M1 ne suffisait pas.** Le correctif touche deux
écrans ; un seul était éprouvé. Sans le cas des baux, retirer la garde de
`rentals/[id]/edit` n'aurait **rien** fait rougir — deux écrans réparés, un
seul gardé, et c'est ainsi qu'une moitié de correctif se défait sans bruit.

**M5 a fait ajouter une assertion.** Sans elle, la mutation du côté écriture
restait **verte** : en UTC+1, écrire minuit UTC puis relire en parties
locales redonne le bon jour. L'aller-retour n'est sain qu'à une heure près,
et il dérive d'un jour entier dans tout fuseau négatif — où personne ici
n'irait le constater. Le jour civil se lit donc à l'heure : minuit local,
ou rien.

> ⚠ **Un contrôle positif était écrit contre l'ancien contrat.** Sa première
> version rejouait le formulaire avec un propriétaire de *sa propre* agence
> et attendait qu'il soit écrit. Il ne l'est plus **du tout** — c'est le
> correctif. Le rouge disait que le **test** était périmé, pas le produit.
> Réécrit sur la propriété qui compte : l'enregistrement doit aboutir et
> écrire le reste.

---

## Ce que ce travail ne prouve pas

- **Aucune ligne existante n'est réparée.** Le produit ne corrompt plus ;
  ce qu'il a corrompu avant reste en base. C'est `REP-01`, et c'est la
  tâche T9.
- **Le cas de `BUG-40` ne se déclenche que si le fuseau décale la date.**
  En UTC pur il passe sans rien prouver. C'est écrit dans son en-tête
  plutôt que masqué — et c'est précisément pourquoi le défaut a survécu si
  longtemps.
- **Les autres écrans à date n'ont pas de cas dédié.** `Payment.date`,
  `RentalManagement.paymentDate`, `Visit.followUpDate` passent par la même
  fonction et sont donc corrigés ; seule la visite est **éprouvée**. Le
  correctif est central, la couverture ne l'est pas.

---

## Dev Agent Record

### Debug Log

- `npx tsc --noEmit` → 0 erreur
- `npm run lint` → 0 erreur, 0 avertissement
- `npm run test:e2e` → **201 passed** (197 avant : +3 sur le propriétaire,
  +1 sur les dates)

### Completion Notes

- **Un test de la suite rougissait une heure par jour**, sur un produit
  correct : `tests/features.spec.ts` construisait une échéance par
  `toISOString()` alors que le produit compte les jours en calendrier
  local. Corrigé au passage — et c'est ce rouge qui a mené à `BUG-40`.
- **Décomptes recalculés** : 7 épopées, 63 stories dans les deux sources,
  **40 défauts** (38 avant — `BUG-39` et `BUG-40`). Aucune story ouverte :
  les deux défauts sont portés par celle-ci.

---

## Change Log

| Date | Version | Description |
|---|---|---|
| 18-08-2026 | 0.9 | `REP-02`, `BUG-39`, `BUG-40` fermés ; `REP-01` reste à l'éditeur |

---

## File List

**Créés**

- `tests/proprietaire-derive.spec.ts`
- `tests/dates-fuseau.spec.ts`
- `docs/stories/3-11-reparer-les-liens-deja-reecrits.md`

**Modifiés**

- `lib/validations/index.ts` — `ownerId` retiré des deux schémas ;
  `jourCivilLocal`
- `lib/format.ts` — `toDateInputValue` en parties locales
- `app/agency/sales/new/page.tsx`, `app/agency/sales/[id]/edit/page.tsx`,
  `app/agency/rentals/new/page.tsx`, `app/agency/rentals/[id]/edit/page.tsx`
- `tests/features.spec.ts` — l'échéance se construit en parties locales
- `docs/qa/bug-report.md` — `BUG-39`, `BUG-40`
- `docs/stories/deferred-work.md`, `docs/stories/sprint-status.yaml`,
  `docs/epics.md`
