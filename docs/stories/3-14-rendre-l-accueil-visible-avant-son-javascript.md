---
baseline_commit: 589e012
---

# Story 3.14 : Rendre l'accueil visible avant son JavaScript

Status: done *(17-08-2026 — deux mutations jouées séparément. `REP-107`
soldé, aucun constat ouvert. Aucune tâche ne relève de l'éditeur.)*

**Épopée :** 3 — Fiabiliser les données et la tenue à la charge
**Couvre :** `REP-107`
**Ouverte le :** 17-08-2026 (par la story 3.7)

---

## Story

As a **visiteur qui arrive sur l'accueil**,
I want **voir la page sans attendre que son JavaScript s'exécute**,
So that **le premier écran du produit ne dépende pas d'un téléphone rapide.**

---

## L'arbitrage : on n'anime pas l'entrée de ce qui est déjà à l'écran

La fiche exigeait un arbitrage produit avant tout code. Il est rendu ici,
par délégation du 17-08-2026, et il tient en une règle :

> **On n'anime pas l'entrée de ce qui est DÉJÀ à l'écran ;
> on anime l'entrée de ce qui y ARRIVE.**

Ce n'est pas un compromis pour gagner un dixième de seconde. Une entrée en
fondu sert à accompagner l'apparition d'un élément **au moment où le
regard y arrive** — c'est ce que font les sections d'en dessous, déclenchées
au défilement. Appliquée au premier écran, elle ne fait qu'une chose :
**retarder la page**, et la rendre conditionnelle à l'exécution d'un script.

**La chorégraphie n'a pas changé.** Mêmes délais, mêmes durées, même courbe
— `cubic-bezier(0.16, 1, 0.3, 1)`, celle de `EASE`. Ce qui change est le
**moteur**, et avec lui le moment où elle peut commencer.

### Règle 8 (§12) est tenue, et il faut le dire explicitement

La règle fixe *« Animations Framer Motion »*. Framer **reste** la
bibliothèque d'animation du produit : défilement, parallaxe, compteurs,
apparitions au défilement, diaporama de la vitrine. Ce que la story déplace
est **une seule séquence**, celle du premier écran, et pour une raison qui
n'est pas un goût : **aucune animation pilotée par un script ne peut
commencer avant l'hydratation.** C'est une contrainte du navigateur. Rendre
le premier écran indépendant du script et le confier à Framer sont deux
choses incompatibles.

---

## Ce qui était mesuré, et ce que ça donne

### Avant

```
curl / | grep -o 'opacity:0' | wc -l                ->  34
curl /vitrine/… | grep -o 'opacity:0' | wc -l       ->   0

Lighthouse mobile bridé, /   ->  LCP 3,459 s   TTI 3,459 s
PerformanceObserver, Slow-4G + CPU ×4
   /  ->  <p class="mt-7 max-w-lg…">   3 500 ms
```

### Après

| | Avant | Après |
|---|---|---|
| `opacity:0` servis sur `/` | 34 | **21** *(les sections d'en dessous, animées au défilement — voulu)* |
| LCP `/`, mesure directe | 3 500 ms | **1 556 ms** ✅ |
| LCP `/`, Lighthouse simulé | 3,459 s | 3,17 s ✗ |
| performance `/` | 91 | 93-94 |
| CLS `/` | 0 | **0** |
| vitrine (témoin, non touchée) | 1 844 ms | 1 836 ms |

> ⚠ **Les deux méthodes ne s'accordent pas, et je ne choisis pas la plus
> flatteuse.** La mesure directe — un vrai Chrome, bridé au réseau et au
> processeur, écoutant `PerformanceObserver` — dit **1,56 s**. Lighthouse,
> qui *simule* le graphe au lieu de l'exécuter, dit **3,17 s**, et sa valeur
> reste collée à son TTI. L'écart n'est pas expliqué ici ; il est écrit.
> Ce qui est certain et vérifiable dans les deux cas : le HTML servi n'est
> plus transparent, et **13 éléments de moins** attendent le script.

---

## Un défaut trouvé en chemin : la page annonçait des zéros

`CountUp` rendait `0` côté serveur — `useState(reduce ? value : 0)`, et
`reduce` vaut `null` au rendu serveur. Sans JavaScript, l'accueil annonçait
donc :

> **0** modules métier · **0** types de biens

**Ce n'est pas une page vide, c'est une page fausse** — et c'est ce que
lisait aussi tout robot d'indexation qui n'exécute pas de script, sur la
page qui vend le produit. Corrigé : `null` signifie « le décompte n'a pas
commencé », et on rend alors la valeur réelle.

**Le coût est écrit parce qu'il est réel** : à l'hydratation, le chiffre
repart de zéro pour se recompter — une image, avant que l'œil ne s'y pose.
C'est le prix d'un chiffre juste pour qui n'a pas de JavaScript, et il est
moins cher que l'inverse.

---

## Acceptance Criteria

**Given** le HTML servi de `/` porte 34 fois `opacity:0`
**Then** le premier écran est lisible sans exécuter une ligne de JavaScript ✅
**And** le nombre d'`opacity:0` servis est mesuré avant et après ✅ — 34 → 21

**Given** l'accueil et la vitrine
**Then** l'élément LCP et son instant sont écrits pour les deux pages ✅
**And** le LCP de l'accueil passe sous 2,5 s — ou le motif de son échec est mesuré
→ ✅ **1,56 s en mesure directe** · ✗ 3,17 s en simulation Lighthouse, et l'écart est écrit plutôt que tranché

**Given** la vitrine, qui est déjà exempte
**Then** elle ne régresse pas ✅ — 1 836 ms contre 1 844 ms, et
`tests/images.spec.ts` garde déjà son cas sans JavaScript

---

## Tasks / Subtasks

- [x] T1 — rendre l'arbitrage, et l'écrire avec son motif
- [x] T2 — deux animations CSS (`entree`, `entree-masque`) sur la courbe de `EASE`
- [x] T3 — `MaskLine`, le héros et `AppPreview` : 11 entrées converties
- [x] T4 — `CountUp` rend la vraie valeur côté serveur
- [x] T5 — couper aussi le **délai** sous `prefers-reduced-motion`
- [x] T6 — tests : lisibilité et chiffres justes, sans JavaScript
- [x] T7 — deux mutations, jouées séparément
- [x] T8 — `tsc` 0 · `lint` 0 · `test:e2e` **197 passed**
- [x] T9 — `REP-107` soldé, `docs/` à jour

---

## Preuves — les deux mutations

| # | Ce qu'on casse | Résultat | Message lu |
|---|---|---|---|
| **M1** | la phrase d'accroche repasse en Framer | ROUGE | *« le premier écran reste transparent sans JavaScript […] c'est l'élément que la mesure a désigné comme LCP »* |
| **M2** | `CountUp` rend de nouveau `0` au serveur | ROUGE | *« l'accueil annonce ["0","0","DZD"] : un compteur rendu à zéro par le serveur n'est pas une page vide, c'est une page fausse »* |

**M2 est celle qui compte** : elle montre le message que le défaut produit,
avec ses valeurs réelles. Un test qui aurait seulement vérifié « la page
contient des chiffres » serait resté vert sur `0`.

> ⚠ **Le premier jet du test rougissait sur un produit correct.** Il lisait
> l'opacité immédiatement, alors que l'entrée est une animation CSS de 0,8 s
> précédée d'un délai de 0,6 s. Ce qu'il faut garder n'est pas « visible à
> la milliseconde zéro » mais **« visible sans qu'un script s'exécute »** :
> le cas attend désormais l'effet, avec un plafond large et un motif écrit.

**Un correctif de plus, trouvé par la même logique** : le bloc
`prefers-reduced-motion` coupait la **durée** des animations mais pas le
**délai**. Avec `animation-fill-mode: both`, un délai de 0,6 s laisse
l'élément à son état de départ — donc transparent — pendant 0,6 s avant de
sauter à l'arrivée. Couper la durée sans couper le délai ne supprime pas le
mouvement : **il le remplace par une attente.**

---

## Ce que ce travail ne prouve pas

- **L'écart entre les deux mesures de LCP n'est pas expliqué.** Il est
  constaté et écrit. Trancher demanderait de lire la trace de Lighthouse
  élément par élément, et cette story avait une propriété plus simple à
  tenir : la page se lit sans script, ce qui se vérifie sans simulation.
- **Le rendu visuel n'a pas été comparé image par image.** La chorégraphie
  est reproduite à l'identique sur le papier — mêmes délais, mêmes durées,
  même courbe — mais aucune capture avant/après n'a été confrontée.
- **Les 21 `opacity:0` restants ne sont pas prouvés inoffensifs.** Ils
  appartiennent aux sections d'en dessous, déclenchées au défilement ; c'est
  la règle posée, pas une mesure. Un visiteur sans JavaScript ne verra pas
  ces sections apparaître — il verra le premier écran, ce qui est
  exactement ce que la story promettait.

---

## Dev Agent Record

### Debug Log

- `npx tsc --noEmit` → 0 erreur
- `npm run lint` → 0 erreur, 0 avertissement
- `npm run test:e2e` → **197 passed** (195 avant : +2)
- Lighthouse mobile bridé → `/` 93 · LCP 3,17 s · CLS 0

### Completion Notes

- **11 entrées converties** : 3 lignes de titre (`MaskLine`), 4 blocs du
  héros, 6 blocs d'`AppPreview` — dont les barres du graphique, qui
  partaient d'une hauteur nulle.
- **`framer-motion` n'est plus importé du tout par `AppPreview`.** Il reste
  partout ailleurs : la règle 8 porte sur la bibliothèque, pas sur chaque
  fichier.
- **Décomptes recalculés et inchangés** : 7 épopées, 63 stories dans les
  deux sources, 38 défauts.
- **L'épopée 3 n'a plus que deux stories ouvertes**, et les deux relèvent de
  l'éditeur : **3.8** (indexes — des migrations) et **3.11** (base de
  production).

---

## Change Log

| Date | Version | Description |
|---|---|---|
| 17-08-2026 | 1.0 | `REP-107` soldé, deux mutations, story `done` |

---

## File List

**Créés**

- `tests/accueil-sans-javascript.spec.ts`
- `docs/stories/3-14-rendre-l-accueil-visible-avant-son-javascript.md`

**Modifiés**

- `app/globals.css` — `entree`, `entree-masque`, `entree-hauteur`,
  `entree-pose`, et le délai coupé sous `prefers-reduced-motion`
- `components/motion/primitives.tsx` — `MaskLine` en CSS, `CountUp` rend la
  vraie valeur au serveur
- `components/landing/HeroSection.tsx`, `components/landing/AppPreview.tsx`
- `docs/stories/deferred-work.md`, `docs/stories/sprint-status.yaml`,
  `docs/epics.md`
