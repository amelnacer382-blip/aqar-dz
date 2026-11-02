---
baseline_commit: 692bc4d
---

# Story 6.6 : Ne plus vendre ce que le produit ne fait pas

Status: done

**Épopée :** 6 — Vendre ce que le produit tient
**Couvre :** question ouverte n° 2 du PRD · **Porte :** `REP-100`
**Source :** [`docs/prds/prd-aqar-dz-offres-2026-08-15/prd.md`](../prds/prd-aqar-dz-offres-2026-08-15/prd.md) §5, §8
**Découpage :** [`docs/epics.md`](../epics.md) — Epic 6, story 6.6
**Dépend de :** 6.1 — le catalogue doit être unique pour être corrigé d'un geste
**Date :** 16 août 2026

---

## Story

**En tant que** éditeur d'Aqar DZ,
**je veux** que les arguments affichés sur la page tarifaire correspondent à
ce qui est livré,
**afin qu'** une agence Enterprise ne paie pas 19 900 DA/mois pour une liste
dont elle ne recevra pas la moitié.

---

## Ce qui a été mesuré avant d'écrire — et ce que la mesure a démenti

`REP-100` affirmait : « la page tarifaire vend **six** capacités que le
produit ne tient pas », dont « Statistiques avancées ». **Les dix-neuf
arguments n'avaient jamais été inventoriés** — six avaient été nommés de
mémoire. Ils l'ont été le 16-08-2026, un par un, contre le code.

```bash
grep -oP '^\s+"\K[^"]+(?=",?$)' lib/offres.ts | wc -l     # → 19
ls app/agency/                                            # 19 écrans
find app/api -name route.ts | wc -l                       # → 14
grep -rn "plan" --include="*.ts*" app/agency/ app/vitrine/ \
  | grep -v "quota\|offres\|nomOffre\|plan_bien"          # → 0 verrou
```

**Deux affirmations de `REP-100` sont fausses, et c'est le même défaut que
celui que l'épopée corrige — une promesse non vérifiée, cette fois dans mon
propre constat (`CLAUDE.md` §7).**

### L'inventaire, les dix-neuf

| Argument | Offre | Verdict mesuré |
|---|---|---|
| Jusqu'à 20 biens · 2 utilisateurs | Starter | ✅ **tenu**, story 6.4 |
| Biens illimités · 10 utilisateurs | Pro | ✅ **tenu**, story 6.4 |
| Utilisateurs illimités | Enterprise | ✅ **tenu**, story 6.4 |
| Tout de l'offre Pro | Enterprise | ✅ **vrai par inclusion** des plafonds |
| Vitrine en ligne | Starter | ✅ existe — `app/vitrine`, `app/agency/showcase` |
| Gestion des clients | Starter | ✅ existe — `app/agency/clients` |
| Vitrine personnalisée | Pro | ⚠ **existe, mais Starter l'a aussi** — `slug`, `logo`, `description` dans `app/agency/settings` |
| Gestion locative | Pro | ⚠ **existe, mais Starter l'a aussi** — `app/agency/rentals`, `rental-management` |
| Documents PDF | Pro | ⚠ **existe, mais Starter l'a aussi** — `lib/pdf/` |
| Statistiques avancées | Pro | ⚠ **existe, mais Starter l'a aussi** — `app/agency/statistics`, **425 lignes, 6 graphiques** |
| Support email | Starter | 🤝 engagement de service, hors code |
| Support prioritaire | Pro | 🤝 engagement de service, hors code |
| Formation dédiée · Account manager · SLA garanti | Enterprise | 🤝 engagements de service, hors code |
| **API access** | Enterprise | ❌ **ne désigne rien** |
| **Intégrations custom** | Enterprise | ❌ **ne désigne rien** |

**« Statistiques avancées » existe.** L'écran fait 425 lignes et porte six
graphiques : recettes encaissées par mois, biens par statut, biens par type,
pipeline commercial, retours de visite, ventes conclues. Le constat qui
l'annonçait absente ne l'avait pas ouvert.

**« API access » ne désigne rien.** Les 14 routes de `app/api/` sont toutes
internes — authentification, téléversement, exports, suppressions, santé —
et toutes derrière une session. Aucune n'est documentée, aucune n'est
appelable par une agence. **« Intégrations custom »** ne renvoie à aucun
code.

### Le vrai défaut n'est pas celui que `REP-100` décrivait

Le PRD, lui, l'avait dit juste dès le 15-08 (§5) : *« Aucune fonctionnalité
fermée par offre. Les arguments de vente qui décrivent des capacités ne sont
pas implémentés comme des verrous. »*

**Quatre arguments Pro sont vendus comme des différenciateurs et ne
différencient rien.** Une agence Starter à 2 900 DA dispose aujourd'hui,
exactement comme une agence Pro à 7 900, des statistiques, de la gestion
locative, des documents PDF et de la personnalisation de sa vitrine. Le
mesurage ci-dessus le montre : **zéro verrou par offre en dehors des deux
plafonds numériques.**

C'est l'**inverse** de la divergence que l'épopée a fermée. Là, la page
promettait ce que la base ignorait. Ici, la page **vend comme exclusif ce
que tout le monde a déjà**.

---

## L'arbitrage, et son motif

> **Délégué par l'éditeur le 16-08-2026** — « je te laisse trancher pour
> continuer ». Écrit ici avec son motif : dans six mois, seul le motif
> permettra de le rouvrir (`CLAUDE.md` §13).

**Trois catégories, trois traitements. Ce qui les sépare est une question
unique : *le retirer relève-t-il d'une mesure, ou d'une décision
commerciale ?***

### 1. Retirées — elles ne désignent rien

« API access », « Intégrations custom ».

Aucune route, aucun écran, aucune ligne. **Une mention qu'aucune capacité ne
porte n'est pas un argument de vente, c'est une facture pour du vide.** Leur
retrait ne coûte aucune décision : il enregistre une mesure.

### 2. Gardées — elles existent, et les fermer est une décision à coût réel

« Vitrine personnalisée », « Gestion locative », « Documents PDF »,
« Statistiques avancées ».

Elles sont livrées. Le défaut n'est pas qu'elles manquent — c'est qu'elles
ne distinguent pas Pro de Starter. **Les fermer par offre retirerait à des
agences Starter des écrans qu'elles utilisent déjà aujourd'hui.** Ce n'est
plus corriger une promesse, c'est reprendre une capacité livrée à des
clients en cours. Cela ne se décide pas dans une story technique, et
sûrement pas par moi. → **`REP-101`**, porté par une story **6.7** ouverte
pour l'occasion (§1 : un constat sans story n'existe pas).

### 3. Gardés — ils ne sont pas du code

« Support email », « Support prioritaire », « Formation dédiée »,
« Account manager », « SLA garanti ».

Ce sont des engagements humains. Je ne peux **ni les vérifier ni les
infirmer** depuis le dépôt, et les retirer reviendrait à décider à la place
de l'éditeur qu'il ne les honore pas. Un `grep` ne dit rien de la présence
d'un chargé de compte. **Ne pas savoir n'autorise pas à trancher** (§7 :
si vous n'avez pas pu mesurer, dites que vous n'avez pas pu).

---

## Ce que cette story rend atteignable (`CLAUDE.md` §8)

1. **La proposition de valeur d'Enterprise devient visiblement mince.** Sa
   liste passe de 7 à 5. Une fois les deux mentions creuses retirées, ce qui
   sépare Enterprise (19 900) de Pro (7 900) est : **les utilisateurs
   illimités, et trois engagements de service**. C'est peu pour 2,5 fois le
   prix. **Ce n'est pas une raison de garder une mention fausse** — c'est
   une raison pour l'éditeur d'agir, et le rendre visible est précisément
   l'utilité de ce retrait.

2. **Le retrait ferme la porte par laquelle le défaut est entré.** Rien
   n'empêchait d'ajouter un argument non tenu : ni `tsc`, ni le lint, ni la
   suite — `tests/offres.spec.ts` parcourt `atouts` et vérifie seulement que
   ce qui est écrit est **affiché**, jamais que c'est **vrai**. Un inventaire
   daté (`ARGUMENTS_REVUS`) rend désormais rouge tout argument ajouté sans
   passer par la revue. Il ne prouve pas qu'une capacité existe — c'est
   invérifiable par un test — il prouve qu'aucun argument n'est entré **sans
   décision**.

3. **Quatre commentaires du dépôt affirment que « Statistiques avancées »
   n'existe pas.** `lib/offres.ts` ×2, et les stories 6.1, 6.2, 6.4 closes.
   Les laisser, c'est laisser un piège : quelqu'un les lira comme une mesure.
   Corrigés — **barrés dans les stories closes, réécrits dans le code.**

4. **Rien ne casse côté test.** `tests/offres.spec.ts` lit `CATALOGUE` :
   retirer deux entrées réduit le nombre d'assertions sans en invalider
   aucune. C'est exactement ce que l'AC-3 met en garde — la couverture ne
   doit pas s'affaiblir *parce que* la liste rétrécit. D'où l'inventaire, qui
   ajoute une contrainte au lieu d'en retirer une.

---

## Acceptance Criteria

**AC-1** — **Given** un argument affiché sur la page tarifaire
**When** on cherche la capacité correspondante dans le produit
**Then** elle existe, ou l'argument a été retiré, ou c'est un **engagement de
service** explicitement reconnu comme tel dans l'inventaire

**AC-2** — **Given** l'arbitrage rendu
**When** il est appliqué
**Then** son **motif** est écrit dans la story, catégorie par catégorie

**AC-3** — **Given** la section tarifaire
**When** le test la parcourt
**Then** il vérifie toujours que **chaque** argument du catalogue est affiché
— la story ne doit pas affaiblir la couverture en réduisant la liste

**AC-4** — **Given** un argument ajouté au catalogue sans passer par la revue
**When** la suite tourne
**Then** elle **échoue**, et le message dit lequel

---

## Tasks / Subtasks

- [x] **T1 — L'inventaire.** `ARGUMENTS_REVUS` dans `lib/offres.ts` : les 17
      arguments, chacun avec la façon dont il est tenu (`plafond`, `livre`,
      `service`).
- [x] **T2 — Le retrait.** « API access » et « Intégrations custom » sortent
      du catalogue. Enterprise passe de 7 à 5 arguments.
- [x] **T3 — Les commentaires faux.** `lib/offres.ts` ×2 réécrits ; stories
      6.1, 6.2, 6.4 barrées et corrigées — elles affirmaient toutes les trois
      que « Statistiques avancées » n'existe pas.
- [x] **T4 — `REP-100` corrigé, `REP-101` ouvert**, story **6.7** ouverte
      dans `docs/epics.md` et inscrite au `sprint-status.yaml`.
- [x] **T5 — Le test.** AC-4 : un cas dans `tests/offres.spec.ts`, dans les
      **deux sens** — argument non inventorié, et entrée d'inventaire que
      plus personne n'affiche — avec un contrôle positif sur l'inventaire
      lui-même (deux listes vides passeraient sans rien garder).
- [x] **T6 — La preuve par mutation.** Deux mutations, **une par sens**, jouées
      séparément. Voir ci-dessous.
- [x] **T7 — Les contrôles.** `npx prisma validate` ✅ · `npx tsc --noEmit`
      ✅ 0 · `npm run lint` ✅ 0 erreur · `npm run test:e2e` ✅ **141 passed
      (1,8 min), sortie 0**.

---

## La preuve par mutation

> **Accord §2 donné par l'éditeur le 16-08-2026** — « lance la suite et
> commite ». La suite complète : **141 passed** (140 + le cas ajouté),
> 1,8 min, sortie 0.

**Les deux sens de l'AC-4 ont été mutés séparément.** Une seule mutation
couvrant les deux assertions aurait donné un rouge dont on n'aurait pas su
lequel des deux verrous il éprouve — l'erreur commise en story 6.3, et pas
deux fois.

| Mutation | Rouge | Message d'échec |
|---|---|---|
| « API access » **remis** aux `atouts` d'Enterprise, sans entrée d'inventaire | ✅ | *argument(s) affiché(s) sur la page tarifaire sans figurer dans `ARGUMENTS_REVUS` — la capacité correspondante a-t-elle été vérifiée ? : **API access*** |
| « Hotline 24/7 » **ajoutée à l'inventaire**, affichée par aucune offre | ✅ | *entrée(s) d'inventaire que plus aucune offre n'affiche — vestige à retirer : **Hotline 24/7*** |

La première mutation est la plus fidèle possible : ce n'est pas une chaîne
inventée pour l'occasion, **c'est la mention même que la story retire**. Le
test rougit sur le défaut réel, pas sur une imitation.

**Rétabli, et retour au vert vérifié** — `npm run test:e2e -- tests/offres.spec.ts`
→ 4 passed, sortie 0. Un tableau de mutation se lit, il ne se remplit pas
(`CLAUDE.md` §8).

### Ce que la mutation a trouvé en plus, et qui n'était pas cherché

La première mutation a d'abord été lancée par `npx playwright test
tests/offres.spec.ts` — **20 cas au lieu de 4, et 11 échecs**. Neuf d'entre
eux n'avaient rien à voir avec la mutation :

```
Error: browserType.launch: Executable doesn't exist at
  /home/ouazene/.cache/ms-playwright/firefox-1522/firefox/firefox
```

`playwright.config.ts` déclare **cinq** projets ; `npm run test:e2e` fixe
`--project=chromium` et n'en joue **qu'un** ; **trois binaires ne sont pas
installés**. La configuration fabrique donc, pour qui rejoue un seul fichier
à la main, exactement le **rouge inattribuable** que §6 interdit. Et les
projets `Mobile Chrome` / `Mobile Safari`, qui existent pour la vérification
du responsive exigée par la règle 10, **ne tournent jamais**.

Hors périmètre de cette story → **`REP-102`**, rattaché à la story **4.7**
qui refond déjà le harnais. **La mutation a été rejouée par
`npm run test:e2e`**, pour que la mesure porte sur ce que la suite joue
réellement.

---

## File List

| Fichier | Nature |
|---|---|
| `lib/offres.ts` | modifié — `ARGUMENTS_REVUS`, type `Tenue`, 2 arguments retirés, 2 commentaires réécrits |
| `tests/offres.spec.ts` | modifié — 1 cas ajouté (AC-4), import de `ARGUMENTS_REVUS` |
| `docs/stories/6-6-ne-plus-vendre-ce-qui-n-existe-pas.md` | créé |
| `docs/stories/6-1-poser-le-catalogue-des-offres.md` | modifié — affirmation fausse barrée et corrigée |
| `docs/stories/6-2-recueillir-l-offre-demandee.md` | modifié — idem |
| `docs/stories/6-4-faire-tenir-les-plafonds.md` | modifié — idem, + « Non fait : T7 » périmé |
| `docs/stories/deferred-work.md` | modifié — `REP-100` corrigé et résolu, `REP-101` ouvert, table en tête |
| `docs/epics.md` | modifié — story 6.6 corrigée, story 6.7 ouverte |
| `docs/stories/sprint-status.yaml` | modifié — 6.6 `done`, 6.7 `backlog` |

## Constats versés hors périmètre

| | |
|---|---|
| `REP-101` → story **6.7** | Aucune capacité n'est réservée à l'offre qui la vend |
| `REP-102` → story **4.7** | 5 navigateurs déclarés, 1 joué, 3 non installés |
