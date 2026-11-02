---
baseline_commit: 4e8b1c5
---

# Story 3.5 : Étendre la suppression réversible aux relations

Status: done *(17-08-2026 — six mutations jouées séparément, plus une
septième sur la règle ESLint, prouvée dans les deux sens. `BUG-24` corrigé,
`REP-99` soldé sur ses trois enseignements, `REP-106` ouvert et rattaché à
la story 3.13. Aucune tâche ne relève de l'éditeur.)*

**Épopée :** 3 — Fiabiliser les données et la tenue à la charge
**Couvre :** `BUG-24` (n° audit 15, NFR-06) · `REP-99`
**Ouverte le :** 17-08-2026

---

## Story

As a **agence**,
I want **que les compteurs affichés correspondent à ce que je vois**,
So that **« 4 biens » sur la fiche d'un propriétaire ne renvoie pas trois lignes.**

---

## Ce que le défaut dit, et ce que le balayage corrige

`BUG-24` décrit un écart entre **deux** écrans : la liste des propriétaires
annoncerait « 4 biens » là où la fiche n'en montrerait que 3. La correction
qu'il propose tient en une phrase — « ajouter `where: { deletedAt: null }` à
chaque `_count` et `include` portant sur `Property`, `Client` ou `Owner` —
cinq endroits ».

**Le balayage a trouvé six endroits, pas cinq, et le sixième dément
l'énoncé du défaut.**

`app/agency/owners/[id]/page.tsx:27` — la fiche elle-même — charge
`properties` en relation imbriquée, **sans filtre**. La fiche ne montre donc
pas 3 biens : elle en montre 4, comme la liste. Les deux écrans sont faux
**du même côté**, et ils sont d'accord entre eux. C'est pire que l'écart
décrit : un écart se voit, une concordance fausse ne se voit pas.

Le bien supprimé apparaît de surcroît avec **un lien vers sa fiche** — et
cette fiche-là, elle, passe par `findFirst`, donc elle est filtrée. Le lien
mène à un `notFound()`.

> Cet écart entre le défaut et le code est reporté dans
> `docs/qa/bug-report.md` : un constat daté ne se réécrit pas, mais il ne se
> recopie pas non plus sans dire ce que la mesure a démenti (§7).

### Les six endroits, et pourquoi ce sont ceux-là

```
$ rg -n 'select: \{[^}]*(properties|clients|owners)' app lib
app/agency/owners/page.tsx:47            _count properties        liste des proprietaires
app/api/export/[entity]/route.ts:157     _count properties        export CSV
app/admin/agencies/page.tsx:111          _count properties        console super admin
app/admin/statistics/page.tsx:51         _count properties+clients page statistiques

$ rg -n 'include: \{' app lib -A6 | rg 'properties:|clients:|owners:'
app/agency/owners/[id]/page.tsx:27       include properties       fiche proprietaire
```

Le sixième n'est pas une relation mais l'angle mort jumeau, celui que
`lib/prisma.ts` documente et n'a jamais couvert :

```
$ rg -n 'prisma\.(property|client|owner)\.findUnique'
app/vitrine/[slug]/actions.ts:99         findUnique Property      formulaire public
```

### Ce qui n'est PAS à corriger, et c'est la moitié du travail

Vingt-et-un `include` nomment `property`, `client` ou `owner` **au
singulier** — la relation vers le parent depuis une location, une vente, une
visite, un paiement. **Aucun ne doit être filtré.**

C'est un arbitrage déjà rendu, et payé : la story 3.9 existe précisément
parce qu'un enfant privé de son parent en corbeille cassait cinq écrans
d'enregistrement (`lib/corbeille.ts`, `BUG-34`). Une quittance dont le
locataire est à la corbeille doit continuer d'afficher son nom — sinon la
ligne devient anonyme et l'agence perd la trace d'un loyer dû.

**La règle qui sépare les deux cas :** on filtre les relations **au
pluriel** — un inventaire, qui ne doit pas compter ce qui n'existe plus — et
on ne filtre jamais les relations **au singulier** — une provenance, qui
doit rester lisible même après la mise à la corbeille.

---

## REP-99 — la règle nomme `delete()` et laisse passer `deleteMany()`

Éprouvé aux dépens de ce dépôt le 15-08-2026 : un `client.deleteMany()`
destiné à retirer un doublon a emporté une location et ses quittances.

Deux choses manquaient, et aucune n'était une nouvelle règle.

### 1. La commande de contrôle qui n'existait pas

*« Combien de tables tombent si l'on supprime un `Client` ? La réponse
n'est écrite nulle part. »* Elle l'est maintenant, et **elle est calculée,
pas recopiée** : `scripts/cascades-corbeille.mjs` lit `prisma/schema.prisma`
et suit les arêtes `onDelete`. Il ne parle à aucune base.

```
$ npm run audit:cascades
Source : prisma/schema.prisma — 35 aretes @relation lues

### Supprimer un Property     DETRUIT 5 table(s), DETACHE 4 lien(s)
    - Property -> PropertyImage
    - Property -> Visit
    - Property -> Sale
    - Property -> Rental
    - Property -> Rental -> RentalManagement

### Supprimer un Client       DETRUIT 5 table(s), DETACHE 3 lien(s)
    - Client -> Visit
    - Client -> Sale
    - Client -> Rental
    - Client -> Interaction
    - Client -> Rental -> RentalManagement      <-- l'incident du 15-08

### Supprimer un Owner        DETRUIT 1 table(s), DETACHE 4 lien(s)
    - Owner -> Interaction

TOTAL : 11 suppressions en cascade partant des trois modeles.
```

La chaîne à **deux niveaux** est celle que personne n'aurait citée de
mémoire, et c'est exactement celle qui a mordu : `Client → Rental` était
connue, `Rental → RentalManagement` ne l'était pas.

### 2. Une phrase de `CLAUDE.md` que rien ne faisait respecter

`§2` interdit `prisma.property|client|owner.delete()`. La phrase est juste ;
elle est écrite au singulier, et **`deleteMany()` a exactement le même
effet**. Une phrase qui dépend de la vigilance d'un lecteur n'a rien empêché
le 15-08.

Elle devient donc **une règle ESLint** — `no-restricted-syntax`, aucune
dépendance ajoutée —, avec sa seule exception nommée à l'endroit où elle
s'exerce : `app/agency/trash/page.tsx`, où « Détruire » *doit* détruire.

---

## Ce que l'inventaire dit d'un écran, et qu'on ne peut pas laisser

La corbeille avertit, sous le tableau :

> « Détruire » efface la ligne et tout ce qui en dépend (**photos, visites,
> historique**). Cette action est irréversible et reste inscrite au journal.

L'inventaire vient de nommer ce qui tombe réellement : **ventes, locations
et quittances** en font partie. La phrase cite trois conséquences
anodines et tait les trois qui portent de l'argent.

Ce n'est pas un correctif hors story : c'est **la mesure produite par
l'AC-1 qui contredit une phrase affichée**. Publier l'inventaire et laisser
la phrase serait exactement ce que §7 reproche.

---

## §8 — ce que ce correctif rend atteignable

### 1. Un compteur qui baisse sans que rien ne soit supprimé

Après la correction, une agence qui met un bien à la corbeille voit « 4
biens » devenir « 3 » sur la fiche du propriétaire. **C'est l'effet
recherché**, mais c'est aussi un nombre qui bouge sans action visible sur
cet écran-là. Rien à corriger : la corbeille est réversible et l'écran de
corbeille dit où le bien est parti.

### 2. Le parc annoncé par la console super admin va baisser

`app/admin/statistics/page.tsx` et `app/admin/agencies/page.tsx` sont lus
par l'éditeur. Leurs nombres vont diminuer du volume des corbeilles. **Il
faut le mesurer avant de corriger**, sinon l'écart sera découvert par
quelqu'un qui le prendra pour une panne. La story 3.3 avait posé la même
question et mesuré : 0 agence concernée à ce moment-là.

### 3. La règle ESLint peut casser un chemin légitime

Trois lignes de `app/agency/trash/page.tsx` appellent `delete()` **à bon
droit**. Une règle qui les interdirait sans exception rendrait la corbeille
invidable — et pousserait le prochain développeur à désactiver la règle
plutôt qu'à la respecter. L'exception est donc posée **ligne par ligne**,
avec son motif, pas au niveau du fichier.

---

## Acceptance Criteria

### AC-1 — Les cascades sont recensées par une commande, pas par une liste

**Given** les trois modèles à corbeille — `Property`, `Client`, `Owner`
**When** `npm run audit:cascades` est lancé
**Then** il énumère toutes les cascades destructives qui en partent, y compris celles à deux niveaux
**And** il les dérive de `prisma/schema.prisma`, sans parler à aucune base

### AC-2 — `deleteMany` est traité comme `delete`

**Given** la règle §2 de `CLAUDE.md`, écrite au singulier
**When** un appel `prisma.property|client|owner.delete()` ou `.deleteMany()` est ajouté hors de la corbeille
**Then** `npm run lint` le refuse, avec un message qui dit quoi faire à la place
**And** les trois appels légitimes de `app/agency/trash/page.tsx` restent autorisés, chacun avec son motif écrit

### AC-3 — Un bien à la corbeille n'est plus compté

**Given** un propriétaire de 4 biens dont 1 à la corbeille
**When** la liste des propriétaires, sa fiche, l'export CSV, la console super admin et la page statistiques s'affichent
**Then** tous annoncent **3**
**And** la fiche ne propose plus de lien vers le bien supprimé

### AC-4 — La relation au singulier reste lisible

**Given** une location dont le client est à la corbeille
**When** l'écran de gestion locative s'affiche
**Then** le nom du client y figure toujours — la story 3.9 n'est pas défaite

### AC-5 — `lib/prisma.ts` énonce sa limite au lieu de la masquer

**Given** l'extension ne filtre que le `where` de premier niveau
**When** on lit son commentaire
**Then** il nomme les relations imbriquées, les `_count` et `findUnique` comme non couverts, et renvoie à la règle qui les traite

### AC-6 — `findUnique` ne sert plus sur un modèle à corbeille

**Given** `app/vitrine/[slug]/actions.ts:99`
**When** on parcourt le code
**Then** aucun appel `findUnique` ne porte sur `Property`, `Client` ou `Owner`

### AC-7 — Prouvé par mutation

**Given** chaque garde posée par cette story
**When** on la retire une par une
**Then** un test rougit, et son message désigne la propriété visée

---

## Tasks / Subtasks

- [x] **T1** — Mesurer l'état actuel : parc annoncé par la console super admin avant correction (§8, point 2)
- [x] **T2** — Écrire `tests/corbeille-relations.spec.ts` et le voir rouge sur les six endroits
- [x] **T3** — Corriger les quatre `_count` et l'`include` de la fiche propriétaire
- [x] **T4** — Remplacer le `findUnique` de la vitrine
- [x] **T5** — Poser la règle ESLint, exempter la corbeille ligne par ligne, mettre `CLAUDE.md` §2 au pluriel
- [x] **T6** — Corriger le commentaire de `lib/prisma.ts` et l'avertissement de la corbeille
- [x] **T7** — Prouver par mutation, une mutation à la fois
- [x] **T8** — `tsc`, `lint`, `test:e2e`, docs, décomptes recalculés

---

## Dev Notes

### Le test doit éprouver les deux sens

Un test qui vérifie « le bien supprimé n'est plus compté » est vert si le
compteur est cassé et affiche toujours 0. **Le contrôle positif est
obligatoire** (§6) : le même test vérifie que les 3 biens restants **sont**
comptés, et que le quatrième était compté **avant** d'être mis à la
corbeille.

### L'export CSV se lit, il ne se clique pas

`app/api/export/[entity]/route.ts` est une route API : le test la demande
avec le cookie de session et lit le corps. C'est le seul des six endroits
qui ne soit pas une page.

### References

- `docs/qa/bug-report.md` — `BUG-24`
- `docs/stories/deferred-work.md` — `REP-99`
- `lib/prisma.ts` — l'extension et sa portée réelle
- `lib/corbeille.ts` + story 3.9 — pourquoi la relation au singulier n'est pas filtrée
- `CLAUDE.md` §2, §6, §7, §8

---

## Preuves — 17-08-2026

### T1 — l'état avant, mesuré et non supposé

La question de §8 était : *les nombres que lit l'éditeur vont-ils bouger ?*

```
Property : 6 au total, 6 hors corbeille  -> ecart 0
Client   : 5 au total, 5 hors corbeille  -> ecart 0
Owner    : 3 au total, 3 hors corbeille  -> ecart 0
Agences dont un nombre affiché change    : 0 sur 75
Fiches propriétaire dont le compteur change : 0 sur 3
```

**Aucun nombre affiché ne change aujourd'hui.** La corbeille est vide sur
cette base — ce qui explique aussi que le défaut ait vécu si longtemps sans
être signalé : il ne se voit qu'à partir de la première suppression.

### T2 — le rouge, et ce qu'il a démenti

```
4 failed, 1 passed
  ✗ la liste des propriétaires passe de 4 à 3   → reçu « 4 biens »
  ✗ la fiche n'affiche plus le bien supprimé    → reçu 1 élément
  ✗ l'export CSV annonce le même nombre         → reçu « 4 »
  ✗ la console super admin et les statistiques  → reçu ["4", "4"]
  ✓ une location dont le client est à la corbeille garde son nom
```

Les quatre contrôles positifs — le comptage **avant** mise à la corbeille —
sont passés dans les quatre cas : les compteurs comptaient bien, ils
comptaient trop.

**Le second cas est celui qui dément `BUG-24`.**
`getByText('Bien 4 …')` a résolu à **1 élément** sur la fiche propriétaire.
La fiche affichait 4, pas 3. Les deux écrans se trompaient du même côté.

Le cinquième cas était vert avant, et devait le rester : c'est le garde-fou
contre la sur-correction.

### T7 — sept mutations, jouées séparément

Chacune précédée d'un `tsc` et d'un `lint` verts, pour qu'un rouge ne puisse
pas venir de la construction (§6, piège 3).

| # | Ce qu'on retire | Résultat | Message |
|---|---|:---:|---|
| M1 | la condition du `_count` de la liste | ROUGE | « encore compté dans `_count.properties` » |
| M2 | la condition de l'`include` de la fiche | ROUGE | « figure toujours dans Biens associés » |
| M3 | la condition du `_count` de l'export | ROUGE | « l'export compte le bien à la corbeille » |
| M4 | la condition du `_count` de la console | ROUGE | attendu `["3","3"]`, reçu une valeur à 4 |
| M5 | la condition du `_count` des statistiques | ROUGE | idem, sur l'autre entrée |
| M6 | **on AJOUTE** un filtre sur la relation au singulier | ROUGE | « la location a perdu le nom de son locataire » |
| M7 | la règle ESLint elle-même | ROUGE puis VERT | voir ci-dessous |

**M6 est l'inverse des autres, et c'est le point le plus important de cette
story.** Elle ne retire pas une garde : elle en ajoute une de trop —
`where: { agencyId, client: { deletedAt: null } }` sur la liste des
locations, la sur-correction la plus naturelle du monde. Le test rougit.
Sans elle, rien n'empêcherait d'étendre demain la correction d'aujourd'hui
aux vingt-et-un `include` au singulier, et de rendre anonymes les quittances
d'un locataire supprimé.

**M7, dans les deux sens.** Un fichier temporaire portant les deux appels
interdits :

```
règle EN PLACE   → 2 erreurs, avec leurs messages respectifs
règle RETIRÉE    → 0 erreur, même fichier
```

C'est bien la règle qui refuse, et rien d'autre.

### T8 — les contrôles

```
npx tsc --noEmit    0 erreur
npm run lint        0 erreur, 4 avertissements <img> préexistants
                    (couvre désormais prisma/, scripts/ et tests/)
npm run test:e2e    173 passed   (168 avant, + 5 ajoutés)
npm run audit:cascades  11 suppressions en cascade recensées
```

**Un test existant a rougi, et il avait raison.**
`tests/comptage.spec.ts` — l'invariant statique posé par la story 3.3 —
exigeait la forme exacte `_count: { select: { users: true, properties: true } }`.
Cette story change cette forme. L'invariant a été **resserré, pas
supprimé** : il exige maintenant la condition de corbeille avec, si bien que
les deux défauts se gardent ensemble. Revenir à `properties: true` ferait
revenir `BUG-24` sans faire revenir `BUG-07` ; une assertion qui ne verrait
que le second laisserait passer le premier.

### Décomptes recalculés (§7)

```
grep -cE '^  epic-[0-9]+:' docs/stories/sprint-status.yaml            -> 7
grep -cE '^  [0-9]+-[0-9]+[a-z0-9-]*:' docs/stories/sprint-status.yaml -> 62
grep -cE '^### Story ' docs/epics.md                                  -> 62
grep -c '^<a id="bug-' docs/qa/bug-report.md                          -> 38
```

---

## Ce que le balayage a trouvé en plus, et qui n'est pas ici

**`REP-106` — « Détruire » efface onze tables en un clic, sans rien
demander.** Le constat ne vient pas d'une lecture : il vient de la commande
que cette story a écrite. `npm run audit:cascades` dit que détruire un
`Client` emporte ses visites, ses ventes, ses locations et **les quittances
de celles-ci**. Le bouton qui déclenche cela est un simple envoi de
formulaire, et `rg 'window.confirm|AlertDialog'` ne trouve **aucun**
dispositif de confirmation dans tout le produit.

Cette story a fait ce qu'elle pouvait sans sortir de son périmètre :
l'avertissement affiché nomme désormais ce qui tombe réellement. **Mais un
avertissement n'est pas un garde-fou.** → story **3.13**, ouverte pour
l'occasion.

⚠ **Non classé en défaut, délibérément** : aucune perte n'a été observée en
fonctionnement. L'inscrire en `BUG-nn` gonflerait le décompte des défauts
d'une affirmation non mesurée.

---

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m] — Claude Code, session du 17-08-2026.

### Debug Log References

- Mesure T1 : script Node ponctuel sur la base de développement, lecture
  seule, sans passer par le client étendu.
- Mutations : script dérivé de celui de la story 3.4, une mutation à la
  fois, `tsc` + `lint` avant chaque exécution, restauration systématique.
- M4 a dû être réécrite après le reformatage de `app/admin/agencies/page.tsx`
  en une ligne — reformatage imposé par l'invariant statique de la story
  3.3, qui compare une chaîne. La mutation a été **rejouée** sur la forme
  définitive plutôt que déclarée valable par analogie.

### Completion Notes List

1. **Le défaut disait cinq endroits ; il y en avait six, et le sixième
   dément son énoncé.** `BUG-24` décrivait un écart visible entre la liste
   et la fiche. La mesure a montré que la fiche se trompait aussi, et du
   même côté. Une concordance fausse ne se voit pas — c'est pire qu'un
   écart.

2. **La moitié du travail a consisté à ne PAS corriger.** Vingt-et-un
   `include` nomment `property`, `client` ou `owner` au singulier. Les
   filtrer aurait défait la story 3.9 et rendu anonymes les quittances d'un
   locataire supprimé. La règle retenue — *pluriel : on filtre ; singulier :
   jamais* — est écrite dans `lib/prisma.ts`, dans `CLAUDE.md` §2, et tenue
   par la mutation M6.

3. **`REP-99` n'appelait pas une phrase, il appelait un mécanisme.** La
   règle §2 était juste et n'a rien empêché le 15-08 : elle dépendait de la
   vigilance d'un lecteur. Elle est désormais une règle ESLint, qui vaut
   **quel que soit le client** — `prisma`, `db`, ou un client bricolé dans
   un script.

4. **Et il a fallu élargir `npm run lint` pour que cela serve.** `next lint`
   ne regarde que `app/`, `components/`, `lib/`, `src/`, `pages/`. Il
   ignorait `prisma/`, `scripts/` et `tests/` — **et l'accident de `REP-99`
   a eu lieu dans un script.** Mesuré avant d'élargir : 0 erreur et 0
   avertissement préexistants dans les trois dossiers, l'élargissement n'a
   rien coûté.

5. **La règle est désactivée sur `tests/**`, et c'est un arbitrage.**
   `tests/db.ts` est **volontairement** le client non filtré : huit cas s'en
   servent pour relire une ligne quel que soit son état. Le fichier de
   configuration étant du JSON, il ne porte pas de commentaire — le motif
   est écrit dans `tests/db.ts`, à l'endroit qu'il exempte.

6. **L'inventaire a contredit une phrase affichée, et elle a été
   corrigée.** La corbeille annonçait « photos, visites, historique ». Les
   onze cascades nomment aussi les ventes, les locations et les quittances.
   Publier la mesure et laisser la phrase aurait été exactement ce que §7
   reproche.

7. **Ce qui n'a pas été fait, et pourquoi.** Le bouton « Détruire » ne
   demande toujours aucune confirmation : c'est `REP-106` / story 3.13. Le
   produit n'a **aucun** dispositif de confirmation, nulle part — c'est une
   brique à créer, pas une ligne à ajouter, et elle dépasse une story qui
   parle de compteurs.

8. **`npm run audit:cascades` n'est pas dans la liste autorisée de
   `.claude/settings.json`.** Elle ne touche aucune base et ne démarre rien
   ; l'y ajouter reviendrait à modifier les permissions de l'éditeur, ce qui
   n'est pas à moi de décider. Signalé, non fait.

### Change Log

| Date | Changement |
|---|---|
| 17-08-2026 | Story ouverte, inventaire des cascades écrit et exécuté avant toute correction |
| 17-08-2026 | Cinq points de lecture filtrés, `findUnique` supprimé, règle ESLint posée, lint élargi |
| 17-08-2026 | Invariant de la story 3.3 resserré au lieu d'être supprimé |
| 17-08-2026 | `REP-99` soldé, `REP-106` ouvert, story 3.13 créée |

### File List

**Créés**
- `scripts/cascades-corbeille.mjs`
- `tests/corbeille-relations.spec.ts`
- `docs/stories/3-5-etendre-la-suppression-reversible.md`

**Modifiés**
- `app/agency/owners/page.tsx`
- `app/agency/owners/[id]/page.tsx`
- `app/api/export/[entity]/route.ts`
- `app/admin/agencies/page.tsx`
- `app/admin/statistics/page.tsx`
- `app/vitrine/[slug]/actions.ts`
- `app/agency/trash/page.tsx`
- `lib/prisma.ts`
- `prisma/seed.ts`
- `tests/db.ts`
- `tests/comptage.spec.ts`
- `.eslintrc.json`
- `package.json`
- `CLAUDE.md`
- `docs/qa/bug-report.md`
- `docs/epics.md`
- `docs/stories/deferred-work.md`
- `docs/stories/sprint-status.yaml`
