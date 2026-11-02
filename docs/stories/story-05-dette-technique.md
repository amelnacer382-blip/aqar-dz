# Story 05 — Dette technique

**Statut :** À faire
**Lot :** 3 — dette
**Couvre :** BUG-10, BUG-12, BUG-14, BUG-15, BUG-17, BUG-18
**Gravité :** 🔵 Basse

---

## Story

**En tant que** développeur reprenant le projet,
**je veux** que les commentaires disent la vérité et que les cas limites
produisent des messages,
**afin de** ne pas construire sur une promesse qui n'est pas tenue.

---

## Critères d'acceptation

1. **BUG-10** — `lib/auth-guard.ts:74-90` : soit la branche
   `super_admin` est retirée avec le commentaire qui la décrit, soit le
   dépannage d'agence par un super admin est réellement implémenté.
   **Arbitrage produit requis avant de coder** — voir ci-dessous.
2. **BUG-12** — Une inscription concurrente sur la même adresse produit
   « Cet email est déjà utilisé » en 400, pas une erreur 500.
   Attraper `P2002` dans le `catch` de `app/api/auth/register/route.ts`.
3. **BUG-14** — `lib/storage.ts` : échapper `SUPABASE_BUCKET` avant de le
   composer dans une `RegExp` (`keyFromUrl`).
4. **BUG-15** — `Property.reference` et `Payment.reference` deviennent des
   références lisibles (`AQ-2026-0042`), séquentielles par agence.
   Les valeurs existantes sont conservées : la migration ne renumérote pas
   l'historique.
5. **BUG-17** — `authorize()` et `explainLoginFailure()` partagent le même
   compteur de tentatives, au lieu d'en avoir un chacun. Budget réel : 10
   par compte et par quart d'heure, pas 20.
6. **BUG-18** — La limitation de débit est documentée dans le guide de
   déploiement comme dépendant d'une **instance unique**, avec la marche à
   suivre le jour où l'on passe à plusieurs.

---

## L'arbitrage sur BUG-10

Le commentaire de `requireAgencyAdmin` promet que « le super admin passe
aussi : il doit pouvoir dépanner une agence ». C'est faux dans les faits —
`requireAgency()` le rejette faute d'`agencyId`, et le middleware le
renvoie de `/agency` vers `/admin`.

Deux issues, et le choix n'appartient pas au développeur :

**A. Retirer la promesse.** Supprimer la branche morte et le commentaire.
Coût nul. Le super admin ne dépanne pas : il demande une capture d'écran.

**B. Tenir la promesse.** Permettre à un super admin d'endosser une agence
le temps d'une session, avec une bannière visible en permanence et une
entrée au journal d'audit à l'entrée comme à la sortie. C'est une
fonctionnalité, pas un correctif : elle traverse le middleware, les gardes,
la session et l'interface.

L'option B a une vraie valeur de support pour un SaaS vendu à des agences
peu outillées. Elle relève du PRD. **Ne pas coder avant décision.**

---

## Notes de développement

**Sur les références lisibles (BUG-15).** Une séquence par agence et par
année demande un compteur transactionnel — ne pas se contenter d'un
`count() + 1`, qui produit des doublons dès deux créations simultanées.
Une table `Counter(agencyId, year, entity, value)` mise à jour dans la même
transaction que la création est la solution la plus simple qui tienne.

Garder `cuid()` comme clé primaire : seule la référence *affichée* change.

**Sur le compteur partagé (BUG-17).** La clé de `explainLoginFailure` est
`explication:compte:…`, celle d'`authorize` est `login:compte:…`. Les
unifier suffit — attention à ce que la remise à zéro après connexion
réussie efface bien la clé commune.
