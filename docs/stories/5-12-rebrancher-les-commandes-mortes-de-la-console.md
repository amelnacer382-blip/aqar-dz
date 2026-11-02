# Story 5.12 — Rebrancher les commandes mortes de la console éditeur

**Épopée :** 5 — Dette technique et lisibilité produit
**Statut :** `done` — revue de code du 14-08-2026 passée. Elle avait rouvert
la story sur 3 décisions et 15 correctifs, dont **deux affirmations fausses**
et **trois critères tenus à moitié** ; les 18 sont traités, 7 constats
reportés avec leur story propriétaire. Voir § Review Findings.
**Couvre :** BUG-35
**Ouvre :** REP-78, 79, 81, 82, 83, 84 (story 5.13) · REP-80, 85, 87 (story 4.7) · REP-86 (story 5.9)
**Date :** 14 août 2026

---

## ⚠ L'ordre a été enfreint, et c'est écrit ici plutôt que caché

`CLAUDE.md` §1 : **tout changement de code passe par une story**, et la
règle d'or de l'éditeur la double — on met à jour les `.md` **avant** de
toucher au code.

**Ce n'est pas ce qui s'est passé.** Le code de `AdminNavbar.tsx`, le test
`tests/navigation.spec.ts` et l'entrée BUG-35 de `docs/qa/bug-report.md` ont
été écrits **avant** que cette story n'existe. Pire : l'entrée BUG-35
citait « Correction (story 5.12) » comme si la story était là, alors que
`docs/epics.md` ne la contenait pas, que `sprint-status.yaml` ne la
connaissait pas et qu'aucun fichier ne portait ce nom. **Une référence à un
document inexistant présentée comme une preuve de traçabilité** — c'est
exactement la classe d'affirmation non tenue que `CLAUDE.md` §7 traite
comme un défaut.

Constaté et réparé le 14-08-2026 : cette story est écrite après coup, et
elle le dit. Le correctif est conservé — il est juste, et le défaut est
réel — mais **il ne compte pas comme un précédent.**

Trois écarts trouvés en réparant, tous dans les `.md` :

| Écart | Correction |
|---|---|
| La story 5.12 était citée sans exister | Écrite (ici, `epics.md`, `sprint-status.yaml`) |
| BUG-35 rangé dans la « cinquième passe », qui parle de corbeille | Sixième passe créée : elle part d'un **usage**, pas d'une lecture |
| L'en-tête du registre disait « le total est de 34 » | Recalculé : **35** (`grep -c '^<a id="bug-' docs/qa/bug-report.md`) |

Accessoirement, l'en-tête de `sprint-status.yaml` annonçait « 37 stories »
là où le dépôt en compte **48** — chiffre déjà faux avant ce passage, de la
famille de REP-74. Recalculé et documenté avec sa commande, puisqu'ajouter
deux stories l'aurait rendu faux d'une manière de plus.

---

## Le défaut

L'éditeur, le 14 août 2026 : *« certains éléments de la barre du haut ne
sont pas reliés à leurs vraies pages ».*

Vérifié dans `components/layout/AdminNavbar.tsx` — **cinq commandes sans
aucune action** :

| Commande | État à `HEAD` | Cible |
|---|---|---|
| « Déconnexion » (bureau) | aucun `onClick` | — |
| « Déconnexion » (mobile) | aucun `onClick` | — |
| « Paramètres » (menu) | aucun lien | `/admin/settings` **existait** |
| « Profil » | aucun lien | **n'a jamais existé** |
| Cloche de notifications | aucun `onClick` | **n'a jamais existé** |

Mesuré, et pas supposé :
`git show HEAD:components/layout/AdminNavbar.tsx | grep -c next-auth` → **0**.
Le fichier n'importait pas `signOut`.

**Les deux barres sont nées inertes** — et ceci corrige la première
rédaction de cette story, qui écrivait qu'`AgencyNavbar.tsx` « le faisait
correctement depuis l'origine ». La revue l'a démentie en une commande :
`git show a529f61:components/layout/AgencyNavbar.tsx | grep -c signOut` →
**0**, pour deux libellés « Déconnexion ». `signOut` n'y apparaît que le
09-08-2026 (`1bbbb12`), **sans story ni trace**. Il n'y a pas eu de
divergence : une barre a été réparée en silence, l'autre est restée telle
quelle trois mois de plus. *Le motif importait plus que la conclusion — la
conclusion (« il fallait réparer celle-ci ») tenait de toute façon.*

**Le plus grave est la déconnexion.** Un éditeur ne pouvait pas fermer sa
session depuis sa console. Cette session dure douze heures depuis la story
1.8 ; sur un poste partagé, elle restait donc ouverte sur **le compte le
plus puissant du produit**. Un recours existait — `/api/auth/signout` de
NextAuth reste servi, `auth.config.ts` ne surchargeant que `signIn` et
`error` — mais c'est une URL que rien n'affiche et qu'aucun éditeur ne
devine. *La première rédaction écrivait « le seul recours était d'effacer
les cookies » : la revue l'a démenti. C'est une impasse d'interface, pas
une impasse technique.* Ce n'est pas exploitable à distance — d'où 🟠 et
non 🔴 — mais c'est un accès privilégié qui survit à son utilisateur.

**La cloche mentait en plus de ne rien faire** : pastille rouge permanente,
c'est-à-dire l'annonce de messages non lus, dans un produit qui n'a aucune
notification.

---

## Ce que ce défaut dit de la méthode, et qui vaut plus que le correctif

**Cinq passes d'audit sont passées à côté.** Elles cherchaient des gardes,
des requêtes, des Server Actions, des contraintes de base — jamais un
fichier de navigation.

Et surtout : **aucun contrôle automatique de ce dépôt ne voit un bouton
sans gestionnaire.** `npx tsc --noEmit` compile un `<button>` inerte sans
broncher ; `npm run lint` aussi ; la suite E2E ne l'exerce pas puisque
aucun test n'ouvrait ce menu. Il n'existe donc **aucun signal** pour cette
classe de défaut — seul un usage réel la trouve. C'est pourquoi le
signalement de l'éditeur est traité ici comme une passe d'audit à part
entière, et non comme un ticket.

---

## Arbitrage : retirer plutôt que brancher

« Profil » et la cloche **n'ouvrent sur rien, et rien n'existe pour elles**.
Les brancher supposerait d'écrire d'abord la page ou la fonctionnalité :
c'est un PRD (`CLAUDE.md` §1), pas une icône à reconnecter.

Le motif, pour qu'il puisse être rouvert sciemment : **une décoration qui
ment sur l'état du système coûte plus qu'elle n'apporte.** L'éditeur
cliquait, rien ne se passait, et rien ne le lui disait. Un menu qui ne
propose que ce qui s'ouvre est plus petit et plus vrai.

Un test verrouille ce choix pour **chacune des deux**. « Profil » est
asserté par son rôle de `menuitem` ; la cloche, qui était un bouton icône
**sans nom accessible**, l'est par la classe `lucide-bell` que pose la
bibliothèque elle-même — donc insensible à un remaniement de nos classes
Tailwind. *Le premier jet n'assertait que « Profil » alors que le critère
dit « elles » : une case cochée à moitié, relevée en revue.*

---

## Critères d'acceptation

Voir `docs/epics.md` § Story 5.12 — la source fait foi.

---

## Tâches

- [x] Importer `signOut` et le câbler sur les **deux** boutons « Déconnexion » (bureau et mobile)
- [x] Relier « Paramètres » à `/admin/settings`
- [x] Retirer « Profil » et la cloche de notifications, motif écrit en commentaire dans le fichier
- [x] Écrire `tests/navigation.spec.ts`, contrôle positif compris
- [x] Inscrire BUG-35 au registre des défauts, dans une **sixième passe** distincte
- [x] Écrire la story, l'épopée et l'entrée de sprint — **faits après le code, voir l'avertissement en tête**
- [x] Verser les constats hors périmètre en REP-78 et REP-79, avec la story 5.13 qui les porte
- [x] `npx tsc --noEmit` — **0 erreur**, mesuré le 14-08-2026
- [x] `npm run lint` — **0 erreur**, mesuré le 14-08-2026 (4 avertissements `<img>` préexistants, hors périmètre)
- [x] `npm run test:e2e` — vert, sur accord explicite de l'éditeur le 14-08-2026
- [x] **Preuve par mutation faite, et les messages lus** — voir le tableau ci-dessous
- [x] Verser REP-80, trouvé pendant la mutation, à la story 4.7

**Ajoutées par la revue de code du 14-08-2026 :**

- [x] Couvrir le bouton « Déconnexion » **mobile** — cas dédié forçant le viewport, prouvé par mutation
- [x] Poser un `aria-label` sur le burger de la console (REP-84) : sans nom accessible, le chemin mobile était **intestable**
- [x] Verrouiller le non-retour de **la cloche**, et non du seul « Profil » — ancrage `lucide-bell`, prouvé par mutation
- [x] Ancrer le cas d'absence sur une preuve d'ouverture du menu (§6, piège 1) — prouvé par la mutation `open={false}`
- [x] Prouver par mutation le lien « Paramètres », qui ne l'était pas
- [x] Ancrer les sélecteurs (`/^SA$/`) et porter le délai de cas **au-dessus** de la somme qu'il encadre — **240 s** pour 210 s de délais internes, calcul écrit dans le fichier (première correction à 180 s : fausse, voir la passe de vérification)
- [x] Corriger les **deux affirmations fausses** (`AgencyNavbar` « correct depuis l'origine », `/admin/settings` « que rien ne reliait ») et l'impasse surévaluée des cookies
- [x] Recompter `epics.md:16`, `README.md`, `project-context.md` et rafraîchir la table de REP-74
- [x] Verser REP-81 à REP-85, avec leur story propriétaire
- [x] **Audit Lighthouse — LANCÉ**, sur arbitrage de l'éditeur du 14-08-2026 (voir ci-dessous)

## L'audit Lighthouse, et ce qu'il n'a pas pu mesurer

**Arbitrage de l'éditeur, 14-08-2026 : lancer l'audit.** La story proposait
de s'en dispenser ; §13 dit qu'un arbitrage se demande et ne se rend pas à
soi-même, et la revue l'a relevé. Demandé, tranché : on le lance.

**Résultat mesuré**, `npm run build && npm start` sur `:3002`, Lighthouse
12.8.2, bureau, page `/auth/login` :

| Catégorie | Score |
|---|---|
| Performance | **0,75** — LCP 6,2 s, TBT 70 ms, CLS **0** |
| Accessibilité | **0,89** |
| Bonnes pratiques | **1,00** |

**Ce que cet audit ne dit PAS, et il faut l'écrire.** Il n'a **pas** exercé
`AdminNavbar.tsx`, c'est-à-dire le seul fichier que cette story modifie.
Toutes les pages qui rendent cette barre sont derrière une session, et
Lighthouse ne sait pas s'authentifier. Le premier essai visait `/admin` :
le serveur a répondu **307** et l'audit a mesuré la page de connexion. Les
trois scores ci-dessus décrivent donc une page **que cette story ne touche
pas** — ils valent comme repère du produit, pas comme mesure du correctif.
*Ne pas avoir pu mesurer est un résultat (§7) ; le présenter comme une
mesure du correctif en serait un faux.*

Le LCP de 6,2 s est réel et mauvais. Il est **antérieur à cette story** et
appartient à la story **3.7** (« servir les images à leur poids réel »),
qui vise explicitement le LCP sous 2,5 s. Rien dans ce correctif ne l'a
déplacé : il ne touche ni image, ni page, ni rendu serveur.

**L'audit a trouvé autre chose, et c'est sa vraie valeur ici** : voir
`REP-86`. En visant `:3002`, l'audit a atterri sur `:8095` — le serveur
local redirige vers une **autre origine**.

## La preuve par mutation

**Refaite entièrement après la revue du 14-08-2026.** Le premier tableau ne
portait que deux mutations et se présentait comme complet ; la revue a
montré qu'il laissait **trois propriétés sans preuve** — le bouton mobile,
la cloche, et le lien « Paramètres » — et qu'un quatrième trou existait dans
le test lui-même. Quatre mutations désormais, jouées en deux passes parce
que la quatrième recouvre les autres.

**Le piège de §6 est évité sciemment.** Retirer l'import de `signOut`
rendrait l'import inutilisé → lint en erreur → build en échec, et le rouge
ne viendrait plus du test. Chaque mutation est donc chirurgicale, et
`npx tsc --noEmit` comme `npm run lint` ont été **relancés sous mutation** :
0 erreur dans les deux passes. Le rouge vient bien du test.

### Passe A — trois mutations sur trois cas distincts

| Mutation | Cas visé | Résultat | Le message désigne-t-il la bonne propriété ? |
|---|---|---|---|
| `onClick` du « Déconnexion » **mobile** retiré | « sur mobile, le bouton Déconnexion ferme réellement la session » | 🔴 | **Oui** — le `waitForURL(/\/auth\/login/)` du cas mobile expire : la sortie n'a pas lieu |
| `<Link href="/admin/settings">` retiré de l'entrée de menu | « l'entrée Paramètres … mène à la page des paramètres » | 🔴 | **Oui** — `waitForURL(/\/admin\/settings/)` du cas « Paramètres » expire |
| Cloche `<Bell>` + pastille rouge réintroduites | « le menu ne propose rien qui n'ouvre nulle part » | 🔴 | **Oui** — `locator('header .lucide-bell')`, `Expected: 0 / Received: 1` |
| — | « le bouton Déconnexion ferme … » (bureau) | 🟢 | Isolation : une mutation mobile ne fait pas rougir le cas bureau |
| — | « contrôle positif » | 🟢 | Le rouge vient des commandes, pas d'une console cassée |

### Passe B — la mutation qui prouve l'ancrage, et c'est la plus importante

`<DropdownMenu open={false}>` : le menu ne s'ouvre plus **du tout**.

| Cas | Résultat | Où il échoue |
|---|---|---|
| « le bouton Déconnexion ferme … » | 🔴 | dans `ouvrirMenuUtilisateur`, sur l'ancrage |
| « l'entrée Paramètres … » | 🔴 | dans `ouvrirMenuUtilisateur`, sur l'ancrage |
| « le menu ne propose rien … » | 🔴 | **sur l'ancrage**, et non sur l'assertion « Profil » |
| « sur mobile … » | 🟢 | n'utilise pas le menu de bureau |
| « contrôle positif » | 🟢 | idem |

**C'est cette dernière ligne qui compte.** Dans sa version d'origine, ce cas
serait resté **VERT** sous cette mutation : « Profil » est bel et bien absent
d'un menu qui ne s'ouvre pas. Il aurait donc certifié le retrait d'une
entrée en n'observant qu'une page vide — le **piège 1 de §6** mot pour mot,
dans un test dont l'en-tête citait §6. L'ancrage `expect(menuitem
Déconnexion).toBeVisible()` le referme, et la mutation le démontre au lieu
de l'affirmer.

Mutations retirées, fichier restauré à l'identique, suite rejouée.

> **Une erreur de méthode a été commise en chemin, et elle est écrite parce
> qu'elle a servi.** La toute première mutation a été lancée avec
> `npx playwright test tests/navigation.spec.ts`, sans `--project` : **deux
> variables changées à la fois** — la mutation *et* la commande. Résultat,
> 17 échecs sur 20 au lieu de 2, dont un contrôle positif sur trois
> navigateurs qu'aucune mutation ne pouvait atteindre. C'est ce qui a
> révélé **REP-80** : `test:e2e` ne joue que `chromium` alors que la
> configuration en déclare cinq. Toutes les passes suivantes sont
> restreintes à `chromium`.

---

## Qu'est-ce que ce correctif rend atteignable ? (`CLAUDE.md` §8)

La question est obligatoire ici, parce que ce dépôt a payé trois fois pour
ne pas se l'être posée.

1. **Le bouton « Déconnexion » devient réellement cliquable — donc le
   chemin de sortie devient fréquent.** `signOut({ callbackUrl:
   "/auth/login" })` renvoie vers un écran public : ce chemin existe déjà
   et il est celui d'`AgencyNavbar.tsx` depuis l'origine, sur un produit où
   la story 1.8 a déjà refait tourner la révocation. **Aucune boucle de
   redirection nouvelle n'est attendue** — mais c'est précisément ce qu'on
   croyait avant la 1.8, et seule l'exécution de la suite le confirmera.
2. **Retirer une entrée de menu ne peut pas casser une garde** : rien
   n'autorisait par ces boutons. `lib/auth-guard.ts` reste la seule couche
   (`CLAUDE.md` §5).
3. **Le test ouvre un menu déroulant Radix**, ce qu'aucun test de la suite
   ne faisait, et **force un viewport mobile**, ce qu'aucun ne faisait non
   plus. Ce sont deux mécanismes neufs dans ce harnais : au premier rouge,
   la cause se mesure, elle ne se suppose pas. *La première rédaction
   écrivait ici que « l'instabilité viendra du harnais et non du produit » —
   la revue l'a retiré : c'est une excuse préventive non falsifiable, qui
   classe d'avance tout échec futur comme bruit. §8 demande l'inverse.*

---

## File List

Tous les fichiers touchés, sans exception (`CLAUDE.md` §9).

| Fichier | Nature |
|---|---|
| `components/layout/AdminNavbar.tsx` | code — `signOut` câblé ×2, « Paramètres » relié, « Profil » et cloche retirés |
| `tests/navigation.spec.ts` | test — **nouveau fichier**, 4 cas dont le contrôle positif |
| `docs/qa/bug-report.md` | BUG-35, sixième passe, total recalculé 34 → 35 |
| `docs/epics.md` | stories 5.12 et 5.13 |
| `docs/stories/sprint-status.yaml` | entrées 5-12 et 5-13, `last_updated`, en-tête recompté |
| `docs/stories/deferred-work.md` | REP-78 à REP-85, deux lignes d'index, table de REP-74 rafraîchie |
| `docs/README.md` | décomptes rendus faux par BUG-35, corrigés (34 → 35, 37 → 48) |
| `docs/project-context.md` | idem (33 → 35) |
| `docs/stories/5-12-rebrancher-les-commandes-mortes-de-la-console.md` | cette story |

---

## Passe de vérification du 14-08-2026 — trois affirmations fausses de plus

**Demandée par l'éditeur après la revue** : « on n'affirme jamais sans en
être sûr ». Le reproche portait juste, et pas seulement sur les deux
affirmations que la revue avait déjà relevées : **en rédigeant REP-81 à
REP-87, j'ai repris des affirmations de mes propres relecteurs sans les
vérifier moi-même.** Toutes repassées à la commande. Ce qui n'a pas tenu :

| Affirmation publiée | Réalité mesurée |
|---|---|
| Délai de cas « aligné sur la somme qu'il encadre » à **180 s** | **Faux de 30 s.** La somme est **210 s** : `login()` traverse `goto` 60 s **+** `waitForURL` 90 s = 150 s, plus deux attentes de 30 s. Le `goto` avait été oublié. Corrigé à **240 s, calcul écrit dans le fichier** |
| `AdminNavbar.tsx:167` pour le `signOut` mobile | **Faux.** Ligne réelle **177** — mes propres modifications avaient décalé le fichier |
| `AdminNavbar.tsx:128-133` pour le burger, `:166-172` pour le bloc mobile, `:153` pour les `<Link>` | **Faux**, tous : **136-141**, **176-181**, **163** |
| « **21 constats retenus** » en tête de la revue | **Faux.** 3 + 15 + 5 = **23**. Recompté par `grep -c "\[Review\]\[Patch\]"` et ses homologues — un total écrit de mémoire au lieu d'être compté, dans le paragraphe même qui annonçait que tout avait été revérifié |

**La correction de fond n'est pas de rectifier ces nombres.** Un numéro de
ligne est une affirmation qui se périme **à chaque édition du fichier qu'elle
désigne** — y compris par le correctif qui l'accompagne. Toutes les
références de ligne de cette story et des REP-81 à 87 ont donc été
**remplacées par des ancrages de contenu** (« le `<button>` du bloc
`md:hidden` », « les deux appels `signOut(...)` »), qui survivent au
prochain remaniement. Seules subsistent les références datées, marquées
« état d'avant correctif ».

**Ce qui a tenu à la vérification**, et il faut le dire aussi : la date de
`1bbbb12` (09-08-2026), les 12 h de session (`auth.config.ts`), l'`aria-label`
d'`AgencyNavbar`, les deux `signOut` d'`AgencyNavbar`, le mécanisme interne
de `signOut` (`data.url ?? redirectTo`, `res.json()` sans garde — relu dans
`node_modules/next-auth/react.js`), l'entrée « nginx / `AUTH_TRUST_HOST` » du
registre, et la page `/api/auth/signout` réellement servie par `@auth/core`
(`SignoutPage`) — cette dernière étant l'affirmation qui corrigeait « le seul
recours était d'effacer les cookies », et qu'il aurait été absurde de ne pas
vérifier à son tour.

---

## Review Findings

> Revue adversariale du 14-08-2026, trois couches en parallèle (Blind
> Hunter, Edge Case Hunter, Acceptance Auditor), lancées sans contexte de
> conversation. **23 constats retenus** — 3 décisions, 15 correctifs,
> 5 reports —, tous revérifiés à la main avant d'être notés — y compris ceux qui contredisent l'auteur de la story.
>
> **La revue a trouvé deux affirmations fausses que trois documents
> répétaient.** C'est exactement ce que §7 traite comme un défaut, et c'est
> l'auteur de la story qui les avait écrites.

### Décisions — rendues par l'éditeur le 14-08-2026

> **1. Lighthouse → LANCER.** Fait, résultat et limite écrits ci-dessus, plus `REP-87`.
> **2. Recomptage → délégué à l'auteur.** Tranché : corriger tout ce que cette story a rendu faux (`epics.md:16`, `README.md`, `project-context.md`) et rafraîchir la table de `REP-74`. Motif : `README.md` disait vrai avant ce passage — reporter des affirmations fausses qu'on vient soi-même de créer est précisément ce que §7 et §8 sanctionnent. Les cinq autres lignes de REP-74 restent à la story 5.11.
> **3. Cloche → donner un ancrage puis tester.** `aria-label` posé sur le burger (REP-84), assertion sur `lucide-bell`, prouvée par mutation.


- [x] [Review][Decision] **Audit Lighthouse (règle 10) : dispense ou exécution ?** — La story se dispense de l'audit en s'appuyant sur §9, qui ne le cite pas ; mais l'obligation vient de la **règle 10 (§12)**, « audit Lighthouse avant validation finale ». Le motif écrit est solide (aucune page, aucun rendu, aucune image touchés). Ce qui manque n'est pas la justification mais l'**arbitrage** : §13 dit qu'il se demande à l'utilisateur, pas qu'il se rend à soi-même.
- [x] [Review][Decision] **Périmètre du recomptage documentaire.** — Cette story a corrigé les décomptes de `sprint-status.yaml` (48 stories, 35 défauts), ce qui est le travail de la story **5.11** (`backlog`). Résultat, **état constaté par la revue et depuis corrigé** : `docs/epics.md` (en-tête « Overview »), `docs/README.md` (quatre lignes) et `docs/project-context.md` (§ « Ce qu'il faut savoir ») divergeaient, et la table de `REP-74` publie encore 44 et 34 — si bien que celui qui exécutera la 5.11 avec REP-74 en main écrira des nombres faux. Finir ici, ou verser en `REP-nn` et laisser la 5.11 ?
- [x] [Review][Decision] **Comment verrouiller le non-retour de la cloche (AC 4) ?** — Le critère dit « **elles** sont retirées, et un test échoue si **elles** réapparaissent ». Seul « Profil » est asserté. La cloche n'était pas un `menuitem` mais un `<Button variant="ghost" size="icon">` **sans `aria-label`** : elle n'a aucun nom accessible sur lequel asserter. Trois issues possibles — lui donner un ancrage testable, restreindre l'AC à « Profil », ou verser le reste en `REP`.

### Correctifs à appliquer

- [x] [Review][Patch] **« `AgencyNavbar` le faisait correctement depuis l'origine » est FAUX** — `git show a529f61:components/layout/AgencyNavbar.tsx | grep -c signOut` → **0**, et 2 libellés « Déconnexion ». Les deux barres sont nées inertes ; celle de l'agence a été réparée le 09-08-2026 (`1bbbb12`), sans story ni trace. Le récit de « divergence » inverse la cause. Répété dans 3 documents [docs/qa/bug-report.md, docs/epics.md § 5.12, la présente story]
- [x] [Review][Patch] **« `/admin/settings`, page que rien ne reliait » est FAUX** — `git show HEAD:components/layout/AdminNavbar.tsx` ligne 35 : `{ href: "/admin/settings", … }` est dans `navLinks`, rendu dans la barre bureau **et** dans le menu mobile. Seule l'entrée du menu déroulant était morte ; la page était atteignable. [docs/epics.md § Story 5.12, AC 3]
- [x] [Review][Patch] **« le seul recours était d'effacer les cookies » surévalue le défaut** — `auth.config.ts:50-53` ne surcharge que `signIn` et `error` : la page `/api/auth/signout` de NextAuth reste servie, et `middleware.ts` laisse passer `/api/auth/`. La gêne est réelle, l'impasse annoncée non. [bug-report.md, epics.md, story, en-tête de tests/navigation.spec.ts]
- [x] [Review][Patch] **Le bouton « Déconnexion » mobile n'est prouvé par rien** — AC 1 dit « sur le poste **ou sur mobile** ». Les 4 cas passent tous par `getByRole("button", { name: /SA/i })`, donc par le conteneur `hidden md:flex`. Et `REP-80` établit que les projets mobiles ne sont jamais joués. **On peut retirer aujourd'hui le `onClick` mobile sans faire rougir la suite** — le défaut BUG-35 à moitié rouvert, sans signal. [`AdminNavbar.tsx`, le `<button>` « Déconnexion » du bloc `md:hidden` ; `tests/navigation.spec.ts`]
- [x] [Review][Patch] **Le cas « le menu ne propose rien qui n'ouvre nulle part » est vert si le menu ne s'ouvre pas** — piège 1 de §6, mot pour mot : rien n'établit que le déroulant s'est ouvert avant d'asserter `toHaveCount(0)`. Si le déclencheur casse, l'assertion devient verte en ne testant plus rien. Le contrôle positif déclaré est à côté du trou : il n'ouvre pas le menu. [`tests/navigation.spec.ts`, cas « le menu ne propose rien qui n'ouvre nulle part », **état d'avant correctif**]
- [x] [Review][Patch] **Le lien « Paramètres » n'a pas été prouvé par mutation** — §6 demande de retirer « la règle qu'on vient d'ajouter ». Le tableau de mutation classe ce cas en 🟢 « isolation confirmée » : c'est le contrôle de non-contamination, pas la preuve du cas. Aucune mutation n'a retiré le `<Link href="/admin/settings">`. [la présente story, § La preuve par mutation]
- [x] [Review][Patch] **L'en-tête de `bug-report.md` affirme deux totaux et un mauvais nombre de passes** — le blockquote **que ce diff réécrit** s'ouvre sur « **Quatre passes**, un seul registre » alors qu'il en énumère six, et conserve « Le total est de **33 défauts** » sept lignes avant « **Le total est de 35.** » [`docs/qa/bug-report.md`, le blockquote « … passes, un seul registre » de l'en-tête]
- [x] [Review][Patch] **AC 5 satisfait en fait, pas en trace** — le critère demande que « les commandes mortes des **autres barres** soient relevées en `REP-nn` ». `REP-78` porte sur des liens refusés par la garde, `REP-79` sur une identité en dur : ni l'un ni l'autre n'est une commande morte. La vérification a bien eu lieu et son résultat est **négatif** (aucune autre commande morte) — mais un résultat négatif est un résultat (§7) et il n'est écrit nulle part.
- [x] [Review][Patch] **`test.setTimeout(120000)` contredit sans mesure une décision mesurée** — `playwright.config.ts:37` pose `timeout: 90_000` avec un commentaire qui se qualifie de « MESURE, pas prudence » et de « pansement assumé ». Les 4 nouveaux cas le portent à 120 s sans motif ni commentaire — §11 interdit de réduire en passant un commentaire qui porte une décision. [`tests/navigation.spec.ts`, les `test.setTimeout()`, **état d'avant correctif**]
- [x] [Review][Patch] **La phrase de statut contredit la liste de tâches trois lignes plus bas** — l'en-tête écrit « `review` — toutes les tâches de §9 sont faites et mesurées » au-dessus d'une case `[ ]`. §9 : « une story dont une tâche reste ouverte reste `in-progress` ». [la présente story, en-tête]
- [x] [Review][Patch] **BUG-35 marqué `✅ CORRIGÉ` alors que la story n'est pas `done`** — le registre acte une clôture que le processus n'a pas encore accordée, et que la présente revue peut refuser. Même mécanisme que l'écart déjà consigné en tête de story. [`docs/qa/bug-report.md`, tableau de la sixième passe et titre de BUG-35]
- [x] [Review][Patch] **Marqueur `[ÉTABLI PAR LECTURE]` inventé et absent de la légende** — unique occurrence sur 35 entrées ; l'en-tête du fichier dit déjà que « les autres sont établis par lecture du code ». Soit il entre dans la légende, soit il sort. [`docs/qa/bug-report.md`, titre de BUG-35]
- [x] [Review][Patch] **`getByRole("button", { name: /SA/i })` n'est pas ancré** — capte tout nom contenant « sa » (« Sauvegarder », « Désactiver »). Latent aujourd'hui (`/admin` ne rend aucun autre bouton), mais la story 5.13 déjà planifiée touche ces barres. `/^SA$/` coûte le même effort. [`tests/navigation.spec.ts`, les `getByRole("button", { name: /SA/i })`, **état d'avant correctif**]
- [x] [Review][Patch] **`docs/epics.md` ne liste que 2 des 7 fichiers touchés** — « **Fichiers :** `AdminNavbar.tsx`, `tests/navigation.spec.ts` », alors que la File List de la story en compte sept et que `git status` les confirme. C'est pourtant la première ligne que lira quelqu'un qui rouvre le sujet. [docs/epics.md § Story 5.12]
- [x] [Review][Patch] **Excuse préventive non falsifiable dans la réponse à §8** — « s'il s'avère instable, l'instabilité viendra du harnais et non du produit ». L'énoncé classe d'avance tout échec futur comme bruit, sans mesure : c'est le contraire de ce que §8 demande. [la présente story, § Qu'est-ce que ce correctif rend atteignable, point 3]

### Reportés — réels, hors périmètre de cette story

- [x] [Review][Defer] **`signOut()` est lancé sans `.catch()`** [`AdminNavbar.tsx`, les deux appels `signOut(...)`] — reporté, touche la gestion d'erreur du client NextAuth, pas le câblage
- [x] [Review][Defer] **La sortie repose sur `data.url` renvoyé par le serveur, pas sur le `callbackUrl` passé** [`AdminNavbar.tsx`, l'appel `signOut(...)` du menu de bureau] — reporté, dépend de la configuration d'hôte (nginx, `AUTH_TRUST_HOST`), déjà au registre par ailleurs
- [x] [Review][Defer] **Rien ne garde l'activation répétée pendant que `signOut` est en vol ; le bouton mobile ne ferme pas son menu** [`AdminNavbar.tsx`, le `DropdownMenuItem` « Déconnexion » et le `<button>` homologue du bloc `md:hidden`] — reporté, ergonomie
- [x] [Review][Defer] **Le burger de la console éditeur n'a pas d'`aria-label`** [`AdminNavbar.tsx`, le `<button>` `md:hidden` d'ouverture du menu] — reporté ; `AgencyNavbar.tsx:190` en a un, l'asymétrie bloque tout sélecteur accessible sur le chemin mobile
- [x] [Review][Defer] **Le délai de cas (120 s) est plus court que la somme des délais internes qu'il encadre (150 s)** [`tests/navigation.spec.ts`, les `test.setTimeout()` · `tests/auth-helper.ts`, les délais de `login()`] — reporté, appartient au harnais
