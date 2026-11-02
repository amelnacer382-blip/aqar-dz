# Story 2.4: Fermer et durcir la base

Status: done

## Story

As a exploitant,
I want que la base ne soit joignable que depuis le réseau interne, avec un mot de passe propre à l'installation,
so that un pare-feu mal réglé ne suffise pas à tout perdre.

**Couvre :** BUG-27 (défaut n° 18) · NFR-04
**Fichiers :** `docker-compose.prod.yml`, `.env`, `.env.example`

## Le défaut

```yaml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-aqar_password}
ports:
  - "${POSTGRES_PORT:-5433}:5432"
```

Deux choses, et c'est leur conjonction qui coûte cher : le port de la base
est publié **sur toutes les interfaces** par défaut, et le mot de passe de
repli est `aqar_password` — une valeur écrite dans le dépôt.

Vérifié sur la machine : `0.0.0.0:5433` et `[::]:5433` en écoute.

Le fichier avertit — « sur un serveur exposé à Internet, supprimez cette
section » — mais le comportement **par défaut** reste l'exposition, quand
la posture sûre serait l'inverse. Un pare-feu mal réglé devient alors une
compromission totale : lecture et écriture de toutes les agences, de tous
les documents, de tous les comptes. C'est un cran au-dessus du port
applicatif fermé par la story 2.1 — une écriture directe en base ne
rencontre aucune des gardes du code.

## Ce que je tranche, et pourquoi

**Le port est lié à `127.0.0.1`, pas supprimé.** L'AC de l'épopée offre
les deux ; ici, la suppression casserait le poste de travail, et il faut
le dire avant de l'écrire :

```
.env:24  DATABASE_URL=postgresql://…@localhost:5433/aqar_db
```

C'est l'adresse **vue depuis l'hôte**, celle qu'utilisent `npm run dev`,
Prisma Studio, les sauvegardes — et la suite de tests, qui lance
`next start` sur la machine et non dans Docker. Retirer la publication
rendrait la suite inexécutable.

Ce n'est pas un compromis à contrecœur : pour une base de données, la
menace est l'accès **distant**. `127.0.0.1:5433:5432` la ferme
entièrement à toute autre machine tout en laissant le poste travailler.
Le conteneur applicatif, lui, n'est pas concerné — il joint `postgres`
par le réseau Docker.

**Le repli de mot de passe ne disparaît pas : il devient une erreur de
démarrage.** `${POSTGRES_PASSWORD:?…}` fait échouer `docker compose` avec
un message, là où retirer simplement `:-aqar_password` laisserait compose
substituer une chaîne vide — donc un `DATABASE_URL` malformé et une
panne obscure. Échouer tôt, avec la raison.

`POSTGRES_USER` et `POSTGRES_DB` gardent leur repli : ce ne sont pas des
secrets.

**Le mot de passe de cette installation est effectivement changé.**
L'AC 3 le demande, et une story qui laisserait `aqar_password` en place
n'aurait corrigé que la documentation. Deux points à ne pas manquer :
changer `POSTGRES_PASSWORD` **ne change rien** à une base déjà
initialisée — PostgreSQL ne lit cette variable qu'au premier démarrage,
il faut un `ALTER USER` — et `.env` porte le mot de passe **à deux
endroits**, dont l'URL vue depuis l'hôte.

## Acceptance Criteria

1. **Given** `POSTGRES_PASSWORD` a aujourd'hui `aqar_password` comme valeur de repli
   **When** la variable n'est pas renseignée
   **Then** `docker compose` échoue avec un message qui dit quoi poser, au lieu de démarrer sur une valeur devinable ou vide

2. **Given** le port `5433` est publié sur toutes les interfaces
   **When** la correction est appliquée
   **Then** il n'est plus lié qu'à `127.0.0.1` : injoignable depuis une autre machine

3. **Given** le poste de travail, qui atteint la base par `localhost:5433`
   **When** la correction est appliquée
   **Then** `npm run dev`, Prisma et la suite de tests continuent de fonctionner

4. **Given** l'installation en cours, qui tourne sur `aqar_password`
   **When** la story est terminée
   **Then** un mot de passe réel a été généré, appliqué à l'utilisateur en base, et la pile redémarre dessus

5. **Given** un futur commit qui republierait la base sur toutes les interfaces
   **When** la suite s'exécute
   **Then** elle rougit

6. **Given** `.env.example`
   **When** quelqu'un part de ce fichier
   **Then** il sait qu'il doit générer un mot de passe, et comment

## Tasks / Subtasks

- [x] **Tâche 1 — Fermer et durcir** (AC 1, 2)
  - [x] `docker-compose.prod.yml` : `127.0.0.1:${POSTGRES_PORT:-5433}:5432`
  - [x] `${POSTGRES_PASSWORD:?…}` aux quatre endroits où la variable est lue
  - [x] Commenter ce que la liaison locale ferme et ce qu'elle ne ferme pas

- [x] **Tâche 2 — Changer le mot de passe de cette installation** (AC 4)
  - [x] Générer une valeur, l'appliquer par `ALTER USER`, mettre `.env` à jour aux deux endroits
  - [x] Recréer les services qui portent `DATABASE_URL`
  - [x] Vérifier : conteneurs `healthy`, application servie par nginx, suite verte

- [x] **Tâche 3 — Verrouiller et documenter** (AC 5, 6)
  - [x] Garde-fou de configuration, étendu à la base
  - [x] `.env.example` : comment générer le mot de passe

- [x] **Tâche 4 — Consigner**
  - [x] `docs/qa/bug-report.md` (BUG-27), `sprint-status.yaml`

## Dev Notes

**`POSTGRES_PASSWORD` n'est lu qu'à l'initialisation du volume.** Changer
la variable sur une base existante ne change pas le mot de passe de
l'utilisateur : il faut `ALTER USER`. Se contenter de la variable
donnerait une pile qui ne démarre plus, et un diagnostic pénible.

**Le mot de passe figure deux fois dans `.env`** — `POSTGRES_PASSWORD`
(ligne 18) et l'URL vue depuis l'hôte (ligne 24). Oublier la seconde
casse `npm run dev` et la suite de tests, pas la pile Docker : le
symptôme apparaîtrait loin de la cause.

**Ne pas toucher au port applicatif.** Il a été traité par la story 2.1,
et sa limite résiduelle — accès depuis l'hôte par l'adresse de conteneur —
vaut ici aussi : lier la base à `127.0.0.1` ne l'empêche pas d'être jointe
par l'adresse du conteneur depuis la machine. Même remède, même
`DOCKER-USER`, déjà consigné.

### Rappels de projet

- Sortie attendue : `npx tsc --noEmit` 0 erreur, lint sans avertissement nouveau, suite complète verte
- Ne jamais restaurer une mutation par `git checkout -- <fichier>`
- Une mutation qui ne compile pas ne prouve rien

## Dev Agent Record

### Debug Log

**AC 1 — prouvé en exécutant compose sans la variable :**

```
$ env -u POSTGRES_PASSWORD docker compose --env-file /dev/null \
        -f docker-compose.prod.yml config
error while interpolating services.postgres.environment.POSTGRES_PASSWORD:
required variable POSTGRES_PASSWORD is missing a value: variable requise.
Generez-en une avec `openssl rand -base64 24` puis posez-la dans .env
```

**Le message d'erreur a dû être réécrit** : il contenait `: `, que YAML
lit comme une clé, et le fichier ne se chargeait plus du tout — panne pire
que le défaut. `go-yaml load error in scanner at L29`.

**AC 2 et 3 — prouvés sur la pile réelle :**

```
avant : 0.0.0.0:5433 et [::]:5433 en écoute
après : 127.0.0.1:5433->5432/tcp, et rien d'autre
        ss -ltn → LISTEN 127.0.0.1:5433
requête métier depuis l'hôte → OK
suite complète (99 tests) → verte, et elle atteint la base par localhost:5433
```

La suite verte **est** la preuve de l'AC 3 : elle lance `next start` sur la
machine et se connecte par le `DATABASE_URL` vu depuis l'hôte.

**AC 4 — mot de passe changé pour de bon.** `ALTER USER` appliqué,
`.env` mis à jour aux deux endroits, services recréés, et l'ancien mot de
passe vérifié comme refusé depuis le réseau Docker :

```
PGPASSWORD=aqar_password psql -h postgres -U aqar_user
  → FATAL: password authentication failed for user "aqar_user"
```

**Deux incidents pendant la rotation, tous deux instructifs.**

**1. J'ai corrompu `DATABASE_URL` avec une expression régulière.** Le
remplacement `re.sub(r"(…:)[^@]*(@)", r"\1" + motdepasse + r"\2", ligne)`
insère le mot de passe **dans le motif de remplacement** : un mot de passe
hexadécimal commençant par un chiffre y est relu comme une référence de
groupe (`\1` suivi de `3` devient `\13`). La ligne est ressortie en
`DATABASE_URL=Dfb907cab…`, sans schéma. Reconstruite ensuite sans regex, à
partir des composants. C'est exactement la classe de défaut que je
reproche au code des autres — une donnée qui devient de la syntaxe.

**2. Recréer le conteneur applicatif a mis nginx hors service.** Après
`docker compose up -d postgres frontend`, `:8095` répondait **502** alors
que les deux conteneurs étaient `healthy`. nginx tournait depuis 21 h et
avait résolu `frontend` **une seule fois, au démarrage** : le bloc
`upstream` ne re-résout pas. Un `docker restart aqar-nginx-prod` a suffi.

Ce n'est pas un détail d'exploitation : `docker compose up -d frontend`
seul — le geste naturel d'un déploiement — laisse le site en 502 sans
qu'aucun conteneur ne paraisse en défaut. Consigné dans
`deferred-work.md`.

**Mutations — deux, tuées.** Republier la base sur toutes les interfaces,
puis rétablir le repli `:-aqar_password` : le garde-fou rougit dans les
deux cas.

### Completion Notes

La publication est **conservée**, liée à `127.0.0.1`. La supprimer aurait
cassé le poste de travail : `.env` porte un `DATABASE_URL` vu depuis
l'hôte, dont dépendent `npm run dev`, Prisma Studio, les sauvegardes et
la suite de tests — qui lance `next start` sur la machine, pas dans
Docker. Ce n'est pas un compromis à contrecœur : pour une base, la menace
est l'accès distant, et il est entièrement fermé.

Le repli du mot de passe ne disparaît pas, il devient une **erreur de
démarrage**. Retirer simplement `:-aqar_password` aurait laissé compose
substituer une chaîne vide, donc un `DATABASE_URL` malformé et une panne
obscure. `${POSTGRES_PASSWORD:?…}` échoue tôt, avec la raison.

Le mot de passe de cette installation a été réellement changé — il est
dans `.env`, généré par `openssl rand -hex 24`. Le format hexadécimal est
délibéré : il ne contient aucun caractère à échapper dans une URL de
connexion.

**Trouvé en chemin, et fermé :** `.gitignore` listait `.env` et quatre
variantes nommées, mais pas `.env.*`. La sauvegarde que j'avais prise
avant la rotation — `.env.avant-2-4`, contenant l'ancien mot de passe —
était donc **suivie par git**. Elle a été effacée avant tout commit, et le
motif est désormais `.env.*` avec `!.env.example`.

Reste ouvert, comme pour le service applicatif : un processus tournant sur
l'hôte joint le conteneur par son adresse de réseau Docker. La liaison
locale n'y change rien, et seule une règle `DOCKER-USER` le ferme. Déjà
consigné.

### File List

- `docker-compose.prod.yml` — base liée à `127.0.0.1`, `POSTGRES_PASSWORD` exigée aux quatre points de lecture
- `.env` — mot de passe généré, appliqué aux deux endroits *(hors dépôt)*
- `.env.example` — comment générer le mot de passe, et les deux endroits où il figure
- `.gitignore` — `.env.*` couvert, `.env.example` conservé
- `tests/regression.spec.ts` — garde-fou étendu à la base
- `docs/qa/bug-report.md`, `docs/stories/deferred-work.md`, `docs/stories/sprint-status.yaml`

### Review Findings

Revue adversariale du 11-08-2026 (`bmad-code-review`) — Blind Hunter,
lancé sans mon contexte. **0 décision, 8 correctifs, 3 reports, 0 écarté.**

**1. Le défaut était intact, en entier, dans le fichier voisin.**
`docker-compose.yml` — la pile de développement portait les **deux
moitiés** de BUG-27 : `POSTGRES_PASSWORD: aqar_password` en clair et
`5432:5432` sur toutes les interfaces. Un `docker compose up -d`, la
commande par défaut, publiait donc une base au réseau avec un mot de passe
que n'importe qui lit dans le dépôt. Volume distinct, donc pas de fuite
des données actuelles — mais mon commit affirmait « la menace est l'accès
distant, et il est entièrement fermé », ce qui était faux au niveau du
dépôt. Aggravant : la story 2.1 **avait déjà écrit** que ce fichier publie
5432, et je n'ai pas fait le lien deux stories plus tard.

La base de développement est maintenant liée à `127.0.0.1`. Le mot de
passe en clair reste, et c'est assumé : données de démonstration, volume
séparé, un secret de plus à se transmettre pour rien. Ce qui n'était pas
assumable, c'est la conjonction — mot de passe public **et** port ouvert.

**2. `.env.example` gardait `aqar_password` comme valeur active**, dans le
fichier même où je venais d'écrire qu'un mot de passe de repli
« reviendrait à écrire un mot de passe dans le dépôt ». Le fichier se
contredisait vingt-quatre lignes plus bas. Pire : cette ligne pointait
l'hôte `postgres`, injoignable depuis la machine, si bien qu'un
`cp .env.example .env` cassait `npm run dev` sans dire pourquoi — le
« symptôme loin de la cause » que le fichier prétend prévenir. Une seule
définition subsiste, avec un marqueur à remplacer.

**3. Mon garde-fou se contournait avec un commentaire de fin de ligne.**
`- "5433:5432" # temporaire` ne se termine plus par `:5432`, donc n'était
jamais examiné. Ignorait aussi la syntaxe longue (`target:` /
`published:`) et le suffixe `/tcp`. Il lit maintenant les **deux**
fichiers compose, retire les commentaires de fin de ligne, refuse la
syntaxe longue qu'il ne sait pas lire. Trois mutations le confirment,
dont les deux qui passaient auparavant.

**4. Mon assertion sur le mot de passe ne vérifiait pas ce que je
prétendais.** `expect(brut).toContain("POSTGRES_PASSWORD:?")` portait sur
le fichier **avant** filtrage des commentaires — un commentaire suffisait
à la satisfaire — et n'exigeait qu'une occurrence sur les quatre points de
lecture. Trois pouvaient redevenir `${POSTGRES_PASSWORD}` sans un mot :
chaîne vide substituée, `DATABASE_URL` malformé, soit exactement la panne
obscure que la story dit avoir voulu éviter. Le test compte désormais les
lectures et exige qu'elles soient toutes protégées.

**5. Même classe de défaut que celui dont je me félicitais, sur le fichier
voisin.** J'ai signalé fièrement que `.gitignore` ne couvrait pas
`.env.*`. Il ne couvrait pas non plus `*.sql` — et `README.md` prescrit
`pg_dump … > sauvegarde.sql` **à la racine du dépôt**. Un `git add -A`
après une sauvegarde y versait comptes, empreintes de mots de passe,
documents, toutes les agences. La procédure écrit maintenant hors du
dépôt, et `*.sql` est ignoré (les migrations Prisma exceptées).

**6. Le README prescrivait l'inverse de ma décision.** Il demandait de
« retirer la publication du port `postgres` » — ce que la story a
délibérément refusé de faire. Un exploitant qui le suivait cassait
`npm run dev`, Prisma Studio et la suite de tests, sans indice. Réécrit.

**7. « Les sauvegardes » ne dépendent pas du port publié.** Je l'ai écrit
trois fois pour justifier la liaison locale. La seule procédure du dépôt
passe par `docker exec … pg_dump`, donc par le conteneur. Les trois autres
usages cités — `npm run dev`, Prisma Studio, la suite de tests — sont
exacts, et le relecteur a vérifié la chaîne complète pour la suite.

**8. « Fermé aux autres machines » repose sur le démon, pas sur le
fichier.** Depuis Docker 28, le routage direct vers les adresses de
conteneurs est bloqué par défaut ; sur un démon plus ancien, une machine
du réseau local qui ajoute une route vers le sous-réseau Docker
atteindrait le conteneur. Aucun test ne le vérifie et la version du démon
n'est contrainte nulle part. Écrit dans le fichier et dans le registre.

**Reportés** : le sous-réseau non épinglé, tombé sur `192.168.0.0/20` —
donc susceptible de chevaucher le réseau local d'un serveur, et rendant
non déterministe la règle `DOCKER-USER` recommandée ; le profil `seed`
disponible en production avec des comptes de démonstration à mot de passe
public ; et le coût d'une construction complète pour un garde-fou qui ne
lit qu'un fichier.

**Ce que la revue a confirmé, et qui comptait :** aucun secret n'a jamais
été commité — `git log --all --diff-filter=A` ne montre que
`.env.example` parmi les chemins `.env*` —, la liaison locale est réelle
(`ss -ltn` → `LISTEN 127.0.0.1:5433`, et rien d'autre), et
`${POSTGRES_PASSWORD:?…}` est bien posé aux quatre points de lecture.

## Change Log

| Date | Version | Description |
|---|---|---|
| 11-08-2026 | 0.1 | Story créée depuis `docs/epics.md` §2.4 et BUG-27 |
| 11-08-2026 | 1.0 | Implémentée, mot de passe réellement changé. Statut → review |
| 11-08-2026 | 1.1 | Revue adversariale : 8 correctifs, dont le même défaut resté entier dans la pile de développement. 99 tests verts, 3 mutations tuées. Statut → done |
