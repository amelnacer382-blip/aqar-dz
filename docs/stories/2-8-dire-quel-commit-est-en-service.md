---
baseline_commit: 4e529b0
---

# Story 2.8 : Dire quel commit est en service

Status: done *(17-08-2026 — **T13 faite par l'éditeur le jour même, et
mesurée en service.** `REP-96` est fermé.)*

**Épopée :** 2 — Durcir le déploiement
**Couvre :** `REP-96` *(rétréci par la story 2.6, pas soldé)*
**Ouverte le :** 17-08-2026
**Risque :** 🔵 — fait perdre du temps, pas des connexions

> **Note de séquence, écrite parce que `CLAUDE.md` §1 le demande.** La story
> 2.7 est encore `in-progress` : ses tâches T2 et T8 appartiennent à
> l'éditeur. La règle « ne créer la suivante qu'une fois la précédente
> `done` » n'est donc pas tenue au sens strict, et l'éditeur l'a levée
> explicitement (« vas-y pour la 2.8 », 17-08-2026). Le motif de la règle —
> verser dans la story suivante ce qu'on vient d'apprendre — est préservé :
> la 2.7 vient d'être développée, et ses acquis sont repris ci-dessous
> (§ *Ce que la 2.7 lègue à celle-ci*).

---

## Story

As a **exploitant**,
I want **que le produit dise de quelle version du dépôt il est issu**,
So that **une vérification cesse de conclure à des régressions qui n'existent pas.**

---

## Le constat, et pourquoi il n'est pas théorique

Le 15-08-2026, l'image en service datait du **09-08** et accusait
**67 commits** de retard :

```bash
git log --since="2026-08-09 12:33" --oneline | wc -l   # → 67
```

Elle portait donc encore BUG-33, fermé dans la branche le 12-08. **Le coût
a été mesuré, et il n'a pas été théorique** : la vérification a d'abord
conclu à une régression de sécurité qui n'existait pas, et il a fallu
*dater l'image* pour l'écarter. Du temps perdu à chercher un défaut absent.

### Ce que la story 2.6 a fermé, et ce qu'elle a laissé ouvert

La 2.6 a donné à `/api/public/health` de quoi comparer **les migrations que
l'image embarque à celles que la base a appliquées**, dans les deux sens, et
de nommer celles en écart (`lib/migrations.ts`). C'est en service et mesuré :

```
{"status":"ok","database":"up","schema":"a-jour"}
```

Cela ferme **ce qui casse l'authentification** — la forme de BUG-37, où plus
personne n'entrait.

**Cela ne dit toujours pas quel commit tourne.** Une image en retard dont
*aucune migration n'a bougé* passe intégralement dessous — et c'est
exactement le cas du 15-08 : 67 commits de retard, aucun changement de
schéma, et la sonde d'aujourd'hui l'aurait déclarée `a-jour`.

Marquer `REP-96` « résolu » à la fin de la 2.6 aurait été le mensonge le
plus commode de la journée. Il a été **rétréci** (🟠 → 🔵) et rattaché ici.

---

## Ce que la 2.7 lègue à celle-ci

Trois acquis, tous applicables :

1. **Une mesure sur un jetable vaut mieux qu'une lecture.** La 2.7 a prouvé
   `down -v` sur un projet Compose jetable plutôt qu'en raisonnant sur la
   documentation. Même méthode ici : les deux hypothèses Docker de cette
   story sont **mesurées sur une image jetable** avant d'être écrites
   (AC-1, § *Mesures préalables*).
2. **`§7` vaut aussi pour un risque.** Un danger qu'on n'a pas mesuré
   s'annonce trop grand. La 2.7 en a fait les frais.
3. **Une tâche qui exige de reconstruire l'image en service appartient à
   l'éditeur** (`CLAUDE.md` §2). Elle est nommée, pas cochée, et la story
   reste `in-progress` tant qu'elle est ouverte (§9).

---

## Mesures préalables — 17-08-2026

Deux hypothèses Docker fondent la conception. Elles ont été **mesurées**
avant d'écrire une ligne, sur une image jetable bâtie sur `alpine`, sans
toucher au projet (`CLAUDE.md` §7 : « une hypothèse sur une bibliothèque se
mesure »). Le Dockerfile jetable :

```dockerfile
FROM alpine
ARG COMMIT_SHA=""
ENV COMMIT_SHA=$COMMIT_SHA
RUN printf '%s' "$COMMIT_SHA" > /.commit
CMD sh -c 'echo "ENV=[$COMMIT_SHA] FICHIER=[$(cat /.commit)]"'
```

| # | Ce qui est mesuré | Résultat |
|---|---|---|
| A | `--build-arg COMMIT_SHA=abc1234` | `ENV=[abc1234] FICHIER=[abc1234]` |
| B | **aucun** `--build-arg` | `ENV=[] FICHIER=[]` — vide, pas d'échec |
| C | `docker run -e COMMIT_SHA=valeur-venue-du-.env` | **`ENV=[valeur-venue-du-.env] FICHIER=[abc1234]`** |

**C est la mesure qui tranche la conception.** `docker-compose.prod.yml:157`
charge `.env` dans le conteneur applicatif (`env_file: - .env`), et un
`env_file` pose exactement les variables que `-e` pose. Une `ENV COMMIT_SHA`
gravée dans l'image serait donc **écrasée** par une variable homonyme
arrivant de `.env` : la sonde annoncerait un commit qui n'est pas celui de
l'image. C'est précisément la classe de défaut que `CLAUDE.md` §7 traite
comme un bug — une affirmation que le code ne tient pas.

**Un fichier écrit dans l'image ne peut pas être écrasé par
l'environnement.** C'est pour cela que le SHA sera gravé dans un fichier, et
non dans une variable. Le dépôt a déjà ce motif : `prisma/migrations` est un
fait de l'image, recopié par le Dockerfile et lu par `lib/migrations.ts`.

**B dit l'autre moitié** : sans `--build-arg`, la construction n'échoue pas,
elle produit une valeur **vide**. C'est pour cela que `inconnu` doit être
fabriqué côté code (AC-2) — Docker ne le fournira jamais.

---

## Acceptance Criteria

### AC-1 — L'image porte le commit dont elle est issue

**Given** l'image de production, qui ne contient pas `.git` (`.dockerignore`
l'exclut explicitement)
**When** elle est construite
**Then** le SHA lui est **injecté en `ARG`** par `docker-compose.prod.yml`, et
gravé dans un **fichier** de l'image
**And** le choix du fichier plutôt que d'une variable d'environnement est
justifié par la mesure C ci-dessus, écrite dans le code à côté de la ligne
qu'elle fonde

### AC-2 — La sonde rend le commit, et dit `inconnu` plutôt que de se taire

**Given** `/api/public/health`
**When** elle répond
**Then** elle rend un champ `commit` **aux côtés de `schema`**
**And** ce champ vaut `"inconnu"` — explicitement, jamais omis — quand le SHA
est absent, vide, ou d'une forme qui n'est pas celle d'un commit

> **Pourquoi `inconnu` et non un champ absent.** Un champ manquant se lit
> comme « ce produit est trop ancien pour le dire », ce qui est indiscernable
> de « ce produit ne sait pas d'où il vient ». Les deux appellent des gestes
> différents. La sonde de la 2.6 a déjà tranché dans ce sens avec
> `schema: "incomparable"` : une comparaison impossible ne doit jamais se
> lire comme une comparaison réussie.

**And** le champ est rendu **sur les réponses 503 aussi**, pas seulement sur
le succès

> **Extension délibérée de l'AC d'origine, qui disait « aux côtés de
> `schema` ».** C'est en panne qu'on a besoin de savoir quelle image tourne :
> une réponse `image-en-retard` sans le commit laisse l'exploitant devant la
> même question qu'en 2026-08-15. Le coût est nul — la lecture ne touche pas
> la base, elle reste donc possible quand la base est `down`.

### AC-3 — `verify:deploy` compare, nomme les deux, et n'échoue pas

**Given** `npm run verify:deploy`, qui interroge déjà la sonde
**When** le SHA servi diffère de `git rev-parse HEAD`
**Then** il le **signale en nommant les deux**
**And** il **n'échoue pas** — une image plus ancienne que la branche courante
est un état normal en cours de travail
**And** quand `git` est indisponible (serveur sans le dépôt), il le dit et
poursuit, au lieu de lever

### AC-4 — Les deux états sont éprouvés sur le produit SERVI

**Given** que `tests/deploiement.spec.ts` ne sait aujourd'hui que **lire des
fichiers** — faiblesse assumée et écrite en tête du fichier
**When** la suite tourne
**Then** deux cas interrogent la **sonde réelle** : `commit` vaut `inconnu`
sans fichier, et vaut le SHA que le fichier porte quand il est là
**And** le nettoyage passe par `afterEach`, **jamais** par `finally`
(`CLAUDE.md` §6)

> C'est le seul endroit de cette story où l'on éprouve autre chose qu'un
> fichier sur le disque. Il compte double.

### AC-5 — Un invariant statique garde le câblage

**Given** que le câblage `ARG` → fichier vit dans le `Dockerfile` et le
`docker-compose.prod.yml`, qu'aucun test de la suite ne construit
**When** la suite tourne
**Then** elle vérifie que l'étage `production` grave bien le SHA, et que
`docker-compose.prod.yml` passe bien l'`ARG` au service `frontend`
**And** le message d'échec dit la **conséquence** — « la sonde répondra
`inconnu` en permanence » — et pas seulement « motif introuvable »

### AC-6 — Le dépôt ne se contredit plus

**Given** que `README.md` et `docs/architecture.md` documentent la sonde et
la commande de déploiement
**When** la story est close
**Then** la commande documentée **porte le SHA**, et l'exemple de réponse de
la sonde montre le champ `commit`
**And** aucune ligne ne prétend que la sonde dit la version alors qu'elle ne
le dit qu'après reconstruction

### AC-7 — L'image en service porte réellement son commit *(éditeur)*

**Given** que la reconstruction de l'image en service relève de
`CLAUDE.md` §2
**When** l'éditeur reconstruit
**Then** `curl -s localhost:8095/api/public/health` rend le SHA de `HEAD`
**And** `npm run verify:deploy` ne signale plus d'écart

---

## Tasks / Subtasks

- [x] **T1** — `lib/version.ts` : `commitServi()`, lecture du fichier, forme
      validée, `inconnu` en repli. *(AC-2)*
- [x] **T2** — `/api/public/health` rend `commit` sur ses **six** sorties.
      *(AC-2)* — *le libellé disait « quatre » à la rédaction : recompté sur
      le fichier, il y a six `NextResponse.json` (5 × 503, 1 × 200), toutes
      couvertes.*
- [x] **T3** — `docker/Dockerfile`, étage `production` : `ARG` + gravure dans
      un fichier, placée le plus tard possible. *(AC-1)*
- [x] **T4** — `docker-compose.prod.yml` : passer `COMMIT_SHA` en
      `build.args` au service `frontend`. *(AC-1)*
- [x] **T5** — `.gitignore` et `.dockerignore` : le marqueur local ne part ni
      dans le dépôt, ni dans un contexte de build. *(AC-4)*
- [x] **T6** — `scripts/verify-deploy.mjs` : comparer, nommer les deux, ne
      pas échouer, survivre à l'absence de `git`. *(AC-3)*
- [x] **T7** — Deux cas sur la sonde servie, `afterEach` pour le nettoyage.
      *(AC-4)*
- [x] **T8** — Deux invariants statiques, messages orientés conséquence.
      *(AC-5)*
- [x] **T9** — **Mutation** : casser chaque garde ajoutée, constater le
      rouge, **lire le message**, rétablir. *(§6, §9)* — cinq mutations,
      jouées séparément.
- [x] **T10** — `README.md` et `docs/architecture.md`. *(AC-6)*
- [x] **T11** — `deferred-work.md` (REP-96), `epics.md`, `sprint-status.yaml`.
- [x] **T12** — Contrôles `CLAUDE.md` §9 : `tsc`, `lint`, `test:e2e`.
- [x] **T13** — **[ÉDITEUR]** Reconstruire l'image avec le SHA et constater
      en service. *(AC-7 — `CLAUDE.md` §2)* — **faite le 17-08-2026 par
      l'éditeur.**

---

## Dev Notes

### Ce qui doit être écrit, exactement

**`lib/version.ts`** — un module sans dépendance sur Prisma. C'est ce qui
permet de rendre le commit **même quand la base est `down`** (AC-2).

```ts
export function commitServi(): string
```

- Lit `join(process.cwd(), ".commit")`. Même repère que
  `lib/migrations.ts`, qui lit `join(process.cwd(), "prisma", "migrations")`.
- **Ne met pas en cache**, et c'est un arbitrage à écrire. `lib/migrations.ts`
  cache, avec le motif « le dossier est figé dans l'image ». Le même motif
  vaudrait ici — mais un cache rendrait les deux états (fichier présent /
  absent) **inobservables dans un même processus**, ce qui coûterait
  exactement la preuve de l'AC-4, la seule qui porte sur le produit servi. Un
  fichier de 40 octets relu toutes les 30 s ne se compare pas à ce coût-là.
- **Valide la forme** — `/^[0-9a-f]{7,40}$/`. Deux raisons : cette route est
  **publique**, et un `COMMIT_SHA` mal posé y verserait un texte arbitraire
  de longueur non bornée ; et une valeur qui n'est pas un commit *n'est pas*
  un commit. Le repli est `inconnu`, avec un `console.error` — car là,
  contrairement au fichier absent, quelqu'un s'est trompé.

**Le fichier gravé** s'appelle `.commit`, à la racine de l'application.

### Trois choses à ne surtout pas faire

1. **Ne pas lire `.git`.** `.dockerignore` l'exclut du contexte de build — la
   ligne existe, elle est motivée (taille du contexte, et un `.env` qui ne
   doit jamais entrer dans une couche). Un `git rev-parse` à l'exécution
   échouerait dans le conteneur, et « échouerait » se lirait comme
   « inconnu », c'est-à-dire comme un déploiement mal fait.
2. **Ne pas passer par une variable d'environnement.** Mesure C. `.env` est
   chargé dans le conteneur et gagnerait.
3. **Ne pas faire échouer la sonde sur un commit inconnu.** Un `503` sur
   `inconnu` déclarerait la pile morte pour une raison qui ne l'empêche pas
   de servir — et casserait toute installation construite sans l'`ARG`, y
   compris celles d'aujourd'hui. Le risque est 🔵, la réponse doit l'être.

### L'ordre des lignes dans le Dockerfile compte

`ARG` invalide le cache de construction à partir de sa déclaration, et
`COMMIT_SHA` change **à chaque déploiement**. Déclaré en tête de l'étage
`production`, il ferait rejouer toutes les `COPY` à chaque fois. Il va donc
**le plus tard possible** — après les recopies, avant `USER nextjs`.

La gravure doit rester **au-dessus de `USER nextjs`** : le fichier est écrit
par root en `644`, donc lisible par `nextjs`, qui n'a aucun besoin d'y écrire.

### Ce que cette story rend atteignable — `CLAUDE.md` §8

*« À chaque correctif : qu'est-ce que je viens de rendre atteignable ? »*

- **Une route publique rend une donnée de plus.** Le SHA du commit servi
  révèle la version exacte du produit à quiconque interroge la sonde. C'est
  un renseignement utile à un attaquant qui chercherait une version connue
  vulnérable. **Arbitrage, à écrire dans le code** : la 2.6 a déjà tranché
  dans le même sens en rendant les **noms** des migrations, avec le motif
  « un exploitant devant un déploiement cassé a besoin du nom pour agir ».
  Le dépôt n'est pas public à ce jour ; si l'arbitrage change, la réduction
  à un préfixe court tient en une ligne, et les deux se ferment ensemble.
- **Un fichier de plus dans le contexte de build.** Le marqueur local écrit
  par les tests (AC-4) doit être exclu de `.gitignore` **et** de
  `.dockerignore`, sans quoi un `.commit` traînant sur le poste partirait
  dans le contexte — sans conséquence puisque l'étage `production` le
  réécrit, mais on ne laisse pas traîner un fichier qui ment.
- **Un test qui écrit à la racine du dépôt.** Il tourne en parallèle
  d'`api-acces.spec.ts`, qui interroge la même sonde. Vérifié : ce fichier
  n'assert que le **code 200**, jamais le corps — les deux cohabitent. Les
  deux cas de l'AC-4 doivent en revanche être **sérialisés entre eux**.

### Hors périmètre, explicitement

- **Afficher le commit dans un écran.** `REP-96` disait « et l'afficher
  quelque part ». La sonde et `verify:deploy` répondent au besoin *mesuré* —
  celui d'une vérification qui conclut à tort. Un écran est une décision
  produit, pas un correctif ; s'il est voulu, il s'ouvre en story.
- **La date de construction.** Le SHA suffit à trancher la question posée.
- **Le rapprochement automatique image / dépôt au démarrage.** `verify:deploy`
  est lancé à la main, dans la procédure de déploiement — même arbitrage que
  la story 5.14, et même faiblesse assumée.

### Project Structure Notes

| Fichier | Nature |
|---|---|
| `lib/version.ts` | **nouveau** |
| `app/api/public/health/route.ts` | mise à jour — 4 sorties |
| `docker/Dockerfile` | mise à jour — étage `production` |
| `docker-compose.prod.yml` | mise à jour — `build.args` du `frontend` |
| `scripts/verify-deploy.mjs` | mise à jour — étape de comparaison |
| `tests/deploiement.spec.ts` | mise à jour — 2 cas servis + 2 statiques |
| `.gitignore`, `.dockerignore` | mise à jour — `.commit` |
| `README.md`, `docs/architecture.md` | mise à jour |

### References

- `docs/stories/deferred-work.md` — `REP-96`
- `docs/epics.md` — Story 2.8
- `app/api/public/health/route.ts`, `lib/migrations.ts` — story 2.6
- `docker-compose.prod.yml:157` — `env_file: - .env`, la raison de la mesure C
- `.dockerignore` — `.git` exclu du contexte
- `CLAUDE.md` §2 (ne rien démarrer), §6 (tests), §7 (mesurer), §8
  (qu'ai-je rendu atteignable), §9 (terminé)

---

## Preuves — 17-08-2026

### T7 — les trois états, relevés sur la sonde SERVIE

Un même processus, trois réponses. C'est ce qui prouve **l'absence de
cache** — un cache aurait figé la première pour toujours :

```
sans marqueur       {"status":"ok",…,"schema":"a-jour","commit":"inconnu"}
marqueur = HEAD     {"status":"ok",…,"commit":"e8b3df176ad4eece43ff90022d3c6cdf43431cc2"}
marqueur invalide   {"status":"ok",…,"commit":"inconnu"}
  (contenu « ceci-n-est-pas-un-commit » — la forme est refusée, et un
   console.error le dit : là, quelqu'un s'est trompé)
```

### T6 / AC-3 — les trois branches de `verify:deploy`

```
1. image sans COMMIT_SHA
   2. commit servi : inconnu. L'image a ete construite sans COMMIT_SHA.
      Reconstruisez avec « COMMIT_SHA=$(git rev-parse HEAD) … ».

2. écart de version (marqueur posé sur HEAD~5)
   2. ⚠ ÉCART DE VERSION (5 commit(s) d'écart)
        servi : d4eda2bf70e81f86c9eb909119b7438c0add6033
        HEAD  : e8b3df176ad4eece43ff90022d3c6cdf43431cc2
        Ce n'est pas un échec : servir une image plus ancienne que la
        branche est normal en cours de travail.
   3. fiche publique : /vitrine/agence-demo/biens/cmsusn5y0000pjyqv4jtzbtbd
   4. identifiant d'action relevé : $ACTION_ID_c89c7ab629abb…
      ↑ LE SCRIPT A POURSUIVI. C'est la moitié de l'AC-3, et elle ne se
        lit pas dans le code : elle se constate.

3. identique à HEAD
   2. commit servi : e8b3df17… — identique à HEAD
```

C'est le scénario de `REP-96` reproduit en miniature : 5 commits d'écart,
**aucun changement de schéma**, `schema` dit `a-jour` — et c'est désormais la
ligne 2 qui le rattrape. En août, c'était 67 commits, et rien ne le disait.

### T9 — cinq mutations, jouées séparément

| # | Ce qui est cassé | Ce que la suite a dit |
|---|---|---|
| M1 | `commitServi()` rend toujours `inconnu` | *« le marqueur est present et la sonde ne le rend pas… ou le met en cache »* — attendu le SHA, reçu `inconnu` |
| M2 | champ `commit` retiré de la réponse saine | *« la sonde n'expose plus de champ `commit` »* — reçu `["status","database","schema"]` |
| M3 | `ARG COMMIT_SHA` retiré du Dockerfile | *« le SHA n'a plus aucun moyen d'entrer dans l'image »* |
| M4 | `COMMIT_SHA` retiré de `build.args` | *« l'ARG gardera sa valeur par defaut (vide) »* |
| M5 | gravure déplacée **après** `USER nextjs` | *« nextjs ne peut pas ecrire a la racine de /app »* |

**M1 mérite d'être lue en entier.** Sous cette mutation, le cas *« sans
marqueur »* est **resté vert** — une fonction qui répond toujours `inconnu`
satisfait parfaitement le cas négatif. C'est exactement le contrôle positif
de `CLAUDE.md` §6, et sans lui la story se serait crue prouvée.

### Un défaut trouvé par la mutation, dans le test lui-même

La première version de l'assertion d'ordre (M5) a échoué **sur un Dockerfile
correct** : `indexOf("USER nextjs")` trouvait ces mots dans le *commentaire*
qui explique pourquoi la gravure doit les précéder. Les commentaires de ce
dépôt citent les instructions qu'ils motivent — un test qui lit un fichier
doit donc ne juger que ses **instructions**. Les lignes commençant par `#`
sont désormais retirées avant comparaison, et le motif est écrit sur place.

### T12 — les contrôles

```
npx tsc --noEmit     0 erreur
npm run lint         0 erreur (4 avertissements préexistants, <img>)
npm run test:e2e     147 passed  (143 avant, plus les 4 cas ajoutés)
```

---

### T13 / AC-7 — en service, mesuré le 17-08-2026

Reconstruction faite par l'éditeur (`CLAUDE.md` §2). La trace de
construction porte la preuve que l'`ARG` a traversé Compose, le Dockerfile
et la gravure :

```
[frontend production 9/9] RUN printf '%s' \
  "493f2194ad10c65449a872ab05a781151980436c" > ./.commit
```

Et la sonde en service le rend :

```
$ curl -s localhost:8095/api/public/health
{"status":"ok","database":"up","schema":"a-jour",
 "commit":"493f2194ad10c65449a872ab05a781151980436c"}

$ npm run verify:deploy
  2. commit servi : 493f2194ad10c65449a872ab05a781151980436c — identique à HEAD
  …
  6. épreuve d'échec sur agent@aqar.dz → 302 → …?error=CredentialsSignin
  ✅
```

Le SHA gravé est **exactement** `git rev-parse HEAD` au moment de la
construction, et `verify:deploy` va jusqu'au chemin authentifié.

**`REP-96` est fermé.** Il aura vécu du 15-08 au 17-08-2026, dont deux jours
en 🟠 après avoir décrit BUG-37 onze jours avant qu'il ne survienne.

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — `claude-opus-5[1m]`

### Debug Log References

- Mesures Docker préalables : image jetable sur `alpine`, trois cas (A, B,
  C). Images et Dockerfile supprimés après mesure.
- Trois états de la sonde relevés au `curl` sur `:3002`, produit servi.
- `verify:deploy` joué sur ses trois branches contre `:3002`.
- Cinq mutations, chacune suivie d'un retour au vert.

### Completion Notes List

1. **La conception ne vient pas d'une lecture, elle vient d'une mesure.**
   L'hypothèse naturelle était `ENV COMMIT_SHA`. La mesure C l'a écartée :
   `env_file: - .env` écrase une `ENV` gravée dans l'image, et la sonde
   aurait annoncé un commit qui n'est pas le sien — la classe de défaut de
   §7 exactement. Un fichier ne peut pas être écrasé par l'environnement.
2. **Le champ est rendu sur les 503 aussi**, au-delà de l'AC d'origine qui
   disait « aux côtés de `schema` ». C'est en panne qu'on a besoin de savoir
   quelle image tourne, et la lecture ne dépend pas de la base — elle reste
   donc possible quand celle-ci est `down`.
3. **`lib/version.ts` ne met délibérément pas en cache**, contrairement à
   `lib/migrations.ts` qui le fait avec un motif valable. Le cache aurait
   rendu les deux états inobservables dans un même processus, donc
   inéprouvables sur le produit servi — ce qui aurait coûté la seule preuve
   de cette story qui ne lise pas un fichier sur le disque.
4. **La forme du SHA est validée** parce que la route est publique : un
   `COMMIT_SHA` mal posé y verserait un texte arbitraire non borné. Repli
   `inconnu`, plus un `console.error` — là, contrairement au marqueur
   absent, quelqu'un s'est trompé.
5. **Ce que cette story rend atteignable (§8)** : la sonde publique révèle
   maintenant la version exacte du produit. Arbitrage assumé, écrit dans le
   code, et cohérent avec celui de la story 2.6 sur les noms de migrations ;
   le dépôt n'est pas public à ce jour, et la réduction à un préfixe court
   tient en une ligne si l'arbitrage change.
6. **Un nombre a été corrigé avant publication** : « 148 cas » avait été
   écrit d'avance dans `sprint-status.yaml`. Recompté : **147**. §7.

### Change Log

| Date | Version | Description |
|---|---|---|
| 17-08-2026 | 0.1 | Story rédigée. Conception fondée sur trois mesures Docker (A, B, C) jouées sur une image jetable avant écriture. |
| 17-08-2026 | 1.0 | Développée. T1–T12 faites et prouvées ; T13 reste à l'éditeur, la story reste `in-progress` (§9). |

### File List

**Nouveau**
- `lib/version.ts`

**Modifiés**
- `app/api/public/health/route.ts`
- `docker/Dockerfile`
- `docker-compose.prod.yml`
- `scripts/verify-deploy.mjs`
- `tests/deploiement.spec.ts`
- `.gitignore`
- `.dockerignore`
- `README.md`
- `docs/architecture.md`
- `docs/epics.md`
- `docs/stories/deferred-work.md`
- `docs/stories/sprint-status.yaml`
- `docs/stories/2-8-dire-quel-commit-est-en-service.md`
