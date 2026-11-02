# Contexte projet — Aqar DZ

> Ce fichier est chargé automatiquement par **tous** les workflows BMAD
> (`project_context = **/project-context.md`). Il donne à chaque agent les
> règles réelles du dépôt, en une seule lecture.
>
> **Méthode : BMAD.** GSD est abandonné. `GSD.md` est une archive des
> phases 1 à 8, pas un document vivant.
>
> Sources de vérité amont : `CLAUDE.md` (contrat de travail et règles
> permanentes, chargé automatiquement par Claude Code),
> `CONTEXT.md` (contexte métier), `docs/architecture.md` (architecture
> réelle), `docs/epics.md` (plan de travail),
> `docs/stories/sprint-status.yaml` (avancement). En cas de contradiction,
> **le code fait foi** — ce projet est brownfield et sa documentation a
> déjà divergé une fois.

---

## Ce qu'est le produit

SaaS multi-locataire de gestion d'agences immobilières pour le marché
algérien. Un seul déploiement Next.js sert trois publics :

| Espace | Chemin | Accès |
|--------|--------|-------|
| Vitrine publique d'une agence | `/vitrine/[slug]` | sans compte |
| Espace de gestion d'une agence | `/agency/**` | `agency_admin`, `agent` |
| Console de l'éditeur | `/admin/**` | `super_admin` |

Devise DZD. L'activation d'une agence est **manuelle**, décidée par un
super admin : il n'y a pas de paiement en ligne, et il ne doit pas y en
avoir dans le MVP.

---

## Pile technique réelle

- **Next.js 14**, App Router, TypeScript strict, cible ES5.
- **Rendu** : Server Components. Les mutations passent par des **Server
  Actions** ; les routes API ne servent que ce qui doit être appelé depuis
  le navigateur (upload, exports, PDF, suppressions, santé).
- **Prisma** sur PostgreSQL. 20 tables, 18 énumérations.
- **NextAuth v5**, stratégie **JWT**, unique fournisseur `Credentials` +
  bcrypt. `PrismaAdapter` est branché mais la session ne passe pas par la
  base.
- **Tailwind + shadcn/ui**, Framer Motion, Lucide React.
- **@react-pdf/renderer** pour contrats et quittances. Ni Puppeteer ni jsPDF.
- **Playwright** pour les tests de bout en bout. Aucun runner unitaire
  n'est installé (ni Vitest ni Jest) — ne pas écrire de test unitaire sans
  d'abord en ajouter un.

**Supabase ne sert qu'au stockage de fichiers, et il est optionnel.** Ce
n'est *pas* le fournisseur d'authentification, malgré ce qu'annonce encore
la règle 4 (`CLAUDE.md` §12). Sans `SUPABASE_STORAGE_BUCKET`, le stockage
bascule sur le disque local.

`@tanstack/react-query` est installé mais importé nulle part.

---

## Règles non négociables

1. **Navbar horizontale, jamais de sidebar.** Sur 100 % des pages.
2. **Cloisonnement multi-locataire.** Toute lecture et toute écriture
   filtre sur `agencyId`. Le motif imposé, sans exception :
   ```ts
   const guard = await requireAgency()          // ou getApiAgency() en API
   const row = await prisma.x.findFirst({ where: { id, agencyId } })
   if (!row) redirect(...)                      // ou 404 JSON
   await prisma.x.update({ where: { id }, data })
   ```
   Un identifiant relationnel reçu d'un formulaire est **re-vérifié**
   (voir `app/agency/payments/verify-links.ts`).
3. **Aucun `formData.get(x) as Enum`.** Toute entrée passe par
   `parseForm(schema, formData)` (`lib/form.ts`) avec un schéma Zod de
   `lib/validations/index.ts`.
4. **Aucun secret en dur, aucun `console.log` de production.**
5. **Suppression réversible** pour `Property`, `Client`, `Owner` : poser
   `deletedAt`, jamais `delete`. Le filtre est injecté par l'extension
   Prisma de `lib/prisma.ts` — **mais uniquement au premier niveau** :
   les relations imbriquées et `findUnique` ne sont pas couverts.
6. **Journaliser** toute action conséquente via `recordAudit()` :
   suppression, restauration, changement de statut, gestion des comptes.
7. **Un administrateur d'agence ne peut jamais fabriquer un
   `super_admin`**, ni laisser son agence sans administrateur actif.

---

## Repères de code

| Besoin | Où |
|--------|-----|
| Garde d'accès | `lib/auth-guard.ts` — `requireAgency`, `requireAgencyAdmin`, `requireSuperAdmin`, `getApiAgency` |
| Schémas d'entrée | `lib/validations/index.ts` |
| FormData → Zod | `lib/form.ts` — `parseForm`, `withError`, `withSuccess` |
| Pagination et recherche | `lib/list-params.ts` — `readPageParams`, `textSearch`, `dealSearch` |
| Limitation de débit | `lib/rate-limit.ts` |
| Stockage de fichiers | `lib/storage.ts` — `putFile`, `deleteFile`, `keyFromUrl` |
| Emails | `lib/mailer.ts` (transport, gabarit) + `lib/notifications.ts` (messages) |
| Journal | `lib/audit.ts` |
| Decimal → nombre pour le client | `lib/serialize.ts` — `toPlain` |
| Export CSV | `lib/csv.ts` |

---

## Environnement de travail

- **`node_modules` peut être absent** : lancer `npm ci` avant toute
  commande de build, de lint ou de test.
- **Développement** : `npm run dev` écoute le port **3002**.
- **Pile conteneurisée** : `docker compose -f docker-compose.prod.yml up -d`.
  nginx sur **8095**, application sur **3000**, PostgreSQL sur **5433**.
- **Jeu de démonstration** : `--profile seed run --rm seed`.
  Comptes : `superadmin@aqar.dz`, `admin@aqar.dz`, `agent@aqar.dz`,
  mot de passe `password123`. Agence `agence-demo`.
- **github.com est lent et parfois injoignable** depuis ce réseau ; le
  registre npm passe normalement. Ne pas concevoir un workflow qui clone
  un dépôt à chaud.

---

## Ce qu'il faut savoir avant de toucher au code

Un audit complet a été mené le 9 août 2026 : **31 défauts**, dont 4
critiques, portés à **35** par les relectures du 12 août, la revue de code
du 12 août (BUG-34) et le signalement de l'éditeur du 14 août (BUG-35),
consignés
dans `docs/qa/bug-report.md` et découpés en épopées dans `docs/epics.md`.
Quatre pièges reviennent souvent et méritent d'être connus d'avance :

- **`lib/prisma.ts` ne filtre pas les relations imbriquées.** Un
  `_count` ou un `include` sur `Property` / `Client` / `Owner` compte les
  lignes supprimées. Le commentaire du fichier promet plus que ce qu'il
  fait.
- **`emailLayout` déclare recevoir des paragraphes déjà échappés.**
  Aucun appelant ne les échappe. Toute chaîne d'origine utilisateur qui
  entre dans un email doit être échappée par l'appelant.
- **L'URL d'un document est une chaîne libre** venue du formulaire, alors
  que la galerie d'un bien, elle, est contrainte par
  `parseGalleryUrls()`. Cette asymétrie est la cause de deux défauts
  distincts.
- **`requireAgency()` ne dit *rien* du rôle.** Elle dit l'agence, et
  depuis la story 1.8 elle la dit à jour — le rôle, `isActive` et
  `agencyId` sont relus en base à chaque requête, la seule valeur venant du
  jeton étant `session.user.id`. Mais une **suppression** demande en plus
  `requireAgencyAdmin()` ou `isAgencyAdmin()` : cinq Server Actions
  d'écrans d'édition l'avaient oublié — c'était BUG-32, fermé par la
  story 4.6, et l'inventaire des actions destructives est désormais dans
  `docs/architecture.md` §4 : **s'y comparer avant d'ajouter un écran.**
  Et ne jamais
  réintroduire de contrôle sur `session.user.role` : ce serait rouvrir
  BUG-33 sans que rien ne le montre.
- **Une Server Action s'éprouve en la rejouant, pas en cliquant.** C'est un
  point d'entrée `POST` joignable sans l'écran qui la rend : un test qui
  clique ne prouve que le rendu du bouton. Le mécanisme est dans
  `tests/roles.spec.ts` (`releverSuppression` / `rejouer`) — relever le
  `<form>` entier dans la session d'un compte autorisé, le réinjecter dans
  celle du compte à éprouver, appeler `form.submit()`. Les actions
  d'écran capturent `params` : elles sont **liées**, leurs arguments sont
  chiffrés dans `$ACTION_n:k`, et ni `request.post({ form })` ni
  `request.post({ multipart })` ne reproduisent l'encodage de React
  (`Failed to find Server Action`). **Ne jamais coder un identifiant
  d'action en dur** : il est calculé au `build` et le test deviendrait vert
  en ne testant plus rien (BUG-28).
- **Un refus de garde arrive en `200`, et c'est le navigateur qui
  redirige.** Toutes les pages de `/admin` et `/agency` ont un
  `loading.tsx` : Next envoie le squelette — donc l'en-tête — avant que la
  garde n'ait tranché, si bien qu'un `redirect()` ne peut plus être un
  `Location`. Mesuré le 12-08-2026 : réponse brute `200`, sans `Location`,
  sur un compte refusé. Le refus est réel — la garde s'exécute avant toute
  lecture de données — mais **aucun test ne doit conclure quoi que ce soit
  d'un code HTTP ni d'un `page.url()` lu juste après `goto()`** : attendre
  avec `waitForURL`, ou asserter le contenu. Cette leçon a déjà coûté trois
  fois (stories 4.1, 4.2, et la revue de la 1.8).
- **L'autorisation n'a qu'une couche, et `middleware.ts` n'en fait pas
  partie.** Il authentifie — y a-t-il une session — refuse
  `/uploads/documents/`, et laisse passer. Il tourne en Edge Runtime, donc
  la seule valeur de rôle qu'il pourrait lire est celle du jeton : y
  remettre un contrôle de rôle recrée la boucle de redirection fermée par
  la revue de la story 1.8 (un compte rétrogradé rebondissait entre
  `/admin` et `/agency` jusqu'à `ERR_TOO_MANY_REDIRECTS`). L'aiguillage
  entre les deux espaces est dans `lib/auth-guard.ts`. Corollaire : **toute
  page de `/admin` doit appeler `requireSuperAdmin()` elle-même**, plus
  rien ne la couvre en amont.

---

## Définition de « terminé »

Une story n'est close que si :

- [ ] `npx tsc --noEmit` — 0 erreur
- [ ] `npm run lint` — 0 erreur
- [ ] `npm run test:e2e` — vert, et **au moins un test couvre la
      régression corrigée**
- [ ] le cloisonnement `agencyId` est vérifié sur tout chemin touché
- [ ] `docs/qa/bug-report.md` est mis à jour (défaut marqué corrigé)
- [ ] `docs/stories/sprint-status.yaml` reflète le nouveau statut de la story
