# Story 1.4: Identifier l'appelant sur une valeur qu'il ne contrôle pas

Status: done

## Story

As a plateforme,
I want que la limitation de débit compte l'appelant sur une valeur qu'il ne peut pas écrire,
so that un en-tête forgé ne remette pas les compteurs à zéro.

**Couvre :** BUG-20 (défaut n° 04) · NFR-03
**Fichiers pressentis :** `lib/rate-limit.ts`, `nginx/nginx.conf`, `lib/env.ts`, `app/api/auth/register/route.ts`, `tests/regression.spec.ts`

## Le défaut, en une ligne

`ipFromHeader()` retient la **première** valeur de `X-Forwarded-For`.
nginx est configuré avec `$proxy_add_x_forwarded_for`, qui **ajoute**
l'adresse réelle **à la fin** de ce que le client a envoyé. La première
valeur est donc celle que l'appelant a choisie.

```
req 1..5  POST /api/auth/register                  → 400  (compteur consommé)
req 6     POST /api/auth/register                  → 429
          POST /api/auth/register  XFF: 9.9.9.1    → 400  compteur neuf
          POST /api/auth/register  XFF: 9.9.9.2    → 400  compteur neuf
```

Cinq points d'entrée comptent par adresse — tous perdent leur seuil par
adresse :

| Appelant | Clé | Seuil | Ce qui reste sans le seuil par adresse |
|---|---|---|---|
| `auth.ts:64` (connexion) | `login:ip:` | 60 / 15 min | le seuil par compte (10) — tient |
| `app/auth/login/actions.ts:37` | `explication:ip:` | 60 / 15 min | le seuil par compte (10) — tient |
| `app/auth/forgot/actions.ts:53` | *(ip + compte)* | 5 / h | le seuil par compte — tient |
| `app/api/auth/register/route.ts:54` | `inscription:` | 5 / h | **rien** |
| `app/vitrine/[slug]/actions.ts:33` | `vitrine:` | 5 / h | **rien** (un piège à robots trivial) |

Les deux dernières lignes sont le vrai dommage : inscriptions et messages
de vitrine en volume, sans aucun autre garde-fou applicatif.

Le `limit_req` de nginx (10 r/s sur `$binary_remote_addr`) reste valide —
le client ne contrôle pas cette variable. Mais il protège le serveur, pas
le métier : à 10 r/s on inscrit 36 000 agences à l'heure.

## Ce que je tranche, et pourquoi

**On cesse de lire `X-Forwarded-For`. Entièrement.**

C'est plus radical que la correction proposée par le registre (« inverser
l'ordre des deux lectures »), et c'est délibéré. `X-Forwarded-For` est une
**liste dont la longueur dépend de la topologie** :

- lire la première valeur est faux derrière un proxy qui ajoute à la fin ;
- lire la dernière est faux dès qu'il y a deux proxys ;
- lire n'importe laquelle est faux quand il n'y a **aucun** proxy — c'est
  le cas de la suite de tests, et ce sera le cas de tout déploiement sans
  reverse proxy.

Aucune de ces lectures n'est correcte sans connaître le nombre de sauts de
confiance. Ce nombre n'est écrit nulle part aujourd'hui, et le déduire est
exactement l'erreur d'indice qui a produit ce défaut.

`X-Real-IP` n'a pas ce problème : **une seule valeur, un seul auteur**.
`proxy_set_header X-Real-IP $remote_addr` **remplace** ce que le client a
envoyé — il n'ajoute pas. nginx la pose déjà aux trois emplacements
(`nginx.conf:95, 107, 120`), donc le comportement du trafic légitime ne
change pas.

**Le nom de l'en-tête devient une configuration**, `TRUSTED_IP_HEADER`,
défaut `x-real-ip`. Derrière Cloudflare on écrira `cf-connecting-ip` sans
retoucher le code. Deux valeurs sont traitées à part :

- `none` → l'appelant est toujours `inconnu`. C'est la posture juste quand
  l'application est exposée sans proxy : mieux vaut un compteur global
  qu'un compteur que le premier venu réinitialise.
- `x-forwarded-for` → **refusé au démarrage**. L'accepter serait promettre
  un comptage de sauts que ce code ne fait pas. Le refus est bruyant, pas
  silencieux.

**La valeur lue est validée comme adresse IP.** Sinon → `inconnu`. Trois
raisons : une valeur avec virgule (une liste) n'est pas une adresse et ne
doit pas devenir une clé ; les clés de compteurs vivent dans une `Map` en
mémoire, et une valeur libre permet d'en créer autant qu'on veut (fuite
lente, `sweep()` ne la rattrape qu'au bout d'une fenêtre) ; une valeur
libre entre telle quelle dans `login:ip:${ip}`.

## Ce que cette story NE ferme PAS

**Un appelant qui atteint le port 3000 directement contourne nginx et pose
`X-Real-IP` lui-même.** Le défaut est alors intact.

C'est BUG-22, story 2.1, et ce n'est pas un oubli : tant que
`docker-compose.prod.yml` publie `${APP_PORT:-3000}:3000`, **aucune**
identification par en-tête n'est fiable, quel que soit l'en-tête choisi.
La présente story rend l'identification correcte *derrière le proxy* ; la
2.1 rend le proxy obligatoire. Les deux sont nécessaires, dans cet ordre
ou dans l'autre.

Ce constat doit figurer dans le commentaire du module, pas seulement ici.

**La rotation d'adresses réelles** (botnet, réseau mobile) reste ouverte.
Compter par adresse ne peut pas y répondre ; il y faudrait une épreuve
(captcha, coût). Hors périmètre — à verser dans `deferred-work.md`.

## Acceptance Criteria

1. **Given** le budget d'inscription épuisé pour un appelant
   **When** il renvoie la même requête avec `X-Forwarded-For: 9.9.9.1`, puis `9.9.9.2`, puis `9.9.9.3`
   **Then** la réponse reste **429** à chaque fois — un en-tête posé par le client ne crée plus de compteur neuf

2. **Given** nginx en façade, qui pose `X-Real-IP` depuis `$remote_addr`
   **When** l'application identifie l'appelant
   **Then** elle retient cette valeur, et **uniquement** celle-là — `X-Forwarded-For` n'est plus lu par le code applicatif

3. **Given** un `X-Real-IP` qui n'est pas une adresse IP valide (liste, port, chaîne vide, texte libre)
   **When** l'appelant est identifié
   **Then** il vaut `inconnu` : aucune clé de compteur n'est fabriquée à partir d'une valeur libre

4. **Given** `TRUSTED_IP_HEADER=x-forwarded-for`, ou un nom d'en-tête syntaxiquement invalide
   **When** l'application démarre
   **Then** elle le refuse avec un message qui dit pourquoi — bloquant en production, avertissement en développement, comme tout `lib/env.ts`. Et quoi qu'il arrive, la lecture retombe sur `x-real-ip` : la configuration ne peut ni rouvrir le défaut ni faire lever la route

5. **Given** une agence dont les douze postes sortent par une seule adresse publique
   **When** tout le monde se connecte le lundi matin
   **Then** personne n'est bloqué : le seuil par adresse reste à 60 / 15 min, seul le seuil par compte est étroit (10). Aucun seuil n'est modifié par cette story

6. **Given** nginx en façade
   **When** il transmet la requête
   **Then** `X-Forwarded-For` ne contient plus que `$remote_addr` sur **les quatre** blocs qui relaient vers l'application, et l'en-tête reçu du client ne figure plus dans le format de journal

7. **Given** la suite de tests, qui inscrit quatre agences sur un budget de cinq par heure et par appelant
   **When** un test d'inscription est ajouté
   **Then** la suite ne casse pas : chaque test qui consomme le budget porte sa propre identité — à une exception, le test des valeurs invalides, dont l'objet même est de prouver le regroupement dans `inconnu` et qui sature donc ce compteur. L'exception est écrite en tête de ce test

8. **Given** une même machine, écrite `1.2.3.4`, `::ffff:1.2.3.4`, `::FFFF:1.2.3.4` ou `0:0:0:0:0:ffff:1.2.3.4`
   **When** elle épuise son budget sous une écriture
   **Then** elle reste refusée sous les autres : la validation ne se contente pas d'accepter la forme, elle ramène l'adresse à une écriture unique

## Tasks / Subtasks

- [x] **Tâche 1 — Identifier l'appelant sur un en-tête unique** (AC 2, 3)
  - [x] Remplacer `ipFromHeader(forwarded, real)` par une lecture d'un seul en-tête, nommé par `TRUSTED_IP_HEADER` (défaut `x-real-ip`)
  - [x] Valider la valeur comme IPv4 ou IPv6 ; toute autre forme → `inconnu`
  - [x] Traiter `none` : identification désactivée, tout le monde partage `inconnu`
  - [x] Réécrire le commentaire d'en-tête du module : pourquoi `X-Forwarded-For` n'est plus lu, et **ce que cette protection ne couvre pas tant que le port 3000 est publié**
  - [x] Adapter `callerIp()` (Server Actions) et le seul appelant de `ipFromHeader` (`app/api/auth/register/route.ts`) — une seule fonction pour les cinq points d'entrée

- [x] **Tâche 2 — Refuser une configuration qui rouvre le défaut** (AC 4)
  - [x] Dans `lib/env.ts`, refuser `TRUSTED_IP_HEADER=x-forwarded-for` avec un message explicite
  - [x] Avertir si la valeur n'est pas un nom d'en-tête plausible
  - [x] Documenter la variable dans `.env.example`

- [x] **Tâche 3 — Ne plus transmettre la liste du client** (AC 6)
  - [x] `nginx/nginx.conf` : `proxy_set_header X-Forwarded-For $remote_addr;` aux trois emplacements (`/api`, `/api/upload`, `/`)
  - [x] Commenter la condition qui obligera à revenir en arrière : l'ajout d'un CDN ou d'un second proxy en amont

- [x] **Tâche 4 — Prouver** (AC 1, 3, 5, 7)
  - [x] Test : budget d'inscription épuisé, puis trois `X-Forwarded-For` différents → 429 à chaque fois
  - [x] Test : les valeurs invalides ne sont pas retenues (exécution de la logique réelle, comme pour les adresses Supabase en 1.7)
  - [x] Donner une identité propre aux tests qui consomment le budget d'inscription (AC 7)
  - [x] Vérifier qu'aucun test existant ne régresse — la connexion et la vitrine passent par le même chemin
  - [x] **Mutation** : revenir à la lecture de `X-Forwarded-For` en tête de liste → le test d'AC 1 doit rougir. Une mutation qui casse la compilation ne prouve rien

- [x] **Tâche 5 — Consigner**
  - [x] `docs/qa/bug-report.md` : BUG-20 corrigé, avec la limite résiduelle (port 3000) écrite noir sur blanc
  - [x] `docs/stories/deferred-work.md` : la rotation d'adresses réelles
  - [x] `sprint-status.yaml`

## Dev Notes

**Le piège de la suite de tests.** Playwright attaque `next start` en
direct : ni nginx, ni `X-Real-IP`. Les quatre inscriptions existantes
(`tests/regression.spec.ts:381, 646 ×2, 666`) partagent donc déjà le
compteur `inscription:inconnu`, dont le budget est de **cinq par heure**.
La suite passe aujourd'hui avec une marge d'exactement une requête. Tout
test d'inscription supplémentaire la casse — c'est vrai avant cette story
comme après. D'où l'AC 7.

Le test d'AC 1 devra donc poser lui-même un `X-Real-IP` pour isoler son
compteur. Il faut écrire dans le test **pourquoi c'est possible** : parce
qu'il n'y a pas de proxy dans le harnais. C'est la démonstration en creux
de la limite résiduelle — ne pas la maquiller.

**Le compteur `inconnu` est un point de rassemblement.** Si `X-Real-IP`
venait à manquer en production, tout le trafic tomberait dans le même
compteur et l'inscription se fermerait à cinq par heure pour tout le
monde. C'est le comportement prudent — fermé plutôt qu'ouvert — mais il
faut le savoir. nginx pose l'en-tête aux trois emplacements, vérifié.

**Ne pas toucher aux seuils.** Ils ont été calibrés en connaissance de
cause (`auth.ts:29-31`, commentaires de `app/auth/login/actions.ts:34`).
Cette story corrige *qui* est compté, pas *combien*. Mélanger les deux
rendrait l'AC 5 invérifiable.

**`resetRateLimit`** est appelé après une connexion réussie
(`auth.ts`) — vérifier que le changement de clé ne laisse pas un compteur
orphelin.

### Rappels de projet

- Cloisonnement : `getApiAgency()` → `findFirst({ id, agencyId })` → 404, jamais 403
- Sortie attendue : `npx tsc --noEmit` 0 erreur, `npm run lint` 0 avertissement, `npm run test:e2e` vert
- Ne jamais restaurer une mutation par `git checkout -- <fichier>` : cela emporte le travail de la story (leçon de la 1.3)

## Dev Agent Record

### Debug Log

**`net.isIP` plutôt qu'une expression régulière écrite à la main.** Une
IPv6 correcte est longue à valider et facile à valider de travers. La
fonction de Node est stricte — vérifié en l'exécutant :

```
"1.2.3.4"           -> 4        "010.1.1.1"        -> 0   (zéro de tête)
"::1"               -> 6        "1.2.3.4, 5.6.7.8" -> 0   (une liste)
"::ffff:1.2.3.4"    -> 6        "1.2.3.4:80"       -> 0   (un port)
"2001:db8::1"       -> 6        "[::1]"            -> 0   (crochets)
                                "1.2.3.4 "         -> 0   (espace final)
```

Le refus des zéros de tête compte autant que le reste : `10.0.0.1` et
`010.0.0.1` sont la même machine et donneraient deux compteurs.

**AC 4 — prouvé en exécutant `checkEnvironment()` réellement**, en
`NODE_ENV=production`, une valeur par processus (le module ne s'exécute
qu'une fois) :

```
TRUSTED_IP_HEADER="x-forwarded-for"   -> DÉMARRAGE REFUSÉ
TRUSTED_IP_HEADER="X-Forwarded-For "  -> DÉMARRAGE REFUSÉ   (casse + espace)
TRUSTED_IP_HEADER="cf-connecting-ip"  -> autorisé
TRUSTED_IP_HEADER="none"              -> autorisé
TRUSTED_IP_HEADER="x real ip"         -> autorisé, avec avertissement
```

**AC 6 — prouvé à travers la vraie configuration nginx**, pas par
lecture. nginx lancé sur le fichier du dépôt (seul le port de l'amont a
été changé, le poste occupant déjà 3000), amont remplacé par un serveur
qui imprime ce qu'il reçoit :

```
le client envoie :  X-Forwarded-For: 9.9.9.1, 9.9.9.2
                    X-Real-IP: 6.6.6.6
l'amont reçoit   :  X-Forwarded-For: '172.17.0.1'
                    X-Real-IP: '172.17.0.1'
```

Rien de ce que le client a écrit n'atteint l'application. `nginx -t` sur
le fichier final : *syntax is ok, test is successful*.

**La limite résiduelle, constatée et non déduite.** Pendant ce travail,
le port 3000 était déjà pris — par `aqar-frontend-prod`, qui le publie :

```
aqar-frontend-prod   0.0.0.0:3000->3000/tcp
curl http://localhost:3000/api/public/health   -> 200
```

nginx n'est donc pas un passage obligé, et un appelant qui entre par là
pose l'en-tête de confiance lui-même. C'est BUG-22 / story 2.1, écrit
noir sur blanc dans le module et dans le registre.

**Mutations — deux, toutes deux tuées.** Chacune compile et passe le
lint : une mutation qui casse la compilation ne prouve rien (leçon de la
story 1.3).

1. Relecture de `X-Forwarded-For` en tête de liste, comportement d'avant
   la story → `X-Forwarded-For: 9.9.9.1 a rouvert un compteur`, attendu
   429, reçu 400. Le test d'AC 1 rougit.
2. Suppression du contrôle `isIP`, la valeur est retenue telle quelle →
   `codes : 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400`.
   Douze identités invalides, douze compteurs neufs. Le test d'AC 3
   rougit.

**Le piège du budget partagé, confirmé.** Les quatre inscriptions
existantes de la suite tombaient toutes dans `inscription:inconnu`, budget
cinq. Le test d'AC 3 en consomme douze à lui seul : sans l'AC 7, il
aurait fait échouer trois tests de la story 1.2 sans aucun rapport
apparent. Chaque test qui s'inscrit porte désormais son identité
(`identiteAppelant()`, préfixe de documentation 2001:db8::/32), et
l'identité du test d'AC 1 varie avec `testInfo.retry` pour survivre à une
reprise en intégration continue.

### Completion Notes

`X-Forwarded-For` n'est plus lu nulle part dans le code applicatif. Les
cinq points d'entrée qui comptent par adresse passent par une fonction
unique, `callerIpFrom(headers)`, dont `callerIp()` n'est plus qu'un
enrobage pour les Server Actions.

Aucun seuil n'a été modifié (AC 5) : cette story corrige *qui* est
compté, pas *combien*.

`ipFromHeader` a disparu — son seul appelant hors module était la route
d'inscription, qui devait lui passer deux en-têtes à la main. Une seule
lecture, un seul endroit.

Ce qui reste ouvert, et qui est dit dans le module comme dans le
registre : tant que le port applicatif est publié (BUG-22), l'en-tête de
confiance est posable par qui contourne nginx. Et la rotation d'adresses
réelles (botnet, réseau mobile) ne se traite pas par un compteur par
adresse — versé dans `deferred-work.md`.

### File List

- `lib/rate-limit.ts` — identification réécrite : en-tête unique configurable, validation `net.isIP`, `callerIpFrom` remplace `ipFromHeader`
- `lib/env.ts` — refus de `TRUSTED_IP_HEADER=x-forwarded-for`, avertissement sur un nom d'en-tête invalide
- `app/api/auth/register/route.ts` — passe par `callerIpFrom`
- `nginx/nginx.conf` — `X-Forwarded-For $remote_addr` aux trois emplacements, avec la condition de retour arrière
- `.env.example` — `TRUSTED_IP_HEADER` documentée
- `tests/regression.spec.ts` — `identiteAppelant()`, deux tests neufs, identité donnée aux trois inscriptions existantes
- `docs/qa/bug-report.md`, `docs/stories/deferred-work.md`, `docs/stories/sprint-status.yaml`

### Review Findings

Revue adversariale du 10-08-2026 (`bmad-code-review`) — Blind Hunter,
Edge Case Hunter, Acceptance Auditor, lancés sans mon contexte.
**0 décision, 9 correctifs, 6 reports, 1 écarté.** C'est la revue la plus
sévère des trois stories, et cinq constats portaient sur du code écrit le
jour même.

**1. Un nom d'en-tête mal orthographié faisait répondre 500 à toute
inscription.** `Headers.get("x real ip")` ne rend pas `null` — il **lève**
un `TypeError`. `enTeteDeConfiance()` renvoyait la valeur configurée sans
la valider, l'exception traversait `callerIpFrom` et tombait dans le
`catch` de la route, qui ne reconnaît qu'un `ZodError`. Mon propre journal
de débogage déclarait ce cas « autorisé, avec avertissement » : j'avais
vérifié que le démarrage passait, jamais ce qui arrivait ensuite. Le cas
n'est pas de laboratoire — `TRUSTED_IP_HEADER="none"` mal déguillemeté par
docker-compose transmet les guillemets dans la valeur et produit
exactement cette exception. Le nom est désormais validé, les guillemets
retirés, et toute valeur douteuse retombe sur `x-real-ip`.

**2. La garantie n'appartenait pas à l'en-tête, et je l'avais rendue
configurable sans son mécanisme.** J'ai recommandé `cf-connecting-ip`
derrière un CDN à trois endroits. Or nginx n'écrase que `X-Real-IP` et
`X-Forwarded-For` ; il ne supprime pas ce qu'il ne pose pas. Configurer un
autre nom sans ajouter la directive correspondante **rouvre BUG-20 à
l'identique** — l'appelant choisit son identité. Le principe « un en-tête
à un seul auteur » ne tient pas de l'en-tête, il tient de
`proxy_set_header`. L'avertissement le dit maintenant au démarrage, et
`.env.example` en fait une condition, pas une note.

**3. Un compteur par adresse restait remis à zéro par l'appelant, sans
aucun en-tête.** `auth.ts` faisait `keys.forEach(resetRateLimit)` après
une connexion réussie — donc effaçait aussi `login:ip:`. L'inscription
étant publique, un attaquant se créait un compte, essayait 59 mots de
passe contre 59 comptes cibles, se connectait une fois chez lui, et
repartait. La limite par adresse — seule défense contre la pulvérisation,
un essai sur beaucoup de comptes — ne se déclenchait jamais. Le titre de
mon commit annonçait « les compteurs ne se remettent plus à zéro » ; il
en restait un, et le plus important. Seul `login:compte:` est désormais
effacé.

**4. `isIP` valide la forme, il ne canonicalise pas — et mon commentaire
donnait la canonicalisation pour motif.** Vérifié en exécutant le module :
`1.2.3.4`, `::ffff:1.2.3.4`, `::FFFF:1.2.3.4`, `0:0:0:0:0:ffff:1.2.3.4`,
`::ffff:0102:0304`, `::ffff:102:304` — six clés pour une machine. Et le
zone-id est pire : `isIP` en accepte un de huit mille caractères, et `%0`,
`%00`, `%000` donnent trois clés distinctes. L'adresse est maintenant
ramenée à une écriture unique (minuscules, compression IPv6, zone-id
coupé, forme IPv4-mappée dépliée), et un test le prouve de bout en bout.

**5. `TRUSTED_IP_HEADER=none` était un déni de service que je
recommandais.** Le mode regroupait tous les appelants dans un compteur
unique, à seuils inchangés : **cinq inscriptions par heure pour toute la
plateforme**, cinq messages de vitrine pour toutes les agences, et
soixante-et-une requêtes suffisaient à fermer l'authentification. Mon
commentaire appelait cela « la posture juste quand l'application est
exposée sans proxy ». La valeur est supprimée. Le regroupement reste
possible par accident — en-tête absent — mais il est désormais signalé à
l'exécution au lieu d'être silencieux, et `.env.example` dit ce qu'il
coûte au lieu de le conseiller.

**6. La table de compteurs n'était bornée par rien, et le registre
affirmait le contraire.** J'avais écrit dans `bug-report.md` que le
contrôle de forme fermait « une table en mémoire que l'on fait grossir
sans limite ». Faux : `isIP` contraint la forme, jamais la cardinalité —
il y a 2¹²⁸ adresses IPv6 valides, et un /64 résidentiel suffit. Mesuré
par le relecteur : 500 000 clés → 94 Mo, et un balayage sur deux millions
d'entrées bloque la boucle d'événements **420 ms**, sur une requête
utilisateur quelconque. Un plafond de 50 000 compteurs a été posé. Au
plafond on refuse d'en **créer**, sans en évincer aucun : évincer
reviendrait à offrir à l'attaquant le moyen d'effacer le compteur de sa
victime — le défaut qu'on vient de fermer.

**7. Quatre blocs relaient vers l'application, pas trois.**
`location /_next/static` faisait un `proxy_pass` sans le moindre
`proxy_set_header` : l'en-tête du client y traversait intact. Rien n'y est
compté, donc rien n'était exploitable — mais l'invariant « nginx écrase
toujours » était faux du fichier, et un invariant faux quelque part ne
vaut nulle part. Les quatre blocs écrasent désormais.

**8. Le journal d'accès contenait toujours la liste forgée par le
client.** `log_format` reprenait `$http_x_forwarded_for`, qui est
l'en-tête **reçu** — `proxy_set_header` ne le modifie pas. L'AC 6 disait
« ni les journaux » : c'était faux. Le champ est retiré ; il n'apportait
plus qu'une adresse choisie par l'appelant, posée à côté de
`$remote_addr` sans rien qui les distingue.

**9. Mes propres tests affirmaient plus qu'ils ne prouvaient.** Trois
défauts, tous relevés :

- l'assertion finale du test d'AC 1 était **tautologique** : le corps
  étant invalide, la route répond 400 quoi qu'il arrive. Elle passait
  avec la limitation entièrement désactivée. Supprimée ;
- la liste des « douze identités invalides » en contenait une valide :
  `"9.9.9.5 "`. La fonction fait `.trim()` **avant** `isIP`. Mon tableau
  de preuve décrivait `net.isIP`, pas le code livré ;
- l'assertion « au moins un 429 » n'était **pas discriminante** : elle
  devenait triviale dès qu'un autre test avait entamé le compteur
  partagé, et une implémentation qui n'aurait regroupé que la moitié des
  valeurs l'aurait satisfaite. Elle compte maintenant les acceptations et
  exige qu'elles ne dépassent pas le budget — vrai quel que soit l'état
  antérieur du processus, et rouge dès qu'**une seule** valeur fabrique
  une clé.

Un garde-fou a été ajouté sur `nginx.conf` lui-même : la suite attaque
`next start` en direct, aucun test d'exécution ne peut donc prouver
l'AC 6, et un retour à `$proxy_add_x_forwarded_for` serait passé
inaperçu. Le test lit le fichier — c'est un garde de configuration, pas
une preuve de comportement, et il ne prétend pas l'être. Il a d'ailleurs
rougi sur mon propre commentaire d'explication avant d'apprendre à ignorer
les commentaires : un garde-fou qui punit la justification pousse à
effacer la justification.

**Écarté.** Le relecteur reprochait à la preuve de l'AC 6 de montrer
`172.17.0.1` — la passerelle Docker — et d'être donc « un cas
d'effondrement ». L'AC 6 énonce que nginx écrase ce que le client envoie ;
c'est exactement ce que la trace montre, quelle que soit la valeur
substituée. La réserve porte sur une autre propriété, celle du §5, qui est
traitée pour elle-même.

**Reportés** dans `deferred-work.md` : le verrouillage d'un compte par un
tiers (dix mots de passe faux par quart d'heure suffisent à bloquer une
adresse publiée sur une vitrine, et la voie de secours par
réinitialisation ferme aussi) ; la fenêtre fixe qui autorise le double du
budget à cheval sur sa frontière ; le court-circuit de `.some()` qui gèle
le compteur par compte dès que celui par adresse sature ; l'absence
d'échappement entre segments de clé ; le compteur `inconnu` non
instrumenté ; le magasin partagé (BUG-18).

Le premier de ces reports mérite d'être lu : ce n'est pas une subtilité,
c'est un moyen de bloquer n'importe quel utilisateur dont l'adresse est
publique.

## Change Log

| Date | Version | Description |
|---|---|---|
| 10-08-2026 | 0.1 | Story créée depuis `docs/epics.md` §1.4 et BUG-20 |
| 10-08-2026 | 1.0 | Implémentée. 79 tests verts, 2 mutations tuées. Statut → review |
