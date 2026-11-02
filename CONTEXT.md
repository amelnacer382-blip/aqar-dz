# Aqar DZ — Contexte métier

> **Ce que fait ce fichier :** il dit ce qu'est le produit et pour qui. Rien
> d'autre.
>
> Il ne porte **ni méthode, ni avancement, ni règles de travail** — c'était
> le cas jusqu'au 12 août 2026, et il annonçait alors « Phase 1 en cours »
> pendant que seize stories étaient closes. Un document qui se contredit
> avec le suivi de sprint est pire qu'un document absent : on le croit.
>
> | Question | Fichier |
> |---|---|
> | Comment travailler ici | `CLAUDE.md` |
> | Où en est le projet | `docs/stories/sprint-status.yaml` |
> | Que reste-t-il à faire | `docs/epics.md` |
> | Comment ça marche vraiment | `docs/architecture.md` |

## Nom du projet
Aqar DZ - SaaS de gestion d'agences immobilières pour le marché algérien.

## Objectif
Créer une application web SaaS moderne, fluide et professionnelle permettant aux agences immobilières algériennes de gérer leurs biens, clients, ventes, locations, gestion locative et de présenter leurs biens sous forme de vitrine digitale élégante.

## Architecture
- **Multi-tenant** : Chaque agence possède son propre espace privé avec isolation des données par `agencyId`
- **3 niveaux d'utilisateurs** : Super Admin SaaS, Admin Agence, Utilisateur Agence
- **Navigation horizontale** : Navbar en haut de page uniquement, jamais de sidebar

## Stack technique

### Frontend
- Next.js 14 (App Router)
- TypeScript strict
- Tailwind CSS
- shadcn/ui (style Default, couleur slate)
- Framer Motion
- Lucide React
- React Hook Form + Zod
- TanStack Query

### Backend
- Next.js API Routes + Server Actions
- Prisma ORM
- NextAuth v5, provider Credentials + bcrypt, stratégie JWT

> **Correction du 9 août 2026.** Ce document annonçait « NextAuth v5 +
> Supabase Auth comme provider » et TanStack Query. Ni l'un ni l'autre
> n'est utilisé dans le code : l'authentification repose sur un unique
> provider `Credentials` avec bcrypt (`auth.ts`), Supabase ne sert que de
> stockage de fichiers optionnel (`lib/storage.ts`), et les données
> transitent par les Server Components — `@tanstack/react-query` est
> installé mais importé nulle part. Voir `docs/architecture.md`.

### Base de données
- Développement **et production** : PostgreSQL 16 auto-hébergé en conteneur
  (volume `postgres_data`). Supabase n'héberge pas la base

### Stockage images
- Par défaut : disque local (`public/uploads/`, volume `uploads_data` en
  conteneur, servi par nginx)
- Supabase Storage : **optionnel**, activé seulement si `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` et `SUPABASE_STORAGE_BUCKET` sont tous
  renseignés (`lib/storage.ts`)

### PDF
- @react-pdf/renderer

### Infrastructure
- Docker + Docker Compose (dev)
- nginx (reverse proxy)
- VPS (production)

## Modules principaux
1. Dashboard Agence (KPIs, graphiques)
2. Vitrine digitale (présentation client en agence)
3. Gestion des biens (CRUD, upload photos, fiche bien)
4. Gestion des propriétaires
5. Gestion des clients
6. Gestion des ventes
7. Gestion des locations
8. Gestion locative (suivi loyers, quittances, charges)
9. Gestion des visites
10. Gestion des paiements
11. Documents et PDF
12. Dashboard Super Admin SaaS

## Rôles utilisateurs
- **super_admin** : Contrôle toutes les agences, activation/suspension manuelle
- **agency_admin** : Gère son agence, tous les modules métiers
- **agent** : Utilisateur interne avec permissions limitées

## Devise
DZD (Dinar algérien) par défaut

## Points clés business
- Activation des agences manuelle par Super Admin (pas de Stripe pour MVP)
- Vitrine digitale est le module prioritaire
- Gestion locative ≠ Location (administratif récurrent vs commercial)
- Upload images uniquement (pas de vidéo)
- Multi-tenant strict : chaque agence ne voit que ses données

## Environnements

### Développement (local)
- PostgreSQL dans Docker
- Images stockées localement
- NextAuth en mode développement

### Production (VPS)
- PostgreSQL 16 en conteneur, sur la même machine (`docker-compose.prod.yml`)
- Images sur le volume `uploads_data`, servies par nginx ; Supabase Storage
  reste une option non activée
- Frontend dans conteneur Docker, sortie autonome, utilisateur non-root
- Migrations appliquées par un conteneur éphémère `migrate`, jamais par
  celui qui sert le trafic
- nginx reverse proxy

## Variables d'environnement clés
- DATABASE_URL (PostgreSQL local ou Supabase)
- NEXTAUTH_URL, NEXTAUTH_SECRET
- SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- UPLOAD_DIR, MAX_FILE_SIZE

## Contraintes métier

Ce sont des contraintes de **produit**, pas de code — les règles
d'ingénierie qui les font respecter vivent dans `CLAUDE.md` §12.

- **Navigation horizontale**, jamais de sidebar : c'est une décision
  d'interface assumée, pas une préférence.
- **Isolation stricte entre agences.** Une agence ne doit jamais voir quoi
  que ce soit d'une autre. C'est la propriété la plus critique du produit.
- **Un seul système d'authentification.** NextAuth v5, `Credentials` +
  bcrypt.
- **Photos** : 5 Mo maximum, jpg / jpeg / png / webp.
- **Activation manuelle d'une agence**, décidée par un super admin. Pas de
  paiement en ligne, et il ne doit pas y en avoir dans le MVP.
- Devise **DZD**, marché **algérien**.

## Ce qui n'est pas dans ce fichier

- **L'avancement** → `docs/stories/sprint-status.yaml`, seule source de
  vérité. Ne jamais le déduire d'ici.
- **Le plan de travail** → `docs/epics.md`.
- **Les défauts** → `docs/qa/bug-report.md` (`BUG-nn`) et
  `docs/stories/deferred-work.md` (`REP-nn`).
- **Les fonctionnalités restant à concevoir** — guide utilisateur,
  déploiement VPS réel — sont hors de la remise en état et relèvent d'un
  **PRD qui n'existe pas encore** (`bmad-prd`). Leur seule trace est
  l'archive `GSD.md`.

## Méthode

**BMAD**, depuis le 9 août 2026. Le cycle et les règles sont dans
`CLAUDE.md`. La méthode précédente (GSD, par phases numérotées) est
**abandonnée** : `GSD.md` est une archive de la construction du produit, pas
un document vivant, et son vocabulaire de « phases » ne doit plus être
employé nulle part.
