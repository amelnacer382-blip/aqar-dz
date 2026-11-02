---
baseline_commit: fb35619cc3034cc0e3216587388a01db0f4ccd00
---

# Story 1.8: Rendre la révocation d'un accès effective

Status: done

## Story

As a administrateur d'agence,
I want que désactiver un compte ou changer son rôle prenne effet immédiatement,
so that le départ d'un collaborateur ou la fuite d'un mot de passe puisse être refermé le jour où il arrive.

**Couvre :** défaut n° 33 (BUG-33), NFR-12

## Ce que cette story doit vraiment faire

Le produit a déjà eu ce raisonnement, et il l'a écrit. Commentaire de
`requireAgency()`, `lib/auth-guard.ts:14` :

```
Le controle du statut est refait ici et pas seulement a la connexion :
si un super admin suspend une agence pendant qu'un agent est connecte,
l'agent perd l'acces a la requete suivante sans avoir a se reconnecter.
```

Il est juste. Il n'a jamais été appliqué à **l'utilisateur** lui-même.

| Donnée lue par les gardes | Source | Relue en base ? |
|---|---|:---:|
| Statut de l'agence | `prisma.agency.findUnique` | ✅ |
| `isActive` du compte | jeton signé | ❌ |
| `role` du compte | jeton signé | ❌ |
| `agencyId` du compte | jeton signé | ❌ |
| Existence du compte | jeton signé | ❌ |

`isActive` n'est lu **qu'une fois dans tout le produit** : `auth.ts:88`, à
l'instant de la connexion. `requireSuperAdmin()` n'interroge pas la base du
tout. Aucun `maxAge` n'est posé : la durée est celle par défaut de
`@auth/core` 0.41.2, **trente jours** (`node_modules/@auth/core/lib/init.js:38`).

**Ce que cela casse, et c'est la raison d'être de cette story :**

1. Le bouton « Désactiver » de `/agency/users` écrit en base, journalise
   `desactivation_compte`, affiche « Compte désactivé » — et ne retire
   aucun accès. L'en-tête de cet écran promet pourtant que c'est
   l'administrateur qui « ouvre et **ferme** les accès de ses
   collaborateurs ».
2. Le commentaire de `app/admin/users/page.tsx:132` prescrit la
   désactivation comme remède à un compte compromis. Ce remède n'existe
   pas. **Il n'y a aujourd'hui aucun moyen de couper l'accès d'un compte**,
   sauf suspendre l'agence entière — fermer à tous pour fermer à un.
3. Une rétrogradation `agency_admin → agent` ne prend pas effet. Une
   promotion non plus, sans que rien ne le dise à l'intéressé.
4. **Elle mine la story 4.6 avant qu'elle soit écrite.** Celle-ci va poser
   `requireAgencyAdmin()` sur cinq suppressions destructives ; cette garde
   compare `context.userRole`, une valeur du jeton. C'est pourquoi cette
   story passe **avant** elle (`docs/epics.md`, « Ordre imposé », point 3).

## Ce que je tranche, et pourquoi

**1. Une seule requête, pas deux.** `requireAgency` et `getApiAgency` font
déjà un `agency.findUnique`. Elles feront à la place un
`user.findUnique({ where: { id }, include/select: { agency } })` : le compte
**et** son agence en un seul appel Prisma. `requireSuperAdmin` gagne une
requête là où elle n'en faisait aucune — c'est la console de l'éditeur, six
écrans, son trafic ne compte pas.

> *Corrigé en revue.* Ce paragraphe concluait « le coût sur les chemins
> chauds est donc **nul** », et la formule a été recopiée dans quatre
> documents. Elle est fausse : un appel Prisma sur une relation to-one
> produit **deux instructions SQL**. Le surcoût réel est d'un aller-retour
> par requête, ce qui reste sans commune mesure avec le défaut fermé — mais
> ce dépôt tient qu'une affirmation que le code ne tient pas est un défaut,
> et celle-ci servait d'argument.

**2. La base gagne sur le jeton, pour les trois champs.** Le rôle, l'agence
et `isActive` retournés par les gardes viennent de la base. Conséquence
secondaire assumée : un compte déplacé d'une agence à l'autre suit
immédiatement sa nouvelle agence, au lieu de continuer à lire l'ancienne.
Aucun écran ne permet ce déplacement aujourd'hui ; le refermer coûte zéro
ligne de plus.

**3. Le middleware garde le jeton, et c'est définitif.** Il tourne en Edge
Runtime : il n'a ni Prisma ni base, c'est tout l'objet de la frontière posée
entre `auth.config.ts` et `auth.ts`. **Ne pas essayer de la franchir.** Le
middleware aiguille (`/admin` vs `/agency`), il n'autorise pas — l'autorisation
appartient aux gardes, qui ont la base. Le pire cas restant est cosmétique :
un compte désactivé traverse le middleware et se fait éjecter par la garde,
une requête plus loin. Cette règle doit être écrite dans
`docs/architecture.md` pour que personne ne « corrige » le middleware.

> **CE POINT ÉTAIT FAUX, ET C'EST LA REVUE QUI L'A MONTRÉ.** Deux erreurs
> dans le même paragraphe.
>
> *Un.* Le middleware n'aiguillait pas : il **autorisait**. Il renvoyait
> `403` en JSON sur les routes d'API et redirigeait les pages, sur un rôle
> lu dans le jeton. Ce sont des décisions de refus prises sur une donnée
> périmée — exactement ce que cette story existe pour supprimer.
>
> *Deux.* « Le pire cas restant est cosmétique » ne tenait pas non plus. En
> faisant lire la base aux gardes, cette story a mis les deux couches en
> désaccord et ouvert une **boucle de redirection** : un super admin
> rétrogradé était renvoyé de `/admin` vers `/agency` par sa garde, puis de
> `/agency` vers `/admin` par le middleware, indéfiniment. Le compte n'était
> pas rétrogradé, il était enfermé, sans issue en libre-service. La branche
> était inatteignable avant cette story ; c'est elle qui l'a ouverte.
>
> La frontière Edge est réelle et elle est maintenue — mais la conclusion
> juste n'était pas « le middleware garde le jeton », c'était **« le
> middleware cesse d'autoriser »**. Deux couches qui décident sur deux
> sources ne peuvent pas être mises d'accord : on en retire une, et c'est
> celle qui lit la source périmée. Voir l'AC 5, réécrit.

**4. Durée de session : trente jours → douze heures.** Trente jours n'est
pas une session, c'est un identifiant permanent laissé dans un navigateur.
Douze heures couvrent la journée d'une agence, du matin au soir. Sur un
outil qui détient des pièces d'identité et des actes de propriété, une
reconnexion par jour est le prix normal. Arbitrage produit, rendu par
délégation le 12-08-2026, consigné dans `sprint-status.yaml`, réversible en
une ligne.

**5. Où va un compte désactivé : `/auth/login?error=…`** et pas une page
nouvelle. Le formulaire de connexion affiche déjà `searchParams.error`
(`app/auth/login/page.tsx:21`), et s'il retente sa chance,
`explainLoginFailure` lui dit exactement pourquoi
(`app/auth/login/actions.ts:64` traite déjà `!user.isActive`). Le chemin
existe de bout en bout, il ne reste qu'à l'emprunter. **Vérifier l'absence
de boucle** : la page de connexion ne redirige pas un visiteur déjà porteur
d'un cookie — vérifié, elle n'en teste pas la présence — donc
`/agency → /auth/login` s'arrête là.

**6. Ce qui reste ouvert après cette story, et qui est nommé :** un jeton
**volé** sur un compte qui reste actif demeure utilisable jusqu'à
expiration, y compris après changement de mot de passe. C'est la
**story 5.8** (une colonne d'horodatage, une migration). Cette story-ci ne
touche pas au schéma.

## Acceptance Criteria

1. **Given** un compte d'agence connecté, avec une session ouverte et
   valide — **When** son administrateur le désactive depuis
   `/agency/users` — **Then** à sa requête suivante il est éjecté, sans
   avoir eu à se reconnecter — **And** il ne peut plus ni lire une page de
   `/agency`, ni appeler une route d'API, ni soumettre une Server Action.

2. **Given** un `agency_admin` connecté, avec une session ouverte —
   **When** son rôle est ramené à `agent` — **Then** la requête suivante le
   traite comme un `agent` : les actions réservées à l'administrateur lui
   sont refusées — **And** la réciproque vaut, un agent promu obtient ses
   droits sans se reconnecter.

3. **Given** un `super_admin` désactivé — **When** il rouvre `/admin` —
   **Then** il est éjecté. C'est le seul chemin où le compte n'était
   vérifié à **aucun** moment après la connexion : `requireSuperAdmin()`
   n'interroge pas la base.

4. **Given** `requireAgency` et `getApiAgency` font déjà une requête pour
   l'agence — **When** elles relisent l'utilisateur — **Then** elles le font
   par **un seul appel Prisma** qui rapporte le compte et son agence —
   **And** `requireAgency()` renvoie le même contrat à ses appelants :
   aucune signature ne change, aucun appelant n'est modifié.

   > *Corrigé en revue, deux fois.* Le surcoût réel est **un aller-retour
   > SQL de plus**, Prisma éclatant une relation to-one en deux
   > instructions : « une seule requête » vaut pour l'appel Prisma, pas
   > pour le SQL, et « coût nul » était faux. Et le nombre d'appelants est
   > **66, dans 39 modules** (`grep -roE '\brequireAgency\(\)' app | wc -l`),
   > pas 31 — chiffre hérité de l'audit du 9 août, jamais recompté. Le fond
   > tient dans les deux cas ; les affirmations chiffrées, non.

5. **Given** le middleware tourne en Edge et ne peut pas atteindre la base
   — **When** la story se termine — **Then** il **n'autorise plus rien** :
   il vérifie qu'une session existe et laisse passer — **And** l'aiguillage
   entre `/admin` et `/agency` vit dans `lib/auth-guard.ts`, sur la base,
   **et c'est écrit dans `docs/architecture.md`** — **And** aucune tentative
   n'est faite pour donner accès à la base au middleware.

   > *Réécrit en revue.* Le critère d'origine demandait que le middleware
   > « continue de lire le rôle dans le jeton » en le décrivant comme un
   > aiguillage sans autorisation. C'était faux — il refusait (`403` JSON,
   > redirections) — et surtout **incompatible avec l'AC 2** : dès que les
   > gardes ont lu la base, les deux couches ont pu se contredire, et un
   > compte rétrogradé s'est retrouvé enfermé dans une boucle de
   > redirection. Deux couches qui autorisent sur deux sources ne se
   > réconcilient pas ; celle qui lit la source périmée doit partir.

6. **Given** une session de trente jours n'est pas une session — **When**
   la story se termine — **Then** `auth.config.ts` pose un `maxAge`
   explicite de **12 heures** — **And** la valeur est commentée comme un
   arbitrage produit, réversible — **And** le comportement de glissement
   (une journée de travail continue n'est pas coupée en son milieu) est
   **mesuré et consigné**, pas déduit du code.

7. **Given** le commentaire de `app/admin/users/page.tsx:132` prescrit un
   remède qui n'existait pas — **When** la story se termine — **Then** il
   dit vrai, ou il est réécrit pour dire ce qui est vrai — **And** le cas
   qui reste hors de portée (jeton volé, compte laissé actif) y est nommé et
   renvoyé à la story 5.8.

8. **Given** `tests/roles.spec.ts` couvre la séparation des rôles —
   **When** la story est terminée — **Then** un test désactive un compte
   **pendant** qu'il est connecté et prouve l'éjection à la requête
   suivante — **And** un autre prouve la rétrogradation à chaud — **And** la
   couverture est prouvée **par mutation** : en rétablissant la lecture du
   rôle depuis le jeton, les tests rougissent.

## Tasks / Subtasks

- [x] **Tâche 1 — `requireAgency()` relit le compte (AC: 1, 2, 4)**
  - [x] Remplacer `agency.findUnique` par un `user.findUnique` sur
        `session.user.id`, qui rapporte `isActive`, `role`, `agencyId` et
        l'agence complète (`include: { agency: true }` — le contrat renvoie
        `agency: Agency`, entière, ne pas la réduire à un `select`)
  - [x] Ordre des refus : compte absent → `/auth/login` ; compte inactif →
        `/auth/login?error=…` ; pas d'`agencyId` → `/auth/login` ; agence
        absente → `/auth/login` ; agence non `active` →
        `/auth/inactive?status=…` (comportement existant, à préserver)
  - [x] Renvoyer `userRole` et `agencyId` **de la base**, jamais du jeton
  - [x] **La seule valeur consommée du jeton est `session.user.id`.** Ne pas
        conserver `!session?.user?.agencyId` comme portillon d'entrée : ce
        test rouvrirait la péremption pour le compte déplacé d'une agence à
        l'autre, et ferait dépendre le refus d'une donnée qu'on vient de
        cesser de croire. La session ne sert plus qu'à dire *qui* demande
  - [x] Vérifier qu'aucun des appelants n'a besoin d'être touché (66 appels, 39 modules — recompté en revue, la story disait 31)

- [x] **Tâche 2 — `getApiAgency()` relit le compte (AC: 1, 2, 4)**
  - [x] Même requête, `select` étroit (elle ne rend pas l'agence entière)
  - [x] Conserver la sémantique des codes : `401` pour « pas de session /
        compte inconnu / compte désactivé », `403` pour « agence inactive »
  - [x] Le message reste exploitable par le client : ne pas révéler plus
        que « Non authentifié »

- [x] **Tâche 3 — `requireSuperAdmin()` relit le compte (AC: 3)**
  - [x] Une requête, sur `isActive` et `role`
  - [x] Un `super_admin` désactivé, ou dont le rôle a changé, part sur
        `/auth/login?error=…` ; un non-`super_admin` continue d'aller sur
        `/agency` (comportement existant)

- [x] **Tâche 4 — durée de session (AC: 6)**
  - [x] `maxAge: 12 * 60 * 60` dans `auth.config.ts`, commenté
  - [x] **Mesurer** le glissement : `maxAge` temporairement à 60 s, se
        connecter, naviguer sans interruption au-delà de 60 s, noter si la
        session survit. Consigner le résultat dans le Debug Log, et **ne
        rien affirmer qui n'ait été observé**
  - [x] Si elle ne glisse pas, ne pas improviser : consigner et remonter le
        point — une session coupée en pleine saisie est un défaut produit,
        pas un détail de configuration

- [x] **Tâche 5 — les commentaires disent le vrai (AC: 5, 7)**
  - [x] `app/admin/users/page.tsx:132` : réécrire le paragraphe sur les
        sessions non révoquées
  - [x] `docs/architecture.md` §5 : la table « ce qui est relu / ce qui est
        cru » passe au présent, et la règle du middleware y est écrite
  - [x] `lib/auth-guard.ts` : le commentaire d'en-tête de `requireAgency`
        énonce ce qui est revérifié — l'agence **et** le compte

- [x] **Tâche 6 — couverture de non-régression (AC: 8)**
  - [x] `tests/roles.spec.ts` : désactivation à chaud (page + route d'API)
  - [x] `tests/roles.spec.ts` : rétrogradation à chaud, avec son contrôle
        positif (l'action réussit avant, échoue après)
  - [x] Audit par mutation : rétablir la lecture depuis le jeton, vérifier
        que les tests rougissent, remettre la correction. Consigner la
        mutation exacte dans le Debug Log
  - [x] `npm run test:e2e` vert dans son ensemble — 93 cas existants,
        aucun ne doit tomber

- [x] **Tâche 7 — clôture**
  - [x] `docs/qa/bug-report.md` : BUG-33 marqué corrigé, avec la date
  - [x] `docs/stories/sprint-status.yaml` : statut de la story
  - [x] Tout report éventuel dans `docs/stories/deferred-work.md`, motivé

## Dev Notes

### L'état exact des trois gardes avant modification

Lues intégralement le 12-08-2026. `lib/auth-guard.ts`, 143 lignes, cinq
exports. Ce qu'il faut savoir avant d'y toucher :

| Fonction | Ligne | Base interrogée | Renvoie |
|---|---|---|---|
| `requireAgency` | 18 | `agency.findUnique` (agence **entière**) | `{ agencyId, agency, userId, userRole, userName }` |
| `requireSuperAdmin` | 53 | **aucune** | `{ userId, userName }` |
| `requireAgencyAdmin` | 80 | via `requireAgency` | le contexte de `requireAgency` |
| `isAgencyAdmin` | 99 | — | booléen, pur |
| `getApiAgency` | 107 | `agency.findUnique` (`select` étroit) | union `ok:true` / `ok:false` + statut |

- **`requireAgency` renvoie l'agence entière** (`agency: Agency`), et des
  écrans s'en servent (nom, logo, couleur, slug, `subscriptionEndsAt`).
  Passer à un `select` partiel casserait le type et des pages. Utiliser
  `include: { agency: true }`.
- **`requireAgencyAdmin` et `isAgencyAdmin` n'ont pas à changer** : la
  première lit `context.userRole`, qui devient authentique par la tâche 1 ;
  la seconde est pure et reçoit le rôle de son appelant. Les 8 routes
  d'API qui appellent `isAgencyAdmin(guard.userRole)` héritent donc de la
  correction sans être touchées. **Vérifier que c'est bien le cas — c'est
  le meilleur retour sur cette story.**
- **`redirect()` lève `NEXT_REDIRECT`** : ne jamais l'entourer d'un
  `try/catch`. C'est ainsi que les gardes fonctionnent aujourd'hui.
- `session.user.id` vient de `token.sub` (`auth.config.ts`, callback
  `session`). Il est donc toujours présent quand une session existe, et
  c'est la clé du `findUnique`.

### Le piège de cette story : ne pas confondre « pas de session » et « compte disparu »

Trois cas, trois traitements, et les mélanger produit soit une boucle de
redirection, soit un silence :

| Cas | Ce que voit la garde | Traitement |
|---|---|---|
| Aucun cookie | `session` nulle | `/auth/login` (existant) |
| Cookie valide, compte supprimé en base | `findUnique` → `null` | `/auth/login` — le cookie survit à la ligne, c'est la nature du JWT |
| Cookie valide, compte désactivé | `isActive === false` | `/auth/login?error=…`, message affiché |

Le deuxième cas n'est pas théorique : `User` est en `onDelete: SetNull` sur
`Agency`, mais rien n'empêche une suppression de compte en base. La garde
doit le traiter sans lever d'exception.

### La sémantique de `maxAge`, vérifiée dans la version installée

Ne pas se fier à un souvenir de NextAuth : la version épinglée est
`next-auth@5.0.0-beta.31` sur `@auth/core@0.41.2`, et voici ce que son code
dit exactement.

- `node_modules/@auth/core/lib/init.js:38` — `maxAge` par défaut :
  `30 * 24 * 60 * 60`, **trente jours**.
- `init.js:76` — `updateAge` par défaut : `24 * 60 * 60`.
- `init.js:83` — `jwt.maxAge` reprend `session.maxAge` : poser
  `session.maxAge` suffit, ne pas dupliquer.
- `lib/actions/session.js:32-49` — sur la branche **JWT**, le jeton est
  **ré-signé à chaque lecture de session** avec un nouvel `expires`, et
  `updateAge` **n'est pas consulté** (il ne l'est que sur la branche base de
  données, ligne 77). Autrement dit : sur cette pile, `maxAge` se comporte
  en délai **d'inactivité** glissant, pas en couperet absolu — **à condition
  que la réponse puisse poser un cookie.**

C'est cette dernière condition qui interdit de conclure par la lecture : un
Server Component ne peut pas écrire de cookie, le middleware si. Le
middleware tourne sur presque toutes les requêtes de ce projet, donc le
glissement devrait avoir lieu — **« devrait » n'est pas une preuve.** D'où
la mesure exigée par la tâche 4. Ce dépôt a déjà payé une conclusion tirée
d'une lecture de code : voir le contrôle mort de `/api/upload`, retiré parce
qu'il « se donnait le nom de garde-fou » sans rien vérifier.

### Harnais de test disponible

| Besoin | Où |
|---|---|
| Agence jetable + comptes | `tests/agence.ts` — `creerAgence(["agency_admin","agent"])` |
| Décor métier (12 entités liées) | `tests/agence.ts` — `garnir(agence)` |
| Nettoyage | `tests/agence.ts` — `effacerAgence(agence)` |
| Écriture et lecture en base, sans le filtre de suppression réversible | `tests/db.ts` — `db` |
| Connexion | `tests/auth-helper.ts` — `login(page, email)` |

**`tests/db.ts` est ce qui rend cette story testable** : la désactivation à
chaud se pose par `db.user.update({ where: { id }, data: { isActive: false } })`
pendant que la page est connectée. Passer par l'interface d'un
administrateur marcherait aussi, mais demande une seconde session et
n'éprouve pas ce qu'on veut éprouver — la garde, pas l'écran.

**`login()` pose une identité d'appelant obligatoire.** Sans elle, tous les
tests tombent dans le compteur `inconnu` et franchissent le plafond de 60
connexions par quart d'heure ; le symptôme est un `waitForURL` expiré sur un
test sans rapport, et il coûte une heure à diagnostiquer. Ne jamais se
connecter autrement.

**Utiliser une agence jetable, pas les comptes du seed.** Désactiver
`agent@aqar.dz` en cours de suite casserait les autres cas qui s'y
connectent — la suite tourne `fullyParallel`. `creerAgence(["agency_admin",
"agent"])` donne exactement les deux comptes nécessaires, dans une agence à
soi.

**Délais :** `test.setTimeout(180000)`, standard des tests de rôle du dépôt.
Chaque `login()` vérifie un bcrypt de coût 12 sur un serveur unique partagé
par quatre travailleurs.

**Prouver le refus des trois surfaces de l'AC 1, du plus simple au plus
coûteux.** Il n'y a pas besoin de rejouer un POST d'action ici — la story
4.6 devra le faire, celle-ci non :

| Surface | Preuve | Coût |
|---|---|---|
| Page | `page.goto("/agency/clients")` → l'URL finit sur `/auth/login` | trivial |
| Route d'API | `page.request.get("/api/export/clients")` → 401 JSON | trivial |
| Server Action | charger un formulaire **pendant** que le compte est actif, désactiver en base, **puis** soumettre : l'action appelle `requireAgency()` en première ligne et redirige. Le formulaire déjà rendu suffit, la session est encore dans le navigateur | faible |

La troisième ligne est le cœur du cas : c'est exactement la situation
réelle — quelqu'un a l'écran ouvert quand son accès est coupé.

### Le contrôle positif est obligatoire

Imposé par la revue de la story 4.2, appliqué partout dans
`roles.spec.ts` : **un refus seul ne prouve rien.** Une garde cassée pour
tout le monde donne le même vert qu'une garde correcte. Donc :

- éjection après désactivation → doublée du **succès du même compte avant**
  la désactivation, sur la même adresse ;
- refus après rétrogradation → doublé du **succès avant** la
  rétrogradation.

Et l'audit par mutation par-dessus : la méthode de la story 4.4, qui a
mesuré qu'une mutation ne compilant pas ne prouve rien — choisir une
mutation qui **compile** (relire le rôle depuis `session.user.role` au lieu
de la base) et vérifier que les tests rougissent.

### Ce que cette story ne fait pas

- **Aucune migration, aucune colonne.** Le jeton volé sur un compte actif
  reste hors de portée : story 5.8.
- **Elle ne remplace pas la stratégie JWT** par des sessions en base. C'est
  la règle 4 d'`AGENTS.md` et une décision d'architecture, pas un
  correctif ; le point d'attention est ouvert dans `sprint-status.yaml`.
- **Elle ne touche pas au middleware**, sinon pour documenter son rôle.
- **Elle ne restreint aucune suppression** : c'est la story 4.6, qui vient
  juste après et qui s'appuie sur celle-ci.
- **Elle n'ajoute pas de runner unitaire.** La couverture est E2E, dans
  `tests/roles.spec.ts`. Ajouter Vitest est la story 4.5.

### Project Structure Notes

Trois fichiers de production (`lib/auth-guard.ts`, `auth.config.ts`,
`app/admin/users/page.tsx` pour son commentaire), un fichier de test
existant, deux documents. Aucun module nouveau, aucune dépendance : Prisma
et `auth()` sont déjà importés dans `lib/auth-guard.ts`.

`npx tsc --noEmit` et `npm run lint` doivent rester à 0 erreur — c'est la
définition de « terminé » de `docs/project-context.md`, qui exige aussi
qu'au moins un test couvre la régression corrigée.

### References

- [Source: docs/qa/bug-report.md#bug-33] — le constat, la table de ce qui est relu, les quatre conséquences, l'arbitrage des deux niveaux
- [Source: docs/epics.md#Story-1.8] — les huit critères ; « Ordre imposé » point 3 pour la précédence sur la story 4.6
- [Source: docs/epics.md#Story-5.8] — ce qui est explicitement laissé de côté ici
- [Source: docs/architecture.md#5] — le flux d'authentification et la table de fraîcheur ; §8 point 5 pour la limite structurelle
- [Source: docs/project-context.md] — le quatrième piège du dépôt, et la définition de « terminé »
- [Source: docs/stories/sprint-status.yaml] — arbitrage des 12 heures (point d'attention épopée 1, 12-08-2026)
- [Source: docs/stories/4-6-fermer-la-suppression-directe.md] — la story qui dépend de celle-ci ; ses Dev Notes portent le harnais de test et les pièges du dépôt
- [Source: docs/stories/4-4-verrouiller-les-correctifs-epopee-1.md] — méthode de l'audit par mutation
- `node_modules/@auth/core/lib/init.js` et `lib/actions/session.js` — la sémantique réelle de `maxAge` sur la version épinglée

## Dev Agent Record

### Context Reference

Story rédigée et implémentée le 12-08-2026 dans la même session, à partir de
la quatrième passe d'audit. Contexte porté par la story elle-même : registre
des défauts (BUG-33), `docs/architecture.md` §5, et le harnais de test légué
par les stories 4.1 à 4.4.

### Agent Model Used

claude-opus-5[1m] (Claude Opus 5, 1M context)

### Debug Log References

**Phase rouge — le défaut reproduit, et pire que prévu.** Les trois tests
écrits avant toute correction, exécutés sur le code d'origine : 3 échecs.
Le premier a livré la preuve que les trois passes précédentes n'avaient pas :

```
TimeoutError: page.waitForURL: Timeout 30000ms exceeded.
  waiting for navigation until "load"
  navigated to "http://localhost:3002/agency/owners?success=Proprietaire%20cree"
```

Un compte **désactivé pendant sa session** n'a pas seulement continué à
**lire** : il a **écrit**. Un propriétaire a été créé en base. BUG-33 passe
donc de « établi par lecture » à **[CONFIRMÉ]**, et le registre a été
corrigé en conséquence.

Les trois contrôles positifs ont réussi avant la coupure dans les trois cas
— le décor n'était donc pas cassé, et les refus attendus portaient bien sur
la propriété visée.

**Mesure de `maxAge` (AC 6), et non déduction.** `maxAge` abaissé à 60 s le
temps d'une mesure jetable (`tests/mesure-maxage.spec.ts`, supprimé ensuite) :

```
[mesure] activite t+15s -> /agency/clients      … t+90s -> /agency/clients
[mesure] APRES 90s D'ACTIVITE CONTINUE : /agency/clients
[mesure] APRES 75s D'INACTIVITE : /auth/login
```

Conclusion : sur la stratégie JWT, le délai se comporte en **inactivité
glissante**. La lecture du code le laissait attendre — `@auth/core` ré-signe
le jeton à chaque lecture de session et ne consulte pas `updateAge`
(`lib/actions/session.js:32-49`) — mais elle ne le prouvait pas, la
ré-écriture du cookie dépendant de la capacité de la réponse à en poser un.
C'est le middleware qui la donne. Une journée de saisie n'est donc pas
coupée en son milieu ; une inactivité plus longue que le délai coupe.

**Audit par mutation.** Deux mutations, toutes deux compilantes :

| Mutation | Effet attendu | Résultat |
|---|---|---|
| L'état d'origine (rôle et `isActive` lus du jeton) — la phase rouge | les 3 tests rougissent | ✅ 3 échecs |
| `userRole: session.user.role` dans les deux gardes, code final par ailleurs | seul le test de rétrogradation rougit | ✅ 1 échec, 2 succès |

La seconde est la plus instructive : elle prouve que la couverture du **rôle**
tient à un test précis, et pas au hasard d'un décor partagé. Les deux
mutations ont été retirées ; `tsc --noEmit` repasse à 0 après retrait.

**Suite complète :** `npm run test:e2e` → **96 cas, 96 verts** (1,2 min).
`npx tsc --noEmit` → 0 erreur. `npm run lint` → 0 erreur, 4 avertissements
`<img>` préexistants et documentés.

### Completion Notes List

1. **La correction n'a rien coûté sur les chemins chauds, et c'est ce qui la
   rend tenable.** `requireAgency` et `getApiAgency` faisaient déjà une
   requête pour l'agence ; elles en font une pour le compte **et** l'agence.
   Seule `requireSuperAdmin` en gagne une — elle n'en faisait aucune, ce qui
   était précisément le problème : c'était le seul chemin où le compte le
   plus puissant du système n'était vérifié à aucun moment après sa
   connexion.

2. **Les huit routes d'API de suppression ont hérité de la correction sans
   une ligne de code.** Elles appellent `isAgencyAdmin(guard.userRole)` ;
   `guard.userRole` vient maintenant de la base. `requireAgencyAdmin` et
   `isAgencyAdmin` n'ont pas été touchés. C'est le meilleur rendement de la
   story, et c'était prévisible : la valeur avait un seul point d'entrée.

3. **La seule valeur du jeton encore consommée est `session.user.id`.** Le
   pré-contrôle `if (!session?.user?.agencyId)` a été retiré, pas conservé :
   le garder aurait rouvert la péremption pour le compte déplacé d'une agence
   à l'autre, et l'aurait rendue invisible puisque le reste du fichier aurait
   eu l'air correct. Le fichier porte cet avertissement en tête.

4. **Un cas que la lecture initiale avait sous-estimé : le compte
   supprimé.** Un jeton signé ne sait pas que la ligne qu'il désigne a
   disparu. Les trois gardes traitent donc `findUnique → null` comme un refus
   explicite, et non comme une exception à laisser filer.

5. **`401 Non authentifié` pour un compte désactivé sur les routes d'API**,
   même code et même message qu'une absence de session. Une réponse d'API est
   lue par du code ; la raison exacte est donnée sur le chemin des pages, qui
   est celui où un humain la lira. Décision prise dans la story (tâche 2),
   tenue à l'implémentation.

6. **Ce qui reste ouvert, et qui est nommé dans le code lui-même** : un jeton
   volé sur un compte laissé actif reste utilisable jusqu'à expiration, y
   compris après changement de mot de passe. Le commentaire de
   `app/admin/users/page.tsx` le dit désormais, au lieu de prescrire un
   remède qui n'existait pas. Story 5.8.

7. **Aucun travail reporté.** `deferred-work.md` n'a pas été touché : les huit
   critères sont couverts, la mesure exigée a été faite, et rien n'a été
   laissé de côté en cours de route.

### File List

**Modifiés**
- `lib/auth-guard.ts` — les trois gardes relisent le compte en base ; la seule valeur du jeton consommée est `session.user.id`. *En revue :* `select` étroit (l'empreinte bcrypt ne traverse plus les 66 appels), aiguillage de l'éditeur vers `/admin`, message de refus distinct selon le recours, `getApiAgency` cesse de révéler l'authentification à un compte sans agence
- `auth.config.ts` — `maxAge` explicite de 12 heures, commenté comme arbitrage produit
- `middleware.ts` — *ajouté en revue :* le contrôle de rôle en est retiré (il ouvrait une boucle de redirection) ; `303` au lieu de `307` quand la méthode n'est pas GET, avec un motif affiché
- `next.config.mjs` — *ajouté en revue :* `experimental.staleTimes.dynamic = 0`, le cache de routeur resservait 30 s une page interdite
- `app/admin/users/page.tsx` — le commentaire sur les sessions non révoquées dit ce qui est vrai
- `tests/roles.spec.ts` — bloc « Révocation d'un accès à chaud (BUG-33) », 3 tests avec contrôles positifs. *En revue :* 3 cas de plus (promotion, éditeur rétrogradé sans boucle, bouton « Désactiver » de la console d'agence), le motif de refus asserté, et le décor jetable nettoyé par `afterEach` — un dépassement de délai n'exécute pas un `finally`
- `docs/qa/bug-report.md` — BUG-33 **[CONFIRMÉ]** puis corrigé, avec la preuve de la phase rouge ; *en revue :* le coût réel mesuré, la boucle et le cache de routeur consignés
- `docs/architecture.md` — §5 table de fraîcheur au présent, **et §8 point 5 qui est un ajout de cette story, pas une reformulation** ; §9 état de santé. *En revue :* le coût corrigé, le rôle réel du middleware, ce que les 12 h ne bornent pas
- `docs/architecture.md` §8 point 6 — **constat hors périmètre** (le net propriétaire calculé à quatre endroits) : il n'appartient à aucun défaut du registre ni à cette story. Marqué comme tel dans le document et versé à `deferred-work.md`, propriétaire pressenti story 4.5
- `docs/project-context.md` — quatrième piège réécrit : ce qui est désormais frais, et ce qui manque encore (BUG-32). *En revue :* emphase markdown réparée, et le rôle du middleware ajouté aux pièges
- `docs/epics.md` — AC 4, 5 et NFR-12 corrigés ; story 5.8 nuancée *(omis de la première liste)*
- `docs/README.md` — le décompte des bloquants remplacé par leurs noms *(omis de la première liste)*
- `tests/regression.spec.ts` — *ajouté en revue :* l'activation d'agence attend son **effet** (le badge de la ligne) et non `networkidle`, qui se résolvait pendant que la Server Action était encore en vol et faisait échouer une connexion trente lignes plus loin. Diagnostiqué en relevant en base le statut des agences laissées par les exécutions rouges : `pending`
- `docs/stories/deferred-work.md` — quatre reports issus de la revue, dont le `200` des refus de garde sur page diffusée en flux
- `docs/stories/sprint-status.yaml` — statut de la story

**Créés**
- `docs/stories/1-8-rendre-la-revocation-effective.md` — cette story

**Créés puis supprimés**
- `tests/mesure-maxage.spec.ts` — mesure jetable du glissement de session (AC 6). Résultat consigné dans le Debug Log ; le fichier n'avait pas à rester, il n'éprouve pas le produit mais une valeur de configuration

### Review Findings

Revue adversariale du 12-08-2026, trois couches parallèles (chasseur à
l'aveugle, chasseur de cas limites, auditeur des critères d'acceptation),
menées sans le contexte de la session d'implémentation. **22 constats
retenus.** Les trois couches ont convergé indépendamment sur la boucle de
redirection et sur la fausseté de l'affirmation « coût nul ».

**Décision requise (2)**

- [x] [Review][Decision] **Cache de routeur : 30 s de sursis pour un compte désactivé** — Next 14.2 sert les segments dynamiques déjà visités depuis le cache client pendant 30 s, **sans requête au serveur** : aucune garde n'est appelée. Un compte désactivé continue donc de lire les pages qu'il avait ouvertes. La propriété tenue est « à la requête suivante », pas « à la navigation suivante ». Correctif : `experimental: { staleTimes: { dynamic: 0 } }` dans `next.config.mjs` — un arbitrage de performance à l'échelle de l'application, hors du périmètre de cette story. [`next.config.mjs`]
- [x] [Review][Decision] **Server Action soumise après expiration : la saisie est perdue en silence** — le middleware répond `307` sur une page protégée, ce qui **préserve la méthode** : le navigateur re-POSTe le corps de l'action vers `/auth/login`, qui n'en connaît aucune. Tout ce qui était saisi est perdu, sans message. Comportement préexistant, mais faire passer `maxAge` de 30 jours à 12 h le transforme en « chaque matin, pour tout onglet laissé ouvert ». Correctif : `303` pour les méthodes non-GET et `?error=Session expirée` — touche `middleware.ts`, que cette story avait exclu de son périmètre. [`middleware.ts:73`]

**À corriger (18)**

- [x] [Review][Patch] **Boucle de redirection `/admin` ⇄ `/agency` quand le jeton et la base divergent sur `super_admin`** — le middleware autorise `/admin` sur le rôle du **jeton**, la garde refuse sur celui de la **base** et renvoie vers `/agency`, d'où le middleware renvoie vers `/admin`. `ERR_TOO_MANY_REDIRECTS` sur les deux espaces : le compte n'est pas rétrogradé, il est bloqué, sans issue en libre-service. Branche inatteignable avant cette story, puisque les deux côtés lisaient la même valeur. **Gravité haute.** [`lib/auth-guard.ts:143`, `middleware.ts:79-89`]
- [x] [Review][Patch] **« Coût : zéro requête supplémentaire » est faux — mesuré : 1 → 2 requêtes SQL** — Prisma éclate la relation to-one en deux instructions (`relationLoadStrategy` par défaut). C'est un seul appel Prisma, deux allers-retours. L'affirmation figure dans quatre documents et dans un critère d'acceptation. **Gravité haute** : ce dépôt tient qu'une affirmation non tenue par le code est un défaut. [`lib/auth-guard.ts:77`, `docs/architecture.md`, `docs/qa/bug-report.md`]
- [x] [Review][Patch] **Le test laisse un `super_admin` au mot de passe connu si Playwright expire** — `finally` n'est pas exécuté quand le délai du cas est dépassé, et ce délai est réaliste (bcrypt coût 12, serveur unique). Un compte de console éditeur avec `password123` s'installe alors définitivement dans toute base durable. **Gravité haute.** [`tests/roles.spec.ts:415-461`]
- [x] [Review][Patch] **`refusDeCompte()` et son message ne sont assertés par aucun test** — les trois assertions d'éjection ne vérifient que `/auth/login` : remplacer `redirect(refusDeCompte())` par `redirect("/auth/login")` laisse la suite verte, alors que le registre affirme « le motif s'affiche ». [`tests/roles.spec.ts:336,350,457`]
- [x] [Review][Patch] **La réciproque du critère 2 (promotion) n'a aucun test** — seule la rétrogradation est éprouvée. C'est le sens où une lecture périmée **accorde** un pouvoir au lieu de le retenir. [`tests/roles.spec.ts:363`]
- [x] [Review][Patch] **Aucun test n'épingle la lecture en base du rôle dans `requireSuperAdmin`** — rétablir `session.user.role` dans cette garde laisse la suite verte : le seul test d'éditeur éprouve `isActive`. Or `docs/architecture.md` publie une table affirmant que le rôle est relu dans **les trois** gardes. Un tiers de cette table n'est pas tenu — et c'est le tiers qui produit la boucle. [`lib/auth-guard.ts:143`]
- [x] [Review][Patch] **Le test de désactivation contourne l'écran contre lequel le défaut a été signalé** — BUG-33 parle du bouton « Désactiver » de `/agency/users` qui « ne ferme rien ». Aucun test ne passe par ce bouton ; la coupure est posée en base. La garde est prouvée, la promesse de l'écran non. [`tests/roles.spec.ts:325`]
- [x] [Review][Patch] **Les 12 h ne bornent pas le risque que les documents leur font borner** — le jeton est ré-signé à chaque lecture de session : un jeton volé et **activement utilisé** ne périme jamais. Les 12 h ne bornent que les sessions inactives. `docs/epics.md` classe la story 5.8 « sans urgence » et l'épopée 5 « ne bloque rien » sur la foi de cette borne. [`docs/epics.md`, `docs/architecture.md`]
- [x] [Review][Patch] **`docs/architecture.md` affirme que le middleware « aiguille sans autoriser » — il autorise** — il renvoie `403` en JSON sur les routes d'API et redirige les pages, sur un rôle lu dans le jeton. Ce sont des décisions de refus sur une donnée périmée, et ce sont elles qui créent la boucle. Le document instruit ensuite de ne pas « corriger le middleware sur ce point », ce qui verrouille la contradiction pour le prochain lecteur. [`docs/architecture.md`]
- [x] [Review][Patch] **Le changement de rôle ne tombe pas « à la requête suivante » à la frontière `/admin`** — vrai pour `agency_admin ⇄ agent`, faux pour toute promotion vers `super_admin` : le middleware refoule le jeton périmé avant qu'aucune garde ne s'exécute. NFR-12 et la ligne « État de santé » l'affirment sans réserve. [`docs/epics.md`, `docs/architecture.md`]
- [x] [Review][Patch] **La liste des fichiers omet `docs/epics.md` et `docs/README.md`** — tous deux modifiés par cette story, le premier portant ses huit critères et NFR-12. [`docs/stories/1-8-*.md`]
- [x] [Review][Patch] **Les modifications de `docs/architecture.md` sont sous-déclarées** — le §8 point 5 est **nouveau**, pas « reformulé », et le §8 point 6 (duplication du calcul du net propriétaire) n'appartient à aucune story : c'est un constat hors périmètre, affirmé comme vérifié, et non tracé. La référence de cette story cite d'ailleurs « §8 point 5 » qui n'existait pas à la base. [`docs/architecture.md`]
- [x] [Review][Patch] **« ses 31 appelants » est un chiffre fabriqué** — l'arbre en compte **66** pour `requireAgency()` seul, 106 toutes gardes confondues, dans 65 modules. Le fond de l'affirmation tient (aucun appelant n'a eu besoin d'être touché) ; le nombre, non. C'est la faute que cette story reproche elle-même à la story 4.1 : « ce que vaut une table écrite de mémoire ». [`docs/epics.md`, story AC 4]
- [x] [Review][Patch] **`getApiAgency` révèle plus qu'avant pour un compte sans agence** — un appelant sans `agencyId` recevait `401 Non authentifié` ; il reçoit maintenant `401 Agence introuvable`, ce qui lui apprend qu'il **est** authentifié. Trois lignes plus haut, la même fonction masque délibérément le cas « désactivé » pour cette raison exacte : deux politiques opposées dans une fonction. [`lib/auth-guard.ts:226`]
- [x] [Review][Patch] **Un éditeur désactivé est renvoyé vers un interlocuteur qui n'existe pas** — `COMPTE_DESACTIVE` dit « contactez l'administrateur de votre agence » ; un `super_admin` n'a pas d'agence. C'est le seul compte dont le verrouillage n'a aucune issue en libre-service, et il reçoit le seul message qui ne mène nulle part. Le libellé diverge en outre de celui d'`explainLoginFailure`. [`lib/auth-guard.ts:31,140`]
- [x] [Review][Patch] **`include: { agency: true }` embarque l'empreinte bcrypt sur 66 chemins** — sans `select`, la requête ramène `password`, `emailVerified` et `image` dans chaque page et chaque Server Action de l'espace agence. `getApiAgency` fait le geste étroit trois fonctions plus loin : le fichier se contredit. [`lib/auth-guard.ts:77`]
- [x] [Review][Patch] **Emphase markdown cassée dans le fichier que tous les agents BMAD lisent en premier** — `**\`requireAgency()\` ne dit **rien** du rôle.**` imbrique deux `**` : la puce se rend en gras tronqué suivi d'astérisques orphelines. [`docs/project-context.md:140`]
- [x] [Review][Patch] **Numéros de ligne faux dans les Dev Notes, et compte de blocants périmé dans `docs/README.md`** — `lib/auth-guard.ts` faisait 143 lignes et non 148, `isAgencyAdmin` était en 99 et non 103, la page de connexion lit `error` en 21 et non 22 ; et `docs/README.md` dit encore que « quatre » défauts bloquent l'ouverture au public, alors que la même phrase a été éditée pour passer de 31 à 33. [`docs/stories/1-8-*.md`, `docs/README.md`]

**Reporté (1)**

- [x] [Review][Defer] **« les 31 Server Actions » de `docs/architecture.md` §3 est un dénombrement faux, et préexistant** — l'arbre porte 44 directives `"use server"`, dont quatre en tête de fichier couvrant plusieurs actions. Ce chiffre vient de l'audit du 9 août et sert d'argument d'exhaustivité (« le confirme sur les 31 Server Actions »). Hors périmètre de cette story, mais à recompter avant de s'appuyer encore dessus. [`docs/architecture.md`] — reporté, préexistant

**Écarté (1)**

- La story n'étant pas suivie par git, un `git commit -a` livrerait le code sans la spec. Exact, mais rien n'est encore commité et le fichier sera ajouté explicitement au moment du commit.

### Résolution de la revue — 12-08-2026

Les 20 constats sont traités. Les deux décisions ont été rendues **par
délégation explicite de l'éditeur** (« je te laisse trancher »), et sont
écrites ici parce qu'un arbitrage non écrit se retrouve à devoir être
rendu deux fois.

**Décision 1 — cache de routeur : `staleTimes.dynamic = 0`, la fraîcheur
l'emporte.** Next 14.2 resservait trente secondes une page interdite, sans
appeler le serveur, donc sans appeler aucune garde. Retenir un gain de
navigation au prix d'une exception à la révocation n'a pas de sens sur un
produit qui détient des pièces d'identité : la propriété qu'on vient de
payer doit valoir pour la navigation, pas seulement pour la requête. Le
coût est quelques allers-retours de plus au retour arrière, sur des pages
déjà rendues par le serveur. `static` est laissé à sa valeur par défaut —
la vitrine publique n'a rien à revalider à la seconde.

**Décision 2 — `303` au lieu de `307` sur les méthodes non-GET, retenue.**
Une redirection `307` préserve la méthode : le navigateur re-POSTait le
corps d'une Server Action vers `/auth/login`, qui n'en connaît aucune. Le
défaut est antérieur, mais passer de trente jours à douze heures le rend
quotidien. Corrigé, avec un motif affiché et `callbackUrl` pour ramener sur
la page quittée. **Ce qui n'est pas corrigé, et qui est reporté :** la
saisie elle-même est perdue. La conserver suppose de la retenir côté
client avant l'envoi — autre chantier.

**Le correctif structurel : le contrôle de rôle quitte le middleware.**
Six constats (boucle de redirection, « aiguille sans autoriser »,
frontière `/admin` non couverte par NFR-12, absence de test sur la lecture
du rôle dans `requireSuperAdmin`, et les deux affirmations de documentation
qui en découlaient) n'avaient qu'une cause : deux couches autorisaient sur
deux sources, dont l'une périmée. Le middleware authentifie désormais et
rien de plus ; l'aiguillage entre les deux espaces vit dans
`lib/auth-guard.ts`, sur la base. Vérifié avant de retirer le contrôle :
les cinq pages de `/admin` appellent toutes `requireSuperAdmin()`
elles-mêmes — le middleware ne couvrait aucune page que sa propre garde ne
couvre pas, et sa branche `403` sur `isApiRoute` était morte (un chemin ne
commence pas à la fois par `/admin` et par `/api/`).

**Les autres correctifs de code.** `select` étroit dans `requireAgency`
(l'empreinte bcrypt ne traverse plus les 66 appels) ; `getApiAgency` rend
la même réponse opaque à un compte sans agence qu'à un compte désactivé ;
le message de refus distingue le recours d'un compte d'agence de celui
d'un éditeur, qui n'a pas d'agence où se plaindre, et reprend la première
phrase d'`explainLoginFailure`.

**Les tests.** Trois cas ajoutés — la promotion (le sens où une lecture
périmée *accorde*), l'éditeur rétrogradé (qui épingle la lecture en base du
rôle dans `requireSuperAdmin` **et** prouve l'absence de boucle : rétablir
le contrôle dans `middleware.ts` fait lever `page.goto` sur
`ERR_TOO_MANY_REDIRECTS`), et le bouton « Désactiver » de `/agency/users`
actionné par un administrateur dans une seconde session, puisque c'est de
ce bouton que parle BUG-33. Le motif de refus est désormais asserté, et non
plus seulement l'adresse. Le décor jetable est nettoyé par `afterEach` et
non par `finally` : un dépassement de délai n'exécute pas un `finally`, et
le mot de passe de l'éditeur jetable n'est plus `password123` mais un
aléa — deux verrous plutôt qu'un sur le même risque.

**Ce que l'écriture de ces tests a appris, et qui dépasse la story.** Les
trois nouveaux cas ont d'abord rougi sur un produit correct. La sonde posée
dans `requireSuperAdmin()` a montré pourquoi : la garde lit bien
`role: "agency_admin"` en base et appelle `redirect("/agency")` — mais la
réponse HTTP est un **`200` sans `Location`**. Toutes les pages de `/admin`
et `/agency` ont un `loading.tsx` : le squelette, donc l'en-tête, part avant
que la garde n'ait tranché, et Next émet la redirection dans le flux, à
charge pour le routeur client de l'exécuter — après l'événement `load` que
`page.goto()` attend. Lire `page.url()` à cet instant, c'est la lire avant
la redirection.

Le refus est réel et rien ne fuit — `await requireSuperAdmin()` précède
toute lecture de données. Mais la leçon « un code HTTP ne prouve pas ce qui
est rendu » vient de coûter une **troisième** fois (stories 4.1, 4.2, puis
ici), et elle est désormais dans `docs/project-context.md`, que tout agent
lit en premier. Ce qui reste à mesurer — le contenu exact du corps déjà
parti — est consigné dans `deferred-work.md`.

**La documentation.** Les affirmations chiffrées ont été recomptées avec la
commande qui les produit, écrite à côté du nombre. « Coût nul » est
remplacé par le coût mesuré partout où il figurait ; les 12 heures ne sont
plus présentées comme une borne du vol de jeton (le jeton est ré-signé à
chaque lecture de session : un jeton volé activement utilisé ne périme
jamais) ; les deux modifications de `docs/architecture.md` sous-déclarées
sont désormais annoncées pour ce qu'elles sont, dont le §8 point 6, versé à
`deferred-work.md` faute de story propriétaire.

### Change Log

| Date | Changement |
|---|---|
| 12-08-2026 | Story créée à partir de la quatrième passe d'audit (BUG-33), 8 critères, arbitrages rendus par délégation |
| 12-08-2026 | Phase rouge : 3 tests écrits avant correction, 3 échecs, défaut reproduit sur l'instance — un compte désactivé écrivait en base |
| 12-08-2026 | Les trois gardes relisent le compte ; `maxAge` fixé à 12 h après mesure du glissement ; 96/96 verts, `tsc` et `lint` propres |
| 12-08-2026 | Revue adversariale : 22 constats, dont une boucle de redirection ouverte par cette story même |
| 12-08-2026 | Revue soldée : 20 constats traités, 2 décisions rendues par délégation. Le contrôle de rôle quitte `middleware.ts` — une seule couche autorise désormais, sur une seule source. 3 tests ajoutés, 4 reports consignés |
| 12-08-2026 | Les 3 nouveaux tests rougissent sur un produit correct : sonde posée dans la garde, cause trouvée — un refus sur page diffusée en flux arrive en `200` + navigation client. Tests réécrits sur `waitForURL` et sur le contenu. Leçon versée à `project-context.md` |
| 12-08-2026 | Absence de boucle prouvée PAR MUTATION : contrôle de rôle rétabli dans `middleware.ts` → le test expire en rebondissant entre `/admin` et `/agency`. Rétabli |
| 12-08-2026 | `tests/regression.spec.ts` : l'activation d'agence attendait `networkidle` et poursuivait pendant la Server Action. Corrigé. **99/99 verts**, `tsc` et `lint` propres. Story `done` |
