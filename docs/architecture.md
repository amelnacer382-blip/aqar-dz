# Architecture réelle — Aqar DZ

> **Document brownfield.** Il décrit le système *tel qu'il est* au 9 août 2026,
> pas tel qu'il devrait être. Les écarts avec `CONTEXT.md` sont signalés
> explicitement : ce sont eux qui coûtent du temps à qui reprend le code.
>
> Établi par lecture intégrale de `lib/`, `app/api/`, des 31 Server Actions,
> du schéma Prisma et de la configuration de déploiement. Vérifications
> dynamiques faites sur l'instance Docker locale.

---

## 1. Ce que fait le logiciel

SaaS multi-locataire de gestion d'agences immobilières pour le marché
algérien. Chaque agence dispose d'un espace privé cloisonné et d'une
vitrine publique consultable sans compte.

Trois rôles, hiérarchisés :

| Rôle | Portée | Rattachement |
|------|--------|--------------|
| `super_admin` | Toutes les agences | `agencyId = null` |
| `agency_admin` | Son agence, tous les modules | `agencyId` obligatoire |
| `agent` | Son agence, sans suppression ni gestion des comptes | `agencyId` obligatoire |

**Point important, non documenté ailleurs :** un `super_admin` n'a
*aucun* accès à l'espace agence. `requireAgency()` le renvoie vers
`/admin` — sur le rôle **lu en base**, et depuis la revue de la story 1.8
c'est la seule couche qui en décide ; le middleware ne lit plus le rôle du
tout (§5). Le commentaire de `requireAgencyAdmin()` affirme le contraire —
il est faux, et sa branche `super_admin` n'a jamais rien autorisé
(voir BUG-10, story 5.1).

---

## 2. Pile technique effective

| Couche | Choix | Version |
|--------|-------|---------|
| Framework | Next.js App Router | 14.2.35 |
| Langage | TypeScript strict | 5.x |
| ORM | Prisma | 5.x |
| Base | PostgreSQL | 16 |
| Auth | NextAuth v5 (beta) + PrismaAdapter, stratégie JWT | 5.0.0-beta |
| Validation | Zod | 3.x |
| UI | Tailwind + shadcn/ui + Framer Motion | — |
| PDF | `@react-pdf/renderer` | 3.x |
| Images | `next/image` + `sharp` | 0.35.x |
| Tests | Playwright (E2E uniquement) | 1.60 |

**`sharp` n'est pas facultative, et c'est mesuré** (story 3.7). `next/image`
la charge par un `require` dynamique ; sans elle, Next retombe sur Squoosh —
**sauf en sortie autonome**, la nôtre, où il lève une 500
(`next/dist/server/image-optimizer.js:665`). L'image Docker la recopie donc
explicitement, comme le client Prisma et pour la même raison : un `require`
dynamique que l'analyse statique de `.next/standalone` ne voit pas toujours,
et dont l'oubli ne se remarque qu'à la première image demandée.

**Une seule balise `<img>` subsiste** dans le produit — l'aperçu de
`UploadDropzone`, une URL `data:` que le serveur n'a jamais vue. Toutes les
autres passent par `next/image`. `tests/images.spec.ts` garde trois
propriétés : les photos traversent `/_next/image`, elles occupent
réellement la boîte de leur conteneur (une image en `fill` dont le parent
perd son `relative` **charge quand même** et recouvre l'écran), et le
bandeau de la vitrine reste visible **sans JavaScript**.

**Écart avec `CONTEXT.md` :** la documentation annonce « NextAuth v5 +
Supabase Auth comme provider » et TanStack Query. Ni l'un ni l'autre n'est
utilisé. L'authentification repose sur un unique provider `Credentials`
avec bcrypt (`auth.ts`), et Supabase ne sert que de stockage de fichiers
optionnel (`lib/storage.ts`). `@tanstack/react-query` est installé mais
importé nulle part : les données transitent par les Server Components.

---

## 3. Le cloisonnement multi-locataire

C'est la propriété la plus critique du système. Elle est tenue par un
**motif appliqué sans exception** dans les 31 Server Actions et les
12 routes API examinées :

```ts
// 1. La garde donne l'agencyId depuis la session — jamais depuis le formulaire
const { agencyId } = await requireAgency()

// 2. On vérifie que la ligne visée appartient à cette agence
const owned = await prisma.payment.findFirst({
  where: { id, agencyId },
  select: { id: true },
})
if (!owned) redirect(withError(BASE, "Paiement introuvable"))

// 3. Seulement ensuite, on écrit
await prisma.payment.update({ where: { id }, data: { ... } })
```

**Aucune fuite inter-agences n'a été trouvée**, et la relecture du 12 août
2026 le confirme sur les 31 Server Actions. À ne pas confondre avec la
**séparation des rôles**, qui est une autre propriété et qui est tenue
ailleurs — voir l'inventaire du §4. Les identifiants relationnels
postés dans les formulaires (propriétaire d'un bien, client d'une vente,
liens d'un paiement) sont systématiquement re-vérifiés — voir
`app/agency/payments/verify-links.ts`, qui existe précisément pour ça.

Deux mécanismes centralisent ce qui pourrait être oublié ligne à ligne :

- **Suppression réversible** (`lib/prisma.ts`) : une extension du client
  Prisma ajoute `deletedAt: null` à toutes les lectures de `Property`,
  `Client` et `Owner`. Le filtre est posé une fois, pas dans 72 requêtes.
- **Sérialisation** (`lib/serialize.ts`) : `toPlain()` convertit
  récursivement les `Decimal` en `number` avant la frontière
  serveur → client.

---

## 4. Cartographie du code

```
app/
├── (public)          page.tsx, vitrine/[slug]/       — sans authentification
├── auth/             login, register, forgot, reset  — sans authentification
├── agency/           28 écrans, garde requireAgency()
├── admin/            6 écrans, garde requireSuperAdmin()
└── api/
    ├── auth/         NextAuth + inscription
    ├── upload/       dépôt de fichier (agence authentifiée)
    ├── export/       CSV par entité
    ├── pdf/          5 documents générés
    ├── */delete/     mise à la corbeille (admin d'agence)
    └── public/health sonde de santé (ajoutée au déploiement)

lib/
├── auth-guard.ts     requireAgency / requireSuperAdmin / getApiAgency
├── prisma.ts         client étendu (suppression réversible)
├── validations/      22 schémas Zod, un par formulaire
├── form.ts           parseForm(schema, formData) → message français
├── rate-limit.ts     compteurs en mémoire de processus
├── storage.ts        Supabase ou disque local, choisi par configuration
├── mailer.ts         SMTP optionnel, repli fichier .mail/ en dev
└── notifications.ts  les 4 emails réellement envoyés
```

### Le contrat des Server Actions

Uniforme dans tout le projet, et c'est ce qui rend le code lisible :

```
requireAgency() → parseForm(schema) → vérification d'appartenance
→ écriture → revalidatePath() → redirect(withSuccess|withError)
```

Les messages voyagent par `?success=` / `?error=` dans l'URL et sont
affichés par `<FormMessage />`. Aucun état client, aucune requête
supplémentaire.

> **Le contrat est incomplet pour la suppression, et c'était BUG-32.** Le
> premier maillon — `requireAgency()` — ne dit **que** l'agence. Il ne dit
> rien du rôle. Cinq Server Actions de suppression s'arrêtaient là, alors
> que leurs homologues d'API vérifient toutes `isAgencyAdmin()`. Le
> cloisonnement inter-agences tenait sur les cinq ; c'est la séparation des
> rôles qui manquait. **Corrigé par la story 4.6**, qui a aussi rendu au
> bien sa corbeille et journalisé les cinq.
>
> Une suppression demande donc **deux** gardes : l'agence, puis le rôle.

### Inventaire des Server Actions destructives

Cette table existe parce que l'angle mort qui a produit BUG-32 est
structurel : **une garde absente ne se voit pas dans le fichier qui devrait
la porter.** Ni l'audit du 9 août — qui a lu intégralement `lib/` et
`app/api/` — ni les tests de rôles de la story 4.3 ne pouvaient l'attraper,
puisque ces actions ne sont ni des routes, ni des écrans réservés. Le
prochain écran ajouté se compare à cette liste, pas à une intuition.

Relevée par exécution, pas de mémoire :

```
grep -rnE 'prisma\.[A-Za-z]+\.(delete|deleteMany)\(|deletedAt: new Date\(\)' app/agency
```

> La première version de cette commande s'écrivait `prisma\.[a-z]*\.delete(`.
> Elle renvoyait **8 lignes là où celle-ci en trouve 11**, et ratait
> `prisma.rentalManagement.delete` — c'est-à-dire l'une des cinq actions que
> cette table existe pour recenser. `[a-z]*` ne franchit pas un `M`
> majuscule, et `delete(` ne couvre pas `deleteMany(`. Une commande de
> contrôle qui rate ce qu'elle contrôle est pire que pas de commande : elle
> donne un feu vert. *Relevé en revue, corrigé par exécution.*

| Action | Fichier | Garde | Effet | Journal |
|---|---|---|---|---|
| `deleteProperty` | `properties/[id]/edit/page.tsx` | `requireAgencyAdmin()` | **corbeille** (`deletedAt`) | ✅ |
| `deleteVisit` | `visits/[id]/edit/page.tsx` | `requireAgencyAdmin()` | définitif | ✅ |
| `deletePayment` | `payments/[id]/edit/page.tsx` | `requireAgencyAdmin()` | définitif | ✅ |
| `deleteRecord` | `rental-management/[id]/edit/page.tsx` | `requireAgencyAdmin()` | définitif | ✅ |
| `deleteInteraction` | `interactions/actions.ts` | `requireAgency()` **+ contrôle d'auteur** — l'agent efface ses propres lignes, l'administrateur toutes | définitif | ✅ |
| purge de la corbeille | `trash/page.tsx` | `requireAgencyAdmin()` (écran réservé) | définitif, explicite | ✅ |
| `resetPassword` (jetons) | `users/page.tsx` | `requireAgencyAdmin()` (écran réservé) | jetons de réinitialisation | ✅ |

#### Confirmation avant destruction — qui l'a, qui devrait l'avoir

`components/ConfirmerDestruction.tsx` (story 3.13, `REP-106`) est un
composant réutilisable : il ouvre un dialogue qui **nomme la ligne et chiffre
ce qui tombe avec elle**, et son bouton de confirmation est rattaché au
`<form>` par l'attribut HTML `form`.

| | |
|---|---|
| **L'a** | purge de la corbeille (`trash/page.tsx`) — la seule qui déclenche les 11 cascades de `npm run audit:cascades` |
| **Devrait l'adopter, dans cet ordre** | `deletePayment` et `deleteRecord` — ce sont des lignes comptables, et l'erreur ne se voit qu'au versement ; puis `deleteVisit` ; puis `deleteInteraction`, dont l'enjeu est le plus faible |
| **Ne doit PAS l'adopter** | `deleteProperty`, qui **met à la corbeille** — l'action est réversible, et une confirmation posée là apprendrait à cliquer à travers celles qui comptent. `resetPassword` non plus : il n'efface aucune donnée métier |

*Aucune de ces actions n'a été modifiée par la story 3.13 : elle pose le
dispositif là où le risque est le plus grand et écrit la liste, plutôt que
de toucher sept écrans d'un coup.*

⚠ **Ce dispositif garde le geste, pas le point d'entrée.** Une Server Action
se rejoue sans l'écran (§6 du contrat de travail) ; un test le constate
explicitement. Ce n'est pas une faiblesse à corriger : l'appelant est déjà
autorisé à détruire par `requireAgencyAdmin()`, et un champ de confirmation
côté serveur, que le navigateur enverrait toujours, n'arrêterait ni
l'accident — traité par le dialogue — ni un administrateur décidé.

**La seule ligne ouverte à un agent est un choix, pas un reste — et sa
portée est celle de son motif.** Une interaction est une ligne d'historique
que l'agent a saisie **lui-même** : la réserver rendrait une faute de frappe
ineffaçable pour celui qui l'a commise, ce qui pousse à contourner l'outil.
Le journal est la contrepartie.

> **Corrigé en revue le 12 août 2026.** La première version portait ce motif
> en commentaire et laissait le code faire autre chose : un agent pouvait
> effacer **n'importe quelle** interaction de l'agence — celle de son
> administrateur, celle d'un collègue, une ligne vieille de deux ans. Le
> test censé épingler l'arbitrage n'éprouvait qu'un agent supprimant sa
> propre ligne : il validait la promesse étroite pendant que le code
> appliquait la large. C'est la justification qui avait raison ; le contrôle
> d'`authorId` a été posé, dans les deux sens et sous test.

*Hors table :* `propertyImage.deleteMany` dans `updateProperty` — la
galerie est remplacée en bloc à chaque enregistrement, ce n'est pas une
suppression décidée par l'utilisateur mais la moitié d'une mise à jour.

### Inventaire des listes alimentées par un modèle à corbeille

Second inventaire, et pour la même raison que le premier : **le défaut ne se
voit pas dans le fichier qui le porte.** Un écran d'édition qui propose un
parent est correct isolément ; c'est la conjonction avec la suppression
réversible qui le casse.

Relevé par exécution :
`grep -rnE 'name="(propertyId|clientId|ownerId)"' app/agency/*/\[id\]/edit/page.tsx`

| Écran | Champs | Modèle |
|---|---|---|
| `visits/[id]/edit` | `propertyId`, `clientId` | Property, Client |
| `sales/[id]/edit` | `propertyId`, `clientId` | Property, Client |
| `rentals/[id]/edit` | `propertyId`, `clientId` | Property, Client |
| `payments/[id]/edit` | `propertyId`, `clientId`, `ownerId` | Property, Client, Owner |
| `properties/[id]/edit` | `ownerId` | Owner |

Les dix couples passent par `optionsParent()` (`lib/corbeille.ts`) : le
parent mis à la corbeille reste proposé, suffixé « — en corbeille ». Sans
lui, aucune `<option>` ne correspond au `defaultValue`, le navigateur
retombe sur la première, et **enregistrer sans rien changer réécrit le lien
métier** — c'était BUG-34, reproduit sur l'instance et fermé par la
story 3.9.

La liste est bâtie par **une seule requête** par parent, via le fragment
`vivantsEtCourant()` — story 3.10, qui a fermé `REP-03`, `06` et `07`
ensemble : la liste et son parent courant viennent du même `findMany`, donc
rien ne peut être restauré entre deux requêtes, c'est l'`orderBy` qui range,
et il n'y a plus de requête payée en plus. ⚠ Le fragment nomme
`deletedAt: undefined` **exprès** : l'extension de `lib/prisma.ts` teste
`"deletedAt" in where` au premier niveau seulement, et sans cette clef son
filtre serait ajouté à côté du `OR`.

Et si la valeur courante ne correspond à **aucune** ligne — identifiant
d'une autre agence, dérive de données — `optionsParent()` fabrique quand
même l'option, étiquetée « référence introuvable » : l'enregistrement est
alors **refusé** au lieu de réécrire ou d'effacer le lien en silence
(`REP-04`).

**La lecture ne suffit pas : l'écriture doit suivre.** Les Server Actions
revérifient le lien reçu, et leur `where` ne nomme pas `deletedAt` — le
parent en corbeille y est donc introuvable, et l'enregistrement refusé.
`lienInchange()` pose la règle : **un identifiant inchangé n'est pas
revérifié**, il l'a été quand il a été écrit. Un identifiant différent l'est
normalement. Sans cette moitié-là, le correctif remplace une corruption
silencieuse par un écran impossible à enregistrer — c'est ce que la revue
du 12 août a rattrapé.

**Les écrans de création ne sont pas concernés** : sans `defaultValue`, il
n'y a rien à faire retomber. Ne pas les modifier par symétrie.

> **Le composant ne protège pas.** `sales` et `rentals` emploient le `Select`
> de Radix plutôt qu'un `<select>` natif, et l'on pouvait croire que son état
> JavaScript conservait la valeur. **La mutation a prouvé le contraire** :
> son `<select>` caché retombe exactement de la même façon. Une hypothèse sur
> le comportement d'une bibliothèque se mesure.

---

## 5. Flux d'authentification

```
Formulaire login (client)
   ↓ signIn("credentials")
auth.ts / authorize()
   ├── rate-limit : 10 essais / compte / 15 min, 60 / IP / 15 min
   ├── prisma.user.findUnique({ email })        ← sensible à la casse (BUG-01)
   ├── bcrypt.compare
   └── refus si l'agence n'est pas « active » (sauf super_admin)
   ↓ échec
explainLoginFailure()  (Server Action séparée)
   └── revalide le mot de passe AVANT de révéler la raison exacte
```

Le double appel est délibéré : NextAuth v5 beta ne sait pas transmettre de
code d'erreur personnalisé, et révéler « agence suspendue » sans preuve
d'identité permettrait d'énumérer les comptes. La revalidation dispose
cependant de son **propre** budget de tentatives, ce qui double le budget
réel de force brute (BUG-17).

### Ce que chaque requête suivante revérifie — et ce qu'elle croit sur parole

C'est la partie du flux qui compte le plus, et c'est la moins visible.
Depuis la story 1.8, les trois gardes de `lib/auth-guard.ts` relisent le
compte **et** son agence à chaque requête :

| Donnée | Source à chaque requête | Relue en base ? |
|---|---|:---:|
| Existence du compte | `user.findUnique` | ✅ |
| `isActive` du compte | `user.findUnique` | ✅ |
| `role` du compte | `user.findUnique` | ✅ |
| `agencyId` du compte | `user.findUnique` | ✅ |
| Statut de l'agence (`active`) | même requête, `include: { agency: true }` | ✅ |
| **Identité de l'appelant** (`user.id`) | **jeton signé** | ❌ — c'est sa seule fonction |

**La seule valeur consommée du jeton est `session.user.id`.** Ne pas
réintroduire de contrôle sur `session.user.role` ni sur
`session.user.agencyId` : ce serait rouvrir BUG-33 par la porte de derrière,
et de façon invisible, puisque le reste du fichier aurait l'air correct.

**Le coût n'est pas nul, et il a été mesuré.** `requireAgency` et
`getApiAgency` faisaient déjà *un appel Prisma* pour l'agence et en font
toujours un pour les deux — mais Prisma éclate une relation to-one en
**deux instructions SQL** (`relationLoadStrategy` par défaut) : c'est donc
un aller-retour de plus par requête sur tous les chemins de l'espace
agence, pas zéro. `requireSuperAdmin`, elle, passe bien de zéro requête à
une. La première rédaction de cette section annonçait « coût nul » et la
formule a circulé dans quatre documents avant d'être vérifiée.

`auth.config.ts` pose un `maxAge` de **12 heures** (trente jours par défaut
avant la story 1.8). Mesuré : sur la stratégie JWT, `@auth/core` ré-signe le
jeton à chaque lecture de session sans consulter `updateAge` — c'est donc un
délai **d'inactivité glissant**, pas un couperet en pleine journée de
travail.

**Ce qui reste hors de portée, et ce que les 12 heures ne bornent pas.** Un
jeton **volé** sur un compte qu'on laisse actif reste utilisable jusqu'à son
expiration, y compris après changement de mot de passe. Et comme le jeton
est ré-signé à chaque lecture de session, **un jeton volé qui est activement
utilisé ne périme jamais** : les 12 heures bornent les sessions *inactives*,
pas la durée de vie d'un accès volé. Le fermer demande une marque horodatée
sur le compte, comparée à la date d'émission du jeton — story 5.8. Le seul
remède existant aujourd'hui est de **désactiver le compte**, ce qui, depuis
la story 1.8, coupe réellement.

Le middleware, lui, tourne en Edge et ne peut pas atteindre la base : la
seule valeur de rôle qu'il pourrait lire est celle du jeton. **Il
n'autorise donc plus rien** : il vérifie qu'une session existe, refuse
`/uploads/documents/`, et laisse passer. Ce n'était pas le cas — il
aiguillait les deux espaces sur le rôle du jeton, et cette section a
longtemps affirmé qu'il « aiguillait sans autoriser » alors qu'il rendait
bel et bien des décisions de refus (`403` JSON, redirection) sur une donnée
périmée. Tant que les gardes lisaient la même valeur, les deux couches
disaient la même chose ; la story 1.8 a fait lire la base aux gardes et les
a mises en désaccord — un super admin rétrogradé rebondissait de `/admin`
(refusé sur la base) vers `/agency` (refusé sur le jeton) jusqu'à
`ERR_TOO_MANY_REDIRECTS`.

**L'aiguillage entre les deux espaces vit donc dans `lib/auth-guard.ts`, et
nulle part ailleurs :** `requireSuperAdmin()` renvoie un rôle non-éditeur
vers `/agency`, `requireAgency()` renvoie un éditeur vers `/admin`. Les deux
lisent la même colonne de la même ligne : elles ne peuvent plus se
contredire. Ne pas chercher à donner Prisma au middleware — la frontière
entre `auth.config.ts` et `auth.ts` existe pour cela — et ne pas y
réintroduire de contrôle de rôle : c'est la moitié de boucle qui vient
d'être retirée.

**Le cache de routeur comptait aussi.** Next 14.2 resservait pendant trente
secondes, depuis le navigateur et sans aucune requête au serveur, tout
segment dynamique déjà visité : aucune garde ne s'exécutait, et un compte
désactivé continuait de lire les pages qu'il avait ouvertes. La propriété
tenue était « à la requête suivante », pas « à la navigation suivante ».
`next.config.mjs` pose désormais `experimental.staleTimes.dynamic = 0`.

---

## 6. Stockage des fichiers

Deux modes, choisis par la présence de trois variables :

| Mode | Condition | Destination | Durabilité |
|------|-----------|-------------|------------|
| `supabase` | `SUPABASE_URL` + `SERVICE_ROLE_KEY` + `STORAGE_BUCKET` | bucket public | durable |
| `local` | sinon | `public/uploads/` (volume Docker) | survit au redéploiement ~~, pas à `down -v`~~ **et à `down -v`** — voir ci-dessous |

**Dans les deux modes, les fichiers sont publics.** Il n'existe aucune
route qui vérifie une session avant de servir un fichier. Or
`DocumentType` comprend `piece_identite`, `acte_propriete` et
`contrat_vente` : ce sont des pièces confidentielles protégées par la
seule difficulté à deviner leur URL (BUG-04).

Particularité découverte au déploiement : en sortie autonome, Next
inventorie `public/` **une seule fois au démarrage**. Les fichiers déposés
ensuite répondaient 404 jusqu'au redémarrage suivant. `/uploads/` est donc
désormais servi par nginx directement depuis le volume.

---

## 7. Déploiement

Deux compositions distinctes, à ne pas confondre :

| Fichier | Usage | Mode |
|---------|-------|------|
| `docker-compose.yml` | développement | code monté, `next dev` |
| `docker-compose.prod.yml` | déploiement | image autonome, `node server.js` |

En production : `postgres` → `migrate` (conteneur éphémère,
`prisma migrate deploy`) → `frontend` (non-root, healthcheck sur
`/api/public/health`) → `nginx` (compression, limitation de débit,
service des uploads).

**Les deux volumes de production sont `external`** — `aqar-prod_postgres_data`
et `aqar-prod_uploads_data` (story 2.7, REP-103). Mesuré le 17-08-2026 sur un
projet jetable, marqueur déposé dans chaque volume : un volume ordinaire est
supprimé par `docker compose down -v`, un volume `external` est épargné et
`down -v` **ne le mentionne même pas**. Trois conséquences :

- **Une installation neuve doit créer les volumes à la main** avant le
  premier `up`. Sinon : `external volume "…" not found`, sortie `1`, aucun
  conteneur créé. Le `README` porte la commande.
- **Ceux du développement restent ordinaires**, et c'est écrit dans
  `docker-compose.yml` avec son motif : ils n'existent nulle part
  (`docker volume ls -q | grep '^aqar_'` → rien), donc les rendre `external`
  casserait tout poste neuf ; et une base de développement se jette.
- **Ce n'est pas une sauvegarde.** `docker volume rm`, un disque mort ou une
  corruption passent dessous. Le filet reste la story 0.1.

**L'image porte le commit dont elle est issue** — `ARG COMMIT_SHA` posé par
`docker-compose.prod.yml`, gravé dans le fichier `.commit` de l'image
(story 2.8, `REP-96`), rendu par `/api/public/health` aux côtés de `schema`
et **sur les réponses 503 aussi** — c'est en panne qu'on en a besoin.

- **Un fichier, pas une variable d'environnement.** Mesuré le 17-08-2026 sur
  une image jetable portant les deux : `docker run -e COMMIT_SHA=x` — soit
  exactement ce que fait `env_file: - .env`, présent sur le service
  `frontend` — **écrase l'`ENV` gravée** et ne peut rien contre le fichier.
  Une `ENV` ferait donc annoncer à la sonde un commit qui n'est pas le sien.
- **Ni lecture de `.git`** : `.dockerignore` l'exclut du contexte, à dessein.
- **`"inconnu"` explicitement**, jamais un champ absent : un champ manquant
  se lit comme « trop ancien pour le dire », indiscernable de « ne sait pas
  d'où il vient », et les deux appellent des gestes différents.
- **Ce que `schema` ne disait pas.** Il répond à « cette image sait-elle lire
  cette base ? », pas à « quelle version tourne ? ». Le 15-08-2026, l'image
  en service accusait 67 commits de retard **sans changement de schéma** :
  la sonde de la story 2.6 l'aurait déclarée `a-jour`, et la vérification a
  conclu à une régression de sécurité qui n'existait pas.
- **`npm run verify:deploy` compare et n'échoue pas** : servir une image plus
  ancienne que la branche courante est normal en cours de travail. Il nomme
  les deux SHA et laisse trancher.

`instrumentation.ts` appelle `lib/env.ts` au démarrage : le serveur
**refuse de démarrer** en production si `NEXTAUTH_SECRET` est absent, trop
court ou resté à sa valeur d'exemple. Il avertit — sans bloquer — pour le
stockage local, l'absence de HTTPS et l'absence de SMTP.

### Le relais doit conserver le port, et ce n'est pas un détail

**`nginx.conf` transmet `Host $http_host`, jamais `$host`.** La différence
est le port, et elle décide si le produit sait écrire.

Next 14 protège les Server Actions du CSRF en comparant l'hôte transmis à
l'`Origin` du navigateur. `$host` étant l'en-tête `Host` **sans le port**,
la comparaison opposait `localhost` à `localhost:8095`, ne trouvait pas
d'égalité, et Next **abandonnait l'action** :

```
`x-forwarded-host` header with value `localhost` does not match `origin`
header with value `localhost:8095`. Aborting the action.
```

**Les 41 Server Actions du produit étaient mortes sur ce déploiement** —
c'est-à-dire tout ce qui écrit. Survivaient la navigation, la connexion
(une *route*, pas une action), les exports, les PDF et les suppressions par
route API : le produit était en lecture seule **sauf pour supprimer**.
C'était BUG-36, reproduit le 15-08-2026 et fermé par la story 5.14.

> **Aucun test ne couvre ce chemin, et il faut le savoir.**
> `playwright.config.ts` lance `npm run build && npm start -p 3002` : la
> suite parle **directement** à l'application, nginx n'est jamais dans le
> chemin. Les cas verts ne disent donc rien de la topologie de déploiement
> — ni pour nginx, ni pour les volumes, ni pour les migrations, ni pour les
> variables d'environnement. C'est REP-95, et c'est la raison pour laquelle
> ce défaut a vécu invisible : **il n'existait aucun test capable de le
> rendre rouge.**
>
> **Depuis la story 5.14, deux choses le couvrent** — et il faut savoir ce
> que chacune vaut :
>
> | Quoi | Prouve | Tourne |
> |---|---|---|
> | `npm run verify:deploy` | qu'une Server Action **s'exécute à travers nginx**, par le port publié | à la main, dans la procédure de déploiement |
> | `tests/deploiement.spec.ts` | seulement que les quatre relais portent encore `$http_host` | à chaque `npm run test:e2e` |
>
> Le script n'écrit rien en base : il poste un `slug` de vitrine
> introuvable, ce qui fait sortir `submitLead` avant toute création.

#### Après toute édition de `nginx.conf`, relire la config DEPUIS le conteneur

`nginx.conf` est monté depuis le dépôt — mais c'est un **montage de
fichier**, et un montage de fichier suit l'**inode**, pas le chemin. Tout
outil qui réécrit le fichier au lieu de le modifier en place (`sed -i`, et
la plupart des éditeurs) crée un **nouvel** inode : le conteneur reste
accroché à l'ancien et **continue de servir l'ancienne configuration**,
`nginx -s reload` compris.

Cela s'est produit le 15-08-2026 pendant la preuve par mutation de la story
5.14 : la mutation semblait n'avoir aucun effet, alors qu'elle n'avait
simplement jamais atteint nginx.

```bash
# Ce que nginx sert REELLEMENT — la seule lecture qui fasse foi :
docker compose -f docker-compose.prod.yml exec nginx grep -n 'proxy_set_header Host' /etc/nginx/nginx.conf

# Si l'inode a change, recharger ne suffit pas :
docker compose -f docker-compose.prod.yml up -d --force-recreate nginx
```

Un `grep` sur le fichier du dépôt ne dit **pas** ce que nginx sert.

`serverActions.allowedOrigins` (`next.config.mjs`) a été **écarté** comme
remède : il figerait l'origine dans l'image au moment du `build`, et
casserait tout déploiement sur un autre domaine.

---

## 8. Limites structurelles connues

Ce ne sont pas des défauts d'implémentation mais des choix dont il faut
connaître la portée avant de monter en charge.

1. **La limitation de débit vit dans la mémoire du processus**
   (`lib/rate-limit.ts`). Sur un VPS unique — la cible prévue — elle fait
   son travail. Derrière deux instances, la limite réelle est doublée.
   Un passage à l'échelle horizontale exige Redis ou le reverse proxy.

2. **Aucun test unitaire.** La couverture repose entièrement sur
   Playwright (13 fichiers E2E). Les calculs financiers de
   `lib/format.ts` — `computeAmountToOwner`, le net à reverser au
   propriétaire — ne sont vérifiés par aucun test, alors que ce sont
   les fonctions dont une erreur coûte de l'argent réel.

3. **Pas de tâche planifiée.** `Visit.reminderSent` existe dans le schéma
   mais rien ne l'écrit : les rappels de visite ne partent pas.
   De même, aucune relance automatique à l'échéance d'abonnement.

4. **Références métier illisibles.** `Property.reference` et
   `Payment.reference` sont des `cuid()`. Les exports CSV affichent donc
   `cmslq2teb000f42dumpcxt1v7` dans une colonne « Référence » qu'une
   agence lit comme un numéro de dossier.

5. **Un jeton n'est pas révocable, même si un accès l'est.** *(Point ajouté
   par la story 1.8.)* La stratégie est JWT : le jeton est signé, pas
   stocké, et rien ne peut l'invalider avant son terme. La story 1.8 a rendu
   la **désactivation** effective — les gardes relisent le compte — mais un
   jeton **volé** sur un compte qu'on laisse actif reste utilisable jusqu'à
   expiration, y compris après un changement de mot de passe. Et les 12 h
   ne bornent **pas** ce risque : le jeton étant ré-signé à chaque lecture
   de session, un jeton volé activement utilisé ne périme jamais. Le fermer
   demande une colonne d'horodatage comparée au jeton (story 5.8), ou
   l'abandon de la stratégie JWT pour des sessions en base. C'est le choix
   qui porte cette limite, pas un oubli — et c'est la raison pour laquelle
   la story 5.8 n'est pas un confort.

6. **Le net à reverser au propriétaire est calculé à quatre endroits.**
   *(Point ajouté par la story 1.8, hors de son périmètre : il n'appartient
   à aucun défaut du registre et n'a pas de story propriétaire. Consigné
   dans `stories/deferred-work.md`, à rattacher à la story 4.5.)*
   `computeAmountToOwner` (`lib/format.ts:70`) n'est appelé que par
   `app/agency/rental-management/page.tsx` ; les trois autres chemins —
   création, édition, et la **quittance PDF** remise au propriétaire —
   réécrivent la formule en ligne. Les quatre concordent aujourd'hui,
   vérifié le 12 août 2026 ; rien ne garantit qu'elles concorderont après
   la prochaine modification, et l'écart se verrait chez le propriétaire.
   La colonne `RentalManagement.amountToOwner` est écrite par trois de ces
   chemins et **relue par aucun** : tous les affichages recalculent. À
   traiter avec la story 4.5 (couche métier testable), qui donne l'endroit
   unique où poser ce calcul et le premier test qui l'exercera.

---

## 9. État de santé

| Contrôle | Résultat |
|----------|----------|
| `tsc --noEmit` | 0 erreur |
| `next lint` | 0 erreur, 4 avertissements (`<img>` au lieu de `next/image`) |
| `next build` | succès |
| `npm run test:e2e` | 102 cas, 102 verts (chromium) |
| Migrations Prisma | 3, appliquées |
| Cloisonnement multi-locataire | aucune fuite trouvée |
| Séparation des rôles | 8 routes, 5 écrans réservés, 5 Server Actions destructives — toutes prouvées par mutation. **Une exception assumée** : la suppression d'une interaction reste ouverte à son auteur (§4) |
| Révocation d'un accès | effective — désactivation et changement de rôle tombent à la requête suivante, **navigation client comprise** (story 1.8 et sa revue) |
| Autorisation | une seule couche, `lib/auth-guard.ts`, sur la base. Le middleware authentifie et n'autorise plus |
| Défauts ouverts | 19 sur 34 — voir [`qa/bug-report.md`](qa/bug-report.md) |

---

## 10. Ce que ce document ne couvre pas

- Le détail des 28 écrans de l'espace agence : ils suivent tous le même
  contrat de Server Action, décrit en §4. **Cette phrase a coûté un
  défaut** : elle a servi de dispense de lecture aux deux audits du 9 août,
  qui ont parcouru intégralement `lib/` et `app/api/` mais seulement
  survolé les écrans. Les cinq suppressions de BUG-32 y étaient. Un motif
  uniforme décrit ce que les fichiers ont en commun, jamais ce qui manque à
  l'un d'eux.
- **La fraîcheur de ce que les gardes lisent.** Ce document décrivait
  `requireAgency()` comme « la garde donne l'agencyId depuis la session »
  sans jamais dire *quand* cette session avait été établie. La description
  était exacte et la propriété était fausse : c'est BUG-33. Le §5 porte
  désormais la table de ce qui est relu et de ce qui est cru sur parole.
  Deux angles morts en deux jours, de la même famille — **ce qui échappe à
  une revue fichier par fichier, c'est ce dont aucun fichier n'est
  responsable.**
- Les composants d'interface (`components/ui/`), issus de shadcn/ui sans
  modification notable.
- Le jeu de données de démonstration (`prisma/seed.ts`, 776 lignes),
  idempotent, qui recrée les entités métier de l'agence de démo à chaque
  passage.
