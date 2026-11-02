# Registre des défauts — Aqar DZ

**Date :** 9 août 2026
**Périmètre :** 26 123 lignes (`app/`, `lib/`, `components/`, `hooks/`, `types/`) + schéma Prisma + déploiement
**Méthode :** lecture intégrale de `lib/` et des routes API, revue des 31 Server Actions,
analyse statique (`tsc`, `next lint`), et **vérification dynamique sur l'instance Docker locale**.

> Chaque défaut marqué **[CONFIRMÉ]** a été reproduit sur l'application en
> fonctionnement. Les autres sont établis par lecture du code et de la
> contrainte de base correspondante.
>
> **[ÉTABLI PAR LECTURE]** (ajouté le 14-08-2026, BUG-35) rend cette
> seconde catégorie explicite là où l'absence de marqueur se lisait comme
> un oubli. Il ne dit rien de la certitude : l'absence d'un gestionnaire
> sur un bouton est un fait statique, que la lecture établit mieux qu'un
> clic. Il dit **comment on le sait**.

> **Six passes, un seul registre.** Ce fichier a d'abord consigné 18
> défauts (BUG-01 à BUG-18). Une seconde passe, le même jour, en a relevé
> **13 de plus**, inscrits ici en BUG-19 à BUG-31. Une **troisième passe,
> le 12 août 2026**, menée cette fois sur les 31 Server Actions des
> 28 écrans — que les deux premières n'avaient parcourues qu'en survol,
> ayant lu intégralement `lib/` et `app/api/` — en a relevé **un
> trente-deuxième**. Une **quatrième passe, le 12 août 2026**, partie non
> d'un fichier mais d'une question — *que revérifie-t-on à chaque requête,
> et que croit-on sur parole ?* — en a relevé **un trente-troisième**. Une
> **cinquième passe**, née d'une revue de
> code et non d'une lecture de fichier, en a relevé un trente-quatrième
> (BUG-34) — celui que la story 4.6 venait de rendre atteignable depuis
> l'interface. Une **sixième passe, le 14 août 2026**, n'est née d'aucune
> lecture : **c'est l'éditeur qui a signalé le symptôme** — « certains
> éléments de la barre du haut ne sont pas reliés à leurs vraies pages ».
> Elle a relevé BUG-35. Une **septième passe, le 15 août 2026**, n'est née
> ni d'une lecture ni d'un signalement : **c'est un pilotage de navigateur
> contre la pile conteneurisée**, le premier de ce dépôt. Les six passes
> précédentes lisaient du code ou servaient l'application **en direct** ;
> aucune n'avait jamais exercé la **topologie de déploiement**. Elle a
> relevé BUG-36. ~~**Le total est de 36.**~~ Une **huitième passe, le
> 16 août 2026**, n'est née ni d'une lecture, ni d'un signalement, ni d'un
> pilotage : **c'est une panne en fonctionnement**, la première de ce
> registre. L'éditeur ne pouvait plus se connecter ; les journaux du
> conteneur ont nommé la cause en une ligne. Elle a relevé BUG-37.
> ~~**Le total est de 37.**~~ Une **neuvième passe, le 17 août 2026**, n'est
> née d'aucune des huit causes précédentes : **c'est un critère
> d'acceptation qui l'a déclenchée**. La story 3.2 venait fermer *un* cast
> d'énumération, et son AC-3 exigeait de vérifier qu'il n'en restait aucun
> dans le projet entier. Le balayage en a rendu six autres. Elle a relevé
> BUG-38. **Le total est de 38.**
>
> *Décompte recalculé le 17-08-2026 :*
> `grep -c '^<a id="bug-' docs/qa/bug-report.md` → 38.
>
> `docs/epics.md` renvoie aux défauts par leur **numéro d'audit (n° 01 à
> 31)**, qui suit l'ordre de gravité et non l'ordre de découverte. La
> [table de correspondance](#correspondance) ci-dessous fait le lien dans
> les deux sens : c'est elle qu'il faut consulter pour marquer un défaut
> corrigé au titre de la définition de « terminé ».

---

## Ce qui va bien

Il faut le dire avant le reste, parce que cela conditionne la façon de
corriger : **le cloisonnement multi-locataire est correct**. Les
31 Server Actions et les 12 routes API appliquent sans exception le motif
« garde → vérification d'appartenance → écriture ». Les identifiants
relationnels postés dans les formulaires sont re-vérifiés
(`verify-links.ts`). Aucune fuite inter-agences n'a été trouvée.

La suppression réversible est centralisée dans le client Prisma plutôt que
répétée dans 72 requêtes. La validation Zod couvre tous les formulaires.
Les garde-fous métier existent (impossible de se désactiver soi-même,
impossible de laisser une agence sans administrateur actif). `tsc` et
`lint` sont propres.

Les défauts ci-dessous sont donc des **trous ponctuels dans un ouvrage
solide**, pas les symptômes d'une architecture à refaire.

---

## Synthèse

| # | Défaut | Gravité | Confirmé |
|---|--------|:---:|:---:|
| [BUG-01](#bug-01) | Email sensible à la casse : comptes définitivement inaccessibles | 🔴 Critique | ✅ **corrigé** |
| [BUG-02](#bug-02) | Injection HTML dans les emails → phishing signé par le serveur | 🟠 Haute | ✅ **corrigé** |
| [BUG-03](#bug-03) | Injection de formule dans tous les exports CSV | 🟠 Haute | ✅ **corrigé** |
| [BUG-04](#bug-04) | Pièces d'identité et actes servis sans authentification | 🟠 Haute | ✅ **corrigé** |
| [BUG-05](#bug-05) | Commission d'un bien non bornée : plantage et calcul faux | 🟡 Moyenne | ✅ |
| [BUG-06](#bug-06) | Statut d'agence casté sans validation | 🟡 Moyenne | ✅ **corrigé** |
| [BUG-07](#bug-07) | Console super admin : tout charger pour compter | 🟡 Moyenne | ✅ **corrigé** |
| [BUG-08](#bug-08) | Vitrine publique sans pagination | 🟡 Moyenne | ✅ **corrigé** |
| [BUG-09](#bug-09) | `/api/upload` sans limitation de débit ni contrôle du contenu | 🟡 Moyenne | ✅ **corrigé** |
| [BUG-10](#bug-10) | `requireAgencyAdmin` : commentaire faux, code mort | 🟡 Moyenne | — |
| [BUG-11](#bug-11) | Entiers non bornés → dépassement de colonne | 🔵 Basse | ✅ |
| [BUG-12](#bug-12) | Inscription simultanée : 500 au lieu d'un message | 🔵 Basse | — |
| [BUG-13](#bug-13) | `maxSize` du sélecteur de fichier jamais appliqué | 🔵 Basse | — |
| [BUG-14](#bug-14) | Nom de bucket non échappé dans une expression régulière | 🔵 Basse | — |
| [BUG-15](#bug-15) | Référence métier illisible dans les exports | 🔵 Basse | ✅ |
| [BUG-16](#bug-16) | `robots.txt` n'exclut pas `/uploads/` | 🔵 Basse | ✅ **corrigé** |
| [BUG-17](#bug-17) | Budget de force brute doublé | 🔵 Basse | — |
| [BUG-18](#bug-18) | Limitation de débit non partagée entre instances | 🔵 Basse | — |

### Seconde passe — 13 défauts supplémentaires

| # | Défaut | Gravité | Confirmé |
|---|--------|:---:|:---:|
| [BUG-19](#bug-19) | Clé d'API Figma en clair, versionnée dans le dépôt | 🔴 Critique | ✅ |
| [BUG-20](#bug-20) | Toute la limitation de débit se contourne avec un en-tête | 🔴 Critique | ✅ **corrigé** |
| [BUG-21](#bug-21) | Suppression de fichier arbitraire — et inter-agences — par l'URL d'un document | 🟠 Haute | ✅ **corrigé** |
| [BUG-22](#bug-22) | L'application est publiée hors de nginx, sur le port 3000 | 🟠 Haute | ✅ **corrigé** |
| [BUG-23](#bug-23) | L'URL d'un document finit dans un `href` sans contrainte | 🟠 Haute | ✅ **corrigé** |
| [BUG-24](#bug-24) | La suppression réversible ignore les relations imbriquées | 🟡 Moyenne | ✅ **corrigé** |
| [BUG-25](#bug-25) | `robots.txt` figé sur l'URL de construction | 🟡 Moyenne | ✅ **corrigé** |
| [BUG-26](#bug-26) | Aucun TLS, et HSTS envoyé en clair | 🟡 Moyenne | ✅ |
| [BUG-27](#bug-27) | PostgreSQL publié sur l'hôte avec un mot de passe par défaut | 🟡 Moyenne | ✅ **corrigé** |
| [BUG-28](#bug-28) | Dix-sept tests « authentifiés » qui ne s'authentifient jamais | 🟡 Moyenne | ✅ **corrigé** |
| [BUG-29](#bug-29) | Le filtre wilaya de la vitrine propose des choix sans résultat | 🔵 Basse | ✅ **corrigé** |
| [BUG-30](#bug-30) | Une directive nginx sans effet sur les fichiers statiques | 🔵 Basse | — |
| [BUG-31](#bug-31) | Un artefact de compilation versionné | 🔵 Basse | ✅ **corrigé** |

### Troisième passe — les Server Actions des écrans

| # | Défaut | Gravité | Confirmé |
|---|--------|:---:|:---:|
| [BUG-32](#bug-32) | Un agent supprime définitivement par l'écran d'édition ce que l'API lui refuse | 🟠 Haute | ✅ **corrigé** |

### Cinquième passe — ce qu'une ligne mise à la corbeille laisse derrière elle

| # | Défaut | Gravité | Confirmé |
|---|--------|:---:|:---:|
| [BUG-34](#bug-34) | Un parent mis à la corbeille fait changer d'objet ses enfants au prochain enregistrement | 🟠 Haute | ✅ **corrigé** |

### Sixième passe — ce que l'éditeur a vu et qu'aucune lecture n'avait vu

Les cinq passes précédentes sont parties du code. **Celle-ci part d'un
usage** : l'éditeur a signalé que des éléments de la barre du haut ne
menaient nulle part. Aucune des cinq n'avait ouvert un fichier de
navigation — elles cherchaient des gardes, des requêtes et des Server
Actions. Un bouton sans `onClick` ne casse ni `tsc`, ni `lint`, ni un test.

| # | Défaut | Gravité | Confirmé |
|---|--------|:---:|:---:|
| [BUG-35](#bug-35) | La console éditeur ne pouvait pas se déconnecter : cinq commandes mortes dans sa barre | 🟠 Haute | ✅ **corrigé** |

### Septième passe — la topologie de déploiement, jamais exercée

Les six passes précédentes ont lu du code, ou servi l'application **en
direct**. Aucune n'était jamais passée par nginx : `playwright.config.ts`
lance `npm run build && npm start -p 3002`, le reverse proxy n'est pas dans
le chemin. **Le premier pilotage de navigateur contre
`docker-compose.prod.yml` a trouvé le défaut en trois requêtes.**

| # | Défaut | Gravité | Confirmé |
|---|--------|:---:|:---:|
| [BUG-36](#bug-36) | Derrière nginx, Next abandonne **toutes** les Server Actions : le produit est en lecture seule | 🔴 Critique | ✅ **corrigé** — couverture durable en attente (AC 4) |

### Huitième passe — la panne qui a fait le tour des filets

Les sept passes précédentes cherchaient. Celle-ci n'a rien cherché : **le
produit est tombé**, l'éditeur l'a dit, et `docker logs` a nommé la cause en
une ligne. Ce qui vaut d'être retenu n'est pas le défaut — il se répare en
une commande — mais **le fait qu'il ait traversé quatre contrôles qui
avaient chacun une bonne raison de ne rien voir**.

| # | Défaut | Gravité | Confirmé |
|---|--------|:---:|:---:|
| [BUG-37](#bug-37) | Une base migrée sous une image qui ne l'est pas : **aucune connexion n'aboutit**, et le conteneur reste `healthy` | 🔴 Critique | ✅ **corrigé et en service le 17-08-2026** (story 2.6) — sonde typée, écart de migrations dans les deux sens, `verify:deploy` authentifié |

### Neuvième passe — le balayage qu'un critère d'acceptation exigeait

Elle n'est née ni d'une lecture, ni d'un signalement, ni d'une panne :
**c'est une story qui a fait son travail**. La 3.2 venait fermer un cast
d'énumération ; son AC-3 demandait de vérifier qu'il n'en restait aucun
dans le projet entier. Le balayage a rendu **six sites de plus**, tous du
même défaut, dont deux sur un écran public.

| # | Défaut | Gravité | Confirmé |
|---|--------|:---:|:---:|
| [BUG-38](#bug-38) | Sept gardes trouées par la chaîne de prototypes : `?type=constructor` remplaçait l'écran par une page d'erreur | 🟡 Moyenne | ✅ **corrigé** (story 3.2) — refus lisible côté écriture, valeur ignorée côté filtre |

### Quatrième passe — ce que les gardes revérifient, et ce qu'elles croient

| # | Défaut | Gravité | Confirmé |
|---|--------|:---:|:---:|
| [BUG-33](#bug-33) | Désactiver un compte ne lui retire aucun accès : les gardes ne relisent jamais l'utilisateur | 🟠 Haute | ✅ **corrigé** |

---

<a id="correspondance"></a>
## Correspondance — n° d'audit ↔ registre

`docs/epics.md` et les deux rapports d'audit numérotent les défauts de 01
à 31 **par gravité décroissante**. Ce registre les numérote par ordre de
découverte. Voici le lien, dans les deux sens.

| n° audit | Registre | Défaut | Story |
|---:|---|---|---|
| 01 | [BUG-04](#bug-04) | Documents servis sans authentification | 1.3 |
| 02 | [BUG-01](#bug-01) | Email sensible à la casse | 1.2 |
| 03 | [BUG-19](#bug-19) | Clé d'API Figma en clair | 1.1 |
| 04 | [BUG-20](#bug-20) | Limitation de débit contournée par un en-tête | 1.4 |
| 05 | [BUG-02](#bug-02) | Injection HTML dans les emails | 1.5 |
| 06 | [BUG-03](#bug-03) | Injection de formule dans les exports CSV | 1.6 |
| 07 | [BUG-21](#bug-21) | Suppression de fichier arbitraire par l'URL | 1.7 |
| 08 | [BUG-09](#bug-09) | Type de fichier téléversé déclaré par le client | 2.2 |
| 09 | [BUG-22](#bug-22) | Application publiée hors de nginx | 2.1 |
| 10 | [BUG-23](#bug-23) | URL de document non contrainte → lien `javascript:` | 1.7 |
| 11 | [BUG-05](#bug-05) | Commission non bornée | 3.1 |
| 12 | [BUG-06](#bug-06) | Statut d'agence casté sans validation | 3.2 |
| 13 | [BUG-07](#bug-07) | Console super admin : tout charger pour compter | 3.3 |
| 14 | [BUG-08](#bug-08) | Vitrine publique sans pagination | 3.4 |
| 15 | [BUG-24](#bug-24) | Suppression réversible ignorée dans les relations | 3.5 |
| 16 | [BUG-25](#bug-25) | `robots.txt` figé à l'URL de construction | 3.6 |
| 17 | [BUG-26](#bug-26) | Aucun TLS, HSTS en clair | 2.3 |
| 18 | [BUG-27](#bug-27) | PostgreSQL publié, mot de passe par défaut | 2.4 |
| 19 | [BUG-28](#bug-28) | Tests « authentifiés » qui n'authentifient jamais | 4.1 |
| 20 | [BUG-10](#bug-10) | `requireAgencyAdmin` : commentaire faux, branche morte | 5.1 |
| 21 | [BUG-11](#bug-11) | Entiers non bornés → dépassement de colonne | 3.1 |
| 22 | [BUG-12](#bug-12) | Inscriptions simultanées : 500 au lieu d'un message | 5.2 |
| 23 | [BUG-13](#bug-13) | `maxSize` du sélecteur de fichier jamais appliqué | 5.3 |
| 24 | [BUG-14](#bug-14) | Nom de bucket non échappé dans une expression régulière | 5.4 |
| 25 | [BUG-15](#bug-15) | Référence métier illisible dans les exports | 5.5 |
| 26 | [BUG-16](#bug-16) | `robots.txt` n'exclut pas `/uploads/` | 3.6 |
| 27 | [BUG-17](#bug-17) | Budget de force brute doublé | 5.6 |
| 28 | [BUG-18](#bug-18) | Limitation de débit non partagée entre instances | 5.6 |
| 29 | [BUG-29](#bug-29) | Filtre wilaya incohérent avec la liste | 3.6 |
| 30 | [BUG-30](#bug-30) | Directive nginx sans effet | 5.7 |
| 31 | [BUG-31](#bug-31) | Artefact de compilation versionné | 5.7 |
| 32 | [BUG-32](#bug-32) | Suppression définitive par l'écran d'édition, sans contrôle de rôle | 4.6 |
| 33 | [BUG-33](#bug-33) | Désactiver un compte ne lui retire aucun accès | 1.8 |

> **Un écart de gravité subsiste, et il est volontaire.** Le n° 01 de
> l'audit — les pièces d'identité et actes de propriété servis sans
> authentification — y est classé **Critique**, alors que ce registre l'a
> inscrit **Haute** (BUG-04). L'audit a reproduit la lecture d'un document
> sans aucun cookie sur l'instance en marche ; c'est cette lecture qui fait
> foi. `docs/epics.md` le traite en épopée 1, au même rang que les autres
> critiques. La ligne de BUG-04 n'a pas été réécrite pour ne pas altérer un
> constat daté, mais **traitez-le comme critique**.

---

<a id="bug-01"></a>
## 🔴 BUG-01 — Email sensible à la casse : comptes définitivement inaccessibles ✅ **CORRIGÉ**

> **Corrigé le 10 août 2026** — story 1.2, migration `20260810000000_normalize_user_emails`.
> Les trois chemins publics normalisent désormais l'adresse (`trim` + `lowercase`)
> via `identityEmail` dans `lib/validations/index.ts`, et le `registerSchema`
> dupliqué de la route d'inscription a disparu. Couvert par quatre tests de
> `tests/regression.spec.ts` — dont trois virent au rouge si la normalisation est
> retirée (vérifié par mutation).

**Fichiers :** `app/api/auth/register/route.ts:11-18` · `lib/validations/index.ts:151` (`loginSchema`) · `app/auth/forgot/actions.ts:11`

L'adresse email n'est normalisée nulle part sur le chemin public, alors
qu'elle l'est dans `agencyUserSchema` (`.toLowerCase()`, ligne 447). Les
deux chemins de création de compte se comportent donc différemment.

**Reproduction sur l'instance en fonctionnement :**

```
superadmin@aqar.dz  → CONNECTÉ
SuperAdmin@aqar.dz  → REFUSÉ
SUPERADMIN@AQAR.DZ  → REFUSÉ
```

**Ce qui se passe en vrai.** Une agence s'inscrit en tapant son adresse
comme elle l'écrit sur ses cartes de visite : `Contact@ImmoAlger.dz`. Le
compte est créé tel quel. Trois semaines plus tard, quelqu'un d'autre du
bureau tape `contact@immoalger.dz` : « Email ou mot de passe incorrect ».

Il essaie « Mot de passe oublié ». `requestPasswordReset` cherche
`contact@immoalger.dz`, ne trouve rien, et renvoie — volontairement — le
message générique « si un compte existe, un lien vient d'être envoyé ».
**L'utilisateur attend un email qui ne partira jamais, et rien à l'écran
ne lui dit pourquoi.** La protection contre l'énumération des comptes,
correcte en soi, transforme ici le bug en impasse totale.

Second effet : `findUnique({ email })` au moment de l'inscription ne voit
pas la collision de casse. Deux comptes distincts peuvent exister pour la
même personne réelle, chacun avec ses propres données.

**Correction :** `.trim().toLowerCase()` dans `loginSchema`,
`registerSchema` (les deux copies) et le schéma de `forgot/actions.ts`,
**plus** une migration qui normalise les lignes existantes — sans quoi les
comptes déjà créés en majuscules deviennent inaccessibles pour de bon.

---

<a id="bug-02"></a>
## 🟠 BUG-02 — Injection HTML dans les emails : phishing signé par votre serveur

**Fichiers :** `lib/notifications.ts:31-35` et `~100-108` · `lib/mailer.ts` (`emailLayout`)

`emailLayout` déclare son contrat noir sur blanc :

```ts
/** Paragraphes, deja echappes. */
body: string[]
```

Il n'est respecté par aucun appelant. `notifyAgencyOfLead` interpole
directement dans du HTML le nom, le message et le titre du bien :

```ts
`<strong>${leadName}</strong> vous a écrit depuis votre vitrine en ligne.`,
message ? `« ${message} »` : "",
```

Or `leadName` et `message` viennent du **formulaire public de la vitrine**,
accessible sans compte. Même chose pour `agencyName` dans
`notifyPlatformOfSignup`, alimenté par le formulaire d'inscription.

**Le scénario.** Un attaquant remplit le formulaire de contact d'une
agence avec, pour message :

```html
<a href="https://aqar-dz-secure.example/login">
  Votre abonnement expire : confirmez vos identifiants
</a>
```

L'agence reçoit un email qui vient réellement du serveur Aqar DZ, avec la
bonne mise en page, la bonne signature, et qui passera SPF et DKIM sans
broncher. C'est un canal de phishing de bien meilleure qualité que
n'importe quel email forgé — et le seul coût pour l'attaquant est de
remplir un formulaire de contact.

**Correction :** une fonction `escapeHtml()` appliquée à toute valeur
d'origine utilisateur avant l'appel à `emailLayout`. Ne pas se contenter
de nettoyer à l'affichage : l'email est déjà parti.

### ✅ Corrigé — story 1.5, 10-08-2026

**`emailLayout` n'accepte plus de HTML du tout**, ce qui va plus loin que
la correction proposée ci-dessus. Un `escapeHtml()` appliqué au point
d'appel aurait fermé le défaut du jour en laissant le piège : le contrat
« déjà échappés » était *déjà écrit*, en toutes lettres, au-dessus du
paramètre, et il n'a protégé personne. Un commentaire ne fait pas
respecter une invariante.

Le corps est désormais une structure (`Paragraphe[]`) et l'échappement vit
dans le gabarit. Un appelant ne peut plus produire de balise : il n'a plus
d'endroit où en écrire une, et le compilateur a désigné les quatre
appelants un par un.

Trois points que ce constat ne nommait pas ont été fermés avec :

- **`title` était interpolé brut** dans le `<h1>`, et `notifyAgencyActivated`
  lui passe le nom d'agence, saisi à l'inscription ;
- **le sujet entrait tel quel dans un en-tête** — un retour chariot dans
  le nom du visiteur injectait des en-têtes dans le `.eml` local. Il est
  aplati et borné dans `sendMail`, seul passage obligé ;
- **`leadSchema.firstName` / `lastName` n'avaient qu'un `min(2)`** là où
  `message` était borné à 2 000.

`actionUrl` n'est plus rendu que s'il désigne `http:` ou `https:`.

Vérifié sur le chemin réel, charge hostile envoyée par
`notifyAgencyOfLead` et fichier `.eml` inspecté : le sujet devient
`… nouveau message de Karim Bcc: victime@ailleurs.dz` sur une seule ligne,
le lien ressort en `&lt;a href=&quot;…`, et la version texte l'affiche
littéralement, sans une entité. Prouvé par mutation : en cessant
d'échapper les chevrons, l'email compte deux `<a>` au lieu d'un.

---

<a id="bug-03"></a>
## 🟠 BUG-03 — Injection de formule dans tous les exports CSV **[CONFIRMÉ]**

**Fichier :** `lib/csv.ts:16-31` (`escape`)

La fonction gère correctement le séparateur, les guillemets et les sauts
de ligne. Elle ne gère pas le cas où une valeur **commence par** `=`, `+`,
`-`, `@`, tabulation ou retour chariot : Excel et LibreOffice traitent
alors la cellule comme une formule, y compris lorsqu'elle était entre
guillemets dans le fichier — le déquotage a lieu avant l'évaluation.

**Reproduction.** Message inséré dans la base, puis
`GET /api/export/leads` :

```
2026-08-09;"=HYPERLINK(""http://evil.test"",""Cliquez"")";=1+1;0555000000;…
```

Les deux formules sortent intactes.

**Ce qui rend ce défaut sérieux ici, et pas seulement théorique :** les
`leads` viennent du formulaire public de la vitrine. L'attaquant n'a
besoin d'aucun compte. Il remplit un formulaire de contact, puis attend
que l'agence exporte ses messages et ouvre le fichier — un geste courant,
sur le poste Windows d'un agent. `=cmd|'/C calc'!A0` s'exécute au
déquotage, après une boîte de dialogue que les utilisateurs valident par
habitude.

Les huit entités exportables sont concernées (biens, clients,
propriétaires, paiements, visites, messages, ventes, baux), mais seuls les
messages ont un vecteur d'injection *public*.

**Correction :** dans `escape()`, préfixer d'une apostrophe toute valeur
texte dont le premier caractère est `= + - @ \t \r`. Correction d'une
ligne, qui couvre les huit exports d'un coup.

### ✅ Corrigé — story 1.6, 11-08-2026

Fait, avec une précision que ce constat ne portait pas : le préfixe ne
s'applique **qu'aux chaînes**. Le tiret est dans la liste, et préfixer
sans distinguer le type aurait transformé tout montant négatif en texte —
`-500` devenait `'-500`, et la colonne des paiements cessait de
s'additionner. La route d'export convertit déjà les décimaux avec
`Number(...)` : le test sur le type sépare proprement les deux mondes.

L'apostrophe est posée **avant** le guillemetage, donc à l'intérieur des
guillemets — sans quoi elle casserait la cellule au lieu de la protéger.

**Complété à la revue.** La première version préfixait aussi les
**numéros de téléphone internationaux** : `optionalPhone` autorise le `+`
de tête, et trois exports portent cette colonne — toute la colonne
Téléphone des clients, propriétaires et messages sortait avec une
apostrophe. Une exemption étroite la referme, sûre par construction :
une chaîne commençant par `+` ou `-` et composée uniquement de chiffres,
d'espaces, de points, de parenthèses et de tirets ne peut nommer ni
fonction, ni cellule, ni commande DDE — tous exigent une lettre. `=`,
`@`, la tabulation et les retours à la ligne ne sont jamais exemptés.
`\n` a par ailleurs été ajouté à la liste, `\r` y figurant déjà.

Vérifié de bout en bout, pas seulement sur la fonction : un
`=HYPERLINK(...)` posté sur le formulaire public de la vitrine, puis
`GET /api/export/leads` téléchargé et inspecté — la charge en ressort
précédée d'une apostrophe, et le téléphone intact. Prouvé par deux
mutations : en rendant la neutralisation inopérante, l'export rend la
même forme que la ligne reproduite ci-dessus ; en élargissant l'exemption
d'un seul caractère, `+A1` et `+cmd|'/C calc'!A0` repassent.

---

<a id="bug-04"></a>
## 🟠 BUG-04 — Pièces d'identité et actes de propriété servis sans authentification **[CONFIRMÉ]**

**Fichiers :** `app/api/upload/route.ts` · `lib/storage.ts` · `nginx/nginx.conf`

`DocumentType` comprend `piece_identite`, `acte_propriete`,
`contrat_vente` et `contrat_location`. Ces fichiers sont déposés dans
`/uploads/documents/` et servis **sans qu'aucune session ne soit
vérifiée** — par Next auparavant, par nginx depuis le déploiement.

Le middleware ne les protège pas non plus : son matcher exclut les
extensions d'image, et pour tout le reste `/uploads/...` n'est ni
`/agency`, ni `/admin`, ni `/api` — donc `NextResponse.next()`.

La seule protection est la difficulté à deviner le nom :

```ts
const timestamp = Date.now()
const random = Math.random().toString(36).substring(2, 8)
```

Un horodatage à la milliseconde, donc largement prévisible pour qui sait
quand un document a été déposé, et six caractères tirés de `Math.random()`,
qui n'est pas un générateur cryptographique. Ce n'est pas un contrôle
d'accès : c'est une URL secrète, qui fuit par l'historique, le partage de
lien, les sauvegardes de navigateur.

En mode Supabase, le bucket est public et le problème est identique.

**Correction :** router les documents par
`/api/documents/[id]/file`, avec `getApiAgency()` et vérification que le
document appartient à l'agence, puis diffusion du flux. Les photos de
biens, elles, ont vocation à rester publiques — la vitrine en dépend :
séparer les deux chemins.

### ✅ Corrigé — story 1.3, 10-08-2026

`app/api/documents/[id]/file/route.ts` sert désormais les documents
derrière `getApiAgency()` et un `findFirst({ where: { id, agencyId } })`,
et `nginx/nginx.conf` renvoie 404 sur `/uploads/documents/`. Vérifié sur
la pile Docker, sans session : `/uploads/documents/…` → 404,
`/uploads/properties/…` → 200. Trois tests e2e couvrent l'appartenance,
l'absence de session et le cloisonnement inter-agences.

Deux réserves consignées, ni l'une ni l'autre corrigée ici :

- **Le mode Supabase reste non protégé** — le seau est public et sert
  aussi la vitrine. Le serveur refuse maintenant de fonctionner dans ce
  mode (`lib/env.ts`) plutôt que d'afficher une protection qui n'existe
  pas. Un seau privé dédié aux documents reste à ouvrir.
- **Un super admin reçoit 401 sur tout document**, `getApiAgency()`
  exigeant une agence. Position sûre par défaut, en attente de la
  story 5.1.

---

<a id="bug-05"></a>
## 🟡 BUG-05 — Commission d'un bien non bornée : plantage et calcul faux **[CONFIRMÉ]** ✅ **CORRIGÉ**

**Fichiers :** `lib/validations/index.ts:202` · `prisma/schema.prisma:337` · `app/agency/rental-management/page.tsx:~128`

Le formulaire annonce « Commission (%) », la colonne est
`Decimal(5, 2)` — donc strictement inférieure à 1000 — et le schéma Zod
n'impose que `>= 0` :

```ts
commission: optionalNumber,   // aucune borne haute
```

Deux conséquences, selon ce que saisit l'utilisateur :

| Saisie | Intention probable | Résultat |
|--------|--------------------|----------|
| `1000` | 1 000 DA de commission | `numeric field overflow` → **écran d'erreur**, saisie perdue |
| `150` | 150 000 DA | accepté : la gestion locative calculera 150 % du loyer |

Vérifié directement contre la base :

```
select 1000::numeric(5,2);
ERROR: numeric field overflow
```

Le calcul aval, lui, est correct — `Math.round(rent * rate / 100)` dans
`generateMonth` — mais il applique fidèlement un taux absurde.

**Correction :** `.max(100)` sur la commission d'un bien, et un message
qui dit explicitement « en pourcentage du loyer ou du prix de vente ».

✅ **CORRIGÉ le 17-08-2026, story 3.1.** `propertySchema.commission` passe
par une primitive `tauxPourcent` (0 à 100 **inclus** — un mandat à 100 % est
légitime), dont le message nomme le pourcentage. `1000` et `150` sont
refusés par un message français ; `100` passe.

> **Le piège que la correction a dû éviter, et il n'est pas visible depuis
> le nom du champ.** « Commission » désigne **trois** choses dans ce
> schéma : `Property.commission` est un **taux** en `Decimal(5,2)`, mais
> `Sale.commission` et `RentalManagement.commission` sont des **montants**
> en `Decimal(15,2)`. Un `.max(100)` posé sur le nom du champ aurait rendu
> impossible toute commission de vente au-delà de 100 DA — `CLAUDE.md` §8.
> Un test dédié le garde, et la mutation le prouve : le taux appliqué à
> `saleSchema`, ce test rougit seul.

> **Étendu, délibérément.** Le même débordement vivait sur **toutes** les
> colonnes `Decimal(15,2)` — `salePrice`, `finalPrice`, `monthlyRent`,
> `amount`… — qui passent par `optionalNumber` et `requiredAmount`, sans
> aucune borne haute. Borner la seule commission aurait laissé un
> `salePrice` de 10 000 000 000 000 produire exactement le
> `numeric field overflow` que ce défaut décrit. Borne mesurée :
> `9 999 999 999 999,99` accepté, la valeur suivante refusée (code `22003`).

---

<a id="bug-06"></a>
## 🟡 BUG-06 — Statut d'agence casté sans validation ✅ **CORRIGÉ**

> **Corrigé le 16-08-2026 par le commit `92f826b` — et personne ne l'a su.**
> Le remplacement du cast par `parseForm(agencyStatusSchema, formData)` est
> arrivé en **effet de bord de l'épopée 6**, qui refaisait cette action pour
> y porter l'offre d'abonnement. Aucune story ne portait `BUG-06`, ce
> registre n'a pas été mis à jour, et **rien ne le prouvait** : la suite ne
> contenait aucun cas postant un statut forgé.
>
> La story 3.2 (17-08-2026) a donc trouvé le correctif déjà en place. Elle
> lui a apporté ce qui manquait — la preuve et la trace — puis a lancé le
> balayage exigé par son AC-3, qui a relevé **six autres sites du même
> défaut** : c'est [BUG-38](#bug-38).
>
> `tests/enums.spec.ts` couvre désormais ce chemin ; la mutation le
> confirme (statut d'agence non validé → 1 rouge, et son message nomme
> l'absence de refus lisible).
>
> ```bash
> git log --oneline -L 129,140:app/admin/agencies/page.tsx
> ```

**Fichier :** `app/admin/agencies/page.tsx:100`

```ts
const status = formData.get("status") as "pending" | "active" | "suspended"
```

C'est exactement la pratique que `lib/form.ts` dénonce dans son propre
commentaire d'en-tête — « les Server Actions recevaient jusqu'ici des
`formData.get(x) as Enum`, c'est-à-dire aucune validation ». Le nettoyage
a été fait partout **sauf ici**. C'est le dernier cast d'énumération du
projet.

Le schéma qui conviendrait existe déjà et n'est utilisé nulle part :
`agencyStatusSchema`, `lib/validations/index.ts:~420`.

Impact réel modeste — la route est réservée au super admin — mais une
valeur arbitraire produit une erreur Prisma brute en pleine page, au lieu
du message français que reçoit l'utilisateur partout ailleurs.

---

<a id="bug-07"></a>
## 🟡 BUG-07 — Console super admin : tout charger pour compter

**Fichier :** `app/admin/agencies/page.tsx:75-79`

```ts
const agencies = await prisma.agency.findMany({
  include: { users: true, properties: true },   // toutes les lignes…
})
```

…pour n'en afficher que la longueur, lignes 288-289 :

```tsx
<TableCell>{agency.users.length}</TableCell>
<TableCell>{agency.properties.length}</TableCell>
```

Avec 50 agences de 2 000 biens, la page hydrate 100 000 objets Property
complets — description, prix, coordonnées — pour afficher deux nombres.
C'est une dégradation qui grandit exactement avec le succès commercial du
produit.

La page voisine, `app/admin/statistics/page.tsx:51`, fait déjà les choses
correctement avec `_count`. Il s'agit d'aligner l'une sur l'autre.

> ✅ **Corrigé le 17-08-2026 — story 3.3.**
>
> **Mesuré avant d'écrire une ligne**, sur une agence de 500 biens montée
> pour l'occasion puis effacée :
>
> ```
> include complet : 624 944 octets, 23 ms
> _count          :  34 112 octets,  4 ms
> ```
>
> Soit **18,3 ×** le volume et **5,8 ×** le temps — ≈ **1,18 Ko par bien**,
> payé à chaque affichage. Sur les données réelles de la base de
> développement (67 agences, 160 comptes, 6 biens) : 98 075 → 33 621 octets.
>
> Le scénario de l'audit — 50 agences de 2 000 biens — n'a **pas** été monté.
> Extrapolé au coût par ligne ci-dessus il vaut ≈ 118 Mo par affichage :
> c'est un calcul, pas une mesure.
>
> **§8 — le nombre affiché ne change pas, et c'était la question à poser.**
> Le filtre de corbeille de `lib/prisma.ts` ne couvre que le **premier
> niveau** : ni l'`include` d'hier ni le `_count` d'aujourd'hui. Les deux
> comptent les biens en corbeille. Vérifié plutôt que déduit — *0 agence
> dont le nombre changerait*, et `.length=500 / _count=500` sur le décor.
>
> Qu'un bien en corbeille reste compté est un **autre** défaut :
> [BUG-24](#bug-24), porté par la story 3.5.
>
> Couvert par `tests/comptage.spec.ts` — un test fonctionnel (2 comptes,
> 3 biens : des nombres **différents**, sinon une colonne branchée sur
> l'autre resterait verte) et un test d'invariant sur la forme de la
> requête. Trois mutations, trois rouges.

---

<a id="bug-08"></a>
## 🟡 BUG-08 — Vitrine publique sans pagination

**Fichier :** `app/vitrine/[slug]/page.tsx:113`

Les onze listes de l'espace agence utilisent `readPageParams()` et sont
bornées à 100 lignes. La seule page **publique** du logiciel, celle qui
sert d'argument commercial et que les moteurs de recherche visitent, ne
l'est pas : `findMany` sans `take`.

Une agence qui réussit — mille biens publiés — sert une page de plusieurs
mégaoctets à chaque visiteur, et à chaque passage de robot d'indexation.
C'est le module désigné « prioritaire » dans `CONTEXT.md`.

> ✅ **Corrigé le 17-08-2026 — story 3.4.**
>
> **Mesuré sur l'application servie**, sans authentification — ce coût-ci
> traverse le réseau, contrairement à celui de [BUG-07](#bug-07). Décor de
> 300 biens publiés, avec photo et description :
>
> ```
> avant : /vitrine/{slug}  2 302 954 octets, 399 ms
> après : /vitrine/{slug}    222 231 octets, 210 ms
> ```
>
> Soit ≈ **7,7 Ko par bien**, servis à chaque visite et à chaque passage de
> robot. Et une seconde chose s'y lisait : **`?page=2` rendait la page 1 à
> l'octet près** (2 302 986 contre 2 302 954). Il n'y avait pas une
> pagination à réparer — il n'y en avait aucune.
>
> **§8 — le piège n'était pas la lenteur, c'était un nombre.** Le bandeau
> affiche en très gros « N biens disponibles » : l'argument commercial de
> l'agence. Branché sur la liste paginée, il aurait annoncé **25** à toutes
> les agences du produit — une régression plus grave que le défaut corrigé.
> Il passe par un `count()` portant le **même `where`** que la liste, donc
> il suit les filtres exactement comme avant.
>
> Deux cas sont **nés** de la pagination, et sont traités : `?page=99` dit
> désormais « cette page n'existe pas » plutôt que « aucun bien ne
> correspond », qui serait faux ; et chaque page porte son numéro dans son
> titre, sans quoi les pages 2, 3… seraient du contenu dupliqué annoncé à
> l'identique.
>
> **Le plan du site n'est pas touché** — l'acceptation l'exigeait. Mais le
> balayage a montré qu'il ne tient pas le scénario de cette même
> acceptation : 50 agences × 2 000 biens font 100 001 URL pour une limite
> de 50 000. → `REP-105`, story 3.12.
>
> Couvert par `tests/vitrine-pagination.spec.ts` — quatre cas, **sans
> aucune connexion**, comme un robot. Cinq mutations jouées séparément.

---

<a id="bug-09"></a>
## 🟡 BUG-09 — `/api/upload` sans limitation de débit ni contrôle du contenu

**Fichier :** `app/api/upload/route.ts`

Deux manques distincts.

**Pas de limitation de débit.** La connexion, l'inscription, la
réinitialisation et le formulaire public en ont une. Le dépôt de fichier,
non — alors que c'est la seule route qui écrive sur le disque. Un compte
agent compromis, ou simplement une boucle maladroite dans un script,
remplit le volume `uploads_data` sans rencontrer d'obstacle.

**Le type est celui que déclare le client.** `file.type` provient de
l'en-tête `Content-Type` de la partie multipart, contrôlée par
l'appelant. Un fichier arbitraire annoncé `image/png` est accepté, puis
stocké avec l'extension `.png`. La conséquence est aujourd'hui limitée —
nginx sert ces fichiers avec `X-Content-Type-Options: nosniff`, et SVG
n'est pas dans la liste autorisée — mais le contrôle repose sur une
déclaration de l'attaquant.

**Correction :** un `rateLimit()` par agence, et une lecture des premiers
octets pour confronter la signature réelle au type déclaré.

### ✅ Corrigé — story 2.2, 11-08-2026

**La déclaration du client n'est plus lue du tout.** Le remède proposé
ci-dessus — « confronter la signature réelle au type déclaré » — a été
écarté. Exiger l'accord des deux paraît plus sévère ; c'est une illusion.
Un attaquant maîtrise les deux côtés et obtient l'accord quand il veut.
La comparaison n'arrête personne, elle ne fait que refuser des clients
honnêtes dont le navigateur a étiqueté autrement (`image/jpg` contre
`image/jpeg`, `application/octet-stream` faute d'association système).
`ALLOWED_TYPES` et `EXTENSION_BY_MIME` ont donc disparu : `lib/file-type.ts`
reconnaît quatre signatures, exigées **à l'octet 0**, et le type reconnu
décide seul de l'admission, de l'extension et du `contentType` stocké.

**Une conséquence que ce registre ne disait pas, et qui était la plus
lourde.** `file.type` partait tel quel dans `putFile({ contentType })`.
En production, le stockage est Supabase : ce type est posé sur l'objet et
renvoyé à chaque lecture publique, par un domaine qui n'est pas le nôtre
et n'a donc pas le `X-Content-Type-Options: nosniff` de notre nginx. La
protection citée plus haut ne couvrait que le mode local.

**Ce que ce contrôle ne ferme pas, et il faut le savoir avant de s'y
fier :** il prouve les premiers octets, pas le fichier. Un PNG
authentique peut contenir n'importe quoi après son en-tête — c'est ainsi
que fonctionne un polyglotte. Cette seconde classe se ferme par
ré-encodage de l'image, impossible pour le PDF ; c'est une autre story,
reportée explicitement.

**Le budget est de 40 dépôts par tranche de dix minutes et par agence**,
compté après le garde d'authentification. Fenêtre courte à dessein : ce
compteur n'est pas le quota de disque, et une agence qui charge son
catalogue doit attendre dix minutes, pas une heure. Il ne borne pas le
disque (40 × 5 Mo / 10 min = 1,2 Go/h/agence) ; il retire le cas « des
milliers de fichiers par minute ».

Quatre tests, dont une table de signatures écrite en octets littéraux et
un test de budget qui inscrit puis fait activer **sa propre agence** —
ce qui prouve au passage que le compteur est bien par agence. Trois
mutations tuées : détection retirée, extension rendue au type déclaré,
`rateLimit` désactivé.

---

<a id="bug-10"></a>
## 🟡 BUG-10 — `requireAgencyAdmin` : commentaire faux, branche morte

**Fichier :** `lib/auth-guard.ts:74-90`

```ts
/**
 * Le super admin passe aussi : il doit pouvoir depanner une agence.
 */
export async function requireAgencyAdmin() {
  const context = await requireAgency()      // ← rejette déjà le super admin
  if (context.userRole !== "agency_admin" && context.userRole !== "super_admin") {
```

`requireAgency()` redirige vers `/auth/login` dès que la session n'a pas
d'`agencyId` — ce qui est *toujours* le cas d'un super admin, par
construction. La branche `userRole === "super_admin"` n'est donc jamais
atteinte, et le commentaire décrit une capacité qui n'existe pas.

Deux coûts. Le premier est de maintenance : quelqu'un lira ce commentaire
et bâtira dessus. Le second est visible pour l'utilisateur — un super
admin qui suit un lien vers `/agency/...` atterrit sur l'écran de
connexion **alors qu'il est connecté**, ce qui se lit comme une session
expirée.

**Décision à prendre, pas seulement un correctif :** soit on retire le
commentaire et la branche morte, soit on implémente réellement le
dépannage (un super admin endosse une agence, avec journalisation). La
seconde option a une valeur produit ; elle relève du PRD, pas d'un
correctif de bug.

---

<a id="bug-11"></a>
## 🔵 BUG-11 — Entiers non bornés → dépassement de colonne **[CONFIRMÉ]** ✅ **CORRIGÉ**

**Fichier :** `lib/validations/index.ts:57-65` (`optionalInt`)

`rooms`, `bedrooms`, `bathrooms`, `floor`, `totalFloors` acceptent tout
entier positif. Les colonnes sont des `Int` PostgreSQL (32 bits) : au-delà
de 2 147 483 647, l'écriture échoue avec une erreur brute. Même famille
que BUG-05, gravité moindre — personne ne saisit un milliard de chambres
par erreur, mais un doigt qui reste appuyé y arrive.

✅ **CORRIGÉ le 17-08-2026, story 3.1.** Deux couches, et il en fallait deux.

- `optionalInt` porte désormais la borne de la **colonne** — l'entier signé
  32 bits, mesuré : `2147483647` accepté, `2147483648` refusé
  (`integer out of range`, code `22003`).
- Les champs d'un bien reçoivent par-dessus une borne **réaliste** :
  100 pièces, 200 étages.

> **Pourquoi deux couches plutôt qu'une.** `Document.size` partage
> `optionalInt` et vaut des **octets** : une borne de logement posée sur la
> primitive commune aurait cassé tout téléversement — 5 Mo, c'est
> 5 242 880. Un test le garde, avec son contrôle positif.

> Bornes vérifiées sans effet de bord : aucune fiche existante ne les
> dépasse (maximums observés le 17-08-2026 — 7 pièces, 6 étages, 10 % de
> commission).

---

<a id="bug-12"></a>
## 🔵 BUG-12 — Inscription simultanée : 500 au lieu d'un message

**Fichier :** `app/api/auth/register/route.ts:80-100`

La vérification d'unicité (`findUnique`) et la création sont séparées, et
la vérification est hors de la transaction. Deux inscriptions concurrentes
avec la même adresse font lever P2002 à la seconde, qui tombe dans le
`catch` générique et renvoie « Une erreur est survenue » avec un code 500 —
au lieu du « Cet email est déjà utilisé » prévu, en 400.

---

<a id="bug-13"></a>
## 🔵 BUG-13 — `maxSize` du sélecteur de fichier jamais appliqué

**Fichier :** `components/upload/UploadDropzone.tsx:18, 116`

La propriété `maxSize` n'est utilisée que pour composer le texte
« Max 5MB » sous la zone de dépôt. Aucune vérification n'a lieu avant
l'envoi : un fichier de 200 Mo est téléversé en entier, puis refusé par le
serveur. Sur une connexion algérienne moyenne, l'utilisateur attend
plusieurs minutes pour recevoir une erreur qui était connue d'avance.

---

<a id="bug-14"></a>
## 🔵 BUG-14 — Nom de bucket non échappé dans une expression régulière

**Fichier :** `lib/storage.ts` (`keyFromUrl`)

```ts
new RegExp(`/object/public/${SUPABASE_BUCKET}/(.+)$`)
```

Un nom de bucket contenant un point ou un tiret entre crochets modifie
silencieusement le motif. `keyFromUrl` renvoie alors `null`, et la
suppression d'un document laisse le fichier orphelin dans le bucket —
facturé, et introuvable. La valeur vient de la configuration, pas d'un
utilisateur : gravité faible, correction triviale.

---

<a id="bug-15"></a>
## 🔵 BUG-15 — Référence métier illisible dans les exports **[CONFIRMÉ]**

**Fichier :** `prisma/schema.prisma:312` · `app/api/export/[entity]/route.ts`

```prisma
reference String @unique @default(cuid())
```

La colonne « Référence » de l'export des biens contient
`cmslq2teb000f42dumpcxt1v7`. Une agence qui exporte pour son comptable ou
son notaire attend `AQ-2026-0042`. Ce n'est pas un défaut technique — le
logiciel fonctionne — mais c'est une donnée inutilisable dans l'usage
auquel l'export est destiné. Même remarque pour `Payment.reference`, qui
apparaît sur les quittances PDF (tronqué aux dix derniers caractères).

---

<a id="bug-16"></a>
## 🔵 BUG-16 — `robots.txt` n'exclut pas `/uploads/` **[CONFIRMÉ]**

**Fichier :** `app/robots.ts:20`

```ts
disallow: ["/agency/", "/admin/", "/api/", "/auth/"],
```

`/uploads/` manque. Les documents ne sont liés depuis aucune page
publique, donc le risque immédiat est faible — mais c'est la seconde
serrure de BUG-04, et elle coûte un mot.

### ✅ Corrigé — story 1.3, 10-08-2026

`/uploads/` est ajouté à `disallow` dans `app/robots.ts`.

---

<a id="bug-17"></a>
## 🔵 BUG-17 — Budget de force brute doublé

**Fichiers :** `auth.ts:60-80` · `app/auth/login/actions.ts:36-45`

`authorize()` accorde 10 tentatives par compte et par quart d'heure.
`explainLoginFailure()` revalide le mot de passe avec **son propre**
compteur, sous une autre clé (`explication:compte:…`), et 10 tentatives
supplémentaires. Un attaquant qui appelle directement la Server Action
dispose donc de 20 essais par quart d'heure au lieu de 10.

La conception est saine — revalider avant de révéler une raison précise
est la bonne décision. C'est le partage du compteur qui manque.

---

<a id="bug-18"></a>
## 🔵 BUG-18 — Limitation de débit non partagée entre instances

**Fichier :** `lib/rate-limit.ts`

Le module le documente honnêtement : les compteurs vivent dans la mémoire
du processus. Sur le VPS unique prévu, c'est exact. Il est inscrit ici
parce que c'est la première chose qui devient fausse le jour où l'on passe
à deux conteneurs — et que ce jour-là, rien ne préviendra : les limites
seront simplement multipliées par le nombre d'instances.

---

<a id="bug-19"></a>
## 🔴 BUG-19 — Une clé d'API Figma en clair, versionnée dans le dépôt **[CONFIRMÉ]**

**Fichier :** `mcp-config.json:7` — suivi par git depuis le commit `a529f61`

```json
"env": { "FIGMA_API_KEY": "figd_…" }
```

Un jeton personnel Figma est en dur dans le dépôt. Le fichier n'est pas
dans `.gitignore`, il est dans l'historique, et il y restera après la
suppression du fichier.

C'est la violation directe de la règle 11 de `CLAUDE.md` (« Pas de secrets
dans le repo ») et de la case « Pas de clés/secrets en dur » de la liste
avant commit. Le reste du projet est irréprochable sur ce point : `.env`
est bien ignoré, `.env.example` ne contient que des valeurs d'exemple, et
`lib/env.ts` refuse de démarrer si le secret de session est resté celui du
modèle.

**Correction.** **Révoquer la clé chez Figma d'abord** — supprimer le
fichier ne la désactive pas. Puis ajouter `mcp-config.json` à
`.gitignore`, lire la valeur depuis une variable d'environnement, et
purger l'historique (`git filter-repo`) si le dépôt doit être partagé.

> **Arbitrage du 13-08-2026 : Figma est abandonné.** « On ne va plus
> l'utiliser. » Le volet « lire la valeur depuis une variable
> d'environnement » tombe donc : on ne sécurise pas l'accès à un outil
> qu'on retire. `mcp-config.example.json` est supprimé — son unique serveur
> était Figma — et il n'y a plus aucune configuration MCP dans ce dépôt.
>
> **La clé, elle, n'est toujours pas révoquée, et le défaut reste
> OUVERT.** Le retrait du dépôt n'y change rien. Vérifié le 13-08-2026, la
> clé est vivante à **deux** endroits, pas un :
>
> | Où | Preuve |
> |---|---|
> | `main`, commit `a529f61` | `git show a529f61:mcp-config.json` la renvoie en clair |
> | `origin/feature/design-improvements` | `mcp-config.json` y est **encore suivi**, et la branche est **poussée sur GitHub** |
>
> Cette seconde localisation était inconnue jusqu'au 13-08-2026 : elle a
> été trouvée en inventoriant les branches, pour une tout autre raison.
> **Conséquence directe : purger l'historique de `main` n'aurait pas fermé
> le défaut**, et aurait donné le sentiment inverse. La branche est tracée
> en `REP-77`.
>
> L'abandon de Figma rend la révocation **gratuite** — plus aucun usage
> n'en dépend. C'était la seule justification du report du 10-08-2026, et
> elle est tombée. Une fois la clé révoquée, la purge de l'historique
> devient sans objet : un jeton mort n'est plus un secret.

---

<a id="bug-20"></a>
## 🔴 BUG-20 — Toute la limitation de débit applicative se contourne avec un en-tête **[CONFIRMÉ]**

**Fichiers :** `lib/rate-limit.ts:120-130` · `nginx/nginx.conf:81, 93, 106`

`ipFromHeader()` lit `X-Forwarded-For` et retient la **première** valeur de
la liste. Or nginx est configuré avec
`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`, qui ajoute
l'adresse réelle **à la suite** de ce que le client a envoyé. La première
valeur est donc celle que l'appelant a choisie.

```
req 1..5  POST /api/auth/register                  → 400  (compteur consommé)
req 6     POST /api/auth/register                  → 429  Trop de tentatives
          POST /api/auth/register  XFF: 9.9.9.1    → 400  compteur neuf
          POST /api/auth/register  XFF: 9.9.9.2    → 400  compteur neuf
          POST /api/auth/register  XFF: 9.9.9.3    → 400  compteur neuf
```

Deux protections tombent entièrement, parce qu'elles ne comptent que par
adresse : l'inscription (5/h) et le formulaire public de la vitrine (5/h),
dont le seul autre garde-fou est un piège à robots trivial. La connexion et
« mot de passe oublié » résistent mieux — leur compteur par compte tient —
mais leur seuil par adresse, celui qui vise le script balayant des
centaines de comptes, disparaît.

Le `limit_req` de nginx reste valide : il utilise `$binary_remote_addr`,
que le client ne contrôle pas. Mais il est calibré pour la protection du
serveur (10 r/s), pas pour l'abus métier.

**Correction.** Faire confiance à `X-Real-IP` en priorité — nginx le pose
lui-même depuis `$remote_addr` et le client ne peut pas l'écraser. À
défaut, lire `X-Forwarded-For` par la fin en sautant un nombre connu de
proxys de confiance. Inverser l'ordre des deux lectures dans
`ipFromHeader()` suffit ici.

### ✅ Corrigé — story 1.4, 10-08-2026

**`X-Forwarded-For` n'est plus lu du tout**, et c'est plus radical que la
correction proposée ci-dessus. Cet en-tête est une **liste dont la
longueur dépend de la topologie** : lire la première valeur est faux
derrière un proxy qui ajoute à la fin, lire la dernière est faux dès
qu'il y a deux proxys, et lire n'importe laquelle est faux quand il n'y a
aucun proxy. Aucune lecture n'est correcte sans connaître le nombre de
sauts de confiance — et le déduire est exactement l'erreur d'indice qui a
produit ce défaut.

L'appelant est identifié sur **un seul en-tête, à un seul auteur** :
`X-Real-IP`, que nginx **remplace** depuis `$remote_addr`. Le nom est
configurable par `TRUSTED_IP_HEADER` (`cf-connecting-ip` derrière un CDN,
`none` sans proxy). La valeur `x-forwarded-for` est **refusée au
démarrage** : une configuration ne doit pas pouvoir rouvrir en silence un
défaut fermé dans le code.

La valeur lue est validée par `net.isIP`, **puis ramenée à une écriture
unique** : une liste, un port, des crochets ou du texte libre deviennent
`inconnu`, et `1.2.3.4`, `::ffff:1.2.3.4`, `0:0:0:0:0:ffff:1.2.3.4`
désignent un seul compteur. `isIP` valide la forme, il ne canonicalise
pas — sans cette seconde étape, une même machine disposait de dizaines
d'écritures acceptées, et le zone-id (`fe80::1%0`, `%00`, `%000`, jusqu'à
huit mille caractères) en offrait une infinité.

**Ce contrôle ne borne pas le NOMBRE de compteurs.** Il y a 2¹²⁸ adresses
IPv6 valides, et une allocation résidentielle /64 suffit à en ouvrir une
par requête, vivante une heure. Un plafond de 50 000 entrées a été posé —
au plafond, on refuse d'en créer sans en évincer aucune, car évincer
donnerait à l'attaquant le moyen d'effacer le compteur de sa victime.
C'est un garde-fou, pas une solution : la vraie réponse est un magasin
partagé et borné ([BUG-18](#bug-18), story 5.6).

nginx transmet désormais `X-Forwarded-For $remote_addr` : la liste du
client n'atteint plus l'application. Vérifié à travers la vraie
configuration — le client envoie `9.9.9.1, 9.9.9.2` et l'amont reçoit
`172.17.0.1`.

Prouvé par mutation : en rétablissant la lecture de la première valeur de
`X-Forwarded-For`, trois adresses forgées rouvrent chacune un compteur
(400 au lieu de 429). En retirant le contrôle `isIP`, douze identités
invalides ouvrent douze compteurs.

**⚠ Limite résiduelle — réduite, pas levée.** Cette correction rend
l'identification juste *derrière le proxy*. L'application publiait alors
son port sur l'hôte ([BUG-22](#bug-22)) : n'importe quelle machine la
joignait sans passer par nginx et posait `X-Real-IP` elle-même. **La
story 2.1 a retiré cette publication le 11-08-2026**, ce qui ferme le
chemin distant — le seul qui comptait pour un VPS exposé.

Reste ouvert, et il faut le dire : un processus tournant **sur l'hôte**
atteint le conteneur par son adresse de réseau Docker. Vérifié —
`curl http://<ip-du-conteneur>:3000/api/public/health` → 200, en-tête
forgé compris. Aucun réglage de docker-compose ne referme ce chemin, pas
même un réseau `internal: true` ; il y faut une règle de pare-feu dans la
chaîne `DOCKER-USER`. La réserve reste entière, elle, pour tout
déploiement sans reverse proxy.

La rotation d'**adresses réelles** (botnet, réseau mobile) reste ouverte :
compter par adresse ne peut pas y répondre. Versé dans
`docs/stories/deferred-work.md`.

---

<a id="bug-21"></a>
## 🟠 BUG-21 — Suppression de fichier arbitraire, et inter-agences, par l'URL d'un document

**Fichiers :** `lib/validations/index.ts:365` · `app/agency/documents/new/page.tsx:48-58` · `lib/storage.ts:106-137` · `app/api/documents/[id]/delete/route.ts:51-54`

Le champ `url` d'un document est une chaîne libre validée par un simple
`z.string().trim().min(1)`. Elle vient d'un champ caché du formulaire
(`documentUrl`), donc entièrement contrôlée par l'appelant — contrairement
à la galerie des biens, où `parseGalleryUrls()` impose
`/^\/uploads\/[a-z]+\/[A-Za-z0-9._-]+$/`.

À la suppression, cette valeur redescend jusqu'à un `unlink` :

```ts
const key = keyFromUrl(document.url)   // /\/uploads\/(.+)$/ → capture tout
await deleteFile(key)                  // unlink(join(cwd, "public/uploads", key))
```

`join()` normalise les `../` : une URL enregistrée comme
`/uploads/../../../chemin/vers/un/fichier` fait supprimer ce fichier avec
les droits du processus. En mode Supabase, le même mécanisme supprime un
objet quelconque du bucket — **partagé entre toutes les agences** : un
administrateur d'agence peut effacer les photos d'une autre agence sans
jamais sortir de son propre espace.

**Correction.** Ne jamais faire confiance à l'URL postée. Soit valider
`documentSchema.url` avec la même expression régulière que la galerie,
soit — mieux — poster la `key` renvoyée par `/api/upload` et reconstruire
l'URL côté serveur. Ajouter dans `deleteFile()` un refus de toute clé
contenant `..` ou commençant par `/`.

### ✅ À moitié corrigé — story 1.3, 10-08-2026 (complété à la revue)

**Fait :** `deleteFile()` passe par le même verrou de chemin que la
lecture (`safeKey` + résolution réelle avec `realpath`, `lib/storage.ts`).
Une `url` forgée ne fait plus supprimer de fichier hors de
`public/uploads/`, ni en mode local ni en mode Supabase. C'était la
conséquence la plus grave, et elle est irréversible : elle passe en
premier.

**Correction de ce constat, le même jour.** La première version de la
story n'avait fermé que la moitié *hors* `uploads/`. Le volet
**inter-agences** — explicitement nommé dans le titre de ce défaut —
restait ouvert : `documents/../properties/photo-de-B.jpg` reste sous
`public/uploads/` et passait, tout comme la simple reprise de la clé d'un
document d'une autre agence. La revue adversariale l'a relevé, vérifié en
exécutant la logique réelle, et il est désormais fermé :

- `safeKey` refuse **tout** segment `..`, même retombant sous la racine ;
- `lib/documents.ts` range les documents par agence
  (`documents/<agencyId>/…`) et rattache le fichier à son propriétaire —
  règle unique, appliquée à la lecture **et** à la suppression ;
- les fichiers déposés à plat avant ce jour restent lisibles, mais
  l'exception est refermée par une vérification en base.

Prouvé par mutation : en remplaçant `documents/<agencyId>/` par
`documents/`, l'agence voisine télécharge le document de l'agence de
démonstration (200 au lieu de 404).

**Complété — story 1.7, 10-08-2026.** `documentSchema.url` n'accepte
plus que deux formes, et `ownsDocumentUrl` vérifie à l'écriture que le
fichier désigné appartient bien à l'agence qui l'enregistre. La colonne
cesse d'être une entrée utilisateur. Le champ « URL » de la page
d'édition a été supprimé : le fichier d'un document est fixé à son dépôt.

Les gardes de lecture de la story 1.3 restent en place — elles couvrent
les lignes écrites avant ce jour.

---

<a id="bug-22"></a>
## 🟠 BUG-22 — L'application est publiée hors de nginx, sur le port 3000

**Fichier :** `docker-compose.prod.yml:81-82`

```yaml
frontend:
  ports:
    - "${APP_PORT:-3000}:3000"
```

Le service applicatif publie son port sur l'hôte. nginx cesse alors d'être
un passage obligé : il devient une porte parmi deux. Vérifié —
`http://localhost:3000/api/public/health` répond 200, et les requêtes
d'inscription y passent sans rencontrer le `limit_req` de nginx.

Sur un VPS exposé : limites de débit du proxy contournées, futur TLS
contourné, application jointe directement en HTTP quel que soit le soin
apporté à la configuration nginx. Le commentaire du fichier présente ce
port comme « un accès direct utile pour diagnostiquer » — c'est un usage de
développement, pas un réglage de production.

**Correction.** Remplacer `ports` par `expose: ["3000"]` sur le service
`frontend`. Il reste joignable depuis nginx par le réseau interne et
disparaît de l'extérieur. Si l'accès direct reste souhaité en local, le
lier à la boucle locale : `"127.0.0.1:3000:3000"`.

### ✅ Corrigé — story 2.1, 11-08-2026

`expose: ["3000"]` remplace la publication — étant entendu qu'`expose`
est purement documentaire : sur un réseau bridge défini par
l'utilisateur, nginx joindrait le port sans cela. Ce qui ferme, c'est le
retrait de `ports`.

**Ce que cela ferme, et ce que cela ne ferme pas.** Plus aucune machine
distante ne joint l'application sans passer par nginx : c'est le défaut
décrit ci-dessus, et il est fermé. En revanche un processus tournant
**sur l'hôte** atteint toujours le conteneur par son adresse de réseau
Docker :

```
curl http://localhost:3000/api/public/health    → connexion refusée
curl http://192.168.0.2:3000/api/public/health  → 200
```

Aucun réglage de docker-compose n'y change rien — un réseau
`internal: true` a été essayé, l'hôte y accède pareillement. La seule
fermeture réelle est une règle dans la chaîne `DOCKER-USER` d'iptables,
détaillée dans `docker-compose.prod.yml`.

Deux aggravations que ce constat ne nommait pas, désormais écrites dans
le fichier :

- **une publication Docker n'est pas filtrée par le pare-feu de l'hôte.**
  Docker écrit ses règles dans la chaîne `DOCKER` d'iptables, en amont
  des règles usuelles : fermer le port 3000 dans firewalld ou ufw ne
  fermait rien ;
- **c'est la moitié manquante de la story 1.4.** L'identification de
  l'appelant repose sur un en-tête que nginx écrase ; tant que
  l'application était joignable directement, l'appelant le posait
  lui-même et remettait ses compteurs à zéro.

Vérifié sur la pile réelle, avant et après :

```
avant : 0.0.0.0:3000->3000/tcp   curl :3000 → 200
après : 3000/tcp                 curl :3000 → connexion refusée
                                 curl :8095/api/public/health → 200
                                 conteneur healthy
```

Un test de configuration refuse toute republication.

**Conséquence sur [BUG-20](#bug-20) :** la limite résiduelle qui y était
consignée — « l'en-tête de confiance reste posable par qui contourne
nginx » — est levée pour ce déploiement. Elle reste vraie de tout
déploiement sans reverse proxy.

---

<a id="bug-23"></a>
## 🟠 BUG-23 — L'URL d'un document n'est pas contrainte, et elle finit dans un `href`

**Fichiers :** `app/agency/documents/page.tsx:155` · `app/agency/documents/[id]/page.tsx:58, 107`

Même cause que BUG-21, autre conséquence. La valeur libre stockée dans
`Document.url` est rendue telle quelle dans un lien. React 18 émet un
avertissement en console pour une URL `javascript:` **mais la rend
malgré tout**.

Un administrateur d'agence peut donc déposer un lien qui exécute du script
dans le navigateur de ses collègues — ou, plus discrètement, une URL
externe qui ressemble à un document interne et récolte des identifiants.

Portée limitée : il faut déjà un compte de l'agence, et l'effet ne sort pas
de l'agence. C'est néanmoins une élévation depuis « agent » vers
« n'importe quel poste de l'agence ».

**Correction.** La même que pour BUG-21 : contraindre `url` à un chemin
interne. Le correctif règle les deux d'un coup.

### ✅ Corrigé — story 1.3, confirmé story 1.7, 10-08-2026

Fermé sans écrire une ligne pour ce défaut : la story 1.3 a basculé tous
les liens de `app/agency/documents/**` vers `/api/documents/{id}/file`.
Plus aucun `href`, `src` ni `window.open` ne reçoit `document.url` —
vérifié à la story 1.7, qui n'a eu qu'à le constater. La seule occurrence
restante affiche le nom du fichier en texte.

---

<a id="bug-24"></a>
## 🟡 BUG-24 — La suppression réversible ne s'applique pas aux relations imbriquées

**Fichiers :** `lib/prisma.ts:11-27` · `app/agency/owners/page.tsx:46` · `app/admin/statistics/page.tsx:51` · `app/admin/agencies/page.tsx:79` · `app/api/export/[entity]/route.ts:157`

L'extension Prisma qui injecte `deletedAt: null` agit sur le `where` **de
premier niveau** de l'opération. Une lecture de relation imbriquée n'est
pas une opération distincte : elle n'est jamais filtrée. Le commentaire du
fichier — « le filtre est posé ici, une fois, sur le client lui-même » —
décrit donc une garantie plus large que celle réellement offerte.

```ts
prisma.owner.findMany({ include: { _count: { select: { properties: true } } } })
// where Owner   → deletedAt: null  ✔
// count Property               ✘  compte aussi les biens supprimés
```

Effet visible : la liste des propriétaires annonce « 4 biens » alors que la
fiche n'en montre que 3 ; l'export CSV des propriétaires porte le même
écart ; la console super admin et la page statistiques sur-comptent le parc
de chaque agence.

Second angle mort, celui-là documenté dans le fichier : `findUnique` est
volontairement exclu. Le code l'évite partout où il compte — les écrans de
détail utilisent `findFirst` — mais rien n'empêche la prochaine requête de
l'oublier.

**Correction.** Ajouter `where: { deletedAt: null }` à chaque `_count` et
`include` portant sur `Property`, `Client` ou `Owner` — cinq endroits. Puis
corriger le commentaire de `lib/prisma.ts` pour qu'il énonce la limite au
lieu de la masquer.

> ### ✅ Corrigé le 17-08-2026 (story 3.5) — et **le constat ci-dessus était faux sur un point**
>
> **« la liste annonce 4, la fiche n'en montre que 3 » : les deux montraient
> 4.** Mesuré avant correction, décor de 4 biens dont 1 à la corbeille :
> `getByText('Bien 4 …')` résolvait à **1 élément** sur la fiche
> propriétaire. `app/agency/owners/[id]/page.tsx:27` charge `properties` en
> relation imbriquée — donc hors du filtre, exactement comme les `_count`.
> Les deux écrans se trompaient **du même côté**, et étaient d'accord entre
> eux.
>
> C'est plus grave que l'écart décrit : un écart se voit. Le bien supprimé
> s'affichait de surcroît avec un **lien** vers sa fiche d'édition, laquelle
> passe par `findFirst` — donc filtrée, donc `notFound()`.
>
> La ligne d'origine n'est pas réécrite : un constat daté se garde tel quel.
> Mais il ne se recopie pas non plus sans dire ce que la mesure a démenti
> (`CLAUDE.md` §7).
>
> **Ce qui a été corrigé — six endroits, pas cinq :**
>
> | Endroit | Ce qui manquait |
> |---|---|
> | `app/agency/owners/page.tsx` | `_count.properties` |
> | `app/agency/owners/[id]/page.tsx` | `include.properties` ← *le sixième* |
> | `app/api/export/[entity]/route.ts` | `_count.properties` |
> | `app/admin/agencies/page.tsx` | `_count.properties` |
> | `app/admin/statistics/page.tsx` | `_count.properties` et `_count.clients` |
> | `app/vitrine/[slug]/actions.ts` | le dernier `findUnique` du produit |
>
> **Ce qui n'a PAS été filtré, et c'est délibéré.** Vingt-et-un `include`
> nomment `property`, `client` ou `owner` **au singulier**. Aucun ne doit
> l'être : une quittance dont le locataire est à la corbeille doit garder
> son nom, sinon l'agence perd la trace d'un loyer dû. C'est l'arbitrage de
> `BUG-34` / story 3.9, et un test le tient désormais dans les deux sens.
>
> **Mesure du 17-08-2026, avant correction, sur la base de développement :**
> 6 biens, 5 clients, 3 propriétaires, **0 en corbeille** → 0 agence sur 75
> et 0 fiche sur 3 dont un nombre affiché change aujourd'hui. L'écart
> n'apparaîtra qu'à la première mise à la corbeille — ce qui explique
> qu'il ait vécu si longtemps sans être signalé.
>
> **Couverture :** `tests/corbeille-relations.spec.ts`, 5 cas, chacun avec
> son contrôle positif (compte 4 avant, 3 après) — six mutations jouées
> séparément, toutes rouges.

---

<a id="bug-25"></a>
## 🟡 BUG-25 — `robots.txt` est figé sur l'URL de construction **[CONFIRMÉ]**

**Fichiers :** `app/robots.ts` · `docker/Dockerfile:40`

Le même défaut que celui déjà corrigé pour le sitemap, mais sur le fichier
voisin — et le correctif n'y a pas été reporté. `app/sitemap.ts` porte
`export const dynamic = "force-dynamic"` ; `app/robots.ts` non. Il est donc
prérendu pendant `next build`, à l'intérieur de l'image, où `NEXTAUTH_URL`
vaut la valeur factice du Dockerfile.

```
GET /robots.txt   → Sitemap: http://localhost:3000/sitemap.xml   ← URL de build
GET /sitemap.xml  → http://localhost:8095                        ← URL réelle
```

En ligne, `robots.txt` désignera un sitemap qui n'existe pas sur ce
domaine. Les vitrines resteront indexables — les règles `Allow`/`Disallow`
sont statiques et correctes — mais l'indexation perdra le raccourci que le
sitemap devait fournir, ce qui est précisément l'argument commercial du
module vitrine.

**Correction.** `export const dynamic = "force-dynamic"` dans
`app/robots.ts`, exactement comme dans `app/sitemap.ts`.

> ### ✅ Corrigé le 17-08-2026 (story 3.6) — reproduit avant, reproduit après
>
> **La preuve était sur le disque, dans le même dossier :**
>
> ```
> .next/server/app/robots.txt.body      ← figé pendant `next build`
> .next/server/app/sitemap/route.js     ← pas de .body : calculé à l'appel
> ```
>
> **Et de bout en bout** — construit avec une adresse, servi avec une autre,
> le même serveur répondant aux deux requêtes :
>
> | | avant | après |
> |---|---|---|
> | `/robots.txt` | `Sitemap: http://construction.invalid/…` | `http://execution.invalid/…` |
> | `/sitemap.xml` | `<loc>http://execution.invalid</loc>` | `<loc>http://execution.invalid</loc>` |
>
> Après correction, `robots.txt.body` n'est plus produit du tout.
>
> **⚠ `npm run test:e2e` ne peut pas voir ce défaut, et ne le pourra
> jamais.** `playwright.config.ts` construit ET sert avec le même
> environnement : la valeur gelée et la valeur d'exécution y sont
> identiques. C'est la famille de `REP-95`. Trois couches ont donc été
> posées, et aucune ne prétend être ce qu'elle n'est pas :
>
> 1. une **assertion statique** dans `tests/deploiement.spec.ts`, avec son
>    propre contrôle positif sur `app/sitemap.ts` — si le motif était mal
>    écrit, ce contrôle rougirait avant ;
> 2. une étape de **`npm run verify:deploy`**, qui interroge la pile servie
>    et compare `robots.txt` à `sitemap.xml` — **les deux entre eux**, et
>    non à l'adresse de sonde ; ils dérivent du même `appUrl()`, donc ils ne
>    peuvent diverger que si l'un est gelé ;
> 3. la mesure différentielle ci-dessus, faite une fois et écrite ici.

---

<a id="bug-26"></a>
## 🟡 BUG-26 — Aucun TLS dans la configuration nginx, et HSTS envoyé en clair **[CONFIRMÉ]**

**Fichiers :** `nginx/nginx.conf:37` · `next.config.mjs:42-47` · `.env:33`

nginx n'écoute que `listen 80`. Aucun bloc `listen 443 ssl`, aucune
redirection, aucun certificat. `NEXTAUTH_URL` est en `http://` — ce que
`lib/env.ts` signale correctement comme un avertissement — donc le cookie
de session voyage sans attribut `Secure`.

Dans le même temps, `NODE_ENV=production` déclenche l'envoi de
`Strict-Transport-Security: max-age=15552000`. Vérifié : l'en-tête part
bien, **sur une réponse HTTP en clair**. Sur un vrai domaine, un navigateur
qui reçoit cet en-tête refuse le HTTP pendant six mois — si le HTTPS n'est
pas prêt le jour où l'en-tête est reçu, le site devient inaccessible et le
retour en arrière n'est pas immédiat.

`GSD.md` classe honnêtement « HTTPS » dans le reste à faire de la Phase 7.
Le défaut n'est donc pas d'y avoir renoncé, mais d'envoyer déjà l'en-tête
qui suppose que c'est fait.

**Correction.** Bloc `443 ssl` avec Let's Encrypt, redirection 80 → 443,
`NEXTAUTH_URL` en `https://`. Jusque-là, conditionner HSTS à une variable
explicite plutôt qu'à `NODE_ENV`.

---

<a id="bug-27"></a>
## 🟡 BUG-27 — PostgreSQL publié sur l'hôte avec un mot de passe par défaut

**Fichiers :** `docker-compose.prod.yml:28-35` · `.env:17-18`

```yaml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-aqar_password}
ports:
  - "${POSTGRES_PORT:-5433}:5432"
```

Le mot de passe de repli est `aqar_password`, et c'est aussi la valeur
réellement posée dans le `.env` de cette installation. Le port de la base
est publié sur l'hôte par défaut.

Le fichier avertit — « sur un serveur exposé à Internet, supprimez cette
section » — mais le comportement **par défaut** reste l'exposition, alors
que la posture sûre serait l'inverse : ne pas publier, et demander
d'ajouter la ligne pour l'administration. Une valeur de repli devinable
transforme un pare-feu mal réglé en compromission totale de la base.

**Correction.** Retirer la valeur de repli du mot de passe : que compose
échoue si la variable n'est pas posée. Commenter la publication du port, ou
la lier à `127.0.0.1`. Générer un mot de passe réel pour cette
installation.

### ✅ Corrigé — story 2.4, 11-08-2026

Les trois volets sont faits, avec une précision sur le second.

**Le mot de passe est exigé, pas seulement dépourvu de repli.**
`${POSTGRES_PASSWORD:?…}` fait échouer `docker compose` avec un message
qui dit quoi poser. Retirer simplement `:-aqar_password` aurait laissé
compose substituer une chaîne vide — donc un `DATABASE_URL` malformé et
une panne obscure plutôt qu'un refus clair.

**La publication est liée à `127.0.0.1`, pas supprimée**, et c'est
délibéré : `.env` porte un `DATABASE_URL` vu depuis l'hôte dont dépendent
`npm run dev`, Prisma Studio et la suite de tests — qui lance
`next start` sur la machine et non dans Docker. La supprimer aurait rendu
la suite inexécutable. *(Les sauvegardes, elles, n'en dépendent pas : la
procédure du README passe par `docker exec … pg_dump`. La première
rédaction de cette note les citait à tort.)*

Pour une base, la menace est l'accès distant, et il est fermé :

```
avant : 0.0.0.0:5433 et [::]:5433 en écoute
après : LISTEN 127.0.0.1:5433, et rien d'autre
```

**Le mot de passe de l'installation a été changé pour de bon** —
`ALTER USER` appliqué, `.env` mis à jour, services recréés. Vérifié :
l'ancien mot de passe est refusé depuis le réseau Docker. Une note
importante pour toute autre installation : changer `POSTGRES_PASSWORD`
**ne suffit pas** sur une base déjà initialisée, PostgreSQL ne lit cette
variable qu'au premier démarrage.

Un test de configuration refuse toute republication hors boucle locale et
tout retour d'une valeur de repli.

**Deux réserves.** La première est identique à [BUG-22](#bug-22) : un
processus tournant sur l'hôte joint le conteneur par son adresse de
réseau Docker. La liaison locale n'y change rien ; seule une règle
`DOCKER-USER` le ferme.

La seconde a été relevée en revue et mérite d'être écrite : « fermé aux
autres machines » repose sur une propriété du **démon Docker**, pas sur le
fichier compose. Depuis Docker 28, le routage direct vers les adresses de
conteneurs est bloqué par défaut ; sur un démon plus ancien, une machine
du réseau local qui ajoute une route vers le sous-réseau Docker
atteindrait le conteneur. Aucun test ne le vérifie, et la version du
démon n'est contrainte nulle part.

---

<a id="bug-28"></a>
## 🟡 BUG-28 — Dix-sept tests « authentifiés » qui ne s'authentifient jamais **[CONFIRMÉ]**

**Fichiers :** `tests/documents` · `payments` · `rentals` · `sales` · `visits` · `clients` · `properties` · `admin.spec.ts`

Sept fichiers de test contiennent des cas nommés « … when authenticated »
qui ne se connectent à aucun moment et vérifient… la redirection vers
l'écran de connexion.

```ts
test("should display documents list when authenticated", async ({ page }) => {
  await page.goto("/agency/documents")
  await expect(page).toHaveURL(/.*login/)   // ← teste l'inverse de son nom
})
```

Ces cas passent, et ne testent rien de ce qu'ils annoncent. Même chose pour
`api-upload.spec.ts`, dont le test « should reject invalid file types »
n'ouvre pas de session et vérifie donc à nouveau le 401, jamais la
validation de type.

`GSD.md` déclare la Phase 6 « entièrement terminée et validée », avec
« tests E2E créés pour tous les modules ». La réalité : 65 cas au total,
dont `features.spec.ts` (19 cas, 50 assertions) et `regression.spec.ts`
(13 cas, 30 assertions) font tout le travail réel ; les onze autres
fichiers sont des ébauches. `tests/auth-helper.ts` n'est importé que par un
seul fichier.

Ce qui manque, et qui compte le plus ici : **aucun test ne vérifie le
cloisonnement entre agences**, ni la séparation des rôles agent /
administrateur. C'est la propriété centrale du produit, et elle n'est
protégée par aucune régression automatisée.

**Correction.** Supprimer les cas trompeurs ou les faire réellement se
connecter via `auth-helper`. Puis ajouter les deux tests qui valent tous
les autres : un agent de l'agence A qui tente d'ouvrir une fiche de
l'agence B, et un agent qui tente une action réservée à `agency_admin`.

---

<a id="bug-29"></a>
## 🔵 BUG-29 — Le filtre wilaya de la vitrine propose des choix sans résultat

**Fichier :** `app/vitrine/[slug]/page.tsx:114-124`

La liste des biens filtre sur `status: "disponible"` **et**
`isAvailable: true`. La liste des wilayas qui alimente le menu déroulant ne
filtre que sur `status`. Une wilaya dont tous les biens ont
`isAvailable: false` apparaît donc dans le filtre et ne renvoie rien — le
visiteur conclut que la page est cassée.

**Correction.** Ajouter `isAvailable: true` à la seconde requête.

> ### ✅ Corrigé le 17-08-2026 (story 3.6)
>
> Le menu se montrait lui-même dans le message d'échec du test, avant
> correction : `["Toutes", "Alger", "Oran"]` — « Oran » proposé alors que
> son seul bien était retiré de la vente.
>
> **Ce qui n'a délibérément PAS été ajouté à cette requête** : les autres
> filtres — opération, type, budget. Une facette qui se filtre elle-même
> enferme le visiteur dans son premier choix : après avoir sélectionné
> « Alger », il ne pourrait plus voir les autres wilayas pour en changer.
> `isAvailable` n'est pas un filtre de visiteur, c'est une **condition de
> publication**, au même rang que `status` — c'est pour cela, et seulement
> pour cela, qu'elle devait descendre dans les deux requêtes.
>
> **Le balayage n'a trouvé aucune autre divergence de ce type** :
> `rg -n 'distinct:' app lib` ne rend que ce menu, et la fiche publique d'un
> bien (`app/vitrine/[slug]/biens/[id]/page.tsx:44-46`) pose déjà les mêmes
> conditions que la liste et que le plan du site.
>
> **Couverture :** `tests/vitrine-filtres.spec.ts`, 2 cas sans aucune
> connexion — la vitrine est publique, un robot la parcourt ainsi.

---

<a id="bug-30"></a>
## 🔵 BUG-30 — Une directive nginx sans effet sur les fichiers statiques

**Fichier :** `nginx/nginx.conf:43-47`

```nginx
location /_next/static {
  proxy_pass http://nextjs;
  proxy_cache_valid 200 365d;               # ← sans proxy_cache, ne fait rien
  add_header Cache-Control "public, immutable";
}
```

`proxy_cache_valid` n'a d'effet qu'accompagné d'une zone `proxy_cache`,
déclarée nulle part. Aucune mise en cache n'a lieu : chaque requête de
fichier statique réveille Node. Ce bloc ne transmet pas non plus les
en-têtes `Host` et `X-Forwarded-*` posés dans les trois autres.

L'en-tête `Cache-Control: immutable`, lui, fonctionne, et c'est ce qui fait
l'essentiel du travail côté navigateur.

**Correction.** Déclarer une `proxy_cache_path` et référencer la zone, ou
retirer la ligne pour ne pas laisser croire à un cache qui n'existe pas.

---

<a id="bug-31"></a>
## 🔵 BUG-31 — Un artefact de compilation versionné **[CONFIRMÉ]**

**Fichier :** `tsconfig.tsbuildinfo` — 236 Ko, suivi par git

Le cache incrémental de TypeScript est dans le dépôt. Il change à chaque
compilation, produit un conflit à chaque fusion, et n'a aucune valeur pour
un autre poste. `.gitignore` couvre `.next`, `node_modules` et les rapports
Playwright, mais pas celui-ci.

**Correction.** `git rm --cached tsconfig.tsbuildinfo` et l'ajouter à
`.gitignore`.

---

<a id="bug-32"></a>
## 🟠 BUG-32 — Un agent supprime définitivement par l'écran d'édition ce que l'API lui refuse **[CONFIRMÉ]** ✅ **CORRIGÉ**

**Fichiers :**
`app/agency/properties/[id]/edit/page.tsx:138-155` et `:479` ·
`app/agency/visits/[id]/edit/page.tsx:116-133` et `:351` ·
`app/agency/payments/[id]/edit/page.tsx:131-148` et `:395` ·
`app/agency/rental-management/[id]/edit/page.tsx:101-118` et `:274` ·
`app/agency/interactions/actions.ts:68-86`

> Établi par lecture des 31 Server Actions le 12 août 2026, **non reproduit
> sur l'instance en fonctionnement** — il n'a donc pas le badge
> **[CONFIRMÉ]** des autres. Le chemin est complet et vérifié ligne à
> ligne : garde, rendu du bouton, absence de contrôle de rôle.

Le produit énonce sa règle, et la tient partout où on l'a cherchée. Les
huit routes `POST /api/*/[id]/delete` vérifient `isAgencyAdmin(...)` et
répondent 403 à un agent. Les listes cachent le bouton aux agents. Le
commentaire de `app/agency/properties/page.tsx:215` dit même pourquoi les
deux sont nécessaires :

```
/* La suppression est reservee a l'administrateur.
   L'API le verifie aussi : cacher le bouton
   ne suffit jamais a proteger une action. */
```

**Le lien « modifier », lui, n'est pas restreint** — il ne doit pas
l'être, un agent gère le quotidien. Et au bas de quatre écrans
d'édition se trouve un bouton « Supprimer », branché sur une Server
Action qui n'appelle que `requireAgency()`.

### Le tableau des deux chemins

| Ressource | Route API | Action de l'écran d'édition |
|---|---|---|
| Bien | `isAgencyAdmin` ✅ · corbeille · journal | **aucun rôle** ❌ · `delete()` **définitif** · aucun journal |
| Visite | `isAgencyAdmin` ✅ · journal | **aucun rôle** ❌ · aucun journal |
| Paiement | `isAgencyAdmin` ✅ · journal | **aucun rôle** ❌ · aucun journal |
| Gestion locative | *aucune route* | **aucun rôle** ❌ · aucun journal |
| Interaction | *aucune route* | **aucun rôle** ❌ · aucun journal |

Le cloisonnement inter-agences, lui, **tient sur les cinq** : chacune fait
son `findFirst({ id, agencyId })` avant d'écrire. Ce n'est pas une fuite
entre agences. C'est la séparation des rôles, et elle seule, qui est
absente.

### Ce qui rend le cas du bien beaucoup plus lourd que les quatre autres

`Property` est un modèle à **suppression réversible** — c'est tout l'objet
de l'extension Prisma de `lib/prisma.ts` et de l'écran Corbeille. La route
API pose donc `deletedAt` et la ligne reste restaurable. L'action de
l'écran d'édition appelle `prisma.property.delete()` : **la ligne part
pour de bon**, et les cascades du schéma partent avec elle.

```
Property (delete)
├── PropertyImage        onDelete: Cascade   → les photos
├── Visit                onDelete: Cascade   → l'historique des visites
├── Sale                 onDelete: Cascade   → les ventes
├── Rental               onDelete: Cascade   → les baux
│   └── RentalManagement onDelete: Cascade   → les échéanciers de loyers
└── Payment              onDelete: SetNull   → les paiements sont délestés
```

Un agent qui clique détruit l'historique locatif complet d'un bien :
quittances, échéances, baux. Rien en corbeille — l'écran Corbeille ne
montre que ce qui porte un `deletedAt`, et il n'y en a plus. Rien dans
`AuditLog` — les cinq actions n'appellent pas `recordAudit()`, alors que
leurs huit homologues d'API le font toutes.

**Et l'épopée 0 n'est pas commencée.** Il n'existe aujourd'hui aucune
sauvegarde d'où récupérer ces lignes. C'est la conjonction qui compte :
prise seule, la lacune de rôle est une permission trop large ; combinée à
l'absence de corbeille, de journal et de sauvegarde, elle est le chemin le
plus court vers une perte de données irréversible chez un client.

### Pourquoi la story 4.3 ne l'a pas vu

Elle a fait exactement ce qu'elle annonçait, et bien : `tests/roles.spec.ts`
éprouve **les huit routes de suppression** et **les cinq écrans réservés**.
Les Server Actions des écrans d'édition ne sont ni l'un ni l'autre — elles
ne sont pas des routes, et leurs écrans ne sont pas réservés. La règle
était testée sur le chemin qui l'applique, jamais sur celui qui l'ignore.

Même remarque pour les deux audits du 9 août : ils ont lu intégralement
`lib/` et `app/api/`, et les Server Actions « en revue ». C'est là que
tient l'angle mort — et il est structurel, pas accidentel : **une garde
absente ne se cherche pas dans le fichier qui la contient, mais dans
l'inventaire de ceux qui devraient l'avoir.**

### Correction — et l'arbitrage qu'elle demande

Trois des cinq ne demandent aucune décision : bien, visite et paiement ont
un homologue d'API réservé à l'administrateur, la règle est déjà tranchée,
il faut l'appliquer des deux côtés (`requireAgencyAdmin()`), journaliser,
et **rendre au bien sa suppression réversible** — l'écran d'édition doit
mettre à la corbeille comme la route, pas détruire.

Les deux autres demandent un arbitrage, parce qu'aucun homologue ne dit ce
qu'il faut faire :

- **la fiche de gestion locative** — une échéance de loyer. La supprimer
  fausse un compte. Ma recommandation : administrateur ;
- **l'interaction** — une ligne d'historique d'un contact, souvent créée
  par l'agent lui-même à l'instant. La réserver à l'administrateur rendrait
  une faute de frappe ineffaçable pour celui qui l'a commise. Ma
  recommandation : la laisser à l'agent, mais la journaliser — et l'écrire,
  pour que ce soit une décision et non un oubli.

**Ne pas se contenter de cacher les boutons.** Le commentaire cité plus
haut a raison : une Server Action est un point d'entrée `POST`, joignable
sans l'écran qui la rend.

### Ce qui a été fait — story 4.6, 12 août 2026

**Confirmé sur l'instance avant correction.** Le défaut avait été établi
par lecture ; il a été reproduit en rejouant la Server Action avec la
session d'un `agent` : `303`, « Bien supprimé », la ligne effacée — **et la
visite partie avec, en cascade**. Ce n'était donc pas une lecture pessimiste
du code.

Les quatre suppressions réservées passent par `requireAgencyAdmin()`, la
cinquième reste ouverte à l'agent **pour les lignes qu'il a lui-même
saisies** — décision écrite, contrôle d'`authorId` posé en revue après que
celle-ci eut relevé que le code appliquait une portée plus large que sa
justification — et les cinq journalisent via `recordAudit()` en reprenant les libellés de leurs
homologues d'API. Le bien est **mis à la corbeille** au lieu d'être
détruit : ses photos, visites, ventes, baux et échéanciers restent en base,
et il se restaure depuis `/agency/trash` — les six sont vérifiés en base par
le test, restauration **effectivement soumise** et `deletedAt` relu. Les quatre boutons ne sont plus
rendus qu'à qui peut les actionner — jamais comme mesure, seulement comme
seconde.

**Prouvé par rejeu, et non par clic.** Après le masquage, un test qui
cliquerait ne prouverait plus que le masquage. Le test relève le formulaire
de Server Action dans la session de l'administrateur — identifiant d'action
lu à l'exécution, jamais codé en dur (BUG-28) — puis le rejoue dans celle
de l'agent, et **relit la ligne en base**. Les cinq gardes ont été mutés un
par un : les cinq font rougir la suite, imports compris pour que la mutation
compile réellement.

L'inventaire des Server Actions destructives et de leur garde est désormais
dans `docs/architecture.md` §4 : l'angle mort étant structurel, le remède
l'est aussi.

---

<a id="bug-33"></a>
## 🟠 BUG-33 — Désactiver un compte ne lui retire aucun accès : les gardes ne relisent jamais l'utilisateur **[CONFIRMÉ]** ✅ **CORRIGÉ**

**Fichiers :**
`lib/auth-guard.ts:25-31` (`requireAgency`) ·
`lib/auth-guard.ts:57` (`requireSuperAdmin`) ·
`lib/auth-guard.ts:117-123` (`getApiAgency`) ·
`auth.config.ts:16-18` (session JWT sans `maxAge`) ·
`app/agency/users/page.tsx:128` · `app/admin/users/page.tsx:132`

> **Reproduit sur l'application en fonctionnement le 12 août 2026**, au
> cours de la story 1.8. Il avait d'abord été établi par lecture des trois
> gardes, sans badge **[CONFIRMÉ]** ; le test écrit avant la correction —
> phase rouge — l'a prouvé sur la pile réelle, et de la pire façon :
>
> ```
> navigated to "/agency/owners?success=Proprietaire%20cree"
> ```
>
> Un compte **désactivé pendant sa session** a créé un propriétaire en
> base. Ce n'était donc pas seulement une lecture qui restait ouverte :
> l'écriture aussi.

Les gardes revérifient **l'agence** à chaque requête, et le commentaire de
`requireAgency()` explique très bien pourquoi :

```
Le controle du statut est refait ici et pas seulement a la connexion :
si un super admin suspend une agence pendant qu'un agent est connecte,
l'agent perd l'acces a la requete suivante sans avoir a se reconnecter.
```

Ce raisonnement est juste. Il n'a simplement **jamais été appliqué à
l'utilisateur lui-même.** `role`, `agencyId` et l'existence même du compte
sont lus dans le jeton signé ; `isActive` n'est vérifié **qu'une seule
fois dans tout le produit**, à l'instant de la connexion (`auth.ts:88`).

| Donnée | Source à chaque requête | Relue en base ? |
|---|---|:---:|
| Statut de l'agence | `agency.findUnique` | ✅ |
| `isActive` du compte | jeton (jamais lu) | ❌ |
| `role` du compte | jeton | ❌ |
| `agencyId` du compte | jeton | ❌ |
| Existence du compte | jeton | ❌ |

`requireSuperAdmin()` n'interroge pas la base **du tout** : la console de
l'éditeur s'ouvre sur la seule foi du jeton.

Aucun `maxAge` n'est posé dans `auth.config.ts` : la durée est celle par
défaut de NextAuth, **trente jours**.

### Ce que cela casse, concrètement

1. **Le bouton « Désactiver » de `/agency/users` ne ferme rien.** Le
   commentaire d'en-tête de cet écran annonce : « c'est lui qui ouvre et
   **ferme** les accès de ses collaborateurs ». Un compte désactivé garde
   la totalité de ses droits jusqu'à expiration de son jeton — jusqu'à
   trente jours. L'écran affiche « Compte désactivé », le journal d'audit
   écrit `desactivation_compte`, et rien n'a changé pour l'intéressé.
2. **Le remède écrit dans le code est faux.** `app/admin/users/page.tsx:132`
   dit, à propos de la réinitialisation d'un mot de passe : « Les sessions
   ouvertes ne sont pas révoquées […] Un compte compromis doit donc être
   **désactivé**, pas seulement voir son mot de passe changé. » Le constat
   est exact, la conclusion ne tient pas : désactiver ne révoque pas
   davantage. **Il n'existe aujourd'hui aucun moyen de couper l'accès d'un
   compte compromis**, ni dans l'application, ni pour l'éditeur. Le seul
   levier réel est de suspendre l'agence entière — c'est-à-dire de fermer
   l'accès de tous pour en fermer un.
3. **Une rétrogradation ne prend pas effet.** `agency_admin → agent`
   (`app/agency/users/page.tsx:216`) modifie la base ; le jeton continue
   d'annoncer `agency_admin`. L'inverse aussi : un agent promu doit se
   reconnecter, sans que rien ne le lui dise.
4. **Cela mine la story 4.6 avant qu'elle soit écrite.** Elle va poser
   `requireAgencyAdmin()` sur cinq suppressions destructives. Cette garde
   compare `context.userRole` — une valeur du jeton. Poser cinq serrures
   sur une clé qui peut avoir un mois de retard, c'est le motif même de ce
   défaut, reproduit cinq fois de plus.

### Pourquoi Haute, et pas Critique

Aucun tiers sans compte n'entre par là : il faut avoir été légitime à un
instant donné. C'est ce qui le distingue de BUG-19 et BUG-20, classés
critiques parce qu'un inconnu en tire parti seul.

Mais c'est la seule circonstance atténuante, et elle est mince. Le jour où
un compte fuit, où un salarié part fâché, où un poste est volé, **le
produit n'a aucune réponse** : ni révocation, ni expiration courte, ni
même un délai qu'on pourrait annoncer au client. Un défaut sans remède au
moment où il compte vaut mieux qu'un défaut ouvert à tous, pas beaucoup
mieux.

### Pourquoi les trois passes précédentes ne l'ont pas vu

Elles cherchaient des gardes **absentes**. Ici les gardes sont présentes,
appelées partout, et correctes sur ce qu'elles vérifient — le
cloisonnement inter-agences tient, sans exception. Ce qui manque n'est pas
un appel, c'est une **relecture** : la question « qui garde cette
ressource ? » a toujours reçu une bonne réponse, et la question « depuis
quand cette réponse est-elle vraie ? » n'avait jamais été posée.

Deux angles morts en deux jours, tous deux du même genre : ce qui échappe
à une revue par fichier, c'est ce dont aucun fichier n'est responsable.

### Correction — et ce que je tranche

**Niveau 1, story 1.8 — les gardes relisent l'utilisateur.** Les trois
gardes remplacent leur `agency.findUnique` par un
`user.findUnique({ where: { id }, select: { …, agency: true } })` :
`isActive`, `role` et `agencyId` viennent alors de la base, et l'agence est
obtenue par le même appel.

**Coût — corrigé après mesure.** La première rédaction annonçait « zéro
requête supplémentaire » pour `requireAgency` et `getApiAgency`, qui
faisaient déjà un appel Prisma. C'est **faux** : Prisma éclate une relation
to-one en **deux instructions SQL** (`relationLoadStrategy` par défaut). Le
coût réel est donc **un aller-retour SQL de plus par requête** sur tous les
chemins de l'espace agence, et une requête entière pour `requireSuperAdmin`,
qui n'en faisait aucune — c'est la console de l'éditeur, son trafic est
négligeable. Le prix reste très inférieur au défaut qu'il ferme, mais il
n'est pas nul, et l'affirmation avait circulé dans quatre documents.

**Le middleware n'autorise plus rien** *(revue de la story 1.8)*. Il devait
« aiguiller sans autoriser » ; il rendait en réalité des décisions de refus
— `403` JSON, redirections entre les deux espaces — sur le rôle lu dans le
**jeton**. Tant que les gardes lisaient la même valeur, personne ne pouvait
le voir. En faisant lire la base aux gardes, cette story a mis les deux
couches en désaccord et **ouvert une boucle de redirection** : un super
admin rétrogradé était renvoyé de `/admin` vers `/agency` par sa garde, puis
de `/agency` vers `/admin` par le middleware — `ERR_TOO_MANY_REDIRECTS` sur
les deux espaces, un compte non pas rétrogradé mais **enfermé**. Deux
couches qui autorisent sur deux sources ne se mettent pas d'accord : on en
retire une. Le contrôle de rôle a donc quitté le middleware, qui
authentifie et rien de plus ; l'aiguillage entre les deux espaces vit
désormais dans les gardes, qui lisent la même colonne.

**Le cache de routeur donnait trente secondes de sursis** *(revue de la
story 1.8)*. Next 14.2 ressert un segment dynamique déjà visité depuis le
cache du navigateur, **sans requête au serveur** : aucune garde ne
s'exécute. La propriété tenue était « à la requête suivante », pas « à la
navigation suivante ». Fermé par `experimental.staleTimes.dynamic = 0`.

**Durée de session : trente jours → douze heures.** Trente jours n'est pas
une session, c'est un identifiant permanent stocké dans un navigateur. Douze
heures couvrent une journée de travail d'agence, du matin au soir, et une
reconnexion quotidienne est le prix normal d'un outil qui détient des
pièces d'identité. C'est un arbitrage produit, rendu par délégation, et il
tient en une ligne de `auth.config.ts` : réversible.

**Niveau 2, story 5.8 — hors de cette story, et tracé.** Un jeton volé
reste utilisable même après changement de mot de passe, tant que le compte
n'est pas désactivé. Le fermer demande une colonne (`sessionsValidAfter`),
une migration, et un contrôle de l'horodatage du jeton dans les gardes.
C'est un chantier distinct : le niveau 1 rend vraie la promesse que le
produit affiche **déjà** (« désactiver ferme l'accès ») sans toucher au
schéma ; le niveau 2 ajoute une garantie que le produit ne promet nulle
part. Les séparer permet de livrer le premier aujourd'hui et de faire
relire la migration du second pour elle-même.

### ✅ Corrigé — story 1.8, 12-08-2026

Les trois gardes de `lib/auth-guard.ts` relisent le compte en base à chaque
requête. **La seule valeur encore consommée du jeton est
`session.user.id`** : le rôle, l'agence et `isActive` viennent de la base.

- `requireAgency` : `user.findUnique({ include: { agency: true } })` —
  **une** requête là où il y en avait une, le compte et son agence
  ensemble. Coût de la correction sur les chemins chauds : nul.
- `getApiAgency` : même requête en `select` étroit. Un compte désactivé
  reçoit `401 Non authentifié` — même code, même message qu'une absence de
  session : une réponse d'API est lue par du code, pas par un humain.
- `requireSuperAdmin` : gagne la seule requête ajoutée par la story. Elle
  n'en faisait aucune — c'était le seul chemin où le compte n'était vérifié
  à **aucun** moment après la connexion.
- Un compte désactivé part sur `/auth/login?error=…`, où le motif s'affiche.
  S'il retente sa chance, `explainLoginFailure()` le lui redit après avoir
  revalidé son mot de passe. Pas de boucle : la page de connexion ne
  redirige pas un porteur de cookie.
- `requireAgencyAdmin` et `isAgencyAdmin` n'ont **pas été touchés**, et
  c'est le meilleur rendement de la story : la première lit
  `context.userRole`, devenu authentique ; la seconde le reçoit de son
  appelant. **Les huit routes d'API de suppression héritent donc de la
  correction sans une ligne de code.**
- `auth.config.ts` : `maxAge` explicite de **12 heures**, contre trente
  jours par défaut.

**Le comportement du délai a été mesuré, pas déduit.** `maxAge` abaissé à
60 s le temps d'une mesure : 90 s de navigation continue ne coupent pas la
session (le jeton est ré-signé à chaque lecture, `updateAge` n'étant pas
consulté sur la branche JWT), 75 s d'inactivité la coupent. C'est donc un
délai d'inactivité glissant — une journée de saisie n'est pas interrompue en
son milieu.

**Couverture :** 3 tests dans `tests/roles.spec.ts`, chacun doublé de son
contrôle positif. Audit par mutation : la phase rouge a servi de mutation
pour `isActive` (les trois tests échouaient), et une mutation dédiée qui
compile — `userRole: session.user.role` — a fait rougir le seul test de
rétrogradation, prouvant que c'est bien lui qui couvre le rôle. Suite
complète : **96 cas, tous verts**.

**Reste ouvert :** le jeton volé sur un compte laissé actif — story 5.8.

---

## Défauts de déploiement — déjà corrigés

Trouvés et traités lors de la mise en conteneur du 9 août 2026. Inscrits
ici pour mémoire, car aucun n'était visible en développement.

| Défaut | Cause | État |
|--------|-------|:---:|
| Prisma refusait de démarrer | `openssl` absent de l'image Alpine | ✅ |
| Connexion impossible derrière nginx | `AUTH_TRUST_HOST` non posé → `UntrustedHost` | ✅ |
| Photos téléversées en 404 | Next autonome inventorie `public/` au démarrage seulement | ✅ |
| Sitemap figé sur l'URL de build, sans vitrine | page prérendue pendant `next build` | ✅ |
| Conteneur de développement injoignable | `npm run dev` écoute 3002, compose publiait 3000 | ✅ |

---

## Ordre d'attaque

> **Cette section n'est plus la source de vérité.** Elle a été écrite quand
> le registre comptait 18 défauts et que les stories manuscrites de
> [`../stories/`](../stories/) faisaient office de plan. Depuis, les
> 31 défauts ont été découpés en **6 épopées et 34 stories** dans
> [`../epics.md`](../epics.md), et l'avancement est suivi dans
> [`../stories/sprint-status.yaml`](../stories/sprint-status.yaml).
> L'ordre ci-dessous est conservé pour mémoire ; **c'est `epics.md` qui
> commande**, et il place avant tout une épopée 0 (sauvegardes) que ce
> registre ne connaissait pas.

**Lot 1 — avant toute ouverture au public.** BUG-01 (avec la migration de
normalisation), BUG-02, BUG-03, BUG-04, plus BUG-19 à BUG-21 et BUG-23
issus de la seconde passe. Ce sont les défauts dont un tiers peut tirer
parti, ou qui enferment un client dehors.

**Lot 2 — avant la mise en ligne sur un VPS.** ~~BUG-22~~ (fait), BUG-26, BUG-27,
BUG-09. La pile telle qu'elle est aujourd'hui ne doit pas être exposée.

**Lot 3 — avant la montée en charge.** BUG-05, BUG-06, BUG-07, BUG-08,
BUG-11, BUG-24, BUG-25, BUG-29. Correctness et tenue à la charge.

**Lot 4 — filet de régression.** BUG-28, avant les lots suivants : sans
lui, chaque correctif est posé à l'aveugle.

**Lot 5 — dette.** BUG-10 (arbitrage produit), BUG-12 à BUG-18, BUG-30,
BUG-31.

---

<a id="bug-34"></a>
## 🟠 BUG-34 — Un parent mis à la corbeille fait changer d'objet ses enfants au prochain enregistrement **[CONFIRMÉ]** ✅ **CORRIGÉ**

**Relevé le 12 août 2026**, par la revue de code de la story 4.6, et
**reproduit sur l'instance le jour même**.

### Ce qui se passe

Un bien est mis à la corbeille. Ses visites, ses ventes, ses baux et ses
paiements restent en base — c'est tout l'intérêt de la corbeille, et c'est
ce que la story 4.6 a rétabli. Un agent ouvre alors l'une de ces visites
pour en corriger l'heure, et clique sur **Enregistrer**.

La visite change de bien. Silencieusement.

```
avant   visite → bien A  (bien A mis à la corbeille)
après   visite → bien B  (un bien sans aucun rapport)
```

### Pourquoi

L'écran d'édition bâtit sa liste déroulante avec le client Prisma étendu,
qui **masque les lignes portant un `deletedAt`** :

```ts
prisma.property.findMany({ where: { agencyId } })   // le bien A n'y est plus
```

mais il pose `defaultValue={visit.propertyId}`, qui **désigne le bien A**.
Aucune `<option>` ne correspond : le navigateur applique alors la règle du
HTML et sélectionne **la première option de la liste**. Le formulaire part
avec cette valeur, et le contrôle d'appartenance de la Server Action la
laisse passer sans broncher — ce bien-là appartient bien à l'agence.

Le cloisonnement tient. La validation tient. C'est le **lien métier** qui
est réécrit, et rien ne le signale ni à l'agent ni au journal.

### Confirmé, et comment

Décor jetable : une agence, deux biens, une visite sur le premier.
Le premier bien est mis à la corbeille, puis un compte `agent` ouvre
`/agency/visits/<id>/edit` et clique « Enregistrer » **sans rien modifier**.

```
bien de la visite      cmsq4p1sq…uxs   (mis à la corbeille)
autre bien             cmsq4p1tc…woa
option sélectionnée    cmsq4p1tc…woa   ← retombée sur la première
propertyId après       cmsq4p1tc…woa   ← la visite a changé de bien
```

### Portée

Cinq écrans d'édition portent une liste déroulante alimentée par un modèle
à suppression réversible (`Property`, `Client`, `Owner`) :

| Écran | Champs exposés |
|---|---|
| `visits/[id]/edit` | `propertyId`, `clientId` |
| `sales/[id]/edit` | `propertyId`, `clientId` |
| `rentals/[id]/edit` | `propertyId`, `clientId` |
| `payments/[id]/edit` | `propertyId`, `clientId`, `ownerId` |
| `properties/[id]/edit` | `ownerId` |

Les écrans de **création** ne sont pas concernés : sans `defaultValue`, il
n'y a rien à faire retomber.

### Antériorité, et ce qui a changé

Le défaut est **antérieur** : `POST /api/properties/[id]/delete` mettait
déjà à la corbeille, donc l'état « enfant dont le parent est masqué » était
déjà atteignable. Ce qui change avec la story 4.6, c'est qu'il l'est
désormais **depuis l'interface**, par le geste normal d'un administrateur,
et que la 4.6 a précisément supprimé la cascade qui faisait disparaître les
enfants avec le parent. Elle a eu raison de le faire — la cascade était une
destruction définitive. Mais elle a rendu fréquent un état que rien ne
traite.

### Ce qu'il faudra trancher

Trois issues, et elles ne se valent pas :

1. **Conserver le parent en corbeille dans la liste**, en option désactivée
   et étiquetée (« Bien A — en corbeille »). L'agent voit ce qui est, le
   formulaire repart avec la bonne valeur, rien ne bascule.
2. **Refuser l'enregistrement** tant que le parent est en corbeille, avec
   un message qui dit quoi faire (le restaurer, ou choisir un autre bien).
3. **Empêcher la mise à la corbeille** d'un parent qui a des enfants
   vivants — le plus strict, et probablement trop : c'est justement pour
   garder l'historique qu'on ne détruit plus.

La 1 a ma préférence : elle est la seule qui ne perde ni l'information ni
le geste. Mais c'est un arbitrage produit, pas un choix technique.

### Ce qui n'existe pas et devrait

Aucun test ne couvre « ouvrir puis enregistrer sans rien changer ». C'est
pourtant le geste le plus courant d'un utilisateur qui corrige un détail,
et c'est celui qui corrompt ici. La non-régression de ce défaut doit
l'éprouver sur les cinq écrans.

### Ce qui a été fait — story 3.9, 12 août 2026

**Le parent en corbeille reste dans la liste, suffixé « — en corbeille ».**
Arbitrage retenu parmi trois : refuser l'enregistrement bloquerait un agent
sur une fiche qu'il ne peut pas débloquer lui-même — la corbeille est
réservée à l'administrateur — et empêcher la mise à la corbeille d'un parent
ayant des enfants vivants annulerait à moitié ce que la story 4.6 a gagné.

Les **dix couples écran → champ** passent par `optionsParent()`
(`lib/corbeille.ts`), alimenté par une requête qui mentionne `deletedAt` à
son premier niveau — c'est ce qui fait que l'extension de `lib/prisma.ts`
n'y injecte pas son filtre.

> **Mis à jour le 17-08-2026 par la story 3.10.** Ce paragraphe décrivait
> *deux* requêtes — les vivants, puis l'archivé relu à part. Il n'y en a
> plus qu'une, `vivantsEtCourant()`, et le `OR` écarté ici comme « illisible »
> y est employé : ce n'est pas une ruse tant que la clef `deletedAt` reste
> nommée au premier niveau. C'est ce qui a fermé `REP-03`, `06` et `07`
> d'un seul geste.

L'option n'est **pas** `disabled` : l'invariant à tenir est « enregistrer
sans rien changer ne change rien », et il ne doit dépendre d'aucune
subtilité de soumission d'une option désactivée selon le navigateur.

**Sept mutations rougissent** — cinq sur les écrans, plus le suffixe et la
règle du lien inchangé, ajoutées après revue. Elles ont corrigé une
hypothèse au passage : on pouvait croire `sales` et `rentals` épargnés, leur `Select`
de Radix conservant sa valeur en état JavaScript. Faux. Son `<select>` caché
retombe exactement comme un natif. La mesure a tranché ce que la lecture
supposait.

Le test éprouve le geste réel — **ouvrir une fiche et cliquer
« Enregistrer » sans rien modifier** — sur les cinq écrans.

### Ce que la revue a rattrapé, et qui rendait le correctif pire que le défaut

**La première version bloquait l'enregistrement.** Rendre le parent dans la
liste ne suffisait pas : les Server Actions revérifient le lien reçu avec
`findFirst({ where: { id, agencyId } })`, un `where` qui ne nomme pas
`deletedAt` — l'extension y injecte donc son filtre, le parent en corbeille
est introuvable, et l'action répond `error=Bien ou client introuvable`. Les
cinq écrans devenaient impossibles à enregistrer : **l'issue que la story
avait explicitement écartée, livrée sans même le message qui l'expliquerait.**
Le geste que la story existe pour sauver — corriger une heure — ne
fonctionnait pas non plus.

**Et le test ne pouvait pas le voir** : un enregistrement *refusé* laisse le
lien inchangé, exactement comme un enregistrement réussi. C'est la deuxième
fois en deux stories qu'une preuve ne distingue pas le succès de l'échec.

La règle posée est la plus étroite qui répare : **un identifiant inchangé
n'est pas revérifié** — il l'a été quand il a été écrit, et l'agence d'une
ligne ne change pas. Un identifiant *différent* reste vérifié normalement,
donc on ne peut pas rattacher un enfant à un parent en corbeille qui
n'était pas déjà le sien.

Le test asserte désormais que l'URL ne porte pas d'`error=`, que le suffixe
« en corbeille » est bien rendu — sans quoi vider le suffixe laissait
tout vert, et l'option n'étant pas `disabled`, le libellé est le seul signal
— et qu'une **correction volontaire est réellement enregistrée**. Le
dixième couple (`payments → ownerId`), que le décor laissait vide, est
maintenant exercé.

### Ce qui reste : les lignes déjà réécrites

Le correctif empêche les réécritures futures. Il ne répare pas celles qui
ont déjà eu lieu — et le défaut ayant été **reproduit sur l'instance**, il
faut supposer qu'il a pu frapper.

`docs/qa/detection-bug-34.sql` est la requête à passer sur la base de
production, en lecture seule. Elle ne cherche pas une trace — il n'y en a
pas, les mises à jour n'étant pas journalisées — mais les **redondances du
schéma** : un paiement rattaché à un bail doit porter le bien et le client
de ce bail.

**Éprouvée sur une victime fabriquée** le 12 août 2026 : elle la trouve.
Sur la base de développement elle renvoie zéro partout, mais cette base ne
contient aucune ligne en corbeille — le zéro y dit « pas de terrain », pas
« pas de victimes ».

**Une visite réécrite reste indétectable.** `visits` ne porte que
`property_id` et `client_id`, sans colonne redondante pour les recouper. Si
une visite a changé de bien, rien dans la base ne le dit. C'est une limite
du schéma, et elle est assumée écrite plutôt que masquée.

**Ce qui n'est pas décidé, et qui vous revient :** que faire des lignes que
la requête remonterait. Les corriger d'office suppose de savoir quelle
valeur était la bonne — ce que seule l'agence sait. La suite raisonnable est
de leur présenter la liste, pas de trancher à leur place.

---

<a id="bug-35"></a>
## 🟠 BUG-35 — La console éditeur ne pouvait pas se déconnecter **[ÉTABLI PAR LECTURE]** ✅ **CORRIGÉ**

> **Pourquoi pas `[CONFIRMÉ]`.** Dans ce registre, ce marqueur veut dire
> « reproduit sur l'application en fonctionnement » (en-tête du fichier), et
> l'instance n'a pas été démarrée pour celui-ci. Le défaut n'en est pas
> moins certain : l'absence de gestionnaire sur un bouton est un fait
> statique, que la lecture établit mieux qu'un clic. Et **l'éditeur, lui, l'a
> bien rencontré en usage** — c'est de là que vient le signalement. Le
> marqueur dit comment on le sait, pas à quel point on en est sûr.

**Fichier :** `components/layout/AdminNavbar.tsx`

Relevé le 14 août 2026, sur signalement de l'éditeur — « certains éléments
de la barre du haut ne sont pas reliés à leurs vraies pages ». Vérifié dans
le code : **cinq commandes de la barre n'avaient aucune action.**

| Commande | État | Page cible |
|---|---|---|
| « Déconnexion » (bureau) | aucun `onClick` | — |
| « Déconnexion » (mobile) | aucun `onClick` | — |
| « Paramètres » (menu) | aucun lien | `/admin/settings` — **existait, et était déjà reliée par ailleurs** |
| « Profil » | aucun lien | **n'a jamais existé** |
| Cloche de notifications | aucun `onClick` | **n'a jamais existé** |

> **Nuance apportée par la revue sur la ligne « Paramètres ».** Le tableau
> est exact — l'entrée du menu déroulant n'avait bien aucun lien — mais la
> première rédaction en tirait que la page « n'était reliée par rien ».
> Faux : `navLinks` (ligne 35 à `HEAD`) porte
> `{ href: "/admin/settings", … }` et la rend **dans la barre de bureau et
> dans le menu mobile**. Des cinq commandes mortes, celle-ci est la seule
> qui n'ait jamais empêché personne d'atteindre sa page.

Le fichier **n'importait même pas `signOut`** — `grep -n "next-auth"
components/layout/AdminNavbar.tsx` ne renvoyait rien.

**Les deux barres sont nées inertes, et c'est la revue qui l'a établi.** La
première rédaction de cette entrée affirmait qu'`AgencyNavbar.tsx` « le
faisait correctement depuis l'origine » et parlait de deux barres qui
avaient « divergé ». C'était faux, et l'histoire git le dit en une
commande : `git show a529f61:components/layout/AgencyNavbar.tsx | grep -c
signOut` → **0**, pour deux libellés « Déconnexion ». Au commit qui les
crée (`a529f61`, 25-05-2026), les deux barres ont exactement le même
défaut. `signOut` n'apparaît dans celle de l'agence que le **09-08-2026**
(`1bbbb12`), sans story ni trace. Il n'y a donc pas eu de divergence :
**une barre a été réparée en silence, l'autre est restée telle quelle
pendant trois mois de plus.** Le motif publié comptait plus que la
conclusion, parce que c'est lui qui sert à rouvrir la question.

**Le plus grave est la déconnexion.** Un éditeur ne pouvait pas fermer sa
session **depuis son interface**. Depuis la story 1.8 cette session dure
douze heures ; sur un poste partagé, elle restait donc ouverte sur **le
compte le plus puissant du produit**. Le recours existait — `auth.config.ts`
ne surcharge que `signIn` et `error`, donc la page `/api/auth/signout` de
NextAuth reste servie, et `middleware.ts` laisse passer `/api/auth/` — mais
c'est une URL que rien n'affiche et qu'aucun éditeur ne devine. *La
première rédaction écrivait « le seul recours était d'effacer les
cookies » : la revue l'a démenti. Le défaut est une impasse d'interface,
pas une impasse technique.* Ce n'est pas exploitable à distance — c'est
pourquoi le défaut est classé 🟠 et non 🔴 — mais c'est un accès privilégié
qui survit à son utilisateur.

**La cloche mentait en plus de ne rien faire** : elle portait une pastille
rouge permanente, c'est-à-dire l'annonce de messages non lus, dans un
produit qui n'a aucune notification.

**Correction (story 5.12).** `signOut` importé et câblé sur les deux
boutons ; « Paramètres » relié à `/admin/settings`. « Profil » et la cloche
**retirés plutôt que branchés** : ils n'ouvrent sur rien, et rien n'existe
pour eux. Les rétablir suppose d'écrire d'abord la page ou la
fonctionnalité — c'est un PRD, pas une icône à reconnecter.

`tests/navigation.spec.ts` est **écrit** pour le couvrir, contrôle positif
compris : sans ce dernier, un cas qui vérifie que `/admin` est devenu
inaccessible serait tout aussi vert sur une console cassée pour tout le
monde.

**Mesuré le 14-08-2026**, sur accord explicite de l'éditeur pour démarrer le
projet (`CLAUDE.md` §2) : `npx tsc --noEmit` et `npm run lint` à 0 erreur,
`npm run test:e2e` **116/116 verts**.

**Prouvé par mutation, et les messages ont été lus** (§6) :

| Mutation | Résultat | Message |
|---|---|---|
| `onClick` du « Déconnexion » bureau retiré | 🔴 rouge | `waitForURL` expire — la sortie vers `/auth/login` n'a pas lieu |
| « Profil » réintroduit | 🔴 rouge | `Expected: 0 / Received: 1` |
| *(aucune)* — contrôle positif | 🟢 vert | le rouge vient bien des commandes, pas d'une console cassée |

Les mutations sont **chirurgicales à dessein** : retirer l'import de
`signOut` aurait cassé le lint, donc le build, et le rouge n'aurait plus
désigné le test (§6, piège 3). Seul le bouton bureau a été privé de son
gestionnaire — le bouton mobile garde l'import légitime, et `tsc` comme
`lint` passent **encore sous mutation**.

> **Trouvé en chemin, et versé en `REP-80` (story 4.7) :** `npm run test:e2e`
> ne joue que `chromium`, alors que `playwright.config.ts` déclare cinq
> projets. Ce choix n'est écrit nulle part.

---

<a id="bug-36"></a>
## 🔴 BUG-36 — Derrière nginx, Next abandonne toutes les Server Actions **[CONFIRMÉ]**

**Relevé le 15-08-2026**, par le premier pilotage de navigateur mené contre
la pile `docker-compose.prod.yml` de ce dépôt. **Reproduit, pas déduit.**

### Le symptôme

Sur le déploiement documenté — celui de `CLAUDE.md` §3, nginx sur 8095 —
**aucun bouton qui enregistre n'aboutit.** L'utilisateur obtient
« Une erreur est survenue », et l'onglet Réseau montre un `POST 500`.

### La preuve — une action, deux points d'entrée

`submitLead` est une Server Action posée sur une page **publique** :
aucune session n'intervient, donc rien d'autre que le chemin réseau ne peut
expliquer l'écart.

```
via nginx  :8095 | POST 500 | bandeau: "Une erreur est survenue"
direct     :3000 | POST 303 | bandeau: "Votre message a bien ete envoye. …"
```

### La cause — les journaux la nomment

```
`x-forwarded-host` header with value `localhost` does not match `origin`
header with value `localhost:8095` from a forwarded Server Actions request.
Aborting the action.
Error: Invalid Server Actions request.
```

`nginx/nginx.conf` pose `proxy_set_header Host $host;` sur ses quatre blocs
`location` (lignes 60, 127, 139, 152). **`$host` ne contient pas le port.**
Next 14 dérive `x-forwarded-host` de `Host`, le compare à l'`Origin` du
navigateur — qui, lui, porte `:8095` — et refuse l'action au titre de sa
protection anti-CSRF.

**Confirmé par le contournement** : en posant `x-forwarded-host:
localhost:8095` depuis le client, toutes les écritures repassent — création
d'un propriétaire, activation d'une agence, publication d'une vitrine,
purge de corbeille.

### Ce que cela emporte

**Les 41 Server Actions du produit.** L'espace agence entier, la console de
l'éditeur, la corbeille, les messages reçus, le formulaire public de la
vitrine. Et `explainLoginFailure` : **aucun échec de connexion n'affiche son
motif**, si bien qu'une agence qui vient de s'inscrire n'apprend jamais que
son dossier est en attente d'activation.

Survivent : la navigation, la connexion
(`/api/auth/callback/credentials` est une **route**, pas une action), les
exports CSV, les PDF, et **les suppressions par route API**. Le produit est
donc en lecture seule **sauf pour supprimer** — la pire combinaison.

### Pourquoi aucune passe ne l'avait vu

`playwright.config.ts:68` lance `npm run build && npm start -- -p 3002`.
**La suite sert l'application en direct ; nginx n'est jamais dans le
chemin.** Les 121 cas verts n'ont jamais rien dit de la topologie de
déploiement — et n'en diront rien après le correctif non plus. Ce n'est pas
un oubli de test, c'est un angle mort du harnais : le même couvre les
volumes, les migrations et les variables d'environnement. → **REP-95**.

### Le correctif

`proxy_set_header Host $http_host;` sur les quatre blocs. **Story 5.14.**

`experimental.serverActions.allowedOrigins` a été **écarté** : il figerait
`localhost:8095` dans l'image au moment du build, et casserait tout
déploiement sur un vrai domaine.

### Ce que le correctif rend atteignable — §8

**Rien de nouveau** : `$host` venait déjà de l'en-tête `Host` du client,
seul le port était perdu. Mais la question en découvre un trou voisin,
préexistant et indépendant : nginx n'a qu'un bloc `server`, il est donc
serveur par défaut et **accepte n'importe quel `Host`**. Avec
`AUTH_TRUST_HOST=true` dans le conteneur, un `Host` forgé peut orienter les
URL de rappel NextAuth. → **REP-94**.

> **Mesures complètes** : [`verification-navigateur.md`](verification-navigateur.md) §3.

### ✅ Corrigé le 15-08-2026 — story 5.14

`proxy_set_header Host $http_host;` sur les quatre blocs `location`.
nginx rechargé ; **aucune reconstruction n'était nécessaire**, le fichier
est monté depuis le dépôt.

**Vérifié en navigateur nu**, sans aucun contournement d'en-tête :

| Épreuve | Avant | Après |
|---|---|---|
| Formulaire public de vitrine | `POST 500`, « Une erreur est survenue » | **`POST 303`**, message de succès |
| Connexion d'un compte `pending` | « Une erreur est survenue » | **« Votre agence n'est pas encore activée par Aqar DZ… »** |
| Connexion, mot de passe faux | « Une erreur est survenue » | **« Email ou mot de passe incorrect »** |
| Connexion valide *(contrôle positif)* | aboutit | aboutit |

**Prouvé par mutation** : `$http_host` remis à `$host`, nginx rechargé —
les deux premières lignes repassent au rouge (`POST 500`), **et la
connexion valide continue d'aboutir**. Le rouge désigne donc bien les
Server Actions, et non une pile cassée. Configuration rétablie ensuite.

> ~~**La couverture durable reste à poser (AC 4 de la story 5.14).** Aucun
> test automatique ne passe par nginx aujourd'hui, et l'endroit où poser
> cette preuve est un arbitrage ouvert. **La story reste `in-progress`
> tant qu'il n'est pas tranché** (`CLAUDE.md` §9).~~
>
> **Périmé — corrigé le 16-08-2026 (`CLAUDE.md` §13).** L'arbitrage a été
> rendu le 15-08 et la couverture existe : `tests/deploiement.spec.ts` garde
> les quatre relais par lecture de fichier, et `scripts/verify-deploy.mjs`
> (`npm run verify:deploy`) rejoue une Server Action **à travers nginx**.
> La story 5.14 est `done`. Ce paragraphe affirmait le contraire depuis un
> jour, et c'est le code qui fait foi.
>
> Ce que la couverture ne couvre toujours pas, en revanche, est réel et
> nommé ailleurs : `verify:deploy` **ne s'authentifie jamais**. → **BUG-37**.

---

<a id="bug-37"></a>
## 🔴 BUG-37 — Une base migrée sous une image qui ne l'est pas : plus personne n'entre **[REPRODUIT EN FONCTIONNEMENT]**

**Relevé le 16-08-2026**, non par une lecture ni par un audit : **le produit
est tombé**. L'éditeur a signalé qu'il ne pouvait plus se connecter avec
`agent@aqar.dz`. Le message affiché était « Une erreur est survenue ».

### Le symptôme, et pourquoi il trompe

Ce message n'est **pas** un refus d'authentification. Il vient du `catch` de
`app/auth/login/page.tsx:52`, c'est-à-dire d'une **exception**. Tous les
refus légitimes ont leur phrase propre, rendue par `explainLoginFailure`
(`app/auth/login/actions.ts`) : « Email ou mot de passe incorrect », « Votre
agence n'est pas encore activée… », « Trop de tentatives de connexion… ».

Voir « Une erreur est survenue » **exclut donc** le mot de passe, le compte
désactivé, l'agence suspendue et le compteur de tentatives. Une heure de
diagnostic a d'abord été dépensée sur ces quatre pistes : le message est
faux-ami, et c'est un défaut en soi.

### La cause — les journaux la nomment

```
[auth][error] CallbackRouteError
[auth][cause]: PrismaClientKnownRequestError:
Invalid `prisma.user.findUnique()` invocation:
Error converting field "plan" of expected non-nullable type "String",
found incompatible value of "pro".
```

La migration `20260815000000_agency_plan_enum` a converti `agencies.plan` de
`text` en énumération `AgencyPlan`. Elle **a été appliquée** à la base. Le
conteneur `aqar-frontend-prod`, lui, servait toujours l'image
`aqar-dz:latest` construite le **15-08 à 12:57**, dont le client Prisma
attend un `String`.

`authorize()` (`auth.ts`) lit l'agence à **chaque** connexion — c'est la
règle du dépôt : le rôle et l'agence se relisent en base, jamais dans le
jeton. La désérialisation échoue, l'exception traverse, le `catch` du client
affiche sa phrase générique.

### Ce que cela emporte

**Toutes les connexions, tous les comptes.** Ce n'est pas `agent@aqar.dz` :
`superadmin@aqar.dz` et `admin@aqar.dz` échouaient à l'identique. Les
journaux montrent aussi `prisma.agency.findMany()` en échec — la console de
l'éditeur ne s'affichait pas davantage.

**Le produit était à zéro.** Aucune session ne pouvait s'ouvrir.

### Pourquoi quatre contrôles n'ont rien vu

C'est le fond de ce défaut, et il vaut plus que la panne elle-même.

**1. L'ordonnancement Docker ne garde qu'un sens.**
`docker-compose.prod.yml:171` — `frontend` attend
`migrate: service_completed_successfully`. Cela garantit que l'application
n'est jamais **en avance** sur la base. Cela ne dit rien du cas **inverse**,
qui est celui-ci. Et `package.json:12` — `"db:deploy": "prisma migrate
deploy"` — applique les migrations **depuis l'hôte**, sans consulter ni
redémarrer le conteneur. C'est le chemin réellement emprunté.

**2. La sonde de santé ne peut pas voir ce défaut.**
`app/api/public/health/route.ts:20` exécute `SELECT 1`. Son commentaire
promet qu'« elle vérifie la base, pas seulement le processus » — c'est vrai
au sens du **socket**, et faux au sens de la **donnée** : `SELECT 1` ne
traverse aucune colonne, donc aucune énumération. Le conteneur est resté
**`healthy` pendant que 100 % des connexions échouaient**, et Docker n'avait
pas tort au sens de ce qu'on lui a demandé de mesurer.

**3. `verify:deploy` ne s'authentifie jamais.**

```
grep -nE 'signin|login|credentials|session|Cookie|auth' scripts/verify-deploy.mjs
→ aucune occurrence
```

Il enchaîne santé → vitrine → fiche → rejeu d'une Server Action **publique**.
Le script écrit pour la story 5.14 aurait donc tourné **vert** ce matin-là,
sur un produit où personne ne pouvait entrer.

**4. La suite E2E ne joue pas contre l'image déployée.** REP-95, déjà
connu : `playwright.config.ts` sert l'application en direct sur `:3002`.

> **En une phrase : aucun contrôle de ce dépôt ne lit une ligne `Agency`
> authentifiée contre l'image réellement en service.** C'est l'intersection
> exacte des quatre trous.

### Ce n'est pas un cas isolé

`grep -nE '^enum ' prisma/schema.prisma` → **19 énumérations**. Chaque
migration future qui en touche une, appliquée sans reconstruire, reproduit
ceci à l'identique : produit à zéro, conteneur `healthy`, `verify:deploy`
vert.

Et c'est du `CLAUDE.md` §8 à l'état pur. L'auteur de la migration **avait vu
le risque** — son commentaire le dit : « une seule ligne non convertie
enfermerait l'agence entière, écran par écran ». Il a couvert **une**
direction, avec `ELSE 'starter'` pour les données non converties. Le miroir —
donnée convertie, **client** non converti — n'était gardé par rien.

### Le correctif de circonstance — appliqué

Reconstruction de l'image applicative, par l'éditeur :

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Vérifié : `aqar-dz:latest` reconstruite le 16-08, `aqar-frontend-prod`
`healthy`. ~~**La cause structurelle, elle, reste entière** — rien n'empêche
la même dérive demain.~~ → **story 2.6**.

### La cause structurelle — fermée le 17-08-2026, et en service

La story 2.6 est terminée et **déployée**. Trois gardes, mesurées sur la
pile en service et non déduites :

```
$ curl -s http://localhost:8095/api/public/health
  {"status":"ok","database":"up","schema":"a-jour"}
$ npm run verify:deploy
  5. épreuve d'échec → 302 → /auth/login?error=CredentialsSignin&code=credentials
  sortie = 0
```

1. **La sonde lit une ligne typée** (`groupBy` sur les colonnes
   d'énumération) : la dérive de désérialisation fait passer le conteneur
   `unhealthy` au lieu de le laisser `healthy` sur un produit mort.
2. **La sonde compare les migrations dans les deux sens**
   (`lib/migrations.ts`) : l'écart est vu **dès qu'il existe**, sans attendre
   qu'une ligne l'exerce — une énumération migrée dont aucune ligne ne porte
   encore la valeur neuve passait sous le contrôle précédent.
3. **`verify:deploy` éprouve le chemin authentifié** par une connexion
   volontairement invalide, sans ouvrir de session : `auth.ts:157-159` lit la
   ligne `Agency` **avant** `compare()`, donc un mot de passe faux traverse
   exactement le code qui a cassé.

**Et le faux positif redouté a été écarté par mesure** : sur une base migrée
et vide — vingt tables, zéro ligne — la sonde répond `200` et non `503`
(`scripts/eprouver-base-vierge.sh`, 17-08-2026). Un premier déploiement
avant tout `seed` n'est donc pas déclaré malade.

### Ce que le correctif rend atteignable — §8

Rien, parce qu'il ne corrige rien : il remet l'image au niveau de la base.
La question `CLAUDE.md` §8 se pose à la **story 2.6**, et elle y est écrite —
une sonde plus exigeante peut refuser de démarrer une pile parfaitement
saine, et un `verify:deploy` qui s'authentifie a besoin d'un compte qu'il
n'a pas le droit de saturer.

---

<a id="bug-38"></a>
## 🟡 BUG-38 — Sept gardes trouées par la chaîne de prototypes **[CONFIRMÉ]** ✅ **CORRIGÉ**

**Relevé le 17-08-2026**, par le **balayage exigé par l'AC-3 de la
story 3.2** — pas par une lecture libre. La story venait fermer *un* cast
d'énumération ([BUG-06](#bug-06)) ; son critère d'acceptation demandait de
vérifier qu'il n'en restait aucun **dans le projet entier**. C'est cette
vérification qui a trouvé les six autres.

### Ce qui se passe

Sept écrans acceptaient une valeur venue de l'extérieur — paramètre d'URL
ou champ de formulaire —, la confrontaient à une table d'étiquettes, puis
la castaient vers une énumération Prisma :

```ts
if (query.type && query.type in PROPERTY_TYPE_LABELS) {
  where.type = query.type as never          // app/vitrine/[slug]/page.tsx
}
```

**L'opérateur `in` remonte la chaîne de prototypes.** Une table littérale
`{ nouveau: …, traite: …, archive: … }` répond « oui » à `constructor`,
`toString`, `valueOf`, `__proto__`, `hasOwnProperty` et `isPrototypeOf`.

Mesuré le 17-08-2026, sur la forme réelle de ces tables :

```
PASSE  "nouveau"   PASSE  "traite"      PASSE  "archive"      ← les vrais statuts
refuse "supprime"  refuse ""                                  ← ce que la garde attrapait
PASSE  "constructor"  PASSE  "toString"     PASSE  "valueOf"
PASSE  "__proto__"    PASSE  "hasOwnProperty"  PASSE  "isPrototypeOf"
```

Puis, contre la base de développement :

```
LECTURE  OK     status="nouveau"     -> 34 ligne(s)
LECTURE  REFUSE status="constructor" -> PrismaClientValidationError
LECTURE  REFUSE status="toString"    -> PrismaClientValidationError
LECTURE  REFUSE status="__proto__"   -> PrismaClientValidationError
ECRITURE REFUSE status="constructor" -> PrismaClientValidationError
```

### Ce que ce défaut est, et ce qu'il n'est pas

**Aucune donnée n'a jamais été en danger.** La colonne est une énumération
PostgreSQL : elle refuse de son côté. Ce dépôt avait déjà fait et écrit
cette mesure — le commentaire d'en-tête de `agencyPlanSchema` la porte,
faite par mutation le 16-08-2026, et sa conclusion s'applique ici mot pour
mot.

Ce qui tombe, c'est le **refus lisible** : un `PrismaClientValidationError`
levé dans le rendu d'un Server Component, donc une **page d'erreur
technique** au lieu du message français reçu partout ailleurs. C'est
exactement le symptôme décrit par `BUG-06` — il survivait dans six autres
écrans.

**Le plus exposé n'est pas dans la console.** `/vitrine/{slug}` est public
et non authentifié : `?type=constructor` suffisait, sans compte.

### Les sept sites

| # | Fichier | Chemin | Ce qui entrait |
|---|---|---|---|
| 1 | `app/admin/agencies/page.tsx` | écriture | `status` — c'est `BUG-06`, déjà corrigé |
| 2 | `app/agency/leads/page.tsx` | écriture | `status` d'un message |
| 3 | `app/agency/leads/page.tsx` | lecture | filtre `?status=` |
| 4 | `app/agency/payments/page.tsx` | lecture | filtre `?type=` |
| 5 | `app/agency/payments/page.tsx` | lecture | filtre `?status=` |
| 6 | `app/vitrine/[slug]/page.tsx` | lecture | filtre `?operation=` — **public** |
| 7 | `app/vitrine/[slug]/page.tsx` | lecture | filtre `?type=` — **public** |

### La leçon était déjà écrite ici

`lib/offres.ts:294` dit exactement cela, et utilise
`Object.prototype.hasOwnProperty.call` pour cette raison — depuis
l'épopée 6. Elle n'avait été appliquée qu'à ce fichier-là. **Un
raisonnement juste consigné à un seul endroit ne protège qu'un seul
endroit.**

### Le correctif

- **Écriture** → schéma Zod + `parseForm`. Une valeur inconnue est une
  faute : elle mérite un refus nommé et affiché. `leadStatusSchema` sur
  `z.nativeEnum(LeadStatus)`.
- **Lecture** → `estCleConnue()` (`lib/labels.ts`), et la valeur inconnue
  est **ignorée**, pas refusée : un signet périmé doit poser l'écran, pas
  une page d'erreur. Même arbitrage que `offreDuCatalogue`.
- `label()` durci de la même façon : `label(MAP, "toString")` rendait la
  **fonction** héritée d'`Object`, remise telle quelle à React comme
  enfant de nœud.

### Ce que le correctif rend atteignable — §8

Un filtre d'URL inconnu n'est plus « connu » : la liste s'affiche
**entière** au lieu d'être filtrée par une valeur qui n'existe pas. C'est
voulu, et c'est éprouvé dans les deux sens — chaque cas forgé de
`tests/enums.spec.ts` porte son contrôle positif, et la mutation « le
prédicat refuse tout » les rougit tous.

Aucune donnée nouvelle n'entre en base : les sept chemins refusaient déjà
au niveau de la colonne.

**Couvert par la story 3.2.** `tests/enums.spec.ts`, quatre cas, quatre
mutations jouées séparément.

---

<a id="bug-39"></a>
## 🔴 BUG-39 — Le propriétaire d'une vente ou d'un bail se pose par un POST, sans aucun contrôle d'agence **[CONFIRMÉ]** ✅ **CORRIGÉ**

**Relevé le 17-08-2026**, en instruisant `REP-02` pour la story 3.11 — donc
**par un constat reporté qu'on venait chercher**, et pas par une lecture
libre. Les deux défauts tenaient sur la **même ligne**, ce qui explique
qu'aucun des deux n'ait été vu :

```ts
data: { ...data, ownerId: data.ownerId ?? property.ownerId }
```

`REP-02` est à **gauche** du `??`. **BUG-39 est à droite.**

### Ce qui se passe

`saleSchema` et `rentalSchema` **acceptaient** un champ `ownerId`. Aucun
des quatre écrans concernés ne le rend — la valeur ne pouvait donc venir
que d'un POST forgé — et **personne ne la vérifiait contre l'agence** avant
de l'écrire.

Un utilisateur authentifié d'une agence pouvait ainsi rattacher sa propre
vente au propriétaire d'une **autre agence**. Le nom de ce propriétaire
ressort ensuite :

| Surface | Fichier |
|---|---|
| le **contrat de vente en PDF** | `app/api/pdf/sale-contract/[id]/route.tsx` — `include: { owner: true }` |
| le **contrat de bail en PDF** | `app/api/pdf/rental-contract/[id]/route.tsx` — idem |
| l'écran de **gestion locative** | `app/agency/rental-management/page.tsx:331` |
| l'**export CSV** des ventes et des baux | `app/api/export/[entity]/route.ts` |

C'est donc une **fuite inter-agences**, sur la propriété que
`docs/architecture.md` §3 décrit comme « la plus critique du système ».

### Reproduit, pas déduit

Rejeu du formulaire servi de `/agency/sales/[id]/edit`, avec le seul champ
`ownerId` forcé sur un propriétaire d'une agence voisine :

```
arrivée : /agency/sales/<id>?success=Vente mise a jour
en base : sale.ownerId = <propriétaire de l'agence voisine>
```

**L'action a répondu « Vente mise a jour ».** Le test qui l'a établi est
`tests/proprietaire-derive.spec.ts`, écrit **avant** le correctif pour
obtenir le rouge.

### Pourquoi les filets existants ne l'ont pas vu

- **`verifyPaymentLinks`** (`app/agency/payments/verify-links.ts`) fait
  exactement ce contrôle — et n'avait jamais été appliqué qu'aux paiements.
- **L'inventaire des couples écran → champ** de la story 3.9 a été bâti par
  `grep name="..."`. Il ne pouvait pas voir un champ que le formulaire ne
  rend pas.
- **Les tests de cloisonnement** de la story 4.2 éprouvent les identifiants
  de LIGNE (`/agency/sales/<id d'une autre agence>`), pas les identifiants
  RELATIONNELS postés dans le corps.

### Le correctif

Le propriétaire n'est **plus jamais reçu du formulaire** : la clef est
retirée des deux schémas, et la valeur est **dérivée du bien**, qui est
vérifié contre l'agence. Un propriétaire hors agence devient donc
inatteignable par construction, et non plus par un contrôle qu'on pourrait
oublier d'écrire.

### Ce que le correctif rend atteignable — §8

Le vendeur d'une vente ne peut plus être choisi indépendamment de son bien.
**Personne ne pouvait le faire par l'interface** — aucun écran ne rendait ce
champ —, donc aucune capacité n'est retirée à un utilisateur. Si le produit
veut un jour dissocier les deux, il faudra un champ, une liste, et une
vérification : c'est une story, pas une ligne.

**Couvert par la story 3.11.** `tests/proprietaire-derive.spec.ts`, trois
cas — vente, bail, et l'enregistrement à vide de `REP-02` —, trois
mutations jouées séparément.

---

<a id="bug-40"></a>
## 🟠 BUG-40 — Une date recule d'un jour quand on ouvre sa fiche et qu'on enregistre **[CONFIRMÉ]** ✅ **CORRIGÉ**

**Relevé le 18-08-2026**, et **par un test rouge, pas par une lecture.** La
suite a échoué sur un cas d'abonnement sans rapport avec le travail en
cours ; en l'instruisant, l'heure a tout expliqué — il était **00 h 35 en
heure locale, 23 h 35 en UTC**.

### Ce qui se passe

`toDateInputValue()` (`lib/format.ts`) construisait la valeur d'un
`<input type="date">` par `toISOString().slice(0, 10)` — donc **en UTC**.
Or les dates du produit sont écrites à **minuit local**. Mesuré sur la base
de développement, en UTC+1 :

```
RentalManagement.paymentDate     4 lignes,  3 avec une heure non nulle   ex: 2026-05-04T23:00:00.000Z
Payment.date                     6 lignes,  6 avec une heure non nulle   ex: 2026-04-16T23:00:00.000Z
Visit.date                       5 lignes,  5 avec une heure non nulle   ex: 2026-08-02T23:00:00.000Z
```

`2026-08-02T23:00:00Z` **est le 3 août** en heure locale. Le formulaire
affichait donc le **2**, et l'enregistrement l'écrivait tel quel : la visite
**reculait d'un jour**, sans que personne ne touche au champ.

### C'est la famille de BUG-34, sur une date au lieu d'un lien

*Ouvrir une fiche, cliquer « Enregistrer », sans rien modifier* — et la
donnée change. La story 3.9 avait fermé ce geste sur les **liens** ; celui-ci
passait à côté parce qu'aucun inventaire de liens ne regarde une date.

### Reproduit

```
Expected: "2026-07-15"
Received: "2026-07-14"
```

`tests/dates-fuseau.spec.ts`, écrit **avant** le correctif. Le décor pose
explicitement une date à minuit local : c'est la condition du défaut, pas
une coïncidence qu'on espère.

### Pourquoi il a survécu

**En UTC pur, l'ancienne et la nouvelle version rendent la même chose.** Le
défaut ne se voit pas depuis un serveur en UTC — et il se voit tous les
jours depuis Alger, sur un produit dont c'est le seul marché.

### Le correctif : une convention, aux deux bouts

Une date de ce produit désigne un **jour civil dans le fuseau de l'agence**.

| | |
|---|---|
| **lecture** | `toDateInputValue()` rend les parties **locales** |
| **écriture** | `requiredDate` / `optionalDate` relisent `« YYYY-MM-DD »` à **minuit local** (`jourCivilLocal`) |

**Les deux bouts ne peuvent pas bouger l'un sans l'autre** : lire en local
et écrire en UTC ferait dériver l'aller-retour d'un jour dans tout fuseau
négatif. La mutation le montre — corriger la seule lecture laisse le test
d'écriture rouge, et réciproquement.

### Ce que le correctif rend atteignable — §8

Les dates déjà écrites **ne bougent pas** : elles étaient à minuit local,
elles sont désormais lues comme telles. Ce qui change est l'heure de celles
qu'on écrira — minuit local au lieu de minuit UTC, soit une heure d'écart
sur une colonne où l'heure ne veut rien dire.

**Aucune donnée n'est réparée pour autant.** Les lignes déjà reculées d'un
jour par un enregistrement passé restent fausses ; les retrouver demande la
même enquête que `REP-01`, sur la même base de production, et appartient au
même arbitrage.

**Couvert par la story 3.11.** `tests/dates-fuseau.spec.ts`, deux mutations
jouées séparément — une par bout de la convention.
