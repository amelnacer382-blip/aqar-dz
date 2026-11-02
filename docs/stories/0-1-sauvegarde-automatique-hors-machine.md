---
baseline_commit: 8909564
---

# Story 0.1 : Sauvegarder la base automatiquement, hors de la machine

Status: ready-for-dev

**Épopée :** 0 — Ne pas perdre les données
**Couvre :** NFR-09
**Découpage :** [`docs/epics.md`](../epics.md) — Epic 0, story 0.1
**Dépend de :** rien. *Voir « La dépendance annoncée n'existe pas », plus bas.*
**Bloque :** 0.2 (prouver la restauration), et l'installation de tout client réel
**Date :** 16 août 2026

---

## Story

**En tant qu'**éditeur d'Aqar DZ,
**je veux** que la base soit sauvegardée toute seule, chiffrée, ailleurs que sur le serveur,
**afin que** la perte du VPS ne fasse pas perdre le travail de toutes les agences.

---

## Pourquoi elle passe maintenant

`docs/epics.md` « Ordre imposé », point 1 : **l'épopée 0 passe avant tout, y
compris avant l'épopée 1.** Elle est pourtant la seule des sept épopées à
n'avoir reçu aucune story. Six épopées sont passées devant elle.

Le motif de l'ordre est écrit et il n'a pas bougé : *« un défaut exploité se
corrige, des données perdues ne reviennent pas »*. C'est le seul risque du
dépôt dont la conséquence est **irréversible**.

Ce qui existe aujourd'hui, mesuré :

```
$ grep -rln "pg_dump" --include=* . | grep -v node_modules | grep -v '^./.git'
README.md · .gitignore · docker-compose.prod.yml · docs/epics.md
docs/stories/2-4-fermer-et-durcir-la-base.md · docs/qa/bug-report.md
```

**Six fichiers, et pas un seul n'est exécutable.** Les quatre derniers en
*parlent* ; `.gitignore` s'en protège ; `README.md:151` porte la seule
commande réelle :

```bash
docker exec aqar-postgres-prod pg_dump -U aqar_user aqar_db > ~/sauvegardes/aqar-$(date +%F).sql
```

À lancer à la main. Sans planification, sans chiffrement, sans copie hors
machine, et — le point de la story 0.2 — **jamais restaurée**.

---

## La dépendance annoncée n'existe pas

`docs/epics.md`, story 2.5 :

> *« Tant que le second seau n'est pas ouvert, aucun déploiement sur stockage
> objet n'est possible — **et l'épopée 0 en a besoin**. »*

`docs/stories/sprint-status.yaml` le répète sur la ligne de la story 2.5.
**C'est faux, et l'inverse est vrai.** Vérifié dans le code le 16-08-2026 :

| Ce que 2.5 débloque | Ce dont 0.1 a besoin |
|---|---|
| Le seau **applicatif** — où les documents des clients sont *servis* | Un seau **d'archives** — où les sauvegardes sont *déposées* |
| Contraint par `lib/env.ts:155`, qui refuse le démarrage en mode Supabase | Contraint par rien : c'est un conteneur annexe, il ne démarre pas l'application |

Les deux ne partagent ni le seau, ni les identifiants, ni le code. L'arbitrage
du 10 août l'avait d'ailleurs déjà tranché sans le relier à 2.5 : *« Ce qu'on
ne fait pas : réutiliser le bucket Supabase »* — *« une sauvegarde déposée au
même endroit que les données qu'elle protège n'est pas une sauvegarde »*.

**Et l'ordre réel est le contraire de celui qui est écrit.** Puisque
`lib/env.ts:155-157` refuse aujourd'hui de démarrer en mode Supabase — et
seulement en production, la ligne 157 est exactement
`level: isProduction ? "fatal" : "warn"` —
les fichiers téléversés sont **tous** dans le volume `uploads_data`
(`docker-compose.prod.yml:167`) — un seul endroit à sauvegarder. Faire 2.5
d'abord ferait naître un second gisement, donc un second cas à couvrir dans
l'AC-4. **0.1 est moins chère maintenant qu'après 2.5.**

> **Déjà corrigé** dans `docs/epics.md` (story 2.5) et dans
> `sprint-status.yaml`, le 16-08-2026, dans le même passage que l'écriture de
> cette story — `CLAUDE.md` §13 : *« en cas de contradiction entre deux
> documents, le code fait foi, et la contradiction se corrige dans le même
> passage »*. Le premier jet de cette story renvoyait la correction à sa
> clôture ; c'était laisser sciemment un énoncé faux en place, pour un délai
> inconnu. La clause est **biffée et corrigée, pas supprimée** : on doit
> pouvoir lire ce qui a été cru.

---

## Ce qui bloque réellement, et à qui cela appartient

**Rien ne bloque le code. Une seule chose bloque la mise en service**, et
elle n'est pas technique — l'arbitrage du 10 août 2026 le dit lui-même :

> *« Le fournisseur reste à choisir, et ce n'est pas un détail technique. Ces
> archives contiennent des pièces d'identité et des actes de propriété de
> clients algériens : la juridiction du stockage est une question juridique
> avant d'être une question d'infrastructure. »*

**Ce qui appartient à l'éditeur** (`CLAUDE.md` §13 — un arbitrage produit se
demande, avec son motif) :

1. **La juridiction, puis le fournisseur.** Où ces pièces d'identité ont-elles
   le droit de résider ?
2. **Les quatre valeurs** : `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`,
   `S3_SECRET_KEY` — et **la phrase de passe de chiffrement**, qui est une
   cinquième valeur que l'arbitrage n'avait pas nommée.
3. **Lancer la pile** pour éprouver le résultat (`CLAUDE.md` §2).

**Ce qui n'attend rien** — et c'est la raison du statut `ready-for-dev` :
l'arbitrage impose que l'implémentation *« ne dépende que de quatre variables,
jamais d'un SDK propriétaire »*. Un code qui ne connaît que quatre variables
s'écrit **sans les connaître**. Seule l'exécution attend le choix.

---

## Acceptance Criteria

*Repris de `docs/epics.md` Epic 0, story 0.1, numérotés pour être cochables.*

**AC-1** — **Given** aucune sauvegarde automatique n'existe aujourd'hui
**When** la story est terminée
**Then** un `pg_dump` s'exécute au moins une fois par jour, sans intervention humaine
**And** l'archive est **chiffrée avant de quitter la machine**
**And** elle est déposée sur un stockage **distinct du VPS**

**AC-2** — **Given** un espace de stockage fini
**When** les sauvegardes s'accumulent
**Then** une rétention est appliquée — **au minimum sept quotidiennes et quatre hebdomadaires**

**AC-3** — **Given** une sauvegarde qui échoue
**When** l'échec se produit
**Then** il est visible sans avoir à le chercher : **le silence ne doit jamais valoir succès**

**AC-4** — **Given** les fichiers téléversés ne sont pas dans la base
**When** la stratégie est définie
**Then** le volume `uploads_data` est couvert lui aussi, ou la bascule vers Supabase Storage est actée et tracée

**AC-5** — **Given** l'arbitrage du 10 août 2026
**When** la destination est implémentée
**Then** elle n'est atteinte que par `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` — **aucun SDK propriétaire, aucun nom de fournisseur en dur**
**And** le seau est distinct de `SUPABASE_STORAGE_BUCKET` s'il venait à être utilisé
**And** la rétention s'appuie sur une **règle de cycle de vie du fournisseur** quand il en offre une, plutôt que sur une purge écrite à la main

---

## AC-3 est le critère difficile, et c'est celui qu'on saute

Les quatre autres se voient : ou l'archive est là, ou elle n'y est pas. AC-3
ne se voit pas — **c'est exactement sa nature**. Une tâche planifiée qui
échoue en silence produit le même écran qu'une tâche qui réussit : rien.

Ce dépôt a déjà payé cette forme précise. `CLAUDE.md` §11 :

> *« `recordAudit()` n'échoue jamais : il avale ses erreurs à dessein. […] et
> ne prouve donc pas qu'une ligne a été écrite. »*

Et §6, piège 1 : *« un test qui vérifie que X n'a pas changé doit aussi
vérifier que l'opération a EU LIEU »*. Une sauvegarde absente et une
sauvegarde réussie mais vide se ressemblent trait pour trait.

**Conséquence pour l'implémentation** : le succès doit être *positivement*
constaté, pas déduit d'une absence d'erreur. Au minimum — la taille de
l'archive déposée est relue depuis le seau et comparée à un plancher, et
c'est **ce constat-là**, pas le code de sortie de `pg_dump`, qui décide si
l'exécution est un succès. `pg_dump` sur une base joignable mais vide sort
en `0`.

---

## Ce que cette story rend atteignable (`CLAUDE.md` §8)

*« À chaque correctif : qu'est-ce que je viens de rendre atteignable ? »* —
trois réponses, dont deux sont des risques nouveaux :

1. **🔴 Un nouveau secret de très haute valeur entre dans le déploiement.**
   `S3_SECRET_KEY` ouvre l'accès à une archive qui contient **toute** la base,
   en clair une fois déchiffrée. Aujourd'hui, compromettre le VPS donne la
   base ; demain, compromettre la clé S3 la donne **aussi**, sans toucher au
   VPS. La surface s'élargit. Deux exigences en découlent : la clé n'est
   **jamais** dans le dépôt (`CLAUDE.md` §2 — `mcp-config.json` a déjà fuité
   une clé), et le compte S3 doit être **restreint au dépôt** (`PutObject`),
   pas au téléchargement : une clé volée sur le VPS ne doit pas permettre de
   *lire* les archives.
2. **🟠 La phrase de passe de chiffrement devient un point de perte unique.**
   Chiffrer répond à AC-1 ; une phrase de passe perdue rend les archives
   **définitivement illisibles** — c'est-à-dire le sinistre exact que la story
   prétend éviter, obtenu par le remède. Où elle est conservée est une
   décision, et elle appartient à la 0.2 : *« une sauvegarde jamais restaurée
   n'est pas une sauvegarde, c'est un fichier »*.
3. **🟢 La story 0.2 devient jouable**, et la barrière « aucun client réel »
   perd sa cause la plus lourde.

---

## Tasks / Subtasks

- [ ] **T1 — Obtenir l'arbitrage** (AC-5) — juridiction, fournisseur, cinq
      valeurs. **Appartient à l'éditeur.** Consigner la réponse ici avec son
      motif : dans six mois, seul le motif permettra de la rouvrir.
- [ ] **T2 — Écrire le script de sauvegarde** (AC-1, AC-5)
  - [ ] `pg_dump` par `docker exec`, comme le README, donc par le conteneur
        (`docker-compose.prod.yml:47` documente déjà ce choix)
  - [ ] Chiffrement **avant** que l'archive ne quitte la machine
  - [ ] Dépôt par appel HTTP signé S3 — **ni `aws-cli`, ni SDK** (AC-5)
  - [ ] Aucun nom de fournisseur en dur : quatre variables, pas une de plus
- [ ] **T3 — Couvrir `uploads_data`** (AC-4) — même archive ou archive
      séparée, tranché et écrit. *Le volume est en `docker-compose.prod.yml:167`.*
- [ ] **T4 — Planifier** (AC-1) — service annexe dans `docker-compose.prod.yml`,
      au moins une exécution par jour. Le service **ne sert pas de trafic** et
      ne partage pas l'image applicative (règle 12 : *« une seule image
      applicative »* vise l'application, pas un utilitaire).
- [ ] **T5 — Rendre l'échec visible** (AC-3) — succès constaté positivement,
      taille relue depuis le seau. Voir la section dédiée ci-dessus.
- [ ] **T6 — Rétention** (AC-2) — règle de cycle de vie du fournisseur en
      premier choix ; purge écrite à la main seulement s'il n'en offre pas, et
      alors le motif est écrit.
- [ ] **T7 — `.env.example`** (AC-5) — les cinq variables y entrent, sans
      valeur. ⚠ **Non vérifié** : la lecture de `.env.example` a été refusée
      pendant l'écriture de cette story (garde de `.claude/settings.json`).
      Vérifier au développement qu'elles n'y sont pas déjà.
- [ ] **T8 — README** (AC-1..AC-3) — remplacer la procédure manuelle de la
      ligne 147 par ce qui tourne réellement. La laisser telle quelle
      donnerait deux réponses différentes à la même question (`CLAUDE.md`,
      préambule : le dépôt a déjà payé cette divergence).
- [x] **T9 — Corriger la dépendance fausse** — `docs/epics.md` story 2.5 et
      `sprint-status.yaml` : biffé et corrigé le 16-08-2026, à l'écriture de
      cette story (`CLAUDE.md` §13). **Seule tâche cochée de la liste, et
      elle est faite.**
- [ ] **T10 — Preuve** — voir la section suivante. **Ne pas cocher sans
      l'avoir exécutée** (`CLAUDE.md` §9).

---

## Dev Notes

### Comment on prouve une story qui n'a pas d'écran

**`npm run test:e2e` ne peut rien pour AC-1 à AC-5.** Playwright pilote un
navigateur ; il n'y a ici ni page, ni Server Action, ni route. Écrire un
`.spec.ts` pour cocher §9 produirait exactement le vert creux que
`CLAUDE.md` §6 décrit — *« des tests verts sur un produit cassé »*.

C'est un cas où §9 doit être **appliquée en la nommant, pas récitée** :

| Critère | Preuve exigée |
|---|---|
| `tsc`, `lint` | S'appliquent au script s'il est en TypeScript. Sinon, **écrire qu'ils ne l'atteignent pas** — c'est un résultat |
| AC-1, AC-2, AC-4, AC-5 | Exécution réelle sur la pile, archive relue **depuis le seau**, taille et date constatées |
| AC-3 | **Par mutation** (`CLAUDE.md` §6) : couper l'accès au seau, constater que l'échec **arrive**, lire le message. Restaurer |
| Non-régression | La story **0.2** *est* le test de non-régression de la 0.1. C'est pour cela qu'elles sont séparées |

**La mutation d'AC-3 est la seule qui compte vraiment**, et elle doit être
jouée dans le bon sens : une alerte qui ne part jamais et une alerte qui part
toujours sont toutes deux inutiles. Couper l'accès **doit** produire l'alerte ;
la rétablir **doit** la faire cesser. Le contrôle positif est obligatoire
(`CLAUDE.md` §6).

### La pile, mesurée le 16-08-2026

`docker-compose.prod.yml` — cinq services, deux volumes :

```
postgres   postgres:16-alpine        aqar-postgres-prod   volume postgres_data:/var/lib/postgresql/data
migrate    aqar-dz-toolbox:latest    aqar-migrate-prod    prisma migrate deploy, restart "no"
frontend   aqar-dz:latest            aqar-frontend-prod   volume uploads_data:/app/public/uploads
nginx      nginx:alpine                                   uploads_data:/var/www/uploads:ro
seed       aqar-dz-toolbox:latest    aqar-seed-prod       profile "seed"
```

Deux repères pour T4 : **`migrate` est le modèle à suivre** — un service
`restart: "no"` qui fait son travail et sort, sur `depends_on:
service_healthy`. Et **`seed` montre le motif `profiles:`**, utile si la
sauvegarde doit aussi pouvoir être déclenchée à la main.

⚠ Règle 12 : *« les migrations ne s'appliquent jamais depuis le conteneur qui
sert le trafic »*. Le même raisonnement vaut ici — la sauvegarde ne part pas
de `frontend`.

### Ce à quoi on ne touche pas

- **La base de production.** `CLAUDE.md` §2 : *« jamais, sous aucun
  prétexte »*. `pg_dump` **lit** ; c'est ce qui rend cette story possible
  sans enfreindre la règle. Aucune écriture, aucun `psql` interactif.
- **`npx prisma migrate` / `db`** — dans le `deny` de
  `.claude/settings.json`, et ce n'est pas le sujet.
- **La restauration.** Elle est la story 0.2, et l'y laisser est délibéré.

### References

- [`docs/epics.md`](../epics.md) — Epic 0 et l'arbitrage du 10-08-2026
- [`docs/epics.md`](../epics.md) — « Ordre imposé », point 1
- [`README.md`](../../README.md) L147-151 — la procédure manuelle à remplacer
- `docker-compose.prod.yml` L47, L167, L227-229 — conteneur, volumes
- `lib/env.ts` L155 — le refus qui rend `uploads_data` seul gisement de fichiers
- [`CLAUDE.md`](../../CLAUDE.md) §2, §6, §8, §9, §13 · règle 12

---

## Dev Agent Record

### Completion Notes List

*(à remplir au développement)*

**Rien n'est coché ici. La story est écrite, pas faite** — `CLAUDE.md` §9.

### File List

*Prévisionnelle. La liste réelle se remplit au développement et doit être
exhaustive (`CLAUDE.md` §9).*

| Fichier | Nature |
|---|---|
| script de sauvegarde (emplacement à trancher — `scripts/` n'a qu'un `.mjs`) | nouveau |
| `docker-compose.prod.yml` | modifié — service planifié |
| `.env.example` | modifié — cinq variables |
| `README.md` | modifié — procédure réelle |
| `docs/epics.md` | ✅ **déjà modifié** le 16-08-2026 — dépendance 2.5 biffée et corrigée |
| `docs/stories/sprint-status.yaml` | ✅ **déjà modifié** le 16-08-2026 — épopée 0 ouverte, ligne 2.5 corrigée |
| `docs/stories/deferred-work.md` | modifié si constats hors périmètre |
