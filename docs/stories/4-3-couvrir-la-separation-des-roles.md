# Story 4.3: Couvrir la séparation des rôles

Status: done

## Story

As a administrateur d'agence,
I want qu'un agent ne puisse pas exécuter les actions qui me sont réservées,
so that la règle appliquée dans le code soit vérifiée en continu.

**Couvre :** lacune NFR-07 · **Nouveau fichier :** `tests/roles.spec.ts`

## Ce qui existe déjà, et ce qui manque

Contrairement au cloisonnement (story 4.2, angle mort total), la
séparation des rôles a **une couverture partielle**, dans
`features.spec.ts` :

- un agent reçoit 403 sur **cinq** routes de suppression, plus
  `properties` dans un autre cas — soit **six sur huit**. `clients` et
  `owners` ne sont pas couvertes ;
- un agent est renvoyé de `/agency/users` — mais **un seul** des cinq
  écrans réservés est éprouvé ;
- un administrateur crée puis désactive un compte.

Ce qui manque : les deux routes de suppression restantes, quatre écrans
réservés sur cinq, le refus de créer un `super_admin`, et l'invariant
« une agence garde un administrateur actif ».

## Trois découvertes en lisant le code, et elles changent la story

### 1. Le message de refus existe et n'est jamais affiché

`requireAgencyAdmin()` renvoie l'agent vers
`/agency?error=Action reservee a l'administrateur de l'agence`.

`app/agency/page.tsx` **ne lit pas `searchParams`** et ne rend aucun
`FormMessage`. Le message voyage donc dans la barre d'adresse et n'arrive
nulle part. Un agent qui suit un lien vers les paramètres est éjecté vers
le tableau de bord **sans un mot d'explication** — il conclura à un bogue,
pas à une permission.

L'AC dit « il est refusé, **avec le message français prévu** ». Aujourd'hui
la seconde moitié est fausse. Je l'implémente : c'est cinq lignes, et
c'est littéralement ce que la story demande. Au passage, le message perd
ses fautes — il est écrit sans accents (« reservee a ») dans un produit
qui en met partout.

### 2. Le garde « dernier administrateur actif » ne peut jamais se déclencher

`app/agency/users/page.tsx` le pose **deux fois**, dans `toggleActive` et
dans `changeRole` :

```ts
const remaining = await prisma.user.count({
  where: { agencyId, isActive: true, role: "agency_admin", id: { not: targetId } },
})
if (remaining === 0) { /* refus */ }
```

Il est inatteignable, et la démonstration tient en trois lignes :

1. l'action passe par `requireAgencyAdmin()` : **l'acteur est un
   `agency_admin` actif de cette agence** (un `super_admin` est écarté
   plus haut par `requireAgency()`, qui exige un `agencyId`) ;
2. les deux actions refusent déjà l'action sur soi-même
   (`targetId === userId`) ;
3. l'acteur satisfait donc tous les critères du `count` et n'est pas
   exclu par `id: { not: targetId }` → **`remaining` vaut au moins 1**.

**Je ne le supprime pas.** C'est un filet qui ne coûte rien et qui
redeviendrait utile le jour où le contrôle « pas soi-même » changerait.
Mais je documente qu'il dort, plutôt que de laisser croire qu'il protège.

### 3. L'invariant est gardé là où il ne peut pas être menacé, et pas là où il l'est

`app/admin/users/page.tsx` — la console de l'éditeur — désactive
**n'importe quel compte** sans aucune vérification de ce genre. Un super
admin peut donc désactiver le dernier administrateur actif d'une agence.
Cette agence n'a alors plus personne pour ouvrir un compte, toucher ses
paramètres, gérer sa vitrine, vider sa corbeille ou supprimer quoi que ce
soit — et elle ne peut pas s'en sortir seule, puisque créer un compte est
justement réservé à l'administrateur.

Le garde est donc au seul endroit où il ne peut pas servir, et absent du
seul endroit où il le pourrait.

## Ce que je tranche, et pourquoi

**J'ajoute le garde dans la console de l'éditeur.** L'AC énonce la règle
sans nommer la console ; l'appliquer là où elle est réellement
atteignable, c'est livrer l'AC, pas l'excéder.

**Objection que je me fais, et réponse.** L'éditeur doit bien pouvoir
bloquer une agence — fraude, impayé. C'est vrai, et cet outil existe
déjà : `/admin/agencies` fait passer l'agence en `suspended`, ce qui
ferme tout d'un coup et se défait pareil. Désactiver le dernier
administrateur n'est pas le moyen de suspendre une agence, c'est le moyen
de la casser sans le vouloir. Le refus renvoie donc vers le bon outil.

**Je ne touche pas au reste de la console de l'éditeur.** La
réinitialisation de mot de passe, la suspension d'agence et les autres
pouvoirs de l'éditeur restent tels quels : ce sont ses attributions.

**Le contrôle positif est obligatoire, partout.** Pour chaque refus
attendu d'un agent, l'écran ou la route est aussi demandé par un
administrateur. C'est ce que la revue de la story 4.2 m'a repris :
vingt-quatre assertions de refus passent tout aussi bien quand la route
est cassée pour tout le monde.

**Le décor d'agence est mutualisé.** `tests/tenancy.spec.ts` sait déjà
créer une agence complète et l'effacer. J'extrais cette mécanique dans
`tests/agence.ts`, en deux niveaux : nue (agence + administrateur) pour
cette story, garnie (douze entités) pour la 4.2. Une seconde copie aurait
divergé au premier changement de schéma.

## Acceptance Criteria

1. **Given** un compte `agent`
   **When** il appelle chacune des **huit** routes de suppression
   **Then** il reçoit 403 — et un administrateur reçoit 404 sur les mêmes, ce qui prouve que le refus vient du rôle et non d'une route morte

2. **Given** un compte `agent`
   **When** il demande chacun des **cinq** écrans réservés à l'administrateur
   **Then** il est renvoyé vers le tableau de bord, **et le message de refus lui est affiché**

3. **Given** un `agency_admin`
   **When** il soumet la création d'un compte avec le rôle `super_admin`
   **Then** l'opération est refusée avec « Rôle inconnu », et **aucun compte n'est créé** — vérifié en base

4. **Given** le dernier `agency_admin` actif d'une agence
   **When** l'éditeur tente de le désactiver depuis `/admin/users`
   **Then** l'opération est refusée, et le compte est toujours actif en base

5. **Given** un `agency_admin`
   **When** il tente de se désactiver ou de changer son propre rôle
   **Then** il est refusé — c'est ce contrôle-là, et non le garde « dernier administrateur », qui protège aujourd'hui l'invariant
   > **NON COUVERT, et c'est assumé.** Le contrôle vit dans une Server Action, qui ne se déclenche pas sans l'identifiant que Next injecte : il est inatteignable depuis l'extérieur. Le seul test possible n'aurait observé que l'absence d'un bouton, sous un nom promettant la règle — c'est-à-dire le défaut de BUG-28. Reporté, et la lacune vaut pour **toutes** les Server Actions du produit.

## Tasks / Subtasks

- [x] **1. `tests/agence.ts` — décor mutualisé**
  - [x] Extraire de `tenancy.spec.ts` : agence nue, agence garnie, effacement
  - [x] `tenancy.spec.ts` réécrit pour l'utiliser, suite toujours verte

- [x] **2. Afficher le message de refus** (AC 2)
  - [x] `FormMessage` sur le tableau de bord, lecture de `searchParams`
  - [x] Accents rendus au message de `requireAgencyAdmin()`

- [x] **3. Garder le dernier administrateur actif** (AC 4)
  - [x] `app/admin/users/page.tsx`, `toggleActive` : refus si la cible est le dernier `agency_admin` actif de son agence
  - [x] Message qui renvoie vers la suspension d'agence

- [x] **4. `tests/roles.spec.ts`** (tous AC)
  - [x] Huit routes de suppression : 403 pour l'agent, 404 pour l'administrateur
  - [x] Cinq écrans réservés : renvoi + message pour l'agent, accès pour l'administrateur
  - [x] Création d'un `super_admin` refusée, vérifiée en base
  - [x] Dernier administrateur : refus côté éditeur, vérifié en base
  - [ ] ~~Refus de l'action sur soi-même~~ — retiré en revue : intestable de l'extérieur, voir AC 5

- [x] **5. Vérification par mutation**
  - [x] Retirer le contrôle de rôle d'une route de suppression → le test des huit doit rougir
  - [x] Élargir `agencyUserSchema.role` à `super_admin` → le test de création doit rougir, **et sur la vérification en base**
  - [x] Retirer le nouveau garde de `/admin/users` → le test du dernier administrateur doit rougir

## Dev Notes

**Le message de refus est encodé dans l'URL.** `requireAgencyAdmin()`
fait `encodeURIComponent` ; le test doit chercher le texte **affiché**,
pas la chaîne de l'URL — sans quoi il passerait alors même que le
`FormMessage` n'a pas été posé, ce qui est justement le défaut à corriger.

**Le rôle est un `select` HTML** dans le formulaire de création. Poser
`super_admin` demande d'ajouter l'option au DOM avant de soumettre :
c'est exactement ce qu'un utilisateur peut faire depuis sa console de
navigateur, donc ce n'est pas un artifice de test.

**Un agent ne peut pas se connecter à une agence créée par le test** sans
qu'on lui ait posé un mot de passe haché : `creerAgence()` doit accepter
des comptes supplémentaires.

**Ne pas éprouver l'invariant sur l'agence de démonstration.**
`admin@aqar.dz` en est le seul administrateur actif : le désactiver
depuis la console de l'éditeur casserait la moitié de la suite. Le test
travaille sur son agence à lui.

## Dev Agent Record

### Context Reference

`docs/epics.md` (story 4.3), `lib/auth-guard.ts`, `app/agency/users/page.tsx`,
`app/agency/page.tsx`, `app/admin/users/page.tsx`, `lib/validations/index.ts`,
`auth.ts`, `tests/features.spec.ts`.

### Implementation Plan

1. `tests/agence.ts` — décor mutualisé, extrait de `tenancy.spec.ts`.
2. Message de refus affiché, et accentué.
3. Garde du dernier administrateur, dans la console de l'éditeur.
4. `tests/roles.spec.ts` — quatre cas, contrôle positif partout.
5. Mutations.

### Debug Log

**La suite est tombée à 87 cas, pour une raison qui n'avait rien à voir
avec cette story.** Deux tests sans lien entre eux — le budget de dépôt
et les exports de la voisine — ont échoué sur un `waitForURL` de
connexion expiré à 90 s. Le temps total était passé de 1,1 à 2,7 minutes.

La cause n'est pas de la flakiness : `auth.ts` limite la connexion à
**soixante tentatives par adresse et par quart d'heure**, et le harnais
n'a pas de proxy — tous les tests partagent donc le compteur
`login:ip:inconnu`. Une réussite efface le compteur du **compte**, pas
celui de l'adresse : c'est la décision de la story 1.4, et elle veut dire
que ce plafond monte quoi qu'il arrive. En passant de 80 à 87 cas, la
suite l'a franchi.

Seul le `login()` de `regression.spec.ts` posait une identité d'appelant.
La dette « trois helpers de connexion » signalée en revue de la story 4.1
et reportée est donc devenue bloquante : elle est payée ici. Un seul
`login()`, dans `tests/auth-helper.ts`, qui pose une identité propre
avant chaque connexion. La suite est revenue à 1,2 minute — le plafond
provoquait aussi de la file d'attente.

**Deux mutations cassées par la compilation, encore.** `if (false && …)`
tombe sous `no-constant-condition` ; `target.role === "jamais"` sous le
contrôle de types de TypeScript. Reformulées en expressions valides
(`!isAgencyAdmin("agency_admin")`, `role === "super_admin"`). Une
mutation qui ne compile pas ne prouve rien — troisième fois que je le
réapprends.

**Le champ de rôle m'a piégé.** `document.querySelector('[name="role"]')`
attrapait le sélecteur d'une **ligne du tableau** — il y en a un par
compte affiché, pour le changement de rôle — et non celui du formulaire
de création. Le test échouait sur un écran où rien n'avait été tenté.
`#role` vise le bon.

**Une mutation a laissé trois `super_admin` en base.** Constaté en
comptant après coup : quand le schéma accepte `super_admin`, le test
crée réellement le compte avant de constater l'échec. Supprimés, et le
test nettoie désormais **inconditionnellement**.

### Completion Notes

**89 tests passés** (85 avant, +4). Trois mutations tuées :

| Mutation | Test devenu rouge |
|---|---|
| contrôle de rôle retiré de `/api/owners/[id]/delete` | huit routes de suppression |
| `agencyUserSchema.role` élargi à `super_admin` | création de super admin — **et sur la vérification en base**, qui dit qu'un compte a bien été créé |
| garde du dernier administrateur neutralisé | dernier administrateur — et sur la relecture en base |

**Deux assertions passées en `soft` à cause des mutations.** Les deux
tests vérifiaient d'abord un message puis l'état en base, avec une
assertion **dure** sur le message : quand la mutation faisait disparaître
le message, la relecture en base — celle qui dit ce qui s'est réellement
passé — ne s'exécutait jamais. Le test rougissait pour la bonne raison
mais le disait mal.

**Nettoyage vérifié en base** après la suite complète : `0` agence de
test, `0` compte orphelin, `1` seul `super_admin`, `admin@aqar.dz` et
`agent@aqar.dz` toujours actifs.

### File List

- `tests/roles.spec.ts` *(nouveau)*
- `tests/agence.ts` *(nouveau, extrait de `tenancy.spec.ts`)*
- `tests/auth-helper.ts` *(devient le seul point de connexion)*
- `tests/regression.spec.ts`, `tests/features.spec.ts` *(copies locales supprimées)*
- `tests/tenancy.spec.ts` *(utilise le décor mutualisé)*
- `lib/auth-guard.ts`, `app/agency/page.tsx`, `app/admin/users/page.tsx`
- `docs/stories/sprint-status.yaml`

### Review Findings

**1. Un cinquième test a été écrit puis supprimé, et c'est le bon
résultat.** Il vérifiait qu'un administrateur ne peut ni se désactiver ni
changer son propre rôle. Il ne pouvait vérifier que **l'absence du
bouton** : une Server Action ne se déclenche pas sans l'identifiant que
Next injecte, donc le contrôle serveur (`targetId === userId`) est
inatteignable depuis l'extérieur. Un test qui n'observe que le bouton
caché, sous un nom qui promet la règle, est exactement le défaut de
BUG-28. Retiré, et la lacune est reportée — elle vaut pour **toutes** les
Server Actions du produit, pas seulement celle-ci.

**2. Le garde ajouté visait trop large à sa première écriture.** Il ne
regardait pas le rôle de la cible : une agence sans administrateur actif
aurait vu la désactivation d'un simple **agent** refusée avec le message
« ce compte est le dernier administrateur actif », qui est faux. `role`
ajouté au `select` et à la condition.

**3. Ce que la story n'a pas fait, et pourquoi.** Le garde « dernier
administrateur » de la console d'agence reste en place bien
qu'inatteignable. Le supprimer n'apporterait rien et le ferait disparaître
le jour où le contrôle « pas soi-même » changerait. Il est documenté comme
dormant plutôt que présenté comme protecteur.

### Change Log

- 11-08-2026 — story créée, implémentée, testée (89 verts), 3 mutations tuées.
- 11-08-2026 — dette des trois helpers de connexion payée : elle bloquait la suite.
