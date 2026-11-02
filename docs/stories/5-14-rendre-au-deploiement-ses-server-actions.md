---
baseline_commit: 5744497b88c7573881e93a6de5fe6868654c57f7
---

# Story 5.14 : Rendre au déploiement ses Server Actions

Status: done

> **Toutes les tâches sont faites, toutes les cases de §9 sont cochées.**
> T3 a été livré le 15-08-2026 après l'arbitrage de l'éditeur — (a) + (c),
> voir « Question tranchée ». `npm run test:e2e` a été lancé avec son accord
> explicite : **122 passés** (1,6 min).
>
> ⚠ La **première** exécution avait donné 121 verts et **1 rouge** —
> `regression.spec.ts:1580`, sur `read ECONNRESET` en appelant
> `POST /api/auth/register`. Rejoué seul : **vert en 7,2 s**. Rejouée en
> entier : **122 verts**. C'est un aléa sous charge parallèle, pas un
> défaut — mais il n'a pas été enterré : il part en **REP-97**, rattaché à
> la story 4.7.

**Épopée :** 5 — Dette technique et lisibilité produit
**Couvre :** BUG-36 — **et rien d'autre**
**Ouvre :** REP-94, REP-95, REP-96
**Ouverte par :** la session de vérification au navigateur du 15 août 2026
**Date :** 15 août 2026

---

## Story

**En tant qu'**agence utilisant Aqar DZ sur le déploiement conteneurisé,
**je veux** que les boutons qui enregistrent enregistrent réellement,
**afin de** ne pas découvrir, une fois le produit installé, qu'il ne sait
plus que lire et supprimer.

---

## Ce qui a été mesuré, et comment

**Le défaut n'a pas été déduit : il a été reproduit.** Toute la story
repose sur ces trois mesures, faites le 15-08-2026 contre la pile
`docker-compose.prod.yml` en marche.

### Mesure 1 — la même action, deux points d'entrée

`submitLead` (`app/vitrine/[slug]/actions.ts`) est une Server Action posée
sur une page **publique** : aucune session n'intervient, donc rien d'autre
que le chemin réseau ne peut expliquer l'écart.

```
via nginx  :8095 | POST 500 | bandeau: "Une erreur est survenue"
direct     :3000 | POST 303 | bandeau: "Votre message a bien ete envoye. …"
```

### Mesure 2 — ce que dit le serveur

```
$ docker compose -f docker-compose.prod.yml logs frontend

`x-forwarded-host` header with value `localhost` does not match `origin`
header with value `localhost:8095` from a forwarded Server Actions request.
Aborting the action.
Error: Invalid Server Actions request.
```

### Mesure 3 — le contournement qui confirme la cause

En posant `x-forwarded-host: localhost:8095` **depuis le client**, toutes
les écritures repassent : création d'un propriétaire (`303 →
/agency/owners?success=…`), activation d'une agence (« En attente →
Active »), publication d'une vitrine, purge de corbeille. **C'est la preuve
que rien d'autre n'est en cause.**

### La cause

`nginx/nginx.conf` pose `proxy_set_header Host $host;` sur ses **quatre**
blocs `location` (lignes 60, 127, 139, 152). **`$host` ne contient pas le
port.** Next 14 dérive `x-forwarded-host` de `Host` faute d'en-tête
explicite, le compare à l'`Origin` du navigateur — qui, lui, porte
`:8095` — et refuse l'action au titre de sa protection anti-CSRF.

### Ce que cela emporte

**Les 41 Server Actions du produit**, c'est-à-dire tout ce qui écrit :
l'espace agence entier, la console de l'éditeur, la corbeille, les messages
reçus, le formulaire public de la vitrine. Et `explainLoginFailure`, donc
**aucun échec de connexion n'affiche son motif** — une agence qui vient de
s'inscrire n'apprend jamais que son dossier est en attente.

Ce qui continue de marcher : la navigation, la connexion
(`/api/auth/callback/credentials` est une **route**, pas une action), les
exports CSV, les PDF, et **les suppressions par route API**. Le produit est
donc en lecture seule **sauf pour supprimer** — la pire combinaison.

---

## ⚠ Les quatre pièges de cette story

### Piège 1 — la suite E2E ne peut PAS attraper ce défaut, et ne le pourra pas

**C'est le piège central, et il conditionne le critère d'acceptation n° 4.**

`playwright.config.ts:68` :

```js
webServer: { command: `npm run build && npm start -- -p ${PORT}` }
```

La suite attaque **l'application en direct**, sur le port 3002. **nginx n'y
est jamais dans le chemin.** Les 121 cas verts n'ont donc jamais rien dit
de la topologie de déploiement, et n'en diront rien après ce correctif non
plus.

> **Ne pas conclure « c'est vert donc c'est bon ».** C'est exactement le
> mécanisme de `CLAUDE.md` §6 : un test vert sur un produit cassé. Ici le
> test est vert **parce qu'il ne passe pas par où le défaut se trouve**.

Voir le critère d'acceptation n° 4 : la preuve doit venir d'ailleurs, et
l'arbitrage sur *où* la poser appartient à l'éditeur (§ « Question à
trancher »).

### Piège 2 — `$host` était DÉJÀ une valeur du client

**Ne pas présenter ce correctif comme un durcissement.** `$host` est
l'en-tête `Host` du client, minuscules et **sans le port** ; il ne retombe
sur `server_name` que si l'en-tête est absent. Passer à `$http_host` ne
transforme donc pas une valeur sûre en valeur douteuse : les deux viennent
du client.

Ce qui **manque déjà**, et que ce correctif ne crée pas : nginx n'a qu'un
seul bloc `server`, il est donc **serveur par défaut** et accepte
**n'importe quel** `Host`. C'est REP-94, hors périmètre — mais il doit être
écrit, parce que §8 exige de dire ce que la correction rend atteignable, et
la réponse honnête ici est « rien de nouveau, mais un trou voisin reste
ouvert ».

### Piège 3 — `$http_host` peut être vide

`$http_host` est l'en-tête brut : **vide si le client n'en envoie pas**.
HTTP/1.1 l'exige et nginx répond `400` sans lui, donc le cas est
théorique — mais il est réel en HTTP/1.0. Si la revue le juge nécessaire,
le repli s'écrit avec une `map` :

```nginx
map $http_host $hote_transmis {
    default $http_host;
    ""      $host;
}
```

**Décision par défaut : ne PAS ajouter la map.** Un client HTTP/1.0 sans
`Host` ne peut de toute façon pas utiliser ce produit, et une `map` en plus
est une pièce mobile de plus dans un fichier que personne ne relit. À
inscrire en commentaire, pas en code.

### Piège 4 — reconstruire l'image ET redémarrer nginx sont deux gestes distincts

`nginx.conf` est **monté depuis le dépôt** :

```
$ docker inspect aqar-nginx-prod --format '{{range .Mounts}}…'
/home/ouazene/Dev/web/fullstack/AQAR/nginx/nginx.conf -> /etc/nginx/nginx.conf (ro)
```

Le correctif nginx ne demande donc **qu'un redémarrage de nginx**, pas une
reconstruction. La reconstruction de l'image applicative est un **second
sujet**, traité par l'AC 5 pour une autre raison (voir plus bas).

---

## Ce qui existe déjà et qu'il ne faut PAS réinventer

- **Ne pas toucher à `next.config.mjs`.** `experimental.serverActions.allowedOrigins`
  résoudrait le symptôme, mais figerait `localhost:8095` **dans l'image au
  moment du build** : tout déploiement sur un vrai domaine casserait, et le
  produit est fait pour être installé ailleurs. Écarté, motif consigné ici.
- **Ne pas ajouter `X-Forwarded-Host` en plus de corriger `Host`.** Une
  seule source, sinon deux valeurs à entretenir — c'est le mécanisme qui a
  produit BUG-35.
- **Ne pas toucher aux quatre `proxy_set_header X-Forwarded-For $remote_addr`** :
  c'est l'écrasement délibéré posé par BUG-20, il n'a rien à voir ici.

---

## Acceptance Criteria

**AC 1 — le port survit au relais**

**Given** un navigateur demande `http://localhost:8095/…`
**When** nginx relaie la requête vers l'application
**Then** l'en-tête `Host` reçu par l'application vaut `localhost:8095`,
port compris, sur les **quatre** blocs `location`

**AC 2 — une Server Action aboutit derrière nginx**

**Given** la pile `docker-compose.prod.yml` est en marche
**When** on envoie le formulaire de contact d'une fiche de vitrine publique
**Then** la réponse est une redirection (`303`), pas un `500`, et la page
affiche le message de succès
**And** un enregistrement `Lead` existe en base

**AC 3 — le motif d'un échec de connexion redevient visible**

**Given** un compte dont l'agence est en statut `pending`
**When** il tente de se connecter avec le **bon** mot de passe
**Then** l'écran affiche « Votre agence n'est pas encore activée par
Aqar DZ… » et **non** « Une erreur est survenue »

> **Contrôle positif obligatoire** (§6) : vérifier dans le même passage
> qu'un compte valide se connecte toujours. Un `explainLoginFailure` cassé
> pour tout le monde donnerait le même « refus » qu'un correctif réussi.

**AC 4 — la régression est couverte par une épreuve qui passe par nginx**

**Given** le correctif est appliqué
**When** on veut prouver qu'il ne repartira pas
**Then** il existe une vérification **exécutable** qui exerce une Server
Action **à travers nginx**, et son résultat est consigné
**And** il est écrit noir sur blanc, dans le fichier concerné, que
`npm run test:e2e` **ne couvre pas** ce chemin et pourquoi

> ⚠ **Cet AC porte une question non tranchée.** Voir § « Question à
> trancher » : ne pas l'implémenter avant la réponse de l'éditeur.

**AC 5 — l'image servie correspond au code**

**Given** l'image applicative en service date du 09-08-2026 et accuse
**67 commits** de retard (mesuré : `git log --since="2026-08-09 12:33" --oneline | wc -l`)
**When** la story est terminée
**Then** l'image est reconstruite depuis le code de la branche
**And** on vérifie que la révocation d'accès fonctionne — désactiver un
compte coupe l'accès **à la requête suivante**, ce que l'image actuelle ne
fait pas (elle est antérieure au correctif de BUG-33, du 12-08)
**And** le contrôle positif est fait : un compte **actif** continue d'être
servi

**AC 6 — la trace documentaire**

**Given** BUG-36 est fermé
**When** la story est terminée
**Then** `docs/qa/bug-report.md` le marque corrigé
**And** `docs/architecture.md` §7 mentionne que le relais doit conserver le
port, avec le motif
**And** REP-94, 95, 96 sont inscrits dans `deferred-work.md` avec leur story

---

## Tasks / Subtasks

- [ ] **T1 — corriger le relais** (AC 1)
  - [ ] `nginx/nginx.conf` : `proxy_set_header Host $host;` →
        `proxy_set_header Host $http_host;` aux lignes 60, 127, 139, 152
  - [ ] Poser au-dessus du premier un commentaire qui dit **pourquoi**
        (le port, l'`Origin`, la date de la mesure) — et non ce que fait la
        ligne
  - [ ] Mentionner en commentaire le repli `map` du piège 3 et pourquoi il
        n'est pas posé
  - [ ] `docker compose -f docker-compose.prod.yml restart nginx`

- [ ] **T2 — éprouver** (AC 2, AC 3)
  - [ ] Formulaire de vitrine publique via `:8095` → `303` + message + ligne en base
  - [ ] Connexion d'un compte `pending` → motif exact affiché
  - [ ] **Contrôle positif** : un compte valide se connecte
  - [ ] **Prouver par mutation** : remettre `$host`, constater le `500`,
        **lire le message d'échec** — il doit désigner l'action, pas une
        assertion voisine —, puis rétablir

- [x] **T3 — poser la couverture** (AC 4) — *arbitrage rendu le 15-08-2026*
  - [x] Écrire la vérification exécutable retenue — `scripts/verify-deploy.mjs`,
        exposée par `npm run verify:deploy`
  - [x] Poser l'assertion statique — `tests/deploiement.spec.ts`
  - [x] Inscrire dans `playwright.config.ts` le commentaire qui dit que la
        suite ne passe pas par nginx

- [ ] **T4 — reconstruire l'image** (AC 5)
  - [ ] `npx tsc --noEmit` et `npm run lint` — 0 erreur **avant** de construire
  - [ ] `docker compose -f docker-compose.prod.yml up -d --build`
  - [ ] Vérifier la révocation, avec son contrôle positif
  - [ ] Vérifier que le masquage des cinq entrées réservées (story 5.13)
        est bien présent pour un agent — il ne l'était pas dans l'ancienne image

- [ ] **T5 — la trace** (AC 6)
  - [ ] `docs/qa/bug-report.md` : BUG-36, marqué corrigé
  - [ ] `docs/architecture.md` §7
  - [ ] `docs/stories/deferred-work.md` : REP-94, 95, 96
  - [ ] `docs/stories/sprint-status.yaml`
  - [ ] **File List** complète

---

## ✅ Question tranchée le 15-08-2026 — (a) + (c)

**Arbitrage de l'éditeur :** un script `npm run verify:deploy` **et**
l'assertion statique. **(b) est écarté.**

**Motif, à conserver pour pouvoir rouvrir la décision :** (a) seul finit par
ne jamais être lancé — il ne tient que par la procédure de déploiement ;
(c) seul ne prouve rien du comportement, seulement qu'une ligne n'a pas
bougé. Ensemble, l'un prouve, l'autre garde. **(b)** — un projet Playwright
qui se saute si la pile est éteinte — a été écarté parce qu'un test ignoré
se lit comme un test vert, et que ce dépôt a déjà payé exactement ce
mécanisme (§6).

Ce qui a été livré :

| Fichier | Ce qu'il prouve | Quand il tourne |
|---|---|---|
| `scripts/verify-deploy.mjs` | Une Server Action s'exécute **à travers nginx**, par le port publié | À la main, `npm run verify:deploy` — procédure de déploiement |
| `tests/deploiement.spec.ts` | Que les quatre relais portent toujours `$http_host` | À chaque `npm run test:e2e` |
| `playwright.config.ts` | *(commentaire)* que la suite ne voit pas nginx, et pourquoi | — |

**Le script n'écrit rien en base.** `submitLead` résout l'agence par le
`slug` **posté**, pas par l'URL : on poste un slug qui ne peut pas exister,
l'action s'exécute jusqu'à sa sortie en erreur, et aucun `Lead` n'est créé.
Aucun ménage après coup — c'est la raison de ce détour.

**Il ne code pas en dur l'identifiant d'action** (§6, piège 4) : il le relève
dans le HTML servi à chaque exécution.

### La preuve par mutation, et ce qu'elle a révélé au passage

`$host` remis sur les quatre blocs :

```
npm run verify:deploy      → POST 500 → ÉCHEC, sortie 1
tests/deploiement.spec.ts  → rouge, message : "$host" reçu, "$http_host" attendu
```

Rétabli : les deux repassent au vert. Le message d'échec désigne bien la
propriété visée, pas une assertion voisine.

> ⚠ **`sed -i` ne mute PAS le fichier que nginx lit.** Premier essai : la
> mutation a été appliquée au fichier du dépôt, `nginx -s reload` lancé,
> et `verify:deploy` est resté **vert**. Ce n'était pas un défaut du script :
> `sed -i` **remplace l'inode**, et un montage Docker de *fichier* reste
> accroché à l'ancien. Le conteneur lisait encore `$http_host` — vérifié par
> `docker compose exec nginx grep -n 'proxy_set_header Host'`.
>
> Il a fallu `docker compose up -d --force-recreate nginx` pour que le
> montage suive. **Corollaire pour la suite : après toute édition de
> `nginx.conf`, lire la configuration DEPUIS LE CONTENEUR avant de conclure
> quoi que ce soit.** Un `grep` sur le fichier du dépôt ne dit pas ce que
> nginx sert. C'est §7 en acte — la commande de contrôle qui ne contrôlait
> pas ce qu'elle prétendait.

---

## ❓ La question, telle qu'elle était posée

**Où poser la preuve, puisque `npm run test:e2e` ne passe pas par nginx ?**

Trois options, avec leur coût réel :

| Option | Ce qu'elle prouve | Ce qu'elle coûte |
|---|---|---|
| **a.** Un script `npm run verify:deploy` qui frappe la pile en marche et exerce une Server Action | La topologie réelle, bout en bout | N'est jamais lancé automatiquement — il faut l'inscrire dans la procédure de déploiement, sinon il pourrit |
| **b.** Un projet Playwright supplémentaire, ciblant `:8095`, ignoré si la pile est éteinte | Idem, dans l'outil déjà connu | **Un test ignoré se lit comme un test vert.** C'est le piège de §6 en pire |
| **c.** Une assertion statique sur `nginx.conf` (la ligne contient `$http_host`) | Seulement que la ligne n'a pas été retouchée | Ne prouve pas que ça marche. Faible — mais elle, au moins, tourne |

**Recommandation : (a) + (c).** **Retenue telle quelle** — voir la section
précédente pour le motif consigné.

---

## Dev Notes

### Fichiers touchés

| Fichier | Nature | Ce qui change |
|---|---|---|
| `nginx/nginx.conf` | UPDATE | 4 lignes `proxy_set_header Host` + commentaires |
| `playwright.config.ts` | UPDATE | commentaire seulement — dire que la suite ne voit pas nginx |
| *(à décider, T3)* | NEW | la vérification retenue |
| `docs/qa/bug-report.md` | UPDATE | BUG-36 |
| `docs/architecture.md` | UPDATE | §7 |
| `docs/stories/deferred-work.md` | UPDATE | REP-94, 95, 96 |
| `docs/stories/sprint-status.yaml` | UPDATE | statut |

### État actuel de `nginx/nginx.conf` — à lire avant d'éditer

Quatre blocs relaient vers l'application, et **l'invariant du fichier est
que nginx écrase toujours ce que le client a écrit** — c'est écrit dans le
commentaire du bloc `/_next/static` (ligne 55-58). Le correctif ne le
rompt pas : il rend fidèle une valeur que nginx tronquait.

| Ligne | Bloc | Rôle |
|---|---|---|
| 60 | `location /_next/static` | statiques ; aucune Server Action, mais l'invariant vaut pour tous |
| 127 | `location /api` | routes API |
| 139 | `location /api/upload` | dépôt de fichier |
| 152 | `location /` | **c'est celui-ci qui porte les Server Actions** |

### Ce que §8 demande — qu'est-ce que je viens de rendre atteignable ?

**Réponse honnête : rien de nouveau.** `$host` venait déjà du client. Mais
la question en découvre trois autres, qui partent en REP :

- **REP-94** — nginx n'a qu'un `server` block : il est serveur par défaut
  et accepte **tout** `Host`. Avec `AUTH_TRUST_HOST=true` dans le
  conteneur, un `Host` forgé peut orienter les URL de rappel NextAuth. Trou
  préexistant, indépendant de ce correctif, mais voisin.
- **REP-95** — `npm run test:e2e` n'exerce **aucune** topologie de
  déploiement. Ce n'est pas une lacune de ce correctif, c'est une lacune du
  harnais : le même angle mort couvre nginx, les volumes, les migrations et
  les variables d'environnement.
- **REP-96** — l'image en service peut diverger du dépôt sans que rien ne
  le signale. Aucun contrôle ne compare la version servie au commit.
  L'écart mesuré ici est de **67 commits** et il a failli faire conclure à
  une régression de sécurité inexistante.

### Testing standards

- Le contrôle positif est **obligatoire** (§6).
- La preuve par mutation est **obligatoire** : remettre `$host`, constater
  le rouge, **lire le message**, rétablir.
- Ne jamais conclure d'un code HTTP seul : les pages ont un `loading.tsx`,
  un refus arrive en `200` (§6, piège 2). Ici on regarde le **code de la
  requête POST** de l'action, pas celui du document.
- `waitForLoadState("networkidle")` est **interdit** (§2).

### References

- Mesures et journaux : [docs/qa/verification-navigateur.md](../qa/verification-navigateur.md) §3
- Inventaire des écrans touchés : [docs/qa/inventaire-ecrans.md](../qa/inventaire-ecrans.md)
- Contrat des Server Actions : [docs/architecture.md](../architecture.md) §4
- Déploiement : [docs/architecture.md](../architecture.md) §7
- Règles permanentes : `CLAUDE.md` §2, §6, §8, §9, §12 (règle 12)

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M) — implémentation du 15-08-2026.

### Debug Log References

Harnais de vérification : Playwright **du dépôt** (1.60,
`node_modules/playwright`), piloté depuis le scratchpad de session contre
la pile en marche. **Les deux serveurs MCP navigateurs étaient hors
service** (ils exigent Google Chrome à `/opt/google/chrome/chrome` ; la
machine n'a Chrome qu'en Flatpak). Ils n'ont **pas** été réparés — §14 en
fait un arbitrage.

### Completion Notes List

**T1 — fait.** `proxy_set_header Host $host;` → `$http_host;` aux quatre
blocs (60, 127, 139, 152). Le motif est posé en commentaire au-dessus du
bloc `location /`, celui qui porte les Server Actions : le port, l'`Origin`,
la date de la mesure, le rejet du repli `map`, et le renvoi à REP-94.
`nginx -t` valide, nginx rechargé. **Aucune reconstruction nécessaire** :
le fichier est monté depuis le dépôt.

**T2 — fait.** Éprouvé en **navigateur nu**, sans le contournement
d'en-tête utilisé pendant l'enquête :

| Épreuve | Avant | Après |
|---|---|---|
| Formulaire public de vitrine | `POST 500` | **`POST 303`** + message de succès |
| Connexion compte `pending` | « Une erreur est survenue » | **motif exact affiché** |
| Connexion mot de passe faux | « Une erreur est survenue » | **« Email ou mot de passe incorrect »** |
| Connexion valide *(contrôle positif)* | aboutit | aboutit |

**Prouvé par mutation** : `$host` remis, nginx rechargé → `POST 500` sur les
deux premières lignes, **et la connexion valide continue d'aboutir**. Le
message d'échec désigne bien l'action, pas une assertion voisine.
Configuration rétablie, `grep -c 'Host $http_host;'` → 4.

**T3 — fait le 15-08-2026, après arbitrage.** L'éditeur a retenu **(a) +
(c)**. Livré : `scripts/verify-deploy.mjs` (+ `npm run verify:deploy`),
`tests/deploiement.spec.ts`, et le commentaire d'avertissement dans
`playwright.config.ts`. Détail et motif dans la section « Question
tranchée » ; la preuve par mutation y figure, **ainsi que le piège du
montage Docker de fichier qui a d'abord rendu la mutation invisible**.

Mesures :

```
verify:deploy, config saine    → 303 → /vitrine/…?error=Cette agence n'accepte pas de messages  (sortie 0)
verify:deploy, $host remis     → 500 → ÉCHEC nommant BUG-36                                      (sortie 1)
deploiement.spec.ts, saine     → 1 passed (7 ms)
deploiement.spec.ts, $host     → 1 failed — reçu "$host", attendu "$http_host"
npx tsc --noEmit               → 0
npm run lint                   → 0 erreur (3 avertissements <img> préexistants)
```

**T4 — fait.** `npx tsc --noEmit` et `npm run lint` à 0 **avant** de
construire. `docker compose -f docker-compose.prod.yml up -d --build` →
image `aqar-dz:latest` du **15-08-2026 12:57** (l'ancienne datait du
09-08 et accusait 67 commits de retard). Migrations appliquées par le
conteneur éphémère, santé `200 {"status":"ok","database":"up"}`.

Vérifications post-reconstruction, en navigateur nu :

```
1. agent actif : true
2. CONTROLE POSITIF | GET /api/export/clients -> 200
3. agent desactive : true
4. GET /api/export/clients -> 401
   page /agency/properties -> /auth/login ?error=Votre compte utilisateur a été désactivé…
5. entrees reservees visibles pour un agent : []   (vide attendu)
   liens visibles : ["/agency","/agency","/agency/properties","/agency/clients","/agency/visits"]
```

→ **BUG-33 est réellement fermé sur le déploiement** (il ne l'était pas :
l'ancienne image précédait le correctif du 12-08), et **le masquage de la
story 5.13 est en service** — `/agency/showcase` a disparu de la barre d'un
agent.

**T5 — fait.** Voir la File List.

**Ce qui n'a PAS été fait, et pourquoi :**

- **`npm run test:e2e` a été lancé**, avec l'accord explicite de l'éditeur
  (§2), **deux fois** :

  ```
  1re exécution : 121 passed, 1 failed  (1,6 min)
                  regression.spec.ts:1580 — read ECONNRESET sur POST /api/auth/register
  rejeu du cas seul :   1 passed (7,2 s)
  2e exécution : 122 passed              (1,6 min)
  ```

  Le rouge n'était pas une assertion en échec mais une connexion coupée sous
  charge parallèle. **Il n'est pas enterré pour autant : REP-97**, rattaché
  à la story 4.7. Un faux rouge par exécution est exactement ce qui apprend
  à ne plus lire les rouges.

  Elle n'a de toute façon **rien dit du correctif lui-même** : elle sert
  l'application en direct sur `:3002`, nginx n'est jamais dans son chemin —
  c'est REP-95, et c'est tout le sujet de T3.
- **Cloisonnement `agencyId`** : aucun chemin de données touché. Le
  correctif est une ligne de relais HTTP, il ne lit ni n'écrit rien.

**Ménage laissé au propriétaire du dépôt** (créé pendant l'enquête, pas par
cette story) : agence jetable `Agence Test QA 059618` et ses deux comptes
`qa059618@` / `agent059618@`, sa vitrine publiée sur
`/vitrine/agence-test-qa-059618`, le bien « Villa NEW-03 » qui sert de cas
de test, et **trois messages de test sur Agence Démo**.

### File List

| Fichier | Nature |
|---|---|
| `nginx/nginx.conf` | **modifié** — 4 × `Host $http_host` + le commentaire de motif |
| `scripts/verify-deploy.mjs` | **créé** — la preuve réelle, à travers nginx (T3) |
| `tests/deploiement.spec.ts` | **créé** — l'assertion statique qui tourne toujours (T3) |
| `playwright.config.ts` | **modifié** — l'avertissement exigé par l'AC 4 (T3) |
| `package.json` | modifié — script `verify:deploy` |
| `docs/stories/5-14-rendre-au-deploiement-ses-server-actions.md` | **créé** |
| `docs/epics.md` | modifié — story 5.14 ajoutée à l'épopée 5 |
| `docs/stories/sprint-status.yaml` | modifié — entrée 5-14 |
| `docs/stories/deferred-work.md` | modifié — REP-94, REP-95, REP-96 |
| `docs/qa/bug-report.md` | modifié — BUG-36 : en-tête, table de la 7ᵉ passe, section détaillée, correction |
| `docs/architecture.md` | modifié — §7, « Le relais doit conserver le port » |
| `docs/qa/verification-navigateur.md` | **créé** (session de mesure, en amont de la story) |
| `docs/qa/inventaire-ecrans.md` | **créé** (session de mesure, en amont de la story) |

*Tous les fichiers de T3 sont désormais listés ci-dessus. Aucun fichier
applicatif (`app/`, `lib/`, `components/`, `prisma/`) n'est touché par cette
story : c'est un correctif de relais et son outillage de preuve.*
