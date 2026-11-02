---
baseline_commit: 9e06687
---

# Story 3.7 : Servir les images à leur poids réel

Status: done *(17-08-2026 — trois mutations jouées séparément, dont **deux
qui sont passées au vert** et ont fait corriger le test ou retirer le code.
`REP-107` ouvert, story 3.14 avec. **L'AC-5 n'est pas tenue sur l'accueil**,
et le motif est mesuré.)*

**Épopée :** 3 — Fiabiliser les données et la tenue à la charge
**Couvre :** NFR-05
**Ouverte le :** 17-08-2026

---

## Story

As a **visiteur sur mobile en Algérie**,
I want **que la vitrine se charge sans attendre plusieurs mégaoctets de photos**,
So that **je ne quitte pas la page avant de voir les biens.**

---

## L'arbitrage : `sharp`, une dépendance

Cette story **ne peut pas se faire sans elle**, et ce n'est pas une opinion.
`next/image` délègue l'encodage à `sharp` :

```js
sharp = require(process.env.NEXT_SHARP_PATH || "sharp")
// next/dist/server/image-optimizer.js:157
```

`sharp` **n'est pas** une dépendance de Next 14.2 — vérifié dans ses
`optionalDependencies`. Sans elle, Next retombe sur Squoosh… **sauf en
sortie autonome**, c'est-à-dire exactement la nôtre :

```js
if (showSharpMissingWarning && nextConfigOutput === "standalone") {
  _log.error("Error: 'sharp' is required to be installed in standalone mode…")
  throw new ImageError(500, "Internal Server Error")
}
// même fichier, ligne 665
```

Convertir vers `next/image` **sans** `sharp` aurait donc rendu **500 toutes
les images en production**, tout en restant vert en développement. Les deux
seules autres issues étaient `unoptimized: true` — c'est-à-dire une balise
`<img>` déguisée, sans aucun gain — ou ne rien faire.

**Décision, par délégation explicite du 17-08-2026 :** `sharp` est ajoutée.
Elle est aussi **recopiée explicitement dans l'image Docker**, comme le
client Prisma l'est déjà : le `require` est dynamique, l'analyse statique de
`.next/standalone` ne le voit pas toujours, et l'oubli ne se remarquerait
qu'à la première image demandée en production.

---

## L'inventaire était faux : 13 balises, pas 11

La fiche de la story annonçait « les 11 balises `<img>` du projet ».
Recompté :

```
grep -rn "<img"        app components --include=*.tsx  ->  11
grep -rn "motion\.img" app components --include=*.tsx  ->   2
```

**13.** Et les deux manquantes sont **les deux plus lourdes** : les fonds
animés de la vitrine et de la section tarifaire, c'est-à-dire précisément
celles que la story existe pour corriger. Une commande de recensement qui
rate ce qu'elle recense donne un feu vert — c'est la leçon déjà payée par
l'inventaire des Server Actions destructives.

**12 sont converties. Une reste**, et c'est un choix mesuré :
`UploadDropzone` affiche une URL `data:` produite par `FileReader` sur le
fichier que l'utilisateur vient de choisir. Elle n'a jamais transité par le
réseau et le serveur ne l'a jamais vue : il n'y a rien à optimiser, et la
passer à `next/image` demanderait `unoptimized` — une balise `<img>`
déguisée, avec en prime un aller-retour inutile.

---

## Ce que ça pèse — mesuré sur profil mobile réel

Navigateur en émulation **Pixel 5** (390 × 851, DPR 2,75), somme des octets
des réponses `image/*` :

| Page | Avant | Après | |
|---|---|---|---|
| `/` — premier écran | 532 Ko | **0 Ko** | l'image est sous le pli : elle n'est plus chargée du tout |
| `/` — page défilée entièrement | 532 Ko | 110 Ko | **÷ 4,8** |
| `/vitrine/agence-demo` | 1 460 Ko | **198 Ko** | **÷ 7,4** |
| `/auth/login` | 637 Ko | **64 Ko** | **÷ 10,0** |

**L'AC-1 demande « divisé par cinq au minimum ».** Elle est tenue sur la
vitrine et sur les écrans d'authentification. Sur l'accueil **entièrement
défilé** elle vaut 4,8 — et je n'ai pas dégradé la photo davantage pour
atteindre un chiffre rond. Au premier écran, qui est ce que le visiteur
paie réellement, elle passe de 532 Ko à zéro.

> **Qualité 60 sur les deux fonds décoratifs, 75 partout ailleurs.** Mesuré :
> `villa.jpg` en 1200 px passe de 137 164 à 112 954 octets. Ces photos sont
> des fonds, recouverts d'un voile sombre et animés en permanence. Le réglage
> **n'est pas étendu aux photos de biens** : là, le détail *est* le produit.

---

## Ce que ça donne à Lighthouse

Profil mobile bridé, `npm run verify` non concerné — audit exigé par la
**règle 10** :

| | Avant *(fiche de la story)* | Après |
|---|---|---|
| vitrine — performance | 89-91 | **96** |
| vitrine — LCP | 3,5-3,7 s | **2,8 s** *(2,8 à 3,1 selon les passages)* |
| vitrine — CLS | 0 | **0** ✅ |
| accueil — performance | — | 91 |
| accueil — LCP | — | 3,5 s |

**AC-3 tenue : le CLS reste à 0.** Les dimensions déclarées par `fill` et
les conteneurs à ratio fixe empêchent tout saut.

---

## Deux hypothèses posées, deux hypothèses démenties

Ce dépôt traite une affirmation non tenue comme un défaut. En voici deux,
de moi, mesurées et abandonnées.

### 1. « Le fond part à `opacity: 0`, donc le LCP attend l'hydratation »

Framer écrit les valeurs de `initial` dans le style rendu par le serveur.
LCP 3,09 s pour un TTI de 3,22 s : les deux collent, et c'est la signature
d'un LCP qui attend du JavaScript. J'ai donc ajouté un garde — la première
photo part à `opacity: 1` au rendu serveur.

**Mesuré : Lighthouse ne bouge pas d'un dixième.** Et en retirant le garde
pour vérifier, le HTML servi portait **déjà** `opacity:1` — zéro occurrence
de `opacity:0` sur la vitrine. `AnimatePresence initial={false}`, posé bien
avant cette story, faisait déjà le travail.

**Le code a été retiré.** Il n'y a pas de dette à garder un correctif qui
corrige quelque chose qui n'existe pas ; le test qui en est né, lui, reste :
il garde la propriété pour elle-même.

### 2. « L'image du bandeau *est* le LCP » — ce que dit l'AC-2

Vrai sur la vitrine. **Faux sur l'accueil.** Mesuré au
`PerformanceObserver`, sous Slow-4G et processeur bridé ×4 :

| Page | Élément LCP | Instant |
|---|---|---|
| `/vitrine/agence-demo` | `IMG` — le fond du bandeau | **1 856 ms** ✅ |
| `/` | `<p class="mt-7 max-w-lg …">` — **du texte** | 3 500 ms |

Sur l'accueil, **aucun travail sur les images ne peut déplacer le LCP** :
ce n'est pas une image. `/` sert **34 fois `opacity:0`** dans son HTML
(la vitrine : zéro), et son LCP égale son TTI à la milliseconde près.

C'est un constat neuf, mesuré, hors périmètre : **`REP-107`, story 3.14.**

---

## Acceptance Criteria

**Given** `casbah-patrimoine.jpg` pèse 1 890 Ko et `casbah-interieur.jpg` 637 Ko, servis bruts
**Then** ils sont servis en WebP et redimensionnés pour l'écran réel ✅
**And** le poids transféré des images d'une page est divisé par cinq au minimum
→ **✅ vitrine (÷7,4) et authentification (÷10)** · **✗ accueil entièrement défilé (÷4,8)**

**Given** le projet compte 11 `<img>` et aucun `next/image`
**Then** chaque image passe par `next/image`, avec `width`, `height` et `sizes` ✅
*(13 et non 11 — recompté ; 12 converties, la treizième est une URL `data:`, motif écrit sur place. `fill` pose width et height ; `sizes` est renseigné partout)*
**And** les images hors du premier écran sont chargées en différé ✅
**And** l'image du bandeau porte `priority`, parce qu'elle *est* le LCP
→ ✅ **sur la vitrine**, où c'est vrai · **la prémisse est fausse sur l'accueil**, voir ci-dessus

**Given** le CLS vaut 0 aujourd'hui
**Then** il vaut toujours 0 ✅ — mesuré, sur les deux pages

**Given** les photos de biens sont téléversées par les agences
**Then** elles bénéficient du même traitement que les images de la marque ✅
*(mêmes composants, même optimiseur — les cartes de la vitrine, la galerie d'une fiche, les vignettes de l'espace agence)*

**Given** l'objectif
**Then** le LCP est sous 2,5 s sur l'accueil **et** sur la vitrine
→ **✗ NON TENUE.** Vitrine : 1,86 s en mesure directe, 2,8 s en simulation Lighthouse. Accueil : 3,5 s, et le LCP y est **du texte**. Le motif est mesuré et porté par `REP-107`.

---

## Tasks / Subtasks

- [x] T1 — mesurer le poids transféré avant, sur profil mobile réel
- [x] T2 — arbitrer `sharp` (§2) et l'inscrire, avec son motif
- [x] T3 — recopier `sharp` dans l'image Docker, comme le client Prisma
- [x] T4 — convertir les 13 balises ; écrire le motif de celle qui reste
- [x] T5 — remesurer : poids, Lighthouse, et l'élément LCP réel
- [x] T6 — tests : optimiseur, boîte réelle, rendu sans JavaScript
- [x] T7 — trois mutations, jouées séparément
- [x] T8 — `tsc` 0 · `lint` 0 (les 4 avertissements `<img>` ont disparu) · **195 passed**
- [x] T9 — `REP-107` ouvert, story 3.14 ouverte, `docs/` à jour
- [ ] **T10 — construire et servir l'image Docker pour éprouver le `COPY` de
      `sharp`. NON FAIT.** Voir « ce que ce travail ne prouve pas ».

---

## Preuves — les trois mutations

| # | Ce qu'on casse | Résultat | Suite |
|---|---|---|---|
| **M1** | une photo de la vitrine passe en `unoptimized` | ROUGE | *« `/images/interior.jpg` est servie telle quelle : c'est le JPEG brut d'origine »* |
| **M2** | le parent d'une image en `fill` perd son `relative` | **VERT** ⚠ | le test ne le voyait pas — **assertion ajoutée**, mutation rejouée : *« déborde de son conteneur de 178 px »* |
| **M3** | le fond repart à `opacity: 0` au rendu serveur | **VERT** ⚠ | ce n'était pas mon garde qui tenait la propriété : **le garde a été retiré** |

**Deux mutations sur trois sont passées au vert, et ce sont les deux qui ont
fait le plus de bien.**

- **M2** a montré un trou dans mon propre test : une image en `fill` dont le
  parent n'est pas positionné **charge quand même**, a **une boîte**, et
  recouvre l'écran. `naturalWidth > 0` ne dit rien de ce cas. La boîte est
  désormais comparée à celle du conteneur.
- **M3** a montré que le code que je venais d'écrire ne servait à rien.
  Retiré.

> ⚠ **Trois builds ont échoué avant de rougir**, tous pour la même raison :
> une mutation qui laisse un symbole inutilisé casse le lint, donc le build,
> donc la suite — et le rouge ne vient pas du test (§6, piège 3). Chacune a
> été réécrite sous une forme compilable, puis rejouée. C'est la deuxième
> story de suite où ce piège se présente.

---

## Ce que ce travail ne prouve pas

- **L'image Docker n'a pas été construite.** Le `COPY` de `sharp` est écrit,
  argumenté par la lecture du code de Next, et calqué sur celui du client
  Prisma qui existe pour la même raison — **il n'est pas éprouvé**. La
  vérification tient en une commande, et elle appartient au déploiement :
  `docker compose -f docker-compose.prod.yml up -d --build`, puis demander
  une image de la vitrine. Si le `COPY` manquait, elle répondrait **500**.
- **Le LCP de l'accueil n'est pas corrigé** — et il ne l'est pas parce que
  ce n'est pas un problème d'images. `REP-107`.
- **Aucune mesure sur un vrai réseau algérien**, ni sur un vrai téléphone.
  Tout est émulé : Pixel 5, Slow-4G, processeur ×4. Les rapports entre
  « avant » et « après » sont solides ; les valeurs absolues sont celles
  d'un émulateur.
- **La lisibilité des photos en qualité 60 n'a pas été jugée à l'œil sur un
  écran calibré.** Le réglage est raisonné (fond, voilé, animé) et mesuré en
  octets, pas validé visuellement.

---

## Dev Agent Record

### Debug Log

- `npx tsc --noEmit` → 0 erreur
- `npm run lint` → **0 erreur, 0 avertissement** — les 4 avertissements
  `<img>` qui traînaient depuis des semaines ont disparu avec la conversion
- `npm run test:e2e` → **195 passed** (192 avant : +3)
- Lighthouse mobile bridé → vitrine 96 / LCP 2,8 s / CLS 0 · accueil 91 /
  LCP 3,5 s / CLS 0

### Completion Notes

- **Une dépendance ajoutée** : `sharp` ^0.35.3. C'est la première de ce
  dépôt depuis longtemps, et le motif est écrit ci-dessus plutôt que
  supposé.
- **`priority` n'est pas mis partout** : sur la section tarifaire, tout en
  bas de l'accueil, il volerait de la bande passante à ce que le visiteur
  regarde d'abord. Le motif est sur place.
- **Décomptes recalculés** : 7 épopées, **63** stories dans les deux sources
  (62 avant — la story 3.14), 38 défauts. `REP-107` n'est **pas** inscrit en
  `BUG-nn` : il est mesuré mais n'a produit aucune perte, et le registre des
  défauts n'accueille pas les lenteurs.

---

## Change Log

| Date | Version | Description |
|---|---|---|
| 17-08-2026 | 1.0 | 12 images converties, `sharp` arbitrée, `REP-107` ouvert |

---

## File List

**Créés**

- `tests/images.spec.ts`
- `docs/stories/3-7-servir-les-images-a-leur-poids-reel.md`

**Modifiés**

- `package.json`, `package-lock.json` — `sharp`
- `docker/Dockerfile` — `COPY` de `sharp` et de `@img`, avec son motif
- `components/PropertyGallery.tsx`, `components/dashboard/RecentProperties.tsx`,
  `components/upload/GalleryUploadField.tsx`,
  `components/motion/PhotoBackdrop.tsx`,
  `components/landing/PricingSection.tsx`
- `components/upload/UploadDropzone.tsx` — la balise qui reste, et pourquoi
- `app/agency/properties/page.tsx`, `app/agency/properties/[id]/page.tsx`,
  `app/agency/owners/[id]/page.tsx`, `app/agency/showcase/page.tsx`,
  `app/vitrine/[slug]/page.tsx`
- `docs/stories/deferred-work.md`, `docs/stories/sprint-status.yaml`,
  `docs/epics.md`, `docs/architecture.md`
