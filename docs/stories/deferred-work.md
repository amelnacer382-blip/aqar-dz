# Travaux reportés

Constats réels, écartés du périmètre au moment où ils ont été relevés. Ce
fichier existe pour qu'un report reste une décision tracée et non un oubli.

---

## Comment lire ce fichier

**Chaque constat porte un identifiant `REP-nn` et le nom de la story qui le
prendra en charge.** Avant le 12 août 2026, ils n'avaient ni l'un ni
l'autre : sur 73 constats, **34 n'étaient retrouvables qu'en relisant le
fichier entier**, et le plus grave d'entre eux — un tiers peut verrouiller
n'importe quel compte dont il connaît l'adresse (`REP-37`) — dormait depuis
onze jours sans que rien ne le porte.

```
REP-nn → story N.N     le constat appartient à cette story
REP-nn → résolu        traité par une autre story, gardé pour la trace
```

**Un constat sans story n'existe pas.** Si vous en ajoutez un, donnez-lui le
numéro suivant et une story — quitte à l'ouvrir dans `docs/epics.md` pour
l'occasion. C'est cette règle, et elle seule, qui empêche le fichier de
redevenir un cimetière.

| Story | Constats portés |
|---|---|
| **0.3** collecte des erreurs | REP-09, 35, 41 |
| **1.7** URL d'un document | REP-26 |
| **1.9** verrouillage de compte 🔴 | REP-**37**, 38, 39, 40 |
| **2.3** HTTPS et déploiement | REP-50, 51, 52, 53, 88, 90 |
| **2.5** seau privé et documents | REP-18 à 29, 55, 56, 57 |
| **2.7** volume de la base hors de portée d'un `down -v` | ~~REP-103~~ *(résolu et en service, 17-08-2026)* |
| **2.8** dire quel commit est en service | ~~REP-96~~ *(résolu et en service, 17-08-2026)* |
| **3.1** bornes de saisie | REP-47 |
| **3.5** étendre la suppression réversible aux relations | ~~REP-99~~ *(résolu 17-08-2026)* |
| **3.10** reprise d'un parent en corbeille | ~~REP-03 à 07, 14~~ *(les six résolus, 17-08-2026)* |
| **3.11** liens déjà réécrits | REP-01 *(éditeur)*, ~~02~~ *(résolu 18-08-2026)* |
| **4.4** correctifs de l'épopée 1 | REP-60 |
| **4.5** couche métier testable | REP-10, 11, 62, 63, 64, 68, 73 |
| **4.6** suppression directe | REP-72 |
| **4.7** harnais de test | REP-16, 17, 30, 31, 43, 44, 48, 49, 54, 58, 59, 61, 66, 67, 69, 71, 80, 85, 87, **102** |
| **4.8** prouver que les modules métier fonctionnent | ~~REP-104~~ *(résolu 17-08-2026)* |
| **3.12** borner le plan du site | ~~REP-105~~ *(résolu 17-08-2026)* |
| **3.13** faire confirmer ce qui détruit | ~~REP-106~~ *(résolu 17-08-2026)* |
| **3.14** l'accueil invisible avant hydratation | ~~REP-107~~ *(résolu 17-08-2026)* |
| **5.1** dépannage super admin | REP-13, 65 |
| **5.2** collisions d'unicité | REP-15 |
| **5.6** budget de tentatives | REP-36, 42 |
| **5.7** dépôt et nginx | REP-32, 75 |
| **5.8** révoquer les sessions | REP-92 |
| **5.9** redirections et sorties libres | REP-12, 33, 45, 46, 70, 86, 91, 93 |
| **1.1** sortir la clé d'API du dépôt 🔴 | REP-77 |
| **5.10** abus depuis des adresses multiples | REP-34 |
| **5.11** recompter ce que la doc affirme | REP-72, 74, 76, 89 |
| **5.13** n'afficher que ce qui s'ouvre | REP-82 *(seul restant)* |
| **6.6** ne plus vendre ce qui n'existe pas | ~~REP-100~~ *(résolu 16-08-2026)* |
| **6.7** fermer ou cesser de vendre comme exclusif | REP-101 |
| *résolus* | REP-**02,** 03, 04, 05, 06, 07, 08, 14, 24, 78, 79, 81, 83, 84, 96, 99, 100, 103, 104, 105, 106, 107 |

## Deferred from: code review of story-3.9 (12-08-2026)

- **`REP-01` → story **3.11** — 🟠 Les données déjà corrompues ne sont pas réparées.** BUG-34 a été
  **reproduit sur l'instance** : des visites, ventes, baux ou paiements
  peuvent déjà pointer vers le mauvais parent en production. La story 3.9
  empêche de nouvelles réécritures ; elle ne dit rien des anciennes. Il
  manque une requête de détection — un enfant dont le parent actuel n'est
  pas celui de son historique — ou, à défaut, une note écrite disant qu'il
  n'y a rien à réparer et pourquoi. Un défaut fermé avec ses victimes encore
  en base n'est fermé qu'à moitié. *Story à écrire.*

- **`REP-02` → **résolu** — ~~`sale.ownerId` et `rental.ownerId` sont réécrits par un enregistrement à
  vide.** `app/agency/sales/[id]/edit/page.tsx`,
  `app/agency/rentals/[id]/edit/page.tsx` — `ownerId: data.ownerId ??
  property.ownerId`, alors qu'aucun des deux formulaires ne rend ce champ :
  la valeur est donc **dérivée du bien à chaque sauvegarde**. Si le bien a
  changé de propriétaire depuis, la vente suit silencieusement. C'est la
  même classe que BUG-34, sur un lien calculé côté serveur plutôt que
  soumis — et l'inventaire, bâti par `grep name="..."`, ne pouvait pas le
  voir.~~ *Story à écrire.*

  **Story 3.11, 18-08-2026.** Le propriétaire n'est plus jamais reçu du
  formulaire : la clef est **retirée des deux schémas**, et la valeur est
  dérivée du bien — qui est vérifié, lui. Elle n'est réécrite **que si le
  bien change**, auquel cas elle doit suivre.

  ⚠ **Ce constat en cachait un plus grave, sur la MÊME ligne.** `REP-02`
  était à gauche du `??` ; à droite, `saleSchema` et `rentalSchema`
  **acceptaient** `ownerId` et personne ne le vérifiait contre l'agence. Un
  POST forgé rattachait la vente au propriétaire d'une **autre agence**,
  dont le nom ressort dans le contrat PDF, la gestion locative et l'export
  CSV. Reproduit : l'action a répondu « Vente mise a jour ». C'est
  **`BUG-39`**, inscrit au registre des défauts.

  Et un troisième, trouvé par un test rouge en instruisant celui-ci :
  **`BUG-40`**, une date qui recule d'un jour quand on ouvre sa fiche et
  qu'on enregistre.

- **`REP-03` → **résolu** — ~~Restauration entre les deux requêtes.~~** Le `findMany` des vivants et le
  `findFirst` de l'archivé n'étaient pas transactionnels : un parent restauré
  entre les deux n'était dans aucune des deux listes, et le défaut d'origine
  réapparaissait. Fenêtre étroite ; le remède demandait une requête unique.
  **Story 3.10, 17-08-2026** : c'est exactement ce qui a été fait —
  `vivantsEtCourant()` ramène la liste et le parent courant **ensemble**, il
  n'y a plus d'entre-deux. Fermé avec `REP-06` et `REP-07`, d'un seul geste :
  les trois étaient trois symptômes du même choix.

- **`REP-04` → **résolu** — ~~Un `defaultValue` sans option correspondante reste silencieux~~** pour
  toute cause autre que la corbeille — identifiant d'une autre agence,
  dérive de données. La story 3.9 fermait une cause, pas le symptôme.
  **Story 3.10, 17-08-2026** : l'invariant est posé là où la liste est
  construite, pour qu'aucun écran ne puisse l'oublier — `optionsParent()`
  **fabrique** l'option manquante, étiquetée « référence introuvable ». Le
  formulaire repart alors avec la valeur qu'il avait, la Server Action ne la
  trouve pas dans l'agence, et **refuse en le disant**. Éprouvé sur un lien
  qui désigne le bien d'une autre agence.

- **`REP-05` → **résolu** — ~~`libelleOption` accepte une ligne sans `deletedAt`.~~** `lib/corbeille.ts`
  — le champ était optionnel dans le type : un futur écran qui oubliait
  `deletedAt: true` dans son `select` compilait et n'étiquetait rien.
  **Story 3.10, 17-08-2026** : rendu requis, et la mutation le prouve —
  `error TS2345: Property 'deletedAt' is missing … but required in type
  'Ligne'`. L'oubli est passé de « personne ne le voit » à « `tsc` refuse ».

- **`REP-06` → **résolu** — ~~Le parent en corbeille est placé en tête de liste~~**, ce qui cassait
  l'ordre annoncé par les `orderBy` et en faisait la cible du repli du
  navigateur pour tout autre décalage. **Story 3.10, 17-08-2026** : plus
  personne ne recolle la liste en mémoire, c'est PostgreSQL qui range avec
  l'`orderBy` déjà écrit.

- **`REP-07` → **résolu** — ~~Une requête de plus par affichage~~**, y compris quand le parent est
  vivant. La story annonçait « un aller-retour » ; c'était un à trois selon
  l'écran. **Story 3.10, 17-08-2026** : il n'y en a plus **aucune** — la
  requête unique en supprime une par parent, soit trois sur l'écran des
  paiements. Gardé par un invariant de source : `deletedAt: { not: null }`
  ne doit réapparaître dans aucun des cinq écrans.

## Deferred from: code review of story-4.6 (12-08-2026)

- **`REP-08` → **résolu** — ~~🟠 Mettre un bien à la corbeille repointe silencieusement ses visites
  et ses paiements au prochain enregistrement.~~ Reproduit sur l'instance le
  12-08-2026, inscrit au registre en BUG-34 et doté d'une story (3.9), qui
  passe avant le reste de l'épopée 3 et avant la 4.5.** Le report n'était
  pas au bon niveau : ce n'est pas un travail écarté, c'est un défaut. Il
  reste ici pour la trace de son parcours.
  `app/agency/visits/[id]/edit/page.tsx`, `app/agency/payments/[id]/edit/page.tsx`
  — le `<select name="propertyId">` est bâti par le client Prisma étendu,
  qui masque les lignes portant un `deletedAt`, tandis que `defaultValue`
  vise le bien devenu invisible. Le navigateur retombe alors sur la
  **première option**. Un agent qui ouvre la visite et clique
  « Enregistrer » la rattache à un bien sans rapport, et le contrôle
  d'appartenance passe puisque ce bien appartient à la même agence.
  Antérieur — la route d'API mettait déjà à la corbeille — mais la
  story 4.6 ouvre un second chemin vers cet état, et il est désormais
  atteignable depuis l'interface. Le remède demande de décider quoi
  afficher pour un parent en corbeille : le conserver en option désactivée,
  ou refuser l'enregistrement. *Story à écrire.*

- **`REP-09` → story **0.3** — `recordAudit()` est best-effort, et c'est lui qui sert de contrepartie
  à une permission.** `lib/audit.ts` — il avale ses erreurs à dessein et
  s'exécute **après** la suppression déjà validée. Une panne transitoire sur
  l'insertion produit donc une destruction définitive, par un agent, sans
  trace autre qu'un `console.error`. Les quatre chemins réservés héritent du
  même trou ; la particularité de `deleteInteraction` est que le journal y
  est l'**argument** qui justifie d'ouvrir le geste à l'agent. *À rapprocher
  de la story 0.3 (collecte des erreurs), qui rendrait au moins l'échec
  visible.*

- **`REP-10` → story **4.5** — Une seconde soumission concurrente lève `P2025` au lieu de retomber sur
  « introuvable ».** Les cinq Server Actions font `findFirst` puis `delete`
  sans transaction et **sans `try/catch`**, là où leurs homologues d'API
  répondent un 500 JSON. Un double-clic, deux administrateurs sur la même
  ligne ou un rejeu de POST par le navigateur suffisent : l'exception
  remonte à la frontière d'erreur de Next, et `recordAudit` ne s'exécute
  pas. *Candidat pour la story 4.5, qui donnera l'endroit unique où poser
  ces séquences.*

- **`REP-11` → story **4.5** — `deleteInteraction` sans champ `id` lève une erreur de validation
  Prisma au lieu de sa branche « introuvable ».**
  `app/agency/interactions/actions.ts` — `formData.get("id") as string` vaut
  `null`, et `findFirst({ where: { id: null } })` échoue avant que
  `if (!interaction)` puisse répondre. Le cast `as string` masque le cas au
  typage. Préexistant ; la story 4.6 a élargi le `select` de cette requête
  sans resserrer son entrée.

- **`REP-12` → story **5.9** — `returnTo` n'est jamais validé, et c'est la seule action ouverte à tous
  les agents qui l'emprunte.** `app/agency/interactions/actions.ts` — une
  valeur absolue (`https://…`) est passée telle quelle à `revalidatePath()`
  puis à `redirect()`, emportant l'utilisateur hors du site avec une
  bannière de succès. Aucun contrôle de barre oblique initiale, aucune liste
  blanche. *Story à écrire ; candidate à l'épopée 5.*

- **`REP-13` → story **5.1** — La moitié `super_admin` des quatre nouveaux masques
  `isAgencyAdmin(userRole)` est inatteignable.** `requireAgency()` renvoie un
  éditeur vers `/admin` avant tout rendu. La story 4.6 ajoute quatre
  consommateurs d'une condition documentée comme morte : si la story 5.1
  rend le dépannage d'une agence possible, ce sont exactement ces quatre
  chemins qui auront été livrés sans test. *Appartient à BUG-10, story 5.1.*

- **`REP-14` → **résolu** — ~~Rien n'empêche de supprimer une échéance de gestion locative déjà
  réglée.~~** `app/agency/rental-management/[id]/edit/page.tsx` — `isPaid`,
  `paymentDate` et `amountToOwner` n'étaient ni lus ni contrôlés. La contrainte
  `@@unique([rentalId, month, year])` redevenant libre, une nouvelle ligne
  pouvait être créée pour la même période sans aucun lien avec la disparue. La
  docstring de l'action nommait pourtant ce scénario — « l'erreur ne se voit
  qu'au moment du versement » — comme motif du contrôle de rôle, et le rôle
  restait la seule condition vérifiée. *Hors périmètre de la 4.6 ; à traiter
  avec la comptabilité locative.*
  **Story 3.10, 17-08-2026 — arbitrage : refuser.** Une échéance non réglée
  est une prévision, on peut la jeter ; une échéance réglée est la trace d'un
  versement au propriétaire, et rien d'autre ne la porte. La troisième issue
  — permettre la suppression derrière une confirmation — n'est pas écartée
  sur le fond : elle appartient à la **story 3.13** (`REP-106`), qui pose le
  dispositif pour tout le produit. Le contrôle positif est joué par le même
  bouton : une échéance en attente reste supprimable.

## Deferred from: code review of story-1.2 (10-08-2026)

- **`REP-15` → story **5.2** — Course à l'inscription : 500 au lieu du message d'erreur.**
  `app/api/auth/register/route.ts:82` — le contrôle de doublon (`findUnique`)
  est hors de la transaction de création. Deux inscriptions simultanées sur la
  même adresse passent toutes deux le contrôle ; la seconde heurte la
  contrainte d'unicité et remonte en 500. L'AC 3 de la story 1.2 (« jamais une
  erreur 500 ») tient en séquentiel, pas en concurrence. La normalisation
  **élargit la fenêtre** : deux saisies de casses différentes entrent désormais
  en collision là où elles créaient auparavant deux comptes distincts.
  *Propriétaire : BUG-12, story 5.2.*

- **`REP-16` → story **4.7** — Les tests d'inscription accumulent des agences réelles.**
  `tests/regression.spec.ts:194` — deux agences et deux comptes créés à chaque
  exécution de la suite, jamais nettoyés, jusqu'à trois fois par run en CI
  (`retries: 2`). Aucun test ne casse aujourd'hui. Le nettoyage suppose un
  accès à la base depuis les tests, qui n'existe pas encore — à traiter avec
  l'outillage de test de l'épopée 4.

- **`REP-17` → story **4.7** — Les AC 5 et 6 de la story 1.2 n'ont aucune couverture automatisée.**
  `prisma/migrations/20260810000000_normalize_user_emails/migration.sql` — la
  migration a été exercée à la main sur une base jetable, et s'y est révélée
  cassée (`%%` en PL/pgSQL n'est pas un paramètre) : l'exercice a payé. Rien ne
  rejoue ce contrôle. Aucun runner unitaire n'est installé, et la story
  interdisait d'en ajouter un sans arbitrage. *À rapprocher de l'épopée 4.*

- **`REP-18` → story **2.5** — L'AC 2 de la story 1.2 n'est vérifiée qu'à moitié.**
  `app/auth/forgot/actions.ts:74` — « le jeton est créé » est prouvé en base ;
  « l'email part » ne l'est pas, SMTP n'étant pas configuré dans cet
  environnement. Le chemin d'envoi n'est pas modifié par la story. À revérifier
  le jour où SMTP est configuré, avant l'ouverture au public.

## Deferred from: code review of story-1.7 (10-08-2026)

- **`REP-19` → story **2.5** — L'AC 5 est devenu invérifiable par cette story même.** Les documents
  déposés à plat avant le 10-08-2026 restent lisibles, téléchargeables et
  supprimables — chemin complet tracé à la main, de `keyFromUrl` à
  `readFile`, il tient. Mais `ownsDocumentUrl` exigeant désormais
  `documents/<agencyId>/`, **plus aucun test ne peut fabriquer une telle
  ligne**. La couverture était atteignable avant ce commit, elle ne l'est
  plus après. *À reprendre avec l'outillage de l'épopée 4, qui donnera un
  accès en base depuis les tests.*

- **`REP-20` → story **2.5** — Un refus laisse un fichier orphelin sur le disque.**
  `app/agency/documents/new/page.tsx` — le téléversement précède la
  validation. Tout refus redirige et laisse le fichier écrit dans
  `documents/<agencyId>/` sans ligne en base, sans ramassage. Antérieur à
  cette story, mais elle multiplie les chemins de refus.

- **`REP-21` → story **2.5** — Le mode Supabase n'a aucune couverture automatisée.** L'environnement
  de test tourne en stockage local : la branche Supabase du schéma n'est
  jamais exécutée. Le motif a été confronté à la vraie sortie de
  `getPublicUrl` à la main, avec les trois formes de `SUPABASE_URL`
  (nue, barre finale, espaces) — relevé dans la story. Rien ne le
  rejouera. *À traiter avec l'ouverture du seau privé.*

## Deferred from: story 1.7 (10-08-2026)

- **`REP-22` → story **2.5** — Les gardes de lecture n'ont plus de couverture de bout en bout.**
  `lib/documents.ts` et le verrou de chemin de `lib/storage.ts` arrêtent
  une donnée qu'aucun chemin de l'interface ne peut plus produire, depuis
  que l'écriture la refuse. Deux tests ont donc été retirés : ils ne
  testaient plus la garde, ils testaient le formulaire. Ces gardes restent
  nécessaires — elles couvrent les lignes écrites avant le 10-08-2026 et
  tout futur chemin d'écriture qui oublierait la vérification — mais elles
  sont désormais de la défense en profondeur **sans filet**. Les couvrir
  demande de pouvoir écrire en base depuis les tests, ce qui n'existe pas.
  *À traiter avec l'outillage de l'épopée 4.*

- **`REP-23` → story **2.5** — La tolérance héritée de `lib/documents.ts` est un régime temporaire.**
  Les documents déposés à plat avant le 10-08-2026 restent lisibles par
  exception. Elle ne pourra être retirée que le jour où plus aucune ligne
  ne porte d'adresse sans sous-dossier d'agence — ce qui suppose de savoir
  le vérifier, donc une requête de contrôle, pas une intuition.

## Deferred from: code review of story-1.3 (10-08-2026)

- **`REP-24` → **résolu** — ~~Le port applicatif 3000 est publié hors de nginx.~~ Traité par la
  story 2.1 le 11-08-2026**, pour un appelant distant : la publication est
  retirée, `aqar-frontend-prod` n'expose plus que `3000/tcp`. Il reste
  ouvert **depuis l'hôte** par l'adresse de conteneur — aucun réglage de
  docker-compose ne ferme ce chemin, il y faut une règle `DOCKER-USER`.
  Voir l'entrée dédiée plus bas.

- **`REP-25` → story **2.5** — Une bascule de mode de stockage rend illisibles les documents déjà
  enregistrés.** `lib/storage.ts` — `keyFromUrl` extrait une clé quelle que
  soit la forme de l'URL, mais `readFile` la cherche dans le mode *courant*.
  Un document créé en local puis lu après passage en Supabase répond 404,
  alors que le fichier est intact sur le volume ; et réciproquement. Le 404
  est indiscernable d'une suppression, sans journal. Le refus au démarrage
  ajouté par cette story pousse précisément vers cette bascule.
  *À traiter avec l'ouverture du seau privé.*

- **`REP-26` → story **1.7** — La page d'édition d'un document affiche et laisse modifier l'`url`.**
  `app/agency/documents/[id]/edit/page.tsx:131-139` — champ en clair,
  `type="url"`, repassé tel quel dans `documentSchema`. Le retrait de
  l'affichage fait par la story 1.3 ne porte que sur l'écran de
  consultation. C'est ce champ qui rend exploitables les constats de
  cloisonnement. *Propriétaire : BUG-21/BUG-23, story 1.7.*

- **`REP-27` → story **2.5** — Un fichier de 0 octet est servi en 200.**
  `app/api/documents/[id]/file/route.ts:61` — un dépôt interrompu se
  télécharge « avec succès » et ne s'ouvre pas, sans message. Mineur, mais
  indistinguable d'un fichier valide côté utilisateur.

- **`REP-28` → story **2.5** — `target="_blank"` sur une réponse `Content-Disposition: attachment`.**
  `app/agency/documents/page.tsx` et `[id]/page.tsx` — plusieurs
  navigateurs laissent un onglet vide après le téléchargement. Cosmétique.

## Deferred from: story 1.3 (10-08-2026)

- **`REP-29` → story **2.5** — Le mode de stockage Supabase est bloqué, pas réparé.**
  `lib/storage.ts:88` — `putFile()` enregistre l'adresse rendue par
  `getPublicUrl()` : le seau est public, et il sert aussi les photos de
  biens, qui doivent le rester pour la vitrine. La route protégée ne
  s'interpose donc pas. `lib/env.ts` fait désormais refuser le démarrage
  en production dans ce mode — position sûre, mais qui interdit toute
  bascule vers Supabase tant qu'un **second seau, privé, dédié aux
  documents** n'est pas ouvert (`SUPABASE_DOCUMENTS_BUCKET`, lecture par
  URL signée ou par `download()` côté serveur). `readFile()` sait déjà
  télécharger côté serveur : l'essentiel du travail restant est la
  configuration et la séparation des deux seaux à l'écriture.
  *À rouvrir avant tout déploiement sur stockage objet.*

- **`REP-30` → story **4.7** — AC 1 et AC 4 ne sont pas rejoués par la suite automatisée.**
  L'accès direct à un fichier (`/uploads/documents/…` → 404,
  `/uploads/properties/…` → 200) dépend de `nginx/nginx.conf`, absent de
  l'environnement de test, et `next start` fige l'inventaire de `public/`
  au démarrage. Les relevés sont dans le Debug Log de la story 1.3, faits
  à la main sur la pile Docker. Rien ne les rejouera après une prochaine
  modification de `nginx.conf`. *À rapprocher de l'épopée 4.*

- **`REP-31` → story **4.7** — Les tests d'accès aux documents laissent des traces en base.**
  `tests/regression.spec.ts` — chaque exécution crée des documents et des
  fichiers dans `public/uploads/documents/`, et le test de cloisonnement
  inscrit **puis active** une agence, qui reste ensuite active. C'est le
  même manque que celui déjà relevé pour l'inscription, en plus visible :
  une agence active de trop fausse les compteurs de la console super
  admin. Le nettoyage suppose un accès à la base depuis les tests, qui
  n'existe pas encore. *À traiter avec l'outillage de l'épopée 4.*

- **`REP-32` → story **5.7** — `location` est sensible à la casse chez nginx.**
  `nginx/nginx.conf` — le bloc de refus porte sur `/uploads/documents/`.
  Sur un système de fichiers indifférent à la casse, `/uploads/DOCUMENTS/`
  passerait à côté et serait servi par le bloc `/uploads/`. Le volume est
  Linux, donc le point est théorique aujourd'hui ; il cesse de l'être le
  jour d'un déploiement ailleurs. Le remède tient en une directive
  (`location ~* ^/uploads/documents/`). *Candidat pour la story 5.7,
  qui touche déjà nginx.*

- **`REP-33` → story **5.9** — `lib/validations/index.ts` est écrit en français non accentué.**
  ~40 messages d'erreur affichés aux utilisateurs via `parseForm`. Le
  `registerSchema` a été accentué lors de la revue de la story 1.2, parce que ce
  changement y avait introduit une régression ; le reste du fichier ne l'a pas
  été. Accentuer l'ensemble casse au moins `tests/regression.spec.ts:56`, qui
  attend « au moins un telephone ou un email ». C'est donc une story à part
  entière : texte **et** tests. *Candidate pour l'épopée 5.*

## Deferred from: story-1.4 (10-08-2026)

- **`REP-34` → story **5.10** *(explicitement hors périmètre de la 1.9, qui l'écrit dans `lib/rate-limit.ts`)* — La rotation d'adresses IP réelles reste ouverte.**
  `lib/rate-limit.ts` — la story 1.4 garantit que l'appelant ne peut plus
  **choisir** son identité par un en-tête. Elle ne peut rien contre celui
  qui en possède réellement plusieurs : botnet, sortie mobile en CGNAT,
  fournisseur de proxys résidentiels. Compter par adresse ne répond pas à
  ce cas — il y faut une épreuve dont le coût est porté par l'appelant
  (captcha, preuve de travail) ou un signal de réputation. Les deux points
  exposés sont l'inscription et le formulaire public de la vitrine.
  *Story à écrire ; ni l'épopée 1 ni l'épopée 2 ne la couvrent.*

- **`REP-35` → story **0.3** — Le compteur `inconnu` est un point de rassemblement.**
  `lib/rate-limit.ts` — si `X-Real-IP` venait à manquer en production
  (proxy remplacé, en-tête oublié), tout le trafic tomberait dans un
  compteur unique et l'inscription se fermerait à cinq par heure pour
  l'ensemble des visiteurs. Le comportement est prudent — fermé plutôt
  qu'ouvert — mais silencieux : rien ne le signale. Un compteur du nombre
  de requêtes tombées dans `inconnu`, remonté avec les erreurs, le
  rendrait visible. *Dépend de la story 0.3 (collecte des erreurs).*

- **`REP-36` → story **5.6** — La limitation reste locale au processus.**
  Déjà connu et documenté en tête de `lib/rate-limit.ts` : derrière
  plusieurs instances, chacune compte de son côté et la limite réelle est
  multipliée par leur nombre. C'est BUG-18, story 5.6. Rien de neuf ici,
  mais la story 1.4 ne le corrige pas et il serait faux de laisser croire
  le contraire.

## Deferred from: code review of story-1.4 (10-08-2026)

- **`REP-37` → **fermé par la story 1.9** — 🔴 Un tiers verrouille n'importe quel compte dont il connaît l'adresse.**
  `auth.ts:69-79` — `login:compte:${email}` est consommé **avant** la
  vérification du mot de passe, et n'est effacé qu'en cas de succès —
  succès que la limite empêche d'atteindre. Dix mots de passe faux par
  quart d'heure suffisent donc à bloquer le titulaire, pour un coût de
  quarante requêtes par heure. Les adresses des directeurs d'agence sont
  publiées sur les vitrines. La voie de secours ferme aussi :
  `oubli:compte:` est limité à cinq par heure. Défaut antérieur à la
  story 1.4 et hors de son périmètre, mais réel et facile à exploiter.
  Le remède habituel est de ne compter que les échecs *après* avoir
  constaté que le mot de passe est faux, et de distinguer verrouillage et
  ralentissement. *Story à écrire — candidate à l'épopée 1.*

- **`REP-38` → **fermé par la story 1.9** — La fenêtre fixe autorise le double du budget à sa frontière.**
  `lib/rate-limit.ts` — dix essais juste avant l'expiration, dix juste
  après : vingt en quelques secondes là où le seuil annonce dix. Le
  commentaire assume la fenêtre fixe, mais ne chiffre pas ce qu'elle
  coûte. Une fenêtre glissante ou un seau à jetons le supprime.

- **`REP-39` → **fermé par la story 1.9** — `.some()` gèle le compteur par compte dès que celui par adresse sature.**
  `app/auth/login/actions.ts:42`, `app/auth/forgot/actions.ts:57` —
  `.some()` s'arrête au premier `true`, donc le second `rateLimit` n'est
  plus appelé. Un attaquant qui sature volontairement le compteur par
  adresse retarde d'autant le redémarrage de celui par compte. Les
  budgets ne sont pas indépendants, contrairement à ce que dit le
  commentaire.

- **`REP-40` → **fermé par la story 1.9** — Rien n'échappe les segments d'une clé de compteur.**
  `lib/rate-limit.ts` — `login:ip:${ip}`, `explication:compte:${email}`…
  Aucune collision n'existe aujourd'hui (vérifié par exécution sur le
  produit croisé des préfixes et d'adresses hostiles), mais elle tient à
  ce que `isIP` refuse `@` et que les préfixes ne soient préfixes d'aucun
  autre. Un futur `rateLimit({ key: 'lead:' + agencyId })` sur un
  identifiant libre casserait l'invariant sans que rien ne le signale.

- **`REP-41` → story **0.3** — Le repli sur `inconnu` n'est pas instrumenté.**
  `lib/rate-limit.ts` — un avertissement est désormais émis au premier
  appel, mais rien ne compte combien de requêtes y tombent. Si l'en-tête
  venait à manquer en production, l'inscription se fermerait à cinq par
  heure pour tout le monde et la console n'en dirait plus rien après la
  première ligne. *Dépend de la story 0.3 (collecte des erreurs).*

- **`REP-42` → story **5.6** — Le plafond de 50 000 compteurs est un garde-fou, pas une réponse.**
  Sous inondation, les nouveaux appelants sont refusés — indisponibilité
  bornée et volontaire, préférée à l'effondrement du processus. La vraie
  réponse reste un magasin partagé et borné : BUG-18, story 5.6.

## Deferred from: code review of story-1.5 (11-08-2026)

- **`REP-43` → story **4.7** — Le chemin complet « formulaire de vitrine → email » n'est couvert par
  aucun test.** `tests/regression.spec.ts` — les trois tests
  d'échappement appellent `emailLayout` en reconstruisant le corps à la
  main. Ils survivraient intacts si `submitLead` cessait d'appeler
  `notifyAgencyOfLead`, ou si le paragraphe du message disparaissait de
  l'email. Le mécanisme d'échappement est prouvé ; son *branchement* ne
  l'est pas. Un test de bout en bout suppose de lire l'email produit,
  donc un harnais où `NODE_ENV` n'est pas « production » ou un serveur
  SMTP jetable. *Candidat pour l'épopée 4.*

- **`REP-44` → story **4.7** — Aucun test ne rend un email légitime.** Activation, inscription,
  réinitialisation : la non-régression a été vérifiée à la main, en
  comparant le rendu avant et après le commit. Rien ne retiendra une
  régression future sur ces trois emails — dont celui qui porte le seul
  lien critique du produit.

- **`REP-45` → story **5.9** — Le sujet n'est pas encodé RFC 2047 dans la boîte locale.**
  `lib/mailer.ts` — `Subject:` est écrit brut dans le `.eml`, sans
  encoded-word. Tout sujet non-ASCII s'affiche en mojibake à l'ouverture,
  et la troncature ajoutant « … » rend le cas systématique sur les sujets
  longs. Défaut antérieur, portée développement. nodemailer encode
  correctement sur le vrai chemin SMTP.

- **`REP-46` → story **5.9** — `sendMail({ html })` reste une porte ouverte.** `lib/mailer.ts` — le
  typage empêche un appelant de `emailLayout` de produire une balise,
  mais rien n'empêche un futur appelant de fabriquer son HTML à la main
  et de le passer directement à `sendMail`. Aucun ne le fait aujourd'hui.
  Le remède serait un type nominal (`html: HtmlSur`) que seul
  `emailLayout` sait produire.

- **`REP-47` → story **3.1** — `ownerSchema` et `clientSchema` n'ont pas de borne sur `firstName` /
  `lastName`.** `lib/validations/index.ts` — atteignables seulement par
  une agence connectée, contrairement à `leadSchema`. *Relève de la
  story 3.1.*

## Deferred from: code review of story-1.6 (11-08-2026)

- **`REP-48` → story **4.7** — Sept des huit entités exportables ne sont couvertes par aucun test de
  neutralisation.** `tests/regression.spec.ts` — seul l'export des
  messages est vérifié de bout en bout. La couverture des sept autres est
  démontrée par lecture (toutes passent par `toCsv`), pas par la suite.
  Un futur export qui construirait son CSV autrement ne serait retenu par
  rien. *Candidat pour la story 4-4.*

- **`REP-49` → story **4.7** — Chaque exécution de la suite laisse en base un message hostile.**
  `tests/regression.spec.ts` — le test de bout en bout crée un `lead`
  contenant `=HYPERLINK(...)`, jamais nettoyé ; seul un reseed les efface.
  Même famille que les agences de test accumulées, déjà consignée.
  *À traiter avec l'outillage de l'épopée 4.*

## Deferred from: code review of story-2.1 (11-08-2026)

- **`REP-50` → story **2.3** — Le chemin hôte → conteneur reste ouvert, et seul un pare-feu le
  ferme.** `docker-compose.prod.yml` — retirer `ports` supprime la
  redirection depuis l'hôte, pas l'adresse que Docker donne au conteneur :
  `curl http://<ip-du-conteneur>:3000/api/public/health` répond 200, avec
  un `X-Real-IP` forgé. Vérifié qu'aucun réglage de compose n'y change
  quoi que ce soit, `internal: true` compris. La fermeture réelle est une
  règle dans la chaîne `DOCKER-USER` d'iptables, écrite au déploiement et
  non dans le dépôt — elle dépend du nom d'interface et du sous-réseau de
  la machine. *À traiter avec la story 2.3 (mise en ligne) ou dans la
  procédure de déploiement.*

  Conséquence à garder en tête : l'identification de l'appelant
  (story 1.4) est fiable face à un appelant distant, pas face à un
  processus tournant sur la même machine. Acceptable sur un serveur dédié
  à cette pile ; pas sur une machine partagée.

## Deferred from: story-2.4 (11-08-2026)

- **`REP-51` → story **2.3** — 🟠 Recréer le conteneur applicatif laisse nginx en 502, sans qu'aucun
  conteneur ne paraisse en défaut.** `nginx/nginx.conf` — le bloc
  `upstream nextjs` résout `frontend` **une seule fois, au démarrage** de
  nginx. Après `docker compose up -d frontend`, le conteneur reçoit une
  nouvelle adresse et nginx continue de viser l'ancienne. Constaté :
  `:8095` en 502 alors que `frontend` et `postgres` étaient tous deux
  `healthy` ; `docker restart aqar-nginx-prod` a suffi.

  Ce n'est pas un détail : `docker compose up -d frontend` est le geste
  naturel d'un déploiement, et il laisse le site hors service en silence.
  Le remède habituel est de faire résoudre nginx à chaque requête —
  `resolver 127.0.0.11 valid=10s;` et un `proxy_pass` passant par une
  variable — ce qui change la façon dont nginx traite l'amont et mérite
  d'être fait avec ses propres tests. *Candidat pour la story 2.3, qui
  touche déjà nginx, ou une story d'exploitation dédiée.*

## Deferred from: code review of story-2.4 (11-08-2026)

- **`REP-52` → story **2.3** — 🟠 Le sous-réseau Docker de la pile n'est pas épinglé, et il est tombé
  sur `192.168.0.0/20`.** `docker-compose.prod.yml` — aucun bloc `ipam` :
  Docker a pioché dans son pool par défaut, `172.16.0.0/12` étant épuisé
  sur cette machine (quinze réseaux `br-*`). Deux conséquences. Sur un
  serveur dont le réseau local est en `192.168.0.0/24` ou
  `192.168.1.0/24` — le cas le plus courant — l'allocation chevauche le
  LAN : routage cassé, ou adresses de conteneurs en collision avec des
  machines réelles. Et la règle `DOCKER-USER` recommandée à trois endroits
  vise un sous-réseau **non déterministe**, qui change au prochain cycle
  de création de réseaux.

  Le remède est un bloc `ipam` fixant un préfixe improbable. Reporté
  parce qu'il impose de recréer le réseau, donc d'arrêter toute la pile —
  à faire dans une fenêtre choisie, pas au détour d'une story de
  durcissement. *Candidat pour la story 2.3, qui touchera de toute façon
  au déploiement.*

- **`REP-53` → story **2.3** — Le profil `seed` reste disponible sur la pile de production, et les
  comptes de démonstration ont un mot de passe public.**
  `docker-compose.prod.yml`, `README.md` — `superadmin@aqar.dz` /
  `password123` est documenté dans le dépôt. Durcir le mot de passe
  PostgreSQL pendant qu'un profil peut planter un super-admin à mot de
  passe connu est incohérent. *À traiter avec l'ouverture à un premier
  client réel.*

- **`REP-54` → story **4.7** — Le garde-fou de configuration coûte une construction complète.**
  `playwright.config.ts` — les tests qui ne font que lire un fichier
  déclenchent quand même `npm run build && npm start` (420 s de délai).
  Un garde-fou d'infrastructure aussi cher est un garde-fou qu'on cesse
  de lancer, précisément sur les commits qui ne touchent qu'à la
  configuration. Un projet Playwright sans `webServer`, ou un script
  distinct, réglerait le point. *Candidat pour l'épopée 4.*

## Deferred from: code review of story-2.2 (11-08-2026)

- **`REP-55` → story **2.5** — 🟠 Le contrôle par signature prouve les premiers octets, pas le
  fichier.** `lib/file-type.ts` — un PNG authentique peut contenir
  n'importe quoi après son en-tête ; c'est exactement ainsi qu'est
  construit un fichier polyglotte. La story 2.2 ferme « un fichier
  arbitraire est admis sur la seule parole du client », elle ne ferme pas
  « un fichier réellement construit comme une image l'est aussi comme
  autre chose ».

  La fermeture réelle est le **ré-encodage** de l'image (`sharp`), qui
  détruit tout ce qui n'est pas de l'image — et qui est **impossible pour
  le PDF**, dont il faudrait alors décider séparément du sort. Reporté
  parce que cela ajoute une dépendance native, un coût CPU par dépôt et
  une décision produit sur les PDF : trois choses qui méritent leurs
  propres tests. *Candidat pour l'épopée 5.*

- **`REP-56` → story **2.5** — Le budget de dépôt ne borne pas le disque.** `app/api/upload/route.ts`
  — 40 fichiers de 5 Mo par tranche de dix minutes font 1,2 Go par heure
  et par agence, et le total croît avec le nombre d'agences. La limite
  retire le cas « des milliers de fichiers par minute » et laisse le
  temps de voir venir ; elle ne remplace pas un **quota de stockage** par
  agence, ni une surveillance du volume. *À traiter avec l'ouverture à un
  premier client réel, en même temps que le stockage objet (story 0.1).*

- **`REP-57` → story **2.5** — Les types admis ne sont pas découpés par dossier.** Un PDF
  authentique déposé avec `type: "properties"` est rangé dans le dossier
  public des photos et rendu dans une balise `<img>`. Défaut antérieur à
  la story 2.2, qui ne l'aggrave pas. Non trivial : `DocumentUploadField`
  accepte `.pdf,.jpg,.jpeg,.png,.webp`, un contrat scanné en JPEG étant
  légitime — il faut donc une table dossier → types, pas un simple
  resserrement. Qualité d'affichage, pas sécurité. *Candidat pour
  l'épopée 5.*

- **`REP-58` → story **4.7** — Quatre des cinq navigateurs de `playwright.config.ts` ne sont jamais
  exécutés.** Le fichier déclare chromium, firefox, webkit, Mobile Chrome
  et Mobile Safari ; seuls les moteurs Chromium sont installés sur la
  machine de développement, et toutes les mesures des stories 1.x et 2.x
  portent sur `--project=chromium`. Un lecteur du fichier croit à une
  couverture multi-navigateurs qui n'existe pas. Deux issues : installer
  les moteurs (`npx playwright install`) et assumer le temps de suite, ou
  réduire la liste à ce qui tourne vraiment et documenter le choix.
  *Candidat pour l'épopée 4.*

## Deferred from: code review of story-4.1 (11-08-2026)

- **`REP-59` → story **4.7** — Trois helpers de connexion pour une seule action.**
  `tests/regression.spec.ts` et `tests/features.spec.ts` ont chacun leur
  `login()` local, à côté de `tests/auth-helper.ts` que la story 4.1
  vient de rendre réel. Les trois font la même chose avec des attentes
  différentes. Les unifier toucherait soixante-dix tests qui passent —
  un risque sans rapport avec le défaut que 4.1 corrigeait. *Candidat
  pour la fin de l'épopée 4, une fois 4.2 et 4.3 écrites : elles
  ajouteront des besoins qu'il vaut mieux connaître avant de figer le
  helper commun.*

- **`REP-60` → story **4.4** — Aucune passe systématique sur les routes `/api/*`.** La table de
  `acces.spec.ts` couvre les 31 pages protégées et rien d'autre.
  `/api/upload` est couverte par ailleurs ; les autres routes API n'ont
  aucune vérification d'accès systématique, alors que `middleware.ts`
  leur applique un refus par défaut dont rien ne prouve qu'il tient.
  *Appartient à la story 4.4.*

- **`REP-61` → story **4.7** — Un `200` ne prouve pas qu'une page ne lève pas** — noté ici parce
  que la leçon dépasse cette story. Next diffuse le rendu en flux :
  l'en-tête part avant l'exception, et `app/error.tsx` prend la suite
  dans le corps de la réponse. Tout test qui se contente d'un code HTTP
  pour dire « la page fonctionne » est vert sur une page en erreur.
  *À garder en tête pour 4.2, 4.3 et toute story qui vérifie un rendu.*

## Deferred from: story-4.2 (11-08-2026)

- **`REP-62` → story **4.5** — 🟡 Une page qui n'existe pas répond `200`.** Découvert en écrivant les
  tests de cloisonnement. Les dix-sept pages `[id]` de l'espace agence
  appellent `notFound()` et affichent bien « Cette page n'existe pas » —
  mais avec un statut `200`. Le rendu est diffusé en flux : l'en-tête est
  déjà parti quand le composant serveur tranche. Une adresse ne
  correspondant à **aucune** route rend bien `404`, parce que Next décide
  avant tout rendu ; la différence tient là.

  Sans conséquence sur le cloisonnement — aucune donnée ne sort — mais
  réel : un moniteur de disponibilité, un robot d'indexation et un cache
  HTTP lisent tous « tout va bien » sur une page introuvable. Le remède
  connu est de trancher **avant** de commencer à rendre, c'est-à-dire de
  résoudre la ressource dans un endroit qui s'exécute avant le flux
  (couche métier appelée en amont, ou vérification dans le middleware
  lorsqu'elle est possible sans base). *Lié à la story 4.5, qui extrait
  justement une couche métier.*

- **`REP-63` → story **4.5** — La leçon, plus large que le défaut : un code HTTP ne prouve pas ce
  qui est rendu.** Elle a coûté deux fois en deux jours — la mutation C
  de la story 4.1, puis dix-sept assertions écrites avant d'être
  mesurées dans la story 4.2. Tout test qui conclut « la page fonctionne »
  ou « la page est refusée » à partir d'un statut seul est à revoir.
  *À appliquer en écrivant 4.3 et 4.4.*

## Deferred from: story-4.3 (11-08-2026)

- **`REP-64` → story **4.5** — 🟡 Aucune Server Action n'est éprouvée directement.** Découvert en
  voulant vérifier qu'un administrateur ne peut ni se désactiver ni
  changer son propre rôle (`app/agency/users/page.tsx`). Une Server
  Action ne se déclenche pas par une requête ordinaire : il faut
  l'identifiant que Next injecte dans le formulaire. De l'extérieur, on
  ne peut donc éprouver que le **rendu** — un bouton présent ou absent —
  et non le contrôle serveur.

  Ce n'est pas propre à ce contrôle : **toute** la logique métier écrite
  en Server Actions est dans ce cas — création de compte, changement de
  rôle, réinitialisation, paramètres d'agence, corbeille. Les routes
  `/api/*` sont éprouvables, les Server Actions ne le sont qu'à travers
  l'interface qui les appelle.

  Deux issues : passer par l'interface (ce que font déjà plusieurs tests,
  au prix de la lenteur et de la fragilité), ou extraire la règle dans
  une fonction pure appelée par l'action — ce qui la rend testable
  directement. *La seconde rejoint exactement la story 4.5, « extraire
  une couche métier ».*

- **`REP-65` → story **5.1** — Le garde « dernier administrateur actif » de la console d'agence est
  inatteignable.** `app/agency/users/page.tsx`, deux occurrences. L'acteur
  y est toujours un `agency_admin` actif de l'agence, distinct de sa cible
  (l'action sur soi-même est refusée plus haut) : le décompte des
  restants n'est donc jamais nul. Conservé — c'est un filet gratuit qui
  redeviendrait utile si le contrôle « pas soi-même » changeait — mais
  documenté comme dormant. *À revoir avec BUG-10 (story 5.1), qui traite
  la même famille : une branche morte sous un commentaire qui promet
  qu'elle vit.*

## Deferred from: story-4.4 (11-08-2026)

- **`REP-66` → story **4.7** — 🟠 La suite se reconnecte à chaque cas, et cela commence à coûter.**
  93 cas, chacun ouvrant une à trois sessions, chaque session vérifiant
  un mot de passe avec bcrypt au coût 12 — volontairement lent — sur un
  seul processus serveur partagé par quatre travailleurs. Deux exécutions
  consécutives ont échoué sur des connexions expirées, sur des tests
  différents et sans rapport entre eux. Le délai par cas a été porté de
  30 à 90 s : c'est un pansement, écrit comme tel dans
  `playwright.config.ts`.

  Le remède est le mécanisme prévu pour cela : un projet de préparation
  qui ouvre une session par rôle (`super_admin`, `agency_admin`, `agent`)
  et enregistre son `storageState`, que les autres réutilisent. Cela
  supprimerait des dizaines de vérifications bcrypt et rendrait la suite
  franchement plus rapide. C'est une refonte du harnais, donc sa propre
  story. *Candidat pour la fin de l'épopée 4, après 4.5.*

- **`REP-67` → story **4.7** — Les tests qui inscrivent une agence ne nettoient rien.** 164 agences
  et 213 comptes se sont accumulés au fil du projet — tous créés par des
  tests qui inscrivent pour éprouver autre chose (normalisation d'email,
  budget de dépôt). Les stories 4.2 et 4.3 nettoient les leurs ; les plus
  anciennes non.

  Sans conséquence sur les résultats aujourd'hui, mais `/admin/agencies`
  s'allonge à chaque exécution, et le test du budget de dépôt y cherche
  une ligne. Le remède est le même que pour 4.2 : créer par `tests/agence.ts`
  et effacer dans un `finally`. *Candidat pour la story de refonte du
  harnais ci-dessus.*

## Deferred from: résolution de la revue de la story 1.8 (12-08-2026)

- **`REP-68` → story **4.5** — 🟠 Une garde qui redirige ne produit pas un `307` : elle produit un
  `200` puis une navigation côté client.** Découvert en écrivant les tests
  de cette revue, et c'est la troisième fois que la diffusion en flux coûte
  du temps sur ce dépôt. Toutes les pages de `/admin` et `/agency` ont un
  `loading.tsx` : Next envoie donc le squelette — donc l'en-tête de la
  réponse — **avant** que la garde n'ait tranché. Le `redirect()` ne peut
  plus être un en-tête `Location` ; Next l'émet dans le flux et c'est le
  routeur client qui navigue.

  **Mesuré le 12-08-2026** sur l'instance, avec une sonde posée dans
  `requireSuperAdmin()` : sur un compte rétrogradé, la garde lit bien
  `role: "agency_admin"` en base et appelle `redirect("/agency")` — et la
  réponse HTTP brute est un **`200` sans `Location`**. Le refus est réel,
  la garde s'exécute avant toute lecture de données, mais il est **rendu
  par le navigateur**.

  Trois conséquences, dont une qui n'est pas qu'un détail de test :
  1. Tout test qui lit `page.url()` juste après `goto()` lit l'adresse
     *avant* la redirection. Il échoue sur un produit correct — ou, pire,
     passe sur un produit cassé. Utiliser `waitForURL`, ou asserter le
     **contenu**.
  2. Un moniteur de disponibilité, un robot d'indexation et un cache HTTP
     lisent `200` sur une page refusée. Même famille que le `notFound()`
     à `200` déjà consigné (story 4.2).
  3. **La question qui reste ouverte :** que contient exactement ce corps
     déjà parti ? Le raisonnement dit « le squelette de `loading.tsx` et
     rien d'autre », puisque `await requireSuperAdmin()` précède toute
     requête de données dans les cinq pages. Le raisonnement n'est pas une
     mesure — et c'est précisément ce que la story 1.8 reproche à
     `docs/architecture.md`. *À mesurer : relever le corps rendu à un
     compte refusé, sur les deux espaces, et le consigner. Puis décider
     s'il faut trancher avant le flux (couche métier appelée en amont —
     story 4.5) ou l'accepter en l'écrivant.*

- **`REP-69` → story **4.7** — `waitForLoadState("networkidle")` a masqué une Server Action en vol.**
  `tests/regression.spec.ts` — le test d'activation d'agence poursuivait
  dès que le réseau se taisait, effaçait les cookies pendant que
  l'activation était encore en cours, puis se connectait à une agence
  restée « en attente ». L'échec tombait 90 s plus tard sur un
  `waitForURL` de connexion, à trente lignes de sa cause — un symptôme qui
  ne désigne rien. Corrigé ici en attendant l'**effet** (le badge de la
  ligne) plutôt que le silence du réseau.

  **Et la leçon était déjà écrite, dans ce fichier même.**
  `tests/regression.spec.ts:319` porte le commentaire « Attendre l'URL et
  non `networkidle` : une Server Action ne provoque pas de chargement de
  document, et `networkidle` peut se résoudre avant ». Elle avait été
  apprise, écrite, puis pas appliquée cent dix lignes plus bas. **Il reste
  8 autres `waitForLoadState("networkidle")`** dans ce fichier
  (`grep -c networkidle tests/regression.spec.ts`), tous verts aujourd'hui,
  tous du même modèle. Aucun ne mérite d'être touché sans raison — mais
  aucun ne prouve ce qu'il a l'air de prouver. *À reprendre en bloc avec la
  refonte du harnais (fin de l'épopée 4), où ils seront tous relus d'un
  coup plutôt qu'un par un le jour où ils rougissent.*

- **`REP-70` → story **5.9** — La saisie d'un formulaire soumis après expiration est toujours perdue.**
  `middleware.ts` — la redirection est passée de `307` à `303` pour les
  méthodes non-GET, ce qui affiche enfin l'écran de connexion au lieu de
  re-POSTer le corps de la Server Action vers une adresse qui n'en connaît
  aucune, avec un motif et un `callbackUrl` qui ramène sur la page quittée.
  **Mais le contenu saisi, lui, n'est pas restitué** : le rendre suppose de
  le retenir côté client avant l'envoi — un mécanisme à concevoir, à poser
  sur les formulaires longs (bien, bail, gestion locative) et à éprouver.
  Devenu quotidien depuis que `maxAge` est à 12 h : tout onglet laissé
  ouvert la veille. *Story à écrire ; candidate à l'épopée 5.*

- **`REP-71` → story **4.7** — `tests/agence.ts` nettoie encore par `finally`, et `tenancy.spec.ts`
  en dépend.** Le décor jetable de `roles.spec.ts` est désormais effacé par
  `afterEach`, parce qu'un dépassement de délai n'exécute **pas** un
  `finally` — c'est ainsi qu'un compte `super_admin` à mot de passe connu
  pouvait s'installer définitivement en base. Le même raisonnement vaut
  pour les agences créées par `tenancy.spec.ts`, qui partagent le helper
  `creerAgence` / `effacerAgence` : un dépassement y laisse une agence
  active de plus, qui fausse les compteurs de la console super admin.
  Corrigé seulement du côté `roles.spec.ts`, la portée du helper partagé
  dépassant cette revue. *À traiter avec la refonte du harnais de test
  (fin de l'épopée 4), qui reprendra de toute façon les décors.*

## Deferred from: code review of story-1.8 (12-08-2026)

- **`REP-72` → story **4.6** — « Les 31 Server Actions » est un dénombrement faux, et il sert d'argument
  d'exhaustivité.** `docs/architecture.md` §3 affirme que le cloisonnement est
  vérifié « sans exception dans les 31 Server Actions », et §10 s'appuie sur le
  même chiffre. Recompté le 12-08-2026 : l'arbre porte **44 directives
  `"use server"`**, dont quatre en tête de fichier (`app/agency/interactions`,
  `app/auth/forgot`, `app/auth/login`, `app/vitrine/[slug]`) qui couvrent
  chacune plusieurs actions exportées. Le chiffre 31 vient de l'audit du 9 août
  et a été repris de document en document sans être revérifié — la story 1.8 l'a
  elle-même propagé en écrivant « ses 31 appelants » là où l'arbre en compte 66.
  Le fond n'est pas en cause (aucune fuite trouvée, aucun appelant à toucher) ;
  c'est le dénombrement qui ne tient pas, et il est cité comme preuve de
  couverture. *Préexistant à cette story, hors de son périmètre. À recompter
  avant de s'appuyer encore dessus — de préférence pendant la story 4.6, qui doit
  justement produire l'inventaire des Server Actions destructives.*

  > **Réassigné à la story 5.11 le 13-08-2026.** La story 4.6 est passée
  > `done` le 12-08-2026 **sans traiter ce constat** : l'affirmation est
  > toujours dans `architecture.md` §3. Le trou de procédure que cela révèle
  > est inscrit à part, en `REP-76`. Recompté depuis : ce n'est pas 44 mais
  > **45** Server Actions — 40 inline, plus 5 exportées par les 4 modules
  > `"use server"`, que « 44 directives » ne comptait qu'une fois chacune.

- **`REP-73` → story **4.5** — Constat hors périmètre versé dans `docs/architecture.md` §8 point 6 par la
  story 1.8, sans story propriétaire.** Le net à reverser au propriétaire est
  calculé à quatre endroits (`lib/format.ts:70`, création, édition, et la
  quittance PDF), et la colonne `RentalManagement.amountToOwner` est écrite par
  trois chemins et relue par aucun. Vérifié le 12-08-2026 : les quatre formules
  concordent aujourd'hui. Le constat est exact et vaut d'être conservé, mais il
  n'appartient ni à la story 1.8 ni à aucun défaut du registre. *À rattacher à la
  story 4.5 (couche métier testable), qui donnera l'endroit unique où poser ce
  calcul et le premier test qui l'exercera.*

## Deferred from: inventaire des branches (13-08-2026)

- **`REP-77` → story **1.1** — 🔴 Une branche distante suit encore la clé Figma, et personne ne le
  savait.** `origin/feature/design-improvements` — `mcp-config.json` y est
  **toujours suivi**, clé `figd_…` comprise, et la branche est **poussée sur
  GitHub**. Vérifié le 13-08-2026 par
  `git ls-tree -r --name-only origin/feature/design-improvements | grep mcp-config`,
  puis `git show origin/feature/design-improvements:mcp-config.json`.

  **Conséquence directe sur BUG-19 : purger l'historique de `main` n'aurait
  pas fermé le défaut.** Le point de divergence est `a529f61` — précisément
  le commit qui a introduit la clé — donc elle est dans l'historique des
  deux branches. Le report du 10-08-2026 ne connaissait que `main`.

  Cette branche n'est mentionnée dans **aucun** document du dépôt. Elle
  porte par ailleurs 58 commits jamais fusionnés (modules Équipe, Contacts,
  Notifications, Maintenance, Journal d'activité, Centre d'aide, génération
  de contrats), sur une architecture et un schéma Prisma qui ont divergé de
  `main` depuis le 25 mai 2026 — quatre modèles de chaque côté que l'autre
  n'a pas. **Ce n'est pas une branche à fusionner** ; si ces modules servent
  encore, c'est une reprise fonctionnalité par fonctionnalité via
  `bmad-prd`. *Son sort — suppression ou conservation en archive — est une
  décision produit, distincte de la révocation de la clé, qui reste le seul
  remède réel.*

## Deferred from: analyse complète du dépôt (13-08-2026)

*Trois constats relevés par une lecture d'ensemble demandée par l'éditeur,
hors de toute story. Ils ne portent sur aucun défaut du registre : deux
concernent la documentation, un le processus.*

- **`REP-74` → story **5.11** — 🟠 Sept décomptes de la documentation sont faux, et deux d'entre eux
  servent de preuve d'exhaustivité à une propriété de sécurité.** Recomptés le
  13-08-2026, commandes à l'appui :

  | Affirmé | Réel | Où |
  |---|---|---|
  | 31 Server Actions | **45** — 40 inline + 5 exportées dans 4 modules `"use server"` | `architecture.md:7,63,82`, `bug-report.md:5,15,38,1322`, `epics.md:1043`, `README.md:107` |
  | 12 routes API | **19** fichiers `route.ts` | `architecture.md:64`, `bug-report.md:38`, `README.md:107` |
  | 37 stories | ~~44~~ **48** | ~~`epics.md:16`, `README.md:33,80`, en-tête `sprint-status.yaml:3`~~ — **les quatre corrigés le 14-08-2026 (story 5.12)** |
  | 34 stories | **44** | `bug-report.md:1683` |
  | 33 / 31 défauts | ~~34~~ **35** | ~~`sprint-status.yaml:4`, `project-context.md:125`~~ — **les deux corrigés le 14-08-2026, plus `README.md:32,81,123` que REP-74 ne listait pas** |
  | 20 tables Prisma | **19 modèles** (18 énums, exact) | `project-context.md:43`, `README.md:108` |
  | « treize stories done » | **16 done, 1 review** *(à la date du constat)* | `README.md:7` |

  Commandes : `grep -rn '"use server"' app lib --include=*.ts --include=*.tsx`
  puis distinction en-tête / inline ; `find app/api -name 'route.ts*' | wc -l` ;
  `grep -cE '^### Story [0-9]' docs/epics.md` ; `grep -c '^model ' prisma/schema.prisma`.

  > ⚠ **Deux lignes de cette table ont été rafraîchies le 14-08-2026 par la
  > story 5.12, et il faut savoir pourquoi avant d'exécuter la 5.11.** Cette
  > story a ajouté un défaut (BUG-35) et deux stories (5.12, 5.13) : les
  > valeurs « réelles » que REP-74 publiait — 44 stories, 34 défauts —
  > étaient donc **devenues fausses à leur tour**. Les corriger n'était pas
  > du zèle : qui aurait exécuté la 5.11 avec cette table en main serait
  > allé écrire 44 et 34 dans `epics.md` et `README.md`, c'est-à-dire
  > **publier des nombres faux en croyant réparer** — exactement ce que ce
  > constat dénonce. La 5.12 a corrigé les emplacements de ces deux lignes ;
  > **les cinq autres lignes restent entières et appartiennent à la 5.11**,
  > `architecture.md` et ses affirmations d'exhaustivité en tête.
  >
  > *Leçon, et elle est du ressort de §8 : une correction déplace le
  > problème avant de le fermer. Ici, corriger un décompte a périmé la
  > fiche qui recensait les décomptes.*

  **Le fond tient, et c'est ce qui rend le constat subtil.** Le cloisonnement a
  été revérifié le 13-08-2026 sur l'ensemble **réel** : 40 actions inline sur 40
  portent une garde — seule exception, `app/auth/reset/[token]/page.tsx`,
  publique à dessein — et 16 routes sur 19, les trois autres (`nextauth`,
  `register`, `public/health`) étant publiques à dessein. Aucune fuite. Ce qui
  est faux n'est donc pas la conclusion mais **l'ensemble sur lequel elle est
  affirmée** : quatorze Server Actions et sept routes n'ont jamais fait partie
  du périmètre audité, et `architecture.md` §3 écrit pourtant « sans exception
  dans les 31 Server Actions et les 12 routes API examinées ». C'est exactement
  ce que `CLAUDE.md` §7 interdit. *Story 5.11.*

- **`REP-75` → story **5.7** — Trois dépendances de production ne sont importées nulle part, et
  deux d'entre elles ne sont documentées nulle part.** `@tanstack/react-query`
  est connu et écrit dans quatre documents ; `react-hook-form` et
  `@prisma/extension-accelerate` ne le sont dans aucun. Vérifié le 13-08-2026
  par `grep -rF` sur tout le dépôt, fichiers racine compris (`auth.ts`,
  `tailwind.config.ts`) — zéro occurrence pour les trois. Accessoirement,
  `@types/bcryptjs` et `@types/nodemailer` sont déclarés en `dependencies` là
  où leur place est `devDependencies`. *Rattaché à la story 5.7, qui nettoie
  déjà le dépôt ; ne rien retirer sans vérifier que la construction passe.*

- **`REP-76` → story **5.11** — 🟠 Une story `done` a laissé ouvert le `REP` qui lui était assigné, et
  personne ne l'a vu.** `REP-72` — le décompte « 31 Server Actions » — a été
  assigné à la story **4.6**, laquelle est passée `done` le 12-08-2026 avec
  l'affirmation toujours en place dans `architecture.md`. Selon `CLAUDE.md` §9,
  elle aurait dû rester `in-progress`. C'est le **premier `REP` assigné qu'une
  story close laisse tomber** depuis la mise en place de la traçabilité le
  12-08-2026 : le mécanisme qui protège tout le reste a cédé une fois, huit
  jours après avoir été posé pour empêcher précisément cela. Le constat n'est
  pas le décompte (c'est `REP-72`) mais **le trou de procédure**. *La story
  5.11 ferme `REP-72` ; c'est la rétrospective de l'épopée 4 qui doit regarder
  pourquoi la clôture ne l'a pas vu — un `REP` assigné à une story devrait être
  contrôlé au moment de la clore, comme l'est la File List.*

## Deferred from: story 5.12 — barre de la console éditeur (14-08-2026)

Les deux constats ci-dessous ont été relevés en inspectant les **trois**
barres du produit pendant qu'on en réparait une seule (BUG-35). Aucun n'est
un défaut de sécurité, et c'est dit d'emblée pour qu'ils ne soient ni
surestimés ni oubliés.

- **`REP-78` → **fermé par la story 5.13** — ~~🟡~~ Cinq entrées de la barre agence renvoient un agent d'où il vient.**
  `components/layout/AgencyNavbar.tsx` affiche ses dix-sept liens à tout le
  monde : le composant ne reçoit **aucun rôle**. Or cinq des cibles sont
  gardées par `requireAgencyAdmin()` — `/agency/showcase`, `/agency/trash`,
  `/agency/users`, `/agency/audit`, `/agency/settings` — plus l'entrée
  « Paramètres de l'agence » du menu utilisateur, qui pointe sur la
  cinquième. Vérifié le 14-08-2026 en lisant la garde en tête de chacune des
  dix-sept pages liées.

  **Le chemin est correctement traité, et c'est pourquoi ce n'est qu'un
  `REP`** : `requireAgencyAdmin()` redirige vers `/agency` avec un message
  lisible — « Action réservée à l'administrateur de l'agence » — précisément
  parce que la story **4.3** avait corrigé l'éjection muette d'avant. Rien
  ne casse, rien ne fuit, et masquer un lien ne garderait de toute façon
  rien : `lib/auth-guard.ts` reste la seule couche d'autorisation
  (`CLAUDE.md` §5). Reste qu'un agent voit en permanence cinq portes qui ne
  s'ouvriront jamais pour lui.

  **Arbitrage rendu le 14-08-2026 par l'éditeur : MASQUER.** Motif écrit
  dans `docs/epics.md` § Story 5.13 — un outil de terrain se juge à ce
  qu'il ne demande pas de comprendre. **Le piège au moment de coder est
  nommé là-bas aussi :** masquer un lien ne garde rien, et un test doit
  constater que la garde refuse toujours l'accès direct — sinon le
  masquage finira par être lu comme une protection.

- **`REP-79` → **fermé par la story 5.13** — ~~🟡~~ Les deux barres de gestion affichent une identité en dur.**
  `AdminNavbar.tsx` écrit « SA » dans la pastille et « Super Admin » dans le
  menu ; `AgencyNavbar.tsx` écrit « A » et « Mon compte ». **Aucune des deux
  ne lit la session** : l'affichage est identique quel que soit le compte
  connecté. Vérifié le 14-08-2026 — les deux fichiers sont des composants
  client sans `props` ni `useSession()`.

  Le coût est faible aujourd'hui, mais il grandit avec le produit : sur un
  outil à trois rôles où une même personne peut détenir plusieurs comptes,
  la barre ne dit pas lequel est ouvert — ce qui est exactement la question
  que pose un poste partagé, celle-là même que BUG-35 a rendue concrète.
  *Le piège au moment de corriger est écrit dans `CLAUDE.md` §2 :
  **`session.user.role` ne se lit pas**. Le rôle et l'agence se relisent en
  base ; l'identité affichée doit donc descendre en `props` depuis un Server
  Component, et non être tirée d'un `useSession()` côté client.*

- **`REP-80` → story **4.7** — 🟡 La suite ne tient que sur `chromium`, et rien ne le dit.**
  `package.json` déclare `"test:e2e": "playwright test --project=chromium"`,
  alors que `playwright.config.ts` définit **cinq** projets — chromium,
  firefox, webkit, Mobile Chrome, Mobile Safari. Quatre d'entre eux ne sont
  donc jamais joués, et le `npm run test:e2e` qui coche la définition de
  « terminé » (`CLAUDE.md` §9) n'exerce qu'un navigateur sur cinq.

  **Constaté le 14-08-2026, par accident et pas par analyse** : la preuve
  par mutation de la story 5.12 a d'abord été lancée avec
  `npx playwright test tests/navigation.spec.ts`, sans `--project`. Résultat
  **17 échecs sur 20**, là où la même commande restreinte à chromium en
  donne exactement 2 — les deux attendus. Deux causes distinctes, et il
  faut les séparer :

  - **Les viewports mobiles ne peuvent pas passer, par construction.** Le
    menu utilisateur d'`AdminNavbar.tsx` est dans un conteneur
    `hidden md:flex` : sous le point de rupture `md`, le bouton « SA »
    n'existe pas, et le message d'échec le dit mot pour mot — *waiting for
    getByRole('button', { name: /SA/i })*. Sur mobile, la déconnexion est
    ailleurs, dans le menu burger. Un test écrit pour le bureau ne peut pas
    valoir pour les deux.
  - **firefox, webkit et Mobile Safari échouent aussi sur le contrôle
    positif** — un cas qui se contente d'ouvrir une session et de vérifier
    un titre, que la mutation ne pouvait pas atteindre. **La cause n'est pas
    établie** : navigateurs non installés, délais différents, autre chose.
    Je ne l'ai pas mesurée, et c'est écrit plutôt que supposé.

  **Ce n'est pas un défaut du produit** : `--project=chromium` est un choix
  qui se défend, et rien n'est cassé pour un utilisateur. Le constat est que
  **ce choix n'est écrit nulle part** — ni dans `CLAUDE.md` §3, ni dans
  `docs/project-context.md` — si bien qu'une commande Playwright lancée à la
  main donne un mur de rouge sans rapport avec le code, exactement ce qui
  vient d'arriver. *Deux suites possibles pour la story 4.7 : assumer
  chromium et l'écrire, ou réduire `projects` à ce qui est réellement joué.
  Laisser cinq projets déclarés dont un seul tourne est le pire des trois.*

## Deferred from: code review of story-5.12 (14-08-2026)

Cinq constats de la revue adversariale, réels et hors périmètre du câblage
que la story 5.12 corrige. Les quatre premiers touchent
`components/layout/AdminNavbar.tsx`, le cinquième le harnais.

- **`REP-81` → **fermé par la story 5.13** — ~~🟡~~ `signOut()` est lancé sans `.catch()`, et un échec le rend silencieusement mort.**
  `components/layout/AdminNavbar.tsx`, les **deux** appels
  `signOut({ callbackUrl: "/auth/login" })` — celui du `DropdownMenuItem`
  « Déconnexion » et celui du `<button>` du menu mobile. Même motif dans
  `AgencyNavbar.tsx`, aux deux appels homologues. `next-auth/react` enchaîne
  `getCsrfToken()`, `fetch(.../signout)` puis `res.json()` : si la réponse
  n'est pas du JSON, la promesse flottante rejette et `window.location.href`
  n'est jamais posé. **Chemin déjà connu du dépôt** : derrière nginx sans
  `AUTH_TRUST_HOST`, `/api/auth/*` répond une erreur `UntrustedHost` en HTML
  — c'est au registre (`bug-report.md`, « Connexion impossible derrière
  nginx »). La suite tourne sur `localhost:3002` en direct : elle ne peut pas
  le voir. *Symptôme résultant : l'utilisateur clique « Déconnexion », le
  menu se ferme, rien ne se passe, et rien ne le lui dit — exactement le
  symptôme que la story 5.12 vient de fermer, par un autre chemin.*

- **`REP-82` → story **5.13** — 🟡 La sortie repose sur l'URL renvoyée par le serveur, pas sur le `callbackUrl` passé.**
  `signOut` pose `window.location.href = data.url ?? redirectTo`.
  `callbackUrl: "/auth/login"` est **relatif** : c'est Auth.js qui le résout
  contre son origine calculée, et `auth.config.ts` ne définit aucun callback
  `redirect`. *Vérifié le 14-08-2026 dans `node_modules/next-auth/react.js` :
  `signOut` fait bien `const url = data.url ?? redirectTo` puis
  `window.location.href = url`, sans `try`/`catch` autour du `res.json()`.* Si l'origine résolue diffère de celle du navigateur (nginx
  `:8095` devant l'application `:3000`), la session se ferme bien mais
  l'utilisateur atterrit ailleurs. *Effet de bord côté test : le rouge
  désignerait la déconnexion alors que la cause serait la configuration
  d'hôte.*

- **`REP-83` → **fermé par la story 5.13** — ~~🟡~~ Rien ne garde l'activation répétée de « Déconnexion », et le bouton mobile ne ferme pas son menu.**
  Radix ferme le menu bureau dès le `click`, mais `signOut` reste en vol
  pour deux allers-retours : l'utilisateur peut rouvrir et recliquer, d'où N
  `POST /api/auth/signout` concurrents. **Sur mobile c'est pire** : le
  `<button>` « Déconnexion » du bloc `md:hidden` n'appelle pas
  `setIsOpen(false)`, contrairement à **tous** les `<Link>` du même bloc, qui
  le font. Le menu reste donc ouvert, sans
  indicateur, sur un bouton qui paraît inerte — et l'utilisateur martèle.

- **`REP-84` → **fermé par la story 5.13** — ~~🟡~~ Le bouton burger de la console éditeur n'a pas d'`aria-label`.**
  Le `<button>` `md:hidden` d'`AdminNavbar.tsx` contre son homologue
  d'`AgencyNavbar.tsx`, qui porte `aria-label="Ouvrir le menu"` depuis
  l'origine. L'icône Lucide `<Menu>` n'a pas de `<title>`
  : le nom accessible du bouton est **vide**. Deux conséquences — un défaut
  d'accessibilité réel, et l'**impossibilité d'atteindre le chemin mobile par
  un sélecteur accessible**, ce qui bloque le test que la revue de la story
  5.12 réclame pour la déconnexion mobile. *À traiter avec ce test, pas
  après lui.*

- **`REP-85` → story **4.7** — 🟡 Un délai de cas plus court que la somme des délais qu'il encadre.**
  `tests/navigation.spec.ts` posait `test.setTimeout(120000)` sur ses cas,
  alors que `login()` traverse à lui seul **150 s** de délais — `goto` 60 s
  puis `waitForURL` 90 s (`tests/auth-helper.ts`) — auxquels chaque cas
  ajoute deux attentes de 30 s, soit **210 s** encadrés par 120.

  > **Ce constat a été mal corrigé deux fois, et c'est la partie
  > instructive.** Le premier correctif a posé 180 s en affirmant l'avoir
  > « aligné sur la somme qu'il encadre » : faux de 30 s, le `goto` de 60 s
  > de `login()` ayant été oublié. Corrigé à 240 s le 14-08-2026, **avec le
  > calcul écrit dans le fichier** pour qu'il soit rejouable au lieu d'être
  > cru. *Une somme qu'on ne pose pas est une affirmation comme une autre.* *Conséquence : au premier
  ralentissement, le rouge est un `Test timeout of 120000ms exceeded` qui ne
  désigne ni la connexion ni la déconnexion — un message qui n'indique pas
  la propriété visée, ce que `CLAUDE.md` §6 interdit explicitement.* Rejoint
  la famille des constats de harnais déjà portés par la story 4.7.

- **`REP-86` → story **5.9** — 🟡 Un serveur local renvoie l'utilisateur non connecté vers une AUTRE origine, et `REP-82` cesse d'être théorique.**
  Constaté le 14-08-2026 pendant l'audit Lighthouse de la story 5.12, **par
  accident** : l'audit visait `http://localhost:3002/admin` et a rendu ses
  scores pour `http://localhost:8095/auth/login?callbackUrl=%2Fadmin`.
  Mesuré ensuite à la main :

  ```
  curl -s -i http://localhost:3002/admin | grep -i '^location'
  → location: http://localhost:8095/auth/login?callbackUrl=%2Fadmin
  ```

  **Ce n'est pas un défaut du dépôt** : `.env.example` porte bien
  `NEXTAUTH_URL="http://localhost:3002"`, et c'est le `.env` de cette
  machine qui pointe sur la pile conteneurisée (nginx `:8095`). Le constat
  n'est donc pas « le code est faux » mais **« la redirection
  d'authentification est construite depuis `NEXTAUTH_URL`, jamais depuis
  l'origine de la requête »** — et personne ne l'avait vu parce que rien ne
  l'exerce.

  **Pourquoi ça compte quand même, et pour deux raisons.**

  1. **`REP-82` passe de théorique à confirmé.** Il supposait que la sortie
     de `signOut` puisse atterrir sur une autre origine que celle du
     navigateur ; c'est désormais **observé**, sur le même mécanisme de
     résolution. La différence entre « possible » et « constaté » est
     exactement celle que §7 impose de tenir.
  2. **La suite de tests ne peut pas le voir**, et c'est structurel : elle
     se connecte d'abord, donc elle ne traverse jamais la redirection du
     visiteur non connecté. 117 cas verts pendant qu'une visite anonyme sur
     `:3002` part sur un autre port. *Un trou de couverture qu'aucun
     décompte de tests ne révèle.*

  *Rattaché à la story 5.9 (« contraindre les redirections et les sorties
  libres »), qui porte déjà `returnTo` non validé et trois dettes de la même
  famille.*

- **`REP-87` → story **4.7** — 🟡 Lighthouse ne peut auditer aucune page derrière une session, donc pas celles qui portent les barres.**
  La règle 10 (`CLAUDE.md` §12) impose un « audit Lighthouse avant
  validation finale ». Constaté le 14-08-2026 en l'exécutant : l'outil ne
  sait pas s'authentifier, et **toutes** les pages de `/admin` et `/agency`
  exigent une session. Viser `/admin` renvoie 307 et mesure la page de
  connexion. Conséquence : la règle 10 ne peut aujourd'hui être satisfaite
  que sur la vitrine publique et les écrans d'authentification —
  c'est-à-dire **nulle part où vit l'outil de gestion**, qui est pourtant
  l'essentiel du produit. *Deux issues possibles : injecter un cookie de
  session dans le contexte Lighthouse (le harnais sait déjà en fabriquer un,
  `tests/agence.ts`), ou écrire noir sur blanc que la règle 10 ne couvre que
  la surface publique. La laisser telle quelle fait cocher une case sur une
  mesure qui ne regarde pas le produit.*

## Deferred from: story 5.13 — barres et rôles (14-08-2026)

- **`REP-88` → story **2.3** — 🟡 `<Toaster />` n'est monté nulle part : tout `toast()` serait muet.**
  `components/ui/toaster.tsx` et `hooks/use-toast.ts` existent, ainsi que la
  dépendance `@radix-ui/react-toast`. Mais `grep -rn "<Toaster" app components`
  ne renvoie **rien**, et aucun fichier n'appelle `useToast` — vérifié le
  14-08-2026. **Une notification écrite aujourd'hui ne s'afficherait donc
  nulle part**, et le développeur qui l'écrirait n'aurait aucun signal :
  ni `tsc`, ni `lint`, ni la suite ne voient un toast qui ne s'affiche pas.

  C'est **exactement la classe de défaut de BUG-35** — une commande qui
  paraît branchée et ne l'est pas — mais côté infrastructure plutôt que
  côté bouton. La story 5.13 l'a rencontrée en cherchant comment annoncer
  un échec de déconnexion, et a **renoncé au toast** pour cette raison :
  le message est rendu dans le menu lui-même.

  *Rattaché à la story 2.3, qui touche déjà au déploiement et au cadre
  applicatif. Deux issues : monter `<Toaster />` dans le layout racine, ou
  retirer les trois fichiers morts. Les laisser en l'état est le pire des
  trois — ils invitent à s'en servir.*

- **`REP-89` → story **5.11** — 🟡 Un décompte périmé dans un commentaire de code, et il était orphelin.**
  `app/agency/layout.tsx` porte : *« Chaque page de l'espace agence rend
  deja sa propre `<AgencyNavbar />` et son propre `<main>` — c'est la
  convention du projet, verifiee sur les 41 pages. »* Le dépôt en compte
  aujourd'hui **45** qui rendent la barre (`grep -rl "<AgencyNavbar" app
  --include=*.tsx | wc -l` → 45, dont ce fichier lui-même, qui ne fait que
  la citer). Le chiffre était juste quand il a été écrit ; il ne l'est plus.

  **Ce qui vaut le constat n'est pas l'écart de quatre, c'est qu'il a failli
  rester orphelin.** La story 5.13 l'avait noté dans son Debug Log comme
  « famille de `REP-74` » — sans numéro, et sans entrée ici. Or `REP-74`
  est une table de décomptes précis, et cette ligne n'y figure pas : rien
  n'aurait garanti que la story 5.11 la retrouve. C'est exactement
  l'orphelin que §1 interdit, produit par la story qui venait de fermer
  cinq constats proprement. *Relevé par l'audit d'acceptation du
  15-08-2026.*

  *Rattaché à la story 5.11, qui porte déjà les décomptes faux des autres
  documents.*

### Constats fermés par la story 5.13

- **`REP-78`** — les cinq entrées réservées sont **masquées** pour un agent.
  Arbitrage de l'éditeur, motif écrit. Prouvé par mutation sur les deux
  chemins de rendu (menu à plat et rangée du bureau).
- **`REP-79`** — les deux barres affichent le **nom réel** du compte, relu en
  base et descendu en `props`. Plus de « SA » ni de « Mon compte » en dur.
- **`REP-81`** — `signOut()` est enveloppé : un échec affiche un message et
  la sortie manuelle `/api/auth/signout`, au lieu d'un bouton inerte.
- **`REP-83`** — l'activation répétée est gardée (`disabled` + état
  « Déconnexion… »), donc plus de `POST` concurrents. *La fermeture du menu
  mobile n'a PAS été faite, et c'est délibéré : le menu est le seul endroit
  où l'échec peut être annoncé. Écrit dans la story.*
- **`REP-84`** — `aria-label` posés, et l'étiquette du burger suit désormais
  son état au lieu d'annoncer « Ouvrir » quand il ferme.

**`REP-82` reste OUVERT, et il ne faut pas le croire fermé.** La story 5.13
a traité l'échec de `signOut`, pas l'**origine** de sa sortie : `signOut`
pose toujours `window.location.href = data.url ?? redirectTo`, donc une URL
résolue par Auth.js contre `NEXTAUTH_URL` et non contre l'origine du
navigateur. C'est le mécanisme que `REP-86` a rendu observable. Le traiter
demande de décider si la sortie doit être forcée en relatif — un arbitrage,
pas un correctif.

## Deferred from: code review of story-5.13 (15-08-2026)

Quatre constats de la revue adversariale, réels et hors du périmètre de la
story. Aucun n'est un défaut de cloisonnement.

- **`REP-90` → story **2.3** — 🟡 La page de déconnexion de secours est en anglais, et demande un clic de plus que ce qu'on lui prête.**
  `auth.config.ts` ne déclare que `pages.signIn` et `pages.error`, **jamais
  `pages.signOut`**. NextAuth sert donc sa page de confirmation par défaut :
  non traduite, non habillée, et elle exige de soumettre un formulaire pour
  déconnecter réellement. Or c'est vers elle que pointe le lien de secours
  posé par la story 5.13 quand `signOut()` échoue — le texte du lien a été
  corrigé pour ne plus promettre une sortie immédiate, mais **le fond
  reste** : le chemin censé rattraper un défaut est lui-même en anglais,
  dans un produit dont `CLAUDE.md` §11 impose le français à tout ce que
  voit un utilisateur. *Rattaché à la story 2.3, qui touche déjà au cadre
  applicatif. Le remède est une page `/auth/logout` déclarée en
  `pages.signOut`.*

- **`REP-91` → story **5.9** — 🟡 Pour un administrateur, la barre se rétracte puis se rétablit à chaque navigation vers une page réservée.**
  Conséquence directe et ASSUMÉE de l'arbitrage du 14-08-2026 : `loading.tsx`
  rend la barre sans rôle, donc au repli restreint. Un `agency_admin` qui
  ouvre `/agency/settings` voit, pendant l'attente, « Vitrine » disparaître
  de la rangée principale et le groupe « Plus » perdre son état actif — la
  route courante n'étant plus dans la liste filtrée — puis tout revenir.
  **L'arbitrage acceptait « la barre s'allonge » ; la revue a montré que
  c'est un peu plus que cela** : la pastille `layoutId="agency-nav-pill"`
  n'a alors aucune ancre d'où glisser et apparaît « à froid », ce qui
  contredit le commentaire qui décrit son intention. *Le remède propre est
  un squelette de barre pendant l'attente — c'était la deuxième option de
  l'arbitrage, écartée parce qu'elle empêche de naviguer pendant un
  chargement lent. À rouvrir avec ce que la revue a mesuré en plus.*

- **`REP-92` → story **5.8** — 🟡 La barre garde le rôle du dernier rendu serveur : une rétrogradation ne s'y voit pas.**
  `role` est une prop figée au rendu de la page. Si un administrateur en
  rétrograde un autre pendant que celui-ci consulte `/agency/settings`, sa
  barre continue d'afficher les cinq entrées réservées jusqu'à la prochaine
  navigation. **Ce n'est pas une faille** : la garde serveur de la
  destination suivante refuse, et c'est elle qui autorise (`CLAUDE.md` §5).
  C'est un écart d'affichage, de la même famille que celui que la story 1.8
  a fermé côté serveur. *Rattaché à la story 5.8, qui traite déjà la
  révocation de session et donc la propagation d'un changement de compte.*

- **`REP-93` → story **5.9** — 🟡 Un `signOut()` qui aboutit après que l'utilisateur a navigué ailleurs l'arrache à sa page.**
  Rien n'annule l'appel en vol quand le composant est démonté : si
  l'utilisateur clique « Déconnexion » puis, l'appel traînant, suit un lien
  de navigation, la résolution de la promesse exécute quand même
  `window.location.href = callbackUrl` et le renvoie sur `/auth/login`.
  *Le remède croise `REP-82` : `signOut({ redirect: false })` puis une
  navigation faite par nous — ce qui réglerait du même coup l'origine de
  sortie. C'est un arbitrage, pas un correctif, et c'est pourquoi les deux
  restent groupés sur la story 5.9.*

---

## Relevés par la vérification au navigateur du 15-08-2026

*Première session de pilotage de navigateur contre la pile conteneurisée.
Le défaut principal qu'elle a trouvé est **BUG-36**, porté par la
story 5.14 ; les trois constats ci-dessous en sont les voisins, hors de son
périmètre. Mesures complètes dans `docs/qa/verification-navigateur.md`.*

- **`REP-94` → story **5.9** — 🟠 nginx accepte n'importe quel `Host`, et `AUTH_TRUST_HOST` est vrai.**
  `nginx/nginx.conf` n'a qu'un bloc `server` : il est donc **serveur par
  défaut** et relaie toute requête quel que soit son en-tête `Host`, y
  compris `Host: exemple-malveillant.dz`. La valeur atteint l'application,
  qui tourne avec `AUTH_TRUST_HOST=true` — NextAuth peut donc construire
  ses URL de rappel sur un hôte choisi par l'appelant. **Trou préexistant,
  indépendant de BUG-36** : `$host` venait déjà du client. Le remède est un
  bloc `default_server` qui répond `444` aux hôtes inconnus, plus un
  `server_name` explicite — mais cela **fait échouer bruyamment** tout
  déploiement dont le domaine n'est pas déclaré, ce qui est une décision et
  non un détail. *Rattaché à la story 5.9, qui traite déjà les sorties
  libres et les redirections non contraintes.*

- **`REP-95` → story **4.7** — 🟠 `npm run test:e2e` n'exerce aucune topologie de déploiement.**
  `playwright.config.ts:68` lance `npm run build && npm start -- -p 3002` :
  la suite parle **directement** à l'application. nginx, les volumes, le
  conteneur de migration et les variables d'environnement de production ne
  sont dans le chemin d'aucun des 121 cas. **BUG-36 vivait exactement dans
  cet angle mort** — et il y serait resté indéfiniment, puisque aucun test
  ne pouvait le rendre rouge. Ce n'est pas une lacune de couverture
  fonctionnelle mais une lacune de **périmètre** : le harnais éprouve le
  code, jamais son installation. *Rattaché à la story 4.7, qui refond le
  harnais de test.*

- **`REP-96` → ~~story **5.11**~~ → ~~story **2.6**~~ → story **2.8** — ✅ ~~🔵~~ ~~🟠~~ **RÉSOLU le 17-08-2026, et en service.** Rien ne signalait que l'image servie avait divergé du dépôt.**
  > **RÉTRÉCI le 17-08-2026 par la story 2.6, pas soldé — et le dire est le
  > seul intérêt de cette ligne.** La sonde compare désormais les migrations
  > embarquées à celles appliquées, dans les deux sens, et nomme celles en
  > écart (`lib/migrations.ts`) ; mesuré en service :
  > `{"status":"ok","database":"up","schema":"a-jour"}`.
  >
  > **Ce que ça ne dit toujours pas : le commit.** Une image en retard dont
  > aucune migration n'a bougé reste parfaitement invisible — c'est
  > exactement le cas décrit ci-dessous : **67 commits de retard sans
  > changement de schéma**, et la sonde d'aujourd'hui l'aurait déclaré
  > `a-jour`. Ce qui casse l'authentification est fermé ; l'écart de version
  > en général ne l'est pas. Le risque tombe de 🟠 à 🔵 et **change de
  > story** : 2.8, ouverte pour l'occasion. Le marquer « résolu » aurait été
  > le mensonge le plus commode de la journée.
  L'image en service le 15-08-2026 datait du **09-08** et accusait
  **67 commits** de retard (`git log --since="2026-08-09 12:33" --oneline | wc -l`).
  Elle portait donc encore BUG-33, fermé dans la branche le 12-08. Aucun
  écran, aucune sonde, aucun journal ne compare la version servie au commit
  du dépôt : `/api/public/health` répond `{"status":"ok"}` sans dire **quoi**
  est en marche. **Le coût réel a été mesuré** : la vérification a d'abord
  conclu à une régression de sécurité qui n'existait pas, et il a fallu
  dater l'image pour l'écarter. Le remède est modeste — exposer le SHA de
  construction dans la sonde de santé, et l'afficher quelque part.
  ~~*Rattaché à la story 5.11, qui recompte déjà ce que la documentation
  affirme.*~~

  **RATTACHEMENT CORRIGÉ le 16-08-2026 : story 2.6.** Deux raisons, et la
  seconde est la vraie.

  1. **La 5.11 ne pouvait pas le porter.** Elle recompte la documentation et
     *« ne touche pas au code applicatif »* (`sprint-status.yaml`). Le remède
     que ce constat propose — exposer une information dans la sonde de santé
     — est du code applicatif, dans `app/api/public/health/route.ts`.

  2. **Ce constat annonçait BUG-37 onze jours à l'avance, et personne ne l'a
     lu comme tel.** Il dit exactement : *« aucune sonde ne compare la
     version servie au commit du dépôt »*. Le 16-08, c'est précisément cette
     absence qui a laissé une base migrée sous une image qui ne l'était pas,
     avec un conteneur `healthy` et plus aucune connexion possible. Ce
     n'était pas un 🔵 de confort : c'était la description du défaut avant
     qu'il ne survienne. **Relevé en 🟠.**

  **Traité par l'AC-3 de la story 2.6**, quoique autrement que proposé ici :
  la sonde ne compare pas un **SHA de commit** mais les **migrations**
  appliquées à celles que l'image embarque (`lib/migrations.ts`). Motif —
  un SHA dit *quelle version* tourne, mais il faut connaître le dépôt pour en
  déduire quoi que ce soit ; l'écart de migrations dit *ce qui ne va pas*, et
  se lit sans rien savoir d'autre. Le SHA reste un complément possible, et il
  n'est **pas** fait : ce constat n'est donc pas soldé en entier.

  **DÉVELOPPÉ le 17-08-2026 par la story 2.8 — écrit et éprouvé, PAS ENCORE
  EN SERVICE.** Le SHA entre dans l'image par un `ARG` posé par
  `docker-compose.prod.yml` et y est gravé dans un **fichier** ; la sonde le
  rend sous `commit`, et `"inconnu"` explicitement quand elle ne sait pas.
  `npm run verify:deploy` compare au `HEAD` local, nomme les deux, et
  **n'échoue pas** — servir une image plus ancienne que la branche est normal
  en cours de travail.

  *Un fichier et non une variable d'environnement : mesuré le 17-08-2026 sur
  une image jetable portant les deux — `docker run -e COMMIT_SHA=x`, soit
  exactement ce que fait le `env_file: - .env` du service `frontend`, écrase
  l'`ENV` gravée et ne peut rien contre le fichier. Une `ENV` aurait fait
  annoncer à la sonde un commit qui n'est pas le sien.*

  ✅ **EN SERVICE le 17-08-2026**, reconstruction faite par l'éditeur. La
  trace de construction porte la preuve que l'`ARG` a traversé Compose, le
  Dockerfile et la gravure — `RUN printf '%s' "493f2194…" > ./.commit` — et
  la sonde le rend :

  ```
  {"status":"ok","database":"up","schema":"a-jour","commit":"493f2194ad10c65449a872ab05a781151980436c"}
  ```

  `npm run verify:deploy` conclut « identique à HEAD » et va jusqu'au chemin
  authentifié. **Ce constat est clos**, deux jours après avoir été relevé,
  et après avoir décrit BUG-37 onze jours avant qu'il ne survienne.

- **`REP-97` → story **4.7** — 🔵 L'inscription lâche sous la charge parallèle de la suite.**
  Mesuré le 15-08-2026 : sur une exécution complète de `npm run test:e2e`,
  **1 cas sur 122** est tombé — `regression.spec.ts:1580`, « le budget de
  dépôt est compté par agence » — sur `Error: apiRequestContext.post: read
  ECONNRESET` en appelant `POST /api/auth/register`. **Rejoué seul, le même
  cas passe en 7,2 s.** Ce n'est donc pas une assertion en échec : c'est la
  connexion coupée sous charge.
  La cause probable est celle déjà nommée dans `playwright.config.ts` :
  quatre travailleurs en parallèle contre **un seul processus serveur**, et
  chaque inscription hache un mot de passe avec bcrypt au coût 12 — la route
  d'inscription en fait autant qu'une connexion, plus une transaction à deux
  écritures. Le délai de 90 s par cas était déjà un pansement posé pour la
  même raison ; il ne couvre pas une socket fermée.
  **Ce que cela coûte aujourd'hui : un faux rouge par exécution complète.**
  C'est-à-dire exactement ce qui apprend à ne plus lire les rouges. Le remède
  est celui déjà écrit dans la configuration — `storageState` enregistré une
  fois par rôle au lieu d'une reconnexion par cas —, et il appartient à la
  refonte du harnais.
  *Rattaché à la story 4.7, qui porte déjà cette refonte.*

- **`REP-98` → story **4.7** — 🟠 La suite de tests abandonne ses agences derrière elle.**
  Mesuré le 15-08-2026 : **271 agences en base**, dont **2** viennent de la
  graine, **1** est une inscription réelle, et **268 sont des résidus de
  tests**. Elles portent les préfixes que la suite fabrique — `Agence
  casse-<horodatage>`, `retrouve-`, `cloison-`, `depots-` — et **chaque
  exécution complète en ajoute environ quatre**. `effacerAgence()` existe
  (`tests/agence.ts:204`) : il n'est simplement pas appelé partout, et un
  dépassement de délai ne l'appelle jamais (§6 : nettoyer par `afterEach`,
  jamais par `finally`).
  **Ce que cela coûte, et ce n'est pas cosmétique :**
  la console `/admin/agencies` charge **toutes** les agences avec
  `include: { users: true, properties: true }` — sans pagination. À 271
  lignes elle est déjà lente ; elle grandit d'une exécution à l'autre. Et
  toute mesure faite sur la base (« combien d'agences en attente ? »)
  devient illisible.
  **Constat joint, même famille :** la suite laissait aussi **128 messages
  de vitrine** sur l'agence de démonstration (`Sofia Regression`, `Sofia
  Formule`, depuis `regression.spec.ts:56` et `:1294`). Les écrans « Messages
  reçus » de la démonstration en étaient noyés.
  **Nettoyé à la main le 15-08-2026** — 268 agences, 128 messages, 2 clients
  supprimés, la graine intacte — mais **le nettoyage n'est pas le remède** :
  sans `afterEach`, la fuite reprend à la prochaine exécution.
  *Rattaché à la story 4.7.*

  > ⚠ **Piège rencontré en écrivant ce nettoyage, à ne pas répéter.** Le
  > premier filtre cherchait `/test|qa|…/` dans le nom **et l'email** —
  > et **`aqar.dz` contient `qa`**. « Agence en attente », créée par la
  > graine et dont **deux tests dépendent**, était donc marquée « à
  > supprimer ». Un filtre large sur des données à détruire est exactement
  > la commande de contrôle qui ne contrôle pas ce qu'elle annonce (§7). Le
  > filtre retenu est une **liste fermée de motifs ancrés**
  > (`/^Agence (casse|retrouve|cloison|depots)-\d+$/`), et le script
  > inventorie avant de supprimer.

- **`REP-99` → story **3.5** — 🟠 ~~La règle qui protège la corbeille nomme `.delete()` et laisse passer `.deleteMany()`.~~ ✅ **RÉSOLU le 17-08-2026.****
  `CLAUDE.md` §2 interdit `prisma.property|client|owner.delete()` : ces trois
  modèles sont à corbeille, et un `delete()` y est définitif **et en
  cascade**. La règle est juste — mais elle est écrite au singulier, et
  **`deleteMany()` a exactement le même effet**.
  **Éprouvé à mes dépens le 15-08-2026.** Un script de nettoyage a fait
  `client.deleteMany({ firstName: "Amina", lastName: "Belkacem" })` pour
  retirer un doublon créé par une démonstration au navigateur. Or ce nom est
  **aussi** celui d'un client de la graine (`prisma/seed.ts:384`), et
  `Client → Rental` est en `onDelete: Cascade`
  (`prisma/schema.prisma:536`) : la location de démonstration et ses
  quittances ont disparu avec lui, faisant rougir
  `regression.spec.ts:121` (« gestion locative : indicateurs et quittances
  du seed »). Réparé en rejouant la graine.
  **Trois enseignements, dans l'ordre de gravité :**
  1. `deleteMany` sur un modèle à corbeille doit être aussi interdit que
     `delete` — c'est un mot à ajouter à §2, pas une nouvelle règle.
  2. **Aucune commande de contrôle ne recense les cascades destructives
     partant des trois modèles à corbeille.** Combien de tables tombent si
     l'on supprime un `Client` ? La réponse n'est écrite nulle part.
  3. Un filtre de suppression construit sur un **nom de personne** est
     fragile par nature : les jeux de démonstration et les saisies
     manuelles se ressemblent, et rien ne les distingue en base.
  *Rattaché à la story 3.5, qui étend déjà la suppression réversible aux
  relations.*

  **Soldé le 17-08-2026, sur les trois enseignements.**
  1. `deleteMany` est traité comme `delete` — et pas seulement dans une
     phrase. `.eslintrc.json` porte une règle `no-restricted-syntax` qui
     refuse les deux sur les trois modèles, **quel que soit le client**
     (`prisma`, `db`, ou un client bricolé dans un script). Deux exceptions,
     chacune écrite ligne par ligne à l'endroit où elle s'exerce :
     `app/agency/trash/page.tsx` — la corbeille doit pouvoir se vider — et
     la remise à zéro de `prisma/seed.ts`.
     ⚠ **`npm run lint` a dû être élargi pour que cela serve à quelque
     chose** : `next lint` ne regarde que `app/`, `components/`, `lib/`,
     `src/` et `pages/`. Il ignorait `prisma/`, `scripts/` et `tests/` —
     **et l'accident du 15-08 a eu lieu dans un script.** La commande porte
     désormais les trois dossiers en plus ; mesuré : 0 erreur préexistante
     ailleurs, l'élargissement n'a rien coûté.
  2. La commande de contrôle existe : `npm run audit:cascades`
     (`scripts/cascades-corbeille.mjs`). Elle **dérive** l'inventaire de
     `prisma/schema.prisma` au lieu de le recopier, et ne parle à aucune
     base. Résultat : **11 suppressions en cascade** partant des trois
     modèles — dont `Client → Rental → RentalManagement`, la chaîne à deux
     niveaux qui a emporté les quittances et que personne n'aurait citée de
     mémoire.
  3. Le troisième enseignement — un filtre de suppression bâti sur un nom
     de personne est fragile — **n'est pas soldé par du code**, et il ne
     peut pas l'être : c'est une consigne de méthode. Elle est écrite ici,
     et le point 1 la rend beaucoup moins atteignable.

  **Ce que l'inventaire a révélé en passant :** la corbeille avertissait que
  « Détruire » efface « photos, visites, historique ». Les onze cascades
  nomment aussi **les ventes, les locations et leurs quittances**. La phrase
  affichée citait trois conséquences anodines et taisait celles qui portent
  de l'argent — corrigée dans la même story.

- **`REP-100` → story **6.6** — 🟠 ~~La page tarifaire vend six capacités que le produit ne tient pas.~~ **Deux** mentions ne désignaient rien. ✅ **RÉSOLU le 16-08-2026.****
  Relevé le 16-08-2026 en clôturant l'épopée 6. Celle-ci a fermé la
  divergence sur les **noms** et les **plafonds** : le catalogue est unique,
  l'offre est appliquée. **Elle n'a rien fermé sur les arguments de vente.**

  **⚠ CE CONSTAT A ÉTÉ ÉCRIT SANS ÊTRE MESURÉ, et deux de ses affirmations
  étaient fausses.** Il annonçait d'abord « quinze » capacités — un nombre
  qu'aucune lecture ne donne —, corrigé en « six », **également faux**. Les
  six avaient été nommées de mémoire ; les dix-neuf arguments n'ont été
  inventoriés qu'en ouvrant la story 6.6. C'est exactement le défaut que ce
  `REP` reproche au produit, commis dans le `REP` lui-même (`CLAUDE.md` §7).
  L'inventaire complet est dans
  `docs/stories/6-6-ne-plus-vendre-ce-qui-n-existe-pas.md`.

  ```
  $ grep -oP '^\s+"\K[^"]+(?=",?$)' lib/offres.ts | wc -l     → 19 (avant retrait)
  $ ls app/agency/statistics/                                 → page.tsx, 425 lignes
  $ find app/api -name route.ts | wc -l                       → 14, toutes internes
  ```

  **Ce que la mesure a donné, sur les 19 :**
  **6** plafonds (tenus, story 6.4) · **6** capacités **livrées** ·
  **5** engagements de service · **2** qui ne désignaient rien.

  « Statistiques avancées » **existe** — l'écran fait 425 lignes et porte six
  graphiques. Seules **« API access »** (les 14 routes sont internes et
  derrière une session) et **« Intégrations custom »** ne renvoyaient à aucun
  code. **Retirées le 16-08-2026**, et un inventaire daté (`ARGUMENTS_REVUS`)
  fait désormais rougir la suite si un argument entre au catalogue sans revue.

  **Les cinq engagements de service sont gardés** : ils ne sont pas du code.
  Un `grep` ne dit rien de la présence d'un chargé de compte, et ne pas
  savoir n'autorise pas à trancher.

  **Le vrai défaut restant n'était pas celui-ci** — il est plus grave, et
  c'est `REP-101`.
  *Porté par la story 6.6, close le 16-08-2026.*

- **`REP-101` → story **6.7** — 🟠 Quatre capacités sont vendues comme des différenciateurs et ne différencient rien.**
  Relevé le 16-08-2026 par l'inventaire de la story 6.6. Le PRD l'avait dit
  juste dès le 15-08 (§5) — *« Aucune fonctionnalité fermée par offre »* — mais
  aucun `REP` ne le portait.
  ```
  $ grep -rn "plan" --include="*.ts*" app/agency/ app/vitrine/ \
      | grep -v "quota\|offres\|nomOffre\|plan_bien"        → 0 verrou
  ```
  **Une agence Starter à 2 900 DA/mois dispose exactement des mêmes écrans
  qu'une agence Pro à 7 900** : « Statistiques avancées »
  (`app/agency/statistics`), « Gestion locative » (`app/agency/rentals`,
  `rental-management`), « Documents PDF » (`lib/pdf/`) et « Vitrine
  personnalisée » (slug, logo, description) sont livrées à tout le monde.
  Hors des deux plafonds numériques, **aucune capacité n'est conditionnée par
  l'offre**.
  **C'est l'inverse de la divergence que l'épopée 6 a fermée.** Là, la page
  promettait ce que la base ignorait ; ici, elle vend **comme exclusif ce que
  tout le monde a déjà**. L'agence Pro paie 5 000 DA de plus par mois pour
  des plafonds — et pour quatre lignes qu'elle aurait eues sans payer.
  **Pourquoi ce n'est pas traité dans la story 6.6, et pourquoi c'est un
  arbitrage :** les fermer reviendrait à **retirer à des agences Starter des
  écrans qu'elles utilisent déjà aujourd'hui**. Ce n'est plus corriger une
  promesse, c'est reprendre une capacité livrée à des clients en cours. Trois
  issues, et elles appartiennent à l'éditeur : fermer par offre (avec une
  bascule pour l'existant), reformuler les arguments pour cesser de les
  présenter comme exclusifs, ou revoir l'écart de prix.
  *Rattaché à la story 6.7, ouverte pour l'occasion dans `docs/epics.md`.*

- **`REP-102` → story **4.7** — 🟡 `playwright.config.ts` déclare cinq navigateurs, la suite n'en joue qu'un, et trois ne sont pas installés.**
  Relevé le 16-08-2026 en jouant une mutation de la story 6.6 — pas par une
  lecture : la commande directe a produit **neuf échecs qui n'avaient rien à
  voir avec la mutation**.
  ```
  $ grep '"test:e2e"' package.json
      "test:e2e": "playwright test --project=chromium"
  $ grep -c 'name: "' playwright.config.ts        → 5 projets déclarés
  $ npx playwright test tests/offres.spec.ts      → 20 cas au lieu de 4
      Error: browserType.launch: Executable doesn't exist at
      /home/ouazene/.cache/ms-playwright/firefox-1522/firefox/firefox
  ```
  **Trois conséquences, la troisième étant la vraie.**
  1. `npm run test:e2e` fixe `--project=chromium` : les quatre autres projets
     ne tournent **jamais**. Ce qui est déclaré n'est pas ce qui est vérifié.
  2. Les binaires firefox, webkit et Mobile Safari **ne sont pas installés**.
     Quiconque lance `npx playwright test` — le réflexe naturel pour rejouer
     un seul fichier — récolte des échecs de lancement qu'il prendra pour des
     défauts du produit. **C'est exactement le « rouge inattribuable » que
     `CLAUDE.md` §6 interdit**, et il est fourni par la configuration.
  3. **La règle 10 (§12) exige la vérification du responsive.** Les projets
     `Mobile Chrome` et `Mobile Safari` existent pour ça et **ne sont jamais
     joués**. La configuration donne à croire que le responsive est couvert
     par la suite : il ne l'est pas.
  **Ce n'est pas un défaut du produit, c'est un défaut du harnais** — d'où le
  rattachement à la story 4.7, qui le refond déjà. À trancher là-bas :
  installer les binaires et jouer la matrice, ou **retirer du fichier les
  projets qu'on ne joue pas**. Les laisser déclarés sans les jouer est le pire
  des trois états.

## Deferred from: story 2.6, arbitrage du 17-08-2026

- **`REP-103` → story **2.7** — ✅ ~~🟠~~ **RÉSOLU le 17-08-2026, et en service.** Une commande banale de Docker Compose effaçait la base, et rien ne s'y opposait.**
  > **Ce qui est fait** : les deux volumes de `docker-compose.prod.yml` sont
  > déclarés `external: true` avec leur `name:` complet, la forme ayant été
  > éprouvée sur un projet jetable **avec un marqueur déposé dans chaque
  > volume** — un volume recréé serait présent et vide, ce qu'un simple
  > contrôle d'existence aurait laissé passer. `tests/deploiement.spec.ts`
  > garde la déclaration, prouvé par **deux mutations jouées séparément**.
  > `143 passed`.
  >
  > **EN SERVICE le 17-08-2026.** L'éditeur a lancé le `up -d --build`, et
  > **le fait qu'il aboutisse est la moitié de la preuve** : si l'un des
  > deux `name:` n'avait désigné aucun volume, Compose serait sorti en `1`
  > sans créer un seul conteneur. Vérifié après coup —
  > `docker compose config` rend `external=True` avec les deux noms exacts,
  > et `postgres` n'a pas même été recréé (`✔ aqar-postgres-prod Healthy`).
  >
  > **Le décompte avant/après n'a PAS été relevé** : l'empreinte d'avant a
  > été manquée. Une mesure plus forte l'a remplacée —
  > `docker volume inspect` rend `CreatedAt = 2026-08-09T12:28:41+01:00`
  > pour les deux volumes, soit leur date d'origine, huit jours avant la
  > bascule. Un volume recréé porterait la date du jour. La donnée n'a pas
  > été comparée : elle n'a pas été touchée.
  >
  > ⚠ **Ce que cela ne ferme pas** : `docker volume rm`, geste délibéré. Et
  > **ce n'est pas une sauvegarde** — un disque mort ou une corruption
  > passent dessous. La story 0.1 reste ouverte, et elle reste le vrai filet.
  Relevé en préparant T3 de la story 2.6 : il fallait une base jetable, et
  j'ai signalé à l'éditeur que la manœuvre pouvait détruire
  `aqar-prod_postgres_data` — le volume qui **est** la base (§12, règle 5).
  La bonne réponse n'était pas la prudence, c'était de retirer l'arme.

  **Mesuré le 17-08-2026 sur deux volumes bidons, hors du projet :**
  ```
  $ docker compose -p t-ext -f compose.yml down -v
      Volume t-ext_jetable Removing
      Volume t-ext_jetable Removed
  $ docker volume ls -q | grep essai-volume-sacre
      essai-volume-sacre          ← declare `external: true`, epargne
  ```
  `docker compose down -v` supprime les volumes ordinaires et **épargne**
  ceux déclarés `external: true`, **sans même un avertissement**. Les deux
  volumes de `docker-compose.prod.yml:227-229` — `postgres_data` et
  `uploads_data`, c'est-à-dire toute la base **et** toutes les photos et
  documents téléversés — sont ordinaires.

  **Ce que ça vaut, et ce que ça ne vaut pas.** C'est une rambarde contre
  l'erreur de frappe, pas un filet : un `docker volume rm` explicite, un
  disque mort ou une corruption passent dessous. Le filet, c'est la story
  **0.1** (sauvegarde hors machine), `ready-for-dev` et bloquée sur des
  arbitrages de l'éditeur. **Les deux sont nécessaires et aucune ne remplace
  l'autre** — d'où deux stories et non une.

  **Le piège de la bascule est dans la bascule elle-même** : un volume
  `external` n'est jamais créé par Compose, et le `name:` doit reprendre
  exactement `aqar-prod_postgres_data`. Un nom faux fait chercher un volume
  inexistant et la pile ne démarre plus. La manœuvre s'éprouve sur un projet
  jetable avant d'être appliquée. *Rattaché à la story 2.7, ouverte pour
  l'occasion dans `docs/epics.md`.*

## Deferred from: mesure de couverture fonctionnelle (17-08-2026)

*Un seul constat, mais il change la lecture de tous les autres : il dit ce
que « la suite est verte » signifie réellement dans ce dépôt.*

- **`REP-104` → story **4.8** — ✅ ~~🟠~~ **RÉSOLU le 17-08-2026.** La suite ne remarquait pas qu'un module métier avait cessé de fonctionner.**
  > **Fermé le jour même.** Les six modules ont désormais un aller-retour à
  > travers le produit (`tests/metier.spec.ts`), **prouvé par six mutations
  > jouées séparément** — chacune ne tue qu'un seul cas, et chaque message
  > nomme son module. `153 passed`, deux exécutions consécutives.
  >
  > **Et les six modules fonctionnent** : aucun `BUG-nn` à ouvrir. C'était
  > le résultat le plus probable, et il n'était pas acquis — c'est
  > précisément parce que rien ne le vérifiait qu'on ne pouvait pas le dire.
  >
  > **Ce que la mutation a révélé au passage** : sous mutation, le produit
  > redirige avec **`?success=`** alors qu'aucune ligne n'a été écrite. Un
  > test qui cliquerait et lirait le bandeau serait donc vert sur un module
  > mort. C'est la démonstration la plus nette de `CLAUDE.md` §6 — vérifier
  > **l'effet**, jamais l'apparence.
  >
  > ⚠ **Ce qui reste ouvert, et qui n'est pas ce constat** : la story prouve
  > que les modules ne sont pas **morts**, pas qu'ils sont **justes**. Un
  > montant mal enregistré passe dessous. C'est l'épopée 3.
  **MESURÉ, pas déduit.** Les neuf actions de création du produit ont été
  neutralisées **en même temps** — `tsc` **0** et `lint` **0 erreur** avant
  de lancer, précisément pour que le rouge ne puisse pas venir du build
  (§6, piège 3) — puis la suite complète relancée.

  ```
  Modules dont la création cassée fait ROUGIR la suite :
    properties          plafonds.spec.ts
    documents           regression.spec.ts
    owners              roles.spec.ts (contrôle positif)

  Modules dont la création cassée passe INAPERÇUE :
    clients   sales   rentals   rental-management   payments   visits
  ```

  **Six modules sur neuf.** Vérifié isolément d'abord sur `clients` :
  création entièrement neutralisée, l'écran annonçant toujours « Client
  créé » — **147 passed**.

  **La cause est structurelle, et c'est ce qui la rend intéressante.**
  `tests/agence.ts` monte ses décors par `db.owner.create`,
  `db.property.create`, `db.client.create`… — **directement en base**, sans
  traverser une seule Server Action. Sur les 17 fichiers de la suite, les
  vraies mutations par le produit (`rejouer()`) ne vivent que dans trois :
  `plafonds`, `attribution-offre`, `roles`. La suite éprouve donc
  remarquablement ce qu'on peut LIRE et ce qu'on ne peut PAS lire ; elle
  n'éprouve presque rien de ce qu'on peut ÉCRIRE.

  Ce n'est pas un oubli : c'est son histoire. Elle est née des épopées 1
  et 4, qui portaient sur la sécurité et le cloisonnement, et elle les
  couvre bien. Le mot « couverture » a simplement fini par se lire comme
  « couverture fonctionnelle », ce qu'il n'a jamais été ici.

  ⚠ **Ce que la story 4.8 ne fera pas** : prouver que le produit est
  *correct*. Elle prouvera qu'il n'est pas *mort*. Un formulaire qui
  enregistre le mauvais montant passera dessous — c'est l'épopée 3 qui
  traite la justesse. *Rattaché à la story 4.8, ouverte pour l'occasion
  dans `docs/epics.md`.*

---

## Deferred from: story 3.4 — paginer la vitrine publique (17-08-2026)

- **`REP-105` → **résolu** — ~~🟡 Le plan du site n'est pas borné, et le scénario de l'AC-2 le fait dépasser la limite des moteurs.~~**
  `app/sitemap.ts` chargeait **tous** les biens publics de **toutes** les
  agences, sans `take`, et produisait une entrée par bien.

  Le scénario que l'AC-2 de la story 3.4 nomme — *50 agences de 2 000 biens*
  — donne **100 001 URL**, soit **le double de la limite de 50 000** qu'un
  fichier de plan unique peut porter. Au-delà, les moteurs ignorent le
  fichier : la vitrine redeviendrait invisible, ce que ce plan existe
  précisément pour empêcher.

  **Ce n'est pas la story 3.4, et pas seulement par périmètre** : son AC-2
  exige au contraire que *« le plan continue de lister tous les biens »*.
  Le corriger ne consiste donc pas à borner, mais à changer la **forme** du
  fichier — un index de plans, `sitemap.xml` renvoyant vers `sitemap/0.xml`,
  `sitemap/1.xml`… C'est une autre route, un autre contrat, et une décision
  qui touche le référencement.

  ⚠ **Non mesuré, et il faut le dire** : aucune base de ce dépôt n'approche
  ces volumes, et le seuil de 50 000 est une limite documentée par les
  moteurs, pas une valeur observée ici. Le constat est établi par lecture
  du code et par le calcul du scénario de l'AC-2.

  *Rattaché à la story 3.12, ouverte pour l'occasion dans `docs/epics.md`.*

  **Story 3.12, 17-08-2026 — et elle a commencé par la mesure qui manquait.**
  La base porte **43 vitrines publiées et 4 biens publiés, soit 48 URL** :
  49 952 de marge. Le défaut est **entièrement prospectif**, et c'est
  maintenant écrit avec un chiffre au lieu d'une lecture. La limite a été
  vérifiée à sa source (`sitemaps.org/protocol.html`) et **la seconde
  mesure a désigné laquelle des deux mord** : à ~190 octets par entrée, une
  tranche de 45 000 pèse 8 à 9 Mo — six fois sous le plafond de 50 Mo. C'est
  le **nombre d'URL** qui borne, pas le poids.
  `/sitemap.xml` est devenu un `<sitemapindex>` renvoyant vers
  `/sitemap/agences-N.xml` et `/sitemap/biens-N.xml`. Aucune borne : l'AC-2
  de la story 3.4 exige que le plan liste tout.
  `app/sitemap.ts` a dû être **retiré** : la convention de métadonnées de
  Next ne sait produire qu'un `<urlset>`, et son `generateSitemaps()`
  laisse `/sitemap.xml` en 404 — vérifié dans le code du chargeur, pas
  supposé.

- **`REP-106` → **résolu** — ~~🟠 « Détruire » efface onze tables en un clic, sans rien demander.~~**
  Relevé le 17-08-2026 en clôturant la story 3.5, **par la mesure que cette
  story a produite**. `npm run audit:cascades` recense **11 suppressions en
  cascade** partant des trois modèles à corbeille : détruire un `Client`
  emporte ses visites, ses ventes, ses locations et **les quittances de
  celles-ci**.

  Le bouton qui déclenche cela est un `<form action={purge}>` avec un
  simple bouton d'envoi (`app/agency/trash/page.tsx`). **Aucune
  confirmation.** Un clic, et c'est fait — irréversiblement.

  ```
  $ rg -l 'window.confirm|AlertDialog|êtes-vous sûr' app components
  (aucun résultat)
  ```

  Le produit **n'a aucun dispositif de confirmation**, nulle part. Ce n'est
  donc pas un oubli sur cet écran-là : c'est une brique qui manque, et la
  corbeille est simplement l'endroit où son absence coûte le plus cher.

  La story 3.5 a fait ce qu'elle pouvait sans sortir de son périmètre :
  l'avertissement sous le tableau nomme désormais ce qui tombe réellement
  (il citait « photos, visites, historique » et taisait ventes, locations
  et quittances). **Mais un avertissement n'est pas un garde-fou** : il est
  sous le tableau, le bouton est dans la ligne, et rien n'oblige à lire
  l'un avant de cliquer l'autre.

  ⚠ **Ce constat n'est pas classé comme défaut**, et c'est délibéré : il
  est établi par lecture du code et par l'inventaire des cascades, sans
  qu'aucune perte de données ait été observée en fonctionnement. L'inscrire
  en `BUG-nn` gonflerait le décompte des défauts d'une affirmation non
  mesurée — exactement ce que `CLAUDE.md` §7 interdit.

  *Rattaché à la story 3.13, ouverte pour l'occasion dans `docs/epics.md`.*

  **Story 3.13, 17-08-2026 — arbitrage rendu par délégation.** Le dialogue
  **nomme la ligne et chiffre ce qui tombe** : « 1 visite, 1 vente, 1
  location et 1 quittance de loyer » plutôt que « et tout ce qui en
  dépend », qui est vrai d'une fiche vide comme d'un client de douze ans.
  Détruit et détaché sont dits **séparément**, et les deux tables sont
  **par nature** — une vente rattachée à un client est détruite avec lui,
  la même rattachée à un propriétaire survit en perdant son bailleur.

  **Aucune dépendance ajoutée** : `@radix-ui/react-alert-dialog` n'est pas
  installé, `@radix-ui/react-dialog` l'est.

  **Ce qui n'est PAS fait, et pourquoi** : aucun champ de confirmation côté
  serveur. Il n'arrêterait ni l'accident — que le dialogue traite — ni un
  administrateur décidé, que `requireAgencyAdmin()` a déjà autorisé. Ce
  serait un garde-fou en trompe-l'œil, et c'est justement le reproche fait à
  l'avertissement d'origine. Un test **rejoue `purge` sans l'écran** et
  constate qu'elle aboutit : il documente au lieu de laisser croire.

  §8 : le bouton étant devenu un `button`, la corbeille serait devenue
  **impossible à vider sans JavaScript**. Un `<noscript>` rend ce chemin,
  libellé « Détruire sans confirmation ».

  Les six autres actions destructives **ne sont pas modifiées** ; l'ordre
  dans lequel les reprendre — et les deux qui ne doivent **pas** adopter le
  dispositif — est écrit dans `docs/architecture.md` §4.

## Deferred from: story 3.7 (17-08-2026)

- **`REP-107` → **résolu** — ~~🟡 L'accueil est invisible dans le HTML servi, et son LCP l'attend.~~**
  Relevé le 17-08-2026 en faisant la story 3.7, **par une hypothèse qu'elle
  a dû abandonner**. Le travail sur les images ne déplaçait pas le LCP de
  `/` ; la mesure directe a dit pourquoi.

  ```
  PerformanceObserver, Slow-4G + processeur ×4, émulation Pixel 5
    /vitrine/agence-demo  ->  IMG (le fond du bandeau)   1 856 ms
    /                     ->  <p class="mt-7 max-w-lg…">  3 500 ms   ← du TEXTE
  ```

  **Le LCP de l'accueil n'est pas une image, c'est un paragraphe** —
  `components/landing/HeroSection.tsx:85`, un `motion.p` portant
  `initial={{ opacity: 0, y: 16 }}`. Framer écrit les valeurs de `initial`
  dans le style rendu par le serveur : le texte est donc **livré
  transparent** et n'apparaît qu'une fois le JavaScript exécuté.

  Ce n'est pas un cas isolé sur cette page :

  ```
  $ curl -s http://…/ | grep -o 'opacity:0' | wc -l
  34
  $ curl -s http://…/vitrine/agence-demo | grep -o 'opacity:0' | wc -l
  0
  ```

  **34 éléments livrés invisibles.** Lighthouse mobile bridé donne
  LCP 3,459 s pour un TTI de 3,459 s — la même milliseconde. La page ne
  s'affiche pas tant qu'elle n'est pas interactive.

  La vitrine, elle, en est exempte : son `AnimatePresence initial={false}`
  supprime les styles d'entrée au rendu serveur. Le remède existe donc déjà
  dans le dépôt, à quelques mètres de là.

  ⚠ **La correction demande un arbitrage produit, et c'est pour cela qu'elle
  n'a pas été faite au passage.** L'entrée en fondu échelonnée EST le
  parti pris visuel de cette page ; la supprimer se voit. Les deux issues —
  garder l'animation et accepter un LCP à 3,5 s, ou faire peindre le texte
  d'emblée et n'animer que la décoration — appartiennent à celui qui a
  dessiné la page.

  *Rattaché à la story 3.14, ouverte pour l'occasion dans `docs/epics.md`.*

  **Story 3.14, 17-08-2026 — arbitrage rendu par délégation, et il tient en
  une règle** : *on n'anime pas l'entrée de ce qui est déjà à l'écran ; on
  anime l'entrée de ce qui y arrive.* La chorégraphie du premier écran est
  **inchangée** — mêmes délais, mêmes durées, même courbe — mais elle est
  jouée en CSS, donc dès le premier rendu. Les sections d'en dessous gardent
  Framer : déclenchées au défilement, elles ne peuvent retarder aucun
  affichage. **Règle 8 est tenue** : Framer reste la bibliothèque
  d'animation ; ce qui change est le moment d'une seule séquence, et pour
  une raison qui n'est pas un goût — aucune animation pilotée par un script
  ne peut commencer avant l'hydratation.

  `opacity:0` servis sur `/` : **34 → 21** (les 21 restants sont les
  sections d'en dessous). LCP en mesure directe : **3 500 → 1 556 ms**.
  ⚠ Lighthouse, qui *simule*, dit 3,17 s et reste collé à son TTI : les deux
  méthodes ne s'accordent pas, et l'écart est écrit plutôt que tranché.

  **Un défaut trouvé en chemin** : `CountUp` rendait `0` côté serveur. Sans
  JavaScript, la page annonçait « **0** modules métier » — pas une page
  vide, une page **fausse**, y compris pour les robots d'indexation.
  Corrigé, avec son coût écrit : à l'hydratation le chiffre repart de zéro.

  **Et un troisième** : le bloc `prefers-reduced-motion` coupait la durée
  des animations mais pas le **délai**. Couper la durée sans couper le délai
  ne supprime pas le mouvement, il le remplace par une attente.

