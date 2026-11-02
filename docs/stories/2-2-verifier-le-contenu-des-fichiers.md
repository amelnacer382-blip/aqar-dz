# Story 2.2: Vérifier le contenu réel des fichiers téléversés

Status: done

## Story

As a plateforme,
I want que le type d'un fichier soit établi par son contenu,
so that l'admission ne repose pas sur une déclaration de l'appelant.

**Couvre :** BUG-09 (défaut n° 08) · NFR-03
**Fichiers :** `app/api/upload/route.ts`, `lib/file-type.ts` (nouveau)

## Le défaut, tel qu'il est dans le code

`app/api/upload/route.ts` — deux manques distincts sous un seul numéro.

**1. Le type vient du client, et rien ne le contredit.**

```ts
if (!ALLOWED_TYPES.includes(file.type)) { … 400 … }
…
const ext = EXTENSION_BY_MIME[file.type] || "bin"
…
await putFile({ …, contentType: file.type })
```

`file.type` est l'en-tête `Content-Type` de la partie multipart. Il est
écrit par l'appelant, pas déduit du contenu. Une seule déclaration
décide donc de **trois** choses : l'admission, l'extension écrite sur le
disque, et le `Content-Type` sous lequel le fichier sera **re-servi**.

Le troisième point est celui que le registre ne dit pas et qui est le
plus lourd. En production le stockage est Supabase (`lib/storage.ts`) :
`contentType` est enregistré sur l'objet, et `getPublicUrl()` rend une
adresse servie par Supabase — pas par notre nginx, donc **sans** le
`X-Content-Type-Options: nosniff` de `nginx/nginx.conf`. La protection
citée dans le registre ne couvre que le mode local.

**2. Aucune limitation de débit.**

C'est la seule route qui écrive sur le disque, et la seule route
authentifiée sans compteur. Un compte compromis — ou une boucle
maladroite — remplit `uploads_data` sans rencontrer d'obstacle.

## Ce que je tranche, et pourquoi

### La déclaration du client ne sert plus à rien du tout

Pas « on compare le déclaré au réel ». **On jette le déclaré.**

Exiger l'accord des deux paraît plus sévère ; c'est une illusion. Un
attaquant maîtrise les deux côtés : il déclare exactement ce que son
contenu forgé annonce, et l'accord est obtenu. La comparaison n'arrête
donc personne — elle ne fait que **refuser des clients honnêtes** dont le
navigateur a étiqueté autrement (`image/jpg` contre `image/jpeg`,
`application/octet-stream` quand le système n'a pas d'association).

Conséquence pratique : `ALLOWED_TYPES` et `EXTENSION_BY_MIME` disparaissent
entièrement. L'extension et le `contentType` transmis à `putFile`
découlent tous deux de la signature reconnue.

### Signature à l'offset 0, sans tolérance

Quatre formats, quatre signatures :

| Type | Octets | Position |
|---|---|---|
| `image/png` | `89 50 4E 47 0D 0A 1A 0A` | 0 |
| `image/jpeg` | `FF D8 FF` | 0 |
| `image/webp` | `RIFF` … `WEBP` | 0 et 8 |
| `application/pdf` | `%PDF-` | 0 |

Le cas discutable est le PDF : la spécification tolère du remplissage
avant `%PDF-`, et Acrobat lit ces fichiers. **Je refuse cette tolérance.**
Accepter une signature à l'offset 4 revient à accepter que les quatre
premiers octets soient n'importe quoi — c'est-à-dire à ouvrir la porte
aux fichiers polyglottes, qui sont précisément la façon dont on contourne
un contrôle par signature. Les producteurs de PDF écrivent leur en-tête à
l'octet 0 ; le coût de ce refus est un cas de bord rare, et il est
explicite plutôt que silencieux.

`image/jpg` disparaît de la liste au passage : ce n'est pas un type MIME,
et il partait tel quel vers Supabase.

### Ce que ce contrôle ne fait PAS, et il faut l'écrire ici

**Il prouve les premiers octets, pas le fichier.** Un PNG authentique
peut contenir n'importe quoi après son en-tête — c'est exactement ainsi
que fonctionne un polyglotte. Ce que la story ferme : « un fichier
arbitraire est admis sur la seule parole du client ». Ce qu'elle ne ferme
pas : « un fichier réellement construit comme une image l'est aussi comme
autre chose ».

La fermeture de cette seconde classe est le **ré-encodage** de l'image
(`sharp`) — qui ne détruit que ce qui n'est pas de l'image, et qui est
impossible pour le PDF. C'est une autre story, et je la reporte
explicitement plutôt que de laisser croire que celle-ci la couvre.

### Budget : 40 dépôts par tranche de 10 minutes, par agence

La clé est `depot:<agencyId>`, consommée **après** le garde
d'authentification. Deux raisons, dont une qui n'est pas évidente :
un appelant sans session est refusé en 401 avant d'ouvrir un compteur,
donc la table de `lib/rate-limit.ts` ne peut pas être inondée par cette
route — le nombre de clés y est borné par le nombre d'agences, quand
`inscription:<ip>` est borné par le nombre d'adresses IP.

Le choix des chiffres, honnêtement :

- **Une fenêtre courte plutôt qu'une heure.** Ce compteur n'est pas le
  quota de disque et ne doit pas le devenir. Une agence qui charge son
  catalogue le jour de son arrivée touchera la limite ; qu'elle attende
  dix minutes est une gêne, qu'elle attende une heure est un appel au
  support.
- **40, parce qu'une galerie fait au plus 12 photos**
  (`GalleryUploadField`, `max = 12`). Trois galeries d'affilée passent.
  Une boucle de script, elle, est arrêtée en quelques secondes.
- **Fenêtre fixe : une rafale de 80 reste possible** à cheval sur deux
  fenêtres. C'est la propriété de `rateLimit()`, elle est connue, et elle
  ne change rien à l'ordre de grandeur.

Ce que ce budget **ne** fait pas : borner le disque. 40 × 5 Mo toutes les
dix minutes font 1,2 Go par heure et par agence. Il retire le cas « des
milliers de fichiers par minute » et laisse le temps de voir venir ; le
vrai remède est un quota de stockage, reporté.

### Un refus précoce sur la taille annoncée

`request.formData()` met **tout le corps en mémoire** avant qu'aucune de
nos vérifications ne s'exécute : un `App Router` n'a pas de `bodyParser.
sizeLimit`. `client_max_body_size 10M` de nginx couvre le chemin normal,
mais la story 2.1 a établi qu'un processus local joint le conteneur sans
passer par nginx.

J'ajoute donc un refus sur `Content-Length` **avant** le parsage. À dire
franchement : cet en-tête est lui aussi déclaratif, et cette story parle
justement de ne pas croire les déclarations. La différence tient au sens
du refus — on ne fait qu'**arrêter plus tôt** quelqu'un qui dit la
vérité. Un menteur qui annonce 1 Ko et en envoie 900 passe toujours, et
la vraie borne reste à poser ailleurs. Le gain n'est pas de sécurité, il
est de ressource et de confort : un utilisateur qui choisit une vidéo de
200 Mo reçoit une erreur immédiate au lieu de 200 Mo mis en tampon.

### Ce que je ne touche pas

- **BUG-13** (`maxSize` du sélecteur jamais appliqué, story 5.3) : la
  borne côté client. Le serveur borne déjà ; mélanger rendrait les deux
  corrections moins vérifiables.
- **BUG-18** (compteurs non partagés entre instances, story 5.6) : cette
  route hérite de la limite de portée écrite en tête de
  `lib/rate-limit.ts`, sans l'aggraver.

## Acceptance Criteria

1. **Given** un fichier texte annoncé `image/png`
   **When** il est envoyé à `/api/upload`
   **Then** il est refusé en 400, avec un message qui nomme le problème (le contenu, pas le nom ni le type annoncé)

2. **Given** un PNG authentique annoncé `application/pdf`
   **When** il est envoyé
   **Then** il est **accepté**, et l'adresse rendue se termine par `.png` — l'extension découle de la signature, pas de la déclaration

3. **Given** un JPEG, un PNG, un WEBP ou un PDF authentique
   **When** il est envoyé
   **Then** il est accepté

4. **Given** une agence qui dépasse 40 dépôts en dix minutes
   **When** elle en tente un de plus
   **Then** la route répond 429 avec un en-tête `Retry-After`, indépendamment de nginx

5. **Given** l'agence voisine
   **When** la première a épuisé son budget
   **Then** elle dépose normalement — le compteur est bien par agence

6. **Given** le `contentType` enregistré au stockage
   **When** un fichier est accepté
   **Then** c'est le type **reconnu**, jamais celui annoncé — c'est lui qui sera renvoyé par Supabase à la lecture

## Tasks / Subtasks

- [x] **1. `lib/file-type.ts` — reconnaissance par signature** (AC 1, 2, 3)
  - [x] `typeReconnu(octets: Uint8Array): TypeReconnu | null`, quatre signatures, offset 0
  - [x] `EXTENSION_PAR_TYPE` : la seule table qui décide d'une extension
  - [x] Tests unitaires (table de cas écrite en octets littéraux, **pas** dérivée des constantes du module)

- [x] **2. `app/api/upload/route.ts` — le contenu décide** (AC 1, 2, 3, 6)
  - [x] Supprimer `ALLOWED_TYPES` et `EXTENSION_BY_MIME`
  - [x] `file instanceof File` plutôt qu'un cast
  - [x] Détection après lecture du tampon ; refus 400 nommant le contenu
  - [x] `ext` et `contentType` issus du type reconnu

- [x] **3. Limitation de débit par agence** (AC 4, 5)
  - [x] `rateLimit({ key: 'depot:<agencyId>', limit: 40, windowMs: 10 min })` après le garde
  - [x] 429 + `Retry-After`, message par `retryMessage()`

- [x] **4. Refus précoce sur `Content-Length`**
  - [x] Avant `formData()`, même message que la borne de taille réelle
  - [x] Contrôle réel maintenu sur `buffer.length` après lecture

- [x] **5. Tests de régression** (tous AC)
  - [x] Table unitaire sur `typeReconnu`
  - [x] E2E : texte annoncé PNG → 400
  - [x] E2E : PNG annoncé PDF → 200 et `.png`
  - [x] E2E : budget épuisé sur une agence **fraîchement inscrite puis activée** → 429, et l'agence de démonstration dépose toujours

- [x] **6. Vérification par mutation**
  - [x] Retirer la détection → le test de contenu doit rougir
  - [x] Rendre l'extension à `file.type` → le test PNG/PDF doit rougir
  - [x] Retirer le `rateLimit` → le test 429 doit rougir

## Dev Notes

**Le test de budget ne doit pas s'exécuter sur l'agence de démonstration.**
`playwright.config.ts` a `fullyParallel: true` et le compteur vit dans la
mémoire du serveur : épuiser le budget de `agence-demo` affamerait les
sept appels à `createDocument()` et le test de photo, qui tournent en
parallèle. Le test inscrit donc une agence à lui, la fait activer par le
super admin (`/admin/agencies`, formulaire `status=active`), et travaille
dessus. Bénéfice second : cela prouve l'AC 5 au lieu de la supposer.

`attente@aqar.dz` **n'est pas** utilisable : deux tests dépendent de son
statut `pending` (lignes 108 et 119).

**Épuiser le budget sans écrire 41 fichiers.** Le compteur est consommé
avant toute validation du corps : 41 requêtes portant `type: "invalide"`
sont refusées en 400 au contrôle de dossier, sans lecture de tampon ni
écriture disque, et consomment le budget. Même procédé que les tests
d'inscription de la story 1.4.

**Cohérence des messages.** Les deux composants clients
(`UploadDropzone`, `GalleryUploadField`) affichent `data.error` tel quel :
le message du 400 et celui du 429 sont lus par un utilisateur, pas par un
script.

**Le harnais n'a pas de proxy** : `identiteAppelant()` est nécessaire dès
qu'un test s'inscrit, sinon il tombe dans `inscription:inconnu`.

## Dev Agent Record

### Context Reference

`docs/qa/bug-report.md` (BUG-09), `docs/epics.md` (story 2.2),
`app/api/upload/route.ts`, `lib/storage.ts`, `lib/rate-limit.ts`,
`nginx/nginx.conf`, `components/upload/*`.

### Implementation Plan

1. `lib/file-type.ts` — quatre signatures, offset 0, table d'extensions.
2. Route : le contenu décide de l'admission, de l'extension et du
   `contentType` stocké ; la déclaration n'est plus lue.
3. `rateLimit()` par agence, après le garde.
4. Refus précoce sur `Content-Length`.
5. Quatre tests, puis trois mutations.

### Debug Log

**Une découverte pendant l'écriture, qui a changé la gravité.** Le
registre présentait le défaut comme borné (« nginx sert ces fichiers avec
`X-Content-Type-Options: nosniff` »). En lisant `lib/storage.ts` j'ai vu
que `contentType: file.type` est **enregistré sur l'objet Supabase** et
renvoyé par `getPublicUrl()` — c'est-à-dire par un domaine tiers, sans
notre `nosniff`. La déclaration du client ne décidait donc pas seulement
de l'admission : elle décidait sous quel type le fichier serait re-servi
en production. C'est la ligne la plus importante du diff, et elle ne
figurait dans aucune AC.

**Une mutation qui n'a rien prouvé, et pourquoi je le note.** La
troisième mutation (`if (false && !budget.ok)`) a d'abord fait **échouer
la construction** : l'import `TypeReconnu`, ajouté pour les deux mutations
précédentes, était devenu inutilisé et `@typescript-eslint/no-unused-vars`
est une erreur ici. Une mutation qui casse la compilation ne prouve rien
— c'est la leçon de la story 1.3. Import retiré, mutation relancée, test
rouge pour la bonne raison.

**Ce que j'ai vérifié avant d'écrire le test de budget.** `fullyParallel:
true` et un compteur en mémoire : épuiser le budget de `agence-demo`
aurait affamé les sept appels à `createDocument()` et le test de photo,
qui tournent en même temps. `attente@aqar.dz` n'était pas utilisable non
plus — deux tests dépendent de son statut `pending` (lignes 108 et 119).
D'où l'inscription d'une agence propre au test, activée par le super
admin. Le détour est payant : il transforme une supposition (« le
compteur est par agence ») en assertion.

**Firefox et WebKit ne sont pas installés** sur cette machine
(`npx playwright install` jamais lancé pour ces moteurs). Les mesures
ci-dessous portent sur `--project=chromium`, comme les stories
précédentes.

### Completion Notes

**103 tests passés** (99 avant, +4). Trois mutations tuées :

| Mutation | Test devenu rouge |
|---|---|
| `typeReconnu(buffer) ?? (file.type as TypeReconnu)` | « un fichier texte annoncé image/png est refusé » |
| `ext` repris de `file.type` | « un PNG annoncé application/pdf est accepté, et rangé en .png » |
| `if (false && !budget.ok)` | « le budget de dépôt est compté par agence » |

Chaque mutation n'a tué qu'un seul test : les trois assertions portent
bien sur trois propriétés distinctes.

**Ce que la story ne couvre pas, dit ici plutôt que découvert plus tard :**

- Le contrôle porte sur les **premiers octets**, pas sur le fichier. Un
  polyglotte construit comme une vraie image passe. Fermeture réelle : le
  ré-encodage — reporté.
- Le budget **ne borne pas le disque** : 1,2 Go/h/agence au pire. Il
  retire le cas « milliers de fichiers par minute ». Un quota reste à
  poser — reporté.
- Le refus sur `Content-Length` n'est **pas** une borne : un menteur
  passe. C'est un arrêt précoce, pas une garantie.

### File List

- `lib/file-type.ts` *(nouveau)*
- `app/api/upload/route.ts`
- `tests/regression.spec.ts`
- `docs/qa/bug-report.md`
- `docs/stories/sprint-status.yaml`

### Review Findings

Revue adversariale du 11-08-2026. Six constats, trois corrigés dans le
commit de suivi, trois reportés.

**1. Une vérification morte qui se donnait le nom de garde-fou.**
`app/api/upload/route.ts` — je faisais `file.size > MAX_SIZE` **puis**
`buffer.length > MAX_SIZE`, en présentant le second comme « le contrôle
réel, parce que c'est cette longueur-là qui part au stockage ». C'était
faux : `file.size` est le nombre d'octets que l'analyseur multipart a
réellement lus, et il n'existe aucun cas où les deux diffèrent. Le code
ne trompait personne sur son résultat, le commentaire si — et un lecteur
qui aurait voulu simplifier aurait supprimé le mauvais des deux. Retiré,
avec la raison écrite à sa place.

**2. Mon test de budget ne vérifiait que « il y a un refus quelque
part ».** `tests/regression.spec.ts` — l'assertion était
`expect(refus).toBeGreaterThan(0)`. Un budget silencieusement ramené à 5
l'aurait passée en bloquant les agences honnêtes ; porté à 30, elle
l'aurait passée aussi. Le test ne défendait donc pas le chiffre qu'un
tiers de la story argumente. Remplacée par `toBe(41)`, avec le motif :
épingler une constante de **comportement** est légitime — ce qui ne
l'est pas, et que je m'étais fait reprendre en story 1.6, c'est de
recopier la **logique** de l'implémentation.

**3. `Retry-After` n'avait pas de borne haute.** Même test. Toute la
justification du budget repose sur « dix minutes et pas une heure » ;
l'assertion acceptait 3600. Borne ajoutée à 600.

**4. Une mutation qui n'a rien prouvé, et que j'ai failli compter.** La
troisième mutation a d'abord fait échouer la **construction** — un import
devenu inutilisé, refusé par ESLint. Une mutation qui casse la
compilation ne dit rien du test : c'est la leçon de la story 1.3, et je
l'ai reproduite. Corrigée puis relancée ; le rouge obtenu ensuite est
valide.

**5. L'AC 3 est couverte moins complètement que sa formulation.** Elle
dit « un JPEG, un PNG, un WEBP ou un PDF authentique est accepté ». Le
JPEG et le WEBP ne sont éprouvés qu'au niveau **unitaire**
(`typeReconnu`), pas de bout en bout par la route. Le PNG l'est, le PDF
l'est par `createDocument()`. Le risque résiduel est mince — la route
n'a qu'un chemin d'admission — mais l'écart est réel et je préfère
l'écrire que le laisser croire couvert.

**6. La liste des types admis n'est pas découpée par dossier.** Un PDF
authentique déposé avec `type: "properties"` est accepté et rangé dans le
dossier public des photos, où il sera rendu dans une balise `<img>`. Le
défaut est **antérieur** — `application/pdf` figurait dans
`ALLOWED_TYPES` sans distinction de dossier — et cette story ne
l'aggrave pas. Il n'est pas trivial à fermer : `DocumentUploadField`
accepte `.pdf,.jpg,.jpeg,.png,.webp`, un contrat scanné en JPEG étant
parfaitement légitime. C'est un problème de qualité d'affichage, pas de
sécurité. Reporté.

### Change Log

- 11-08-2026 — story créée, implémentée, testée (103 verts), 3 mutations tuées.
- 11-08-2026 — revue adversariale : 3 correctifs appliqués, 3 constats reportés.
