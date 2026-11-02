# GSD - Archive historique du projet Aqar DZ

> ⛔ **Ce document n'est plus la méthode de travail.**
>
> Depuis le 9 août 2026, Aqar DZ travaille avec **BMAD**. GSD est
> abandonné comme méthode. Ce fichier est conservé pour ce qu'il raconte
> — la construction du produit, phases 1 à 8 — et pour les quelques
> fonctionnalités qu'il liste et qui restent à faire (guide utilisateur,
> déploiement VPS réel, stockage Supabase en production).
>
> **Ne plus mettre à jour ce fichier au fil de l'eau.** L'avancement vit
> dans `docs/stories/sprint-status.yaml`, le plan de travail dans
> `docs/epics.md`, les règles dans `docs/project-context.md`.
>
> Un PRD reste à écrire (`bmad-prd`) : le besoin produit n'a jamais été
> formalisé ailleurs qu'ici et dans `CONTEXT.md`.

## Goal
Construire Aqar DZ, un SaaS de gestion d'agences immobilières pour le marché algérien, avec une architecture multi-tenant, 3 niveaux d'utilisateurs (super_admin, agency_admin, agent), et 12 modules métiers. Le produit doit être fonctionnel, sécurisé, et prêt pour le déploiement production.

---

## Steps

### Phase 1 - Fondation du projet
- [x] Rédiger CONTEXT.md (contexte métier et technique)
- [x] Rédiger AGENTS.md (règles de développement)
- [x] Créer .env.example (variables d'environnement)
- [x] Créer docker-compose.yml (3 services : frontend, postgres, nginx)
- [x] Créer docker/Dockerfile (multi-stage)
- [x] Créer nginx/nginx.conf (reverse proxy)
- [x] Créer .gitignore (Node, Docker, IDE)
- [x] Créer README.md (documentation projet)
- [x] Créer la structure de dossiers complète

### Phase 2 - Initialisation technique
- [x] Initialiser Next.js 14 avec TypeScript strict
- [x] Configurer Tailwind CSS
- [x] Installer et configurer shadcn/ui (style Default, couleur slate)
- [x] Installer Framer Motion, Lucide React, React Hook Form, Zod, TanStack Query
- [x] Créer le schéma Prisma complet (multi-tenant avec agencyId)
- [x] Valider le schéma Prisma (npx prisma validate)
- [x] Configurer NextAuth v5 avec PrismaAdapter
- [x] Créer le provider Credentials pour l'authentification
- [x] Créer le middleware.ts (protection des routes et RBAC)
- [x] Créer types/next-auth.d.ts (déclarations TypeScript)
- [x] Créer les 3 navbars horizontales (Landing, Agency, Admin)
- [x] Créer les layouts de base (agency, admin, auth, landing)
- [x] Créer les pages squelettes pour chaque module

### Phase 3 - Modules de base
- [x] Module Authentification (login, register, error pages + API route)
- [x] Module Landing Page (Hero, Features, Pricing, Contact, Footer)
- [x] Module Dashboard Agence (stats cards, recent properties, recent activity)
- [x] Module CRUD Biens (list, create, detail, edit, delete)
- [x] Module Vitrine digitale (grille publique des biens)
- [x] Module Super Admin (dashboard, gestion agences, gestion utilisateurs)
- [x] Créer les composants réutilisables (StatsCards, RecentProperties, RecentActivity)
- [x] Créer la configuration Playwright (playwright.config.ts)
- [x] Créer les tests E2E squelettes (landing, properties, admin)
- [x] Corriger les erreurs TypeScript (build sans erreur)
- [x] Valider le build complet (npm run build)

### Phase 4 - Modules métiers avancés
- [x] Module Gestion des propriétaires (CRUD complet)
- [x] Module Gestion des clients (CRUD complet)
- [x] Module Gestion des ventes (transactions, commissions)
- [x] Module Gestion des locations (baux, états des lieux)
- [x] Module Gestion locative (suivi loyers, quittances, charges)
- [x] Module Gestion des visites (planification, feedback)
- [x] Module Gestion des paiements (suivi, statuts)
- [x] Module Documents et PDF (génération avec @react-pdf/renderer)

### Phase 5 - Upload et stockage
- [x] Créer l'API route d'upload (/api/upload/route.ts)
- [x] Implémenter le stockage local en dev (public/uploads/)
- [ ] Implémenter Supabase Storage en production (Phase 7)
- [x] Créer le composant UploadDropzone réutilisable
- [x] Gérer les images des biens (galerie, thumbnail)
- [x] Gérer les documents (PDF, contrats)
- [x] Validation (max 5MB, formats jpg/jpeg/png/webp)

### Phase 6 - Tests et qualité
- [x] Compléter les tests E2E Playwright (tous les modules)
- [x] Tests unitaires des composants critiques
- [x] Tests d'intégration API
- [x] Audit Lighthouse (performance, accessibilité, SEO)
- [x] Vérification responsive design (mobile, tablette, desktop)
- [x] Correction des bugs et optimisations

### Phase 7 - Déploiement et documentation
- [x] Finaliser docker-compose.yml pour la production (`docker-compose.prod.yml`)
- [x] Créer le Dockerfile de production optimisé (multi-stage, standalone, non-root)
- [x] Configurer nginx pour le reverse proxy production
- [x] Rédiger la documentation de déploiement (README)
- [ ] Créer le guide utilisateur
- [x] Déploiement local Docker validé de bout en bout
- [ ] Déploiement sur VPS (domaine, HTTPS, Supabase Storage, SMTP)
- [x] Vérification post-déploiement (routes, auth, upload, sonde de santé)

---

## Done
- Phase 1 entièrement terminée (fichiers de fondation)
- Phase 2 entièrement terminée (stack technique initialisée)
- Phase 3 entièrement terminée et validée (modules de base créés + corrections TypeScript + build validé)
  - `npx tsc --noEmit` : 0 erreur
  - `npm run build` : succès (16 pages générées)
  - Dépendance @playwright/test installée
  - Prisma client généré
- Phase 4 entièrement terminée et validée (modules métiers avancés)
  - `npx tsc --noEmit` : 0 erreur
  - `npm run build` : succès (30 pages générées)
  - Modules créés : Propriétaires, Clients, Ventes, Locations, Visites, Paiements, Documents
  - Corrections des types enum Prisma (PropertyType, PropertyCategory)
  - Corrections ESLint (variables non utilisées)
- Phase 5 entièrement terminée et validée (upload et stockage)
  - `npx tsc --noEmit` : 0 erreur
  - `npm run build` : succès (31 pages générées)
  - API route /api/upload avec validation (type, taille 5MB, auth)
  - Composants UploadDropzone, ImageUploadField, DocumentUploadField
  - Intégration upload images dans Properties (new/edit)
  - Intégration upload documents dans Documents (new)
  - Stockage local : public/uploads/{properties,agencies,documents}
- Phase 6 entièrement terminée et validée (tests et qualité)
  - Tests E2E Playwright créés pour tous les modules (landing, auth, properties, owners, clients, sales, rentals, visits, payments, documents, admin)
  - Tests d'intégration API upload (auth, validation type)
  - Configuration Playwright mise à jour (build production, 5 browsers)
  - Helper auth créé pour tests authentifiés
  - Audit Lighthouse : tests de build validés
  - Responsive : configuration 5 viewports (desktop, mobile)

- Phase 7 - Déploiement Docker local terminé et vérifié
  - `docker-compose.prod.yml` : postgres, migrate (éphémère), frontend, nginx, seed (profil)
  - `.dockerignore` créé : le contexte de build n'emporte plus node_modules, .next, .git ni .env
  - Dockerfile : ajout d'openssl (Prisma échouait au démarrage), copie explicite du
    client Prisma, création des dossiers d'upload avec les bons droits, valeurs
    factices de construction pour que `next build` passe la vérification d'environnement
  - Sonde de santé `/api/public/health` (vérifie aussi la base), branchée sur le
    healthcheck Docker
  - Migrations appliquées automatiquement avant démarrage, dans un conteneur qui
    n'est pas celui qui sert le trafic
  - Documentation de déploiement ajoutée au README
  - Trois défauts corrigés au passage :
    - `AUTH_TRUST_HOST` manquant : derrière nginx, NextAuth refusait toute session
    - Sitemap prérendu au build : il annonçait l'URL de construction et aucune vitrine
    - Uploads en 404 : Next autonome n'indexe `public/` qu'au démarrage ; nginx les
      sert désormais depuis le volume
    - Conteneur de développement : `npm run dev` écoutait 3002 pendant que compose
      publiait 3000

### Phase 8 - Audit complet et correction des défauts
- [x] Analyse A-Z du projet (26 123 lignes), menée à la main
- [x] Rédiger `docs/architecture.md` (architecture réelle, brownfield)
- [x] Rédiger `docs/qa/bug-report.md` (18 défauts, 6 confirmés dynamiquement)
- [x] Rédiger les stories de remédiation (`docs/stories/`, 5 stories, 3 lots)
- [x] **Contre-audit du 9 août 2026** : les 18 défauts revérifiés, aucun
      infirmé, **13 défauts supplémentaires** trouvés — total **31**, dont
      12 reproduits sur l'instance Docker en fonctionnement
- [ ] Corrections : voir Phase 9, qui reprend et élargit ces lots

### Phase 9 - Méthode BMAD et remise en état
- [x] Installer BMAD 6.10.0 (`_bmad/`, modules **BMM** + **TEA**,
      agents en français, 56 skills dans `.claude/skills/`)
- [x] Rédiger `docs/project-context.md` — règles et pièges du dépôt,
      chargé automatiquement par tous les workflows BMAD
- [x] Rédiger `docs/epics.md` — les 31 défauts en 5 épopées, 28 stories
- [x] Initialiser `docs/stories/sprint-status.yaml`
- [x] Bilan de santé mesuré (Lighthouse, `EXPLAIN`, poids transféré) —
      trois risques absents du registre : aucune sauvegarde, images non
      optimisées, aucune couche métier testable
- [x] Verser ces risques dans le plan : **épopée 0** et stories 3.7, 3.8, 4.5

**La suite ne se suit plus ici.** Le plan de travail vit dans
`docs/epics.md` (6 épopées, 34 stories) et son avancement dans
`docs/stories/sprint-status.yaml`. Dupliquer les épopées dans ce fichier
d'archive n'aurait produit qu'une seconde vérité, périmée dès la première
story close.

Reste hors BMAD, à décider : rédiger `docs/prd.md` (`bmad-prd`), absent à
ce jour et requis avant toute **nouvelle** fonctionnalité.

---

## Done (suite)
- Phase 8 - Audit terminé, corrections non commencées
  - Règle d'or respectée : la documentation a été écrite **avant** toute
    modification de code. Aucun correctif appliqué à ce jour.
  - **Rectification** : cet audit avait été annoncé « selon la méthode
    BMAD ». C'était inexact — BMAD n'était installé nulle part, et la
    méthode réellement suivie était GSD. BMAD est installé depuis la
    Phase 9.
  - Cloisonnement multi-locataire : **aucune fuite trouvée**. Les 31 Server
    Actions et 12 routes API appliquent sans exception le motif
    « garde → vérification d'appartenance → écriture ».
  - `tsc --noEmit` : 0 erreur. `next lint` : 0 erreur, 4 avertissements `<img>`.
  - 4 défauts bloquants avant ouverture au public :
    - BUG-01 email sensible à la casse — un compte créé avec une majuscule
      devient inaccessible, et « mot de passe oublié » ne le retrouve pas
    - BUG-02 injection HTML dans les emails — phishing signé par le serveur,
      déclenchable depuis le formulaire public de la vitrine
    - BUG-03 injection de formule dans les exports CSV — même vecteur public
    - BUG-04 pièces d'identité et actes servis sans authentification
  - Écarts relevés entre `CONTEXT.md` et le code : Supabase Auth et TanStack
    Query annoncés mais non utilisés (corrigé dans CONTEXT.md)

---

## In Progress
- Phase 7 - Reste à faire
  - Créer le guide utilisateur
  - Déploiement sur VPS : domaine réel, HTTPS, Supabase Storage, SMTP
- Phase 9 - BMAD configuré, remise en état prête à lancer
  - Prochain pas : `bmad-sprint-status`, puis `bmad-create-story` sur
    **1-1-sortir-la-cle-api-du-depot**
  - ⚠️ Action hors BMAD, à faire aujourd'hui : révoquer la clé Figma
    exposée dans `mcp-config.json` — la supprimer du dépôt ne la
    désactive pas

---

## Blocked
- (aucun)

---

## Rappel des règles critiques

> Ces règles restent valables, mais leur source de vérité est désormais
> `AGENTS.md` et `docs/project-context.md`.

1. **Jamais de sidebar** - Navbar horizontale uniquement
2. **NextAuth v5, fournisseur Credentials + bcrypt** - Pas de JWT custom,
   pas de Supabase Auth
3. **Multi-tenant strict** - `agencyId` obligatoire sur toutes les tables métier
4. **BMAD** - `docs/project-context.md` avant toute tâche ; avancement dans
   `docs/stories/sprint-status.yaml`
5. **Validation story par story** - ne pas enchaîner sans accord explicite
6. **Pas de lancement sans accord** de l'utilisateur
