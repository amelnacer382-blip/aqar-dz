---
baseline_commit: 905b624
---

# Story 3.4 : Paginer la vitrine publique

Status: done *(17-08-2026 — cinq mutations jouées séparément. `BUG-08`
corrigé, `REP-105` ouvert et rattaché à la story 3.12. Aucune tâche ne
relève de l'éditeur.)*

**Épopée :** 3 — Fiabiliser les données et la tenue à la charge
**Couvre :** `BUG-08` (n° audit 14, NFR-05)
**Ouverte le :** 17-08-2026

---

## Story

As a **visiteur**,
I want **que la vitrine d'une grande agence s'ouvre vite**,
So that **je ne quitte pas la page avant de l'avoir vue.**

---

## Ce que le défaut dit, et ce que la mesure ajoute

Les onze listes de l'espace agence passent par `readPageParams()` et sont
bornées à 100 lignes. La **seule page publique** du logiciel — celle qui
sert d'argument commercial et que les moteurs indexent — ne l'est pas :
`findMany` sans `take`.

### La mesure, 17-08-2026 — 300 biens publiés, avec photo et description

Contrairement à la story 3.3, **ce coût-ci traverse le réseau** : les
fiches sont rendues dans le HTML servi. Il se mesure donc de bout en bout,
sur l'application servie, sans authentification.

```
/vitrine/{slug}         200 — 2 302 954 octets, 399 ms
/vitrine/{slug}?page=2  200 — 2 302 986 octets, 215 ms
```

Deux choses s'y lisent :

1. **≈ 7,7 Ko par bien, servis à chaque visite** — et à chaque passage de
   robot. À mille biens publiés, le scénario de l'audit, cela fait ≈ 7,7 Mo
   par vue. *(Extrapolation du coût par ligne mesuré, pas une mesure.)*
2. **`?page=2` rend exactement la même page.** Le paramètre n'existe pas :
   il n'y a aucune pagination à réparer, il y en a une à poser.

---

## §8 — ce que paginer rend atteignable

C'est la partie qui décide de la correction. Paginer une liste est trivial ;
paginer **celle-ci** touche trois choses qui n'ont rien à voir avec la
lenteur.

### 1. Le grand nombre du bandeau — le piège principal

L'en-tête de la vitrine affiche, en très gros :

```tsx
{properties.length}  bien{s} disponible{s}
```

C'est **l'argument commercial** de l'agence. Branché sur une liste
paginée, il annoncerait **25** à toutes les agences du produit, quelle que
soit leur taille — une régression bien plus grave que le défaut corrigé.

Il passe donc par un `count()` portant **le même `where`** que la liste,
ce qui préserve exactement la sémantique actuelle : le nombre suit les
filtres, comme aujourd'hui.

### 2. Une page au-delà de la dernière

`?page=99` n'existait pas ; il existe maintenant, et il rend une liste
vide alors que l'agence a des biens. Sans traitement, le visiteur voit une
grille vide sans un mot. Le carton « aucun bien » est donc rendu dès que la
page est vide, avec **deux messages distincts** — « aucun résultat » n'est
pas « cette page n'existe pas ».

### 3. Le titre, et les moteurs

Toutes les pages partageaient un seul titre. Avec `?page=2`, `?page=3`…
c'est du contenu dupliqué annoncé sous un titre identique. Le numéro de
page entre dans le titre — quatre lignes, et c'est directement ce que
l'AC-2 demande d'un robot d'indexation.

### Ce qui ne change pas

**Le plan du site n'est pas touché**, et l'AC-2 l'exige : `app/sitemap.ts`
liste tous les biens par sa propre requête, indépendante de cet écran.
Vérifié plutôt que supposé.

La seconde requête de la page — les wilayas distinctes du sélecteur —
reste sans `take`. Elle est bornée par la géographie : 58 wilayas.

---

## Ce que le balayage a trouvé en plus, et qui n'est pas ici

`app/sitemap.ts` charge **tous** les biens publics de **toutes** les
agences, sans borne. Le scénario que l'AC-2 de cette story nomme —
*50 agences de 2 000 biens* — produit 100 001 URL, soit **le double de la
limite de 50 000** que les moteurs appliquent à un fichier de plan.

Ce n'est pas cette story : la corriger demande un **index de plans**
(`sitemap.xml` renvoyant vers `sitemap/0.xml`, `sitemap/1.xml`…), c'est-à-dire
une autre forme de fichier, et l'AC-2 exige au contraire que le plan
continue de tout lister. → **`REP-105`**, porté par la **story 3.12**.

---

## Acceptance Criteria

### AC-1 — La vitrine applique le contrat commun

**Given** les onze listes de l'espace agence sont bornées par
`readPageParams()`
**When** la vitrine est corrigée
**Then** elle applique le même contrat, avec le composant `<Pagination />`
déjà écrit

### AC-2 — Chaque page reste bornée, et le plan liste tout

**Given** une agence de mille biens publiés
**When** un robot parcourt la vitrine
**Then** chaque page reste de taille bornée
**And** le plan du site continue de lister tous les biens

### AC-3 — Le nombre annoncé reste celui de l'agence

**Given** une agence de 60 biens publiés
**When** la première page s'affiche
**Then** le bandeau annonce **60**, pas 25
**And** la grille en montre 25

### AC-4 — Les filtres survivent au changement de page

**Given** une recherche filtrée qui rend plus d'une page
**When** on suit le lien « Suivant »
**Then** le filtre est toujours appliqué, et les biens ne sont pas les
mêmes qu'en page 1

### AC-5 — Prouvé par mutation

**Given** la borne retirée
**When** la suite est rejouée
**Then** exactement le cas visé rougit, et son message dit ce qui est faux

---

## Tasks / Subtasks

- [x] **T1** — Mesurer le poids servi avant de coder (AC-2)
- [x] **T2** — Borner la liste, brancher le bandeau sur un `count()`
      (AC-1, AC-3)
- [x] **T3** — Poser `<Pagination />` en conservant les filtres (AC-1,
      AC-4)
- [x] **T4** — Traiter la page hors bornes et le titre par page (§8)
- [x] **T5** — Tests : 60 biens, bandeau, découpage, filtres conservés,
      poids servi (AC-2, AC-3, AC-4)
- [x] **T6** — Mutations, jouées séparément (AC-5)
- [x] **T7** — `npx tsc --noEmit`, `npm run lint`, `npm run test:e2e`
- [x] **T8** — `REP-105` et la story 3.12 pour le plan du site
- [x] **T9** — Registre, `sprint-status.yaml`, `epics.md`

---

## Dev Notes

### Ce test-ci peut mesurer, et il doit le faire

La story 3.3 gardait la forme d'une requête faute de pouvoir observer son
coût : il ne quittait pas le serveur. Ici c'est l'inverse — le poids servi
est **la** grandeur du défaut, et un test peut le lire par
`page.request.get()`. Il n'y a donc aucune raison de se contenter d'un
invariant statique.

Le seuil est posé **largement au-dessus** de ce qu'une page de 25 biens
pèse et **largement en dessous** de ce que pèsent 60 biens : c'est un test
de tenue à la charge, pas de mise en page.

### References

- `docs/qa/bug-report.md` — `BUG-08`
- `lib/list-params.ts` — le contrat commun, `DEFAULT_PER_PAGE = 25`
- `components/Pagination.tsx` — conserve déjà les filtres (`params`)
- `app/sitemap.ts` — indépendant de cet écran, et `REP-105`
- `CLAUDE.md` §7 (mesurer), §8 (déplacer avant de fermer)

---

## Preuves — 17-08-2026

### T1 — la mesure, avant et après, par la même sonde

Une sonde temporaire (`page.request.get`, 300 biens publiés) a été lancée
sur le code **avant** puis **après** correction, puis supprimée du dépôt :

```
avant : /vitrine/{slug}         2 302 954 octets, 399 ms
        /vitrine/{slug}?page=2  2 302 986 octets, 215 ms
après : /vitrine/{slug}           222 231 octets, 210 ms
        /vitrine/{slug}?page=2    222 570 octets,  51 ms
```

**10,4 ×** moins de volume. Et la deuxième ligne de chaque bloc dit le
reste : avant, `?page=2` rendait la page 1 à l'octet près ; après, c'est
une autre page.

### T6 — cinq mutations, jouées séparément

| Mutation | Rouges | Le cas, et son message |
|---|:---:|---|
| **M1** — `take` retiré | **2** | *« la vitrine sert 60 biens d'un coup : la page n'est pas bornée »* |
| **M2** — décalage neutralisé | **2** | *« la page 2 montre les mêmes biens que la page 1 : le décalage n'est pas appliqué »* |
| **M3** — bandeau recompté sur la page courante | **2** | *« le bandeau n'annonce plus les 60 biens de l'agence »* |
| **M4** — filtres non transmis à `<Pagination />` | **1** | *« changer de page a PERDU le filtre »* |
| **M5** — page hors bornes remise à « aucun résultat » | **1** | *« une page hors bornes ne dit pas au visiteur ce qui se passe »* |

### M2 a d'abord été refusée par le harnais — §6, piège 3

Écrite en retirant la ligne `skip,`, elle rendait `skip` inutilisé : lint
en erreur, build en échec, et un rouge qui n'aurait pas été celui du test.
Rejouée en **neutralisant** le décalage (`Math.min(skip, 0)`), le symbole
restant consommé.

C'est la troisième fois de cette session qu'une mutation bute là-dessus.
Le motif est stable : **desserrer plutôt que retirer**.

### T7 — les contrôles

```
npx tsc --noEmit     0 erreur
npm run lint         0 erreur   (4 avertissements <img> préexistants)
npm run test:e2e     168 passed   (164 avant, + les 4 de cette story)
```

---

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m]

### Debug Log References

- Le premier jet du cas « titre » comparait la fin de la chaîne : le
  gabarit racine ajoute « · Aqar DZ » à tous les titres, et le cas
  rougissait pour une raison sans rapport avec la pagination. Les motifs ne
  s'ancrent plus sur la fin.

### Completion Notes List

1. **Le défaut n'était pas une pagination cassée : il n'y en avait
   aucune.** La mesure l'a montré en une ligne — `?page=2` rendait la
   page 1 à l'octet près. C'est le genre de fait qu'une lecture de code
   suggère et qu'une mesure établit.
2. **Le vrai risque de cette story était un nombre, pas une requête.** Le
   bandeau « N biens disponibles » est l'argument commercial de l'agence.
   Branché sur la liste paginée, il aurait annoncé 25 partout — une
   régression plus grave que la lenteur corrigée, et parfaitement
   silencieuse. Le `count()` porte le **même `where`**, ce qui préserve la
   sémantique exacte : le nombre suit les filtres, comme avant.
3. **Deux cas sont nés de la correction, et ils sont traités** — c'est
   §8 appliqué pendant, pas après. `?page=99` n'existait pas et rend
   maintenant une liste vide : dire « aucun bien ne correspond » serait
   faux et ferait repartir le visiteur. Et les pages 2, 3… partageaient un
   titre unique, ce qui n'est pas tenable sur le seul écran indexé du
   produit.
4. **Contrairement à la story 3.3, ce test-ci mesure.** Le coût de
   `BUG-07` ne quittait pas le serveur, d'où un invariant statique. Ici le
   poids servi *est* la grandeur du défaut : le seuil est posé entre
   ≈ 220 Ko (une page de 25) et ≈ 490 Ko (les 60 biens sans borne), donc
   insensible à une refonte graphique et sensible à la disparition de la
   borne.
5. **Aucune connexion dans ce fichier de test, et c'est fidèle** : la
   vitrine est la seule page publique du logiciel. Un robot la parcourt
   dans ces conditions exactement.
6. **Le balayage a trouvé ce que la story ne pouvait pas corriger.** Le
   plan du site ne tient pas le scénario que l'AC-2 de cette même story
   nomme — 100 001 URL pour une limite de 50 000. Le corriger demande une
   autre **forme** de fichier, et l'AC-2 exige justement que le plan
   continue de tout lister. → `REP-105`, story 3.12, ouverte dans
   `docs/epics.md` pour l'occasion. **Le constat n'est pas mesuré**, et
   c'est écrit partout où il apparaît.

### Change Log

| Date | Version | Description |
|---|---|---|
| 17-08-2026 | 1.0 | Story ouverte, poids servi mesuré avant d'écrire |
| 17-08-2026 | 1.1 | Livrée — cinq mutations, 168 passed ; `REP-105` ouvert |

### File List

**Modifiés**

- `app/vitrine/[slug]/page.tsx` — borne et décalage, bandeau sur `count()`,
  `<Pagination />`, page hors bornes, numéro de page dans le titre
- `docs/qa/bug-report.md` — `BUG-08` corrigé, avec ses mesures
- `docs/epics.md` — note de livraison sur la 3.4, **story 3.12 ouverte**
- `docs/stories/deferred-work.md` — `REP-105` et son entrée d'index
- `docs/stories/sprint-status.yaml` — story `done`, `3-12` ajoutée,
  décomptes recalculés (61 stories, 38 défauts)

**Créés**

- `tests/vitrine-pagination.spec.ts` — quatre cas, sans authentification
- `docs/stories/3-4-paginer-la-vitrine-publique.md` — ce fichier

**Créé puis supprimé**

- `tests/zz-mesure-temporaire.spec.ts` — la sonde de poids, lancée avant et
  après correction. Elle a servi à établir les chiffres ci-dessus ; la
  garder aurait ajouté un décor de 300 biens à chaque exécution de la
  suite pour une mesure qui ne se refait pas.
