# Story 03 — Protéger l'accès aux documents

**Statut :** À faire
**Lot :** 1 — avant ouverture au public
**Couvre :** BUG-04, BUG-16
**Gravité :** 🟠 Haute

---

## Story

**En tant que** client d'une agence,
**je veux** que la copie de ma pièce d'identité ne soit consultable que par
l'agence à qui je l'ai confiée,
**afin de** ne pas la voir circuler par une simple adresse web.

---

## Contexte

`DocumentType` comprend `piece_identite`, `acte_propriete`,
`contrat_vente` et `contrat_location`. Ces fichiers sont aujourd'hui
servis sans qu'aucune session ne soit vérifiée — par nginx depuis le
déploiement, par Next auparavant. La seule barrière est la difficulté à
deviner le nom du fichier : un horodatage à la milliseconde et six
caractères tirés de `Math.random()`, qui n'est pas un générateur
cryptographique.

Une URL secrète n'est pas un contrôle d'accès. Elle fuit par l'historique
du navigateur, le partage de lien, l'en-tête `Referer`, les sauvegardes.

**Distinction essentielle :** les *photos de biens* doivent rester
publiques — la vitrine en dépend, c'est le module prioritaire du produit.
Seuls les *documents* changent de régime.

---

## Critères d'acceptation

1. Un document n'est servi qu'à un utilisateur dont la session appartient à
   l'agence propriétaire du document.
2. Une requête sans session sur un document répond 401, jamais le fichier.
3. Une requête authentifiée sur un document d'une **autre** agence répond
   404 — pas 403 : l'existence même du document ne doit pas être révélée.
4. Les photos de biens (`/uploads/properties/`) restent accessibles
   publiquement, sans session, servies par nginx comme aujourd'hui.
5. Les documents déjà déposés restent accessibles par le nouveau chemin,
   sans migration manuelle des fichiers.
6. `robots.txt` exclut `/uploads/`.
7. Le téléchargement propose un nom de fichier lisible (le `name` saisi par
   l'agence), pas `1786275325500-9hatnr.pdf`.

---

## Tâches

- [ ] Créer `app/api/documents/[id]/file/route.ts` :
      `getApiAgency()` → `prisma.document.findFirst({ where: { id, agencyId } })`
      → 404 si absent → lecture du flux → réponse avec `Content-Type`,
      `Content-Disposition: attachment; filename="<name>"` et
      `Cache-Control: private, no-store`.
- [ ] `lib/storage.ts` — ajouter `readFile(key)` symétrique de `putFile`,
      qui gère les deux modes. En mode Supabase, préférer une URL signée à
      durée courte plutôt que de faire transiter le flux par le serveur.
- [ ] Basculer les liens des écrans documents
      (`app/agency/documents/page.tsx`, `[id]/page.tsx`) vers la nouvelle
      route.
- [ ] `nginx/nginx.conf` — refuser `/uploads/documents/` en accès direct
      (`return 404`), tout en laissant passer `/uploads/properties/` et
      `/uploads/agencies/`.
- [ ] Si le stockage Supabase est activé : rendre le bucket privé et n'y
      accéder que par URL signée. Un bucket public annulerait tout le reste.
- [ ] `app/robots.ts:20` — ajouter `/uploads/` à `disallow`.

---

## Notes de développement

**404 plutôt que 403 pour une autre agence.** Le reste du code applique déjà
cette règle (« Bien introuvable », « Paiement introuvable ») : un 403
confirmerait qu'un document existe sous cet identifiant.

**Ne pas se contenter du blocage nginx.** Le bloquer côté proxy sans créer
la route authentifiée rendrait les documents totalement inaccessibles, y
compris à l'agence. Les deux tâches vont ensemble.

**Le nom de fichier réel n'est pas de confiance.** `Document.name` est saisi
par l'agence : l'échapper dans `Content-Disposition` (guillemets, retours
chariot) pour ne pas permettre d'injection d'en-tête.

---

## Tests

- Déposer un document en tant qu'`admin@aqar.dz`.
- Récupérer son URL, se déconnecter, la rappeler → 401.
- Se connecter avec un compte d'une autre agence → 404.
- Vérifier qu'une photo de bien reste accessible sans session.
- `curl` direct sur `/uploads/documents/<fichier>` → 404 côté nginx.
