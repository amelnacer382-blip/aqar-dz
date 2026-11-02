---
baseline_commit: 3bd41be
---

# Story 3.12 : Borner le plan du site

Status: done *(17-08-2026 — sept mutations jouées séparément. `REP-105`
soldé, aucun constat ouvert. Aucune tâche ne relève de l'éditeur.)*

**Épopée :** 3 — Fiabiliser les données et la tenue à la charge
**Couvre :** `REP-105`
**Ouverte le :** 17-08-2026 (par l'AC-2 de la story 3.4)

---

## Story

As a **éditeur**,
I want **que le plan du site reste lisible par les moteurs quand la plateforme grandit**,
So that **la vitrine ne redevienne pas invisible au moment précis où elle compte le plus.**

---

## La story commence par une mesure, parce que le constat n'en avait pas

`REP-105` a été **établi par lecture** et par le calcul du scénario de
l'AC-2 de la story 3.4. Sa fiche le disait : *« ⚠ Constat NON MESURÉ. »*
Première tâche, donc, avant toute ligne de code.

### Ce que la base dit aujourd'hui

```
Vitrines publiées   : 43
Biens publiés       : 4
URL dans le plan    : 48   (1 accueil + vitrines + biens)
Limite d'un fichier : 50 000
Marge               : 49 952 URL
```

**Le défaut est entièrement prospectif**, et c'est écrit tel quel. Il ne
gêne personne aujourd'hui ; il gênera tout le monde au moment où la
plateforme réussit.

> Les 43 vitrines pour 4 biens ne sont pas un état de production : la base
> de développement porte 91 agences, presque toutes laissées par les tests
> d'inscription. C'est `REP-16`, déjà porté par la story 4.7 — aucun
> nouveau constat n'est ouvert pour ça.

### La limite, vérifiée à sa source et non de mémoire

`https://www.sitemaps.org/protocol.html`, consulté le 17-08-2026 :

> « Each Sitemap file that you provide must have **no more than 50,000
> URLs** and must be **no larger than 50MB** (52,428,800 bytes). »
>
> « **Sitemap index files may not list more than 50,000 Sitemaps** and must
> be no larger than 50MB. »

### Laquelle des deux limites mord ? Mesuré sur l'application servie

```
/sitemap.xml            272 octets, 2 parties
/sitemap/agences-0.xml  8 084 octets pour 44 entrées   -> ~184 o/entrée
/sitemap/biens-0.xml      906 octets pour  4 entrées   -> ~199 o/entrée
```

À 45 000 entrées, une partie pèse donc **8,3 à 9,0 Mo** — **six fois sous
le plafond de 50 Mo**. La limite qui mord est celle du **nombre d'URL**, pas
celle du poids. Le découpage se règle sur elle, et cette phrase existe pour
qu'on ne cherche pas à compresser le mauvais problème.

**Le seuil se franchit vers 50 000 objets publiés** : 25 agences de 2 000
biens y suffisent. Le scénario nommé par l'AC-2 de la story 3.4 — 50 agences
de 2 000 biens — produit **100 051 URL**, le double de ce qu'un fichier
accepte.

---

## Pourquoi `app/sitemap.ts` a dû disparaître

La convention de métadonnées de Next ne sait produire qu'un `<urlset>` :
son type `MetadataRoute.Sitemap` est une liste d'URL, pas une liste de
plans. Il n'y a pas de forme d'index à lui faire rendre.

`generateSitemaps()` existe bien dans Next 14.2 — et **ne répond pas au
besoin**. Lu dans
`next/dist/build/webpack/loaders/next-metadata-route-loader.js` :

```js
const sitemaps = generateSitemaps ? await generateSitemaps() : null
if (sitemaps) {
  id = sitemaps.find(…)?.id
  if (id == null) {
    return new NextResponse('Not Found', { status: 404 })
  }
}
```

Il déplace le plan vers `/sitemap/<id>.xml` et laisse **`/sitemap.xml` en
404**. Or c'est `/sitemap.xml` que `robots.ts` annonce, et c'est cette
adresse que les moteurs demandent. Deux gestionnaires de route rendent les
deux :

| | |
|---|---|
| `app/sitemap.xml/route.ts` | l'index — `<sitemapindex>` |
| `app/sitemap/[partie]/route.ts` | une partie — `<urlset>` |
| `lib/plan-du-site.ts` | l'arithmétique, les conditions de publication, les deux sérialiseurs |

**Aucune borne n'est posée.** L'AC-2 de la story 3.4 exige que le plan liste
*tout* ; il n'y a ici qu'un découpage.

---

## Trois choix, et leur motif

**Le découpage se fait par genre, pas sur un flux unique.** Paginer d'un
seul `skip`/`take` à travers *deux* tables demanderait un ordre global
qu'aucune ne porte ; on paginerait alors sur un décalage calculé à la main,
et une entrée insérée au milieu déplacerait silencieusement tout ce qui
suit. Deux suites indépendantes coûtent une entrée de plus dans l'index et
se raisonnent.

**`agences-0` est toujours présente**, même base injoignable : elle porte
l'accueil. Ce n'est pas de l'élégance — `scripts/verify-deploy.mjs` compare
le domaine de `robots.txt` à celui du **premier `<loc>`** du plan. Un index
qui pourrait être vide priverait de sa comparaison le garde-fou posé par la
story 3.6.

**La tranche vaut 45 000 et non 50 000.** La partie `agences-0` porte
l'accueil *en plus* de sa tranche, et une entrée ajoutée plus tard — des
images, par exemple — ne doit pas faire repasser le calcul au-dessus du
seuil sans que personne ne s'en aperçoive.

---

## §8 — ce que je viens de rendre atteignable

| | |
|---|---|
| `/sitemap.xml` change de **nature** | il ne porte plus d'URL de vitrine mais des adresses de plans. Un consommateur qui y cherchait une vitrine ne la trouve plus. **Deux le faisaient** : `tests/features.spec.ts`, corrigé pour suivre la chaîne — ce qui est un meilleur test —, et `scripts/verify-deploy.mjs`, dont l'invariant (comparer deux **origines**) tient sans changer une ligne de code |
| un **nouveau point d'entrée public**, `/sitemap/<partie>` | son segment vient de l'extérieur. `lirePartie()` nomme ses deux genres en toutes lettres dans une expression régulière — pas de garde en `valeur in TABLE`, trouée par la chaîne de prototypes (story 3.2, `BUG-38`). Une partie inconnue répond **404**, jamais un plan vide |
| la pagination **n'est pas un instantané** | un robot demande les parties l'une après l'autre ; une agence publiée entre deux requêtes peut décaler la suite. C'est inhérent à tout plan paginé, ça se rattrape au passage suivant, et c'est écrit dans le fichier pour que personne ne le découvre comme un défaut |

**Vérifié, pas supposé** : `npm run verify:deploy` rejoué contre une pile
servie — *« 3. robots.txt et sitemap.xml s'accordent sur
http://localhost:8095 »*, sortie **0**.

---

## Acceptance Criteria

**Given** `app/sitemap.ts` chargeait tous les biens de toutes les agences dans un seul fichier
**When** la correction est appliquée
**Then** le plan devient un **index** renvoyant vers des fichiers partiels, chacun sous la limite ✅

**Given** une base dépassant la limite
**When** un robot demande `/sitemap.xml`
**Then** il obtient l'index, et chaque partie reste servie et valide ✅
*(le découpage est éprouvé sur la borne exacte ; la plomberie de bout en bout à l'échelle réelle de la base)*

**Given** une base de taille ordinaire
**When** un robot demande `/sitemap.xml`
**Then** rien ne change pour lui — l'index d'un seul fichier reste valide ✅

**Given** le constat n'était pas mesuré
**When** la story démarre
**Then** elle commence par la mesure ✅ — 48 URL, marge de 49 952

---

## Tasks / Subtasks

- [x] T1 — mesurer l'état réel avant d'écrire une ligne
- [x] T2 — vérifier la limite à sa source, et laquelle des deux mord
- [x] T3 — `lib/plan-du-site.ts` : arithmétique, conditions, sérialiseurs
- [x] T4 — les deux gestionnaires de route ; `app/sitemap.ts` retiré
- [x] T5 — reprendre les deux consommateurs de `/sitemap.xml`
- [x] T6 — tests : le découpage sur ses bornes, la chaîne de bout en bout, les 404
- [x] T7 — sept mutations, jouées séparément, chaque message d'échec lu
- [x] T8 — `tsc` 0 · `lint` 0 · `test:e2e` **187 passed** · `verify:deploy` **0**
- [x] T9 — registre : `REP-105` soldé ; `docs/` à jour

---

## Preuves — les sept mutations

| # | Ce qu'on casse | Résultat | Message lu |
|---|---|---|---|
| **M1** | `TAILLE_PLAN` passe à 60 000 | ROUGE ×2 | *« une partie peut atteindre la limite du protocole : au-delà, les moteurs ignorent le fichier »* |
| **M2** | `partiesDuPlan()` ne pagine plus | ROUGE | *« le plan ne se découpe pas : les 100 051 URL du scénario partent dans un seul fichier »* |
| **M3** | `lirePartie()` devient permissif | ROUGE ×2 | *« `agences-007.xml` a été accepté comme partie »* et le 404 correspondant |
| **M4** | l'index rend un `<urlset>` | ROUGE ×2 | *« /sitemap.xml n'est pas un index : le découpage de la story 3.12 est défait »* |
| **M5** | `nombreDeParties(0)` rend 0 | ROUGE ×2 | *« un index vide : verify:deploy n'a plus de `<loc>` à comparer »* |
| **M6** | `force-dynamic` retiré de l'index | ROUGE | *« app/sitemap.xml/route.ts ne porte plus force-dynamic »* |
| **M7** | `echapperXml()` laisse passer `&` | ROUGE | *« un caractère XML passe sans être échappé : le plan devient un XML invalide, donc ignoré EN ENTIER »* |

> **Trois de ces rouges ont d'abord été muets.** M2, M4 et M7 tombaient sur
> un `toEqual`/`toContain`/`toBe` **anonyme** — *« expect(received).toEqual(
> expected) »* — qui ne nomme pas ce qui a été perdu. Les messages ont été
> écrits, **puis la mutation rejouée** pour vérifier que c'est bien le
> nouveau message qui sort. Un rouge qui ne désigne pas la propriété visée
> coûte une demi-heure à celui qui le lira dans six mois : c'est ce que
> demande §6, et le seul moyen de s'en apercevoir est de lire ses propres
> échecs.

**Contrôles positifs**, exigés et présents :

- les 404 de `/sitemap/<partie>` sont précédés d'un **200 sur
  `agences-0.xml`** : sans lui, une route entièrement cassée donnerait le
  même vert ;
- l'échappement est vérifié sur une URL **ordinaire**, qui doit traverser
  intacte, avant de l'être sur une URL à échapper ;
- le découpage est vérifié **sous** la borne autant qu'au-dessus.

---

## Ce que ce travail ne prouve pas

- **Aucune base de 50 000 URL n'a été montée.** Le seuil est éprouvé sur
  l'arithmétique, qui est une fonction pure et se teste sur la borne
  exacte ; la plomberie est éprouvée de bout en bout à l'échelle réelle de
  la base. Un décor de 50 000 biens coûterait des minutes à chaque exécution
  et n'apprendrait rien de plus — et c'est un choix, pas un oubli.
- **Aucun moteur de recherche n'a été consulté.** Que Google lise bien cet
  index relève de son comportement, pas du nôtre ; ce qui est vérifié est la
  conformité au protocole publié.
- **`verify:deploy` a été joué contre `next start`, pas contre nginx.** La
  pile conteneurisée n'a pas été démarrée pour cette story. L'étape 3, celle
  qui touche au plan, ne dépend pas du relais.

---

## Dev Agent Record

### Debug Log

- `npx tsc --noEmit` → 0 erreur
- `npm run lint` → 0 erreur (4 avertissements `<img>` préexistants, story 3.7)
- `npm run test:e2e` → **187 passed** (180 avant : +6 sur le découpage, +1 sur les 404)
- `VERIFY_BASE=http://localhost:3009 npm run verify:deploy` → **0**

### Completion Notes

- **Un défaut latent trouvé en chemin, et mesuré avant d'être annoncé.** Le
  sérialiseur de Next **n'échappe pas** les URL : il interpole `item.url`
  tel quel. Rien n'était cassé pour autant — le seul écrivain d'un slug est
  `agencySettingsSchema`, qui le contraint à `^[a-z0-9-]{3,40}$`, et les
  identifiants de biens sont des cuid. **Aucun caractère à échapper ne
  pouvait atteindre la sortie.** Le nouveau sérialiseur échappe quand même :
  le jour où cette contrainte bouge, le plan deviendrait un XML invalide,
  donc ignoré en entier. Aucun `REP` ouvert — inscrire une hypothèse non
  observée gonflerait le registre (§7), comme pour `metadataBase` en 3.6.
- **Aucun constat ouvert, aucune story ouverte.** Décomptes recalculés et
  **inchangés** : 7 épopées, 62 stories dans les deux sources, 38 défauts.
- Le cloisonnement n'est pas concerné : le plan ne sert que des pages
  **publiques**, et ses deux conditions de publication sont écrites une
  seule fois, partagées par le comptage de l'index et la liste des parties.

---

## Change Log

| Date | Version | Description |
|---|---|---|
| 17-08-2026 | 1.0 | `REP-105` soldé, sept mutations, story `done` |

---

## File List

**Créés**

- `lib/plan-du-site.ts`
- `app/sitemap.xml/route.ts`
- `app/sitemap/[partie]/route.ts`
- `tests/plan-du-site.spec.ts`
- `docs/stories/3-12-borner-le-plan-du-site.md`

**Retiré**

- `app/sitemap.ts` — la convention de métadonnées ne sait pas produire
  d'index

**Modifiés**

- `tests/features.spec.ts` — suit désormais l'index jusqu'à ses parties, et
  éprouve les 404
- `tests/deploiement.spec.ts` — le contrôle positif de `force-dynamic` porte
  sur les deux nouveaux fichiers
- `scripts/verify-deploy.mjs` — commentaire seul : l'invariant comparait
  déjà deux origines, il tient
- `docs/stories/deferred-work.md`, `docs/stories/sprint-status.yaml`,
  `docs/epics.md`, `docs/architecture.md`
