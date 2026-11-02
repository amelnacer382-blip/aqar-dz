---
baseline_commit: bb96dc9e00ccf8109c354340ab5fea0a2be7e14c
---

# Story 6.2 : Recueillir l'offre que le visiteur demande

Status: done

**Épopée :** 6 — Vendre ce que le produit tient
**Couvre :** FR-3, FR-4, FR-5 · **Réalise :** UJ-1
**Source :** [`docs/prds/prd-aqar-dz-offres-2026-08-15/prd.md`](../prds/prd-aqar-dz-offres-2026-08-15/prd.md) §4.2
**Découpage :** [`docs/epics.md`](../epics.md) — Epic 6, story 6.2
**Dépend de :** 6.1 — le catalogue doit exister pour être proposé
**Date :** 15 août 2026

---

## Story

**En tant que** visiteur qui s'inscrit,
**je veux** choisir mon offre au moment où je la lis,
**afin de** ne pas la découvrir trois semaines plus tard dans un écran de
paramètres.

---

## La distinction qui porte toute la story

**Offre demandée ≠ offre attribuée.** Deux colonnes, jamais confondues.

| | `plan` | `requestedPlan` |
|---|---|---|
| Ce que c'est | l'offre **attribuée** | l'offre **demandée** |
| Qui l'écrit | le super administrateur (6.3) | le visiteur, au formulaire public |
| Ce qu'elle accorde | les plafonds (6.4) | **rien** |
| À l'inscription | `starter`, toujours | le choix du visiteur |
| Peut être nulle | non | **oui**, et c'est un état légitime |

Le motif tient en une phrase : `/api/auth/register` est **public et non
authentifié**. Si le choix du visiteur atterrissait dans `plan`, n'importe
qui s'attribuerait Enterprise en postant un corps de requête. La demande est
donc stockée ailleurs, et l'écart entre les deux est précisément ce que le
super administrateur arbitre à l'approbation.

---

## Ce qui a été mesuré avant d'écrire

```bash
grep -rn 'href="/auth/register"' --include="*.tsx" app/ components/   # → 5
grep -rn "post(.*api/auth/register" tests/                            # → 6
```

- **5 liens nus** vers `/auth/register` dans l'interface : navbar ×2, héros,
  pied de page, écran de connexion. **Aucun ne change** — arriver sans offre
  reste un parcours normal (FR-3, AC-2). Seule la page tarifaire en porte
  une, et ses trois boutons sortent d'un **unique** site de code
  (`lienInscription(offre.cle)`).
- **6 appels** à `/api/auth/register` dans la suite E2E. **Quatre** attendent
  un `200` et cassaient net en rendant le champ obligatoire ; les deux autres
  postent un corps vide et attendent un refus — inchangées.

```bash
grep -rn "registerSchema" --include="*.ts*" . --exclude-dir=node_modules
```

- **Un seul appelant** : `app/api/auth/register/route.ts:71`. Le schéma de
  `lib/validations` est bien celui qui tourne — la copie locale a été retirée
  en story 1.5.

---

## Acceptance Criteria

**AC-1 (FR-3)** — **Given** un visiteur sur la section tarifaire
**When** il clique le bouton d'appel d'une des trois offres
**Then** le formulaire d'inscription s'ouvre avec **cette** offre
présélectionnée
**And** les trois boutons mènent à trois destinations **distinctes**

**AC-2 (FR-3)** — **Given** une offre absente ou inconnue dans l'URL
**When** le formulaire s'affiche
**Then** aucune offre n'est présélectionnée, et **ce n'est pas une erreur** —
ni page d'erreur, ni redirection, ni message

**AC-3 (FR-4)** — **Given** un visiteur qui n'a choisi aucune offre
**When** il envoie le formulaire
**Then** l'inscription est refusée **par le serveur**, avec un message qui le
dit
**And** aucune agence n'est créée

**AC-4 (FR-4)** — **Given** le formulaire d'inscription
**When** une offre est sélectionnée
**Then** il montre laquelle **et ce qu'elle contient**, pas seulement son nom
**And** le choix reste modifiable, même quand il vient de l'URL

**AC-5 (FR-4)** — **Given** une inscription valide portant une offre demandée
**When** l'écran de confirmation s'affiche
**Then** il **nomme** l'offre et précise qu'elle **n'est pas encore
attribuée**

**AC-6 (FR-5)** — **Given** une inscription portant une offre demandée
**When** elle est enregistrée
**Then** `requestedPlan` porte le choix du visiteur
**And** `plan` vaut `starter`, quel que soit ce choix
**And** un champ `plan` glissé dans le corps de la requête ne change rien

---

## Ce que cette story rend atteignable (`CLAUDE.md` §8)

**« Qu'est-ce que je viens de rendre atteignable ? »** Quatre réponses, dont
une qui a cassé quatre tests avant d'être vue.

1. **Un champ obligatoire de plus sur une route publique casse tous ses
   appelants muets.** `registerSchema` gagne `requestedPlan` requis :
   les **quatre** inscriptions de `regression.spec.ts` qui attendaient un
   `200` seraient tombées en `400`, sur un motif étranger à ce qu'elles
   vérifient — le pire type d'échec, celui qui envoie chercher ailleurs.
   **Corrigé dans la même story** : elles passent `OFFRE_PAR_DEFAUT`, ce qui
   fait coïncider demande et attribution et ne change donc aucune de leurs
   capacités.

2. **`requestedPlan` est nullable, et le restera.** Toute agence créée
   ailleurs qu'au formulaire public — console, graine, `creerAgence()` — n'a
   rien demandé. **La story 6.3 doit afficher « aucune », pas un blanc**, et
   surtout ne doit pas traiter `null` comme une valeur à remplacer par un
   défaut : ce serait inventer un choix du client.

3. **Le visiteur repart en croyant avoir souscrit.** Il coche Pro, il paie
   personne, et rien ne le détrompe. C'est un problème de promesse, pas de
   code : l'écran de confirmation le dit désormais en toutes lettres
   (AC-5), et le formulaire précise qu'aucun paiement n'est demandé.

4. **Les agences des tests deviennent des agences Starter.** Aujourd'hui sans
   conséquence, aucun plafond n'existant. **À l'arrivée de la story 6.4**,
   `regression.spec.ts:1595` crée des dépôts et des comptes sur une agence
   inscrite par cette route : le plafond de 2 utilisateurs de Starter peut
   la faire échouer. **6.4 doit vérifier ce test avant de poser le plafond
   des comptes**, pas après.

---

## Tasks / Subtasks

- [x] **T1 — Le schéma.** `requestedPlan AgencyPlan?` sur `Agency`, mappé
      `requested_plan`, nullable et **sans défaut**.
- [x] **T2 — La migration.** `20260815000001_agency_requested_plan`, écrite,
      et **appliquée le 16-08-2026** par l'éditeur. Relevé d'après dans la
      story 6.1 : colonne `AgencyPlan`, nullable, sans défaut, 0 demande.
- [x] **T3 — Le catalogue.** `PARAM_OFFRE`, `lienInscription()`,
      `offreDuCatalogue()`, `resumeOffre()` dans `lib/offres.ts`.
- [x] **T4 — La page tarifaire.** Les trois boutons portent leur offre.
- [x] **T5 — Le formulaire.** Sélecteur en premier groupe, présélection
      depuis l'URL, ce que l'offre contient, confirmation qui la nomme et la
      dit sous réserve.
- [x] **T6 — La route.** `requestedPlan` stocké, `plan` intouché.
- [x] **T7 — Les appelants cassés.** Les 4 inscriptions de
      `regression.spec.ts` réparées dans la même story.
- [x] **T8 — Les tests.** `tests/offre-demandee.spec.ts`, 5 cas, contrôle
      positif sur le même chemin.
- [x] **T9 — La preuve.** `npm run test:e2e` exécutée le 16-08-2026 :
      **140 passed**. Mutation jouée, 2 rouges attribuables — voir
      « La preuve par mutation ».
- [x] **T10 — Les contrôles.** `npx prisma validate` ✅ · `npx tsc --noEmit`
      ✅ 0 · `npm run lint` ✅ 0 erreur (4 avertissements `no-img-element`
      préexistants) · `test:e2e` ✅ 140 verts.

---

## Le blocage, dit et non contourné (`CLAUDE.md` §13)

| Commande | Pourquoi elle n'a pas été lancée |
|---|---|
| ~~`npm run db:deploy`~~ | `deny` de `.claude/settings.json`. Détourner par `$executeRawUnsafe` aurait été exactement le contournement que §13 interdit. **Levé le 16-08-2026** : l'éditeur l'a lancée |
| ~~`npm run test:e2e`~~ | Démarre le projet (§2). ~~Choix explicite de l'éditeur : « plus tard »~~ **Levé le 16-08-2026** : « lance la suite » |

**Réglé le 16-08-2026.** Les deux migrations se sont appliquées en une
seule commande, dans l'ordre — l'ordre alphabétique des dossiers garantit
que le type `AgencyPlan` existe avant la colonne qui s'en sert. Relevé
d'après dans la story 6.1 : `requested_plan` est `AgencyPlan`, **nullable,
sans défaut**, et **aucune agence ne porte de demande**. C'est bien l'état
voulu — « aucune demande » est un état, pas un trou comblé par un défaut.

~~**Ce qui reste vrai :** les AC-1 à AC-6 sont **mesurés par la compilation,
pas éprouvés par l'exécution**. `npm run test:e2e` n'a pas été jouée.~~

**Soldé le 16-08-2026**, sur accord explicite de l'éditeur : `npm run
test:e2e` → **140 verts, 1,7 min, sortie 0**. Les AC-1 à AC-6 sont éprouvés
par l'exécution, et `tests/offre-demandee.spec.ts` (5 cas) les porte. La
mutation de l'invariant FR-5 — écrire `plan: validated.requestedPlan` au
lieu de `plan: OFFRE_PAR_DEFAUT` — a produit le rouge attendu, et son
message nomme la bonne propriété : « l'offre **DEMANDÉE** est devenue
l'offre **ATTRIBUÉE** ».

---

## Dev Notes

### Le `Suspense`, et pourquoi le formulaire n'a pas été coupé en deux

`useSearchParams()` fait basculer la page en rendu client si elle n'est pas
sous une frontière `Suspense` — et le `build` échoue. Deux issues : couper le
formulaire en un composant serveur qui lit `searchParams` plus un composant
client, ou poser un `Suspense`. **La seconde a été retenue parce que c'est
déjà ce que fait `app/auth/login/page.tsx`**, à la ligne près. Un second
motif dans le même dossier aurait fait diverger deux écrans jumeaux.

### `hasOwnProperty`, et pas `in`

`offreDuCatalogue()` valide contre les clés du catalogue. `"constructor" in
OFFRES` vaut **vrai** : un `in` aurait laissé passer les propriétés héritées
d'`Object`, castées en `AgencyPlan` sans en être. Prisma les aurait rejetées
à l'écriture, mais le refus serait arrivé quatre couches plus bas, sous forme
de `500`.

### Pourquoi le résumé d'offre ne reprend pas les `atouts`

`resumeOffre()` est construit sur les **deux plafonds seulement**. ~~Les
`atouts` vendent des capacités que le produit ne tient pas — « API access »,
« Intégrations custom ». Elles restent affichées (la page tarifaire les
promet déjà, et les retirer est la question ouverte n° 2 du PRD)~~, mais la
ligne qui résume l'offre ne dit que ce que la story 6.4 fera respecter.

*Repris le 16-08-2026 (story 6.6) : « API access » et « Intégrations custom »
ont été **retirées** du catalogue, l'inventaire ayant montré qu'elles ne
désignaient aucune ligne de code. Le motif de `resumeOffre()` n'en est pas
changé — il est même renforcé : les `atouts` restants mêlent des plafonds,
des capacités livrées **à toutes les offres** et des engagements de service.
Seuls les deux nombres sont opposables.*

### Le champ obligatoire, côté serveur d'abord

Le formulaire contrôle aussi que l'offre est choisie — **c'est un confort**,
pas la garde. La garde est `registerSchema`, et c'est elle que le test
éprouve, par un `POST` direct. Un clic n'aurait prouvé que le rendu du
bouton (`CLAUDE.md` §6, piège 4).

### Ce que le test ne peut pas encore prouver

« Aucun contrôle de quota ne lit l'offre demandée » (FR-5) n'est pas
assertable : **aucun contrôle de quota n'existe**. Ce qui est prouvé
aujourd'hui, c'est que `plan` reste `starter` quoi qu'on demande — la seule
forme observable de « la demande n'accorde rien ». L'assertion complète
appartient à la story 6.4, et y est nommée.

---

## La preuve par mutation

Jouée le 16-08-2026. `app/api/auth/register/route.ts` :
`plan: OFFRE_PAR_DEFAUT` → `plan: validated.requestedPlan`. L'import
devenu inutile a été retiré **avec** la garde — sans quoi le lint aurait
fait échouer le build, et le rouge ne serait pas venu du test
(`CLAUDE.md` §6, piège 3).

| Test | Message d'échec |
|---|---|
| *le serveur refuse une inscription sans offre…* | « l'offre DEMANDÉE est devenue l'offre ATTRIBUÉE — une inscription publique s'accorde ce qu'elle veut » |
| *le formulaire enregistre l'offre choisie…* | « le choix du visiteur a été appliqué comme offre attribuée » |

Les deux messages **désignent la propriété visée**, pas une assertion
voisine : FR-5 est bien ce que ces tests éprouvent. Les autres cas du
fichier sont restés verts — la mutation n'a pas débordé.

---

## Dev Agent Record

### Debug Log References

Aucune erreur de compilation cette fois : le champ ajouté est **optionnel en
base** et le seul appelant du schéma est la route, déjà modifiée. Le
compilateur n'avait donc rien à signaler — et c'est précisément pourquoi les
quatre appels cassés de `regression.spec.ts` ont dû être trouvés par un
`grep` et non par `tsc` : ils passent leur corps en JSON libre, que le typage
ne regarde pas.

C'est le seul défaut réel introduit par cette story, et il a été trouvé en
posant la question §8 plutôt qu'en exécutant quoi que ce soit.

### Completion Notes List

**Fait :**
- La distinction demande / attribution est portée par deux colonnes, et
  l'invariant est écrit dans le code au point où on serait tenté de le
  rompre (`app/api/auth/register/route.ts`).
- Les quatre appelants cassés ont été réparés **dans la même story** —
  pas reportés en `REP-nn`, parce que la story les casse elle-même.
- 5 cas de test, dont un contrôle positif sur le même chemin que les deux
  refus, et une vérification qu'un `plan` forgé dans le corps n'attribue
  rien.

**Non fait, et pourquoi :**
- **T9.** Ni `test:e2e`, ni la preuve par mutation. Décision de l'éditeur.
  La story reste `in-progress` ; aucune case de `CLAUDE.md` §9 n'est cochée
  à ce titre.
- ~~Les migrations ne sont pas appliquées.~~ **Appliquées le 16-08-2026**
  par l'éditeur, la commande étant refusée par le `deny`. Relevé conforme.
- **Aucun commit.** Rien n'a été demandé (`CLAUDE.md` §10).

**Laissé ouvert à dessein :**
- L'offre demandée n'est **affichée nulle part dans la console** — c'est la
  story 6.3. Elle est stockée et lisible en base, rien de plus.
- `requestedPlan` reste nul pour toutes les agences existantes, la graine
  comprise. Volontaire (§8, point 2).

### File List

**Nouveaux (2)**
- `prisma/migrations/20260815000001_agency_requested_plan/migration.sql`
- `tests/offre-demandee.spec.ts`

**Modifiés (8)**
- `prisma/schema.prisma`
- `lib/offres.ts`
- `lib/validations/index.ts`
- `components/landing/PricingSection.tsx`
- `app/auth/register/page.tsx`
- `app/api/auth/register/route.ts`
- `tests/regression.spec.ts`
- `docs/stories/sprint-status.yaml`
