# Story 4.4: Verrouiller les correctifs de l'épopée 1

Status: done

## Story

As a développeur,
I want qu'un test échoue si une régression ramène un défaut critique,
so that la remise en état soit acquise et non reprise à zéro dans six mois.

**Couvre :** consolidation NFR-07

## Ce que cette story doit vraiment faire

Chaque story de l'épopée 1 s'est close en annonçant ses tests. Le
problème est que **je suis le seul témoin** de ces annonces : la
couverture est affirmée story par story, jamais vérifiée d'ensemble, et
une affirmation de couverture est exactement le genre de chose que ce
projet a déjà pris en défaut deux fois (les dix-sept cas de BUG-28, mes
propres assertions tautologiques).

La formulation de l'AC est sans ambiguïté : « il existe au moins un test
qui **échoue si le défaut revient** ». Le seul moyen de le savoir est de
**faire revenir le défaut** et de regarder. Cette story est donc un
**audit par mutation**, pas une écriture de tests : pour chacune des six
stories closes de l'épopée 1, on remet le défaut dans le code et on
mesure quel test rougit — ou quel test ne rougit pas.

Le résultat honnête peut être « tout est déjà couvert ». Ce ne serait pas
un échec de la story : ce serait la première preuve, plutôt que la
sixième affirmation.

## Ce que je tranche, et pourquoi

**La mutation porte sur le correctif, pas sur le test.** Je remets le
défaut d'origine — la ligne exacte que la story avait changée — et non
une approximation commode. Un `escapeHtml` qui rend sa chaîne telle
quelle, un `.toLowerCase()` retiré, un `safeKey` qui ne regarde plus les
remontées de dossier.

**Une mutation qui ne compile pas ne prouve rien.** C'est arrivé trois
fois dans les stories 2.2, 4.2 et 4.3 — import inutilisé, condition
constante refusée par ESLint, comparaison de types sans recouvrement. La
mutation doit passer `next build`, sinon elle ne dit rien du test.

**Chaque mutation est reformulée jusqu'à ce qu'elle compile, jamais
abandonnée.** Une mutation qu'on renonce à faire compiler devient une
ligne « couvert » écrite sans preuve.

**J'ajoute la lacune que j'ai moi-même reportée en story 4.1 :** aucune
passe systématique sur les routes `/api/*`. `middleware.ts` leur applique
un refus par défaut — « une API inconnue n'a pas à révéler ce qu'elle
est » — et rien ne vérifie que ce refus tient. C'est précisément une
consolidation de l'épopée 1, donc sa place est ici.

**Cette passe est gardée contre la rouille**, comme celle de la story
4.1 : la table est confrontée au disque. Une route d'API ajoutée sans
entrer dans la liste fait rougir la suite, au lieu de creuser un trou en
silence.

**La story 1.1 reste ouverte** et ne fait pas partie de l'audit : elle a
été reportée par l'éditeur en connaissance de cause, et le suivi de
sprint en porte la trace. Un audit de couverture ne rouvre pas un
arbitrage.

## Acceptance Criteria

1. **Given** chacune des six stories closes de l'épopée 1
   **When** on remet son défaut dans le code
   **Then** au moins un test rougit, et son nom est consigné dans la story

2. **Given** les défauts n° 01, 02, 04, 06 et 07
   **When** la mutation est appliquée
   **Then** casse d'email, lecture de document sans session, en-tête forgé, cellule CSV commençant par `=` et clé contenant `..` font chacun rougir un test nommé

3. **Given** une mutation qui ne compile pas
   **When** elle est rencontrée
   **Then** elle est reformulée jusqu'à compiler — jamais comptée comme couverte

4. **Given** les routes `/api/*` protégées
   **When** un appelant sans session les demande
   **Then** chacune répond 401 en JSON, et non du HTML de page de connexion

5. **Given** la table de ces routes
   **When** une route d'API est ajoutée ou retirée
   **Then** la suite rougit tant que la table n'a pas suivi

## Tasks / Subtasks

- [x] **1. Passe systématique sur `/api/*`** (AC 4, 5)
  - [x] Table des routes protégées et des routes publiques, avec la méthode réelle
  - [x] Sans session : 401 et `content-type: application/json`
  - [x] Routes publiques : elles répondent, et ne sont donc pas dans la mauvaise liste
  - [x] Garde table/disque sur `app/api/**/route.ts(x)`

- [x] **2. Audit par mutation, six stories** (AC 1, 2, 3)
  - [x] 1.2 — normalisation d'email
  - [x] 1.3 — lecture d'un document sans session
  - [x] 1.4 — identification de l'appelant
  - [x] 1.5 — échappement des emails
  - [x] 1.6 — neutralisation des formules CSV
  - [x] 1.7 — contrainte sur l'adresse d'un document

- [x] **3. Consigner le résultat**
  - [x] Tableau défaut → mutation → test rougi, avec les noms exacts
  - [x] Toute lacune trouvée est comblée ou reportée explicitement

## Dev Notes

**Le registre numérote deux fois.** `BUG-nn` est l'ordre de découverte,
`n° nn` l'ordre de priorité. L'AC parle en n° d'audit : 01 = BUG-04,
02 = BUG-01, 04 = BUG-20, 06 = BUG-03, 07 = BUG-21.

**Certains correctifs ont deux couches.** BUG-21 est arrêté à l'entrée
(`ownsDocumentUrl`) *et* à la sortie (`safeKey` dans `lib/storage.ts`) ;
la story 1.3 le disait explicitement. Muter une seule couche ne prouve
donc pas grand-chose : si la suite reste verte, il faut vérifier que
c'est bien l'autre couche qui a arrêté l'attaque, et non le test qui
dort.

**Le serveur est reconstruit à chaque mutation.** Compter environ
quarante secondes par passe : six mutations plus les vérifications de
retour font une dizaine de minutes de mesure. C'est le prix d'une preuve.

## Dev Agent Record

### Context Reference

`docs/qa/bug-report.md` (table de priorité, n° 01 à 07), les six stories
closes de l'épopée 1, `middleware.ts`, `app/api/**`.

### Implementation Plan

1. `tests/api-acces.spec.ts` — passe systématique + garde table/disque.
2. Six mutations, une par story close, suite complète à chaque fois.
3. Combler ce que l'audit trouve.

### Debug Log

**L'audit, mesuré. Six mutations, six exécutions complètes de la suite.**

| Story | Défaut remis dans le code | Mutation | Tests rougis |
|---|---|---|---|
| 1.2 | n° 02 · BUG-01 — email sensible à la casse | `.toLowerCase()` retiré d'`identityEmail` | **3** — « la connexion accepte n'importe quelle casse », « l'inscription enregistre en minuscules… », « le compte créé est retrouvé… » |
| 1.3 | n° 01 · BUG-04 — document lu sans session | garde `getApiAgency()` court-circuité + `/api/documents/` exclu du middleware | **3** — « le document de l'agence est servi à l'agence, et à elle seule », « une autre agence reçoit 404, jamais 403 », et la nouvelle passe `/api/*` |
| 1.4 | n° 04 · BUG-20 — en-tête forgé | `x-forwarded-for` relu en premier dans `callerIpFrom` | **3** — « un X-Forwarded-For forgé ne rouvre pas le budget », « une même adresse écrite autrement… », « le budget de dépôt est compté par agence » |
| 1.5 | n° 05 · BUG-02 — injection HTML dans les emails | `escapeHtml` rend sa chaîne telle quelle | **5** — tout le bloc BUG-02 |
| 1.6 | n° 06 · BUG-03 — formule dans un export CSV | `inerte()` ne neutralise plus rien | **5** — tout le bloc BUG-03 |
| 1.7 | n° 07 · BUG-21 — adresse de document | alphabet des segments rouvert à `[^/]+` | **0** ← |

**Le seul trou de l'épopée 1, et il ne se voyait pas.** La sixième
mutation n'a fait rougir **aucun** des quatre-vingt-douze tests.

En regardant pourquoi : les adresses forgées du test existant comptent
trois segments ou plus, donc elles échouent sur la **forme générale**,
que la mutation ne touchait pas. Celles à deux segments — `/uploads/
documents/../acte.pdf` — passaient bien le schéma desserré, mais étaient
arrêtées plus bas par `ownsDocumentUrl` (le segment d'agence ne
correspond pas), puis par `safeKey` (`lib/storage.ts` refuse « .. » après
décodage pourcent).

La défense en profondeur a donc tenu — c'est une bonne nouvelle — mais
**la couche la plus externe n'était tenue par rien** : on pouvait la
desserrer sans que la suite bronche. Trois couches dont une dort, c'est
deux couches ; et le jour où quelqu'un simplifie `safeKey` en s'appuyant
sur « le schéma valide déjà », les deux fusibles restants sautent
ensemble.

Comblé par un test **au niveau du schéma** (`documentSchema.safeParse`),
qui éprouve la couche seule, sans passer par celles qui la couvraient.
Vérifié : la même mutation le fait rougir sur cinq adresses.

**Deux exécutions consécutives ont échoué sur des connexions expirées**,
sur des tests différents et sans rapport. Ce n'est pas de la flakiness :
la suite est passée de 65 à 93 cas, chaque connexion vérifie un mot de
passe avec bcrypt (coût 12, volontairement lent), et le délai par défaut
d'un cas Playwright est de 30 s. Porté à 90 s, avec le motif écrit dans
la configuration. C'est un pansement assumé ; le vrai remède —
`storageState` enregistré une fois par rôle — est reporté.

### Completion Notes

**93 tests passés** (89 avant, +4 : trois pour la passe `/api/*`, un pour
le schéma d'adresse de document).

**Ce que l'audit prouve, et ce qu'il ne prouve pas.** Il prouve que
remettre le défaut d'origine de cinq des six stories closes fait rougir
au moins un test nommé. Il ne prouve pas que ces stories soient couvertes
« complètement » — une mutation par story éprouve un chemin, pas tous.
Une mutation qui passe est une preuve ; une mutation qui échoue n'est pas
un certificat.

**La story 1.1 n'entre pas dans l'audit.** Elle reste ouverte, reportée
par l'éditeur en connaissance de cause ; le suivi de sprint en porte la
trace. Un audit de couverture ne rouvre pas un arbitrage.

### File List

- `tests/api-acces.spec.ts` *(nouveau)*
- `tests/regression.spec.ts` *(test de schéma ajouté)*
- `playwright.config.ts` *(délai par cas)*
- `docs/stories/sprint-status.yaml`

### Review Findings

**1. Ma passe `/api/*` aurait été vraie sans rien prouver.** Seize routes
qui répondent 401 : une application entièrement en panne donnerait le
même vert. Un contrôle a été écrit en même temps — la sonde de santé
répond 200, l'inscription n'est pas arrêtée par le middleware — parce que
c'est la troisième story d'affilée où l'oubli du contrôle positif est le
défaut principal.

**2. Le garde table/disque était indispensable ici plus qu'ailleurs.**
Une route d'API ajoutée sans entrer dans la liste ne fait rougir personne
et n'a aucune couverture d'accès. La table est confrontée à
`app/api/**/route.ts(x)`, groupes de routes compris.

**3. Reporté : les tests d'inscription ne nettoient rien.** 164 agences
et 213 comptes se sont accumulés au fil du projet, tous créés par des
tests qui inscrivent une agence pour éprouver autre chose. Sans
conséquence sur les résultats aujourd'hui, mais la console de l'éditeur
s'allonge à chaque exécution — et le test du budget de dépôt y cherche
une ligne.

### Change Log

- 11-08-2026 — audit par mutation des six stories closes ; un trou trouvé et comblé.
- 11-08-2026 — passe systématique sur `/api/*`, garde table/disque, délai par cas relevé.
