# Story 2.1: Fermer l'accès direct à l'application

Status: done

## Story

As a exploitant,
I want que nginx soit le seul chemin vers l'application,
so that les limites de débit et le futur TLS ne soient pas contournables.

**Couvre :** BUG-22 (défaut n° 09) · NFR-04
**Fichier :** `docker-compose.prod.yml`

## Le défaut, constaté à l'instant

```
$ curl -o /dev/null -w "%{http_code}" http://localhost:3000/api/public/health
200
$ docker ps --filter name=aqar-frontend-prod --format '{{.Ports}}'
0.0.0.0:3000->3000/tcp, [::]:3000->3000/tcp
```

Le service applicatif publie son port **sur toutes les interfaces**.
nginx cesse d'être un passage obligé : il devient une porte parmi deux.

Deux aggravations que le registre ne dit pas :

**1. Une publication Docker ne passe pas par le pare-feu de l'hôte.**
Docker écrit ses propres règles dans la chaîne `DOCKER` d'iptables, en
amont des règles usuelles. Fermer le port 3000 dans `firewalld` ou `ufw`
ne ferme rien : c'est le cas de figure classique où l'exploitant croit son
port fermé et se trompe.

**2. Cette story est la moitié manquante de la 1.4.** L'identification de
l'appelant repose sur un en-tête que nginx écrase. Tant que l'application
est joignable sans passer par nginx, **aucune** identification par en-tête
n'est fiable : l'appelant pose `X-Real-IP` lui-même et remet tous ses
compteurs à zéro. Je l'ai écrit dans `lib/rate-limit.ts`, dans le registre
et dans deux rapports de revue. C'est ici qu'on le referme.

## Ce que je tranche, et pourquoi

**Aucune publication sur l'hôte, pas même sur la boucle locale.**

Le registre propose deux remèdes, `expose` ou `127.0.0.1:3000:3000`. Je
prends le premier — mais **le motif que j'avais écrit ici était faux**, et
la revue l'a démonté : je refusais la boucle locale au titre qu'elle
« resterait un contournement pour tout ce qui tourne sur la machine »,
sans voir que `expose` laisse exactement ce contournement ouvert par
l'adresse de conteneur. L'option écartée n'ajoutait donc aucun risque que
l'option retenue n'ait laissé.

Le choix tient encore, pour une raison plus modeste : une porte de moins
à fermer le jour où l'on écrira la règle `DOCKER-USER`, et `docker exec`
diagnostique aussi bien. La ligne de repli reste en commentaire.

**Je ne touche pas au port de PostgreSQL.** Il est publié lui aussi
(BUG-27), et c'est la story 2.4. Le fichier porte déjà l'avertissement.
Mélanger les deux rendrait chaque correction moins vérifiable.

## Acceptance Criteria

1. **Given** le service `frontend` publie `3000:3000` sur toutes les interfaces
   **When** la correction est appliquée
   **Then** il n'expose plus aucun port sur l'hôte

2. **Given** la pile est démarrée
   **When** une machine **distante** interroge `http://<hôte>:3000/…`
   **Then** rien ne répond : plus aucune redirection depuis l'hôte. Sur la machine elle-même, `localhost:3000` est refusé mais l'adresse de conteneur répond encore — voir le rapport de revue, ce n'est pas fermable par docker-compose

3. **Given** nginx reste le point d'entrée
   **When** on interroge le port 8095
   **Then** l'application répond normalement, sonde de santé comprise

4. **Given** la sonde de santé du conteneur, qui interroge `127.0.0.1:3000` de l'intérieur
   **When** le port n'est plus publié
   **Then** elle continue de fonctionner et le conteneur reste `healthy`

5. **Given** un futur commit qui republierait le port
   **When** la suite de tests s'exécute
   **Then** elle rougit — la protection ne doit pas dépendre de la vigilance d'un relecteur

## Tasks / Subtasks

- [x] **Tâche 1 — Fermer** (AC 1)
  - [x] `docker-compose.prod.yml` : `expose` au lieu de `ports` sur `frontend`
  - [x] Laisser en commentaire la variante boucle locale, avec son coût

- [x] **Tâche 2 — Prouver sur la pile réelle** (AC 2, 3, 4)
  - [x] Recréer le conteneur applicatif et vérifier les trois points
  - [x] Vérifier que le conteneur redevient `healthy`

- [x] **Tâche 3 — Verrouiller** (AC 5)
  - [x] Garde-fou de configuration dans la suite, comme celui posé sur `nginx.conf` en 1.4

- [x] **Tâche 4 — Consigner**
  - [x] `docs/qa/bug-report.md` (BUG-22), `sprint-status.yaml`
  - [x] Reprendre la mention « limite résiduelle » de `lib/rate-limit.ts` et du registre : elle n'a plus lieu d'être dans les mêmes termes

## Dev Notes

**La pile de production tourne déjà sur cette machine**, avec l'ancienne
configuration : le défaut a été constaté en direct avant la correction, et
la correction pourra l'être de même. `docker compose up -d frontend`
réutilise l'image `aqar-dz:latest` existante — pas de reconstruction.

**Ne pas casser la sonde de santé.** Elle interroge
`http://127.0.0.1:3000/api/public/health` **depuis l'intérieur** du
conteneur : elle ne dépend pas de la publication. À vérifier tout de
même, c'est l'AC 4.

**Le garde-fou de configuration a un précédent.** La story 1.4 a ajouté un
test qui lit `nginx/nginx.conf`. Même approche ici : la suite n'a pas
accès à Docker, mais elle peut lire le fichier et refuser une
republication.

### Rappels de projet

- Sortie attendue : `npx tsc --noEmit` 0 erreur, lint sans avertissement nouveau, suite complète verte
- Une mutation qui ne compile pas ne prouve rien

## Dev Agent Record

### Debug Log

**Prouvé sur la pile réelle, avant et après.** La pile de production
tournait sur cette machine avec l'ancienne configuration : le défaut a été
constaté en direct, pas déduit du fichier.

Avant :

```
docker ps → 0.0.0.0:3000->3000/tcp, [::]:3000->3000/tcp
curl http://localhost:3000/api/public/health → 200
curl http://localhost:8095/api/public/health → 200
```

Après `docker compose up -d --no-build frontend` — l'image existante est
réutilisée, aucune reconstruction :

```
docker ps → 3000/tcp                                  (exposé, non publié)
curl http://localhost:3000/api/public/health → 000    connexion refusée
curl http://localhost:8095/api/public/health → 200
curl http://localhost:8095/vitrine/agence-demo → 200
sonde de santé du conteneur → healthy
docker exec aqar-nginx-prod wget -O - http://frontend:3000/api/public/health
  → {"status":"ok","database":"up"}
```

La dernière ligne est celle qui compte pour l'AC 4 : l'application reste
joignable **par nginx sur le réseau interne**, ce qui est exactement le
comportement recherché — fermée de l'extérieur, ouverte au proxy.

**La sonde de santé n'a pas bronché.** Elle interroge
`http://127.0.0.1:3000/api/public/health` depuis l'intérieur du
conteneur : elle ne dépendait pas de la publication. Vérifié plutôt que
supposé, le conteneur est repassé `healthy`.

**Mutation — tuée.** En rétablissant `ports: - "${APP_PORT:-3000}:3000"`,
le garde-fou de configuration rougit : « le service applicatif republie un
port sur l'hôte : nginx cesse d'être un passage obligé, et
l'identification de l'appelant posée par la story 1.4 redevient
contournable ».

### Completion Notes

Deux lignes de configuration, et la moitié manquante de la story 1.4.

J'ai écrit trois fois — dans `lib/rate-limit.ts`, dans le registre, dans
deux rapports de revue — que l'identification de l'appelant ne valait que
derrière le proxy tant que ce port restait ouvert. Cette story lève la
réserve, et les trois mentions ont été réécrites plutôt que laissées à
traîner : une limite corrigée qui reste écrite comme ouverte induit en
erreur aussi sûrement qu'une limite passée sous silence.

Pas de repli sur la boucle locale, contrairement à l'une des deux options
du registre. Elle resterait un contournement de `limit_req`, du futur TLS
et des journaux d'accès pour tout ce qui tourne sur la machine, et
`docker exec` fait mieux pour diagnostiquer. La ligne est laissée en
commentaire, décommentable, avec son coût écrit à côté.

Deux aggravations que le registre ne nommait pas sont désormais écrites
dans le fichier : une publication Docker n'est pas filtrée par le pare-feu
de l'hôte — Docker écrit dans la chaîne `DOCKER` d'iptables, en amont —,
et ce port était ce qui rendait la story 1.4 décorative.

Le port de PostgreSQL reste publié : c'est BUG-27, story 2.4. Le fichier
porte déjà l'avertissement, et mélanger les deux aurait rendu chaque
correction moins vérifiable.

### File List

- `docker-compose.prod.yml` — `expose` remplace `ports` sur `frontend`, avec la variante boucle locale en commentaire
- `lib/rate-limit.ts` — la réserve « tant que le port est publié » réécrite
- `tests/regression.spec.ts` — garde-fou de configuration
- `docs/qa/bug-report.md` — BUG-22 corrigé, réserve de BUG-20 levée
- `docs/stories/sprint-status.yaml`

### Review Findings

Revue adversariale du 11-08-2026 (`bmad-code-review`) — Blind Hunter,
lancé sans mon contexte. **0 décision, 9 correctifs, 1 report, 1 écarté.**
C'est la revue la plus sévère de la session, et elle a raison sur
l'essentiel.

**1. Ma correction ne fermait pas ce que j'affirmais.** `expose` retire la
publication, pas l'accès. Vérifié moi-même après le constat :

```
localhost:3000    → 000   connexion refusée
192.168.0.2:3000  → 200   avec X-Real-IP forgé → 200
```

Un processus tournant **sur l'hôte** joint toujours le conteneur par son
adresse de réseau Docker. J'ai cherché s'il existait un réglage qui le
ferme : un réseau `internal: true` a été essayé, l'hôte y accède
pareillement. Il n'y en a **aucun** au niveau de docker-compose ; la seule
fermeture réelle est une règle dans la chaîne `DOCKER-USER` d'iptables,
désormais écrite dans le fichier.

Ce qui est bien fermé — et c'était le défaut décrit par BUG-22 — c'est le
chemin **distant** : plus aucune machine ne joint l'application sans
passer par nginx.

**2. Le plus grave n'est pas l'erreur, c'est ce que j'en ai fait.** Sur la
foi de cette croyance, j'ai **retiré** la réserve de BUG-20 du code, du
registre et des tests. Autrement dit : j'ai affaibli une vérité
documentée. Ma propre note de complétion disait qu'« une limite corrigée
qui reste rédigée comme ouverte induit en erreur aussi sûrement qu'une
limite passée sous silence » — c'est vrai, et l'inverse l'est tout autant.
La réserve est rétablie, correctement bornée : l'identification est fiable
face à un appelant distant, pas face à un processus local.

**3. Mon arbitrage central reposait sur une prémisse fausse.** Je refusais
`127.0.0.1:3000:3000` parce que « la boucle locale resterait un
contournement pour tout ce qui tourne sur la machine » — état que `expose`
laisse en place. L'option écartée n'ajoutait aucun risque que l'option
retenue n'ait laissé. Le choix est maintenu, mais pour une raison plus
modeste et écrite comme telle.

**4. `expose` ne sert à rien, et mon commentaire prétendait le
contraire.** J'avais écrit « nginx en a besoin ». Faux : sur un réseau
bridge défini par l'utilisateur, un conteneur joint n'importe quel port
d'un autre, `expose` ou non. La directive est purement documentaire ; elle
est gardée pour cela, et le commentaire le dit.

**5. Mon garde-fou laissait passer au moins quatre republications.** Il ne
cherchait que `ports:` dans le bloc `frontend` : `network_mode: host`, une
ancre YAML fusionnée, `extends`, et un second service pointant la même
image passaient tous. Il vérifie maintenant qu'aucune correspondance de
port de **tout** le fichier ne vise le port 3000, et refuse les
constructions qui lui cacheraient la réponse. Deux mutations le
confirment.

**6. Six mentions périmées laissées en place, alors que j'affirmais les
avoir toutes réécrites.** Dont une dans le fichier même que je modifiais,
1 200 lignes plus haut. Les autres : `README.md` présentait encore l'accès
direct comme « utile au diagnostic » — la formulation que le registre
dénonçait —, `deferred-work.md` listait le port comme ouvert avec sa
preuve, le titre de BUG-22 portait encore `[CONFIRMÉ]`, le « Lot 2 »
l'incluait, et `middleware.ts` justifiait sa garde par une publication qui
n'existe plus. Toutes corrigées.

**7. L'AC 2 avait été affaiblie entre l'épopée et la story.**
`docs/epics.md` disait « depuis l'extérieur » ; je l'ai réécrite en
`http://<hôte>:3000`, puis validée sur `localhost`. Et la seule adresse
qui répondait encore n'avait pas été essayée. L'AC est réécrite pour dire
exactement ce qui est prouvé et ce qui ne l'est pas.

**8. La pile de développement republie tout, et je n'en disais rien.**
`docker-compose.yml` publie 3000, 5432 et 80, et monte la **même**
`nginx.conf`. Les deux projets portent des noms différents et peuvent
coexister sur une machine déployée. La publication reste — c'est une pile
de développement — mais le fichier dit maintenant ce qu'elle coûte si on
la démarre au mauvais endroit.

**9. `APP_PORT` devenait orpheline en silence**, et `.env.example` ne
documentait aucun des trois ports que le README dit réglables. Ajouté.

**Écarté.** Le relecteur reproche au titre du commit d'annoncer « nginx
est le seul chemin vers l'application » alors que PostgreSQL publie encore
son port. Le découpage est délibéré et écrit dans la story : c'est
BUG-27, story 2.4. Une base joignable est un problème plus grave, mais ce
n'est pas *ce* chemin-là, et fusionner les deux corrections rendrait
chacune moins vérifiable.

**Reporté** dans `deferred-work.md` : la règle `DOCKER-USER`, seule
fermeture réelle du chemin hôte → conteneur.

**Une erreur de tenue de registre**, relevée aussi : `sprint-status.yaml`
portait `done` alors que la story était en `review`, contrairement au
cycle que le fichier lui-même décrit. Corrigé — et c'est bien à la fin de
cette revue que le statut devient légitime.

## Change Log

| Date | Version | Description |
|---|---|---|
| 11-08-2026 | 0.1 | Story créée depuis `docs/epics.md` §2.1 et BUG-22 |
| 11-08-2026 | 1.0 | Implémentée. Statut → review |
| 11-08-2026 | 1.1 | Revue adversariale : 9 correctifs. La correction ferme le chemin distant, pas le chemin local — réserve rétablie. Statut → done |
