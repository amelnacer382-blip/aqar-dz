---
baseline_commit: 7cb62b1
---

# Story 2.6 : Refuser de servir sur un schéma qu'on ne sait pas lire

Status: done *(17-08-2026 — T3 close, correctif en service et mesuré)*

**Épopée :** 2 — Durcir le déploiement
**Couvre :** BUG-37 · REP-96 *(rattachement corrigé le 16-08-2026, voir plus bas)*
**Découpage :** [`docs/epics.md`](../epics.md) — Epic 2, story 2.6
**Dépend de :** rien
**Bloque :** rien formellement — mais chaque migration livrée avant elle rejoue le risque
**Date :** 16 août 2026

---

## Story

**En tant qu'**exploitant d'Aqar DZ,
**je veux** qu'une image qui ne connaît pas le schéma de la base cesse de se déclarer en bonne santé,
**afin que** le produit ne tombe pas à zéro pendant que tous les voyants restent verts.

---

## Elle est née d'une panne, pas d'une lecture

C'est la première story de ce dépôt dont l'origine est un **incident en
fonctionnement**. Les sept passes d'audit précédentes lisaient du code,
servaient l'application en direct, ou pilotaient un navigateur. Celle-ci n'a
rien cherché : le 16-08-2026, l'éditeur a signalé qu'il ne pouvait plus se
connecter.

Le détail complet est dans **BUG-37**. Le résumé utile ici :

- la base portait l'énumération `AgencyPlan`, l'image servait un client
  Prisma qui attend un `String` ;
- `authorize()` relit l'agence **à chaque connexion** — c'est la règle du
  dépôt, le rôle et l'agence ne viennent jamais du jeton ;
- donc **tous** les comptes échouaient, pas seulement celui qui a été
  signalé ;
- et le message affiché, « Une erreur est survenue », vient du `catch` de
  `app/auth/login/page.tsx:52`. Il **exclut** tous les refus légitimes, qui
  ont chacun leur phrase propre. Faux-ami coûteux : une heure de diagnostic
  est partie sur le mot de passe, le compte désactivé, le statut de l'agence
  et le compteur de tentatives, alors que le message les écartait tous.

**L'image a été reconstruite, la panne est fermée.** Cette story ne la
traite pas.

---

## Ce qu'elle traite : quatre filets traversés

Le défaut se répare en une commande. Ce qui mérite une story est **le fait
qu'il ait traversé quatre contrôles**, dont chacun avait une bonne raison de
ne rien voir. C'est cela qui se reproduira.

### 1. L'ordonnancement Docker ne garde qu'un sens

`docker-compose.prod.yml:171` :

```yaml
    depends_on:
      migrate:
        condition: service_completed_successfully
```

Cela garantit que l'application n'est jamais **en avance** sur la base. Cela
ne dit **rien** du cas inverse — et le cas inverse est celui qui s'est
produit.

Et le chemin réellement emprunté contourne le service entièrement.
`package.json:12` :

```json
    "db:deploy": "prisma migrate deploy",
```

Cette commande applique les migrations **depuis l'hôte**. Le conteneur
`frontend` n'est ni consulté, ni redémarré. La base avance, l'image reste.

### 2. La sonde de santé ne peut pas voir ce défaut

`app/api/public/health/route.ts:20` :

```ts
await prisma.$queryRaw`SELECT 1`
```

Son commentaire promet qu'« elle vérifie la base, pas seulement le
processus ». C'est vrai au sens du **socket**, et faux au sens de la
**donnée** : `SELECT 1` ne traverse aucune colonne, donc aucune énumération.

`aqar-frontend-prod` est resté **`healthy` pendant que 100 % des connexions
échouaient**. Docker n'avait pas tort — il mesurait exactement ce qu'on lui
avait demandé de mesurer.

### 3. `verify:deploy` ne s'authentifie jamais

```
$ grep -nE 'signin|login|credentials|session|Cookie|auth' scripts/verify-deploy.mjs
(aucune occurrence)
```

Le script enchaîne santé → vitrine → fiche → rejeu d'une Server Action.
**Tout est public.** Or le défaut ne se manifeste que derrière une session.

Le script écrit pour la story 5.14, et présenté comme la preuve réelle du
déploiement, **aurait tourné vert ce matin-là**, sur un produit où personne
ne pouvait entrer.

### 4. La suite E2E ne joue pas contre l'image déployée

REP-95, déjà connu et déjà versé : `playwright.config.ts` sert l'application
en direct sur `:3002`. L'image en service n'est jamais dans le chemin.

> **En une phrase, et c'est l'énoncé de la story :**
> **aucun contrôle de ce dépôt ne lit une ligne `Agency` authentifiée contre
> l'image réellement en service.**

---

## Ce n'est pas un incident, c'est une classe

```
$ grep -cE '^enum ' prisma/schema.prisma
19
```

Dix-neuf énumérations. Chaque migration future qui en touche une, appliquée
sans reconstruire, reproduit ceci à l'identique : produit à zéro, conteneur
`healthy`, `verify:deploy` vert.

Et c'est `CLAUDE.md` §8 à l'état pur. **L'auteur de la migration avait vu le
risque**, son commentaire le dit :

> *« une seule ligne non convertie enfermerait l'agence entiere, ecran par
> ecran »*

Il a couvert **une** direction — `ELSE 'starter'` pour les données non
converties. Le miroir, **donnée convertie et client non converti**, n'était
gardé par rien. La question §8 avait été posée ; elle n'avait été posée que
d'un côté.

---

## Critères d'acceptation

### AC-1 — La sonde cesse de mentir, sans devenir un piège

**Given** `/api/public/health` exécute `SELECT 1`, qui ne traverse aucune colonne
**When** l'image en service ne sait pas désérialiser une ligne que la base contient
**Then** la sonde répond `503` et le conteneur est déclaré `unhealthy`
**And** elle continue de répondre `200` sur une base **vide mais joignable**

> **Mesuré le 16-08-2026, pas déduit.** Le side-car dérivé répond
> `200 · {"status":"ok","database":"up"}` alors qu'aucune connexion
> n'aboutit. Le `healthcheck` (`docker-compose.prod.yml:177`) étant un
> `wget --spider` sur cette URL, le conteneur se serait déclaré `healthy`.

**La seconde clause n'est pas un détail, c'est la condition de la story.**
Voir « Ce que cette story rend atteignable », plus bas.

### AC-2 — `verify:deploy` éprouve le chemin authentifié, sans ouvrir de session

> **Arbitrage rendu par l'éditeur le 16-08-2026 : la sonde d'échec.**
> Le script tente une connexion **volontairement invalide** et exige un refus
> **lisible**. Il n'ouvre aucune session, ne stocke aucun secret, n'écrit
> rien.
>
> **Motif, et il est mesuré** — `auth.ts:157` :
>
> ```ts
> const user = await prisma.user.findUnique({
>   where: { email },
>   include: { agency: true },      // ← ligne 159
> })
> ...
> motDePasseValide = await compare(password, user.password)   // ← ligne 188
> ```
>
> **La ligne `Agency` est désérialisée avant que le mot de passe ne soit
> comparé.** Un mot de passe faux traverse donc exactement le code qui a
> cassé le 16-08 — sans qu'aucun accès ne soit accordé. C'est la seule des
> quatre sorties qui n'a ni secret à gérer, ni écriture, ni compte permanent
> à mot de passe connu.

**Given** le script n'authentifie rien aujourd'hui (`grep -nE 'signin|login|credentials|session|Cookie|auth' scripts/verify-deploy.mjs` → aucune occurrence)
**When** il `POST` sur `/api/auth/callback/credentials` un mot de passe volontairement faux, sur un compte existant
**Then** il exige la redirection du **refus normal** — `/auth/login?error=CredentialsSignin` — et **échoue** sur toute autre
**And** il n'ouvre aucune session, n'écrit rien en base, et ne détient aucun mot de passe valide

> **Les deux signatures sont mesurées, le 16-08-2026 — l'assertion ne
> repose sur aucune supposition :**
>
> ```
> sain    302 → /auth/login?error=CredentialsSignin&code=credentials
> dérivé  302 → /auth/error?error=Configuration
> ```
>
> Ce n'est pas seulement le paramètre `error=` qui change, **c'est le chemin
> lui-même** : un refus normal renvoie vers l'écran de connexion, une
> exception vers l'écran d'erreur. L'assertion est donc simple et étroite —
> ni session, ni secret, ni `$ACTION_ID` à scruter.

#### ⚠ Deux pièges trouvés en vérifiant l'arbitrage — ils décident du code

**Le premier annule le critère s'il est ignoré.** `auth.ts:139-155` : le
compteur **par adresse** refuse *avant* toute vérification, et retourne
`null` **sans jamais atteindre `findUnique`** :

```ts
if (!budgetAdresse.ok) {
  await penaliserEchec(email)
  return null                     // ← ligne 154 : aucune ligne n'est lue
}
```

Un script qui se contenterait d'exiger « un refus lisible » serait donc
**vert sur un budget épuisé, en n'ayant rien éprouvé du tout**. C'est
littéralement `CLAUDE.md` §6 : *« un contrôle posé à côté du trou laisse le
trou passer dessous »*.

**D'où la formulation exacte de l'AC-2** : le seul message acceptable est
**« Email ou mot de passe incorrect »**, parce qu'il est le seul qui ne
puisse être produit **qu'après** la lecture de la ligne et la comparaison du
mot de passe. « Trop de tentatives » n'est **pas** un succès du contrôle,
c'est un résultat indéterminé — le script doit le dire et sortir en erreur,
pas passer.

**Le second est un faux positif de lenteur.** `penaliserEchec`
(`auth.ts:81-97`) **ne ferme jamais un compte** — il retarde la réponse,
1 s, 2 s, 4 s… plafonnées à **30 s** (`DELAI_PLAFOND_MS`). C'est le cœur de
la story 1.9 : *« le compteur n'est jamais consommé avant la vérification :
c'est ce qui distingue freiner une attaque de fermer un compte »*.

**Bonne nouvelle** : user le compteur du compte sondé est donc **sans
conséquence sur l'accès** — la crainte inscrite au risque 🟠 était plus large
que le code. **Mauvaise nouvelle** : le délai peut atteindre 30 s, et un
script au délai d'attente trop court lirait un dépassement là où il y a une
pénalité. Le délai du script doit être supérieur à `DELAI_PLAFOND_MS`.

#### Le compte à sonder

Il doit **exister** — un email inconnu fait rendre `null` à `findUnique`, et
aucune ligne `Agency` n'est alors désérialisée : le contrôle ne prouverait
rien. Il est fourni par variable (`VERIFY_EMAIL`), **et sa valeur n'est pas
un secret** : le script n'en connaît jamais le mot de passe.

Sur une production, l'adresse de l'éditeur convient — puisque le compteur ne
ferme aucun compte. Sur la pile de démonstration, `CLAUDE.md` §3 vaut quand
même : préférer une adresse dédiée, pour que la lecture des journaux ne
confonde pas une sonde avec une vraie tentative.

### AC-3 — La dérive est détectée, pas seulement ses symptômes

**Given** `npm run db:deploy` applique les migrations depuis l'hôte sans consulter le conteneur
**When** la base porte des migrations que l'image embarquée ne connaît pas, ou l'inverse
**Then** `verify:deploy` le signale **en nommant les migrations en écart**

C'est le seul critère qui attrape la cause plutôt qu'un effet. Les AC-1 et
AC-2 rattrapent la panne une fois qu'elle existe ; celui-ci la voit avant
qu'un utilisateur ne la rencontre.

### AC-4 — La procédure documentée cesse de proposer le chemin dangereux

**Given** le `README` décrit l'application des migrations
**When** la story est terminée
**Then** il nomme la reconstruction de l'image comme **indissociable** de la migration, et dit pourquoi

### AC-5 — Prouvé par mutation

**Given** `CLAUDE.md` §9 exige une preuve par mutation
**When** la story est terminée
**Then** la dérive est **rejouée** — image ancienne contre base migrée — et chaque garde ajoutée rougit **en désignant la bonne cause**, le contrôle positif restant vert

---

## Ce que cette story rend atteignable — `CLAUDE.md` §8

La règle du dépôt : *une correction déplace le problème avant de le fermer.*
Deux déplacements sont identifiés **avant** tout code, et le second n'a pas
de sortie gratuite.

### 🟠 ~~🔴~~ Une sonde plus exigeante peut refuser une pile saine — mais moins gravement que je ne l'ai écrit

~~nginx dépend de `frontend: service_healthy`.~~ **Faux, et vérifié le
16-08-2026 en écrivant T2** (`CLAUDE.md` §7 — une affirmation que le code ne
tient pas est un défaut, y compris dans une story) :

```yaml
  nginx:
    depends_on:
      - frontend          # docker-compose.prod.yml:197-198
```

C'est un `depends_on` **simple**, sans `condition: service_healthy`. nginx
attend donc que le conteneur *démarre*, pas qu'il soit *sain*. Et
`restart: unless-stopped` ne relance pas un conteneur `unhealthy` — Compose
ne le fait pas, seul Swarm le ferait.

**Conséquence réelle : un `503` rend le conteneur `unhealthy` et visible
dans `docker ps`, sans rien empêcher de démarrer.** Le risque passe de 🔴 à
🟠 : on ne casse pas l'installation initiale, on affiche un état faux. C'est
moins grave, et c'est quand même à éviter.

Une sonde qui lit une ligne réelle **échouerait sur une base vide** — le
premier déploiement, avant tout `seed`. D'où la seconde clause de l'AC-1.

C'est pourquoi l'AC-1 porte deux clauses. Le code doit distinguer :

| Situation | Verdict attendu |
|---|---|
| La base est injoignable | `503` — c'est déjà le comportement actuel |
| Une ligne existe et **ne se désérialise pas** | `503` — c'est ce qu'on ajoute |
| Aucune ligne n'existe encore | **`200`** — l'absence de données n'est pas une panne |

Concrètement : le refus doit venir de l'**exception de désérialisation**, pas
d'un décompte à zéro. Un `findFirst()` qui rend `null` est un succès.

### 🟠 ~~Un `verify:deploy` qui s'authentifie a besoin d'un compte~~ — tranché, et le risque a rétréci

Le script se targue de ne **rien écrire en base** — c'est un argument de la
story 5.14, et c'est ce qui le rend lançable sur une production. Ouvrir une
session demandait un compte, et aucune des trois sorties évidentes n'était
gratuite :

| Sortie | Ce qu'elle coûtait |
|---|---|
| Créer un compte jetable | Le script écrit en base. L'argument de la 5.14 tombe — et un script mort en route laisse un compte derrière lui |
| Employer un compte de démonstration | Use un compteur **partagé par toute la suite** (`CLAUDE.md` §3) |
| Un compte de contrôle dédié | Un compte permanent de plus, à mot de passe connu, sur une production |

**ARBITRAGE RENDU le 16-08-2026 par l'éditeur : aucune des trois.** La sonde
d'échec (AC-2) éprouve le même code sans ouvrir de session — parce que
`auth.ts:157` lit la ligne `Agency` **avant** la comparaison du mot de passe.

**Ce que la vérification de cet arbitrage a changé**, et c'est le genre de
chose qui ne se déduit pas : la crainte « saturer un compteur » était **plus
large que le code**. `penaliserEchec` ne ferme aucun compte — il retarde la
réponse et rien d'autre (`auth.ts:88`). Le risque 🟠 se réduit donc à un
réglage de délai d'attente.

**Mais la vérification a aussi trouvé un piège que l'arbitrage ne voyait
pas** : le compteur *par adresse*, lui, refuse avant toute lecture. Un
contrôle mal formulé aurait été vert sans rien éprouver. Détail et
formulation retenue : sous l'AC-2.

### 🟠 REP-96 rejoint cette story, et il annonçait BUG-37 onze jours à l'avance

`REP-96` était rattaché à la story **5.11**. Deux raisons de le déplacer, et
la seconde est la vraie.

**Il ne pouvait pas y être porté.** La 5.11 recompte la documentation et
*« ne touche pas au code applicatif »* ; le remède proposé par le constat —
exposer une information dans la sonde de santé — est du code applicatif,
dans le fichier même que cette story réécrit.

**Et il décrivait BUG-37 avant qu'il n'arrive**, en toutes lettres : *« aucun
écran, aucune sonde, aucun journal ne compare la version servie au commit du
dépôt »*. C'est exactement l'absence qui a laissé, le 16-08, une base migrée
sous une image qui ne l'était pas. Classé 🔵 « confort », il valait 🟠.

**Traité autrement que proposé, et le motif compte** : la sonde compare les
**migrations**, pas un SHA de commit. Un SHA dit *quelle version* tourne —
encore faut-il connaître le dépôt pour en déduire quelque chose. L'écart de
migrations dit *ce qui ne va pas*, et se lit sans rien savoir d'autre. Le
SHA reste un complément possible ; il n'est **pas** fait, donc REP-96 n'est
pas soldé en entier.

### 🟢 Ce qui devient possible

Une fois AC-3 posé, la story 4.7 (refonte du harnais) hérite d'un moyen de
comparer image et base qu'elle n'avait pas. REP-95 — la suite qui ne passe
pas par l'image déployée — devient traitable au lieu d'être seulement
constaté.

---

## Tâches

- [x] **T1** — Dérive reproduite le 16-08-2026, side-car `aqar-dz:derive-bb96dc9` sur `:3003`, la pile en service intacte. **Rouge obtenu et attribuable** : sonde `200` sur un produit mort, redirection `/auth/error?error=Configuration` au lieu de `/auth/login?error=CredentialsSignin`, journal nommant `Error converting field "plan"`. Détail dans « Mesures ». Le script de reproduction se démonte seul (`trap … EXIT`) et n'affiche aucun secret.
- [x] **T2** — AC-1 : la sonde lit désormais une ligne typée. `app/api/public/health/route.ts` réécrit — deux étapes gardées séparément (`SELECT 1` pour la socket, puis `agency`+`user` pour la donnée), afin de **distinguer** « injoignable » de « illisible par ce client » sans dépendre de la taxonomie d'erreurs de Prisma. Les colonnes d'énumération sont sélectionnées **explicitement** : un `select` réduit à `id` ne convertirait rien et serait aveugle en ayant l'air de lire. `npx tsc --noEmit` et `npm run lint` à **0**.
      ⚠ **Écrit, pas encore prouvé** — voir T9 et « Ce qui reste à mesurer sur T2 ».
- [x] **T3** — AC-1 : la sonde rend `200` sur une base **migrée et vide**. **Mesuré le 17-08-2026**, `scripts/eprouver-base-vierge.sh` lancé par l'éditeur : `tables applicatives trouvees : 20` · `lignes, toutes tables confondues : 0` · `HTTP 200 {"status":"ok","database":"up","schema":"a-jour"}`. Le champ `schema` prouve que les trois étapes gardées ont été jouées **sur une base sans aucune ligne** : le refus vient bien de l'exception de désérialisation, jamais d'un décompte à zéro. **Le risque 🟠 est fermé** — une installation neuve, avant tout `seed`, n'est pas déclarée malade. *(Le premier lancement avait échoué sur un défaut du script, non du produit : voir « Mesures du 17-08-2026 ».)* C'est le contrôle positif du risque 🟠, et il ne se déduit pas.
      **La manœuvre est écrite : `scripts/eprouver-base-vierge.sh`** — postgres jetable **sans aucun volume** (donc rien à supprimer au démontage, qui ne nomme que des conteneurs et un réseau), migrations appliquées, post-condition qui prouve qu'elles sont arrivées **sur la base jetable** et non ailleurs, side-car sur `:3004` **sans `--env-file .env`**, verdict lu sur le corps de la sonde.
      **Ce qui manque est un seul geste, et il n'est pas contournable** : `npx prisma migrate deploy`, bloqué par le `deny` de `.claude/settings.json`. Seule cette commande écrit `_prisma_migrations` — la table même que la sonde interroge. Appliquer les `.sql` à la main donnerait un schéma sans son journal, donc une base que la sonde déclarerait « en retard » : **un test qui fabriquerait son propre oracle**. L'emballer dans un `docker run` serait le contournement déguisé que §14.2 nomme. Le script est donc lancé par l'éditeur.
- [x] **T4** — Arbitrage du risque 🟠 demandé et **rendu le 16-08-2026** : la sonde d'échec, ni session ni secret ni écriture. Motif et mesure sous l'AC-2. **La vérification de l'arbitrage a corrigé la question elle-même** — le compteur par compte ne ferme rien, et le compteur par adresse crée un faux vert que la formulation retenue écarte. T5 est débloquée.
- [x] **T5** — AC-2 : sonde d'échec posée dans `verify:deploy`, **verte sur la pile saine et rouge sur l'image dérivée** (mutation 4). Exiger la redirection `/auth/login?error=CredentialsSignin` **mesurée en T1**, et échouer sur toute autre — `/auth/error?error=Configuration` est la signature de la dérive. Délai d'attente **supérieur à 30 s** (`DELAI_PLAFOND_MS`), la pénalité progressive pouvant retarder la réponse d'autant.
- [x] **T6** — AC-3 : `lib/migrations.ts` compare `_prisma_migrations` au contenu de `prisma/migrations/` embarqué, **dans les deux sens** (image en retard = la forme de BUG-37 ; base en retard = l'application en avance). La sonde rend `503` et **nomme** les migrations en écart ; `verify:deploy` reprend le diagnostic et nomme le remède. Le `Dockerfile` recopie `prisma/migrations` — sans quoi l'image n'aurait rien à comparer. `tsc` et `lint` à **0**.
- [x] **T7** — AC-4 : le `README` avertit qu'*« une migration et une reconstruction ne se séparent pas »*, avec le motif (`npm run db:deploy` applique depuis l'hôte) et les trois réponses possibles de la sonde.
- [x] **T8** — `tests/deploiement.spec.ts` garde la `COPY` des migrations dans l'étage `production` du `Dockerfile`. **Prouvé par mutation** : rouge sur la ligne 98, le test voisin resté vert. Étendu si un invariant statique s'y prête, **sans lui faire prétendre plus qu'il ne peut** — son propre en-tête dit qu'il lit un fichier et ne teste pas le produit servi.
- [x] **T9** — AC-5 : **quatre mutations jouées séparément**, chacune avec son retour au vert, messages d'échec lus. La première a DÉMENTI l'énoncé et fait corriger le code (`findFirst` → `groupBy`) : détail dans « Preuves ». Mutation de chaque garde ajoutée, message d'échec **lu** et vérifié qu'il désigne la bonne cause. Pour l'AC-1, employer la méthode du **client remplacé** décrite plus haut — `aqar-dz:derive-bb96dc9` ne convient pas, elle est antérieure au code de T2.
- [x] **T10** — `npx tsc --noEmit` **0** · `npm run lint` **0 erreur** (4 avertissements préexistants) · `npm run test:e2e` **142 passed** (§2, accord donné) · File List complète · `sprint-status.yaml` à jour.
      ✅ **`bug-report.md` mis à jour le 17-08-2026** : BUG-37 passe de « cause structurelle ouverte » à « corrigé et en service », avec les trois gardes et la mesure du faux positif écarté.
      ⚠ **La suite n'a pas été rejouée le 17-08, et c'est délibéré.** `git diff --name-only 32f8c40..HEAD | grep -vE '^(docs/|scripts/eprouver)'` ne rend **aucun fichier** : le seul code applicatif touché depuis les 142 verts est nul. Rejouer aurait mesuré la même chose. Dit ici plutôt que coché en silence (§9).

---

## Mesures du 17-08-2026 — mise en service, et une alerte surdimensionnée

### La protection est en service, et c'est mesuré

**Avant** — l'image du 16-08 à 12h20, antérieure au code de cette story :

```
$ curl -s -w 'HTTP %{http_code}  ' http://localhost:8095/api/public/health
  HTTP 200  {"status":"ok","database":"up"}          ← pas de champ `schema`
```

`docker compose -f docker-compose.prod.yml up -d --build` a été **refusé
deux fois par le classifieur de la session** — un garde-fou de l'outil, pas
du dépôt. Il n'a pas été contourné ; **l'éditeur l'a lancé lui-même** le
17-08-2026 à 01h10.

**Après** :

```
$ curl -s -w 'HTTP %{http_code}  ' http://localhost:8095/api/public/health
  HTTP 200  {"status":"ok","database":"up","schema":"a-jour"}
$ docker inspect --format '{{.Created}} | {{.State.Health.Status}}' aqar-frontend-prod
  2026-08-17T01:10:46Z | healthy

$ npm run verify:deploy
  1. santé : {"status":"ok","database":"up","schema":"a-jour"}
  5. épreuve d'échec sur agent@aqar.dz
     → 302 → /auth/login?error=CredentialsSignin&code=credentials
  ✅ Le chemin authentifié refuse proprement : l'image sait lire la base.
  sortie = 0
```

**Le champ `schema` prouve à lui seul que les trois étapes gardées ont été
jouées** — socket, lecture typée par `groupBy`, comparaison des migrations :
il n'est écrit qu'après la troisième, donc aucune n'a court-circuité les
autres. Et l'étape 5 rend **la signature saine mesurée en T1**
(`/auth/login?error=CredentialsSignin`) et non celle de la dérive
(`/auth/error?error=Configuration`).

Ce qui a coûté BUG-37 — une image qui sert un schéma qu'elle ne sait pas
lire, en se déclarant saine — est désormais **impossible sans que le
conteneur passe `unhealthy` et que `verify:deploy` sorte non nul**.

### Premier lancement de T3 — le script était faux, et ce qu'il a quand même prouvé

Lancé par l'éditeur le 17-08-2026. **Arrêté à l'étape 3, sur un défaut du
script et non du produit** :

```
ERROR:  relation "Agency" does not exist
ECHEC — Agency n'est pas vide — ce n'est plus le cas etudie
```

J'avais écrit les noms des **modèles Prisma**. Les 19 modèles sont tous
`@@map`és en `snake_case` pluriel (`grep -c '@@map' prisma/schema.prisma`
→ 19) : la table s'appelle `agencies`. **Et le diagnostic était faux** : une
requête en échec s'est lue comme un compte non nul, sur une base
parfaitement vide. C'est §6 mot pour mot — un contrôle incapable de
distinguer « absent » de « non vide » donne un rouge qui désigne la mauvaise
cause. Corrigé dans les deux sens : plus aucun nom de table n'est recopié
(ils sont demandés au catalogue, ce qui couvre les 19 et survit à tout
`@@map` futur), et une requête qui n'aboutit pas fait échouer le script en
le disant.

**Ce que ce lancement a déjà établi, et qui ne sera pas à refaire :**

| Étape | Résultat |
|---|---|
| Base jetable créée sans volume | `tables avant migration : 0` |
| Migrations appliquées | `5 migrations found` … `All migrations have been successfully applied.` |
| **Post-condition** | `embarquees dans le depot : 5   appliquees ICI : 5` |

**La post-condition est la mesure qui comptait.** Prisma a annoncé
`Environment variables loaded from .env` — donc il a bien lu le fichier qui
porte l'adresse de la **vraie** base — et a migré `at "127.0.0.1:5435"`. La
variable passée en ligne l'emporte, et ce n'est plus une supposition sur le
comportement de `dotenv` : les 5 migrations sont comptées **dans la base
jetable**. Le garde-fou qui empêche ce script de se tromper de base est
éprouvé.

### Second lancement — T3 close, le risque 🟠 avec

```
=== 3. la base est-elle VIDE de donnees ? ===
    tables applicatives trouvees : 20
    lignes, toutes tables confondues (hors _prisma_migrations) : 0

=== 4. la sonde, servie par l'image candidate, contre cette base vide ===
    HTTP 200   {"status":"ok","database":"up","schema":"a-jour"}

=== VERDICT ===
    AC-1 seconde clause : TENU.
```

**Vingt tables, zéro ligne, `200`.** Le champ `schema` n'étant écrit qu'après
la troisième étape gardée, sa présence prouve que la comparaison des
migrations a bien tourné **sur une base sans aucune donnée** : le refus vient
de l'exception de désérialisation et jamais d'un décompte à zéro, ce que
l'AC-1 exigeait. Une installation neuve, avant tout `seed`, n'est pas
déclarée malade. **Le risque 🟠 de la story est fermé, par mesure.**

> **Sur quelle image, exactement.** Le verdict a été rendu par
> `aqar-dz:candidat`, construite le 16-08 à 17h27 — soit **cinq minutes après
> `a224d4c` (17h22), dernier commit du code de la sonde**, et rien n'y a
> touché depuis (`git log -- app/api/public/health/route.ts lib/migrations.ts`).
> Le code éprouvé est donc bien celui qui sert. Mais c'est une coïncidence de
> calendrier, pas une garantie : **une image annexe vieillit sans le dire, et
> cette story est née exactement de là.** Le script éprouve désormais
> `aqar-dz:latest` par défaut — celle que sert la production — et **imprime
> l'image et sa date** avec le verdict, faute de quoi un vert obtenu sur une
> image périmée serait indiscernable d'un vert obtenu sur la bonne.

### J'ai surdimensionné une alerte, et ça a coûté un tour

Le 16-08, j'ai signalé que T3 « demande une base jetable, et son démontage
passe par une suppression de volume — une erreur de nom détruit
`postgres_data` ». **C'était faux sur les deux moitiés.**

- **« Base vierge » ne veut pas dire base nue.** L'AC-1 dit *« vide mais
  joignable »*, et son tableau dit *« aucune ligne n'existe encore »* : un
  schéma **migré**, sans données. Le cas du premier déploiement avant tout
  `seed`. J'avais dimensionné le risque sur une lecture trop large de ma
  propre tâche.
- **Compose n'était pas le bon outil.** Un `docker run` sans `-v` n'a aucun
  volume : le démontage nomme un conteneur, et ne peut structurellement pas
  atteindre un volume. Le risque annoncé ne pouvait pas se produire sur ce
  chemin.

**La leçon est plus large que l'erreur** — `CLAUDE.md` §7 s'applique aussi à
un risque : *un danger qu'on n'a pas mesuré s'annonce trop grand*, et une
alerte surdimensionnée coûte comme une alerte manquée. Elle a fait demander
un arbitrage là où il fallait supprimer le danger.

### Ce que la mesure du danger a trouvé — REP-103

Plutôt que de demander la permission du risque, il a été **mesuré**, sur
deux volumes bidons hors du projet :

```
$ docker compose -p t-ext -f compose.yml down -v
    Volume t-ext_jetable Removing
    Volume t-ext_jetable Removed
$ docker volume ls -q | grep essai-volume-sacre
    essai-volume-sacre           ← declaré `external: true`, épargné
```

`docker compose down -v` **épargne un volume `external`, sans même un
avertissement**. Les deux volumes de `docker-compose.prod.yml:227-229` —
la base **et** tous les fichiers téléversés — sont ordinaires. C'est
`REP-103`, porté par la **story 2.7**, ouverte pour l'occasion dans
`docs/epics.md` (§1 : un constat sans story n'existe pas).

**Ce que ça rend atteignable — §8.** Un volume `external` n'est jamais créé
par Compose : la pile refuse de monter s'il manque, et le `name:` doit
reprendre `aqar-prod_postgres_data` au caractère près. On échangerait un
risque d'effacement contre un risque de non-démarrage — moins grave, et
c'est pourquoi la story 2.7 exige que la bascule soit éprouvée sur un projet
jetable avant d'être appliquée. **Et ce n'est pas une sauvegarde** : la
story 0.1 reste le filet, celle-ci n'est que la rambarde.

---

## Mesures du 16-08-2026 — contrôle positif fait, rouge NON obtenu

Lancées sur accord explicite de l'éditeur (« vas-y, lance »), contre la pile
`docker-compose.prod.yml` remise à niveau le matin même.

### Le contrôle positif est vert — et il était indispensable

`CLAUDE.md` §6 : *« un refus attendu ne prouve rien tant qu'un succès n'est
pas constaté sur le même chemin »*.

| Épreuve | Résultat |
|---|---|
| `GET /api/public/health` | `HTTP 200` · `{"status":"ok","database":"up"}` |
| `docker inspect … .State.Health.Status` | `healthy` |
| `npm run verify:deploy` | **sortie 0**, Server Action `303`, aucun enregistrement créé |

### La signature saine de la sonde d'AC-2, mesurée

Une **seule** tentative, mot de passe volontairement faux, sur un compte
existant — le compteur par compte ne ferme rien, il ne fait que retarder
(`auth.ts:88`) :

```
POST /api/auth/callback/credentials   (csrfToken + Origin)
→ HTTP/1.1 302 Found
→ location: /auth/login?error=CredentialsSignin&code=credentials
```

**C'est une trouvaille pour l'implémentation, et elle simplifie l'AC-2.**
Le paramètre `error=` distingue les cas **dans la redirection elle-même** :
`CredentialsSignin` est le refus normal, produit **après** la lecture de la
ligne et la comparaison du mot de passe. La sonde n'a donc besoin ni de
scruter un `$ACTION_ID`, ni d'ouvrir de session — un jeton CSRF et un `POST`
suffisent.

**Deux points d'entrée exercent la désérialisation**, et c'est utile de le
savoir avant de choisir :

| Point d'entrée | Où | Sondable |
|---|---|---|
| `authorize()` | `auth.ts:157-159` | **Oui** — route, pas d'`$ACTION_ID` à trouver |
| `explainLoginFailure()` | `app/auth/login/actions.ts:62-65` | Server Action ; posée dans un composant **client**, son identifiant n'est pas dans le HTML |

Le premier est retenu pour T5.

### 🔴 Le rouge, obtenu — et il est entièrement attribuable

**Méthode, choisie pour ne rien perturber.** Source extraite à `bb96dc9` —
le parent du commit qui introduit la migration. Son schéma porte
`plan String @default("basic")` et il ne connaît que **3** des **5**
migrations que la base porte : c'est la dérive exacte, pas une imitation.
Image `aqar-dz:derive-bb96dc9`, lancée **en side-car sur `:3003`**, sur le
réseau `aqar-prod_aqar-network`, contre **la même base**.
`aqar-frontend-prod` n'a été ni arrêté, ni modifié, ni redémarré.

| Mesure | Pile saine (`:8095`) | Side-car dérivé (`:3003`) |
|---|---|---|
| `GET /api/public/health` | `200` · `{"status":"ok","database":"up"}` | **`200` · `{"status":"ok","database":"up"}`** |
| `POST` credentials, mot de passe faux | `302` → `/auth/login?error=CredentialsSignin&code=credentials` | **`302` → `/auth/error?error=Configuration`** |
| `npm run verify:deploy` | sortie `0` | sortie `0` |

Journal du conteneur dérivé, qui **nomme la cause** et confirme qu'on
reproduit bien BUG-37 et pas autre chose :

```
[auth][error] CallbackRouteError
[auth][cause]: PrismaClientKnownRequestError:
Invalid `prisma.user.findUnique()` invocation:
Error converting field "plan" of expected non-nullable type "String",
found incompatible value of "pro".
```

#### Ce que ces quatre lignes établissent

**1. La sonde ment, et c'est mesuré.** `200` et `{"database":"up"}` sur un
produit où aucune connexion n'aboutit. L'AC-1 n'est plus justifié par une
lecture de code mais par une observation. Le `healthcheck` de
`docker-compose.prod.yml:177` est un `wget --spider` sur **cette** URL : un
`200` le fait réussir, donc le conteneur se serait déclaré `healthy`.

**2. La sonde d'échec fonctionne, et sa signature est plus nette
qu'espéré.** Ce n'est pas seulement le paramètre `error=` qui change, c'est
**le chemin lui-même** :

```
sain    → /auth/login?error=CredentialsSignin&code=credentials
dérivé  → /auth/error?error=Configuration
```

Un refus normal renvoie vers l'écran de connexion ; l'exception renvoie vers
l'écran d'erreur. **T5 devient une assertion sur la redirection**, sans
session, sans secret, sans `$ACTION_ID`.

**3. `verify:deploy` reste vert.** Il tourne contre `:8095`, qui était sain —
et c'est exactement le point : **il n'a aucun moyen de savoir contre quelle
image il parle.** Ce n'est pas un échec du script, c'est l'illustration du
trou que l'AC-3 ferme.

### Ce qui reste à mesurer sur T2 — et pourquoi ce n'est pas immédiat

**`aqar-dz:derive-bb96dc9` ne peut pas prouver la nouvelle sonde.** Cette
image est *antérieure* au code de T2 : elle porte l'ancienne sonde, celle
qui fait `SELECT 1`. Elle a servi à établir le rouge du **problème** ; elle
ne peut rien dire du **remède**.

Prouver l'AC-1 demande une image qui porte à la fois le **nouveau code** et
un **client Prisma en retard sur la base** — et c'est justement la
combinaison que le défaut décrit. Deux méthodes, une seule est bonne :

| Méthode | Verdict |
|---|---|
| Rétrograder `prisma/schema.prisma` avant de construire | ❌ **Ne compile pas.** `lib/offres.ts` importe `AgencyPlan` ; sans l'énumération au schéma, `next build` échoue à la vérification de types. Le rouge ne viendrait pas du test (§6, piège 3) |
| Construire normalement, puis **remplacer `node_modules/.prisma`** par un client généré depuis un schéma dont `AgencyPlan` ignore une valeur présente en base | ✅ **C'est le défaut lui-même** — client ≠ base, code inchangé. Se pose au lancement par un montage, sans reconstruire |

La seconde est retenue pour **T9**. Elle est écrite ici pour que personne ne
la redécouvre, et pour qu'on ne coche pas l'AC-1 sur la foi du rouge de T1,
qui portait sur autre chose.

#### Ce que le rouge n'a pas prouvé

`verify:deploy` n'a **pas** été lancé contre le side-car — l'AC-3 (comparer
les migrations appliquées à celles que l'image embarque) reste donc entier,
et sa mutation reste à jouer après T6. C'est écrit pour ne pas le croire
fait.

---

## Preuves du 16-08-2026 — mutations jouées, et une qui a corrigé le code

Accord §2 donné. Toutes jouées **séparément**, chacune avec son retour au
vert : grouper des mutations donne un rouge inattribuable, l'erreur a déjà
été faite sur la story 6.3 et n'est pas refaite ici.

### La suite, et le contrôle positif

```
npm run test:e2e   → 142 passed (1,7 min), sortie 0
npx tsc --noEmit   → 0    ·    npm run lint → 0 erreur
npm run verify:deploy sur la pile saine → sortie 0
```

### Les quatre mutations

| # | Ce qui est muté | Résultat | Retour au vert |
|---|---|---|---|
| 1 | Le client Prisma ignore `pro`, présent en base | `503 { schema: "incompatible" }` | ✅ `200 a-jour` |
| 2 | `prisma/migrations/…_agency_plan_enum` retirée | `503 { schema: "image-en-retard", migrations: ["20260815000000_agency_plan_enum"] }` | ✅ `200 a-jour` |
| 3 | La `COPY` des migrations retirée du `Dockerfile` | `1 failed`, sur la ligne 98 — l'assertion visée | ✅ restauré |
| 4 | L'épreuve d'échec jouée contre l'image dérivée | `302 → /auth/error?error=Configuration`, le message désigne BUG-37 | ✅ `CredentialsSignin` sur la pile saine |

Pour la 3, le second test du même fichier (celui de nginx) **est resté
vert** : `1 failed, 1 passed`. Le rouge désigne donc bien la propriété visée
et pas une assertion voisine. `--project=chromium` employé à dessein —
REP-102 fabriquerait sinon un rouge inattribuable.

### ⚠ La mutation 1 a d'abord ÉCHOUÉ, et elle a corrigé le code

**Premier jet : la sonde lisait une ligne avec `findFirst`.** Client privé de
`pro`, base en contenant — et la sonde est restée **`200`**.

Le motif, une fois vu, est évident : **`findFirst` rend une ligne
ARBITRAIRE**, et celle qu'elle rendait portait `starter`, que le client
mutant connaissait encore. Une lecture d'une ligne n'éprouve que la valeur
de cette ligne. Mon commentaire de code disait « la lecture typée n'attrape
la dérive qu'une fois qu'une ligne l'exerce » — c'était déjà trop
optimiste : il fallait lire « qu'une fois que **la ligne qu'on lit**
l'exerce ».

**Corrigé en `groupBy`** — `by: ["plan"]`, `by: ["status"]`, `by: ["role"]`.
Une ligne par **valeur distincte présente en base** : toute valeur inconnue
du client lève, quelle que soit la ligne qui la porte. Le coût reste borné
— une colonne d'énumération a par construction une cardinalité faible.

Rejouée sur le nouveau code, la mutation 1 rougit.

**C'est le §7 du dépôt qui fonctionne** : la mesure n'a pas confirmé
l'énoncé, elle l'a démenti, et c'est le code qui a bougé. Sans cette
mutation, l'AC-1 aurait été coché sur une sonde qui ne voyait rien dans le
cas le plus probable — une base où la plupart des agences sont en `starter`.

### L'image candidate, éprouvée en conteneur avant tout déploiement

Une question restait ouverte et n'était pas théorique : **la sonde lit
`prisma/migrations` depuis `process.cwd()`**. En local, `cwd` est la racine
du dépôt ; en conteneur, `cwd` est `/app`, et le dossier n'y est **que**
parce que le `Dockerfile` l'y recopie. Un chemin qui ne tombe pas juste
aurait donné `503 « incomparable »` en permanence — un conteneur jamais
déclaré sain, sur une pile parfaitement bonne.

Image `aqar-dz:candidat` construite et lancée **en side-car sur `:3003`**,
contre la même base. La pile en service n'a pas été touchée.

```
ls /app/prisma/migrations dans l'image
  → 20260803000000_init · 20260803120000_agency_subscription
    20260810000000_normalize_user_emails · 20260815000000_agency_plan_enum
    20260815000001_agency_requested_plan

GET /api/public/health  → 200 {"status":"ok","database":"up","schema":"a-jour"}
VERIFY_BASE=:3003 npm run verify:deploy → sortie 0
journal du conteneur   → aucune erreur (hors le CredentialsSignin de la sonde)
```

**Le chemin runtime est donc validé, et pas seulement le chemin local.**

### Deux pièges de `verify:deploy` mesurés en le faisant échouer

L'épreuve d'échec a d'abord rendu `error=MissingCSRF`, deux fois de suite :

1. `getSetCookie()` rend l'en-tête **complet**, attributs compris. Les
   recoller fabrique un `Cookie` invalide.
2. La route pose **deux** `authjs.csrf-token`, et seul le **second**
   correspond au jeton rendu dans le corps. Envoyer les deux fait retenir le
   premier — le périmé.

Les deux sont écrits dans le script. À noter : dans les deux cas l'épreuve a
**refusé de conclure au succès**, ce qui est exactement son travail.

---

## Dev Notes

### Ce que la suite E2E peut et ne peut pas prouver ici

| Critère | Prouvable par `npm run test:e2e` ? |
|---|---|
| AC-1 | **Partiellement.** La sonde répond sur `:3002` ; mais la *dérive* ne peut pas être fabriquée dans la suite — elle sert une application construite à partir du dépôt courant, donc jamais désynchronisée |
| AC-2 | **Non.** `verify:deploy` est un script lancé à la main, hors du chemin de la suite |
| AC-3 | **Non.** Même motif |
| AC-4 | **Non.** Documentation |
| AC-5 | **C'est la mutation qui prouve, pas la suite** |

**Il faut le dire plutôt que de le laisser croire :** l'essentiel de cette
story n'est pas couvert par `npm run test:e2e`, et ne peut pas l'être tant
que REP-95 tient. La preuve est **T1 rejoué après T2/T5/T6** — la dérive
reproduite, puis constatée détectée. Une case cochée sans ce rejeu serait un
mensonge au sens de `CLAUDE.md` §9.

### Pièges connus

- **`SELECT 1` n'est pas remplaçable par `count()`.** Un `count` n'instancie
  aucun modèle : il ne désérialise rien, donc il ne verrait pas plus que
  `SELECT 1`. Il faut lire une **ligne typée**.
- **La sonde tourne toutes les 30 s** (`docker-compose.prod.yml:178`). Ce
  qu'elle lit doit être borné — une ligne, quelques colonnes.
- **`recordAudit()` n'a rien à faire ici.** La sonde n'est pas une action
  métier.
- **Ne pas conclure d'un code HTTP** (`CLAUDE.md` §6, piège 2) : les pages
  ont un `loading.tsx`, un refus arrive en `200`. Vaut pour toute assertion
  ajoutée à `verify:deploy` sur un écran authentifié.

### Repères

| Besoin | Où |
|---|---|
| Sonde de santé | `app/api/public/health/route.ts` |
| Vérification de déploiement | `scripts/verify-deploy.mjs` — `npm run verify:deploy` |
| Invariants statiques de déploiement | `tests/deploiement.spec.ts` |
| Ordonnancement des conteneurs | `docker-compose.prod.yml:84-100` (migrate), `:171` (dépendance) |
| Migrations embarquées | `prisma/migrations/` — 5 au 16-08-2026 |

---

## File List

`CLAUDE.md` §9 : elle doit lister **tous** les fichiers touchés — la story
1.9 en avait déclaré 7 sur 17. Vérifiée par `git diff --name-only` sur la
branche, pas recopiée de mémoire.

| Fichier | Nature |
|---|---|
| `lib/migrations.ts` | **créé** — compare les migrations embarquées à celles appliquées, dans les deux sens |
| `scripts/eprouver-base-vierge.sh` | **créé** — T3 : la sonde contre une base migrée et vide, sur un postgres jetable sans volume |
| `app/api/public/health/route.ts` | réécrit — trois étapes : socket, valeurs d'énumération (`groupBy`), écart de migrations |
| `scripts/verify-deploy.mjs` | épreuve d'échec authentifiée, et diagnostic du `503` de la sonde |
| `tests/deploiement.spec.ts` | invariant : l'étage `production` recopie `prisma/migrations` |
| `docker/Dockerfile` | `COPY` de `prisma/migrations` dans l'étage `production` |
| `README.md` | « une migration et une reconstruction ne se séparent pas » |
| `docs/qa/bug-report.md` | BUG-37, et huitième passe |
| `docs/epics.md` | story 2.6, et recompte de l'en-tête d'épopée 2 |
| `docs/stories/deferred-work.md` | REP-96 déplacé vers cette story, relevé en 🟠 |
| `docs/stories/sprint-status.yaml` | statuts et décomptes |
| `docs/stories/2-6-…md` | cette story |
