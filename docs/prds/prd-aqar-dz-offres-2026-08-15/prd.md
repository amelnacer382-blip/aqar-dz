---
title: Offres d'abonnement Aqar DZ
status: draft
created: 2026-08-15
updated: 2026-08-15
---

# PRD : Offres d'abonnement

## 0. Objet du document

Ce document s'adresse à l'éditeur d'Aqar DZ et aux ateliers qui viennent
après lui — `bmad-create-epics-and-stories`, puis les stories. Il décrit
**une seule chose** : ce qu'est une offre d'abonnement dans Aqar DZ, comment
une agence en obtient une, et ce qu'elle change réellement pour elle.

Il ne redit pas ce qui existe. L'inventaire des écrans est dans
[`docs/qa/inventaire-ecrans.md`](../../qa/inventaire-ecrans.md), la
topologie dans [`docs/architecture.md`](../../architecture.md), les règles
permanentes du produit dans `CLAUDE.md` §12.

**Trois arbitrages ont été rendus par l'éditeur le 15-08-2026** et
conditionnent tout le reste ; ils sont consignés dans `.memlog.md` avec leur
motif. Le vocabulaire du §3 fait loi : les FR, les parcours et les métriques
l'emploient tel quel.

## 1. Vision

Aqar DZ vend aujourd'hui trois offres sur sa page d'accueil — Starter à
2 900 DA/mois, Pro à 7 900, Enterprise à 19 900 — et n'en connaît aucune.
La base ne stocke que deux valeurs, `basic` et `premium`, qui ne portent
aucun de ces trois noms ; le formulaire d'inscription ne demande rien ; et
la valeur enregistrée **ne conditionne strictement rien** dans le produit.

*Mesure du 15-08-2026 :*
`grep -rn "premium\|basic" --include="*.ts*" app/ lib/ components/ | grep -v app/admin/settings`
→ **1 occurrence**, la valeur par défaut posée à l'inscription. Ni plafond
de biens, ni plafond d'utilisateurs, ni fonctionnalité fermée.

Cette fonctionnalité ferme cet écart. Un visiteur qui clique « Choisir Pro »
sur la page tarifaire arrive au formulaire d'inscription avec Pro déjà
sélectionné ; sa demande est enregistrée **comme une demande**, pas comme un
droit. Quand l'éditeur approuve l'agence — geste qui existe déjà et qui
reste manuel —, il voit ce qui a été demandé et **attribue** l'offre, la
même ou une autre. À partir de là, l'offre contraint : une agence Starter ne
crée pas son vingt-et-unième bien ni son troisième compte.

Ce que cela vaut : l'éditeur cesse de vendre sur parole. Le produit sait
enfin ce qu'une agence a payé, et le fait respecter sans qu'un humain ait à
surveiller.

## 2. Public visé

### 2.1 Ce que chacun cherche à faire

**L'éditeur** (`super_admin`, une poignée de personnes) :
- savoir, en ouvrant un dossier d'inscription, ce que l'agence *veut* — sans
  avoir à lui téléphoner ;
- décider ce qu'elle *obtient*, y compris différent de ce qu'elle demande —
  parce que le règlement se fait hors du logiciel et qu'il le sait, lui ;
- ne pas avoir à surveiller manuellement qu'une agence Starter n'a pas
  chargé 400 biens ;
- garder la trace de qui a attribué quoi, et quand.

**L'agence qui s'inscrit** (`agency_admin`) :
- choisir son offre au moment où elle en a envie — sur la page tarifaire,
  pas dans un écran de paramètres découvert trois semaines plus tard ;
- comprendre pourquoi un enregistrement est refusé, et quoi faire ensuite ;
- voir où elle en est de ses plafonds **avant** de buter dessus.

**L'agent** : rien. Il ne voit pas les offres, il subit les plafonds — et
doit comprendre le message quand il en rencontre un.

### 2.2 Qui n'est pas concerné en v1

- Les agences existantes déjà actives : elles sont **migrées** vers une
  offre équivalente sans rien avoir à faire (FR-14), et rien ne se ferme
  sous leurs pieds (FR-12).
- Les visiteurs de la vitrine publique : ils ne voient jamais l'offre d'une
  agence.

### 2.3 Parcours

- **UJ-1. Karim choisit Pro avant même d'avoir un compte.**
  Karim dirige une agence de sept personnes à Oran et compare deux
  logiciels. Non authentifié, il arrive sur l'accueil d'Aqar DZ, descend
  jusqu'à la section tarifaire et lit les trois colonnes. « 10
  utilisateurs » lui parle : il en a sept. Il clique **Choisir Pro**. Le
  formulaire d'inscription s'ouvre avec **Pro déjà sélectionné et visible**,
  et un rappel de ce que Pro contient. Il remplit son agence, valide.
  L'écran de confirmation lui dit que son espace existe, qu'il sera activé
  manuellement, **et que l'offre Pro a été demandée — sous réserve de
  validation**. Il repart en sachant exactement ce qu'il a demandé.
  **Cas limite :** s'il arrive sur `/auth/register` sans passer par la page
  tarifaire, aucune offre n'est présélectionnée et il doit en choisir une
  avant d'envoyer.

- **UJ-2. Bilal approuve, et tranche l'offre dans le même geste.**
  Bilal, l'éditeur, ouvre `/admin/agencies` le lundi matin. La ligne de
  l'agence de Karim porte le badge jaune « En attente » **et, à côté, la
  mention « Pro demandé »**. Bilal sait, parce qu'il a eu Karim au
  téléphone, que le règlement porte sur Starter pour trois mois d'essai. Il
  ouvre le sélecteur d'offre sur la ligne, choisit **Starter**, et clique
  ✅. L'agence passe active, l'offre attribuée est Starter, l'écart avec la
  demande est **inscrit au journal**. Karim reçoit l'email d'activation.
  **Cas limite :** si Bilal approuve sans toucher au sélecteur, l'offre
  demandée est attribuée telle quelle — le geste le plus fréquent reste un
  seul clic.

- **UJ-3. Nadia bute sur un plafond, et comprend.**
  Nadia, agent chez Karim, saisit le vingt-et-unième bien de l'agence. Elle
  remplit `/agency/properties/new` comme d'habitude et valide.
  L'enregistrement est **refusé** et l'écran affiche : « Votre offre Starter
  autorise 20 biens. Vous en avez 20. Contactez Aqar DZ pour passer à
  l'offre supérieure. » Sa saisie **n'est pas perdue** : le formulaire est
  toujours là, rempli. Elle prévient Karim, qui appelle l'éditeur.
  **Cas limite :** si l'agence a un bien à la corbeille, restaurer ce bien
  la remettrait à 20 — c'est le même plafond qui s'applique, et le même
  message (FR-11).

## 3. Glossaire

*Ces termes sont employés tels quels partout — dans ce document, dans les
epics, dans le code et dans les écrans. **Aucun synonyme.** En particulier :
on dit **offre**, jamais « formule », « plan », « forfait » ou
« abonnement » pour désigner la même chose.*

- **Offre** — un palier commercial nommé, avec un tarif mensuel affiché et
  un jeu de **plafonds**. Il en existe exactement trois : Starter, Pro,
  Enterprise. Le champ Prisma qui la porte s'appelle `plan` pour des raisons
  historiques ; **dans les écrans et les textes, c'est « offre »**.
- **Offre demandée** — l'offre que la personne a choisie au moment de
  l'inscription. Elle n'accorde **aucun** droit. Nulle si l'inscription
  précède cette fonctionnalité ou si aucune n'a été choisie.
- **Offre attribuée** — l'offre que l'éditeur a accordée à l'agence. C'est
  **elle seule** qui détermine les plafonds. Toute agence active en porte
  une.
- **Plafond** — le nombre maximum d'objets d'un type que l'**offre
  attribuée** autorise. `null` = illimité.
- **Quota** — la comparaison, à un instant donné, entre ce que l'agence
  possède et son **plafond**.
- **Décompte** — le nombre d'objets d'un type qui comptent dans le quota.
  Défini précisément par FR-9 et FR-10 ; c'est le point où l'on se trompe.
- **Statut d'agence** — `pending`, `active` ou `suspended`. **Existe déjà.**
  C'est lui, et lui seul, qui ouvre ou ferme l'accès. Il est **orthogonal**
  à l'offre attribuée.
- **Échéance d'abonnement** — la date jusqu'à laquelle l'agence a réglé
  (`subscriptionEndsAt`). **Existe déjà.** Elle **ne coupe rien** et ne
  change aucun plafond.
- **Approbation** — le passage d'une agence de `pending` à `active`,
  décidé par un `super_admin`. **Existe déjà.**

## 4. Fonctionnalités

### 4.1 Le catalogue des offres

**Description.** Les trois offres sont définies **une seule fois**, dans un
module TypeScript sans dépendance, et lues par tous ceux qui en parlent : la
section tarifaire publique, le formulaire d'inscription, la console de
l'éditeur, l'écran de paramètres de l'agence et les contrôles de quota.
C'est ce qui empêche l'écart d'aujourd'hui de revenir — une page qui promet
« 20 biens » pendant que le code n'en sait rien.

Le catalogue est **en code**, pas en base : l'éditeur a arbitré que le coût
d'une table éditable (migration, écrans de gestion, cas de l'offre supprimée
alors qu'une agence la porte) n'était pas justifié pour trois paliers qui
bougent une fois par an. Changer un tarif est donc un déploiement, et c'est
assumé.

**Exigences fonctionnelles**

#### FR-1 : une définition unique des offres

Le produit définit exactement trois **offres** dans un module unique, chacune
portant : un identifiant technique, un nom affiché, un tarif mensuel en DA,
une description courte, la liste de ses arguments de vente, et ses
**plafonds**.

**Conséquences (vérifiables) :**
- `components/landing/PricingSection.tsx` ne contient plus aucun tarif ni
  aucun nom d'offre en dur : il lit le catalogue.
- Une commande de contrôle recense les définitions d'offres et en trouve
  **une seule** : `grep -rln "2 900\|7 900\|19 900" --include="*.ts*" app/ components/ lib/` → 1 fichier.
- Le module ne dépend ni de Prisma, ni de React, ni de NextAuth : il est
  importable depuis un Server Component, une Server Action et une route API.

#### FR-2 : l'offre attribuée est une valeur fermée

Le champ qui porte l'**offre attribuée** n'accepte que les trois valeurs du
catalogue.

**Conséquences (vérifiables) :**
- `plan` devient une énumération Prisma (`starter`, `pro`, `enterprise`) au
  lieu d'un `String` libre.
- Aucune écriture ne passe par `formData.get(x) as Enum` : toute entrée
  traverse `parseForm(schema, formData)` avec un schéma Zod
  (`CLAUDE.md` §2). *Cela vise nommément
  `app/admin/settings/page.tsx:57` et `app/admin/agencies/page.tsx:100`, qui
  font aujourd'hui exactement cela.*

**Hors périmètre de ce FR :**
- La possibilité pour l'éditeur d'ajouter une quatrième offre sans
  déploiement — voir §5.

**Notes.** `[HYPOTHÈSE : les plafonds repris de la page tarifaire actuelle
sont bien ceux que vous voulez vendre — Starter 20 biens / 2 utilisateurs,
Pro illimité / 10 utilisateurs, Enterprise illimité / illimité. Ce sont les
seuls chiffres écrits quelque part aujourd'hui ; ils viennent de
`components/landing/PricingSection.tsx`. À confirmer avant l'écriture des
stories — c'est la donnée la plus structurante du lot.]`

---

### 4.2 La demande d'offre à l'inscription

**Description.** Le choix se fait au moment où le visiteur a l'offre sous
les yeux : sur la page tarifaire. Son clic le mène au formulaire
d'inscription avec l'offre **déjà sélectionnée et visible**. Ce qu'il
enregistre est une **offre demandée** — un renseignement, pas un droit.
Réalise UJ-1.

**Exigences fonctionnelles**

#### FR-3 : le bouton de la page tarifaire porte l'offre

Un visiteur qui clique le bouton d'appel d'une offre arrive sur le
formulaire d'inscription avec cette offre présélectionnée. Réalise UJ-1.

**Conséquences (vérifiables) :**
- Les trois boutons pointent vers des destinations **distinctes** (elles
  pointent aujourd'hui toutes trois vers `/auth/register` nu).
- L'offre présélectionnée correspond à la colonne cliquée, pour les trois.
- Une valeur d'offre inconnue ou absente dans l'URL n'est pas une erreur :
  le formulaire s'ouvre sans présélection.

#### FR-4 : le formulaire recueille l'offre demandée

Une personne qui s'inscrit choisit une **offre demandée** et la voit avant
d'envoyer. Réalise UJ-1.

**Conséquences (vérifiables) :**
- Le formulaire montre laquelle est sélectionnée et ce qu'elle contient —
  pas seulement son nom.
- Le choix est modifiable dans le formulaire, même quand il vient de l'URL.
- L'inscription est **refusée** si aucune offre n'est choisie, et le message
  le dit. *[HYPOTHÈSE : le choix est obligatoire. L'alternative — accepter
  une inscription sans offre demandée — laisserait un dossier muet à
  l'éditeur.]*
- L'offre demandée est enregistrée sur l'agence, distincte de l'offre
  attribuée.
- L'écran de confirmation nomme l'offre demandée **et dit qu'elle est sous
  réserve de validation**.

#### FR-5 : une offre demandée n'accorde rien

Une agence en attente ne tire aucun droit de son **offre demandée**.

**Conséquences (vérifiables) :**
- Aucun contrôle de quota ne lit l'offre demandée.
- Une agence approuvée sans que l'éditeur touche au sélecteur reçoit son
  offre demandée comme **offre attribuée** (FR-7) — c'est le seul moment où
  la demande devient un droit.
- Poster une offre demandée forgée ne change aucun plafond.

---

### 4.3 L'attribution par l'éditeur

**Description.** L'attribution se greffe sur un geste qui existe :
l'**approbation** dans `/admin/agencies`. L'éditeur voit la demande à côté
du statut et tranche dans le même mouvement. Le cas fréquent — « la demande
me va » — reste **un seul clic**. Réalise UJ-2.

**Exigences fonctionnelles**

#### FR-6 : la demande est visible là où l'on décide

Un `super_admin` voit l'**offre demandée** d'une agence sur la ligne où il
l'approuve. Réalise UJ-2.

**Conséquences (vérifiables) :**
- La ligne d'une agence `pending` affiche l'offre demandée, ou « aucune » si
  elle est nulle.
- L'offre demandée reste consultable après l'approbation, pour pouvoir
  comparer plus tard avec ce qui a été attribué.

#### FR-7 : approuver attribue une offre

Un `super_admin` attribue une **offre attribuée** en approuvant une agence.
Réalise UJ-2.

**Conséquences (vérifiables) :**
- Sans intervention sur le sélecteur, l'offre demandée est attribuée.
- Le `super_admin` peut attribuer une offre **différente** de la demande.
- Une agence ne peut pas devenir `active` sans offre attribuée.
- L'opération est journalisée par `recordAudit()` : qui, quand, quelle
  agence, offre demandée → offre attribuée.
- Un écart entre demande et attribution est **lisible dans le journal**, pas
  seulement déductible.

#### FR-8 : changer l'offre d'une agence déjà active

Un `super_admin` change l'**offre attribuée** d'une agence à tout moment.

**Conséquences (vérifiables) :**
- L'écran de changement d'offre propose les **trois** offres, pas une
  bascule entre deux. *(Aujourd'hui `/admin/settings` n'offre qu'un bouton
  qui inverse `basic` ⇄ `premium`.)*
- Le changement est journalisé, ancienne et nouvelle offre nommées.
- Rétrograder une agence **au-dessous** de son décompte actuel est **permis**
  et ne supprime rien (FR-12).
- Un `agency_admin` ne peut pas changer sa propre offre — ni par l'écran, ni
  en rejouant la Server Action.

---

### 4.4 Les quotas

**Description.** C'est ici que l'offre cesse d'être une étiquette. Au-delà
du plafond, la création est **refusée**, avec un message qui nomme l'offre,
le plafond et la suite à donner. Rien n'est supprimé, jamais. Réalise UJ-3.

Le point délicat n'est pas le refus : c'est le **décompte**. Une correction
déplace le problème avant de le fermer (`CLAUDE.md` §8), et poser un plafond
rend soudain atteignables des chemins qui ne comptaient pour rien —
restaurer depuis la corbeille, réactiver un compte désactivé. FR-11 les
traite explicitement, parce que les oublier ferait un plafond contournable
en deux clics.

**Exigences fonctionnelles**

#### FR-9 : plafond de biens

Un membre d'une agence ne crée pas de bien au-delà du plafond de son
**offre attribuée**. Réalise UJ-3.

**Conséquences (vérifiables) :**
- Le **décompte** est le nombre de biens de l'agence **non supprimés**
  (`deletedAt: null`), tous statuts confondus — un bien vendu ou loué compte
  encore, il occupe une fiche.
- Au plafond, la création est refusée et le message nomme l'offre, le
  plafond et le décompte actuel.
- La saisie n'est pas perdue : le formulaire reste rempli.
- Un plafond `null` (Pro, Enterprise) ne refuse jamais.
- Le refus est posé **dans la Server Action**, pas seulement dans l'écran :
  rejouer l'action sans passer par le formulaire donne le même refus.
  *(Mesuré : il existe **un seul** point de création de bien,
  `app/agency/properties/new/page.tsx:69`.)*

#### FR-10 : plafond d'utilisateurs

Un `agency_admin` ne crée pas de compte au-delà du plafond de son **offre
attribuée**.

**Conséquences (vérifiables) :**
- Le **décompte** est le nombre de comptes de l'agence **actifs**
  (`isActive: true`), tous rôles confondus, l'`agency_admin` lui-même
  compris.
- Au plafond, la création est refusée avec le même type de message que FR-9.
- Le refus est posé dans la Server Action.
  *(Mesuré : **deux** points de création de compte —
  `app/agency/users/page.tsx:102` et `app/api/auth/register/route.ts:117`.
  Le second crée le tout premier administrateur d'une agence neuve : il est
  hors quota par construction, mais doit être **nommé** dans la story pour
  qu'on ne le « corrige » pas par erreur.)*

#### FR-11 : les chemins qui font remonter le décompte sans créer

Restaurer un objet ou réactiver un compte est soumis au même plafond qu'une
création.

**Conséquences (vérifiables) :**
- Restaurer un bien depuis `/agency/trash` au plafond est refusé, avec le
  même message. *(C'est le chemin qui rendrait le plafond contournable :
  supprimer, créer, restaurer.)*
- Réactiver un compte désactivé au plafond d'utilisateurs est refusé.
- **Contrôle positif obligatoire** (`CLAUDE.md` §6) : sous le plafond, la
  restauration et la réactivation continuent de fonctionner. Un chemin cassé
  pour tout le monde donnerait le même « refus » qu'un plafond correctement
  posé.

#### FR-12 : aucune suppression rétroactive

Une agence dont le décompte dépasse son plafond conserve tout ce qu'elle
possède.

**Conséquences (vérifiables) :**
- Après une rétrogradation, aucun bien ni compte n'est supprimé, désactivé
  ni masqué.
- Tout reste **modifiable** : seule la création est refusée. Une agence
  au-dessus de son plafond peut encore corriger un prix, changer un statut,
  envoyer un compte à la corbeille.
- Supprimer un objet quand on dépasse ramène le décompte : c'est la sortie
  normale, et le message de refus doit la mentionner.

#### FR-13 : l'agence sait où elle en est

Un `agency_admin` voit son **quota** avant de buter dessus.

**Conséquences (vérifiables) :**
- `/agency/settings` affiche l'offre attribuée, ses plafonds et le décompte
  actuel.
- Un plafond illimité s'affiche comme tel, sans nombre inventé.
- Un dépassement (après rétrogradation) est affiché **sans être alarmiste** :
  il est légitime, rien n'est en danger.

**Exigences non fonctionnelles propres aux quotas**
- Un contrôle de quota ne charge **jamais** les objets pour les compter :
  `count()`, jamais `findMany().length` — la story 3.3 a déjà payé cette
  leçon.
- Le décompte est lu **en base au moment de l'action**, pas dans la session
  ni dans le jeton (`CLAUDE.md` §2).

---

### 4.5 La reprise de l'existant

#### FR-14 : les agences déjà en base sont migrées

Toute agence portant `basic` ou `premium` reçoit une **offre attribuée**
équivalente, sans intervention.

**Conséquences (vérifiables) :**
- `basic` → Starter, `premium` → Pro. *[HYPOTHÈSE : cette correspondance est
  la bonne. `premium` ne peut pas devenir Enterprise sans décision — c'est
  un cadeau de 12 000 DA/mois de plafonds.]*
- La migration est **réversible en lecture** : la valeur d'origine reste
  lisible dans le journal ou dans la migration, pour pouvoir arbitrer une
  agence litigieuse.
- Aucune agence ne se retrouve sans offre attribuée après la migration.
- **Aucune agence active ne perd l'accès** à cause de la migration, quel que
  soit son décompte (FR-12).

## 5. Non-objectifs explicites

- **Aucun paiement en ligne.** Ni carte, ni prélèvement, ni facture générée.
  L'encaissement se fait hors du logiciel et l'activation reste **une
  décision humaine** — c'est écrit dans `docs/project-context.md` et cette
  fonctionnalité ne le change pas.
- **L'échéance d'abonnement ne coupe toujours rien.** Un dépassement de date
  n'entraîne aucune suspension automatique, aucun changement de plafond.
  Seul le **statut d'agence** ouvre et ferme.
- **Pas de catalogue éditable.** Ajouter une quatrième offre reste un
  déploiement (arbitrage du 15-08-2026).
- **Pas de proration, pas de calendrier de facturation, pas d'historique
  d'offres.** Une agence a une offre attribuée, au présent.
- **Pas d'essai gratuit automatique** ni de rétrogradation automatique à
  l'échéance.
- **Pas de plafond sur autre chose que les biens et les comptes** en v1 —
  ni clients, ni propriétaires, ni documents, ni stockage.
- **Aucune fonctionnalité fermée par offre.** Les arguments de vente qui
  décrivent des capacités (« Vitrine personnalisée », « API access »,
  « Statistiques avancées ») **ne sont pas implémentés comme des verrous** :
  seuls les deux plafonds numériques contraignent. *Voir §8, question 2 —
  c'est le plus gros écart restant entre la promesse commerciale et le
  produit.*

## 6. Périmètre du MVP

### 6.1 Dedans

- Le catalogue en code, source unique (FR-1, FR-2).
- La demande d'offre, de la page tarifaire au formulaire (FR-3, FR-4, FR-5).
- L'attribution à l'approbation, et le changement ultérieur (FR-6, FR-7, FR-8).
- Les deux plafonds, leurs chemins détournés, et l'absence de destruction
  (FR-9 à FR-12).
- L'affichage du quota côté agence (FR-13).
- La migration de l'existant (FR-14).

### 6.2 Dehors

- Le paiement en ligne — non-objectif du produit, pas seulement du MVP.
- Le catalogue éditable en base — v2 si les tarifs se mettent à bouger.
- Les capacités verrouillées par offre — **v2, et ça mérite sa propre
  décision** : `[NOTE POUR L'ÉDITEUR]` les trois colonnes de la page
  tarifaire promettent aujourd'hui 17 arguments dont **2 seulement** seront
  tenus par ce lot. Les 15 autres restent des mots.
- La notification automatique d'une agence qui approche de son plafond.
- Les plafonds sur les autres objets.

## 7. Métriques de succès

**Principales**
- **SM-1** : **zéro écart entre ce qui est affiché et ce qui est appliqué.**
  Pour chacune des trois offres, les plafonds lus sur la page tarifaire
  égalent ceux qu'applique le produit. Vérifie FR-1, FR-9, FR-10. *Mesure :
  une assertion de test qui compare le catalogue au comportement observé,
  pas une relecture.*
- **SM-2** : **toute agence active porte une offre attribuée.** Cible :
  100 %, y compris après migration. Vérifie FR-7, FR-14.

**Secondaires**
- **SM-3** : **l'offre demandée est renseignée sur les inscriptions.**
  Cible : > 95 % des inscriptions postérieures à la livraison. Vérifie FR-3,
  FR-4. *Un taux bas signalerait que le formulaire ou le passage depuis la
  page tarifaire ne fonctionne pas.*
- **SM-4** : **l'attribution suit la demande.** Part des approbations où
  l'offre attribuée égale l'offre demandée. Sans cible : c'est un
  **indicateur de lecture**, pas un objectif. Un taux qui s'effondre dirait
  que la page tarifaire promet autre chose que ce que l'éditeur vend.

**Contre-métriques (à ne pas optimiser)**
- **SM-C1** : **le nombre de refus de quota.** Contrebalance SM-1. Un refus
  est le produit qui fait son travail. Chercher à le faire baisser
  conduirait à relever les plafonds ou à trouer les contrôles — exactement
  ce que cette fonctionnalité existe pour empêcher.
- **SM-C2** : **le temps d'approbation.** Contrebalance SM-4. L'approbation
  doit rester **un geste réfléchi**. L'accélérer en attribuant
  systématiquement la demande sans la regarder viderait FR-7 de son sens.

## 8. Questions ouvertes

1. **Les plafonds sont-ils les bons ?** Starter 20 biens / 2 utilisateurs,
   Pro illimité / 10, Enterprise illimité / illimité. Repris de la page
   tarifaire ; ce sont les seuls chiffres existants. **Bloquant** : les
   stories ne peuvent pas s'écrire sans.
2. **Que fait-on des 15 arguments de vente non tenus ?** Trois sorties : les
   implémenter (v2, gros), les retirer de la page tarifaire (rapide,
   honnête, moins vendeur), ou les laisser en l'état et l'assumer. **Ce
   n'est pas une question technique.**
3. **« Biens illimités » l'est-il vraiment ?** Aucune limite technique n'est
   posée aujourd'hui ; une agence pourrait charger 50 000 biens et faire
   souffrir les listes. Faut-il un plafond haut, non commercial, pour
   protéger le service ? *Lié à REP-95 et à la tenue à la charge (épopée 3).*
4. **Une agence `suspended` garde-t-elle son offre attribuée ?**
   `[HYPOTHÈSE : oui — le statut et l'offre sont orthogonaux (§3), et la
   réactiver ne doit pas obliger à réattribuer.]`
5. **L'agence doit-elle pouvoir *demander* un changement d'offre depuis son
   espace ?** Non en v1 (elle appelle l'éditeur). À rouvrir si le volume
   d'agences augmente.
6. **Faut-il prévenir l'agence quand elle approche de son plafond ?** Hors
   MVP (§6.2), mais c'est le premier candidat v2 : buter sans prévenir est
   la partie désagréable de UJ-3.

## 9. Index des hypothèses

*Chaque `[HYPOTHÈSE]` du document, à confirmer explicitement :*

1. **§4.1 / FR-1** — les plafonds de la page tarifaire actuelle sont ceux
   que vous voulez vendre. **La plus structurante du lot.**
2. **§4.2 / FR-4** — choisir une offre est **obligatoire** à l'inscription.
3. **§4.5 / FR-14** — la migration est `basic` → Starter, `premium` → Pro.
4. **§8, question 4** — une agence suspendue conserve son offre attribuée.

## 10. Ce que cette fonctionnalité rend atteignable

*`CLAUDE.md` §8 : une correction déplace le problème avant de le fermer. La
question se pose ici avant d'écrire la moindre ligne.*

- **Un plafond peut enfermer une agence.** C'est le risque principal, et il
  a un précédent exact dans ce dépôt : rendre la révocation effective avait
  ouvert une boucle de redirection qui enfermait un compte rétrogradé. FR-12
  est la garde — mais elle doit être **éprouvée**, pas seulement écrite.
- **Un décompte mal posé ferme trop tôt ou pas du tout.** Les biens à la
  corbeille et les comptes désactivés sont les deux pièges ; FR-9, FR-10 et
  FR-11 les nomment. Le filtre `deletedAt: null` du client Prisma étendu ne
  couvre que le **premier niveau** des lectures : un `count()` de biens en
  bénéficie, mais cela se **vérifie**, cela ne se suppose pas.
- **Un troisième endroit qui connaît les offres, et l'écart revient.** C'est
  exactement le défaut qu'on ferme. FR-1 impose une source unique, et SM-1
  la surveille.
- **`plan` devient une énumération : toute écriture non validée casse.**
  C'est voulu — cela fera remonter à la compilation les deux
  `formData.get(x) as Enum` de la console (`CLAUDE.md` §2).
