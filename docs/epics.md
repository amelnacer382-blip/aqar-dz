---
stepsCompleted: []
inputDocuments:
  - docs/qa/bug-report.md
  - docs/architecture.md
  - docs/project-context.md
  - CONTEXT.md
  - CLAUDE.md
  - GSD.md
---

# Aqar DZ - Epic Breakdown

## Overview

Ce document découpe en **6 épopées et 48 stories** le travail de remise en
état, issu de deux passes du 9 août 2026, de deux autres du 12 août, d'une
cinquième née d'une revue de code, et d'une sixième née d'un signalement de
l'éditeur le 14 août :

> *Décomptes recalculés le 14-08-2026 (story 5.12, sur constat de revue) —*
> ~~`grep -cE '^### Story ' docs/epics.md` → **48** ·
> `grep -cE '^  epic-[0-9]+:' docs/stories/sprint-status.yaml` → **6**.~~
> L'en-tête annonçait « 37 stories », chiffre de la génération initiale
> jamais recalculé depuis (famille de `REP-74`).
>
> **Recalculés le 17-08-2026 — les deux avaient recommencé à vieillir**, et
> la phrase ci-dessus (« 6 épopées et 48 stories ») est fausse depuis. C'est
> la démonstration de `CLAUDE.md` §7 par l'exemple : un nombre juste le jour
> où on l'écrit redevient faux tout seul.
> ```
> grep -cE '^## Epic [0-9]' docs/epics.md                            -> 7
> grep -cE '^### Story ' docs/epics.md                               -> 59
> grep -cE '^  epic-[0-9]+:' docs/stories/sprint-status.yaml         -> 7
> grep -cE '^  [0-9]+-[0-9]+[a-z0-9-]*:' docs/stories/sprint-status.yaml -> 59
> ```
> Les deux sources concordent. **Lire « 7 épopées et 59 stories »** — 58 le
> matin du 17-08, 59 le soir, la story 2.8 s'étant ajoutée en refusant de
> marquer `REP-96` résolu alors qu'il n'était que rétréci.

- **l'audit de code** — 31 défauts relevés sur les 26 123 lignes du
  projet, dont 4 critiques, portés à **33** par les deux relectures du
  12 août : celle des Server Actions des écrans (défaut n° 32) et celle de
  la fraîcheur de ce que les gardes relisent (défaut n° 33)
  (`docs/qa/bug-report.md`) ;
- **le bilan de santé** — mesures Lighthouse, `EXPLAIN` et poids
  transféré, qui a fait apparaître trois risques absents du registre :
  aucune sauvegarde, images non optimisées, aucune couche métier testable.

> **Il ne remplace pas un PRD.** Aqar DZ n'a pas de `docs/prd.md` — le
> besoin produit vit aujourd'hui dans `CONTEXT.md` et dans l'archive
> `GSD.md`. Ces épopées couvrent uniquement la correction et le durcissement de
> l'existant. Toute **nouvelle fonctionnalité** doit passer d'abord par
> `bmad-prd`, puis par `bmad-create-epics-and-stories`, qui viendra
> compléter ce fichier.

Chaque story porte en clair le ou les numéros de défaut qu'elle referme,
pour que `docs/qa/bug-report.md` reste traçable de bout en bout.

---

## Requirements Inventory

### Functional Requirements

Aucun PRD n'existe. Les exigences fonctionnelles applicables sont celles
déjà tenues par le code et décrites dans `CONTEXT.md` : douze modules
métier, trois rôles, vitrine publique par agence, activation manuelle des
agences. **Ces épopées ne les modifient pas** — sauf FR-01 ci-dessous,
qui est une exigence fonctionnelle nouvelle car elle change ce que
l'utilisateur peut faire.

- **FR-01** — Un utilisateur doit pouvoir se connecter avec son adresse
  email quelle que soit la casse saisie. *(défaut n° 02)*
- **FR-02** — Un document déposé par une agence n'est consultable que par
  les comptes de cette agence. *(défaut n° 01)*
- **FR-03** — La référence affichée d'un bien et d'un paiement doit être
  lisible par un tiers non technique (comptable, notaire). *(défaut n° 25)*

### NonFunctional Requirements

- **NFR-01 · Confidentialité** — Aucune donnée d'une agence n'est
  accessible depuis une autre agence, ni par lecture, ni par écriture, ni
  par suppression. *(défauts n° 01, 07)*
- **NFR-02 · Intégrité des sorties** — Toute donnée d'origine utilisateur
  est neutralisée à la sortie, quel que soit le canal : HTML d'email, CSV,
  attribut `href`. *(défauts n° 05, 06, 10)*
- **NFR-03 · Résistance à l'abus** — Les points d'entrée publics
  (connexion, inscription, oubli de mot de passe, formulaire de vitrine,
  dépôt de fichier) sont limités en débit sur une identité d'appelant que
  l'appelant ne contrôle pas. *(défauts n° 04, 08, 27, 28)*
- **NFR-04 · Confidentialité du transport** — Le trafic et le cookie de
  session circulent chiffrés ; l'application n'est joignable que par le
  reverse proxy. *(défauts n° 09, 17, 18)*
- **NFR-05 · Tenue à la charge et fluidité** — Aucune page ne charge un
  volume proportionnel au succès commercial du produit ; le LCP reste sous
  2,5 s en profil mobile bridé, sur l'accueil comme sur la vitrine.
  *(défauts n° 13, 14 + bilan de santé : images non optimisées, tri non
  indexé)*
- **NFR-06 · Exactitude des données affichées** — Les compteurs et les
  agrégats reflètent ce que l'utilisateur voit à l'écran. *(défaut n° 15)*
- **NFR-07 · Filet de régression** — Le cloisonnement multi-locataire et
  la séparation des rôles sont couverts par des tests automatisés qui
  échouent si la propriété est cassée. *(défaut n° 19)*
- **NFR-08 · Aucun secret dans le dépôt** — Règle 11 (`CLAUDE.md` §10 et §12).
  *(défaut n° 03)*
- **NFR-09 · Durabilité** — Aucune perte de données n'est possible du fait
  de la défaillance d'une seule machine. La sauvegarde est automatique,
  chiffrée, hors du serveur, et sa restauration a été prouvée au moins une
  fois. *(bilan de santé — aucune sauvegarde automatique aujourd'hui)*
- **NFR-10 · Observabilité** — Une défaillance en production est connue de
  l'éditeur sans qu'un client ait à la signaler. *(bilan de santé — aucune
  supervision aujourd'hui)*
- **NFR-11 · Testabilité** — Une règle de gestion peut être vérifiée sans
  passer par un navigateur. *(bilan de santé — aucune couche service)*
- **NFR-12 · Révocabilité des accès** — Retirer un droit le retire
  effectivement, à la requête suivante et sans reconnexion de
  l'intéressé : désactivation d'un compte, changement de rôle, changement
  d'agence. Une décision d'accès prise dans l'écran des comptes vaut pour
  le présent, jamais pour la durée d'un jeton. **Dans les deux sens** :
  une promotion prend effet aussi vite qu'une rétrogradation, et un
  changement de rôle ne doit jamais *enfermer* un compte entre deux
  espaces. **Et à la navigation, pas seulement à la requête** : un cache
  client qui ressert une page sans appeler le serveur est une exception à
  cette règle. *(défaut n° 33, complété par la revue de la story 1.8)*

### Additional Requirements

- Les règles permanentes de `CLAUDE.md` s'appliquent à chaque story et ne
  sont jamais reformulées comme critère d'acceptation : navbar
  horizontale, `agencyId` obligatoire, validation Zod, journal d'audit.
- La définition de « terminé » commune est dans
  `docs/project-context.md`.
- `CLAUDE.md` §1 : aucune story n'en enchaîne une autre sans
  validation explicite ; une épopée se termine par `bmad-retrospective`.

### UX Design Requirements

Aucune. Ces épopées ne changent pas d'écran, à trois exceptions près,
toutes signalées dans la story concernée : le message d'erreur de
commission (story 3.1), la pagination de la vitrine (story 3.4), et le
refus local d'un fichier trop lourd (story 5.3).

### FR Coverage Map

| Exigence | Couverte par |
|----------|--------------|
| FR-01 | Story 1.2 |
| FR-02 | Stories 1.3, 1.7 |
| FR-03 | Story 5.5 |
| NFR-01 | Stories 1.3, 1.7, 4.2 |
| NFR-02 | Stories 1.5, 1.6, 1.7 |
| NFR-03 | Stories 1.4, 2.2, 5.6 |
| NFR-04 | Stories 2.1, 2.3, 2.4 |
| NFR-05 | Stories 3.3, 3.4, 3.7, 3.8 |
| NFR-06 | Story 3.5 |
| NFR-07 | Épopée 4 en entier |
| NFR-08 | Story 1.1 |
| NFR-09 | Stories 0.1, 0.2 |
| NFR-10 | Story 0.3 |
| NFR-11 | Story 4.5 |
| NFR-12 | Story 1.8, complétée par la story 5.8 |

---

## Epic List

| # | Épopée | Défauts couverts | Bloque quoi |
|---|--------|:---:|---|
| **0** | **Ne pas perdre les données** | — | **tout. Le seul risque irréversible** |
| 1 | Fermer ce qu'un tiers peut exploiter | 10 | l'ouverture à un premier client réel |
| 2 | Durcir le déploiement | 4 | la mise en ligne sur un VPS |
| 3 | Fiabiliser les données et la tenue à la charge | 8 + fluidité | la montée en charge |
| 4 | Reprendre la suite de tests | 2 + lacunes | **l'ouverture à un premier client réel** (story 4.6) ; sans le reste, tout le reste est posé à l'aveugle |
| 5 | Dette technique et lisibilité produit | 9 + résidu du n° 33 | rien |

**Ordre imposé.**

1. **L'épopée 0 passe avant tout**, y compris avant l'épopée 1. Un défaut
   exploité se corrige ; des données perdues ne reviennent pas. C'est la
   seule épopée dont le report a une conséquence irréversible.
2. **L'épopée 1** ensuite : aucun client réel avant qu'elle soit close —
   **et la story 4.6 avec elle.** Elle n'est pas dans l'épopée 1, mais elle
   en partage la barrière : tant qu'un agent peut détruire définitivement
   l'historique locatif d'un bien, sans corbeille, sans journal et sans
   sauvegarde, aucun client réel ne doit être installé.
3. **La story 1.8 passe avant la story 4.6.** *(Tranché le 12 août 2026.)*
   Les deux partagent la même barrière et l'une pourrait passer d'abord
   sans que rien ne casse — mais l'ordre inverse fait poser cinq contrôles
   de rôle sur une valeur qui peut avoir trente jours de retard. La 4.6
   ajoute cinq lecteurs à `userRole` ; la 1.8 rend `userRole` vrai. On
   assainit la source avant de la brancher, pas après : c'est moins de
   travail dans cet ordre, et surtout la preuve par mutation exigée par la
   4.6 ne peut pas être écrite honnêtement tant que le rôle qu'elle teste
   n'est pas celui de la base.
4. **La story 3.9 passe avant le reste de l'épopée 3 et avant la 4.5.**
   *(Ajouté le 12 août 2026.)* Même argument que pour la 4.6 : elle ferme
   une corruption de données confirmée, la 4.5 améliore la testabilité. Le
   geste qui la déclenche — ouvrir une fiche et enregistrer sans rien
   changer — est celui d'un utilisateur ordinaire.
5. **L'épopée 4 avant l'épopée 3.** Sans filet de régression, chaque
   correctif suivant est appliqué sans preuve qu'il ne casse rien. À
   l'intérieur, **la story 4.6 passe avant la 4.5** : l'une ferme une perte
   de données possible, l'autre améliore la testabilité.
6. **L'épopée 2 est indépendante** et peut être menée en parallèle par une
   autre personne — elle ne touche que `docker-compose.prod.yml`,
   `nginx.conf` et `.env`.

> **Ajout du 9 août 2026 (bilan de santé).** Les épopées 1 à 5 avaient été
> découpées sur les *défauts de code*. Le bilan de santé a montré que les
> risques les plus lourds n'étaient pas dans le code : l'absence de
> sauvegarde (épopée 0), le poids des images (story 3.7), l'absence
> d'index composites (story 3.8) et l'absence de couche métier testable
> (story 4.5). Ces cinq stories ont été ajoutées après coup.

---

## Epic 0: Ne pas perdre les données

Aqar DZ tient la comptabilité locative de ses clients : baux, quittances,
contrats de vente, pièces d'identité. Aujourd'hui, **une panne de disque
sur le VPS efface tout cela définitivement** — la seule sauvegarde est un
`pg_dump` manuel documenté dans le README, à lancer à la main, sans
planification, sans copie hors machine, et jamais restauré.

Cette épopée ne corrige aucun défaut du registre. Elle traite le seul
risque du projet dont la conséquence est **irréversible**, et c'est pour
cela qu'elle passe avant l'épopée 1 : un défaut exploité se corrige, des
données perdues ne reviennent pas.

Elle est courte — deux jours de travail, pas deux semaines.

### Story 0.1: Sauvegarder la base automatiquement, hors de la machine

As a éditeur d'Aqar DZ,
I want que la base soit sauvegardée toute seule, chiffrée, ailleurs que sur le serveur,
So that la perte du VPS ne fasse pas perdre le travail de toutes les agences.

**Couvre :** NFR-09 · **Fichiers :** `docker-compose.prod.yml`, nouveau service ou tâche planifiée

> **Arbitrage rendu le 10 août 2026 — destination : stockage objet distant,
> compatible S3.** Pas de seconde machine.
>
> *Pourquoi.* Une seconde machine ne sauvegarde rien tant que personne ne la
> surveille : elle ajoute un serveur à tenir à jour, à payer et à superviser,
> pour un produit qui n'en administre pas encore un correctement. Un bucket
> S3 n'a pas d'OS, pas de correctifs de sécurité, et sa facture est
> proportionnelle à ce qu'on y dépose. Il donne aussi gratuitement les deux
> choses que la story exige et qu'une seconde machine demanderait d'écrire à
> la main : la rétention par règle de cycle de vie, et le versionnage
> d'objet.
>
> *Le fournisseur reste à choisir, et ce n'est pas un détail technique.* Ces
> archives contiennent des pièces d'identité et des actes de propriété de
> clients algériens : la juridiction du stockage est une question juridique
> avant d'être une question d'infrastructure. **N'importe quel service
> compatible S3 convient** — l'implémentation ne doit dépendre que de quatre
> variables (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`),
> jamais d'un SDK propriétaire, pour que le fournisseur reste remplaçable.
>
> *Ce qu'on ne fait pas.* Réutiliser le bucket Supabase de la story de
> stockage des fichiers. Une sauvegarde déposée au même endroit que les
> données qu'elle protège n'est pas une sauvegarde — et Supabase Storage
> n'offre pas de règles de cycle de vie.

**Acceptance Criteria:**

**Given** aucune sauvegarde automatique n'existe aujourd'hui
**When** la story est terminée
**Then** un `pg_dump` s'exécute au moins une fois par jour, sans intervention humaine
**And** l'archive est chiffrée avant de quitter la machine
**And** elle est déposée sur un stockage **distinct du VPS** (objet distant, ou autre machine)

**Given** un espace de stockage fini
**When** les sauvegardes s'accumulent
**Then** une rétention est appliquée — au minimum sept quotidiennes et quatre hebdomadaires

**Given** une sauvegarde qui échoue
**When** l'échec se produit
**Then** il est visible sans avoir à le chercher : le silence ne doit jamais valoir succès

**Given** les fichiers téléversés ne sont pas dans la base
**When** la stratégie est définie
**Then** le volume `uploads_data` est couvert lui aussi, ou la bascule vers Supabase Storage est actée et tracée

**Given** l'arbitrage du 10 août 2026
**When** la destination est implémentée
**Then** elle n'est atteinte que par les variables `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` — aucun SDK propriétaire, aucun nom de fournisseur en dur
**And** le bucket est distinct de `SUPABASE_STORAGE_BUCKET` s'il venait à être utilisé
**And** la rétention s'appuie sur une règle de cycle de vie du fournisseur quand il en offre une, plutôt que sur une purge écrite à la main

### Story 0.2: Prouver que la restauration fonctionne

As a éditeur,
I want avoir déjà restauré une sauvegarde au moins une fois,
So that je ne découvre pas le jour de l'incident qu'elle était inutilisable.

**Couvre :** NFR-09

> Une sauvegarde jamais restaurée n'est pas une sauvegarde : c'est un
> fichier. Cette story est séparée de la 0.1 exactement pour cette
> raison — c'est l'étape que tout le monde saute.

**Acceptance Criteria:**

**Given** une sauvegarde produite par la story 0.1
**When** on la restaure sur une base vierge
**Then** l'application démarre dessus et les données de démonstration sont intactes

**Given** l'exercice de restauration
**When** il est terminé
**Then** la procédure est écrite dans `README.md`, avec les commandes exactes et le temps observé

**Given** un incident réel un jour
**When** quelqu'un ouvre la procédure
**Then** elle indique aussi **combien de données sont perdues au maximum** — l'écart entre deux sauvegardes

### Story 0.3: Voir les erreurs sans attendre un coup de téléphone

As a éditeur,
I want être averti quand l'application échoue,
So that je ne l'apprenne pas d'une agence mécontente trois jours plus tard.

**Couvre :** NFR-10 · **Fichiers :** `lib/`, `instrumentation.ts`

**Acceptance Criteria:**

**Given** les erreurs partent aujourd'hui dans `console.error` et dans les journaux du conteneur
**When** la story est terminée
**Then** elles sont collectées par un service qui les conserve et les regroupe

**Given** une erreur non rattrapée en production
**When** elle survient
**Then** une alerte parvient à l'éditeur, avec la trace et le chemin concerné

**Given** les données des agences sont confidentielles
**When** une erreur est transmise
**Then** aucune donnée personnelle n'est envoyée au service tiers — ni email de client, ni contenu de document

**Given** la sonde `/api/public/health` existe déjà
**When** elle répond `degraded`
**Then** cela déclenche une alerte, et pas seulement un redémarrage silencieux du conteneur

---

## Epic 1: Fermer ce qu'un tiers peut exploiter

Les dix défauts dont un tiers peut tirer parti sans compte, qui enferment
un client dehors sans recours — ou, symétriquement, qui gardent quelqu'un
dedans sans recours (story 1.8). Aucun client réel ne doit être accueilli
avant que cette épopée soit close.

### Story 1.1: Sortir la clé d'API du dépôt

As a responsable du projet,
I want qu'aucun secret ne vive dans l'historique git,
So that la fuite du dépôt ne donne accès à aucun service tiers.

**Couvre :** défaut n° 03 · **Fichier :** `mcp-config.json:7`

**Acceptance Criteria:**

> **Arbitrage du 13-08-2026 : Figma est abandonné** (« on ne va plus
> l'utiliser »). Les deux critères qui prévoyaient de faire lire la clé
> depuis une variable d'environnement et de documenter cette variable dans
> `.env.example` **sont retirés** : on ne sécurise pas l'accès à un outil
> qu'on supprime. Ils sont remplacés ci-dessous.

**Given** une clé Figma `figd_…` en clair dans `mcp-config.json`, suivie par git depuis le commit `a529f61`
**When** la story est terminée
**Then** la clé a été révoquée côté Figma — **cette étape passe avant toute autre, et rien d'autre ne la remplace**
**And** aucun fichier du dépôt ne configure plus Figma comme outil utilisable
**And** `mcp-config.json` reste listé dans `.gitignore`, au cas où une configuration MCP revienne

**Given** la clé est vivante dans l'historique de `main` **et** suivie sur `origin/feature/design-improvements`, branche poussée sur GitHub
**When** la story est terminée
**Then** les deux emplacements sont connus et tracés — purger `main` seul ne fermerait pas le défaut
**And** le sort de la branche distante est une décision écrite (`REP-77`), pas un oubli

**Given** le dépôt est destiné à être partagé
**When** on inspecte l'historique
**Then** l'ancienne valeur n'y apparaît plus, ou le point est explicitement accepté et tracé dans `action_items` de `docs/stories/sprint-status.yaml`
**And** une fois la clé révoquée, la purge devient sans objet : un jeton mort n'est plus un secret

> ⚠️ **À faire en premier, aujourd'hui.** C'est le seul défaut du registre
> dont le coût augmente avec le temps d'attente. L'abandon de Figma rend la
> révocation **gratuite** — plus aucun usage n'en dépend, et c'était la
> seule raison du report du 10-08-2026.

### Story 1.2: Normaliser les adresses email

As a utilisateur d'une agence,
I want me connecter avec mon adresse quelle que soit la casse,
So that je ne perde pas définitivement l'accès à mon compte pour une majuscule.

**Couvre :** défaut n° 02 (FR-01) · **Spec existante :** `docs/stories/story-01-normalisation-email.md`

**Acceptance Criteria:**

**Given** un compte créé avec `Contact@ImmoAlger.dz`
**When** l'utilisateur saisit `contact@immoalger.dz`, `CONTACT@IMMOALGER.DZ` ou la casse d'origine
**Then** la connexion réussit dans les trois cas

**Given** une adresse déjà prise dans une autre casse
**When** quelqu'un s'inscrit avec
**Then** la réponse est « Cet email est déjà utilisé » en HTTP 400, jamais une erreur 500

**Given** des comptes déjà en base contenant des majuscules
**When** la migration `normalize_user_emails` s'exécute
**Then** les adresses sont normalisées et leurs propriétaires se connectent sans intervention
**And** les collisions éventuelles sont détectées et signalées **avant** d'échouer sur la contrainte d'unicité

**Given** la route `/api/auth/register` redéfinit son propre `registerSchema`
**When** la correction est appliquée
**Then** le doublon a disparu au profit du schéma unique de `lib/validations/index.ts`

### Story 1.3: Protéger l'accès aux documents

As a agence,
I want que les pièces d'identité et actes que je dépose ne soient lisibles que par mes comptes,
So that une URL devinée ou partagée n'expose pas les papiers de mes clients.

**Couvre :** défauts n° 01 et n° 26 (FR-02, NFR-01) · **Spec existante :** `docs/stories/story-03-acces-aux-documents.md`

**Acceptance Criteria:**

**Given** un document déposé dans `/uploads/documents/`
**When** on le demande sans session
**Then** la réponse est 401, et non le fichier

**Given** un document appartenant à l'agence A
**When** un compte de l'agence B demande `/api/documents/{id}/file`
**Then** la réponse est 404 — jamais 403, qui confirmerait l'existence du document

**Given** les photos de biens servent la vitrine publique
**When** la protection est posée
**Then** `/uploads/properties/` reste servi publiquement, sans session

**Given** `robots.txt`
**When** on le lit
**Then** `/uploads/documents/` est en `Disallow`, `/uploads/properties/` ne l'est pas

### Story 1.4: Identifier l'appelant sur une valeur qu'il ne contrôle pas

As a plateforme,
I want que la limitation de débit compte la vraie adresse de l'appelant,
So that un en-tête forgé ne remette pas les compteurs à zéro.

**Couvre :** défaut n° 04 (NFR-03) · **Fichiers :** `lib/rate-limit.ts:120-130`, `nginx/nginx.conf`

**Acceptance Criteria:**

**Given** nginx pose `X-Real-IP` depuis `$remote_addr` et ajoute l'adresse à la fin de `X-Forwarded-For`
**When** `ipFromHeader()` détermine l'appelant
**Then** elle retient une valeur que le client ne peut pas écraser

**Given** le budget d'inscription est épuisé pour une adresse
**When** la même machine renvoie une requête avec `X-Forwarded-For: 9.9.9.1`
**Then** la réponse reste 429

**Given** une agence dont tous les postes sortent par une seule adresse publique
**When** douze personnes se connectent le lundi matin
**Then** aucune n'est bloquée — le seuil par adresse reste large, seul le seuil par compte est étroit

### Story 1.5: Échapper les données utilisateur dans les emails

As a agence,
I want que les emails envoyés par Aqar DZ ne puissent pas contenir de HTML injecté par un visiteur,
So that mon serveur ne signe pas un message de hameçonnage.

**Couvre :** défaut n° 05 (NFR-02) · **Spec existante :** `docs/stories/story-02-echapper-les-sorties.md`

**Acceptance Criteria:**

**Given** un visiteur qui poste `<a href="…">Confirmez vos identifiants</a>` dans le formulaire public
**When** l'agence reçoit la notification
**Then** le lien apparaît en texte littéral, jamais comme lien cliquable

**Given** le contrat `body: string[]` de `emailLayout` annonce des paragraphes déjà échappés
**When** la story est terminée
**Then** tous les appelants l'honorent : `notifyAgencyOfLead`, `notifyPlatformOfSignup`

**Given** le sujet de l'email reprend le nom du visiteur
**When** ce nom est anormalement long
**Then** il est borné avant d'entrer dans le sujet

### Story 1.6: Neutraliser les formules dans les exports CSV

As a agent d'agence,
I want ouvrir un export sans qu'une cellule s'exécute,
So that un message reçu par la vitrine ne devienne pas une commande sur mon poste.

**Couvre :** défaut n° 06 (NFR-02) · **Spec existante :** `docs/stories/story-02-echapper-les-sorties.md`

**Acceptance Criteria:**

**Given** une valeur commençant par `=`, `+`, `-`, `@`, une tabulation ou un retour chariot
**When** `escape()` la traite
**Then** elle est préfixée d'une apostrophe et ressort inerte

**Given** les huit entités exportables
**When** la correction est appliquée dans `lib/csv.ts`
**Then** elle les couvre toutes sans modification des huit appelants

**Given** un accent, un point-virgule ou un saut de ligne dans une valeur
**When** le fichier est ouvert dans Excel en locale française
**Then** l'affichage reste correct — la correction ne casse ni le BOM ni le guillemetage

### Story 1.7: Contraindre l'URL d'un document

As a plateforme,
I want qu'un document ne puisse référencer qu'un fichier de notre stockage,
So that sa suppression n'efface pas un fichier arbitraire, et son affichage n'exécute pas de script.

**Couvre :** défauts n° 07 et n° 10 (NFR-01, NFR-02) · **Fichiers :** `lib/validations/index.ts:365`, `lib/storage.ts:106-137`

**Acceptance Criteria:**

**Given** `documentSchema.url` accepte aujourd'hui toute chaîne
**When** la validation est resserrée
**Then** seule une adresse interne du dossier d'upload est acceptée — même contrainte que `parseGalleryUrls()`

**Given** un document enregistré avec `/uploads/../../un/autre/fichier`
**When** on tente de le supprimer
**Then** `deleteFile()` refuse toute clé contenant `..` ou commençant par `/`, et journalise le refus

**Given** un bucket Supabase partagé entre toutes les agences
**When** une agence supprime un document
**Then** seul un objet lui appartenant peut être retiré

**Given** une URL `javascript:` enregistrée avant la correction
**When** la page documents s'affiche
**Then** le lien n'est pas rendu comme cliquable

### Story 1.8: Rendre la révocation d'un accès effective

As a administrateur d'agence,
I want que désactiver un compte ou changer son rôle prenne effet immédiatement,
So that le départ d'un collaborateur ou la fuite d'un mot de passe puisse être refermé le jour où il arrive.

**Couvre :** défaut n° 33 (BUG-33), NFR-12 · **Fichiers :** `lib/auth-guard.ts`, `auth.config.ts`, `tests/roles.spec.ts`

> **Ajoutée le 12 août 2026**, quatrième passe. Elle est dans l'épopée 1
> parce qu'elle en partage exactement la définition : « ce qui enferme un
> client dehors sans recours » a ici son symétrique — ce qui garde
> quelqu'un dedans sans recours.
>
> **ELLE PASSE AVANT LA STORY 4.6.** Voir « Ordre imposé », point 3 : la
> 4.6 ajoute cinq lecteurs de `userRole`, celle-ci rend `userRole` vrai.

Les trois gardes de `lib/auth-guard.ts` revérifient le statut de l'agence à
chaque requête — et **rien de l'utilisateur**. `isActive` n'est lu qu'une
fois, à la connexion. Conséquence : le bouton « Désactiver » de
`/agency/users` écrit en base, journalise, affiche « Compte désactivé », et
ne retire aucun accès pendant jusqu'à trente jours.

**Acceptance Criteria:**

**Given** un compte d'agence connecté, avec une session ouverte et valide
**When** son administrateur le désactive depuis `/agency/users`
**Then** à sa requête suivante il est éjecté, sans avoir eu à se reconnecter
**And** il ne peut plus ni lire une page de `/agency`, ni appeler une route d'API, ni soumettre une Server Action

**Given** un `agency_admin` connecté, avec une session ouverte
**When** son rôle est ramené à `agent`
**Then** la requête suivante le traite comme un `agent` — les actions réservées à l'administrateur lui sont refusées
**And** la réciproque vaut : un agent promu obtient ses droits sans se reconnecter

**Given** un `super_admin` désactivé par un autre `super_admin`
**When** il rouvre `/admin`
**Then** il est éjecté — `requireSuperAdmin()` n'interroge aujourd'hui pas la base du tout, et c'est le seul chemin où le compte n'est vérifié à aucun moment après la connexion

**Given** les gardes `requireAgency` et `getApiAgency` font déjà une requête pour l'agence
**When** elles relisent l'utilisateur
**Then** elles le font par **un seul appel Prisma** qui rapporte le compte et son agence
**And** le surcoût réel est **mesuré et écrit**, non déduit — un aller-retour SQL de plus, Prisma éclatant une relation to-one en deux instructions ; « zéro requête supplémentaire » était faux *(corrigé en revue)*
**And** `requireAgency()` continue de renvoyer le même contrat à ses appelants — **66 appels dans 39 modules**, `grep -roE '\brequireAgency\(\)' app | wc -l` : aucune signature ne change *(le chiffre « 31 » venait de l'audit du 9 août et n'avait jamais été recompté)*

**Given** le middleware tourne en Edge Runtime et ne peut pas atteindre la base
**When** la story se termine
**Then** il **n'autorise plus rien** : il vérifie qu'une session existe et laisse passer *(corrigé en revue — il rendait des décisions de refus sur le rôle du jeton, ce qui a ouvert une boucle de redirection dès que les gardes ont lu la base)*
**And** l'aiguillage entre `/admin` et `/agency` vit dans `lib/auth-guard.ts`, une seule couche, une seule source
**And** aucune tentative n'est faite pour lui donner accès à la base

**Given** une session de trente jours n'est pas une session mais un identifiant permanent
**When** la story se termine
**Then** `auth.config.ts` pose un `maxAge` explicite de **12 heures** — une journée de travail d'agence
**And** la valeur est commentée comme un arbitrage produit, réversible en une ligne

**Given** le commentaire de `app/admin/users/page.tsx:132` prescrit la désactivation comme remède à un compte compromis
**When** la story se termine
**Then** ce commentaire dit vrai — ou il est réécrit pour dire ce qui est vrai
**And** ce qui reste hors de portée (un jeton volé sur un compte laissé actif) est nommé, et renvoyé à la story 5.8

**Given** `tests/roles.spec.ts` couvre la séparation des rôles
**When** la story est terminée
**Then** un test désactive un compte **pendant** qu'il est connecté et prouve l'éjection à la requête suivante
**And** un autre prouve la rétrogradation à chaud
**And** la couverture est prouvée par mutation : en rétablissant la lecture du rôle depuis le jeton, les tests rougissent

> **Ce que cette story ne fait pas.** Elle ne touche pas au schéma, ne pose
> aucune migration et ne rend pas révocable un jeton volé sur un compte qui
> reste actif — c'est la story 5.8. Elle ne remplace pas la stratégie JWT
> par des sessions en base : ce serait une décision d'architecture, pas un
> correctif.

---

### Story 1.9: Ne plus laisser un tiers verrouiller un compte

As a directeur d'agence,
I want que des tentatives de connexion ratées ne me ferment pas mon propre compte,
So that quelqu'un qui connaît mon adresse ne puisse pas me mettre dehors.

**Couvre :** REP-37 (🔴), REP-38, REP-39, REP-40 · **Fichiers :** `auth.ts`, `lib/rate-limit.ts`, `app/auth/login/actions.ts`, `app/auth/forgot/actions.ts`

> **`REP-34` retiré de cette ligne le 13-08-2026.** Il y figurait alors que
> la story le déclarait hors périmètre depuis sa première rédaction. La
> contradiction n'a été vue qu'à la clôture ; le constat est transféré à la
> **story 5.10**, ouverte pour lui.

> **🔴 Le plus grave des constats sans propriétaire, relevé le 10-08-2026 et
> resté onze jours sans story.** `login:compte:${email}` est consommé
> **avant** la vérification du mot de passe et n'est effacé qu'en cas de
> succès — succès que la limite empêche d'atteindre. Dix mots de passe faux
> par quart d'heure suffisent donc à bloquer le titulaire, pour quarante
> requêtes par heure. **Les adresses des directeurs d'agence sont publiées
> sur les vitrines.** La voie de secours ferme aussi : `oubli:compte:` est
> limité à cinq par heure.
>
> **Elle rejoint la barrière de l'épopée 1** : un tiers peut mettre une
> agence entière dehors sans rien exploiter d'autre que son adresse email.

**Acceptance Criteria:**

**Given** un tiers qui connaît l'adresse d'un compte
**When** il enchaîne des mots de passe faux
**Then** le titulaire peut toujours se connecter avec le bon mot de passe
**And** seuls les échecs **constatés après vérification** alimentent un compteur

**Given** verrouiller et ralentir ne sont pas la même mesure
**When** la story est terminée
**Then** les deux sont distinguées, et la plus dure n'est jamais atteignable par un tiers

**Given** la fenêtre fixe autorise le double du budget à sa frontière (REP-38)
**When** la story est terminée
**Then** le comptage ne laisse plus passer vingt essais là où le seuil en annonce dix

**Given** `.some()` court-circuite le second `rateLimit` (REP-39)
**When** la story est terminée
**Then** les budgets par adresse et par compte sont réellement indépendants

**Given** rien n'échappe les segments d'une clé de compteur (REP-40)
**When** la story est terminée
**Then** une clé construite sur une valeur libre ne peut plus entrer en collision avec une autre

---

## Epic 2: Durcir le déploiement

~~Quatre réglages d'infrastructure, sans code applicatif. Ils tiennent dans
une session sur `docker-compose.prod.yml`, `nginx/nginx.conf` et `.env`.~~
Cette épopée bloque la mise en ligne sur un VPS, pas l'usage local.

> **Recompté le 16-08-2026 : l'épopée porte six stories, et deux d'entre
> elles touchent au code applicatif.** La phrase d'origine décrivait
> l'épopée telle qu'elle avait été conçue le 9 août ; la 2.5 (seau privé,
> `lib/storage.ts`) l'avait déjà démentie, et la 2.6 la dément de nouveau
> — une sonde de santé et un script de vérification sont du code. Corrigé
> au titre de `CLAUDE.md` §7 : un dénombrement qui ne se recalcule pas
> devient faux tout seul.
>
> ~~`grep -cE '^### Story 2\.' docs/epics.md` → 6~~ → **8** le 17-08-2026 :
> la story 2.7 (volume de la base hors de portée d'un `down -v`, REP-103) et
> la story 2.8 (dire quel commit est en service, REP-96 rétréci) s'y sont
> ajoutées.

### Story 2.1: Fermer l'accès direct à l'application

As a exploitant,
I want que nginx soit le seul chemin vers l'application,
So that les limites de débit et le futur TLS ne soient pas contournables.

**Couvre :** défaut n° 09 (NFR-04) · **Fichier :** `docker-compose.prod.yml:81-82`

**Acceptance Criteria:**

**Given** le service `frontend` publie aujourd'hui `3000:3000` sur l'hôte
**When** la correction est appliquée
**Then** il n'expose plus son port, ou le lie explicitement à `127.0.0.1`

**Given** la pile est démarrée
**When** on interroge `http://<hôte>:3000/api/public/health` depuis l'extérieur
**Then** rien ne répond

**Given** nginx reste le point d'entrée
**When** on interroge le port 8095
**Then** l'application répond normalement, sonde de santé comprise

### Story 2.2: Vérifier le contenu réel des fichiers téléversés

As a plateforme,
I want que le type d'un fichier soit établi par son contenu,
So that l'admission ne repose pas sur une déclaration de l'appelant.

**Couvre :** défaut n° 08 (NFR-03) · **Fichier :** `app/api/upload/route.ts`

**Acceptance Criteria:**

**Given** un fichier texte annoncé `image/png`
**When** il est envoyé à `/api/upload`
**Then** il est refusé en 400, avec un message qui nomme le problème

**Given** un JPEG, un PNG, un WEBP ou un PDF authentique
**When** il est envoyé
**Then** il est accepté, et l'extension écrite découle de la signature réelle

**Given** un compte compromis qui boucle sur la route
**When** il dépasse le budget par agence
**Then** la route répond 429 — indépendamment de nginx, qui peut être contourné

### Story 2.3: Mettre la pile en HTTPS

As a utilisateur,
I want que ma session ne circule pas en clair,
So that mon cookie ne soit pas lisible sur le réseau.

**Couvre :** défaut n° 17 (NFR-04) · **Fichiers :** `nginx/nginx.conf`, `next.config.mjs:42-47`, `.env`

**Acceptance Criteria:**

**Given** un domaine réel et un certificat Let's Encrypt
**When** nginx est reconfiguré
**Then** il écoute en 443, et le port 80 redirige

**Given** `NEXTAUTH_URL` passe en `https://`
**When** l'utilisateur se connecte
**Then** le cookie de session porte l'attribut `Secure`

**Given** HSTS interdit le retour en HTTP pendant six mois
**When** le TLS n'est pas encore en place
**Then** l'en-tête n'est **pas** envoyé — il est conditionné à une variable explicite, plus à `NODE_ENV`

### Story 2.5: Ouvrir le seau privé et solder la dette des documents

As a éditeur,
I want pouvoir déployer sur stockage objet sans rendre les documents illisibles ni publics,
So that l'hébergement des pièces d'identité cesse d'être un choix impossible.

**Couvre :** REP-18 à REP-29, REP-55 à REP-57 (13 constats) · **Fichiers :** `lib/storage.ts`, `lib/env.ts`, `lib/documents.ts`, `app/api/upload/route.ts`

> **Treize constats reportés depuis les stories 1.3, 1.7 et 2.2, sans
> propriétaire jusqu'au 12-08-2026.** Ils forment un seul sujet : le mode
> Supabase est *bloqué*, pas réparé. Le seau est public et partagé avec les
> photos de vitrine ; `lib/env.ts` refuse donc de démarrer en production
> dans ce mode. Tant que le second seau n'est pas ouvert, aucun déploiement
> sur stockage objet n'est possible — ~~et l'épopée 0 en a besoin~~.
>
> **Cette dernière clause est fausse, et l'ordre réel est l'inverse.**
> Mesuré le 16-08-2026 en ouvrant la story 0.1. Cette story-ci ouvre le seau
> **applicatif**, où les documents des clients sont *servis* ; la story 0.1
> dépose dans un seau d'**archives**. Ils ne partagent ni le seau, ni les
> identifiants, ni le code — et l'arbitrage du 10 août interdit précisément
> de les confondre : *« une sauvegarde déposée au même endroit que les
> données qu'elle protège n'est pas une sauvegarde »*.
>
> Mieux : puisque `lib/env.ts:155` refuse aujourd'hui le mode Supabase en
> production, **tous** les fichiers téléversés sont dans le volume
> `uploads_data`. Faire cette story d'abord ferait naître un **second**
> gisement de fichiers, donc un cas de plus à couvrir dans l'AC-4 de la 0.1.
> **L'épopée 0 est moins chère avant cette story qu'après.**

**Acceptance Criteria:**

**Given** le seau actuel est public et sert aussi les photos de vitrine
**When** la story est terminée
**Then** un second seau **privé** porte les documents, et leur lecture passe par le serveur ou une URL signée
**And** `lib/env.ts` cesse de refuser le démarrage dans ce mode

**Given** une bascule de mode rend aujourd'hui illisibles les documents déjà enregistrés (REP-25)
**When** la story est terminée
**Then** un document déposé dans un mode reste lisible après bascule, ou l'impossibilité est signalée autrement qu'un 404 muet

**Given** un dépôt refusé laisse un fichier orphelin sur le disque (REP-20)
**When** la story est terminée
**Then** le fichier est ramassé, ou le dépôt suit la validation au lieu de la précéder

**Given** un fichier de 0 octet est servi en 200 (REP-27), et le contrôle par signature ne prouve que les premiers octets (REP-55)
**When** la story est terminée
**Then** les deux sont traités, ou écartés avec leur motif

---

### Story 2.4: Fermer et durcir la base

As a exploitant,
I want que la base ne soit joignable que depuis le réseau interne, avec un mot de passe propre à l'installation,
So that un pare-feu mal réglé ne suffise pas à tout perdre.

**Couvre :** défaut n° 18 (NFR-04) · **Fichiers :** `docker-compose.prod.yml:28-35`, `.env`

**Acceptance Criteria:**

**Given** `POSTGRES_PASSWORD` a aujourd'hui `aqar_password` comme valeur de repli
**When** la variable n'est pas renseignée
**Then** `docker compose up` échoue au lieu de démarrer sur une valeur devinable

**Given** le port `5433` est publié par défaut
**When** la correction est appliquée
**Then** il ne l'est plus, ou il est lié à `127.0.0.1`

**Given** l'installation en cours
**When** la story est terminée
**Then** un mot de passe réel a été généré et la base migrée dessus

---

### Story 2.6: Refuser de servir sur un schéma qu'on ne sait pas lire

As a exploitant,
I want qu'une image qui ne connaît pas le schéma de la base cesse de se déclarer en bonne santé,
So that le produit ne tombe pas à zéro pendant que tous les voyants restent verts.

**Couvre :** BUG-37 · **Fichiers :** `app/api/public/health/route.ts`, `scripts/verify-deploy.mjs`, `tests/deploiement.spec.ts`, `docker-compose.prod.yml`, `README.md`

> **Née d'une panne, pas d'une lecture.** Le 16-08-2026, plus aucune
> connexion n'aboutissait sur le déploiement documenté : la base portait
> l'énumération `AgencyPlan`, l'image servait un client Prisma qui attend un
> `String`. Le détail est dans BUG-37.
>
> **Ce que cette story traite n'est pas la panne** — elle se répare en
> reconstruisant l'image, et ce fut fait. C'est le fait qu'elle ait
> traversé **quatre contrôles** qui avaient chacun une bonne raison de ne
> rien voir : l'ordonnancement Docker ne garde qu'un sens, la sonde fait
> `SELECT 1`, `verify:deploy` ne s'authentifie jamais, et la suite E2E ne
> passe pas par l'image déployée (REP-95).
>
> **En une phrase : aucun contrôle de ce dépôt ne lit une ligne `Agency`
> authentifiée contre l'image réellement en service.**
>
> Le schéma déclare **19 énumérations**
> (`grep -cE '^enum ' prisma/schema.prisma`). Ce n'est donc pas un incident,
> c'est une classe : chaque migration future qui en touche une, appliquée
> sans reconstruire, rejoue exactement ceci.

**Acceptance Criteria:**

**Given** la sonde `/api/public/health` exécute `SELECT 1`, qui ne traverse aucune colonne
**When** l'image en service ne sait pas désérialiser une ligne que la base contient
**Then** la sonde répond `503` et le conteneur est déclaré `unhealthy`
**And** elle continue de répondre `200` sur une base **vide mais joignable** — l'absence de données n'est pas une panne

**Given** `verify:deploy` n'éprouve aucun chemin authentifié (`grep -nE 'signin|login|credentials|session|Cookie|auth' scripts/verify-deploy.mjs` → aucune occurrence)
**When** il tente une connexion avec un mot de passe **volontairement faux** sur un compte existant
**Then** il obtient **« Email ou mot de passe incorrect »**, et échoue sur toute exception
**And** il n'ouvre aucune session, n'écrit rien, et ne détient aucun mot de passe valide

> **Arbitrage rendu le 16-08-2026 par l'éditeur : la sonde d'échec.** Motif
> mesuré — `auth.ts:157-159` lit la ligne `Agency` (`include: { agency:
> true }`) **avant** `compare()` en ligne 188. Un mot de passe faux traverse
> donc exactement le code qui a cassé, sans accorder aucun accès. Les trois
> autres sorties sont écartées : le compte jetable fait écrire le script sur
> une production, le compte de démonstration use un compteur partagé (§3), et
> le compte dédié est un mot de passe permanent de plus.
>
> **Vérifier l'arbitrage l'a corrigé, dans les deux sens.** Le compteur *par
> compte* ne ferme aucun compte — `penaliserEchec` (`auth.ts:88`) retarde la
> réponse et rien d'autre, plafonné à 30 s : le risque annoncé était plus
> large que le code, et il se réduit à un réglage de délai d'attente. Mais le
> compteur *par adresse*, lui, **refuse avant toute lecture** et retourne
> `null` sans jamais atteindre `findUnique` (`auth.ts:152-155`). Un critère
> qui se contenterait d'« un refus lisible » serait donc **vert en n'ayant
> rien éprouvé** — `CLAUDE.md` §6, le contrôle posé à côté du trou. D'où le
> message unique exigé ci-dessus : « Trop de tentatives » est un résultat
> **indéterminé**, pas un succès.

**Given** `npm run db:deploy` applique les migrations depuis l'hôte, sans consulter le conteneur qui sert le trafic
**When** la base porte des migrations que l'image embarquée ne connaît pas, ou l'inverse
**Then** `verify:deploy` le signale **en nommant les migrations en écart**, plutôt que de laisser le symptôme apparaître à la connexion

**Given** la procédure du `README` propose aujourd'hui d'appliquer les migrations sans reconstruire
**When** la story est terminée
**Then** elle nomme la reconstruction comme indissociable de la migration, et dit pourquoi

**Given** `CLAUDE.md` §9 exige une preuve par mutation
**When** la story est terminée
**Then** la dérive est **rejouée** — image ancienne contre base migrée — et chaque garde ajoutée rougit en désignant la bonne cause, le contrôle positif restant vert

> **Ce que cette story rend atteignable — `CLAUDE.md` §8.** Deux risques,
> tous deux réels, et c'est le cœur de l'arbitrage à rendre :
>
> 🟠 ~~🔴~~ **Une sonde plus exigeante peut afficher une pile saine comme
> malade.** ~~nginx dépend de `frontend: service_healthy`.~~ **Affirmation
> fausse, corrigée le 16-08-2026** : `docker-compose.prod.yml:197-198` porte
> un `depends_on: - frontend` **sans condition**, et `restart:
> unless-stopped` ne relance pas un conteneur `unhealthy`. Une sonde
> exigeante n'empêche donc rien de démarrer — elle rend l'état visible dans
> `docker ps`. Le risque tombe de 🔴 à 🟠. Il reste réel : une sonde qui lit
> une ligne réelle échoue sur une base vide — donc au **premier**
> déploiement, avant tout `seed`. D'où le second volet de l'AC-1, qui n'est
> pas un détail mais la condition de la story : distinguer *« je ne sais pas
> lire cette ligne »* de *« il n'y a pas de ligne »*.
>
> 🟠 **Un `verify:deploy` qui s'authentifie a besoin d'un compte.** Le
> script se targue aujourd'hui de ne **rien écrire en base** (story 5.14).
> S'authentifier avec un compte jetable veut dire en créer un, donc écrire ;
> s'authentifier avec un compte de démonstration veut dire saturer un
> compteur partagé par toute la suite. Aucune des deux sorties n'est
> gratuite, et celle qui sera retenue doit l'être avec son motif.

### Story 2.7: Mettre le volume de la base hors de portée d'un `down -v`

As a exploitant,
I want que la commande la plus banale de Docker Compose ne puisse pas effacer la base,
So that une erreur de frappe à deux heures du matin ne coûte pas toutes les données du produit.

**Couvre :** REP-103 · **Fichiers :** `docker-compose.prod.yml`, `docker-compose.yml`, `README.md`, `tests/deploiement.spec.ts`

> **Née d'un arbitrage refusé, pas d'une lecture.** Le 17-08-2026, la story
> 2.6 avait besoin d'une base jetable et j'ai signalé à l'éditeur que la
> manœuvre risquait de détruire `aqar-prod_postgres_data`. La bonne réponse
> n'était pas d'être prudent : c'était de rendre la destruction impossible.
>
> **Mesuré, pas supposé** — sur deux volumes bidons hors du projet :
>
> ```
> down: Volume t-ext_jetable Removing
> down: Volume t-ext_jetable Removed
> apres : essai-volume-sacre          ← le volume `external` a survécu
> ```
>
> `docker compose down -v` supprime les volumes ordinaires et **épargne**
> ceux déclarés `external: true`, sans même un avertissement. C'est le seul
> verbe capable d'effacer la base, et il devient inoffensif pour une ligne
> de configuration.
>
> **Ce n'est pas une sauvegarde et ne la remplace pas.** La story 0.1 reste
> le filet ; celle-ci n'est que la rambarde. Un disque mort, un `docker
> volume rm` explicite ou une corruption passent dessous.

**Acceptance Criteria:**

**Given** `docker-compose.prod.yml:227-229` déclare `postgres_data` et `uploads_data` en volumes ordinaires
**When** ils sont déclarés `external: true` avec leur `name:` complet — `aqar-prod_postgres_data`, `aqar-prod_uploads_data`
**Then** `docker compose down -v` les laisse intacts
**And** la mutation le prouve : remettre la déclaration ordinaire, constater la suppression sur un projet jetable, rétablir

**Given** un volume `external` n'est **jamais créé** par Compose
**When** il est absent au démarrage
**Then** la pile refuse de monter avec une erreur explicite — la bascule est donc éprouvée sur un projet jetable **avant** d'être appliquée à la pile en service
**And** le `name:` est vérifié caractère par caractère contre `docker volume ls` : un nom faux fait chercher un volume qui n'existe pas, et la pile ne démarre plus

**Given** `docker-compose.yml` (développement) déclare les mêmes deux volumes
**When** la story est terminée
**Then** le choix retenu pour le développement est écrit avec son motif — les protéger aussi, ou assumer qu'une base de développement se jette

**Given** le `README` documente la procédure de déploiement
**When** la story est terminée
**Then** il dit qu'un volume `external` doit être **créé à la main au premier déploiement**, et donne la commande

### Story 2.8: Dire quel commit est en service

As a exploitant,
I want que le produit dise de quelle version du dépôt il est issu,
So that une vérification cesse de conclure à des régressions qui n'existent pas.

**Couvre :** REP-96 *(rétréci par la story 2.6, pas soldé)* · **Fichiers :** `app/api/public/health/route.ts`, `docker/Dockerfile`, `docker-compose.prod.yml`, `scripts/verify-deploy.mjs`

> **Ce que la story 2.6 a fermé, et ce qu'elle a laissé.** La sonde compare
> les migrations embarquées à celles appliquées et refuse de se déclarer
> saine sur un écart. Cela ferme ce qui **casse l'authentification** — la
> forme de BUG-37.
>
> **Cela ne dit toujours pas quel commit tourne.** Une image en retard dont
> aucune migration n'a bougé passe intégralement dessous : le 15-08-2026,
> l'image en service accusait **67 commits** de retard sans changement de
> schéma, et la sonde d'aujourd'hui l'aurait déclarée `a-jour`. Le coût a
> été mesuré — la vérification a conclu à une régression de sécurité qui
> n'existait pas.
>
> 🔵 et non 🟠 : ce qui reste fait perdre du temps, pas des connexions.

**Acceptance Criteria:**

**Given** `/api/public/health` ne dit rien de la version servie
**When** l'image est construite
**Then** elle porte le SHA du commit — injecté en `ARG` par `docker-compose.prod.yml`, pas lu depuis `.git` qui n'est pas dans l'image
**And** la sonde le rend, aux côtés de `schema`

> **Précisé le 17-08-2026 par une mesure, avant développement.** Le SHA est
> gravé dans un **fichier** de l'image, pas dans une `ENV`. Sur une image
> jetable portant les deux, `docker run -e COMMIT_SHA=x` — soit exactement ce
> que fait le `env_file: - .env` du service `frontend` — **écrase l'`ENV`** et
> ne peut rien contre le fichier. Une `ENV` aurait fait annoncer à la sonde un
> commit qui n'est pas le sien.
>
> Et le champ est rendu **sur les réponses 503 aussi**, pas seulement sur le
> succès : c'est en panne qu'on a besoin de savoir quelle image tourne.

**Given** un SHA absent ou vide au moment de la construction
**When** la sonde répond
**Then** elle le dit explicitement — `"commit":"inconnu"` — plutôt que d'omettre le champ
**And** la mutation le prouve : construire sans l'`ARG`, constater `inconnu`, et non un champ manquant qu'un lecteur prendrait pour une version ancienne du produit

**Given** `verify:deploy` interroge déjà la sonde
**When** le SHA servi diffère de `git rev-parse HEAD`
**Then** il le signale en nommant les deux, sans échouer — une image plus ancienne que la branche courante est un état normal en cours de travail

---

## Epic 3: Fiabiliser les données et la tenue à la charge

Huit défauts de justesse et de volumétrie. Rien ici n'est exploitable par
un tiers ; tout devient visible à mesure que les agences travaillent.

> **Recommandation :** mener l'épopée 4 avant celle-ci.

### Story 3.1: Borner les saisies numériques

As a agent,
I want que le formulaire refuse une valeur impossible,
So that je ne perde pas ma saisie sur un écran d'erreur technique, et que les calculs restent justes.

**Couvre :** défauts n° 11 et n° 21 · **Spec existante :** `docs/stories/story-04-robustesse-et-charge.md`

**Acceptance Criteria:**

**Given** le champ « Commission (%) » et une colonne `Decimal(5,2)`
**When** l'agent saisit `1000`
**Then** le formulaire refuse avec un message français, sans erreur `numeric field overflow`

**Given** un taux de `150`
**When** il est soumis
**Then** il est refusé — le libellé du champ précise « en pourcentage du loyer ou du prix de vente »

**Given** `rooms`, `bedrooms`, `bathrooms`, `floor`, `totalFloors`
**When** une valeur dépasse une borne réaliste
**Then** elle est refusée avant d'atteindre PostgreSQL

### Story 3.2: Valider le dernier cast d'énumération

As a super admin,
I want qu'un statut d'agence invalide produise un message et non une erreur Prisma en pleine page,
So that la console se comporte comme le reste du logiciel.

**Couvre :** défaut n° 12 · **Fichier :** `app/admin/agencies/page.tsx:100`

**Acceptance Criteria:**

**Given** `agencyStatusSchema` existe déjà et n'est utilisé nulle part
**When** la correction est appliquée
**Then** `updateAgencyStatus` passe par `parseForm(agencyStatusSchema, formData)`

**Given** une valeur de statut arbitraire postée à la main
**When** l'action s'exécute
**Then** elle redirige avec un message français, sans exception Prisma

**Given** le projet entier
**When** on cherche `formData.get(…) as` suivi d'un type d'énumération
**Then** il n'en reste aucun

> **Livrée le 17-08-2026, et son périmètre a doublé en route.** Le cast de
> `BUG-06` avait **déjà** disparu — remplacé par `parseForm` en effet de
> bord du commit `92f826b` (épopée 6), sans story qui le porte, sans trace
> au registre et **sans aucun test**. La story lui a apporté la preuve et
> la trace.
>
> Puis le balayage exigé par la troisième AC ci-dessus a trouvé **six
> autres sites du même défaut** : des gardes en `valeur in TABLE_LABELS`,
> trouées par la chaîne de prototypes (`constructor`, `toString`,
> `__proto__`… répondent « oui »), dont **deux sur la vitrine publique**,
> atteignables sans compte. C'est `BUG-38`.
>
> Une story qui dit « il en reste **un**, on le ferme » ne peut pas
> s'achever sur « il en restait sept, j'en ai fermé deux » : les sept ont
> été fermés. Écriture → schéma Zod ; lecture → valeur inconnue **ignorée**,
> jamais refusée. `tests/enums.spec.ts`, quatre cas, quatre mutations.

### Story 3.3: Compter sans tout charger

As a super admin,
I want que la liste des agences reste rapide quand la plateforme grandit,
So that le succès commercial ne dégrade pas ma console.

**Couvre :** défaut n° 13 (NFR-05) · **Fichier :** `app/admin/agencies/page.tsx:75-81`

**Acceptance Criteria:**

**Given** la page charge aujourd'hui toutes les lignes `users` et `properties` pour n'afficher que leurs longueurs
**When** la correction est appliquée
**Then** elle utilise `_count`, comme le fait déjà `app/admin/statistics/page.tsx:51`

**Given** 50 agences de 2 000 biens
**When** la page s'affiche
**Then** le volume transféré ne dépend plus du nombre de biens

> **Livrée le 17-08-2026.** Mesuré avant de coder, sur une agence de
> 500 biens montée puis effacée : **624 944 → 34 112 octets** et
> **23 → 4 ms**, soit ≈ 1,18 Ko par bien payé à chaque affichage. Le
> scénario ci-dessus (50 × 2 000) n'a pas été monté — extrapolé, il vaut
> ≈ 118 Mo par affichage, et c'est écrit comme un calcul.
>
> **Le nombre affiché ne change pas** : le filtre de corbeille de
> `lib/prisma.ts` ne couvre que le premier niveau, donc ni l'`include` ni
> le `_count`. Vérifié — 0 agence dont le nombre changerait. Qu'un bien en
> corbeille reste compté est `BUG-24`, story 3.5.
>
> Une seule page était concernée, et le balayage le dit. Trois mutations,
> dont une — l'`include` rajouté **à côté** du `_count` — que seul le test
> d'invariant peut voir.

### Story 3.4: Paginer la vitrine publique

As a visiteur,
I want que la vitrine d'une grande agence s'ouvre vite,
So that je ne quitte pas la page avant de l'avoir vue.

**Couvre :** défaut n° 14 (NFR-05) · **Fichier :** `app/vitrine/[slug]/page.tsx:113`

**Acceptance Criteria:**

**Given** les onze listes de l'espace agence sont bornées à 100 lignes par `readPageParams()`
**When** la vitrine est corrigée
**Then** elle applique le même contrat, avec le composant `<Pagination />` déjà écrit

**Given** une agence de mille biens publiés
**When** un robot d'indexation parcourt la vitrine
**Then** chaque page reste de taille bornée, et le sitemap continue de lister tous les biens

> **Livrée le 17-08-2026.** Mesuré sur l'application servie, 300 biens
> publiés avec photo et description : **2 302 954 → 222 231 octets** et
> **399 → 210 ms**, soit ≈ 7,7 Ko par bien servi à chaque visite *et* à
> chaque passage de robot. Avant correction, `?page=2` rendait la page 1 à
> l'octet près : il n'y avait pas une pagination à réparer, il y en avait
> une à poser.
>
> **Le piège n'était pas la lenteur, c'était un nombre.** Le bandeau
> affiche en très gros « N biens disponibles » — l'argument commercial de
> l'agence. Branché sur la liste paginée, il annonçait **25** à toutes les
> agences du produit. Il passe par un `count()` portant le même `where`,
> donc il suit les filtres exactement comme avant.
>
> Deux autres choses sont nées de la pagination et sont traitées :
> `?page=99`, qui n'existait pas, dit maintenant *« cette page n'existe
> pas »* au lieu de mentir ; et chaque page porte son numéro dans son
> titre, faute de quoi les pages 2, 3… seraient du contenu dupliqué
> annoncé à l'identique.
>
> **Le plan du site n'est pas touché**, comme cette AC l'exige — mais le
> balayage a montré qu'il ne tient pas le scénario ci-dessus : 50 × 2 000
> font 100 001 URL pour une limite de 50 000. → `REP-105`, **story 3.12**.

### Story 3.5: Étendre la suppression réversible aux relations

As a agence,
I want que les compteurs affichés correspondent à ce que je vois,
So that « 4 biens » sur la fiche d'un propriétaire ne renvoie pas trois lignes.

**Couvre :** défaut n° 15 (NFR-06), REP-99 · **Fichier :** `lib/prisma.ts:11-27` et 5 appelants

> **REP-99, éprouvé le 15-08-2026 :** `CLAUDE.md` §2 interdit
> `prisma.property|client|owner.delete()` — mais **`deleteMany()` fait la
> même chose et n'est pas nommé**. Un `client.deleteMany()` a emporté une
> location et ses quittances par la cascade `Client → Rental`
> (`schema.prisma:536`). Et **aucune commande ne recense les cascades
> destructives partant des trois modèles à corbeille** : personne ne sait
> dire ce qui tombe quand on supprime un `Client`.

**Acceptance Criteria:**

**Given** les trois modèles à corbeille — `Property`, `Client`, `Owner`
**When** la story est terminée
**Then** une commande de contrôle, **écrite et exécutée**, recense toutes les cascades destructives qui en partent
**And** `deleteMany` est traité comme `delete` partout où la règle s'applique

**Given** un bien supprimé rattaché à un propriétaire
**When** la liste des propriétaires s'affiche
**Then** il n'est pas compté — de même dans l'export CSV, la console super admin et la page statistiques

**Given** l'extension Prisma ne filtre que le premier niveau
**When** la story est terminée
**Then** le commentaire de `lib/prisma.ts` énonce cette limite au lieu de la masquer

**Given** `findUnique` reste hors du filtre
**When** on parcourt le code
**Then** aucun écran de détail ne l'utilise sur `Property`, `Client` ou `Owner`

> **Livrée le 17-08-2026.** Le balayage a trouvé **six** endroits, pas cinq,
> et le sixième — `app/agency/owners/[id]/page.tsx` — **dément l'énoncé du
> défaut** : la fiche n'affichait pas 3 biens là où la liste en annonçait 4,
> elle en affichait 4 elle aussi. Les deux écrans se trompaient du même
> côté. Mesuré, pas déduit.
>
> `REP-99` est soldé sur ses trois enseignements. La règle §2 n'est plus une
> phrase : `.eslintrc.json` refuse `delete`, `deleteMany`, `findUnique` et
> `findUniqueOrThrow` sur les trois modèles, **quel que soit le client**.
> Il a fallu élargir `npm run lint` — `next lint` ignorait `prisma/`,
> `scripts/` et `tests/`, **et c'est dans un script qu'a eu lieu
> l'accident**. L'inventaire des cascades est une commande dérivée du
> schéma, `npm run audit:cascades` : **11 suppressions**, dont
> `Client → Rental → RentalManagement`.
>
> En passant, il a corrigé l'avertissement de la corbeille : il citait
> « photos, visites, historique » et taisait les ventes, les locations et
> les quittances.

### Story 3.6: Corriger robots.txt et le filtre wilaya

As a agence,
I want que ma vitrine soit correctement indexée et que ses filtres ne mentent pas,
So that le module désigné prioritaire tienne sa promesse.

**Couvre :** défauts n° 16 et n° 29 · **Fichiers :** `app/robots.ts`, `app/vitrine/[slug]/page.tsx:114-124`

**Acceptance Criteria:**

**Given** `app/robots.ts` est prérendu pendant `next build` avec l'URL factice du Dockerfile
**When** `export const dynamic = "force-dynamic"` y est ajouté, comme dans `app/sitemap.ts`
**Then** `robots.txt` annonce le sitemap sur le domaine réel

**Given** une wilaya dont tous les biens ont `isAvailable: false`
**When** le menu déroulant du filtre est construit
**Then** elle n'y figure pas — la seconde requête filtre comme la première

> **Livrée le 17-08-2026.** Les deux défauts touchent la même surface mais
> **ne se prouvent pas du tout de la même façon**, et c'est ce qui a fait le
> travail.
>
> `BUG-29` se mesure de bout en bout : le menu se montre lui-même dans le
> message d'échec, `["Toutes", "Alger", "Oran"]`.
>
> `BUG-25`, **la suite ne peut pas le voir** — elle construit et sert avec
> le même environnement, donc l'écart y est structurellement invisible
> (`REP-95`). Il a été reproduit à la main, en construisant avec une adresse
> et en servant avec une autre : `/robots.txt` annonçait
> `construction.invalid` pendant que `/sitemap.xml`, son voisin, disait
> `execution.invalid`. Trois couches posées, dont une étape de
> `npm run verify:deploy` qui compare **les deux fichiers entre eux** — sa
> première version comparait à l'adresse de sonde et échouait sur une
> configuration saine ; le différentiel l'a montré avant qu'elle ne serve.
>
> Le balayage a vérifié la famille de chaque défaut. `metadataBase`
> (`app/layout.tsx`) est le même piège que `BUG-25` — **mesuré : rien n'est
> gelé aujourd'hui**, le produit ne déclare aucune adresse relative. Piège
> dormant documenté sur place, pas de `REP` ouvert pour une hypothèse non
> observée (§7).

---

### Story 3.7: Servir les images à leur poids réel

As a visiteur sur mobile en Algérie,
I want que la vitrine se charge sans attendre plusieurs mégaoctets de photos,
So that je ne quitte pas la page avant de voir les biens.

**Couvre :** NFR-05 · **Fichiers :** les 11 balises `<img>` du projet, `public/images/`

> **C'est le seul levier de fluidité qui reste.** Mesuré : Lighthouse
> mobile donne 89-91 en performance, avec un unique point faible — le LCP
> à 3,5-3,7 s. Tout le reste est excellent (CLS à 0, blocage à 12 ms).
> La cause est isolée : **2,5 Mo de photographies contre 210 Ko de code**.

**Acceptance Criteria:**

**Given** `casbah-patrimoine.jpg` pèse 1 890 Ko et `casbah-interieur.jpg` 637 Ko, servis bruts
**When** la story est terminée
**Then** ils sont servis en format moderne (WebP ou AVIF) et redimensionnés pour l'écran réel
**And** le poids transféré des images d'une page est divisé par cinq au minimum

**Given** le projet compte 11 `<img>` et aucun `next/image`
**When** la conversion est faite
**Then** chaque image passe par `next/image`, avec `width`, `height` et `sizes` renseignés
**And** les images hors du premier écran sont chargées en différé
**And** l'image du bandeau porte `priority`, parce qu'elle *est* le LCP

**Given** le CLS vaut 0 aujourd'hui
**When** on remesure après la conversion
**Then** il vaut toujours 0 — les dimensions déclarées empêchent tout saut de mise en page

**Given** les photos de biens sont téléversées par les agences
**When** elles s'affichent sur la vitrine
**Then** elles bénéficient du même traitement que les images de la marque

**Given** l'objectif
**When** on repasse Lighthouse en profil mobile bridé
**Then** le LCP est sous 2,5 s sur l'accueil **et** sur la vitrine

**Livrée le 17-08-2026 — et l'AC-5 n'est PAS tenue sur l'accueil.**

Poids transféré, émulation Pixel 5 : la vitrine passe de **1 460 à 198 Ko**
(÷ 7,4), les écrans d'authentification de **637 à 64 Ko** (÷ 10), et
l'accueil de **532 Ko à zéro au premier écran** — son image est sous le pli,
elle n'est plus chargée du tout. Page entièrement défilée, l'accueil vaut
÷ 4,8 : sous la barre des cinq, et la photo n'a pas été dégradée davantage
pour atteindre un chiffre rond.

Lighthouse mobile bridé : vitrine **96** en performance, **LCP 2,8 s**,
**CLS 0**. Accueil 91, LCP 3,5 s.

**L'inventaire de cette fiche était faux** : 13 balises image et non 11 —
`grep "<img"` en rate deux, et ce sont **les deux plus lourdes**, les fonds
animés (`motion.img`). 12 sont converties ; la treizième est une URL `data:`
qui n'a jamais traversé le réseau, motif écrit sur place.

**`sharp` a dû être ajoutée** (§2, par délégation) : sans elle, `next/image`
répond **500 en sortie autonome** — lu ligne 665 de `image-optimizer.js`, pas
supposé. Elle est recopiée dans l'image Docker comme le client Prisma, pour
la même raison.

**Deux hypothèses de la story ont été démenties par la mesure**, dont une du
texte de cette fiche : *« l'image du bandeau porte `priority`, parce qu'elle
EST le LCP »* est vrai sur la vitrine et **faux sur l'accueil**, dont le LCP
est un **paragraphe de texte** livré transparent. Aucun travail sur les
images ne pouvait le déplacer. → `REP-107`, story 3.14.

Trois mutations, **dont deux passées au vert** : l'une a révélé un trou dans
le test (assertion ajoutée), l'autre que le code venait d'être écrit pour
rien (code retiré). **195 passed.**

### Story 3.9: Rattraper l'enfant dont le parent part à la corbeille

As a agent,
I want qu'enregistrer une visite sans rien y changer ne la rattache pas à un autre bien,
So that corriger une heure ne réécrive pas silencieusement l'historique d'un dossier.

**Couvre :** défaut n° 34 (BUG-34) · **Fichiers :** `app/agency/{visits,sales,rentals,payments}/[id]/edit/page.tsx`, `app/agency/properties/[id]/edit/page.tsx`, un fichier de test

> **Ajoutée le 12 août 2026**, par la revue de code de la story 4.6, et
> **reproduite sur l'instance le jour même** : une visite a changé de bien
> parce qu'un agent a cliqué « Enregistrer » sans rien modifier.
>
> **ELLE PASSE AVANT LE RESTE DE L'ÉPOPÉE 3 ET AVANT LA STORY 4.5**, pour
> la raison qui a déjà fait passer la 4.6 avant la 4.5 : l'une ferme une
> corruption de données possible, l'autre améliore la testabilité. Et elle
> partage la barrière de l'épopée 1 — le geste qui la déclenche est celui
> d'un utilisateur ordinaire corrigeant un détail, pas une manœuvre.
>
> **Un arbitrage produit est requis AVANT le code** — voir l'AC 1.

**Acceptance Criteria:**

**Given** un bien mis à la corbeille et une visite qui le référence
**When** un agent ouvre l'écran d'édition de cette visite et enregistre **sans rien modifier**
**Then** la visite référence toujours le même bien après l'enregistrement

**Given** trois issues possibles — conserver le parent en corbeille dans la liste en option désactivée, refuser l'enregistrement, ou empêcher la mise à la corbeille d'un parent ayant des enfants vivants
**When** la story démarre
**Then** l'arbitrage est rendu et **écrit dans la story** avant toute ligne de code
**And** la recommandation portée au registre — conserver le parent, étiqueté « en corbeille » — est soit retenue, soit écartée avec son motif

**Given** cinq écrans d'édition portent une liste alimentée par un modèle à suppression réversible
**When** la story est terminée
**Then** les cinq sont traités : `visits`, `sales`, `rentals`, `payments` (bien, client, propriétaire) et `properties` (propriétaire)
**And** l'inventaire de ces couples écran → champ est écrit, comme l'a été celui des Server Actions destructives

**Given** aucun test n'éprouve aujourd'hui « ouvrir puis enregistrer sans rien changer »
**When** la story est terminée
**Then** ce geste est couvert sur les cinq écrans
**And** la couverture est prouvée par mutation

**Given** les écrans de création n'ont pas de `defaultValue`
**When** la story est terminée
**Then** ils ne sont pas modifiés : ils ne sont pas concernés, et l'écrire évite qu'on les touche par symétrie

---

### Story 3.8: Indexer ce que les listes trient réellement

As a agence qui grandit,
I want que mes listes restent rapides à dix mille lignes,
So that le succès ne dégrade pas l'outil.

**Couvre :** NFR-05 · **Fichier :** `prisma/schema.prisma` + une migration

> Constaté par `EXPLAIN` : le parcours d'index sur `agency_id` est bien
> utilisé — c'est la bonne propriété, et elle est acquise — mais il est
> suivi d'un nœud `Sort`, parce qu'aucun index ne couvre le tri.

**Acceptance Criteria:**

**Given** toutes les listes trient par `createdAt desc` après avoir filtré sur `agencyId`
**When** les index composites sont posés
**Then** `EXPLAIN` ne montre plus de nœud `Sort` sur ces requêtes

**Given** les tables concernées — `Property`, `Client`, `Owner`, `Visit`, `Sale`, `Rental`, `Payment`, `Lead`
**When** la migration est écrite
**Then** chacune reçoit l'index composite correspondant à son tri réel, pas un index par colonne

**Given** un index ne sert que s'il est utilisé
**When** la migration est appliquée
**Then** les index simples devenus redondants sont retirés — un index inutile ralentit chaque écriture

**Given** la recherche textuelle reste un balayage (`ILIKE '%terme%'`)
**When** la story est terminée
**Then** ce plafond est documenté dans `docs/architecture.md` avec le seuil observé et la parade
(`pg_trgm` + index GIN) — **sans l'implémenter** : ce n'est pas encore le moment

---

### Story 3.10: Durcir la reprise d'un parent en corbeille

As a agent,
I want que la reprise d'un parent supprimé soit fiable dans tous les cas,
So that le correctif de la story 3.9 ne laisse pas de bord non traité.

**Couvre :** REP-03 à REP-07, REP-14 · **Fichiers :** `lib/corbeille.ts`, les cinq écrans d'édition

> Les six constats laissés par la revue de la story 3.9 : restauration entre
> les deux requêtes, `deletedAt` optionnel dans le type — donc un futur
> écran qui l'oublie n'étiquette rien et compile —, ordre de la liste,
> requête superflue quand le parent est vivant, et la suppression d'une
> échéance déjà réglée.

**Livrée le 17-08-2026.** `REP-03`, `04`, `05`, `06`, `07` et `14` soldés,
aucun constat ouvert.

Ce qui a fait la story : **`REP-03`, `06` et `07` ne sont pas trois
défauts.** Ce sont trois symptômes d'un même choix — avoir bâti la liste en
**deux requêtes** puis recollé le résultat en mémoire. Une requête unique
les ferme ensemble, et en **supprime** une par parent (trois sur l'écran des
paiements) au lieu d'en ajouter une.

**Le piège, mesuré avant d'écrire la ligne :** la forme naturelle
`OR: [{ deletedAt: null }, { id: courant }]` **ne marche pas**. L'extension
de `lib/prisma.ts` teste `"deletedAt" in where` au **premier niveau
seulement** ; la clef du `OR` est imbriquée, `deletedAt: null` est donc
ajouté *à côté*, les deux sont ET-és, et le parent en corbeille ne revient
pas. Le correctif aurait compilé et été faux à l'exécution.

`REP-04` ferme la **famille** et non la cause : l'option manquante est
fabriquée quelle qu'en soit la raison, et l'enregistrement est **refusé** au
lieu de réécrire un lien en silence. `REP-05` rend `deletedAt` requis :
l'oubli devient une erreur de compilation. `REP-14` a été **tranché —
refuser** ; la confirmation comme troisième issue appartient à la story 3.13.

Six mutations séparées, six rouges. **180 passed** (176 avant).

---

### Story 3.11: Réparer les liens déjà réécrits

As a éditeur,
I want savoir quelles lignes BUG-34 a corrompues avant de les corriger,
So that la réparation ne repose pas sur une supposition.

**Couvre :** REP-01, REP-02 · **Fichiers :** `docs/qa/detection-bug-34.sql`, `app/agency/{sales,rentals}/[id]/edit/page.tsx`

> La requête de détection existe déjà et a été éprouvée sur une victime
> fabriquée (`docs/qa/detection-bug-34.sql`). Ce qui reste : **la passer sur
> la production**, décider du sort des lignes remontées — les corriger
> d'office supposerait de savoir quelle valeur était la bonne, ce que seule
> l'agence sait — et fermer REP-02, `sale.ownerId` / `rental.ownerId` étant
> réécrits par un enregistrement à vide.
>
> **Une visite réécrite reste indétectable** : `visits` n'a aucune colonne
> redondante. La story doit assumer cette limite par écrit, pas la masquer.

**Travaillée le 18-08-2026 — et elle reste `in-progress`.** `REP-02`,
`BUG-39` et `BUG-40` sont fermés ; **`REP-01` relève de l'éditeur** et rien
ne me permet de le faire à sa place.

**`REP-02` en cachait un plus grave, sur la même ligne.**
`data.ownerId ?? property.ownerId` : à gauche du `??`, le propriétaire
recalculé à chaque enregistrement ; **à droite**, les deux schémas
acceptaient `ownerId` sans que personne ne le vérifie contre l'agence. Un
POST forgé rattachait la vente au propriétaire d'une **autre agence**, dont
le nom ressort dans le contrat PDF, la gestion locative et l'export CSV.
**Reproduit** : l'action a répondu « Vente mise a jour ». C'est `BUG-39`.

**`BUG-40` a été trouvé par un rouge d'un tout autre sujet.**
`toDateInputValue()` convertissait en UTC des dates écrites à **minuit
local** : le formulaire affichait la veille, et enregistrer l'écrivait. Une
visite reculait d'un jour sans que personne ne touche au champ — la famille
de `BUG-34`, sur une date. **En UTC pur le défaut est invisible** ; il se
voit tous les jours depuis Alger.

Cinq mutations, cinq rouges. **201 passed.**

### Story 3.12: Borner le plan du site

As a éditeur,
I want que le plan du site reste lisible par les moteurs quand la
plateforme grandit,
So that la vitrine ne redevienne pas invisible au moment précis où elle
compte le plus.

**Couvre :** `REP-105` · **Fichier :** `app/sitemap.ts`

**Ouverte le 17-08-2026 par la story 3.4**, dont l'AC-2 nomme un scénario
que ce fichier ne tient pas : *50 agences de 2 000 biens* produit
**100 001 URL**, soit le double de la limite de 50 000 qu'un fichier de
plan unique peut porter. Au-delà, les moteurs l'ignorent — et c'est
exactement ce que ce plan existe pour empêcher.

**Acceptance Criteria:**

**Given** `app/sitemap.ts` charge aujourd'hui tous les biens de toutes les
agences dans un seul fichier
**When** la correction est appliquée
**Then** le plan devient un **index** renvoyant vers des fichiers
partiels, chacun sous la limite

**Given** une base dépassant la limite
**When** un robot demande `/sitemap.xml`
**Then** il obtient l'index, et chaque partie reste servie et valide

**Given** une base de taille ordinaire
**When** un robot demande `/sitemap.xml`
**Then** rien ne change pour lui — l'index d'un seul fichier reste valide

> ⚠ **Le constat n'est pas mesuré, et la story doit commencer par là.**
> Aucune base de ce dépôt n'approche ces volumes ; le seuil de 50 000 est
> une limite documentée par les moteurs, pas une valeur observée ici. La
> story 3.4 l'a établi par lecture et par le calcul de son propre scénario.

**Livrée le 17-08-2026.** `REP-105` soldé, aucun constat ouvert.

**Elle a commencé par la mesure qui manquait**, comme l'avertissement
ci-dessus l'exigeait : la base porte **43 vitrines publiées et 4 biens
publiés — 48 URL**, soit 49 952 de marge. Le défaut est **entièrement
prospectif**, et c'est désormais un chiffre plutôt qu'une lecture. La limite
a été vérifiée à sa source (`sitemaps.org/protocol.html`).

**Une seconde mesure a décidé de la forme du correctif** : à ~190 octets par
entrée, une tranche de 45 000 pèse 8 à 9 Mo — **six fois sous** le plafond
de 50 Mo. C'est le **nombre d'URL** qui borne, pas le poids ; il aurait été
facile de s'attaquer au mauvais des deux.

`/sitemap.xml` est devenu un `<sitemapindex>` renvoyant vers
`/sitemap/agences-N.xml` et `/sitemap/biens-N.xml`. **`app/sitemap.ts` a dû
être retiré** : la convention de métadonnées de Next ne sait produire qu'un
`<urlset>`, et son `generateSitemaps()` laisse `/sitemap.xml` en **404** —
lu dans le code du chargeur, pas supposé.

Sept mutations séparées, sept rouges — dont **trois d'abord muets**, sur des
`toEqual` anonymes : les messages ont été écrits, puis les mutations
rejouées. **187 passed** (180 avant), `verify:deploy` rejoué à **0**.

### Story 3.13: Faire confirmer ce qui détruit onze tables

As a agence,
I want qu'une destruction irréversible me soit confirmée avant d'être faite,
So that un clic mal placé ne m'enlève pas des quittances de loyer.

**Couvre :** REP-106 · **Fichiers :** `app/agency/trash/page.tsx`, un composant de confirmation à créer

> **Le constat vient d'une mesure produite par la story 3.5.**
> `npm run audit:cascades` recense **11 suppressions en cascade** partant
> des trois modèles à corbeille. Détruire un `Client` emporte ses visites,
> ses ventes, ses locations **et les quittances de celles-ci**. Le bouton
> qui déclenche cela est un simple envoi de formulaire : **aucune
> confirmation, nulle part dans le produit** (`rg 'window.confirm|
> AlertDialog'` → aucun résultat).
>
> La story 3.5 a rendu l'avertissement honnête — il taisait les ventes, les
> locations et les quittances. **Un avertissement n'est pas un garde-fou** :
> il est sous le tableau, le bouton est dans la ligne.

**Livrée le 17-08-2026.** `REP-106` soldé, aucun constat ouvert.

**L'arbitrage porte sur le périmètre**, et il a été rendu par délégation :
**pas de champ de confirmation côté serveur.** Il n'arrêterait ni
l'accident — que le dialogue traite — ni un administrateur décidé, que
`requireAgencyAdmin()` a déjà autorisé. Ce serait un garde-fou en
trompe-l'œil : exactement le reproche fait à l'avertissement d'origine. Un
test **rejoue `purge` sans l'écran** et constate qu'elle aboutit ; il
documente au lieu de laisser croire à une garde.

**Ce qui fait la différence : le dialogue chiffre.** Pas « êtes-vous
sûr ? », pas « et tout ce qui en dépend » — mais *« 1 visite, 1 vente, 1
location et 1 quittance de loyer »*, lus en base. Détruit et détaché sont
dits séparément, et les tables sont **par nature** : une vente rattachée à
un client est détruite avec lui, la même rattachée à un propriétaire survit
en perdant son bailleur.

**Aucune dépendance ajoutée** — `AlertDialog` n'est pas installé, `Dialog`
si. §8 : le déclencheur devenant un `button`, la corbeille serait devenue
impossible à vider **sans JavaScript** ; un `<noscript>` rend ce chemin.

Six mutations séparées, six rouges — dont **deux d'abord muets**, l'un à
4 min 24 de délai dépassé : assertions ajoutées, mutations rejouées.
**192 passed** (187 avant).

**Acceptance Criteria:**

**Given** un élément à la corbeille
**When** l'utilisateur clique sur « Détruire »
**Then** une confirmation lui est demandée, et elle **nomme ce qui tombera** — pas un « êtes-vous sûr ? » générique

**Given** cette confirmation
**When** elle est refusée ou fermée
**Then** rien n'est détruit, et le test le prouve en relisant la ligne par le client **non filtré** (`tests/db.ts`)

**Given** que le mécanisme de confirmation n'existe nulle part dans le produit
**When** il est créé
**Then** il est un composant réutilisable, et la story dit lesquelles des autres actions destructives devraient l'adopter — sans les modifier

**Given** la règle §6, piège 4 — une Server Action se rejoue, elle ne se clique pas
**When** le test est écrit
**Then** il prouve que la confirmation garde le **rendu**, et un second cas rejoue `purge` sans passer par l'écran pour dire ce que la confirmation ne protège pas

---

### Story 3.14: Rendre l'accueil visible avant son JavaScript

As a visiteur qui arrive sur l'accueil,
I want voir la page sans attendre que son JavaScript s'exécute,
So that le premier écran du produit ne dépende pas d'un téléphone rapide.

**Couvre :** `REP-107` · **Fichiers :** `components/landing/HeroSection.tsx`, les autres sections animées de l'accueil

**Ouverte le 17-08-2026 par la story 3.7**, qui a dû abandonner une
hypothèse pour la trouver. Le LCP de l'accueil **n'est pas une image** :
c'est un paragraphe, livré avec `opacity: 0` dans le HTML — Framer écrit les
valeurs de `initial` dans le style rendu par le serveur.

```
PerformanceObserver, Slow-4G + processeur ×4
  /vitrine/agence-demo  ->  IMG, le fond du bandeau     1 856 ms
  /                     ->  <p class="mt-7 max-w-lg…">   3 500 ms

curl / | grep -o 'opacity:0' | wc -l                ->  34
curl /vitrine/… | grep -o 'opacity:0' | wc -l       ->   0
```

Lighthouse donne **LCP 3,459 s pour un TTI de 3,459 s** : la page ne
s'affiche pas tant qu'elle n'est pas interactive.

> ⚠ **Un arbitrage produit est requis AVANT le code.** L'entrée en fondu
> échelonnée *est* le parti pris visuel de cette page. Deux issues : la
> garder et accepter le LCP, ou faire peindre le texte d'emblée et n'animer
> que la décoration. Le remède technique existe déjà dans le dépôt —
> `AnimatePresence initial={false}`, qui met la vitrine à l'abri — mais il
> ne dit pas lequel des deux on veut.

**Acceptance Criteria:**

**Given** le HTML servi de `/` porte 34 fois `opacity:0`
**When** l'arbitrage est rendu et écrit dans la story
**Then** le premier écran est lisible sans exécuter une ligne de JavaScript
**And** le nombre d'`opacity:0` servis est mesuré avant et après

**Given** l'accueil et la vitrine
**When** on remesure au `PerformanceObserver`, réseau et processeur bridés
**Then** l'élément LCP et son instant sont écrits pour les deux pages
**And** le LCP de l'accueil passe sous 2,5 s — ou le motif de son échec est mesuré, comme l'a fait la story 3.7

**Given** la vitrine, qui est déjà exempte
**When** la correction est appliquée
**Then** elle ne régresse pas — `tests/images.spec.ts` garde déjà ce point sans JavaScript

**Livrée le 17-08-2026.** `REP-107` soldé, aucun constat ouvert.

**L'arbitrage tient en une règle** : *on n'anime pas l'entrée de ce qui est
déjà à l'écran ; on anime l'entrée de ce qui y arrive.* La chorégraphie du
premier écran est **inchangée** — mêmes délais, mêmes durées, même courbe —
mais elle est jouée en CSS, donc dès le premier rendu. Les sections d'en
dessous gardent Framer : déclenchées au défilement, elles ne retardent
aucun affichage.

**Règle 8 (§12) est tenue**, et c'est dit explicitement : Framer reste la
bibliothèque d'animation du produit. Ce qui change est le **moment** d'une
seule séquence, pour une raison qui n'est pas un goût — aucune animation
pilotée par un script ne peut commencer avant l'hydratation.

`opacity:0` servis sur `/` : **34 → 21**. LCP en mesure directe :
**3 500 → 1 556 ms**. ⚠ Lighthouse, qui *simule*, dit 3,17 s et reste collé
à son TTI : **les deux méthodes ne s'accordent pas, et l'écart est écrit**
plutôt que tranché.

**Deux défauts trouvés en chemin.** `CountUp` rendait `0` côté serveur :
sans JavaScript, la page annonçait « **0** modules métier » — pas une page
vide, une page **fausse**, y compris pour les robots d'indexation. Et le
bloc `prefers-reduced-motion` coupait la durée des animations mais pas le
**délai**, ce qui ne supprime pas le mouvement mais le remplace par une
attente.

Deux mutations, deux rouges. **197 passed.**

---

## Epic 4: Reprendre la suite de tests

Un premier défaut au registre, et c'est celui qui conditionne la confiance
dans tous les autres correctifs. Dix-sept cas de test annoncent tester le
parcours authentifié et vérifient en réalité la redirection vers l'écran
de connexion.

Un second s'y est ajouté le 12 août 2026 : en couvrant la séparation des
rôles, la story 4.3 a montré ce que la suite ne regardait pas — et une
relecture des 31 Server Actions a trouvé cinq suppressions sans contrôle
de rôle, dont une définitive et en cascade (**story 4.6**, défaut n° 32).
C'est le rendement propre d'une épopée de tests : elle ne se contente pas
de couvrir ce qui marche, elle désigne ce qu'on n'avait jamais regardé.

**Cette épopée devrait passer avant l'épopée 3.**
Module BMAD utile : `bmad-tea` (Murat), et les skills `bmad-testarch-*`.

### Story 4.1: Supprimer les tests trompeurs

As a développeur,
I want que le nom d'un test décrive ce qu'il vérifie,
So that une suite verte veuille dire quelque chose.

**Couvre :** défaut n° 19 (NFR-07) · **Fichiers :** `tests/{documents,payments,rentals,sales,visits,clients,properties,admin}.spec.ts`, `tests/api-upload.spec.ts`

**Acceptance Criteria:**

**Given** dix-sept cas nommés « … when authenticated » qui ne se connectent jamais
**When** la story est terminée
**Then** chacun soit se connecte réellement via `tests/auth-helper.ts`, soit est supprimé

**Given** `api-upload.spec.ts` teste « should reject invalid file types » sans session
**When** il est corrigé
**Then** il ouvre une session et vérifie bien le refus de type, pas le 401

**Given** la suite complète
**When** elle est exécutée
**Then** aucun cas ne vérifie une assertion contraire à son propre nom

### Story 4.2: Couvrir le cloisonnement inter-agences

As a éditeur,
I want qu'un test échoue si une agence peut voir les données d'une autre,
So that la propriété la plus critique du produit soit protégée par autre chose qu'une relecture.

**Couvre :** lacune NFR-07 · **Nouveau fichier :** `tests/tenancy.spec.ts`

**Acceptance Criteria:**

**Given** deux agences actives avec chacune un bien, un client et un document
**When** un compte de l'agence A demande une ressource de l'agence B — page de détail, export, PDF, suppression
**Then** il obtient 404 ou une redirection, jamais la donnée

**Given** les cinq routes PDF et les huit exports
**When** le test s'exécute
**Then** chacun est couvert au moins une fois

**Given** le jeu de démonstration ne contient qu'une agence exploitable
**When** le test est écrit
**Then** il crée sa propre seconde agence, et la nettoie en fin de parcours

### Story 4.3: Couvrir la séparation des rôles

As a administrateur d'agence,
I want qu'un agent ne puisse pas exécuter les actions qui me sont réservées,
So that la règle appliquée dans le code soit vérifiée en continu.

**Couvre :** lacune NFR-07 · **Nouveau fichier :** `tests/roles.spec.ts`

**Acceptance Criteria:**

**Given** un compte `agent`
**When** il tente une suppression, l'accès aux paramètres de l'agence ou la création d'un compte
**Then** il est refusé, avec le message français prévu

**Given** un `agency_admin`
**When** il tente de créer un `super_admin`
**Then** l'opération est refusée

**Given** le dernier `agency_admin` actif d'une agence
**When** on tente de le désactiver ou de le rétrograder
**Then** l'opération est refusée

### Story 4.4: Verrouiller les correctifs de l'épopée 1

As a développeur,
I want qu'un test échoue si une régression ramène un défaut critique,
So that la remise en état soit acquise et non reprise à zéro dans six mois.

**Couvre :** consolidation NFR-07

**Acceptance Criteria:**

**Given** chaque story close de l'épopée 1
**When** on cherche sa couverture
**Then** il existe au moins un test qui échoue si le défaut revient

**Given** les défauts n° 01, 02, 04, 06 et 07
**When** les tests s'exécutent
**Then** casse de casse d'email, lecture de document sans session, en-tête `X-Forwarded-For` forgé, cellule CSV commençant par `=` et clé de suppression contenant `..` sont tous couverts

---

### Story 4.5: Extraire une couche métier testable

As a développeur,
I want que les règles de gestion vivent ailleurs que dans les composants d'écran,
So that je puisse les vérifier sans navigateur et les réutiliser ailleurs.

**Couvre :** NFR-07, NFR-11

> **Le moment compte.** Ni avant l'épopée 4 — vous n'auriez pas de filet
> pour bouger du code. Ni après — vous auriez écrit les tests contre
> l'ancienne structure et il faudrait les refaire. **Pendant** : chaque
> story de test devient l'occasion de sortir une règle de l'écran, et le
> test s'écrit alors sur une fonction.
>
> Constat qui motive cette story : 40 Server Actions déclarées à
> l'intérieur de 27 composants de page, jusqu'à 506 lignes dans
> `app/agency/users/page.tsx`, 62 `revalidatePath` dispersés, et **aucune
> couche service**. Rien ne casse aujourd'hui ; le coût d'extraction
> augmente à chaque module ajouté.

**Acceptance Criteria:**

**Given** aucun dossier de services n'existe
**When** la story est terminée
**Then** `lib/services/` existe, et les règles de gestion d'au moins **trois modules** y ont été déplacées
**And** les Server Actions des pages concernées se réduisent à : garder, valider, appeler le service, revalider, rediriger

**Given** une règle de gestion déplacée
**When** on veut la vérifier
**Then** un test l'exerce directement, sans passer par un navigateur

**Given** le cloisonnement multi-locataire est la propriété critique
**When** un service est écrit
**Then** il **reçoit** `agencyId` en paramètre explicite et ne le déduit jamais lui-même de la session — la garde reste dans la page, la règle dans le service

**Given** le projet n'a ni Vitest ni Jest installé
**When** le premier test de service est écrit
**Then** un exécuteur de tests unitaires a été ajouté et documenté dans `README.md`

**Given** les onze modules CRUD partagent le même motif
**When** l'extraction des trois premiers est faite
**Then** le motif retenu est écrit dans `docs/architecture.md`, pour que les huit suivants ne l'inventent pas différemment

**Given** le reste du projet n'est pas migré
**When** la story se termine
**Then** c'est assumé et tracé : l'extraction est **incrémentale**, module par module, pas une refonte

### Story 4.6: Fermer la suppression directe des écrans d'édition

As a administrateur d'agence,
I want que la règle « un agent ne supprime pas » s'applique sur tous les chemins et pas seulement sur ceux qui ont une route d'API,
So that une permission trop large ne détruise pas un historique que rien ne pourra rendre.

**Couvre :** défaut n° 32 (BUG-32), NFR-07 · **Fichiers :** `app/agency/{properties,visits,payments,rental-management}/[id]/edit/page.tsx`, `app/agency/interactions/actions.ts`, `tests/roles.spec.ts`

> **Ajoutée le 12 août 2026**, hors des deux audits du 9 août. Elle est
> ici — dans l'épopée des tests, et non dans l'épopée 3 ou 5 — pour trois
> raisons : c'est la story 4.3 qui aurait dû l'attraper, son test de
> non-régression va dans le fichier que la story 4.3 vient de créer, et
> l'épopée 4 a déjà accepté de « poser le garde qui manquait » en même
> temps qu'elle le couvrait.
>
> **À MENER AVANT LA STORY 4.5.** L'extraction d'une couche métier est un
> chantier de confort ; celui-ci est une perte de données possible, et
> l'épopée 0 n'étant pas commencée, il n'existe aucune sauvegarde d'où
> revenir.

> **Un arbitrage produit est requis AVANT le code**, sur deux des cinq
> actions — voir l'AC 4. Les trois autres ne demandent rien : la règle est
> déjà écrite dans leur route d'API homologue.

**Acceptance Criteria:**

**Given** un compte `agent` de l'agence, et un bien, une visite et un paiement de cette même agence
**When** il soumet la Server Action de suppression de l'écran d'édition — **directement en `POST`, sans passer par l'interface**
**Then** l'action est refusée exactement comme l'est déjà `POST /api/{properties,visits,payments}/[id]/delete`
**And** la ligne visée existe toujours en base après le refus

**Given** un `agency_admin` qui supprime un **bien** depuis l'écran d'édition
**When** l'opération aboutit
**Then** le bien part **à la corbeille** (`deletedAt`) et non en suppression définitive, comme le fait déjà la route d'API
**And** il est restaurable depuis `/agency/trash`
**And** ses photos, visites, ventes, baux et échéanciers de gestion locative sont toujours en base

**Given** l'une quelconque des cinq suppressions, effectuée par un compte autorisé
**When** elle aboutit
**Then** une ligne est écrite dans `AuditLog` via `recordAudit()`, comme le font les huit routes d'API

**Given** la fiche de gestion locative et l'interaction n'ont **aucune route d'API homologue** — donc aucune règle déjà tranchée
**When** la story démarre
**Then** l'arbitrage est rendu et **écrit dans cette story** avant d'écrire du code : qui peut supprimer une échéance de loyer, et qui peut supprimer une ligne d'historique de contact
**And** la recommandation portée au registre — administrateur pour l'échéance, agent pour l'interaction mais journalisée — est soit retenue, soit écartée avec son motif

**Given** le bouton « Supprimer » est aujourd'hui rendu sans condition au bas de ces écrans
**When** la story est terminée
**Then** il n'est rendu qu'aux comptes qui peuvent réellement l'actionner
**And** cacher le bouton n'est **jamais** la seule mesure : le refus est prouvé côté serveur par l'AC 1

**Given** `tests/roles.spec.ts` couvre les huit routes de suppression et les cinq écrans réservés
**When** la story est terminée
**Then** il couvre aussi les cinq Server Actions de suppression des écrans d'édition
**And** la couverture est prouvée par mutation : en retirant le garde ajouté, le test rougit

**Given** l'angle mort qui a produit ce défaut est structurel — une garde absente ne se voit pas dans le fichier qui devrait la porter
**When** la story se termine
**Then** l'inventaire des Server Actions destructives et de leur garde est écrit dans `docs/architecture.md`, pour que le prochain écran ajouté se compare à une liste et non à une intuition

---

### Story 4.7: Refondre le harnais de test

As a développeur,
I want une suite rapide, qui nettoie ses décors et qui ne ment pas sur ce qu'elle couvre,
So that les seize constats accumulés sur le harnais cessent de coûter à chaque story.

**Couvre :** REP-16, 17, 30, 31, 43, 44, 48, 49, 54, 58, 59, 61, 66, 67, 69, 71, 95, 97, 98 (19 constats) · **Fichiers :** `playwright.config.ts`, `tests/**`

> **Le plus gros gisement de constats orphelins du dépôt.** Ils disent tous
> la même chose sous dix-neuf formes : la suite se reconnecte à chaque cas
> (bcrypt coût 12), n'efface pas ses décors, déclare cinq navigateurs dont
> quatre ne tournent jamais, reconstruit l'application pour lire un fichier,
> s'appuie encore huit fois sur `networkidle` — qui a déjà masqué une Server
> Action en vol —, et **n'exerce aucune topologie de déploiement** (REP-95,
> l'angle mort par lequel BUG-36 a vécu invisible).
>
> **La fuite de décors s'aggrave, et c'est mesuré.** Elle était de
> **164 agences** au 13-08-2026 ; elle était de **271** au 15-08, dont
> **268 résidus** pour 2 agences de graine et 1 inscription réelle
> (nettoyées à la main ce jour-là). Environ **quatre agences par exécution
> complète**. La console `/admin/agencies` les charge **toutes**, avec leurs
> comptes et leurs biens, sans pagination.

**Acceptance Criteria:**

**Given** chaque cas ouvre une à trois sessions
**When** la story est terminée
**Then** un projet de préparation enregistre un `storageState` par rôle, réutilisé partout

**Given** la base accumule environ quatre agences par exécution complète — 271 au 15-08-2026, dont 268 résidus
**When** la story est terminée
**Then** tout décor créé est effacé par `afterEach` — jamais par `finally`, qu'un dépassement de délai n'exécute pas
**And** une exécution complète laisse la base au même compte d'agences qu'avant, vérifié par une mesure et non par relecture

**Given** un cas tombe sous charge parallèle sans qu'aucune assertion n'échoue (REP-97, `read ECONNRESET` sur `POST /api/auth/register`)
**When** la story est terminée
**Then** deux exécutions complètes consécutives passent sans faux rouge

**Given** `playwright.config.ts` déclare cinq navigateurs dont quatre ne sont jamais exécutés
**When** la story est terminée
**Then** la liste dit la vérité : les moteurs sont installés, ou la liste est réduite et le choix écrit

### Story 4.8: Prouver que les modules métier fonctionnent

As a éditeur,
I want qu'un test échoue si une fonctionnalité du produit cesse de fonctionner,
So that « 147 cas verts » veuille enfin dire « le produit marche » et pas seulement « le produit est cloisonné ».

**Couvre :** `REP-104` · **Fichiers :** `tests/metier.spec.ts` *(nouveau)*, `tests/agence.ts`

> **Le constat est MESURÉ, pas déduit — 17-08-2026.** Les neuf actions de
> création du produit ont été neutralisées **en même temps** (`tsc` 0,
> `lint` 0 erreur, pour que le rouge ne puisse pas venir du build — §6,
> piège 3), puis la suite complète relancée. Résultat :
>
> | Module | La suite s'en aperçoit-elle ? | Qui l'attrape |
> |---|---|---|
> | `properties` | ✅ | `plafonds.spec.ts` |
> | `documents` | ✅ | `regression.spec.ts` |
> | `owners` | ✅ | `roles.spec.ts` *(contrôle positif)* |
> | `clients` | ❌ | — |
> | `sales` | ❌ | — |
> | `rentals` | ❌ | — |
> | `rental-management` | ❌ | — |
> | `payments` | ❌ | — |
> | `visits` | ❌ | — |
>
> **Six modules sur neuf peuvent être entièrement cassés sans qu'un seul
> des 147 cas ne bronche.** Vérifié isolément d'abord, sur `clients` :
> création neutralisée, l'écran annonçant toujours « Client créé » —
> **147 passed**.
>
> **La cause est structurelle, pas un oubli.** `tests/agence.ts` monte ses
> décors par `db.owner.create`, `db.property.create`, `db.client.create`…
> — **directement en base**, sans traverser une seule Server Action. La
> suite éprouve donc admirablement ce qu'on peut LIRE et ce qu'on ne peut
> PAS lire ; elle n'éprouve presque rien de ce qu'on peut ÉCRIRE. C'est
> cohérent avec son histoire : elle est née des épopées 1 et 4, qui
> portaient sur la sécurité.
>
> ⚠ **Cette story ne prouvera pas que le produit est correct.** Elle
> prouvera qu'il n'est pas MORT. Un formulaire qui enregistre le mauvais
> montant passera dessous ; c'est l'épopée 3 qui traite la justesse.

**Acceptance Criteria:**

**Given** les six modules sans couverture de création
**When** la story est terminée
**Then** chacun a un aller-retour complet **à travers le produit** — formulaire relevé, action rejouée, ligne vérifiée en base — et non un décor injecté par `db.*.create`

**Given** qu'un test de création peut passer en ne créant rien si l'assertion est mal posée
**When** chaque cas est écrit
**Then** il est **prouvé par mutation** : la création du module est neutralisée, le cas doit rougir, et le message d'échec doit **nommer le module** — pas une assertion voisine

**Given** que `lint` tombe en erreur dès qu'une mutation rend un import inutilisé, ce qui ferait échouer le build et non le test (§6, piège 3)
**When** la mutation est jouée
**Then** `npx tsc --noEmit` et `npm run lint` sont **relancés et verts** avant d'interpréter le rouge

**Given** qu'un module cassé aujourd'hui rendrait son cas rouge dès la première exécution
**When** cela se produit
**Then** ce n'est **pas** un test à ajuster : c'est un défaut, inscrit en `BUG-nn` dans `docs/qa/bug-report.md`

**Given** REP-97 — la suite lâche environ un cas par exécution sous charge parallèle
**When** la story est terminée
**Then** deux exécutions consécutives sont vertes, ou l'instabilité est **nommée et chiffrée** plutôt que relancée jusqu'au vert

---

## Epic 5: Dette technique et lisibilité produit

Neuf défauts qui ne bloquent rien, mais dont chacun coûtera un jour plus
cher qu'il ne coûte aujourd'hui. Une story contient un **arbitrage
produit** qui n'appartient pas au développeur.

### Story 5.1: Arbitrer le dépannage par le super admin

As a éditeur,
I want décider si un super admin peut entrer dans une agence,
So that le code cesse de décrire une capacité qui n'existe pas.

**Couvre :** défaut n° 20 · **Fichier :** `lib/auth-guard.ts:78-88`

> ⚠️ **Décision produit préalable.** Ne pas coder avant qu'elle soit
> prise. Passer par `bmad-agent-pm` (John) si l'arbitrage n'est pas
> évident.

**Acceptance Criteria:**

**Given** deux options — retirer la branche morte, ou implémenter réellement le dépännage avec endossement et journalisation
**When** la décision est prise
**Then** elle est inscrite dans `docs/architecture.md` avec sa justification, et l'action correspondante est close dans `docs/stories/sprint-status.yaml`

**Given** l'option « retirer »
**When** elle est appliquée
**Then** le commentaire et la branche `super_admin` disparaissent, et un super admin suivant un lien `/agency/...` reçoit une explication au lieu de l'écran de connexion

**Given** l'option « implémenter »
**When** elle est appliquée
**Then** l'endossement est tracé par `recordAudit()` et visible dans le journal de l'agence concernée

### Story 5.2: Traiter les collisions d'unicité à l'inscription

As a visiteur qui s'inscrit,
I want un message clair plutôt qu'une erreur serveur,
So that je sache quoi corriger.

**Couvre :** défaut n° 22 · **Fichier :** `app/api/auth/register/route.ts:78-134`

**Acceptance Criteria:**

**Given** deux inscriptions concurrentes avec la même adresse
**When** la seconde lève `P2002`
**Then** la réponse est 400 avec un message nommant le champ en conflit, pas 500

**Given** les trois contraintes uniques exposées — `User.email`, `Agency.email`, `Agency.slug`
**When** l'une d'elles est violée
**Then** chacune produit son propre message

### Story 5.3: Vérifier la taille du fichier avant de l'envoyer

As a agent sur une connexion lente,
I want être prévenu tout de suite qu'un fichier est trop lourd,
So that je n'attende pas plusieurs minutes pour une erreur connue d'avance.

**Couvre :** défaut n° 23 · **Fichier :** `components/upload/UploadDropzone.tsx`

**Acceptance Criteria:**

**Given** la propriété `maxSize` ne sert aujourd'hui qu'à composer le texte « Max 5MB »
**When** un fichier dépasse cette taille
**Then** il est refusé localement, avant le `fetch`, avec un message

**Given** la vérification serveur reste la seule qui fasse autorité
**When** la vérification locale est ajoutée
**Then** elle ne la remplace pas

### Story 5.4: Fiabiliser la reconnaissance d'une adresse de stockage

As a exploitant,
I want qu'un fichier supprimé le soit réellement,
So that le bucket ne se remplisse pas d'orphelins facturés et introuvables.

**Couvre :** défaut n° 24 · **Fichier :** `lib/storage.ts:130-133`

**Acceptance Criteria:**

**Given** un nom de bucket contenant un point, un tiret entre crochets ou un `+`
**When** `keyFromUrl()` traite une adresse
**Then** elle renvoie la bonne clé — la valeur n'est plus interpolée telle quelle dans une expression régulière

### Story 5.5: Rendre les références lisibles par un tiers

As a agence,
I want une référence de bien exploitable par mon comptable,
So that l'export serve à ce pour quoi il est fait.

**Couvre :** défaut n° 25 (FR-03) · **Fichiers :** `prisma/schema.prisma:312, 619`

**Acceptance Criteria:**

**Given** la référence affichée d'un bien est aujourd'hui `cmslq2teb000f42dumpcxt1v7`
**When** un bien est créé
**Then** sa référence affichée suit un format lisible et unique par agence et par année

**Given** les biens déjà en base
**When** la migration s'exécute
**Then** ils reçoivent une référence rétroactive, sans collision

**Given** `Payment.reference`, tronqué aux dix derniers caractères sur les quittances PDF
**When** la correction est appliquée
**Then** la quittance porte une référence complète et lisible

### Story 5.6: Partager le budget de tentatives de connexion

As a plateforme,
I want qu'une seconde porte de validation ne double pas le budget d'essais,
So that la limite annoncée soit la limite réelle.

**Couvre :** défauts n° 27 et n° 28 · **Fichiers :** `auth.ts:64-81`, `app/auth/login/actions.ts:37-45`, `lib/rate-limit.ts`

**Acceptance Criteria:**

**Given** `authorize()` et `explainLoginFailure()` comptent aujourd'hui sous deux clés distinctes
**When** la correction est appliquée
**Then** ils partagent la clé `login:compte:…`, et le total reste de dix essais par quart d'heure

**Given** le passage éventuel à plusieurs instances
**When** la story est terminée
**Then** `lib/rate-limit.ts` porte une note explicite sur ce qui devra changer, ou une abstraction prête à recevoir un magasin partagé

### Story 5.7: Nettoyer le dépôt et la configuration nginx

As a développeur,
I want que le dépôt ne contienne que ce qui lui appartient,
So that les fusions cessent de produire des conflits inutiles.

**Couvre :** défauts n° 30 et n° 31 · **Fichiers :** `tsconfig.tsbuildinfo`, `nginx/nginx.conf:43-47`

**Acceptance Criteria:**

**Given** `tsconfig.tsbuildinfo` est versionné
**When** la story est terminée
**Then** il est retiré du suivi git et listé dans `.gitignore`

**Given** `proxy_cache_valid` est déclaré sans zone `proxy_cache`
**When** la configuration est corrigée
**Then** soit une zone est déclarée et le cache fonctionne, soit la ligne disparaît

**Given** le bloc `/_next/static` ne transmet pas `Host` ni `X-Forwarded-*`
**When** la correction est appliquée
**Then** il les transmet comme les trois autres blocs

### Story 5.9: Contraindre les redirections et les sorties libres

As a utilisateur,
I want qu'un lien du produit ne m'emmène jamais ailleurs que dans le produit,
So that une adresse fabriquée ne me fasse pas sortir avec une bannière de succès.

**Couvre :** REP-12, REP-45, REP-46, REP-70, REP-33 · **Fichiers :** `app/agency/interactions/actions.ts`, `lib/mailer.ts`, `middleware.ts`, `lib/validations/index.ts`

> `returnTo` n'est validé nulle part, et c'est **la seule action ouverte à
> tous les agents** qui l'emprunte : une valeur absolue passe telle quelle à
> `revalidatePath()` puis à `redirect()`. S'y ajoutent trois dettes de la
> même famille — un sujet d'email non encodé RFC 2047, `sendMail({ html })`
> qui reste une porte ouverte, la saisie perdue après expiration de session,
> et les quarante messages d'erreur non accentués de `lib/validations`.

---

### Story 5.8: Révoquer les sessions au changement de mot de passe

As a éditeur,
I want qu'un changement de mot de passe déconnecte les sessions ouvertes,
So that reprendre la main sur un compte compromis ne suppose pas de le désactiver.

**Couvre :** résidu du défaut n° 33 (NFR-12) · **Fichiers :** `prisma/schema.prisma`, une migration, `lib/auth-guard.ts`, `app/admin/users/page.tsx`, `app/agency/users/page.tsx`, `app/auth/reset/[token]/page.tsx`

> **Le complément de la story 1.8, délibérément séparé d'elle.** La 1.8
> rend la désactivation d'un compte effective sans toucher au schéma. Il
> reste après elle un cas : un jeton volé sur un compte qui, lui, reste
> légitime et actif. Le fermer demande une colonne, une migration et un
> contrôle d'horodatage — assez pour mériter sa propre revue.
>
> **Sans urgence, et c'est pourquoi elle est ici :** après la 1.8, le
> remède existe (désactiver, puis réactiver), il est simplement brutal.
>
> **Nuance apportée par la revue de la story 1.8 :** ne pas croire que les
> 12 heures de `maxAge` bornent ce risque. Le jeton est **ré-signé à chaque
> lecture de session** : un jeton volé qui est *activement utilisé* ne
> périme jamais. Les 12 heures ne bornent que les sessions inactives. Le
> remède reste donc entièrement manuel — et il suppose que quelqu'un
> s'aperçoive du vol. C'est ce qui rend cette story moins facultative que
> son classement en épopée 5 ne le laisse entendre.

**Acceptance Criteria:**

**Given** un compte dont le mot de passe vient d'être changé — par l'éditeur, par son administrateur d'agence, ou par lui-même via un lien de réinitialisation
**When** une session ouverte avant ce changement présente son jeton
**Then** elle est refusée, sur les trois chemins de garde
**And** les trois points de changement de mot de passe posent la même marque : aucun ne peut être oublié sans que le test le montre

**Given** la stratégie de session est JWT et le jeton porte sa date d'émission
**When** la marque est comparée
**Then** la comparaison se fait sur cette date, sans stocker de session en base — la stratégie JWT n'est pas abandonnée

**Given** une colonne est ajoutée à `User`
**When** la migration est écrite
**Then** elle est rejouée sur une base vierge **et** sur une base contenant déjà des comptes, avant d'être commitée — la migration de la story 1.2 s'est révélée cassée à cet exercice, et il a payé
**And** les comptes existants ne sont pas déconnectés par la migration elle-même

**Given** le commentaire de `app/admin/users/page.tsx` a affirmé un remède qui n'existait pas
**When** la story est terminée
**Then** il décrit exactement ce que fait le produit, sans promesse par anticipation

---

### Story 5.10: Borner l'abus depuis des adresses réellement multiples

**Couvre :** REP-34 · **Fichiers :** `lib/rate-limit.ts`, `app/api/auth/register/route.ts`, `app/vitrine/[slug]/actions.ts`

> **Transférée depuis la story 1.9 le 13-08-2026.** Celle-ci déclarait
> `REP-34` hors périmètre depuis sa première rédaction, pendant que ce
> document le lui assignait. La contradiction n'a été vue qu'à la clôture :
> fermer la 1.9 en l'état aurait rendu le constat orphelin.
>
> **Ce qui reste ouvert, exactement.** La story 1.4 a fermé le choix de son
> identité par en-tête ; la 1.9 a fermé le verrouillage d'un compte par un
> tiers, et a écrit noir sur blanc que la seule borne restante est le
> compteur **par adresse** — laquelle ne vaut que contre un appelant qui
> n'en possède qu'une. Un botnet, une sortie mobile en CGNAT ou un
> fournisseur de proxys résidentiels passent dessous. Les deux points
> exposés sont **l'inscription** et **le formulaire public de la vitrine**.
>
> **⚠ Arbitrage produit requis AVANT tout code.** Une épreuve dont le coût
> est porté par l'appelant — captcha, preuve de travail — a un coût d'usage
> sur deux formulaires publics destinés à des clients algériens, et
> probablement une **dépendance nouvelle**, que `CLAUDE.md` §2 interdit
> d'ajouter sans accord. Un signal de réputation est l'autre voie. Ne pas
> commencer sans la décision, et l'écrire dans la story avec son motif.

**Acceptance Criteria:**

**Given** un appelant qui dispose de nombreuses adresses réellement distinctes
**When** il sollicite l'inscription ou le formulaire public de la vitrine en volume
**Then** son débit est borné par autre chose que le comptage par adresse
**And** la mesure du débit obtenu **avant** et **après** est écrite dans la story — sans elle, rien ne prouve que la borne mord

**Given** un visiteur légitime, unique, sur les mêmes deux formulaires
**When** la protection est en place
**Then** il aboutit sans obstacle mesurable — le contrôle positif est obligatoire, et il éprouve le chemin réel, pas la fonction

**Given** la protection suppose une dépendance ou un service tiers
**When** le choix est fait
**Then** l'arbitrage est écrit avec son motif, et aucune donnée personnelle d'agence ne part chez ce tiers

**Given** `lib/rate-limit.ts` nomme aujourd'hui `REP-34` comme hors de portée
**When** la story est terminée
**Then** ce commentaire dit ce que le produit fait réellement, et non plus ce qu'il ne fait pas

---

### Story 5.11: Recompter ce que la documentation affirme

**Couvre :** REP-72, REP-74, REP-76 · **Fichiers :** `docs/architecture.md`, `docs/qa/bug-report.md`, `docs/project-context.md`, `docs/README.md`, `docs/epics.md`, `docs/stories/sprint-status.yaml`

> **Aucun code applicatif touché.** C'est une story de documentation, et
> elle est pourtant classée ici plutôt qu'en simple correction parce que
> deux des chiffres faux servent de **preuve d'exhaustivité à une propriété
> de sécurité** : `architecture.md` §3 écrit que le cloisonnement est
> appliqué « sans exception dans les 31 Server Actions et les 12 routes API
> examinées », alors que l'arbre en porte **45** et **19**.
>
> **Le fond tient — et c'est ce qui rend la story nécessaire plutôt
> qu'urgente.** Le cloisonnement a été revérifié le 13-08-2026 sur
> l'ensemble réel : 40 actions inline sur 40 gardées (seule exception,
> `app/auth/reset/[token]/page.tsx`, publique à dessein), 16 routes sur 19
> (les trois autres publiques à dessein). Aucune fuite. Ce qui est faux
> n'est pas la conclusion mais l'ensemble sur lequel on l'affirme.
>
> **À passer tôt, parce qu'elle est peu coûteuse et qu'elle conditionne le
> reste :** tant que ces décomptes sont faux, aucune affirmation
> d'exhaustivité du dépôt n'est croyable, y compris les vraies.
>
> **`REP-76` est un constat de procédure, pas un chiffre.** `REP-72` avait
> déjà relevé le décompte et était assigné à la story 4.6 ; celle-ci est
> passée `done` en le laissant ouvert. Cette story ferme le constat ; c'est
> la **rétrospective de l'épopée 4** qui doit regarder pourquoi la clôture
> ne l'a pas vu.

**Acceptance Criteria:**

**Given** un nombre publié dans un document du dépôt
**When** la story est terminée
**Then** il a été recalculé, et **la commande qui le produit est écrite à côté de lui** — c'est la seule forme qui survit à la prochaine dérive

**Given** les sept décomptes faux inventoriés en `REP-74`
**When** la story est terminée
**Then** ils sont corrigés partout où ils apparaissent, y compris dans les en-têtes de `sprint-status.yaml` et de `bug-report.md`
**And** aucun n'est corrigé « par cohérence » avec un autre document sans avoir été mesuré à la source

**Given** l'affirmation d'exhaustivité de `architecture.md` §3
**When** elle est réécrite
**Then** elle nomme l'ensemble réellement vérifié, sa date, et la commande qui l'énumère
**And** les quatorze Server Actions et sept routes absentes du périmètre d'origine sont explicitement couvertes par la nouvelle vérification

**Given** un chiffre daté qui décrivait l'état à une date passée (les 26 123 lignes de l'audit du 9 août, par exemple)
**When** il est conservé
**Then** il porte sa date et se lit comme un instantané, non comme l'état courant

---

### Story 5.12: Rebrancher les commandes mortes de la console éditeur

**Couvre :** BUG-35 · **Ouvre :** REP-78 à REP-87
**Fichiers :** `components/layout/AdminNavbar.tsx`, `tests/navigation.spec.ts`, `docs/qa/bug-report.md`, `docs/epics.md`, `docs/stories/sprint-status.yaml`, `docs/stories/deferred-work.md`, `docs/stories/5-12-…md`, `docs/README.md`, `docs/project-context.md`

> **Cette story est née d'un signalement d'usage, pas d'une lecture** —
> l'éditeur, le 14 août 2026 : « certains éléments de la barre du haut ne
> sont pas reliés à leurs vraies pages ». Vérification faite, **cinq
> commandes d'`AdminNavbar.tsx` n'avaient aucune action** : les deux boutons
> « Déconnexion » (bureau et mobile), « Paramètres », « Profil », et une
> cloche de notifications. Le fichier n'importait même pas `signOut`.
>
> **Le point important n'est pas le correctif, il est trivial. C'est le
> trou de méthode.** Cinq passes d'audit sont passées à côté, parce que
> toutes cherchaient des gardes, des requêtes et des Server Actions. **Un
> bouton sans gestionnaire ne casse ni `tsc`, ni `lint`, ni aucun test** —
> il n'existe aucun signal automatique pour cette classe de défaut, et
> c'est pourquoi seul un usage réel l'a trouvée.
>
> **Les deux barres sont nées inertes** (établi par la revue du 14-08-2026,
> qui a démenti la première rédaction) : `git show
> a529f61:components/layout/AgencyNavbar.tsx | grep -c signOut` → **0**.
> Celle de l'agence a été réparée le 09-08-2026 (`1bbbb12`) **sans story ni
> trace**, celle de l'éditeur ne l'a pas été. Ce n'est donc pas une
> divergence, c'est un correctif silencieux appliqué à un seul des deux
> fichiers — et rien, dans le dépôt, ne rendait l'oubli visible.
>
> **Gravité 🟠 et non 🔴.** Une session éditeur dure douze heures depuis la
> story 1.8 ; sans bouton de sortie, elle survit à son utilisateur sur un
> poste partagé, sur le compte le plus puissant du produit, et le seul
> recours est d'effacer les cookies. Ce n'est pas exploitable à distance —
> d'où 🟠 — mais c'est un accès privilégié qu'on ne peut pas fermer.
>
> **Deux entrées sont retirées et non branchées, et c'est un arbitrage.**
> « Profil » n'a jamais eu d'écran ; la cloche n'a jamais eu de
> notifications, tout en portant une pastille rouge permanente —
> c'est-à-dire l'annonce de messages non lus dans un produit qui n'en a
> aucun. Les brancher supposerait d'écrire d'abord ce qu'elles ouvrent :
> c'est un PRD, pas une icône à reconnecter. **Une décoration qui ment sur
> l'état du système coûte plus qu'elle n'apporte.**

**Acceptance Criteria:**

**Given** un éditeur connecté sur `/admin`, sur le poste ou sur mobile
**When** il actionne « Déconnexion »
**Then** sa session est réellement fermée
**And** la preuve n'est pas l'arrivée sur `/auth/login` — un lien ordinaire y mènerait cookie intact — mais le fait que `/admin` soit **redevenu inaccessible** ensuite
**And** les **deux** boutons sont couverts, chacun par son propre cas : le bouton mobile vit dans un bloc `md:hidden` qu'un cas de bureau ne rend jamais, et `npm run test:e2e` ne joue que `chromium` (`REP-80`) — le cas mobile **force donc son viewport** plutôt que de dépendre d'un projet jamais exécuté
> *Ce critère a bien failli n'être tenu qu'à moitié : la revue du 14-08-2026 a établi qu'on pouvait retirer le `onClick` du bouton mobile sans faire rougir la suite — BUG-35 à moitié rouvert, sans signal.*

**Given** le cas ci-dessus, qui serait tout aussi vert sur une console cassée pour tout le monde
**When** la story est terminée
**Then** un **contrôle positif** établit qu'avec une session valide la console s'ouvre — sans lui, le rouge attendu ne désignerait rien (`CLAUDE.md` §6)

**Given** l'entrée « Paramètres » du menu utilisateur
**When** elle est actionnée
**Then** elle mène à `/admin/settings`, page qui **existait déjà**
**And** la preuve est une **mutation de cette entrée précise** — retirer son `<Link>` doit faire rougir ce cas, et non l'isolation d'un cas voisin
> *Nuance de revue : la page était déjà reliée par `navLinks`, dans la barre de bureau et le menu mobile. Seule l'entrée du menu déroulant était morte — c'est la seule des cinq commandes qui n'ait jamais empêché d'atteindre sa cible.*

**Given** « Profil » et la cloche de notifications, qui n'ouvrent sur rien
**When** la story est terminée
**Then** elles sont **retirées**, et un test échoue si **chacune des deux** réapparaît — pour que leur retour soit un choix documenté et non un copier-coller
**And** la cloche, qui était un bouton icône **sans nom accessible**, reçoit un ancrage testable : soit un `aria-label`, soit une assertion sur la classe `lucide-bell` posée par la bibliothèque — un critère au pluriel ne se coche pas sur une moitié

**Given** que le cas ci-dessus est une assertion d'**absence**
**When** il est écrit
**Then** il établit d'abord que le menu s'est **effectivement ouvert** — sans quoi il reste vert sur un menu qui ne s'ouvre plus, et ne teste plus rien (`CLAUDE.md` §6, piège 1)

**Given** que ce défaut n'a été trouvé ni par `tsc`, ni par `lint`, ni par la suite
**When** la story est terminée
**Then** le constat de méthode est écrit — **aucun contrôle automatique du dépôt ne voit un bouton sans action**
**And** les **deux autres barres** ont été inspectées commande par commande, et le résultat est écrit **même s'il est négatif** : un résultat négatif est un résultat (`CLAUDE.md` §7), et c'est lui qui dit à la prochaine revue que la question a déjà été posée
> *Résultat, vérifié le 14-08-2026 : **aucune autre commande morte.**
> `AgencyNavbar.tsx` — les deux « Déconnexion » portent leur `onClick`,
> « Paramètres de l'agence » est un `<Link>`, les 17 liens visent une page
> existante. `LandingNavbar.tsx` — les trois ancres `#features`,
> `#pricing`, `#contact` correspondent à un `id` réel dans
> `components/landing/`. Ce que ces barres ont, ce sont d'**autres**
> défauts : REP-78 (liens refusés par la garde), REP-79 (identité en dur),
> REP-81 à 84 — aucun n'est une commande morte.*

---

### Story 5.13: N'afficher que ce qui s'ouvre, et dire qui est connecté

**Couvre :** REP-78, REP-79, REP-81, REP-83, REP-84 · **Laisse ouvert :** REP-82
**Fichiers :** `components/layout/AgencyNavbar.tsx`, `components/layout/AdminNavbar.tsx`, `lib/roles.ts`, `lib/auth-guard.ts`, les 43 pages de `app/agency/**` et les 5 de `app/admin/**` qui transmettent le rôle, `tests/navigation-roles.spec.ts`, `tests/navigation.spec.ts`

> **Ouverte par la story 5.12**, qui a inspecté les trois barres du produit
> pendant qu'elle en réparait une. Les deux constats sont réels, mesurés le
> 14-08-2026, et **aucun n'est un défaut de sécurité** : ils sont écrits ici
> pour ne pas devenir des orphelins (`CLAUDE.md` §1).
>
> **REP-78 — cinq entrées de la barre agence renvoient un agent d'où il
> vient.** `/agency/showcase`, `/agency/trash`, `/agency/users`,
> `/agency/audit` et `/agency/settings` sont gardées par
> `requireAgencyAdmin()`, mais `AgencyNavbar.tsx` les affiche à tout le
> monde : il ne reçoit aucun rôle. **Le chemin est correctement traité** —
> la story 4.3 a fait en sorte que le refus s'accompagne d'un message
> lisible au lieu d'une éjection muette — donc rien ne casse. Reste qu'un
> agent voit en permanence cinq portes qui ne s'ouvriront jamais pour lui.
>
> **ARBITRAGE RENDU le 14-08-2026 par l'éditeur : MASQUER ces entrées.** Un
> agent ne voit que ce qu'il peut ouvrir. Le motif, pour qu'il puisse être
> rouvert sciemment : **un outil de terrain se juge à ce qu'il ne demande
> pas de comprendre.** Un agent immobilier n'a pas à apprendre la
> hiérarchie des rôles du produit pour se servir de sa barre ; cinq entrées
> qui le rejettent lui apprennent surtout à se méfier des liens. Le coût
> assumé est qu'il ignorera que ces écrans existent, donc qu'il pourrait les
> demander à son administrateur — jugé moindre que celui d'une barre qui
> propose ce qu'elle refuse. *Réversible : c'est un filtre sur une liste,
> pas une architecture.*
>
> **REP-79 — les deux barres affichent une identité en dur.**
> `AdminNavbar.tsx` écrit « SA » et « Super Admin », `AgencyNavbar.tsx`
> écrit « A » et « Mon compte » — aucune des deux ne lit la session. Sur un
> produit à trois rôles où l'on peut détenir plusieurs comptes, la barre
> affiche donc la même chose quel que soit l'utilisateur connecté. Coût réel
> aujourd'hui : faible. Ce qu'il faut noter, c'est que **`session.user.role`
> ne se lit pas** (`CLAUDE.md` §2) — le rôle et l'agence se relisent en
> base, donc l'affichage doit venir du serveur et descendre en `props`, pas
> d'un `useSession()` côté client.

**Acceptance Criteria:**

**Given** un compte `agent` connecté
**When** il regarde la barre de son espace
**Then** les cinq entrées réservées à l'administrateur **ne sont pas rendues** — ni sur la barre, ni dans les menus « Transactions » / « Plus », ni dans le menu mobile qui aplatit les dix-sept liens, ni dans le menu utilisateur (« Paramètres de l'agence »)
**And** un compte `agency_admin` les voit toutes, sans quoi le masquage aurait simplement cassé la barre pour tout le monde — **c'est le contrôle positif, et il est obligatoire** (`CLAUDE.md` §6)

**Given** que masquer un lien ne garde rien
**When** le filtre est posé
**Then** un test rejoue l'accès direct à `/agency/users` avec un compte `agent` et constate qu'il est **toujours refusé par la garde** — le jour où quelqu'un lira le masquage comme une protection, ce test sera la seule chose qui l'en empêchera

**Given** le rôle affiché dans la barre
**When** il est branché sur l'utilisateur réel
**Then** il provient d'une lecture **en base** descendue en `props` depuis un Server Component, jamais de `session.user.role` (`CLAUDE.md` §2)

**Given** la correction de l'affichage par rôle
**When** elle est posée
**Then** elle ne devient **pas** une couche d'autorisation : `lib/auth-guard.ts` reste la seule, et masquer un lien ne garde rien (`CLAUDE.md` §5)

> *Les quatre critères ci-dessous ont été ajoutés le 15-08-2026, sur constat
> de l'audit d'acceptation : la story implémentait REP-81, 83 et 84 et le
> repli de l'écran d'attente, alors que ce document — qu'elle cite pourtant
> comme faisant foi — n'en portait aucun critère. Un document de référence
> en retard sur ce qu'on lui attribue est une affirmation non tenue (§7).*

**Given** `app/agency/loading.tsx`, qui rend la barre et ne peut pas connaître le rôle (fonction **synchrone**, affichée avant que la page ne résolve)
**When** il s'affiche
**Then** il n'affiche **aucune** entrée réservée : le repli est le plus **restreint**, jamais le plus large
**And** le repli inverse ferait clignoter les cinq entrées interdites à chaque navigation d'un agent — le masquage défait à l'instant précis où il regarde

**Given** `signOut()`, qui enchaîne `getCsrfToken()`, un `fetch` puis `res.json()` **sans garde** (REP-81)
**When** l'appel échoue — réponse non-JSON derrière nginx, réseau coupé
**Then** l'utilisateur le sait, au lieu d'un bouton qui paraît inerte — c'est-à-dire le symptôme même de BUG-35, par un autre chemin
**And** le message est rendu **hors de tout menu** : placé à l'intérieur, il disparaîtrait dès que l'utilisateur ferme le menu, ce que Radix fait sur Échap et sur clic extérieur quoi que fasse `preventDefault`

**Given** une seconde activation de « Déconnexion » pendant que l'appel est en vol (REP-83)
**When** elle se produit
**Then** elle ne déclenche pas un second `POST /api/auth/signout`, et l'état est visible plutôt que muet
**And** les menus se referment au clic, comme le font tous les liens qui les entourent

**Given** un bouton icône sans texte, dont l'icône Lucide n'a pas de `<title>` (REP-84)
**When** la story est terminée
**Then** il porte un `aria-label`, sans quoi son nom accessible est **vide** — et le chemin qu'il ouvre devient intestable autrement que par un sélecteur CSS que rien ne protège
**And** l'étiquette suit l'état du bouton, au lieu d'annoncer « Ouvrir » quand il ferme

---

### Story 5.14: Rendre au déploiement ses Server Actions

As a agence utilisant le déploiement conteneurisé,
I want que les boutons qui enregistrent enregistrent réellement,
So that je ne découvre pas, une fois installée, que le produit ne sait plus que lire et supprimer.

**Couvre :** BUG-36 · **Ouvre :** REP-94, REP-95, REP-96
**Fichiers :** `nginx/nginx.conf` (lignes 60, 127, 139, 152), `playwright.config.ts`, `docs/architecture.md` §7

> **Ouverte par la session de vérification au navigateur du 15-08-2026**, et
> le défaut a été **reproduit**, pas déduit. `nginx.conf` pose
> `proxy_set_header Host $host` — et `$host` ne contient pas le port. Next 14
> compare l'hôte transmis (`localhost`) à l'`Origin` du navigateur
> (`localhost:8095`), n'y trouve pas d'égalité, et **abandonne toute Server
> Action** au titre de sa protection anti-CSRF.
>
> **Les 41 Server Actions du produit sont donc mortes sur le déploiement
> documenté** : création, édition, corbeille, console de l'éditeur,
> formulaire public de la vitrine, et `explainLoginFailure` — si bien
> qu'aucun échec de connexion n'affiche son motif. Ce qui survit : la
> navigation, la connexion, les exports, les PDF, et **les suppressions par
> route API**. Le produit est en lecture seule *sauf pour supprimer*.
>
> **La suite E2E ne pouvait pas l'attraper** : `playwright.config.ts` sert
> l'application en direct sur le port 3002, nginx n'est jamais dans le
> chemin. C'est un angle mort du harnais, pas un oubli de test — il part en
> REP-95.

**Acceptance Criteria:**

**Given** un navigateur demande `http://localhost:8095/…`
**When** nginx relaie vers l'application
**Then** l'en-tête `Host` reçu vaut `localhost:8095`, port compris, sur les quatre blocs `location`

**Given** la pile conteneurisée est en marche
**When** on envoie le formulaire de contact d'une fiche de vitrine publique
**Then** la réponse est une redirection `303`, le message de succès s'affiche, et un `Lead` existe en base

**Given** un compte dont l'agence est en statut `pending`
**When** il se connecte avec le bon mot de passe
**Then** l'écran affiche le motif exact, et non « Une erreur est survenue »
**And** un compte valide se connecte toujours — contrôle positif

**Given** le correctif est appliqué
**When** on veut prouver qu'il ne repartira pas
**Then** une vérification exécutable exerce une Server Action **à travers nginx**
**And** il est écrit dans `playwright.config.ts` que la suite ne couvre pas ce chemin, et pourquoi

**Given** l'image applicative en service date du 09-08-2026 et accuse 67 commits de retard
**When** la story est terminée
**Then** elle est reconstruite depuis le code de la branche
**And** la révocation d'accès est vérifiée — avec son contrôle positif

---

## Epic 6: Vendre ce que le produit tient — les offres d'abonnement

**Première épopée de fonctionnalité de ce dépôt.** Les épopées 0 à 5
remettaient en état ce qui existait ; celle-ci ajoute.

**Source :** [`docs/prds/prd-aqar-dz-offres-2026-08-15/prd.md`](prds/prd-aqar-dz-offres-2026-08-15/prd.md).
Les FR cités ci-dessous y renvoient. **Le PRD fait foi** ; cette section est
le découpage, pas la spécification.

> **Le défaut de fond, mesuré le 15-08-2026.** La page d'accueil vend trois
> offres — Starter 2 900 DA, Pro 7 900, Enterprise 19 900 — et la base n'en
> connaît que deux, `basic` et `premium`, qui ne portent aucun de ces noms.
> Le formulaire d'inscription ne demande rien : toute inscription atterrit
> sur `basic`. Et la valeur enregistrée ne conditionne **rien** :
>
> ```
> grep -rn "premium\|basic" --include="*.ts*" app/ lib/ components/ \
>   | grep -v app/admin/settings          → 1 occurrence
> ```
>
> Cette unique occurrence est la valeur par défaut posée à l'inscription.
> Aucun plafond, aucune capacité fermée. **L'offre est une étiquette.**

**Trois arbitrages de l'éditeur, rendus le 15-08-2026** (motifs dans le
`.memlog.md` du PRD) :

1. **Catalogue en code**, trois offres alignées sur la page tarifaire.
   Changer un tarif reste un déploiement.
2. **L'inscrit demande, l'éditeur arbitre.** Deux notions distinctes, jamais
   confondues : *offre demandée* ≠ *offre attribuée*.
3. **Quotas durs** sur les biens et les comptes, **sans aucune suppression
   rétroactive**.

**Vocabulaire.** On dit **offre**. Jamais « formule », « plan » ou
« forfait » dans un écran ou un texte — le champ Prisma s'appelle `plan`
pour des raisons historiques, c'est tout. Glossaire complet au §3 du PRD.

> ⚠ **Ce que cette épopée rend atteignable** (`CLAUDE.md` §8). Un plafond
> peut **enfermer une agence** — ce dépôt a déjà payé exactement ce
> mécanisme avec la révocation qui ouvrait une boucle de redirection. Et un
> décompte mal posé ferme trop tôt, ou ne ferme rien : les biens à la
> corbeille et les comptes désactivés sont les deux pièges, traités par la
> story 6.4.

---

### Story 6.1: Poser le catalogue des offres, et n'en avoir qu'un

As a éditeur d'Aqar DZ,
I want que les trois offres soient définies une seule fois,
So that la page qui les vend et le code qui les applique ne puissent plus diverger.

**Couvre :** FR-1, FR-2, FR-14
**Fichiers :** `lib/offres.ts` *(nouveau)*, `components/landing/PricingSection.tsx`, `prisma/schema.prisma`, une migration, `lib/validations/index.ts`, `app/admin/settings/page.tsx`, `app/admin/agencies/page.tsx`

> **Bloquée par la question ouverte n° 1 du PRD** : les plafonds exacts de
> chaque offre. Les chiffres de la page tarifaire (Starter 20 biens / 2
> comptes, Pro illimité / 10, Enterprise illimité / illimité) sont une
> **hypothèse**, et c'est la donnée la plus structurante du lot.

**Acceptance Criteria:**

**Given** un développeur cherche le tarif ou le plafond d'une offre
**When** il le cherche dans le dépôt
**Then** il le trouve dans un seul fichier
**And** `grep -rln "2 900\|7 900\|19 900" --include="*.ts*" app/ components/ lib/` renvoie **1**

**Given** la section tarifaire publique
**When** elle affiche ses trois colonnes
**Then** elle lit le catalogue et ne contient aucun tarif ni nom d'offre en dur

**Given** le champ qui porte l'offre attribuée
**When** on tente d'y écrire une valeur hors catalogue
**Then** l'écriture est refusée — le champ est une énumération Prisma, et toute entrée passe par `parseForm(schema, formData)`
**And** les deux `formData.get(x) as Enum` de la console (`app/admin/settings/page.tsx:57`, `app/admin/agencies/page.tsx:100`) ont disparu

**Given** les agences déjà en base, portant `basic` ou `premium`
**When** la migration s'applique
**Then** `basic` devient Starter et `premium` devient Pro
**And** aucune agence ne se retrouve sans offre attribuée
**And** aucune agence active ne perd l'accès, quel que soit son décompte

---

### Story 6.2: Recueillir l'offre que le visiteur demande

As a visiteur qui s'inscrit,
I want choisir mon offre au moment où je la lis,
So that je n'aie pas à la découvrir trois semaines plus tard dans un écran de paramètres.

**Couvre :** FR-3, FR-4, FR-5 · **Réalise :** UJ-1
**Fichiers :** `components/landing/PricingSection.tsx`, `app/auth/register/page.tsx`, `app/api/auth/register/route.ts`, `lib/validations/index.ts`, `prisma/schema.prisma`
**Dépend de :** 6.1 *(le catalogue doit exister pour être proposé)*

**Acceptance Criteria:**

**Given** un visiteur sur la section tarifaire
**When** il clique le bouton d'appel d'une des trois offres
**Then** le formulaire d'inscription s'ouvre avec **cette** offre présélectionnée
**And** les trois boutons mènent à trois destinations distinctes

**Given** un visiteur arrivé sur `/auth/register` sans passer par la page tarifaire
**When** le formulaire s'affiche
**Then** aucune offre n'est présélectionnée, et ce n'est pas une erreur
**And** l'inscription est refusée tant qu'il n'en a pas choisi une, avec un message qui le dit

**Given** une inscription valide portant une offre demandée
**When** elle est enregistrée
**Then** l'offre demandée est stockée **distinctement** de l'offre attribuée
**And** l'écran de confirmation la nomme et précise qu'elle est sous réserve de validation

**Given** une agence en attente, porteuse d'une offre demandée
**When** un contrôle de quota s'exécute
**Then** il ne lit jamais l'offre demandée
**And** poster une offre demandée forgée ne change aucun plafond

---

### Story 6.3: Attribuer l'offre dans le geste d'approbation

As a super administrateur,
I want voir ce qui a été demandé et trancher au moment où j'approuve,
So that je ne vende pas ce que je n'ai pas encaissé, sans pour autant multiplier les écrans.

**Couvre :** FR-6, FR-7, FR-8 · **Réalise :** UJ-2
**Fichiers :** `app/admin/agencies/page.tsx`, `app/admin/settings/page.tsx`, `lib/audit.ts` *(appelant)*, `lib/validations/index.ts`
**Dépend de :** 6.1, 6.2

**Acceptance Criteria:**

**Given** une agence en statut `pending` porteuse d'une offre demandée
**When** un super administrateur ouvre `/admin/agencies`
**Then** la ligne affiche l'offre demandée, ou « aucune » si elle est nulle

**Given** un super administrateur qui approuve sans toucher au sélecteur
**When** il clique le bouton d'activation
**Then** l'offre demandée devient l'offre attribuée
**And** l'opération reste **un seul clic**

**Given** un super administrateur qui veut attribuer autre chose
**When** il choisit une offre différente puis approuve
**Then** c'est cette offre-là qui est attribuée
**And** `recordAudit()` inscrit qui, quand, quelle agence, et l'écart demande → attribution

**Given** une agence déjà active
**When** un super administrateur change son offre
**Then** les **trois** offres lui sont proposées, pas une bascule entre deux
**And** le changement est journalisé, ancienne et nouvelle offre nommées

**Given** un `agency_admin`
**When** il rejoue la Server Action de changement d'offre sur sa propre agence
**Then** elle est refusée — le contrôle est dans l'action, pas dans l'écran

---

### Story 6.4: Faire tenir les plafonds, sans rien détruire

As a éditeur d'Aqar DZ,
I want qu'une agence ne dépasse pas ce que son offre autorise,
So that l'offre cesse d'être une étiquette — sans jamais supprimer ce qu'une agence possède déjà.

**Couvre :** FR-9, FR-10, FR-11, FR-12 · **Réalise :** UJ-3
**Fichiers :** `lib/offres.ts`, `app/agency/properties/new/page.tsx`, `app/agency/users/page.tsx`, `app/agency/trash/page.tsx`, `lib/auth-guard.ts` *(à confirmer)*
**Dépend de :** 6.1, 6.3

> **C'est la story dangereuse de l'épopée.** Le refus est facile ; le
> **décompte** est le piège. Et poser un plafond rend soudain atteignables
> deux chemins qui ne comptaient pour rien : restaurer depuis la corbeille,
> réactiver un compte désactivé.
>
> Points de création mesurés le 15-08-2026 : **un seul** pour les biens
> (`app/agency/properties/new/page.tsx:69`), **deux** pour les comptes
> (`app/agency/users/page.tsx:102` et `app/api/auth/register/route.ts:117`,
> ce dernier créant le premier administrateur d'une agence neuve — **hors
> quota par construction**, et à ne pas « corriger »).

**Acceptance Criteria:**

**Given** une agence Starter possédant 20 biens non supprimés
**When** un de ses membres enregistre un vingt-et-unième bien
**Then** l'enregistrement est refusé
**And** le message nomme l'offre, le plafond et le décompte actuel
**And** la saisie n'est pas perdue

**Given** la même agence
**When** on rejoue la Server Action de création sans passer par l'écran
**Then** le refus est identique — la garde est dans l'action

**Given** une agence Pro, dont le plafond de biens est illimité
**When** elle crée un bien, quel que soit son décompte
**Then** rien n'est refusé — **contrôle positif obligatoire**

**Given** une agence au plafond, avec un bien à la corbeille
**When** elle restaure ce bien
**Then** la restauration est refusée, avec le même message
**And** sous le plafond, la restauration fonctionne toujours — **contrôle positif**

**Given** une agence au plafond de comptes, avec un compte désactivé
**When** un `agency_admin` le réactive
**Then** la réactivation est refusée
**And** sous le plafond, la réactivation fonctionne toujours — **contrôle positif**

**Given** une agence rétrogradée au-dessous de son décompte
**When** la rétrogradation s'applique
**Then** aucun bien ni compte n'est supprimé, désactivé ni masqué
**And** tout reste modifiable : seule la création est refusée
**And** supprimer un objet ramène le décompte, et le message de refus le dit

**Given** un contrôle de quota
**When** il compte
**Then** il utilise `count()`, jamais `findMany().length`
**And** il lit le décompte en base au moment de l'action, jamais dans la session ni le jeton

---

### Story 6.5: Dire à l'agence où elle en est

As a administrateur d'agence,
I want voir mes plafonds et ma consommation,
So that je ne découvre pas ma limite au moment où elle me bloque.

**Couvre :** FR-13
**Fichiers :** `app/agency/settings/page.tsx`
**Dépend de :** 6.1, 6.4

**Acceptance Criteria:**

**Given** un `agency_admin` sur `/agency/settings`
**When** la page s'affiche
**Then** elle montre l'offre attribuée, ses plafonds et le décompte actuel

**Given** une offre au plafond illimité
**When** la page l'affiche
**Then** elle l'annonce comme illimité, sans nombre inventé

**Given** une agence au-dessus de son plafond, après rétrogradation
**When** la page s'affiche
**Then** l'état est visible sans être alarmiste — la situation est légitime, rien n'est en danger

---

---

### Story 6.6: Ne plus vendre ce que le produit ne fait pas

As a éditeur d'Aqar DZ,
I want que les arguments de vente affichés correspondent aux capacités livrées,
So that une agence Enterprise ne paie pas pour une liste dont elle ne recevra pas la moitié.

**Couvre :** question ouverte n° 2 du PRD · **Porte :** `REP-100`
**Fichiers :** `lib/offres.ts` *(le champ `atouts`)*, `tests/offres.spec.ts`
**Dépend de :** 6.1 *(le catalogue doit être unique pour être corrigé d'un geste)*

> ~~**Le même défaut que celui de l'épopée, déplacé d'un cran.** Celle-ci a
> fermé la divergence sur les **noms** et les **plafonds**. Les **capacités**
> restent vendues sans être tenues : « API access », « Intégrations custom »,
> « Statistiques avancées », « Formation dédiée », « Account manager »,
> « SLA garanti » — six mentions sans contrepartie dans le produit.~~
>
> **⚠ Ce paragraphe était faux — écrit de mémoire, jamais mesuré.**
> L'inventaire des **19** arguments, fait le 16-08-2026 en ouvrant la story,
> donne : **6** plafonds tenus, **6** capacités livrées, **5** engagements de
> service, et **2** — « API access », « Intégrations custom » — qui ne
> désignaient rien. « Statistiques avancées » **existe** :
> `app/agency/statistics`, 425 lignes, six graphiques.
>
> **Arbitrage rendu le 16-08-2026** (délégué par l'éditeur), motif complet
> dans la story : les **2** mentions creuses sont retirées, les **5**
> engagements de service gardés — un `grep` ne dit rien de la présence d'un
> chargé de compte —, et les **6** capacités livrées gardées aussi, parce que
> le vrai défaut les concernant est ailleurs : elles ne sont **réservées à
> aucune offre**. C'est `REP-101`, et c'est la story 6.7.

**Acceptance Criteria:**

**Given** un argument affiché sur la page tarifaire
**When** on cherche la capacité correspondante dans le produit
**Then** elle existe, ou l'argument a été retiré

**Given** l'arbitrage rendu
**When** il est appliqué
**Then** son **motif** est écrit dans la story — dans six mois, seul le motif permettra de le rouvrir

**Given** la section tarifaire
**When** le test la parcourt
**Then** il vérifie toujours que chaque argument du catalogue est affiché — la story ne doit pas affaiblir la couverture existante en réduisant la liste

**Given** un argument ajouté au catalogue sans passer par la revue
**When** la suite tourne
**Then** elle échoue, et le message dit lequel


### Story 6.7: Fermer par offre, ou cesser de vendre comme exclusif

As a éditeur d'Aqar DZ,
I want que l'écart de prix entre deux offres corresponde à un écart de capacités,
So that une agence Pro ne paie pas 5 000 DA de plus par mois pour quatre lignes qu'une agence Starter obtient sans payer.

**Couvre :** question ouverte n° 2 du PRD *(second volet)* · **Porte :** `REP-101`
**Fichiers :** `lib/offres.ts`, et selon l'arbitrage `app/agency/statistics`, `app/agency/rentals`, `app/agency/rental-management`, `lib/pdf/`, `app/agency/settings`
**Dépend de :** 6.6 *(l'inventaire doit exister pour savoir de quoi on parle)*

> **L'inverse de la divergence que l'épopée a fermée.** Là, la page promettait
> ce que la base ignorait. Ici, elle vend **comme exclusif ce que tout le
> monde a déjà.** Mesuré le 16-08-2026 : hors des deux plafonds numériques,
> **aucune capacité n'est conditionnée par l'offre**.
>
> ```
> grep -rn "plan" --include="*.ts*" app/agency/ app/vitrine/ \
>   | grep -v "quota\|offres\|nomOffre\|plan_bien"        → 0 verrou
> ```
>
> **Ce n'est pas une story technique, et elle ne doit pas être ouverte avant
> l'arbitrage.** Fermer ces capacités **retirerait à des agences Starter des
> écrans qu'elles utilisent déjà**. Ce n'est plus corriger une promesse, c'est
> reprendre une capacité livrée à des clients en cours. Trois issues, à
> trancher par l'éditeur : fermer par offre **avec une bascule pour
> l'existant**, reformuler les arguments pour cesser de les présenter comme
> exclusifs, ou revoir l'écart de prix.

**Acceptance Criteria:**

**Given** une capacité vendue par une offre et pas par une autre
**When** une agence de l'offre inférieure tente d'y accéder
**Then** elle est refusée — ou l'argument ne la présente plus comme réservée

**Given** une agence existante qui utilise aujourd'hui une capacité qui deviendrait fermée
**When** l'arbitrage est appliqué
**Then** son sort est décidé **explicitement** et écrit dans la story — rien ne lui est retiré en silence

**Given** un verrou par offre posé sur un écran
**When** on cherche où il est appliqué
**Then** il l'est **dans l'action ou la garde**, pas seulement dans le rendu — un écran masqué reste joignable (`CLAUDE.md` §6, piège 4)


## Ce qui n'est pas dans ces épopées

- **Les fonctionnalités restantes listées dans l'archive `GSD.md`** :
  guide utilisateur, déploiement VPS réel. Elles relèvent d'un futur PRD,
  pas de la remise en état. *(Le stockage Supabase, lui, est désormais
  touché par la story 0.1 : les fichiers téléversés doivent être couverts
  d'une manière ou d'une autre.)*
- ~~**`@tanstack/react-query`**, installé et jamais importé : à retirer ou à
  utiliser, mais ce n'est pas un défaut.~~ *Repris le 13-08-2026 : ce n'est
  toujours pas un défaut, mais il n'est pas seul — `react-hook-form` et
  `@prisma/extension-accelerate` sont dans le même cas et n'étaient
  documentés nulle part. Les trois sont désormais portés par `REP-75`,
  rattaché à la story 5.7 qui nettoie déjà le dépôt.*
- **La recherche plein texte** (`pg_trgm`, index GIN). Le plafond est
  documenté par la story 3.8, volontairement sans l'implémenter : ce
  n'est pas encore le moment.
- **Le passage à plusieurs instances.** Deux verrous seulement subsistent
  — compteurs de débit en mémoire (défaut n° 28) et fichiers sur disque
  local. À lever quand le besoin de redondance sera réel, pas avant.
- **Toute nouvelle fonctionnalité.** Passer par `bmad-prd` d'abord.
