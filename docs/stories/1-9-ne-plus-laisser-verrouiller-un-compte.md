---
baseline_commit: add31c57b252a46605021c97e1657df89e185f10
---

# Story 1.9: Ne plus laisser un tiers verrouiller un compte

Status: done

## Story

As a directeur d'agence,
I want que des tentatives de connexion ratées ne me ferment pas mon propre compte,
so that quelqu'un qui connaît mon adresse ne puisse pas me mettre dehors de mon outil de travail.

**Couvre :** `REP-37` (🔴), `REP-38`, `REP-39`, `REP-40`

> `REP-34` figurait ici et dans `docs/epics.md` comme couvert par cette
> story. **Il ne l'est pas**, et la story l'écrit depuis sa première
> rédaction (« Ce que cette story ne fait pas »). La contradiction a été
> relevée à la clôture : la fermer en l'état aurait rendu `REP-34`
> orphelin — le défaut de traçabilité que `CLAUDE.md` §1 existe pour
> empêcher. Il est transféré à la **story 5.10**, ouverte pour lui.

## Ce que cette story doit vraiment faire

Le compteur par compte est consommé **avant** que le mot de passe soit
vérifié, et il n'est effacé qu'en cas de **succès** — succès que la limite
elle-même empêche d'atteindre.

```
auth.ts:66-79     rateLimit(`login:compte:${email}`)   ← consommé ici
auth.ts:93        compare(password, user.password)     ← vérifié après
auth.ts:123       resetRateLimit(...)                  ← effacé seulement si tout a réussi
```

Un tiers qui connaît une adresse enchaîne donc dix mots de passe faux et le
titulaire ne peut plus entrer. **Les adresses des directeurs d'agence sont
publiées sur les vitrines** (`/vitrine/[slug]`) : la cible est publique.

### Les trois portes se ferment, pas une seule

C'est ce que le constat d'origine ne disait pas, et c'est ce qui fait la
gravité. Relevé dans le code le 12-08-2026 :

| Chemin | Clé | Seuil | Fichier |
|---|---|---|---|
| Connexion | `login:compte:{email}` | **10 / 15 min** | `auth.ts:69` |
| Explication du refus | `explication:compte:{email}` | **10 / 15 min** | `app/auth/login/actions.ts:41` |
| Mot de passe oublié | `oubli:compte:{email}` | **5 / heure** | `app/auth/forgot/actions.ts:56` |

Vingt-cinq requêtes par quart d'heure suffisent à fermer **les trois**. La
victime ne peut ni entrer, ni savoir pourquoi, ni demander un nouveau mot de
passe. Pour l'agence, l'outil est simplement mort — et rien ne dit que
c'est une attaque.

### Ce que ce n'est pas

Ce n'est pas une fuite de données, ni un contournement d'authentification.
C'est un **déni d'accès**, et il est trivial : aucune information secrète
n'est requise, seulement une adresse email affichée publiquement.

## Ce que je tranche, et pourquoi

**1. Le compteur par compte cesse de garder la PORTE, il garde la RÉPONSE.**
Le remède est connu et il tient en une inversion : ne compter que les échecs
**constatés après** vérification du mot de passe. Un mot de passe correct
passe alors toujours, quel que soit l'état du compteur — c'est exactement la
propriété qui manque. Un mot de passe faux, lui, alimente le compteur, qui
continue de freiner l'essai systématique.

**2. Le compteur par ADRESSE reste, lui, en amont.** Il doit rester avant
bcrypt, sinon la vérification devient une amplification : un attaquant
paierait une requête et le serveur paierait un bcrypt à coût 12. Soixante
par quart d'heure et par adresse (`LOGIN_LIMIT_PER_IP`), c'est le seuil
existant et il est bon — large parce qu'une agence entière sort par une
seule IP publique.

Autrement dit : **par adresse on protège le serveur, par compte on protège
le compte — et seul le premier a le droit de refuser avant de vérifier.**

**3. Verrouiller et ralentir ne sont pas la même mesure.** Après N échecs
constatés sur un compte, la bonne réponse est un **délai**, pas une porte
close : le titulaire finit toujours par entrer, l'attaquant paie le temps.
Un verrou dur reste possible à un seuil beaucoup plus haut, mais il ne doit
jamais être atteignable par le seul fait qu'un tiers essaie.

**4. `oubli:compte:` GARDE son compteur, et ce n'est pas une contradiction.**
Il protège une boîte mail contre l'inondation — une ressource qui appartient
à un tiers, pas au produit. Ce qui le rendait nuisible, c'est qu'il était la
**dernière** porte : une fois la connexion réparée, en fermer l'accès une
heure n'est plus un déni d'accès, c'est un délai sur un chemin de secours
dont on n'a plus besoin.

**5. `.some()` doit disparaître des deux appels.** `REP-39` :
`.some()` s'arrête au premier `true`, donc le second `rateLimit` n'est
jamais appelé quand le premier sature. Les budgets ne sont pas indépendants,
contrairement à ce que le commentaire affirme. `auth.ts` a la même faute sous
une autre forme — un `for` qui `return null` au premier refus. **Consommer
les deux compteurs, puis décider.**

**6. `REP-34` n'est PAS dans cette story, et il faut l'écrire.** Compter par
adresse ne répond pas à celui qui en possède réellement plusieurs — botnet,
CGNAT, proxys résidentiels. Il y faut une épreuve dont le coût est porté par
l'appelant (captcha, preuve de travail) ou un signal de réputation. C'est
une autre story ; la nommer ici évite de croire que celle-ci la couvre.

## Acceptance Criteria

1. **Given** un tiers qui connaît l'adresse d'un compte — **When** il
   enchaîne des mots de passe faux, autant qu'il veut — **Then** le
   titulaire peut toujours se connecter avec le **bon** mot de passe —
   **And** la preuve est faite **par le chemin réel**, pas en appelant
   `rateLimit()` directement.

2. **Given** le compteur par compte — **When** une tentative est faite —
   **Then** il n'est alimenté **que** par un échec constaté **après**
   vérification du mot de passe — **And** le compteur par **adresse** reste
   consommé **avant** toute vérification, pour que bcrypt ne devienne pas
   une amplification.

3. **Given** les trois portes d'un compte (connexion, explication, oubli) —
   **When** un tiers sature ce qu'il peut saturer — **Then** au moins un
   chemin reste ouvert au titulaire légitime — **And** lequel, et pourquoi,
   est écrit dans le code.

4. **Given** la fenêtre fixe autorise vingt essais là où le seuil en annonce
   dix (`REP-38`) — **When** la story est terminée — **Then** le comptage ne
   laisse plus passer le double à sa frontière — **And** le coût du choix
   (fenêtre glissante, seau à jetons) est écrit.

5. **Given** `.some()` court-circuite le second compteur (`REP-39`), dans
   `app/auth/login/actions.ts:42`, `app/auth/forgot/actions.ts:57` et sous
   une autre forme dans `auth.ts:72-80` — **When** la story est terminée —
   **Then** les deux compteurs sont consommés à chaque tentative, et la
   décision vient après.

6. **Given** rien n'échappe les segments d'une clé de compteur (`REP-40`) —
   **When** la story est terminée — **Then** une clé construite sur une
   valeur libre ne peut plus entrer en collision avec une autre — **And**
   l'invariant est éprouvé, pas seulement affirmé.

7. **Given** `REP-34` — la rotation d'adresses réellement possédées — reste
   hors de portée d'un comptage par adresse — **When** la story est terminée
   — **Then** c'est écrit dans `lib/rate-limit.ts`, pour que personne ne
   croie le cas couvert.

## Tasks / Subtasks

- [x] **1. Phase rouge** (AC 1)
  - [x] Un test qui verrouille un compte par le chemin réel, puis constate que le titulaire ne passe plus
  - [x] Constater le rouge AVANT toute correction
- [x] **2. Inverser l'ordre sur le compteur par compte** (AC 1, 2)
  - [x] `auth.ts` — compteur par adresse avant bcrypt, compteur par compte après l'échec constaté
  - [x] `app/auth/login/actions.ts` — même inversion sur `explication:compte:`
  - [x] Vérifier qu'un mot de passe correct passe quel que soit l'état du compteur par compte
- [x] **3. Rendre les budgets indépendants** (AC 5)
  - [x] Retirer `.some()` dans les deux Server Actions, et le `for`/`return` d'`auth.ts`
  - [x] Corriger le commentaire qui affirme l'indépendance
- [x] **4. Fermer la frontière de fenêtre** (AC 4)
  - [x] Fenêtre glissante ou seau à jetons dans `lib/rate-limit.ts`
  - [x] Écrire ce que le choix coûte
- [x] **5. Échapper les segments de clé** (AC 6)
  - [x] Un séparateur qui ne peut pas apparaître dans un segment, ou un encodage
  - [x] Un test sur le produit croisé des préfixes et de valeurs hostiles
- [x] **6. Documenter ce qui reste ouvert** (AC 3, 7)
  - [x] `REP-34` nommé dans `lib/rate-limit.ts`
  - [x] Quel chemin reste ouvert au titulaire, et pourquoi
  - [x] `REP-37`, `34`, `38`, `39`, `40` marqués dans `deferred-work.md` ; `sprint-status.yaml` à jour

## Dev Notes

### L'état exact du code avant modification

**`auth.ts:66-80`** — les deux compteurs sont consommés dans une boucle qui
`return null` au premier refus. Conséquences : (a) le compteur par compte
est consommé avant bcrypt, (b) quand l'adresse sature, le compte n'est pas
consommé — les budgets ne sont donc pas indépendants.

**`auth.ts:123`** — `resetRateLimit('login:compte:' + email)` n'est atteint
qu'après *toutes* les vérifications. Le compteur par **adresse** n'est
volontairement pas effacé, et **il faut garder cette décision** : elle a été
prise en story 1.4 contre la pulvérisation (un essai sur beaucoup de
comptes), et le commentaire en place l'explique. Ne pas la défaire en
touchant à la ligne voisine.

**`lib/rate-limit.ts:81-131`** — fenêtre fixe assumée par le commentaire,
qui ne chiffre pas ce qu'elle coûte. `MAX_COMPTEURS = 50_000` avec refus de
création au plafond : **ne pas transformer ce refus en éviction**, ce serait
offrir à un attaquant le moyen d'effacer le compteur de sa victime — le
raisonnement est écrit sur place, le relire avant d'y toucher.

**Seuils actuels :** `LOGIN_LIMIT_PER_ACCOUNT = 10`,
`LOGIN_LIMIT_PER_IP = 60`, fenêtre 15 min (`auth.ts:31-33`).

### Pièges de ce dépôt, mesurés

- **`callerIp()` identifie un appelant DISTANT, pas un processus local.**
  Un processus sur l'hôte joint le conteneur par son adresse Docker et forge
  `X-Real-IP` (`REP-50`). Ne pas bâtir sur l'hypothèse inverse.
- **`login()` des tests pose une identité d'appelant obligatoire**
  (`tests/auth-helper.ts`). Sans elle, tous les cas tombent dans le compteur
  `inconnu` et franchissent le plafond de 60 par quart d'heure — symptôme
  déjà constaté : des `waitForURL` expirés sur des tests sans rapport.
  **Un test qui éprouve la limitation doit choisir son adresse sciemment.**
- **`tests/regression.spec.ts:1661`** connaît déjà la sémantique exacte
  (`rateLimit()` refuse à `count > limit`) : s'y référer plutôt que la
  redécouvrir.
- **Le compteur vit dans la mémoire du processus.** Entre deux cas de test,
  il ne se remet à zéro que par expiration ou par une adresse différente.
- **Ne jamais conclure d'un code HTTP** : un refus de garde arrive en `200`
  sur ce dépôt (`docs/project-context.md`). Asserter le contenu, ou l'état
  en base.

### Le contrôle positif est obligatoire

Imposé par la revue de la story 4.2, et il compte doublement ici : un test
qui vérifie qu'un compte **n'est plus verrouillable** passerait tout aussi
bien sur une limitation entièrement cassée. **Éprouver aussi que la limite
freine encore** un attaquant qui essaie des mots de passe faux — sinon la
story remplace un déni d'accès par une absence de protection.

### Ce que cette story ne fait pas

- Elle ne traite pas `REP-34` (rotation d'adresses réellement possédées) —
  story à écrire.
- Elle ne partage pas les compteurs entre instances — c'est `BUG-18`,
  story 5.6.
- Elle ne touche pas à `lib/env.ts` ni à l'identification de l'appelant :
  la story 1.4 les a traités et ils tiennent.

### References

- [Source: docs/stories/deferred-work.md] — `REP-34` à `REP-42`, dont le constat d'origine de `REP-37`
- [Source: docs/epics.md#Story-1.9] — les cinq critères du plan
- [Source: docs/stories/1-4-identifier-l-appelant.md] — pourquoi le compteur par adresse n'est pas effacé au succès
- [Source: lib/rate-limit.ts] — la sémantique du compteur, le plafond, et le raisonnement sur l'éviction

## Dev Agent Record

### Context Reference

`auth.ts`, `lib/rate-limit.ts`, `app/auth/login/actions.ts`,
`app/auth/forgot/actions.ts`, `tests/auth-helper.ts`,
`tests/regression.spec.ts`.

### Debug Log

**Phase rouge — le verrouillage reproduit sur l'instance.** Onze requêtes
sur `/api/auth/callback/credentials`, depuis une adresse d'attaquant, avec
onze mots de passe faux. La victime tente ensuite sa connexion, depuis une
**autre** adresse, avec le **bon** mot de passe :

```
TimeoutError: page.waitForURL: Timeout 90000ms exceeded
```

Elle n'entre plus. Le coût de l'attaque : onze requêtes et une adresse email
publiée sur une vitrine.

**Mon contrôle positif était faux, et il exigeait le défaut.** Première
version : « après le seuil, le serveur doit répondre en moins de 50 ms »,
c'est-à-dire *cesser de vérifier*. Or ne plus vérifier, c'est refuser un mot
de passe correct — donc verrouiller. Le contrôle demandait exactement ce que
la story doit supprimer. Réécrit sur la bonne propriété : **après le seuil,
un essai raté doit être plus LENT**, pas refusé. L'attaquant paie le temps,
le titulaire passe toujours.

**Ce qui est en place :**

| | |
|---|---|
| par **adresse** | consommé en amont, avant bcrypt — protège le serveur de l'amplification |
| par **compte** | consommé **après** l'échec constaté ; au-delà du seuil, un délai d'une seconde sur la réponse d'échec |
| mot de passe correct | passe **toujours**, quel que soit l'état du compteur, et remet le compteur à zéro |

### Tâche 4 — la frontière de fenêtre, et une conclusion que j'avais écrite à tort

**J'avais d'abord conclu que cette frontière n'était pas éprouvable.** Le
raisonnement : les fenêtres font quinze minutes à une heure, il n'y a pas de
runner unitaire, et `rateLimit()` vit dans le processus serveur qu'un test
Playwright ne peut pas appeler.

**Il était faux, et sur son point le plus simple.** `tests/regression.spec.ts`
importe déjà `emailLayout`, `toCsv` et `typeReconnu` directement depuis
`lib/` : le dépôt éprouve ses fonctions pures ainsi depuis toujours. Et
surtout, `windowMs` est un **paramètre** — la frontière d'une fenêtre de
trois cents millisecondes se franchit en trois cents millisecondes. J'avais
supposé que le seul chemin passait par le serveur, et j'avais classé le
constat sur cette supposition.

**Phase rouge, sur l'ancien code :**

```
Error: la frontière de fenêtre laisse passer 10 essais
       là où le seuil en annonce 5
```

Le double exact, comme `REP-38` l'annonçait.

**Ce qui est posé : une fenêtre glissante à deux compteurs.** La fenêtre qui
s'achève est conservée et pondérée par la part d'elle-même qui chevauche
encore la fenêtre courante. À la bascule elle compte pour presque tout ; une
fenêtre plus tard, pour rien.

**Ce que ce choix coûte**, écrit dans `lib/rate-limit.ts` : deux nombres par
compteur au lieu d'un, une entrée conservée une fenêtre de plus, et une
**approximation** — on suppose les essais de la fenêtre précédente répartis
uniformément. Un attaquant qui les concentre juste avant la bascule est
légèrement surestimé, juste après légèrement sous-estimé ; l'écart est borné
par le seuil, là où la fenêtre fixe le **doublait**. La solution exacte —
garder l'horodatage de chaque essai — coûte une liste par compteur et un
parcours par appel : trop cher pour ce qu'elle ajoute.

**La compatibilité est préservée** : `precedent` valant zéro sur une clé
neuve, le comportement est identique à l'ancien — `limit` essais passent, le
suivant est refusé. C'est ce que vérifiaient déjà les tests existants.

**Un troisième cas a été ajouté** pour une propriété que la fenêtre
glissante aurait pu casser : le compteur doit **repartir** une fois la
fenêtre précédente entièrement sortie, sans quoi la limitation deviendrait
un bannissement définitif au lieu d'un frein.

### Completion Notes

Le compteur par compte ne garde plus la porte, il garde la réponse. Un mot
de passe correct passe toujours ; un mot de passe faux alimente le compteur,
et au-delà du seuil la réponse d'échec est retardée d'une seconde. Le
compteur par adresse reste en amont — c'est le seul qui a le droit de
refuser avant d'avoir vérifié, parce que c'est le serveur qu'il protège.

Les trois portes ont été traitées : la connexion (`auth.ts`) et
l'explication du refus (`login/actions.ts`) sont inversées de la même façon.
`oubli:compte:` **garde** son compteur — il protège une boîte mail, pas le
produit — et ce choix est écrit sur place.

`.some()` a disparu des deux Server Actions : les deux compteurs sont
consommés, puis la décision est prise. Les clés passent par
`cleDeCompteur()`, qui échappe leurs segments.

La fenêtre est désormais **glissante** : la frontière ne laisse plus passer
le double du seuil, et le comptage repart quand la fenêtre précédente est
sortie. Le produit croisé des préfixes et de valeurs hostiles est éprouvé —
quarante couples, aucune collision.

**Quatre des cinq constats sont traités** : `REP-37` (le verrouillage),
`REP-38` (la frontière), `REP-39` (`.some()`), `REP-40` (les clés). Le
cinquième, `REP-34`, est **explicitement hors périmètre** et renvoyé à une
story à écrire : compter par adresse ne freine que celui qui n'en possède
qu'une. *(La première rédaction annonçait « les cinq constats sont fermés »
puis en nommait quatre — relevé en revue.)*

### File List

**Créés**
- `tests/verrouillage.spec.ts` — le verrouillage éprouvé par le chemin réel de NextAuth, plus le contrôle positif sur le délai
- `tests/limitation.spec.ts` — la frontière de fenêtre, la reprise du compteur, et le produit croisé des clés

**Modifiés**
- `auth.ts` — compteur par adresse en amont, compteur par compte après l'échec constaté, délai progressif au-delà du seuil, sortie de refus unique
- `app/auth/login/actions.ts` — même inversion sur `explication:compte:`, `.some()` retiré
- `app/auth/forgot/actions.ts` — `.some()` retiré, les deux compteurs consommés puis la décision
- `app/api/upload/route.ts` — clé passée par `cleDeCompteur()`, commentaire de `DEPOTS_MAX` corrigé
- `app/api/auth/register/route.ts` — clé passée par `cleDeCompteur()`
- `app/vitrine/[slug]/actions.ts` — clé passée par `cleDeCompteur()`
- `lib/rate-limit.ts` — fenêtre **glissante** à deux compteurs, `cleDeCompteur()`, `retryAfter` réel, et `REP-34` nommé comme hors de portée
- `.claude/settings.json` — `find` retiré de la liste autorisée (`-exec` est une exécution arbitraire)
- `CLAUDE.md` — ce que le `deny` garantit réellement, et ce qu'il ne garantit pas
- `_bmad/custom/config.toml` — renvoi vers `CLAUDE.md`, `AGENTS.md` étant supprimé
- `docs/epics.md` — arbitrage du délai progressif reporté sur la story
- `docs/qa/bug-report.md` — BUG-31 marqué corrigé
- `docs/stories/deferred-work.md` — REP-37, 38, 39, 40 marqués fermés ; REP-34 transféré à la story 5.10
- `docs/stories/sprint-status.yaml` — statut et notes de la story
- `docs/stories/1-9-ne-plus-laisser-verrouiller-un-compte.md` — ce fichier

*Établie le 13-08-2026 par `git diff --name-only` sur les quatre commits de
la story (`1c0e725`, `b0fb705`, `cfb9745`, `4b0bab3`) : **17 fichiers**. La
première rédaction en déclarait 7, et la revue avait déjà relevé deux
omissions sans que la liste soit reprise — dix manquaient encore.*

### Review Findings

Revue adversariale du 12-08-2026, trois couches parallèles. **Les trois ont
mesuré, et les trois convergent : cette story ne doit pas passer `done`.**
Elle ferme un déni d'accès et en ouvre deux autres.

**Décision requise (1)**

- [x] [Review][Decision] **🔴 La résistance à la force brute par compte a été SUPPRIMÉE, pas déplacée.** Le délai d'une seconde n'est pas sérialisé : cent requêtes concurrentes attendent une seconde **ensemble**. Le débit d'un attaquant qui parallélise est donc inchangé, et le mur dur de 10 essais / 15 min / compte a disparu. Mesuré par la revue : de **960 essais par jour et par compte** à **5 760 par jour depuis une seule adresse**, sans borne au-delà (`REP-34` étant hors périmètre). Mon commentaire « l'attaquant voit son débit s'effondrer » (`auth.ts:38-40`) est une affirmation que le code ne tient pas, et le contrôle positif ne mesure qu'une latence **séquentielle** — il ne peut pas distinguer un frein réel d'une latence sans effet. **Le fond du problème est structurel** : on ne peut pas à la fois refuser des essais faux par compte et garantir qu'un mot de passe correct passe, sans une épreuve dont le coût est porté par l'appelant. Trois issues — un délai **progressif** (1 s, 2 s, 4 s…, plafonné), un verrou dur à un seuil beaucoup plus haut que ce qu'un tiers peut atteindre, ou assumer que la borne est le compteur par adresse et l'écrire. [`auth.ts:36-66`]

**À corriger (13)**

- [x] [Review][Patch] **🔴 Ma fenêtre glissante se ré-ancre sur l'appel, pas sur la frontière réelle** — au basculement, `resetAt = now + windowMs` et `precedent` reçoit le **poids plein**, quel que soit le temps réellement écoulé. Le poids ne décroît donc pas. Mesuré par deux couches indépendamment : dépôt de 40 photos, retour à `expiration + 598 s` → **3 acceptées sur 45** ; à `+602 s` → **40 sur 45**. Une falaise de quatre secondes, facteur treize. Et sur `oubli:compte`, le titulaire est refusé jusqu'à **1,99 fenêtre** là où l'ancienne fenêtre fixe rouvrait à 1 h : **le correctif ALLONGE le déni d'accès** sur le chemin de secours dont la story justifie précisément la fermeture « une heure ». [`lib/rate-limit.ts:124-137`]
- [x] [Review][Patch] **🔴 Oracle de mot de passe sur les comptes désactivés et les agences suspendues** — nouvel ordre : `compare()` puis `if (!user || !motDePasseValide)` puis `if (!user.isActive)`. Un compte désactivé avec le **bon** mot de passe sort par la seconde branche : ni compteur, ni délai. Au-delà du seuil, l'attaquant distingue donc à la milliseconde — mauvais mot de passe ≈ 1000 ms, **bon** mot de passe immédiat. Le mot de passe d'un compte révoqué devient **confirmable**, et la story 1.8 vient précisément de peupler cet état. Avant ce diff, le court-circuit avait lieu **avant** bcrypt : le canal n'existait pas. [`auth.ts:141-152`]
- [x] [Review][Patch] **AC 5 est coché et n'est pas tenu.** Le `for`/`return` d'`auth.ts` a été remplacé par un `if`/`return` au même endroit, et `login/actions.ts` garde le sien : quand l'adresse sature, le compteur par compte n'est pas consommé. Seul `forgot/actions.ts` a été corrigé. Les Completion Notes affirment pourtant « les deux compteurs sont consommés » et `deferred-work.md` marque `REP-39` fermé. [`auth.ts:107-116`, `app/auth/login/actions.ts:43-47`]
- [x] [Review][Patch] **`REP-40` est déclaré fermé alors que trois des six sites d'appel concatènent encore à la main** — `inscription:${ip}`, `depot:${guard.agencyId}`, `vitrine:${ip}`. Le constat nomme littéralement `'lead:' + agencyId` comme la forme dangereuse, et c'est celle laissée en place. `rateLimit()` accepte toujours une `key` brute : l'invariant n'est pas **posé**, il est **espéré**. [`app/api/upload/route.ts:63`, `app/api/auth/register/route.ts:57`, `app/vitrine/[slug]/actions.ts:35`]
- [x] [Review][Patch] **Un hachage malformé fait rejeter `compare()` sans que rien ne l'attrape** — le garde `user?.password ? … : false` ne couvre que `null` et `""`. Un `$2b$` tronqué rend `false`, mais une version de sel inconnue **lève**, et l'exception traverse `authorize()` → 500 au lieu d'un refus propre, sans passer par `penaliserEchec`. [`auth.ts:138-140`]
- [x] [Review][Patch] **Quatre commentaires porteurs décrivent l'inverse du code**, dont le docstring de la fonction qu'on vient de rendre glissante (« *La fenetre est fixe* »), celui qui surplombe les constantes d'auth (« *C'est la limite qui protege reellement* » — la propriété que ce diff supprime), et `app/api/upload/route.ts:38` qui justifie `DEPOTS_MAX = 40` sur une propriété devenue fausse. [`lib/rate-limit.ts:104-107`, `auth.ts:15-18`, `app/api/upload/route.ts:38-41`]
- [x] [Review][Patch] **Le test de frontière est flaky par construction et accuserait un faux coupable** — 20 ms de marge sur 300 ms, avec quatre travailleurs qui pilotent des navigateurs. Au-delà de 600 ms, `precedent` passe à 0, le total redevient 10, et le message affiché sera « *la frontière laisse passer 10 essais* » : une régression qui n'existe pas. [`tests/limitation.spec.ts:59`]
- [x] [Review][Patch] **L'assertion de frontière tolère 180 % du budget** — `toBeLessThan(limite * 2)` passe à 9 pour un seuil de 5. Une fenêtre glissante ne pondérant qu'à 20 % serait verte. [`tests/limitation.spec.ts:56`]
- [x] [Review][Patch] **Le test « le compteur repart » est posé à côté du trou** — il attend `2 × fenêtre`, c'est-à-dire le seul cas où `precedent` est mis à zéro. La zone cassée (0 < écart < fenêtre) n'est **jamais** franchie. [`tests/limitation.spec.ts:63-90`]
- [x] [Review][Patch] **Le message d'échec du test central est inatteignable** — `login()` lève `TimeoutError` avant l'assertion ; le message rédigé ne s'affichera jamais, et le Debug Log cite d'ailleurs le timeout nu. [`tests/verrouillage.spec.ts:100-108`]
- [x] [Review][Patch] **Les deux nouveaux tests nettoient par `finally`**, que `CLAUDE.md` §6 interdit nommément — et ils créent un `agency_admin` actif dont le mot de passe est en clair dans le fichier. [`tests/verrouillage.spec.ts:97,156`]
- [x] [Review][Patch] **`retryAfter` annonce une fenêtre entière alors que l'appel suivant passerait** — mesuré à 3600 s à 1,99 fenêtre. Cette valeur part en en-tête `Retry-After` et en texte utilisateur. [`lib/rate-limit.ts:194-199`]
- [x] [Review][Patch] **Trois affirmations fausses dans les documents de la story** : la File List dit « REP-38 laissé ouvert » quand le fichier dit « fermé » ; « les cinq constats sont fermés » en nomme quatre ; et la File List omet `sprint-status.yaml` et le fichier de story lui-même. [story, `deferred-work.md`]

**Traité immédiatement (2) — des garde-fous annoncés qui n'existaient pas**

- [x] [Review][Patch] **`.claude/settings.json` autorisait `grep` et `find` tout en prétendant refuser `.env`** — `find -exec` est une exécution arbitraire déguisée en lecture. `find` est retiré, et `CLAUDE.md` dit désormais **exactement** ce que le `deny` garantit : il bloque l'outil `Read`, il ne peut pas empêcher une commande shell de lire un fichier. La vraie protection reste `.gitignore`.
- [x] [Review][Patch] **`_bmad/custom/config.toml` chargeait encore `AGENTS.md`, supprimé** — c'est une **configuration vivante**, lue par chaque agent BMAD, pas une archive : chaque agent lancé recevait une instruction pointant un fichier absent. Redirigée vers `CLAUDE.md`. Mon affirmation que « seuls des documents datés le citent encore » était fausse.

**Résolution de la revue — 13-08-2026**

Les 13 correctifs sont appliqués, la décision rendue, et **deux régressions
que j'avais introduites sont fermées et prouvées par mutation.**

**L'arbitrage, et l'endroit où ma propre recommandation était fausse.**
J'avais proposé « verrou dur à seuil très haut + borne assumée ». En
l'implémentant, le verrou s'effondre : un tiers dispose de 60 essais par
quart d'heure et par adresse, soit **240 par heure** — n'importe quel
plafond par compte est donc à sa portée, et le verrouillage redeviendrait
exactement ce que cette story ferme. Retenu à la place : **délai progressif**
(1 s, 2 s, 4 s… plafonné à 30 s, jamais appliqué à un mot de passe correct)
**et la borne réelle écrite noir sur blanc** — ce délai ne borne pas le
débit, aucune latence ne le fait face à qui n'attend pas ses réponses, la
seule borne est le compteur par adresse, et elle ne vaut que contre un
appelant qui n'en possède qu'une. Le reste est `REP-34`.

| Mutation | Résultat |
|---|---|
| ré-ancrage de la fenêtre sur l'appel | 🔴 « un retour tardif est refusé : le poids de la fenêtre précédente ne décroît pas avec le temps » |

**Ce qui est corrigé.** La fenêtre avance par fenêtres **entières depuis
l'ancienne frontière**, et le chevauchement est borné à `[0,1]` — ce qui
ferme aussi l'horloge qui recule et deux appelants passant des fenêtres
différentes sur une même clé. **Tout refus emprunte la même sortie**,
compte désactivé et agence suspendue compris : l'oracle qui rendait
confirmable le mot de passe d'un compte révoqué est fermé. Un hachage
malformé ne lève plus un 500. Les **six** sites d'appel passent par
`cleDeCompteur()`. Les deux compteurs sont consommés puis la décision vient
après, dans `auth.ts` **et** `login/actions.ts`. Quatre commentaires devenus
faux sont corrigés, dont celui qui affirmait « la fenêtre est fixe » sur la
fonction qu'on venait de rendre glissante, et celui qui présentait le
compteur par compte comme « la limite qui protège réellement ».

**Les tests.** Le cas de frontière **mesure l'écoulé** au lieu de le
supposer — vingt millisecondes de marge en faisaient un test qui accusait le
produit d'une régression inexistante — et son assertion passe de « pas
exactement le double » à `≤ seuil + 1`. Un cas nouveau franchit la zone où
vivait le défaut d'ancrage, que les deux autres évitaient. Le nettoyage
passe par `afterEach`. Le message d'échec du cas central est devenu
atteignable : `login()` levait avant l'assertion.

**Ce que la revue a appris.** Trois couches, trois mesures, et le même
enseignement que les deux revues précédentes : **j'ai fermé un déni d'accès
en en ouvrant deux autres**, dont une régression de sécurité. `CLAUDE.md` §8
pose la question — « qu'est-ce que je viens de rendre atteignable ? » — et
je l'avais écrite entre-temps sans me l'appliquer.

**Constat de procédure (1)

- [x] [Review][Patch] **Le remplacement d'`AGENTS.md` par `CLAUDE.md` a été livré hors story** — quatre commits, 411 lignes de gouvernance, une suppression, un fichier d'autorisations, quatre documents réécrits. Aucune story n'en est propriétaire, ce que `CLAUDE.md` §1 interdit — règle écrite dans ces commits mêmes. Trois fautes de `sed` subsistent (« d'`CLAUDE.md` »).
  - **Reprise à la clôture, 13-08-2026.** Cette case était cochée alors
    qu'une des trois fautes vivait encore, dans `sprint-status.yaml:271` —
    recompté par `grep -rn "d'CLAUDE.md"`, qui renvoyait une occurrence.
    Corrigée. La livraison hors story, elle, ne se rattrape pas : elle
    reste consignée ici, et c'est la rétrospective de l'épopée 1 qui doit
    la regarder, pas cette story.

### Change Log

- 13-08-2026 — **story passée `done`**, après contrôle de la définition de
  « terminé ». Trois écarts trouvés au moment de clore, et fermés :
  la **File List** déclarait 7 fichiers sur 17 ; une des trois fautes de
  `sed` déclarées « subsistantes » vivait encore sous une case cochée
  (`sprint-status.yaml:271`) ; et **`REP-34` allait devenir orphelin**, la
  story le refusant pendant qu'`epics.md` le lui assignait — transféré à la
  story 5.10, ouverte pour lui. Contrôles : `npx tsc --noEmit` 0 erreur,
  `npm run lint` 0 erreur, suite Playwright **112/112 verte**. La suite n'a
  pas été relancée à la clôture : l'exécution enregistrée
  (`test-results/.last-run.json`, `passed`, 13-08 13:30:27) porte
  exactement le code de `HEAD` — aucun fichier de `app/`, `lib/`, `auth.ts`
  ni `tests/` n'est postérieur à cet horodatage, et l'arbre est propre.
- 12-08-2026 — tâche 4 faite : fenêtre glissante, phase rouge à l'appui (« 10 essais là où le seuil en annonce 5 »). **La conclusion « pas éprouvable » de la veille était fausse** — le dépôt teste ses fonctions pures directement, et `windowMs` est un paramètre.
- 12-08-2026 — verrouillage reproduit sur l'instance (le titulaire ne passe plus), puis fermé : le compteur par compte ne garde plus la porte. Tâches 1, 2, 3 et 5 faites ; **tâche 4 non faite et écrite comme telle**.
- 12-08-2026 — story créée à partir de `REP-37`, relevé le 10-08-2026 par la revue de la story 1.4 et resté sans propriétaire jusqu'à la mise en place de la traçabilité. Portée élargie en lisant le code : **les trois portes d'un compte se ferment**, pas seulement la connexion.
