# Vérification au navigateur — verdicts mesurés

> **Session du 15 août 2026.** Elle éprouve les 33 constats de
> [`inventaire-ecrans.md`](inventaire-ecrans.md), qui étaient tous marqués
> `[LECTURE]`. Ce document dit lesquels **tiennent à l'écran**, lesquels
> **tombent**, et lesquels **ne peuvent pas être tranchés ici**.
>
> Il corrige aussi **deux erreurs** de l'inventaire. Elles sont signalées.

---

## 0. Comment lire ce document

Chaque constat porte un verdict, et un seul :

| Verdict | Ce qu'il veut dire |
|---|---|
| ✅ **CONFIRMÉ** | Reproduit à l'écran, **et** le code de la branche porte encore la cause |
| ❌ **INFIRMÉ** | La mesure contredit ce que j'avais écrit. L'inventaire était faux |
| ⚠️ **NON TRANCHABLE** | Mesuré, mais sur du code périmé (voir §2) — la mesure ne dit rien de la branche |
| ⬜ **NON ÉPROUVÉ** | Pas testé cette fois, et pourquoi |

**Le contrôle positif est systématique** (`CLAUDE.md` §6) : chaque refus mesuré
est accompagné d'un succès mesuré sur le même chemin. Un chemin cassé pour
tout le monde produit le même « refus » qu'un chemin correctement gardé.

---

## 1. Conditions de la mesure — et ce qu'elles valent

### L'outil n'est pas celui demandé, et voici pourquoi

**Les deux serveurs MCP navigateurs sont hors service** sur cette machine :

```
Playwright MCP      : Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome
chrome-devtools MCP : Could not find Google Chrome executable for channel 'stable'
```

Je ne les ai **pas réparés** : `CLAUDE.md` §14 en fait un arbitrage, et
installer Chrome serait une dépendance ajoutée sans accord.

**Outil réellement employé** : le Playwright **du dépôt** (1.60,
`node_modules/playwright`, chromium déjà présent). Il ne démarre rien —
l'instance tournait déjà — et il sait faire ce que §14.3 reproche au
navigateur MCP de ne pas savoir faire : **rejouer** une requête plutôt que
seulement cliquer.

### L'instance

| | |
|---|---|
| Adresse | `http://localhost:8095` (nginx de `docker-compose.prod.yml`), **déjà en marche** |
| Rien n'a été démarré | §2 n'est donc pas franchi |
| Santé | `GET /api/public/health` → `200 {"status":"ok","database":"up"}` |
| Conteneurs | `aqar-frontend-prod` 192.168.0.3, `aqar-nginx-prod` 192.168.0.2, `aqar-postgres-prod` 192.168.0.4 |

### Un contournement de test, déclaré

Le défaut §3 empêche **toute** écriture via nginx. Pour pouvoir tester le
reste, le harnais pose un en-tête côté client :

```js
extraHTTPHeaders: { "x-forwarded-host": "localhost:8095" }
```

**Ce n'est pas une correction.** Un vrai navigateur ne pose pas cet en-tête :
le défaut reste entier, et il est mesuré séparément, sans lui.

### Ce que j'ai laissé dans votre base — à nettoyer

Vos comptes de démonstration n'ont **pas** été touchés, sauf
`superadmin@aqar.dz` utilisé en lecture pour activer l'agence de test.

| Objet | Identifiant | À faire |
|---|---|---|
| Agence jetable | `Agence Test QA 059618`, **vitrine publiée** sur `/vitrine/agence-test-qa-059618` | suspendre depuis `/admin/agencies` — cela éteint aussi sa vitrine |
| Bien piège de NEW-03 | « Villa NEW-03 vente chere loyer bas », Oran | part avec l'agence |
| Compte admin | `qa059618@test-aqar.dz` | désactiver depuis `/admin/users` |
| Compte agent | `agent059618@test-aqar.dz` | **déjà désactivé** |
| 2 propriétaires, 1 client, 1 bien | dans l'agence jetable | — |
| **2 messages sur Agence Démo** | « Test Verification », tél. 0555000111 | à archiver dans `/agency/leads` — ce sont les deux preuves du §3 |

---

## 2. Avertissement qui conditionne tout le reste

**L'instance qui tourne n'est pas le code de la branche.**

```
$ docker image inspect … --format '{{.Created}}'   →  2026-08-09 12:33
$ git log --since="2026-08-09 12:33" --oneline | wc -l   →  67 commits
```

Soixante-sept commits, et **quasiment tous les écrans** ont changé depuis. La
mesure au navigateur porte donc sur une image vieille de six jours.

**Une exception capitale, et c'est ce qui sauve la session** :

```
$ docker inspect aqar-nginx-prod --format '{{range .Mounts}}…'
/home/ouazene/Dev/web/fullstack/AQAR/nginx/nginx.conf -> /etc/nginx/nginx.conf (ro)
```

`nginx.conf` est **monté en lecture directe depuis le dépôt**. La
configuration testée **est** celle de la branche — vérifié ligne à ligne,
les deux fichiers portent `proxy_set_header Host $host` aux lignes 60, 127,
139 et 152. Le constat du §3 vaut donc pour le code d'aujourd'hui.

Pour tous les autres constats, le verdict ✅ n'est donné que si **le code de
la branche porte encore la cause**, relu pour l'occasion. La mesure
corrobore ; c'est la lecture qui tranche.

---

## 3. 🔴 NEW-34 — Derrière nginx, **aucune Server Action ne fonctionne**

> **Nouveau. Absent du registre. C'est le défaut le plus grave trouvé, et il
> rend le déploiement documenté inutilisable.**

### La mesure

Une seule action, deux points d'entrée. `submitLead` est une Server Action
posée sur une page **publique** — aucune session n'intervient, donc rien
d'autre ne peut expliquer l'écart :

```
via nginx  :8095 | POST 500 | bandeau: "Une erreur est survenue"
direct     :3000 | POST 303 | bandeau: "Votre message a bien ete envoye. …"
```

### La cause, dans les journaux du conteneur

```
`x-forwarded-host` header with value `localhost` does not match `origin`
header with value `localhost:8095` from a forwarded Server Actions request.
Aborting the action.
Error: Invalid Server Actions request.
```

`nginx/nginx.conf` pose `proxy_set_header Host $host`. **`$host` ne contient
pas le port.** Next.js 14 compare l'hôte transmis (`localhost`) à l'`Origin`
du navigateur (`localhost:8095`), n'y trouve pas d'égalité, et **refuse
l'action au titre de la protection anti-CSRF**.

### Ce que cela emporte

**Tout ce qui écrit.** Les 41 Server Actions du produit :

- l'espace agence entier — créer un bien, un client, une visite, une vente,
  un bail, une quittance, un paiement, un document ;
- la console éditeur — activer une agence, poser une échéance, changer une
  formule, couper une vitrine, réinitialiser un mot de passe ;
- la corbeille — restaurer et détruire ;
- les messages reçus — changer un statut, convertir en client ;
- le formulaire public de la vitrine.

Ce qui continue de marcher : la **navigation** (pages en GET), la
**connexion** (`/api/auth/callback/credentials` est une route, pas une
Server Action), les **exports CSV**, les **PDF**, et les **suppressions par
route API**. Le produit est donc **en lecture seule, sauf pour supprimer** —
la pire combinaison possible.

### Le dégât collatéral le plus visible

`explainLoginFailure` est une Server Action. Elle est donc morte, et
**chaque échec de connexion affiche « Une erreur est survenue »** :

```
compte dont l'agence est en attente, mot de passe CORRECT
  alerte  : ["Une erreur est survenue"]
  reseau  : POST /auth/login → 500 (text/x-component)

compte inexistant
  alerte  : ["Une erreur est survenue"]
  reseau  : POST /auth/login → 500
```

Une agence qui vient de s'inscrire **n'apprendra jamais** que son dossier est
en attente d'activation. Un compte désactivé n'apprendra jamais pourquoi.
C'est précisément le mécanisme auquel `architecture.md` §5 consacre une
section entière — et il ne fonctionne pas.

### Pour vérifier vous-même

1. `http://localhost:8095/vitrine/agence-demo`, ouvrez une fiche de bien ;
2. remplissez le formulaire de contact, envoyez ;
3. vous obtenez **« Une erreur est survenue »**, et l'onglet Réseau montre un
   **POST 500**.

### La piste

`$host` → `$http_host` (qui conserve le port) sur les quatre `location`, ou
un `proxy_set_header X-Forwarded-Host $http_host;` explicite. **Cela reste
une story** (§1) : la correction doit être mesurée, et il faut se demander
ce qu'elle rend atteignable (§8).

---

## 4. 🟠 L'instance déployée a six jours de retard — et elle est vulnérable

⚠️ **NON TRANCHABLE sur la branche, mais réel sur ce qui tourne.**

### La mesure, avec contrôle positif

```
agent ACTIF        : GET /api/export/clients            → 200   ← contrôle positif
[l'administrateur désactive le compte depuis /agency/users ;
 la console affiche bien « Désactivé »]
8 secondes plus tard, URL neuve (aucun cache possible) :
agent DÉSACTIVÉ    : GET /api/export/clients?t=…        → 200   ← devrait être 401
                     GET /agency/properties?t=…         → servi ← devrait rediriger
```

**Désactiver un compte ne coupe rien sur une session déjà ouverte.** C'est
exactement **BUG-33**.

### Pourquoi ce n'est pas une régression de la branche

```
$ git log --format='%h %ad %s' --date=short -- lib/auth-guard.ts
58218c1 2026-08-15 refactor(story-5.13): sortir le predicat de role …
b4a17f8 2026-08-12 fix(story-1.8): rendre la revocation effective, …   ← le correctif
1bbbb12 2026-08-09 feat: mise a jour complete du projet Aqar DZ        ← l'image
```

Le correctif est du **12 août**, l'image du **9 août**. La branche corrige ;
le conteneur ne la contient pas.

### Ce que cela signifie quand même

**Le déploiement qui tourne en ce moment porte un défaut de sécurité fermé
depuis trois jours.** Tant qu'il n'est pas reconstruit, `docs/architecture.md`
§9 — « Révocation d'un accès : effective » — décrit la branche, pas la
réalité servie.

**Action** : reconstruire l'image avant tout autre test de sécurité.
Aucune conclusion de sécurité tirée de cette instance n'est fiable.

### Même cause, second effet

Le masquage des cinq entrées réservées dans la barre de navigation (story
5.13, **14 août**) n'est pas dans l'image : un agent y voit encore
« Vitrine ».

```
liens visibles pour un agent : ["/agency", "/agency", "/agency/showcase",
                                "/agency/properties", "/agency/clients",
                                "/agency/visits"]
```

⚠️ **NON TRANCHABLE** — la branche masque bien cette entrée. **À reprendre
après reconstruction.**

---

## 5. Tableau des verdicts

### ✅ Confirmés — reproduits, et la branche porte encore la cause

| Réf | Constat | La mesure |
|---|---|---|
| **NEW-34** | Server Actions mortes derrière nginx | `POST 500` via :8095, `303` en direct |
| **NEW-21** | La corbeille d'une liste mène à une page de JSON | voir §6 |
| **NEW-18** | 19 écrans reçoivent un message et ne l'affichent pas | 11 muets / 3 témoins qui affichent |
| **NEW-02** | Le contact de la page d'accueil est une simulation | `setTimeout(1500)`, aucune requête |
| **NEW-04** | Messages utilisateur sans accents | « Votre message a bien ete envoye » |
| **NEW-28** | Purge définitive sans confirmation | 1 ligne → 0, `dialogue: false` |
| **NEW-33** | Écrans de détail sans titre d'onglet | voir §6 — **et §7, l'inventaire était partiellement faux** |
| **NEW-32** | Wilaya : liste fermée à l'inscription, texte libre en paramètres | `SELECT` vs `INPUT` |
| **NEW-24** | Un document n'est rattachable à rien | champs : `name`, `type`, `documentUrl`, `size` |
| **NEW-31** | Journal sans aucun filtre | 0 champ de filtre |
| **NEW-16** | `toggleShowcase` n'est pas journalisé | vitrine basculée, journal muet |
| **NEW-11** | `/admin/agencies` sans pagination | **263 lignes** d'un coup |
| **NEW-12** | Aucune création de compte dans `/admin/users` | 0 bouton |
| **NEW-13** | Mot de passe éditeur en clair | `type="text"` |
| **NEW-27** | `/agency/statistics` ouvert à un agent | l'agent y reste, « Recettes nettes (12 mois) » |
| **NEW-35** | *(nouveau)* 5 selects obligatoires que le schéma remplit seul | voir §6 |
| **NEW-03** | Le budget maximum ignore le type d'opération | villa à 45 M DA rendue pour un budget de 100 k — §5 bis |
| **NEW-36** | *(nouveau)* `isAvailable` est une colonne morte | 4 lectures, 0 écriture — §5 bis |

### ❌ Infirmés — l'inventaire était faux

| Réf | Ce que j'avais écrit | Ce que la mesure dit |
|---|---|---|
| **NEW-33** *(partiel)* | « 23 pages sans titre », dont login, register, forgot, error | **Faux.** Ces 4 pages ont un titre, porté par un `layout.tsx` voisin. Le vrai compte est **19**, et le vrai constat ne vise que les écrans de détail/édition. Voir §7 |

### ⚠️ Non tranchables — mesurés sur du code périmé

| Réf | Pourquoi |
|---|---|
| **BUG-33** (révocation) | Corrigé le 12-08 ; l'image est du 09-08. §4 |
| Masquage navbar pour un agent | Story 5.13 du 14-08, absente de l'image. §4 |
| **NEW-26** (double conversion d'un lead) | Dépend de `leads/page.tsx`, modifié depuis le build |
| **NEW-22** (net à reverser calculé à 4 endroits) | Aucun bail ni quittance dans l'agence jetable ; et `lib/format.ts` a changé depuis le build |
| **BUG-29** (filtre wilaya) | **Non reproductible : le défaut est dormant.** `isAvailable` n'est jamais écrit — voir §5 bis, et le constat NEW-36 qui en découle |

### ⬜ Non éprouvés cette fois

| Sujet | Pourquoi |
|---|---|
| **BUG-06** — statut d'agence casté sans validation | Demande de **rejouer** la Server Action avec un statut forgé — et §3 les tue toutes derrière nginx. À faire après correction |
| Lighthouse | Règle 10 — non exécuté (demande un serveur MCP indisponible, §1) |
| `npm run test:e2e` | §2 : démarre le projet |

---

## 5 bis. Seconde passe — ce que j'ai éprouvé en plus

> Ajouté le 15-08-2026, même session. Tests **lisibles via nginx**, donc non
> affectés par §3.

### ✅ NEW-03 — le budget maximum ignore le type d'opération

**Confirmé, et le cas est spectaculaire.** Le filtre construit
`OR: [salePrice ≤ max, rentPrice ≤ max]` **sans le croiser** avec
`operationType`. Un bien en vente qui porte aussi un loyer sort donc d'une
recherche « à vendre » dont le budget ne couvre que le loyer.

Cas fabriqué exprès dans l'agence jetable — **villa en vente à 45 000 000 DA,
loyer indicatif 60 000 DA/mois** :

```
sans filtre                          : ["Villa NEW-03 …", "Appartement F3 …"]
?operation=vente                     : ["Villa NEW-03 …", "Appartement F3 …"]
?operation=vente&maxPrice=100000     : ["Villa NEW-03 …"]      ← 45 M DA pour 100 k DA
?operation=location&maxPrice=100000  : []                       ← contrôle positif
```

Le visiteur cherche un bien à moins de 100 000 DA et reçoit une villa à
45 millions, **prix affiché sur la carte**. Le contrôle négatif prouve que le
filtre `operation` fonctionne isolément : c'est bien le `OR` de prix qui fuit.

**À refaire** : `/vitrine/agence-test-qa-059618?operation=vente&maxPrice=100000`

### ⚠️ BUG-29 — non reproductible : le défaut est **dormant**

Le registre décrit une divergence réelle entre deux requêtes de
`app/vitrine/[slug]/page.tsx` : la liste des biens filtre sur
`status: "disponible"` **et** `isAvailable: true`, la liste des wilayas
seulement sur `status`. Une wilaya peut donc être proposée sans résultat.

**Sauf que `isAvailable` ne vaut jamais `false`.** Relevé par exécution :

```
$ grep -rn "isAvailable" app lib prisma/seed.ts
app/sitemap.ts:62                       isAvailable: true,    ← lecture
app/agency/showcase/page.tsx:36         isAvailable: true,    ← lecture
app/vitrine/[slug]/biens/[id]/page.tsx  isAvailable: true,    ← lecture
app/vitrine/[slug]/page.tsx:92          isAvailable: true,    ← lecture
prisma/schema.prisma:340                @default(true)
```

**Quatre lectures, aucune écriture.** Aucun formulaire, aucune Server Action,
aucune ligne du jeu de démonstration ne pose `false`. La condition ne peut
donc pas diverger, et BUG-29 est **inatteignable en l'état** — à requalifier
dans le registre plutôt qu'à corriger.

### 🟡 NEW-36 — *(nouveau)* `isAvailable` est une colonne morte

Le corollaire du point précédent, et c'est un **manque fonctionnel**, pas une
subtilité : la colonne existe pour retirer temporairement **un bien** de la
vitrine sans toucher à son statut métier. Elle est filtrée à quatre endroits.
**Et aucun écran ne permet de la changer.**

Une agence qui veut masquer un seul bien de sa vitrine n'a donc qu'un moyen :
changer son `status`, ce qui ment sur la réalité commerciale (un bien
« réservé » n'est pas un bien qu'on préfère ne pas exposer). Le seul autre
levier est `showcaseEnabled`, qui coupe **toute** la vitrine.

### ✅ Les 5 PDF sont valides

Générés puis vérifiés par leur signature, pas seulement par leur code HTTP :

```
property         : 200 | application/pdf | 3 990 o | %PDF ok
sale-contract    : 200 | application/pdf | 6 277 o | %PDF ok
rental-contract  : 200 | application/pdf | 6 809 o | %PDF ok
payment          : 200 | application/pdf | 3 783 o | %PDF ok
receipt          : 200 | application/pdf | 5 501 o | %PDF ok
```

*(Leur **contenu** n'a pas été relu — c'est ce que demande NEW-22 pour la
quittance, et il reste ⚠️ non tranchable.)*

### ✅ Aucune erreur console, aucun débordement en mobile

11 écrans parcourus, console vide sur tous — y compris la page d'accueil et
la vitrine publique :

```
ok /agency        ok /agency/properties   ok /agency/clients    ok /agency/visits
ok /agency/payments  ok /agency/rental-management  ok /agency/statistics
ok /agency/leads  ok /agency/documents    ok /vitrine/agence-demo   ok /
```

**Responsive à 375 px** (règle 10, contrôle du débordement horizontal) :

```
ok /                      contenu 375px / écran 375px
ok /vitrine/agence-demo   contenu 375px / écran 375px
ok /agency                contenu 375px / écran 375px
ok /agency/properties     contenu 375px / écran 375px
ok /agency/payments       contenu 375px / écran 375px
```

Les tables larges tiennent bien dans leur conteneur défilant. **Lighthouse
n'a pas été exécuté** : il passe par un serveur MCP indisponible (§1).

---

## 6. Le détail des confirmations, avec le geste exact

### NEW-21 — la page de JSON

```
HTTP        : [{"s":200,"ct":"application/json"}]
URL         : http://localhost:8095/api/properties/cmsuaablj000md12pt99jboqx/delete
corps       : {"message":"Bien mis à la corbeille"}
nav visible : false
```

**Exactement ce qui était prévu.** L'utilisateur quitte sa liste et se
retrouve sur une page blanche portant du JSON, **sans barre de navigation**.
Il doit revenir en arrière à la main.

**À refaire** : `/agency/properties`, cliquer la corbeille d'une ligne.

### NEW-18 — les écrans muets, avec témoins

Sonde : on pose `?error=SENTINELLE-DE-TEST-42` et on regarde si le texte
apparaît.

```
MUET     /agency/clients/new       MUET     /agency/owners/new
MUET     /agency/visits/new        MUET     /agency/sales/new
MUET     /agency/rentals/new       MUET     /agency/properties
MUET     /agency/clients           MUET     /agency/owners
MUET     /agency/documents         MUET     /agency/sales
MUET     /agency/rentals
AFFICHE  /agency/properties/new    AFFICHE  /agency/payments
AFFICHE  /agency/visits            ← les trois témoins
```

**Et sur le chemin réel, pas seulement la sonde** : créer un propriétaire
redirige vers `/agency/owners?success=Proprietaire%20cree` — mesuré, `303` —
et la liste **n'affiche aucun bandeau**.

> **Nuance mesurée, à connaître avant de tester.** Sur `clients/new`, le
> navigateur bloque lui-même la soumission (champs `required`), donc l'erreur
> de validation ne part jamais au serveur. Ce qui se perd en pratique, ce
> sont **les messages de succès** et les erreurs « … introuvable ».

**À refaire** : créez un propriétaire. Regardez la barre d'adresse — le
message y est. Regardez la page — il n'y est pas.

### NEW-28 — la purge

```
lignes : 1 | boutons de la 1re ligne : ["Restaurer","Détruire"]
confirmation demandee : false
lignes apres          : 0
```

Un bouton « Détruire », **aucune boîte de dialogue**, la ligne et sa
descendance disparaissent.

### NEW-33 — les titres

```
GENERIQUE /agency/properties/{id}       -> "Aqar DZ — Le logiciel des agences…"
GENERIQUE /agency/properties/{id}/edit  -> "Aqar DZ — Le logiciel des agences…"
```

Toutes les listes et tous les écrans de création ont, eux, un titre correct
(`"Biens · Aqar DZ"`, `"Nouveau bien · Aqar DZ"`, …). Les 5 écrans `/admin`
aussi.

### NEW-35 — *(nouveau)* cinq selects obligatoires que le schéma remplit seul

Mesure de validité HTML, écran par écran :

```
/agency/clients/new  : type (SELECT), status (SELECT) — « Please select an item in the list. »
/agency/visits/new   : status (SELECT)
/agency/sales/new    : status (SELECT)
/agency/rentals/new  : status (SELECT)
```

Vérifié sur **la branche** : `<Select name="type" required>` et
`<Select name="status" required>`, **sans `defaultValue`**. Or le schéma Zod
pose une valeur par défaut pour chacun (`enumWithDefault` :
`ClientType.interesse`, `ClientStatus.nouveau`, `VisitStatus.prevue`,
`SaleStatus.negociation`, `RentalStatus.active`).

**Conséquence** : l'utilisateur doit choisir une valeur que le serveur
aurait mise tout seul, et s'il l'oublie le formulaire refuse de partir. Le
contrat entre l'écran et le schéma se contredit.

*(À noter, sans en faire un défaut : les messages de validation natifs
s'affichent dans la langue du navigateur, pas dans celle du produit. Ici
« Please fill out this field. » parce que le chromium de test est en
anglais. Sur un navigateur français ils seront français.)*

### NEW-16 — la vitrine coupée sans trace

Vitrine de l'agence jetable basculée « Publiée → Masquée » depuis
`/admin/settings`, puis lecture de `/agency/audit` :

```
journal parle de vitrine : false
3 entrées — toutes des suppressions
```

### Ce qui a bien fonctionné, et qu'il est inutile de re-tester

| Contrôle | Mesure |
|---|---|
| Séparation des rôles côté API | agent → `403`, administrateur → `404` **sur le même appel** (contrôle positif) |
| Boutons de suppression masqués pour un agent | `0` formulaire `/delete` dans ses listes |
| Les 5 écrans réservés refusent un agent | les 5 renvoient sur `/agency` |
| Création de compte d'agence | `?success=Compte … créé`, **et le message s'affiche** |
| Titres des 5 écrans `/admin` | tous corrects |
| Titres des 26 listes et écrans de création | tous corrects |
| Activation d'une agence | « En attente → Active », mesuré |

---

## 7. Ce que je corrige dans l'inventaire

### NEW-33 était surestimé

J'avais compté les pages sans `export const metadata` **dans `page.tsx`
uniquement**. C'était la mauvaise mesure : quatre pages clientes portent leur
titre dans un `layout.tsx` voisin —
`app/auth/{login,register,forgot,error}/layout.tsx`, chacun commenté
« page cliente, titre porté par le layout ».

| | Avant | Après mesure |
|---|---|---|
| Pages sans titre propre | 23 | **19** |
| Dont le constat vise réellement | — | les **17 écrans de détail/édition** de `/agency` + `/auth/reset/[token]` |
| `app/page.tsx` | compté comme défaut | **n'en est pas un** : la page d'accueil doit porter le titre du site |

### NEW-02 était sous-estimé

Je l'avais classé « à confirmer ». Le code est sans ambiguïté et la mesure le
confirme : `setTimeout(1500)` puis « envoyé », **aucune requête réseau**. Ce
n'est pas un formulaire incomplet, c'est une maquette laissée en production.

---

## 8. Ce que je ferais dans cet ordre

1. **Corriger nginx** (§3). Tant que ce n'est pas fait, aucun test
   fonctionnel sérieux n'est possible sur la pile documentée, et le produit
   est en lecture seule.
2. **Reconstruire l'image** (§4). Le déploiement porte un défaut de sécurité
   fermé dans la branche depuis le 12 août.
3. **Rejouer cette session** après 1 et 2 — les quatre constats
   ⚠️ *non tranchables* redeviendront mesurables, et les conclusions de
   sécurité redeviendront fiables.
4. Puis les correctifs d'expérience, par visibilité : **NEW-21**,
   **NEW-18**, **NEW-28**, **NEW-02**, **NEW-04**.

Chacun demande un `REP-nn` dans `deferred-work.md` **et** une story (§1).
**NEW-34** en demande une à lui seul : il touche le déploiement, il change
ce qui est atteignable, et §8 veut qu'on se demande ce qu'il rend possible
une fois refermé.

---

## 9. Ce que cette session ne prouve pas

- **Elle ne coche aucune case du §9.** La couverture reste
  `npm run test:e2e`, prouvée par mutation. Un pilotage de navigateur montre
  un symptôme ; il ne remplace pas un test qui échoue quand on retire la
  garde.
- **Elle ne dit presque rien de la branche**, sauf pour `nginx.conf` (monté
  depuis le dépôt) et pour les constats dont j'ai relu le code de la branche
  après la mesure. Partout ailleurs, l'image de six jours limite la portée.
- **Le contournement `x-forwarded-host`** a permis de tester les écritures.
  Sans lui, rien de ce qui écrit n'aurait pu être éprouvé — et c'est
  exactement la situation d'un vrai utilisateur aujourd'hui.
