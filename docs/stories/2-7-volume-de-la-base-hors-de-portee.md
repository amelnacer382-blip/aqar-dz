---
baseline_commit: d743a69
---

# Story 2.7 : Mettre le volume de la base hors de portée d'un `down -v`

Status: done *(17-08-2026 — **T8 faite par l'éditeur, bascule en service et
mesurée.** `REP-103` est fermé. **T2 n'a pas été faite** et ne peut plus
l'être : l'empreinte d'avant n'a pas été relevée. L'AC-6 est tenu par une
mesure différente et plus forte — les deux volumes portent toujours leur
date de création du 09-08, donc ils n'ont pas été recréés. C'est écrit en
T2, non coché.)*

**Épopée :** 2 — Durcir le déploiement
**Couvre :** REP-103
**Découpage :** [`docs/epics.md`](../epics.md) — Epic 2, story 2.7
**Dépend de :** rien
**Bloque :** rien — mais chaque jour sans elle est un jour où une frappe efface le produit
**Date :** 17 août 2026

---

## Story

**As a** exploitant,
**I want** que la commande la plus banale de Docker Compose ne puisse pas
effacer la base,
**so that** une erreur de frappe à deux heures du matin ne coûte pas toutes
les données du produit.

---

## Le constat, et pourquoi il n'est pas théorique

**Le dépôt connaît ce danger, l'écrit deux fois, et ne s'en protège nulle
part.**

```
README.md:192            « elles survivent aux redéploiements, mais pas à un
                           `down -v` ni à un changement de machine »
docs/architecture.md:351 | `local` | … | survit au redéploiement, pas à `down -v` |
```

Deux avertissements en prose, zéro garde. Entre les deux, `README.md:180`
rassure le lecteur — *« Arrêt (les volumes, donc les données, sont
conservés) »* — juste au-dessus de la commande à laquelle il suffit
d'ajouter trois caractères pour tout perdre. C'est la configuration exacte
qui produit l'accident : un lecteur informé, une habitude, et rien qui
arrête le geste.

Les deux volumes concernés sont `aqar-prod_postgres_data` — **la base**,
c'est-à-dire tous les comptes, agences, biens, contrats et paiements — et
`aqar-prod_uploads_data`, où vivent **toutes les photos et toutes les pièces
téléversées**, y compris les `piece_identite` et `acte_propriete` que
`docs/architecture.md` §6 nomme.

Et il n'y a **aucune sauvegarde automatique** : la story 0.1 est
`ready-for-dev` et bloquée sur des arbitrages. Aujourd'hui, `down -v` est
définitif au sens strict.

> **D'où vient ce constat.** Il n'a pas été lu, il a été rencontré : le
> 17-08-2026, la story 2.6 avait besoin d'une base jetable et j'ai demandé à
> l'éditeur la permission d'un risque au lieu de le supprimer. La bonne
> réponse n'était pas d'être prudent. C'est `REP-103`.

---

## Acceptance Criteria

### AC-1 — `down -v` cesse d'atteindre les données

**Given** `docker-compose.prod.yml:227-229` déclare `postgres_data` et `uploads_data` en volumes ordinaires
**When** ils sont déclarés `external: true` avec leur `name:` complet
**Then** `docker compose -f docker-compose.prod.yml down -v` les laisse intacts
**And** la mutation le prouve : remettre la déclaration ordinaire, constater la suppression **sur un projet jetable**, rétablir

> **Mesuré le 17-08-2026, hors du projet, sur deux volumes bidons.** Ce n'est
> pas une lecture de documentation :
>
> ```
> $ docker compose -p t-ext -f compose.yml down -v
>     Volume t-ext_jetable Removing
>     Volume t-ext_jetable Removed
> $ docker volume ls -q | grep essai-volume-sacre
>     essai-volume-sacre          ← déclaré `external: true`, épargné
> ```
>
> Le volume ordinaire part, l'`external` reste, **et Compose n'émet aucun
> avertissement** — ni sur celui qu'il supprime, ni sur celui qu'il saute.

### AC-2 — Le nom est exact, et vérifié contre le réel

**Given** un volume `external` n'est **jamais créé** par Compose
**When** le `name:` ne désigne aucun volume existant
**Then** la pile refuse de monter, **aucun conteneur n'est créé**, et la commande sort en **1**
**And** le `name:` retenu est vérifié caractère par caractère contre `docker volume ls`, **avant** toute application à la pile en service

> **Mesuré le 17-08-2026** sur le même projet jetable :
>
> ```
> $ docker compose -p t-ext -f absent.yml up
>   external volume "volume-qui-nexiste-pas" not found
> $ echo $?
>   1
> $ docker ps -a --filter name=t-ext
>   (aucun conteneur)
> ```
>
> **Le message est explicite et l'échec est propre** — il ne démarre pas
> à moitié. C'est ce qui rend l'AC-3 acceptable : se tromper de nom coûte un
> redémarrage, pas des données.

### AC-3 — Le développement est tranché explicitement, pas par omission

**Given** `docker-compose.yml` (développement) déclare les mêmes deux noms de volumes
**When** la story est terminée
**Then** le choix retenu pour le développement est écrit **avec son motif**, dans le fichier lui-même

> **Le motif est mesuré, et il penche d'un côté.** `docker-compose.prod.yml`
> porte `name: aqar-prod` (ligne 19) ; `docker-compose.yml` **n'a pas de
> `name:`**, son projet vaut donc le nom du répertoire. Ses volumes seraient
> `aqar_postgres_data` et `aqar_uploads_data` — et **ni l'un ni l'autre
> n'existe** aujourd'hui (`docker volume ls -q | grep aqar` → les deux
> `aqar-prod_*` seulement).
>
> Les déclarer `external` ferait donc échouer `docker compose up` **sur tout
> poste neuf**, par l'AC-2. Une base de développement se jette ; c'est même
> ce qu'on veut d'elle. **La recommandation est de ne pas y toucher et
> d'écrire pourquoi** — mais c'est un arbitrage, et il s'écrit.

### AC-4 — Le premier déploiement sait qu'il doit créer les volumes

**Given** le `README` décrit un premier déploiement en trois étapes (`README.md:83-98`)
**When** la story est terminée
**Then** il dit que les volumes `external` doivent être **créés à la main avant le premier `up`**, et donne la commande
**And** il dit **ce qui se passe si on l'oublie** — le message exact de l'AC-2 — pour que le lecteur reconnaisse la panne au lieu de la diagnostiquer

### AC-5 — Un invariant statique garde la déclaration

**Given** `tests/deploiement.spec.ts` garde déjà des invariants de configuration par lecture de fichier
**When** quelqu'un retire `external: true` ou change le `name:`
**Then** un cas de cette suite rougit, **et son message désigne le volume concerné**
**And** la mutation le prouve : retirer la ligne, constater le rouge, **lire le message**, rétablir

> ⚠ **Ce test ne prouve pas la protection, seulement la déclaration.**
> L'en-tête du fichier le dit déjà de lui-même — *« Ce fichier ne teste PAS
> le produit servi. Il lit un fichier sur le disque. »* Ne pas lui faire
> prétendre davantage : la preuve du comportement est la mutation de l'AC-1,
> jouée à la main sur un projet jetable.

### AC-6 — La pile en service redémarre sur les mêmes données

**Given** la bascule est appliquée à `docker-compose.prod.yml`
**When** l'éditeur relance la pile
**Then** l'application sert **les données existantes** et non une base vide
**And** c'est vérifié par une lecture, pas par l'absence d'erreur : la sonde répond `200 {"schema":"a-jour"}` et un décompte d'agences est **identique avant et après**

> **Pourquoi cet AC existe.** Un `name:` erroné fait échouer le démarrage
> (AC-2), donc bruyamment. Mais un `name:` qui désignerait un **autre**
> volume existant démarrerait très bien, sur une base vide, et le produit
> aurait l'air neuf plutôt que cassé. Le décompte avant/après est la seule
> mesure qui distingue les deux.

---

## Tasks / Subtasks

- [x] **T1** (AC-2) — Noms réels relevés : `aqar-prod_postgres_data` et `aqar-prod_uploads_data`. Ils correspondent bien à `name: aqar-prod` (`docker-compose.prod.yml:19`) + la clé déclarée.
- [~] **T2** (AC-6) — ⛔ **NON FAITE, ET ELLE NE PEUT PLUS L'ÊTRE :** l'empreinte d'avant n'a pas été relevée avant le `up -d --build` du 17-08-2026. Écrire « non fait, et voici pourquoi » est un résultat (`CLAUDE.md` §9) ; cocher aurait été un mensonge.
      ⬜ **Dépassée par une mesure plus forte, et c'est ce qui sauve l'AC-6.** Un décompte avant/après aurait prouvé que les *lignes* sont les mêmes. `docker volume inspect` prouve que le **stockage lui-même n'a pas bougé** : `aqar-prod_postgres_data` et `aqar-prod_uploads_data` portent tous deux `CreatedAt = 2026-08-09T12:28:41+01:00` — leur date d'origine, huit jours avant la bascule. Un volume recréé porterait la date du jour. Et `docker inspect aqar-postgres-prod` montre qu'ils sont bien ceux montés par les conteneurs en marche. La donnée n'a pas été comparée : elle n'a pas été touchée.
- [x] **T3** (AC-1, AC-2) — **Éprouvé sur le projet jetable `t7`**, trois branches, détail sous « Preuves ». Rouge obtenu sur la déclaration d'aujourd'hui (`Volume t7_postgres_data Removed`, marqueur perdu), vert sur la bascule (`down -v` ne mentionne même pas le volume), et le piège du `name:` faux mesuré. ~~Éprouver la bascule sur un projet jetable d'abord~~ : un `compose.yml` de trois lignes dans le répertoire de travail temporaire, jamais dans le dépôt, avec des volumes bidons. Rejouer les deux mesures ci-dessus sur la forme exacte qui sera écrite dans `docker-compose.prod.yml`.
- [x] **T4** (AC-1) — Appliqué. `docker compose config` résout bien les deux `name:`, et ils ont été **comparés à `docker volume ls`** : identiques, aucun écart. ~~Appliquer à `docker-compose.prod.yml`~~ : `external: true` + `name: aqar-prod_postgres_data` et `name: aqar-prod_uploads_data`, avec un commentaire portant le motif, la date et la mesure (convention du dépôt : un commentaire dit *pourquoi*).
- [x] **T5** (AC-3) — Tranché : les volumes de développement **restent ordinaires**, motif écrit dans le fichier. Deux raisons, la première mesurée — `docker volume ls -q | grep '^aqar_'` ne rend rien, donc `external` casserait tout poste neuf ; et une base de développement se jette, `--profile seed` la refait. ~~Trancher pour `docker-compose.yml`~~, écrire le motif **dans le fichier**. Recommandation : ne pas rendre les volumes de développement `external`, parce qu'aucun n'existe et que la contrainte casserait tout poste neuf.
- [x] **T6** (AC-4) — Fait, et la procédure est **renumérotée** : la création des volumes devient l'étape 2, le `up -d --build` passe en 3, le renvoi « le seul geste sûr est celui de l'étape 2 » corrigé en conséquence. Le message d'échec exact y figure. Deux affirmations devenues fausses corrigées (`README.md:217`). ~~`README.md` :~~ la commande de création des volumes dans la procédure de premier déploiement, et le message d'échec exact si on l'oublie.
- [x] **T7** (AC-5) — Invariant posé. **Deux mutations jouées séparément**, chacune avec son retour au vert, messages lus et vérifiés qu'ils désignent la bonne cause ; les deux tests voisins sont restés verts dans les deux cas. ~~Invariant dans `tests/deploiement.spec.ts`~~, **prouvé par mutation**, message d'échec lu et vérifié qu'il nomme le volume.
- [x] **T8** (AC-6) — **FAITE le 17-08-2026 par l'éditeur**, en même temps que la mise en service de la story 2.8 : `COMMIT_SHA=… docker compose -f docker-compose.prod.yml up -d --build`. **La commande a abouti**, ce qui est en soi la moitié de la preuve : si l'un des deux `name:` n'avait désigné aucun volume, Compose serait sorti en `1` sans créer un seul conteneur. Vérifié ensuite : `docker compose config` rend `external=True` avec les deux noms exacts, et `postgres` n'a même pas été recréé (`✔ Container aqar-postgres-prod Healthy`). **La bascule est en service, et `down -v` n'atteint plus les données.**
- [x] **T9** — Fait. La ligne du tableau §6 est corrigée par rature, et §7 gagne le motif complet, la mesure et les trois conséquences. ~~`docs/architecture.md` §6 et §7 :~~ la ligne « survit au redéploiement, pas à `down -v` » devient fausse pour la production. La corriger là où elle est, sans la supprimer — elle reste vraie pour le développement.
- [~] **T10** — `npx tsc --noEmit` **0** · `npm run lint` **0 erreur** · `npm run test:e2e` **143 passed** (142 avant, plus le nouveau cas ; §2, accord donné) · `sprint-status.yaml` à jour · File List vérifiée par `git diff --name-only`.
      ✅ **REP-103 marqué résolu le 17-08-2026**, après T8 et pas avant. La phrase précédente disait : « le marquer maintenant serait exactement le mensonge commode écarté la veille sur REP-96 ». Elle a tenu — la mise en service a eu lieu, elle a été mesurée, et c'est elle qui autorise la clôture.

---

## Dev Notes

### Ce qui doit être écrit, exactement

```yaml
volumes:
  postgres_data:
    # Sorti de portee de `docker compose down -v` le 17-08-2026 (REP-103).
    # Mesure : un volume `external` survit a `down -v`, SANS AVERTISSEMENT ;
    # un volume ordinaire est supprime. Ce volume EST la base (§12, regle 5),
    # et aucune sauvegarde automatique n'existe encore (story 0.1).
    # `name:` est OBLIGATOIRE : sans lui, Compose chercherait un volume
    # nomme `postgres_data` et refuserait de monter la pile.
    external: true
    name: aqar-prod_postgres_data
  uploads_data:
    # Meme motif : ce volume porte toutes les photos et toutes les pieces
    # televerees, dont les `piece_identite` et `acte_propriete`.
    external: true
    name: aqar-prod_uploads_data
```

**Le `name:` n'est pas une commodité, c'est la moitié du correctif.** Sans
lui, `external: true` fait chercher un volume littéralement appelé
`postgres_data` — qui n'existe pas — et la pile ne démarre plus. Le préfixe
`aqar-prod_` vient de `name: aqar-prod` (`docker-compose.prod.yml:19`) : ce
sont les noms que Docker a donnés aux volumes lors du premier `up`, et ils ne
changent pas parce qu'on ajoute `external`.

### Trois choses à ne surtout pas faire

1. **Ne jamais lancer `docker compose -f docker-compose.prod.yml down -v`**
   pour « vérifier que ça marche ». C'est la commande dont on se protège, et
   tant que la bascule n'est pas appliquée elle fait exactement ce qu'on
   craint. La mutation de l'AC-1 se joue sur un **projet jetable**.
2. **Ne jamais lancer `docker volume rm aqar-prod_postgres_data`.** `external`
   ne protège pas de cette commande-là, et rien ne le fera.
3. **Ne pas créer de `compose.yml` de test dans le dépôt.** Le répertoire de
   travail temporaire de la session, jamais l'arborescence suivie par git.

### Ce que cette story rend atteignable — `CLAUDE.md` §8

**Un premier déploiement acquiert une étape obligatoire.** Avant : `up -d
--build` suffisait, Docker créait les volumes. Après : il faut les créer
d'abord, sinon rien ne démarre. C'est un échange assumé — on remplace un
risque de **perte définitive** par un risque d'**installation qui ne
démarre pas**, dont l'AC-2 a mesuré qu'il est bruyant, propre et explicite.

**Deux conséquences à ne pas découvrir plus tard :**

- **L'installation existante ne voit rien changer** : les deux volumes
  existent déjà sous les noms exacts. La bascule est transparente pour la
  machine de l'éditeur, et ne l'est **pas** pour une machine neuve. C'est
  l'AC-4 qui l'absorbe.
- **La restauration de sauvegarde de la story 0.1 devra créer le volume
  avant de restaurer.** À écrire dans le `README` (T6) plutôt que dans la
  story 0.1, qui n'existe pas encore comme code — sinon la 0.1 héritera
  d'une contrainte que personne ne lui aura dite.

### Ce que la bascule fait à la pile en marche

**`up -d` après la bascule recrée les conteneurs.** La définition des volumes
change, donc Compose ne peut pas réutiliser les conteneurs existants. Compter
une interruption courte, et le `healthcheck` du `frontend` met une trentaine
de secondes à repasser `healthy` (`docker-compose.prod.yml`, intervalle 30 s).
Ce n'est pas une panne, mais l'éditeur doit le savoir **avant** de lancer et
non pendant.

**Et un point qui n'est pas mesuré, donc pas affirmé.** L'AC-2 a mesuré
qu'un `name:` absent fait échouer `up` sans créer aucun conteneur — mais
**sur un projet qui n'en avait aucun**. Ce que fait le même échec face à une
pile **déjà en marche** n'a pas été éprouvé. Le comportement attendu est
qu'elle continue de tourner, Compose validant les volumes avant d'agir ;
**c'est une attente, pas une mesure**. La vérifier en T8, ou constater qu'on
ne l'a pas vérifiée — les deux sont des résultats, la supposition silencieuse
n'en est pas un.

### Hors périmètre, explicitement

Pour que la story ne grossisse pas en cours de route :

- **La sauvegarde** — c'est la story 0.1, et elle ne se replie pas ici.
- **Les instantanés de volume, la réplication, un `pg_dump` planifié** —
  même raison.
- **Passer les volumes en montages liés (`bind mounts`)** pour les voir dans
  l'arborescence : c'est un autre arbitrage, avec ses propres conséquences de
  droits et de sauvegarde. Si l'idée revient, elle prend un `REP-nn`.
- **`docker volume rm`** reste possible et le restera. On ferme le geste
  accidentel, pas le geste délibéré.

### Pourquoi ce n'est pas une sauvegarde, et pourquoi c'est quand même utile

Une rambarde, pas un filet. Passent dessous : `docker volume rm` explicite,
un disque mort, une corruption de PostgreSQL, une machine perdue. Le filet
est la **story 0.1** (`ready-for-dev`, bloquée sur la juridiction, le
fournisseur et cinq valeurs).

**Les deux sont nécessaires et aucune ne remplace l'autre** — c'est pourquoi
il y a deux stories et non une. Et l'ordre n'est pas indifférent : tant que
0.1 n'est pas faite, l'effacement est **définitif**, ce qui rend 2.7 plus
urgente, pas moins.

### Project Structure Notes

- Aucun code applicatif touché. Ni TypeScript, ni Prisma, ni Server Action.
  `tsc` et `lint` seront verts sans effort — **ils ne prouveront donc rien
  ici**, et la définition de « terminé » repose entièrement sur la mutation
  de l'AC-1 et la vérification de l'AC-6.
- Le cloisonnement `agencyId` n'est pas concerné : aucun chemin de données
  n'est touché. Dit explicitement, comme la checklist du §12 l'exige.
- `uploads_data` est monté deux fois — `frontend` en écriture
  (`docker-compose.prod.yml:167`), `nginx` en lecture seule (ligne 196).
  `external` ne change ni l'un ni l'autre : il ne porte que sur la création
  et la suppression, jamais sur le montage.

### References

- [Source: `docs/stories/deferred-work.md` — `REP-103`] le constat et sa mesure
- [Source: `docs/epics.md` — Epic 2, story 2.7] le découpage
- [Source: `docker-compose.prod.yml:19`] `name: aqar-prod`, d'où le préfixe des volumes
- [Source: `docker-compose.prod.yml:227-229`] les deux volumes, aujourd'hui ordinaires
- [Source: `docker-compose.prod.yml:167,196`] les deux montages d'`uploads_data`
- [Source: `README.md:180-181`] « les volumes, donc les données, sont conservés » — juste au-dessus de la commande à risque
- [Source: `README.md:192`] l'avertissement en prose, sans garde
- [Source: `docs/architecture.md:351`] « survit au redéploiement, pas à `down -v` » — à corriger en T9
- [Source: `docs/architecture.md` §6] `piece_identite`, `acte_propriete` : ce que porte `uploads_data`
- [Source: `tests/deploiement.spec.ts:5-30`] ce que ce fichier prouve, et ce qu'il ne prouve pas
- [Source: `CLAUDE.md` §2, §8, §9] ne rien lancer sans accord · déplacer le problème avant de le fermer · définition de terminé
- [Source: `docs/stories/2-6-…md`] la story qui a fait naître ce constat, et la méthode du projet jetable

---

## Preuves — 17-08-2026

### T3 — la bascule éprouvée sur le projet jetable `t7`

Le test est **fidèle au réel** et c'est ce qui lui donne sa valeur : sous le
projet `t7`, un volume ordinaire déclaré `postgres_data` s'appelle
`t7_postgres_data` — exactement comme `aqar-prod_postgres_data` sous
`aqar-prod`. **Les deux branches portent donc le même nom, seule la
déclaration change.**

Et on ne vérifie pas l'existence du volume, on **relit un marqueur déposé
dedans** : un volume recréé serait présent et vide, ce qu'un contrôle
d'existence aurait laissé passer en ayant tout perdu.

```
A. MUTATION — la déclaration D'AUJOURD'HUI (volumes ordinaires)
   avant : postgres=oui [donnees-de-la-base]  uploads=oui [photos-et-documents]
     down -v:  Volume t7_postgres_data Removed
     down -v:  Volume t7_uploads_data Removed
   après : postgres=non  uploads=non
   ROUGE OBTENU

B. LA BASCULE — external: true + name:
   avant : postgres=oui [donnees-de-la-base]  uploads=oui [photos-et-documents]
     down -v:  Container … Removed / Network t7_default Removed
                ↑ les volumes ne sont MÊME PAS MENTIONNÉS
   après : postgres=oui [donnees-de-la-base]  uploads=oui [photos-et-documents]

C. LE PIÈGE — un name: qui ne désigne rien
   code de sortie : 1
   message        : external volume "t7_nom_faux" not found
   conteneurs     : 0
```

### T4 — le nom, comparé et non relu

```
$ docker compose -f docker-compose.prod.yml config | grep -A8 '^volumes:'
    postgres_data: { name: aqar-prod_postgres_data, external: true }
    uploads_data:  { name: aqar-prod_uploads_data,  external: true }
$ diff <(noms déclarés) <(docker volume ls -q | grep '^aqar-prod_')
    IDENTIQUES — aucun écart de nom.
```

### T7 — deux mutations, jouées séparément

Séparément, et chacune avec son retour au vert : une mutation groupée ne dit
pas laquelle des deux assertions garde quoi.

| Mutation | Résultat | Message d'échec |
|---|---|---|
| `external: true` retiré de `postgres_data` | **rouge**, 2 voisins verts | « le volume `postgres_data` n'est plus `external: true` : un `docker compose down -v` effacerait **la base** » |
| retour au vert | `3 passed` | — |
| `name: aqar-prod_uploads_data` → `uploads_data` | **rouge**, 2 voisins verts | « le volume `uploads_data` doit porter `name: aqar-prod_uploads_data` — sans ce nom exact, Compose chercherait un volume inexistant et la pile ne démarrerait plus » |
| retour au vert | `3 passed` | — |

Les deux messages désignent la propriété visée et sa conséquence, pas une
assertion voisine.

### T10 — les contrôles

```
npx tsc --noEmit    → 0 erreur
npm run lint        → 0 erreur (4 avertissements préexistants)
npm run test:e2e    → 143 passed   (142 avant, plus le cas ajouté)
```

---

## Ce qui reste, et à qui

| | |
|---|---|
| **T2** | l'empreinte d'avant, `docker exec aqar-postgres-prod psql …` — §2, base de production, **commande fournie, non lancée** |
| **T8** | `docker compose -f docker-compose.prod.yml up -d` — §2, il recrée les conteneurs |

**Tant que T8 n'a pas eu lieu, rien de tout ceci n'est en service** : la pile
en marche tourne encore sur la déclaration ordinaire, et `down -v` reste
destructeur aujourd'hui. C'est pourquoi `REP-103` n'est pas marqué résolu et
la story reste `in-progress`.

Les deux commandes, dans l'ordre :

```bash
docker exec aqar-postgres-prod psql -U aqar_user -d aqar_db \
  -tAc 'SELECT count(*) FROM agencies' -tAc 'SELECT count(*) FROM users'
docker compose -f docker-compose.prod.yml up -d
# puis le même décompte, et curl -s localhost:8095/api/public/health
```

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — `claude-opus-5[1m]`

### Debug Log References

- `scratchpad/t7/eprouver.sh` — le harnais de T3, hors du dépôt. Il ne nomme
  aucune ressource `aqar` : c'est la seule garantie qui vaille contre une
  confusion de volume.
- Sauvegarde de `docker-compose.prod.yml` prise avant chaque mutation et
  restaurée par copie, plutôt que par une réécriture à la main.

### Completion Notes List

- **Le `name:` est la moitié du correctif, pas un détail de forme.** Sans
  lui, `external: true` fait chercher un volume nommé `postgres_data` qui
  n'existe pas. La mutation 2 existe pour cette raison.
- **L'arbitrage du développement s'appuie sur une mesure, pas sur un
  principe.** `docker volume ls -q | grep '^aqar_'` ne rend rien : les
  volumes de développement n'existent nulle part, donc les rendre `external`
  aurait cassé `docker compose up` dès le premier clone.
- **Le `README` a été renuméroté**, et un renvoi interne cassait
  silencieusement — « le seul geste sûr est celui de l'étape 2 » désignait
  désormais la création des volumes. Corrigé en même temps.
- **Deux affirmations du dépôt sont devenues fausses avec ce correctif**
  (`README.md:217`, `docs/architecture.md:351`) et ont été corrigées par
  rature dans le même passage — §13 : une contradiction se corrige là où on
  la crée.
- **Ce que la story ne fait pas, écrit pour qu'on ne le découvre pas** :
  `docker volume rm` reste possible, et ce n'est pas une sauvegarde. Le filet
  est la story 0.1.

### Change Log

| Date | Ce qui change |
|---|---|
| 17-08-2026 | Story écrite (`bmad-create-story`), sur trois mesures prises hors du projet |
| 17-08-2026 | Développement : T1, T3, T4, T5, T6, T7, T9 faits et prouvés ; T2 et T8 laissées à l'éditeur (§2) ; `143 passed` |

### File List

Vérifiée par `git status --short`, pas recopiée de mémoire — `CLAUDE.md` §9,
la story 1.9 en avait déclaré 7 sur 17.

| Fichier | Nature |
|---|---|
| `docker-compose.prod.yml` | les deux volumes en `external: true` + `name:`, avec le motif et les mesures |
| `docker-compose.yml` | inchangé dans son effet — l'arbitrage « ils restent ordinaires » et ses deux raisons |
| `tests/deploiement.spec.ts` | un troisième invariant : les deux volumes de production, `external` et leur nom exact |
| `README.md` | étape 2 « créer les volumes », renumérotation, message d'échec, et deux corrections §7 |
| `docs/architecture.md` | §6 table du stockage corrigée, §7 le motif complet et les trois conséquences |
| `docs/stories/deferred-work.md` | REP-103 : correctif écrit et éprouvé, **pas encore en service** |
| `docs/stories/sprint-status.yaml` | statut de la story |
| `docs/stories/2-7-…md` | cette story |
