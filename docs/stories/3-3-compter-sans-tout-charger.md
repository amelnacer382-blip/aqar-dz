---
baseline_commit: 8516570
---

# Story 3.3 : Compter sans tout charger

Status: done *(17-08-2026 — une page, trois mutations jouées séparément.
`BUG-07` corrigé. Aucune tâche ne relève de l'éditeur.)*

**Épopée :** 3 — Fiabiliser les données et la tenue à la charge
**Couvre :** `BUG-07` (n° audit 13, NFR-05)
**Ouverte le :** 17-08-2026

---

## Story

As a **super admin**,
I want **que la liste des agences reste rapide quand la plateforme grandit**,
So that **le succès commercial ne dégrade pas ma console.**

---

## Ce que le défaut dit, et ce que la mesure ajoute

`app/admin/agencies/page.tsx` charge **toutes** les lignes `users` et
`properties` de **toutes** les agences :

```ts
const agencies = await prisma.agency.findMany({
  orderBy: { createdAt: "desc" },
  include: { users: true, properties: true },
})
```

…pour n'en afficher que deux nombres :

```tsx
<TableCell>{agency.users.length}</TableCell>
<TableCell>{agency.properties.length}</TableCell>
```

### La mesure, 17-08-2026 — base de développement

D'abord sur les données telles qu'elles sont : **67 agences, 160 comptes,
6 biens**.

```
include complet :  98 075 octets, 34 ms
_count          :  33 621 octets,  6 ms
```

Le côté « biens » n'est presque pas exercé à cette échelle. Le décor a donc
été construit pour l'exercer — **une** agence de **500 biens**, décrite
comme une vraie fiche (description, prix, surface, adresse), puis effacée :

```
include complet : 624 944 octets, 23 ms
_count          :  34 112 octets,  4 ms
rapport         : 18,3 × le volume, 5,8 × le temps
```

Soit **≈ 1,18 Ko par bien**, et ce coût est payé **à chaque affichage de la
console**, par une page qui n'affiche que deux entiers.

> **Le scénario de l'AC-2 — 50 agences de 2 000 biens — n'a pas été monté.**
> Extrapolé au coût par ligne mesuré ci-dessus, il représente ≈ **118 Mo**
> transférés et hydratés par affichage. C'est un calcul, pas une mesure, et
> c'est écrit comme tel (§7).

### §8 — le nombre affiché change-t-il ?

C'est la seule question qui pouvait faire mal, et elle a été posée **avant**
d'écrire une ligne. `Property` est à suppression réversible : si `_count` et
`.length` ne comptaient pas la même chose, la correction changerait
silencieusement un chiffre lu par l'éditeur.

Le filtre `deletedAt: null` de `lib/prisma.ts` s'applique **au premier
niveau seulement** : il regarde le modèle de l'opération — ici `Agency`, qui
n'est pas à corbeille — et le `where` racine. **Ni `include`, ni `_count`**
ne sont couverts. Les deux comptent donc pareil, biens en corbeille inclus.

Vérifié plutôt que déduit, sur les 67 agences puis sur celle de 500 biens :

```
agences dont le nombre affiché CHANGERAIT : 0
nombre affiché : .length=500  _count=500  -> IDENTIQUE
```

> **Ce que cette story ne corrige pas, et qui a déjà un propriétaire.** Un
> bien mis à la corbeille **reste compté** dans cette colonne — avant comme
> après. C'est `BUG-24` (« la suppression réversible ignore les relations
> imbriquées »), porté par la **story 3.5**. Le corriger ici mêlerait deux
> sujets et rendrait la mesure de celui-ci illisible.

### Le balayage : une seule page, et c'est vérifié

```bash
grep -rn "include: {" -A 5 --include=*.tsx --include=*.ts app | grep ": true," | grep -v "_count\|select"
```

Les autres résultats sont des relations **vers-un** (`owner`, `client`,
`property`, `agency`) chargées pour être affichées — un PDF de contrat a
besoin du client entier. `app/admin/agencies/page.tsx` est le seul écran qui
charge une relation **vers-plusieurs** pour n'en prendre que la longueur.

La page voisine `app/admin/statistics/page.tsx:51` fait déjà la bonne chose.
Il s'agit d'aligner l'une sur l'autre, pas d'inventer un motif.

---

## Acceptance Criteria

### AC-1 — La page compte au lieu de charger

**Given** la page charge aujourd'hui toutes les lignes `users` et
`properties` pour n'afficher que leurs longueurs
**When** la correction est appliquée
**Then** elle utilise `_count`, comme le fait déjà
`app/admin/statistics/page.tsx:51`

### AC-2 — Le volume ne dépend plus du nombre de biens

**Given** une agence de 500 biens
**When** la console est affichée
**Then** le volume transféré ne croît plus avec ce nombre — mesuré, et la
mesure écrite dans cette story

### AC-3 — Les deux nombres affichés restent justes

**Given** une agence portant un nombre de comptes **différent** de son
nombre de biens
**When** la console est affichée
**Then** chaque colonne montre le sien

*Le nombre doit différer : avec deux nombres égaux, une colonne branchée sur
l'autre resterait verte.*

### AC-4 — Prouvé par mutation

**Given** la correction retirée, et les colonnes croisées
**When** la suite est rejouée
**Then** exactement le cas visé rougit, et son message dit lequel des deux
nombres est faux

---

## Tasks / Subtasks

- [x] **T1** — Mesurer avant de coder : volume et temps des deux formes,
      et l'écart de comptage éventuel (AC-2, §8)
- [x] **T2** — Remplacer l'`include` par `_count` (AC-1)
- [x] **T3** — Test fonctionnel : deux nombres différents, chacun dans sa
      colonne (AC-3)
- [x] **T4** — Test d'invariant : la forme de la requête ne se redéfait
      pas par inadvertance (AC-1)
- [x] **T5** — Mutations, jouées séparément (AC-4)
- [x] **T6** — `npx tsc --noEmit`, `npm run lint`, `npm run test:e2e`
- [x] **T7** — Registre, `sprint-status.yaml`, `epics.md`

---

## Dev Notes

### Pourquoi un test d'invariant, et ce qu'il ne prouve pas

Le coût de ce défaut est **serveur** : base → Node. Il ne traverse pas le
réseau vers le navigateur — les données d'un Server Component qui ne sont
passées à aucun composant client ne sont pas sérialisées dans la charge
utile. Un test Playwright ne peut donc pas le voir, et un test de **durée**
serait instable.

L'invariant est par conséquent gardé sur la **forme de la requête**, comme
`tests/deploiement.spec.ts` garde celle du `Dockerfile`. Il faut dire ce
qu'il vaut : il prouve que la page n'a pas repris l'`include` complet, **pas**
que le volume est faible. C'est la mesure de cette story qui dit le volume,
et elle n'est pas rejouée à chaque exécution.

### References

- `docs/qa/bug-report.md` — `BUG-07`, et `BUG-24` pour ce qui n'est pas ici
- `app/admin/statistics/page.tsx:50-52` — le motif déjà en place
- `lib/prisma.ts` — le filtre de corbeille, et sa portée réelle
- `CLAUDE.md` §7 (mesurer, ne pas déduire), §8 (déplacer avant de fermer)

---

## Preuves — 17-08-2026

### T5 — trois mutations, jouées séparément

`tsc` et `lint` verts avant chacune : une mutation qui casse le build
donnerait un rouge qui ne vient pas du test (§6, piège 3).

| Mutation | Rouges | Le cas, et son message |
|---|:---:|---|
| **M1** — les deux colonnes croisées | **1** | test fonctionnel : *« la colonne « Utilisateurs » ne montre pas les 2 comptes de l'agence »* |
| **M2** — `BUG-07` remis entièrement en place | **1** | invariant : *« ne compte plus avec `_count` »* |
| **M3** — l'`include` complet rajouté **à côté** du `_count` | **1** | invariant : *« recharge des relations entières — c'est BUG-07 qui revient »* |

**M3 est la mutation qui justifie le test d'invariant.** C'est la
régression réaliste : quelqu'un rajoute l'`include` sans retirer le
`_count`. Les deux nombres restent justes, la console reste correcte à
l'œil, et le coût revient entier. **Le test fonctionnel reste vert.** Seul
l'invariant la voit.

M1 ne rougit que parce que le décor porte **2** comptes et **3** biens.
Avec deux nombres égaux, une colonne branchée sur l'autre serait passée.

### T6 — les contrôles

```
npx tsc --noEmit     0 erreur
npm run lint         0 erreur   (4 avertissements <img> préexistants)
npm run test:e2e     164 passed   (162 avant, + les 2 de cette story)
```

---

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m]

### Debug Log References

Aucun échec de mise au point : la correction est de six lignes, et les deux
tests sont passés au premier jet. Ce qui a pris du temps est **la mesure
préalable** — monter puis effacer une agence de 500 biens pour que le côté
« biens » soit réellement exercé, la base de développement n'en portant que
six.

### Completion Notes List

1. **Le chiffre de l'audit n'était pas mesurable tel quel.** La base de
   développement porte 6 biens : l'`include` fautif n'y coûte presque
   rien. Publier « 98 Ko contre 33 Ko » aurait donné une story vraie et
   sans intérêt. Le décor a été monté pour exercer le défaut, mesuré, puis
   effacé — et le nettoyage vérifié (*0 bien restant*).
2. **La seule question dangereuse était §8, et elle portait sur un
   nombre.** `Property` est à corbeille : si `_count` et `.length` ne
   comptaient pas pareil, la correction changerait silencieusement un
   chiffre lu par l'éditeur. La réponse — le filtre de `lib/prisma.ts` ne
   couvre que le premier niveau, donc aucun des deux — a été **vérifiée**
   sur les 67 agences puis sur le décor, pas déduite de la lecture du
   client étendu.
3. **Ce que la story ne corrige pas est nommé.** Un bien en corbeille reste
   compté, avant comme après : c'est `BUG-24`, story 3.5. Le corriger ici
   aurait mêlé deux sujets et rendu la mesure de celui-ci illisible.
4. **Le balayage a été lancé, et il a répondu « une seule page ».** Les
   autres `include` de l'application chargent des relations **vers-un**
   pour les afficher — un PDF de contrat a besoin du client entier. Après
   la story 3.2, où le même réflexe avait multiplié le périmètre par sept,
   il fallait le vérifier plutôt que le supposer dans un sens comme dans
   l'autre.
5. **Le test d'invariant est écrit avec ses limites.** Il garde la forme de
   la requête, pas le volume — le coût de `BUG-07` est serveur et
   n'atteint jamais le navigateur. Le dire dans le fichier de test évite
   qu'on lui prête un jour une preuve qu'il ne porte pas.

### Change Log

| Date | Version | Description |
|---|---|---|
| 17-08-2026 | 1.0 | Story ouverte, mesures faites avant d'écrire |
| 17-08-2026 | 1.1 | Livrée — trois mutations, 164 passed |

### File List

**Modifiés**

- `app/admin/agencies/page.tsx` — `_count` au lieu de l'`include` complet,
  et les deux cellules qui le lisent
- `docs/qa/bug-report.md` — `BUG-07` corrigé, avec ses mesures
- `docs/epics.md` — note de livraison sur la story 3.3
- `docs/stories/sprint-status.yaml` — story `done`

**Créés**

- `tests/comptage.spec.ts` — un test fonctionnel, un test d'invariant
- `docs/stories/3-3-compter-sans-tout-charger.md` — ce fichier
