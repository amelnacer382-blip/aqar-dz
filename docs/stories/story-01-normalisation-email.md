# Story 01 — Normaliser les adresses email

**Statut :** À faire
**Lot :** 1 — avant ouverture au public
**Couvre :** BUG-01
**Gravité :** 🔴 Critique

---

## Story

**En tant qu**'utilisateur d'une agence,
**je veux** pouvoir me connecter avec mon adresse email quelle que soit la casse,
**afin de** ne pas perdre définitivement l'accès à mon compte pour une majuscule.

---

## Contexte

Aujourd'hui, `Contact@ImmoAlger.dz` et `contact@immoalger.dz` sont deux
comptes différents. Pire : l'utilisateur enfermé dehors ne peut pas s'en
sortir seul, parce que « Mot de passe oublié » répond le même message
rassurant que le compte existe ou non — protection légitime contre
l'énumération, qui devient ici un cul-de-sac.

Vérifié sur l'instance : `superadmin@aqar.dz` connecte, `SuperAdmin@aqar.dz` non.

---

## Critères d'acceptation

1. La connexion réussit avec l'adresse saisie en majuscules, en minuscules
   ou en casse mixte, pour un compte existant.
2. L'inscription enregistre l'adresse en minuscules, sans espace de bord.
3. Une inscription avec une adresse déjà prise dans une autre casse est
   refusée avec « Cet email est déjà utilisé » — et non par une erreur 500.
4. « Mot de passe oublié » trouve le compte quelle que soit la casse saisie.
5. Les comptes déjà en base dont l'adresse contient une majuscule sont
   normalisés par une migration, et leurs propriétaires peuvent se connecter
   sans intervention.
6. La migration détecte et signale explicitement les collisions
   (deux comptes qui se replieraient sur la même adresse) au lieu
   d'échouer sur la contrainte d'unicité.

---

## Tâches

- [ ] `lib/validations/index.ts` — ajouter `.trim().toLowerCase()` à
      `loginSchema.email` et `registerSchema.email`.
- [ ] `app/api/auth/register/route.ts:11-18` — la route redéfinit son
      **propre** `registerSchema`, distinct de celui de `lib/validations`.
      Supprimer le doublon et importer celui de `lib/validations`, plutôt
      que de corriger deux fois la même chose.
- [ ] `app/auth/forgot/actions.ts:11` — même normalisation.
- [ ] Vérifier `agencyUserSchema` : déjà correct (`.toLowerCase()`), ne rien
      changer — c'est la référence à aligner.
- [ ] Migration SQL `normalize_user_emails` :
      - repérer d'abord les collisions
        (`select lower(email), count(*) from users group by 1 having count(*) > 1`) ;
      - si collision, **arrêter** et lister — l'arbitrage est humain, il n'est
        pas automatisable ;
      - sinon `update users set email = lower(trim(email))`.
- [ ] Même traitement pour `agencies.email` (utilisé pour les notifications).

---

## Notes de développement

**Ne pas normaliser uniquement à la lecture** (`findUnique({ email: lower })`)
sans corriger les données : la contrainte d'unicité de PostgreSQL reste
sensible à la casse, donc les doublons continueraient d'être créés.

**Piste à écarter :** passer la colonne en `citext`. Cela résoudrait le
problème au niveau de la base, mais l'extension doit être installée sur
l'instance PostgreSQL de production (Supabase la propose, un VPS nu non),
et Prisma ne la gère pas nativement. La normalisation applicative est plus
portable, et c'est déjà ce que fait `agencyUserSchema`.

---

## Tests

- E2E : inscription avec `Test@Exemple.dz`, puis connexion avec
  `test@exemple.dz` — doit réussir.
- E2E : « mot de passe oublié » avec une casse différente — le jeton doit
  être créé (vérifiable en base, l'écran répond toujours pareil).
- Migration : jouer sur une copie de la base de démonstration après y avoir
  inséré volontairement une collision, vérifier l'arrêt et le rapport.
