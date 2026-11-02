# Aqar DZ

SaaS de gestion d'agences immobilières pour le marché algérien.

## Architecture

- **Frontend** : Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend** : Next.js API Routes + Prisma ORM
- **Auth** : NextAuth v5, fournisseur `Credentials` + bcrypt, stratégie JWT.
  **Supabase n'intervient pas dans l'authentification**
- **Base de données** : PostgreSQL 16 auto-hébergé en conteneur, en
  développement comme en production (volume `postgres_data`)
- **Stockage des fichiers** : disque local par défaut (volume `uploads_data`,
  servi par nginx). Supabase Storage est **optionnel** — voir « Stockage des
  fichiers » plus bas
- **PDF** : @react-pdf/renderer

## Prérequis

- Docker + Docker Compose
- Node.js 20+
- npm

## Démarrage rapide

```bash
# 1. Cloner le repo
git clone [url-du-repo]
cd aqar-dz

# 2. Copier les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# 3. Lancer les conteneurs
docker-compose up -d

# 4. Générer le client Prisma
docker-compose exec frontend npx prisma generate

# 5. Exécuter les migrations
docker-compose exec frontend npx prisma migrate dev

# 6. Lancer le seed (optionnel)
docker-compose exec frontend npx prisma db seed
```

## Services Docker

| Service | Port | Description |
|---------|------|-------------|
| frontend | 3000 | Application Next.js |
| postgres | 127.0.0.1:5432 | Base de données PostgreSQL — boucle locale seulement |
| nginx | 80 | Reverse proxy |

## Scripts utiles

```bash
# Logs
docker-compose logs -f frontend

# Shell dans le conteneur
docker-compose exec frontend sh

# Rebuild
docker-compose up -d --build

# Stop
docker-compose down

# Reset DB
docker-compose down -v
docker-compose up -d
```

## Déploiement (production)

Le `docker-compose.yml` ci-dessus sert le **développement** : il monte le
code source dans le conteneur et lance `next dev`. Pour un déploiement,
utilisez `docker-compose.prod.yml`, qui construit l'image autonome et ne
dépend d'aucun fichier de la machine hôte.

```bash
# 1. Configuration
cp .env.example .env
# Renseigner au minimum :
#   NEXTAUTH_SECRET   openssl rand -base64 32
#   NEXTAUTH_URL      le vrai domaine, sans slash final
#   AUTH_TRUST_HOST   true (obligatoire derrière nginx)

# 2. Les deux volumes de données — À CRÉER, une seule fois, avant tout `up`
# Ils sont déclarés `external` pour que `docker compose down -v` ne puisse
# plus les effacer (story 2.7). Docker ne les crée donc PAS tout seul.
docker volume create aqar-prod_postgres_data
docker volume create aqar-prod_uploads_data

# 3. Construction et démarrage
# Les migrations sont appliquées automatiquement, dans un conteneur
# éphémère, avant que l'application ne démarre.
#
# COMMIT_SHA grave dans l'image le commit dont elle est issue (story 2.8) :
# c'est ce qui permet à la sonde de santé de dire QUELLE version tourne.
# L'oublier ne casse rien — la sonde répondra « inconnu ».
COMMIT_SHA=$(git rev-parse HEAD) \
  docker compose -f docker-compose.prod.yml up -d --build

# 4. Jeu de données de démonstration (facultatif, jamais sur une base réelle)
docker compose -f docker-compose.prod.yml --profile seed run --rm seed
```

> **Si vous sautez l'étape 2**, rien ne démarre et le message le dit :
>
> ```
> external volume "aqar-prod_postgres_data" not found
> ```
>
> La commande sort en `1` et **aucun conteneur n'est créé** — la pile ne
> démarre pas à moitié. Créez les volumes, relancez l'étape 3.
>
> C'est le prix assumé de la protection : on a échangé un risque de perte
> définitive contre un risque d'installation qui ne démarre pas. Une
> installation **déjà en service** ne voit rien changer, ses volumes portant
> déjà ces noms exacts — **vérifié le 17-08-2026** sur la pile de cette
> machine : le `up -d --build` a abouti sans que `postgres` soit même
> recréé, et `docker volume inspect` rend toujours
> `CreatedAt = 2026-08-09` pour les deux volumes.
>
> ⚠ `external` n'arrête pas `docker volume rm`, qui est un geste délibéré.
> Et ce n'est **pas** une sauvegarde : ni un disque mort, ni une corruption
> ne passent par `down -v`.

> ⚠ **Une migration et une reconstruction ne se séparent pas.**
>
> `npm run db:deploy` applique les migrations **depuis le poste de travail**,
> sans consulter ni redémarrer le conteneur qui sert le trafic. L'image
> continue alors de tourner avec un client Prisma généré sur l'**ancien**
> schéma — et comme `authorize()` relit l'agence à chaque connexion, **plus
> personne n'entre**, sur tous les comptes à la fois.
>
> C'est arrivé le 16 août 2026 (BUG-37). Le conteneur est resté `healthy`
> pendant toute la panne : l'ancienne sonde faisait `SELECT 1`, qui ne
> traverse aucune colonne.
>
> **Le seul geste sûr est celui de l'étape 3** — `up -d --build` applique les
> migrations *et* reconstruit l'image, dans cet ordre. Si vous avez migré
> autrement, reconstruisez avant de servir.
>
> Depuis la story 2.6, la sonde de santé le dit au lieu de le taire :
>
> ```bash
> curl -s http://localhost:8095/api/public/health
> # sain            {"status":"ok","database":"up","schema":"a-jour","commit":"4e529b0…"}
> # image dépassée  503 {"schema":"image-en-retard","migrations":["2026…_agency_plan_enum"],"commit":"…"}
> # base dépassée   503 {"schema":"base-en-retard","migrations":[…],"commit":"…"}
> ```
>
> `npm run verify:deploy` reprend ce diagnostic et nomme le remède.

> ⚠ **La sonde compare les migrations, pas les commits — et depuis la story
> 2.8 elle dit les deux.**
>
> `schema` répond à « cette image sait-elle lire cette base ? ». Il ne répond
> pas à « quelle version du produit tourne ? » : le 15-08-2026, l'image en
> service accusait **67 commits de retard sans aucun changement de schéma**,
> et la sonde l'aurait déclarée `a-jour`. La vérification a alors conclu à
> une régression de sécurité qui n'existait pas (`REP-96`).
>
> Le champ `commit` ferme ce trou. Il vaut `"inconnu"` — explicitement,
> jamais omis — si l'image a été construite sans `COMMIT_SHA`.
>
> ```bash
> npm run verify:deploy      # nomme les deux SHA en cas d'écart, sans échouer
> ```
>
> Il **n'échoue pas** sur un écart : servir une image plus ancienne que la
> branche courante est un état normal en cours de travail.

### Services de production

| Service  | Port hôte | Rôle |
|----------|-----------|------|
| nginx    | `HTTP_PORT` (8095) | Point d'entrée réel : compression, limitation de débit, fichiers téléversés |
| frontend | *aucun*   | Next.js autonome — joignable par nginx seulement (BUG-22) |
| postgres | `POSTGRES_PORT` (5433) | Base de données |
| migrate  | —         | Conteneur éphémère : `prisma migrate deploy` avant chaque démarrage |
| seed     | —         | Sous profil `seed`, à la demande uniquement |

Les ports se règlent dans `.env`. Depuis les stories 2.1 et 2.4, **nginx
est le seul service ouvert au réseau** : l'application ne publie plus
rien, et la base n'est liée qu'à `127.0.0.1` — le poste de travail
l'atteint pour `npm run dev`, Prisma Studio et les tests, aucune autre
machine ne le peut. Ne rétablissez pas ces publications : la suite de
tests refuse le commit qui le ferait.

**Reste à faire avant une mise en ligne :** si la machine fait tourner
autre chose que cette pile, ajouter une règle `DOCKER-USER` fermant
l'accès aux adresses de conteneurs depuis l'hôte — `docker-compose.prod.yml`
détaille pourquoi et comment.

### Comptes de démonstration

Créés par le seed, mot de passe `password123` :

| Compte | Rôle |
|--------|------|
| `superadmin@aqar.dz` | Super Admin |
| `admin@aqar.dz` | Admin d'agence |
| `agent@aqar.dz` | Agent |

### Exploitation

```bash
# État et santé des conteneurs
docker compose -f docker-compose.prod.yml ps

# Logs applicatifs
docker compose -f docker-compose.prod.yml logs -f frontend

# Sonde de santé (vérifie aussi la base)
curl http://localhost:8095/api/public/health

# Mise à jour après modification du code
# COMMIT_SHA : sans lui, l'image ne saura pas dire de quoi elle est issue.
COMMIT_SHA=$(git rev-parse HEAD) \
  docker compose -f docker-compose.prod.yml up -d --build

# Sauvegarde de la base — HORS du dépôt.
# Un dump contient les comptes, les empreintes de mots de passe et toutes
# les données des agences : il n'a rien à faire dans un répertoire suivi
# par git. `.gitignore` couvre `*.sql` par précaution, pas par principe.
docker exec aqar-postgres-prod pg_dump -U aqar_user aqar_db > ~/sauvegardes/aqar-$(date +%F).sql

# Arrêt (les volumes, donc les données, sont conservés)
docker compose -f docker-compose.prod.yml down
```

### Avant une vraie mise en ligne

Trois points que le déploiement local laisse volontairement ouverts :

- **HTTPS.** `NEXTAUTH_URL` en `http://` fait circuler le cookie de session
  en clair. Placez un certificat sur nginx, ou un proxy TLS devant.
- **Stockage des fichiers.** Sans `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` et `SUPABASE_STORAGE_BUCKET`, les photos
  vivent dans le volume `uploads_data` : elles survivent aux
  redéploiements ~~, mais pas à un `down -v`~~ **et, depuis la story 2.7, à
  un `down -v`** — le volume est `external`. Elles ne survivent toujours ni
  à un changement de machine, ni à un `docker volume rm`, ni à un disque
  mort : **la sauvegarde reste à faire** (story 0.1).
- **SMTP.** Sans lui, l'activation d'agence et la réinitialisation de mot
  de passe ne partent pas : un utilisateur bloqué dépend entièrement de
  son administrateur.

L'application énonce elle-même ces trois manques dans ses logs au
démarrage.

## Structure du projet

```
aqar-dz/
├── app/                  # Routes Next.js
│   ├── admin/            # Dashboard Super Admin
│   ├── agency/           # Dashboard Agence
│   ├── auth/             # Pages d'authentification
│   └── api/              # API Routes
├── components/           # Composants React
│   ├── ui/               # Composants shadcn/ui
│   ├── layout/           # Layouts et navbars
│   └── ...               # Modules métiers
├── lib/                  # Utilitaires
│   ├── prisma.ts         # Client Prisma
│   ├── auth.ts           # Configuration NextAuth
│   └── validations/      # Schémas Zod
├── prisma/               # Schéma et migrations Prisma
│   ├── schema.prisma
│   └── seed.ts
├── public/               # Assets statiques
│   └── uploads/          # Images uploadées
├── docker/               # Dockerfiles
├── nginx/                # Configuration nginx
└── docs/                 # Documentation
```

## Rôles utilisateurs

- **super_admin** : Contrôle toutes les agences
- **agency_admin** : Admin d'une agence
- **agent** : Utilisateur interne d'une agence

## Modules

1. Dashboard Agence
2. Vitrine digitale
3. Gestion des biens
4. Gestion des propriétaires
5. Gestion des clients
6. Gestion des ventes
7. Gestion des locations
8. Gestion locative
9. Gestion des visites
10. Gestion des paiements
11. Documents et PDF
12. Dashboard Super Admin

## Développement

Voir `docs/roadmap.md` pour la roadmap détaillée.

## Licence

Propriétaire - Aqar DZ
