---
baseline_commit: 062576f
---

# Story 3.10 : Durcir la reprise d'un parent en corbeille

Status: done *(17-08-2026 — six mutations jouées séparément. `REP-03`,
`04`, `05`, `06`, `07` et `14` soldés, aucun constat ouvert. Aucune tâche
ne relève de l'éditeur.)*

**Épopée :** 3 — Fiabiliser les données et la tenue à la charge
**Couvre :** `REP-03`, `REP-04`, `REP-05`, `REP-06`, `REP-07`, `REP-14`
**Ouverte le :** 17-08-2026

---

## Story

As a **agent**,
I want **que la reprise d'un parent supprimé soit fiable dans tous les cas**,
So that **le correctif de la story 3.9 ne laisse pas de bord non traité.**

---

## Ce que la story 3.9 a laissé derrière elle

Elle a fermé `BUG-34` — un parent mis à la corbeille disparaissait de la
liste déroulante de ses enfants, le navigateur retombait sur la première
option, et « Enregistrer » sans rien changer réécrivait le lien métier.

Sa revue a laissé **six constats**. Ils ne se valent pas :

| | Ce qui reste ouvert | Nature |
|---|---|---|
| `REP-03` | Le parent restauré **entre les deux requêtes** n'est dans aucune des deux listes | correction incomplète |
| `REP-06` | Le parent en corbeille est mis **en tête**, ce qui casse l'ordre annoncé par `orderBy` | correction incomplète |
| `REP-07` | **Une requête de plus par affichage** — une à trois selon l'écran — même quand le parent est vivant | coût inutile |
| `REP-05` | `deletedAt` est **optionnel** dans le type : un futur écran qui l'oublie compile et n'étiquette rien | le défaut peut revenir |
| `REP-04` | Un `defaultValue` sans option correspondante reste **silencieux** pour toute autre cause que la corbeille | la famille du défaut reste ouverte |
| `REP-14` | Rien n'empêche de supprimer une **échéance déjà réglée** | voisin, hors corbeille |

**Les trois premiers se ferment d'un seul geste**, et c'est ce qui fait
cette story : ils ne sont pas trois défauts, ce sont trois symptômes d'un
même choix — avoir bâti la liste en **deux requêtes** puis recollé le
résultat en mémoire.

---

## Le geste : une seule requête, et c'est la base qui range

Aujourd'hui, chaque écran d'édition fait deux requêtes par parent :

```ts
prisma.property.findMany({ where: { agencyId }, orderBy: … })      // les vivants
prisma.property.findFirst({                                        // + l'archivé
  where: { id: visit.propertyId, agencyId, deletedAt: { not: null } },
})
const biens = avecParentEnCorbeille(properties, bienArchive)       // recollés en tête
```

Une seule suffit :

```ts
prisma.property.findMany({
  where: { agencyId, ...vivantsEtCourant(visit.propertyId) },
  orderBy: { createdAt: "desc" },
})
```

- `REP-03` — il n'y a plus **d'entre-deux** : une requête ne se restaure pas
  au milieu d'elle-même.
- `REP-06` — c'est **PostgreSQL** qui trie, avec l'`orderBy` déjà écrit. Le
  parent en corbeille reprend sa place, il ne squatte plus la première.
- `REP-07` — il n'y a plus de requête « en plus » : il y en a **une de
  moins** qu'avant sur chaque écran.

### Le piège mesuré dans `lib/prisma.ts` avant d'écrire la ligne

La forme naturelle ne marche pas :

```ts
where: { agencyId, OR: [{ deletedAt: null }, { id: courant }] }   // ❌
```

L'extension de `lib/prisma.ts` (`lib/prisma.ts:76`) teste
`if (!("deletedAt" in where))` sur le **premier niveau du `where`
uniquement**. Le `deletedAt` de la branche `OR` est imbriqué : la clef
n'est pas vue, `deletedAt: null` est donc ajouté **à côté** du `OR`, les
deux sont ET-és, et la branche qui devait ramener le parent en corbeille
ne ramène rien. **Le correctif serait vert à la compilation et faux à
l'exécution.**

D'où la clef nommée explicitement, avec la valeur `undefined` — qui
n'ajoute aucune condition côté Prisma mais rend la clef **présente** pour
l'opérateur `in` :

```ts
deletedAt: undefined,
OR: [{ deletedAt: null }, { id: courant }]
```

C'est l'idiome que la story 3.9 avait déjà posé dans les Server Actions
(`deletedAt: lienInchange(…) ? undefined : null`). Il est désormais **écrit
une seule fois**, dans `vivantsEtCourant()`.

---

## `REP-04` — fermer la famille, pas seulement la cause

La story 3.9 a fermé **une** cause de « `defaultValue` ne correspond à
aucune option » : la corbeille. Les autres restent — identifiant appartenant
à une autre agence, dérive de données — et elles produisent le même
symptôme, qui est le vrai défaut : **le navigateur choisit à la place de
l'utilisateur, et personne ne le voit.**

Le remède tient dans l'endroit où la liste est construite, pour qu'aucun
écran ne puisse l'oublier : si la valeur courante ne correspond à aucune
ligne, `optionsParent()` **fabrique quand même son option**, étiquetée
`— référence introuvable`.

Ce que cela change, selon le champ :

| | Avant | Après |
|---|---|---|
| Lien **obligatoire** (visite, vente, bail) | repli sur la première option, enregistrement **réussi** avec le mauvais parent | l'anomalie est affichée, l'enregistrement est **refusé** |
| Lien **facultatif** (paiement, bien) | repli sur « Aucun », lien **effacé** en silence | idem — l'anomalie est affichée, l'enregistrement est **refusé** |

§8 — **ce que je viens de rendre atteignable** : un écran dont un lien
pointe hors de l'agence devient impossible à enregistrer tant qu'on ne
corrige pas ce champ. C'est voulu, et c'est le moindre mal : l'autre issue
est de réécrire ou d'effacer un lien métier sans le dire. La situation
elle-même ne devrait pas exister — la purge de la corbeille détache
(`SetNull`) au lieu de laisser un identifiant pendant, `npm run
audit:cascades` le dit — donc ce chemin garde une anomalie, il n'en crée
pas.

---

## `REP-05` — rendre l'oubli impossible, pas improbable

`libelleOption(nom, ligne: { deletedAt?: Date | null })` : le champ est
**optionnel**. Un futur écran qui oublie `deletedAt: true` dans son `select`
compile, n'étiquette rien, et `BUG-34` revient à moitié — le parent est
proposé sans que rien ne dise qu'il est supprimé.

Le type devient **requis**. L'oubli passe alors de « personne ne le voit »
à « `npx tsc --noEmit` refuse ». C'est le même mouvement que la story 3.5
a fait pour `§2` avec ESLint : une règle tenue par un outil, pas par une
phrase.

---

## `REP-14` — une échéance réglée ne se supprime pas

`app/agency/rental-management/[id]/edit/page.tsx` — `deleteRecord()` ne lit
ni `isPaid`, ni `paymentDate`, ni `amountToOwner`. Le rôle est la **seule**
condition vérifiée.

La docstring de cette action nomme pourtant déjà le scénario, comme motif
du contrôle de rôle : *« l'erreur ne se voit qu'au moment du versement,
c'est-à-dire chez le propriétaire »*. Et la contrainte
`@@unique([rentalId, month, year])` redevenant libre, **une nouvelle ligne
peut être créée pour la même période, sans aucun lien avec la disparue** :
la trace du versement effectué n'existe plus nulle part.

**Arbitrage rendu ici, par la délégation du 17-08-2026** — *« je te laisse
trancher »* : **refuser**, avec un message qui dit pourquoi.

Le motif, parce qu'il ne se devine pas dans six mois : une échéance non
réglée est une prévision, on peut la jeter ; une échéance réglée est la
trace d'un versement au propriétaire, et rien d'autre ne la porte. La
troisième issue — permettre la suppression derrière une confirmation — n'est
pas écartée sur le fond : elle appartient à la **story 3.13** (`REP-106`),
qui pose le dispositif de confirmation pour tout le produit. Une
confirmation posée ici seulement serait un dixième dialogue à réinventer.

---

## Acceptance Criteria

**Given** une liste déroulante d'écran d'édition dont le parent courant est
en corbeille
**When** l'écran est rendu
**Then** la liste est bâtie par **une seule requête** par parent
**And** le parent en corbeille y figure, étiqueté, **à la place que lui
donne l'`orderBy` de la requête** et non en tête

**Given** les cinq écrans d'édition et leurs dix couples écran → champ
**When** la story est terminée
**Then** aucun ne fait de requête supplémentaire pour retrouver un parent
archivé, y compris quand le parent est vivant

**Given** un `select` dont la valeur courante ne correspond à **aucune**
ligne lisible — autre agence, dérive de données
**When** l'écran est rendu
**Then** l'option est fabriquée et porte « référence introuvable »
**And** enregistrer sans rien changer est **refusé**, et le lien en base
reste inchangé

**Given** un futur écran qui oublierait `deletedAt: true` dans son `select`
**When** on compile
**Then** `npx tsc --noEmit` refuse

**Given** une échéance de gestion locative déjà réglée (`isPaid`)
**When** un administrateur demande sa suppression
**Then** elle est refusée avec un message qui en donne le motif
**And** une échéance **non réglée** reste supprimable par le même chemin

**Given** l'invariant de la story 3.9 — « enregistrer sans rien changer ne
change rien »
**When** la story est terminée
**Then** il tient toujours, sur les dix couples
**And** un changement de parent **voulu** fonctionne toujours

---

## Tasks / Subtasks

- [x] T1 — `lib/corbeille.ts` : `vivantsEtCourant()`, `optionsParent()`,
      `deletedAt` requis ; `avecParentEnCorbeille()` et `libelleOption()`
      retirés, devenus morts
- [x] T2 — les cinq écrans d'édition : une requête par parent, options
      bâties par `optionsParent()` — dix couples écran → champ
- [x] T3 — `rental-management` : refuser la suppression d'une échéance
      réglée
- [x] T4 — tests : ordre de la liste, référence introuvable, échéance
      réglée + son contrôle positif, invariant de source pour `REP-07`
- [x] T5 — six mutations, jouées séparément, chaque message d'échec lu
- [x] T6 — `tsc` 0 · `lint` 0 · `test:e2e` **180 passed**
- [x] T7 — registre : `REP-03` à `07` et `14` soldés ; `docs/` à jour

---

## Dev Notes

- **Le cloisonnement ne bouge pas.** `agencyId` reste dans le `where` de
  chaque liste ; `vivantsEtCourant()` ne fournit que le fragment
  `deletedAt`/`OR` et ne touche jamais à l'agence. La branche
  `{ id: courant }` est ET-ée avec `agencyId` : elle ne peut pas ramener la
  ligne d'une autre agence.
- **Les relations au singulier ne se filtrent toujours pas** — arbitrage de
  la story 3.9, rappelé dans `lib/prisma.ts`.
- **`lienInchange()` ne change pas.** C'est lui qui rend l'enregistrement
  possible quand le parent est en corbeille ; y toucher rejouerait le
  blocage relevé par la revue du 12-08-2026.

---

## Preuves — les six mutations

Jouées **séparément**, chacune rétablie avant la suivante. Le message
d'échec a été lu à chaque fois : il doit désigner la propriété visée, pas
une assertion voisine.

| # | Ce qu'on casse | Résultat | Message lu |
|---|---|---|---|
| **M1** | `optionsParent()` remet le parent en corbeille **en tête** (le geste de la 3.9) | ROUGE | *« le bien en corbeille est toujours placé en tête : l'ordre annoncé par `orderBy` est faux »* |
| **M2** | l'option fabriquée de `REP-04` ne l'est plus | ROUGE | *« le formulaire est retombé sur un autre bien : c'est le défaut de BUG-34, avec une autre cause »* |
| **M3** | la garde `isPaid` de `REP-14` est retirée | ROUGE | *« l'échéance réglée a été détruite : la trace du versement au propriétaire n'existe plus nulle part »* |
| **M4** | on réintroduit `deletedAt: { not: null }` dans un écran | ROUGE | *« relit encore le parent archivé par une seconde requête : c'est REP-07, et avec lui REP-03 »* |
| **M5** | `deletedAt: true` retiré d'un `select` | `tsc` REFUSE | `error TS2345: Property 'deletedAt' is missing … but required in type 'Ligne'` |
| **M6** | la clef `deletedAt: undefined` de `vivantsEtCourant()` | ROUGE | *« le parent en corbeille n'est pas signalé comme tel »* |

**M6 est celle qui compte**, et c'est elle qui vérifie la mesure faite sur
`lib/prisma.ts` : sans cette clef, l'extension injecte son filtre à côté du
`OR` et le parent en corbeille disparaît. Ce que le message d'échec révèle
est instructif : la valeur du formulaire reste **juste**, parce que le filet
de `REP-04` fabrique l'option — c'est l'**étiquette** qui trahit la
régression, « référence introuvable » au lieu de « en corbeille ». Les deux
correctifs se recouvrent en partie, et seule l'assertion d'étiquette les
distingue.

> ⚠ **La première version de M2 ne compilait pas** — elle laissait `courant`
> et `LIBELLE_INTROUVABLE` inutilisés, le lint échouait, donc le build, donc
> la suite : `Process from config.webServer was not able to start`. **Une
> mutation qui ne compile pas ne prouve rien** (§6, piège 3) : le rouge ne
> venait pas du test. Réécrite sous une forme compilable, puis rejouée.

**Contrôles positifs**, exigés et présents :

- l'ordre — la deuxième assertion vérifie que le parent en corbeille est
  **toujours proposé** ; sans elle, une liste où il aurait purement disparu
  passerait la première ;
- la référence illisible — après le refus, on **corrige** le rattachement
  sur le même écran et l'enregistrement aboutit ;
- l'échéance — la même suppression, par le **même bouton**, sur une échéance
  en attente, aboutit.

---

## Ce que ce travail ne prouve pas

- **Le nombre de requêtes n'est pas mesuré à l'exécution.** Un test de
  navigateur ne compte pas ce qu'un Server Component adresse à PostgreSQL,
  et un test de durée serait instable. L'invariant est gardé sur la **forme
  de la source**, comme `tests/comptage.spec.ts` le fait pour le `_count`.
  Le décompte — une requête de moins par parent, trois sur l'écran des
  paiements — est établi **par lecture du code**, et c'est écrit ainsi.
- **La fenêtre de `REP-03` n'a pas été reproduite.** Restaurer un parent
  exactement entre deux requêtes demanderait de piloter l'ordonnancement du
  serveur. Ce qui est prouvé est plus fort et plus simple : **il n'y a plus
  deux requêtes**.

---

## Dev Agent Record

### Debug Log

- `npx tsc --noEmit` → 0 erreur
- `npm run lint` → 0 erreur (4 avertissements `<img>` préexistants, story 3.7)
- `npm run test:e2e` → **180 passed** (176 avant : +1 invariant de source,
  +3 tests de navigateur)

### Completion Notes

- **Aucun constat reporté ouvert.** Décomptes recalculés et **inchangés** —
  7 épopées, 62 stories dans les deux sources, 38 défauts. Deuxième story de
  suite à n'ouvrir ni story ni défaut.
- `avecParentEnCorbeille()` et `libelleOption()` ont été **retirés** : la
  requête unique rend le premier inutile, et le second est absorbé par
  `optionsParent()`. Pas de code mort (§11).
- **`lienInchange()` n'a pas été touché.** C'est lui qui rend l'écran
  enregistrable quand le parent est en corbeille ; y toucher rejouerait le
  blocage relevé par la revue du 12-08-2026. Son commentaire gagne une
  précision : il rend le `deletedAt` facultatif, **jamais** l'`agencyId` —
  c'est ce qui fait qu'une « référence introuvable » reste refusée.
- **Le cloisonnement n'a pas bougé** : `agencyId` reste écrit par chaque
  appelant, et la branche `{ id: courant }` lui est ET-ée.

---

## Change Log

| Date | Version | Description |
|---|---|---|
| 17-08-2026 | 0.1 | Ouverture de la story |
| 17-08-2026 | 1.0 | Six constats soldés, cinq mutations, story `done` |

---

## File List

**Modifiés**

- `lib/corbeille.ts`
- `app/agency/visits/[id]/edit/page.tsx`
- `app/agency/sales/[id]/edit/page.tsx`
- `app/agency/rentals/[id]/edit/page.tsx`
- `app/agency/payments/[id]/edit/page.tsx`
- `app/agency/properties/[id]/edit/page.tsx`
- `app/agency/rental-management/[id]/edit/page.tsx`
- `tests/corbeille.spec.ts`
- `docs/stories/deferred-work.md`
- `docs/stories/sprint-status.yaml`
- `docs/epics.md`
- `docs/architecture.md` — §4 nommait `avecParentEnCorbeille()`, qui
  n'existe plus ; le passage dit maintenant la requête unique et le filet
  de `REP-04`
- `docs/qa/bug-report.md` — le paragraphe de `BUG-34` décrivait *deux*
  requêtes et écartait le `OR` comme « illisible » ; corrigé sur place,
  avec la date, plutôt que réécrit
- `docs/qa/inventaire-ecrans.md` — quatre mentions du helper renommé

**Créé**

- `docs/stories/3-10-durcir-la-reprise-d-un-parent-en-corbeille.md`
