---
baseline_commit: ef6cd68
---

# Story 3.6 : Corriger robots.txt et le filtre wilaya

Status: done *(17-08-2026 — quatre mutations jouées séparément. `BUG-25` et
`BUG-29` corrigés, aucun `REP` ouvert. Aucune tâche ne relève de
l'éditeur.)*

**Épopée :** 3 — Fiabiliser les données et la tenue à la charge
**Couvre :** `BUG-25` (n° audit 16) · `BUG-29` (n° audit 29)
**Ouverte le :** 17-08-2026

---

## Story

As a **agence**,
I want **que ma vitrine soit correctement indexée et que ses filtres ne mentent pas**,
So that **le module désigné prioritaire tienne sa promesse.**

---

## Deux défauts, et ils ne se ressemblent pas

Ils sont réunis dans une story parce qu'ils touchent la même surface — la
seule page publique du produit, et son indexation. **Ils ne se prouvent pas
du tout de la même façon**, et c'est ce qui fait le travail.

### `BUG-29` — le filtre wilaya, mesurable de bout en bout

La liste des biens filtre sur `status: "disponible"` **et**
`isAvailable: true`. La liste des wilayas qui alimente le menu déroulant ne
filtre que sur `status`. Une wilaya dont tous les biens sont retirés de la
vente apparaît donc dans le filtre et ne renvoie rien.

Un visiteur qui choisit une option proposée par le site et tombe sur zéro
résultat ne conclut pas « il n'y a rien » : il conclut **« ce site est
cassé »**, et il part. Sur la page qui sert d'argument commercial.

### `BUG-25` — `robots.txt`, que la suite de tests **ne peut pas** voir

`app/sitemap.ts` porte `export const dynamic = "force-dynamic"` ;
`app/robots.ts` non. Il est donc **prérendu pendant `next build`**, à
l'intérieur de l'image, où `NEXTAUTH_URL` vaut la valeur factice du
Dockerfile.

**Mesuré, et la preuve est un fichier sur le disque :**

```
$ ls .next/server/app/robots* .next/server/app/sitemap*
.next/server/app/robots.txt.body      ← figé à la construction
.next/server/app/robots.txt.meta
.next/server/app/sitemap/route.js     ← pas de .body : calculé à l'appel

$ cat .next/server/app/robots.txt.body
...
Sitemap: http://localhost:8095/sitemap.xml
```

Les deux fichiers voisins, dans le même dossier, l'un gelé et l'autre non.
`http://localhost:8095` est la valeur du `.env` **de cette machine au moment
de la construction** — dans une image Docker, ce serait
`http://localhost:3000`, la valeur du `Dockerfile:40`.

**Et la suite de tests ne verra jamais ce défaut.** `playwright.config.ts`
construit et sert avec le **même** environnement : la valeur gelée et la
valeur d'exécution sont identiques, donc l'écart est invisible. C'est la
famille de `REP-95` — un vert de cette suite ne dit rien de la topologie de
déploiement.

Deux conséquences, assumées :

1. La couverture durable est une **assertion statique** sur `app/robots.ts`,
   comme `tests/deploiement.spec.ts` en tient sur le `Dockerfile`.
2. La preuve de bout en bout est faite **une fois**, à la main, en
   construisant avec une adresse et en servant avec une autre. Elle est
   écrite dans cette story, et **`npm run verify:deploy` la reprend** — ce
   script attaque la pile réelle, c'est-à-dire le seul endroit où ce défaut
   existe.

---

## Ce que le balayage a trouvé, et ce qu'il n'a pas trouvé

Les deux défauts appartiennent à des familles ; une story qui n'en corrige
que l'occurrence signalée laisse la famille en place.

### Famille 1 — une URL gelée à la construction

```
$ rg -n 'appUrl\(\)' app lib | grep -v lib/mailer.ts
app/sitemap.ts:33          force-dynamic ✔
app/robots.ts:36           ← le défaut
app/auth/forgot/actions.ts:92     Server Action, évaluée à l'appel ✔
lib/notifications.ts:50,79,125    idem ✔
```

Un seul autre point de lecture : `app/layout.tsx:41`, `metadataBase`, bâti
sur `process.env.NEXTAUTH_URL` **à l'évaluation du module**.

**Mesuré avant de conclure**, et le résultat dit de ne rien faire :

```
$ grep -o 'localhost:[0-9]*' .next/server/app/index.html   → aucun
$ grep -o '<meta property="og:[^>]*>' .next/server/app/index.html
   og:title, og:description, og:site_name, og:locale, og:type   (pas d'og:url)
```

`metadataBase` ne sert à résoudre que des adresses **relatives** — images de
partage, canonique. Le produit n'en déclare aucune : **rien n'est gelé
aujourd'hui**. C'est un piège dormant, pas un défaut. Il est documenté dans
le fichier, et **il n'ouvre pas de `REP`** : inscrire au registre une
hypothèse non observée gonflerait le décompte d'une affirmation non mesurée
(§7).

### Famille 2 — deux requêtes qui doivent s'accorder

```
$ rg -n 'distinct:' app lib
app/vitrine/[slug]/page.tsx:172    ← le seul menu bâti sur une requête
```

Et la fiche publique d'un bien, qui doit poser les mêmes conditions que la
liste et que le plan du site :

```
$ rg -n 'status:|isAvailable|showcaseEnabled' app/vitrine/[slug]/biens/[id]/page.tsx
44: status: "disponible"   45: isAvailable: true
46: agency: { slug, status: "active", showcaseEnabled: true }        ✔ d'accord
```

**Une seule divergence dans tout le produit.** Le balayage est donc une
bonne nouvelle, et il fallait le lancer pour le savoir.

---

## §8 — ce que ces correctifs rendent atteignable

### 1. `robots.txt` devient une requête, et non plus un fichier

Chaque passage de robot réveille désormais Node au lieu de lire un fichier
gelé. Le coût est celui de `app/sitemap.ts`, qui a pris la même décision
pour la même raison : négligeable, sur une adresse que seuls les moteurs
visitent, et que nginx limite déjà en débit. **Contrairement au sitemap,
`robots.txt` ne fait aucune requête en base** — il n'y a donc même pas ce
coût-là.

### 2. Une wilaya peut disparaître du filtre pendant qu'on la regarde

Le menu ne proposera plus que des wilayas ayant au moins un bien
réellement disponible. Un visiteur qui garde la page ouverte pendant que
l'agence retire son dernier bien d'une wilaya verra, en soumettant, une
liste vide — **exactement comme aujourd'hui**. Le correctif réduit la
fenêtre, il ne la ferme pas, et il n'a pas à la fermer : le message « aucun
bien ne correspond à votre recherche » posé par la story 3.4 traite ce cas.

### 3. Le menu ne suit pas les autres filtres, et c'est délibéré

La requête des wilayas n'applique **pas** `operationType`, `type` ni
`maxPrice`. Une facette qui se filtrerait elle-même enfermerait le visiteur
dans son premier choix : après avoir sélectionné « Alger », il ne pourrait
plus voir les autres wilayas pour en changer. `isAvailable` n'est pas un
filtre de visiteur — c'est une **condition de publication**, au même rang
que `status`. C'est pour cela, et seulement pour cela, qu'elle doit
descendre dans les deux requêtes.

---

## Acceptance Criteria

### AC-1 — `robots.txt` annonce le sitemap sur le domaine réel

**Given** `app/robots.ts` est prérendu pendant `next build` avec l'URL du `.env` de construction
**When** `export const dynamic = "force-dynamic"` y est ajouté, comme dans `app/sitemap.ts`
**Then** la construction ne produit plus de `.next/server/app/robots.txt.body`
**And** l'adresse servie suit l'environnement d'**exécution**, prouvé en construisant avec une adresse et en servant avec une autre

### AC-2 — Le défaut est gardé là où il peut l'être

**Given** que `npm run test:e2e` construit et sert avec le même environnement, donc ne peut pas voir ce défaut
**When** la couverture est posée
**Then** une assertion statique tient `force-dynamic` dans `app/robots.ts`, et elle dit pourquoi elle est statique
**And** `npm run verify:deploy` — qui attaque la pile réelle — vérifie que la ligne `Sitemap:` porte bien l'adresse servie

### AC-3 — Le filtre wilaya ne propose plus de choix vide

**Given** une wilaya dont tous les biens ont `isAvailable: false`
**When** le menu déroulant du filtre est construit
**Then** elle n'y figure pas — la seconde requête filtre comme la première
**And** une wilaya ayant au moins un bien disponible y figure toujours, et le sélectionner renvoie ce bien

### AC-4 — Prouvé par mutation

**Given** chaque garde posée par cette story
**When** on la retire une par une
**Then** un contrôle rougit, et son message désigne la propriété visée

---

## Tasks / Subtasks

- [x] **T1** — Mesurer l'état : artefact de construction, et différentiel construction/exécution
- [x] **T2** — Écrire les tests et les voir rouges
- [x] **T3** — `force-dynamic` dans `app/robots.ts`
- [x] **T4** — `isAvailable: true` dans la requête des wilayas
- [x] **T5** — Étape `robots.txt` dans `scripts/verify-deploy.mjs`
- [x] **T6** — Documenter le piège dormant de `metadataBase` là où il dort
- [x] **T7** — Prouver par mutation, une mutation à la fois
- [x] **T8** — `tsc`, `lint`, `test:e2e`, docs, décomptes recalculés

---

## Dev Notes

### Le test du filtre wilaya n'a pas besoin de session

La vitrine est publique. Le décor se pose par `tests/agence.ts` + `db`, et
la page se lit sans se connecter — comme un visiteur, et comme un robot.
C'est le même choix que `tests/vitrine-pagination.spec.ts` (story 3.4).

### Le contrôle positif porte sur la wilaya voisine

Un test qui vérifie « Oran n'est pas dans le menu » est vert si le menu est
vide, cassé, ou si la page ne s'affiche pas. Le même cas doit donc vérifier
qu'**Alger y est**, et que la choisir renvoie bien son bien (§6).

### References

- `docs/qa/bug-report.md` — `BUG-25`, `BUG-29`
- `app/sitemap.ts` — le même correctif, déjà appliqué, avec son motif
- `scripts/verify-deploy.mjs` — le seul chemin qui attaque la pile réelle
- `docs/stories/deferred-work.md` — `REP-95` (la suite ne passe pas par nginx)
- `CLAUDE.md` §6, §7, §8

---

## Preuves — 17-08-2026

### T1 — le différentiel, avant et après

Même manœuvre dans les deux cas : `NEXTAUTH_URL=http://construction.invalid
npm run build`, puis `NEXTAUTH_URL=http://execution.invalid next start`, et
les deux fichiers lus sur le même serveur au même instant.

```
AVANT
  /robots.txt   →  Sitemap: http://construction.invalid/sitemap.xml
  /sitemap.xml  →  <loc>http://execution.invalid</loc>
  disque        →  .next/server/app/robots.txt.body existe

APRÈS
  /robots.txt   →  Sitemap: http://execution.invalid/sitemap.xml
  /sitemap.xml  →  <loc>http://execution.invalid</loc>
  disque        →  plus aucun robots.txt.body
```

Les deux fichiers voisins se contredisaient. Ils s'accordent.

### T2 — le rouge

```
2 failed, 1 passed
  ✗ une wilaya sans bien disponible n'est pas proposée
        reçu ["Toutes", "Alger", "Oran"]
  ✗ robots.txt est calculé à l'appel, et non figé à la construction
  ✓ le bien retiré n'est ni listé, ni atteignable par le filtre
```

Le troisième cas était vert avant comme après : il documente ce que le menu
promettait — une page vide — et il n'est pas la garde.

Le contrôle positif du premier cas — « Alger » **présent** — est passé
avant l'assertion qui rougit. Sans lui, un menu vide ou une page en erreur
aurait rendu l'absence d'« Oran » vraie sans rien prouver.

### T5 — l'étape ajoutée à `verify:deploy` a d'abord été fausse

Première version : elle comparait la ligne `Sitemap:` à `VERIFY_BASE`. Le
différentiel l'a mise en échec sur une configuration **parfaitement
saine** — on sonde souvent une pile par `http://localhost:8095` alors que
son domaine public est autre chose, et `robots.txt` annonce alors le domaine
public, à juste titre.

```
❌ ÉCHEC — robots.txt annonce le sitemap sur une AUTRE adresse que celle servie.
      annoncé : http://execution.invalid/sitemap.xml
      servi   : http://localhost:3009/sitemap.xml     ← faux positif
```

**Un script qui échoue à tort est un script qu'on cesse de lancer.**
L'invariant juste ne dépend pas de par où l'on sonde : `robots.txt` et
`sitemap.xml` dérivent tous deux du **même** `appUrl()`, donc ils ne peuvent
diverger que si l'un est gelé. La comparaison porte maintenant sur les deux
fichiers **entre eux**.

```
  3. robots.txt et sitemap.xml s'accordent sur http://execution.invalid
     (différent de l'adresse sondée http://localhost:3009 — normal si vous
      sondez la pile par la boucle locale)
```

### T7 — quatre mutations, jouées séparément

| # | Ce qu'on retire | Résultat | Message |
|---|---|:---:|---|
| M1 | `isAvailable: true` de la requête des wilayas | ROUGE | reçu `["Toutes", "Alger", "Oran"]` |
| M2 | `force-dynamic` de `app/robots.ts` | ROUGE | « prérendu pendant `next build` » |
| M3 | idem, **puis reconstruction et service** | ROUGE | `verify:deploy` : « les deux ne parlent pas du même domaine », avec les deux origines |
| M4 | `force-dynamic` de `app/sitemap.ts` | ROUGE | « soit la régression est là, soit le motif de ce test est faux » |

**M4 n'éprouve pas le produit, elle éprouve l'assertion.** `app/sitemap.ts`
porte cette ligne depuis la story 1.3 : c'est le contrôle positif du motif
lui-même. Si l'expression régulière était mal écrite, ce cas rougirait
d'abord, et on ne mettrait pas l'échec du second sur le dos du code.

**M3 est la seule qui exerce le chemin réel.** Elle demande une
reconstruction complète et un service sur un autre environnement — elle ne
peut donc pas entrer dans la suite, et c'est précisément le sujet de cette
story.

### T8 — les contrôles

```
npx tsc --noEmit    0 erreur
npm run lint        0 erreur, 4 avertissements <img> préexistants
npm run test:e2e    176 passed   (173 avant, + 3 ajoutés)
```

### Décomptes recalculés (§7)

```
grep -cE '^  epic-[0-9]+:' docs/stories/sprint-status.yaml            -> 7
grep -cE '^  [0-9]+-[0-9]+[a-z0-9-]*:' docs/stories/sprint-status.yaml -> 62
grep -cE '^### Story ' docs/epics.md                                  -> 62
grep -c '^<a id="bug-' docs/qa/bug-report.md                          -> 38
```

**Aucun ne bouge, et c'est un résultat** : cette story n'a ouvert ni story
ni défaut. Les trois précédentes en ont ouvert une chacune ; celle-ci a
balayé ses deux familles et n'a rien trouvé de plus.

---

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m] — Claude Code, session du 17-08-2026.

### Debug Log References

- Différentiel construction/exécution : `npm run build` puis `next start`
  sur le port 3009, avec deux valeurs distinctes de `NEXTAUTH_URL`, avant et
  après correction. Deux constructions complètes.
- M3 : troisième construction, avec le défaut réintroduit, pour éprouver
  l'étape de `verify:deploy` sur le chemin réel.
- Le port 3002 a été libéré avant la suite finale, pour que
  `reuseExistingServer` ne serve pas une construction antérieure.

### Completion Notes List

1. **Deux défauts, deux natures de preuve.** `BUG-29` se mesure de bout en
   bout ; `BUG-25` est **structurellement invisible** à la suite, qui
   construit et sert avec le même environnement. Les traiter de la même
   façon aurait produit un test vert qui ne dit rien.

2. **La preuve la plus courte était sur le disque.**
   `.next/server/app/robots.txt.body` existait à côté d'un `sitemap` qui
   n'avait que son `route.js`. Deux fichiers voisins, l'un gelé, l'autre
   non — le défaut se lit d'un `ls`.

3. **Ma propre étape de `verify:deploy` était fausse, et le différentiel l'a
   dit avant qu'elle ne serve.** Elle comparait à l'adresse de sonde et
   échouait sur une pile saine. C'est §8 appliqué à un outil de contrôle :
   un garde-fou qui crie à tort est un garde-fou qu'on débranche.

4. **Le balayage n'a rien trouvé de plus, et il fallait le lancer pour le
   savoir.** Une seule autre lecture d'`appUrl()` en contexte prérendu
   (`metadataBase`), **mesurée** : rien n'est gelé aujourd'hui, le produit ne
   déclare aucune adresse relative. Une seule facette bâtie sur une requête.
   La fiche publique d'un bien pose déjà les mêmes conditions que la liste.

5. **Aucun `REP` ouvert, délibérément.** Le piège de `metadataBase` est
   documenté à l'endroit où il dort, pas au registre : inscrire une
   hypothèse non observée gonflerait le décompte d'une affirmation non
   mesurée (§7). Les trois stories précédentes en ont ouvert un chacune —
   celle-ci n'avait rien à ouvrir, et le dire est un résultat.

6. **Ce que la correction n'a pas fermé.** Le menu wilaya reste calculé au
   rendu : un visiteur qui garde la page ouverte pendant que l'agence retire
   son dernier bien d'une wilaya verra encore une liste vide. La fenêtre est
   réduite, pas fermée, et elle n'a pas à l'être — le message posé par la
   story 3.4 traite ce cas.

### Change Log

| Date | Changement |
|---|---|
| 17-08-2026 | Story ouverte, différentiel construction/exécution mesuré avant toute correction |
| 17-08-2026 | `force-dynamic` sur `app/robots.ts`, `isAvailable` sur la requête des wilayas |
| 17-08-2026 | Étape `robots.txt` dans `verify:deploy` — écrite, mise en défaut, réécrite |
| 17-08-2026 | Piège dormant de `metadataBase` documenté sur place, sans `REP` |

### File List

**Créés**
- `tests/vitrine-filtres.spec.ts`
- `docs/stories/3-6-corriger-robots-et-filtre-wilaya.md`

**Modifiés**
- `app/robots.ts`
- `app/vitrine/[slug]/page.tsx`
- `app/layout.tsx`
- `scripts/verify-deploy.mjs`
- `tests/deploiement.spec.ts`
- `docs/qa/bug-report.md`
- `docs/epics.md`
- `docs/stories/sprint-status.yaml`
