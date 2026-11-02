# Story 1.6: Neutraliser les formules dans les exports CSV

Status: done

## Story

As a agent d'agence,
I want ouvrir un export sans qu'une cellule s'exécute,
so that un message reçu par la vitrine ne devienne pas une commande sur mon poste.

**Couvre :** BUG-03 (défaut n° 06) · NFR-02
**Fichier :** `lib/csv.ts` (`escape`)

## Le défaut

`escape()` gère le séparateur, les guillemets et les sauts de ligne. Elle
ne gère pas la valeur qui **commence par** `=`, `+`, `-`, `@`, une
tabulation ou un retour chariot : Excel et LibreOffice traitent alors la
cellule comme une formule — **y compris entre guillemets**, le déquotage
ayant lieu avant l'évaluation.

```
2026-08-09;"=HYPERLINK(""http://evil.test"",""Cliquez"")";=1+1;0555000000
```

Ce qui rend le défaut sérieux ici plutôt que théorique : les `leads`
viennent du **formulaire public de la vitrine**. L'attaquant n'a besoin
d'aucun compte. Il remplit un formulaire de contact et attend que l'agence
exporte ses messages — geste courant, sur un poste Windows.
`=cmd|'/C calc'!A0` s'exécute après une boîte de dialogue que les
utilisateurs valident par habitude.

Les huit entités exportables sont concernées ; seuls les messages ont un
vecteur d'injection *public*.

## Ce que je tranche, et pourquoi

**Le préfixe ne s'applique qu'aux chaînes, jamais aux nombres ni aux
dates.**

C'est le seul vrai piège de cette story, et le registre ne le mentionne
pas. `-` figure dans la liste des caractères dangereux. Préfixer sans
distinguer le type transformerait **tout montant négatif** en texte :
`-500` deviendrait `'-500`, et la colonne des paiements cesserait de
s'additionner dans Excel. Un correctif de sécurité qui casse la
comptabilité d'une agence ne tiendra pas une semaine.

`app/api/export/[entity]/route.ts` convertit déjà les décimaux avec
`Number(...)` (`:99`, `:140`, `:195`) : le test `typeof value === "string"`
suffit à séparer les deux mondes. Les dates passent par
`toISOString()` et ne commencent jamais par un caractère dangereux.

**L'apostrophe reste visible dans certains tableurs, et c'est assumé.**
Excel masque l'apostrophe de tête quand elle marque une valeur textuelle,
mais son import CSV n'est pas régulier là-dessus selon les versions, et
LibreOffice l'affiche. Le compromis est une apostrophe visible dans une
cellule contre l'exécution d'une commande sur le poste d'un agent. C'est
aussi le remède que le registre prescrit et que la spec d'épopée exige
mot pour mot.

**On teste le premier caractère brut, pas la valeur détourée.** Une
valeur commençant par une espace n'est pas interprétée comme formule par
les tableurs — c'est même le contournement classique. Détourer avant de
tester ajouterait des apostrophes sans rien fermer.

## Acceptance Criteria

1. **Given** une valeur texte commençant par `=`, `+`, `-`, `@`, une tabulation ou un retour chariot
   **When** `escape()` la traite
   **Then** elle est préfixée d'une apostrophe et ressort inerte

2. **Given** un nombre négatif — le montant d'un paiement, une commission
   **When** il est exporté
   **Then** il reste un nombre : aucun préfixe, la colonne s'additionne toujours

3. **Given** les huit entités exportables
   **When** la correction est appliquée dans `lib/csv.ts`
   **Then** elle les couvre toutes sans modifier un seul des huit appelants

4. **Given** un accent, un point-virgule ou un saut de ligne dans une valeur
   **When** le fichier est ouvert dans Excel en locale française
   **Then** l'affichage reste correct — ni le BOM ni le guillemetage ne sont cassés

5. **Given** une valeur dangereuse contenant AUSSI un point-virgule ou un guillemet
   **When** elle est échappée
   **Then** l'apostrophe est **à l'intérieur** des guillemets, et le guillemetage reste valide

6. **Given** un message posté sur la vitrine publique contenant `=HYPERLINK(...)`
   **When** l'agence exporte ses messages
   **Then** la cellule sort inerte — vérifié sur l'export réel, pas seulement sur la fonction

## Tasks / Subtasks

- [x] **Tâche 1 — Neutraliser** (AC 1, 2, 3, 5)
  - [x] `lib/csv.ts` : préfixe d'apostrophe sur les chaînes commençant par un caractère dangereux
  - [x] N'appliquer le préfixe qu'aux chaînes — ni nombres, ni dates
  - [x] Poser le préfixe avant le guillemetage, pas après
  - [x] Documenter le compromis de l'apostrophe visible

- [x] **Tâche 2 — Prouver** (AC 1, 2, 4, 5, 6)
  - [x] Tests sur `escape` via `toCsv` : chaque caractère de la liste, un nombre négatif, une valeur mixte
  - [x] Test de bout en bout : un message hostile posté sur la vitrine, puis l'export réel téléchargé et inspecté
  - [x] **Mutation** : retirer le préfixe → les tests doivent rougir. Une mutation qui casse la compilation ne prouve rien

- [x] **Tâche 3 — Consigner**
  - [x] `docs/qa/bug-report.md` (BUG-03), `sprint-status.yaml`, `deferred-work.md` si besoin

## Dev Notes

**L'export réel est atteignable depuis la suite.** `GET /api/export/leads`
répond un CSV en clair : contrairement aux emails, le test de bout en bout
est ici possible et il faut le faire. C'est ce qui manquait à la
story 1.5, et c'est reproché à raison dans son rapport de revue.

Le chemin : créer un message via le formulaire public de la vitrine
(`app/vitrine/[slug]/actions.ts`), puis se connecter comme agence et
appeler la route d'export. Un test existant montre déjà comment poster sur
la vitrine.

**Ne pas toucher au BOM ni au séparateur.** Les deux sont là pour Excel en
locale française, et le commentaire de tête de `lib/csv.ts` explique
pourquoi. L'AC 4 est une non-régression, pas une évolution.

### Rappels de projet

- Sortie attendue : `npx tsc --noEmit` 0 erreur, lint sans avertissement nouveau, suite complète verte
- Ne jamais restaurer une mutation par `git checkout -- <fichier>`
- Une mutation qui ne compile pas ne prouve rien

## Dev Agent Record

### Debug Log

**Le piège du tiret, vérifié plutôt que supposé.** `app/api/export/[entity]/route.ts`
convertit les décimaux avec `Number(...)` aux lignes 99, 140 et 195 : les
montants arrivent donc dans `escape()` comme des **nombres**, pas comme
des chaînes. Le test `typeof value === "string"` les laisse intacts. Test
dédié : `-500;2026-08-11`, sans apostrophe.

**Mutation — tuée sur le test de bout en bout.** En rendant la
neutralisation inopérante (mutation qui compile et passe le lint),
l'export réel rend :

```
2026-08-11;Formule;Sofia;+213 770 555 111;;Bureau 60 m² — Chéraga;nouveau;
"=HYPERLINK(""http://evil-…test"",""Cliquez"")"
```

C'est la **même forme** que la ligne du registre — pas la même ligne :
l'export des messages a huit colonnes et une autre date. J'avais écrit
« mot pour mot », c'était faux et la revue l'a relevé. Avec le correctif,
la cellule sort `"'=HYPERLINK(…`.

**Le test de bout en bout existe ici, contrairement à la story 1.5.**
L'export est une route HTTP qui rend le fichier en clair : le chemin
complet — formulaire public de la vitrine, base, export authentifié — est
vérifiable sans harnais particulier. C'est précisément ce que la revue de
la 1.5 reprochait, et ce qui était impossible là-bas.

### Completion Notes

Une seule fonction touchée, huit exports couverts, aucun appelant
modifié.

Le point délicat n'était pas l'échappement mais son **périmètre** : le
tiret figure dans la liste des caractères dangereux, et l'appliquer sans
distinguer le type aurait transformé tout montant négatif en texte. Un
correctif de sécurité qui casse la colonne des paiements d'une agence ne
tient pas une semaine. Le préfixe ne s'applique qu'aux chaînes.

L'apostrophe reste visible dans certains tableurs. C'est le remède que le
registre prescrit et que la spec d'épopée exige mot pour mot ; le
compromis est écrit dans le fichier.

### File List

- `lib/csv.ts` — `DEBUT_DE_FORMULE`, `inerte`, appliqué aux seules chaînes avant le guillemetage
- `tests/regression.spec.ts` — cinq tests, dont un de bout en bout sur l'export réel
- `docs/qa/bug-report.md`, `docs/stories/sprint-status.yaml`

### Review Findings

Revue adversariale du 11-08-2026 (`bmad-code-review`) — Blind Hunter et
Acceptance Auditor, lancés sans mon contexte. **0 décision, 8 correctifs,
2 reports, 0 écarté.**

**1. Je cassais la colonne Téléphone de trois exports.** Le constat est
d'autant plus net que **tout mon raisonnement portait dessus** : j'avais
écrit qu'un correctif de sécurité qui casse une colonne métier ne tient
pas une semaine, puis j'avais illustré le danger avec `-500` — une valeur
qui n'a jamais été menacée, puisqu'elle arrive comme un *nombre*. La
chaîne réellement exposée était le numéro de téléphone :
`optionalPhone` autorise le `+` de tête, le jeu de démonstration n'en
contient pas d'autre forme, et trois exports portent cette colonne.
Vérifié : `"+213 770 555 111"` sortait `'+213 770 555 111`.

Corrigé par une exemption étroite, et sûre par construction plutôt que
par confiance : une chaîne commençant par `+` ou `-` et composée
uniquement de chiffres, d'espaces, de points, de parenthèses et de tirets
ne peut nommer **ni fonction, ni cellule, ni commande DDE** — tous
exigent une lettre. `=`, `@`, la tabulation et les retours à la ligne ne
sont jamais exemptés. Frontière prouvée par mutation : en élargissant
l'exemption d'un seul caractère (`$` retiré de l'ancre), `+A1` et
`+cmd|'/C calc'!A0` passent, et le test rougit.

**2. `\n` manquait dans la liste alors que `\r` y était.** Ma propre
justification — le tableur retire le caractère de contrôle de tête avant
d'évaluer — s'applique mot pour mot aux deux. Un message posté depuis le
`<textarea>` de la vitrine peut trivialement commencer par un saut de
ligne. Ajouté.

**3. Une de mes deux assertions de bout en bout était vide de sens.**
`not.toContain(";=HYPERLINK(")` ne peut jamais échouer : la charge
contient des guillemets, donc la cellule est guillemetée **avec ou sans**
le correctif, et cette sous-chaîne est inatteignable dans les deux
mondes. Remplacée par une assertion sur la colonne Téléphone — celle que
la neutralisation abîmait.

**4. Mon test principal était incapable de détecter une liste
incomplète.** Il itérait sur `DANGEREUX`, recopie littérale de la classe
de caractères du module : il vérifiait seulement que l'implémentation est
d'accord avec elle-même, alors que le risque propre à ce défaut **est**
l'incomplétude de la liste. Remplacé par huit charges d'exécution réelles
(`HYPERLINK`, DDE sous trois formes, référence de cellule, les trois
caractères de contrôle), plus des cas négatifs explicites.

**5. Mon test d'AC 4 ne passait que des valeurs qui ne déclenchent pas le
préfixe.** Il vérifiait donc le comportement d'avant la story, pas son
interaction avec elle. Il combine maintenant une charge, un accent, un
point-virgule et un saut de ligne dans la même cellule.

**6. Mon nouveau test a fait passer la suite de deux à trois envois de
formulaire par exécution.** Le formulaire public est limité à cinq par
heure et par appelant, comptés en mémoire du processus — et
`reuseExistingServer` conserve ce serveur entre deux exécutions. Une
seconde passe dans l'heure faisait donc échouer un test, avec un
diagnostic trompeur. Les trois tests concernés portent désormais leur
propre identité, via le helper introduit par la story 1.4. C'est ma
propre story 1.4 qui a rendu ce compteur partagé plus contraignant ; il
fallait en tirer les conséquences ici.

**7. J'attribuais à `escape()` une compétence qui appartient au
typage.** Le commentaire disait que « les deux mondes se séparent
proprement sur le type ». En réalité `escape()` ne sait pas traiter un
`Prisma.Decimal` : la branche `object` le rendrait `"""-500"""`, une
cellule corrompue. Ce qui garantit la séparation, c'est la signature de
`toCsv`, qui exclut `Decimal` — un appelant qui oublierait `Number()` ne
compilerait pas. Le commentaire le dit maintenant, avec l'avertissement
qui va avec.

**8. Mon recensement était partiel et je l'affirmais complet.** J'ai
écrit que la route convertit les décimaux « aux lignes 99, 140 et 195 ».
Il y a **neuf** sites de conversion. Et j'avais dit « mot pour mot la
ligne du registre » d'une ligne qui n'a ni le même nombre de colonnes ni
la même date — même forme, pas même ligne.

**Reportés** dans `deferred-work.md` : aucun test ne couvre les sept
autres entités exportables (la couverture est démontrée par lecture, pas
par la suite) ; et chaque exécution laisse en base un message hostile
jamais nettoyé.

## Change Log

| Date | Version | Description |
|---|---|---|
| 11-08-2026 | 0.1 | Story créée depuis `docs/epics.md` §1.6 et BUG-03 |
| 11-08-2026 | 1.0 | Implémentée. Statut → review |
| 11-08-2026 | 1.1 | Revue adversariale : 8 correctifs, dont une régression sur la colonne Téléphone. Suite complète à 97 tests, 2 mutations tuées. Statut → done |
